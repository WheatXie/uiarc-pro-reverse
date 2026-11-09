"use client";

import {
  useCallback,
  useEffect,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
  type Transition,
} from "motion/react";
import { Moon, Sun } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./time-dial.module.css";

const { spring, duration, ease, blur } = motionTokens;
const enterEase = [...ease.enter] as [number, number, number, number];
const standardEase = [...ease.standard] as [number, number, number, number];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT_WORK: [number, number] = [540, 1080];

const wrap = (value: number, mod: number) => ((value % mod) + mod) % mod;
const pad2 = (value: number) => String(value).padStart(2, "0");
const snap15 = (value: number) => 15 * Math.round(value / 15);
const HOUR_FACES = Array.from({ length: 24 }, (_, index) => pad2(index));
const HOUR_FACES_12 = Array.from({ length: 24 }, (_, index) => String((index % 12) || 12));
const QUARTER_FACES = ["00", "15", "30", "45"];

/** Builds a critically damped spring from a visual duration and a bounce ratio. */
const springFrom = ({ visualDuration, bounce }: { visualDuration: number; bounce: number }): Transition => {
  const omega = (2 * Math.PI) / (1.2 * visualDuration);
  return { type: "spring", stiffness: omega * omega, damping: 2 * (1 - bounce) * omega, mass: 1 };
};

const STEP_SPRING = springFrom({ visualDuration: 0.3, bounce: 0 });
const THROW_SPRING = springFrom({ visualDuration: 0.56, bounce: 0 });
const BOUND_SPRING = springFrom({ visualDuration: 0.4, bounce: 0 });
const MORPH_SPRING = springFrom(spring.morph);
const LAG_SPRING = springFrom({ visualDuration: 0.62, bounce: 0 });
const COAST_SPRING: Transition = { type: "spring", stiffness: 46.69444444444444, damping: 11.206666666666665, mass: 1 };

/** Soft quarter hour detents: the value lags the finger on purpose. */
const detent = (value: number) => value - (10.799999999999999 / (2 * Math.PI)) * Math.sin((2 * Math.PI * value) / 15);
const detentSlope = (value: number) => 1 - 0.72 * Math.cos((2 * Math.PI * value) / 15);
/** Rubber band past the min and max bounds. */
const rubber = (overshoot: number) => (90 * overshoot * 0.55) / (90 + 0.55 * overshoot);

const polar = (degrees: number, radius: number): [number, number] => {
  const radians = (degrees * Math.PI) / 180;
  return [150 + radius * Math.sin(radians), 150 - radius * Math.cos(radians)];
};

const isDaytime = (minutes: number) => {
  const at = wrap(minutes, 1440);
  return at >= 360 && at < 1080;
};
const isWorking = (minutes: number, [start, end]: [number, number]) => {
  const at = wrap(minutes, 1440);
  return at >= start && at < end;
};
const dayOffset = (minutes: number) => Math.floor(minutes / 1440);

const formatTime = (minutes: number, cycle: 12 | 24 = 24) => {
  const at = wrap(Math.round(minutes), 1440);
  const hour = Math.floor(at / 60);
  return cycle === 12
    ? `${(hour % 12) || 12}:${pad2(at % 60)} ${hour < 12 ? "AM" : "PM"}`
    : `${pad2(hour)}:${pad2(at % 60)}`;
};

const formatSpan = (minutes: number) =>
  [Math.floor(minutes / 60) && `${Math.floor(minutes / 60)} h`, minutes % 60 && `${minutes % 60} min`]
    .filter(Boolean)
    .join(" ");

const formatOffset = (offset: number) =>
  `UTC${offset < 0 ? "−" : "+"}${Math.floor(Math.abs(offset) / 60)}${
    Math.abs(offset) % 60 ? `:${pad2(Math.abs(offset) % 60)}` : ""
  }`;

const formatDelta = (delta: number) => (delta === 0 ? "Same time" : `${formatSpan(Math.abs(delta))} ${delta > 0 ? "ahead" : "behind"}`);

const formatDays = (days: number) =>
  Math.abs(days) === 1
    ? days > 0
      ? "next day"
      : "previous day"
    : `${Math.abs(days)} days ${days > 0 ? "later" : "earlier"}`;

const zoneKey = (minutes: number, cities: TimeDialCity[], work: [number, number]) =>
  cities
    .map((city) => {
      const local = snap15(minutes + city.offset);
      return `${isDaytime(local) ? "d" : "n"}${isWorking(local, work) ? "w" : ""}${dayOffset(local)}`;
    })
    .join(" ");

const subscribe = () => () => {};

const textVariants = {
  hidden: { opacity: 0, y: "0.4em", filter: `blur(${blur.soft}px)` },
  shown: {
    opacity: 1,
    y: "0em",
    filter: "blur(0px)",
    transition: {
      y: spring.snappy,
      opacity: { duration: duration.standard, ease: enterEase },
      filter: { duration: duration.standard, ease: enterEase },
    },
  },
  gone: {
    opacity: 0,
    y: "-0.4em",
    filter: `blur(${blur.subtle}px)`,
    transition: { duration: duration.instant, ease: standardEase },
  },
};

const fadeVariants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: duration.fast } },
  gone: { opacity: 0, transition: { duration: duration.instant } },
};

const iconVariants = {
  hidden: { opacity: 0, rotate: -90, scale: 0.4, filter: `blur(${blur.soft}px)` },
  shown: {
    opacity: 1,
    rotate: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      rotate: spring.morph,
      scale: spring.snappy,
      opacity: { duration: duration.standard, ease: enterEase },
      filter: { duration: duration.standard, ease: enterEase },
    },
  },
  gone: {
    opacity: 0,
    rotate: 90,
    scale: 0.4,
    filter: `blur(${blur.subtle}px)`,
    transition: { duration: duration.exit, ease: standardEase },
  },
};

const chipVariants = {
  hidden: { opacity: 0, scale: 0.5, x: 10, filter: `blur(${blur.soft}px)` },
  shown: {
    opacity: 1,
    scale: 1,
    x: 0,
    filter: "blur(0px)",
    transition: {
      scale: spring.morph,
      x: spring.snappy,
      opacity: { duration: duration.fast, ease: enterEase },
      filter: { duration: duration.standard, ease: enterEase },
    },
  },
  gone: {
    opacity: 0,
    scale: 0.6,
    filter: `blur(${blur.subtle}px)`,
    transition: { duration: duration.instant, ease: standardEase },
  },
};

export type TimeDialCity = {
  /** Stable id, also used for the home selection. */
  id: string;
  name: string;
  /** Two or three letters drawn on the dial. */
  code: string;
  /** Minutes from UTC, in steps of 15. */
  offset: number;
};

export type TimeDialProps = {
  cities: TimeDialCity[];
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  homeId?: string;
  defaultHomeId?: string;
  onHomeChange?: (id: string) => void;
  min?: number;
  max?: number;
  weekday?: number;
  hourCycle?: 12 | 24;
  workingHours?: [number, number];
  label?: string;
  className?: string;
};

function useMotionEvent(value: MotionValue<number>, event: "change", handler: (latest: number) => void) {
  useInsertionEffect(() => value.on(event, handler), [value, event, handler]);
}

function SwapText({ text, reduced, className }: { text: string; reduced: boolean; className?: string }) {
  return (
    <span className={[styles.swap, className].filter(Boolean).join(" ")}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          className={styles.swapItem}
          variants={reduced ? fadeVariants : textVariants}
          initial="hidden"
          animate="shown"
          exit="gone"
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function SwapIcon({ daytime, reduced }: { daytime: boolean; reduced: boolean }) {
  return (
    <span className={styles.iconSwap}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={daytime ? "day" : "night"}
          className={styles.iconItem}
          variants={reduced ? fadeVariants : iconVariants}
          initial="hidden"
          animate="shown"
          exit="gone"
        >
          {daytime ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Wheel({ position, faces }: { position: MotionValue<number>; faces: string[] }) {
  const y = useTransform(position, (value) => `${-(1.3 * wrap(value, faces.length))}em`);
  const widest = faces.reduce((longest, face) => (face.length > longest.length ? face : longest), faces[0]);
  return (
    <span className={styles.wheel}>
      <span className={styles.sizer}>{widest}</span>
      <motion.span className={styles.strip} style={{ y }}>
        {[...faces, faces[0]].map((face, index) => (
          <span className={styles.face} key={index}>
            {face}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

function Clock({
  turn,
  offset,
  lag,
  cycle,
  reduced,
  className,
}: {
  turn: MotionValue<number>;
  offset: number;
  lag?: MotionValue<number>;
  cycle: 12 | 24;
  reduced: boolean;
  className?: string;
}) {
  const zero = useMotionValue(0);
  const smooth = lag ?? zero;
  const minutePosition = useTransform([turn, smooth] as MotionValue<number>[], ([latest, drift]: number[]) => {
    const at = wrap(latest + offset, 1440);
    const hour = Math.floor(at / 60);
    return hour + Math.min(1, Math.max(0, (at - 60 * hour - 45) / 15)) + drift / 60;
  });
  const quarterPosition = useTransform(turn, (latest) => wrap(latest + offset, 1440) / 15);
  const [meridiem, setMeridiem] = useState<"AM" | "PM">(() => (720 > wrap(turn.get() + offset, 1440) ? "AM" : "PM"));

  useMotionEvent(turn, "change", (latest) => {
    const next = 720 > wrap(snap15(latest) + offset, 1440) ? "AM" : "PM";
    if (next !== meridiem) setMeridiem(next);
  });

  return (
    <span className={[styles.clock, className].filter(Boolean).join(" ")} data-cycle={cycle} aria-hidden="true">
      <Wheel position={minutePosition} faces={cycle === 12 ? HOUR_FACES_12 : HOUR_FACES} />
      <span className={styles.colon}>:</span>
      <Wheel position={quarterPosition} faces={QUARTER_FACES} />
      {cycle === 12 && <SwapText className={styles.meridiem} text={meridiem} reduced={reduced} />}
    </span>
  );
}

type Tick = { hour: number; major: boolean };
type Numeral = { hour: number; x: string; y: string; anchor: "start" | "middle" | "end" };

const TICKS: Tick[] = Array.from({ length: 24 }, (_, hour) => ({ hour, major: hour % 6 === 0 }));
const NUMERALS: Numeral[] = [0, 6, 12, 18].map((hour) => {
  const half = hour % 12 === 6;
  const [x, y] = polar((60 * hour - 720) / 4, half ? 130 : 127);
  return {
    hour,
    x: x.toFixed(2),
    y: y.toFixed(2),
    anchor: half ? (hour === 6 ? "start" : "end") : "middle",
  };
});

const workArc = (start: number, end: number) => {
  const from = (start - 720) / 4;
  const to = (end - 720) / 4;
  const large = +(wrap(end - start, 1440) > 720);
  const [ax, ay] = polar(from, 130);
  const [bx, by] = polar(to, 130);
  const [cx, cy] = polar(to, 60);
  const [dx, dy] = polar(from, 60);
  return `M${ax.toFixed(2)} ${ay.toFixed(2)}A130 130 0 ${large} 1 ${bx.toFixed(2)} ${by.toFixed(2)}L${cx.toFixed(2)} ${cy.toFixed(2)}A60 60 0 ${large} 0 ${dx.toFixed(2)} ${dy.toFixed(2)}Z`;
};

function Face({ tracks, cycle, work }: { tracks: number[]; cycle: 12 | 24; work: [number, number] }) {
  return (
    <svg className={styles.svg} viewBox="0 0 300 300" aria-hidden="true" focusable="false">
      <circle className={styles.plate} cx={150} cy={150} r={146} />
      <path className={styles.work} d={workArc(work[0], work[1])} />
      <circle className={styles.rim} cx={150} cy={150} r={146} />
      <circle className={styles.homeTrack} cx={150} cy={150} r={106} />
      {tracks.map((radius) => (
        <circle className={styles.track} cx={150} cy={150} r={radius} key={radius} />
      ))}
      <circle className={styles.core} cx={150} cy={150} r={56} />
      {TICKS.map((tick) => (
        <line
          className={tick.major ? styles.major : styles.hour}
          x1={150}
          y1={9}
          x2={150}
          y2={4 + (tick.major ? 12 : 9)}
          transform={`rotate(${15 * tick.hour} 150 150)`}
          key={tick.hour}
        />
      ))}
      {NUMERALS.map((numeral) => (
        <text
          className={styles.numeral}
          x={numeral.x}
          y={numeral.y}
          textAnchor={numeral.anchor}
          dominantBaseline="central"
          key={numeral.hour}
        >
          {cycle === 24 ? pad2(numeral.hour) : numeral.hour === 12 ? "Noon" : `${(numeral.hour % 12) || 12} ${numeral.hour < 12 ? "AM" : "PM"}`}
        </text>
      ))}
    </svg>
  );
}

function CityArm({
  city,
  turn,
  home,
  track,
  daytime,
  working,
  lifted,
  reduced,
}: {
  city: TimeDialCity;
  turn: MotionValue<number>;
  home: boolean;
  track: number;
  daytime: boolean;
  working: boolean;
  lifted: boolean;
  reduced: boolean;
}) {
  const rotate = useTransform(turn, (latest) => (latest + city.offset - 720) / 4);
  const counter = useTransform(rotate, (angle) => -angle);
  const radius = useMotionValue(track);
  const y = useTransform(radius, (value) => `${-value / 3}cqi`);
  const codeX = useTransform(rotate, (angle) => `${-(5.4 * Math.sin((angle * Math.PI) / 180))}cqi`);
  const codeY = useTransform(rotate, (angle) => `${3.4 * Math.cos((angle * Math.PI) / 180)}cqi`);

  useEffect(() => {
    const controls = animate(radius, track, reduced ? { duration: 0 } : MORPH_SPRING);
    return () => controls.stop();
  }, [radius, reduced, track]);

  return (
    <motion.div className={styles.arm} style={{ rotate }} data-home={home || undefined}>
      <motion.div className={styles.anchor} style={{ y, rotate: counter }}>
        <motion.span
          className={styles.bead}
          data-working={working || undefined}
          initial={false}
          animate={{ scale: home ? (lifted ? 1.12 : 1) : 0.3 }}
          transition={reduced ? { duration: 0 } : MORPH_SPRING}
        >
          <motion.span
            className={styles.glyph}
            initial={false}
            animate={{ opacity: home ? 1 : 0 }}
            transition={
              home
                ? { duration: duration.standard, ease: enterEase, delay: 0.07 * (reduced ? 0 : 1) }
                : { duration: duration.instant, ease: standardEase }
            }
          >
            <SwapIcon daytime={daytime} reduced={reduced} />
          </motion.span>
        </motion.span>
        <motion.span
          className={styles.code}
          style={{ x: codeX, y: codeY }}
          initial={false}
          animate={{ opacity: home ? 0 : 1 }}
          transition={
            home
              ? { duration: duration.instant, ease: standardEase }
              : { duration: duration.standard, ease: enterEase, delay: 0.14 * (reduced ? 0 : 1) }
          }
        >
          {city.code}
        </motion.span>
      </motion.div>
    </motion.div>
  );
}

function CityRow({
  city,
  homeCity,
  turn,
  at,
  committed,
  cycle,
  work,
  reduced,
  highlightId,
  onSelect,
}: {
  city: TimeDialCity;
  homeCity: TimeDialCity;
  turn: MotionValue<number>;
  at: number;
  committed: number;
  cycle: 12 | 24;
  work: [number, number];
  reduced: boolean;
  highlightId: string;
  onSelect: () => void;
}) {
  const home = city.id === homeCity.id;
  const daytime = isDaytime(at + city.offset);
  const working = isWorking(at + city.offset, work);
  const shift = dayOffset(at + city.offset) - dayOffset(at + homeCity.offset);
  const meta = home ? `Home · ${formatOffset(city.offset)}` : `${formatOffset(city.offset)} · ${formatDelta(city.offset - homeCity.offset)}`;
  const dayShift = dayOffset(committed + city.offset) - dayOffset(committed + homeCity.offset);
  const aria = `${city.name}, ${formatTime(committed + city.offset, cycle)}${dayShift ? `, ${formatDays(dayShift)}` : ""}${
    isWorking(committed + city.offset, work) ? ", working hours" : ""
  }, ${home ? "home city" : formatDelta(city.offset - homeCity.offset)}`;

  return (
    <li className={styles.item}>
      <button type="button" className={styles.row} aria-pressed={home} aria-label={aria} onClick={onSelect}>
        {home && <motion.span layoutId={highlightId} className={styles.highlight} transition={reduced ? { duration: 0 } : MORPH_SPRING} />}
        <span className={styles.rowIcon} data-day={daytime || undefined} data-working={working || undefined}>
          <SwapIcon daytime={daytime} reduced={reduced} />
        </span>
        <span className={styles.rowText}>
          <span className={styles.rowCity}>{city.name}</span>
          <SwapText className={styles.rowMeta} text={meta} reduced={reduced} />
        </span>
        <span className={styles.chipSlot}>
          <AnimatePresence mode="popLayout" initial={false}>
            {shift !== 0 && (
              <motion.span
                className={styles.chip}
                key={shift}
                variants={reduced ? fadeVariants : chipVariants}
                initial="hidden"
                animate="shown"
                exit="gone"
              >
                {`${shift > 0 ? "+" : "−"}${Math.abs(shift)} day${Math.abs(shift) === 1 ? "" : "s"}`}
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <Clock className={styles.rowTime} turn={turn} offset={city.offset} cycle={cycle} reduced={reduced} />
      </button>
    </li>
  );
}

type DragState = {
  id: number;
  cx: number;
  cy: number;
  radius: number;
  x: number;
  y: number;
  angle: number;
  raw: number;
  from: number;
  moved: boolean;
  samples: { t: number; v: number }[];
};

const angleAt = (x: number, y: number, center: { cx: number; cy: number }) => (180 * Math.atan2(x - center.cx, center.cy - y)) / Math.PI;

/** Inverts the detent curve so the finger grabs the value it is pointing at. */
const unsnap = (value: number) => {
  let next = value;
  for (let index = 0; index < 4; index += 1) next -= (detent(next) - value) / detentSlope(next);
  return next;
};

export function TimeDial({
  cities,
  value,
  defaultValue = 0,
  onValueChange,
  homeId,
  defaultHomeId,
  onHomeChange,
  min = -Infinity,
  max = Infinity,
  weekday = 1,
  hourCycle = 12,
  workingHours = DEFAULT_WORK,
  label = "Time",
  className,
}: TimeDialProps) {
  const [workStart, workEnd] = workingHours;
  const work = useMemo<[number, number]>(() => [workStart, workEnd], [workStart, workEnd]);
  const baseId = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const reduced = !!useReducedMotion() && mounted;
  const floor = Number.isFinite(min) ? 15 * Math.ceil(min / 15) : -Infinity;
  const ceiling = Number.isFinite(max) ? 15 * Math.floor(max / 15) : Infinity;
  const bound = useCallback(
    (next: number) => Math.min(ceiling, Math.max(floor, next)),
    [ceiling, floor],
  );
  const controlled = value !== undefined;
  const [innerValue, setInnerValue] = useState(() => snap15(defaultValue));
  const committed = controlled ? (value as number) : innerValue;
  const [innerHome, setInnerHome] = useState(defaultHomeId ?? cities[0]?.id);
  const home = cities.find((city) => city.id === (homeId ?? innerHome)) ?? cities[0];

  const turn = useMotionValue(committed);
  const settle = useMotionValue(committed);
  const highlight = useMotionValue(0);
  const lag = useMotionValue(0);
  const lastValue = useRef(committed);
  const valueAnimation = useRef<ReturnType<typeof animate> | null>(null);
  const homeAnimation = useRef<ReturnType<typeof animate> | null>(null);
  const drag = useRef<DragState | null>(null);
  const previousOffset = useRef(home.offset);
  const [dragging, setDragging] = useState(false);
  const [zone, setZone] = useState(() => ({ key: zoneKey(committed, cities, work), at: snap15(committed) }));
  const homeOffset = useMotionValue(home.offset);
  const handAngle = useTransform([turn, homeOffset] as MotionValue<number>[], ([latest, offset]: number[]) => (latest + offset - 720) / 4);

  useMotionEvent(turn, "change", (latest) => {
    const next = zoneKey(latest, cities, work);
    if (next !== zone.key) setZone((current) => (current.key === next ? current : { key: next, at: snap15(latest) }));
  });

  const sweepPath = useTransform([turn, settle] as MotionValue<number>[], ([latest, anchor]: number[]) => {
    const span = Math.max(-1436, Math.min(1436, latest - anchor)) / 4;
    if (Math.abs(span) < 0.5) return "M0 0";
    const from = (anchor + home.offset - 720) / 4;
    const [sx, sy] = polar(from, 106);
    const [ex, ey] = polar(from + span, 106);
    return `M${sx.toFixed(2)} ${sy.toFixed(2)} A106 106 0 ${+(Math.abs(span) > 180)} ${+(span > 0)} ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  });

  const sweepLabel = useTransform([turn, settle] as MotionValue<number>[], ([latest, anchor]: number[]) => {
    const delta = snap15(latest) - snap15(anchor);
    return delta === 0 ? "No change" : `${delta > 0 ? "+" : "−"}${formatSpan(Math.abs(delta))}`;
  });

  useEffect(() => {
    if (committed === lastValue.current) return;
    lastValue.current = committed;
    valueAnimation.current?.stop();
    if (reduced) turn.set(committed);
    else valueAnimation.current = animate(turn, committed, THROW_SPRING);
  }, [committed, reduced, turn]);

  useLayoutEffect(() => {
    const previous = previousOffset.current;
    previousOffset.current = home.offset;
    if (previous === home.offset) return;
    homeAnimation.current?.stop();
    if (reduced) {
      lag.set(0);
      homeOffset.set(home.offset);
      return;
    }
    lag.set(lag.get() + previous - home.offset);
    homeAnimation.current = animate(lag, 0, LAG_SPRING);
    const current = homeOffset.get();
    const shortest = wrap(home.offset - current + 720, 1440) - 720;
    animate(homeOffset, current + shortest, { ...MORPH_SPRING, onComplete: () => homeOffset.jump(home.offset) });
  }, [home.offset, lag, reduced, homeOffset]);

  const settleTo = (next: number, transition: Transition, velocity?: number) => {
    valueAnimation.current?.stop();
    valueAnimation.current = null;
    if (reduced) {
      turn.set(next);
      return;
    }
    valueAnimation.current = animate(turn, next, velocity === undefined ? transition : { ...transition, velocity });
  };

  const publish = (next: number) => {
    lastValue.current = next;
    if (!controlled) setInnerValue(next);
    if (next !== committed) onValueChange?.(next);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.id) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const current = turn.get();

    if (!state.moved) {
      if (event.type === "pointerup" && Math.hypot(event.clientX - state.cx, event.clientY - state.cy) > 0.55 * state.radius) {
        const next = bound(
          snap15(current + wrap(4 * angleAt(event.clientX, event.clientY, state) + 720 - (current + home.offset) + 720, 1440) - 720),
        );
        publish(next);
        settleTo(next, THROW_SPRING);
      } else if (snap15(current) !== current) {
        publish(bound(snap15(current)));
        settleTo(bound(snap15(current)), STEP_SPRING);
      }
      return;
    }

    setDragging(false);
    animate(highlight, 0, {
      duration: reduced ? 0.1 : 0.32,
      ease: standardEase,
      delay: 0.3 * (reduced ? 0 : 1),
    });

    const first = state.samples[0];
    const last = state.samples[state.samples.length - 1];
    const elapsed = last.t - first.t;
    const velocity =
      event.type === "pointerup" && elapsed > 8 && event.timeStamp - last.t < 80
        ? Math.max(-6000, Math.min(6000, ((last.v - first.v) / elapsed) * 1000))
        : 0;
    const outOfBounds = current > ceiling || current < floor;
    const flick = !outOfBounds && !reduced && Math.abs(velocity) > 120;
    const next = bound(snap15(current + (flick ? 0.24 * velocity : 0)));
    publish(next);
    settleTo(next, outOfBounds ? BOUND_SPRING : flick ? COAST_SPRING : STEP_SPRING, velocity);
  };

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    const box = event.currentTarget.getBoundingClientRect();
    const center = { cx: box.left + box.width / 2, cy: box.top + box.height / 2 };
    valueAnimation.current?.stop();
    const current = turn.get();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: event.pointerId,
      ...center,
      radius: box.width / 2,
      x: event.clientX,
      y: event.clientY,
      angle: angleAt(event.clientX, event.clientY, center),
      raw: current >= floor && current <= ceiling ? unsnap(current) : current,
      from: current,
      moved: false,
      samples: [{ t: event.timeStamp, v: current }],
    };
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.id) return;
    if (!state.moved) {
      if (Math.hypot(event.clientX - state.x, event.clientY - state.y) < 4) return;
      state.moved = true;
      settle.set(state.from);
      animate(highlight, 1, { duration: duration.fast, ease: enterEase });
      setDragging(true);
    }
    const angle = angleAt(event.clientX, event.clientY, state);
    if (Math.hypot(event.clientX - state.cx, event.clientY - state.cy) > 0.14 * state.radius) {
      state.raw += (wrap(angle - state.angle + 180, 360) - 180) * 4;
    }
    state.angle = angle;
    const raw = state.raw;
    turn.set(raw > ceiling ? ceiling + rubber(raw - ceiling) : raw < floor ? floor - rubber(floor - raw) : detent(raw));
    state.samples = [
      ...state.samples.filter((sample) => event.timeStamp - sample.t < 100),
      { t: event.timeStamp, v: state.raw },
    ];
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = {
      ArrowRight: 15,
      ArrowUp: 15,
      ArrowLeft: -15,
      ArrowDown: -15,
      PageUp: 60,
      PageDown: -60,
    };
    const dayStart = 1440 * dayOffset(lastValue.current + home.offset) - home.offset;
    const step = Object.hasOwn(steps, event.key) ? steps[event.key] : undefined;
    let next: number;
    if (step !== undefined) next = lastValue.current + step;
    else if (event.key === "Home") next = dayStart;
    else if (event.key === "End") next = dayStart + 1440 - 15;
    else return;
    event.preventDefault();
    next = bound(snap15(next));
    if (next === lastValue.current) return;
    publish(next);
    settleTo(next, event.key === "Home" || event.key === "End" ? THROW_SPRING : STEP_SPRING);
  };

  const others = cities.filter((city) => city.id !== home.id);
  const tracks = others.map((_, index) => 88 - index * (others.length > 1 ? Math.min(11, 24 / (others.length - 1)) : 0));
  const homeMinutes = committed + home.offset;
  const note = WEEKDAYS[wrap(weekday + dayOffset(zone.at + home.offset), 7)];
  const spoken = `${formatTime(homeMinutes, hourCycle)}, ${WEEKDAYS[wrap(weekday + dayOffset(homeMinutes), 7)]}, ${home.name}`;
  const announce = others
    .map((city) => {
      const shift = dayOffset(committed + city.offset) - dayOffset(homeMinutes);
      return `${city.name} ${formatTime(committed + city.offset, hourCycle)}${shift ? `, ${formatDays(shift)}` : ""}`;
    })
    .join(". ");

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")}>
      <div className={styles.layout}>
        <div
          className={styles.stage}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={1425}
          aria-valuenow={wrap(homeMinutes, 1440)}
          aria-valuetext={spoken}
          aria-describedby={`${baseId}-hint`}
          data-dragging={dragging || undefined}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onKeyDown={onKeyDown}
        >
          <Face tracks={tracks} cycle={hourCycle} work={work} />
          <svg className={styles.svg} viewBox="0 0 300 300" aria-hidden="true" focusable="false">
            <motion.path className={styles.sweep} d={sweepPath} style={{ opacity: highlight }} />
          </svg>
          <div className={styles.orbits} aria-hidden="true">
            <motion.div className={styles.arm} style={{ rotate: handAngle }}>
              <span className={styles.hand} />
            </motion.div>
            {cities.map((city) => (
              <CityArm
                key={city.id}
                city={city}
                turn={turn}
                home={city.id === home.id}
                track={city.id === home.id ? 106 : tracks[others.indexOf(city)]}
                daytime={isDaytime(zone.at + city.offset)}
                working={isWorking(zone.at + city.offset, work)}
                lifted={dragging}
                reduced={reduced}
              />
            ))}
          </div>
          <div className={styles.readout} aria-hidden="true">
            <SwapText className={styles.readoutCity} text={home.name} reduced={reduced} />
            <Clock className={styles.readoutTime} turn={turn} offset={home.offset} lag={lag} cycle={hourCycle} reduced={reduced} />
            <span className={[styles.swap, styles.readoutNote].join(" ")}>
              <AnimatePresence mode="popLayout" initial={false}>
                {dragging ? (
                  <motion.span
                    key="delta"
                    className={styles.swapItem}
                    variants={reduced ? fadeVariants : textVariants}
                    initial="hidden"
                    animate="shown"
                    exit="gone"
                  >
                    {sweepLabel as unknown as string}
                  </motion.span>
                ) : (
                  <motion.span
                    key={note}
                    className={styles.swapItem}
                    variants={reduced ? fadeVariants : textVariants}
                    initial="hidden"
                    animate="shown"
                    exit="gone"
                  >
                    {note}
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </div>
        </div>
        <ul className={styles.list} aria-label="Cities. Choose one to read the dial in its time.">
          {cities.map((city) => (
            <CityRow
              key={city.id}
              city={city}
              homeCity={home}
              turn={turn}
              at={zone.at}
              committed={committed}
              cycle={hourCycle}
              work={work}
              reduced={reduced}
              highlightId={`${baseId}-home`}
              onSelect={() => {
                if (city.id === home.id) return;
                if (homeId === undefined) setInnerHome(city.id);
                onHomeChange?.(city.id);
              }}
            />
          ))}
        </ul>
      </div>
      <span id={`${baseId}-hint`} className={styles.srOnly}>
        Drag around the dial or use the arrow keys to move in 15 minute steps. Page Up and Page Down move by an hour.
      </span>
      <p className={styles.srOnly} aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

export default TimeDial;
