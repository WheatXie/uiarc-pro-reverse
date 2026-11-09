"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import styles from "./glass-segmented.module.css";

export interface GlassSegmentedOption {
  /** Stable value handed to `onValueChange`. */
  value: string;
  /** Segment text. */
  label: string;
  /** A 16px icon shown before the label. */
  icon?: ReactNode;
  /** A small count shown in the accent color after the label. */
  badge?: ReactNode;
  /** Skips the segment in the keyboard rotation and ignores clicks. */
  disabled?: boolean;
}

export interface GlassSegmentedProps {
  /** Segments: `{ value, label, icon?, badge?, disabled? }`. `badge` shows a small count in the accent color. */
  options: GlassSegmentedOption[];
  /** Accessible name of the group. */
  label: string;
  /** Controlled value. */
  value?: string;
  /** Initial value when uncontrolled. Defaults to the first enabled option. */
  defaultValue?: string;
  /** Called when a segment is chosen by click, keys, or a drag. */
  onValueChange?: (value: string) => void;
  /** 36px or 44px tall. */
  size?: "sm" | "md";
  /** Stretches to the container width with equal segments. */
  fullWidth?: boolean;
  /** Extra class on the root. */
  className?: string;
  /** Inline styles on the root. */
  style?: CSSProperties;
}

interface SegmentBox {
  left: number;
  width: number;
}

interface DragState {
  id: number;
  x0: number;
  grab: number;
  active: boolean;
  width: number;
  history: { x: number; t: number }[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Rubber band: the drop resists past the control's edge instead of leaving it. */
const rubber = (distance: number, size = 40) => (distance * size * 0.5) / (size + 0.5 * Math.abs(distance));

/** The edge facing the travel leaves first; the trailing edge catches up. */
const quick = { type: "spring" as const, visualDuration: 0.26, bounce: 0 };
const lag = { type: "spring" as const, visualDuration: 0.5, bounce: 0 };

/**
 * A glass segmented control with a liquid indicator: the leading edge races ahead and the trailing
 * edge catches up, so the drop stretches and thins between segments. Drag the selected segment to
 * slide it.
 */
export function GlassSegmented({
  options,
  value,
  defaultValue,
  onValueChange,
  label,
  size = "md",
  fullWidth = false,
  className,
  style,
}: GlassSegmentedProps) {
  const reduced = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const boxes = useRef(new Map<string, SegmentBox>());
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? options.find(option => !option.disabled)?.value ?? "");
  const current = value ?? uncontrolled;
  const [dragging, setDragging] = useState<string | null>(null);
  const [height, setHeight] = useState(size === "sm" ? 36 : 44);
  const left = useMotionValue(0);
  const right = useMotionValue(0);
  const width = useMotionValue(0);
  const animations = useRef<ReturnType<typeof animate>[]>([]);
  const ready = useRef(false);
  const drag = useRef<DragState | null>(null);
  const latest = useRef({ value: current, reduced, options });

  useEffect(() => {
    latest.current = { value: current, reduced, options };
  });

  const signature = options.map(option => `${option.value}\u0000${option.label}\u0000${option.badge ?? ""}\u0000${+!!option.disabled}`).join("\u0001");

  const commit = useCallback(
    (next: string) => {
      if (value === undefined) setUncontrolled(next);
      if (next !== latest.current.value) onValueChange?.(next);
    },
    [value, onValueChange],
  );

  const stop = () => {
    animations.current.forEach(animation => animation.stop());
    animations.current = [];
  };

  const place = useCallback(
    (box: SegmentBox, immediate = false) => {
      stop();
      const from = box.left;
      const to = box.left + box.width;
      width.set(box.width);
      if (immediate || latest.current.reduced) {
        left.set(from);
        right.set(to);
        return;
      }
      const forward = from > left.get();
      animations.current = [animate(left, from, forward ? lag : quick), animate(right, to, forward ? quick : lag)];
    },
    [left, right, width],
  );

  const measure = useCallback(() => {
    const element = rootRef.current;
    if (!element) return;
    setHeight(element.clientHeight);
    boxes.current.clear();
    for (const option of latest.current.options) {
      const node = itemRefs.current.get(option.value);
      if (node) boxes.current.set(option.value, { left: node.offsetLeft, width: node.offsetWidth });
    }
  }, []);

  useLayoutEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const sync = () => {
      measure();
      const box = boxes.current.get(latest.current.value);
      if (box && !drag.current) place(box, true);
      ready.current = true;
    };
    latest.current.options = options;
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    return () => {
      observer.disconnect();
      stop();
    };
  }, [measure, place, signature]);

  useEffect(() => {
    if (!ready.current || drag.current?.active) return;
    const box = boxes.current.get(current);
    if (box) place(box);
  }, [current, place]);

  const nearest = (center: number) => {
    let found: string | null = null;
    let distance = Infinity;
    for (const option of options) {
      if (option.disabled) continue;
      const box = boxes.current.get(option.value);
      if (!box) continue;
      const gap = Math.abs(box.left + box.width / 2 - center);
      if (gap < distance) {
        distance = gap;
        found = option.value;
      }
    }
    return found;
  };

  const release = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    drag.current = null;
    setDragging(null);
    if (!state.active) return;
    const now = performance.now();
    const first = state.history.find(entry => now - entry.t < 100) ?? state.history[0];
    const last = state.history[state.history.length - 1];
    if (!first || !last) return;
    const velocity = (last.x - first.x) / Math.max(0.016, (last.t - first.t) / 1000);
    const landed = nearest((left.get() + right.get()) / 2 + clamp(0.12 * velocity, -160, 160)) ?? current;
    const box = boxes.current.get(landed);
    if (box) place(box);
    commit(landed);
    const swallow = (click: MouseEvent) => {
      click.stopPropagation();
      click.preventDefault();
    };
    window.addEventListener("click", swallow, { capture: true, once: true });
    window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
  };

  const innerHeight = height - 8;
  const bulge = useTransform(() => clamp((right.get() - left.get() - width.get()) * 0.03, -1.5, innerHeight * 0.16));
  const x = useTransform(() => left.get());
  const dropWidth = useTransform(() => Math.max(innerHeight * 0.6, right.get() - left.get()));
  const y = useTransform(() => 4 + bulge.get());
  const dropHeight = useTransform(() => innerHeight - 2 * bulge.get());
  const radius = useTransform(() => (innerHeight - 2 * bulge.get()) / 2);
  const shown = dragging ?? current;

  return (
    <div
      ref={rootRef}
      role="radiogroup"
      aria-label={label}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={style}
      data-size={size}
      data-full={fullWidth ? "" : undefined}
      data-dragging={dragging ? "" : undefined}
      onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
        const enabled = options.filter(option => !option.disabled);
        const index = enabled.findIndex(option => option.value === current);
        const next =
          event.key === "ArrowRight" || event.key === "ArrowDown"
            ? (index + 1) % enabled.length
            : event.key === "ArrowLeft" || event.key === "ArrowUp"
              ? (index - 1 + enabled.length) % enabled.length
              : event.key === "Home"
                ? 0
                : event.key === "End"
                  ? enabled.length - 1
                  : null;
        if (next === null || !enabled.length) return;
        event.preventDefault();
        const option = enabled[next];
        commit(option.value);
        itemRefs.current.get(option.value)?.focus();
      }}
      onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || drag.current) return;
        const target = (event.target as HTMLElement).closest("button");
        if (!target || target.dataset.value !== current) return;
        const rect = rootRef.current?.getBoundingClientRect();
        if (!rect) return;
        const pointer = event.clientX - rect.left;
        const box = boxes.current.get(current);
        if (!box) return;
        drag.current = {
          id: event.pointerId,
          x0: pointer,
          grab: pointer - (left.get() + right.get()) / 2,
          active: false,
          width: box.width,
          history: [{ x: pointer, t: performance.now() }],
        };
      }}
      onPointerMove={(event: ReactPointerEvent<HTMLDivElement>) => {
        const state = drag.current;
        const element = rootRef.current;
        if (!state || state.id !== event.pointerId || !element) return;
        const pointer = event.clientX - element.getBoundingClientRect().left;
        if (!state.active) {
          if (Math.abs(pointer - state.x0) < 4) return;
          state.active = true;
          element.setPointerCapture(event.pointerId);
        }
        state.history.push({ x: pointer, t: performance.now() });
        if (state.history.length > 6) state.history.shift();
        const min = 4 + state.width / 2;
        const max = element.clientWidth - 4 - state.width / 2;
        const raw = pointer - state.grab;
        const center = raw < min ? min + rubber(raw - min) : raw > max ? max + rubber(raw - max) : raw;
        const over = nearest(center);
        if (over !== dragging) setDragging(over);
        const box = over ? boxes.current.get(over) : null;
        const target = box ? box.width : state.width;
        state.width += (target - state.width) * 0.35;
        const from = center - state.width / 2;
        const to = center + state.width / 2;
        width.set(state.width);
        if (latest.current.reduced) {
          left.set(from);
          right.set(to);
          return;
        }
        const forward = from > left.get();
        stop();
        animations.current = [
          animate(left, from, forward ? { ...lag, visualDuration: 0.22 } : { ...quick, visualDuration: 0.12 }),
          animate(right, to, forward ? { ...quick, visualDuration: 0.12 } : { ...lag, visualDuration: 0.22 }),
        ];
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <svg className={styles.drop} aria-hidden>
        <motion.rect className={styles.dropFill} x={x} y={y} width={dropWidth} height={dropHeight} rx={radius} />
        <motion.rect className={styles.dropEdge} x={x} y={y} width={dropWidth} height={dropHeight} rx={radius} />
      </svg>
      {options.map(option => {
        const checked = option.value === current;
        return (
          <button
            key={option.value}
            ref={node => {
              if (node) itemRefs.current.set(option.value, node);
              else itemRefs.current.delete(option.value);
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={option.disabled}
            data-value={option.value}
            data-on={shown === option.value ? "" : undefined}
            className={styles.segment}
            onClick={() => commit(option.value)}
          >
            {option.icon && (
              <span className={styles.icon} aria-hidden>
                {option.icon}
              </span>
            )}
            <span className={styles.label}>{option.label}</span>
            {option.badge !== undefined && <span className={styles.badge}>{option.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default GlassSegmented;
