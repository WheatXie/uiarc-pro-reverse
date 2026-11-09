"use client";

import { memo, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import SegmentedControl from "../segmented-control/segmented-control";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./activity-terrain.module.css";

/* ── data ───────────────────────────────────────────────────────────────────────────────────── */

/** A day and hour in the week grid. */
export interface TerrainCell { d: number; h: number }

const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LONG_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const RANGE_LABEL = "Sep 14 to 20, 2026";
const DAY_WEIGHTS = [0.93, 1, 1.03, 0.97, 0.85, 0.5, 0.44];
const DEPLOY_WEIGHTS = [0.82, 1, 0.94, 0.9, 0.62, 0.05, 0.03];
const ERROR_SPIKES: Record<number, number> = { 62: 560, 63: 214, 64: 46 };

const splitIndex = (index: number): TerrainCell => ({ d: Math.floor(index / 24), h: index % 24 });
const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
const hourRange = (hour: number) => `${hourLabel(hour)} to ${hourLabel((hour + 1) % 24)}`;
const formatNumber = (value: number) => Math.round(value).toLocaleString("en-US");
const formatChange = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(100 * value).toFixed(1)}%`;
const bell = (x: number, mean: number, spread: number) => Math.exp(-((x - mean) ** 2) / (2 * spread * spread));
const ramp = (x: number, from: number, to: number) => Math.min(1, Math.max(0, (x - from) / (to - from)));

type MetricKey = "sessions" | "deploys" | "errors";

interface WeekWeights { sessions: number; deploys: number; errors: number }

/**
 * A seeded week of hourly activity. The seed and the weights are the shipped sample: the same seed
 * replays the same 7 × 24 grid on every render, so the numbers in the capture are reproducible.
 */
function generateWeek(seed: number, weights: WeekWeights, spikes: boolean) {
  let state = seed >>> 0;
  const random = () => {
    let t = (state = (state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    return (((t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
  const sessions: number[] = [];
  const deploys: number[] = [];
  const errors: number[] = [];
  for (let index = 0; index < 168; index++) {
    const { d, h } = splitIndex(index);
    const shape = d >= 5
      ? 0.08 + 0.46 * bell(h, 13, 3) + 0.3 * bell(h, 20.5, 1.8)
      : 0.05 + 0.2 * ramp(h, 7.5, 9.5) * (1 - ramp(h, 17, 19.5)) + 0.82 * bell(h, 10.3, 1.5) + 0.9 * bell(h, 14.6, 1.6) + 0.22 * bell(h, 20.6, 1.4);
    sessions.push(Math.round(shape * DAY_WEIGHTS[d] * 4050 * weights.sessions * (0.94 + 0.12 * random())));
    const deployShape = (0.02 + 0.85 * bell(h, 11, 1.3) + bell(h, 15.3, 1.5) + 0.15 * bell(h, 19, 1.2)) * DEPLOY_WEIGHTS[d] * (d === 4 && h >= 14 ? 0.12 : 1);
    deploys.push(Math.max(0, Math.round(36 * deployShape * weights.deploys + (random() - 0.5) * (deployShape > 0.05 ? 4 : 0.9))));
  }
  for (let index = 0; index < 168; index++) {
    const h = index % 24;
    const shape = 0.0085 * sessions[index] * (0.8 + 0.4 * random()) + (h > 0 ? 1.4 * deploys[index - 1] : 0);
    errors.push(Math.round(shape * weights.errors + (spikes ? (ERROR_SPIKES[index] ?? 0) : 0)));
  }
  return { sessions, deploys, errors };
}

const THIS_WEEK = generateWeek(0x1352832, { sessions: 1, deploys: 1, errors: 1 }, true);
const LAST_WEEK = generateWeek(0x135282b, { sessions: 0.928, deploys: 0.9, errors: 1.04 }, false);

const METRIC_LABELS: Record<MetricKey, { label: string; unit: string; one: string; tone: number; upIsGood: boolean }> = {
  sessions: { label: "Sessions", unit: "sessions", one: "session", tone: 0, upIsGood: true },
  deploys: { label: "Deploys", unit: "deploys", one: "deploy", tone: 0, upIsGood: true },
  errors: { label: "Errors", unit: "errors", one: "error", tone: 1, upIsGood: false },
};

interface PeakCell extends TerrainCell { i: number; value: number }

interface MetricSummary {
  key: MetricKey;
  label: string;
  unit: string;
  one: string;
  tone: number;
  upIsGood: boolean;
  values: number[];
  last: number[];
  norm: number[];
  max: number;
  total: number;
  change: number;
  days: number[];
  busiest: number;
  working: number;
  top: PeakCell[];
}

function summarize(key: MetricKey): MetricSummary {
  const values = THIS_WEEK[key];
  const last = LAST_WEEK[key];
  const max = Math.max(...values);
  const total = values.reduce((sum, value) => sum + value, 0);
  const lastTotal = last.reduce((sum, value) => sum + value, 0);
  const days = SHORT_DAYS.map((_, day) => values.slice(24 * day, 24 * day + 24).reduce((sum, value) => sum + value, 0));
  const working = values.reduce((sum, value, index) => {
    const { d, h } = splitIndex(index);
    return sum + (d < 5 && h >= 9 && h < 18 ? value : 0);
  }, 0) / total;
  const top = values
    .map((value, index) => ({ ...splitIndex(index), i: index, value }))
    .sort((a, b) => b.value - a.value || a.i - b.i)
    .slice(0, 3);
  return { key, ...METRIC_LABELS[key], values, last, norm: values.map(value => value / max), max, total, change: total / lastTotal - 1, days, busiest: days.indexOf(Math.max(...days)), working, top };
}

const METRICS: Record<MetricKey, MetricSummary> = {
  sessions: summarize("sessions"),
  deploys: summarize("deploys"),
  errors: summarize("errors"),
};

const METRIC_OPTIONS = (Object.keys(METRICS) as MetricKey[]).map(key => ({ value: key, label: METRICS[key].label }));
const VIEW_OPTIONS = [
  { value: "perspective", label: "Perspective" },
  { value: "top", label: "Top view" },
];

/* ── geometry and colour helpers ───────────────────────────────────────────────────────────── */

const DEG = Math.PI / 180;
/** Camera the block settles into: a three-quarter view looking down at the week. */
const VIEW = { yaw: -32 * DEG, narrowYaw: -50 * DEG, pitch: 30 * DEG, ty: 0.8640000000000001 };
/** Where the camera starts: near top-down and pulled back, then it tips into VIEW. */
const INTRO = { yaw: -6 * DEG, pitch: 76 * DEG, zoom: 0.84 };
const PITCH_RANGE = [10 * DEG, 84 * DEG] as const;
const TOP_PITCH = [90 * DEG, 90 * DEG] as const;
const ZOOM_RANGE = [0.7, 2.8] as const;
const YAW_FREE: readonly [number, number] = [-Infinity, Infinity];
const TOP_YAW = [0, 0] as const;
const STEP = 1 / 240;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const smoothstep = (from: number, to: number, value: number) => {
  const t = clamp((value - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Rubber band: how far past a limit the camera may lean while dragging. */
const rubber = (value: number, [low, high]: readonly [number, number], softness: number) =>
  value < low ? low - (1 - 1 / ((0.55 * (low - value)) / softness + 1)) * softness
    : value > high ? high + (1 - 1 / ((0.55 * (value - high)) / softness + 1)) * softness
      : value;
const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

interface SpringConfig { k: number; c: number }
interface Spring {
  x: number;
  v: number;
  to: number;
  cfg: SpringConfig;
  mode: "spring" | "coast" | "held";
  eps: number;
}

/** Converts a motion spring preset into stiffness and damping for the canvas loop. */
function springConfig({ visualDuration, bounce }: { visualDuration: number; bounce: number }): SpringConfig {
  const omega = (2 * Math.PI) / (1.2 * visualDuration);
  const k = omega * omega;
  return { k, c: 2 * clamp(1 - bounce, 0.05, 1) * Math.sqrt(k) };
}

const SPRINGS = {
  rise: springConfig({ visualDuration: 0.7, bounce: 0 }),
  morph: springConfig(motionTokens.spring.morph),
  camera: springConfig({ ...motionTokens.spring.smooth, visualDuration: 0.9 }),
  intro: springConfig({ ...motionTokens.spring.smooth, visualDuration: 1.7 }),
  zoom: springConfig({ ...motionTokens.spring.smooth, visualDuration: 0.36 }),
  back: springConfig({ ...motionTokens.spring.smooth, visualDuration: 0.5 }),
  lift: springConfig(motionTokens.spring.snappy),
  dim: springConfig({ ...motionTokens.spring.smooth, visualDuration: 0.24 }),
  tone: springConfig({ ...motionTokens.spring.smooth, visualDuration: 0.5 }),
  panel: springConfig({ visualDuration: 0.2, bounce: 0 }),
  frame: springConfig({ ...motionTokens.spring.smooth, visualDuration: 0.6 }),
};

const spring = (value: number, cfg: SpringConfig, eps: number): Spring => ({ x: value, v: 0, to: value, cfg, mode: "spring", eps });

function retarget(state: Spring, to: number, cfg: SpringConfig, jump: boolean) {
  state.to = to;
  state.cfg = cfg;
  state.mode = "spring";
  if (jump) {
    state.x = to;
    state.v = 0;
  }
}

// OKLab, so the ramp keeps its hue while it darkens.
const toLinear = (channel: number) => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (value: number) => 255 * clamp(value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055, 0, 1);

function toOklab([r, g, b]: [number, number, number]): [number, number, number] {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

function fromOklab([L, a, b]: [number, number, number]): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** Mixes two colours in OKLab and returns the 8-bit triple. */
function mixColor(from: [number, number, number], to: [number, number, number], t: number): [number, number, number] {
  const a = toOklab(from);
  const b = toOklab(to);
  return fromOklab([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
}

/** Fills a 65-stop ramp from `low` to `tone`, biased so the dark end widens. */
function fillRamp(target: Float32Array, low: [number, number, number], tone: [number, number, number]) {
  for (let stop = 0; stop <= 64; stop++) target.set(mixColor(low, tone, (stop / 64) ** 0.9), 3 * stop);
}

const rgba = (r: number, g: number, b: number, alpha = 1) =>
  alpha >= 1 ? `rgb(${0 | r} ${0 | g} ${0 | b})` : `rgb(${0 | r} ${0 | g} ${0 | b} / ${alpha.toFixed(3)})`;

const DAY_OF_CELL = Uint8Array.from({ length: 168 }, (_, index) => Math.floor(index / 24));
const HOUR_OF_CELL = Uint8Array.from({ length: 168 }, (_, index) => index % 24);
/** Intro stagger: columns nearer the working day rise first. */
const STAGGER = Float64Array.from({ length: 168 }, (_, index) => (HOUR_OF_CELL[index] / 23) * 0.78 + (DAY_OF_CELL[index] / 6) * 0.22);
const gridX = (hour: number) => hour - 11.5;
const gridZ = (day: number) => day - 3;
const cellIndex = (cell: TerrainCell) => 24 * cell.d + cell.h;
const sameCell = (a: TerrainCell | null | undefined, b: TerrainCell | null | undefined) => !!a && !!b && a.d === b.d && a.h === b.h;
const HOURS = Array.from({ length: 24 }, (_, index) => index);
const DAYS = Array.from({ length: 7 }, (_, index) => index);

const { spring: springTokens, duration: durations, ease } = motionTokens;
const ENTER_EASE = [...ease.enter] as [number, number, number, number];

function cellSentence(metric: MetricSummary, cell: TerrainCell) {
  const index = cellIndex(cell);
  const value = metric.values[index];
  const last = metric.last[index];
  const change = last ? `, ${formatChange(value / last - 1)} on last week` : "";
  return `${LONG_DAYS[cell.d]} ${hourRange(cell.h)}: ${formatNumber(value)} ${value === 1 ? metric.one : metric.unit}${change}.`;
}

/* ── small pieces ─────────────────────────────────────────────────────────────────────────── */

/** Text that rises into place when it changes, so numbers swap without a layout jump. */
function Rising({ text, className }: { text: string; className?: string }) {
  const reduce = useReducedMotion();
  return <span className={[styles.rise, className].filter(Boolean).join(" ")}>
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={text}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: "0.3em" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: durations.instant } }}
        transition={{ duration: reduce ? durations.instant : durations.standard, ease: ENTER_EASE }}
      >
        {text}
      </motion.span>
    </AnimatePresence>
  </span>;
}

/** The week-over-week delta: arrow, percentage, and the quiet context line. */
function Delta({ change, upIsGood }: { change: number; upIsGood: boolean }) {
  const reduce = useReducedMotion();
  const good = change >= 0 === upIsGood;
  return <span className={styles.delta} data-tone={good ? "good" : "bad"}>
    <motion.span
      className={styles.deltaIcon}
      initial={false}
      animate={{ rotate: change >= 0 ? 0 : 90 }}
      transition={reduce ? { duration: 0 } : springTokens.snappy}
    >
      <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" />
    </motion.span>
    <Rising text={formatChange(change)} className={styles.deltaValue} />
    <span className={styles.deltaContext}>vs last week</span>
  </span>;
}

/** The hover card: the hour's value, its change, its share of the day, and the day's shape. */
function HoverPanel({ metric, cell }: { metric: MetricSummary; cell: TerrainCell }) {
  const index = cellIndex(cell);
  const value = metric.values[index];
  const last = metric.last[index];
  const dayValues = metric.values.slice(24 * cell.d, 24 * cell.d + 24);
  const dayMax = Math.max(1, ...dayValues);
  const change = last ? value / last - 1 : 0;
  const good = change >= 0 === metric.upIsGood;
  return <>
    <p className={styles.panelHead}><span>{LONG_DAYS[cell.d]}</span><span>{hourRange(cell.h)}</span></p>
    <p className={styles.panelValue}>{formatNumber(value)} <span>{value === 1 ? metric.one : metric.unit}</span></p>
    <dl className={styles.panelRows}>
      <div><dt>Last week</dt><dd>{formatNumber(last)}</dd></div>
      <div>
        <dt>Change</dt>
        <dd data-tone={!last || Math.abs(change) < 5e-4 ? undefined : good ? "good" : "bad"}>{last ? formatChange(change) : "New"}</dd>
      </div>
      <div><dt>Share of {SHORT_DAYS[cell.d]}</dt><dd>{(metric.days[cell.d] ? (value / metric.days[cell.d]) * 100 : 0).toFixed(1)}%</dd></div>
    </dl>
    <span className={styles.spark} aria-hidden="true">
      {dayValues.map((hourValue, hour) => <span key={hour} data-on={hour === cell.h || undefined} style={{ "--v": Math.max(0.06, hourValue / dayMax) } as CSSProperties} />)}
    </span>
  </>;
}

/** The whole week as a table, for screen readers and for anyone who cannot read the canvas. */
const WeekTable = memo(function WeekTable({ metric }: { metric: MetricSummary }) {
  return <div className={styles.srOnly}>
    <table>
      <caption>{metric.label} per hour, {RANGE_LABEL}, workspace time</caption>
      <thead>
        <tr>
          <th scope="col">Day</th>
          {HOURS.map(hour => <th key={hour} scope="col">{hourLabel(hour)}</th>)}
        </tr>
      </thead>
      <tbody>
        {DAYS.map(day => <tr key={day}>
          <th scope="row">{LONG_DAYS[day]}</th>
          {HOURS.map(hour => <td key={hour}>{formatNumber(metric.values[24 * day + hour])}</td>)}
        </tr>)}
      </tbody>
    </table>
  </div>;
});

/* ── the canvas engine ────────────────────────────────────────────────────────────────────── */

interface EngineElements { root: HTMLElement; plot: HTMLElement; canvas: HTMLCanvasElement; panel: HTMLElement }
interface EngineCallbacks {
  onHover: (cell: TerrainCell | null) => void;
  onPick: (cell: TerrainCell | null) => void;
  onMoved: (moved: boolean) => void;
}
interface EngineInput { norm: number[]; tone: number }

interface TerrainHandle {
  setValues: (norm: number[], tone: number, focus: TerrainCell | null) => void;
  setView: (top: boolean) => void;
  setFocus: (cell: TerrainCell | null) => void;
  setActive: (cell: TerrainCell | null) => void;
  orbit: (yaw: number, pitch: number) => void;
  zoom: (factor: number) => void;
  reset: () => void;
  destroy: () => void;
}

type Vec3 = [number, number, number];
type Rgb = [number, number, number];

interface Camera {
  cx: number; cy: number; cz: number;
  rx: number; rz: number;
  ux: number; uy: number; uz: number;
  fx: number; fy: number; fz: number;
  focal: number; ox: number; oy: number; dist: number;
}

interface DragState {
  id: number;
  x0: number;
  y0: number;
  yaw0: number;
  pitch0: number;
  moved: boolean;
  touch: boolean;
  caught: boolean;
  samples: { t: number; x: number; y: number }[];
}

function createEngine({ root, plot, canvas, panel }: EngineElements, callbacks: EngineCallbacks, input: EngineInput): TerrainHandle | null {
  const context = canvas.getContext("2d");
  if (!context) return null;
  const ctx = context;

  const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = reducedQuery.matches;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let narrow = false;
  let viewTop = false;
  let introDone = false;
  let visible = false;
  let movedOnce = false;
  let hover: TerrainCell | null = null;
  let focus: TerrainCell | null = null;
  let active = -1;
  let panelMeasured = false;
  let panelW = 208;
  let panelH = 150;

  const targetNorm = Float64Array.from(input.norm);
  const heightValue = new Float64Array(168);
  const heightVel = new Float64Array(168);
  const heightTarget = new Float64Array(168);
  const riseTimer = new Float64Array(168);
  const lift = new Float64Array(168);
  const liftVel = new Float64Array(168);
  const liftTarget = new Float64Array(168);
  const dim = new Float64Array(168);
  const dimVel = new Float64Array(168);
  const dimTarget = new Float64Array(168);
  let riseSpring = SPRINGS.rise;

  const restingYaw = () => (narrow ? VIEW.narrowYaw : VIEW.yaw);
  /** In top view the camera is locked to straight down; otherwise yaw spins free and pitch stays in range. */
  const yawBounds = (): readonly [number, number] | null => (viewTop ? TOP_YAW : null);
  const pitchBounds = (): readonly [number, number] | null => (viewTop ? TOP_PITCH : PITCH_RANGE);
  const springBounds = (state: Spring): readonly [number, number] | null =>
    state === yaw ? yawBounds() : state === pitch ? pitchBounds() : state === zoom ? ZOOM_RANGE : null;

  const yaw = spring(INTRO.yaw, SPRINGS.camera, 1e-4);
  const pitch = spring(INTRO.pitch, SPRINGS.camera, 1e-4);
  const zoom = spring(INTRO.zoom, SPRINGS.camera, 1e-4);
  const focusX = spring(0, SPRINGS.camera, 0.001);
  const focusY = spring(VIEW.ty, SPRINGS.camera, 0.001);
  const focusZ = spring(0, SPRINGS.camera, 0.001);
  const tilt = spring(0, SPRINGS.camera, 1e-4);
  const tone = spring(input.tone, SPRINGS.tone, 0.001);
  const panelX = spring(0, SPRINGS.panel, 0.05);
  const panelY = spring(0, SPRINGS.panel, 0.05);
  const frameScale = spring(0, SPRINGS.frame, 0.01);
  const frameX = spring(0, SPRINGS.frame, 0.05);
  const frameY = spring(0, SPRINGS.frame, 0.05);
  const allSprings = [yaw, pitch, zoom, focusX, focusY, focusZ, tilt, tone, panelX, panelY, frameScale, frameX, frameY];

  const order = Array.from({ length: 168 }, (_, index) => index);
  const distance = new Float64Array(168);
  const polys = new Float64Array(4032);
  const polyCount = new Uint8Array(168);
  const tops = new Float64Array(336);
  const corners = new Float64Array(16);
  const projected = new Float64Array(8);
  const rampTone = new Float32Array(195);
  const rampDanger = new Float32Array(195);

  let rgbSurface: Rgb = [255, 255, 255];
  let rgbForeground: Rgb = [20, 20, 20];
  let rgbMuted: Rgb = [120, 120, 120];
  let rgbFloor: Rgb = [245, 245, 245];
  let rgbBorder: Rgb = [230, 230, 230];
  let fontFamily = "sans-serif";

  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const probeCtx = probe.getContext("2d", { willReadFrequently: true });

  const readColor = (css: string, fallback: Rgb): Rgb => {
    if (!probeCtx || !css) return fallback;
    probeCtx.clearRect(0, 0, 1, 1);
    probeCtx.fillStyle = "#000";
    probeCtx.fillStyle = css;
    probeCtx.fillRect(0, 0, 1, 1);
    const data = probeCtx.getImageData(0, 0, 1, 1).data;
    return [data[0], data[1], data[2]];
  };

  /** Reads the theme's tokens once and rebuilds both ramps. */
  function readTheme() {
    const computed = getComputedStyle(root);
    const read = (name: string, fallback: Rgb) => readColor(computed.getPropertyValue(name).trim(), fallback);
    rgbSurface = read("--surface", rgbSurface);
    rgbForeground = read("--foreground", rgbForeground);
    rgbMuted = read("--text-muted", rgbMuted);
    const muted = read("--surface-muted", rgbFloor);
    const strong = read("--border-strong", rgbBorder);
    rgbBorder = read("--border", rgbBorder);
    rgbFloor = mixColor(rgbSurface, muted, 0.75);
    const low = mixColor(muted, strong, 0.5);
    fillRamp(rampTone, low, read("--accent", rgbForeground));
    fillRamp(rampDanger, low, read("--danger", [200, 60, 50]));
    fontFamily = computed.fontFamily || fontFamily;
  }

  const camera: Camera = { cx: 0, cy: 0, cz: 0, rx: 1, rz: 0, ux: 0, uy: 1, uz: 0, fx: 0, fy: 0, fz: -1, focal: 1, ox: 0, oy: 0, dist: 42 };
  let cameraReady = false;

  function project(x: number, y: number, z: number, out: Float64Array, at: number) {
    const dx = x - camera.cx;
    const dy = y - camera.cy;
    const dz = z - camera.cz;
    const depth = dx * camera.fx + dy * camera.fy + dz * camera.fz;
    const perspective = camera.focal / Math.max(depth, 0.5);
    out[at] = camera.ox + (dx * camera.rx + dz * camera.rz) * perspective;
    out[at + 1] = camera.oy - (dx * camera.ux + dy * camera.uy + dz * camera.uz) * perspective;
    return depth;
  }

  const quad = new Float64Array(8);
  const cornerDepth = new Float64Array(8);
  function traceQuad(a: Vec3, b: Vec3, c: Vec3, d: Vec3) {
    project(...a, quad, 0);
    project(...b, quad, 2);
    project(...c, quad, 4);
    project(...d, quad, 6);
    ctx.beginPath();
    ctx.moveTo(quad[0], quad[1]);
    ctx.lineTo(quad[2], quad[3]);
    ctx.lineTo(quad[4], quad[5]);
    ctx.lineTo(quad[6], quad[7]);
    ctx.closePath();
  }

  function traceLine(a: Vec3, b: Vec3) {
    project(...a, quad, 0);
    project(...b, quad, 2);
    ctx.beginPath();
    ctx.moveTo(quad[0], quad[1]);
    ctx.lineTo(quad[2], quad[3]);
  }

  /** Fits the whole grid into the canvas and refreshes the camera basis. */
  function updateCamera() {
    const topness = tilt.x;
    const sinYaw = Math.sin(yaw.x);
    const cosYaw = Math.cos(yaw.x);
    const sinPitch = Math.sin(pitch.x);
    const cosPitch = Math.cos(pitch.x);
    const dist = 42 * (1 + 2.8 * topness);
    const targetY = VIEW.ty * (1 - topness);
    const heightScale = 5.4 * (1 - 0.975 * topness);
    const targetYaw = lerp(restingYaw(), 0, topness);
    const sinTarget = Math.sin(targetYaw);
    const cosTarget = Math.cos(targetYaw);
    const eyeX = dist * sinTarget * cosPitch;
    const eyeY = targetY + dist * sinPitch;
    const eyeZ = dist * cosTarget * cosPitch;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const measure = (x: number, y: number, z: number) => {
      const dx = x - eyeX;
      const dy = y - eyeY;
      const dz = z - eyeZ;
      const depth = Math.max(0.5, -dx * sinTarget * cosPitch - dy * sinPitch - dz * cosTarget * cosPitch);
      const px = (dx * cosTarget - dz * sinTarget) / depth;
      const py = (-dx * sinTarget * sinPitch + dy * cosPitch - dz * cosTarget * sinPitch) / depth;
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    };
    for (let corner = 0; corner < 4; corner++) measure((1 & corner ? 1 : -1) * 13.3, 0, (2 & corner ? 1 : -1) * 4.7);
    for (let index = 0; index < 168; index++) measure(gridX(HOUR_OF_CELL[index]), Math.max(heightTarget[index], 0) * heightScale, gridZ(DAY_OF_CELL[index]));

    const fit = Math.max(1, Math.min((width - 2 * (narrow ? 18 : 26)) / (maxX - minX), (height - 36) / (maxY - minY)));
    const offsetX = width / 2 - (fit * (minX + maxX)) / 2;
    const offsetY = height / 2 + (fit * (minY + maxY)) / 2;
    if (!cameraReady || reduced) {
      retarget(frameScale, fit, SPRINGS.frame, true);
      retarget(frameX, offsetX, SPRINGS.frame, true);
      retarget(frameY, offsetY, SPRINGS.frame, true);
      cameraReady = true;
    } else if (Math.abs(frameScale.to - fit) > 0.01 || Math.abs(frameX.to - offsetX) > 0.05 || Math.abs(frameY.to - offsetY) > 0.05) {
      frameScale.to = fit;
      frameX.to = offsetX;
      frameY.to = offsetY;
      schedule();
    }
    Object.assign(camera, {
      cx: focusX.x + dist * sinYaw * cosPitch,
      cy: focusY.x * (1 - topness) + dist * sinPitch,
      cz: focusZ.x + dist * cosYaw * cosPitch,
      rx: cosYaw,
      rz: -sinYaw,
      ux: -sinYaw * sinPitch,
      uy: cosPitch,
      uz: -cosYaw * sinPitch,
      fx: -sinYaw * cosPitch,
      fy: -sinPitch,
      fz: -cosYaw * cosPitch,
      focal: frameScale.x * zoom.x,
      ox: frameX.x,
      oy: frameY.x,
      dist,
    });
  }

  function drawColumn(index: number, topness: number, toneMix: number, hovered: TerrainCell | null) {
    const day = DAY_OF_CELL[index];
    const hour = HOUR_OF_CELL[index];
    const x = gridX(hour);
    const z = gridZ(day);
    const flatten = smoothstep(0, 1, (topness - 0.3 * STAGGER[index]) / 0.7);
    const normalized = clamp(heightValue[index], 0, 1.25);
    const columnHeight = Math.max(0.035, 5.4 * normalized * (1 - 0.975 * flatten));
    const base = lift[index];
    const top = base + columnHeight;
    const x0 = x - 0.4;
    const x1 = x + 0.4;
    const z0 = z - 0.4;
    const z1 = z + 0.4;

    for (let corner = 0; corner < 8; corner++) {
      cornerDepth[corner] = project(1 & corner ? x1 : x0, 2 & corner ? top : base, 4 & corner ? z1 : z0, corners, 2 * corner);
    }

    if (base > 0.005) {
      ctx.fillStyle = rgba(...rgbForeground, 0.1 * clamp(base / 0.42, 0, 1));
      traceQuad([x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]);
      ctx.fill();
    }

    const rampPosition = 64 * clamp(normalized, 0, 1);
    const lowStop = Math.floor(rampPosition);
    const highStop = Math.min(64, lowStop + 1);
    const blend = rampPosition - lowStop;
    const cellColor: Rgb = [0, 0, 0];
    for (let channel = 0; channel < 3; channel++) {
      const a = lerp(rampTone[3 * lowStop + channel], rampTone[3 * highStop + channel], blend);
      const b = lerp(rampDanger[3 * lowStop + channel], rampDanger[3 * highStop + channel], blend);
      cellColor[channel] = lerp(a, b, toneMix);
    }

    // Columns close to the camera fade toward the surface, so the front row never looks like a wall.
    const nearFade = 0.2 * clamp(((cornerDepth[0] + cornerDepth[3]) / 2 - (camera.dist - 6)) / 34, 0, 1);
    const fade = 0.72 * clamp(dim[index], 0, 1) + nearFade;
    let faceCount = 0;
    const paintFace = (a: number, b: number, c: number, d: number, shade: number) => {
      const color = rgba(
        lerp(cellColor[0] * (1 - shade), rgbSurface[0], fade),
        lerp(cellColor[1] * (1 - shade), rgbSurface[1], fade),
        lerp(cellColor[2] * (1 - shade), rgbSurface[2], fade),
      );
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(corners[2 * a], corners[2 * a + 1]);
      ctx.lineTo(corners[2 * b], corners[2 * b + 1]);
      ctx.lineTo(corners[2 * c], corners[2 * c + 1]);
      ctx.lineTo(corners[2 * d], corners[2 * d + 1]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      const at = 24 * index + 8 * faceCount;
      polys[at] = corners[2 * a];
      polys[at + 1] = corners[2 * a + 1];
      polys[at + 2] = corners[2 * b];
      polys[at + 3] = corners[2 * b + 1];
      polys[at + 4] = corners[2 * c];
      polys[at + 5] = corners[2 * c + 1];
      polys[at + 6] = corners[2 * d];
      polys[at + 7] = corners[2 * d + 1];
      faceCount++;
    };

    ctx.lineWidth = 0.6;
    ctx.lineJoin = "round";
    if (camera.cx < x0) paintFace(0, 2, 6, 4, 0.24 - 0.2 * 0.52);
    else if (camera.cx > x1) paintFace(1, 3, 7, 5, 0.344);
    if (camera.cz < z0) paintFace(0, 1, 3, 2, 0.324);
    else if (camera.cz > z1) paintFace(4, 5, 7, 6, 0.24 - 0.084);
    if (camera.cy > top) paintFace(2, 3, 7, 6, 0);
    polyCount[index] = faceCount;
    project(x, top, z, tops, 2 * index);

    if (hovered && hovered.d === day && hovered.h === hour) {
      focusOutline.set([corners[4], corners[5], corners[6], corners[7], corners[14], corners[15], corners[12], corners[13]]);
      strokeOutline(0.9, false);
    }
  }

  const focusOutline = new Float64Array(8);

  function strokeOutline(alpha: number, dashed: boolean) {
    ctx.strokeStyle = rgba(...rgbForeground, alpha);
    ctx.lineWidth = 1.25;
    ctx.setLineDash(dashed ? [3, 3] : []);
    ctx.beginPath();
    ctx.moveTo(focusOutline[0], focusOutline[1]);
    ctx.lineTo(focusOutline[2], focusOutline[3]);
    ctx.lineTo(focusOutline[4], focusOutline[5]);
    ctx.lineTo(focusOutline[6], focusOutline[7]);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawLabel(text: string, x: number, y: number, z: number, alpha: number, highlighted: boolean) {
    if (alpha < 0.02) return;
    project(x, y, z, quad, 0);
    const px = quad[0];
    const py = quad[1];
    if (highlighted) {
      ctx.font = `500 11px ${fontFamily}`;
      const textWidth = ctx.measureText(text).width;
      ctx.fillStyle = rgba(...rgbForeground, alpha);
      ctx.beginPath();
      ctx.roundRect(px - textWidth / 2 - 7, py - 10, textWidth + 14, 20, 10);
      ctx.fill();
      ctx.fillStyle = rgba(...rgbSurface, alpha);
    } else {
      ctx.font = `400 11px ${fontFamily}`;
      ctx.fillStyle = rgba(...rgbMuted, alpha);
    }
    ctx.fillText(text, px, py + 0.5);
  }

  /** Picks the label step that still fits, or 0 when nothing fits. */
  function labelStep(span: number, minPx: number, charPx: number, steps: number[]) {
    const dx = (quad[2] - quad[0]) / span;
    const dy = (quad[3] - quad[1]) / span;
    const length = Math.hypot(dx, dy) || 1e-6;
    const needed = (Math.abs(dx) / length) * minPx + (Math.abs(dy) / length) * charPx + 6;
    return steps.find(step => length * step >= needed) ?? 0;
  }

  function drawAxes(topness: number, hovered: TerrainCell | null) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const yawAlpha = smoothstep(0.15, 0.45, Math.sin(yaw.x));
    for (const [side, alpha] of [[-1, 1 - yawAlpha], [1, yawAlpha]] as [number, number][]) {
      if (alpha < 0.02) continue;
      const x = 13.25 * side;
      project(x, 0, gridZ(0), quad, 0);
      project(x, 0, gridZ(6), quad, 2);
      const step = labelStep(6, 24, 13, [1, 2, 3]) || 6;
      for (let day = 0; day < 7; day++) {
        const isActive = hovered?.d === day;
        if (!isActive && (day % step || (hovered && step > 1 && Math.abs(day - hovered.d) < step))) continue;
        drawLabel(SHORT_DAYS[day], x, 0, gridZ(day), alpha, isActive);
      }
    }
    const pitchAlpha = smoothstep(-0.15, -0.45, Math.cos(yaw.x));
    for (const [side, alpha] of [[-1, pitchAlpha], [1, 1 - pitchAlpha]] as [number, number][]) {
      if (alpha < 0.02) continue;
      const z = 4.55 * side;
      project(gridX(0), 0, z, quad, 0);
      project(gridX(23), 0, z, quad, 2);
      const wide = labelStep(23, 34, 13, [3]) > 0;
      const step = labelStep(23, wide ? 34 : 17, 13, [3, 6, 12]) || 12;
      for (let hour = 0; hour < 24; hour++) {
        const isActive = hovered?.h === hour;
        if (!isActive && (hour % step || (hovered && Math.abs(hour - hovered.h) < 0.67 * step))) continue;
        drawLabel(wide || isActive ? hourLabel(hour) : String(hour).padStart(2, "0"), gridX(hour), 0, z, alpha, isActive);
      }
    }
  }

  function placePanel(hovered: TerrainCell | null) {
    if (!hovered) {
      panelMeasured = false;
      return;
    }
    const index = cellIndex(hovered);
    const anchorX = tops[2 * index];
    const anchorY = tops[2 * index + 1];
    let x = anchorX + 22;
    if (x + panelW > width - 8) x = anchorX - 22 - panelW;
    x = clamp(x, 8, Math.max(8, width - panelW - 8));
    let y = anchorY - panelH - 16;
    if (y < 8) y = anchorY - 0.45 * panelH;
    y = clamp(y, 8, Math.max(8, height - panelH - 8));
    panelX.to = x;
    panelY.to = y;
    if (!panelMeasured || reduced) {
      panelX.x = x;
      panelY.x = y;
      panelX.v = panelY.v = 0;
      panelMeasured = true;
    } else if (Math.abs(panelX.x - x) > 0.05 || Math.abs(panelY.x - y) > 0.05) {
      schedule();
    }
    panel.style.transform = `translate3d(${panelX.x.toFixed(2)}px, ${panelY.x.toFixed(2)}px, 0)`;
  }

  function draw() {
    if (!width || !height) return;
    updateCamera();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const topness = tilt.x;
    const hovered = hover ?? focus;
    const sinYaw = Math.sin(yaw.x);
    const cosYaw = Math.cos(yaw.x);
    const sideX = smoothstep(0.15, 0.45, sinYaw) > 0.5 ? 1 : -1;
    const sideZ = smoothstep(-0.15, -0.45, cosYaw) > 0.5 ? -1 : 1;

    ctx.fillStyle = rgba(...rgbFloor);
    traceQuad([-12.3, 0, -3.8], [12.3, 0, -3.8], [12.3, 0, 3.8], [-12.3, 0, 3.8]);
    ctx.fill();

    if (hovered) {
      const x = gridX(hovered.h);
      const z = gridZ(hovered.d);
      const toX = 12.55 * sideX;
      const toZ = 4.05 * sideZ;
      ctx.fillStyle = rgba(...rgbForeground, 0.05);
      traceQuad([Math.min(x, toX), 0, z - 0.5], [Math.max(x, toX), 0, z - 0.5], [Math.max(x, toX), 0, z + 0.5], [Math.min(x, toX), 0, z + 0.5]);
      ctx.fill();
      traceQuad([x - 0.5, 0, Math.min(z, toZ)], [x + 0.5, 0, Math.min(z, toZ)], [x + 0.5, 0, Math.max(z, toZ)], [x - 0.5, 0, Math.max(z, toZ)]);
      ctx.fill();
      ctx.strokeStyle = rgba(...rgbForeground, 0.55);
      ctx.lineWidth = 1;
      traceLine([x, 0, z], [toX, 0, z]);
      ctx.stroke();
      traceLine([x, 0, z], [x, 0, toZ]);
      ctx.stroke();
    }

    for (let index = 0; index < 168; index++) {
      distance[index] = (gridX(HOUR_OF_CELL[index]) - camera.cx) ** 2 + (gridZ(DAY_OF_CELL[index]) - camera.cz) ** 2;
    }
    order.sort((a, b) => distance[b] - distance[a]);

    const toneMix = clamp(tone.x, 0, 1);
    for (const index of order) drawColumn(index, topness, toneMix, hovered);
    if (hovered) strokeOutline(0.5, true);
    drawAxes(topness, hovered);
    placePanel(hovered);
  }

  /* ── loop ── */

  let rafId = 0;
  let lastTime = 0;

  function step(time: number) {
    rafId = 0;
    const delta = Math.min(0.05, Math.max(0, (time - lastTime) / 1000));
    lastTime = time;
    let moving = !!drag || !!pinch;
    for (let index = 0; index < 168; index++) {
      if (riseTimer[index] > 0) {
        riseTimer[index] -= delta;
        moving = true;
      }
    }
    const substeps = Math.max(1, Math.ceil(delta / STEP));
    const dt = delta / substeps;
    for (let sub = 0; sub < substeps; sub++) {
      for (const state of allSprings) {
        if (state.mode === "spring") {
          state.v += (-state.cfg.k * (state.x - state.to) - state.cfg.c * state.v) * dt;
          state.x += state.v * dt;
        } else if (state.mode === "coast") {
          state.x += state.v * dt;
          state.v *= Math.exp(-3.2 * dt);
        }
        const bounds = state.mode === "coast" ? springBounds(state) : null;
        if (bounds && (state.x < bounds[0] || state.x > bounds[1])) {
          state.mode = "spring";
          state.to = clamp(state.x, bounds[0], bounds[1]);
          state.cfg = SPRINGS.back;
        }
      }
      for (let index = 0; index < 168; index++) {
        if (riseTimer[index] <= 0) {
          heightVel[index] += (-riseSpring.k * (heightValue[index] - heightTarget[index]) - riseSpring.c * heightVel[index]) * dt;
          heightValue[index] += heightVel[index] * dt;
        }
        liftVel[index] += (-SPRINGS.lift.k * (lift[index] - liftTarget[index]) - SPRINGS.lift.c * liftVel[index]) * dt;
        lift[index] += liftVel[index] * dt;
        dimVel[index] += (-SPRINGS.dim.k * (dim[index] - dimTarget[index]) - SPRINGS.dim.c * dimVel[index]) * dt;
        dim[index] += dimVel[index] * dt;
      }
    }
    for (const state of allSprings) {
      if (state.mode === "held") continue;
      if (state.mode === "coast") {
        if (Math.abs(state.v) < 0.01) {
          state.mode = "spring";
          state.to = state.x;
          state.v = 0;
        } else moving = true;
        continue;
      }
      if (Math.abs(state.x - state.to) < state.eps && Math.abs(state.v) < 10 * state.eps) {
        state.x = state.to;
        state.v = 0;
      } else moving = true;
    }
    for (let index = 0; index < 168; index++) {
      if (Math.abs(heightValue[index] - heightTarget[index]) < 1e-4 && Math.abs(heightVel[index]) < 0.001) {
        heightValue[index] = heightTarget[index];
        heightVel[index] = 0;
      } else moving = true;
      if (Math.abs(lift[index] - liftTarget[index]) < 1e-4 && Math.abs(liftVel[index]) < 0.001) {
        lift[index] = liftTarget[index];
        liftVel[index] = 0;
      } else moving = true;
      if (Math.abs(dim[index] - dimTarget[index]) < 1e-4 && Math.abs(dimVel[index]) < 0.001) {
        dim[index] = dimTarget[index];
        dimVel[index] = 0;
      } else moving = true;
    }
    draw();
    if (moving && !rafId && visible && !document.hidden) rafId = requestAnimationFrame(step);
  }

  function schedule() {
    if (rafId || !visible || document.hidden) return;
    lastTime = performance.now();
    rafId = requestAnimationFrame(step);
  }

  /** Dims every column that is not the hovered or focused one. */
  function syncDim() {
    const cell = hover ?? focus;
    for (let index = 0; index < 168; index++) {
      const day = DAY_OF_CELL[index];
      const hour = HOUR_OF_CELL[index];
      const isActive = !!cell && day === cell.d && hour === cell.h;
      dimTarget[index] = cell && day !== cell.d && hour !== cell.h ? (hover ? 0.36 : 0.5) : 0;
      liftTarget[index] = 0.42 * +(!!isActive);
      if (reduced) {
        dim[index] = dimTarget[index];
        lift[index] = liftTarget[index];
        dimVel[index] = liftVel[index] = 0;
      }
    }
    schedule();
  }

  function markMoved() {
    if (movedOnce) return;
    movedOnce = true;
    callbacks.onMoved(true);
  }

  /** Plays the one-time entrance: heights rise in a wave and the camera tips into place. */
  function ensureIntro() {
    if (introDone) return;
    introDone = true;
    riseSpring = SPRINGS.rise;
    for (let index = 0; index < 168; index++) {
      heightTarget[index] = targetNorm[index];
      if (reduced) {
        heightValue[index] = targetNorm[index];
        riseTimer[index] = 0;
      } else riseTimer[index] = 0.8 * STAGGER[index];
    }
    const cfg = reduced ? SPRINGS.camera : SPRINGS.intro;
    if (!viewTop) {
      retarget(yaw, restingYaw(), cfg, reduced);
      retarget(pitch, VIEW.pitch, cfg, reduced);
    }
    if (!focus) retarget(zoom, 1, cfg, reduced);
    schedule();
  }

  /* ── pointers ── */

  let drag: DragState | null = null;
  let pinch: { d0: number; z0: number } | null = null;
  const pointers = new Map<number, { x: number; y: number }>();
  const localPoint = (event: PointerEvent) => {
    const rect = plot.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const radiansPerPixel = () => (1.1 * Math.PI) / Math.max(360, width);

  /** Nearest column under the pointer, by testing the drawn faces front to back. */
  function hitTest(x: number, y: number) {
    for (let slot = 167; slot >= 0; slot--) {
      const index = order[slot];
      for (let face = 0; face < polyCount[index]; face++) {
        const at = 24 * index + 8 * face;
        let positive = 0;
        let negative = 0;
        for (let point = 0; point < 4; point++) {
          const px = polys[at + 2 * point];
          const py = polys[at + 2 * point + 1];
          const cross = (polys[at + ((point + 1) % 4) * 2] - px) * (y - py) - (polys[at + ((point + 1) % 4) * 2 + 1] - py) * (x - px);
          if (cross > 0) positive++;
          else if (cross < 0) negative++;
        }
        if (!positive || !negative) return index;
      }
    }
    return -1;
  }

  function setHoverIndex(index: number) {
    if (index === active) return;
    active = index;
    hover = index < 0 ? null : splitIndex(index);
    plot.toggleAttribute("data-over", index >= 0);
    syncDim();
    callbacks.onHover(hover);
  }

  /** Hands the camera a velocity: coast inside the range, bounce off its edges. */
  function release(state: Spring, velocity: number) {
    const bounds = springBounds(state) ?? [-Infinity, Infinity];
    const v = reduced ? 0 : clamp(velocity, -14, 14);
    if (state.x < bounds[0] || state.x > bounds[1]) {
      state.mode = "spring";
      state.to = clamp(state.x, bounds[0], bounds[1]);
      state.cfg = SPRINGS.back;
      state.v = v;
      if (reduced) {
        state.x = state.to;
        state.v = 0;
      }
    } else if (Math.abs(v) > 0.05) {
      state.mode = "coast";
      state.v = v;
    } else {
      state.mode = "spring";
      state.to = state.x;
      state.v = 0;
    }
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const point = localPoint(event);
    pointers.set(event.pointerId, point);
    try {
      plot.setPointerCapture(event.pointerId);
    } catch {
      // The pointer is already gone; the drag simply does not start.
    }
    ensureIntro();
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: zoom.x };
      drag = null;
      plot.removeAttribute("data-dragging");
      return;
    }
    if (pointers.size > 2) return;
    const catching = yaw.mode === "coast" || pitch.mode === "coast";
    if (catching) {
      yaw.mode = pitch.mode = "held";
      yaw.v = pitch.v = 0;
      yaw.to = yaw.x;
      pitch.to = pitch.x;
    }
    drag = {
      id: event.pointerId,
      x0: point.x,
      y0: point.y,
      yaw0: yaw.x,
      pitch0: pitch.x,
      moved: false,
      touch: event.pointerType === "touch",
      caught: catching,
      samples: [{ t: event.timeStamp, ...point }],
    };
  }

  function onPointerMove(event: PointerEvent) {
    const point = localPoint(event);
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, point);
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      zoom.mode = "held";
      zoom.v = 0;
      zoom.x = zoom.to = rubber((pinch.z0 * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d0, ZOOM_RANGE, 0.5);
      markMoved();
      schedule();
      return;
    }
    if (drag && drag.id === event.pointerId) {
      if (!drag.moved && Math.hypot(point.x - drag.x0, point.y - drag.y0) > (drag.touch ? 8 : 4)) {
        Object.assign(drag, { moved: true, x0: point.x, y0: point.y, yaw0: yaw.x, pitch0: pitch.x });
        setHoverIndex(-1);
        plot.setAttribute("data-dragging", "");
      }
      if (!drag.moved) return;
      yaw.mode = "held";
      yaw.v = 0;
      yaw.x = yaw.to = rubber(drag.yaw0 - (point.x - drag.x0) * radiansPerPixel(), yawBounds() ?? YAW_FREE, 0.5);
      if (!drag.touch) {
        pitch.mode = "held";
        pitch.v = 0;
        pitch.x = pitch.to = rubber(drag.pitch0 + (point.y - drag.y0) * 0.0055, pitchBounds() ?? PITCH_RANGE, 0.4);
      }
      drag.samples.push({ t: event.timeStamp, x: point.x, y: point.y });
      while (drag.samples.length > 2 && event.timeStamp - drag.samples[0].t > 100) drag.samples.shift();
      if (!viewTop) markMoved();
      schedule();
      return;
    }
    if (event.pointerType !== "mouse" || pointers.size) return;
    setHoverIndex(hitTest(point.x, point.y));
  }

  function onPointerUp(event: PointerEvent) {
    const point = localPoint(event);
    const cancelled = event.type === "pointercancel";
    pointers.delete(event.pointerId);
    if (pinch) {
      if (pointers.size < 2) {
        pinch = null;
        retarget(zoom, clamp(zoom.x, ...ZOOM_RANGE), SPRINGS.back, reduced);
        schedule();
      }
      drag = null;
      return;
    }
    if (!drag || drag.id !== event.pointerId) return;
    const state = drag;
    drag = null;
    plot.removeAttribute("data-dragging");
    if (state.moved) {
      const samples = state.samples;
      const first = samples[0];
      const last = samples[samples.length - 1];
      const seconds = (last.t - first.t) / 1000;
      const flick = seconds > 0.005 && event.timeStamp - last.t < 60;
      release(yaw, flick ? (-(last.x - first.x) / seconds) * radiansPerPixel() : 0);
      release(pitch, flick && !state.touch ? ((last.y - first.y) / seconds) * 0.0055 : 0);
    } else {
      if (state.caught) {
        release(yaw, 0);
        release(pitch, 0);
      }
      if (!cancelled) {
        const index = hitTest(point.x, point.y);
        if (event.pointerType === "mouse") setHoverIndex(index);
        callbacks.onPick(index < 0 ? null : splitIndex(index));
      }
    }
    schedule();
  }

  function onPointerLeave(event: PointerEvent) {
    if (event.pointerType !== "mouse" || drag) return;
    setHoverIndex(-1);
  }

  function onWheel(event: WheelEvent) {
    if (!event.ctrlKey && document.activeElement !== plot) return;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : 1);
    const next = clamp(zoom.to * Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.0018)), ...ZOOM_RANGE);
    if (!event.ctrlKey && Math.abs(next - zoom.to) < 1e-4) return;
    event.preventDefault();
    ensureIntro();
    retarget(zoom, next, SPRINGS.zoom, reduced);
    markMoved();
    schedule();
  }

  /* ── observers ── */

  const resizePlot = new ResizeObserver(() => {
    const rect = plot.getBoundingClientRect();
    const wasNarrow = narrow;
    width = rect.width;
    height = rect.height;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    narrow = width < 560;
    if (narrow !== wasNarrow && introDone && !movedOnce && !viewTop) retarget(yaw, restingYaw(), SPRINGS.camera, reduced);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    cameraReady = false;
    draw();
  });

  const resizePanel = new ResizeObserver(() => {
    panelW = panel.offsetWidth || panelW;
    panelH = panel.offsetHeight || panelH;
  });

  const visibility = new IntersectionObserver(entries => {
    const [entry] = entries;
    visible = entry.isIntersecting;
    if (visible && entry.intersectionRatio >= 0.3) ensureIntro();
    if (visible) schedule();
  }, { threshold: [0, 0.3, 0.6] });

  const themeWatch = new MutationObserver(() => {
    readTheme();
    draw();
  });

  const schemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const onScheme = () => {
    readTheme();
    draw();
  };
  const onReduced = () => {
    reduced = reducedQuery.matches;
    if (reduced) {
      ensureIntro();
      syncDim();
    }
  };
  const onDocumentVisibility = () => {
    if (!document.hidden) schedule();
  };

  readTheme();
  resizePlot.observe(plot);
  resizePanel.observe(panel);
  visibility.observe(plot);
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-accent", "class", "style"] });
  schemeQuery.addEventListener("change", onScheme);
  reducedQuery.addEventListener("change", onReduced);
  document.addEventListener("visibilitychange", onDocumentVisibility);
  void document.fonts?.ready.then(() => draw());
  plot.addEventListener("pointerdown", onPointerDown);
  plot.addEventListener("pointermove", onPointerMove);
  plot.addEventListener("pointerup", onPointerUp);
  plot.addEventListener("pointercancel", onPointerUp);
  plot.addEventListener("pointerleave", onPointerLeave);
  plot.addEventListener("wheel", onWheel, { passive: false });

  if (reduced) {
    yaw.x = yaw.to = restingYaw();
    pitch.x = pitch.to = VIEW.pitch;
    zoom.x = zoom.to = 1;
    ensureIntro();
  }

  return {
    setValues(norm, toneValue, nextFocus) {
      targetNorm.set(norm);
      retarget(tone, toneValue, SPRINGS.tone, reduced);
      if (focus) retarget(focusY, Math.max(VIEW.ty, 5.4 * targetNorm[cellIndex(focus)] * 0.5), SPRINGS.camera, reduced);
      if (!introDone) {
        ensureIntro();
        return;
      }
      riseSpring = SPRINGS.morph;
      const reach = Math.hypot(23, 6);
      for (let index = 0; index < 168; index++) {
        const settling = Math.abs(heightVel[index]) > 0.02;
        heightTarget[index] = targetNorm[index];
        if (reduced) {
          heightValue[index] = targetNorm[index];
          heightVel[index] = 0;
          riseTimer[index] = 0;
          continue;
        }
        riseTimer[index] = settling ? 0 : nextFocus
          ? (Math.hypot(HOUR_OF_CELL[index] - nextFocus.h, DAY_OF_CELL[index] - nextFocus.d) / reach) * 0.36
          : 0.32 * STAGGER[index];
      }
      schedule();
    },
    setView(top) {
      viewTop = top;
      ensureIntro();
      yaw.x = wrapAngle(yaw.x);
      yaw.to = wrapAngle(yaw.to);
      retarget(tilt, +!!top, SPRINGS.camera, reduced);
      retarget(yaw, top ? 0 : restingYaw(), SPRINGS.camera, reduced);
      retarget(pitch, top ? TOP_PITCH[0] : VIEW.pitch, SPRINGS.camera, reduced);
      if (!focus) retarget(zoom, 1, SPRINGS.camera, reduced);
      schedule();
    },
    setFocus(cell) {
      focus = cell;
      ensureIntro();
      if (cell) {
        retarget(focusX, gridX(cell.h), SPRINGS.camera, reduced);
        retarget(focusZ, gridZ(cell.d), SPRINGS.camera, reduced);
        retarget(focusY, Math.max(VIEW.ty, 5.4 * targetNorm[cellIndex(cell)] * 0.5), SPRINGS.camera, reduced);
        retarget(zoom, clamp(Math.max(zoom.to, narrow ? 1.8 : 1.5), ...ZOOM_RANGE), SPRINGS.camera, reduced);
      } else {
        retarget(focusX, 0, SPRINGS.camera, reduced);
        retarget(focusZ, 0, SPRINGS.camera, reduced);
        retarget(focusY, VIEW.ty, SPRINGS.camera, reduced);
        retarget(zoom, 1, SPRINGS.camera, reduced);
      }
      syncDim();
    },
    setActive(cell) {
      active = cell ? cellIndex(cell) : -1;
      hover = cell;
      syncDim();
    },
    orbit(deltaYaw, deltaPitch) {
      if (viewTop) return;
      ensureIntro();
      retarget(yaw, yaw.to + deltaYaw, SPRINGS.camera, reduced);
      retarget(pitch, clamp(pitch.to + deltaPitch, ...PITCH_RANGE), SPRINGS.camera, reduced);
      markMoved();
      schedule();
    },
    zoom(factor) {
      ensureIntro();
      retarget(zoom, clamp(zoom.to * factor, ...ZOOM_RANGE), SPRINGS.zoom, reduced);
      markMoved();
      schedule();
    },
    reset() {
      yaw.x = wrapAngle(yaw.x);
      retarget(yaw, viewTop ? 0 : restingYaw(), SPRINGS.camera, reduced);
      retarget(pitch, viewTop ? TOP_PITCH[0] : VIEW.pitch, SPRINGS.camera, reduced);
      retarget(zoom, 1, SPRINGS.camera, reduced);
      movedOnce = false;
      callbacks.onMoved(false);
      schedule();
    },
    destroy() {
      cancelAnimationFrame(rafId);
      resizePlot.disconnect();
      resizePanel.disconnect();
      visibility.disconnect();
      themeWatch.disconnect();
      schemeQuery.removeEventListener("change", onScheme);
      reducedQuery.removeEventListener("change", onReduced);
      document.removeEventListener("visibilitychange", onDocumentVisibility);
      plot.removeEventListener("pointerdown", onPointerDown);
      plot.removeEventListener("pointermove", onPointerMove);
      plot.removeEventListener("pointerup", onPointerUp);
      plot.removeEventListener("pointercancel", onPointerUp);
      plot.removeEventListener("pointerleave", onPointerLeave);
      plot.removeEventListener("wheel", onWheel);
    },
  };
}

/* ── the block ────────────────────────────────────────────────────────────────────────────── */

/**
 * A 3D terrain of hourly activity across a week that you can orbit, zoom, fly into and flatten to a
 * top view. It draws on a canvas, keeps a hidden table of every cell for screen readers, and follows
 * the theme, reduced motion and the container width. Takes no props: the week is sample data.
 */
export function ActivityTerrain() {
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const titleId = `${rawId}-title`;
  const hintId = `${rawId}-hint`;
  const [metricKey, setMetricKey] = useState<MetricKey>("sessions");
  const [view, setView] = useState<"perspective" | "top">("perspective");
  const [hover, setHover] = useState<TerrainCell | null>(null);
  const [focus, setFocus] = useState<TerrainCell | null>(null);
  const [lastCell, setLastCell] = useState<TerrainCell | null>(null);
  const [moved, setMoved] = useState(false);
  const [status, setStatus] = useState("");
  const metric = METRICS[metricKey];
  const rootRef = useRef<HTMLElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const engine = useRef<TerrainHandle | null>(null);

  const toggleFocus = (cell: TerrainCell | null) => {
    const next = cell && sameCell(cell, focus) ? null : cell;
    setFocus(next);
    engine.current?.setFocus(next);
    if (next) {
      setLastCell(next);
      setStatus(`Focused on ${cellSentence(metric, next)}`);
    } else if (focus) setStatus("Returned to the whole week.");
  };

  const handlers = useRef({ onPick: toggleFocus });
  useEffect(() => {
    handlers.current.onPick = toggleFocus;
  });

  const setActive = (cell: TerrainCell | null) => {
    setHover(cell);
    if (cell) setLastCell(cell);
    engine.current?.setActive(cell);
  };

  useEffect(() => {
    const root = rootRef.current;
    const plot = plotRef.current;
    const canvas = canvasRef.current;
    const panel = panelRef.current;
    if (!root || !plot || !canvas || !panel) return;
    const handle = createEngine(
      { root, plot, canvas, panel },
      { onHover: setActive, onPick: cell => handlers.current.onPick(cell), onMoved: setMoved },
      { norm: METRICS.sessions.norm, tone: METRICS.sessions.tone },
    );
    engine.current = handle;
    return () => {
      handle?.destroy();
      engine.current = null;
    };
  }, []);

  const cell = hover ?? focus;
  const peak = metric.top[0];
  const canvasLabel = `3D bar chart of ${metric.unit} by day and hour for ${RANGE_LABEL}. ${formatNumber(metric.total)} ${metric.unit} in total, ${formatChange(metric.change)} on last week. Peak on ${LONG_DAYS[peak.d]} at ${hourLabel(peak.h)} with ${formatNumber(peak.value)}. ${LONG_DAYS[metric.busiest]} is the busiest day. Every value is listed in the table that follows.`;

  const metricOptions = useMemo(() => METRIC_OPTIONS, []);

  return <section ref={rootRef} className={styles.root} aria-labelledby={titleId} data-metric={metricKey}>
    <div className={styles.inner}>
      <header className={styles.header}>
        <h2 id={titleId}>The shape of your week</h2>
        <p>Hourly sessions, deploys and errors for {RANGE_LABEL}, in workspace time.</p>
      </header>

      <div className={styles.toolbar}>
        <SegmentedControl
          label="Metric"
          options={metricOptions}
          value={metricKey}
          onValueChange={value => {
            if (value === metricKey) return;
            const next = METRICS[value as MetricKey];
            setMetricKey(value as MetricKey);
            engine.current?.setValues(next.norm, next.tone, focus);
            const top = next.top[0];
            setStatus(`Showing ${next.unit}. ${formatNumber(next.total)} this week, ${formatChange(next.change)} on last week. Peak ${LONG_DAYS[top.d]} at ${hourLabel(top.h)} with ${formatNumber(top.value)}.`);
          }}
        />
        <SegmentedControl
          label="Camera"
          options={VIEW_OPTIONS}
          value={view}
          onValueChange={value => {
            if (value === view) return;
            setView(value as "perspective" | "top");
            engine.current?.setView(value === "top");
            setStatus(value === "top" ? "Top view: a flat heatmap of the week." : "Perspective: bar heights show activity.");
          }}
        />
      </div>

      <div className={styles.body}>
        <div className={styles.stage}>
          <div className={styles.viewport}>
            <div
              ref={plotRef}
              className={styles.plot}
              tabIndex={0}
              role="group"
              aria-label={`${metric.label} terrain`}
              aria-describedby={hintId}
              onKeyDown={event => {
                const handle = engine.current;
                if (!handle) return;
                const steps: Record<string, [number, number]> = {
                  ArrowUp: [-1, 0],
                  ArrowDown: [1, 0],
                  ArrowLeft: [0, -1],
                  ArrowRight: [0, 1],
                };
                if (event.key === "Escape") {
                  if (focus) toggleFocus(null);
                  else {
                    if (!hover) return;
                    setActive(null);
                    setStatus("");
                  }
                  event.preventDefault();
                  return;
                }
                if (event.key === "+" || event.key === "=" || event.key === "-" || event.key === "_") {
                  event.preventDefault();
                  handle.zoom(event.key === "+" || event.key === "=" ? 1.25 : 0.8);
                  return;
                }
                if (event.key === "Enter" || event.key === " ") {
                  const target = hover ?? focus;
                  if (!target) return;
                  event.preventDefault();
                  toggleFocus(target);
                  return;
                }
                if (event.shiftKey && event.key in steps) {
                  event.preventDefault();
                  const [dayStep, hourStep] = steps[event.key];
                  handle.orbit(-(15 * hourStep) * DEG, -(8 * dayStep) * DEG);
                  return;
                }
                if (!(event.key in steps) && event.key !== "Home" && event.key !== "End") return;
                event.preventDefault();
                let cursor = hover ?? focus;
                let next: TerrainCell = metric.top[0];
                if (cursor) {
                  const [dayStep, hourStep] = steps[event.key] ?? [0, 0];
                  next = {
                    d: clamp(cursor.d + dayStep, 0, 6),
                    h: event.key === "Home" ? 0 : event.key === "End" ? 23 : clamp(cursor.h + hourStep, 0, 23),
                  };
                } else next = { d: next.d, h: next.h };
                setActive(next);
                setStatus(cellSentence(metric, next));
              }}
              onFocus={event => {
                if (hover || focus || !event.currentTarget.matches(":focus-visible")) return;
                const first = { d: metric.top[0].d, h: metric.top[0].h };
                setActive(first);
                setStatus(cellSentence(metric, first));
              }}
              onBlur={() => {
                if (hover) setActive(null);
              }}
            >
              <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={canvasLabel} />
              <div ref={panelRef} className={styles.panel} data-show={cell ? "" : undefined} aria-hidden="true">
                {lastCell && <HoverPanel metric={metric} cell={lastCell} />}
              </div>
            </div>
            <button
              type="button"
              className={styles.reset}
              onClick={() => {
                engine.current?.reset();
                toggleFocus(null);
                setMoved(false);
              }}
              data-hidden={moved || focus ? undefined : ""}
              aria-hidden={!moved && !focus ? true : undefined}
              tabIndex={moved || focus ? undefined : -1}
            >
              <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
              Reset view
            </button>
          </div>
          <div className={styles.legend}>
            <span className={styles.scale} aria-hidden="true">
              Fewer
              <span className={styles.ramp}>
                {[0, 1, 2, 3, 4, 5].map(step => <span key={step} style={{ "--k": step / 5 } as CSSProperties} />)}
              </span>
              More
            </span>
            <p id={hintId} className={styles.hint}>
              <span className={styles.hintFine}>Drag to orbit, pinch to zoom, click a bar to fly in.</span>
              <span className={styles.hintTouch}>Swipe sideways to orbit, tap a bar to fly in.</span>
              <span className={styles.srOnly}> Arrow keys move between hours and days, Enter focuses a bar, Shift with arrow keys orbits, plus and minus zoom, Escape clears.</span>
            </p>
          </div>
        </div>

        <aside className={styles.stats} aria-label="Week summary">
          <div className={styles.stat}>
            <p className={styles.label}><Rising text={`${metric.label} this week`} /></p>
            <p className={styles.big}><span className={styles.num}><AnimatedCounter value={metric.total} animateOnView /></span></p>
            <Delta change={metric.change} upIsGood={metric.upIsGood} />
          </div>
          <div className={styles.stat}>
            <p className={styles.label}>Peak hours</p>
            <ul className={styles.peaks}>
              {metric.top.map((entry, index) => {
                const pressed = sameCell(entry, focus);
                return <li key={index}>
                  <button
                    type="button"
                    className={styles.peak}
                    aria-pressed={pressed}
                    onClick={() => toggleFocus({ d: entry.d, h: entry.h })}
                    aria-label={`${LONG_DAYS[entry.d]} ${hourLabel(entry.h)}, ${formatNumber(entry.value)} ${metric.unit}. ${pressed ? "Return to the whole week" : "Fly to this hour"}`}
                  >
                    <Rising text={`${SHORT_DAYS[entry.d]} ${hourLabel(entry.h)}`} />
                    <span className={`${styles.peakValue} ${styles.num}`}><AnimatedCounter value={entry.value} /></span>
                  </button>
                </li>;
              })}
            </ul>
          </div>
          <div className={styles.stat}>
            <p className={styles.label}>Busiest day</p>
            <p className={styles.mid}><Rising text={LONG_DAYS[metric.busiest]} /></p>
            <p className={styles.sub}>
              <span className={styles.num}><AnimatedCounter value={metric.days[metric.busiest]} /></span>{" "}
              {metric.unit},{" "}
              <span className={styles.num}><AnimatedCounter value={Math.round(1e3 * metric.working) / 10} decimals={1} suffix="%" /></span>{" "}
              in working hours
            </p>
          </div>
        </aside>
      </div>

      <p className={styles.srOnly} aria-live="polite">{status}</p>
      <WeekTable metric={metric} />
    </div>
  </section>;
}

export default ActivityTerrain;
