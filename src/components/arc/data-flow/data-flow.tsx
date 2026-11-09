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
import {
  AppWindow,
  BellRing,
  Database,
  LayoutDashboard,
  Warehouse,
  Webhook,
} from "lucide-react";
import { useReducedMotion } from "motion/react";
import styles from "./data-flow.module.css";

export type DataFlowNode = {
  id?: string;
  label: string;
  meta?: string;
  detail?: string;
  icon?: string | ReactNode;
  color?: string;
};

export type DataFlowDestination = DataFlowNode & { share?: number };

export type DataFlowCore = {
  label?: string;
  detail?: string;
  countLabel?: string;
  countStart?: number;
};

export type DataFlowProps = {
  sources?: DataFlowNode[];
  destinations?: DataFlowDestination[];
  core?: DataFlowCore;
  speed?: number;
  paused?: boolean;
  accent?: string;
  label?: string;
  caption?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

const DEFAULT_SOURCES: DataFlowNode[] = [
  {
    id: "app",
    label: "App",
    meta: "Web and iOS",
    detail: "Clicks and sessions as they happen",
    icon: <AppWindow />,
  },
  {
    id: "database",
    label: "Database",
    meta: "Postgres",
    detail: "Row changes through change data capture",
    icon: <Database />,
  },
  {
    id: "events",
    label: "Events",
    meta: "Webhooks",
    detail: "Billing and auth events from partners",
    icon: <Webhook />,
  },
];

const DEFAULT_DESTINATIONS: DataFlowDestination[] = [
  {
    id: "warehouse",
    label: "Warehouse",
    meta: "Every record",
    detail: "Stored in full for analysis",
    icon: <Warehouse />,
  },
  {
    id: "dashboard",
    label: "Dashboard",
    meta: "Live metrics",
    detail: "Rolled up into metrics each minute",
    icon: <LayoutDashboard />,
  },
  {
    id: "alerts",
    label: "Alerts",
    meta: "Anomalies only",
    detail: "Only unusual records page the on-call",
    icon: <BellRing />,
    share: 0.34,
  },
];

const SLOT_ORDER = [0, 2, 1, 0, 1, 2];
const BASE_TIME = 13.2;
const CYCLE = 6.6;

type Point = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };

type Curve = {
  d: string;
  xs: Float32Array;
  ys: Float32Array;
  acc: Float32Array;
  len: number;
  edge: number;
};

type Geometry = {
  w: number;
  h: number;
  stacked: boolean;
  core: number;
  c: Point;
  sources: Box[];
  dests: Box[];
  inCurves: Curve[];
  outCurves: Curve[];
};

type Slot = { src: number; at: number; pace: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const ease = (value: number) => 0.5 - Math.cos(Math.PI * clamp(value, 0, 1)) / 2;
const keyOf = (node: DataFlowNode) => node.id ?? node.label;
const formatCount = (value: number) => Math.round(value).toLocaleString("en-US");
const subscribeNothing = () => () => undefined;

/**
 * Sample a cubic (optionally with straight caps on either end) into a poly line, so records can
 * travel at an even pace along real arc length instead of per curve parameter.
 */
function buildCurve(from: Point, to: Point, axis: "x" | "y", endCap?: Point, startCap?: Point): Curve {
  const points: Point[] = [];
  if (startCap) points.push(startCap);
  const handle = axis === "x" ? (to.x - from.x) * 0.5 : (to.y - from.y) * 0.5;
  const c1 = axis === "x" ? { x: from.x + handle, y: from.y } : { x: from.x, y: from.y + handle };
  const c2 = axis === "x" ? { x: to.x - handle, y: to.y } : { x: to.x, y: to.y - handle };
  for (let step = 0; step <= 72; step++) {
    const t = step / 72;
    const s = 1 - t;
    points.push({
      x: s * s * s * from.x + 3 * s * s * t * c1.x + 3 * s * t * t * c2.x + t * t * t * to.x,
      y: s * s * s * from.y + 3 * s * s * t * c1.y + 3 * s * t * t * c2.y + t * t * t * to.y,
    });
  }
  if (endCap) points.push(endCap);

  const count = points.length;
  const xs = new Float32Array(count);
  const ys = new Float32Array(count);
  const acc = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    xs[i] = points[i].x;
    ys[i] = points[i].y;
    acc[i] = i ? acc[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]) : 0;
  }

  const d = `${startCap ? `M${startCap.x.toFixed(2)} ${startCap.y.toFixed(2)} L` : "M"}${from.x.toFixed(2)} ${from.y.toFixed(2)} C${c1.x.toFixed(2)} ${c1.y.toFixed(2)} ${c2.x.toFixed(2)} ${c2.y.toFixed(2)} ${to.x.toFixed(2)} ${to.y.toFixed(2)}${endCap ? ` L${endCap.x.toFixed(2)} ${endCap.y.toFixed(2)}` : ""}`;
  const len = acc[count - 1] || 1;
  return { d, xs, ys, acc, len, edge: endCap ? acc[count - 2] : startCap ? acc[1] : 0 };
}

/** Point at `distance` along the curve, linear between samples. */
function sampleCurve(curve: Curve, distance: number): Point {
  const target = clamp(distance, 0, curve.len);
  let lo = 0;
  let hi = curve.acc.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (curve.acc[mid] < target) lo = mid;
    else hi = mid;
  }
  const span = curve.acc[hi] - curve.acc[lo] || 1;
  const f = (target - curve.acc[lo]) / span;
  return { x: curve.xs[lo] + (curve.xs[hi] - curve.xs[lo]) * f, y: curve.ys[lo] + (curve.ys[hi] - curve.ys[lo]) * f };
}

function buildGeometry(width: number, sourceCount: number, destCount: number): Geometry {
  const stacked = width < 600;

  if (!stacked) {
    const height = Math.round(clamp(0.4 * width, 300, 400));
    const chipW = Math.round(clamp(0.18 * width, 132, 184));
    const core = Math.round(clamp(0.1 * width, 84, 104));
    const center = { x: Math.round(width / 2), y: Math.round(height / 2 - 10) };
    const spread = (count: number) => {
      const reach = Math.min(0.29 * height, 112);
      return Array.from({ length: count }, (_, index) =>
        Math.round(center.y + (count === 1 ? 0 : (index / (count - 1) - 0.5) * 2 * reach)),
      );
    };
    const fan = (index: number, count: number) =>
      count === 1 ? 0 : (index / (count - 1) - 0.5) * 2 * Math.min(14, 0.16 * core);

    const sources = spread(sourceCount).map((y) => ({ x: 1, y: y - 26, w: chipW, h: 52 }));
    const dests = spread(destCount).map((y) => ({ x: width - 1 - chipW, y: y - 26, w: chipW, h: 52 }));
    const inCurves = sources.map((box, index) =>
      buildCurve(
        { x: box.x + box.w, y: box.y + box.h / 2 },
        { x: center.x - core / 2, y: center.y + fan(index, sourceCount) },
        "x",
        center,
      ),
    );
    const outCurves = dests.map((box, index) =>
      buildCurve(
        { x: center.x + core / 2, y: center.y + fan(index, destCount) },
        { x: box.x, y: box.y + box.h / 2 },
        "x",
        undefined,
        center,
      ),
    );
    return { w: width, h: height, stacked, core, c: center, sources, dests, inCurves, outCurves };
  }

  const height = Math.round(clamp(1.24 * width, 440, 560));
  const center = { x: Math.round(width / 2), y: Math.round(height / 2) };
  const columns = (count: number) => {
    const columnW = (width - 2 - 8 * (count - 1)) / count;
    return Array.from({ length: count }, (_, index) => {
      const x = Math.round(1 + index * (columnW + 8));
      return { x, w: Math.round(1 + index * (columnW + 8) + columnW) - x };
    });
  };
  const fan = (index: number, count: number) => (count === 1 ? 0 : (index / (count - 1) - 0.5) * 28);

  const sources = columns(sourceCount).map((col) => ({ x: col.x, y: 1, w: col.w, h: 64 }));
  const dests = columns(destCount).map((col) => ({ x: col.x, y: height - 1 - 64, w: col.w, h: 64 }));
  const inCurves = sources.map((box, index) =>
    buildCurve(
      { x: box.x + box.w / 2, y: box.y + box.h },
      { x: center.x + fan(index, sourceCount), y: center.y - 42 },
      "y",
      center,
    ),
  );
  const outCurves = dests.map((box, index) =>
    buildCurve(
      { x: center.x + fan(index, destCount), y: center.y + 42 },
      { x: box.x + box.w / 2, y: box.y },
      "y",
      undefined,
      center,
    ),
  );
  return { w: width, h: height, stacked, core: 84, c: center, sources, dests, inCurves, outCurves };
}

/** Even thinning: share 0.34 sends about every third record. */
const takesShare = (seq: number, share: number) => share >= 1 || Math.floor((seq + 1) * share) > Math.floor(seq * share);

type DomRefs = {
  raw: (SVGGElement | null)[];
  rawDot: (SVGRectElement | null)[];
  rawDone: (SVGRectElement | null)[];
  rawTrail: (SVGPathElement | null)[];
  out: (SVGGElement | null)[][];
  outTrail: (SVGPathElement | null)[][];
  srcPort: (SVGCircleElement | null)[];
  dstPort: (SVGCircleElement | null)[];
  srcChip: (HTMLDivElement | null)[];
  dstChip: (HTMLDivElement | null)[];
  ring: SVGGElement | null;
  pulse: SVGRectElement | null;
  core: HTMLDivElement | null;
  count: HTMLSpanElement | null;
};

const emptyDomRefs = (): DomRefs => ({
  raw: [],
  rawDot: [],
  rawDone: [],
  rawTrail: [],
  out: [],
  outTrail: [],
  srcPort: [],
  dstPort: [],
  srcChip: [],
  dstChip: [],
  ring: null,
  pulse: null,
  core: null,
  count: null,
});

function Mark({ node }: { node: DataFlowNode }) {
  const { icon, color } = node;
  if (icon == null) return null;
  if (typeof icon === "string") {
    return /^(\/|\.|https?:|data:|blob:)/.test(icon) ? (
      <img className={styles.mark} src={icon} alt="" draggable={false} />
    ) : (
      <svg className={styles.mark} viewBox="0 0 24 24" aria-hidden="true">
        <path d={icon} fill={color ?? "currentColor"} />
      </svg>
    );
  }
  return (
    <span className={styles.mark} aria-hidden="true">
      {icon}
    </span>
  );
}

export function DataFlow({
  sources = DEFAULT_SOURCES,
  destinations = DEFAULT_DESTINATIONS,
  core,
  speed = 1,
  paused = false,
  accent,
  label,
  caption,
  className,
  style,
}: DataFlowProps) {
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  const reduced = Boolean(useReducedMotion()) && mounted;

  const stageRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);

  const coreLabel = core?.label ?? "Transform";
  const coreDetail = core?.detail ?? "Validates, dedupes and enriches each record";
  const countLabel = core?.countLabel ?? "processed";
  const countStart = core?.countStart ?? 12480;

  const sourceCount = Math.max(1, sources.length);
  const destCount = Math.max(1, destinations.length);

  const geometry = useMemo(
    () => (width > 0 ? buildGeometry(width, sourceCount, destCount) : null),
    [width, sourceCount, destCount],
  );

  const slots = useMemo<Slot[]>(() => {
    const order =
      sourceCount === 3 ? SLOT_ORDER : Array.from({ length: Math.max(6, 2 * sourceCount) }, (_, index) => index % sourceCount);
    return order.map((src, index) => ({
      src,
      at: (CYCLE * index) / order.length,
      pace: 1 + (((5 * index) % 7) - 3) * 0.025,
    }));
  }, [sourceCount]);

  const shares = useMemo(() => destinations.map((destination) => clamp(destination.share ?? 1, 0, 1)), [destinations]);

  const dom = useRef<DomRefs>(emptyDomRefs());
  const anim = useRef({
    time: BASE_TIME,
    rate: Number.NaN,
    rateV: 0,
    spin: 0,
    coreHit: 0,
    frame: 0,
    running: false,
    visible: true,
    lastCount: -1,
    cache: new Map<Element, Record<string, string>>(),
  });
  const params = useRef({ geometry, slots, shares, target: 1, reduced, countStart });

  const target = paused ? 0 : speed * (hovered ? 0.7 : 1);

  useLayoutEffect(() => {
    params.current = { geometry, slots, shares, target, reduced, countStart };
  });

  /** Write once: skip the DOM when the cached value already matches. */
  const write = useCallback((el: Element | null | undefined, name: string, value: string) => {
    if (!el) return;
    const cache = anim.current.cache;
    let entry = cache.get(el);
    if (!entry) {
      entry = {};
      cache.set(el, entry);
    }
    if (entry[name] === value) return;
    entry[name] = value;
    if (name.startsWith("--")) (el as HTMLElement | SVGElement).style.setProperty(name, value);
    else el.setAttribute(name, value);
  }, []);

  const draw = useCallback(
    (time: number, still: boolean) => {
      const { geometry: geo, slots: route, shares: take, countStart: start } = params.current;
      if (!geo) return;
      const refs = dom.current;
      const srcHit = Array(geo.inCurves.length).fill(0);
      const dstHit = Array(geo.outCurves.length).fill(0);
      let coreAt = -1;
      let added = 0;
      const cycles = (at: number, pace: number, span: number) =>
        Math.max(0, Math.floor((span - at - 1.75 * pace - 0.55) / CYCLE) + 1);

      route.forEach((slot, index) => {
        const inDur = 1.75 * slot.pace;
        const outDur = 1.85 * slot.pace;
        const curve = geo.inCurves[slot.src];
        const raw = refs.raw[index];
        const trail = refs.rawTrail[index];

        added += cycles(slot.at, slot.pace, time) - cycles(slot.at, slot.pace, BASE_TIME);

        if (still) {
          const first = route.findIndex((other) => other.src === slot.src) === index;
          if (first && curve) {
            const point = sampleCurve(curve, 0.56 * curve.edge);
            write(raw, "transform", `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`);
            write(refs.rawDot[index], "opacity", "1");
            write(refs.rawDone[index], "opacity", "0");
          }
          write(raw, "opacity", first ? "1" : "0");
          write(trail, "opacity", "0");
          geo.outCurves.forEach((outCurve, outIndex) => {
            const active = index === outIndex % route.length;
            const group = refs.out[index]?.[outIndex];
            if (active) {
              const point = sampleCurve(outCurve, outCurve.edge + (outCurve.len - outCurve.edge) * 0.5);
              write(group, "transform", `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`);
            }
            write(group, "opacity", active ? "1" : "0");
            write(refs.outTrail[index]?.[outIndex], "opacity", "0");
          });
          return;
        }

        const local = time - slot.at;
        const cycle = Math.floor(local / CYCLE);
        const leg = local - CYCLE * cycle;
        const seq = cycle * route.length + index;

        srcHit[slot.src] = Math.max(
          srcHit[slot.src],
          leg < 0.12 ? ease(leg / 0.12) : (1 - clamp((leg - 0.12) / 0.6, 0, 1)) ** 2,
        );

        const release = inDur + 0.55 + 0.93 * outDur;
        geo.outCurves.forEach((_, outIndex) => {
          if (!takesShare(seq, take[outIndex] ?? 1)) return;
          const since = leg - release;
          const fade =
            since < -0.12 ? 0 : since < 0 ? 1 + since / 0.12 : (1 - clamp(since / 0.6, 0, 1)) ** 2;
          dstHit[outIndex] = Math.max(dstHit[outIndex], fade);
        });

        if (leg >= inDur) coreAt = coreAt < 0 ? leg - inDur : Math.min(coreAt, leg - inDur);

        const clearOut = () => {
          geo.outCurves.forEach((_, outIndex) => {
            write(refs.out[index]?.[outIndex], "opacity", "0");
            write(refs.outTrail[index]?.[outIndex], "opacity", "0");
          });
        };

        if (!curve || leg >= inDur + 0.55 + outDur) {
          write(raw, "opacity", "0");
          write(trail, "opacity", "0");
          clearOut();
          return;
        }

        if (leg < inDur + 0.55) {
          let x = 0;
          let y = 0;
          let scale = 1;
          let done = 0;
          let opacity = 0;
          clearOut();
          if (leg < inDur) {
            const distance = ease(leg / inDur) * curve.len;
            ({ x, y } = sampleCurve(curve, distance));
            opacity = clamp(leg / 0.18, 0, 1);
            scale = 0.55 + 0.45 * ease(leg / 0.3);
            done = 0;
            const tailStart = Math.min(distance, curve.edge);
            const tailLen = Math.min(42, tailStart);
            write(trail, "stroke-dasharray", `${((tailLen / curve.len) * 1000).toFixed(2)} 2000`);
            write(trail, "stroke-dashoffset", `${-(1000 * ((tailStart - tailLen) / curve.len)).toFixed(2)}`);
            write(
              trail,
              "opacity",
              clamp(Math.min(leg / 0.3, (curve.edge - (distance - 42)) / 42), 0, 1).toFixed(3),
            );
          } else {
            const morph = ease((leg - inDur) / 0.55);
            x = geo.c.x;
            y = geo.c.y;
            opacity = 1;
            scale = 1 + 0.3 * Math.sin(Math.PI * morph);
            done = morph;
            write(trail, "opacity", "0");
          }
          write(raw, "transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(3)})`);
          write(raw, "opacity", opacity.toFixed(3));
          write(refs.rawDot[index], "opacity", (1 - done).toFixed(3));
          write(refs.rawDone[index], "opacity", done.toFixed(3));
          return;
        }

        write(raw, "opacity", "0");
        write(trail, "opacity", "0");

        const progress = (leg - inDur - 0.55) / outDur;
        const middle = Math.floor(geo.outCurves.length / 2);
        const carrier = takesShare(seq, take[middle] ?? 1)
          ? middle
          : geo.outCurves.findIndex((_, outIndex) => takesShare(seq, take[outIndex] ?? 1));

        geo.outCurves.forEach((outCurve, outIndex) => {
          const group = refs.out[index]?.[outIndex];
          const outTrail = refs.outTrail[index]?.[outIndex];
          if (!takesShare(seq, take[outIndex] ?? 1)) {
            write(group, "opacity", "0");
            write(outTrail, "opacity", "0");
            return;
          }
          const distance = ease(progress) * outCurve.len;
          const point = sampleCurve(outCurve, distance);
          const shrink = clamp((progress - 0.9) / 0.1, 0, 1);
          write(
            group,
            "transform",
            `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)}) scale(${(1 - 0.6 * shrink).toFixed(3)})`,
          );
          write(
            group,
            "opacity",
            ((1 - shrink) *
              (outIndex === carrier ? 1 : ease(clamp(distance / (1.15 * outCurve.edge), 0, 1)))).toFixed(3),
          );
          const tailLen = Math.min(42, Math.max(0, distance - outCurve.edge));
          write(outTrail, "stroke-dasharray", `${((tailLen / outCurve.len) * 1000).toFixed(2)} 2000`);
          write(outTrail, "stroke-dashoffset", `${-(1000 * ((distance - tailLen) / outCurve.len)).toFixed(2)}`);
          write(outTrail, "opacity", clamp((1 - progress) / 0.18, 0, 1).toFixed(3));
        });
      });

      const hit = coreAt >= 0 && coreAt < 0.8 ? coreAt / 0.8 : -1;
      if (hit >= 0) {
        write(
          refs.pulse,
          "transform",
          `translate(${geo.c.x} ${geo.c.y}) scale(${(1 + 0.16 * ease(Math.min(1, 1.3 * hit))).toFixed(4)})`,
        );
        write(refs.pulse, "opacity", (0.5 * (1 - hit) ** 2).toFixed(3));
      } else {
        write(refs.pulse, "opacity", "0");
      }
      anim.current.coreHit = hit >= 0 ? (1 - hit) ** 2 : 0;
      write(refs.core, "--hit", anim.current.coreHit.toFixed(3));
      refs.srcChip.forEach((chip, index) => write(chip, "--hit", (srcHit[index] ?? 0).toFixed(3)));
      refs.dstChip.forEach((chip, index) => write(chip, "--hit", (dstHit[index] ?? 0).toFixed(3)));
      refs.srcPort.forEach((port, index) => write(port, "fill-opacity", (srcHit[index] ?? 0).toFixed(3)));
      refs.dstPort.forEach((port, index) => write(port, "fill-opacity", (dstHit[index] ?? 0).toFixed(3)));
      write(
        refs.ring,
        "transform",
        `translate(${geo.c.x} ${geo.c.y}) rotate(${(still ? 0 : anim.current.spin % 360).toFixed(2)})`,
      );

      const total = start + (still ? 0 : added);
      if (refs.count && total !== anim.current.lastCount) {
        anim.current.lastCount = total;
        refs.count.textContent = formatCount(total);
      }
    },
    [write],
  );

  const start = useCallback(() => {
    const state = anim.current;
    if (state.running || !state.visible || params.current.reduced) return;
    state.running = true;
    let last = performance.now();
    const step = (now: number) => {
      if (!state.visible || params.current.reduced) {
        state.running = false;
        return;
      }
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      const goal = params.current.target;
      if (Number.isNaN(state.rate)) state.rate = goal;
      state.rateV += (40 * (goal - state.rate) - 2 * Math.sqrt(40) * state.rateV) * dt;
      state.rate += state.rateV * dt;
      if (Math.abs(goal - state.rate) < 1e-4 && Math.abs(state.rateV) < 1e-4) {
        state.rate = goal;
        state.rateV = 0;
      }
      state.time += dt * state.rate;
      state.spin += dt * state.rate * (14 + 60 * state.coreHit);
      draw(state.time, false);
      if ((state.rate === 0 && goal === 0) || !state.visible || params.current.reduced) {
        state.running = false;
        return;
      }
      state.frame = requestAnimationFrame(step);
    };
    state.frame = requestAnimationFrame(step);
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
    anim.current.cache = new Map();
    anim.current.lastCount = -1;
    draw(anim.current.time, reduced);
    if (!reduced) start();
  }, [geometry, slots, shares, reduced, target, draw, start]);

  useEffect(() => {
    const stage = stageRef.current;
    const state = anim.current;
    if (!stage) return;
    const stop = () => {
      cancelAnimationFrame(state.frame);
      state.running = false;
    };
    const observer = new IntersectionObserver(([entry]) => {
      state.visible = entry.isIntersecting && !document.hidden;
      if (state.visible) start();
      else stop();
    });
    const onVisibility = () => {
      state.visible = !document.hidden;
      if (state.visible) start();
      else stop();
    };
    observer.observe(stage);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [start]);

  const sourceIds = sources.map(keyOf);
  const destIds = destinations.map(keyOf);
  const activeSource = hovered?.startsWith("s:") ? sourceIds.indexOf(hovered.slice(2)) : -1;
  const activeDest = hovered?.startsWith("d:") ? destIds.indexOf(hovered.slice(2)) : -1;
  const coreActive = hovered === "core";

  const humanize = (list: DataFlowNode[]) => {
    const names = list.map((node) => node.label.toLowerCase());
    return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "");
  };

  const ariaLabel =
    label ??
    `Data flow. Records from ${humanize(sources)} stream into ${coreLabel.toLowerCase()}, which turns each raw record into a clean one and fans it out to ${humanize(destinations)}.`;

  const hover = (key: string) => ({
    onPointerEnter: (event: ReactPointerEvent) => {
      if (event.pointerType === "mouse") setHovered(key);
    },
    onPointerLeave: () => setHovered((current) => (current === key ? null : current)),
  });

  const chip = (node: DataFlowNode, box: Box, side: "src" | "dst", index: number) => {
    const key = `${side === "src" ? "s" : "d"}:${keyOf(node)}`;
    const on = hovered === key;
    return (
      <div
        key={key}
        ref={(element) => {
          (side === "src" ? dom.current.srcChip : dom.current.dstChip)[index] = element;
        }}
        className={styles.chip}
        data-side={side}
        data-on={on ? "true" : undefined}
        data-dim={
          (side === "src" && activeSource >= 0 && !on) || (side === "dst" && activeDest >= 0 && !on) ? "true" : undefined
        }
        style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
        {...hover(key)}
      >
        <Mark node={node} />
        <span className={styles.text}>
          <span className={styles.label}>{node.label}</span>
          {node.meta ? <span className={styles.meta}>{node.meta}</span> : null}
        </span>
        {node.detail ? (
          <span className={styles.tag} aria-hidden="true">
            {node.detail}
          </span>
        ) : null}
      </div>
    );
  };

  const rootStyle: CSSProperties = accent ? ({ ...style, "--flow-accent": accent } as CSSProperties) : (style ?? {});

  return (
    <figure
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={rootStyle}
      data-ready={geometry ? "true" : undefined}
      data-layout={geometry?.stacked ? "stack" : "row"}
    >
      <div
        ref={stageRef}
        className={styles.stage}
        role="img"
        aria-label={ariaLabel}
        data-focus={hovered ? "true" : undefined}
        style={geometry ? { height: geometry.h } : undefined}
      >
        {geometry ? (
          <>
            <svg
              className={styles.layer}
              viewBox={`0 0 ${geometry.w} ${geometry.h}`}
              width={geometry.w}
              height={geometry.h}
              aria-hidden="true"
            >
              {geometry.inCurves.map((curve, index) => (
                <path
                  key={`in-${index}`}
                  className={styles.path}
                  d={curve.d}
                  data-on={index === activeSource || coreActive ? "true" : undefined}
                />
              ))}
              {geometry.outCurves.map((curve, index) => (
                <path
                  key={`out-${index}`}
                  className={styles.path}
                  d={curve.d}
                  data-on={index === activeDest || coreActive ? "true" : undefined}
                />
              ))}
            </svg>

            {sources.map((node, index) => geometry.sources[index] && chip(node, geometry.sources[index], "src", index))}
            {destinations.map((node, index) => geometry.dests[index] && chip(node, geometry.dests[index], "dst", index))}

            <div
              ref={(element) => {
                dom.current.core = element;
              }}
              className={styles.core}
              data-on={coreActive ? "true" : undefined}
              style={{
                left: geometry.c.x - geometry.core / 2,
                top: geometry.c.y - geometry.core / 2,
                width: geometry.core,
                height: geometry.core,
              }}
              {...hover("core")}
            >
              <span className={styles.tag} data-place="above" aria-hidden="true">
                {coreDetail}
              </span>
            </div>

            <div
              className={styles.caption}
              data-place={geometry.stacked ? "side" : "below"}
              style={
                geometry.stacked
                  ? {
                      left: geometry.c.x + geometry.core / 2 + 14,
                      top: geometry.c.y,
                      maxWidth: geometry.w - (geometry.c.x + geometry.core / 2 + 14) - 4,
                    }
                  : { left: geometry.c.x, top: geometry.c.y + geometry.core / 2 + 12 }
              }
            >
              <span className={styles.label}>{coreLabel}</span>
              <span className={styles.meta}>
                <span
                  ref={(element) => {
                    dom.current.count = element;
                  }}
                  className={styles.num}
                >
                  {formatCount(countStart)}
                </span>{" "}
                {countLabel}
              </span>
            </div>

            <svg
              className={styles.layer}
              viewBox={`0 0 ${geometry.w} ${geometry.h}`}
              width={geometry.w}
              height={geometry.h}
              aria-hidden="true"
            >
              <g
                ref={(element) => {
                  dom.current.ring = element;
                }}
                transform={`translate(${geometry.c.x} ${geometry.c.y})`}
              >
                <circle className={styles.ring} r={0.24 * geometry.core} />
              </g>
              <rect
                ref={(element) => {
                  dom.current.pulse = element;
                }}
                className={styles.pulse}
                x={-geometry.core / 2}
                y={-geometry.core / 2}
                width={geometry.core}
                height={geometry.core}
                rx={0.28 * geometry.core}
                transform={`translate(${geometry.c.x} ${geometry.c.y})`}
                opacity={0}
              />
              {geometry.sources.map((box, index) => {
                const port = geometry.stacked ? { x: box.x + box.w / 2, y: box.y + box.h } : { x: box.x + box.w, y: box.y + box.h / 2 };
                return (
                  <g key={`sp-${index}`} className={styles.slot} data-dim={activeSource >= 0 && activeSource !== index ? "true" : undefined}>
                    <circle className={styles.port} cx={port.x} cy={port.y} r={3.5} />
                    <circle
                      ref={(element) => {
                        dom.current.srcPort[index] = element;
                      }}
                      className={styles.portHit}
                      cx={port.x}
                      cy={port.y}
                      r={2.25}
                      fillOpacity={0}
                    />
                  </g>
                );
              })}
              {geometry.dests.map((box, index) => {
                const port = geometry.stacked ? { x: box.x + box.w / 2, y: box.y } : { x: box.x, y: box.y + box.h / 2 };
                return (
                  <g key={`dp-${index}`} className={styles.slot} data-dim={activeDest >= 0 && activeDest !== index ? "true" : undefined}>
                    <circle className={styles.port} cx={port.x} cy={port.y} r={3.5} />
                    <circle
                      ref={(element) => {
                        dom.current.dstPort[index] = element;
                      }}
                      className={styles.portHit}
                      cx={port.x}
                      cy={port.y}
                      r={2.25}
                      fillOpacity={0}
                    />
                  </g>
                );
              })}
              {slots.map((slot, index) => (
                <g key={`slot-${index}`} className={styles.slot} data-dim={activeSource >= 0 && slot.src !== activeSource ? "true" : undefined}>
                  {geometry.inCurves[slot.src] ? (
                    <path
                      ref={(element) => {
                        dom.current.rawTrail[index] = element;
                      }}
                      className={styles.trailRaw}
                      d={geometry.inCurves[slot.src].d}
                      pathLength={1000}
                      opacity={0}
                    />
                  ) : null}
                  {geometry.outCurves.map((curve, outIndex) => (
                    <g key={`o-${outIndex}`} data-dim={activeDest >= 0 && outIndex !== activeDest ? "true" : undefined} className={styles.slot}>
                      <path
                        ref={(element) => {
                          (dom.current.outTrail[index] ??= [])[outIndex] = element;
                        }}
                        className={styles.trailDone}
                        d={curve.d}
                        pathLength={1000}
                        opacity={0}
                      />
                      <g
                        ref={(element) => {
                          (dom.current.out[index] ??= [])[outIndex] = element;
                        }}
                        opacity={0}
                      >
                        <rect className={styles.done} x={-4.5} y={-4.5} width={9} height={9} rx={2.5} />
                      </g>
                    </g>
                  ))}
                  <g
                    ref={(element) => {
                      dom.current.raw[index] = element;
                    }}
                    opacity={0}
                  >
                    <rect
                      ref={(element) => {
                        dom.current.rawDot[index] = element;
                      }}
                      className={styles.raw}
                      x={-4}
                      y={-4}
                      width={8}
                      height={8}
                      rx={4}
                    />
                    <rect
                      ref={(element) => {
                        dom.current.rawDone[index] = element;
                      }}
                      className={styles.done}
                      x={-4.5}
                      y={-4.5}
                      width={9}
                      height={9}
                      rx={2.5}
                      opacity={0}
                    />
                  </g>
                </g>
              ))}
            </svg>
          </>
        ) : null}
      </div>
      {caption ? <figcaption className={styles.figcaption}>{caption}</figcaption> : null}
    </figure>
  );
}

export default DataFlow;
