"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import styles from "./cube-mascot.module.css";

export type CubeMascotStatus = "idle" | "thinking" | "writing" | "done" | "error";

const STATUS_WORD: Record<CubeMascotStatus, string> = {
  idle: "ready",
  thinking: "thinking",
  writing: "writing",
  done: "done",
  error: "something went wrong",
};

const ORDER: CubeMascotStatus[] = ["idle", "thinking", "writing", "done", "error"];

/** How long the self-playing loop holds each state, in seconds. */
const HOLD: Record<CubeMascotStatus, number> = {
  idle: 2.4,
  thinking: 2.75,
  writing: 3.2,
  done: 2.3,
  error: 1.7,
};

const TAU = 2 * Math.PI;
const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

/** Smoothstep of `value` between two edges. */
const between = (edge0: number, edge1: number, value: number) => {
  const k = clamp01((value - edge0) / (edge1 - edge0));
  return k * k * (3 - 2 * k);
};

const easeInOut = (value: number) => {
  const k = clamp01(value);
  return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
};

const sin = Math.sin;

interface Pose {
  spin: number;
  yaw: number;
  roll: number;
  pitch: number;
  lift: number;
  shift: number;
  gx: number;
  gy: number;
  open: number;
  blink: number;
  happy: number;
  worry: number;
  mouth: number;
  mouthW: number;
  /** Per-face visibility for the four sides: front, right, back, left. */
  face: number[];
  faceOpen: number[];
  sparkle: number;
  ink: number;
}

const IDLE_POSE: Pose = {
  spin: 0,
  yaw: 0,
  roll: 0,
  pitch: 0,
  lift: 0,
  shift: 0,
  gx: 0,
  gy: 0,
  open: 1,
  blink: 1,
  happy: 0,
  worry: 0,
  mouth: 0.35,
  mouthW: 0.7,
  face: [1, 0, 0, 0],
  faceOpen: [1, 1, 1, 1],
  sparkle: 0,
  ink: 0,
};

/** Pose for `status` at `elapsed` seconds into the state, with `clock` driving the idle drift. */
function poseFor(status: CubeMascotStatus, elapsed: number, clock: number): Pose {
  const pose: Pose = { ...IDLE_POSE, face: [...IDLE_POSE.face], faceOpen: [...IDLE_POSE.faceOpen] };

  if (status === "idle") {
    pose.yaw = 4.5 * sin((TAU * clock) / 7.3);
    pose.roll = 2.6 * sin((TAU * clock) / 5.3 + 0.6);
    pose.pitch = 1.8 * sin((TAU * clock) / 6.1 + 1.9);
    pose.lift = 0.045 * sin((TAU * clock) / 3.6);
    pose.gx = 0.16 * sin((TAU * clock) / 8.9 + 0.3) + 0.06 * sin((TAU * clock) / 3.7);
    pose.gy = 0.07 * sin((TAU * clock) / 6.3 + 1);
    return pose;
  }

  if (status === "thinking") {
    const local = elapsed % 1.3;
    const turn = local < 0.5 ? 0 : easeInOut((local - 0.5) / 0.8);
    const swing = sin(Math.PI * turn);
    pose.spin = turn;
    pose.roll = -2.5 * swing;
    pose.pitch = -2.5;
    pose.lift = 0.02 + 0.06 * swing;
    pose.gx = 0.22 - 0.44 * swing;
    pose.gy = -0.32 + 0.12 * swing;
    pose.open = 0.95;
    pose.blink = 0;
    pose.mouth = 0.05;
    pose.mouthW = 0.4;
    /** The face hands over to the panel that swings into view as the cube spins. */
    pose.face = [1, between(0.5, 0.85, turn), 0, 0];
    pose.faceOpen = [1, 0.12 + 0.88 * between(0.68, 1, turn), 1, 1];
    return pose;
  }

  if (status === "writing") {
    const sweep = (TAU * elapsed) / 1.44;
    pose.yaw = 2 * sin((TAU * clock) / 6.7);
    pose.roll = 1.2 * sin((TAU * clock) / 4.9);
    pose.pitch = 5 + sin(sweep);
    pose.lift = 0.03 * sin((TAU * clock) / 3.6);
    pose.gx = 0.2 * sin(sweep);
    pose.gy = 0.42;
    pose.open = 0.8;
    pose.mouth = 0.1;
    pose.mouthW = 0.45;
    pose.ink = 1;
    return pose;
  }

  if (status === "done") {
    const pop = sin(Math.PI * clamp01(elapsed / 0.6)) ** 2;
    pose.lift = -0.05 * pop + 0.015 * sin((TAU * clock) / 4.2);
    pose.pitch = 3 * pop;
    pose.roll = -1.5;
    pose.gy = -0.05;
    pose.blink = 0;
    pose.happy = 1;
    pose.mouth = 1;
    pose.mouthW = 1;
    pose.sparkle = 1 - (1 - clamp01((elapsed - 0.08) / 0.45)) ** 3;
    return pose;
  }

  const shake = clamp01(elapsed / 0.56);
  const decay = (1 - shake) * (1 - shake);
  const wobble = sin(3.5 * TAU * shake);
  pose.shift = 0.1 * decay * wobble;
  pose.yaw = 7 * decay * wobble;
  pose.roll = -2.5;
  pose.pitch = 2;
  pose.gy = 0.15;
  pose.open = 0.72;
  pose.worry = 1;
  pose.mouth = -0.8;
  pose.mouthW = 0.55;
  return pose;
}

const lerp = (from: number, to: number, k: number) => from + (to - from) * k;
const lerpQuad = (from: number[], to: number[], k: number) => [
  lerp(from[0], to[0], k),
  lerp(from[1], to[1], k),
  lerp(from[2], to[2], k),
  lerp(from[3], to[3], k),
];

/** Blink cycle lengths — the uneven spacing keeps the blinking from looking like a metronome. */
const BLINK_STEPS = [3.1, 4.4, 0.34, 3.7, 2.6, 4.9];
const BLINK_TOTAL = BLINK_STEPS.reduce((sum, step) => sum + step, 0);

/** Deterministic hash, so the written lines keep their lengths across frames. */
function noise(seed: number) {
  const raw = 43758.5453 * sin(127.1 * seed + 311.7);
  return raw - Math.floor(raw);
}

interface Geometry {
  S: number;
  cx: number;
  cy: number;
  radius: number;
  eyeX: number;
  eyeY: number;
  eyeW: number;
  eyeH: number;
  gazeX: number;
  gazeY: number;
  stroke: number;
  mouthY: number;
  mouth: boolean;
  ground: boolean;
  spark: [number, number, number];
  spark2: [number, number, number] | null;
}

/** Under 56px the cube grows in the frame, the mouth drops out and every stroke thickens. */
function geometryFor(compact: boolean, ground: boolean): Geometry {
  if (compact) {
    return {
      S: 28,
      cx: 50,
      cy: 51,
      radius: 8.4,
      eyeX: 16,
      eyeY: -4,
      eyeW: 14,
      eyeH: 24,
      gazeX: 6,
      gazeY: 6,
      stroke: 6,
      mouthY: 14,
      mouth: false,
      ground: false,
      spark: [83.6, 51 - 38.080000000000005, 10.64],
      spark2: null,
    };
  }
  const cy = ground ? 47.6 : 50;
  return {
    S: 24,
    cx: 50,
    cy,
    radius: 6.24,
    eyeX: 14,
    eyeY: -8,
    eyeW: 10,
    eyeH: 17,
    gazeX: 8,
    gazeY: 7,
    stroke: 3.4,
    mouthY: 12,
    mouth: true,
    ground,
    spark: [82.4, cy - 36, 10.08],
    spark2: [95.12, cy - 23.52, 4.5600000000000005],
  };
}

const DEG = Math.PI / 180;
const TILT = 32 * DEG;
const TILT_COS = Math.cos(TILT);
const TILT_SIN = Math.sin(TILT);
const YAW_ZERO = -30 * DEG;
/** How far the key light sits from the top-front edge; drives the per-face shade mix. */
const LIGHT = 0.225 + -0.866 * TILT_SIN * 0.75 + 0.866 * TILT_COS * 0.48;

interface Axes {
  cy: number;
  sy: number;
  cr: number;
  sr: number;
  cp: number;
  sp: number;
}

const axes = (yaw: number, roll: number, pitch: number): Axes => ({
  cy: Math.cos(yaw),
  sy: Math.sin(yaw),
  cr: Math.cos(roll),
  sr: Math.sin(roll),
  cp: Math.cos(pitch),
  sp: Math.sin(pitch),
});

/** Rotates a point onto the screen and writes it into `out` as [x, y, depth]. */
function project(space: Axes, x: number, y: number, z: number, out: number[]) {
  const yawed = x * space.cy + z * space.sy;
  const yawedDepth = -x * space.sy + z * space.cy;
  const rolled = yawed * space.cr - y * space.sr;
  const rolledDepth = yawed * space.sr + y * space.cr;
  const depthA = rolledDepth * space.cp - yawedDepth * space.sp;
  const depthB = rolledDepth * space.sp + yawedDepth * space.cp;
  out[0] = rolled;
  out[1] = depthA * TILT_COS - depthB * TILT_SIN;
  out[2] = depthA * TILT_SIN + depthB * TILT_COS;
}

const fmt = (value: number) => (Math.round(100 * value) / 100).toString();

const setAttribute = (element: Element | null, name: string, value: string) => {
  if (element && element.getAttribute(name) !== value) element.setAttribute(name, value);
};

const setVisible = (element: Element | null, visible: boolean) => setAttribute(element, "display", visible ? "inline" : "none");

/** The five cube faces: four sides in yaw order, then the lid. Each carries its own basis. */
const FACES = [0, 1, 2, 3, 4].map(function (index) {
  if (index === 4) return { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] };
  const angle = (index * Math.PI) / 2;
  const s = Math.round(Math.sin(angle));
  const c = Math.round(Math.cos(angle));
  return { n: [s, 0, c], u: [c, 0, -s], v: [0, 1, 0] };
});

/** Quad corners in face-local space. */
const CORNERS: [number, number][] = [
  [-1, 1],
  [1, 1],
  [1, -1],
  [-1, -1],
];

const cross = (origin: number[], a: number[], b: number[]) =>
  (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0]);

/** A closed polygon whose corners are rounded by `radius`. */
function roundedPolygon(points: number[][], radius: number) {
  const count = points.length;
  let path = "";
  for (let index = 0; index < count; index += 1) {
    const previous = points[(index + count - 1) % count];
    const point = points[index];
    const next = points[(index + 1) % count];
    const ax = previous[0] - point[0];
    const ay = previous[1] - point[1];
    const bx = next[0] - point[0];
    const by = next[1] - point[1];
    const aLen = Math.hypot(ax, ay) || 1;
    const bLen = Math.hypot(bx, by) || 1;
    const cut = Math.min(
      radius / Math.tan(Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (aLen * bLen)))) / 2 || 1e-6),
      aLen / 2,
      bLen / 2,
    );
    path += `${index ? "L" : "M"}${fmt(point[0] + (ax / aLen) * cut)} ${fmt(point[1] + (ay / aLen) * cut)}Q${fmt(point[0])} ${fmt(point[1])} ${fmt(point[0] + (bx / bLen) * cut)} ${fmt(point[1] + (by / bLen) * cut)}`;
  }
  return path + "Z";
}

/** Convex hull, so the silhouette is a clean rounded square whatever the rotation. */
function hull(points: number[][]) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lower: number[][] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && 1e-6 >= cross(lower[lower.length - 2], lower[lower.length - 1], point)) lower.pop();
    lower.push(point);
  }
  const upper: number[][] = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    while (upper.length >= 2 && 1e-6 >= cross(upper[upper.length - 2], upper[upper.length - 1], point)) upper.pop();
    upper.push(point);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

interface ShapeRefs {
  clip: SVGPathElement | null;
  under: SVGPathElement | null;
  fills: SVGPathElement[];
  shadow: SVGPathElement | null;
  feats: {
    g: SVGGElement;
    eyes: SVGRectElement[];
    arcs: SVGPathElement[];
    brows: SVGPathElement[];
    mouth: SVGPathElement | null;
  }[];
  lines: SVGPathElement[];
  spark: SVGGElement | null;
  spark2: SVGGElement | null;
}

const shadeFor = (light: number) => {
  const mix = Math.round(Math.min(100, (Math.abs(light) / 0.63) * 100));
  if (mix === 0) return "var(--cube-front)";
  return `color-mix(in oklab, var(--cube-front), var(${light > 0 ? "--cube-top" : "--cube-side"}) ${mix}%)`;
};

/** How far into the current blink we are, 0 when the eyes are open. */
function blinkAmount(clock: number) {
  let rest = (((clock - 1.2) % BLINK_TOTAL) + BLINK_TOTAL) % BLINK_TOTAL;
  for (const step of BLINK_STEPS) {
    if (rest < 0.17) return sin((Math.PI * rest) / 0.17) ** 2;
    rest -= step;
    if (rest < 0) break;
  }
  return 0;
}

/**
 * Draws one frame: the cube silhouette, five shaded faces, the face projected onto whichever sides
 * face the camera, the ground shadow, the written lines, and the two sparks.
 */
function draw(shapes: ShapeRefs, geo: Geometry, pose: Pose, clock: number, inkClock: number | null) {
  const yaw = YAW_ZERO + pose.yaw * DEG - (pose.spin * Math.PI) / 2;
  const space = axes(yaw, pose.roll * DEG, pose.pitch * DEG);
  const scale = geo.S;
  const originX = geo.cx + scale * pose.shift;
  const originY = geo.cy - scale * pose.lift;
  const point = [0, 0, 0];

  const toX = (value: number) => originX + scale * value;
  const toY = (value: number) => originY - scale * value;

  const corners: number[][] = [];
  for (let corner = 0; corner < 8; corner += 1) {
    project(space, corner & 1 ? 1 : -1, corner & 2 ? 1 : -1, corner & 4 ? 1 : -1, point);
    corners.push([toX(point[0]), toY(point[1])]);
  }
  const silhouette = roundedPolygon(hull(corners), geo.radius);
  setAttribute(shapes.clip, "d", silhouette);
  setAttribute(shapes.under, "d", silhouette);

  const depth: number[] = [];
  for (let index = 0; index < 5; index += 1) {
    const face = FACES[index];
    project(space, face.n[0], face.n[1], face.n[2], point);
    depth[index] = point[2];
    const fill = shapes.fills[index];
    if (point[2] <= 0) {
      setVisible(fill, false);
      continue;
    }
    const light = -0.45 * point[0] + 0.75 * point[1] + 0.48 * point[2] - LIGHT;
    let path = "";
    CORNERS.forEach(([u, v], corner) => {
      project(
        space,
        face.n[0] + u * face.u[0] + v * face.v[0],
        face.n[1] + u * face.u[1] + v * face.v[1],
        face.n[2] + u * face.u[2] + v * face.v[2],
        point,
      );
      path += `${corner ? "L" : "M"}${fmt(toX(point[0]))} ${fmt(toY(point[1]))}`;
    });
    setAttribute(fill, "d", `${path}Z`);
    setVisible(fill, true);
    const shade = shadeFor(light);
    if (fill.dataset.tone !== shade) {
      fill.dataset.tone = shade;
      fill.style.fill = shade;
    }
  }

  const blink = pose.blink > 0 ? pose.blink * blinkAmount(clock) : 0;

  for (let index = 0; index < 4; index += 1) {
    const feat = shapes.feats[index];
    const visibility = pose.face[index] * between(0.08, 0.4, depth[index]);
    if (visibility < 0.005) {
      setVisible(feat.g, false);
      continue;
    }
    const face = FACES[index];
    const axisU = [0, 0, 0];
    const axisV = [0, 0, 0];
    const axisN = [0, 0, 0];
    project(space, face.u[0], face.u[1], face.u[2], axisU);
    project(space, face.v[0], face.v[1], face.v[2], axisV);
    project(space, face.n[0], face.n[1], face.n[2], axisN);
    const k = scale / 50;
    setVisible(feat.g, true);
    setAttribute(feat.g, "opacity", fmt(visibility));
    setAttribute(
      feat.g,
      "transform",
      `matrix(${[k * axisU[0], -k * axisU[1], -k * axisV[0], k * axisV[1], toX(axisN[0]), toY(axisN[1])].map((value) => value.toFixed(4)).join(" ")})`,
    );

    const gazeX = pose.gx * geo.gazeX;
    const gazeY = pose.gy * geo.gazeY;
    const lid = pose.open * (1 - blink) * pose.faceOpen[index] * (1 - pose.happy);
    const eyeHeight = Math.max(0.3 * geo.eyeW, geo.eyeH * lid);
    const eyeOpacity = fmt(1 - between(0.55, 0.95, pose.happy));
    const arcOpacity = fmt(between(0.35, 0.85, pose.happy));
    const arcLift = (0.3 + 0.7 * pose.happy) * geo.eyeW * 0.8;
    const arcSpan = 0.66 * geo.eyeW;

    [-1, 1].forEach((side, eye) => {
      const x = side * geo.eyeX + gazeX;
      const y = geo.eyeY + gazeY;
      const rect = feat.eyes[eye];
      setAttribute(rect, "x", fmt(x - geo.eyeW / 2));
      setAttribute(rect, "y", fmt(y - eyeHeight / 2));
      setAttribute(rect, "width", fmt(geo.eyeW));
      setAttribute(rect, "height", fmt(eyeHeight));
      setAttribute(rect, "rx", fmt(geo.eyeW / 2));
      setAttribute(rect, "opacity", eyeOpacity);
      setAttribute(
        feat.arcs[eye],
        "d",
        `M${fmt(x - arcSpan)} ${fmt(y + 0.45 * arcLift)}Q${fmt(x)} ${fmt(y - 1.1 * arcLift)} ${fmt(x + arcSpan)} ${fmt(y + 0.45 * arcLift)}`,
      );
      setAttribute(feat.arcs[eye], "opacity", arcOpacity);
      setAttribute(feat.arcs[eye], "stroke-width", fmt(1.15 * geo.stroke));
      const browY = geo.eyeY - geo.eyeH / 2 - 0.5 * geo.eyeW + 0.6 * gazeY;
      const inner = side * (geo.eyeX - 0.7 * geo.eyeW) + gazeX;
      const outer = side * (geo.eyeX + 0.7 * geo.eyeW) + gazeX;
      setAttribute(feat.brows[eye], "d", `M${fmt(outer)} ${fmt(browY + 2 * pose.worry)}L${fmt(inner)} ${fmt(browY - 3.5 * pose.worry)}`);
      setAttribute(feat.brows[eye], "opacity", fmt(pose.worry));
      setAttribute(feat.brows[eye], "stroke-width", fmt(geo.stroke));
    });

    setVisible(feat.mouth, geo.mouth);
    if (geo.mouth && feat.mouth) {
      const halfWidth = 1.5 + 5.5 * pose.mouthW;
      const middle = geo.mouthY + 0.5 * gazeY;
      const bend = 5.5 * pose.mouth;
      const centre = 0.5 * gazeX;
      setAttribute(
        feat.mouth,
        "d",
        `M${fmt(centre - halfWidth)} ${fmt(middle - 0.3 * bend)}Q${fmt(centre)} ${fmt(middle + bend)} ${fmt(centre + halfWidth)} ${fmt(middle - 0.3 * bend)}`,
      );
      setAttribute(feat.mouth, "stroke-width", fmt(geo.stroke));
    }
  }

  const flat = axes(yaw, 0, 0);
  const shadowY = (value: number) => geo.cy - scale * value;
  setVisible(shapes.shadow, geo.ground);
  if (geo.ground) {
    const outline = CORNERS.map(([u, v]) => {
      project(flat, 1.08 * u, -1.06, 1.08 * v, point);
      return [geo.cx + scale * pose.shift + scale * point[0], shadowY(point[1])];
    });
    setAttribute(shapes.shadow, "d", roundedPolygon(outline, geo.radius));
    setAttribute(shapes.shadow, "opacity", fmt(Math.max(0.4, 1 - 6 * Math.max(0, pose.lift))));
  }

  const top = FACES[0];
  for (let index = 0; index < 4; index += 1) {
    const line = shapes.lines[index];
    const stroke = inkClock === null ? -1 : Math.floor(inkClock / 0.36) - index;
    if (!geo.ground || inkClock === null || pose.ink < 0.005 || stroke < 0) {
      setVisible(line, false);
      continue;
    }
    const progress = (inkClock - 0.36 * stroke) / 1.44;
    const opacity = pose.ink * between(0, 0.18, progress) * (1 - between(0.62, 1, progress));
    const along = 1.34 + 0.92 * progress;
    const length = stroke % 5 === 4 ? 0.45 + 0.35 * noise(stroke) : 1.05 + 0.4 * noise(stroke);
    let path = "";
    [-0.74, -0.74 + length].forEach((offset, end) => {
      project(flat, top.n[0] * along + top.u[0] * offset, -1.06, top.n[2] * along + top.u[2] * offset, point);
      path += `${end ? "L" : "M"}${fmt(geo.cx + scale * point[0])} ${fmt(shadowY(point[1]))}`;
    });
    setAttribute(line, "d", path);
    setAttribute(line, "opacity", fmt(opacity));
    setVisible(line, opacity > 0.005);
  }

  const sparks: [SVGGElement | null, [number, number, number] | null, number][] = [
    [shapes.spark, geo.spark, pose.sparkle],
    [shapes.spark2, geo.spark2, Math.max(0, (pose.sparkle - 0.3) / 0.7)],
  ];
  sparks.forEach(([element, spark, strength], index) => {
    if (!element || !spark || strength < 0.005) {
      setVisible(element, false);
      return;
    }
    const pulse = 1 + 0.07 * strength * sin((TAU * clock) / 2.4 + 1.7 * index);
    setVisible(element, true);
    setAttribute(element, "opacity", fmt(Math.min(1, 1.6 * strength)));
    setAttribute(
      element,
      "transform",
      `translate(${fmt(spark[0])} ${fmt(spark[1])}) rotate(${fmt(-60 * (1 - strength))}) scale(${(strength * pulse).toFixed(3)})`,
    );
    const size = spark[2];
    const notch = 0.16 * size;
    setAttribute(
      element.firstElementChild,
      "d",
      `M0 ${fmt(-size)}Q${fmt(notch)} ${fmt(-notch)} ${fmt(size)} 0Q${fmt(notch)} ${fmt(notch)} 0 ${fmt(size)}Q${fmt(-notch)} ${fmt(notch)} ${fmt(-size)} 0Q${fmt(-notch)} ${fmt(-notch)} 0 ${fmt(-size)}Z`,
    );
  });
}

function blendPose(from: Pose, to: Pose, k: number): Pose {
  const mixed = {} as Pose;
  for (const key of Object.keys(to) as (keyof Pose)[]) {
    if (key === "face" || key === "faceOpen") continue;
    (mixed[key] as number) = lerp(from[key] as number, to[key] as number, k);
  }
  mixed.face = lerpQuad(from.face, to.face, k);
  mixed.faceOpen = lerpQuad(from.faceOpen, to.faceOpen, k);
  return mixed;
}

/** When the cube has spun halfway, the face it shows is the next one around. */
function rotateFace(pose: Pose): Pose {
  if (pose.spin <= 0.35) return { ...pose, face: [...pose.face], faceOpen: [...pose.faceOpen] };
  const shift = (values: number[]) => [values[1], values[2], values[3], values[0]];
  return { ...pose, spin: pose.spin - 1, face: shift(pose.face), faceOpen: shift(pose.faceOpen) };
}

interface Engine {
  setStatus: (status: CubeMascotStatus) => void;
  setOptions: (options: { compact: boolean; ground: boolean; paused: boolean; auto: boolean }) => void;
  destroy: () => void;
}

export interface CubeMascotProps {
  /** Status to show. Leave it undefined to let the cube play its own loop and report each state. */
  status?: CubeMascotStatus;
  /** Edge length in px. Under 56 the cube grows in the frame and the mouth drops out. Defaults to 96. */
  size?: number;
  /** Explicit body colour. */
  color?: string;
  /** Explicit ink (eyes and strokes) colour. */
  faceColor?: string;
  /** Draws the ground shadow and the written lines. */
  ground?: boolean;
  /** Freezes the loop on the current frame. */
  paused?: boolean;
  /** Used in the accessible name: `${name}, ${statusWord}`. */
  name?: string;
  /** Replaces the whole accessible name. */
  label?: string;
  /** Adds a polite live region so screen readers hear each status change. */
  announce?: boolean;
  /** Fires whenever the self-playing loop moves to a new status. */
  onStatusChange?: (status: CubeMascotStatus) => void;
  className?: string;
  style?: CSSProperties;
}

type HostStyle = CSSProperties & { [key: `--${string}`]: string | number };

export function CubeMascot({
  status,
  size = 96,
  color,
  faceColor,
  ground = true,
  paused = false,
  name = "Assistant",
  label,
  announce = false,
  onStatusChange,
  className,
  style,
}: CubeMascotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const clipId = `cube-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const engine = useRef<Engine | null>(null);
  const [autoStatus, setAutoStatus] = useState<CubeMascotStatus>("idle");
  const notify = useRef(onStatusChange);
  useEffect(() => {
    notify.current = onStatusChange;
  }, [onStatusChange]);

  const [seen, setSeen] = useState(status);
  if (status !== seen) {
    setSeen(status);
    if (status === undefined && seen !== undefined) setAutoStatus(seen);
  }

  const auto = status === undefined;
  const current = status ?? autoStatus;
  const compact = size < 56;
  const initial = useRef(current);

  // The renderer owns the SVG: one rAF loop writes attributes straight onto the nodes, so a
  // spinning cube never re-renders. It parks off-screen, in a hidden tab, or under reduced motion,
  // where it falls back to a single still frame per state change.
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const pick = (selector: string, scope: Element = svg) => Array.from(scope.querySelectorAll(selector));
    const shapes: ShapeRefs = {
      clip: svg.querySelector("[data-clip]"),
      under: svg.querySelector("[data-under]"),
      fills: pick("[data-fill]") as SVGPathElement[],
      shadow: svg.querySelector("[data-shadow]"),
      feats: pick("[data-feat]").map((group) => ({
        g: group as SVGGElement,
        eyes: pick("[data-eye]", group) as SVGRectElement[],
        arcs: pick("[data-arc]", group) as SVGPathElement[],
        brows: pick("[data-brow]", group) as SVGPathElement[],
        mouth: group.querySelector("[data-mouth]"),
      })),
      lines: pick("[data-line]") as SVGPathElement[],
      spark: svg.querySelector("[data-spark]"),
      spark2: svg.querySelector("[data-spark2]"),
    };

    const setStatus = (next: CubeMascotStatus) => {
      setAutoStatus(next);
      notify.current?.(next);
    };

    let geo = geometryFor(false, true);
    let status: CubeMascotStatus = initial.current;
    let clock = 0;
    let statusAt = 0;
    let transitionAt = -Infinity;
    let transitionTime = 0.42;
    let inkAt: number | null = status === "writing" ? 0 : null;
    let pose = poseFor(status, 0, 0);
    let from = pose;
    let paused = false;
    let autoPlay = false;
    let visible = true;
    let shown = typeof document === "undefined" || !document.hidden;
    let reduced = false;
    let frame = 0;
    let previous = 0;
    let advanced = false;
    let timer = 0;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced = motionQuery.matches;

    const shouldAnimate = () => !paused && visible && shown && !reduced;

    const render = () => {
      if (reduced) {
        pose = poseFor(status, status === "thinking" ? 0.2 : 2 * (status === "done" || status === "error" ? 1 : 0), 0);
        draw(shapes, geo, pose, 0, status === "writing" ? 0.9000000000000001 : null);
        return;
      }
      const target = poseFor(status, clock - statusAt, clock);
      const k = (clock - transitionAt) / transitionTime;
      pose = k < 1 ? blendPose(from, target, easeInOut(k)) : target;
      draw(shapes, geo, pose, clock, inkAt === null ? null : clock - inkAt);
    };

    const tick = (now: number) => {
      const dt = previous ? Math.min(0.05, (now - previous) / 1000) : 0;
      previous = now;
      clock += dt;
      if (autoPlay && !advanced && clock - statusAt > HOLD[status]) {
        advanced = true;
        setStatus(ORDER[(ORDER.indexOf(status) + 1) % ORDER.length]);
      }
      render();
      frame = requestAnimationFrame(tick);
    };

    const sync = () => {
      const running = shouldAnimate();
      if (running && !frame) {
        previous = 0;
        frame = requestAnimationFrame(tick);
      }
      if (!running && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      if (!running) render();
    };

    const syncTimer = () => {
      window.clearTimeout(timer);
      if (reduced && autoPlay && !paused && visible && shown) {
        timer = window.setTimeout(() => setStatus(ORDER[(ORDER.indexOf(status) + 1) % ORDER.length]), 1000 * HOLD[status]);
      }
    };

    const onMotionChange = () => {
      reduced = motionQuery.matches;
      sync();
      syncTimer();
    };
    motionQuery.addEventListener("change", onMotionChange);

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
        syncTimer();
      },
      { rootMargin: "48px" },
    );
    observer.observe(svg);

    const onVisibility = () => {
      shown = !document.hidden;
      sync();
      syncTimer();
    };
    document.addEventListener("visibilitychange", onVisibility);

    render();

    const controller: Engine = {
      setStatus(next) {
        if (next === status) return;
        from = rotateFace(pose);
        if (next === "writing" && (inkAt === null || pose.ink < 0.05)) inkAt = clock;
        status = next;
        statusAt = clock;
        advanced = false;
        transitionTime = next === "error" ? 0.24 : 0.42;
        transitionAt = shouldAnimate() ? clock : -Infinity;
        if (!shouldAnimate()) render();
        syncTimer();
      },
      setOptions({ compact: isCompact, ground: hasGround, paused: isPaused, auto: isAuto }) {
        geo = geometryFor(isCompact, hasGround);
        paused = isPaused;
        autoPlay = isAuto;
        sync();
        syncTimer();
      },
      destroy() {
        cancelAnimationFrame(frame);
        window.clearTimeout(timer);
        motionQuery.removeEventListener("change", onMotionChange);
        observer.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
      },
    };
    engine.current = controller;

    return () => {
      controller.destroy();
      engine.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    engine.current?.setOptions({ compact, ground, paused, auto });
  }, [compact, ground, paused, auto]);

  useLayoutEffect(() => {
    engine.current?.setStatus(current);
  }, [current]);

  const accessibleName = label ?? `${name}, ${STATUS_WORD[current]}`;
  const hostStyle: HostStyle = {
    width: size,
    height: size,
    ...(color ? { "--cube-body": color } : null),
    ...(faceColor ? { "--cube-ink": faceColor } : null),
    ...style,
  };

  return (
    <span className={[styles.root, className].filter(Boolean).join(" ")} style={hostStyle} data-status={current}>
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox="0 0 100 100"
        width={size}
        height={size}
        role="img"
        aria-label={accessibleName}
      >
        <defs>
          <clipPath id={clipId}>
            <path data-clip />
          </clipPath>
        </defs>
        <path data-shadow className={styles.shadow} display="none" />
        <g clipPath={`url(#${clipId})`}>
          <path data-under className={styles.under} />
          {[0, 1, 2, 3, 4].map((face) => (
            <path key={face} data-fill={face} className={styles.fill} display="none" />
          ))}
          {[0, 1, 2, 3].map((face) => (
            <g key={face} data-feat={face} display="none">
              <rect data-eye className={styles.eye} />
              <rect data-eye className={styles.eye} />
              <path data-arc className={styles.stroke} />
              <path data-arc className={styles.stroke} />
              <path data-brow className={styles.stroke} />
              <path data-brow className={styles.stroke} />
              <path data-mouth className={styles.stroke} />
            </g>
          ))}
        </g>
        {[0, 1, 2, 3].map((line) => (
          <path key={line} data-line className={styles.line} display="none" />
        ))}
        <g data-spark display="none">
          <path className={styles.spark} />
        </g>
        <g data-spark2 display="none">
          <path className={styles.spark} />
        </g>
      </svg>
      {announce && (
        <span className={styles.live} role="status" aria-live="polite">
          {accessibleName}
        </span>
      )}
    </span>
  );
}

export default CubeMascot;
