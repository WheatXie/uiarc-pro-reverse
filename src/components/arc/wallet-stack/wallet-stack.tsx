"use client";

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  MotionConfig,
  animate,
  motion,
  motionValue,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionStyle,
  type MotionValue,
} from "motion/react";
import { ChevronLeft } from "lucide-react";
import { motionTokens } from "../motion-tokens";
import styles from "./wallet-stack.module.css";

const CARD_RATIO = 53.98 / 85.6;
const OMEGA = (2 * Math.PI) / 0.48;
const STACK_SPRING = { type: "spring", stiffness: OMEGA ** 2, damping: 2 * OMEGA, mass: 1 } as const;
const TILT_SPRING = { stiffness: 180, damping: 27 } as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;

/** Rubber-bands a distance so it never travels more than `limit`. */
function band(distance: number, limit: number, tension = 0.55) {
  const magnitude = Math.abs(distance);
  return (magnitude * limit * tension * Math.sign(distance)) / (limit + tension * magnitude);
}

/** Converts a pointer velocity into the distance a decaying fling would cover. */
const project = (velocity: number, decay = 0.995) => ((velocity / 1000) * decay) / (1 - decay);

/** Drives a motion value with the shared stack spring, carrying momentum across retargets. */
function settle(value: MotionValue<number>, target: number, reduced: boolean, velocity = value.getVelocity()) {
  if (reduced) return animate(value, target, { duration: 0 });
  const delta = target - value.get();
  const carried =
    Math.sign(velocity) === Math.sign(delta)
      ? Math.sign(velocity) * Math.min(Math.abs(velocity), OMEGA * Math.abs(delta))
      : velocity;
  return animate(value, target, { ...STACK_SPRING, velocity: carried });
}

export type WalletStackVariant = "metal" | "black" | "glass" | "color";

export interface WalletStackTransaction {
  id: string;
  merchant: string;
  detail: string;
  amount: number;
  /** Glyph shown when the row has no avatar. */
  icon?: ReactNode;
  /** Portrait URL; takes priority over `icon`. */
  avatar?: string;
}

export interface WalletStackCard {
  id: string;
  issuer: string;
  product: string;
  lastFour: string;
  holder: string;
  expires?: string;
  variant?: WalletStackVariant;
  finish?: "metal" | "black" | "glass" | "color" | "graphite" | "clay" | "photo";
  /** Base hue for the `color` variant, e.g. `oklch(40% .1 162)`. */
  tint?: string;
  image?: string;
  balance: number;
  balanceLabel: string;
  transactions: WalletStackTransaction[];
  /** Defaults to the Arc mark; pass `null` to hide the network badge. */
  network?: ReactNode | null;
}

export interface WalletStackProps {
  cards: WalletStackCard[];
  /** Heading above the stack. */
  label?: string;
  currency?: string;
  locale?: string;
  onSelectedChange?: (card: WalletStackCard | null) => void;
  className?: string;
}

interface StackMotion {
  position: MotionValue<number>;
  open: MotionValue<number>;
  spread: MotionValue<number>;
  width: MotionValue<number>;
  height: MotionValue<number>;
  tick: MotionValue<number>;
  gyro: { x: MotionValue<number>; y: MotionValue<number>; on: MotionValue<number> };
}

type StackVars = { [key: `--${string}`]: string | number | MotionValue<string> | MotionValue<number> | undefined };
type StackStyle = MotionStyle & StackVars;

interface DragSession {
  pointer: number;
  x: number;
  y: number;
  start: number;
  dragging: boolean;
  dismiss: boolean;
  samples: { t: number; y: number }[];
}

const variantOf = (card: WalletStackCard): WalletStackVariant =>
  card.variant ?? (card.finish === "graphite" ? "black" : card.finish === "clay" || card.finish === "photo" ? "color" : "metal");

const tintOf = (card: WalletStackCard) =>
  card.tint ??
  (card.finish === "clay" ? "oklch(50% .1 45)" : card.finish === "photo" ? "oklch(34% .06 230)" : undefined);

/** Stage geometry in pixels for a given width, height, card count and spread (0 stacked → 1 fanned). */
function metrics(width: number, height: number, count: number, spread: number) {
  const cardHeight = width * CARD_RATIO;
  const room = height - 30 - 12;
  const visible = Math.min(count - 1, 3);
  const gapLimit = Math.max(4, (room - cardHeight - 12) / Math.max(1, visible));
  const peek = Math.min(lerp(0.06 * cardHeight, 0.22 * cardHeight, spread), gapLimit);
  const front = (room - cardHeight + visible * peek) / 2;
  return { cardHeight, peek, front, travel: Math.max(80, height - 30 - front) };
}

interface CardLayoutInput {
  index: number;
  count: number;
  position: number;
  open: number;
  selected: number;
  tucked: number;
  spread: number;
  width: number;
  height: number;
  press: number;
}

/** Where a single card sits in the stack, and how strongly it lifts its shadow. */
function cardLayout({ index, count, position, open, selected, tucked, spread, width, height, press }: CardLayoutInput) {
  const { peek, front } = metrics(width, height, count, spread);
  const pocket = height - 30;
  const delta = index - position;
  let y: number;
  let scale: number;
  if (delta >= 0) {
    const ahead = Math.min(delta, 3.5);
    y = front - ahead * peek;
    scale = 1 - 0.05 * ahead;
  } else {
    const behind = -delta;
    if (behind < 1) {
      y = lerp(front, pocket, behind);
      scale = lerp(1, 0.9, behind);
    } else {
      y = pocket + 7 * Math.min(behind - 1, 2);
      scale = 0.9 + 0.02 * Math.min(behind - 1, 3);
    }
  }
  const selectedY = lerp(pocket + 6 * Math.min(tucked, 2), 0, selected);
  const selectedScale = lerp(0.9 + 0.02 * Math.min(tucked, 3), 0.88, selected);
  const proximity = clamp(1 - Math.abs(delta), 0, 1);
  const near = clamp(index - position, 0, 1);
  return {
    y: lerp(y, selectedY, open) - press * (1 - open) * near * 8,
    scale: lerp(scale, selectedScale, open),
    // The open card keeps its own shadow at full strength; everything else drops away.
    lift: lerp(0.45 * proximity + 0.15 * (delta > 0 ? 1 : 0), selected, open) + 0.35 * press,
  };
}

function format(value: number, formatter: Intl.NumberFormat) {
  return formatter.format(value);
}

/** Card artwork: material, art, texture, sweep, identity, chip, network mark, sheen and bevel. */
const CardArt = memo(function CardArt({ card, chipId }: { card: WalletStackCard; chipId: string }) {
  const variant = variantOf(card);
  return (
    <>
      <span className={styles.material} aria-hidden="true" />
      {card.image ? <img className={styles.art} src={card.image} alt="" draggable={false} decoding="async" /> : null}
      <span className={styles.texture} aria-hidden="true">
        {variant === "black" ? (
          <svg viewBox="0 0 856 540" preserveAspectRatio="xMidYMid slice">
            {TEXTURE_RINGS.map((d, index) => (
              <path d={d} key={index} />
            ))}
          </svg>
        ) : null}
      </span>
      <span className={styles.sweep} aria-hidden="true" />
      <span className={styles.issuer}>{card.issuer}</span>
      <span className={styles.product}>{card.product}</span>
      <Chip id={chipId} tone={variant === "black" || variant === "glass" ? "silver" : "gold"} />
      <Contactless />
      <span className={styles.number}>
        <span className={styles.mask} aria-hidden="true">
          •••• •••• ••••
        </span>{" "}
        {card.lastFour}
      </span>
      <span className={styles.holder}>{card.holder}</span>
      {card.expires ? (
        <span className={styles.expiry}>
          <span className={styles.expiryLabel}>Valid thru</span>
          {card.expires}
        </span>
      ) : null}
      {card.network === undefined ? (
        <NetworkMark />
      ) : card.network === null ? null : (
        <span className={styles.network}>{card.network}</span>
      )}
    </>
  );
});

function Chip({ id, tone }: { id: string; tone: "gold" | "silver" }) {
  const stops =
    tone === "gold"
      ? ["oklch(90% .08 90)", "oklch(76% .11 78)", "oklch(93% .06 95)", "oklch(70% .1 70)", "oklch(84% .09 85)"]
      : ["oklch(95% .004 260)", "oklch(74% .006 260)", "oklch(97% .003 260)", "oklch(68% .006 260)", "oklch(86% .005 260)"];
  return (
    <svg className={styles.chip} viewBox="0 0 50 38" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1">
          {stops.map((stop, index) => (
            <stop offset={index / (stops.length - 1)} stopColor={stop} key={index} />
          ))}
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="1" y1="0" x2="0" y2="1">
          {stops.map((stop, index) => (
            <stop offset={index / (stops.length - 1)} stopColor={stop} key={index} />
          ))}
        </linearGradient>
        <linearGradient id={`${id}-c`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="oklch(100% 0 0)" stopOpacity=".55" />
          <stop offset=".45" stopColor="oklch(100% 0 0)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x=".5" y=".5" width="49" height="37" rx="7" fill={`url(#${id}-a)`} />
      <rect x="16" y="8" width="18" height="22" rx="3.5" fill={`url(#${id}-b)`} />
      <path
        d="M0 12.5h16M0 25.5h16M34 12.5h16M34 25.5h16M16 8v22M34 8v22M25 0v8M25 30v8M16 19h-3M34 19h3"
        fill="none"
        stroke="oklch(0% 0 0 / .32)"
        strokeWidth=".7"
      />
      <rect x="16" y="8" width="18" height="22" rx="3.5" fill="none" stroke="oklch(0% 0 0 / .32)" strokeWidth=".7" />
      <rect x=".5" y=".5" width="49" height="37" rx="7" fill={`url(#${id}-c)`} stroke="oklch(0% 0 0 / .28)" strokeWidth=".7" />
    </svg>
  );
}

function Contactless() {
  return (
    <svg className={styles.contactless} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M5.5 9a4.5 4.5 0 0 1 0 6" />
      <path d="M9 6.5a8 8 0 0 1 0 11" />
      <path d="M12.5 4a11.5 11.5 0 0 1 0 16" />
      <path d="M16 1.5a15 15 0 0 1 0 21" />
    </svg>
  );
}

function NetworkMark() {
  return (
    <span className={styles.network} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M17.6 7.4A7.5 7.5 0 1 1 12 4.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="17.4" cy="4.9" r="2.1" fill="currentColor" />
      </svg>
      <span>halo</span>
    </span>
  );
}

const TEXTURE_RINGS = Array.from({ length: 16 }, (_, index) => {
  const amplitude = 70 + 19 * index;
  const points = Array.from({ length: 241 }, (_, step) => {
    const angle = (step / 240) * Math.PI * 2;
    const radius = amplitude + 9 * Math.sin(11 * angle + 0.42 * index) + 4 * Math.sin(3 * angle - 0.2 * index);
    return `${(640 + radius * Math.cos(angle)).toFixed(1)} ${(250 + radius * Math.sin(angle) * 0.82).toFixed(1)}`;
  });
  return `M${points.join("L")}Z`;
});

function Amount({ value, formatter, reduced }: { value: number; formatter: Intl.NumberFormat; reduced: boolean }) {
  const amount = useMotionValue(value);
  const text = useTransform(amount, (latest) => format(latest, formatter));
  useEffect(() => {
    if (reduced) {
      amount.set(value);
      return;
    }
    const controls = animate(amount, value, {
      duration: 1.4 * motionTokens.duration.considered,
      ease: [...motionTokens.ease.enter],
    });
    return () => controls.stop();
  }, [amount, value, reduced]);
  return <motion.span className={styles.money}>{text}</motion.span>;
}

interface CardProps {
  card: WalletStackCard;
  index: number;
  count: number;
  stack: StackMotion;
  selected: MotionValue<number>;
  selectedAbove: MotionValue<number>[];
  front: boolean;
  tabbable: boolean;
  expanded: boolean;
  tilt: boolean;
  label: string;
  onSelect: () => void;
  slotRef: (node: HTMLDivElement | null) => void;
  buttonRef: (node: HTMLButtonElement | null) => void;
}

function StackCard({ card, index, count, stack, selected, selectedAbove, front, tabbable, expanded, tilt, label, onSelect, slotRef, buttonRef }: CardProps) {
  const chipId = useId().replace(/:/g, "");
  const press = useMotionValue(0);
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const hovering = useMotionValue(0);

  const layout = useCallback(() => {
    // `tick` re-runs the measurement-driven layout after resize.
    void stack.tick.get();
    return cardLayout({
      index,
      count,
      position: stack.position.get(),
      open: stack.open.get(),
      selected: selected.get(),
      tucked: selectedAbove.reduce((total, value) => total + 1 - value.get(), 0),
      spread: stack.spread.get(),
      width: stack.width.get(),
      height: stack.height.get(),
      press: press.get(),
    });
  }, [count, index, press, selected, selectedAbove, stack]);

  const y = useTransform(() => layout().y);
  const scale = useTransform(() => layout().scale);
  const lift = useTransform(() => clamp(layout().lift, 0, 1));

  const tiltX = useTransform(() => {
    if (hovering.get()) return pointerX.get();
    return front && stack.gyro.on.get() ? stack.gyro.x.get() : 0.5;
  });
  const tiltY = useTransform(() => {
    if (hovering.get()) return pointerY.get();
    return front && stack.gyro.on.get() ? stack.gyro.y.get() : 0.5;
  });

  const rotateY = useSpring(useTransform(tiltX, (value) => (value - 0.5) * 10), TILT_SPRING);
  const rotateX = useSpring(useTransform(tiltY, (value) => (0.5 - value) * 10), TILT_SPRING);
  const sheenX = useSpring(useTransform(tiltX, (value) => (value - 0.5) * 50), TILT_SPRING);
  const sheenY = useSpring(useTransform(tiltY, (value) => (value - 0.5) * 50), TILT_SPRING);
  const sheenPresence = useSpring(
    useTransform(() => Math.max(hovering.get(), front ? stack.gyro.on.get() : 0)),
    TILT_SPRING,
  );
  const sheenOpacity = useTransform(sheenPresence, (value) => 0.25 + 0.75 * value);
  const sheenLeft = useTransform(sheenX, (value) => `${value}%`);
  const sheenTop = useTransform(sheenY, (value) => `${value}%`);

  const cardStyle: StackStyle = {
    rotateX: tilt ? rotateX : 0,
    rotateY: tilt ? rotateY : 0,
    transformPerspective: 900,
    "--card-tint": tintOf(card),
  };

  return (
    <motion.div ref={slotRef} className={styles.cardSlot} style={{ y, scale, zIndex: count - index + 1 }}>
      <motion.span className={styles.shadow} style={{ opacity: lift }} aria-hidden="true" />
      <motion.button
        ref={buttonRef}
        type="button"
        className={styles.card}
        data-variant={variantOf(card)}
        data-front={front || undefined}
        style={cardStyle}
        aria-label={label}
        aria-expanded={expanded}
        tabIndex={tabbable ? 0 : -1}
        onClick={onSelect}
        onPointerMove={(event) => {
          if (!tilt || event.pointerType !== "mouse") return;
          const rect = event.currentTarget.getBoundingClientRect();
          pointerX.set(clamp((event.clientX - rect.left) / rect.width, 0, 1));
          pointerY.set(clamp((event.clientY - rect.top) / rect.height, 0, 1));
          hovering.set(1);
        }}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") settle(press, 1, !tilt);
        }}
        onPointerLeave={() => {
          hovering.set(0);
          pointerX.set(0.5);
          pointerY.set(0.5);
          settle(press, 0, !tilt);
        }}
      >
        <CardArt card={card} chipId={chipId} />
        {tilt ? (
          <motion.span className={styles.sheen} style={{ x: sheenLeft, y: sheenTop, opacity: sheenOpacity }} aria-hidden="true" />
        ) : null}
        <span className={styles.edge} aria-hidden="true" />
      </motion.button>
    </motion.div>
  );
}

/**
 * A stacked wallet: cards fan apart on hover, drag to page through them, and
 * tap one to pull it out and read its activity.
 */
export function WalletStack({ cards, label = "Wallet", currency = "USD", locale = "en-US", onSelectedChange, className }: WalletStackProps) {
  const reduced = useReducedMotion() ?? false;
  const titleId = useId();
  const hintId = useId();
  const count = cards.length;

  const stageRef = useRef<HTMLDivElement | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const indexRef = useRef(0);
  const openRef = useRef(false);
  const stageHover = useRef(false);
  const dragRef = useRef<DragSession | null>(null);
  const slotsRef = useRef<(HTMLDivElement | null)[]>([]);
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const clickGuard = useRef(false);

  const position = useMotionValue(0);
  const openValue = useMotionValue(0);
  const spread = useMotionValue(0);
  const width = useMotionValue(296);
  const height = useMotionValue(383);
  const tick = useMotionValue(0);
  const [gyro] = useState(() => ({ x: motionValue(0.5), y: motionValue(0.5), on: motionValue(0) }));

  const stack: StackMotion = { position, open: openValue, spread, width, height, tick, gyro };

  const [selectedValues] = useState(() => new Map<string, MotionValue<number>>());
  const resolveSelected = (card: WalletStackCard, index: number) => {
    let value = selectedValues.get(card.id);
    if (!value) {
      value = motionValue(index === selectedIndex ? 1 : 0);
      selectedValues.set(card.id, value);
    }
    return value;
  };

  const detailOpacity = useTransform(openValue, (value) => clamp((value - 0.4) / 0.6, 0, 1));
  const detailY = useTransform(openValue, (value) => (1 - value) * 16);

  const onSelectedChangeRef = useRef(onSelectedChange);
  onSelectedChangeRef.current = onSelectedChange;

  const apply = useCallback(
    (index: number, nextOpen: boolean, velocity?: number, openVelocity?: number) => {
      const next = clamp(index, 0, Math.max(0, count - 1));
      const wasOpen = openRef.current;
      const previous = indexRef.current;
      indexRef.current = next;
      openRef.current = nextOpen;
      setSelectedIndex(next);
      setOpen(nextOpen);
      settle(position, next, reduced, velocity);
      if (nextOpen !== wasOpen || openVelocity !== undefined) settle(openValue, nextOpen ? 1 : 0, reduced, openVelocity);
      cards.forEach((card, cardIndex) => {
        const value = resolveSelected(card, cardIndex);
        const target = cardIndex === next ? 1 : 0;
        if (value.get() !== target) settle(value, target, reduced);
      });
      if (nextOpen !== wasOpen) settle(spread, !nextOpen && stageHover.current ? 1 : 0, reduced);
      if (nextOpen && (!wasOpen || previous !== next)) onSelectedChangeRef.current?.(cards[next]);
      else if (!nextOpen && wasOpen) onSelectedChangeRef.current?.(null);
    },
    [cards, count, openValue, position, reduced, selectedValues, spread],
  );

  const focusCard = (index: number) => {
    requestAnimationFrame(() => buttonsRef.current[index]?.focus({ preventScroll: true }));
  };

  useLayoutEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    let frame = 0;
    const measure = () => {
      width.set(node.clientWidth - 24);
      height.set(node.clientHeight - 12);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => tick.set(tick.get() + 1));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [height, tick, width]);

  useEffect(() => {
    if (reduced || !window.matchMedia("(hover: none) and (pointer: coarse)").matches) return;
    const handle = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;
      gyro.x.set(clamp(0.5 + event.gamma / 40, 0, 1));
      gyro.y.set(clamp(0.5 + (event.beta - 50) / 40, 0, 1));
      gyro.on.set(1);
    };
    window.addEventListener("deviceorientation", handle);
    return () => window.removeEventListener("deviceorientation", handle);
  }, [gyro, reduced]);

  useEffect(() => {
    if (indexRef.current <= count - 1) return;
    const next = Math.max(0, count - 1);
    indexRef.current = next;
    position.set(next);
    queueMicrotask(() => setSelectedIndex(next));
  }, [count, position]);

  const dismissTravel = () => Math.max(120, 0.55 * height.get());

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragRef.current;
    if (!session || session.pointer !== event.pointerId) return;
    dragRef.current = null;
    if (!session.dragging) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    clickGuard.current = true;
    requestAnimationFrame(() => {
      clickGuard.current = false;
    });
    const velocity =
      event.type === "pointerup"
        ? (() => {
            const last = session.samples[session.samples.length - 1];
            if (!last || event.timeStamp - last.t > 80) return 0;
            const first = session.samples.find((sample) => last.t - sample.t <= 100) ?? last;
            const delta = Math.max(16, last.t - first.t);
            return clamp(((last.y - first.y) / delta) * 1000, -2400, 2400);
          })()
        : 0;
    if (session.dismiss) {
      const travel = dismissTravel();
      if (openValue.get() - project(velocity) / travel < 0.5) {
        apply(indexRef.current, false, undefined, -velocity / travel);
        focusCard(indexRef.current);
      } else {
        settle(openValue, 1, reduced, -velocity / travel);
      }
      return;
    }
    const { travel } = metrics(width.get(), height.get(), count, spread.get());
    const raw = position.get() + project(velocity) / travel;
    const start = Math.round(session.start);
    apply(clamp(Math.round(raw), start - 1, start + 1), false, velocity / travel);
  };

  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
  const current = cards[Math.min(selectedIndex, count - 1)] ?? null;

  return (
    <MotionConfig reducedMotion="user">
      <div className={[styles.wallet, className].filter(Boolean).join(" ")}>
        <div className={styles.header}>
          <h3 id={titleId} className={styles.title}>
            {label}
          </h3>
          <AnimatePresence mode="popLayout" initial={false}>
            {open ? (
              <motion.button
                key="back"
                type="button"
                className={styles.headerButton}
                onClick={() => {
                  apply(indexRef.current, false);
                  focusCard(indexRef.current);
                }}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.6 * motionTokens.duration.instant } }}
                transition={{ duration: motionTokens.duration.fast, delay: 0.04 }}
              >
                <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
                All cards
              </motion.button>
            ) : (
              count > 1 && (
                <motion.span
                  key="count"
                  className={styles.count}
                  aria-hidden="true"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.6 * motionTokens.duration.instant } }}
                  transition={{ duration: motionTokens.duration.fast, delay: 0.04 }}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={selectedIndex}
                      className={styles.countValue}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={motionTokens.spring.smooth}
                    >
                      {selectedIndex + 1}
                    </motion.span>
                  </AnimatePresence>
                  <span> of {count}</span>
                </motion.span>
              )
            )}
          </AnimatePresence>
        </div>
        <div
          ref={stageRef}
          className={styles.stage}
          role="group"
          aria-labelledby={titleId}
          aria-describedby={hintId}
          data-open={open || undefined}
          onPointerDown={(event) => {
            if (event.button !== 0 || count === 0 || dragRef.current?.dragging) return;
            if (openRef.current) {
              if (reduced || !slotsRef.current[indexRef.current]?.contains(event.target as Node)) return;
              dragRef.current = {
                pointer: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                start: 0,
                dragging: false,
                dismiss: true,
                samples: [],
              };
              return;
            }
            dragRef.current = {
              pointer: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              start: 0,
              dragging: false,
              dismiss: false,
              samples: [],
            };
          }}
          onPointerMove={(event) => {
            const session = dragRef.current;
            if (!session || session.pointer !== event.pointerId) return;
            if (!session.dragging) {
              const dx = event.clientX - session.x;
              const dy = event.clientY - session.y;
              if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
                dragRef.current = null;
                return;
              }
              if (Math.abs(dy) < 8) return;
              session.dragging = true;
              session.y = event.clientY;
              const source = session.dismiss ? openValue : position;
              source.stop();
              session.start = source.get();
              session.samples = [{ t: event.timeStamp, y: event.clientY }];
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                /* capture is best effort */
              }
              return;
            }
            session.samples.push({ t: event.timeStamp, y: event.clientY });
            if (session.samples.length > 12) session.samples.shift();
            const delta = event.clientY - session.y;
            if (session.dismiss) {
              const travel = dismissTravel();
              const next = session.start - delta / travel;
              openValue.set(next > 1 ? 1 + band((next - 1) * travel, travel, 0.3) / travel : Math.max(0, next));
              return;
            }
            const { travel } = metrics(width.get(), height.get(), count, spread.get());
            const raw = session.start + delta / travel;
            const last = count - 1;
            position.set(
              raw < 0 ? band(raw * travel, travel) / travel : raw > last ? last + band((raw - last) * travel, travel) / travel : raw,
            );
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={(event) => {
            if (event.target === event.currentTarget) endDrag(event);
          }}
          onPointerEnter={(event) => {
            if (event.pointerType !== "mouse") return;
            stageHover.current = true;
            if (!openRef.current) settle(spread, 1, reduced);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType !== "mouse") return;
            stageHover.current = false;
            settle(spread, 0, reduced);
          }}
          onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
            const currentIndex = indexRef.current;
            const step =
              event.key === "ArrowDown" || event.key === "ArrowRight"
                ? 1
                : event.key === "ArrowUp" || event.key === "ArrowLeft"
                  ? -1
                  : 0;
            const requested = step ? currentIndex + step : event.key === "Home" ? 0 : event.key === "End" ? count - 1 : null;
            if (requested !== null) {
              event.preventDefault();
              const next = clamp(requested, 0, count - 1);
              if (next !== currentIndex) {
                apply(next, stageHover.current);
                focusCard(next);
              } else if (!reduced) {
                animate(position, [position.get(), currentIndex + 0.06 * (step || (next === 0 ? -1 : 1)), currentIndex], {
                  duration: 0.32,
                  ease: [...motionTokens.ease.standard],
                });
              }
              return;
            }
            if (event.key === "Escape" && openRef.current) {
              event.preventDefault();
              apply(currentIndex, false);
              focusCard(currentIndex);
            }
          }}
        >
          {cards.map((card, index) => (
            <StackCard
              key={card.id}
              card={card}
              index={index}
              count={count}
              stack={stack}
              selected={resolveSelected(card, index)}
              selectedAbove={cards.slice(index + 1).map((above, offset) => resolveSelected(above, index + 1 + offset))}
              front={index === selectedIndex}
              tabbable={index === selectedIndex}
              expanded={open && index === selectedIndex}
              tilt={!reduced}
              label={`${card.issuer} ${card.product} ending in ${card.lastFour}, ${index + 1} of ${count}, ${card.balanceLabel.toLowerCase()} ${formatter.format(card.balance)}`}
              slotRef={(node) => {
                slotsRef.current[index] = node;
              }}
              buttonRef={(node) => {
                buttonsRef.current[index] = node;
              }}
              onSelect={() => {
                if (clickGuard.current) return;
                if (openRef.current && index === indexRef.current) {
                  apply(index, false);
                  focusCard(index);
                } else {
                  apply(index, true);
                }
              }}
            />
          ))}
          <motion.section
            className={styles.detail}
            style={{ opacity: detailOpacity, y: detailY }}
            aria-label={current ? `${current.issuer} activity` : undefined}
            inert={!open || undefined}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {current && open ? (
                <motion.div
                  key={current.id}
                  className={styles.detailBody}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }}
                >
                  <div className={styles.balance}>
                    <span className={styles.balanceLabel}>{current.balanceLabel}</span>
                    <Amount value={current.balance} formatter={formatter} reduced={reduced} />
                  </div>
                  <ul className={styles.activity} aria-label={`Recent activity on ${current.issuer}`}>
                    {current.transactions.map((transaction, index) => (
                      <motion.li
                        key={transaction.id}
                        className={styles.transaction}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...motionTokens.spring.smooth, delay: 0.08 + index * motionTokens.stagger.item * 1.6 }}
                      >
                        <span className={styles.txIcon} aria-hidden="true">
                          {transaction.avatar ? (
                            <img src={transaction.avatar} alt="" width={32} height={32} draggable={false} />
                          ) : (
                            transaction.icon
                          )}
                        </span>
                        <span className={styles.txText}>
                          <span className={styles.txMerchant}>{transaction.merchant}</span>
                          <span className={styles.txDetail}>{transaction.detail}</span>
                        </span>
                        <span className={styles.txAmount} data-positive={transaction.amount > 0 || undefined}>
                          {transaction.amount > 0 ? "+" : "−"}
                          {formatter.format(Math.abs(transaction.amount))}
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.section>
        </div>
        <p id={hintId} className={styles.srOnly}>
          Arrow keys switch cards. Enter opens a card and Escape puts it back.
        </p>
        <p className={styles.srOnly} aria-live="polite">
          {current
            ? open
              ? `${current.issuer} ${current.product} open`
              : `${current.issuer} ${current.product} in front, ${selectedIndex + 1} of ${count}`
            : ""}
        </p>
      </div>
    </MotionConfig>
  );
}

export default WalletStack;
