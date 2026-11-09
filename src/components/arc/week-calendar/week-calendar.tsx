"use client";

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  motionValue,
  useReducedMotion,
  type MotionStyle,
  type MotionValue,
  type Transition,
} from "motion/react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import SegmentedControl from "../segmented-control/segmented-control";
import { Select } from "../select/select";
import { ArcImage } from "../lib/arc-provider";
import { motionTokens } from "../motion-tokens";
import {
  MINUTES_IN_DAY,
  SAMPLE_CALENDARS,
  SAMPLE_TODAY,
  dayOf,
  instant,
  isWeekend,
  minuteOfDay,
  sampleEvents,
  startOfWeek,
  wallMinutes,
  type Attendee,
  type CalendarEvent,
  type CalendarSource,
} from "./week-calendar-data";
import styles from "./week-calendar.module.css";

export type CalendarView = "week" | "workweek" | "day" | "3day" | "agenda";

type Size = "compact" | "regular" | "wide";

const { duration: motionDuration, ease: motionEase } = motionTokens;
const EASE_ENTER: [number, number, number, number] = [...motionEase.enter];
const PALETTE = new Set(["blue", "green", "violet", "amber", "rose", "teal"]);
const PX_PER_MINUTE = 52 / 60;
const ALL_DAY_ROW = 24;
const MIN_EVENT_HEIGHT = 22;
const SNAP = 15;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const spring = (frequency: number, damping = 0): Transition => {
  const omega = (2 * Math.PI) / (1.2 * frequency);
  return {
    type: "spring",
    stiffness: omega * omega,
    damping: 2 * (1 - damping) * omega,
    mass: 1,
  };
};

const SPRING_SLIDE = spring(0.46);
const SPRING_SETTLE = spring(0.38);
const SPRING_TAP = spring(0.16);

const cx = (...names: Array<string | false | null | undefined>) =>
  names.filter(Boolean).join(" ");

const calVars = (color: string) => ({ "--cal": color }) as CSSProperties;

const resolveColor = (calendar?: CalendarSource) => {
  if (!calendar) return "var(--wc-neutral)";
  return PALETTE.has(calendar.color)
    ? `var(--wc-${calendar.color})`
    : calendar.color;
};

interface DateFmt {
  time: (minutes: number) => string;
  short: (minutes: number) => string;
  range: (start: number, end: number) => string;
  spoken: (start: number, end: number) => string;
  hour: (minutes: number) => string;
  length: (minutes: number) => string;
  dayRange: (start: number, end: number) => string;
  weekdayShort: (day: number) => string;
  weekdayNarrow: (day: number) => string;
  weekdayLong: (day: number) => string;
  date: (day: number) => string;
  monthDay: (day: number) => string;
  longDate: (day: number) => string;
  shortDate: (day: number) => string;
  monthYear: (day: number) => string;
  iso: (day: number) => string;
  fromIso: (value: string) => number | null;
}

function createFmt(locale = "en-US"): DateFmt {
  const format = (options: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" });
    } catch {
      return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" });
    }
  };
  const timeFormat = format({ hour: "numeric", minute: "2-digit" });
  const hourFormat = format({ hour: "numeric" });
  const weekdayShort = format({ weekday: "short" });
  const weekdayNarrow = format({ weekday: "narrow" });
  const weekdayLong = format({ weekday: "long" });
  const dayFormat = format({ day: "numeric" });
  const monthDay = format({ month: "short", day: "numeric" });
  const longDate = format({ weekday: "long", month: "long", day: "numeric" });
  const shortDate = format({ weekday: "short", month: "short", day: "numeric" });
  const withYear = format({
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const rangeYear = format({ month: "short", day: "numeric", year: "numeric" });
  const monthYear = format({ month: "long", year: "numeric" });
  const english = locale.toLowerCase().startsWith("en");
  const at = (minutes: number) => new Date(60_000 * minutes);
  const on = (day: number) => new Date(86_400_000 * day);
  const tidy = (value: string) => value.replace(/\u202f/g, " ").trim();

  const clock = (minutes: number, withPeriod: boolean) => {
    const parts = timeFormat.formatToParts(at(minutes));
    const twelve = parts.some((part) => part.type === "dayPeriod");
    const onTheHour = minuteOfDay(minutes) % 60 === 0;
    let text = "";
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index];
      const next = parts[index + 1];
      if (
        twelve &&
        onTheHour &&
        (part.type === "minute" ||
          (part.type === "literal" && next?.type === "minute"))
      )
        continue;
      if (
        !withPeriod &&
        (part.type === "dayPeriod" ||
          (part.type === "literal" && next?.type === "dayPeriod"))
      )
        continue;
      text += part.value;
    }
    return {
      text: text.replace(/\u202f/g, " ").trim(),
      twelve,
      period: parts.find((part) => part.type === "dayPeriod")?.value,
    };
  };

  return {
    time: (minutes) => clock(minutes, true).text,
    short: (minutes) => clock(minutes, false).text,
    range: (start, end) => {
      const first = clock(start, true);
      const second = clock(end, true);
      const merged =
        first.twelve && first.period === second.period && dayOf(start) === dayOf(end);
      return `${merged ? clock(start, false).text : first.text} – ${second.text}`;
    },
    spoken: (start, end) =>
      tidy(`${timeFormat.format(at(start))} to ${timeFormat.format(at(end))}`),
    hour: (minutes) => tidy(hourFormat.format(at(minutes))),
    length: (minutes) => {
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      if (hours && rest) return `${hours} hr ${rest} min`;
      if (hours) return `${hours} hr`;
      return `${rest} min`;
    },
    dayRange: (start, end) => {
      if (start === end) return rangeYear.format(on(start));
      if (typeof rangeYear.formatRangeToParts !== "function")
        return `${rangeYear.format(on(start))} to ${rangeYear.format(on(end))}`;
      return rangeYear
        .formatRangeToParts(on(start), on(end))
        .map((part) =>
          english &&
          part.source === "shared" &&
          part.type === "literal" &&
          /[\u2013\u2014-]/.test(part.value)
            ? " to "
            : part.value,
        )
        .join("")
        .replace(/\s+/g, " ")
        .trim();
    },
    weekdayShort: (day) => weekdayShort.format(on(day)),
    weekdayNarrow: (day) => weekdayNarrow.format(on(day)),
    weekdayLong: (day) => weekdayLong.format(on(day)),
    date: (day) => dayFormat.format(on(day)),
    monthDay: (day) => monthDay.format(on(day)),
    longDate: (day) => longDate.format(on(day)),
    shortDate: (day) => shortDate.format(on(day)),
    monthYear: (day) => monthYear.format(on(day)),
    iso: (day) => on(day).toISOString().slice(0, 10),
    fromIso: (value) => {
      const [year, month, day] = value.split("-").map(Number);
      return year && month && day ? dayNumberFrom(year, month, day) : null;
    },
  };
}

/** Mirror of the data module helper so the formatter stays import-light. */
const dayNumberFrom = (year: number, month: number, day: number) =>
  Math.round(Date.UTC(year, month - 1, day) / 86_400_000);

const monthOf = (day: number) => {
  const date = new Date(86_400_000 * day);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
};

const monthStart = (day: number) => {
  const { year, month } = monthOf(day);
  return dayNumberFrom(year, month, 1);
};

const shiftMonth = (day: number, delta: number) => {
  const { year, month } = monthOf(day);
  return dayNumberFrom(year, month + delta, 1);
};

const displayView = (view: CalendarView, size: Size): CalendarView => {
  if (size === "compact")
    return view === "week" || view === "workweek" ? "3day" : view;
  return view === "3day" || view === "agenda" ? "week" : view;
};

const daySpan = (view: CalendarView) =>
  view === "day" ? 1 : view === "3day" ? 3 : 7;

function daysFor(
  view: CalendarView,
  anchor: number,
  weekStartsOn: number,
): number[] {
  if (view === "day") return [anchor];
  if (view === "3day") return [anchor, anchor + 1, anchor + 2];
  const first = startOfWeek(anchor, weekStartsOn);
  const week = Array.from({ length: 7 }, (_, index) => first + index);
  return view === "workweek" ? week.filter((day) => !isWeekend(day)) : week;
}

const WIDE_VIEWS = [
  { value: "week", label: "Week" },
  { value: "workweek", label: "Work week" },
  { value: "day", label: "Day" },
];

const COMPACT_VIEWS = [
  { value: "3day", label: "3 days" },
  { value: "day", label: "Day" },
  { value: "agenda", label: "Agenda" },
];

const subscribeNow = (onChange: () => void) => {
  let interval: ReturnType<typeof setInterval> | undefined;
  const timeout = setTimeout(() => {
    onChange();
    interval = setInterval(onChange, 60_000);
  }, 60_000 - (Date.now() % 60_000) + 30);
  return () => {
    clearTimeout(timeout);
    if (interval) clearInterval(interval);
  };
};

const readNow = () => Math.floor(Date.now() / 60_000);

interface Entry {
  id: string;
  event: CalendarEvent;
  start: number;
  end: number;
  allDay: boolean;
  color: string;
  calendarName: string;
}

interface Segment {
  key: string;
  item: Entry;
  index: number;
  start: number;
  end: number;
  head: boolean;
  tail: boolean;
}

interface Place {
  column: number;
  span: number;
  columns: number;
}

interface AllDayBar {
  item: Entry;
  from: number;
  to: number;
  lane: number;
}

interface PaneFrame {
  key: string;
  view: CalendarView;
  days: number[];
  x: MotionValue<number>;
  opacity: MotionValue<number>;
}

interface DragPreview {
  kind: "create" | "move" | "resize";
  id: string | null;
  start: number;
  end: number;
}

interface Draft {
  start: number;
  end: number;
  calendarId: string;
}

interface ToastState {
  id: number;
  message: string;
  undo?: () => void;
}

type PopoverState =
  | { kind: "create" }
  | { kind: "details"; id: string }
  | { kind: "calendars" };

type PointerIntent = "create" | "move" | "resize" | "swipe";

interface DragRecord {
  state: "pending" | "active" | "swipe";
  intent: PointerIntent;
  id: string | null;
  pointerId: number;
  touch: boolean;
  x0: number;
  y0: number;
  x: number;
  y: number;
  t: number;
  vx: number;
  timer: ReturnType<typeof setTimeout> | null;
  anchorDay: number;
  anchorMinute: number;
  grab: number;
  origin: { start: number; end: number };
  base?: number;
  width?: number;
  peeks?: PaneFrame[];
}

const paneStyle = (pane: PaneFrame, columns: number) =>
  ({ x: pane.x, opacity: pane.opacity, "--columns": columns }) as MotionStyle;

type Register = (id: string, node: HTMLElement | null) => void;

function splitSegments(
  item: Entry,
  start: number,
  end: number,
  days: number[],
  dayStart: number,
  dayEnd: number,
): Segment[] {
  const segments: Segment[] = [];
  days.forEach((day, index) => {
    const from = Math.max(start, day * MINUTES_IN_DAY + dayStart);
    const to = Math.min(end, day * MINUTES_IN_DAY + dayEnd);
    if (to <= from) return;
    segments.push({
      key: segments.length ? `${item.id}:${day}` : item.id,
      item,
      index,
      start: from,
      end: to,
      head: start >= day * MINUTES_IN_DAY + dayStart,
      tail: end <= day * MINUTES_IN_DAY + dayEnd,
    });
  });
  return segments;
}

function packDay(
  items: Array<{ id: string; start: number; end: number }>,
  minimum = MIN_EVENT_HEIGHT,
) {
  const sorted = [...items].sort(
    (a, b) =>
      a.start - b.start || b.end - a.end || a.id.localeCompare(b.id),
  );
  const places = new Map<string, Place>();
  const reach = (item: { start: number; end: number }) =>
    Math.max(item.end, item.start + minimum);
  let group: Array<{ id: string; start: number; end: number }> = [];
  let lanes: Array<Array<{ id: string; start: number; end: number }>> = [];
  let furthest = -Infinity;

  const flush = () => {
    const columns = lanes.length;
    for (const item of group) {
      const place = places.get(item.id);
      if (!place) continue;
      let span = 1;
      for (let next = place.column + 1; next < columns; next++) {
        if (
          lanes[next].some(
            (other) => other.start < reach(item) && reach(other) > item.start,
          )
        )
          break;
        span++;
      }
      place.span = span;
      place.columns = columns;
    }
    group = [];
    lanes = [];
  };

  for (const item of sorted) {
    if (item.start >= furthest) {
      flush();
      furthest = -Infinity;
    }
    let lane = lanes.findIndex(
      (laneItems) => reach(laneItems[laneItems.length - 1]) <= item.start,
    );
    if (lane === -1) {
      lane = lanes.length;
      lanes.push([item]);
    } else lanes[lane].push(item);
    places.set(item.id, { column: lane, span: 1, columns: 1 });
    group.push(item);
    furthest = Math.max(furthest, reach(item));
  }
  flush();
  return places;
}

function layoutAllDay(entries: Entry[], days: number[]) {
  const indexOf = new Map(days.map((day, position) => [day, position]));
  const bars: Array<{ item: Entry; from: number; to: number; id: string }> = [];
  for (const item of entries) {
    if (!item.allDay) continue;
    let from = -1;
    let to = -1;
    for (let day = dayOf(item.start); day < dayOf(item.end - 1) + 1; day++) {
      const position = indexOf.get(day);
      if (position === undefined) continue;
      if (from < 0) from = position;
      to = position;
    }
    if (from >= 0) bars.push({ item, from, to, id: item.id });
  }
  const sorted = [...bars].sort(
    (a, b) =>
      a.from - b.from ||
      b.to - b.from - (a.to - a.from) ||
      a.id.localeCompare(b.id),
  );
  const lanes: number[] = [];
  const laneOf = new Map<string, number>();
  for (const bar of sorted) {
    let lane = lanes.findIndex((end) => end < bar.from);
    if (lane === -1) {
      lane = lanes.length;
      lanes.push(bar.to);
    } else lanes[lane] = bar.to;
    laneOf.set(bar.id, lane);
  }
  const withLanes: AllDayBar[] = bars.map((bar) => ({
    ...bar,
    lane: laneOf.get(bar.id) ?? 0,
  }));
  return { bars: withLanes, count: lanes.length };
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

function Faces({
  people,
  size = 20,
  max = 4,
}: {
  people: Attendee[];
  size?: number;
  max?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className={styles.faces} aria-hidden="true">
      {shown.map((person) =>
        person.avatar ? (
          <ArcImage
            key={person.name}
            src={person.avatar}
            alt=""
            width={size}
            height={size}
            className={styles.face}
            style={{ width: size, height: size }}
          />
        ) : (
          <span
            key={person.name}
            className={styles.face}
            data-initials=""
            style={{ width: size, height: size }}
          >
            {initials(person.name)}
          </span>
        ),
      )}
      {extra > 0 && (
        <span
          className={styles.face}
          data-initials=""
          style={{ width: size, height: size }}
        >
          {"+"}
          {extra}
        </span>
      )}
    </span>
  );
}

function Popover({
  anchor,
  rootRef,
  scrollerRef,
  placement = "side",
  width = 340,
  reduced,
  label,
  onClose,
  ignore,
  children,
}: {
  anchor: () => HTMLElement | null;
  rootRef: RefObject<HTMLDivElement | null>;
  scrollerRef: RefObject<HTMLDivElement | null>;
  placement?: "side" | "below";
  width?: number;
  reduced: boolean;
  label: string;
  onClose: () => void;
  ignore?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const root = rootRef.current;
      const node = popoverRef.current;
      if (!root || !node) return;
      const bounds = root.getBoundingClientRect();
      const panelWidth = Math.min(width, bounds.width - 16);
      node.style.width = `${panelWidth}px`;
      const height = node.offsetHeight;
      const target = anchor()?.getBoundingClientRect();
      const box = target
        ? {
            left: target.left - bounds.left,
            right: target.right - bounds.left,
            top: target.top - bounds.top,
            bottom: target.bottom - bounds.top,
          }
        : {
            left: bounds.width / 2,
            right: bounds.width / 2,
            top: 96,
            bottom: 96,
          };
      const scroller = scrollerRef.current?.getBoundingClientRect();
      const ceiling = Math.max(scroller ? scroller.top - bounds.top : 0, -bounds.top) + 8;
      const floor =
        Math.min(
          scroller ? scroller.bottom - bounds.top : bounds.height,
          window.innerHeight - bounds.top,
        ) - 8;
      const limit = Math.max(ceiling, floor - height);
      let left: number;
      let top: number;
      let origin: string;
      if (
        placement === "side" &&
        bounds.width >= 640 &&
        box.right + 10 + panelWidth <= bounds.width - 8
      ) {
        left = box.right + 10;
        top = clamp(box.top - 6, ceiling, limit);
        origin = "left top";
      } else if (
        placement === "side" &&
        bounds.width >= 640 &&
        box.left - 10 - panelWidth >= 8
      ) {
        left = box.left - 10 - panelWidth;
        top = clamp(box.top - 6, ceiling, limit);
        origin = "right top";
      } else {
        left = clamp(
          placement === "below"
            ? box.right - panelWidth
            : (box.left + box.right) / 2 - panelWidth / 2,
          8,
          bounds.width - panelWidth - 8,
        );
        const below = box.bottom + 8;
        const above = box.top - 8 - height;
        if (placement === "below" || below + height <= floor) {
          top = below;
          origin = "center top";
        } else {
          top = above >= ceiling ? above : limit;
          origin = "center bottom";
        }
      }
      node.style.left = `${Math.round(left)}px`;
      node.style.top = `${Math.round(top)}px`;
      node.style.transformOrigin = origin;
    };
    place();
    const scroller = scrollerRef.current;
    scroller?.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    if (popoverRef.current) observer?.observe(popoverRef.current);
    return () => {
      scroller?.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
      observer?.disconnect();
    };
  }, [anchor, placement, rootRef, scrollerRef, width]);

  useEffect(() => {
    popoverRef.current
      ?.querySelector<HTMLElement>("[data-autofocus]")
      ?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (popoverRef.current?.contains(target) || ignore?.current?.contains(target))
        return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [ignore, onClose]);

  return (
    <motion.div
      ref={popoverRef}
      className={styles.popover}
      role="dialog"
      aria-label={label}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={
        reduced
          ? { opacity: 0, transition: { duration: motionDuration.instant } }
          : {
              opacity: 0,
              scale: 0.98,
              transition: {
                duration: motionDuration.instant,
                ease: EASE_ENTER,
              },
            }
      }
      transition={
        reduced
          ? { duration: motionDuration.fast }
          : {
              opacity: { duration: motionDuration.fast },
              scale: motionTokens.spring.smooth,
            }
      }
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {children}
    </motion.div>
  );
}

function CalendarPicker({
  calendars,
  value,
  onChange,
}: {
  calendars: CalendarSource[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className={styles.picker} role="radiogroup" aria-label="Calendar">
      {calendars.map((calendar) => (
        <button
          key={calendar.id}
          type="button"
          role="radio"
          aria-checked={value === calendar.id}
          className={styles.chip}
          style={calVars(resolveColor(calendar))}
          onClick={() => onChange(calendar.id)}
        >
          <span className={styles.dot} aria-hidden="true" />
          {calendar.name}
        </button>
      ))}
    </div>
  );
}

function QuickCreate({
  fmt,
  start,
  end,
  calendars,
  calendarId,
  onCalendar,
  onSave,
  onCancel,
}: {
  fmt: DateFmt;
  start: number;
  end: number;
  calendars: CalendarSource[];
  calendarId: string;
  onCalendar: (id: string) => void;
  onSave: (title: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const id = useId();
  return (
    <form
      className={styles.popBody}
      onSubmit={(event) => {
        event.preventDefault();
        onSave(title);
      }}
    >
      <label htmlFor={id} className={styles.srOnly}>
        Event title
      </label>
      <input
        id={id}
        data-autofocus=""
        className={styles.titleInput}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Add title"
        autoComplete="off"
        enterKeyHint="done"
      />
      <p className={styles.row}>
        <Clock3 size={16} strokeWidth={1.75} aria-hidden="true" />
        <span>
          <span>{fmt.shortDate(dayOf(start))}</span>{" "}
          <span className={styles.muted}>
            {fmt.range(start, end)}, {fmt.length(end - start)}
          </span>
        </span>
      </p>
      <CalendarPicker
        calendars={calendars}
        value={calendarId}
        onChange={onCalendar}
      />
      <div className={styles.popFoot}>
        <span className={styles.hint} aria-hidden="true">
          Press Enter to save
        </span>
        <div className={styles.footActions}>
          <button type="button" className={styles.ghostButton} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={styles.primary}>
            Save
          </button>
        </div>
      </div>
    </form>
  );
}

const QUARTER_HOURS = Array.from({ length: 96 }, (_, index) => SNAP * index);

function EventDetails({
  fmt,
  entry,
  calendars,
  onTitle,
  onTime,
  onCalendar,
  onDelete,
  onClose,
}: {
  fmt: DateFmt;
  entry: Entry;
  calendars: CalendarSource[];
  onTitle: (title: string) => void;
  onTime: (start: number, end: number) => void;
  onCalendar: (id: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(entry.event.title);
  const id = useId();
  const day = dayOf(entry.start);
  const startMinute = minuteOfDay(entry.start);
  const duration = entry.end - entry.start;
  const commit = () => {
    const next = title.trim() || "Untitled event";
    if (next !== entry.event.title) onTitle(next);
  };
  const startOptions = QUARTER_HOURS.includes(startMinute)
    ? QUARTER_HOURS
    : [...QUARTER_HOURS, startMinute].sort((a, b) => a - b);
  const endOptions = Array.from(
    { length: Math.max(1, Math.floor((MINUTES_IN_DAY - startMinute) / SNAP)) },
    (_, index) => entry.start + (index + 1) * SNAP,
  );
  if (!endOptions.includes(entry.end)) {
    endOptions.push(entry.end);
    endOptions.sort((a, b) => a - b);
  }
  const lastDay = entry.allDay ? dayOf(entry.end - 1) : day;
  return (
    <div className={styles.popBody}>
      <div className={styles.popHead}>
        <span
          className={styles.bar}
          style={calVars(
            resolveColor(calendars.find((item) => item.id === entry.event.calendarId)),
          )}
          aria-hidden="true"
        />
        <label htmlFor={`${id}-title`} className={styles.srOnly}>
          Event title
        </label>
        <input
          id={`${id}-title`}
          data-autofocus=""
          className={styles.titleInput}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            commit();
            onClose();
          }}
          placeholder="Untitled event"
          autoComplete="off"
        />
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => {
            commit();
            onClose();
          }}
          aria-label="Close details"
        >
          <X size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      {entry.allDay ? (
        <p className={styles.row}>
          <Clock3 size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>
            {lastDay === day
              ? fmt.longDate(day)
              : `${fmt.shortDate(day)} to ${fmt.shortDate(lastDay)}`}{" "}
            <span className={styles.muted}>All day</span>
          </span>
        </p>
      ) : (
        <div className={styles.row}>
          <Clock3 size={16} strokeWidth={1.75} aria-hidden="true" />
          <div className={styles.timeFields}>
            <label className={styles.srOnly} htmlFor={`${id}-day`}>
              Day
            </label>
            <input
              id={`${id}-day`}
              type="date"
              className={styles.field}
              value={fmt.iso(day)}
              required
              onChange={(event) => {
                const next = fmt.fromIso(event.target.value);
                if (next === null) return;
                const base = next * MINUTES_IN_DAY + startMinute;
                onTime(base, base + duration);
              }}
            />
            <div className={styles.timeRange}>
              <Select
                id={`${id}-start`}
                label="Starts"
                value={String(startMinute)}
                options={startOptions.map((minute) => ({
                  value: String(minute),
                  label: fmt.time(minute),
                }))}
                onValueChange={(value) => {
                  const next = day * MINUTES_IN_DAY + Number(value);
                  onTime(next, next + duration);
                }}
              />
              <span className={styles.muted} aria-hidden="true">
                to
              </span>
              <Select
                id={`${id}-end`}
                label="Ends"
                value={String(entry.end)}
                options={endOptions.map((minute) => ({
                  value: String(minute),
                  label: fmt.time(minute),
                }))}
                onValueChange={(value) => onTime(entry.start, Number(value))}
              />
            </div>
            <span className={styles.duration}>{fmt.length(duration)}</span>
          </div>
        </div>
      )}
      {entry.event.location && (
        <p className={styles.row}>
          <MapPin size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>{entry.event.location}</span>
        </p>
      )}
      {entry.event.attendees && entry.event.attendees.length > 0 && (
        <div className={styles.row}>
          <Users size={16} strokeWidth={1.75} aria-hidden="true" />
          <div className={styles.people}>
            <Faces people={entry.event.attendees} size={24} max={6} />
            <span className={styles.muted}>
              {entry.event.attendees.length === 1
                ? entry.event.attendees[0].name
                : `${entry.event.attendees[0].name} and ${
                    entry.event.attendees.length - 1
                  } more`}
            </span>
          </div>
        </div>
      )}
      <CalendarPicker
        calendars={calendars}
        value={entry.event.calendarId}
        onChange={onCalendar}
      />
      <div className={styles.popFoot}>
        <button type="button" className={styles.danger} onClick={onDelete}>
          <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
          Delete
        </button>
        <button
          type="button"
          className={styles.primary}
          onClick={() => {
            commit();
            onClose();
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

const CalendarList = memo(function CalendarList({
  calendars,
  hidden,
  onToggle,
}: {
  calendars: CalendarSource[];
  hidden: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <ul className={styles.calendarList} aria-label="Calendars">
      {calendars.map((calendar) => {
        const shown = !hidden.has(calendar.id);
        return (
          <li key={calendar.id}>
            <button
              type="button"
              role="checkbox"
              aria-checked={shown}
              className={styles.calendarItem}
              style={calVars(resolveColor(calendar))}
              onClick={() => onToggle(calendar.id)}
            >
              <span className={styles.check} aria-hidden="true">
                {shown && <Check size={12} strokeWidth={2.5} />}
              </span>
              <span className={styles.calendarName}>{calendar.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
});

const MiniMonth = memo(function MiniMonth({
  fmt,
  month,
  weekStartsOn,
  today,
  range,
  onMonth,
  onPick,
}: {
  fmt: DateFmt;
  month: number;
  weekStartsOn: number;
  today: number | null;
  range: number[];
  onMonth: (day: number) => void;
  onPick: (day: number) => void;
}) {
  const first = startOfWeek(month, weekStartsOn);
  const next = shiftMonth(month, 1);
  const rows = Math.ceil((next - first) / 7);
  const inRange = new Set(range);
  return (
    <div className={styles.mini}>
      <div className={styles.miniHead}>
        <span className={styles.miniTitle}>{fmt.monthYear(month)}</span>
        <span className={styles.miniNav}>
          <button
            type="button"
            className={styles.iconButton}
            data-small=""
            onClick={() => onMonth(shiftMonth(month, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            data-small=""
            onClick={() => onMonth(next)}
            aria-label="Next month"
          >
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </span>
      </div>
      <div className={styles.miniGrid}>
        {Array.from({ length: 7 }, (_, index) => (
          <span
            key={`h${index}`}
            className={styles.miniWeekday}
            aria-hidden="true"
          >
            {fmt.weekdayNarrow(first + index)}
          </span>
        ))}
        {Array.from({ length: 7 * rows }, (_, index) => {
          const day = first + index;
          const outside = day < month || day >= next;
          return (
            <button
              key={day}
              type="button"
              className={styles.miniDay}
              data-outside={outside || undefined}
              data-range={inRange.has(day) || undefined}
              data-range-start={(inRange.has(day) && !inRange.has(day - 1)) || undefined}
              data-range-end={(inRange.has(day) && !inRange.has(day + 1)) || undefined}
              data-today={day === today || undefined}
              aria-current={day === today ? "date" : undefined}
              aria-label={fmt.longDate(day)}
              onClick={() => onPick(day)}
            >
              <span>{fmt.date(day)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

function Toast({
  message,
  onUndo,
  onDismiss,
  reduced,
}: {
  message: string;
  onUndo?: () => void;
  onDismiss: () => void;
  reduced: boolean;
}) {
  useEffect(() => {
    const timeout = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timeout);
  }, [onDismiss]);
  return (
    <motion.div
      className={styles.toast}
      role="status"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={
        reduced
          ? { opacity: 0 }
          : {
              opacity: 0,
              y: 8,
              transition: { duration: motionDuration.fast, ease: EASE_ENTER },
            }
      }
      transition={reduced ? { duration: motionDuration.fast } : motionTokens.spring.smooth}
    >
      <span className={styles.toastText}>{message}</span>
      {onUndo && (
        <button type="button" className={styles.toastAction} onClick={onUndo}>
          Undo
        </button>
      )}
      <button
        type="button"
        className={styles.iconButton}
        data-small=""
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        <X size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </motion.div>
  );
}

const HeadPane = memo(function HeadPane({
  pane,
  current,
  today,
  cursor,
  fmt,
  onDay,
}: {
  pane: PaneFrame;
  current: boolean;
  today: number | null;
  cursor: number;
  fmt: DateFmt;
  onDay: (day: number) => void;
}) {
  return (
    <motion.div
      className={styles.headPane}
      style={paneStyle(pane, pane.days.length)}
      aria-hidden={!current || undefined}
      data-current={current || undefined}
    >
      {pane.days.map((day) => (
        <button
          key={day}
          type="button"
          tabIndex={-1}
          className={styles.headDay}
          data-today={day === today || undefined}
          data-weekend={isWeekend(day) || undefined}
          data-cursor={day === cursor || undefined}
          onClick={() => onDay(day)}
          aria-label={`Show ${fmt.longDate(day)}`}
        >
          <span className={styles.weekday}>{fmt.weekdayShort(day)}</span>
          <span className={styles.date}>{fmt.date(day)}</span>
        </button>
      ))}
    </motion.div>
  );
});

const AllDayPane = memo(function AllDayPane({
  pane,
  current,
  items,
  fmt,
  expanded,
  selectedId,
  register,
  onOpen,
  onMore,
}: {
  pane: PaneFrame;
  current: boolean;
  items: Entry[];
  fmt: DateFmt;
  expanded: boolean;
  selectedId: string | null;
  register: Register;
  onOpen: (id: string, node: HTMLElement) => void;
  onMore: () => void;
}) {
  const { days } = pane;
  const columns = days.length;
  const { bars, count } = useMemo(() => layoutAllDay(items, days), [items, days]);
  const rows = count > 3 && !expanded ? 2 : count;
  const overflow = days.map(
    (_, index) =>
      bars.filter((bar) => bar.lane >= rows && bar.from <= index && bar.to >= index)
        .length,
  );
  return (
    <motion.div
      className={styles.allDayPane}
      style={paneStyle(pane, columns)}
      aria-hidden={!current || undefined}
      data-pane=""
    >
      {days.map((day, index) => (
        <span
          key={day}
          className={styles.allDayColumn}
          data-weekend={isWeekend(day) || undefined}
          style={{
            left: `${(index / columns) * 100}%`,
            width: `${100 / columns}%`,
          }}
        />
      ))}
      {bars
        .filter((bar) => bar.lane < rows)
        .map(({ item, from, to, lane }) => {
          const first = dayOf(item.start);
          const last = dayOf(item.end - 1);
          return (
            <button
              key={item.id}
              ref={
                current
                  ? (node) => {
                      if (node) register(item.id, node);
                    }
                  : undefined
              }
              type="button"
              tabIndex={current ? 0 : -1}
              className={styles.allDay}
              data-event-id={item.id}
              data-selected={item.id === selectedId || undefined}
              data-cut-start={first < days[from] || undefined}
              data-cut-end={last > days[to] || undefined}
              style={{
                left: `${(from / columns) * 100}%`,
                width: `${((to - from + 1) / columns) * 100}%`,
                top: ALL_DAY_ROW * lane + 4,
                ...calVars(item.color),
              }}
              aria-label={`${item.event.title}, all day, ${
                first === last
                  ? fmt.longDate(first)
                  : `${fmt.longDate(first)} to ${fmt.longDate(last)}`
              }, ${item.calendarName}`}
              aria-haspopup="dialog"
              onClick={(event) => onOpen(item.id, event.currentTarget)}
            >
              <span className={styles.allDayTitle}>{item.event.title}</span>
            </button>
          );
        })}
      {overflow.map(
        (amount, index) =>
          amount > 0 && (
            <button
              key={`more-${days[index]}`}
              type="button"
              tabIndex={current ? 0 : -1}
              className={styles.more}
              style={{
                left: `${(index / columns) * 100}%`,
                width: `${100 / columns}%`,
                top: ALL_DAY_ROW * rows + 4,
              }}
              onClick={onMore}
              aria-label={`${amount} more all day events on ${fmt.longDate(days[index])}`}
            >
              {amount} more
            </button>
          ),
      )}
    </motion.div>
  );
});

interface EventBlockProps {
  id: string;
  title: string;
  color: string;
  location?: string;
  attendees?: Attendee[];
  top: number;
  height: number;
  left: number;
  width: number;
  time: string;
  label: string;
  past: boolean;
  selected: boolean;
  dragging: boolean;
  placeholder: boolean;
  head: boolean;
  tail: boolean;
  interactive: boolean;
  reduced: boolean;
  register?: Register;
  paneWidth: () => number;
  onEventKey: (id: string, event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  onEventClick: (id: string, event: ReactMouseEvent<HTMLButtonElement>) => void;
}

const EventBlock = memo(function EventBlock({
  id,
  title,
  color,
  location,
  attendees,
  top,
  height,
  left,
  width,
  time,
  label,
  past,
  selected,
  dragging,
  placeholder,
  head,
  tail,
  interactive,
  reduced,
  register,
  paneWidth,
  onEventKey,
  onEventClick,
}: EventBlockProps) {
  const nodeRef = useRef<HTMLElement | null>(null);
  const previous = useRef<{ left: number; top: number } | null>(null);
  const offset = useRef({ x: 0, y: 0 });
  const controls = useRef<ReturnType<typeof animate> | null>(null);

  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = { left, top };
    const node = nodeRef.current;
    if (!from || !node) return;
    const dx = (from.left - left) * paneWidth() + offset.current.x;
    const dy = from.top - top + offset.current.y;
    controls.current?.stop();
    const apply = (progress: number) => {
      offset.current = { x: dx * progress, y: dy * progress };
      node.style.transform = progress
        ? `translate3d(${dx * progress}px, ${dy * progress}px, 0)`
        : "";
    };
    if (reduced || (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5)) apply(0);
    else {
      apply(1);
      controls.current = animate(1, 0, {
        ...(dragging ? SPRING_TAP : SPRING_SETTLE),
        onUpdate: apply,
      });
    }
  }, [left, top, reduced, dragging, paneWidth]);

  useEffect(() => () => controls.current?.stop(), []);

  const setNode = useCallback(
    (node: HTMLElement | null) => {
      nodeRef.current = node;
      if (node && register) register(id, node);
    },
    [register, id],
  );

  const size = height < 30 ? "s" : height < 62 ? "m" : "l";
  const style: CSSProperties = {
    top: top + 1,
    height: Math.max(18, height - 2),
    left: `${100 * left}%`,
    width: `${100 * width}%`,
    ...calVars(color),
  };

  if (placeholder)
    return <div ref={setNode} className={styles.origin} style={style} aria-hidden="true" />;

  return (
    <button
      ref={setNode}
      type="button"
      data-event-id={id}
      className={styles.event}
      data-size={size}
      data-past={past || undefined}
      data-selected={selected || undefined}
      data-dragging={dragging || undefined}
      data-cut-start={!head || undefined}
      data-cut-end={!tail || undefined}
      style={style}
      tabIndex={interactive && !dragging ? 0 : -1}
      aria-label={label}
      aria-haspopup="dialog"
      onKeyDown={(event) => onEventKey(id, event)}
      onClick={(event) => onEventClick(id, event)}
    >
      <span className={styles.eventBody}>
        <span className={styles.eventTitle}>{title}</span>
        <span className={styles.eventTime}>{time}</span>
        {size === "l" && location && (
          <span className={styles.eventMeta}>
            <MapPin size={11} strokeWidth={2} aria-hidden="true" />
            <span>{location}</span>
          </span>
        )}
        {size === "l" && attendees && attendees.length > 1 && (
          <span className={styles.eventFaces}>
            <Faces people={attendees} size={18} max={4} />
          </span>
        )}
      </span>
      {tail && (
        <span className={styles.handle} data-handle="end" aria-hidden="true" />
      )}
    </button>
  );
});

function TimedPane({
  pane,
  current,
  items,
  drag,
  draft,
  draftColor,
  selectedId,
  nowWall,
  today,
  cursor,
  dayStart,
  dayEnd,
  fmt,
  reduced,
  label,
  describedBy,
  register,
  paneWidth,
  onEventKey,
  onEventClick,
  ghostRef,
}: {
  pane: PaneFrame;
  current: boolean;
  items: Entry[];
  drag: DragPreview | null;
  draft: Draft | null;
  draftColor: string;
  selectedId: string | null;
  nowWall: number | null;
  today: number | null;
  cursor: number;
  dayStart: number;
  dayEnd: number;
  fmt: DateFmt;
  reduced: boolean;
  label: string;
  describedBy: string;
  register: Register;
  paneWidth: () => number;
  onEventKey: (id: string, event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  onEventClick: (id: string, event: ReactMouseEvent<HTMLButtonElement>) => void;
  ghostRef: RefObject<HTMLDivElement | null>;
}) {
  const { days } = pane;
  const columns = days.length;
  const first = days[0];
  const last = days[columns - 1];

  const blocks = useMemo(() => {
    const perDay: Segment[][] = days.map(() => []);
    for (const item of items) {
      if (item.allDay) continue;
      if (item.end <= first * MINUTES_IN_DAY + dayStart) continue;
      if (item.start >= last * MINUTES_IN_DAY + dayEnd) continue;
      for (const segment of splitSegments(
        item,
        item.start,
        item.end,
        days,
        dayStart,
        dayEnd,
      ))
        perDay[segment.index].push(segment);
    }
    return perDay
      .flatMap((list) => {
        const places = packDay(
          list.map((segment) => ({
            id: segment.key,
            start: segment.start,
            end: segment.end,
          })),
        );
        return list.map((segment) => ({
          segment,
          place: places.get(segment.key) ?? { column: 0, span: 1, columns: 1 },
        }));
      })
      .sort(
        (a, b) =>
          a.segment.index - b.segment.index ||
          a.segment.start - b.segment.start ||
          a.place.column - b.place.column,
      );
  }, [items, days, first, last, dayStart, dayEnd]);

  const labels = useMemo(() => {
    const map = new Map<string, { label: string; range: string; time: string }>();
    for (const { segment } of blocks) {
      const item = segment.item;
      if (map.has(item.id)) continue;
      const { title, location } = item.event;
      map.set(item.id, {
        label: `${title}, ${fmt.longDate(dayOf(item.start))}, ${fmt.spoken(
          item.start,
          item.end,
        )}, ${item.calendarName}${location ? `, ${location}` : ""}`,
        range: fmt.range(item.start, item.end),
        time: fmt.time(item.start),
      });
    }
    return map;
  }, [blocks, fmt]);

  const dayLabels = useMemo(
    () =>
      days.map((day) => {
        const count = items.filter(
          (item) =>
            item.start < (day + 1) * MINUTES_IN_DAY &&
            item.end > day * MINUTES_IN_DAY,
        ).length;
        return `${fmt.longDate(day)}${day === today ? ", today" : ""}, ${
          count === 0 ? "no events" : count === 1 ? "1 event" : `${count} events`
        }`;
      }),
    [items, days, today, fmt],
  );

  const dragOrigin = drag && drag.id ? drag : null;
  const draggingEntry = dragOrigin
    ? blocks.find(({ segment }) => segment.item.id === dragOrigin.id)?.segment
        .item ?? items.find((item) => item.id === dragOrigin.id)
    : undefined;
  const draggingSegments =
    dragOrigin && draggingEntry
      ? splitSegments(
          draggingEntry,
          dragOrigin.start,
          dragOrigin.end,
          days,
          dayStart,
          dayEnd,
        )
      : [];
  const drawing = drag?.kind === "create" ? drag : draft;

  const todayIndex = nowWall === null ? -1 : days.indexOf(dayOf(nowWall));
  const nowTop = nowWall === null ? 0 : (minuteOfDay(nowWall) - dayStart) * PX_PER_MINUTE;
  const showNow =
    todayIndex >= 0 &&
    nowWall !== null &&
    minuteOfDay(nowWall) >= dayStart &&
    minuteOfDay(nowWall) <= dayEnd;
  const offset = (minutes: number) => (minuteOfDay(minutes) - dayStart) * PX_PER_MINUTE;

  const renderBlock = (
    segment: Segment,
    left: number,
    width: number,
    state: { dragging?: boolean; placeholder?: boolean },
  ) => {
    const item = segment.item;
    const range = labels.get(item.id);
    const duration = segment.end - segment.start;
    return (
      <EventBlock
        key={state.placeholder ? `origin:${segment.key}` : segment.key}
        id={item.id}
        register={
          current && !state.placeholder && segment.key === item.id
            ? register
            : undefined
        }
        title={item.event.title}
        color={item.color}
        location={item.event.location}
        attendees={item.event.attendees}
        top={offset(segment.start)}
        height={duration * PX_PER_MINUTE}
        left={left}
        width={width}
        time={
          state.dragging && dragOrigin
            ? fmt.range(dragOrigin.start, dragOrigin.end)
            : duration * PX_PER_MINUTE < 30
              ? range?.time ?? ""
              : range?.range ?? ""
        }
        label={range?.label ?? item.event.title}
        past={nowWall !== null && item.end <= nowWall}
        selected={item.id === selectedId}
        dragging={Boolean(state.dragging)}
        placeholder={Boolean(state.placeholder)}
        head={segment.head}
        tail={segment.tail}
        interactive={current}
        reduced={reduced}
        paneWidth={paneWidth}
        onEventKey={onEventKey}
        onEventClick={onEventClick}
      />
    );
  };

  const content: ReactNode[] = [];
  for (const { segment, place } of blocks) {
    if (dragOrigin && segment.item.id === dragOrigin.id) {
      if (segment.key === segment.item.id) {
        for (const ghostSegment of draggingSegments)
          content.push(
            renderBlock(ghostSegment, ghostSegment.index / columns, 1 / columns, {
              dragging: true,
            }),
          );
      }
      continue;
    }
    content.push(
      renderBlock(
        segment,
        (segment.index + place.column / place.columns) / columns,
        place.span / place.columns / columns,
        {},
      ),
    );
  }

  return (
    <motion.div
      className={styles.pane}
      style={paneStyle(pane, columns)}
      data-current={current || undefined}
      data-pane=""
      aria-hidden={!current || undefined}
    >
      <div
        className={styles.grid}
        role="grid"
        aria-label={label}
        aria-describedby={describedBy}
        aria-readonly="true"
      >
        <div role="row" className={styles.gridRow}>
          {days.map((day, index) => (
            <div
              key={day}
              role="gridcell"
              data-day-cell={day}
              tabIndex={current && day === cursor ? 0 : -1}
              className={styles.column}
              data-weekend={isWeekend(day) || undefined}
              data-today={day === today || undefined}
              aria-label={dayLabels[index]}
              style={{
                left: `${(index / columns) * 100}%`,
                width: `${100 / columns}%`,
              }}
            />
          ))}
        </div>
      </div>
      {showNow && (
        <>
          <div className={styles.nowRow} style={{ top: nowTop }} aria-hidden="true" />
          <div
            className={styles.now}
            style={{
              top: nowTop,
              left: `${(todayIndex / columns) * 100}%`,
              width: `${100 / columns}%`,
            }}
            aria-hidden="true"
          />
        </>
      )}
      {dragOrigin && (
        <div className={styles.events} aria-hidden="true">
          {blocks
            .filter(({ segment }) => segment.item.id === dragOrigin.id)
            .map(({ segment, place }) =>
              renderBlock(
                segment,
                (segment.index + place.column / place.columns) / columns,
                place.span / place.columns / columns,
                { placeholder: true },
              ),
            )}
        </div>
      )}
      <div className={styles.events}>
        {content}
        {draggingSegments.length > 0 && dragOrigin && (
          <div
            className={styles.dragLabel}
            style={{
              top: offset(draggingSegments[0].start),
              left: `${(draggingSegments[0].index / columns) * 100}%`,
              width: `${100 / columns}%`,
            }}
            aria-hidden="true"
          >
            <span>{fmt.range(dragOrigin.start, dragOrigin.end)}</span>
          </div>
        )}
      </div>
      {drawing && dayOf(drawing.start) >= first && dayOf(drawing.start) <= last && (
        <div
          ref={current ? ghostRef : undefined}
          className={styles.ghost}
          data-drawing={drag?.kind === "create" || undefined}
          style={{
            top: offset(drawing.start),
            height: Math.max(18, (drawing.end - drawing.start) * PX_PER_MINUTE - 2),
            left: `${(days.indexOf(dayOf(drawing.start)) / columns) * 100}%`,
            width: `${100 / columns}%`,
            ...calVars(draftColor),
          }}
          aria-hidden="true"
        >
          <span className={styles.ghostInner}>
            <span className={styles.ghostTitle}>New event</span>
            <span className={styles.ghostTime}>
              {fmt.range(drawing.start, drawing.end)}
            </span>
          </span>
        </div>
      )}
    </motion.div>
  );
}

const AgendaPane = memo(function AgendaPane({
  pane,
  current,
  items,
  fmt,
  today,
  selectedId,
  register,
  onOpen,
}: {
  pane: PaneFrame;
  current: boolean;
  items: Entry[];
  fmt: DateFmt;
  today: number | null;
  selectedId: string | null;
  register: Register;
  onOpen: (id: string, node: HTMLElement) => void;
}) {
  const { days } = pane;
  const grouped = useMemo(
    () =>
      days.map((day) =>
        items
          .filter(
            (item) =>
              item.start < (day + 1) * MINUTES_IN_DAY &&
              item.end > day * MINUTES_IN_DAY,
          )
          .sort(
            (a, b) =>
              Number(b.allDay) - Number(a.allDay) ||
              a.start - b.start ||
              a.end - b.end,
          ),
      ),
    [items, days],
  );
  return (
    <motion.div
      className={styles.agenda}
      style={paneStyle(pane, days.length)}
      aria-hidden={!current || undefined}
      data-pane=""
    >
      {days.map((day, index) => (
        <section
          key={day}
          className={styles.agendaDay}
          aria-label={fmt.longDate(day)}
        >
          <h3 className={styles.agendaHead} data-today={day === today || undefined}>
            <span className={styles.agendaDate}>{fmt.date(day)}</span>
            <span className={styles.agendaWeekday}>
              {fmt.weekdayLong(day)}
              <span className={styles.muted}>{fmt.monthDay(day)}</span>
            </span>
            {day === today && <span className={styles.todayTag}>Today</span>}
          </h3>
          {grouped[index].length === 0 ? (
            <p className={styles.agendaEmpty}>Nothing planned</p>
          ) : (
            <ul className={styles.agendaList}>
              {grouped[index].map((item) => (
                <li key={item.id}>
                  <button
                    ref={
                      current && Math.max(dayOf(item.start), days[0]) === day
                        ? (node) => {
                            if (node) register(item.id, node);
                          }
                        : undefined
                    }
                    type="button"
                    tabIndex={current ? 0 : -1}
                    className={styles.agendaItem}
                    data-event-id={item.id}
                    data-selected={item.id === selectedId || undefined}
                    style={calVars(item.color)}
                    aria-haspopup="dialog"
                    onClick={(event) => onOpen(item.id, event.currentTarget)}
                    aria-label={`${item.event.title}, ${
                      item.allDay ? "all day" : fmt.spoken(item.start, item.end)
                    }, ${item.calendarName}${
                      item.event.location ? `, ${item.event.location}` : ""
                    }`}
                  >
                    <span className={styles.agendaTime}>
                      {item.allDay ? (
                        "All day"
                      ) : (
                        <>
                          {fmt.time(item.start)}
                          <span className={styles.muted}>{fmt.time(item.end)}</span>
                        </>
                      )}
                    </span>
                    <span className={styles.agendaBar} aria-hidden="true" />
                    <span className={styles.agendaText}>
                      <span className={styles.agendaTitle}>{item.event.title}</span>
                      {item.event.location && (
                        <span className={styles.muted}>{item.event.location}</span>
                      )}
                    </span>
                    {item.event.attendees && item.event.attendees.length > 1 && (
                      <Faces people={item.event.attendees} size={22} max={3} />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </motion.div>
  );
});

const ViewSwitch = memo(function ViewSwitch({
  views,
  value,
  onChange,
}: {
  views: Array<{ value: string; label: string }>;
  value: CalendarView;
  onChange: (view: CalendarView) => void;
}) {
  return (
    <SegmentedControl
      options={views}
      value={value}
      onValueChange={(next) => onChange(next as CalendarView)}
      label="View"
    />
  );
});

export interface WeekCalendarProps {
  events?: CalendarEvent[];
  defaultEvents?: CalendarEvent[];
  onEventsChange?: (events: CalendarEvent[]) => void;
  onCreate?: (event: CalendarEvent) => void;
  onUpdate?: (event: CalendarEvent, previous: CalendarEvent) => void;
  onDelete?: (event: CalendarEvent) => void;
  calendars?: CalendarSource[];
  defaultDate?: Date;
  defaultView?: CalendarView;
  onViewChange?: (view: CalendarView) => void;
  weekStartsOn?: number;
  startHour?: number;
  endHour?: number;
  timeZone?: string;
  locale?: string;
  className?: string;
}

export function WeekCalendar({
  events: controlledEvents,
  defaultEvents,
  onEventsChange,
  onCreate,
  onUpdate,
  onDelete,
  calendars,
  defaultDate,
  defaultView = "week",
  onViewChange,
  weekStartsOn = 1,
  startHour = 0,
  endHour = 24,
  timeZone,
  locale = "en-US",
  className,
}: WeekCalendarProps) {
  const sampleMode =
    controlledEvents === undefined && defaultEvents === undefined;
  const reduced = useReducedMotion() ?? false;
  const fmt = useMemo(() => createFmt(locale), [locale]);
  const sources = calendars ?? SAMPLE_CALENDARS;
  const firstHour = clamp(Math.floor(startHour), 0, 23);
  const lastHour = clamp(Math.ceil(endHour), firstHour + 1, 24);
  const dayStart = 60 * firstHour;
  const dayEnd = 60 * lastHour;
  const surfaceHeight = (dayEnd - dayStart) * PX_PER_MINUTE;
  const describedBy = useId();

  const [localEvents, setLocalEvents] = useState<CalendarEvent[]>(
    () => defaultEvents ?? sampleEvents(timeZone),
  );
  const events = controlledEvents ?? localEvents;

  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(sources.filter((source) => source.hidden).map((source) => source.id)),
  );

  const nowMinute = useSyncExternalStore(subscribeNow, readNow, () => null);
  const nowWall =
    nowMinute === null ? null : wallMinutes(new Date(60_000 * nowMinute), timeZone);
  const today = nowWall === null ? null : dayOf(nowWall);

  const [tzName, setTzName] = useState("");
  const [anchor, setAnchor] = useState<number | null>(() =>
    defaultDate
      ? dayOf(wallMinutes(defaultDate, timeZone))
      : sampleMode
        ? dayOf(wallMinutes(SAMPLE_TODAY, timeZone))
        : null,
  );
  const [view, setView] = useState<CalendarView>(defaultView);
  const [size, setSize] = useState<Size>("regular");
  const displayed = displayView(view, size);
  const days = useMemo(
    () => daysFor(displayed, anchor ?? today ?? dayOf(wallMinutes(SAMPLE_TODAY, timeZone)), weekStartsOn),
    [displayed, anchor, today, weekStartsOn, timeZone],
  );
  const paneKey = `${displayed}:${days[0]}:${days.length}`;

  const [cursorDay, setCursorDay] = useState<number | null>(null);
  const cursor =
    cursorDay !== null && days.includes(cursorDay)
      ? cursorDay
      : today !== null && days.includes(today)
        ? today
        : days[0];

  const [seed, setSeed] = useState<PaneFrame | null>(null);
  const [leaving, setLeaving] = useState<PaneFrame[]>([]);
  const [peek, setPeek] = useState<PaneFrame[]>([]);
  const currentPane = useMemo<PaneFrame>(() => {
    const previous = seed?.key === paneKey ? seed : null;
    return {
      key: paneKey,
      view: displayed,
      days,
      x: motionValue(previous?.x.get() ?? 0),
      opacity: motionValue(previous?.opacity.get() ?? 1),
    };
  }, [paneKey, displayed, days, seed]);

  const [drag, setDrag] = useState<DragPreview | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [live, setLive] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [month, setMonth] = useState<number | null>(null);
  const miniMonth = month ?? monthStart(cursor);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const agendaRef = useRef<HTMLDivElement | null>(null);
  const hoverRef = useRef<HTMLDivElement | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const detailsAnchorRef = useRef<HTMLElement | null>(null);
  const calendarsButtonRef = useRef<HTMLButtonElement | null>(null);
  const newEventButtonRef = useRef<HTMLButtonElement | null>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const pointerRef = useRef<DragRecord | null>(null);
  const eventsRef = useRef(events);
  const toastSeq = useRef(0);
  const focusRow = useRef<number | null>(null);
  const popoverAnchorRef = useRef<HTMLElement | null>(null);
  const scrollOwnerRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const width = node.clientWidth;
      setSize(width < 640 ? "compact" : width >= 1100 ? "wide" : "regular");
      try {
        const parts = new Intl.DateTimeFormat(locale, {
          timeZone,
          timeZoneName: "short",
        }).formatToParts(new Date());
        setTzName(parts.find((part) => part.type === "timeZoneName")?.value ?? "");
      } catch {
        setTzName("");
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [locale, timeZone]);

  useEffect(() => {
    const stops: Array<() => void> = [];
    if (currentPane.x.get() !== 0)
      stops.push(animate(currentPane.x, 0, SPRING_SLIDE).stop);
    if (currentPane.opacity.get() !== 1)
      stops.push(
        animate(currentPane.opacity, 1, {
          duration: motionDuration.standard,
          ease: EASE_ENTER,
        }).stop,
      );
    return () => stops.forEach((stop) => stop());
  }, [currentPane]);

  const calendarById = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );

  const entries = useMemo<Entry[]>(
    () =>
      events.flatMap((event) => {
        if (hidden.has(event.calendarId)) return [];
        const source = calendarById.get(event.calendarId);
        let start = wallMinutes(event.start, timeZone);
        let end = wallMinutes(event.end, timeZone);
        if (event.allDay) {
          start = MINUTES_IN_DAY * dayOf(start);
          end = Math.max(start + MINUTES_IN_DAY, MINUTES_IN_DAY * Math.ceil(end / MINUTES_IN_DAY));
        } else end = Math.max(end, start + 15);
        return [
          {
            id: event.id,
            event,
            start,
            end,
            allDay: Boolean(event.allDay),
            color: resolveColor(source),
            calendarName: source?.name ?? "Calendar",
          },
        ];
      }),
    [events, hidden, calendarById, timeZone],
  );

  const entryById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const fallbackCalendarId =
    sources.find((source) => !hidden.has(source.id))?.id ?? sources[0]?.id ?? "default";
  const rangeLabel = fmt.dayRange(days[0], days[days.length - 1]);
  const agendaActive = displayed === "agenda";

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || agendaActive) return;
    const switched = scrollOwnerRef.current !== scroller;
    if (switched || !scroller.dataset.now) {
      scrollOwnerRef.current = scroller;
      if (nowWall !== null && days.includes(dayOf(nowWall))) {
        scroller.dataset.now = "1";
        scroller.scrollTop = Math.max(
          0,
          (minuteOfDay(nowWall) - dayStart) * PX_PER_MINUTE - 0.3 * scroller.clientHeight,
        );
      } else if (switched) scroller.scrollTop = Math.max(0, (480 - dayStart) * PX_PER_MINUTE - 8);
    }
  }, [nowWall, days, dayStart, agendaActive]);

  useEffect(() => {
    const pending = focusRow.current;
    if (pending === null) return;
    focusRow.current = null;
    scrollerRef.current
      ?.querySelector<HTMLElement>(`[data-current] [data-day-cell="${pending}"]`)
      ?.focus({ preventScroll: true });
  }, [cursor, currentPane]);

  const paneWidth = useCallback(
    () => (surfaceRef.current ?? agendaRef.current)?.clientWidth ?? 600,
    [],
  );

  const register = useCallback<Register>((id, node) => {
    if (!node) {
      nodes.current.delete(id);
      return;
    }
    nodes.current.set(id, node);
  }, []);

  const switchPanes = (options: {
    view?: CalendarView;
    anchor?: number;
    cursor?: number | null;
    dir?: number;
    offset?: number;
  }) => {
    const nextView = displayView(options.view ?? view, size);
    const nextAnchor = options.anchor ?? (anchor ?? today ?? dayOf(wallMinutes(SAMPLE_TODAY, timeZone)));
    const nextDays = daysFor(nextView, nextAnchor, weekStartsOn);
    const key = `${nextView}:${nextDays[0]}:${nextDays.length}`;
    setAnchor(nextAnchor);
    setMonth(null);
    if (options.cursor !== undefined) setCursorDay(options.cursor);
    if (options.view && options.view !== view) {
      setView(options.view);
      onViewChange?.(nextView);
    }
    const shift = options.offset ?? 0;
    if (key === currentPane.key) {
      if (shift) animate(currentPane.x, 0, SPRING_SLIDE);
      return;
    }
    setPopover(null);
    setDraft(null);
    setDrag(null);
    setPeek([]);
    const direction = options.dir ?? 0;
    const width = paneWidth();
    const sameSurface = (nextView === "agenda") === (currentPane.view === "agenda");
    const outgoing = currentPane;
    const drop = () =>
      setLeaving((previous) => previous.filter((frame) => frame !== outgoing));
    if (sameSurface) {
      setLeaving((previous) => [...previous.filter((frame) => frame.key !== key), outgoing]);
      if (reduced || !direction) {
        setSeed({ key, view: nextView, days: nextDays, x: motionValue(0), opacity: motionValue(0) });
        animate(currentPane.opacity, 0, { duration: motionDuration.fast, onComplete: drop });
      } else {
        setSeed({
          key,
          view: nextView,
          days: nextDays,
          x: motionValue(direction * width + shift),
          opacity: motionValue(1),
        });
        animate(currentPane.x, -direction * width, { ...SPRING_SLIDE, onComplete: drop });
      }
    } else {
      setSeed({ key, view: nextView, days: nextDays, x: motionValue(0), opacity: motionValue(0) });
      setLeaving([]);
    }
    const nextLabel =
      nextView === "day"
        ? fmt.longDate(nextDays[0])
        : fmt.dayRange(nextDays[0], nextDays[nextDays.length - 1]);
    setLive(
      nextView === displayed
        ? nextLabel
        : `${
            nextView === "agenda"
              ? "Agenda"
              : nextView === "day"
                ? "Day view"
                : nextView === "3day"
                  ? "Three days"
                  : nextView === "workweek"
                    ? "Work week"
                    : "Week"
          }, ${nextLabel}`,
    );
  };

  const step = (direction: number, offset = 0) => {
    const span = daySpan(displayed);
    const base = anchor ?? today ?? dayOf(wallMinutes(SAMPLE_TODAY, timeZone));
    switchPanes({
      anchor: base + direction * span,
      cursor: cursorDay === null ? null : cursor + direction * span,
      dir: direction,
      offset,
    });
  };

  const goToday = () => {
    if (today === null) return;
    switchPanes({ anchor: today, cursor: today, dir: Math.sign(today - days[0]) });
  };

  const goDay = (day: number) =>
    switchPanes({
      anchor: day,
      cursor: day,
      dir:
        Math.sign(day - days[0]) ||
        Number(day > days[days.length - 1]) - Number(day < days[0]),
    });

  const applyEvents = (next: CalendarEvent[]) => {
    eventsRef.current = next;
    if (controlledEvents === undefined) setLocalEvents(next);
    onEventsChange?.(next);
  };

  const notify = (message: string, undo?: () => void) =>
    setToast({ id: ++toastSeq.current, message, undo });

  const applyUpdate = (
    id: string,
    patch: Partial<CalendarEvent>,
    message: string,
  ) => {
    const list = eventsRef.current;
    const previous = list.find((event) => event.id === id);
    if (!previous) return null;
    const next: CalendarEvent = { ...previous, ...patch };
    applyEvents(list.map((event) => (event.id === id ? next : event)));
    onUpdate?.(next, previous);
    setLive(message);
    return { previous, next };
  };

  const updateWithUndo = (
    id: string,
    patch: Partial<CalendarEvent>,
    message: string,
  ) => {
    const result = applyUpdate(id, patch, message);
    if (!result) return;
    notify(message, () => {
      applyEvents(
        eventsRef.current.map((event) =>
          event.id === id ? result.previous : event,
        ),
      );
      onUpdate?.(result.previous, result.next);
      setLive(`Undone: ${message}`);
      setToast(null);
    });
  };

  const removeEvent = (id: string) => {
    const list = eventsRef.current;
    const index = list.findIndex((event) => event.id === id);
    if (index < 0) return;
    const removed = list[index];
    applyEvents(list.filter((event) => event.id !== id));
    onDelete?.(removed);
    setSelectedId(null);
    setPopover(null);
    requestAnimationFrame(() =>
      scrollerRef.current
        ?.querySelector<HTMLElement>(
          `[data-current] [data-day-cell="${dayOf(wallMinutes(removed.start, timeZone))}"]`,
        )
        ?.focus({ preventScroll: true }),
    );
    const message = `Deleted ${removed.title}`;
    setLive(message);
    notify(message, () => {
      const restored = [...eventsRef.current];
      restored.splice(Math.min(index, restored.length), 0, removed);
      applyEvents(restored);
      onCreate?.(removed);
      setSelectedId(removed.id);
      setLive(`Restored ${removed.title}`);
      setToast(null);
    });
  };

  const toDates = (start: number, end: number) => ({
    start: instant(start, timeZone),
    end: instant(end, timeZone),
  });

  const startCreate = (start: number, end: number) => {
    setDrag(null);
    setSelectedId(null);
    setDraft({ start, end, calendarId: fallbackCalendarId });
    setPopover({ kind: "create" });
    const scroller = scrollerRef.current;
    if (!scroller || agendaActive) return;
    const top = (minuteOfDay(start) - dayStart) * PX_PER_MINUTE;
    const bottom = top + (end - start) * PX_PER_MINUTE;
    const head = headRef.current?.offsetHeight ?? 0;
    if (top < scroller.scrollTop + 8) scroller.scrollTop = top - 24;
    else if (bottom > scroller.scrollTop + scroller.clientHeight - head - 8)
      scroller.scrollTop = bottom - scroller.clientHeight + head + 48;
  };

  const addEvent = () => {
    if (agendaActive)
      switchPanes({ view: "day", anchor: cursor, cursor, dir: 0 });
    const base = cursor;
    let minute = clamp(
      today === base && nowWall !== null
        ? 30 * Math.ceil(minuteOfDay(nowWall) / 30)
        : 540,
      dayStart,
      dayEnd - 60,
    );
    const busy = entries.filter(
      (entry) =>
        !entry.allDay &&
        entry.start < (base + 1) * MINUTES_IN_DAY &&
        entry.end > MINUTES_IN_DAY * base,
    );
    while (
      minute + 60 <= dayEnd &&
      busy.some(
        (entry) =>
          entry.start < MINUTES_IN_DAY * base + minute + 60 &&
          entry.end > MINUTES_IN_DAY * base + minute,
      )
    )
      minute += 30;
    if (minute + 60 > dayEnd) minute = clamp(540, dayStart, dayEnd - 60);
    startCreate(MINUTES_IN_DAY * base + minute, MINUTES_IN_DAY * base + minute + 60);
  };

  const openDetails = (id: string, node?: HTMLElement | null) => {
    popoverAnchorRef.current = node ?? null;
    detailsAnchorRef.current = node ?? null;
    setDraft(null);
    setSelectedId(id);
    setPopover({ kind: "details", id });
  };

  const closePopover = () => {
    const previous = popover;
    setPopover(null);
    if (previous?.kind === "create") {
      setDraft(null);
      scrollerRef.current
        ?.querySelector<HTMLElement>(`[data-current] [data-day-cell="${cursor}"]`)
        ?.focus({ preventScroll: true });
    } else if (previous?.kind === "details") {
      nodes.current.get(previous.id)?.focus({ preventScroll: true });
    } else if (previous?.kind === "calendars")
      calendarsButtonRef.current?.focus({ preventScroll: true });
  };

  const hitTest = (clientX: number, clientY: number) => {
    const surface = surfaceRef.current;
    if (!surface) return null;
    const bounds = surface.getBoundingClientRect();
    const index = clamp(
      Math.floor((clientX - bounds.left) / (bounds.width / days.length)),
      0,
      days.length - 1,
    );
    return {
      index,
      day: days[index],
      minute: dayStart + (clientY - bounds.top) / PX_PER_MINUTE,
    };
  };

  const updateDrag = (record: DragRecord) => {
    const hit = hitTest(record.x, record.y);
    if (!hit) return;
    const snapped = clamp(SNAP * Math.round(hit.minute / SNAP), dayStart, dayEnd);
    let next: DragPreview;
    if (record.intent === "create") {
      const base = MINUTES_IN_DAY * record.anchorDay;
      next =
        snapped > record.anchorMinute
          ? {
              kind: "create",
              id: null,
              start: base + record.anchorMinute,
              end: base + Math.max(snapped, record.anchorMinute + 15),
            }
          : {
              kind: "create",
              id: null,
              start: base + snapped,
              end: base + record.anchorMinute + 15,
            };
    } else if (record.intent === "move") {
      const length = record.origin.end - record.origin.start;
      const start =
        length <= dayEnd - dayStart
          ? MINUTES_IN_DAY * hit.day +
            clamp(
              SNAP * Math.round((hit.minute - record.grab) / SNAP),
              dayStart,
              dayEnd - length,
            )
          : SNAP *
            Math.round((MINUTES_IN_DAY * hit.day + hit.minute - record.grab) / SNAP);
      next = { kind: "move", id: record.id, start, end: start + length };
    } else {
      const base = dayOf(record.origin.end - 1);
      next = {
        kind: "resize",
        id: record.id,
        start: record.origin.start,
        end: clamp(
          MINUTES_IN_DAY * base + snapped,
          record.origin.start + 15,
          MINUTES_IN_DAY * base + dayEnd,
        ),
      };
    }
    setDrag((previous) =>
      previous &&
      previous.kind === next.kind &&
      previous.id === next.id &&
      previous.start === next.start &&
      previous.end === next.end
        ? previous
        : next,
    );
  };

  const updateDragRef = useRef(updateDrag);
  useLayoutEffect(() => {
    updateDragRef.current = updateDrag;
  });

  const activate = (record: DragRecord) => {
    record.state = "active";
    if (record.timer) {
      clearTimeout(record.timer);
      record.timer = null;
    }
    if (record.touch && "vibrate" in navigator) navigator.vibrate?.(10);
    if (hoverRef.current) hoverRef.current.style.opacity = "0";
    if (record.intent === "create")
      setDrag({
        kind: "create",
        id: null,
        start: MINUTES_IN_DAY * record.anchorDay + record.anchorMinute,
        end: MINUTES_IN_DAY * record.anchorDay + record.anchorMinute + 15,
      });
    else {
      setSelectedId(record.id);
      setDrag({
        kind: record.intent === "resize" ? "resize" : "move",
        id: record.id,
        ...record.origin,
      });
    }
    updateDrag(record);
  };

  const hoverPreview = (event: ReactPointerEvent<HTMLDivElement>) => {
    const node = hoverRef.current;
    if (!node || !surfaceRef.current) return;
    if (
      event.pointerType !== "mouse" ||
      popover ||
      (event.target instanceof Element && event.target.closest("[data-event-id]"))
    ) {
      node.style.opacity = "0";
      return;
    }
    const hit = hitTest(event.clientX, event.clientY);
    if (!hit) return;
    const minute = clamp(30 * Math.floor(hit.minute / 30), dayStart, dayEnd - 30);
    node.style.opacity = "1";
    node.style.width = `${100 / days.length}%`;
    node.style.transform = `translate(${100 * hit.index}%, ${
      (minute - dayStart) * PX_PER_MINUTE
    }px)`;
    const label = node.firstElementChild;
    if (label) label.textContent = fmt.time(MINUTES_IN_DAY * hit.day + minute);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const record = pointerRef.current;
    if (!record) {
      if (!agendaActive) hoverPreview(event);
      return;
    }
    if (event.pointerId !== record.pointerId) return;
    const elapsed = event.timeStamp - record.t;
    if (elapsed > 0)
      record.vx =
        0.4 * record.vx + ((event.clientX - record.x) / elapsed) * 0.6;
    record.x = event.clientX;
    record.y = event.clientY;
    record.t = event.timeStamp;
    const dx = record.x - record.x0;
    const dy = record.y - record.y0;
    if (record.state === "pending") {
      if (record.touch || record.intent === "swipe") {
        if (Math.hypot(dx, dy) < 8) return;
        if (record.timer) {
          clearTimeout(record.timer);
          record.timer = null;
        }
        if (Math.abs(dx) > 1.2 * Math.abs(dy)) {
          record.state = "swipe";
          const target = event.currentTarget;
          if (!target.hasPointerCapture(event.pointerId))
            target.setPointerCapture(event.pointerId);
          currentPane.x.stop();
          record.base = currentPane.x.get();
          record.width = paneWidth();
          const span = daySpan(displayed);
          const base = anchor ?? today ?? dayOf(wallMinutes(SAMPLE_TODAY, timeZone));
          const next = [-1, 1].map((direction) => {
            const paneDays = daysFor(displayed, base + direction * span, weekStartsOn);
            return {
              key: `${displayed}:${paneDays[0]}:${paneDays.length}`,
              view: displayed,
              days: paneDays,
              x: motionValue((record.base ?? 0) + direction * (record.width ?? 0)),
              opacity: motionValue(1),
            };
          });
          record.peeks = next;
          setPeek(next);
        } else {
          pointerRef.current = null;
          return;
        }
      } else {
        if (Math.hypot(dx, dy) < 4) return;
        activate(record);
        return;
      }
    }
    if (record.state === "swipe") {
      const position = (record.base ?? 0) + dx;
      currentPane.x.set(position);
      record.peeks?.forEach((frame, index) =>
        frame.x.set(position + (index ? 1 : -1) * (record.width ?? 0)),
      );
      return;
    }
    updateDrag(record);
  };

  const onPointerUp = (
    event: ReactPointerEvent<HTMLDivElement>,
    cancelled: boolean,
  ) => {
    const record = pointerRef.current;
    if (!record || event.pointerId !== record.pointerId) return;
    if (record.timer) clearTimeout(record.timer);
    pointerRef.current = null;
    if (record.state === "swipe") {
      const dx = record.x - record.x0;
      const width = record.width ?? paneWidth();
      const position = (record.base ?? 0) + dx;
      if (
        !cancelled &&
        (Math.abs(position) > 0.2 * width || Math.abs(record.vx) > 0.4) &&
        Math.sign(record.vx || dx) === Math.sign(dx)
      )
        step(dx < 0 ? 1 : -1, position);
      else {
        animate(currentPane.x, 0, SPRING_SLIDE);
        const frames = record.peeks ?? [];
        frames.forEach((frame, index) =>
          animate(frame.x, (index ? 1 : -1) * width, SPRING_SLIDE),
        );
        setTimeout(
          () => setPeek((current) => (current === frames ? [] : current)),
          600,
        );
      }
      return;
    }
    if (record.intent === "swipe") return;
    if (cancelled) {
      setDrag(null);
      return;
    }
    if (record.state === "pending") {
      if (record.id) openDetails(record.id);
      else {
        const minute = clamp(
          30 * Math.floor(record.anchorMinute / 30),
          dayStart,
          dayEnd - 60,
        );
        startCreate(
          MINUTES_IN_DAY * record.anchorDay + minute,
          MINUTES_IN_DAY * record.anchorDay + minute + 60,
        );
      }
      return;
    }
    setDrag(null);
    const committed = drag;
    if (!committed) return;
    if (committed.kind === "create") {
      startCreate(committed.start, committed.end);
      return;
    }
    const target = committed.id ? entryById.get(committed.id) : undefined;
    if (!target) return;
    if (target.start === committed.start && target.end === committed.end) return;
    const message =
      committed.kind === "move"
        ? `Moved ${target.event.title} to ${fmt.shortDate(
            dayOf(committed.start),
          )}, ${fmt.time(committed.start)}`
        : `${target.event.title} now ${fmt.range(committed.start, committed.end)}`;
    updateWithUndo(target.id, toDates(committed.start, committed.end), message);
  };

  const activeDrag = drag !== null;

  useEffect(() => {
    if (!activeDrag) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let frame = 0;
    const tick = () => {
      const record = pointerRef.current;
      if (record?.state === "active") {
        const bounds = scroller.getBoundingClientRect();
        const top = bounds.top + (headRef.current?.offsetHeight ?? 0) + 44;
        const bottom = bounds.bottom - 44;
        const pull =
          record.y < top
            ? -Math.min(18, (top - record.y) / 2.5 + 2)
            : record.y > bottom
              ? Math.min(18, (record.y - bottom) / 2.5 + 2)
              : 0;
        if (pull) {
          const before = scroller.scrollTop;
          scroller.scrollTop += pull;
          if (scroller.scrollTop !== before) updateDragRef.current(record);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || pointerRef.current?.state !== "active") return;
      event.preventDefault();
      event.stopPropagation();
      pointerRef.current = null;
      setDrag(null);
      setLive("Drag cancelled");
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [activeDrag]);

  useEffect(() => {
    const scroller = scrollerRef.current ?? agendaRef.current;
    if (!scroller) return;
    const onTouchMove = (event: TouchEvent) => {
      if (pointerRef.current && pointerRef.current.state !== "pending")
        event.preventDefault();
    };
    scroller.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => scroller.removeEventListener("touchmove", onTouchMove);
  }, [agendaActive]);

  const stepRef = useRef(step);
  useLayoutEffect(() => {
    stepRef.current = step;
  });

  useEffect(() => {
    const scroller = scrollerRef.current ?? agendaRef.current;
    if (!scroller) return;
    let accumulated = 0;
    let consumed = false;
    let reset: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || pointerRef.current)
        return;
      event.preventDefault();
      clearTimeout(reset);
      reset = setTimeout(() => {
        accumulated = 0;
        consumed = false;
      }, 240);
      accumulated += event.deltaX;
      if (!consumed && Math.abs(accumulated) > 80) {
        consumed = true;
        stepRef.current(accumulated > 0 ? 1 : -1);
        accumulated = 0;
      }
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      scroller.removeEventListener("wheel", onWheel);
      clearTimeout(reset);
    };
  }, [agendaActive]);

  const onEventKey = (id: string, event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const entry = entryById.get(id);
    if (!entry || !event.key.startsWith("Arrow")) return;
    if (!event.altKey) {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      event.stopPropagation();
      const list = Array.from(
        event.currentTarget
          .closest("[data-pane]")
          ?.querySelectorAll<HTMLElement>("[data-event-id]") ?? [],
      );
      list[list.indexOf(event.currentTarget) + (event.key === "ArrowDown" ? 1 : -1)]?.focus();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (entry.allDay) return;
    const length = entry.end - entry.start;
    let start = entry.start;
    let end = entry.end;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const delta = event.key === "ArrowLeft" ? -1 : 1;
      let day = dayOf(start) + delta;
      if (view === "workweek") while (isWeekend(day)) day += delta;
      if (!days.includes(day)) return;
      start = MINUTES_IN_DAY * day + minuteOfDay(start);
      end = start + length;
    } else {
      const delta = event.key === "ArrowUp" ? -15 : 15;
      const base = MINUTES_IN_DAY * dayOf(start);
      if (event.shiftKey)
        end = clamp(end + delta, start + 15, MINUTES_IN_DAY * dayOf(end - 1) + dayEnd);
      else {
        start = clamp(start + delta, base + dayStart, base + dayEnd - length);
        end = start + length;
      }
    }
    if (start === entry.start && end === entry.end) return;
    applyUpdate(
      id,
      toDates(start, end),
      `${entry.event.title}, ${fmt.shortDate(dayOf(start))}, ${fmt.spoken(start, end)}`,
    );
    setSelectedId(id);
  };

  const onEventClick = (id: string, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0) openDetails(id, event.currentTarget);
  };

  const toggleCalendar = (id: string) => {
    const source = calendarById.get(id);
    const nowHidden = hidden.has(id);
    setHidden((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (source) setLive(`${source.name} ${nowHidden ? "shown" : "hidden"}`);
  };

  const changeView = (next: CalendarView) =>
    switchPanes({
      view: next,
      cursor,
      anchor: next === "day" || next === "3day" ? cursor : anchor ?? days[0],
      dir: 0,
    });

  const handlers = useRef({
    onEventKey,
    onEventClick,
    goDay,
    openDetails,
    onMore: () => setExpanded(true),
    changeView,
    toggleCalendar,
  });
  useLayoutEffect(() => {
    handlers.current = {
      onEventKey,
      onEventClick,
      goDay,
      openDetails,
      onMore: () => setExpanded(true),
      changeView,
      toggleCalendar,
    };
  });

  const eventKey = useCallback(
    (id: string, event: ReactKeyboardEvent<HTMLButtonElement>) =>
      handlers.current.onEventKey(id, event),
    [],
  );
  const eventClick = useCallback(
    (id: string, event: ReactMouseEvent<HTMLButtonElement>) =>
      handlers.current.onEventClick(id, event),
    [],
  );
  const dayJump = useCallback((day: number) => handlers.current.goDay(day), []);
  const eventOpen = useCallback(
    (id: string, node: HTMLElement) => handlers.current.openDetails(id, node),
    [],
  );
  const showMore = useCallback(() => handlers.current.onMore(), []);
  const viewChange = useCallback(
    (next: CalendarView) => handlers.current.changeView(next),
    [],
  );
  const calendarToggle = useCallback(
    (id: string) => handlers.current.toggleCalendar(id),
    [],
  );

  const closeRef = useRef(closePopover);
  useLayoutEffect(() => {
    closeRef.current = closePopover;
  });
  const requestClose = useCallback(() => closeRef.current(), []);

  const allDayCount = useMemo(() => layoutAllDay(entries, days).count, [entries, days]);
  const overflow = allDayCount > 3;
  const rows = allDayCount === 0 ? 1 : overflow && !expanded ? 3 : allDayCount;
  const detailsEntry =
    popover?.kind === "details" ? entryById.get(popover.id) ?? null : null;
  const draftColor = resolveColor(
    calendarById.get(draft?.calendarId ?? fallbackCalendarId),
  );

  const detailsAnchor = useCallback(
    () =>
      popover?.kind !== "details"
        ? null
        : detailsAnchorRef.current?.isConnected
          ? detailsAnchorRef.current
          : (nodes.current.get(popover.id) ?? null),
    [popover],
  );
  const createAnchor = useCallback(() => ghostRef.current, []);
  const calendarsAnchor = useCallback(() => calendarsButtonRef.current, []);

  const panes = [
    ...leaving.filter(
      (frame) =>
        (frame.view === "agenda") === agendaActive &&
        !peek.some((candidate) => candidate.key === frame.key),
    ),
    ...peek.filter((frame) => frame.key !== currentPane.key),
    currentPane,
  ];

  const cursorIndex = nowWall === null ? -1 : days.indexOf(dayOf(nowWall));
  const hours = useMemo(
    () => Array.from({ length: lastHour - firstHour }, (_, index) => (firstHour + index) * 60),
    [firstHour, lastHour],
  );
  const views = size === "compact" ? COMPACT_VIEWS : WIDE_VIEWS;

  return (
    <div
      ref={rootRef}
      className={cx(styles.root, className)}
      data-size={size}
      data-dragging={activeDrag || undefined}
      onKeyDown={(event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (
          target.closest(
            "input, textarea, [contenteditable='true'], [role='dialog'], [role='listbox']",
          )
        )
          return;
        if (event.metaKey || event.ctrlKey) {
          if (event.key.toLowerCase() === "z" && toast?.undo) {
            event.preventDefault();
            toast.undo();
          }
          return;
        }
        if (event.altKey) return;
        const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
        if (key === "Escape") {
          if (popover) closePopover();
          else {
            if (!selectedId) return;
            setSelectedId(null);
            setLive("Selection cleared");
          }
        } else if (key === "t") goToday();
        else if (key === "n") addEvent();
        else if (key === "d") switchPanes({ view: "day", anchor: cursor, cursor, dir: 0 });
        else if (key === "w") switchPanes({ view: "week", cursor, dir: 0 });
        else if (key === "Delete" || key === "Backspace") {
          const id = target.closest("[data-event-id]")?.getAttribute("data-event-id") ?? selectedId;
          if (!id) return;
          removeEvent(id);
        } else if (
          (key !== "ArrowLeft" && key !== "ArrowRight") ||
          agendaActive ||
          target.closest("[data-toolbar]")
        ) {
          if (key !== "Enter" || !target.dataset.dayCell) return;
          addEvent();
        } else {
          const delta = key === "ArrowLeft" ? -1 : 1;
          let day = cursor + delta;
          if (view === "workweek") while (isWeekend(day)) day += delta;
          focusRow.current = day;
          if (days.includes(day)) setCursorDay(day);
          else
            switchPanes({
              anchor: displayed === "3day" && delta < 0 ? day - 2 : day,
              cursor: day,
              dir: Math.sign(delta),
            });
        }
        event.preventDefault();
      }}
    >
      <header className={styles.toolbar} data-toolbar="">
        <button
          type="button"
          className={cx(styles.button, styles.today)}
          onClick={goToday}
          disabled={today === null || days.includes(today)}
          aria-keyshortcuts="T"
        >
          Today
        </button>
        <div className={styles.stepper}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => step(-1)}
            aria-label={
              displayed === "day"
                ? "Previous day"
                : displayed === "3day"
                  ? "Previous three days"
                  : "Previous week"
            }
          >
            <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => step(1)}
            aria-label={
              displayed === "day"
                ? "Next day"
                : displayed === "3day"
                  ? "Next three days"
                  : "Next week"
            }
          >
            <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <h2 className={styles.title}>
          {displayed === "day" ? fmt.longDate(days[0]) : rangeLabel}
        </h2>
        <div className={styles.views}>
          <ViewSwitch views={views} value={displayed} onChange={viewChange} />
        </div>
        {size !== "wide" && (
          <button
            ref={calendarsButtonRef}
            type="button"
            className={styles.button}
            data-open={popover?.kind === "calendars" || undefined}
            aria-haspopup="dialog"
            aria-expanded={popover?.kind === "calendars"}
            onClick={() =>
              setPopover((current) =>
                current?.kind === "calendars" ? null : { kind: "calendars" },
              )
            }
          >
            <span className={styles.swatches} aria-hidden="true">
              {sources.map((source) => (
                <span
                  key={source.id}
                  className={styles.swatch}
                  data-off={hidden.has(source.id) || undefined}
                  style={calVars(resolveColor(source))}
                />
              ))}
            </span>
            <span className={styles.buttonLabel}>Calendars</span>
          </button>
        )}
        <button
          ref={newEventButtonRef}
          type="button"
          className={styles.primary}
          onClick={addEvent}
          aria-keyshortcuts="N"
          aria-label="New event"
        >
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className={styles.primaryLabel}>New event</span>
        </button>
      </header>
      <div className={styles.frame}>
        {size === "wide" && (
          <aside className={styles.sidebar} aria-label="Calendar navigation">
            <MiniMonth
              fmt={fmt}
              month={miniMonth}
              weekStartsOn={weekStartsOn}
              today={today}
              range={days}
              onMonth={setMonth}
              onPick={dayJump}
            />
            <div className={styles.sideSection}>
              <p className={styles.sideTitle}>Calendars</p>
              <CalendarList
                calendars={sources}
                hidden={hidden}
                onToggle={calendarToggle}
              />
            </div>
          </aside>
        )}
        <div className={styles.main}>
          {agendaActive ? (
            <div
              ref={agendaRef}
              className={styles.agendaScroller}
              onPointerDown={(event) => {
                if (event.pointerType === "mouse" || pointerRef.current) return;
                pointerRef.current = {
                  intent: "swipe",
                  id: null,
                  pointerId: event.pointerId,
                  touch: true,
                  x0: event.clientX,
                  y0: event.clientY,
                  x: event.clientX,
                  y: event.clientY,
                  t: event.timeStamp,
                  vx: 0,
                  state: "pending",
                  timer: null,
                  anchorDay: 0,
                  anchorMinute: 0,
                  grab: 0,
                  origin: { start: 0, end: 0 },
                };
              }}
              onPointerMove={onPointerMove}
              onPointerUp={(event) => onPointerUp(event, false)}
              onPointerCancel={(event) => onPointerUp(event, true)}
            >
              {panes.map((frame) => (
                <AgendaPane
                  key={frame.key}
                  pane={frame}
                  current={frame === currentPane}
                  items={entries}
                  fmt={fmt}
                  today={today}
                  selectedId={selectedId}
                  register={register}
                  onOpen={eventOpen}
                />
              ))}
            </div>
          ) : (
            <div ref={scrollerRef} className={styles.scroller} style={{ "--hour": "52px" } as CSSProperties}>
              <div ref={headRef} className={styles.head}>
                <div className={styles.headRow}>
                  <div className={styles.corner} aria-hidden="true">
                    {tzName}
                  </div>
                  <div className={styles.headViewport}>
                    {panes.map((frame) => (
                      <HeadPane
                        key={frame.key}
                        pane={frame}
                        current={frame === currentPane}
                        today={today}
                        cursor={cursor}
                        fmt={fmt}
                        onDay={dayJump}
                      />
                    ))}
                  </div>
                </div>
                <div className={styles.allDayRow} style={{ height: ALL_DAY_ROW * rows + 8 }}>
                  <div className={styles.allDayGutter}>
                    {overflow ? (
                      <button
                        type="button"
                        className={styles.allDayToggle}
                        aria-expanded={expanded}
                        onClick={() => setExpanded((previous) => !previous)}
                        aria-label={
                          expanded
                            ? "Collapse all day events"
                            : "Show all all day events"
                        }
                      >
                        <span>All day</span>
                        <ChevronDown
                          size={14}
                          strokeWidth={1.75}
                          aria-hidden="true"
                          data-open={expanded || undefined}
                        />
                      </button>
                    ) : (
                      <span className={styles.allDayLabel}>All day</span>
                    )}
                  </div>
                  <div className={styles.headViewport}>
                    {panes.map((frame) => (
                      <AllDayPane
                        key={frame.key}
                        pane={frame}
                        current={frame === currentPane}
                        items={entries}
                        fmt={fmt}
                        expanded={expanded}
                        selectedId={selectedId}
                        register={register}
                        onOpen={eventOpen}
                        onMore={showMore}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles.body} style={{ height: surfaceHeight }}>
                <div className={styles.gutter} aria-hidden="true">
                  {hours.slice(1).map((minute) => (
                    <span
                      key={minute}
                      className={styles.hour}
                      style={{ top: (minute - dayStart) * PX_PER_MINUTE }}
                      data-hidden={
                        (cursorIndex >= 0 &&
                          nowWall !== null &&
                          Math.abs((minute - minuteOfDay(nowWall)) * PX_PER_MINUTE) < 14) ||
                        undefined
                      }
                    >
                      {fmt.hour(minute)}
                    </span>
                  ))}
                  {cursorIndex >= 0 &&
                    nowWall !== null &&
                    minuteOfDay(nowWall) >= dayStart &&
                    minuteOfDay(nowWall) <= dayEnd && (
                      <span
                        className={styles.nowLabel}
                        style={{ top: (minuteOfDay(nowWall) - dayStart) * PX_PER_MINUTE }}
                      >
                        {size === "compact" ? fmt.short(nowWall) : fmt.time(nowWall)}
                      </span>
                    )}
                </div>
                <div
                  ref={surfaceRef}
                  className={styles.surface}
                  onFocus={(event: ReactFocusEvent<HTMLDivElement>) => {
                    const target = event.target;
                    if (!(target instanceof HTMLElement)) return;
                    const cell = target.dataset.dayCell;
                    const eventId = cell
                      ? undefined
                      : target.closest("[data-event-id]")?.getAttribute("data-event-id");
                    const entry = eventId ? entryById.get(eventId) : undefined;
                    const day = cell
                      ? Number(cell)
                      : entry
                        ? dayOf(entry.start)
                        : Number.NaN;
                    if (Number.isFinite(day) && days.includes(day) && day !== cursorDay)
                      setCursorDay(day);
                  }}
                  onPointerDown={(event) => {
                    if (
                      (event.pointerType === "mouse" && event.button !== 0) ||
                      pointerRef.current ||
                      !surfaceRef.current ||
                      popover
                    )
                      return;
                    const target = event.target;
                    if (!(target instanceof Element)) return;
                    const eventId = target.closest("[data-event-id]")?.getAttribute("data-event-id") ?? null;
                    const entry = eventId ? entryById.get(eventId) : undefined;
                    const resizing = Boolean(target.closest("[data-handle]"));
                    const hit = hitTest(event.clientX, event.clientY);
                    if (!hit) return;
                    const minute = clamp(
                      15 * Math.floor(hit.minute / 15),
                      dayStart,
                      dayEnd - 15,
                    );
                    const record: DragRecord = {
                      intent: entry ? (resizing ? "resize" : "move") : "create",
                      id: entry?.id ?? null,
                      pointerId: event.pointerId,
                      touch: event.pointerType !== "mouse",
                      x0: event.clientX,
                      y0: event.clientY,
                      x: event.clientX,
                      y: event.clientY,
                      t: event.timeStamp,
                      vx: 0,
                      state: "pending",
                      timer: null,
                      anchorDay: hit.day,
                      anchorMinute: minute,
                      grab: entry ? MINUTES_IN_DAY * hit.day + hit.minute - entry.start : 0,
                      origin: entry
                        ? { start: entry.start, end: entry.end }
                        : {
                            start: MINUTES_IN_DAY * hit.day + minute,
                            end: MINUTES_IN_DAY * hit.day + minute + 15,
                          },
                    };
                    pointerRef.current = record;
                    if (!record.touch) {
                      event.preventDefault();
                      if (entry) nodes.current.get(entry.id)?.focus({ preventScroll: true });
                      else {
                        setCursorDay(hit.day);
                        event.currentTarget
                          .querySelector<HTMLElement>(
                            `[data-current] [data-day-cell="${hit.day}"]`,
                          )
                          ?.focus({ preventScroll: true });
                      }
                    }
                    event.currentTarget.setPointerCapture(event.pointerId);
                    if (record.touch)
                      record.timer = setTimeout(() => {
                        if (pointerRef.current === record && record.state === "pending")
                          activate(record);
                      }, 380);
                  }}
                  onPointerMove={onPointerMove}
                  onPointerUp={(event) => onPointerUp(event, false)}
                  onPointerCancel={(event) => onPointerUp(event, true)}
                  onPointerLeave={() => {
                    if (hoverRef.current) hoverRef.current.style.opacity = "0";
                  }}
                >
                  <div className={styles.lines} aria-hidden="true">
                    {hours.map((minute) => (
                      <span
                        key={minute}
                        className={styles.hourLine}
                        style={{ top: (minute - dayStart) * PX_PER_MINUTE }}
                      />
                    ))}
                    {hours.map((minute) => (
                      <span
                        key={`h${minute}`}
                        className={styles.halfLine}
                        style={{ top: (minute + 30 - dayStart) * PX_PER_MINUTE }}
                      />
                    ))}
                  </div>
                  <div ref={hoverRef} className={styles.hover} aria-hidden="true">
                    <span />
                  </div>
                  {panes.map((frame) => (
                    <TimedPane
                      key={frame.key}
                      pane={frame}
                      current={frame === currentPane}
                      items={entries}
                      drag={frame === currentPane ? drag : null}
                      draft={frame === currentPane ? draft : null}
                      draftColor={draftColor}
                      selectedId={selectedId}
                      nowWall={nowWall}
                      today={today}
                      cursor={cursor}
                      dayStart={dayStart}
                      dayEnd={dayEnd}
                      fmt={fmt}
                      reduced={reduced}
                      label={rangeLabel}
                      describedBy={describedBy}
                      register={register}
                      paneWidth={paneWidth}
                      onEventKey={eventKey}
                      onEventClick={eventClick}
                      ghostRef={ghostRef}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        <AnimatePresence>
          {toast && (
            <Toast
              key={toast.id}
              message={toast.message}
              onUndo={toast.undo}
              onDismiss={() => setToast(null)}
              reduced={reduced}
            />
          )}
        </AnimatePresence>
      </div>
      <p id={describedBy} className={styles.srOnly}>
        Drag on empty time to add an event, then name it and press Enter. Drag an
        event to move it, or drag its bottom edge to change its length. Arrow keys
        move between days, T goes to today, N adds an event, Delete removes the
        selected event, and Escape closes. With an event focused, Alt and an arrow
        key move it by a day or 15 minutes, and Alt Shift Up or Down changes its
        length.
      </p>
      <p className={styles.srOnly} aria-live="polite">
        {live}
      </p>
      <AnimatePresence>
        {popover?.kind === "details" && detailsEntry && (
          <Popover
            key={`details-${popover.id}`}
            anchor={detailsAnchor}
            rootRef={rootRef}
            scrollerRef={scrollerRef}
            reduced={reduced}
            label="Event details"
            onClose={requestClose}
          >
            <EventDetails
              fmt={fmt}
              entry={detailsEntry}
              calendars={sources}
              onTitle={(title) =>
                applyUpdate(detailsEntry.id, { title }, `Renamed to ${title}`)
              }
              onTime={(start, end) =>
                updateWithUndo(
                  detailsEntry.id,
                  toDates(start, end),
                  `${detailsEntry.event.title} now ${fmt.shortDate(
                    dayOf(start),
                  )}, ${fmt.range(start, end)}`,
                )
              }
              onCalendar={(calendarId) =>
                applyUpdate(
                  detailsEntry.id,
                  { calendarId },
                  `Moved to ${calendarById.get(calendarId)?.name ?? "calendar"}`,
                )
              }
              onDelete={() => removeEvent(detailsEntry.id)}
              onClose={closePopover}
            />
          </Popover>
        )}
        {popover?.kind === "create" && draft && (
          <Popover
            key="create"
            anchor={createAnchor}
            rootRef={rootRef}
            scrollerRef={scrollerRef}
            reduced={reduced}
            width={320}
            label="New event"
            onClose={requestClose}
          >
            <QuickCreate
              fmt={fmt}
              start={draft.start}
              end={draft.end}
              calendars={sources.filter((source) => !hidden.has(source.id))}
              calendarId={draft.calendarId}
              onCalendar={(calendarId) =>
                setDraft((current) => current && { ...current, calendarId })
              }
              onSave={(title) => {
                const event: CalendarEvent = {
                  id: `event-${Date.now().toString(36)}-${++toastSeq.current}`,
                  title: title.trim() || "Untitled event",
                  start: instant(draft.start, timeZone),
                  end: instant(draft.end, timeZone),
                  calendarId: draft.calendarId,
                };
                applyEvents([...eventsRef.current, event]);
                onCreate?.(event);
                setDraft(null);
                setPopover(null);
                setSelectedId(event.id);
                setLive(
                  `Created ${event.title}, ${fmt.longDate(dayOf(draft.start))}, ${fmt.spoken(
                    draft.start,
                    draft.end,
                  )}`,
                );
                requestAnimationFrame(() =>
                  nodes.current.get(event.id)?.focus({ preventScroll: true }),
                );
              }}
              onCancel={closePopover}
            />
          </Popover>
        )}
        {popover?.kind === "calendars" && (
          <Popover
            key="calendars"
            anchor={calendarsAnchor}
            ignore={calendarsButtonRef}
            rootRef={rootRef}
            scrollerRef={scrollerRef}
            placement="below"
            width={240}
            reduced={reduced}
            label="Calendars"
            onClose={requestClose}
          >
            <div className={styles.popBody}>
              <CalendarList
                calendars={sources}
                hidden={hidden}
                onToggle={calendarToggle}
              />
            </div>
          </Popover>
        )}
      </AnimatePresence>
    </div>
  );
}

export default WeekCalendar;
