"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  useReducedMotion,
} from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import SegmentedControl from "../segmented-control/segmented-control";
import styles from "./horizon-chart.module.css";

/** One row: a name and one signed value per day. */
export interface HorizonSeries {
  /** Stable identity. A row keeps its identity across sorts, so the reorder reads as a move. */
  id: string;
  /** Name in the row, in the tooltip and in the hidden table. */
  name: string;
  /** One value per day, signed distance from that series' baseline: 12 is 12% above, -8 is 8% below. */
  values: number[];
}

/** One day on the shared x axis. */
export interface HorizonDay {
  /** Compact label, used in the hidden table. */
  short: string;
  /** Full label for the readout and screen readers. */
  long: string;
}

/** A label on the x axis, placed at a day index. */
export interface HorizonTick {
  index: number;
  label: string;
}

/** Row order: by name, by the largest swing from baseline, or by the value on the last day. */
export type HorizonSort = "name" | "peak" | "latest";

/** Number of bands each row folds into per side. One band draws a plain area chart. */
export type HorizonBands = 1 | 2 | 3 | 4;

export interface HorizonChartProps {
  /** One row per series: an id, a name and one value per day as a signed distance from its baseline. */
  series?: HorizonSeries[];
  /** Days on the shared x axis, oldest first. */
  days?: HorizonDay[];
  /** Labels on the x axis, each placed at a day index. */
  ticks?: HorizonTick[];
  /** Heading of the block. */
  title?: string;
  /** Line under the title. Pass an empty string to hide it. */
  description?: string;
  /** What the values are measured against, used in the legend caption and for screen readers. */
  baselineLabel?: string;
  /** Opening row order. `peak` is the largest swing from baseline in either direction. */
  defaultSort?: HorizonSort;
  /** Opening number of bands each row folds into. One band draws a plain area chart. */
  defaultBands?: HorizonBands;
  /** Distance from the baseline that fills every band; defaults to the largest value rounded up to a multiple of 12. */
  extent?: number;
  /** Formats a value for the rows, the legend and screen readers. The default uses a true minus sign. */
  formatValue?: (value: number) => string;
  /** Called after the row order changes. */
  onSortChange?: (sort: HorizonSort) => void;
  /** Called after the band count changes. */
  onBandsChange?: (bands: HorizonBands) => void;
  /** Called when the synced crosshair moves to a day, or with null when it clears. */
  onDayChange?: (index: number | null) => void;
  /** Class on the root element. */
  className?: string;
}

/* ------------------------------------------------------------------ sample data */

const MONTHS_SHORT = ["Jun", "Jul", "Aug", "Sep"] as const;
const MONTHS_LONG = ["June", "July", "August", "September"] as const;
const DAYS_IN_MONTH = [30, 31, 31, 30] as const;
const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/** Day index of `day` (1-based) in the month whose offset row is `month`. June is row 6, matching `Date.getMonth()`. */
function dayIndex(month: number, day: number): number {
  let offset = 0;
  for (let row = 6; row < month; row += 1) offset += DAYS_IN_MONTH[row - 6];
  return offset + day - 1;
}

/** 119 days, June 1 to September 27, with a compact and a long label each. */
export const horizonDays: HorizonDay[] = (() => {
  const out: HorizonDay[] = [];
  let month = 0;
  let day = 1;
  for (let index = 0; index < 119; index += 1) {
    out.push({
      short: `${MONTHS_SHORT[month]} ${day}`,
      long: `${WEEKDAYS[index % 7]}, ${MONTHS_LONG[month]} ${day}`,
    });
    day += 1;
    if (day > DAYS_IN_MONTH[month]) {
      month += 1;
      day = 1;
    }
  }
  return out;
})();

/** The first day of each month, for the x axis. */
export const horizonMonthTicks: HorizonTick[] = MONTHS_SHORT.map(
  (label, row) => ({
    index: dayIndex(6 + row, 1),
    label,
  }),
);

export const horizonDescription =
  "Daily sessions by market compared with each market's spring average, June to September 2026";

/** A plateau: 0 outside `start - fadeIn` / `end + fadeOut`, ramping in and out of the window. */
function plateau(
  value: number,
  start: number,
  end: number,
  fadeIn = 4,
  fadeOut = 4,
): number {
  if (value < start - fadeIn || value > end + fadeOut) return 0;
  if (value < start) return (value - (start - fadeIn)) / fadeIn;
  if (value > end) return 1 - (value - end) / fadeOut;
  return 1;
}

/** A one-sided spike that peaks at `at` and decays with a half-life of `halfLife` days. */
function decay(value: number, at: number, halfLife: number, rise = 2): number {
  if (value < at - rise) return 0;
  if (value < at) return (value - (at - rise)) / rise;
  return Math.pow(0.5, (value - at) / halfLife);
}

/** Deterministic per-series noise so the demo data is identical on every render and every machine. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    let next = (state = (state + 0x6d2b79f5) >>> 0);
    next = Math.imul(next ^ (next >>> 15), 1 | next);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 0x100000000;
  };
}

interface SeriesShape {
  id: string;
  name: string;
  /** Amplitude of the daily random walk and jitter, in percent. */
  noise: number;
  /** Extra percent on Saturdays and Sundays. */
  weekend: number;
  /** The seasonal curve, in percent against the baseline. */
  shape: (day: number) => number;
}

const SERIES_SHAPES: SeriesShape[] = [
  {
    id: "amsterdam",
    name: "Amsterdam",
    noise: 2.6,
    weekend: -3,
    shape: (day) => 1 + 0.02 * day + 32 * decay(day, dayIndex(9, 8), 5),
  },
  {
    id: "berlin",
    name: "Berlin",
    noise: 2.4,
    weekend: -2,
    shape: (day) =>
      -1 + 0.09 * day - 6 * plateau(day, dayIndex(8, 3), dayIndex(8, 14)),
  },
  {
    id: "copenhagen",
    name: "Copenhagen",
    noise: 2.8,
    weekend: -2,
    shape: (day) =>
      1 - 19 * plateau(day, dayIndex(6, 29), dayIndex(7, 24), 6, 6),
  },
  {
    id: "dublin",
    name: "Dublin",
    noise: 3.2,
    weekend: -1,
    shape: (day) => 0.5 + 2 * Math.sin(day / 9),
  },
  {
    id: "lisbon",
    name: "Lisbon",
    noise: 3,
    weekend: 1,
    shape: (day) =>
      1 - 24 * plateau(day, dayIndex(8, 1), dayIndex(8, 23), 6, 7),
  },
  {
    id: "london",
    name: "London",
    noise: 2.4,
    weekend: -3,
    shape: (day) =>
      1 +
      30 * decay(day, dayIndex(7, 6), 9, 4) +
      9 * plateau(day, dayIndex(9, 7), dayIndex(9, 30), 5, 0),
  },
  {
    id: "madrid",
    name: "Madrid",
    noise: 2.8,
    weekend: 0,
    shape: (day) =>
      0.5 - 29 * plateau(day, dayIndex(8, 1), dayIndex(8, 24), 6, 6),
  },
  {
    id: "milan",
    name: "Milan",
    noise: 2.6,
    weekend: -1,
    shape: (day) =>
      0 -
      35 * plateau(day, dayIndex(8, 6), dayIndex(8, 23), 5, 5) -
      8 * plateau(day, dayIndex(7, 25), dayIndex(8, 30), 6, 6),
  },
  {
    id: "paris",
    name: "Paris",
    noise: 2.5,
    weekend: -2,
    shape: (day) =>
      0.5 -
      31 * plateau(day, dayIndex(7, 31), dayIndex(8, 21), 6, 7) +
      6 * plateau(day, dayIndex(9, 1), dayIndex(9, 30), 4, 0),
  },
  {
    id: "prague",
    name: "Prague",
    noise: 2.4,
    weekend: -2,
    shape: (day) =>
      -2 + 0.15 * day - 7 * plateau(day, dayIndex(7, 13), dayIndex(8, 9)),
  },
  {
    id: "stockholm",
    name: "Stockholm",
    noise: 2.5,
    weekend: -1,
    shape: (day) =>
      0.5 -
      30 * plateau(day, dayIndex(6, 19), dayIndex(6, 20), 1, 2) -
      13 * plateau(day, dayIndex(7, 1), dayIndex(7, 31), 6, 8),
  },
  {
    id: "vienna",
    name: "Vienna",
    noise: 2.4,
    weekend: -2,
    shape: (day) =>
      0.5 - 15 * plateau(day, dayIndex(8, 3), dayIndex(8, 21), 6, 6),
  },
  {
    id: "warsaw",
    name: "Warsaw",
    noise: 2.6,
    weekend: -2,
    shape: (day) =>
      -1 +
      0.12 * day -
      44 * plateau(day, dayIndex(8, 18), dayIndex(8, 18), 1, 2),
  },
  {
    id: "zurich",
    name: "Zurich",
    noise: 2.2,
    weekend: -1,
    shape: (day) =>
      2 - 0.07 * day - 4 * plateau(day, dayIndex(7, 13), dayIndex(8, 7)),
  },
];

/** Fourteen European markets whose deviation from their spring average is the story. */
export const horizonSeries: HorizonSeries[] = SERIES_SHAPES.map(
  (shape, row) => {
    const random = seededRandom(9127 + 131 * row);
    let drift = 0;
    const values: number[] = [];
    for (let day = 0; day < 119; day += 1) {
      drift = 0.7 * drift + (random() - 0.5) * shape.noise;
      const weekend = day % 7 >= 5 ? shape.weekend : 0;
      const value =
        shape.shape(day) + weekend + drift + (random() - 0.5) * shape.noise;
      values.push(Math.round(10 * Math.max(-36, Math.min(36, value))) / 10);
    }
    return { id: shape.id, name: shape.name, values };
  },
);

/* ------------------------------------------------------------------ geometry */

/** Every row always draws four layers per side, so the band count can fold continuously. */
const LAYERS = [0, 1, 2, 3] as const;

/** Opacity of the outermost band: a stack of `bands` layers lands on a fixed contrast. */
function alphaFor(bands: number): number {
  return 1 - Math.pow(0.08, 1 / Math.max(1, bands));
}

const SORT_OPTIONS: { value: HorizonSort; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "peak", label: "Peak" },
  { value: "latest", label: "Latest" },
];

const SORT_ANNOUNCEMENT: Record<HorizonSort, string> = {
  name: "by name",
  peak: "by largest swing",
  latest: "by latest value",
};

const BAND_OPTIONS: { value: string; label: string }[] = (
  [1, 2, 3, 4] as const
).map((bands) => ({
  value: String(bands),
  label: String(bands),
}));

/** The demo data never overshoots 36%, so the extent lands on a round twelve. */
const DEFAULT_BANDS: HorizonBands = 3;

/** One area path in a unit box: day on x, share of the extent on y, closing back along the baseline. */
function areaPath(
  values: number[],
  accessor: (value: number) => number,
  extent: number,
): string {
  if (values.length === 0) return "";
  let path = "M0,0";
  values.forEach((value, index) => {
    const share = Math.min(Math.max(accessor(value), 0), extent) / extent;
    path += `L${index},${share === 0 ? 0 : -Math.round(10000 * share) / 10000}`;
  });
  return `${path}L${values.length - 1},0Z`;
}

/** Row plus its derived summary: ends, extremes and the two area paths. */
interface HorizonRow extends HorizonSeries {
  latest: number;
  peak: number;
  peakIndex: number;
  high: number;
  highIndex: number;
  low: number;
  lowIndex: number;
  above: string;
  below: string;
}

/** Swatches: a band that exists grows to fill its share, bands past the count collapse away. */
type RampStyle = CSSProperties & { "--grow"?: number; opacity?: number };

function swatchStyle(layer: number, bands: number): RampStyle {
  return layer < bands
    ? { "--grow": 1, opacity: 1 - Math.pow(1 - alphaFor(bands), layer + 1) }
    : { "--grow": 0, opacity: 0 };
}

type VarStyle = CSSProperties & Record<`--${string}`, string | number>;

/** Signed whole percent with a true minus sign, so the direction never depends on color. */
export function formatSignedPercent(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return "0%";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded)}%`;
}

/** One decimal percent for the legend's band size. */
function formatBand(value: number): string {
  return `${Math.round(10 * value) / 10}%`;
}

const sortSpring = { ...motionTokens.spring.smooth, visualDuration: 0.55 };
const foldSpring = { ...motionTokens.spring.smooth, visualDuration: 0.6 };
const crosshairSpring = {
  type: "spring" as const,
  visualDuration: 0.16,
  bounce: 0,
};
const instant = { duration: 0 };

/**
 * A horizon chart that stacks many daily series as compact rows. Each row folds its curve into bands
 * of rising intensity, one hue above the baseline and one below, so a dozen series fit in the height
 * of two line charts. A synced crosshair reads every row on the same day, rows sort by name, peak
 * swing or latest value on one spring, a band count setting folds and unfolds every row together,
 * and a legend explains how to read the bands.
 */
export function HorizonChart({
  series = horizonSeries,
  days = horizonDays,
  ticks = horizonMonthTicks,
  title = "Sessions against baseline",
  description = horizonDescription,
  baselineLabel = "spring average",
  defaultSort = "peak",
  defaultBands = DEFAULT_BANDS,
  extent,
  formatValue = formatSignedPercent,
  onSortChange,
  onBandsChange,
  onDayChange,
  className,
}: HorizonChartProps) {
  const uid = useId();
  const reduced = useReducedMotion();

  const [sort, setSort] = useState<HorizonSort>(defaultSort);
  const [bands, setBands] = useState<HorizonBands>(defaultBands);
  // Frozen at mount so the server-rendered inline custom properties never disagree with the markup.
  const [openingBands] = useState<HorizonBands>(defaultBands);
  const [announcement, setAnnouncement] = useState("");

  const last = Math.max(0, days.length - 1);

  /** Band width: the extent, or the largest value rounded up to a multiple of twelve. */
  const scale = useMemo(() => {
    if (extent && extent > 0) return extent;
    let max = 0;
    for (const row of series)
      for (const value of row.values) max = Math.max(max, Math.abs(value));
    return Math.max(12, 12 * Math.ceil(max / 12));
  }, [extent, series]);

  const rows = useMemo<HorizonRow[]>(
    () =>
      series.map((row) => {
        let peak = 0;
        let peakIndex = 0;
        let high = -Infinity;
        let highIndex = 0;
        let low = Infinity;
        let lowIndex = 0;
        row.values.forEach((value, index) => {
          if (Math.abs(value) > Math.abs(peak)) {
            peak = value;
            peakIndex = index;
          }
          if (value > high) {
            high = value;
            highIndex = index;
          }
          if (value < low) {
            low = value;
            lowIndex = index;
          }
        });
        return {
          ...row,
          latest: row.values[last] ?? 0,
          peak,
          peakIndex,
          high,
          highIndex,
          low,
          lowIndex,
          above: areaPath(row.values, (value) => value, scale),
          below: areaPath(row.values, (value) => -value, scale),
        };
      }),
    [series, scale, last],
  );

  const ordered = useMemo(() => {
    const copy = [...rows];
    if (sort === "name")
      copy.sort((a, b) => a.name.localeCompare(b.name, "en"));
    else if (sort === "peak")
      copy.sort(
        (a, b) =>
          Math.abs(b.peak) - Math.abs(a.peak) ||
          a.name.localeCompare(b.name, "en"),
      );
    else
      copy.sort(
        (a, b) => b.latest - a.latest || a.name.localeCompare(b.name, "en"),
      );
    return copy;
  }, [rows, sort]);

  const rootRef = useRef<HTMLElement>(null);

  /* The band count is one motion value: every layer in every row folds on the same spring. */
  const bandMotion = useMotionValue(openingBands);

  useEffect(
    () =>
      bandMotion.on("change", (value) => {
        const node = rootRef.current;
        if (!node) return;
        node.style.setProperty("--bands", String(value));
        node.style.setProperty("--alpha", alphaFor(value).toFixed(4));
      }),
    [bandMotion],
  );

  useEffect(() => {
    if (reduced) {
      bandMotion.set(bands);
      return;
    }
    const controls = animate(bandMotion, bands, foldSpring);
    return () => controls.stop();
  }, [bands, reduced, bandMotion]);

  /* Crosshair: the pointer and the keyboard write straight to the DOM, so scrubbing never renders. */
  const activeRef = useRef<number | null>(null);
  const valueNodes = useRef(new Map<string, HTMLSpanElement>());
  const dateRef = useRef<HTMLSpanElement>(null);
  const stateRef = useRef<HTMLSpanElement>(null);
  const crossLayerRef = useRef<HTMLDivElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  const xPercent = useMotionValue(100);
  const crosshairX = useTransform(xPercent, (value) => `${value}%`);
  const xAnimation = useRef<{ stop: () => void } | null>(null);

  const rowsRef = useRef(rows);
  const daysRef = useRef(days);
  const formatRef = useRef(formatValue);
  const dayChangeRef = useRef(onDayChange);

  useEffect(() => {
    rowsRef.current = rows;
    daysRef.current = days;
    formatRef.current = formatValue;
    dayChangeRef.current = onDayChange;
  });

  const writeReadout = (index: number | null) => {
    const target = index ?? last;
    for (const row of rowsRef.current) {
      const node = valueNodes.current.get(row.id)?.firstChild;
      if (node) node.nodeValue = formatRef.current(row.values[target] ?? 0);
    }
    const dateNode = dateRef.current?.firstChild;
    if (dateNode) dateNode.nodeValue = daysRef.current[target]?.long ?? "";
    const stateNode = stateRef.current?.firstChild;
    if (stateNode)
      stateNode.nodeValue = index === null ? "Latest day" : "Selected day";
  };

  const selectDay = (next: number | null) => {
    const previous = activeRef.current;
    if (next === previous) return;
    activeRef.current = next;
    writeReadout(next);
    crossLayerRef.current?.toggleAttribute("data-on", next !== null);
    if (next !== null) {
      const percent = last === 0 ? 0 : (next / last) * 100;
      xAnimation.current?.stop();
      // A crosshair that appears in place should not slide in from wherever it was last.
      if (reduced || previous === null) xPercent.set(percent);
      else xAnimation.current = animate(xPercent, percent, crosshairSpring);
    }
    dayChangeRef.current?.(next);
  };

  // Data can change under a live crosshair (a new day arrives); rewrite the readout in place.
  useEffect(() => {
    if (activeRef.current !== null) writeReadout(activeRef.current);
  });

  const indexFromPointer = (
    event: PointerEvent<HTMLDivElement>,
  ): number | null => {
    const rect = hitRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return Math.round(
      Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) * last,
    );
  };

  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (announceTimer.current) clearTimeout(announceTimer.current);
    },
    [],
  );

  /** The highest and lowest row for one day, announced once the scrub settles. */
  const announceDay = (index: number) => {
    if (announceTimer.current) clearTimeout(announceTimer.current);
    announceTimer.current = setTimeout(() => {
      const current = rowsRef.current;
      if (current.length === 0) return;
      let high = current[0];
      let low = current[0];
      for (const row of current) {
        if ((row.values[index] ?? 0) > (high.values[index] ?? 0)) high = row;
        if ((row.values[index] ?? 0) < (low.values[index] ?? 0)) low = row;
      }
      const format = formatRef.current;
      setAnnouncement(
        `${daysRef.current[index]?.long ?? ""}. Highest ${high.name} ${format(high.values[index] ?? 0)}, lowest ${low.name} ${format(low.values[index] ?? 0)}.`,
      );
    }, 220);
  };

  const bandWidth = formatBand(scale / bands);
  const caption =
    bands === 1
      ? `With one band, each row is a plain area chart up to ${formatBand(scale)} from the ${baselineLabel}.`
      : `Each row folds into ${bands} bands of ${bandWidth}. Stronger color means further from the ${baselineLabel}.`;

  const rootStyle: VarStyle = {
    "--bands": openingBands,
    "--alpha": alphaFor(openingBands).toFixed(4),
  };
  const lastDay = days[last];

  return (
    <section
      ref={rootRef}
      className={`${styles.root} ${className ?? ""}`}
      style={rootStyle}
      aria-labelledby={`${uid}-title`}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 id={`${uid}-title`} className={styles.title}>
            {title}
          </h2>
          {description ? (
            <p className={styles.description}>{description}</p>
          ) : null}
        </div>
        <div className={styles.controls}>
          <div className={styles.control}>
            <span className={styles.controlLabel} aria-hidden="true">
              Sort
            </span>
            <SegmentedControl
              className={styles.segment}
              label="Sort rows"
              options={SORT_OPTIONS}
              value={sort}
              onValueChange={(value) => {
                const next = value as HorizonSort;
                setSort(next);
                setAnnouncement(`Rows sorted ${SORT_ANNOUNCEMENT[next]}.`);
                onSortChange?.(next);
              }}
            />
          </div>
          <div className={styles.control}>
            <span className={styles.controlLabel} aria-hidden="true">
              Bands
            </span>
            <SegmentedControl
              className={styles.segment}
              label="Band count"
              options={BAND_OPTIONS}
              value={String(bands)}
              onValueChange={(value) => {
                const next = Number(value) as HorizonBands;
                setBands(next);
                setAnnouncement(
                  `${next === 1 ? "One band" : `${next} bands`} of ${formatBand(scale / next)}.`,
                );
                onBandsChange?.(next);
              }}
            />
          </div>
        </div>
      </header>

      <div className={styles.readout}>
        <p className={styles.when}>
          <span ref={dateRef} className={styles.date}>
            {lastDay?.long ?? ""}
          </span>
          <span ref={stateRef} className={styles.state}>
            Latest day
          </span>
        </p>
        <div className={styles.legend}>
          <div
            className={styles.scale}
            role="img"
            aria-label={`Color scale from ${formatBand(scale)} below to ${formatBand(scale)} above the ${baselineLabel}, in ${bands === 1 ? "one band" : `${bands} bands`} per side.`}
          >
            <div className={styles.ramp}>
              {[...LAYERS].reverse().map((layer) => (
                <span
                  key={`b${layer}`}
                  className={styles.swatchBelow}
                  style={swatchStyle(layer, bands)}
                />
              ))}
              <span className={styles.zero} />
              {LAYERS.map((layer) => (
                <span
                  key={`a${layer}`}
                  className={styles.swatchAbove}
                  style={swatchStyle(layer, bands)}
                />
              ))}
            </div>
            <div className={styles.scaleLabels} aria-hidden="true">
              <span className={styles.scaleEnd}>−{formatBand(scale)}</span>
              <span className={styles.scaleSide}>Below</span>
              <span className={styles.scaleZero}>0</span>
              <span className={styles.scaleSide}>Above</span>
              <span className={styles.scaleEnd}>+{formatBand(scale)}</span>
            </div>
          </div>
          <p className={styles.caption}>{caption}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className={styles.empty}>
          No series to show yet. Add a series with daily values to draw its row.
        </p>
      ) : (
        <>
          <div
            className={styles.chart}
            data-chart=""
            tabIndex={0}
            role="group"
            aria-label={`${title}. ${rows.length} rows`}
            aria-describedby={`${uid}-hint`}
            onKeyDown={(event) => {
              const base = activeRef.current ?? last;
              const step = event.shiftKey ? 7 : 1;
              let target: number | null | undefined;
              if (event.key === "ArrowLeft") target = Math.max(0, base - step);
              else if (event.key === "ArrowRight")
                target = Math.min(last, base + step);
              else if (event.key === "Home") target = 0;
              else if (event.key === "End") target = last;
              else if (event.key === "Escape") target = null;
              if (target === undefined) return;
              event.preventDefault();
              selectDay(target);
              if (target !== null) announceDay(target);
            }}
            onFocus={() => {
              if (activeRef.current === null) {
                selectDay(last);
                announceDay(last);
              }
            }}
            onBlur={() => selectDay(null)}
          >
            <div className={styles.body}>
              <ol className={styles.rows}>
                {ordered.map((row) => (
                  <motion.li
                    key={row.id}
                    layout="position"
                    transition={reduced ? instant : sortSpring}
                    className={styles.row}
                  >
                    <span className={styles.name} title={row.name}>
                      {row.name}
                    </span>
                    <span className={styles.plot}>
                      <svg
                        className={styles.svg}
                        viewBox={`0 0 ${Math.max(1, last)} 1`}
                        preserveAspectRatio="none"
                        aria-hidden="true"
                        focusable="false"
                      >
                        {LAYERS.map((layer) => (
                          <path
                            key={`b${layer}`}
                            className={styles.below}
                            d={row.below}
                            style={{ "--layer": layer + 1 } as VarStyle}
                          />
                        ))}
                        {LAYERS.map((layer) => (
                          <path
                            key={`a${layer}`}
                            className={styles.above}
                            d={row.above}
                            style={{ "--layer": layer + 1 } as VarStyle}
                          />
                        ))}
                      </svg>
                    </span>
                    <span
                      className={styles.value}
                      ref={(node) => {
                        if (node) valueNodes.current.set(row.id, node);
                        else valueNodes.current.delete(row.id);
                      }}
                    >
                      {formatValue(row.latest)}
                    </span>
                  </motion.li>
                ))}
              </ol>
              <div className={styles.overlay} aria-hidden="true">
                <div ref={crossLayerRef} className={styles.crossLayer}>
                  <motion.span
                    className={styles.crossTrack}
                    style={{ x: crosshairX }}
                  >
                    <span className={styles.crossLine} />
                  </motion.span>
                </div>
                <div
                  ref={hitRef}
                  className={styles.hit}
                  onPointerDown={(event) => {
                    selectDay(indexFromPointer(event));
                  }}
                  onPointerMove={(event) => {
                    if (event.pointerType === "mouse" || event.buttons > 0)
                      selectDay(indexFromPointer(event));
                  }}
                  onPointerLeave={(event) => {
                    // A tap keeps the crosshair; only a mouse leaving clears it, and never while focused.
                    if (
                      event.pointerType === "mouse" &&
                      document.activeElement !==
                        event.currentTarget.closest("[data-chart]")
                    )
                      selectDay(null);
                  }}
                />
              </div>
            </div>
            <div className={styles.axis} aria-hidden="true">
              <span className={styles.axisTrack}>
                {ticks
                  .filter((tick) => tick.index >= 0 && tick.index <= last)
                  .map((tick) => (
                    <span
                      key={`${tick.index}-${tick.label}`}
                      className={styles.tick}
                      style={{
                        left: `${last === 0 ? 0 : (tick.index / last) * 100}%`,
                      }}
                    >
                      {tick.label}
                    </span>
                  ))}
              </span>
            </div>
          </div>
          <p id={`${uid}-hint`} className={styles.srOnly}>
            Use the left and right arrow keys to move the crosshair by one day,
            Shift with an arrow for one week, Home and End for the first and
            last day, and Escape to clear it.
          </p>
          <div className={styles.srOnly}>
            <table>
              <caption>
                {title}, values against the {baselineLabel}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Row</th>
                  <th scope="col">Latest</th>
                  <th scope="col">Highest</th>
                  <th scope="col">Lowest</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{row.name}</th>
                    <td>{formatValue(row.latest)}</td>
                    <td>
                      {formatValue(row.high)} on {days[row.highIndex]?.short}
                    </td>
                    <td>
                      {formatValue(row.low)} on {days[row.lowIndex]?.short}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}

export default HorizonChart;
