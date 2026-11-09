"use client";

/**
 * PresenceStack — de-compiled from the Pro preview chunk captured at
 * `https://uiarc.dev/components/presence-stack/frame` (`captures/presence-stack/chunk.js`,
 * module 90755; styles in `captures/presence-stack/styles.css`).
 *
 * A face pile that expands on hover or keyboard focus: each avatar lifts 2px, a tooltip track
 * slides to the hovered slot and resizes to the measured label, and the whole row opens a
 * popover roster on click. The width maths are the shipped ones: avatars overlap by
 * `round(0.68 * size)`, the trigger reserves `max * step + size`, and an `end`-aligned stack
 * shifts its origin so the right edge stays put.
 */

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import type { MotionStyle, Transition } from "motion/react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./presence-stack.module.css";

/** What a person is doing right now. `typing` swaps the status dot for a three-dot bubble. */
export type PresenceStatus = "active" | "idle" | "typing";

/** Avatar diameter preset. `md` is the 36px stack used by the preview. */
export type PresenceSize = "sm" | "md" | "lg";

/** Which edge of the trigger the stack and the panel line up with. */
export type PresenceAlign = "start" | "end";

export interface PresencePerson {
  /** Stable identity: the enter/exit key, and what `selfId` is matched against. */
  id: string;
  /** Full name. The initials fallback comes from the first two words. */
  name: string;
  /** Portrait URL. When it fails to load, the initials stay visible. */
  src?: string;
  /** Defaults to `active`. */
  status?: PresenceStatus;
  /** What the person is doing, shown under their name in the roster and read out with the row. Falls back to the status label. */
  detail?: string;
}

export interface PresenceStackProps {
  /** Everyone in the room, in stack order. All of them appear in the roster; only the first `max` get an avatar. */
  people: PresencePerson[];
  /** Avatars shown before the `+N` overflow chip. Defaults to 4. */
  max?: number;
  /** Avatar diameter. Defaults to `md` (36px). */
  size?: PresenceSize;
  /** Which edge the stack grows from. `end` right-aligns the pile inside the reserved trigger width. Defaults to `start`. */
  align?: PresenceAlign;
  /** Whose row gets the muted " (you)" suffix, in the stack and the roster. */
  selfId?: string;
  /** The phrase the trigger's accessible name starts with, such as People here now. */
  label?: string;
  /** The roster's heading and its accessible name. Defaults to Here now. */
  heading?: string;
  /** Controlled popover state. Pair with `onOpenChange`. While open, hover expansion is suppressed. */
  open?: boolean;
  /** Opens the roster on mount when uncontrolled. */
  defaultOpen?: boolean;
  /** Called when the roster opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** Makes each roster row a button. Selecting one closes the roster. Omit for a read-only list. */
  onPersonSelect?: (person: PresencePerson) => void;
  /** Announces joins and leaves through a polite live region. Defaults to true. */
  announce?: boolean;
  /** Extra class on the root. */
  className?: string;
  /** Inline style on the root. `--size` is set here, so anything that reads it inside inherits the current diameter. */
  style?: CSSProperties;
}

/** Avatar diameters. The overlap is derived from these, so the pile keeps its rhythm at every size. */
const SIZES: Record<PresenceSize, number> = { sm: 28, md: 36, lg: 44 };

/** Spoken and displayed status words. */
const STATUS_LABEL: Record<PresenceStatus, string> = { active: "Active now", idle: "Idle", typing: "Typing" };

/** Neighbours overlap by a fixed share of the avatar, rounded so every offset lands on a whole pixel. */
const OVERLAP_RATIO = 0.68;

/** Grace period for crossing the gap between two avatars before the stack collapses. */
const LEAVE_DELAY = 90;

/** First two initials of a name, upper-cased. */
function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * The face pile plus its tooltip track and roster.
 *
 * @example
 * <PresenceStack people={people} selfId="jasmine-brooks" max={4} align="end" />
 */
export function PresenceStack({
  people,
  max = 4,
  size = "md",
  align = "start",
  selfId,
  label = "People here now",
  heading = "Here now",
  open,
  defaultOpen = false,
  onOpenChange,
  onPersonSelect,
  announce = true,
  className,
  style,
}: PresenceStackProps) {
  const reduceMotion = !!useReducedMotion();
  const sizePx = SIZES[size];
  // Avatars overlap by a share of the diameter, so each slot advances by `step` instead of `sizePx`.
  const step = Math.round(OVERLAP_RATIO * sizePx);
  const limit = Math.max(1, Math.floor(max));
  const visible = people.length > limit ? people.slice(0, limit) : people;
  const hidden = people.length - visible.length;
  // The overflow chip occupies a slot of its own, which is why the reserved width is the stack's.
  const slots = visible.length + (hidden > 0 ? 1 : 0);
  const width = limit * step + sizePx;

  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = open ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (open === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const [pointerInside, setPointerInside] = useState(false);
  const [keyboardInside, setKeyboardInside] = useState(false);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const leaveTimer = useRef<number | undefined>(undefined);

  // Hover and focus expansion both stop as soon as the roster opens: the panel takes over.
  const expanded = (pointerInside || keyboardInside) && !isOpen;
  const stackWidth = slots > 0 ? (slots - 1) * step + sizePx : 0;
  // An end-aligned pile grows to the left so its right edge stays on the trigger's right edge.
  const originX = align === "end" ? width - stackWidth : 0;

  const enterSlot = (index: number) => {
    window.clearTimeout(leaveTimer.current);
    setPointerInside(true);
    setHoveredSlot(index);
  };

  const leaveStack = () => {
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      setPointerInside(false);
      setHoveredSlot(null);
    }, LEAVE_DELAY);
  };

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  const activeSlot = hoveredSlot !== null && hoveredSlot < slots ? hoveredSlot : null;
  const hoveredPerson = activeSlot === null ? null : activeSlot < visible.length ? visible[activeSlot] : null;
  const labelName = hoveredPerson
    ? `${hoveredPerson.name}${hoveredPerson.id === selfId ? " (you)" : ""}`
    : activeSlot !== null
      ? `${hidden} more`
      : "";
  const labelSub = hoveredPerson ? STATUS_LABEL[hoveredPerson.status ?? "active"] : activeSlot !== null ? "Show everyone" : "";

  // The tooltip is a fixed-height pill whose width follows the content, so it is measured off-screen
  // and then animated, never re-laid out mid-transition.
  const measureRef = useRef<HTMLSpanElement>(null);
  const labelWidth = useMotionValue(0);
  const labelShown = expanded && activeSlot !== null;
  const wasShown = useRef(false);
  useLayoutEffect(() => {
    if (!measureRef.current) return;
    const next = measureRef.current.offsetWidth + 1;
    if (labelShown && wasShown.current && !reduceMotion) animate(labelWidth, next, motionTokens.spring.morph);
    else labelWidth.set(next);
    wasShown.current = labelShown;
  }, [labelName, labelSub, labelShown, reduceMotion, labelWidth]);

  const [count, setCount] = useState({ value: hidden, direction: 1 });
  if (count.value !== hidden) setCount({ value: hidden, direction: hidden < count.value ? -1 : 1 });

  const [announcement, setAnnouncement] = useState("");
  const previousPeople = useRef(people);
  useEffect(() => {
    if (!announce) return;
    const before = new Map(previousPeople.current.map((person) => [person.id, person]));
    const now = new Set(people.map((person) => person.id));
    const joined = people.filter((person) => !before.has(person.id)).map((person) => `${person.name} joined`);
    const left = previousPeople.current.filter((person) => !now.has(person.id)).map((person) => `${person.name} left`);
    previousPeople.current = people;
    const message = [...joined, ...left].join(". ");
    if (message) setAnnouncement(message);
  }, [people, announce]);

  const slide: Transition = reduceMotion ? { duration: 0 } : motionTokens.spring.smooth;
  const morph: Transition = reduceMotion ? { duration: 0 } : motionTokens.spring.morph;
  const settle: Transition = { duration: reduceMotion ? 0 : motionTokens.duration.fast, ease: [...motionTokens.ease.standard] };
  const triggerLabel = `${label}, ${people.length} ${people.length === 1 ? "person" : "people"}`;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    setHoveredSlot((current) =>
      current === null ? (direction > 0 ? 0 : slots - 1) : Math.min(slots - 1, Math.max(0, current + direction)),
    );
  };

  return (
    <div
      className={[styles.root, styles[size], className].filter(Boolean).join(" ")}
      style={{ ...style, "--size": `${sizePx}px` } as CSSProperties}
      data-align={align}
    >
      <PopoverPrimitive.Root open={isOpen} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            className={styles.trigger}
            style={{ width, height: sizePx }}
            aria-label={triggerLabel}
            onFocus={(event) => {
              if (event.currentTarget.matches(":focus-visible")) setKeyboardInside(true);
            }}
            onBlur={() => {
              setKeyboardInside(false);
              setHoveredSlot(null);
            }}
            onKeyDown={handleKeyDown}
          >
            <AnimatePresence initial={false}>
              {visible.map((person, index) => {
                const status = person.status ?? "active";
                return (
                  <motion.span
                    key={person.id}
                    className={[styles.avatar, status === "idle" ? styles.idle : ""].join(" ")}
                    style={{ zIndex: slots - index }}
                    initial={{ x: originX + index * step, opacity: 0, scale: 0.4 }}
                    animate={{
                      x: originX + index * step,
                      y: expanded && activeSlot === index ? -2 : 0,
                      opacity: 1,
                      scale: 1,
                    }}
                    exit={{ opacity: 0, scale: 0.4, transition: settle }}
                    transition={{ x: slide, y: slide, scale: morph, opacity: { duration: reduceMotion ? 0 : motionTokens.duration.fast } }}
                    onPointerEnter={() => enterSlot(index)}
                    onPointerLeave={leaveStack}
                  >
                    <Face person={person} size={sizePx} />
                    <StatusMark status={status} reduceMotion={reduceMotion} />
                  </motion.span>
                );
              })}
              {hidden > 0 ? (
                <motion.span
                  key="overflow"
                  className={styles.overflow}
                  style={{ zIndex: 0 }}
                  initial={{ x: originX + visible.length * step, opacity: 0, scale: 0.4 }}
                  animate={{
                    x: originX + visible.length * step,
                    y: expanded && activeSlot === visible.length ? -2 : 0,
                    opacity: 1,
                    scale: 1,
                  }}
                  exit={{ opacity: 0, scale: 0.4, transition: settle }}
                  transition={{ x: slide, y: slide, scale: morph }}
                  onPointerEnter={() => enterSlot(visible.length)}
                  onPointerLeave={leaveStack}
                >
                  {/* The chip is a full-diameter circle whose glyph sits centred, so the digit is nudged by half the overlap. */}
                  <motion.span className={styles.countShift} initial={false} animate={{ x: (sizePx - step) / 2 }} transition={slide}>
                    <AnimatePresence mode="popLayout" initial={false} custom={count.direction}>
                      <motion.span
                        key={hidden}
                        className={styles.count}
                        custom={count.direction}
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: `${0.55 * count.direction}em` }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: `${-0.55 * count.direction}em` }}
                        transition={reduceMotion ? { duration: 0 } : motionTokens.spring.snappy}
                      >
                        +{hidden}
                      </motion.span>
                    </AnimatePresence>
                  </motion.span>
                </motion.span>
              ) : null}
            </AnimatePresence>
            <span ref={measureRef} className={[styles.label, styles.measure].join(" ")} aria-hidden="true">
              <span className={styles.labelName}>{labelName}</span>
              <span className={styles.labelSub}>{labelSub}</span>
            </span>
            <AnimatePresence>
              {expanded && activeSlot !== null ? (
                <motion.span
                  key="label"
                  className={styles.labelTrack}
                  aria-hidden="true"
                  initial={{ x: originX + activeSlot * step + sizePx / 2, opacity: 0, y: -4, scale: 0.96 }}
                  animate={{ x: originX + activeSlot * step + sizePx / 2, opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96, transition: settle }}
                  transition={{ x: reduceMotion ? { duration: 0 } : motionTokens.spring.morph, default: reduceMotion ? { duration: 0 } : motionTokens.spring.snappy }}
                >
                  <motion.span className={styles.label} style={{ width: labelWidth } as MotionStyle}>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={labelName}
                        className={styles.labelInner}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : motionTokens.duration.fast }}
                      >
                        <span className={styles.labelName}>{labelName}</span>
                        <span className={styles.labelSub}>
                          {hoveredPerson?.status === "typing" ? <TypingDots className={styles.labelDots} /> : null}
                          {labelSub}
                        </span>
                      </motion.span>
                    </AnimatePresence>
                  </motion.span>
                </motion.span>
              ) : null}
            </AnimatePresence>
          </button>
        </PopoverPrimitive.Trigger>
        <AnimatePresence>
          {isOpen ? (
            <PopoverPrimitive.Portal forceMount>
              <PopoverPrimitive.Content
                forceMount
                asChild
                align={align}
                sideOffset={10}
                collisionPadding={12}
                aria-label={heading}
              >
                <motion.div
                  className={styles.panel}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={
                    reduceMotion
                      ? { opacity: 0, transition: { duration: 0 } }
                      : { opacity: 0, y: -4, scale: 0.98, transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } }
                  }
                  transition={reduceMotion ? { duration: 0 } : motionTokens.spring.snappy}
                >
                  <div className={styles.panelHead}>
                    <span className={styles.panelTitle}>{heading}</span>
                    <PanelCount value={people.length} reduceMotion={reduceMotion} />
                  </div>
                  <ul className={styles.list}>
                    <AnimatePresence initial={false}>
                      {people.map((person) => {
                        const status = person.status ?? "active";
                        const isSelf = person.id === selfId;
                        const body = (
                          <>
                            <span className={[styles.rowAvatar, status === "idle" ? styles.idle : ""].join(" ")}>
                              <Face person={person} size={28} />
                              <StatusMark status={status} reduceMotion={reduceMotion} />
                            </span>
                            <span className={styles.rowText}>
                              <span className={styles.rowName}>
                                {person.name}
                                {isSelf ? <span className={styles.you}> (you)</span> : null}
                              </span>
                              <span className={styles.rowDetail}>
                                <AnimatePresence mode="popLayout" initial={false}>
                                  <motion.span
                                    key={`${status}-${person.detail ?? ""}`}
                                    className={styles.rowDetailText}
                                    initial={{ opacity: 0, y: 4 * +!reduceMotion }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
                                    transition={reduceMotion ? { duration: 0 } : motionTokens.spring.snappy}
                                  >
                                    {status === "typing" ? <TypingDots className={styles.rowDots} /> : null}
                                    {person.detail ?? STATUS_LABEL[status]}
                                  </motion.span>
                                </AnimatePresence>
                              </span>
                            </span>
                          </>
                        );
                        return (
                          <motion.li
                            key={person.id}
                            className={styles.rowWrap}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={reduceMotion ? { duration: 0 } : motionTokens.spring.smooth}
                          >
                            {onPersonSelect ? (
                              <button
                                type="button"
                                className={[styles.row, styles.rowButton].join(" ")}
                                onClick={() => {
                                  onPersonSelect(person);
                                  setOpen(false);
                                }}
                                aria-label={`${person.name}${isSelf ? " (you)" : ""}, ${person.detail ?? STATUS_LABEL[status]}`}
                              >
                                {body}
                              </button>
                            ) : (
                              <div className={styles.row}>{body}</div>
                            )}
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                  {people.length === 0 ? <p className={styles.empty}>No one else is here right now</p> : null}
                </motion.div>
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          ) : null}
        </AnimatePresence>
      </PopoverPrimitive.Root>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

/** Round portrait with an initials fallback that returns if the image errors. */
function Face({ person, size }: { person: PresencePerson; size: number }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const showPhoto = person.src ? failedSrc !== person.src : false;
  return (
    <span className={styles.face}>
      <span className={styles.initials} aria-hidden="true">
        {initialsOf(person.name)}
      </span>
      {showPhoto ? (
        <img
          src={person.src}
          alt=""
          sizes={`${size}px`}
          className={styles.photo}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailedSrc(person.src)}
          style={{ position: "absolute", height: "100%", width: "100%", left: 0, top: 0, right: 0, bottom: 0, color: "transparent" }}
        />
      ) : null}
    </span>
  );
}

/** Three dots used in the typing bubble, the tooltip and the roster row. */
function TypingDots({ className }: { className?: string }) {
  return (
    <span className={[styles.dots, className].filter(Boolean).join(" ")} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

/** The badge in the avatar's bottom-right corner: a status dot, or the typing bubble. */
function StatusMark({ status, reduceMotion }: { status: PresenceStatus; reduceMotion: boolean }) {
  const transition: Transition = reduceMotion ? { duration: 0 } : motionTokens.spring.snappy;
  return (
    <span className={styles.mark} aria-hidden="true">
      <AnimatePresence initial={false} mode="popLayout">
        {status === "typing" ? (
          <motion.span
            key="typing"
            className={styles.typingMark}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={transition}
          >
            <TypingDots />
          </motion.span>
        ) : (
          <motion.span
            key="dot"
            className={[styles.dot, status === "idle" ? styles.dotIdle : ""].join(" ")}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={transition}
          />
        )}
      </AnimatePresence>
    </span>
  );
}

/** The roster's head count, rolling in the direction the number moved. */
function PanelCount({ value, reduceMotion }: { value: number; reduceMotion: boolean }) {
  const [seen, setSeen] = useState({ value, direction: 1 });
  if (seen.value !== value) setSeen({ value, direction: value < seen.value ? -1 : 1 });
  const id = useId();
  return (
    <span className={styles.panelCount} aria-label={`${value} ${value === 1 ? "person" : "people"}`} id={id}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          aria-hidden="true"
          initial={{ opacity: 0, y: reduceMotion ? 0 : `${0.6 * seen.direction}em` }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : `${-0.6 * seen.direction}em` }}
          transition={reduceMotion ? { duration: 0 } : motionTokens.spring.snappy}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export default PresenceStack;
