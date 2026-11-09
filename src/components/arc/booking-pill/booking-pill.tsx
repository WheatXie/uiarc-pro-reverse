"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  useVelocity,
  type Transition,
  type Variants,
} from "motion/react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Minus, Plus, RotateCcw } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./booking-pill.module.css";

export type BookingStep = "start" | "party" | "date" | "time" | "review" | "booked";

export interface Booking {
  /** ISO date of the booking, `YYYY-MM-DD`. */
  date: string;
  /** Seating time in 24h `HH:MM`, whatever `hourCycle` displays. */
  time: string;
  partySize: number;
}

export interface BookingPillProps {
  /** Venue name printed on the ticket. */
  venue: string;
  /** Second ticket line, such as the address. */
  venueDetail?: string;
  /** First day on the strip as an ISO date. Pass it from data so server and client agree. */
  startDate: string;
  /** Days on the strip. */
  days?: number;
  /** Seating times as "HH:MM", in order, shown four to a row. */
  times?: string[];
  /** Whether a time is free. Everything is free by default. */
  isAvailable?: (date: string, time: string, partySize: number) => boolean;
  /** Preselected when free, otherwise the nearest free time, as "HH:MM". */
  preferredTime?: string;
  /** Smallest party. */
  minPartySize?: number;
  /** Largest party. */
  maxPartySize?: number;
  /** Starting party size. */
  defaultPartySize?: number;
  /** Books the table. Resolve to show the booked state, reject to keep the ticket open. */
  onConfirm?: (booking: Booking) => Promise<void> | void;
  /** Called on every step, for example to let the page recede while the pill is open. */
  onStepChange?: (step: BookingStep) => void;
  /** Clock used for displayed times. `times`/`preferredTime` stay 24h. */
  hourCycle?: 12 | 24;
  /** Label of the closed pill. */
  label?: string;
  /** Class on the root element. */
  className?: string;
}

const STEPS: BookingStep[] = ["start", "party", "date", "time", "review", "booked"];
const BACK: Partial<Record<BookingStep, BookingStep>> = {
  party: "start",
  date: "party",
  time: "date",
  review: "time",
};

/** Weekend-ish weekday names, indexed like `Date#getDay`. */
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DEFAULT_TIMES = [
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
  "22:00",
  "22:30",
];
const CELL = 52;

const alwaysOpen = () => true;
const simulatedBooking = () => new Promise<void>((resolve) => setTimeout(resolve, 900));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const parseTime = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const formatLong = (day: Day) => `${WEEKDAYS[day.weekday]}, ${MONTHS[day.month]} ${day.day}`;
const formatShort = (day: Day) =>
  `${WEEKDAYS[day.weekday].slice(0, 3)}, ${MONTHS[day.month].slice(0, 3)} ${day.day}`;
const formatTime = (value: string, hourCycle: 12 | 24) => {
  if (hourCycle === 24) return value;
  const [hours, minutes] = value.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes || 0).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
};

/** Spring presets are derived from the shared visual-duration tokens. */
const springFor = ({ visualDuration, bounce }: { visualDuration: number; bounce: number }): Transition => {
  const omega = (2 * Math.PI) / (1.2 * visualDuration);
  return { type: "spring", stiffness: omega * omega, damping: 2 * (1 - bounce) * omega, mass: 1 };
};

const MORPH = springFor(motionTokens.spring.morph);
const GROW = springFor({ visualDuration: 0.34, bounce: 0 });
const BOOKED = springFor({ visualDuration: 0.52, bounce: 0 });
const SWEEP = springFor({ visualDuration: 0.45, bounce: 0 });
const HIGHLIGHT = springFor(motionTokens.spring.morph);

const EASE_ENTER = [...motionTokens.ease.enter] as [number, number, number, number];
const EASE_STANDARD = [...motionTokens.ease.standard] as [number, number, number, number];

interface Day {
  iso: string;
  weekday: number;
  day: number;
  month: number;
}

const faceSlide: Variants = {
  hidden: (direction: number) => ({
    opacity: 0,
    x: 16 * direction,
    scale: 0.95,
    filter: `blur(${motionTokens.blur.soft}px)`,
  }),
  shown: {
    opacity: 1,
    x: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      opacity: { duration: 0.22, ease: EASE_ENTER, delay: 0.07 },
      filter: { duration: 0.26, ease: EASE_ENTER, delay: 0.07 },
      x: { ...motionTokens.spring.snappy, delay: 0.07 },
      scale: { ...motionTokens.spring.snappy, delay: 0.07 },
    },
  },
  gone: (direction: number) => ({
    opacity: 0,
    x: -10 * direction,
    scale: 0.97,
    filter: `blur(${motionTokens.blur.soft}px)`,
    transition: { duration: 0.12, ease: EASE_STANDARD },
  }),
};

const faceFade: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.15 } },
  gone: { opacity: 0, transition: { duration: 0.1 } },
};

const ticketLine: Variants = {
  hidden: { opacity: 0, y: 8, filter: `blur(${motionTokens.blur.subtle}px)` },
  shown: (index: number) => {
    const delay = 0.13 + index * motionTokens.stagger.line;
    return {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        ...motionTokens.spring.snappy,
        delay,
        opacity: { duration: 0.22, ease: EASE_ENTER, delay },
        filter: { duration: 0.22, ease: EASE_ENTER, delay },
      },
    };
  },
};

const slotIn: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.92 },
  shown: (index: number) => {
    const delay = 0.07 + 0.05 + 0.016 * index;
    return {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        ...motionTokens.spring.snappy,
        delay,
        opacity: { duration: 0.2, ease: EASE_ENTER, delay },
      },
    };
  },
};

const lensIn: Variants = {
  hidden: { opacity: 0, scale: 0.82 },
  shown: {
    opacity: 1,
    scale: 1,
    transition: {
      ...motionTokens.spring.snappy,
      delay: 0.17,
      opacity: { duration: 0.16, delay: 0.17 },
    },
  },
};

const perforate: Variants = {
  hidden: { scaleX: 0, opacity: 0 },
  shown: {
    scaleX: 1,
    opacity: 1,
    transition: {
      scaleX: { ...motionTokens.spring.smooth, delay: 0.2 },
      opacity: { duration: 0.12, delay: 0.2 },
    },
  },
};

const digitIn: Variants = {
  enter: (direction: number) => ({
    y: direction > 0 ? "0.7em" : "-0.7em",
    opacity: 0,
    filter: `blur(${motionTokens.blur.subtle}px)`,
  }),
  rest: {
    y: "0em",
    opacity: 1,
    filter: "blur(0px)",
    transition: {
      y: motionTokens.spring.snappy,
      opacity: { duration: motionTokens.duration.fast, ease: EASE_ENTER },
      filter: { duration: motionTokens.duration.fast, ease: EASE_ENTER },
    },
  },
  leave: (direction: number) => ({
    y: direction > 0 ? "-0.7em" : "0.7em",
    opacity: 0,
    filter: `blur(${motionTokens.blur.subtle}px)`,
    transition: {
      y: motionTokens.spring.snappy,
      opacity: { duration: motionTokens.duration.instant, ease: EASE_STANDARD },
      filter: { duration: motionTokens.duration.instant },
    },
  }),
};

const digitFade: Variants = {
  enter: { opacity: 0 },
  rest: { opacity: 1, transition: { duration: motionTokens.duration.instant } },
  leave: { opacity: 0, transition: { duration: 0.08 } },
};

const noopSubscribe = () => () => {};

/** True once the tree runs in the browser, so dialogs are only inert during SSR. */
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

interface FaceProps {
  name: BookingStep;
  className?: string;
  direction: number;
  reduced: boolean;
  onSize: (name: BookingStep, width: number, height: number) => void;
  children: ReactNode;
}

function Face({ name, className, direction, reduced, onSize, children }: FaceProps) {
  const ref = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !hydrated) return;
    const measure = () => onSize(name, element.offsetWidth, element.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [name, onSize, hydrated]);

  return (
    <motion.div
      ref={ref}
      className={[styles.face, className].filter(Boolean).join(" ")}
      data-face={name}
      custom={direction}
      variants={reduced ? faceFade : faceSlide}
      initial="hidden"
      animate="shown"
      exit="gone"
      inert={!hydrated || undefined}
    >
      {children}
    </motion.div>
  );
}

interface RoundButtonProps {
  label: string;
  onClick?: () => void;
  tone?: "primary";
  size?: "sm";
  disabled?: boolean;
  focus?: boolean;
  reduced: boolean;
  children: ReactNode;
}

function RoundButton({ label, onClick, tone, size, disabled, focus, reduced, children }: RoundButtonProps) {
  return (
    <motion.button
      type="button"
      className={styles.round}
      data-tone={tone}
      data-size={size}
      data-autofocus={focus || undefined}
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      whileTap={disabled ? undefined : { scale: 0.88 }}
      transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
    >
      {children}
    </motion.button>
  );
}

interface PrimaryButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  focus?: boolean;
  reduced: boolean;
  children: ReactNode;
}

function PrimaryButton({ onClick, disabled, busy, focus, reduced, children }: PrimaryButtonProps) {
  const off = disabled || busy;
  return (
    <motion.button
      type="button"
      className={styles.primary}
      data-autofocus={focus || undefined}
      aria-disabled={off || undefined}
      aria-busy={busy || undefined}
      onClick={off ? undefined : onClick}
      whileTap={off ? undefined : { scale: 0.97 }}
      transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
    >
      {children}
    </motion.button>
  );
}

interface SwapTextProps {
  text: string;
  reduced: boolean;
  className?: string;
}

function SwapText({ text, reduced, className }: SwapTextProps) {
  const hidden = reduced
    ? { opacity: 0 }
    : { opacity: 0, y: "0.35em", filter: `blur(${motionTokens.blur.soft}px)` };
  return (
    <span className={[styles.swap, className].filter(Boolean).join(" ")}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          className={styles.swapItem}
          initial={hidden}
          animate={{ opacity: 1, y: "0em", filter: "blur(0px)" }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: 0.1 } }
              : {
                  opacity: 0,
                  y: "-0.3em",
                  filter: `blur(${motionTokens.blur.subtle}px)`,
                  transition: { duration: 0.14, ease: EASE_STANDARD },
                }
          }
          transition={{ duration: reduced ? 0.15 : 0.24, ease: EASE_ENTER }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function RollingNumber({ value, reduced }: { value: number; reduced: boolean }) {
  const [previous, setPrevious] = useState({ value, direction: 1 });
  if (previous.value !== value) {
    setPrevious({ value, direction: value >= previous.value ? 1 : -1 });
  }
  const digits = [...String(value)];

  return (
    <span className={styles.roll}>
      <AnimatePresence initial={false}>
        {digits.map((digit, index) => (
          <motion.span
            key={digits.length - 1 - index}
            className={styles.column}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={
              reduced ? { duration: 0 } : { width: MORPH, opacity: { duration: motionTokens.duration.fast } }
            }
          >
            <span className={styles.sizer}>0</span>
            <AnimatePresence initial={false} custom={previous.direction}>
              <motion.span
                key={digit}
                className={styles.digit}
                custom={previous.direction}
                variants={reduced ? digitFade : digitIn}
                initial="enter"
                animate="rest"
                exit="leave"
              >
                {digit}
              </motion.span>
            </AnimatePresence>
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}

function SuccessMark({ reduced }: { reduced: boolean }) {
  return (
    <span className={styles.mark} aria-hidden="true">
      <motion.span
        className={styles.markDisc}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduced ? { duration: 0 } : { ...BOOKED, delay: 0.07 }}
      />
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <motion.path
          d="M4 9.4l3.2 3.1L14 5.8"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={
            reduced
              ? { duration: 0 }
              : {
                  pathLength: { duration: 0.36, ease: EASE_ENTER, delay: 0.26 },
                  opacity: { duration: 0.01, delay: 0.26 },
                }
          }
        />
      </svg>
    </span>
  );
}

interface DateStripProps {
  days: Day[];
  open: boolean[];
  index: number;
  x: ReturnType<typeof useMotionValue<number>>;
  reduced: boolean;
  valueText: string;
  onSubmit: () => void;
}

function DateStrip({ days, open, index, x, reduced, valueText, onSubmit }: DateStripProps) {
  const last = days.length - 1;
  const current = useRef(index);
  const dragged = useRef(false);
  const wheelTimer = useRef<number | undefined>(undefined);
  const constraints = useMemo(() => ({ left: -(CELL * last), right: 0 }), [last]);

  useEffect(() => () => window.clearTimeout(wheelTimer.current), []);

  const commit = (value: number, velocity = 0) => {
    const next = clamp(Math.round(value), 0, last);
    current.current = next;
    if (reduced) {
      x.jump(-(CELL * next));
    } else {
      animate(x, -(CELL * next), { ...SWEEP, velocity });
    }
  };

  const cell = (compact: boolean) =>
    days.map((day, position) => (
      <span
        key={day.iso}
        className={styles.cell}
        data-index={compact ? undefined : position}
        data-closed={!open[position] || undefined}
      >
        <span className={styles.cellTop}>
          {day.day === 1 ? MONTHS[day.month].slice(0, 3) : WEEKDAYS[day.weekday].slice(0, 3)}
        </span>
        <span className={styles.cellDay}>{day.day}</span>
      </span>
    ));

  return (
    <div
      className={styles.slider}
      role="slider"
      tabIndex={0}
      aria-label="Date"
      aria-valuemin={0}
      aria-valuemax={last}
      aria-valuenow={index}
      aria-valuetext={valueText}
      data-autofocus
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSubmit();
          return;
        }
        const deltas: Record<string, number> = {
          ArrowRight: 1,
          ArrowDown: 1,
          ArrowLeft: -1,
          ArrowUp: -1,
          PageDown: 7,
          PageUp: -7,
        };
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : event.key in deltas
                ? current.current + deltas[event.key]
                : null;
        if (next !== null) {
          event.preventDefault();
          commit(next);
        }
      }}
      onWheel={(event) => {
        if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
        x.stop();
        x.set(clamp(x.get() - event.deltaX, -(CELL * last) - 26, 26));
        window.clearTimeout(wheelTimer.current);
        wheelTimer.current = window.setTimeout(() => commit(-x.get() / CELL), 110);
      }}
    >
      <div className={styles.track}>
        <motion.div
          className={styles.strip}
          style={{ x }}
          drag="x"
          dragConstraints={constraints}
          dragElastic={0.16}
          dragMomentum={false}
          onPointerDown={() => {
            dragged.current = false;
          }}
          onDragStart={() => {
            dragged.current = true;
          }}
          onDragEnd={(_event, info) => {
            const projected = reduced ? 0 : ((info.velocity.x / 1e3) * 0.99) / (1 - 0.99);
            commit(-(x.get() + projected) / CELL, info.velocity.x);
          }}
          onClick={(event) => {
            if (dragged.current) return;
            const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-index]") : null;
            if (target) commit(Number(target.dataset.index));
          }}
        >
          {cell(false)}
        </motion.div>
        <motion.div className={styles.lens} aria-hidden="true" variants={reduced ? undefined : lensIn}>
          <motion.div className={styles.strip} style={{ x }}>
            {cell(true)}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

interface TimeGridProps {
  times: string[];
  free: string[];
  value: string | null;
  onChange: (value: string) => void;
  reduced: boolean;
  cycle: 12 | 24;
}

function TimeGrid({ times, free, value, onChange, reduced, cycle }: TimeGridProps) {
  const grid = useRef<HTMLDivElement>(null);
  const left = useMotionValue(0);
  const top = useMotionValue(0);
  const width = useMotionValue(0);
  const height = useMotionValue(0);
  const measured = useRef(false);
  const selected = value ? times.indexOf(value) : -1;
  const firstFree = times.findIndex((time) => free.includes(time));

  useLayoutEffect(() => {
    const element = grid.current;
    if (!element || selected < 0) return;
    const sync = (jump: boolean) => {
      const slot = element.querySelector<HTMLElement>(`[data-slot="${selected}"]`);
      if (!slot) return;
      const box = [slot.offsetLeft, slot.offsetTop, slot.offsetWidth, slot.offsetHeight];
      [left, top, width, height].forEach((motionValue, position) => {
        if (jump) motionValue.jump(box[position]);
        else animate(motionValue, box[position], HIGHLIGHT);
      });
    };
    sync(!measured.current || reduced);
    measured.current = true;

    let observedWidth = element.offsetWidth;
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (element.offsetWidth !== observedWidth) {
        observedWidth = element.offsetWidth;
        sync(true);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [height, left, selected, reduced, top, width]);

  return (
    <div ref={grid} className={styles.slots} role="radiogroup" aria-label="Time">
      <motion.span
        className={styles.highlight}
        aria-hidden="true"
        data-hidden={selected < 0 || undefined}
        style={{ x: left, y: top, width, height }}
        variants={reduced ? undefined : lensIn}
      />
      {times.map((time, position) => {
        const isFree = free.includes(time);
        const isChecked = position === selected;
        return (
          <motion.button
            key={time}
            type="button"
            role="radio"
            className={styles.slot}
            data-slot={position}
            data-autofocus={isChecked || undefined}
            aria-checked={isChecked}
            aria-disabled={!isFree || undefined}
            tabIndex={isChecked || (selected < 0 && position === firstFree) ? 0 : -1}
            custom={position}
            variants={reduced ? undefined : slotIn}
            whileTap={isFree ? { scale: 0.94 } : undefined}
            transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
            onClick={() => {
              if (isFree) onChange(time);
            }}
            onKeyDown={(event) => {
              const deltas: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 4, ArrowUp: -4 };
              let next = -1;
              if (event.key in deltas) {
                const step = deltas[event.key];
                for (let cursor = position + step; cursor >= 0 && cursor < times.length; cursor += step) {
                  if (free.includes(times[cursor])) {
                    next = cursor;
                    break;
                  }
                }
              } else if (event.key === "Home") {
                next = firstFree;
              } else if (event.key === "End") {
                for (let cursor = times.length - 1; cursor >= 0; cursor -= 1) {
                  if (free.includes(times[cursor])) {
                    next = cursor;
                    break;
                  }
                }
              } else {
                return;
              }
              event.preventDefault();
              if (next < 0) return;
              onChange(times[next]);
              grid.current?.querySelector<HTMLElement>(`[data-slot="${next}"]`)?.focus();
            }}
          >
            {formatTime(time, cycle)}
          </motion.button>
        );
      })}
    </div>
  );
}

/** Walk forward from `startDate`, computing weekdays without touching the local clock. */
function buildDays(startDate: string, count: number): Day[] {
  const [rawYear, rawMonth, rawDay] = startDate.split("-").map(Number);
  let year = rawYear || 2026;
  let month = clamp((rawMonth || 1) - 1, 0, 11);
  let day = clamp(rawDay || 1, 1, 31);
  const lengths = [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return Array.from({ length: count }, () => {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
    const monthLengths = lengths.map((length, position) => (position === 1 ? leap : length));
    const zellerYear = month < 2 ? year - 1 : year;
    const weekday =
      (zellerYear +
        Math.floor(zellerYear / 4) -
        Math.floor(zellerYear / 100) +
        Math.floor(zellerYear / 400) +
        [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4][month] +
        day) %
      7;
    const day$: Day = {
      iso: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      weekday,
      day,
      month,
    };
    day += 1;
    if (day > monthLengths[month]) {
      day = 1;
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
    return day$;
  });
}

/** Closest time on the clock, so a taken preferred slot still lands somewhere sensible. */
function nearest(free: string[], preferred: string) {
  let best: string | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const time of free) {
    const delta = Math.abs(parseTime(time) - parseTime(preferred));
    if (delta < distance) {
      distance = delta;
      best = time;
    }
  }
  return best;
}

export function BookingPill({
  venue,
  venueDetail,
  startDate,
  days = 21,
  times = DEFAULT_TIMES,
  isAvailable = alwaysOpen,
  preferredTime = "19:30",
  minPartySize = 1,
  maxPartySize = 12,
  defaultPartySize = 2,
  onConfirm = simulatedBooking,
  onStepChange,
  hourCycle = 12,
  label = "Book a table",
  className,
}: BookingPillProps) {
  const hydrated = useHydrated();
  const reduced = Boolean(useReducedMotion()) && hydrated;

  const root = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);

  const [step, setStep] = useState<BookingStep>("start");
  const [direction, setDirection] = useState(1);
  const [partySize, setPartySize] = useState(() => clamp(defaultPartySize, minPartySize, maxPartySize));
  const [chosenTime, setChosenTime] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [announcement, setAnnouncement] = useState("");

  const days$ = useMemo(() => buildDays(startDate, Math.max(1, days)), [startDate, days]);
  const open = useMemo(
    () => days$.map((day) => times.some((time) => isAvailable(day.iso, time, partySize))),
    [days$, times, isAvailable, partySize],
  );

  const [dayIndex, setDayIndex] = useState(() => Math.max(0, open.indexOf(true)));
  const stripX = useMotionValue(-(CELL * dayIndex));
  useMotionValueEvent(stripX, "change", (value) =>
    setDayIndex(clamp(Math.round(-value / CELL), 0, days$.length - 1)),
  );

  const day = days$[Math.min(dayIndex, days$.length - 1)];
  const freeTimes = times.filter((time) => isAvailable(day.iso, time, partySize));
  const selectedTime =
    chosenTime && freeTimes.includes(chosenTime) ? chosenTime : nearest(freeTimes, chosenTime ?? preferredTime);

  const widthMV = useMotionValue(0);
  const heightMV = useMotionValue(0);
  const [measured, setMeasured] = useState(false);
  const sizeRef = useRef({ width: 0, height: 0 });
  const reducedRef = useRef(reduced);
  const compress = useMotionValue(0);

  useEffect(() => {
    reducedRef.current = reduced;
    compress.set(+!reduced);
  }, [compress, reduced]);

  const widthVelocity = useVelocity(widthMV);
  const heightVelocity = useVelocity(heightMV);
  const scaleX = useTransform([heightVelocity, compress], ([velocity, factor]) =>
    1 - Number(factor) * Math.min(0.035, Math.abs(Number(velocity)) / 45000),
  );
  const scaleY = useTransform([widthVelocity, compress], ([velocity, factor]) =>
    1 - Number(factor) * Math.min(0.035, Math.abs(Number(velocity)) / 45000),
  );

  const onSize = useCallback(
    (name: BookingStep, width: number, height: number) => {
      const previous = sizeRef.current;
      if (previous.width === width && previous.height === height) return;
      sizeRef.current = { width, height };
      if (!previous.width || reducedRef.current) {
        widthMV.jump(width);
        heightMV.jump(height);
        setMeasured(true);
        return;
      }
      const spring = name === "booked" ? BOOKED : width * height >= previous.width * previous.height ? MORPH : GROW;
      animate(widthMV, width, spring);
      animate(heightMV, height, spring);
    },
    [heightMV, widthMV],
  );

  const perforation = useMotionValue(0);
  useEffect(() => {
    const on = step === "review";
    const controls = animate(
      perforation,
      on ? 10 : 0,
      reduced
        ? { duration: 0 }
        : on
          ? { ...motionTokens.spring.snappy, delay: 0.16 }
          : { duration: motionTokens.duration.instant, ease: EASE_STANDARD },
    );
    return () => controls.stop();
  }, [perforation, reduced, step]);

  const mask = useTransform(perforation, (radius) =>
    radius < 0.5
      ? "none"
      : ["left", "right"]
          .map(
            (side) =>
              `radial-gradient(circle ${radius.toFixed(2)}px at ${100 * Number(side !== "left")}% calc(100% - var(--stub)), #0000 ${(radius - 0.5).toFixed(2)}px, #000 ${radius.toFixed(2)}px) ${side} / 51% 100% no-repeat`,
          )
          .join(", "),
  );

  useEffect(() => {
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    root.current
      ?.querySelector<HTMLElement>(`[data-face="${step}"] [data-autofocus]`)
      ?.focus({ preventScroll: true });
  }, [step]);

  const go = (next: BookingStep, toward?: number) => {
    restoreFocus.current = Boolean(root.current?.contains(document.activeElement));
    setDirection(toward ?? (Math.sign(STEPS.indexOf(next) - STEPS.indexOf(step)) || 1));
    setStep(next);
    onStepChange?.(next);
    if (next === "time") {
      setAnnouncement(
        freeTimes.length
          ? `${plural(freeTimes.length, "time")} free on ${formatLong(day)}`
          : `No tables free on ${formatLong(day)}`,
      );
    }
  };

  const back = status === "sending" ? undefined : BACK[step];

  const confirm = async () => {
    if (status === "sending" || !selectedTime) return;
    setStatus("sending");
    setAnnouncement("Booking");
    try {
      await onConfirm({ date: day.iso, time: selectedTime, partySize });
      setStatus("idle");
      setAnnouncement(
        `Booked a table for ${partySize} at ${venue} on ${formatLong(day)} at ${formatTime(selectedTime, hourCycle)}`,
      );
      go("booked");
    } catch {
      setStatus("error");
      setAnnouncement("");
    }
  };

  const faceProps = { direction, reduced, onSize };
  const partyLabel = plural(partySize, "guest");

  return (
    <div
      ref={root}
      className={[styles.root, className].filter(Boolean).join(" ")}
      onKeyDown={(event) => {
        if (event.key === "Escape" && back) {
          event.preventDefault();
          go(back);
        }
      }}
    >
      <motion.div
        className={styles.frame}
        style={measured ? { width: widthMV, height: heightMV, scaleX, scaleY } : { scaleX, scaleY }}
        whileTap={step === "start" ? { scale: 0.96 } : undefined}
        transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
      >
        <span className={styles.shadow} aria-hidden="true" />
        <motion.div
          className={styles.shape}
          role="group"
          aria-label={`${label} at ${venue}`}
          style={{ mask, WebkitMask: mask }}
        >
          <AnimatePresence initial={false} custom={direction}>
            {step === "start" && (
              <Face key="start" name="start" {...faceProps}>
                <button type="button" className={styles.start} data-autofocus onClick={() => go("party")}>
                  <CalendarDays size={18} aria-hidden="true" />
                  {label}
                </button>
              </Face>
            )}

            {step === "party" && (
              <Face key="party" name="party" className={styles.row} {...faceProps}>
                <RoundButton label="Back" onClick={() => go("start")} reduced={reduced}>
                  <ArrowLeft size={18} aria-hidden="true" />
                </RoundButton>
                <div className={styles.stepper} role="group" aria-label="Party size">
                  <RoundButton
                    label="Fewer guests"
                    size="sm"
                    disabled={partySize <= minPartySize}
                    onClick={() => setPartySize((value) => clamp(value - 1, minPartySize, maxPartySize))}
                    reduced={reduced}
                  >
                    <Minus size={16} aria-hidden="true" />
                  </RoundButton>
                  <output className={styles.count} aria-live="polite">
                    <span className={styles.srOnly}>{partyLabel}</span>
                    <span className={styles.countInk} aria-hidden="true">
                      <RollingNumber value={partySize} reduced={reduced} />
                      <span className={styles.countWord}>
                        guest
                        <AnimatePresence initial={false}>
                          {partySize !== 1 && (
                            <motion.span
                              key="s"
                              className={styles.plural}
                              initial={{ width: 0, opacity: 0 }}
                              animate={{ width: "auto", opacity: 1 }}
                              exit={{ width: 0, opacity: 0 }}
                              transition={
                                reduced
                                  ? { duration: 0 }
                                  : {
                                      width: motionTokens.spring.snappy,
                                      opacity: { duration: motionTokens.duration.fast },
                                    }
                              }
                            >
                              s
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>
                    </span>
                  </output>
                  <RoundButton
                    label="More guests"
                    size="sm"
                    focus
                    disabled={partySize >= maxPartySize}
                    onClick={() => setPartySize((value) => clamp(value + 1, minPartySize, maxPartySize))}
                    reduced={reduced}
                  >
                    <Plus size={16} aria-hidden="true" />
                  </RoundButton>
                </div>
                <RoundButton
                  label="Next, choose a date"
                  tone="primary"
                  onClick={() => go("date")}
                  reduced={reduced}
                >
                  <ArrowRight size={18} aria-hidden="true" />
                </RoundButton>
              </Face>
            )}

            {step === "date" && (
              <Face key="date" name="date" className={styles.dateFace} {...faceProps}>
                <div className={styles.bar}>
                  <RoundButton label="Back to party size" onClick={() => go("party")} reduced={reduced}>
                    <ArrowLeft size={18} aria-hidden="true" />
                  </RoundButton>
                  <SwapText className={styles.title} text={formatLong(day)} reduced={reduced} />
                  <RoundButton
                    label="Next, choose a time"
                    tone="primary"
                    onClick={() => go("time")}
                    reduced={reduced}
                  >
                    <ArrowRight size={18} aria-hidden="true" />
                  </RoundButton>
                </div>
                <DateStrip
                  days={days$}
                  open={open}
                  index={dayIndex}
                  x={stripX}
                  reduced={reduced}
                  valueText={`${formatLong(day)}${open[dayIndex] ? "" : ", no tables free"}`}
                  onSubmit={() => go("time")}
                />
              </Face>
            )}

            {step === "time" && (
              <Face key="time" name="time" className={styles.panel} {...faceProps}>
                <div className={styles.bar}>
                  <RoundButton
                    label="Back to dates"
                    focus={!selectedTime}
                    onClick={() => go("date")}
                    reduced={reduced}
                  >
                    <ArrowLeft size={18} aria-hidden="true" />
                  </RoundButton>
                  <span className={styles.heading}>
                    <span className={styles.headingTitle}>
                      <span className={styles.headingLong}>{formatLong(day)}</span>
                      <span className={styles.headingShort}>{formatShort(day)}</span>
                    </span>
                    <span className={styles.headingSub}>
                      {partyLabel} · {freeTimes.length ? `${freeTimes.length} free` : "No tables free"}
                    </span>
                  </span>
                  <span aria-hidden="true" />
                </div>
                <TimeGrid
                  times={times}
                  free={freeTimes}
                  value={selectedTime}
                  onChange={setChosenTime}
                  reduced={reduced}
                  cycle={hourCycle}
                />
                <PrimaryButton
                  disabled={!selectedTime}
                  onClick={() => go("review")}
                  reduced={reduced}
                >
                  {selectedTime ? "Review booking" : "Pick another day"}
                </PrimaryButton>
              </Face>
            )}

            {step === "review" && selectedTime && (
              <Face key="review" name="review" className={styles.ticket} {...faceProps}>
                <div className={styles.ticketMain}>
                  <motion.span className={styles.venue} custom={0} variants={reduced ? undefined : ticketLine}>
                    <span className={styles.venueName}>{venue}</span>
                    {venueDetail && <span className={styles.venueDetail}>{venueDetail}</span>}
                  </motion.span>
                  <motion.dl className={styles.facts} custom={1} variants={reduced ? undefined : ticketLine}>
                    <div className={styles.fact}>
                      <dt>Date</dt>
                      <dd>{formatShort(day)}</dd>
                    </div>
                    <div className={styles.fact}>
                      <dt>Time</dt>
                      <dd>{formatTime(selectedTime, hourCycle)}</dd>
                    </div>
                    <div className={styles.fact}>
                      <dt>Guests</dt>
                      <dd>{partySize}</dd>
                    </div>
                  </motion.dl>
                  {status === "error" && (
                    <p className={styles.error} role="alert">
                      This table couldn’t be booked. Try again.
                    </p>
                  )}
                </div>
                <div className={styles.stub}>
                  <motion.span
                    className={styles.perforation}
                    aria-hidden="true"
                    variants={reduced ? undefined : perforate}
                  />
                  <RoundButton
                    label="Change time"
                    disabled={status === "sending"}
                    onClick={() => go("time")}
                    reduced={reduced}
                  >
                    <ArrowLeft size={18} aria-hidden="true" />
                  </RoundButton>
                  <PrimaryButton busy={status === "sending"} focus onClick={confirm} reduced={reduced}>
                    <SwapText
                      text={
                        status === "sending" ? "Booking…" : status === "error" ? "Try again" : "Confirm booking"
                      }
                      reduced={reduced}
                    />
                  </PrimaryButton>
                </div>
              </Face>
            )}

            {step === "booked" && selectedTime && (
              <Face key="booked" name="booked" className={styles.booked} {...faceProps}>
                <SuccessMark reduced={reduced} />
                <motion.span className={styles.bookedText} custom={1} variants={reduced ? undefined : ticketLine}>
                  <span className={styles.bookedTitle}>Table for {partySize} booked</span>
                  <span className={styles.bookedDetail}>
                    {formatShort(day)} at {formatTime(selectedTime, hourCycle)}
                  </span>
                </motion.span>
                <RoundButton
                  label="Book another table"
                  size="sm"
                  focus
                  onClick={() => {
                    setAnnouncement("");
                    go("start", -1);
                  }}
                  reduced={reduced}
                >
                  <RotateCcw size={16} aria-hidden="true" />
                </RoundButton>
              </Face>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

export default BookingPill;
