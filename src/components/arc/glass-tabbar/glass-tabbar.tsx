"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform, useVelocity } from "motion/react";
import type { MotionValue, Transition } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./glass-tabbar.module.css";

export interface GlassTabBarItem {
  value: string;
  label: string;
  icon: ReactNode;
  /** A count shown on the icon; the value is also read out as ", N new". */
  badge?: number | string;
}

export interface GlassTabBarProps {
  items: GlassTabBarItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** A single round button after the tabs, such as search. It joins the tab list as the last stop. */
  action?: GlassTabBarItem;
  compact?: boolean;
  defaultCompact?: boolean;
  onCompactChange?: (compact: boolean) => void;
  /** The scrolling element that collapses the bar; defaults to the page. */
  scrollRef?: RefObject<HTMLElement | null>;
  collapseOnScroll?: boolean;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const morph = motionTokens.spring.morph;
const smooth = motionTokens.spring.smooth;
/** A drag tracks the finger almost exactly; the bar is not a spring toy. */
const track = { type: "spring", stiffness: 900, damping: 64 } as const;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface TabItemProps {
  item: GlassTabBarItem;
  index: number;
  selected: boolean;
  focusable: boolean;
  slot: MotionValue<number>;
  height: MotionValue<number>;
  pos: MotionValue<number>;
  lift: MotionValue<number>;
  presence: MotionValue<number>;
  compact: MotionValue<number>;
  buttonRef: (node: HTMLButtonElement | null) => void;
  onSelect: () => void;
}

/** One tab: the icon rises and grows, and the label fades and sinks, as the glass lens arrives. */
function TabItem({ item, index, selected, focusable, slot, height, pos, lift, presence, compact, buttonRef, onSelect }: TabItemProps) {
  // How much of the lens is over this tab: full at the active index, fading out one slot away.
  const tint = useTransform(() => presence.get() * Math.max(0, 1 - Math.abs(pos.get() - index)));
  const color = useTransform(tint, amount => `color-mix(in oklab, var(--glass-active) ${Math.round(100 * amount)}%, var(--glass-ink))`);
  const iconScale = useTransform(() => 1 + tint.get() * lift.get() * 0.1);
  const iconY = useTransform(compact, value => -8 * (1 - value));
  const labelOpacity = useTransform(compact, value => Math.max(0, 1 - 2.5 * value));
  const labelY = useTransform(compact, value => 5 * value);
  const labelScale = useTransform(compact, value => 1 - 0.12 * value);
  const hasBadge = item.badge !== undefined && item.badge !== "" && item.badge !== 0;

  return <motion.button ref={buttonRef} type="button" role="tab" aria-selected={selected} tabIndex={focusable ? 0 : -1} className={styles.item} style={{ width: slot, height, color }} data-active={selected || undefined} onClick={onSelect}>
    <motion.span className={styles.icon} style={{ y: iconY, scale: iconScale }}>
      {item.icon}
      {hasBadge ? <span className={styles.badge} aria-hidden="true">{item.badge}</span> : null}
    </motion.span>
    <motion.span className={styles.label} style={{ opacity: labelOpacity, y: labelY, scale: labelScale }}>{item.label}</motion.span>
    {hasBadge ? <span className={styles.hidden}>{", "}{item.badge}{" new"}</span> : null}
  </motion.button>;
}

/**
 * A floating glass bar of icon tabs with a lens that glides between them, follows a drag, and stretches
 * with its own velocity. It collapses to icons only while the page scrolls down and expands again on the way up.
 */
export function GlassTabBar({
  items,
  value,
  defaultValue,
  onValueChange,
  action,
  compact,
  defaultCompact = false,
  onCompactChange,
  scrollRef,
  collapseOnScroll = true,
  label = "Tabs",
  className,
  style,
}: GlassTabBarProps) {
  const reduceMotion = !!useReducedMotion();
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? items[0]?.value ?? "");
  const [uncontrolledCompact, setUncontrolledCompact] = useState(defaultCompact);
  const current = value ?? uncontrolledValue;
  const collapsed = compact ?? uncontrolledCompact;
  const count = items.length;
  const activeIndex = items.findIndex(item => item.value === current);
  const actionActive = !!action && action.value === current;
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const navRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const select = useCallback((next: string) => {
    if (value === undefined) setUncontrolledValue(next);
    onValueChange?.(next);
  }, [value, onValueChange]);

  const setCollapsed = useCallback((next: boolean) => {
    if (compact === undefined) setUncontrolledCompact(next);
    onCompactChange?.(next);
  }, [compact, onCompactChange]);

  // A slot is as wide as the bar can afford: 78px when there is room, 56px when the labels have to go.
  const slotWidth = useMotionValue(78);
  useEffect(() => {
    const node = navRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const available = entry.contentRect.width - 72 * (action ? 1 : 0) - 8;
      slotWidth.set(Math.floor(clamp(available / Math.max(1, count), 56, 78)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [action, count, slotWidth]);

  const compactProgress = useMotionValue(+!!collapsed);
  const slot = useTransform(() => slotWidth.get() + (48 - slotWidth.get()) * compactProgress.get());
  const barHeight = useTransform(compactProgress, value => 62 - 14 * value);
  const lensHeight = useTransform(barHeight, value => value - 8);

  useEffect(() => {
    if (reduceMotion) {
      compactProgress.set(+!!collapsed);
      return;
    }
    const controls = animate(compactProgress, +!!collapsed, smooth);
    return () => controls.stop();
  }, [collapsed, reduceMotion, compactProgress]);

  const index = useMotionValue(Math.max(0, activeIndex));
  const presence = useMotionValue(+(activeIndex >= 0));
  const press = useMotionValue(0);
  const velocity = useVelocity(index);
  const motionAllowed = useMotionValue(+!reduceMotion);
  useEffect(() => {
    motionAllowed.set(+!reduceMotion);
  }, [reduceMotion, motionAllowed]);

  // Lift drives the glass highlight: a press, and how fast the lens is travelling, thicken it.
  const liftTarget = useTransform(() => motionAllowed.get() * Math.max(press.get(), Math.min(1, Math.abs(velocity.get()) / 4)));
  const lift = useSpring(liftTarget, { stiffness: 420, damping: 38 });
  const stretch = useTransform(() => motionAllowed.get() * Math.min(0.16, 0.022 * Math.abs(velocity.get())));
  const lensX = useTransform(() => 4 + index.get() * slot.get());
  const lensScaleX = useTransform(() => (1 + 0.1 * lift.get() + stretch.get()) * (0.7 + 0.3 * presence.get()));
  const lensScaleY = useTransform(() => (1 + 0.1 * lift.get() - 0.4 * stretch.get()) * (0.7 + 0.3 * presence.get()));

  const indexControls = useRef<ReturnType<typeof animate> | null>(null);
  const presenceControls = useRef<ReturnType<typeof animate> | null>(null);
  const drag = useRef<{ id: number; x0: number; left: number; active: boolean; target: number } | null>(null);
  const justDragged = useRef(false);

  const moveIndex = useCallback((next: number, transition: Transition) => {
    indexControls.current?.stop();
    if (reduceMotion) {
      index.set(next);
      indexControls.current = null;
      return;
    }
    indexControls.current = animate(index, next, transition);
  }, [index, reduceMotion]);

  const showPresence = useCallback((next: boolean) => {
    presenceControls.current?.stop();
    if (reduceMotion) {
      presence.set(+!!next);
      return;
    }
    presenceControls.current = animate(presence, +!!next, next ? motionTokens.spring.snappy : { duration: motionTokens.duration.fast, ease: "easeOut" });
  }, [presence, reduceMotion]);

  useEffect(() => {
    if (activeIndex < 0) {
      showPresence(false);
      return;
    }
    if (drag.current?.active) return;
    if (presence.get() < 0.05) {
      indexControls.current?.stop();
      index.set(activeIndex);
    } else {
      moveIndex(activeIndex, morph);
    }
    showPresence(true);
  }, [activeIndex, index, presence, moveIndex, showPresence]);

  // Scrolling down past a short run of pixels collapses the bar to icons; scrolling back up, or returning to the top, expands it.
  const collapseState = useRef({ compact: collapsed, setCompact: setCollapsed });
  useEffect(() => {
    collapseState.current = { compact: collapsed, setCompact: setCollapsed };
  }, [collapsed, setCollapsed]);
  useEffect(() => {
    if (!collapseOnScroll) return;
    const target = scrollRef?.current ?? window;
    const read = () => (target instanceof Window ? target.scrollY : target.scrollTop);
    let last = read();
    let run = 0;
    const onScroll = () => {
      const next = read();
      const delta = next - last;
      last = next;
      if (delta === 0) return;
      run = Math.sign(delta) === Math.sign(run) ? run + delta : delta;
      const state = collapseState.current;
      if (next < 40) {
        if (state.compact) state.setCompact(false);
        return;
      }
      if (run > 24 && !state.compact) state.setCompact(true);
      else if (run < -24 && state.compact) state.setCompact(false);
    };
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [collapseOnScroll, scrollRef]);

  const choose = (next: string) => {
    if (collapsed) setCollapsed(false);
    if (next !== current) select(next);
  };

  const indexAt = (clientX: number, left: number) => clamp((clientX - left - 4) / slot.get() - 0.5, 0, count - 1);

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    drag.current = null;
    if (!reduceMotion) animate(press, 0, motionTokens.spring.snappy);
    if (!state.active) return;
    justDragged.current = true;
    const next = clamp(Math.round(state.target), 0, count - 1);
    if (event.type === "pointercancel") {
      if (activeIndex >= 0) moveIndex(activeIndex, morph);
      else showPresence(false);
    } else {
      moveIndex(next, morph);
      choose(items[next].value);
    }
  };

  const stops = action ? [...items, action] : items;
  const currentStop = actionActive ? count : activeIndex;
  const focusStop = currentStop >= 0 ? currentStop : 0;

  return <nav ref={navRef} aria-label={label} className={[styles.root, className].filter(Boolean).join(" ")} style={style} data-compact={collapsed || undefined}>
    <div
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      className={styles.group}
      onKeyDown={event => {
        const from = Math.max(0, buttonRefs.current.findIndex(node => node === document.activeElement));
        const step = event.key === "ArrowRight" ? from + 1
          : event.key === "ArrowLeft" ? from - 1
            : event.key === "Home" ? 0
              : event.key === "End" ? stops.length - 1
                : null;
        if (step === null) return;
        event.preventDefault();
        const next = (step + stops.length) % stops.length;
        choose(stops[next].value);
        buttonRefs.current[next]?.focus();
      }}
    >
      <motion.div
        ref={barRef}
        className={styles.bar}
        style={{ height: barHeight }}
        onPointerDown={event => {
          justDragged.current = false;
          if (event.button !== 0 || count < 2 || collapsed || !barRef.current) return;
          const left = barRef.current.getBoundingClientRect().left;
          drag.current = { id: event.pointerId, x0: event.clientX, left, active: false, target: index.get() };
          if (!reduceMotion && activeIndex >= 0 && Math.abs(indexAt(event.clientX, left) - index.get()) < 0.5) animate(press, 0.6, motionTokens.spring.snappy);
        }}
        onPointerMove={event => {
          const state = drag.current;
          if (!state || state.id !== event.pointerId) return;
          if (!state.active) {
            if (Math.abs(event.clientX - state.x0) < 8) return;
            state.active = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            if (!reduceMotion) animate(press, 1, motionTokens.spring.snappy);
            if (activeIndex < 0) {
              indexControls.current?.stop();
              index.set(indexAt(event.clientX, state.left));
              showPresence(true);
            }
          }
          state.target = indexAt(event.clientX, state.left);
          moveIndex(state.target, track);
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className={styles.material} aria-hidden="true" />
        <motion.span
          className={styles.lens}
          aria-hidden="true"
          style={{ x: lensX, width: slot, height: lensHeight, scaleX: lensScaleX, scaleY: lensScaleY, opacity: presence, "--lift": lift } as unknown as CSSProperties}
        />
        {items.map((item, itemIndex) => <TabItem
          key={item.value}
          item={item}
          index={itemIndex}
          selected={itemIndex === activeIndex}
          focusable={itemIndex === focusStop}
          slot={slot}
          height={barHeight}
          pos={index}
          lift={lift}
          presence={presence}
          compact={compactProgress}
          buttonRef={node => { buttonRefs.current[itemIndex] = node; }}
          onSelect={() => {
            if (justDragged.current) {
              justDragged.current = false;
              return;
            }
            choose(item.value);
          }}
        />)}
      </motion.div>
      {action ? <motion.div className={styles.bubble} style={{ width: barHeight, height: barHeight }} data-active={actionActive || undefined}>
        <span className={styles.material} aria-hidden="true" />
        <span className={styles.bubbleLens} aria-hidden="true" />
        <button
          ref={node => { buttonRefs.current[count] = node; }}
          type="button"
          role="tab"
          aria-selected={actionActive}
          aria-label={action.label}
          tabIndex={focusStop === count ? 0 : -1}
          className={styles.bubbleButton}
          onClick={() => choose(action.value)}
        >
          <span className={styles.bubbleIcon}>{action.icon}</span>
        </button>
      </motion.div> : null}
    </div>
  </nav>;
}

export default GlassTabBar;
