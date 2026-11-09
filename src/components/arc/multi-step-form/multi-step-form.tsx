"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import type { MotionValue, Transition, Variants } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./multi-step-form.module.css";

export interface FormStep {
  id: string;
  /** Becomes the fieldset legend and the progress label. */
  title: string;
  description?: string;
  content: ReactNode;
}

export interface MultiStepFormProps {
  /** Steps in order. Renders nothing when empty. */
  steps: FormStep[];
  /** Called when the last step is submitted. */
  onComplete?: () => void;
  /** Submit label on every step except the last. */
  nextLabel?: string;
  /** Submit label on the last step. */
  completeLabel?: string;
  /** Zero-based starting step, clamped to the range. */
  initialStep?: number;
}

const instant: Transition = { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] as [number, number, number, number] };
const settle: Transition = { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] as [number, number, number, number] };

/** Steps travel the way the reader moves: forward from the right, back from the left. */
const stepVariants: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: 20 * direction }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: -20 * direction, transition: { x: motionTokens.spring.smooth, opacity: instant } }),
};
/** The same slide, in label form: the outgoing word leaves the way the new one arrives. */
const labelVariants: Variants = {
  enter: (direction: number = 1) => ({ opacity: 0, y: `${0.3 * direction}em`, filter: `blur(${motionTokens.blur.soft}px)` }),
  center: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: (direction: number = 1) => ({ opacity: 0, y: `${-0.3 * direction}em`, filter: `blur(${motionTokens.blur.subtle}px)`, transition: instant }),
};

/** Crossfades one short value (a step number, a button label) inside a fixed-height box. */
function Swap({ value, direction = 1, reduced, className }: { value: string | number; direction?: number; reduced: boolean; className?: string }) {
  return <span className={`${styles.swap} ${className ?? ""}`} aria-hidden="true">
    <AnimatePresence initial={false} custom={direction}>
      <motion.span key={String(value)} custom={direction} variants={labelVariants} initial={reduced ? false : "enter"} animate="center" exit={reduced ? undefined : "exit"} transition={reduced ? { duration: 0 } : settle}>{value}</motion.span>
    </AnimatePresence>
  </span>;
}

/** The submit button's width springs between "Continue" and "Finish setup" instead of snapping. */
function LabelSwap({ label, reduced }: { label: string; reduced: boolean }) {
  const sizer = useRef<HTMLSpanElement>(null);
  const measured = useRef(0);
  const width = useMotionValue<number | "auto">("auto");
  useEffect(() => {
    const node = sizer.current;
    if (!node) return;
    const observer = new ResizeObserver(() => { measured.current = node.offsetWidth; });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const node = sizer.current;
    const current = width.get();
    const next = node?.offsetWidth ?? 0;
    const from = typeof current === "number" ? current : measured.current;
    measured.current = next;
    // A first paint, a resize, or reduced motion all resolve to "auto": the button simply fits its label.
    if (reduced || !from || !next || Math.abs(from - next) < 1) {
      width.jump("auto");
      return;
    }
    width.jump(from);
    const controls = animate(width as MotionValue<number>, next, { ...motionTokens.spring.morph, onComplete: () => width.jump("auto") });
    return () => controls.stop();
  }, [label, reduced, width]);
  return <span className={styles.morph}>
    <span ref={sizer} className={styles.sizer} aria-hidden="true">{label}</span>
    <motion.span className={styles.morphBox} style={{ width }}><Swap value={label} reduced={reduced} /></motion.span>
    <span className={styles.srOnly}>{label}</span>
  </span>;
}

/**
 * A wizard that shows one fieldset per step with a progress list, Back and Continue actions, and a
 * success state after the last step. Step content is rendered only while active, so keep field
 * values in parent state.
 */
export function MultiStepForm({ steps, onComplete, nextLabel = "Continue", completeLabel = "Finish", initialStep = 0 }: MultiStepFormProps) {
  const [index, setIndex] = useState(Math.min(Math.max(initialStep, 0), Math.max(steps.length - 1, 0)));
  const [direction, setDirection] = useState(1);
  const [complete, setComplete] = useState(false);
  const [height, setHeight] = useState<number | "auto">("auto");
  const legendRef = useRef<HTMLLegendElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef(false);
  const headingId = useId();
  const reduced = useReducedMotion() ?? false;

  // Navigation moves focus with the content: the new legend, or the success heading.
  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    (complete ? headingRef.current : legendRef.current)?.focus();
  }, [complete, index]);

  // The shell follows the rendered step's height, so a shorter step closes the gap instead of leaving a hole.
  const observe = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (!steps.length) return null;
  const step = steps[index];
  const last = index === steps.length - 1;
  const crossfade: Transition = reduced ? { duration: 0 } : { x: motionTokens.spring.smooth, opacity: settle };

  return <form className={styles.form} aria-label="Multi-step form" onSubmit={(event) => {
    event.preventDefault();
    pendingFocus.current = true;
    if (last) {
      setComplete(true);
      onComplete?.();
    } else {
      setDirection(1);
      setIndex((current) => current + 1);
    }
  }}>
    <nav className={styles.progress} aria-label={`Progress: step ${index + 1} of ${steps.length}`}>
      <ol className={styles.progressList}>
        {steps.map((item, position) => <li key={item.id} className={`${styles.progressItem} ${position < index || (complete && position === index) ? styles.complete : ""} ${position === index && !complete ? styles.current : ""}`} aria-current={position === index ? "step" : undefined}>
          <span className={styles.progressMarker} aria-hidden="true">
            <AnimatePresence initial={false}>
              {position < index || (complete && position === index) ? <motion.svg key="done" className={styles.markerGlyph} viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"
                initial={reduced ? false : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={reduced ? undefined : { opacity: 0, scale: 0.6, transition: instant }} transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}>
                <motion.path d="M4 12.5 9 17.5 20 6.5" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={reduced ? { duration: 0 } : { duration: 0.32, ease: [...motionTokens.ease.enter] as [number, number, number, number], delay: 0.04 }} />
              </motion.svg> : <motion.span key="number" className={styles.markerGlyph}
                initial={reduced ? false : { opacity: 0, scale: 0.6, filter: `blur(${motionTokens.blur.subtle}px)` }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={reduced ? undefined : { opacity: 0, scale: 0.6, transition: instant }} transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}>{position + 1}</motion.span>}
            </AnimatePresence>
          </span>
          <span className={styles.progressLabel} data-label={item.title}>{item.title}</span>
        </li>)}
      </ol>
      <span className={styles.progressCount} aria-hidden="true">Step <Swap value={index + 1} direction={direction} reduced={reduced} className={styles.countValue} /> of {steps.length}</span>
      <span className={styles.srOnly} aria-live="polite">Step {index + 1} of {steps.length}</span>
    </nav>
    <motion.div ref={viewportRef} className={styles.viewport} initial={false} animate={{ height }} transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}
      onAnimationStart={() => { if (viewportRef.current) viewportRef.current.dataset.resizing = "true"; }}
      onAnimationComplete={() => { if (viewportRef.current) viewportRef.current.dataset.resizing = "false"; }}>
      <AnimatePresence initial={false} custom={direction}>
        {complete ? <motion.section key="complete" ref={observe} className={styles.success} role="status" aria-labelledby={headingId}
          initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={reduced ? { duration: 0 } : settle}>
          <span className={styles.successIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <motion.path d="M4 12.5 9 17.5 20 6.5" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={reduced ? { duration: 0 } : { duration: 0.4, ease: [...motionTokens.ease.enter] as [number, number, number, number], delay: 0.08 }} />
            </svg>
          </span>
          <motion.h2 id={headingId} ref={headingRef} tabIndex={-1} initial={reduced ? false : { opacity: 0, y: "0.3em", filter: `blur(${motionTokens.blur.soft}px)` }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={reduced ? { duration: 0 } : { ...settle, delay: 0.1 }}>All set</motion.h2>
          <motion.p className={styles.successNote} initial={reduced ? false : { opacity: 0, y: "0.3em" }} animate={{ opacity: 1, y: 0 }} transition={reduced ? { duration: 0 } : { ...settle, delay: 0.1 + motionTokens.stagger.word }}>Your response has been saved.</motion.p>
        </motion.section> : <motion.fieldset key={step.id} ref={observe} className={styles.step} custom={direction} variants={stepVariants}
          initial={reduced ? false : "enter"} animate="center" exit={reduced ? undefined : "exit"} transition={crossfade}>
          <legend ref={legendRef} tabIndex={-1}>{step.title}</legend>
          {step.description ? <p className={styles.description}>{step.description}</p> : null}
          <div className={styles.content}>{step.content}</div>
        </motion.fieldset>}
      </AnimatePresence>
    </motion.div>
    <AnimatePresence initial={false}>
      {!complete ? <motion.div key="actions" className={styles.actionsShell} exit={reduced ? undefined : { opacity: 0, height: 0, overflow: "hidden", transition: { height: motionTokens.spring.smooth, opacity: instant } }}>
        <div className={styles.actions}>
          <button className={styles.back} type="button" disabled={index === 0} onClick={() => {
            pendingFocus.current = true;
            setDirection(-1);
            setIndex((current) => Math.max(0, current - 1));
          }}><ArrowLeft aria-hidden="true" width={16} height={16} /> Back</button>
          <button className={styles.next} type="submit"><LabelSwap label={last ? completeLabel : nextLabel} reduced={reduced} /><ArrowRight aria-hidden="true" width={16} height={16} /></button>
        </div>
      </motion.div> : null}
    </AnimatePresence>
  </form>;
}

export default MultiStepForm;
