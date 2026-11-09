"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Check } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./orbit-menu.module.css";

const { spring, duration, ease, blur, stagger } = motionTokens;
const EASE_ENTER: [number, number, number, number] = [...ease.enter];
const EASE_STANDARD: [number, number, number, number] = [...ease.standard];

/** Duration + bounce → a real spring, so `visualDuration` means what it says. */
function springOf(visualDuration: number, bounce: number) {
  const omega = (2 * Math.PI) / (1.2 * visualDuration);
  return { type: "spring" as const, stiffness: omega * omega, damping: 2 * (1 - bounce) * omega, mass: 1 };
}

const SPRING_SNAPPY = springOf(spring.snappy.visualDuration, spring.snappy.bounce);
const SPRING_MORPH = springOf(spring.morph.visualDuration, spring.morph.bounce);
const SPRING_ITEM_OPEN = springOf(0.5, 0);
const SPRING_ITEM_CLOSE = springOf(0.32, 0);
const SPRING_BLUR_OUT = springOf(0.34, 0);
const SPRING_LENS = springOf(0.2, 0);
const INSTANT = { duration: 0 };

const GLYPHS = {
  more: { a: [6, 12, 6.01, 12], b: [18, 12, 18.01, 12], c: [12, 12, 12.01, 12], width: 3.2, rotate: 0 },
  close: { a: [7, 7, 17, 17], b: [17, 7, 7, 17], c: [12, 12, 12.01, 12], width: 2, rotate: 90 },
  done: { a: [5.5, 12.5, 10, 17], b: [18.5, 7, 10, 17], c: [10, 17, 10.01, 17], width: 2.2, rotate: 0 },
} as const;

type GlyphName = keyof typeof GLYPHS;

const toRad = (degrees: number) => (degrees * Math.PI) / 180;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
/** Lens pull: the button leans toward the pointer without crossing it. */
const pull = (distance: number, amount: number, cap = 0.55) => (distance * amount * cap) / (amount + cap * distance);
const polar = (radius: number, angle: number): [number, number] => [Math.cos(angle) * radius, Math.sin(angle) * radius];

function arcPath(radius: number, from: number, to: number) {
  if (radius < 0.5) return "M0 0";
  const [x1, y1] = polar(radius, from);
  const [x2, y2] = polar(radius, to);
  const largeArc = Math.abs(to - from) > Math.PI ? 1 : 0;
  const sweep = to > from ? 1 : 0;
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${radius.toFixed(2)} ${radius.toFixed(2)} 0 ${largeArc} ${sweep} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

interface Field {
  strength: number;
  dx: number;
  dy: number;
  distance: number;
}

/** Smoothstep falloff, so the magnet is dead quiet outside ~92px. */
function fieldAt(px: number, py: number, cx: number, cy: number): Field {
  const dx = px - cx;
  const dy = py - cy;
  const distance = Math.hypot(dx, dy);
  const falloff = clamp01(1 - distance / 92);
  return { strength: falloff * falloff * (3 - 2 * falloff), dx, dy, distance };
}

function magnet(field: Field, allow: number): [number, number] {
  if (field.distance < 0.01) return [0, 0];
  const amount = Math.min(0.2 * field.distance, 14) * field.strength * allow;
  return [(field.dx / field.distance) * amount, (field.dy / field.distance) * amount];
}

export type OrbitMenuTone = "neutral" | "danger";

export interface OrbitMenuAction {
  /** Stable id handed back to `onAction`. */
  id: string;
  /** Accessible name, and the pill text while the action is the drag target. */
  label: string;
  icon?: ReactNode;
  /** Pill text shown after the action fires. Defaults to `label`. */
  done?: string;
  tone?: OrbitMenuTone;
}

export interface OrbitMenuProps {
  actions: OrbitMenuAction[];
  onAction?: (id: string) => void;
  label?: string;
  /** Distance from the trigger centre to the action ring, in px. */
  radius?: number;
  /** Total arc the actions fan across, in degrees. */
  spread?: number;
  /** Where the middle of the arc points, in degrees (`-90` is straight up). */
  direction?: number;
  disabled?: boolean;
  /** Mirror the fired action's pill text into a polite live region. */
  announce?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

function Glyph({ glyph, reduced }: { glyph: GlyphName; reduced: boolean }) {
  const variant = GLYPHS[glyph];
  return (
    <motion.svg
      className={styles.glyph}
      viewBox="0 0 24 24"
      aria-hidden="true"
      initial={false}
      animate={{ rotate: variant.rotate }}
      transition={reduced ? INSTANT : SPRING_MORPH}
    >
      <motion.line
        initial={false}
        animate={{ x1: variant.a[0], y1: variant.a[1], x2: variant.a[2], y2: variant.a[3], strokeWidth: variant.width }}
        transition={reduced ? INSTANT : SPRING_MORPH}
      />
      <motion.line
        initial={false}
        animate={{ x1: variant.b[0], y1: variant.b[1], x2: variant.b[2], y2: variant.b[3], strokeWidth: variant.width }}
        transition={reduced ? INSTANT : SPRING_MORPH}
      />
      <motion.line
        initial={false}
        animate={{ x1: variant.c[0], y1: variant.c[1], x2: variant.c[2], y2: variant.c[3], strokeWidth: variant.width }}
        transition={reduced ? INSTANT : SPRING_MORPH}
      />
    </motion.svg>
  );
}

interface ItemProps {
  action: OrbitMenuAction;
  index: number;
  count: number;
  angle: number;
  radius: number;
  open: boolean;
  active: boolean;
  fired: boolean;
  focusable: boolean;
  reduced: boolean;
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
  engaged: MotionValue<number>;
  allow: MotionValue<number>;
  setRef: (node: HTMLButtonElement | null, index: number) => void;
  onFire: (index: number) => void;
  onFocus: (index: number) => void;
  onKey: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
}

function OrbitItem({
  action,
  index,
  count,
  angle,
  radius,
  open,
  active,
  fired,
  focusable,
  reduced,
  pointerX,
  pointerY,
  engaged,
  allow,
  setRef,
  onFire,
  onFocus,
  onKey,
}: ItemProps) {
  const progress = useMotionValue(0);
  const fade = useMotionValue(0);
  const activeValue = useMotionValue(0);
  const firedPop = useMotionValue(1);

  const [anchorX, anchorY] = polar(radius, angle);

  const x = useTransform(() => {
    const p = progress.get();
    const swing = angle - (1 - p) * 0.75 * allow.get();
    const field = fieldAt(pointerX.get(), pointerY.get(), anchorX, anchorY);
    return Math.cos(swing) * radius * p + magnet(field, engaged.get() * allow.get() * clamp01(p))[0];
  });

  const y = useTransform(() => {
    const p = progress.get();
    const swing = angle - (1 - p) * 0.75 * allow.get();
    const field = fieldAt(pointerX.get(), pointerY.get(), anchorX, anchorY);
    return Math.sin(swing) * radius * p + magnet(field, engaged.get() * allow.get() * clamp01(p))[1];
  });

  const scale = useTransform(() => {
    const p = progress.get();
    const field = fieldAt(pointerX.get(), pointerY.get(), anchorX, anchorY);
    const base = 0.4 + 0.6 * p;
    const lean = 1 + 0.32 * field.strength * engaged.get() + 0.1 * activeValue.get();
    return base * lean * firedPop.get();
  });

  const filter = useTransform(() => {
    const amount = (1 - clamp01(progress.get() / 0.6)) * allow.get();
    return amount < 0.01 ? "none" : `blur(${(amount * blur.soft).toFixed(2)}px)`;
  });

  const iconOpacity = useTransform(progress, [0.35, 0.85], [0, 1]);
  const iconScale = useTransform(progress, [0.3, 1], [0.5, 1]);

  useEffect(() => {
    if (reduced) {
      if (open) {
        progress.jump(1);
        animate(fade, 1, { duration: duration.fast, ease: EASE_ENTER });
        return;
      }
      const control = animate(fade, 0, {
        duration: duration.instant,
        ease: EASE_STANDARD,
        delay: fired ? 0.08 : 0,
        onComplete: () => progress.jump(0),
      });
      return () => control.stop();
    }

    const delay = open ? index * stagger.item : fired ? 0.1 : (count - 1 - index) * 0.018;
    const move = animate(progress, open ? 1 : 0, {
      ...(open ? SPRING_ITEM_OPEN : SPRING_ITEM_CLOSE),
      delay,
    });
    const dissolve = animate(fade, open ? 1 : 0, open
      ? { duration: 0.2, ease: EASE_ENTER, delay }
      : { duration: duration.fast, ease: EASE_STANDARD, delay: delay + 0.06 });
    return () => {
      move.stop();
      dissolve.stop();
    };
  }, [open, reduced, index, count, fired, progress, fade]);

  useEffect(() => {
    animate(activeValue, active ? 1 : 0, reduced ? INSTANT : SPRING_SNAPPY);
  }, [active, reduced, activeValue]);

  useEffect(() => {
    if (!fired) return;
    firedPop.jump(0.86);
    animate(firedPop, 1, { type: "spring", stiffness: 700, damping: 51, velocity: 7 });
  }, [fired, firedPop]);

  return (
    <motion.button
      ref={(node) => setRef(node, index)}
      type="button"
      role="menuitem"
      aria-label={action.label}
      tabIndex={focusable ? 0 : -1}
      className={styles.item}
      data-active={active || undefined}
      data-fired={fired || undefined}
      data-danger={action.tone === "danger" || undefined}
      style={{ x, y, scale, opacity: fade, filter }}
      onClick={() => onFire(index)}
      onFocus={() => onFocus(index)}
      onKeyDown={onKey}
    >
      <motion.span className={styles.icon} style={{ opacity: iconOpacity, scale: iconScale }}>
        {action.icon}
      </motion.span>
    </motion.button>
  );
}

interface LensProps {
  angle: number;
  visible: boolean;
  danger: boolean;
  radius: number;
  track: number;
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
  engaged: MotionValue<number>;
  allow: MotionValue<number>;
  reduced: boolean;
}

function Lens({ angle, visible, danger, radius, track, pointerX, pointerY, engaged, allow, reduced }: LensProps) {
  const angleValue = useMotionValue(angle);
  const presence = useMotionValue(0);

  useEffect(() => {
    if (!visible) {
      // The ring closing still needs the lens to travel back to the first slot, otherwise the
      // parked arc keeps the last target's angle (measured: live settles on `angles[0]`).
      if (presence.get() < 0.5) angleValue.jump(angle);
      else animate(angleValue, angle, SPRING_LENS);
      const control = animate(presence, 0, reduced ? { duration: 0.1 } : SPRING_LENS);
      return () => control.stop();
    }
    if (reduced || presence.get() < 0.08) angleValue.jump(angle);
    else animate(angleValue, angle, SPRING_SNAPPY);
    animate(presence, 1, reduced ? { duration: duration.instant, ease: EASE_ENTER } : SPRING_SNAPPY);
  }, [angle, visible, reduced, angleValue, presence]);

  const x = useTransform(() => {
    const field = fieldAt(pointerX.get(), pointerY.get(), ...polar(radius, angleValue.get()));
    return Math.cos(angleValue.get()) * radius * (0.55 + 0.45 * track) + magnet(field, engaged.get() * allow.get())[0];
  });

  const y = useTransform(() => {
    const field = fieldAt(pointerX.get(), pointerY.get(), ...polar(radius, angleValue.get()));
    return Math.sin(angleValue.get()) * radius * (0.55 + 0.45 * track) + magnet(field, engaged.get() * allow.get())[1];
  });

  const scale = useTransform(() => {
    const field = fieldAt(pointerX.get(), pointerY.get(), ...polar(radius, angleValue.get()));
    return (1 - allow.get() * (1 - presence.get())) * (1 + 0.32 * field.strength * engaged.get() + 0.1);
  });

  const opacity = useTransform(() => clamp01(presence.get() * (1 + 3 * allow.get())));

  return <motion.span className={styles.lens} data-danger={danger || undefined} aria-hidden="true" style={{ x, y, scale, opacity }} />;
}

const PILL_VISIBLE = { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" };
const PILL_HIDDEN = { opacity: 0, scale: 0.82, y: 12, filter: `blur(${blur.soft}px)` };

interface PillLabel {
  key: string;
  text: string;
  check: boolean;
}

/**
 * Radial action menu: press the trigger and drag toward an action, or click to keep the ring open
 * and pick with a click or the arrow keys.
 */
export function OrbitMenu({
  actions,
  onAction,
  label = "Actions",
  radius = 104,
  spread = 150,
  direction = -90,
  disabled = false,
  announce = true,
  onOpenChange,
  className,
}: OrbitMenuProps) {
  const reduced = useReducedMotion() ?? false;
  const menuId = `orbit-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pointerRecord = useRef<{
    id: number;
    cx: number;
    cy: number;
    sx: number;
    sy: number;
    at: number;
    wasOpen: boolean;
    moved: boolean;
  } | null>(null);
  const hovering = useRef(false);
  const pendingFocus = useRef<number | null>(null);
  const fireCount = useRef(0);
  const pillWasVisible = useRef(false);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  // Slot the lens falls back to when nothing is hovered. Only pointer hit-testing advances it:
  // a keyboard pick leaves the lens on slot 0, a drag towards Delete leaves it parked on slot 4
  // (measured live: 4 of 6 runs park on 4, the other 2 lose the render-phase update).
  const [pointerSlot, setPointerSlot] = useState(0);
  const [cancel, setCancel] = useState(false);
  const [fired, setFired] = useState<{ index: number; key: number; text: string } | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const [pill, setPill] = useState<PillLabel>({ key: "label", text: label, check: false });

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const engaged = useMotionValue(0);
  const allow = useMotionValue(reduced ? 0 : 1);
  const pressScale = useMotionValue(0);
  const pressed = useMotionValue(0);
  const openProgress = useMotionValue(0);
  const pillWidth = useMotionValue(0);

  const isOpen = open && !disabled;

  if (disabled && open) setOpen(false);

  const count = actions.length;
  const step = count < 2 ? Math.PI : toRad(spread) / (count - 1);
  const angles = actions.map((_, index) => toRad(count < 2 ? direction : direction - spread / 2 + (spread * index) / (count - 1)));
  const directionAngle = toRad(direction);

  const engage = (value: boolean) => {
    hovering.current = value;
    animate(engaged, value ? 1 : 0, SPRING_SNAPPY);
  };

  const setOpenState = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  const close = (restoreFocus = true) => {
    const root = rootRef.current;
    const focused = document.activeElement;
    if (restoreFocus && root && focused instanceof HTMLElement && root.contains(focused) && focused !== triggerRef.current) {
      triggerRef.current?.focus({ preventScroll: true });
    }
    hovering.current = false;
    animate(engaged, 0, SPRING_SNAPPY);
    setActive(null);
    setCancel(false);
    setOpenState(false);
  };

  const fire = (index: number) => {
    const action = actions[index];
    if (!action) return;
    fireCount.current += 1;
    setFired({ index, key: fireCount.current, text: action.done ?? action.label });
    close();
    onAction?.(action.id);
  };

  const openAt = (index: number) => {
    setFired(null);
    setOpenState(true);
    setActive(index);
    pendingFocus.current = index;
    setFocusTick((tick) => tick + 1);
  };

  const hitTest = (dx: number, dy: number) => {
    const distance = Math.hypot(dx, dy);
    if (distance < 34 || distance > radius + 76) return null;
    const angle = Math.atan2(dy, dx);
    let best: number | null = null;
    let bestDistance = Infinity;
    angles.forEach((candidate, index) => {
      const delta = Math.abs(Math.atan2(Math.sin(candidate - angle), Math.cos(candidate - angle)));
      if (delta < bestDistance) {
        bestDistance = delta;
        best = index;
      }
    });
    return bestDistance <= step / 2 + 0.2 ? best : null;
  };

  // Open state also drives the arcs and the lens track.
  useEffect(() => {
    animate(openProgress, isOpen ? 1 : 0, reduced ? INSTANT : SPRING_MORPH);
  }, [isOpen, reduced, openProgress]);

  useEffect(() => {
    animate(allow, reduced ? 0 : 1, SPRING_MORPH);
  }, [reduced, allow]);

  useEffect(() => {
    if (!fired) return;
    const timer = window.setTimeout(() => setFired(null), 1400);
    return () => window.clearTimeout(timer);
  }, [fired]);

  // Roving focus follows the active action while the menu is open.
  useEffect(() => {
    if (!isOpen || pendingFocus.current === null) return;
    const node = itemRefs.current[pendingFocus.current];
    pendingFocus.current = null;
    node?.focus({ preventScroll: true });
  }, [isOpen, focusTick]);

  // Escape closes from anywhere; outside pointer downs close too.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  // The pill only takes a new label while the ring is open (`eG` is null when closed in the
  // reference), so the last row — `Liked`, check mark included — stays in the measurer after closing.
  const nextLabel: PillLabel | null = fired
    ? { key: `done-${fired.key}`, text: fired.text, check: true }
    : !isOpen
      ? null
      : active !== null && actions[active]
        ? { key: `target-${active}-${actions[active].label}`, text: actions[active].label, check: false }
        : cancel
          ? { key: "cancel", text: "Release to cancel", check: false }
          : { key: "label", text: label, check: false };

  useEffect(() => {
    if (!nextLabel) return;
    setPill((current) =>
      current && current.key === nextLabel.key && current.text === nextLabel.text ? current : nextLabel,
    );
  }, [nextLabel?.key, nextLabel?.text, nextLabel]);

  const pillVisible = isOpen || fired !== null;

  useEffect(() => {
    const width = (measureRef.current?.offsetWidth ?? 0) + 2;
    if (!width) return;
    if (!pillWasVisible.current || reduced) pillWidth.jump(width);
    else animate(pillWidth, width, SPRING_MORPH);
    pillWasVisible.current = pillVisible;
  }, [pillVisible, pill?.key, pill?.text, reduced, pillWidth]);

  const [lensX, lensY] = polar(radius * 0.5, directionAngle);

  const triggerX = useTransform(() => {
    const px = pointerX.get();
    const py = pointerY.get();
    const distance = Math.hypot(px, py);
    if (distance < 0.01) return 0;
    return (px / distance) * pull(distance, 26) * pressed.get() * allow.get();
  });
  const triggerY = useTransform(() => {
    const px = pointerX.get();
    const py = pointerY.get();
    const distance = Math.hypot(px, py);
    if (distance < 0.01) return 0;
    return (py / distance) * pull(distance, 26) * pressed.get() * allow.get();
  });
  const triggerScale = useTransform(
    () => (1 - 0.08 * pressScale.get()) * (1 - 0.06 * clamp01(openProgress.get())),
  );

  const pathLength = useTransform(openProgress, (value) => clamp01(value));
  const trackOpacity = useTransform(openProgress, (value) => clamp01(1.6 * value));
  const trackRadius = radius * (isOpen ? 1 : 0.5);

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || event.button !== 0 || pointerRecord.current) return;
    const bounds = rootRef.current?.getBoundingClientRect();
    if (!bounds) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const cx = bounds.left + bounds.width / 2;
    const cy = bounds.top + bounds.height / 2;
    pointerRecord.current = {
      id: event.pointerId,
      cx,
      cy,
      sx: event.clientX,
      sy: event.clientY,
      at: event.timeStamp,
      wasOpen: open,
      moved: false,
    };
    pointerX.set(event.clientX - cx);
    pointerY.set(event.clientY - cy);
    animate(pressScale, 1, SPRING_SNAPPY);
    animate(pressed, 1, SPRING_SNAPPY);
    engage(true);
    setActive(null);
    if (!open) {
      setFired(null);
      setOpenState(true);
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const record = pointerRecord.current;
    if (record && record.id === event.pointerId) {
      const dx = event.clientX - record.cx;
      const dy = event.clientY - record.cy;
      pointerX.set(dx);
      pointerY.set(dy);
      if (Math.hypot(event.clientX - record.sx, event.clientY - record.sy) > 8) record.moved = true;
      const hit = hitTest(dx, dy);
      setActive(hit);
      if (hit !== null) setPointerSlot(hit);
      setCancel(record.moved && hit === null);
      return;
    }
    if ((isOpen || hovering.current) && event.pointerType !== "touch") {
      const bounds = rootRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const dx = event.clientX - (bounds.left + bounds.width / 2);
      const dy = event.clientY - (bounds.top + bounds.height / 2);
      pointerX.set(dx);
      pointerY.set(dy);
      if (!hovering.current) engage(true);
      const hit = hitTest(dx, dy);
      setActive(hit);
      if (hit !== null) setPointerSlot(hit);
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const record = pointerRecord.current;
    if (!record || record.id !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointerRecord.current = null;
    setCancel(false);
    animate(pressScale, 0, SPRING_SNAPPY);
    animate(pressed, 0, SPRING_BLUR_OUT);
    engage(false);

    if (cancel) {
      close(false);
      return;
    }
    if (record.moved) {
      const hit = hitTest(event.clientX - record.cx, event.clientY - record.cy);
      if (hit !== null) fire(hit);
      else close(false);
      return;
    }
    if (event.timeStamp - record.at < 350 && !record.wasOpen) {
      setActive(null);
      return;
    }
    close(false);
  };

  const onItemKey = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const current = active ?? 0;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (current + 1) % count;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (current - 1 + count) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    else if (event.key === "Tab") {
      close();
      return;
    }
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    itemRefs.current[next]?.focus({ preventScroll: true });
  };

  return (
    <div
      ref={rootRef}
      className={className ? `${styles.root} ${className}` : styles.root}
      data-open={open || undefined}
      style={{ "--orbit-reach": `${radius + 60}px` } as CSSProperties}
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        if (pointerRecord.current || !hovering.current) return;
        engage(false);
        pointerX.set(0);
        pointerY.set(0);
        if (isOpen) setActive(null);
      }}
    >
      <div className={styles.field} aria-hidden="true" onPointerDown={() => close(false)} />
      {count > 1 && (
        <svg className={styles.track} width="1" height="1" aria-hidden="true">
          <motion.path d={arcPath(trackRadius, directionAngle, angles[0])} style={{ pathLength, opacity: trackOpacity }} />
          <motion.path d={arcPath(trackRadius, directionAngle, angles[count - 1])} style={{ pathLength, opacity: trackOpacity }} />
        </svg>
      )}
      <Lens
        angle={angles[active ?? pointerSlot] ?? angles[0]}
        visible={isOpen && active !== null}
        danger={actions[active ?? pointerSlot]?.tone === "danger"}
        radius={radius}
        track={isOpen ? 1 : 0}
        pointerX={pointerX}
        pointerY={pointerY}
        engaged={engaged}
        allow={allow}
        reduced={reduced}
      />
      <motion.button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        data-open={open || undefined}
        disabled={disabled}
        style={{ x: triggerX, y: triggerY, scale: triggerScale }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onKeyDown={(event) => {
          if (event.key.startsWith("Arrow")) {
            event.preventDefault();
            if (!count) return;
            openAt(event.key === "ArrowUp" ? count - 1 : 0);
          }
        }}
        onClick={(event) => {
          if (event.detail !== 0) return;
          if (open) close();
          else if (count) openAt(0);
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
        <Glyph glyph={fired ? "done" : open ? "close" : "more"} reduced={reduced} />
      </motion.button>
      <div id={menuId} role="menu" aria-label={label} aria-orientation="horizontal" className={styles.menu} inert={!open}>
        {actions.map((action, index) => (
          <OrbitItem
            key={action.id}
            action={action}
            index={index}
            count={count}
            angle={angles[index]}
            radius={radius}
            open={isOpen}
            active={active === index}
            fired={fired?.index === index}
            focusable={(active ?? 0) === index}
            reduced={reduced}
            pointerX={pointerX}
            pointerY={pointerY}
            engaged={engaged}
            allow={allow}
            setRef={(node, itemIndex) => {
              itemRefs.current[itemIndex] = node;
            }}
            onFire={fire}
            onFocus={(itemIndex) => setActive(itemIndex)}
            onKey={onItemKey}
          />
        ))}
      </div>
      <div
        className={styles.pillAnchor}
        style={{ left: `calc(50% + ${lensX}px)`, top: `calc(50% + ${lensY}px)` }}
        aria-hidden="true"
      >
        <span ref={measureRef} className={`${styles.pillRow} ${styles.measure}`}>
          {pill.check && <Check size={15} strokeWidth={2.25} />}
          <span>{pill.text}</span>
        </span>
        <motion.div
          className={styles.pill}
          style={{ width: pillWidth }}
          initial={false}
          animate={pillVisible ? PILL_VISIBLE : PILL_HIDDEN}
          transition={
            pillVisible
              ? { default: SPRING_SNAPPY, opacity: { duration: 0.2, ease: EASE_ENTER }, filter: { duration: 0.22, ease: EASE_ENTER } }
              : { default: { duration: duration.exit, ease: EASE_STANDARD }, opacity: { duration: duration.exit, ease: EASE_STANDARD } }
          }
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={pill.key}
              className={styles.pillRow}
              initial={{ opacity: 0, y: "0.4em", filter: `blur(${blur.soft}px)` }}
              animate={{ opacity: 1, y: "0em", filter: "blur(0px)" }}
              exit={{ opacity: 0, y: "-0.4em", filter: `blur(${blur.subtle}px)`, transition: { duration: 0.14, ease: EASE_STANDARD } }}
              transition={{ duration: 0.22, ease: EASE_ENTER }}
            >
              {pill.check && <Check size={15} strokeWidth={2.25} />}
              <span>{pill.text}</span>
            </motion.span>
          </AnimatePresence>
        </motion.div>
      </div>
      {announce && (
        <span role="status" className={styles.srOnly}>
          {fired?.text ?? ""}
        </span>
      )}
    </div>
  );
}

export default OrbitMenu;
