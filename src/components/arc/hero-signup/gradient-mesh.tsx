"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";

import styles from "./gradient-mesh.module.css";

/* -------------------------------------------------------------------------------------------------
 * Inlined from the shared `gradient-mesh` registry component. Only the background mode is needed
 * here: no handles, no controls, just the drifting WebGL field with a CSS fallback that is painted
 * on the first frame and then kept in sync while the canvas is unavailable.
 * ---------------------------------------------------------------------------------------------- */

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

const STOPS = [0, 0.2, 0.4, 0.6, 0.8, 1];

const DEFAULT_POINTS: MeshPoint[] = [
  { id: "p0", color: "#1b2150", x: 0.1, y: 0.92, spread: 0.78 },
  { id: "p1", color: "#5b6cff", x: 0.86, y: 0.16, spread: 0.72 },
  { id: "p2", color: "#ff5f3a", x: 0.2, y: 0.2, spread: 0.62 },
  { id: "p3", color: "#ffb259", x: 0.6, y: 0.64, spread: 0.5 },
  { id: "p4", color: "#f59ac0", x: 0.94, y: 0.9, spread: 0.46 },
];

const FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform vec3 uBase;
uniform vec4 uP[12];
uniform vec3 uC[12];
uniform int uN;
uniform float uGrain;
uniform float uScale;
float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main() {
  vec2 uv = vec2(gl_FragCoord.x / uRes.x, 1.0 - gl_FragCoord.y / uRes.y);
  vec3 col = uBase;
  for (int i = 0; i < 12; i++) {
    if (i >= uN) break;
    vec4 p = uP[i];
    float d = length((uv - p.xy) / max(p.z, 1e-4));
    col = mix(col, uC[i], 1.0 - smoothstep(0.0, 1.0, d));
  }
  vec2 g = floor(gl_FragCoord.xy / uScale);
  float n = hash(g) + hash(g + 19.19) - 1.0;
  float lum = dot(col, vec3(.2126, .7152, .0722));
  col += n * (uGrain * .1 * (.55 + .9 * lum * (1.0 - lum) * 2.0) + .6 / 255.0);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export interface MeshPoint {
  id?: string;
  color: string;
  x: number;
  y: number;
  spread?: number;
}

export interface GradientMeshProps {
  /** Base colour behind every point. */
  base?: string;
  /** Coloured pools of light. Positions and spreads are 0–1. */
  points?: MeshPoint[];
  /** Film grain, 0–1. */
  grain?: number;
  /** Whether the field drifts. */
  animate?: boolean;
  /** Drift multiplier. */
  speed?: number;
  /** How many points to render, 2–8. */
  maxPoints?: number;
  className?: string;
  style?: CSSProperties;
}

type Vec3 = [number, number, number];

interface LivePoint {
  id: string;
  ax: number;
  ay: number;
  ar: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vr: number;
  w: number;
  vw: number;
  col: Vec3;
  tcol: Vec3;
  removing: boolean;
  ph1: number;
  ph2: number;
  k1: number;
  k2: number;
}

interface Renderer {
  gl: WebGLRenderingContext;
  u: Record<string, WebGLUniformLocation | null>;
  p: Float32Array;
  c: Float32Array;
}

interface Sim {
  pts: LivePoint[];
  base: Vec3;
  tbase: Vec3;
  grain: number;
  tgrain: number;
  t: number;
  drift: number;
  vdrift: number;
  driftOn: boolean;
  paused: boolean;
  speed: number;
  reduced: boolean;
  visible: boolean;
  running: boolean;
  frame: number;
  last: number;
  W: number;
  H: number;
  dpr: number;
  gl: Renderer | null;
  canvas: HTMLCanvasElement | null;
  fallback: HTMLDivElement | null;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const percent = (value: number) => `${+(100 * value).toFixed(1)}%`;

function normalizeHex(value: string) {
  const hex = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(hex)) return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(hex)) return hex.slice(0, 7);
  return "#888888";
}

function parseHex(value: string): Vec3 {
  const hex = normalizeHex(value);
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function toHex(color: Vec3) {
  return `#${color
    .map(channel =>
      Math.round(255 * channel)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** FNV-1a, so every point drifts on its own phase without any per-frame randomness. */
function hashOf(id: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x1000193);
  }
  const value = hash >>> 0;
  return {
    ph1: (value % 628) / 100,
    ph2: ((value >>> 10) % 628) / 100,
    k1: 1 + ((value >>> 20) % 2),
    k2: 1 + ((value >>> 22) % 2),
  };
}

function driftOf(point: LivePoint, time: number) {
  const angle = (2 * Math.PI * time) / 20;
  return {
    dx: 0.075 * Math.sin(angle * point.k1 + point.ph1),
    dy: 0.075 * Math.cos(angle * point.k2 + point.ph2),
    s: 1 + 0.08 * Math.sin(angle + 0.7 * point.ph1),
  };
}

/** Damped spring, substepped so a dropped frame cannot blow up. */
function spring(position: number, velocity: number, target: number, stiffness: number, dt: number) {
  const steps = Math.max(1, Math.ceil(240 * dt));
  const step = dt / steps;
  let x = position;
  let v = velocity;
  for (let i = 0; i < steps; i++) {
    v += (stiffness * stiffness * (target - x) - 2 * stiffness * v) * step;
    x += v * step;
  }
  return Math.abs(target - x) < 0.0001 && Math.abs(v) < 0.001 ? ([target, 0] as const) : ([x, v] as const);
}

function lerpColor(color: Vec3, target: Vec3, amount: number) {
  let moved = false;
  for (let i = 0; i < 3; i++) {
    const delta = target[i] - color[i];
    if (Math.abs(delta) < 0.001) color[i] = target[i];
    else {
      color[i] += delta * amount;
      moved = true;
    }
  }
  return moved;
}

function radialGradient(color: string, x: string, y: string, radius: string) {
  const stops = STOPS.map(stop => {
    const alpha = 1 - stop * stop * (3 - 2 * stop);
    return `${normalizeHex(color)}${Math.round(255 * clamp(alpha, 0, 1))
      .toString(16)
      .padStart(2, "0")} ${Math.round(100 * stop)}%`;
  }).join(", ");
  return `radial-gradient(ellipse ${radius} ${radius} at ${x} ${y}, ${stops})`;
}

function grainLayer(grain: number) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(#g)' opacity='${+(0.8 * grain).toFixed(2)}'/></svg>`;
  return `url("data:image/svg+xml,${svg.replace(/</g, "%3C").replace(/>/g, "%3E").replace(/#/g, "%23")}")`;
}

/** The CSS equivalent of the shader, painted before WebGL is ready and whenever it is not. */
function cssField(base: string, points: { color: string; x: number; y: number; r: number }[], grain: number) {
  const gradients = [...points]
    .reverse()
    .map(point => radialGradient(point.color, percent(point.x), percent(point.y), percent(point.r)));
  const layers = grain > 0.005 ? [grainLayer(grain), ...gradients] : gradients;
  return {
    backgroundColor: normalizeHex(base),
    backgroundImage: layers.join(", "),
    backgroundBlendMode:
      grain > 0.005 ? ["overlay", ...gradients.map(() => "normal")].join(", ") : undefined,
  } satisfies CSSProperties;
}

function createRenderer(canvas: HTMLCanvasElement): Renderer | null {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
  });
  if (!gl) return null;

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };

  const vertex = compile(gl.VERTEX_SHADER, "attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }");
  const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;

  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const attribute = gl.getAttribLocation(program, "a");
  gl.enableVertexAttribArray(attribute);
  gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);

  const u: Record<string, WebGLUniformLocation | null> = {};
  for (const name of ["uRes", "uBase", "uP", "uC", "uN", "uGrain", "uScale"]) {
    u[name] = gl.getUniformLocation(program, name);
  }

  return { gl, u, p: new Float32Array(48), c: new Float32Array(36) };
}

function drawField(renderer: Renderer, width: number, height: number, base: Vec3, points: { x: number; y: number; r: number; col: Vec3 }[], grain: number, dpr: number) {
  const { gl, u } = renderer;
  const count = Math.min(12, points.length);
  renderer.p.fill(0);
  renderer.c.fill(0);
  for (let i = 0; i < count; i++) {
    const point = points[i];
    renderer.p[4 * i] = point.x;
    renderer.p[4 * i + 1] = point.y;
    renderer.p[4 * i + 2] = point.r;
    renderer.c[3 * i] = point.col[0];
    renderer.c[3 * i + 1] = point.col[1];
    renderer.c[3 * i + 2] = point.col[2];
  }
  gl.viewport(0, 0, width, height);
  gl.uniform2f(u.uRes, width, height);
  gl.uniform3f(u.uBase, base[0], base[1], base[2]);
  gl.uniform4fv(u.uP, renderer.p);
  gl.uniform3fv(u.uC, renderer.c);
  gl.uniform1i(u.uN, count);
  gl.uniform1f(u.uGrain, grain);
  gl.uniform1f(u.uScale, Math.max(1, dpr));
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function paint(sim: Sim) {
  const points = sim.pts.map(point => {
    const drift = driftOf(point, sim.t);
    const weight = sim.drift * point.w;
    return {
      x: point.x + drift.dx * weight,
      y: point.y + drift.dy * weight,
      r: point.r * (1 + (drift.s - 1) * weight),
      col: point.col,
    };
  });

  if (sim.gl && sim.canvas && sim.canvas.width > 0) {
    drawField(sim.gl, sim.canvas.width, sim.canvas.height, sim.base, points, sim.grain, sim.dpr);
    return;
  }

  const fallback = sim.fallback;
  if (!fallback) return;
  const field = cssField(
    toHex(sim.base),
    points.map(point => ({ color: toHex(point.col), x: point.x, y: point.y, r: point.r })),
    sim.grain,
  );
  fallback.style.backgroundColor = String(field.backgroundColor);
  fallback.style.backgroundImage = String(field.backgroundImage);
  fallback.style.backgroundBlendMode = field.backgroundBlendMode ?? "normal";
}

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * A drifting mesh gradient used as a page background. Points spring toward their seeds, drift on
 * independent sine phases and blend additively in a single fullscreen WebGL pass; the CSS radial
 * gradient stack underneath is painted first and updated in step, so the field still reads if the
 * canvas never starts. Reduced motion freezes the drift at its resting position.
 */
export function GradientMesh({
  base = "#f8efe4",
  points = DEFAULT_POINTS,
  grain = 0.3,
  animate = true,
  speed = 1,
  maxPoints = 8,
  className,
  style,
}: GradientMeshProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim | null>(null);
  const seeded = useRef(false);
  const [failed, setFailed] = useState(false);

  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );

  const limit = clamp(Math.round(maxPoints), 2, 8);
  const seeds = points.slice(0, limit).map((point, index) => ({
    id: point.id ?? `p${index}`,
    color: normalizeHex(point.color),
    x: clamp(point.x, 0, 1),
    y: clamp(point.y, 0, 1),
    spread: clamp(point.spread ?? 0.55, 0.15, 1.2),
  }));
  const seedKey = seeds.map(seed => `${seed.id}:${seed.color}:${seed.x}:${seed.y}:${seed.spread}`).join("|");

  const [fallbackStyle] = useState(() =>
    cssField(
      base,
      seeds.map(seed => ({ color: seed.color, x: seed.x, y: seed.y, r: seed.spread })),
      clamp(grain, 0, 1),
    ),
  );

  const sim = () => {
    simRef.current ??= {
      pts: [],
      base: [1, 1, 1],
      tbase: [1, 1, 1],
      grain: 0,
      tgrain: 0,
      t: 0,
      drift: 0,
      vdrift: 0,
      driftOn: false,
      paused: false,
      speed: 1,
      reduced: false,
      visible: true,
      running: false,
      frame: 0,
      last: 0,
      W: 0,
      H: 0,
      dpr: 1,
      gl: null,
      canvas: null,
      fallback: null,
    };
    return simRef.current;
  };

  const start = () => {
    const state = sim();
    if (state.running || !state.visible) return;
    state.running = true;
    state.last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - state.last) / 1000));
      state.last = now;

      let moved = false;
      const target = state.driftOn && !state.reduced ? 1 : 0;
      if (state.reduced) {
        state.drift = target;
        state.vdrift = 0;
      } else {
        [state.drift, state.vdrift] = spring(state.drift, state.vdrift, target, 3.2, dt);
      }
      if (state.drift !== target) moved = true;
      if (state.drift > 0.0001 && !state.paused && !state.reduced) {
        state.t = (state.t + dt * state.speed) % 20;
      }

      const blend = state.reduced ? 1 : 1 - Math.exp(-11 * dt);
      for (const point of state.pts) {
        if (state.reduced) {
          point.x = point.ax;
          point.y = point.ay;
          point.r = point.ar;
          point.w = +!point.removing;
          point.vx = 0;
          point.vy = 0;
          point.vr = 0;
          point.vw = 0;
        } else {
          [point.x, point.vx] = spring(point.x, point.vx, point.ax, 17, dt);
          [point.y, point.vy] = spring(point.y, point.vy, point.ay, 17, dt);
          [point.r, point.vr] = spring(point.r, point.vr, point.ar, 13, dt);
          const weight = +!point.removing;
          [point.w, point.vw] = spring(point.w, point.vw, weight, 3.2, dt);
          if (point.x !== point.ax || point.y !== point.ay || point.r !== point.ar || point.w !== weight) {
            moved = true;
          }
        }
        if (lerpColor(point.col, point.tcol, blend)) moved = true;
      }
      state.pts = state.pts.filter(point => !(point.removing && point.r < 0.004));
      if (lerpColor(state.base, state.tbase, blend)) moved = true;
      const grainDelta = state.tgrain - state.grain;
      if (Math.abs(grainDelta) < 0.001) state.grain = state.tgrain;
      else {
        state.grain += grainDelta * blend;
        moved = true;
      }

      paint(state);

      const drifting = state.drift > 0.001 && !state.paused && !state.reduced && state.speed > 0;
      if (state.visible && (moved || drifting)) state.frame = requestAnimationFrame(frame);
      else state.running = false;
    };

    state.frame = requestAnimationFrame(frame);
  };

  useLayoutEffect(() => {
    const state = sim();
    const first = !seeded.current;
    const ids = new Set(seeds.map(seed => seed.id));

    for (const point of state.pts) {
      if (!ids.has(point.id)) {
        point.removing = true;
        point.ar = 0;
      }
    }

    for (const seed of seeds) {
      const existing = state.pts.find(point => point.id === seed.id);
      if (!existing) {
        const color = parseHex(seed.color);
        state.pts.push({
          id: seed.id,
          ax: seed.x,
          ay: seed.y,
          ar: seed.spread,
          x: seed.x,
          y: seed.y,
          vx: 0,
          vy: 0,
          r: first ? 0 : seed.spread,
          vr: 0,
          w: +!first,
          vw: 0,
          col: [...color],
          tcol: color,
          removing: false,
          ...hashOf(seed.id),
        });
        continue;
      }
      existing.ax = seed.x;
      existing.ay = seed.y;
      existing.ar = seed.spread;
      existing.tcol = parseHex(seed.color);
      existing.removing = false;
    }

    state.tbase = parseHex(base);
    if (!seeded.current) state.base = [...state.tbase];
    state.tgrain = clamp(grain, 0, 1);
    if (!seeded.current) state.grain = state.tgrain;
    state.driftOn = animate;
    state.speed = Math.max(0, speed);
    state.reduced = reduced;
    start();
    // The seed list is captured through `seedKey`; the refs above are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey, base, grain, animate, speed, reduced]);

  useEffect(() => {
    seeded.current = true;
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const fallback = fallbackRef.current;
    if (!stage || !canvas) return;

    const state = sim();
    state.canvas = canvas;
    state.fallback = fallback;
    state.gl = createRenderer(canvas);
    if (!state.gl) setFailed(true);

    const onLost = (event: Event) => {
      event.preventDefault();
      state.gl = null;
      setFailed(true);
    };
    canvas.addEventListener("webglcontextlost", onLost);

    const resize = new ResizeObserver(entries => {
      const box = entries[0].contentRect;
      state.W = box.width;
      state.H = box.height;
      state.dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(box.width * state.dpr));
      canvas.height = Math.max(1, Math.round(box.height * state.dpr));
      paint(state);
      start();
    });
    resize.observe(stage);

    let intersecting = true;
    const syncVisible = () => {
      const visible = intersecting && document.visibilityState === "visible";
      if (visible === state.visible) return;
      state.visible = visible;
      if (visible) start();
      else {
        cancelAnimationFrame(state.frame);
        state.running = false;
      }
    };
    const intersection = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      syncVisible();
    });
    intersection.observe(stage);
    document.addEventListener("visibilitychange", syncVisible);

    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", syncVisible);
      cancelAnimationFrame(state.frame);
      state.running = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div aria-hidden="true" className={[styles.root, styles.background, className].filter(Boolean).join(" ")} style={style}>
      <div ref={stageRef} className={styles.stage}>
        <div ref={fallbackRef} className={styles.fallback} style={fallbackStyle} />
        <canvas ref={canvasRef} className={styles.canvas} data-hidden={failed || undefined} />
      </div>
    </div>
  );
}

export default GradientMesh;
