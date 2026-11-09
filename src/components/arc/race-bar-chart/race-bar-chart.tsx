"use client";

import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type Ref,
} from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type Variants,
} from "motion/react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./race-bar-chart.module.css";

export interface RaceBarItem {
  /** Stable identity. A bar keeps its identity across frames, so overtakes read as a slide rather than a swap. */
  id: string;
  /** Name on the row, in the tooltip, and in the table. */
  label: string;
  /** Group id from `groups`. Picks the bar hue and the legend entry. */
  group?: string;
}

export interface RaceBarGroup {
  id: string;
  label: string;
}

export interface RaceBarFrame {
  /** Period name, such as "March". Rolls in large type and labels the timeline. */
  period: string;
  /** Value per item id for this period. Missing ids count as zero. */
  values: Record<string, number>;
}

/** Use a race bar chart when the ranking itself is the story: who leads in each period, and who overtakes whom. */
export interface RaceBarChartProps {
  /** The things being ranked. A stable id keeps each bar's identity across frames. */
  items: RaceBarItem[];
  /** One frame per period, in order. Missing ids count as zero. */
  frames: RaceBarFrame[];
  /** What is ranked. Names the chart for assistive technology. */
  label: string;
  /** Names and order of the groups. The first four take the series hues and a legend appears; without groups every bar takes the first hue. */
  groups?: RaceBarGroup[];
  /** Formats values on bars, in the tooltip, and in the table. Defaults to a compact number, such as 12K. */
  formatValue?: (value: number) => string;
  /** Formats the value axis. Defaults to `formatValue`. */
  formatTick?: (value: number) => string;
  /** Bars shown at once. Items below the cut slide out of view. Defaults to 8. */
  bars?: number;
  /** Controlled frame index. A new value glides the race there. */
  frame?: number;
  /** Initial frame when uncontrolled. Defaults to 0. */
  defaultFrame?: number;
  /** Called when the shown period changes. */
  onFrameChange?: (index: number) => void;
  /** Controlled playback. */
  playing?: boolean;
  /** Initial playback when uncontrolled. Defaults to false. */
  defaultPlaying?: boolean;
  /** Called when playback starts or stops. */
  onPlayingChange?: (playing: boolean) => void;
  /** Starts playing the first time the chart scrolls into view. Ignored with reduced motion. Defaults to true. */
  autoPlay?: boolean;
  /** Milliseconds per period while playing. Defaults to 1400. */
  frameDuration?: number;
  /** Rewinds to the first period after the last and keeps playing. Defaults to false. */
  loop?: boolean;
  /** Item id whose name and value are emphasized, such as your own product. */
  highlight?: string;
  /** Extra class on the root figure. */
  className?: string;
  ref?: Ref<HTMLElement>;
}

/** Physics for a "visual duration" spring: the closed form of motion's two-parameter springs. */
const physical = ({
  visualDuration,
  bounce,
}: {
  visualDuration: number;
  bounce: number;
}) => {
  const root = (2 * Math.PI) / (1.2 * visualDuration);
  return { k: root * root, c: 2 * (1 - bounce) * root };
};
/** Rows travelling between ranks: 0.5s, no overshoot. */
const rowSpring = physical({ visualDuration: 0.5, bounce: 0 });
/** The drawn clock chasing the requested time: 0.42s, critically damped, so a step glides instead of jumping. */
const clockSpring = physical({ visualDuration: 0.42, bounce: 0 });
const snappy = physical(motionTokens.spring.snappy);
/** Tooltip follow, as a `useSpring` config. */
const follow = { stiffness: snappy.k, damping: snappy.c, restDelta: 0.01 };

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});
const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));
/** Series hue per group position; anything past the fourth falls back to a neutral tint of the foreground. */
const seriesColor = (index: number) =>
  index < 0
    ? "var(--series-1)"
    : index < 4
      ? `var(--series-${index + 1})`
      : "color-mix(in oklab, var(--foreground) 45%, var(--surface))";

/** Clean axis steps of 1, 2 or 5 × a power of ten, aiming for `count` divisions. */
function niceStep(max: number, count = 4) {
  const raw = max / count || 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const rank = raw / power;
  return (rank >= 5 ? 5 : rank >= 2 ? 2 : 1) * power;
}

type Bar = { y: number; vy: number; o: number; rank: number; value: number };

/** Mutable clock: the rAF loop owns these fields so React never re-renders per frame. */
type Clock = {
  time: number;
  shown: number;
  v: number;
  hold: number;
  step: number;
  raf: number;
  last: number;
  index: number;
  bars: Bar[];
  ticks: Map<number, HTMLDivElement>;
  scrubbing: boolean;
  tipOn: boolean;
  atEnd: boolean;
};

/** What the loop reads each frame; refreshed every render so the loop is never stale. */
type Live = {
  matrix: number[][];
  items: RaceBarItem[];
  shown: number;
  isPlaying: boolean;
  reduced: boolean;
  frameDuration: number;
  loop: boolean;
  width: number;
  labelWidth: number;
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
  active: string | null;
  count: number;
  setPlay: (playing: boolean) => void;
  onFrameChange?: (index: number) => void;
};

const subscribeNothing = () => () => {};
const wordVariants: Variants = {
  hidden: (distance: number) => ({
    opacity: 0,
    y: `${0.4 * distance}em`,
    filter: `blur(${motionTokens.blur.soft}px)`,
  }),
  shown: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: motionTokens.duration.standard,
      ease: [...motionTokens.ease.enter],
    },
  },
  gone: (distance: number) => ({
    opacity: 0,
    y: `${-0.4 * distance}em`,
    filter: `blur(${motionTokens.blur.subtle}px)`,
    transition: {
      duration: motionTokens.duration.exit,
      ease: [...motionTokens.ease.standard],
    },
  }),
};
const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: motionTokens.duration.fast } },
  gone: { opacity: 0, transition: { duration: motionTokens.duration.instant } },
};

export function RaceBarChart({
  items,
  groups,
  frames,
  label,
  formatValue = (value) => compact.format(value),
  formatTick,
  bars = 8,
  frame,
  defaultFrame = 0,
  onFrameChange,
  playing,
  defaultPlaying = false,
  onPlayingChange,
  autoPlay = true,
  frameDuration = 1400,
  loop = false,
  highlight,
  className,
  ref,
}: RaceBarChartProps) {
  // Reduced motion only after hydration: the server has no media query, and swapping the variants
  // mid-commit would replay the period word on every load.
  const hydrated = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  const reduced = !!useReducedMotion() && hydrated;
  const figure = useRef<HTMLElement>(null);
  const plot = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const totalText = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const rowEls = useRef(new Map<string, HTMLDivElement>());
  const labelEls = useRef(new Map<string, HTMLSpanElement>());
  useImperativeHandle(ref, () => figure.current as HTMLElement);
  const inView = useInView(figure, { amount: 0.35 });

  const count = frames.length;
  const lastFrame = Math.max(0, count - 1);
  const shownBars = Math.max(1, Math.min(bars, items.length));
  const matrix = useMemo(
    () =>
      frames.map((entry) =>
        items.map((item) => Math.max(0, entry.values[item.id] ?? 0)),
      ),
    [frames, items],
  );
  const initial = clamp(Math.round(frame ?? defaultFrame), 0, lastFrame);

  const [index, setIndex] = useState(initial);
  const [ownPlaying, setOwnPlaying] = useState(defaultPlaying);
  const isPlaying = (playing ?? ownPlaying) && count > 1;
  const [active, setActive] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [atEnd, setAtEnd] = useState(initial >= lastFrame);

  // Below 400px names move inside the bars; the label column narrows in two steps above that.
  const inside = width > 0 && width < 400;
  const labelWidth = inside ? 0 : width < 520 ? 104 : 128;
  const groupIndex = new Map(
    (groups ?? []).map((group, i) => [group.id, i] as const),
  );

  const clock = useRef<Clock>({
    time: initial,
    shown: initial,
    v: 0,
    hold: 0,
    step: 0,
    raf: 0,
    last: 0,
    index: initial,
    bars: [],
    ticks: new Map(),
    scrubbing: false,
    tipOn: false,
    atEnd: initial >= lastFrame,
  });
  const tipX = useMotionValue(0);
  const tipY = useMotionValue(0);
  const tipSpringX = useSpring(tipX, follow);
  const tipSpringY = useSpring(tipY, follow);

  const setPlay = (next: boolean) => {
    if (playing === undefined) setOwnPlaying(next);
    onPlayingChange?.(next);
  };

  const live = useRef<Live>({
    matrix,
    items,
    shown: shownBars,
    isPlaying,
    reduced,
    frameDuration,
    loop,
    width,
    labelWidth,
    formatValue,
    formatTick: formatTick ?? formatValue,
    active,
    count,
    setPlay,
    onFrameChange,
  });
  useLayoutEffect(() => {
    live.current = {
      matrix,
      items,
      shown: shownBars,
      isPlaying,
      reduced,
      frameDuration,
      loop,
      width,
      labelWidth,
      formatValue,
      formatTick: formatTick ?? formatValue,
      active,
      count,
      setPlay,
      onFrameChange,
    };
  });

  const run = useRef<() => void>(() => {});

  // One rAF loop writes transforms, widths and text straight to the DOM. React only re-renders when
  // the rounded period changes, so a race with twelve periods costs twelve commits, not 60fps worth.
  useEffect(() => {
    const state = clock.current;
    const tick = (now: number) => {
      const dt = state.last
        ? Math.min(0.05, (now - state.last) / 1000)
        : 1 / 60;
      state.last = now;
      const current = live.current;
      const total = current.count;
      const last = Math.max(0, total - 1);
      if (!total) return;

      // Requested time: a clock, not a stopwatch — it advances in period units per frameDuration.
      if (current.isPlaying && !state.scrubbing) {
        if (state.time >= last - 1e-6) {
          state.hold += 1000 * dt;
          if (state.hold >= 0.9 * current.frameDuration) {
            state.hold = 0;
            if (current.loop) state.time = 0;
            else current.setPlay(false);
          }
        } else if (current.reduced) {
          state.step += 1000 * dt;
          if (state.step >= current.frameDuration) {
            state.step = 0;
            state.time = Math.min(last, Math.floor(state.time + 1e-6) + 1);
          }
        } else {
          state.time = Math.min(
            last,
            state.time + (1000 * dt) / current.frameDuration,
          );
        }
      }

      // The drawn clock follows the requested one on a critically damped spring, so steps glide and
      // a replay sweeps back through the periods instead of cutting.
      if (current.reduced) {
        state.shown = state.time;
        state.v = 0;
      } else {
        const accel =
          -clockSpring.k * (state.shown - state.time) - clockSpring.c * state.v;
        state.v += accel * dt;
        state.shown += state.v * dt;
        if (
          Math.abs(state.shown - state.time) < 1e-4 &&
          Math.abs(state.v) < 0.001
        ) {
          state.shown = state.time;
          state.v = 0;
        }
      }

      const shown = clamp(state.shown, 0, last);
      const base = Math.floor(shown);
      const ahead = Math.min(last, base + 1);
      const mix = shown - base;
      const values = current.items.map((_, i) => {
        const from = current.matrix[base]?.[i] ?? 0;
        return from + ((current.matrix[ahead]?.[i] ?? 0) - from) * mix;
      });
      const order = values
        .map((_, i) => i)
        .sort((a, b) => values[b] - values[a] || a - b);
      const max = values[order[0]] || 1;
      const left = current.labelWidth ? current.labelWidth + 12 : 0;
      const track = Math.max(40, current.width - left - 64);
      let animating = current.isPlaying || state.shown !== state.time;
      let sum = 0;

      order.forEach((itemIndex, rank) => {
        const item = current.items[itemIndex];
        let bar = state.bars[itemIndex];
        if (!bar)
          bar = state.bars[itemIndex] = {
            y: 36 * Math.min(rank, current.shown),
            vy: 0,
            o: +(rank < current.shown),
            rank,
            value: 0,
          };
        const target = 36 * Math.min(rank, current.shown);
        const visible = +(rank < current.shown);
        if (current.reduced) {
          bar.y = target;
          bar.vy = 0;
          bar.o = visible;
        } else {
          // Substep at 120Hz so a long frame cannot overshoot the spring.
          const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
          const slice = dt / steps;
          for (let s = 0; s < steps; s++) {
            const accel =
              -rowSpring.k * (bar.y - target) - rowSpring.c * bar.vy;
            bar.vy += accel * slice;
            bar.y += bar.vy * slice;
          }
          if (Math.abs(bar.y - target) < 0.05 && Math.abs(bar.vy) < 0.05) {
            bar.y = target;
            bar.vy = 0;
          } else animating = true;
          bar.o += (visible - bar.o) * Math.min(1, 9 * dt);
          if (Math.abs(bar.o - visible) < 0.01) bar.o = visible;
          else animating = true;
        }
        bar.rank = rank;
        bar.value = values[itemIndex];
        sum += values[itemIndex];

        if (!item) return;
        const node = rowEls.current.get(item.id);
        if (!node) return;
        const barWidth = Math.max(2, (values[itemIndex] / max) * track);
        node.style.transform = `translate3d(0, ${bar.y.toFixed(2)}px, 0)`;
        node.style.opacity = bar.o.toFixed(3);
        node.style.visibility = bar.o < 0.01 ? "hidden" : "visible";
        node.style.zIndex = String(current.items.length - rank);
        const barEl = node.children[1] as HTMLElement;
        const valueEl = node.children[2] as HTMLElement;
        barEl.style.width = `${barWidth.toFixed(2)}px`;
        // With a label column the value sits right after the bar head; without one the name lives
        // inside the bar, so a short bar still has to clear its own label.
        const valueX = current.labelWidth
          ? barWidth
          : Math.max(
              barWidth,
              (labelEls.current.get(item.id)?.offsetWidth ?? 0) + 16,
            );
        valueEl.style.transform = `translate3d(${(left + valueX + 8).toFixed(2)}px, 0, 0)`;
        const text = current.formatValue(values[itemIndex]);
        if (valueEl.textContent !== text) valueEl.textContent = text;
      });

      if (totalText.current) {
        const text = `Total ${current.formatValue(sum)}`;
        if (totalText.current.textContent !== text)
          totalText.current.textContent = text;
      }

      // Axis ticks: created and removed imperatively, keyed by their numeric value so the same tick
      // keeps its node and glides when the scale changes.
      const gridEl = grid.current;
      if (gridEl) {
        const step = niceStep(max, Math.max(1, Math.floor(track / 80)));
        const wanted = new Set<number>();
        for (let value = step; value <= 1.001 * max; value += step)
          wanted.add(Math.round(value * 1e6) / 1e6);
        for (const value of wanted) {
          let node = state.ticks.get(value);
          if (!node) {
            node = document.createElement("div");
            node.className = styles.tick;
            const tickLabel = document.createElement("span");
            tickLabel.className = styles.tickLabel;
            tickLabel.textContent = current.formatTick(value);
            node.appendChild(tickLabel);
            gridEl.appendChild(node);
            state.ticks.set(value, node);
            requestAnimationFrame(() => node?.setAttribute("data-on", ""));
          }
          node.style.transform = `translate3d(${(left + (value / max) * track).toFixed(2)}px, 0, 0)`;
        }
        for (const [value, node] of state.ticks) {
          if (wanted.has(value)) continue;
          state.ticks.delete(value);
          node.removeAttribute("data-on");
          node.setAttribute("data-leaving", "");
          window.setTimeout(() => node.remove(), 320);
        }
      }

      const progress = last ? shown / last : 0;
      if (thumb.current)
        thumb.current.style.left = `${(100 * progress).toFixed(3)}%`;
      if (fill.current)
        fill.current.style.transform = `scaleX(${progress.toFixed(4)})`;

      // Tooltip: beside the bar head when it fits, otherwise flipped to its left; above the bar at
      // first, below when there is no room. It follows on a spring, and jumps on first sight.
      const activeIndex = current.active
        ? current.items.findIndex((item) => item.id === current.active)
        : -1;
      const tipEl = bubble.current;
      if (tipEl && activeIndex >= 0 && state.bars[activeIndex]) {
        const bar = state.bars[activeIndex];
        const barWidth = Math.max(2, (bar.value / max) * track);
        const tipWidth = tipEl.offsetWidth;
        const tipHeight = tipEl.offsetHeight;
        const head = left + barWidth;
        const middle = 26 + bar.y + 18;
        let x = head + 12;
        if (x + tipWidth > current.width) x = head - tipWidth - 12;
        let y = middle - tipHeight - 12;
        if (y < 0) y = middle + 18 + 4;
        tipX.set(clamp(x, 0, Math.max(0, current.width - tipWidth)));
        tipY.set(Math.max(0, y));
        if (!state.tipOn || current.reduced) {
          tipSpringX.jump(tipX.get());
          tipSpringY.jump(tipY.get());
        }
        state.tipOn = true;
      } else state.tipOn = false;

      const rounded = clamp(Math.round(shown), 0, last);
      if (rounded !== state.index) {
        state.index = rounded;
        setIndex(rounded);
        current.onFrameChange?.(rounded);
      }
      const ended = state.time >= last - 1e-6;
      if (ended !== state.atEnd) {
        state.atEnd = ended;
        setAtEnd(ended);
      }

      if (!animating && !current.isPlaying && !state.scrubbing) {
        state.raf = 0;
        state.last = 0;
        return;
      }
      state.raf = requestAnimationFrame(tick);
    };
    run.current = () => {
      if (!state.raf) {
        state.last = 0;
        state.raf = requestAnimationFrame(tick);
      }
    };
    const ticks = state.ticks;
    run.current();
    return () => {
      cancelAnimationFrame(state.raf);
      state.raf = 0;
      for (const node of ticks.values()) node.remove();
      ticks.clear();
    };
  }, [tipSpringX, tipSpringY, tipX, tipY]);

  // Anything that changes the picture mid-settle restarts the loop: play toggling, a resize, new
  // data, a hover, or the reduced-motion switch landing after hydration.
  useEffect(() => {
    run.current();
  }, [isPlaying, width, matrix, active, labelWidth, shownBars, reduced]);

  // A controlled frame glides the race there instead of cutting.
  useEffect(() => {
    if (frame === undefined) return;
    const state = clock.current;
    const target = clamp(Math.round(frame), 0, lastFrame);
    if (Math.round(state.time) !== target || state.time % 1) {
      state.time = target;
      run.current();
    }
  }, [frame, lastFrame]);

  useLayoutEffect(() => {
    const node = plot.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    setWidth(node.clientWidth);
    return () => observer.disconnect();
  }, []);

  const autoStarted = useRef(false);
  useEffect(() => {
    if (
      !inView ||
      autoStarted.current ||
      reduced ||
      !autoPlay ||
      playing !== undefined ||
      count < 2
    )
      return;
    autoStarted.current = true;
    const state = clock.current;
    if (state.time >= lastFrame) state.time = 0;
    setPlay(true);
  });

  const seek = (target: number, announce = true) => {
    const state = clock.current;
    const at = clamp(target, 0, lastFrame);
    state.time = at;
    state.hold = 0;
    if (isPlaying) setPlay(false);
    run.current();
    if (!announce) return;
    const row = matrix[at] ?? [];
    let best = -1;
    row.forEach((value, i) => {
      if (best < 0 || value > row[best]) best = i;
    });
    const lead = best < 0 ? undefined : items[best];
    setAnnouncement(
      !lead
        ? (frames[at]?.period ?? "")
        : `${frames[at]?.period ?? ""}. ${lead.label} leads with ${formatValue(row[best])}.`,
    );
  };

  const toggle = () => {
    const state = clock.current;
    if (isPlaying) setPlay(false);
    else {
      if (state.time >= lastFrame - 1e-6) {
        state.time = 0;
        state.hold = 0;
      }
      setPlay(true);
      run.current();
    }
  };

  const scrubTo = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    clock.current.time =
      clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1) *
      lastFrame;
    run.current();
  };

  const endScrub = () => {
    const state = clock.current;
    if (!state.scrubbing) return;
    state.scrubbing = false;
    seek(Math.round(state.time));
  };

  const onPlotKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const state = clock.current;
    const ranked = state.bars.length
      ? items
          .map((item, i) => ({ id: item.id, rank: state.bars[i]?.rank ?? i }))
          .sort((a, b) => a.rank - b.rank)
          .slice(0, shownBars)
      : items.slice(0, shownBars).map((item, i) => ({ id: item.id, rank: i }));
    const current = active
      ? ranked.findIndex((entry) => entry.id === active)
      : -1;
    const move = (to: number) => {
      event.preventDefault();
      const entry = ranked[clamp(to, 0, ranked.length - 1)];
      if (entry) setActive(entry.id);
    };
    if (event.key === "ArrowDown") move(current + 1);
    else if (event.key === "ArrowUp") move(current < 0 ? 0 : current - 1);
    else if (event.key === "ArrowRight") {
      event.preventDefault();
      seek(Math.round(state.time) + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      seek(Math.round(state.time) - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      seek(0);
    } else if (event.key === "End") {
      event.preventDefault();
      seek(lastFrame);
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      toggle();
    } else if (event.key === "Escape" && active) {
      event.preventDefault();
      setActive(null);
    }
  };

  const hitBar = (clientY: number) => {
    const rect = plot.current?.getBoundingClientRect();
    if (!rect) return null;
    const y = clientY - rect.top - 26;
    let hit: string | null = null;
    clock.current.bars.forEach((bar, i) => {
      if (bar.o > 0.5 && y >= bar.y && y < bar.y + 36 && items[i])
        hit = items[i].id;
    });
    return hit;
  };

  // The tooltip keeps the last read item while it fades out, so it never collapses mid-transition.
  const [readout, setReadout] = useState<string | null>(active);
  if (active !== null && active !== readout) setReadout(active);
  const activeIndex = readout
    ? items.findIndex((item) => item.id === readout)
    : -1;
  const shownRow = matrix[index] ?? [];
  let reading: {
    item: RaceBarItem;
    value: number;
    rank: number;
    change: number | null;
    share: number;
  } | null = null;
  if (activeIndex >= 0 && items[activeIndex]) {
    const value = shownRow[activeIndex] ?? 0;
    const rank =
      shownRow.filter(
        (entry, i) => entry > value || (entry === value && i < activeIndex),
      ).length + 1;
    const before = index > 0 ? (matrix[index - 1]?.[activeIndex] ?? 0) : null;
    const sum = shownRow.reduce((total, entry) => total + entry, 0);
    reading = {
      item: items[activeIndex],
      value,
      rank,
      change: before ? (value - before) / before : null,
      share: sum ? value / sum : 0,
    };
  }
  const empty = !count || !items.length;
  const period = frames[index]?.period ?? "";

  return (
    <figure
      ref={figure}
      className={[styles.figure, className].filter(Boolean).join(" ")}
      aria-label={label}
      data-empty={empty || undefined}
    >
      <div className={styles.head} aria-hidden="true">
        <span className={styles.periodText}>
          <AnimatePresence mode="popLayout" initial={false} custom={1}>
            <motion.span
              key={period}
              className={styles.periodWord}
              custom={1}
              variants={reduced ? fadeVariants : wordVariants}
              initial="hidden"
              animate="shown"
              exit="gone"
            >
              {period}
            </motion.span>
          </AnimatePresence>
        </span>
        <span ref={totalText} className={styles.total} />
      </div>
      <div
        ref={plot}
        className={styles.plot}
        style={{ height: 26 + 36 * shownBars + 4 }}
        data-active={(active !== null && activeIndex >= 0) || undefined}
        role="group"
        tabIndex={empty ? -1 : 0}
        aria-roledescription="bar chart race"
        aria-label={`${label}, ${period}. Space plays or pauses, left and right arrows change the period, up and down arrows read the bars.`}
        onKeyDown={onPlotKeyDown}
        onPointerMove={(event) => {
          if (event.pointerType === "mouse") setActive(hitBar(event.clientY));
        }}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse") return;
          const hit = hitBar(event.clientY);
          setActive((current) => (current === hit ? null : hit));
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setActive(null);
        }}
        onBlur={() => setActive(null)}
      >
        <div
          ref={grid}
          className={styles.grid}
          aria-hidden="true"
          style={{ height: 26 + 36 * shownBars }}
        />
        <div
          className={styles.baseline}
          style={{
            left: inside ? 0 : labelWidth + 12,
            height: 36 * shownBars,
            top: 26,
          }}
          aria-hidden="true"
        />
        <div className={styles.rows} style={{ top: 26 }} aria-hidden="true">
          {items.map((item) => (
            <div
              key={item.id}
              ref={(node) => {
                if (node) rowEls.current.set(item.id, node);
                else rowEls.current.delete(item.id);
              }}
              className={styles.row}
              style={
                {
                  height: 36,
                  "--bar": seriesColor(groupIndex.get(item.group ?? "") ?? -1),
                } as CSSProperties
              }
              data-highlight={item.id === highlight || undefined}
              data-active={item.id === active || undefined}
              data-dim={(active !== null && item.id !== active) || undefined}
            >
              <span
                ref={(node) => {
                  if (node) labelEls.current.set(item.id, node);
                  else labelEls.current.delete(item.id);
                }}
                className={styles.rowLabel}
                style={
                  inside
                    ? { left: 8, maxWidth: "calc(100% - 96px)" }
                    : { width: labelWidth }
                }
                data-inside={inside || undefined}
              >
                {item.label}
              </span>
              <span
                className={styles.bar}
                style={{
                  left: inside ? 0 : labelWidth + 12,
                  height: 24,
                  top: 6,
                }}
              />
              <span className={styles.rowValue} />
            </div>
          ))}
        </div>
        {empty && <p className={styles.message}>No data yet</p>}
        <motion.div
          ref={bubble}
          className={styles.tooltip}
          style={{
            x: reduced ? tipX : tipSpringX,
            y: reduced ? tipY : tipSpringY,
          }}
          aria-hidden="true"
        >
          {reading && (
            <>
              <p className={styles.tipTitle}>{reading.item.label}</p>
              <p className={styles.tipValue}>{formatValue(reading.value)}</p>
              <p className={styles.tipNote}>
                Rank {reading.rank} of {items.length},{" "}
                {percent.format(reading.share).replace("+", "")} of total
              </p>
              {reading.change !== null && (
                <p className={styles.tipNote}>
                  {percent.format(reading.change)} vs{" "}
                  {frames[index - 1]?.period}
                </p>
              )}
            </>
          )}
        </motion.div>
      </div>
      {(groups?.length ?? 0) > 1 && (
        <ul className={styles.legend} aria-label="Groups">
          {(groups ?? []).map((group, i) => (
            <li
              key={group.id}
              className={styles.legendItem}
              style={{ "--bar": seriesColor(i) } as CSSProperties}
            >
              <span className={styles.swatch} aria-hidden="true" />
              {group.label}
            </li>
          ))}
        </ul>
      )}
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.play}
          onClick={toggle}
          disabled={count < 2}
          aria-label={
            isPlaying ? "Pause" : atEnd ? "Replay from the start" : "Play"
          }
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={isPlaying ? "pause" : atEnd ? "replay" : "play"}
              className={styles.playIcon}
              initial={{
                opacity: 0,
                scale: reduced ? 1 : 0.6,
                filter: reduced
                  ? "none"
                  : `blur(${motionTokens.blur.subtle}px)`,
              }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: reduced ? 1 : 0.6 }}
              transition={motionTokens.spring.snappy}
            >
              {isPlaying ? (
                <Pause size={16} strokeWidth={1.75} fill="currentColor" />
              ) : atEnd ? (
                <RotateCcw size={16} strokeWidth={1.75} />
              ) : (
                <Play size={16} strokeWidth={1.75} fill="currentColor" />
              )}
            </motion.span>
          </AnimatePresence>
        </button>
        <div className={styles.timeline}>
          <div
            className={styles.track}
            role="slider"
            tabIndex={empty ? -1 : 0}
            aria-label={`${label}, period`}
            aria-valuemin={0}
            aria-valuemax={lastFrame}
            aria-valuenow={index}
            aria-valuetext={period}
            onPointerDown={(event) => {
              if (count < 2) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              clock.current.scrubbing = true;
              clock.current.hold = 0;
              if (isPlaying) setPlay(false);
              scrubTo(event);
            }}
            onPointerMove={(event) => {
              if (clock.current.scrubbing) scrubTo(event);
            }}
            onPointerUp={endScrub}
            onPointerCancel={endScrub}
            onKeyDown={(event) => {
              const at = Math.round(clock.current.time);
              const moves: Record<string, number> = {
                ArrowRight: at + 1,
                ArrowUp: at + 1,
                ArrowLeft: at - 1,
                ArrowDown: at - 1,
                Home: 0,
                End: lastFrame,
                PageUp: at + 3,
                PageDown: at - 3,
              };
              if (event.key in moves) {
                event.preventDefault();
                seek(moves[event.key]);
              } else if (event.key === " ") {
                event.preventDefault();
                toggle();
              }
            }}
          >
            <span className={styles.rail} aria-hidden="true">
              <span ref={fill} className={styles.fill} />
            </span>
            {frames.map(
              (entry, i) =>
                i > 0 &&
                i < lastFrame && (
                  <span
                    key={entry.period}
                    className={styles.stop}
                    style={{
                      left: `${lastFrame ? (i / lastFrame) * 100 : 0}%`,
                    }}
                    data-past={i <= index || undefined}
                    aria-hidden="true"
                  />
                ),
            )}
            <span ref={thumb} className={styles.thumb} aria-hidden="true" />
          </div>
          <div className={styles.ends} aria-hidden="true">
            <span>{frames[0]?.period}</span>
            <span>{frames[lastFrame]?.period}</span>
          </div>
        </div>
      </div>
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {reading && active !== null
          ? `${reading.item.label}, rank ${reading.rank}, ${formatValue(reading.value)}`
          : announcement}
      </p>
      {!empty && (
        <div className={styles.srOnly}>
          <table>
            <caption>{label}</caption>
            <thead>
              <tr>
                <th scope="col">Item</th>
                {frames.map((entry) => (
                  <th key={entry.period} scope="col">
                    {entry.period}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id}>
                  <th scope="row">{item.label}</th>
                  {matrix.map((row, f) => (
                    <td key={f}>{formatValue(row[i] ?? 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}

export default RaceBarChart;
