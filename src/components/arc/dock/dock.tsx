"use client";

import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, Reorder, animate, motion, useMotionValue, useReducedMotion, useTransform, type Transition } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./dock.module.css";

export interface DockItem {
  /** Stable id; also the value reported through `onValueChange`. */
  id: string;
  /** Spoken name; a group composes its own label from the shown member. */
  label: string;
  icon: ReactNode;
  /** Single key hint shown in the floating label and used as `aria-keyshortcuts` context. */
  shortcut?: string;
  /** Numeric badge, drawn as a rolling odometer. */
  badge?: number;
  /** Members make this item a group: it opens a tray above the bar. */
  items?: DockItem[];
}

export interface DockMove {
  type: "move";
  id: string;
  index: number;
}

export interface DockProps {
  items: DockItem[];
  /** Currently selected id, including ids that live inside a group. */
  value?: string | null;
  onValueChange?: (id: string) => void;
  /** Enables drag reordering and Alt+Arrow moves when provided. */
  onItemsChange?: (items: DockItem[], change: DockMove) => void;
  label?: string;
  className?: string;
}

interface Tip {
  id: string;
  label: string;
  shortcut?: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(100 * value) / 100;

/** Critical-damped-ish spring expressed as a visual duration, so timings read as time. */
function spring(visualDuration: number, bounce: number): Transition {
  const omega = (2 * Math.PI) / (1.2 * visualDuration);
  return { type: "spring", stiffness: omega * omega, damping: 2 * (1 - bounce) * omega, mass: 1, restDelta: 0.001, restSpeed: 0.05 };
}

const TIP_SPRING = spring(0.3, 0);
const OPEN_SPRING = spring(0.42, 0);
const CLOSE_SPRING = spring(0.3, 0);
const NOTCH_SPRING = spring(motionTokens.spring.morph.visualDuration, 0.08);
const INSTANT: Transition = { duration: 0 };
const BAR_HEIGHT = 52;
const OPEN_HEIGHT = 48;
const TRAY_ITEM = 36;
const TRAY_GAP = 4;

const subscribe = () => () => {};
const readMounted = () => true;
const readServerMounted = () => false;

function OdometerDigit({ digit, reduced }: { digit: number; reduced: boolean }) {
  return (
    <span className={styles.digit}>
      <motion.span
        className={styles.column}
        initial={false}
        animate={{ y: `${-(10 * digit)}%` }}
        transition={reduced ? INSTANT : motionTokens.spring.snappy}
      >
        {"0123456789".split("").map((character) => (
          <span key={character}>{character}</span>
        ))}
      </motion.span>
    </span>
  );
}

function Odometer({ count, reduced }: { count: number; reduced: boolean }) {
  const text = count > 99 ? "99" : String(count);
  return (
    <AnimatePresence initial={false}>
      {count > 0 && (
        <motion.span
          key="badge"
          className={styles.badge}
          aria-hidden="true"
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1, width: 10 + 7 * text.length }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.5, transition: { duration: motionTokens.duration.fast } }}
          transition={reduced ? { duration: 0.12 } : { ...motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.fast } }}
        >
          {text
            .split("")
            .map((character, index) => (
              <OdometerDigit key={text.length - index} digit={Number(character)} reduced={reduced} />
            ))}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/** The rounded outline of the bar, with a notch that opens upward for a group's tray. */
function surfacePath(width: number, open: number, notchCentre: number, notchWidth: number) {
  const w = round(width);
  const closed = `M20 0 L${w - 20} 0 A20 20 0 0 1 ${w} 20 L${w} 32 A20 20 0 0 1 ${w - 20} 52 L20 52 A20 20 0 0 1 0 32 L0 20 A20 20 0 0 1 20 0 Z`;
  if (open < 0.5) return closed;
  const corner = Math.min(10, open / 2);
  const span = Math.min(notchWidth, w - 40 - 2 * corner);
  const centre = clamp(notchCentre, 20 + corner + span / 2, w - 20 - corner - span / 2);
  const left = round(centre - span / 2);
  const right = round(centre + span / 2);
  const height = round(open);
  const radius = round(corner);
  const fillet = round(Math.max(0, Math.min(18, height - corner, span / 2)));
  return `M20 0 L${round(left - radius)} 0 Q${left} 0 ${left} ${-radius} L${left} ${round(-height + fillet)} Q${left} ${-height} ${round(left + fillet)} ${-height} L${round(right - fillet)} ${-height} Q${right} ${-height} ${right} ${round(-height + fillet)} L${right} ${-radius} Q${right} 0 ${round(right + radius)} 0 L${w - 20} 0 A20 20 0 0 1 ${w} 20 L${w} 32 A20 20 0 0 1 ${w - 20} 52 L20 52 A20 20 0 0 1 0 32 L0 20 A20 20 0 0 1 20 0 Z`;
}

/**
 * A horizontal tool dock. The selection pill slides between slots, groups grow a rounded
 * notch out of the surface to reveal their tray, and the floating label follows hover,
 * focus and arrow keys. Alt+Arrow (or dragging) reorders when `onItemsChange` is supplied;
 * roving tabindex keeps the whole bar to one tab stop.
 */
export function Dock({ items, value = null, onValueChange, onItemsChange, label = "Tools", className }: DockProps) {
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const mounted = useSyncExternalStore(subscribe, readMounted, readServerMounted);
  const reduced = !!useReducedMotion() && mounted;

  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const trayRefs = useRef(new Map<string, HTMLButtonElement>());
  const draggingRef = useRef(false);
  const previousOpenRef = useRef<string | null>(null);
  const timers = useRef({ show: 0, hide: 0, cool: 0, warm: false });

  const [barWidth, setBarWidth] = useState(44 * items.length + 12);
  const [focusId, setFocusId] = useState(items[0]?.id ?? "");
  const [openId, setOpenId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [requestedTip, setRequestedTip] = useState<Tip | null>(null);
  const [shownTip, setShownTip] = useState<Tip | null>(null);
  // The floating label keeps its last text while it fades out: the popLayout row stays mounted
  // and only the opacity motion value tracks the requested tip, so the hidden label still
  // occupies a measurable box.
  if (requestedTip && requestedTip !== shownTip) setShownTip(requestedTip);
  const [shownMember, setShownMember] = useState<Record<string, string>>({});

  const [lastOpenId, setLastOpenId] = useState<string | null>(null);
  if (openId && openId !== lastOpenId) setLastOpenId(openId);

  const shownOf = (item: DockItem) =>
    item.items?.find((member) => member.id === value) ?? item.items?.find((member) => member.id === shownMember[item.id]) ?? item.items?.[0];

  const selectedOwnerId = items.find((item) => item.id === value || item.items?.some((member) => member.id === value))?.id ?? null;

  const openGroup = items.find((item) => item.id === lastOpenId && item.items?.length);
  const members = openGroup?.items ?? [];
  const trayWidth = TRAY_ITEM * members.length + TRAY_GAP * Math.max(0, members.length - 1) + 12;

  const open = useMotionValue(0);
  const notchX = useMotionValue(0);
  const notchW = useMotionValue(40);
  const width = useMotionValue(barWidth);

  const surface = useTransform(() => surfacePath(width.get(), open.get(), notchX.get(), notchW.get()));
  const trayOpacity = useTransform(open, (v) => clamp((v / OPEN_HEIGHT - 0.45) / 0.4, 0, 1));
  const trayX = useTransform(
    () => clamp(notchX.get(), 30 + notchW.get() / 2, width.get() - 20 - 10 - notchW.get() / 2) - trayWidth / 2,
  );

  const tipX = useMotionValue(0);
  const tipY = useMotionValue(0);
  const tipWidth = useMotionValue(0);
  const tipOpacity = useMotionValue(0);
  const tipTransform = useTransform(
    () =>
      `translate3d(${round(tipX.get() - tipWidth.get() / 2)}px, ${round(tipY.get() + (1 - tipOpacity.get()) * (4 * Number(!reduced)))}px, 0) scale(${round(reduced ? 1 : 0.96 + 0.04 * tipOpacity.get())})`,
  );

  function placeTip(id: string, next: Tip, inTray: boolean) {
    const node = (inTray ? trayRefs : itemRefs).current.get(id);
    const root = rootRef.current;
    if (!node || !root) return;
    const rect = node.getBoundingClientRect();
    const base = root.getBoundingClientRect();
    const centre = rect.left - base.left + rect.width / 2;
    const y = (inTray || previousOpenRef.current ? -OPEN_HEIGHT : 0) - 10;
    if (tipOpacity.get() > 0.05 && !reduced) {
      animate(tipX, centre, TIP_SPRING);
      animate(tipY, y, TIP_SPRING);
    } else {
      tipX.jump(centre);
      tipY.jump(y);
    }
    setRequestedTip(next);
  }

  function showTip(item: DockItem, inTray: boolean, immediate = false) {
    if (draggingId) return;
    const state = timers.current;
    window.clearTimeout(state.hide);
    window.clearTimeout(state.show);
    const next: Tip = { id: item.id, label: item.label, shortcut: item.shortcut };
    if (immediate || tipOpacity.get() > 0.05 || state.warm) placeTip(item.id, next, inTray);
    else state.show = window.setTimeout(() => placeTip(item.id, next, inTray), 380);
  }

  function hideTip(delay = 90) {
    const state = timers.current;
    window.clearTimeout(state.show);
    window.clearTimeout(state.hide);
    state.hide = window.setTimeout(() => {
      state.warm = true;
      window.clearTimeout(state.cool);
      state.cool = window.setTimeout(() => {
        state.warm = false;
      }, 700);
      setRequestedTip(null);
    }, delay);
  }

  function choose(item: DockItem, group?: DockItem) {
    hideTip(0);
    if (group) {
      setShownMember((current) => ({ ...current, [group.id]: item.id }));
      setOpenId(null);
      itemRefs.current.get(group.id)?.focus({ preventScroll: true });
    }
    onValueChange?.(item.id);
  }

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const measure = () => {
      setBarWidth(bar.offsetWidth);
      width.set(bar.offsetWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [width]);

  // Opening grows the surface upward around the group's slot; closing collapses it back.
  useEffect(() => {
    if (!openId) {
      if (reduced) {
        open.jump(0);
        return;
      }
      const controls = animate(open, 0, CLOSE_SPRING);
      return () => controls.stop();
    }
    const button = itemRefs.current.get(openId);
    const bar = barRef.current;
    if (!button || !bar) return;
    const rect = button.getBoundingClientRect();
    const base = bar.getBoundingClientRect();
    const centre = rect.left - base.left + rect.width / 2;
    if (reduced) {
      notchX.jump(centre);
      notchW.jump(trayWidth);
      open.jump(OPEN_HEIGHT);
      return;
    }
    if (open.get() < 1) {
      notchX.jump(centre);
      notchW.jump(40);
    }
    const grow = animate(open, OPEN_HEIGHT, OPEN_SPRING);
    const slide = animate(notchX, centre, OPEN_SPRING);
    const widen = animate(notchW, trayWidth, NOTCH_SPRING);
    return () => {
      grow.stop();
      slide.stop();
      widen.stop();
    };
  }, [notchW, notchX, openId, open, reduced, trayWidth]);

  useEffect(() => {
    previousOpenRef.current = openId;
  }, [openId]);

  useLayoutEffect(() => {
    const node = measureRef.current;
    if (!node || !shownTip) return;
    const next = node.offsetWidth;
    if (reduced || tipOpacity.get() <= 0.05) {
      tipWidth.jump(next);
      return;
    }
    const controls = animate(tipWidth, next, NOTCH_SPRING);
    return () => controls.stop();
  }, [reduced, shownTip, tipOpacity, tipWidth]);

  useEffect(() => {
    const controls = animate(
      tipOpacity,
      requestedTip ? 1 : 0,
      reduced ? { duration: 0.12 } : requestedTip ? spring(0.22, 0) : { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.standard] as [number, number, number, number] },
    );
    return () => controls.stop();
  }, [reduced, requestedTip, tipOpacity]);

  useEffect(() => {
    const state = timers.current;
    return () => {
      window.clearTimeout(state.show);
      window.clearTimeout(state.hide);
      window.clearTimeout(state.cool);
    };
  }, []);

  const onDocument = useEffectEvent((event: Event) => {
    if (event instanceof KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpenId(null);
      if (openId && rootRef.current?.contains(document.activeElement)) itemRefs.current.get(openId)?.focus({ preventScroll: true });
      return;
    }
    if (!rootRef.current?.contains(event.target as Node)) setOpenId(null);
  });

  useEffect(() => {
    if (!openId) return;
    const handler = (event: Event) => onDocument(event);
    document.addEventListener("pointerdown", handler, true);
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("pointerdown", handler, true);
      document.removeEventListener("keydown", handler);
    };
  }, [openId]);

  const announceIfFocused = (node: HTMLButtonElement, item: DockItem, inTray: boolean) => {
    if (node.matches(":focus-visible")) showTip(item, inTray, true);
  };

  const reorderTransition: Transition = reduced ? INSTANT : motionTokens.spring.smooth;
  const selectionTransition: Transition = reduced ? INSTANT : spring(motionTokens.spring.snappy.visualDuration + 0.08, 0.1);
  const tipRowInitial = reduced ? { opacity: 0 } : { opacity: 0, y: "0.35em", filter: `blur(${motionTokens.blur.subtle}px)` };

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={{ "--dock-item": "40px", "--dock-pad": "6px", "--dock-gap": "4px", "--dock-tray-item": "36px", "--dock-tray-pad": "6px" } as CSSProperties}
      data-dragging={draggingId ? "" : undefined}
      onPointerLeave={() => hideTip(140)}
    >
      <svg className={styles.surface} width={barWidth} height={BAR_HEIGHT} aria-hidden="true">
        <motion.path d={surface} />
      </svg>

      {openGroup && (
        <motion.div
          id={`${uid}-tray`}
          role="group"
          aria-label={openGroup.label}
          className={styles.tray}
          data-open={openId === openGroup.id || undefined}
          inert={openId !== openGroup.id}
          style={{ x: trayX, opacity: trayOpacity, width: trayWidth }}
        >
          {members.map((member, index) => (
            <motion.button
              key={member.id}
              ref={(node) => {
                if (node) trayRefs.current.set(member.id, node);
                else trayRefs.current.delete(member.id);
              }}
              type="button"
              className={styles.trayItem}
              aria-pressed={member.id === value}
              aria-label={member.shortcut ? `${member.label}, ${member.shortcut}` : member.label}
              tabIndex={member.id === shownOf(openGroup)?.id ? 0 : -1}
              initial={reduced ? false : { opacity: 0, y: 8, scale: 0.9 }}
              animate={openId === openGroup.id || reduced ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 6, scale: 0.92 }}
              transition={
                reduced
                  ? INSTANT
                  : openId === openGroup.id
                    ? { ...motionTokens.spring.snappy, delay: 0.08 + index * motionTokens.stagger.item }
                    : { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] as [number, number, number, number] }
              }
              onClick={() => choose(member, openGroup)}
              onKeyDown={(event) => {
                const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
                if (event.key === "ArrowDown" || event.key === "Tab") {
                  if (event.key === "ArrowDown") event.preventDefault();
                  setOpenId(null);
                  if (openId && event.key === "ArrowDown") itemRefs.current.get(openId)?.focus({ preventScroll: true });
                  return;
                }
                if (!step) return;
                event.preventDefault();
                const next = members[(index + step + members.length) % members.length];
                trayRefs.current.get(next.id)?.focus({ preventScroll: true });
                showTip(next, true, true);
              }}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") showTip(member, true);
              }}
              onPointerLeave={() => hideTip()}
              onFocus={(event) => announceIfFocused(event.currentTarget, member, true)}
              onBlur={() => hideTip()}
            >
              <span className={styles.icon}>{member.icon}</span>
            </motion.button>
          ))}
        </motion.div>
      )}

      <LayoutGroup id={uid}>
        <Reorder.Group
          as="div"
          ref={barRef}
          axis="x"
          values={items}
          role="toolbar"
          aria-label={label}
          aria-orientation="horizontal"
          className={styles.bar}
          onReorder={(next) => {
            if (!onItemsChange || !draggingId) return;
            const index = next.findIndex((item) => item.id === draggingId);
            onItemsChange(next, { type: "move", id: draggingId, index });
          }}
        >
          {items.map((item, index) => {
            const isGroup = !!item.items?.length;
            const shown = isGroup ? (shownOf(item) ?? item) : item;
            const selected = selectedOwnerId === item.id;
            const spoken: DockItem = isGroup
              ? { ...item, label: shown.label === item.label ? item.label : `${item.label}: ${shown.label}`, shortcut: shown.shortcut ?? item.shortcut }
              : item;
            return (
              <Reorder.Item
                as="div"
                key={item.id}
                value={item}
                className={styles.slot}
                drag={onItemsChange ? "x" : false}
                dragConstraints={barRef}
                dragElastic={0.14}
                layout="position"
                transition={reorderTransition}
                whileDrag={reduced ? undefined : { scale: 1.12, zIndex: 3 }}
                onDragStart={() => {
                  draggingRef.current = true;
                  setDraggingId(item.id);
                  setOpenId(null);
                  setRequestedTip(null);
                  window.clearTimeout(timers.current.show);
                }}
                onDragEnd={() => {
                  setDraggingId(null);
                  requestAnimationFrame(() => {
                    draggingRef.current = false;
                  });
                }}
              >
                {selected && (
                  <motion.span
                    layoutId={`${uid}-selection`}
                    className={styles.selection}
                    style={{ borderRadius: 14 }}
                    transition={selectionTransition}
                    aria-hidden="true"
                  />
                )}
                <button
                  ref={(node) => {
                    if (node) itemRefs.current.set(item.id, node);
                    else itemRefs.current.delete(item.id);
                  }}
                  type="button"
                  className={styles.item}
                  data-selected={selected || undefined}
                  data-open={openId === item.id || undefined}
                  aria-pressed={isGroup ? undefined : selected}
                  aria-haspopup={isGroup ? "true" : undefined}
                  aria-expanded={isGroup ? openId === item.id : undefined}
                  aria-controls={isGroup && openId === item.id ? `${uid}-tray` : undefined}
                  aria-label={`${spoken.label}${spoken.shortcut ? `, ${spoken.shortcut}` : ""}${item.badge ? `, ${item.badge}` : ""}${isGroup && selected ? ", selected" : ""}`}
                  tabIndex={focusId !== item.id && (items.some((entry) => entry.id === focusId) || index !== 0) ? -1 : 0}
                  onClick={() => {
                    if (draggingRef.current) {
                      draggingRef.current = false;
                      return;
                    }
                    if (item.items?.length) {
                      hideTip(0);
                      const member = shownOf(item);
                      if (member && member.id !== value) onValueChange?.(member.id);
                      setOpenId((current) => (current === item.id ? null : item.id));
                      return;
                    }
                    setOpenId(null);
                    choose(item);
                  }}
                  onKeyDown={(event) => {
                    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
                    if (step && event.altKey && onItemsChange) {
                      const target = index + step;
                      if (target < 0 || target >= items.length) return;
                      event.preventDefault();
                      const next = [...items];
                      next.splice(index, 1);
                      next.splice(target, 0, item);
                      onItemsChange(next, { type: "move", id: item.id, index: target });
                      // Reordering is announced through the floating label even when the pointer,
                      // not the keyboard, put focus on the item.
                      requestAnimationFrame(() => {
                        const node = itemRefs.current.get(item.id);
                        if (!node) return;
                        node.focus({ preventScroll: true });
                        showTip(item, false, true);
                      });
                      return;
                    }
                    let target = -1;
                    if (step) target = (index + step + items.length) % items.length;
                    else if (event.key === "Home") target = 0;
                    else if (event.key === "End") target = items.length - 1;
                    else if (event.key === "ArrowUp" && item.items?.length) {
                      event.preventDefault();
                      setOpenId(item.id);
                      const member = shownOf(item) ?? item.items[0];
                      requestAnimationFrame(() => {
                        trayRefs.current.get(member.id)?.focus({ preventScroll: true });
                        showTip(member, true, true);
                      });
                      return;
                    }
                    if (target < 0) return;
                    event.preventDefault();
                    setFocusId(items[target].id);
                    itemRefs.current.get(items[target].id)?.focus({ preventScroll: true });
                    showTip(items[target], false, true);
                  }}
                  onFocus={(event) => {
                    setFocusId(item.id);
                    announceIfFocused(event.currentTarget, spoken, false);
                  }}
                  onBlur={() => hideTip()}
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse") showTip(spoken, false);
                  }}
                  onPointerLeave={() => hideTip()}
                >
                  <span className={styles.icon}>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={shown.id}
                        className={styles.glyph}
                        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8, filter: `blur(${motionTokens.blur.subtle}px)` }}
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                        exit={
                          reduced
                            ? { opacity: 0 }
                            : { opacity: 0, scale: 0.8, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.instant } }
                        }
                        transition={reduced ? { duration: 0.12 } : { ...motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.fast } }}
                      >
                        {shown.icon}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                  {isGroup && <span className={styles.caret} aria-hidden="true" />}
                  {item.badge !== undefined && (
                    <span className={styles.badgeAnchor}>
                      <Odometer count={item.badge} reduced={reduced} />
                    </span>
                  )}
                </button>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      </LayoutGroup>

      <motion.div className={styles.tip} style={{ transform: tipTransform, width: tipWidth, opacity: tipOpacity }} aria-hidden="true">
        <span ref={measureRef} className={`${styles.tipRow} ${styles.measure}`}>
          {shownTip?.label}
          {shownTip?.shortcut && <kbd className={styles.kbd}>{shownTip.shortcut}</kbd>}
        </span>
        <AnimatePresence mode="popLayout" initial={false}>
          {shownTip && (
            <motion.span
              className={styles.tipRow}
              initial={tipRowInitial}
              animate={{ opacity: 1, y: "0em", filter: "blur(0px)" }}
              exit={
                reduced
                  ? { opacity: 0, transition: { duration: 0.08 } }
                  : { opacity: 0, y: "-0.35em", filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: 0.12 } }
              }
              transition={reduced ? { duration: 0.12 } : { duration: 0.18, ease: [...motionTokens.ease.enter] as [number, number, number, number] }}
              key={`${shownTip.id}${shownTip.label}`}
            >
              {shownTip.label}
              {shownTip.shortcut && <kbd className={styles.kbd}>{shownTip.shortcut}</kbd>}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default Dock;
