"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import styles from "./ink-fluid.module.css";

/** Full-screen triangle vertex pass, shared by every program. */
const VERTEX = `#version 300 es
in vec2 aPos; uniform vec2 uTexel;
out vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(uTexel.x, 0.0); vR = vUv + vec2(uTexel.x, 0.0);
  vT = vUv + vec2(0.0, uTexel.y); vB = vUv - vec2(0.0, uTexel.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;
/** Precision, varyings, and the single output every fragment pass writes. */
const FRAG = `#version 300 es
precision highp float; precision highp sampler2D;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB; out vec4 o;
`;

const SHADERS = {
          splat: `${FRAG}uniform sampler2D uTarget; uniform float uAspect; uniform vec3 uColor; uniform vec2 uPoint; uniform float uRadius;
void main() { vec2 p = vUv - uPoint; p.x *= uAspect; vec3 s = exp(-dot(p, p) / uRadius) * uColor; o = vec4(texture(uTarget, vUv).xyz + s, 1.0); }`,
          advect: `${FRAG}uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 uVelTexel; uniform float uDt; uniform float uDissipation; uniform float uTintFade;
void main() {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uVelTexel;
  vec4 c = texture(uSource, coord) / (1.0 + uDissipation * uDt);
  // The accent share hands its ink to the neutral share as it spreads, so fresh strokes carry colour and old wisps go grey.
  float moved = c.g * uTintFade * uDt;
  o = vec4(c.r + moved * 0.85, c.g - moved, c.b, c.a);
}`,
          divergence: `${FRAG}uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).x, R = texture(uVelocity, vR).x, T = texture(uVelocity, vT).y, B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x; if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
  o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,
          curl: `${FRAG}uniform sampler2D uVelocity;
void main() { o = vec4(0.5 * (texture(uVelocity, vR).y - texture(uVelocity, vL).y - texture(uVelocity, vT).x + texture(uVelocity, vB).x), 0.0, 0.0, 1.0); }`,
          vorticity: `${FRAG}uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float uCurlStrength; uniform float uDt;
void main() {
  float L = texture(uCurl, vL).x, R = texture(uCurl, vR).x, T = texture(uCurl, vT).x, B = texture(uCurl, vB).x, C = texture(uCurl, vUv).x;
  vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  f /= length(f) + 0.0001; f *= uCurlStrength * C; f.y *= -1.0;
  vec2 v = texture(uVelocity, vUv).xy + f * uDt;
  o = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
}`,
          pressure: `${FRAG}uniform sampler2D uPressure; uniform sampler2D uDivergence;
void main() {
  float L = texture(uPressure, vL).x, R = texture(uPressure, vR).x, T = texture(uPressure, vT).x, B = texture(uPressure, vB).x;
  o = vec4((L + R + B + T - texture(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0);
}`,
          gradient: `${FRAG}uniform sampler2D uPressure; uniform sampler2D uVelocity;
void main() {
  float L = texture(uPressure, vL).x, R = texture(uPressure, vR).x, T = texture(uPressure, vT).x, B = texture(uPressure, vB).x;
  o = vec4(texture(uVelocity, vUv).xy - vec2(R - L, T - B), 0.0, 1.0);
}`,
          scale: `${FRAG}uniform sampler2D uTexture; uniform float uValue; void main() { o = uValue * texture(uTexture, vUv); }`,
          display: `${FRAG}uniform sampler2D uDye; uniform vec3 uInk; uniform vec3 uAccent; uniform float uStrength; uniform float uShade; uniform vec2 uRes;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 d = texture(uDye, vUv).rgb;
  float L = dot(texture(uDye, vL).rg, vec2(1.0)), R = dot(texture(uDye, vR).rg, vec2(1.0));
  float T = dot(texture(uDye, vT).rg, vec2(1.0)), B = dot(texture(uDye, vB).rg, vec2(1.0));
  vec3 n = normalize(vec3(R - L, T - B, 0.35));
  float light = clamp(dot(n, normalize(vec3(-0.4, 0.5, 0.75))), 0.0, 1.0);
  float an = (1.0 - exp(-max(d.r, 0.0) * 1.3)) * uStrength;
  // Accent ink reads a touch stronger than neutral ink, so fresh strokes carry real colour before they settle.
  float aa = min(1.0, (1.0 - exp(-max(d.g, 0.0) * 1.3)) * uStrength * 1.8);
  float a = clamp(an + aa * (1.0 - an), 0.0, 1.0);
  vec3 col = (uInk * an + uAccent * aa) / max(an + aa, 0.0001);
  col = mix(col, col * (0.82 + 0.3 * light), uShade);
  a += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  a = clamp(a, 0.0, 1.0);
  o = vec4(col * a, a);
}`,
        };;

const GRID = { low: 96, medium: 128, high: 192 } as const;
const DYE = { low: 256, medium: 512, high: 768 } as const;

export type InkFluidQuality = keyof typeof GRID;

export interface InkFluidProps {
  /** Content laid over the ink. Also the pointer target, so buttons still work. */
  children?: ReactNode;
  /** Ink opacity, 0 to 1. */
  intensity?: number;
  /** Share of the accent colour, 0 to 1. The rest is neutral ink. */
  tint?: number;
  /** How hard a fast drag pushes the fluid. */
  force?: number;
  /** Keep a slow plume drifting when the pointer is still. */
  ambient?: boolean;
  /** Follow the pointer. */
  interactive?: boolean;
  /** Simulation resolution. Higher is sharper and costs more. */
  quality?: InkFluidQuality;
  /** Extra class on the root. */
  className?: string;
  /** Inline style on the root. */
  style?: CSSProperties;
}

type Rgb = [number, number, number];

interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
}

interface Swap {
  read: Target;
  write: Target;
  w: number;
  h: number;
  swap: () => void;
}

interface Program {
  p: WebGLProgram;
  u: (name: string) => WebGLUniformLocation | null;
}

type Programs = Record<keyof typeof SHADERS, Program>;

/** A texture plus the framebuffer it renders into, cleared to opaque black. */
function makeTarget(gl: WebGL2RenderingContext, w: number, h: number, internal: number, format: number): Target {
  const tex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  if (!tex || !fbo) throw new Error("webgl target");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  return { tex, fbo, w, h };
}

/** Two targets you ping-pong between, one step of the simulation at a time. */
function makeSwap(gl: WebGL2RenderingContext, w: number, h: number, internal: number, format: number): Swap {
  const pair: Swap = {
    read: makeTarget(gl, w, h, internal, format),
    write: makeTarget(gl, w, h, internal, format),
    w,
    h,
    swap: () => {},
  };
  pair.swap = () => {
    const next = pair.read;
    pair.read = pair.write;
    pair.write = next;
  };
  return pair;
}

function releaseTargets(gl: WebGL2RenderingContext, ...targets: Target[]) {
  for (const target of targets) {
    gl.deleteTexture(target.tex);
    gl.deleteFramebuffer(target.fbo);
  }
}

/** Resolve a CSS custom property to linear-ish 0..1 channels by letting the canvas parse it. */
function readColor(css: string, fallback: Rgb): Rgb {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || !css) return fallback;
  ctx.fillStyle = "#000";
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

function compile(gl: WebGL2RenderingContext, fragment: string): Program {
  const shader = (type: number, source: string) => {
    const handle = gl.createShader(type);
    if (!handle) throw new Error("webgl shader");
    gl.shaderSource(handle, source);
    gl.compileShader(handle);
    return handle;
  };
  const program = gl.createProgram();
  if (!program) throw new Error("webgl program");
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link");
  const locations = new Map<string, WebGLUniformLocation | null>();
  return {
    p: program,
    u: name => {
      if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name));
      return locations.get(name) ?? null;
    },
  };
}

export function InkFluid({
  children,
  intensity = 0.5,
  tint = 0.8,
  force = 0.5,
  ambient = true,
  interactive = true,
  quality = "medium",
  className,
  style,
}: InkFluidProps) {
  const reduced = Boolean(useReducedMotion());
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const options = useRef({ intensity, tint, force, ambient, interactive });

  useEffect(() => {
    options.current = { intensity, tint, force, ambient, interactive };
  });

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });
    if (!gl || !gl.getExtension("EXT_color_buffer_float")) {
      root.dataset.fallback = "";
      return;
    }

    let programs: Programs;
    try {
      programs = Object.fromEntries(
        Object.entries(SHADERS).map(([name, source]) => [name, compile(gl, source)]),
      ) as Programs;
    } catch {
      root.dataset.fallback = "";
      return;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    let width = 0;
    let height = 0;
    let built = false;
    let velocity!: Swap;
    let dye!: Swap;
    let pressure!: Swap;
    let divergence!: Target;
    let curl!: Target;

    const resize = () => {
      const rect = root.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(1, Math.round(rect.width * ratio));
      height = Math.max(1, Math.round(rect.height * ratio));
      canvas.width = width;
      canvas.height = height;
      const aspect = width / height;
      const fit = (size: number): [number, number] => (aspect >= 1 ? [Math.round(size * aspect), size] : [size, Math.round(size / aspect)]);
      const [gridW, gridH] = fit(GRID[quality]);
      const [dyeW, dyeH] = fit(DYE[quality]);
      if (built) {
        releaseTargets(gl, velocity.read, velocity.write, dye.read, dye.write, pressure.read, pressure.write, divergence, curl);
      }
      velocity = makeSwap(gl, gridW, gridH, gl.RG16F, gl.RG);
      dye = makeSwap(gl, dyeW, dyeH, gl.RGBA16F, gl.RGBA);
      pressure = makeSwap(gl, gridW, gridH, gl.R16F, gl.RED);
      divergence = makeTarget(gl, gridW, gridH, gl.R16F, gl.RED);
      curl = makeTarget(gl, gridW, gridH, gl.R16F, gl.RED);
      built = true;
    };
    resize();

    const draw = (target: Target | null) => {
      if (target) {
        gl.viewport(0, 0, target.w, target.h);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      } else {
        gl.viewport(0, 0, width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const withTexel = (program: Program, texel: [number, number]) => {
      gl.useProgram(program.p);
      gl.uniform2f(program.u("uTexel"), texel[0], texel[1]);
      return program;
    };

    const bind = (program: Program, name: string, unit: number, target: Target) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, target.tex);
      gl.uniform1i(program.u(name), unit);
    };

    /** Push velocity and dye outward from a point: one stroke of the brush. */
    const splat = (x: number, y: number, dx: number, dy: number, r: number, g: number, radius: number) => {
      const program = withTexel(programs.splat, [1 / velocity.w, 1 / velocity.h]);
      gl.uniform1f(program.u("uAspect"), width / height);
      gl.uniform2f(program.u("uPoint"), x, y);
      gl.uniform1f(program.u("uRadius"), radius / 100);
      bind(program, "uTarget", 0, velocity.read);
      gl.uniform3f(program.u("uColor"), dx, dy, 0);
      draw(velocity.write);
      velocity.swap();
      bind(program, "uTarget", 0, dye.read);
      gl.uniform3f(program.u("uColor"), r, g, 0);
      draw(dye.write);
      dye.swap();
    };

    /** One stable-fluids step: curl, vorticity, divergence, pressure, gradient, advect. */
    const step = (dt: number) => {
      const texel: [number, number] = [1 / velocity.w, 1 / velocity.h];
      let program = withTexel(programs.curl, texel);
      bind(program, "uVelocity", 0, velocity.read);
      draw(curl);

      program = withTexel(programs.vorticity, texel);
      bind(program, "uVelocity", 0, velocity.read);
      bind(program, "uCurl", 1, curl);
      gl.uniform1f(program.u("uCurlStrength"), 14);
      gl.uniform1f(program.u("uDt"), dt);
      draw(velocity.write);
      velocity.swap();

      program = withTexel(programs.divergence, texel);
      bind(program, "uVelocity", 0, velocity.read);
      draw(divergence);

      program = withTexel(programs.scale, texel);
      bind(program, "uTexture", 0, pressure.read);
      gl.uniform1f(program.u("uValue"), 0.8);
      draw(pressure.write);
      pressure.swap();

      program = withTexel(programs.pressure, texel);
      bind(program, "uDivergence", 1, divergence);
      for (let iteration = 0; iteration < 20; iteration += 1) {
        bind(program, "uPressure", 0, pressure.read);
        draw(pressure.write);
        pressure.swap();
      }

      program = withTexel(programs.gradient, texel);
      bind(program, "uPressure", 0, pressure.read);
      bind(program, "uVelocity", 1, velocity.read);
      draw(velocity.write);
      velocity.swap();

      program = withTexel(programs.advect, texel);
      gl.uniform2f(program.u("uVelTexel"), texel[0], texel[1]);
      gl.uniform1f(program.u("uDt"), dt);
      bind(program, "uVelocity", 0, velocity.read);
      bind(program, "uSource", 1, velocity.read);
      gl.uniform1f(program.u("uDissipation"), 0.3);
      gl.uniform1f(program.u("uTintFade"), 0);
      draw(velocity.write);
      velocity.swap();

      program = withTexel(programs.advect, [1 / dye.w, 1 / dye.h]);
      gl.uniform2f(program.u("uVelTexel"), texel[0], texel[1]);
      gl.uniform1f(program.u("uDt"), dt);
      bind(program, "uVelocity", 0, velocity.read);
      bind(program, "uSource", 1, dye.read);
      gl.uniform1f(program.u("uDissipation"), 1.1);
      gl.uniform1f(program.u("uTintFade"), 0.22);
      draw(dye.write);
      dye.swap();
    };

    let ink: Rgb = [0.1, 0.1, 0.1];
    let accent: Rgb = [0.2, 0.2, 0.2];
    let dark = false;

    /** Re-read the theme tokens the ink is tinted with. */
    const readTheme = () => {
      const computed = getComputedStyle(root);
      ink = readColor(computed.getPropertyValue("--ink-color").trim(), [0.1, 0.1, 0.1]);
      accent = readColor(computed.getPropertyValue("--ink-accent").trim(), [0.2, 0.2, 0.2]);
      dark = computed.getPropertyValue("--ink-dark").trim() === "1";
    };
    readTheme();

    const show = () => {
      const program = withTexel(programs.display, [1 / dye.w, 1 / dye.h]);
      bind(program, "uDye", 0, dye.read);
      gl.uniform3f(program.u("uInk"), ink[0], ink[1], ink[2]);
      gl.uniform3f(program.u("uAccent"), accent[0], accent[1], accent[2]);
      gl.uniform1f(program.u("uStrength"), Math.min(1, options.current.intensity * (dark ? 0.44 : 0.34)));
      gl.uniform1f(program.u("uShade"), 0.8);
      draw(null);
    };

    const pointer = { x: 0, y: 0, dx: 0, dy: 0, moved: false, last: 0, has: false };

    const onMove = (event: PointerEvent) => {
      if (!options.current.interactive || reduced) return;
      const rect = root.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = 1 - (event.clientY - rect.top) / rect.height;
      if (pointer.has) {
        pointer.dx += (x - pointer.x) * (rect.width / rect.height);
        pointer.dy += y - pointer.y;
      }
      pointer.x = x;
      pointer.y = y;
      pointer.has = true;
      pointer.moved = true;
      pointer.last = performance.now();
    };

    const onLeave = () => {
      pointer.has = false;
    };

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("pointerdown", onMove);

    let seed = 100 * Math.random();
    let hue = 0;
    let frame = 0;
    let running = false;
    let visible = true;
    let clock = performance.now();

    /** The slow plume that keeps the surface alive when nobody touches it. */
    const plume = (time: number, dt: number) => {
      const turn = (time / 1000) * 0.16 + seed;
      splat(
        0.5 + 0.34 * Math.sin(1.3 * turn) * Math.cos(0.7 * turn),
        0.5 + 0.28 * Math.sin(0.9 * turn + 1.7),
        60 * Math.cos(1.1 * turn) * dt * 9,
        60 * Math.sin(1.7 * turn) * dt * 9,
        2 * dt * (1 - 0.85 * options.current.tint),
        2 * dt * options.current.tint * 0.85,
        0.45,
      );
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = Math.min(0.033, (now - clock) / 1000);
      clock = now;
      if (pointer.moved) {
        const length = Math.hypot(pointer.dx, pointer.dy);
        const push = 5200 * (0.4 + 1.2 * options.current.force);
        const radius = Math.min(0.32, 5 * length);
        hue = (hue + 3 * length) % 1;
        const share = options.current.tint;
        splat(
          pointer.x,
          pointer.y,
          pointer.dx * push,
          pointer.dy * push,
          radius * (1 - share),
          radius * share * (0.75 + 0.25 * Math.sin(hue * Math.PI * 2)),
          0.22,
        );
        pointer.dx = 0;
        pointer.dy = 0;
        pointer.moved = false;
      }
      if (options.current.ambient && now - pointer.last > 1200) plume(now, dt);
      step(dt);
      show();
      if (running) frame = requestAnimationFrame(tick);
    };

    const start = () => {
      const live = visible && !document.hidden && !reduced;
      if (live && !running) {
        running = true;
        clock = performance.now();
        frame = requestAnimationFrame(tick);
      }
      if (!live && running) {
        running = false;
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    /** Reduced motion: a single still frame from a fixed seed, so nothing ever animates. */
    const still = () => {
      seed = 3.2;
      for (let i = 0; i < 140; i += 1) {
        plume(16.7 * i * 2.4, 1 / 60);
        step(1 / 60);
      }
      show();
    };

    if (reduced) still();

    const intersection = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? true;
      start();
    });
    intersection.observe(root);

    const onVisibility = () => start();
    document.addEventListener("visibilitychange", onVisibility);

    let pending = 0;
    const watcher = new ResizeObserver(() => {
      window.clearTimeout(pending);
      pending = window.setTimeout(() => {
        const rect = root.getBoundingClientRect();
        const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
        if (Math.max(1, Math.round(rect.width * ratio)) !== width || Math.max(1, Math.round(rect.height * ratio)) !== height) {
          resize();
          if (reduced) still();
          else show();
        }
      }, 120);
    });
    watcher.observe(root);

    const theme = new MutationObserver(() => {
      readTheme();
      if (!running) show();
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-accent", "class"] });

    start();

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      intersection.disconnect();
      watcher.disconnect();
      theme.disconnect();
      window.clearTimeout(pending);
      document.removeEventListener("visibilitychange", onVisibility);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointerdown", onMove);
      releaseTargets(gl, velocity.read, velocity.write, dye.read, dye.write, pressure.read, pressure.write, divergence, curl);
      Object.values(programs).forEach(program => gl.deleteProgram(program.p));
      gl.deleteBuffer(buffer);
    };
  }, [quality, reduced]);

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={style}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      {children != null ? <div className={styles.content}>{children}</div> : null}
    </div>
  );
}

export default InkFluid;
