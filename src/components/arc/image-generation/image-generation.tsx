"use client";

/**
 * Image generation — an image studio where each image forms on a dot matrix.
 *
 * A soft halftone wave breathes across a grid of neutral dots; the dots take the colours of the coming
 * photo and grow into a coloured halftone, then blur away into the sharp photo. One large canvas with a
 * mono size label, a filmstrip of four variations, a prompt bar with model and ratio chips, and upscale
 * with a sweeping dot band, vary or download. With no props it runs a local simulation on sample photos.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode, RefObject, SVGProps } from "react";
import { AnimatePresence, animate, motion, motionValue, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from "motion/react";
import type { MotionValue } from "motion/react";
import { Check, CircleAlert, Download, Maximize2, RotateCcw, Shuffle, Sparkles, Square } from "lucide-react";
import { Button } from "../button/button";
import { Tooltip } from "../tooltip/tooltip";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./image-generation.module.css";

export interface ImageGenerationModel {
  id: string;
  name: string;
  /** 16px provider mark shown on collapsed chips and beside the chosen name. */
  mark?: ReactNode;
}

export interface ImageGenerationAspect {
  id: string;
  label: string;
  /** Pixel width a generation returns at this shape. */
  width: number;
  /** Pixel height a generation returns at this shape. */
  height: number;
}

export interface ImageGenerationImage {
  id: string;
  src: string;
  alt: string;
  width?: number;
  height?: number;
  seed?: number;
}

export interface ImageGenerationRequest {
  prompt: string;
  model: ImageGenerationModel;
  aspect: ImageGenerationAspect;
  /** Variation index in the batch, 0 based. */
  index: number;
  /** Variations requested at once. */
  count: number;
  /** Set for Vary and Retry: the image the new variations follow. */
  variationOf?: ImageGenerationImage;
}

export interface ImageGenerationContext {
  signal: AbortSignal;
  /** Report 0 to 1, optionally with a preview: the dots sample their colours from it. */
  onProgress(progress: number, preview?: string): void;
}

export interface ImageGenerationProps {
  /** Controlled prompt. Pair with onPromptChange. */
  prompt?: string;
  /** Starting prompt when uncontrolled. */
  defaultPrompt?: string;
  /** Fires as the person types or picks a suggestion. */
  onPromptChange?: (prompt: string) => void;
  /** Models offered as chips: { id, name, mark? }. The chosen chip shows its name, the others collapse to their 16px mark with a tooltip. */
  models?: ImageGenerationModel[];
  /** Controlled model id. Pair with onModelChange. */
  model?: string;
  /** Starting model id when uncontrolled. */
  defaultModel?: string;
  /** Fires when a model chip is chosen. */
  onModelChange?: (id: string) => void;
  /** Output shapes: { id, label, width, height }. Width and height are the pixels a generation returns, drive the canvas shape and show in the size label. */
  aspectRatios?: ImageGenerationAspect[];
  /** Controlled aspect id. Pair with onAspectRatioChange. */
  aspectRatio?: string;
  /** Starting aspect id when uncontrolled. */
  defaultAspectRatio?: string;
  /** Fires when an aspect chip is chosen. Before the first generation the canvas springs to the new shape; after that the shape applies to the next generation. */
  onAspectRatioChange?: (id: string) => void;
  /** Produces one image. Called once per variation, in parallel, for Generate, Vary and Retry. Report progress from 0 to 1, optionally with a preview URL; reject to mark that variation failed; the signal aborts on Stop or Escape. */
  onGenerate?: (request: ImageGenerationRequest, context: ImageGenerationContext) => Promise<ImageGenerationImage>;
  /** Upscales the image on the canvas. Return the new image with its width and height. */
  onUpscale?: (image: ImageGenerationImage, context: ImageGenerationContext) => Promise<ImageGenerationImage>;
  /** Replaces the built in download. */
  onDownload?: (image: ImageGenerationImage) => void;
  /** Fires with the image on the canvas, and with null when a new batch starts. */
  onSelect?: (image: ImageGenerationImage | null) => void;
  /** Prompts offered on the empty canvas before the first generation. */
  suggestions?: string[];
  /** Generates once when the card first scrolls into view, unless someone has already touched it. Defaults to true with the simulation and false with onGenerate. */
  autoGenerate?: boolean;
  /** Prompt placeholder. */
  placeholder?: string;
  /** Class on the card. */
  className?: string;
}

interface Tile {
  key: string;
  status: "running" | "done" | "error" | "stopped";
  progress: MotionValue<number>;
  startedAt: number;
  endedAt?: number;
  preview?: string;
  image?: ImageGenerationImage;
  upscaled?: ImageGenerationImage;
  error?: string;
}

interface BatchVariation {
  image: ImageGenerationImage;
  index: number;
}

interface Batch {
  id: number;
  prompt: string;
  model: ImageGenerationModel;
  aspect: ImageGenerationAspect;
  variationOf?: BatchVariation;
  tiles: Tile[];
  startedAt: number;
  endedAt?: number;
}

interface Grid {
  w: number;
  h: number;
  dpr: number;
  cols: number;
  rows: number;
  ox: number;
  oy: number;
}

const OPENAI_PATH = "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z";
const GEMINI_PATH = "M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z";
const XAI_PATH = "M6.469 8.776L16.512 23h-4.464L2.005 8.776H6.47zm-.004 7.9l2.233 3.164L6.467 23H2l4.465-6.324zM22 2.582V23h-3.659V7.764L22 2.582zM22 1l-9.952 14.095-2.233-3.163L17.533 1H22z";

interface MarkProps extends SVGProps<SVGSVGElement> {
  title?: string;
}

function OpenAIMark({ title = "OpenAI", ...props }: MarkProps) {
  return <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}><path d={OPENAI_PATH} /></svg>;
}

function GeminiMark({ title = "Gemini", ...props }: MarkProps) {
  const raw = useId();
  const uid = raw.replace(/[^a-zA-Z0-9_-]/g, "");
  return <svg viewBox="0 0 24 24" role="img" aria-label={title} {...props}>
    <path d={GEMINI_PATH} fill="#3186FF" />
    <path d={GEMINI_PATH} fill={`url(#lobe-icons-gemini-0-${uid})`} />
    <path d={GEMINI_PATH} fill={`url(#lobe-icons-gemini-1-${uid})`} />
    <path d={GEMINI_PATH} fill={`url(#lobe-icons-gemini-2-${uid})`} />
    <defs>
      <linearGradient gradientUnits="userSpaceOnUse" id={`lobe-icons-gemini-0-${uid}`} x1="7" x2="11" y1="15.5" y2="12">
        <stop stopColor="#08B962" />
        <stop offset="1" stopColor="#08B962" stopOpacity="0" />
      </linearGradient>
      <linearGradient gradientUnits="userSpaceOnUse" id={`lobe-icons-gemini-1-${uid}`} x1="8" x2="11.5" y1="5.5" y2="11">
        <stop stopColor="#F94543" />
        <stop offset="1" stopColor="#F94543" stopOpacity="0" />
      </linearGradient>
      <linearGradient gradientUnits="userSpaceOnUse" id={`lobe-icons-gemini-2-${uid}`} x1="3.5" x2="17.5" y1="13.5" y2="12">
        <stop stopColor="#FABC12" />
        <stop offset=".46" stopColor="#FABC12" stopOpacity="0" />
      </linearGradient>
    </defs>
  </svg>;
}

function XAIMark({ title = "xAI", ...props }: MarkProps) {
  return <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" role="img" aria-label={title} {...props}><path d={XAI_PATH} /></svg>;
}

const markProps = { width: 16, height: 16, "aria-hidden": true } as const;

export const imageGenerationModels: ImageGenerationModel[] = [
  { id: "gpt-image", name: "GPT Image", mark: <OpenAIMark {...markProps} /> },
  { id: "gemini-image", name: "Gemini Image", mark: <GeminiMark {...markProps} /> },
  { id: "grok-imagine", name: "Grok Imagine", mark: <XAIMark {...markProps} /> },
];

export const imageGenerationAspects: ImageGenerationAspect[] = [
  { id: "1:1", label: "1:1", width: 1024, height: 1024 },
  { id: "4:5", label: "4:5", width: 1024, height: 1280 },
  { id: "16:9", label: "16:9", width: 1536, height: 864 },
];

const SUGGESTIONS = [
  "Sculptural architecture, curved facades and terracotta waves against a clear blue sky",
  "Speckled stoneware cups and bowls on a pale table, soft window light",
  "Sunlit reading corner, woven oak lounge chair, linen throws, ceramic lamp",
];

const photo = (id: string, alt: string): ImageGenerationImage => ({ id, src: `/media/photos/${id}.jpg`, alt });

const PHOTO_GROUPS: { words: string[]; photos: ImageGenerationImage[] }[] = [
  {
    words: ["lake", "mountain", "coast", "sea", "alpine", "dusk", "beach", "ridge", "peak", "landscape", "ocean", "nature", "golden hour", "film"],
    photos: [
      photo("alpine-lake", "A calm alpine lake reflecting a rocky peak glowing at golden hour"),
      photo("mountain-ridges", "Hazy layered mountain ridges under a warm evening sky"),
      photo("coastline", "A long coastline with waves rolling onto a beach below green cliffs"),
      photo("sea-at-dusk", "A calm sea at dusk with a lighthouse on a low island"),
    ],
  },
  {
    words: ["room", "nook", "chair", "lamp", "interior", "living", "bed", "sofa", "linen", "reading", "corner", "cozy", "office"],
    photos: [
      photo("lounge-chair", "A woven oak lounge chair with a sheepskin and linen cushion on a concrete floor"),
      photo("ceramic-lamp", "A sculptural ceramic lamp with a linen shade on a walnut sideboard"),
      photo("linen-throw", "Folded natural linen throws with fringed edges in soft window light"),
      photo("reading-chair", "A grey armchair and ottoman with a knit throw in a dark green room"),
      photo("living-room", "A bright living room with timber beams, arched windows, and cream sofas"),
      photo("sunroom", "A sunroom with a round dining table, plants, and windows on three sides"),
      photo("bedroom", "A made bed with striped linen pillows against an oak headboard"),
      photo("home-office", "A home office with a wooden desk and deep green walls"),
    ],
  },
  {
    words: ["facade", "building", "architecture", "sculptural", "balcon", "concrete", "curved", "house", "pool", "terracotta", "wall", "tiled"],
    photos: [
      photo("terracotta-waves", "Wavy terracotta walls rising toward a blue sky"),
      photo("curved-facade", "A white tiled building facade with curved balconies"),
      photo("concert-hall", "Curved stainless steel panels of a concert hall against a blue sky"),
      photo("pool-house", "A modern glass house beside a long pool under a clear sky"),
    ],
  },
  {
    words: ["food", "dinner", "dish", "salmon", "restaurant", "wine", "chef", "plate", "meal", "kitchen"],
    photos: [
      photo("salmon-dinner", "Seared salmon with a bright herb salsa and a glass of red wine"),
      photo("chef-plating", "A chef spooning sauce onto a plated dish in a dark kitchen"),
      photo("wine-bar", "A glass carafe of red wine on a bar table in low evening light"),
      photo("restaurant", "A warm restaurant dining room with woven pendant lights and a tree"),
    ],
  },
  {
    words: ["cup", "bowl", "carafe", "stoneware", "ceramic", "product", "still life", "glass", "mug", "vase"],
    photos: [
      photo("stoneware-cups", "Two speckled stoneware cups with a lid on a pale table"),
      photo("stacked-bowls", "Two stacked speckled ceramic bowls against a dark wall"),
      photo("glass-carafe", "A hand pouring water from a ribbed glass carafe into tumblers"),
      photo("table-lamp", "A white mushroom table lamp glowing beside books and a small vase"),
    ],
  },
  {
    words: ["lisbon", "city", "street", "tram", "rooftop", "bridge", "town", "urban", "travel"],
    photos: [
      photo("lisbon-rooftops", "Terracotta rooftops of Lisbon running down to the river"),
      photo("lisbon-tram", "A yellow tram on a street lined with historic buildings in Lisbon"),
      photo("lisbon-bridge", "The 25 de Abril Bridge crossing the Tagus in Lisbon"),
      photo("curved-facade", "A white tiled building facade with curved balconies"),
    ],
  },
];

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (value: number) => value * value * (3 - 2 * value);
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
const TAU = 2 * Math.PI;
const SPRING = { type: "spring", visualDuration: 0.26, bounce: 0 } as const;
const QUICK = { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } as const;
const PILL_EXIT = { duration: 0.1, ease: [...motionTokens.ease.standard] } as const;
const INSTANT = { duration: 0 } as const;
const BAND_PROGRESS = (value: number) => -0.14 + 1.28 * clamp01(value);

let colorCtx: CanvasRenderingContext2D | null = null;

function readForeground(element: HTMLElement): [number, number, number] {
  const fallback: [number, number, number] = [23, 23, 23];
  if (typeof document === "undefined") return fallback;
  if (!colorCtx) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    colorCtx = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (!colorCtx) return fallback;
  colorCtx.clearRect(0, 0, 1, 1);
  colorCtx.fillStyle = "#000";
  colorCtx.fillStyle = getComputedStyle(element).getPropertyValue("--foreground").trim();
  colorCtx.fillRect(0, 0, 1, 1);
  const [r, g, b] = colorCtx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

const sampleCache = new Map<string, Promise<Uint8ClampedArray | null>>();

function samplePreview(src: string, cols: number, rows: number): Promise<Uint8ClampedArray | null> {
  const key = `${src}|${cols}|${rows}`;
  const cached = sampleCache.get(key);
  if (cached) return cached;
  const pending = new Promise<Uint8ClampedArray | null>((resolve) => {
    if (typeof document === "undefined" || cols < 1 || rows < 1) {
      resolve(null);
      return;
    }
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = cols;
        canvas.height = rows;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }
        const scale = Math.max(cols / image.naturalWidth, rows / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(image, (cols - width) / 2, (rows - height) / 2, width, height);
        resolve(ctx.getImageData(0, 0, cols, rows).data);
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });
  sampleCache.set(key, pending);
  if (sampleCache.size > 48) {
    const oldest = sampleCache.keys().next().value;
    if (oldest) sampleCache.delete(oldest);
  }
  return pending;
}

/** Sizes every canvas to the container at device pixel ratio and reports the dot grid inside it. */
function useGrid(container: RefObject<HTMLDivElement | null>, canvases: RefObject<HTMLCanvasElement | null>[], pitch: number, onGrid: (grid: Grid) => void) {
  const handler = useRef(onGrid);
  useEffect(() => {
    handler.current = onGrid;
  });
  useEffect(() => {
    const node = container.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const width = node.clientWidth;
      const height = node.clientHeight;
      if (!width || !height) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      for (const canvasRef of canvases) {
        const canvas = canvasRef.current;
        if (!canvas) continue;
        const w = Math.round(width * dpr);
        const h = Math.round(height * dpr);
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
      }
      const cols = Math.max(1, Math.floor(width / pitch));
      const rows = Math.max(1, Math.floor(height / pitch));
      handler.current({ w: width, h: height, dpr, cols, rows, ox: (width - cols * pitch) / 2 + pitch / 2, oy: (height - rows * pitch) / 2 + pitch / 2 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
    // The canvases are stable refs; only the dot pitch changes the grid maths.
  }, [container, pitch]);
}

function useVisible(ref: RefObject<HTMLDivElement | null>) {
  const visible = useRef(true);
  const listeners = useRef(new Set<() => void>());
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = !!entry?.isIntersecting;
      listeners.current.forEach(listener => listener());
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return { visible, listeners };
}

interface DotFieldProps {
  progress?: MotionValue<number>;
  preview?: string;
  phase: "idle" | "running" | "done" | "halted";
  reduced: boolean;
  seed?: number;
  pitch?: number;
  glow?: boolean;
  className?: string;
  canvasClassName?: string;
  glowClassName?: string;
  previewClassName?: string;
}

/** The dot matrix: a halftone wave that takes the preview's colours and dissolves into it. */
function DotField({ progress, preview, phase, reduced, seed = 0, pitch = 8, glow = true, className, canvasClassName, glowClassName, previewClassName }: DotFieldProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const glowCanvas = useRef<HTMLCanvasElement>(null);
  const previewImg = useRef<HTMLImageElement>(null);
  const grid = useRef<Grid | null>(null);
  const pixels = useRef<Uint8ClampedArray | null>(null);
  const colors = useRef<[number, number, number]>([23, 23, 23]);
  const time = useRef(0);
  const draw = useRef<() => void>(() => undefined);
  const { visible, listeners } = useVisible(wrap);

  useLayoutEffect(() => {
    draw.current = () => {
      const box = grid.current;
      const ctx = canvas.current?.getContext("2d");
      if (!box || !ctx) return;
      const amount = phase === "idle" ? 0 : clamp01(progress?.get() ?? 0);
      const glowCtx = glow && phase === "running" && !reduced ? glowCanvas.current?.getContext("2d") ?? null : null;
      const still = reduced || phase !== "running";
      const clock = time.current;
      const colour = reduced ? 0 : smoothstep(clamp01((amount - 0.2) / 0.58));
      const fade = phase === "done" ? 1 : reduced ? amount : smoothstep(clamp01((amount - 0.8) / 0.2));
      const wave = 1.7 * seed;
      const cx = still ? 0.5 : 0.5 + 0.26 * Math.sin(0.55 * clock + wave) + 0.06 * Math.sin(1.3 * clock + 2 * wave);
      const cy = still ? 0.5 : 0.5 + 0.2 * Math.cos(0.42 * clock + 1.3 * wave);
      const reach = (still ? 0.4 : 0.34 + 0.07 * Math.sin(1.25 * clock + wave)) * Math.max(box.w, box.h);
      const falloff = 1 / (reach * reach);
      const centreX = cx * box.w;
      const centreY = cy * box.h;
      const strength = 1 - 0.7 * colour;
      ctx.setTransform(box.dpr, 0, 0, box.dpr, 0, 0);
      ctx.clearRect(0, 0, box.w, box.h);
      if (glowCtx) {
        glowCtx.setTransform(box.dpr, 0, 0, box.dpr, 0, 0);
        glowCtx.clearRect(0, 0, box.w, box.h);
      }
      const [baseR, baseG, baseB] = colors.current;
      const sampled = colour > 0 ? pixels.current : null;
      const radius = pitch / 2;
      for (let row = 0; row < box.rows; row += 1) {
        const y = box.oy + row * pitch;
        for (let col = 0; col < box.cols; col += 1) {
          const x = box.ox + col * pitch;
          const dx = x - centreX;
          const dy = y - centreY;
          const waveAmount = Math.exp(-(dx * dx + dy * dy) * falloff) * strength;
          let dot = pitch * (0.1 + 0.17 * waveAmount);
          let alpha = 0.13 + 0.55 * waveAmount;
          let fill: string | null = null;
          if (sampled) {
            const i = (row * box.cols + col) * 4;
            const r = sampled[i];
            const g = sampled[i + 1];
            const b = sampled[i + 2];
            const mix = clamp01(colour * (0.8 + 0.45 * waveAmount));
            dot = lerp(dot, radius * (0.58 + 0.4 * (1 - (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255)), mix);
            alpha = lerp(alpha, 1, mix);
            fill = `rgb(${Math.round(lerp(baseR, r, mix))},${Math.round(lerp(baseG, g, mix))},${Math.round(lerp(baseB, b, mix))})`;
          }
          ctx.globalAlpha = alpha;
          ctx.fillStyle = fill ?? `rgb(${baseR},${baseG},${baseB})`;
          ctx.beginPath();
          ctx.arc(x, y, dot, 0, TAU);
          ctx.fill();
          if (glowCtx && waveAmount > 0.3) {
            glowCtx.globalAlpha = (waveAmount - 0.3) * 0.9;
            glowCtx.fillStyle = fill ?? `rgb(${baseR},${baseG},${baseB})`;
            glowCtx.beginPath();
            glowCtx.arc(x, y, 1.7 * dot, 0, TAU);
            glowCtx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
      if (glowCtx) glowCtx.globalAlpha = 1;
      const field = canvas.current;
      if (field) {
        field.style.opacity = `${1 - fade}`;
        field.style.filter = !reduced && fade > 0 && fade < 1 ? `blur(${(5 * fade).toFixed(2)}px)` : "";
      }
      if (glowCanvas.current) glowCanvas.current.style.opacity = glowCtx ? `${1 - fade}` : "0";
      const photo = previewImg.current;
      if (photo) {
        photo.style.opacity = `${fade}`;
        photo.style.filter = !reduced && fade < 1 ? `blur(${((1 - fade) * 12).toFixed(2)}px)` : "";
        photo.style.transform = !reduced && fade < 1 ? `scale(${(1 + (1 - fade) * 0.04).toFixed(4)})` : "";
      }
    };
  });

  useGrid(wrap, [canvas, glowCanvas], pitch, (next) => {
    const changed = !grid.current || grid.current.cols !== next.cols || grid.current.rows !== next.rows;
    grid.current = next;
    if (changed) pixels.current = null;
    if (changed && preview) {
      samplePreview(preview, next.cols, next.rows).then(data => {
        if (grid.current?.cols === next.cols && grid.current.rows === next.rows) {
          pixels.current = data;
          draw.current();
        }
      });
    }
    if (wrap.current) colors.current = readForeground(wrap.current);
    draw.current();
  });

  useEffect(() => {
    const box = grid.current;
    pixels.current = null;
    if (!preview || !box) return;
    let live = true;
    samplePreview(preview, box.cols, box.rows).then(data => {
      if (live && grid.current === box) {
        pixels.current = data;
        draw.current();
      }
    });
    return () => {
      live = false;
    };
  }, [preview]);

  const repaint = useCallback(() => {
    if (!wrap.current) return;
    colors.current = readForeground(wrap.current);
    draw.current();
  }, []);
  const repaintRef = useRef(repaint);
  useEffect(() => {
    repaintRef.current = repaint;
  });
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const reread = () => repaintRef.current();
    const observer = new MutationObserver(reread);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style", "data-accent"] });
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    query?.addEventListener?.("change", reread);
    return () => {
      observer.disconnect();
      query?.removeEventListener?.("change", reread);
    };
  }, []);

  useEffect(() => {
    if (wrap.current) colors.current = readForeground(wrap.current);
    draw.current();
    if (phase !== "running") return;
    if (reduced) return progress?.on("change", () => draw.current());
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      time.current += last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      draw.current();
      frame = visible.current ? requestAnimationFrame(tick) : 0;
    };
    const resume = () => {
      if (visible.current && !frame) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    const set = listeners.current;
    set.add(resume);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      set.delete(resume);
    };
  }, [phase, reduced, progress, visible, listeners]);

  return <div ref={wrap} className={className} aria-hidden="true">
    <canvas ref={glowCanvas} className={glowClassName} />
    <canvas ref={canvas} className={canvasClassName} />
    {preview ? <img ref={previewImg} src={preview} alt="" className={previewClassName} draggable={false} decoding="async" style={{ opacity: Number(phase === "done") }} /> : null}
  </div>;
}

interface BandFieldProps {
  src: string;
  progress: MotionValue<number>;
  pitch?: number;
  className?: string;
  canvasClassName?: string;
  glowClassName?: string;
}

/** The upscale sweep: a vertical band of halftone dots in the photo's own colours. */
function BandField({ src, progress, pitch = 6, className, canvasClassName, glowClassName }: BandFieldProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const glowCanvas = useRef<HTMLCanvasElement>(null);
  const grid = useRef<Grid | null>(null);
  const pixels = useRef<Uint8ClampedArray | null>(null);
  const draw = useRef<() => void>(() => undefined);

  useLayoutEffect(() => {
    draw.current = () => {
      const box = grid.current;
      const ctx = canvas.current?.getContext("2d");
      const glowCtx = glowCanvas.current?.getContext("2d");
      if (!box || !ctx) return;
      ctx.setTransform(box.dpr, 0, 0, box.dpr, 0, 0);
      ctx.clearRect(0, 0, box.w, box.h);
      if (glowCtx) {
        glowCtx.setTransform(box.dpr, 0, 0, box.dpr, 0, 0);
        glowCtx.clearRect(0, 0, box.w, box.h);
      }
      const sampled = pixels.current;
      if (!sampled) return;
      const x = BAND_PROGRESS(progress.get()) * box.w;
      const half = 0.12 * box.w * 1.15;
      const from = Math.max(0, Math.floor((x - half - box.ox) / pitch));
      const to = Math.min(box.cols - 1, Math.ceil((x + half - box.ox) / pitch));
      for (let col = from; col <= to; col += 1) {
        const cx = box.ox + col * pitch;
        const strength = smoothstep(clamp01(1 - Math.abs(cx - x) / half));
        if (strength <= 0) continue;
        for (let row = 0; row < box.rows; row += 1) {
          const cy = box.oy + row * pitch;
          const i = (row * box.cols + col) * 4;
          const luminance = (0.2126 * sampled[i] + 0.7152 * sampled[i + 1] + 0.0722 * sampled[i + 2]) / 255;
          const fill = `rgb(${sampled[i]},${sampled[i + 1]},${sampled[i + 2]})`;
          const dot = 0.5 * pitch * (0.45 + 0.55 * strength) * (0.7 + 0.3 * (1 - luminance));
          ctx.globalAlpha = 0.55 + 0.45 * strength;
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.arc(cx, cy, dot, 0, TAU);
          ctx.fill();
          if (glowCtx && strength > 0.45) {
            glowCtx.globalAlpha = (strength - 0.45) * 1.2;
            glowCtx.fillStyle = fill;
            glowCtx.beginPath();
            glowCtx.arc(cx, cy, 1.8 * dot, 0, TAU);
            glowCtx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
      if (glowCtx) glowCtx.globalAlpha = 1;
    };
  });

  useGrid(wrap, [canvas, glowCanvas], pitch, (next) => {
    grid.current = next;
    samplePreview(src, next.cols, next.rows).then(data => {
      if (grid.current === next) {
        pixels.current = data;
        draw.current();
      }
    });
    draw.current();
  });

  useEffect(() => progress.on("change", () => draw.current()), [progress]);

  return <div ref={wrap} className={className} aria-hidden="true">
    <canvas ref={glowCanvas} className={glowClassName} />
    <canvas ref={canvas} className={canvasClassName} />
  </div>;
}

const SPINNER_ORDER = [0, 1, 2, 7, 8, 3, 6, 5, 4];

function DotSpinner({ className, dotClassName }: { className?: string; dotClassName?: string }) {
  return <span className={className} aria-hidden="true">
    {SPINNER_ORDER.map((delay, index) => <span key={index} className={dotClassName} style={{ animationDelay: `${(delay - 9) * 90}ms` }} data-center={index === 4 || undefined} />)}
  </span>;
}

function useControlled<T>(value: T | undefined, fallback: T, onChange: ((next: T) => void) | undefined): [T, (next: T) => void] {
  const [internal, setInternal] = useState(fallback);
  const commit = useCallback((next: T) => {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  }, [value, onChange]);
  return [value ?? internal, commit];
}

/** Labels stacked in one cell so a button never changes width when its word does. */
function Stable({ value, options }: { value: string; options: Record<string, ReactNode> }) {
  return <span className={styles.stable}>
    {Object.entries(options).map(([key, node]) => <span key={key} className={styles.stableItem} data-on={key === value || undefined} aria-hidden={key !== value || undefined}>{node}</span>)}
  </span>;
}

function AspectGlyph({ aspect }: { aspect: ImageGenerationAspect }) {
  const ratio = aspect.width / aspect.height;
  const width = ratio >= 1 ? 12 : Math.round(12 * ratio * 2) / 2;
  const height = ratio >= 1 ? Math.round((12 / ratio) * 2) / 2 : 12;
  return <svg width={14} height={14} viewBox="0 0 14 14" fill="none" aria-hidden="true" className={styles.glyph}>
    <rect x={(14 - width) / 2 + 0.6} y={(14 - height) / 2 + 0.6} width={width - 1.2} height={height - 1.2} rx={2} stroke="currentColor" strokeWidth={1.2} />
  </svg>;
}

function Percent({ progress }: { progress: MotionValue<number> }) {
  const node = useRef<HTMLSpanElement>(null);
  useMotionValueEvent(progress, "change", (value) => {
    if (node.current) node.current.textContent = `${Math.round(100 * Math.min(1, value))}%`;
  });
  return <span ref={node} className={styles.percent}>{`${Math.round(100 * Math.min(1, progress.get()))}%`}</span>;
}

function PillSlot({ id, className, reduced, children }: { id: string | null; className: string; reduced: boolean; children: ReactNode }) {
  return <span className={className}>
    <AnimatePresence initial={false} mode="popLayout">
      {id ? <motion.span key={id} className={styles.pill} initial={reduced ? { opacity: 0 } : { opacity: 0, filter: "blur(3px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} exit={{ opacity: 0, transition: PILL_EXIT }} transition={{ duration: 0.18, ease: [...motionTokens.ease.standard] }}>{children}</motion.span> : null}
    </AnimatePresence>
  </span>;
}

function arrowTo(event: KeyboardEvent<HTMLButtonElement>, list: readonly { id: string }[], value: string, onChange: (id: string) => void) {
  const index = Math.max(0, list.findIndex(item => item.id === value));
  const last = list.length - 1;
  const next =
    event.key === "ArrowRight" || event.key === "ArrowDown" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index === 0 ? last : index - 1)
        : event.key === "Home" ? 0
          : event.key === "End" ? last
            : -1;
  if (next < 0) return;
  event.preventDefault();
  onChange(list[next].id);
  event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-option="${CSS.escape(list[next].id)}"]`)?.focus();
}

function ModelChips({ models, value, onChange, reduced }: { models: ImageGenerationModel[]; value: string; onChange: (id: string) => void; reduced: boolean }) {
  return <div className={styles.chips} role="radiogroup" aria-label="Model">
    {models.map((item) => {
      const checked = item.id === value;
      return <Tooltip key={item.id} content={item.name}>
        <button type="button" role="radio" aria-checked={checked} aria-label={item.name} data-option={item.id} tabIndex={checked ? 0 : -1} className={`${styles.chip} ${styles.modelChip}`} onClick={() => onChange(item.id)} onKeyDown={event => arrowTo(event, models, value, onChange)}>
          <span className={styles.chipMark} aria-hidden="true">{item.mark ?? <Sparkles size={14} strokeWidth={1.75} />}</span>
          <motion.span className={styles.chipName} aria-hidden="true" initial={false} animate={{ width: checked ? "auto" : 0, opacity: Number(checked) }} transition={reduced ? INSTANT : { width: SPRING, opacity: { duration: checked ? 0.16 : 0.1, ease: [...motionTokens.ease.standard], delay: 0.04 * Number(checked) } }}>
            <span className={styles.chipNameText}>{item.name}</span>
          </motion.span>
        </button>
      </Tooltip>;
    })}
  </div>;
}

function AspectChips({ aspects, value, onChange }: { aspects: ImageGenerationAspect[]; value: string; onChange: (id: string) => void }) {
  return <div className={styles.chips} role="radiogroup" aria-label="Aspect ratio">
    {aspects.map((item) => {
      const checked = item.id === value;
      return <button key={item.id} type="button" role="radio" aria-checked={checked} aria-label={`${item.label}, ${item.width} by ${item.height}`} data-option={item.id} tabIndex={checked ? 0 : -1} className={`${styles.chip} ${styles.aspectChip}`} onClick={() => onChange(item.id)} onKeyDown={event => arrowTo(event, aspects, value, onChange)}>
        <AspectGlyph aspect={item} />
        <span aria-hidden="true">{item.label}</span>
      </button>;
    })}
  </div>;
}

interface StageLayerProps {
  tile: Tile;
  seed: number;
  reduced: boolean;
  upscaling: boolean;
  upscaleProgress: MotionValue<number>;
}

function StageLayer({ tile, seed, reduced, upscaling, upscaleProgress }: StageLayerProps) {
  const image = tile.upscaled ?? tile.image;
  const finished = tile.status === "done" && !!image;
  const sweeping = finished && upscaling && !reduced;
  const maskSoft = useTransform(upscaleProgress, (value) => {
    const at = 100 * BAND_PROGRESS(value);
    return `linear-gradient(90deg, #000 ${at - 13.2}%, transparent ${at - 5.4}%)`;
  });
  const maskSharp = useTransform(upscaleProgress, (value) => {
    const at = 100 * BAND_PROGRESS(value);
    return `linear-gradient(90deg, transparent ${at + 5.4}%, #000 ${at + 13.2}%)`;
  });
  return <>
    <DotField progress={tile.progress} preview={tile.preview} phase={phaseOf(tile.status)} reduced={reduced} seed={seed} pitch={8} className={styles.field} canvasClassName={styles.fieldCanvas} glowClassName={styles.fieldGlow} previewClassName={`${styles.image} ${styles.preview}`} />
    {finished && image ? <>
      {sweeping ? <>
        <motion.img src={image.src} alt="" className={`${styles.image} ${styles.layer} ${styles.soft}`} draggable={false} style={{ maskImage: maskSharp, WebkitMaskImage: maskSharp }} />
        <BandField src={image.src} progress={upscaleProgress} className={styles.layer} canvasClassName={styles.fieldCanvas} glowClassName={styles.bandGlow} />
      </> : null}
      <motion.img src={image.src} alt={image.alt} className={`${styles.image} ${styles.layer} ${styles.final}`} data-fade={image.src !== tile.preview || undefined} draggable={false} decoding="async" style={sweeping ? { maskImage: maskSoft, WebkitMaskImage: maskSoft } : undefined} />
    </> : null}
  </>;
}

interface ThumbProps {
  tile: Tile;
  index: number;
  seed: number;
  active: boolean;
  reduced: boolean;
  onChoose: () => void;
  onArrow: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

function Thumb({ tile, index, seed, active, reduced, onChoose, onArrow }: ThumbProps) {
  const image = tile.upscaled ?? tile.image;
  const word = tile.status === "running" ? "generating" : tile.status === "error" ? "failed" : tile.status === "stopped" ? "stopped" : image?.alt ?? "ready";
  return <button type="button" role="radio" aria-checked={active} tabIndex={active ? 0 : -1} className={styles.thumb} data-thumb={index} data-status={tile.status} data-active={active || undefined} aria-label={`Image ${index + 1}, ${word}`} onClick={onChoose} onKeyDown={onArrow}>
    <span className={styles.thumbMedia}>
      <DotField progress={tile.progress} preview={tile.preview} phase={phaseOf(tile.status)} reduced={reduced} seed={seed} pitch={4} glow={false} className={styles.field} canvasClassName={styles.fieldCanvas} previewClassName={`${styles.image} ${styles.preview}`} />
      {tile.status === "done" && image ? <img src={image.src} alt="" className={`${styles.image} ${styles.layer} ${styles.final}`} data-fade={image.src !== tile.preview || undefined} draggable={false} decoding="async" /> : null}
      {tile.status === "error" || tile.status === "stopped" ? <span className={styles.thumbHalt} data-status={tile.status}>
        {tile.status === "error" ? <CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" /> : <Square size={10} strokeWidth={2.25} aria-hidden="true" />}
      </span> : null}
    </span>
  </button>;
}

const phaseOf = (status: Tile["status"]): "running" | "done" | "halted" => status === "running" ? "running" : status === "done" ? "done" : "halted";

const dimensions = (image: ImageGenerationImage | undefined, aspect: ImageGenerationAspect) => `${image?.width ?? aspect.width} \u00d7 ${image?.height ?? aspect.height}`;

const seedFor = (batch: Batch, index: number) => (7 * batch.id + 3.1 * index) % 11;

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

/* Tile progress lives on a motion value, never in React state, so a running batch costs no re-renders. */
const makeTile = (key: string): Tile => ({ key, status: "running", progress: motionValue(0), startedAt: performance.now() });

const errorMessage = (error: unknown) => error instanceof Error && error.message ? error.message : "The model did not return an image.";

function tweenProgress(duration: number, signal: AbortSignal, onProgress: (value: number) => void, power = 1.6) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const started = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      onProgress(1 - Math.pow(1 - t, power));
      if (t < 1) frame = requestAnimationFrame(step);
      else resolve();
    };
    frame = requestAnimationFrame(step);
    signal.addEventListener("abort", () => {
      cancelAnimationFrame(frame);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) {
    reject(new DOMException("Aborted", "AbortError"));
    return;
  }
  const timer = window.setTimeout(resolve, ms);
  signal.addEventListener("abort", () => {
    window.clearTimeout(timer);
    reject(new DOMException("Aborted", "AbortError"));
  }, { once: true });
});

let seedCounter = 418203;

/** The built in generator: picks sample photos that match the prompt, reports the photo as the preview and frame by frame progress. Nothing is sent anywhere. */
export async function simulateImageGeneration(request: ImageGenerationRequest, { signal, onProgress }: ImageGenerationContext): Promise<ImageGenerationImage> {
  const source = (request.variationOf?.alt ?? request.prompt).toLowerCase();
  let group = PHOTO_GROUPS[0];
  let best = 0;
  for (const candidate of PHOTO_GROUPS) {
    const score = candidate.words.filter(word => source.includes(word)).length;
    if (score > best) {
      group = candidate;
      best = score;
    }
  }
  const photos = group.photos;
  const offset = request.variationOf ? Math.max(0, photos.findIndex(item => item.src === request.variationOf?.src)) + 1 : 0;
  const chosen = photos[(offset + request.index) % photos.length];
  await wait(80 + 90 * request.index, signal);
  onProgress(0, chosen.src);
  await tweenProgress(4400 + 320 * request.index + (request.prompt.length % 5) * 60, signal, (value) => onProgress(value, chosen.src), 1.3);
  seedCounter += 7919;
  return { id: `${request.model.id}-${seedCounter}`, src: chosen.src, alt: chosen.alt, width: request.aspect.width, height: request.aspect.height, seed: seedCounter };
}

/** The built in upscaler: a 1.4s tween that doubles the image and reports a smoothstepped progress. */
export async function simulateImageUpscale(image: ImageGenerationImage, { signal, onProgress }: ImageGenerationContext): Promise<ImageGenerationImage> {
  await tweenProgress(1400, signal, (value) => {
    const eased = 1 - Math.pow(1 - value, 0.625);
    onProgress(eased * eased * (3 - 2 * eased));
  });
  return { ...image, id: `${image.id}-2x`, width: (image.width ?? 1024) * 2, height: (image.height ?? 1024) * 2 };
}

export function ImageGeneration({
  prompt,
  defaultPrompt = "Cinematic landscapes at golden hour: an alpine lake under a glowing peak, hazy mountain ridges, a long coastline and a calm sea at dusk, shot on 35mm film",
  onPromptChange,
  models = imageGenerationModels,
  model,
  defaultModel,
  onModelChange,
  aspectRatios = imageGenerationAspects,
  aspectRatio,
  defaultAspectRatio,
  onAspectRatioChange,
  onGenerate,
  onUpscale,
  onDownload,
  onSelect,
  suggestions = SUGGESTIONS,
  autoGenerate,
  placeholder = "Describe the image you want",
  className,
}: ImageGenerationProps) {
  const reduced = useReducedMotion() ?? false;
  const simulation = !onGenerate;
  const [promptValue, setPromptValue] = useControlled(prompt, defaultPrompt, onPromptChange);
  const [modelValue, setModelValue] = useControlled(model, defaultModel ?? models[0]?.id ?? "", onModelChange);
  const [aspectValue, setAspectValue] = useControlled(aspectRatio, defaultAspectRatio ?? aspectRatios[0]?.id ?? "", onAspectRatioChange);
  const activeModel = models.find(item => item.id === modelValue) ?? models[0];
  const activeAspect = aspectRatios.find(item => item.id === aspectValue) ?? aspectRatios[0];

  const [batch, setBatch] = useState<Batch | null>(null);
  const [active, setActive] = useState(0);
  const [upscale, setUpscale] = useState<{ index: number; status: "running" | "error"; message?: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [announce, setAnnounce] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const batchSeq = useRef(0);
  const shownBatch = useRef<Batch | null>(null);
  const selectedIndex = useRef(0);
  const controllers = useRef(new Map<string, AbortController>());
  const tweens = useRef(new Map<string, { stop: () => void }>());
  const counters = useRef(new Map<number, { pending: number; done: number; failed: number }>());
  const previewed = useRef(new Set<string>());
  const upscaleProgress = useMotionValue(0);
  const upscaleTween = useRef<{ stop: () => void } | undefined>(undefined);
  const upscaleAbort = useRef<AbortController | null>(null);
  const touched = useRef(false);
  const autoDone = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);

  const settle = (target: MotionValue<number>, value: number, key?: string) => {
    const next = Math.max(target.get(), Math.min(1, Math.max(0, value)));
    const running = key ? tweens.current.get(key) : upscaleTween.current;
    running?.stop();
    const store = (control: { stop: () => void } | undefined) => {
      if (key) {
        if (control) tweens.current.set(key, control);
        else tweens.current.delete(key);
      } else {
        upscaleTween.current = control;
      }
    };
    if (reduced || next - target.get() < 0.06) {
      target.set(next);
      store(undefined);
      return;
    }
    store(animate(target, next, { duration: 0.32, ease: [...motionTokens.ease.standard] }));
  };

  const patchTile = useCallback((batchId: number, index: number, patch: Partial<Tile>) => {
    setBatch(current => current && current.id === batchId ? { ...current, tiles: current.tiles.map((tile, i) => i === index ? { ...tile, ...patch } : tile) } : current);
  }, []);

  const finish = (batchId: number, outcome: "done" | "failed" | "stopped") => {
    const counter = counters.current.get(batchId);
    if (!counter || batchId !== batchSeq.current) return;
    counter.pending -= 1;
    if (outcome === "done") counter.done += 1;
    if (outcome === "failed") counter.failed += 1;
    if (counter.pending > 0) return;
    const endedAt = performance.now();
    setBatch(current => current && current.id === batchId ? { ...current, endedAt } : current);
    setAnnounce(counter.done === 4 ? "4 images ready. Pick one to upscale, vary or download." : `${counter.done} of 4 images ready${counter.failed ? `, ${counter.failed} failed` : ""}.`);
  };

  const startTile = (current: Batch, index: number, tile: Tile) => {
    const { key, progress } = tile;
    const controller = new AbortController();
    controllers.current.set(key, controller);
    progress.set(0);
    tweens.current.get(key)?.stop();
    tweens.current.set(key, animate(progress, 0.9, { duration: 9, ease: [0.1, 0.7, 0.3, 1] }));
    (onGenerate ?? simulateImageGeneration)({ prompt: current.prompt, model: current.model, aspect: current.aspect, index, count: 4, variationOf: current.variationOf?.image }, {
      signal: controller.signal,
      onProgress: (value, preview) => {
        if (controller.signal.aborted) return;
        if (preview && !previewed.current.has(key)) {
          previewed.current.add(key);
          patchTile(current.id, index, { preview });
        }
        settle(progress, value, key);
      },
    }).then((image) => {
      if (controller.signal.aborted) return;
      controllers.current.delete(key);
      tweens.current.get(key)?.stop();
      const done = () => {
        patchTile(current.id, index, { status: "done", image, endedAt: performance.now() });
        if (index === selectedIndex.current && current.id === batchSeq.current) onSelect?.(image);
        finish(current.id, "done");
      };
      if (reduced || progress.get() > 0.98) {
        progress.set(1);
        done();
        return;
      }
      tweens.current.set(key, animate(progress, 1, { duration: 0.36, ease: [...motionTokens.ease.standard], onComplete: done }));
    }, (error: unknown) => {
      controllers.current.delete(key);
      tweens.current.get(key)?.stop();
      if (controller.signal.aborted || isAbort(error)) {
        patchTile(current.id, index, { status: "stopped" });
        finish(current.id, "stopped");
        return;
      }
      patchTile(current.id, index, { status: "error", error: errorMessage(error) });
      setAnnounce(`Image ${index + 1} failed. ${errorMessage(error)}`);
      finish(current.id, "failed");
    });
  };

  const cancelUpscale = () => {
    upscaleAbort.current?.abort();
    upscaleTween.current?.stop();
  };

  useEffect(() => () => {
    controllers.current.forEach(controller => controller.abort());
    tweens.current.forEach(tween => tween.stop());
    upscaleAbort.current?.abort();
    window.clearTimeout(saveTimer.current);
  }, []);

  const generate = (variationOf?: BatchVariation) => {
    const text = (variationOf ? batch?.prompt : promptValue)?.trim();
    if (!text || !activeModel || !activeAspect) return;
    controllers.current.forEach(controller => controller.abort());
    controllers.current.clear();
    tweens.current.forEach(tween => tween.stop());
    cancelUpscale();
    const id = ++batchSeq.current;
    const next: Batch = {
      id,
      prompt: text,
      model: activeModel,
      aspect: variationOf && batch ? batch.aspect : activeAspect,
      variationOf,
      tiles: Array.from({ length: 4 }, (_, index) => makeTile(`${id}-${index}-0`)),
      startedAt: performance.now(),
    };
    tweens.current.clear();
    counters.current.set(id, { pending: 4, done: 0, failed: 0 });
    setBatch(next);
    setActive(0);
    selectedIndex.current = 0;
    setUpscale(null);
    setSaved(false);
    onSelect?.(null);
    setAnnounce(`${variationOf ? `Generating variations of image ${variationOf.index + 1}` : "Generating 4 images"} with ${activeModel.name}, ${next.aspect.label}.${simulation ? " Simulated, nothing was sent." : ""}`);
    next.tiles.forEach((tile, index) => startTile(next, index, tile));
  };

  const stop = () => {
    controllers.current.forEach(controller => controller.abort());
    setAnnounce("Stopped. Finished images are kept.");
  };

  const choose = (index: number) => {
    const tile = batch?.tiles[index];
    if (!tile || index === active) return;
    if (upscale) {
      cancelUpscale();
      setUpscale(null);
    }
    setActive(index);
    selectedIndex.current = index;
    setSaved(false);
    const image = tile.upscaled ?? tile.image;
    if (image) onSelect?.(image);
    setAnnounce(`Image ${index + 1}${tile.status === "running" ? ", generating" : tile.status === "error" ? ", failed" : tile.status === "stopped" ? ", stopped" : ""}.`);
  };

  const autoRun = autoGenerate ?? simulation;
  const trigger = useRef<() => void>(() => undefined);

  useEffect(() => {
    let timer: number | undefined;
    const node = rootRef.current;
    if (!autoRun || autoDone.current || !node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || autoDone.current) return;
      autoDone.current = true;
      observer.disconnect();
      timer = window.setTimeout(() => {
        if (!shownBatch.current && !touched.current) trigger.current();
      }, 450);
    }, { threshold: 0.35 });
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [autoRun]);

  useLayoutEffect(() => {
    trigger.current = () => generate();
    shownBatch.current = batch;
  });

  const startUpscale = async () => {
    const tile = batch?.tiles[active];
    if (!batch || !tile?.image || tile.upscaled) return;
    upscaleAbort.current?.abort();
    const controller = new AbortController();
    upscaleAbort.current = controller;
    upscaleTween.current?.stop();
    upscaleProgress.set(0);
    setUpscale({ index: active, status: "running" });
    setAnnounce(`Upscaling image ${active + 1}.${onUpscale ? "" : " Simulated, nothing was sent."}`);
    try {
      const result = await (onUpscale ?? simulateImageUpscale)(tile.image, {
        signal: controller.signal,
        onProgress: (value) => {
          if (!controller.signal.aborted) settle(upscaleProgress, value);
        },
      });
      if (controller.signal.aborted) return;
      upscaleTween.current?.stop();
      upscaleProgress.set(1);
      patchTile(batch.id, active, { upscaled: result });
      setUpscale(null);
      onSelect?.(result);
      setAnnounce(`Upscaled image ${active + 1} to ${dimensions(result, batch.aspect)}.`);
    } catch (error) {
      if (controller.signal.aborted || isAbort(error)) return;
      setUpscale({ index: active, status: "error", message: errorMessage(error) });
      setAnnounce(`Upscale failed. ${errorMessage(error)}`);
    }
  };

  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const resized = useRef(false);
  useLayoutEffect(() => {
    const node = frameRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry?.contentRect.width ?? node.offsetWidth);
      setContainerWidth(current => {
        if (current !== null && current !== width) resized.current = true;
        return width;
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const stageAspect = batch?.aspect ?? activeAspect;
  const ratio = stageAspect ? stageAspect.width / stageAspect.height : 1;
  const targetWidth = containerWidth ? Math.round(Math.min(containerWidth, 440 * ratio)) : 0;
  const targetHeight = Math.round(targetWidth / ratio);
  const stageWidth = useMotionValue(0);
  const stageHeight = useMotionValue(0);
  const measured = useRef(false);

  useLayoutEffect(() => {
    if (!targetWidth) return;
    const jump = !measured.current || resized.current || reduced;
    measured.current = true;
    resized.current = false;
    if (jump) {
      stageWidth.stop();
      stageHeight.stop();
      stageWidth.set(targetWidth);
      stageHeight.set(targetHeight);
      return;
    }
    const widthAnimation = animate(stageWidth, targetWidth, SPRING);
    const heightAnimation = animate(stageHeight, targetHeight, SPRING);
    return () => {
      widthAnimation.stop();
      heightAnimation.stop();
    };
  }, [targetWidth, targetHeight, reduced, stageWidth, stageHeight]);

  const running = batch?.tiles.some(tile => tile.status === "running") ?? false;
  const tile = batch?.tiles[active];
  const shownImage = tile?.upscaled ?? tile?.image;
  const upscaling = upscale?.status === "running" && upscale.index === active;
  const doneCount = batch?.tiles.filter(item => item.status === "done").length ?? 0;
  const canUpscale = tile?.status === "done" && !!shownImage && !upscaling;

  const retry = (index: number) => {
    const target = batch?.tiles[index];
    const counter = batch ? counters.current.get(batch.id) : undefined;
    if (!batch || !target || !counter || target.status === "running" || target.status === "done") return;
    counter.pending += 1;
    if (target.status === "error") counter.failed -= 1;
    const next = makeTile(`${batch.id}-${index}-${Number(target.key.split("-")[2] ?? 0) + 1}`);
    setBatch({ ...batch, endedAt: undefined, tiles: batch.tiles.map((item, i) => i === index ? next : item) });
    setAnnounce(`Retrying image ${index + 1}.${simulation ? " Simulated, nothing was sent." : ""}`);
    startTile(batch, index, next);
  };

  const download = () => {
    const current = batch?.tiles[active];
    const image = current?.upscaled ?? current?.image;
    if (!batch || !image) return;
    const slug = batch.prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").split("-").slice(0, 5).join("-") || "image";
    const extension = image.src.split("?")[0].match(/\.(png|jpe?g|webp|avif)$/i)?.[1] ?? "png";
    const name = `${slug}-${active + 1}${image.width && image.height ? `-${image.width}x${image.height}` : ""}.${extension}`;
    if (onDownload) onDownload(image);
    else {
      const link = document.createElement("a");
      link.href = image.src;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    setSaved(true);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => setSaved(false), 1600);
    setAnnounce(onDownload ? `Image ${active + 1} sent to download.` : `Downloaded ${name}.`);
  };

  const status = !batch || !tile ? null
    : upscaling ? {
      id: `up-${tile.key}`,
      node: <><DotSpinner className={styles.spinner} dotClassName={styles.spinDot} /><span>Upscaling</span><Percent progress={upscaleProgress} /></>,
    }
      : upscale?.status === "error" && upscale.index === active ? {
        id: `upfail-${tile.key}`,
        node: <><CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" className={styles.danger} /><span>Upscale failed</span></>,
      }
        : tile.status === "running" ? {
          id: `run-${tile.key}`,
          node: <><DotSpinner className={styles.spinner} dotClassName={styles.spinDot} /><span>{batch.variationOf ? "Varying" : "Generating"}</span><Percent progress={tile.progress} /></>,
        }
          : tile.status === "done" && tile.upscaled && tile.image ? {
            id: `upd-${tile.key}`,
            node: <><Check size={14} strokeWidth={1.75} aria-hidden="true" /><span>Upscaled</span><span className={styles.mono}>{tile.image.width && tile.upscaled.width ? `${Math.round((tile.upscaled.width / tile.image.width) * 10) / 10}\u00d7` : ""}</span></>,
          }
            : tile.status === "done" && shownImage ? {
              id: `done-${tile.key}`,
              node: <span className={styles.mono}>{[shownImage.seed ? `seed ${shownImage.seed}` : null, tile.endedAt ? `${(Math.max(tile.endedAt - tile.startedAt, 100) / 1000).toFixed(1)}s` : null].filter(Boolean).join(" \u00b7 ") || `image ${active + 1}`}</span>,
            }
              : null;

  const dims = dimensions(tile?.status === "done" ? shownImage : undefined, stageAspect ?? { id: "", label: "", width: 1024, height: 1024 });

  return <div
    ref={rootRef}
    className={[styles.root, className].filter(Boolean).join(" ")}
    onPointerDownCapture={() => { touched.current = true; }}
    onKeyDownCapture={(event) => {
      touched.current = true;
      if (event.key === "Escape" && running) {
        event.preventDefault();
        stop();
      }
    }}
  >
    <div ref={frameRef} className={styles.frame}>
      <motion.div className={styles.stage} data-status={tile?.status ?? "empty"} style={targetWidth ? { width: stageWidth, height: stageHeight } : { width: "100%", aspectRatio: `${ratio}` as CSSProperties["aspectRatio"], maxWidth: `${440 * ratio}px` }}>
        <AnimatePresence initial={false}>
          {batch && tile ? <motion.div
            key={tile.key}
            className={styles.layer}
            role="img"
            aria-label={tile.status === "done" && shownImage ? shownImage.alt : `Image ${active + 1}, ${tile.status === "running" ? "generating" : tile.status === "error" ? "failed" : "stopped"}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.16 } }}
            transition={reduced ? INSTANT : { duration: 0.2, ease: [...motionTokens.ease.standard] }}
          >
            <StageLayer tile={tile} seed={seedFor(batch, active)} reduced={reduced} upscaling={upscaling} upscaleProgress={upscaleProgress} />
          </motion.div> : <motion.div key="empty" className={styles.layer} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: PILL_EXIT }} transition={QUICK}>
            <DotField phase="idle" reduced={reduced} pitch={8} className={styles.field} canvasClassName={styles.fieldCanvas} glowClassName={styles.fieldGlow} />
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Describe an image, then generate</p>
              <div className={styles.suggestions}>
                {suggestions.slice(0, 3).map(suggestion => <button key={suggestion} type="button" className={styles.suggestion} onClick={() => { setPromptValue(suggestion); textareaRef.current?.focus(); }}>{suggestion}</button>)}
              </div>
            </div>
          </motion.div>}
        </AnimatePresence>
        <AnimatePresence>
          {tile && (tile.status === "error" || tile.status === "stopped") ? <motion.div key={`halt-${tile.key}`} className={styles.halt} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={QUICK}>
            <span className={styles.haltLabel} data-status={tile.status}>
              {tile.status === "error" ? <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" /> : <Square size={12} strokeWidth={2.25} aria-hidden="true" />}
              {tile.status === "error" ? "Failed" : "Stopped"}
            </span>
            {tile.status === "error" && tile.error ? <span className={styles.haltMessage}>{tile.error}</span> : null}
            <Button variant="secondary" size="sm" className={styles.retry} onClick={() => retry(active)} aria-label={`Retry image ${active + 1}`}>
              <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
              Retry
            </Button>
          </motion.div> : null}
        </AnimatePresence>
        <PillSlot id={status?.id ?? null} className={styles.statusSlot} reduced={reduced}>{status?.node}</PillSlot>
        <PillSlot id={`dims-${dims}`} className={styles.dimsSlot} reduced={reduced}><span className={styles.mono}>{dims}</span></PillSlot>
      </motion.div>
    </div>

    <div className={styles.bar}>
      <div className={styles.strip} role="radiogroup" aria-label={batch ? `Variations for: ${batch.prompt}` : "Variations"} data-empty={!batch || undefined}>
        {batch ? batch.tiles.map((item, index) => <Thumb
          key={item.key}
          tile={item}
          index={index}
          seed={seedFor(batch, index) + 5}
          active={index === active}
          reduced={reduced}
          onChoose={() => choose(index)}
          onArrow={(event) => {
            const next = event.key === "ArrowRight" || event.key === "ArrowDown" ? (index + 1) % 4
              : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index + 3) % 4
                : event.key === "Home" ? 0
                  : event.key === "End" ? 3
                    : -1;
            if (next < 0) return;
            event.preventDefault();
            choose(next);
            rootRef.current?.querySelector<HTMLButtonElement>(`[data-thumb="${next}"]`)?.focus();
          }}
        />) : Array.from({ length: 4 }, (_, index) => <span key={index} className={styles.thumbPlaceholder} aria-hidden="true" />)}
      </div>
      <div className={styles.actions}>
        <Button
          variant="secondary"
          size="sm"
          className={styles.action}
          aria-label={tile?.upscaled ? "Upscaled" : upscaling ? "Upscaling" : "Upscale"}
          disabled={!canUpscale || !!tile?.upscaled}
          onClick={startUpscale}
        >
          <Stable value={tile?.upscaled ? "upscaled" : upscaling ? "upscaling" : "upscale"} options={{
            upscale: <><Maximize2 size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.actionLabel}>Upscale</span></>,
            upscaling: <><Maximize2 size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.actionLabel}>Upscaling</span></>,
            upscaled: <><Check size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.actionLabel}>Upscaled</span></>,
          }} />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className={styles.action}
          aria-label="Vary"
          disabled={!canUpscale}
          onClick={() => tile?.image && generate({ image: tile.image, index: active })}
        >
          <Shuffle size={14} strokeWidth={1.75} aria-hidden="true" />
          <span className={styles.actionLabel}>Vary</span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className={styles.action}
          aria-label={saved ? "Saved" : "Download"}
          disabled={!canUpscale}
          onClick={() => download()}
        >
          <Stable value={saved ? "saved" : "download"} options={{
            download: <><Download size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.actionLabel}>Download</span></>,
            saved: <><Check size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.actionLabel}>Saved</span></>,
          }} />
        </Button>
      </div>
    </div>

    <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); running ? stop() : generate(); }}>
      <textarea
        ref={textareaRef}
        className={styles.prompt}
        value={promptValue}
        placeholder={placeholder}
        rows={2}
        aria-label="Prompt"
        aria-keyshortcuts="Meta+Enter Control+Enter"
        onChange={(event) => setPromptValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            if (!running) generate();
          }
        }}
      />
      <div className={styles.toolbar}>
        <div className={styles.options}>
          <ModelChips models={models} value={activeModel?.id ?? ""} onChange={setModelValue} reduced={reduced} />
          <AspectChips aspects={aspectRatios} value={activeAspect?.id ?? ""} onChange={setAspectValue} />
        </div>
        <Button
          type="submit"
          size="sm"
          variant={running ? "secondary" : "primary"}
          className={[styles.generate, !running && styles.generatePrimary].filter(Boolean).join(" ")}
          disabled={!running && !promptValue.trim()}
        >
          <Stable value={running ? "stop" : "generate"} options={{
            generate: <><Sparkles size={14} strokeWidth={1.75} aria-hidden="true" />Generate</>,
            stop: <><Square size={12} strokeWidth={2.25} aria-hidden="true" />Stop<span className={styles.count}>{doneCount}/{4}</span></>,
          }} />
        </Button>
      </div>
    </form>

    <span className={styles.srOnly} role="status" aria-live="polite">{announce}</span>
  </div>;
}

export default ImageGeneration;
