"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import styles from "./ghost-mascot.module.css";

export type GhostMascotStatus = "idle" | "listening" | "thinking" | "writing" | "done" | "error";

const STATUS_WORD: Record<GhostMascotStatus, string> = {
  idle: "Idle",
  listening: "Listening",
  thinking: "Thinking",
  writing: "Writing",
  done: "Done",
  error: "Error",
};

interface Pose {
  /** Vertical offset of the body. */
  y: number;
  floatAmp: number;
  floatRate: number;
  lx: number;
  rot: number;
  sway: number;
  scale: number;
  opacity: number;
  hemAmp: number;
  hemRate: number;
  flare: number;
  gx: number;
  gy: number;
  gk: number;
  eyeScale: number;
  spread: number;
  happy: number;
  droop: number;
  blinkable: number;
  glance: number;
  followPen: number;
  swirl: number;
  pen: number;
  star: number;
}

const BASE: Pose = {
  y: 0,
  floatAmp: 3,
  floatRate: 0.3,
  lx: 0,
  rot: 0,
  sway: 1,
  scale: 1,
  opacity: 1,
  hemAmp: 3,
  hemRate: 0.5,
  flare: 2.8,
  gx: 0,
  gy: 0,
  gk: 140,
  eyeScale: 1,
  spread: 1,
  happy: 0,
  droop: 0,
  blinkable: 1,
  glance: 1,
  followPen: 0,
  swirl: 0,
  pen: 0,
  star: 0,
};

const POSES: Record<GhostMascotStatus, Pose> = {
  idle: BASE,
  listening: {
    ...BASE,
    y: 1.5,
    floatAmp: 1.8,
    floatRate: 0.36,
    rot: -4,
    sway: 0.4,
    scale: 1.05,
    hemAmp: 2.1,
    hemRate: 0.7,
    flare: 3,
    gy: 0.12,
    gk: 220,
    eyeScale: 1.2,
    spread: 1.06,
    glance: 0,
    blinkable: 0.7,
  },
  thinking: {
    ...BASE,
    y: -2,
    floatAmp: 3.4,
    floatRate: 0.22,
    rot: 3,
    sway: 1.2,
    opacity: 0.56,
    hemAmp: 3.1,
    hemRate: 0.36,
    flare: 2.2,
    gx: 0.55,
    gy: -1,
    gk: 46,
    eyeScale: 0.96,
    glance: 0,
    blinkable: 0.35,
    swirl: 1,
  },
  writing: {
    ...BASE,
    y: 1,
    floatAmp: 1.5,
    floatRate: 0.38,
    lx: -7,
    rot: 4,
    sway: 0.35,
    hemAmp: 2.3,
    hemRate: 0.85,
    gk: 260,
    glance: 0,
    followPen: 1,
    blinkable: 0.5,
    pen: 1,
  },
  done: {
    ...BASE,
    y: -2.5,
    floatAmp: 2.6,
    floatRate: 0.36,
    rot: -2,
    sway: 0.6,
    hemAmp: 3,
    hemRate: 0.7,
    flare: 3,
    gk: 160,
    spread: 1.04,
    happy: 1,
    glance: 0,
    blinkable: 0,
    star: 1,
  },
  error: {
    ...BASE,
    y: 3.5,
    floatAmp: 1.1,
    floatRate: 0.24,
    sway: 0.3,
    hemAmp: 1.3,
    hemRate: 0.26,
    flare: 1.4,
    gy: 0.55,
    gk: 90,
    eyeScale: 0.96,
    droop: 1,
    glance: 0,
    blinkable: 0.5,
  },
};

interface Geometry {
  compact: boolean;
  view: string;
  eyeRx: number;
  eyeRy: number;
  spread: number;
  markStroke: number;
  lineStroke: number;
  penStroke: number;
  markScale: number;
}

const WIDE: Geometry = {
  compact: false,
  view: "0 0 120 120",
  eyeRx: 3.7,
  eyeRy: 5.3,
  spread: 10,
  markStroke: 2.3,
  lineStroke: 2.3,
  penStroke: 3.3,
  markScale: 1,
};

/** Under 56px the box tightens and every stroke thickens so the face and the pen still read. */
const COMPACT: Geometry = {
  compact: true,
  view: "8 7 104 104",
  eyeRx: 5,
  eyeRy: 6.9,
  spread: 11.6,
  markStroke: 3.8,
  lineStroke: 3.6,
  penStroke: 4.6,
  markScale: 1.2,
};

const TAU = 2 * Math.PI;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (from: number, to: number, k: number) => from + (to - from) * k;
const fmt = (value: number) => (Math.round(100 * value) / 100).toString();
const easeInOutCubic = (value: number) => (value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2);
const wave = (value: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(value));
const easeOutCubic = (value: number) => 1 - (1 - clamp(value)) ** 3;
const smoothstep = (value: number) => value * value * (3 - 2 * value);

/** Two waves beat against each other along the hem, so the cloth ripples instead of pulsing. */
const K_HEM = TAU / 21;
const K_SECOND = TAU / 37;

interface HemCurve {
  amp: number;
  phase: number;
  phase2: number;
  base: number;
  shift: number;
}

/** Hem height at horizontal position `at`. */
const hemAt = (curve: HemCurve, at: number) => {
  const travel = at - 60 - curve.shift;
  return (
    curve.base +
    curve.amp * (0.8 * Math.sin(K_HEM * travel - Math.PI * curve.phase) + 0.2 * Math.sin(K_SECOND * travel + Math.PI * curve.phase2))
  );
};

/** Slope of the hem, so the eight scallops meet it at a tangent instead of a corner. */
const hemSlope = (curve: HemCurve, at: number) => {
  const travel = at - 60 - curve.shift;
  return curve.amp * (0.8 * K_HEM * Math.cos(K_HEM * travel - Math.PI * curve.phase) + 0.2 * K_SECOND * Math.cos(K_SECOND * travel + Math.PI * curve.phase2));
};

/** One eye: a lens whose lids close to a line, lift into an arc when happy, and sag when worried. */
function eyePath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  open: number,
  happy: number,
  droop: number,
  side: -1 | 1,
) {
  const lid = 0.12 + 0.88 * open;
  const belly = lerp((4 / 3) * ry, 1.62 * ry, happy) * lid;
  const back = lerp((4 / 3) * ry, -0.6 * ry, happy) * lid;
  const half = rx * (1 + 0.12 * happy);
  const middle = cy + happy * ry * 0.4 + droop * ry * 0.1;
  const frontDrop = belly * (1 - 0.88 * droop);
  const backDrop = belly * (1 - 0.62 * droop);
  const sag = droop * ry * 0.34;
  const lift = -droop * ry * 0.22;
  const top = middle + (side < 0 ? sag : lift);
  const bottom = middle + (side < 0 ? lift : sag);
  const left = cx - half;
  const right = cx + half;
  return `M${fmt(left)} ${fmt(top)}C${fmt(left)} ${fmt(top - (side < 0 ? frontDrop : backDrop))} ${fmt(right)} ${fmt(bottom - (side < 0 ? backDrop : frontDrop))} ${fmt(right)} ${fmt(bottom)}C${fmt(right)} ${fmt(bottom + back)} ${fmt(left)} ${fmt(top + back)} ${fmt(left)} ${fmt(top)}Z`;
}

/** The thinking swirl: a tapering spiral drawn with round caps, revealed by a dash offset. */
const SPIRAL = (() => {
  const points: string[] = [];
  for (let step = 0; step <= 56; step += 1) {
    const p = step / 56;
    const angle = -Math.PI / 2 + 1.35 * p * TAU;
    const radius = 6.2 - 4.6 * p;
    points.push(`${fmt(Math.cos(angle) * radius)} ${fmt(Math.sin(angle) * radius)}`);
  }
  return `M${points.join("L")}`;
})();

const STAR = "M0 -1C.1 -.28 .28 -.1 1 0C.28 .1 .1 .28 0 1C-.1 .28 -.28 .1 -1 0C-.28 -.1 -.1 -.28 0 -1Z";

/** The two sparks that pop beside the head on `done`. */
const SPARKS = [
  { x: 91, y: 22, r: 6.6, delay: 0 },
  { x: 100.5, y: 35.5, r: 3.3, delay: 0.1 },
];

/** The stroke gaps on the written line, in pen-progress units. */
const STROKE_GAPS = [
  [0, 0.3],
  [0.38, 0.66],
  [0.74, 1],
];

/** The baseline the pen writes on, as a shallow two-frequency wave. */
const baseline = (at: number) => {
  const travel = 29 * at;
  return 107 - (1.5 * Math.sin(1.1 * travel) + 0.45 * Math.sin(2.2 * travel + 1.1));
};

/** How much of the line the pen has already laid down. */
function penSpan(pen: number) {
  const stroke = clamp(pen / 0.62);
  return { head: 0.62 * stroke + 0.38 * wave(stroke), tail: wave((pen - 0.7) / 0.25) };
}

/** Where the pen nib sits for a given progress, including the hop back to the margin. */
function penPoint(pen: number) {
  if (pen < 0.7) {
    const { head } = penSpan(pen);
    let lift = 0;
    for (let index = 0; index < STROKE_GAPS.length - 1; index += 1) {
      const from = STROKE_GAPS[index][1];
      const to = STROKE_GAPS[index + 1][0];
      if (head > from && head < to) lift = 1.8 * Math.sin((Math.PI * (head - from)) / (to - from));
    }
    return { x: 77 + 29 * head, y: baseline(head) - lift, progress: head };
  }
  const back = easeInOutCubic(clamp((pen - 0.7) / 0.30000000000000004));
  return { x: lerp(106, 77, back), y: lerp(baseline(1), baseline(0), back) - 3.4 * Math.sin(Math.PI * back), progress: 1 - back };
}

/** The eyes track the nib while the ghost writes, then drift back to the reader. */
function penGaze(pen: number): [number, number] {
  const point = penPoint(pen);
  return [0.2 + 0.75 * point.progress, 0.88 - (107 - point.y) * 0.05];
}

/** Every animated input the shapes read at one instant. */
interface Anim {
  t: number;
  float: number;
  hem: number;
  hem2: number;
  swirl: number;
  pen: number;
  sinceError: number;
  sinceDone: number;
  gaze: [number, number];
  open: number;
}

const REST_FLOAT = 0;
const REST_HEM = 0.15;
const REST_HEM2 = 0.4;
const REST_SWIRL = 0.5;
const REST_PEN = 0.45;

/** The pose a status settles into, with the eyes already parked where the pen leaves them. */
function stillAnim(status: GhostMascotStatus): Anim {
  const pose = POSES[status];
  const [gx, gy] = penGaze(REST_PEN);
  return {
    t: 0,
    float: REST_FLOAT,
    hem: REST_HEM,
    hem2: REST_HEM2,
    swirl: REST_SWIRL,
    pen: REST_PEN,
    sinceError: 10,
    sinceDone: 10,
    gaze: [pose.gx + (gx - pose.gx) * pose.followPen, pose.gy + (gy - pose.gy) * pose.followPen],
    open: 1,
  };
}

interface Shapes {
  body: string;
  d: string;
  opacity: string;
  eyes: [string, string];
  swirl: { transform: string; dash: string; offset: string; opacity: string };
  stars: { transform: string; opacity: string }[];
  pen: { transform: string; opacity: string };
  line: { d: string; opacity: string };
  ground: { transform: string; opacity: string };
}

/** The sheet silhouette: a rounded head that dissolves into a scalloped hem. */
function sheetPath(curve: HemCurve, flare: number) {
  const right = 88 + flare + 0.6 * curve.shift;
  const left = 32 - flare + 0.6 * curve.shift;
  const rightHem = hemAt(curve, right);
  const leftHem = hemAt(curve, left);
  const innerRight = right - 2.8;
  const innerLeft = left + 2.8;
  let d = `M${fmt(32)} 46C${fmt(32)} ${fmt(30.5356)} ${fmt(44.5356)} 18 60 18C${fmt(75.4644)} 18 ${fmt(88)} ${fmt(30.5356)} ${fmt(88)} 46C${fmt(88)} 61 ${fmt(right)} ${fmt(rightHem - 17)} ${fmt(right)} ${fmt(rightHem - 2.8)}Q${fmt(right)} ${fmt(rightHem)} ${fmt(innerRight)} ${fmt(hemAt(curve, innerRight))}`;
  const span = (innerLeft - innerRight) / 8;
  for (let scallop = 0; scallop < 8; scallop += 1) {
    const from = innerRight + span * scallop;
    const to = from + span;
    const fromHem = hemAt(curve, from);
    const toHem = hemAt(curve, to);
    const handle = span / 3;
    d += `C${fmt(from + handle)} ${fmt(fromHem + hemSlope(curve, from) * handle)} ${fmt(to - handle)} ${fmt(toHem - hemSlope(curve, to) * handle)} ${fmt(to)} ${fmt(toHem)}`;
  }
  d += `Q${fmt(left)} ${fmt(leftHem)} ${fmt(left)} ${fmt(leftHem - 2.8)}C${fmt(left)} ${fmt(leftHem - 17)} ${fmt(32)} 61 ${fmt(32)} 46Z`;
  return d;
}

/** The pen line, drawn only across the stroke gaps the nib has already passed. */
function writtenLine(pen: number) {
  const { head, tail } = penSpan(pen);
  let d = "";
  for (const [start, end] of STROKE_GAPS) {
    const from = Math.max(start, tail);
    const to = Math.min(end, head);
    if (to - from < 0.004) continue;
    const steps = Math.max(1, Math.ceil((to - from) / 0.018));
    for (let step = 0; step <= steps; step += 1) {
      const at = from + (step / steps) * (to - from);
      d += `${step ? "L" : "M"}${fmt(77 + 29 * at)} ${fmt(baseline(at))}`;
    }
  }
  return d || "M0 0";
}

/** Every attribute the loop writes, precomputed as strings. */
function shapesFor(pose: Pose, anim: Anim, geo: Geometry): Shapes {
  const breath = pose.floatAmp / 3;
  const rise = Math.sin(TAU * anim.float);
  const swell = Math.cos(TAU * anim.float);
  const shake =
    anim.sinceError < 0 || anim.sinceError > 1.6
      ? 0
      : (1 - Math.exp(-28 * anim.sinceError)) * Math.exp(-4.2 * anim.sinceError) * Math.sin(2.1 * TAU * anim.sinceError);

  const pen = penPoint(anim.pen);
  const dy = pose.y + pose.floatAmp * rise;
  const dx = pose.lx + 1.6 * shake + (pen.progress - 0.5) * 3 * pose.followPen;
  const rot = pose.rot + 1.3 * Math.sin(TAU * anim.float * 0.5) * pose.sway + 9 * shake;
  const scaleX = pose.scale * (1 + 0.008 * swell * breath);
  const scaleY = pose.scale * (1 - 0.014 * swell * breath);

  const curve: HemCurve = {
    amp: pose.hemAmp,
    phase: anim.hem,
    phase2: anim.hem2,
    base: 90 - 1.5 * swell * breath,
    shift: -(2.6 * shake) + 0.8 * Math.sin(TAU * anim.hem2),
  };
  const flare = pose.flare + 1.1 * swell * breath;

  const body = `translate(${fmt(dx)} ${fmt(dy)}) rotate(${fmt(rot)} 60 58) translate(60 46) scale(${fmt(scaleX)} ${fmt(scaleY)}) translate(-60 -46)`;

  const eyeRx = geo.eyeRx * pose.eyeScale;
  const eyeRy = geo.eyeRy * pose.eyeScale * (1 + (0.06 * (pose.eyeScale - 1)) / 0.2);
  const spread = geo.spread * pose.spread;
  const gazeX = 3.1 * anim.gaze[0];
  const gazeY = 2.7 * anim.gaze[1];
  const eyes: [string, string] = [
    eyePath(60 - spread + gazeX, 50 + gazeY, eyeRx, eyeRy, anim.open, pose.happy, pose.droop, -1),
    eyePath(60 + spread + gazeX, 50 + gazeY, eyeRx, eyeRy, anim.open, pose.happy, pose.droop, 1),
  ];

  const swirlHead = wave(anim.swirl / 0.6);
  const swirlTail = wave((anim.swirl - 0.32) / 0.6);
  const swirlDash = Math.max(0, swirlHead - swirlTail);
  const swirlOpacity = pose.swirl * smoothstep(clamp(swirlDash / 0.06));
  const swirl = {
    transform: `translate(90 21) rotate(${fmt((40 * anim.t) % 360)}) scale(${geo.markScale})`,
    dash: `${fmt(swirlDash + 1e-4)} 3`,
    offset: fmt(-swirlTail),
    opacity: fmt(swirlOpacity),
  };

  const settle = easeOutCubic(anim.sinceDone / 0.34);
  const stars = SPARKS.map((spark, index) => {
    const pop = easeOutCubic((anim.sinceDone - spark.delay) / 0.32);
    const pulse = 1 - 0.1 * (0.5 - 0.5 * Math.cos(TAU * (0.7 * anim.t + 0.4 * index)));
    const size = spark.r * geo.markScale * pop * pulse * (0.55 + 0.45 * pose.star);
    const angle = 12 * Math.sin(TAU * anim.t * 0.2 + index) - (1 - settle) * 30;
    return {
      transform: `translate(${spark.x} ${spark.y}) rotate(${fmt(angle)}) scale(${fmt(Math.max(size, 0.001))})`,
      opacity: fmt(pose.star),
    };
  });

  const lift = (dy - pose.y) / 3.4;

  return {
    body,
    d: sheetPath(curve, flare),
    opacity: fmt(pose.opacity),
    eyes,
    swirl,
    stars,
    pen: { transform: `translate(${fmt(pen.x)} ${fmt(pen.y)})`, opacity: fmt(pose.pen) },
    line: { d: writtenLine(anim.pen), opacity: fmt(pose.pen) },
    ground: {
      transform: `translate(${fmt(60 + 0.8 * dx)} 112) scale(${fmt(1 + 0.05 * lift)} 1)`,
      opacity: fmt((0.86 + 0.14 * lift) * (0.45 + 0.55 * pose.opacity)),
    },
  };
}

/** Linear blend of two poses, used for the 420ms cross-fade between statuses. */
function blendPose(from: Pose, to: Pose, k: number): Pose {
  const next = {} as Pose;
  for (const key of Object.keys(from) as (keyof Pose)[]) next[key] = from[key] + (to[key] - from[key]) * k;
  return next;
}

interface LoopState {
  clock: number;
  current: GhostMascotStatus;
  from: Pose | null;
  transStart: number;
  pose: Pose;
  float: number;
  hem: number;
  hem2: number;
  swirl: number;
  writeAt: number;
  errorAt: number;
  doneAt: number;
  gaze: [number, number];
  velocity: [number, number];
  blinkAt: number;
  blinkStart: number;
  glance: [number, number];
  glanceAt: number;
  autoIndex: number;
  autoAt: number;
  dirty: boolean;
}

export interface GhostMascotProps {
  /** Status to show. Leave it undefined to let the mascot play its own loop and report each state. */
  status?: GhostMascotStatus;
  /** Edge length in px. Under 56 the drawing tightens and the ground shadow drops. Defaults to 96. */
  size?: number;
  /** Colour role: the accent, the ink of the page, the muted sheet, or a custom body colour. */
  tone?: "accent" | "ink" | "sheet";
  /** Explicit body colour. Switches the tone to `custom` and derives the eye colour from it. */
  color?: string;
  /** Explicit eye colour, overriding the tone. */
  eyeColor?: string;
  /** Draws the soft ground shadow. */
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
  onStatusChange?: (status: GhostMascotStatus) => void;
  className?: string;
  style?: CSSProperties;
}

type MascotStyle = CSSProperties & { [key: `--${string}`]: string | number };

const SEQUENCE: [GhostMascotStatus, number][] = [
  ["idle", 2.6],
  ["listening", 2.2],
  ["thinking", 2.6],
  ["writing", 3.6],
  ["done", 2.3],
  ["idle", 1.6],
  ["thinking", 1.7],
  ["error", 2.1],
  ["idle", 1.3],
];

const random = (min: number, max: number) => min + Math.random() * (max - min);

export function GhostMascot({
  status,
  size = 96,
  tone = "accent",
  color,
  eyeColor,
  ground = true,
  paused = false,
  name = "Assistant",
  label,
  announce = false,
  onStatusChange,
  className,
  style,
}: GhostMascotProps) {
  const clipId = `ghost-clip-${useId().replace(/:/g, "")}`;
  const geo = size < 56 ? COMPACT : WIDE;
  const showGround = ground && !geo.compact;

  const [autoStatus, setAutoStatus] = useState<GhostMascotStatus>(SEQUENCE[0][0]);
  const current = status ?? autoStatus;

  const hostRef = useRef<HTMLSpanElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const opacityRef = useRef<SVGGElement>(null);
  const swirlRef = useRef<SVGPathElement>(null);
  const penRef = useRef<SVGGElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const groundRef = useRef<SVGEllipseElement>(null);
  const marks = useRef<{ shapes: SVGElement[]; eyes: SVGElement[]; stars: SVGElement[] }>({
    shapes: [],
    eyes: [],
    stars: [],
  });

  const restShapes = shapesFor(POSES[current], stillAnim(current), geo);

  const latest = useRef({ status, geo, paused, onStatusChange });
  useLayoutEffect(() => {
    latest.current = { status, geo, paused, onStatusChange };
  });

  const state = useRef<LoopState>({
    clock: 0,
    current,
    from: null,
    transStart: 0,
    pose: POSES[current],
    float: REST_FLOAT,
    hem: REST_HEM,
    hem2: REST_HEM2,
    swirl: REST_SWIRL,
    writeAt: -(2.3 * REST_PEN),
    errorAt: -10,
    doneAt: -10,
    gaze: [...stillAnim(current).gaze] as [number, number],
    velocity: [0, 0],
    blinkAt: 2.4,
    blinkStart: -1,
    glance: [0, 0],
    glanceAt: 1.6,
    autoIndex: 0,
    autoAt: SEQUENCE[0][1],
    dirty: true,
  });

  const apply = (next: Shapes) => {
    bodyRef.current?.setAttribute("transform", next.body);
    opacityRef.current?.setAttribute("opacity", next.opacity);
    const { shapes, eyes, stars } = marks.current;
    shapes.forEach((element) => element.setAttribute("d", next.d));
    eyes.forEach((element, index) => element.setAttribute("d", next.eyes[index]));
    const swirl = swirlRef.current;
    if (swirl) {
      swirl.setAttribute("transform", next.swirl.transform);
      swirl.setAttribute("stroke-dasharray", next.swirl.dash);
      swirl.setAttribute("stroke-dashoffset", next.swirl.offset);
      swirl.setAttribute("opacity", next.swirl.opacity);
    }
    stars.forEach((element, index) => {
      element.setAttribute("transform", next.stars[index].transform);
      element.setAttribute("opacity", next.stars[index].opacity);
    });
    penRef.current?.setAttribute("transform", next.pen.transform);
    penRef.current?.setAttribute("opacity", next.pen.opacity);
    lineRef.current?.setAttribute("d", next.line.d);
    lineRef.current?.setAttribute("opacity", next.line.opacity);
    groundRef.current?.setAttribute("transform", next.ground.transform);
    groundRef.current?.setAttribute("opacity", next.ground.opacity);
  };

  const applyRef = useRef(apply);
  useLayoutEffect(() => {
    applyRef.current = apply;
  });

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    marks.current = {
      shapes: Array.from(svg.querySelectorAll("[data-shape]")),
      eyes: Array.from(svg.querySelectorAll("[data-eye]")),
      stars: Array.from(svg.querySelectorAll("[data-star]")),
    };
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

  const startLoop = useRef<() => void>(() => {});

  // The loop is a ref writer: React renders the tree once, then every frame writes SVG attributes
  // straight onto the nodes, so a 60fps ghost never re-renders. It parks off-screen or in a hidden tab.
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

      if (target !== s.current) {
        s.from = reduced ? null : s.pose;
        s.transStart = clock;
        s.current = target;
        if (target === "writing" && s.pose.pen < 0.05) s.writeAt = clock;
        if (target === "done" && s.pose.star < 0.05) s.doneAt = clock;
        if (target === "error") s.errorAt = clock;
        s.dirty = true;
      }

      if (reduced) {
        if (!s.dirty) return;
        s.dirty = false;
        s.pose = POSES[s.current];
        applyRef.current(shapesFor(s.pose, stillAnim(s.current), box));
        return;
      }

      let pose = POSES[s.current];
      if (s.from) {
        const k = easeInOutCubic(clamp((clock - s.transStart) / 0.4));
        if (k >= 1) s.from = null;
        else pose = blendPose(s.from, pose, k);
      }
      s.pose = pose;
      s.float += dt * pose.floatRate;
      s.hem += dt * pose.hemRate;
      s.hem2 += dt * pose.hemRate * 0.43;
      s.swirl += dt / 1.7;

      const pen = (((clock - s.writeAt) / 2.3) % 1 + 1) % 1;

      if (clock >= s.glanceAt) {
        s.glance = 0.35 > Math.random() ? [0, 0] : [random(-0.85, 0.85), random(-0.6, 0.45)];
        s.glanceAt = clock + random(1.2, 3.2);
      }
      if (clock >= s.blinkAt) {
        s.blinkStart = clock;
        s.blinkAt = clock + (0.2 > Math.random() ? 0.32 : random(2.4, 5.2));
      }

      const [penX, penY] = penGaze(pen);
      const targetX = pose.gx + s.glance[0] * pose.glance;
      const targetY = pose.gy + s.glance[1] * pose.glance;
      const aimX = targetX + (penX - targetX) * clamp(pose.followPen);
      const aimY = targetY + (penY - targetY) * clamp(pose.followPen);
      const stiffness = pose.gk;
      const damping = 2 * Math.sqrt(stiffness);
      const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
      const h = dt / steps;
      for (let index = 0; index < steps; index += 1) {
        s.velocity[0] += (stiffness * (aimX - s.gaze[0]) - damping * s.velocity[0]) * h;
        s.velocity[1] += (stiffness * (aimY - s.gaze[1]) - damping * s.velocity[1]) * h;
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
      const open = 1 - blink * clamp(pose.blinkable);

      applyRef.current(
        shapesFor(
          pose,
          {
            t: clock,
            float: s.float,
            hem: s.hem,
            hem2: s.hem2,
            swirl: s.swirl % 1,
            pen,
            sinceError: clock - s.errorAt,
            sinceDone: clock - s.doneAt,
            gaze: s.gaze,
            open,
          },
          box,
        ),
      );
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
    if (status !== undefined) setAutoStatus(status);
  }
  useEffect(() => {
    if (status === undefined) return;
    const s = state.current;
    const index = SEQUENCE.findIndex(([value]) => value === status);
    if (index >= 0) {
      s.autoIndex = index;
      s.autoAt = s.clock + SEQUENCE[index][1];
    }
  }, [status]);

  const accessibleName = label ?? `${name}, ${STATUS_WORD[current].toLowerCase()}`;
  const nib = 0.5 * geo.penStroke;

  const hostStyle: MascotStyle = {
    width: size,
    height: size,
    ...(color ? { "--ghost-body": color } : null),
    ...(eyeColor ? { "--ghost-eye": eyeColor } : null),
    ...style,
  };

  return (
    <span
      ref={hostRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-tone={color ? "custom" : tone}
      data-status={current}
      style={hostStyle}
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
            <path data-shape d={restShapes.d} />
          </clipPath>
        </defs>
        {showGround && (
          <ellipse
            ref={groundRef}
            className={styles.ground}
            cx={0}
            cy={0}
            rx={23}
            ry={3.1}
            transform={restShapes.ground.transform}
            opacity={restShapes.ground.opacity}
          />
        )}
        <path
          ref={lineRef}
          className={styles.line}
          d={restShapes.line.d}
          opacity={restShapes.line.opacity}
          strokeWidth={geo.lineStroke}
        />
        <g ref={bodyRef} transform={restShapes.body}>
          <g ref={opacityRef} opacity={restShapes.opacity}>
            <g clipPath={`url(#${clipId})`}>
              <path data-shape className={styles.shade} d={restShapes.d} />
              <path data-shape className={styles.body} d={restShapes.d} transform="translate(-1.8 -3)" />
            </g>
            {tone === "sheet" && !color && <path data-shape className={styles.outline} d={restShapes.d} />}
          </g>
          <path data-eye className={styles.eye} d={restShapes.eyes[0]} />
          <path data-eye className={styles.eye} d={restShapes.eyes[1]} />
          <path
            ref={swirlRef}
            className={styles.swirl}
            d={SPIRAL}
            pathLength={1}
            strokeWidth={geo.markStroke / geo.markScale}
            transform={restShapes.swirl.transform}
            strokeDasharray={restShapes.swirl.dash}
            strokeDashoffset={restShapes.swirl.offset}
            opacity={restShapes.swirl.opacity}
          />
          <path data-star className={styles.mark} d={STAR} transform={restShapes.stars[0].transform} opacity={restShapes.stars[0].opacity} />
          <path data-star className={styles.mark} d={STAR} transform={restShapes.stars[1].transform} opacity={restShapes.stars[1].opacity} />
        </g>
        <g ref={penRef} className={styles.pen} transform={restShapes.pen.transform} opacity={restShapes.pen.opacity}>
          {geo.compact ? (
            <line x1={0.6} y1={-1.1} x2={4.9} y2={-9} strokeWidth={geo.penStroke} />
          ) : (
            <>
              <line x1={0} y1={0} x2={1.3} y2={-2.4} strokeWidth={nib} />
              <line x1={2.3} y1={-4.1} x2={6.6} y2={-11.9} strokeWidth={geo.penStroke} />
            </>
          )}
        </g>
      </svg>
      {announce && (
        <span className={styles.srOnly} aria-live="polite">
          {accessibleName}
        </span>
      )}
    </span>
  );
}

export default GhostMascot;
