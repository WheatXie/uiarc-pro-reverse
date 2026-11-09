"use client";

import { ArrowUpRight } from "lucide-react";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import SegmentedControl from "../segmented-control/segmented-control";
import { motionTokens } from "../lib/motion-tokens";
import {
  axisScale,
  bandGeometry,
  barText,
  chartHeight,
  countPhrase,
  describeAmount,
  EMPTY_PATH,
  figure,
  MOVEMENTS,
  PERIOD_OPTIONS,
  tickText,
  UNIT_OPTIONS,
  WATERFALLS,
  type Column,
  type Entry,
  type MovementTone,
  type Unit,
  type Waterfall,
} from "./mrr-data";
import styles from "./mrr-waterfall.module.css";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const join = (...names: (string | undefined | false)[]) => names.filter(Boolean).join(" ");
const integer = new Intl.NumberFormat("en-US");
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** One bar with rounded ends; totals get a flat bottom so the axis break reads as a cut. */
function barPath(x: number, y: number, width: number, height: number, radiusTop: number, radiusBottom: number): string {
  if (height < 0.5) return EMPTY_PATH;
  const top = Math.min(radiusTop, height / 2, width / 2);
  const bottom = Math.min(radiusBottom, height / 2, width / 2);
  return `M${x} ${y + top}a${top} ${top} 0 0 1 ${top} ${-top}h${width - 2 * top}a${top} ${top} 0 0 1 ${top} ${top}v${height - top - bottom}a${bottom} ${bottom} 0 0 1 ${-bottom} ${bottom}h${-(width - 2 * bottom)}a${bottom} ${bottom} 0 0 1 ${-bottom} ${-bottom}z`;
}

interface Shapes {
  bars: string[];
  breaks: string[];
  links: string[];
  labelY: number[];
  labelOpacity: number[];
  labelValue: number[];
  base: number;
}

/**
 * All the paths for one frame of the chart: seven bars, six connectors, two axis breaks and the
 * position of each label. Input is the flattened motion values, in the order they were created.
 */
function buildShapes(values: number[]): Shapes {
  const levels = values.slice(0, 6);
  const grow = values.slice(6, 13);
  const draw = values.slice(13, 19);
  const [lo, hi, width, height, base] = values.slice(19);
  const { bar, left } = bandGeometry(width);
  const floor = height - 34;
  const toY = (value: number) => 30 + ((hi - value) / Math.max(1e-6, hi - lo)) * (floor - 30);
  const shapes: Shapes = { bars: [], breaks: [], links: [], labelY: [], labelOpacity: [], labelValue: [], base };

  for (let index = 0; index < 7; index += 1) {
    const total = index === 0 || index === 6;
    const from = total ? lo : levels[index - 1];
    const to = index === 6 ? levels[5] : levels[index];
    const value = from + grow[index] * (to - from);
    const top = Math.round(toY(Math.max(from, value)));
    const bottom = total ? floor : Math.round(toY(Math.min(from, value)));
    const x = left(index);
    shapes.bars.push(barPath(x, top, bar, bottom - top, total ? 3 : 2, total ? 0 : 2));
    shapes.breaks.push(total && bottom - top > 26 ? `M${x} ${floor - 9}L${x + bar} ${floor - 14}V${floor - 11}L${x} ${floor - 6}z` : EMPTY_PATH);
    shapes.labelY.push(to < from ? bottom + 6 : top - 6);
    shapes.labelOpacity.push(clamp(1.6 * grow[index] - 0.1, 0, 1));
    shapes.labelValue.push(total ? value : Math.abs(value - from));
  }

  for (let index = 0; index < 6; index += 1) {
    const start = left(index) + bar;
    const end = left(index + 1);
    const y = Math.round(toY(levels[index])) - 0.5;
    shapes.links.push(draw[index] > 0.001 ? `M${start} ${y}H${start + (end - start) * clamp(draw[index], 0, 1)}` : EMPTY_PATH);
  }

  return shapes;
}

/** A bar; the tone decides the fill and the dim flag mutes it while another column is read. */
function Bar({ index, shapes, tone, dim }: { index: number; shapes: MotionValue<Shapes>; tone: MovementTone; dim: boolean }) {
  const d = useTransform(shapes, (value) => value.bars[index]);
  return <motion.path className={styles.bar} data-tone={tone} data-dim={dim || undefined} d={d} />;
}

/** The cut mark that says the axis does not start at zero. */
function Break({ index, shapes, active }: { index: number; shapes: MotionValue<Shapes>; active: boolean }) {
  const d = useTransform(shapes, (value) => value.breaks[index]);
  return <motion.path className={styles.break} data-active={active || undefined} d={d} />;
}

/** Connector between the top of one column and the base of the next. */
function Link({ index, shapes }: { index: number; shapes: MotionValue<Shapes> }) {
  const d = useTransform(shapes, (value) => value.links[index]);
  return <motion.path className={styles.link} d={d} />;
}

/** A gridline and its tick label, easing to the new scale when the period or unit changes. */
function GridLine({ value, unit, lo, hi, base, height, width }: { value: number; unit: Unit; lo: MotionValue<number>; hi: MotionValue<number>; base: MotionValue<number>; height: MotionValue<number>; width: number }) {
  const reduce = useReducedMotion() ?? false;
  const y = useTransform([lo, hi, base, height], ([min, max, origin, frame]: number[]) =>
    Math.round(30 + ((max - (unit === "pct" ? (value * origin) / 100 : value)) / Math.max(1e-6, max - min)) * (frame - 34 - 30)) - 0.5,
  );
  const opacity = useTransform([y, height], ([top, frame]: number[]) => clamp(1 - Math.max(16 - top, top - (frame - 34) - 1, 0) / 10, 0, 1));
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduce ? 0 : motionTokens.duration.fast } }}
      transition={{ duration: reduce ? 0 : motionTokens.duration.standard, ease: [...motionTokens.ease.enter] as [number, number, number, number], delay: reduce ? 0 : 0.06 }}
    >
      <motion.g style={{ y, opacity }}>
        <line className={styles.grid} x1={48} x2={width} y1={0} y2={0} />
        <text className={styles.tick} x={38} y={0} dy=".32em" textAnchor="end">
          {tickText(value, unit)}
        </text>
      </motion.g>
    </motion.g>
  );
}

/** The value above (or below) a bar; it swaps in when the period, unit or width changes. */
function LabelText({ index, shapes, format, reduce }: { index: number; shapes: MotionValue<Shapes>; format: { key: string; text: (value: number, start: number) => string }; reduce: boolean }) {
  const text = useTransform(shapes, (value) => format.text(value.labelValue[index], value.base));
  return (
    <motion.span
      className={styles.labelText}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: "0.4em" }}
      animate={{ opacity: 1, y: "0em" }}
      exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: "-0.35em", transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] as [number, number, number, number] } }}
      transition={reduce ? { duration: 0 } : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] as [number, number, number, number] }}
    >
      {text}
    </motion.span>
  );
}

/** Positioned bar label; it fades out near the edges and dims while another column is read. */
function BarLabel({ index, shapes, x, format, below, dim }: { index: number; shapes: MotionValue<Shapes>; x: number; format: { key: string; text: (value: number, start: number) => string }; below: boolean; dim: boolean }) {
  const reduce = useReducedMotion() ?? false;
  const y = useTransform(shapes, (value) => value.labelY[index]);
  const opacity = useTransform(shapes, (value) => value.labelOpacity[index]);
  return (
    <motion.div className={styles.label} style={{ x, y, opacity }}>
      <div className={styles.labelInner} data-below={below || undefined} data-dim={dim || undefined}>
        <AnimatePresence initial={false}>
          <LabelText key={format.key} index={index} shapes={shapes} format={format} reduce={reduce} />
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/** A figure with its sign that re-rolls when the number changes. */
function SwapFigure({ fig, className }: { fig: { value: number; decimals?: number; prefix?: string; suffix?: string; key: string }; className?: string }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <span className={join(styles.swap, className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={fig.key}
          className={styles.phase}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: "0.4em" }}
          animate={{ opacity: 1, y: "0em" }}
          exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: "-0.35em", transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] as [number, number, number, number] } }}
          transition={reduce ? { duration: 0 } : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] as [number, number, number, number] }}
        >
          <span className={styles.num}>
            <AnimatedCounter value={fig.value} decimals={fig.decimals} prefix={fig.prefix} suffix={fig.suffix} />
          </span>
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Text that swaps in place, used for every label that reflects the current period. */
function SwapText({ text, className }: { text: string; className?: string }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <span className={join(styles.swap, className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          className={styles.phase}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: "0.4em" }}
          animate={{ opacity: 1, y: "0em" }}
          exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: "-0.35em", transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] as [number, number, number, number] } }}
          transition={reduce ? { duration: 0 } : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] as [number, number, number, number] }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** One account behind the current movement, with a bar showing its share of the column. */
function Row({ entry, column, unit, start, index }: { entry: Entry; column: Column; unit: Unit; start: number; index: number }) {
  const reduce = useReducedMotion() ?? false;
  const share = column.amount ? (entry.amount / column.amount) * 100 : 0;
  return (
    <motion.li
      layout="position"
      className={styles.row}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: reduce ? 0 : motionTokens.duration.instant } }}
      transition={reduce ? { duration: 0 } : { layout: motionTokens.spring.smooth, default: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] as [number, number, number, number], delay: index * motionTokens.stagger.item } }}
    >
      <span className={styles.rowName} data-rest={entry.key === "rest" || undefined}>
        {entry.name}
      </span>
      <SwapFigure className={styles.rowAmount} fig={figure(entry.amount, column.tone, unit, start)} />
      <SwapText className={styles.rowDetail} text={entry.detail} />
      <span className={styles.share} aria-hidden="true">
        <motion.span
          className={styles.shareFill}
          data-tone={column.tone}
          initial={{ width: "0%" }}
          animate={{ width: `${share}%` }}
          transition={reduce ? { duration: 0 } : { ...motionTokens.spring.morph, delay: index * motionTokens.stagger.item }}
        />
      </span>
    </motion.li>
  );
}

/**
 * MRR movement as a waterfall: where revenue started, what moved it, and where it ended.
 *
 * Takes no props; the months live in `mrr-data.ts`.
 */
export function MrrWaterfall() {
  const reduce = useReducedMotion() ?? false;
  const id = useId();
  const titleId = `${id}-title`;
  const panelId = `${id}-panel`;
  const [periodId, setPeriodId] = useState("q3");
  const [unit, setUnit] = useState<Unit>("usd");
  const [selected, setSelected] = useState(1);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focusVisible, setFocusVisible] = useState(false);
  const [width, setWidth] = useState(700);
  const [announcement, setAnnouncement] = useState("");
  const chartRef = useRef<HTMLDivElement>(null);
  const hitRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const inView = useInView(chartRef, { once: true, amount: 0.35 });

  const period = WATERFALLS[periodId];
  const scale = useMemo(() => axisScale(period, unit), [period, unit]);
  const height = chartHeight(width);

  const [values] = useState(() => {
    const initial = WATERFALLS.q3;
    const initialScale = axisScale(initial, "usd");
    return {
      levels: initial.levels.map((level) => level as number),
      grow: Array.from({ length: 7 }, () => 0),
      draw: Array.from({ length: 6 }, () => 0),
      lo: initialScale.lo,
      hi: initialScale.hi,
      base: initial.start,
      width: 700,
      height: chartHeight(700),
    };
  });
  const levels = values.levels.map(() => useMotionValue(0));
  const grow = values.grow.map(() => useMotionValue(0));
  const draw = values.draw.map(() => useMotionValue(0));
  const lo = useMotionValue(values.lo);
  const hi = useMotionValue(values.hi);
  const chartWidth = useMotionValue(values.width);
  const chartFrame = useMotionValue(values.height);
  const base = useMotionValue(values.base);

  const shapes = useTransform(
    [...levels, ...grow, ...draw, lo, hi, chartWidth, chartFrame, base],
    (latest: number[]) => buildShapes(latest),
  );

  useLayoutEffect(() => {
    const node = chartRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    chartWidth.set(width);
    chartFrame.set(height);
  }, [chartWidth, chartFrame, width, height]);

  // The bars grow once, when the chart scrolls into view.
  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      grow.forEach((value) => value.jump(1));
      draw.forEach((value) => value.jump(1));
      return;
    }
    const running = [
      ...grow.map((value, index) => animate(value, 1, { ...motionTokens.spring.smooth, delay: 0.06 * index })),
      ...draw.map((value, index) => animate(value, 1, { ...motionTokens.spring.smooth, visualDuration: 0.3, delay: 0.06 * index + 0.2 })),
    ];
    return () => running.forEach((animation) => animation.stop());
  }, [inView, reduce, grow, draw]);

  // Period and unit changes tween the running totals, the axis and the percentage base together.
  useEffect(() => {
    const move = (value: MotionValue<number>, target: number) => {
      if (reduce) value.jump(target);
      else if (value.get() !== target || value.isAnimating()) animate(value, target, motionTokens.spring.morph);
    };
    period.levels.forEach((level, index) => move(levels[index], level));
    move(lo, scale.lo);
    move(hi, scale.hi);
    move(base, period.start);
  }, [period, scale, reduce, levels, lo, hi, base]);

  const { band, bar, left } = bandGeometry(width);
  const tightAxis = band < 64;
  const tight = band < 48;
  const floor = height - 34;
  const active = hovered ?? (focusVisible ? selected : null);
  const column = period.columns[hovered ?? selected];
  const firstColumn = period.columns[0];
  const logoChurn = (period.columns[5].count / firstColumn.count) * 100;
  const summary = `MRR waterfall for ${period.long}. ${period.columns.map((item) => `${item.name} ${describeAmount(item.amount, item.tone, "usd", period.start)}`).join(", ")}.`;

  const select = (index: number) => {
    setSelected(index);
    const next = period.columns[index];
    setAnnouncement(`${next.name}, ${describeAmount(next.amount, next.tone, unit, period.start)}, ${integer.format(next.count)} ${countPhrase(next, period)}`);
  };

  const onHitKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: selected + 1,
      ArrowDown: selected + 1,
      ArrowLeft: selected - 1,
      ArrowUp: selected - 1,
      Home: 0,
      End: 6,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = (moves[event.key] + 7) % 7;
    select(next);
    hitRefs.current[next]?.focus();
  };

  const labelFormat = (tone: MovementTone) =>
    unit === "pct"
      ? { key: `pct${tone}${tightAxis}`, text: (value: number, start: number) => `${tone === "gain" ? "+" : tone === "loss" ? "−" : ""}${((value / Math.max(1e-6, start)) * 100).toFixed(1)}${tightAxis ? "" : "%"}` }
      : { key: `k${tone}${tightAxis}`, text: (value: number) => barText(value, tone, unit, period.start, tightAxis) };

  return (
    <section className={styles.root} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 id={titleId}>MRR movement</h2>
          <p>
            <SwapText text={`All plans · ${period.range}`} />
          </p>
        </div>
        <div className={styles.controls}>
          <SegmentedControl
            label="Period"
            options={PERIOD_OPTIONS}
            value={periodId}
            onValueChange={(next) => {
              const target = WATERFALLS[next];
              setPeriodId(target.id);
              setAnnouncement(`${target.long}: MRR moved from ${dollars.format(target.start)} to ${dollars.format(target.end)}, ${target.stats.growth >= 0 ? "up" : "down"} ${Math.abs(target.stats.growth).toFixed(1)}%`);
            }}
          />
          <SegmentedControl
            label="Show values as"
            options={UNIT_OPTIONS}
            value={unit}
            onValueChange={(next) => {
              setUnit(next as Unit);
              setAnnouncement(next === "pct" ? "Showing values as a percent of starting MRR" : "Showing values in US dollars");
            }}
          />
        </div>
      </header>

      <div className={styles.summary}>
        <div className={styles.headline}>
          <p className={styles.kpiLabel}>
            <SwapText text={`Ending MRR on ${period.to}`} />
          </p>
          <p className={styles.kpiValue}>
            <span className={styles.num}>
              <AnimatedCounter value={period.end} prefix="$" animateOnView />
            </span>
          </p>
          <p className={styles.delta}>
            <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true" className={styles.deltaIcon} />
            <SwapFigure className={styles.deltaValue} fig={{ value: period.stats.netNew, prefix: "+$", key: "net" }} />
            <SwapFigure className={styles.deltaValue} fig={{ value: period.stats.growth, decimals: 1, prefix: "+", suffix: "%", key: "growth" }} />
            <SwapText text={`since ${period.from}`} />
          </p>
        </div>
        <dl className={styles.stats}>
          <div>
            <dt>Net revenue retention</dt>
            <dd>
              <SwapFigure fig={{ value: period.stats.nrr, decimals: 1, suffix: "%", key: "nrr" }} />
            </dd>
          </div>
          <div>
            <dt>Quick ratio</dt>
            <dd>
              <SwapFigure fig={{ value: period.stats.quick, decimals: 2, key: "quick" }} />
            </dd>
          </div>
          <div>
            <dt>Logo churn</dt>
            <dd>
              <SwapFigure fig={{ value: logoChurn, decimals: 1, suffix: "%", key: "logo" }} />
            </dd>
          </div>
        </dl>
      </div>

      <div className={styles.body}>
        <div ref={chartRef} className={styles.chart} style={{ height }}>
          <svg className={styles.svg} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={summary}>
            {active !== null && <rect className={styles.band} x={48 + band * active + 3} y={2} width={Math.max(0, band - 6)} height={height - 4} rx={12} />}
            <g>
              <AnimatePresence initial={false}>
                {scale.ticks.map((tick) => (
                  <GridLine key={`${unit}:${tick}`} value={tick} unit={unit} lo={lo} hi={hi} base={base} height={chartFrame} width={width} />
                ))}
              </AnimatePresence>
            </g>
            <line className={styles.baseline} x1={48} x2={width} y1={floor - 0.5} y2={floor - 0.5} />
            {period.columns.slice(0, -1).map((item, index) => (
              <Link key={item.id} index={index} shapes={shapes} />
            ))}
            {period.columns.map((item, index) => (
              <Bar key={item.id} index={index} shapes={shapes} tone={item.tone} dim={active !== null && active !== index} />
            ))}
            <Break index={0} shapes={shapes} active={active === 0} />
            <Break index={6} shapes={shapes} active={active === 6} />
            <motion.rect
              className={styles.marker}
              x={0}
              y={floor + 2}
              width={bar}
              height={2}
              rx={1}
              initial={false}
              animate={{ x: left(selected) }}
              transition={reduce ? { duration: 0 } : motionTokens.spring.snappy}
            />
            {period.columns.map((item, index) => (
              <text key={item.id} className={styles.axis} data-tight={tight || undefined} data-current={index === (hovered ?? selected) || undefined} x={left(index) + bar / 2} y={height - 10} textAnchor="middle">
                {tightAxis ? item.short : item.axis}
              </text>
            ))}
          </svg>

          <div className={styles.labels} data-tight={tight || undefined} aria-hidden="true">
            {period.columns.map((item, index) => (
              <BarLabel
                key={item.id}
                index={index}
                shapes={shapes}
                x={left(index) + bar / 2}
                format={labelFormat(item.tone)}
                below={item.tone === "loss"}
                dim={active !== null && active !== index}
              />
            ))}
          </div>

          <div
            className={styles.hits}
            role="radiogroup"
            aria-label="Movements"
            aria-controls={panelId}
            onPointerLeave={() => setHovered(null)}
            onFocus={(event) => setFocusVisible(event.target.matches(":focus-visible"))}
            onBlur={() => setFocusVisible(false)}
          >
            {period.columns.map((item, index) => (
              <button
                key={item.id}
                ref={(node) => {
                  hitRefs.current[index] = node;
                }}
                type="button"
                role="radio"
                aria-checked={selected === index}
                tabIndex={selected === index ? 0 : -1}
                aria-label={`${item.name}, ${describeAmount(item.amount, item.tone, unit, period.start)}, ${integer.format(item.count)} ${countPhrase(item, period)}`}
                className={styles.hit}
                style={{ left: 48 + band * index, width: band, height }}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") setHovered(index);
                }}
                onClick={() => select(index)}
                onKeyDown={onHitKeyDown}
              />
            ))}
          </div>
        </div>

        <section id={panelId} className={styles.panel} aria-label={`Accounts behind ${column.name.toLowerCase()}`}>
          <div className={styles.panelHead}>
            <h3>
              <span className={styles.swatch} data-tone={column.tone} aria-hidden="true" />
              <SwapText text={column.name} />
            </h3>
            <SwapFigure className={styles.panelTotal} fig={figure(column.amount, column.tone, unit, period.start)} />
          </div>
          <p className={styles.panelMeta}>
            <span className={styles.num}>
              <AnimatedCounter value={column.count} />
            </span>{" "}
            <SwapText text={countPhrase(column, period)} />
          </p>
          <ul className={styles.rows}>
            <AnimatePresence mode="popLayout" initial={false}>
              {column.entries.map((entry, index) => (
                <Row key={`${column.id}:${entry.key}`} entry={entry} column={column} unit={unit} start={period.start} index={index} />
              ))}
            </AnimatePresence>
          </ul>
          <p className={styles.hint}>
            <SwapText text={hovered === null || hovered === selected ? "Select a bar or use the arrow keys to see its accounts" : "Click the bar to keep this list"} />
          </p>
        </section>
      </div>

      <div className={styles.srOnly}>
        <table>
          <caption>MRR movement, {period.long}</caption>
          <thead>
            <tr>
              <th scope="col">Movement</th>
              <th scope="col">Amount</th>
              <th scope="col">Share of starting MRR</th>
              <th scope="col">Accounts</th>
            </tr>
          </thead>
          <tbody>
            {period.columns.map((item) => (
              <tr key={item.id}>
                <th scope="row">{item.name}</th>
                <td>{describeAmount(item.amount, item.tone, "usd", period.start)}</td>
                <td>{((item.amount / period.start) * 100).toFixed(1)}%</td>
                <td>{integer.format(item.count)}</td>
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

export default MrrWaterfall;
