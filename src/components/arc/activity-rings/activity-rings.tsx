"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Check } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./activity-rings.module.css";

const FALLBACK_COLORS = ["oklch(60% 0.17 275)", "oklch(75% 0.15 68)", "oklch(66% 0.09 160)"];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const number = new Intl.NumberFormat("en-US");

export interface ActivityMetric {
  /** Stable key used in every day's values. */
  id: string;
  /** Name shown in the legend and spoken in the ring summary. */
  label: string;
  /** Unit after the value, such as "min" or "words". */
  unit: string;
  /** Value at which the ring is full and the goal counts as met. */
  goal: number;
  /** Ring colour. Falls back to the built in indigo, amber, and sage. */
  color?: string;
}

export interface ActivityDay {
  /** Stable key, used as the day button's identity. */
  id: string;
  /** Full date read by assistive technology. */
  label: string;
  /** Short label drawn under the day, such as "Mon". */
  short: string;
  /** Values keyed by metric id. */
  values: Record<string, number>;
}

export interface ActivityRingsProps {
  /** One ring per metric, from the outside in. */
  metrics: ActivityMetric[];
  /** Days with values keyed by metric id. */
  days: ActivityDay[];
  /** Controlled selected day id. */
  day?: string;
  /** Initial day when uncontrolled. Defaults to the last day. */
  defaultDay?: string;
  /** Called when a day is picked. */
  onDayChange?: (day: string) => void;
  /** Controlled isolated metric id. */
  focused?: string | null;
  /** Initial isolated metric when uncontrolled. */
  defaultFocused?: string | null;
  /** Called when a goal is selected or cleared from the legend. */
  onFocusedChange?: (metric: string | null) => void;
  /** Called when a value on the same day crosses its goal. */
  onRingClose?: (metric: string, day: string) => void;
  /** Accessible name of the section. */
  label?: string;
  /** Extra class on the root. */
  className?: string;
}

interface Geometry {
  outer: number;
  inner: number;
  mid: number;
}

/** Ring radii in the 220 unit viewBox: each metric sits 20 units inside the last. */
function geometry(index: number): Geometry {
  const outer = 106 - 20 * index;
  return { outer, inner: outer - 13, mid: outer - 6.5 };
}

/** A formatted value that counts to its new amount whenever the animated value moves. */
function ValueText({ value, format }: { value: MotionValue<number>; format: (current: number) => string }) {
  const text = useTransform(value, format);
  return <motion.span>{text}</motion.span>;
}

interface RingProps {
  metric: ActivityMetric;
  color: string;
  index: number;
  values: MotionValue<number[]>;
  dimmed: boolean;
  uid: string;
}

/** One tick ring: a masked band of ticks that fills as the value sweeps, plus a second lap past 100%. */
function Ring({ metric, color, index, values, dimmed, uid }: RingProps) {
  const { outer, inner, mid } = geometry(index);
  const count = 4 * Math.round((2 * Math.PI * mid) / 11 / 4);
  const ratio = useTransform(values, current => Math.max(0, (current[index] ?? 0) / metric.goal));
  const sweep = useTransform(ratio, current => clamp(current, 0, 1));
  const lap = useTransform(ratio, current => clamp(current - 1, 0, 1));
  const lapOpacity = useTransform(ratio, current => +(current > 1.005));
  const maskId = `${uid}-mask-${index}`;
  const ticks = Array.from({ length: count }, (_, tick) => {
    const angle = (tick / count) * Math.PI * 2;
    const point = (radius: number, fn: (value: number) => number) => Math.round((110 + fn(angle) * radius) * 1e3) / 1e3;
    return (
      <line
        key={tick}
        x1={point(inner + 1, Math.cos)}
        y1={point(inner + 1, Math.sin)}
        x2={point(outer - 1, Math.cos)}
        y2={point(outer - 1, Math.sin)}
      />
    );
  });

  return (
    <g className={styles.ring} data-dimmed={dimmed || undefined} style={{ "--ring": color } as CSSProperties}>
      <mask id={maskId}>
        <g transform="rotate(-90 110 110)">
          <motion.circle
            cx={110}
            cy={110}
            r={mid}
            fill="none"
            stroke="white"
            strokeWidth={17}
            style={{ pathLength: sweep }}
          />
        </g>
      </mask>
      <g className={styles.ticksBase}>{ticks}</g>
      <g className={styles.ticksFill} mask={`url(#${maskId})`}>
        {ticks}
      </g>
      <g transform="rotate(-90 110 110)">
        <motion.circle
          className={styles.lap}
          cx={110}
          cy={110}
          r={inner - 4}
          style={{ pathLength: lap, opacity: lapOpacity }}
        />
      </g>
    </g>
  );
}

interface MarkerProps {
  metric: ActivityMetric;
  index: number;
  values: MotionValue<number[]>;
  dimmed: boolean;
}

/** The arm that rides the ring's leading edge, so the sweep reads even where the ticks are dense. */
function Marker({ metric, index, values, dimmed }: MarkerProps) {
  const { outer } = geometry(index);
  const arm = useTransform(values, current => 360 * Math.max(0, (current[index] ?? 0) / metric.goal));
  const opacity = useTransform(values, current => +((current[index] ?? 0) > 0.005 * metric.goal));
  const percent = (value: number) => `${(value / 220) * 100}%`;

  return (
    <motion.div
      className={styles.markerArm}
      data-dimmed={dimmed || undefined}
      style={{ rotate: arm, opacity }}
      aria-hidden="true"
    >
      <span className={styles.marker} style={{ top: percent(110 - outer - 2), height: percent(17) }} />
    </motion.div>
  );
}

interface LegendRowProps {
  metric: ActivityMetric;
  color: string;
  index: number;
  values: MotionValue<number[]>;
  target: number;
  pressed: boolean;
  dimmed: boolean;
  onToggle: () => void;
  onHover: (hovering: boolean) => void;
}

/** One legend row: a toggle that isolates the goal, with the value counting to its new amount. */
function LegendRow({ metric, color, index, values, target, pressed, dimmed, onToggle, onHover }: LegendRowProps) {
  const value = useTransform(values, current => current[index] ?? 0);
  const met = target >= metric.goal;

  return (
    <button
      type="button"
      className={styles.legendRow}
      aria-pressed={pressed}
      data-dimmed={dimmed || undefined}
      style={{ "--ring": color } as CSSProperties}
      aria-label={`${metric.label}, ${number.format(target)} of ${number.format(metric.goal)} ${metric.unit}, ${Math.round((target / metric.goal) * 100)} percent${met ? ", goal met" : ""}`}
      onClick={onToggle}
      onPointerEnter={event => event.pointerType === "mouse" && onHover(true)}
      onPointerLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
    >
      <span className={styles.swatch} aria-hidden="true" />
      <span className={styles.legendText} aria-hidden="true">
        <span className={styles.legendLabel}>{metric.label}</span>
        <span className={styles.legendValue}>
          <ValueText value={value} format={current => number.format(Math.round(current))} /> / {number.format(metric.goal)} {metric.unit}
        </span>
      </span>
      <span className={styles.legendPercent} aria-hidden="true">
        <AnimatePresence initial={false}>
          {met && (
            <motion.span
              className={styles.met}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={motionTokens.spring.snappy}
            >
              <Check size={12} strokeWidth={2.25} />
            </motion.span>
          )}
        </AnimatePresence>
        <ValueText value={value} format={current => `${Math.round((current / metric.goal) * 100)}%`} />
      </span>
    </button>
  );
}

/** The tiny three ring summary under each day. */
function MiniRings({ metrics, day }: { metrics: ActivityMetric[]; day: ActivityDay }) {
  return (
    <svg className={styles.mini} viewBox="0 0 32 32" aria-hidden="true">
      {metrics.map((metric, index) => {
        const radius = 14 - 4.5 * index;
        const value = clamp((day.values[metric.id] ?? 0) / metric.goal, 0, 1);
        return (
          <g key={metric.id} style={{ "--ring": metric.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length] } as CSSProperties}>
            <circle className={styles.miniTrack} cx="16" cy="16" r={radius} />
            <circle className={styles.miniArc} cx="16" cy="16" r={radius} pathLength={1} strokeDasharray={`${value} 1`} />
          </g>
        );
      })}
    </svg>
  );
}

export function ActivityRings({
  metrics,
  days,
  day: dayProp,
  defaultDay,
  onDayChange,
  focused: focusedProp,
  defaultFocused = null,
  onFocusedChange,
  onRingClose,
  label = "Activity",
  className,
}: ActivityRingsProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [internalDay, setInternalDay] = useState(defaultDay ?? days[days.length - 1]?.id);
  const [internalFocused, setInternalFocused] = useState<string | null>(defaultFocused);
  const [hovered, setHovered] = useState<string | null>(null);

  const activeId = dayProp ?? internalDay;
  const activeDay = days.find(item => item.id === activeId) ?? days[days.length - 1];
  const focusedId = focusedProp === undefined ? internalFocused : focusedProp;
  const isolated = hovered ?? focusedId;

  const targets = metrics.map(metric => activeDay?.values[metric.id] ?? 0);
  const key = targets.join(",");
  const values = useMotionValue<number[]>(metrics.map(() => 0));
  const previous = useRef<{ day: string | undefined; targets: number[] } | null>(null);
  const dayButtons = useRef<(HTMLButtonElement | null)[]>([]);

  // Every change sweeps from what is on screen to the new values, so a quick second change redirects mid flight.
  useEffect(() => {
    const next = key.split(",").map(Number);
    if (reduceMotion) {
      values.set(next);
      return;
    }
    const from = values.get();
    const animation = animate(0, 1, {
      type: "spring",
      visualDuration: 0.9,
      bounce: 0,
      onUpdate: progress => values.set(from.map((start, index) => start + ((next[index] ?? 0) - start) * progress)),
    });
    return () => animation.stop();
  }, [key, values, reduceMotion]);

  // Fire once when a value crosses its goal on the same day.
  useEffect(() => {
    const state = previous.current;
    const next = key.split(",").map(Number);
    if (state && state.day === activeId) {
      metrics.forEach((metric, index) => {
        if ((state.targets[index] ?? 0) < metric.goal && (next[index] ?? 0) >= metric.goal) onRingClose?.(metric.id, activeId);
      });
    }
    previous.current = { day: activeId, targets: next };
  }, [key, activeId, metrics, onRingClose]);

  const colorFor = (metric: ActivityMetric, index: number) => metric.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  const focusedIndex = metrics.findIndex(metric => metric.id === isolated);
  const focusedMetric = focusedIndex >= 0 ? metrics[focusedIndex] : null;
  const overall = useTransform(values, current =>
    (metrics.reduce((sum, metric, index) => sum + clamp((current[index] ?? 0) / metric.goal, 0, 1), 0) / Math.max(1, metrics.length)) * 100,
  );
  const isolatedValue = useTransform(values, current => (focusedIndex >= 0 ? (current[focusedIndex] ?? 0) : 0));

  const center = {
    initial: { opacity: 0, y: 6, filter: `blur(${motionTokens.blur.subtle}px)` },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: { opacity: 0, y: -6, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.instant } },
    transition: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] as [number, number, number, number] },
  };

  return (
    <MotionConfig reducedMotion="user">
      <section className={[styles.root, className].filter(Boolean).join(" ")} aria-label={label}>
        <div className={styles.main}>
          <div className={styles.dial}>
            <svg
              className={styles.rings}
              viewBox="0 0 220 220"
              role="img"
              aria-label={`${activeDay?.label}: ${metrics.map((metric, index) => `${metric.label} ${Math.round((targets[index] / metric.goal) * 100)}%`).join(", ")}`}
            >
              {metrics.map((metric, index) => (
                <Ring
                  key={metric.id}
                  metric={metric}
                  color={colorFor(metric, index)}
                  index={index}
                  values={values}
                  dimmed={Boolean(isolated) && isolated !== metric.id}
                  uid={uid}
                />
              ))}
            </svg>
            {metrics.map((metric, index) => (
              <Marker
                key={metric.id}
                metric={metric}
                index={index}
                values={values}
                dimmed={Boolean(isolated) && isolated !== metric.id}
              />
            ))}
            <div className={styles.center} aria-hidden="true">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div className={styles.centerInner} key={focusedMetric?.id ?? "overall"} {...center}>
                  <span className={styles.centerValue}>
                    {focusedMetric ? (
                      <ValueText value={isolatedValue} format={current => number.format(Math.round(current))} />
                    ) : (
                      <>
                        <ValueText value={overall} format={current => String(Math.round(current))} />
                        <span className={styles.centerUnit}>%</span>
                      </>
                    )}
                  </span>
                  <span className={styles.centerLabel}>
                    {focusedMetric ? `${focusedMetric.unit} ${focusedMetric.label.toLowerCase()}` : "of goals"}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          <div className={styles.legend}>
            {metrics.map((metric, index) => (
              <LegendRow
                key={metric.id}
                metric={metric}
                color={colorFor(metric, index)}
                index={index}
                values={values}
                target={targets[index]}
                pressed={focusedId === metric.id}
                dimmed={Boolean(isolated) && isolated !== metric.id}
                onToggle={() => {
                  const next = focusedId === metric.id ? null : metric.id;
                  setInternalFocused(next);
                  onFocusedChange?.(next);
                }}
                onHover={hovering => setHovered(hovering ? metric.id : null)}
              />
            ))}
          </div>
        </div>
        <LayoutGroup id={uid}>
          <div
            className={styles.week}
            role="radiogroup"
            aria-label="Day"
            onKeyDown={event => {
              const current = days.findIndex(item => item.id === activeDay?.id);
              const step: Record<string, number> = {
                ArrowRight: 1,
                ArrowDown: 1,
                ArrowLeft: -1,
                ArrowUp: -1,
                Home: -Infinity,
                End: Infinity,
              };
              if (!(event.key in step)) return;
              event.preventDefault();
              const next =
                step[event.key] === Infinity
                  ? days.length - 1
                  : step[event.key] === -Infinity
                    ? 0
                    : clamp(current + step[event.key], 0, days.length - 1);
              const id = days[next].id;
              setInternalDay(id);
              onDayChange?.(id);
              dayButtons.current[next]?.focus();
            }}
          >
            {days.map((item, index) => {
              const checked = item.id === activeDay?.id;
              return (
                <button
                  key={item.id}
                  ref={node => {
                    dayButtons.current[index] = node;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  aria-label={item.label}
                  tabIndex={checked ? 0 : -1}
                  className={styles.day}
                  onClick={() => {
                    setInternalDay(item.id);
                    onDayChange?.(item.id);
                  }}
                >
                  {checked && (
                    <motion.span layoutId="day-highlight" className={styles.dayHighlight} transition={motionTokens.spring.morph} />
                  )}
                  <MiniRings metrics={metrics} day={item} />
                  <span className={styles.dayLabel}>{item.short}</span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>
      </section>
    </MotionConfig>
  );
}

export default ActivityRings;
