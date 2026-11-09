"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, GitCompareArrows, X } from "lucide-react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./kpi-drilldown.module.css";

/** How one metric prints: a prefix and suffix around a number divided by `divisor` with `decimals` places. */
export interface KpiFormat {
  prefix?: string;
  suffix?: string;
  divisor?: number;
  decimals?: number;
}

/** One row of a breakdown: its label, its share of the metric and its change as a fraction (0.071 = +7.1%). */
export interface KpiBreakdownRow {
  name: string;
  share: number;
  delta: number;
}

/** A metric: identity, how to print it, its daily series in time order and its breakdowns per dimension. */
export interface Kpi {
  id: string;
  label: string;
  kind: "total" | "rate";
  lowerIsBetter?: boolean;
  format: KpiFormat;
  series: number[];
  description?: string;
  breakdowns: Record<string, KpiBreakdownRow[]>;
}

/** A dimension the breakdown table can group by. Values match the keys in `Kpi.breakdowns`. */
export interface KpiDimension {
  value: string;
  label: string;
}

export interface KpiDrilldownProps {
  /** Metrics to show. Each needs at least twice the longest range of daily values so the comparison period exists. */
  kpis?: Kpi[];
  /** Breakdown dimensions offered on the detail; values match the keys in each metric's `breakdowns`. */
  dimensions?: KpiDimension[];
  /** ISO date of the last value in every series. */
  end?: string;
  /** Initial range in days. */
  defaultRange?: string;
  /** Controlled open metric id, or `null` for the grid. */
  selected?: string | null;
  /** Called when a metric opens or closes, so the selection can live in the URL. */
  onSelectedChange?: (id: string | null) => void;
  /** Heading. */
  title?: string;
  /** Renders without the block's own surface. The preview frame flattens the card. */
  flat?: boolean;
  /** Class on the root. */
  className?: string;
}

type Rect = { x: number; y: number; width: number; height: number };
type Range = "7" | "30" | "90";
type Delta = { raw: number; good: boolean; flat: boolean; sign: string; amount: number; unit: string; text: string };
type ChartFrame = { a: number[]; b: number[]; min: number; max: number; pad: number };

const spring = motionTokens.spring.smooth;
const panelSpring = { type: "spring", visualDuration: 0.5, bounce: 0 } as const;
const instant = { duration: 0 };
const fadeIn = { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.standard] };
const fadeOut = { duration: 0.08, ease: [...motionTokens.ease.standard] };

const deltas = { flat: ArrowRight, up: ArrowUpRight, down: ArrowDownRight };

/** Breakdown dimensions offered by the demo. */
export const breakdownDimensions: KpiDimension[] = [
  { value: "plan", label: "Plan" },
  { value: "region", label: "Region" },
  { value: "channel", label: "Channel" },
];

/** Daily series builder: a seeded random walk along a curve, 180 points ending at `to`. */
function series(seed: number, from: number, to: number, noise: number, wave = 0) {
  let state = seed >>> 0;
  const random = () => (state = (1664525 * state + 0x3c6ef35f) >>> 0) / 0x100000000;
  let drift = 0;
  return Array.from({ length: 180 }, (_, index) => {
    const progress = index / 179;
    drift = 0.82 * drift + (random() - 0.5) * noise;
    const ripple = wave ? Math.sin((index / 7) * Math.PI * 2) * wave : 0;
    return from + (to - from) * (progress * progress * 0.35 + 0.65 * progress) + drift + ripple;
  });
}

const plan = (a: number, b: number, c: number, d: number): KpiBreakdownRow[] => [
  { name: "Enterprise", share: 0.46, delta: a },
  { name: "Scale", share: 0.31, delta: b },
  { name: "Pro", share: 0.17, delta: c },
  { name: "Starter", share: 0.06, delta: d },
];
const region = (a: number, b: number, c: number, d: number): KpiBreakdownRow[] => [
  { name: "Europe", share: 0.41, delta: a },
  { name: "North America", share: 0.37, delta: b },
  { name: "Asia Pacific", share: 0.15, delta: c },
  { name: "Latin America", share: 0.07, delta: d },
];
const channel = (a: number, b: number, c: number, d: number): KpiBreakdownRow[] => [
  { name: "Self serve", share: 0.44, delta: a },
  { name: "Sales led", share: 0.34, delta: b },
  { name: "Partners", share: 0.14, delta: c },
  { name: "Marketplace", share: 0.08, delta: d },
];

/** The demo metrics: six overview numbers, each with 180 days and three breakdowns. */
export const kpis: Kpi[] = [
  {
    id: "mrr",
    label: "Monthly recurring revenue",
    kind: "total",
    format: { prefix: "€", divisor: 1000, suffix: "k", decimals: 1 },
    series: series(11, 151400, 184200, 1900, 600),
    description: "Recurring revenue from active subscriptions, before tax.",
    breakdowns: {
      plan: plan(0.071, 0.064, 0.042, -0.018),
      region: region(0.082, 0.051, 0.096, 0.034),
      channel: channel(0.058, 0.077, 0.049, 0.112),
    },
  },
  {
    id: "accounts",
    label: "Active accounts",
    kind: "total",
    format: { decimals: 0 },
    series: series(23, 2188, 2418, 16, 9),
    description: "Workspaces with at least one paid seat and activity this week.",
    breakdowns: {
      plan: plan(0.021, 0.035, 0.038, 0.012),
      region: region(0.033, 0.028, 0.052, 0.019),
      channel: channel(0.041, 0.022, 0.026, 0.064),
    },
  },
  {
    id: "nrr",
    label: "Net revenue retention",
    kind: "rate",
    format: { suffix: "%", decimals: 1 },
    series: series(37, 114.2, 118.3, 0.5),
    description: "Revenue kept from customers a year ago, including expansion.",
    breakdowns: {
      plan: plan(0.031, 0.022, -0.008, -0.024),
      region: region(0.019, 0.026, 0.014, -0.011),
      channel: channel(0.012, 0.028, 0.017, 0.006),
    },
  },
  {
    id: "churn",
    label: "Logo churn",
    kind: "rate",
    lowerIsBetter: true,
    format: { suffix: "%", decimals: 1 },
    series: series(41, 2.4, 1.9, 0.12),
    description: "Share of paying accounts that cancelled in the last 30 days.",
    breakdowns: {
      plan: plan(-0.004, -0.003, -0.006, 0.002),
      region: region(-0.005, -0.004, 0.001, -0.002),
      channel: channel(-0.006, -0.002, -0.003, 0.004),
    },
  },
  {
    id: "arpa",
    label: "Revenue per account",
    kind: "total",
    format: { prefix: "€", decimals: 1 },
    series: series(53, 69.2, 76.2, 0.6),
    description: "Monthly recurring revenue divided by active accounts.",
    breakdowns: {
      plan: plan(0.038, 0.024, 0.011, 0.004),
      region: region(0.029, 0.021, 0.035, 0.012),
      channel: channel(0.014, 0.041, 0.022, 0.018),
    },
  },
  {
    id: "trials",
    label: "Trial conversion",
    kind: "rate",
    format: { suffix: "%", decimals: 1 },
    series: series(67, 19.8, 22.4, 0.7, 0.4),
    description: "Trials that became paid within 14 days of starting.",
    breakdowns: {
      plan: plan(0.018, 0.024, 0.031, 0.009),
      region: region(0.022, 0.017, 0.028, 0.006),
      channel: channel(0.026, 0.012, 0.019, 0.033),
    },
  },
];

const ranges: { value: Range; label: string }[] = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Resample a series to `count` points by linear interpolation, so two ranges morph instead of redrawing. */
function resample(values: number[], count: number) {
  if (values.length === 1) return Array<number>(count).fill(values[0]);
  return Array.from({ length: count }, (_, index) => {
    const at = (index / (count - 1)) * (values.length - 1);
    const low = Math.floor(at);
    const high = Math.min(values.length - 1, low + 1);
    return values[low] + (values[high] - values[low]) * (at - low);
  });
}

/** Print a raw series value through a metric format. */
function formatKpiValue(value: number, format: KpiFormat) {
  const decimals = format.decimals ?? 0;
  const scaled = value / (format.divisor ?? 1);
  return `${format.prefix ?? ""}${scaled.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${format.suffix ?? ""}`;
}

/** Change between two periods: percentage for totals, points for rates, with direction and wording. */
function changeFor(kpi: Kpi, current: number, previous: number): Delta {
  const raw = kpi.kind === "rate" ? current - previous : ((current - previous) / previous) * 100;
  const flat = Math.abs(raw) < 0.05;
  const good = kpi.lowerIsBetter ? raw < 0 : raw > 0;
  const sign = flat ? "" : raw > 0 ? "+" : "−";
  const amount = Number(Math.abs(flat ? 0 : raw).toFixed(1));
  const unit = kpi.kind === "rate" ? "\u00a0pts" : "%";
  return { raw, good, flat, sign, amount, unit, text: `${sign}${amount.toFixed(1)}${unit}` };
}

/** "Sep 24" for a day counted back from the last date. */
function dateLabel(end: string, daysAgo: number) {
  const date = new Date(`${end}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** A measured element's box in the coordinate space of an ancestor. */
function rectRelativeTo(element: Element, ancestor: Element): Rect {
  const box = element.getBoundingClientRect();
  const frame = ancestor.getBoundingClientRect();
  return { x: box.left - frame.left, y: box.top - frame.top, width: box.width, height: box.height };
}

/** Polyline for a series inside a `width × height` box offset by `pad`. */
function linePath(values: number[], width: number, height: number, min: number, max: number, pad = 0) {
  const span = max - min || 1;
  return values
    .map(
      (value, index) => `${index ? "L" : "M"}${((index / (values.length - 1)) * width).toFixed(2)},${(pad + (1 - (value - min) / span) * height).toFixed(2)}`,
    )
    .join("");
}

/** Width of an element, re-measured on resize. Charts use it to draw once per layout change. */
function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    setWidth(node.offsetWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(node.offsetWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** Fade and swap a value that changes with the range or the dimension. */
function Swap({ id, reduce, className, children }: { id: string; reduce: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={`${styles.swap} ${className ?? ""}`}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: reduce ? instant : fadeIn }}
          exit={{ opacity: 0, transition: reduce ? instant : fadeOut }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** A small segmented control whose indicator springs between labels. */
function Tabs({
  options,
  value,
  onChange,
  label,
  reduce,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  reduce: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const width = useMotionValue(0);
  const opacity = useMotionValue(0);
  const ready = useRef(false);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const active = track?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!track || !active) return;
    if (!ready.current || reduce) {
      x.jump(active.offsetLeft);
      width.jump(active.offsetWidth);
      opacity.jump(1);
      track.setAttribute("data-ready", "");
      ready.current = true;
      return;
    }
    const move = animate(x, active.offsetLeft, spring);
    const grow = animate(width, active.offsetWidth, spring);
    return () => {
      move.stop();
      grow.stop();
    };
  }, [reduce, opacity, value, width, x]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const active = track.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (!active || x.isAnimating() || width.isAnimating()) return;
      x.jump(active.offsetLeft);
      width.jump(active.offsetWidth);
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, [width, x]);

  return (
    <div className={styles.tabs} role="group" aria-label={label}>
      <div ref={trackRef} className={styles.tabTrack}>
        <motion.span className={styles.indicator} style={{ x, width, opacity }} aria-hidden="true" />
        {options.map((option) => (
          <button key={option.value} type="button" className={styles.tab} aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The metric value through the animated counter, scaled by its divisor. */
function KpiValue({ kpi, value }: { kpi: Kpi; value: number }) {
  const { prefix = "", suffix = "", divisor = 1, decimals = 0 } = kpi.format;
  return <AnimatedCounter value={Number((value / divisor).toFixed(decimals))} prefix={prefix} suffix={suffix} decimals={decimals} />;
}

/** The change against the previous period: an arrow, a signed amount and a screen-reader label. */
function DeltaText({ delta, label, reduce }: { delta: Delta; label?: string; reduce: boolean }) {
  const direction = delta.flat ? "flat" : delta.raw > 0 ? "up" : "down";
  const Icon = deltas[direction];
  return (
    <span className={styles.delta} data-good={delta.good && !delta.flat ? "" : undefined} data-flat={delta.flat ? "" : undefined}>
      <Swap id={direction} reduce={reduce} className={styles.deltaIcon}>
        <Icon size={13} aria-hidden="true" />
      </Swap>
      <AnimatedCounter value={delta.amount} decimals={1} prefix={delta.sign} suffix={delta.unit} />
      {label && <span className={styles.srOnly}> {label}</span>}
    </span>
  );
}

/** A fixed 100 × 32 sparkline that morphs its path data when the range changes. */
function Sparkline({ values, reduce }: { values: number[]; reduce: boolean }) {
  const points = resample(values, 40);
  const low = Math.min(...points);
  const high = Math.max(...points);
  const line = linePath(points, 100, 28, low, high, 2);
  return (
    <svg className={styles.spark} viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <motion.path
        d={`${line}L100,32L0,32Z`}
        className={styles.sparkArea}
        initial={false}
        animate={{ d: `${line}L100,32L0,32Z` }}
        transition={reduce ? instant : spring}
      />
      <motion.path d={line} className={styles.sparkLine} initial={false} animate={{ d: line }} transition={reduce ? instant : spring} />
    </svg>
  );
}

/** Blend two chart frames so a range change morphs the line instead of swapping it. */
function blend(from: ChartFrame, to: ChartFrame, t: number): ChartFrame {
  const mix = (a: number, b: number) => a + (b - a) * t;
  return {
    a: to.a.map((value, index) => mix(from.a[index] ?? value, value)),
    b: to.b.map((value, index) => mix(from.b[index] ?? value, value)),
    min: mix(from.min, to.min),
    max: mix(from.max, to.max),
    pad: mix(from.pad, to.pad),
  };
}

/** The detail chart: current and previous period lines, three gridlines, a hover cursor and a tooltip. */
function DetailChart({
  kpi,
  current,
  previous,
  compare,
  days,
  end,
  reduce,
}: {
  kpi: Kpi;
  current: number[];
  previous: number[];
  compare: boolean;
  days: number;
  end: string;
  reduce: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const clipId = useId();
  const width = useWidth(ref);
  const [cursor, setCursor] = useState<number | null>(null);
  const inner = Math.max(0, width - 56);

  const data = useMemo<ChartFrame>(() => {
    const a = resample(current, 72);
    const b = resample(previous, 72);
    const all = compare ? [...a, ...b] : a;
    const min = Math.min(...all);
    const pad = (Math.max(...all) - min) * 0.12 || 1;
    return { a, b, min: min - pad, max: Math.max(...all) + pad, pad };
  }, [compare, current, previous]);

  const progress = useMotionValue(1);
  const state = useRef({ from: data, to: data, inner: 0, format: kpi.format });
  const line = useMotionValue("");
  const area = useMotionValue("");
  const before = useMotionValue("");
  const top = useMotionValue("");
  const middle = useMotionValue("");
  const bottom = useMotionValue("");

  const draw = useCallback(() => {
    const frame = state.current;
    const value = blend(frame.from, frame.to, progress.get());
    const path = linePath(value.a, frame.inner, 186, value.min, value.max, 10);
    line.set(path);
    area.set(`${path}L${frame.inner},${196}L0,${196}Z`);
    before.set(linePath(value.b, frame.inner, 186, value.min, value.max, 10));
    top.set(formatKpiValue(value.max - value.pad, frame.format));
    middle.set(formatKpiValue((value.max + value.min) / 2, frame.format));
    bottom.set(formatKpiValue(value.min + value.pad, frame.format));
  }, [area, before, bottom, line, middle, progress, top]);

  useLayoutEffect(() => {
    state.current.inner = inner;
    state.current.format = kpi.format;
    draw();
  }, [inner, kpi.format, draw]);

  useEffect(() => progress.on("change", draw), [draw, progress]);

  useLayoutEffect(() => {
    const frame = state.current;
    frame.from = blend(frame.from, frame.to, progress.get());
    frame.to = data;
    if (reduce) {
      progress.jump(1);
      draw();
      return;
    }
    progress.jump(0);
    const run = animate(progress, 1, spring);
    return () => run.stop();
  }, [draw, progress, reduce, data]);

  const yFor = (value: number) => 10 + (1 - (value - data.min) / (data.max - data.min)) * 186;
  const ticks = [data.pad, (data.max - data.min) / 2, data.max - data.min - data.pad].map((value) => 10 + (1 - value / (data.max - data.min)) * 186);
  const dayIndex = cursor === null ? null : Math.round((cursor / 71) * (days - 1));

  const track = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setCursor(Math.round(71 * Math.max(0, Math.min(1, (event.clientX - box.left) / Math.max(1, inner)))));
  };

  const cursorX = cursor === null ? 0 : (cursor / 71) * inner;
  const summary = `${kpi.label} over the last ${days} days, from ${formatKpiValue(current[0], kpi.format)} to ${formatKpiValue(current[current.length - 1], kpi.format)}.`;
  const axisDays = [0, Math.floor((days - 1) / 2), days - 1];

  return (
    <div
      ref={ref}
      className={styles.chart}
      role="img"
      aria-label={summary}
      tabIndex={0}
      onPointerMove={track}
      onPointerDown={track}
      onPointerLeave={() => setCursor(null)}
      onKeyDown={(event) => {
        const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (event.key === "Escape" && cursor !== null) {
          event.stopPropagation();
          setCursor(null);
          return;
        }
        if (!step) return;
        event.preventDefault();
        const stride = 71 / Math.max(1, days - 1);
        setCursor((value) => Math.max(0, Math.min(71, Math.round((value ?? 71) + step * stride))));
      }}
      onBlur={() => setCursor(null)}
    >
      {width > 0 && (
        <svg width={width} height={220} aria-hidden="true">
          <defs>
            <clipPath id={clipId}>
              <rect x={-2} y={0} width={inner + 4} height={196} />
            </clipPath>
          </defs>
          {[top, middle, bottom].map((label, index) => (
            <g key={index}>
              <line x1={0} x2={inner} y1={ticks[2 - index]} y2={ticks[2 - index]} className={styles.gridLine} />
              <motion.text x={inner + 10} y={ticks[2 - index] + 4} className={styles.axisText}>
                {label}
              </motion.text>
            </g>
          ))}
          <g clipPath={`url(#${clipId})`}>
            <motion.path d={area} className={styles.chartArea} />
            <motion.path
              d={before}
              className={styles.chartBefore}
              initial={false}
              animate={{ opacity: compare ? 1 : 0 }}
              transition={reduce ? instant : fadeIn}
            />
            <motion.path d={line} className={styles.chartLine} />
          </g>
          {axisDays.map((offset, index) => (
            <AxisLabel
              key={index}
              text={dateLabel(end, days - 1 - offset)}
              x={(offset / Math.max(1, days - 1)) * inner}
              anchor={index === 0 ? "start" : index === 2 ? "end" : "middle"}
              reduce={reduce}
            />
          ))}
          {cursor !== null && (
            <g className={styles.cursor}>
              <line x1={cursorX} x2={cursorX} y1={10} y2={196} />
              {compare && <circle cx={cursorX} cy={yFor(data.b[cursor])} r={3} className={styles.cursorBefore} />}
              <circle cx={cursorX} cy={yFor(data.a[cursor])} r={3.5} />
            </g>
          )}
        </svg>
      )}
      <AnimatePresence>
        {cursor !== null && dayIndex !== null && (
          <motion.div
            className={styles.tip}
            style={{ left: Math.max(70, Math.min(inner - 70, cursorX)) }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : motionTokens.duration.instant }}
          >
            <span>{dateLabel(end, days - 1 - dayIndex)}</span>
            <strong>{formatKpiValue(current[dayIndex], kpi.format)}</strong>
            {compare && <small>{formatKpiValue(previous[dayIndex], kpi.format)} a period earlier</small>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** One date under the chart. It fades in when the range changes the labels. */
function AxisLabel({ text, x, anchor, reduce }: { text: string; x: number; anchor: "start" | "middle" | "end"; reduce: boolean }) {
  return (
    <AnimatePresence initial={false}>
      <motion.text
        key={text}
        x={x}
        y={214}
        className={styles.axisText}
        textAnchor={anchor}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={reduce ? instant : { duration: motionTokens.duration.fast }}
      >
        {text}
      </motion.text>
    </AnimatePresence>
  );
}

/** The breakdown table: share bars, per-row values and change, grouped by the selected dimension. */
function Breakdown({
  kpi,
  value,
  dimension,
  dimensions,
  onDimension,
  reduce,
}: {
  kpi: Kpi;
  value: number;
  dimension: string;
  dimensions: KpiDimension[];
  onDimension: (value: string) => void;
  reduce: boolean;
}) {
  const rows = kpi.breakdowns[dimension] ?? [];
  const label = dimensions.find((entry) => entry.value === dimension)?.label ?? "Segment";
  const unit = kpi.kind === "rate" ? "\u00a0pts" : "%";
  const { prefix = "", suffix = "", divisor = 1, decimals = 0 } = kpi.format;

  return (
    <section className={styles.breakdown} aria-label={`${kpi.label} by ${label.toLowerCase()}`}>
      <div className={styles.breakdownHead}>
        <h4>Breakdown</h4>
        <Tabs options={dimensions} value={dimension} onChange={onDimension} label="Break down by" reduce={reduce} />
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col" className={styles.nameHead}>
              <Swap id={label} reduce={reduce}>
                {label}
              </Swap>
            </th>
            <th scope="col" className={styles.shareHead}>
              {kpi.kind === "rate" ? "Accounts" : "Share"}
            </th>
            <th scope="col" className={`${styles.num} ${styles.valueHead}`}>
              Value
            </th>
            <th scope="col" className={`${styles.num} ${styles.changeHead}`}>
              Change
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const amount = kpi.kind === "rate" ? value * (1 + 4 * row.delta) : value * row.share;
            const delta = Number((100 * row.delta).toFixed(1));
            const good = kpi.lowerIsBetter ? delta < 0 : delta > 0;
            return (
              <tr key={index}>
                <th scope="row">
                  <Swap id={row.name} reduce={reduce}>
                    {row.name}
                  </Swap>
                </th>
                <td className={styles.share}>
                  <span className={styles.bar}>
                    <motion.span initial={false} animate={{ scaleX: row.share }} transition={reduce ? instant : spring} />
                  </span>
                  <span className={styles.percent}>
                    <AnimatedCounter value={Math.round(100 * row.share)} suffix="%" />
                  </span>
                </td>
                <td className={styles.num}>
                  <AnimatedCounter value={Number((amount / divisor).toFixed(decimals))} prefix={prefix} suffix={suffix} decimals={decimals} />
                </td>
                <td className={styles.num}>
                  <span className={styles.rowDelta} data-good={good ? "" : undefined}>
                    <AnimatedCounter value={Math.abs(delta)} decimals={1} prefix={delta >= 0 ? "+" : "−"} suffix={unit} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

/** The expanded metric: it grows out of its card, shows the value, the chart and the breakdown, and folds back. */
function DetailPanel({
  kpi,
  origin,
  bounds,
  closing,
  onClosed,
  onClose,
  onMeasure,
  days,
  compare,
  end,
  dimension,
  dimensions,
  onDimension,
  reduce,
}: {
  kpi: Kpi;
  origin: Rect;
  bounds: { width: number; height: number };
  closing: Rect | null;
  onClosed: () => void;
  onClose: () => void;
  onMeasure: (height: number) => void;
  days: number;
  compare: boolean;
  end: string;
  dimension: string;
  dimensions: KpiDimension[];
  onDimension: (value: string) => void;
  reduce: boolean;
}) {
  const x = useMotionValue(reduce ? 8 : origin.x);
  const y = useMotionValue(reduce ? 8 : origin.y);
  const width = useMotionValue(reduce ? bounds.width : origin.width);
  const height = useMotionValue(reduce ? bounds.height : origin.height);
  const opacity = useMotionValue(reduce ? 0 : 1);
  const content = useMotionValue(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  const current = useMemo(() => kpi.series.slice(-days), [days, kpi.series]);
  const previous = useMemo(() => kpi.series.slice(-(2 * days), -days), [days, kpi.series]);
  const latest = current[current.length - 1];
  const earlier = previous[previous.length - 1];
  const delta = changeFor(kpi, latest, earlier);

  useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    onMeasure(node.offsetHeight + 2);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => onMeasure(node.offsetHeight + 2));
    observer.observe(node);
    return () => observer.disconnect();
  }, [onMeasure]);

  useLayoutEffect(() => {
    if (closing) return;
    if (reduce) {
      x.jump(8);
      y.jump(8);
      width.jump(bounds.width);
      height.jump(bounds.height);
      return;
    }
    animate(x, 8, panelSpring);
    animate(y, 8, panelSpring);
    animate(width, bounds.width, panelSpring);
    animate(height, bounds.height, panelSpring);
  }, [bounds.height, bounds.width, closing, height, reduce, width, x, y]);

  useEffect(() => {
    if (closing) return;
    animate(opacity, 1, { duration: reduce ? motionTokens.duration.fast : 0 });
    animate(content, 1, {
      duration: reduce ? motionTokens.duration.fast : motionTokens.duration.considered,
      delay: 0.12 * (reduce ? 0 : 1),
      ease: [...motionTokens.ease.enter],
    });
    closeRef.current?.focus({ preventScroll: true });
  }, [closing, content, reduce, opacity]);

  useEffect(() => {
    if (!closing) return;
    if (reduce) {
      const run = animate(opacity, 0, { duration: motionTokens.duration.fast });
      void run.then(onClosed);
      return () => run.stop();
    }
    const runs = [
      animate(content, 0, { duration: motionTokens.duration.instant }),
      animate(x, closing.x, panelSpring),
      animate(y, closing.y, panelSpring),
      animate(width, closing.width, panelSpring),
      animate(height, closing.height, panelSpring),
    ];
    let live = true;
    void Promise.all(runs).then(() => {
      if (live) onClosed();
    });
    return () => {
      live = false;
      runs.forEach((run) => run.stop());
    };
  }, [closing, content, height, onClosed, opacity, reduce, width, x, y]);

  return (
    <motion.div
      className={styles.panel}
      role="region"
      aria-labelledby={headingId}
      data-closing={closing ? "" : undefined}
      style={{ x, y, width, height, opacity }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        onClose();
      }}
    >
      <div ref={contentRef} className={styles.panelContent} style={{ width: bounds.width - 2 }}>
        <div className={styles.panelHead}>
          <div className={styles.cardTop}>
            <h3 id={headingId} className={styles.label}>
              {kpi.label}
            </h3>
            <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Back to overview">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div className={styles.valueRow}>
            <span className={styles.value}>
              <KpiValue kpi={kpi} value={latest} />
            </span>
            <DeltaText delta={delta} label={`versus the previous ${days} days`} reduce={reduce} />
            <motion.span className={styles.versus} style={{ opacity: content }}>
              <Swap id={`${days}`} reduce={reduce}>
                vs {formatKpiValue(earlier, kpi.format)} the {days} days before
              </Swap>
            </motion.span>
          </div>
        </div>
        <motion.div className={styles.panelBody} style={{ opacity: content }}>
          <p className={styles.description}>{kpi.description}</p>
          <DetailChart kpi={kpi} current={current} previous={previous} compare={compare} days={days} end={end} reduce={reduce} />
          <div className={styles.legend} aria-hidden="true">
            <span>
              <Swap id={`${days}`} reduce={reduce}>
                Last {days} days
              </Swap>
            </span>
            <motion.span
              className={styles.legendBefore}
              initial={false}
              animate={{ opacity: compare ? 1 : 0 }}
              transition={reduce ? instant : { duration: motionTokens.duration.standard }}
            >
              <Swap id={`${days}`} reduce={reduce}>
                Previous {days} days
              </Swap>
            </motion.span>
          </div>
          <Breakdown kpi={kpi} value={latest} dimension={dimension} dimensions={dimensions} onDimension={onDimension} reduce={reduce} />
        </motion.div>
      </div>
    </motion.div>
  );
}

/**
 * KPI cards that expand into a full detail chart with period comparison and a breakdown table, then fold back.
 * The label and value stay put while the chart, the comparison and the table are revealed around them.
 */
export function KpiDrilldown({
  kpis: metrics = kpis,
  dimensions = breakdownDimensions,
  end = "2026-09-24",
  defaultRange = "30",
  selected,
  onSelectedChange,
  title = "Overview",
  flat = false,
  className,
}: KpiDrilldownProps) {
  const reduce = useReducedMotion() ?? false;
  const [range, setRange] = useState<string>(defaultRange);
  const [compare, setCompare] = useState(true);
  const [dimension, setDimension] = useState(dimensions[0]?.value ?? "plan");
  const [open, setOpen] = useState<string | null>(null);
  const [panel, setPanel] = useState<{ id: string; origin: Rect } | null>(null);
  const [closing, setClosing] = useState<Rect | null>(null);
  const [gridHeight, setGridHeight] = useState(0);
  const [measured, setMeasured] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLUListElement>(null);
  const cards = useRef(new Map<string, HTMLButtonElement>());
  const bodyWidth = useWidth(bodyRef);
  const bodyHeight = useMotionValue(0);
  const days = Number(range);
  const activeId = selected !== undefined ? selected : open;

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const measure = () => setGridHeight(grid.offsetHeight + 2 * grid.offsetTop);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(
    () =>
      bodyHeight.on("change", (value) => {
        if (bodyRef.current) bodyRef.current.style.minHeight = `${value}px`;
      }),
    [bodyHeight],
  );

  const inner = panel ? Math.max(gridHeight, measured + 16) : gridHeight;

  const select = (id: string | null) => {
    if (selected === undefined) setOpen(id);
    onSelectedChange?.(id);
  };

  useLayoutEffect(() => {
    if (!gridHeight) return;
    const target = panel && !closing ? inner : gridHeight;
    if (reduce || bodyHeight.get() === 0) {
      bodyHeight.jump(panel && !closing ? target : gridHeight);
      return;
    }
    const run = animate(bodyHeight, target, panelSpring);
    return () => run.stop();
  }, [closing, bodyHeight, gridHeight, panel, inner, reduce]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const body = bodyRef.current;
      if (activeId && panel?.id === activeId) {
        if (closing) setClosing(null);
        return;
      }
      if (activeId) {
        const card = cards.current.get(activeId);
        if (card && body) {
          setClosing(null);
          setPanel({ id: activeId, origin: rectRelativeTo(card, body) });
        }
      } else if (panel && !closing) {
        const card = cards.current.get(panel.id);
        if (card && body) setClosing(rectRelativeTo(card, body));
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [closing, panel, activeId]);

  const closed = useCallback(() => {
    const id = panel?.id;
    setPanel(null);
    setClosing(null);
    if (id) requestAnimationFrame(() => cards.current.get(id)?.focus({ preventScroll: true }));
  }, [panel?.id]);

  const measure = useCallback((height: number) => setMeasured(height), []);
  const detail = metrics.find((entry) => entry.id === panel?.id) ?? null;

  const rows = useMemo(
    () =>
      metrics.map((kpi) => {
        const current = kpi.series.slice(-days);
        const previous = kpi.series.slice(-(2 * days), -days);
        const value = current[current.length - 1];
        return { kpi, current, value, delta: changeFor(kpi, value, previous[previous.length - 1]) };
      }),
    [days, metrics],
  );

  return (
    <div
      className={`${styles.root} ${className ?? ""}`}
      data-frame-flat={flat ? "" : undefined}
      style={flat ? { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" } : undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape" && panel && !closing) {
          event.preventDefault();
          select(null);
        }
      }}
    >
      <header className={styles.header}>
        <h2>{title}</h2>
        <div className={styles.controls}>
          <button type="button" className={styles.compare} aria-pressed={compare} onClick={() => setCompare((value) => !value)}>
            <GitCompareArrows size={14} aria-hidden="true" />
            <span>Compare</span>
          </button>
          <Tabs options={ranges} value={range} onChange={setRange} label="Date range" reduce={reduce} />
        </div>
      </header>
      <div ref={bodyRef} className={styles.body}>
        <ul ref={gridRef} className={styles.grid} aria-hidden={panel ? true : undefined}>
          {rows.map(({ kpi, current, value, delta }) => (
            <li key={kpi.id}>
              <button
                type="button"
                ref={(node) => {
                  if (node) cards.current.set(kpi.id, node);
                  else cards.current.delete(kpi.id);
                }}
                className={styles.card}
                data-hidden={panel?.id === kpi.id ? "" : undefined}
                onClick={() => select(kpi.id)}
                tabIndex={panel ? -1 : undefined}
                aria-label={`${kpi.label}, ${formatKpiValue(value, kpi.format)}, ${delta.text} versus the previous ${days} days. Open details`}
              >
                <span className={styles.cardTop}>
                  <span className={styles.label}>{kpi.label}</span>
                </span>
                <span className={styles.valueRow}>
                  <span className={styles.value}>
                    <KpiValue kpi={kpi} value={value} />
                  </span>
                  <DeltaText delta={delta} reduce={reduce} />
                </span>
                <Sparkline values={current} reduce={reduce} />
              </button>
            </li>
          ))}
        </ul>
        <AnimatePresence>
          {panel && !closing && (
            <motion.div
              key="veil"
              className={styles.veil}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? motionTokens.duration.instant : motionTokens.duration.standard }}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>
        {panel && detail && bodyWidth > 0 && (
          <DetailPanel
            kpi={detail}
            origin={panel.origin}
            bounds={{ width: bodyWidth - 16, height: measured || inner - 16 }}
            closing={closing}
            onClosed={closed}
            onClose={() => select(null)}
            onMeasure={measure}
            days={days}
            compare={compare}
            end={end}
            dimension={dimension}
            dimensions={dimensions}
            onDimension={setDimension}
            reduce={reduce}
          />
        )}
      </div>
    </div>
  );
}

export default KpiDrilldown;
