"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  useVelocity,
} from "motion/react";
import type { Transition } from "motion/react";
import { MapPin, MessageCircle, Phone, PhoneOff, RotateCcw, X } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import Button from "../button/button";
import TextMorph from "../text-morph/text-morph";
import { motionTokens } from "../lib/motion-tokens";
import { avatar, photo } from "../lib/media";
import styles from "./delivery-tracker.module.css";

const { duration, spring, blur } = motionTokens;
const enterEase = [...motionTokens.ease.enter] as [number, number, number, number];
const standardEase = [...motionTokens.ease.standard] as [number, number, number, number];
const blurred = `blur(${blur.soft}px)`;
/** The marker and panel morphs glide a little slower than the shared spring, so the route keeps up with the clock. */
const glide: Transition = { ...spring.morph, visualDuration: 0.72 };

/** One simulated dispatch feed: every step carries the stage it belongs to and the route percentage it reaches. */
interface Step {
  id: string;
  stage: number;
  progress: number;
  now: string;
  eta: string;
  status: string;
  detail: string;
  title: string;
  note: string;
  photo?: boolean;
}

const steps: Step[] = [
  { id: "confirmed", stage: 0, progress: 0, now: "08:12", eta: "14:45", status: "Order confirmed", detail: "Halden Studio is preparing your order", title: "Order confirmed", note: "Halden Studio accepted your order" },
  { id: "packed", stage: 1, progress: .25, now: "11:40", eta: "14:45", status: "Packed", detail: "Waiting for pickup in Altstetten", title: "Packed", note: "Two items wrapped and labeled" },
  { id: "out", stage: 2, progress: .5, now: "13:58", eta: "14:44", status: "Out for delivery", detail: "Marcus is 6 stops away", title: "Out for delivery", note: "Marcus Keller loaded your order" },
  { id: "four", stage: 2, progress: .57, now: "14:09", eta: "14:41", status: "Out for delivery", detail: "Marcus is 4 stops away", title: "4 stops away", note: "Running 3 minutes ahead" },
  { id: "traffic", stage: 2, progress: .65, now: "14:20", eta: "14:43", status: "Out for delivery", detail: "Marcus is 2 stops away", title: "2 stops away", note: "Slow traffic on Bellerivestrasse" },
  { id: "arriving", stage: 3, progress: .75, now: "14:29", eta: "14:36", status: "Arriving", detail: "Marcus is on your street", title: "Arriving", note: "You are the next stop" },
  { id: "outside", stage: 3, progress: .88, now: "14:34", eta: "14:36", status: "Arriving", detail: "Marcus is outside your building", title: "Courier is outside", note: "Parked at Seefeldstrasse 118" },
  { id: "delivered", stage: 4, progress: 1, now: "14:38", eta: "14:38", status: "Delivered", detail: "Placed in your living room", title: "Delivered", note: "Placed in the living room and signed for", photo: true },
];

const labels = ["Ordered", "Packed", "Out for delivery", "Arriving", "Delivered"];
const stops = [0, .25, .5, .75, 1];
const replies = ["Please use the side entrance", "I'm on my way down", "Call me from the door"];
const responses = ["Noted, side entrance it is", "Great, see you in a minute", "Will do, calling when I'm there"];
const digits = Array.from("0123456789");
const loungeChair = photo("lounge-chair");
const glassCarafe = photo("glass-carafe");
const marcus = avatar("marcus-johnson");

const toMinutes = (clock: string) => {
  const [hours, minutes] = clock.split(":").map(Number);
  return hours * 60 + minutes;
};
const toClock = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
/** How many stops the route has filled at a given progress; the small tolerance stops a rounding wobble from un-filling a stop. */
const reachedCount = (progress: number) => stops.filter(stop => progress >= stop - .005).length;

/**
 * A delivery tracker: a route bar whose marker glides between stops while the arrival time rolls, an event
 * history that gains entries, and a courier row that unfolds into quick replies and a call. The dispatch feed,
 * courier, and order are simulated; swap `steps` for carrier or webhook updates.
 */
export interface DeliveryTrackerProps {
  /** Extra class on the root element. */
  className?: string;
  /** Renders without the block's own surface. The preview frame flattens the card. */
  flat?: boolean;
}

/** Swaps one short line for the next: the incoming line rises and sharpens, the outgoing one lifts and blurs away. */
function Swap({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={id}
        className={className ?? styles.swap}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8, filter: blurred }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -6, filter: blurred, transition: { duration: duration.exit, ease: standardEase } }}
        transition={reduced ? { duration: duration.instant } : { duration: .34, ease: enterEase, delay: .06 }}>
        {children}
      </motion.span>
    </AnimatePresence>
  );
}

/** A clock whose digits roll to their new value, one column per character. Screen readers get the plain value from the surrounding text. */
function RollingClock({ value, className }: { value: string; className?: string }) {
  const reduced = useReducedMotion();
  const characters = Array.from(value);
  return (
    <span className={[styles.rolling, className].filter(Boolean).join(" ")} aria-hidden="true">
      <AnimatePresence mode="popLayout" initial={false}>
        {characters.map((character, index) => {
          const place = characters.length - index;
          return /\d/.test(character) ? (
            <motion.span
              key={`d${place}`}
              className={styles.digit}
              initial={reduced ? { opacity: 0 } : { opacity: 0, filter: blurred }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, transition: { duration: .12 } }}
              transition={{ duration: .2 }}>
              <motion.span
                className={styles.strip}
                initial={false}
                animate={{ y: `${-10 * Number(character)}%` }}
                transition={reduced ? { duration: 0 } : { ...spring.smooth, delay: (place - 1) * .045 }}>
                {digits.map(digit => <span key={digit}>{digit}</span>)}
              </motion.span>
            </motion.span>
          ) : (
            <motion.span
              key={`s${place}${character}`}
              className={styles.glyph}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: .1 } }}>
              {character}
            </motion.span>
          );
        })}
      </AnimatePresence>
    </span>
  );
}

function CheckMark() {
  return (
    <svg className={styles.check} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 8.4 6.7 11 12 5.4" />
    </svg>
  );
}

/** Measures the contact panel so its clip can animate to the natural height instead of a guessed max-height. */
function useMeasuredHeight() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | string>("auto");
  const ref = useCallback((node: HTMLDivElement | null) => {
    setElement(node);
    if (!node) setHeight("auto");
  }, []);
  useEffect(() => {
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [ref, height] as const;
}

export function DeliveryTracker({ className, flat = false }: DeliveryTrackerProps) {
  const id = useId();
  const reduced = useReducedMotion();
  /** The flatten the preview frame applies: the card surface and the two section dividers lose their border. */
  const flattened = flat ? { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" } : undefined;
  const [index, setIndex] = useState(1);
  const [pingKey, setPingKey] = useState(0);
  const [contactOpen, setContactOpen] = useState(false);
  const [reply, setReply] = useState<number | null>(null);
  const [responseShown, setResponseShown] = useState(false);
  const [callOn, setCallOn] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const replyTimer = useRef<number | undefined>(undefined);
  const pendingFocus = useRef<(() => void) | null>(null);
  const primaryButton = useRef<HTMLButtonElement>(null);
  const contactButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const firstReply = useRef<HTMLButtonElement>(null);
  const [measure, panelHeight] = useMeasuredHeight();

  const step = steps[index];
  const done = step.stage === 4;
  const last = index === steps.length - 1;
  const remaining = toMinutes(step.eta) - toMinutes(step.now);
  const events = steps.slice(0, index + 1).reverse();
  const noteMode = done ? "done" : step.stage < 2 ? "window" : "live";

  const progress = useMotionValue(steps[1].progress);
  const velocity = useVelocity(progress);
  const clamped = useTransform(progress, value => Math.min(1, Math.max(0, value)));
  const percentage = useTransform(clamped, value => `${100 * value}%`);
  const bulge = useTransform(velocity, value => Math.min(26 * Math.abs(value), 22));
  const markerWidth = useTransform(bulge, value => 16 + value);
  const markerX = useTransform(() => (velocity.get() < 0 ? -8 : -8 - bulge.get()));
  const [reached, setReached] = useState(() => reachedCount(steps[1].progress));

  /** Closes the contact panel and ends any call, without touching the timeline index. */
  function resetContact() {
    window.clearTimeout(replyTimer.current);
    setContactOpen(false);
    setReply(null);
    setResponseShown(false);
    setCallOn(false);
    setElapsed(0);
  }

  useMotionValueEvent(progress, "change", value => {
    const next = reachedCount(value);
    setReached(current => (current === next ? current : next));
  });

  useEffect(() => {
    if (reduced) {
      progress.jump(step.progress);
      return;
    }
    const controls = animate(progress, step.progress, glide);
    return () => controls.stop();
  }, [progress, step.progress, reduced]);

  useEffect(() => {
    if (!callOn) return;
    const timer = window.setInterval(() => setElapsed(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [callOn]);

  useEffect(() => () => window.clearTimeout(replyTimer.current), []);

  useEffect(() => {
    const focus = pendingFocus.current;
    pendingFocus.current = null;
    focus?.();
  });

  const announcement = done ? `Delivered at ${step.now}. ${step.detail}.` : `${step.status}. ${step.detail}. Estimated arrival ${step.eta}.`;
  const summary = done
    ? `Delivered at ${step.now}`
    : noteMode === "window"
      ? `Estimated arrival ${step.eta}, delivery window 14:00 to 15:00`
      : `Estimated arrival ${step.eta}, in ${remaining} minutes`;

  return (
    <section
      className={[styles.tracker, className].filter(Boolean).join(" ")}
      aria-label="Delivery tracker"
      data-done={done || undefined}
      data-frame-flat={flat ? "" : undefined}
      style={flattened}>
      <div className={styles.hero}>
        <div className={styles.headline}>
          <h2 className={styles.status}><Swap id={step.status}>{step.status}</Swap></h2>
          <p className={styles.detail}><Swap id={step.detail}>{step.detail}</Swap></p>
        </div>
        <div className={styles.eta}>
          <span className={styles.srOnly}>{summary}</span>
          <RollingClock value={done ? step.now : step.eta} className={styles.clock} />
          <p className={styles.etaNote} aria-hidden="true">
            <Swap id={noteMode} className={styles.etaSwap}>
              {noteMode === "done" ? <><CheckMark />Delivered</> : noteMode === "window" ? "Delivery window 14:00–15:00" : <>Estimated arrival, in <RollingClock value={String(remaining)} /><motion.span layout="position" transition={spring.morph}>min</motion.span></>}
            </Swap>
          </p>
        </div>
      </div>

      <div className={styles.track}>
        <div className={styles.rail} aria-hidden="true">
          <motion.span className={styles.fill} style={{ scaleX: clamped }} />
        </div>
        <ol className={styles.stops} aria-label="Delivery progress">
          {labels.map((label, stop) => (
            <li
              key={label}
              className={styles.stop}
              style={{ left: `${100 * stops[stop]}%` }}
              data-reached={stop < reached || undefined}
              data-current={stop === step.stage || undefined}
              aria-current={stop === step.stage ? "step" : undefined}>
              <motion.span
                className={styles.dot}
                aria-hidden="true"
                initial={false}
                animate={{ scale: stop < reached ? [1, 1.7, 1] : 1 }}
                transition={reduced ? { duration: 0 } : { duration: .42, ease: standardEase }} />
              <span className={styles.stopLabel}>
                {label}
                <span className={styles.srOnly}>{stop < step.stage ? ", complete" : stop === step.stage ? ", current" : ""}</span>
              </span>
            </li>
          ))}
        </ol>
        <motion.div className={styles.markerLayer} style={{ x: percentage }} aria-hidden="true">
          {pingKey > 0 && !done && !reduced && (
            <motion.span
              key={pingKey}
              className={styles.ping}
              initial={{ scale: 1, opacity: .5 }}
              animate={{ scale: 2.8, opacity: 0 }}
              transition={{ duration: .9, ease: enterEase, delay: .38 }} />
          )}
          <AnimatePresence initial={false}>
            {done ? (
              <motion.span
                key="done"
                className={styles.doneBadge}
                initial={{ scale: 16 / 26, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0, scale: .6, transition: { duration: duration.fast } }}
                transition={reduced ? { duration: 0 } : { ...spring.morph, delay: .42, opacity: { duration: .12, delay: .42 } }}>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <motion.path
                    d="M4 8.4 6.7 11 12 5.4"
                    initial={{ pathLength: +!!reduced }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: .3, ease: enterEase, delay: .6 }} />
                </svg>
              </motion.span>
            ) : (
              <motion.span
                key="marker"
                className={styles.marker}
                style={{ width: markerWidth, x: markerX }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: .1, delay: .42 * +!reduced } }} />
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <div
        className={styles.lower}
        data-frame-flat={flat ? "" : undefined}
        style={flattened}>
        <section className={styles.updates} aria-labelledby={`${id}-updates`}>
          <h3 id={`${id}-updates`} className={styles.sectionTitle}>Updates</h3>
          <ul className={styles.events}>
            <AnimatePresence initial={false}>
              {events.map((event, position) => (
                <motion.li
                  key={event.id}
                  className={styles.event}
                  data-latest={position === 0 || undefined}
                  data-done={event.stage === 4 || undefined}
                  initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0, transition: { height: { duration: duration.exit, ease: standardEase }, opacity: { duration: duration.instant } } }}
                  transition={reduced ? { duration: duration.instant } : { height: spring.smooth, opacity: { duration: .2, delay: .05 } }}>
                  <motion.div
                    className={styles.eventInner}
                    initial={!reduced && { y: -6, filter: blurred }}
                    animate={{ y: 0, filter: "blur(0px)" }}
                    transition={{ duration: .4, ease: enterEase, delay: .08 }}>
                    <time className={styles.time}>{event.now}</time>
                    <span className={styles.node} aria-hidden="true" />
                    <div className={styles.eventText}>
                      <strong>{event.title}</strong>
                      <span>{event.note}</span>
                      {event.photo && (
                        <motion.figure
                          className={styles.proof}
                          initial={!reduced && { opacity: 0, scale: .96, filter: blurred }}
                          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                          transition={{ duration: .5, ease: enterEase, delay: .3 }}>
                          <img
                            src={loungeChair.src}
                            alt="Delivery photo: the oak lounge chair placed in the living room"
                            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
                        </motion.figure>
                      )}
                    </div>
                  </motion.div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>

        <AnimatePresence initial={false}>
          {step.stage >= 2 && (
            <motion.section
              className={styles.courierArea}
              aria-label="Courier"
              initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0, transition: { duration: duration.exit, ease: standardEase } }}
              transition={reduced ? { duration: duration.instant } : { height: spring.smooth, opacity: { duration: .24, delay: .1 } }}>
              <motion.div
                className={styles.courierClip}
                initial={false}
                animate={{ height: panelHeight }}
                transition={reduced ? { duration: 0 } : spring.smooth}>
                <div ref={measure} className={styles.courierMeasure}>
                  <div className={styles.courierInner}>
                    <div className={styles.courierRow}>
                      <Avatar name="Marcus Keller" src={marcus} size="lg" />
                      <div className={styles.courierText}>
                        <strong>Marcus Keller</strong>
                        <span className={styles.courierMeta}>
                          <Swap id={done ? "done" : "van"}>{done ? `Delivered your order at ${step.now}` : "Electric van, ZH 482 113"}</Swap>
                        </span>
                      </div>
                      {!contactOpen && !done && (
                        <motion.button
                          ref={contactButton}
                          type="button"
                          layoutId={`${id}-contact`}
                          className={styles.contactButton}
                          style={{ borderRadius: 18 }}
                          onClick={() => {
                            setContactOpen(true);
                            pendingFocus.current = () => firstReply.current?.focus({ preventScroll: true });
                          }}
                          aria-expanded={false}
                          transition={reduced ? { duration: 0 } : spring.morph}>
                          <motion.span
                            layout="position"
                            className={styles.contactLabel}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ opacity: { duration: .2, delay: .16 * +!reduced }, layout: reduced ? { duration: 0 } : spring.morph }}>
                            <MessageCircle size={16} strokeWidth={1.75} aria-hidden="true" />
                            Contact
                          </motion.span>
                        </motion.button>
                      )}
                    </div>
                    {contactOpen && (
                      <motion.div
                        layoutId={`${id}-contact`}
                        className={styles.contactPanel}
                        style={{ borderRadius: 20 }}
                        transition={reduced ? { duration: 0 } : spring.morph}
                        role="group"
                        aria-label="Contact Marcus">
                        <motion.div
                          layout
                          className={styles.panelBody}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ opacity: { duration: .22, delay: .14 * +!reduced }, layout: spring.morph }}>
                          <div className={styles.panelHead}>
                            <span className={styles.panelTitle}>Message Marcus</span>
                            <button
                              ref={closeButton}
                              type="button"
                              className={styles.iconButton}
                              aria-label="Close contact options"
                              onClick={() => {
                                resetContact();
                                pendingFocus.current = () => contactButton.current?.focus({ preventScroll: true });
                              }}>
                              <X size={16} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                          </div>
                          {reply === null ? (
                            <div className={styles.replies} role="group" aria-label="Quick replies">
                              {replies.map((text, position) => (
                                <motion.button
                                  key={text}
                                  ref={position === 0 ? firstReply : undefined}
                                  type="button"
                                  layoutId={`${id}-reply-${position}`}
                                  className={styles.reply}
                                  style={{ borderRadius: 16 }}
                                  onClick={() => {
                                    setReply(position);
                                    setResponseShown(false);
                                    window.clearTimeout(replyTimer.current);
                                    replyTimer.current = window.setTimeout(() => setResponseShown(true), reduced ? 500 : 1500);
                                    pendingFocus.current = () => closeButton.current?.focus({ preventScroll: true });
                                  }}
                                  transition={reduced ? { duration: 0 } : spring.morph}>
                                  {text}
                                </motion.button>
                              ))}
                            </div>
                          ) : (
                            <div className={styles.thread}>
                              <motion.p
                                layoutId={`${id}-reply-${reply}`}
                                className={styles.bubbleOut}
                                style={{ borderRadius: 16 }}
                                transition={reduced ? { duration: 0 } : spring.morph}>
                                {replies[reply]}
                              </motion.p>
                              <span className={styles.sentNote}>Sent</span>
                              <div className={styles.replySlot} aria-live="polite">
                                <AnimatePresence mode="popLayout" initial={false}>
                                  {responseShown ? (
                                    <motion.div
                                      key="reply"
                                      className={styles.replyRow}
                                      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6, filter: blurred }}
                                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                      transition={{ duration: .32, ease: enterEase }}>
                                      <p className={styles.bubbleIn}>
                                        <span className={styles.srOnly}>Marcus replied: </span>
                                        {responses[reply]}
                                      </p>
                                      <button
                                        type="button"
                                        className={styles.textButton}
                                        onClick={() => {
                                          window.clearTimeout(replyTimer.current);
                                          setReply(null);
                                          setResponseShown(false);
                                          pendingFocus.current = () => firstReply.current?.focus({ preventScroll: true });
                                        }}>
                                        New message
                                      </button>
                                    </motion.div>
                                  ) : (
                                    <motion.span
                                      key="typing"
                                      className={styles.typing}
                                      role="status"
                                      aria-label="Marcus is typing"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0, transition: { duration: .1 } }}
                                      transition={{ duration: .2, delay: .3 }}>
                                      {[0, 1, 2].map(dot => (
                                        <motion.i
                                          key={dot}
                                          animate={reduced ? undefined : { opacity: [.35, 1, .35] }}
                                          transition={{ duration: .9, repeat: Infinity, delay: .15 * dot, ease: "easeInOut" }} />
                                      ))}
                                    </motion.span>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          )}
                          <div className={styles.callRow}>
                            <button
                              type="button"
                              className={styles.callButton}
                              data-active={callOn || undefined}
                              onClick={() => {
                                if (callOn) {
                                  setCallOn(false);
                                  return;
                                }
                                setElapsed(0);
                                setCallOn(true);
                              }}>
                              {callOn ? <PhoneOff size={16} strokeWidth={1.75} aria-hidden="true" /> : <Phone size={16} strokeWidth={1.75} aria-hidden="true" />}
                              <TextMorph>{callOn ? "End call" : "Call Marcus"}</TextMorph>
                            </button>
                            <span className={styles.callStatus} aria-live="polite">
                              {callOn ? (
                                <><span className={styles.srOnly}>Call in progress</span><span aria-hidden="true">On call {toClock(elapsed)}</span></>
                              ) : elapsed > 0 ? `Call ended, ${toClock(elapsed)}` : "Private number"}
                            </span>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.section>
          )}
        </AnimatePresence>

        <section className={styles.order} aria-labelledby={`${id}-order`}>
          <div className={styles.orderHead}>
            <h3 id={`${id}-order`} className={styles.sectionTitle}>Halden Studio</h3>
            <span>2 items</span>
          </div>
          <ul className={styles.items}>
            <li>
              <img className={styles.thumb} src={loungeChair.src} width={44} height={44} sizes="44px" alt="" />
              <div className={styles.itemText}>
                <strong>Oak lounge chair</strong>
                <span>Natural oak, white glove delivery</span>
              </div>
            </li>
            <li>
              <img className={styles.thumb} src={glassCarafe.src} width={44} height={44} sizes="44px" alt="" />
              <div className={styles.itemText}>
                <strong>Glass carafe set</strong>
                <span>Carafe and two tumblers</span>
              </div>
            </li>
          </ul>
          <p className={styles.address}>
            <MapPin size={16} strokeWidth={1.75} aria-hidden="true" />
            Seefeldstrasse 118, 8008 Zürich
          </p>
        </section>
      </div>

      <footer
        className={styles.foot}
        data-frame-flat={flat ? "" : undefined}
        style={flattened}>
        <p className={styles.footNote}>
          <span className={styles.updated}>
            Updated <Swap id={step.now} className={styles.inlineSwap}>{step.now}</Swap>
          </span>
        </p>
        <div className={styles.footActions}>
          <AnimatePresence mode="popLayout" initial={false}>
            {index > 1 && !last && (
              <motion.div
                key="reset"
                initial={reduced ? { opacity: 0 } : { opacity: 0, filter: blurred, x: 6 }}
                animate={{ opacity: 1, filter: "blur(0px)", x: 0 }}
                exit={{ opacity: 0, transition: { duration: duration.instant } }}
                transition={{ duration: .26, ease: enterEase }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    resetContact();
                    setIndex(1);
                    pendingFocus.current = () => primaryButton.current?.focus();
                  }}>
                  Start over
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          <Button
            ref={primaryButton}
            size="sm"
            onClick={() => {
              if (last) {
                resetContact();
                setIndex(1);
                return;
              }
              const next = steps[index + 1];
              setIndex(index + 1);
              setPingKey(value => value + 1);
              if (next.stage === 4) resetContact();
            }}>
            {last ? <><RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />Start over</> : "Simulate next update"}
          </Button>
        </div>
      </footer>
      <p className={styles.srOnly} aria-live="polite">{announcement}</p>
    </section>
  );
}

export default DeliveryTracker;
