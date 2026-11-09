"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Check, Maximize2, Pause, Play, X, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from "react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { Button } from "../button/button";
import { NumberField } from "../number-field/number-field";
import SegmentedControl from "../segmented-control/segmented-control";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./market-terminal.module.css";

/* ── data model ─────────────────────────────────────────────────────────── */

export interface MarketSymbol {
  ticker: string;
  name: string;
  exchange: string;
  price: number;
  prevClose: number;
  /** Daily volatility as a fraction, such as 0.02. */
  vol: number;
  /** Average daily volume in shares. */
  avgVolume: number;
}

export interface Holding {
  ticker: string;
  shares: number;
}

export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit";
export type OrderStatus = "filled" | "working" | "canceled";

export interface OrderRecord {
  id: string;
  side: OrderSide;
  type: OrderType;
  ticker: string;
  shares: number;
  price: number;
  status: OrderStatus;
  time: string;
}

export interface OrderRequest {
  side: OrderSide;
  type: OrderType;
  ticker: string;
  shares: number;
  price: number;
}

export type AverageId = "ma20" | "ma50";
export type RangeId = "1D" | "5D" | "1M" | "6M" | "1Y";

export interface RangeSpec {
  id: RangeId;
  label: string;
  interval: string;
  count: number;
  warm: number;
  /** Minutes per candle, or 0 for daily candles. */
  minutes: number;
}

export interface Bar {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  label: string;
  tick: string;
  rank: number;
  today: boolean;
}

export interface MarketTerminalProps {
  symbols?: MarketSymbol[];
  holdings?: Holding[];
  buyingPower?: number;
  orders?: OrderRecord[];
  defaultTicker?: string;
  defaultRange?: RangeId;
  defaultAverages?: AverageId[];
  live?: boolean;
  tickInterval?: number;
  onPlaceOrder?: (order: OrderRequest) => void | Promise<void>;
  onCancelOrder?: (order: OrderRecord) => void | Promise<void>;
  className?: string;
}

/* ── sample data ────────────────────────────────────────────────────────── */

export const marketSymbols: MarketSymbol[] = [
  { ticker: "NVDA", name: "NVIDIA", exchange: "Nasdaq", price: 186.42, prevClose: 182.97, vol: 0.024, avgVolume: 182e6 },
  { ticker: "AAPL", name: "Apple", exchange: "Nasdaq", price: 238.15, prevClose: 239.02, vol: 0.014, avgVolume: 52e6 },
  { ticker: "MSFT", name: "Microsoft", exchange: "Nasdaq", price: 514.6, prevClose: 509.88, vol: 0.012, avgVolume: 21e6 },
  { ticker: "AMZN", name: "Amazon", exchange: "Nasdaq", price: 226.34, prevClose: 228.1, vol: 0.018, avgVolume: 41e6 },
  { ticker: "GOOGL", name: "Alphabet", exchange: "Nasdaq", price: 251.73, prevClose: 248.66, vol: 0.016, avgVolume: 31e6 },
  { ticker: "META", name: "Meta Platforms", exchange: "Nasdaq", price: 768.2, prevClose: 772.45, vol: 0.02, avgVolume: 12e6 },
  { ticker: "TSLA", name: "Tesla", exchange: "Nasdaq", price: 412.88, prevClose: 401.3, vol: 0.035, avgVolume: 94e6 },
  { ticker: "JPM", name: "JPMorgan Chase", exchange: "NYSE", price: 301.12, prevClose: 299.64, vol: 0.013, avgVolume: 9e6 },
];

export const marketRanges: RangeSpec[] = [
  { id: "1D", label: "1D", interval: "5 minute", count: 56, warm: 40, minutes: 5 },
  { id: "5D", label: "5D", interval: "30 minute", count: 62, warm: 39, minutes: 30 },
  { id: "1M", label: "1M", interval: "daily", count: 21, warm: 50, minutes: 0 },
  { id: "6M", label: "6M", interval: "daily", count: 126, warm: 50, minutes: 0 },
  { id: "1Y", label: "1Y", interval: "daily", count: 252, warm: 50, minutes: 0 },
];

export const marketHoldings: Holding[] = [
  { ticker: "NVDA", shares: 120 },
  { ticker: "AAPL", shares: 45 },
  { ticker: "MSFT", shares: 18 },
  { ticker: "TSLA", shares: 12 },
  { ticker: "JPM", shares: 30 },
];

export const marketOrders: OrderRecord[] = [
  { id: "o-2", side: "sell", type: "limit", ticker: "MSFT", shares: 4, price: 516, status: "working", time: "11:18" },
  { id: "o-1", side: "buy", type: "market", ticker: "NVDA", shares: 20, price: 183.64, status: "filled", time: "10:42" },
];

export const movingAverages: { id: AverageId; period: number; label: string }[] = [
  { id: "ma20", period: 20, label: "MA 20" },
  { id: "ma50", period: 50, label: "MA 50" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HOLIDAYS = new Set(["2025-09-01", "2025-11-27", "2025-12-25", "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07"]);
/** The session the sample series end on. Fixed so every render draws the same last candle. */
const TODAY = { y: 2026, m: 8, d: 24 };

/* ── helpers ────────────────────────────────────────────────────────────── */

interface Day { y: number; m: number; d: number }

const iso = (day: Day) => `${day.y}-${String(day.m + 1).padStart(2, "0")}-${String(day.d).padStart(2, "0")}`;

function previousTradingDay(day: Day): Day {
  const date = new Date(Date.UTC(day.y, day.m, day.d));
  do {
    date.setUTCDate(date.getUTCDate() - 1);
  } while (date.getUTCDay() === 0 || date.getUTCDay() === 6 || HOLIDAYS.has(date.toISOString().slice(0, 10)));
  return { y: date.getUTCFullYear(), m: date.getUTCMonth(), d: date.getUTCDate() };
}

const clock = (minute: number) => `${Math.floor(minute / 60)}:${String(minute % 60).padStart(2, "0")}`;

/** Standard normal from one uniform source, so a seeded walk stays reproducible. */
const gaussFrom = (random: () => number) => Math.sqrt(-2 * Math.log(Math.max(1e-9, random()))) * Math.cos(2 * Math.PI * random());
const gauss = () => gaussFrom(Math.random);

const round2 = (value: number) => Math.round(value * 100) / 100;
const numberFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (value: number) => numberFormat.format(value);
const usd = (value: number) => moneyFormat.format(value);
const pct = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}%`;

function volume(value: number) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(value >= 1e8 ? 0 : 1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
  return String(Math.round(value));
}

const rangeById = (id: RangeId) => marketRanges.find(range => range.id === id) ?? marketRanges[3];
const seriesKey = (ticker: string, range: RangeId) => `${ticker}:${range}`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const { spring, duration } = motionTokens;
/** The engine's approach time constant, a quarter of the smooth spring's visual duration. */
const ALPHA = spring.smooth.visualDuration / 4;
const PALETTE = ["--foreground", "--text-secondary", "--text-muted", "--border", "--border-subtle", "--success", "--danger", "--accent", "--series-1", "--series-3", "--surface"] as const;

const subscribeNever = () => () => {};

/* ── candle series ──────────────────────────────────────────────────────── */

/** FNV-1a, so a ticker and range always grow the same candles. */
function hashString(text: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x1000193);
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    const value = Math.imul((state = (state + 0x6d2b79f5) | 0) ^ (state >>> 15), 1 | state);
    const mixed = (value + Math.imul(value ^ (value >>> 7), 61 | value)) | 0;
    const result = (mixed ^ value) | 0;
    return ((result ^ (result >>> 14)) >>> 0) / 0x100000000;
  };
}

function slotsFor(range: RangeSpec, total: number): { day: Day; minute: number }[] {
  const slots: { day: Day; minute: number }[] = [];
  let day = TODAY;
  if (!range.minutes) {
    while (slots.length < total) {
      slots.push({ day, minute: 0 });
      day = previousTradingDay(day);
    }
    return slots;
  }
  let minute = 570 + Math.floor(275 / range.minutes) * range.minutes;
  while (slots.length < total) {
    slots.push({ day, minute });
    minute -= range.minutes;
    if (minute < 570) {
      day = previousTradingDay(day);
      minute = 960 - range.minutes;
    }
  }
  return slots;
}

/** A close for every slot: a seeded walk from the previous close up to today's price, then backwards for the warm-up. */
function buildBars(symbol: MarketSymbol, range: RangeSpec): Bar[] {
  const total = range.count + range.warm;
  const slots = slotsFor(range, total).reverse();
  const random = mulberry32(hashString(seriesKey(symbol.ticker, range.id)));
  const perSession = range.minutes ? 390 / range.minutes : 1;
  const sigma = symbol.vol / Math.sqrt(perSession);
  const todayKey = iso(TODAY);
  const todayFlags = slots.map(slot => iso(slot.day) === todayKey);
  const firstToday = todayFlags.indexOf(true);
  const closes = new Array<number>(total);
  const steps = total - firstToday;
  const walk = [0];
  for (let index = 1; index <= steps; index += 1) walk.push(walk[index - 1] + gaussFrom(random));
  const drift = Math.log(symbol.price / symbol.prevClose);
  for (let index = 1; index <= steps; index += 1) {
    const centred = walk[index] - (index / steps) * walk[steps];
    closes[firstToday + index - 1] = symbol.prevClose * Math.exp((index / steps) * drift + centred * sigma * 0.9);
  }
  const phase = 10 * random();
  let back = symbol.prevClose;
  for (let index = firstToday - 1; index >= 0; index -= 1) {
    closes[index] = back;
    const wobble = 0.32 * Math.sin(index / 19 + phase) + 0.18 * Math.sin(index / 7.3 + 2 * phase);
    back /= Math.exp(sigma * (gaussFrom(random) + 0.6 * wobble));
  }
  return slots.map((slot, index) => {
    const close = closes[index];
    const sessionStart = index === 0 || iso(slots[index - 1].day) !== iso(slot.day);
    const previous = index === 0 ? close / Math.exp(sigma * gaussFrom(random)) : closes[index - 1];
    const gap = range.minutes && !sessionStart ? 0 : sigma * (range.minutes ? 1.6 : 0.35) * gaussFrom(random);
    const open = index === firstToday ? symbol.prevClose * Math.exp(0.5 * gap) : previous * Math.exp(gap);
    const wick = 0.55 * sigma;
    const high = Math.max(open, close) * Math.exp(Math.abs(gaussFrom(random)) * wick);
    const low = Math.min(open, close) * Math.exp(-Math.abs(gaussFrom(random)) * wick);
    const body = Math.abs(Math.log(close / open)) / sigma;
    const progress = (slot.minute - 570) / 390;
    const shape = range.minutes ? 0.62 + 1.5 * (progress - 0.5) ** 2 * 4 * (progress < 0.5 ? 1.25 : 0.9) : 1;
    const volume = Math.round((symbol.avgVolume / perSession) * shape * Math.exp(0.28 * gaussFrom(random)) * (0.75 + 0.25 * body));
    const dayLabel = `${MONTHS[slot.day.m]} ${slot.day.d}`;
    const newMonth = index === 0 || slots[index - 1].day.m !== slot.day.m;
    return {
      o: round2(open),
      h: round2(high),
      l: round2(low),
      c: round2(close),
      v: volume,
      label: range.minutes ? `${dayLabel}, ${clock(slot.minute)}` : `${dayLabel}, ${slot.day.y}`,
      tick: range.minutes ? (sessionStart ? dayLabel : clock(slot.minute)) : newMonth ? (slot.day.m === 0 ? String(slot.day.y) : MONTHS[slot.day.m]) : dayLabel,
      rank: range.minutes ? (sessionStart ? 2 : Number(slot.minute % 60 === 0)) : newMonth ? 2 : 1,
      today: todayFlags[index],
    };
  });
}

/** Coarser ranges show the same session: each of today's candles is folded from its five minute bars. */
function foldToday(coarse: Bar[], fine: Bar[], minutes: number) {
  const fineToday = fine.filter(bar => bar.today);
  if (!fineToday.length) return;
  const coarseToday = coarse.filter(bar => bar.today);
  const size = minutes ? minutes / 5 : fineToday.length;
  coarseToday.forEach((bar, index) => {
    const group = fineToday.slice(index * size, (index + 1) * size);
    if (!group.length) return;
    bar.o = group[0].o;
    bar.c = group[group.length - 1].c;
    bar.h = Math.max(...group.map(item => item.h));
    bar.l = Math.min(...group.map(item => item.l));
    bar.v = group.reduce((sum, item) => sum + item.v, 0);
  });
}

class SeriesStore {
  private map = new Map<string, Bar[]>();

  peek(ticker: string, range: RangeId) {
    return this.map.get(seriesKey(ticker, range));
  }

  get(symbol: MarketSymbol, range: RangeSpec): Bar[] {
    const cached = this.peek(symbol.ticker, range.id);
    if (cached) return cached;
    const bars = buildBars(symbol, range);
    if (range.id !== "1D") foldToday(bars, this.get(symbol, rangeById("1D")), range.minutes);
    this.map.set(seriesKey(symbol.ticker, range.id), bars);
    return bars;
  }
}

/* ── chart engine ───────────────────────────────────────────────────────── */

interface ReadoutNodes {
  date: HTMLElement | null;
  o: HTMLElement | null;
  h: HTMLElement | null;
  l: HTMLElement | null;
  c: HTMLElement | null;
  change: HTMLElement | null;
  volume: HTMLElement | null;
  ma20: HTMLElement | null;
  ma50: HTMLElement | null;
}

interface ChartNodes {
  last: HTMLElement;
  crossPrice: HTMLElement;
  crossTime: HTMLElement;
  limit: HTMLElement;
  readout: ReadoutNodes;
}

/**
 * One canvas for candles, volume, averages, the crosshair and the price tags. Everything that moves
 * during a gesture is computed here and written straight to the DOM, so React never re-renders per frame.
 */
class ChartEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  nodes: ChartNodes;
  bars: Bar[] = [];
  averages: Record<AverageId, (number | null)[]> = { ma20: [], ma50: [] };
  show = new Set<AverageId>();
  n = 0;
  count = 0;
  s = 0;
  e = 0;
  ts = 0;
  te = 0;
  lo = 0;
  hi = 1;
  vMax = 1;
  snapY = true;
  live = 0;
  shown = 0;
  prevClose = 0;
  alpha = 1;
  vel = 0;
  cross: { i: number; y: number | null } | null = null;
  limit: number | null = null;
  w = 0;
  h = 0;
  dpr = 1;
  colors: Record<string, string> | null = null;
  font = "Inter, sans-serif";
  reduced = false;
  raf = 0;
  lastT = 0;
  text = new Map<HTMLElement, string>();
  readIndex = -2;
  readPrice = Number.NaN;

  constructor(canvas: HTMLCanvasElement, nodes: ChartNodes) {
    this.canvas = canvas;
    this.nodes = nodes;
    this.ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  }

  get plotW() {
    return Math.max(1, this.w - 68);
  }

  get spanSlots() {
    return this.e - this.s;
  }

  get maxEnd() {
    return this.n + 3;
  }

  get viewCount() {
    return this.w ? Math.min(this.count, Math.max(12, Math.floor(this.plotW / 5))) : this.count;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  resize(width: number, height: number, dpr: number) {
    const first = !this.w;
    this.w = width;
    this.h = height;
    this.dpr = dpr;
    if (first && this.n) {
      this.ts = Math.max(0, this.n - this.viewCount);
      this.te = this.maxEnd;
      this.s = this.ts;
      this.e = this.te;
      this.snapY = true;
    }
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.invalidate(true);
  }

  setBars(bars: Bar[], count: number, live: number, prevClose: number, animate: boolean) {
    this.bars = bars;
    this.n = bars.length;
    this.count = count;
    this.live = live;
    this.shown = live;
    this.prevClose = prevClose;
    this.recompute();
    this.ts = Math.max(0, this.n - this.viewCount);
    this.te = this.maxEnd;
    this.s = this.ts;
    this.e = this.te;
    this.snapY = true;
    this.cross = null;
    this.vel = 0;
    this.alpha = animate && !this.reduced ? 0 : 1;
    this.readIndex = -2;
    this.invalidate();
  }

  setLive(live: number) {
    this.live = live;
    if (this.reduced) this.shown = live;
    this.recompute();
    this.invalidate();
  }

  /** Moving averages are one running sum over the closes. */
  recompute() {
    for (const average of movingAverages) {
      const values = new Array<number | null>(this.bars.length).fill(null);
      let sum = 0;
      for (let index = 0; index < this.bars.length; index += 1) {
        sum += this.bars[index].c;
        if (index >= average.period) sum -= this.bars[index - average.period].c;
        if (index >= average.period - 1) values[index] = sum / average.period;
      }
      this.averages[average.id] = values;
    }
  }

  clampTarget() {
    // The view keeps a minimum count, never starts before the first candle and never ends past the live one.
    let span = clamp(this.te - this.ts, Math.min(12, this.maxEnd), this.maxEnd);
    let start = this.ts;
    if (start < 0) start = 0;
    if (start + span > this.maxEnd) start = this.maxEnd - span;
    const changed = start !== this.ts || start + span !== this.te;
    this.ts = start;
    this.te = start + span;
    return changed;
  }

  zoom(factor: number, anchor: number, sync = false) {
    const span = this.te - this.ts;
    const next = clamp(span * factor, Math.min(12, this.maxEnd), this.maxEnd);
    if (Math.abs(next - span) < 1e-6) return false;
    const pivot = this.ts + anchor * span;
    this.ts = pivot - anchor * next;
    this.te = this.ts + next;
    this.clampTarget();
    this.vel = 0;
    if (sync || this.reduced) {
      this.s = this.ts;
      this.e = this.te;
    }
    this.invalidate();
    return true;
  }

  pan(delta: number, sync = false) {
    this.ts += delta;
    this.te += delta;
    this.clampTarget();
    if (sync || this.reduced) {
      this.s = this.ts;
      this.e = this.te;
    }
    this.invalidate();
  }

  reset() {
    this.ts = Math.max(0, this.n - this.viewCount);
    this.te = this.maxEnd;
    this.vel = 0;
    if (this.reduced) {
      this.s = this.ts;
      this.e = this.te;
    }
    this.invalidate();
  }

  indexAt(x: number) {
    return clamp(Math.floor(this.s + (x / this.plotW) * this.spanSlots), 0, this.n - 1);
  }

  anchorFor(index: number) {
    return clamp((index + 0.5 - this.ts) / (this.te - this.ts), 0, 1);
  }

  setCross(x: number | null, y: number | null = null) {
    this.cross = x === null ? null : { i: this.indexAt(x), y };
    this.invalidate();
  }

  /** Moves the crosshair by candles, panning when it reaches either edge. Returns the candle it landed on. */
  step(direction: number | "first" | "last") {
    const from = this.cross?.i ?? this.n - 1;
    const index = direction === "first" ? 0 : direction === "last" ? this.n - 1 : clamp(from + direction, 0, this.n - 1);
    this.cross = { i: index, y: null };
    const span = this.te - this.ts;
    if (index < this.ts + 1) this.pan(index - 1 - this.ts);
    else if (index + 1 > this.te - 3 + 1) this.pan(Math.min(this.maxEnd, index + 3) - this.te);
    else if (span <= 0) this.reset();
    this.invalidate();
    return index;
  }

  invalidate(sync = false) {
    if (sync) {
      this.frame(performance.now(), true);
      return;
    }
    if (this.raf) return;
    this.lastT = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  setText(node: HTMLElement | null, value: string) {
    if (!node || this.text.get(node) === value) return;
    this.text.set(node, value);
    node.textContent = value;
  }

  /** One frame: glide the view, the price scale and the live candle, then draw. Keeps asking for frames until still. */
  frame = (time: number, sync = false) => {
    if (!sync) this.raf = 0;
    const dt = this.lastT ? Math.min(0.05, (time - this.lastT) / 1000) : 1 / 60;
    if (!sync) this.lastT = time;
    const approach = (timeConstant: number) => (this.reduced ? 1 : 1 - Math.exp(-dt / timeConstant));

    if (this.vel) {
      this.ts += this.vel * dt;
      this.te += this.vel * dt;
      const clamped = this.clampTarget();
      this.s = this.ts;
      this.e = this.te;
      this.vel *= Math.exp(-dt / 0.32);
      if (clamped || Math.abs(this.vel) * (this.plotW / this.spanSlots) < 12) this.vel = 0;
    }

    this.s += (this.ts - this.s) * approach(0.6 * ALPHA);
    this.e += (this.te - this.e) * approach(0.6 * ALPHA);
    this.shown += (this.live - this.shown) * approach(1.6 * ALPHA);
    this.alpha += (1 - this.alpha) * approach(0.9 * ALPHA);

    const from = clamp(Math.floor(this.s), 0, this.n - 1);
    const to = clamp(Math.ceil(this.e), 0, this.n - 1);
    let low = Number.POSITIVE_INFINITY;
    let high = Number.NEGATIVE_INFINITY;
    let peak = 0;
    for (let index = from; index <= to; index += 1) {
      const bar = this.bars[index];
      const last = index === this.n - 1;
      low = Math.min(low, last ? Math.min(bar.l, this.shown) : bar.l);
      high = Math.max(high, last ? Math.max(bar.h, this.shown) : bar.h);
      peak = Math.max(peak, bar.v);
    }
    if (!Number.isFinite(low)) {
      low = 0;
      high = 1;
    }
    const pad = Math.max((high - low) * 0.08, 0.002 * high);
    const nextLo = low - pad;
    const nextHi = high + pad;
    if (this.snapY) {
      this.lo = nextLo;
      this.hi = nextHi;
      this.vMax = peak;
      this.snapY = false;
    } else {
      this.lo += (nextLo - this.lo) * approach(ALPHA);
      this.hi += (nextHi - this.hi) * approach(ALPHA);
      this.vMax += (peak - this.vMax) * approach(ALPHA);
    }

    this.draw();

    const height = this.hi - this.lo;
    const moving =
      this.vel !== 0 ||
      Math.abs(this.ts - this.s) > 0.001 ||
      Math.abs(this.te - this.e) > 0.001 ||
      Math.abs(this.live - this.shown) > 5e-4 ||
      1 - this.alpha > 0.002 ||
      Math.abs(nextLo - this.lo) > 1e-4 * height ||
      Math.abs(nextHi - this.hi) > 1e-4 * height ||
      Math.abs(peak - this.vMax) > 0.001 * peak;
    if (sync) return;
    if (moving) this.raf = requestAnimationFrame(this.frame);
    else {
      this.s = this.ts;
      this.e = this.te;
      this.shown = this.live;
      this.alpha = 1;
      this.lo = nextLo;
      this.hi = nextHi;
      this.vMax = peak;
      this.draw();
    }
  };

  draw() {
    const ctx = this.ctx;
    const colors = this.colors;
    if (!ctx || !colors || !this.w || !this.n) return;
    const { w, h, dpr, bars, n } = this;
    const plotW = this.plotW;
    const bottom = h - 28;
    const volumeHeight = clamp((h - 28) * 0.15, 36, 88);
    const priceBottom = bottom - volumeHeight - 14;
    const topPad = w < 640 ? 20 : 56;
    const perSlot = plotW / this.spanSlots;
    const xOf = (index: number) => (index - this.s + 0.5) * perSlot;
    const yOf = (price: number) => priceBottom - ((price - this.lo) / (this.hi - this.lo)) * (priceBottom - topPad);
    const from = clamp(Math.floor(this.s) - 1, 0, n - 1);
    const to = clamp(Math.ceil(this.e) + 1, 0, n - 1);
    const lastBar = bars[n - 1];
    const closeOf = (index: number) => (index === n - 1 ? this.shown : bars[index].c);
    const highOf = (index: number) => (index === n - 1 ? Math.max(bars[index].h, this.shown) : bars[index].h);
    const lowOf = (index: number) => (index === n - 1 ? Math.min(bars[index].l, this.shown) : bars[index].l);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = `400 12px ${this.font}`;
    ctx.textBaseline = "middle";

    const up = this.shown >= this.prevClose;
    const lastY = clamp(yOf(this.shown), topPad - 12, priceBottom + 12);
    const avoid = [lastY];
    if (this.cross) avoid.push(this.cross.y === null ? yOf(closeOf(clamp(this.cross.i, 0, n - 1))) : this.cross.y);

    // Price grid: a step that lands on 1, 2 or 5 times a power of ten, labels skipped near the tags.
    const rawStep = (this.hi - this.lo) / Math.max(1, Math.max(3, Math.floor((priceBottom - topPad) / 64)));
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const ratio = rawStep / magnitude;
    const step = (ratio < 1.5 ? 1 : ratio < 3 ? 2 : ratio < 7 ? 5 : 10) * magnitude;
    ctx.fillStyle = colors["--text-muted"];
    ctx.textAlign = "left";
    for (let price = Math.ceil(this.lo / step) * step; price <= this.hi; price += step) {
      const y = Math.round(yOf(price)) + 0.5;
      if (y < topPad - 8 || y > priceBottom + 4) continue;
      ctx.fillStyle = colors["--border-subtle"];
      ctx.fillRect(0, y - 0.5, plotW, 1);
      if (avoid.some(value => Math.abs(value - y) < 16)) continue;
      ctx.fillStyle = colors["--text-muted"];
      ctx.fillText(fmt(price), plotW + 12, y);
    }

    // Time axis: session or month starts first, then every nth label that still clears its neighbour.
    const every = [1, 2, 3, 4, 6, 12, 24, 48, 96, 192].find(value => value * perSlot >= 76) ?? 384;
    const placed: number[] = [];
    const fits = (x: number, gap: number) => placed.every(value => Math.abs(value - x) >= gap);
    ctx.textAlign = "center";
    for (const pass of [2, 1]) {
      for (let index = from; index <= to; index += 1) {
        const bar = bars[index];
        if (pass === 2 ? bar.rank !== 2 : bar.rank < 2 && index % every !== 0) continue;
        const x = xOf(index);
        if (x < 24 || x > plotW - 24) continue;
        if (!fits(x, pass === 2 ? 60.8 : 76)) continue;
        placed.push(x);
        ctx.fillStyle = colors["--border-subtle"];
        ctx.fillRect(Math.round(x), topPad - 8, 1, bottom - topPad + 8);
        ctx.fillStyle = pass === 2 ? colors["--text-secondary"] : colors["--text-muted"];
        ctx.fillText(bar.tick, x, bottom + 14 + 1);
      }
    }

    ctx.fillStyle = colors["--border"];
    ctx.fillRect(0, bottom, plotW, 1);
    ctx.fillRect(plotW, topPad - 8, 1, bottom - topPad + 8);

    const cross = this.cross ? { i: clamp(this.cross.i, 0, n - 1), y: this.cross.y } : null;
    if (cross) {
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = colors["--foreground"];
      ctx.fillRect(xOf(cross.i) - perSlot / 2, topPad - 8, perSlot, bottom - topPad + 8);
      ctx.globalAlpha = 1;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, plotW, h);
    ctx.clip();
    ctx.globalAlpha = this.alpha;

    const bodyWidth = Math.max(1, Math.min(0.66 * perSlot, 16));
    ctx.globalAlpha = 0.34 * this.alpha;
    for (let index = from; index <= to; index += 1) {
      const height = Math.max(1, (bars[index].v / Math.max(1, this.vMax)) * (volumeHeight - 4));
      ctx.fillStyle = closeOf(index) >= bars[index].o ? colors["--success"] : colors["--danger"];
      ctx.fillRect(Math.round(xOf(index) - bodyWidth / 2), bottom - height, Math.max(1, Math.round(bodyWidth)), height);
    }

    ctx.globalAlpha = this.alpha;
    for (const average of movingAverages) {
      if (!this.show.has(average.id)) continue;
      const values = this.averages[average.id];
      ctx.beginPath();
      let started = false;
      for (let index = from; index <= to; index += 1) {
        let value = values[index];
        if (value === null) {
          started = false;
          continue;
        }
        if (index === n - 1) value += (this.shown - lastBar.c) / average.period;
        if (started) ctx.lineTo(xOf(index), yOf(value));
        else {
          ctx.moveTo(xOf(index), yOf(value));
          started = true;
        }
      }
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.strokeStyle = average.id === "ma20" ? colors["--series-1"] : colors["--series-3"];
      ctx.stroke();
    }

    for (let index = from; index <= to; index += 1) {
      const open = bars[index].o;
      const close = closeOf(index);
      ctx.fillStyle = close >= open ? colors["--success"] : colors["--danger"];
      const x = Math.round(xOf(index));
      const top = yOf(highOf(index));
      const floor = yOf(lowOf(index));
      ctx.fillRect(x - 0.5 * Number(bodyWidth > 3), top, 1, Math.max(1, floor - top));
      if (bodyWidth > 1.5) {
        const bodyTop = Math.min(yOf(open), yOf(close));
        const bodyHeight = Math.max(1, Math.abs(yOf(open) - yOf(close)));
        const width = Math.max(2, Math.round(bodyWidth));
        ctx.fillRect(x - Math.floor(width / 2), bodyTop, width, bodyHeight);
      }
    }
    ctx.restore();

    // Last price line and its tag.
    ctx.globalAlpha = 1;
    ctx.setLineDash([2, 3]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = up ? colors["--success"] : colors["--danger"];
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(lastY) + 0.5);
    ctx.lineTo(plotW, Math.round(lastY) + 0.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
    this.nodes.last.style.transform = `translate3d(0, ${lastY}px, 0)`;
    this.nodes.last.dataset.direction = up ? "up" : "down";
    this.setText(this.nodes.last, fmt(this.shown));

    if (this.limit !== null) {
      const y = clamp(yOf(this.limit), topPad - 12, priceBottom + 12);
      ctx.strokeStyle = colors["--accent"];
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(plotW, Math.round(y) + 0.5);
      ctx.stroke();
      this.nodes.limit.style.transform = `translate3d(0, ${y}px, 0)`;
      this.nodes.limit.dataset.visible = "";
      this.setText(this.nodes.limit, `Limit ${fmt(this.limit)}`);
    } else delete this.nodes.limit.dataset.visible;

    ctx.setLineDash([]);
    if (cross) {
      const x = Math.round(xOf(cross.i)) + 0.5;
      const y = cross.y === null ? yOf(closeOf(cross.i)) : clamp(cross.y, topPad, bottom);
      ctx.strokeStyle = colors["--text-muted"];
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, topPad - 8);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(plotW, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      const price = this.lo + ((priceBottom - y) / (priceBottom - topPad)) * (this.hi - this.lo);
      this.nodes.crossPrice.style.transform = `translate3d(0, ${y}px, 0)`;
      this.setText(this.nodes.crossPrice, y <= priceBottom + 6 ? fmt(price) : volume(((bottom - y) / volumeHeight) * this.vMax));
      this.nodes.crossPrice.dataset.visible = "";
      const timeX = clamp(x, 60, plotW - 60);
      this.nodes.crossTime.style.transform = `translate3d(${timeX}px, 0, 0) translateX(-50%)`;
      this.setText(this.nodes.crossTime, bars[cross.i].label);
      this.nodes.crossTime.dataset.visible = "";
    } else {
      delete this.nodes.crossPrice.dataset.visible;
      delete this.nodes.crossTime.dataset.visible;
    }

    this.readout(cross ? cross.i : n - 1);
  }

  /** Writes the OHLC readout, only when the candle or the live price actually changed. */
  readout(index: number) {
    const isLive = index === this.n - 1;
    if (index === this.readIndex && (!isLive || this.readPrice === this.shown)) return;
    this.readIndex = index;
    this.readPrice = this.shown;
    const bar = this.bars[index];
    const nodes = this.nodes.readout;
    const close = isLive ? this.shown : bar.c;
    const high = isLive ? Math.max(bar.h, close) : bar.h;
    const low = isLive ? Math.min(bar.l, close) : bar.l;
    const previous = index > 0 ? this.bars[index - 1].c : bar.o;
    const change = ((close - previous) / previous) * 100;
    this.setText(nodes.date, bar.label);
    this.setText(nodes.o, fmt(bar.o));
    this.setText(nodes.h, fmt(high));
    this.setText(nodes.l, fmt(low));
    this.setText(nodes.c, fmt(close));
    this.setText(nodes.change, pct(change));
    if (nodes.change) nodes.change.dataset.direction = change >= 0 ? "up" : "down";
    this.setText(nodes.volume, volume(bar.v));
    for (const average of movingAverages) {
      const value = this.averages[average.id][index];
      const moved = value === null ? null : isLive ? value + (this.shown - bar.c) / average.period : value;
      this.setText(nodes[average.id], moved === null ? "n/a" : fmt(moved));
    }
  }

  /** The sentence read out when the crosshair moves with the keyboard. */
  describe(index: number) {
    const bar = this.bars[index];
    const isLive = index === this.n - 1;
    const close = isLive ? this.live : bar.c;
    const previous = index > 0 ? this.bars[index - 1].c : bar.o;
    const change = ((close - previous) / previous) * 100;
    return `${bar.label}${isLive ? ", live" : ""}. Open ${fmt(bar.o)}, high ${fmt(Math.max(bar.h, close))}, low ${fmt(Math.min(bar.l, close))}, close ${fmt(close)}, ${change >= 0 ? "up" : "down"} ${Math.abs(change).toFixed(2)} percent. Volume ${volume(bar.v)}.`;
  }
}

/* ── chart ──────────────────────────────────────────────────────────────── */

interface ZoomHandle {
  zoom: (factor: number) => void;
  reset: () => void;
}

interface ChartProps {
  bars: Bar[];
  seriesId: string;
  range: RangeSpec;
  symbol: MarketSymbol;
  live: number;
  averages: AverageId[];
  limit: number | null;
  reduced: boolean;
  zoomRef: { current: ZoomHandle | null };
}

const lastBarOf = (bars: Bar[]) => bars[bars.length - 1];

function TerminalChart({ bars, seriesId, range, symbol, live, averages, limit, reduced, zoomRef }: ChartProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const readoutBox = useRef<HTMLDivElement>(null);
  const lastTag = useRef<HTMLSpanElement>(null);
  const crossPrice = useRef<HTMLSpanElement>(null);
  const crossTime = useRef<HTMLSpanElement>(null);
  const limitTag = useRef<HTMLSpanElement>(null);
  const announce = useRef<HTMLSpanElement>(null);
  const engineRef = useRef<ChartEngine | null>(null);
  const firstBars = useRef(true);
  const hintId = useId();

  useEffect(() => {
    const node = canvas.current;
    const box = surface.current;
    const probeNode = probe.current;
    const readoutNode = readoutBox.current;
    if (!node || !box || !probeNode || !readoutNode) return;
    const read = (key: string) => readoutNode.querySelector<HTMLElement>(`[data-read="${key}"]`);
    const engine = new ChartEngine(node, {
      last: lastTag.current as HTMLSpanElement,
      crossPrice: crossPrice.current as HTMLSpanElement,
      crossTime: crossTime.current as HTMLSpanElement,
      limit: limitTag.current as HTMLSpanElement,
      announce: announce.current,
      readout: {
        date: read("date"),
        o: read("o"),
        h: read("h"),
        l: read("l"),
        c: read("c"),
        change: read("change"),
        volume: read("volume"),
        ma20: read("ma20"),
        ma50: read("ma50"),
      },
    } as ChartNodes);
    engineRef.current = engine;

    // Colors and the font come from CSS, so light, dark and accent switches recolor without a rebuild.
    const paint = () => {
      const colors: Record<string, string> = {};
      for (const key of PALETTE) {
        probeNode.style.color = `var(${key})`;
        colors[key] = getComputedStyle(probeNode).color;
      }
      engine.colors = colors;
      engine.font = getComputedStyle(node).fontFamily || engine.font;
      engine.invalidate();
    };
    paint();
    const theme = new MutationObserver(paint);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-accent", "class", "style"] });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", paint);
    const size = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      engine.resize(width, height, Math.min(2, window.devicePixelRatio || 1));
    });
    size.observe(box);
    return () => {
      theme.disconnect();
      scheme.removeEventListener("change", paint);
      size.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (engineRef.current) engineRef.current.reduced = reduced;
  }, [reduced]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setBars(bars, range.count, live, symbol.prevClose, !firstBars.current);
    firstBars.current = false;
  }, [seriesId]);

  useEffect(() => {
    engineRef.current?.setLive(live);
  }, [live]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.show = new Set(averages);
    engine.invalidate();
  }, [averages]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.limit = limit;
    engine.invalidate();
  }, [limit]);

  useEffect(() => {
    zoomRef.current = {
      zoom: factor => {
        const engine = engineRef.current;
        if (engine) engine.zoom(factor, engine.anchorFor(engine.cross?.i ?? engine.n - 1));
      },
      reset: () => engineRef.current?.reset(),
    };
    return () => {
      zoomRef.current = null;
    };
  }, [zoomRef]);

  // The wheel pans sideways on a trackpad swipe and zooms around the cursor otherwise.
  useEffect(() => {
    const node = surface.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      const rect = node.getBoundingClientRect();
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
      const deltaX = event.deltaX * scale;
      const deltaY = event.deltaY * scale;
      if (!event.ctrlKey && Math.abs(deltaX) > Math.abs(deltaY)) {
        event.preventDefault();
        engine.pan(deltaX / (engine.plotW / (engine.te - engine.ts)));
        return;
      }
      const anchor = clamp((event.clientX - rect.left) / engine.plotW, 0, 1);
      const factor = Math.exp(deltaY * (event.ctrlKey ? 0.012 : 0.0022));
      if (engine.zoom(factor, anchor)) event.preventDefault();
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  const gesture = useRef({ pointers: new Map<number, { x: number; y: number }>(), startX: 0, startY: 0, moved: false, pinch: null as null | { distance: number; span: number; pivot: number }, samples: [] as { t: number; x: number }[] });

  const local = (event: PointerEvent<HTMLDivElement>) => {
    const rect = (surface.current as HTMLDivElement).getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const release = (event: PointerEvent<HTMLDivElement>) => {
    const engine = engineRef.current;
    const state = gesture.current;
    if (!engine || !state.pointers.has(event.pointerId)) return;
    const point = local(event);
    state.pointers.delete(event.pointerId);
    if (state.pointers.size === 1) {
      state.pinch = null;
      const only = [...state.pointers.values()][0];
      state.samples = [{ t: event.timeStamp, x: only.x }];
      return;
    }
    if (state.pointers.size > 0 || ((state.pinch = null), event.type === "pointercancel")) return;
    if (!state.moved) {
      // A tap pins the crosshair; a second tap on the same candle clears it.
      if (event.pointerType !== "mouse") engine.setCross(engine.cross && engine.cross.i === engine.indexAt(point.x) ? null : point.x < engine.plotW ? point.x : null, point.y);
      return;
    }
    const first = state.samples[0];
    const last = state.samples[state.samples.length - 1];
    const seconds = (last.t - first.t) / 1000;
    if (!reduced && seconds > 0 && event.timeStamp - last.t < 80) {
      engine.vel = -((last.x - first.x) / seconds) / (engine.plotW / (engine.te - engine.ts));
      engine.invalidate();
    }
  };

  const latest = lastBarOf(bars);
  const sessionMove = live - (bars.length > 1 ? bars[bars.length - 2].c : latest.o);

  return (
    <div className={styles.chart}>
      <span ref={probe} className={styles.probe} aria-hidden="true" />
      <div ref={readoutBox} className={styles.readout} aria-hidden="true">
        <span data-read="date" className={styles.readDate}>
          {latest.label}
        </span>
        <span className={styles.readGroup}>
          <span className={styles.readItem}>
            <span className={styles.readKey}>O</span>
            <span data-read="o">{fmt(latest.o)}</span>
          </span>
          <span className={styles.readItem}>
            <span className={styles.readKey}>H</span>
            <span data-read="h">{fmt(Math.max(latest.h, live))}</span>
          </span>
          <span className={styles.readItem}>
            <span className={styles.readKey}>L</span>
            <span data-read="l">{fmt(Math.min(latest.l, live))}</span>
          </span>
          <span className={styles.readItem}>
            <span className={styles.readKey}>C</span>
            <span data-read="c">{fmt(live)}</span>
          </span>
          <span data-read="change" className={styles.readChange} data-direction={sessionMove >= 0 ? "up" : "down"}>
            {pct((sessionMove / (live - sessionMove)) * 100)}
          </span>
        </span>
        <span className={styles.readGroup}>
          <span className={styles.readItem}>
            <span className={styles.readKey}>Vol</span>
            <span data-read="volume">{volume(latest.v)}</span>
          </span>
          {movingAverages.map(average => (
            <span key={average.id} className={styles.readItem} data-average={average.id} data-hidden={averages.includes(average.id) ? undefined : ""}>
              <span className={styles.readKey}>{average.label}</span>
              <span data-read={average.id}>n/a</span>
            </span>
          ))}
        </span>
      </div>
      <div
        ref={surface}
        className={styles.surface}
        tabIndex={0}
        role="img"
        aria-roledescription="interactive chart"
        aria-label={`${symbol.ticker} ${range.label} chart, ${range.interval} candles`}
        aria-describedby={hintId}
        onPointerDown={event => {
          const engine = engineRef.current;
          const state = gesture.current;
          if (!engine || (event.pointerType === "mouse" && event.button !== 0)) return;
          const point = local(event);
          state.pointers.set(event.pointerId, point);
          event.currentTarget.setPointerCapture(event.pointerId);
          engine.vel = 0;
          if (state.pointers.size === 1) {
            state.startX = point.x;
            state.startY = point.y;
            state.moved = false;
            state.samples = [{ t: event.timeStamp, x: point.x }];
          }
          if (state.pointers.size === 2) {
            const [first, second] = [...state.pointers.values()];
            const middle = (first.x + second.x) / 2;
            state.pinch = { distance: Math.max(24, Math.abs(first.x - second.x)), span: engine.te - engine.ts, pivot: engine.ts + (middle / engine.plotW) * (engine.te - engine.ts) };
            state.moved = true;
            engine.setCross(null);
          }
        }}
        onPointerMove={event => {
          const engine = engineRef.current;
          const state = gesture.current;
          if (!engine) return;
          const point = local(event);
          if (!state.pointers.has(event.pointerId)) {
            if (event.pointerType === "mouse") engine.setCross(point.x < engine.plotW ? point.x : null, point.y);
            return;
          }
          const previous = state.pointers.get(event.pointerId) as { x: number; y: number };
          state.pointers.set(event.pointerId, point);
          if (state.pinch && state.pointers.size >= 2) {
            const [first, second] = [...state.pointers.values()];
            const middle = (first.x + second.x) / 2;
            const distance = Math.max(24, Math.abs(first.x - second.x));
            const span = clamp(state.pinch.span * (state.pinch.distance / distance), Math.min(12, engine.maxEnd), engine.maxEnd);
            engine.ts = state.pinch.pivot - (middle / engine.plotW) * span;
            engine.te = engine.ts + span;
            engine.clampTarget();
            engine.s = engine.ts;
            engine.e = engine.te;
            engine.invalidate();
            return;
          }
          if (!state.moved && Math.abs(point.x - state.startX) < 6 && Math.abs(point.y - state.startY) < 6) return;
          if (!state.moved) {
            state.moved = true;
            if (event.pointerType !== "mouse") engine.setCross(null);
          }
          engine.pan(-(point.x - previous.x) / (engine.plotW / (engine.te - engine.ts)), true);
          if (event.pointerType === "mouse") engine.setCross(point.x < engine.plotW ? point.x : null, point.y);
          state.samples.push({ t: event.timeStamp, x: point.x });
          if (state.samples.length > 6) state.samples.shift();
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={event => {
          if (event.pointerType !== "mouse" || gesture.current.pointers.size) return;
          engineRef.current?.setCross(null);
        }}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          const engine = engineRef.current;
          if (!engine) return;
          const key = event.key;
          let described: number | null = null;
          if (key === "ArrowLeft" || key === "ArrowRight") described = engine.step((key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 10 : 1));
          else if (key === "Home") described = engine.step("first");
          else if (key === "End") described = engine.step("last");
          else if (key === "+" || key === "=") engine.zoom(0.8, engine.anchorFor(engine.cross?.i ?? engine.n - 1));
          else if (key === "-" || key === "_") engine.zoom(1.25, engine.anchorFor(engine.cross?.i ?? engine.n - 1));
          else if (key === "0") engine.reset();
          else {
            if (key !== "Escape" || !engine.cross) return;
            engine.setCross(null);
          }
          event.preventDefault();
          if (described !== null && announce.current) announce.current.textContent = engine.describe(described);
        }}
        onFocus={() => {
          const engine = engineRef.current;
          if (!engine || engine.cross || gesture.current.pointers.size) return;
          engine.step("last");
        }}
        onBlur={() => engineRef.current?.setCross(null)}
      >
        <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />
        <span ref={lastTag} className={styles.lastTag} aria-hidden="true">
          {fmt(live)}
        </span>
        <span ref={limitTag} className={styles.limitTag} aria-hidden="true" />
        <span ref={crossPrice} className={styles.crossPrice} aria-hidden="true" />
        <span ref={crossTime} className={styles.crossTime} aria-hidden="true" />
      </div>
      <span id={hintId} className={styles.srOnly}>
        Use left and right arrows to inspect candles, shift to move ten, plus and minus to zoom, and 0 to reset the view.
      </span>
      <span ref={announce} className={styles.srOnly} aria-live="polite" />
    </div>
  );
}

/* ── watchlist ──────────────────────────────────────────────────────────── */

function Sparkline({ points, base, up }: { points: number[]; base: number; up: boolean }) {
  const low = Math.min(base, ...points);
  const range = Math.max(base, ...points) - low || 1;
  const y = (value: number) => (25 - ((value - low) / range) * 22).toFixed(2);
  const path = points.map((value, index) => `${index ? "L" : "M"}${((index / Math.max(1, points.length - 1)) * 64).toFixed(2)} ${y(value)}`).join("");
  return (
    <svg className={styles.spark} data-direction={up ? "up" : "down"} viewBox="0 0 64 28" preserveAspectRatio="none" aria-hidden="true">
      <line className={styles.sparkBase} x1="0" x2={64} y1={y(base)} y2={y(base)} vectorEffect="non-scaling-stroke" />
      <path className={styles.sparkLine} d={path} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

interface WatchRowProps {
  symbol: MarketSymbol;
  price: number;
  points: number[];
  selected: boolean;
  reduced: boolean;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

function WatchRow({ symbol, price, points, selected, reduced, onSelect, onKeyDown }: WatchRowProps) {
  const flash = useRef<HTMLSpanElement>(null);
  const previous = useRef(price);

  // Each price change flashes once, in the direction it moved, as a single opacity fade.
  useEffect(() => {
    const node = flash.current;
    const before = previous.current;
    previous.current = price;
    if (!node || price === before) return;
    node.dataset.direction = price > before ? "up" : "down";
    node.getAnimations().forEach(animation => animation.cancel());
    node.animate(reduced ? [{ opacity: 1 }, { opacity: 1, offset: 0.99 }, { opacity: 0 }] : [{ opacity: 1 }, { opacity: 0 }], {
      duration: duration.considered * (reduced ? 1250 : 1900),
      easing: `cubic-bezier(${motionTokens.ease.standard.join(",")})`,
    });
  }, [price, reduced]);

  const change = price - symbol.prevClose;
  const percent = (change / symbol.prevClose) * 100;
  const up = change >= 0;

  return (
    <li className={styles.watchItem}>
      <button
        type="button"
        className={styles.watchRow}
        data-ticker={symbol.ticker}
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
        onKeyDown={onKeyDown}
        aria-label={`${symbol.ticker}, ${symbol.name}, ${fmt(price)}, ${up ? "up" : "down"} ${Math.abs(percent).toFixed(2)} percent today`}
      >
        {selected && (
          <motion.span className={styles.watchSelected} layoutId="watch-selection" transition={reduced ? { duration: 0 } : spring.morph} aria-hidden="true" />
        )}
        <span className={styles.watchName}>
          <span className={styles.watchTicker}>{symbol.ticker}</span>
          <span className={styles.watchCompany}>{symbol.name}</span>
        </span>
        <Sparkline points={points} base={symbol.prevClose} up={up} />
        <span className={styles.watchQuote}>
          <span className={styles.watchPrice}>
            <span ref={flash} className={styles.flash} aria-hidden="true" />
            {fmt(price)}
          </span>
          <span className={styles.watchChange} data-direction={up ? "up" : "down"}>
            {pct(percent)}
          </span>
        </span>
      </button>
    </li>
  );
}

/* ── order ticket ───────────────────────────────────────────────────────── */

interface TicketProps {
  symbol: MarketSymbol;
  price: number;
  held: number;
  buyingPower: number;
  orders: OrderRecord[];
  side: OrderSide;
  setSide: (side: OrderSide) => void;
  type: OrderType;
  setType: (type: OrderType) => void;
  limit: number;
  setLimit: (limit: number) => void;
  reduced: boolean;
  onSubmit: (order: OrderRequest) => Promise<string>;
  onCancel: (order: OrderRecord) => void;
}

function OrderTicket({ symbol, price, held, buyingPower, orders, side, setSide, type, setType, limit, setLimit, reduced, onSubmit, onCancel }: TicketProps) {
  const [shares, setShares] = useState(10);
  const [outcome, setOutcome] = useState<{ kind: "idle" | "pending" | "done" | "error"; text?: string }>({ kind: "idle" });
  const execution = type === "limit" ? limit : price;
  const cost = shares * execution;
  const problem =
    shares < 1
      ? "Enter at least one share."
      : side === "buy" && cost > buyingPower
        ? `This needs ${usd(cost)}. You have ${usd(buyingPower)} to spend.`
        : side === "sell" && shares > held
          ? held
            ? `You hold ${held} ${symbol.ticker} shares.`
            : `You hold no ${symbol.ticker} shares.`
          : null;
  const titleId = useId();

  useEffect(() => {
    if (outcome.kind !== "done" && outcome.kind !== "error") return;
    const timer = window.setTimeout(() => setOutcome({ kind: "idle" }), 2400);
    return () => window.clearTimeout(timer);
  }, [outcome]);

  const submit = async () => {
    if (problem || outcome.kind === "pending") return;
    setOutcome({ kind: "pending" });
    try {
      setOutcome({ kind: "done", text: await onSubmit({ side, type, ticker: symbol.ticker, shares, price: execution }) });
    } catch {
      setOutcome({ kind: "error", text: "Order not placed. Try again." });
    }
  };

  const label =
    outcome.kind === "done" ? (
      <>
        <Check size={16} strokeWidth={1.75} aria-hidden="true" />
        {outcome.text}
      </>
    ) : (
      `${side === "buy" ? "Buy" : "Sell"} ${shares} ${symbol.ticker}`
    );
  const listed = orders.slice(0, 4);
  const transition = reduced ? { duration: 0 } : spring.smooth;

  return (
    <section className={styles.ticket} aria-labelledby={titleId}>
      <div className={styles.panelHead}>
        <h2 id={titleId} className={styles.panelTitle}>
          Trade {symbol.ticker}
        </h2>
        <span className={styles.panelMeta}>{held ? `${held} shares held` : "No position"}</span>
      </div>
      <div className={styles.ticketBody}>
        <div className={styles.ticketSegs}>
          <SegmentedControl
            label="Side"
            value={side}
            onValueChange={value => setSide(value as OrderSide)}
            options={[
              { value: "buy", label: "Buy" },
              { value: "sell", label: "Sell" },
            ]}
          />
          <SegmentedControl
            label="Order type"
            value={type}
            onValueChange={value => setType(value as OrderType)}
            options={[
              { value: "market", label: "Market" },
              { value: "limit", label: "Limit" },
            ]}
          />
        </div>
        <div className={styles.fields}>
          <NumberField label="Shares" value={shares} onValueChange={setShares} min={0} max={1e5} step={1} largeStep={10} />
          <AnimatePresence initial={false}>
            {type === "limit" && (
              <motion.div
                key="limit"
                className={styles.limitField}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0, transition: reduced ? { duration: 0 } : { duration: duration.exit, ease: [...motionTokens.ease.exit] as [number, number, number, number] } }}
                transition={transition}
              >
                <div className={styles.limitInner}>
                  <NumberField label="Limit price" value={limit} onValueChange={setLimit} min={0.01} max={1e5} step={0.01} largeStep={1} prefix="$" limitHint={false} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <dl className={styles.summary}>
          <div className={styles.summaryRow}>
            <dt>Market price</dt>
            <dd className={styles.num}>{usd(price)}</dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>{side === "buy" ? "Estimated cost" : "Estimated credit"}</dt>
            <dd className={styles.num}>{usd(cost)}</dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>Buying power</dt>
            <dd className={styles.num}>{usd(buyingPower)}</dd>
          </div>
        </dl>
        <p className={styles.problem} role="status" data-visible={problem || outcome.kind === "error" ? "" : undefined}>
          {outcome.kind === "error" ? outcome.text : problem ?? "\u00a0"}
        </p>
        <Button className={styles.submit} size="lg" loading={outcome.kind === "pending"} disabled={Boolean(problem) && outcome.kind !== "pending"} onClick={submit}>
          {label}
        </Button>
        <p className={styles.simulated}>Paper trading. Prices and orders are simulated.</p>
      </div>
      <div className={styles.orders}>
        <h3 className={styles.ordersTitle}>Orders</h3>
        <ul className={styles.orderList}>
          <AnimatePresence initial={false}>
            {listed.map(order => (
              <motion.li
                key={order.id}
                className={styles.orderItem}
                layout={reduced ? false : "position"}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0, transition: { duration: reduced ? 0 : duration.exit } }}
                transition={transition}
              >
                <div className={styles.order} data-status={order.status}>
                  <span className={styles.orderMain}>
                    <span className={styles.orderTitle}>
                      {order.side === "buy" ? "Buy" : "Sell"} {order.shares} {order.ticker}
                    </span>
                    <span className={styles.orderMeta}>
                      {order.type === "limit" ? "Limit" : "Market"} at {usd(order.price)}, {order.time}
                    </span>
                  </span>
                  <span className={styles.orderStatus} data-status={order.status}>
                    {order.status === "filled" ? "Filled" : order.status === "working" ? "Working" : "Canceled"}
                  </span>
                  <span className={styles.orderAction}>
                    {order.status === "working" && (
                      <button type="button" className={styles.iconButton} onClick={() => onCancel(order)} aria-label={`Cancel ${order.side} ${order.shares} ${order.ticker} at ${usd(order.price)}`}>
                        <X size={16} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    )}
                  </span>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </section>
  );
}

/* ── terminal ───────────────────────────────────────────────────────────── */

/** The clock a new order is stamped with: market hours, advancing a minute every minute since mount. */
const sessionClock = (start: number) => {
  const minute = Math.min(960, 845 + Math.floor((Date.now() - start) / 60000));
  return `${Math.floor(minute / 60)}:${String(minute % 60).padStart(2, "0")}`;
};

export function MarketTerminal({
  symbols = marketSymbols,
  holdings = marketHoldings,
  buyingPower: startingPower = 24860.35,
  orders: startingOrders = marketOrders,
  defaultTicker,
  defaultRange = "6M",
  defaultAverages = ["ma20", "ma50"],
  live: streaming = true,
  tickInterval = 1200,
  onPlaceOrder,
  onCancelOrder,
  className,
}: MarketTerminalProps) {
  // The sample ticks are random, so they only run after the client takes over.
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const reduced = Boolean(useReducedMotion()) && mounted;

  const [ticker, setTicker] = useState(defaultTicker ?? symbols[0]?.ticker ?? "");
  const [rangeId, setRangeId] = useState<RangeId>(defaultRange);
  const [averages, setAverages] = useState<AverageId[]>(defaultAverages);
  const [paused, setPaused] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>(() => Object.fromEntries(symbols.map(symbol => [symbol.ticker, symbol.price])));
  const [tick, setTick] = useState(0);
  const [positions, setPositions] = useState<Record<string, number>>(() => Object.fromEntries(holdings.map(holding => [holding.ticker, holding.shares])));
  const [buyingPower, setBuyingPower] = useState(startingPower);
  const [orders, setOrders] = useState(startingOrders);
  const [side, setSide] = useState<OrderSide>("buy");
  const [type, setType] = useState<OrderType>("market");
  const [limitByTicker, setLimitByTicker] = useState<Record<string, number>>({});
  const zoomRef = useRef<ZoomHandle | null>(null);
  const titleId = useId();
  const sessionStart = useRef(0);

  useEffect(() => {
    sessionStart.current = Date.now();
  }, []);

  const symbol = symbols.find(item => item.ticker === ticker) ?? symbols[0];
  const range = rangeById(rangeId);
  const price = prices[symbol.ticker] ?? symbol.price;
  const [series] = useState(() => new SeriesStore());
  const bars = series.get(symbol, range);
  const todayBars = series.get(symbol, rangeById("1D")).filter(bar => bar.today);
  const open = todayBars[0]?.o ?? symbol.prevClose;
  const high = Math.max(...todayBars.map(bar => bar.h));
  const low = Math.min(...todayBars.map(bar => bar.l));
  const sessionVolume = todayBars.reduce((sum, bar) => sum + bar.v, 0);
  const live = streaming && !paused;

  const pricesRef = useRef(prices);
  const tickerRef = useRef(ticker);
  const ordersRef = useRef(orders);
  useEffect(() => {
    pricesRef.current = prices;
    tickerRef.current = ticker;
    ordersRef.current = orders;
  });

  // Simulated ticks: a small random walk on every cached range's live candle, then working limit orders fill when crossed.
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const next = { ...pricesRef.current };
      for (const item of symbols) {
        if (item.ticker !== tickerRef.current && Math.random() > 0.45) continue;
        const current = next[item.ticker] ?? item.price;
        const drift = 0.055 * item.vol * gauss() - 0.06 * Math.log(current / item.price);
        const moved = Math.max(0.01, Math.round(current * Math.exp(drift) * 100) / 100);
        if (moved === current) continue;
        next[item.ticker] = moved;
        const added = Math.round((item.avgVolume / 78) * 0.04 * (0.5 + Math.random()));
        for (const spec of marketRanges) {
          const cache = series.peek(item.ticker, spec.id);
          const last = cache?.[cache.length - 1];
          if (!last) continue;
          last.c = moved;
          last.h = Math.max(last.h, moved);
          last.l = Math.min(last.l, moved);
          last.v += added;
        }
      }
      pricesRef.current = next;
      setPrices(next);
      setTick(value => value + 1);

      const crossed = ordersRef.current.filter(
        order => order.status === "working" && next[order.ticker] !== undefined && (order.side === "buy" ? next[order.ticker] <= order.price : next[order.ticker] >= order.price),
      );
      if (!crossed.length) return;
      const time = sessionClock(sessionStart.current);
      setOrders(current => current.map(order => (crossed.some(item => item.id === order.id) ? { ...order, status: "filled", time } : order)));
      for (const order of crossed) {
        setPositions(current => ({ ...current, [order.ticker]: (current[order.ticker] ?? 0) + (order.side === "buy" ? order.shares : -order.shares) }));
        setBuyingPower(current => current + (order.side === "buy" ? -1 : 1) * order.shares * order.price);
      }
    }, tickInterval);
    return () => window.clearInterval(timer);
  }, [live, symbols, tickInterval, series]);

  /** A limit opens one percent away from the market, on the side that would not fill at once. */
  const defaultLimit = (tickerToPrice: string, orderSide: OrderSide, source: Record<string, number> = prices) =>
    Math.round((source[tickerToPrice] ?? price) * (orderSide === "buy" ? 0.99 : 1.01) * 100) / 100;
  const limit = limitByTicker[symbol.ticker] ?? defaultLimit(symbol.ticker, side);
  const rememberLimit = (forTicker: string, orderSide: OrderSide) => setLimitByTicker(current => ({ ...current, [forTicker]: defaultLimit(forTicker, orderSide, pricesRef.current) }));

  const placeOrder = async (order: OrderRequest) => {
    await Promise.all([onPlaceOrder?.(order), new Promise(resolve => window.setTimeout(resolve, 650))]);
    const market = pricesRef.current[order.ticker] ?? order.price;
    const fills = order.type === "market" || (order.side === "buy" ? market <= order.price : market >= order.price);
    const filled = order.type === "market" ? market : fills ? (order.side === "buy" ? Math.min(order.price, market) : Math.max(order.price, market)) : order.price;
    const record: OrderRecord = {
      id: `o-${Date.now()}`,
      side: order.side,
      type: order.type,
      ticker: order.ticker,
      shares: order.shares,
      price: round2(filled),
      status: fills ? "filled" : "working",
      time: sessionClock(sessionStart.current),
    };
    setOrders(current => [record, ...current]);
    if (!fills) return "Order placed";
    setPositions(current => ({ ...current, [order.ticker]: (current[order.ticker] ?? 0) + (order.side === "buy" ? order.shares : -order.shares) }));
    setBuyingPower(current => current + (order.side === "buy" ? -1 : 1) * order.shares * record.price);
    return `Filled at ${usd(record.price)}`;
  };

  const listRef = useRef<HTMLUListElement>(null);
  const onWatchKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const rows = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-ticker]") ?? [])];
    const index = rows.indexOf(event.currentTarget);
    const target = event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : clamp(index + (event.key === "ArrowDown" ? 1 : -1), 0, rows.length - 1);
    event.preventDefault();
    rows[target]?.focus();
  };

  const change = price - symbol.prevClose;
  const changePercent = (change / symbol.prevClose) * 100;
  const up = change >= 0;
  const DirectionIcon = up ? ArrowUpRight : ArrowDownRight;

  // One sparkline per symbol, from the same five minute bars the chart folds, refreshed as ticks land.
  const sparklines = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const item of symbols) map[item.ticker] = series.get(item, rangeById("1D")).filter(bar => bar.today).map(bar => bar.c);
    return map;
  }, [symbols, series, tick]);

  return (
    <div className={`${styles.root} ${className ?? ""}`}>
      <div className={styles.shell}>
        <section className={styles.main} aria-labelledby={titleId}>
          <header className={styles.header}>
            <div className={styles.identity}>
              <h1 id={titleId} className={styles.title}>
                <span className={styles.ticker}>{symbol.ticker}</span>
                <span className={styles.company}>{symbol.name}</span>
              </h1>
              <p className={styles.exchange}>{symbol.exchange}, USD</p>
            </div>
            <div className={styles.quote}>
              <span className={styles.price}>
                <AnimatedCounter value={price} prefix="$" decimals={2} />
              </span>
              <span className={styles.change} data-direction={up ? "up" : "down"}>
                <DirectionIcon size={16} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.num}>
                  {`${change >= 0 ? "+" : "−"}${numberFormat.format(Math.abs(change))}`} ({pct(changePercent)})
                </span>
                <span className={styles.changeLabel}>today</span>
              </span>
            </div>
            <dl className={styles.stats}>
              <div className={styles.stat}>
                <dt>Open</dt>
                <dd className={styles.num}>{fmt(open)}</dd>
              </div>
              <div className={styles.stat}>
                <dt>High</dt>
                <dd className={styles.num}>{fmt(high)}</dd>
              </div>
              <div className={styles.stat}>
                <dt>Low</dt>
                <dd className={styles.num}>{fmt(low)}</dd>
              </div>
              <div className={styles.stat}>
                <dt>Volume</dt>
                <dd className={styles.num}>{volume(sessionVolume)}</dd>
              </div>
            </dl>
            <button
              type="button"
              className={styles.liveButton}
              aria-pressed={!live}
              onClick={() => setPaused(value => !value)}
              disabled={!streaming}
              aria-label={live ? "Pause live prices" : "Resume live prices"}
            >
              <span className={styles.liveDot} data-live={live ? "" : undefined} aria-hidden="true" />
              <span className={styles.liveText}>{live ? "Live" : "Paused"}</span>
              {live ? <Pause size={16} strokeWidth={1.75} aria-hidden="true" /> : <Play size={16} strokeWidth={1.75} aria-hidden="true" />}
            </button>
          </header>
          <div className={styles.toolbar}>
            <div className={styles.seg}>
              <SegmentedControl label="Time range" value={rangeId} onValueChange={value => setRangeId(value as RangeId)} options={marketRanges.map(spec => ({ value: spec.id, label: spec.label }))} />
            </div>
            <div className={styles.tools}>
              <div className={styles.toggles} role="group" aria-label="Moving averages">
                {movingAverages.map(average => (
                  <button
                    key={average.id}
                    type="button"
                    className={styles.toggle}
                    data-average={average.id}
                    aria-pressed={averages.includes(average.id)}
                    onClick={() => setAverages(current => (current.includes(average.id) ? current.filter(item => item !== average.id) : [...current, average.id]))}
                  >
                    <span className={styles.swatch} aria-hidden="true" />
                    {average.label}
                  </button>
                ))}
              </div>
              <div className={styles.zoom} role="group" aria-label="Zoom">
                <button type="button" className={styles.iconButton} onClick={() => zoomRef.current?.zoom(0.7)} aria-label="Zoom in">
                  <ZoomIn size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button type="button" className={styles.iconButton} onClick={() => zoomRef.current?.zoom(1.45)} aria-label="Zoom out">
                  <ZoomOut size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button type="button" className={styles.iconButton} onClick={() => zoomRef.current?.reset()} aria-label="Reset view">
                  <Maximize2 size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
          <TerminalChart bars={bars} seriesId={seriesKey(symbol.ticker, range.id)} range={range} symbol={symbol} live={price} averages={averages} limit={type === "limit" ? limit : null} reduced={reduced} zoomRef={zoomRef} />
        </section>
        <aside className={styles.side} aria-label="Watchlist and order ticket">
          <section className={styles.watch} aria-labelledby={`${titleId}-watch`}>
            <div className={styles.panelHead}>
              <h2 id={`${titleId}-watch`} className={styles.panelTitle}>
                Watchlist
              </h2>
              <span className={styles.panelMeta}>{symbols.length} symbols</span>
            </div>
            <ul ref={listRef} className={styles.watchList}>
              {symbols.map(item => (
                <WatchRow
                  key={item.ticker}
                  symbol={item}
                  price={prices[item.ticker] ?? item.price}
                  points={sparklines[item.ticker] ?? []}
                  selected={item.ticker === symbol.ticker}
                  reduced={reduced}
                  onSelect={() => {
                    setTicker(item.ticker);
                    if (type === "limit" && limitByTicker[item.ticker] === undefined) rememberLimit(item.ticker, side);
                  }}
                  onKeyDown={onWatchKeyDown}
                />
              ))}
            </ul>
          </section>
          <OrderTicket
            symbol={symbol}
            price={price}
            held={positions[symbol.ticker] ?? 0}
            buyingPower={buyingPower}
            orders={orders}
            side={side}
            setSide={value => {
              setSide(value);
              rememberLimit(symbol.ticker, value);
            }}
            type={type}
            setType={value => {
              setType(value);
              if (value === "limit" && limitByTicker[symbol.ticker] === undefined) rememberLimit(symbol.ticker, side);
            }}
            limit={limit}
            setLimit={value => setLimitByTicker(current => ({ ...current, [symbol.ticker]: value }))}
            reduced={reduced}
            onSubmit={placeOrder}
            onCancel={order => {
              onCancelOrder?.(order);
              setOrders(current => current.map(item => (item.id === order.id ? { ...item, status: "canceled" } : item)));
            }}
          />
        </aside>
      </div>
    </div>
  );
}

export default MarketTerminal;
