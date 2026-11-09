"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, MotionValue, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { Pause, Play, RotateCcw } from "lucide-react";
import Button from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./connected-scatter.module.css";

export interface ScatterPoint {
  /** Month label, in time order. */
  label: string;
  /** Horizontal metric. */
  x: number;
  /** Vertical metric. */
  y: number;
}

export type NoteSide = "left" | "right" | "above" | "below";

/** A label pinned to one point of the path, used to explain a turn. */
export interface ScatterNote {
  index: number;
  text: string;
  side: NoteSide;
}

export interface ScatterSeries {
  id: string;
  name: string;
  points: ScatterPoint[];
  notes?: ScatterNote[];
}

export interface ScatterAxis {
  /** Short name, used in the readout and the tooltip. */
  name: string;
  /** Full title printed next to the plot. */
  title: string;
  min: number;
  max: number;
  /** Gridline step. */
  step: number;
}

export interface ConnectedScatterProps {
  /** Series to switch between. Every series needs the same number of points so the path can morph. */
  series?: ScatterSeries[];
  /** Id of the series shown first. Defaults to the first series. */
  defaultSeries?: string;
  xAxis?: ScatterAxis;
  yAxis?: ScatterAxis;
  /** Slope of the reference line y = targetRatio times x. */
  targetRatio?: number;
  formatValue?: (value: number) => string;
  title?: string;
  description?: string;
  /** Called with the month index whenever the head settles on a month. */
  onMonthChange?: (index: number) => void;
  /** Renders without the block's inner surfaces. The preview frame flattens the readout and the scrubber rail. */
  flat?: boolean;
  className?: string;
}

export const MONTHS = [
  "Jan 2025",
  "Feb 2025",
  "Mar 2025",
  "Apr 2025",
  "May 2025",
  "Jun 2025",
  "Jul 2025",
  "Aug 2025",
  "Sep 2025",
  "Oct 2025",
  "Nov 2025",
  "Dec 2025",
  "Jan 2026",
  "Feb 2026",
  "Mar 2026",
  "Apr 2026",
  "May 2026",
  "Jun 2026",
];

const toPoints = (xs: number[], ys: number[]): ScatterPoint[] => MONTHS.map((label, index) => ({ label, x: xs[index], y: ys[index] }));

export const SERIES: ScatterSeries[] = [
  {
    id: "paid-search",
    name: "Paid search",
    points: toPoints(
      [760, 800, 850, 905, 960, 1030, 1110, 1190, 1260, 1300, 1320, 1290, 1220, 1150, 1080, 1030, 990, 960],
      [3000, 3060, 3110, 3090, 3140, 3120, 3100, 3080, 3060, 3110, 3200, 3380, 3620, 3900, 4150, 4360, 4520, 4640],
    ),
    notes: [
      { index: 6, text: "Broad match on", side: "above" },
      { index: 12, text: "Annual plans", side: "left" },
    ],
  },
  {
    id: "organic",
    name: "Organic",
    points: toPoints(
      [560, 540, 565, 520, 495, 505, 470, 450, 430, 405, 420, 390, 372, 385, 360, 350, 356, 340],
      [2350, 2410, 2380, 2500, 2560, 2620, 2700, 2790, 2900, 3150, 3380, 3520, 3610, 3700, 3790, 3860, 3950, 4020],
    ),
    notes: [{ index: 9, text: "Docs relaunch", side: "right" }],
  },
  {
    id: "partners",
    name: "Partners",
    points: toPoints(
      [1700, 1660, 1630, 1650, 1580, 1520, 1470, 1490, 1420, 1370, 1330, 1345, 1290, 1240, 1210, 1225, 1180, 1150],
      [4200, 4280, 4390, 4340, 4520, 4650, 4760, 4720, 4910, 5040, 5130, 5200, 5330, 5420, 5510, 5560, 5660, 5740],
    ),
    notes: [{ index: 5, text: "Referral tiers", side: "right" }],
  },
];

export const X_AXIS: ScatterAxis = {
  name: "CAC",
  title: "Customer acquisition cost",
  min: 200,
  max: 1800,
  step: 200,
};
export const Y_AXIS: ScatterAxis = {
  name: "LTV",
  title: "12 month lifetime value",
  min: 2000,
  max: 6000,
  step: 1000,
};
export const TARGET_RATIO = 3;

const { spring, duration, ease, stagger } = motionTokens;

/** Design size. The plot measures itself and the viewBox follows, so the path is drawn in real pixels. */
const INITIAL_SIZE = { w: 760, h: 380 };
/** Catmull-Rom to cubic: control points sit a sixth of the way along the neighbouring chords. */
const TENSION = 1 / 6;
const SAMPLES = 24;
const HIT_RADIUS = 30;
const TOUCH_HIT_RADIUS = 45;
const TIP_WIDTH = 176;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round2 = (value: number) => Math.round(value * 100) / 100;
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const formatUSD = (value: number) => usd.format(Math.round(value));
const formatRatio = (value: number) => `${value.toFixed(1)}x`;

interface Geometry {
  w: number;
  h: number;
  sx: (value: number) => number;
  sy: (value: number) => number;
  bottom: number;
  right: number;
}

/** Plot rect: 44px for the y ticks, 14px of headroom, 30px for the x ticks, 16px right inset. */
function project(size: { w: number; h: number }, xAxis: ScatterAxis, yAxis: ScatterAxis): Geometry {
  const width = Math.max(size.w - 44 - 16, 1);
  const height = Math.max(size.h - 14 - 30, 1);
  return {
    ...size,
    sx: (value) => round2(44 + ((value - xAxis.min) / (xAxis.max - xAxis.min)) * width),
    sy: (value) => round2(14 + (1 - (value - yAxis.min) / (yAxis.max - yAxis.min)) * height),
    bottom: 14 + height,
    right: 44 + width,
  };
}

interface Point {
  x: number;
  y: number;
}

interface Track {
  d: string;
  xs: Float64Array;
  ys: Float64Array;
  /** Arc length up to every sample, so the head can travel at constant speed. */
  cum: Float64Array;
  /** Midpoint, angle and length of every segment, for the direction arrows. */
  mids: { x: number; y: number; r: number; len: number }[];
}

interface TrackState {
  from: Point[];
  to: Point[];
  /** Morph progress between from and to. */
  k: number;
  data: Point[];
  track: Track | null;
}

/** A cubic path through the points plus a 24 sample-per-segment arc length table. */
function buildTrack(points: Point[]): Track {
  const count = points.length;
  const total = SAMPLES * Math.max(count - 1, 1) + 1;
  const xs = new Float64Array(total);
  const ys = new Float64Array(total);
  const cum = new Float64Array(total);
  const mids: Track["mids"] = [];
  let d = count ? `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}` : "";
  if (count) {
    xs[0] = points[0].x;
    ys[0] = points[0].y;
  }
  for (let index = 0; index < count - 1; index++) {
    const before = points[index - 1] ?? points[index];
    const start = points[index];
    const end = points[index + 1];
    const after = points[index + 2] ?? points[index + 1];
    const controlA = {
      x: start.x + (end.x - before.x) * TENSION,
      y: start.y + (end.y - before.y) * TENSION,
    };
    const controlB = {
      x: end.x - (after.x - start.x) * TENSION,
      y: end.y - (after.y - start.y) * TENSION,
    };
    d += `C${controlA.x.toFixed(2)} ${controlA.y.toFixed(2)} ${controlB.x.toFixed(2)} ${controlB.y.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
    const at = (t: number) => {
      const u = 1 - t;
      return {
        x: u * u * u * start.x + 3 * u * u * t * controlA.x + 3 * u * t * t * controlB.x + t * t * t * end.x,
        y: u * u * u * start.y + 3 * u * u * t * controlA.y + 3 * u * t * t * controlB.y + t * t * t * end.y,
      };
    };
    const offset = SAMPLES * index;
    for (let step = 1; step <= SAMPLES; step++) {
      const point = at(step / SAMPLES);
      const cursor = offset + step;
      xs[cursor] = point.x;
      ys[cursor] = point.y;
      cum[cursor] = cum[cursor - 1] + Math.hypot(point.x - xs[cursor - 1], point.y - ys[cursor - 1]);
    }
    const mid = at(0.5);
    const back = at(0.45);
    const ahead = at(0.55);
    mids.push({
      x: round2(mid.x),
      y: round2(mid.y),
      r: round2((180 * Math.atan2(ahead.y - back.y, ahead.x - back.x)) / Math.PI),
      len: cum[offset + SAMPLES] - cum[offset],
    });
  }
  return { d, xs, ys, cum, mids };
}

interface Frame {
  d: MotionValue<string>;
  trail: MotionValue<number>;
  ghost: MotionValue<number>;
  hx: MotionValue<number>;
  hy: MotionValue<number>;
  vLen: MotionValue<number>;
  hLen: MotionValue<number>;
  dots: {
    x: MotionValue<number>;
    y: MotionValue<number>;
    on: MotionValue<number>;
  }[];
  arrows: {
    x: MotionValue<number>;
    y: MotionValue<number>;
    r: MotionValue<number>;
    on: MotionValue<number>;
  }[];
  xv: MotionValue<string>;
  yv: MotionValue<string>;
  ratio: MotionValue<string>;
  thumb: MotionValue<string>;
  fill: MotionValue<number>;
}

/** One pass of the renderer: geometry, head and readout for a cursor position in month units. */
function draw(frame: Frame, state: TrackState, geo: Geometry, cursor: number, instant: boolean, formatValue: (value: number) => string) {
  const count = state.to.length;
  if (!count) return;

  if (instant || !state.track) {
    state.data = state.to.map((next, index) => {
      const previous = state.from[index] ?? next;
      return {
        x: previous.x + (next.x - previous.x) * state.k,
        y: previous.y + (next.y - previous.y) * state.k,
      };
    });
    const projected = state.data.map((point) => ({
      x: geo.sx(point.x),
      y: geo.sy(point.y),
    }));
    state.track = buildTrack(projected);
    frame.d.set(state.track.d);
    projected.forEach((point, index) => {
      frame.dots[index]?.x.set(point.x);
      frame.dots[index]?.y.set(point.y);
    });
    state.track.mids.forEach((mid, index) => {
      frame.arrows[index]?.x.set(mid.x);
      frame.arrows[index]?.y.set(mid.y);
      frame.arrows[index]?.r.set(mid.r);
    });
  }

  const head = sample(state.track, clamp(cursor, 0, count - 1), count);
  frame.hx.set(round2(head.x));
  frame.hy.set(round2(head.y));
  frame.trail.set(head.frac);
  frame.vLen.set(Math.max(round2(geo.bottom - head.y), 0));
  frame.hLen.set(Math.max(round2(head.x - 44), 0));
  frame.dots.forEach((dot, index) => dot.on.set(+(cursor >= index - 0.001)));
  frame.arrows.forEach((arrow, index) => arrow.on.set(+(cursor >= index + 0.5)));

  const segment = Math.min(Math.floor(cursor), Math.max(count - 2, 0));
  const blend = count > 1 ? cursor - segment : 0;
  const from = state.data[segment];
  const to = state.data[Math.min(segment + 1, count - 1)];
  const x = from.x + (to.x - from.x) * blend;
  const y = from.y + (to.y - from.y) * blend;
  frame.xv.set(formatValue(x));
  frame.yv.set(formatValue(y));
  frame.ratio.set(formatRatio(x > 0 ? y / x : 0));
  const progress = count > 1 ? cursor / (count - 1) : 1;
  frame.thumb.set(`${100 * progress}%`);
  frame.fill.set(progress);
}

/** Interpolate the arc length table at a fractional month. */
function sample(track: Track, cursor: number, months: number) {
  const last = track.xs.length - 1;
  const segment = Math.min(Math.floor(cursor), Math.max(months - 2, 0));
  const step = clamp((cursor - segment) * SAMPLES, 0, SAMPLES);
  const whole = Math.min(Math.floor(step), SAMPLES - 1);
  const index = SAMPLES * segment + whole;
  const next = Math.min(index + 1, last);
  const blend = step - whole;
  const total = track.cum[track.cum.length - 1] || 1;
  return {
    x: track.xs[index] + (track.xs[next] - track.xs[index]) * blend,
    y: track.ys[index] + (track.ys[next] - track.ys[index]) * blend,
    frac: (track.cum[index] + (track.cum[next] - track.cum[index]) * blend) / total,
  };
}

/** Label anchors for the four sides, with the few pixels of air each one needs. */
const ANCHORS: Record<NoteSide, { dx: number; dy: number; anchor: "start" | "middle" | "end" }> = {
  left: { dx: -10, dy: 4, anchor: "end" },
  right: { dx: 10, dy: 4, anchor: "start" },
  above: { dx: 0, dy: -11, anchor: "middle" },
  below: { dx: 0, dy: 19, anchor: "middle" },
};

/** Pick the side of a point that faces away from its neighbour, so an end label never sits on the path. */
function awayFrom(point: Point, neighbour: Point | undefined): NoteSide {
  if (!neighbour) return "right";
  const dx = neighbour.x - point.x;
  const dy = neighbour.y - point.y;
  if (Math.abs(dx) >= 0.8 * Math.abs(dy)) return dx > 0 ? "left" : "right";
  return dy > 0 ? "above" : "below";
}

function createFrame(count: number): Frame {
  return {
    d: new MotionValue(""),
    trail: new MotionValue(0),
    ghost: new MotionValue(0),
    hx: new MotionValue(0),
    hy: new MotionValue(0),
    vLen: new MotionValue(0),
    hLen: new MotionValue(0),
    dots: Array.from({ length: count }, () => ({
      x: new MotionValue(0),
      y: new MotionValue(0),
      on: new MotionValue(0),
    })),
    arrows: Array.from({ length: Math.max(count - 1, 0) }, () => ({
      x: new MotionValue(0),
      y: new MotionValue(0),
      r: new MotionValue(0),
      on: new MotionValue(0),
    })),
    xv: new MotionValue(""),
    yv: new MotionValue(""),
    ratio: new MotionValue(""),
    thumb: new MotionValue("0%"),
    fill: new MotionValue(0),
  };
}

/** A connected scatterplot of two metrics over time. */
export function ConnectedScatter({
  series = SERIES,
  defaultSeries,
  xAxis = X_AXIS,
  yAxis = Y_AXIS,
  targetRatio = TARGET_RATIO,
  formatValue = formatUSD,
  title = "CAC and LTV by channel",
  description = "Monthly acquisition cost against 12 month lifetime value, January 2025 to June 2026.",
  onMonthChange,
  flat = false,
  className,
}: ConnectedScatterProps) {
  const reduced = useReducedMotion();
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const initialId = (series.some((entry) => entry.id === defaultSeries) ? defaultSeries : series[0]?.id) ?? "";
  const [activeId, setActiveId] = useState(initialId);
  const active = series.find((entry) => entry.id === activeId) ?? series[0];
  const points = useMemo(() => active?.points ?? [], [active]);
  const count = points.length;

  const [size, setSize] = useState(INITIAL_SIZE);
  const geo = useMemo(() => project(size, xAxis, yAxis), [size, xAxis, yAxis]);

  const [month, setMonth] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const cursor = useMotionValue(0);
  const [frame] = useState(() => createFrame(count));

  const [trackState] = useState<TrackState>(() => {
    const flat = points.map((point) => ({ x: point.x, y: point.y }));
    const state: TrackState = {
      from: flat,
      to: flat,
      k: 1,
      data: flat,
      track: null,
    };
    draw(frame, state, project(INITIAL_SIZE, xAxis, yAxis), 0, true, formatValue);
    return state;
  });

  const rootRef = useRef<HTMLElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const drawRef = useRef<{ stop(): void } | null>(null);
  const ghostRef = useRef<{ stop(): void } | null>(null);
  const fadeRef = useRef<{ stop(): void } | null>(null);
  const morphRef = useRef<{ stop(): void } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);
  const settledRef = useRef(0);
  const dragRef = useRef<{
    pointer: number;
    target: number;
    start: number;
    blend: number;
  } | null>(null);
  const propsRef = useRef({ geo, formatValue, count, onMonthChange });
  const [tip, setTip] = useState<{
    hover: number | null;
    last: number | null;
    glide: boolean;
  }>({ hover: null, last: null, glide: false });

  /** Redraw at a cursor position, and keep month state in sync when the head crosses a whole month. */
  const render = useCallback(
    (instant: boolean) => {
      const current = propsRef.current;
      draw(frame, trackState, current.geo, cursor.get(), instant, current.formatValue);
      const next = clamp(Math.round(cursor.get()), 0, Math.max(current.count - 1, 0));
      if (next !== settledRef.current) {
        settledRef.current = next;
        setMonth(next);
      }
    },
    [trackState, frame, cursor],
  );

  useLayoutEffect(() => {
    propsRef.current = { geo, formatValue, count, onMonthChange };
    render(true);
  }, [geo, formatValue, count, onMonthChange, render]);

  useEffect(() => cursor.on("change", () => render(false)), [cursor, render]);

  // The plot measures itself; the viewBox and every coordinate follow the measured box.
  useLayoutEffect(() => {
    const node = plotRef.current;
    if (!node) return;
    const measure = () => {
      const w = Math.round(node.clientWidth);
      const h = Math.round(node.clientHeight);
      if (w > 0 && h > 0) setSize((previous) => (previous.w === w && previous.h === h ? previous : { w, h }));
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(node);
    return () => observer?.disconnect();
  }, []);

  const stopPlayback = useCallback(() => {
    drawRef.current?.stop();
    drawRef.current = null;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPlaying(false);
  }, []);

  /** The ghost path and its dots stay behind the live one; they are what a channel morph fades between. */
  const revealGhost = useCallback(() => {
    startedRef.current = true;
    ghostRef.current?.stop();
    if (reduced) frame.ghost.set(1);
    else
      ghostRef.current = animate(frame.ghost, 1, {
        duration: duration.standard,
        ease: [...ease.standard],
      });
  }, [frame, reduced]);

  const valueText = useCallback(
    (index: number) => {
      const point = points[index];
      if (!point) return "";
      const ratio = point.x > 0 ? point.y / point.x : 0;
      return `${point.label}: ${xAxis.name} ${formatValue(point.x)}, ${yAxis.name} ${formatValue(point.y)}, ${formatRatio(ratio)}, ${ratio >= targetRatio ? "above" : "below"} the ${targetRatio}x target.`;
    },
    [points, xAxis.name, yAxis.name, formatValue, targetRatio],
  );

  const settle = useCallback(
    (index: number, announce = true) => {
      propsRef.current.onMonthChange?.(index);
      if (announce) setAnnouncement(valueText(index));
    },
    [valueText],
  );

  /** Move the head to a month: stops playback, springs the cursor, then announces where it landed. */
  const goToMonth = useCallback(
    (index: number) => {
      stopPlayback();
      if (!startedRef.current) revealGhost();
      const target = clamp(index, 0, count - 1);
      settledRef.current = target;
      if (reduced) cursor.set(target);
      else drawRef.current = animate(cursor, target, spring.smooth);
      settle(target);
    },
    [count, reduced, settle, revealGhost, stopPlayback, cursor],
  );

  // Draw the path in once, when a third of the block is on screen.
  useEffect(() => {
    const node = rootRef.current;
    if (!node || startedRef.current) return;
    settledRef.current = count - 1;
    if (reduced) {
      cursor.set(count - 1);
      revealGhost();
      return;
    }
    const drawIn = () => {
      if (startedRef.current) return;
      drawRef.current?.stop();
      cursor.set(0);
      drawRef.current = animate(cursor, count - 1, {
        duration: (count - 1) * stagger.line,
        ease: [...ease.inOut],
        onComplete: revealGhost,
      });
    };
    if (typeof IntersectionObserver === "undefined") {
      drawIn();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          drawIn();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [count, reduced, revealGhost, cursor]);

  useEffect(
    () => () => {
      drawRef.current?.stop();
      morphRef.current?.stop();
      ghostRef.current?.stop();
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  const atEnd = month >= count - 1;

  const positionToMonth = (clientX: number) => {
    const node = scrubberRef.current;
    if (!node) return 0;
    const box = node.getBoundingClientRect();
    return clamp(((clientX - box.left) / Math.max(box.width, 1)) * (count - 1), 0, count - 1);
  };

  const applyDrag = () => {
    const drag = dragRef.current;
    if (drag) cursor.set(drag.start + (drag.target - drag.start) * drag.blend);
  };

  const endDrag = (event: { pointerId: number }) => {
    const drag = dragRef.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    goToMonth(Math.round(drag.target));
  };

  /** Hit test in plot space; a finger gets a wider target than a cursor. */
  const hitTest = (event: { clientX: number; clientY: number; pointerType: string }) => {
    const node = svgRef.current;
    if (!node) return null;
    const box = node.getBoundingClientRect();
    const x = ((event.clientX - box.left) / Math.max(box.width, 1)) * geo.w;
    const y = ((event.clientY - box.top) / Math.max(box.height, 1)) * geo.h;
    let found: number | null = null;
    let best = event.pointerType === "touch" ? TOUCH_HIT_RADIUS : HIT_RADIUS;
    screenPoints.forEach((point, index) => {
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance < best) {
        best = distance;
        found = index;
      }
    });
    return found;
  };

  const screenPoints = useMemo(() => points.map((point) => ({ x: geo.sx(point.x), y: geo.sy(point.y) })), [points, geo]);

  /** Ticks, target line and healthy region, all in screen space. */
  const chart = useMemo(() => {
    const narrow = geo.w < 440;
    const xTicks: number[] = [];
    const step = xAxis.step * (narrow ? 2 : 1);
    const start = narrow ? Math.ceil((xAxis.min + 1e-9) / step) * step : xAxis.min;
    for (let value = start; value <= xAxis.max + 1e-9; value += step) {
      if (!narrow || value < xAxis.max) xTicks.push(value);
    }
    const yTicks: number[] = [];
    const yStep = geo.h - 14 - 30 < 240 ? 2 * yAxis.step : yAxis.step;
    for (let value = yAxis.min; value <= yAxis.max + 1e-9; value += yStep) yTicks.push(value);

    const corners = [
      { x: xAxis.min, y: yAxis.min },
      { x: xAxis.max, y: yAxis.min },
      { x: xAxis.max, y: yAxis.max },
      { x: xAxis.min, y: yAxis.max },
    ];
    const side = (point: Point) => point.y - targetRatio * point.x;
    const region: Point[] = [];
    corners.forEach((corner, index) => {
      const next = corners[(index + 1) % corners.length];
      const a = side(corner);
      const b = side(next);
      if (a >= 0) region.push(corner);
      if (a >= 0 !== b >= 0) {
        const t = a / (a - b);
        region.push({
          x: corner.x + (next.x - corner.x) * t,
          y: corner.y + (next.y - corner.y) * t,
        });
      }
    });
    const path = region.length ? `M${region.map((point) => `${geo.sx(point.x)} ${geo.sy(point.y)}`).join(" L")} Z` : "";
    const onLine = region.filter((point) => 1e-6 > Math.abs(side(point))).sort((a, b) => a.x - b.x);
    const originData = onLine[0] ?? {
      x: xAxis.min,
      y: targetRatio * xAxis.min,
    };
    const endData = onLine[onLine.length - 1] ?? {
      x: xAxis.max,
      y: targetRatio * xAxis.max,
    };
    const origin = { x: geo.sx(originData.x), y: geo.sy(originData.y) };
    const end = { x: geo.sx(endData.x), y: geo.sy(endData.y) };
    const top = geo.sy(yAxis.max);
    const angle = (180 * Math.atan2(end.y - origin.y, end.x - origin.x)) / Math.PI;
    return {
      xTicks,
      yTicks,
      origin,
      end,
      region: path,
      angle,
      labelAt: {
        x: origin.x + (end.x - origin.x) * 0.94,
        y: origin.y + (end.y - origin.y) * 0.94,
      },
      top,
    };
  }, [geo, xAxis, yAxis, targetRatio]);

  /** First and last month always, notes only when the plot is wide enough to hold them. */
  const pointLabels = useMemo(() => {
    if (!count) return [];
    const labels: {
      index: number;
      text: string;
      side: NoteSide;
      strong: boolean;
    }[] = [
      {
        index: 0,
        text: points[0].label,
        side: awayFrom(screenPoints[0], screenPoints[1]),
        strong: false,
      },
      {
        index: count - 1,
        text: points[count - 1].label,
        side: awayFrom(screenPoints[count - 1], screenPoints[count - 2]),
        strong: true,
      },
    ];
    if (geo.w >= 480) {
      (active?.notes ?? []).forEach((note) => {
        if (note.index > 0 && note.index < count - 1) {
          labels.push({
            index: note.index,
            text: note.text,
            side: note.side,
            strong: false,
          });
        }
      });
    }
    return labels;
  }, [active, points, screenPoints, count, geo.w]);

  /** Arrows on every segment that is long enough to show one without clutter. */
  const arrowVisible = useMemo(
    () => screenPoints.slice(0, -1).map((point, index) => Math.hypot(screenPoints[index + 1].x - point.x, screenPoints[index + 1].y - point.y) >= 22),
    [screenPoints],
  );

  const point = points[month];
  const first = points[0];
  const above = (point && point.x > 0 ? point.y / point.x : 0) >= targetRatio;

  const since = (value: number, from: number) => {
    const delta = Math.round(value - from);
    if (delta === 0) return `Same as ${first?.label ?? "the start"}`;
    return `${delta > 0 ? "+" : "−"}${formatValue(Math.abs(delta))} since ${first?.label ?? "the start"}`;
  };

  if (tip.hover !== hover)
    setTip({
      hover,
      last: hover ?? tip.last,
      glide: hover !== null && tip.hover !== null,
    });
  const shown = hover ?? tip.last;
  const gliding = hover !== null && tip.glide;
  const tooltip =
    shown !== null && screenPoints[shown]
      ? {
          left: clamp(screenPoints[shown].x - TIP_WIDTH / 2, 0, Math.max(geo.w - TIP_WIDTH, 0)),
          top: screenPoints[shown].y,
          below: screenPoints[shown].y < 118,
          point: points[shown],
          ratio: points[shown].x > 0 ? points[shown].y / points[shown].x : 0,
        }
      : null;

  /** Month labels: quarter starts plus both ends, the last three months only when they are the end. */
  const ticks = points
    .map((entry, index) => {
      const [name, year] = entry.label.split(" ");
      const edge = index === 0 || index === count - 1;
      const january = name === "Jan";
      const quarter = ["Jan", "Apr", "Jul", "Oct"].includes(name);
      if (!(edge || quarter) || (!edge && index >= count - 3)) return null;
      return {
        i: index,
        text: edge || january ? `${name} ${year}` : name,
        minor: !edge && !january,
        edge: index === 0 ? "start" : index === count - 1 ? "end" : undefined,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        i: number;
        text: string;
        minor: boolean;
        edge: "start" | "end" | undefined;
      } => entry !== null,
    );

  const PlayIcon = playing ? Pause : atEnd ? RotateCcw : Play;

  return (
    <section ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} aria-labelledby={`${id}-title`}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h2 id={`${id}-title`} className={styles.title}>
            {title}
          </h2>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        {series.length > 1 ? (
          <SegmentedControl
            label="Channel"
            value={activeId}
            onValueChange={(next) => {
              const target = series.find((entry) => entry.id === next);
              if (!target || next === activeId) return;
              setActiveId(next);
              setHover(null);
              if (!startedRef.current) {
                drawRef.current?.stop();
                cursor.set(count - 1);
                revealGhost();
              }
              morphRef.current?.stop();
              trackState.from = trackState.data.map((entry) => ({ ...entry }));
              trackState.to = target.points.map((entry) => ({
                x: entry.x,
                y: entry.y,
              }));
              trackState.k = +!!reduced;
              const landed = target.points[settledRef.current];
              if (landed) {
                const ratio = landed.x > 0 ? landed.y / landed.x : 0;
                setAnnouncement(
                  `${target.name}. ${landed.label}: ${xAxis.name} ${formatValue(landed.x)}, ${yAxis.name} ${formatValue(landed.y)}, ${formatRatio(ratio)}.`,
                );
              }
              if (reduced) {
                render(true);
                return;
              }
              const progress = new MotionValue(0);
              progress.on("change", (value) => {
                trackState.k = value;
                render(true);
              });
              morphRef.current = animate(progress, 1, {
                ...spring.smooth,
                onComplete: () => {
                  trackState.k = 1;
                  render(true);
                },
              });
            }}
            options={series.map((entry) => ({
              value: entry.id,
              label: entry.name,
            }))}
          />
        ) : null}
      </header>

      <dl className={styles.stats} data-frame-flat={flat ? "" : undefined}>
        <div className={styles.stat}>
          <dt>Month</dt>
          <dd>
            <span className={styles.statValue}>{point?.label}</span>
            <span className={styles.statNote}>
              {month + 1} of {count}
            </span>
          </dd>
        </div>
        <div className={styles.stat}>
          <dt>{xAxis.name}</dt>
          <dd>
            <motion.span className={styles.statValue}>{frame.xv}</motion.span>
            <span className={styles.statNote}>{point && first ? since(point.x, first.x) : ""}</span>
          </dd>
        </div>
        <div className={styles.stat}>
          <dt>{yAxis.name}</dt>
          <dd>
            <motion.span className={styles.statValue}>{frame.yv}</motion.span>
            <span className={styles.statNote}>{point && first ? since(point.y, first.y) : ""}</span>
          </dd>
        </div>
        <div className={styles.stat} data-status={above ? "good" : "low"}>
          <dt>
            {yAxis.name} to {xAxis.name}
          </dt>
          <dd>
            <motion.span className={styles.statValue}>{frame.ratio}</motion.span>
            <span className={styles.statNote}>
              <span className={styles.statusDot} aria-hidden="true" />
              {above ? "Above" : "Below"} {targetRatio}x target
            </span>
          </dd>
        </div>
      </dl>

      <div className={styles.chartBlock}>
        <div className={styles.chartHead}>
          <span className={styles.axisTitle}>{yAxis.title}</span>
          <ul className={styles.key} aria-label="Chart key">
            <li>
              <span className={styles.keyLine} data-line="path" aria-hidden="true" />
              {active?.name}, in time order
            </li>
            <li>
              <span className={styles.keyLine} data-line="target" aria-hidden="true" />
              {yAxis.name} = {targetRatio}x {xAxis.name}
            </li>
            <li>
              <span className={styles.keyZone} aria-hidden="true" />
              Healthy zone
            </li>
          </ul>
        </div>

        <div ref={plotRef} className={styles.plot} onPointerLeave={() => setHover(null)}>
          <svg
            ref={svgRef}
            className={styles.svg}
            viewBox={`0 0 ${geo.w} ${geo.h}`}
            aria-hidden="true"
            onPointerMove={(event) => {
              if (event.pointerType === "touch") return;
              const next = hitTest(event);
              setHover((previous) => (previous === next ? previous : next));
            }}
            onPointerDown={(event) => {
              const next = hitTest(event);
              setHover(next);
              if (next !== null) goToMonth(next);
            }}
          >
            <defs>
              <clipPath id={`${id}-clip`}>
                <rect x={44} y={14} width={Math.max(geo.right - 44, 0)} height={Math.max(geo.bottom - 14, 0)} />
              </clipPath>
            </defs>
            <path className={styles.zone} d={chart.region} />
            <g>
              {chart.yTicks.map((value) => (
                <g key={`y${value}`}>
                  <line className={styles.grid} x1={44} x2={geo.right} y1={geo.sy(value)} y2={geo.sy(value)} />
                  <text className={styles.tick} x={36} y={geo.sy(value)} dy="0.32em" textAnchor="end">
                    {value >= 1000 && value % 1000 === 0 ? `${formatValue(value / 1000)}k` : formatValue(value)}
                  </text>
                </g>
              ))}
              {chart.xTicks.map((value) => (
                <text
                  key={`x${value}`}
                  className={styles.tick}
                  x={geo.sx(value)}
                  y={geo.bottom + 19}
                  textAnchor={value <= xAxis.min ? "start" : value >= xAxis.max ? "end" : "middle"}
                >
                  {formatValue(value)}
                </text>
              ))}
            </g>
            <line className={styles.target} x1={chart.origin.x} y1={chart.origin.y} x2={chart.end.x} y2={chart.end.y} />
            {geo.w >= 480 ? (
              <text
                className={styles.targetLabel}
                transform={`translate(${round2(chart.labelAt.x)} ${round2(chart.labelAt.y)}) rotate(${round2(chart.angle)})`}
                y={-7}
                textAnchor="end"
              >
                {targetRatio}x {xAxis.name}
              </text>
            ) : null}
            {geo.w >= 480 ? (
              <text className={styles.zoneLabel} x={56} y={32}>
                Healthy, above {targetRatio}x
              </text>
            ) : null}
            <g clipPath={`url(#${id}-clip)`}>
              <motion.rect
                className={styles.guide}
                x={-0.5}
                y={0}
                width={1}
                height={1}
                style={{
                  x: frame.hx,
                  y: frame.hy,
                  scaleY: frame.vLen,
                  originY: 0,
                }}
              />
              <motion.rect className={styles.guide} x={44} y={-0.5} width={1} height={1} style={{ y: frame.hy, scaleX: frame.hLen, originX: 0 }} />
            </g>
            <motion.path className={styles.ghost} d={frame.d} style={{ opacity: frame.ghost }} />
            <motion.path className={styles.trail} d={frame.d} style={{ pathLength: frame.trail }} />
            <g>
              {frame.arrows.map((arrow, index) =>
                arrowVisible[index] ? (
                  <motion.g key={index} style={{ x: arrow.x, y: arrow.y, rotate: arrow.r }}>
                    <motion.path className={styles.arrowGhost} d="M-3.5 -3.5 L3.5 0 L-3.5 3.5 Z" style={{ opacity: frame.ghost }} />
                    <motion.path className={styles.arrow} d="M-3.5 -3.5 L3.5 0 L-3.5 3.5 Z" style={{ opacity: arrow.on }} />
                  </motion.g>
                ) : null,
              )}
            </g>
            <g>
              {frame.dots.map((dot, index) => (
                <motion.g key={index} className={styles.dot} data-hover={hover === index ? "" : undefined} style={{ x: dot.x, y: dot.y }}>
                  <circle className={styles.dotHalo} r={11} />
                  <motion.circle className={styles.dotGhost} r={3} style={{ opacity: frame.ghost }} />
                  <motion.circle className={styles.dotPast} r={3.25} style={{ opacity: dot.on }} />
                </motion.g>
              ))}
            </g>
            <motion.g style={{ opacity: frame.ghost }}>
              <AnimatePresence>
                <motion.g
                  key={activeId}
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 1,
                    transition: reduced
                      ? { duration: 0 }
                      : {
                          duration: duration.standard,
                          ease: [...ease.standard],
                          delay: duration.standard,
                        },
                  }}
                  exit={{
                    opacity: 0,
                    transition: {
                      duration: reduced ? 0 : duration.exit,
                      ease: [...ease.exit],
                    },
                  }}
                >
                  {pointLabels.map((label) => {
                    const anchor = screenPoints[label.index];
                    const reach = 6.6 * label.text.length;
                    const side =
                      label.side === "right" && anchor.x + 10 + reach > geo.right
                        ? "left"
                        : label.side === "left" && anchor.x - 10 - reach < 44
                          ? "right"
                          : label.side;
                    const spot = ANCHORS[side];
                    return (
                      <text
                        key={`${label.index}-${label.text}`}
                        className={styles.pointLabel}
                        data-strong={label.strong ? "" : undefined}
                        x={round2(anchor.x + spot.dx)}
                        y={round2(anchor.y + spot.dy)}
                        textAnchor={spot.anchor}
                      >
                        {label.text}
                      </text>
                    );
                  })}
                </motion.g>
              </AnimatePresence>
            </motion.g>
            <motion.g className={styles.headMark} data-active={dragging || playing ? "" : undefined} style={{ x: frame.hx, y: frame.hy }}>
              <circle className={styles.headHalo} r={13} />
              <circle className={styles.headDot} r={6} />
            </motion.g>
          </svg>

          <div
            className={styles.tip}
            data-open={hover !== null && tooltip ? "" : undefined}
            data-glide={gliding ? "" : undefined}
            data-below={tooltip?.below ? "" : undefined}
            style={
              tooltip
                ? {
                    transform: `translate(${round2(tooltip.left)}px, ${round2(tooltip.top)}px)`,
                  }
                : undefined
            }
            aria-hidden="true"
          >
            {tooltip ? (
              <div className={styles.tipCard}>
                <span className={styles.tipDate}>{tooltip.point.label}</span>
                <dl className={styles.tipRows}>
                  <div>
                    <dt>{xAxis.name}</dt>
                    <dd>{formatValue(tooltip.point.x)}</dd>
                  </div>
                  <div>
                    <dt>{yAxis.name}</dt>
                    <dd>{formatValue(tooltip.point.y)}</dd>
                  </div>
                  <div>
                    <dt>Ratio</dt>
                    <dd data-status={tooltip.ratio >= targetRatio ? "good" : "low"}>{formatRatio(tooltip.ratio)}</dd>
                  </div>
                </dl>
              </div>
            ) : null}
          </div>
        </div>

        <span className={styles.axisTitle} data-axis="x">
          {xAxis.title}
        </span>
      </div>

      <div className={styles.scrub} data-frame-flat={flat ? "" : undefined}>
        <Button
          variant="secondary"
          className={styles.play}
          onClick={() => {
            if (playing) {
              stopPlayback();
              settledRef.current = month;
              settle(month);
              return;
            }
            stopPlayback();
            if (!startedRef.current) revealGhost();
            const from = cursor.get() >= count - 1 - 0.01 ? 0 : cursor.get();
            cursor.set(from);
            settledRef.current = count - 1;
            setPlaying(true);
            if (reduced) {
              let step = Math.ceil(from);
              intervalRef.current = setInterval(() => {
                step = Math.min(step + 1, count - 1);
                cursor.set(step);
                if (step >= count - 1) {
                  stopPlayback();
                  settle(count - 1);
                } else {
                  settledRef.current = count - 1;
                }
              }, 2000 * duration.considered);
              return;
            }
            drawRef.current = animate(cursor, count - 1, {
              duration: (count - 1 - from) * duration.standard,
              ease: "linear",
              onComplete: () => {
                drawRef.current = null;
                setPlaying(false);
                settle(count - 1);
              },
            });
          }}
          aria-label={playing ? "Pause" : atEnd ? "Replay from the first month" : "Play through the months"}
        >
          <PlayIcon size={16} strokeWidth={1.75} aria-hidden="true" />
          {playing ? "Pause" : atEnd ? "Replay" : "Play"}
        </Button>

        <div className={styles.timeline}>
          <div
            ref={scrubberRef}
            className={styles.scrubber}
            data-active={dragging ? "" : undefined}
            role="slider"
            tabIndex={0}
            aria-label="Month"
            aria-orientation="horizontal"
            aria-valuemin={1}
            aria-valuemax={count}
            aria-valuenow={month + 1}
            aria-valuetext={valueText(month)}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              event.currentTarget.focus({ preventScroll: true });
              stopPlayback();
              if (!startedRef.current) revealGhost();
              const drag = {
                pointer: event.pointerId,
                target: positionToMonth(event.clientX),
                start: cursor.get(),
                blend: +!!reduced,
              };
              dragRef.current = drag;
              setDragging(true);
              setHover(null);
              if (reduced) {
                applyDrag();
                return;
              }
              const blend = new MotionValue(0);
              drawRef.current = animate(blend, 1, {
                ...spring.smooth,
                onUpdate: (value) => {
                  drag.blend = value;
                  applyDrag();
                },
              });
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              if (!drag || drag.pointer !== event.pointerId) return;
              drag.target = positionToMonth(event.clientX);
              if (drag.blend >= 1) applyDrag();
            }}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={(event) => {
              const current = settledRef.current;
              let next: number | null = null;
              if (event.key === "ArrowRight" || event.key === "ArrowUp") next = current + 1;
              else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = current - 1;
              else if (event.key === "PageUp") next = current + 3;
              else if (event.key === "PageDown") next = current - 3;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = count - 1;
              if (next !== null) {
                event.preventDefault();
                setHover(null);
                goToMonth(next);
              }
            }}
          >
            <div className={styles.bar} aria-hidden="true">
              <motion.span className={styles.barFill} style={{ scaleX: frame.fill, originX: 0 }} />
            </div>
            <div className={styles.notches} aria-hidden="true">
              {points.map((entry, index) => (
                <span
                  key={entry.label}
                  className={styles.notch}
                  style={{
                    left: `${count > 1 ? (index / (count - 1)) * 100 : 0}%`,
                  }}
                />
              ))}
            </div>
            <div className={styles.thumbTrack} aria-hidden="true">
              <motion.div className={styles.thumbRail} style={{ x: frame.thumb }}>
                <span className={styles.thumb} />
              </motion.div>
            </div>
          </div>
          <div className={styles.monthLabels} aria-hidden="true">
            {ticks.map((entry) => (
              <span
                key={entry.i}
                className={styles.monthLabel}
                data-minor={entry.minor ? "" : undefined}
                data-edge={entry.edge}
                style={{
                  left: `${count > 1 ? (entry.i / (count - 1)) * 100 : 0}%`,
                }}
              >
                {entry.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.srOnly}>
        <table>
          <caption>
            {active?.name}: {xAxis.title} and {yAxis.title} by month
          </caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">{xAxis.name}</th>
              <th scope="col">{yAxis.name}</th>
              <th scope="col">Ratio</th>
            </tr>
          </thead>
          <tbody>
            {points.map((entry) => (
              <tr key={entry.label}>
                <th scope="row">{entry.label}</th>
                <td>{formatValue(entry.x)}</td>
                <td>{formatValue(entry.y)}</td>
                <td>{formatRatio(entry.x > 0 ? entry.y / entry.x : 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}

export default ConnectedScatter;
