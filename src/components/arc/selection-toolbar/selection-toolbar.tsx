"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import type { MotionValue, Transition, Variants } from "motion/react";
import { X } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./selection-toolbar.module.css";

export interface SelectionAction {
  /** Rendered as the button text and used as the React key, so keep labels unique. */
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  /** Paints the button in the danger color and tints its hover and press states. */
  destructive?: boolean;
}

export interface SelectionToolbarProps {
  /** Number of selected items. The bar mounts above 0 and leaves at 0. */
  count: number;
  /** Bulk actions rendered as buttons after the count. */
  actions: SelectionAction[];
  /** Called by the clear button. Reset your selection here. */
  onClear: () => void;
  /** Singular noun; an s is added when count is not 1. */
  noun?: string;
}

const instant: Transition = { duration: motionTokens.duration.instant };
const easeEnter = [...motionTokens.ease.enter] as [number, number, number, number];
const easeStandard = [...motionTokens.ease.standard] as [number, number, number, number];
const easeExit = [...motionTokens.ease.exit] as [number, number, number, number];
const settle: Transition = { duration: motionTokens.duration.standard, ease: easeEnter };

/** Digits roll in the direction of the change; `custom` hands the latest direction to digits already leaving. */
const digitVariants: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: direction > 0 ? "0.6em" : "-0.6em", filter: `blur(${motionTokens.blur.subtle}px)` }),
  rest: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: (direction: number) => ({
    opacity: 0,
    y: direction > 0 ? "-0.6em" : "0.6em",
    filter: `blur(${motionTokens.blur.subtle}px)`,
    transition: { duration: motionTokens.duration.fast, ease: easeStandard },
  }),
};
/** Reduced motion keeps the same geometry but swaps the roll for a plain fade. */
const fadeVariants: Variants = { enter: { opacity: 0 }, rest: { opacity: 1 }, exit: { opacity: 0, transition: instant } };
const pluralIn = { opacity: 0, filter: `blur(${motionTokens.blur.subtle}px)` };
const pluralOut = { ...pluralIn, transition: { duration: motionTokens.duration.fast, ease: easeStandard } };

const barIn = { opacity: 0, y: 10, scale: 0.97 };
const barRest = { opacity: 1, y: 0, scale: 1 };
const barOut = { opacity: 0, y: 6, scale: 0.98, transition: { duration: motionTokens.duration.exit, ease: easeStandard } };

/** The count row is measured, so the slot springs to the new width instead of letting the actions jump. */
function CountDisplay({ count, noun, reduced }: { count: number; noun: string; reduced: boolean }) {
  const [shown, setShown] = useState({ count, dir: 1 });
  if (shown.count !== count) setShown({ count, dir: count > shown.count ? 1 : -1 });
  const rowRef = useRef<HTMLSpanElement>(null);
  const width = useMotionValue<number | "auto">("auto");
  const previous = useRef(count);
  // Width follows the spring only for the 700ms after a count change: a later resize (a font swap, a
  // rotation) snaps instead of sliding the bar around under the pointer.
  const until = useRef(0);
  useLayoutEffect(() => {
    if (previous.current !== count) {
      previous.current = count;
      until.current = performance.now() + 700;
    }
  }, [count]);
  useEffect(() => {
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === "undefined") return;
    let measured = false;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width;
      if (!next || !measured || reduced || performance.now() > until.current) {
        measured = next > 0;
        width.jump(next || "auto");
        return;
      }
      animate(width as MotionValue<number>, next, motionTokens.spring.morph);
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, [reduced, width]);
  const layout: "position" | false = reduced ? false : "position";
  return <motion.span className={styles.countSlot} style={{ width }} aria-hidden="true">
    <span ref={rowRef} className={styles.countRow}>
      <span className={styles.countNumber}>
        <AnimatePresence mode="popLayout" initial={false} custom={shown.dir}>
          <motion.span key={count} className={styles.digits} custom={shown.dir} variants={reduced ? fadeVariants : digitVariants} initial="enter" animate="rest" exit="exit" transition={reduced ? instant : { ...motionTokens.spring.snappy, opacity: settle, filter: settle }}>{count}</motion.span>
        </AnimatePresence>
      </span>
      <motion.span className={styles.words} layout={layout} layoutDependency={count} transition={motionTokens.spring.morph}>
        {` ${noun}`}
        <AnimatePresence mode="popLayout" initial={false}>
          {count !== 1 ? <motion.span key="plural" className={styles.plural} initial={reduced ? { opacity: 0 } : pluralIn} animate={{ opacity: 1, filter: "blur(0px)" }} exit={reduced ? { opacity: 0, transition: { duration: 0 } } : pluralOut} transition={reduced ? instant : settle}>s</motion.span> : null}
        </AnimatePresence>
        <motion.span className={styles.selected} layout={layout} layoutDependency={count} transition={motionTokens.spring.morph}> selected</motion.span>
      </motion.span>
    </span>
  </motion.span>;
}

/**
 * A floating bar that appears while items are selected, showing a rolling count, bulk actions, and a
 * clear button. Position it yourself, for example fixed at the bottom center of the collection.
 */
export function SelectionToolbar({ count, actions, onClear, noun = "item" }: SelectionToolbarProps) {
  const reduced = useReducedMotion() ?? false;
  return <AnimatePresence initial={false}>
    {count > 0 ? <motion.div key="selection-toolbar" className={styles.bar} role="toolbar" aria-label="Selection actions"
      initial={reduced ? { opacity: 0 } : barIn} animate={barRest} exit={reduced ? { opacity: 0, transition: instant } : barOut}
      transition={reduced ? instant : { ...motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast, ease: easeEnter } }}>
      <span className={styles.count}>
        <CountDisplay count={count} noun={noun} reduced={reduced} />
        <span className={styles.srOnly} aria-live="polite">{`${count} ${noun}${count === 1 ? "" : "s"} selected`}</span>
      </span>
      {actions.length > 0 ? <>
        <span className={styles.divider} aria-hidden="true" />
        <div className={styles.actions}>
          {actions.map((action) => <button key={action.label} type="button" className={action.destructive ? styles.destructive : ""} onClick={action.onClick}>
            {action.icon ? <span className={styles.actionIcon} aria-hidden="true">{action.icon}</span> : null}
            {action.label}
          </button>)}
        </div>
      </> : null}
      <button type="button" className={styles.clear} aria-label="Clear selection" onClick={onClear}><X size={15} aria-hidden="true" /></button>
    </motion.div> : null}
  </AnimatePresence>;
}

export default SelectionToolbar;
