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
import { Pause, Play } from "lucide-react";
import { useReducedMotion } from "motion/react";
import styles from "./dns-resolution.module.css";

export type DnsNodeKey = "browser" | "resolver" | "root" | "tld" | "authoritative";

export type DnsNodeOverride = {
  /** Name shown under the node. */
  label?: string;
  /** Second line: the host or the registry. The nameserver meta is also the host the TLD refers to. */
  meta?: string;
  /** Sentence shown in the hover tag above the node. */
  detail?: string;
  /** Simple Icons path data, an image URL or a ReactNode drawn before the label. */
  icon?: string | ReactNode;
  /** Fill for a path icon. */
  color?: string;
};

export type DnsResolutionProps = {
  /** The name being looked up. The TLD server (.dev) and the default nameserver (ns1.acme.dev) are derived from it. */
  domain?: string;
  /** The address the nameserver answers with, shown on the answer packets, the nameserver status and the cached record. */
  address?: string;
  /** Time to live of the answer in seconds. The cached record counts it down while the ring drains, then shows Expired. */
  ttl?: number;
  /** Milliseconds the full lookup takes, counted up in the browser status. */
  lookupMs?: number;
  /** Milliseconds the cached lookup takes. */
  cachedMs?: number;
  /** Overrides per node: the name, a meta line, the hover detail and an optional mark. */
  nodes?: Partial<Record<DnsNodeKey, DnsNodeOverride>>;
  /** Multiplies the pace. One lookup and cache cycle takes 16 seconds at 1. 0 holds still. */
  speed?: number;
  /** Holds the animation, easing to rest. Paused from the start, it shows the cached state with every hop answered. */
  paused?: boolean;
  /** Any CSS color for the moving query, lit routes, the TTL ring and the scrubber. Defaults to the theme accent. */
  accent?: string;
  /** Shows the step scrubber with a pause button. */
  controls?: boolean;
  /** Shows the current stage title and one line that narrates it under the scrubber. */
  caption?: boolean;
  /** Accessible description. Defaults to a sentence built from the domain, the servers, the address and the TTL. */
  label?: string;
  /** Class on the root figure. */
  className?: string;
  /** Inline styles on the root figure. */
  style?: CSSProperties;
};

type NodeKey = DnsNodeKey;
type EdgeKey = "ask" | "root" | "tld" | "authoritative";
type ServerKey = "root" | "tld" | "authoritative";
type TripKind = "query" | "referral" | "answer";

const NODE_ORDER: NodeKey[] = ["browser", "resolver", "root", "tld", "authoritative"];
const EDGE_ORDER: EdgeKey[] = ["ask", "root", "tld", "authoritative"];
const SERVER_KEYS: ServerKey[] = ["root", "tld", "authoritative"];

/** The node a route arrives at, or the resolver for the browser ↔ resolver hop. */
const EDGE_TARGET: Record<EdgeKey, NodeKey> = {
  ask: "resolver",
  root: "root",
  tld: "tld",
  authoritative: "authoritative",
};

const T = {
  ask: 0.5,
  askTrip: 0.95,
  check: 1.45,
  root: 2.05,
  tld: 4.25,
  authoritative: 6.45,
  out: 0.9,
  think: 0.3,
  store: 8.55,
  fill: 0.5,
  answer: 8.8,
  answerTrip: 0.95,
  page: 9.9,
  again: 11.6,
  hop: 0.6,
  hit: 12.2,
  back: 12.3,
  expire: 15,
  fade: 15.35,
  cycle: 16,
} as const;

const arrival = (key: ServerKey) => T[key] + T.out;
const settled = (key: ServerKey) => arrival(key) + T.think;
const connectedAt = T.answer + T.answerTrip;
const filledAt = T.store + T.fill;
const cachedAt = T.back + T.hop;

type Trip = {
  edge: EdgeKey;
  t0: number;
  d: number;
  back: boolean;
  kind: TripKind;
};

const TRIPS: Trip[] = [
  { edge: "ask", t0: T.ask, d: T.askTrip, back: false, kind: "query" },
  { edge: "root", t0: T.root, d: T.out, back: false, kind: "query" },
  { edge: "root", t0: settled("root"), d: T.out, back: true, kind: "referral" },
  { edge: "tld", t0: T.tld, d: T.out, back: false, kind: "query" },
  { edge: "tld", t0: settled("tld"), d: T.out, back: true, kind: "referral" },
  { edge: "authoritative", t0: T.authoritative, d: T.out, back: false, kind: "query" },
  { edge: "authoritative", t0: settled("authoritative"), d: T.out, back: true, kind: "answer" },
  { edge: "ask", t0: T.answer, d: T.answerTrip, back: true, kind: "answer" },
  { edge: "ask", t0: T.again, d: T.hop, back: false, kind: "query" },
  { edge: "ask", t0: T.back, d: T.hop, back: true, kind: "answer" },
];

type Step = { start: number; rep: number; short: string; title: string };

const STEPS: Step[] = [
  { start: 0, rep: T.root - 0.1, short: "Ask", title: "Ask the resolver" },
  { start: T.root - 0.05, rep: T.tld - 0.1, short: "Root", title: "Root server" },
  { start: T.tld - 0.05, rep: T.authoritative - 0.1, short: "TLD", title: "TLD server" },
  { start: T.authoritative - 0.05, rep: T.store - 0.02, short: "Nameserver", title: "Authoritative nameserver" },
  { start: T.store, rep: T.page + 1, short: "Answer", title: "Answer and connect" },
  { start: T.again - 0.5, rep: T.back + T.hop + 0.6, short: "Cache", title: "Answered from cache" },
];

const STATUS_OPACITY = STEPS[5].rep;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const sineEase = (value: number) => 0.5 - Math.cos(Math.PI * clamp(value, 0, 1)) / 2;
const cubicEase = (value: number) => 1 - (1 - clamp(value, 0, 1)) ** 3;
/** Fades in over `rise`, holds until `end`, fades out over `fall`. */
const window4 = (time: number, start: number, end: number, rise: number, fall: number) =>
  time < start || time > end + fall
    ? 0
    : time < start + rise
      ? sineEase((time - start) / rise)
      : time <= end
        ? 1
        : 1 - sineEase((time - end) / fall);

const pulse = (value: number, span = 0.7) => (value < 0 || value > span ? 0 : (1 - value / span) ** 2);

const fmt = (value: number) => value.toFixed(2);

const noopSubscribe = () => () => {};

type DrawTarget = HTMLElement | SVGElement;

type NodeSpec = {
  key: NodeKey;
  kind: "browser" | "resolver" | "server";
  cx: number;
  cy: number;
  a: number;
  h: number;
  port: { x: number; y: number };
  floor: number;
};

type FaceSet = { top: string; left: string; right: string; outline: string };

type EdgePath = {
  d: string;
  floorD: string;
  len: number;
  lift: number;
  xs: Float32Array;
  ys: Float32Array;
  fx: Float32Array;
  fy: Float32Array;
  acc: Float32Array;
};

type Layout = {
  w: number;
  h: number;
  wide: boolean;
  nodes: Record<NodeKey, NodeSpec>;
  edges: Record<EdgeKey, EdgePath>;
};

/** Isometric box: rhombus top, two extruded faces and the silhouette. */
function isoFaces(x: number, y: number, width: number, depth: number): FaceSet {
  const half = width / 2;
  const points = (list: [number, number][]) => list.map(([px, py]) => `${fmt(px)},${fmt(py)}`).join(" ");
  return {
    top: points([
      [x, y - half],
      [x + width, y],
      [x, y + half],
      [x - width, y],
    ]),
    left: points([
      [x - width, y],
      [x, y + half],
      [x, y + half + depth],
      [x - width, y + depth],
    ]),
    right: points([
      [x, y + half],
      [x + width, y],
      [x + width, y + depth],
      [x, y + half + depth],
    ]),
    outline: points([
      [x, y - half],
      [x + width, y],
      [x + width, y + depth],
      [x, y + half + depth],
      [x - width, y + depth],
      [x - width, y],
    ]),
  };
}

/** A point on the projected top face, `u` across and `v` down. */
const facePoint = (x: number, y: number, width: number, u: number, v: number) => ({
  x: x + (u - v) * width,
  y: y - width / 2 + (width / 2) * (u + v),
});

/** A full ellipse as two arcs, used for the TTL ring. */
function ringPath(x: number, y: number, width: number) {
  const half = width / 2;
  return `M${fmt(x)} ${fmt(y - half)} A${fmt(width)} ${fmt(half)} 0 0 1 ${fmt(x)} ${fmt(y + half)} A${fmt(width)} ${fmt(half)} 0 0 1 ${fmt(x)} ${fmt(y - half)}`;
}

function buildEdge(
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromFloor: { x: number; y: number },
  toFloor: { x: number; y: number },
  control: { x: number; y: number },
): EdgePath {
  const ctrl = { x: (from.x + to.x) / 2 + control.x, y: (from.y + to.y) / 2 + control.y };
  const steps = 57;
  const xs = new Float32Array(steps);
  const ys = new Float32Array(steps);
  const fx = new Float32Array(steps);
  const fy = new Float32Array(steps);
  const acc = new Float32Array(steps);
  let lift = 1;
  for (let index = 0; index < steps; index += 1) {
    const t = index / (steps - 1);
    const inv = 1 - t;
    xs[index] = inv * inv * from.x + 2 * inv * t * ctrl.x + t * t * to.x;
    ys[index] = inv * inv * from.y + 2 * inv * t * ctrl.y + t * t * to.y;
    fx[index] = fromFloor.x + (toFloor.x - fromFloor.x) * t;
    fy[index] = fromFloor.y + (toFloor.y - fromFloor.y) * t;
    lift = Math.max(lift, fy[index] - ys[index]);
    acc[index] = index ? acc[index - 1] + Math.hypot(xs[index] - xs[index - 1], ys[index] - ys[index - 1]) : 0;
  }
  return {
    d: `M${fmt(from.x)} ${fmt(from.y)} Q${fmt(ctrl.x)} ${fmt(ctrl.y)} ${fmt(to.x)} ${fmt(to.y)}`,
    floorD: `M${fmt(fromFloor.x)} ${fmt(fromFloor.y)} L${fmt(toFloor.x)} ${fmt(toFloor.y)}`,
    len: acc[steps - 1] || 1,
    lift,
    xs,
    ys,
    fx,
    fy,
    acc,
  };
}

function buildLayout(wide: boolean): Layout {
  const spec: Record<NodeKey, [NodeSpec["kind"], number, number, number, number]> = wide
    ? {
        browser: ["browser", 160, 290, 74, 14],
        resolver: ["resolver", 480, 290, 84, 20],
        root: ["server", 850, 80, 58, 26],
        tld: ["server", 850, 272, 58, 26],
        authoritative: ["server", 850, 464, 58, 26],
      }
    : {
        browser: ["browser", 104, 122, 62, 12],
        resolver: ["resolver", 112, 452, 70, 18],
        root: ["server", 294, 104, 50, 22],
        tld: ["server", 294, 318, 50, 22],
        authoritative: ["server", 294, 532, 50, 22],
      };

  const nodes = {} as Record<NodeKey, NodeSpec>;
  for (const key of NODE_ORDER) {
    const [kind, cx, cy, a, h] = spec[key];
    const liftPort = 12 * (kind === "resolver" ? 1 : 0);
    nodes[key] = {
      key,
      kind,
      cx,
      cy,
      a,
      h,
      port: { x: cx, y: cy - liftPort },
      floor: cy + h,
    };
  }

  const floorAt = (node: NodeSpec) => ({ x: node.cx, y: node.floor + (node.a / 2) * 0.2 });
  const resolver = nodes.resolver;

  const controls = wide
    ? {
        ask: { x: 0, y: -118 },
        root: { x: -40, y: -92 },
        tld: { x: 0, y: -104 },
        authoritative: { x: 24, y: -60 },
      }
    : {
        ask: { x: -64, y: -30 },
        root: { x: -40, y: -70 },
        tld: { x: -10, y: -76 },
        authoritative: { x: 20, y: -40 },
      };

  const link = (from: NodeSpec, to: NodeSpec, control: { x: number; y: number }) =>
    buildEdge(from.port, to.port, floorAt(from), floorAt(to), control);

  const edges: Record<EdgeKey, EdgePath> = {
    ask: link(nodes.browser, resolver, controls.ask),
    root: link(resolver, nodes.root, controls.root),
    tld: link(resolver, nodes.tld, controls.tld),
    authoritative: link(resolver, nodes.authoritative, controls.authoritative),
  };

  return { w: wide ? 1000 : 390, h: wide ? 612 : 676, wide, nodes, edges };
}

function sampleEdge(edge: EdgePath, distance: number) {
  const target = clamp(distance, 0, edge.len);
  let low = 0;
  let high = edge.acc.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (edge.acc[mid] < target) low = mid;
    else high = mid;
  }
  const t = (target - edge.acc[low]) / (edge.acc[high] - edge.acc[low] || 1);
  const mix = (list: Float32Array) => list[low] + (list[high] - list[low]) * t;
  return { x: mix(edge.xs), y: mix(edge.ys), fx: mix(edge.fx), fy: mix(edge.fy) };
}

function NodeMark({ node, className }: { node: { icon?: string | ReactNode; color?: string }; className: string }) {
  const { icon, color } = node;
  if (icon === undefined || icon === null) return null;
  if (typeof icon === "string") {
    return /^(\/|\.|https?:|data:|blob:)/.test(icon) ? (
      <img className={className} src={icon} alt="" draggable={false} />
    ) : (
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

type Labels = {
  messages: { query: string; rootRef: string; tldRef: string; answer: string };
  replies: Record<ServerKey, string>;
  asking: Record<ServerKey, string>;
  captions: string[];
};

type Elements = {
  node: Partial<Record<NodeKey, SVGGElement | null>>;
  led: Partial<Record<NodeKey, SVGCircleElement | null>>;
  port: Partial<Record<NodeKey, SVGEllipseElement | null>>;
  status: Partial<Record<NodeKey, HTMLSpanElement | null>>;
  statusText: Partial<Record<NodeKey, HTMLSpanElement | null>>;
  edge: Partial<Record<EdgeKey, SVGPathElement | null>>;
  floor: Partial<Record<EdgeKey, SVGPathElement | null>>;
  trail: Partial<Record<EdgeKey, SVGPathElement | null>>;
  packet: Partial<Record<EdgeKey, SVGCircleElement | null>>;
  shadow: Partial<Record<EdgeKey, SVGEllipseElement | null>>;
  page: (SVGPathElement | null)[];
  lock: SVGCircleElement | null;
  ring: SVGPathElement | null;
  record: HTMLSpanElement | null;
  recordTtl: HTMLSpanElement | null;
  fill: (HTMLSpanElement | null)[];
  seg: (HTMLButtonElement | null)[];
  caption: HTMLElement | null;
  capTitle: HTMLSpanElement | null;
  capText: HTMLSpanElement | null;
  msg: HTMLSpanElement | null;
  msgText: HTMLSpanElement | null;
};

/**
 * An animated DNS lookup on a layered 2.5D stage. The browser asks a resolver for a name, and the
 * query arcs through the air to the root server, the TLD server and the authoritative nameserver,
 * each pointing to the next, until the address comes back and the page draws in on the browser. The
 * resolver stores the answer with a TTL ring that drains on its cache tier, and a second lookup is
 * answered from that cache in one short hop.
 */
export function DnsResolution({
  domain = "app.acme.dev",
  address = "203.0.113.24",
  ttl = 300,
  lookupMs = 84,
  cachedMs = 1,
  nodes,
  speed = 1,
  paused = false,
  accent,
  controls = true,
  caption = true,
  label,
  className,
  style,
}: DnsResolutionProps) {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const reduced = Boolean(useReducedMotion()) && mounted;

  const stageRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hovered, setHovered] = useState<NodeKey | null>(null);
  const [pausedState, setPausedState] = useState(false);
  const [stepIndex, setStepIndex] = useState(5);

  const parts = domain.split(".").filter(Boolean);
  const tldName = `.${parts[parts.length - 1] ?? "com"}`;
  const zone = parts.slice(-2).join(".") || domain;

  const nodeLabels = useMemo(() => {
    const overrides = nodes ?? {};
    return {
      browser: {
        label: "Browser",
        meta: domain,
        detail: "Needs an address before it can connect",
        ...overrides.browser,
      },
      resolver: {
        label: "Resolver",
        meta: "Recursive DNS",
        detail: "Walks the chain for you and caches the answer",
        ...overrides.resolver,
      },
      root: {
        label: "Root server",
        meta: "a.root-servers.net",
        detail: "Knows where every top level domain lives",
        ...overrides.root,
      },
      tld: {
        label: "TLD server",
        meta: `${tldName} registry`,
        detail: `Knows the nameservers for every ${tldName} name`,
        ...overrides.tld,
      },
      authoritative: {
        label: "Nameserver",
        meta: `ns1.${zone}`,
        detail: `Holds the records for ${zone}`,
        ...overrides.authoritative,
      },
    };
  }, [nodes, domain, tldName, zone]);

  const nameServer = nodeLabels.authoritative.meta ?? `ns1.${zone}`;

  const text = useMemo<Labels>(
    () => ({
      messages: {
        query: `A? ${domain}`,
        rootRef: `NS ${tldName}`,
        tldRef: `NS ${nameServer}`,
        answer: `A ${address}`,
      },
      replies: {
        root: `Try ${tldName}`,
        tld: `Try ${nameServer}`,
        authoritative: address,
      },
      asking: {
        root: "Asking root",
        tld: `Asking ${tldName}`,
        authoritative: `Asking ${nameServer}`,
      },
      captions: [
        `Your browser asks the resolver for ${domain}. It is not in the cache yet.`,
        `The root server does not know the address, but points to the ${tldName} servers.`,
        `The ${tldName} server points to ${nameServer}, the nameserver for ${zone}.`,
        `${nameServer} answers with the address ${address}.`,
        `The resolver caches the answer for ${ttl} s and the browser connects in ${lookupMs} ms.`,
        `The next lookup comes straight from the cache in ${cachedMs} ms, until the TTL runs out.`,
      ],
    }),
    [tldName, nameServer, address, domain, zone, ttl, lookupMs, cachedMs],
  );

  const wide = width >= 640;
  const measured = width > 0;

  const layout = useMemo<Layout | null>(() => (measured ? buildLayout(wide) : null), [measured, wide]);

  const els = useRef<Elements>({
    node: {},
    led: {},
    port: {},
    status: {},
    statusText: {},
    edge: {},
    floor: {},
    trail: {},
    packet: {},
    shadow: {},
    page: [],
    lock: null,
    ring: null,
    record: null,
    recordTtl: null,
    fill: [],
    seg: [],
    caption: null,
    capTitle: null,
    capText: null,
    msg: null,
    msgText: null,
  });

  const clock = useRef({
    t: paused || speed === 0 ? STATUS_OPACITY : 0,
    rate: Number.NaN,
    rateV: 0,
    frame: 0,
    running: false,
    visible: true,
    cache: new Map<DrawTarget, Record<string, string>>(),
  });

  const target = paused || pausedState ? 0 : speed * (hovered ? 0.7 : 1);
  const scale = layout ? width / layout.w : 1;

  const stateRef = useRef({ layout, text, target, reduced, lookupMs, cachedMs, ttl, scale });

  useLayoutEffect(() => {
    stateRef.current = { layout, text, target, reduced, lookupMs, cachedMs, ttl, scale };
  });

  const set = useCallback((el: DrawTarget | null | undefined, key: string, value: string) => {
    if (!el) return;
    const cache = clock.current.cache;
    let values = cache.get(el);
    if (!values) {
      values = {};
      cache.set(el, values);
    }
    if (values[key] === value) return;
    values[key] = value;
    if (key === "text") {
      const first = el.firstChild;
      if (first && first.nodeType === 3 && !first.nextSibling) (first as Text).data = value;
      else el.textContent = value;
    } else if (key.startsWith("--")) {
      el.style.setProperty(key, value);
    } else if (key.startsWith("s:")) {
      el.style.setProperty(key.slice(2), value);
    } else {
      el.setAttribute(key, value);
    }
  }, []);

  const draw = useCallback(
    (raw: number) => {
      const { layout: scene, text: copy, lookupMs: fastMs, cachedMs: cacheMs, ttl: ttlValue, scale: unit } =
        stateRef.current;
      const refs = els.current;
      const time = ((raw % T.cycle) + T.cycle) % T.cycle;
      const fadeOut = time < T.fade ? 1 : 1 - sineEase((time - T.fade) / (T.cycle - T.fade));
      const intro = time < 0.35 ? sineEase(time / 0.35) : fadeOut;

      let current = 0;
      STEPS.forEach((step, index) => {
        if (time >= step.start) current = index;
      });

      STEPS.forEach((step, index) => {
        const next = STEPS[index + 1]?.start ?? T.cycle;
        const progress = stateRef.current.reduced
          ? Number(index <= current)
          : clamp((time - step.start) / (next - step.start), 0, 1);
        set(refs.fill[index], "s:transform", `scaleX(${progress.toFixed(4)})`);
        set(refs.fill[index], "s:opacity", fadeOut.toFixed(3));
        set(refs.seg[index], "data-current", index === current ? "true" : "false");
        set(refs.seg[index], "aria-current", index === current ? "step" : "false");
      });

      set(refs.capTitle, "text", STEPS[current].title);
      set(refs.capText, "text", copy.captions[current]);

      const stepStart = STEPS[current].start;
      const stepEnd = STEPS[current + 1]?.start ?? T.cycle;
      const captionOpacity = stateRef.current.reduced
        ? 1
        : Math.min(sineEase((time - stepStart) / 0.3), sineEase((stepEnd - time) / 0.15));
      set(refs.caption, "s:opacity", captionOpacity.toFixed(3));

      if (!scene) return;

      const lit: Record<EdgeKey, number> = { ask: 0, root: 0, tld: 0, authoritative: 0 };
      const hit: Record<NodeKey, number> = { browser: 0, resolver: 0, root: 0, tld: 0, authoritative: 0 };
      const active: Partial<Record<EdgeKey, { u: number; trip: Trip }>> = {};

      for (const trip of TRIPS) {
        const progress = (time - trip.t0) / trip.d;
        if (progress >= 0 && progress <= 1) active[trip.edge] = { u: progress, trip };
        lit[trip.edge] = Math.max(lit[trip.edge], sineEase(clamp(progress, 0, 1)));
        const owner: NodeKey = trip.back
          ? trip.edge === "ask"
            ? "browser"
            : "resolver"
          : trip.edge === "ask"
            ? "resolver"
            : EDGE_TARGET[trip.edge];
        hit[owner] = Math.max(hit[owner], pulse(time - trip.t0 - trip.d, 0.8));
      }

      // The first answer arms the cache, so every lit route after that is dimmed by a constant.
      const lateDim = 1 - 0.62 * sineEase((time - (T.again - 0.4)) / 0.5);
      let travelling = false;

      for (const edge of EDGE_ORDER) {
        const path = scene.edges[edge];
        set(refs.edge[edge], "--lit", ((edge === "ask" ? lit[edge] : lit[edge] * lateDim) * fadeOut).toFixed(3));

        const trip = active[edge];
        const packet = refs.packet[edge];
        const trail = refs.trail[edge];
        const shadow = refs.shadow[edge];
        if (!trip) {
          set(packet, "opacity", "0");
          set(trail, "opacity", "0");
          set(shadow, "opacity", "0");
          continue;
        }

        const { u, trip: hop } = trip;
        const travelled = sineEase(u) * path.len;
        const distance = hop.back ? path.len - travelled : travelled;
        const point = sampleEdge(path, distance);
        const shrink = sineEase((u - 0.8) / 0.2);
        const appear = sineEase(u / 0.16);

        set(packet, "transform", `translate(${fmt(point.x)} ${fmt(point.y)}) scale(${(1 - 0.5 * shrink).toFixed(3)})`);
        set(packet, "opacity", (appear * (1 - shrink)).toFixed(3));
        set(packet, "data-kind", hop.kind);

        const depth = clamp((point.fy - point.y) / path.lift, 0, 1);
        set(shadow, "transform", `translate(${fmt(point.fx)} ${fmt(point.fy)}) scale(${(1 - 0.45 * depth).toFixed(3)})`);
        set(shadow, "opacity", ((0.9 - 0.5 * depth) * appear * (1 - shrink)).toFixed(3));

        const trailLength = Math.min(46, travelled);
        const trailEnd = hop.back ? distance : distance - trailLength;
        const perUnit = 1000 / path.len;
        set(trail, "stroke-dasharray", `${(trailLength * perUnit).toFixed(2)} 3000`);
        set(trail, "stroke-dashoffset", `${(-trailEnd * perUnit).toFixed(2)}`);
        set(trail, "opacity", (clamp(u / 0.12, 0, 1) * (1 - clamp((u - 0.82) / 0.18, 0, 1))).toFixed(3));
        travelling = true;

        set(refs.msg, "s:transform", `translate3d(${(point.x * unit).toFixed(1)}px, ${(point.y * unit - 10).toFixed(1)}px, 0) translate(-50%, -100%)`);
        set(refs.msg, "s:opacity", (sineEase(u / 0.2) * (1 - sineEase((u - 0.78) / 0.2))).toFixed(3));
        set(refs.msg, "data-kind", hop.kind);
        set(
          refs.msgText,
          "text",
          copy.messages[
            hop.kind === "query" ? "query" : hop.kind === "answer" ? "answer" : edge === "root" ? "rootRef" : "tldRef"
          ],
        );
      }

      if (!travelling) set(refs.msg, "s:opacity", "0");

      for (const key of NODE_ORDER) {
        set(refs.node[key], "--hit", hit[key].toFixed(3));
        let port = 0;
        for (const trip of TRIPS) {
          const owner: NodeKey = trip.back
            ? trip.edge === "ask"
              ? "resolver"
              : EDGE_TARGET[trip.edge]
            : trip.edge === "ask"
              ? "browser"
              : "resolver";
          if (owner === key) port = Math.max(port, pulse(time - trip.t0, 0.6));
        }
        set(refs.port[key], "fill-opacity", Math.max(port, hit[key]).toFixed(3));
      }

      for (const key of SERVER_KEYS) {
        set(refs.led[key], "fill-opacity", window4(time, arrival(key), settled(key), 0.08, 0.35).toFixed(3));
      }

      refs.page.forEach((el, index) => {
        const progress = sineEase((time - T.page - 0.14 * index) / 0.55) * fadeOut;
        set(el, "stroke-dashoffset", (1 - progress).toFixed(4));
        set(el, "opacity", progress > 0.002 ? "1" : "0");
      });

      set(refs.lock, "fill-opacity", ((time >= connectedAt ? cubicEase((time - connectedAt) / 0.3) : 0) * fadeOut).toFixed(3));

      // TTL ring: fills once the record is stored, then drains until it expires.
      const drain = clamp((time - filledAt) / (T.expire - filledAt), 0, 1);
      const ring = time < T.store ? 0 : time < filledAt ? cubicEase((time - T.store) / T.fill) : 1 - drain;
      set(refs.ring, "stroke-dasharray", `${(1000 * ring).toFixed(2)} 1000`);
      set(
        refs.ring,
        "opacity",
        (ring < 0.002 ? 0 : time < T.expire ? 1 : 1 - sineEase((time - T.expire) / 0.3)).toFixed(3),
      );

      const recordOpacity = window4(time, T.store, T.expire + 0.2, 0.35, 0.35) * fadeOut;
      set(refs.record, "s:opacity", recordOpacity.toFixed(3));
      set(refs.record, "s:transform", `translateY(${(-6 * (1 - cubicEase((time - T.store) / 0.5))).toFixed(2)}px)`);
      set(
        refs.record,
        "data-state",
        time >= T.expire ? "expired" : time >= T.hit && time < T.hit + 0.9 ? "hit" : "live",
      );
      set(
        refs.recordTtl,
        "text",
        time >= T.expire ? "Expired" : `TTL ${Math.max(0, Math.ceil(ttlValue * (time < filledAt ? 1 : 1 - drain)))} s`,
      );

      const status = (key: NodeKey, state: string, text: string, opacity = STATUS_OPACITY) => {
        set(refs.status[key], "data-state", state);
        set(refs.statusText[key], "text", text);
        set(refs.status[key], "s:opacity", opacity.toFixed(3));
      };

      const counted = Math.round(fastMs * clamp((time - T.ask) / (connectedAt - T.ask), 0, 1));
      if (time < T.ask) status("browser", "idle", "Ready");
      else if (time < connectedAt) status("browser", "busy", `Resolving ${counted} ms`);
      else if (time < connectedAt + 0.7) status("browser", "busy", "Connecting");
      else if (time < T.again) status("browser", "done", `Connected in ${fastMs} ms`);
      else if (time < cachedAt) status("browser", "busy", "Resolving");
      else status("browser", "done", `Connected in ${cacheMs} ms`);

      if (time < T.check) status("resolver", "idle", "Waiting");
      else if (time < T.root)
        status("resolver", "busy", time < T.check + 0.35 ? "Checking cache" : "Not cached");
      else if (time < arrival("authoritative") + T.out + T.think) {
        const asking: ServerKey = time < T.tld ? "root" : time < T.authoritative ? "tld" : "authoritative";
        status("resolver", "busy", copy.asking[asking]);
      } else if (time < T.hit) status("resolver", "done", "Answer cached");
      else if (time < T.expire) status("resolver", "done", "Cache hit");
      else status("resolver", "idle", "Expired");

      for (const key of SERVER_KEYS) {
        const reach = arrival(key);
        const done = settled(key);
        const opacity = (time < reach ? 0 : sineEase((time - reach) / 0.25)) * fadeOut;
        if (time < done) status(key, "busy", "Looking up", opacity);
        else status(key, key === "authoritative" ? "done" : "refer", copy.replies[key], opacity);
      }
    },
    [set],
  );

  const start = useCallback(() => {
    const state = clock.current;
    if (state.running || !state.visible || stateRef.current.reduced) return;
    state.running = true;
    let previous = performance.now();
    const tick = (now: number) => {
      if (!state.visible || stateRef.current.reduced) {
        state.running = false;
        return;
      }
      const delta = clamp((now - previous) / 1000, 0, 0.05);
      previous = now;
      const goal = stateRef.current.target;
      if (Number.isNaN(state.rate)) state.rate = goal;
      // Critically damped spring on the rate, so pause, speed changes and hover ease instead of jumping.
      state.rateV += (40 * (goal - state.rate) - 2 * Math.sqrt(40) * state.rateV) * delta;
      state.rate += state.rateV * delta;
      if (Math.abs(goal - state.rate) < 1e-4 && Math.abs(state.rateV) < 1e-4) {
        state.rate = goal;
        state.rateV = 0;
      }
      state.t += delta * state.rate;
      draw(state.t);
      if ((state.rate === 0 && goal === 0) || !state.visible || stateRef.current.reduced) {
        state.running = false;
        return;
      }
      state.frame = requestAnimationFrame(tick);
    };
    state.frame = requestAnimationFrame(tick);
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
    if (reduced) draw(STEPS[stepIndex].rep);
    else {
      draw(clock.current.t);
      start();
    }
  }, [layout, scale, text, reduced, target, stepIndex, draw, start]);

  useEffect(() => {
    const stage = stageRef.current;
    const state = clock.current;
    if (!stage) return;
    const observer = new IntersectionObserver(([entry]) => {
      state.visible = entry.isIntersecting && !document.hidden;
      if (state.visible) start();
      else {
        cancelAnimationFrame(state.frame);
        state.running = false;
      }
    });
    const onVisibility = () => {
      state.visible = !document.hidden;
      if (state.visible) start();
      else {
        cancelAnimationFrame(state.frame);
        state.running = false;
      }
    };
    observer.observe(stage);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(state.frame);
      state.running = false;
    };
  }, [start]);

  const jump = useCallback(
    (index: number) => {
      const state = clock.current;
      if (stateRef.current.reduced) {
        setStepIndex(index);
        return;
      }
      const phase = ((state.t % T.cycle) + T.cycle) % T.cycle;
      state.t = state.t - phase + STEPS[index].start + 0.001 * (index === 0 ? 0 : 1);
      draw(state.t);
      start();
    },
    [draw, start],
  );

  const hoverEnter = (key: NodeKey) => (event: ReactPointerEvent<Element>) => {
    if (event.pointerType === "mouse") setHovered(key);
  };
  const hoverLeave = (key: NodeKey) => () => setHovered((current) => (current === key ? null : current));

  const edgeActive = (edge: EdgeKey) => hovered === "resolver" || hovered === EDGE_TARGET[edge];

  const description =
    label ??
    `DNS resolution for ${domain}. The browser asks a resolver, which asks a root server, the ${tldName} TLD server and the nameserver ${nameServer} in turn. Each points to the next until ${nameServer} answers ${address} and the browser connects in ${lookupMs} ms. The resolver caches the answer for ${ttl} seconds, so the next lookup is answered from the cache in one short hop.`;

  const figureStyle = { ...style, ...(accent ? { "--dns-accent": accent } : null) } as CSSProperties;

  /** Pause is showing when the loop is paused, when the prop says so, or when speed is 0. */
  const stopped = pausedState || paused || speed === 0;
  const percent = (value: number, total: number) => `${((value / total) * 100).toFixed(3)}%`;
  const ordered = layout ? [...NODE_ORDER].sort((a, b) => layout.nodes[a].cy - layout.nodes[b].cy) : [];

  return (
    <figure
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={figureStyle}
      data-ready={layout ? true : undefined}
      data-layout={layout ? (layout.wide ? "wide" : "stack") : undefined}
      data-focus={hovered ? true : undefined}
    >
      <div
        ref={stageRef}
        className={styles.stage}
        role="img"
        aria-label={description}
        style={layout ? { aspectRatio: `${layout.w} / ${layout.h}` } : undefined}
      >
        {layout && (
          <>
            <svg className={styles.svg} viewBox={`0 0 ${layout.w} ${layout.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              <g>
                {EDGE_ORDER.map((edge) => (
                  <path
                    key={edge}
                    ref={(el) => {
                      els.current.floor[edge] = el;
                    }}
                    className={styles.floor}
                    d={layout.edges[edge].floorD}
                    data-dim={(hovered !== null && !edgeActive(edge)) || undefined}
                  />
                ))}
                {EDGE_ORDER.map((edge) => (
                  <ellipse
                    key={`s-${edge}`}
                    ref={(el) => {
                      els.current.shadow[edge] = el;
                    }}
                    className={styles.shadow}
                    cx={0}
                    cy={0}
                    rx={5}
                    ry={2.5}
                    opacity={0}
                  />
                ))}
              </g>
              {ordered.map((key) => {
                const node = layout.nodes[key];
                const faces = isoFaces(node.cx, node.cy, node.a, node.h);
                const dim =
                  hovered !== null && hovered !== key && hovered !== "resolver" && key !== "resolver";
                const half = node.a / 2;
                const barStart = facePoint(node.cx, node.cy, node.a, 0.1, 0.16);
                const barEnd = facePoint(node.cx, node.cy, node.a, 0.9, 0.16);
                const lockAt = facePoint(node.cx, node.cy, node.a, 0.16, 0.16);
                const resolverFace = isoFaces(node.cx, node.cy - 12, 0.58 * node.a, 12);
                const ringRadius = 0.64 * (0.58 * node.a);

                return (
                  <g
                    key={key}
                    ref={(el) => {
                      els.current.node[key] = el;
                    }}
                    className={styles.node}
                    data-on={hovered === key || undefined}
                    data-dim={dim || undefined}
                    onPointerEnter={hoverEnter(key)}
                    onPointerLeave={hoverLeave(key)}
                  >
                    <polygon className={styles.faceLeft} points={faces.left} />
                    <polygon className={styles.faceRight} points={faces.right} />
                    <polygon className={styles.faceTop} points={faces.top} />
                    {node.kind === "server" && (
                      <>
                        {[1, 2].map((index) => {
                          const offset = (node.h * index) / 3;
                          return (
                            <line
                              key={index}
                              className={styles.rack}
                              x1={node.cx - node.a}
                              y1={node.cy + offset}
                              x2={node.cx}
                              y2={node.cy + half + offset}
                            />
                          );
                        })}
                        {[1, 2].map((index) => {
                          const offset = (node.h * index) / 3;
                          return (
                            <line
                              key={`r${index}`}
                              className={styles.rack}
                              x1={node.cx}
                              y1={node.cy + half + offset}
                              x2={node.cx + 0.62 * node.a}
                              y2={node.cy + 0.38 * half + offset}
                            />
                          );
                        })}
                        <circle
                          className={styles.ledBase}
                          cx={node.cx + 0.8 * node.a}
                          cy={node.cy + 0.2 * half + node.h / 2}
                          r={2.4}
                        />
                        <circle
                          ref={(el) => {
                            els.current.led[key] = el;
                          }}
                          className={styles.led}
                          cx={node.cx + 0.8 * node.a}
                          cy={node.cy + 0.2 * half + node.h / 2}
                          r={2.4}
                          fillOpacity={0}
                        />
                      </>
                    )}
                    {node.kind === "browser" && (
                      <>
                        <path
                          className={styles.bar}
                          d={`M${fmt(barStart.x)} ${fmt(barStart.y)} L${fmt(barEnd.x)} ${fmt(barEnd.y)}`}
                        />
                        <circle className={styles.lockBase} cx={lockAt.x} cy={lockAt.y} r={1.8} />
                        <circle
                          ref={(el) => {
                            els.current.lock = el;
                          }}
                          className={styles.lock}
                          cx={lockAt.x}
                          cy={lockAt.y}
                          r={1.8}
                          fillOpacity={0}
                        />
                        {[
                          [0.36, 0.1, 0.84],
                          [0.5, 0.1, 0.66],
                          [0.64, 0.1, 0.76],
                          [0.78, 0.1, 0.5],
                        ].map(([row, inset, end], index) => {
                          const from = facePoint(node.cx, node.cy, node.a, inset, row);
                          const to = facePoint(node.cx, node.cy, node.a, end, row);
                          const d = `M${fmt(from.x)} ${fmt(from.y)} L${fmt(to.x)} ${fmt(to.y)}`;
                          return (
                            <g key={index}>
                              <path className={styles.ghost} d={d} />
                              <path
                                ref={(el) => {
                                  els.current.page[index] = el;
                                }}
                                className={styles.pageLine}
                                d={d}
                                pathLength={1}
                                strokeDasharray="1 1"
                                strokeDashoffset={1}
                                opacity={0}
                              />
                            </g>
                          );
                        })}
                      </>
                    )}
                    {node.kind === "resolver" && (
                      <>
                        <polygon className={styles.faceLeft} points={resolverFace.left} />
                        <polygon className={styles.faceRight} points={resolverFace.right} />
                        <polygon className={styles.faceTop} points={resolverFace.top} />
                        <path className={styles.ringTrack} d={ringPath(node.cx, node.cy - 12, ringRadius)} />
                        <path
                          ref={(el) => {
                            els.current.ring = el;
                          }}
                          className={styles.ring}
                          d={ringPath(node.cx, node.cy - 12, ringRadius)}
                          pathLength={1000}
                          strokeDasharray="0 1000"
                          opacity={0}
                        />
                      </>
                    )}
                    <ellipse className={styles.portBase} cx={node.port.x} cy={node.port.y} rx={4.5} ry={2.25} />
                    <ellipse
                      ref={(el) => {
                        els.current.port[key] = el;
                      }}
                      className={styles.port}
                      cx={node.port.x}
                      cy={node.port.y}
                      rx={4.5}
                      ry={2.25}
                      fillOpacity={0}
                    />
                    <polygon
                      className={styles.hit}
                      points={node.kind === "resolver" ? isoFaces(node.cx, node.cy, node.a, node.h).outline : faces.outline}
                    />
                  </g>
                );
              })}
              {EDGE_ORDER.map((edge) => (
                <g
                  key={`e-${edge}`}
                  className={styles.route}
                  data-on={edgeActive(edge) || undefined}
                  data-dim={(hovered !== null && !edgeActive(edge)) || undefined}
                >
                  <path
                    ref={(el) => {
                      els.current.edge[edge] = el;
                    }}
                    className={styles.edge}
                    d={layout.edges[edge].d}
                  />
                  <path
                    ref={(el) => {
                      els.current.trail[edge] = el;
                    }}
                    className={styles.trail}
                    d={layout.edges[edge].d}
                    pathLength={1000}
                    opacity={0}
                  />
                  <circle
                    ref={(el) => {
                      els.current.packet[edge] = el;
                    }}
                    className={styles.packet}
                    cx={0}
                    cy={0}
                    r={4.5}
                    opacity={0}
                    data-kind="query"
                  />
                </g>
              ))}
            </svg>
            {NODE_ORDER.map((key) => {
              const node = layout.nodes[key];
              const copy = nodeLabels[key];
              const above = !layout.wide && key === "browser";
              const top = above ? node.cy - node.a / 2 - 12 : node.floor + node.a / 2 + 12;
              return (
                <div
                  key={key}
                  className={styles.label}
                  data-on={hovered === key || undefined}
                  data-above={above || undefined}
                  style={{ left: percent(node.cx, layout.w), top: percent(top, layout.h) }}
                  onPointerEnter={hoverEnter(key)}
                  onPointerLeave={hoverLeave(key)}
                >
                  <span className={styles.name}>
                    <NodeMark node={copy} className={styles.mark} />
                    {copy.label}
                  </span>
                  {copy.meta && <span className={styles.meta}>{copy.meta}</span>}
                  <span
                    ref={(el) => {
                      els.current.status[key] = el;
                    }}
                    className={styles.status}
                    data-state="idle"
                  >
                    <span className={styles.dot} aria-hidden="true" />
                    <span
                      ref={(el) => {
                        els.current.statusText[key] = el;
                      }}
                    >
                      {key === "browser" ? "Ready" : key === "resolver" ? "Waiting" : "Looking up"}
                    </span>
                  </span>
                  {key === "resolver" && (
                    <span
                      ref={(el) => {
                        els.current.record = el;
                      }}
                      className={styles.record}
                      style={{ opacity: 0 }}
                    >
                      <span className={styles.recordName}>{domain}</span>
                      <span className={styles.recordRow}>
                        <span className={styles.recordValue}>A {address}</span>
                        <span
                          ref={(el) => {
                            els.current.recordTtl = el;
                          }}
                          className={styles.recordTtl}
                        >
                          TTL {ttl} s
                        </span>
                      </span>
                    </span>
                  )}
                </div>
              );
            })}
            {NODE_ORDER.map((key) => {
              const node = layout.nodes[key];
              const detail = nodeLabels[key].detail;
              if (!detail) return null;
              const top = node.cy - (node.kind === "resolver" ? 12 + (0.58 * node.a) / 2 : node.a / 2) - 10;
              const ratio = node.cx / layout.w;
              return (
                <span
                  key={`tag-${key}`}
                  className={styles.tag}
                  data-show={hovered === key || undefined}
                  data-align={ratio > 0.7 ? "end" : ratio < 0.3 ? "start" : "center"}
                  style={{ left: percent(node.cx, layout.w), top: percent(top, layout.h) }}
                  aria-hidden="true"
                >
                  {detail}
                </span>
              );
            })}
            <span
              ref={(el) => {
                els.current.msg = el;
              }}
              className={styles.msg}
              style={{ opacity: 0 }}
              aria-hidden="true"
            >
              <span
                ref={(el) => {
                  els.current.msgText = el;
                }}
              >
                {`A? ${domain}`}
              </span>
            </span>
          </>
        )}
      </div>
      {controls && (
        <div className={styles.controls}>
          {!reduced && (
            <button
              type="button"
              className={styles.toggle}
              aria-label={stopped ? "Play" : "Pause"}
              aria-pressed={pausedState}
              disabled={paused || speed === 0}
              onClick={() => setPausedState((value) => !value)}
            >
              {stopped ? (
                <Play size={16} strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Pause size={16} strokeWidth={1.75} aria-hidden="true" />
              )}
            </button>
          )}
          <div className={styles.segments} role="group" aria-label="Lookup steps">
            {STEPS.map((step, index) => (
              <button
                key={step.short}
                ref={(el) => {
                  els.current.seg[index] = el;
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
                  els.current.seg[next]?.focus();
                  jump(next);
                }}
              >
                <span className={styles.track}>
                  <span
                    ref={(el) => {
                      els.current.fill[index] = el;
                    }}
                    className={styles.fill}
                  />
                </span>
                <span className={styles.segLabel}>{index === 2 ? tldName : step.short}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {caption && (
        <figcaption
          ref={(el) => {
            els.current.caption = el;
          }}
          className={styles.caption}
          aria-hidden="true"
        >
          <span
            ref={(el) => {
              els.current.capTitle = el;
            }}
            className={styles.capTitle}
          >
            {STEPS[0].title}
          </span>
          <span
            ref={(el) => {
              els.current.capText = el;
            }}
            className={styles.capText}
          >
            {text.captions[0]}
          </span>
        </figcaption>
      )}
    </figure>
  );
}

export default DnsResolution;
