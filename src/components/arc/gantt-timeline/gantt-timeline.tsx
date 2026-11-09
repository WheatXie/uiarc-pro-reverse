"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, animate, motion, motionValue, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from "motion/react";
import type { MotionValue } from "motion/react";
import { ChevronRight, Crosshair, RotateCcw, Undo2 } from "lucide-react";
import { avatar, person } from "../lib/media";
import type { PersonId } from "../lib/media";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./gantt-timeline.module.css";

export type GanttZoom = "day" | "week" | "month";

export interface GanttTask {
  id: string;
  name: string;
  group: string;
  /** ISO day, inclusive. */
  start: string;
  /** ISO day, inclusive. A milestone uses `start` only. */
  end: string;
  /** 0 to 1. */
  progress?: number;
  assignee?: PersonId;
  dependsOn?: string[];
  milestone?: boolean;
}

export interface GanttGroup {
  id: string;
  name: string;
}

export interface GanttChange {
  id: string;
  start: string;
  end: string;
  kind: "move" | "resize" | "undo" | "reset";
}

export interface GanttTimelineProps {
  /** Heading in the toolbar and the section's accessible name. */
  title?: string;
  /** Phases in display order. Each task's `group` refers to a group id. */
  groups?: GanttGroup[];
  /** Controlled tasks. Pair with `onTasksChange`. */
  tasks?: GanttTask[];
  /** Starting tasks when uncontrolled. Also sets the calendar range once on mount and is what Reset restores. */
  defaultTasks?: GanttTask[];
  /** Called after a move, resize, undo, or reset with the full list and what changed. */
  onTasksChange?: (tasks: GanttTask[], change: GanttChange) => void;
  /** ISO date that places the today line and the initial scroll. */
  today?: string;
  /** Controlled zoom. */
  zoom?: GanttZoom;
  /** Starting zoom when uncontrolled. */
  defaultZoom?: GanttZoom;
  /** Called when the zoom control changes. */
  onZoomChange?: (zoom: GanttZoom) => void;
  /** Controlled ids of folded groups. */
  collapsed?: string[];
  /** Groups folded on first render when uncontrolled. */
  defaultCollapsed?: string[];
  /** Called when a group is folded or unfolded. */
  onCollapsedChange?: (ids: string[]) => void;
  /** Extra class on the root section. */
  className?: string;
}

const GROUPS: GanttGroup[] = [
  { id: "discovery", name: "Discovery" },
  { id: "design", name: "Design" },
  { id: "build", name: "Build" },
  { id: "launch", name: "Launch" },
];

const TASKS: GanttTask[] = [
  { id: "interviews", name: "User interviews", group: "discovery", start: "2026-08-31", end: "2026-09-09", progress: 1, assignee: "jasmine-brooks" },
  { id: "audit", name: "Competitive audit", group: "discovery", start: "2026-09-02", end: "2026-09-10", progress: 1, assignee: "chloe-nguyen" },
  { id: "readout", name: "Research readout", group: "discovery", start: "2026-09-11", end: "2026-09-11", milestone: true, dependsOn: ["interviews", "audit"] },
  { id: "navigation", name: "Navigation model", group: "design", start: "2026-09-14", end: "2026-09-25", progress: 0.7, assignee: "emma-collins", dependsOn: ["readout"] },
  { id: "visual", name: "Visual system", group: "design", start: "2026-09-21", end: "2026-10-07", progress: 0.35, assignee: "jasmine-brooks" },
  { id: "prototype", name: "Prototype testing", group: "design", start: "2026-09-28", end: "2026-10-09", progress: 0, assignee: "emma-collins", dependsOn: ["navigation"] },
  { id: "contracts", name: "API contracts", group: "build", start: "2026-09-16", end: "2026-10-02", progress: 0.5, assignee: "daniel-kim" },
  { id: "ios", name: "iOS app", group: "build", start: "2026-10-05", end: "2026-10-30", progress: 0, assignee: "mateo-alvarez", dependsOn: ["contracts"] },
  { id: "android", name: "Android app", group: "build", start: "2026-10-12", end: "2026-11-04", progress: 0, assignee: "marcus-johnson", dependsOn: ["contracts"] },
  { id: "payments", name: "Payments", group: "build", start: "2026-10-12", end: "2026-10-28", progress: 0, assignee: "olivia-bennett", dependsOn: ["contracts"] },
  { id: "freeze", name: "Beta freeze", group: "launch", start: "2026-11-06", end: "2026-11-06", milestone: true, dependsOn: ["ios", "android", "payments"] },
  { id: "review", name: "App store review", group: "launch", start: "2026-11-09", end: "2026-11-16", progress: 0, assignee: "sofia-ramirez", dependsOn: ["freeze"] },
  { id: "campaign", name: "Launch campaign", group: "launch", start: "2026-11-02", end: "2026-11-18", progress: 0, assignee: "ava-mitchell" },
  { id: "public", name: "Public launch", group: "launch", start: "2026-11-19", end: "2026-11-19", milestone: true, dependsOn: ["review"] },
];

const DEFAULT_COLLAPSED = ["discovery"];

/** Pixels per day at each zoom. */
const SCALES: Record<GanttZoom, number> = { day: 36, week: 14, month: 5 };

const ZOOMS: { id: GanttZoom; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

const DAY = 86_400_000;

const parseDay = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};

const toDay = (time: number) => new Date(time).toISOString().slice(0, 10);

const dayMonth = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const monthLong = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" });
const monthShort = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round2 = (value: number) => Math.round(value * 100) / 100;

/** Motion values for every task span and every row, created once and read by bars, arrows and summaries. */
class Stage {
  tasks = new Map<string, { start: MotionValue<number>; len: MotionValue<number> }>();
  rows = new Map<string, { y: MotionValue<number>; vis: MotionValue<number> }>();

  task(id: string, start = 0, len = 1) {
    let entry = this.tasks.get(id);
    if (!entry) {
      entry = { start: motionValue(start), len: motionValue(len) };
      this.tasks.set(id, entry);
    }
    return entry;
  }

  row(id: string, y = 0, vis = 1) {
    let entry = this.rows.get(id);
    if (!entry) {
      entry = { y: motionValue(y), vis: motionValue(vis) };
      this.rows.set(id, entry);
    }
    return entry;
  }
}

interface Plan {
  task: GanttTask;
  /** Day index of the start. */
  start: number;
  /** Inclusive length in days; 0 for a milestone. */
  len: number;
}

/** Elbow connector from one bar to another, with the arrowhead at the target. */
function elbow(fromX: number, fromY: number, toX: number, toY: number) {
  const firstX = fromX + 10;
  const backX = Math.min(firstX, toX - 10);
  const midY = fromY + ((toY >= fromY ? 1 : -1) * 40) / 2;
  const points: [number, number][] = [
    [fromX, fromY],
    [firstX, fromY],
    [firstX, midY],
    [backX, midY],
    [backX, toY],
    [toX, toY],
  ];
  let path = `M${round2(fromX)} ${round2(fromY)}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const [ax, ay] = points[index - 1];
    const [bx, by] = points[index];
    const [cx, cy] = points[index + 1];
    const distanceIn = Math.hypot(bx - ax, by - ay);
    const distanceOut = Math.hypot(cx - bx, cy - by);
    const radius = Math.min(6, distanceIn / 2, distanceOut / 2);
    if (radius < 0.5) {
      path += ` L${round2(bx)} ${round2(by)}`;
      continue;
    }
    path += ` L${round2(bx - ((bx - ax) / distanceIn) * radius)} ${round2(by - ((by - ay) / distanceIn) * radius)} Q${round2(bx)} ${round2(by)} ${round2(bx + ((cx - bx) / distanceOut) * radius)} ${round2(by + ((cy - by) / distanceOut) * radius)}`;
  }
  return `${path} L${round2(toX)} ${round2(toY)} M${round2(toX - 5)} ${round2(toY - 4)} L${round2(toX)} ${round2(toY)} L${round2(toX - 5)} ${round2(toY + 4)}`;
}

function DependencyArrow({ from, to, stage, scale, state }: { from: Plan; to: Plan; stage: Stage; scale: MotionValue<number>; state?: "active" | "dim" }) {
  const source = stage.task(from.task.id);
  const target = stage.task(to.task.id);
  const sourceRow = stage.row(from.task.id);
  const targetRow = stage.row(to.task.id);
  const d = useTransform(() => {
    const value = scale.get();
    const fromX = from.task.milestone ? (source.start.get() + 0.5) * value + 7 : (source.start.get() + source.len.get()) * value + 1;
    const toX = to.task.milestone ? (target.start.get() + 0.5) * value - 8 : target.start.get() * value - 2;
    return elbow(fromX, sourceRow.y.get() + 20, toX, targetRow.y.get() + 20);
  });
  const opacity = useTransform(() => Math.max(sourceRow.vis.get(), targetRow.vis.get()));
  const late = useTransform(() => +(target.start.get() < source.start.get() + source.len.get() - 0.02));
  const stroke = useTransform(late, value => (value ? "var(--danger)" : "var(--gantt-arrow)"));
  return <motion.path d={d} style={{ opacity, stroke }} className={styles.arrow} data-state={state} />;
}

function GroupSummary({ group, plans, stage, scale }: { group: GanttGroup; plans: Plan[]; stage: Stage; scale: MotionValue<number> }) {
  const spans = plans.map(plan => stage.task(plan.task.id));
  const row = stage.row(group.id);
  const start = useTransform(() => Math.min(...spans.map(span => span.start.get())));
  const x = useTransform(() => start.get() * scale.get());
  const width = useTransform(() => Math.max(...spans.map(span => span.start.get() + Math.max(span.len.get(), 1))) * scale.get() - x.get());
  const bars = plans.filter(plan => !plan.task.milestone);
  const total = bars.reduce((sum, plan) => sum + plan.len, 0);
  const progress = total ? bars.reduce((sum, plan) => sum + plan.len * (plan.task.progress ?? 0), 0) / total : 0;
  return <motion.div className={styles.summary} style={{ x, width, y: row.y }} aria-hidden="true">
    <span className={styles.summaryFill} style={{ width: `${100 * progress}%` }} />
  </motion.div>;
}

interface TaskBarProps {
  plan: Plan;
  stage: Stage;
  scale: MotionValue<number>;
  days: number;
  reduced: boolean;
  hidden: boolean;
  first: boolean;
  selected: boolean;
  tabbable: boolean;
  late: boolean;
  describedBy: string;
  scroller: () => HTMLDivElement | null;
  onCommit: (id: string, start: number, len: number, kind: "move" | "resize") => void;
  onSelect: (id: string | null) => void;
  onFocusBar: (id: string) => void;
  onStep: (id: string, direction: number) => void;
  register: (id: string, node: HTMLDivElement | null) => void;
  label: (start: number, len: number, milestone: boolean) => string;
}

type DragMode = "move" | "start" | "end";

interface DragState {
  pointer: number;
  mode: DragMode;
  x: number;
  scroll: number;
  start: number;
  len: number;
  moved: boolean;
}

function TaskBar({ plan, stage, scale, days, reduced, hidden, first, selected, tabbable, late, describedBy, scroller, onCommit, onSelect, onFocusBar, onStep, register, label }: TaskBarProps) {
  const { task } = plan;
  const { start, len } = stage.task(task.id, plan.start, plan.len);
  const row = stage.row(task.id);
  const x = useTransform(() => (task.milestone ? (start.get() + 0.5) * scale.get() : start.get() * scale.get()));
  const width = useTransform(() => Math.max(1, len.get() * scale.get()));
  const snapX = useTransform(() => (Math.round(start.get()) + 0.5 * +(task.milestone ?? false)) * scale.get());
  const snapWidth = useTransform(() => Math.max(1, Math.round(len.get())) * scale.get());
  const y = useTransform(() => row.y.get() + 8);
  const [drag, setDrag] = useState<DragMode | null>(null);
  const [draft, setDraft] = useState({ start: plan.start, len: plan.len });
  const pointer = useRef<DragState | null>(null);

  useEffect(() => {
    if (drag) return;
    if (reduced) {
      start.jump(plan.start);
      len.jump(plan.len);
      return;
    }
    const moveX = animate(start, plan.start, motionTokens.spring.snappy);
    const moveLen = animate(len, plan.len, motionTokens.spring.snappy);
    return () => {
      moveX.stop();
      moveLen.stop();
    };
  }, [drag, len, plan.len, plan.start, reduced, start]);

  const syncDraft = () => {
    if (!pointer.current?.moved) return;
    const next = { start: Math.round(start.get()), len: task.milestone ? 0 : Math.max(1, Math.round(len.get())) };
    setDraft(current => (current.start === next.start && current.len === next.len ? current : next));
  };

  useMotionValueEvent(start, "change", syncDraft);
  useMotionValueEvent(len, "change", syncDraft);

  function begin(event: ReactPointerEvent<HTMLDivElement | HTMLSpanElement>, mode: DragMode) {
    if (event.button !== 0 || pointer.current) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { pointer: event.pointerId, mode, x: event.clientX, scroll: scroller()?.scrollLeft ?? 0, start: start.get(), len: len.get(), moved: false };
  }

  function release(event: ReactPointerEvent<HTMLDivElement | HTMLSpanElement>) {
    const state = pointer.current;
    if (!state || state.pointer !== event.pointerId) return;
    event.stopPropagation();
    pointer.current = null;
    if (!state.moved) {
      onSelect(selected ? null : task.id);
      return;
    }
    const nextStart = Math.round(start.get());
    const nextLen = task.milestone ? 0 : Math.max(1, Math.round(len.get()));
    setDrag(null);
    onCommit(task.id, nextStart, nextLen, state.mode === "move" ? "move" : "resize");
  }

  const handlers = {
    onPointerMove(event: ReactPointerEvent<HTMLDivElement | HTMLSpanElement>) {
      const state = pointer.current;
      const element = scroller();
      if (!state || state.pointer !== event.pointerId || !element) return;
      event.stopPropagation();
      if (!state.moved) {
        if (Math.abs(event.clientX - state.x) < 3) return;
        state.moved = true;
        start.stop();
        len.stop();
        setDrag(state.mode);
        onSelect(task.id);
      }
      const box = element.getBoundingClientRect();
      if (event.clientX > box.right - 36) element.scrollLeft += 10;
      else if (event.clientX < box.left + (element.clientWidth < 560 ? 132 : 248) + 36) element.scrollLeft -= 10;
      const delta = (event.clientX - state.x + element.scrollLeft - state.scroll) / scale.get();
      // Below one day the edge resists instead of stopping dead.
      const rubber = (value: number) => (value >= 1 ? value : 1 - (1 - value) * 0.18);
      if (state.mode === "move") start.set(clamp(state.start + delta, 0, days - Math.max(1, state.len)));
      else if (state.mode === "end") len.set(rubber(Math.min(state.len + delta, days - state.start)));
      else {
        const nextStart = Math.max(0, state.start + delta);
        const nextLen = rubber(state.start + state.len - nextStart);
        start.set(state.start + state.len - nextLen);
        len.set(nextLen);
      }
    },
    onPointerUp: release,
    onPointerCancel: release,
  };

  const percent = Math.round((task.progress ?? 0) * 100);

  return <>
    {drag && <motion.span className={styles.snap} data-milestone={task.milestone || undefined} style={{ x: snapX, width: task.milestone ? undefined : snapWidth, y }} aria-hidden="true" />}
    <motion.div
      ref={node => register(task.id, node)}
      role="button"
      tabIndex={tabbable && !hidden ? 0 : -1}
      aria-pressed={selected}
      aria-roledescription={task.milestone ? "Milestone" : "Task bar"}
      aria-label={`${task.name}, ${label(plan.start, plan.len, Boolean(task.milestone))}${task.milestone ? "" : `, ${percent}% done`}${late ? ", starts before a task it depends on ends" : ""}`}
      aria-describedby={describedBy}
      aria-hidden={hidden || undefined}
      inert={hidden}
      className={task.milestone ? styles.milestone : styles.bar}
      data-selected={selected || undefined}
      data-drag={drag ?? undefined}
      data-late={late || undefined}
      data-done={percent === 100 || undefined}
      style={{ x, width: task.milestone ? undefined : width, y, opacity: row.vis }}
      onPointerDown={event => begin(event, "move")}
      {...handlers}
      onFocus={() => onFocusBar(task.id)}
      onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
        const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (direction && event.altKey) {
          event.preventDefault();
          if (event.shiftKey && !task.milestone) onCommit(task.id, plan.start, clamp(plan.len + direction, 1, days - plan.start), "resize");
          else onCommit(task.id, clamp(plan.start + direction, 0, days - Math.max(1, plan.len)), plan.len, "move");
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          onStep(task.id, event.key === "ArrowDown" ? 1 : -1);
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(selected ? null : task.id);
          return;
        }
        if (event.key === "Escape" && selected) {
          event.preventDefault();
          onSelect(null);
        }
      }}
    >
      {task.milestone ? <>
        <span className={styles.diamond} />
        <span className={styles.milestoneLabel}>{task.name}</span>
      </> : <>
        <span className={styles.track}>
          <span className={styles.fill} style={{ width: `${percent}%` }} />
          <span className={styles.barLabel}>
            <span className={styles.barName}>{task.name}</span>
            <span className={styles.pct}>{percent}%</span>
          </span>
        </span>
        <span className={styles.handle} data-edge="start" onPointerDown={event => begin(event, "start")} {...handlers} aria-hidden="true" />
        <span className={styles.handle} data-edge="end" onPointerDown={event => begin(event, "end")} {...handlers} aria-hidden="true" />
      </>}
      <AnimatePresence>
        {drag && <motion.span
          key="tip"
          className={styles.tip}
          data-below={first || undefined}
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: first ? -4 : 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: motionTokens.duration.fast } }}
          transition={reduced ? { duration: motionTokens.duration.instant } : motionTokens.spring.snappy}
        >{label(draft.start, draft.len, Boolean(task.milestone))}</motion.span>}
      </AnimatePresence>
    </motion.div>
  </>;
}

/**
 * A project timeline with tasks grouped by phase. Drag a bar to move it or its edges to change dates, snapped to whole days.
 * Dependency arrows re-route as bars move and turn red when a task starts before one it depends on ends. Zoom glides between
 * day, week, and month, and folded groups slide their rows away. Undo keeps the last twenty changes; Reset restores the plan
 * you passed in.
 */
export function GanttTimeline({
  title = "App relaunch",
  groups = GROUPS,
  tasks,
  defaultTasks = TASKS,
  onTasksChange,
  today = "2026-09-23",
  zoom,
  defaultZoom = "week",
  onZoomChange,
  collapsed,
  defaultCollapsed = DEFAULT_COLLAPSED,
  onCollapsedChange,
  className,
}: GanttTimelineProps) {
  const keysId = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const reduced = useReducedMotion() ?? false;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const barNodes = useRef(new Map<string, HTMLDivElement>());
  const zoomFrame = useRef<{ day: number; view: number } | null>(null);
  const scrollAnimation = useRef<ReturnType<typeof animate> | null>(null);

  const [ownTasks, setOwnTasks] = useState(defaultTasks);
  const list = tasks ?? ownTasks;
  const [ownZoom, setOwnZoom] = useState(defaultZoom);
  const activeZoom = zoom ?? ownZoom;
  const [ownCollapsed, setOwnCollapsed] = useState(defaultCollapsed);
  const folded = collapsed ?? ownCollapsed;
  const [history, setHistory] = useState<GanttTask[][]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [status, setStatus] = useState<{ text: string; tone?: "danger" }>({ text: "Drag a bar to move it, or its edges to change dates" });

  const [stage] = useState(() => new Stage());
  /** The scale the canvas was mounted at; later zoom changes write the CSS variable directly. */
  const [initialScale] = useState(() => SCALES[zoom ?? defaultZoom]);
  const scale = useMotionValue(initialScale);
  const left = narrow ? 132 : 248;

  /** The calendar range is fixed on mount from the default plan, so dragging never reflows it. */
  const [range] = useState(() => {
    const starts = defaultTasks.map(task => parseDay(task.start));
    const ends = defaultTasks.map(task => parseDay(task.milestone ? task.start : task.end));
    const from = Math.min(...starts, parseDay(today)) - 7 * DAY;
    const to = Math.max(...ends, parseDay(today)) + 21 * DAY;
    const origin = from - ((new Date(from).getUTCDay() + 6) % 7) * DAY;
    return { origin, days: 7 * Math.ceil((to - origin) / DAY / 7) };
  });
  const { origin, days } = range;
  const todayIndex = Math.round((parseDay(today) - origin) / DAY);

  const rangeLabel = (start: number, len: number, milestone: boolean) => (milestone || len <= 1 ? dayMonth.format(origin + DAY * start) : `${dayMonth.format(origin + DAY * start)} – ${dayMonth.format(origin + DAY * (start + len - 1))}, ${len} days`);

  const plans = useMemo(() => list.map(task => {
    const start = Math.round((parseDay(task.start) - origin) / DAY);
    return { task, start, len: task.milestone ? 0 : Math.round((parseDay(task.end) - parseDay(task.start)) / DAY) + 1 };
  }), [origin, list]);

  const planById = new Map(plans.map(plan => [plan.task.id, plan]));
  const late = new Set(plans.filter(plan => plan.task.dependsOn?.some(id => {
    const dependency = planById.get(id);
    return dependency && plan.start < dependency.start + dependency.len;
  })).map(plan => plan.task.id));

  const rows: { id: string; y: number; vis: number }[] = [];
  let rowIndex = 0;
  groups.forEach(group => {
    const y = 40 * rowIndex;
    rowIndex += 1;
    rows.push({ id: group.id, y, vis: 1 });
    const isFolded = folded.includes(group.id);
    plans.filter(plan => plan.task.group === group.id).forEach(plan => {
      rows.push({ id: plan.task.id, y: isFolded ? y : 40 * rowIndex, vis: isFolded ? 0 : 1 });
      if (!isFolded) rowIndex += 1;
    });
  });
  rows.forEach(entry => stage.row(entry.id, entry.y, entry.vis));
  plans.forEach(plan => stage.task(plan.task.id, plan.start, plan.len));

  const bodyHeight = useMotionValue(40 * rowIndex);
  const rowKey = rows.map(entry => `${entry.id}:${entry.y}:${entry.vis}`).join("|");

  const visible = plans.filter(plan => !folded.includes(plan.task.group));
  const visibleOrder = groups.flatMap(group => visible.filter(plan => plan.task.group === group.id));

  function scrollTo(element: HTMLDivElement, value: number) {
    scrollAnimation.current?.stop();
    scrollAnimation.current = null;
    if (reduced) {
      element.scrollLeft = value;
      return;
    }
    scrollAnimation.current = animate(element.scrollLeft, value, {
      ...motionTokens.spring.smooth,
      onUpdate: next => {
        element.scrollLeft = next;
      },
    });
  }

  function publish(next: GanttTask[], change: GanttChange) {
    if (tasks === undefined) setOwnTasks(next);
    onTasksChange?.(next, change);
  }

  /** Commits a drag or a keyboard nudge as ISO dates, keeping the undo stack short. */
  function commit(id: string, start: number, len: number, kind: "move" | "resize") {
    const plan = planById.get(id);
    if (!plan || (plan.start === start && plan.len === len)) return;
    const task = plan.task;
    const updated: GanttTask = {
      ...task,
      start: toDay(origin + DAY * start),
      end: toDay(origin + DAY * (task.milestone ? start : start + len - 1)),
    };
    const next = list.map(entry => (entry.id === id ? updated : entry));
    setHistory(current => [...current.slice(-19), list]);
    publish(next, { id, start: updated.start, end: updated.end, kind });

    const before = (updated.dependsOn ?? [])
      .map(key => planById.get(key))
      .filter((dependency): dependency is Plan => dependency !== undefined)
      .filter(dependency => start < dependency.start + dependency.len);
    const after = plans.filter(entry => entry.task.dependsOn?.includes(id) && entry.start < start + len);
    const range = rangeLabel(start, len, Boolean(task.milestone));
    if (before.length) setStatus({ text: `${task.name} now starts before ${before[0].task.name} ends`, tone: "danger" });
    else if (after.length) setStatus({ text: `${after[0].task.name} now starts before ${task.name} ends`, tone: "danger" });
    else setStatus({ text: `${task.name}: ${range}` });
  }

  /** Focuses a bar and scrolls it into view, horizontally and vertically. */
  function focusBar(id: string) {
    const node = barNodes.current.get(id);
    const scroller = scrollerRef.current;
    const plan = planById.get(id);
    if (!node || !scroller || !plan) return;
    node.focus({ preventScroll: true });
    const dayScale = scale.get();
    const view = scroller.clientWidth - left;
    const from = plan.start * dayScale;
    const to = (plan.start + Math.max(1, plan.len)) * dayScale;
    let target = scroller.scrollLeft;
    if (from < scroller.scrollLeft + 16) target = from - 16;
    else if (to > scroller.scrollLeft + view - 16) target = Math.min(from - 16, to - view + 16);
    const y = stage.row(id).y.get();
    const top = scroller.scrollTop;
    const height = scroller.clientHeight - 56;
    if (y < top) scroller.scrollTop = y;
    else if (y + 40 > top + height) scroller.scrollTop = y + 40 - height;
    if (target !== scroller.scrollLeft) scrollTo(scroller, target);
  }

  function step(id: string, direction: number) {
    const index = visibleOrder.findIndex(plan => plan.task.id === id);
    const next = visibleOrder[clamp(index + direction, 0, visibleOrder.length - 1)];
    if (next && next.task.id !== id) {
      setFocused(next.task.id);
      focusBar(next.task.id);
    }
  }

  useEffect(() => {
    const animations = rowKey.split("|").flatMap(entry => {
      const [id, y, vis] = entry.split(":");
      const row = stage.row(id);
      if (reduced) {
        row.y.jump(Number(y));
        row.vis.jump(Number(vis));
        return [];
      }
      return [
        animate(row.y, Number(y), motionTokens.spring.smooth),
        animate(row.vis, Number(vis), { duration: Number(vis) ? motionTokens.duration.standard : motionTokens.duration.fast, ease: [...motionTokens.ease.standard] }),
      ];
    });
    const count = rowKey.split("|").filter(entry => entry.endsWith(":1")).length;
    if (reduced) bodyHeight.jump(40 * count);
    else animations.push(animate(bodyHeight, 40 * count, motionTokens.spring.smooth));
    return () => animations.forEach(animation => animation.stop());
  }, [bodyHeight, reduced, rowKey, stage]);

  /** Writing the scale onto the canvas resizes it every frame; a pending zoom keeps its middle day in place. */
  useEffect(() => {
    const apply = (value: number) => {
      canvasRef.current?.style.setProperty("--gantt-scale", String(value));
      const pending = zoomFrame.current;
      const scroller = scrollerRef.current;
      if (scroller && pending) scroller.scrollLeft = pending.day * value - pending.view / 2;
    };
    apply(scale.get());
    return scale.on("change", apply);
  }, [scale]);

  useLayoutEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;
    const measure = () => setNarrow(element.clientWidth < 560);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const view = element.clientWidth - (element.clientWidth < 560 ? 132 : 248);
    element.scrollLeft = (todayIndex + 0.5) * scale.get() - 0.3 * view;
    return () => observer.disconnect();
  }, [scale, todayIndex]);

  const calendar = useMemo(() => Array.from({ length: days }, (_, index) => {
    const date = new Date(origin + DAY * index);
    return { day: index, date: date.getUTCDate(), weekday: date.getUTCDay(), month: date.getUTCMonth(), time: date.getTime() };
  }), [days, origin]);

  const monthStarts = calendar.filter(entry => entry.date === 1 || entry.day === 0);
  const coarse = activeZoom === "month"
    ? monthStarts.filter(entry => entry.day === 0 || entry.month % 3 === 0).map(entry => ({ day: entry.day, text: `Q${Math.floor(entry.month / 3) + 1} ${new Date(entry.time).getUTCFullYear()}` }))
    : monthStarts.map(entry => ({ day: entry.day, text: monthLong.format(entry.time) }));
  const fine = activeZoom === "day"
    ? calendar.map(entry => ({ day: entry.day, text: String(entry.date), soft: entry.weekday === 0 || entry.weekday === 6 }))
    : activeZoom === "week"
      ? calendar.filter(entry => entry.weekday === 1).map(entry => ({ day: entry.day, text: String(entry.date), soft: false }))
      : monthStarts.filter(entry => entry.date === 1).map(entry => ({ day: entry.day, text: monthShort.format(entry.time), soft: false }));
  const lines = activeZoom === "day"
    ? calendar.map(entry => ({ day: entry.day, strong: entry.weekday === 1 }))
    : activeZoom === "week"
      ? calendar.filter(entry => entry.weekday === 1).map(entry => ({ day: entry.day, strong: entry.date <= 7 }))
      : calendar.filter(entry => entry.weekday === 1 || entry.date === 1).map(entry => ({ day: entry.day, strong: entry.date === 1 }));
  const weekends = activeZoom === "month" ? [] : calendar.filter(entry => entry.weekday === 6).map(entry => entry.day);

  const transition = { duration: reduced ? motionTokens.duration.instant : motionTokens.duration.standard, ease: [...motionTokens.ease.standard] as [number, number, number, number] };

  const done = (() => {
    const bars = plans.filter(plan => !plan.task.milestone);
    const total = bars.reduce((sum, plan) => sum + plan.len, 0);
    return total ? Math.round((bars.reduce((sum, plan) => sum + plan.len * (plan.task.progress ?? 0), 0) / total) * 100) : 0;
  })();

  const tabbable = focused && visible.some(plan => plan.task.id === focused) ? focused : visibleOrder[0]?.task.id;
  const arrows = plans.flatMap(plan => (plan.task.dependsOn ?? []).map(id => planById.get(id)).filter((dependency): dependency is Plan => Boolean(dependency)).map(dependency => ({ from: dependency, to: plan })));

  const canvasVars = {
    "--gantt-left": `${left}px`,
    "--gantt-days": days,
    "--gantt-scale": initialScale,
    "--gantt-row": "40px",
    "--gantt-bar": "24px",
    "--gantt-header": "56px",
  } as CSSProperties;

  const statusIn = reduced ? { opacity: 0 } : { opacity: 0, y: "0.3em", filter: `blur(${motionTokens.blur.subtle}px)` };

  return <section className={[styles.root, className].filter(Boolean).join(" ")} aria-label={title}>
    <header className={styles.toolbar}>
      <div className={styles.heading}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.meta}><span className={styles.num}>{done}%</span> done</p>
      </div>
      <div className={styles.controls}>
        <div className={styles.segmented} role="group" aria-label="Zoom">
          {ZOOMS.map(option => <button
            key={option.id}
            type="button"
            className={styles.segment}
            aria-pressed={activeZoom === option.id}
            onClick={() => {
              if (option.id === activeZoom) return;
              if (zoom === undefined) setOwnZoom(option.id);
              onZoomChange?.(option.id);
              const element = scrollerRef.current;
              if (element) {
                const view = element.clientWidth - left;
                zoomFrame.current = { day: (element.scrollLeft + view / 2) / scale.get(), view };
              }
              const clear = () => {
                zoomFrame.current = null;
              };
              if (reduced) {
                scale.jump(SCALES[option.id]);
                clear();
              } else animate(scale, SCALES[option.id], { ...motionTokens.spring.smooth, onComplete: clear });
            }}
          >
            {activeZoom === option.id && <motion.span layoutId="gantt-zoom" className={styles.segmentThumb} transition={reduced ? { duration: 0 } : motionTokens.spring.morph} />}
            <span className={styles.segmentLabel}>{option.label}</span>
          </button>)}
        </div>
        <button type="button" className={styles.ghost} onClick={() => {
          const element = scrollerRef.current;
          if (!element) return;
          zoomFrame.current = null;
          const value = clamp((todayIndex + 0.5) * scale.get() - (element.clientWidth - left) * 0.3, 0, element.scrollWidth - element.clientWidth);
          scrollTo(element, value);
          setStatus({ text: `Today is ${dayMonth.format(origin + DAY * todayIndex)}` });
        }}>
          <Crosshair size={16} strokeWidth={1.75} aria-hidden="true" />Today
        </button>
      </div>
    </header>
    <div ref={scrollerRef} className={styles.scroller} onWheel={() => {
      zoomFrame.current = null;
      scrollAnimation.current?.stop();
    }} onPointerDown={() => {
      zoomFrame.current = null;
      scrollAnimation.current?.stop();
    }}>
      <div ref={canvasRef} className={styles.canvas} style={canvasVars}>
        <div className={styles.headRow}>
          <div className={styles.corner}>Tasks</div>
          <div className={styles.scale} aria-hidden="true">
            <AnimatePresence initial={false}>
              <motion.div key={activeZoom} className={styles.tiers} data-zoom={activeZoom} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}>
                {coarse.map(entry => <span key={`t${entry.day}`} className={styles.coarse} style={{ "--d": entry.day } as CSSProperties}>{entry.text}</span>)}
                {fine.map(entry => <span key={`f${entry.day}`} className={styles.fine} data-soft={entry.soft || undefined} style={{ "--d": entry.day } as CSSProperties}>{entry.text}</span>)}
              </motion.div>
            </AnimatePresence>
            <span className={styles.todayTag} style={{ "--d": todayIndex } as CSSProperties}>Today</span>
          </div>
        </div>
        <motion.div className={styles.body} style={{ height: bodyHeight }}>
          <div className={styles.names}>
            {groups.map(group => {
              const isFolded = folded.includes(group.id);
              const groupPlans = plans.filter(plan => plan.task.group === group.id);
              return <motion.div key={group.id} className={styles.groupRow} style={{ y: stage.row(group.id).y }}>
                <button type="button" className={styles.groupToggle} aria-expanded={!isFolded} onClick={() => {
                  const next = isFolded ? folded.filter(id => id !== group.id) : [...folded, group.id];
                  if (collapsed === undefined) setOwnCollapsed(next);
                  onCollapsedChange?.(next);
                  if (!isFolded && groupPlans.some(plan => plan.task.id === selected)) setSelected(null);
                }}>
                  <motion.span className={styles.chevron} initial={false} animate={{ rotate: 90 * Number(!isFolded) }} transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}>
                    <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  </motion.span>
                  <span className={styles.groupName}>{group.name}</span>
                  <span className={styles.groupCount}>{groupPlans.length}</span>
                </button>
              </motion.div>;
            })}
            {plans.map(plan => {
              const row = stage.row(plan.task.id);
              const isFolded = folded.includes(plan.task.group);
              const assignee = plan.task.assignee;
              const owner = assignee ? person(assignee) : null;
              return <motion.div
                key={plan.task.id}
                className={styles.taskRow}
                data-selected={selected === plan.task.id || undefined}
                style={{ y: row.y, opacity: row.vis }}
                aria-hidden={isFolded || undefined}
                inert={isFolded}
                onClick={() => {
                  if (isFolded) return;
                  setSelected(current => (current === plan.task.id ? null : plan.task.id));
                  setFocused(plan.task.id);
                  focusBar(plan.task.id);
                }}
              >
                {owner && assignee
                  ? <img className={styles.avatar} src={avatar(assignee)} alt={owner.name} title={owner.name} width={22} height={22} />
                  : <span className={styles.markSlot} aria-hidden="true"><span className={styles.mark} /></span>}
                <span className={styles.taskName}>{plan.task.name}</span>
              </motion.div>;
            })}
          </div>
          <div className={styles.chart}>
            <AnimatePresence initial={false}>
              <motion.div key={activeZoom} className={styles.grid} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition} aria-hidden="true">
                {weekends.map(day => <span key={`w${day}`} className={styles.weekend} style={{ "--d": day } as CSSProperties} />)}
                {lines.map(entry => <span key={`l${entry.day}`} className={styles.line} data-strong={entry.strong || undefined} style={{ "--d": entry.day } as CSSProperties} />)}
              </motion.div>
            </AnimatePresence>
            {groups.map(group => {
              const groupPlans = plans.filter(plan => plan.task.group === group.id);
              return groupPlans.length ? <GroupSummary key={group.id} group={group} plans={groupPlans} stage={stage} scale={scale} /> : null;
            })}
            <svg className={styles.arrows} aria-hidden="true">
              {arrows.map(({ from, to }) => <DependencyArrow
                key={`${from.task.id}>${to.task.id}`}
                from={from}
                to={to}
                stage={stage}
                scale={scale}
                state={selected ? (selected === from.task.id || selected === to.task.id ? "active" : "dim") : undefined}
              />)}
            </svg>
            <span className={styles.today} style={{ "--d": todayIndex } as CSSProperties} aria-hidden="true" />
            {plans.map((plan, index) => <TaskBar
              key={plan.task.id}
              plan={plan}
              stage={stage}
              scale={scale}
              days={days}
              reduced={reduced}
              hidden={folded.includes(plan.task.group)}
              first={visibleOrder[0]?.task.id === plan.task.id || index === 0}
              selected={selected === plan.task.id}
              tabbable={tabbable === plan.task.id}
              late={late.has(plan.task.id)}
              describedBy={`${keysId}-keys`}
              scroller={() => scrollerRef.current}
              onCommit={commit}
              label={rangeLabel}
              onSelect={setSelected}
              onFocusBar={setFocused}
              onStep={step}
              register={(id, node) => {
                if (node) barNodes.current.set(id, node);
                else barNodes.current.delete(id);
              }}
            />)}
          </div>
        </motion.div>
      </div>
    </div>
    <footer className={styles.footer}>
      <p className={styles.status} role="status" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={status.text}
            className={styles.statusText}
            data-tone={status.tone}
            initial={statusIn}
            animate={{ opacity: 1, y: "0em", filter: "blur(0px)" }}
            exit={{ ...statusIn, transition: { duration: motionTokens.duration.instant } }}
            transition={reduced ? { duration: motionTokens.duration.instant } : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}
          >{status.text}</motion.span>
        </AnimatePresence>
      </p>
      <div className={styles.footerActions}>
        <button type="button" className={styles.ghost} onClick={() => {
          const snapshot = history.at(-1);
          if (!snapshot) return;
          setHistory(current => current.slice(0, -1));
          const changed = snapshot.find(task => {
            const live = list.find(entry => entry.id === task.id);
            return live && (live.start !== task.start || live.end !== task.end);
          });
          publish(snapshot, { id: changed?.id ?? "", start: changed?.start ?? "", end: changed?.end ?? "", kind: "undo" });
          setStatus({ text: changed ? `Undid the change to ${changed.name}` : "Undone" });
        }} disabled={!history.length}>
          <Undo2 size={16} strokeWidth={1.75} aria-hidden="true" />Undo
        </button>
        <button type="button" className={styles.ghost} onClick={() => {
          setHistory([]);
          publish(defaultTasks, { id: "", start: "", end: "", kind: "reset" });
          setSelected(null);
          setStatus({ text: "Plan reset" });
        }} disabled={list === defaultTasks}>
          <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />Reset
        </button>
      </div>
    </footer>
    <p id={`${keysId}-keys`} className={styles.srOnly}>Alt and the left or right arrow moves the task by a day. Add Shift to change its end date. Up and down arrows move between tasks.</p>
  </section>;
}

export default GanttTimeline;
