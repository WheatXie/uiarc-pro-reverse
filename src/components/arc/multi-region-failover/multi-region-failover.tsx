"use client";

/**
 * Multi-region failover.
 *
 * An animated multi-region failover on a layered 2.5D stage. Users stream requests through a
 * global load balancer that splits them between two regions, each a platform of six instances.
 * The instances in the primary region fail one by one, requests there turn into errors and three
 * health checks fail in a row, so the balancer marks the region unhealthy and shifts its weight
 * smoothly to the healthy region. The primary recovers, has to pass three checks, and traffic
 * ramps back until the split is even again.
 *
 * Every frame is a pure function of one clock, so the weights, counters, checks, statuses and the
 * scrubber stay in sync; jumps land exactly and the loop is seamless. A single rAF loop writes SVG
 * attributes, transforms, opacity and text directly, and only when a value changed.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";

import styles from "./multi-region-failover.module.css";

export type FailoverNodeKey = "users" | "balancer" | "primary" | "secondary";
export type FailoverRegionKey = "primary" | "secondary";

export interface FailoverNodeOverride {
  /** Name shown under the platform and in the weight split. */
  label?: string;
  /** Second line under the name, usually a hostname or a region code. */
  meta?: string;
  /** Text of the hover tag that points at the platform. */
  detail?: string;
  /** Simple Icons path data, an image URL, or any node. */
  icon?: string | ReactNode;
  /** Fill for the mark. */
  color?: string;
}

export interface MultiRegionFailoverProps {
  /** Hostname the balancer answers for. */
  hostname?: string;
  /** Total requests per second from users. */
  requestsPerSecond?: number;
  /** Median latency of the primary region while the split is even. */
  latencyMs?: number;
  /** Per-node overrides. */
  nodes?: Partial<Record<FailoverNodeKey, FailoverNodeOverride>>;
  /** Multiplies the pace. One cycle takes 21 seconds at 1, 0 holds still. */
  speed?: number;
  /** Holds the animation, easing to rest. */
  paused?: boolean;
  /** Any CSS color for the requests, lit routes, the weight dial, the split bar and the scrubber. */
  accent?: string;
  /** Shows the step scrubber with a pause button. */
  controls?: boolean;
  /** Shows the current stage title and one line that narrates it. */
  caption?: boolean;
  /** Accessible description. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const NODE_KEYS: FailoverNodeKey[] = ["users", "balancer", "primary", "secondary"];
const REGION_KEYS: FailoverRegionKey[] = ["primary", "secondary"];
const CUBE_SLOTS: [number, number][] = [
  [0.2, 0.3],
  [0.5, 0.3],
  [0.8, 0.3],
  [0.2, 0.72],
  [0.5, 0.72],
  [0.8, 0.72],
];
const CUBE_COUNT = CUBE_SLOTS.length;
const POOL = Math.round(84);
const CYCLE = 21;

const failStart = (index: number) => 3.9 + 1.3 * index;
const recoverStart = (index: number) => failStart(index) + 1.2;
const FAIL_OVER_START = recoverStart(2);
const REBALANCE_START = recoverStart(8);
const OUT_OF_ROTATION_END = 11.4 + 0.12 * (CUBE_COUNT - 1);

const STEPS = [
  { start: 0, rep: 2.4, short: "Balanced", title: "Balanced" },
  { start: 3.6, rep: 7, short: "Degrade", title: "Region degrades" },
  { start: FAIL_OVER_START, rep: 8.6, short: "Fail over", title: "Fail over" },
  { start: 9.6, rep: 10.8, short: "One region", title: "One region serves" },
  { start: 11.3, rep: 14.5, short: "Recover", title: "Recovery" },
  { start: REBALANCE_START, rep: 17.2, short: "Rebalance", title: "Rebalance" },
];

const DEFAULT_TIME = STEPS[2].rep;
const SETTLED_HEALTHY = 7.8;
const SETTLED_SHIFT_END = 9.5;
const SETTLED_OUTAGE_END = 15.7;
const SETTLED_BACK_END = 18.5;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const ease = (value: number) => 0.5 - Math.cos(Math.PI * clamp(value, 0, 1)) / 2;
const glide = (value: number) => 0.45 * clamp(value, 0, 1) + 0.55 * ease(value);
const pulse = (value: number, span = 0.5) => (value < 0 || value > span ? 0 : (1 - value / span) ** 2);
const wrap = (value: number) => ((value % CYCLE) + CYCLE) % CYCLE;
const fraction = (value: number) => value - Math.floor(value);
const n2 = (value: number) => value.toFixed(2);
const formatCount = (value: number) => (value >= 1e3 ? `${(value / 1e3).toFixed(1)}k` : `${Math.round(value)}`);
const formatPair = (left: string, right: string) =>
  `${left.replace(/ /g, "\u00a0")} \u00b7 ${right.replace(/ /g, "\u00a0")}`;

/** Share of traffic the primary region keeps at clock time `time`. */
function primaryShare(time: number) {
  if (time < SETTLED_HEALTHY) return 0.5;
  if (time < SETTLED_SHIFT_END) return 0.5 * (1 - ease((time - SETTLED_HEALTHY) / 1.7000000000000002));
  if (time < SETTLED_OUTAGE_END) return 0;
  if (time < SETTLED_BACK_END) return 0.5 * ease((time - SETTLED_OUTAGE_END) / 2.8000000000000007);
  return 0.5;
}

/** Whether cube `index` is down at clock time `time`. */
const isDown = (index: number, time: number) => time >= 3.7 + 0.12 * index && time < 11.4 + 0.12 * index;

const noopSubscribe = () => () => {};

interface Point {
  x: number;
  y: number;
}

interface NodeFrame {
  cx: number;
  cy: number;
  a: number;
  h: number;
  port: Point;
  floor: number;
}

interface CubeFrame {
  i: number;
  x: number;
  y: number;
  a: number;
  h: number;
}

interface Curve {
  d: string;
  floorD: string;
  len: number;
  lift: number;
  xs: Float32Array;
  ys: Float32Array;
  fx: Float32Array;
  fy: Float32Array;
  acc: Float32Array;
}

interface Layout {
  w: number;
  h: number;
  wide: boolean;
  nodes: Record<FailoverNodeKey, NodeFrame>;
  cubes: Record<FailoverRegionKey, CubeFrame[]>;
  trunk: Curve;
  route: Record<FailoverRegionKey, Curve>;
  lanes: Record<FailoverRegionKey, Curve[]>;
  labels: Record<FailoverNodeKey, { x: number; y: number; above: boolean }>;
}

const platformPoints = (cx: number, cy: number, a: number, height: number) => {
  const half = a / 2;
  const join = (points: [number, number][]) => points.map(([x, y]) => `${n2(x)},${n2(y)}`).join(" ");
  return {
    top: join([
      [cx, cy - half],
      [cx + a, cy],
      [cx, cy + half],
      [cx - a, cy],
    ]),
    left: join([
      [cx - a, cy],
      [cx, cy + half],
      [cx, cy + half + height],
      [cx - a, cy + height],
    ]),
    right: join([
      [cx, cy + half],
      [cx + a, cy],
      [cx + a, cy + height],
      [cx, cy + half + height],
    ]),
    outline: join([
      [cx, cy - half],
      [cx + a, cy],
      [cx + a, cy + height],
      [cx, cy + half + height],
      [cx - a, cy + height],
      [cx - a, cy],
    ]),
  };
};

const cubePoint = (cx: number, cy: number, a: number, u: number, v: number) => ({
  x: cx + (u - v) * a,
  y: cy - a / 2 + (a / 2) * (u + v),
});

const ringPath = (cx: number, cy: number, radius: number) => {
  const half = radius / 2;
  return `M${n2(cx)} ${n2(cy - half)} A${n2(radius)} ${n2(half)} 0 0 1 ${n2(cx)} ${n2(cy + half)} A${n2(radius)} ${n2(half)} 0 0 1 ${n2(cx)} ${n2(cy - half)}`;
};

/** Quadratic arc from `from` to `to`, plus the matching floor line and an arc length table. */
function buildCurve(from: Point, to: Point, floorFrom: Point, floorTo: Point, bend: Point, lift = 0): Curve {
  const control = { x: (from.x + to.x) / 2 + bend.x, y: (from.y + to.y) / 2 + bend.y };
  const xs = new Float32Array(49);
  const ys = new Float32Array(49);
  const fx = new Float32Array(49);
  const fy = new Float32Array(49);
  const acc = new Float32Array(49);
  let depth = 1;
  for (let index = 0; index < 49; index += 1) {
    const t = index / 48;
    const mt = 1 - t;
    xs[index] = mt * mt * from.x + 2 * mt * t * control.x + t * t * to.x;
    ys[index] = mt * mt * from.y + 2 * mt * t * control.y + t * t * to.y;
    fx[index] = lift ? xs[index] : floorFrom.x + (floorTo.x - floorFrom.x) * t;
    fy[index] = lift ? ys[index] + lift : floorFrom.y + (floorTo.y - floorFrom.y) * t;
    depth = Math.max(depth, fy[index] - ys[index]);
    acc[index] = index ? acc[index - 1] + Math.hypot(xs[index] - xs[index - 1], ys[index] - ys[index - 1]) : 0;
  }
  return {
    d: `M${n2(from.x)} ${n2(from.y)} Q${n2(control.x)} ${n2(control.y)} ${n2(to.x)} ${n2(to.y)}`,
    floorD: `M${n2(floorFrom.x)} ${n2(floorFrom.y)} L${n2(floorTo.x)} ${n2(floorTo.y)}`,
    len: acc[48] || 1,
    lift: depth,
    xs,
    ys,
    fx,
    fy,
    acc,
  };
}

/** Point at arc length `distance` along a curve, in both stage and floor projection. */
function sample(curve: Curve, distance: number) {
  const { acc } = curve;
  const target = clamp(distance, 0, curve.len);
  let low = 0;
  let high = acc.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (acc[middle] < target) low = middle;
    else high = middle;
  }
  const ratio = (target - acc[low]) / (acc[high] - acc[low] || 1);
  const between = (values: Float32Array) => values[low] + (values[high] - values[low]) * ratio;
  return { x: between(curve.xs), y: between(curve.ys), fx: between(curve.fx), fy: between(curve.fy) };
}

/** Shift a route sideways so it lands on one cube instead of the platform centre. */
function offsetCurve(curve: Curve, dx: number, dy: number, floorDy: number): Curve {
  const count = curve.xs.length;
  const xs = new Float32Array(count);
  const ys = new Float32Array(count);
  const fx = new Float32Array(count);
  const fy = new Float32Array(count);
  const acc = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const weight = ease((index / (count - 1) - 0.6) / 0.4);
    xs[index] = curve.xs[index] + dx * weight;
    ys[index] = curve.ys[index] + dy * weight;
    fx[index] = curve.fx[index] + dx * weight;
    fy[index] = curve.fy[index] + floorDy * weight;
    acc[index] = index ? acc[index - 1] + Math.hypot(xs[index] - xs[index - 1], ys[index] - ys[index - 1]) : 0;
  }
  return { ...curve, xs, ys, fx, fy, acc, len: acc[count - 1] || 1 };
}

function buildLayout(wide: boolean): Layout {
  const frames: Record<FailoverNodeKey, [number, number, number, number]> = wide
    ? {
        users: [150, 300, 62, 14],
        balancer: [440, 300, 72, 16],
        primary: [790, 206, 118, 12],
        secondary: [790, 426, 118, 12],
      }
    : {
        users: [195, 150, 50, 12],
        balancer: [195, 330, 60, 14],
        primary: [100, 580, 80, 10],
        secondary: [290, 580, 80, 10],
      };

  const nodes = {} as Record<FailoverNodeKey, NodeFrame>;
  for (const key of NODE_KEYS) {
    const [cx, cy, a, h] = frames[key];
    nodes[key] = {
      cx,
      cy,
      a,
      h,
      port: { x: cx, y: cy - 12 * (key === "balancer" ? 1 : 0) },
      floor: cy + h,
    };
  }

  const cubes = {} as Record<FailoverRegionKey, CubeFrame[]>;
  for (const key of REGION_KEYS) {
    const node = nodes[key];
    const a = 0.135 * node.a;
    const h = 0.95 * a;
    cubes[key] = CUBE_SLOTS.map(([u, v], index) => {
      const point = cubePoint(node.cx, node.cy, node.a, u, v);
      return { i: index, x: point.x, y: point.y - h, a, h };
    });
  }

  const floorPoint = (node: NodeFrame) => ({ x: node.cx, y: node.floor + (node.a / 2) * 0.2 });
  const balancer = nodes.balancer;
  const users = nodes.users;
  const lift = 16 * (wide ? 0 : 1);
  const trunk = buildCurve(
    users.port,
    balancer.port,
    floorPoint(users),
    floorPoint(balancer),
    wide ? { x: 0, y: -96 } : { x: -92, y: 0 },
    lift,
  );
  const bends: Record<FailoverRegionKey, Point> = wide
    ? { primary: { x: -20, y: -92 }, secondary: { x: -10, y: -64 } }
    : { primary: { x: -130, y: -10 }, secondary: { x: 130, y: -10 } };

  const route = {} as Record<FailoverRegionKey, Curve>;
  const lanes = {} as Record<FailoverRegionKey, Curve[]>;
  for (const key of REGION_KEYS) {
    const node = nodes[key];
    route[key] = buildCurve(balancer.port, node.port, floorPoint(balancer), floorPoint(node), bends[key], lift);
    lanes[key] = cubes[key].map((cube) =>
      offsetCurve(route[key], cube.x - node.port.x, cube.y - node.port.y, cube.y + cube.h - node.port.y),
    );
  }

  const below = (node: NodeFrame, extra = 0) => node.floor + node.a / 2 + 12 + extra;
  const above = (node: NodeFrame, extra = 0) => node.cy - node.a / 2 - 12 - extra;

  const labels = wide
    ? {
        users: { x: users.cx, y: below(users), above: false },
        balancer: { x: balancer.cx, y: below(balancer), above: false },
        primary: { x: nodes.primary.cx, y: above(nodes.primary, 12), above: true },
        secondary: { x: nodes.secondary.cx, y: below(nodes.secondary), above: false },
      }
    : {
        users: { x: users.cx, y: above(users), above: true },
        balancer: { x: balancer.cx, y: below(balancer), above: false },
        primary: { x: nodes.primary.cx, y: below(nodes.primary), above: false },
        secondary: { x: nodes.secondary.cx, y: below(nodes.secondary), above: false },
      };

  return { w: wide ? 1000 : 390, h: wide ? 600 : 750, wide, nodes, cubes, trunk, route, lanes, labels };
}

interface Clock {
  t: number;
  rate: number;
  rateV: number;
  frame: number;
  running: boolean;
  visible: boolean;
  cache: Map<Element, Record<string, string>>;
}

interface Parts {
  node: Partial<Record<FailoverNodeKey, SVGGElement | null>>;
  cube: Record<FailoverRegionKey, (SVGGElement | null)[]>;
  device: (SVGCircleElement | null)[];
  dialA: SVGPathElement | null;
  dialB: SVGPathElement | null;
  route: Partial<Record<FailoverRegionKey, SVGPathElement | null>>;
  trunk: SVGPathElement | null;
  packet: (SVGCircleElement | null)[];
  shadow: (SVGEllipseElement | null)[];
  probe: SVGCircleElement | null;
  status: Partial<Record<FailoverNodeKey, HTMLElement | null>>;
  statusText: Partial<Record<FailoverNodeKey, HTMLElement | null>>;
  metric: Partial<Record<FailoverRegionKey, HTMLElement | null>>;
  barA: HTMLElement | null;
  barB: HTMLElement | null;
  pctA: HTMLElement | null;
  pctB: HTMLElement | null;
  fill: (HTMLElement | null)[];
  seg: (HTMLButtonElement | null)[];
  caption: HTMLElement | null;
  capTitle: HTMLElement | null;
  capText: HTMLElement | null;
  msg: HTMLElement | null;
  msgText: HTMLElement | null;
}

function NodeMark({ node, className }: { node: FailoverNodeOverride; className: string }) {
  const { icon, color } = node;
  if (icon === null || icon === undefined) return null;
  if (typeof icon === "string") {
    if (/^(\/|\.|https?:|data:|blob:)/.test(icon)) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img className={className} src={icon} alt="" draggable={false} />;
    }
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <path d={icon} fill={color ?? "currentColor"} />
      </svg>
    );
  }
  return (
    <span className={className} aria-hidden="true">
      {icon}
    </span>
  );
}

export function MultiRegionFailover({
  hostname = "api.acme.dev",
  requestsPerSecond = 12_000,
  latencyMs = 38,
  nodes,
  speed = 1,
  paused = false,
  accent,
  controls = true,
  caption = true,
  label,
  className,
  style,
}: MultiRegionFailoverProps) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const reduced = Boolean(useReducedMotion()) && mounted;

  const stageRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [hovered, setHovered] = useState<FailoverNodeKey | null>(null);
  const [pausedState, setPausedState] = useState(false);

  const copy = useMemo(() => {
    const overrides = nodes ?? {};
    return {
      users: { label: "Users", meta: "Worldwide", detail: "Every request goes to one hostname", ...overrides.users },
      balancer: {
        label: "Load balancer",
        meta: hostname,
        detail: "Checks each region and sets its share of traffic",
        ...overrides.balancer,
      },
      primary: { label: "US East", meta: "us-east-1", detail: "Six instances in Virginia", ...overrides.primary },
      secondary: {
        label: "EU West",
        meta: "eu-west-1",
        detail: "Six instances in Ireland, ready to take it all",
        ...overrides.secondary,
      },
    } as Record<FailoverNodeKey, FailoverNodeOverride>;
  }, [nodes, hostname]);

  const primaryName = copy.primary.label ?? "US East";
  const secondaryName = copy.secondary.label ?? "EU West";

  const text = useMemo(
    () => ({
      a: primaryName,
      b: secondaryName,
      captions: [
        `The load balancer splits traffic evenly between ${primaryName} and ${secondaryName}, and both regions pass their health checks.`,
        `Instances in ${primaryName} start failing. Requests sent there return errors and its health checks fail one after another.`,
        `After 3 failed checks ${primaryName} is marked unhealthy and its share of traffic shifts smoothly to ${secondaryName}.`,
        `${secondaryName} serves every request and errors fall back to zero while ${primaryName} is out of rotation.`,
        `${primaryName} comes back, but it has to pass 3 health checks in a row before it gets traffic again.`,
        `Traffic ramps back to ${primaryName} gradually, so its warm up stays smooth, until the split is even again.`,
      ],
    }),
    [primaryName, secondaryName],
  );

  const wide = width >= 640;
  const measured = width > 0;
  const layout = useMemo(() => (measured ? buildLayout(wide) : null), [measured, wide]);

  const parts = useRef<Parts>({
    node: {},
    cube: { primary: [], secondary: [] },
    device: [],
    dialA: null,
    dialB: null,
    route: {},
    trunk: null,
    packet: [],
    shadow: [],
    probe: null,
    status: {},
    statusText: {},
    metric: {},
    barA: null,
    barB: null,
    pctA: null,
    pctB: null,
    fill: [],
    seg: [],
    caption: null,
    capTitle: null,
    capText: null,
    msg: null,
    msgText: null,
  });

  const clock = useRef<Clock>({
    t: paused || speed === 0 ? DEFAULT_TIME : 0,
    rate: Number.NaN,
    rateV: 0,
    frame: 0,
    running: false,
    visible: true,
    cache: new Map(),
  });

  const [settledStep, setSettledStep] = useState(2);
  const target = paused || pausedState ? 0 : speed * (hovered ? 0.7 : 1);
  const scale = layout ? width / layout.w : 1;

  const state = useRef({
    layout,
    text,
    target,
    reduced,
    requestsPerSecond,
    latencyMs,
    scale,
  });

  useLayoutEffect(() => {
    state.current = { layout, text, target, reduced, requestsPerSecond, latencyMs, scale };
  });

  /** Write one attribute, one CSS custom property or one text node, only when it changed. */
  const set = useCallback((element: Element | null | undefined, key: string, value: string) => {
    if (!element) return;
    const store = clock.current.cache;
    let entry = store.get(element);
    if (!entry) {
      entry = {};
      store.set(element, entry);
    }
    if (entry[key] === value) return;
    entry[key] = value;
    if (key === "text") {
      const child = element.firstChild;
      if (child && child.nodeType === 3 && !child.nextSibling) {
        (child as CharacterData).data = value;
      } else {
        element.textContent = value;
      }
      return;
    }
    if (key.startsWith("--")) {
      (element as HTMLElement | SVGElement).style.setProperty(key, value);
      return;
    }
    if (key.startsWith("s:")) {
      (element as HTMLElement | SVGElement).style.setProperty(key.slice(2), value);
      return;
    }
    element.setAttribute(key, value);
  }, []);

  const draw = useCallback(
    (time: number) => {
      const {
        layout: frame,
        text: words,
        requestsPerSecond: rps,
        latencyMs: latency,
        scale: zoom,
        reduced: still,
      } = state.current;
      const refs = parts.current;
      const t = wrap(time);

      const share = primaryShare(t);
      const downCount = (() => {
        let count = 0;
        for (let index = 0; index < CUBE_COUNT; index += 1) if (isDown(index, t)) count += 1;
        return count;
      })();
      const checks = (() => {
        let failed = 0;
        let passed = 0;
        for (let index = 0; index < 3; index += 1) if (t >= recoverStart(index)) failed += 1;
        for (let index = 6; index < 9; index += 1) if (t >= recoverStart(index)) passed += 1;
        return { failed, passed };
      })();

      let current = 0;
      STEPS.forEach((step, index) => {
        if (t >= step.start) current = index;
      });

      const fade = t > 20.6 ? 1 - ease((t - 20.6) / 0.4) : 1;

      STEPS.forEach((step, index) => {
        const end = STEPS[index + 1]?.start ?? CYCLE;
        const fill = still ? (index <= current ? 1 : 0) : clamp((t - step.start) / (end - step.start), 0, 1);
        set(refs.fill[index], "s:transform", `scaleX(${fill.toFixed(4)})`);
        set(refs.fill[index], "s:opacity", fade.toFixed(3));
        set(refs.seg[index], "data-current", index === current ? "true" : "false");
        set(refs.seg[index], "aria-current", index === current ? "step" : "false");
      });

      set(refs.capTitle, "text", STEPS[current].title);
      set(refs.capText, "text", words.captions[current]);

      const stepStart = STEPS[current].start;
      const stepEnd = STEPS[current + 1]?.start ?? CYCLE;
      const captionOpacity = still
        ? 1
        : Math.min(t < 0.3 ? 1 : ease((t - stepStart) / 0.3), ease((stepEnd - t) / 0.15));
      set(refs.caption, "s:opacity", captionOpacity.toFixed(3));

      const liveRps = rps * (1 + 0.02 * Math.sin((2 * Math.PI * t) / 10.5));
      const errorRate = (downCount / CUBE_COUNT) * share * 100;
      const weights = { primary: share, secondary: 1 - share };

      set(refs.barA, "s:transform", `scaleX(${weights.primary.toFixed(4)})`);
      set(refs.barB, "s:transform", `scaleX(${weights.secondary.toFixed(4)})`);
      set(refs.pctA, "text", `${Math.round(100 * weights.primary)}%`);
      set(refs.pctB, "text", `${Math.round(100 * weights.secondary)}%`);
      set(refs.dialA, "stroke-dasharray", `${(1e3 * weights.primary).toFixed(1)} 1000`);
      set(refs.dialA, "opacity", weights.primary < 0.002 ? "0" : "1");
      set(refs.dialB, "stroke-dasharray", `${(1e3 * weights.secondary).toFixed(1)} 1000`);
      set(refs.dialB, "stroke-dashoffset", `${(-(1e3 * weights.primary)).toFixed(1)}`);
      set(refs.route.primary, "--lit", Math.min(1, 2 * weights.primary).toFixed(3));
      set(refs.route.primary, "--err", (2 * weights.primary * (downCount / CUBE_COUNT)).toFixed(3));
      set(refs.route.secondary, "--lit", Math.min(1, 2 * weights.secondary).toFixed(3));

      if (!frame) return;

      const hits: Record<FailoverRegionKey, number[]> = {
        primary: new Array(CUBE_COUNT).fill(0),
        secondary: new Array(CUBE_COUNT).fill(0),
      };
      const devices = [0, 0, 0, 0];
      const used = new Array(12).fill(false);
      const first = Math.ceil((t - 2.1 - 0.6) / 0.25);
      const last = Math.floor(t / 0.25);

      for (let index = first; index <= last; index += 1) {
        const spawn = 0.25 * index;
        const age = t - spawn;
        const seq = ((index % POOL) + POOL) % POOL;
        const routedAt = wrap(spawn + 1);
        const region: FailoverRegionKey =
          fraction(0.6180339887 * seq + 0.31) < primaryShare(routedAt) ? "primary" : "secondary";
        const slot = Math.floor(fraction(0.7548776662 * seq + 0.4) * CUBE_COUNT);
        const arriveAt = wrap(spawn + 2.1);
        const dead = region === "primary" && isDown(slot, arriveAt);

        const device = ((seq % 4) + 4) % 4;
        devices[device] = Math.max(devices[device], pulse(age, 0.45));

        if (age > 2.1) {
          if (!dead) hits[region][slot] = Math.max(hits[region][slot], pulse(age - 2.1, 0.55));
          continue;
        }
        if (age < 0) continue;

        const pool = ((index % 12) + 12) % 12;
        used[pool] = true;
        const dot = refs.packet[pool];
        const shadow = refs.shadow[pool];
        let point: { x: number; y: number; fx: number; fy: number };
        let lift: number;
        let alpha = 1;
        let dotScale = 1;
        let kind = "request";

        if (age < 1) {
          const progress = age / 1;
          point = sample(frame.trunk, glide(progress) * frame.trunk.len);
          lift = frame.trunk.lift;
          alpha = ease(progress / 0.14);
        } else {
          const progress = (age - 1) / 1.1;
          const lane = frame.lanes[region][slot];
          if (dead) {
            point = sample(lane, glide(Math.min(progress, 0.86)) * lane.len);
            if (progress > 0.62) kind = "error";
            alpha = 1 - ease((progress - 0.86) / 0.14);
            dotScale = 1 + 0.35 * ease((progress - 0.86) / 0.14);
          } else {
            point = sample(lane, glide(progress) * lane.len);
            const fadeOut = ease((progress - 0.82) / 0.18);
            alpha = 1 - fadeOut;
            dotScale = 1 - 0.5 * fadeOut;
          }
          lift = lane.lift;
        }

        const height = clamp((point.fy - point.y) / lift, 0, 1);
        set(dot, "transform", `translate(${n2(point.x)} ${n2(point.y)}) scale(${dotScale.toFixed(3)})`);
        set(dot, "opacity", alpha.toFixed(3));
        set(dot, "data-kind", kind);
        set(
          shadow,
          "transform",
          `translate(${n2(point.fx)} ${n2(point.fy)}) scale(${(1 - 0.45 * height).toFixed(3)})`,
        );
        set(shadow, "opacity", ((0.9 - 0.5 * height) * alpha).toFixed(3));
      }

      for (let index = 0; index < 12; index += 1) {
        if (used[index]) continue;
        set(refs.packet[index], "opacity", "0");
        set(refs.shadow[index], "opacity", "0");
      }

      refs.device.forEach((element, index) => set(element, "fill-opacity", devices[index].toFixed(3)));

      for (const region of REGION_KEYS) {
        const load = region === "secondary" ? clamp((weights.secondary - 0.5) * 2, 0, 1) : 0;
        frame.cubes[region].forEach((cube, index) => {
          const element = refs.cube[region][index];
          set(element, "--hit", hits[region][index].toFixed(3));
          set(element, "--load", load.toFixed(3));
          set(element, "data-state", region === "primary" && isDown(index, t) ? "down" : "up");
          void cube;
        });
      }

      let probing = false;
      for (let index = 0; index < 9; index += 1) {
        const age = t - failStart(index);
        if (age < 0 || age > 1.2) continue;
        probing = true;
        const returning = age > 0.6;
        const progress = returning ? (age - 0.6) / 0.6 : age / 0.6;
        const curve = frame.route.primary;
        const distance = glide(progress) * curve.len;
        const point = sample(curve, returning ? curve.len - distance : distance);
        const healthy = index >= 6;
        const tagOpacity = Math.min(ease(progress / 0.2), ease((1 - progress) / 0.2));
        const dotOpacity = returning ? ease((1 - progress) / 0.2) : ease(progress / 0.2);

        set(refs.probe, "transform", `translate(${n2(point.x)} ${n2(point.y)})`);
        set(refs.probe, "opacity", dotOpacity.toFixed(3));
        set(refs.probe, "data-result", returning ? (healthy ? "pass" : "fail") : "out");
        set(
          refs.msg,
          "s:transform",
          `translate3d(${(point.x * zoom).toFixed(1)}px, ${(point.y * zoom - 10).toFixed(1)}px, 0) translate(-50%, -100%)`,
        );
        set(refs.msg, "s:opacity", tagOpacity.toFixed(3));
        set(refs.msg, "data-kind", returning ? (healthy ? "pass" : "fail") : "out");
        set(refs.msgText, "text", returning ? (healthy ? "200 OK" : "503") : "GET /healthz");
      }

      if (!probing) {
        set(refs.probe, "opacity", "0");
        set(refs.msg, "s:opacity", "0");
      }

      const status = (key: FailoverNodeKey, stateName: string, value: string) => {
        set(refs.status[key], "data-state", stateName);
        set(refs.statusText[key], "text", value);
      };

      status("users", "busy", `${formatCount(liveRps)} req/s`);
      if (errorRate < 0.05) status("balancer", "done", "No errors");
      else status("balancer", "error", `Errors ${errorRate.toFixed(1)}%`);

      if (t < 3.7) status("primary", "done", "Healthy");
      else if (t < FAIL_OVER_START) {
        status("primary", "warn", checks.failed === 0 ? "Degraded" : `Failed checks ${checks.failed}/3`);
      } else if (t < SETTLED_SHIFT_END) status("primary", "error", "Unhealthy, draining");
      else if (t < OUT_OF_ROTATION_END) status("primary", "error", "Out of rotation");
      else if (t < REBALANCE_START) {
        status("primary", "busy", checks.passed === 0 ? "Recovering" : `Passed checks ${checks.passed}/3`);
      } else if (t < SETTLED_BACK_END) {
        status("primary", "busy", `Warming up ${Math.round((share / 0.5) * 100)}%`);
      } else status("primary", "done", "Healthy");

      status(
        "secondary",
        "done",
        weights.secondary > 0.505 ? `Serving ${Math.round(100 * weights.secondary)}%` : "Healthy",
      );

      const primaryRps = liveRps * weights.primary;
      const failedRps = primaryRps * (1 - downCount / CUBE_COUNT);
      set(
        refs.metric.primary,
        "text",
        primaryRps < 5
          ? "0 req/s, no traffic"
          : downCount > 0
            ? formatPair(`${formatCount(primaryRps)} req/s`, `${Math.round((1 - failedRps / primaryRps) * 100)}% errors`)
            : formatPair(`${formatCount(primaryRps)} req/s`, `p50 ${latency} ms`),
      );

      const secondaryLatency = Math.round(
        latency + 4 + 11 * clamp((weights.secondary - 0.5) * 2, 0, 1),
      );
      set(
        refs.metric.secondary,
        "text",
        formatPair(`${formatCount(liveRps * weights.secondary)} req/s`, `p50 ${secondaryLatency} ms`),
      );
    },
    [set],
  );

  const start = useCallback(() => {
    const state_ = clock.current;
    if (state_.running || !state_.visible || state.current.reduced) return;
    state_.running = true;
    let previous = performance.now();
    const tick = (now: number) => {
      if (!state_.visible || state.current.reduced) {
        state_.running = false;
        return;
      }
      const delta = clamp((now - previous) / 1000, 0, 0.05);
      previous = now;
      const goal = state.current.target;
      if (Number.isNaN(state_.rate)) state_.rate = goal;
      // Critically damped spring on the rate, so pause, speed changes and hover ease into place.
      state_.rateV += (40 * (goal - state_.rate) - 2 * Math.sqrt(40) * state_.rateV) * delta;
      state_.rate += state_.rateV * delta;
      if (Math.abs(goal - state_.rate) < 1e-4 && Math.abs(state_.rateV) < 1e-4) {
        state_.rate = goal;
        state_.rateV = 0;
      }
      state_.t += delta * state_.rate;
      draw(state_.t);
      if ((state_.rate === 0 && goal === 0) || !state_.visible || state.current.reduced) {
        state_.running = false;
        return;
      }
      state_.frame = requestAnimationFrame(tick);
    };
    state_.frame = requestAnimationFrame(tick);
  }, [draw]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => setWidth(Math.floor(stage.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    clock.current.cache = new Map();
    if (reduced) draw(STEPS[settledStep].rep);
    else {
      draw(clock.current.t);
      start();
    }
  }, [layout, scale, text, reduced, target, settledStep, requestsPerSecond, latencyMs, draw, start]);

  useEffect(() => {
    const stage = stageRef.current;
    const state_ = clock.current;
    if (!stage) return;
    let onScreen = true;
    const sync = () => {
      state_.visible = onScreen && !document.hidden;
      if (state_.visible) start();
      else {
        cancelAnimationFrame(state_.frame);
        state_.running = false;
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    observer.observe(stage);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      cancelAnimationFrame(state_.frame);
      state_.running = false;
    };
  }, [start]);

  const jump = useCallback(
    (index: number) => {
      const state_ = clock.current;
      if (state.current.reduced) {
        setSettledStep(index);
        return;
      }
      state_.t = state_.t - wrap(state_.t) + STEPS[index].start + 0.001 * (index !== 0 ? 1 : 0);
      draw(state_.t);
      start();
    },
    [draw, start],
  );

  const hoverHandlers = (key: FailoverNodeKey) => ({
    onPointerEnter: (event: ReactPointerEvent<Element>) => {
      if (event.pointerType === "mouse") setHovered(key);
    },
    onPointerLeave: () => setHovered((value) => (value === key ? null : value)),
  });

  const routeActive = (key: FailoverRegionKey) => hovered === "balancer" || hovered === key;
  const trunkActive = hovered === "balancer" || hovered === "users";
  const description =
    label ??
    `Multi-region failover for ${hostname}. A load balancer splits traffic between ${primaryName} and ${secondaryName}. When ${primaryName} starts failing, its health checks fail 3 times in a row, it is marked unhealthy and traffic shifts smoothly to ${secondaryName}, so errors fall back to zero. Once ${primaryName} recovers and passes 3 checks, traffic ramps back until the split is even again.`;

  const rootStyle = { ...style, ...(accent ? { "--mrf-accent": accent } : null) } as CSSProperties;
  const stopped = pausedState || paused || speed === 0;
  const percent = (value: number, total: number) => `${((value / total) * 100).toFixed(3)}%`;

  const faces = (points: ReturnType<typeof platformPoints>) => (
    <>
      <polygon className={styles.faceLeft} points={points.left} />
      <polygon className={styles.faceRight} points={points.right} />
      <polygon className={styles.faceTop} points={points.top} />
    </>
  );

  return (
    <figure
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={rootStyle}
      data-ready={layout ? true : undefined}
      data-layout={layout ? (layout.wide ? "wide" : "stack") : undefined}
    >
      <div
        ref={stageRef}
        className={styles.stage}
        role="img"
        aria-label={description}
        style={layout ? { aspectRatio: `${layout.w} / ${layout.h}` } : undefined}
      >
        {layout ? (
          <>
            <svg
              className={styles.svg}
              viewBox={`0 0 ${layout.w} ${layout.h}`}
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            >
              <g>
                <path
                  className={styles.floor}
                  d={layout.trunk.floorD}
                  data-dim={(hovered !== null && !trunkActive) || undefined}
                />
                {REGION_KEYS.map((key) => (
                  <path
                    key={key}
                    className={styles.floor}
                    d={layout.route[key].floorD}
                    data-dim={(hovered !== null && !routeActive(key)) || undefined}
                  />
                ))}
                {Array.from({ length: 12 }, (_, index) => (
                  <ellipse
                    key={index}
                    ref={(element) => {
                      parts.current.shadow[index] = element;
                    }}
                    className={styles.shadow}
                    cx={0}
                    cy={0}
                    rx={4.5}
                    ry={2.25}
                    opacity={0}
                  />
                ))}
              </g>
              <g className={styles.route} data-on={trunkActive || undefined} data-dim={(hovered !== null && !trunkActive) || undefined}>
                <path
                  ref={(element) => {
                    parts.current.trunk = element;
                  }}
                  className={styles.edge}
                  d={layout.trunk.d}
                  style={{ "--lit": 1 } as CSSProperties}
                />
              </g>
              {REGION_KEYS.map((key) => (
                <g
                  key={key}
                  className={styles.route}
                  data-on={routeActive(key) || undefined}
                  data-dim={(hovered !== null && !routeActive(key)) || undefined}
                >
                  <path
                    ref={(element) => {
                      parts.current.route[key] = element;
                    }}
                    className={styles.edge}
                    d={layout.route[key].d}
                  />
                </g>
              ))}
              {[...NODE_KEYS]
                .sort((a, b) => layout.nodes[a].cy - layout.nodes[b].cy)
                .map((key) => {
                  const node = layout.nodes[key];
                  const points = platformPoints(node.cx, node.cy, node.a, node.h);
                  let inner: ReactNode = null;

                  if (key === "users") {
                    inner = (
                      [
                        [0.3, 0.3],
                        [0.7, 0.3],
                        [0.3, 0.7],
                        [0.7, 0.7],
                      ] as [number, number][]
                    ).map(([u, v], index) => {
                      const point = cubePoint(node.cx, node.cy, node.a, u, v);
                      return (
                        <g key={index}>
                          <ellipse
                            className={styles.deviceBase}
                            cx={point.x}
                            cy={point.y}
                            rx={0.1 * node.a}
                            ry={0.05 * node.a}
                          />
                          <circle
                            ref={(element) => {
                              parts.current.device[index] = element;
                            }}
                            className={styles.device}
                            cx={point.x}
                            cy={point.y}
                            r={0.05 * node.a}
                            fillOpacity={0}
                          />
                        </g>
                      );
                    });
                  }

                  if (key === "balancer") {
                    const a = 0.6 * node.a;
                    const cy = node.cy - 12;
                    const radius = 0.62 * a;
                    inner = (
                      <>
                        {faces(platformPoints(node.cx, cy, a, 12))}
                        <path className={styles.dialTrack} d={ringPath(node.cx, cy, radius)} />
                        <path
                          ref={(element) => {
                            parts.current.dialB = element;
                          }}
                          className={styles.dialB}
                          d={ringPath(node.cx, cy, radius)}
                          pathLength={1000}
                          strokeDasharray="500 1000"
                          strokeDashoffset={-500}
                        />
                        <path
                          ref={(element) => {
                            parts.current.dialA = element;
                          }}
                          className={styles.dialA}
                          d={ringPath(node.cx, cy, radius)}
                          pathLength={1000}
                          strokeDasharray="500 1000"
                        />
                      </>
                    );
                  }

                  if (key === "primary" || key === "secondary") {
                    inner = [...layout.cubes[key]]
                      .sort((a, b) => a.y - b.y)
                      .map((cube) => (
                        <g
                          key={cube.i}
                          ref={(element) => {
                            parts.current.cube[key][cube.i] = element;
                          }}
                          className={styles.cube}
                          data-state="up"
                        >
                          {faces(platformPoints(cube.x, cube.y, cube.a, cube.h))}
                        </g>
                      ));
                  }

                  return (
                    <g
                      key={key}
                      ref={(element) => {
                        parts.current.node[key] = element;
                      }}
                      className={styles.node}
                      data-on={hovered === key || undefined}
                      data-dim={
                        (hovered !== null && hovered !== key && key !== "balancer" && hovered !== "balancer") || undefined
                      }
                      {...hoverHandlers(key)}
                    >
                      {faces(points)}
                      {inner}
                      <polygon className={styles.hit} points={points.outline} />
                    </g>
                  );
                })}
              <g className={styles.traffic} data-dim={hovered === "primary" || hovered === "secondary" || undefined}>
                {Array.from({ length: 12 }, (_, index) => (
                  <circle
                    key={index}
                    ref={(element) => {
                      parts.current.packet[index] = element;
                    }}
                    className={styles.packet}
                    cx={0}
                    cy={0}
                    r={4}
                    opacity={0}
                    data-kind="request"
                  />
                ))}
              </g>
              <circle
                ref={(element) => {
                  parts.current.probe = element;
                }}
                className={styles.probe}
                cx={0}
                cy={0}
                r={4.5}
                opacity={0}
                data-result="out"
              />
            </svg>

            {NODE_KEYS.map((key) => {
              const placement = layout.labels[key];
              const nodeCopy = copy[key];
              const isRegion = key === "primary" || key === "secondary";
              return (
                <div
                  key={key}
                  className={styles.label}
                  data-on={hovered === key || undefined}
                  data-above={placement.above || undefined}
                  data-kind={key}
                  style={{ left: percent(placement.x, layout.w), top: percent(placement.y, layout.h) }}
                  {...hoverHandlers(key)}
                >
                  <span className={styles.name}>
                    <NodeMark node={nodeCopy} className={styles.mark} />
                    {nodeCopy.label}
                  </span>
                  {nodeCopy.meta ? <span className={styles.meta}>{nodeCopy.meta}</span> : null}
                  <span
                    ref={(element) => {
                      parts.current.status[key] = element;
                    }}
                    className={styles.status}
                    data-state="done"
                  >
                    <span className={styles.dot} aria-hidden="true" />
                    <span
                      ref={(element) => {
                        parts.current.statusText[key] = element;
                      }}
                    >
                      {key === "users"
                        ? `${formatCount(requestsPerSecond)} req/s`
                        : key === "balancer"
                          ? "No errors"
                          : "Healthy"}
                    </span>
                  </span>
                  {isRegion ? (
                    <span
                      ref={(element) => {
                        parts.current.metric[key] = element;
                      }}
                      className={styles.metric}
                    >
                      {formatPair(
                        `${formatCount(requestsPerSecond / 2)} req/s`,
                        `p50 ${key === "primary" ? latencyMs : latencyMs + 4} ms`,
                      )}
                    </span>
                  ) : null}
                  {key === "balancer" ? (
                    <span className={styles.weights}>
                      <span className={styles.bar}>
                        <span
                          ref={(element) => {
                            parts.current.barA = element;
                          }}
                          className={styles.barA}
                        />
                        <span
                          ref={(element) => {
                            parts.current.barB = element;
                          }}
                          className={styles.barB}
                        />
                      </span>
                      <span className={styles.split}>
                        <span className={styles.splitSide}>
                          <span className={styles.splitName}>{primaryName}</span>
                          <span
                            ref={(element) => {
                              parts.current.pctA = element;
                            }}
                            className={styles.splitPct}
                          >
                            50%
                          </span>
                        </span>
                        <span className={styles.splitSide} data-end>
                          <span className={styles.splitName}>{secondaryName}</span>
                          <span
                            ref={(element) => {
                              parts.current.pctB = element;
                            }}
                            className={styles.splitPct}
                          >
                            50%
                          </span>
                        </span>
                      </span>
                    </span>
                  ) : null}
                </div>
              );
            })}

            {NODE_KEYS.map((key) => {
              const node = layout.nodes[key];
              const detail = copy[key].detail;
              if (!detail) return null;
              const offset =
                key === "balancer"
                  ? 12 + (0.6 * node.a) / 2
                  : key === "primary" || key === "secondary"
                    ? node.a / 2 + 0.14 * node.a
                    : node.a / 2;
              const below = layout.labels[key].above && layout.labels[key].y < node.cy;
              const top = below ? node.floor + node.a / 2 + 16 : node.cy - offset - 10;
              const ratio = node.cx / layout.w;
              return (
                <span
                  key={`tag-${key}`}
                  className={styles.tag}
                  data-show={hovered === key || undefined}
                  data-below={below || undefined}
                  data-align={ratio > 0.7 ? "end" : ratio < 0.3 ? "start" : "center"}
                  style={{ left: percent(node.cx, layout.w), top: percent(top, layout.h) }}
                  aria-hidden="true"
                >
                  {detail}
                </span>
              );
            })}

            <span
              ref={(element) => {
                parts.current.msg = element;
              }}
              className={styles.msg}
              style={{ opacity: 0 }}
              aria-hidden="true"
            >
              <span
                ref={(element) => {
                  parts.current.msgText = element;
                }}
              >
                GET /healthz
              </span>
            </span>
          </>
        ) : null}
      </div>

      {controls ? (
        <div className={styles.controls}>
          {!reduced ? (
            <button
              type="button"
              className={styles.toggle}
              aria-label={stopped ? "Play" : "Pause"}
              aria-pressed={pausedState}
              disabled={paused || speed === 0}
              onClick={() => setPausedState((value) => !value)}
            >
              {stopped ? <Play size={16} strokeWidth={1.75} aria-hidden="true" /> : <Pause size={16} strokeWidth={1.75} aria-hidden="true" />}
            </button>
          ) : null}
          <div className={styles.segments} role="group" aria-label="Failover steps">
            {STEPS.map((step, index) => (
              <button
                key={step.short}
                ref={(element) => {
                  parts.current.seg[index] = element;
                }}
                type="button"
                className={styles.seg}
                aria-label={`Step ${index + 1} of ${STEPS.length}: ${step.title}`}
                onClick={() => jump(index)}
                onKeyDown={(event) => {
                  const next =
                    event.key === "ArrowRight"
                      ? index + 1
                      : event.key === "ArrowLeft"
                        ? index - 1
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? STEPS.length - 1
                            : -1;
                  if (next < 0 || next >= STEPS.length) return;
                  event.preventDefault();
                  parts.current.seg[next]?.focus();
                  jump(next);
                }}
              >
                <span className={styles.track}>
                  <span
                    ref={(element) => {
                      parts.current.fill[index] = element;
                    }}
                    className={styles.fill}
                  />
                </span>
                <span className={styles.segLabel}>{step.short}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {caption ? (
        <figcaption
          ref={(element) => {
            parts.current.caption = element;
          }}
          className={styles.caption}
          aria-hidden="true"
        >
          <span
            ref={(element) => {
              parts.current.capTitle = element;
            }}
            className={styles.capTitle}
          >
            {STEPS[0].title}
          </span>
          <span
            ref={(element) => {
              parts.current.capText = element;
            }}
            className={styles.capText}
          >
            {text.captions[0]}
          </span>
        </figcaption>
      ) : null}
    </figure>
  );
}

export default MultiRegionFailover;
