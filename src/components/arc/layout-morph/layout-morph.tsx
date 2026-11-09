"use client";

/**
 * A 24 card gallery that flies between grid, masonry, list, fan, carousel and a 3D helix.
 *
 * The motion lives in a small imperative engine (one requestAnimationFrame loop) rather than in
 * React state: every card is a DOM node whose transform, size and radius are written straight to
 * the element, and each card springs toward the pose its current layout computed. Layout changes
 * re-target the springs, so cards keep their place on screen and travel to their new slot instead
 * of cutting. Ring layouts rotate one camera transform per frame instead of every card.
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { MotionConfig, motion, useReducedMotion } from "motion/react";
import {
  Check,
  Dna,
  GalleryHorizontalEnd,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  List,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import { MAKERS, PIECES } from "./morph-data";
import styles from "./layout-morph.module.css";

/* -------------------------------------------------------------------------------------------------
 * Data
 * -----------------------------------------------------------------------------------------------*/

type ItemKind = "photo" | "type" | "maker";
type LayoutId = "grid" | "masonry" | "list" | "stack" | "carousel" | "helix";

interface GalleryItem {
  id: string;
  kind: ItemKind;
  name: string;
  by: string;
  meta: string;
  image?: string;
  alt: string;
  desc: string;
  stats: number[];
  aspect: number;
  facts: [string, string][];
}

const money = (value: number) => `$${value.toLocaleString("en-US")}`;

const ITEMS: GalleryItem[] = [
  ...PIECES.map((piece): GalleryItem => ({
    id: piece.id,
    kind: piece.kind,
    name: piece.name,
    by: piece.by,
    meta: piece.meta,
    image: piece.image,
    alt: piece.alt ?? "",
    desc: piece.desc,
    stats: [piece.price, piece.stock, piece.rating],
    aspect: piece.aspect,
    facts: [
      ["Price", money(piece.price)],
      ["Size", piece.size],
      ["In stock", String(piece.stock)],
      ["Ships in", piece.ships],
    ],
  })),
  ...MAKERS.map((maker): GalleryItem => {
    const pieces = PIECES.filter((piece) => piece.by === maker.name).length;
    return {
      id: maker.id,
      kind: "maker",
      name: maker.name,
      by: maker.craft,
      meta: maker.city,
      image: maker.image,
      alt: `Portrait of ${maker.name}`,
      desc: maker.bio,
      stats: [pieces, maker.orders, maker.rating],
      aspect: maker.aspect,
      facts: [
        ["Pieces here", String(pieces)],
        ["Orders", maker.orders.toLocaleString("en-US")],
        ["Rating", maker.rating.toFixed(1)],
        ["Since", String(maker.since)],
      ],
    };
  }),
];

/** The order the gallery lays out: a piece, then its maker, so the set alternates object and person. */
const ORDER = [
  "travertine-tray",
  "emma-collins",
  "dome-lamp",
  "sofia-ramirez",
  "mug-pair",
  "ava-mitchell",
  "floor-cushion",
  "linen-throw",
  "marcus-johnson",
  "serving-board",
  "jasmine-brooks",
  "lounge-chair",
  "ryan-sullivan",
  "taper-pair",
  "daniel-kim",
  "napkin-set",
  "night-carafe",
  "chloe-nguyen",
  "brass-bookends",
  "hannah-walsh",
  "walnut-stool",
  "dusk-print",
  "olivia-bennett",
  "glaze-vase",
];

const BY_ID = new Map(ITEMS.map((item) => [item.id, item]));
const CARDS: GalleryItem[] = ORDER.flatMap((id) => {
  const item = BY_ID.get(id);
  return item ? [item] : [];
});

const STAT_LABELS: Record<string, string[]> = {
  photo: ["Price", "In stock", "Rating"],
  type: ["Price", "In stock", "Rating"],
  maker: ["Pieces", "Orders", "Rating"],
  summary: ["Pieces", "Makers", "Avg rating"],
};

const RATINGS = PIECES.map((piece) => piece.rating);
const SUMMARY_STATS = [
  PIECES.length,
  MAKERS.length,
  Math.round((RATINGS.reduce((total, rating) => total + rating, 0) / RATINGS.length) * 10) / 10,
];

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const TOTAL = CARDS.length;
const PIECE_COUNT = CARDS.filter((card) => card.kind !== "maker").length;
const MAKER_COUNT = TOTAL - PIECE_COUNT;

const VIEWS: { id: LayoutId; label: string; Icon: LucideIcon; hint: string }[] = [
  { id: "grid", label: "Grid", Icon: LayoutGrid, hint: "Click a card to open it" },
  { id: "masonry", label: "Masonry", Icon: LayoutDashboard, hint: "Every piece keeps its own proportions" },
  { id: "list", label: "List", Icon: List, hint: "Each piece with its maker and price" },
  { id: "stack", label: "Stack", Icon: Layers, hint: "Hover the fan to pull a card up" },
  { id: "carousel", label: "Carousel", Icon: GalleryHorizontalEnd, hint: "Drag or swipe, it settles on the nearest card" },
  { id: "helix", label: "Helix", Icon: Dna, hint: "Drag to spin, throw it to keep it turning" },
];

/* -------------------------------------------------------------------------------------------------
 * Geometry helpers
 * -----------------------------------------------------------------------------------------------*/

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
/** Frame-rate independent spring constants for a duration/bounce pair. */
function spring(visualDuration: number, bounce: number) {
  const omega = (2 * Math.PI) / (1.2 * visualDuration);
  const k = omega * omega;
  return { k, c: 2 * Math.min(1, Math.max(0.05, 1 - bounce)) * Math.sqrt(k) };
}
const wrap = (angle: number) => angle - 2 * Math.round(angle / (2 * Math.PI)) * Math.PI;
const rubber = (distance: number, size: number) => (1 - 1 / ((0.55 * distance) / size + 1)) * size;
const rubberClamp = (value: number, min: number, max: number, size: number) =>
  value < min ? min - rubber(min - value, size) : value > max ? max + rubber(value - max, size) : value;
const round2 = (value: number) => Math.round(value * 100) / 100;
const round4 = (value: number) => Math.round(value * 1e4) / 1e4;

/** Row-major 3×3 rotations, matching the CSS rotateX / rotateY / rotateZ order the cards use. */
const rotX = (angle: number) => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [1, 0, 0, 0, c, -s, 0, s, c];
};
const rotY = (angle: number) => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
};
const rotZ = (angle: number) => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
};
function mul(a: number[], b: number[]) {
  const out = Array<number>(9);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      out[3 * row + col] = a[3 * row] * b[col] + a[3 * row + 1] * b[3 + col] + a[3 * row + 2] * b[6 + col];
    }
  }
  return out;
}
const apply3 = (m: number[], x: number, y: number, z: number): [number, number, number] => [
  m[0] * x + m[1] * y + m[2] * z,
  m[3] * x + m[4] * y + m[5] * z,
  m[6] * x + m[7] * y + m[8] * z,
];
const euler = (m: number[]): [number, number, number] => {
  const y = Math.asin(clamp(-m[5], -1, 1));
  return Math.abs(m[5]) < 0.99999
    ? [Math.atan2(m[2], m[8]), y, Math.atan2(m[3], m[4])]
    : [Math.atan2(-m[6], m[0]), y, 0];
};

/** Cards alternate through three slots so neighbours never share a resting angle. */
const nextSlot = (index: number) => (index === 2 ? 0 : index < 2 ? index + 1 : index);

const STRIDE = 20;

interface Pose {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}
interface WriteOptions {
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
}
const writePose = (
  store: Float32Array,
  index: number,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  media: number[],
  extra: WriteOptions = {},
) => {
  const at = STRIDE * index;
  store[at + 0] = x;
  store[at + 1] = y;
  store[at + 2] = extra.z ?? 0;
  store[at + 3] = w;
  store[at + 4] = h;
  store[at + 5] = extra.rx ?? 0;
  store[at + 6] = extra.ry ?? 0;
  store[at + 7] = extra.rz ?? 0;
  store[at + 8] = radius;
  store[at + 9] = media[0];
  store[at + 10] = media[1];
  store[at + 11] = media[2];
  store[at + 12] = media[3];
  store[at + 13] = media[4];
  store[at + 14] = 1;
};
/** Inset media box: [x, y, width, height, radius]. */
const mediaBox = (w: number, h: number, inset: number, caption: number, radius: number) => [
  inset,
  inset,
  w - 2 * inset,
  h - 2 * inset - caption,
  Math.max(radius - inset, 3),
];

interface RingGeometry {
  R: number;
  step: number;
  f0: number;
  dy: number;
  tilt: number;
  cull: boolean;
}
interface LayoutResult {
  poses: Float32Array;
  caps: Int8Array;
  ring: RingGeometry | null;
  panMinY: number;
  lift: [number, number];
  tag: boolean;
}

/* -------------------------------------------------------------------------------------------------
 * Layouts
 * -----------------------------------------------------------------------------------------------*/

function layoutFor(
  layout: LayoutId,
  aspects: number[],
  sw: number,
  sh: number,
  frontIndex: number,
): LayoutResult {
  const count = aspects.length;
  const poses = new Float32Array(STRIDE * count);
  const caps = new Int8Array(count).fill(-1);
  const narrow = sw < 520;
  const inset = narrow ? 14 : 24;
  const gap = narrow ? 8 : 14;
  const width = sw - 2 * inset;
  const height = sh - 2 * inset;
  const result: LayoutResult = { poses, caps, ring: null, panMinY: 0, lift: [0, 0], tag: true };

  if (layout === "grid") {
    let best = { score: -1, cols: 4, w: 60, cap: false };
    for (let cols = 3; cols <= 10; cols++) {
      const rows = Math.ceil(count / cols);
      for (const captioned of [true, false]) {
        const size = Math.floor(
          Math.min(
            (width - (cols - 1) * gap) / cols,
            (height - (rows - 1) * gap) / rows - 40 * Number(captioned),
          ),
        );
        if (captioned && size < 112) continue;
        const score = size * (captioned ? 1.15 : 1);
        if (score > best.score) best = { score, cols, w: size, cap: captioned };
      }
    }
    const { cols, w, cap } = best;
    const rowHeight = w + 40 * Number(cap);
    const rows = Math.ceil(count / cols);
    const radius = cap ? 16 : narrow ? 10 : 12;
    const startX = -(cols * w + (cols - 1) * gap) / 2 + w / 2;
    const startY = -(rows * rowHeight + (rows - 1) * gap) / 2 + rowHeight / 2;
    for (let index = 0; index < count; index++) {
      writePose(
        poses,
        index,
        startX + (index % cols) * (w + gap),
        startY + Math.floor(index / cols) * (rowHeight + gap),
        w,
        rowHeight,
        radius,
        cap ? mediaBox(w, rowHeight, 5, 40, radius) : [0, 0, w, rowHeight, radius],
      );
      caps[index] = cap ? 0 : -1;
    }
    result.tag = !cap;
  } else if (layout === "masonry") {
    const cols = width >= 1000 ? 8 : width >= 760 ? 6 : width >= 520 ? 5 : 4;
    const columnWidth = (width - (cols - 1) * gap) / cols;
    const columnHeights = Array<number>(cols).fill(0);
    const placed = aspects.map((aspect) => {
      const column = columnHeights.indexOf(Math.min(...columnHeights));
      const top = columnHeights[column];
      const cardHeight = columnWidth * aspect;
      columnHeights[column] += cardHeight + gap;
      return { column, top, h: cardHeight };
    });
    const total = Math.max(...columnHeights) - gap;
    const scale = Math.min(1, height / total);
    const radius = narrow ? 10 : 12;
    const startX = -(cols * columnWidth + (cols - 1) * gap) / 2 + columnWidth / 2;
    placed.forEach((slot, index) => {
      const cardHeight = slot.h * scale;
      writePose(
        poses,
        index,
        startX + slot.column * (columnWidth + gap),
        -(total * scale) / 2 + slot.top * scale + cardHeight / 2,
        columnWidth,
        cardHeight,
        radius,
        [0, 0, columnWidth, cardHeight, radius],
      );
    });
  } else if (layout === "list") {
    const cols = clamp(Math.floor((width + gap) / (290 + gap)), 1, 3);
    const rows = Math.ceil(count / cols);
    const columnWidth = (width - (cols - 1) * gap) / cols;
    const total = 56 * rows + (rows - 1) * 8;
    const fits = total <= height;
    const startY = fits ? -total / 2 : -sh / 2 + inset;
    for (let index = 0; index < count; index++) {
      const column = Math.floor(index / rows);
      const row = index % rows;
      writePose(
        poses,
        index,
        -width / 2 + column * (columnWidth + gap) + columnWidth / 2,
        startY + 64 * row + 28,
        columnWidth,
        56,
        14,
        [6, 6, 44, 44, 9],
      );
      caps[index] = 1;
    }
    result.panMinY = fits ? 0 : -(total - height);
    result.tag = false;
    result.lift = [0, 0];
  } else if (layout === "stack") {
    const cardWidth = Math.round(clamp(0.19 * sw, 96, 200));
    const cardHeight = Math.round(1.36 * cardWidth);
    const arc = 2.3 * cardHeight;
    const spread = Math.min(
      1.3,
      2 * Math.asin(Math.min(1, (narrow ? width - 1.6 * cardWidth : width - cardWidth) / (2 * arc))),
    );
    const originY =
      -(
        -arc -
        cardHeight / 2 +
        (-arc * Math.cos(spread / 2) +
          (cardHeight / 2) * Math.cos(spread / 2) +
          (cardWidth / 2) * Math.sin(spread / 2))
      ) / 2;
    for (let index = 0; index < count; index++) {
      const angle = -spread / 2 + (index * spread) / (count - 1);
      writePose(
        poses,
        index,
        arc * Math.sin(angle),
        originY - arc * Math.cos(angle),
        cardWidth,
        cardHeight,
        14,
        [0, 0, cardWidth, cardHeight, 14],
        { rz: angle, z: 0.8 * index },
      );
    }
    result.lift = [36, Math.round(0.22 * cardHeight)];
  } else {
    const helix = layout === "helix";
    const cardWidth = helix ? Math.round(clamp(0.15 * sw, 66, 160)) : Math.round(clamp(0.3 * sw, 210, 320));
    const cardHeight = helix ? Math.round(1.3 * cardWidth) : cardWidth + 76;
    const step = helix ? (2 * Math.PI) / 10 : (cardWidth + 1.6 * gap) / Math.max(1.1 * sw, 720);
    const radius = helix ? (cardWidth + gap) / (2 * Math.sin(step / 2)) : Math.max(1.1 * sw, 720);
    const rowStep = helix ? ((cardHeight + gap) * 1.5) / 10 : 0;
    const corner = helix ? (narrow ? 9 : 12) : 22;
    for (let index = 0; index < count; index++) {
      const angle = (index - frontIndex) * step;
      writePose(
        poses,
        index,
        radius * Math.sin(angle),
        (index - (count - 1) / 2) * rowStep,
        cardWidth,
        cardHeight,
        corner,
        helix ? [0, 0, cardWidth, cardHeight, corner] : [8, 8, cardWidth - 16, cardWidth - 16, 15],
        { z: radius * Math.cos(angle) - radius, ry: angle },
      );
      caps[index] = helix ? -1 : 2;
    }
    result.ring = {
      R: radius,
      step,
      f0: frontIndex,
      dy: rowStep,
      tilt: helix ? -0.24 : 0,
      cull: !helix,
    };
    result.tag = helix;
    result.lift = [28 * Number(helix), 0];
  }

  return result;
}

/** The open card's target box, per kind and per stage width. */
function openBox(kind: ItemKind, sw: number, sh: number) {
  if (sw < 720) {
    const w = sw - 24;
    const h = sh - 24;
    return { w, h, r: 24, m: [8, 8, w - 16, Math.round(0.46 * h), 18] };
  }
  if (kind === "photo") {
    const w = Math.min(sw - 48, 940);
    const h = Math.min(sh - 40, 560);
    return { w, h, r: 28, m: [8, 8, w - 16 - 340, h - 16, 20] };
  }
  return {
    w: Math.min(sw - 48, 640),
    h: Math.min(sh - 40, 392),
    r: 28,
    m: [20, 20, 196, 236, 16],
  };
}

/* -------------------------------------------------------------------------------------------------
 * Engine
 * -----------------------------------------------------------------------------------------------*/

interface EngineOptions {
  stage: HTMLDivElement;
  world: HTMLDivElement;
  tag: HTMLDivElement | null;
  cards: HTMLButtonElement[];
  kinds: ItemKind[];
  aspects: number[];
  onFront: (index: number) => void;
  onBackdrop: () => void;
  onTag: (index: number) => void;
}

interface Origin {
  item?: number;
  x?: number;
  y?: number;
}

const SPRING_MORPH = spring(1.3 * motionTokens.spring.morph.visualDuration, motionTokens.spring.morph.bounce);
const SPRING_FAST = spring(0.22, 0);
const SPRING_SNAP = spring(motionTokens.spring.snappy.visualDuration, motionTokens.spring.snappy.bounce);
const SPRING_CAM = spring(1.35 * motionTokens.spring.smooth.visualDuration, 0.04);
const SPRING_PHI = spring(1.25 * motionTokens.spring.morph.visualDuration, 0.1);
const SPRING_TAG = {
  k: motionTokens.spring.responsive.stiffness,
  c: motionTokens.spring.responsive.damping,
};
const STAGGER = 9 * motionTokens.stagger.item;
/** Per-slot settle thresholds: sub-pixel for placement, looser for opacity. */
const SETTLE = [
  0.08, 0.08, 0.08, 0.08, 0.08, 6e-4, 6e-4, 6e-4, 0.05, 0.08, 0.08, 0.08, 0.08, 0.05, 0.002, 0.002, 0.002,
  0.002, 0.002, 0.002,
];

class MorphEngine {
  private cam = new Float64Array(6);
  private camV = new Float64Array(6);
  private camT = new Float64Array(6);
  private pz = 0;
  private ring: RingGeometry | null = null;
  private panMinY = 0;
  private lift: [number, number] = [30, 0];
  private tagOn = false;
  private fronts: Record<string, number> = { carousel: 2, helix: 11 };
  private layout: LayoutId = "grid";
  private dealt = false;
  private sw = 0;
  private sh = 0;
  private persp = 1200;
  private hovered = -1;
  private keyed = -1;
  private opened = -1;
  private time = 0;
  private raf = 0;
  private last = 0;
  private visible = true;
  private shown = true;
  private reduced = false;
  private drag: {
    id: number;
    x0: number;
    y0: number;
    active: boolean;
    phi0: number;
    px0: number;
    py0: number;
    t: number;
    v: number;
    vx: number;
    vy: number;
  } | null = null;
  private suppress = false;
  private backdrop = false;
  private front = -1;
  private tagP: [number, number] = [0, 0];
  private tagV: [number, number] = [0, 0];
  private tagShown = false;
  private tagIdx = -1;
  private tagSeen = 0;
  private n: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private tgt: Float32Array;
  private pend: Float32Array;
  private home: Float32Array;
  private release: Float64Array;
  private cap: Int8Array;
  private pendCap: Int8Array;
  private homeCap: Int8Array;
  private angles: Float32Array;
  private back: Int8Array;
  private media: HTMLElement[];
  private caps: HTMLElement[][];
  private cache: string[][];
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private wheelTimer: ReturnType<typeof setTimeout> | undefined;
  private o: EngineOptions;

  constructor(options: EngineOptions) {
    this.o = options;
    const count = (this.n = options.cards.length);
    this.pos = new Float32Array(STRIDE * count);
    this.vel = new Float32Array(STRIDE * count);
    this.tgt = new Float32Array(STRIDE * count);
    this.pend = new Float32Array(STRIDE * count);
    this.home = new Float32Array(STRIDE * count);
    this.release = new Float64Array(count).fill(-1);
    this.cap = new Int8Array(count);
    this.pendCap = new Int8Array(count);
    this.homeCap = new Int8Array(count);
    this.angles = new Float32Array(count);
    this.back = new Int8Array(count);
    this.media = options.cards.map((card) => card.querySelector<HTMLElement>('[data-part="media"]') as HTMLElement);
    this.caps = options.cards.map((card) => Array.from(card.querySelectorAll<HTMLElement>('[data-part="cap"]')));
    this.cache = options.cards.map(() => []);

    for (let index = 0; index < count; index++) {
      const slot = nextSlot(index);
      writePose(this.pos, index, 0, 0, 150, 196, 16, mediaBox(150, 196, 5, 40, 16), {
        z: (count - slot) * 0.6,
        rz: slot === 0 ? 0 : ((((7 * index) % 9) - 4) * 1.1 * Math.PI) / 180,
      });
      this.pos[STRIDE * index + 15] = 1;
    }
    this.tgt.set(this.pos);
    this.home.set(this.pos);

    const { stage } = options;
    stage.addEventListener("pointerdown", this.onDown);
    stage.addEventListener("pointermove", this.onMove);
    stage.addEventListener("pointerup", this.onUp);
    stage.addEventListener("pointercancel", this.onUp);
    stage.addEventListener("wheel", this.onWheel, { passive: false });
    document.addEventListener("visibilitychange", this.onVisibility);
    this.ro = new ResizeObserver((entries) => {
      const box = entries[0].contentRect;
      this.resize(box.width, box.height);
    });
    this.ro.observe(stage);
    this.io = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        this.visible = entry.isIntersecting;
        if (entry.isIntersecting && !this.dealt && entry.intersectionRatio > 0.3) this.deal();
        this.kick();
      },
      { threshold: [0, 0.35] },
    );
    this.io.observe(stage);
  }

  destroy() {
    const { stage } = this.o;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.wheelTimer);
    this.ro.disconnect();
    this.io.disconnect();
    stage.removeEventListener("pointerdown", this.onDown);
    stage.removeEventListener("pointermove", this.onMove);
    stage.removeEventListener("pointerup", this.onUp);
    stage.removeEventListener("pointercancel", this.onUp);
    stage.removeEventListener("wheel", this.onWheel);
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  setReduced(reduced: boolean) {
    this.reduced = reduced;
    if (reduced && !this.dealt && this.sw) this.deal();
    this.kick();
  }

  setLayout(layout: LayoutId, origin?: Origin | null, force = false) {
    const same = layout === this.layout && this.dealt;
    this.layout = layout;
    if ((!this.dealt && ((this.dealt = true), !this.sw)) || (same && !force)) return;
    const item = origin && "item" in origin && origin.item !== undefined ? origin.item : -1;
    const at: [number, number] =
      item >= 0
        ? this.screenOf(item, false)
        : origin && origin.x !== undefined && origin.y !== undefined
          ? [origin.x, origin.y]
          : [0, 0];
    this.apply(item, at, force || this.reduced, false);
  }

  deal() {
    this.dealt = true;
    if (this.sw) this.apply(-1, [0, 0], this.reduced, true);
  }

  private apply(item: number, origin: [number, number], instant: boolean, stagger: boolean) {
    const count = this.n;
    const wasOpen = this.opened;
    this.opened = -1;
    this.bake();
    const frontIndex =
      this.layout === "carousel" || this.layout === "helix"
        ? item >= 0
          ? item
          : (this.fronts[this.layout] ?? 0)
        : 0;
    const next = layoutFor(this.layout, this.o.aspects, this.sw, this.sh, frontIndex);
    this.ring = next.ring;
    this.panMinY = next.panMinY;
    this.lift = next.lift;
    this.tagOn = next.tag;
    this.pz = next.ring ? next.ring.R : 0;

    const ring = next.ring;
    this.cam[2] = ring ? (frontIndex - (count - 1) / 2) * ring.dy : 0;
    this.camT[1] = ring ? ring.tilt : 0;
    this.camT[4] = ring ? ring.R * Math.sin(ring.tilt) : 0;
    this.o.stage.dataset.scroll = String(next.panMinY < 0);
    this.o.stage.dataset.layout = this.layout;

    const distance = new Float32Array(count);
    let farthest = 1;
    for (let index = 0; index < count; index++) {
      const at = this.screenOf(index, false);
      distance[index] = Math.hypot(at[0] - origin[0], at[1] - origin[1]);
      farthest = Math.max(farthest, distance[index]);
    }
    for (let index = 0; index < count; index++) {
      const at = STRIDE * index;
      for (let slot = 0; slot <= 14; slot++) this.pend[at + slot] = next.poses[at + slot];
      this.pend[at + 6] = this.pos[at + 6] + wrap(this.pend[at + 6] - this.pos[at + 6]);
      this.pend[at + 7] = this.pos[at + 7] + wrap(this.pend[at + 7] - this.pos[at + 7]);
      this.pendCap[index] = next.caps[index];
      this.angles[index] = next.poses[at + 6];
      for (let slot = 0; slot <= 14; slot++) this.home[at + slot] = next.poses[at + slot];
      this.homeCap[index] = next.caps[index];
      const delay = stagger
        ? (nextSlot(index) / (count - 1)) * STAGGER * 1.6
        : (distance[index] / farthest) * STAGGER;
      this.release[index] = instant ? this.time : this.time + delay;
    }
    if (instant) {
      for (let index = 0; index < count; index++) this.releaseItem(index, false);
      this.snapAll();
    }
    if (wasOpen >= 0) {
      this.o.stage.dataset.open = "false";
      this.o.cards.forEach((card) => {
        card.dataset.active = "false";
      });
    }
    this.updateFront();
    this.kick();
  }

  /**
   * Folds a live camera rotation into each card's own position and velocity, so a layout change
   * mid-spin does not jump: the card keeps its screen place and the new layout starts from there.
   */
  private bake() {
    const cam = this.cam;
    const camV = this.camV;
    if (
      Math.abs(cam[0]) < 1e-6 &&
      Math.abs(cam[1]) < 1e-6 &&
      Math.abs(this.screw(cam[0]) + cam[2]) < 0.001 &&
      Math.abs(cam[3]) < 0.001 &&
      Math.abs(cam[4]) < 0.001 &&
      Math.abs(cam[5]) < 0.001
    )
      return;
    const m = mul(rotX(cam[1]), rotY(cam[0]));
    const step = 0.001 * camV[0];
    for (let index = 0; index < this.n; index++) {
      const at = STRIDE * index;
      const stores = this.release[index] >= 0 ? [this.pos, this.tgt, this.pend] : [this.pos, this.tgt];
      const here = this.world(this.pos[at + 0], this.pos[at + 1], this.pos[at + 2]);
      const ahead = this.world(this.pos[at + 0], this.pos[at + 1], this.pos[at + 2], cam[0] + step);
      for (const store of stores) {
        const [x, y, z] = this.world(store[at + 0], store[at + 1], store[at + 2]);
        const [ry, rx, rz] = euler(mul(m, mul(rotY(store[at + 6]), mul(rotX(store[at + 5]), rotZ(store[at + 7])))));
        store[at + 0] = x;
        store[at + 1] = y;
        store[at + 2] = z;
        store[at + 6] = ry;
        store[at + 5] = rx;
        store[at + 7] = rz;
      }
      const [vx, vy, vz] = apply3(m, this.vel[at + 0], this.vel[at + 1], this.vel[at + 2]);
      const gain = 1e3 * Number(step !== 0);
      this.vel[at + 0] = vx + (ahead[0] - here[0]) * gain;
      this.vel[at + 1] = vy + (ahead[1] - here[1]) * gain;
      this.vel[at + 2] = vz + (ahead[2] - here[2]) * gain;
      this.vel[at + 6] += camV[0];
    }
    this.cam.fill(0);
    this.camV.fill(0);
    this.camT.fill(0);
    this.pz = 0;
    this.ring = null;
  }

  private screw(phi: number) {
    const ring = this.ring;
    return ring && ring.dy ? -(ring.f0 - phi / ring.step - (this.n - 1) / 2) * ring.dy : 0;
  }

  private world(x: number, y: number, z: number, phi = this.cam[0], cam = this.cam): [number, number, number] {
    const offset = this.screw(phi) + cam[2];
    const [wx, wy, wz] = apply3(mul(rotX(cam[1]), rotY(phi)), x, y + offset, z + this.pz);
    return [wx + cam[3], wy + cam[4], wz + cam[5] - this.pz];
  }

  private screenOf(index: number, withLift: boolean): [number, number] {
    const at = STRIDE * index;
    const pos = this.pos;
    const lifted = pos[at + 19];
    const [ox, oy, oz] = withLift
      ? apply3(
          mul(rotY(pos[at + 6]), mul(rotX(pos[at + 5]), rotZ(pos[at + 7]))),
          0,
          -pos[at + 4] / 2 - this.lift[1] * lifted,
          this.lift[0] * lifted,
        )
      : [0, 0, 0];
    const [x, y, z] = this.world(pos[at + 0] + ox, pos[at + 1] + oy, pos[at + 2] + oz);
    const scale = this.persp / Math.max(1, this.persp - z);
    return [x * scale, y * scale];
  }

  private releaseItem(index: number, withKick: boolean) {
    const at = STRIDE * index;
    const dx = this.pend[at + 0] - this.pos[at + 0];
    const dy = this.pend[at + 1] - this.pos[at + 1];
    for (let slot = 0; slot <= 14; slot++) this.tgt[at + slot] = this.pend[at + slot];
    if (this.opened >= 0 && index !== this.opened) this.tgt[at + 14] = 0.12;
    this.cap[index] = this.pendCap[index];
    this.release[index] = -1;
    if (withKick && !this.reduced) {
      this.vel[at + 2] += Math.min(3 * Math.hypot(dx, dy), 2600);
      this.vel[at + 7] += 1.1 * clamp(dx / 600, -1.4, 1.4);
    }
  }

  private snapAll() {
    this.pos.set(this.tgt);
    this.vel.fill(0);
    for (let index = 0; index < this.n; index++) {
      for (let slot = 0; slot < 4; slot++) this.pos[STRIDE * index + 15 + slot] = Number(slot === this.cap[index]);
    }
    this.cam.set(this.camT);
    this.camV.fill(0);
  }

  private resize(width: number, height: number) {
    if (width < 1 || height < 1 || (Math.abs(width - this.sw) < 0.5 && Math.abs(height - this.sh) < 0.5)) return;
    const first = !this.sw;
    this.sw = width;
    this.sh = height;
    this.persp = clamp(1.15 * width, 900, 1500);
    this.o.stage.style.perspective = `${this.persp}px`;
    this.o.stage.dataset.narrow = String(width < 720);
    if (first) {
      if (this.dealt) this.apply(-1, [0, 0], this.reduced, !this.reduced);
      return;
    }
    if (!this.dealt) return;
    const open = this.opened;
    const front = this.ring ? this.front : -1;
    this.apply(front, [0, 0], true, false);
    if (open >= 0) this.open(open, true);
  }

  hover(index: number) {
    if (this.hovered !== index) {
      this.hovered = index;
      this.kick();
    }
  }

  unhover(index: number) {
    if (this.hovered === index) {
      this.hovered = -1;
      this.kick();
    }
  }

  focusItem(index: number, keyboard: boolean, moveToFront = true) {
    this.keyed = keyboard ? index : -1;
    if (keyboard && moveToFront && index >= 0 && this.ring && this.opened < 0) this.toFront(index);
    this.kick();
  }

  blurItem(index: number) {
    if (this.keyed === index) {
      this.keyed = -1;
      this.kick();
    }
  }

  isRing() {
    return !!this.ring;
  }

  frontIndex() {
    return this.front;
  }

  takeClick() {
    const suppressed = this.suppress;
    this.suppress = false;
    return suppressed;
  }

  toFront(index: number) {
    const ring = this.ring;
    if (!ring) return;
    this.camT[0] = (ring.f0 - index) * ring.step;
    if (this.reduced) {
      this.cam[0] = this.camT[0];
      this.camV[0] = 0;
    }
    this.kick();
  }

  open(index: number, instant = false) {
    if (this.drag?.active) return;
    const count = this.n;
    this.opened = index;
    this.hovered = -1;
    this.keyed = -1;
    const box = openBox(this.o.kinds[index], this.sw, this.sh);
    this.camT[5] = -360;
    const camT = this.camT;
    const [phi, tilt] = [camT[0], camT[1]];
    const offset = this.screw(phi) + camT[2];
    const [lx, ly, lz] = apply3(mul(rotY(-phi), rotX(-tilt)), -camT[3], -camT[4], -(camT[5] - this.pz));
    const at = STRIDE * index;
    this.release[index] = -1;
    const tgt = this.tgt;
    tgt[at + 0] = lx;
    tgt[at + 1] = ly - offset;
    tgt[at + 2] = lz - this.pz;
    tgt[at + 3] = box.w;
    tgt[at + 4] = box.h;
    tgt[at + 8] = box.r;
    tgt[at + 5] = -tilt;
    tgt[at + 6] = this.pos[at + 6] + wrap(-phi - this.pos[at + 6]);
    tgt[at + 7] = this.pos[at + 7] + wrap(-this.pos[at + 7]);
    tgt[at + 9] = box.m[0];
    tgt[at + 10] = box.m[1];
    tgt[at + 11] = box.m[2];
    tgt[at + 12] = box.m[3];
    tgt[at + 13] = box.m[4];
    tgt[at + 14] = 1;
    this.cap[index] = 3;
    for (let other = 0; other < count; other++) {
      if (other === index) continue;
      this.tgt[STRIDE * other + 14] = 0.12;
      if (this.release[other] >= 0) this.pend[STRIDE * other + 14] = 1;
    }
    if (!this.reduced && !instant) this.vel[at + 2] += 900;
    if (this.reduced || instant) {
      this.cam[5] = camT[5];
      this.pos.set(this.tgt.subarray(at, at + 15), at);
      this.vel.fill(0, at, at + STRIDE);
    }
    this.o.stage.dataset.open = "true";
    this.o.cards.forEach((card, cardIndex) => {
      card.dataset.active = String(cardIndex === index);
    });
    this.kick();
  }

  close() {
    const index = this.opened;
    if (index < 0) return;
    this.opened = -1;
    const at = STRIDE * index;
    for (let slot = 0; slot <= 14; slot++) this.tgt[at + slot] = this.home[at + slot];
    this.tgt[at + 6] = this.pos[at + 6] + wrap(this.home[at + 6] - this.pos[at + 6]);
    this.tgt[at + 7] = this.pos[at + 7] + wrap(this.home[at + 7] - this.pos[at + 7]);
    this.cap[index] = this.homeCap[index];
    for (let other = 0; other < this.n; other++) {
      if (other !== index && this.release[other] < 0) this.tgt[STRIDE * other + 14] = this.home[STRIDE * other + 14];
    }
    this.camT[5] = 0;
    if (this.reduced) {
      this.cam[5] = 0;
      this.pos.set(this.tgt.subarray(at, at + 15), at);
      this.vel.fill(0, at, at + STRIDE);
    }
    this.o.stage.dataset.open = "false";
    this.o.cards.forEach((card) => {
      card.dataset.active = "false";
    });
    this.kick();
  }

  private phiBounds(): [number, number] {
    const ring = this.ring as RingGeometry;
    return [(ring.f0 - (this.n - 1)) * ring.step, ring.f0 * ring.step];
  }

  private kick() {
    if (this.raf || !this.visible || !this.shown) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private updateFront() {
    const ring = this.ring;
    const front = ring ? clamp(Math.round(ring.f0 - this.cam[0] / ring.step), 0, this.n - 1) : -1;
    if (ring) this.fronts[this.layout] = front;
    if (front !== this.front) {
      this.front = front;
      this.o.onFront(front);
    }
  }

  private tick(dt: number) {
    const { n, pos, vel, tgt } = this;
    this.time += dt;
    let moving = !!this.drag?.active;
    for (let index = 0; index < n; index++) {
      if (this.release[index] < 0) continue;
      moving = true;
      if (this.release[index] <= this.time) this.releaseItem(index, true);
    }
    const lifted = this.drag?.active || this.opened >= 0 ? -2 : this.hovered >= 0 ? this.hovered : this.keyed;
    for (let index = 0; index < n; index++) {
      const at = STRIDE * index;
      const w = Math.max(1, tgt[at + 3]);
      const h = Math.max(1, tgt[at + 4]);
      const near = clamp(
        1 -
          3.2 *
            (Math.abs(pos[at + 3] - w) / w +
              Math.abs(pos[at + 4] - h) / h +
              Math.hypot(pos[at + 0] - tgt[at + 0], pos[at + 1] - tgt[at + 1]) / 500),
        0,
        1,
      );
      for (let slot = 0; slot < 4; slot++) tgt[at + 15 + slot] = slot === this.cap[index] ? near : 0;
      tgt[at + 19] = Number(index === lifted);
    }
    if (this.reduced) {
      pos.set(tgt);
      vel.fill(0);
      this.cam.set(this.camT);
      this.camV.fill(0);
    } else {
      const steps = Math.max(1, Math.ceil(120 * dt));
      const step = dt / steps;
      for (let sub = 0; sub < steps; sub++) {
        for (let i = 0; i < STRIDE * n; i++) {
          const slot = i % STRIDE;
          const s = slot < 14 ? SPRING_MORPH : slot < 19 ? SPRING_FAST : SPRING_SNAP;
          const accel = -s.k * (pos[i] - tgt[i]) - s.c * vel[i];
          vel[i] += accel * step;
          pos[i] += vel[i] * step;
        }
        for (let slot = 0; slot < 6; slot++) {
          if (this.drag?.active && (slot === 0 || slot === 3 || slot === 4)) continue;
          const s = slot === 0 ? SPRING_PHI : SPRING_CAM;
          const accel = -s.k * (this.cam[slot] - this.camT[slot]) - s.c * this.camV[slot];
          this.camV[slot] += accel * step;
          this.cam[slot] += this.camV[slot] * step;
        }
      }
    }
    for (let i = 0; i < STRIDE * n; i++) {
      const limit = SETTLE[i % STRIDE];
      if (Math.abs(pos[i] - tgt[i]) > limit || Math.abs(vel[i]) > 10 * limit) moving = true;
      else {
        pos[i] = tgt[i];
        vel[i] = 0;
      }
    }
    for (let slot = 0; slot < 6; slot++) {
      const limit = slot === 0 || slot === 1 ? 2e-4 : 0.05;
      if (Math.abs(this.cam[slot] - this.camT[slot]) > limit || Math.abs(this.camV[slot]) > 10 * limit) {
        moving = true;
      } else if (!(this.drag?.active && (slot === 0 || slot === 3 || slot === 4))) {
        this.cam[slot] = this.camT[slot];
        this.camV[slot] = 0;
      }
    }
    this.updateFront();
    this.write();
    if (this.moveTag(dt)) moving = true;
    return moving;
  }

  private frame = (now: number) => {
    this.raf = 0;
    const dt = Math.min(1 / 30, Math.max(0, (now - this.last) / 1e3));
    this.last = now;
    if (this.tick(dt) && this.visible && this.shown) this.raf = requestAnimationFrame(this.frame);
  };

  private write() {
    const { n, pos, cam } = this;
    const [liftZ, liftY] = this.lift;
    const offset = this.screw(cam[0]) + cam[2];
    this.o.world.style.transform = `translate3d(${round2(cam[3])}px,${round2(cam[4])}px,${round2(cam[5] - this.pz)}px) rotateX(${round4(cam[1])}rad) rotateY(${round4(cam[0])}rad) translate3d(0,${round2(offset)}px,${round2(this.pz)}px)`;
    const camMatrix = mul(rotX(cam[1]), rotY(cam[0]));

    for (let index = 0; index < n; index++) {
      const at = STRIDE * index;
      const card = this.o.cards[index];
      const media = this.media[index];
      const cache = this.cache[index];
      const w = pos[at + 3];
      const h = pos[at + 4];
      const lifted = pos[at + 19];
      let transform = `translate3d(${round2(pos[at + 0] - w / 2)}px,${round2(pos[at + 1] - h / 2)}px,${round2(pos[at + 2])}px) rotateY(${round4(pos[at + 6])}rad) rotateX(${round4(pos[at + 5])}rad) rotateZ(${round4(pos[at + 7])}rad)`;
      if (lifted > 0.001) transform += ` translate3d(0,${round2(-lifted * liftY)}px,${round2(lifted * liftZ)}px)`;

      let cull = 1;
      if (this.ring?.cull && index !== this.opened) {
        const facing = 1 - smoothstep(0.8, 1.15, Math.abs(this.angles[index] + cam[0]));
        cull = facing;
      }
      const [wx, wy, wz] = this.world(pos[at + 0], pos[at + 1], pos[at + 2]);
      const cosX = Math.cos(pos[at + 5]);
      const [nx, ny, nz] = apply3(
        camMatrix,
        cosX * Math.sin(pos[at + 6]),
        -Math.sin(pos[at + 5]),
        cosX * Math.cos(pos[at + 6]),
      );
      const back = Number(-(nx * wx) + -(ny * wy) + nz * (this.persp - wz) < 0);
      const opacity = clamp(pos[at + 14] * cull * (back ? 0.72 : 1), 0, 1);

      const values = [
        transform,
        `${round2(w)}px`,
        `${round2(h)}px`,
        `${round2(pos[at + 8])}px`,
        `translate(${round2(pos[at + 9])}px,${round2(pos[at + 10])}px)`,
        `${round2(pos[at + 11])}px`,
        `${round2(pos[at + 12])}px`,
        `${round2(pos[at + 13])}px`,
        String(round4(opacity)),
        String(round4(lifted)),
      ];
      const targets = [
        card.style,
        card.style,
        card.style,
        card.style,
        media.style,
        media.style,
        media.style,
        media.style,
        card.style,
      ];
      const props: (keyof CSSStyleDeclaration)[] = [
        "transform",
        "width",
        "height",
        "borderRadius",
        "transform",
        "width",
        "height",
        "borderRadius",
        "opacity",
      ];
      for (let slot = 0; slot < props.length; slot++) {
        if (cache[slot] === values[slot]) continue;
        cache[slot] = values[slot];
        const style = targets[slot] as CSSStyleDeclaration;
        const prop = props[slot] as "transform" | "width" | "height" | "borderRadius" | "opacity";
        style[prop] = values[slot];
      }
      if (cache[9] !== values[9]) {
        cache[9] = values[9];
        card.style.setProperty("--lift", values[9]);
      }
      const pointer = opacity < 0.02 ? "none" : "";
      if (cache[10] !== pointer) {
        cache[10] = pointer;
        card.style.pointerEvents = pointer;
      }
      if (this.back[index] !== back) {
        this.back[index] = back;
        card.dataset.back = String(!!back);
      }
      for (let slot = 0; slot < 4; slot++) {
        const value = String(round4(pos[at + 15 + slot]));
        if (cache[11 + slot] === value) continue;
        cache[11 + slot] = value;
        this.caps[index][slot].style.opacity = value;
      }
    }
  }

  private moveTag(dt: number) {
    const tag = this.o.tag;
    if (!tag) return false;
    let index = this.hovered >= 0 ? this.hovered : this.keyed;
    if (index >= 0) this.tagSeen = this.time;
    else if (this.tagIdx >= 0 && this.time - this.tagSeen < 0.16) index = this.tagIdx;
    const shown =
      this.tagOn &&
      index >= 0 &&
      this.opened < 0 &&
      !this.drag?.active &&
      !this.back[index] &&
      this.release[index] < 0;
    if (shown !== this.tagShown) {
      this.tagShown = shown;
      tag.dataset.show = String(shown);
    }
    if (!shown) {
      this.tagIdx = -1;
      return false;
    }
    const [px, py] = this.screenOf(index, true);
    const x = this.sw / 2 + px;
    const y = this.sh / 2 + py;
    if (this.tagIdx < 0 || this.reduced) {
      this.tagP = [x, y];
      this.tagV = [0, 0];
    }
    if (index !== this.tagIdx) this.o.onTag(index);
    this.tagIdx = index;
    const steps = Math.max(1, Math.ceil(120 * dt));
    const step = dt / steps;
    for (let sub = 0; sub < steps; sub++) {
      for (let axis = 0; axis < 2; axis++) {
        const goal = axis ? y : x;
        const accel = -SPRING_TAG.k * (this.tagP[axis] - goal) - SPRING_TAG.c * this.tagV[axis];
        this.tagV[axis] += accel * step;
        this.tagP[axis] += this.tagV[axis] * step;
      }
    }
    const tx = clamp(this.tagP[0], 96, this.sw - 96);
    const ty = Math.max(56, this.tagP[1]);
    tag.style.transform = `translate3d(${round2(tx)}px,${round2(ty)}px,0)`;
    return (
      (this.hovered < 0 && this.keyed < 0) ||
      Math.hypot(this.tagP[0] - x, this.tagP[1] - y) > 0.3 ||
      Math.hypot(this.tagV[0], this.tagV[1]) > 3
    );
  }

  itemOrigin(index: number) {
    return this.screenOf(index, false);
  }

  /* -- input ----------------------------------------------------------------------------------- */

  private onDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    if (this.opened >= 0) {
      const card = this.o.cards[this.opened];
      const target = event.target;
      this.backdrop = !card.contains(target as Node) && !(target instanceof Element && target.closest("button"));
      return;
    }
    this.suppress = false;
    this.drag = {
      id: event.pointerId,
      x0: event.clientX,
      y0: event.clientY,
      active: false,
      phi0: this.cam[0],
      px0: this.cam[3],
      py0: this.cam[4],
      t: event.timeStamp,
      v: 0,
      vx: 0,
      vy: 0,
    };
  };

  private onMove = (event: PointerEvent) => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x0;
    const dy = event.clientY - drag.y0;
    if (!drag.active) {
      if (Math.hypot(dx, dy) < 6) return;
      if (event.pointerType !== "mouse" && Math.abs(dy) > Math.abs(dx) && !(this.panMinY < 0 && !this.ring)) {
        this.drag = null;
        return;
      }
      drag.active = true;
      drag.phi0 = this.cam[0];
      drag.px0 = this.cam[3];
      drag.py0 = this.cam[4];
      drag.x0 = event.clientX;
      drag.y0 = event.clientY;
      this.o.stage.setPointerCapture(event.pointerId);
      this.o.stage.dataset.dragging = "true";
      return;
    }
    const elapsed = Math.max(1, event.timeStamp - drag.t) / 1e3;
    drag.t = event.timeStamp;
    if (this.ring) {
      const ring = this.ring;
      const [min, max] = this.phiBounds();
      const phi = rubberClamp((drag.phi0 + dx / ring.R) * ring.R, min * ring.R, max * ring.R, 0.5 * this.sw) / ring.R;
      drag.v = 0.75 * ((phi - this.cam[0]) / elapsed) + 0.25 * drag.v;
      this.cam[0] = this.camT[0] = phi;
      this.camV[0] = 0;
    } else {
      const px = rubberClamp(drag.px0 + dx, 0, 0, 0.6 * this.sw);
      const py = rubberClamp(drag.py0 + dy, this.panMinY, 0, 0.6 * this.sh);
      drag.vx = 0.75 * ((px - this.cam[3]) / elapsed) + 0.25 * drag.vx;
      drag.vy = 0.75 * ((py - this.cam[4]) / elapsed) + 0.25 * drag.vy;
      this.cam[3] = this.camT[3] = px;
      this.cam[4] = this.camT[4] = py;
      this.camV[3] = this.camV[4] = 0;
    }
    this.kick();
  };

  private onUp = (event: PointerEvent) => {
    if (this.opened >= 0) {
      if (this.backdrop && event.type === "pointerup") this.o.onBackdrop();
      this.backdrop = false;
      return;
    }
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.id) return;
    this.drag = null;
    if (!drag.active) return;
    this.suppress = true;
    if (this.o.stage.hasPointerCapture(event.pointerId)) this.o.stage.releasePointerCapture(event.pointerId);
    this.o.stage.dataset.dragging = "false";
    const thrown = event.timeStamp - drag.t > 90;
    if (this.ring) {
      const ring = this.ring;
      const velocity = thrown ? 0 : clamp(drag.v, -14, 14);
      const phi = this.cam[0] + 0.3 * velocity;
      const target = clamp(Math.round(ring.f0 - phi / ring.step), 0, this.n - 1);
      this.camT[0] = (ring.f0 - target) * ring.step;
      this.camV[0] = this.reduced ? 0 : velocity;
    } else {
      this.camT[3] = 0;
      this.camT[4] = clamp(this.cam[4] + (thrown ? 0 : drag.vy) * 0.3, this.panMinY, 0);
      this.camV[3] = this.reduced || thrown ? 0 : drag.vx;
      this.camV[4] = this.reduced || thrown ? 0 : drag.vy;
    }
    if (this.reduced) this.cam.set(this.camT);
    this.kick();
  };

  private onWheel = (event: WheelEvent) => {
    if (this.opened >= 0) return;
    if (this.ring) {
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.shiftKey ? event.deltaY : 0;
      if (!delta) return;
      event.preventDefault();
      const [min, max] = this.phiBounds();
      const phi = clamp(this.camT[0] - delta / this.ring.R, min, max);
      this.camT[0] = phi;
      if (this.reduced) this.cam[0] = phi;
      clearTimeout(this.wheelTimer);
      this.wheelTimer = setTimeout(() => {
        const ring = this.ring;
        if (!ring) return;
        this.toFront(clamp(Math.round(ring.f0 - this.camT[0] / ring.step), 0, this.n - 1));
      }, 140);
      this.kick();
    } else if (this.panMinY < 0 && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      const py = clamp(this.camT[4] - event.deltaY, this.panMinY, 0);
      if (py === this.camT[4]) return;
      event.preventDefault();
      this.camT[4] = py;
      if (this.reduced) this.cam[4] = py;
      this.kick();
    }
  };

  private onVisibility = () => {
    this.shown = document.visibilityState === "visible";
    this.kick();
  };
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/* -------------------------------------------------------------------------------------------------
 * Store — the engine writes hover / focus / front / tag, React reads them
 * -----------------------------------------------------------------------------------------------*/

interface StoreState {
  hover: number;
  key: number;
  front: number;
  tag: number;
}
type Store = ReturnType<typeof createStore>;

function createStore() {
  let state: StoreState = { hover: -1, key: -1, front: -1, tag: -1 };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch: Partial<StoreState>) {
      const next = { ...state, ...patch };
      if (
        next.hover !== state.hover ||
        next.key !== state.key ||
        next.front !== state.front ||
        next.tag !== state.tag
      ) {
        state = next;
        listeners.forEach((listener) => listener());
      }
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/* -------------------------------------------------------------------------------------------------
 * Presentational pieces
 * -----------------------------------------------------------------------------------------------*/

/** The live preview injects this reset on framed parts; keep it identical so the frame matches. */
const FLAT = { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" } as const;

const captionOf = (item: GalleryItem) =>
  item.kind === "maker" ? `${item.by}, ${item.meta}` : `By ${item.by}`;
const valueOf = (item: GalleryItem) =>
  item.kind === "maker" ? `${item.stats[0]} ${item.stats[0] === 1 ? "piece" : "pieces"}` : money(item.stats[0]);

/** Digits roll into place: each one is a strip of 0–9 translated by its value. */
function Roll({ text }: { text: string }) {
  const chars = [...text];
  return (
    <span className={styles.roll}>
      <span className={styles.srOnly}>{text}</span>
      <span className={styles.rollVisual} aria-hidden="true">
        {chars.map((char, index) => {
          const key = chars.length - 1 - index;
          if (char < "0" || char > "9") {
            return (
              <span className={styles.sym} key={`s${key}`}>
                {char}
              </span>
            );
          }
          return (
            <span className={styles.wheel} key={`d${key}`}>
              <span className={styles.strip} style={{ "--d": char, "--i": index } as CSSProperties}>
                {DIGITS.map((digit) => (
                  <span key={digit}>{digit}</span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

function StatPanel({ store, open, flat }: { store: Store; open: number; flat: boolean }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.get, store.get);
  const active = open >= 0 ? open : snapshot.hover >= 0 ? snapshot.hover : snapshot.key >= 0 ? snapshot.key : snapshot.front;
  const item = active >= 0 ? CARDS[active] : null;
  const kind = item ? item.kind : "summary";
  const stats = item ? item.stats : SUMMARY_STATS;
  return (
    <div className={styles.panel} data-frame-flat={flat ? "" : undefined} style={FLAT}>
      <div className={styles.panelWho}>
        <span className={styles.swap} key={item?.id ?? "summary"}>
          <span className={styles.panelName}>{item ? item.name : "Autumn edit"}</span>
          <span className={styles.panelMeta}>{item ? captionOf(item) : "Hover a card for its details"}</span>
        </span>
      </div>
      {STAT_LABELS[kind].map((label, index) => (
        <div className={styles.stat} key={label}>
          <span className={styles.statLabel}>
            <span className={styles.swap} key={label}>
              {label}
            </span>
          </span>
          <span className={styles.statValue}>
            <Roll
              text={
                index === 2
                  ? stats[index].toFixed(1)
                  : index === 0 && (kind === "photo" || kind === "type")
                    ? money(stats[index])
                    : stats[index].toLocaleString("en-US")
              }
            />
          </span>
        </div>
      ))}
    </div>
  );
}

function HoverTag({ store }: { store: Store }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.get, store.get);
  const item = snapshot.tag >= 0 ? CARDS[snapshot.tag] : null;
  if (!item) return null;
  return (
    <>
      <span className={styles.tagName}>{item.name}</span>
      <span className={styles.tagMeta}>
        {item.kind === "maker" ? `${item.by}, ${item.meta}` : `${money(item.stats[0])} · ${item.by}`}
      </span>
    </>
  );
}

function CardBody({ item }: { item: GalleryItem }) {
  const maker = item.kind === "maker";
  return (
    <>
      <span className={styles.media} data-part="media">
        {item.image ? (
          <img
            src={item.image}
            alt=""
            draggable={false}
            loading="eager"
            decoding="async"
            data-maker={maker}
            className={styles.img}
            style={{
              position: "absolute",
              height: "100%",
              width: "100%",
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              color: "transparent",
            }}
          />
        ) : (
          <span className={styles.cover}>
            <span className={styles.coverName}>{item.name}</span>
            <span className={styles.coverPrice}>{money(item.stats[0])}</span>
          </span>
        )}
      </span>
      <span className={`${styles.cap} ${styles.capCompact}`} data-part="cap">
        <span className={styles.capTitle}>{item.name}</span>
        <span className={styles.capMeta}>{maker ? item.by : money(item.stats[0])}</span>
      </span>
      <span className={`${styles.cap} ${styles.capRow}`} data-part="cap">
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{item.name}</span>
          <span className={styles.capMeta}>{`${item.by} · ${item.meta}`}</span>
        </span>
        <span className={styles.rowValue}>{valueOf(item)}</span>
      </span>
      <span className={`${styles.cap} ${styles.capDetail}`} data-part="cap">
        <span className={styles.detailTop}>
          <span className={styles.detailTitle}>{item.name}</span>
          <span className={styles.detailValue}>{valueOf(item)}</span>
        </span>
        <span className={styles.capMeta}>{captionOf(item)}</span>
      </span>
      <span
        className={`${styles.cap} ${styles.sheet}`}
        data-part="cap"
        data-variant={item.kind === "photo" ? "hero" : "profile"}
      >
        <span className={styles.sheetTitle}>{item.name}</span>
        <span className={styles.sheetBy}>
          {maker ? `${item.by} in ${item.meta}` : `${captionOf(item)} · ${item.meta}`}
        </span>
        <span className={styles.sheetDesc}>{item.desc}</span>
        <span className={styles.facts}>
          {item.facts.map(([key, value]) => (
            <span className={styles.fact} key={key}>
              <span className={styles.factKey}>{key}</span>
              <span className={styles.factValue}>{value}</span>
            </span>
          ))}
        </span>
      </span>
    </>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Block
 * -----------------------------------------------------------------------------------------------*/

export interface LayoutMorphProps {
  /** Drops the stage and panel frames, matching the flattened live preview. */
  flat?: boolean;
}

export function LayoutMorph({ flat = false }: LayoutMorphProps = {}) {
  const titleId = useId();
  const dialogId = useId();
  const pillId = useId();
  const reduced = useReducedMotion() ?? false;
  const [store] = useState(createStore);
  const [view, setView] = useState<LayoutId>("grid");
  const [open, setOpen] = useState(-1);
  const [shownItem, setShownItem] = useState(-1);
  const [focusIndex, setFocusIndex] = useState(2);
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [live, setLive] = useState("");

  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const engineRef = useRef<MorphEngine | null>(null);
  const closeHandler = useRef<() => void>(() => {});
  const restoring = useRef(false);

  useEffect(() => {
    const stage = stageRef.current;
    const world = worldRef.current;
    if (!stage || !world) return;
    const engine = new MorphEngine({
      stage,
      world,
      tag: tagRef.current,
      cards: cardRefs.current.filter((card): card is HTMLButtonElement => !!card),
      kinds: CARDS.map((card) => card.kind),
      aspects: CARDS.map((card) => card.aspect),
      onFront: (index) => store.set({ front: index }),
      onBackdrop: () => closeHandler.current(),
      onTag: (index) => store.set({ tag: index }),
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [store]);

  useEffect(() => {
    engineRef.current?.setReduced(reduced);
  }, [reduced]);

  useEffect(() => {
    if (open >= 0) closeRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    closeHandler.current = () => closeCard(false);
  });

  const current = VIEWS.find((entry) => entry.id === view) ?? VIEWS[0];
  const shown = shownItem >= 0 ? CARDS[shownItem] : null;
  const isSaved = !!shown && saved.has(shown.id);

  function closeCard(restoreFocus: boolean) {
    if (open < 0) return;
    engineRef.current?.close();
    setOpen(-1);
    setFocusIndex(open);
    setLive(`${CARDS[open].name} closed`);
    if (restoreFocus) {
      restoring.current = true;
      cardRefs.current[open]?.focus({ preventScroll: true });
      restoring.current = false;
    }
  }

  function pickView(next: LayoutId, origin?: Origin | null) {
    if (next === view) return;
    const snapshot = store.get();
    const item = snapshot.hover >= 0 ? snapshot.hover : snapshot.key;
    if (open >= 0) setOpen(-1);
    setView(next);
    engineRef.current?.setLayout(next, item >= 0 ? { item } : origin);
    setLive(`${VIEWS.find((entry) => entry.id === next)?.label ?? next} view`);
  }

  function originOf(tabIndex: number): Origin | null {
    const tab = tabRefs.current[tabIndex]?.getBoundingClientRect();
    const stage = stageRef.current?.getBoundingClientRect();
    if (!tab || !stage) return null;
    return {
      x: tab.left + tab.width / 2 - (stage.left + stage.width / 2),
      y: -stage.height / 2,
    };
  }

  function onTabsKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const from = VIEWS.findIndex((entry) => entry.id === view);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? VIEWS.length - 1
          : (from + (event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : VIEWS.length - 1)) % VIEWS.length;
    tabRefs.current[next]?.focus();
    pickView(VIEWS[next].id, originOf(next));
  }

  function onStageKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open >= 0) {
      event.preventDefault();
      closeCard(true);
      return;
    }
    const target = event.target as HTMLElement;
    if (!target.dataset.card || open >= 0) return;
    const index = Number(target.dataset.index);
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const from = VIEWS.findIndex((entry) => entry.id === view);
      pickView(VIEWS[(from + (event.key === "ArrowRight" ? 1 : VIEWS.length - 1)) % VIEWS.length].id, {
        item: index,
      });
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? TOTAL - 1
            : Math.min(TOTAL - 1, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)));
      cardRefs.current[next]?.focus({ preventScroll: true });
    }
  }

  function openCard(index: number) {
    const engine = engineRef.current;
    if (!engine || engine.takeClick() || open >= 0) return;
    if (view === "carousel" && engine.frontIndex() !== index) {
      engine.toFront(index);
      return;
    }
    setFocusIndex(index);
    engine.open(index);
    setOpen(index);
    setShownItem(index);
    setLive(`${CARDS[index].name} opened`);
  }

  function toggleSaved() {
    if (!shown) return;
    const has = saved.has(shown.id);
    const next = new Set(saved);
    if (has) next.delete(shown.id);
    else next.add(shown.id);
    setSaved(next);
    setLive(
      shown.kind === "maker"
        ? has
          ? `Unfollowed ${shown.name}`
          : `Following ${shown.name}`
        : has
          ? `${shown.name} removed from your bag`
          : `${shown.name} added to your bag`,
    );
  }

  return (
    <section className={styles.root} aria-labelledby={titleId}>
      <header className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          One collection, six ways to browse
        </h2>
        <p className={styles.lede}>
          The Kiln &amp; Loom autumn edit: {PIECE_COUNT} pieces from {MAKER_COUNT} makers. Switch the view and every
          card travels to its new place.
        </p>
      </header>

      <div className={styles.toolbar}>
        <MotionConfig reducedMotion="user">
          <div role="radiogroup" aria-label="Gallery view" className={styles.tabs} onKeyDown={onTabsKeyDown}>
            {VIEWS.map((entry, index) => {
              const checked = entry.id === view;
              const Icon = entry.Icon;
              return (
                <button
                  key={entry.id}
                  ref={(node) => {
                    tabRefs.current[index] = node;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  aria-label={entry.label}
                  tabIndex={checked ? 0 : -1}
                  className={styles.tab}
                  onClick={() => pickView(entry.id, originOf(index))}
                >
                  {checked && (
                    <motion.span
                      layoutId={pillId}
                      className={styles.tabPill}
                      transition={motionTokens.spring.snappy}
                    />
                  )}
                  <Icon aria-hidden="true" className={styles.tabIcon} />
                  <span className={styles.tabLabel} aria-hidden="true">
                    {entry.label}
                  </span>
                </button>
              );
            })}
          </div>
        </MotionConfig>
        <p className={styles.hint}>
          <span className={styles.swap} key={view}>
            {current.hint}
          </span>
        </p>
      </div>

      <div
        ref={stageRef}
        className={styles.stage}
        role="group"
        aria-roledescription="gallery"
        aria-label={`Kiln & Loom autumn edit in ${current.label.toLowerCase()} view: ${TOTAL} cards, ${PIECE_COUNT} pieces and ${MAKER_COUNT} makers. Left and right arrows change the view, up and down move between cards, Enter opens one.`}
        data-layout="grid"
        data-frame-flat={flat ? "" : undefined}
        style={flat ? FLAT : undefined}
        onKeyDown={onStageKeyDown}
      >
        <div ref={worldRef} className={styles.world}>
          {CARDS.map((item, index) => {
            const slot = nextSlot(index);
            return (
              <button
                key={item.id}
                ref={(node) => {
                  cardRefs.current[index] = node;
                }}
                type="button"
                className={styles.card}
                style={
                  {
                    "--pz": `${(TOTAL - slot) * 0.6}px`,
                    "--pr": `${slot === 0 ? 0 : (((7 * index) % 9) - 4) * 1.1}deg`,
                  } as CSSProperties
                }
                data-card="true"
                data-index={index}
                data-kind={item.kind}
                tabIndex={open < 0 && index === focusIndex ? 0 : -1}
                aria-label={
                  item.kind === "maker"
                    ? `${item.name}, ${item.by} in ${item.meta}`
                    : `${item.name} by ${item.by}, ${money(item.stats[0])}`
                }
                aria-hidden={open >= 0 || undefined}
                onClick={() => openCard(index)}
                onPointerEnter={(event: ReactPointerEvent<HTMLButtonElement>) => {
                  if (event.pointerType !== "mouse") return;
                  store.set({ hover: index });
                  engineRef.current?.hover(index);
                }}
                onPointerLeave={() => {
                  if (store.get().hover === index) store.set({ hover: -1 });
                  engineRef.current?.unhover(index);
                }}
                onFocus={(event) => {
                  setFocusIndex(index);
                  const visible = event.currentTarget.matches(":focus-visible");
                  store.set({ key: visible ? index : -1 });
                  engineRef.current?.focusItem(index, visible, !restoring.current);
                }}
                onBlur={() => {
                  if (store.get().key === index) store.set({ key: -1 });
                  engineRef.current?.blurItem(index);
                }}
              >
                <CardBody item={item} />
              </button>
            );
          })}
        </div>

        <div ref={tagRef} className={styles.tag} aria-hidden="true">
          <HoverTag store={store} />
        </div>

        <div
          className={styles.overlay}
          data-show={open >= 0}
          data-variant={shown?.kind === "photo" ? "hero" : "profile"}
          role="dialog"
          aria-labelledby={dialogId}
          aria-hidden={open < 0}
          inert={open < 0}
        >
          {shown && (
            <>
              <h3 id={dialogId} className={styles.srOnly}>
                {shown.name}
              </h3>
              <p className={styles.srOnly}>
                {`${captionOf(shown)}. ${shown.desc} ${shown.facts.map(([key, value]) => `${key}: ${value}`).join(", ")}.`}
              </p>
              <button
                ref={closeRef}
                type="button"
                className={styles.close}
                aria-label={`Close ${shown.name}`}
                onClick={() => closeCard(true)}
              >
                <X aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.action}
                data-done={isSaved}
                aria-pressed={isSaved}
                onClick={toggleSaved}
              >
                <span className={styles.actionInner} key={String(isSaved)}>
                  {isSaved ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                  {shown.kind === "maker"
                    ? isSaved
                      ? "Following"
                      : "Follow"
                    : isSaved
                      ? "Added to bag"
                      : "Add to bag"}
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      <StatPanel store={store} open={open} flat={flat} />

      <div className={styles.srOnly}>
        <table>
          <caption>Kiln &amp; Loom autumn edit</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Type</th>
              <th scope="col">Maker or craft</th>
              <th scope="col">Price or pieces</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {CARDS.map((item) => (
              <tr key={item.id}>
                <th scope="row">{item.name}</th>
                <td>{item.kind === "maker" ? "Maker" : "Piece"}</td>
                <td>{item.kind === "maker" ? `${item.by}, ${item.meta}` : item.by}</td>
                <td>{valueOf(item)}</td>
                <td>{item.facts.map(([key, value]) => `${key}: ${value}`).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.srOnly} aria-live="polite">
        {live}
      </p>
    </section>
  );
}

export default LayoutMorph;
