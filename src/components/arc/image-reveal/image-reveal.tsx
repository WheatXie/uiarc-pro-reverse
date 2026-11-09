"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { TargetAndTransition, Transition } from "motion/react";
import { Check, CircleAlert, RotateCcw } from "lucide-react";
import { Button } from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import type { Segment } from "../segmented-control/segmented-control";
import styles from "./image-reveal.module.css";

export type ImageRevealStatus = "queued" | "generating" | "decoding" | "done" | "error";
export type ImageRevealSize = "sm" | "md" | "lg";

export interface ImageRevealProps {
  src?: string;
  alt?: string;
  /** Controlled status. Leave undefined to let the component run its own loop. */
  status?: ImageRevealStatus;
  /** 0–1 override for the progressive reveal while generating. */
  progress?: number;
  duration?: number;
  decodeDuration?: number;
  steps?: number;
  aspectRatio?: number | string;
  size?: ImageRevealSize;
  color?: string;
  showProgress?: boolean;
  sheen?: boolean;
  queueLabel?: string;
  errorMessage?: string;
  autoPlay?: boolean;
  loop?: boolean;
  startDelay?: number;
  queueDuration?: number;
  holdDuration?: number;
  runKey?: number | string;
  seed?: number;
  onStatusChange?: (status: ImageRevealStatus) => void;
  onComplete?: () => void;
  onRetry?: () => void;
  className?: string;
  style?: CSSProperties;
}

/* -------------------------------------------------------------------------------------------------
 * Painter: a small progressive "diffusion" renderer. It keeps a pyramid of blurred levels of the
 * target image plus two noise frames, and composites whichever of them the animation asks for.
 * ---------------------------------------------------------------------------------------------- */

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
const smoothStart = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const rgba = (rgb: number[], alpha: number) => `rgba(${0 | rgb[0]}, ${0 | rgb[1]}, ${0 | rgb[2]}, ${alpha})`;

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function context2d(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

function downscale(source: HTMLCanvasElement, width: number, height: number) {
  const canvas = makeCanvas(width, height);
  context2d(canvas).drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Level widths the reveal crosses on its way from blurred to sharp. */
const LEVELS = [6, 12, 24, 48, 96];

interface NoiseFrames {
  previous: HTMLCanvasElement | null;
  current: HTMLCanvasElement | null;
}

class RevealPainter {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private seed: number;
  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;
  private image: HTMLImageElement | null = null;
  private pending: HTMLImageElement | null = null;
  private chain: HTMLCanvasElement[] = [];
  private sharp: HTMLCanvasElement | null = null;
  private snapshot: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;
  private palette: { base: number[]; highlight: number[]; veil: number[] } | null = null;
  private noiseStep = -1;
  private noiseFrames: NoiseFrames = { previous: null, current: null };
  private noiseBlend: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;
  private snapshotAlpha = 0;
  private dirty = true;

  constructor(canvas: HTMLCanvasElement, seed: number) {
    this.canvas = canvas;
    this.ctx = context2d(canvas);
    this.seed = seed;
  }

  get hasImage() {
    return this.sharp !== null;
  }

  get isDirty() {
    return this.dirty;
  }

  get snapshotAlphaValue() {
    return this.snapshotAlpha;
  }

  set snapshotAlphaValue(value: number) {
    this.snapshotAlpha = value;
  }

  get hasPending() {
    return this.pending !== null;
  }

  get ready() {
    return this.cssWidth > 0 && this.cssHeight > 0 && this.palette !== null;
  }

  setSeed(seed: number) {
    if (seed === this.seed) return;
    this.seed = seed;
    this.resetNoise();
    this.dirty = true;
  }

  resize(cssWidth: number, cssHeight: number, dpr: number) {
    if (cssWidth === this.cssWidth && cssHeight === this.cssHeight && dpr === this.dpr) return;
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.dpr = dpr;
    if (!cssWidth || !cssHeight) return;
    this.canvas.width = Math.round(cssWidth * dpr);
    this.canvas.height = Math.round(cssHeight * dpr);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
    this.snapshot = null;
    this.snapshotAlpha = 0;
    this.resetNoise();
    if (this.image) this.buildLevels();
    this.dirty = true;
  }

  setPalette(palette: { base: number[]; highlight: number[]; veil: number[] }) {
    this.palette = palette;
    this.dirty = true;
  }

  setImage(image: HTMLImageElement) {
    if (image === this.image) {
      this.pending = null;
      return;
    }
    this.pending = image;
  }

  swap(keepSnapshot: boolean) {
    if (!this.pending) return;
    if (keepSnapshot && this.canvas.width && this.canvas.height) {
      if (
        !this.snapshot ||
        this.snapshot.canvas.width !== this.canvas.width ||
        this.snapshot.canvas.height !== this.canvas.height
      ) {
        const canvas = makeCanvas(this.canvas.width, this.canvas.height);
        this.snapshot = { canvas, ctx: context2d(canvas) };
      }
      this.snapshot.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.snapshot.ctx.drawImage(this.canvas, 0, 0);
      this.snapshotAlpha = 1;
    }
    this.image = this.pending;
    this.pending = null;
    this.buildLevels();
    this.dirty = true;
  }

  setNoiseStep(step: number) {
    if (step === this.noiseStep || !this.cssWidth || !this.cssHeight) return;
    this.noiseStep = step;
    this.noiseFrames = { previous: this.noiseFrames.current, current: this.buildNoise(step) };
    this.dirty = true;
  }

  private resetNoise() {
    const step = this.noiseStep;
    this.noiseStep = -1;
    this.noiseFrames = { previous: null, current: null };
    this.noiseBlend = null;
    if (step >= 0) this.setNoiseStep(step);
  }

  private buildNoise(step: number) {
    const canvas = makeCanvas(
      Math.max(12, Math.round(this.cssWidth / 6)),
      Math.max(12, Math.round(this.cssHeight / 6)),
    );
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    const data = ctx.createImageData(canvas.width, canvas.height);
    let state = (104729 * this.seed + 7919 * step + 3) >>> 0;
    const random = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
    };
    const bell = () => random() + random() + random() - 1.5;
    for (let index = 0; index < canvas.width * canvas.height; index += 1) {
      const lift = 110 * bell();
      data.data[4 * index] = 128 + lift + 80 * bell();
      data.data[4 * index + 1] = 126 + lift + 70 * bell();
      data.data[4 * index + 2] = 130 + lift + 86 * bell();
      data.data[4 * index + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    if (!this.noiseBlend || this.noiseBlend.canvas.width !== canvas.width || this.noiseBlend.canvas.height !== canvas.height) {
      const blend = makeCanvas(canvas.width, canvas.height);
      const blendCtx = blend.getContext("2d");
      if (blendCtx) this.noiseBlend = { canvas: blend, ctx: blendCtx };
    }
    return canvas;
  }

  private buildLevels() {
    const image = this.image;
    const width = this.canvas.width;
    const height = this.canvas.height;
    if (!image || !width || !height) return;
    const boxRatio = width / height;
    const imageRatio = image.naturalWidth / image.naturalHeight;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;
    if (imageRatio > boxRatio) sourceWidth = sourceHeight * boxRatio;
    else sourceHeight = sourceWidth / boxRatio;
    const sourceX = (image.naturalWidth - sourceWidth) / 2;
    const sourceY = (image.naturalHeight - sourceHeight) / 2;

    const sharp = makeCanvas(width, height);
    context2d(sharp).drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);

    const pyramid = new Map<number, HTMLCanvasElement>();
    let current = downscale(sharp, Math.min(384, width), Math.min(384, width) / boxRatio);
    pyramid.set(current.width, current);
    while (current.width > LEVELS[0]) {
      const next = Math.max(LEVELS[0], Math.round(current.width / 2));
      current = downscale(current, next, Math.max(2, Math.round(next / boxRatio)));
      pyramid.set(current.width, current);
    }

    this.chain = LEVELS.map((target, index) => {
      const size = Math.min(index === LEVELS.length - 1 ? 384 : 192, width);
      let source = current;
      for (const [levelWidth, canvas] of pyramid) {
        if (Math.abs(levelWidth - target) < Math.abs(source.width - target)) source = canvas;
      }
      let scaled = source;
      while (2 * scaled.width < size) scaled = downscale(scaled, 2 * scaled.width, 2 * scaled.height);
      return downscale(scaled, size, Math.max(2, Math.round(size / boxRatio)));
    });
    this.sharp = sharp;
  }

  render(frame: {
    bloom: number;
    detail: number;
    noise: number;
    noiseMix: number;
    decode: number;
    hide: number;
    shimmer: number;
    time: number;
    sheen: number;
    error: number;
    reduced: boolean;
  }) {
    const { ctx } = this;
    const palette = this.palette;
    const width = this.canvas.width;
    const height = this.canvas.height;
    if (!palette || !width || !height) return;
    this.dirty = false;
    const { time, reduced } = frame;
    const bloom = this.sharp ? clamp01(frame.bloom) : 0;

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(palette.base, 1);
    ctx.fillRect(0, 0, width, height);

    if (frame.shimmer > 0.002 && bloom < 0.999) {
      const phase = smoothStart(
        (reduced ? 0.42 : ((((time + 0.14 * this.seed) % 2.6) + 2.6) % 2.6) / 2.6) / 0.82,
      );
      const span = width + height;
      const center = -0.45 * span + 1.9 * phase * span;
      const half = 0.42 * span;
      const gradient = ctx.createLinearGradient(
        center - half,
        0.35 * center - 0.35 * half,
        center + half,
        0.35 * center + 0.35 * half,
      );
      const alpha = frame.shimmer * (1 - bloom) * (reduced ? 0.5 : 1);
      gradient.addColorStop(0, rgba(palette.highlight, 0));
      gradient.addColorStop(0.5, rgba(palette.highlight, alpha));
      gradient.addColorStop(1, rgba(palette.highlight, 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    if (bloom > 0.002 && this.sharp && this.chain.length) {
      const chain = this.chain;
      const level = clamp01(frame.detail) * (chain.length - 1);
      const lower = Math.min(chain.length - 1, Math.floor(level));
      const upper = Math.min(chain.length - 1, lower + 1);
      const mix = level - lower;
      ctx.globalAlpha = bloom;
      ctx.drawImage(chain[lower], 0, 0, width, height);
      if (upper !== lower && mix > 0.002) {
        ctx.globalAlpha = bloom * mix;
        ctx.drawImage(chain[upper], 0, 0, width, height);
      }

      const noiseAlpha = clamp01(frame.noise) * bloom;
      const { previous, current } = this.noiseFrames;
      if (noiseAlpha > 0.003 && current && this.noiseBlend) {
        const blend = this.noiseBlend;
        const noiseMix = previous ? clamp01(frame.noiseMix) : 1;
        blend.ctx.globalAlpha = 1;
        blend.ctx.drawImage(previous && noiseMix < 0.999 ? previous : current, 0, 0);
        if (previous && noiseMix < 0.999) {
          blend.ctx.globalAlpha = noiseMix;
          blend.ctx.drawImage(current, 0, 0);
        }
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = noiseAlpha;
        ctx.drawImage(blend.canvas, 0, 0, width, height);
        ctx.imageSmoothingEnabled = true;
      }

      const visible = bloom * (1 - clamp01(frame.hide));
      const decode = clamp01(frame.decode);
      if (visible > 0.002 && decode > 0.002) {
        if (reduced || decode >= 0.999) {
          ctx.globalAlpha = visible * (reduced ? smoothStart(decode) : 1);
          ctx.drawImage(this.sharp, 0, 0);
        } else {
          const columns = this.cssWidth >= 320 ? 4 : 3;
          const rows = Math.max(2, Math.round((columns * this.cssHeight) / this.cssWidth));
          const tiles = columns * rows;
          const painted = decode * (tiles + 2.2);
          for (let index = 0; index < tiles && index < painted; index += 1) {
            const local = smoothStart((painted - index) / 2.2);
            if (local <= 0.002) continue;
            const col = index % columns;
            const row = Math.floor(index / columns);
            const x = Math.round((col / columns) * width);
            const y = Math.round((row / rows) * height);
            const w = Math.round(((col + 1) / columns) * width) - x;
            const h = Math.round(((row + 1) / rows) * height) - y;
            ctx.globalAlpha = visible * local;
            ctx.drawImage(this.sharp, x, y, w, h, x, y, w, h);
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    if (frame.sheen >= 0 && frame.sheen < 1 && !reduced && bloom > 0.5) {
      const phase = smoothStart(frame.sheen);
      const span = width + height;
      const center = -0.3 * span + 1.6 * phase * span;
      const half = 0.2 * span;
      const gradient = ctx.createLinearGradient(center - half, (center - half) * 0.5, center + half, (center + half) * 0.5);
      const alpha = 0.42 * Math.sin(Math.PI * frame.sheen);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
      gradient.addColorStop(0.5, `rgba(255, 255, 255, ${alpha})`);
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
    }

    if (this.snapshot && this.snapshotAlpha > 0.002) {
      ctx.globalAlpha = this.snapshotAlpha;
      ctx.drawImage(this.snapshot.canvas, 0, 0);
      ctx.globalAlpha = 1;
    }

    if (frame.error > 0.002) {
      ctx.globalCompositeOperation = "saturation";
      ctx.globalAlpha = 0.9 * frame.error;
      ctx.fillStyle = "rgb(128, 128, 128)";
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.72 * frame.error;
      ctx.fillStyle = rgba(palette.veil, 1);
      ctx.fillRect(0, 0, width, height);
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  dispose() {
    this.chain = [];
    this.sharp = null;
    this.image = null;
    this.pending = null;
    this.snapshot = null;
    this.noiseFrames = { previous: null, current: null };
    this.noiseBlend = null;
  }
}

/** Resolves any CSS colour (including theme tokens) to RGB by painting one pixel. */
let swatch: CanvasRenderingContext2D | null = null;
function sampleColor(element: HTMLElement, color: string) {
  element.style.color = "";
  element.style.color = color;
  const resolved = getComputedStyle(element).color;
  if (!swatch) {
    swatch = makeCanvas(1, 1).getContext("2d", { willReadFrequently: true });
  }
  if (!swatch) return [128, 128, 128];
  swatch.clearRect(0, 0, 1, 1);
  swatch.fillStyle = "#808080";
  swatch.fillStyle = resolved;
  swatch.fillRect(0, 0, 1, 1);
  const { data } = swatch.getImageData(0, 0, 1, 1);
  return [data[0], data[1], data[2]];
}

const CIRCUMFERENCE = 2 * Math.PI * 8;
const CHIP_SPRING: Transition = { type: "spring", visualDuration: 0.24, bounce: 0 };
const ENTER: Transition = { duration: 0.16, ease: [0.22, 1, 0.36, 1] };
const ENTER_DELAYED: Transition = { ...ENTER, delay: 0.06 };
const LEAVE: Transition = { duration: 0.1, ease: [0.4, 0, 1, 1] };

/** Frame-rate independent exponential approach, snapped once it is close enough. */
function approach(current: number, target: number, delta: number, tau: number, epsilon = 8e-4) {
  const next = current + (target - current) * (1 - Math.exp(-delta / tau));
  return Math.abs(target - next) < epsilon ? target : next;
}

const seconds = (value: number) => `${value.toFixed(1)}s`;

/** Photo registry shared with the rest of the site; ids come from the demo prompts. */
/** Prompt rotation order; ids resolve through the registry below. */
const PHOTO_ORDER = [
  "alpine-lake",
  "terracotta-waves",
  "ceramic-lamp",
  "sea-at-dusk",
  "lisbon-rooftops",
];

const PHOTOS: Record<string, { id: string; alt: string; src: string }> = {
  "lounge-chair": { id: "lounge-chair", alt: "A woven oak lounge chair with a sheepskin and linen cushion on a concrete floor", src: "/media/photos/lounge-chair.jpg" },
  "table-lamp": { id: "table-lamp", alt: "A white mushroom table lamp glowing beside books and a small vase", src: "/media/photos/table-lamp.jpg" },
  "linen-throw": { id: "linen-throw", alt: "Folded natural linen throws with fringed edges in soft window light", src: "/media/photos/linen-throw.jpg" },
  "glass-carafe": { id: "glass-carafe", alt: "A hand pouring water from a ribbed glass carafe into tumblers", src: "/media/photos/glass-carafe.jpg" },
  "stoneware-cups": { id: "stoneware-cups", alt: "Two speckled stoneware cups with a lid on a pale table", src: "/media/photos/stoneware-cups.jpg" },
  "stacked-bowls": { id: "stacked-bowls", alt: "Two stacked speckled ceramic bowls against a dark wall", src: "/media/photos/stacked-bowls.jpg" },
  "ceramic-lamp": { id: "ceramic-lamp", alt: "A sculptural ceramic lamp with a linen shade on a walnut sideboard", src: "/media/photos/ceramic-lamp.jpg" },
  "living-room": { id: "living-room", alt: "A bright living room with timber beams, arched windows, and cream sofas", src: "/media/photos/living-room.jpg" },
  "sunroom": { id: "sunroom", alt: "A sunroom with a round dining table, plants, and windows on three sides", src: "/media/photos/sunroom.jpg" },
  "home-office": { id: "home-office", alt: "A home office with a wooden desk and deep green walls", src: "/media/photos/home-office.jpg" },
  "reading-chair": { id: "reading-chair", alt: "A grey armchair and ottoman with a knit throw in a dark green room", src: "/media/photos/reading-chair.jpg" },
  "bedroom": { id: "bedroom", alt: "A made bed with striped linen pillows against an oak headboard", src: "/media/photos/bedroom.jpg" },
  "restaurant": { id: "restaurant", alt: "A warm restaurant dining room with woven pendant lights and a tree", src: "/media/photos/restaurant.jpg" },
  "wine-bar": { id: "wine-bar", alt: "A glass carafe of red wine on a bar table in low evening light", src: "/media/photos/wine-bar.jpg" },
  "concert-hall": { id: "concert-hall", alt: "Curved stainless steel panels of the Walt Disney Concert Hall against a blue sky", src: "/media/photos/concert-hall.jpg" },
  "curved-facade": { id: "curved-facade", alt: "A white tiled building facade with curved balconies", src: "/media/photos/curved-facade.jpg" },
  "pool-house": { id: "pool-house", alt: "A modern glass house beside a long pool under a clear sky", src: "/media/photos/pool-house.jpg" },
  "terracotta-waves": { id: "terracotta-waves", alt: "Wavy terracotta walls rising toward a blue sky", src: "/media/photos/terracotta-waves.jpg" },
  "mountain-ridges": { id: "mountain-ridges", alt: "Layered mountain ridges under a warm evening sky", src: "/media/photos/mountain-ridges.jpg" },
  "alpine-lake": { id: "alpine-lake", alt: "A calm alpine lake reflecting a rocky peak at golden hour", src: "/media/photos/alpine-lake.jpg" },
  "coastline": { id: "coastline", alt: "A long coastline with waves rolling onto a beach below green cliffs", src: "/media/photos/coastline.jpg" },
  "sea-at-dusk": { id: "sea-at-dusk", alt: "A calm sea at dusk with a low island on the horizon", src: "/media/photos/sea-at-dusk.jpg" },
  "lisbon-tram": { id: "lisbon-tram", alt: "A yellow tram on a street lined with historic buildings in Lisbon", src: "/media/photos/lisbon-tram.jpg" },
  "lisbon-bridge": { id: "lisbon-bridge", alt: "The 25 de Abril Bridge crossing the Tagus in Lisbon", src: "/media/photos/lisbon-bridge.jpg" },
  "lisbon-rooftops": { id: "lisbon-rooftops", alt: "Terracotta rooftops of Lisbon running down to the river", src: "/media/photos/lisbon-rooftops.jpg" },
  "salmon-dinner": { id: "salmon-dinner", alt: "Seared salmon with a bright herb salsa and a glass of red wine", src: "/media/photos/salmon-dinner.jpg" },
  "chef-plating": { id: "chef-plating", alt: "A chef spooning sauce onto a plated dish in a dark kitchen", src: "/media/photos/chef-plating.jpg" },
};

const photoById = (id: string) => {
  const found = PHOTOS[id];
  if (!found) throw new Error(`Unknown photo: ${id}`);
  return found;
};

export function ImageReveal({
  src,
  alt,
  status,
  progress,
  duration = 4600,
  decodeDuration = 560,
  steps = 30,
  aspectRatio = 1,
  size = "md",
  color,
  showProgress = true,
  sheen = true,
  queueLabel = "Queued",
  errorMessage = "Generation failed",
  autoPlay = true,
  loop = true,
  startDelay = 0,
  queueDuration = 900,
  holdDuration = 2600,
  runKey,
  seed = 1,
  onStatusChange,
  onComplete,
  onRetry,
  className,
  style,
}: ImageRevealProps) {
  const reduced = useReducedMotion() ?? false;
  const uncontrolled = status === undefined;

  const [autoStatus, setAutoStatus] = useState<ImageRevealStatus>("queued");
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [settled, setSettled] = useState(false);
  const [doneMs, setDoneMs] = useState(0);
  const [chipWidth, setChipWidth] = useState<number | undefined>(undefined);
  const statusValue = uncontrolled ? autoStatus : status;

  const [cycle, setCycle] = useState(0);
  const fallback = photoById(PHOTO_ORDER[cycle % PHOTO_ORDER.length]);
  const resolvedSrc = src ?? fallback.src;
  const resolvedAlt = alt ?? (src ? "Generated image" : fallback.alt);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const probeRef = useRef<HTMLSpanElement | null>(null);
  const arcRef = useRef<SVGCircleElement | null>(null);
  const chipContentRef = useRef<HTMLSpanElement | null>(null);
  const painterRef = useRef<RevealPainter | null>(null);

  const frameRef = useRef({
    current: statusValue,
    auto: uncontrolled,
    progress,
    duration,
    decodeDuration,
    steps,
    autoPlay,
    loop,
    startDelay,
    queueDuration,
    holdDuration,
    runKey,
    reduced,
    sheen,
    hasSrc: src !== undefined,
    onComplete,
  });

  useLayoutEffect(() => {
    frameRef.current = {
      current: statusValue,
      auto: uncontrolled,
      progress,
      duration,
      decodeDuration,
      steps,
      autoPlay,
      loop,
      startDelay,
      queueDuration,
      holdDuration,
      runKey,
      reduced,
      sheen,
      hasSrc: src !== undefined,
      onComplete,
    };
  });

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const painter = new RevealPainter(canvas, seed);
    painterRef.current = painter;

    const state = {
      bloom: 0,
      shown: 0,
      detail: 0,
      noise: 1,
      noiseMix: 1,
      decode: 0,
      hide: 0,
      shimmer: 1,
      error: 0,
      time: 0,
      speed: 1,
      sheen: -1,
      generated: 0,
      elapsed: 0,
      lastStatus: frameRef.current.current,
      phase: "wait" as "wait" | "generating" | "decoding" | "hold",
      phaseTime: 0,
      runKey: frameRef.current.runKey,
      wasAuto: frameRef.current.auto,
      firstRun: true,
      completed: false,
      doneTime: 0,
      settled: false,
      step: 0,
      drawn: "",
    };

    const reset = () => {
      state.phase = "wait";
      state.phaseTime = state.firstRun ? 0 : frameRef.current.startDelay;
      setAutoStatus("queued");
    };

    let frameId = 0;
    let last = 0;
    let visible = true;

    const tick = (now: number) => {
      const delta = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;

      const config = frameRef.current;
      if (config.runKey !== state.runKey || (config.auto && !state.wasAuto)) {
        state.runKey = config.runKey;
        state.firstRun = true;
        reset();
      }
      state.wasAuto = config.auto;

      if (config.auto && config.autoPlay) {
        state.phaseTime += 1000 * delta;
        if (
          state.phase === "wait" &&
          state.phaseTime >= config.startDelay + config.queueDuration &&
          painter.hasImage &&
          !painter.hasPending &&
          state.bloom < 0.02
        ) {
          state.phase = "generating";
          state.phaseTime = 0;
          state.generated = 0;
          setAutoStatus("generating");
        } else if (state.phase === "generating" && state.generated >= config.duration && state.shown > 0.995) {
          state.phase = "decoding";
          state.phaseTime = 0;
          setAutoStatus("decoding");
        } else if (state.phase === "decoding" && state.decode >= 1) {
          state.phase = "hold";
          state.phaseTime = 0;
          setAutoStatus("done");
        } else if (
          state.phase === "hold" &&
          config.loop &&
          state.completed &&
          state.phaseTime >= config.holdDuration
        ) {
          state.firstRun = false;
          reset();
          if (!config.hasSrc) setCycle((value) => value + 1);
        }
      }

      const current = config.current;
      if (current !== state.lastStatus) {
        if (current === "generating" && state.lastStatus !== "decoding") {
          state.generated = 0;
          state.elapsed = 0;
        }
        if (current !== "done") state.completed = false;
        state.lastStatus = current;
      }

      const finished = current === "decoding" || current === "done";
      let shown = state.shown;
      if (current === "queued") shown = 0;
      else if (current === "generating") {
        if (config.progress !== undefined) shown = Math.min(1, Math.max(0, config.progress));
        else {
          state.generated += 1000 * delta;
          shown = Math.min(1, state.generated / config.duration);
        }
      } else if (finished) shown = 1;
      if (current === "generating" || current === "decoding") state.elapsed += delta;

      const swapping = painter.hasPending && painter.hasImage;
      const rewinding = shown < state.shown - 0.02;
      state.hide = approach(
        state.hide,
        rewinding || swapping || current === "error" ? 1 : 0,
        delta,
        config.reduced ? 0.08 : current === "error" ? 0.2 : 0.1,
        0.004,
      );
      if (state.hide > 0.97) {
        if (painter.hasPending) painter.swap(state.bloom > 0.02);
        if (rewinding) state.shown = shown;
      }
      if (painter.hasPending && !painter.hasImage) painter.swap(false);
      if (!rewinding) {
        state.shown = config.auto && current === "generating" ? shown : approach(state.shown, shown, delta, config.reduced ? 0.12 : 0.16);
      }

      const nextStep = finished
        ? config.steps
        : current === "queued"
          ? 0
          : Math.min(config.steps, Math.max(1, Math.ceil(state.shown * config.steps - 0.001)));
      if (nextStep !== state.step) {
        state.step = nextStep;
        setStep(nextStep);
        if (nextStep > 0 && !config.reduced) {
          painter.setNoiseStep(nextStep);
          state.noiseMix = 0;
        }
      }
      if (config.reduced) painter.setNoiseStep(1);

      const ratio = config.steps > 0 ? state.step / config.steps : 0;
      const hasImageFor = current === "generating" || finished || current === "error";
      state.bloom = approach(state.bloom, painter.hasImage && hasImageFor ? 1 : 0, delta, current === "queued" ? 0.16 : 0.12, 0.002);
      state.detail = approach(
        state.detail,
        current === "queued" ? 0 : finished ? 1 : Math.pow(ratio, 0.55),
        delta,
        current === "queued" ? 0.2 : 0.07,
        0.001,
      );
      if (current === "queued") {
        state.noise = state.bloom < 0.02 ? 1 : state.noise;
      } else {
        state.noise = approach(state.noise, finished ? 0 : Math.pow(1 - ratio, 1.6), delta, 0.06, 0.001);
      }
      state.noiseMix = approach(state.noiseMix, 1, delta, 0.035, 0.002);
      if (finished && state.noise < 0.05 && state.hide < 0.05) {
        state.decode = Math.min(1, state.decode + delta / Math.max(0.05, config.decodeDuration / 1000));
      } else if (!finished) {
        state.decode = approach(state.decode, 0, delta, 0.1, 0.002);
      }
      state.shimmer = approach(state.shimmer, current === "queued" || !painter.hasImage ? 1 : 0, delta, 0.3, 0.002);
      state.error = approach(state.error, current === "error" ? 1 : 0, delta, 0.14, 0.002);
      painter.snapshotAlphaValue = approach(painter.snapshotAlphaValue, 0, delta, 0.16, 0.003);

      const speedTarget = config.reduced || current === "error" ? 0 : 1;
      state.speed = approach(state.speed, speedTarget, delta, 0.4, 0.002);
      state.time += delta * state.speed;

      const complete = current === "done" && state.decode >= 1 && state.hide === 0 && painter.hasImage && !painter.hasPending;
      if (complete && !state.completed) {
        state.completed = true;
        state.sheen = config.sheen && !config.reduced ? 0 : -1;
        setDoneMs(state.elapsed);
        config.onComplete?.();
      }
      if (state.sheen >= 0) {
        state.sheen += delta / 1.1;
        if (state.sheen >= 1 || !complete) state.sheen = -1;
      }

      const shimmering = state.speed > 0.01 && state.shimmer > 0.002 && state.bloom < 0.999;
      const signature = `${state.bloom}|${state.detail}|${state.noise}|${state.noiseMix}|${state.decode}|${state.hide}|${state.shimmer}|${state.error}|${state.sheen}|${painter.snapshotAlphaValue}|${config.reduced}`;
      if (painter.ready && (painter.isDirty || shimmering || signature !== state.drawn)) {
        painter.render({
          bloom: state.bloom,
          detail: state.detail,
          noise: state.noise,
          noiseMix: state.noiseMix,
          decode: state.decode,
          hide: state.hide,
          shimmer: state.shimmer,
          time: state.time,
          sheen: state.sheen,
          error: state.error,
          reduced: config.reduced,
        });
        state.drawn = signature;
      }
      if (arcRef.current) arcRef.current.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - state.shown));
      state.doneTime = complete ? state.doneTime + delta : 0;
      const isSettled = state.doneTime > 1.6;
      if (isSettled !== state.settled) {
        state.settled = isSettled;
        setSettled(isSettled);
      }

      frameId = requestAnimationFrame(tick);
    };

    const start = () => {
      if (frameId || !visible || document.hidden) return;
      last = 0;
      frameId = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frameId);
      frameId = 0;
    };

    const resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      painter.resize(Math.round(rect.width), Math.round(rect.height), Math.min(2, window.devicePixelRatio || 1));
    });
    resizeObserver.observe(root);

    const intersectionObserver = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) start();
      else stop();
    });
    intersectionObserver.observe(root);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      painter.dispose();
      painterRef.current = null;
    };
    // The renderer is created once; every changing input is read from frameRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    painterRef.current?.setSeed(seed);
  }, [seed]);

  useEffect(() => {
    const probe = probeRef.current;
    if (!probe) return;
    const read = () => {
      const base = sampleColor(probe, "var(--surface-muted, #eee)");
      const veil = sampleColor(probe, "var(--surface, var(--background, #fff))");
      const luminance = (0.2126 * base[0] + 0.7152 * base[1] + 0.0722 * base[2]) / 255;
      const white = [255, 255, 255];
      const amount = luminance > 0.5 ? 0.6 : 0.06;
      const highlight = [
        base[0] + (white[0] - base[0]) * amount,
        base[1] + (white[1] - base[1]) * amount,
        base[2] + (white[2] - base[2]) * amount,
      ];
      painterRef.current?.setPalette({ base, highlight, veil });
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", read);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", read);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.decoding = "async";
    image.src = resolvedSrc;
    image
      .decode()
      .catch(() => undefined)
      .then(() => {
        if (!cancelled && image.naturalWidth) painterRef.current?.setImage(image);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedSrc]);

  const reportedRef = useRef(statusValue);
  useEffect(() => {
    if (reportedRef.current === statusValue) return;
    reportedRef.current = statusValue;
    onStatusChange?.(statusValue);
  }, [statusValue, onStatusChange]);

  // The chip is a motion element whose width springs to the measured content, so the content has to
  // report its own width whenever it swaps (Queued → Denoising → Done).
  const chipObserver = useRef<ResizeObserver | null>(null);
  const measureChip = useCallback((element: HTMLSpanElement | null) => {
    chipObserver.current?.disconnect();
    chipObserver.current = null;
    chipContentRef.current = element;
    if (!element) return;
    const observer = new ResizeObserver(() => setChipWidth(element.offsetWidth + 2));
    observer.observe(element);
    chipObserver.current = observer;
  }, []);
  useEffect(() => () => chipObserver.current?.disconnect(), []);

  const small = size === "sm";
  const showChip = showProgress && statusValue !== "error" && !(statusValue === "done" && settled);
  const simulated = uncontrolled ? ", simulated" : "";
  const phaseLabel =
    statusValue === "queued"
      ? queueLabel
      : statusValue === "generating"
        ? "Generating image"
        : statusValue === "decoding"
          ? "Decoding image"
          : statusValue === "done"
            ? "Image ready"
            : errorMessage;
  const doneLabel = doneMs > 0.05 ? (small ? seconds(doneMs) : `Done in ${seconds(doneMs)}`) : "Done";
  const ariaLabel = statusValue === "done" ? resolvedAlt : `${phaseLabel}${resolvedAlt ? `: ${resolvedAlt}` : ""}`;

  const phaseTransition = (entering: boolean): Transition =>
    reduced ? { duration: 0.12 } : entering ? ENTER_DELAYED : LEAVE;
  const phaseMotion: Record<"initial" | "animate" | "exit", TargetAndTransition> = {
    initial: { opacity: 0, y: 2 },
    animate: { opacity: 1, y: 0, transition: phaseTransition(true) },
    exit: { opacity: 0, y: -2, transition: phaseTransition(false) },
  };

  let chipContent: ReactNode = null;
  if (statusValue === "queued") {
    chipContent = (
      <motion.span key="queued" className={styles.phase} {...phaseMotion}>
        <svg className={`${styles.ring} ${styles.spin}`} viewBox="0 0 20 20" aria-hidden="true">
          <circle className={styles.ringTrack} cx="10" cy="10" r={8} fill="none" strokeWidth="2.5" />
          <circle className={styles.ringArc} cx="10" cy="10" r={8} fill="none" strokeWidth="2.5" strokeDasharray={`${0.22 * CIRCUMFERENCE} ${CIRCUMFERENCE}`} />
        </svg>
        <span className={styles.text}>{queueLabel}</span>
      </motion.span>
    );
  } else if (statusValue === "generating") {
    chipContent = (
      <motion.span
        key="generating"
        className={styles.phase}
        role="progressbar"
        aria-label="Generation progress"
        aria-valuemin={0}
        aria-valuemax={steps}
        aria-valuenow={step}
        aria-valuetext={`Step ${step} of ${steps}`}
        {...phaseMotion}
      >
        <svg className={styles.ring} viewBox="0 0 20 20" aria-hidden="true">
          <circle className={styles.ringTrack} cx="10" cy="10" r={8} fill="none" strokeWidth="2.5" />
          <circle
            ref={arcRef}
            className={styles.ringArc}
            cx="10"
            cy="10"
            r={8}
            fill="none"
            strokeWidth="2.5"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE}
          />
        </svg>
        {small ? null : <span className={styles.text}>Denoising</span>}
        <span className={`${styles.reserve} ${small ? "" : styles.count}`}>
          <span className={styles.ghost} aria-hidden="true">
            {steps} / {steps}
          </span>
          <span>
            {step} / {steps}
          </span>
        </span>
      </motion.span>
    );
  } else if (statusValue === "decoding") {
    chipContent = (
      <motion.span key="decoding" className={styles.phase} {...phaseMotion}>
        <svg className={`${styles.ring} ${styles.spin}`} viewBox="0 0 20 20" aria-hidden="true">
          <circle className={styles.ringTrack} cx="10" cy="10" r={8} fill="none" strokeWidth="2.5" />
          <circle className={styles.ringArc} cx="10" cy="10" r={8} fill="none" strokeWidth="2.5" strokeDasharray={`${0.3 * CIRCUMFERENCE} ${CIRCUMFERENCE}`} />
        </svg>
        <span className={styles.text}>Decoding</span>
      </motion.span>
    );
  } else {
    chipContent = (
      <motion.span key="done" className={styles.phase} {...phaseMotion}>
        <Check className={styles.doneIcon} aria-hidden="true" strokeWidth={2.25} />
        <span className={styles.text}>{doneLabel}</span>
      </motion.span>
    );
  }

  return (
    <div
      ref={rootRef}
      className={[styles.root, styles[size], className].filter(Boolean).join(" ")}
      style={{ aspectRatio: typeof aspectRatio === "number" ? String(aspectRatio) : aspectRatio, ...(color ? ({ "--ir-accent": color } as CSSProperties) : null), ...style }}
      data-status={statusValue}
    >
      <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={ariaLabel} />
      <span ref={probeRef} className={styles.probe} aria-hidden="true" />
      <AnimatePresence initial={false}>
        {showChip ? (
          <motion.div
            key="chip"
            className={styles.chip}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0, width: chipWidth }}
            exit={{ opacity: 0, y: 2, transition: reduced ? { duration: 0.12 } : { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
            transition={reduced ? { duration: 0 } : { opacity: ENTER, y: ENTER, width: CHIP_SPRING }}
          >
            <span ref={measureChip} className={styles.chipContent}>
              <AnimatePresence mode="popLayout" initial={false}>
                {chipContent}
              </AnimatePresence>
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {statusValue === "error" ? (
          <motion.div
            key="error"
            className={styles.errorLayer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduced ? { duration: 0.12 } : { duration: 0.2 }}
          >
            <motion.div
              className={styles.errorBody}
              initial={reduced ? false : { y: 3 }}
              animate={{ y: 0 }}
              transition={reduced ? { duration: 0 } : CHIP_SPRING}
            >
              <span className={styles.errorTitle}>
                <CircleAlert className={styles.errorIcon} aria-hidden="true" strokeWidth={2} />
                <span>{small ? "Failed" : errorMessage}</span>
              </span>
              {onRetry ? (
                <Button variant="secondary" size="sm" onClick={onRetry} aria-label={small ? "Retry generation" : undefined}>
                  <RotateCcw aria-hidden="true" />
                  Retry
                </Button>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {`${phaseLabel}${simulated}`}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Demo: three prompts, four tiles each, with a state switcher underneath.
 * ---------------------------------------------------------------------------------------------- */

const PROMPTS = [
  { prompt: "Quiet landscapes at golden hour", photos: ["alpine-lake", "mountain-ridges", "sea-at-dusk", "coastline"] },
  { prompt: "Warm ceramics in soft window light", photos: ["ceramic-lamp", "stoneware-cups", "glass-carafe", "lounge-chair"] },
  { prompt: "Sunlit architecture, Lisbon and beyond", photos: ["terracotta-waves", "lisbon-rooftops", "curved-facade", "living-room"] },
];

const STATES: Segment[] = [
  { value: "live", label: "Live" },
  { value: "queued", label: "Queued" },
  { value: "done", label: "Done" },
  { value: "error", label: "Error" },
];

export function ImageRevealDemo() {
  const [state, setState] = useState("live");
  const [run, setRun] = useState(0);
  const [failed, setFailed] = useState<number[]>([]);
  const completed = useRef(new Set<number>());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const prompt = PROMPTS[run % PROMPTS.length];
  const seed = 48213 + 7351 * run;

  const restart = useCallback(() => {
    clearTimeout(timer.current);
    completed.current.clear();
    setFailed([]);
    setState("live");
    setRun((value) => value + 1);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className={styles.demo}>
      <div className={styles.header}>
        <div className={styles.copy}>
          <p className={styles.prompt}>{prompt.prompt}</p>
          <p className={styles.meta}>{`Seed ${seed}, 30 steps, batch of 4. Simulated.`}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={restart}>
          <RotateCcw aria-hidden="true" />
          Generate again
        </Button>
      </div>
      <div className={styles.grid}>
        {prompt.photos.map((id, index) => {
          const photo = photoById(id);
          return (
            <ImageReveal
              key={index}
              className={styles.tile}
              src={photo.src}
              alt={photo.alt}
              size="sm"
              seed={seed + index}
              status={
                state === "queued"
                  ? "queued"
                  : state === "done"
                    ? "done"
                    : state === "error"
                      ? index % 2 !== 1 || failed.includes(index)
                        ? failed.includes(index)
                          ? undefined
                          : "done"
                        : "error"
                      : undefined
              }
              runKey={run}
              loop={false}
              queueDuration={650}
              duration={4200}
              queueLabel={state === "queued" ? "Queued, 2 ahead" : "Queued"}
              onComplete={() => {
                if (state !== "live") return;
                completed.current.add(index);
                if (completed.current.size === prompt.photos.length) {
                  clearTimeout(timer.current);
                  timer.current = setTimeout(restart, 3200);
                }
              }}
              onRetry={() => setFailed((value) => [...value, index])}
            />
          );
        })}
      </div>
      <div className={styles.footer}>
        <SegmentedControl
          label="Generation state"
          options={STATES}
          value={state}
          onValueChange={(next) => {
            clearTimeout(timer.current);
            completed.current.clear();
            setFailed([]);
            setState(next);
          }}
        />
      </div>
    </div>
  );
}

export default ImageReveal;
