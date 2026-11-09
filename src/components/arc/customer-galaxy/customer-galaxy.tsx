"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  AnimatePresence,
  LayoutGroup,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { ArrowLeft, Maximize2, Minus, Plus } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./customer-galaxy.module.css";

const PLANS = ["Starter", "Growth", "Scale", "Enterprise"] as const;
const REGIONS = ["North America", "Europe", "Asia Pacific", "Latin America"] as const;
const INDUSTRIES = ["Software", "Fintech", "Healthcare", "Retail", "Media", "Logistics"] as const;
const HEALTHS = ["Healthy", "Expanding", "Watch", "At risk"] as const;
const HEALTH_ORDER = [1, 0, 2, 3];
const TONES = ["neutral", "success", "warning", "danger"] as const;

/** The five ways the accounts can be grouped. `all` keeps one cluster. */
type GroupKey = "all" | "plan" | "region" | "health" | "industry";

interface Tab {
  key: GroupKey;
  label: string;
  noun: string;
}

const TABS: Tab[] = [
  { key: "all", label: "All", noun: "health" },
  { key: "plan", label: "Plan", noun: "plan" },
  { key: "region", label: "Region", noun: "region" },
  { key: "health", label: "Health", noun: "health" },
  { key: "industry", label: "Industry", noun: "industry" },
];

/** One account in the galaxy. Price, health, owner and the note are all sample data. */
interface Account {
  id: number;
  name: string;
  plan: number;
  region: number;
  industry: number;
  health: number;
  mrr: number;
  owner: string;
  note: string;
}

/** One cluster: an aggregate of the accounts that share the grouped value. */
interface ClusterStat {
  index: number;
  label: string;
  count: number;
  mrr: number;
  healthMrr: number[];
  healthCount: number[];
}

const random = (() => {
  let seed = 0x135283a;
  return () => {
    let t = (seed = (seed + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
})();

const pick = <T,>(list: readonly T[]): T => list[Math.floor(random() * list.length) % list.length];

const weighted = (weights: number[]): number => {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let target = random() * total;
  for (let index = 0; index < weights.length; index++) {
    target -= weights[index];
    if (target <= 0) return index;
  }
  return weights.length - 1;
};

const gaussian = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());

const PREFIXES = [
  "North",
  "Blue",
  "Iron",
  "Clear",
  "Bright",
  "Silver",
  "Harbor",
  "Summit",
  "Pine",
  "Cedar",
  "Atlas",
  "Nova",
  "Lumen",
  "Vector",
  "Kite",
  "Orbit",
  "Quill",
  "Ember",
  "Tidal",
  "Maple",
  "Echo",
  "Juniper",
  "Beacon",
  "Granite",
  "Copper",
  "Aster",
  "Birch",
  "Coral",
  "Delta",
  "Falcon",
  "Glacier",
  "Halo",
  "Indigo",
  "Lark",
  "Meadow",
  "Onyx",
  "Pioneer",
  "Ridge",
  "Sable",
  "Willow",
];

const SUFFIXES = [
  "field",
  "stone",
  "works",
  "wind",
  "point",
  "line",
  "gate",
  "path",
  "bridge",
  "craft",
  "forge",
  "light",
  "well",
  "bay",
  "peak",
  "lane",
];

const INDUSTRY_WORDS = [
  ["Labs", "Systems", "Cloud", "Software", "Data"],
  ["Pay", "Capital", "Ledger", "Finance", "Bank"],
  ["Health", "Clinics", "Care", "Bio", "Medical"],
  ["Goods", "Market", "Supply", "Outfitters", "Home"],
  ["Media", "Studios", "Press", "Sound", "Games"],
  ["Freight", "Logistics", "Fleet", "Transit", "Cargo"],
];

const OWNERS = [
  ["Emma Collins", "Jonas Weber", "Ava Thompson"],
  ["Daniel Kim", "Elin Lund", "Noah Becker"],
  ["Kenji Sato", "Priya Raman"],
  ["Sofia Alvarez", "Mateo Rojas"],
];

/** Median MRR, sigma, floor, ceiling and the rounding step of each plan. */
const PLAN_SHAPE = [
  [140, 0.55, 49, 480, 1],
  [1300, 0.45, 600, 3200, 10],
  [6200, 0.4, 3500, 14000, 50],
  [33000, 0.45, 16000, 92000, 100],
];

const PLAN_COUNTS = [1320, 700, 300, 80];
const MONTHS = ["June", "July", "August"];

const NOTES: ((next: () => number) => string)[][] = [
  [
    () => "Usage steady",
    (next) => `Renewed in ${MONTHS[Math.floor(3 * next())]}`,
    (next) => `${62 + Math.floor(30 * next())}% weekly active`,
  ],
  [
    (next) => `Seats up ${12 + Math.floor(30 * next())}% this quarter`,
    (next) => `Added ${2 + Math.floor(6 * next())} workspaces`,
    () => "Upgrade call booked",
    (next) => `Usage up ${9 + Math.floor(24 * next())}% month over month`,
  ],
  [
    (next) => `Champion left in ${MONTHS[Math.floor(3 * next())]}`,
    (next) => `Usage down ${8 + Math.floor(14 * next())}%`,
    (next) => `Support tickets up ${20 + Math.floor(40 * next())}%`,
    (next) => `Renewal in ${30 + Math.floor(50 * next())} days`,
  ],
  [
    (next) => `Usage down ${28 + Math.floor(30 * next())}%`,
    (next) => `Renewal in ${9 + Math.floor(30 * next())} days, no reply`,
    (next) => `${2 + Math.floor(4 * next())} open escalations`,
    () => "Evaluating alternatives",
  ],
];

const ACCOUNTS: Account[] = (() => {
  const taken = new Set<string>();
  const accounts: Account[] = [];
  PLAN_COUNTS.forEach((count, plan) => {
    const [median, sigma, floor, ceiling, step] = PLAN_SHAPE[plan];
    for (let slot = 0; slot < count; slot++) {
      const region = weighted([44, 31, 17, 8]);
      const industry = weighted([29, 16, 15, 15, 11, 14]);
      const healthWeights = [72, 10, 10, 8];
      if (plan === 3) {
        healthWeights[1] += 7;
        healthWeights[3] -= 4;
      }
      if (plan === 0) {
        healthWeights[3] += 3;
        healthWeights[1] -= 4;
      }
      if (industry === 3) {
        healthWeights[3] += 8;
        healthWeights[2] += 4;
      }
      if (industry === 1) healthWeights[1] += 5;
      if (industry === 4) healthWeights[2] += 4;
      if (region === 3) healthWeights[2] += 6;
      const health = weighted(healthWeights);
      const mrr =
        Math.round(
          Math.min(ceiling, Math.max(floor, Math.exp(Math.log(median) + sigma * gaussian()))) / step,
        ) * step;
      let name = "";
      for (let attempt = 0; attempt < 12 && (!name || taken.has(name)); attempt++) {
        const prefix = random() < 0.3 ? pick(PREFIXES) : `${pick(PREFIXES)}${pick(SUFFIXES)}`;
        name = `${prefix} ${pick(INDUSTRY_WORDS[industry])}`;
      }
      if (taken.has(name)) name = `${name} Group`;
      taken.add(name);
      const owner = plan === 0 ? "Digital success" : pick(OWNERS[region]);
      accounts.push({
        id: accounts.length,
        name,
        plan,
        region,
        industry,
        health,
        mrr,
        owner,
        note: pick(NOTES[health])(random),
      });
    }
  });
  return accounts;
})();

/** The labels of one grouping, in cluster order. */
function groupLabels(key: GroupKey): string[] {
  if (key === "plan") return [...PLANS];
  if (key === "region") return [...REGIONS];
  if (key === "industry") return [...INDUSTRIES];
  if (key === "health") return HEALTH_ORDER.map((health) => HEALTHS[health]);
  return ["All accounts"];
}

/** The cluster index an account belongs to under one grouping. */
function groupIndex(key: GroupKey, account: Account): number {
  if (key === "plan") return account.plan;
  if (key === "region") return account.region;
  if (key === "industry") return account.industry;
  if (key === "health") return HEALTH_ORDER.indexOf(account.health);
  return 0;
}

const clusterCache = new Map<GroupKey, ClusterStat[]>();

/** Aggregates are memoised: the panel and the engine ask for the same numbers on every render. */
function clustersFor(key: GroupKey): ClusterStat[] {
  const cached = clusterCache.get(key);
  if (cached) return cached;
  const stats: ClusterStat[] = groupLabels(key).map((label, index) => ({
    index,
    label,
    count: 0,
    mrr: 0,
    healthMrr: [0, 0, 0, 0],
    healthCount: [0, 0, 0, 0],
  }));
  for (const account of ACCOUNTS) {
    const stat = stats[groupIndex(key, account)];
    stat.count += 1;
    stat.mrr += account.mrr;
    stat.healthMrr[account.health] += account.mrr;
    stat.healthCount[account.health] += 1;
  }
  clusterCache.set(key, stats);
  return stats;
}

const ALL = clustersFor("all")[0];
const NUMBER = new Intl.NumberFormat("en-US");
const currency = (value: number) => `$${NUMBER.format(value)}`;

/** Compact money: $6.05M, $870K, $6.1K, $49. */
function money(value: number): string {
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e4) return `$${Math.round(value / 1e3)}K`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${Math.round(value)}`;
}

const shareAtRisk = (atRisk: number, total: number) => (total ? Math.round((atRisk / total) * 100) : 0);

const COUNT = ACCOUNTS.length;
const STEP = 1 / 120;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const ALPHA = [0.72, 0.95, 0.95, 0.95];
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const rubber = (delta: number, limit: number) => (1 - 1 / ((0.55 * delta) / limit + 1)) * limit;
const band = (value: number, low: number, high: number, limit: number) =>
  value < low ? low - rubber(low - value, limit) : value > high ? high + rubber(value - high, limit) : value;
const hash = (seed: number) => {
  let t = Math.imul(0x9e3779b9 ^ seed, 0x85ebca6b);
  t ^= t >>> 13;
  return ((Math.imul(t, 0xc2b2ae35) ^ (t >>> 16)) >>> 0) / 0x100000000;
};

interface Projected {
  x: number;
  y: number;
  f: number;
}

interface Cluster {
  x: number;
  y: number;
  r: number;
}

interface Camera {
  x: number;
  y: number;
  lz: number;
  vx: number;
  vy: number;
  vz: number;
  tx: number;
  ty: number;
  tz: number;
  omega: number;
}

interface DragState {
  id: number;
  sx: number;
  sy: number;
  lx: number;
  ly: number;
  lt: number;
  moved: boolean;
  rawX: number;
  rawY: number;
  vx: number;
  vy: number;
  type: string;
}

interface PinchState {
  d0: number;
  z0: number;
  wx: number;
  wy: number;
}

interface PointerSample {
  x: number;
  y: number;
  type: string;
}

interface EngineEvents {
  hover: (id: number) => void;
  select: (id: number) => void;
  settle: (settled: boolean) => void;
  focus: (index: number) => void;
  view: (zoomed: boolean) => void;
  interact: () => void;
}

interface Highlight {
  group: GroupKey;
  cat: number;
}

/** The canvas engine: layout, camera, simulation and painting. It owns no React state. */
class Galaxy {
  private canvas: HTMLCanvasElement;
  private events: EngineEvents;
  private ctx: CanvasRenderingContext2D | null;
  private w = 0;
  private h = 0;
  private dpr = 1;

  private base = new Float32Array(COUNT);
  private rad = new Float32Array(COUNT);
  private invMass = new Float32Array(COUNT);
  private px = new Float32Array(COUNT);
  private py = new Float32Array(COUNT);
  private vx = new Float32Array(COUNT);
  private vy = new Float32Array(COUNT);
  private tx = new Float32Array(COUNT);
  private ty = new Float32Array(COUNT);
  private delay = new Float32Array(COUNT);
  private lift = new Float32Array(COUNT);
  private alpha = new Float32Array(COUNT).fill(1);
  private alphaT = new Float32Array(COUNT).fill(1);
  private cat = new Uint8Array(COUNT);
  private health = new Uint8Array(COUNT);
  private sx = new Float32Array(COUNT);
  private sy = new Float32Array(COUNT);
  private sr = new Float32Array(COUNT);
  private visibleDot = new Uint8Array(COUNT);
  private bucketOf = new Uint8Array(COUNT);
  private drawOrder = new Int32Array(COUNT);
  private stamp = new Int32Array(COUNT);
  private cellCount = new Int32Array(1);
  private cellItems = new Int32Array(1);
  private cellFill = new Int32Array(1);

  private group: GroupKey = "all";
  private clusters: Cluster[] = [];
  private bounds = { x0: -1, y0: -1, x1: 1, y1: 1 };
  private fitZ = 1;
  private simT = 99;
  private simActive = false;
  private swirl = 1;
  private settled = true;
  private intro = false;

  private cam: Camera = { x: 0, y: 0, lz: 0, vx: 0, vy: 0, vz: 0, tx: 0, ty: 0, tz: 0, omega: 9 };
  private anchor: { wx: number; wy: number; sx: number; sy: number } | null = null;
  private tilt = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
  private plane = { a: 0, v: 0, t: 0 };
  private drift = 1;
  private lens = 0;
  private zoomed = false;
  private focusCluster = -1;
  private pointers = new Map<number, PointerSample>();
  private drag: DragState | null = null;
  private pinch: PinchState | null = null;
  private mouse = { x: 0, y: 0, inside: false, fine: true };
  private lastTap = { t: -1, x: 0, y: 0 };
  private hovered = -1;
  private selected = -1;
  private keyboard = false;

  private cardEl: HTMLDivElement | null = null;
  private card = { x: 0, y: 0, vx: 0, vy: 0, w: 240, h: 150, shown: false };
  private labelEls: (HTMLDivElement | null)[] = [];
  private labelPoint: Projected = { x: 0, y: 0, f: 1 };

  private raf = 0;
  private last = 0;
  private acc = 0;
  private busy = true;
  private counts = new Int32Array(33);
  private fillAt = new Int32Array(33);
  private visible = false;
  private hidden = false;
  private introPending = true;
  private reduced = false;
  private palette = { dots: ["#8a8a8a", "#1f8a4c", "#b7791f", "#c53030"], ring: "#111", accent: "#333" };
  private indices: Int32Array | null = null;
  private relayoutTimer = 0;

  constructor(canvas: HTMLCanvasElement, events: EngineEvents) {
    this.canvas = canvas;
    this.events = events;
    this.ctx = canvas.getContext("2d");
    let biggest = 0;
    ACCOUNTS.forEach((account, index) => {
      this.base[index] = 10 + Math.sqrt(account.mrr);
      this.health[index] = account.health;
      biggest = Math.max(biggest, this.base[index]);
    });
    for (let index = 0; index < COUNT; index++) this.invMass[index] = 1 / (1 + (0.9 * this.base[index]) / biggest);
  }

  private frame = (time: number) => {
    this.raf = 0;
    const elapsed = Math.min(0.05, Math.max(0, (time - this.last) / 1000));
    this.last = time;
    this.acc += elapsed;
    let steps = 0;
    while (this.acc >= STEP && steps < 8) {
      this.step(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps === 8) this.acc = 0;
    this.reportView();
    this.render();
    if (this.active() && this.visible && !this.hidden) this.raf = requestAnimationFrame(this.frame);
  };

  setReduced(reduced: boolean) {
    this.reduced = reduced;
    if (reduced) {
      this.introPending = false;
      this.snapAll();
    }
    this.wake();
  }

  setPalette(palette: Galaxy["palette"]) {
    this.palette = palette;
    this.wake();
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.maybeIntro();
    this.wake();
  }

  setHidden(hidden: boolean) {
    this.hidden = hidden;
    this.wake();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    clearTimeout(this.relayoutTimer);
  }

  resize(width: number, height: number, dpr: number) {
    if (width < 10 || height < 10 || (width === this.w && height === this.h && dpr === this.dpr)) return;
    const first = this.w === 0;
    this.w = width;
    this.h = height;
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    if (first) {
      this.layout(true);
      this.snapAll();
      this.cam.x = this.cam.tx;
      this.cam.y = this.cam.ty;
      this.cam.lz = this.cam.tz;
      this.maybeIntro();
    } else {
      this.refit(true);
      clearTimeout(this.relayoutTimer);
      this.relayoutTimer = window.setTimeout(() => {
        this.layout(false);
        this.start("resize");
        this.refit(false);
        this.wake();
      }, 160);
    }
    this.render();
    this.wake();
  }

  attachCard(element: HTMLDivElement | null) {
    this.cardEl = element;
    if (element) {
      this.card.w = element.offsetWidth;
      this.card.h = element.offsetHeight;
    }
  }

  measureCard() {
    if (this.cardEl) {
      this.card.w = this.cardEl.offsetWidth;
      this.card.h = this.cardEl.offsetHeight;
    }
    this.wake();
  }

  attachLabel(index: number, element: HTMLDivElement | null) {
    this.labelEls[index] = element;
    if (element) this.placeLabel(index, element);
  }

  setGroup(key: GroupKey, target = -1) {
    if (key === this.group) {
      if (target >= 0) this.focus(target);
      return;
    }
    this.group = key;
    this.layout(false);
    this.start("group");
    this.setFocus(target, false);
    if (target < 0) this.fitCamera(5.2 * (this.reduced ? 0 : 1));
    this.wake();
  }

  setHighlight(highlight: Highlight | null) {
    for (let index = 0; index < COUNT; index++) {
      this.alphaT[index] = highlight && groupIndex(highlight.group, ACCOUNTS[index]) !== highlight.cat ? 0.13 : 1;
    }
    if (this.reduced) this.alpha.set(this.alphaT);
    this.wake();
  }

  focus(index: number) {
    this.setFocus(index, true);
    this.wake();
  }

  resetView() {
    this.setFocus(-1, true);
    this.wake();
  }

  zoomBy(factor: number) {
    this.zoomAt(this.w / 2, this.h / 2, factor);
    this.events.interact();
  }

  select(index: number, keyboard: boolean) {
    this.selected = index;
    this.keyboard = keyboard;
    if (index >= 0 && keyboard) {
      const scale = Math.exp(this.cam.tz);
      const halfW = this.w / 2 / scale;
      const halfH = this.h / 2 / scale;
      const x = this.px[index];
      const y = this.py[index];
      if (Math.abs(x - this.cam.tx) > 0.8 * halfW || Math.abs(y - this.cam.ty) > 0.8 * halfH) {
        this.anchor = null;
        this.cam.tx = x;
        this.cam.ty = y;
        this.cam.omega = 7;
      }
    }
    this.wake();
  }

  private radii() {
    let area = 0;
    for (let index = 0; index < COUNT; index++) area += this.base[index] * this.base[index];
    const scale = Math.sqrt((0.26 * this.w * this.h * 0.8) / (Math.PI * area));
    for (let index = 0; index < COUNT; index++) this.rad[index] = Math.max(1.15, this.base[index] * scale);
  }

  private layout(snap: boolean) {
    this.radii();
    const count = groupLabels(this.group).length;
    const members: number[][] = Array.from({ length: count }, () => []);
    for (let index = 0; index < COUNT; index++) {
      const cat = groupIndex(this.group, ACCOUNTS[index]);
      this.cat[index] = cat;
      members[cat].push(index);
    }
    const offsetX = new Float32Array(COUNT);
    const offsetY = new Float32Array(COUNT);
    const reach: number[] = [];
    const single = count === 1;
    this.plane.t = 0.82 * (single ? 1 : 0);
    if (snap || this.reduced) {
      this.plane.a = this.plane.t;
      this.plane.v = 0;
    }
    members.forEach((order, cat) => {
      order.sort((left, right) => this.rad[right] - this.rad[left] || left - right);
      if (single) this.spiral(order, offsetX, offsetY);
      else {
        let area = 0;
        order.forEach((index, slot) => {
          const size = (this.rad[index] + 1.1) ** 2;
          const radius = slot === 0 ? 0 : Math.sqrt((area + 0.5 * size) / 0.8) * (1 + (hash(index) - 0.5) * 0.08);
          const angle = slot * GOLDEN + 1.7 * cat + (hash(3 * index + 1) - 0.5) * 0.3;
          offsetX[index] = Math.cos(angle) * radius;
          offsetY[index] = Math.sin(angle) * radius;
          area += size;
        });
      }
      for (let pass = 0; pass < 36; pass++) {
        this.collide(order, offsetX, offsetY, 1, null);
        const shrink = 0.006 * (pass < 30 && !single ? 1 : 0);
        for (const index of order) {
          offsetX[index] *= 1 - shrink;
          offsetY[index] *= 1 - shrink;
        }
      }
      const spans = order
        .map((index) => Math.hypot(offsetX[index], offsetY[index]) + this.rad[index])
        .sort((left, right) => left - right);
      reach[cat] = spans[Math.min(spans.length - 1, Math.floor(spans.length * (single ? 0.985 : 1)))];
    });
    const narrow = this.w < 520;
    let inflation = 1;
    let placed: { x: number; y: number }[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const gap = count > 1 ? 48 * inflation : 0;
      placed = this.pack(reach, gap, count > 1 ? (narrow ? 34 : 64) * inflation : 0);
      this.boundsFor(placed, reach, gap, (narrow ? 50 : 34) * inflation);
      this.clusters = placed.map((cluster, index) => ({ x: cluster.x, y: cluster.y, r: reach[index] }));
      this.fitZ = this.fitFor();
      if (this.fitZ >= 0.98) break;
      inflation = 1 / this.fitZ;
    }
    for (let index = 0; index < COUNT; index++) {
      const cluster = placed[this.cat[index]];
      this.tx[index] = cluster.x + offsetX[index];
      this.ty[index] = cluster.y + offsetY[index];
    }
    if (snap) {
      this.cam.tx = (this.bounds.x0 + this.bounds.x1) / 2;
      this.cam.ty = (this.bounds.y0 + this.bounds.y1) / 2;
      this.cam.tz = Math.log(this.fitZ);
    }
  }

  private spiral(order: number[], outX: Float32Array, outY: Float32Array) {
    const total = order.length;
    const core = Math.round(0.12 * total);
    let area = 0;
    for (let slot = 0; slot < core; slot++) area += (this.rad[order[slot]] + 1.1) ** 2;
    const coreRadius = Math.sqrt(area / 0.8);
    const haloRadius = 2.55 * coreRadius;
    area = 0;
    order.forEach((index, slot) => {
      if (slot < core) {
        const size = (this.rad[index] + 1.1) ** 2;
        const radius = slot === 0 ? 0 : Math.sqrt((area + 0.5 * size) / 0.8);
        outX[index] = Math.cos(slot * GOLDEN) * radius;
        outY[index] = Math.sin(slot * GOLDEN) * radius;
        area += size;
        return;
      }
      const radial = Math.sqrt(-2 * Math.log(Math.max(1e-6, hash(11 * index + 3))));
      const angle = 2 * Math.PI * hash(13 * index + 5);
      const distance =
        (0.88 * coreRadius +
          (haloRadius - 0.88 * coreRadius) *
            Math.pow(clamp(((slot - core) / (total - core)) * 0.5 + 0.5 * hash(17 * index + 7), 0, 1), 1.15)) *
        (1 + radial * Math.sin(angle) * 0.05);
      const base = hash(7 * index + 2) < 0.5 ? 0 : Math.PI;
      const theta =
        hash(5 * index + 9) < 0.08
          ? hash(19 * index) * Math.PI * 2
          : base - 2.9 * Math.log(distance / coreRadius) + radial * Math.cos(angle) * ((0.12 * haloRadius) / distance + 0.05);
      outX[index] = Math.cos(theta) * distance;
      outY[index] = Math.sin(theta) * distance;
    });
  }

  private pack(reach: number[], gap: number, clusterGap: number) {
    const aspect = clamp(this.w / this.h, 0.55, 2.4);
    const order = reach.map((_, index) => index).sort((left, right) => reach[right] - reach[left] || left - right);
    const placed: { x: number; y: number; r: number }[] = [];
    const out = reach.map(() => ({ x: 0, y: 0 }));
    for (const index of order) {
      const radius = Math.max(reach[index], clusterGap);
      let best = { x: 0, y: 0 };
      let cost = Infinity;
      if (placed.length) {
        for (const anchor of placed) {
          for (let slot = 0; slot < 72; slot++) {
            const angle = (slot / 72) * Math.PI * 2 + 0.13;
            const x = anchor.x + Math.cos(angle) * (anchor.r + radius + gap);
            const y = anchor.y + Math.sin(angle) * (anchor.r + radius + gap);
            const blocked = placed.some(
              (other) => Math.hypot(x - other.x, y - other.y) < other.r + radius + gap - 0.01,
            );
            if (blocked) continue;
            const score = (x / aspect) ** 2 + (1.08 * y) ** 2;
            if (score < cost) {
              cost = score;
              best = { x, y };
            }
          }
        }
      }
      out[index] = best;
      placed.push({ ...best, r: radius });
    }
    return out;
  }

  private boundsFor(placed: { x: number; y: number }[], reach: number[], gap: number, extra: number) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    placed.forEach((cluster, index) => {
      x0 = Math.min(x0, cluster.x - reach[index]);
      x1 = Math.max(x1, cluster.x + reach[index]);
      y0 = Math.min(y0, cluster.y - reach[index] - gap);
      y1 = Math.max(y1, cluster.y + reach[index]);
    });
    y1 += extra;
    const centerX = (x0 + x1) / 2;
    const centerY = (y0 + y1) / 2;
    placed.forEach((cluster) => {
      cluster.x -= centerX;
      cluster.y -= centerY;
    });
    this.bounds = { x0: x0 - centerX, y0: y0 - centerY, x1: x1 - centerX, y1: y1 - centerY };
  }

  private fitFor() {
    const pad = this.w < 520 ? 14 : 28;
    const bounds = this.bounds;
    const tilt = this.plane.t;
    if (tilt < 0.01) {
      return Math.min(
        1.35,
        (this.w - 2 * pad) / (bounds.x1 - bounds.x0),
        (this.h - 2 * pad) / (bounds.y1 - bounds.y0),
      );
    }
    const cosTilt = Math.cos(tilt);
    const sinTilt = Math.sin(tilt);
    const halfW = this.w / 2 - pad;
    const halfH = this.h / 2 - pad;
    const fits = (scale: number) =>
      this.clusters.every((cluster) => {
        for (let slot = 0; slot < 24; slot++) {
          const angle = (slot / 24) * Math.PI * 2;
          const x = (cluster.x + Math.cos(angle) * cluster.r) * scale;
          const y = (cluster.y + Math.sin(angle) * cluster.r) * scale;
          const perspective = 1150 / Math.max(60, 1150 - y * sinTilt);
          if (Math.abs(x * perspective) > halfW || Math.abs(y * cosTilt * perspective) > halfH) return false;
        }
        return bounds.y1 * scale * cosTilt < halfH;
      });
    let low = 0.02;
    let high = 1.35;
    if (fits(1.35)) return high;
    for (let step = 0; step < 22; step++) {
      const middle = (low + high) / 2;
      if (fits(middle)) low = middle;
      else high = middle;
    }
    return low;
  }

  private refit(snap: boolean) {
    this.fitZ = this.fitFor();
    if (this.zoomed && !snap) return;
    if (!this.zoomed) {
      this.cam.tx = 0;
      this.cam.ty = 0;
      this.cam.tz = Math.log(this.fitZ);
    }
    if (snap && !this.zoomed) {
      this.cam.x = 0;
      this.cam.y = 0;
      this.cam.lz = this.cam.tz;
      this.cam.vx = this.cam.vy = this.cam.vz = 0;
    }
  }

  private collide(order: ArrayLike<number>, xs: Float32Array, ys: Float32Array, strength: number, lift: Float32Array | null) {
    const total = order.length;
    if (total < 2) return;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    let radiiSum = 0;
    for (let slot = 0; slot < total; slot++) {
      const index = order[slot];
      const radius = this.rad[index];
      x0 = Math.min(x0, xs[index] - radius);
      y0 = Math.min(y0, ys[index] - radius);
      x1 = Math.max(x1, xs[index] + radius);
      y1 = Math.max(y1, ys[index] + radius);
      radiiSum += radius;
    }
    let cell = Math.max(3, (radiiSum / total) * 2.4 + 1.1);
    let cols = Math.ceil((x1 - x0) / cell) + 1;
    let rows = Math.ceil((y1 - y0) / cell) + 1;
    while (cols * rows > 6e4) {
      cell *= 1.5;
      cols = Math.ceil((x1 - x0) / cell) + 1;
      rows = Math.ceil((y1 - y0) / cell) + 1;
    }
    const cells = cols * rows;
    if (this.cellCount.length < cells + 1) this.cellCount = new Int32Array(cells + 1);
    const counts = this.cellCount;
    counts.fill(0, 0, cells + 1);
    let entries = 0;
    for (let slot = 0; slot < total; slot++) {
      const index = order[slot];
      const radius = this.rad[index] + 0.55;
      const left = Math.floor((xs[index] - radius - x0) / cell);
      const right = Math.floor((xs[index] + radius - x0) / cell);
      const top = Math.floor((ys[index] - radius - y0) / cell);
      const bottom = Math.floor((ys[index] + radius - y0) / cell);
      for (let row = top; row <= bottom; row++) {
        for (let col = left; col <= right; col++) {
          counts[row * cols + col + 1]++;
          entries++;
        }
      }
    }
    for (let index = 1; index <= cells; index++) counts[index] += counts[index - 1];
    if (this.cellItems.length < entries) this.cellItems = new Int32Array(1.5 * entries);
    const items = this.cellItems;
    if (this.cellFill.length < cells) this.cellFill = new Int32Array(cells);
    const fill = this.cellFill;
    fill.fill(0, 0, cells);
    for (let slot = 0; slot < total; slot++) {
      const index = order[slot];
      const radius = this.rad[index] + 0.55;
      const left = Math.floor((xs[index] - radius - x0) / cell);
      const right = Math.floor((xs[index] + radius - x0) / cell);
      const top = Math.floor((ys[index] - radius - y0) / cell);
      const bottom = Math.floor((ys[index] + radius - y0) / cell);
      for (let row = top; row <= bottom; row++) {
        for (let col = left; col <= right; col++) {
          const bucket = row * cols + col;
          items[counts[bucket] + fill[bucket]++] = index;
        }
      }
    }
    const stamp = this.stamp;
    stamp.fill(-1);
    for (let slot = 0; slot < total; slot++) {
      const index = order[slot];
      const radius = this.rad[index];
      const padded = radius + 0.55;
      const left = Math.floor((xs[index] - padded - x0) / cell);
      const right = Math.floor((xs[index] + padded - x0) / cell);
      const top = Math.floor((ys[index] - padded - y0) / cell);
      const bottom = Math.floor((ys[index] + padded - y0) / cell);
      const gain = lift ? 1 - lift[index] : 1;
      for (let row = Math.max(0, top); row <= Math.min(rows - 1, bottom); row++) {
        for (let col = Math.max(0, left); col <= Math.min(cols - 1, right); col++) {
          const bucket = row * cols + col;
          for (let entry = counts[bucket], end = counts[bucket + 1]; entry < end; entry++) {
            const other = items[entry];
            if (other <= index || stamp[other] === index) continue;
            stamp[other] = index;
            const limit = radius + this.rad[other] + 1.1;
            let dx = xs[other] - xs[index];
            let dy = ys[other] - ys[index];
            let distance = dx * dx + dy * dy;
            if (distance >= limit * limit) continue;
            let length = Math.sqrt(distance);
            if (length < 1e-4) {
              dx = hash(index + other) - 0.5;
              dy = hash(7 * index + other) - 0.5;
              length = Math.hypot(dx, dy);
            }
            const push = ((limit - length) / length) * strength * (gain * (lift ? 1 - lift[other] : 1));
            const massA = 1 / this.invMass[index];
            const massB = 1 / this.invMass[other];
            const share = massB / (massA + massB);
            xs[index] -= dx * push * share;
            ys[index] -= dy * push * share;
            xs[other] += dx * push * (1 - share);
            ys[other] += dy * push * (1 - share);
          }
        }
      }
    }
  }

  private snapAll() {
    this.px.set(this.tx);
    this.py.set(this.ty);
    this.vx.fill(0);
    this.vy.fill(0);
    this.lift.fill(0);
    this.alpha.set(this.alphaT);
    this.simActive = false;
    this.intro = false;
    if (!this.settled) {
      this.settled = true;
      this.events.settle(true);
    }
  }

  private start(kind: "intro" | "group" | "resize") {
    if (this.reduced) {
      this.snapAll();
      return;
    }
    this.simT = 0;
    this.simActive = true;
    this.swirl = kind === "resize" ? 0 : kind === "intro" ? 1.15 : 1;
    this.intro = kind === "intro";
    for (let index = 0; index < COUNT; index++) {
      const cluster = this.clusters[this.cat[index]];
      const distance = Math.hypot(this.tx[index] - cluster.x, this.ty[index] - cluster.y) / Math.max(1, cluster.r);
      this.delay[index] =
        kind === "resize" ? 0 : (kind === "intro" ? 0.5 : 0.26) * distance + 0.06 * hash(index);
    }
    if (kind !== "resize" && this.settled) {
      this.settled = false;
      this.events.settle(false);
    }
  }

  private maybeIntro() {
    if (!this.introPending || !this.visible || this.w === 0 || this.reduced) return;
    this.introPending = false;
    for (let index = 0; index < COUNT; index++) {
      const cluster = this.clusters[this.cat[index]];
      const dx = this.tx[index] - cluster.x;
      const dy = this.ty[index] - cluster.y;
      const distance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx) - 1.35 - 0.5 * hash(index);
      const radius = 1.5 * distance + cluster.r * (0.45 + 0.5 * hash(3 * index));
      this.px[index] = cluster.x + Math.cos(angle) * radius;
      this.py[index] = cluster.y + Math.sin(angle) * radius;
      this.vx[index] = 0;
      this.vy[index] = 0;
      this.alpha[index] = 0;
    }
    this.start("intro");
    this.cam.lz = this.cam.tz - 0.22;
    this.cam.vz = 0;
    this.cam.omega = 3.6;
    this.plane.a = this.plane.t + 0.42;
    this.plane.v = 0;
  }

  private simStep(dt: number) {
    this.simT += dt;
    const time = this.simT;
    const swirl = Math.exp(-(3.8 * time)) * this.swirl;
    let moving = 0;
    for (let index = 0; index < COUNT; index++) {
      if (time < this.delay[index]) {
        this.vx[index] *= 0.96;
        this.vy[index] *= 0.96;
        this.px[index] += this.vx[index] * dt;
        this.py[index] += this.vy[index] * dt;
        continue;
      }
      const stiffness = 42 * this.invMass[index];
      const damping = 2 * Math.sqrt(stiffness) * 0.74;
      const dx = this.tx[index] - this.px[index];
      const dy = this.ty[index] - this.py[index];
      const spin = 0.85 * swirl * stiffness;
      this.vx[index] += (stiffness * dx - spin * dy - damping * this.vx[index]) * dt;
      this.vy[index] += (stiffness * dy + spin * dx - damping * this.vy[index]) * dt;
      this.px[index] += this.vx[index] * dt;
      this.py[index] += this.vy[index] * dt;
      const speed = Math.hypot(this.vx[index], this.vy[index]);
      this.lift[index] += (Math.min(1, speed / 900) - this.lift[index]) * 0.1;
      if (speed > 1.5 || dx * dx + dy * dy > 0.09) moving++;
    }
    if (time > 0.12 && time < 1.2 + 0.6 && this.swirl > 0) {
      this.collide(this.allIndices(), this.px, this.py, 0.35, this.lift);
    }
    if (!this.settled && time > 0.95) {
      this.settled = true;
      this.events.settle(true);
    }
    if ((time > 1.2 && moving === 0) || time > 3.2) {
      this.simActive = false;
      this.intro = false;
      this.px.set(this.tx);
      this.py.set(this.ty);
      this.vx.fill(0);
      this.vy.fill(0);
      this.lift.fill(0);
    }
  }

  private allIndices() {
    if (!this.indices) {
      this.indices = new Int32Array(COUNT);
      for (let index = 0; index < COUNT; index++) this.indices[index] = index;
    }
    return this.indices;
  }

  private rotate(angle: number) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let index = 0; index < COUNT; index++) {
      const cluster = this.clusters[this.cat[index]];
      let dx = this.px[index] - cluster.x;
      let dy = this.py[index] - cluster.y;
      this.px[index] = cluster.x + dx * cos - dy * sin;
      this.py[index] = cluster.y + dx * sin + dy * cos;
      dx = this.tx[index] - cluster.x;
      dy = this.ty[index] - cluster.y;
      this.tx[index] = cluster.x + dx * cos - dy * sin;
      this.ty[index] = cluster.y + dx * sin + dy * cos;
    }
  }

  private range(scale: number) {
    const halfW = this.w / 2 / scale;
    const halfH = this.h / 2 / scale;
    const bounds = this.bounds;
    const centerX = (bounds.x0 + bounds.x1) / 2;
    const centerY = (bounds.y0 + bounds.y1) / 2;
    const wide = bounds.x1 - bounds.x0 > 2 * halfW;
    const tall = bounds.y1 - bounds.y0 > 2 * halfH;
    return {
      x0: wide ? Math.min(centerX, bounds.x0 + 0.35 * halfW) : centerX,
      x1: wide ? Math.max(centerX, bounds.x1 - 0.35 * halfW) : centerX,
      y0: tall ? Math.min(centerY, bounds.y0 + 0.35 * halfH) : centerY,
      y1: tall ? Math.max(centerY, bounds.y1 - 0.35 * halfH) : centerY,
      hw: halfW,
      hh: halfH,
    };
  }

  private zoomLimits() {
    return { lo: Math.log(this.fitZ), hi: Math.log(Math.max(9 * this.fitZ, 5)) };
  }

  private clampTargets() {
    const scale = Math.exp(this.cam.tz);
    const limits = this.range(scale);
    this.cam.tx = clamp(this.cam.tx, limits.x0, limits.x1);
    this.cam.ty = clamp(this.cam.ty, limits.y0, limits.y1);
  }

  private fitCamera(omega: number) {
    this.anchor = null;
    this.cam.tx = 0;
    this.cam.ty = 0;
    this.cam.tz = Math.log(this.fitZ);
    this.cam.omega = omega;
    if (this.reduced || omega === 0) {
      this.cam.x = 0;
      this.cam.y = 0;
      this.cam.lz = this.cam.tz;
      this.cam.vx = this.cam.vy = this.cam.vz = 0;
    }
  }

  private setFocus(index: number, smooth: boolean) {
    const valid = index >= 0 && index < this.clusters.length && this.clusters.length > 1;
    const target = valid ? index : -1;
    if (target !== this.focusCluster) {
      this.focusCluster = target;
      this.events.focus(target);
    }
    if (!valid) {
      if (smooth) this.fitCamera(6.5);
      return;
    }
    const cluster = this.clusters[index];
    const limits = this.zoomLimits();
    const scale = clamp(
      Math.min((this.w - 56) / (2 * cluster.r), (this.h - 104) / (2 * cluster.r + 48)),
      1.2 * this.fitZ,
      Math.exp(limits.hi),
    );
    this.anchor = null;
    this.cam.tx = cluster.x;
    this.cam.ty = cluster.y - 24 / scale;
    this.cam.tz = Math.log(scale);
    this.cam.omega = 6.2;
    if (this.reduced) {
      this.cam.x = this.cam.tx;
      this.cam.y = this.cam.ty;
      this.cam.lz = this.cam.tz;
    }
  }

  private zoomAt(x: number, y: number, factor: number) {
    const limits = this.zoomLimits();
    const world = this.toWorld(x, y);
    this.anchor = { wx: world.x, wy: world.y, sx: x, sy: y };
    this.cam.tz = clamp(this.cam.tz + Math.log(factor), limits.lo, limits.hi);
    this.cam.omega = 11;
    if (this.reduced) {
      this.cam.lz = this.cam.tz;
      this.applyAnchor();
      this.anchor = null;
      this.clampTargets();
      this.cam.x = this.cam.tx;
      this.cam.y = this.cam.ty;
    }
    this.wake();
  }

  private applyAnchor() {
    if (!this.anchor) return;
    const scale = Math.exp(this.cam.lz);
    const point = this.onPlane(this.anchor.sx, this.anchor.sy);
    this.cam.x = this.anchor.wx - point.x / scale;
    this.cam.y = this.anchor.wy - point.y / scale;
    this.cam.tx = this.cam.x;
    this.cam.ty = this.cam.y;
    this.cam.vx = 0;
    this.cam.vy = 0;
  }

  private camStep(dt: number) {
    const cam = this.cam;
    if (this.drag?.moved || this.pinch) return;
    if (this.reduced) {
      cam.lz = cam.tz;
      if (this.anchor) {
        this.applyAnchor();
        this.anchor = null;
        this.clampTargets();
      }
      cam.x = cam.tx;
      cam.y = cam.ty;
      return;
    }
    const omega = cam.omega;
    cam.vz += (omega * omega * (cam.tz - cam.lz) - 2 * omega * cam.vz) * dt;
    cam.lz += cam.vz * dt;
    if (this.anchor) {
      this.applyAnchor();
      if (Math.abs(cam.tz - cam.lz) < 1e-4 && Math.abs(cam.vz) < 0.001) {
        cam.lz = cam.tz;
        cam.vz = 0;
        this.anchor = null;
        this.clampTargets();
        cam.omega = 7;
      }
      return;
    }
    cam.vx += (omega * omega * (cam.tx - cam.x) - 2 * omega * cam.vx) * dt;
    cam.x += cam.vx * dt;
    cam.vy += (omega * omega * (cam.ty - cam.y) - 2 * omega * cam.vy) * dt;
    cam.y += cam.vy * dt;
  }

  private camMoving() {
    const cam = this.cam;
    return (
      !!this.anchor ||
      Math.abs(cam.tz - cam.lz) > 1e-4 ||
      Math.abs(cam.vz) > 0.001 ||
      Math.abs(cam.tx - cam.x) > 0.02 ||
      Math.abs(cam.ty - cam.y) > 0.02 ||
      Math.hypot(cam.vx, cam.vy) > 0.05
    );
  }

  private reportView() {
    const zoomed = this.cam.tz > Math.log(this.fitZ) + 0.04 || Math.hypot(this.cam.tx, this.cam.ty) > 4;
    if (zoomed !== this.zoomed) {
      this.zoomed = zoomed;
      this.events.view(zoomed);
    }
    if (!zoomed && this.focusCluster >= 0 && !this.pinch && !this.drag) {
      this.focusCluster = -1;
      this.events.focus(-1);
    }
  }

  private local(event: { clientX: number; clientY: number }) {
    const box = this.canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  private onPlane(x: number, y: number) {
    const angle = this.planeAngle();
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = x - this.w / 2;
    const dy = y - this.h / 2;
    const projected = (1150 * dy) / (1150 * cos + dy * sin);
    return { x: dx / (1150 / Math.max(60, 1150 - projected * sin)), y: projected };
  }

  private toWorld(x: number, y: number) {
    const scale = Math.exp(this.cam.lz);
    const point = this.onPlane(x, y);
    return { x: this.cam.x + point.x / scale, y: this.cam.y + point.y / scale };
  }

  private planeAngle() {
    return (
      this.plane.a * clamp(1 - (Math.exp(this.cam.lz) / this.fitZ - 1) / 1.8, 0, 1) + this.tilt.x
    );
  }

  pointerDown(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const point = this.local(event);
    this.pointers.set(event.pointerId, { ...point, type: event.pointerType });
    if (this.pointers.size === 1) {
      this.anchor = null;
      this.drag = {
        id: event.pointerId,
        sx: point.x,
        sy: point.y,
        lx: point.x,
        ly: point.y,
        lt: event.timeStamp,
        moved: false,
        rawX: this.cam.x,
        rawY: this.cam.y,
        vx: 0,
        vy: 0,
        type: event.pointerType,
      };
    } else if (this.pointers.size === 2) {
      const [first, second] = [...this.pointers.values()];
      const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      const world = this.toWorld(center.x, center.y);
      this.drag = null;
      this.pinch = {
        d0: Math.max(10, Math.hypot(first.x - second.x, first.y - second.y)),
        z0: Math.exp(this.cam.lz),
        wx: world.x,
        wy: world.y,
      };
      this.anchor = null;
      this.setHover(-1);
      this.events.interact();
    }
    this.wake();
  }

  pointerMove(event: PointerEvent<HTMLElement>) {
    const point = this.local(event);
    if (event.pointerType === "mouse") {
      this.mouse.x = point.x;
      this.mouse.y = point.y;
      this.mouse.inside = true;
      this.mouse.fine = true;
    }
    const pointer = this.pointers.get(event.pointerId);
    if (pointer) {
      pointer.x = point.x;
      pointer.y = point.y;
    }
    if (this.pinch && this.pointers.size >= 2) {
      const [first, second] = [...this.pointers.values()];
      const limits = this.zoomLimits();
      const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      const log = band(
        Math.log((this.pinch.z0 * Math.hypot(first.x - second.x, first.y - second.y)) / this.pinch.d0),
        limits.lo,
        limits.hi,
        0.9,
      );
      const scale = Math.exp(log);
      this.cam.lz = this.cam.tz = log;
      this.cam.vz = 0;
      this.cam.x = this.cam.tx = this.pinch.wx - (center.x - this.w / 2) / scale;
      this.cam.y = this.cam.ty = this.pinch.wy - (center.y - this.h / 2) / scale;
      this.wake();
      return;
    }
    const drag = this.drag;
    if (drag && drag.id === event.pointerId) {
      if (!drag.moved && Math.hypot(point.x - drag.sx, point.y - drag.sy) > 4) {
        drag.moved = true;
        drag.rawX = this.cam.x;
        drag.rawY = this.cam.y;
        this.setHover(-1);
        this.events.interact();
      }
      if (drag.moved) {
        const scale = Math.exp(this.cam.lz);
        const limits = this.range(scale);
        const dx = point.x - drag.lx;
        const dy = point.y - drag.ly;
        const elapsed = Math.max(1, event.timeStamp - drag.lt);
        drag.rawX -= dx / scale;
        drag.rawY -= dy / scale / Math.max(0.4, Math.cos(this.planeAngle()));
        this.cam.x = this.cam.tx = band(drag.rawX, limits.x0, limits.x1, 2 * limits.hw);
        this.cam.y = this.cam.ty = band(drag.rawY, limits.y0, limits.y1, 2 * limits.hh);
        this.cam.vx = this.cam.vy = 0;
        const blend = Math.min(1, elapsed / 40);
        drag.vx += ((-dx / scale / elapsed) * 1e3 - drag.vx) * blend;
        drag.vy += ((-dy / scale / elapsed) * 1e3 - drag.vy) * blend;
        this.tilt.ty = clamp((dx / elapsed) * 0.035, -0.16, 0.16);
        this.tilt.tx = clamp((-dy / elapsed) * 0.035, -0.16, 0.16);
        drag.lx = point.x;
        drag.ly = point.y;
        drag.lt = event.timeStamp;
        this.wake();
      }
      return;
    }
    if (event.pointerType === "mouse") {
      this.setHover(this.hit(point.x, point.y));
      this.wake();
    }
  }

  pointerUp(event: PointerEvent<HTMLElement>) {
    const point = this.local(event);
    this.pointers.delete(event.pointerId);
    if (this.pinch) {
      if (this.pointers.size < 2) {
        const limits = this.zoomLimits();
        this.pinch = null;
        this.drag = null;
        this.pointers.clear();
        this.cam.tz = clamp(this.cam.lz, limits.lo, limits.hi);
        this.cam.omega = 9;
        if (Math.abs(this.cam.tz - this.cam.lz) > 1e-4) {
          this.anchor = { wx: this.cam.x, wy: this.cam.y, sx: this.w / 2, sy: this.h / 2 };
        } else {
          this.clampTargets();
        }
      }
      this.wake();
      return;
    }
    const drag = this.drag;
    if (drag && drag.id === event.pointerId) {
      this.drag = null;
      this.tilt.tx = 0;
      this.tilt.ty = 0;
      if (drag.moved) {
        const rested = event.timeStamp - drag.lt > 90;
        const vx = rested ? 0 : clamp(drag.vx, -4000, 4000);
        const vy = rested ? 0 : clamp(drag.vy, -4000, 4000);
        if (this.reduced) {
          this.clampTargets();
          this.cam.x = this.cam.tx;
          this.cam.y = this.cam.ty;
        } else {
          this.cam.tx = this.cam.x + 0.3 * vx;
          this.cam.ty = this.cam.y + 0.3 * vy;
          this.clampTargets();
          this.cam.vx = vx;
          this.cam.vy = vy;
          this.cam.omega = 5.4;
        }
      } else {
        const now = event.timeStamp;
        if (
          drag.type !== "mouse" &&
          now - this.lastTap.t < 320 &&
          Math.hypot(point.x - this.lastTap.x, point.y - this.lastTap.y) < 30
        ) {
          this.lastTap.t = -1;
          this.doubleAt(point.x, point.y);
        } else {
          this.lastTap = { t: now, x: point.x, y: point.y };
          const hit = this.hit(point.x, point.y, drag.type === "mouse" ? 4 : 10);
          this.selected = hit;
          this.keyboard = drag.type !== "mouse";
          this.events.select(hit);
        }
      }
      this.wake();
    }
  }

  pointerCancel(event: PointerEvent<HTMLElement>) {
    this.pointers.delete(event.pointerId);
    if (this.drag?.id === event.pointerId) this.drag = null;
    if (this.pointers.size < 2) this.pinch = null;
    this.tilt.tx = 0;
    this.tilt.ty = 0;
    this.clampTargets();
    this.wake();
  }

  pointerLeave() {
    this.mouse.inside = false;
    if (!this.drag) this.setHover(-1);
    this.wake();
  }

  doubleClick(event: { clientX: number; clientY: number }) {
    const point = this.local(event);
    this.doubleAt(point.x, point.y);
  }

  private doubleAt(x: number, y: number) {
    this.events.interact();
    if (this.selected >= 0) {
      this.selected = -1;
      this.events.select(-1);
    }
    const world = this.toWorld(x, y);
    const scale = Math.exp(this.cam.lz);
    if (this.clusters.length < 2) {
      if (this.zoomed) this.resetView();
      else this.zoomAt(x, y, 2.4);
      return;
    }
    let nearest = -1;
    let best = Infinity;
    this.clusters.forEach((cluster, index) => {
      const distance = Math.hypot(world.x - cluster.x, world.y - cluster.y) - cluster.r;
      if (distance < 44 / scale && distance < best) {
        best = distance;
        nearest = index;
      }
    });
    if (nearest < 0 || nearest === this.focusCluster) this.resetView();
    else this.focus(nearest);
  }

  wheel(event: WheelEvent) {
    const point = this.local(event);
    const pinchZoom = event.ctrlKey || event.metaKey;
    const line = event.deltaMode === 1;
    const zoomIntent = pinchZoom || (Math.abs(event.deltaY) >= 40 && event.deltaX === 0);
    if (zoomIntent) {
      event.preventDefault();
      this.zoomAt(point.x, point.y, Math.exp(-event.deltaY * (pinchZoom ? 0.011 : line ? 0.05 : 0.0022)));
      this.events.interact();
      return;
    }
    if (!this.zoomed) return;
    event.preventDefault();
    const scale = Math.exp(this.cam.lz);
    this.anchor = null;
    this.cam.tx += event.deltaX / scale;
    this.cam.ty += event.deltaY / scale;
    this.clampTargets();
    this.cam.omega = 14;
    this.wake();
  }

  private setHover(index: number) {
    if (index === this.hovered) return;
    this.hovered = index;
    this.canvas.style.cursor = index >= 0 ? "pointer" : "";
    this.events.hover(index);
  }

  private hit(x: number, y: number, tolerance = 4) {
    let nearest = -1;
    let best = Infinity;
    for (let index = 0; index < COUNT; index++) {
      if (!this.visibleDot[index] || this.alpha[index] < 0.5) continue;
      const distance = Math.hypot(this.sx[index] - x, this.sy[index] - y) - this.sr[index];
      if (distance < tolerance && distance < best) {
        best = distance;
        nearest = index;
      }
    }
    return nearest;
  }

  private wake() {
    this.busy = true;
    if (!this.raf && this.visible && !this.hidden && this.w !== 0) {
      this.last = performance.now();
      this.acc = 0;
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  private active() {
    if (this.reduced) return this.simActive || this.camMoving() || !!this.drag;
    return this.busy || this.simActive || this.camMoving() || !!this.drag || !!this.pinch;
  }

  private step(dt: number) {
    if (this.simActive) this.simStep(dt);
    if (this.reduced) {
      this.alpha.set(this.alphaT);
      this.plane.a = this.plane.t;
    } else {
      const still = this.mouse.inside || !!this.drag || !!this.pinch || this.selected >= 0;
      this.drift += ((still ? 0 : 1) - this.drift) * (1 - Math.exp(-(2.5 * dt)));
      if (this.drift > 0.002) this.rotate(0.028 * this.drift * dt);
      let moving = !still || this.drift > 0.002;
      const plane = this.plane;
      const omega = this.intro ? 2.6 : 4.4;
      plane.v += (omega * omega * (plane.t - plane.a) - 2 * omega * plane.v) * dt;
      plane.a += plane.v * dt;
      const tilt = this.tilt;
      tilt.vx += (121 * (tilt.tx - tilt.x) - 12.1 * tilt.vx) * dt;
      tilt.x += tilt.vx * dt;
      tilt.vy += (121 * (tilt.ty - tilt.y) - 12.1 * tilt.vy) * dt;
      tilt.y += tilt.vy * dt;
      if (this.drag?.moved) {
        tilt.tx *= 0.9;
        tilt.ty *= 0.9;
      }
      const zoom = Math.exp(this.cam.lz) / this.fitZ;
      const lensTarget =
        this.mouse.inside && this.mouse.fine && !this.drag && !this.pinch ? clamp(1 - (zoom - 1.2) / 1.6, 0, 1) : 0;
      this.lens += (lensTarget - this.lens) * (1 - Math.exp(-(10 * dt)));
      const ease = 1 - Math.exp(-dt * (this.intro ? 5 : 11));
      let fading = false;
      for (let index = 0; index < COUNT; index++) {
        if (this.intro && this.simT < 0.7 * this.delay[index]) {
          fading = true;
          continue;
        }
        const delta = this.alphaT[index] - this.alpha[index];
        if (delta > 0.003 || delta < -0.003) {
          this.alpha[index] += delta * ease;
          fading = true;
        } else {
          this.alpha[index] = this.alphaT[index];
        }
      }
      moving =
        moving ||
        fading ||
        Math.abs(lensTarget - this.lens) > 0.002 ||
        Math.abs(plane.t - plane.a) > 1e-4 ||
        Math.abs(plane.v) > 1e-4 ||
        Math.abs(tilt.tx - tilt.x) > 1e-4 ||
        Math.abs(tilt.ty - tilt.y) > 1e-4 ||
        Math.abs(tilt.vx) > 1e-4 ||
        Math.abs(tilt.vy) > 1e-4;
      this.busy = moving;
    }
    this.camStep(dt);
    if (this.cardStep(dt)) this.busy = true;
  }

  private project(x: number, y: number, lift: number, out: Projected) {
    const scale = Math.exp(this.cam.lz);
    const plane = this.planeAngle();
    const tilt = this.tilt.y;
    const dx = (x - this.cam.x) * scale;
    const dy = (y - this.cam.y) * scale;
    const perspective = 1150 / Math.max(60, 1150 + dx * Math.sin(tilt) - dy * Math.sin(plane) - 80 * lift);
    out.x = this.w / 2 + dx * Math.cos(tilt) * perspective;
    out.y = this.h / 2 + dy * Math.cos(plane) * perspective;
    out.f = perspective;
    return out;
  }

  private render() {
    const ctx = this.ctx;
    if (!ctx || this.w === 0) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const scale = Math.exp(this.cam.lz);
    const centerX = this.w / 2;
    const centerY = this.h / 2;
    const plane = this.planeAngle();
    const cosY = Math.cos(this.tilt.y);
    const sinY = Math.sin(this.tilt.y);
    const cosP = Math.cos(plane);
    const sinP = Math.sin(plane);
    const lens = 0.85 * this.lens;
    const cursorX = this.mouse.x;
    const cursorY = this.mouse.y;
    const counts = this.counts;
    counts.fill(0);
    for (let index = 0; index < COUNT; index++) {
      const lift = this.lift[index];
      const dx = (this.px[index] - this.cam.x) * scale;
      const dy = (this.py[index] - this.cam.y) * scale;
      const perspective = 1150 / Math.max(60, 1150 + dx * sinY - dy * sinP - 80 * lift);
      let x = centerX + dx * cosY * perspective;
      let y = centerY + dy * cosP * perspective;
      let radius = this.rad[index] * scale * perspective * (1 + 0.3 * lift);
      if (lens > 0.001) {
        const ox = x - cursorX;
        const oy = y - cursorY;
        const square = ox * ox + oy * oy;
        if (square < 6084) {
          const boost = lens * Math.exp(-square / 1352);
          x = cursorX + ox * (1 + boost);
          y = cursorY + oy * (1 + boost);
          radius *= 1 + boost * Math.max(0.25, 1 - square / 2704);
        }
      }
      this.sx[index] = x;
      this.sy[index] = y;
      this.sr[index] = radius;
      const alpha = this.alpha[index];
      const visible = alpha > 0.02 && x > -radius && x < this.w + radius && y > -radius && y < this.h + radius;
      this.visibleDot[index] = visible ? 1 : 0;
      if (!visible) continue;
      const bucket = 4 * Math.round(7 * alpha) + this.health[index];
      this.bucketOf[index] = bucket;
      counts[bucket + 1]++;
    }
    for (let index = 1; index < counts.length; index++) counts[index] += counts[index - 1];
    const fill = this.fillAt;
    fill.set(counts);
    for (let index = 0; index < COUNT; index++) {
      if (this.visibleDot[index]) this.drawOrder[fill[this.bucketOf[index]]++] = index;
    }
    for (let bucket = 0; bucket < counts.length - 1; bucket++) {
      const start = counts[bucket];
      const end = counts[bucket + 1];
      if (start === end) continue;
      const alphaStep = bucket >> 2;
      const health = 3 & bucket;
      ctx.globalAlpha = (alphaStep / 7) * ALPHA[health];
      ctx.fillStyle = this.palette.dots[health];
      ctx.beginPath();
      for (let slot = start; slot < end; slot++) {
        const index = this.drawOrder[slot];
        const radius = Math.max(0.6, this.sr[index]);
        ctx.moveTo(this.sx[index] + radius, this.sy[index]);
        ctx.arc(this.sx[index], this.sy[index], radius, 0, 2 * Math.PI);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.ring(this.selected, this.palette.accent);
    if (this.hovered !== this.selected) this.ring(this.hovered, this.palette.ring);
    this.placeLabels();
    this.placeCard();
  }

  private ring(index: number, stroke: string) {
    const ctx = this.ctx;
    if (!ctx || index < 0 || !this.visibleDot[index]) return;
    const radius = Math.max(1.5, this.sr[index]);
    ctx.globalAlpha = ALPHA[this.health[index]];
    ctx.fillStyle = this.palette.dots[this.health[index]];
    ctx.beginPath();
    ctx.arc(this.sx[index], this.sy[index], radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.sx[index], this.sy[index], radius + 3, 0, 2 * Math.PI);
    ctx.stroke();
  }

  private placeLabel(index: number, element: HTMLDivElement) {
    const cluster = this.clusters[index];
    if (!cluster || this.w === 0) return;
    const point = this.project(cluster.x, cluster.y - cluster.r, 0, this.labelPoint);
    element.style.transform = `translate3d(${point.x.toFixed(1)}px, ${(point.y - 10).toFixed(1)}px, 0)`;
  }

  private placeLabels() {
    this.labelEls.forEach((element, index) => {
      if (element) this.placeLabel(index, element);
    });
  }

  private cardTarget() {
    const hovering = this.hovered >= 0;
    const index = hovering ? this.hovered : this.selected;
    if (index < 0) return null;
    const { w, h } = this.card;
    let x: number;
    let y: number;
    let gap: number;
    if (hovering) {
      x = this.mouse.x;
      y = this.mouse.y;
      gap = 18;
    } else {
      x = this.sx[index];
      y = this.sy[index];
      gap = this.sr[index] + 12;
    }
    let left = x + gap;
    let top = y - h / 2;
    if (left + w > this.w - 14) left = x - gap - w;
    return { x: clamp(left, 14, Math.max(14, this.w - w - 14)), y: clamp(top, 14, Math.max(14, this.h - h - 14)) };
  }

  private cardStep(dt: number) {
    const target = this.cardTarget();
    if (!target) {
      this.card.shown = false;
      return false;
    }
    const card = this.card;
    if (!card.shown || this.reduced) {
      card.x = target.x;
      card.y = target.y;
      card.vx = card.vy = 0;
      card.shown = true;
      return false;
    }
    card.vx += (400 * (target.x - card.x) - 40 * card.vx) * dt;
    card.x += card.vx * dt;
    card.vy += (400 * (target.y - card.y) - 40 * card.vy) * dt;
    card.y += card.vy * dt;
    return (
      Math.abs(target.x - card.x) > 0.1 ||
      Math.abs(target.y - card.y) > 0.1 ||
      Math.abs(card.vx) > 0.5 ||
      Math.abs(card.vy) > 0.5
    );
  }

  private placeCard() {
    if (this.cardEl && this.card.shown) {
      this.cardEl.style.transform = `translate3d(${this.card.x.toFixed(1)}px, ${this.card.y.toFixed(1)}px, 0)`;
    }
  }
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Money and counts roll like an odometer: one column per digit, the strip slides to the new digit. */
function Roll({ text }: { text: string }) {
  const characters = [...text];
  return (
    <span className={styles.roll}>
      <span className={styles.srOnly}>{text}</span>
      <span className={styles.rollVisual} aria-hidden="true">
        {characters.map((character, index) => {
          const key = characters.length - 1 - index;
          if (character < "0" || character > "9") {
            return (
              <span className={styles.sym} key={`s${key}`}>
                {character}
              </span>
            );
          }
          return (
            <span className={styles.wheel} key={`d${key}`}>
              <span
                className={styles.strip}
                style={{ "--d": character, "--i": index } as CSSProperties}
              >
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

function Swatch({ health }: { health: number }) {
  return <span className={styles.swatch} data-tone={TONES[health]} aria-hidden="true" />;
}

interface HoverStore {
  get: () => number;
  set: (id: number) => void;
  subscribe: (listener: () => void) => () => void;
}

/** One account under the cursor or under the keyboard cursor. */
function Card({
  store,
  selected,
  attach,
  measure,
}: {
  store: HoverStore;
  selected: number;
  attach: (node: HTMLDivElement | null) => void;
  measure: () => void;
}) {
  const hovered = useSyncExternalStore(store.subscribe, store.get, () => -1);
  const active = hovered >= 0 ? hovered : selected;
  const [last, setLast] = useState(-1);
  if (active >= 0 && active !== last) setLast(active);
  const account = ACCOUNTS[active >= 0 ? active : last];
  useLayoutEffect(() => {
    measure();
  }, [account, measure]);
  return (
    <div ref={attach} className={styles.card} data-open={active >= 0} aria-hidden="true">
      {account && (
        <>
          <div className={styles.cardName}>{account.name}</div>
          <div className={styles.cardMeta}>
            {PLANS[account.plan]} · {REGIONS[account.region]} · {INDUSTRIES[account.industry]}
          </div>
          <dl className={styles.cardRows}>
            <div>
              <dt>MRR</dt>
              <dd className={styles.num}>{currency(account.mrr)}</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>{account.owner}</dd>
            </div>
            <div>
              <dt>Health</dt>
              <dd className={styles.health}>
                <Swatch health={account.health} />
                {HEALTHS[account.health]}
              </dd>
            </div>
          </dl>
          <p className={styles.cardNote}>{account.note}</p>
        </>
      )}
    </div>
  );
}

/** The rows panel tracks its content height: jumping on first paint, gliding for 700ms after a grouping change. */
function useRowsHeight(group: GroupKey, reduce: boolean) {
  const content = useRef<HTMLDivElement>(null);
  const height = useMotionValue<number | "auto">("auto");
  const measured = useRef(0);
  const previous = useRef(group);
  const until = useRef(0);
  useLayoutEffect(() => {
    if (previous.current === group) return;
    previous.current = group;
    until.current = performance.now() + 700;
  }, [group]);
  useEffect(() => {
    const node = content.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let sized = false;
    const observer = new ResizeObserver(() => {
      const next = node.offsetHeight;
      measured.current = next;
      if (!sized || reduce || performance.now() > until.current) {
        sized = next > 0;
        height.jump(next || "auto");
        return;
      }
      animate(height, next, { ...motionTokens.spring.smooth });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [height, reduce]);
  return { content, height };
}

/**
 * Two thousand four hundred accounts as one drifting galaxy: dot size is MRR, colour is health.
 * Grouping spirals the dots into clusters, which can be flown into, panned, zoomed and inspected.
 */
export function CustomerGalaxy() {
  const reduce = useReducedMotion() ?? false;
  const id = useId();
  const titleId = `${id}-title`;
  const hintId = `${id}-hint`;
  const stageId = `${id}-stage`;

  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Galaxy | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const labelRefs = useRef(new Map<number, HTMLDivElement>());

  const [hoverStore] = useState<HoverStore>(() => {
    let current = -1;
    const listeners = new Set<() => void>();
    return {
      get: () => current,
      set: (next: number) => {
        if (next === current) return;
        current = next;
        listeners.forEach((listener) => listener());
      },
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    };
  });

  const [group, setGroupKey] = useState<GroupKey>("all");
  const [settled, setSettled] = useState(true);
  const [selected, setSelected] = useState(-1);
  const [focused, setFocused] = useState(-1);
  const [lit, setLit] = useState(-1);
  const [sort, setSort] = useState<"mrr" | "count">("mrr");
  const [zoomed, setZoomed] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [keyboardPick, setKeyboardPick] = useState(false);

  const stats = clustersFor(group);
  const rowStats = clustersFor(group === "all" ? "health" : group);
  const rowKey: GroupKey = group === "all" ? "health" : group;
  const tab = TABS.find((entry) => entry.key === group) ?? TABS[0];
  const scope = focused >= 0 && stats[focused] ? stats[focused] : ALL;
  const rows = useMemo(
    () =>
      [...rowStats].sort(
        (left, right) =>
          (sort === "mrr" ? right.mrr - left.mrr : right.count - left.count) || left.index - right.index,
      ),
    [rowStats, sort],
  );
  const peak = Math.max(...rowStats.map((stat) => (sort === "mrr" ? stat.mrr : stat.count)));
  const clusterOrder = [...stats].sort((left, right) => right.mrr - left.mrr).map((stat) => stat.index);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!stage || !canvas || !section) return;
    const engine = new Galaxy(canvas, {
      hover: hoverStore.set,
      select: (index) => {
        setSelected(index);
        setKeyboardPick(false);
      },
      settle: setSettled,
      focus: setFocused,
      view: setZoomed,
      interact: () => setInteracted(true),
    });
    engineRef.current = engine;
    engine.attachCard(cardRef.current);
    labelRefs.current.forEach((element, index) => engine.attachLabel(index, element));

    const readPalette = () => {
      const computed = getComputedStyle(section);
      const token = (name: string, fallback: string) => computed.getPropertyValue(name).trim() || fallback;
      engine.setPalette({
        dots: [
          token("--text-muted", "#8a8a8a"),
          token("--success", "#1f8a4c"),
          token("--warning", "#b7791f"),
          token("--danger", "#c53030"),
        ],
        ring: token("--foreground", "#111"),
        accent: token("--accent", "#333"),
      });
    };
    readPalette();
    const themeObserver = new MutationObserver(readPalette);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-accent", "class", "style"],
    });
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", readPalette);

    const resizeObserver = new ResizeObserver(([entry]) =>
      engine.resize(entry.contentRect.width, entry.contentRect.height, Math.min(2, window.devicePixelRatio || 1)),
    );
    resizeObserver.observe(stage);

    const intersectionObserver = new IntersectionObserver(([entry]) => engine.setVisible(entry.isIntersecting), {
      threshold: 0.2,
    });
    intersectionObserver.observe(stage);

    const onVisibility = () => engine.setHidden(document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);

    const onWheel = (event: WheelEvent) => engine.wheel(event);
    stage.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      engine.destroy();
      engineRef.current = null;
      themeObserver.disconnect();
      scheme.removeEventListener("change", readPalette);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      stage.removeEventListener("wheel", onWheel);
    };
  }, [hoverStore]);

  useEffect(() => {
    engineRef.current?.setReduced(reduce);
  }, [reduce]);

  useEffect(() => {
    const index = lit >= 0 ? lit : focused;
    engineRef.current?.setHighlight(index >= 0 ? { group: lit >= 0 ? rowKey : group, cat: index } : null);
  }, [lit, focused, group, rowKey]);

  const attachCard = useCallback((node: HTMLDivElement | null) => {
    cardRef.current = node;
    engineRef.current?.attachCard(node);
  }, []);

  const measureCard = useCallback(() => {
    engineRef.current?.measureCard();
  }, []);

  const attachLabel = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const index = Number(node.dataset.index);
    labelRefs.current.set(index, node);
    engineRef.current?.attachLabel(index, node);
    return () => {
      if (labelRefs.current.get(index) === node) {
        labelRefs.current.delete(index);
        engineRef.current?.attachLabel(index, null);
      }
    };
  }, []);

  const changeGroup = (next: GroupKey, index = -1) => {
    const engine = engineRef.current;
    if (next === group) {
      if (index >= 0) engine?.focus(index);
      return;
    }
    setGroupKey(next);
    setLit(-1);
    setSelected(-1);
    setFocused(index);
    engine?.select(-1, false);
    engine?.setGroup(next, index);
  };

  const stepAccount = (direction: number) => {
    const ordered = ACCOUNTS.filter((account) => focused < 0 || groupIndex(group, account) === focused)
      .sort((left, right) => right.mrr - left.mrr || left.id - right.id)
      .map((account) => account.id);
    const current = ordered.indexOf(selected);
    const next =
      ordered[
        current < 0
          ? direction > 0
            ? 0
            : ordered.length - 1
          : Math.min(ordered.length - 1, Math.max(0, current + direction))
      ];
    setSelected(next);
    setKeyboardPick(true);
    engineRef.current?.select(next, true);
  };

  const onStagePointer = (event: PointerEvent<HTMLDivElement>) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (event.type === "pointerdown") {
      if ((event.target as HTMLElement).closest("button")) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      engine.pointerDown(event);
      return;
    }
    if (event.type === "pointermove") {
      engine.pointerMove(event);
      return;
    }
    if (event.type === "pointerup") {
      engine.pointerUp(event);
      return;
    }
    engine.pointerCancel(event);
  };

  const onStageKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const engine = engineRef.current;
    if (!engine) return;
    let handled = true;
    if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && stats.length > 1) {
      const at = clusterOrder.indexOf(focused);
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const target =
        clusterOrder[
          at < 0
            ? direction > 0
              ? 0
              : clusterOrder.length - 1
            : (at + direction + clusterOrder.length) % clusterOrder.length
        ];
      setSelected(-1);
      engine.select(-1, true);
      engine.focus(target);
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      stepAccount(1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      stepAccount(-1);
    } else if (event.key === "+" || event.key === "=") {
      engine.zoomBy(1.6);
    } else if (event.key === "-" || event.key === "_") {
      engine.zoomBy(0.625);
    } else if (event.key === "Escape" && selected >= 0) {
      setSelected(-1);
      engine.select(-1, false);
    } else if (event.key === "Escape" || event.key === "0" || event.key === "Home") {
      engine.resetView();
    } else {
      handled = false;
    }
    if (handled) {
      event.preventDefault();
      setInteracted(true);
    }
  };

  const scopeLabel = focused >= 0 && stats[focused] ? stats[focused].label : "All accounts";
  const picked = selected >= 0 ? ACCOUNTS[selected] : null;
  const liveText =
    keyboardPick && picked
      ? `${picked.name}. ${PLANS[picked.plan]}, ${currency(picked.mrr)} MRR, owner ${picked.owner}, ${HEALTHS[
          picked.health
        ].toLowerCase()}. ${picked.note}.`
      : focused >= 0 && stats[focused]
        ? `${stats[focused].label}: ${NUMBER.format(stats[focused].count)} accounts, ${money(
            stats[focused].mrr,
          )} MRR, ${money(stats[focused].healthMrr[3])} at risk.`
        : group === "all"
          ? "Showing all accounts in one cluster."
          : `Grouped by ${tab.noun} into ${stats.length} clusters. ${stats[clusterOrder[0]].label} leads with ${money(
              Math.max(...stats.map((stat) => stat.mrr)),
            )} MRR.`;
  const stageLabel = `Customer galaxy: ${NUMBER.format(ALL.count)} accounts with ${money(
    ALL.mrr,
  )} in monthly recurring revenue, ${
    group === "all" ? "shown as one cluster" : `grouped by ${tab.noun}`
  }. Dot size shows MRR and color shows health.`;
  const layoutTransition = reduce ? { duration: 0 } : motionTokens.spring.smooth;
  const enterEase = [...motionTokens.ease.enter] as [number, number, number, number];
  const { content: rowsContent, height: rowsHeight } = useRowsHeight(group, reduce);

  return (
    <section ref={sectionRef} className={styles.root} aria-labelledby={titleId}>
      <header className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          Where your revenue lives
        </h2>
        <p className={styles.lede}>{NUMBER.format(ALL.count)} accounts, sized by MRR and colored by health.</p>
      </header>

      <div className={styles.toolbar}>
        <LayoutGroup id={`${id}-tabs`}>
          <div
            ref={tabsRef}
            className={styles.tabs}
            role="tablist"
            aria-label="Group accounts by"
            onKeyDown={(event) => {
              const at = TABS.findIndex((entry) => entry.key === group);
              const next =
                event.key === "ArrowRight"
                  ? (at + 1) % TABS.length
                  : event.key === "ArrowLeft"
                    ? (at - 1 + TABS.length) % TABS.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? TABS.length - 1
                        : -1;
              if (next < 0) return;
              event.preventDefault();
              changeGroup(TABS[next].key);
              tabsRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
            }}
          >
            {TABS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                role="tab"
                id={`${id}-tab-${entry.key}`}
                aria-selected={group === entry.key}
                aria-controls={stageId}
                tabIndex={group === entry.key ? 0 : -1}
                className={styles.tab}
                onClick={() => changeGroup(entry.key)}
              >
                {group === entry.key && (
                  <motion.span
                    layoutId="tab"
                    className={styles.tabPill}
                    transition={reduce ? { duration: 0 } : motionTokens.spring.morph}
                  />
                )}
                <span className={styles.tabLabel}>{entry.label}</span>
              </button>
            ))}
          </div>
        </LayoutGroup>

        <ul className={styles.legend} aria-label="Legend">
          {HEALTH_ORDER.map((health) => (
            <li key={health}>
              <Swatch health={health} />
              {HEALTHS[health]}
            </li>
          ))}
          <li className={styles.sizeKey}>
            <span className={styles.sizeDots} aria-hidden="true">
              <span />
              <span />
            </span>
            Size is MRR
          </li>
        </ul>
      </div>

      <div className={styles.body}>
        <div className={styles.stageWrap} role="tabpanel" id={stageId} aria-labelledby={`${id}-tab-${group}`}>
          <div
            ref={stageRef}
            className={styles.stage}
            data-zoomed={zoomed}
            tabIndex={0}
            role="application"
            aria-roledescription="interactive chart"
            aria-label={stageLabel}
            aria-describedby={hintId}
            onPointerDown={onStagePointer}
            onPointerMove={onStagePointer}
            onPointerUp={onStagePointer}
            onPointerCancel={onStagePointer}
            onPointerLeave={() => engineRef.current?.pointerLeave()}
            onDoubleClick={(event) => engineRef.current?.doubleClick(event.nativeEvent)}
            onKeyDown={onStageKey}
          >
            <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
            <div className={styles.labels} aria-hidden="true">
              {settled &&
                group !== "all" &&
                stats.map((stat) => (
                  <div
                    key={`${group}-${stat.index}`}
                    className={styles.label}
                    data-dim={(focused >= 0 && focused !== stat.index) || (lit >= 0 && lit !== stat.index)}
                    data-index={stat.index}
                    ref={attachLabel}
                  >
                    <div className={styles.labelInner} style={{ "--i": clusterOrder.indexOf(stat.index) } as CSSProperties}>
                      <span className={styles.labelName}>{stat.label}</span>
                      <span className={styles.labelMeta}>
                        <Roll text={money(stat.mrr)} />
                        <span className={styles.labelCount}>
                          <span className={styles.dotSep}>·</span>
                          <Roll text={NUMBER.format(stat.count)} /> accounts
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
            </div>

            <Card store={hoverStore} selected={selected} attach={attachCard} measure={measureCard} />

            <AnimatePresence initial={false}>
              {focused >= 0 && stats[focused] && (
                <motion.button
                  key="back"
                  type="button"
                  className={styles.back}
                  onClick={() => engineRef.current?.resetView()}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={reduce ? { duration: 0 } : { duration: motionTokens.duration.standard, ease: enterEase }}
                >
                  <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
                  Show all
                </motion.button>
              )}
            </AnimatePresence>

            <p className={styles.hint} data-hidden={interacted} aria-hidden="true">
              <span className={styles.hintFine}>Drag to pan, scroll to zoom, double click a cluster to fly in</span>
              <span className={styles.hintCoarse}>Pinch to zoom, double tap a cluster to fly in</span>
            </p>

            <div className={styles.zoom}>
              <button type="button" aria-label="Zoom out" onClick={() => engineRef.current?.zoomBy(0.625)}>
                <Minus size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button type="button" aria-label="Zoom in" onClick={() => engineRef.current?.zoomBy(1.6)}>
                <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Fit all accounts"
                disabled={!zoomed}
                onClick={() => engineRef.current?.resetView()}
              >
                <Maximize2 size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          </div>
          <p id={hintId} className={styles.srOnly}>
            Use left and right arrows to fly between clusters, up and down to step through accounts by MRR, plus and
            minus to zoom, and Escape to reset.
          </p>
        </div>

        <aside className={styles.panel} aria-label="Totals">
          <div className={styles.scope}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={scopeLabel}
                className={styles.scopeText}
                initial={reduce ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={
                  reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: { duration: motionTokens.duration.instant } }
                }
                transition={{ duration: motionTokens.duration.standard, ease: enterEase }}
              >
                {scopeLabel}
              </motion.span>
            </AnimatePresence>
          </div>

          <div className={styles.kpiMain}>
            <span className={styles.kpiLabel}>Monthly recurring revenue</span>
            <span className={styles.kpiValue}>
              <Roll text={money(scope.mrr)} />
            </span>
          </div>

          <dl className={styles.kpis}>
            <div>
              <dt>Accounts</dt>
              <dd>
                <Roll text={NUMBER.format(scope.count)} />
              </dd>
            </div>
            <div>
              <dt>
                <Swatch health={1} />
                Expanding
              </dt>
              <dd>
                <Roll text={money(scope.healthMrr[1])} />
              </dd>
            </div>
            <div>
              <dt>
                <Swatch health={3} />
                At risk
              </dt>
              <dd>
                <Roll text={money(scope.healthMrr[3])} />
              </dd>
            </div>
          </dl>

          <div className={styles.breakdown}>
            <div className={styles.breakdownHead}>
              <h3>By {rowKey === "health" ? "health" : tab.noun}</h3>
              <div className={styles.sort} role="group" aria-label="Sort rows by">
                {(["mrr", "count"] as const).map((option) => (
                  <button key={option} type="button" aria-pressed={sort === option} onClick={() => setSort(option)}>
                    {option === "mrr" ? "MRR" : "Accounts"}
                  </button>
                ))}
              </div>
            </div>

            <motion.div className={styles.rowsWrap} style={{ height: rowsHeight }}>
              <div ref={rowsContent}>
                <ul key={group} className={styles.rows}>
                  {rows.map((stat, position) => {
                    const value = sort === "mrr" ? stat.mrr : stat.count;
                    const segments = HEALTH_ORDER.map((health) => ({
                      health,
                      value: sort === "mrr" ? stat.healthMrr[health] : stat.healthCount[health],
                    })).filter((segment) => segment.value > 0);
                    return (
                      <motion.li
                        key={stat.index}
                        layout="position"
                        transition={{ layout: layoutTransition }}
                        initial={reduce ? false : { opacity: 0, y: 4 }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          transition: {
                            duration: motionTokens.duration.standard,
                            ease: enterEase,
                            delay: reduce ? 0 : position * motionTokens.stagger.item,
                          },
                        }}
                      >
                        <button
                          type="button"
                          className={styles.row}
                          aria-pressed={group !== "all" && focused === stat.index}
                          data-lit={lit === stat.index}
                          aria-label={`${stat.label}: ${money(stat.mrr)} MRR, ${NUMBER.format(
                            stat.count,
                          )} accounts, ${shareAtRisk(stat.healthMrr[3], stat.mrr)}% of MRR at risk. ${
                            group === "all"
                              ? "Group by health and fly to this cluster"
                              : focused === stat.index
                                ? "Show all clusters"
                                : "Fly to this cluster"
                          }`}
                          onPointerEnter={(event) => {
                            if (event.pointerType === "mouse") setLit(stat.index);
                          }}
                          onPointerLeave={() => setLit(-1)}
                          onFocus={() => setLit(stat.index)}
                          onBlur={() => setLit(-1)}
                          onClick={() => {
                            setInteracted(true);
                            if (group === "all") changeGroup("health", stat.index);
                            else if (focused === stat.index) engineRef.current?.resetView();
                            else engineRef.current?.focus(stat.index);
                          }}
                        >
                          <span className={styles.rowTop}>
                            <span className={styles.rowName}>{stat.label}</span>
                            <span className={styles.rowValue}>
                              <Roll text={sort === "mrr" ? money(value) : NUMBER.format(value)} />
                            </span>
                          </span>
                          <span className={styles.track}>
                            <span className={styles.fill} style={{ width: `${(value / peak) * 100}%` }}>
                              {segments.map((segment) => (
                                <span
                                  key={segment.health}
                                  className={styles.seg}
                                  data-tone={TONES[segment.health]}
                                  style={{ flexGrow: segment.value }}
                                />
                              ))}
                            </span>
                          </span>
                          <span className={styles.rowMeta}>
                            {sort === "mrr" ? `${NUMBER.format(stat.count)} accounts` : money(stat.mrr)}
                            {rowKey !== "health" && (
                              <>
                                {" · "}
                                {shareAtRisk(stat.healthMrr[3], stat.mrr)}% at risk
                              </>
                            )}
                          </span>
                        </button>
                      </motion.li>
                    );
                  })}
                </ul>
              </div>
            </motion.div>
          </div>
        </aside>
      </div>

      <div className={styles.srOnly}>
        <table>
          <caption>Accounts and monthly recurring revenue by {rowKey === "health" ? "health" : tab.noun}</caption>
          <thead>
            <tr>
              <th scope="col">{rowKey === "health" ? "Health" : tab.label}</th>
              <th scope="col">Accounts</th>
              <th scope="col">MRR</th>
              {HEALTH_ORDER.map((health) => (
                <th key={health} scope="col">
                  {HEALTHS[health]} accounts
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowStats.map((stat) => (
              <tr key={stat.index}>
                <th scope="row">{stat.label}</th>
                <td>{NUMBER.format(stat.count)}</td>
                <td>{currency(stat.mrr)}</td>
                {HEALTH_ORDER.map((health) => (
                  <td key={health}>{NUMBER.format(stat.healthCount[health])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.srOnly} aria-live="polite">
        {liveText}
      </p>
    </section>
  );
}

export default CustomerGalaxy;
