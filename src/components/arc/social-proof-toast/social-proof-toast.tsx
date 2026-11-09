import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { BadgeCheck, X } from "lucide-react";
import { LinearMark, RaycastMark, ResendMark, SupabaseMark, VercelMark } from "./social-proof-toast-marks";
import styles from "./social-proof-toast.module.css";
import type { ReactNode } from "react";

/** One entry in the feed. */
export interface SocialProofEvent {
  /** Stable id, used for keys and callbacks. */
  id: string;
  /** A first name or a company, shown in medium weight. */
  name: string;
  /** What they did, read after the name: "started a Pro trial". */
  action: string;
  /** Short context before the time, such as a city or a seat count. */
  meta?: string;
  /** When it happened. Dates render as Just now, 4 min ago, 2 h ago. */
  time?: Date | number | string;
  /** Portrait URL for a person. */
  avatar?: string;
  /** A company mark drawn in currentColor, rendered at 18px in the round slot when there is no avatar. Initials show when neither is set. */
  logo?: ReactNode;
  /** Shows a check badge with a label. True reads Verified; pass a string such as Verified by Stripe. */
  verified?: boolean | string;
}

export type SocialProofPosition = "inline" | "bottom-left" | "bottom-right" | "top-left" | "top-right";

export interface SocialProofToastProps {
  /** The feed, oldest first. Each event is { id, name, action, meta?, time?, avatar?, logo?, verified? }. A Date or timestamp time renders as relative time; a string renders as is. */
  events?: SocialProofEvent[];
  /** Milliseconds between toasts. The countdown keeps its remaining time across hover and focus pauses. */
  interval?: number;
  /** Milliseconds before the first toast. */
  initialDelay?: number;
  /** How many toasts stack at once. Older ones fade out from the back. */
  maxVisible?: number;
  /** How many toasts already show on mount, without an entrance. Useful for previews and screenshots. */
  prefill?: number;
  /** Inline sits in the layout. The corners pin the stack to the viewport, 24px from the edges (16px and full width on phones). Top positions stack downward. */
  position?: SocialProofPosition;
  /** Fans the stack out while it is hovered or holds focus. */
  expandOnHover?: boolean;
  /** Starts the feed over when it ends. False stops after the last event. */
  loop?: boolean;
  /** Stops after this many toasts in a session, so the page stays calm. */
  limit?: number;
  /** Pauses the cycle from outside, for example while a modal or cookie banner is open. */
  paused?: boolean;
  /** Called each time a toast appears, for impression tracking. */
  onShow?: (event: SocialProofEvent) => void;
  /** Called when a visitor dismisses a toast. */
  onDismiss?: (event: SocialProofEvent) => void;
  /** Makes each toast a button, for example to open pricing or a customer story. */
  onSelect?: (event: SocialProofEvent) => void;
  /** Accessible name of the region. */
  label?: string;
  /** Class on the root region. */
  className?: string;
}

const avatar = (name: string) => `/media/people/${name}.svg`;

/** The sample SaaS feed the component plays when it gets no events. */
export const sampleSocialProofEvents: SocialProofEvent[] = [
  { id: "sofia", name: "Sofia", action: "started a Pro trial", meta: "Madrid", time: "2 min ago", avatar: avatar("sofia-ramirez") },
  {
    id: "linear",
    name: "Linear",
    action: "upgraded to Business",
    meta: "48 seats",
    time: "4 min ago",
    logo: <LinearMark />,
    verified: true,
  },
  { id: "daniel", name: "Daniel", action: "subscribed to Pro yearly", meta: "Seoul", time: "7 min ago", avatar: avatar("daniel-kim"), verified: true },
  {
    id: "vercel",
    name: "Vercel",
    action: "added 12 seats to Team",
    meta: "San Francisco",
    time: "11 min ago",
    logo: <VercelMark />,
    verified: true,
  },
  { id: "chloe", name: "Chloe", action: "booked a product demo", meta: "Melbourne", time: "14 min ago", avatar: avatar("chloe-nguyen") },
  {
    id: "supabase",
    name: "Supabase",
    action: "moved to annual billing",
    meta: "Enterprise",
    time: "18 min ago",
    logo: <SupabaseMark />,
    verified: true,
  },
  { id: "hannah", name: "Hannah", action: "started a Pro trial", meta: "Dublin", time: "21 min ago", avatar: avatar("hannah-walsh") },
  {
    id: "raycast",
    name: "Raycast",
    action: "upgraded to Business",
    meta: "32 seats",
    time: "26 min ago",
    logo: <RaycastMark />,
    verified: true,
  },
  { id: "mateo", name: "Mateo", action: "invited 6 teammates", meta: "Buenos Aires", time: "30 min ago", avatar: avatar("mateo-alvarez") },
  {
    id: "resend",
    name: "Resend",
    action: "renewed Enterprise",
    meta: "Annual plan",
    time: "34 min ago",
    logo: <ResendMark />,
    verified: true,
  },
];

const SPRING: Transition = { type: "spring", visualDuration: 0.24, bounce: 0 };
const EASE_OUT = [0.22, 1, 0.36, 1] as [number, number, number, number];

/** Dates and timestamps become relative time; strings are shown as they are. */
function relativeTime(value: SocialProofEvent["time"]): string | undefined {
  if (value === undefined || typeof value === "string") return value;
  const seconds = Math.max(0, (Date.now() - (value instanceof Date ? value.getTime() : value)) / 1000);
  if (seconds < 45) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

interface Entry {
  key: string;
  event: SocialProofEvent;
}

interface ToastProps {
  event: SocialProofEvent;
  onDismiss: () => void;
  onSelect?: (event: SocialProofEvent) => void;
}

function Toast({ event, onDismiss, onSelect }: ToastProps) {
  const relative = relativeTime(event.time);
  const context = [event.meta, relative].filter(Boolean).join(" · ");
  const verified = event.verified ? (typeof event.verified === "string" ? event.verified : "Verified") : null;
  const sentence = `${event.name} ${event.action}`;
  const initials = event.name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={styles.card} data-selectable={onSelect ? true : undefined}>
      <div className={styles.content}>
        <span className={styles.visual}>
          {event.avatar ? (
            <img src={event.avatar} alt="" width={36} height={36} draggable={false} />
          ) : (
            (event.logo ?? <span className={styles.initials}>{initials}</span>)
          )}
        </span>
        <span className={styles.text}>
          <span className={styles.title}>
            <span className={styles.name}>{event.name}</span> {event.action}
          </span>
          <span className={styles.meta}>
            {event.meta && <span className={styles.metaText}>{event.meta}</span>}
            {event.meta && relative && (
              <span className={styles.dot} aria-hidden="true">
                ·
              </span>
            )}
            {relative && (
              <span className={styles.time} suppressHydrationWarning>
                {relative}
              </span>
            )}
            {context && verified && (
              <span className={styles.dot} aria-hidden="true">
                ·
              </span>
            )}
            {verified && (
              <span className={styles.verified}>
                <BadgeCheck size={14} strokeWidth={1.75} aria-hidden="true" />
                {verified}
              </span>
            )}
          </span>
        </span>
      </div>
      {onSelect && (
        <button
          type="button"
          className={styles.hit}
          aria-label={`${sentence}${context ? `, ${context}` : ""}`}
          onClick={() => onSelect(event)}
        />
      )}
      <button type="button" className={styles.dismiss} data-dismiss aria-label={`Dismiss: ${sentence}`} onClick={onDismiss}>
        <X size={14} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Stacked social proof notifications for a landing or pricing page. Toasts cycle on an interval,
 * pause and fan out on hover or focus, and can be dismissed. With no props it plays a sample SaaS feed.
 */
export function SocialProofToast({
  events = sampleSocialProofEvents,
  interval = 4000,
  initialDelay = 800,
  maxVisible = 3,
  prefill = 0,
  position = "inline",
  expandOnHover = true,
  loop = true,
  limit,
  paused = false,
  onShow,
  onDismiss,
  onSelect,
  label = "Recent activity",
  className,
}: SocialProofToastProps) {
  const reduced = useReducedMotion() ?? false;
  const root = useRef<HTMLElement | null>(null);
  const live = useRef(events);
  const show = useRef(onShow);
  useEffect(() => {
    live.current = events;
    show.current = onShow;
  });

  const visible = Math.max(1, Math.floor(maxVisible));
  const initial = Math.min(Math.max(0, Math.floor(prefill)), events.length, visible, limit ?? Infinity);
  const [items, setItems] = useState<Entry[]>(() =>
    events
      .slice(0, initial)
      .map((event, index) => ({ key: `${event.id}-p${index}`, event }))
      .reverse(),
  );
  const cursor = useRef(initial);
  const shown = useRef(initial);
  const serial = useRef(0);
  const [exhausted, setExhausted] = useState(false);
  const [tick, setTick] = useState(0);
  const [pointerOver, setPointerOver] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [status, setStatus] = useState("");
  const remaining = useRef(initial > 0 ? interval : initialDelay);

  const push = useCallback(() => {
    const feed = live.current;
    if (!feed.length) return;
    if ((!loop && cursor.current >= feed.length) || (limit !== undefined && shown.current >= limit)) {
      setExhausted(true);
      return;
    }
    const event = feed[cursor.current % feed.length];
    cursor.current += 1;
    shown.current += 1;
    const key = `${event.id}-${serial.current++}`;
    setItems((list) => [{ key, event }, ...list].slice(0, visible + 1));
    show.current?.(event);
  }, [loop, limit, visible]);

  useEffect(() => {
    const node = root.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { rootMargin: "120px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sync = () => setTabVisible(document.visibilityState !== "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  const interacting = pointerOver || focusWithin;
  const running = !exhausted && !paused && !interacting && onScreen && tabVisible && events.length > 0;

  useEffect(() => {
    if (!running) return;
    const started = performance.now();
    let fired = false;
    const id = window.setTimeout(() => {
      fired = true;
      remaining.current = interval;
      push();
      setTick((value) => value + 1);
    }, remaining.current);
    return () => {
      window.clearTimeout(id);
      // Only an interrupted wait keeps its remainder; a fired one already reset the budget.
      if (!fired) remaining.current = Math.max(1200, remaining.current - (performance.now() - started));
    };
  }, [running, tick, interval, push]);

  const dismiss = useCallback(
    (key: string) => {
      const index = items.findIndex((entry) => entry.key === key);
      if (index < 0) return;
      const entry = items[index];
      const node = root.current;
      const heldFocus = node?.querySelector(`[data-key="${CSS.escape(key)}"]`)?.contains(document.activeElement) ?? false;
      setItems((list) => list.filter((item) => item.key !== key));
      setStatus(`Dismissed: ${entry.event.name} ${entry.event.action}`);
      onDismiss?.(entry.event);
      if (heldFocus && node) {
        const next = items.slice(0, visible).find((item) => item.key !== key);
        const target = next
          ? node.querySelector<HTMLElement>(`[data-key="${CSS.escape(next.key)}"] [data-dismiss]`)
          : null;
        (target ?? node).focus({ preventScroll: true });
      }
    },
    [items, visible, onDismiss],
  );

  const fanned = expandOnHover && interacting && items.length > 1;
  const anchoredTop = position === "top-left" || position === "top-right";
  const direction = anchoredTop ? 1 : -1;
  const itemTransition: Transition = reduced
    ? { duration: 0.16, y: { duration: 0 }, scale: { duration: 0 } }
    : { ...SPRING, opacity: { duration: 0.16, ease: EASE_OUT } };

  return (
    <section
      ref={root}
      aria-label={label}
      tabIndex={-1}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-position={position}
      data-anchor={anchoredTop ? "top" : "bottom"}
      data-expanded={fanned || undefined}
      style={{ "--toast-h": "64px", "--toast-gap": "8px", height: 64 + 10 * (visible - 1) } as React.CSSProperties}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") setPointerOver(true);
      }}
      onPointerLeave={() => setPointerOver(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !items.length) return;
        const key = (event.target as HTMLElement).closest<HTMLElement>("[data-key]")?.dataset.key;
        event.preventDefault();
        dismiss(key ?? items[0].key);
      }}
    >
      <ol className={styles.list}>
        <AnimatePresence initial={false}>
          {items.map((entry, index) => {
            const inStack = index < visible;
            const offset = fanned ? direction * index * 72 : direction * index * 10;
            const scale = fanned ? 1 : 1 - 0.05 * Math.min(index, visible);
            return (
              <motion.li
                key={entry.key}
                data-key={entry.key}
                className={styles.item}
                data-front={index === 0 || undefined}
                data-dim={(!fanned && index > 0) || undefined}
                aria-hidden={!inStack || undefined}
                inert={!inStack}
                initial={{ opacity: 0, y: reduced ? 0 : -(16 * direction), scale: 1 }}
                animate={{ opacity: Number(Boolean(inStack)), y: offset, scale }}
                exit={{
                  opacity: 0,
                  scale: reduced ? scale : scale - 0.04,
                  transition: { duration: reduced ? 0.12 : 0.16, ease: EASE_OUT },
                }}
                transition={itemTransition}
                style={{ zIndex: 100 - index, transformOrigin: anchoredTop ? "50% 100%" : "50% 0%" }}
              >
                <Toast event={entry.event} onDismiss={() => dismiss(entry.key)} onSelect={onSelect} />
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {status}
      </span>
    </section>
  );
}

export default SocialProofToast;
