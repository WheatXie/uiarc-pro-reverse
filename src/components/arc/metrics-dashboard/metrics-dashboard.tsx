"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion,
  type Transition,
} from "motion/react";
import { ArrowDownRight, ArrowUpRight, Check, Download } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./metrics-dashboard.module.css";

/* ------------------------------------------------------------------ types */

type MetricKey = "visitors" | "signups" | "conversion" | "bounce";
type RangeValue = "7d" | "30d" | "90d";
type MetricUnit = "count" | "percent";
type Size = "sm" | "md" | "lg";

interface MetricDefinition {
  key: MetricKey;
  label: string;
  unit: MetricUnit;
  /** Bounce rate is the one tile where a falling number is the good outcome. */
  lowerIsBetter?: boolean;
}

interface RangeDefinition {
  value: RangeValue;
  label: string;
  long: string;
  days: number;
  /** Days folded into one plotted point; 90d buckets weekly so the line stays readable. */
  step: number;
}

interface DaySample {
  visitors: number;
  signups: number;
  conversion: number;
  bounce: number;
}

interface SeriesPoint {
  date: Date;
  value: number;
  previous: number;
}

interface MetricTotal {
  value: number;
  delta: number;
}

interface DashboardData {
  series: Record<MetricKey, SeriesPoint[]>;
  totals: Record<MetricKey, MetricTotal>;
  step: number;
  visitors: number;
}

interface BreakdownRow {
  name: string;
  share: number;
}

/* ------------------------------------------------------------------- data */

const METRICS: readonly MetricDefinition[] = [
  { key: "visitors", label: "Visitors", unit: "count" },
  { key: "signups", label: "Signups", unit: "count" },
  { key: "conversion", label: "Conversion", unit: "percent" },
  { key: "bounce", label: "Bounce rate", unit: "percent", lowerIsBetter: true },
];

const RANGES: readonly RangeDefinition[] = [
  { value: "7d", label: "7D", long: "Last 7 days", days: 7, step: 1 },
  { value: "30d", label: "30D", long: "Last 30 days", days: 30, step: 1 },
  { value: "90d", label: "90D", long: "Last 90 days", days: 90, step: 7 },
];

/** The sample window ends on this fixed date so the numbers never drift. */
const TODAY = new Date(2025, 8, 30);

/** Two slow sines and one fast one: enough shape to look like traffic, cheap to evaluate 180 times. */
function wave(x: number, phase: number) {
  return (
    0.5 * Math.sin(0.9 * x + phase) +
    0.35 * Math.sin(0.23 * x + 2 * phase) +
    0.15 * Math.sin(2.1 * x + 3 * phase)
  );
}

const DAYS: readonly DaySample[] = Array.from({ length: 180 }, (_, index) => {
  const weekday = new Date(TODAY.getTime() - (179 - index) * 864e5).getDay();
  const visitors = Math.round(
    (620 + 4.2 * index) *
      (weekday === 0 || weekday === 6 ? 0.78 : 1) *
      (1 + 0.12 * wave(index, 1)),
  );
  const conversion = 4.1 + 0.004 * index + 0.35 * wave(index, 4);
  return {
    visitors,
    signups: Math.round((visitors * conversion) / 100),
    conversion,
    bounce: 44 - 0.02 * index + 2.4 * wave(index, 7),
  };
});

const TOP_PAGES: readonly BreakdownRow[] = [
  { name: "/", share: 0.31 },
  { name: "/pricing", share: 0.17 },
  { name: "/docs/getting-started", share: 0.12 },
  { name: "/blog/usage-based-billing", share: 0.08 },
  { name: "/changelog", share: 0.05 },
];

const SOURCES: readonly BreakdownRow[] = [
  { name: "Direct", share: 0.38 },
  { name: "Google", share: 0.29 },
  { name: "Hacker News", share: 0.11 },
  { name: "X", share: 0.08 },
  { name: "Newsletter", share: 0.06 },
];

const numberFormat = new Intl.NumberFormat("en-US");
const compactFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

/** Counts sum, conversion is a ratio of sums, and bounce rate is weighted by visitors. */
function aggregate(slice: readonly DaySample[], key: MetricKey) {
  if (key === "visitors" || key === "signups")
    return slice.reduce((sum, day) => sum + day[key], 0);
  if (key === "conversion")
    return (
      (slice.reduce((sum, day) => sum + day.signups, 0) /
        slice.reduce((sum, day) => sum + day.visitors, 0)) *
      100
    );
  return (
    slice.reduce((sum, day) => sum + day.bounce * day.visitors, 0) /
    slice.reduce((sum, day) => sum + day.visitors, 0)
  );
}

function buildData(range: RangeValue): DashboardData {
  const { days, step } = RANGES.find((entry) => entry.value === range)!;
  const current = DAYS.slice(180 - days);
  const previous = DAYS.slice(180 - 2 * days, 180 - days);

  const series = {} as Record<MetricKey, SeriesPoint[]>;
  for (const metric of METRICS) {
    const points: SeriesPoint[] = [];
    for (let offset = 0; offset < days; offset += step) {
      points.push({
        date: new Date(TODAY.getTime() - (days - 1 - offset) * 864e5),
        value: aggregate(current.slice(offset, offset + step), metric.key),
        previous: aggregate(previous.slice(offset, offset + step), metric.key),
      });
    }
    series[metric.key] = points;
  }

  const totals = {} as Record<MetricKey, MetricTotal>;
  for (const metric of METRICS) {
    const now = aggregate(current, metric.key);
    const then = aggregate(previous, metric.key);
    totals[metric.key] = {
      value: now,
      delta:
        metric.unit === "percent" ? now - then : ((now - then) / then) * 100,
    };
  }

  return { series, totals, step, visitors: totals.visitors.value };
}

/** The KPI value and the tooltip share one formatter so a tile never contradicts the chart. */
function formatValue(metric: MetricDefinition, value: number) {
  return metric.unit === "percent"
    ? `${value.toFixed(1)}%`
    : numberFormat.format(Math.round(value));
}

/* --------------------------------------------------------------- geometry */

interface ChartScale {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

interface ChartGeometry {
  scale: ChartScale;
  x: (index: number) => number;
  y: (value: number) => number;
  current: string;
  previous: string;
  area: string;
}

/**
 * Monotone cubic interpolation: the tangents are averaged so the curve never overshoots a point,
 * which would invent traffic spikes that are not in the data.
 */
function smoothPath(points: readonly [number, number][]) {
  if (points.length < 3)
    return points
      .map(
        ([x, y], index) =>
          `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`,
      )
      .join(" ");

  const count = points.length;
  const slopes = points
    .slice(1)
    .map(([x, y], index) => (y - points[index][1]) / (x - points[index][0]));
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0];
    if (index === count - 1) return slopes[count - 2];
    const before = slopes[index - 1];
    const after = slopes[index];
    return before * after <= 0 ? 0 : (2 * before * after) / (before + after);
  });

  let path = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let index = 0; index < count - 1; index += 1) {
    const [x0, y0] = points[index];
    const [x1, y1] = points[index + 1];
    const handle = (x1 - x0) / 3;
    path += ` C${(x0 + handle).toFixed(1)} ${(y0 + tangents[index] * handle).toFixed(1)} ${(x1 - handle).toFixed(1)} ${(y1 - tangents[index + 1] * handle).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return path;
}

function chartGeometry(
  points: readonly SeriesPoint[],
  unit: MetricUnit,
  compare: boolean,
): ChartGeometry {
  const values = points.flatMap((point) =>
    compare ? [point.value, point.previous] : [point.value],
  );
  const low = Math.min(...values);
  const high = Math.max(...values);
  // Percentages read badly from a hard zero, so their baseline sits 60% of the range below the low.
  const floor = unit === "percent" ? Math.max(0, low - (high - low) * 0.6) : 0;
  const raw = (high - floor || 1) / 3;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10]
      .map((multiple) => multiple * magnitude)
      .find((value) => value >= raw) ?? raw;
  const min = Math.floor(floor / step) * step;
  const ticks = [0, 1, 2, 3].map((index) => min + step * index);

  const x = (index: number) =>
    points.length === 1 ? 300 : (index / (points.length - 1)) * 600;
  const y = (value: number) =>
    180 - ((value - min) / (min + 3 * step - min)) * 180;

  const current = smoothPath(
    points.map((point, index) => [x(index), y(point.value)]),
  );

  return {
    scale: { min, max: min + 3 * step, step, ticks },
    x,
    y,
    current,
    previous: smoothPath(
      points.map((point, index) => [x(index), y(point.previous)]),
    ),
    area: `${current} L600 180 L0 180 Z`,
  };
}

/* ------------------------------------------------------------------ parts */

interface AnimatedNumberProps {
  /** Target figure; a change animates the rendered text from the previous figure. */
  value: number;
  /** Formatter applied on every frame, so a percent stays a percent while it counts. */
  format: (value: number) => string;
}

/**
 * A number that counts to its new value by writing `textContent` directly — React never re-renders
 * the span mid-animation, which keeps 60 fps on the four KPI tiles and ten breakdown rows.
 */
function AnimatedNumber({ value, format }: AnimatedNumberProps) {
  const node = useRef<HTMLSpanElement>(null);
  const current = useRef(value);
  const formatter = useRef(format);
  const [initial] = useState(() => format(value));
  const reduced = useReducedMotion();

  useEffect(() => {
    formatter.current = format;
  });

  useEffect(() => {
    const element = node.current;
    if (!element) return;
    if (reduced) {
      current.current = value;
      element.textContent = formatter.current(value);
      return;
    }
    const controls = animate(current.current, value, {
      duration: motionTokens.duration.considered,
      ease: [...motionTokens.ease.standard],
      onUpdate: (latest) => {
        current.current = latest;
        element.textContent = formatter.current(latest);
      },
    });
    return () => controls.stop();
  }, [value, reduced]);

  return <span ref={node}>{initial}</span>;
}

interface BreakdownProps {
  /** Section heading and its accessible name. */
  title: string;
  /** Right-hand column label — the unit every row shares. */
  column: string;
  rows: readonly BreakdownRow[];
  total: number;
  /** Reduced motion: bars jump to length instead of wiping open. */
  reduce: boolean;
}

/** One ranked list where the row's tinted bar is scaled against the largest row, not against 100%. */
function Breakdown({ title, column, rows, total, reduce }: BreakdownProps) {
  const max = Math.max(...rows.map((row) => row.share));
  return (
    <section className={styles.breakdown} aria-label={title}>
      <div className={styles.breakdownHead}>
        <h3>{title}</h3>
        <span>{column}</span>
      </div>
      <ul>
        {rows.map((row) => (
          <li key={row.name}>
            <span
              className={styles.bar}
              style={{
                clipPath: `inset(0 ${(100 - (row.share / max) * 100).toFixed(2)}% 0 0 round 6px)`,
                transitionDuration: reduce ? "0ms" : undefined,
              }}
              aria-hidden="true"
            />
            <span className={styles.rowName} title={row.name}>
              {row.name}
            </span>
            <span className={styles.rowValue}>
              <AnimatedNumber
                value={total * row.share}
                format={(value) => numberFormat.format(Math.round(value))}
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------- component */

/**
 * A dense analytics view: a range control, four KPI tabs that pick the charted metric, one line
 * chart with an optional previous-period comparison and a hover or keyboard tooltip, and top pages
 * and sources lists. Takes no props; all figures are sample data.
 *
 * The section measures itself instead of using container queries so the KPI grid, the two-column
 * breakdown and the x-axis label stride all resolve from one number: 4 KPI columns and 6 labels
 * above 640px, 2 columns and 5 labels from 460px, 2 columns and 4 labels below that.
 */
export function MetricsDashboard() {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const [range, setRange] = useState<RangeValue>("30d");
  const [metricKey, setMetricKey] = useState<MetricKey>("visitors");
  const [compare, setCompare] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [exported, setExported] = useState(false);
  const exportTimer = useRef<number | undefined>(undefined);
  const root = useRef<HTMLElement>(null);
  const [size, setSize] = useState<Size>("lg");

  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = (width: number) =>
      setSize(width < 460 ? "sm" : width < 640 ? "md" : "lg");
    measure(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) =>
      measure(entry.contentRect.width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const data = useMemo(() => buildData(range), [range]);
  const metric = METRICS.find((entry) => entry.key === metricKey)!;
  const points = data.series[metricKey];
  const activeRange = RANGES.find((entry) => entry.value === range)!;

  const geometry = useMemo(
    () => chartGeometry(points, metric.unit, compare),
    [points, compare, metric.unit],
  );

  // Six labels on the widest layout, fewer as the chart narrows; the stride keeps them evenly spaced.
  const stride = Math.ceil(
    points.length / (size === "sm" ? 4 : size === "md" ? 5 : 6),
  );
  const hoveredPoint = hovered === null ? null : points[hovered];

  function inspect(event: React.PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    setHovered(
      Math.round(
        Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) *
          (points.length - 1),
      ),
    );
  }

  useEffect(() => () => window.clearTimeout(exportTimer.current), []);

  const quick: Transition = reduced
    ? { duration: 0 }
    : {
        duration: motionTokens.duration.fast,
        ease: [...motionTokens.ease.standard],
      };
  const glide: Transition = reduced
    ? { duration: 0 }
    : motionTokens.spring.smooth;
  const tooltipLeft =
    hovered === null
      ? 0
      : Math.min(88, Math.max(12, (geometry.x(hovered) / 600) * 100));

  return (
    <section
      ref={root}
      className={styles.dashboard}
      data-size={size}
      aria-label="Analytics dashboard"
    >
      <header className={styles.header}>
        <div className={styles.title}>
          <h2>Analytics</h2>
          <p>example.com · {activeRange.long}</p>
        </div>
        <div className={styles.actions}>
          <div
            className={styles.segmented}
            role="group"
            aria-label="Time range"
          >
            {RANGES.map((entry) => (
              <button
                key={entry.value}
                type="button"
                aria-pressed={range === entry.value}
                aria-label={entry.long}
                onClick={() => {
                  setRange(entry.value);
                  setHovered(null);
                }}
              >
                {range === entry.value && (
                  <motion.span
                    layoutId={`${uid}-range`}
                    className={styles.segmentThumb}
                    transition={
                      reduced ? { duration: 0 } : motionTokens.spring.snappy
                    }
                  />
                )}
                <span className={styles.segmentLabel}>{entry.label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.exportButton}
            onClick={() => {
              setExported(true);
              window.clearTimeout(exportTimer.current);
              exportTimer.current = window.setTimeout(
                () => setExported(false),
                1800,
              );
            }}
            aria-live="polite"
          >
            <span className={styles.exportIcon}>
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={exported ? "done" : "idle"}
                  initial={reduced ? false : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                  transition={quick}
                >
                  {exported ? <Check size={14} /> : <Download size={14} />}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className={styles.exportLabel}>
              <span aria-hidden={exported} data-hidden={exported}>
                Export
              </span>
              <span aria-hidden={!exported} data-hidden={!exported}>
                Exported
              </span>
            </span>
          </button>
        </div>
      </header>

      <div className={styles.kpis} role="tablist" aria-label="Metric">
        {METRICS.map((entry) => {
          const total = data.totals[entry.key];
          const better = entry.lowerIsBetter
            ? total.delta < 0
            : total.delta > 0;
          const selected = metricKey === entry.key;
          const delta =
            entry.unit === "percent"
              ? `${Math.abs(total.delta).toFixed(1)} pts`
              : `${Math.abs(total.delta).toFixed(1)}%`;
          return (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={selected}
              className={styles.kpi}
              onClick={() => {
                setMetricKey(entry.key);
                setHovered(null);
              }}
            >
              {selected && (
                <motion.span
                  layoutId={`${uid}-kpi`}
                  className={styles.kpiIndicator}
                  transition={
                    reduced ? { duration: 0 } : motionTokens.spring.smooth
                  }
                />
              )}
              <span className={styles.kpiLabel}>{entry.label}</span>
              <span className={styles.kpiValue}>
                <AnimatedNumber
                  value={total.value}
                  format={(value) => formatValue(entry, value)}
                />
              </span>
              <span
                className={`${styles.delta} ${better ? styles.good : styles.bad}`}
              >
                {total.delta >= 0 ? (
                  <ArrowUpRight size={13} aria-hidden="true" />
                ) : (
                  <ArrowDownRight size={13} aria-hidden="true" />
                )}
                <span>{delta}</span>
                <span className={styles.srOnly}>
                  {total.delta >= 0 ? "up" : "down"} versus previous period
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.chartSection}>
        <div className={styles.chartBar}>
          <div className={styles.legend} aria-hidden="true">
            <span>
              <i className={styles.swatch} />
              {metric.label}
            </span>
            {compare && (
              <span>
                <i className={styles.swatchPrevious} />
                Previous period
              </span>
            )}
          </div>
          <label className={styles.compare}>
            <input
              type="checkbox"
              checked={compare}
              onChange={(event) => setCompare(event.target.checked)}
            />
            <span className={styles.check} aria-hidden="true">
              <Check size={11} strokeWidth={2.5} />
            </span>
            Compare
          </label>
        </div>

        <div className={styles.plot}>
          <div className={styles.yAxis} aria-hidden="true">
            {[...geometry.scale.ticks].reverse().map((tick) => (
              <span key={tick}>
                {metric.unit === "percent"
                  ? `${tick.toFixed(tick < 10 ? 1 : 0)}%`
                  : compactFormat.format(tick)}
              </span>
            ))}
          </div>

          <div
            className={styles.chartArea}
            tabIndex={0}
            role="img"
            aria-label={`${metric.label}, ${activeRange.long.toLowerCase()}. Use arrow keys to inspect values.`}
            onPointerMove={inspect}
            onPointerDown={inspect}
            onPointerLeave={(event) => {
              // A pen leaving the canvas should not dismiss the readout; only a mouse does.
              if (event.pointerType === "mouse") setHovered(null);
            }}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const last = points.length - 1;
              setHovered((index) =>
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? last
                    : Math.min(
                        last,
                        Math.max(
                          0,
                          (index ?? last) +
                            (event.key === "ArrowRight" ? 1 : -1),
                        ),
                      ),
              );
            }}
            onBlur={() => setHovered(null)}
          >
            <div className={styles.grid} aria-hidden="true">
              {geometry.scale.ticks.map((tick) => (
                <span key={tick} />
              ))}
            </div>

            <AnimatePresence initial={false}>
              <motion.svg
                key={range + metricKey}
                className={styles.svg}
                viewBox="0 0 600 180"
                preserveAspectRatio="none"
                aria-hidden="true"
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: reduced ? 0 : motionTokens.duration.standard,
                  ease: [...motionTokens.ease.standard],
                }}
              >
                <motion.path
                  className={styles.area}
                  initial={false}
                  animate={{ d: geometry.area }}
                  transition={glide}
                />
                <motion.path
                  className={styles.previous}
                  initial={false}
                  animate={{ d: geometry.previous, opacity: compare ? 1 : 0 }}
                  transition={glide}
                />
                <motion.path
                  className={styles.line}
                  initial={false}
                  animate={{ d: geometry.current }}
                  transition={glide}
                />
              </motion.svg>
            </AnimatePresence>

            {hoveredPoint && hovered !== null && (
              <>
                <span
                  className={styles.crosshair}
                  style={{ left: `${(geometry.x(hovered) / 600) * 100}%` }}
                  aria-hidden="true"
                />
                <span
                  className={styles.dot}
                  style={{
                    left: `${(geometry.x(hovered) / 600) * 100}%`,
                    top: `${(geometry.y(hoveredPoint.value) / 180) * 100}%`,
                  }}
                  aria-hidden="true"
                />
                <div
                  className={styles.tooltip}
                  style={{
                    left: `${tooltipLeft}%`,
                    ...(geometry.y(hoveredPoint.value) / 180 < 0.5
                      ? { top: "auto", bottom: 6 }
                      : {}),
                  }}
                  role="status"
                >
                  <span className={styles.tooltipDate}>
                    {data.step > 1 ? "Week of " : ""}
                    {dateFormat.format(hoveredPoint.date)}
                  </span>
                  <strong>{formatValue(metric, hoveredPoint.value)}</strong>
                  {compare && (
                    <span className={styles.tooltipPrevious}>
                      {formatValue(metric, hoveredPoint.previous)} previous
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          <div className={styles.xAxis} aria-hidden="true">
            {points.map((point, index) => {
              if (index % stride !== 0) return null;
              const left = (geometry.x(index) / 600) * 100;
              return (
                <span
                  key={index}
                  style={{
                    left: `${left}%`,
                    transform: `translateX(${index === 0 ? 0 : left > 92 ? -100 : -50}%)`,
                  }}
                >
                  {dateFormat.format(point.date)}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.breakdowns}>
        <Breakdown
          title="Top pages"
          column="Visitors"
          rows={TOP_PAGES}
          total={data.visitors}
          reduce={reduced}
        />
        <Breakdown
          title="Sources"
          column="Visitors"
          rows={SOURCES}
          total={data.visitors}
          reduce={reduced}
        />
      </div>
    </section>
  );
}

export default MetricsDashboard;
