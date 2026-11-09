"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import type { MotionValue } from "motion/react";
import { Mail, Newspaper, Pause, Play, Rocket, RotateCcw, TriangleAlert, Trophy, type LucideIcon } from "lucide-react";
import { Button } from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import { motionTokens } from "../motion-tokens";
import styles from "./line-replay.module.css";

/* ------------------------------------------------------------------ data model */

export type ReplayMomentKind = "launch" | "press" | "email" | "incident" | "milestone";

export interface ReplayPoint {
  /** Minutes from the start of the replay clock. Points must be in time order. */
  time: number;
  /** The replayed value at that minute. */
  value: number;
  /** Optional comparison series. Leave it off every point to hide the comparison line, its legend entry and the ratio readout. */
  baseline?: number;
}

export interface ReplayMoment {
  /** Stable id, also used as the React key. */
  id: string;
  /** Moment on the same clock as the points. Moments between points are placed by interpolation. */
  time: number;
  /** Title of the callout and of the row in the moments list. */
  title: string;
  /** One line under the title in the moments list. */
  detail?: string;
  /** Picks the icon, and makes incidents read as a dip in the warning color. Defaults to "launch". */
  kind?: ReplayMomentKind;
}

/* ------------------------------------------------------------------ sample data */

/** Deterministic mulberry32, so the sample launch day is identical on every render and on the server. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    let t = (state = (state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    return (((t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t) ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

/** A launch-shaped bump: nothing before `start`, a fast attack, then an exponential decay. */
function impulse(time: number, start: number, attack: number, decay: number) {
  if (time < start) return 0;
  const since = time - start;
  return (1 - Math.exp(-since / attack)) * Math.exp(-since / decay);
}

/**
 * A fabricated Tuesday, one point every five minutes: a lunch and an evening peak, five announcement
 * bumps, a short dip while the cache scaled out, and two smoothed noise walks for value and baseline.
 */
export const POINTS: ReplayPoint[] = (() => {
  const valueNoise = seeded(0x135282c);
  const baselineNoise = seeded(8092026);
  const points: ReplayPoint[] = [];
  let walk = 0;
  let baseWalk = 0;
  for (let minute = 0; minute < 1440; minute += 5) {
    walk = 0.82 * walk + (valueNoise() - 0.5) * 0.09;
    baseWalk = 0.8 * baseWalk + (baselineNoise() - 0.5) * 0.07;
    const hour = minute / 60;
    const baseline =
      150 +
      780 * Math.exp(-(((hour - 12.8) / 4.3) ** 2)) +
      120 * Math.exp(-(((hour - 20.5) / 1.8) ** 2));
    const raw =
      (1.08 * baseline +
        (1050 * impulse(minute, 360, 14, 260) +
          1500 * impulse(minute, 450, 45, 720) +
          5600 * impulse(minute, 580, 22, 150) +
          2300 * impulse(minute, 780, 10, 75) +
          900 * impulse(minute, 1200, 18, 150))) *
      (1 - 0.3 * impulse(minute, 680, 4, 22)) *
      (1 + walk);
    points.push({ time: minute, value: Math.round(raw), baseline: Math.round(baseline * (1 + baseWalk)) });
  }
  return points;
})();

export const MOMENTS: ReplayMoment[] = [
  { id: "post", time: 360, title: "Launch post published", detail: "Blog, X and LinkedIn at the same minute", kind: "launch" },
  { id: "hunt", time: 450, title: "Live on Product Hunt", detail: "Maker comment pinned by 7:34 am", kind: "press" },
  { id: "hn", time: 580, title: "Hacker News front page", detail: "Reached third place in 40 minutes", kind: "press" },
  { id: "slow", time: 680, title: "Pages slowed under load", detail: "Load time hit 3.8 s until the cache scaled out", kind: "incident" },
  { id: "news", time: 780, title: "Newsletter sent", detail: "48,200 subscribers, 41% opened in the first hour", kind: "email" },
  { id: "top", time: 1200, title: "Product of the day", detail: "Top of Product Hunt with 1,184 upvotes", kind: "milestone" },
];

/* ------------------------------------------------------------------ formatters */

/** "9:40 am" — the replay clock, used in the readout, the tip clock, callouts and the moments list. */
export function formatClock(minutes: number): string {
  const total = Math.round(minutes) % 1440;
  const hour = Math.floor(total / 60);
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(total % 60).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;
}

/** "6 am" — the time axis. */
export function formatHour(minutes: number): string {
  const hour = Math.floor(minutes / 60) % 24;
  return `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? "am" : "pm"}`;
}

const countFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** "6,041" — values, the tip label and moment effects. */
export function formatCount(value: number): string {
  return countFormatter.format(Math.round(value));
}

/* ------------------------------------------------------------------ motion presets */

const { spring, duration, ease } = motionTokens;
const glideSpring = { ...spring.smooth, restDelta: 0.001 };
/** Lane above the plot where callouts sit; the connector runs from here down to the marker. */
const CALLOUT_TOP = 52;

const SPEEDS = [
  { value: "0.5", label: "0.5×" },
  { value: "1", label: "1×" },
  { value: "2", label: "2×" },
  { value: "4", label: "4×" },
] as const;

const ICONS: Record<ReplayMomentKind, LucideIcon> = {
  launch: Rocket,
  press: Newspaper,
  email: Mail,
  incident: TriangleAlert,
  milestone: Trophy,
};

/* ------------------------------------------------------------------ geometry helpers */

/** Fractional index of `time` in the point clock, so a moment between points lands between points. */
function indexAtTime(times: number[], time: number) {
  if (time <= times[0]) return 0;
  const last = times.length - 1;
  if (time >= times[last]) return last;
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (times[mid] <= time) low = mid;
    else high = mid;
  }
  return low + (time - times[low]) / (times[high] - times[low] || 1);
}

/** Linear interpolation between the two points a fractional index falls between. */
function valueAt(values: number[], index: number) {
  const low = Math.floor(index);
  return low >= values.length - 1 ? values[values.length - 1] : values[low] + (values[low + 1] - values[low]) * (index - low);
}

type Domain = { lo: number; hi: number };

/* ------------------------------------------------------------------ block */

export interface LineReplayProps {
  /** Points in time order: `time` in minutes from the start, the replayed `value`, and an optional `baseline` drawn as a quiet dashed comparison. */
  data?: ReplayPoint[];
  /** Key moments on the same clock. Incidents dip for 20 minutes; every other moment reports the rise over the next hour. */
  moments?: ReplayMoment[];
  /** Heading of the block. */
  title?: string;
  /** One line under the heading that names what is measured and when. */
  description?: string;
  /** Legend name of the replayed line. */
  seriesLabel?: string;
  /** Legend name of the comparison line, also used in the ratio readout. */
  baselineLabel?: string;
  /** Label of the value under the playhead, in the readout and in the scrubber's value text. */
  valueLabel?: string;
  /** Formats a time on the replay clock for the readout, the clock, callouts and the moments list. */
  formatTime?: (minutes: number) => string;
  /** Formats the time axis labels. */
  formatTick?: (minutes: number) => string;
  /** Formats values in the readout, the tip label and moment effects. */
  formatValue?: (value: number) => string;
  /** Seconds a full replay takes at 1×. */
  duration?: number;
  /** Starting playback speed. */
  defaultSpeed?: 0.5 | 1 | 2 | 4;
  /** Where the playhead rests before the first play: the end shows every moment, the start waits at the first point. */
  defaultPosition?: "start" | "end";
  /** Plays from the start the first time the block is 40% in view. Ignored with reduced motion. */
  autoPlay?: boolean;
  /** Called when playback passes a moment, not when scrubbing or jumping to one. */
  onMomentReached?: (moment: ReplayMoment) => void;
  /** Class on the root element. */
  className?: string;
}

export function LineReplay({
  title = "Launch day",
  description = "People on site every five minutes on Tuesday 8 September 2026, Pacific time.",
  data = POINTS,
  moments = MOMENTS,
  seriesLabel = "Launch day",
  baselineLabel = "Typical Tuesday",
  valueLabel = "On site",
  formatTime = formatClock,
  formatTick = formatHour,
  formatValue = formatCount,
  duration: replayDuration = 16,
  defaultSpeed = 1,
  defaultPosition = "end",
  autoPlay = false,
  onMomentReached,
  className,
}: LineReplayProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const momentsId = `${id}-moments`;
  const reduce = useReducedMotion() ?? false;

  /* ---------------------------------------------------------------- derived data */

  /** Times, values, the running peak, the y ceiling and the annotated moments, all measured once per data set. */
  const shape = useMemo(() => {
    const times = data.map((point) => point.time);
    const values = data.map((point) => point.value);
    const baselines = data.length > 0 && data.every((point) => typeof point.baseline === "number") ? data.map((point) => point.baseline as number) : null;

    const peakIdx: number[] = [];
    values.forEach((value, index) => {
      peakIdx.push(index === 0 || value > values[peakIdx[index - 1]] ? index : peakIdx[index - 1]);
    });

    const max = Math.max(1, ...values, ...(baselines ?? []));

    const marks = [...moments]
      .sort((a, b) => a.time - b.time)
      .map((moment) => {
        const index = indexAtTime(times, moment.time);
        const value = valueAt(values, index);
        const incident = moment.kind === "incident";
        const window = incident ? 20 : 60;
        const endIndex = indexAtTime(times, moment.time + window);
        let best = value;
        for (let cursor = Math.ceil(index); cursor <= Math.floor(endIndex); cursor += 1) {
          best = incident ? Math.min(best, values[cursor]) : Math.max(best, values[cursor]);
        }
        const effect = incident
          ? `−${Math.round(((value - best) / (value || 1)) * 100)}% in ${window} minutes`
          : `+${formatValue(best - value)} in the next hour`;
        return { ...moment, index, endIndex, value, effect };
      });

    return { times, values, baselines, peakIdx, max, marks, last: Math.max(0, values.length - 1) };
  }, [data, moments, formatValue]);

  const { times, values, baselines, peakIdx, marks, last } = shape;

  /** The value axis is fixed to the whole series, so the line never rescales while it plays. */
  const yMax = useMemo(() => {
    const ceiling = 1.18 * shape.max;
    const magnitude = 10 ** Math.floor(Math.log10(ceiling));
    const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= ceiling / 4) ?? 10;
    return Math.ceil(ceiling / (step * magnitude)) * step * magnitude;
  }, [shape.max]);

  const start = defaultPosition === "end" ? last : 0;

  const countReached = useCallback((position: number) => marks.reduce((total, mark) => total + Number(mark.index <= position + 0.01), 0), [marks]);
  const settledAt = useCallback((position: number) => marks.map((mark) => (mark.endIndex <= position + 0.01 ? "1" : "0")).join(""), [marks]);

  /* ---------------------------------------------------------------- state */

  const position = useMotionValue(start);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(defaultSpeed);
  const [reached, setReached] = useState(() => countReached(start));
  const [settled, setSettled] = useState(() => settledAt(start));
  const [atEnd, setAtEnd] = useState(start >= last);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const playingRef = useRef(false);
  const reachedRef = useRef(reached);
  const settledRef = useRef(settled);
  const atEndRef = useRef(atEnd);
  /** Points advanced per second of wall clock, recomputed when the data, duration or speed change. */
  const rateRef = useRef(1);
  const dragging = useRef(false);
  const glide = useRef<{ stop: () => void } | null>(null);
  const momentCb = useRef(onMomentReached);

  useEffect(() => {
    momentCb.current = onMomentReached;
  }, [onMomentReached]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    rateRef.current = (last / Math.max(1, replayDuration)) * speed;
  }, [last, replayDuration, speed]);

  /** The first text is server-rendered from this snapshot; every frame after that writes straight to the DOM. */
  const [initial] = useState(() => {
    const peak = peakIdx[Math.floor(start)] ?? 0;
    const base = baselines ? valueAt(baselines, start) : 0;
    return {
      time: formatTime(valueAt(times, start)),
      value: formatValue(valueAt(values, start)),
      ratio: baselines ? `${(valueAt(values, start) / (base || 1)).toFixed(1)}×` : "",
      peak: `${formatValue(values[peak] ?? 0)} at ${formatTime(times[peak] ?? 0)}`,
      fraction: last ? start / last : 0,
    };
  });

  /* ---------------------------------------------------------------- size */

  const stage = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = stage.current;
    if (!node) return;
    const measure = () => {
      const width = Math.round(node.clientWidth);
      const height = Math.round(node.clientHeight);
      setSize((current) => (current && current.width === width && current.height === height ? current : { width, height }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /** Everything the frame loop writes: point positions, the axis and the domain mapping. Recomputed only on resize. */
  const geometry = useMemo(() => {
    if (!size || size.width < 40) return null;
    const { width, height } = size;
    const narrow = width < 520;
    const left = narrow ? 30 : 40;
    const plotBottom = height - 32;
    const plotWidth = width - left - 16;
    const plotHeight = plotBottom - 64;
    const yOf = (value: number) => 64 + plotHeight * (1 - value / yMax);
    const xOf = (index: number) => left + (last ? (index / last) * plotWidth : 0);
    const xs = values.map((_, index) => xOf(index));
    const ys = values.map((value) => yOf(value));
    const segments = xs.map((x, index) => `L${x.toFixed(1)} ${ys[index].toFixed(1)}`);
    const baselinePath = baselines ? baselines.map((value, index) => `${index ? "L" : "M"}${xs[index].toFixed(1)} ${yOf(value).toFixed(1)}`).join("") : null;
    const yTicks = [0, 1, 2, 3, 4].map((step) => ({ value: (yMax / 4) * step, y: yOf((yMax / 4) * step) }));
    const stepMinutes = narrow ? 360 : 180;
    const first = times[0] ?? 0;
    const final = times[last] ?? 0;
    const xTicks: { time: number; x: number }[] = [];
    for (let minute = Math.ceil(first / stepMinutes) * stepMinutes; minute <= final; minute += stepMinutes) {
      const x = xOf(indexAtTime(times, minute));
      if (x > left + 14 && x < width - 16 - 14) xTicks.push({ time: minute, x });
    }
    return { width, height, left, plotBottom, xs, ys, segments, baseline: baselinePath, yTicks, xTicks, yOf };
  }, [size, values, baselines, times, last, yMax]);

  /* ---------------------------------------------------------------- DOM writers */

  const linePath = useRef<SVGPathElement>(null);
  const areaPath = useRef<SVGPathElement>(null);
  const head = useRef<SVGGElement>(null);
  const tipAnchor = useRef<HTMLDivElement>(null);
  const tipNumber = useRef<HTMLSpanElement>(null);
  const clockAnchor = useRef<HTMLDivElement>(null);
  const clockNumber = useRef<HTMLSpanElement>(null);
  const xLabelNodes = useRef<(SVGTextElement | null)[]>([]);
  const timeNode = useRef<HTMLSpanElement>(null);
  const valueNode = useRef<HTMLSpanElement>(null);
  const ratioNode = useRef<HTMLSpanElement>(null);
  const peakNode = useRef<HTMLSpanElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const thumbRail = useRef<HTMLDivElement>(null);
  const scrubFocus = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const written = useRef<Record<string, string>>({});

  /** One text node per frame at most, and only when its text actually changed. */
  const setText = useCallback((key: string, node: HTMLElement | null, text: string) => {
    if (!node || written.current[key] === text) return;
    written.current[key] = text;
    node.textContent = text;
  }, []);

  /** Kept current on pointer release and while paused, so a screen reader is not flooded mid-replay. */
  const updateScrubberAria = useCallback(
    (index: number) => {
      const node = scrubFocus.current;
      if (!node) return;
      const time = valueAt(times, index);
      node.setAttribute("aria-valuenow", String(Math.round(time)));
      node.setAttribute("aria-valuetext", `${formatTime(time)}, ${formatValue(valueAt(values, index))} ${valueLabel.toLowerCase()}`);
    },
    [times, values, formatTime, formatValue, valueLabel],
  );

  const render = useCallback(
    (raw: number) => {
      const index = Math.min(last, Math.max(0, raw));
      const low = Math.floor(index);
      const value = valueAt(values, index);
      const time = valueAt(times, index);

      setText("time", timeNode.current, formatTime(time));
      setText("value", valueNode.current, formatValue(value));
      if (baselines) setText("ratio", ratioNode.current, `${(value / (valueAt(baselines, index) || 1)).toFixed(1)}×`);

      const peak = peakIdx[low] ?? 0;
      const above = value > values[peak];
      setText("peak", peakNode.current, `${formatValue(above ? value : values[peak])} at ${formatTime(above ? time : times[peak])}`);

      const fraction = last ? index / last : 0;
      if (fill.current) fill.current.style.transform = `scaleX(${fraction})`;
      const rail = track.current?.clientWidth ?? 0;
      if (thumbRail.current) thumbRail.current.style.transform = `translateX(${(fraction * rail).toFixed(2)}px)`;

      if (!playingRef.current) updateScrubberAria(index);

      const reachedNow = countReached(index);
      if (reachedNow !== reachedRef.current) {
        const rising = reachedNow > reachedRef.current;
        reachedRef.current = reachedNow;
        setReached(reachedNow);
        if (rising && playingRef.current) {
          const mark = marks[reachedNow - 1];
          setAnnouncement(`${formatTime(mark.time)}. ${mark.title}.`);
          momentCb.current?.(mark);
        }
      }

      const settledNow = settledAt(index);
      if (settledNow !== settledRef.current) {
        settledRef.current = settledNow;
        setSettled(settledNow);
      }

      const ended = index >= last - 1e-6;
      if (ended !== atEndRef.current) {
        atEndRef.current = ended;
        setAtEnd(ended);
      }

      if (!geometry) return;
      const { xs, ys, segments, left, plotBottom, width } = geometry;
      const x = xs[low] + (low < last ? (xs[low + 1] - xs[low]) * (index - low) : 0);
      const y = geometry.yOf(value);
      const path = `M${xs[0].toFixed(1)} ${ys[0].toFixed(1)}${segments.slice(1, low + 1).join("")}${index > low ? `L${x.toFixed(1)} ${y.toFixed(1)}` : ""}`;
      linePath.current?.setAttribute("d", path);
      areaPath.current?.setAttribute("d", `${path}L${x.toFixed(1)} ${plotBottom}L${left} ${plotBottom}Z`);
      head.current?.setAttribute("transform", `translate(${x.toFixed(2)} 0)`);
      const dot = head.current?.lastElementChild;
      dot?.setAttribute("cy", y.toFixed(2));

      if (tipAnchor.current) {
        tipAnchor.current.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
        tipAnchor.current.toggleAttribute("data-flip", x > width - 96);
      }
      setText("tip", tipNumber.current, formatValue(value));

      const clockX = Math.min(width - 36, Math.max(left + 20, x));
      if (clockAnchor.current) clockAnchor.current.style.transform = `translate(${clockX.toFixed(2)}px, ${plotBottom + 16}px)`;
      setText("clock", clockNumber.current, formatTime(time));

      geometry.xTicks.forEach((tick, tickIndex) => {
        const node = xLabelNodes.current[tickIndex];
        if (node) node.dataset.hidden = String(Math.abs(tick.x - clockX) < 58);
      });
    },
    [geometry, last, values, times, baselines, peakIdx, marks, countReached, settledAt, formatTime, formatValue, updateScrubberAria, setText],
  );

  useLayoutEffect(() => {
    written.current = {};
    render(position.get());
    return position.on("change", render);
  }, [position, render]);

  useEffect(() => {
    const node = track.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => render(position.get()));
    observer.observe(node);
    return () => observer.disconnect();
  }, [render, position]);

  /* ---------------------------------------------------------------- playback */

  /** Replay and jumps glide on the smooth spring; a new jump mid-way picks up where the playhead is. */
  const seek = useCallback(
    (target: number, animateTo: boolean) => {
      glide.current?.stop();
      glide.current = null;
      const next = Math.min(last, Math.max(0, target));
      if (!animateTo || reduce) {
        position.set(next);
        return;
      }
      const controls = animate(position, next, glideSpring);
      glide.current = controls;
      controls.then(() => {
        if (glide.current === controls) glide.current = null;
      });
    },
    [last, reduce, position],
  );

  useEffect(() => {
    if (!playing) {
      updateScrubberAria(position.get());
      return;
    }
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(0.1, (now - previous) / 1000);
      previous = now;
      if (!dragging.current && !glide.current) {
        const next = position.get() + delta * rateRef.current;
        if (next >= last) {
          position.set(last);
          setPlaying(false);
          const peak = peakIdx[last] ?? 0;
          setAnnouncement(`Replay finished. Peak ${formatValue(values[peak])} at ${formatTime(times[peak])}.`);
          return;
        }
        position.set(next);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, last, position, peakIdx, values, times, formatTime, formatValue, updateScrubberAria]);

  const play = useCallback(() => {
    if (atEndRef.current || position.get() >= last - 1e-6) seek(0, true);
    setAnnouncement("Playing");
    setPlaying(true);
  }, [last, seek, position]);

  const toggle = () => {
    if (playing) {
      setPlaying(false);
      setAnnouncement(`Paused at ${formatTime(valueAt(times, position.get()))}`);
    } else {
      play();
    }
  };

  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = root.current;
    if (!autoPlay || reduce || !node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          seek(0, false);
          setPlaying(true);
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [autoPlay, reduce, seek]);

  /* ---------------------------------------------------------------- pointer + keyboard */

  /** Maps a pointer x onto the replay clock, from the track or from the plot area. */
  const positionAt = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.dataset.area === "track") {
      const box = (track.current ?? event.currentTarget).getBoundingClientRect();
      return ((event.clientX - box.left) / (box.width || 1)) * last;
    }
    if (!geometry) return position.get();
    const box = event.currentTarget.getBoundingClientRect();
    const usable = geometry.width - geometry.left - 16;
    return ((event.clientX - box.left - geometry.left) / (usable || 1)) * last;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    glide.current?.stop();
    glide.current = null;
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    position.set(Math.min(last, Math.max(0, positionAt(event))));
    if (event.currentTarget.dataset.area === "track") scrubFocus.current?.focus({ preventScroll: true });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    position.set(Math.min(last, Math.max(0, positionAt(event))));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    updateScrubberAria(position.get());
  };

  /** One hour of playback in points, for Shift + arrow and Page up/down. */
  const hourStep = useMemo(() => {
    const span = (times[last] ?? 0) - (times[0] ?? 0);
    return span > 0 ? (last / span) * 60 : 12;
  }, [times, last]);

  const onScrubKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = position.get();
    let target: number | null = null;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        target = Math.floor(current + 1e-6) + (event.shiftKey ? hourStep : 1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        target = Math.ceil(current - 1e-6) - (event.shiftKey ? hourStep : 1);
        break;
      case "PageUp":
        target = current + hourStep;
        break;
      case "PageDown":
        target = current - hourStep;
        break;
      case "Home":
        target = 0;
        break;
      case "End":
        target = last;
        break;
      case " ":
      case "Enter":
      case "k":
      case "K":
        event.preventDefault();
        toggle();
        return;
      default:
        return;
    }
    event.preventDefault();
    seek(target, false);
    updateScrubberAria(Math.min(last, Math.max(0, target)));
  };

  /* ---------------------------------------------------------------- callout */

  const reachedMark = reached > 0 ? marks[reached - 1] : null;
  const hovered = hoverId ? (marks.find((mark, index) => mark.id === hoverId && index < reached) ?? null) : null;
  const active = hovered ?? reachedMark;

  const startTime = times[0] ?? 0;
  const endTime = times[last] ?? 0;

  const playLabel = playing ? "Pause" : atEnd ? "Replay" : "Play";
  const PlayIcon = playing ? Pause : atEnd ? RotateCcw : Play;
  const playAria = playing ? "Pause replay" : atEnd ? "Replay from the start" : "Play replay";

  let callout: { x: number; y: number; align: "start" | "center" | "end" } | null = null;
  if (active && geometry) {
    const low = Math.floor(active.index);
    const x = geometry.xs[low] + (low < last ? (geometry.xs[low + 1] - geometry.xs[low]) * (active.index - low) : 0);
    callout = {
      x,
      y: geometry.yOf(active.value),
      align: x < geometry.left + 110 ? "start" : x > geometry.width - 120 ? "end" : "center",
    };
  }

  useEffect(() => {
    // A new moment can arrive without a render of its own, so the connector and callout re-measure with it.
  }, [active?.id]);

  return (
    <section className={[styles.root, className].filter(Boolean).join(" ")} aria-labelledby={titleId}>
      <div className={styles.surface}>
        <div className={styles.main}>
          <header className={styles.header}>
            <div className={styles.heading}>
              <h2 id={titleId}>{title}</h2>
              {description ? <p>{description}</p> : null}
            </div>
            <ul className={styles.legend} aria-label="Legend">
              <li>
                <svg className={styles.swatch} viewBox="0 0 20 8" aria-hidden="true">
                  <line className={styles.swLine} x1="1" y1="4" x2="19" y2="4" />
                </svg>
                {seriesLabel}
              </li>
              {baselines ? (
                <li>
                  <svg className={styles.swatch} viewBox="0 0 20 8" aria-hidden="true">
                    <line className={styles.swBase} x1="1" y1="4" x2="19" y2="4" />
                  </svg>
                  {baselineLabel}
                </li>
              ) : null}
            </ul>
          </header>

          <dl className={styles.readout}>
            <div className={styles.readTime}>
              <dt>Time</dt>
              <dd>
                <span ref={timeNode}>{initial.time}</span>
              </dd>
            </div>
            <div>
              <dt>{valueLabel}</dt>
              <dd>
                <span ref={valueNode} className={styles.readStrong}>
                  {initial.value}
                </span>
              </dd>
            </div>
            {baselines ? (
              <div>
                <dt>{`Versus ${baselineLabel.charAt(0).toLowerCase()}${baselineLabel.slice(1)}`}</dt>
                <dd>
                  <span ref={ratioNode}>{initial.ratio}</span>
                </dd>
              </div>
            ) : null}
            <div className={styles.readPeak}>
              <dt>Peak so far</dt>
              <dd>
                <span ref={peakNode}>{initial.peak}</span>
              </dd>
            </div>
          </dl>

          <div
            ref={stage}
            className={styles.stage}
            data-ready={geometry ? "" : undefined}
            data-area="chart"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-hidden="true"
          >
            {geometry ? (
              <svg className={styles.plot} width={geometry.width} height={geometry.height} viewBox={`0 0 ${geometry.width} ${geometry.height}`}>
                {geometry.yTicks.map((tick) => (
                  <g key={tick.value}>
                    <line
                      className={tick.value === 0 ? styles.axis : styles.grid}
                      x1={geometry.left}
                      x2={geometry.width - 16}
                      y1={Math.round(tick.y) + 0.5}
                      y2={Math.round(tick.y) + 0.5}
                    />
                    <text className={styles.yLabel} x={geometry.left - 8} y={tick.y} dy="0.32em">
                      {tick.value === 0 ? "0" : tick.value >= 1000 ? `${tick.value / 1000}k` : String(tick.value)}
                    </text>
                  </g>
                ))}
                {geometry.xTicks.map((tick, index) => (
                  <text
                    key={tick.time}
                    ref={(node) => {
                      xLabelNodes.current[index] = node;
                    }}
                    className={styles.xLabel}
                    x={tick.x}
                    y={geometry.plotBottom + 16}
                    dy="0.32em"
                  >
                    {formatTick(tick.time)}
                  </text>
                ))}
                {geometry.baseline ? <path className={styles.baseline} d={geometry.baseline} /> : null}
                <path ref={areaPath} className={styles.area} />
                {marks.map((mark, index) => {
                  const low = Math.floor(mark.index);
                  const x = geometry.xs[low] + (low < last ? (geometry.xs[low + 1] - geometry.xs[low]) * (mark.index - low) : 0);
                  const y = geometry.yOf(mark.value);
                  return (
                    <line
                      key={`${mark.id}-stem`}
                      className={styles.stem}
                      x1={x}
                      x2={x}
                      y1={y + 6}
                      y2={geometry.plotBottom}
                      data-passed={index < reached ? "" : undefined}
                    />
                  );
                })}
                <AnimatePresence initial={false}>
                  {active && callout ? (
                    <motion.line
                      key={active.id}
                      className={styles.connector}
                      x1={callout.x}
                      x2={callout.x}
                      y1={CALLOUT_TOP}
                      y2={Math.max(CALLOUT_TOP, callout.y - 7)}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: duration.exit } }}
                      transition={{ duration: reduce ? duration.instant : duration.standard }}
                    />
                  ) : null}
                </AnimatePresence>
                <path ref={linePath} className={styles.line} />
                {marks.map((mark, index) => {
                  const low = Math.floor(mark.index);
                  const x = geometry.xs[low] + (low < last ? (geometry.xs[low + 1] - geometry.xs[low]) * (mark.index - low) : 0);
                  const y = geometry.yOf(mark.value);
                  return (
                    <circle
                      key={mark.id}
                      className={styles.mark}
                      cx={x}
                      cy={y}
                      r={4}
                      data-passed={index < reached ? "" : undefined}
                      data-shown={active?.id === mark.id ? "" : undefined}
                      data-incident={mark.kind === "incident" ? "" : undefined}
                    />
                  );
                })}
                <g ref={head} className={styles.head}>
                  <line className={styles.playhead} x1={0} x2={0} y1={64} y2={geometry.plotBottom} />
                  <circle className={styles.tipDot} cx={0} cy={0} r={4.5} />
                </g>
              </svg>
            ) : null}
            <div ref={tipAnchor} className={styles.anchor}>
              <span className={styles.tip}>
                <span ref={tipNumber} className={styles.num}>
                  {initial.value}
                </span>
              </span>
            </div>
            <div ref={clockAnchor} className={styles.anchor}>
              <span className={styles.clock}>
                <span ref={clockNumber} className={styles.num}>
                  {initial.time}
                </span>
              </span>
            </div>
            <AnimatePresence initial={false}>
              {active && callout ? (
                <div key={active.id} className={styles.calloutAnchor} style={{ left: callout.x, top: CALLOUT_TOP }} data-align={callout.align}>
                  <motion.div
                    className={styles.callout}
                    data-incident={active.kind === "incident" ? "" : undefined}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: duration.exit, ease: [...ease.exit] } }}
                    transition={reduce ? { duration: duration.instant } : spring.smooth}
                  >
                    <span className={styles.calloutTitle}>{active.title}</span>
                    <span className={styles.calloutTime}>{formatTime(active.time)}</span>
                  </motion.div>
                </div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className={styles.transport}>
            <Button variant="primary" className={styles.playButton} onClick={toggle} aria-label={playAria}>
              <PlayIcon size={16} strokeWidth={1.75} aria-hidden="true" />
              <span className={styles.playLabel}>{playLabel}</span>
            </Button>
            <div className={styles.scrub} data-area="track" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
              <div
                ref={scrubFocus}
                className={styles.scrubFocus}
                role="slider"
                tabIndex={0}
                aria-label="Replay position"
                aria-valuemin={Math.round(startTime)}
                aria-valuemax={Math.round(endTime)}
                aria-valuenow={Math.round(valueAt(times, start))}
                aria-valuetext={`${initial.time}, ${initial.value} ${valueLabel.toLowerCase()}`}
                aria-describedby={momentsId}
                onKeyDown={onScrubKeyDown}
              >
                <div ref={track} className={styles.track}>
                  <div ref={fill} className={styles.fill} style={{ transform: `scaleX(${initial.fraction})` }} />
                  {marks.map((mark, index) => (
                    <span
                      key={mark.id}
                      className={styles.tick}
                      style={{ left: `${(last ? mark.index / last : 0) * 100}%` }}
                      data-passed={index < reached ? "" : undefined}
                      data-incident={mark.kind === "incident" ? "" : undefined}
                    />
                  ))}
                  <div ref={thumbRail} className={styles.thumbRail}>
                    <span className={styles.thumb} />
                  </div>
                </div>
              </div>
            </div>
            <SegmentedControl
              className={styles.speed}
              label="Playback speed"
              options={[...SPEEDS]}
              value={String(speed)}
              onValueChange={(value) => setSpeed(Number(value))}
            />
          </div>
        </div>

        <aside className={styles.aside} aria-labelledby={momentsId}>
          <h3 id={momentsId} className={styles.asideTitle}>
            Key moments
          </h3>
          <ol className={styles.moments}>
            {marks.map((mark, index) => {
              const Icon = ICONS[mark.kind ?? "launch"];
              const state = index < reached ? (index === reached - 1 ? "current" : "passed") : "upcoming";
              return (
                <li key={mark.id}>
                  <button
                    type="button"
                    className={styles.moment}
                    data-state={state}
                    data-incident={mark.kind === "incident" ? "" : undefined}
                    aria-current={state === "current" ? "true" : undefined}
                    onClick={() => {
                      seek(mark.index, true);
                      setAnnouncement(`Moved to ${formatTime(mark.time)}, ${mark.title}`);
                    }}
                    onPointerEnter={() => setHoverId(mark.id)}
                    onPointerLeave={() => setHoverId((current) => (current === mark.id ? null : current))}
                    onFocus={() => setHoverId(mark.id)}
                    onBlur={() => setHoverId((current) => (current === mark.id ? null : current))}
                  >
                    <Icon className={styles.momentIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
                    <span className={styles.momentBody}>
                      <span className={styles.momentTop}>
                        <span className={styles.momentTitle}>{mark.title}</span>
                        <span className={styles.momentTime}>{formatTime(mark.time)}</span>
                      </span>
                      {mark.detail ? <span className={styles.momentDetail}>{mark.detail}</span> : null}
                      <span className={styles.momentEffect} data-settled={settled[index] === "1" ? "" : undefined} aria-hidden={settled[index] === "1" ? undefined : true}>
                        {mark.effect}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}

export default LineReplay;
