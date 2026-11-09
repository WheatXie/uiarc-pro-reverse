/**
 * Sample series for the metric explorer.
 *
 * Two years of daily values are seeded from a small noise generator, then anchored so the last day
 * of each series lands on the number printed in the cards. Replace the `daily` arrays with rows from
 * your warehouse; the ranges, comparison window and chart scale are derived from them.
 */

/** Days of history every series carries. The last day is "today". */
export const DAYS = 730;
/** Index of the most recent day. */
export const TODAY = DAYS - 1;

export type RangeId = "30d" | "90d" | "12m";
export type ChangeKind = "percent" | "points";

export interface Range {
  /** Segmented control label. */
  label: string;
  /** Days the window covers; the comparison period is the same length before it. */
  days: number;
  /** Sample one point per week instead of per day. */
  weekly: boolean;
  /** Words used in prose, such as "30 days". */
  words: string;
}

export const RANGES: Record<RangeId, Range> = {
  "30d": { label: "30D", days: 30, weekly: false, words: "30 days" },
  "90d": { label: "90D", days: 90, weekly: false, words: "90 days" },
  "12m": { label: "12M", days: 364, weekly: true, words: "12 months" },
};

/** Range ids in the order the switch shows them. */
export const RANGE_IDS: RangeId[] = ["30d", "90d", "12m"];

export interface Metric {
  id: string;
  /** Full name, used in the panel and the screen reader copy. */
  label: string;
  /** Short name, used on the tabs. */
  short: string;
  /** One sentence on how the number is counted. */
  definition: string;
  change: ChangeKind;
  /** Daily values, oldest first, ending today. */
  daily: number[];
  /** The same series sampled weekly, for the 12 month range. */
  weekly: number[];
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Calendar for every day in every series, ending on the reporting date. */
const CALENDAR = Array.from({ length: DAYS }, (_, index) => {
  const date = new Date(Date.UTC(2026, 8, 22 - (TODAY - index)));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate(), weekday: date.getUTCDay() };
});

/** "Sep 22" for a day index. */
export function shortDate(index: number): string {
  return `${MONTHS[CALENDAR[index].month]} ${CALENDAR[index].day}`;
}

/** "Sep 22, 2026" for a day index. */
export function longDate(index: number): string {
  return `${shortDate(index)}, ${CALENDAR[index].year}`;
}

/** "Aug 24 – Sep 22" inside one year, "Sep 22, 2025 – Sep 22, 2026" across two. */
export function rangeLabel(range: RangeId): string {
  const start = TODAY - RANGES[range].days + 1;
  return CALENDAR[start].year === CALENDAR[TODAY].year ? `${shortDate(start)} – ${shortDate(TODAY)}` : `${longDate(start)} – ${longDate(TODAY)}`;
}

/** A seeded random walk: persistence decides how much yesterday pulls on today, scale how far it wanders. */
function noise(seed: number, persistence: number, scale: number): number[] {
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
  let level = 0;
  return Array.from({ length: DAYS }, () => (level = level * persistence + (random() + random() + random() - 1.5) * 2 * scale));
}

/** Smooth step in 0..1, used to bend a series into a step change at a given day. */
const smoothstep = (value: number) => (value <= 0 ? 0 : value >= 1 ? 1 : value * value * (3 - 2 * value));

/** Shift a series so its last day lands on `target`, snapped to `step`. */
const anchor = (series: number[], target: number, step: number) => series.map((value) => Math.round((value + target - series[TODAY]) / step) * step);

const INDEXES = Array.from({ length: DAYS }, (_, index) => index);

const mrrNoise = noise(11, 0.94, 0.0021);
const accountNoise = noise(23, 0.9, 4.2);
const activationNoise = noise(37, 0.88, 0.15);
const retentionNoise = noise(51, 0.95, 0.045);

/** MRR in dollars: compounding growth, two expansions and a soft month near the end. */
const MRR = anchor(
  INDEXES.map(
    (day) => 790_000 * Math.exp(0.00066 * day) * (1 + mrrNoise[day]) + 18_400 * smoothstep((day - 402) / 3) + 23_900 * smoothstep((day - 588) / 3) - 15_600 * smoothstep((day - 668) / 2),
  ),
  1_284_600,
  100,
);

/** Paying workspaces: a saturating curve with a dip around day 322. */
const ACCOUNTS = anchor(
  INDEXES.map((day) => 1388 + 905 * (day / TODAY) ** 1.18 + 21 * Math.sin(day / 58) - 34 * Math.exp(-(((day - 322) / 16) ** 2)) + accountNoise[day]),
  2318,
  1,
);

/** Activation rate: a slow drift up with a launch bump in the last weeks. */
const ACTIVATION = anchor(
  INDEXES.map((day) => 33.4 + (2.2 * day) / TODAY + 4.4 * smoothstep((day - 684) / 28) + 0.55 * Math.sin(day / 41) + activationNoise[day]),
  41.8,
  0.1,
);

/** Net revenue retention: expands through the year, then gives a little back. */
const NRR = anchor(
  INDEXES.map((day) => 105.6 + 8.6 * smoothstep((day - 120) / 560) - 1.9 * smoothstep((day - 684) / 45) + retentionNoise[day]),
  112.4,
  0.1,
);

/** Sample a daily series weekly by reading the value seven, fourteen… days back. */
function weeklyFrom(daily: number[]): number[] {
  return daily.map((value, index) => {
    const gap = (TODAY - index) % 7;
    const anchorIndex = index + gap;
    const previous = anchorIndex - 7;
    return gap === 0 || previous < 0 ? value : daily[previous] + ((daily[anchorIndex] - daily[previous]) * (7 - gap)) / 7;
  });
}

function metric(id: string, label: string, short: string, definition: string, change: ChangeKind, daily: number[]): Metric {
  return { id, label, short, definition, change, daily, weekly: weeklyFrom(daily) };
}

export const METRICS: Metric[] = [
  metric("mrr", "MRR", "MRR", "Monthly recurring revenue from active subscriptions, before refunds and credits.", "percent", MRR),
  metric("accounts", "Active accounts", "Accounts", "Paying workspaces with at least one member active in the last 7 days.", "percent", ACCOUNTS),
  metric("activation", "Activation rate", "Activation", "New workspaces that invite a teammate within 7 days, trailing 28 days.", "points", ACTIVATION),
  metric("nrr", "Net revenue retention", "NRR", "Revenue kept and expanded from customers of a year ago, trailing 12 months.", "points", NRR),
];

export const metricById: Record<string, Metric> = Object.fromEntries(METRICS.map((item) => [item.id, item]));

/**
 * The value at a fractional day index. `weekly` mixes the daily series with its weekly sample, so
 * the chart can morph between a range that reads every day and one that reads every seventh.
 */
export function sampleAt(item: Metric, weekly: number, index: number): number {
  const clamped = Math.min(TODAY, Math.max(0, index));
  const whole = Math.min(TODAY - 1, Math.floor(clamped));
  const base = item.daily[whole] + (item.weekly[whole] - item.daily[whole]) * weekly;
  return base + (item.daily[whole + 1] + (item.weekly[whole + 1] - item.daily[whole + 1]) * weekly - base) * (clamped - whole);
}

/** Change between two values, as a percentage or in points. */
export function changeBetween(item: Metric, now: number, then: number): number {
  return item.change === "percent" ? (now / then - 1) * 100 : now - then;
}

/** The sign glyph in front of a change; empty when the change rounds to zero. */
export const sign = (value: number) => (Math.round(Math.abs(value) * 10) === 0 ? "" : value > 0 ? "+" : "−");

/** "up 1.2%" or "down 1.1 points", for the screen reader label. */
export function describeChange(item: Metric, change: number): string {
  const direction = Math.round(Math.abs(change) * 10) === 0 ? "flat" : change > 0 ? "up" : "down";
  return `${direction} ${Math.abs(change).toFixed(1)}${item.change === "percent" ? "%" : " points"}`;
}

/** The current value, the value one range ago, and the change between them. */
export function readMetric(item: Metric, range: RangeId): { now: number; then: number; change: number } {
  const now = item.daily[TODAY];
  const then = item.daily[TODAY - RANGES[range].days];
  return { now, then, change: changeBetween(item, now, then) };
}

const integer = new Intl.NumberFormat("en-US");

/** "$1.28M", "2,318", "41.8%". */
export function formatValue(item: Metric, value: number): string {
  const shape = item.id === "mrr"
    ? { value: Math.round(value / 1e4) / 100, decimals: 2, prefix: "$", suffix: "M" }
    : item.id === "accounts"
      ? { value: Math.round(value), decimals: 0, prefix: "", suffix: "" }
      : { value: Math.round(value * 10) / 10, decimals: 1, prefix: "", suffix: "%" };
  return `${shape.prefix}${item.id === "accounts" ? integer.format(shape.value) : shape.value.toFixed(shape.decimals)}${shape.suffix}`;
}

/** How many decimals a step needs before it reads as a round number. */
const decimalsFor = (step: number) => [0, 1, 2, 3].find((places) => Math.abs(Math.round(step * 10 ** places) - step * 10 ** places) < 1e-6) ?? 3;

/**
 * The visible window plus the period before it, padded and snapped to a round step so the axis
 * reads $400k / $425k rather than $398,412.
 */
export function chartScale(item: Metric, range: RangeId): { lo: number; hi: number; step: number } {
  const days = RANGES[range].days;
  let min = Infinity;
  let max = -Infinity;
  for (let index = TODAY - 2 * days + 1; index <= TODAY; index += 1) {
    min = Math.min(min, item.daily[index]);
    max = Math.max(max, item.daily[index]);
  }
  const padding = 0.03 * Math.max(max - min, 0.002 * Math.abs(max));
  min -= padding;
  max += padding;
  const unit = item.id === "mrr" ? 1e4 : item.id === "accounts" ? 10 : 0.1;
  let decade = 10 ** Math.floor(Math.log10((max - min) / 4));
  for (;;) {
    for (const multiple of [1, 1.5, 2, 2.5, 3, 4, 5]) {
      const step = Math.round((multiple * decade) / unit) * unit;
      const lo = Math.floor(min / step) * step;
      if (step && Math.abs(step - multiple * decade) <= 1e-9 * decade && lo + 4 * step >= max) return { lo, hi: lo + 4 * step, step };
    }
    decade *= 10;
  }
}

/** Left inset and right gutter of the plot, in pixels. */
export const LEFT = 52;
export const RIGHT = 6;

/** Day index to x, for a window of `days` mapped across `width`. */
export function chartX(index: number, days: number, width: number): number {
  const start = TODAY - days + 1;
  return LEFT + ((index - start) / Math.max(1e-6, TODAY - start)) * (width - LEFT - RIGHT);
}

/** One sparkline path per card, scaled into a 100×32 box with two units of headroom at either end. */
export function sparkline(item: Metric, range: RangeId): { d: string; end: number } {
  const { days, weekly } = RANGES[range];
  const values = (weekly
    ? Array.from({ length: days / 7 + 1 }, (_, step) => TODAY - days + 7 * step)
    : Array.from({ length: days }, (_, step) => TODAY - days + 1 + step)
  ).map((index) => item.daily[index]);
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const points = values.map((value, index) => [(index / (values.length - 1)) * 100, 2 + (1 - (value - min) / span) * 28]);
  return {
    d: points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(""),
    end: (points[points.length - 1][1] / 32) * 100,
  };
}

export interface AxisTick {
  /** Day index the tick marks. */
  d: number;
  label: string;
}

/**
 * Picks the densest date format that still leaves room between labels: weekdays, then every other
 * week, then the 1st and 15th, then months, then quarters.
 */
export function axisTicks(range: RangeId, width: number): AxisTick[] {
  const days = RANGES[range].days;
  const perDay = width / Math.max(1, days - 1);
  const start = TODAY - days + 1;
  const candidates = [
    { gap: 84, every: 7, test: (d: number) => CALENDAR[d].weekday === 1, label: shortDate },
    { gap: 84, every: 14, test: (d: number) => CALENDAR[d].weekday === 1 && ((TODAY - 1 - d) / 7) % 2 === 0, label: shortDate },
    { gap: 84, every: 15, test: (d: number) => CALENDAR[d].day === 1 || CALENDAR[d].day === 15, label: shortDate },
    { gap: 48, every: 30.4, test: (d: number) => CALENDAR[d].day === 1, label: (d: number) => MONTHS[CALENDAR[d].month] },
    { gap: 80, every: 91, test: (d: number) => CALENDAR[d].day === 1 && CALENDAR[d].month % 3 === 0, label: (d: number) => `${MONTHS[CALENDAR[d].month]} ${CALENDAR[d].year}` },
  ];
  const chosen = candidates.find((candidate) => candidate.every * perDay >= candidate.gap) ?? candidates[candidates.length - 1];
  const ticks: AxisTick[] = [];
  for (let day = start; day <= TODAY; day += 1) {
    if (chosen.test(day)) ticks.push({ d: day, label: chosen.label(day) });
  }
  return ticks;
}
