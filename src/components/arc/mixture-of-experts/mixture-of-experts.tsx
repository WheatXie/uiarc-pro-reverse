"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  CalendarDays,
  CircleCheck,
  CodeXml,
  Hash,
  Pause,
  Play,
  Quote,
  RotateCcw,
  Sigma,
  TriangleAlert,
  UserRound,
  WholeWord,
  Zap,
} from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import SegmentedControl from "../segmented-control/segmented-control";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import Tooltip from "../tooltip/tooltip";
import styles from "./mixture-of-experts.module.css";

export interface MixtureOfExpertsToken {
  /** The token as it appears in the prompt. */
  text: string;
  /** Optional score per expert, in order. Omit to derive them from the text. */
  scores?: number[];
}

export interface MixtureOfExpertsExpert {
  name: string;
  /** What this expert tends to handle, used in the inspector note. */
  handles?: string;
  icon?: ReactNode;
}

export interface MixtureOfExpertsParameters {
  /** Parameters the model would use without routing. */
  total: number;
  /** Parameters every token always pays for. */
  shared: number;
  /** Parameters per routed expert. */
  perExpert: number;
}

export interface MixtureOfExpertsRoute {
  index: number;
  token: string;
  scores: number[];
  experts: number[];
  weights: number[];
  dropped: number[];
}

export interface MixtureOfExpertsProps {
  tokens?: MixtureOfExpertsToken[];
  experts?: MixtureOfExpertsExpert[];
  /** Experts per token. Pass it to control the setting. */
  topK?: number;
  defaultTopK?: number;
  onTopKChange?: (topK: number) => void;
  parameters?: MixtureOfExpertsParameters;
  /** Multiplies the per-expert token budget. Lower values force dropped routes. */
  capacityFactor?: number;
  speed?: number;
  paused?: boolean;
  defaultPaused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  loop?: boolean;
  onRoute?: (route: MixtureOfExpertsRoute) => void;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

interface Point {
  x: number;
  y: number;
}

interface Segment {
  d: string;
  len: number;
  at: (distance: number) => Point;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Align = "start" | "center" | "end";

interface LayoutLabel {
  text: string;
  x: number;
  y: number;
  align: Align;
}

interface Layout {
  w: number;
  h: number;
  wide: boolean;
  intake: Box;
  output: Box;
  router: Box;
  tracks: Box[];
  scores: Box[];
  tiles: Box[];
  inSeg: Segment;
  gates: Segment[];
  curves: Segment[];
  outSeg: Segment;
  merge: Point;
  labels: LayoutLabel[];
}

type PhaseName = "enter" | "in" | "gate" | "dispatch" | "expert" | "merge" | "out" | "done";

interface Step {
  index: number;
  phase: PhaseName;
  cycle: number;
}

interface Clock extends Step {
  t: number;
}

interface PreparedRoute {
  index: number;
  token: string;
  scores: number[];
  experts: number[];
  weights: number[];
  dropped: number[];
  loads: number[];
}

interface Trail {
  seg: Segment;
  at: number;
}

type Selection = { kind: "token" | "expert"; index: number };

const iconProps = { size: 14, strokeWidth: 1.75, "aria-hidden": "true" as const };

const EXPERTS: MixtureOfExpertsExpert[] = [
  { name: "Code", handles: "Commands, identifiers and keywords", icon: <CodeXml {...iconProps} /> },
  { name: "Numbers", handles: "Digits, amounts and counts", icon: <Hash {...iconProps} /> },
  { name: "Punctuation", handles: "Commas, periods and brackets", icon: <Quote {...iconProps} /> },
  { name: "Names", handles: "People, products and places", icon: <UserRound {...iconProps} /> },
  { name: "Grammar", handles: "Short words such as on, then and the", icon: <WholeWord {...iconProps} /> },
  { name: "Verbs", handles: "Actions and tense", icon: <Zap {...iconProps} /> },
  { name: "Dates", handles: "Months, days and times", icon: <CalendarDays {...iconProps} /> },
  { name: "Symbols", handles: "Currency, units and math signs", icon: <Sigma {...iconProps} /> },
];

const PARAMETERS: MixtureOfExpertsParameters = { total: 671, shared: 5, perExpert: 16 };

// FNV-1a keeps derived scores stable between server render and hydration.
function hash(value: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x1000193);
  }
  return h >>> 0;
}

function normalize(values: number[]) {
  const clean = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const sum = clean.reduce((total, value) => total + value, 0);
  return sum > 0 ? clean.map((value) => value / sum) : clean.map(() => 1 / Math.max(1, clean.length));
}

/** Two experts carry most of the weight; the rest share what is left. */
function scored(text: string, count: number, primary: number, secondary: number, first: number, second: number) {
  const rest = Math.max(0, 1 - first - second);
  const others = Array.from({ length: count }, (_, i) => i).filter((i) => i !== primary && i !== secondary);
  const raw = others.map((i) => 0.45 + (hash(`${text}:${i}`) % 1000) / 1000);
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;
  const scores = Array<number>(count).fill(0);
  scores[primary] = first;
  if (secondary !== primary) scores[secondary] = second;
  others.forEach((i, index) => {
    scores[i] = Math.min(0.8 * second, (raw[index] / total) * rest);
  });
  return normalize(scores);
}

function derivedScores(text: string, count: number) {
  if (count <= 1) return [1];
  const seed = hash(text.trim() || text);
  const primary = seed % count;
  return scored(
    text,
    count,
    primary,
    (primary + 1 + ((seed >>> 8) % (count - 1))) % count,
    0.38 + (((seed >>> 4) % 100) / 100) * 0.17,
    0.16 + (((seed >>> 12) % 100) / 100) * 0.1,
  );
}

const SAMPLES: MixtureOfExpertsToken[] = (
  [
    ["Maya", 3, 5, 0.46, 0.21],
    [" paid", 5, 7, 0.42, 0.2],
    [" $", 7, 1, 0.51, 0.24],
    ["1", 1, 7, 0.48, 0.19],
    [",", 2, 1, 0.44, 0.22],
    ["240", 1, 2, 0.53, 0.17],
    [" on", 4, 6, 0.39, 0.23],
    [" Oct", 6, 3, 0.47, 0.2],
    [" 21", 6, 1, 0.41, 0.29],
    [",", 2, 4, 0.5, 0.18],
    [" then", 4, 5, 0.43, 0.21],
    [" ran", 5, 0, 0.4, 0.24],
    [" npm", 0, 3, 0.55, 0.18],
    [" test", 0, 5, 0.45, 0.26],
    [".", 2, 4, 0.49, 0.2],
  ] as Array<[string, number, number, number, number]>
).map(([text, primary, secondary, first, second]) => ({
  text,
  scores: scored(text, EXPERTS.length, primary, secondary, first, second),
}));

const clip = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function segment(from: Point, to: Point): Segment {
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  return {
    d: `M${from.x.toFixed(1)} ${from.y.toFixed(1)}L${to.x.toFixed(1)} ${to.y.toFixed(1)}`,
    len,
    at: (distance: number) => {
      const t = len ? clip(distance / len, 0, 1) : 1;
      return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    },
  };
}

function curve(from: Point, controlA: Point, controlB: Point, to: Point): Segment {
  const point = (t: number) => {
    const inv = 1 - t;
    const a = inv * inv * inv;
    const b = 3 * inv * inv * t;
    const c = 3 * inv * t * t;
    const d = t * t * t;
    return {
      x: a * from.x + b * controlA.x + c * controlB.x + d * to.x,
      y: a * from.y + b * controlA.y + c * controlB.y + d * to.y,
    };
  };
  // Sample once so the dot travels at an even speed along the bend.
  const table = [0];
  let previous = from;
  for (let i = 1; i <= 40; i++) {
    const next = point(i / 40);
    table.push(table[i - 1] + Math.hypot(next.x - previous.x, next.y - previous.y));
    previous = next;
  }
  const len = table[40];
  return {
    d: `M${from.x.toFixed(1)} ${from.y.toFixed(1)}C${controlA.x.toFixed(1)} ${controlA.y.toFixed(1)} ${controlB.x.toFixed(1)} ${controlB.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`,
    len,
    at: (distance: number) => {
      const target = clip(distance, 0, len);
      let i = 1;
      while (i < 40 && table[i] < target) i++;
      const span = table[i] - table[i - 1] || 1;
      return point((i - 1 + (target - table[i - 1]) / span) / 40);
    },
  };
}

const PHASE: Record<PhaseName, number> = {
  enter: 0,
  in: 1,
  gate: 2,
  dispatch: 3,
  expert: 4,
  merge: 5,
  out: 6,
  done: 7,
};

const TIMING = { in: 0.18, gate: 0.5, dispatch: 0.78, expert: 1.16, merge: 1.4, join: 1.68, out: 1.86, next: 2.2 };
const STILL_TIMING = { in: 0, gate: 0, dispatch: 0.6, expert: 0.6, merge: 1.1, join: 1.1, out: 1.1, next: 1.8 };

const percent = (value: number) => `${Math.round(100 * value)}%`;

const ORDINAL = ["first", "second"];

const swap = {
  initial: { opacity: 0, y: 2 },
  animate: { opacity: 1, y: 0, transition: { duration: motionTokens.duration.fast, ease: motionTokens.ease.standard } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

const swapStill = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
};

const subscribeHydration = () => () => {};

const boxStyle = (box: Box) => ({ left: box.x, top: box.y, width: box.w, height: box.h });

const initialLetter = (name: string) => <span className={styles.initial}>{name.trim().charAt(0) || "?"}</span>;

function RollDigit({ digit, reduced }: { digit: number; reduced: boolean }) {
  return (
    <span className={styles.digit}>
      <span className={styles.sizer}>0</span>
      <motion.span
        className={styles.strip}
        initial={false}
        animate={{ y: `${-(10 * digit)}%` }}
        transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}
      >
        {"0123456789".split("").map((value) => (
          <span key={value}>{value}</span>
        ))}
      </motion.span>
    </span>
  );
}

function RollingNumber({ value, reduced }: { value: number; reduced: boolean }) {
  const text = String(Math.max(0, Math.round(value)));
  return (
    <span className={styles.roll} aria-hidden="true">
      {text.split("").map((digit, index) => (
        <RollDigit key={text.length - index} digit={Number(digit)} reduced={reduced} />
      ))}
    </span>
  );
}

export function MixtureOfExperts({
  tokens = SAMPLES,
  experts = EXPERTS,
  topK,
  defaultTopK = 2,
  onTopKChange,
  parameters = PARAMETERS,
  capacityFactor = 1,
  speed = 1,
  paused,
  defaultPaused = false,
  onPausedChange,
  loop = true,
  onRoute,
  label = "Mixture of experts routing",
  className,
  style,
}: MixtureOfExpertsProps) {
  const prefersReduced = useReducedMotion();
  const reduced = useSyncExternalStore(subscribeHydration, () => true, () => false) && Boolean(prefersReduced);
  const roster = useMemo(() => experts.slice(0, 12), [experts]);
  const expertCount = Math.max(1, roster.length);
  const tokenCount = tokens.length;
  const [ownTopK, setOwnTopK] = useState(defaultTopK);
  const activeTopK = topK ?? ownTopK;
  const [ownPaused, setOwnPaused] = useState(defaultPaused);
  const isPaused = paused ?? ownPaused;
  const requestPaused = (value: boolean) => {
    if (topK === undefined) setOwnPaused(value);
    onPausedChange?.(value);
  };
  const capacity =
    !Number.isFinite(capacityFactor) || capacityFactor <= 0 || expertCount < 1
      ? Number.POSITIVE_INFINITY
      : Math.max(1, Math.ceil((capacityFactor * tokenCount * activeTopK) / expertCount));

  const plan = useMemo<PreparedRoute[]>(() => {
    const loads = Array<number>(expertCount).fill(0);
    return tokens.map((token, index) => {
      const provided =
        token.scores && token.scores.length
          ? Array.from({ length: expertCount }, (_, i) => token.scores?.[i] ?? 0)
          : null;
      const scores = provided ? normalize(provided) : derivedScores(token.text, expertCount);
      const count = Math.max(1, Math.min(activeTopK, expertCount));
      const chosen = scores
        .map((value, i) => ({ value, i }))
        .sort((a, b) => b.value - a.value || a.i - b.i)
        .slice(0, count)
        .map((entry) => entry.i);
      const picked = chosen.map((i) => scores[i]);
      const sum = picked.reduce((total, value) => total + value, 0) || 1;
      const dropped: number[] = [];
      chosen.forEach((i) => {
        if (loads[i] >= capacity) dropped.push(i);
        else loads[i] += 1;
      });
      return {
        index,
        token: token.text.trim() || token.text,
        scores,
        experts: chosen,
        weights: picked.map((value) => value / sum),
        dropped,
        loads: loads.slice(),
      };
    });
  }, [tokens, expertCount, activeTopK, capacity]);

  const noLoads = useMemo(() => Array<number>(expertCount).fill(0), [expertCount]);

  const stage = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(0);

  useLayoutEffect(() => {
    const node = stage.current;
    if (!node) return;
    setStageWidth(node.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setStageWidth(Math.round(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo<Layout | null>(() => {
    if (stageWidth <= 0) return null;
    const width = Math.max(240, stageWidth);
    if (width >= 520) {
      const row = 28 * expertCount + (expertCount - 1) * 4;
      const mid = 32 + row / 2;
      const chip = Math.round(clip(0.12 * width, 64, 92));
      const gate = Math.round(clip(0.22 * width, 124, 168));
      const tile = Math.round(clip(0.26 * width, 148, 196));
      const slack = width - 2 * chip - gate - tile;
      const routerX = chip + Math.round(0.27 * slack);
      const tileX = routerX + gate + Math.round(0.33 * slack);
      const curveStart = tileX + tile;
      const outX = width - chip;
      const mergeX = Math.round(curveStart + (outX - curveStart) * 0.62);
      const rows = Array.from({ length: expertCount }, (_, i) => i);
      const rowY = (i: number) => 32 + 32 * i + 14;
      const bend = (mergeX - curveStart) * 0.6;
      return {
        w: width,
        h: 32 + row + 10,
        wide: true,
        intake: { x: 0, y: mid - 14, w: chip, h: 28 },
        output: { x: outX, y: mid - 14, w: chip, h: 28 },
        router: { x: routerX, y: 22, w: gate, h: row + 20 },
        tracks: rows.map((i) => ({ x: routerX + 12, y: rowY(i) - 2, w: gate - 24 - 30 - 6, h: 4 })),
        scores: rows.map((i) => ({ x: routerX + gate - 12 - 30, y: rowY(i) - 8, w: 30, h: 16 })),
        tiles: rows.map((i) => ({ x: tileX, y: 32 + 32 * i, w: tile, h: 28 })),
        inSeg: segment({ x: chip, y: mid }, { x: routerX, y: mid }),
        gates: rows.map((i) => segment({ x: routerX + gate, y: rowY(i) }, { x: tileX, y: rowY(i) })),
        curves: rows.map((i) =>
          curve(
            { x: curveStart, y: rowY(i) },
            { x: curveStart + bend, y: rowY(i) },
            { x: mergeX - 0.55 * bend, y: mid },
            { x: mergeX, y: mid },
          ),
        ),
        outSeg: segment({ x: mergeX, y: mid }, { x: outX, y: mid }),
        merge: { x: mergeX, y: mid },
        labels: [
          { text: "Input", x: chip, y: 11, align: "end" },
          { text: "Router", x: routerX + gate / 2, y: 11, align: "center" },
          { text: "Experts", x: tileX + tile / 2, y: 11, align: "center" },
          { text: "Output", x: outX, y: 11, align: "start" },
        ],
      };
    }
    const gap = expertCount > 6 ? 4 : 6;
    const cell = (width - (expertCount - 1) * gap) / expertCount;
    const center = (i: number) => i * (cell + gap) + cell / 2;
    const rows = Array.from({ length: expertCount }, (_, i) => i);
    const mid = width / 2;
    const chip = Math.min(180, 0.5 * width);
    const trackTop = 50;
    const trackHeight = 50;
    const scoreTop = 58;
    const tileTop = 164;
    const mergeY = 242;
    const outY = 258;
    const bend = 18.2;
    return {
      w: width,
      h: 286,
      wide: false,
      intake: { x: mid - chip / 2, y: 0, w: chip, h: 28 },
      output: { x: mid - chip / 2, y: 258, w: chip, h: 28 },
      router: { x: 0, y: 50, w: width, h: 92 },
      tracks: rows.map((i) => ({ x: center(i) - 2, y: trackTop, w: 4, h: trackHeight })),
      scores: rows.map((i) => ({ x: center(i) - cell / 2, y: scoreTop, w: cell, h: 16 })),
      tiles: rows.map((i) => ({ x: i * (cell + gap), y: tileTop, w: cell, h: 52 })),
      inSeg: segment({ x: mid, y: 28 }, { x: mid, y: trackTop }),
      gates: rows.map((i) => segment({ x: center(i), y: scoreTop + 92 }, { x: center(i), y: tileTop })),
      curves: rows.map((i) =>
        curve(
          { x: center(i), y: tileTop + 52 },
          { x: center(i), y: tileTop + 52 + bend },
          { x: mid, y: mergeY - 0.5 * bend },
          { x: mid, y: mergeY },
        ),
      ),
      outSeg: segment({ x: mid, y: mergeY }, { x: mid, y: outY }),
      merge: { x: mid, y: mergeY },
      labels: [
        { text: "Input", x: 0, y: 14, align: "start" },
        { text: "Output", x: 0, y: outY + 14, align: "start" },
      ],
    };
  }, [stageWidth, expertCount]);

  const root = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const node = root.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "80px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const [hovered, setHovered] = useState<Selection | null>(null);
  const [focused, setFocused] = useState<Selection | null>(null);
  const [pinned, setPinned] = useState<Selection | null>(null);
  const selection = hovered ?? focused ?? pinned;
  const [tokenFocus, setTokenFocus] = useState(0);
  const [tileFocus, setTileFocus] = useState(0);
  const [message, setMessage] = useState("");
  const [tick, setTick] = useState<Step>({ index: 0, phase: "enter", cycle: 0 });
  const clock = useRef<Clock>({ t: 0, index: 0, phase: "enter", cycle: 0 });
  const timing = reduced ? STILL_TIMING : TIMING;
  const settled = tick.phase === "done" && (!loop || reduced);
  const running = !isPaused && !selection && inView && Boolean(layout) && tokenCount > 0 && speed > 0 && !settled;

  const packets = useRef<Array<SVGGElement | null>>([]);
  const latest = useRef({ geo: layout, plan, T: timing, reduced });

  useEffect(() => {
    latest.current = { geo: layout, plan, T: timing, reduced };
  });

  // The dots are written straight to the DOM: a hundred painted frames per token would re-render the tree otherwise.
  const paint = useCallback(() => {
    const { geo, plan: routes, T, reduced: still } = latest.current;
    const { t, index, phase } = clock.current;
    const route = routes[index];
    const trails: Array<Trail | null> = [null, null, null, null, null, null];
    if (geo && route && !still && phase !== "done") {
      const progress = (from: number, to: number) => {
        if (t < from || t >= to) return -1;
        const raw = (t - from) / (to - from);
        return raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
      };
      const entering = progress(T.in, T.gate);
      if (entering >= 0) trails[0] = { seg: geo.inSeg, at: entering };
      const toExpert = progress(T.dispatch, T.expert);
      const merging = progress(T.merge, T.join);
      const exiting = progress(T.join, T.out);
      route.experts.forEach((expert, i) => {
        if (toExpert >= 0) {
          trails[1 + i] = { seg: geo.gates[expert], at: route.dropped.includes(expert) ? 0.92 * toExpert : toExpert };
        }
        if (merging >= 0 && !route.dropped.includes(expert)) {
          trails[3 + i] = { seg: geo.curves[expert], at: merging };
        }
      });
      if (exiting >= 0 && route.dropped.length < route.experts.length) {
        trails[5] = { seg: geo.outSeg, at: exiting };
      }
    }
    trails.forEach((trail, i) => {
      const group = packets.current[i];
      if (!group) return;
      if (!trail) {
        group.style.opacity = "0";
        return;
      }
      const long = group.children[0] as SVGPathElement;
      const short = group.children[1] as SVGPathElement;
      const dot = group.children[2] as SVGCircleElement;
      const { seg, at } = trail;
      const offset = at * seg.len;
      const dash = Math.min(34, 0.7 * seg.len);
      if (long.getAttribute("d") !== seg.d) {
        long.setAttribute("d", seg.d);
        short.setAttribute("d", seg.d);
      }
      long.setAttribute("stroke-dasharray", `${dash} ${seg.len + dash}`);
      long.setAttribute("stroke-dashoffset", `${dash - offset}`);
      short.setAttribute("stroke-dasharray", `${0.45 * dash} ${seg.len + dash}`);
      short.setAttribute("stroke-dashoffset", `${0.45 * dash - offset}`);
      const point = seg.at(offset);
      dot.setAttribute("cx", point.x.toFixed(2));
      dot.setAttribute("cy", point.y.toFixed(2));
      group.style.opacity = "1";
    });
  }, []);

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let previous = performance.now();
    const step = (now: number) => {
      const current = clock.current;
      const { T, plan: routes, reduced: still } = latest.current;
      current.t += Math.min(0.05, (now - previous) / 1000) * speed;
      previous = now;
      if (current.phase === "done") {
        if (current.t >= 3.6 && loop && !still) {
          current.t = 0;
          current.index = 0;
          current.cycle += 1;
          current.phase = "enter";
        }
      } else if (current.t >= T.next) {
        if (current.index + 1 < routes.length) {
          current.index += 1;
          current.t -= T.next;
        } else {
          current.phase = "done";
          current.t = 0;
        }
      }
      if (current.phase !== "done") {
        const value = current.t;
        current.phase =
          value < T.in
            ? "enter"
            : value < T.gate
              ? "in"
              : value < T.dispatch
                ? "gate"
                : value < T.expert
                  ? "dispatch"
                  : value < T.merge
                    ? "expert"
                    : value < T.out
                      ? "merge"
                      : "out";
      }
      setTick((previousTick) =>
        previousTick.index === current.index && previousTick.phase === current.phase && previousTick.cycle === current.cycle
          ? previousTick
          : { index: current.index, phase: current.phase, cycle: current.cycle },
      );
      paint();
      if (current.phase !== "done" || (loop && !still)) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [running, speed, loop, paint]);

  useEffect(() => {
    paint();
  }, [layout, plan, paint]);

  useEffect(() => {
    if (clock.current.index < tokenCount) return;
    clock.current = { t: 0, index: 0, phase: "enter", cycle: clock.current.cycle + 1 };
    setTick({ index: 0, phase: "enter", cycle: clock.current.cycle });
  }, [tokenCount]);

  const routeListener = useRef(onRoute);

  useEffect(() => {
    routeListener.current = onRoute;
  });

  const announced = useRef("");

  useEffect(() => {
    const route = plan[tick.index];
    if (!route || PHASE[tick.phase] < PHASE.dispatch || tick.phase === "done") return;
    const key = `${tick.cycle}:${tick.index}`;
    if (announced.current === key) return;
    announced.current = key;
    routeListener.current?.({
      index: route.index,
      token: route.token,
      scores: route.scores,
      experts: route.experts,
      weights: route.weights,
      dropped: route.dropped,
    });
  }, [tick, plan]);

  const phaseIndex = PHASE[tick.phase];
  const isDone = tick.phase === "done";
  const currentRoute = plan[tick.index];
  const previousRoute = tick.index > 0 ? plan[tick.index - 1] : undefined;
  const inspected = selection?.kind === "token" ? plan[selection.index] : undefined;
  const inspectedExpert = selection?.kind === "expert" ? selection.index : null;
  const loads = isDone
    ? (plan[tokenCount - 1]?.loads ?? noLoads)
    : phaseIndex >= PHASE.expert
      ? (currentRoute?.loads ?? noLoads)
      : (previousRoute?.loads ?? noLoads);
  const shownLoads = inspected ? inspected.loads : loads;
  const view = inspected
    ? {
        bars: inspected,
        barsLive: true,
        gates: inspected,
        curves: inspected,
        lit: inspected,
        input: inspected.index,
        inputSpent: false,
        output: inspected.index,
      }
    : {
        bars: isDone ? plan[tokenCount - 1] : phaseIndex >= PHASE.gate ? currentRoute : previousRoute,
        barsLive: !isDone && phaseIndex >= PHASE.gate,
        gates:
          !isDone && inspectedExpert === null && phaseIndex >= PHASE.dispatch && phaseIndex <= PHASE.expert
            ? currentRoute
            : undefined,
        curves: isDone || inspectedExpert !== null || phaseIndex !== PHASE.merge ? undefined : currentRoute,
        lit: !isDone && inspectedExpert === null && phaseIndex >= PHASE.expert ? currentRoute : undefined,
        input: isDone || !currentRoute ? null : tick.index,
        inputSpent: phaseIndex >= PHASE.gate,
        output: isDone ? tokenCount - 1 : phaseIndex >= PHASE.out ? tick.index : tick.index - 1,
      };
  const rankIn = (route: PreparedRoute | undefined, expert: number) => (route ? route.experts.indexOf(expert) : -1);
  const activeParameters = parameters.shared + activeTopK * parameters.perExpert;
  const balance = (() => {
    const total = shownLoads.reduce((sum, value) => sum + value, 0);
    if (!total || shownLoads.length < 2) return null;
    const average = total / shownLoads.length;
    return Math.max(0, 1 - (Math.max(...shownLoads) / average - 1) / (shownLoads.length - 1));
  })();
  const routeCount = shownLoads.reduce((sum, value) => sum + value, 0);
  const focusVisible = (event: { currentTarget: Element }) => {
    try {
      return event.currentTarget.matches(":focus-visible");
    } catch {
      return true;
    }
  };
  const togglePin = (target: Selection) => {
    const same = Boolean(pinned && pinned.kind === target.kind && pinned.index === target.index);
    setPinned(same ? null : target);
    const name = target.kind === "token" ? plan[target.index]?.token : roster[target.index]?.name;
    setMessage(same ? "Unpinned, routing resumes" : `Pinned ${name}. Press Escape to resume.`);
  };
  const tokenRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const rove = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
    count: number,
    refs: { current: Array<HTMLButtonElement | null> },
    focus: (value: number) => void,
  ) => {
    const last = count - 1;
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? Math.min(last, index + 1)
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? Math.max(0, index - 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    event.preventDefault();
    focus(next);
    refs.current[next]?.focus();
  };
  const playLabel = settled ? "Route again" : isPaused || pinned ? "Play" : "Pause";
  const stageStyle = {
    "--moe-wide-h": `${42 + 28 * expertCount + (expertCount - 1) * 4}px`,
    "--moe-narrow-h": "286px",
    ...(layout ? { height: layout.h } : null),
  } as CSSProperties;
  const variants = reduced ? swapStill : swap;
  const nameOf = (index: number) => roster[index]?.name ?? `Expert ${index + 1}`;
  const tokenRef = (text: string) => <span className={styles.tokenRef}>{text}</span>;
  const names = (indices: number[]) => indices.map(nameOf).join(" and ");
  const routeForFooter = inspected ?? (!isDone && phaseIndex >= PHASE.gate ? currentRoute : undefined);

  let lineKey: string;
  let lineContent: ReactNode;
  let note: { icon?: ReactNode; text: ReactNode };

  if (tokenCount === 0) {
    lineKey = "empty";
    lineContent = <span className={styles.lineMuted}>No tokens yet</span>;
    note = { text: "Pass tokens to see how the gate routes them." };
  } else if (inspectedExpert !== null) {
    const expert = roster[inspectedExpert];
    const count = shownLoads[inspectedExpert] ?? 0;
    lineKey = `expert-${inspectedExpert}`;
    lineContent = (
      <>
        <span className={styles.lineIcon}>{expert?.icon ?? initialLetter(expert?.name ?? "")}</span>
        <span className={styles.lineName}>{nameOf(inspectedExpert)}</span>
        <span className={styles.lineMeta}>
          {Number.isFinite(capacity) ? `${count} of ${capacity} tokens` : `${count} ${count === 1 ? "token" : "tokens"}`}
        </span>
      </>
    );
    const full = Number.isFinite(capacity) && count >= capacity;
    note = {
      text: (
        <>
          {expert?.handles
            ? `Tends to handle ${expert.handles.charAt(0).toLowerCase()}${expert.handles.slice(1)}.`
            : "Takes whatever the gate sends it."}
          {full ? " It is full, so later tokens skip it." : ""}
        </>
      ),
    };
  } else if (isDone && !inspected) {
    lineKey = `done-${activeTopK}`;
    lineContent = (
      <>
        <CircleCheck {...iconProps} className={styles.okIcon} />
        <span className={styles.lineName}>
          Routed {tokenCount} {tokenCount === 1 ? "token" : "tokens"}
        </span>
      </>
    );
    note = {
      text: (
        <>
          Each token used {activeTopK} of {expertCount} experts, so only {activeParameters}B of {parameters.total}B
          parameters ran.
        </>
      ),
    };
  } else if (routeForFooter) {
    const route = routeForFooter;
    lineKey = `route-${route.index}-${activeTopK}-${inspected ? "still" : tick.cycle}`;
    lineContent = (
      <>
        <span className={styles.lineChip}>{route.token}</span>
        <ArrowRight {...iconProps} className={styles.lineArrow} />
        {route.experts.map((expert, i) => {
          const dropped = route.dropped.includes(expert);
          return (
            <span key={expert} className={styles.pick} data-rank={i} data-dropped={dropped || undefined}>
              {dropped ? (
                <TriangleAlert size={12} strokeWidth={1.75} className={styles.warnIcon} aria-hidden="true" />
              ) : (
                <span className={styles.swatch} aria-hidden="true" />
              )}
              <span className={styles.pickName}>{nameOf(expert)}</span>
              <span className={styles.pickValue}>{dropped ? "full" : percent(route.weights[i])}</span>
            </span>
          );
        })}
      </>
    );
    const kept = route.experts.filter((expert) => !route.dropped.includes(expert));
    note =
      route.dropped.length && kept.length
        ? {
            icon: <TriangleAlert {...iconProps} className={styles.warnIcon} />,
            text: (
              <>
                {names(route.dropped)} is at capacity, so only {nameOf(kept[0])} processes {tokenRef(route.token)}.
              </>
            ),
          }
        : route.dropped.length
          ? {
              icon: <TriangleAlert {...iconProps} className={styles.warnIcon} />,
              text: (
                <>
                  {names(route.dropped)} is at capacity, so {tokenRef(route.token)} passes through unchanged.
                </>
              ),
            }
          : route.experts.length === 1
            ? {
                text: (
                  <>
                    {nameOf(route.experts[0])} processes {tokenRef(route.token)} alone. The other {expertCount - 1} experts
                    stay idle.
                  </>
                ),
              }
            : {
                text: (
                  <>
                    {names(route.experts)} process {tokenRef(route.token)}. Their outputs blend{" "}
                    {route.weights.map((weight) => Math.round(100 * weight)).join(" to ")}.
                  </>
                ),
              };
  } else {
    lineKey = `scoring-${tick.index}-${tick.cycle}`;
    lineContent = (
      <>
        {currentRoute ? <span className={styles.lineChip}>{currentRoute.token}</span> : null}
        <ArrowRight {...iconProps} className={styles.lineArrow} />
        <TextShimmer className={styles.lineShimmer} active={!isPaused}>
          {`Scoring ${expertCount} experts`}
        </TextShimmer>
      </>
    );
    note = {
      text: (
        <>
          The gate scores every expert. The top {activeTopK} {activeTopK === 1 ? "takes" : "take"} the token.
        </>
      ),
    };
  }

  return (
    <div ref={root} className={`${styles.root} ${className ?? ""}`} style={style}>
      <div
        className={styles.card}
        role="group"
        aria-label={label}
        data-inspect={selection ? selection.kind : undefined}
        data-reduced={reduced || undefined}
        onKeyDown={(event) => {
          if (event.key === "Escape" && pinned) {
            setPinned(null);
            setMessage("Unpinned, routing resumes");
          }
        }}
      >
        <div className={styles.header}>
          <SegmentedControl
            label="Experts per token"
            options={[
              { value: "1", label: "Top 1" },
              { value: "2", label: "Top 2" },
            ]}
            value={String(activeTopK)}
            onValueChange={(value) => {
              const next = value === "1" ? 1 : 2;
              if (next === activeTopK) return;
              if (topK === undefined) setOwnTopK(next);
              onTopKChange?.(next);
              setMessage(
                `Top ${next}: ${parameters.shared + next * parameters.perExpert}B of ${parameters.total}B parameters active per token`,
              );
            }}
          />
          <p className={styles.params}>
            <span className={styles.paramsLabel}>Active parameters</span>
            <span className={styles.paramsValue}>
              <RollingNumber value={activeParameters} reduced={reduced} />B
            </span>
            <span className={styles.paramsLabel}>
              of {parameters.total}B
            </span>
            <span className={styles.srOnly}>
              {activeParameters}B of {parameters.total}B parameters active per token
            </span>
          </p>
          <Tooltip content={playLabel}>
            <button
              type="button"
              className={styles.play}
              aria-label={playLabel}
              disabled={tokenCount === 0}
              onClick={() => {
                if (settled) {
                  clock.current = { t: 0, index: 0, phase: "enter", cycle: clock.current.cycle + 1 };
                  setTick({ index: 0, phase: "enter", cycle: clock.current.cycle });
                  requestPaused(false);
                  setPinned(null);
                  setMessage("Routing again from the first token");
                  return;
                }
                if (pinned) {
                  setPinned(null);
                  requestPaused(false);
                  setMessage("Routing resumes");
                  return;
                }
                requestPaused(!isPaused);
                setMessage(isPaused ? "Routing resumes" : "Paused");
              }}
            >
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span className={styles.playIcon} key={playLabel} {...variants}>
                  {settled ? (
                    <RotateCcw {...iconProps} />
                  ) : playLabel === "Play" ? (
                    <Play {...iconProps} />
                  ) : (
                    <Pause {...iconProps} />
                  )}
                </motion.span>
              </AnimatePresence>
            </button>
          </Tooltip>
        </div>
        <div
          ref={stage}
          className={styles.stage}
          style={stageStyle}
          data-ready={layout ? "" : undefined}
          data-layout={layout ? (layout.wide ? "wide" : "narrow") : undefined}
        >
          {layout && (
            <>
              <svg className={styles.lines} width={layout.w} height={layout.h} viewBox={`0 0 ${layout.w} ${layout.h}`} aria-hidden="true">
                <path
                  className={styles.flow}
                  d={layout.inSeg.d}
                  data-on={view.input === null || view.inputSpent ? undefined : ""}
                />
                {layout.gates.map((gate, i) => {
                  const rank = rankIn(view.gates, i);
                  return (
                    <path
                      key={i}
                      className={styles.gate}
                      d={gate.d}
                      data-rank={rank >= 0 ? rank : undefined}
                      data-dropped={rank >= 0 && view.gates?.dropped.includes(i) ? "" : undefined}
                    />
                  );
                })}
                {layout.curves.map((bend, i) => {
                  const rank = rankIn(view.curves, i);
                  const dropped = Boolean(view.curves?.dropped.includes(i));
                  return <path key={i} className={styles.curve} d={bend.d} data-rank={rank >= 0 && !dropped ? rank : undefined} />;
                })}
                <path className={styles.flow} d={layout.outSeg.d} />
                <circle className={styles.joint} cx={layout.merge.x} cy={layout.merge.y} r={2.5} />
              </svg>
              {layout.labels.map((item) => (
                <span
                  key={item.text}
                  className={styles.stageLabel}
                  data-align={item.align}
                  style={{ left: item.x, top: item.y }}
                >
                  {item.text}
                </span>
              ))}
              <div
                className={styles.router}
                style={boxStyle(layout.router)}
                data-live={view.barsLive ? "" : undefined}
                aria-hidden="true"
              />
              {layout.tracks.map((box, i) => {
                const score = view.bars?.scores[i] ?? 0;
                const rank = view.barsLive ? rankIn(view.bars, i) : -1;
                return (
                  <span
                    key={i}
                    className={styles.track}
                    style={boxStyle(box)}
                    data-rank={rank >= 0 ? rank : undefined}
                    data-live={view.barsLive ? "" : undefined}
                    aria-hidden="true"
                  >
                    <span className={styles.fill} style={{ "--s": view.bars ? score : 0 } as CSSProperties} />
                  </span>
                );
              })}
              {layout.scores.map((box, i) => {
                const rank = view.barsLive ? rankIn(view.bars, i) : -1;
                return (
                  <span
                    key={i}
                    className={styles.score}
                    style={boxStyle(box)}
                    data-rank={rank >= 0 ? rank : undefined}
                    data-live={view.barsLive ? "" : undefined}
                    aria-hidden="true"
                  >
                    {view.bars ? percent(view.bars.scores[i] ?? 0) : "0%"}
                  </span>
                );
              })}
              <div className={styles.tiles} role="group" aria-label="Experts">
                {layout.tiles.map((box, i) => {
                  const expert = roster[i];
                  const rank = rankIn(view.lit, i);
                  const dropped = rank >= 0 && Boolean(view.lit?.dropped.includes(i));
                  const count = shownLoads[i] ?? 0;
                  const full = Number.isFinite(capacity) && count >= capacity;
                  return (
                    <button
                      key={i}
                      ref={(node) => {
                        tileRefs.current[i] = node;
                      }}
                      type="button"
                      className={styles.tile}
                      style={
                        {
                          ...boxStyle(box),
                          "--g": Number.isFinite(capacity) ? Math.min(1, count / capacity) : 0,
                        } as CSSProperties
                      }
                      data-rank={rank >= 0 && !dropped ? rank : undefined}
                      data-dropped={dropped || undefined}
                      data-full={full || undefined}
                      data-inspect={inspectedExpert === i || undefined}
                      data-pinned={pinned?.kind === "expert" && pinned.index === i ? "" : undefined}
                      tabIndex={i === tileFocus ? 0 : -1}
                      aria-pressed={pinned?.kind === "expert" && pinned.index === i}
                      aria-label={`${nameOf(i)} expert, ${count} ${count === 1 ? "token" : "tokens"}${full ? ", at capacity" : ""}${rank >= 0 ? `, ${dropped ? "skipped" : `${ORDINAL[rank]} choice`} for ${view.lit?.token}` : ""}`}
                      onPointerEnter={(event) => {
                        if (event.pointerType === "mouse") setHovered({ kind: "expert", index: i });
                      }}
                      onPointerLeave={() => setHovered(null)}
                      onFocus={(event) => {
                        setTileFocus(i);
                        if (focusVisible(event)) setFocused({ kind: "expert", index: i });
                      }}
                      onBlur={() => setFocused(null)}
                      onKeyDown={(event) => rove(event, i, expertCount, tileRefs, setTileFocus)}
                      onClick={() => togglePin({ kind: "expert", index: i })}
                    >
                      <span className={styles.gauge} aria-hidden="true" />
                      <span className={styles.tileIcon} aria-hidden="true">
                        {dropped ? <TriangleAlert size={14} strokeWidth={1.75} /> : (expert?.icon ?? initialLetter(expert?.name ?? ""))}
                      </span>
                      <span className={styles.tileName}>{nameOf(i)}</span>
                      <span className={styles.tileCount}>
                        <RollingNumber value={count} reduced={reduced} />
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className={styles.slot} data-side="in" style={boxStyle(layout.intake)}>
                <AnimatePresence initial={false}>
                  {view.input !== null && plan[view.input] && (
                    <motion.span
                      key={`in-${view.input}-${inspected ? "still" : tick.cycle}`}
                      className={styles.chip}
                      data-spent={view.inputSpent || undefined}
                      initial={reduced ? { opacity: 0 } : layout.wide ? { opacity: 0, x: -14 } : { opacity: 0, y: -8 }}
                      animate={{
                        opacity: 1,
                        x: 0,
                        y: 0,
                        transition: reduced
                          ? { duration: 0 }
                          : { duration: motionTokens.duration.standard, ease: motionTokens.ease.standard },
                      }}
                      exit={{ opacity: 0, transition: { duration: 0.1 * Number(!reduced) } }}
                    >
                      {plan[view.input].token}
                    </motion.span>
                  )}
                </AnimatePresence>
                {tokenCount === 0 && (
                  <span className={styles.chip} data-empty="">
                    Empty
                  </span>
                )}
              </div>
              <div className={styles.slot} data-side="out" style={boxStyle(layout.output)}>
                <AnimatePresence initial={false}>
                  {view.output >= 0 &&
                    plan[view.output] &&
                    (() => {
                      const out = plan[view.output];
                      return (
                        <motion.span
                          key={`out-${view.output}-${inspected ? "still" : tick.cycle}`}
                          className={styles.chip}
                          data-out=""
                          data-pass={out.dropped.length === out.experts.length || undefined}
                          initial={reduced ? { opacity: 0 } : layout.wide ? { opacity: 0, x: -10 } : { opacity: 0, y: -6 }}
                          animate={{
                            opacity: 1,
                            x: 0,
                            y: 0,
                            transition: reduced
                              ? { duration: 0 }
                              : { duration: motionTokens.duration.standard, ease: motionTokens.ease.standard },
                          }}
                          exit={
                            reduced
                              ? { opacity: 0, transition: { duration: 0 } }
                              : layout.wide
                                ? {
                                    opacity: 0,
                                    x: 10,
                                    transition: { duration: motionTokens.duration.fast, ease: motionTokens.ease.standard },
                                  }
                                : { opacity: 0, y: 6, transition: { duration: motionTokens.duration.fast } }
                          }
                        >
                          <span className={styles.chipDots} aria-hidden="true">
                            {out.experts.map((expert, i) =>
                              out.dropped.includes(expert) ? null : <i key={expert} data-rank={i} />,
                            )}
                          </span>
                          {out.token}
                        </motion.span>
                      );
                    })()}
                </AnimatePresence>
              </div>
              <svg
                className={styles.packets}
                width={layout.w}
                height={layout.h}
                viewBox={`0 0 ${layout.w} ${layout.h}`}
                aria-hidden="true"
              >
                {[0, 1, 2, 3, 4, 5].map((slot) => (
                  <g
                    key={slot}
                    ref={(node) => {
                      packets.current[slot] = node;
                    }}
                    className={styles.packet}
                    data-slot={slot === 0 || slot === 5 ? "flow" : (slot - 1) % 2}
                    style={{ opacity: 0 }}
                  >
                    <path className={styles.trailLong} />
                    <path className={styles.trailShort} />
                    <circle className={styles.dot} r={3.5} />
                  </g>
                ))}
              </svg>
            </>
          )}
        </div>
        <div className={styles.sequence} role="group" aria-label="Tokens. Hover, focus or select one to see its route.">
          {plan.map((route, i) => {
            const status =
              isDone || i < tick.index || (i === tick.index && phaseIndex >= PHASE.out)
                ? "done"
                : i === tick.index
                  ? "current"
                  : "next";
            const rank = inspectedExpert !== null ? route.experts.indexOf(inspectedExpert) : -1;
            const pinnedHere = pinned?.kind === "token" && pinned.index === i;
            return (
              <button
                key={i}
                ref={(node) => {
                  tokenRefs.current[i] = node;
                }}
                type="button"
                className={styles.token}
                data-state={status}
                data-inspect={inspected?.index === i || undefined}
                data-rank={rank >= 0 && !route.dropped.includes(inspectedExpert ?? -1) ? rank : undefined}
                data-dropped={rank >= 0 && route.dropped.includes(inspectedExpert ?? -1) ? "" : undefined}
                data-fade={inspectedExpert !== null && rank < 0 ? "" : undefined}
                tabIndex={i === tokenFocus ? 0 : -1}
                aria-pressed={pinnedHere}
                aria-label={`${route.token}: ${route.experts
                  .map((expert, index) => `${nameOf(expert)} ${route.dropped.includes(expert) ? "skipped, at capacity" : percent(route.weights[index])}`)
                  .join(", ")}`}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") setHovered({ kind: "token", index: i });
                }}
                onPointerLeave={() => setHovered(null)}
                onFocus={(event) => {
                  setTokenFocus(i);
                  if (focusVisible(event)) setFocused({ kind: "token", index: i });
                }}
                onBlur={() => setFocused(null)}
                onKeyDown={(event) => rove(event, i, tokenCount, tokenRefs, setTokenFocus)}
                onClick={() => togglePin({ kind: "token", index: i })}
              >
                {route.token}
              </button>
            );
          })}
          {tokenCount === 0 && <span className={styles.sequenceEmpty}>No tokens to route</span>}
        </div>
        <div className={styles.footer}>
          <div className={styles.inspector}>
            <div className={styles.line}>
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div key={lineKey} className={styles.lineInner} {...variants}>
                  {lineContent}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className={styles.note}>
              <AnimatePresence initial={false} mode="popLayout">
                <motion.p key={`${lineKey}-note`} className={styles.noteInner} {...variants}>
                  {note.icon}
                  <span>{note.text}</span>
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
          <div className={styles.load}>
            <div className={styles.loadHead}>
              <span>Load balance</span>
              <span className={styles.loadValue}>
                {balance === null ? (
                  <span className={styles.lineMuted}>No routes yet</span>
                ) : (
                  <>
                    <RollingNumber value={100 * balance} reduced={reduced} />%
                  </>
                )}
              </span>
            </div>
            <div className={styles.loadBar} aria-hidden="true" data-empty={routeCount === 0 || undefined}>
              {shownLoads.map((value, i) => {
                const rank = rankIn(view.lit, i);
                return (
                  <span
                    key={i}
                    className={styles.seg}
                    style={{ flexGrow: value }}
                    data-zero={value === 0 || undefined}
                    data-rank={rank >= 0 && !view.lit?.dropped.includes(i) ? rank : undefined}
                    data-inspect={inspectedExpert === i || undefined}
                    onPointerEnter={(event) => {
                      if (event.pointerType === "mouse") setHovered({ kind: "expert", index: i });
                    }}
                    onPointerLeave={() => setHovered(null)}
                  />
                );
              })}
            </div>
            <span className={styles.srOnly}>
              {balance === null
                ? "No routes yet"
                : `Load balance ${Math.round(100 * balance)} percent across ${expertCount} experts, ${routeCount} routes`}
            </span>
          </div>
        </div>
        <span className={styles.srOnly} role="status" aria-live="polite">
          {message}
        </span>
      </div>
    </div>
  );
}

export function MixtureOfExpertsDemo() {
  return (
    <div className={styles.demo}>
      <MixtureOfExperts />
    </div>
  );
}

export default MixtureOfExpertsDemo;
