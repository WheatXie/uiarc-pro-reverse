"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Check, GripHorizontal } from "lucide-react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import SegmentedControl from "../segmented-control/segmented-control";
import { TextMorph } from "../text-morph/text-morph";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./usage-forecast.module.css";

/* ------------------------------------------------------------------ types */

type MetricKey = "calls" | "storage" | "seats";

/** The seed for one metric: a fixed range, a budget, a growth profile and a price. */
interface MetricSeed {
  key: MetricKey;
  label: string;
  lo: number;
  hi: number;
  step: number;
  min: number;
  budget: number;
  decimals: number;
  unit: string;
  price: number;
  priceNote: string;
  seed: number;
  start: number;
  weekday: number;
  weekend: number;
  growth: number;
  noise: number;
  spread: number;
  round: number;
  events?: Record<number, number>;
  readings?: number[];
}

/** A metric with its 31 day series: measurements to the 22nd, forecast from the 23rd. */
interface Metric extends Pick<MetricSeed, "key" | "label" | "lo" | "hi" | "step" | "min" | "budget" | "decimals" | "unit" | "price" | "priceNote"> {
  actual: number[];
  median: number[];
  upper: number[];
  lower: number[];
}

/** The drawing box, the joined curve and the threshold crossing markers in pixel space. */
interface Geometry {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  curve: number[];
  upper: number[];
  lower: number[];
  budgetY: number;
  cross: number | null;
  ticks: { x: number; show: boolean }[];
  actual: string;
  forecast: string;
  band: string;
  over: string;
  under: string;
}

export interface UsageForecastProps {
  /** Renders without the block's own surface. The preview frame flattens the card. */
  flat?: boolean;
}

/* ------------------------------------------------------------------- data */

const ALERT_RULES = [0.5, 0.8, 1];

const METRIC_KEYS: MetricKey[] = ["calls", "storage", "seats"];

function build(seedConfig: MetricSeed): Metric {
  let seed = seedConfig.seed;
  const random = () => {
    let next = Math.imul((seed = (seed + 0x6d2b79f5) | 0) ^ (seed >>> 15), 1 | seed);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 0x100000000;
  };
  const round = (value: number) => Math.round(value / seedConfig.round) * seedConfig.round;
  // Weekends run cooler than weekdays, and the whole week drifts up as the period goes on.
  const pace = (day: number) =>
    ((day + 1) % 7 === 0 || (day + 1) % 7 === 6 ? seedConfig.weekend : seedConfig.weekday) *
    (1 + seedConfig.growth * day);

  const actual = seedConfig.readings ?? [seedConfig.start];
  for (let day = actual.length; day <= 22; day++) {
    actual.push(
      round(
        actual[day - 1] +
          pace(day) * (1 + (random() - 0.5) * 2 * seedConfig.noise) +
          (seedConfig.events?.[day] ?? 0),
      ),
    );
  }

  // The forecast slope is measured over the second week, with one-off events removed.
  let gained = 0;
  let expected = 0;
  for (let day = 9; day <= 22; day++) {
    gained += actual[day] - actual[day - 1] - (seedConfig.events?.[day] ?? 0);
    expected += pace(day);
  }
  const slope = expected ? gained / expected : 1;

  const median = [actual[22]];
  const upper = [actual[22]];
  const lower = [actual[22]];
  for (let day = 23; day <= 30; day++) {
    const step = day - 22;
    const next = median[step - 1] + pace(day) * slope;
    const spread = seedConfig.spread * (Math.sqrt(step) + 0.35 * step);
    median.push(next);
    upper.push(next + 1.2 * spread);
    lower.push(next - 0.85 * spread);
  }

  const {
    key,
    label,
    lo,
    hi,
    step,
    min,
    budget,
    decimals,
    unit,
    price,
    priceNote,
  } = seedConfig;
  return {
    key,
    label,
    lo,
    hi,
    step,
    min,
    budget,
    decimals,
    unit,
    price,
    priceNote,
    actual,
    median,
    upper,
    lower,
  };
}

const METRICS: Record<MetricKey, Metric> = {
  calls: build({
    key: "calls",
    label: "API calls",
    lo: 0,
    hi: 50,
    step: 1,
    min: 10,
    budget: 38,
    decimals: 1,
    unit: "M",
    price: 200,
    priceNote: "At $0.20 per 1k calls",
    seed: 0x135283a,
    start: 0,
    weekday: 1.6,
    weekend: 0.7,
    growth: 0.006,
    noise: 0.07,
    spread: 0.4,
    round: 0.01,
  }),
  storage: build({
    key: "storage",
    label: "Storage",
    lo: 2,
    hi: 4.5,
    step: 0.1,
    min: 2.5,
    budget: 4,
    decimals: 2,
    unit: " TB",
    price: 120,
    priceNote: "At $0.12 per GB",
    seed: 4101,
    start: 3.12,
    weekday: 0.031,
    weekend: 0.012,
    growth: 0.004,
    noise: 0.25,
    spread: 0.034,
    round: 0.001,
    events: { 10: -0.15 },
  }),
  seats: build({
    key: "seats",
    label: "Seats",
    lo: 140,
    hi: 240,
    step: 5,
    min: 160,
    budget: 200,
    decimals: 0,
    unit: " seats",
    price: 24,
    priceNote: "At $24 per seat",
    seed: 77,
    start: 186,
    weekday: 0.72,
    weekend: 0.08,
    growth: 0,
    noise: 0,
    spread: 0.9,
    round: 1,
    readings: [
      186, 186, 187, 189, 190, 190, 190, 191, 193, 194, 195, 195, 195, 196, 197,
      198, 199, 201, 202, 202, 202, 203, 205,
    ],
  }),
};

/* ---------------------------------------------------------------- helpers */

/** Appends the forecast tail to the measured series, dropping the shared day 22 reading. */
const join = (measured: number[], forecast: number[]) => [...measured, ...forecast.slice(1)];

/** The fractional day a series first reaches `value`, or null when it never does. */
function crossing(series: number[], value: number): number | null {
  if (series[0] >= value) return 0;
  for (let day = 1; day < series.length; day++) {
    if (series[day] >= value) {
      return day - 1 + (value - series[day - 1]) / Math.max(1e-9, series[day] - series[day - 1]);
    }
  }
  return null;
}

/** Reads a fractional day out of a series. */
function sample(series: number[], day: number) {
  const index = Math.max(0, Math.min(series.length - 2, Math.floor(day)));
  const part = Math.max(0, Math.min(1, day - index));
  return series[index] + (series[index + 1] - series[index]) * part;
}

const dayOf = (value: number) => Math.min(30, Math.max(1, Math.ceil(value - 1e-6)));
const asDate = (value: number) => `Sep ${dayOf(value)}`;
const asValue = (metric: Metric, value: number) => `${value.toFixed(metric.decimals)}${metric.unit}`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const normalize = (metric: Metric, value: number) => (value - metric.lo) / (metric.hi - metric.lo);
const snap = (metric: Metric, value: number) => Number((Math.round(value / metric.step) * metric.step).toFixed(2));

const NORMALIZED = Object.fromEntries(
  METRIC_KEYS.map((key) => {
    const metric = METRICS[key];
    const norm = (value: number) => normalize(metric, value);
    return [
      key,
      {
        actual: metric.actual.map(norm),
        median: metric.median.map(norm),
        upper: metric.upper.map(norm),
        lower: metric.lower.map(norm),
        zero: norm(0),
      },
    ];
  }),
) as Record<MetricKey, { actual: number[]; median: number[]; upper: number[]; lower: number[]; zero: number }>;

type Normalized = (typeof NORMALIZED)[MetricKey];

const blend = (from: number[], to: number[], progress: number) =>
  from.map((value, index) => value + (to[index] - value) * progress);

function mix(from: Normalized, to: Normalized, progress: number): Normalized {
  if (progress >= 1 || from === to) return to;
  return {
    actual: blend(from.actual, to.actual, progress),
    median: blend(from.median, to.median, progress),
    upper: blend(from.upper, to.upper, progress),
    lower: blend(from.lower, to.lower, progress),
    zero: from.zero + (to.zero - from.zero) * progress,
  };
}

const pxAt = (box: { x0: number; x1: number }, day: number) => box.x0 + (day / 30) * (box.x1 - box.x0);
const pyAt = (box: { y0: number; y1: number }, value: number) => box.y0 + (1 - value) * (box.y1 - box.y0);

function settle(value: MotionValue<number>, target: number, transition: object, immediate: boolean) {
  if (immediate) value.jump(target);
  else animate(value, target, transition);
}

const { spring, duration, ease, stagger } = motionTokens;
const enterEase = [...ease.enter] as [number, number, number, number];
const exitEase = [...ease.standard] as [number, number, number, number];
const AXIS_DAYS = [1, 8, 15, 22, 29];
const chartHeight = (width: number) => (width < 520 ? 232 : 264);
const DRAG_SETTLE = { type: "spring", visualDuration: 0.16, bounce: 0 } as const;
const CROSS_SPRING = { visualDuration: 0.24, bounce: 0 } as const;
const FADE_SPRING = { visualDuration: 0.2, bounce: 0 } as const;

/** One line of copy that rises in and swaps out when the text changes. */
function Rise({ text, className }: { text: string; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <span className={[styles.rise, className].filter(Boolean).join(" ")}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.45em" }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: "-0.45em" }}
          transition={{ duration: reduced ? duration.instant : duration.standard, ease: enterEase }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** A sentence where only the words that changed animate, so a metric switch reads as an edit. */
function Words({ text }: { text: string }) {
  const reduced = useReducedMotion();
  const [pair, setPair] = useState({ current: text, previous: text });
  if (pair.current !== text) setPair({ current: text, previous: pair.current });

  const kept = new Set(pair.previous.split(" ").map((word, index) => `${index}:${word}`));
  let order = 0;

  return (
    <span className={styles.words} aria-hidden="true">
      <AnimatePresence mode="popLayout" initial={false}>
        {text.split(" ").map((word, index) => {
          const key = `${index}:${word}`;
          const delay = kept.has(key) ? 0 : Math.min(order++, 6) * stagger.word;
          return (
            <motion.span
              key={key}
              className={styles.word}
              layout={reduced ? false : "position"}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.35em" }}
              animate={{ opacity: 1, y: 0 }}
              exit={
                reduced
                  ? { opacity: 0, transition: { duration: 0 } }
                  : { opacity: 0, y: "-0.3em", transition: { duration: duration.fast, ease: exitEase } }
              }
              transition={
                reduced
                  ? { duration: duration.instant }
                  : {
                      layout: spring.smooth,
                      default: { duration: duration.standard, ease: enterEase, delay },
                    }
              }
            >
              {word}
            </motion.span>
          );
        })}
      </AnimatePresence>
    </span>
  );
}

function Figure({ value, decimals, prefix = "" }: { value: number; decimals: number; prefix?: string }) {
  return (
    <span className={styles.num}>
      <AnimatedCounter value={value} decimals={decimals} prefix={prefix} />
    </span>
  );
}

/** A budget threshold tick that slides along the curve as the line moves. */
function Tick({
  geo,
  index,
  on,
  reduce,
}: {
  geo: MotionValue<Geometry>;
  index: number;
  on: boolean;
  reduce: boolean;
}) {
  const x = useTransform(geo, (box) => pxAt(box, box.ticks[index].x));
  const y = useTransform(geo, (box) => pyAt(box, sample(box.curve, box.ticks[index].x)));
  const shown = useTransform(geo, (box): number => (box.ticks[index].show ? 1 : 0));
  const faded = useSpring(shown, FADE_SPRING);
  const transition = reduce ? { duration: 0 } : spring.smooth;

  return (
    <motion.g style={{ x, y, opacity: reduce ? shown : faded }}>
      <motion.path
        className={styles.tick}
        d="M0,7V-7"
        initial={false}
        animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
        transition={transition}
      />
      <motion.g
        initial={false}
        animate={{ opacity: on ? 1 : 0 }}
        transition={{ duration: reduce ? 0 : duration.fast, delay: on && !reduce ? 0.08 : 0 }}
      >
        <text className={styles.tickLabel} x={-6} y={-6} textAnchor="end">
          {Math.round(100 * ALERT_RULES[index])}%
        </text>
      </motion.g>
    </motion.g>
  );
}

/** A day label that steps aside when the crossing marker comes near it. */
function AxisLabel({
  day,
  x,
  y,
  right,
  markerX,
  markerOn,
}: {
  day: number;
  x: number;
  y: number;
  right: number;
  markerX: MotionValue<number>;
  markerOn: MotionValue<number>;
}) {
  const opacity = useTransform(
    () => 1 - markerOn.get() * clamp(1 - (Math.abs(markerX.get() - x) - 28) / 12, 0, 1),
  );
  const flip = x + 20 > right;

  return (
    <motion.g style={{ opacity }}>
      <text className={styles.axis} x={flip ? right : x} y={y} textAnchor={flip ? "end" : "middle"}>
        Sep {day}
      </text>
    </motion.g>
  );
}

/* -------------------------------------------------------------- component */

/**
 * A billing period usage chart with a forecast cone and a draggable budget that dates the crossing.
 *
 * The plot follows the container width, the budget line drags or steps with the keyboard, and scrubbing the
 * plot opens a day panel with the reading and its likely range. Everything the pointer can reach is also a
 * slider with an aria-valuetext, and the same numbers are exposed as a table.
 */
export function UsageForecast({ flat = false }: UsageForecastProps) {
  const reduced = !!useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const titleId = `${uid}-title`;
  const tableId = `${uid}-table`;
  const overClipId = `${uid}-over`;
  const underClipId = `${uid}-under`;
  const noteId = `${uid}-note`;

  const [metricKey, setMetricKey] = useState<MetricKey>("calls");
  const [budgets, setBudgets] = useState<Record<MetricKey, number>>(() => ({
    calls: METRICS.calls.budget,
    storage: METRICS.storage.budget,
    seats: METRICS.seats.budget,
  }));
  const [rules, setRules] = useState([false, true, true]);
  const [hovered, setHovered] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [width, setWidth] = useState(760);

  const metric = METRICS[metricKey];
  const budget = budgets[metricKey];

  /** The story: when the budget is crossed, the two sentences under the header, and the KPI figures. */
  const analysis = useMemo(() => {
    const curve = join(metric.actual, metric.median);
    const at = crossing(curve, budget);
    const early = crossing(join(metric.actual, metric.upper), budget);
    const late = crossing(join(metric.actual, metric.lower), budget);
    const used = metric.actual[22];
    const end = metric.median[metric.median.length - 1];
    const kind = at === null ? "none" : at <= 22 ? "past" : "future";
    const pct = (value: number) => Math.round((value / budget) * 100);
    const headlineText = asValue(metric, end);

    let headline: string;
    let detail: string;
    if (at !== null && at <= 22) {
      headline = `You passed the budget on ${asDate(at)}`;
      const over = pct(used) - 100;
      detail = `Usage is ${over > 0 ? `${over}% over` : "at the budget"} today and heading for ${headlineText} by Sep 30.`;
    } else if (at !== null) {
      const left = 30 - dayOf(at);
      headline = `At this pace you reach the budget on ${asDate(at)}`;
      const before =
        left === 0
          ? "On the last day of the period"
          : `${left} ${left === 1 ? "day" : "days"} before the period closes`;
      const range =
        early !== null && late !== null && dayOf(early) !== dayOf(late)
          ? `, likely between ${asDate(early)} and ${asDate(late)}`
          : early !== null && dayOf(early) !== dayOf(at)
            ? `, as early as ${asDate(early)}`
            : "";
      detail = `${before}${range}.`;
    } else {
      headline = "At this pace you stay under budget";
      detail = `Heading for ${headlineText} by Sep 30, ${pct(end)}% of budget${early !== null ? `. A busy week could cross it on ${asDate(early)}` : ""}.`;
    }

    return {
      at,
      kind,
      headline,
      detail,
      used,
      end,
      usedPct: pct(used),
      endPct: pct(end),
      endLow: metric.lower[metric.lower.length - 1],
      endHigh: metric.upper[metric.upper.length - 1],
      cost: Math.max(0, end - budget) * metric.price,
      rules: ALERT_RULES.map((share) => crossing(curve, share * budget)),
    };
  }, [metric, budget]);

  const curve = useMemo(() => join(metric.actual, metric.median), [metric]);
  const [whenText, setWhenText] = useState(() => (analysis.at === null ? "" : asDate(analysis.at)));
  if (analysis.at !== null && asDate(analysis.at) !== whenText) setWhenText(asDate(analysis.at));

  const series = useMotionValue({ from: NORMALIZED.calls, to: NORMALIZED.calls });
  const fade = useMotionValue(1);
  const budgetNorm = useMotionValue(normalize(METRICS.calls, METRICS.calls.budget));
  const boxWidth = useMotionValue(760);
  const boxHeight = useMotionValue(chartHeight(760));
  const hoveredDay = useMotionValue(-1);

  /** Everything the plot draws, recomputed from the live motion values. */
  const geo = useTransform((): Geometry => {
    const shownSeries = mix(series.get().from, series.get().to, fade.get());
    const target = budgetNorm.get();
    const box = { x0: 52, x1: boxWidth.get() - 10, y0: 30, y1: boxHeight.get() - 30 };
    const points = (values: number[], offset: number) =>
      values.map((value, index) => `${pxAt(box, offset + index).toFixed(2)},${pyAt(box, value).toFixed(2)}`);
    const line = join(shownSeries.actual, shownSeries.median);
    const budgetY = pyAt(box, target);
    const ticks = ALERT_RULES.map((share) => {
      const value = shownSeries.zero + share * (target - shownSeries.zero);
      const at = crossing(line, value);
      return { x: at ?? (value <= line[0] ? 0 : 30), show: at !== null && at > 0 };
    });
    const drawWidth = boxWidth.get();
    return {
      ...box,
      curve: line,
      upper: shownSeries.upper,
      lower: shownSeries.lower,
      budgetY,
      cross: crossing(line, target),
      ticks,
      actual: `M${points(shownSeries.actual, 0).join("L")}`,
      forecast: `M${points(shownSeries.median, 22).join("L")}`,
      band: `M${points(shownSeries.upper, 22).join("L")}L${points(shownSeries.lower, 22).reverse().join("L")}Z`,
      over: `M0,-60H${drawWidth}V${budgetY.toFixed(2)}H0Z`,
      under: `M0,${budgetY.toFixed(2)}H${drawWidth}V${box.y1 + 60}H0Z`,
    };
  });

  const actualPath = useTransform(geo, (box) => box.actual);
  const forecastPath = useTransform(geo, (box) => box.forecast);
  const bandPath = useTransform(geo, (box) => box.band);
  const overPath = useTransform(geo, (box) => box.over);
  const underPath = useTransform(geo, (box) => box.under);
  const budgetY = useTransform(geo, (box) => Math.round(box.budgetY));
  const zoneY = useTransform(budgetY, (value) => value - 16);
  const todayY = useTransform(geo, (box) => pyAt(box, box.curve[22]));
  const crossDay = useTransform(geo, (box) => box.cross ?? 30);
  const crossSpring = useSpring(crossDay, CROSS_SPRING);
  const crossAt = reduced ? crossDay : crossSpring;
  const markerOn = useTransform(geo, (box): number => (box.cross !== null ? 1 : 0));
  const markerFade = useSpring(markerOn, FADE_SPRING);
  const markerOpacity = reduced ? markerOn : markerFade;

  const crossX = useTransform(() => pxAt(geo.get(), crossAt.get()));
  const crossY = useTransform(() => {
    const box = geo.get();
    return pyAt(box, sample(box.curve, crossAt.get()));
  });
  const dropPath = useTransform(() => {
    const box = geo.get();
    return `M${crossX.get().toFixed(2)},${crossY.get().toFixed(2)}V${box.y1}`;
  });
  const whenX = useTransform(() => clamp(crossX.get(), 74, boxWidth.get() - 10 - 22));

  const hoverX = useTransform(() => {
    const day = hoveredDay.get();
    if (day < 0) return 0;
    return Math.round(pxAt(geo.get(), day)) + 0.5;
  });
  const hoverY = useTransform(() => {
    const day = hoveredDay.get();
    if (day < 0) return 0;
    const box = geo.get();
    return pyAt(box, box.curve[day]);
  });
  const hoverRange = useTransform(() => {
    const day = hoveredDay.get();
    const box = geo.get();
    const offset = day - 22;
    return offset > 0
      ? `M0,${pyAt(box, box.upper[offset]).toFixed(2)}V${pyAt(box, box.lower[offset]).toFixed(2)}`
      : "M0,0";
  });
  const hoverOpacity = useTransform(hoveredDay, (day) => (day < 0 ? 0 : 1));
  const panelX = useTransform(() => {
    const day = hoveredDay.get();
    const available = boxWidth.get();
    const anchor = pxAt(geo.get(), Math.max(0, day));
    return anchor + 14 + 176 <= available ? anchor + 14 : Math.max(0, anchor - 14 - 176);
  });
  const panelSpring = useSpring(panelX, { visualDuration: 0.22, bounce: 0 });
  const panelAt = reduced ? panelX : panelSpring;

  const plotRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; from: number; plot: number; value: number; stretched: boolean } | null>(null);

  function inspect(day: number | null) {
    const previous = hoveredDay.get();
    hoveredDay.set(day ?? -1);
    setHovered(day);
    // Opening the panel jumps it into place; moving between days springs it.
    if (day !== null && previous < 0) {
      const available = boxWidth.get();
      const anchor = pxAt(geo.get(), day);
      panelSpring.jump(anchor + 14 + 176 <= available ? anchor + 14 : Math.max(0, anchor - 14 - 176));
    }
  }

  useEffect(() => {
    const element = plotRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const measured = Math.round(entry.contentRect.width);
      if (!measured) return;
      setWidth(measured);
      boxWidth.set(measured);
      boxHeight.set(chartHeight(measured));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [boxWidth, boxHeight]);

  const setBudget = (value: number) =>
    setBudgets((current) => (current[metricKey] === value ? current : { ...current, [metricKey]: value }));

  const endDrag = () => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    setDragging(false);
    settle(budgetNorm, normalize(metric, current.value), spring.snappy, reduced);
  };

  const dayAt = (clientX: number) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return clamp(
      Math.round(((clientX - rect.left - 52) / Math.max(1, rect.width - 52 - 10)) * 30),
      1,
      30,
    );
  };

  const height = chartHeight(width);
  const box = { x0: 52, x1: width - 10, y0: 30, y1: height - 30 };
  const todayX = Math.round(pxAt(box, 22)) + 0.5;
  const gridValues = Array.from({ length: 6 }, (_, index) => metric.lo + ((metric.hi - metric.lo) * index) / 5);
  const unitText = metric.unit.replace(" ", "\u00a0");
  const spoken = `${metric.label}: ${analysis.headline}. ${analysis.detail}`;
  const inspected = hovered ?? 22;

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
            <h2 id={titleId}>Usage forecast</h2>
            <p>Northwind Labs · Scale plan · Renews Oct 1</p>
          </div>
          <SegmentedControl
            label="Metric"
            value={metricKey}
            onValueChange={(next) => {
              if (next === metricKey) return;
              const active = series.get();
              series.set({ from: mix(active.from, active.to, fade.get()), to: NORMALIZED[next as MetricKey] });
              if (reduced) fade.jump(1);
              else {
                fade.jump(0);
                animate(fade, 1, spring.smooth);
              }
              settle(budgetNorm, normalize(METRICS[next as MetricKey], budgets[next as MetricKey]), spring.smooth, reduced);
              setMetricKey(next as MetricKey);
            }}
            options={METRIC_KEYS.map((key) => ({ value: key, label: METRICS[key].label }))}
          />
        </header>

        <div className={styles.story}>
          <p className={styles.headline}>
            <Words text={analysis.headline} />
          </p>
          <p className={styles.detail}>
            <Words text={analysis.detail} />
          </p>
          <p className={styles.srOnly} aria-live="polite">
            {spoken}
          </p>
        </div>

        <dl className={styles.kpis}>
          <div className={styles.kpi}>
            <dt>Used so far</dt>
            <dd className={styles.value}>
              <Figure value={Number(analysis.used.toFixed(metric.decimals))} decimals={metric.decimals} />
              <Rise text={unitText} className={styles.unit} />
            </dd>
            <dd className={styles.foot}>
              <Rise text={`${analysis.usedPct}% of budget`} />
            </dd>
          </div>
          <div className={styles.kpi}>
            <dt>Projected by Sep 30</dt>
            <dd className={styles.value}>
              <Figure value={Number(analysis.end.toFixed(metric.decimals))} decimals={metric.decimals} />
              <Rise text={unitText} className={styles.unit} />
            </dd>
            <dd className={styles.foot}>
              <Rise text={`Likely ${analysis.endLow.toFixed(metric.decimals)}–${asValue(metric, analysis.endHigh)}`} />
            </dd>
          </div>
          <div className={styles.kpi}>
            <dt>Cost above budget</dt>
            <dd className={styles.value} data-tone={analysis.cost > 0 ? "over" : undefined}>
              <Figure value={Math.round(analysis.cost)} decimals={0} prefix="$" />
            </dd>
            <dd className={styles.foot}>
              <Rise text={analysis.cost > 0 ? metric.priceNote : "Within budget"} />
            </dd>
          </div>
        </dl>

        <div
          ref={plotRef}
          className={styles.chart}
          style={{ height }}
          data-dragging={dragging || undefined}
          onPointerMove={(event) => {
            if (drag.current) return;
            const day = dayAt(event.clientX);
            if (day !== null && day !== hoveredDay.get()) inspect(day);
          }}
          onPointerLeave={() => {
            if (!drag.current) inspect(null);
          }}
        >
          <svg
            className={styles.svg}
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            height={height}
            role="img"
            aria-describedby={tableId}
            aria-label={`${metric.label} this billing period: ${asValue(metric, analysis.used)} used through Sep 22, forecast ${asValue(metric, analysis.end)} by Sep 30 against a ${asValue(metric, budget)} budget. ${analysis.headline}.`}
          >
            <defs>
              <clipPath id={overClipId}>
                <motion.path d={overPath} />
              </clipPath>
              <clipPath id={underClipId}>
                <motion.path d={underPath} />
              </clipPath>
            </defs>
            <g aria-hidden="true">
              <rect
                className={styles.future}
                x={todayX}
                y={box.y0}
                width={Math.max(0, box.x1 - todayX)}
                height={box.y1 - box.y0}
              />
              {gridValues.map((value, index) => {
                const y = Math.round(pyAt(box, index / 5)) + 0.5;
                return (
                  <line
                    key={value}
                    className={index === 0 ? styles.baseline : styles.grid}
                    x1={52}
                    x2={box.x1}
                    y1={y}
                    y2={y}
                  />
                );
              })}
              {AXIS_DAYS.map((day) => (
                <AxisLabel
                  key={day}
                  day={day}
                  x={pxAt(box, day)}
                  y={height - 10}
                  right={width - 1}
                  markerX={whenX}
                  markerOn={markerOpacity}
                />
              ))}
              <line className={styles.todayLine} x1={todayX} x2={todayX} y1={box.y0 - 8} y2={box.y1} />
              <text className={styles.todayLabel} x={todayX} y={box.y0 - 14} textAnchor="middle">
                Today
              </text>
              <motion.path className={styles.band} d={bandPath} clipPath={`url(#${underClipId})`} />
              <motion.path
                className={`${styles.band} ${styles.bandOver}`}
                d={bandPath}
                clipPath={`url(#${overClipId})`}
              />
              <motion.path className={styles.forecast} d={forecastPath} clipPath={`url(#${underClipId})`} />
              <motion.path
                className={`${styles.forecast} ${styles.over}`}
                d={forecastPath}
                clipPath={`url(#${overClipId})`}
              />
              <motion.path className={styles.actual} d={actualPath} clipPath={`url(#${underClipId})`} />
              <motion.path
                className={`${styles.actual} ${styles.over}`}
                d={actualPath}
                clipPath={`url(#${overClipId})`}
              />
              <motion.g style={{ y: budgetY }}>
                <line className={styles.budget} x1={52} x2={box.x1} y1={0.5} y2={0.5} />
              </motion.g>
              {ALERT_RULES.map((share, index) => (
                <Tick key={share} geo={geo} index={index} on={rules[index]} reduce={reduced} />
              ))}
              <motion.g style={{ opacity: markerOpacity }}>
                <motion.path className={styles.drop} d={dropPath} />
                <motion.circle className={styles.marker} r={5} cx={crossX} cy={crossY} />
              </motion.g>
              <motion.circle className={styles.todayDot} r={4} cx={todayX} cy={todayY} />
              <motion.g style={{ opacity: hoverOpacity }}>
                <motion.line
                  className={styles.hoverLine}
                  x1={hoverX}
                  x2={hoverX}
                  y1={box.y0}
                  y2={box.y1}
                />
                <motion.g style={{ x: hoverX }}>
                  <motion.path className={styles.hoverRange} d={hoverRange} />
                </motion.g>
                <motion.circle
                  className={styles.hoverDot}
                  data-forecast={hovered !== null && hovered > 22 ? "" : undefined}
                  r={4}
                  cx={hoverX}
                  cy={hoverY}
                />
              </motion.g>
            </g>
          </svg>

          <div className={styles.yLabels} style={{ width: 42 }} aria-hidden="true">
            {gridValues.map((value, index) => {
              const fixed = value.toFixed(metric.key === "seats" ? 0 : Number(metric.key === "storage"));
              const trimmed = fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
              return (
                <span key={value} className={styles.yLabel} style={{ top: Math.round(pyAt(box, index / 5)) }}>
                  <Rise text={value === 0 ? "0" : `${trimmed}${metric.unit === " seats" ? "" : metric.unit}`} />
                </span>
              );
            })}
          </div>

          <div
            className={styles.hit}
            style={{ left: 52, right: 10, bottom: 30 }}
            tabIndex={0}
            role="slider"
            aria-label="Inspect a day"
            aria-orientation="horizontal"
            aria-valuemin={1}
            aria-valuemax={30}
            aria-valuenow={inspected}
            aria-valuetext={
              inspected > 22
                ? `Sep ${inspected} forecast: ${asValue(metric, curve[inspected])}, likely ${metric.lower[inspected - 22].toFixed(metric.decimals)} to ${asValue(metric, metric.upper[inspected - 22])}`
                : `Sep ${inspected}: ${asValue(metric, curve[inspected])} used, ${Math.round((curve[inspected] / budget) * 100)}% of budget`
            }
            onPointerDown={(event) => {
              const day = dayAt(event.clientX);
              if (day !== null) inspect(day);
            }}
            onFocus={() => {
              if (hoveredDay.get() < 0) inspect(22);
            }}
            onBlur={() => inspect(null)}
            onKeyDown={(event) => {
              const day = hovered ?? 22;
              const moves: Record<string, number> = {
                ArrowLeft: day - 1,
                ArrowDown: day - 1,
                ArrowRight: day + 1,
                ArrowUp: day + 1,
                PageDown: day - 7,
                PageUp: day + 7,
                Home: 1,
                End: 30,
                Escape: -1,
              };
              const next = moves[event.key];
              if (next === undefined) return;
              event.preventDefault();
              inspect(next < 0 ? null : clamp(next, 1, 30));
            }}
          />

          <motion.div
            className={styles.zone}
            style={{ left: 52, right: 10, y: zoneY }}
            data-dragging={dragging || undefined}
            tabIndex={0}
            role="slider"
            aria-label={`${metric.label} budget`}
            aria-orientation="vertical"
            aria-describedby={noteId}
            aria-valuemin={metric.min}
            aria-valuemax={metric.hi}
            aria-valuenow={budget}
            aria-valuetext={asValue(metric, budget)}
            onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.currentTarget.focus({ preventScroll: true });
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                y: event.clientY,
                from: budget,
                plot: boxHeight.get() - 30 - 30,
                value: budget,
                stretched: false,
              };
              setDragging(true);
              inspect(null);
            }}
            onPointerMove={(event) => {
              const active = drag.current;
              if (!active) return;
              const raw = active.from + ((active.y - event.clientY) / active.plot) * (metric.hi - metric.lo);
              const held = clamp(raw, metric.min, metric.hi);
              const stepped = clamp(snap(metric, held), metric.min, metric.hi);
              if (raw !== held) {
                // Past an edge the line keeps moving, but at a fraction of the drag.
                budgetNorm.stop();
                const overshoot = normalize(metric, raw) - normalize(metric, held);
                budgetNorm.set(
                  normalize(metric, held) +
                    Math.sign(overshoot) * (1 - 1 / ((0.55 * Math.abs(overshoot)) / 0.07 + 1)) * 0.07,
                );
              } else if (stepped !== active.value || active.stretched) {
                settle(budgetNorm, normalize(metric, stepped), DRAG_SETTLE, reduced);
              }
              active.value = stepped;
              active.stretched = raw !== held;
              setBudget(stepped);
            }}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
              const page = 5 * metric.step;
              const step: number | undefined = {
                ArrowUp: metric.step,
                ArrowRight: metric.step,
                ArrowDown: -metric.step,
                ArrowLeft: -metric.step,
                PageUp: page,
                PageDown: -page,
              }[event.key];
              const next =
                event.key === "Home"
                  ? metric.min
                  : event.key === "End"
                    ? metric.hi
                    : step === undefined
                      ? null
                      : clamp(snap(metric, budget + step), metric.min, metric.hi);
              if (next === null) return;
              event.preventDefault();
              setBudget(next);
              settle(budgetNorm, normalize(metric, next), spring.snappy, reduced);
            }}
          >
            <span className={styles.handle}>
              <GripHorizontal size={14} strokeWidth={1.75} aria-hidden="true" />
              <span className={styles.handleLabel}>Budget</span>
              <span className={styles.handleValue}>
                <Figure value={budget} decimals={metric.step < 1 ? 1 : 0} />
                <Rise text={unitText} />
              </span>
            </span>
          </motion.div>

          <motion.div
            className={styles.when}
            style={{ x: whenX, top: box.y1 + 6, opacity: markerOpacity }}
            aria-hidden="true"
          >
            <span className={styles.whenInner}>
              <Rise text={whenText} />
            </span>
          </motion.div>

          <AnimatePresence>
            {hovered !== null && (
              <motion.div
                key="panel"
                className={styles.panel}
                aria-hidden="true"
                style={{ x: panelAt, top: 30, width: 176 }}
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={
                  reduced
                    ? { opacity: 0, transition: { duration: duration.instant } }
                    : { opacity: 0, scale: 0.97, transition: { duration: duration.fast } }
                }
                transition={{ duration: reduced ? duration.instant : duration.fast, ease: enterEase }}
              >
                <p className={styles.panelHead}>
                  <span>Sep {hovered}</span>
                  <span className={styles.panelTag}>
                    {hovered > 22 ? "Forecast" : hovered === 22 ? "Today" : "Actual"}
                  </span>
                </p>
                <p className={styles.panelValue}>{asValue(metric, curve[hovered])}</p>
                <p className={styles.panelNote}>
                  {hovered > 22
                    ? `Likely ${metric.lower[hovered - 22].toFixed(metric.decimals)}–${asValue(metric, metric.upper[hovered - 22])}`
                    : `${Math.round((curve[hovered] / budget) * 100)}% of budget`}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <footer
          className={styles.footer}
          data-frame-flat={flat ? "" : undefined}
          style={flat ? { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" } : undefined}
        >
          <div className={styles.rules} role="group" aria-label="Budget alerts" aria-describedby={noteId}>
            <span className={styles.rulesLabel}>Alert at</span>
            {ALERT_RULES.map((share, index) => {
              const at = analysis.rules[index];
              const status =
                at === null
                  ? "Not expected"
                  : at <= 0
                    ? "Since Sep 1"
                    : at <= 22
                      ? `Reached ${asDate(at)}`
                      : `Expected ${asDate(at)}`;
              return (
                <button
                  key={share}
                  type="button"
                  className={styles.rule}
                  aria-pressed={rules[index]}
                  aria-label={`${Math.round(100 * share)}% of budget, ${status.toLowerCase()}`}
                  onClick={() => setRules((current) => current.map((on, at2) => (at2 === index ? !on : on)))}
                >
                  <motion.span
                    className={styles.check}
                    initial={false}
                    animate={{ width: rules[index] ? 20 : 0, opacity: rules[index] ? 1 : 0 }}
                    transition={reduced ? { duration: 0 } : spring.snappy}
                    aria-hidden="true"
                  >
                    <Check size={14} strokeWidth={2} />
                  </motion.span>
                  <span className={styles.rulePct}>{Math.round(100 * share)}%</span>
                  <TextMorph className={styles.ruleWhen}>{status}</TextMorph>
                </button>
              );
            })}
          </div>

          <ul className={styles.legend} aria-label="Legend">
            <li>
              <svg width="16" height="8" aria-hidden="true">
                <line className={styles.actual} x1="1" x2="15" y1="4" y2="4" />
              </svg>
              Actual
            </li>
            <li>
              <svg width="16" height="8" aria-hidden="true">
                <line className={styles.forecast} x1="0" x2="16" y1="4" y2="4" />
              </svg>
              Forecast
            </li>
            <li>
              <svg width="12" height="10" aria-hidden="true">
                <rect className={styles.band} width="12" height="10" rx="2" />
              </svg>
              Likely range
            </li>
            <li>
              <svg width="16" height="8" aria-hidden="true">
                <line className={`${styles.actual} ${styles.over}`} x1="1" x2="15" y1="4" y2="4" />
              </svg>
              Over budget
            </li>
          </ul>

          <p id={noteId} className={styles.srOnly}>
            Drag the budget line or use the arrow keys.
          </p>
        </footer>

        <div className={styles.srOnly}>
          <table id={tableId}>
            <caption>
              {metric.label}, Sep 1 to 30, 2026
            </caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Reading</th>
                <th scope="col">Likely range</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 30 }, (_, index) => index + 1).map((day) => (
                <tr key={day}>
                  <th scope="row">
                    Sep {day}
                    {day > 22 ? " (forecast)" : ""}
                  </th>
                  <td>{asValue(metric, curve[day])}</td>
                  <td>
                    {day > 22
                      ? `${metric.lower[day - 22].toFixed(metric.decimals)} to ${asValue(metric, metric.upper[day - 22])}`
                      : "Measured"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default UsageForecast;
