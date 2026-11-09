"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import type { Transition } from "motion/react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import MorphSelect from "../morph-select/morph-select";
import SegmentedControl from "../segmented-control/segmented-control";
import { motionTokens } from "../lib/motion-tokens";
import { choroplethCaption, choroplethMaps, choroplethMetrics, choroplethViewBox } from "./choropleth-explorer-data";
import styles from "./choropleth-explorer.module.css";

/** Where a shape sits in the map's coordinate space: x, y, width, height. */
export type Bounds = [number, number, number, number];

export type ChoroplethFormat = "currency" | "change" | "percent";
export type ChoroplethScale = "sequential" | "diverging";
export type ChoroplethAggregate = "sum" | "weighted";

/** One number the map can shade by, and how to read it. */
export interface ChoroplethMetric {
  /** Stable key. Regions carry a value under this key. */
  id: string;
  /** Name in the metric switch and in the tooltip rows. */
  label: string;
  /** Words under the headline figure, such as "Annual recurring revenue". */
  totalLabel: string;
  format: ChoroplethFormat;
  /** Symbol used when format is "currency". Defaults to "$". */
  currency?: string;
  scale: ChoroplethScale;
  /** "sum" adds the regions up; "weighted" averages them by the first metric. */
  aggregate: ChoroplethAggregate;
}

/** The smaller shapes a region can open into, such as the counties of a state. */
export interface ChoroplethSubregions {
  /** Plural noun for the shapes, such as "counties". */
  noun: string;
  /** Translate and scale that place the subregion paths inside the parent's box. */
  origin: [number, number, number];
  regions: ChoroplethRegion[];
}

/** One shape on the map: a state, province or department. */
export interface ChoroplethRegion {
  id: string;
  name: string;
  /** SVG path data in the map's view box units. */
  path: string;
  /** Bounding box in view box units. Measured from the path when left out. */
  box?: Bounds;
  /** One value per metric id. A null means no data for that metric. */
  values: Record<string, number | null>;
  subregions?: ChoroplethSubregions;
}

/** A country's worth of shapes, its own metrics and its own wording. */
export interface ChoroplethMap {
  id: string;
  name: string;
  regions: ChoroplethRegion[];
  /** Plural noun for regions in this map, such as "provinces". */
  regionNoun?: string;
  title?: string;
  /** Overrides the shared metric set; the currency usually differs per country. */
  metrics?: ChoroplethMetric[];
  viewBox?: [number, number];
}

export interface ChoroplethExplorerProps {
  /** Countries the report covers. The country switch appears when there is more than one. Ignored when `regions` is set. */
  maps?: ChoroplethMap[];
  /** Map shown first. Defaults to the first entry in `maps`. */
  defaultMap?: string;
  /** A single unnamed area. When set, `maps` is ignored and the country switch is hidden. */
  regions?: ChoroplethRegion[];
  /** Metrics to shade by. Defaults to the shared revenue, growth and penetration set. */
  metrics?: ChoroplethMetric[];
  /** Metric shown first. Defaults to the first entry in `metrics`. */
  defaultMetric?: string;
  /** Coordinate space the paths are drawn in. Defaults to [975, 610]. */
  viewBox?: [number, number];
  /** Name of the area, used in the map's accessible name. Defaults to "United States". */
  areaName?: string;
  /** Plural noun for the regions, such as "states". Defaults to "states". */
  regionNoun?: string;
  /** Heading above the map. Defaults to "Revenue by state". */
  title?: string;
  /** Line under the heading. Pass an empty string to hide it. */
  description?: string;
  /** Called with the id of the region that was opened, or null when the map zooms back out. */
  onRegionOpen?: (id: string | null) => void;
  /** Called with the id of the metric the reader switched to. */
  onMetricChange?: (id: string) => void;
  /** Called with the id of the country the reader switched to. */
  onMapChange?: (id: string) => void;
  /** Drops the card's border, radius and shadow so the block sits flush in a preview frame. */
  flat?: boolean;
  className?: string;
}

type Tone = "pos" | "neg";
interface Bin { lo: number | null; hi: number | null; tone: Tone; strength: number }
interface Scored {
  region: ChoroplethRegion;
  value: number | null;
  bin: number;
  rank: number;
  box: Bounds;
}
interface BinData { items: Scored[]; bins: Bin[]; byId: Map<string, Scored> }
interface Hit { level: "top" | "sub"; id: string }
interface Hover extends Hit { source: "map" | "list" }

const { spring, duration, ease } = motionTokens;
const enter = [...ease.enter] as [number, number, number, number];
const exitEase = [...ease.exit] as [number, number, number, number];
const still: Transition = { duration: 0 };
const camera: Transition = { ...spring.smooth, visualDuration: 0.62 };
const SEQUENTIAL_STRENGTH = [0.16, 0.34, 0.54, 0.74, 0.94];
const DIVERGING_STRENGTH = [0.2, 0.42, 0.66, 0.9];
const NO_BOX: Bounds = [0, 0, 0, 0];
const NONE: ChoroplethRegion[] = [];
const DEFAULT_VIEW_BOX: [number, number] = choroplethViewBox;
const DEFAULT_DESCRIPTION = choroplethCaption;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const cx = (...parts: (string | undefined | false)[]) => parts.filter(Boolean).join(" ");
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const singular = (noun: string) => noun.replace(/ies$/, "y").replace(/s$/, "");

/** Rounds to two significant digits, which is how the legend's break points read. */
function round2(value: number): number {
  if (value === 0) return 0;
  const step = 10 ** (Math.floor(Math.log10(Math.abs(value))) - 1);
  return Math.round(value / step) * step;
}

function quantile(sorted: number[], at: number): number {
  if (sorted.length === 0) return 0;
  const position = (sorted.length - 1) * at;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

function formatValue(value: number | null, metric: ChoroplethMetric): string {
  if (value === null) return "No accounts";
  if (metric.format === "currency") {
    const magnitude = Math.abs(value);
    const symbol = metric.currency ?? "$";
    return magnitude >= 1e6
      ? `${symbol}${(value / 1e6).toFixed(1)}M`
      : magnitude >= 1e3
        ? `${symbol}${Math.round(value / 1e3)}K`
        : `${symbol}${Math.round(value)}`;
  }
  const magnitude = `${Math.abs(value).toFixed(1)}%`;
  return metric.format === "change"
    ? Math.abs(value) < 0.05
      ? "0.0%"
      : `${value < 0 ? "−" : "+"}${magnitude}`
    : magnitude;
}

function formatBreak(value: number, metric: ChoroplethMetric): string {
  const short = (input: number) => String(Number(input.toFixed(1)));
  const symbol = metric.currency ?? "$";
  if (metric.format === "currency") {
    return Math.abs(value) >= 1e6 ? `${symbol}${short(value / 1e6)}M` : `${symbol}${short(value / 1e3)}K`;
  }
  return metric.format === "change"
    ? value === 0
      ? "0%"
      : `${value < 0 ? "−" : "+"}${short(Math.abs(value))}%`
    : `${short(value)}%`;
}

/** Values are read aloud with the minus sign spelled out, since screen readers skip the glyph. */
function spokenValue(value: number | null, metric: ChoroplethMetric): string {
  return formatValue(value, metric).replace("−", "minus ");
}

function ordinal(value: number): string {
  const rest = value % 100;
  return rest >= 11 && rest <= 13 ? `${value}th` : `${value}${["th", "st", "nd", "rd"][value % 10] ?? "th"}`;
}

/** Measures a path by walking its commands, so a region can be eased into frame without its own box. */
function pathBounds(path: string): Bounds {
  const tokens = path.match(/[MmLlHhVvZz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  let x = 0;
  let y = 0;
  let originX = 0;
  let originY = 0;
  let command = "M";
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const track = () => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (let i = 0; i < tokens.length; ) {
    const token = tokens[i];
    if (/[a-z]/i.test(token)) {
      command = token;
      i += 1;
      if (command === "z" || command === "Z") {
        x = originX;
        y = originY;
      }
      continue;
    }
    const read = (offset: number) => Number(tokens[i + offset]);
    const relative = command === command.toLowerCase();
    if (command === "H" || command === "h") {
      x = relative ? x + read(0) : read(0);
      i += 1;
    } else if (command === "V" || command === "v") {
      y = relative ? y + read(0) : read(0);
      i += 1;
    } else {
      x = relative ? x + read(0) : read(0);
      y = relative ? y + read(1) : read(1);
      i += 2;
      if (command === "M" || command === "m") {
        originX = x;
        originY = y;
        command = relative ? "l" : "L";
      }
    }
    track();
  }
  return Number.isFinite(minX) ? [minX, minY, maxX - minX, maxY - minY] : NO_BOX;
}

function buildBins(values: number[], metric: ChoroplethMetric): Bin[] {
  const sorted = [...values].sort((a, b) => a - b);
  const breaks = (source: number[], floor = -Infinity) =>
    source
      .map(round2)
      .filter((value, index, all) => value > floor && (index === 0 || value > all[index - 1]))
      .filter((value, index, all) => all.indexOf(value) === index);
  const segments = (edges: number[], strengths: number[], tone: Tone, first: number | null, last: number | null): Bin[] => {
    const bounds = [first, ...edges, last];
    const stops = strengths.length === edges.length + 1
      ? strengths
      : Array.from({ length: edges.length + 1 }, (_, index) => strengths[Math.round((index / Math.max(1, edges.length)) * (strengths.length - 1))]);
    return stops.map((strength, index) => ({ lo: bounds[index], hi: bounds[index + 1], tone, strength }));
  };
  if (metric.scale === "sequential") {
    return segments(breaks([0.2, 0.4, 0.6, 0.8].map((at) => quantile(sorted, at))), SEQUENTIAL_STRENGTH, "pos", null, null);
  }
  const negative = sorted.filter((value) => value < 0);
  const positive = sorted.filter((value) => value >= 0);
  const below: Bin[] = [];
  if (negative.length >= 4) {
    const split = round2(quantile(negative, 0.5));
    if (split < 0) {
      below.push({ lo: null, hi: split, tone: "neg", strength: 0.86 });
      below.push({ lo: split, hi: 0, tone: "neg", strength: 0.46 });
    } else {
      below.push({ lo: null, hi: 0, tone: "neg", strength: 0.86 });
    }
  } else if (negative.length > 0) {
    below.push({ lo: null, hi: 0, tone: "neg", strength: 0.86 });
  }
  return [
    ...below,
    ...segments(breaks([0.25, 0.5, 0.75].map((at) => quantile(positive, at)), 0), DIVERGING_STRENGTH, "pos", negative.length > 0 ? 0 : null, null),
  ];
}

function scoreRegions(regions: ChoroplethRegion[], metric: ChoroplethMetric, boxes: Map<string, Bounds>): BinData {
  const values = regions.map((region) => region.values[metric.id] ?? null);
  const bins = buildBins(values.filter((value): value is number => value !== null), metric);
  const items: Scored[] = regions
    .map((region, index) => {
      const value = values[index];
      return {
        region,
        value,
        bin: value === null ? -1 : bins.findIndex((bin) => (bin.lo === null || value >= bin.lo) && (bin.hi === null || value < bin.hi)),
        rank: 0,
        box: boxes.get(region.id) ?? NO_BOX,
      };
    })
    .sort((a, b) => (a.value === null ? 1 : 0) - (b.value === null ? 1 : 0) || (b.value ?? 0) - (a.value ?? 0) || a.region.name.localeCompare(b.region.name, "en"));
  items.forEach((item, index) => {
    item.rank = item.value === null ? 0 : index + 1;
  });
  return { items, bins, byId: new Map(items.map((item) => [item.region.id, item])) };
}

function headlineFigure(items: Scored[], metric: ChoroplethMetric, weightId: string): number {
  let total = 0;
  let weight = 0;
  for (const { region, value } of items) {
    if (value === null) continue;
    if (metric.aggregate === "sum") {
      total += value;
      continue;
    }
    const w = region.values[weightId] ?? 0;
    total += value * w;
    weight += w;
  }
  return metric.aggregate === "sum" ? total : weight > 0 ? total / weight : 0;
}

const shade = (scored: Scored | undefined, bins: Bin[]): CSSProperties => {
  if (!scored || scored.value === null || scored.bin < 0) return { "--fill": "var(--none)", "--alpha": 1 } as CSSProperties;
  const bin = bins[scored.bin];
  return { "--fill": bin?.tone === "neg" ? "var(--neg)" : "var(--pos)", "--alpha": bin?.strength ?? 0.5 } as CSSProperties;
};

/** The heading and summary figures swap with a short rise, so a metric change reads as one edit rather than a re-render. */
function RisingText({ text, className }: { text: string; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <span className={cx(styles.rise, className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.4em" }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: "-0.4em" }}
          transition={{ duration: reduced ? duration.instant : duration.standard, ease: enter }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** The headline figure counts to its new total instead of jumping, unless motion is reduced. */
function Counter({ value, metric, reduce }: { value: number; metric: ChoroplethMetric; reduce: boolean }) {
  const motionValue = useMotionValue(value);
  const text = useTransform(motionValue, (current) => formatValue(current, metric));
  const lastMetric = useRef(metric.id);
  useEffect(() => {
    const same = lastMetric.current === metric.id;
    lastMetric.current = metric.id;
    if (reduce || !same) {
      motionValue.jump(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: duration.considered, ease: enter });
    return () => controls.stop();
  }, [value, metric.id, motionValue, reduce]);
  return <motion.span className={styles.totalValue}>{text}</motion.span>;
}

/**
 * A map that shades regions by one metric, with a ranked list beside it. Selecting a region zooms the map to it and, where the
 * data goes deeper, swaps the list for its counties. A legend ramp filters both views at once, and the metric switch sweeps
 * the new shading across the map from west to east.
 */
export default function ChoroplethExplorer({
  maps,
  defaultMap,
  regions,
  metrics,
  defaultMetric,
  viewBox,
  areaName,
  regionNoun,
  title,
  description = DEFAULT_DESCRIPTION,
  onRegionOpen,
  onMetricChange,
  onMapChange,
  flat,
  className,
}: ChoroplethExplorerProps) {
  const baseId = useId();
  const reduced = useReducedMotion() ?? false;
  const allMaps = useMemo<ChoroplethMap[]>(
    () =>
      regions
        ? [{ id: "area", name: areaName ?? "United States", regions, regionNoun: regionNoun ?? "states" }]
        : (maps ?? choroplethMaps),
    [regions, maps, areaName, regionNoun],
  );
  const [mapId, setMapId] = useState(() => allMaps.find((entry) => entry.id === defaultMap)?.id ?? allMaps[0]?.id ?? "");
  const activeMap = allMaps.find((entry) => entry.id === mapId) ?? allMaps[0];
  const [entered, setEntered] = useState(false);
  const mapRegions = activeMap?.regions ?? NONE;
  const mapMetrics = activeMap?.metrics ?? metrics ?? choroplethMetrics;
  const [viewWidth, viewHeight] = activeMap?.viewBox ?? viewBox ?? DEFAULT_VIEW_BOX;
  const area = areaName ?? activeMap?.name ?? "";
  const noun = regionNoun ?? activeMap?.regionNoun ?? "regions";
  const heading = title ?? activeMap?.title ?? `Revenue by ${singular(noun)}`;
  const subNoun = mapRegions.find((entry) => entry.subregions)?.subregions?.noun ?? null;
  const [metricId, setMetricId] = useState(() => mapMetrics.find((entry) => entry.id === defaultMetric)?.id ?? mapMetrics[0]?.id ?? "");
  const [openId, setOpenId] = useState<string | null>(null);
  const [subLayerId, setSubLayerId] = useState<string | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [pinnedSub, setPinnedSub] = useState<string | null>(null);
  const [hoverBin, setHoverBin] = useState<number | null>(null);
  const [pinnedBin, setPinnedBin] = useState<number | null>(null);
  const [focusRow, setFocusRow] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const metric = mapMetrics.find((entry) => entry.id === metricId) ?? mapMetrics[0];
  const weightId = mapMetrics[0]?.id ?? "";
  const openRegion = mapRegions.find((entry) => entry.id === openId) ?? null;
  const subLayer = mapRegions.find((entry) => entry.id === subLayerId) ?? null;
  const openSubs = openRegion?.subregions ?? null;
  const level: "top" | "sub" = openSubs ? "sub" : "top";
  const boxes = useMemo(() => new Map(mapRegions.map((entry) => [entry.id, entry.box ?? pathBounds(entry.path)])), [mapRegions]);
  const subBoxes = useMemo(
    () => new Map((subLayer?.subregions?.regions ?? []).map((entry) => [entry.id, entry.box ?? pathBounds(entry.path)])),
    [subLayer],
  );
  const score = useCallback(
    (list: ChoroplethRegion[], lookup: Map<string, Bounds>): BinData => {
      if (!metric) return { items: [], bins: [], byId: new Map() };
      return scoreRegions(list, metric, lookup);
    },
    [metric],
  );
  const topData = useMemo(() => score(mapRegions, boxes), [score, mapRegions, boxes]);
  const subData = useMemo(() => score(subLayer?.subregions?.regions ?? [], subBoxes), [score, subLayer, subBoxes]);
  const data = level === "sub" ? subData : topData;
  const rows = openRegion && !openSubs ? [] : data.items;
  const bins = data.bins;
  const hasNoData = data.items.some((entry) => entry.value === null);
  const activeBin = hoverBin ?? pinnedBin;
  const total = metric
    ? openRegion
      ? (openRegion.values[metric.id] ?? 0)
      : headlineFigure(topData.items, metric, weightId)
    : 0;
  const currentNoun = openSubs?.noun ?? noun;
  const maxValue = Math.max(1e-9, ...rows.map((entry) => Math.abs(entry.value ?? 0)));
  const areaRef = useRef<SVGGElement | null>(null);
  const attachArea = useCallback((node: SVGGElement | null) => {
    areaRef.current = node;
  }, []);
  const cameraX = useMotionValue(0);
  const cameraY = useMotionValue(0);
  const cameraScale = useMotionValue(1);

  useEffect(() => {
    const apply = () => areaRef.current?.setAttribute("transform", `translate(${cameraX.get()} ${cameraY.get()}) scale(${cameraScale.get()})`);
    const stops = [cameraX.on("change", apply), cameraY.on("change", apply), cameraScale.on("change", apply)];
    return () => stops.forEach((stop) => stop());
  }, [cameraX, cameraY, cameraScale]);

  useEffect(() => {
    let target = { x: 0, y: 0, s: 1 };
    const box = openRegion ? boxes.get(openRegion.id) : null;
    if (box && box[2] > 0 && box[3] > 0) {
      const scale = clamp(Math.min((0.8 * viewWidth) / box[2], (0.8 * viewHeight) / box[3]), 1, 12);
      target = {
        x: viewWidth / 2 - (box[0] + box[2] / 2) * scale,
        y: viewHeight / 2 - (box[1] + box[3] / 2) * scale,
        s: scale,
      };
    }
    const transition = reduced ? still : camera;
    const controls = [
      animate(cameraX, target.x, transition),
      animate(cameraY, target.y, transition),
      animate(cameraScale, target.s, transition),
    ];
    return () => controls.forEach((control) => control.stop());
  }, [openRegion, boxes, viewWidth, viewHeight, reduced, cameraX, cameraY, cameraScale]);

  const reportedOpen = useRef<string | null>(null);
  useEffect(() => {
    if (reportedOpen.current === openId) return;
    reportedOpen.current = openId;
    onRegionOpen?.(openId);
  }, [openId, onRegionOpen]);

  const selectRegion = (id: string | null) => {
    const next = mapRegions.find((entry) => entry.id === id) ?? null;
    setOpenId(next?.id ?? null);
    if (next?.subregions) setSubLayerId(next.id);
    setHover(null);
    setHoverBin(null);
    setPinnedBin(null);
    setPinnedSub(null);
    setHoverBin(null);
    if (!next) {
      setAnnouncement(`Showing all ${noun}, ranked by ${metric?.label.toLowerCase()}.`);
      return;
    }
    const count = next.subregions?.regions.length ?? 0;
    setAnnouncement(
      count > 0
        ? `${next.name}, ${count} ${next.subregions?.noun ?? "areas"} ranked by ${metric?.label.toLowerCase()}. Press Escape to zoom out.`
        : `${next.name}.${subNoun ? ` No ${singular(subNoun)} detail.` : ""} Press Escape to zoom out.`,
    );
  };

  const frameRef = useRef<HTMLDivElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const tipX = useMotionValue(0);
  const tipY = useMotionValue(0);
  const [tipOn, setTipOn] = useState(false);
  const [lastHover, setLastHover] = useState<Hit | null>(null);

  const hitTest = (target: Element | null): Hit | null => {
    const node = target?.closest("[data-rid]");
    if (!node) return null;
    return {
      level: node.getAttribute("data-level") === "sub" ? "sub" : "top",
      id: node.getAttribute("data-rid") ?? "",
    };
  };

  const toggleSub = (id: string) => {
    const next = pinnedSub === id ? null : id;
    setPinnedSub(next);
    const scored = subData.byId.get(id);
    if (next && scored && metric) {
      setAnnouncement(
        `${scored.region.name}: ${spokenValue(scored.value, metric)}${scored.rank ? `, ${ordinal(scored.rank)} of ${subData.items.length}` : ""}.`,
      );
    }
  };

  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hover || hover.source !== "map" || !listRef.current) return;
    const row = listRef.current.querySelector(`[data-row="${CSS.escape(hover.id)}"]`);
    if (!row) return;
    const scroller = listRef.current;
    const top = (row as HTMLElement).offsetTop;
    const bottom = top + (row as HTMLElement).offsetHeight;
    if (top >= scroller.scrollTop + 8 && bottom <= scroller.scrollTop + scroller.clientHeight - 8) return;
    scroller.scrollTo({
      top: Math.max(0, top - scroller.clientHeight / 2 + (row as HTMLElement).offsetHeight / 2),
      behavior: reduced ? "auto" : "smooth",
    });
  }, [hover, reduced]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [openId]);

  const rovingId = focusRow && rows.some((entry) => entry.region.id === focusRow) ? focusRow : (rows[0]?.region.id ?? null);
  const hoverLevel = hover?.level ?? null;
  const outlineTop = hoverLevel === "top" ? (hover?.id ?? null) : null;
  const outlineSub = hoverLevel === "sub" ? (hover?.id ?? null) : null;
  const fromMap = !!hover && hover.source === "map";
  const hovered = lastHover ? (lastHover.level === "sub" ? subData.byId.get(lastHover.id) : topData.byId.get(lastHover.id)) : undefined;
  const hoveredCount = lastHover?.level === "sub" ? subData.items.length : topData.items.length;
  const subsShown = !!subLayer && subLayer.id === openId;
  const subOrigin = subLayer?.subregions?.origin ?? [0, 0, 1];
  const subTransform = `translate(${subOrigin[0]} ${subOrigin[1]}) scale(${subOrigin[2]})`;

  const binLabel = (bin: Bin) =>
    metric
      ? bin.lo === null && bin.hi !== null
        ? `below ${formatBreak(bin.hi, metric)}`
        : bin.hi === null && bin.lo !== null
          ? `${formatBreak(bin.lo, metric)} and above`
          : bin.lo !== null && bin.hi !== null
            ? `${formatBreak(bin.lo, metric)} to ${formatBreak(bin.hi, metric)}`
            : "all values"
      : "";
  const binCount = (index: number) => data.items.filter((entry) => entry.bin === index).length;
  const legendNote =
    activeBin !== null && metric
      ? activeBin === -1
        ? `${binCount(-1)} ${currentNoun} with no accounts yet`
        : `${binCount(activeBin)} ${binCount(activeBin) === 1 ? singular(currentNoun) : currentNoun} ${binLabel(bins[activeBin])}`
      : `Shaded by ${metric?.totalLabel.toLowerCase() ?? "value"}`;

  const titleId = `${baseId}-title`;
  const hintId = `${baseId}-hint`;
  const listId = `${baseId}-list`;

  if (!metric || mapRegions.length === 0) {
    return (
      <section
        className={cx(styles.root, className)}
        aria-labelledby={titleId}
        data-frame-flat={flat ? "" : undefined}
        style={flat ? { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" } : undefined}
      >
        <div className={styles.inner}>
          <h2 id={titleId} className={styles.title}>{heading}</h2>
          <p className={styles.empty}>Add regions with values to shade the map.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cx(styles.root, className)}
      aria-labelledby={titleId}
      data-frame-flat={flat ? "" : undefined}
      style={flat ? { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" } : undefined}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        if (pinnedBin !== null) {
          setPinnedBin(null);
          return;
        }
        if (openId) {
          event.preventDefault();
          selectRegion(null);
        }
      }}
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.heading}>
            <h2 id={titleId} className={styles.title}><RisingText text={heading} /></h2>
            {description ? <p>{description}</p> : null}
          </div>
          <div className={styles.controls}>
            {allMaps.length > 1 && (
              <div className={styles.areaSlot} style={{ "--slot": `${Math.max(...allMaps.map((entry) => entry.name.length))}ch` } as CSSProperties}>
                <MorphSelect
                  label="Country"
                  align="end"
                  hideLabel
                  items={allMaps.map((entry) => ({ value: entry.id, label: entry.name, meta: `${entry.regions.length}` }))}
                  value={activeMap?.id ?? null}
                  onValueChange={(value) => {
                    const next = allMaps.find((entry) => entry.id === value);
                    if (!next || next.id === activeMap?.id) return;
                    const nextMetrics = next.metrics ?? metrics ?? choroplethMetrics;
                    const nextMetric = nextMetrics.find((entry) => entry.id === metricId) ?? nextMetrics[0];
                    setMapId(next.id);
                    setEntered(true);
                    if (nextMetric && nextMetric.id !== metricId) setMetricId(nextMetric.id);
                    setOpenId(null);
                    setSubLayerId(null);
                    setHover(null);
                    setHoverBin(null);
                    setPinnedBin(null);
                    setPinnedSub(null);
                    setHoverBin(null);
                    setTipOn(false);
                    setLastHover(null);
                    cameraX.jump(0);
                    cameraY.jump(0);
                    cameraScale.jump(1);
                    onMapChange?.(next.id);
                    setAnnouncement(`${next.name}, ${next.regions.length} ${next.regionNoun ?? "regions"} ranked by ${nextMetric?.label.toLowerCase() ?? "value"}.`);
                  }}
                  panelWidth={248}
                  maxListHeight={360}
                  searchable={false}
                />
              </div>
            )}
            <SegmentedControl
              className={styles.switch}
              label="Metric"
              options={mapMetrics.map((entry) => ({ value: entry.id, label: entry.label }))}
              value={metric.id}
              onValueChange={(value) => {
                const next = mapMetrics.find((entry) => entry.id === value);
                if (!next) return;
                setMetricId(next.id);
                setPinnedBin(null);
                setHoverBin(null);
                onMetricChange?.(next.id);
                const leader = [...(openSubs?.regions ?? mapRegions)]
                  .filter((entry) => entry.values[next.id] != null)
                  .sort((a, b) => (b.values[next.id] ?? 0) - (a.values[next.id] ?? 0))[0];
                setAnnouncement(
                  `Shaded by ${next.label.toLowerCase()}.${leader ? ` Highest: ${leader.name}, ${spokenValue(leader.values[next.id] ?? null, next)}.` : ""}`,
                );
              }}
            />
          </div>
        </header>
        <div className={styles.body}>
          <div className={styles.main}>
            <div className={styles.summary}>
              <div className={styles.place}>
                <p className={styles.placeName}><RisingText text={openRegion?.name ?? area} /></p>
                <p className={styles.total}>
                  <Counter value={total} metric={metric} reduce={reduced} />
                  <RisingText className={styles.totalLabel} text={metric.totalLabel} />
                </p>
              </div>
              <AnimatePresence initial={false}>
                {openRegion && (
                  <motion.button
                    key="back"
                    type="button"
                    className={styles.back}
                    onClick={() => selectRegion(null)}
                    initial={{ opacity: 0, x: 8 * (reduced ? 0 : 1) }}
                    animate={{ opacity: 1, x: 0, transition: reduced ? still : spring.smooth }}
                    exit={{ opacity: 0, x: 8 * (reduced ? 0 : 1), transition: { duration: reduced ? 0 : duration.exit, ease: exitEase } }}
                  >
                    <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
                    <span>All {noun}</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            <div
              ref={frameRef}
              className={styles.frame}
              data-open={openRegion ? "" : undefined}
              data-bin={activeBin !== null ? "" : undefined}
              onPointerMove={(event: ReactPointerEvent<HTMLDivElement>) => {
                if (event.pointerType === "touch") return;
                const hit = hitTest(event.target as Element);
                setHover((current) =>
                  hit
                    ? current?.id === hit.id && current.level === hit.level && current.source === "map"
                      ? current
                      : { ...hit, source: "map" }
                    : current?.source === "map"
                      ? null
                      : current,
                );
                setTipOn(!!hit);
                if (!hit) return;
                setLastHover((current) => (current?.id === hit.id && current.level === hit.level ? current : hit));
                const rect = frameRef.current?.getBoundingClientRect();
                if (!rect) return;
                const width = tipRef.current?.offsetWidth ?? 200;
                const height = tipRef.current?.offsetHeight ?? 100;
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;
                tipX.set(x + 16 + width > rect.width ? Math.max(0, x - 16 - width) : x + 16);
                tipY.set(clamp(y - height / 2, 0, Math.max(0, rect.height - height)));
              }}
              onPointerLeave={() => {
                setTipOn(false);
                setHover((current) => (current?.source === "map" ? null : current));
              }}
              onClick={(event) => {
                const hit = hitTest(event.target as Element);
                if (!hit) {
                  if (openId) selectRegion(null);
                  return;
                }
                if (hit.level === "top") {
                  if (hit.id !== openId) selectRegion(hit.id);
                  return;
                }
                toggleSub(hit.id);
              }}
            >
              <svg
                className={styles.map}
                viewBox={`0 0 ${viewWidth} ${viewHeight}`}
                role="img"
                aria-label={`Map of ${openRegion?.name ?? area} shaded by ${metric.label.toLowerCase()}. The ranked list next to it has every value.`}
                aria-describedby={hintId}
              >
                <AnimatePresence initial={false}>
                  <motion.g
                    key={activeMap?.id ?? "area"}
                    ref={attachArea}
                    className={styles.area}
                    data-enter={entered ? "" : undefined}
                    exit={{ opacity: 0, transition: { duration: reduced ? 0 : duration.exit } }}
                  >
                    <g className={styles.regions}>
                      {mapRegions.map((entry) => {
                        const scored = topData.byId.get(entry.id);
                        const box = boxes.get(entry.id) ?? NO_BOX;
                        const isOpen = entry.id === openId;
                        const lit = level !== "top" || activeBin === null || scored?.bin === activeBin;
                        return (
                          <path
                            key={entry.id}
                            d={entry.path}
                            className={styles.region}
                            data-rid={entry.id}
                            data-level="top"
                            data-hidden={isOpen && entry.subregions ? "" : undefined}
                            data-context={openId && !isOpen ? "" : undefined}
                            data-dim={lit ? undefined : ""}
                            style={{ ...shade(scored, topData.bins), "--wave": (box[0] + box[2] / 2) / viewWidth } as CSSProperties}
                          />
                        );
                      })}
                    </g>
                    {outlineTop && mapRegions.some((entry) => entry.id === outlineTop) && (
                      <path className={styles.outline} d={mapRegions.find((entry) => entry.id === outlineTop)?.path} aria-hidden="true" />
                    )}
                    {subLayer?.subregions && (
                      <g className={styles.subs} transform={subTransform} data-shown={subsShown ? "" : undefined}>
                        {subLayer.subregions.regions.map((entry) => {
                          const scored = subData.byId.get(entry.id);
                          const box = subBoxes.get(entry.id) ?? NO_BOX;
                          const dim = !subsShown || activeBin === null || scored?.bin === activeBin;
                          return (
                            <path
                              key={entry.id}
                              d={entry.path}
                              className={styles.region}
                              data-rid={entry.id}
                              data-level="sub"
                              data-dim={dim ? undefined : ""}
                              style={{ ...shade(scored, subData.bins), "--wave": (box[0] + box[2] / 2) / 1000 } as CSSProperties}
                            />
                          );
                        })}
                        {pinnedSub && (
                          <path
                            className={styles.pinned}
                            d={subLayer.subregions.regions.find((entry) => entry.id === pinnedSub)?.path}
                            aria-hidden="true"
                          />
                        )}
                        {outlineSub && (
                          <path
                            className={styles.outline}
                            d={subLayer.subregions.regions.find((entry) => entry.id === outlineSub)?.path}
                            aria-hidden="true"
                          />
                        )}
                      </g>
                    )}
                  </motion.g>
                </AnimatePresence>
              </svg>
              <motion.div
                ref={tipRef}
                className={styles.tip}
                data-on={tipOn && fromMap && hovered ? "" : undefined}
                style={{ x: tipX, y: tipY }}
                aria-hidden="true"
              >
                {hovered && (
                  <>
                    <p className={styles.tipHead}>
                      <span className={styles.tipName}>{hovered.region.name}</span>
                      {hovered.rank > 0 && <span className={styles.tipRank}>{ordinal(hovered.rank)} of {hoveredCount}</span>}
                    </p>
                    <dl className={styles.tipRows}>
                      {mapMetrics.map((entry) => (
                        <div key={entry.id} data-current={entry.id === metric.id ? "" : undefined}>
                          <dt>{entry.label}</dt>
                          <dd>{formatValue(hovered.region.values[entry.id] ?? null, entry)}</dd>
                        </div>
                      ))}
                    </dl>
                    {lastHover?.level === "top" && hovered.region.id !== openId && (
                      <p className={styles.tipHint}>
                        {hovered.region.subregions
                          ? `Select to see ${hovered.region.subregions.regions.length} ${hovered.region.subregions.noun}`
                          : "Select to zoom in"}
                      </p>
                    )}
                  </>
                )}
              </motion.div>
            </div>
            <div className={styles.legend}>
              <div className={styles.steps} role="group" aria-label={`Legend for ${metric.label.toLowerCase()}`}>
                <div className={styles.ramp} style={{ "--bins": bins.length } as CSSProperties}>
                  {bins.map((bin, index) => (
                    <button
                      key={`${metric.id}-${level}-${index}`}
                      type="button"
                      className={styles.step}
                      aria-pressed={pinnedBin === index}
                      aria-label={`${binCount(index)} ${currentNoun} ${binLabel(bin)}`}
                      data-active={activeBin === index ? "" : undefined}
                      onPointerEnter={(event) => {
                        if (event.pointerType !== "touch") setHoverBin(index);
                      }}
                      onPointerLeave={() => setHoverBin(null)}
                      onFocus={() => setHoverBin(index)}
                      onBlur={() => setHoverBin(null)}
                      onClick={() => setPinnedBin((current) => (current === index ? null : index))}
                    >
                      <span
                        className={styles.swatch}
                        style={{ "--fill": bin.tone === "neg" ? "var(--neg)" : "var(--pos)", "--alpha": bin.strength } as CSSProperties}
                      />
                    </button>
                  ))}
                  <span className={styles.ticks} aria-hidden="true">
                    {bins.slice(1).map((bin, index) =>
                      bin.lo !== null ? (
                        <span key={index} style={{ left: `${((index + 1) / bins.length) * 100}%` }}>{formatBreak(bin.lo, metric)}</span>
                      ) : null,
                    )}
                  </span>
                </div>
                {hasNoData && (
                  <button
                    type="button"
                    className={cx(styles.step, styles.none)}
                    aria-pressed={pinnedBin === -1}
                    aria-label={`${binCount(-1)} ${currentNoun} with no accounts yet`}
                    data-active={activeBin === -1 ? "" : undefined}
                    onPointerEnter={(event) => {
                      if (event.pointerType !== "touch") setHoverBin(-1);
                    }}
                    onPointerLeave={() => setHoverBin(null)}
                    onFocus={() => setHoverBin(-1)}
                    onBlur={() => setHoverBin(null)}
                    onClick={() => setPinnedBin((current) => (current === -1 ? null : -1))}
                  >
                    <span className={styles.swatch} style={{ "--fill": "var(--none)", "--alpha": 1 } as CSSProperties} />
                    <span className={styles.noneLabel}>No accounts</span>
                  </button>
                )}
              </div>
              <p className={styles.legendNote}><RisingText text={legendNote} /></p>
            </div>
          </div>
          <aside className={styles.side} aria-labelledby={listId}>
            <div className={styles.sideHead}>
              <h3 id={listId} className={styles.subhead}>
                <RisingText text={openRegion && !openSubs ? openRegion.name : `${rows.length} ${currentNoun}`} />
              </h3>
              <span className={styles.sideMeta}><RisingText text={`Ranked by ${metric.label.toLowerCase()}`} /></span>
            </div>
            <motion.div ref={listRef} className={styles.scroller} layoutScroll>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={`${activeMap?.id}:${openId ?? "all"}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: reduced ? 0 : duration.standard, delay: 0.12 * (reduced ? 0 : 1), ease: enter } }}
                  exit={{ opacity: 0, transition: { duration: reduced ? 0 : duration.exit } }}
                >
                  {openRegion && !openSubs ? (
                    <div className={styles.emptyPanel}>
                      <p className={styles.emptyTitle}>
                        {subNoun ? `No ${singular(subNoun)} detail for ${openRegion.name}` : openRegion.name}
                      </p>
                      <p className={styles.emptyText}>
                        {subNoun
                          ? `${capitalize(singular(subNoun))} data covers the ${mapRegions.filter((entry) => entry.subregions).length} ${noun} with a field team. `
                          : ""}
                        {openRegion.name} has {formatValue(openRegion.values[metric.id] ?? null, metric)} in {metric.label.toLowerCase()}
                        {topData.byId.get(openRegion.id)?.rank
                          ? `, ${ordinal(topData.byId.get(openRegion.id)?.rank ?? 0)} of ${topData.items.length} ${noun}`
                          : ""}
                        .
                      </p>
                      <button type="button" className={styles.emptyAction} onClick={() => selectRegion(null)}>
                        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
                        Back to all {noun}
                      </button>
                    </div>
                  ) : (
                    <ol
                      className={styles.list}
                      aria-labelledby={listId}
                      onKeyDown={(event: ReactKeyboardEvent<HTMLOListElement>) => {
                        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || rows.length === 0) return;
                        event.preventDefault();
                        const current = Math.max(0, rows.findIndex((entry) => entry.region.id === rovingId));
                        const target =
                          event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? rows.length - 1
                              : clamp(current + (event.key === "ArrowDown" ? 1 : -1), 0, rows.length - 1);
                        const next = rows[target].region.id;
                        setFocusRow(next);
                        listRef.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(next)}"] button`)?.focus();
                      }}
                    >
                      {rows.map((entry) => {
                        const id = entry.region.id;
                        const on = (hover?.id === id && hover.level === level) || pinnedSub === id;
                        const dim = activeBin !== null && entry.bin !== activeBin;
                        const isTop = level === "top";
                        const value = formatValue(entry.value, metric);
                        const bin = bins[entry.bin];
                        return (
                          <motion.li
                            key={id}
                            layout="position"
                            transition={reduced ? still : spring.smooth}
                            data-row={id}
                            className={styles.item}
                            data-dim={dim ? "" : undefined}
                          >
                            <button
                              type="button"
                              className={styles.row}
                              tabIndex={id === rovingId ? 0 : -1}
                              data-on={on ? "" : undefined}
                              aria-pressed={isTop ? undefined : pinnedSub === id}
                              aria-label={`${entry.rank ? `${ordinal(entry.rank)}, ` : ""}${entry.region.name}, ${spokenValue(entry.value, metric)}${isTop ? (entry.region.subregions ? `. Open ${entry.region.subregions.regions.length} ${entry.region.subregions.noun}` : ". Zoom in") : ""}`}
                              onPointerEnter={(event) => {
                                if (event.pointerType !== "touch") setHover({ level, id, source: "list" });
                              }}
                              onPointerLeave={() => setHover((current) => (current?.source === "list" ? null : current))}
                              onFocus={() => {
                                setFocusRow(id);
                                setHover({ level, id, source: "list" });
                              }}
                              onBlur={() => setHover((current) => (current?.source === "list" && current.id === id ? null : current))}
                              onClick={() => (isTop ? selectRegion(id) : toggleSub(id))}
                            >
                              <span className={styles.rank}>{entry.rank || ""}</span>
                              <span className={styles.name}>{entry.region.name}</span>
                              <span className={styles.value}>{value}</span>
                              <span className={styles.bar} aria-hidden="true">
                                <span
                                  className={styles.barFill}
                                  style={{
                                    transform: `scaleX(${entry.value === null ? 0 : Math.max(0.015, Math.abs(entry.value) / maxValue)})`,
                                    "--fill": bin?.tone === "neg" ? "var(--neg)" : "var(--pos)",
                                  } as CSSProperties}
                                />
                              </span>
                              <span className={styles.chevron} aria-hidden="true">
                                {isTop && entry.region.subregions ? <ChevronRight size={16} strokeWidth={1.75} /> : null}
                              </span>
                            </button>
                          </motion.li>
                        );
                      })}
                    </ol>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </aside>
        </div>
        <p id={hintId} className={styles.srOnly}>
          Select a {singular(noun)} on the map or in the ranked list to zoom in. In the list, use the arrow keys to move and Enter to open. Escape zooms back out.
        </p>
        <p className={styles.srOnly} aria-live="polite">{announcement}</p>
      </div>
    </section>
  );
}

export { ChoroplethExplorer };
