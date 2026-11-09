"use client";

import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import SegmentedControl from "../segmented-control/segmented-control";
import { Switch } from "../switch/switch";
import { motionTokens } from "../motion-tokens";
import styles from "./small-multiples.module.css";

/* ------------------------------------------------------------------ data model */

export type SmallMultiplesSort = "latest" | "growth" | "name";
export type SmallMultiplesScale = "independent" | "shared";

export interface SmallMultiplesSeries {
  /** Stable id. Used as the React key and to keep panels tracked across sorts. */
  id: string;
  /** Panel heading. */
  name: string;
  /** One value per period, oldest first. Shorter series simply stop early. */
  values: number[];
}

export interface SmallMultiplesPeriod {
  /** Compact axis label, e.g. "Sep 2026". */
  short: string;
  /** Full label used in the readout, the announcements and the table caption. */
  long: string;
}

/* ------------------------------------------------------------------ sample data */

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Twenty-four months starting September 2024, so the frame opens on September 2026. */
export const smallMultiplesPeriods: SmallMultiplesPeriod[] = Array.from({ length: 24 }, (_, index) => {
  const month = (9 + index) % 12;
  const year = 2024 + Math.floor((9 + index) / 12);
  return { short: `${MONTHS_SHORT[month]} ${year}`, long: `${MONTHS_LONG[month]} ${year}` };
});

/** Deterministic mulberry32: the sample is seeded per region so every render produces the same line. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    let t = (state = (state + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    return (((t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t) ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

const REGIONS = [
  { id: "na", name: "North America", base: 1180, growth: 0.016, season: 0.06, noise: 0.018, seed: 11 },
  { id: "uk", name: "United Kingdom", base: 540, growth: 0.009, season: 0.05, noise: 0.02, seed: 23 },
  { id: "de", name: "Germany", base: 612, growth: 8e-4, season: 0.04, noise: 0.012, seed: 37 },
  { id: "fr", name: "France", base: 384, growth: -6e-4, season: 0.05, noise: 0.012, seed: 41 },
  { id: "nordics", name: "Nordics", base: 236, growth: 0.024, season: 0.07, noise: 0.022, seed: 53 },
  { id: "jp", name: "Japan", base: 428, growth: -0.011, season: 0.03, noise: 0.016, seed: 67 },
  { id: "au", name: "Australia", base: 262, growth: 0.0012, season: 0.04, noise: 0.014, seed: 79 },
  { id: "br", name: "Brazil", base: 148, growth: 0.038, season: 0.05, noise: 0.03, seed: 97 },
];

export const smallMultiplesSeries: SmallMultiplesSeries[] = REGIONS.map((region) => {
  const random = seeded(region.seed);
  return {
    id: region.id,
    name: region.name,
    values: Array.from({ length: 24 }, (_, index) => {
      const season = 1 + region.season * Math.cos(((((9 + index) % 12) - 11) / 12) * Math.PI * 2);
      const noise = 1 + (2 * random() - 1) * region.noise;
      return Math.round(region.base * Math.pow(1 + region.growth, index) * season * noise);
    }),
  };
});

export const smallMultiplesDescription = "Monthly net revenue, October 2024 to September 2026";

/* ------------------------------------------------------------------ motion presets */

const { spring, duration, ease } = motionTokens;
const domainSpring = { ...spring.smooth, visualDuration: 0.55 };
const layoutSpring = { ...spring.smooth, visualDuration: 0.6 };
const crossSpring = { type: "spring", visualDuration: 0.16, bounce: 0 } as const;
const instant = { duration: 0 };
/** Bezier tuple, not a widened number[]: `transition` needs the four-point form. */
const fade = { duration: duration.standard, ease: [...ease.standard] as [number, number, number, number] };

/* ------------------------------------------------------------------ helpers */

const SORTS = [
  { value: "latest", label: "Latest" },
  { value: "growth", label: "Growth" },
  { value: "name", label: "Name" },
] as const;

const SCALES = [
  { value: "independent", label: "Independent" },
  { value: "shared", label: "Shared" },
] as const;

const SORT_NOUN: Record<SmallMultiplesSort, string> = {
  latest: "latest value",
  growth: "growth",
  name: "name",
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Readout money: two decimals in millions, whole thousands below that. */
function formatMoney(value: number) {
  return Math.abs(value) >= 1000 ? `$${(value / 1000).toFixed(2)}M` : `$${Math.round(value)}k`;
}

/** Tick money: a single decimal in millions so the axis stays short. */
function formatTickMoney(value: number) {
  return Math.abs(value) >= 1000 ? `$${Number((value / 1000).toFixed(1))}M` : `$${Math.round(value)}k`;
}

/** A true minus sign (U+2212), and no sign at all below a tenth of a percent. */
function formatGrowth(growth: number) {
  const percent = 100 * Math.abs(growth);
  return `${growth < 0 && percent >= 0.05 ? "−" : "+"}${percent.toFixed(1)}%`;
}

/** A round step near `range / count`: 1, 2, 5 or 10 times a power of ten. */
function niceStep(range: number, count: number) {
  const rough = range / Math.max(1, count);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough || 1)));
  const normalized = rough / magnitude;
  return (normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10) * magnitude;
}

function ticksBetween(lo: number, hi: number, count: number) {
  const step = niceStep(hi - lo, count);
  const ticks: number[] = [];
  for (let value = Math.ceil(lo / step) * step; value <= hi + 1e-9; value += step) {
    ticks.push(Math.round(1e6 * value) / 1e6);
  }
  return ticks;
}

/** Path in the svg's 1000 × 100 viewBox; the box is stretched, strokes stay 1px. */
function linePath(values: number[], lo: number, hi: number) {
  const span = hi - lo || 1;
  const last = Math.max(1, values.length - 1);
  return values
    .map((value, index) => `${index ? "L" : "M"}${((index / last) * 1000).toFixed(2)},${((1 - (value - lo) / span) * 100).toFixed(2)}`)
    .join("");
}

/* ------------------------------------------------------------------ tick row */

function Tick({ value, visible, lo, hi, label }: { value: number; visible: boolean; lo: ReturnType<typeof useMotionValue<number>>; hi: ReturnType<typeof useMotionValue<number>>; label: string }) {
  const y = useTransform(() => `${(1 - (value - lo.get()) / (hi.get() - lo.get() || 1)) * 100}%`);
  return (
    <motion.div className={styles.tickLayer} style={{ y }} initial={false} animate={{ opacity: Number(!!visible) }} transition={fade} aria-hidden="true">
      <span className={styles.tickLine} />
      <span className={styles.tickLabel}>{label}</span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ panel */

interface PanelProps {
  item: SmallMultiplesSeries;
  latest: number;
  growth: number;
  flat: boolean;
  dim: boolean;
  target: { lo: number; hi: number };
  ticks: { value: number; visible: boolean }[];
  ghost: string;
  cx: ReturnType<typeof useMotionValue<number>>;
  cursor: number | null;
  compareLabel: string;
  layoutKey: string;
  reduce: boolean;
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
}

/** One panel: its own y-domain that springs when the scale or the data changes, a shared ghost line behind it, and a crosshair reading. */
const Panel = memo(function Panel({ item, latest, growth, flat, dim, target, ticks, ghost, cx, cursor, compareLabel, layoutKey, reduce, formatValue, formatTick }: PanelProps) {
  const lo = useMotionValue(target.lo);
  const hi = useMotionValue(target.hi);

  useEffect(() => {
    const down = animate(lo, target.lo, reduce ? instant : domainSpring);
    const up = animate(hi, target.hi, reduce ? instant : domainSpring);
    return () => {
      down.stop();
      up.stop();
    };
  }, [target.lo, target.hi, lo, hi, reduce]);

  const values = item.values;
  const last = Math.max(1, values.length - 1);
  const yOf = (value: number) => `${(1 - (value - lo.get()) / (hi.get() - lo.get() || 1)) * 100}%`;

  const path = useTransform(() => linePath(values, lo.get(), hi.get()));
  const areaPath = useTransform(() => `${linePath(values, lo.get(), hi.get())}L1000,100L0,100Z`);
  const endY = useTransform(() => yOf(values[values.length - 1]));
  const crossX = useTransform(() => `${100 * cx.get()}%`);
  const crossY = useTransform(() => {
    const exact = clamp(cx.get() * last, 0, values.length - 1);
    const low = Math.floor(exact);
    const high = Math.min(values.length - 1, low + 1);
    return yOf(values[low] + (values[high] - values[low]) * (exact - low));
  });

  const reading = cursor === null ? latest : values[clamp(cursor, 0, values.length - 1)];
  const Icon: LucideIcon = flat ? Minus : growth > 0 ? ArrowUpRight : ArrowDownRight;
  const trendText = flat ? "Flat" : formatGrowth(growth);
  const spoken = `${flat ? "Flat trend, " : growth > 0 ? "Up " : "Down "}${flat ? formatGrowth(growth) : `${Math.abs(100 * growth).toFixed(1)}%`} ${compareLabel}`;

  return (
    <motion.li className={styles.panel} layout="position" layoutDependency={layoutKey} transition={reduce ? instant : layoutSpring} data-dim={dim || undefined}>
      <div className={styles.panelInner}>
        <div className={styles.panelHead}>
          <h3 className={styles.name}>{item.name}</h3>
          <span className={styles.value} data-scrub={cursor !== null || undefined}>
            {formatValue(reading)}
          </span>
        </div>
        <p className={styles.trend} data-flat={flat || undefined}>
          <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
          <span className={styles.trendValue} aria-hidden="true">
            {trendText}
          </span>
          <span className={styles.compare} aria-hidden="true">
            {flat ? formatGrowth(growth) : compareLabel}
          </span>
          <span className={styles.srOnly}>{spoken}</span>
        </p>
        <div className={styles.plot} aria-hidden="true">
          <div className={styles.ticks}>
            {ticks.map((tick) => (
              <Tick key={tick.value} value={tick.value} visible={tick.visible} lo={lo} hi={hi} label={formatTick(tick.value)} />
            ))}
          </div>
          <div className={styles.chart} data-plot="">
            <svg className={styles.svg} viewBox="0 0 1000 100" preserveAspectRatio="none" focusable="false">
              <path className={styles.ghostLine} d={ghost} vectorEffect="non-scaling-stroke" />
              <motion.path className={styles.area} d={areaPath} />
              <motion.path className={styles.line} d={path} vectorEffect="non-scaling-stroke" />
            </svg>
            <div className={styles.xLayer} style={{ transform: "translateX(100%)" }}>
              <motion.div className={styles.yLayer} style={{ y: endY }}>
                <span className={styles.endDot} />
              </motion.div>
            </div>
            <motion.div className={styles.xLayer} data-cross="" data-on={cursor !== null || undefined} style={{ x: crossX }}>
              <span className={styles.crossLine} />
              <motion.div className={styles.yLayer} style={{ y: crossY }}>
                <span className={styles.crossDot} />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.li>
  );
});

/* ------------------------------------------------------------------ block */

export interface SmallMultiplesProps {
  /** One entry per panel: an id, a name and one value per period (oldest first). Defaults to eight regions over twenty-four months. */
  series?: SmallMultiplesSeries[];
  /** Periods the values line up with, oldest first. Defaults to the twenty-four months ending September 2026. */
  periods?: SmallMultiplesPeriod[];
  /** Heading of the block. */
  title?: string;
  /** One line under the heading that names what is measured and when. */
  description?: string;
  /** Panel order on first paint. */
  defaultSort?: SmallMultiplesSort;
  /** "independent" gives each panel its own y-domain for shape; "shared" puts every panel on one axis for size. */
  defaultScale?: SmallMultiplesScale;
  /** Dims panels whose growth is under `flatThreshold` on first paint. */
  defaultDimFlat?: boolean;
  /** Absolute growth below this reads as flat, as a ratio (0.05 = 5%). */
  flatThreshold?: number;
  /** Periods back the growth figure is measured against. Default 12 compares with the same month a year earlier. */
  growthLag?: number;
  /** Formats the headline value and the readout total. */
  formatValue?: (value: number) => string;
  /** Formats the y-axis tick labels. */
  formatTick?: (value: number) => string;
  /** Called when the sort changes. */
  onSortChange?: (sort: SmallMultiplesSort) => void;
  /** Called when the y-scale changes. */
  onScaleChange?: (scale: SmallMultiplesScale) => void;
  /** Called with the crosshair month index, or null when the crosshair clears. */
  onIndexChange?: (index: number | null) => void;
  /** Class on the root element. */
  className?: string;
}

export function SmallMultiples({
  series = smallMultiplesSeries,
  periods = smallMultiplesPeriods,
  title = "Revenue by region",
  description = smallMultiplesDescription,
  defaultSort = "latest",
  defaultScale = "independent",
  defaultDimFlat = true,
  flatThreshold = 0.05,
  growthLag = 12,
  formatValue = formatMoney,
  formatTick = formatTickMoney,
  onSortChange,
  onScaleChange,
  onIndexChange,
  className,
}: SmallMultiplesProps) {
  const id = useId();
  const reduce = useReducedMotion() ?? false;
  const [sort, setSort] = useState<SmallMultiplesSort>(defaultSort);
  const [scale, setScale] = useState<SmallMultiplesScale>(defaultScale);
  const [dimFlat, setDimFlat] = useState(defaultDimFlat);
  const [cursor, setCursor] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const count = Math.max(0, ...series.map((item) => item.values.length), Number(!!periods.length));
  const lastIndex = Math.max(0, count - 1);
  const lag = clamp(growthLag, 1, Math.max(1, lastIndex));
  const compareLabel = `vs ${periods[lastIndex - lag]?.short ?? "start"}`;

  /** Latest value, growth over the lag and the panel's own min/max, all computed once per data change. */
  const stats = useMemo(
    () =>
      series.map((item) => {
        const values = item.values;
        const latest = values[values.length - 1] ?? 0;
        const before = values[Math.max(0, values.length - 1 - lag)] ?? latest;
        const growth = before ? latest / before - 1 : 0;
        return { item, latest, growth, flat: Math.abs(growth) < flatThreshold, min: Math.min(...values), max: Math.max(...values) };
      }),
    [series, lag, flatThreshold],
  );

  const totals = useMemo(() => Array.from({ length: count }, (_, index) => series.reduce((sum, item) => sum + (item.values[index] ?? 0), 0)), [series, count]);

  /** The ghost line is the all-regions total, scaled into each panel so shapes stay comparable. */
  const ghost = useMemo(() => {
    if (!totals.length) return "";
    const lo = Math.min(...totals);
    const hi = Math.max(...totals);
    const pad = 0.45 * (hi - lo || 1);
    return linePath(totals, lo - 0.4 * pad, hi + 0.2 * pad);
  }, [totals]);

  const sorted = useMemo(() => {
    const next = [...stats];
    if (sort === "latest") next.sort((a, b) => b.latest - a.latest);
    else if (sort === "growth") next.sort((a, b) => b.growth - a.growth);
    else next.sort((a, b) => a.item.name.localeCompare(b.item.name, "en"));
    return next;
  }, [stats, sort]);

  const layoutKey = sorted.map((entry) => entry.item.id).join(",");

  /** Shared scale rounds up past the tallest panel so no line ever clips. */
  const sharedMax = useMemo(() => {
    const max = Math.max(1, ...stats.map((entry) => entry.max));
    const step = niceStep(max, 3);
    return Math.ceil((1.08 * max) / step) * step;
  }, [stats]);

  /** Domains and tick sets per panel for both scales, so switching never re-measures. */
  const geometry = useMemo(
    () =>
      new Map(
        stats.map((entry) => {
          const pad = 0.22 * (entry.max - entry.min || entry.max || 1);
          const independent = { lo: entry.min - pad, hi: entry.max + 0.9 * pad };
          const shared = { lo: 0, hi: sharedMax };
          const band = (value: number, domain: { lo: number; hi: number }) => {
            const ratio = 1 - (value - domain.lo) / (domain.hi - domain.lo);
            return ratio >= 0.14 && ratio <= 0.9;
          };
          const own = ticksBetween(independent.lo, independent.hi, 3).filter((value) => band(value, independent));
          const common = ticksBetween(0, sharedMax, 4).filter((value) => band(value, shared));
          const merged = [...new Set([...own, ...common])].sort((a, b) => a - b);
          return [
            entry.item.id,
            {
              independent,
              shared,
              ticks: {
                independent: merged.map((value) => ({ value, visible: own.includes(value) })),
                shared: merged.map((value) => ({ value, visible: common.includes(value) })),
              },
            },
          ] as const;
        }),
      ),
    [stats, sharedMax],
  );

  /* Crosshair progress: one motion value every panel reads, so pointer moves never re-render React. */
  const progress = useMotionValue(1);
  const previousCursor = useRef<number | null>(null);

  useEffect(() => {
    const previous = previousCursor.current;
    previousCursor.current = cursor;
    if (cursor === null) return;
    const target = lastIndex ? cursor / lastIndex : 1;
    if (previous === null || reduce) {
      progress.set(target);
      return;
    }
    const controls = animate(progress, target, crossSpring);
    return () => controls.stop();
  }, [cursor, lastIndex, reduce, progress]);

  const onIndexChangeRef = useRef(onIndexChange);
  useEffect(() => {
    onIndexChangeRef.current = onIndexChange;
  });

  const emitted = useRef<number | null>(null);
  const emit = (next: number | null) => {
    if (emitted.current === next) return;
    emitted.current = next;
    setCursor(next);
    onIndexChangeRef.current?.(next);
  };

  /** Maps a pointer x onto the nearest month inside whichever panel it is over. */
  const indexAt = (event: React.PointerEvent<HTMLDivElement>) => {
    const plot = (event.target as HTMLElement | null)?.closest?.("[data-plot]");
    if (!plot) return null;
    const box = plot.getBoundingClientRect();
    return Math.round(clamp((event.clientX - box.left) / (box.width || 1), 0, 1) * lastIndex);
  };

  const flatNames = stats.filter((entry) => entry.flat).map((entry) => entry.item.name);
  const activeIndex = cursor ?? lastIndex;
  const activePeriod = periods[activeIndex];
  const hintId = `${id}-hint`;
  const rootClass = [styles.root, className].filter(Boolean).join(" ");

  if (!series.length || !count) {
    return (
      <section className={rootClass} aria-label={title}>
        <div className={styles.header}>
          <div className={styles.heading}>
            <h2 className={styles.title}>{title}</h2>
          </div>
        </div>
        <p className={styles.empty}>No series to compare yet. Pass at least one series with values.</p>
      </section>
    );
  }

  return (
    <section className={rootClass} aria-labelledby={`${id}-title`}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <h2 className={styles.title} id={`${id}-title`}>
            {title}
          </h2>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        <div className={styles.controls}>
          <SegmentedControl
            className={styles.segment}
            label="Sort panels by"
            options={[...SORTS]}
            value={sort}
            onValueChange={(value) => {
              const next = value as SmallMultiplesSort;
              setSort(next);
              onSortChange?.(next);
              const first = [...stats].sort((a, b) =>
                next === "latest" ? b.latest - a.latest : next === "growth" ? b.growth - a.growth : a.item.name.localeCompare(b.item.name, "en"),
              )[0];
              setMessage(`Sorted by ${SORT_NOUN[next]}.${first ? ` ${first.item.name} is first.` : ""}`);
            }}
          />
          <SegmentedControl
            className={styles.segment}
            label="Y scale"
            options={[...SCALES]}
            value={scale}
            onValueChange={(value) => {
              const next = value as SmallMultiplesScale;
              setScale(next);
              onScaleChange?.(next);
              setMessage(
                next === "shared"
                  ? "Shared scale. Panel heights now compare size."
                  : "Independent scale. Panel heights now compare shape.",
              );
            }}
          />
          <Switch
            className={styles.switch}
            label="Dim flat trends"
            checked={dimFlat}
            onCheckedChange={(checked) => {
              setDimFlat(checked);
              setMessage(
                checked
                  ? flatNames.length
                    ? `Flat trends dimmed: ${
                        flatNames.length < 2 ? flatNames.join("") : `${flatNames.slice(0, -1).join(", ")} and ${flatNames[flatNames.length - 1]}`
                      }.`
                    : "No flat trends to dim."
                  : "All panels at full strength.",
              );
            }}
          />
        </div>
      </div>

      <div className={styles.readout}>
        <p className={styles.when}>
          <span className={styles.date}>{activePeriod?.long}</span>
          <span className={styles.state}>{cursor === null ? "Latest" : `${activeIndex + 1} of ${count}`}</span>
        </p>
        <p className={styles.total}>
          <span className={styles.totalLabel}>Total</span>{" "}
          <span className={styles.totalValue}>{formatValue(totals[activeIndex] ?? 0)}</span>
        </p>
        <p className={styles.legend} aria-hidden="true">
          <span className={styles.key}>
            <span className={styles.keyLine} />
            Region
          </span>
          <span className={styles.key}>
            <span className={styles.keyGhost} />
            All regions, scaled to fit
          </span>
        </p>
      </div>

      <div
        className={styles.grid}
        role="group"
        tabIndex={0}
        aria-label={`${title}, ${series.length} panels`}
        aria-describedby={hintId}
        onPointerMove={(event) => {
          if (event.pointerType === "touch" && !event.buttons) return;
          const index = indexAt(event);
          if (index !== null) emit(index);
        }}
        onPointerDown={(event) => {
          const index = indexAt(event);
          if (index !== null) emit(index);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "mouse" || event.currentTarget.matches(":focus-visible")) return;
          emit(null);
        }}
        onKeyDown={(event) => {
          const from = cursor ?? lastIndex;
          const next =
            event.key === "ArrowLeft" || event.key === "ArrowDown"
              ? from - 1
              : event.key === "ArrowRight" || event.key === "ArrowUp"
                ? from + 1
                : event.key === "PageUp"
                  ? from - 12
                  : event.key === "PageDown"
                    ? from + 12
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? lastIndex
                        : null;
          if (event.key === "Escape") {
            if (cursor === null) return;
            event.preventDefault();
            emit(null);
            setMessage("Crosshair cleared. Showing the latest month.");
            return;
          }
          if (next === null) return;
          event.preventDefault();
          const index = clamp(next, 0, lastIndex);
          emit(index);
          const top = [...series].sort((a, b) => (b.values[index] ?? 0) - (a.values[index] ?? 0))[0];
          setMessage(
            `${periods[index]?.long ?? ""}. Total ${formatValue(totals[index] ?? 0)}.${
              top ? ` Highest ${top.name} at ${formatValue(top.values[index] ?? 0)}.` : ""
            }`,
          );
        }}
        onFocus={(event) => {
          if (event.target === event.currentTarget && cursor === null && event.currentTarget.matches(":focus-visible")) emit(lastIndex);
        }}
        onBlur={(event) => {
          if (event.target === event.currentTarget) emit(null);
        }}
        data-scale={scale}
      >
        <p id={hintId} className={styles.srOnly}>
          Use the left and right arrow keys to move the crosshair across months in every panel at once. Home and End jump to the first and
          latest month, Escape clears it.
        </p>
        <ul className={styles.list}>
          {sorted.map((entry) => {
            const frame = geometry.get(entry.item.id)!;
            return (
              <Panel
                key={entry.item.id}
                item={entry.item}
                latest={entry.latest}
                growth={entry.growth}
                flat={entry.flat}
                dim={dimFlat && entry.flat}
                target={frame[scale]}
                ticks={frame.ticks[scale]}
                ghost={ghost}
                cx={progress}
                cursor={cursor}
                compareLabel={compareLabel}
                layoutKey={layoutKey}
                reduce={reduce}
                formatValue={formatValue}
                formatTick={formatTick}
              />
            );
          })}
        </ul>
      </div>

      <div className={styles.srOnly}>
        <table className={styles.table}>
          <caption>{`${title}, ${activePeriod?.long ?? ""}, sorted by ${SORT_NOUN[sort]}`}</caption>
          <thead>
            <tr>
              <th scope="col">Series</th>
              <th scope="col">Value</th>
              <th scope="col">{`Growth ${compareLabel}`}</th>
              <th scope="col">Trend</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry) => (
              <tr key={entry.item.id}>
                <th scope="row">{entry.item.name}</th>
                <td>{formatValue(entry.item.values[activeIndex] ?? 0)}</td>
                <td>{formatGrowth(entry.growth)}</td>
                <td>{entry.flat ? "Flat" : entry.growth > 0 ? "Rising" : "Falling"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.srOnly} role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}

export default SmallMultiples;
