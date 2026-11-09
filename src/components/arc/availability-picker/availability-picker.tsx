"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { TargetAndTransition, Transition, Variants } from "motion/react";
import { Check } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./availability-picker.module.css";

interface Attendee {
  name: string;
  first: string;
  src: string;
}

interface AvailabilitySlot {
  time: string;
  /** First name of the attendee who is busy at this time. */
  busy?: string;
}

interface AvailabilityDay {
  id: string;
  short: string;
  date: string;
  full: string;
  slots: AvailabilitySlot[];
}

const attendees: Attendee[] = [
  {
    name: "Emma Collins",
    first: "Emma",
    src: "/media/people/emma-collins.svg",
  },
  {
    name: "Marcus Johnson",
    first: "Marcus",
    src: "/media/people/marcus-johnson.svg",
  },
  { name: "Ava Mitchell", first: "Ava", src: "/media/people/ava-mitchell.svg" },
];

const days: AvailabilityDay[] = [
  {
    id: "mon",
    short: "Mon",
    date: "21",
    full: "Monday, 21 September",
    slots: [
      { time: "09:30" },
      { time: "10:30" },
      { time: "14:00", busy: "Marcus" },
      { time: "16:00" },
    ],
  },
  {
    id: "tue",
    short: "Tue",
    date: "22",
    full: "Tuesday, 22 September",
    slots: [
      { time: "09:00", busy: "Ava" },
      { time: "11:00" },
      { time: "13:30" },
      { time: "15:00", busy: "Emma" },
    ],
  },
  {
    id: "wed",
    short: "Wed",
    date: "23",
    full: "Wednesday, 23 September",
    slots: [
      { time: "09:30" },
      { time: "10:30", busy: "Marcus" },
      { time: "14:30" },
      { time: "16:30" },
    ],
  },
  {
    id: "thu",
    short: "Thu",
    date: "24",
    full: "Thursday, 24 September",
    slots: [
      { time: "08:30", busy: "Emma" },
      { time: "10:00" },
      { time: "13:00" },
      { time: "15:30", busy: "Ava" },
    ],
  },
  {
    id: "fri",
    short: "Fri",
    date: "25",
    full: "Friday, 25 September",
    slots: [
      { time: "09:30" },
      { time: "11:30" },
      { time: "14:00", busy: "Marcus" },
      { time: "15:30" },
    ],
  },
];

/** Every slot is half an hour long, so the end time is the start plus the meeting length. */
function endTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** The outgoing list leaves towards the day you came from, the incoming one arrives from the day you picked. */
const slideVariants: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: 16 * direction }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({
    opacity: 0,
    x: -16 * direction,
    transition: {
      duration: motionTokens.duration.fast,
      ease: [...motionTokens.ease.standard],
    },
  }),
};

const fadeVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0 } },
};

interface SwapMotion {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
}

export interface AvailabilitySelection {
  /** Full display label of the chosen day, e.g. `Monday, 21 September`. */
  date: string;
  /** Start time of the chosen slot, e.g. `10:30`. */
  time: string;
}

export interface AvailabilityPickerProps {
  /** Called with the chosen day label and time when confirmed. */
  onConfirm?: (selection: AvailabilitySelection) => void;
  /** Frame shell only: the live preview frame renders the block flat — no card border, radius, shadow, or footer fill. */
  flat?: boolean;
}

/** Flat frame shell: the preview frame paints the block with no card chrome of its own. */
const flatStyle = {
  border: 0,
  borderRadius: 0,
  boxShadow: "none",
  background: "transparent",
} as const;

/**
 * A day strip and time slot list for a group meeting, with attendee avatars and a confirmation step.
 * Days, slots, and attendees are sample data; `onConfirm` receives display strings.
 */
export function AvailabilityPicker({
  onConfirm,
  flat = false,
}: AvailabilityPickerProps) {
  const reduceMotion = !!useReducedMotion();
  const uid = useId();
  const [dayId, setDayId] = useState(days[0].id);
  const [direction, setDirection] = useState(1);
  const [time, setTime] = useState("10:30");
  const [confirmed, setConfirmed] = useState(false);

  const day = days.find((item) => item.id === dayId) ?? days[0];
  const slot = day.slots.find((item) => item.time === time) ?? day.slots[0];
  const selection = `${day.full}, ${slot.time} to ${endTime(slot.time, 30)}`;
  const note = confirmed
    ? "Invites sent"
    : slot.busy
      ? `${slot.busy} will be asked to move a conflict`
      : "Everyone is free";

  // Reduced motion keeps the crossfades but drops the 4px travel and the blur.
  const swapMotion: SwapMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: {
          opacity: 0,
          y: 4,
          filter: `blur(${motionTokens.blur.subtle}px)`,
        },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        exit: {
          opacity: 0,
          y: -4,
          filter: `blur(${motionTokens.blur.subtle}px)`,
        },
      };
  const swapTransition: Transition = {
    duration: reduceMotion
      ? motionTokens.duration.instant
      : motionTokens.duration.fast,
    ease: [...motionTokens.ease.standard],
  };
  const listTransition: Transition = reduceMotion
    ? { duration: motionTokens.duration.instant }
    : {
        x: motionTokens.spring.smooth,
        opacity: { duration: motionTokens.duration.fast },
      };

  return (
    <section className={styles.root} aria-labelledby={`${uid}-title`}>
      <div
        className={styles.picker}
        data-frame-flat={flat ? "" : undefined}
        style={flat ? flatStyle : undefined}
      >
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <h2 id={`${uid}-title`}>Product review</h2>
            <p>30 minutes · Zürich time</p>
          </div>
          <div
            className={styles.attendees}
            aria-label="Attendees: Emma Collins, Marcus Johnson and Ava Mitchell"
          >
            {attendees.map((person) => (
              <Avatar
                key={person.name}
                name={person.name}
                src={person.src}
                size="sm"
              />
            ))}
          </div>
        </header>

        <div
          className={styles.days}
          role="group"
          aria-label="Week of 21 September"
        >
          {days.map((item, index) => {
            const selected = dayId === item.id;
            const open = item.slots.filter((entry) => !entry.busy).length;
            return (
              <button
                key={item.id}
                type="button"
                className={styles.day}
                data-selected={selected || undefined}
                aria-pressed={selected}
                aria-label={`${item.full}, ${open} times everyone is free`}
                onClick={() => {
                  if (item.id === dayId) return;
                  setDirection(
                    index > days.findIndex((entry) => entry.id === dayId)
                      ? 1
                      : -1,
                  );
                  setDayId(item.id);
                  setTime(
                    (item.slots.find((entry) => !entry.busy) ?? item.slots[0])
                      .time,
                  );
                  setConfirmed(false);
                }}
              >
                {selected && (
                  <motion.span
                    layoutId={`${uid}-day`}
                    className={styles.dayHighlight}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : motionTokens.spring.snappy
                    }
                  />
                )}
                <span className={styles.dayName}>{item.short}</span>
                <span className={styles.dayDate}>{item.date}</span>
                <span className={styles.dayOpen}>{open} open</span>
              </button>
            );
          })}
        </div>

        <div
          className={styles.slotsHead}
          data-frame-flat={flat ? "" : undefined}
          style={flat ? flatStyle : undefined}
        >
          <h3 className={styles.slotsTitle}>
            <span className={styles.swap}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={day.id}
                  {...swapMotion}
                  transition={swapTransition}
                >
                  {day.full}
                </motion.span>
              </AnimatePresence>
            </span>
          </h3>
          <span className={styles.legend}>
            <i className={styles.markFree} aria-hidden="true" />
            Free
            <i className={styles.markBusy} aria-hidden="true" />
            Busy
          </span>
        </div>

        <div className={styles.slotsStage}>
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.ul
              key={day.id}
              className={styles.slots}
              aria-label={`Times on ${day.full}`}
              custom={direction}
              variants={reduceMotion ? fadeVariants : slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={listTransition}
            >
              {day.slots.map((entry) => {
                const selected = slot.time === entry.time;
                const meta = entry.busy
                  ? `${entry.busy} is busy`
                  : "Everyone is free";
                return (
                  <li key={entry.time}>
                    <button
                      type="button"
                      className={styles.slot}
                      data-selected={selected || undefined}
                      data-busy={entry.busy ? "" : undefined}
                      aria-pressed={selected}
                      aria-label={`${entry.time} to ${endTime(entry.time, 30)}, ${meta}`}
                      onClick={() => {
                        setTime(entry.time);
                        setConfirmed(false);
                      }}
                    >
                      <span className={styles.slotTime}>{entry.time}</span>
                      <span className={styles.slotMeta}>{meta}</span>
                      <span className={styles.marks} aria-hidden="true">
                        {attendees.map((person) => (
                          <i
                            key={person.name}
                            className={
                              entry.busy === person.first
                                ? styles.markBusy
                                : styles.markFree
                            }
                          />
                        ))}
                      </span>
                      <span className={styles.slotCheck} aria-hidden="true">
                        <Check size={14} strokeWidth={2} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </motion.ul>
          </AnimatePresence>
        </div>

        <footer
          className={styles.footer}
          data-frame-flat={flat ? "" : undefined}
          style={flat ? flatStyle : undefined}
        >
          <div className={styles.selection}>
            <span className={styles.swap}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={note}
                  className={styles.selectionLabel}
                  {...swapMotion}
                  transition={swapTransition}
                >
                  {note}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className={styles.swap}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.strong
                  key={selection}
                  className={styles.selectionValue}
                  {...swapMotion}
                  transition={swapTransition}
                >
                  {selection}
                </motion.strong>
              </AnimatePresence>
            </span>
          </div>
          <Button
            variant={confirmed ? "secondary" : "primary"}
            onClick={
              confirmed
                ? undefined
                : () => {
                    setConfirmed(true);
                    onConfirm?.({ date: day.full, time: slot.time });
                  }
            }
            aria-disabled={confirmed || undefined}
            className={styles.confirmButton}
          >
            <span className={styles.swap}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={confirmed ? "done" : "idle"}
                  className={styles.buttonLabel}
                  {...swapMotion}
                  transition={swapTransition}
                >
                  {confirmed ? (
                    <>
                      <Check size={16} aria-hidden="true" />
                      Confirmed
                    </>
                  ) : (
                    "Confirm time"
                  )}
                </motion.span>
              </AnimatePresence>
            </span>
          </Button>
          <p className={styles.srOnly} aria-live="polite">
            {confirmed ? `Confirmed ${selection}.` : ""}
          </p>
        </footer>
      </div>
    </section>
  );
}

export default AvailabilityPicker;
