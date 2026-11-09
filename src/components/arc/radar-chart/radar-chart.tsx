"use client";

/**
 * Radar chart — two or three profiles on one web of five to eight measures.
 *
 * Reconstructed from the shipped Pro preview chunk. The web is a polar grid: rings, spokes and one
 * polygon per profile. Profiles are drawn by position, so swapping one morphs its shape into the
 * next instead of fading (the target values are normalized per axis and the polygon is redrawn on a
 * spring). Pointing at the stage snaps to the nearest spoke and, at the centre, keeps the spoke you
 * are on; the tooltip lists every profile sorted by value with the gap to the leader. Every pointer
 * interaction has a keyboard twin — arrows, Home, End and Escape move the same reading — and the
 * whole chart is repeated as a live region, a sentence and a table for screen readers.
 */
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./radar-chart.module.css";

/** One measure around the web. */
export interface RadarAxis {
  /** Stable identity. It is the key read from every series' `values`, and the axis the tooltip follows. */
  key: string;
  /** Shown at the end of the spoke, in the tooltip title, in the summary and in the table. */
  label: string;
  /** Top of this axis. Defaults to the chart `max`. Values are normalized against it. */
  max?: number;
}

/** One profile drawn on the web. */
export interface RadarSeries {
  /** Stable identity. Series are drawn by position, so replacing the series at a slot morphs that shape. */
  key: string;
  /** Profile name, used by the legend, the tooltip rows and the table columns. */
  label: string;
  /** Value per axis key. A missing key counts as zero. */
  values: Record<string, number>;
}

export interface RadarChartProps {
  /** Measures around the web, clockwise from the top: `{ key, label, max? }`. At least three. */
  axes: readonly RadarAxis[];
  /** Up to three profiles: `{ key, label, values }`. They take the series hues in order, the first derived from the accent; replacing the series at a position morphs that shape. */
  series: readonly RadarSeries[];
  /** What is compared. Names the chart, the summary, and the table. */
  label: string;
  /** Default top of every axis. */
  max?: number;
  /** Concentric guides. */
  rings?: number;
  /** Largest web diameter in pixels. It shrinks to fit narrow containers. */
  size?: number;
  /** Formats values in the tooltip and table. */
  formatValue?: (value: number, axis: RadarAxis) => string;
  /** Controlled axis in focus. */
  activeAxis?: string | null;
  /** Called as the axis in focus changes. */
  onActiveAxisChange?: (key: string | null) => void;
  /** Profile names with a line key. Hovering or pressing one brings its shape forward. */
  legend?: boolean;
  /** Message with fewer than three axes or no series. */
  emptyLabel?: string;
  /** Forwarded to the figure. */
  ref?: Ref<HTMLElement>;
  /** Extra class on the figure. */
  className?: string;
}

/** A spring written the way the design system states it: how long it visually takes, how much it bounces. */
function springFromVisualDuration({ visualDuration, bounce }: { visualDuration: number; bounce: number }, restDelta = 5e-4) {
  const omega = (2 * Math.PI) / (1.2 * visualDuration);
  return {
    type: "spring" as const,
    stiffness: omega * omega,
    damping: 2 * (1 - bounce) * omega,
    restDelta,
    restSpeed: 2 * restDelta,
  };
}

/** Shape morphs settle without overshoot, at the same cadence as the rest of the gallery. */
const SHAPE_MORPH = springFromVisualDuration({ visualDuration: 0.6, bounce: motionTokens.spring.morph.bounce });

/** Markers and the tooltip chase the pointer with a stiff, almost settled spring. */
const POINTER_FOLLOW = { stiffness: 460, damping: 40, restDelta: 0.01 } as const;

/** Fixed locale so the server and the client format the same digits. */
const NUMBER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** The store never changes: it is only here to tell the first client render apart from the server one. */
const subscribe = () => () => {};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface TipRow {
  item: RadarSeries;
  slot: number;
  value: number;
}

/**
 * The chart itself. Pass `series` in the order they should be drawn; the legend and the tooltip
 * follow that order, the tooltip rows sort by the value on the active axis.
 */
export function RadarChart({
  axes,
  series,
  label,
  max = 100,
  rings = 4,
  size = 320,
  formatValue,
  activeAxis,
  onActiveAxisChange,
  legend = true,
  emptyLabel = "No data",
  ref,
  className,
}: RadarChartProps) {
  // `useReducedMotion` reads a media query, which the server cannot answer. Gate it on hydration so
  // the first client render matches the markup and only then skips the motion.
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const reduced = Boolean(useReducedMotion()) && hydrated;

  const figureRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const shapeRefs = useRef<Array<SVGPathElement | null>>([]);
  useImperativeHandle<HTMLElement | null, HTMLElement | null>(ref, () => figureRef.current);

  const inView = useInView(figureRef, { once: true, amount: 0.35 });

  const axisCount = axes.length;
  const slots = series.slice(0, 3);
  const empty = axisCount < 3 || slots.length === 0;

  // The stage is measured, not assumed: the web is the largest square that fits the column.
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const measure = () => setWidth(node.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Labels need room beside the web on wide stages and a tighter gutter on narrow ones.
  const gutter = width < 360 ? 46 : 64;
  const radius = Math.max(40, Math.min(size, width - 2 * gutter) / 2);
  const box = 2 * radius + 2 * gutter;
  const centerX = box / 2;
  const centerY = box / 2;

  const angleOf = (index: number) => (index / Math.max(1, axisCount)) * Math.PI * 2;
  const pointAt = useCallback(
    (index: number, scale: number) => ({
      x: centerX + Math.sin(angleOf(index)) * radius * scale,
      y: centerY - Math.cos(angleOf(index)) * radius * scale,
    }),
    [centerX, centerY, radius, axisCount],
  );

  // Target values per slot, each normalized against its axis so a custom `max` still lands on the rim.
  const targets = Array.from({ length: 3 }, (_, slot) =>
    slots[slot]
      ? axes.map((axis) => clamp((slots[slot]?.values[axis.key] ?? 0) / (axis.max ?? max), 0, 1))
      : axes.map(() => 0),
  );
  const signature = `${axes.map((axis) => `${axis.key}:${axis.max ?? max}`).join(",")}|${targets.map((values) => values.join(",")).join(";")}`;

  // What is currently drawn, and how far the web has grown. Both are read by `draw`, which writes
  // the polygon `d` straight onto the paths: no React render per animation frame.
  const drawn = useRef<number[][]>(Array.from({ length: 3 }, () => axes.map(() => 0)));
  const reveal = useMotionValue(0);

  const draw = useCallback(() => {
    const progress = reveal.get();
    drawn.current.forEach((values, slot) => {
      const path = shapeRefs.current[slot];
      if (!path) return;
      if (!axisCount || values.every((value) => value === 0)) {
        path.setAttribute("d", "");
        return;
      }
      path.setAttribute(
        "d",
        values
          .map((value, index) => {
            const point = pointAt(index, value * progress);
            return `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
          })
          .join("") + "Z",
      );
    });
  }, [reveal, axisCount, pointAt]);

  const drawRef = useRef(draw);
  useLayoutEffect(() => {
    drawRef.current = draw;
    draw();
  }, [draw, width]);

  // Swap a profile: interpolate from what is on screen to the new targets, redrawing each frame.
  useEffect(() => {
    const from = drawn.current.map((values, slot) => (values.length === axisCount ? values.slice() : targets[slot].map(() => 0)));
    if (reduced) {
      drawn.current = targets;
      drawRef.current();
      return;
    }
    const controls = animate(0, 1, {
      ...SHAPE_MORPH,
      onUpdate: (progress) => {
        drawn.current = from.map((values, slot) => values.map((value, index) => value + (targets[slot][index] - value) * progress));
        drawRef.current();
      },
    });
    return () => controls.stop();
  }, [signature, reduced]);

  // The web itself grows from the centre once the chart is a third of the way into the viewport.
  useEffect(() => {
    if (empty) return;
    if (reduced) {
      reveal.jump(1);
      drawRef.current();
      return;
    }
    if (!inView || reveal.get() >= 1) return;
    const controls = animate(reveal, 1, {
      ...springFromVisualDuration({ visualDuration: 0.9, bounce: 0 }),
      onUpdate: () => drawRef.current(),
    });
    return () => controls.stop();
  }, [empty, reveal, inView, reduced]);

  // Which spoke is being read, uncontrolled by default. `activeAxis` makes it controlled.
  const [hovered, setHovered] = useState<string | null>(null);
  const currentKey = activeAxis !== undefined ? activeAxis : hovered;
  const foundIndex = currentKey ? axes.findIndex((axis) => axis.key === currentKey) : -1;
  const active = foundIndex >= 0 ? foundIndex : null;

  // The tooltip keeps its last content while it fades out, so an empty box never flashes.
  const [lastActive, setLastActive] = useState<number | null>(active);
  if (active !== null && active !== lastActive) setLastActive(active);

  const setActiveAt = (index: number | null) => {
    const key = index === null ? null : (axes[index]?.key ?? null);
    if (activeAxis === undefined) setHovered(key);
    if (key !== currentKey) onActiveAxisChange?.(key);
  };

  // Legend press: the pressed profile comes forward and the others step back.
  const [pressed, setPressed] = useState<number | null>(null);

  // Marker and tooltip positions are motion values, so the pointer never re-renders the chart.
  const markerX = [useMotionValue(0), useMotionValue(0), useMotionValue(0)];
  const markerY = [useMotionValue(0), useMotionValue(0), useMotionValue(0)];
  const markerSpringX = [
    useSpring(markerX[0], POINTER_FOLLOW),
    useSpring(markerX[1], POINTER_FOLLOW),
    useSpring(markerX[2], POINTER_FOLLOW),
  ];
  const markerSpringY = [
    useSpring(markerY[0], POINTER_FOLLOW),
    useSpring(markerY[1], POINTER_FOLLOW),
    useSpring(markerY[2], POINTER_FOLLOW),
  ];
  const tipX = useMotionValue(0);
  const tipY = useMotionValue(0);
  const tipSpringX = useSpring(tipX, POINTER_FOLLOW);
  const tipSpringY = useSpring(tipY, POINTER_FOLLOW);
  const placed = useRef(false);

  // Follow the active spoke: put each marker on its shape's vertex, then park the tooltip beside the
  // spoke — above or below the hub when the spoke is close to vertical, otherwise to its side.
  useLayoutEffect(() => {
    if (active === null) {
      placed.current = false;
      return;
    }
    const fresh = !placed.current || reduced;
    targets.forEach((values, slot) => {
      const point = pointAt(active, values[active] ?? 0);
      markerX[slot].set(point.x);
      markerY[slot].set(point.y);
      if (fresh) {
        markerSpringX[slot].jump(point.x);
        markerSpringY[slot].jump(point.y);
      }
    });

    const tip = tooltipRef.current;
    const stage = stageRef.current;
    if (tip && stage) {
      const tipWidth = tip.offsetWidth;
      const tipHeight = tip.offsetHeight;
      const stageWidth = stage.clientWidth;
      const stageHeight = stage.clientHeight;
      const offset = (stageWidth - box) / 2;
      const rim = pointAt(active, 1);
      const sin = Math.sin(angleOf(active));
      const cos = -Math.cos(angleOf(active));
      let x: number;
      let y: number;
      if (Math.abs(sin) < 0.35) {
        x = offset + rim.x + 60;
        y = rim.y + 12 * cos - tipHeight / 2;
      } else {
        x = sin > 0 ? offset + rim.x + 2 : offset + rim.x - tipWidth - 2;
        y = cos < 0 ? rim.y - tipHeight - 20 : rim.y + 22;
      }
      x = clamp(x, 0, Math.max(0, stageWidth - tipWidth));
      y = clamp(y, 0, Math.max(0, stageHeight - tipHeight));
      tipX.set(x);
      tipY.set(y);
      if (fresh) {
        tipSpringX.jump(x);
        tipSpringY.jump(y);
      }
    }
    placed.current = true;
  });

  // Hit testing: inside a small disc around the hub the current spoke stays, outside it the angle
  // picks the spoke. The disc keeps the reading steady while the pointer crosses the middle.
  const pick = (clientX: number, clientY: number): number | null => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || empty) return null;
    const dx = clientX - rect.left - (rect.width - box) / 2 - centerX;
    const dy = clientY - rect.top - centerY;
    if (Math.hypot(dx, dy) < 0.12 * radius) return active;
    return Math.round(((Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI)) / ((2 * Math.PI) / axisCount)) % axisCount;
  };

  const format = (value: number, axis: RadarAxis) => (formatValue ? formatValue(value, axis) : NUMBER.format(value));

  const activeAxisData = active !== null ? axes[active] : null;
  const shownAxis = activeAxisData ?? (lastActive !== null ? (axes[lastActive] ?? null) : null);
  const rows: TipRow[] = shownAxis
    ? slots
        .map((item, slot) => ({ item, slot, value: item.values[shownAxis.key] ?? 0 }))
        .sort((a, b) => b.value - a.value)
    : [];
  const leader = rows[0]?.value ?? 0;
  const liveText = activeAxisData
    ? `${activeAxisData.label}. ${rows.map((row) => `${row.item.label} ${format(row.value, activeAxisData)}`).join(", ")}`
    : "";
  const summary = empty
    ? `${label}. ${emptyLabel}.`
    : `${label}. ${slots
        .map((item) => `${item.label}: ${axes.map((axis) => `${axis.label} ${format(item.values[axis.key] ?? 0, axis)}`).join(", ")}`)
        .join(". ")}.`;
  const offset = width ? (width - box) / 2 : 0;

  return (
    <figure ref={figureRef} className={[styles.figure, className].filter(Boolean).join(" ")} aria-label={label}>
      <div
        ref={stageRef}
        className={styles.stage}
        style={{ height: width ? box : undefined }}
        data-active={active !== null || undefined}
        data-focus={pressed !== null || undefined}
        role="group"
        tabIndex={empty ? -1 : 0}
        aria-roledescription="radar chart"
        aria-label={`${label}. Use arrow keys to move between measures.`}
        onPointerMove={(event: ReactPointerEvent<HTMLDivElement>) => {
          if (event.pointerType === "mouse" || event.buttons) setActiveAt(pick(event.clientX, event.clientY));
        }}
        onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
          if (event.pointerType !== "mouse") event.currentTarget.setPointerCapture(event.pointerId);
          setActiveAt(pick(event.clientX, event.clientY));
        }}
        onPointerUp={(event: ReactPointerEvent<HTMLDivElement>) => {
          if (event.pointerType !== "mouse") setActiveAt(null);
        }}
        onPointerCancel={() => setActiveAt(null)}
        onPointerLeave={(event: ReactPointerEvent<HTMLDivElement>) => {
          if (event.pointerType === "mouse") setActiveAt(null);
        }}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (empty) return;
          if (event.key === "Escape" && active !== null) {
            event.preventDefault();
            setActiveAt(null);
            return;
          }
          const from = active ?? -1;
          const moves: Record<string, number> = {
            ArrowRight: from + 1,
            ArrowDown: from + 1,
            ArrowLeft: from < 0 ? axisCount - 1 : from - 1,
            ArrowUp: from < 0 ? axisCount - 1 : from - 1,
            Home: 0,
            End: axisCount - 1,
          };
          if (event.key in moves) {
            event.preventDefault();
            setActiveAt((moves[event.key] + axisCount) % axisCount);
          }
        }}
        onBlur={() => setActiveAt(null)}
        onFocus={(event) => {
          // Only a keyboard focus opens the reading; a pointer press must not leave a stray tooltip.
          if (event.currentTarget.matches(":focus-visible") && !empty && active === null) setActiveAt(0);
        }}
      >
        {width > 0 && (
          <>
            <svg className={styles.svg} width={box} height={box} style={{ left: offset }} aria-hidden="true" focusable="false">
              <g className={styles.web} data-shown={inView || reduced || undefined}>
                {Array.from({ length: rings }, (_, ring) => {
                  const scale = (ring + 1) / rings;
                  return (
                    <path
                      key={ring}
                      className={styles.ring}
                      d={
                        axes
                          .map((_, index) => {
                            const point = pointAt(index, scale);
                            return `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
                          })
                          .join("") + "Z"
                      }
                    />
                  );
                })}
                {axes.map((axis, index) => {
                  const rim = pointAt(index, 1);
                  return (
                    <line
                      key={axis.key}
                      className={styles.spoke}
                      data-on={active === index || undefined}
                      x1={centerX}
                      y1={centerY}
                      x2={rim.x}
                      y2={rim.y}
                    />
                  );
                })}
              </g>
              {Array.from({ length: 3 }, (_, slot) => (
                <path
                  key={slot}
                  ref={(node) => {
                    shapeRefs.current[slot] = node;
                  }}
                  className={styles.shape}
                  data-slot={slot}
                  data-dim={(pressed !== null && pressed !== slot) || undefined}
                  data-on={pressed === slot || undefined}
                />
              ))}
              {Array.from({ length: 3 }, (_, slot) =>
                slots[slot] ? (
                  <motion.circle
                    key={slot}
                    className={styles.marker}
                    data-slot={slot}
                    r={4.5}
                    cx={0}
                    cy={0}
                    style={{ x: reduced ? markerX[slot] : markerSpringX[slot], y: reduced ? markerY[slot] : markerSpringY[slot] }}
                  />
                ) : null,
              )}
            </svg>
            {axes.map((axis, index) => {
              const rim = pointAt(index, 1);
              const sin = Math.sin(angleOf(index));
              const cos = -Math.cos(angleOf(index));
              const anchor = Math.abs(sin) < 0.2 ? "center" : sin > 0 ? "start" : "end";
              return (
                <span
                  key={axis.key}
                  className={styles.axisLabel}
                  data-anchor={anchor}
                  data-on={active === index || undefined}
                  style={{
                    left: offset + rim.x + 10 * sin,
                    top: rim.y + 12 * cos,
                    translate: `${anchor === "center" ? "-50%" : anchor === "end" ? "-100%" : "0"} ${Math.abs(cos) > 0.8 ? (cos < 0 ? "-100%" : "0") : "-50%"}`,
                    maxWidth: anchor === "center" ? 120 : gutter + 8,
                  }}
                  aria-hidden="true"
                >
                  {axis.label}
                </span>
              );
            })}
          </>
        )}
        <motion.div
          ref={tooltipRef}
          className={styles.tooltip}
          style={{ x: reduced ? tipX : tipSpringX, y: reduced ? tipY : tipSpringY }}
          aria-hidden="true"
        >
          <p className={styles.tipTitle}>{shownAxis?.label ?? ""}</p>
          {rows.map((row) => (
            <p key={row.item.key} className={styles.tipRow} data-slot={row.slot}>
              <span className={styles.tipKey} />
              <span className={styles.tipName}>{row.item.label}</span>
              <span className={styles.tipValue}>{shownAxis ? format(row.value, shownAxis) : ""}</span>
              <span className={styles.tipGap}>{shownAxis && row.value < leader ? `−${format(leader - row.value, shownAxis)}` : ""}</span>
            </p>
          ))}
        </motion.div>
        {empty && <p className={styles.message}>{emptyLabel}</p>}
      </div>

      {legend && !empty && (
        <div className={styles.legend} role="group" aria-label={`${label} profiles`} onPointerLeave={() => setPressed(null)}>
          {slots.map((item, slot) => (
            <motion.button
              key={slot}
              type="button"
              layout={!reduced}
              transition={motionTokens.spring.morph}
              className={styles.key}
              data-slot={slot}
              data-dim={(pressed !== null && pressed !== slot) || undefined}
              aria-pressed={pressed === slot}
              onClick={() => setPressed(pressed === slot ? null : slot)}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") setPressed(slot);
              }}
            >
              <motion.span
                layout={!reduced && "position"}
                transition={motionTokens.spring.morph}
                className={styles.keyLine}
                aria-hidden="true"
              />
              <motion.span layout={!reduced && "position"} transition={motionTokens.spring.morph} className={styles.keyLabel}>
                {item.label}
              </motion.span>
            </motion.button>
          ))}
        </div>
      )}

      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {liveText}
      </p>
      <p className={styles.srOnly}>{summary}</p>
      {!empty && (
        <div className={styles.srOnly}>
          <table>
            <caption>{label}</caption>
            <thead>
              <tr>
                <th scope="col">Measure</th>
                {slots.map((item) => (
                  <th key={item.key} scope="col">
                    {item.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {axes.map((axis) => (
                <tr key={axis.key}>
                  <th scope="row">{axis.label}</th>
                  {slots.map((item) => (
                    <td key={item.key}>{format(item.values[axis.key] ?? 0, axis)}</td>
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

export default RadarChart;
