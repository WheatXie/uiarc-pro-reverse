"use client";

import { ArrowUpRight, X } from "lucide-react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import SegmentedControl from "../segmented-control/segmented-control";
import { motionTokens } from "../lib/motion-tokens";
import {
  axisTicks,
  changeBetween,
  chartScale,
  chartX,
  describeChange,
  formatValue,
  longDate,
  METRICS,
  metricById,
  RANGE_IDS,
  RANGES,
  rangeLabel,
  readMetric,
  sampleAt,
  shortDate,
  sign,
  sparkline,
  TODAY,
  type Metric,
  type RangeId,
} from "./metric-data";
import styles from "./metric-explorer.module.css";

/** The edge drawn on the shared surface; the card and the panel use the same one. */
const SURFACE_EDGE = "inset 0 0 0 1px var(--metric-edge)";

/** Motion presets derived from the user's reduced-motion preference. */
function usePresets() {
  const reduce = useReducedMotion() ?? false;
  return {
    reduce,
    morph: reduce ? { duration: 0 } : motionTokens.spring.smooth,
    /** Entrance used when the cards come back after the chart closes. */
    reveal: (delay: number) =>
      reduce
        ? {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            transition: { duration: motionTokens.duration.instant },
          }
        : {
            initial: { opacity: 0, y: 6, filter: `blur(${motionTokens.blur.soft}px)` },
            animate: { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } },
            transition: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] as [number, number, number, number], delay },
          },
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface LayerItem {
  key: string;
  node: ReactNode;
}

/** Cross-fades stacked copies of a value, keeping the width of the widest one. */
function SwapLayers({ active, previous, items, className }: { active: string; previous: string | null; items: LayerItem[]; className?: string }) {
  return (
    <span className={className ? `${styles.layers} ${className}` : styles.layers}>
      {items.map(({ key, node }) => {
        const state = key === active ? "on" : key === previous ? "out" : "idle";
        return (
          <span key={key} className={styles.layer} data-state={state} aria-hidden={state !== "on" || undefined}>
            {node}
          </span>
        );
      })}
    </span>
  );
}

/** Swaps a single piece of text, blurring the old one out on the way. */
function SwapText({ id, children, delay = 0 }: { id: string; children: ReactNode; delay?: number }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <span className={styles.swap}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: "0.3em", filter: `blur(${motionTokens.blur.soft}px)` }}
          animate={{ opacity: 1, y: "0em", filter: "blur(0px)", transitionEnd: { filter: "none" } }}
          exit={
            reduce
              ? { opacity: 0, transition: { duration: 0 } }
              : { opacity: 0, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] as [number, number, number, number] } }
          }
          transition={
            reduce
              ? { duration: motionTokens.duration.instant }
              : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] as [number, number, number, number], delay }
          }
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** "+1.2%" with an arrow that turns with the tone; the number rolls when the range changes. */
function ChangeBadge({ metric, value, roll = false }: { metric: Metric; value: number; roll?: boolean }) {
  const tone = sign(value) === "" ? "flat" : value > 0 ? "good" : "bad";
  return (
    <span className={styles.change} data-tone={tone}>
      <span className={styles.arrow} aria-hidden="true">
        <ArrowUpRight size={14} strokeWidth={1.75} />
      </span>
      <span className={styles.num}>
        {roll ? (
          <AnimatedCounter
            value={Math.round(Math.abs(value) * 10) / 10}
            decimals={1}
            prefix={sign(value)}
            suffix={metric.change === "percent" ? "%" : "\u00a0pts"}
          />
        ) : (
          `${sign(value)}${Math.abs(value).toFixed(1)}${metric.change === "percent" ? "%" : " pts"}`
        )}
      </span>
    </span>
  );
}

/** A KPI card: label, value, change and a sparkline, all sitting on the shared surface. */
function MetricCard({
  metric,
  range,
  surfaceId,
  lead,
  returning,
  onOpen,
  buttonRef,
}: {
  metric: Metric;
  range: RangeId;
  surfaceId: string;
  /** The card the chart is about to open from. */
  lead: boolean;
  /** True while the grid plays its return entrance. */
  returning: boolean;
  onOpen: () => void;
  buttonRef: (node: HTMLButtonElement | null) => void;
}) {
  const { morph, reveal } = usePresets();
  const read = readMetric(metric, range);
  const spark = sparkline(metric, range);
  const words = RANGES[range].words;

  return (
    <li className={styles.cell} data-lead={lead || undefined}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.card}
        onClick={onOpen}
        aria-label={`${metric.label}: ${formatValue(metric, read.now)}, ${describeChange(metric, read.change)} over ${words}. Open chart`}
      >
        <motion.span
          layoutId={surfaceId}
          layoutDependency="card"
          className={styles.surface}
          style={{ borderRadius: 16, boxShadow: SURFACE_EDGE }}
          transition={morph}
          initial={!!returning && !lead && { opacity: 0 }}
          animate={{ opacity: 1 }}
          aria-hidden="true"
        />
        <motion.span className={styles.cardBody} {...(returning ? reveal(lead ? 0.16 : 0.08) : {})}>
          <span className={styles.cardLabel}>{metric.label}</span>
          <span className={styles.cardValue}>{formatValue(metric, read.now)}</span>
          <span className={styles.cardChange}>
            <ChangeBadge metric={metric} value={read.change} />
            <span className={styles.muted}>{words}</span>
          </span>
          <span className={styles.spark} aria-hidden="true">
            <svg viewBox="0 0 100 32" preserveAspectRatio="none">
              <path d={spark.d} />
            </svg>
            <span className={styles.sparkEnd} style={{ top: `${spark.end}%` }} />
          </span>
        </motion.span>
      </button>
    </li>
  );
}

/** Date label on the x axis; it fades out when it would collide with its neighbours. */
function AxisTick({ d, label, span, width, y }: { d: number; label: string; span: MotionValue<number>; width: MotionValue<number>; y: number }) {
  const x = useTransform([span, width], ([days, frame]: number[]) => chartX(d, days, frame));
  const opacity = useTransform([x, width], ([left, frame]: number[]) => clamp((Math.min(left - 52, frame - 6 - left) - 4) / 12, 0, 1));
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: motionTokens.duration.fast } }}
      transition={{ duration: motionTokens.duration.standard, delay: 0.06 }}
    >
      <motion.text className={styles.axis} style={{ x, opacity }} y={y} textAnchor="middle">
        {label}
      </motion.text>
    </motion.g>
  );
}

interface ChartGeometry {
  /** Path of the visible series. */
  cur: string;
  /** Path of the comparison series. */
  prev: string;
  endX: number;
  endY: number;
  x: number;
  line: number;
  cy: number;
  py: number;
}

/** The last frames of an outgoing series, so a metric change can be cross-faded point by point. */
interface Interpolated {
  cur: Float64Array;
  prev: Float64Array;
}

interface GeoInput {
  span: number;
  k: number;
  lo: number;
  hi: number;
  p: number;
  w: number;
  h: number;
  hover: number;
}

/** Both the visible and the previous series, easiest sampled together through the interpolation blend. */
function samplePair(item: Metric, interpolated: Interpolated | null, geo: GeoInput, index: number): [number, number] {
  const span = geo.hi - geo.lo || 1;
  const current = (sampleAt(item, geo.k, index) - geo.lo) / span;
  const previous = (sampleAt(item, geo.k, index - geo.span) - geo.lo) / span;
  return interpolated ? [interpolated.cur[index] + (current - interpolated.cur[index]) * geo.p, interpolated.prev[index] + (previous - interpolated.prev[index]) * geo.p] : [current, previous];
}

function buildGeometry(item: Metric, interpolated: Interpolated | null, geo: GeoInput): ChartGeometry {
  const plot = geo.h - 8 - 28;
  const toY = (value: number) => 8 + (1 - value) * plot;
  const start = Math.max(0, Math.floor(TODAY - geo.span));
  let cur = "";
  let prev = "";
  for (let index = start; index <= TODAY; index += 1) {
    const [current, previous] = samplePair(item, interpolated, geo, index);
    const x = chartX(index, geo.span, geo.w).toFixed(1);
    const command = index === start ? "M" : "L";
    cur += `${command}${x} ${toY(current).toFixed(1)}`;
    prev += `${command}${x} ${toY(previous).toFixed(1)}`;
  }
  const marker = geo.hover >= 0 ? geo.hover : TODAY;
  const [hoverCur, hoverPrev] = samplePair(item, interpolated, geo, marker);
  const [last] = samplePair(item, interpolated, geo, TODAY);
  const x = chartX(marker, geo.span, geo.w);
  return {
    cur,
    prev,
    endX: chartX(TODAY, geo.span, geo.w),
    endY: toY(last),
    x,
    line: Math.round(x) + 0.5,
    cy: toY(hoverCur),
    py: toY(hoverPrev),
  };
}

/** Fits the two year history into a 730-long array so the chart can morph older windows in. */
function snapshot(item: Metric, geo: GeoInput): Interpolated {
  const cur = new Float64Array(730);
  const prev = new Float64Array(730);
  for (let index = 0; index <= TODAY; index += 1) [cur[index], prev[index]] = samplePair(item, null, geo, index);
  return { cur, prev };
}

/** Axis labels and readouts print fewer decimals when the step is coarse. */
const decimalsFor = (step: number) => [0, 1, 2, 3].find((places) => Math.abs(Math.round(step * 10 ** places) - step * 10 ** places) < 1e-6) ?? 3;

const accountFormat = new Intl.NumberFormat("en-US");

/** The scrubbable line chart, with its axis, hover crosshair and tooltip. */
function Chart({ metric, range, hover, onHover, label, tableId }: { metric: Metric; range: RangeId; hover: number | null; onHover: (index: number | null) => void; label: string; tableId: string }) {
  const reduce = useReducedMotion() ?? false;
  const frameRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 720, h: 260 });
  const { w, h } = size;
  const plot = h - 8 - 28;
  const { days, weekly } = RANGES[range];
  const scale = useMemo(() => chartScale(metric, range), [metric, range]);
  const ticks = useMemo(() => axisTicks(range, w - 52 - 6), [range, w]);
  const minIndex = weekly ? TODAY - 7 * Math.floor((days - 1) / 7) : TODAY - days + 1;

  const spanValue = useMotionValue(days);
  const weeklyValue = useMotionValue(weekly ? 1 : 0);
  const loValue = useMotionValue(scale.lo);
  const hiValue = useMotionValue(scale.hi);
  const progressValue = useMotionValue(1);
  const widthValue = useMotionValue(w);
  const heightValue = useMotionValue(h);
  const hoverValue = useMotionValue(-1);
  // The geometry reads a ref, so bumping this counter is what forces a recalculation.
  const revision = useMotionValue(0);

  const metricRef = useRef(metric);
  const metricRange = useRef<RangeId>(range);
  const interpolated = useRef<Interpolated | null>(null);

  const geometry = useTransform(
    [spanValue, weeklyValue, loValue, hiValue, progressValue, widthValue, heightValue, hoverValue, revision],
    (latest: number[]): ChartGeometry =>
      buildGeometry(metricRef.current, interpolated.current, {
        span: latest[0],
        k: latest[1],
        lo: latest[2],
        hi: latest[3],
        p: latest[4],
        w: latest[5],
        h: latest[6],
        hover: latest[7],
      }),
  );

  const cur = useTransform(geometry, (value) => value.cur);
  const prev = useTransform(geometry, (value) => value.prev);
  const endX = useTransform(geometry, (value) => value.endX);
  const endY = useTransform(geometry, (value) => value.endY);
  const crossX = useTransform(geometry, (value) => value.line);
  const dotX = useTransform(geometry, (value) => value.x);
  const dotY = useTransform(geometry, (value) => value.cy);
  const prevDotY = useTransform(geometry, (value) => value.py);
  const pillX = useTransform([dotX, widthValue], ([x, frame]: number[]) => clamp(x, 100, frame - 6 - 48));

  useLayoutEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const measure = () => {
      const next = { w: Math.round(node.clientWidth), h: Math.round(node.clientHeight) };
      if (!next.w || !next.h) return;
      widthValue.set(next.w);
      heightValue.set(next.h);
      setSize((current) => (current.w === next.w && current.h === next.h ? current : next));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [widthValue, heightValue]);

  // Range and metric changes: hold the old curve, then ease the axes and the series across.
  useLayoutEffect(() => {
    const previous = metricRef.current;
    if (previous === metric && range === metricRange.current) return;
    const metricChanged = previous !== metric;
    const nextScale = chartScale(metric, range);
    const nextRange = RANGES[range];
    const ease = (value: MotionValue<number>, target: number) => {
      if (reduce) value.jump(target);
      else animate(value, target, motionTokens.spring.smooth);
    };
    hoverValue.set(-1);
    if (metricChanged) {
      interpolated.current = reduce
        ? null
        : snapshot(previous, {
            span: spanValue.get(),
            k: weeklyValue.get(),
            lo: loValue.get(),
            hi: hiValue.get(),
            p: progressValue.get(),
            w: widthValue.get(),
            h: heightValue.get(),
            hover: -1,
          });
      loValue.jump(nextScale.lo);
      hiValue.jump(nextScale.hi);
      if (reduce) {
        progressValue.jump(1);
      } else {
        progressValue.jump(0);
        animate(progressValue, 1, { ...motionTokens.spring.smooth, onComplete: () => (interpolated.current = null) });
      }
    } else {
      ease(loValue, nextScale.lo);
      ease(hiValue, nextScale.hi);
    }
    metricRef.current = metric;
    metricRange.current = range;
    ease(spanValue, nextRange.days);
    ease(weeklyValue, nextRange.weekly ? 1 : 0);
    revision.set(revision.get() + 1);
  }, [metric, range, reduce, spanValue, weeklyValue, loValue, hiValue, progressValue, widthValue, heightValue, hoverValue, revision]);

  const pointFromEvent = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const start = TODAY - spanValue.get() + 1;
    const raw = start + ((event.clientX - box.left) / Math.max(1, box.width)) * (TODAY - start);
    return clamp(weekly ? TODAY - 7 * Math.round((TODAY - raw) / 7) : Math.round(raw), minIndex, TODAY);
  };

  const scrub = (event: ReactPointerEvent<HTMLDivElement>) => {
    const index = pointFromEvent(event);
    hoverValue.set(index);
    onHover(index);
  };

  const marker = hover ?? TODAY;
  const scrubberLabel = `${longDate(marker)}: ${formatValue(metric, metric.daily[marker])}. ${longDate(marker - days)}: ${formatValue(metric, metric.daily[marker - days])}`;
  const clipId = `${tableId}-clip`;

  return (
    <div ref={frameRef} className={styles.chart}>
      <svg className={styles.svg} width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} aria-describedby={tableId}>
        <defs>
          <clipPath id={clipId}>
            <rect x={49} y={0} width={Math.max(0, w - 52 - 6 + 6)} height={h} />
          </clipPath>
        </defs>
        <g aria-hidden="true">
          {Array.from({ length: 5 }, (_, line) => {
            const y = Math.round(8 + (line * plot) / 4) + 0.5;
            return <line key={line} className={line === 4 ? styles.baseline : styles.gridLine} x1={52} x2={w - 6} y1={y} y2={y} />;
          })}
          <AnimatePresence initial={false}>
            {ticks.map((tick) => (
              <AxisTick key={`${tick.d}-${tick.label}`} d={tick.d} label={tick.label} span={spanValue} width={widthValue} y={h - 8} />
            ))}
          </AnimatePresence>
          <g clipPath={`url(#${clipId})`}>
            <motion.path className={styles.prevLine} d={prev} />
            <motion.path className={styles.curLine} d={cur} />
          </g>
          {hover === null ? (
            <motion.circle className={styles.endDot} cx={endX} cy={endY} r={3.5} />
          ) : (
            <g>
              <motion.line className={styles.crossLine} x1={crossX} x2={crossX} y1={8} y2={h - 28} />
              <motion.circle className={styles.prevDot} cx={dotX} cy={prevDotY} r={3} />
              <motion.circle className={styles.curDot} cx={dotX} cy={dotY} r={4} />
            </g>
          )}
        </g>
      </svg>

      <div className={styles.yLabels} style={{ width: 40 }} aria-hidden="true">
        {Array.from({ length: 5 }, (_, line) => {
          const value = scale.lo + line * scale.step;
          const text =
            metric.id === "mrr"
              ? `$${(value / 1e6).toFixed(Math.max(1, decimalsFor(scale.step / 1e6)))}M`
              : metric.id === "accounts"
                ? accountFormat.format(Math.round(value))
                : `${value.toFixed(decimalsFor(scale.step))}%`;
          return (
            <span key={line} className={styles.yLabel} style={{ top: Math.round(8 + ((4 - line) * plot) / 4) + 0.5 }}>
              <SwapText id={text} delay={reduce ? 0 : line * motionTokens.stagger.item}>
                {text}
              </SwapText>
            </span>
          );
        })}
      </div>

      <div
        className={styles.hit}
        style={{ left: 52, right: 6, height: h - 28 }}
        tabIndex={0}
        role="slider"
        aria-label={`Scrub ${metric.label}`}
        aria-orientation="horizontal"
        aria-valuemin={minIndex}
        aria-valuemax={TODAY}
        aria-valuenow={hover ?? TODAY}
        aria-valuetext={scrubberLabel}
        onPointerDown={scrub}
        onPointerMove={scrub}
        onPointerLeave={() => {
          hoverValue.set(-1);
          onHover(null);
        }}
        onFocus={() => {
          if (hoverValue.get() < 0) {
            hoverValue.set(TODAY);
            onHover(TODAY);
          }
        }}
        onBlur={() => {
          hoverValue.set(-1);
          onHover(null);
        }}
        onKeyDown={(event) => {
          const stride = (weekly ? 7 : 1) * (event.shiftKey ? (weekly ? 4 : 7) : 1);
          const current = hover ?? TODAY;
          const next =
            event.key === "ArrowLeft" || event.key === "ArrowDown"
              ? current - stride
              : event.key === "ArrowRight" || event.key === "ArrowUp"
                ? current + stride
                : event.key === "Home"
                  ? minIndex
                  : event.key === "End"
                    ? TODAY
                    : event.key === "Escape" && hover !== null
                      ? -1
                      : null;
          if (next === null) return;
          event.preventDefault();
          const value = next < 0 ? null : clamp(next, minIndex, TODAY);
          hoverValue.set(value ?? -1);
          onHover(value);
        }}
      />

      {hover !== null && (
        <motion.div className={styles.pillAnchor} style={{ x: pillX, top: h - 28 + 5 }} aria-hidden="true">
          <span className={styles.pill}>{longDate(hover)}</span>
        </motion.div>
      )}
    </div>
  );
}

/** Metric tabs; the highlight slides between them and the roving tabindex keeps arrow keys working. */
function MetricTabs({ active, idOf, panelId, onPick }: { active: string; idOf: (id: string) => string; panelId: string; onPick: (id: string) => void }) {
  const { reduce } = usePresets();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const lastActive = useRef(active);
  const x = useMotionValue(0);
  const width = useMotionValue(0);

  useLayoutEffect(() => {
    const first = lastActive.current === active && width.get() === 0;
    lastActive.current = active;
    const node = tabRefs.current[active];
    if (!node) return;
    if (first || reduce) {
      x.jump(node.offsetLeft);
      width.jump(node.offsetWidth);
      return;
    }
    const moveX = animate(x, node.offsetLeft, motionTokens.spring.morph);
    const grow = animate(width, node.offsetWidth, motionTokens.spring.morph);
    return () => {
      moveX.stop();
      grow.stop();
    };
  }, [active, reduce, x, width]);

  useLayoutEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const node = tabRefs.current[lastActive.current];
      if (!node) return;
      x.jump(node.offsetLeft);
      width.jump(node.offsetWidth);
    });
    Object.values(tabRefs.current).forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, [x, width]);

  return (
    <div
      className={styles.tabs}
      role="tablist"
      aria-label="Metric"
      onKeyDown={(event) => {
        const index = METRICS.findIndex((item) => item.id === active);
        const next =
          event.key === "ArrowRight"
            ? METRICS[(index + 1) % METRICS.length].id
            : event.key === "ArrowLeft"
              ? METRICS[(index + METRICS.length - 1) % METRICS.length].id
              : event.key === "Home"
                ? METRICS[0].id
                : event.key === "End"
                  ? METRICS[METRICS.length - 1].id
                  : null;
        if (!next) return;
        event.preventDefault();
        onPick(next);
        tabRefs.current[next]?.focus();
      }}
    >
      <motion.span className={styles.tabHighlight} style={{ x, width }} aria-hidden="true" />
      {METRICS.map((item) => (
        <button
          key={item.id}
          ref={(node) => {
            tabRefs.current[item.id] = node;
          }}
          id={idOf(item.id)}
          type="button"
          role="tab"
          className={styles.tab}
          aria-selected={item.id === active}
          aria-controls={panelId}
          tabIndex={item.id === active ? 0 : -1}
          onClick={() => onPick(item.id)}
        >
          <span>{item.short}</span>
          <span className={styles.tabValue}>{formatValue(item, item.daily[TODAY])}</span>
        </button>
      ))}
    </div>
  );
}

/** The table view of the chart, announced through aria-describedby. */
const DataTable = memo(function DataTable({ metric, range, id }: { metric: Metric; range: RangeId; id: string }) {
  const window = RANGES[range];
  const rows = window.weekly
    ? Array.from({ length: window.days / 7 }, (_, step) => TODAY - window.days + 7 * (step + 1))
    : Array.from({ length: window.days }, (_, step) => TODAY - window.days + 1 + step);
  return (
    <div className={styles.srOnly}>
      <table id={id}>
        <caption>
          {metric.label}, {rangeLabel(range)}, with the same day in the previous period
        </caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">{metric.label}</th>
            <th scope="col">Previous period</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row}>
              <th scope="row">{longDate(row)}</th>
              <td>{formatValue(metric, metric.daily[row])}</td>
              <td>{formatValue(metric, metric.daily[row - window.days])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

/** The open state: shared surface, tabs, readout, range switch, chart and definition. */
function MetricPanel({
  surfaceId,
  active,
  previous,
  range,
  prevRange,
  ids,
  onPick,
  onRange,
  onClose,
}: {
  surfaceId: string;
  active: string;
  previous: string | null;
  range: RangeId;
  prevRange: RangeId | null;
  ids: string;
  onPick: (id: string) => void;
  onRange: (range: RangeId) => void;
  onClose: () => void;
}) {
  const { morph, reveal } = usePresets();
  const [hover, setHover] = useState<number | null>(null);
  const [shown, setShown] = useState({ active, range });
  if (shown.active !== active || shown.range !== range) {
    setShown({ active, range });
    setHover(null);
  }
  const bodyRef = useRef<HTMLDivElement>(null);
  const tabId = (id: string) => `${ids}-tab-${id}`;
  const panelId = `${ids}-panel`;
  const tableId = `${ids}-table`;

  useEffect(() => {
    bodyRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true });
  }, []);

  const metric = metricById[active];
  const window = RANGES[range];
  const read = readMetric(metric, range);
  const marker = hover ?? TODAY;
  const compareIndex = marker - window.days;
  const firstIndex = window.weekly ? TODAY - window.days + 7 : TODAY - window.days + 1;
  const summary = `Line chart of ${metric.label} over the last ${window.words}, from ${formatValue(metric, metric.daily[firstIndex])} on ${longDate(firstIndex)} to ${formatValue(metric, read.now)} today, ${describeChange(metric, read.change)} from ${window.words} ago. A dashed line shows the previous ${window.words}.`;

  const layers = (render: (item: Metric, isActive: boolean) => ReactNode): LayerItem[] => METRICS.map((item) => ({ key: item.id, node: render(item, item.id === active) }));

  return (
    <div className={styles.panel}>
      <motion.div layoutId={surfaceId} layoutDependency="panel" className={styles.surface} style={{ borderRadius: 16, boxShadow: SURFACE_EDGE }} transition={morph} aria-hidden="true" />
      <motion.div ref={bodyRef} className={styles.panelBody} {...reveal(0.12)}>
        <MetricTabs active={active} idOf={tabId} panelId={panelId} onPick={onPick} />
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close chart" aria-keyshortcuts="Escape">
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>

        <div className={styles.view} id={panelId} role="tabpanel" aria-labelledby={tabId(active)}>
          <div className={styles.readout}>
            <div className={styles.figures}>
              <h3 className={styles.panelLabel}>
                <SwapLayers active={active} previous={previous} items={layers((item) => item.label)} />
              </h3>
              <p className={styles.panelValue}>
                <SwapLayers
                  active={active}
                  previous={previous}
                  items={layers((item, isActive) => formatValue(item, isActive && hover !== null ? item.daily[marker] : item.daily[TODAY]))}
                />
              </p>
              <p className={styles.panelChange}>
                <SwapLayers
                  active={active}
                  previous={previous}
                  items={layers((item, isActive) => {
                    const scrubbed = isActive && hover !== null;
                    const change = scrubbed ? changeBetween(item, item.daily[marker], item.daily[compareIndex]) : readMetric(item, range).change;
                    return (
                      <>
                        <ChangeBadge metric={item} value={change} roll={isActive && !scrubbed} />
                        <span className={styles.muted}>{scrubbed ? `${shortDate(marker)} vs ${shortDate(compareIndex)}` : `vs ${window.words} ago`}</span>
                      </>
                    );
                  })}
                />
              </p>
            </div>
            <div className={styles.presets}>
              <SegmentedControl label="Chart range" value={range} onValueChange={(value) => onRange(value as RangeId)} options={RANGE_IDS.map((id) => ({ value: id, label: RANGES[id].label }))} />
            </div>
          </div>

          <p className={styles.legend} aria-hidden="true">
            <span className={styles.key}>
              <span className={styles.keyLine} />
              This period
            </span>
            <span className={styles.key}>
              <span className={styles.keyDash} />
              Previous period
            </span>
            <span className={styles.window}>
              <SwapLayers active={range} previous={prevRange} items={RANGE_IDS.map((id) => ({ key: id, node: rangeLabel(id) }))} />
            </span>
          </p>

          <Chart metric={metric} range={range} hover={hover} onHover={setHover} label={summary} tableId={tableId} />

          <p className={styles.definition}>
            <SwapLayers active={active} previous={previous} items={layers((item) => item.definition)} />
          </p>

          <DataTable metric={metric} range={range} id={tableId} />
        </div>
      </motion.div>
    </div>
  );
}

/** Shared layout ids for the card surfaces and the panel they morph into. */
const SURFACES = {
  cards: { mrr: "s0", accounts: "s1", activation: "s2", nrr: "s3" } as Record<string, string>,
  panel: "s0",
  serial: 4,
};

/**
 * KPI cards that open into a scrubbable chart and morph between metrics and ranges.
 *
 * Takes no props; the series live in `metric-data.ts`.
 */
export function MetricExplorer() {
  const { morph } = usePresets();
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const titleId = `${id}-title`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<{ active: string; previous: string | null }>({ active: "mrr", previous: null });
  const [range, setRange] = useState<{ now: RangeId; previous: RangeId | null }>({ now: "30d", previous: null });
  const [surfaces, setSurfaces] = useState(SURFACES);
  const [returning, setReturning] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const restoreFocus = useRef(false);
  const { active: current, previous } = active;

  useEffect(() => {
    if (!open && restoreFocus.current) {
      restoreFocus.current = false;
      cardRefs.current[current]?.focus({ preventScroll: true });
    }
  }, [open, current]);

  const describe = (id: string, rangeId: RangeId) => {
    const item = metricById[id];
    const read = readMetric(item, rangeId);
    return `${item.label}, last ${RANGES[rangeId].words}: ${formatValue(item, read.now)}, ${describeChange(item, read.change)} from ${RANGES[rangeId].words} ago`;
  };

  const close = () => {
    restoreFocus.current = true;
    setSurfaces((state) => {
      let serial = state.serial;
      return {
        cards: Object.fromEntries(METRICS.map((item) => [item.id, item.id === active.active ? state.panel : `s${serial++}`])),
        panel: state.panel,
        serial,
      };
    });
    setOpen(false);
    setAnnouncement(`Chart closed. ${METRICS.length} metrics shown.`);
  };

  return (
    <section
      className={styles.root}
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (open && event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          close();
        }
      }}
    >
      <motion.header layout="position" layoutDependency={open} transition={morph} className={styles.header}>
        <h2 id={titleId}>Growth metrics</h2>
        <p>Parcelwise · updated {longDate(TODAY)} at 09:00 UTC</p>
      </motion.header>

      {open ? (
        <MetricPanel
          surfaceId={surfaces.panel}
          active={current}
          previous={previous}
          range={range.now}
          prevRange={range.previous}
          ids={id}
          onPick={(next) => {
            if (next === current) return;
            setActive({ active: next, previous: current });
            setAnnouncement(describe(next, range.now));
          }}
          onRange={(next) => {
            if (next === range.now) return;
            setRange({ now: next, previous: range.now });
            setAnnouncement(describe(current, next));
          }}
          onClose={close}
        />
      ) : (
        <ul className={styles.grid}>
          {METRICS.map((item) => (
            <MetricCard
              key={item.id}
              metric={item}
              range={range.now}
              surfaceId={surfaces.cards[item.id]}
              lead={returning && item.id === current}
              returning={returning}
              onOpen={() => {
                setSurfaces((state) => ({ ...state, panel: state.cards[item.id] }));
                setActive({ active: item.id, previous: null });
                setOpen(true);
                setReturning(true);
                setAnnouncement(describe(item.id, range.now));
              }}
              buttonRef={(node) => {
                cardRefs.current[item.id] = node;
              }}
            />
          ))}
        </ul>
      )}

      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}

export default MetricExplorer;
