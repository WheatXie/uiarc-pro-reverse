"use client";

/**
 * Realtime stream — a live line chart drawn on a canvas. Each reading arrives on the feed and the
 * view trails the newest point by one interval, so points slide in instead of popping; the value
 * axis eases toward the visible range, anomalies pop a marker plus a tag, and hovering (or
 * focusing, or leaving the tab) freezes the scroll so a past reading can be read while new ones
 * queue. Hovering the plot holds the view, Space pauses the feed, arrows read points.
 */
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  Ref,
} from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { motionTokens } from "../motion-tokens";
import styles from "./realtime-stream.module.css";

/** One reading. Timestamps are epoch milliseconds and must arrive in ascending order. */
export interface StreamPoint {
  /** Epoch milliseconds of the reading. */
  t: number;
  /** The measured value, in the unit the stream declares. */
  value: number;
  /** Short tag such as `Spike`; a string is drawn as the marker label, any other presence marks the point. */
  anomaly?: string;
}

export interface RealtimeStreamProps {
  /** Append-only feed in ascending time: `{ t, value, anomaly? }`. Trim it to a few windows. */
  points: readonly StreamPoint[];
  /** What is measured. Names the chart, the current value, and the table. */
  label: string;
  /** Unit after values, such as `ms`. */
  unit?: string;
  /** Visible span of time in milliseconds. */
  windowMs?: number;
  /** Typical time between points. The view trails the newest point by this much. */
  interval?: number;
  /** Plot height in pixels. */
  height?: number;
  /** Formats values in the readout, tooltip, and table. */
  formatValue?: (value: number) => string;
  /** Formats times in the tooltip and table. Defaults to a 24-hour `HH:MM:SS`. */
  formatTime?: (t: number) => string;
  /** Controlled pause. Leave it out to let the status button own the state. */
  paused?: boolean;
  /** Initial pause when uncontrolled. */
  defaultPaused?: boolean;
  /** Called when the status button or Space toggles the pause. */
  onPausedChange?: (paused: boolean) => void;
  /** Holds the view while the pointer is over the plot. */
  pauseOnHover?: boolean;
  /** Fixed bottom of the value axis. Leave it out to follow the data. */
  min?: number;
  /** Fixed top of the value axis. Leave it out to follow the data. */
  max?: number;
  /** Shown before the first point. */
  emptyLabel?: string;
  /** Forwarded to the figure. */
  ref?: Ref<HTMLElement>;
  /** Extra class on the figure. */
  className?: string;
}

/** The point under the pointer, in both data and chart space. */
interface HoverPoint {
  t: number;
  value: number;
  anomaly?: string;
  x: number;
  y: number;
}

/** Everything the draw loop needs from props, kept in a ref so the loop never restarts on it. */
interface DrawOptions {
  points: readonly StreamPoint[];
  windowMs: number;
  interval: number;
  height: number;
  frozen: boolean;
  reduced: boolean;
  hover: HoverPoint | null;
  min?: number;
  max?: number;
}

/** Scroll and scale state that lives between frames. */
interface ChartState {
  t: number;
  skew: number;
  lo: number;
  hi: number;
  ready: boolean;
  arrivals: Map<number, number>;
  width: number;
  lastLatest: number;
}

interface Palette {
  ink: string;
  accent: string;
  surface: string;
  border: string;
  muted: string;
  mark: string;
  font: string;
}

const numberFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});
const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** The chart is only measurable on the client; this subscription never changes. */
const subscribeToNothing = () => () => {};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** A human step (1, 2, 2.5, 5, 10 × 10ⁿ) for an axis-adjacent span and a label count. */
function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const base = 10 ** Math.floor(Math.log10(raw || 1));
  const scaled = raw / base;
  return (
    (scaled <= 1
      ? 1
      : scaled <= 2
        ? 2
        : scaled <= 2.5
          ? 2.5
          : scaled <= 5
            ? 5
            : 10) * base
  );
}

/** Index of the first point at or after `t`. */
function lowerBound(points: readonly StreamPoint[], t: number): number {
  let low = 0;
  let high = points.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (points[mid].t < t) low = mid + 1;
    else high = mid;
  }
  return low;
}

/** Marker pop: one overshoot to full size, settled by half a second. */
const pop = (progress: number) =>
  progress >= 0.5 ? 1 : 1 - Math.exp(-12 * progress) * Math.cos(16 * progress);

function readPalette(probe: HTMLElement): Palette {
  const children = probe.children;
  const colorAt = (index: number) => getComputedStyle(children[index]).color;
  return {
    ink: colorAt(0),
    accent: colorAt(1),
    surface: colorAt(2),
    border: colorAt(3),
    muted: colorAt(4),
    mark: colorAt(5),
    font: getComputedStyle(probe).fontFamily || "system-ui, sans-serif",
  };
}

export function RealtimeStream({
  points,
  label,
  unit = "",
  windowMs = 30_000,
  interval = 1_000,
  height = 200,
  formatValue,
  formatTime = (t) => timeFormat.format(t),
  paused,
  defaultPaused = false,
  onPausedChange,
  pauseOnHover = true,
  min,
  max,
  emptyLabel = "Waiting for data",
  ref,
  className,
}: RealtimeStreamProps) {
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const reducedMotion = useReducedMotion();
  const reduced = Boolean(reducedMotion) && hydrated;

  const rootRef = useRef<HTMLElement | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const probeRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const placedRef = useRef(false);

  useImperativeHandle(ref, () => rootRef.current as HTMLElement);

  const inView = useInView(rootRef, { amount: 0 });

  const empty = points.length === 0;
  const latest = points[points.length - 1];

  const [uncontrolledPaused, setUncontrolledPaused] = useState(defaultPaused);
  const pausedValue = paused ?? uncontrolledPaused;
  const togglePause = (next: boolean) => {
    if (paused === undefined) setUncontrolledPaused(next);
    if (next !== pausedValue) onPausedChange?.(next);
  };

  const [hover, setHover] = useState<HoverPoint | null>(null);
  const [hovering, setHovering] = useState(false);
  const frozen = pausedValue || (pauseOnHover && hovering) || hover !== null;

  // Readings that landed while the view was held, and the release that clears them.
  const [pending, setPending] = useState(0);
  const [lastSeen, setLastSeen] = useState<number | undefined>(latest?.t);
  if (latest?.t !== lastSeen) {
    setLastSeen(latest?.t);
    if (frozen && lastSeen !== undefined) setPending((count) => count + 1);
  }

  const [wasFrozen, setWasFrozen] = useState(frozen);
  if (wasFrozen !== frozen) {
    setWasFrozen(frozen);
    if (!frozen) setPending(0);
  }

  // Anomalies are announced once, when the newest reading carries one.
  const [announcement, setAnnouncement] = useState("");
  const [announcedAt, setAnnouncedAt] = useState<number | null>(null);
  if (latest?.anomaly && latest.t !== announcedAt) {
    setAnnouncedAt(latest.t);
    setAnnouncement(
      `${typeof latest.anomaly === "string" ? latest.anomaly : "Anomaly"} at ${formatTime(latest.t)}, ${
        formatValue
          ? formatValue(latest.value)
          : numberFormat.format(latest.value)
      }${unit ? ` ${unit}` : ""}`,
    );
  }

  const optionsRef = useRef<DrawOptions>({
    points,
    windowMs,
    interval,
    height,
    frozen,
    reduced,
    hover,
    min,
    max,
  });
  useLayoutEffect(() => {
    optionsRef.current = {
      points,
      windowMs,
      interval,
      height,
      frozen,
      reduced,
      hover,
      min,
      max,
    };
  });

  const chartRef = useRef<ChartState>({
    t: 0,
    skew: 0,
    lo: 0,
    hi: 1,
    ready: false,
    arrivals: new Map<number, number>(),
    width: 0,
    lastLatest: -Infinity,
  });
  const paletteRef = useRef<Palette>({
    ink: "#111",
    accent: "#333",
    surface: "#fff",
    border: "#eee",
    muted: "#888",
    mark: "#e26a2b",
    font: "system-ui, sans-serif",
  });

  const syncPalette = useCallback(() => {
    const probe = probeRef.current;
    if (!probe) return;
    paletteRef.current = readPalette(probe);
  }, []);

  // Theme tokens are resolved from the probes: a few times a second while drawing, and on theme
  // changes from outside the component.
  useEffect(() => {
    syncPalette();
    const observer = new MutationObserver(syncPalette);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-accent", "class", "style"],
    });
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    dark.addEventListener("change", syncPalette);
    return () => {
      observer.disconnect();
      dark.removeEventListener("change", syncPalette);
    };
  }, [syncPalette]);

  useEffect(() => {
    const plot = plotRef.current;
    const canvas = canvasRef.current;
    if (!plot || !canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let frame = 0;
    let lastFrame = performance.now();
    let frames = 0;

    const render = (now: number, delta: number) => {
      if (++frames % 30 === 0) syncPalette();

      const options = optionsRef.current;
      const state = chartRef.current;
      const palette = paletteRef.current;
      const width = plot.clientWidth;
      const plotHeight = options.height;
      const ratio = window.devicePixelRatio || 1;
      if (
        canvas.width !== Math.round(width * ratio) ||
        canvas.height !== Math.round(plotHeight * ratio)
      ) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(plotHeight * ratio);
      }
      state.width = width;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, plotHeight);

      const data = options.points;
      if (!data.length || width <= 44) return;

      const newest = data[data.length - 1];
      if (newest.t !== state.lastLatest) {
        state.lastLatest = newest.t;
        state.arrivals.set(newest.t, now);
        for (const key of state.arrivals.keys()) {
          if (key < newest.t - 2 * options.windowMs) state.arrivals.delete(key);
        }
        state.skew = state.ready
          ? state.skew + (newest.t - Date.now() - state.skew) * 0.25
          : newest.t - Date.now();
      }

      // The head trails the newest reading by one interval, so a point slides in over its slot.
      const target = options.reduced
        ? newest.t
        : Math.min(Date.now() + state.skew - options.interval, newest.t);
      if (!state.ready) {
        state.t = target;
        state.ready = true;
      }
      if (!options.frozen) {
        state.t =
          options.reduced || Math.abs(target - state.t) < 4
            ? target
            : state.t + (target - state.t) * (1 - Math.exp(-7 * delta));
      }

      const t = state.t;
      const windowStart = t - options.windowMs;
      const plotWidth = width - 44;
      const innerHeight = plotHeight - 14 - 22;
      const xOf = (value: number) =>
        ((value - windowStart) / options.windowMs) * plotWidth;
      const yOf = (value: number) =>
        14 + (1 - (value - state.lo) / (state.hi - state.lo)) * innerHeight;

      const from = Math.max(0, lowerBound(data, windowStart) - 1);
      const to = Math.min(data.length, lowerBound(data, t) + 1);
      const visible = data.slice(from, to);

      // Interpolate the head between the two readings it sits between.
      const nextIndex = lowerBound(data, t);
      const prevIndex = nextIndex - 1;
      let head: StreamPoint;
      if (prevIndex < 0) head = data[0];
      else if (nextIndex >= data.length) head = data[data.length - 1];
      else {
        const before = data[prevIndex];
        const after = data[nextIndex];
        const mix = (t - before.t) / Math.max(1, after.t - before.t);
        head = {
          t,
          value: before.value + (after.value - before.value) * clamp(mix, 0, 1),
        };
      }

      const series = visible.filter((point) => point.t <= t);
      series.push(head);

      let dataLo = options.min ?? Infinity;
      let dataHi = options.max ?? -Infinity;
      if (options.min === undefined || options.max === undefined) {
        for (const point of series) {
          if (options.min === undefined) dataLo = Math.min(dataLo, point.value);
          if (options.max === undefined) dataHi = Math.max(dataHi, point.value);
        }
      }
      if (!Number.isFinite(dataLo) || !Number.isFinite(dataHi)) {
        dataLo = 0;
        dataHi = 1;
      }
      const spread = Math.max(dataHi - dataLo, 0.1 * Math.abs(dataHi), 1e-6);
      const targetLo = options.min ?? dataLo - 0.18 * spread;
      const targetHi = options.max ?? dataHi + 0.18 * spread;

      // The axis eases; a fixed min/max or reduced motion snaps it.
      if (options.reduced || state.hi - state.lo <= 0) {
        state.lo = targetLo;
        state.hi = targetHi;
      } else {
        const ease = 1 - Math.exp(-4 * delta);
        state.lo += (targetLo - state.lo) * ease;
        state.hi += (targetHi - state.hi) * ease;
      }

      const valueStep = niceStep(
        state.hi - state.lo,
        Math.max(2, Math.floor(innerHeight / 44)),
      );
      context.font = `12px ${palette.font}`;
      context.textBaseline = "middle";
      context.textAlign = "left";
      for (
        let value = Math.ceil(state.lo / valueStep) * valueStep;
        value <= state.hi;
        value += valueStep
      ) {
        const y = Math.round(yOf(value)) + 0.5;
        if (y < 12 || y > plotHeight - 22 + 2) continue;
        context.strokeStyle = palette.border;
        context.lineWidth = 1;
        context.globalAlpha = 1;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(plotWidth, y);
        context.stroke();
        context.fillStyle = palette.muted;
        context.fillText(
          numberFormat.format(Math.round(value * 100) / 100),
          plotWidth + 8,
          y,
        );
      }

      context.textBaseline = "alphabetic";
      const timeStep =
        1000 *
        niceStep(
          options.windowMs / 1000,
          Math.max(2, Math.floor(plotWidth / 90)),
        );
      for (let offset = 0; offset <= options.windowMs; offset += timeStep) {
        const x = plotWidth - (offset / options.windowMs) * plotWidth;
        context.textAlign = offset === 0 ? "right" : x < 20 ? "left" : "center";
        context.fillStyle = palette.muted;
        context.fillText(
          offset === 0 ? "now" : `−${Math.round(offset / 1000)}s`,
          x,
          plotHeight - 6,
        );
      }

      context.save();
      context.beginPath();
      context.rect(0, 0, plotWidth, plotHeight);
      context.clip();

      // Monotone cubic through the visible points: no overshoot between readings.
      const coords = series.map(
        (point) => [xOf(point.t), yOf(point.value)] as const,
      );
      const tangents = coords.map((point, index) => {
        if (coords.length < 2) return 0;
        const before =
          index > 0
            ? (coords[index][1] - coords[index - 1][1]) /
              Math.max(1e-6, coords[index][0] - coords[index - 1][0])
            : null;
        const after =
          index < coords.length - 1
            ? (coords[index + 1][1] - coords[index][1]) /
              Math.max(1e-6, coords[index + 1][0] - coords[index][0])
            : null;
        if (before === null) return after ?? 0;
        if (after === null) return before;
        if (before * after <= 0) return 0;
        return (2 * before * after) / (before + after);
      });
      const trace = () => {
        context.moveTo(coords[0][0], coords[0][1]);
        for (let index = 0; index < coords.length - 1; index += 1) {
          const span = (coords[index + 1][0] - coords[index][0]) / 3;
          context.bezierCurveTo(
            coords[index][0] + span,
            coords[index][1] + tangents[index] * span,
            coords[index + 1][0] - span,
            coords[index + 1][1] - tangents[index + 1] * span,
            coords[index + 1][0],
            coords[index + 1][1],
          );
        }
      };

      if (coords.length > 1) {
        context.beginPath();
        trace();
        context.lineTo(coords[coords.length - 1][0], plotHeight - 22);
        context.lineTo(coords[0][0], plotHeight - 22);
        context.closePath();
        context.fillStyle = palette.accent;
        context.globalAlpha = 0.08;
        context.fill();

        context.beginPath();
        trace();
        context.globalAlpha = 1;
        context.strokeStyle = palette.accent;
        context.lineWidth = 2;
        context.lineJoin = "round";
        context.lineCap = "round";
        context.stroke();
      }

      // Anomaly markers: a stem, a dot that pops in, and a tag that never overlaps its neighbour.
      let labelEnd = -Infinity;
      for (const point of visible) {
        if (!point.anomaly || point.t > t) continue;
        const x = xOf(point.t);
        const y = yOf(point.value);
        const arrival = state.arrivals.get(point.t);
        const age =
          options.reduced || arrival === undefined
            ? 1
            : (now - arrival) / 1000 - options.interval / 1000;
        if (age < 0) continue;
        const scale = options.reduced ? 1 : pop(age);

        context.globalAlpha = 0.45 * clamp(4 * age, 0, 1);
        context.strokeStyle = palette.mark;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(Math.round(x) + 0.5, 24);
        context.lineTo(Math.round(x) + 0.5, y - 6);
        context.stroke();

        context.globalAlpha = 1;
        context.beginPath();
        context.arc(x, y, 6 * scale, 0, 2 * Math.PI);
        context.fillStyle = palette.surface;
        context.fill();
        context.beginPath();
        context.arc(x, y, 4 * scale, 0, 2 * Math.PI);
        context.fillStyle = palette.mark;
        context.fill();

        const tag =
          typeof point.anomaly === "string" ? point.anomaly : "Anomaly";
        context.font = `500 12px ${palette.font}`;
        const tagWidth = context.measureText(tag).width + 14;
        const tagX = clamp(x - tagWidth / 2, 0, plotWidth - tagWidth);
        if (tagX < labelEnd + 4) continue;
        labelEnd = tagX + tagWidth;
        context.save();
        context.translate(tagX + tagWidth / 2, 15);
        context.scale(scale, scale);
        context.translate(-(tagX + tagWidth / 2), -15);
        context.beginPath();
        context.roundRect(tagX, 6, tagWidth, 18, 9);
        context.fillStyle = palette.surface;
        context.fill();
        context.strokeStyle = palette.border;
        context.lineWidth = 1;
        context.stroke();
        context.fillStyle = palette.ink;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(tag, tagX + tagWidth / 2, 15.5);
        context.restore();
      }

      const readout = options.hover;
      if (readout) {
        const x = Math.round(xOf(readout.t)) + 0.5;
        const y = yOf(readout.value);
        context.globalAlpha = 0.5;
        context.strokeStyle = palette.ink;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x, 14);
        context.lineTo(x, plotHeight - 22);
        context.stroke();
        context.globalAlpha = 1;
        context.beginPath();
        context.arc(x, y, 6, 0, 2 * Math.PI);
        context.fillStyle = palette.surface;
        context.fill();
        context.beginPath();
        context.arc(x, y, 4, 0, 2 * Math.PI);
        context.fillStyle = palette.accent;
        context.fill();
      }

      const [headX, headY] = coords[coords.length - 1];
      context.globalAlpha = 1;
      context.beginPath();
      context.arc(headX, headY, 6, 0, 2 * Math.PI);
      context.fillStyle = palette.surface;
      context.fill();
      context.beginPath();
      context.arc(headX, headY, 4, 0, 2 * Math.PI);
      context.fillStyle = palette.accent;
      context.fill();
      context.restore();
    };

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (document.hidden) return;
      const delta = Math.min(0.1, (now - lastFrame) / 1000);
      lastFrame = now;
      render(now, delta);
    };

    if (optionsRef.current.reduced) {
      render(performance.now(), 0.016);
      return;
    }
    if (inView) {
      frame = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(frame);
    }
    return;
  }, [inView, reduced, points, hover, height, windowMs, syncPalette]);

  const statusText = frozen
    ? pending > 0
      ? `Paused, ${pending} new`
      : "Paused"
    : "Live";

  const statusLabelRef = useRef<HTMLSpanElement | null>(null);
  const statusWidth = useMotionValue(0);
  const statusWidthAuto = useRef(true);
  useLayoutEffect(() => {
    const label = statusLabelRef.current;
    if (!label) return;
    const width = label.offsetWidth;
    if (reduced || statusWidthAuto.current) {
      statusWidth.jump(width);
      statusWidthAuto.current = false;
      // The first measurement can land before the webfont swaps in, which leaves the pill a pixel
      // narrow; re-measure once every face is ready.
      document.fonts?.ready.then(() => {
        const current = statusLabelRef.current;
        if (current) statusWidth.jump(current.offsetWidth);
      });
      return;
    }
    const controls = animate(statusWidth, width, motionTokens.spring.morph);
    return () => controls.stop();
  }, [statusText, reduced, statusWidth]);

  // Keep the last reading while the tooltip fades out.
  const [lastHover, setLastHover] = useState<HoverPoint | null>(hover);
  if (hover && hover !== lastHover) setLastHover(hover);
  const readout = hover ?? lastHover;

  const valueMotion = useMotionValue(latest?.value ?? 0);
  const displayValue = useTransform(valueMotion, (value) =>
    formatValue ? formatValue(value) : numberFormat.format(Math.round(value)),
  );
  useEffect(() => {
    if (!latest) return;
    if (reduced) {
      valueMotion.jump(latest.value);
      return;
    }
    const controls = animate(
      valueMotion,
      latest.value,
      motionTokens.spring.smooth,
    );
    return () => controls.stop();
  }, [latest, reduced, valueMotion]);

  const tipX = useMotionValue(0);
  const tipY = useMotionValue(0);
  const springX = useSpring(tipX, {
    stiffness: 520,
    damping: 44,
    restDelta: 0.01,
  });
  const springY = useSpring(tipY, {
    stiffness: 520,
    damping: 44,
    restDelta: 0.01,
  });

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    const plot = plotRef.current;
    if (!hover || !tooltip || !plot) {
      placedRef.current = false;
      return;
    }
    const width = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    const limit = plot.clientWidth - 44;
    let x = hover.x + 14;
    if (x + width > limit) x = hover.x - 14 - width;
    const y = clamp(
      hover.y - tooltipHeight - 12 < 0
        ? hover.y + 14
        : hover.y - tooltipHeight - 12,
      0,
      Math.max(0, height - tooltipHeight),
    );
    tipX.set(clamp(x, 0, Math.max(0, limit - width)));
    tipY.set(y);
    if (!placedRef.current || reduced) {
      springX.jump(tipX.get());
      springY.jump(y);
    }
    placedRef.current = true;
  });

  /** Plot-space geometry of the current frame, used to turn a client x into a point. */
  const geometry = () => {
    const state = chartRef.current;
    const options = optionsRef.current;
    const plotWidth = state.width - 44;
    const innerHeight = options.height - 14 - 22;
    const left = state.t - options.windowMs;
    return {
      xOf: (value: number) => ((value - left) / options.windowMs) * plotWidth,
      yOf: (value: number) =>
        14 + (1 - (value - state.lo) / (state.hi - state.lo)) * innerHeight,
      left,
      right: state.t,
      plotW: plotWidth,
    };
  };

  const pointAt = (index: number): HoverPoint | null => {
    const point = points[index];
    if (!point) return null;
    const plot = geometry();
    return {
      t: point.t,
      value: point.value,
      anomaly: point.anomaly,
      x: plot.xOf(point.t),
      y: plot.yOf(point.value),
    };
  };

  /** Nearest reading to a client x, ignoring points still to the right of the view. */
  const indexAt = (clientX: number): number | null => {
    const plot = plotRef.current;
    if (!plot || empty) return null;
    const rect = plot.getBoundingClientRect();
    const space = geometry();
    const target =
      space.left +
      clamp((clientX - rect.left) / Math.max(1, space.plotW), 0, 1) *
        (space.right - space.left);
    const index = lowerBound(points, target);
    const candidates = [index - 1, index].filter(
      (candidate) =>
        candidate >= 0 &&
        candidate < points.length &&
        points[candidate].t <= space.right,
    );
    if (!candidates.length) return null;
    return candidates.reduce((best, candidate) =>
      Math.abs(points[candidate].t - target) < Math.abs(points[best].t - target)
        ? candidate
        : best,
    );
  };

  const formatReading = (value: number) =>
    `${formatValue ? formatValue(value) : numberFormat.format(value)}${unit ? ` ${unit}` : ""}`;

  const handlePointerEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") setHovering(true);
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    setHovering(false);
    setHover(null);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" && !event.buttons) return;
    const index = indexAt(event.clientX);
    setHover(index === null ? null : pointAt(index));
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const index = indexAt(event.clientX);
    setHover(index === null ? null : pointAt(index));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") setHover(null);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (empty) return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      togglePause(!pausedValue);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setHover(null);
      if (pausedValue) togglePause(false);
      return;
    }
    const space = geometry();
    const oldest = lowerBound(points, space.left);
    const newest = lowerBound(points, space.right + 0.001) - 1;
    const current = readout ? lowerBound(points, readout.t) : newest + 1;
    const steps: Record<string, number> = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      Home: oldest,
      End: newest,
      PageUp: current - 10,
      PageDown: current + 10,
    };
    if (!(event.key in steps)) return;
    event.preventDefault();
    setHover(pointAt(clamp(steps[event.key], oldest, newest)));
  };

  const handleFocus = (event: ReactFocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.matches(":focus-visible") || empty) return;
    setHover(
      pointAt(Math.max(0, lowerBound(points, geometry().right + 0.001) - 1)),
    );
  };

  const readings = points.slice(-20);

  return (
    <figure
      ref={rootRef}
      className={[styles.figure, className].filter(Boolean).join(" ")}
      aria-label={label}
    >
      <div className={styles.head}>
        <p
          className={styles.now}
          aria-label={
            latest
              ? `${label}, ${formatReading(latest.value)}`
              : `${label}, ${emptyLabel}`
          }
        >
          <motion.span className={styles.value} aria-hidden="true">
            {latest ? displayValue : "0"}
          </motion.span>
          {unit ? (
            <span className={styles.unit} aria-hidden="true">
              {unit}
            </span>
          ) : null}
        </p>
        <button
          type="button"
          className={styles.status}
          data-held={frozen || undefined}
          aria-pressed={pausedValue}
          onClick={() => togglePause(!pausedValue)}
        >
          <span className={styles.statusDot} aria-hidden="true" />
          <motion.span
            className={styles.statusText}
            style={{ width: statusWidth }}
          >
            <span ref={statusLabelRef} className={styles.statusLabel}>
              {statusText}
            </span>
          </motion.span>
          <span className={styles.srOnly}>
            {pausedValue ? ", resume" : ", pause"}
          </span>
        </button>
      </div>
      <div
        ref={plotRef}
        className={styles.plot}
        style={{ height }}
        data-active={hover ? true : undefined}
        role="group"
        tabIndex={empty ? -1 : 0}
        aria-roledescription="live chart"
        aria-label={`${label}, last ${Math.round(windowMs / 1000)} seconds. Focus holds the view. Use left and right arrows to read points, Space to pause or resume.`}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setHover(null)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={() => setHover(null)}
      >
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          style={{ height }}
          aria-hidden="true"
        />
        <span ref={probeRef} className={styles.probe} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </span>
        <motion.div
          ref={tooltipRef}
          className={styles.tooltip}
          style={{ x: reduced ? tipX : springX, y: reduced ? tipY : springY }}
          aria-hidden="true"
        >
          <p className={styles.tipValue}>
            {readout ? formatReading(readout.value) : ""}
          </p>
          <p className={styles.tipMeta}>
            {readout
              ? `${formatTime(readout.t)}${readout.anomaly ? `, ${typeof readout.anomaly === "string" ? readout.anomaly.toLowerCase() : "anomaly"}` : ""}`
              : ""}
          </p>
        </motion.div>
        {empty ? <p className={styles.message}>{emptyLabel}</p> : null}
      </div>
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {hover
          ? `${formatTime(hover.t)}, ${formatReading(hover.value)}${hover.anomaly ? `, ${typeof hover.anomaly === "string" ? hover.anomaly : "anomaly"}` : ""}`
          : ""}
      </p>
      {empty ? null : (
        <div className={styles.srOnly}>
          <table>
            <caption>
              {label}, latest {readings.length} readings
            </caption>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Value</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((reading) => (
                <tr key={reading.t}>
                  <th scope="row">{formatTime(reading.t)}</th>
                  <td>{formatReading(reading.value)}</td>
                  <td>
                    {reading.anomaly
                      ? typeof reading.anomaly === "string"
                        ? reading.anomaly
                        : "Anomaly"
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}

export default RealtimeStream;
