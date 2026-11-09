"use client";

/**
 * Morph loader — tiny loaders that morph between shapes and fold into a check or a cross when done.
 *
 * Four strokes, each described by centre / length / direction / bend / width / opacity and driven by
 * their own spring, so any shape can morph into any other and an interrupted morph keeps velocity.
 * The loop is a per-frame wave written into the same motion values without React renders; the mark
 * (check / cross) is just another shape with a staggered spring and a one-time rotation + pop.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import {
  animate,
  motion,
  useAnimationFrame,
  motionValue,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./morph-loader.module.css";

export type MorphLoaderVariant = "dots" | "bars" | "ring" | "square";
export type MorphLoaderStatus = "loading" | "success" | "error";

export interface MorphLoaderProps {
  /** Loading shape. Changing it while loading morphs the strokes into the new shape. */
  variant?: MorphLoaderVariant;
  /** `success` folds the strokes into a check, `error` into a cross, `loading` gathers them back. */
  status?: MorphLoaderStatus;
  /** Rendered size in px. The drawing uses a 24 unit grid. */
  size?: number;
  /** Stroke thickness in grid units for ring, square, check, and cross. */
  strokeWidth?: number;
  /** Colors the check with --success and the cross with --danger. Off keeps currentColor. */
  tone?: boolean;
  /** Announced while loading. */
  label?: string;
  /** Announced on success. */
  successLabel?: string;
  /** Announced on error. */
  errorLabel?: string;
  /** Drops the status role and text, for loaders inside a control that announces its own state. */
  decorative?: boolean;
  /** Extra class on the root. */
  className?: string;
  /** Inline styles on the root. */
  style?: CSSProperties;
}

type StrokeKey = "cx" | "cy" | "len" | "ang" | "bend" | "w" | "o";

/** A stroke in the 24 unit drawing grid. */
type Stroke = Record<StrokeKey, number>;
/** One motion value per stroke channel. */
type StrokeValues = Record<StrokeKey, MotionValue<number>>;
/** Per-frame wave offset added on top of the stroke (any subset of channels). */
type Wave = Partial<Stroke>;

const KEYS: readonly StrokeKey[] = ["cx", "cy", "len", "ang", "bend", "w", "o"];

const rad = (deg: number) => (deg * Math.PI) / 180;

/** A straight stroke between two points, as centre + length + direction. */
const line = (x1: number, y1: number, x2: number, y2: number, w: number): Stroke => ({
  cx: (x1 + x2) / 2,
  cy: (y1 + y2) / 2,
  len: Math.hypot(x2 - x1, y2 - y1),
  ang: (180 * Math.atan2(y2 - y1, x2 - x1)) / Math.PI,
  bend: 0,
  w,
  o: 1,
});

/** A zero-length stroke with a stroke width — a dot. */
const dot = (cx: number, cy: number, w: number): Stroke => ({
  cx,
  cy,
  len: 0.01,
  ang: 0,
  bend: 0,
  w,
  o: 1,
});

/** The four strokes of one shape. `strokeWidth` is in grid units. */
function shapeFor(shape: MorphLoaderVariant | "success" | "error", strokeWidth: number): Stroke[] {
  switch (shape) {
    case "dots":
      return [dot(5, 12, 4), dot(12, 12, 4), dot(19, 12, 4), { ...dot(12, 12, 0), o: 0 }];
    case "bars":
      return [4.5, 9.5, 14.5, 19.5].map(x => line(x, 6, x, 18, 3));
    case "ring":
      // Four quarter-ish arcs of one circle: the arc centre sits 8.5 units off the ring centre and
      // the bend (1 / radius) turns the straight chord into the matching arc segment.
      return [0, 90, 180, 270].map(offset => {
        const direction = offset - 90;
        const half = rad(32);
        return {
          cx: 12 + 8.5 * Math.cos(half) * Math.cos(rad(direction)),
          cy: 12 + 8.5 * Math.cos(half) * Math.sin(rad(direction)),
          len: 17 * Math.sin(half),
          ang: direction + 90,
          bend: 1 / 8.5,
          w: strokeWidth,
          o: 1,
        };
      });
    case "square":
      return [
        line(5, 5, 19, 5, strokeWidth),
        line(19, 5, 19, 19, strokeWidth),
        line(19, 19, 5, 19, strokeWidth),
        line(5, 19, 5, 5, strokeWidth),
      ];
    case "success":
      return [
        line(5, 12.5, 7.6, 15.1, strokeWidth),
        line(7.6, 15.1, 10.2, 17.7, strokeWidth),
        line(10.2, 17.7, 14.6, 12.6, strokeWidth),
        line(14.6, 12.6, 19, 7.5, strokeWidth),
      ];
    case "error":
      return [
        line(6.5, 6.5, 12, 12, strokeWidth),
        line(12, 12, 17.5, 17.5, strokeWidth),
        line(17.5, 6.5, 12, 12, strokeWidth),
        line(12, 12, 6.5, 17.5, strokeWidth),
      ];
  }
}

/** A critically damped spring that settles in roughly `duration` seconds. */
const springFor = (duration: number, bounce: number) => {
  const omega = (2 * Math.PI) / (1.2 * duration);
  return {
    type: "spring" as const,
    stiffness: omega * omega,
    damping: 2 * (1 - bounce) * omega,
    mass: 1,
    restDelta: 0.001,
    restSpeed: 0.01,
  };
};

const shapeSpring = springFor(0.46, 0);
const markSpring = springFor(0.52, 0);
const turnSpring = springFor(0.6, 0);

const smoothstep = (value: number) => value * value * (3 - 2 * value);

/** Builds the SVG `d` for one stroke, using an arc when the stroke is bent. */
function pathFor(stroke: Stroke): string {
  const half = Math.max(stroke.len, 0.01) / 2;
  const angle = rad(stroke.ang);
  const dx = Math.cos(angle) * half;
  const dy = Math.sin(angle) * half;
  const x1 = (stroke.cx - dx).toFixed(3);
  const y1 = (stroke.cy - dy).toFixed(3);
  const x2 = (stroke.cx + dx).toFixed(3);
  const y2 = (stroke.cy + dy).toFixed(3);
  if (Math.abs(stroke.bend) < 0.004) return `M${x1} ${y1}L${x2} ${y2}`;
  const radius = (1 / Math.abs(stroke.bend)).toFixed(3);
  return `M${x1} ${y1}A${radius} ${radius} 0 0 ${stroke.bend > 0 ? 1 : 0} ${x2} ${y2}`;
}

/** Merges a stroke's motion values with the live wave offset. */
function readStroke(values: StrokeValues, wave: Wave): Stroke {
  const merged = {} as Stroke;
  for (const key of KEYS) merged[key] = values[key].get() + (wave[key] ?? 0);
  return merged;
}

const noopSubscribe = () => () => {};

/** True only after hydration, so the server render and the first client render agree. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** One of the four strokes: path data, width and opacity are all derived motion values. */
function LoaderStroke({ values, wave }: { values: StrokeValues; wave: MotionValue<Wave> }) {
  const d = useTransform(() => pathFor(readStroke(values, wave.get())));
  const width = useTransform(() => Math.max(0, values.w.get() + (wave.get().w ?? 0)));
  const opacity = useTransform(() => Math.min(1, Math.max(0, values.o.get())));

  return <motion.path d={d} strokeWidth={width} opacity={opacity} />;
}

/** A tiny loader that morphs between shapes and folds into a check or a cross when done. */
export function MorphLoader({
  variant = "dots",
  status = "loading",
  size = 24,
  strokeWidth = 2.5,
  tone = true,
  label = "Loading",
  successLabel = "Done",
  errorLabel = "Failed",
  decorative = false,
  className,
  style,
}: MorphLoaderProps) {
  const prefersReduced = useReducedMotion();
  const hydrated = useHydrated();
  const reduced = Boolean(prefersReduced) && hydrated;

  const shape = status === "loading" ? variant : status;
  const isMark = shape === "success" || shape === "error";

  const [strokes] = useState<StrokeValues[]>(() =>
    shapeFor(shape, strokeWidth).map(initial => ({
      cx: motionValue(initial.cx),
      cy: motionValue(initial.cy),
      len: motionValue(initial.len),
      ang: motionValue(initial.ang),
      bend: motionValue(initial.bend),
      w: motionValue(initial.w),
      o: motionValue(initial.o),
    })),
  );
  const [waves] = useState(() => [0, 1, 2, 3].map(() => motionValue<Wave>({})));

  const rotation = useMotionValue(0);
  const loopOpacity = useMotionValue(status === "loading" ? 1 : 0);
  const scale = useMotionValue(1);

  const elapsed = useRef(0);
  const turn = useRef<{ stop: () => void } | null>(null);
  const current = useRef(shape);

  useLayoutEffect(() => {
    current.current = shape;
  }, [shape]);

  useEffect(() => {
    const targets = shapeFor(shape, strokeWidth);
    const running: { stop: () => void }[] = [];

    targets.forEach((target, index) => {
      const values = strokes[index];
      for (const key of KEYS) {
        const value = values[key];
        let goal = target[key];
        if (key === "ang") {
          // A straight stroke is symmetric under 180°, a bent one only under 360°: pick the step so
          // the spring travels the short way round instead of unwinding a full turn.
          const step = target.bend === 0 && values.bend.get() < 0.004 ? 180 : 360;
          goal += Math.round((value.get() - goal) / step) * step;
        }
        if (reduced) value.set(goal);
        else
          running.push(
            animate(value, goal, {
              ...(isMark ? markSpring : shapeSpring),
              delay: isMark ? 0.035 * index : 0,
            }),
          );
      }
    });

    if (reduced) {
      loopOpacity.set(isMark ? 0 : 1);
      rotation.set(0);
      return;
    }

    running.push(
      animate(loopOpacity, isMark ? 0 : 1, {
        duration: isMark ? motionTokens.duration.exit : motionTokens.duration.standard,
        ease: [...motionTokens.ease.standard] as [number, number, number, number],
      }),
    );

    if (isMark) {
      turn.current?.stop();
      const from = rotation.get();
      turn.current = animate(rotation, 360 * Math.ceil((from - 1) / 360), turnSpring);
      running.push(
        animate(scale, [1, 1.14, 1], {
          duration: 0.42,
          times: [0, 0.35, 1],
          ease: ["easeOut", "easeInOut"],
        }),
      );
    }

    return () => running.forEach(control => control.stop());
  }, [shape, strokeWidth, reduced, loopOpacity, scale, rotation, strokes]);

  useAnimationFrame((timestamp, delta) => {
    if (reduced) return;
    const loading = current.current !== "success" && current.current !== "error";
    const fade = loopOpacity.get();
    if (!loading && fade < 0.001) return;

    // The wave clock keeps running through the exit so the loop settles instead of freezing.
    const step = Math.min(delta, 64) / 1000;
    elapsed.current += step * (loading ? 1 : fade);
    const time = elapsed.current;
    const shapeNow = current.current;
    const offsets: Wave[] = [{}, {}, {}, {}];

    if (shapeNow === "dots") {
      for (let index = 0; index < 3; index += 1) {
        const wave = Math.sin((time / 0.9) * Math.PI * 2 - 0.8 * index);
        offsets[index] = { cy: -3.2 * Math.max(0, wave) * fade, w: 0.6 * Math.max(0, wave) * fade };
      }
    } else if (shapeNow === "bars") {
      for (let index = 0; index < 4; index += 1) {
        const wave = 0.5 + 0.5 * Math.sin((time / 0.95) * Math.PI * 2 - 0.7 * index);
        offsets[index] = { len: -7.5 * (1 - wave) * fade };
      }
    } else if (shapeNow === "ring") {
      const wave = Math.sin((time * Math.PI * 2) / 1.4);
      for (let index = 0; index < 4; index += 1) offsets[index] = { len: -3.2 * (0.5 + 0.5 * wave) * fade };
    } else if (shapeNow === "square") {
      const wave = Math.sin(smoothstep(Math.min(1, ((time / 0.9) % 1) / 0.8)) * Math.PI);
      for (let index = 0; index < 4; index += 1) offsets[index] = { len: -8 * wave * fade };
    }

    waves.forEach((value, index) => value.set(offsets[index]));

    if (loading && (shapeNow === "ring" || shapeNow === "square")) {
      turn.current?.stop();
      turn.current = null;
      if (shapeNow === "ring") {
        rotation.set(rotation.get() + 330 * step * fade);
      } else {
        // The square tumbles a quarter turn at a time, eased through each corner.
        const turnOf = (progress: number) =>
          (Math.floor(progress) + smoothstep(Math.min(1, (progress % 1) / 0.8))) * 90;
        rotation.set(rotation.get() + (turnOf(time / 0.9) - turnOf((time - step) / 0.9)) * fade);
      }
    } else if (loading && !turn.current && Math.abs(rotation.get() % 360) > 0.01) {
      const from = rotation.get();
      turn.current = animate(rotation, 360 * Math.ceil((from - 1) / 360), turnSpring);
    }
  });

  const transform = useTransform(
    () => `rotate(${rotation.get().toFixed(3)}deg) scale(${scale.get().toFixed(4)})`,
  );
  const announcement = status === "success" ? successLabel : status === "error" ? errorLabel : label;

  return (
    <span
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-status={status}
      data-tone={tone ? "" : undefined}
      style={{ ...style, width: size, height: size }}
      role={decorative ? undefined : "status"}
    >
      <svg
        className={styles.svg}
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        aria-hidden="true"
        focusable="false"
      >
        <motion.g
          style={{ transform, transformOrigin: "12px 12px", transformBox: "view-box" }}
        >
          {strokes.map((values, index) => (
            <LoaderStroke values={values} wave={waves[index]} key={index} />
          ))}
        </motion.g>
      </svg>
      {!decorative && <span className={styles.srOnly}>{announcement}</span>}
    </span>
  );
}

export default MorphLoader;
