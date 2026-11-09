"use client";

/**
 * Funnel chart — the Pro conversion funnel from the shipped preview, rebuilt from the published
 * bundle and its CSS module.
 *
 * Behaviour kept from the original:
 *   - one smooth tapered band: flat across each step, eased between them, sampled every 3px from
 *     the step totals so a step change bends the band instead of jumping it;
 *   - view switches morph the band and the split gap on the same spring, straight from a paint
 *     function, so no frame of the morph costs a render;
 *   - a segment key isolates that segment and rescales the band to fill the height; "split" stacks
 *     every segment and opens a gap between them;
 *   - the band grows out of its centre line the first time it is seen;
 *   - dots stream through the band on a canvas and each one picks its exit step up front, so the
 *     share that falls out at every boundary matches the real drop-off; they pause off screen and
 *     in hidden tabs and never run with reduced motion;
 *   - hovering, pressing or arrowing a step lights an accent clip, glides a soft column over it,
 *     recedes the other headings and parks a tooltip beside the band inside the chart;
 *   - Escape clears the reading, Home and End jump to the ends, blur releases it;
 *   - the heading counts and the drop-off rates roll to their new values;
 *   - a polite live region reads the step, its count and both rates, and a visually hidden summary
 *     and table carry the whole funnel for screen readers.
 */
import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionStyle,
} from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./funnel-chart.module.css";

export interface FunnelStage {
  /** Stable id for the step. */
  key: string;
  /** Name shown above the band, in the tooltip, and in the table. */
  label: string;
  /** Count when the chart has no segments. */
  value?: number;
  /** Count per segment key, when the chart has segments. */
  values?: Record<string, number>;
}

export interface FunnelSegment {
  /** Stable id used by `stage.values` and by `view`. */
  key: string;
  /** Name used in the tooltip legend and the table header. */
  label: string;
}

export interface FunnelChartProps {
  /** Ordered steps: `{ key, label, value?, values? }`. Use `value` without segments, `values` keyed by segment with them. */
  stages: readonly FunnelStage[];
  /** Parts of every step, such as devices: `{ key, label }`. Leave it out for one total per step. */
  segments?: readonly FunnelSegment[];
  /** What is counted. Names the chart, the summary, and the table. */
  label: string;
  /** Noun after counts in the tooltip and table, such as "sessions". */
  unit?: string;
  /** `"total"` draws one band, `"split"` stacks every segment with a gap, and a segment key isolates it and rescales the band to fill the height. */
  view?: string;
  /** Dots that stream through the band. Each decides up front where it leaves, so the falling share matches the real drop-off. */
  flow?: boolean;
  /** Auto turns the funnel vertical below 420px of container width, with steps listed down the side. */
  orientation?: "auto" | "horizontal" | "vertical";
  /** Band area thickness in pixels when horizontal. */
  height?: number;
  /** Formats counts. Defaults to compact numbers in headings and full numbers in the tooltip. */
  formatValue?: (value: number) => string;
  /** Controlled step in focus. */
  activeIndex?: number | null;
  /** Called as the step in focus changes. */
  onActiveChange?: (index: number | null) => void;
  /** Message when the first step is zero. */
  emptyLabel?: string;
  /** Extra class on the figure. */
  className?: string;
  /** Forwarded to the figure. */
  ref?: Ref<HTMLElement>;
}

interface FlowDrop {
  at: number;
  lane: number;
  stage: number;
  speed: number;
  fall: number;
  fallSpeed: number;
  age: number;
}

const noopSubscribe = () => () => {};
const useHydrated = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Motion's spring from a visual duration and bounce, so the morphs settle at the shipped pace. */
const springFor = (visualDuration: number, bounce: number, restDelta = 5e-4) => {
  const omega = (2 * Math.PI) / (1.2 * visualDuration);
  return {
    type: "spring" as const,
    stiffness: omega * omega,
    damping: 2 * (1 - bounce) * omega,
    restDelta,
    restSpeed: 2 * restDelta,
  };
};

const shapeSpring = springFor(0.55, 0.08);
const entranceSpring = springFor(0.8, 0);
const followSpring = { stiffness: 480, damping: 42, restDelta: 0.01 };

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("en-US");

const percent = (value: number) => (value >= 10 || value === 0 ? `${Math.round(value)}%` : `${value.toFixed(1)}%`);

/**
 * The shipped easing: the band holds flat for the middle 48% of every step and eases into the next
 * one with a smoothstep-ish cubic, so step changes read as shoulders rather than ramps.
 */
const sampleAt = (values: readonly number[], x: number, length: number) => {
  const count = values.length;
  if (!count) return 0;
  const pos = x / (length / count) - 0.5;
  if (pos <= 0) return values[0];
  if (pos >= count - 1) return values[count - 1];
  const index = Math.floor(pos);
  const fraction = pos - index;
  const t =
    fraction <= 0.26
      ? 0
      : fraction >= 0.74
        ? 1
        : (() => {
            const r = (fraction - 0.26) / 0.48;
            return r * r * r * (r * (6 * r - 15) + 10);
          })();
  return values[index] + (values[index + 1] - values[index]) * t;
};

/** A number that rolls to its next value instead of swapping text. */
function RollingValue({
  value,
  format,
  reduced,
}: {
  value: number;
  format: (value: number) => string;
  reduced: boolean;
}) {
  const raw = useMotionValue(value);
  const formatter = useRef(format);
  formatter.current = format;
  const text = useTransform(raw, (latest) => formatter.current(latest));

  useEffect(() => {
    if (reduced) {
      raw.jump(value);
      return;
    }
    const controls = animate(raw, value, motionTokens.spring.smooth);
    return () => controls.stop();
  }, [reduced, raw, value]);

  return <motion.span>{text}</motion.span>;
}

export function FunnelChart({
  stages,
  segments,
  label,
  unit = "",
  view = "total",
  flow = true,
  orientation = "auto",
  height = 200,
  formatValue,
  activeIndex,
  onActiveChange,
  emptyLabel = "No data",
  className,
  ref,
}: FunnelChartProps) {
  const hydrated = useHydrated();
  const reduced = !!useReducedMotion() && hydrated;

  const figureRef = useRef<HTMLElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef(new Map<string, SVGPathElement>());
  const glowRef = useRef(new Map<string, SVGPathElement>());

  // The handle is the figure itself, the way the original forwards its own ref.
  useImperativeHandle<HTMLElement, HTMLElement>(ref, () => figureRef.current as HTMLElement, []);

  const clipId = `${useId().replace(/:/g, "")}-focus`;

  const entered = useInView(figureRef, { once: true, amount: 0.3 });
  const onScreen = useInView(figureRef, { amount: 0 });

  const parts = useMemo<readonly FunnelSegment[]>(
    () => (segments && segments.length ? segments : [{ key: "value", label }]),
    [segments, label],
  );
  const count = stages.length;
  const lastIndex = count - 1;

  const valueOf = useCallback(
    (stage: FunnelStage, key: string) => Math.max(0, (segments && segments.length ? stage.values?.[key] : stage.value) ?? 0),
    [segments],
  );

  const single = parts.some((part) => part.key === view) ? view : null;
  const isSplit = view === "split" && parts.length > 1;
  const shown = single ? parts.filter((part) => part.key === single) : parts;
  const totals = stages.map((stage) => shown.reduce((sum, part) => sum + valueOf(stage, part.key), 0));
  const empty = count === 0 || (totals[0] ?? 0) <= 0;
  const viewMode = single ? "one" : isSplit ? "split" : "total";

  // Shares of the tallest row, one array of step values per part, so the band is a pure function of
  // this map. The signature stands in for the data, the way a stringified row set usually does.
  const signature = `${view}|${parts.map((part) => part.key).join(",")}|${stages
    .map((stage) => parts.map((part) => valueOf(stage, part.key)).join(","))
    .join(";")}`;
  const shares = useMemo(() => {
    const max = Math.max(1e-9, ...stages.map((stage) => shown.reduce((sum, part) => sum + valueOf(stage, part.key), 0)));
    return new Map(
      parts.map((part) => [
        part.key,
        stages.map((stage) => (shown.includes(part) ? valueOf(stage, part.key) / max : 0)),
      ]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signature stands in for the data
  }, [signature]);

  // The plot measures itself; the whole layout is a function of that width.
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = areaRef.current;
    if (!node) return;
    setWidth(node.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const vertical = orientation === "vertical" || (orientation === "auto" && width > 0 && width < 420);
  const length = vertical ? 84 * count : width;
  const cross = vertical ? Math.min(220, Math.max(120, 0.44 * width)) : height;
  const step = count ? length / count : 0;

  // The band is painted straight into the DOM from these, so a frame of a morph costs no render.
  const axis = useRef({ length: 0, cross: 0, vertical: false });
  const shapes = useRef(new Map<string, number[]>());
  const splitMix = useRef(isSplit ? 1 : 0);
  const progress = useMotionValue(0);

  const draw = useCallback(() => {
    const { length: span, cross: band, vertical: upright } = axis.current;
    if (!span) return;
    const usable = band - 16;
    const center = band / 2;
    const grown = progress.get();
    const rows = parts.map((part) => shapes.current.get(part.key) ?? Array<number>(count).fill(0));
    const gaps = rows.map((row) => Math.min(1, 40 * row.reduce((sum, value) => sum + value, 0)));
    const steps = Math.ceil(span / 3) + 1;
    const edges = parts.map(() => ({ top: Array<number>(steps).fill(0), bottom: Array<number>(steps).fill(0) }));

    // One sample per 3px: each row's thickness, the split gaps, and then the stack around the midline.
    for (let index = 0; index < steps; index += 1) {
      const x = Math.min(span, 3 * index);
      const thickness = rows.map((row) => sampleAt(row, x, span) * usable * grown);
      const spaces = thickness.slice(1).map((_, i) => 2 * splitMix.current * Math.min(gaps[i], gaps[i + 1]));
      let y = center - (thickness.reduce((a, b) => a + b, 0) + spaces.reduce((a, b) => a + b, 0)) / 2;
      thickness.forEach((thick, i) => {
        edges[i].top[index] = y;
        y += thick;
        edges[i].bottom[index] = y;
        y += spaces[i] ?? 0;
      });
    }

    const point = (x: number, y: number) =>
      upright ? `${y.toFixed(1)},${x.toFixed(1)}` : `${x.toFixed(1)},${y.toFixed(1)}`;

    parts.forEach((part, i) => {
      let d = "";
      for (let index = 0; index < steps; index += 1) {
        d += `${index ? "L" : "M"}${point(Math.min(span, 3 * index), edges[i].top[index])}`;
      }
      for (let index = steps - 1; index >= 0; index -= 1) {
        d += `L${point(Math.min(span, 3 * index), edges[i].bottom[index])}`;
      }
      d += "Z";
      layerRef.current.get(part.key)?.setAttribute("d", d);
      glowRef.current.get(part.key)?.setAttribute("d", d);
    });
  }, [count, parts, progress]);

  useLayoutEffect(() => {
    axis.current = { length, cross, vertical };
    draw();
  }, [draw, cross, length, vertical]);

  // A view change morphs the band from the shape on screen; the split gap rides the same spring.
  useEffect(() => {
    const changes: { key: string; from: number[]; to: number[] }[] = [];
    for (const [key, next] of shares) {
      const previous = shapes.current.get(key);
      if (!previous || previous.length !== next.length || reduced) {
        shapes.current.set(key, next);
        continue;
      }
      changes.push({ key, from: previous, to: next });
    }
    const fromSplit = splitMix.current;
    const toSplit = isSplit ? 1 : 0;
    if (reduced) splitMix.current = toSplit;
    if (!changes.length && (reduced || fromSplit === toSplit)) {
      draw();
      return;
    }
    const controls = animate(0, 1, {
      ...shapeSpring,
      onUpdate: (t) => {
        for (const change of changes) {
          shapes.current.set(
            change.key,
            change.from.map((value, i) => value + (change.to[i] - value) * t),
          );
        }
        splitMix.current = fromSplit + (toSplit - fromSplit) * clamp(t, 0, 1);
        draw();
      },
    });
    return () => controls.stop();
  }, [draw, reduced, isSplit, shares]);

  // The band grows out of its centre line the first time it is seen.
  useEffect(() => {
    if (empty) return;
    if (reduced) {
      progress.jump(1);
      draw();
      return;
    }
    if (!entered || progress.get() >= 1) return;
    const controls = animate(progress, 1, { ...entranceSpring, onUpdate: draw });
    return () => controls.stop();
  }, [empty, progress, entered, draw, reduced]);

  const [hovered, setHovered] = useState<number | null>(null);
  const active = activeIndex !== undefined ? activeIndex : hovered;
  const activeStep = active !== null && active >= 0 && active < count ? active : null;
  const activeStage = activeStep === null ? null : stages[activeStep];

  const setActive = (next: number | null) => {
    if (activeIndex === undefined) setHovered(next);
    if (next !== activeStep) onActiveChange?.(next);
  };

  // A soft column glides to the step in focus, on its own spring.
  const columnX = useMotionValue(0);
  const columnSpring = useSpring(columnX, followSpring);
  const lastColumn = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (activeStep === null) {
      lastColumn.current = null;
      return;
    }
    columnX.set(activeStep * step);
    if (lastColumn.current === null || reduced) columnSpring.jump(activeStep * step);
    lastColumn.current = activeStep;
  });

  const tipX = useMotionValue(0);
  const tipY = useMotionValue(0);
  const tipSpringX = useSpring(tipX, followSpring);
  const tipSpringY = useSpring(tipY, followSpring);
  const tipPlaced = useRef(false);
  useLayoutEffect(() => {
    const tip = tooltipRef.current;
    const area = areaRef.current;
    if (activeStep === null || !tip || !area || !step) {
      tipPlaced.current = false;
      return;
    }
    const areaWidth = area.clientWidth;
    const areaHeight = area.clientHeight;
    const tipWidth = tip.offsetWidth;
    const tipHeight = tip.offsetHeight;
    const x = (activeStep + 0.5) * step;
    const thickness = sampleAt(
      totals.map((total) => total / Math.max(1e-9, ...totals)),
      x,
      length,
    ) * (cross - 16);
    let left: number;
    let top: number;
    if (vertical) {
      left = cross / 2 + thickness / 2 + 12;
      if (left + tipWidth > areaWidth) left = areaWidth - tipWidth;
      top = activeStep < lastIndex ? (activeStep + 1) * step - 6 : activeStep * step - tipHeight + 6;
    } else {
      left = x + step / 2 - 6;
      if (left + tipWidth > areaWidth) left = x - step / 2 - tipWidth + 6;
      top = (headerRef.current?.offsetHeight ?? 0) + cross / 2 - tipHeight / 2;
    }
    tipX.set(clamp(left, 0, Math.max(0, areaWidth - tipWidth)));
    tipY.set(clamp(top, 0, Math.max(0, areaHeight - tipHeight)));
    if (!tipPlaced.current || reduced) {
      tipSpringX.jump(tipX.get());
      tipSpringY.jump(tipY.get());
    }
    tipPlaced.current = true;
  });

  // The flow reads live from refs: the loop never restarts because the data changed.
  const live = useRef({ totals, parts, shapes });
  useLayoutEffect(() => {
    live.current = { totals, parts, shapes };
  });

  const flowOn = flow && !reduced && !empty && onScreen && entered;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!flowOn || !canvas) {
      const idle = canvas?.getContext("2d");
      if (idle && canvas) idle.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) return;

    let frame = 0;
    let previous = performance.now();
    let spawn = 0;
    let ink = "";
    let ticks = 0;
    const drops: FlowDrop[] = [];

    const paint = (now: number) => {
      frame = requestAnimationFrame(paint);
      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;

      const { length: span, cross: band, vertical: upright } = axis.current;
      if (!span || document.hidden) return;
      const dpr = window.devicePixelRatio || 1;
      const pixelWidth = Math.round((upright ? band : span) * dpr);
      const pixelHeight = Math.round((upright ? span : band) * dpr);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      if (++ticks % 30 === 0) ink = getComputedStyle(canvas).color;

      const usable = band - 16;
      const center = band / 2;
      const current = live.current;
      const thicknessAt = (x: number) =>
        current.parts.reduce((sum, part) => sum + sampleAt(current.shapes.current.get(part.key) ?? [], x, span), 0) *
        usable *
        progress.get();

      spawn += 26 * dt * clamp(thicknessAt(0) / Math.max(1, usable), 0.15, 1);
      while (spawn >= 1) {
        spawn -= 1;
        let index = 0;
        while (
          index < current.totals.length - 1 &&
          Math.random() < (current.totals[index + 1] ?? 0) / Math.max(1e-9, current.totals[index] ?? 0)
        ) {
          index += 1;
        }
        drops.push({
          at: -4,
          lane: 0.1 + 0.8 * Math.random(),
          stage: index,
          speed: span / (5.2 + 1.6 * Math.random()),
          fall: 0,
          fallSpeed: 0,
          age: 0,
        });
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, pixelWidth, pixelHeight);
      context.fillStyle = ink;
      const stride = span / Math.max(1, current.totals.length);

      for (let i = drops.length - 1; i >= 0; i -= 1) {
        const drop = drops[i];
        drop.age += dt;
        const edge = drop.stage < current.totals.length - 1 ? (drop.stage + 1) * stride : Number.POSITIVE_INFINITY;
        if (drop.at >= edge) {
          drop.fallSpeed += 260 * dt;
          drop.fall += drop.fallSpeed * dt;
          drop.speed *= 1 - 1.8 * dt;
        }
        drop.at += drop.speed * dt;
        const thick = thicknessAt(clamp(drop.at, 0, span));
        const y = center + (drop.lane - 0.5) * thick + drop.fall;
        const alpha =
          drop.fall > 0
            ? 1 - clamp(drop.fall / 46, 0, 1)
            : drop.at > span - 16
              ? clamp((span - drop.at) / 16, 0, 1)
              : clamp(4 * drop.age, 0, 1);
        if (alpha <= 0 || drop.at > span + 4) {
          drops.splice(i, 1);
          continue;
        }
        context.globalAlpha = alpha * (drop.fall > 0 ? 0.45 : 0.7);
        context.beginPath();
        context.arc(upright ? y : drop.at, upright ? drop.at : y, 1.6, 0, 2 * Math.PI);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [flowOn, progress]);

  const indexAt = (clientX: number, clientY: number) => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect || empty || !step) return null;
    const offset = vertical ? clientY - rect.top : clientX - rect.left;
    return clamp(Math.floor(offset / step), 0, lastIndex);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || event.buttons) setActive(indexAt(event.clientX, event.clientY));
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") event.currentTarget.setPointerCapture?.(event.pointerId);
    setActive(indexAt(event.clientX, event.clientY));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") setActive(null);
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") setActive(null);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (empty) return;
    if (event.key === "Escape" && activeStep !== null) {
      event.preventDefault();
      setActive(null);
      return;
    }
    const base = activeStep ?? -1;
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? base + 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? base < 0
            ? 0
            : base - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? lastIndex
              : null;
    if (next === null) return;
    event.preventDefault();
    setActive(clamp(next, 0, lastIndex));
  };

  const handleFocus = () => {
    if (areaRef.current?.matches(":focus-visible") && !empty && activeStep === null) setActive(0);
  };

  const valueLabel = (value: number) => (formatValue ? formatValue(value) : compact.format(Math.round(value)));
  const valueFull = (value: number) =>
    `${formatValue ? formatValue(value) : integer.format(Math.round(value))}${unit ? ` ${unit}` : ""}`;
  const kept = (index: number) =>
    index === 0 ? 100 : (totals[index - 1] ?? 0) > 0 ? ((totals[index] ?? 0) / (totals[index - 1] ?? 1)) * 100 : 0;
  const ofStart = (index: number) => ((totals[0] ?? 0) > 0 ? (totals[index] ?? 0) / (totals[0] ?? 1) : 0) * 100;

  const activeSummary =
    activeStep === null
      ? ""
      : `${stages[activeStep]?.label ?? label}, ${valueFull(totals[activeStep] ?? 0)}, ${percent(kept(activeStep))} of the previous step, ${percent(ofStart(activeStep))} of the first`;
  const viewLabel = single
    ? (parts.find((part) => part.key === single)?.label ?? "")
    : isSplit
      ? "by segment"
      : "all";
  const summary = empty
    ? `${label}. ${emptyLabel}.`
    : `${label}, ${viewLabel}. ${stages.map((stage, i) => `${stage.label} ${valueFull(totals[i] ?? 0)}`).join(", ")}. ${percent(ofStart(lastIndex))} reach the last step.`;

  const plotWidth = vertical ? cross : length;
  const plotHeight = vertical ? length : cross;
  const columnStyle: MotionStyle = vertical
    ? { y: reduced ? columnX : columnSpring }
    : { x: reduced ? columnX : columnSpring };
  const columnBox: CSSProperties = vertical ? { height: step } : { width: step };
  const tipStyle: MotionStyle = { x: reduced ? tipX : tipSpringX, y: reduced ? tipY : tipSpringY };

  const tooltipRows: { key: string; label: string; value: ReactNode }[] = isSplit
    ? parts.map((part) => ({
        key: part.key,
        label: part.label,
        value: activeStage ? integer.format(valueOf(activeStage, part.key)) : "",
      }))
    : [
        {
          key: "__total",
          label: single ? (parts.find((part) => part.key === single)?.label ?? "") : "Total",
          value: activeStage ? integer.format(totals[activeStep ?? 0] ?? 0) : "",
        },
      ];

  return (
    <figure ref={figureRef} className={className ? `${styles.figure} ${className}` : styles.figure} aria-label={label} data-vertical={vertical || undefined}>
      <div
        ref={areaRef}
        className={styles.area}
        data-active={activeStep !== null || undefined}
        data-view={viewMode}
        style={vertical ? { height: length } : undefined}
        role="group"
        tabIndex={empty ? -1 : 0}
        aria-roledescription="funnel chart"
        aria-label={`${label}. Use arrow keys to move between steps.`}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setActive(null)}
        onPointerLeave={handlePointerLeave}
        onKeyDown={handleKeyDown}
        onBlur={() => setActive(null)}
        onFocus={handleFocus}
      >
        <motion.div className={styles.column} aria-hidden="true" style={{ ...columnStyle, ...columnBox }} />

        {!vertical && (
          <div
            ref={headerRef}
            className={styles.header}
            style={{ gridTemplateColumns: `repeat(${Math.max(1, count)}, minmax(0, 1fr))` }}
            aria-hidden="true"
          >
            {stages.map((stage, index) => (
              <div key={stage.key} className={styles.stage} data-on={activeStep === index || undefined}>
                <span className={styles.stageLabel}>{stage.label}</span>
                <span className={styles.stageValue}>
                  <RollingValue value={totals[index] ?? 0} format={valueLabel} reduced={reduced} />
                </span>
                <span className={styles.stageRate}>
                  {index === 0 ? (
                    "Start"
                  ) : (
                    <RollingValue
                      value={ofStart(index)}
                      format={(value) => `${percent(value)} of start`}
                      reduced={reduced}
                    />
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.plotRow}>
          <div ref={plotRef} className={styles.plot} style={{ width: plotWidth, height: plotHeight }}>
            <svg className={styles.svg} width={plotWidth} height={plotHeight} aria-hidden="true" focusable="false">
              <defs>
                <clipPath id={clipId}>
                  <motion.rect
                    {...(vertical
                      ? { x: 0, y: 0, width: cross, height: step }
                      : { x: 0, y: 0, width: step, height: cross })}
                    style={columnStyle}
                  />
                </clipPath>
              </defs>
              {parts.map((part, index) => (
                <path
                  key={part.key}
                  ref={(node) => {
                    if (node) layerRef.current.set(part.key, node);
                    else layerRef.current.delete(part.key);
                  }}
                  className={styles.layer}
                  data-index={index}
                  data-shown={!single || single === part.key || undefined}
                />
              ))}
              <g className={styles.glow} clipPath={`url(#${clipId})`}>
                {parts.map((part, index) => (
                  <path
                    key={part.key}
                    ref={(node) => {
                      if (node) glowRef.current.set(part.key, node);
                      else glowRef.current.delete(part.key);
                    }}
                    className={styles.glowLayer}
                    data-index={index}
                  />
                ))}
              </g>
            </svg>
            <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" style={{ width: plotWidth, height: plotHeight }} />
          </div>

          {vertical && (
            <div className={styles.side} aria-hidden="true">
              {stages.map((stage, index) => (
                <div
                  key={stage.key}
                  className={styles.row}
                  data-on={activeStep === index || undefined}
                  style={{ top: 84 * index, height: 84 }}
                >
                  <span className={styles.stageLabel}>{stage.label}</span>
                  <span className={styles.stageValue}>
                    <RollingValue value={totals[index] ?? 0} format={valueLabel} reduced={reduced} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.drops} aria-hidden="true" style={vertical ? { left: cross + 20 } : undefined}>
          {stages.slice(1).map((stage, index) => (
            <span
              key={stage.key}
              className={styles.drop}
              style={
                vertical
                  ? { top: `${((index + 1) / Math.max(1, count)) * 100}%` }
                  : { left: `${((index + 1) / Math.max(1, count)) * 100}%` }
              }
            >
              <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
                <path
                  d="M4 1v6M1.5 4.5 4 7l2.5-2.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <RollingValue value={100 - kept(index + 1)} format={percent} reduced={reduced} />
            </span>
          ))}
        </div>

        <motion.div ref={tooltipRef} className={styles.tooltip} aria-hidden="true" style={tipStyle}>
          <p className={styles.tipTitle}>{activeStage?.label ?? ""}</p>
          {tooltipRows.map((row) => (
            <p key={row.key} className={styles.tipRow} data-index={isSplit ? parts.findIndex((part) => part.key === row.key) : undefined}>
              {isSplit && <span className={styles.tipKey} />}
              <span className={styles.tipName}>{row.label}</span>
              <span className={styles.tipValue}>{row.value}</span>
            </p>
          ))}
          <p className={styles.tipMeta}>
            {activeStep === null
              ? ""
              : activeStep > 0
                ? `${percent(kept(activeStep))} kept from ${(stages[activeStep - 1]?.label ?? "").toLowerCase()}`
                : `Entry step${unit ? `, ${unit}` : ""}`}
          </p>
        </motion.div>
      </div>

      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {activeSummary}
      </p>
      <p className={styles.srOnly}>{summary}</p>
      {!empty && (
        <div className={styles.srOnly}>
          <table>
            <caption>{label}</caption>
            <thead>
              <tr>
                <th scope="col">Step</th>
                {segments &&
                  parts.map((part) => (
                    <th key={part.key} scope="col">
                      {part.label}
                    </th>
                  ))}
                <th scope="col">Shown total</th>
                <th scope="col">Kept from previous</th>
                <th scope="col">Of first step</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((stage, index) => (
                <tr key={stage.key}>
                  <th scope="row">{stage.label}</th>
                  {segments &&
                    parts.map((part) => <td key={part.key}>{valueFull(valueOf(stage, part.key))}</td>)}
                  <td>{valueFull(totals[index] ?? 0)}</td>
                  <td>{percent(kept(index))}</td>
                  <td>{percent(ofStart(index))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}

export default FunnelChart;
