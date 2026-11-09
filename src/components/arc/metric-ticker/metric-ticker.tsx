"use client";

/**
 * Metric ticker — a strip of live KPIs. Values roll to their new reading one digit wheel at a time
 * (mechanical counter, ones first, each higher place a beat later), the change flashes an arrow and
 * an amount, and resting on a metric opens a panel with its recent trend. When the metrics stop
 * fitting, the strip drifts as a marquee that can be dragged, or turns into a snapping scroller.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import type { MotionValue } from "motion/react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./metric-ticker.module.css";

export type TickerOverflow = "marquee" | "scroll";
export type TickerDelta = "percent" | "absolute";
export type TickerPositive = "up" | "down";

export interface TickerMetric {
  /** Stable id; changes are matched by id when a new array arrives. */
  id: string;
  /** Two or three words. The panel caption carries the long context. */
  label: string;
  value: number;
  /** Number format for the reading: currency, percent, a unit, … Defaults to whole numbers. */
  format?: Intl.NumberFormatOptions;
  /** Relative change, or the raw difference in the metric's own format. */
  delta?: TickerDelta;
  /** Which direction is good news. Set `down` for latency, errors and churn. */
  positive?: TickerPositive;
  /** Recent values, oldest first, for the sparkline. */
  history?: readonly number[];
  /** Context at the top of the panel, such as `Rolling 7 days`. */
  caption?: string;
}

export interface MetricTickerProps {
  /** The metrics in order. Pass a new array whenever a value changes. */
  metrics: readonly TickerMetric[];
  /** What happens when the metrics do not fit: a slow marquee, or a snapping horizontal scroll. */
  overflow?: TickerOverflow;
  /** Marquee drift in pixels per second. */
  speed?: number;
  /** How long a change stays emphasised before the delta settles, in milliseconds. */
  flashDuration?: number;
  /** Points kept for the sparkline when `history` is not passed. */
  historyLength?: number;
  /** Formatting locale, fixed so server and client render the same digits. */
  locale?: string;
  /** Accessible name of the strip. */
  label?: string;
  /** Class on the root element. */
  className?: string;
  /** Inline styles on the root element. */
  style?: CSSProperties;
}

const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** A new column or symbol opens from nothing: the width springs so the reading never snaps. */
const openWidth = {
  initial: { width: 0, opacity: 0 },
  animate: { width: "auto", opacity: 1 },
  exit: { width: 0, opacity: 0 },
} as const;

interface NumberToken {
  key: string;
  digit: number;
}

interface SymbolToken {
  key: string;
  text: string;
}

interface Formats {
  value: Intl.NumberFormat;
  delta: Intl.NumberFormat;
  scale: number;
  suffix: string;
}

interface Change {
  delta: number;
  ratio: number;
  tick: number;
}

interface TickerState {
  metrics: readonly TickerMetric[];
  history: Record<string, number[]>;
  changes: Record<string, Change>;
  tick: number;
}

interface DragState {
  x: number;
  last: number;
  time: number;
  velocity: number;
  moved: boolean;
  id: number;
}

interface LoopState {
  speed: number;
  target: number;
  drag: DragState | null;
  visible: boolean;
  width: number;
  seek: number | null;
}

type Tone = "up" | "down" | "flat";

/** One number of the wheel: only the digit near the window is opaque, so the strip reads as a slot. */
function DigitGlyph({ position, digit }: { position: MotionValue<number>; digit: number }) {
  const offset = useTransform(position, (value) => (((digit - value) % 10) + 15) % 10 - 5);
  const y = useTransform(offset, (value) => `${value}em`);
  const opacity = useTransform(offset, (value) => Math.max(0, 1 - 1.2 * Math.abs(value)));
  return (
    <motion.span className={styles.glyph} style={{ y, opacity }}>
      {digit}
    </motion.span>
  );
}

/** A digit column. The motion value keeps counting past 9 in the direction the value moved, so 9 → 0 turns forward. */
function DigitWheel({ digit, direction, delay, reduceMotion }: { digit: number; direction: number; delay: number; reduceMotion: boolean }) {
  const position = useMotionValue(digit);
  const state = useRef({ digit, target: digit });
  useEffect(() => {
    const current = state.current;
    if (current.digit === digit) return;
    current.target += direction < 0 ? -((current.digit - digit + 10) % 10) : (digit - current.digit + 10) % 10;
    current.digit = digit;
    if (reduceMotion) {
      position.jump(current.target);
      return;
    }
    const controls = animate(position, current.target, { ...motionTokens.spring.smooth, delay });
    return () => controls.stop();
  }, [delay, digit, direction, position, reduceMotion]);
  return (
    <span className={styles.wheel}>
      <span className={styles.sizer}>0</span>
      {digits.map((value) => (
        <DigitGlyph key={value} position={position} digit={value} />
      ))}
    </span>
  );
}

/** Splits a formatted reading into wheels and static symbols, so only the digits move. */
function splitParts(formatter: Intl.NumberFormat, value: number): (NumberToken | SymbolToken)[] {
  let integer = formatter.formatToParts(value).reduce((total, part) => total + (part.type === "integer" ? part.value.length : 0), 0);
  let fraction = 0;
  return formatter.formatToParts(value).flatMap((part, index): (NumberToken | SymbolToken)[] => {
    if (part.type === "integer") return [...part.value].map((char) => ({ key: `i${--integer}`, digit: Number(char) }));
    if (part.type === "fraction") return [...part.value].map((char) => ({ key: `f${fraction++}`, digit: Number(char) }));
    return [{ key: part.type === "group" ? `g${integer}` : part.type === "literal" ? `l${index}` : part.type, text: part.value }];
  });
}

function RollingNumber({ value, formatter, reduceMotion }: { value: number; formatter: Intl.NumberFormat; reduceMotion: boolean }) {
  const [shown, setShown] = useState({ value, direction: 1 });
  if (shown.value !== value) setShown({ value, direction: value >= shown.value ? 1 : -1 });
  const tokens = splitParts(formatter, value);
  const count = tokens.filter((token) => "digit" in token).length;
  let order = 0;
  return (
    <span className={styles.number} aria-hidden="true">
      <AnimatePresence initial={false}>
        {tokens.map((token) => {
          const transition = reduceMotion ? { duration: 0 } : motionTokens.spring.morph;
          if (!("digit" in token)) {
            return (
              <motion.span key={token.key} className={styles.symbol} {...openWidth} transition={transition}>
                {token.text}
              </motion.span>
            );
          }
          // The ones settle first; each higher place follows 25ms later, so a change ripples right to left.
          const delay = (count - 1 - order++) * 0.025;
          return (
            <motion.span key={token.key} className={styles.column} {...openWidth} transition={transition}>
              <DigitWheel digit={token.digit} direction={shown.direction} delay={delay} reduceMotion={reduceMotion} />
            </motion.span>
          );
        })}
      </AnimatePresence>
    </span>
  );
}

function Sparkline({ values, tone, reduceMotion }: { values: number[]; tone: Tone; reduceMotion: boolean }) {
  if (values.length < 2) return <svg className={styles.spark} viewBox="0 0 216 56" aria-hidden="true" />;
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  const points = values.map((value, index): [number, number] => [(index / (values.length - 1)) * 216, 4 + (1 - (value - low) / span) * 48]);
  const line = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L216 56 L0 56 Z`;
  const last = points[points.length - 1] ?? [0, 0];
  return (
    <svg className={styles.spark} data-tone={tone} viewBox="0 0 216 56" preserveAspectRatio="none" aria-hidden="true">
      <motion.path
        className={styles.sparkArea}
        d={area}
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: motionTokens.duration.considered, ease: [...motionTokens.ease.standard], delay: reduceMotion ? 0 : 0.12 }}
      />
      <motion.path
        className={styles.sparkLine}
        d={line}
        initial={reduceMotion ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: motionTokens.duration.considered, ease: [...motionTokens.ease.enter] }}
      />
      <motion.circle
        className={styles.sparkDot}
        cx={last[0]}
        cy={last[1]}
        r={3}
        initial={reduceMotion ? false : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={reduceMotion ? { duration: 0 } : { ...motionTokens.spring.snappy, delay: 0.42 }}
      />
    </svg>
  );
}

export function MetricTicker({
  metrics,
  overflow = "marquee",
  speed = 32,
  flashDuration = 1600,
  historyLength = 24,
  locale = "en-US",
  label = "Live metrics",
  className,
  style,
}: MetricTickerProps) {
  const reduceMotion = !!useReducedMotion();
  const uid = useId();

  const signature = metrics.map((metric) => `${metric.id}:${metric.delta ?? ""}:${JSON.stringify(metric.format ?? {})}`).join("|");
  const formats = useMemo(() => {
    const map = new Map<string, Formats>();
    for (const metric of metrics) {
      const options: Intl.NumberFormatOptions = { maximumFractionDigits: 0, ...metric.format, numberingSystem: "latn" };
      const value = new Intl.NumberFormat(locale, options);
      if (metric.delta !== "absolute") {
        map.set(metric.id, {
          value,
          delta: new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1, numberingSystem: "latn" }),
          scale: 1,
          suffix: "",
        });
      } else if (options.style === "percent") {
        const places = value.resolvedOptions().maximumFractionDigits ?? 1;
        map.set(metric.id, {
          value,
          delta: new Intl.NumberFormat(locale, { minimumFractionDigits: places, maximumFractionDigits: places, numberingSystem: "latn" }),
          scale: 100,
          suffix: " pts",
        });
      } else {
        map.set(metric.id, {
          value,
          delta: new Intl.NumberFormat(locale, { ...options, signDisplay: "never" }),
          scale: 1,
          suffix: "",
        });
      }
    }
    return map;
  }, [locale, signature]);

  // History and the per-tick changes are derived while rendering: a new array is a new tick.
  const [state, setState] = useState<TickerState>(() => ({
    metrics,
    history: Object.fromEntries(metrics.map((metric) => [metric.id, [metric.value]])) as Record<string, number[]>,
    changes: {},
    tick: 0,
  }));
  if (state.metrics !== metrics) {
    const tick = state.tick + 1;
    const history = { ...state.history };
    const changes = { ...state.changes };
    const previous = new Map(state.metrics.map((metric) => [metric.id, metric.value]));
    for (const metric of metrics) {
      const before = previous.get(metric.id);
      if (before === undefined || before === metric.value) {
        history[metric.id] ??= [metric.value];
        continue;
      }
      history[metric.id] = [...(history[metric.id] ?? [before]), metric.value].slice(-historyLength);
      changes[metric.id] = { delta: metric.value - before, ratio: before ? (metric.value - before) / Math.abs(before) : 0, tick };
    }
    setState({ metrics, history, changes, tick });
  }

  // A change stays flashed for flashDuration, then its delta drains back to the resting tone.
  const [settled, setSettled] = useState(0);
  const flashes = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    if (state.tick === 0) return;
    const tick = state.tick;
    const timers = flashes.current;
    const timer = setTimeout(() => {
      timers.delete(timer);
      setSettled((current) => Math.max(current, tick));
    }, flashDuration);
    timers.add(timer);
  }, [flashDuration, state.tick]);
  useEffect(() => {
    const timers = flashes.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const open = pinned ?? focused ?? hovered;
  const [focusVisible, setFocusVisible] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const anchor = useRef<HTMLButtonElement | undefined>(undefined);

  const openHover = (id: string, node?: HTMLButtonElement) => {
    clearTimeout(closeTimer.current);
    if (node) anchor.current = node;
    setHovered(id);
  };
  const closeHover = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHovered(null), 160);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const rootRef = useRef<HTMLDivElement>(null);

  // A pinned panel closes on a press anywhere outside and on Escape.
  useEffect(() => {
    if (!pinned) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setPinned(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPinned(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pinned]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLUListElement>(null);

  // Fit or overflow is measured, not derived from a breakpoint.
  const [overflowing, setOverflowing] = useState(false);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const group = groupRef.current;
    if (!viewport || !group || typeof ResizeObserver === "undefined") return;
    const measure = () => setOverflowing(group.scrollWidth > viewport.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(group);
    return () => observer.disconnect();
  }, []);

  const marquee = overflowing && overflow === "marquee" && !reduceMotion;
  const loop = useMotionValue(0);
  const loopState = useRef<LoopState>({ speed: 0, target: 0, drag: null, visible: true, width: 0, seek: null });
  const trackX = useTransform(loop, (value) => {
    const width = loopState.current.width;
    return width ? -(((value % width) + width) % width) : 0;
  });

  // Keyboard focus (focus-visible only) parks the marquee under the metric being read.
  const parked = focused !== null && focusVisible;
  useEffect(() => {
    loopState.current.target = parked ? 0 : speed;
  }, [parked, speed]);

  useEffect(() => {
    if (!marquee) {
      loop.set(0);
      return;
    }
    const current = loopState.current;
    const group = groupRef.current;
    const measure = () => {
      current.width = group?.offsetWidth ?? 0;
    };
    measure();
    const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (group) resize?.observe(group);
    const intersection =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entry]) => {
            current.visible = !!entry?.isIntersecting;
          })
        : null;
    if (viewportRef.current) intersection?.observe(viewportRef.current);
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (current.width && (loop.get() >= current.width || loop.get() < 0)) loop.set(((loop.get() % current.width) + current.width) % current.width);
      if (current.visible && !document.hidden && !current.drag) {
        if (current.seek !== null) {
          const distance = current.seek - loop.get();
          loop.set(loop.get() + distance * (1 - Math.exp(-(12 * dt))));
          if (Math.abs(distance) < 0.5) current.seek = null;
          current.speed = 0;
        } else {
          // Ease the speed, never the position: resting on the strip glides it to a halt.
          current.speed += (current.target - current.speed) * (1 - Math.exp(-dt * (current.target ? 2.2 : 6)));
          if (Math.abs(current.speed) > 0.01) loop.set(loop.get() + current.speed * dt);
        }
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      intersection?.disconnect();
    };
  }, [marquee, loop]);

  const suppressed = useRef(false);
  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = loopState.current;
    const drag = current.drag;
    if (!drag || drag.id !== event.pointerId) return;
    current.drag = null;
    if (drag.moved) {
      // The flick is handed back to the loop, clamped so a fast throw never becomes a blur.
      current.speed = Math.max(-1600, Math.min(1600, drag.velocity));
      suppressed.current = true;
      setTimeout(() => {
        suppressed.current = false;
      }, 0);
    }
  };

  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const [selected, setSelected] = useState<string | null>(null);
  const stop = selected ?? metrics[0]?.id ?? null;

  const reveal = useCallback(
    (id: string) => {
      const node = buttons.current.get(id);
      const viewport = viewportRef.current;
      if (!node || !viewport) return;
      const parent = node.parentElement;
      if (!parent) return;
      if (marquee) {
        // The shortest way round the loop, so a wrapped item comes in from the near side.
        const width = loopState.current.width || 1;
        const position = ((loop.get() % width) + width) % width;
        let left = parent.offsetLeft - 24;
        if (left - position > width / 2) left -= width;
        if (position - left > width / 2) left += width;
        loopState.current.seek = loop.get() + (left - position);
      } else if (parent.offsetLeft < viewport.scrollLeft || parent.offsetLeft + parent.offsetWidth > viewport.scrollLeft + viewport.clientWidth) {
        viewport.scrollTo({ left: parent.offsetLeft - 16, behavior: reduceMotion ? "auto" : "smooth" });
      }
    },
    [marquee, loop, reduceMotion],
  );

  // The panel follows its metric every frame, clamped inside the component's box.
  const panelX = useMotionValue(0);
  const panelOrigin = useMotionValue("50% 0px");
  const openId = useRef(open);
  useLayoutEffect(() => {
    openId.current = open;
  }, [open]);
  const panelOpen = open !== null;
  useLayoutEffect(() => {
    if (!panelOpen) return;
    let frame = 0;
    let first = true;
    let previous = -1;
    const follow = (time: number) => {
      const id = openId.current;
      const node = anchor.current;
      const target = node?.isConnected && node.dataset.metric === id ? node : id ? buttons.current.get(id) : undefined;
      const root = rootRef.current;
      if (target && root) {
        const rect = target.getBoundingClientRect();
        const box = root.getBoundingClientRect();
        const width = Math.min(248, box.width);
        const center = rect.left + rect.width / 2 - box.left;
        const x = Math.max(0, Math.min(box.width - width, rect.left - box.left));
        const dt = previous < 0 ? 0 : Math.min(0.05, (time - previous) / 1000);
        if (first || reduceMotion) {
          panelX.jump(x);
          panelOrigin.set(`${Math.max(12, Math.min(width - 12, center - x)).toFixed(1)}px 0px`);
        } else {
          panelX.set(panelX.get() + (x - panelX.get()) * (1 - Math.exp(-(16 * dt))));
        }
        first = false;
      }
      previous = time;
      frame = requestAnimationFrame(follow);
    };
    follow(-1);
    previous = -1;
    return () => cancelAnimationFrame(frame);
  }, [panelOpen, panelOrigin, panelX, reduceMotion]);

  const openMetric = open ? metrics.find((metric) => metric.id === open) : undefined;
  const openFormats = openMetric ? formats.get(openMetric.id) : undefined;
  const openChange = openMetric ? state.changes[openMetric.id] : undefined;
  const values = openMetric ? (openMetric.history ? [...openMetric.history] : (state.history[openMetric.id] ?? [])) : [];
  const trend: number = values.length > 1 ? Math.sign((values[values.length - 1] ?? 0) - (values[0] ?? 0)) : 0;
  const trendTone: Tone =
    trend === 0 ? "flat" : (trend > 0) === ((openMetric?.positive ?? "up") === "up") ? "up" : "down";

  const renderItems = (clone: boolean) =>
    metrics.map((metric, index) => {
      const format = formats.get(metric.id);
      if (!format) return null;
      const change = state.changes[metric.id];
      const direction = change ? Math.sign(change.delta) : 0;
      const tone =
        direction === 0 ? "flat" : (direction > 0) === ((metric.positive ?? "up") === "up") ? "good" : "bad";
      const flash = !!change && change.tick > settled;
      const amount = change ? Math.abs(metric.delta === "absolute" ? change.delta : change.ratio) * format.scale : 0;
      const text = change ? `${format.delta.format(amount)}${format.suffix}` : "";
      const description = `${metric.label}, ${format.value.format(metric.value)}${change && direction ? `, ${direction > 0 ? "up" : "down"} ${text}` : ""}`;
      return (
        <li key={metric.id} className={styles.item} data-open={open === metric.id || undefined}>
          <button
            ref={
              clone
                ? undefined
                : (node) => {
                    if (node) buttons.current.set(metric.id, node);
                    else buttons.current.delete(metric.id);
                  }
            }
            type="button"
            data-metric={metric.id}
            className={styles.button}
            tabIndex={clone ? -1 : stop === metric.id ? 0 : -1}
            aria-label={clone ? undefined : description}
            aria-expanded={clone ? undefined : open === metric.id}
            aria-controls={clone || open !== metric.id ? undefined : uid}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") openHover(metric.id, event.currentTarget);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") closeHover();
            }}
            onFocus={(event) => {
              if (clone) return;
              setFocusVisible(event.currentTarget.matches(":focus-visible"));
              anchor.current = event.currentTarget;
              setSelected(metric.id);
              setFocused(metric.id);
              reveal(metric.id);
            }}
            onBlur={() => setFocused((current) => (current === metric.id ? null : current))}
            onClick={(event) => {
              if (suppressed.current) return;
              anchor.current = event.currentTarget;
              setPinned((current) => (current === metric.id ? null : metric.id));
            }}
            onKeyDown={(event) => {
              const targets: Record<string, number> = {
                ArrowRight: index + 1,
                ArrowLeft: index - 1,
                Home: 0,
                End: metrics.length - 1,
              };
              if (event.key === "Escape") {
                setPinned(null);
                setFocused(null);
                return;
              }
              if (!(event.key in targets)) return;
              event.preventDefault();
              const next = metrics[(targets[event.key] + metrics.length) % metrics.length];
              if (next) buttons.current.get(next.id)?.focus();
            }}
          >
            <span className={styles.label}>{metric.label}</span>
            <span className={styles.reading}>
              <span className={styles.value}>
                <RollingNumber value={metric.value} formatter={format.value} reduceMotion={reduceMotion} />
              </span>
              <span className={styles.delta} data-tone={tone} data-flash={flash || undefined} data-empty={!change || undefined}>
                <span className={styles.deltaIcon}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={direction}
                      className={styles.deltaGlyph}
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: direction > 0 ? 5 : -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: direction > 0 ? -5 : 5 }}
                      transition={reduceMotion ? { duration: 0 } : motionTokens.spring.snappy}
                    >
                      {direction > 0 ? (
                        <ArrowUp size={12} strokeWidth={2.25} />
                      ) : direction < 0 ? (
                        <ArrowDown size={12} strokeWidth={2.25} />
                      ) : (
                        <Minus size={12} strokeWidth={2.25} />
                      )}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <span className={styles.deltaText}>
                  <RollingNumber value={amount} formatter={format.delta} reduceMotion={reduceMotion} />
                  {format.suffix && <span className={styles.symbol}>{format.suffix}</span>}
                </span>
                {change && !reduceMotion && (
                  <motion.span
                    key={change.tick}
                    className={styles.pulse}
                    initial={{ opacity: 0.9, scale: 0.8 }}
                    animate={{ opacity: 0, scale: 1.25 }}
                    transition={{ duration: 0.7, ease: [...motionTokens.ease.enter] }}
                  />
                )}
              </span>
            </span>
          </button>
        </li>
      );
    });

  return (
    <div
      ref={rootRef}
      className={[styles.ticker, className].filter(Boolean).join(" ")}
      style={style}
      role="region"
      aria-label={label}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") closeHover();
      }}
    >
      <div
        ref={viewportRef}
        className={styles.viewport}
        data-mode={marquee ? "marquee" : overflowing ? "scroll" : "fit"}
        onPointerDown={(event) => {
          if (!marquee || event.button !== 0) return;
          loopState.current.drag = { x: event.clientX, last: event.clientX, time: performance.now(), velocity: 0, moved: false, id: event.pointerId };
        }}
        onPointerMove={(event) => {
          const drag = loopState.current.drag;
          if (!drag || drag.id !== event.pointerId || (!drag.moved && Math.abs(event.clientX - drag.x) < 5)) return;
          if (!drag.moved) {
            drag.moved = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          const now = performance.now();
          const dx = event.clientX - drag.last;
          drag.velocity = 0.6 * drag.velocity + (-dx / Math.max(1, now - drag.time)) * 400;
          drag.last = event.clientX;
          drag.time = now;
          loop.set(loop.get() - dx);
        }}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <div className={styles.fader}>
          <motion.div className={styles.track} style={{ x: trackX }}>
            <ul ref={groupRef} className={styles.group}>
              {renderItems(false)}
            </ul>
            {marquee && (
              <ul className={styles.group} aria-hidden="true">
                {renderItems(true)}
              </ul>
            )}
          </motion.div>
        </div>
      </div>
      <AnimatePresence>
        {openMetric && openFormats && (
          <motion.div
            key="panel"
            id={uid}
            className={styles.panel}
            style={{ x: panelX, transformOrigin: panelOrigin }}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -4, scale: 0.98, transition: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.standard] } }
            }
            transition={reduceMotion ? { duration: 0 } : { ...motionTokens.spring.morph, opacity: { duration: motionTokens.duration.fast } }}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") openHover(openMetric.id);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") closeHover();
            }}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={openMetric.id}
                className={styles.panelBody}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, filter: `blur(${motionTokens.blur.subtle}px)` }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, filter: `blur(${motionTokens.blur.subtle}px)` }}
                transition={{ duration: reduceMotion ? 0 : motionTokens.duration.fast }}
              >
                <div className={styles.panelHead}>
                  <span className={styles.panelLabel}>{openMetric.caption ?? `Last ${values.length} updates`}</span>
                  {openChange && (
                    <span className={styles.panelChange} data-tone={trendTone}>
                      {trend > 0 ? "Trending up" : trend < 0 ? "Trending down" : "Flat"}
                    </span>
                  )}
                </div>
                <Sparkline values={values} tone={trendTone} reduceMotion={reduceMotion} />
                <dl className={styles.range}>
                  <div>
                    <dt>Low</dt>
                    <dd>{openFormats.value.format(Math.min(...values))}</dd>
                  </div>
                  <div>
                    <dt>High</dt>
                    <dd>{openFormats.value.format(Math.max(...values))}</dd>
                  </div>
                </dl>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MetricTicker;
