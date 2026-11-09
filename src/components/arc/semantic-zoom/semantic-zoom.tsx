"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { ChevronRight, Maximize2, Minus, Pause, Play, Plus } from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { motionTokens } from "../motion-tokens";
import {
  HEALTH_LABEL,
  KIND_LABEL,
  NODES,
  PEOPLE,
  PROJECTS,
  PROJECT_NODES,
  STATUS_LABEL,
  TASKS,
  TASK_NODES,
  TEAM_NODES,
  TEAMS_LIST,
  type MapNode,
  type Project,
  type Status,
  formatDay,
} from "./zoom-data";
import styles from "./semantic-zoom.module.css";

/* --------------------------------------------------------------------------------------------
 * Spring + easing primitives. The camera, the pan axis, the zoom wheel and the hover fades all
 * run on the same critically damped integrators the reference uses, so the flight curves match.
 * ------------------------------------------------------------------------------------------ */

const { spring, duration, ease } = motionTokens;

const SPRING_RESPONSIVE = { stiffness: spring.responsive.stiffness, damping: spring.responsive.damping };
const SPRING_GENTLE = { stiffness: spring.gentle.stiffness, damping: spring.gentle.damping };

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Underdamped pop used by the checklist tick and the digit roll. */
const overshoot = (t: number): number => {
  const p = clamp(t, 0, 1) - 1;
  return 1 + 2.9 * p * p * p + 1.9 * p * p;
};

/** Rubber band: how far past a limit a pointer can drag. */
const bandOffset = (distance: number, limit: number): number =>
  (1 - 1 / ((0.55 * distance) / limit + 1)) * limit;

/** Inverse of `bandOffset`, used to resume a drag from a banded position. */
const unbandOffset = (distance: number, limit: number): number =>
  distance >= 0.98 * limit ? 90 * limit : ((1 / (1 - distance / limit) - 1) * limit) / 0.55;

/** Cubic-bezier timing function solved with Newton iterations, matching motion's `ease.inOut`. */
const bezier = ([x1, y1, x2, y2]: readonly number[]): ((t: number) => number) => {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number): number => ((ax * t + bx) * t + cx) * t;
  const sampleDX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx;
  return (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let guess = t;
    for (let i = 0; i < 8; i += 1) {
      const error = sampleX(guess) - t;
      const slope = sampleDX(guess);
      if (Math.abs(error) < 1e-6 || Math.abs(slope) < 1e-6) break;
      guess -= error / slope;
    }
    if (guess < 0 || guess > 1 || Math.abs(sampleX(guess) - t) > 1e-4) {
      let low = 0;
      let high = 1;
      guess = t;
      for (let i = 0; i < 30; i += 1) {
        if (sampleX(guess) < t) low = guess;
        else high = guess;
        guess = (low + high) / 2;
      }
    }
    return ((ay * guess + by) * guess + cy) * guess;
  };
};

const easeInOut = bezier(ease.inOut);

/* --------------------------------------------------------------------------------------------
 * The model. Checklist state is the only mutable part of the data: every percentage, badge and
 * canvas colour is derived from it, so a single toggle repaints the map.
 * ------------------------------------------------------------------------------------------ */

export class MapModel {
  readonly checks: boolean[][];

  constructor() {
    this.checks = TASKS.map((task) => [...task.baseChecks]);
  }

  status(id: number): Status {
    const task = TASKS[id];
    return this.checks[id].every(Boolean) ? "done" : task.base === "done" ? "review" : task.base;
  }

  completion(id: number): number {
    const checks = this.checks[id];
    return this.status(id) === "done" ? 1 : (checks.filter(Boolean).length / checks.length) * 0.8;
  }

  toggle(id: number, index: number): void {
    this.checks[id][index] = !this.checks[id][index];
  }

  done(id: number): number {
    return this.checks[id].filter(Boolean).length;
  }

  describe(id: number): string {
    const task = TASKS[id];
    const project = PROJECTS[task.project];
    const team = TEAMS_LIST[project.team];
    const owner = PEOPLE[task.assignee].first;
    const reviewer =
      PEOPLE[
        task.assignee !== project.lead ? project.lead : team.lead !== task.assignee ? team.lead : team.members[1]
      ].first;
    const status = this.status(id);
    const sentence =
      status === "done"
        ? `Done. ${owner} shipped it ${task.due < 0 ? `on ${formatDay(task.due)}` : "today"}.`
        : status === "review"
          ? `${owner} opened it for review by ${reviewer}.`
          : status === "progress"
            ? `${owner} is on it and plans to finish by ${formatDay(task.due)}.`
            : status === "blocked"
              ? `Blocked by ${project.blocker || "an open dependency"}.`
              : `Not started. ${owner} picks it up before ${formatDay(task.due)}.`;
    return `${sentence} ${project.name}: ${project.brief}`;
  }

  tasksOf(node: number): number[] {
    const target = NODES[node];
    return target.kind === 3
      ? [target.ref]
      : target.kind === 2
        ? PROJECTS[target.ref].tasks
        : target.kind === 1
          ? TEAMS_LIST[target.ref].projects.flatMap((project) => PROJECTS[project].tasks)
          : target.kind === 4
            ? this.tasksOf(target.parent).filter((task) => TASKS[task].assignee === target.ref)
            : TASKS.map((task) => task.id);
  }

  stats(node: number): NodeStats {
    const ids = this.tasksOf(node);
    let points = 0;
    let earned = 0;
    let open = 0;
    let blocked = 0;
    let nextDue = Number.POSITIVE_INFINITY;
    for (const id of ids) {
      const status = this.status(id);
      const weight = TASKS[id].points;
      points += weight;
      earned += weight * this.completion(id);
      if (status !== "done") {
        open += 1;
        nextDue = Math.min(nextDue, TASKS[id].due);
      }
      if (status === "blocked") blocked += 1;
    }
    const target = NODES[node];
    const people =
      target.kind === 0
        ? PEOPLE.map((_, index) => index)
        : target.kind === 1
          ? TEAMS_LIST[target.ref].members
          : target.kind === 2
            ? PROJECTS[target.ref].people
            : target.kind === 3
              ? [TASKS[target.ref].assignee]
              : [target.ref];
    const projects =
      target.kind === 0
        ? PROJECTS
        : target.kind === 1
          ? TEAMS_LIST[target.ref].projects.map((project) => PROJECTS[project])
          : [];
    return {
      progress: points ? earned / points : 0,
      open,
      blocked,
      total: ids.length,
      nextDue: Number.isFinite(nextDue) ? nextDue : null,
      people,
      projects: projects.length,
      atRisk: projects.filter((project) => project.health !== "on-track").length,
    };
  }
}

export interface NodeStats {
  progress: number;
  open: number;
  blocked: number;
  total: number;
  nextDue: number | null;
  people: number[];
  projects: number;
  atRisk: number;
}

/** Ancestor chain from the company node down to `node`. */
const pathTo = (node: number): number[] => {
  const chain: number[] = [];
  for (let current = node; current >= 0; current = NODES[current].parent) chain.unshift(current);
  return chain;
};

/* --------------------------------------------------------------------------------------------
 * The canvas engine. Everything the map shows — the dotted grid, team panels, project cards,
 * task tiles with their checklists, the minimap and the hover card placement — is painted here,
 * one frame per interaction. React only owns the chrome around it.
 * ------------------------------------------------------------------------------------------ */

export interface Palette {
  surface: string;
  muted: string;
  fg: string;
  secondary: string;
  faint: string;
  border: string;
  subtle: string;
  strong: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  body: string;
  display: string;
}

interface EngineHooks {
  hover: (node: number) => void;
  path: (path: number[]) => void;
  zoomed: (zoomed: boolean) => void;
  interact: () => void;
  tour: (on: boolean) => void;
  changed: () => void;
  announce: (text: string) => void;
}

export interface HoverStore {
  get: () => number;
  set: (node: number) => void;
  subscribe: (listener: () => void) => () => void;
}

interface DragState {
  id: number;
  sx: number;
  sy: number;
  rx: number;
  ry: number;
  moved: boolean;
  caught: boolean;
  samples: { x: number; y: number; t: number }[];
}

interface PinchState {
  d0: number;
  s0: number;
  wx: number;
  wy: number;
  c: { x: number; y: number };
}

interface Flight {
  at: (t: number) => [number, number, number];
  t0: number;
  dur: number;
  bump: number;
  end: [number, number, number];
  to: number;
  done?: () => void;
}

interface PickResult {
  node: number;
  item: number;
}

interface HitItem {
  task: number;
  item: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Insets {
  top: number;
  bottom: number;
  side: number;
}

const FALLBACK_PALETTE: Palette = {
  surface: "#fff",
  muted: "#f6f6f6",
  fg: "#111",
  secondary: "#555",
  faint: "#777",
  border: "#e8e8e8",
  subtle: "#f1f1f1",
  strong: "#c8c8c8",
  accent: "#333",
  success: "#1f8a4c",
  warning: "#b7791f",
  danger: "#c53030",
  body: "sans-serif",
  display: "sans-serif",
};

export class MapEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly mini: HTMLCanvasElement | null;
  private readonly stage: HTMLElement;
  private readonly model: MapModel;
  private readonly hooks: EngineHooks;
  private pal: Palette = FALLBACK_PALETTE;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private mw = 0;
  private mh = 0;
  private cx = 824;
  private cy = 455;
  private s = 0.5;
  private zt = Math.log(0.5);
  private zv = 0;
  private anchor: { x: number; y: number } | null = null;
  private lastWheel = 0;
  private vx = 0;
  private vy = 0;
  private panTarget: { x: number; y: number } | null = null;
  private pvx = 0;
  private pvy = 0;
  private flight: Flight | null = null;
  private drag: DragState | null = null;
  private pinch: PinchState | null = null;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private mouse: { x: number; y: number } | null = null;
  private raf = 0;
  private last = 0;
  private visible = false;
  private hidden = false;
  private reduce = false;
  private sized = false;
  private introT0 = -1;
  private introDone = false;
  private view = 0;
  private hoverNode = -1;
  private hoverItem = -1;
  private cursor = -1;
  private cursorItem = -1;
  private readonly hl = new Map<number, number>();
  private readonly dim: Float32Array;
  private spot = 0;
  private spotPerson = -1;
  private spotProject = -1;
  private readonly shown: Float32Array;
  private readonly statusT: Float64Array;
  private readonly itemT: Float64Array[];
  private readonly cache = new Map<number, NodeStats>();
  private items: HitItem[] = [];
  private readonly faces: (HTMLCanvasElement | null)[];
  private readonly widths = new Map<string, number>();
  private readonly prefixes = new Map<string, number[]>();
  private font = "";
  private panel: HTMLElement | null = null;
  private pw = 248;
  private ph = 160;
  private px = 0;
  private py = 0;
  private panelOn = false;
  private readout: HTMLElement | null = null;
  private readText = "";
  private zoomedFlag = false;
  private touring = false;
  private tourStep = 0;
  private tourTimer = 0;
  private dead = false;
  private lastAnim = -1e9;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly mctx: CanvasRenderingContext2D | null;
  private readonly hasSpacing: boolean;
  private readonly frame: (time: number) => void;

  constructor(
    canvas: HTMLCanvasElement,
    mini: HTMLCanvasElement | null,
    stage: HTMLElement,
    model: MapModel,
    hooks: EngineHooks,
  ) {
    this.canvas = canvas;
    this.mini = mini;
    this.stage = stage;
    this.model = model;
    this.hooks = hooks;
    this.dim = new Float32Array(NODES.length).fill(1);
    this.shown = new Float32Array(NODES.length);
    this.statusT = new Float64Array(TASKS.length).fill(-1e9);
    this.itemT = TASKS.map((task) => new Float64Array(task.checklist.length).fill(-1e9));
    this.faces = PEOPLE.map(() => null);

    this.frame = (time: number): void => {
      this.raf = 0;
      const delta = time - this.last;
      this.last = time;
      const alive = this.step(delta > 0 && delta < 100 ? delta / 1e3 : 1 / 60, time);
      this.draw(time);
      if (alive) this.wake();
    };

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("semantic-zoom: 2D canvas context unavailable");
    this.ctx = ctx;
    this.mctx = mini ? mini.getContext("2d") : null;
    this.hasSpacing = "letterSpacing" in this.ctx;

    for (const node of [0, ...TEAM_NODES, ...PROJECT_NODES]) this.shown[node] = this.stat(node).progress;

    PEOPLE.forEach((person, index) => {
      if (!person.portrait) return;
      const image = new window.Image();
      image.decoding = "async";
      image.onload = (): void => {
        if (this.dead) return;
        const face = document.createElement("canvas");
        face.width = 160;
        face.height = 160;
        const faceCtx = face.getContext("2d");
        if (!faceCtx) return;
        const side = 0.62 * image.naturalWidth;
        const sx = (image.naturalWidth - side) / 2;
        const sy = Math.max(0, 0.3 * image.naturalHeight - side / 2);
        faceCtx.beginPath();
        faceCtx.arc(80, 80, 80, 0, 2 * Math.PI);
        faceCtx.clip();
        faceCtx.drawImage(image, sx, sy, side, side, 0, 0, 160, 160);
        this.faces[index] = face;
        this.wake();
      };
      image.src = person.portrait;
    });

    document.fonts?.ready.then(() => {
      if (this.dead) return;
      this.widths.clear();
      this.prefixes.clear();
      this.font = "";
      this.wake();
    });
  }

  stat(node: number): NodeStats {
    const cached = this.cache.get(node);
    if (cached) return cached;
    const stats = this.model.stats(node);
    this.cache.set(node, stats);
    return stats;
  }

  destroy(): void {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.tourTimer);
  }

  setPalette(palette: Palette): void {
    if (palette.body !== this.pal.body || palette.display !== this.pal.display) {
      this.widths.clear();
      this.prefixes.clear();
    }
    this.pal = palette;
    this.font = "";
    this.wake();
  }

  setReduced(reduce: boolean): void {
    this.reduce = reduce;
    if (reduce && this.flight) this.finishFlight();
    this.wake();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible) this.stopTour();
    this.maybeIntro();
    this.wake();
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    if (hidden) this.stopTour();
    this.wake();
  }

  attachPanel(panel: HTMLElement | null): void {
    this.panel = panel;
    if (panel) this.measurePanel();
  }

  measurePanel(): void {
    if (!this.panel) return;
    this.pw = this.panel.offsetWidth;
    this.ph = this.panel.offsetHeight;
    this.wake();
  }

  attachReadout(readout: HTMLElement | null): void {
    this.readout = readout;
    this.readText = "";
    this.wake();
  }

  resize(width: number, height: number, dpr: number): void {
    if (width < 2 || height < 2) return;
    const first = !this.sized;
    const previousFit = this.sized ? this.fitS : 0;
    this.W = width;
    this.H = height;
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    if (this.mini) {
      this.mw = this.mini.clientWidth;
      this.mh = this.mini.clientHeight;
      this.mini.width = Math.round(this.mw * dpr);
      this.mini.height = Math.round(this.mh * dpr);
    }
    this.font = "";
    this.sized = true;

    if (first || this.view === 0) {
      const [x, y] = this.centerFor(0, this.fitS);
      if (!this.flight || first) {
        this.cx = x;
        this.cy = y;
        this.s = this.fitS;
        this.zt = Math.log(this.s);
      }
    } else if (previousFit) {
      this.s = clamp(this.s * (this.fitS / previousFit), this.fitS, this.maxS);
      this.zt = Math.log(this.s);
    }

    this.maybeIntro();
    this.wake();
  }

  private maybeIntro(): void {
    if (this.introDone || !this.visible || !this.sized) return;
    this.introDone = true;
    if (this.reduce) return;
    this.introT0 = performance.now();
    this.s = 0.72 * this.fitS;
    this.zt = Math.log(this.s);
    const [x, y] = this.centerFor(0, this.s);
    this.cx = x;
    this.cy = y;
    this.flyTo(0, undefined, 1500);
  }

  private wake(): void {
    if (this.raf || this.dead || !this.visible || this.hidden || !this.sized) return;
    this.raf = requestAnimationFrame(this.frame);
  }

  private get insets(): Insets {
    const narrow = this.W < 560;
    return { top: narrow ? 56 : 64, bottom: narrow ? 56 : 60, side: narrow ? 12 : 24 };
  }

  private get fitS(): number {
    const { top, bottom, side } = this.insets;
    return Math.min((this.W - 2 * side) / 1648, (this.H - top - bottom) / 910);
  }

  private get maxS(): number {
    return 1.7 * this.fitFor(NODES[TASK_NODES[0]]);
  }

  private fitFor(node: MapNode): number {
    if (node.kind === 0) return this.fitS;
    const { top, bottom, side } = this.insets;
    return (
      Math.min((this.W - 2 * side) / node.w, (this.H - top - bottom) / node.h) * (node.kind === 3 ? 0.96 : 0.97)
    );
  }

  private centerFor(node: number, scale: number): [number, number] {
    const target = NODES[node];
    const { top, bottom } = this.insets;
    const x = target.x + target.w / 2;
    const y = target.y + target.h / 2 - (top - bottom) / 2 / scale;
    const [minX, maxX] = this.range(scale, 0);
    const [minY, maxY] = this.range(scale, 1);
    return [clamp(x, minX, maxX), clamp(y, minY, maxY)];
  }

  private range(scale: number, axis: 0 | 1): [number, number] {
    const { top, bottom, side } = this.insets;
    if (axis === 0) {
      const margin = (this.W / 2 - side) / scale;
      return 2 * margin >= 1648 ? [824, 824] : [margin, 1648 - margin];
    }
    const min = (this.H / 2 - top) / scale;
    const max = 910 - (this.H / 2 - bottom) / scale;
    if (min > max) {
      const fixed = 455 - (top - bottom) / 2 / scale;
      return [fixed, fixed];
    }
    return [min, max];
  }

  private band(value: number, [min, max]: [number, number], limit: number): number {
    const scale = this.s;
    return value < min
      ? min - bandOffset((min - value) * scale, limit) / scale
      : value > max
        ? max + bandOffset((value - max) * scale, limit) / scale
        : value;
  }

  private unband(value: number, [min, max]: [number, number], limit: number): number {
    const scale = this.s;
    return value < min
      ? min - unbandOffset((min - value) * scale, limit) / scale
      : value > max
        ? max + unbandOffset((value - max) * scale, limit) / scale
        : value;
  }

  private toWorld(point: { x: number; y: number }): { x: number; y: number } {
    return {
      x: this.cx + (point.x - this.W / 2) / this.s,
      y: this.cy + (point.y - this.H / 2) / this.s,
    };
  }

  private screenRect(node: MapNode): { x: number; y: number; w: number; h: number } {
    const scale = this.s;
    const ox = this.W / 2 - this.cx * scale;
    const oy = this.H / 2 - this.cy * scale;
    return { x: node.x * scale + ox, y: node.y * scale + oy, w: node.w * scale, h: node.h * scale };
  }

  flyTo(node: number, done?: () => void, fixedDuration?: number): void {
    if (!this.sized) return;
    const target = NODES[node];
    const scale = clamp(node === 0 ? this.fitS : this.fitFor(target), this.fitS, this.maxS);
    const [x, y] = this.centerFor(node, scale);
    this.vx = 0;
    this.vy = 0;
    this.zv = 0;
    this.anchor = null;
    this.panTarget = null;
    this.setHover(-1, -1);
    if (this.cursor >= 0 && NODES[this.cursor].parent !== node) this.cursor = -1;
    this.cursorItem = -1;

    const end: [number, number, number] = [x, y, this.W / scale];
    const landOn = target.kind === 4 ? target.parent : node;
    const from: [number, number, number] = [this.cx, this.cy, this.W / this.s];

    const alreadyThere =
      Math.abs(x - this.cx) * scale < 0.5 &&
      Math.abs(y - this.cy) * scale < 0.5 &&
      Math.abs(Math.log(this.s / scale)) < 0.002;
    if (this.reduce || alreadyThere) {
      this.flight = { at: () => end, t0: 0, dur: 0, bump: 0, end, to: landOn, done };
      this.finishFlight();
      return;
    }

    const path = planFlight(from, end);
    const milliseconds = fixedDuration ?? clamp(420 + 400 * path.S, 560, 1500);
    const bump =
      end[2] < 0.95 * from[2] && fixedDuration === undefined
        ? 0.05 + 0.035 * Math.min(2, Math.log(from[2] / end[2]))
        : 0;
    this.flight = { at: path.at, t0: performance.now(), dur: milliseconds, bump, end, to: landOn, done };
    this.wake();
  }

  private finishFlight(): void {
    const flight = this.flight;
    if (!flight) return;
    this.flight = null;
    this.cx = flight.end[0];
    this.cy = flight.end[1];
    this.s = this.W / flight.end[2];
    this.zt = Math.log(this.s);
    this.zv = 0;
    this.wake();
    flight.done?.();
  }

  private halt(): void {
    this.flight = null;
    this.panTarget = null;
    this.anchor = null;
    this.vx = 0;
    this.vy = 0;
    this.zv = 0;
    this.zt = Math.log(this.s);
  }

  zoomBy(factor: number): void {
    this.stopTour();
    this.hooks.interact();
    if (this.flight) this.halt();
    const { top, bottom } = this.insets;
    this.anchor = { x: this.W / 2, y: (top + this.H - bottom) / 2 };
    const low = Math.log(this.fitS);
    const high = Math.log(this.maxS);
    const next = this.zt + Math.log(factor);
    this.zt = next > high + 0.01 ? high + 0.14 : next < low - 0.01 ? low - 0.14 : clamp(next, low, high);
    this.lastWheel = performance.now();
    if (this.reduce) this.applyZoom(clamp(this.zt, low, high));
    this.wake();
  }

  fitAll(): void {
    this.stopTour();
    this.hooks.interact();
    this.flyTo(0);
  }

  flyOut(): void {
    this.stopTour();
    this.hooks.interact();
    if (this.cursor >= 0 || this.cursorItem >= 0) {
      this.cursor = -1;
      this.cursorItem = -1;
      this.setHover(-1, -1);
      this.wake();
      return;
    }
    if (this.view > 0) this.flyTo(NODES[this.view].parent);
  }

  goTo(node: number): void {
    this.stopTour();
    this.hooks.interact();
    this.flyTo(node);
  }

  private applyZoom(target: number): void {
    const before = this.s;
    const after = Math.exp(target);
    if (this.anchor) {
      const dx = this.anchor.x - this.W / 2;
      const dy = this.anchor.y - this.H / 2;
      this.cx += dx / before - dx / after;
      this.cy += dy / before - dy / after;
    }
    this.s = after;
  }

  private step(delta: number, time: number): boolean {
    let alive = false;
    const flight = this.flight;

    if (flight) {
      const t = clamp((time - flight.t0) / flight.dur, 0, 1);
      if (t >= 1) {
        this.finishFlight();
      } else {
        const [x, y, width] = flight.at(easeInOut(t));
        this.cx = x;
        this.cy = y;
        this.s = this.W / (width * Math.exp(flight.bump * Math.sin(Math.PI * t)));
        alive = true;
      }
    } else if (!this.drag && !this.pinch) {
      const steps = Math.max(1, Math.ceil(delta / (1 / 120)));
      const dt = delta / steps;
      const low = Math.log(this.fitS);
      const high = Math.log(this.maxS);
      if (time - this.lastWheel > 170) this.zt = clamp(this.zt, low, high);
      const target =
        this.zt > high
          ? high + bandOffset(this.zt - high, 0.35)
          : this.zt < low
            ? low - bandOffset(low - this.zt, 0.35)
            : this.zt;

      for (let i = 0; i < steps; i += 1) {
        const current = Math.log(this.s);
        if (Math.abs(target - current) > 1e-4 || Math.abs(this.zv) > 0.001) {
          if (this.reduce) {
            this.applyZoom(target);
            this.zv = 0;
          } else {
            this.zv +=
              (SPRING_RESPONSIVE.stiffness * (target - current) - SPRING_RESPONSIVE.damping * this.zv) * dt;
            this.applyZoom(current + this.zv * dt);
          }
          alive = true;
        } else if (this.zv !== 0 || current !== target) {
          this.applyZoom(target);
          this.zv = 0;
        }

        if (this.panTarget) {
          const { stiffness, damping } = SPRING_GENTLE;
          this.pvx += (stiffness * (this.panTarget.x - this.cx) - damping * this.pvx) * dt;
          this.pvy += (stiffness * (this.panTarget.y - this.cy) - damping * this.pvy) * dt;
          this.cx += this.pvx * dt;
          this.cy += this.pvy * dt;
          if (
            Math.hypot(this.panTarget.x - this.cx, this.panTarget.y - this.cy) * this.s < 0.3 &&
            Math.hypot(this.pvx, this.pvy) * this.s < 2
          ) {
            this.cx = this.panTarget.x;
            this.cy = this.panTarget.y;
            this.panTarget = null;
            this.pvx = 0;
            this.pvy = 0;
          }
          alive = true;
          continue;
        }
        alive = this.axis(0, dt) || alive;
        alive = this.axis(1, dt) || alive;
      }
    }

    const view = this.flight ? this.flight.to : this.viewNode();
    if (view !== this.view) {
      this.view = view;
      this.hooks.path(pathTo(view));
      if (this.cursor >= 0 && NODES[this.cursor].parent !== view) {
        this.cursor = -1;
        this.setHover(-1, -1);
      }
    }

    const zoomed = this.s > 1.06 * this.fitS;
    if (zoomed !== this.zoomedFlag) {
      this.zoomedFlag = zoomed;
      this.hooks.zoomed(zoomed);
    }

    if (this.mouse && !this.drag && !this.pinch && !this.flight && alive && this.cursor < 0 && this.cursorItem < 0) {
      this.pointerHover(this.mouse, false);
    }

    return this.fades(delta, time) || alive;
  }

  private axis(axisIndex: 0 | 1, dt: number): boolean {
    const [min, max] = this.range(this.s, axisIndex);
    let position = axisIndex ? this.cy : this.cx;
    let velocity = axisIndex ? this.vy : this.vx;
    const outside = position < min ? position - min : position > max ? position - max : 0;
    if (outside !== 0) {
      if (this.reduce) {
        position = clamp(position, min, max);
        velocity = 0;
      } else {
        const { stiffness, damping } = SPRING_GENTLE;
        velocity += (stiffness * outside * this.s - damping * velocity) * dt;
        position -= (velocity * dt) / this.s;
        if (Math.abs(outside * this.s) < 0.25 && Math.abs(velocity) < 4) {
          position = clamp(position, min, max);
          velocity = 0;
        }
      }
    } else if (velocity !== 0) {
      velocity *= Math.exp(-3.6 * dt);
      position -= (velocity * dt) / this.s;
      if (Math.abs(velocity) < 3) velocity = 0;
    }
    if (axisIndex) {
      this.cy = position;
      this.vy = velocity;
    } else {
      this.cx = position;
      this.vx = velocity;
    }
    return outside !== 0 || velocity !== 0;
  }

  private viewNode(): number {
    const { top, bottom, side } = this.insets;
    const usableW = this.W - 2 * side;
    const usableH = this.H - top - bottom;
    if (this.s <= 1.06 * this.fitS) return 0;
    const world = this.toWorld({ x: this.W / 2, y: (top + this.H - bottom) / 2 });
    let node = 0;
    for (;;) {
      const next = NODES[node].children.find((child) => {
        const candidate = NODES[child];
        return (
          candidate.kind !== 4 &&
          world.x >= candidate.x &&
          world.x <= candidate.x + candidate.w &&
          world.y >= candidate.y &&
          world.y <= candidate.y + candidate.h &&
          (candidate.w * this.s >= 0.55 * usableW || candidate.h * this.s >= 0.55 * usableH)
        );
      });
      if (next === undefined) return node;
      node = next;
    }
  }

  private fades(delta: number, time: number): boolean {
    let alive = false;
    const k = 1 - Math.exp(-delta * (this.reduce ? 1000 : 11));

    for (const [node, value] of this.hl) {
      const target = node === this.hoverNode ? 1 : 0;
      const next = value + (target - value) * k;
      if (Math.abs(target - next) < 0.004) {
        if (target) this.hl.set(node, 1);
        else this.hl.delete(node);
      } else {
        this.hl.set(node, next);
        alive = true;
      }
    }
    if (this.hoverNode >= 0 && !this.hl.has(this.hoverNode)) {
      this.hl.set(this.hoverNode, this.reduce ? 1 : 0);
      alive = true;
    }

    const path = pathTo(this.view);
    for (let id = 1; id < NODES.length; id += 1) {
      const node = NODES[id];
      if (node.kind === 4) continue;
      const kind = node.kind;
      const onPath = path[kind] === id;
      const target =
        !(path[kind - 1] === node.parent && path.length > kind) || onPath ? 1 : node.kind === 1 ? 0.42 : 0.5;
      const current = this.dim[id];
      if (Math.abs(current - target) > 0.003) {
        this.dim[id] = current + (target - current) * k * 0.7;
        alive = true;
      } else {
        this.dim[id] = target;
      }
    }

    const onPerson = this.hoverNode >= 0 && NODES[this.hoverNode].kind === 4;
    if (onPerson) {
      this.spotPerson = NODES[this.hoverNode].ref;
      this.spotProject = NODES[this.hoverNode].parent;
    }
    const spotTarget = onPerson ? 1 : 0;
    if (Math.abs(this.spot - spotTarget) > 0.003) {
      this.spot += (spotTarget - this.spot) * k;
      alive = true;
    } else {
      this.spot = spotTarget;
    }

    for (const node of [0, ...TEAM_NODES, ...PROJECT_NODES]) {
      const target = this.stat(node).progress;
      const current = this.shown[node];
      if (Math.abs(target - current) > 5e-4) {
        this.shown[node] = this.reduce ? target : current + (target - current) * (1 - Math.exp(-(6 * delta)));
        alive = true;
      } else {
        this.shown[node] = target;
      }
    }

    if (this.introT0 > 0 && time - this.introT0 < 2200) alive = true;
    return alive || time - this.lastAnim < 700;
  }

  private local(event: PointerEvent | WheelEvent): { x: number; y: number } {
    const box = this.canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  pointerDown(event: PointerEvent): void {
    this.stopTour();
    this.hooks.interact();
    const point = this.local(event);
    this.pointers.set(event.pointerId, point);
    if (this.pointers.size === 2) {
      this.startPinch();
      return;
    }
    if (this.pointers.size > 2) return;

    const caught = Boolean(this.flight) || Math.hypot(this.vx, this.vy) > 90 || Boolean(this.panTarget);
    this.halt();
    this.drag = {
      id: event.pointerId,
      sx: point.x,
      sy: point.y,
      rx: this.unband(this.cx, this.range(this.s, 0), this.W),
      ry: this.unband(this.cy, this.range(this.s, 1), this.H),
      moved: false,
      caught,
      samples: [{ x: point.x, y: point.y, t: performance.now() }],
    };
    this.wake();
  }

  pointerMove(event: PointerEvent): void {
    const point = this.local(event);
    if (event.pointerType === "mouse") this.mouse = point;
    if (this.pointers.has(event.pointerId)) this.pointers.set(event.pointerId, point);

    if (this.pinch) {
      this.movePinch();
      return;
    }

    const drag = this.drag;
    if (drag && drag.id === event.pointerId) {
      if (!drag.moved && Math.hypot(point.x - drag.sx, point.y - drag.sy) < 5) return;
      if (!drag.moved) {
        drag.moved = true;
        this.setHover(-1, -1);
        this.stage.dataset.dragging = "true";
      }
      this.cx = this.band(drag.rx - (point.x - drag.sx) / this.s, this.range(this.s, 0), this.W);
      this.cy = this.band(drag.ry - (point.y - drag.sy) / this.s, this.range(this.s, 1), this.H);
      const now = performance.now();
      drag.samples.push({ x: point.x, y: point.y, t: now });
      while (drag.samples.length > 2 && now - drag.samples[0].t > 90) drag.samples.shift();
      this.wake();
      return;
    }

    if (!drag && event.pointerType === "mouse" && !this.flight) this.pointerHover(point);
  }

  pointerUp(event: PointerEvent, cancelled = false): void {
    const point = this.local(event);
    this.pointers.delete(event.pointerId);
    if (this.pinch) {
      if (this.pointers.size < 2) this.endPinch();
      return;
    }

    const drag = this.drag;
    if (drag && drag.id === event.pointerId) {
      this.drag = null;
      delete this.stage.dataset.dragging;
      if (drag.moved) {
        if (!this.reduce) {
          const first = drag.samples[0];
          const last = drag.samples[drag.samples.length - 1];
          const now = performance.now();
          if (last.t > first.t && now - last.t < 70) {
            const rate = 1e3 / (last.t - first.t);
            this.vx = clamp((last.x - first.x) * rate, -5e3, 5e3);
            this.vy = clamp((last.y - first.y) * rate, -5e3, 5e3);
          }
        }
      } else if (!drag.caught && !cancelled) {
        this.click(point);
      }
      if (event.pointerType === "mouse" && !this.flight) this.pointerHover(point);
      this.wake();
    }
  }

  pointerLeave(): void {
    this.mouse = null;
    if (!this.drag && this.cursor < 0) this.setHover(-1, -1);
  }

  private startPinch(): void {
    const [first, second] = [...this.pointers.values()];
    this.halt();
    this.drag = null;
    const centre = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    const world = this.toWorld(centre);
    this.pinch = {
      d0: Math.max(10, Math.hypot(first.x - second.x, first.y - second.y)),
      s0: this.s,
      wx: world.x,
      wy: world.y,
      c: centre,
    };
    this.setHover(-1, -1);
  }

  private movePinch(): void {
    const pinch = this.pinch;
    if (!pinch || this.pointers.size < 2) return;
    const [first, second] = [...this.pointers.values()];
    const low = Math.log(this.fitS);
    const high = Math.log(this.maxS);
    const raw =
      Math.log(pinch.s0) + Math.log(Math.max(10, Math.hypot(first.x - second.x, first.y - second.y)) / pinch.d0);
    const target = raw > high ? high + bandOffset(raw - high, 0.35) : raw < low ? low - bandOffset(low - raw, 0.35) : raw;
    this.s = Math.exp(target);
    pinch.c = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    this.cx = pinch.wx - (pinch.c.x - this.W / 2) / this.s;
    this.cy = pinch.wy - (pinch.c.y - this.H / 2) / this.s;
    this.wake();
  }

  private endPinch(): void {
    const pinch = this.pinch;
    this.pinch = null;
    if (!pinch) return;
    this.zt = clamp(Math.log(this.s), Math.log(this.fitS), Math.log(this.maxS));
    this.anchor = pinch.c;
    this.lastWheel = 0;
    const remaining = [...this.pointers.entries()][0];
    if (remaining) {
      const [id, point] = remaining;
      this.drag = {
        id,
        sx: point.x,
        sy: point.y,
        rx: this.unband(this.cx, this.range(this.s, 0), this.W),
        ry: this.unband(this.cy, this.range(this.s, 1), this.H),
        moved: true,
        caught: true,
        samples: [{ x: point.x, y: point.y, t: performance.now() }],
      };
    }
    this.wake();
  }

  wheel(event: WheelEvent): void {
    event.preventDefault();
    this.stopTour();
    this.hooks.interact();
    if (this.flight || this.panTarget) this.halt();
    const point = this.local(event);
    this.mouse = point;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.H : 1;
    const dx = event.deltaX * unit;
    const dy = event.deltaY * unit;

    if (!event.ctrlKey && Math.abs(dx) > Math.abs(dy)) {
      const [min, max] = this.range(this.s, 0);
      const outside = this.cx < min || this.cx > max;
      this.vx = 0;
      this.cx += (dx / this.s) * (outside ? 0.3 : 1);
      this.wake();
      return;
    }

    const low = Math.log(this.fitS);
    const high = Math.log(this.maxS);
    this.anchor = point;
    this.lastWheel = performance.now();
    this.zt = clamp(this.zt - dy * (event.ctrlKey ? 0.012 : 0.0022), low - 0.7, high + 0.7);
    if (this.reduce) {
      this.zt = clamp(this.zt, low, high);
      this.applyZoom(this.zt);
    }
    this.wake();
  }

  miniPointer(event: PointerEvent): void {
    if (!this.mini || !this.sized) return;
    this.stopTour();
    this.hooks.interact();
    const box = this.mini.getBoundingClientRect();
    const { m, ox, oy } = this.miniFrame();
    const x = (event.clientX - box.left - ox) / m;
    const y = (event.clientY - box.top - oy) / m;
    this.flight = null;
    this.vx = 0;
    this.vy = 0;
    this.anchor = null;
    this.zt = Math.log(this.s);
    this.zv = 0;
    const { top, bottom } = this.insets;
    const [minX, maxX] = this.range(this.s, 0);
    const [minY, maxY] = this.range(this.s, 1);
    const targetX = clamp(x, minX, maxX);
    const targetY = clamp(y - (top - bottom) / 2 / this.s, minY, maxY);
    if (this.reduce) {
      this.cx = targetX;
      this.cy = targetY;
    } else {
      this.panTarget = { x: targetX, y: targetY };
    }
    this.wake();
  }

  private pick(point: { x: number; y: number }): PickResult {
    for (const item of this.items) {
      if (point.x >= item.x && point.x <= item.x + item.w && point.y >= item.y && point.y <= item.y + item.h) {
        return { node: TASK_NODES[item.task], item: item.item };
      }
    }
    const world = this.toWorld(point);
    const scale = this.s;
    const inside = (node: MapNode): boolean =>
      world.x >= node.x &&
      world.x <= node.x + node.w &&
      world.y >= node.y &&
      world.y <= node.y + node.h;

    const team = NODES[0].children.find((child) => inside(NODES[child]));
    if (team === undefined) return { node: -1, item: -1 };
    let found = team;
    const project = NODES[team].children.find((child) => inside(NODES[child]));
    if (project === undefined || !(NODES[project].w * scale >= 150 || this.view === team)) {
      return { node: found, item: -1 };
    }
    found = project;
    for (const child of NODES[project].children) {
      const node = NODES[child];
      if (node.kind === 4) {
        const radius = node.w / 2;
        if (node.w * scale >= 18 && Math.hypot(world.x - (node.x + radius), world.y - (node.y + radius)) <= radius) {
          return { node: child, item: -1 };
        }
      } else if (inside(node) && (node.w * scale >= 90 || this.view === project)) {
        return { node: child, item: -1 };
      }
    }
    return { node: found, item: -1 };
  }

  private pointerHover(point: { x: number; y: number }, resetCursor = true): void {
    const { node, item } = this.pick(point);
    const target = node === this.view && item < 0 ? -1 : node;
    if (resetCursor) {
      this.cursor = -1;
      this.cursorItem = -1;
    }
    this.setHover(target, item);
    this.stage.dataset.clickable = String(item >= 0 || (node >= 0 && node !== this.view) || (node < 0 && this.view > 0));
  }

  private setHover(node: number, item: number): void {
    if (node === this.hoverNode && item === this.hoverItem) return;
    const had = this.hoverNode >= 0;
    this.hoverNode = node;
    this.hoverItem = item;
    const reported = item >= 0 ? -1 : node;
    if (reported >= 0 && !had) this.panelOn = false;
    this.hooks.hover(reported);
    this.wake();
  }

  private click(point: { x: number; y: number }): void {
    const { node, item } = this.pick(point);
    if (item >= 0) {
      this.toggle(NODES[node].ref, item);
      return;
    }
    if (node < 0) {
      if (this.view > 0) this.flyTo(NODES[this.view].parent);
      return;
    }
    this.activate(node);
  }

  private activate(node: number): void {
    const target = NODES[node];
    if (target.kind === 4) {
      const order: Status[] = ["progress", "review", "blocked", "todo", "done"];
      const mine = PROJECTS[NODES[target.parent].ref].tasks.filter((task) => TASKS[task].assignee === target.ref);
      mine.sort((a, b) => order.indexOf(this.model.status(a)) - order.indexOf(this.model.status(b)));
      this.flyTo(mine.length ? TASK_NODES[mine[0]] : target.parent);
      return;
    }
    if (node !== this.view) this.flyTo(node);
  }

  private toggle(task: number, item: number): void {
    const before = this.model.status(task);
    this.model.toggle(task, item);
    const after = this.model.status(task);
    const now = performance.now();
    this.itemT[task][item] = now;
    this.lastAnim = now;
    if (after !== before) this.statusT[task] = now;
    this.cache.clear();
    const record = TASKS[task];
    const done = this.model.done(task);
    const label = record.checklist[item];
    this.hooks.changed();
    this.hooks.announce(
      `${label} ${this.model.checks[task][item] ? "checked" : "unchecked"}. ${record.title}: ${done} of ${
        record.checklist.length
      } done${after !== before ? `, now ${STATUS_LABEL[after].toLowerCase()}` : ""}.`,
    );
    this.wake();
  }

  moveCursor(dx: number, dy: number): void {
    this.stopTour();
    this.hooks.interact();
    const scope = NODES[this.view];
    if (scope.kind === 3) {
      const task = TASKS[scope.ref];
      const count = task.checklist.length;
      const step = dy || dx;
      this.cursorItem = this.cursorItem < 0 ? 0 : clamp(this.cursorItem + step, 0, count - 1);
      this.cursor = -1;
      this.setHover(this.view, this.cursorItem);
      this.hooks.announce(
        `${task.checklist[this.cursorItem]}, ${
          this.model.checks[scope.ref][this.cursorItem] ? "checked" : "not checked"
        }. Press Enter to toggle.`,
      );
      return;
    }

    const children = scope.children;
    if (!children.length) return;
    let best = children[0];
    if (this.cursor >= 0 && children.includes(this.cursor)) {
      const from = NODES[this.cursor];
      const fx = from.x + from.w / 2;
      const fy = from.y + from.h / 2;
      let score = Number.POSITIVE_INFINITY;
      best = this.cursor;
      for (const child of children) {
        if (child === this.cursor) continue;
        const node = NODES[child];
        const ox = node.x + node.w / 2 - fx;
        const oy = node.y + node.h / 2 - fy;
        const along = ox * dx + oy * dy;
        const across = Math.abs(ox * dy) + Math.abs(oy * dx);
        if (along <= 1) continue;
        const cost = along + 2.5 * across;
        if (cost < score) {
          score = cost;
          best = child;
        }
      }
    }
    this.cursor = best;
    this.setHover(best, -1);
    this.hooks.announce(`${this.describeNode(best)} Press Enter to zoom in.`);
  }

  activateCursor(): void {
    this.stopTour();
    this.hooks.interact();
    if (NODES[this.view].kind === 3 && this.cursorItem >= 0) {
      this.toggle(NODES[this.view].ref, this.cursorItem);
      return;
    }
    if (this.cursor >= 0) {
      const node = this.cursor;
      this.cursor = -1;
      this.activate(node);
      return;
    }
    this.moveCursor(1, 0);
  }

  describeNode(node: number): string {
    const target = NODES[node];
    const stats = this.stat(node);
    const progress = `${Math.round(100 * stats.progress)}% complete`;
    if (target.kind === 1) {
      return `${target.name} team, ${stats.projects} projects, ${stats.open} open tasks, ${progress}.`;
    }
    if (target.kind === 2) {
      const project = PROJECTS[target.ref];
      return `${project.name}, ${HEALTH_LABEL[project.health].toLowerCase()}, ${progress}, ${
        stats.open
      } open tasks, due ${formatDay(project.due)}.`;
    }
    if (target.kind === 3) {
      const task = TASKS[target.ref];
      return `${task.title}, ${STATUS_LABEL[this.model.status(target.ref)].toLowerCase()}, assigned to ${
        PEOPLE[task.assignee].name
      }, due ${formatDay(task.due)}, ${this.model.done(target.ref)} of ${task.checklist.length} checklist items done.`;
    }
    return target.kind === 4
      ? `${target.name}, ${PEOPLE[target.ref].role}, ${stats.open} open tasks in ${NODES[target.parent].name}.`
      : `Northstar Studio, ${TEAMS_LIST.length} teams, ${stats.projects} projects, ${stats.open} open tasks, ${progress}.`;
  }

  toggleTour(): void {
    if (this.touring) this.stopTour();
    else this.startTour();
  }

  private startTour(): void {
    this.touring = true;
    this.tourStep = 0;
    this.hooks.tour(true);
    this.hooks.interact();
    this.cursor = -1;
    this.cursorItem = -1;
    this.nextStop();
  }

  private nextStop(): void {
    if (!this.touring) return;
    if (this.tourStep >= TOUR_STOPS.length) {
      this.stopTour();
      return;
    }
    const node = TOUR_STOPS[this.tourStep];
    this.tourStep += 1;
    this.flyTo(node, () => {
      if (!this.touring) return;
      this.tourTimer = window.setTimeout(
        () => this.nextStop(),
        this.tourStep >= TOUR_STOPS.length ? 0 : this.reduce ? 2400 : 1500,
      );
    });
  }

  private stopTour(): void {
    if (!this.touring) return;
    this.touring = false;
    clearTimeout(this.tourTimer);
    this.hooks.tour(false);
  }

  /* ------------------------------------------------------------------------------------------
   * Text + shape helpers. Widths are cached at a 100px reference size and scaled, so measuring
   * a wrap never forces a layout pass.
   * ---------------------------------------------------------------------------------------- */

  private setFont(size: number, weight: number, display = false): void {
    const spec = `${weight} ${size.toFixed(2)}px ${display ? this.pal.display : this.pal.body}`;
    if (spec === this.font) return;
    this.font = spec;
    this.ctx.font = spec;
    if (this.hasSpacing) this.ctx.letterSpacing = `${((display ? -0.03 : -0.01) * size).toFixed(3)}px`;
  }

  private width(text: string, size: number, weight: number, display = false): number {
    const key = `${weight}${display ? "d" : "b"}${text}`;
    let measured = this.widths.get(key);
    if (measured === undefined) {
      this.setFont(100, weight, display);
      measured = this.ctx.measureText(text).width;
      this.widths.set(key, measured);
    }
    return (measured * size) / 100;
  }

  private fit(text: string, size: number, weight: number, maxWidth: number): string {
    if (maxWidth <= 0) return "";
    if (this.width(text, size, weight) <= maxWidth) return text;
    const key = `${weight}${text}`;
    let metrics = this.prefixes.get(key);
    if (!metrics) {
      this.setFont(100, weight);
      metrics = [...text].map((_, index) => this.ctx.measureText(text.slice(0, index + 1)).width);
      this.prefixes.set(key, metrics);
    }
    const room = ((maxWidth - this.width("…", size, weight)) * 100) / size;
    let low = 0;
    let high = metrics.length;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (metrics[mid - 1] <= room) low = mid;
      else high = mid - 1;
    }
    return low ? `${text.slice(0, low).trimEnd()}…` : "";
  }

  private wrap(text: string, size: number, weight: number, maxWidth: number, maxLines: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";
    for (let i = 0; i < words.length; i += 1) {
      const candidate = line ? `${line} ${words[i]}` : words[i];
      if (!line || this.width(candidate, size, weight) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (lines.length === maxLines - 1) {
        lines.push(this.fit(`${line} ${words.slice(i).join(" ")}`, size, weight, maxWidth));
        return lines;
      }
      lines.push(line);
      line = words[i];
    }
    if (line) lines.push(this.width(line, size, weight) > maxWidth ? this.fit(line, size, weight, maxWidth) : line);
    return lines;
  }

  private text(
    value: string,
    x: number,
    y: number,
    size: number,
    weight: number,
    color: string,
    align: CanvasTextAlign = "left",
    display = false,
  ): void {
    if (!value) return;
    this.setFont(size, weight, display);
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, x, y + 0.65 * size + 0.36 * size);
  }

  private rr(x: number, y: number, w: number, h: number, radius: number): void {
    const ctx = this.ctx;
    const r = Math.max(0, Math.min(radius, w / 2, h / 2));
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private circle(x: number, y: number, radius: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, radius), 0, 2 * Math.PI);
  }

  private partial(points: [number, number][], progress: number): void {
    const ctx = this.ctx;
    const segments = points
      .slice(1)
      .map((point, index) => Math.hypot(point[0] - points[index][0], point[1] - points[index][1]));
    let remaining = segments.reduce((sum, length) => sum + length, 0) * clamp(progress, 0, 1);
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 0; i < segments.length && remaining > 0; i += 1) {
      const share = Math.min(1, remaining / segments[i]);
      ctx.lineTo(
        lerp(points[i][0], points[i + 1][0], share),
        lerp(points[i][1], points[i + 1][1], share),
      );
      remaining -= segments[i];
    }
    ctx.stroke();
  }

  private glyph(status: Status, x: number, y: number, size: number, alpha: number, startedAt: number): void {
    const ctx = this.ctx;
    const radius = size / 2;
    const stroke = Math.max(1, 0.12 * size);
    const pal = this.pal;
    const t = (performance.now() - startedAt) / 420;
    const pop = this.reduce || t >= 1 ? 1 : overshoot(t);

    ctx.globalAlpha = alpha;
    if (status === "done" || status === "blocked") {
      this.circle(x, y, radius * (status === "done" ? pop : 1));
      ctx.fillStyle = status === "done" ? pal.success : pal.danger;
      ctx.fill();
      ctx.strokeStyle = pal.surface;
      ctx.lineWidth = 1.15 * stroke;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (status === "done") {
        this.partial(
          [
            [x - 0.4 * radius, y + 0.02 * radius],
            [x - 0.1 * radius, y + 0.32 * radius],
            [x + 0.42 * radius, y - 0.28 * radius],
          ],
          this.reduce ? 1 : clamp(1.4 * t - 0.15, 0, 1),
        );
      } else {
        ctx.beginPath();
        ctx.moveTo(x - 0.42 * radius, y);
        ctx.lineTo(x + 0.42 * radius, y);
        ctx.stroke();
      }
      return;
    }

    this.circle(x, y, radius - stroke / 2);
    ctx.strokeStyle = status === "todo" ? pal.strong : pal.accent;
    ctx.lineWidth = stroke;
    ctx.stroke();
    if (status === "todo") return;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, 0.5 * radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * (status === "review" ? 1.5 : 1));
    ctx.closePath();
    ctx.fillStyle = pal.accent;
    ctx.fill();
  }

  private avatar(person: number, x: number, y: number, size: number, alpha: number, ring = 0): void {
    const ctx = this.ctx;
    const face = this.faces[person];
    const radius = size / 2;
    const pal = this.pal;
    ctx.globalAlpha = alpha;
    if (ring > 0) {
      this.circle(x + radius, y + radius, radius + ring);
      ctx.fillStyle = pal.surface;
      ctx.fill();
    }
    if (face && size >= 7) {
      ctx.drawImage(face, x, y, size, size);
      return;
    }
    this.circle(x + radius, y + radius, radius);
    ctx.fillStyle = size < 10 ? pal.strong : pal.muted;
    ctx.fill();
    if (size >= 10) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = pal.border;
      ctx.stroke();
    }
    if (size >= 16) {
      this.text(PEOPLE[person].initials, x + radius, y + radius - 0.4 * size * 0.65, 0.4 * size, 500, pal.secondary, "center");
    }
  }

  private intro(delay: number, time: number): number {
    return this.introT0 < 0 ? 1 : 1 - Math.pow(1 - clamp((time - this.introT0 - delay) / 520, 0, 1), 3);
  }

  /* ------------------------------------------------------------------------------------------
   * Painting
   * ---------------------------------------------------------------------------------------- */

  private draw(time: number): void {
    const { ctx, W, H, dpr, s } = this;
    if (!this.sized) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    this.items = [];

    const ox = W / 2 - this.cx * s;
    const oy = H / 2 - this.cy * s;
    this.grid(ox, oy);
    ctx.textBaseline = "alphabetic";
    TEAM_NODES.forEach((node, index) => this.drawTeam(NODES[node], index, ox, oy, time));
    ctx.globalAlpha = 1;
    this.drawMini();
    this.placePanel();

    if (this.readout) {
      const ratio = s / this.fitS;
      const label = `${ratio < 9.95 ? ratio.toFixed(1) : Math.round(ratio)}×`;
      if (label !== this.readText) {
        this.readText = label;
        this.readout.textContent = label;
      }
    }
  }

  private grid(ox: number, oy: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = this.pal.strong;
    for (const step of [8, 32, 128, 512]) {
      const spacing = step * this.s;
      if (spacing < 14 || spacing > 420) continue;
      const alpha = smoothstep(14, 30, spacing) * (1 - smoothstep(140, 420, spacing)) * 0.55;
      if (alpha < 0.01) continue;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      const startX = ((ox % spacing) + spacing) % spacing;
      const startY = ((oy % spacing) + spacing) % spacing;
      for (let x = startX; x < this.W; x += spacing) {
        for (let y = startY; y < this.H; y += spacing) ctx.rect(x - 0.75, y - 0.75, 1.5, 1.5);
      }
      ctx.fill();
    }
  }

  private drawTeam(node: MapNode, index: number, ox: number, oy: number, time: number): void {
    const { ctx, s, pal, W, H } = this;
    const appear = this.intro(70 * index, time);
    if (appear <= 0) return;

    const x = node.x * s + ox;
    const y = node.y * s + oy + (1 - appear) * 18;
    const w = node.w * s;
    const h = node.h * s;
    if (x > W || y > H || x + w < 0 || y + h < 0) return;

    const alpha = appear * this.dim[node.id];
    const highlight = this.hl.get(node.id) ?? 0;
    ctx.globalAlpha = alpha;
    this.rr(x, y, w, h, clamp(18 * s, 6, 30));
    ctx.fillStyle = pal.muted;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = pal.border;
    ctx.stroke();
    if (highlight > 0) {
      ctx.globalAlpha = alpha * highlight;
      ctx.strokeStyle = pal.strong;
      ctx.stroke();
    }

    const team = TEAMS_LIST[node.ref];
    const padX = clamp(20 * s, 8, 28);
    const titleSize = clamp(28 * s, 11, 22);
    const titleY = y + clamp(14 * s, 2, 36);
    const percent = Math.round(100 * this.shown[node.id]);

    ctx.globalAlpha = alpha;
    this.text(this.fit(team.name, titleSize, 500, w - 2 * padX - 44), x + padX, titleY, titleSize, 500, pal.fg);

    const percentSize = clamp(20 * s, 11, 15);
    ctx.globalAlpha = alpha;
    this.text(`${percent}%`, x + w - padX, titleY + (titleSize - percentSize) * 1.01, percentSize, 500, pal.secondary, "right");

    const meta = 20 * s;
    const metaAlpha = smoothstep(8.5, 10.5, meta);
    if (metaAlpha > 0.01) {
      const metaSize = clamp(meta, 11, 13);
      const metaY = Math.max(titleY + 1.3 * titleSize, y + 50 * s);
      const faceSize = 1.45 * metaSize;
      this.avatar(team.lead, x + padX, metaY + (1.3 * metaSize - faceSize) / 2, faceSize, alpha * metaAlpha);
      ctx.globalAlpha = alpha * metaAlpha;
      const stats = this.stat(node.id);
      this.text(
        this.fit(
          `${PEOPLE[team.lead].name} · ${stats.projects} projects · ${stats.open} open tasks`,
          metaSize,
          400,
          w - 2 * padX - faceSize - 6,
        ),
        x + padX + faceSize + 6,
        metaY,
        metaSize,
        400,
        pal.secondary,
      );
    }

    const childAlpha = Math.min(1, 1.5 * appear);
    for (const child of node.children) {
      this.drawCard(NODES[child], alpha * childAlpha, index, ox, oy + (1 - appear) * 18, time);
    }
  }

  private drawCard(node: MapNode, alpha: number, teamIndex: number, ox: number, oy: number, time: number): void {
    const { ctx, s, pal, W, H } = this;
    const x = node.x * s + ox;
    const y = node.y * s + oy;
    const w = node.w * s;
    const h = node.h * s;
    if (x > W || y > H || x + w < 0 || y + h < 0 || w < 2) return;

    const faded = alpha * this.dim[node.id];
    const highlight = this.hl.get(node.id) ?? 0;
    const project = PROJECTS[node.ref];

    ctx.globalAlpha = faded;
    this.rr(x, y, w, h, clamp(12 * s, 2.5, 26));
    ctx.fillStyle = pal.surface;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = pal.border;
    ctx.stroke();
    if (highlight > 0) {
      ctx.globalAlpha = faded * highlight;
      ctx.strokeStyle = pal.strong;
      ctx.stroke();
    }

    const pad = 12 * s;
    const innerW = w - 2 * pad;
    const titleBand = 13 * s;
    const titleAlpha = smoothstep(9.6, 12, titleBand);
    const metaBand = 9.5 * s;
    const metaAlpha = smoothstep(8.8, 11, metaBand);
    const small = clamp(metaBand, 11, 13);
    const percent = Math.round(100 * this.shown[node.id]);

    if (titleAlpha > 0.01) {
      const titleSize = clamp(titleBand, 12, 20);
      ctx.globalAlpha = faded * titleAlpha;
      this.text(
        this.fit(
          project.name,
          titleSize,
          500,
          innerW - (metaAlpha > 0.01 ? this.width(`${percent}%`, small, 500) + 10 : 0),
        ),
        x + pad,
        y + 11 * s,
        titleSize,
        500,
        pal.fg,
      );
    }

    if (metaAlpha > 0.01) {
      const metaY = y + 31 * s;
      const dot = 0.5 * small;
      const tone = project.health === "on-track" ? pal.success : project.health === "at-risk" ? pal.warning : pal.danger;
      ctx.globalAlpha = faded * metaAlpha;
      this.circle(x + pad + dot / 2, metaY + 0.65 * small, dot / 2);
      ctx.fillStyle = tone;
      ctx.fill();
      this.text(
        `${percent}%`,
        x + w - pad,
        y + 11 * s + (clamp(titleBand, 12, 20) - small) * 1.01,
        small,
        500,
        pal.secondary,
        "right",
      );
      ctx.globalAlpha = faded * metaAlpha;
      this.text(
        this.fit(`${HEALTH_LABEL[project.health]} · Due ${formatDay(project.due)}`, small, 400, innerW - dot - 6),
        x + pad + dot + 6,
        metaY,
        small,
        400,
        pal.secondary,
      );
    }

    const barY = y + 50 * s;
    const barH = clamp(3 * s, 1.5, 6);
    ctx.globalAlpha = faded;
    this.rr(x + pad, barY, innerW, barH, barH / 2);
    ctx.fillStyle = pal.subtle;
    ctx.fill();
    this.rr(x + pad, barY, Math.max(barH, innerW * this.shown[node.id]), barH, barH / 2);
    ctx.fillStyle = pal.accent;
    ctx.fill();

    const projectIndex = TEAMS_LIST[teamIndex].projects.indexOf(node.ref);
    let tile = 0;
    for (const child of node.children) {
      const tileNode = NODES[child];
      if (tileNode.kind !== 3) continue;
      const appear = this.intro(70 * teamIndex + 180 + 45 * projectIndex + 16 * tile, time);
      tile += 1;
      if (appear > 0) this.drawTile(tileNode, faded * appear, ox, oy, appear);
    }

    this.drawPeople(node, project.people, faded, x, y, w);
  }

  private drawPeople(
    node: MapNode,
    people: number[],
    alpha: number,
    x: number,
    y: number,
    width: number,
  ): void {
    const { s, pal } = this;
    const size = 16 * s;
    if (size < 3 || y + 190 * s > this.H || y + 206 * s < 0) return;

    const top = y + 190 * s;
    const ring = clamp(0.09 * size, 0.6, 2.5);
    const faces = node.children.filter((child) => NODES[child].kind === 4);

    for (let index = people.length - 1; index >= 0; index -= 1) {
      const faceX = x + (12 + 19 * index) * s;
      const highlight = this.hl.get(faces[index]) ?? 0;
      this.avatar(people[index], faceX, top, size, alpha, ring);
      if (highlight > 0) {
        const ctx = this.ctx;
        ctx.globalAlpha = alpha * highlight;
        this.circle(faceX + size / 2, top + size / 2, size / 2 + 0.5 * ring);
        ctx.lineWidth = Math.max(1, ring);
        ctx.strokeStyle = pal.fg;
        ctx.stroke();
      }
    }

    const labelBand = 9 * s;
    const labelAlpha = smoothstep(8.8, 11, labelBand);
    if (labelAlpha < 0.01) return;
    const labelSize = clamp(labelBand, 11, 13);
    const labelX = x + (12 + (people.length - 1) * 19 + 16 + 6) * s;
    const others = people.length - 1;
    this.ctx.globalAlpha = alpha * labelAlpha;
    this.text(
      this.fit(
        others
          ? `${PEOPLE[people[0]].name} and ${others} ${others === 1 ? "other" : "others"}`
          : PEOPLE[people[0]].name,
        labelSize,
        400,
        x + width - 12 * s - labelX,
      ),
      labelX,
      top + (size - 1.3 * labelSize) / 2,
      labelSize,
      400,
      pal.secondary,
    );
  }

  private drawTile(node: MapNode, alpha: number, ox: number, oy: number, appear: number): void {
    const { ctx, s, pal, W, H } = this;
    const taskId = node.ref;
    const task = TASKS[taskId];
    const status = this.model.status(taskId);
    let x = node.x * s + ox;
    let y = node.y * s + oy;
    let w = node.w * s;
    let h = node.h * s;
    if (x > W || y > H || x + w < 0 || y + h < 0 || w < 1) return;

    if (appear < 1) {
      const scale = 0.55 + 0.45 * appear;
      x += (w * (1 - scale)) / 2;
      y += (h * (1 - scale)) / 2;
      w *= scale;
      h *= scale;
    }

    const spotFade =
      this.spot > 0 && node.parent === this.spotProject && task.assignee !== this.spotPerson ? 1 - 0.7 * this.spot : 1;
    const faded = alpha * this.dim[node.id] * spotFade;
    const highlight = this.hl.get(node.id) ?? 0;
    const barOnly = 1 - smoothstep(34, 64, w);
    const radius = clamp(4 * s, 1.5, 20);

    this.rr(x, y, w, h, radius);
    if (barOnly > 0) {
      const [tone, strength] =
        status === "done"
          ? [pal.fg, 0.13]
          : status === "progress"
            ? [pal.accent, 0.85]
            : status === "review"
              ? [pal.accent, 0.42]
              : status === "blocked"
                ? [pal.danger, 0.85]
                : [pal.strong, 0.6];
      ctx.globalAlpha = faded * barOnly * strength;
      ctx.fillStyle = tone;
      ctx.fill();
    }
    if (barOnly < 1) {
      ctx.globalAlpha = faded * (1 - barOnly);
      ctx.fillStyle = pal.muted;
      ctx.fill();
    }
    if (highlight > 0) {
      ctx.globalAlpha = faded * highlight;
      ctx.lineWidth = 1;
      ctx.strokeStyle = pal.strong;
      ctx.stroke();
    }
    if (w < 70) return;

    const detailAlpha = smoothstep(70, 100, w);
    const expanded = smoothstep(300, 420, w);
    const pad = lerp(clamp(0.07 * w, 6, 12), clamp(0.045 * w, 14, 32), expanded);
    const titleSize = lerp(clamp(4.6 * s, 11, 14), clamp(0.034 * w, 16, 28), expanded);
    const lineHeight = 1.28 * titleSize;
    const metaSize = clamp(0.92 * titleSize, 10, 14);
    const indent = (metaSize + 6) * (1 - expanded);
    const firstLine = y + pad + 26 * expanded;
    const footerY = y + h - pad - clamp(1.35 * titleSize, 14, 20);
    const lineCount = expanded > 0.5 ? 2 : clamp(Math.floor((footerY - 3 - firstLine) / lineHeight), 1, 2);
    const clipped = expanded > 0.01;

    if (clipped) {
      ctx.save();
      this.rr(x, y, w, h, radius);
      ctx.clip();
    }

    if (expanded < 0.99) {
      this.glyph(
        status,
        x + pad + metaSize / 2,
        firstLine + lineHeight / 2,
        metaSize,
        faded * detailAlpha * (1 - expanded),
        this.statusT[taskId],
      );
    }

    ctx.globalAlpha = faded * detailAlpha;
    const lines = this.wrap(task.title, titleSize, 500, w - 2 * pad - indent, lineCount);
    lines.forEach((line, index) => {
      ctx.globalAlpha = faded * detailAlpha;
      this.text(
        line,
        x + pad + indent,
        firstLine + index * lineHeight,
        titleSize,
        500,
        status === "done" ? pal.secondary : pal.fg,
      );
    });

    const footerAlpha = detailAlpha * (1 - expanded) * smoothstep(52, 70, h);
    if (footerAlpha > 0.01) {
      this.avatar(task.assignee, x + pad, footerY, clamp(1.35 * titleSize, 14, 20), faded * footerAlpha);
      const size = clamp(0.88 * titleSize, 11, 12.5);
      const done = this.model.done(taskId);
      ctx.globalAlpha = faded * footerAlpha;
      this.text(
        status === "blocked" ? "Blocked" : `${done}/${task.checklist.length} · ${formatDay(task.due)}`,
        x + w - pad,
        footerY + (clamp(1.35 * titleSize, 14, 20) - 1.3 * size) / 2,
        size,
        status === "blocked" ? 500 : 400,
        status === "blocked" ? pal.danger : pal.faint,
        "right",
      );
    }

    if (clipped) {
      this.drawDetail(taskId, status, x, y, w, h, pad, firstLine + lines.length * lineHeight, faded * expanded);
      ctx.restore();
    }
  }

  private drawDetail(
    taskId: number,
    status: Status,
    x: number,
    y: number,
    w: number,
    h: number,
    pad: number,
    top: number,
    alpha: number,
  ): void {
    const { ctx, pal } = this;
    const task = TASKS[taskId];
    const project = PROJECTS[task.project];
    const bottom = y + h - 0.7 * pad;
    const fadeAt = (limit: number): number => smoothstep(-4, 18, bottom - limit);

    this.glyph(status, x + pad + 7, y + pad + 8.45, 14, alpha, this.statusT[taskId]);
    ctx.globalAlpha = alpha;
    this.text(STATUS_LABEL[status], x + pad + 14 + 8, y + pad, 13, 500, status === "blocked" ? pal.danger : pal.fg);
    const labelWidth = this.width(STATUS_LABEL[status], 13, 500);
    ctx.globalAlpha = alpha;
    this.text(
      `· Due ${formatDay(task.due)} · ${task.points} ${task.points === 1 ? "point" : "points"}`,
      x + pad + 14 + 8 + labelWidth + 6,
      y + pad,
      13,
      400,
      pal.secondary,
    );
    ctx.globalAlpha = alpha;
    this.text(
      `${task.comments} ${task.comments === 1 ? "comment" : "comments"}`,
      x + w - pad,
      y + pad,
      13,
      400,
      pal.faint,
      "right",
    );

    let cursor = top + 8;
    const bodySize = clamp(0.019 * w, 13, 15);
    const bodyLine = 1.5 * bodySize;
    const body = this.wrap(this.model.describe(taskId), bodySize, 400, Math.min(w - 2 * pad, 620), 3);
    body.forEach((line, index) => {
      ctx.globalAlpha = alpha * fadeAt(cursor + (index + 1) * bodyLine);
      this.text(line, x + pad, cursor + index * bodyLine, bodySize, 400, pal.secondary);
    });
    cursor += body.length * bodyLine + 14;

    const ownerAlpha = alpha * fadeAt(cursor + 58);
    if (ownerAlpha > 0.01) {
      ctx.globalAlpha = ownerAlpha;
      ctx.fillStyle = pal.border;
      ctx.fillRect(x + pad, cursor, w - 2 * pad, 1);
      cursor += 14;
      this.avatar(task.assignee, x + pad, cursor, 36, ownerAlpha);
      ctx.globalAlpha = ownerAlpha;
      this.text(PEOPLE[task.assignee].name, x + pad + 36 + 10, cursor + 1, 14, 500, pal.fg);
      ctx.globalAlpha = ownerAlpha;
      this.text(PEOPLE[task.assignee].role, x + pad + 36 + 10, cursor + 19, 13, 400, pal.faint);
      ctx.globalAlpha = ownerAlpha;
      this.text(
        this.fit(`${project.name} · ${TEAMS_LIST[project.team].name}`, 13, 400, w - 2 * pad - 220),
        x + w - pad,
        cursor + 10,
        13,
        400,
        pal.faint,
        "right",
      );
      cursor += 52;
    } else {
      cursor += 66;
    }

    const checklistAlpha = alpha * fadeAt(cursor + 20);
    const done = this.model.done(taskId);
    const total = task.checklist.length;
    ctx.globalAlpha = checklistAlpha;
    this.text("Checklist", x + pad, cursor, 13, 500, pal.fg);
    ctx.globalAlpha = checklistAlpha;
    this.text(
      `${done} of ${total}`,
      x + pad + this.width("Checklist", 13, 500) + 8,
      cursor,
      13,
      400,
      pal.faint,
    );
    const barW = Math.min(160, 0.22 * w);
    const barX = x + w - pad - barW;
    ctx.globalAlpha = checklistAlpha;
    this.rr(barX, cursor + 7, barW, 4, 2);
    ctx.fillStyle = pal.subtle;
    ctx.fill();
    this.rr(barX, cursor + 7, Math.max(4, (barW * done) / total), 4, 2);
    ctx.fillStyle = done === total ? pal.success : pal.accent;
    ctx.fill();
    cursor += 26;

    const now = performance.now();
    task.checklist.forEach((label, index) => {
      const rowAlpha = alpha * fadeAt(cursor + 26);
      if (rowAlpha < 0.01) {
        cursor += 28;
        return;
      }
      const checked = this.model.checks[taskId][index];
      const hit: HitItem = {
        task: taskId,
        item: index,
        x: x + pad - 8,
        y: cursor - 2,
        w: Math.min(w - 2 * pad + 16, 420),
        h: 28,
      };
      if (
        (this.hoverItem === index && this.hoverNode === TASK_NODES[taskId]) ||
        (this.cursorItem === index && this.view === TASK_NODES[taskId])
      ) {
        ctx.globalAlpha = rowAlpha;
        this.rr(hit.x, hit.y, hit.w, hit.h, 9);
        ctx.fillStyle = pal.muted;
        ctx.fill();
      }
      const pop = this.reduce ? 1 : clamp((now - this.itemT[taskId][index]) / 300, 0, 1);
      const boxX = x + pad;
      const boxY = cursor + 4;
      ctx.globalAlpha = rowAlpha;
      this.rr(boxX, boxY, 16, 16, 5);
      if (checked) {
        const scale = pop < 1 ? overshoot(pop) : 1;
        this.rr(boxX + (16 * (1 - scale)) / 2, boxY + (16 * (1 - scale)) / 2, 16 * scale, 16 * scale, 5);
        ctx.fillStyle = pal.fg;
        ctx.fill();
        ctx.strokeStyle = pal.surface;
        ctx.lineWidth = 1.8;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        this.partial(
          [
            [boxX + 4.2, boxY + 8.4],
            [boxX + 7, boxY + 11.2],
            [boxX + 12, boxY + 5.4],
          ],
          clamp(1.5 * pop - 0.2, 0, 1),
        );
      } else {
        ctx.lineWidth = 1.25;
        ctx.strokeStyle = pal.strong;
        ctx.stroke();
      }
      ctx.globalAlpha = rowAlpha;
      this.text(label, boxX + 16 + 10, cursor + 3, 14, 400, checked ? pal.faint : pal.fg);
      if (rowAlpha > 0.5 && alpha > 0.6) this.items.push(hit);
      cursor += 28;
    });
  }

  private miniFrame(): { m: number; ox: number; oy: number } {
    const m = Math.min((this.mw - 12) / 1648, (this.mh - 12) / 910);
    return { m, ox: (this.mw - 1648 * m) / 2, oy: (this.mh - 910 * m) / 2 };
  }

  private drawMini(): void {
    const ctx = this.mctx;
    if (!ctx || !this.mw) return;
    const { m, ox, oy } = this.miniFrame();
    const pal = this.pal;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.mw, this.mh);
    ctx.globalAlpha = 1;

    for (const teamNode of TEAM_NODES) {
      const team = NODES[teamNode];
      ctx.globalAlpha = 0.4 + 0.6 * this.dim[teamNode];
      ctx.beginPath();
      ctx.roundRect?.(ox + team.x * m, oy + team.y * m, team.w * m, team.h * m, 3);
      ctx.fillStyle = pal.muted;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = pal.border;
      ctx.stroke();
      for (const projectNode of team.children) {
        const project = NODES[projectNode];
        ctx.fillStyle = pal.strong;
        ctx.fillRect(ox + project.x * m, oy + project.y * m, project.w * m, project.h * m * 0.7);
      }
    }

    ctx.globalAlpha = 1;
    const viewW = (this.W / this.s) * m;
    const viewH = (this.H / this.s) * m;
    let boxX = ox + this.cx * m - viewW / 2;
    let boxY = oy + this.cy * m - viewH / 2;
    let boxW = viewW;
    let boxH = viewH;
    if (boxW < 6) {
      boxX -= (6 - boxW) / 2;
      boxW = 6;
    }
    if (boxH < 6) {
      boxY -= (6 - boxH) / 2;
      boxH = 6;
    }
    const x0 = clamp(boxX, 1, this.mw - 1);
    const y0 = clamp(boxY, 1, this.mh - 1);
    const x1 = clamp(boxX + boxW, 1, this.mw - 1);
    const y1 = clamp(boxY + boxH, 1, this.mh - 1);
    ctx.beginPath();
    ctx.roundRect?.(x0, y0, Math.max(2, x1 - x0), Math.max(2, y1 - y0), 2.5);
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = pal.accent;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = pal.accent;
    ctx.stroke();
  }

  private placePanel(): void {
    const panel = this.panel;
    if (!panel || this.hoverNode < 0 || this.hoverItem >= 0) return;
    const { W, H, pw, ph } = this;
    let x: number;
    let y: number;

    if (this.cursor >= 0 || !this.mouse) {
      const rect = this.screenRect(NODES[this.hoverNode]);
      x = rect.x + rect.w + 12 + pw <= W - 8 ? rect.x + rect.w + 12 : rect.x - 12 - pw;
      y = rect.y;
    } else {
      const pointer = this.mouse;
      x = pointer.x + 18 + pw <= W - 8 ? pointer.x + 18 : pointer.x - 18 - pw;
      y = pointer.y + 18 + ph <= H - 8 ? pointer.y + 18 : pointer.y - 18 - ph;
    }

    x = clamp(x, 8, Math.max(8, W - pw - 8));
    y = clamp(y, 60, Math.max(60, H - ph - 8));

    if (!this.panelOn || this.reduce) {
      this.px = x;
      this.py = y;
      this.panelOn = true;
    } else {
      this.px += (x - this.px) * 0.24;
      this.py += (y - this.py) * 0.24;
      if (Math.abs(x - this.px) + Math.abs(y - this.py) > 0.3) this.lastAnim = performance.now();
    }

    panel.style.transform = `translate3d(${this.px.toFixed(1)}px, ${this.py.toFixed(1)}px, 0)`;
  }
}

/* --------------------------------------------------------------------------------------------
 * Camera flights travel along a logarithmic-spiral arc rather than a straight line, which keeps
 * every intermediate zoom level readable: the path is parameterised so distance and scale change
 * together. `S` is the arc length used to derive the flight duration.
 * ------------------------------------------------------------------------------------------ */

function planFlight(
  from: [number, number, number],
  to: [number, number, number],
  curve = 1.35,
): { S: number; at: (t: number) => [number, number, number] } {
  const [x0, y0, w0] = from;
  const [x1, y1, w1] = to;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const distSq = dx * dx + dy * dy;
  const k = curve * curve;
  const kSq = k * k;

  if (distSq < (1e-4 * Math.min(w0, w1)) ** 2) {
    const scale = Math.log(w1 / w0) / curve;
    return {
      S: Math.abs(scale),
      at: (t) => [x0 + t * dx, y0 + t * dy, w0 * Math.exp(curve * t * scale)],
    };
  }

  const dist = Math.sqrt(distSq);
  const a = (w1 * w1 - w0 * w0 + kSq * distSq) / (2 * w0 * k * dist);
  const b = (w1 * w1 - w0 * w0 - kSq * distSq) / (2 * w1 * k * dist);
  const x0Log = Math.log(Math.sqrt(a * a + 1) - a);
  const length = (Math.log(Math.sqrt(b * b + 1) - b) - x0Log) / curve;
  const cosh = Math.cosh(x0Log);
  const sinh = Math.sinh(x0Log);

  return {
    S: Math.abs(length),
    at: (t) => {
      const u = t * length;
      const travel = (w0 / (k * dist)) * (cosh * Math.tanh(curve * u + x0Log) - sinh);
      return [x0 + travel * dx, y0 + travel * dy, (w0 * cosh) / Math.cosh(curve * u + x0Log)];
    },
  };
}

/** The guided tour: team one, its first project, two of its tasks, then team two and the whole map. */
const TOUR_STOPS = [TEAM_NODES[0], PROJECT_NODES[0], TASK_NODES[0], TASK_NODES[6], TEAM_NODES[1], PROJECT_NODES[7], 0];

/* --------------------------------------------------------------------------------------------
 * Presentational pieces
 * ------------------------------------------------------------------------------------------ */

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Odometer digits: the number rolls to its new value instead of swapping glyphs. */
function Roll({ text }: { text: string }) {
  const chars = [...text];
  return (
    <span className={styles.roll}>
      <span className={styles.srOnly}>{text}</span>
      <span className={styles.rollVisual} aria-hidden="true">
        {chars.map((char, index) => {
          const slot = chars.length - 1 - index;
          return char < "0" || char > "9" ? (
            <span className={styles.sym} key={`s${slot}${char}`}>
              {char}
            </span>
          ) : (
            <span className={styles.wheel} key={`d${slot}`}>
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

function Face({ person, size }: { person: number; size: number }) {
  const person_ = PEOPLE[person];
  return (
    <span className={styles.face} style={{ width: size, height: size }}>
      {person_.portrait ? (
        <Image
          src={person_.portrait}
          alt=""
          width={2 * size}
          height={3 * size}
          className={styles.faceImg}
          /* The local next/image stand-in writes width/height inline; the reference relies on
             `.faceImg` doing the sizing, so pin the same 100% box here. */
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <span className={styles.initials} style={{ fontSize: 0.38 * size }}>
          {person_.initials}
        </span>
      )}
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.cardRow}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/* --------------------------------------------------------------------------------------------
 * The hover card. It lives in the DOM (not the canvas) so the detail is selectable text, and its
 * position is written straight onto the element by the engine — React never re-renders per frame.
 * ------------------------------------------------------------------------------------------ */

function HoverCard({
  store,
  model,
  version,
  panelRef,
  measure,
}: {
  store: HoverStore;
  model: MapModel;
  version: number;
  panelRef: React.RefObject<HTMLDivElement | null>;
  measure: () => void;
}) {
  const active = useSyncExternalStore(store.subscribe, store.get, () => -1);
  const [lastNode, setLastNode] = useState(-1);
  if (active >= 0 && active !== lastNode) setLastNode(active);
  const node = active >= 0 ? active : lastNode;

  useLayoutEffect(() => {
    measure();
  }, [node, version, measure]);

  const target = node >= 0 ? NODES[node] : null;
  let body: ReactNode = null;

  if (target) {
    const stats = model.stats(node);
    const percent = `${Math.round(100 * stats.progress)}%`;

    if (target.kind === 1) {
      const team = TEAMS_LIST[target.ref];
      body = (
        <>
          <div className={styles.cardName}>{team.name}</div>
          <div className={styles.cardMeta}>{team.mission}</div>
          <dl className={styles.cardRows}>
            <Row label="Lead">
              <span className={styles.who}>
                <Face person={team.lead} size={18} />
                {PEOPLE[team.lead].name}
              </span>
            </Row>
            <Row label="Projects">
              {stats.projects}
              {stats.atRisk ? (
                <span className={styles.soft}>
                  {" · "}
                  {stats.atRisk} need attention
                </span>
              ) : null}
            </Row>
            <Row label="Open tasks">{stats.open}</Row>
            <Row label="Progress">{percent}</Row>
          </dl>
          <p className={styles.cardHint}>Click to zoom into the team</p>
        </>
      );
    } else if (target.kind === 2) {
      const project = PROJECTS[target.ref];
      body = (
        <>
          <div className={styles.cardName}>{project.name}</div>
          <div className={styles.cardMeta}>
            <span className={styles.dot} data-tone={project.health} />
            {HEALTH_LABEL[project.health]} · Due {formatDay(project.due)}
          </div>
          <dl className={styles.cardRows}>
            <Row label="Progress">{percent}</Row>
            <Row label="Tasks done">
              {stats.total - stats.open} of {stats.total}
            </Row>
            <Row label="Blocked">{stats.blocked}</Row>
            <Row label="Lead">
              <span className={styles.who}>
                <Face person={project.lead} size={18} />
                {PEOPLE[project.lead].name}
              </span>
            </Row>
          </dl>
          <p className={styles.cardHint}>Click to open the project</p>
        </>
      );
    } else if (target.kind === 3) {
      const task = TASKS[target.ref];
      const status = model.status(target.ref);
      body = (
        <>
          <div className={styles.cardName}>{task.title}</div>
          <div className={styles.cardMeta}>
            <span className={styles.status} data-status={status} />
            {STATUS_LABEL[status]} · {PROJECTS[task.project].name}
          </div>
          <dl className={styles.cardRows}>
            <Row label="Assignee">
              <span className={styles.who}>
                <Face person={task.assignee} size={18} />
                {PEOPLE[task.assignee].name}
              </span>
            </Row>
            <Row label="Due">{formatDay(task.due)}</Row>
            <Row label="Checklist">
              {model.done(target.ref)} of {task.checklist.length}
            </Row>
            <Row label="Estimate">
              {task.points} {task.points === 1 ? "point" : "points"}
            </Row>
          </dl>
          <p className={styles.cardHint}>Click to open the task</p>
        </>
      );
    } else if (target.kind === 4) {
      const person = PEOPLE[target.ref];
      const project = PROJECTS[NODES[target.parent].ref];
      const mine = project.tasks.filter((task) => TASKS[task].assignee === target.ref);
      const activeCount = mine.filter(
        (task) => model.status(task) === "progress" || model.status(task) === "review",
      ).length;
      body = (
        <>
          <div className={styles.person}>
            <Face person={target.ref} size={36} />
            <div>
              <div className={styles.cardName}>{person.name}</div>
              <div className={styles.cardMeta}>{person.role}</div>
            </div>
          </div>
          <dl className={styles.cardRows}>
            <Row label={`Tasks in ${project.name}`}>{mine.length}</Row>
            <Row label="Open">{stats.open}</Row>
            <Row label="Active now">{activeCount}</Row>
          </dl>
          <p className={styles.cardHint}>
            {mine.length ? "Click to jump to their current task" : "Click to open the project"}
          </p>
        </>
      );
    }
  }

  return (
    <div ref={panelRef} className={styles.card} data-open={active >= 0} aria-hidden="true">
      {body}
    </div>
  );
}

/* --------------------------------------------------------------------------------------------
 * The block
 * ------------------------------------------------------------------------------------------ */

export function SemanticZoom() {
  const reduced = Boolean(useReducedMotion());
  const uid = useId();
  const titleId = `${uid}-title`;
  const hintId = `${uid}-hint`;

  const rootRef = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const miniRef = useRef<HTMLCanvasElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const readoutRef = useRef<HTMLSpanElement | null>(null);
  const crumbListRef = useRef<HTMLOListElement | null>(null);
  const engineRef = useRef<MapEngine | null>(null);

  const [store] = useState<HoverStore>(() => {
    let value = -1;
    const listeners = new Set<() => void>();
    return {
      get: () => value,
      set: (next: number) => {
        if (next === value) return;
        value = next;
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
  const [model] = useState(() => new MapModel());
  const [path, setPath] = useState<number[]>([0]);
  const [version, setVersion] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [touring, setTouring] = useState(false);
  const [message, setMessage] = useState("");
  const [crumbWidth, setCrumbWidth] = useState(0);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const root = rootRef.current;
    const title = titleRef.current;
    if (!stage || !canvas || !root || !title) return;

    const engine = new MapEngine(canvas, miniRef.current, stage, model, {
      hover: store.set,
      path: setPath,
      zoomed: setZoomed,
      interact: () => setInteracted(true),
      tour: setTouring,
      changed: () => setVersion((value) => value + 1),
      announce: setMessage,
    });
    engineRef.current = engine;
    engine.attachPanel(panelRef.current);
    engine.attachReadout(readoutRef.current);

    const readPalette = (): void => {
      const computed = getComputedStyle(root);
      const pick = (name: string, fallback: string): string => computed.getPropertyValue(name).trim() || fallback;
      engine.setPalette({
        surface: pick("--surface", "#fff"),
        muted: pick("--surface-muted", "#f6f6f6"),
        fg: pick("--foreground", "#111"),
        secondary: pick("--text-secondary", "#555"),
        faint: pick("--text-muted", "#777"),
        border: pick("--border", "#e8e8e8"),
        subtle: pick("--border-subtle", "#f1f1f1"),
        strong: pick("--border-strong", "#c8c8c8"),
        accent: pick("--accent", "#333"),
        success: pick("--success", "#1f8a4c"),
        warning: pick("--warning", "#b7791f"),
        danger: pick("--danger", "#c53030"),
        body: computed.fontFamily,
        display: getComputedStyle(title).fontFamily,
      });
    };
    readPalette();

    const theme = new MutationObserver(readPalette);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-accent", "class", "style"],
    });
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", readPalette);

    const size = new ResizeObserver(([entry]) =>
      engine.resize(entry.contentRect.width, entry.contentRect.height, Math.min(2, window.devicePixelRatio || 1)),
    );
    size.observe(stage);

    const visibility = new IntersectionObserver(([entry]) => engine.setVisible(entry.isIntersecting), {
      threshold: 0.15,
    });
    visibility.observe(stage);

    const onTabChange = (): void => engine.setHidden(document.hidden);
    onTabChange();
    document.addEventListener("visibilitychange", onTabChange);

    const onWheel = (event: WheelEvent): void => engine.wheel(event);
    stage.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      engine.destroy();
      engineRef.current = null;
      theme.disconnect();
      scheme.removeEventListener("change", readPalette);
      size.disconnect();
      visibility.disconnect();
      document.removeEventListener("visibilitychange", onTabChange);
      stage.removeEventListener("wheel", onWheel);
    };
  }, [store, model]);

  useEffect(() => {
    engineRef.current?.setReduced(reduced);
  }, [reduced]);

  useEffect(() => {
    const list = crumbListRef.current;
    if (!list) return;
    const observer = new ResizeObserver(() => setCrumbWidth(Math.ceil(list.getBoundingClientRect().width)));
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  const current = path[path.length - 1];
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const engine = engineRef.current;
      if (engine) setMessage(`Now viewing ${engine.describeNode(current)}`);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [current]);

  const measure = useCallback(() => engineRef.current?.measurePanel(), []);

  const handlePointer = (event: React.PointerEvent<HTMLDivElement>): void => {
    const engine = engineRef.current;
    if (!engine) return;
    const overlay = (event.target as Element).closest("button, [data-overlay]");
    if (event.type === "pointerdown") {
      if (overlay || (event.pointerType === "mouse" && event.button !== 0)) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      engine.pointerDown(event.nativeEvent);
    } else if (event.type === "pointermove") {
      if (overlay && !event.currentTarget.hasPointerCapture(event.pointerId)) {
        engine.pointerLeave();
        return;
      }
      engine.pointerMove(event.nativeEvent);
    } else if (event.type === "pointerup") {
      engine.pointerUp(event.nativeEvent);
    } else {
      engine.pointerUp(event.nativeEvent, true);
    }
  };

  const handleMini = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (event.type === "pointerdown") {
      event.currentTarget.setPointerCapture(event.pointerId);
      engineRef.current?.miniPointer(event.nativeEvent);
    } else if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      engineRef.current?.miniPointer(event.nativeEvent);
    }
  };

  const stats = model.stats(current);
  const node = NODES[current];
  const percent = Math.round(100 * stats.progress);
  const faces = stats.people.slice(0, 6);
  const mapLabel = `Workspace map of Northstar Studio: ${TEAMS_LIST.length} teams, ${PROJECTS.length} projects and ${TASKS.length} tasks. Currently viewing ${node.name}. Zoom in to reveal projects, tasks and people.`;

  const KEY_MOVES: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };

  return (
    <section ref={rootRef} className={styles.root} aria-labelledby={titleId}>
      <header className={styles.header}>
        <h2 id={titleId} ref={titleRef} className={styles.title}>
          Studio map
        </h2>
        <p className={styles.lede}>
          {TEAMS_LIST.length} teams, {PROJECTS.length} projects and {TASKS.length} tasks. Zoom in for more detail.
        </p>
      </header>

      <div className={styles.body}>
        <div
          ref={stageRef}
          className={styles.stage}
          data-zoomed={zoomed}
          tabIndex={0}
          role="application"
          aria-roledescription="zoomable map"
          aria-label={mapLabel}
          aria-describedby={hintId}
          onPointerDown={handlePointer}
          onPointerMove={handlePointer}
          onPointerUp={handlePointer}
          onPointerCancel={handlePointer}
          onPointerLeave={() => engineRef.current?.pointerLeave()}
          onKeyDown={(event) => {
            const engine = engineRef.current;
            if (!engine || event.target !== event.currentTarget) return;
            const move = KEY_MOVES[event.key];
            let handled = true;
            if (move) engine.moveCursor(move[0], move[1]);
            else if (event.key === "Enter" || event.key === " ") engine.activateCursor();
            else if (event.key === "Escape" || event.key === "Backspace") engine.flyOut();
            else if (event.key === "+" || event.key === "=") engine.zoomBy(1.5);
            else if (event.key === "-" || event.key === "_") engine.zoomBy(1 / 1.5);
            else if (event.key === "0" || event.key === "Home") engine.fitAll();
            else handled = false;
            if (handled) event.preventDefault();
          }}
        >
          <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

          <motion.nav
            className={styles.crumbs}
            aria-label="Map location"
            data-overlay=""
            initial={false}
            animate={crumbWidth ? { width: crumbWidth + 2 } : undefined}
            transition={reduced ? { duration: 0 } : spring.morph}
          >
            <ol ref={crumbListRef} className={styles.crumbList}>
              <AnimatePresence initial={false} mode="popLayout">
                {path.map((crumb, index) => (
                  <motion.li
                    key={crumb}
                    className={styles.crumb}
                    layout={reduced ? false : "position"}
                    initial={reduced ? false : { opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={
                      reduced
                        ? { opacity: 0, transition: { duration: 0 } }
                        : { opacity: 0, transition: { duration: duration.instant } }
                    }
                    transition={
                      reduced ? { duration: 0 } : { ...spring.smooth, opacity: { duration: duration.standard } }
                    }
                  >
                    {index > 0 && <ChevronRight className={styles.sep} size={14} strokeWidth={1.75} aria-hidden="true" />}
                    {index < path.length - 1 ? (
                      <button type="button" className={styles.crumbBtn} onClick={() => engineRef.current?.goTo(crumb)}>
                        {NODES[crumb].name}
                      </button>
                    ) : (
                      <span className={styles.crumbHere} aria-current="location">
                        {NODES[crumb].name}
                      </span>
                    )}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          </motion.nav>

          <button
            type="button"
            className={styles.tour}
            aria-pressed={touring}
            onClick={() => engineRef.current?.toggleTour()}
          >
            <span className={styles.tourIcon} aria-hidden="true">
              {touring ? <Pause size={16} strokeWidth={1.75} /> : <Play size={16} strokeWidth={1.75} />}
            </span>
            <span className={styles.tourLabels}>
              <span data-on={!touring}>Take the tour</span>
              <span data-on={touring}>Stop tour</span>
            </span>
          </button>

          <HoverCard store={store} model={model} version={version} panelRef={panelRef} measure={measure} />

          <div className={styles.mini} data-visible={zoomed} data-overlay="" aria-hidden="true">
            <canvas ref={miniRef} className={styles.miniCanvas} onPointerDown={handleMini} onPointerMove={handleMini} />
          </div>

          <p className={styles.hint} data-hidden={interacted || zoomed} aria-hidden="true">
            <span className={styles.hintFine}>Scroll to zoom, drag to pan, click anything to fly in</span>
            <span className={styles.hintCoarse}>Pinch to zoom, tap anything to fly in</span>
          </p>

          <div className={styles.zoom} data-overlay="">
            <button type="button" aria-label="Zoom out" onClick={() => engineRef.current?.zoomBy(0.625)}>
              <Minus size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <span ref={readoutRef} className={styles.readout} aria-hidden="true">
              1.0×
            </span>
            <button type="button" aria-label="Zoom in" onClick={() => engineRef.current?.zoomBy(1.6)}>
              <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Show the whole studio"
              disabled={!zoomed && path.length === 1}
              onClick={() => engineRef.current?.fitAll()}
            >
              <Maximize2 size={15} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>

        <p id={hintId} className={styles.srOnly}>
          Use the arrow keys to move between items in view, Enter to zoom in or tick a checklist item, Escape to zoom
          out, plus and minus to zoom, and 0 to see the whole studio.
        </p>

        <aside className={styles.panel} aria-label="Key numbers for the current view">
          <div className={styles.scope}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={current}
                className={styles.scopeInner}
                initial={reduced ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: { duration: duration.instant } }}
                transition={reduced ? { duration: 0 } : { duration: duration.standard, ease: [...ease.enter] }}
              >
                <span className={styles.scopeKind}>{KIND_LABEL[node.kind]}</span>
                <span className={styles.scopeName}>{node.name}</span>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className={styles.kpiMain}>
            <span className={styles.kpiLabel}>{node.kind === 3 ? "Checklist complete" : "Progress"}</span>
            <span className={styles.kpiValue}>
              <Roll text={`${percent}%`} />
            </span>
            <span className={styles.track} aria-hidden="true">
              <span className={styles.fill} style={{ width: `${Math.max(2, percent)}%` }} />
            </span>
          </div>

          <dl className={styles.kpis}>
            <div>
              <dt>Open tasks</dt>
              <dd>
                <Roll text={stats.open.toLocaleString("en-US")} />
              </dd>
            </div>
            <div>
              <dt>Blocked</dt>
              <dd data-alert={stats.blocked > 0}>
                <Roll text={stats.blocked.toLocaleString("en-US")} />
              </dd>
            </div>
            <div>
              <dt>Next due</dt>
              <dd>
                <Roll text={stats.nextDue === null ? "None" : formatDay(stats.nextDue)} />
              </dd>
            </div>
          </dl>

          <div className={styles.people}>
            <div className={styles.peopleHead}>
              <span>People</span>
              <span className={styles.peopleCount}>
                <Roll text={stats.people.length.toLocaleString("en-US")} />
              </span>
            </div>
            <ul
              className={styles.stack}
              aria-label={`${stats.people.length} people: ${stats.people.map((person) => PEOPLE[person].name).join(", ")}`}
            >
              <AnimatePresence initial={false} mode="popLayout">
                {faces.map((person) => (
                  <motion.li
                    key={person}
                    layout={reduced ? false : "position"}
                    title={PEOPLE[person].name}
                    initial={reduced ? false : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={
                      reduced
                        ? { opacity: 0, transition: { duration: 0 } }
                        : { opacity: 0, scale: 0.9, transition: { duration: duration.fast } }
                    }
                    transition={reduced ? { duration: 0 } : spring.snappy}
                  >
                    <Face person={person} size={28} />
                  </motion.li>
                ))}
                {stats.people.length > faces.length && (
                  <motion.li
                    layout={reduced ? false : "position"}
                    className={styles.more}
                    initial={reduced ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={reduced ? { duration: 0 } : spring.snappy}
                  >
                    +{stats.people.length - faces.length}
                  </motion.li>
                )}
              </AnimatePresence>
            </ul>
            <p className={styles.peopleNote}>
              {node.kind === 3
                ? `Assigned to ${PEOPLE[stats.people[0]].name}`
                : stats.projects
                  ? `${stats.projects} projects, ${stats.atRisk} need attention`
                  : `Led by ${PEOPLE[PROJECTS[node.ref].lead].name}`}
            </p>
          </div>
        </aside>
      </div>

      <div className={styles.srOnly}>
        <table>
          <caption>Projects at Northstar Studio by team</caption>
          <thead>
            <tr>
              <th scope="col">Team</th>
              <th scope="col">Project</th>
              <th scope="col">Health</th>
              <th scope="col">Progress</th>
              <th scope="col">Open tasks</th>
              <th scope="col">Blocked</th>
              <th scope="col">Due</th>
            </tr>
          </thead>
          <tbody>
            {PROJECTS.map((project) => {
              const projectStats = model.stats(NODES.findIndex((entry) => entry.kind === 2 && entry.ref === project.id));
              return (
                <tr key={project.id}>
                  <td>{TEAMS_LIST[project.team].name}</td>
                  <th scope="row">{project.name}</th>
                  <td>{HEALTH_LABEL[project.health]}</td>
                  <td>{Math.round(100 * projectStats.progress)}%</td>
                  <td>{projectStats.open}</td>
                  <td>{projectStats.blocked}</td>
                  <td>{formatDay(project.due)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className={styles.srOnly} aria-live="polite">
        {message}
      </p>
    </section>
  );
}

export default SemanticZoom;
