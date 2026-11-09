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
import { Landmark, Nfc, Store } from "lucide-react";
import { useReducedMotion } from "motion/react";

import styles from "./payment-flow.module.css";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export interface PaymentFlowNode {
  /** Chip title, e.g. "Stripe". */
  label: string;
  /** Secondary line, e.g. "Processor". */
  meta?: string;
  /** Hover tag copy — omitted nodes never show a tag. */
  detail?: string;
  /** Lucide element, inline SVG, an `<img>` URL, or an SVG path string. */
  icon?: ReactNode | string;
  /** Fill for the raw path-string icon form. */
  color?: string;
}

export interface PaymentFlowNodes {
  terminal?: Partial<PaymentFlowNode>;
  processor?: Partial<PaymentFlowNode>;
  network?: Partial<PaymentFlowNode>;
  issuer?: Partial<PaymentFlowNode>;
  merchant?: Partial<PaymentFlowNode>;
}

export interface PaymentFlowLabels {
  authorization?: string;
  settlement?: string;
  settlementTime?: string;
  approved?: string;
}

export interface PaymentFlowProps {
  nodes?: PaymentFlowNodes;
  /** Charged total, in major currency units. */
  amount?: number;
  /** Processor fee. Clamped to `0…amount`. */
  fee?: number;
  /** Merchant balance the payout lands in. */
  balance?: number;
  currency?: string;
  locale?: string;
  /** Stated authorisation latency, drives the first step's meta readout. */
  authorizationMs?: number;
  labels?: PaymentFlowLabels;
  hideSteps?: boolean;
  speed?: number;
  paused?: boolean;
  /** Overrides `--pf-accent` for the wires, pills and step fills. */
  accent?: string;
  /** Replaces the generated accessible description. */
  label?: string;
  caption?: string;
  className?: string;
  style?: CSSProperties;
}

type Point = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };
type LineSeg = { kind: "line"; a: Point; b: Point };
type QuadSeg = { kind: "quad"; a: Point; c: Point; b: Point };
type Segment = LineSeg | QuadSeg;

export interface FlowCurve {
  d: string;
  xs: Float32Array;
  ys: Float32Array;
  acc: Float32Array;
  len: number;
}

export interface FlowGeometry {
  w: number;
  h: number;
  narrow: boolean;
  compact: boolean;
  chips: Box[];
  merchant: Box;
  centers: Point[];
  auth: FlowCurve;
  rail: FlowCurve;
  stops: number[];
  railStops: number[];
  segs: string[];
  railSegs: string[];
  stubs: { a: Point; b: Point }[];
  waypoints: Point[];
  ports: Point[];
}

type PhaseState = "idle" | "active" | "done" | "ok";
type Phase = { at: number; state: PhaseState; text: string | null };

interface Hop {
  pill: number;
  t0: number;
  dur: number;
  kind: "fwd" | "back" | "rail";
  k: number;
}

export interface FlowTimeline {
  hops: Hop[];
  life: { from: number; to: number }[];
  phases: Phase[][];
  changes: number[][];
  T: number;
  end: number;
  approve: number;
  approved: number;
  fadeAuth: number;
  s0: number;
  atNet: number;
  atProc: number;
  swap: number;
  settled: number;
  still: number;
}

/* -------------------------------------------------------------------------- */
/*  Defaults                                                                  */
/* -------------------------------------------------------------------------- */

const subscribeNever = () => () => {};

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));
const easeInOut = (value: number) => 0.5 - Math.cos(Math.PI * clamp(value)) / 2;
const easeOutCubic = (value: number) => 1 - (1 - clamp(value)) ** 3;
const fmt = (value: number) => value.toFixed(2);

const lineD = (a: Point, b: Point) => `M${fmt(a.x)} ${fmt(a.y)} L${fmt(b.x)} ${fmt(b.y)}`;

/** Lucide `nfc`, inlined so the mark stays crisp at 16px. */
const NFC_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
    <path d="M6 8.32a7.43 7.43 0 0 1 0 7.36" />
    <path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58" />
    <path d="M12.91 4.1a15.91 15.91 0 0 1 .01 15.8" />
    <path d="M16.37 2a20.16 20.16 0 0 1 0 20" />
  </svg>
);

const MC_ICON = (
  <svg viewBox="2 2 20 20" aria-hidden="true">
    <circle cx="9" cy="12" r="6.5" fill="#EB001B" />
    <circle cx="15" cy="12" r="6.5" fill="#F79E1B" />
    <path d="M12 6.234A6.5 6.5 0 0 1 12 17.766A6.5 6.5 0 0 1 12 6.234Z" fill="#FF5F00" />
  </svg>
);

const STRIPE_PATH =
  "M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z";

const DEFAULT_NODES: [PaymentFlowNode, PaymentFlowNode, PaymentFlowNode, PaymentFlowNode, PaymentFlowNode] = [
  {
    label: "Checkout",
    meta: "Tap to pay",
    detail: "A card or phone is tapped on the reader",
    icon: NFC_ICON,
  },
  {
    label: "Stripe",
    meta: "Processor",
    detail: "Checks risk and forwards the request",
    icon: STRIPE_PATH,
    color: "#635BFF",
  },
  {
    label: "Mastercard",
    meta: "Card network",
    detail: "Routes it to the bank that issued the card",
    icon: MC_ICON,
  },
  {
    label: "Bank",
    meta: "Card issuer",
    detail: "Checks the balance and holds the funds",
    icon: <Landmark size={16} strokeWidth={1.75} />,
  },
  {
    label: "Your balance",
    detail: "Receives the payout, minus fees",
    icon: <Store size={16} strokeWidth={1.75} />,
  },
];

/** Which wires light up while a chip is hovered. */
const FOCUS_WIRES: { seg: number[]; rail: number[]; stub: number[] }[] = [
  { seg: [0], rail: [], stub: [] },
  { seg: [0, 1], rail: [], stub: [1] },
  { seg: [1, 2], rail: [], stub: [0] },
  { seg: [2], rail: [0], stub: [] },
  { seg: [], rail: [2], stub: [] },
];

/* -------------------------------------------------------------------------- */
/*  Geometry                                                                  */
/* -------------------------------------------------------------------------- */

/** Flattens a segment list into a path string plus arc-length samples. */
export function buildPath(segments: Segment[]): { curve: FlowCurve; marks: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  const acc: number[] = [];
  const marks: number[] = [];
  let d = "";

  const push = (x: number, y: number) => {
    const last = xs.length;
    acc.push(last ? acc[last - 1] + Math.hypot(x - xs[last - 1], y - ys[last - 1]) : 0);
    xs.push(x);
    ys.push(y);
  };

  segments.forEach((segment, index) => {
    if (index === 0) {
      d = `M${fmt(segment.a.x)} ${fmt(segment.a.y)}`;
      push(segment.a.x, segment.a.y);
    }
    if (segment.kind === "line") {
      d += ` L${fmt(segment.b.x)} ${fmt(segment.b.y)}`;
      push(segment.b.x, segment.b.y);
    } else {
      d += ` Q${fmt(segment.c.x)} ${fmt(segment.c.y)} ${fmt(segment.b.x)} ${fmt(segment.b.y)}`;
      for (let step = 1; step <= 12; step += 1) {
        const t = step / 12;
        const inv = 1 - t;
        push(
          inv * inv * segment.a.x + 2 * inv * t * segment.c.x + t * t * segment.b.x,
          inv * inv * segment.a.y + 2 * inv * t * segment.c.y + t * t * segment.b.y,
        );
      }
    }
    marks.push(acc[acc.length - 1]);
  });

  return {
    curve: {
      d,
      xs: Float32Array.from(xs),
      ys: Float32Array.from(ys),
      acc: Float32Array.from(acc),
      len: acc[acc.length - 1] || 1,
    },
    marks,
  };
}

/** Point at `distance` along a flattened curve, by binary search on `acc`. */
export function sampleCurve(curve: FlowCurve, distance: number): Point {
  const { acc, xs, ys } = curve;
  const target = clamp(distance, 0, curve.len);
  let lo = 0;
  let hi = acc.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (acc[mid] < target) lo = mid;
    else hi = mid;
  }
  const span = acc[hi] - acc[lo] || 1;
  const t = (target - acc[lo]) / span;
  return { x: xs[lo] + (xs[hi] - xs[lo]) * t, y: ys[lo] + (ys[hi] - ys[lo]) * t };
}

function buildGeometry(w: number): FlowGeometry {
  const narrow = w < 700;
  const chips: Box[] = [];
  const stubs: { a: Point; b: Point }[] = [];
  const waypoints: Point[] = [];
  let merchant: Box;
  let height: number;
  let railSegments: Segment[];

  if (narrow) {
    const chipW = 2 * Math.round(Math.min(w * (w < 300 ? 0.56 : 0.5), 240) / 2);
    for (let i = 0; i < 4; i += 1) {
      chips.push({ x: 1, y: 10 + 108 * i, w: chipW, h: 56 });
    }
    const mx = 1 + chipW + 14;
    merchant = { x: mx, y: 10, w: w - 1 - mx, h: 56 };
    const cx = Math.round(merchant.x + merchant.w / 2);
    const cy = (i: number) => chips[i].y + 28;
    const upper = { x: cx, y: cy(2) };
    const lower = { x: cx, y: cy(1) };
    waypoints.push(upper, lower);
    stubs.push(
      { a: { x: 1 + chipW, y: upper.y }, b: { x: cx - 4, y: upper.y } },
      { a: { x: 1 + chipW, y: lower.y }, b: { x: cx - 4, y: lower.y } },
    );
    const anchor = cy(3);
    railSegments = [
      { kind: "line", a: { x: 1 + chipW / 2, y: anchor }, b: { x: cx - 18, y: anchor } },
      {
        kind: "quad",
        a: { x: cx - 18, y: anchor },
        c: { x: cx, y: anchor },
        b: { x: cx, y: anchor - 18 },
      },
      { kind: "line", a: { x: cx, y: anchor - 18 }, b: upper },
      { kind: "line", a: upper, b: lower },
      { kind: "line", a: lower, b: { x: cx, y: 38 } },
    ];
    height = chips[3].y + 56 + 1;
  } else {
    const chipW = 2 * Math.round(clamp(0.18 * w, 150, 196) / 2);
    const gap = (w - 2 - 4 * chipW) / 3;
    for (let i = 0; i < 4; i += 1) {
      chips.push({ x: Math.round(1 + i * (chipW + gap)), y: 10, w: chipW, h: 60 });
    }
    merchant = { x: 1, y: 126, w: chipW, h: 60 };
    const centerOf = (box: Box) => box.x + box.w / 2;
    const baseY = merchant.y + 30;
    const dropX = centerOf(chips[3]);
    const upper = { x: centerOf(chips[2]), y: baseY };
    const lower = { x: centerOf(chips[1]), y: baseY };
    waypoints.push(upper, lower);
    stubs.push(
      { a: { x: upper.x, y: 70 }, b: { x: upper.x, y: baseY - 4 } },
      { a: { x: lower.x, y: 70 }, b: { x: lower.x, y: baseY - 4 } },
    );
    railSegments = [
      { kind: "line", a: { x: dropX, y: 40 }, b: { x: dropX, y: baseY - 18 } },
      {
        kind: "quad",
        a: { x: dropX, y: baseY - 18 },
        c: { x: dropX, y: baseY },
        b: { x: dropX - 18, y: baseY },
      },
      { kind: "line", a: { x: dropX - 18, y: baseY }, b: upper },
      { kind: "line", a: upper, b: lower },
      { kind: "line", a: lower, b: { x: centerOf(merchant), y: baseY } },
    ];
    height = merchant.y + 60 + 1;
  }

  const centers = chips.map((box) => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 }));
  const auth = buildPath(
    [0, 1, 2].map((i) => ({ kind: "line", a: centers[i], b: centers[i + 1] }) as LineSeg),
  );
  const rail = buildPath(railSegments);
  const segments = [0, 1, 2].map((i) => lineD(centers[i], centers[i + 1]));
  const railSegs = [
    buildPath(railSegments.slice(0, 3)).curve.d,
    lineD(railSegments[3].a, railSegments[3].b),
    lineD(railSegments[4].a, railSegments[4].b),
  ];

  const ports: Point[] = [];
  for (let i = 0; i < 3; i += 1) {
    const from = chips[i];
    const to = chips[i + 1];
    if (narrow) {
      ports.push(
        { x: centers[i].x, y: from.y + from.h },
        { x: centers[i + 1].x, y: to.y },
      );
    } else {
      ports.push({ x: from.x + from.w, y: centers[i].y }, { x: to.x, y: centers[i + 1].y });
    }
  }
  if (narrow) {
    ports.push(
      { x: chips[3].x + chips[3].w, y: centers[3].y },
      { x: merchant.x + merchant.w / 2, y: merchant.y + merchant.h },
    );
  } else {
    ports.push(
      { x: centers[3].x, y: chips[3].y + chips[3].h },
      { x: merchant.x + merchant.w, y: merchant.y + merchant.h / 2 },
    );
  }
  stubs.forEach((stub) => ports.push(stub.a));

  return {
    w,
    h: height,
    narrow,
    compact: merchant.w < 140,
    chips,
    merchant,
    centers,
    auth: auth.curve,
    rail: rail.curve,
    stops: [0, ...auth.marks],
    railStops: [rail.marks[2], rail.marks[3]],
    segs: segments,
    railSegs,
    stubs,
    waypoints,
    ports,
  };
}

/* -------------------------------------------------------------------------- */
/*  Timeline                                                                  */
/* -------------------------------------------------------------------------- */

const idlePhase = (text: string | null = null): Phase => ({ at: 0, state: "idle", text });

export function buildTimeline(): FlowTimeline {
  const hops: Hop[] = [];
  let t = 0.95;
  const forwardEnds: number[] = [];

  for (let k = 0; k < 3; k += 1) {
    hops.push({ pill: 0, t0: t, dur: 0.72, kind: "fwd", k });
    forwardEnds.push((t += 0.72));
    if (k < 2) t += 0.5;
  }

  const authStart = t;
  const approveAt = t + 0.9;
  t = approveAt;
  for (let k = 2; k >= 0; k -= 1) {
    hops.push({ pill: 1, t0: t, dur: 0.64, kind: "back", k });
    t += 0.64;
    if (k > 0) t += 0.16;
  }

  const approvedAt = t;
  const settleStart = approvedAt + 1.55;
  hops.push({ pill: 2, t0: (t = settleStart), dur: 1.17, kind: "rail", k: 0 });
  const atNet = (t += 1.17);
  hops.push({ pill: 2, t0: (t += 0.45), dur: 0.765, kind: "rail", k: 1 });
  const atProc = (t += 0.765);
  const swapAt = atProc + 0.08;
  hops.push({ pill: 3, t0: (t += 0.7), dur: 0.9, kind: "rail", k: 2 });
  const settledAt = (t += 0.9);
  const cycle = settledAt + 1.9 + 0.6;
  const endAt = cycle - 0.6;

  const life = [
    { from: 0.95, to: authStart },
    { from: approveAt, to: approvedAt },
    { from: settleStart, to: swapAt + 0.3 },
    { from: swapAt, to: settledAt },
  ];

  const phases: Phase[][] = [
    [
      idlePhase(),
      { at: 0.35, state: "active", text: "Card tapped" },
      { at: 1.2, state: "active", text: "Authorizing" },
      { at: approvedAt - 0.1, state: "ok", text: "Approved" },
    ],
    [
      idlePhase(),
      { at: forwardEnds[0] - 0.12, state: "active", text: "Checking risk" },
      { at: forwardEnds[0] + 0.5, state: "done", text: "Risk checked" },
      { at: atProc - 0.1, state: "active", text: "fee" },
      { at: atProc + 0.7, state: "done", text: "fee" },
    ],
    [
      idlePhase(),
      { at: forwardEnds[1] - 0.12, state: "active", text: "Routing" },
      { at: forwardEnds[1] + 0.5, state: "done", text: "Routed to bank" },
      { at: atNet - 0.1, state: "active", text: "Clearing" },
      { at: atNet + 0.45, state: "done", text: "Cleared" },
    ],
    [
      idlePhase(),
      { at: forwardEnds[2] - 0.12, state: "active", text: "Checking funds" },
      { at: approveAt, state: "ok", text: "Approved" },
      { at: approveAt + 0.9, state: "done", text: "Funds held" },
      { at: settleStart - 0.05, state: "active", text: "Settling" },
      { at: settleStart + 0.45, state: "ok", text: "Settled" },
    ],
    [
      idlePhase(),
      { at: swapAt + 0.3, state: "active", text: null },
      { at: settledAt - 0.08, state: "ok", text: null },
    ],
  ];
  phases.forEach((list) => list.push({ at: endAt, state: "idle", text: null }));

  /** Times at which each chip's status copy cross-fades. */
  const changes = phases.map((list) => {
    const times: number[] = [];
    let last = list[list.length - 1].text;
    for (const phase of list) {
      if (phase.text !== last) times.push(phase.at);
      last = phase.text;
    }
    return times;
  });

  return {
    hops,
    life,
    phases,
    changes,
    T: cycle,
    end: endAt,
    approve: approveAt,
    approved: approvedAt,
    fadeAuth: approvedAt + 1.1,
    s0: settleStart,
    atNet,
    atProc,
    swap: swapAt,
    settled: settledAt,
    still: swapAt + 0.3 + 0.15,
  };
}

/* -------------------------------------------------------------------------- */
/*  DOM plumbing                                                              */
/* -------------------------------------------------------------------------- */

interface DomRefs {
  pill: (HTMLSpanElement | null)[];
  authLit: SVGPathElement | null;
  okLit: SVGPathElement | null;
  railLit: SVGPathElement | null;
  tap: (SVGRectElement | null)[];
  waypoint: (SVGCircleElement | null)[];
  stub: (SVGPathElement | null)[];
  check: SVGGElement | null;
  chip: (HTMLDivElement | null)[];
  status: (HTMLSpanElement | null)[];
  step: (HTMLDivElement | null)[];
  stepMeta: HTMLSpanElement | null;
  fill: (HTMLSpanElement | null)[];
}

interface LoopState {
  t: number;
  rate: number;
  rateV: number;
  frame: number;
  running: boolean;
  visible: boolean;
  dims: { w: number; h: number }[];
  cache: Map<Element, Record<string, string>>;
  text: Map<Element, string>;
}

interface LatestState {
  geometry: FlowGeometry | null;
  timeline: FlowTimeline;
  target: number;
  reduced: boolean;
  nodes: PaymentFlowNode[];
  money: Intl.NumberFormat;
  gross: number;
  cut: number;
  net: number;
  balance: number;
  authorizationMs: number;
}

/** Renders a chip mark: element, `<img>` URL, or a bare SVG path string. */
function ChipMark({ node }: { node: PaymentFlowNode }) {
  const { icon, color } = node;
  if (icon === null || icon === undefined) return null;
  if (typeof icon === "string") {
    if (/^(\/|\.|https?:|data:|blob:)/.test(icon)) {
      return <img className={styles.mark} src={icon} alt="" draggable={false} />;
    }
    return (
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

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function PaymentFlow({
  nodes: nodeOverrides,
  amount = 42.5,
  fee = 1.53,
  balance = 1284.1,
  currency = "USD",
  locale = "en-US",
  authorizationMs = 1340,
  labels,
  hideSteps = false,
  speed = 1,
  paused = false,
  accent,
  label,
  caption,
  className,
  style,
}: PaymentFlowProps) {
  const reducedPreference = useReducedMotion();
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const still = Boolean(reducedPreference) && mounted;

  const stageRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);

  const nodes = useMemo<PaymentFlowNode[]>(
    () => [
      { ...DEFAULT_NODES[0], ...nodeOverrides?.terminal },
      { ...DEFAULT_NODES[1], ...nodeOverrides?.processor },
      { ...DEFAULT_NODES[2], ...nodeOverrides?.network },
      { ...DEFAULT_NODES[3], ...nodeOverrides?.issuer },
      { ...DEFAULT_NODES[4], ...nodeOverrides?.merchant },
    ],
    [nodeOverrides],
  );

  const money = useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency }),
    [locale, currency],
  );

  const gross = Math.max(0, amount);
  const cut = clamp(fee, 0, gross);
  const net = gross - cut;
  const approvedLabel = labels?.approved ?? "Approved";
  const authLabel = labels?.authorization ?? "Authorization";
  const settleLabel = labels?.settlement ?? "Settlement";
  const settleTime = labels?.settlementTime ?? "Next business day";

  const timeline = useMemo(() => buildTimeline(), []);
  const geometry = useMemo(() => (width > 0 ? buildGeometry(width) : null), [width]);

  const dom = useRef<DomRefs>({
    pill: [],
    authLit: null,
    okLit: null,
    railLit: null,
    tap: [],
    waypoint: [],
    stub: [],
    check: null,
    chip: [],
    status: [],
    step: [],
    stepMeta: null,
    fill: [],
  });

  const state = useRef<LoopState>({
    t: 0,
    rate: Number.NaN,
    rateV: 0,
    frame: 0,
    running: false,
    visible: true,
    dims: [
      { w: 64, h: 24 },
      { w: 96, h: 24 },
      { w: 64, h: 24 },
      { w: 64, h: 24 },
    ],
    cache: new Map(),
    text: new Map(),
  });

  const target = paused ? 0 : Math.max(0, speed) * (hovered !== null ? 0.6 : 1);

  const latest = useRef<LatestState>({
    geometry,
    timeline,
    target,
    reduced: still,
    nodes,
    money,
    gross,
    cut,
    net,
    balance,
    authorizationMs,
  });

  useLayoutEffect(() => {
    latest.current = {
      geometry,
      timeline,
      target,
      reduced: still,
      nodes,
      money,
      gross,
      cut,
      net,
      balance,
      authorizationMs,
    };
  });

  /** Attribute/style setter that skips writes when the value is unchanged. */
  const write = useCallback((el: Element | null, key: string, value: string) => {
    if (!el) return;
    const cache = state.current.cache;
    let entry = cache.get(el);
    if (!entry) {
      entry = {};
      cache.set(el, entry);
    }
    if (entry[key] === value) return;
    entry[key] = value;
    if (key.startsWith("style:")) (el as HTMLElement).style.setProperty(key.slice(6), value);
    else el.setAttribute(key, value);
  }, []);

  const writeText = useCallback((el: Element | null, value: string) => {
    if (!el) return;
    const cache = state.current.text;
    if (cache.get(el) === value) return;
    cache.set(el, value);
    el.textContent = value;
  }, []);

  const render = useCallback(
    (time: number, freeze = false) => {
      const {
        geometry: g,
        timeline: tl,
        nodes: list,
        money: format,
        cut: feeCut,
        net: payout,
        balance: balanceValue,
        authorizationMs: authMs,
      } = latest.current;
      if (!g) return;

      const refs = dom.current;
      const dims = state.current.dims;
      const cycle = tl.T;
      const u = ((time % cycle) + cycle) % cycle;
      const laps = Math.floor(time / cycle);

      /** Half a pill, plus the 1px breathing room baked into the layout. */
      const pillHalf = (index: number) => (g.narrow ? dims[index].h : dims[index].w) / 2 + 1;
      /** Half a chip box, along the axis the pill travels. */
      const chipHalf = (box: Box) => (g.narrow ? box.h : box.w) / 2;

      /** Distance along its curve for the pill currently on screen. */
      const travel = (pill: number): { s: number; rail: boolean } => {
        let current: Hop | null = null;
        let first: Hop | null = null;
        for (const hop of tl.hops) {
          if (hop.pill !== pill) continue;
          first ??= hop;
          if (hop.t0 <= u) current = hop;
        }
        const hop = current ?? first;
        if (!hop) return { s: 0, rail: false };

        const inset = chipHalf(g.chips[0]) - pillHalf(pill);
        let from: number;
        let to: number;
        if (hop.kind !== "rail") {
          const start = g.stops[hop.k] + inset;
          const end = g.stops[hop.k + 1] - inset;
          [from, to] = hop.kind === "fwd" ? [start, end] : [end, start];
        } else if (hop.k === 0) {
          from = chipHalf(g.chips[3]) - pillHalf(pill);
          to = g.railStops[0];
        } else if (hop.k === 1) {
          from = g.railStops[0];
          to = g.railStops[1];
        } else {
          from = g.railStops[1];
          to = g.rail.len - (chipHalf(g.merchant) - pillHalf(pill));
        }

        return {
          s: from + (to - from) * (current ? easeInOut((u - hop.t0) / hop.dur) : 0),
          rail: hop.kind === "rail",
        };
      };

      const tapBox = g.chips[0];
      refs.tap.forEach((el, index) => {
        const progress = (u - 0.35 - 0.2 * index) / 0.95;
        if (progress < 0 || progress >= 1 || freeze) {
          write(el, "opacity", "0");
          return;
        }
        const spread = 2 + 14 * easeOutCubic(progress);
        write(el, "x", fmt(tapBox.x - spread));
        write(el, "y", fmt(tapBox.y - spread));
        write(el, "width", fmt(tapBox.w + 2 * spread));
        write(el, "height", fmt(tapBox.h + 2 * spread));
        write(el, "rx", fmt(16 + spread));
        write(el, "opacity", (0.5 * clamp(progress / 0.08) * (1 - progress) ** 2).toFixed(3));
      });

      const positions: { s: number; rail: boolean }[] = [];
      for (let index = 0; index < 4; index += 1) {
        const el = refs.pill[index];
        const span = tl.life[index];
        const spot = travel(index);
        positions[index] = spot;
        if (!(u >= span.from && u <= span.to)) {
          write(el, "style:opacity", "0");
          continue;
        }
        const point = sampleCurve(spot.rail ? g.rail : g.auth, spot.s);
        let opacity = 1;
        let scale = 1;
        if (index === 2) {
          const handover = easeInOut((u - tl.swap) / 0.3);
          opacity = 1 - handover;
          scale = 1 - 0.12 * handover;
        }
        if (index === 3) {
          const handover = easeInOut((u - tl.swap) / 0.3);
          opacity = handover;
          scale = 0.88 + 0.12 * handover;
        }
        write(
          el,
          "style:transform",
          `translate(${fmt(point.x)}px, ${fmt(point.y)}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`,
        );
        write(el, "style:opacity", opacity.toFixed(3));
      }

      const authFade = freeze ? 0 : clamp((u - tl.fadeAuth) / 0.6);
      const authLen = g.auth.len;
      const forwardLit = u < 0.95 ? 0 : u >= tl.life[0].to ? authLen : positions[0].s;
      write(refs.authLit, "stroke-dasharray", `${fmt((forwardLit / authLen) * 1000)} 2000`);
      write(refs.authLit, "opacity", u < 0.95 ? "0" : (1 - authFade).toFixed(3));

      const backLit =
        u < tl.approve ? authLen : u >= tl.approved ? 0 : positions[1].s;
      write(refs.okLit, "stroke-dasharray", `0 ${fmt((backLit / authLen) * 1000)} 1000 2000`);
      write(refs.okLit, "opacity", u < tl.approve ? "0" : (1 - authFade).toFixed(3));

      const railLen = g.rail.len;
      const railLit =
        u < tl.s0
          ? 0
          : u >= tl.settled
            ? railLen
            : u >= tl.swap
              ? positions[3].s
              : positions[2].s;
      const railFade = clamp((u - tl.settled - 1.1) / 0.6);
      write(refs.railLit, "stroke-dasharray", `${fmt((railLit / railLen) * 1000)} 2000`);
      write(refs.railLit, "opacity", u < tl.s0 ? "0" : (1 - railFade).toFixed(3));

      const atRail = u >= tl.s0 && u < tl.settled + 1.1;
      [tl.atNet, tl.atProc].forEach((moment, index) => {
        const on = atRail && u >= moment - 0.08 ? "true" : "false";
        write(refs.waypoint[index], "data-lit", on);
        write(refs.stub[index], "data-lit", on);
      });

      const pop = (u - tl.approved) / 1.5;
      if (pop >= 0 && pop < 1 && !freeze) {
        const chip = g.chips[0];
        const spring = clamp(3.2 * pop) - 1;
        const scale = 0.55 + 0.45 * (1 + 2.1 * spring ** 3 + 1.1 * spring ** 2);
        write(
          refs.check,
          "transform",
          `translate(${fmt(chip.x + chip.w - 8)} ${fmt(chip.y + 1 - 4 * easeOutCubic(pop))}) scale(${scale.toFixed(3)})`,
        );
        write(refs.check, "opacity", Math.min(clamp(pop / 0.08), clamp((1 - pop) / 0.3)).toFixed(3));
      } else {
        write(refs.check, "opacity", "0");
      }

      const settle = u >= tl.settled ? easeInOut((u - tl.settled) / 0.9) : 0;
      list.forEach((node, index) => {
        const phases = tl.phases[index];
        let phase = phases[0];
        for (const candidate of phases) if (candidate.at <= u) phase = candidate;
        write(refs.chip[index], "data-state", phase.state);

        if (index === 4) {
          writeText(refs.status[index], format.format(balanceValue + payout * (laps + settle)));
          return;
        }

        writeText(
          refs.status[index],
          phase.text === "fee"
            ? `Fee ${format.format(feeCut)}`
            : (phase.text ?? node.meta ?? ""),
        );
        write(
          refs.status[index],
          "style:opacity",
          (freeze ? 1 : crossFade(tl.changes[index], u, cycle)).toFixed(3),
        );
      });

      const authProgress = clamp((u - 0.95) / (tl.approved - 0.95));
      const settleProgress = clamp((u - tl.s0) / (tl.settled - tl.s0));
      const dim = 1 - clamp((u - tl.end) / 0.4);
      write(refs.fill[0], "style:transform", `scaleX(${(authProgress * dim).toFixed(4)})`);
      write(refs.fill[1], "style:transform", `scaleX(${(settleProgress * dim).toFixed(4)})`);
      write(
        refs.step[0],
        "data-state",
        u >= tl.end ? "idle" : u >= tl.approved ? "done" : u >= 0.95 ? "active" : "idle",
      );
      write(
        refs.step[1],
        "data-state",
        u >= tl.end ? "idle" : u >= tl.settled ? "done" : u >= tl.s0 ? "active" : "idle",
      );
      writeText(
        refs.stepMeta,
        `${(((u >= tl.end ? 0 : authProgress) * authMs) / 1000).toFixed(2)} s`,
      );
    },
    [write, writeText],
  );

  const start = useCallback(() => {
    const loop = state.current;
    if (loop.running || !loop.visible || latest.current.reduced) return;
    loop.running = true;
    let previous = performance.now();

    const frame = (now: number) => {
      if (!loop.visible || latest.current.reduced) {
        loop.running = false;
        return;
      }
      const dt = clamp((now - previous) / 1000, 0, 0.05);
      previous = now;

      const goal = latest.current.target;
      if (Number.isNaN(loop.rate)) loop.rate = goal;
      loop.rateV += (40 * (goal - loop.rate) - 2 * Math.sqrt(40) * loop.rateV) * dt;
      loop.rate += loop.rateV * dt;
      if (Math.abs(goal - loop.rate) < 1e-4 && Math.abs(loop.rateV) < 1e-4) {
        loop.rate = goal;
        loop.rateV = 0;
      }
      loop.t += dt * loop.rate;
      render(loop.t);

      if ((loop.rate === 0 && goal === 0) || !loop.visible || latest.current.reduced) {
        loop.running = false;
        return;
      }
      loop.frame = requestAnimationFrame(frame);
    };

    loop.frame = requestAnimationFrame(frame);
  }, [render]);

  // Track the stage width; the whole layout is a function of it.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.floor(el.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Measure the pills, paint the first frame, then start the loop.
  useLayoutEffect(() => {
    const loop = state.current;
    loop.cache = new Map();
    loop.text = new Map();
    dom.current.pill.forEach((el, index) => {
      if (el && el.offsetWidth) loop.dims[index] = { w: el.offsetWidth, h: el.offsetHeight };
    });
    render(still ? timeline.still : loop.t, still);
    if (!still) start();
  }, [
    geometry,
    timeline,
    still,
    target,
    nodes,
    money,
    gross,
    cut,
    net,
    balance,
    authorizationMs,
    approvedLabel,
    render,
    start,
  ]);

  // Pause offscreen and in background tabs; re-measure once webfonts land.
  useEffect(() => {
    const el = stageRef.current;
    const loop = state.current;
    if (!el) return;
    let intersecting = true;
    let alive = true;

    const sync = () => {
      loop.visible = intersecting && !document.hidden;
      if (loop.visible) start();
      else {
        cancelAnimationFrame(loop.frame);
        loop.running = false;
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      sync();
    });
    observer.observe(el);
    document.addEventListener("visibilitychange", sync);

    document.fonts?.ready.then(() => {
      if (!alive) return;
      dom.current.pill.forEach((pill, index) => {
        if (pill && pill.offsetWidth) loop.dims[index] = { w: pill.offsetWidth, h: pill.offsetHeight };
      });
    });

    return () => {
      alive = false;
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      cancelAnimationFrame(loop.frame);
      loop.running = false;
    };
  }, [start]);

  const [terminal, processor, network, issuer, merchant] = nodes;
  const description =
    label ??
    `Card payment flow. A ${money.format(gross)} card tap at ${terminal.label} goes to ${processor.label}, then the ${network.label} network, then the issuing bank, which approves it and holds the funds. The approval travels back to ${terminal.label} in about ${(authorizationMs / 1000).toFixed(1)} seconds. At settlement the funds clear through ${network.label} and ${processor.label}, which keeps a ${money.format(cut)} fee, and ${money.format(net)} reaches ${merchant.label.toLowerCase()}.`;

  const figureStyle = {
    ...style,
    ...(accent ? { ["--pf-accent" as string]: accent } : null),
  } as CSSProperties;

  const focus = hovered === null ? null : FOCUS_WIRES[hovered];
  const boxes = geometry ? [...geometry.chips, geometry.merchant] : [];

  return (
    <figure
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={figureStyle}
      data-ready={geometry ? true : undefined}
      data-layout={geometry?.narrow ? "narrow" : "wide"}
    >
      <div className={styles.diagram} role="img" aria-label={description}>
        <div
          ref={stageRef}
          className={styles.stage}
          style={geometry ? { height: geometry.h } : undefined}
        >
          {geometry && (
            <>
              <svg
                className={styles.layer}
                viewBox={`0 0 ${geometry.w} ${geometry.h}`}
                width={geometry.w}
                height={geometry.h}
                aria-hidden="true"
              >
                {geometry.segs.map((d, index) => (
                  <path
                    key={`seg-${index}`}
                    className={styles.wire}
                    data-on={focus?.seg.includes(index) || undefined}
                    d={d}
                  />
                ))}
                {geometry.railSegs.map((d, index) => (
                  <path
                    key={`rail-${index}`}
                    className={styles.wire}
                    data-on={focus?.rail.includes(index) || undefined}
                    d={d}
                  />
                ))}
                {geometry.stubs.map((stub, index) => (
                  <path
                    key={`stub-${index}`}
                    ref={(el) => {
                      dom.current.stub[index] = el;
                    }}
                    className={styles.stub}
                    data-on={focus?.stub.includes(index) || undefined}
                    data-lit="false"
                    d={lineD(stub.a, stub.b)}
                  />
                ))}
                <path
                  ref={(el) => {
                    dom.current.authLit = el;
                  }}
                  className={styles.lit}
                  d={geometry.auth.d}
                  pathLength={1000}
                  opacity={0}
                />
                <path
                  ref={(el) => {
                    dom.current.okLit = el;
                  }}
                  className={styles.okLit}
                  d={geometry.auth.d}
                  pathLength={1000}
                  opacity={0}
                />
                <path
                  ref={(el) => {
                    dom.current.railLit = el;
                  }}
                  className={styles.lit}
                  d={geometry.rail.d}
                  pathLength={1000}
                  opacity={0}
                />
                {geometry.ports.map((port, index) => (
                  <circle
                    key={`port-${index}`}
                    className={styles.port}
                    cx={port.x}
                    cy={port.y}
                    r={2.75}
                  />
                ))}
                {geometry.waypoints.map((point, index) => (
                  <circle
                    key={`way-${index}`}
                    ref={(el) => {
                      dom.current.waypoint[index] = el;
                    }}
                    className={styles.waypoint}
                    data-lit="false"
                    cx={point.x}
                    cy={point.y}
                    r={4}
                  />
                ))}
                {[0, 1].map((index) => (
                  <rect
                    key={`tap-${index}`}
                    ref={(el) => {
                      dom.current.tap[index] = el;
                    }}
                    className={styles.tap}
                    opacity={0}
                  />
                ))}
              </svg>

              <span
                ref={(el) => {
                  dom.current.pill[0] = el;
                }}
                className={styles.pill}
                style={{ opacity: 0 }}
              >
                {money.format(gross)}
              </span>
              <span
                ref={(el) => {
                  dom.current.pill[1] = el;
                }}
                className={styles.pill}
                data-tone="ok"
                style={{ opacity: 0 }}
              >
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M2.6 6.3 L5 8.6 L9.4 3.6" />
                </svg>
                {approvedLabel}
              </span>
              <span
                ref={(el) => {
                  dom.current.pill[2] = el;
                }}
                className={styles.pill}
                style={{ opacity: 0 }}
              >
                {money.format(gross)}
              </span>
              <span
                ref={(el) => {
                  dom.current.pill[3] = el;
                }}
                className={styles.pill}
                style={{ opacity: 0 }}
              >
                {money.format(net)}
              </span>

              {boxes.map((box, index) => {
                const node = nodes[index];
                const edge = geometry.narrow
                  ? index === 4
                    ? "end"
                    : "start"
                  : index === 0 || index === 4
                    ? "start"
                    : index === 3
                      ? "end"
                      : undefined;
                const place = geometry.narrow
                  ? index === 3
                    ? "above"
                    : "below"
                  : index === 4
                    ? "above"
                    : "below";
                return (
                  <div
                    key={`chip-${index}`}
                    ref={(el) => {
                      dom.current.chip[index] = el;
                    }}
                    className={styles.chip}
                    data-state="idle"
                    data-on={hovered === index || undefined}
                    data-edge={edge}
                    data-compact={(index === 4 && geometry.compact) || undefined}
                    style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
                    onPointerEnter={(event: ReactPointerEvent<HTMLDivElement>) => {
                      if (event.pointerType === "mouse") setHovered(index);
                    }}
                    onPointerLeave={() => setHovered((current) => (current === index ? null : current))}
                  >
                    <ChipMark node={node} />
                    <span className={styles.text}>
                      <span className={styles.label}>{node.label}</span>
                      <span className={styles.meta}>
                        <span className={styles.health} />
                        <span
                          ref={(el) => {
                            dom.current.status[index] = el;
                          }}
                        >
                          {index === 4 ? money.format(balance) : node.meta}
                        </span>
                      </span>
                    </span>
                    {node.detail && (
                      <span className={styles.tag} data-place={place} aria-hidden="true">
                        {node.detail}
                      </span>
                    )}
                  </div>
                );
              })}

              <svg
                className={styles.layer}
                viewBox={`0 0 ${geometry.w} ${geometry.h}`}
                width={geometry.w}
                height={geometry.h}
                aria-hidden="true"
              >
                <g
                  ref={(el) => {
                    dom.current.check = el;
                  }}
                  opacity={0}
                >
                  <circle className={styles.checkDisc} r={8} />
                  <path className={styles.checkGlyph} d="M-3.3 0.2 L-1 2.5 L3.4 -2" />
                </g>
              </svg>
            </>
          )}
        </div>

        {!hideSteps && (
          <div className={styles.steps} aria-hidden="true">
            <div
              ref={(el) => {
                dom.current.step[0] = el;
              }}
              className={styles.step}
              data-state="idle"
            >
              <span className={styles.stepHead}>
                <span className={styles.stepLabel}>{authLabel}</span>
                <span
                  ref={(el) => {
                    dom.current.stepMeta = el;
                  }}
                  className={styles.stepMeta}
                >
                  0.00 s
                </span>
              </span>
              <span className={styles.track}>
                <span
                  ref={(el) => {
                    dom.current.fill[0] = el;
                  }}
                  className={styles.fill}
                />
              </span>
            </div>
            <div
              ref={(el) => {
                dom.current.step[1] = el;
              }}
              className={styles.step}
              data-state="idle"
            >
              <span className={styles.stepHead}>
                <span className={styles.stepLabel}>{settleLabel}</span>
                <span className={styles.stepMeta}>{settleTime}</span>
              </span>
              <span className={styles.track}>
                <span
                  ref={(el) => {
                    dom.current.fill[1] = el;
                  }}
                  className={styles.fill}
                />
              </span>
            </div>
          </div>
        )}
      </div>

      {caption && <figcaption className={styles.figcaption}>{caption}</figcaption>}
    </figure>
  );
}

/** Status copy fade: 0 at each change time, 1 in between, wrapping over the cycle. */
function crossFade(changes: number[], time: number, cycle: number): number {
  let alpha = 1;
  for (const moment of changes) {
    const distance = Math.abs(time - moment);
    alpha = Math.min(alpha, clamp(Math.min(distance, cycle - distance) / 0.13));
  }
  return alpha * alpha * (3 - 2 * alpha);
}

export default PaymentFlow;
