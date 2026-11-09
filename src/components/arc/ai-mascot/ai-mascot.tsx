"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import styles from "./ai-mascot.module.css";

export type AiMascotStatus = "idle" | "listening" | "thinking" | "writing" | "done" | "error";

const STATUSES: AiMascotStatus[] = ["idle", "listening", "thinking", "writing", "done", "error"];

const STATUS_WORD: Record<AiMascotStatus, string> = {
  idle: "Ready",
  listening: "Listening",
  thinking: "Thinking",
  writing: "Writing",
  done: "Done",
  error: "Something went wrong",
};

/** The self-playing order and how long each state holds, in seconds. */
const SEQUENCE: [AiMascotStatus, number][] = [
  ["idle", 2.6],
  ["listening", 2.3],
  ["thinking", 2.6],
  ["writing", 3.5],
  ["done", 2.3],
  ["idle", 1.8],
  ["thinking", 1.7],
  ["error", 2],
  ["idle", 1.4],
];

interface Geometry {
  compact: boolean;
  view: string;
  eyeW: number;
  eyeL: number;
  gazeX: number;
  gazeY: number;
  dotR: number;
  starS: number;
  orbit: { cx: number; cy: number; rx: number; ry: number };
  home: [number, number];
  listen: [number, number];
  done: [number, number];
  err: [number, number];
  x0: number;
  x1: number;
  ly: number;
}

/** Full-size stage: the drawing box has room for the shadow, the dashed baseline and the companion dot. */
const WIDE: Geometry = {
  compact: false,
  view: "4 8 112 112",
  eyeW: 8,
  eyeL: 8,
  gazeX: 8,
  gazeY: 6,
  dotR: 4.5,
  starS: 1,
  orbit: { cx: 60, cy: 25, rx: 46, ry: 9 },
  home: [94, 24],
  listen: [91, 20],
  done: [95, 23],
  err: [93, 32],
  x0: 36,
  x1: 84,
  ly: 115,
};

/** Under 56px the framing tightens, the shadow and baseline drop, and features grow so the face still reads. */
const COMPACT: Geometry = {
  compact: true,
  view: "18 16 84 84",
  eyeW: 10.5,
  eyeL: 6.5,
  gazeX: 6.5,
  gazeY: 4.5,
  dotR: 7,
  starS: 1.4,
  orbit: { cx: 60, cy: 26, rx: 35, ry: 6.5 },
  home: [92, 26],
  listen: [90, 24],
  done: [90, 27],
  err: [91, 31],
  x0: 38,
  x1: 82,
  ly: 111,
};

const TAU = 2 * Math.PI;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const easeInOutCubic = (value: number) =>
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;

interface Pose {
  bx: number;
  by: number;
  brot: number;
  bsx: number;
  bsy: number;
  gx: number;
  gy: number;
  gk: number;
  pointer: number;
  eyeS: number;
  happy: number;
  worry: number;
  blinkable: number;
  dx: number;
  dy: number;
  dr: number;
  dop: number;
  back: number;
  star: number;
  srot: number;
  star2: number;
  lx: number;
  lop: number;
}

interface PoseInput {
  /** Absolute clock. Drives the breathing, sway and blink-adjacent wobble. */
  t: number;
  /** Seconds since the current status started. Drives orbit, writing stroke and the done pulse. */
  te: number;
  geo: Geometry;
  glance: [number, number];
  still: boolean;
}

/** The pose for one status at one instant. `still` pins the reduced-motion frame. */
function poseFor(status: AiMascotStatus, { t, te, geo, glance, still }: PoseInput): Pose {
  const s = still ? 0 : Math.sin((TAU * t) / 3.6);
  const o = still ? 0 : Math.sin((TAU * t) / 7.2);
  const l = still ? 0 : Math.sin((TAU * t) / 4.8);
  const base: Pose = {
    bx: 0,
    by: -1.3 * s,
    brot: 0.8 * o,
    bsx: 1 - 0.012 * s,
    bsy: 1 + 0.018 * s,
    gx: 0,
    gy: 0,
    gk: 260,
    pointer: 1,
    eyeS: 1,
    happy: 0,
    worry: 0,
    blinkable: 1,
    dx: geo.home[0] + 1.2 * l,
    dy: geo.home[1] + 1.8 * Math.sin((TAU * t) / 3.6 + 1.1) * (still ? 0 : 1),
    dr: 1,
    dop: 1,
    back: 0,
    star: 0,
    srot: 0,
    star2: 0,
    lx: geo.x0,
    lop: 0,
  };

  switch (status) {
    case "idle":
      return { ...base, gx: glance[0] * geo.gazeX, gy: glance[1] * geo.gazeY, gk: 900 };
    case "listening": {
      const level = still
        ? 0.4
        : 0.5 + 0.5 * (0.55 * Math.sin(7.1 * t) + 0.3 * Math.sin(11.3 * t + 1.3) + 0.15 * Math.sin(3.7 * t));
      return {
        ...base,
        by: -1 - (still ? 0 : 0.55 * Math.sin((TAU * t) / 1.7)),
        brot: 0,
        bsx: 1.03 - 0.008 * s,
        bsy: 1.04 + 0.012 * s,
        gx: 0,
        gy: 0.08 * geo.gazeY,
        gk: 220,
        eyeS: 1.16,
        dx: geo.listen[0],
        dy: geo.listen[1],
        dr: 0.92 + 0.3 * level,
      };
    }
    case "thinking": {
      const { cx, cy, rx, ry } = geo.orbit;
      const angle = still ? 0.7 * Math.PI : -0.5 + (TAU / 2.4) * te;
      const orbitY = Math.sin(angle);
      const orbitX = cx + rx * Math.cos(angle);
      return {
        ...base,
        by: -1 - 0.8 * s,
        brot: 3 + (still ? 0 : 0.6 * Math.sin((TAU * t) / 4)),
        gx: ((orbitX - cx) / rx) * geo.gazeX * 0.55,
        gy: -geo.gazeY + 0.8 * orbitY,
        gk: 70,
        pointer: 0,
        dx: orbitX,
        dy: cy + ry * orbitY,
        dr: 0.84 + 0.16 * orbitY,
        dop: 0.8 + (0.2 * (orbitY + 1)) / 2,
        back: clamp(0.5 - 4 * orbitY),
      };
    }
    case "writing": {
      let x: number;
      let y: number;
      let lineEnd: number;
      let progress: number;
      const cycle = still ? 0.804 : te % 1.75;
      if (cycle < 1.34) {
        const p = cycle / 1.34;
        const eased = -(Math.cos(Math.PI * p) - 1) / 2 + 0.012 * Math.sin(4 * TAU * p);
        x = geo.x0 + (geo.x1 - geo.x0) * eased;
        y = geo.ly + 0.5 * Math.sin(7 * TAU * p);
        lineEnd = x;
        progress = clamp((x - geo.x0) / 4);
      } else {
        const p = (cycle - 1.34) / (1.75 - 1.34);
        x = geo.x1 + (geo.x0 - geo.x1) * easeInOutCubic(p);
        y = geo.ly - 7 * Math.sin(Math.PI * p);
        lineEnd = geo.x1;
        progress = 1 - (1 - (1 - p) * (1 - p));
      }
      const small = geo.compact;
      return {
        ...base,
        by: -0.6 * s + (still ? 0 : 0.7 * Math.sin((TAU * te) / 0.875)),
        brot: (x - 60) * 0.045,
        gx: ((x - 60) / ((geo.x1 - geo.x0) / 2)) * geo.gazeX * 0.5,
        gy: 0.75 * geo.gazeY,
        gk: 520,
        pointer: 0,
        dx: x,
        dy: y,
        dop: small ? 0 : 1,
        dr: small ? 0.6 : 1,
        lx: small ? geo.x0 : lineEnd,
        lop: small ? 0 : progress,
      };
    }
    case "done":
      return {
        ...base,
        by: -1.5 - 1.1 * s,
        bsy: 1.015 + 0.016 * s,
        gx: 0,
        gy: -0.25 * geo.gazeY,
        gk: 160,
        eyeS: 1.04,
        happy: 1,
        blinkable: 0,
        dx: geo.done[0],
        dy: geo.done[1],
        dr: 1 + (still ? 0 : 0.07 * Math.sin((TAU * t) / 2.2)),
        star: 1,
        srot: still ? 0 : 10 * Math.sin((TAU * t) / 3.2),
        star2: geo.compact ? 0 : 1,
      };
    case "error":
      return {
        ...base,
        by: 1 - 0.5 * s,
        brot: 0,
        bsx: 1.01 - 0.006 * s,
        bsy: 0.985 + 0.01 * s,
        gx: 0,
        gy: 0.42 * geo.gazeY,
        gk: 220,
        pointer: 0.6,
        eyeS: 0.86,
        worry: 1,
        dx: geo.err[0],
        dy: geo.err[1],
        dop: 0.55,
        dr: 0.85,
      };
  }
}

const BODY_PATH = "M60 28C84 28 96 44 96 64C96 84 82 96 60 96C38 96 24 84 24 64C24 44 36 28 60 28Z";
const SPARK_PATH =
  "M0 -7C.9 -1.6 1.6 -.9 7 0C1.6 .9 .9 1.6 0 7C-.9 1.6 -1.6 .9 -7 0C-1.6 -.9 -.9 -1.6 0 -7Z";

/** Two decimals with trailing zeros dropped, so `transform` strings stay short and stable. */
const num = (value: number) => (Math.round(100 * value) / 100).toString();

interface MascotAttrs {
  body: string;
  pill: [string, string];
  arc: [string, string];
  arcOpacity: string;
  brows: string;
  browOpacity: string;
  dotFront: { cx: string; cy: string; r: string; opacity: string; on: string };
  dotBack: { cx: string; cy: string; r: string; opacity: string };
  star: string;
  starOpacity: string;
  star2: string;
  star2Opacity: string;
  line: { x2: string; opacity: string };
  shadow: string;
}

/** Every attribute the loop touches, precomputed as strings. `blink` closes the eye to a line. */
function attrsFor(pose: Pose, gaze: [number, number], blink: number, geo: Geometry): MascotAttrs {
  const { bx, by, brot, bsx, bsy } = pose;
  const body = `translate(${num(bx)} ${num(by)}) translate(60 96) rotate(${num(brot)}) scale(${num(bsx)} ${num(bsy)}) translate(-60 -96)`;

  const happy = clamp(pose.happy);
  const eyeY = Math.max(0.06, blink * clamp(1 - 2 * happy)) * pose.eyeS;
  const arcY = clamp(2 * happy - 1);
  const pill = [0, 1].map((side) => {
    const x = 47 + 26 * side + gaze[0] + (side === 0 ? -1 : 1) * (pose.eyeS - 1) * 3;
    const y = 60 + gaze[1];
    return `translate(${num(x)} ${num(y)}) scale(${num(pose.eyeS)} ${num(eyeY)})`;
  }) as [string, string];
  const arc = [0, 1].map((side) => {
    const x = 47 + 26 * side + 0.4 * gaze[0];
    const y = 59 + 0.4 * gaze[1];
    return `translate(${num(x)} ${num(y)}) scale(${num(pose.eyeS)} ${num(Math.max(0.06, arcY))})`;
  }) as [string, string];

  const worry = clamp(pose.worry);
  const brows = `translate(${num(0.5 * gaze[0])} ${num(0.4 * gaze[1] + (1 - worry) * 3)})`;
  const dotR = geo.dotR * pose.dr * clamp(1 - pose.star);
  const back = clamp(pose.back);
  const opacity = clamp(pose.dop);
  // The glint shows only while the companion dot sits on the lit side of the face.
  const glint = clamp(
    (1.1 - (((pose.dx - 60) / 36) ** 2 + ((pose.dy - 62 - by) / 34) ** 2)) / 0.3,
  );
  const starScale = geo.starS * pose.dr * clamp(pose.star);
  const star = `translate(${num(pose.dx)} ${num(pose.dy)}) rotate(${num(pose.srot)}) scale(${num(Math.max(0.001, starScale))})`;
  const star2 = clamp(pose.star2);
  const star2Transform = `translate(${num(pose.dx + 11)} ${num(pose.dy + 15)}) rotate(${num(-(1.4 * pose.srot))}) scale(${num(Math.max(0.001, 0.5 * star2 * (2 - pose.dr)))})`;
  const shadow = `translate(60 104) scale(${num((1 - 0.018 * -by) * bsx)} 1)`;

  return {
    body,
    pill,
    arc,
    arcOpacity: num(clamp((happy - 0.45) / 0.15)),
    brows,
    browOpacity: num(worry),
    dotFront: {
      cx: num(pose.dx),
      cy: num(pose.dy),
      r: num(dotR),
      opacity: num(opacity * (1 - back)),
      on: num(glint * opacity * (1 - back)),
    },
    dotBack: { cx: num(pose.dx), cy: num(pose.dy), r: num(dotR), opacity: num(opacity * back) },
    star,
    starOpacity: num(clamp(4 * pose.star) * opacity),
    star2: star2Transform,
    star2Opacity: num(clamp(3 * star2)),
    line: { x2: num(Math.max(geo.x0, pose.lx)), opacity: num(clamp(pose.lop) * clamp((pose.lx - geo.x0) / 4)) },
    shadow,
  };
}

/** Linear blend of two poses, used for the 420ms cross-fade between statuses. */
function blendPose(from: Pose, to: Pose, k: number): Pose {
  const next = {} as Pose;
  for (const key of Object.keys(from) as (keyof Pose)[]) next[key] = from[key] + (to[key] - from[key]) * k;
  return next;
}

interface Transition {
  kind: "live" | "snap";
  status?: AiMascotStatus;
  start?: number;
  pose?: Pose;
}

interface LoopState {
  clock: number;
  current: { status: AiMascotStatus; start: number };
  from: Transition | null;
  transStart: number;
  pose: Pose;
  gaze: [number, number];
  velocity: [number, number];
  blinkAt: number;
  blinkStart: number;
  glance: [number, number];
  glanceAt: number;
  autoIndex: number;
  autoAt: number;
  pointer: { active: boolean; gx: number; gy: number; weight: number };
  dirty: boolean;
}

export interface AiMascotProps {
  /** Status to show. Leave it undefined to let the mascot play its own loop and report each state. */
  status?: AiMascotStatus;
  /** Edge length in px. Under 56 the drawing tightens and the ground shadow drops. Defaults to 96. */
  size?: number;
  /** Colour role for the body: the accent, the ink of the page, or the muted surface. */
  tone?: "accent" | "ink" | "soft";
  /** Explicit body colour. Switches the tone to `custom` and derives the eye colour from it. */
  color?: string;
  /** Explicit eye colour, overriding the tone. */
  eyeColor?: string;
  /** Whether the eyes follow the pointer. `"page"` tracks the pointer anywhere on the page. */
  followPointer?: boolean | "page";
  /** Draws the companion dot that orbits the mascot. */
  companion?: boolean;
  /** Draws the soft ground shadow and the dashed baseline. */
  ground?: boolean;
  /** Freezes the loop on the current frame. */
  paused?: boolean;
  /** Used in the accessible name: `${name}, ${status}`. */
  name?: string;
  /** Replaces the whole accessible name. */
  label?: string;
  /** Adds a polite live region so screen readers hear each status change. */
  announce?: boolean;
  /** Fires whenever the self-playing loop moves to a new status. */
  onStatusChange?: (status: AiMascotStatus) => void;
  className?: string;
  style?: CSSProperties;
}

type MascotStyle = CSSProperties & { [key: `--${string}`]: string | number };

export function AiMascot({
  status,
  size = 96,
  tone = "accent",
  color,
  eyeColor,
  followPointer = true,
  companion = true,
  ground = true,
  paused = false,
  name = "Assistant",
  label,
  announce = false,
  onStatusChange,
  className,
  style,
}: AiMascotProps) {
  const clipId = `mascot-${useId().replace(/:/g, "")}`;
  const geo = size < 56 ? COMPACT : WIDE;
  const showGround = ground && !geo.compact;

  const [autoStatus, setAutoStatus] = useState<AiMascotStatus>(SEQUENCE[0][0]);
  const current = status ?? autoStatus;

  const hostRef = useRef<HTMLSpanElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const pillRefs = [useRef<SVGGElement>(null), useRef<SVGGElement>(null)];
  const arcRefs = [useRef<SVGGElement>(null), useRef<SVGGElement>(null)];
  const browsRef = useRef<SVGGElement>(null);
  const dotFrontRef = useRef<SVGCircleElement>(null);
  const glintRef = useRef<SVGCircleElement>(null);
  const dotBackRef = useRef<SVGCircleElement>(null);
  const starRef = useRef<SVGPathElement>(null);
  const star2Ref = useRef<SVGPathElement>(null);
  const lineRef = useRef<SVGLineElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);

  const stillPose = poseFor(current, { t: 0, te: 10, geo, glance: [0, 0], still: true });
  const stillAttrs = attrsFor(stillPose, [stillPose.gx, stillPose.gy], 1, geo);

  const latest = useRef({ status, geo, paused, onStatusChange, followPointer });
  useLayoutEffect(() => {
    latest.current = { status, geo, paused, onStatusChange, followPointer };
  });

  const startLoop = useRef<() => void>(() => {});
  const state = useRef<LoopState>({
    clock: 0,
    current: { status: current, start: -10 },
    from: { kind: "snap", pose: stillPose },
    transStart: 0,
    pose: stillPose,
    gaze: [stillPose.gx, stillPose.gy],
    velocity: [0, 0],
    blinkAt: 2.2,
    blinkStart: -1,
    glance: [0, 0],
    glanceAt: 1.4,
    autoIndex: 0,
    autoAt: SEQUENCE[0][1],
    pointer: { active: false, gx: 0, gy: 0, weight: 0 },
    dirty: true,
  });

  const apply = (next: MascotAttrs) => {
    bodyRef.current?.setAttribute("transform", next.body);
    pillRefs.forEach((ref, i) => ref.current?.setAttribute("transform", next.pill[i]));
    arcRefs.forEach((ref, i) => {
      ref.current?.setAttribute("transform", next.arc[i]);
      ref.current?.setAttribute("opacity", next.arcOpacity);
    });
    browsRef.current?.setAttribute("transform", next.brows);
    browsRef.current?.setAttribute("opacity", next.browOpacity);

    const front = dotFrontRef.current;
    if (front) {
      front.setAttribute("cx", next.dotFront.cx);
      front.setAttribute("cy", next.dotFront.cy);
      front.setAttribute("r", next.dotFront.r);
      front.setAttribute("opacity", next.dotFront.opacity);
    }
    const glint = glintRef.current;
    if (glint) {
      glint.setAttribute("cx", next.dotFront.cx);
      glint.setAttribute("cy", next.dotFront.cy);
      glint.setAttribute("r", next.dotFront.r);
      glint.setAttribute("opacity", next.dotFront.on);
    }
    const back = dotBackRef.current;
    if (back) {
      back.setAttribute("cx", next.dotBack.cx);
      back.setAttribute("cy", next.dotBack.cy);
      back.setAttribute("r", next.dotBack.r);
      back.setAttribute("opacity", next.dotBack.opacity);
    }
    starRef.current?.setAttribute("transform", next.star);
    starRef.current?.setAttribute("opacity", next.starOpacity);
    star2Ref.current?.setAttribute("transform", next.star2);
    star2Ref.current?.setAttribute("opacity", next.star2Opacity);
    lineRef.current?.setAttribute("x2", next.line.x2);
    lineRef.current?.setAttribute("opacity", next.line.opacity);
    shadowRef.current?.setAttribute("transform", next.shadow);
  };

  const applyRef = useRef(apply);
  useLayoutEffect(() => {
    applyRef.current = apply;
  });

  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useLayoutEffect(() => {
    state.current.dirty = true;
  }, [geo]);

  // The loop is a ref writer: React renders the tree once, then every frame writes SVG attributes
  // directly so a 60fps mascot never re-renders. It parks when off-screen or in a hidden tab.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const s = state.current;
    let frame = 0;
    let previous = 0;
    let onScreen = true;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = previous ? Math.min(now - previous, 50) / 1000 : 0;
      previous = now;
      s.clock += dt;

      const clock = s.clock;
      const { geo: box, status: wanted } = latest.current;

      if (wanted === undefined && clock >= s.autoAt) {
        s.autoIndex = (s.autoIndex + 1) % SEQUENCE.length;
        const [nextStatus, hold] = SEQUENCE[s.autoIndex];
        s.autoAt = clock + hold;
        setAutoStatus(nextStatus);
        latest.current.onStatusChange?.(nextStatus);
      }
      const target = wanted ?? SEQUENCE[s.autoIndex][0];

      if (target !== s.current.status) {
        const midFade = s.from !== null && clock - s.transStart < 0.42;
        s.from = reduced
          ? null
          : midFade && s.pose
            ? { kind: "snap", pose: s.pose }
            : { kind: "live", status: s.current.status, start: s.current.start };
        s.transStart = clock;
        s.current = { status: target, start: clock };
        s.dirty = true;
      }

      if (reduced) {
        if (!s.dirty) return;
        s.dirty = false;
        const still = poseFor(s.current.status, { t: clock, te: 10, geo: box, glance: [0, 0], still: true });
        s.pose = still;
        s.gaze = [still.gx, still.gy];
        applyRef.current(attrsFor(still, s.gaze, 1, box));
        return;
      }

      if (clock >= s.glanceAt) {
        s.glance = 0.35 > Math.random() ? [0, 0] : [random(-0.9, 0.9), random(-0.75, 0.55)];
        s.glanceAt = clock + random(1.1, 3.2);
      }
      if (clock >= s.blinkAt) {
        s.blinkStart = clock;
        s.blinkAt = clock + (0.2 > Math.random() ? 0.3 : random(2.4, 5.2));
      }

      const input: PoseInput = { t: clock, te: clock - s.current.start, geo: box, glance: s.glance, still: false };
      let pose = poseFor(s.current.status, input);

      if (s.from) {
        const k = easeInOutCubic(clamp((clock - s.transStart) / 0.42));
        if (k >= 1) s.from = null;
        else {
          const fromPose =
            s.from.kind === "live" && s.from.status !== undefined
              ? poseFor(s.from.status, { ...input, te: clock - (s.from.start ?? 0) })
              : (s.from.pose as Pose);
          pose = blendPose(fromPose, pose, k);
        }
      }

      if (s.current.status === "error") {
        const e = clock - s.current.start - 0.06;
        const shake = e <= 0 || e > 1 ? 0 : 3.2 * Math.exp(-(6 * e)) * Math.sin(e * TAU * 5.5);
        pose = { ...pose, bx: pose.bx + shake, brot: pose.brot + 0.5 * shake };
      }

      s.pose = pose;

      // Eyes on a critically damped spring, so a glance or a state change lands without overshoot.
      const pointer = s.pointer;
      pointer.weight += ((pointer.active ? 1 : 0) - pointer.weight) * (1 - Math.exp(-(10 * dt)));
      const pull = pointer.weight * clamp(pose.pointer);
      const targetX = pose.gx + (pointer.gx * box.gazeX - pose.gx) * pull;
      const targetY = pose.gy + (pointer.gy * box.gazeY - pose.gy) * pull;
      const stiffness = pose.gk;
      const damping = 2 * Math.sqrt(stiffness);
      const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
      const h = dt / steps;
      for (let i = 0; i < steps; i += 1) {
        s.velocity[0] += (stiffness * (targetX - s.gaze[0]) - damping * s.velocity[0]) * h;
        s.velocity[1] += (stiffness * (targetY - s.gaze[1]) - damping * s.velocity[1]) * h;
        s.gaze[0] += s.velocity[0] * h;
        s.gaze[1] += s.velocity[1] * h;
      }

      const blinkAge = clock - s.blinkStart;
      let blink = 0;
      if (blinkAge >= 0 && blinkAge < 0.16) {
        blink =
          blinkAge < 0.06
            ? Math.sin(((blinkAge / 0.06) * Math.PI) / 2)
            : Math.cos((((blinkAge - 0.06) / 0.1) * Math.PI) / 2);
      }
      const lid = 1 - blink * clamp(pose.blinkable);

      applyRef.current(attrsFor(pose, s.gaze, lid, box));
    };

    const run = () => {
      const shouldRun = onScreen && !latest.current.paused && document.visibilityState === "visible";
      if (shouldRun && !frame) {
        previous = 0;
        frame = requestAnimationFrame(tick);
      } else if (!shouldRun && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        run();
      },
      { rootMargin: "48px" },
    );
    observer.observe(host);
    document.addEventListener("visibilitychange", run);
    startLoop.current = run;
    run();

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", run);
      cancelAnimationFrame(frame);
      frame = 0;
      startLoop.current = () => {};
    };
  }, [reduced]);

  useEffect(() => {
    startLoop.current();
  }, [paused]);

  // A changed status prop resyncs the self-playing order, so a later unpause continues from there.
  const [seenStatus, setSeenStatus] = useState(status);
  if (status !== seenStatus) {
    setSeenStatus(status);
    if (status !== undefined && STATUSES.includes(status)) setAutoStatus(status);
  }
  const hadStatus = useRef(status !== undefined);
  useEffect(() => {
    const s = state.current;
    const resumed = status === undefined && hadStatus.current;
    hadStatus.current = status !== undefined;
    if (status === undefined) {
      if (resumed) s.autoAt = s.clock + Math.min(1.2, SEQUENCE[s.autoIndex][1]);
      return;
    }
    const index = SEQUENCE.findIndex(([value]) => value === status);
    if (index >= 0) {
      s.autoIndex = index;
      s.autoAt = s.clock + SEQUENCE[index][1];
    }
  }, [status]);

  const trackPointer = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const [vx, vy, vw] = latest.current.geo.view.split(" ").map(Number);
    const centreX = rect.left + ((60 - vx) / vw) * rect.width;
    const centreY = rect.top + ((62 - vy) / vw) * rect.height;
    const reach = 0.7 * Math.max(rect.width, 40);
    const dx = (clientX - centreX) / reach;
    const dy = (clientY - centreY) / reach;
    const pointer = state.current.pointer;
    pointer.gx = clamp((dx / Math.sqrt(1 + dx * dx)) * 1.3, -1, 1);
    pointer.gy = clamp((dy / Math.sqrt(1 + dy * dy)) * 1.3, -1, 1);
    pointer.active = true;
  };

  useEffect(() => {
    if (followPointer !== "page" || reduced) return;
    const pointer = state.current.pointer;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "touch") trackPointer(event.clientX, event.clientY);
    };
    const onLeave = () => {
      pointer.active = false;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      pointer.active = false;
    };
  }, [followPointer, reduced]);

  const follows = followPointer === true && !reduced;
  const accessibleName = label ?? `${name}, ${STATUS_WORD[current].toLowerCase()}`;
  const eyeStroke = geo.eyeW;
  const arcStroke = geo.compact ? 5.4 : 4;
  const browStroke = geo.compact ? 4.4 : 3.2;

  const hostStyle: MascotStyle = {
    width: size,
    height: size,
    ...(color ? { "--mascot-body": color } : null),
    ...(eyeColor ? { "--mascot-eye": eyeColor } : null),
    ...style,
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (follows && event.pointerType !== "touch") trackPointer(event.clientX, event.clientY);
  };
  const onPointerLeave = () => {
    if (followPointer !== "page") state.current.pointer.active = false;
  };

  return (
    <span
      ref={hostRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-tone={color ? "custom" : tone}
      data-status={current}
      style={hostStyle}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={geo.view}
        width={size}
        height={size}
        role="img"
        aria-label={accessibleName}
        focusable="false"
      >
        <defs>
          <clipPath id={clipId}>
            <path d={BODY_PATH} />
          </clipPath>
        </defs>
        {showGround && (
          <ellipse ref={shadowRef} className={styles.ground} cx={0} cy={0} rx={29} ry={3.2} transform={stillAttrs.shadow} />
        )}
        {showGround && companion && (
          <line
            ref={lineRef}
            className={styles.line}
            x1={geo.x0}
            y1={geo.ly}
            x2={stillAttrs.line.x2}
            y2={geo.ly}
            strokeWidth={2.6}
            strokeDasharray="9 5.5 4.5 5.5 12 5.5 6 5.5 10 5.5"
            opacity={stillAttrs.line.opacity}
          />
        )}
        {companion && (
          <circle
            ref={dotBackRef}
            className={styles.dot}
            cx={stillAttrs.dotBack.cx}
            cy={stillAttrs.dotBack.cy}
            r={stillAttrs.dotBack.r}
            opacity={stillAttrs.dotBack.opacity}
          />
        )}
        <g ref={bodyRef} transform={stillAttrs.body}>
          <g clipPath={`url(#${clipId})`}>
            <path className={styles.shade} d={BODY_PATH} />
            <path className={styles.body} d={BODY_PATH} transform="translate(-2.5 -4)" />
          </g>
          {tone === "soft" && !color && <path className={styles.outline} d={BODY_PATH} />}
          <g className={styles.eyes}>
            {[0, 1].map((side) => (
              <g key={`pill-${side}`} ref={pillRefs[side]} transform={stillAttrs.pill[side]}>
                <line x1={0} y1={-geo.eyeL / 2} x2={0} y2={geo.eyeL / 2} strokeWidth={eyeStroke} />
              </g>
            ))}
            {[0, 1].map((side) => (
              <g
                key={`arc-${side}`}
                ref={arcRefs[side]}
                transform={stillAttrs.arc[side]}
                opacity={stillAttrs.arcOpacity}
              >
                <path d="M-6.5 2.5Q0 -5.5 6.5 2.5" strokeWidth={arcStroke} fill="none" />
              </g>
            ))}
            <g ref={browsRef} transform={stillAttrs.brows} opacity={stillAttrs.browOpacity}>
              <line x1={40.5} y1={46.5} x2={52} y2={43} strokeWidth={browStroke} />
              <line x1={68} y1={43} x2={79.5} y2={46.5} strokeWidth={browStroke} />
            </g>
          </g>
        </g>
        {companion && (
          <>
            <g opacity={1}>
              <circle
                ref={dotFrontRef}
                className={styles.dot}
                cx={stillAttrs.dotFront.cx}
                cy={stillAttrs.dotFront.cy}
                r={stillAttrs.dotFront.r}
                opacity={stillAttrs.dotFront.opacity}
              />
              <circle
                ref={glintRef}
                className={styles.glint}
                cx={stillAttrs.dotFront.cx}
                cy={stillAttrs.dotFront.cy}
                r={stillAttrs.dotFront.r}
                opacity={stillAttrs.dotFront.on}
              />
            </g>
            <path
              ref={starRef}
              className={styles.dot}
              d={SPARK_PATH}
              transform={stillAttrs.star}
              opacity={stillAttrs.starOpacity}
            />
            {!geo.compact && (
              <path
                ref={star2Ref}
                className={styles.dot}
                d={SPARK_PATH}
                transform={stillAttrs.star2}
                opacity={stillAttrs.star2Opacity}
              />
            )}
          </>
        )}
      </svg>
      {announce && (
        <span className={styles.srOnly} aria-live="polite">
          {accessibleName}
        </span>
      )}
    </span>
  );
}

function random(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export default AiMascot;
