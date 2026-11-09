"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  motionValue,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { ArrowUpRight } from "lucide-react";
import AnimatedCounter from "../animated-counter/animated-counter";
import SegmentedControl, { type Segment } from "../segmented-control/segmented-control";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./cohort-retention.module.css";

/* ------------------------------------------------------------------ data */

type SegmentKey = "all" | "self" | "sales";

interface SegmentSpec extends Segment {
  value: SegmentKey;
  /** Used in the chart summary, the table caption and the live region. */
  noun: string;
}

const SEGMENTS: SegmentSpec[] = [
  { value: "all", label: "All", noun: "all workspaces" },
  { value: "self", label: "Self-serve", noun: "self-serve workspaces" },
  { value: "sales", label: "Sales-led", noun: "sales-led workspaces" },
];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Cohort 0 is August 2025, cohort 11 is July 2026 and row 12 is the weighted average. */
const FIRST_COHORT_INDEX = 24307;

function cohortLabel(row: number, narrow = false): string {
  if (row === 12) return "Average";
  const index = FIRST_COHORT_INDEX + row;
  const month = MONTH_NAMES[index % 12];
  const year = Math.floor(index / 12);
  return narrow ? `${month} ’${String(year).slice(2)}` : `${month} ${year}`;
}

/** How many months of a cohort have been measured: one fewer for every cohort that has not aged yet. */
function monthsMeasured(row: number): number {
  return row === 12 ? 12 : 12 - row;
}

interface Cell {
  /** Flat index into the rate arrays, and the React key. */
  i: number;
  r: number;
  k: number;
  /** 0 at the top-left corner of the triangle, 1 at the bottom-right; drives the segment stagger. */
  wave: number;
}

const CELLS: Cell[] = [];
const CELL_INDEX: number[] = [];

for (let r = 0; r <= 12; r++) {
  for (let k = 1; k <= monthsMeasured(r); k++) {
    CELL_INDEX[12 * r + k - 1] = CELLS.length;
    CELLS.push({ i: CELLS.length, r, k, wave: (r + k - 1) / 23 });
  }
}

/** Row/column → flat cell index, or -1 for a month that has not been measured yet. */
function cellIndex(row: number, month: number): number {
  return month >= 1 && month <= monthsMeasured(row) ? CELL_INDEX[12 * row + month - 1] : -1;
}

interface SimulationConfig {
  seed: number;
  size: number;
  growth: number;
  m1: number;
  m1Trend: number;
  floor: number;
  floorTrend: number;
  decay: number;
  dip?: Record<number, number>;
}

interface SimulatedCohorts {
  sizes: number[];
  retained: number[][];
}

/** Deterministic sample data: twelve cohorts whose month-1 rate drifts up and whose tail settles on a floor. */
function simulate(config: SimulationConfig): SimulatedCohorts {
  let seed = config.seed;
  const random = () => {
    let t = (seed = (seed + 0x6d2b79f5) | 0);
    let v = Math.imul(t ^ (t >>> 15), 1 | t);
    v = (v + Math.imul(v ^ (v >>> 7), 61 | v)) ^ v;
    return ((v ^ (v >>> 14)) >>> 0) / 0x100000000;
  };
  const sizes: number[] = [];
  const retained: number[][] = [];
  for (let row = 0; row < 12; row++) {
    const size = Math.round(config.size * (1 + config.growth * row) * (0.92 + 0.16 * random()));
    const month1 = config.m1 + config.m1Trend * row + (config.dip?.[row] ?? 0);
    const floor = config.floor + config.floorTrend * row;
    const rowRetained: number[] = [];
    let share = 1;
    let active = size;
    for (let month = 1; month <= monthsMeasured(row); month++) {
      // Retention only falls; the jitter is small enough that it cannot rise.
      active = Math.min(active, Math.round(size * (floor + (month1 - floor) * share + (random() - 0.5) * 0.02)));
      rowRetained.push(active);
      share *= config.decay;
    }
    sizes.push(size);
    retained.push(rowRetained);
  }
  return { sizes, retained };
}

const SELF_SERVE = simulate({
  seed: 11, size: 300, growth: 0.035, m1: 0.688, m1Trend: 0.0068, floor: 0.305, floorTrend: 0.0055, decay: 0.7, dip: { 5: -0.055 },
});

const SALES_LED = simulate({
  seed: 29, size: 62, growth: 0.045, m1: 0.925, m1Trend: 0.0025, floor: 0.715, floorTrend: 0.004, decay: 0.8,
});

interface Dataset {
  /** Retained workspaces per cell; the average row is the sum across cohorts. */
  retained: number[];
  /** Cohort size per cell; the average row is the summed size of every cohort in that month. */
  base: number[];
  rate: number[];
  sizes: number[];
  total: number;
  m1: number;
  m6: number;
  m1Delta: number;
  m6Delta: number;
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

function deriveDataset(sizes: number[], retained: number[][]): Dataset {
  const dataset: Dataset = {
    retained: [],
    base: [],
    rate: [],
    sizes,
    total: sizes.reduce((sum, size) => sum + size, 0),
    m1: 0,
    m6: 0,
    m1Delta: 0,
    m6Delta: 0,
  };
  for (const cell of CELLS) {
    let alive = 0;
    let base = 0;
    if (cell.r === 12) {
      for (let row = 0; row < 12; row++) {
        if (cell.k <= monthsMeasured(row)) {
          alive += retained[row][cell.k - 1];
          base += sizes[row];
        }
      }
    } else {
      alive = retained[cell.r][cell.k - 1];
      base = sizes[cell.r];
    }
    dataset.retained.push(alive);
    dataset.base.push(base);
    dataset.rate.push(alive / base);
  }

  const rateAt = (row: number, month: number) => dataset.rate[cellIndex(row, month)];
  const drift = (month: number) => {
    const rows = Array.from({ length: 12 }, (_, row) => row).filter(row => month <= monthsMeasured(row));
    return mean(rows.slice(-3).map(row => rateAt(row, month))) - mean(rows.slice(0, 3).map(row => rateAt(row, month)));
  };

  dataset.m1 = rateAt(12, 1);
  dataset.m6 = rateAt(12, 6);
  dataset.m1Delta = drift(1);
  dataset.m6Delta = drift(6);
  return dataset;
}

const DATA: Record<SegmentKey, Dataset> = {
  self: deriveDataset(SELF_SERVE.sizes, SELF_SERVE.retained),
  sales: deriveDataset(SALES_LED.sizes, SALES_LED.retained),
  all: deriveDataset(
    SELF_SERVE.sizes.map((size, row) => size + SALES_LED.sizes[row]),
    SELF_SERVE.retained.map((row, index) => row.map((alive, month) => alive + SALES_LED.retained[index][month])),
  ),
};

/** Retention thresholds of the six colour steps; the first step starts at 0 and the last at 80%. */
const RAMP = [0, 0.2, 0.35, 0.5, 0.65, 0.8];

function stepFor(rate: number): number {
  let step = 0;
  for (let index = 1; index < RAMP.length; index++) if (rate >= RAMP[index]) step = index;
  return step;
}

const numberFormat = new Intl.NumberFormat("en-US");
const formatCount = (value: number) => numberFormat.format(Math.round(value));
const formatRate = (rate: number, digits = 1) => `${(100 * rate).toFixed(digits)}%`;
const formatPoints = (delta: number) => `${delta < 0 ? "−" : "+"}${Math.abs(100 * delta).toFixed(1)} pts`;

/* -------------------------------------------------------------- geometry */

interface Geometry {
  width: number;
  wide: boolean;
  gutter: number;
  rowH: number;
  sep: number;
  plotH: number;
  height: number;
  colW: number;
  radius: number;
  /** Month values are only drawn when a column is wide enough to hold a two-digit number. */
  values: boolean;
}

function geometryFor(width: number): Geometry {
  const wide = width >= 600;
  const gutter = wide ? 136 : 56;
  const rowH = wide ? 30 : 24;
  const sep = wide ? 10 : 8;
  const plotH = 12 * rowH + sep + rowH;
  const colW = Math.max(1, (width - gutter) / 12);
  return { width, wide, gutter, rowH, sep, plotH, height: plotH + 30, colW, radius: wide ? 5 : 3, values: colW >= 32 };
}

const columnX = (geo: Geometry, month: number) => Math.round(geo.gutter + (month - 1) * geo.colW);
const rowY = (geo: Geometry, row: number) => (row < 12 ? row * geo.rowH : 12 * geo.rowH + geo.sep);
const valueY = (geo: Geometry, rate: number) => 10 + (1 - rate) * (geo.plotH - 20);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
const smoothstep = (from: number, to: number, value: number) => {
  const t = clamp((value - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
};

const CELLS_BY_COHORT = Array.from({ length: 13 }, (_, row) => CELLS.filter(cell => cell.r === row).map(cell => cell.i));

interface CellShape {
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
  cx: number;
  cy: number;
  /** 0 in heatmap view, 1 in curves view. */
  size: number;
  ink: number;
  label: string;
}

interface Scene {
  cells: CellShape[];
  /** One polyline per cohort, in cell order. */
  paths: string[];
  lines: number;
  labels: number;
  grid: number;
  marker: { x: number; y: number; w: number; h: number; rx: number };
  hoverPath: string;
  crossX: number;
  crossY: number;
  panel: { x: number; y: number };
}

/** Place the 200×124 hover panel beside the cell, falling back to the other side and then above or below. */
function panelPosition(geo: Geometry, cell: CellShape) {
  const right = cell.x + cell.w + 10;
  const left = cell.x - 10 - 200;
  if (right + 200 <= geo.width) return { x: right, y: clamp(cell.cy - 62, 0, geo.height - 124) };
  if (left >= 0) return { x: left, y: clamp(cell.cy - 62, 0, geo.height - 124) };
  const x = clamp(cell.cx - 100, 0, Math.max(0, geo.width - 200));
  const above = cell.y - 10 - 124;
  return { x, y: above >= 0 ? above : Math.min(cell.y + cell.h + 10, geo.height - 124) };
}

/**
 * One scene for both views: every cell interpolates from its heatmap rectangle to a small dot on the
 * cohort's curve as `progress` runs from 0 to 1, so a view switch is a single continuous morph.
 */
function buildScene(progress: number, width: number, active: number, rates: number[]): Scene {
  const geo = geometryFor(width);

  const cells = CELLS.map(cell => {
    const local = clamp(1.5 * progress - 0.5 * cell.wave, 0, 1);
    const shaped = smoothstep(0, 0.6, local);
    const faded = smoothstep(0.2, 1, local);
    const left = columnX(geo, cell.k) + 1;
    const right = columnX(geo, cell.k + 1) - 1;
    const top = rowY(geo, cell.r) + 1;
    const height = geo.rowH - 2;
    const dot = cell.r === 12 ? 7 : 5;
    const rate = rates[cell.i];
    const cx = (left + right) / 2;
    const cy = lerp(top + height / 2, valueY(geo, rate), faded);
    const w = lerp(right - left, dot, shaped);
    const h = lerp(height, dot, shaped);
    return {
      x: cx - w / 2,
      y: cy - h / 2,
      w,
      h,
      rx: lerp(geo.radius, dot / 2, shaped),
      cx,
      cy,
      size: shaped,
      ink: geo.values ? clamp(1 - 5 * local, 0, 1) : 0,
      label: String(Math.round(100 * rate)),
    };
  });

  const paths = CELLS_BY_COHORT.map(indexes =>
    indexes.map((index, position) => `${position ? "L" : "M"}${cells[index].cx.toFixed(1)} ${cells[index].cy.toFixed(2)}`).join(""),
  );

  const markerCell = cells[active >= 0 ? active : 0];
  const pad = lerp(1, 2.75, markerCell.size);

  return {
    cells,
    paths,
    lines: smoothstep(0.3, 0.85, progress),
    labels: 1 - smoothstep(0, 0.4, progress),
    grid: smoothstep(0.45, 1, progress),
    marker: { x: markerCell.x - pad, y: markerCell.y - pad, w: markerCell.w + 2 * pad, h: markerCell.h + 2 * pad, rx: markerCell.rx + pad },
    hoverPath: paths[CELLS[active >= 0 ? active : 0].r],
    crossX: Math.round(markerCell.cx) + 0.5,
    crossY: markerCell.cy,
    panel: panelPosition(geo, markerCell),
  };
}

/* --------------------------------------------------------------- motion */

const { spring, duration, ease } = motionTokens;
const ENTER_EASE = [...ease.enter] as [number, number, number, number];
const CURVE_SPRING = { ...spring.smooth, visualDuration: 0.64 };
const CELL_SPRING = spring.smooth;
const PANEL_SPRING = { visualDuration: 0.2, bounce: 0 };

const VIEWS: Segment[] = [
  { value: "heatmap", label: "Heatmap" },
  { value: "curves", label: "Curves" },
];

const ROWS = Array.from({ length: 13 }, (_, row) => row);
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const VALUE_TICKS = [1, 0.75, 0.5, 0.25, 0];

type ViewKey = "heatmap" | "curves";
interface Hover {
  r: number;
  k: number;
}

const KEY_STEPS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

function describeCell(segment: SegmentKey, { r, k }: Hover): string {
  const dataset = DATA[segment];
  const index = cellIndex(r, k);
  const where = r === 12 ? `Average of ${12 - k + 1} cohorts` : `${cohortLabel(r)} cohort`;
  return `${where}, month ${k}: ${formatRate(dataset.rate[index])} retained, ${formatCount(dataset.retained[index])} of ${formatCount(dataset.base[index])} workspaces.`;
}

/* ------------------------------------------------------------ fragments */

/** Text that rises in and out when it changes; the wrapper holds its footprint so nothing jumps. */
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
          transition={{ duration: reduced ? duration.instant : duration.standard, ease: ENTER_EASE }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Signed point change against the first three cohorts, with the arrow flipping for a drop. */
function Delta({ change }: { change: number }) {
  const reduced = useReducedMotion();
  return (
    <span className={styles.delta} data-tone={change >= 0 ? "good" : "bad"}>
      <motion.span
        className={styles.deltaIcon}
        initial={false}
        animate={{ rotate: change >= 0 ? 0 : 90 }}
        transition={reduced ? { duration: 0 } : spring.snappy}
      >
        <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" />
      </motion.span>
      <Rise text={formatPoints(change)} className={styles.deltaValue} />
      <span className={styles.deltaContext}>latest 3 vs first 3 cohorts</span>
    </span>
  );
}

/** One cell: a rectangle that becomes a dot on the curve, with its own rate motion value for the colour step. */
function CellShapeNode({ scene, value, cell, state }: { scene: MotionValue<Scene>; value: MotionValue<number>; cell: Cell; state?: string }) {
  const [step, setStep] = useState(() => stepFor(value.get()));
  useMotionValueEvent(value, "change", latest => setStep(stepFor(latest)));

  const x = useTransform(scene, latest => latest.cells[cell.i].x);
  const y = useTransform(scene, latest => latest.cells[cell.i].y);
  const width = useTransform(scene, latest => latest.cells[cell.i].w);
  const height = useTransform(scene, latest => latest.cells[cell.i].h);
  const rx = useTransform(scene, latest => latest.cells[cell.i].rx);
  const cx = useTransform(scene, latest => latest.cells[cell.i].cx);
  const cy = useTransform(scene, latest => latest.cells[cell.i].cy);
  const ink = useTransform(scene, latest => latest.cells[cell.i].ink);
  const label = useTransform(scene, latest => latest.cells[cell.i].label);

  return (
    <g className={styles.cell} data-step={step} data-state={state} data-avg={cell.r === 12 || undefined}>
      <motion.rect x={x} y={y} width={width} height={height} rx={rx} />
      <motion.text x={cx} y={cy} dy=".35em" textAnchor="middle" style={{ opacity: ink }}>
        {label}
      </motion.text>
    </g>
  );
}

/** One cohort polyline in the curves view. */
function CohortLine({ scene, row, state }: { scene: MotionValue<Scene>; row: number; state?: string }) {
  const d = useTransform(scene, latest => latest.paths[row]);
  return <motion.path className={styles.line} d={d} data-state={state} data-avg={row === 12 || undefined} />;
}

/** Cohort size label in the gutter; it rolls when the segment changes. */
function SizeLabel({ value, x, y }: { value: MotionValue<number>; x: number; y: number }) {
  const text = useTransform(value, latest => formatCount(Math.round(latest)));
  return (
    <motion.text className={styles.size} x={x} y={y} dy=".35em" textAnchor="end">
      {text}
    </motion.text>
  );
}

/** Hover card for the active cell. */
function CellPanel({ segment, hover }: { segment: SegmentKey; hover: Hover }) {
  const dataset = DATA[segment];
  const index = cellIndex(hover.r, hover.k);
  const average = dataset.rate[cellIndex(12, hover.k)];
  const delta = dataset.rate[index] - average;
  const tone = 5e-4 > Math.abs(delta) ? undefined : delta > 0 ? "good" : "bad";
  return (
    <>
      <p className={styles.panelHead}>
        <span>{hover.r === 12 ? "Average" : `${cohortLabel(hover.r)} cohort`}</span>
        <span>Month {hover.k}</span>
      </p>
      <p className={styles.panelValue}>{formatRate(dataset.rate[index])}</p>
      <dl className={styles.panelRows}>
        <div>
          <dt>Still active</dt>
          <dd>
            {formatCount(dataset.retained[index])} of {formatCount(dataset.base[index])}
          </dd>
        </div>
        {hover.r === 12 ? (
          <div>
            <dt>Weighted across</dt>
            <dd>{12 - hover.k + 1} cohorts</dd>
          </div>
        ) : (
          <div>
            <dt>Vs average</dt>
            <dd data-tone={tone}>{formatPoints(delta)}</dd>
          </div>
        )}
      </dl>
    </>
  );
}

/** The ramp or the curve keys, crossfading when the view changes. */
function Legend({ view }: { view: ViewKey }) {
  const reduced = useReducedMotion();
  return (
    <div className={styles.legendSlot}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={view}
          className={styles.legend}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: reduced ? duration.instant : duration.standard, ease: ENTER_EASE }}
        >
          {view === "heatmap" ? (
            <div
              className={styles.scale}
              role="img"
              aria-label="Darker cells retain more. Steps start at 20, 35, 50, 65 and 80 percent retained."
            >
              <span className={styles.scaleLabel}>% retained</span>
              <span className={styles.ramp} aria-hidden="true">
                {RAMP.map((value, index) => (
                  <span key={value} className={styles.rampStep} data-step={index} />
                ))}
              </span>
              <span className={styles.rampTicks} aria-hidden="true">
                {RAMP.slice(1).map((value, index) => (
                  <span key={value} style={{ left: (index + 1) * 30 - 1 }}>
                    {Math.round(100 * value)}
                  </span>
                ))}
              </span>
            </div>
          ) : (
            <div className={styles.keys}>
              <span className={styles.key}>
                <span className={styles.keyAvg} aria-hidden="true" />
                Average, size-weighted
              </span>
              <span className={styles.key}>
                <span className={styles.keyLine} aria-hidden="true" />
                One line per cohort
              </span>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------ component */

/**
 * A cohort retention triangle that morphs into retention curves, with segment filters and a
 * keyboard-navigable cell cursor. Cohort sizes and retained counts come from simulate() above.
 * Takes no props; every figure is derived from the sample cohort data.
 */
export function CohortRetention() {
  const reduced = !!useReducedMotion();
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const titleId = `${id}-title`;
  const hintId = `${id}-hint`;
  const tableId = `${id}-table`;

  const [segment, setSegment] = useState<SegmentKey>("all");
  const [view, setView] = useState<ViewKey>("heatmap");
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<Hover | null>(null);
  /** The panel outlives `hover` so it can fade out with its last contents intact. */
  const [panelCell, setPanelCell] = useState<Hover | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // One motion value per cell and per cohort row, created once for this instance.
  const store = useRef<{ rates: MotionValue<number>[]; sizes: MotionValue<number>[] } | null>(null);
  if (store.current === null) {
    store.current = {
      rates: CELLS.map(cell => motionValue(DATA.all.rate[cell.i])),
      sizes: ROWS.map(row => motionValue(row === 12 ? DATA.all.total : DATA.all.sizes[row])),
    };
  }
  const { rates, sizes } = store.current;

  const curveProgress = useMotionValue(0);
  const chartWidth = useMotionValue(720);
  const activeIndex = useMotionValue(0);

  const sceneInputs = useMemo(() => [curveProgress, chartWidth, activeIndex, ...rates], [curveProgress, chartWidth, activeIndex, rates]);
  const scene = useTransform(sceneInputs, ([progress, currentWidth, active, ...values]: number[]) =>
    buildScene(progress, currentWidth, active, values),
  );

  const linesOpacity = useTransform(scene, latest => latest.lines);
  const labelsOpacity = useTransform(scene, latest => latest.labels);
  const gridOpacity = useTransform(scene, latest => latest.grid);
  const markerX = useTransform(scene, latest => latest.marker.x);
  const markerY = useTransform(scene, latest => latest.marker.y);
  const markerW = useTransform(scene, latest => latest.marker.w);
  const markerH = useTransform(scene, latest => latest.marker.h);
  const markerRx = useTransform(scene, latest => latest.marker.rx);
  const hoverPath = useTransform(scene, latest => latest.hoverPath);
  const crossX = useTransform(scene, latest => latest.crossX);
  const crossY = useTransform(scene, latest => latest.crossY);
  const tagY = useTransform(scene, latest => latest.crossY - 10);
  const tagText = useTransform(sceneInputs, ([, , active, ...values]: number[]) => formatRate(values[Math.max(0, active)]));

  const panelX = useTransform(scene, latest => latest.panel.x);
  const panelY = useTransform(scene, latest => latest.panel.y);
  const panelSpringX = useSpring(panelX, PANEL_SPRING);
  const panelSpringY = useSpring(panelY, PANEL_SPRING);

  const plotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = plotRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (!next) return;
      setWidth(next);
      chartWidth.set(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [chartWidth]);

  const geo = geometryFor(width);
  const dataset = DATA[segment];
  const curves = view === "curves";
  const noun = SEGMENTS.find(option => option.value === segment)!.noun;

  /** Move the cursor to a cell, scrolling the panel in from the cell when it opens fresh. */
  function selectHover(next: Hover | null) {
    if (next?.r === hover?.r && next?.k === hover?.k) return;
    if (next) {
      const index = cellIndex(next.r, next.k);
      if (!hover) {
        const start = buildScene(
          curveProgress.get(),
          chartWidth.get(),
          index,
          rates.map(value => value.get()),
        ).cells[index];
        // The panel springs open from where the panel for that cell would sit, not from the cell.
        const origin = panelPosition(geometryFor(chartWidth.get()), start);
        panelSpringX.jump(origin.x);
        panelSpringY.jump(origin.y);
      }
      activeIndex.set(index);
      setPanelCell(next);
    }
    setHover(next);
  }

  /** Hit-test a pointer position against the rows, or against the nearest cohort in curves view. */
  const hitTest = (event: PointerEvent<HTMLDivElement>): Hover | null => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < geo.gutter || x > geo.width || y < 0 || y > geo.plotH + 6) return null;
    const month = clamp(Math.floor((x - geo.gutter) / geo.colW) + 1, 1, 12);
    if (curves) {
      let row = 12;
      let distance = Math.abs(valueY(geo, dataset.rate[cellIndex(12, month)]) - y) - 3;
      for (let candidate = 0; candidate < 12; candidate++) {
        if (month > monthsMeasured(candidate)) continue;
        const next = Math.abs(valueY(geo, dataset.rate[cellIndex(candidate, month)]) - y);
        if (next < distance) {
          row = candidate;
          distance = next;
        }
      }
      return { r: row, k: month };
    }
    const row = y >= 12 * geo.rowH + geo.sep / 2 ? 12 : Math.min(11, Math.floor(y / geo.rowH));
    return month <= monthsMeasured(row) ? { r: row, k: month } : null;
  };

  const summary = `${curves ? "Retention curves" : "Retention heatmap"} for ${noun}, August 2025 to July 2026 signup cohorts. Month 1 retention averages ${formatRate(dataset.m1)} and month 6 retention ${formatRate(dataset.m6)}. Newer cohorts retain ${formatPoints(dataset.m1Delta)} more in month 1 than the first three. Every value is listed in the table that follows.`;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      if (hover) {
        event.preventDefault();
        selectHover(null);
        setAnnouncement("");
      }
      return;
    }
    if (!(event.key in KEY_STEPS) && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    let next: Hover = { r: 0, k: 1 };
    if (hover) {
      const [rows, months] = KEY_STEPS[event.key] ?? [0, 0];
      const row = clamp(hover.r + rows, 0, 12);
      const month = event.key === "Home" ? 1 : event.key === "End" ? monthsMeasured(row) : hover.k + months;
      next = { r: row, k: clamp(month, 1, monthsMeasured(row)) };
    }
    selectHover(next);
    setAnnouncement(describeCell(segment, next));
  }

  function cellState(cell: Cell): string | undefined {
    if (!hover) return undefined;
    if (curves) return cell.r === hover.r ? "on" : cell.r === 12 ? undefined : "dim";
    return cell.r === hover.r || cell.k === hover.k ? "on" : "dim";
  }

  return (
    <section className={styles.root} aria-labelledby={titleId}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.heading}>
            <h2 id={titleId}>Cohort retention</h2>
            <p>Workspaces still active each month after signup. Data through Aug 31, 2026.</p>
          </div>
          <SegmentedControl
            label="Segment"
            options={SEGMENTS}
            value={segment}
            onValueChange={value => {
              const next = value as SegmentKey;
              if (next === segment) return;
              setSegment(next);
              const target = DATA[next];
              rates.forEach((rate, index) => {
                if (reduced) rate.jump(target.rate[index]);
                else
                  animate(rate, target.rate[index], {
                    ...CELL_SPRING,
                    delay: rate.isAnimating() ? 0 : 0.24 * CELLS[index].wave,
                  });
              });
              sizes.forEach((size, row) => {
                const value = row === 12 ? target.total : target.sizes[row];
                if (reduced) size.jump(value);
                else animate(size, value, { ...CELL_SPRING, delay: size.isAnimating() ? 0 : (row / 23) * 0.24 });
              });
              setAnnouncement(
                `Showing ${SEGMENTS.find(option => option.value === next)!.noun}. Month 1 retention ${formatRate(target.m1)}, month 6 retention ${formatRate(target.m6)}.`,
              );
            }}
          />
        </header>

        <dl className={styles.kpis}>
          <div className={styles.kpi}>
            <dt>Month 1 retention</dt>
            <dd>
              <span className={styles.value}>
                <span className={styles.num}>
                  <AnimatedCounter value={Math.round(1e3 * dataset.m1) / 10} decimals={1} suffix="%" />
                </span>
              </span>
              <Delta change={dataset.m1Delta} />
            </dd>
          </div>
          <div className={styles.kpi}>
            <dt>Month 6 retention</dt>
            <dd>
              <span className={styles.value}>
                <span className={styles.num}>
                  <AnimatedCounter value={Math.round(1e3 * dataset.m6) / 10} decimals={1} suffix="%" />
                </span>
              </span>
              <Delta change={dataset.m6Delta} />
            </dd>
          </div>
          <div className={styles.kpi}>
            <dt>New workspaces</dt>
            <dd>
              <span className={styles.value}>
                <span className={styles.num}>
                  <AnimatedCounter value={dataset.total} />
                </span>
              </span>
              <span className={styles.delta}>Signed up Aug 2025 to Jul 2026</span>
            </dd>
          </div>
        </dl>

        <div className={styles.toolbar}>
          <Legend view={view} />
          <SegmentedControl
            label="Chart view"
            options={VIEWS}
            value={view}
            onValueChange={value => {
              const next = value as ViewKey;
              if (next === view) return;
              setView(next);
              if (reduced) curveProgress.jump(+(next === "curves"));
              else animate(curveProgress, +(next === "curves"), CURVE_SPRING);
              setAnnouncement(
                next === "curves"
                  ? "Showing one retention curve per cohort with the weighted average."
                  : "Showing the retention heatmap.",
              );
            }}
          />
        </div>

        <div ref={plotRef} className={styles.chart}>
          <div
            className={styles.plot}
            style={{ height: geo.height }}
            tabIndex={0}
            role="group"
            aria-label="Retention by cohort and month"
            aria-describedby={hintId}
            data-view={view}
            data-active={hover ? "" : undefined}
            onPointerDown={event => selectHover(hitTest(event))}
            onPointerMove={event => selectHover(hitTest(event))}
            onPointerLeave={event => {
              if (event.pointerType === "mouse") selectHover(null);
            }}
            onKeyDown={handleKeyDown}
            onFocus={event => {
              if (hover || !event.currentTarget.matches(":focus-visible")) return;
              selectHover({ r: 0, k: 1 });
              setAnnouncement(describeCell(segment, { r: 0, k: 1 }));
            }}
            onBlur={() => selectHover(null)}
          >
            <svg
              className={styles.svg}
              width={width}
              height={geo.height}
              viewBox={`0 0 ${width} ${geo.height}`}
              role="img"
              aria-label={summary}
            >
              <motion.g style={{ opacity: gridOpacity }}>
                {VALUE_TICKS.map(rate => {
                  const y = Math.round(valueY(geo, rate)) + 0.5;
                  return (
                    <g key={rate}>
                      <line
                        className={rate === 0 ? styles.baseline : styles.gridLine}
                        x1={geo.gutter}
                        x2={width}
                        y1={y}
                        y2={y}
                      />
                      <text className={styles.axis} x={geo.gutter - 12} y={y} dy=".32em" textAnchor="end">
                        {Math.round(100 * rate)}%
                      </text>
                    </g>
                  );
                })}
              </motion.g>

              <motion.g style={{ opacity: labelsOpacity }}>
                {ROWS.map(row => {
                  const y = rowY(geo, row) + geo.rowH / 2;
                  return (
                    <g key={row} className={styles.rowLabel} data-on={(hover?.r === row) || undefined} data-avg={row === 12 || undefined}>
                      <text x={0} y={y} dy=".35em">
                        {cohortLabel(row, !geo.wide)}
                      </text>
                      {geo.wide && <SizeLabel value={sizes[row]} x={geo.gutter - 14} y={y} />}
                    </g>
                  );
                })}
              </motion.g>

              <g>
                <text className={styles.axis} x={0} y={geo.plotH + 21}>
                  {geo.wide ? "Months since signup" : "Month"}
                </text>
                {MONTHS.map(month => (
                  <text
                    key={month}
                    className={styles.axis}
                    data-on={(hover?.k === month) || undefined}
                    x={(columnX(geo, month) + columnX(geo, month + 1)) / 2}
                    y={geo.plotH + 21}
                    textAnchor="middle"
                  >
                    {month}
                  </text>
                ))}
              </g>

              {hover && (
                <motion.g className={styles.cross} style={{ opacity: linesOpacity }}>
                  <motion.line x1={crossX} x2={crossX} y1={valueY(geo, 1) - 6} y2={valueY(geo, 0)} />
                  <motion.line x1={geo.gutter} x2={crossX} y1={crossY} y2={crossY} strokeDasharray="2 3" />
                </motion.g>
              )}

              <motion.g style={{ opacity: linesOpacity }}>
                {ROWS.map(row => (
                  <CohortLine
                    key={row}
                    scene={scene}
                    row={row}
                    state={hover && row !== 12 ? (row === hover.r ? "on" : "dim") : undefined}
                  />
                ))}
                {hover && hover.r !== 12 && <motion.path className={styles.line} data-state="on" d={hoverPath} />}
              </motion.g>

              {CELLS.map(cell => (
                <CellShapeNode key={cell.i} scene={scene} value={rates[cell.i]} cell={cell} state={cellState(cell)} />
              ))}

              {hover && (
                <motion.rect className={styles.marker} x={markerX} y={markerY} width={markerW} height={markerH} rx={markerRx} />
              )}

              {hover && (
                <motion.g className={styles.tag} style={{ y: tagY, opacity: linesOpacity }}>
                  <rect x={Math.max(2, geo.gutter - 58)} y={0} width={52} height={20} rx={6} />
                  <motion.text x={geo.gutter - 12} y={10} dy=".35em" textAnchor="end">
                    {tagText}
                  </motion.text>
                </motion.g>
              )}
            </svg>

            <motion.div
              className={styles.panel}
              style={{ x: reduced ? panelX : panelSpringX, y: reduced ? panelY : panelSpringY }}
              initial={false}
              animate={{ opacity: +!!hover }}
              transition={{ duration: hover ? duration.instant : duration.fast }}
              aria-hidden="true"
            >
              {panelCell && <CellPanel segment={segment} hover={panelCell} />}
            </motion.div>
          </div>
        </div>

        <p id={hintId} className={styles.srOnly}>
          Use the arrow keys to move between cohorts and months, Home and End to jump within a cohort, and Escape to clear.
        </p>
        <p className={styles.srOnly} aria-live="polite">
          {announcement}
        </p>

        <div className={styles.srOnly}>
          <table id={tableId}>
            <caption>Share of {noun} still active by months since signup</caption>
            <thead>
              <tr>
                <th scope="col">Cohort</th>
                <th scope="col">Workspaces</th>
                {MONTHS.map(month => (
                  <th key={month} scope="col">
                    Month {month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(row => (
                <tr key={row}>
                  <th scope="row">{cohortLabel(row)}</th>
                  <td>{formatCount(row === 12 ? dataset.total : dataset.sizes[row])}</td>
                  {MONTHS.map(month => (
                    <td key={month}>
                      {month <= monthsMeasured(row) ? formatRate(dataset.rate[cellIndex(row, month)]) : "Not yet measured"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default CohortRetention;
