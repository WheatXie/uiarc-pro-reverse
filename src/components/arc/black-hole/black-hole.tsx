"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { motionTokens } from "../motion-tokens";
import styles from "./black-hole.module.css";

/** Where the singularity sits. Screen coordinates, e.g. the centre of the pressed button. */
export interface BlackHoleOrigin {
  x: number;
  y: number;
}

/** Per-transition options. `duration` is in seconds. */
export interface BlackHoleOptions {
  /** Where the singularity opens. Defaults to the centre of the bound nodes. */
  origin?: BlackHoleOrigin;
  /** Seconds for the full pull (swallow) or spin-out (release). Defaults to 1.3. */
  duration?: number;
}

/** Imperative API exposed on the ref. Both calls resolve when the frame has been drawn. */
export interface BlackHoleHandle {
  /** Pulls the given elements into the singularity. They stay in the DOM, hidden. */
  swallow: (nodes: Element[], options?: BlackHoleOptions) => Promise<void>;
  /** Spins previously swallowed elements back out. */
  release: (nodes: Element[], options?: BlackHoleOptions) => Promise<void>;
}

export interface BlackHoleProps {
  /** The content that gets bent and pulled. Everything inside is snapshotted at the moment the pull starts. */
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));
const progress = (value: number, from: number, to: number) =>
  clamp((value - from) / (to - from));
const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

/** Anything that would actually leave a mark: `transparent`, `rgb(0 0 0 / 0)` and friends are not painted. */
function isPaint(value: string) {
  return (
    !!value &&
    value !== "transparent" &&
    !/rgba?\(.*,\s*0\)$/.test(value) &&
    !/\/\s*0\)$/.test(value)
  );
}

/** SVGs cannot be drawn straight into a 2D context, so each one is serialised to a data URL and decoded. */
async function rasterizeSvg(root: HTMLElement) {
  const map = new Map<SVGElement, HTMLImageElement>();
  await Promise.all(
    [...root.querySelectorAll("svg")].map(async (svg) => {
      const box = svg.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const clone = svg.cloneNode(true) as SVGElement;
      clone.setAttribute("width", String(box.width));
      clone.setAttribute("height", String(box.height));
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const markup = new XMLSerializer()
        .serializeToString(clone)
        .replace(/currentColor/g, getComputedStyle(svg).color);
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
      try {
        await image.decode();
        map.set(svg, image);
      } catch {
        /* a broken icon is simply not drawn */
      }
    }),
  );
  return map;
}

const VERTEX = `#version 300 es
in vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

/** The background plate: the whole list, bent around the hole with a lensing warp. */
const LENS_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uRes; uniform vec2 uO; uniform float uLens;
out vec4 color;
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 d = p - uO; float r = length(d);
  vec2 q = p;
  if (uLens > 0.0) { float beta = r - uLens * uLens / max(r, 0.5); q = uO + d / max(r, 0.001) * beta; }
  vec2 uv = q / uRes;
  color = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? vec4(0.0) : texture(uTex, uv);
}`;

/** The selected rows, on a warped mesh: they fall inward, spin up and fade as they go. */
const MESH_VERTEX = `#version 300 es
in vec2 aPos;
uniform vec2 uRes; uniform vec2 uO; uniform float uT; uniform float uMaxR; uniform float uSpin;
out vec2 vUv; out float vFade;
void main() {
  vec2 v = aPos - uO; float r0 = length(v); float a0 = atan(v.y, v.x);
  float dn = clamp(r0 / uMaxR, 0.0, 1.0);
  float start = 0.08 + 0.36 * dn;
  float u = clamp((uT - start) / 0.46, 0.0, 1.0);
  float f = u * u * (1.5 - 0.5 * u);
  float r = r0 * (1.0 - f);
  float a = a0 + uSpin * -log(max(1.0 - f, 0.015)) * 0.55;
  vec2 p = uO + vec2(cos(a), sin(a)) * r;
  vUv = aPos / uRes;
  vFade = 1.0 - smoothstep(0.72, 0.98, f);
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
}`;

const QUAD_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uTex; in vec2 vUv; in float vFade; out vec4 color;
void main() { color = texture(uTex, vUv) * vFade; }`;

/** Core, photon ring, halo and the closing shockwave. */
const CORE_FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform vec2 uO; uniform float uCore; uniform float uWave; uniform float uWaveAlpha; uniform float uDark; uniform float uPx; uniform vec3 uAccent;
out vec4 color;
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float r = length(p - uO);
  float halo = uCore > 0.0 ? exp(-max(r - uCore, 0.0) / (uCore * 1.6)) * 0.22 * (1.0 - uDark * 0.4) : 0.0;
  float ring = uCore > 0.0 ? exp(-pow((r - uCore * 1.18) / (0.8 * uPx), 2.0)) * mix(0.5, 0.65, uDark) : 0.0;
  float core = uCore > 0.0 ? 1.0 - smoothstep(uCore - 1.2 * uPx, uCore + 0.4 * uPx, r) : 0.0;
  float wave = uWaveAlpha * exp(-pow((r - uWave) / (2.5 * uPx), 2.0));
  vec4 c = vec4(0.0);
  c = vec4(0.0, 0.0, 0.0, halo);
  // The photon ring and the closing shockwave wear the accent; the core and its halo stay ink.
  c = vec4(uAccent * ring, ring) + c * (1.0 - ring);
  c = vec4(uAccent * wave * 0.6, wave * 0.6) + c * (1.0 - wave * 0.6);
  c = vec4(vec3(0.0), core) + c * (1.0 - core);
  color = c;
}`;

interface Program {
  program: WebGLProgram;
  uniform: (name: string) => WebGLUniformLocation | null;
}

function createProgram(gl: WebGL2RenderingContext, vertex: string, fragment: string): Program {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "link failed");
  }
  const cache = new Map<string, WebGLUniformLocation | null>();
  return {
    program,
    uniform: (name) => {
      if (!cache.has(name)) cache.set(name, gl.getUniformLocation(program, name));
      return cache.get(name)!;
    },
  };
}

function createTexture(gl: WebGL2RenderingContext, source: TexImageSource) {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

/** Background, borders, images, rounded corners and per-word text — enough of a browser to snapshot the list. */
type DrawOptions = { skip?: Set<Element>; only?: Set<Element> };

function paintNode(
  ctx: CanvasRenderingContext2D,
  node: Element,
  box: DOMRect,
  dpr: number,
  options: DrawOptions,
  svgImages: Map<SVGElement, HTMLImageElement>,
  paint: boolean,
  force: boolean,
) {
  if (options.skip?.has(node)) return;
  if (options.only?.has(node)) {
    paint = true;
    force = true;
  }
  const style = getComputedStyle(node);
  if (style.display === "none") return;
  const opacity = parseFloat(style.opacity);
  if (!force && opacity === 0) return;
  const visible = force || style.visibility !== "hidden";
  const rect = node.getBoundingClientRect();
  const x = (rect.left - box.left) * dpr;
  const y = (rect.top - box.top) * dpr;
  const w = rect.width * dpr;
  const h = rect.height * dpr;

  ctx.save();
  if (paint && !force) ctx.globalAlpha *= opacity;
  if (paint && visible && w > 0 && h > 0) {
    const radii = [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomRightRadius,
      style.borderBottomLeftRadius,
    ].map((value) => (parseFloat(value) || 0) * dpr);

    if (isPaint(style.backgroundColor)) {
      ctx.fillStyle = style.backgroundColor;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radii);
      ctx.fill();
    }

    const widths = [
      style.borderTopWidth,
      style.borderRightWidth,
      style.borderBottomWidth,
      style.borderLeftWidth,
    ].map((value) => parseFloat(value) || 0);
    const colors = [
      style.borderTopColor,
      style.borderRightColor,
      style.borderBottomColor,
      style.borderLeftColor,
    ];
    if (
      widths.every((value) => value > 0 && value === widths[0]) &&
      colors.every((value) => value === colors[0]) &&
      isPaint(colors[0])
    ) {
      ctx.strokeStyle = colors[0];
      ctx.lineWidth = widths[0];
      ctx.beginPath();
      ctx.roundRect(
        x + widths[0] / 2,
        y + widths[0] / 2,
        w - widths[0],
        h - widths[0],
        radii.map((radius) => Math.max(0, radius - widths[0] / 2)),
      );
      ctx.stroke();
    } else {
      widths.forEach((width, side) => {
        if (!width || !isPaint(colors[side])) return;
        ctx.fillStyle = colors[side];
        if (side === 0) ctx.fillRect(x, y, w, width);
        if (side === 1) ctx.fillRect(x + w - width, y, width, h);
        if (side === 2) ctx.fillRect(x, y + h - width, w, width);
        if (side === 3) ctx.fillRect(x, y, width, h);
      });
    }

    if (
      node instanceof HTMLImageElement &&
      node.complete &&
      node.naturalWidth
    ) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radii);
      ctx.clip();
      const ratio = node.naturalWidth / node.naturalHeight;
      const frame = w / h;
      const cover = style.objectFit === "cover";
      let drawW = w;
      let drawH = h;
      if (cover && ratio > frame) drawW = h * ratio;
      if (cover && ratio <= frame) drawH = w / ratio;
      try {
        ctx.drawImage(node, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
      } catch {
        /* a tainted or not-yet-decoded image is skipped */
      }
      ctx.restore();
    }

    const svg = svgImages.get(node as SVGElement);
    if (svg) ctx.drawImage(svg, x, y, w, h);

    if (style.overflow !== "visible" && style.overflowX !== "visible") {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radii);
      ctx.clip();
    }
  }

  if (
    node instanceof SVGElement ||
    node instanceof HTMLImageElement ||
    node instanceof HTMLCanvasElement
  ) {
    ctx.restore();
    return;
  }

  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (!paint || !visible) continue;
      const text = child.textContent ?? "";
      if (!text.trim()) continue;
      ctx.font = `${style.fontStyle} ${style.fontWeight} ${parseFloat(style.fontSize) * dpr}px ${style.fontFamily}`;
      ctx.fillStyle = style.color;
      if ("letterSpacing" in ctx) {
        (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
          style.letterSpacing === "normal"
            ? "0px"
            : `${parseFloat(style.letterSpacing) * dpr}px`;
      }
      ctx.textBaseline = "alphabetic";
      const metrics = ctx.measureText("Hg");
      const ascent = metrics.fontBoundingBoxAscent ?? parseFloat(style.fontSize) * dpr * 0.8;
      const descent = metrics.fontBoundingBoxDescent ?? parseFloat(style.fontSize) * dpr * 0.2;
      const range = document.createRange();
      for (const word of text.matchAll(/\S+/g)) {
        range.setStart(child, word.index ?? 0);
        range.setEnd(child, (word.index ?? 0) + word[0].length);
        const wordBox = range.getBoundingClientRect();
        if (!wordBox.width) continue;
        ctx.fillText(
          word[0],
          (wordBox.left - box.left) * dpr,
          (wordBox.top - box.top) * dpr + (wordBox.height * dpr - ascent - descent) / 2 + ascent,
        );
      }
    } else if (child instanceof Element) {
      paintNode(ctx, child, box, dpr, options, svgImages, paint, force);
    }
  }
  ctx.restore();
}

/** Triangulates the viewport so the fragment-free vertex shader can warp the selected rows. */
function buildGrid(gl: WebGL2RenderingContext, width: number, height: number, cell: number) {
  const cols = Math.max(1, Math.ceil(width / cell));
  const rows = Math.max(1, Math.ceil(height / cell));
  const data = new Float32Array(cols * rows * 12);
  let offset = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x0 = (col * width) / cols;
      const x1 = ((col + 1) * width) / cols;
      const y0 = (row * height) / rows;
      const y1 = ((row + 1) * height) / rows;
      data.set([x0, y0, x1, y0, x0, y1, x1, y0, x1, y1, x0, y1], offset);
      offset += 12;
    }
  }
  const buffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return { buffer, count: cols * rows * 6 };
}

/** Reads a CSS colour through a 1×1 canvas so the shader can mix with it. */
function readColor(value: string, fallback: [number, number, number]): [number, number, number] {
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!ctx || !value) return fallback;
  ctx.fillStyle = "#000";
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

/**
 * A delete transition that pulls the chosen rows into a tiny singularity while the rest of the
 * list bends around it; undo spins them back out. The pull is a WebGL pass over a DOM snapshot,
 * so anything inside can be swallowed, not just text rows.
 */
export const BlackHole = forwardRef<BlackHoleHandle, BlackHoleProps>(function BlackHole(
  { children, className, style },
  ref,
) {
  const reduced = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const reducedRef = useRef(reduced);
  const glRef = useRef<
    | {
        gl: WebGL2RenderingContext;
        lens: Program;
        mesh: Program;
        core: Program;
        quad: WebGLBuffer;
      }
    | null
    | undefined
  >(undefined);

  useEffect(() => {
    reducedRef.current = reduced;
  });

  const ensureGl = useCallback(() => {
    if (glRef.current !== undefined) return glRef.current;
    const canvas = canvasRef.current;
    try {
      const gl =
        canvas?.getContext("webgl2", { premultipliedAlpha: true, antialias: true }) ?? null;
      if (!gl) {
        glRef.current = null;
        return null;
      }
      const quad = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      glRef.current = {
        gl,
        lens: createProgram(gl, VERTEX, LENS_FRAGMENT),
        mesh: createProgram(gl, MESH_VERTEX, QUAD_FRAGMENT),
        core: createProgram(gl, VERTEX, CORE_FRAGMENT),
        quad,
      };
    } catch {
      glRef.current = null;
    }
    return glRef.current ?? null;
  }, []);

  // The first WebGL initialisation is deferred to idle: nothing here is needed until a row leaves.
  useEffect(() => {
    if (reduced) return;
    const idle =
      window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(callback, 200));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => ensureGl());
    return () => cancel(handle);
  }, [ensureGl, reduced]);

  const transition = useCallback(
    async (list: Element[], direction: number, options: BlackHoleOptions = {}) => {
      const root = rootRef.current;
      const content = contentRef.current;
      const canvas = canvasRef.current;
      const nodes = list.filter((node) => node.isConnected);
      if (!root || !content || !canvas || !nodes.length) return;

      if (direction < 0) {
        // Hide first, then wait until the layout stops moving, so the snapshot catches the settled list.
        nodes.forEach((node) => {
          (node as HTMLElement).style.visibility = "hidden";
        });
        let previous = "";
        let stable = 0;
        const started = performance.now();
        const deadline = started + 1200;
        do {
          await nextFrame();
          const signature = [root, ...nodes]
            .map((node) => {
              const box = node.getBoundingClientRect();
              return `${box.left.toFixed(1)},${box.top.toFixed(1)},${box.width.toFixed(1)},${box.height.toFixed(1)}`;
            })
            .join("|");
          stable = signature === previous ? stable + 1 : 0;
          previous = signature;
        } while ((stable < 6 || performance.now() - started < 160) && performance.now() < deadline);
      }

      const fade = (node: Element, from: number, to: number) => {
        const ease = to > from ? motionTokens.ease.exit : motionTokens.ease.enter;
        const duration = reducedRef.current
          ? 0
          : (to > from ? motionTokens.duration.exit : motionTokens.duration.standard) * 1000;
        return node.animate([{ opacity: from }, { opacity: to }], {
          duration,
          easing: `cubic-bezier(${ease.join(",")})`,
        }).finished;
      };

      const gl = reducedRef.current ? null : ensureGl();

      if (!gl) {
        // Reduced motion, or no WebGL2: a plain opacity fade in the same rhythm.
        if (direction > 0) {
          await Promise.all(nodes.map((node) => fade(node, 1, 0)));
          nodes.forEach((node) => {
            (node as HTMLElement).style.visibility = "hidden";
          });
        } else {
          nodes.forEach((node) => {
            (node as HTMLElement).style.visibility = "";
          });
          await Promise.all(nodes.map((node) => fade(node, 0, 1)));
        }
        return;
      }

      const box = root.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(box.width * dpr));
      const height = Math.max(1, Math.round(box.height * dpr));
      canvas.width = width;
      canvas.height = height;

      const selected = new Set(nodes);
      const svgImages = await rasterizeSvg(content);

      const snapshot = (options: DrawOptions, paintAll: boolean) => {
        const layer = document.createElement("canvas");
        layer.width = width;
        layer.height = height;
        paintNode(layer.getContext("2d")!, content, box, dpr, options, svgImages, paintAll, false);
        return layer;
      };

      const rest = snapshot({ skip: selected }, true);
      const only = snapshot({ only: selected }, false);

      const boxes = nodes.map((node) => node.getBoundingClientRect());
      const minLeft = Math.min(...boxes.map((b) => b.left));
      const maxRight = Math.max(...boxes.map((b) => b.right));
      const minTop = Math.min(...boxes.map((b) => b.top));
      const maxBottom = Math.max(...boxes.map((b) => b.bottom));
      const originX = ((options.origin?.x ?? (minLeft + maxRight) / 2) - box.left) * dpr;
      const originY = ((options.origin?.y ?? (minTop + maxBottom) / 2) - box.top) * dpr;
      const maxRadius =
        Math.max(
          ...boxes.flatMap((b) =>
            (
              [
                [b.left, b.top],
                [b.right, b.top],
                [b.left, b.bottom],
                [b.right, b.bottom],
              ] as const
            ).map(([x, y]) => Math.hypot((x - box.left) * dpr - originX, (y - box.top) * dpr - originY)),
          ),
        ) || 1;
      const theme = document.documentElement.dataset.theme;
      const isDark =
        theme === "dark" || (!theme && matchMedia("(prefers-color-scheme: dark)").matches);
      const accent = readColor(
        getComputedStyle(root).getPropertyValue("--accent").trim(),
        isDark ? [1, 1, 1] : [0, 0, 0],
      );

      const grid = buildGrid(gl.gl, width, height, 5 * dpr);
      const scene = {
        ...gl,
        grid: grid.buffer,
        gridCount: grid.count,
        rest: createTexture(gl.gl, rest),
        sel: createTexture(gl.gl, only),
      };

      const draw = (t: number) => {
        const { gl: context } = scene;
        context.viewport(0, 0, width, height);
        context.clearColor(0, 0, 0, 0);
        context.clear(context.COLOR_BUFFER_BIT);
        context.enable(context.BLEND);
        context.blendFunc(context.ONE, context.ONE_MINUS_SRC_ALPHA);

        const grow = progress(t, 0, 0.16);
        const lens = 1 + 2.6 * Math.pow(grow - 1, 3) + 1.6 * Math.pow(grow - 1, 2);
        const closing = progress(t, 0.84, 0.92);
        const shrink = closing * closing * closing;
        const core = 6.5 * dpr * (lens + 0.35 * progress(t, 0.2, 0.8)) * (1 - shrink);
        const wave = progress(t, 0.88, 1);

        context.useProgram(scene.lens.program);
        context.bindBuffer(context.ARRAY_BUFFER, scene.quad);
        context.enableVertexAttribArray(0);
        context.vertexAttribPointer(0, 2, context.FLOAT, false, 0, 0);
        context.activeTexture(context.TEXTURE0);
        context.bindTexture(context.TEXTURE_2D, scene.rest);
        context.uniform1i(scene.lens.uniform("uTex"), 0);
        context.uniform2f(scene.lens.uniform("uRes"), width, height);
        context.uniform2f(scene.lens.uniform("uO"), originX, originY);
        context.uniform1f(scene.lens.uniform("uLens"), 3.4 * core);
        context.drawArrays(context.TRIANGLES, 0, 3);

        context.useProgram(scene.mesh.program);
        context.bindBuffer(context.ARRAY_BUFFER, scene.grid);
        context.vertexAttribPointer(0, 2, context.FLOAT, false, 0, 0);
        context.bindTexture(context.TEXTURE_2D, scene.sel);
        context.uniform1i(scene.mesh.uniform("uTex"), 0);
        context.uniform2f(scene.mesh.uniform("uRes"), width, height);
        context.uniform2f(scene.mesh.uniform("uO"), originX, originY);
        context.uniform1f(scene.mesh.uniform("uT"), t);
        context.uniform1f(scene.mesh.uniform("uMaxR"), maxRadius);
        context.uniform1f(scene.mesh.uniform("uSpin"), 1.6);
        context.drawArrays(context.TRIANGLES, 0, scene.gridCount);

        context.useProgram(scene.core.program);
        context.bindBuffer(context.ARRAY_BUFFER, scene.quad);
        context.vertexAttribPointer(0, 2, context.FLOAT, false, 0, 0);
        context.uniform2f(scene.core.uniform("uRes"), width, height);
        context.uniform2f(scene.core.uniform("uO"), originX, originY);
        context.uniform1f(scene.core.uniform("uCore"), core);
        context.uniform1f(scene.core.uniform("uWave"), 90 * (1 - Math.pow(1 - wave, 3)) * dpr);
        context.uniform1f(scene.core.uniform("uWaveAlpha"), wave > 0 ? (1 - wave) * (1 - wave) : 0);
        context.uniform1f(scene.core.uniform("uDark"), isDark ? 1 : 0);
        context.uniform1f(scene.core.uniform("uPx"), dpr);
        context.uniform3f(scene.core.uniform("uAccent"), accent[0], accent[1], accent[2]);
        context.drawArrays(context.TRIANGLES, 0, 3);
      };

      const duration = (options.duration ?? 1.3) * (direction < 0 ? 0.92 : 1) * 1000;
      let t = direction > 0 ? 0 : 1;
      draw(t);
      canvas.style.visibility = "visible";
      content.style.visibility = "hidden";
      const started = await nextFrame();
      while (direction > 0 ? t < 1 : t > 0) {
        const elapsed = clamp(((await nextFrame()) - started) / duration);
        draw((t = direction > 0 ? elapsed : 1 - elapsed));
      }

      nodes.forEach((node) => {
        (node as HTMLElement).style.visibility = direction > 0 ? "hidden" : "";
      });
      content.style.visibility = "";
      canvas.style.visibility = "hidden";

      const context = scene.gl;
      context.deleteTexture(scene.rest);
      context.deleteTexture(scene.sel);
      context.deleteBuffer(scene.grid);
      context.clearColor(0, 0, 0, 0);
      context.clear(context.COLOR_BUFFER_BIT);
    },
    [ensureGl],
  );

  const run = useCallback(
    (nodes: Element[], direction: number, options: BlackHoleOptions = {}) => {
      if (direction < 0) {
        nodes.forEach((node) => {
          (node as HTMLElement).style.visibility = "hidden";
        });
      }
      const finished = queue.current
        .then(() => transition(nodes, direction, options))
        .catch(() => {
          nodes.forEach((node) => {
            (node as HTMLElement).style.visibility = direction > 0 ? "hidden" : "";
          });
          if (canvasRef.current) canvasRef.current.style.visibility = "";
        });
      queue.current = finished;
      return finished;
    },
    [transition],
  );

  useImperativeHandle(
    ref,
    () => ({
      swallow: (nodes, options) => run(nodes, 1, options),
      release: (nodes, options) => run(nodes, -1, options),
    }),
    [run],
  );

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={style}>
      <div ref={contentRef} className={styles.content}>
        {children}
      </div>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden />
    </div>
  );
});

export default BlackHole;
