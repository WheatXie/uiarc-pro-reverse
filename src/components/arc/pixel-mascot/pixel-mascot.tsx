"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "motion/react";
import styles from "./pixel-mascot.module.css";

export type PixelMascotStatus = "idle" | "thinking" | "writing" | "done" | "error";

export interface PixelMascotProps {
  /** What the assistant is doing. Leave it out to play the built in loop through every state. */
  status?: PixelMascotStatus;
  /** Integer pixel scale from 1 to 8. Each sprite pixel is this many CSS pixels: 1 renders 24px, 2 renders 48px, 4 renders 96px, 8 renders 192px. Other values round and clamp. */
  size?: number;
  /** Who the mascot stands for, used in the accessible label ("Arc is thinking"). */
  name?: string;
  /** Replaces the generated accessible label. */
  label?: string;
  /** Announces status changes in a polite live region. Defaults to true when status is controlled and false for the built in loop. Turn it off when nearby text already announces progress. */
  announce?: boolean;
  /** Freezes the animation on the current frame. The mascot also pauses by itself while off screen. */
  paused?: boolean;
  /** Class for the inline wrapper. */
  className?: string;
  /** Style for the inline wrapper, for example a custom --accent. */
  style?: CSSProperties;
}

/* -------------------------------------------------------------------------- */
/* Sprite geometry: a 24 by 24 grid, every shape authored as pixel rectangles. */
/* -------------------------------------------------------------------------- */

type Rect = [x: number, y: number, w: number, h: number];
type Point = [x: number, y: number];

const toPath = (rects: Rect[]) => rects.map(([x, y, w, h]) => `M${x} ${y}h${w}v${h}h${-w}z`).join("");
const toPixels = (points: Point[]): Rect[] => points.map(([x, y]) => [x, y, 1, 1]);

const SPRITE = {
  tip: [[6, 0, 2, 1]],
  ink: [
    [6, 1, 2, 1],
    [1, 2, 12, 1],
    [1, 11, 12, 1],
    [0, 3, 1, 8],
    [13, 3, 1, 8],
  ],
  body: [[1, 3, 12, 8]],
  shade: [
    [1, 10, 12, 1],
    [12, 3, 1, 7],
  ],
  screen: [
    [3, 4, 8, 1],
    [2, 5, 10, 3],
    [3, 8, 8, 1],
  ],
  cheeks: toPixels([
    [2, 9],
    [11, 9],
  ]),
  happy: toPixels([
    [3, 6],
    [4, 5],
    [5, 6],
    [8, 6],
    [9, 5],
    [10, 6],
  ]),
  cross: toPixels([
    [3, 5],
    [5, 5],
    [4, 6],
    [3, 7],
    [5, 7],
    [8, 5],
    [10, 5],
    [9, 6],
    [8, 7],
    [10, 7],
  ]),
  keyboardInk: [
    [-1, 11, 16, 1],
    [-1, 12, 1, 1],
    [14, 12, 1, 1],
    [0, 13, 14, 1],
  ],
  keyboardGaps: [
    [0, 12, 1, 1],
    [2, 12, 1, 1],
    [4, 12, 1, 1],
    [6, 12, 2, 1],
    [9, 12, 1, 1],
    [11, 12, 1, 1],
    [13, 12, 1, 1],
  ],
  keyboardKeys: toPixels([
    [1, 12],
    [3, 12],
    [5, 12],
    [8, 12],
    [10, 12],
    [12, 12],
  ]),
  cloudInk: [
    [15, 0, 7, 1],
    [15, 4, 7, 1],
    [14, 1, 1, 3],
    [22, 1, 1, 3],
  ],
  cloudFill: [[15, 1, 7, 3]],
  tailNear: [[15, 8, 1, 1]],
  tailFar: [[16, 6, 1, 1]],
} satisfies Record<string, Rect[]>;

const PATH = {
  tip: toPath(SPRITE.tip),
  ink: toPath(SPRITE.ink),
  body: toPath(SPRITE.body),
  shade: toPath(SPRITE.shade),
  screen: toPath(SPRITE.screen),
  cheeks: toPath(SPRITE.cheeks),
  happy: toPath(SPRITE.happy),
  cross: toPath(SPRITE.cross),
  keyboardInk: toPath(SPRITE.keyboardInk),
  keyboardGaps: toPath(SPRITE.keyboardGaps),
  keyboardKeys: toPath(SPRITE.keyboardKeys),
  cloudInk: toPath(SPRITE.cloudInk),
  cloudFill: toPath(SPRITE.cloudFill),
  tailNear: toPath(SPRITE.tailNear),
  tailFar: toPath(SPRITE.tailFar),
};

/** X position of the six keyboard keys, indexed by the active stroke. */
const KEY_X = [1, 3, 5, 8, 10, 12];
/** X positions of the three thought bubble dots. */
const DOT_X = [16, 18, 20];

/** Arm poses, left side. The right side mirrors around x=13. Index 0..5. */
const ARMS: Point[][] = [
  [
    [-1, 5],
    [-2, 4],
    [-2, 3],
  ],
  [
    [-1, 5],
    [-1, 6],
  ],
  [
    [-1, 6],
    [-1, 7],
  ],
  [
    [-1, 7],
    [-1, 8],
  ],
  [
    [-1, 8],
    [-1, 9],
  ],
  [
    [-1, 9],
    [-1, 10],
  ],
];

/** Where the done state throws its three sparks from. */
const SPARKS: { x: number; y: number; reach: number }[] = [
  { x: 2, y: 5, reach: 2 },
  { x: 21, y: 4, reach: 2 },
  { x: 7, y: 2, reach: 1 },
];

/* -------------------------------------------------------------------------- */
/* Poses                                                                      */
/* -------------------------------------------------------------------------- */

type EyesKind = "pair" | "happy" | "cross";

interface Eyes {
  kind: EyesKind;
  dx: number;
  y: number;
  h: number;
}

interface Pose {
  dx: number;
  dy: number;
  eyes: Eyes;
  armL: number;
  armR: number;
  bubble: number;
  keyboard: number;
  antenna: boolean;
  dot: number;
  sparks: number[];
  key: number;
}

const OPEN: Eyes = { kind: "pair", dx: 0, y: 5, h: 3 };
const LOOK: Eyes = { kind: "pair", dx: 1, y: 5, h: 2 };
const SIDE: Eyes = { kind: "pair", dx: 0, y: 5, h: 2 };
const WORK: Eyes = { kind: "pair", dx: 0, y: 6, h: 2 };
const HAPPY: Eyes = { kind: "happy", dx: 0, y: 5, h: 2 };
const CROSSED: Eyes = { kind: "cross", dx: 0, y: 5, h: 3 };

/** A blink is the current eye lowered and flattened to a single row. */
const lid = (eyes: Eyes): Eyes => ({ ...eyes, y: eyes.y + eyes.h - 1, h: 1 });

const between = (value: number, from: number, to: number) => value >= from && value < to;
/** A two second bob: the sprite sits down for the second half of every period. */
const bob = (time: number, period: number) => (time % period < period / 2 ? 0 : -1);
/** First authored keyframe past `time`, or `fallback` when the curve has run out. */
const curve = (points: [number, number][], time: number, fallback: number) =>
  points.find(([at]) => time < at)?.[1] ?? fallback;

const DONE_RISE: [number, number][] = [
  [80, 1],
  [120, 0],
  [160, -1],
  [200, -2],
  [320, -3],
  [360, -2],
  [400, -1],
];
const DONE_ARMS: [number, number][] = [
  [80, 2],
  [120, 1],
  [400, 0],
  [440, 1],
];
const SPARK_AT = [200, 280, 360];
const ERROR_SHAKE = [1, 0, -1, 0, 1, 0];
/** Typing strokes: [start ms, key index]. */
const STROKES: [number, number][] = [
  [0, 1],
  [160, 4],
  [320, 0],
  [480, 2],
  [640, 5],
  [880, 3],
  [1040, 1],
  [1200, 4],
];

function pose(status: PixelMascotStatus, time: number, still: boolean): Pose {
  const base: Pose = {
    dx: 0,
    dy: 0,
    eyes: OPEN,
    armL: 2,
    armR: 2,
    bubble: 0,
    keyboard: 0,
    antenna: true,
    dot: -1,
    sparks: [0, 0, 0],
    key: -1,
  };

  switch (status) {
    case "idle": {
      if (still) return base;
      base.dy = bob(time, 2000);
      const cycle = time % 8000;
      const glance = between(cycle, 3600, 4400) ? { ...OPEN, dx: 1 } : OPEN;
      base.eyes = between(cycle, 2400, 2480) || between(cycle, 5600, 5680) || between(cycle, 5880, 5960) ? lid(glance) : glance;
      return base;
    }
    case "thinking": {
      base.bubble = 3;
      base.eyes = LOOK;
      if (still) {
        base.dot = -2;
        return base;
      }
      base.dy = bob(time, 2400);
      const step = Math.floor(time / 280) % 4;
      base.dot = step < 3 ? step : -1;
      base.antenna = step !== 3;
      if (between(time % 2800, 2000, 2080)) base.eyes = lid(LOOK);
      return base;
    }
    case "writing": {
      base.keyboard = 3;
      base.armL = 4;
      base.armR = 4;
      base.eyes = WORK;
      const local = time - 200;
      if (still || local < 0) return base;
      const stroke = local % 1600;
      base.eyes = { ...WORK, dx: stroke < 500 ? -1 : stroke < 1000 ? 0 : 1 };
      const hit = STROKES.find(([at]) => between(stroke, at, at + 80));
      if (hit) {
        base.key = hit[1];
        if (hit[1] < 3) base.armL = 5;
        else base.armR = 5;
      }
      return base;
    }
    case "done": {
      base.eyes = HAPPY;
      if (still) return base;
      base.dy = time < 900 ? curve(DONE_RISE, time, 0) : bob(time - 900, 2000);
      base.armL = curve(DONE_ARMS, time, 2);
      base.armR = base.armL;
      base.sparks = SPARK_AT.map((offset) => (between(time - offset, 0, 320) ? Math.floor((time - offset) / 80) + 1 : 0));
      return base;
    }
    case "error": {
      base.eyes = CROSSED;
      base.dy = 1;
      base.armL = 3;
      base.armR = 3;
      base.antenna = false;
      if (!still && time < 240) {
        base.dx = ERROR_SHAKE[Math.floor(time / 40)] ?? 0;
        base.dy = 0;
      }
      return base;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* SVG attributes                                                             */
/* -------------------------------------------------------------------------- */

type PartAttrs = {
  x?: string;
  y?: string;
  width?: string;
  height?: string;
  opacity?: string;
  visibility?: string;
  transform?: string;
  "data-screen"?: "normal" | "error";
  "data-antenna"?: "on" | "off";
};

type PoseAttrs = Record<string, PartAttrs>;

const shown = (value: boolean) => (value ? "visible" : "hidden");

/** Shadow narrows and fades as the sprite rises: [width, opacity] by vertical offset. */
const SHADOW_WIDTH: Record<number, number> = { 1: 12, 0: 10, [-1]: 10, [-2]: 8, [-3]: 6 };
const SHADOW_OPACITY: Record<number, number> = { 1: 1, 0: 1, [-1]: 0.7, [-2]: 0.6, [-3]: 0.45 };

function attributes(source: Pose): PoseAttrs {
  const attrs: PoseAttrs = {
    root: {
      "data-screen": source.eyes.kind === "cross" ? "error" : "normal",
      "data-antenna": source.antenna && source.eyes.kind !== "cross" ? "on" : "off",
    },
    body: { transform: `translate(${5 + source.dx} ${9 + source.dy})` },
    eyeL: {
      x: String(4 + source.eyes.dx),
      y: String(source.eyes.y),
      height: String(source.eyes.h),
      visibility: shown(source.eyes.kind === "pair"),
    },
    eyeR: {
      x: String(8 + source.eyes.dx),
      y: String(source.eyes.y),
      height: String(source.eyes.h),
      visibility: shown(source.eyes.kind === "pair"),
    },
    happy: { visibility: shown(source.eyes.kind === "happy") },
    cross: { visibility: shown(source.eyes.kind === "cross") },
    cheeks: { visibility: shown(source.eyes.kind === "happy") },
    keyboard: {
      transform: `translate(0 ${[0, 2, 1, 0][source.keyboard]})`,
      visibility: shown(source.keyboard > 0),
    },
    key: { x: String(KEY_X[Math.max(0, source.key)]), visibility: shown(source.key >= 0) },
    tailNear: { visibility: shown(source.bubble >= 1) },
    tailFar: { visibility: shown(source.bubble >= 2) },
    cloud: { visibility: shown(source.bubble >= 3) },
  };

  const rise = Math.max(-3, Math.min(1, source.dy));
  const width = SHADOW_WIDTH[rise];
  attrs.shadow = {
    x: String(12 - width / 2),
    width: String(width),
    opacity: String(SHADOW_OPACITY[rise]),
  };

  for (const side of ["L", "R"] as const) {
    const arm = ARMS[side === "L" ? source.armL : source.armR];
    for (let index = 0; index < 3; index += 1) {
      const [x, y] = arm[Math.min(index, arm.length - 1)];
      attrs[`arm${side}${index}`] = {
        x: String(side === "L" ? x : 13 - x),
        y: String(y),
        visibility: shown(index < arm.length),
      };
    }
  }

  DOT_X.forEach((_, index) => {
    attrs[`dot${index}`] = { opacity: source.dot === index || source.dot === -2 ? "1" : "0.3" };
  });

  source.sparks.forEach((frame, index) => {
    attrs[`spark${index}core`] = { visibility: shown(frame === 1 || frame === 2) };
    attrs[`spark${index}near`] = { visibility: shown(frame === 2 || frame === 3) };
    attrs[`spark${index}far`] = { visibility: shown(frame === 3 || frame === 4) };
  });

  return attrs;
}

/* -------------------------------------------------------------------------- */
/* Frame stepping                                                             */
/* -------------------------------------------------------------------------- */

/** One pixel toward the target, never overshooting. */
const toward = (from: number, to: number) => from + Math.sign(to - from);

function morphEyes(from: Eyes, to: Eyes): Eyes {
  if (from.kind !== to.kind) {
    if (from.kind === "pair") return from.h > 1 ? { ...from, y: from.y + 1, h: from.h - 1 } : to;
    if (to.kind === "pair") return lid(to);
    return { kind: "pair", dx: 0, y: 6, h: 1 };
  }
  if (from.kind !== "pair") return from;
  if (from.h > to.h) return to.y > from.y ? { ...from, y: from.y + 1, h: from.h - 1 } : { ...from, h: from.h - 1 };
  if (from.h < to.h) return to.y < from.y ? { ...from, y: from.y - 1, h: from.h + 1 } : { ...from, h: from.h + 1 };
  if (from.y !== to.y) return { ...from, y: toward(from.y, to.y) };
  if (from.dx !== to.dx) return { ...from, dx: toward(from.dx, to.dx) };
  return from;
}

/** One 40ms step from the current pose toward the target pose. */
function advance(from: Pose, to: Pose): Pose {
  const keyboard = toward(from.keyboard, to.keyboard);
  return {
    dx: to.dx,
    dy: toward(from.dy, to.dy),
    eyes: morphEyes(from.eyes, to.eyes),
    armL: toward(from.armL, to.armL),
    armR: toward(from.armR, to.armR),
    bubble: toward(from.bubble, to.bubble),
    keyboard,
    antenna: to.antenna,
    dot: to.dot,
    sparks: to.sparks,
    key: keyboard === 3 ? to.key : -1,
  };
}

const STEP = 40;

interface Engine {
  setStatus(next: PixelMascotStatus): void;
  setRunning(value: boolean): void;
  setStill(value: boolean): void;
  destroy(): void;
}

function startEngine(node: SVGSVGElement, initial: PixelMascotStatus): Engine {
  const parts = new Map<string, Element>([["root", node]]);
  node.querySelectorAll("[data-part]").forEach((element) => parts.set(element.getAttribute("data-part") ?? "", element));

  let target = initial;
  let origin = performance.now() - 10_000;
  let current = pose(initial, 0, true);
  let previous: PoseAttrs = {};
  let frame = 0;
  let clock = 0;
  let running = false;
  let still = false;

  // Only the attributes that changed since the last step reach the DOM, so an idle mascot writes nothing.
  const write = () => {
    const next = attributes(current);
    for (const part in next) {
      const element = parts.get(part);
      if (!element) continue;
      const before = previous[part];
      const attrs = next[part];
      for (const name in attrs) {
        const value = attrs[name as keyof PartAttrs];
        if (value !== undefined && before?.[name as keyof PartAttrs] !== value) element.setAttribute(name, value);
      }
    }
    previous = next;
  };

  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    if (now - clock > 200) clock = now - STEP;
    if (now - clock < STEP) return;
    while (now - clock >= STEP) {
      clock += STEP;
      current = advance(current, pose(target, Math.max(0, clock - origin), false));
    }
    write();
  };

  const sync = () => {
    const shouldRun = running && !still;
    if (shouldRun && !frame) {
      clock = performance.now() - STEP;
      frame = requestAnimationFrame(tick);
    }
    if (!shouldRun && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };

  write();

  return {
    setStatus(next) {
      if (next === target) return;
      target = next;
      if (frame) {
        origin = clock + STEP;
      } else {
        origin = performance.now();
        current = pose(next, 0, true);
        write();
      }
    },
    setRunning(value) {
      running = value;
      sync();
    },
    setStill(value) {
      still = value;
      if (value) {
        current = pose(target, 0, true);
        write();
      }
      sync();
    },
    destroy() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

const PHRASE: Record<PixelMascotStatus, string> = {
  idle: "is ready",
  thinking: "is thinking",
  writing: "is writing",
  done: "is done",
  error: "ran into an error",
};

const LOOP: [PixelMascotStatus, number][] = [
  ["idle", 1800],
  ["thinking", 2400],
  ["writing", 3200],
  ["done", 2000],
  ["idle", 1400],
  ["thinking", 2000],
  ["error", 2200],
];

/** The built in status loop (idle, thinking, writing, done, idle, thinking, error). Use it to keep several mascots in step. */
export function usePixelMascotLoop(enabled = true): PixelMascotStatus {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => setIndex((current) => (current + 1) % LOOP.length), LOOP[index][1]);
    return () => window.clearTimeout(timer);
  }, [enabled, index]);
  return LOOP[index][0];
}

export function PixelMascot({ status, size = 4, name = "Assistant", label, announce, paused = false, className, style }: PixelMascotProps) {
  const looping = status === undefined;
  const looped = usePixelMascotLoop(looping && !paused);
  const active = status ?? looped;
  const reduced = Boolean(useReducedMotion());
  const scale = Math.min(8, Math.max(1, Math.round(Number.isFinite(size) ? size : 4)));
  const text = label ?? `${name} ${PHRASE[active]}`;

  const svg = useRef<SVGSVGElement>(null);
  const engine = useRef<Engine | null>(null);
  const onScreen = useRef(true);
  const frozen = useRef(paused);
  // The first paint is always a resting pose; the frame clock takes over after mount.
  const [initial] = useState(() => ({ status: active, attrs: attributes(pose(active, 0, true)) }));

  useEffect(() => {
    const node = svg.current;
    if (!node) return;
    const instance = startEngine(node, initial.status);
    engine.current = instance;

    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            onScreen.current = entry?.isIntersecting ?? true;
            instance.setRunning(onScreen.current && !frozen.current);
          });
    observer?.observe(node);

    return () => {
      observer?.disconnect();
      instance.destroy();
      engine.current = null;
    };
  }, [initial]);

  useEffect(() => {
    engine.current?.setStatus(active);
  }, [active]);

  useEffect(() => {
    engine.current?.setStill(reduced);
  }, [reduced]);

  useEffect(() => {
    frozen.current = paused;
    engine.current?.setRunning(onScreen.current && !paused);
  }, [paused]);

  const attrs = initial.attrs;

  return (
    <span className={[styles.root, className].filter(Boolean).join(" ")} style={style}>
      <svg
        ref={svg}
        className={styles.svg}
        viewBox="0 0 24 24"
        width={24 * scale}
        height={24 * scale}
        shapeRendering="crispEdges"
        role="img"
        aria-label={text}
        {...attrs.root}
      >
        <rect data-part="shadow" className={styles.shadow} y={22} height={1} {...attrs.shadow} />
        <path data-part="tailNear" className={styles.ink} d={PATH.tailNear} {...attrs.tailNear} />
        <path data-part="tailFar" className={styles.ink} d={PATH.tailFar} {...attrs.tailFar} />
        <g data-part="cloud" {...attrs.cloud}>
          <path className={styles.body} d={PATH.cloudFill} />
          <path className={styles.ink} d={PATH.cloudInk} />
          {DOT_X.map((x, index) => (
            <rect key={x} data-part={`dot${index}`} className={styles.ink} x={x} y={2} width={1} height={1} {...attrs[`dot${index}`]} />
          ))}
        </g>
        <g data-part="body" {...attrs.body}>
          {(["L", "R"] as const).map((side) =>
            [0, 1, 2].map((index) => (
              <rect key={`${side}${index}`} data-part={`arm${side}${index}`} className={styles.ink} width={1} height={1} {...attrs[`arm${side}${index}`]} />
            )),
          )}
          <path className={styles.tip} d={PATH.tip} />
          <path className={styles.body} d={PATH.body} />
          <path className={styles.shade} d={PATH.shade} />
          <path className={styles.ink} d={PATH.ink} />
          <path className={styles.screen} d={PATH.screen} />
          <rect data-part="eyeL" className={styles.eye} width={2} {...attrs.eyeL} />
          <rect data-part="eyeR" className={styles.eye} width={2} {...attrs.eyeR} />
          <path data-part="happy" className={styles.eye} d={PATH.happy} {...attrs.happy} />
          <path data-part="cross" className={styles.cross} d={PATH.cross} {...attrs.cross} />
          <path data-part="cheeks" className={styles.cheek} d={PATH.cheeks} {...attrs.cheeks} />
          <g data-part="keyboard" {...attrs.keyboard}>
            <path className={styles.body} d={PATH.keyboardKeys} />
            <path className={styles.shade} d={PATH.keyboardGaps} />
            <path className={styles.ink} d={PATH.keyboardInk} />
            <rect data-part="key" className={styles.accent} y={12} width={1} height={1} {...attrs.key} />
          </g>
        </g>
        {SPARKS.map(({ x, y, reach }, index) => {
          const core = toPath(toPixels([[x, y]]));
          const near = toPath(
            toPixels([
              [x - 1, y],
              [x + 1, y],
              [x, y - 1],
              [x, y + 1],
            ]),
          );
          const far = toPath(
            toPixels([
              [x - 2, y],
              [x + 2, y],
              [x, y - 2],
              [x, y + 2],
            ]),
          );
          return (
            <g key={index} className={styles.accent}>
              <path data-part={`spark${index}core`} d={core} {...attrs[`spark${index}core`]} />
              <path data-part={`spark${index}near`} d={near} {...attrs[`spark${index}near`]} />
              {reach === 2 && <path data-part={`spark${index}far`} d={far} {...attrs[`spark${index}far`]} />}
            </g>
          );
        })}
      </svg>
      {(announce ?? !reduced) && (
        <span className={styles.live} aria-live="polite">
          {text}
        </span>
      )}
    </span>
  );
}

export default PixelMascot;
