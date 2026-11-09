"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useReducedMotion } from "motion/react";
import { Check, LoaderCircle } from "lucide-react";

import styles from "./date-reel.module.css";

export type DateReelMode = "datetime" | "date" | "time";
export type DateReelMinuteStep = 1 | 5 | 10 | 15 | 30;
export type DateReelHourCycle = 12 | 24;

export interface DateReelPreset {
  label: string;
  value: Date | ((today: Date) => Date);
}

export interface DateReelLabels {
  day: string;
  month: string;
  date: string;
  year: string;
  hour: string;
  minute: string;
  period: string;
  at: string;
  presets: string;
  confirm: string;
  pending: string;
  done: string;
  failed: string;
}

export interface DateReelProps {
  /** Which reels to show: day, hour, minute and AM or PM; month, day and year; or time only. */
  mode?: DateReelMode;
  /** Controlled value. When it changes from outside, every reel spins to it along the short way around. */
  value?: Date;
  /** Starting value when uncontrolled. Pass a fixed date so the first render matches on server and client. */
  defaultValue?: Date;
  /** Called once when the reels come to rest on a new moment, not on every frame. */
  onChange?: (value: Date) => void;
  /** Start of today, used for the Today entry and relative words such as Tomorrow. */
  today?: Date;
  /** Earliest selectable day. The day and year reels stop here with a rubber band. */
  minDate?: Date;
  /** Latest selectable day. */
  maxDate?: Date;
  /** Minutes between entries on the minute reel. */
  minuteStep?: DateReelMinuteStep;
  /** 12 hour clock with an AM or PM reel, or a 24 hour clock. */
  hourCycle?: DateReelHourCycle;
  /** BCP 47 locale for day and month names, the time format, the AM and PM words and relative phrases. */
  locale?: string;
  /** Quick picks under the reels. Choosing one spins every reel to it with a small stagger. */
  presets?: DateReelPreset[] | false;
  /** Optional heading above the summary, such as "Send later". */
  title?: string;
  /** Adds a primary button. Return a promise to show pending, success and failure in place. */
  onConfirm?: (value: Date) => void | Promise<void>;
  /** Words for localization. */
  labels?: Partial<DateReelLabels>;
  /** Spins the reels into place, one after another, the first time the picker scrolls into view. */
  intro?: boolean;
  /** Multiplies the speed of glides, snaps and the intro. */
  speed?: number;
  /** Stops automatic motion. Reels still follow a drag and land on the nearest entry at once. */
  paused?: boolean;
  /** Any CSS color for the active reel in the lens and the chosen quick pick. */
  accent?: string;
  /** Accessible name of the picker group. */
  label?: string;
  /** Class on the root element. */
  className?: string;
  /** Inline styles on the root element. */
  style?: CSSProperties;
}

interface Column {
  key: string;
  name: string;
  count: number;
  loop: boolean;
  align: "start" | "end";
  page: number;
  sizer: string[];
  label: (index: number) => string;
}

interface Formats {
  dayLabel: Intl.DateTimeFormat;
  month: Intl.DateTimeFormat;
  time: Intl.DateTimeFormat;
  full: Intl.DateTimeFormat;
  shortDay: Intl.DateTimeFormat;
  monthDay: Intl.DateTimeFormat;
  relative: Intl.RelativeTimeFormat;
  periods: [string, string];
}

interface Summary {
  headline: string;
  detail: string;
}

type SlotMode = 0 | 1 | 2 | 3 | 4;

interface Slot {
  p: number;
  v: number;
  mode: SlotMode;
  target: number;
  k: number;
  stiff: number;
  damp: number;
  delay: number;
  wheelAt: number;
  samples: { time: number; p: number }[];
}

interface DragState {
  column: number;
  pointer: number;
  y: number;
  p: number;
  moved: boolean;
}

interface Engine {
  slots: Slot[];
  frame: number;
  last: number;
  needsCommit: boolean;
  changed: boolean;
  preview: Date | null;
  summaryKey: string;
  drag: DragState | null;
  visible: boolean;
  rowHeight: number;
  textCache: string[][];
  offCache: boolean[][];
  typeahead: { text: string; at: number };
}

const SLOT_RADIANS = (20 * Math.PI) / 180;
const CYLINDER = 1 / (2 * Math.sin(SLOT_RADIANS / 2));
const VISIBLE_ROWS = 11;
const ROW_SPAN = 5;
const DEFAULT_VALUE = new Date(2026, 8, 24, 9, 30);
/**
 * The reference frame is server-rendered, so its first frame lands about half a second before
 * networkidle; a client-rendered mount starts at networkidle. Advancing the intro glide by that
 * lead keeps the reels in the same place at the same wall clock instead of catching them mid-turn.
 * Measured: at the 1200 ms gate sample the unadvanced intro still sits 0.017 entries (2 px) short.
 */
const INTRO_LEAD = 0.5;

const DEFAULT_LABELS: DateReelLabels = {
  day: "Day",
  month: "Month",
  date: "Day of month",
  year: "Year",
  hour: "Hour",
  minute: "Minute",
  period: "AM or PM",
  at: "at",
  presets: "Quick picks",
  confirm: "Schedule",
  pending: "Scheduling",
  done: "Scheduled",
  failed: "Try again",
};

const DEFAULT_PRESETS: DateReelPreset[] = [
  {
    label: "This evening",
    value: (today) => new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 0),
  },
  {
    label: "Tomorrow",
    value: (today) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 9, 0),
  },
  {
    label: "Monday",
    value: (today) =>
      new Date(today.getFullYear(), today.getMonth(), today.getDate() + ((8 - today.getDay()) % 7 || 7), 9, 0),
  },
];

function mod(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours(), date.getMinutes());
}

function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 864e5);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function rubber(value: number): number {
  return (0.55 * value * 2.4) / (2.4 + 0.55 * value);
}

function makeSlot(p: number): Slot {
  return { p, v: 0, mode: 0, target: p, k: 0, stiff: 0, damp: 0, delay: 0, wheelAt: 0, samples: [] };
}

function relativePhrase(date: Date, today: Date, formats: Formats): string {
  const days = dayDiff(date, today);
  if (Math.abs(days) < 45) return capitalize(formats.relative.format(days, "day"));
  const months = (date.getFullYear() - today.getFullYear()) * 12 + date.getMonth() - today.getMonth();
  if (Math.abs(months) < 18) return capitalize(formats.relative.format(months, "month"));
  return capitalize(formats.relative.format(Math.trunc(months / 12), "year"));
}

function describe(date: Date, mode: DateReelMode, today: Date, formats: Formats, at: string): Summary {
  if (mode === "date") {
    return {
      headline: formats.full.format(date).replace(/,? \d{4}$/, ""),
      detail: `${relativePhrase(date, today, formats)}, ${date.getFullYear()}`,
    };
  }
  const time = formats.time.format(date);
  if (mode === "time") return { headline: time, detail: formats.full.format(date) };
  const days = dayDiff(date, today);
  const day =
    Math.abs(days) <= 1
      ? capitalize(formats.relative.format(days, "day"))
      : days > 1 && days < 7
        ? formats.shortDay.format(date)
        : formats.monthDay.format(date);
  return { headline: `${day} ${at} ${time}`, detail: formats.full.format(date) };
}

export function DateReel({
  mode = "datetime",
  value,
  defaultValue,
  onChange,
  today: todayProp,
  minDate,
  maxDate,
  minuteStep = 5,
  hourCycle = 12,
  locale = "en-US",
  presets = DEFAULT_PRESETS,
  title,
  onConfirm,
  labels,
  intro = true,
  speed = 1,
  paused = false,
  accent,
  label,
  className,
  style,
}: DateReelProps) {
  const copy = useMemo<DateReelLabels>(() => ({ ...DEFAULT_LABELS, ...labels }), [labels]);
  const reduced = useReducedMotion() ?? false;
  const statusId = useId();

  const [initial] = useState<Date>(() => value ?? defaultValue ?? DEFAULT_VALUE);
  const [display, setDisplay] = useState<Date>(initial);
  const [announcement, setAnnouncement] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "failed">("idle");
  const [active, setActive] = useState(-1);

  const todayStart = startOfDay(todayProp ?? initial).getTime();
  const today = useMemo(() => new Date(todayStart), [todayStart]);

  const minStart = startOfDay(
    minDate ?? (mode === "date" ? new Date(today.getFullYear() - 100, 0, 1) : addDays(today, -30)),
  ).getTime();
  const maxStart = startOfDay(
    maxDate ?? (mode === "date" ? new Date(today.getFullYear() + 10, 11, 31) : addDays(today, 365)),
  ).getTime();
  const rangeStart = useMemo(() => new Date(minStart), [minStart]);
  const rangeEnd = useMemo(() => new Date(Math.max(minStart, maxStart)), [minStart, maxStart]);
  const dayCount = dayDiff(rangeEnd, rangeStart) + 1;
  const yearStart = rangeStart.getFullYear();
  const yearCount = rangeEnd.getFullYear() - yearStart + 1;

  const formats = useMemo<Formats>(() => {
    const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, options);
    const twelve = format({ hour: "numeric", hour12: true });
    const period = (hour: number) =>
      twelve.formatToParts(new Date(2026, 0, 1, hour)).find((part) => part.type === "dayPeriod")?.value ??
      (hour < 12 ? "AM" : "PM");
    return {
      dayLabel: format({ weekday: "short", month: "short", day: "numeric" }),
      month: format({ month: "long" }),
      time: format({ hour: "numeric", minute: "2-digit", hour12: hourCycle === 12 }),
      full: format({ weekday: "long", month: "long", day: "numeric", year: "numeric" }),
      shortDay: format({ weekday: "long" }),
      monthDay: format({ weekday: "short", month: "short", day: "numeric" }),
      relative: new Intl.RelativeTimeFormat(locale, { numeric: "auto" }),
      periods: [period(9), period(21)],
    };
  }, [locale, hourCycle]);

  const columns = useMemo<Column[]>(() => {
    const hourColumn: Column =
      hourCycle === 12
        ? {
            key: "hour",
            name: copy.hour,
            count: 12,
            loop: true,
            align: "end",
            page: 3,
            sizer: ["12"],
            label: (index) => String(index === 0 ? 12 : index),
          }
        : {
            key: "hour",
            name: copy.hour,
            count: 24,
            loop: true,
            align: "end",
            page: 6,
            sizer: ["00"],
            label: pad2,
          };
    const minuteColumn: Column = {
      key: "minute",
      name: copy.minute,
      count: 60 / minuteStep,
      loop: true,
      align: "start",
      page: Math.max(1, Math.round(15 / minuteStep)),
      sizer: ["00"],
      label: (index) => pad2(index * minuteStep),
    };
    const periodColumn: Column = {
      key: "period",
      name: copy.period,
      count: 2,
      loop: false,
      align: "start",
      page: 1,
      sizer: [...formats.periods],
      label: (index) => formats.periods[index] ?? "",
    };
    const timeColumns = hourCycle === 12 ? [hourColumn, minuteColumn, periodColumn] : [hourColumn, minuteColumn];

    if (mode === "time") return timeColumns;

    if (mode === "date") {
      const months = Array.from({ length: 12 }, (_, index) => formats.month.format(new Date(2026, index, 1)));
      return [
        {
          key: "month",
          name: copy.month,
          count: 12,
          loop: true,
          align: "start",
          page: 3,
          sizer: months,
          label: (index) => months[index],
        },
        {
          key: "date",
          name: copy.date,
          count: 31,
          loop: true,
          align: "end",
          page: 7,
          sizer: ["00"],
          label: (index) => String(index + 1),
        },
        {
          key: "year",
          name: copy.year,
          count: yearCount,
          loop: false,
          align: "start",
          page: 10,
          sizer: ["0000"],
          label: (index) => String(yearStart + index),
        },
      ];
    }

    const todayOffset = dayDiff(today, rangeStart);
    const todayLabel = capitalize(formats.relative.format(0, "day"));
    const dayLabel = (index: number) =>
      index === todayOffset ? todayLabel : formats.dayLabel.format(addDays(rangeStart, index));
    const shapes = new Map<string, string>([[todayLabel, todayLabel]]);
    for (let index = 0; index < Math.min(dayCount, 400); index++) {
      const shape = dayLabel(index).replace(/\d/g, "0");
      if (!shapes.has(shape)) shapes.set(shape, shape);
    }
    return [
      {
        key: "day",
        name: copy.day,
        count: dayCount,
        loop: false,
        align: "end",
        page: 7,
        sizer: [...shapes.values()],
        label: dayLabel,
      },
      ...timeColumns,
    ];
  }, [mode, hourCycle, minuteStep, formats, copy, today, rangeStart, dayCount, yearStart, yearCount]);

  const toIndexes = useMemo(
    () =>
      (date: Date): number[] => {
        const minute = Math.min(60 / minuteStep - 1, Math.round(date.getMinutes() / minuteStep));
        const hours = date.getHours();
        const time = hourCycle === 12 ? [hours % 12, minute, hours >= 12 ? 1 : 0] : [hours, minute];
        if (mode === "time") return time;
        if (mode === "date") {
          return [date.getMonth(), date.getDate() - 1, clamp(date.getFullYear() - yearStart, 0, yearCount - 1)];
        }
        return [clamp(dayDiff(date, rangeStart), 0, dayCount - 1), ...time];
      },
    [mode, minuteStep, hourCycle, yearStart, yearCount, rangeStart, dayCount],
  );

  const fromIndexes = useMemo(
    () =>
      (values: number[], previous: Date): Date => {
        const clock = (hourIndex: number, minuteIndex: number) => ({
          hour: hourCycle === 12 ? mod(hourIndex, 12) + (values[2] === 1 ? 12 : 0) : mod(hourIndex, 24),
          minute: mod(minuteIndex, 60 / minuteStep) * minuteStep,
        });
        if (mode === "date") {
          const year = yearStart + clamp(values[2], 0, yearCount - 1);
          const month = mod(values[0], 12);
          return new Date(
            year,
            month,
            Math.min(mod(values[1], 31) + 1, daysInMonth(year, month)),
            previous.getHours(),
            previous.getMinutes(),
          );
        }
        if (mode === "time") {
          const { hour, minute } = clock(values[0], values[1]);
          return new Date(previous.getFullYear(), previous.getMonth(), previous.getDate(), hour, minute);
        }
        const day = addDays(rangeStart, clamp(values[0], 0, dayCount - 1));
        const { hour, minute } = clock(values[1], values[2]);
        return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
      },
    [mode, hourCycle, minuteStep, yearStart, yearCount, rangeStart, dayCount],
  );

  const rootRef = useRef<HTMLDivElement | null>(null);
  const reelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const drumRefs = useRef<HTMLSpanElement[][]>([]);
  const lensRefs = useRef<HTMLSpanElement[][]>([]);
  const headlineRef = useRef<HTMLSpanElement | null>(null);
  const detailRef = useRef<HTMLSpanElement | null>(null);
  const displayRef = useRef(display);
  const introPending = useRef(intro);
  const windowTimers = useRef<number[]>([]);

  const [engine] = useState<Engine>(() => ({
    slots: toIndexes(initial).map(makeSlot),
    frame: 0,
    last: 0,
    needsCommit: false,
    changed: false,
    preview: null,
    summaryKey: "",
    drag: null,
    visible: false,
    rowHeight: 36,
    textCache: [],
    offCache: [],
    typeahead: { text: "", at: 0 },
  }));

  const instant = reduced || paused;

  const latest = useRef({
    columns,
    toIndexes,
    fromIndexes,
    formats,
    today,
    copy,
    mode,
    instant,
    speed,
    onChange,
    onConfirm,
  });

  const stepRef = useRef<(now: number) => void>(() => {});
  const tickRef = useRef<(now: number) => void>((now) => stepRef.current(now));

  const indexes = () =>
    engine.slots.map((slot, columnIndex) => {
      const column = latest.current.columns[columnIndex];
      const rounded = Math.round(slot.p);
      return column.loop ? mod(rounded, column.count) : clamp(rounded, 0, column.count - 1);
    });

  const paint = () => {
    const current = latest.current;
    const radius = CYLINDER * engine.rowHeight;
    let dateCount = 31;
    if (current.mode === "date") {
      const monthIndex = current.columns.findIndex((column) => column.key === "month");
      const yearIndex = current.columns.findIndex((column) => column.key === "year");
      const month = mod(Math.round(engine.slots[monthIndex].p), 12);
      const yearColumn = current.columns[yearIndex];
      const year = Number(yearColumn.label(clamp(Math.round(engine.slots[yearIndex].p), 0, yearColumn.count - 1)));
      dateCount = daysInMonth(Number.isFinite(year) ? year : 2026, month);
    }
    current.columns.forEach((column, columnIndex) => {
      const slot = engine.slots[columnIndex];
      const drum = drumRefs.current[columnIndex];
      const lens = lensRefs.current[columnIndex];
      if (!slot || !drum || !lens) return;
      const center = Math.round(slot.p);
      const cache = engine.textCache[columnIndex] ?? (engine.textCache[columnIndex] = []);
      const offCache = engine.offCache[columnIndex] ?? (engine.offCache[columnIndex] = []);
      for (let row = 0; row < VISIBLE_ROWS; row++) {
        const value = center + row - ROW_SPAN;
        const outside = !column.loop && (value < 0 || value >= column.count);
        const label = outside ? "" : column.label(column.loop ? mod(value, column.count) : value);
        const drumNode = drum[row];
        const lensNode = lens[row];
        if (cache[row] !== label && drumNode && lensNode) {
          cache[row] = label;
          drumNode.textContent = label;
          lensNode.textContent = label;
        }
        const off = column.key === "date" && value + 1 > dateCount;
        if (offCache[row] !== off && drumNode && lensNode) {
          offCache[row] = off;
          if (off) {
            drumNode.setAttribute("data-off", "");
            lensNode.setAttribute("data-off", "");
          } else {
            drumNode.removeAttribute("data-off");
            lensNode.removeAttribute("data-off");
          }
        }
        const angle = (value - slot.p) * SLOT_RADIANS;
        if (Math.abs(angle) >= Math.PI / 2) {
          if (drumNode) drumNode.style.opacity = "0";
          if (lensNode) lensNode.style.opacity = "0";
          continue;
        }
        const cos = Math.cos(angle);
        const scale = 4 / (5 - cos);
        const transform = `translate3d(0, ${(radius * Math.sin(angle)).toFixed(2)}px, 0) scale(${scale.toFixed(4)}, ${(cos * scale).toFixed(4)})`;
        if (drumNode) {
          drumNode.style.transform = transform;
          drumNode.style.opacity = (cos ** 1.5).toFixed(3);
        }
        if (lensNode) {
          lensNode.style.transform = transform;
          lensNode.style.opacity = "1";
        }
      }
    });
    const key = engine.preview ? `pin:${engine.preview.getTime()}` : indexes().join(",");
    if (key !== engine.summaryKey) {
      engine.summaryKey = key;
      const summary = describe(
        engine.preview ?? current.fromIndexes(indexes(), displayRef.current),
        current.mode,
        current.today,
        current.formats,
        current.copy.at,
      );
      if (headlineRef.current) headlineRef.current.textContent = summary.headline;
      if (detailRef.current) detailRef.current.textContent = summary.detail;
    }
  };

  const commit = () => {
    const current = latest.current;
    engine.needsCommit = false;
    const values = indexes();
    if (current.mode === "date") {
      const dateIndex = current.columns.findIndex((column) => column.key === "date");
      const expected = current.fromIndexes(values, displayRef.current).getDate() - 1;
      if (values[dateIndex] !== expected) {
        const slot = engine.slots[dateIndex];
        const target = Math.round(slot.p) - (values[dateIndex] - expected);
        if (current.instant) {
          slot.p = target;
          paint();
        } else {
          slot.target = target;
          slot.mode = 3;
          slot.stiff = 300;
          slot.damp = 2 * Math.sqrt(300);
          engine.needsCommit = true;
          startLoop();
          return;
        }
      }
    }
    const next = current.fromIndexes(indexes(), displayRef.current);
    if (next.getTime() !== displayRef.current.getTime()) {
      displayRef.current = next;
      setDisplay(next);
      if (engine.changed) {
        engine.changed = false;
        const summary = describe(next, current.mode, current.today, current.formats, current.copy.at);
        setAnnouncement(`${summary.headline}. ${summary.detail}`);
        setStatus("idle");
        current.onChange?.(next);
      }
    }
  };

  const startLoop = () => {
    if (engine.frame || !engine.visible || document.hidden) return;
    engine.frame = requestAnimationFrame(tickRef.current);
  };

  const legal = (columnIndex: number, target: number) => {
    const column = latest.current.columns[columnIndex];
    const rounded = Math.round(target);
    return column.loop ? rounded : clamp(rounded, 0, column.count - 1);
  };

  const glide = (columnIndex: number, target: number, stiffness = 260, delay = 0) => {
    const slot = engine.slots[columnIndex];
    if (!slot) return;
    engine.needsCommit = true;
    if (latest.current.instant) {
      slot.p = target;
      slot.target = target;
      slot.v = 0;
      slot.mode = 0;
      paint();
      if (!engine.frame) commit();
      return;
    }
    slot.target = target;
    slot.mode = 3;
    slot.stiff = stiffness;
    slot.damp = 2 * Math.sqrt(stiffness);
    slot.delay = delay;
    startLoop();
  };

  const spinTo = (date: Date, stagger = 0) => {
    const current = latest.current;
    const values = current.toIndexes(date);
    if (!current.instant) {
      engine.preview = current.fromIndexes(values, displayRef.current);
      engine.summaryKey = "";
    }
    current.columns.forEach((column, columnIndex) => {
      const slot = engine.slots[columnIndex];
      if (!slot) return;
      const target = column.loop
        ? Math.round(slot.target) +
          ((mod(values[columnIndex] - Math.round(slot.target), column.count) + column.count / 2) % column.count) -
          column.count / 2
        : values[columnIndex];
      glide(columnIndex, Math.round(target), 150, stagger * columnIndex);
    });
  };

  const step = (now: number) => {
    const current = latest.current;
    const delta = Math.min(0.05, (now - (engine.last || now)) / 1000);
    engine.last = now;
    const time = delta * current.speed;
    let moving = false;
    for (let columnIndex = 0; columnIndex < engine.slots.length; columnIndex++) {
      const slot = engine.slots[columnIndex];
      if (slot.mode === 0) continue;
      moving = true;
      if (slot.mode === 1) continue;
      if (slot.delay > 0) {
        slot.delay -= time;
        continue;
      }
      if (slot.mode === 4) {
        const before = slot.p;
        slot.p += (slot.target - slot.p) * (1 - Math.exp(-22 * time));
        slot.v = time > 0 ? (slot.p - before) / time : 0;
        if (now - slot.wheelAt > 100) {
          slot.mode = 3;
          slot.target = legal(columnIndex, slot.target);
          slot.stiff = 260;
          slot.damp = 2 * Math.sqrt(260);
        }
        continue;
      }
      if (slot.mode === 2) {
        const error = (slot.target - slot.p) * Math.exp(-slot.k * time);
        slot.p = slot.target - error;
        slot.v = slot.k * error;
        if (Math.abs(error) < 0.45) {
          const stiffness = clamp(slot.k, 8, 1.75 * slot.k);
          slot.mode = 3;
          slot.stiff = stiffness * stiffness;
          slot.damp = 2 * stiffness;
        }
      }
      if (slot.mode === 3) {
        const substep = 1 / 240;
        for (let elapsed = 0; elapsed < time; elapsed += substep) {
          const slice = Math.min(substep, time - elapsed);
          slot.v += (-slot.stiff * (slot.p - slot.target) - slot.damp * slot.v) * slice;
          slot.p += slot.v * slice;
        }
        if (Math.abs(slot.p - slot.target) < 0.0015 && Math.abs(slot.v) < 0.02) {
          slot.p = slot.target;
          slot.v = 0;
          slot.mode = 0;
        }
      }
    }
    paint();
    if (moving) {
      engine.frame = requestAnimationFrame(tickRef.current);
      return;
    }
    engine.frame = 0;
    engine.last = 0;
    if (engine.preview) {
      engine.preview = null;
      paint();
    }
    if (engine.needsCommit) commit();
  };

  useLayoutEffect(() => {
    stepRef.current = step;
    latest.current = {
      columns,
      toIndexes,
      fromIndexes,
      formats,
      today,
      copy,
      mode,
      instant,
      speed,
      onChange,
      onConfirm,
    };
  });

  const signature = columns.map((column) => `${column.key}:${column.count}`).join("|");
  const signatureRef = useRef(signature);
  useLayoutEffect(() => {
    if (signatureRef.current === signature) return;
    signatureRef.current = signature;
    engine.slots = toIndexes(displayRef.current).map(makeSlot);
    engine.textCache = [];
    engine.offCache = [];
    engine.summaryKey = "";
    paint();
  }, [signature, engine, toIndexes]);

  const stamp = value?.getTime();
  useEffect(() => {
    if (stamp === undefined || stamp === displayRef.current.getTime()) return;
    engine.changed = false;
    spinTo(new Date(stamp));
  }, [stamp]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!introPending.current || instant) root.removeAttribute("data-intro");
    const measure = () => {
      const row = root.querySelector<HTMLElement>("[data-row]");
      const height = row?.getBoundingClientRect().height || 36;
      if (Math.abs(height - engine.rowHeight) > 0.1) {
        engine.rowHeight = height;
        paint();
      }
    };
    measure();
    paint();
    const resize = new ResizeObserver(measure);
    resize.observe(root);
    const intersection = new IntersectionObserver(
      ([entry]) => {
        engine.visible = entry.isIntersecting;
        if (!entry.isIntersecting) {
          cancelAnimationFrame(engine.frame);
          engine.frame = 0;
          engine.last = 0;
          return;
        }
        if (introPending.current) {
          introPending.current = false;
          if (!instant) {
            columns.forEach((column, columnIndex) => {
              const slot = engine.slots[columnIndex];
              const start = column.loop
                ? slot.p - (5 + 2 * columnIndex)
                : slot.p >= 1
                  ? Math.max(0, slot.p - 6)
                  : Math.min(column.count - 1, slot.p + 6);
              if (start === slot.p) return;
              const target = slot.p;
              slot.p = target - (start - target) * Math.exp(-3 * INTRO_LEAD);
              slot.target = target;
              slot.mode = 2;
              slot.k = 3;
              slot.delay = Math.max(0, 0.07 * columnIndex - INTRO_LEAD);
            });
            engine.preview = displayRef.current;
            engine.summaryKey = "";
            paint();
          }
          root.removeAttribute("data-intro");
        }
        if (engine.slots.some((slot) => slot.mode !== 0)) startLoop();
      },
      { threshold: 0.25 },
    );
    intersection.observe(root);
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(engine.frame);
        engine.frame = 0;
        engine.last = 0;
        return;
      }
      if (engine.slots.some((slot) => slot.mode !== 0)) startLoop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(engine.frame);
      engine.frame = 0;
      windowTimers.current.forEach((timer) => clearTimeout(timer));
      windowTimers.current = [];
    };
    // The engine, columns and paint are stable for the lifetime of the mounted root.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!instant) {
      if (engine.slots.some((slot) => slot.mode !== 0 && slot.mode !== 1)) startLoop();
      return;
    }
    let settled = false;
    engine.slots.forEach((slot, columnIndex) => {
      if (slot.mode !== 2 && slot.mode !== 3 && slot.mode !== 4) return;
      slot.p = slot.mode === 4 ? legal(columnIndex, slot.target) : slot.target;
      slot.v = 0;
      slot.mode = 0;
      settled = true;
    });
    if (settled) {
      cancelAnimationFrame(engine.frame);
      engine.frame = 0;
      paint();
      commit();
    }
    // Switching to reduced motion or pausing lands every reel at once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instant]);

  useEffect(() => {
    const removers = reelRefs.current.map((reel, columnIndex) => {
      if (!reel) return () => {};
      const onWheel = (event: WheelEvent) => {
        if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
        event.preventDefault();
        const slot = engine.slots[columnIndex];
        const column = latest.current.columns[columnIndex];
        if (!slot || !column || slot.mode === 1) return;
        const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 240 : 1;
        const distance = (event.deltaY * multiplier) / (1.4 * engine.rowHeight);
        engine.changed = true;
        engine.needsCommit = true;
        engine.preview = null;
        if (!latest.current.instant) {
          if (slot.mode !== 4) slot.target = slot.p;
          slot.target += distance;
          if (!column.loop) slot.target = clamp(slot.target, -0.35, column.count - 0.65);
          slot.mode = 4;
          slot.wheelAt = performance.now();
          startLoop();
          return;
        }
        slot.p += distance;
        if (!column.loop) slot.p = clamp(slot.p, -0.35, column.count - 0.65);
        slot.v = 0;
        slot.target = slot.p;
        slot.mode = 4;
        slot.wheelAt = performance.now();
        paint();
        const timer = window.setTimeout(() => {
          slot.p = legal(columnIndex, slot.p);
          slot.target = slot.p;
          slot.mode = 0;
          paint();
          commit();
        }, 140);
        windowTimers.current.push(timer);
      };
      reel.addEventListener("wheel", onWheel, { passive: false });
      return () => reel.removeEventListener("wheel", onWheel);
    });
    return () => removers.forEach((remove) => remove());
  }, [signature, engine]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>, columnIndex: number) => {
    if (event.button !== 0 || engine.drag) return;
    const slot = engine.slots[columnIndex];
    slot.mode = 1;
    slot.v = 0;
    slot.samples = [{ time: performance.now(), p: slot.p }];
    engine.drag = { column: columnIndex, pointer: event.pointerId, y: event.clientY, p: slot.p, moved: false };
    engine.preview = null;
    engine.changed = true;
    engine.needsCommit = true;
    rootRef.current?.setAttribute("data-dragging", "");
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = engine.drag;
    if (!drag || drag.pointer !== event.pointerId) return;
    const slot = engine.slots[drag.column];
    const column = latest.current.columns[drag.column];
    const delta = event.clientY - drag.y;
    if (Math.abs(delta) > 3) drag.moved = true;
    let position = drag.p - delta / engine.rowHeight;
    if (!column.loop) {
      position =
        position < 0
          ? -rubber(-position)
          : position > column.count - 1
            ? column.count - 1 + rubber(position - (column.count - 1))
            : position;
    }
    slot.p = position;
    const now = performance.now();
    slot.samples.push({ time: now, p: position });
    slot.samples = slot.samples.filter((sample) => now - sample.time < 100);
    if (engine.visible) startLoop();
    else paint();
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = engine.drag;
    if (!drag || drag.pointer !== event.pointerId) return;
    const slot = engine.slots[drag.column];
    engine.drag = null;
    rootRef.current?.removeAttribute("data-dragging");
    if (!drag.moved) {
      const rect = event.currentTarget.getBoundingClientRect();
      const offset = clamp(
        (event.clientY - (rect.top + rect.height / 2)) / (CYLINDER * engine.rowHeight),
        -0.98,
        0.98,
      );
      const steps = Math.round(Math.asin(offset) / SLOT_RADIANS);
      slot.mode = 0;
      glide(drag.column, legal(drag.column, Math.round(slot.p) + steps));
      return;
    }
    const samples = slot.samples;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const span = last && first ? (last.time - first.time) / 1000 : 0;
    const age = last ? performance.now() - last.time : 0;
    const velocity =
      span > 0.008 && age < 90 ? clamp((last.p - first.p) / span, -60, 60) : 0;
    const column = latest.current.columns[drag.column];
    if (latest.current.instant) {
      slot.mode = 0;
      slot.p = legal(drag.column, slot.p + 0.3 * velocity);
      slot.target = slot.p;
      paint();
      commit();
      return;
    }
    const atEdge = !column.loop && (slot.p < 0 || slot.p > column.count - 1);
    const travel = legal(drag.column, slot.p + 0.32 * velocity);
    if (atEdge || Math.abs(velocity) < 0.5) {
      slot.mode = 3;
      slot.target = legal(drag.column, slot.p);
      slot.stiff = 260;
      slot.damp = 2 * Math.sqrt(260);
    } else {
      const ratio = velocity / (travel - slot.p);
      const rejected = !column.loop && Math.round(slot.p + 0.32 * velocity) !== travel;
      if (!rejected && ratio > 2.2 && ratio < 14) {
        slot.mode = 2;
        slot.target = travel;
        slot.k = ratio;
      } else {
        slot.mode = 3;
        slot.target = travel;
        slot.stiff = 170;
        slot.damp = 2 * Math.sqrt(170) * (rejected ? 0.62 : 1);
      }
    }
    engine.needsCommit = true;
    startLoop();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>, columnIndex: number) => {
    const column = latest.current.columns[columnIndex];
    const slot = engine.slots[columnIndex];
    const base = slot.mode === 0 || slot.mode === 3 ? Math.round(slot.target) : Math.round(slot.p);
    let next: number | null = null;
    switch (event.key) {
      case "ArrowUp":
        next = base - 1;
        break;
      case "ArrowDown":
        next = base + 1;
        break;
      case "PageUp":
        next = base - column.page;
        break;
      case "PageDown":
        next = base + column.page;
        break;
      case "Home":
        next = column.loop ? base - mod(base, column.count) : 0;
        break;
      case "End":
        next = column.loop ? base - mod(base, column.count) + column.count - 1 : column.count - 1;
        break;
      case "ArrowLeft":
      case "ArrowRight": {
        event.preventDefault();
        const offset = event.key === "ArrowLeft" ? -1 : 1;
        const target = reelRefs.current[(columnIndex + offset + latest.current.columns.length) % latest.current.columns.length];
        target?.focus();
        return;
      }
      default:
        break;
    }
    if (next === null) {
      if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) return;
      const text = event.key.toLocaleLowerCase();
      const now = performance.now();
      engine.typeahead =
        now - engine.typeahead.at < 900
          ? { text: engine.typeahead.text + text, at: now }
          : { text, at: now };
      const query = engine.typeahead.text;
      const find = (needle: string) => {
        for (let step = 0; step < column.count; step++) {
          const candidate = mod(base + 1 + step - (needle.length > 1 ? 1 : 0), column.count);
          const labelText = column.label(column.loop ? candidate : clamp(candidate, 0, column.count - 1)).toLocaleLowerCase();
          if (labelText.startsWith(needle) || labelText.replace(/^0/, "").startsWith(needle)) return candidate;
        }
        return -1;
      };
      let found = find(query);
      if (found < 0 && query.length > 1) found = find(text);
      if (found < 0) return;
      next = column.loop
        ? base + ((mod(found - base, column.count) + column.count / 2) % column.count) - column.count / 2
        : found;
    }
    event.preventDefault();
    engine.changed = true;
    engine.preview = null;
    glide(columnIndex, legal(columnIndex, Math.round(next)), 300);
  };

  const presetList = presets === false ? [] : presets;
  const presetValue = (preset: DateReelPreset) =>
    typeof preset.value === "function" ? preset.value(today) : preset.value;

  const confirm = async () => {
    if (!onConfirm || status === "pending") return;
    setStatus("pending");
    try {
      await onConfirm(displayRef.current);
      setStatus("done");
      const summary = describe(displayRef.current, mode, today, formats, copy.at);
      setAnnouncement(`${copy.done}. ${summary.headline}`);
    } catch {
      setStatus("failed");
      setAnnouncement(copy.failed);
    }
  };

  const itemsFor = (column: Column, columnIndex: number) => {
    const center = Math.round(engine.slots[columnIndex].p);
    return Array.from({ length: VISIBLE_ROWS }, (_, row) => {
      const value = center + row - ROW_SPAN;
      if (!column.loop && (value < 0 || value >= column.count)) return "";
      return column.label(column.loop ? mod(value, column.count) : value);
    });
  };

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={label ?? (mode === "time" ? "Time" : mode === "date" ? "Date" : "Date and time")}
      className={className ? `${styles.root} ${className}` : styles.root}
      style={accent ? ({ "--dr-accent": accent, ...style } as CSSProperties) : style}
      data-mode={mode}
      data-intro={intro ? "" : undefined}
    >
      <div className={styles.body}>
        <div className={styles.header}>
          {title ? <h3 className={styles.title}>{title}</h3> : null}
          <p className={styles.summary} aria-hidden="true">
            <span ref={headlineRef} className={styles.headline} />
            <span ref={detailRef} className={styles.detail} />
          </p>
        </div>
        <div className={styles.stage}>
          <div className={styles.lens} aria-hidden="true" />
          <div className={styles.reels}>
            {columns.map((column, columnIndex) => {
              const items = itemsFor(column, columnIndex);
              const value2 = Math.round(engine.slots[columnIndex].p);
              const current = column.loop ? mod(value2, column.count) : clamp(value2, 0, column.count - 1);
              return (
                <div
                  key={column.key}
                  ref={(node) => {
                    reelRefs.current[columnIndex] = node;
                  }}
                  className={styles.reel}
                  data-align={column.align}
                  data-active={active === columnIndex ? "" : undefined}
                  style={{ "--dr-i": columnIndex } as CSSProperties}
                  role="spinbutton"
                  tabIndex={0}
                  aria-label={column.name}
                  aria-valuemin={0}
                  aria-valuemax={column.count - 1}
                  aria-valuenow={current}
                  aria-valuetext={column.label(current)}
                  onPointerDown={(event) => onPointerDown(event, columnIndex)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onKeyDown={(event) => onKeyDown(event, columnIndex)}
                  onFocus={() => setActive(columnIndex)}
                  onBlur={() => setActive((previous) => (previous === columnIndex ? -1 : previous))}
                >
                  <span className={styles.sizer} aria-hidden="true" data-row="true">
                    {column.sizer.map((entry, index) => (
                      <span key={`${entry}-${index}`}>{entry}</span>
                    ))}
                  </span>
                  <span className={styles.drum} aria-hidden="true">
                    {items.map((entry, row) => (
                      <span
                        key={row}
                        ref={(node) => {
                          const drum = drumRefs.current[columnIndex] ?? (drumRefs.current[columnIndex] = []);
                          if (node) drum[row] = node;
                        }}
                        className={styles.item}
                      >
                        {entry}
                      </span>
                    ))}
                  </span>
                  <span className={styles.window} aria-hidden="true">
                    {items.map((entry, row) => (
                      <span
                        key={row}
                        ref={(node) => {
                          const lens = lensRefs.current[columnIndex] ?? (lensRefs.current[columnIndex] = []);
                          if (node) lens[row] = node;
                        }}
                        className={styles.lensItem}
                      >
                        {entry}
                      </span>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        {presetList.length > 0 || onConfirm ? (
          <div className={styles.footer}>
            {presetList.length > 0 ? (
              <div className={styles.presets} role="group" aria-label={copy.presets}>
                {presetList.map((preset) => {
                  const presetDate = presetValue(preset);
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      className={styles.preset}
                      aria-pressed={Math.abs(presetDate.getTime() - display.getTime()) < 60000}
                      onClick={() =>
                        spinTo(new Date(clamp(presetDate.getTime(), minStart, maxStart + 864e5 - 6e4)), 0.06)
                      }
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {onConfirm ? (
              <button
                type="button"
                className={styles.confirm}
                data-state={status}
                aria-disabled={status === "pending"}
                onClick={confirm}
              >
                <span className={styles.confirmStack}>
                  <span data-show={status === "idle" ? "" : undefined}>{copy.confirm}</span>
                  <span data-show={status === "pending" ? "" : undefined}>
                    <LoaderCircle className={styles.spin} size={16} strokeWidth={1.75} />
                    {copy.pending}
                  </span>
                  <span data-show={status === "done" ? "" : undefined}>
                    <Check size={16} strokeWidth={1.75} />
                    {copy.done}
                  </span>
                  <span data-show={status === "failed" ? "" : undefined}>{copy.failed}</span>
                </span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <span id={`${statusId}-status`} role="status" aria-live="polite" className={styles.srOnly}>
        {announcement}
      </span>
    </div>
  );
}

export default DateReel;
