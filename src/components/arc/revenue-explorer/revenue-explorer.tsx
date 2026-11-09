"use client";

import { ArrowUpRight } from "lucide-react";
import {
  AnimatePresence,
  LayoutGroup,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
  type Transition,
} from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./revenue-explorer.module.css";

/* ------------------------------------------------------------------ types */

export interface RevenueExplorerProps {
  /**
   * Renders without the block's own surface. The preview frame flattens the card.
   */
  flat?: boolean;
}

type SeriesKey = "newMrr" | "expansion" | "churn";
type ActiveSeries = [boolean, boolean, boolean];
type DragPart = "move" | "lo" | "hi";

interface MonthPoint {
  newMrr: number;
  expansion: number;
  churn: number;
  start: number;
  mrr: number;
}

interface Range {
  a: number;
  b: number;
}

interface Measurement {
  lo: number;
  hi: number;
  active: ActiveSeries;
  compare: boolean;
  y: [number, number];
  offset: number;
}

interface DragState {
  part: DragPart;
  x: number;
  lo: number;
  hi: number;
  perMonth: number;
  moved: boolean;
}

interface Shapes {
  areaNew: string;
  areaExp: string;
  areaChurn: string;
  lineNew: string;
  lineExp: string;
  lineChurn: string;
  prevTop: string;
  prevLow: string;
  prevTopOpacity: number;
  prevLowOpacity: number;
  cross: number;
  crossOpacity: number;
  dotNew: number;
  dotExp: number;
  dotChurn: number;
  panelX: number;
}

interface Overview {
  base: number;
  top: string;
  low: string;
  areaTop: string;
  areaLow: string;
  years: { index: number; x: number; label: string }[];
}

/* ------------------------------------------------------------- constants */

const SERIES: { key: SeriesKey; label: string }[] = [
  { key: "newMrr", label: "New" },
  { key: "expansion", label: "Expansion" },
  { key: "churn", label: "Churn" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The sample workspace is a year of seasonally paced growth: slow summers, a strong Q4 and a January dip. */
const SEASONALITY = [1.08, 1, 1.12, 1.02, 1, 1.05, 0.9, 0.88, 1.06, 1.1, 1, 0.82];

const { spring, duration, ease } = motionTokens;
const ENTER_EASE = [...ease.enter] as [number, number, number, number];
const FASTER_SMOOTH: Transition = { ...spring.smooth, visualDuration: 0.26 };
const COMPARE_SPRING: Transition = { ...spring.smooth, visualDuration: duration.considered };

const PRESETS = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "12M", months: 12 },
  { label: "All", months: 24 },
];

const INITIAL_RANGE = { lo: 12, hi: 23 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(10 * value) / 10;

/* ------------------------------------------------------------------- data */

/** Forty-eight months of seeded movements, so the chart is identical on every load and on the server. */
const HISTORY: MonthPoint[] = (() => {
  let seed = 0x13527d6;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
  const rounded = (value: number) => 100 * Math.round(value / 100);
  const points: MonthPoint[] = [];
  let start = 486e3;
  for (let index = 0; index < 48; index++) {
    const jitter = (spread: number) => 1 + (random() - 0.5) * spread;
    const newMrr = rounded((27e3 + 900 * index) * SEASONALITY[(8 + index) % 12] * jitter(0.16));
    const expansion = rounded((5400 + 420 * index) * (index >= 37 ? 1.34 : 1) * jitter(0.22));
    const churn = rounded(start * (0.0205 - 12e-5 * index + (index === 29 ? 0.0105 : index === 30 ? 0.0045 : 0) + (random() - 0.5) * 0.003));
    points.push({ newMrr, expansion, churn, start, mrr: start + newMrr + expansion - churn });
    start = points[index].mrr;
  }
  return points;
})();

/** The month at an index counted from the start of the visible window (0 is Sep 2025). */
const point = (index: number) => HISTORY[Math.min(47, Math.max(0, index + 24))];

/** A value between two months, so a path edge can sit on a fractional month while the range springs. */
function interpolate(index: number, key: SeriesKey): number {
  const floor = Math.floor(index);
  const fraction = index - floor;
  return fraction ? point(floor)[key] * (1 - fraction) + point(floor + 1)[key] * fraction : point(floor)[key];
}

const netNew = (value: MonthPoint) => value.newMrr + value.expansion - value.churn;

function calendar(index: number) {
  return { m: (index + 32) % 12, y: 2022 + Math.floor((index + 32) / 12) };
}

const isJanuary = (index: number) => calendar(index).m === 0;

function monthName(index: number) {
  const { m, y } = calendar(index);
  return `${MONTHS[m]} ${y}`;
}

/** Month labels only spell out the year in January, so the axis stays quiet. */
function tickLabel(index: number) {
  const { m, y } = calendar(index);
  return m === 0 ? String(y) : MONTHS[m];
}

function sumMonths(from: number, to: number, read: (value: MonthPoint) => number) {
  let total = 0;
  for (let index = from; index <= to; index++) total += read(point(index));
  return total;
}

/** The y axis a range needs, rounded to $500 so tick labels land on round money. */
function domainFor(lo: number, hi: number, active: ActiveSeries, compare: boolean, offset: number): [number, number] {
  let top = 0;
  let bottom = 0;
  for (let index = Math.max(0, Math.floor(lo)); index <= Math.min(23, Math.ceil(hi)); index++) {
    for (const sample of compare ? [point(index), point(index - offset)] : [point(index)]) {
      top = Math.max(top, (active[0] ? sample.newMrr : 0) + (active[1] ? sample.expansion : 0));
      bottom = Math.max(bottom, active[2] ? sample.churn : 0);
    }
  }
  if (!top && !bottom) return [0, 8e4];
  const round = (value: number) => 500 * Math.round(value / 500);
  return [bottom ? -round(1.2 * bottom) : 0, round(top ? 1.1 * top : 0.2 * bottom)];
}

/** Money the way the labels want it: $2.56M, $63.3k, −$1.2k. */
function money(value: number) {
  const sign = value < 0 ? "−" : "";
  const size = Math.abs(value);
  if (size >= 1e6) return `${sign}$${(size / 1e6).toFixed(2)}M`;
  if (size >= 1e3) return `${sign}$${(size / 1e3).toFixed(size >= 1e5 || size % 1e3 === 0 ? 0 : 1)}k`;
  return `${sign}$${Math.round(size)}`;
}

const signed = (value: number, decimals: number, suffix: string) => `${value < 0 ? "−" : "+"}${Math.abs(value).toFixed(decimals)}${suffix}`;

const xAt = (value: number, lo: number, hi: number, width: number) => 48 + ((value - lo) / Math.max(1e-6, hi - lo)) * (width - 48);

/* ------------------------------------------------------------------ paths */

/** Monotone cubic tangents, so an area never overshoots its own peaks. */
function tangents(points: [number, number][]): number[] {
  const count = points.length;
  const slopes = Array<number>(count).fill(0);
  if (count < 2) return slopes;
  if (count === 2) return slopes.fill((points[1][1] - points[0][1]) / (points[1][0] - points[0][0] || 1));
  for (let index = 1; index < count - 1; index++) {
    const before = points[index][0] - points[index - 1][0];
    const after = points[index + 1][0] - points[index][0];
    const rise = (points[index][1] - points[index - 1][1]) / before;
    const fall = (points[index + 1][1] - points[index][1]) / after;
    slopes[index] =
      (Math.sign(rise) + Math.sign(fall)) * Math.min(Math.abs(rise), Math.abs(fall), 0.5 * Math.abs((rise * after + fall * before) / (before + after))) || 0;
  }
  slopes[0] = ((3 * (points[1][1] - points[0][1])) / (points[1][0] - points[0][0]) - slopes[1]) / 2;
  slopes[count - 1] = ((3 * (points[count - 1][1] - points[count - 2][1])) / (points[count - 1][0] - points[count - 2][0]) - slopes[count - 2]) / 2;
  return slopes;
}

/** A smooth path through points, drawn as one cubic per segment. */
function curve(points: [number, number][], command = "M"): string {
  if (!points.length) return "";
  const slopes = tangents(points);
  let path = `${command}${round1(points[0][0])},${round1(points[0][1])}`;
  for (let index = 1; index < points.length; index++) {
    const handle = (points[index][0] - points[index - 1][0]) / 3;
    path += `C${round1(points[index - 1][0] + handle)},${round1(points[index - 1][1] + handle * slopes[index - 1])},${round1(points[index][0] - handle)},${round1(points[index][1] - handle * slopes[index])},${round1(points[index][0])},${round1(points[index][1])}`;
  }
  return path;
}

const reverseCurve = (points: [number, number][]) => curve([...points].reverse(), "L");

/** Panel width and chart height step down on narrow blocks instead of shrinking the type. */
const panelWidth = (width: number) => (width < 520 ? 172 : 204);
const chartHeight = (width: number) => (width < 560 ? 216 : 256);

/** A drag that outruns the brush eases off instead of snapping, so the edge feels weighted. */
const damp = (overshoot: number, limit = 1.2) => Math.sign(overshoot) * (1 - 1 / ((0.55 * Math.abs(overshoot)) / limit + 1)) * limit;

/** Move a motion value unless it is already there; reduced motion jumps straight to the target. */
function drive(value: MotionValue<number>, to: number, transition: Transition, reduce: boolean) {
  if (reduce) value.jump(to);
  else if (value.get() !== to || value.isAnimating()) animate(value, to, transition);
}

/** All the paths for one frame, read from the motion values in the order they were created. */
function buildShapes(input: {
  x0: number;
  x1: number;
  yLo: number;
  yHi: number;
  weights: [number, number, number];
  compare: number;
  offset: number;
  width: number;
  height: number;
  hover: number;
}): Shapes {
  const plot = input.height - 28;
  const x = (month: number) => 48 + ((month - input.x0) / Math.max(1e-6, input.x1 - input.x0)) * (input.width - 48);
  const y = (value: number) => 14 + ((input.yHi - value) / Math.max(1, input.yHi - input.yLo)) * (plot - 14);
  const [newWeight, expWeight, churnWeight] = input.weights;
  const mix = input.compare;
  const from = Math.max(0, Math.floor(input.x0) - 1);
  const to = Math.min(23, Math.ceil(input.x1) + 1);

  const newPoints: [number, number][] = [];
  const expPoints: [number, number][] = [];
  const churnPoints: [number, number][] = [];
  const previousTop: [number, number][] = [];
  const previousLow: [number, number][] = [];

  for (let month = from; month <= to; month++) {
    const value = point(month);
    const at = x(month);
    const added = value.newMrr * newWeight;
    const expanded = added + value.expansion * expWeight;
    const churned = value.churn * churnWeight;
    const previousAdded = interpolate(month - input.offset, "newMrr") * newWeight + interpolate(month - input.offset, "expansion") * expWeight;
    const previousChurned = interpolate(month - input.offset, "churn") * churnWeight;
    newPoints.push([at, y(added)]);
    expPoints.push([at, y(expanded)]);
    churnPoints.push([at, y(-churned)]);
    previousTop.push([at, y(expanded + (previousAdded - expanded) * mix)]);
    previousLow.push([at, y(-churned - (previousChurned - churned) * mix)]);
  }

  const base = round1(y(0));
  const first = round1(newPoints[0][0]);
  const last = round1(newPoints[newPoints.length - 1][0]);
  const hovering = input.hover >= from && input.hover <= to;
  const cross = hovering ? Math.round(x(input.hover)) + 0.5 : -100;
  const hovered = point(Math.max(0, input.hover));
  const panel = panelWidth(input.width);
  const band = clamp(1.6 * mix, 0, 1);

  return {
    areaNew: `${curve(newPoints)}L${last},${base}L${first},${base}Z`,
    areaExp: `${curve(expPoints)}${reverseCurve(newPoints)}Z`,
    areaChurn: `M${first},${base}L${last},${base}${reverseCurve(churnPoints)}Z`,
    lineNew: curve(newPoints),
    lineExp: curve(expPoints),
    lineChurn: curve(churnPoints),
    prevTop: curve(previousTop),
    prevLow: curve(previousLow),
    prevTopOpacity: band * clamp(newWeight + expWeight, 0, 1),
    prevLowOpacity: band * churnWeight,
    cross,
    crossOpacity: hovering && cross >= 47 && cross <= input.width + 1 ? 1 : 0,
    dotNew: y(hovered.newMrr * newWeight),
    dotExp: y(hovered.newMrr * newWeight + hovered.expansion * expWeight),
    dotChurn: y(-hovered.churn * churnWeight),
    panelX: cross + 14 + panel <= input.width ? cross + 14 : Math.max(0, cross - 14 - panel),
  };
}

/* ---------------------------------------------------------- subcomponents */

/** A line of text that swaps by rising out and in, so the header keeps its rhythm as the range changes. */
function Rise({ text, className }: { text: string; className?: string }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <span className={[styles.rise, className].filter(Boolean).join(" ")}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: "0.45em" }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: "-0.45em" }}
          transition={{ duration: reduce ? duration.instant : duration.standard, ease: ENTER_EASE }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** A KPI figure. The counter owns the digits; this only sizes them. */
function Figure({ value, decimals = 1, prefix = "$", suffix = "" }: { value: number; decimals?: number; prefix?: string; suffix?: string }) {
  return (
    <span className={styles.num}>
      <AnimatedCounter value={value} decimals={decimals} prefix={prefix} suffix={suffix} />
    </span>
  );
}

/** A change against the previous window: the arrow rotates rather than swapping glyphs. */
function Delta({ text, change, good, context }: { text: string; change: number; good: boolean; context: string }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <span className={styles.delta} data-tone={good ? "good" : "bad"}>
      <motion.span
        className={styles.deltaIcon}
        initial={false}
        animate={{ rotate: change >= 0 ? 0 : 90 }}
        transition={reduce ? { duration: 0 } : spring.snappy}
      >
        <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" />
      </motion.span>
      <Rise text={text} className={styles.deltaValue} />
      <Rise text={context} className={styles.deltaContext} />
    </span>
  );
}

const axisTransition = (reduce: boolean) => ({ duration: reduce ? duration.instant : duration.standard, ease: ENTER_EASE, delay: 0.05 * Number(!reduce) });

/** A gridline and its money label; both ride the y domain when the range changes. */
function GridLine({
  value,
  yLo,
  yHi,
  height,
  width,
  reduce,
}: {
  value: number;
  yLo: MotionValue<number>;
  yHi: MotionValue<number>;
  height: MotionValue<number>;
  width: number;
  reduce: boolean;
}) {
  const y = useTransform([yLo, yHi, height], ([lo = 0, hi = 0, frame = 0]: number[]) =>
    Math.round(14 + ((hi - value) / Math.max(1, hi - lo)) * (frame - 28 - 14)),
  );
  const opacity = useTransform([y, height], ([top = 0, frame = 0]: number[]) => clamp(1 - Math.max(6 - top, top - (frame - 28) - 2, 0) / 10, 0, 1));
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: duration.fast } }}
      transition={axisTransition(reduce)}
    >
      <motion.g style={{ y, opacity }}>
        <line className={value === 0 ? styles.zero : styles.gridLine} x1={48} x2={width} y1={0.5} y2={0.5} />
        <text className={styles.axisLabel} x={38} y={0.5} dy=".32em" textAnchor="end">
          {money(value)}
        </text>
      </motion.g>
    </motion.g>
  );
}

/** A month label on the x axis, clamped so the first and last never sit under the plot edge. */
function MonthTick({
  index,
  x0,
  x1,
  width,
  y,
  reduce,
}: {
  index: number;
  x0: MotionValue<number>;
  x1: MotionValue<number>;
  width: MotionValue<number>;
  y: number;
  reduce: boolean;
}) {
  const raw = useTransform([x0, x1, width], ([lo = 0, hi = 0, frame = 0]: number[]) => xAt(index, lo, hi, frame));
  const x = useTransform([raw, width], ([left = 0, frame = 0]: number[]) => clamp(left, 62, frame - 16));
  const opacity = useTransform([raw, width], ([left = 0, frame = 0]: number[]) => clamp(1 - Math.max(48 - left, left - frame, 0) / 18, 0, 1));
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: duration.fast } }}
      transition={axisTransition(reduce)}
    >
      <motion.text className={styles.axisLabel} style={{ x, opacity }} y={y} textAnchor="middle">
        {tickLabel(index)}
      </motion.text>
    </motion.g>
  );
}

/** The whole chart: header, KPIs, series switches, plot, scrub panel and the range brush under it. */
export function RevenueExplorer({ flat = false }: RevenueExplorerProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const clipId = `${uid}-clip`;
  const tableId = `${uid}-table`;
  const titleId = `${uid}-title`;

  const [width, setWidth] = useState(720);
  const [range, setRange] = useState<Range>({ a: INITIAL_RANGE.lo, b: INITIAL_RANGE.hi });
  const [domain, setDomain] = useState<[number, number]>(() => domainFor(INITIAL_RANGE.lo, INITIAL_RANGE.hi, [true, true, true], false, 12));
  const [active, setActive] = useState<ActiveSeries>([true, true, true]);
  const [compare, setCompare] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [dragPart, setDragPart] = useState<DragPart | null>(null);
  const [presetMonths, setPresetMonths] = useState(12);

  const rangeLo = useMotionValue(INITIAL_RANGE.lo);
  const rangeHi = useMotionValue(INITIAL_RANGE.hi);
  const animatedLo = useMotionValue(INITIAL_RANGE.lo);
  const animatedHi = useMotionValue(INITIAL_RANGE.hi);
  const yLo = useMotionValue(domain[0]);
  const yHi = useMotionValue(domain[1]);
  const newOpacity = useMotionValue(1);
  const expOpacity = useMotionValue(1);
  const churnOpacity = useMotionValue(1);
  const compareMix = useMotionValue(0);
  const offsetMonths = useMotionValue(12);
  const widthValue = useMotionValue(720);
  const heightValue = useMotionValue(chartHeight(720));
  const hoverValue = useMotionValue(-1);

  const shapes = useTransform(
    [rangeLo, rangeHi, yLo, yHi, newOpacity, expOpacity, churnOpacity, compareMix, offsetMonths, widthValue, heightValue, hoverValue],
    ([x0 = 0, x1 = 0, lo = 0, hi = 0, newWeight = 0, expWeight = 0, churnWeight = 0, mix = 0, offset = 0, frame = 0, frameHeight = 0, pointer = -1]: number[]) =>
      buildShapes({ x0, x1, yLo: lo, yHi: hi, weights: [newWeight, expWeight, churnWeight], compare: mix, offset, width: frame, height: frameHeight, hover: pointer }),
  );

  const areaNew = useTransform(shapes, (value) => value.areaNew);
  const areaExp = useTransform(shapes, (value) => value.areaExp);
  const areaChurn = useTransform(shapes, (value) => value.areaChurn);
  const lineNew = useTransform(shapes, (value) => value.lineNew);
  const lineExp = useTransform(shapes, (value) => value.lineExp);
  const lineChurn = useTransform(shapes, (value) => value.lineChurn);
  const prevTop = useTransform(shapes, (value) => value.prevTop);
  const prevLow = useTransform(shapes, (value) => value.prevLow);
  const prevTopOpacity = useTransform(shapes, (value) => value.prevTopOpacity);
  const prevLowOpacity = useTransform(shapes, (value) => value.prevLowOpacity);
  const cross = useTransform(shapes, (value) => value.cross);
  const crossOpacity = useTransform(shapes, (value) => value.crossOpacity);
  const dotNew = useTransform(shapes, (value) => value.dotNew);
  const dotExp = useTransform(shapes, (value) => value.dotExp);
  const dotChurn = useTransform(shapes, (value) => value.dotChurn);
  const panelTarget = useTransform(shapes, (value) => value.panelX);
  const panelSpring = useSpring(panelTarget, { visualDuration: 0.22, bounce: 0 });
  const panelX = reduce ? panelTarget : panelSpring;

  const handleStart = useTransform([animatedLo, widthValue], ([lo = 0, frame = 0]: number[]) => xAt(lo, 0, 23, frame));
  const handleEnd = useTransform([animatedHi, widthValue], ([hi = 0, frame = 0]: number[]) => xAt(hi, 0, 23, frame));
  const windowWidth = useTransform([handleStart, handleEnd], ([start = 0, end = 0]: number[]) => Math.max(0, end - start));
  const dimLeft = useTransform(handleStart, (start) => Math.max(0, start - 48));
  const dimRight = useTransform([handleEnd, widthValue], ([end = 0, frame = 0]: number[]) => Math.max(0, frame - end));
  const startX = useTransform(handleStart, (start) => start - 12);
  const endX = useTransform(handleEnd, (end) => end - 4);

  const latest = useRef<Measurement>({ ...INITIAL_RANGE, active: [true, true, true], compare: false, y: domain, offset: 12 });
  const drag = useRef<DragState | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  /** Point the readout at a month, and park the panel on the side with room the first time it opens. */
  function showMonth(month: number | null) {
    const previous = hoverValue.get();
    hoverValue.set(month ?? -1);
    setHover(month);
    if (month !== null && previous < 0) {
      const x = Math.round(xAt(month, rangeLo.get(), rangeHi.get(), widthValue.get())) + 0.5;
      const panel = panelWidth(widthValue.get());
      panelSpring.jump(x + 14 + panel <= widthValue.get() ? x + 14 : Math.max(0, x - 14 - panel));
    }
  }

  /** The one place a new window is committed: brush, presets and keyboard all funnel through here. */
  function applyRange(patch: Partial<Measurement>, snap = false) {
    const state = Object.assign(latest.current, patch);
    drive(rangeLo, state.lo, snap ? FASTER_SMOOTH : spring.smooth, reduce);
    drive(rangeHi, state.hi, snap ? FASTER_SMOOTH : spring.smooth, reduce);
    const a = Math.round(state.lo);
    const b = Math.round(state.hi);
    const months = b - a + 1;
    const next = domainFor(state.lo, state.hi, state.active, state.compare, months);
    if (next[0] !== state.y[0] || next[1] !== state.y[1]) {
      state.y = next;
      drive(yLo, next[0], spring.smooth, reduce);
      drive(yHi, next[1], spring.smooth, reduce);
      setDomain(next);
    }
    if (months !== state.offset) {
      state.offset = months;
      drive(offsetMonths, months, spring.smooth, reduce);
    }
    setRange((current) => (current.a === a && current.b === b ? current : { a, b }));
    const pointer = hoverValue.get();
    if (pointer >= 0 && (pointer < a || pointer > b)) showMonth(clamp(pointer, a, b));
  }

  /** Move both edges and re-scale, keeping at least a two-month window. */
  function setWindow(lo: number, hi: number, transition: Transition) {
    const a = Math.round(lo);
    const b = Math.max(a + 2, Math.round(hi));
    drive(animatedLo, a, transition, reduce);
    drive(animatedHi, b, transition, reduce);
    applyRange({ lo: a, hi: b });
  }

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (!next) return;
      setWidth(next);
      widthValue.set(next);
      heightValue.set(chartHeight(next));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [heightValue, widthValue]);

  const scrub = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const lo = rangeLo.get();
    const hi = rangeHi.get();
    const month = clamp(Math.round(lo + ((event.clientX - box.left) / Math.max(1, box.width)) * (hi - lo)), Math.max(0, Math.ceil(lo - 0.001)), Math.min(23, Math.floor(hi + 0.001)));
    if (month !== hoverValue.get()) showMonth(month);
  };

  const endDrag = () => {
    const state = drag.current;
    if (!state) return;
    drag.current = null;
    setDragPart(null);
    setWindow(latest.current.lo, latest.current.hi, state.moved ? spring.snappy : spring.smooth);
  };

  /** Arrow keys step a month, shift three; Home and End jump to either boundary of the editable edge. */
  const brushKeys = (mode: DragPart, event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 3 : 1;
    const delta =
      event.key === "ArrowLeft" || event.key === "ArrowDown" ? -step : event.key === "ArrowRight" || event.key === "ArrowUp" ? step : 0;
    if (!delta && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const { lo, hi } = latest.current;
    const span = hi - lo;
    let nextLo = lo;
    let nextHi = hi;
    if (mode === "move") {
      nextLo = event.key === "Home" ? 0 : event.key === "End" ? 23 - span : clamp(lo + delta, 0, 23 - span);
      nextHi = nextLo + span;
    } else if (mode === "lo") {
      nextLo = event.key === "Home" ? 0 : event.key === "End" ? hi - 2 : clamp(lo + delta, 0, hi - 2);
    } else {
      nextHi = event.key === "Home" ? lo + 2 : event.key === "End" ? 23 : clamp(hi + delta, lo + 2, 23);
    }
    setWindow(nextLo, nextHi, spring.snappy);
  };

  const activePreset = PRESETS.find((preset) => range.a === 23 - preset.months + 1 && range.b === 23)?.months ?? null;
  if (activePreset !== null && activePreset !== presetMonths) setPresetMonths(activePreset);

  const plotHeight = chartHeight(width);
  const yTicks = useMemo(() => {
    const span = (domain[1] - domain[0]) / Math.max(3, (plotHeight - 14 - 28) / 40);
    const magnitude = 10 ** Math.floor(Math.log10(span));
    const ratio = span / magnitude;
    const step = (ratio < 1.5 ? 1 : ratio < 2.25 ? 2 : ratio < 3 ? 2.5 : ratio < 7 ? 5 : 10) * magnitude;
    const ticks: number[] = [];
    for (let value = Math.ceil(domain[0] / step) * step; value <= domain[1] + 1e-6; value += step) ticks.push(Math.round(value) || 0);
    return ticks;
  }, [domain, plotHeight]);

  const labelEvery = useMemo(() => {
    const perMonth = (width - 48) / Math.max(2, range.b - range.a);
    return [1, 2, 3, 6, 12].find((step) => perMonth * step >= 46) ?? 12;
  }, [range.a, range.b, width]);

  const labelledMonths = useMemo(
    () => Array.from({ length: 24 }, (_, index) => index).filter((index) => calendar(index).m % labelEvery === 0),
    [labelEvery],
  );

  /** The KPI strip is a summary of the same window the plot shows, so both move together. */
  const summary = useMemo(() => {
    const months = range.b - range.a + 1;
    const average = (from: number, to: number) => sumMonths(from, to, netNew) / months;
    const churnRate = (from: number, to: number) => (sumMonths(from, to, (value) => value.churn) / sumMonths(from, to, (value) => value.start)) * 100;
    const mrr = point(range.b).mrr;
    const previousMrr = point(range.a - 1).mrr;
    const net = average(range.a, range.b);
    const previousNet = average(range.a - months, range.b - months);
    const churn = churnRate(range.a, range.b);
    return {
      months,
      mrr,
      since: monthName(range.a - 1),
      mrrChange: ((mrr - previousMrr) / previousMrr) * 100,
      net,
      netChange: ((net - previousNet) / previousNet) * 100,
      churn,
      churnChange: churn - churnRate(range.a - months, range.b - months),
    };
  }, [range.a, range.b]);

  /** The brush strip compresses all 24 months, so its shape never changes with the selection. */
  const overview = useMemo<Overview>(() => {
    const x = (month: number) => 48 + (month / 23) * (width - 48);
    let top = 0;
    let low = 0;
    for (let month = 0; month <= 23; month++) {
      const value = point(month);
      top = Math.max(top, value.newMrr + value.expansion);
      low = Math.max(low, value.churn);
    }
    const y = (value: number) => 4 + ((top - value) / (top + low)) * 36;
    const topPoints: [number, number][] = [];
    const lowPoints: [number, number][] = [];
    for (let month = 0; month <= 23; month++) {
      const value = point(month);
      topPoints.push([x(month), y(value.newMrr + value.expansion)]);
      lowPoints.push([x(month), y(-value.churn)]);
    }
    const base = round1(y(0));
    return {
      base,
      top: curve(topPoints),
      low: curve(lowPoints),
      areaTop: `${curve(topPoints)}L${round1(width)},${base}L48,${base}Z`,
      areaLow: `M48,${base}L${round1(width)},${base}${reverseCurve(lowPoints)}Z`,
      years: Array.from({ length: 24 }, (_, index) => index)
        .filter(isJanuary)
        .map((index) => ({ index, x: Math.round(x(index)) + 0.5, label: tickLabel(index) })),
    };
  }, [width]);

  const months = Array.from({ length: range.b - range.a + 1 }, (_, index) => range.a + index);
  const start = calendar(range.a);
  const end = calendar(range.b);
  const rangeLabel = start.y === end.y ? `${MONTHS[start.m]} – ${MONTHS[end.m]} ${end.y}` : `${MONTHS[start.m]} ${start.y} – ${MONTHS[end.m]} ${end.y}`;
  const compareLabel = `vs previous ${summary.months} months`;
  const hovered = hover === null ? null : point(hover);
  const hoverText =
    hover !== null && hovered
      ? `${monthName(hover)}: new ${money(hovered.newMrr)}, expansion ${money(hovered.expansion)}, churn ${money(-hovered.churn)}, net new ${money(netNew(hovered))}`
      : undefined;

  return (
    <section
      className={styles.root}
      aria-labelledby={titleId}
      data-frame-flat={flat ? "" : undefined}
      style={flat ? { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" } : undefined}
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.heading}>
            <h2 id={titleId}>Recurring revenue</h2>
            <p>
              <Rise text={rangeLabel} />
            </p>
          </div>
          <LayoutGroup id={`${uid}-presets`}>
            <div className={styles.presets} role="group" aria-label="Range">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className={styles.preset}
                  aria-pressed={activePreset === preset.months}
                  aria-label={preset.months === 24 ? "All 24 months" : `Last ${preset.months} months`}
                  onClick={() => setWindow(23 - preset.months + 1, 23, spring.smooth)}
                >
                  {presetMonths === preset.months && (
                    <motion.span
                      layoutId="preset"
                      className={styles.presetPill}
                      initial={false}
                      animate={{ opacity: Number(activePreset !== null) }}
                      transition={reduce ? { duration: 0 } : spring.snappy}
                    />
                  )}
                  <span className={styles.presetLabel}>{preset.label}</span>
                </button>
              ))}
            </div>
          </LayoutGroup>
        </header>

        <dl className={styles.kpis}>
          <div className={styles.kpi}>
            <dt>MRR</dt>
            <dd className={styles.value}>
              <Figure value={summary.mrr / 1e6} decimals={2} suffix="M" />
            </dd>
            <dd>
              <Delta text={signed(summary.mrrChange, 1, "%")} change={summary.mrrChange} good={summary.mrrChange >= 0} context={`since ${summary.since}`} />
            </dd>
          </div>
          <div className={styles.kpi}>
            <dt>Net new per month</dt>
            <dd className={styles.value}>
              <Figure value={summary.net / 1e3} suffix="k" />
            </dd>
            <dd>
              <Delta text={signed(summary.netChange, 1, "%")} change={summary.netChange} good={summary.netChange >= 0} context={compareLabel} />
            </dd>
          </div>
          <div className={styles.kpi}>
            <dt>Churn rate</dt>
            <dd className={styles.value}>
              <Figure value={summary.churn} decimals={2} prefix="" suffix="%" />
            </dd>
            <dd>
              <Delta text={signed(summary.churnChange, 2, " pts")} change={summary.churnChange} good={summary.churnChange <= 0} context={compareLabel} />
            </dd>
          </div>
        </dl>

        <div className={styles.toolbar}>
          <div className={styles.legend} role="group" aria-label="Series">
            {SERIES.map((series, index) => (
              <button
                key={series.key}
                type="button"
                className={styles.toggle}
                data-series={series.key}
                aria-pressed={active[index]}
                onClick={() => {
                  const next = active.map((value, position) => (position === index ? !value : value)) as ActiveSeries;
                  setActive(next);
                  drive([newOpacity, expOpacity, churnOpacity][index], Number(next[index]), spring.smooth, reduce);
                  applyRange({ active: next });
                }}
              >
                <span className={styles.swatch} aria-hidden="true" />
                {series.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={compare}
            className={styles.switch}
            onClick={() => {
              const next = !compare;
              setCompare(next);
              drive(compareMix, Number(next), COMPARE_SPRING, reduce);
              applyRange({ compare: next });
            }}
          >
            <span className={styles.track} aria-hidden="true">
              <motion.span className={styles.thumb} initial={false} animate={{ x: 12 * Number(compare) }} transition={reduce ? { duration: 0 } : spring.snappy} />
            </span>
            Compare to previous period
          </button>
        </div>

        <div ref={chartRef} className={styles.chart}>
          <svg
            className={styles.svg}
            viewBox={`0 0 ${width} ${plotHeight}`}
            height={plotHeight}
            role="img"
            aria-label={`Stacked area chart of new, expansion and churned MRR, ${rangeLabel}. MRR reached ${money(summary.mrr)} and net new MRR averaged ${money(summary.net)} a month.`}
            aria-describedby={tableId}
          >
            <defs>
              <clipPath id={clipId}>
                <rect x={48} y={0} width={Math.max(0, width - 48)} height={plotHeight - 28 + 1} />
              </clipPath>
            </defs>
            <g aria-hidden="true">
              <AnimatePresence initial={false}>
                {yTicks.map((value) => (
                  <GridLine key={value} value={value} yLo={yLo} yHi={yHi} height={heightValue} width={width} reduce={reduce} />
                ))}
              </AnimatePresence>
              <g clipPath={`url(#${clipId})`}>
                <motion.path className={styles.areaExp} d={areaExp} />
                <motion.path className={styles.areaNew} d={areaNew} />
                <motion.path className={styles.areaChurn} d={areaChurn} />
                <motion.path className={styles.prev} d={prevTop} style={{ opacity: prevTopOpacity }} />
                <motion.path className={styles.prev} d={prevLow} style={{ opacity: prevLowOpacity }} />
                <motion.path className={styles.lineExp} d={lineExp} style={{ opacity: expOpacity }} />
                <motion.path className={styles.lineChurn} d={lineChurn} style={{ opacity: churnOpacity }} />
                <motion.path className={styles.lineNew} d={lineNew} style={{ opacity: newOpacity }} />
              </g>
              <AnimatePresence initial={false}>
                {labelledMonths.map((index) => (
                  <MonthTick key={index} index={index} x0={rangeLo} x1={rangeHi} width={widthValue} y={plotHeight - 8} reduce={reduce} />
                ))}
              </AnimatePresence>
              <motion.g className={styles.cross} style={{ x: cross, opacity: crossOpacity }}>
                <line x1={0} x2={0} y1={8} y2={plotHeight - 28} />
                <motion.circle className={styles.dotExp} r={4} cx={0} cy={dotExp} style={{ opacity: expOpacity }} />
                <motion.circle className={styles.dotNew} r={4} cx={0} cy={dotNew} style={{ opacity: newOpacity }} />
                <motion.circle className={styles.dotChurn} r={4} cx={0} cy={dotChurn} style={{ opacity: churnOpacity }} />
              </motion.g>
            </g>
          </svg>

          <div
            className={styles.hit}
            style={{ left: 48, bottom: 28 }}
            tabIndex={0}
            role="slider"
            aria-label="Inspect a month"
            aria-orientation="horizontal"
            aria-valuemin={range.a}
            aria-valuemax={range.b}
            aria-valuenow={hover ?? range.b}
            aria-valuetext={hoverText ?? monthName(range.b)}
            onPointerDown={scrub}
            onPointerMove={scrub}
            onPointerLeave={() => showMonth(null)}
            onFocus={() => {
              if (hover === null) showMonth(range.b);
            }}
            onBlur={() => showMonth(null)}
            onKeyDown={(event) => {
              const current = hover ?? range.b;
              const next =
                event.key === "ArrowLeft" || event.key === "ArrowDown"
                  ? current - 1
                  : event.key === "ArrowRight" || event.key === "ArrowUp"
                    ? current + 1
                    : event.key === "Home"
                      ? range.a
                      : event.key === "End"
                        ? range.b
                        : event.key === "Escape"
                          ? -1
                          : null;
              if (next === null) return;
              event.preventDefault();
              showMonth(next < 0 ? null : clamp(next, range.a, range.b));
            }}
          />

          <AnimatePresence>
            {hover !== null && hovered && (
              <motion.div
                key="panel"
                className={styles.panel}
                aria-hidden="true"
                style={{ x: panelX, top: 14, width: panelWidth(width) }}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: duration.fast } }}
                transition={{ duration: reduce ? duration.instant : duration.fast, ease: ENTER_EASE }}
              >
                <p className={styles.panelMonth}>
                  <Rise text={monthName(hover)} />
                </p>
                <dl className={styles.rows}>
                  {SERIES.map((series, index) => (
                    <div key={series.key} className={styles.row} data-series={series.key} data-off={active[index] ? undefined : ""}>
                      <dt>
                        <span className={styles.swatch} />
                        {series.label}
                      </dt>
                      <dd>
                        <Figure value={hovered[series.key] / 1e3} prefix={index === 2 ? "−$" : "$"} suffix="k" />
                      </dd>
                    </div>
                  ))}
                  <div className={`${styles.row} ${styles.total}`}>
                    <dt>Net new</dt>
                    <dd>
                      <Figure value={netNew(hovered) / 1e3} suffix="k" />
                    </dd>
                  </div>
                  <AnimatePresence initial={false}>
                    {compare && (
                      <motion.div
                        key="previous"
                        className={`${styles.row} ${styles.previous}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={reduce ? { duration: 0 } : spring.smooth}
                      >
                        <dt>
                          <span className={styles.dash} />
                          <Rise text={monthName(hover - summary.months)} />
                        </dt>
                        <dd>
                          <Figure value={netNew(point(hover - summary.months)) / 1e3} suffix="k" />
                        </dd>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </dl>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {!active.some(Boolean) && (
              <motion.p
                className={styles.empty}
                style={{ left: 48, bottom: 28 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? duration.instant : duration.standard, ease: ENTER_EASE, delay: 0.12 * Number(!reduce) }}
              >
                Turn on a series to see revenue
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div
          className={styles.overview}
          data-dragging={dragPart ?? undefined}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            const part = (event.target as Element).closest<HTMLElement>("[data-part]")?.dataset.part as DragPart | undefined;
            const box = event.currentTarget.getBoundingClientRect();
            const perMonth = (box.width - 48) / 23;
            let lo = clamp(animatedLo.get(), 0, 21);
            let hi = clamp(animatedHi.get(), lo + 2, 23);
            if (!part) {
              const span = latest.current.hi - latest.current.lo;
              lo = clamp(Math.round((event.clientX - box.left - 48) / perMonth - span / 2), 0, 23 - span);
              hi = lo + span;
              drive(animatedLo, lo, spring.smooth, reduce);
              drive(animatedHi, hi, spring.smooth, reduce);
              applyRange({ lo, hi });
            }
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { part: part ?? "move", x: event.clientX, lo, hi, perMonth, moved: false };
            setDragPart(part ?? "move");
          }}
          onPointerMove={(event) => {
            const state = drag.current;
            if (!state) return;
            if (!state.moved) {
              if (Math.abs(event.clientX - state.x) < 2) return;
              state.moved = true;
              animatedLo.stop();
              animatedHi.stop();
            }
            const delta = (event.clientX - state.x) / state.perMonth;
            const anchorLo = state.lo;
            const anchorHi = state.hi;
            let lo = anchorLo;
            let hi = anchorHi;
            let paintLo = anchorLo;
            let paintHi = anchorHi;
            if (state.part === "move") {
              const span = anchorHi - anchorLo;
              const target = anchorLo + delta;
              lo = clamp(target, 0, 23 - span);
              hi = lo + span;
              const overshoot = damp(target - lo);
              paintLo = lo + overshoot;
              paintHi = hi + overshoot;
            } else if (state.part === "lo") {
              const target = anchorLo + delta;
              lo = clamp(target, 0, anchorHi - 2);
              paintLo = lo + damp(target - lo);
            } else {
              const target = anchorHi + delta;
              hi = clamp(target, anchorLo + 2, 23);
              paintHi = hi + damp(target - hi);
            }
            animatedLo.set(paintLo);
            animatedHi.set(paintHi);
            applyRange({ lo, hi }, true);
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <svg className={styles.overviewSvg} viewBox={`0 0 ${width} 62`} height={62} aria-hidden="true">
            {overview.years.map((year) => (
              <g key={year.index}>
                <line className={styles.yearTick} x1={year.x} x2={year.x} y1={0} y2={48} />
                <text className={styles.axisLabel} x={year.x + 5} y={58}>
                  {year.label}
                </text>
              </g>
            ))}
            <path className={styles.overviewArea} d={overview.areaTop} />
            <path className={styles.overviewAreaLow} d={overview.areaLow} />
            <path className={styles.overviewLine} d={overview.top} />
            <path className={styles.overviewLine} d={overview.low} />
          </svg>
          <motion.div className={styles.dim} style={{ x: 48, width: dimLeft }} />
          <motion.div className={styles.dim} style={{ x: handleEnd, width: dimRight }} />
          <motion.div
            className={styles.window}
            data-part="move"
            style={{ x: handleStart, width: windowWidth }}
            tabIndex={0}
            role="slider"
            aria-label="Selected range"
            aria-valuemin={0}
            aria-valuemax={23 - (range.b - range.a)}
            aria-valuenow={range.a}
            aria-valuetext={rangeLabel}
            onKeyDown={(event) => brushKeys("move", event)}
          />
          <motion.div
            className={styles.handle}
            data-part="lo"
            style={{ x: startX }}
            tabIndex={0}
            role="slider"
            aria-label="Range start"
            aria-valuemin={0}
            aria-valuemax={range.b - 2}
            aria-valuenow={range.a}
            aria-valuetext={monthName(range.a)}
            onKeyDown={(event) => brushKeys("lo", event)}
          >
            <span />
          </motion.div>
          <motion.div
            className={styles.handle}
            data-part="hi"
            style={{ x: endX }}
            tabIndex={0}
            role="slider"
            aria-label="Range end"
            aria-valuemin={range.a + 2}
            aria-valuemax={23}
            aria-valuenow={range.b}
            aria-valuetext={monthName(range.b)}
            onKeyDown={(event) => brushKeys("hi", event)}
          >
            <span />
          </motion.div>
        </div>

        <div className={styles.srOnly}>
          <table id={tableId}>
            <caption>Monthly MRR movements, {rangeLabel}</caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">New</th>
                <th scope="col">Expansion</th>
                <th scope="col">Churn</th>
                <th scope="col">Net new</th>
                <th scope="col">MRR</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month) => {
                const value = point(month);
                return (
                  <tr key={month}>
                    <th scope="row">{monthName(month)}</th>
                    <td>{money(value.newMrr)}</td>
                    <td>{money(value.expansion)}</td>
                    <td>{money(-value.churn)}</td>
                    <td>{money(netNew(value))}</td>
                    <td>{money(value.mrr)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default RevenueExplorer;
