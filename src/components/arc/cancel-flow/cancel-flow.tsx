"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";
import { ArrowLeft, Check, Download, Lock, Minus, Plus, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { Avatar } from "../avatar/avatar";
import { Badge } from "../badge/badge";
import type { BadgeTone } from "../badge/badge";
import { Button } from "../button/button";
import { HoldToConfirm } from "../hold-to-confirm/hold-to-confirm";
import { avatar } from "../lib/media";
import { motionTokens } from "../lib/motion-tokens";
import { Textarea } from "../textarea/textarea";
import styles from "./cancel-flow.module.css";

export interface CancelFlowProps {
  /** Drop the card's border, radius, shadow and fill so the flow sits directly in the page. */
  flat?: boolean;
}

type ReasonId = "price" | "usage" | "feature" | "switching";
type Step = "reason" | "offer" | "confirm" | "cancelled" | "kept";
type ApplyState = "idle" | "applying" | "applied";
type ExportState = "idle" | "working" | "done";
type Outcome = "stayed" | "reactivated";

interface Reason {
  id: ReasonId;
  label: string;
  detail: string;
  prompt: string;
  placeholder: string;
}

interface Offer {
  title: string;
  lead: string;
  figure: { prefix?: string; value: number; decimals?: number; unit: string; was?: string };
  facts: string[];
  accept: string;
  done: {
    title: string;
    lead: string;
    rows: [string, string][];
    badge: string;
    tone: BadgeTone;
    announce: string;
  };
}

const ENTER = [...motionTokens.ease.enter] as [number, number, number, number];
const STANDARD = [...motionTokens.ease.standard] as [number, number, number, number];

const SUPPORT_EMAIL = "sofia@halcyon.studio";
const RESUME_DATES = ["Nov 14, 2026", "Dec 14, 2026", "Jan 14, 2027"];
const STEP_LABELS = ["Reason", "Offer", "Confirm"];
const STEP_INDEX: Record<Step, number> = { reason: 0, offer: 1, confirm: 2, cancelled: 3, kept: 3 };
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

const REASONS: Reason[] = [
  {
    id: "price",
    label: "Too expensive",
    detail: "The cost is hard to justify right now",
    prompt: "What would feel like a fair price for your team?",
    placeholder: "For example, $60 a month would work for us",
  },
  {
    id: "usage",
    label: "Not using it enough",
    detail: "Our work is seasonal or has slowed down",
    prompt: "When do you expect to need it again?",
    placeholder: "For example, after our January launch",
  },
  {
    id: "feature",
    label: "Missing a feature",
    detail: "Something we need isn't there yet",
    prompt: "Which feature would keep you here? Emma from product reads these.",
    placeholder: "For example, client approvals on shared boards",
  },
  {
    id: "switching",
    label: "Moving to another tool",
    detail: "We're consolidating on one product",
    prompt: "Which tool are you moving to?",
    placeholder: "For example, the suite our agency partner uses",
  },
];

const IMPACTS = [
  { Icon: ShieldCheck, title: "Full access until Oct 14, 2026", detail: "The $96 renewal won't be charged.", danger: false },
  { Icon: Lock, title: "Read-only from Oct 14", detail: "All 8 members can still open and export the 42 projects.", danger: false },
  { Icon: Trash2, title: "Deleted on Nov 13, 2026", detail: "Projects, files and history are removed 30 days after the plan ends.", danger: true },
];

const TIMELINE = [
  { date: "Today", title: "Cancellation confirmed", detail: "No more charges. Your team keeps full access for now.", done: true },
  { date: "Oct 14", title: "Workspace turns read-only", detail: "Everyone can still open and export projects.", done: false },
  { date: "Nov 13", title: "Data is deleted", detail: "Reactivate before then to keep all 42 projects.", done: false },
];

const FLAT: CSSProperties = { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" };

/** The offer each reason earns, recomputed whenever the reason, pause length, or note changes. */
function buildOffer(reason: ReasonId, pause: number, note: string): Offer {
  if (reason === "usage") {
    const unit = pause === 1 ? "month" : "months";
    return {
      title: "Pause instead of cancelling",
      lead: "Stop billing while things are quiet. Projects, members and integrations stay exactly where they are.",
      figure: { value: pause, unit },
      facts: [
        `Skips ${pause === 1 ? "the Oct 14 invoice" : `${pause} invoices`}, saving ${currency.format(96 * pause)}`,
        `Billing resumes on ${RESUME_DATES[pause - 1]}`,
        "Resume early any time from Billing",
      ],
      accept: `Pause for ${pause} ${unit}`,
      done: {
        title: `Paused until ${RESUME_DATES[pause - 1].replace(/, \d+$/, "")}`,
        lead: `No charges until ${RESUME_DATES[pause - 1]}. We'll remind ${SUPPORT_EMAIL} a week before billing resumes.`,
        rows: [
          ["Paused from", "Oct 14, 2026"],
          ["Billing resumes", RESUME_DATES[pause - 1]],
          ["Saved while paused", currency.format(96 * pause)],
        ],
        badge: `Paused until ${RESUME_DATES[pause - 1].replace(/, \d+$/, "")}`,
        tone: "info",
        announce: `Plan paused for ${pause} ${unit}. Billing resumes on ${RESUME_DATES[pause - 1]}.`,
      },
    };
  }
  if (reason === "feature") {
    return {
      title: "Tell our product lead what's missing",
      lead: "Emma reads every note and replies within one business day. October is on us while you wait.",
      figure: { prefix: "$", value: 0, unit: "for October", was: "$96" },
      facts: ["Your Oct 14 invoice is waived", "Emma replies by Wednesday, Sep 23", "Early access if it's already on the roadmap"],
      accept: "Claim free month",
      done: {
        title: "October is on us",
        lead: note
          ? "Emma has your note and will reply by Wednesday. Your Oct 14 invoice is waived."
          : "Emma will email you by Wednesday to hear what's missing. Your Oct 14 invoice is waived.",
        rows: [
          ["Oct 14 invoice", "$0.00"],
          ["Note sent to", "Emma Collins"],
          ["Reply by", "Sep 23"],
        ],
        badge: "October waived",
        tone: "success",
        announce: "October invoice waived and your note sent to Emma Collins.",
      },
    };
  }
  if (reason === "switching") {
    return {
      title: "Keep your history on Starter",
      lead: "Moving tools takes a while. Starter keeps every project searchable for less than a third of the price.",
      figure: { prefix: "$", value: 29, unit: "a month", was: "$96" },
      facts: ["All 42 projects and their history stay", "3 editor seats, everyone else becomes a viewer", "Saves $67 a month from Oct 14"],
      accept: "Switch to Starter",
      done: {
        title: "Starter starts on Oct 14",
        lead: "Your team keeps working on Team until then. From Oct 14 the invoice is $29.",
        rows: [
          ["Plan from Oct 14", "Starter"],
          ["New price", "$29 a month"],
          ["Projects kept", "42"],
        ],
        badge: "Starter from Oct 14",
        tone: "info",
        announce: "Moving to Starter on Oct 14 at $29 a month.",
      },
    };
  }
  return {
    title: "Stay for 30% less",
    lead: "Keep every project, seat and integration for $67.20 a month through the end of the year.",
    figure: { prefix: "$", value: 67.2, decimals: 2, unit: "a month", was: "$96" },
    facts: ["Applies to your Oct, Nov and Dec invoices", "Saves $86.40 across the three months", "Returns to $96 a month on Jan 14, 2027"],
    accept: "Apply 30% off",
    done: {
      title: "30% off is applied",
      lead: "Your next three invoices drop to $67.20. Nothing else about your workspace changes.",
      rows: [
        ["Next invoice, Oct 14", "$67.20"],
        ["Discount ends", "Jan 13, 2027"],
        ["Saved in total", "$86.40"],
      ],
      badge: "30% off until Jan 14",
      tone: "success",
      announce: "30% off applied to the next three invoices.",
    },
  };
}

/** Text that blurs and lifts as it is replaced; the outgoing line leaves faster than the new one arrives. */
function SwapText({ children, reduced }: { children: string; reduced: boolean }) {
  return <motion.span
    className={styles.swapText}
    initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.35em", filter: `blur(${motionTokens.blur.soft}px)` }}
    animate={{ opacity: 1, y: "0em", filter: "blur(0px)" }}
    exit={reduced
      ? { opacity: 0, transition: { duration: 0 } }
      : { opacity: 0, y: "-0.3em", filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.fast, ease: STANDARD } }}
    transition={reduced ? { duration: 0 } : { duration: motionTokens.duration.standard, ease: ENTER }}
  >{children}</motion.span>;
}

function Swap({ children, className }: { children: string; className?: string }) {
  const reduced = useReducedMotion() ?? false;
  return <span className={[styles.swap, className].filter(Boolean).join(" ")}>
    <AnimatePresence mode="popLayout" initial={false}>
      <SwapText key={children} reduced={reduced}>{children}</SwapText>
    </AnimatePresence>
  </span>;
}

/** A block whose height follows its content, so swapped copy never leaves a gap behind. */
function Morph({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <motion.div
    className={[styles.morph, className].filter(Boolean).join(" ")}
    initial={false}
    animate={{ height }}
    transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}
  >
    <div ref={ref} className={styles.morphInner}>{children}</div>
  </motion.div>;
}

/** The step body. Height jumps on the first measure and on a step change, then eases as the content settles. */
function Region({ step, children }: { step: Step; children: ReactNode }) {
  const reduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const deadline = useRef(0);
  const height = useMotionValue<number | "auto">("auto");
  useLayoutEffect(() => {
    deadline.current = performance.now() + 700;
  }, [step]);
  useEffect(() => {
    let controls: ReturnType<typeof animate> | undefined;
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let started = false;
    const observer = new ResizeObserver(() => {
      const next = node.offsetHeight;
      controls?.stop();
      if (!started || reduced || performance.now() > deadline.current) {
        started = true;
        height.jump(next);
        return;
      }
      controls = animate(height, next, motionTokens.spring.smooth);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      controls?.stop();
    };
  }, [height, reduced]);
  return <motion.div className={styles.region} style={{ height }}>
    <div ref={ref} className={styles.regionInner}>{children}</div>
  </motion.div>;
}

/** Three bars that fill in the direction of travel, staggered so a skipped step catches up one at a time. */
function Stepper({ at, reduced }: { at: number; reduced: boolean }) {
  const [tracked, setTracked] = useState({ to: at, from: at });
  if (tracked.to !== at) setTracked({ to: at, from: tracked.to });
  const from = tracked.from;
  return <ol className={styles.progress} aria-label="Cancellation steps">
    {STEP_LABELS.map((label, index) => {
      const status = index < at ? "complete" : index === at ? "current" : "upcoming";
      return <li key={label} className={styles.step} data-status={status} aria-current={index === at ? "step" : undefined}>
        <span className={styles.bar} aria-hidden="true">
          <motion.span
            className={styles.barFill}
            initial={false}
            animate={{ scaleX: +(index <= at) }}
            transition={reduced ? { duration: 0 } : {
              ...motionTokens.spring.smooth,
              delay: reduced ? 0 : (at > from ? Math.max(0, index - from - 1) : Math.max(0, from - index - 1)) * motionTokens.stagger.line,
            }}
          />
        </span>
        <span className={styles.stepLabel}>{label}{status === "complete" && <span className={styles.srOnly}>, done</span>}</span>
      </li>;
    })}
  </ol>;
}

/** The tick draws itself from its short stroke. */
function DrawnCheck() {
  const reduced = useReducedMotion() ?? false;
  return <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <motion.path
      d="M4.5 12.5l5 5L19.5 7"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={reduced ? { duration: 0 } : {
        pathLength: { duration: 0.34, ease: ENTER, delay: 0.14 },
        opacity: { duration: 0.05, delay: 0.14 },
      }}
    />
  </svg>;
}

function Receipt({ rows, note }: { rows: [string, string][]; note?: string }) {
  const reduced = useReducedMotion() ?? false;
  return <div className={styles.receipt}>
    <motion.span
      className={styles.mark}
      aria-hidden="true"
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={reduced ? { duration: 0 } : { scale: motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.fast } }}
    >
      <DrawnCheck />
    </motion.span>
    <dl className={styles.rows}>
      {rows.map(([term, detail], index) => <motion.div
        key={term}
        className={styles.row}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0 } : { duration: motionTokens.duration.standard, ease: ENTER, delay: 0.12 + index * motionTokens.stagger.item }}
      >
        <dt>{term}</dt>
        <dd>{detail}</dd>
      </motion.div>)}
    </dl>
    {note ? <p className={styles.footnote}>{note}</p> : null}
  </div>;
}

const viewVariants: Variants = {
  enter: ({ dir, reduce }: { dir: number; reduce: boolean }) => (reduce ? { opacity: 0 } : { opacity: 0, x: 28 * dir, filter: `blur(${motionTokens.blur.soft}px)` }),
  center: ({ reduce }: { dir: number; reduce: boolean }) => ({
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: reduce ? { duration: 0 } : {
      x: motionTokens.spring.smooth,
      opacity: { duration: motionTokens.duration.standard, ease: ENTER },
      filter: { duration: motionTokens.duration.standard, ease: ENTER },
    },
  }),
  exit: ({ dir, reduce }: { dir: number; reduce: boolean }) => (reduce ? { opacity: 0, transition: { duration: 0 } } : {
    opacity: 0,
    x: -20 * dir,
    filter: `blur(${motionTokens.blur.subtle}px)`,
    transition: { duration: motionTokens.duration.exit, ease: STANDARD },
  }),
};

/**
 * A three step cancellation flow: pick a reason, see an offer shaped by that reason, then confirm. The last step asks for a
 * 1.2 second hold before the plan is cancelled, and the closing receipt can be undone with Reactivate. Nothing commits until
 * the hold finishes, and every step announces itself to a polite live region.
 */
export function CancelFlow({ flat = false }: CancelFlowProps) {
  const id = useId();
  const reduce = useReducedMotion() ?? false;

  const [step, setStep] = useState<Step>("reason");
  const [direction, setDirection] = useState(1);
  const [reason, setReason] = useState<ReasonId | null>(null);
  const [note, setNote] = useState("");
  const [pause, setPause] = useState(2);
  const [apply, setApply] = useState<ApplyState>("idle");
  const [holding, setHolding] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>("stayed");
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [announcement, setAnnouncement] = useState("");
  const [selectionKey, setSelectionKey] = useState(0);

  const reasonNodes = useRef(new Map<ReasonId, HTMLButtonElement>());
  const focusTarget = useRef<string | null>(null);
  const timers = useRef(new Set<number>());

  useEffect(() => {
    const target = focusTarget.current;
    if (!target) return;
    focusTarget.current = null;
    document.getElementById(target)?.focus({ preventScroll: true });
  });

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(timer => window.clearTimeout(timer));
  }, []);

  function later(callback: () => void, delay: number) {
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      callback();
    }, delay);
    timers.current.add(timer);
  }

  const trimmed = note.trim();
  const offer = reason ? buildOffer(reason, pause, trimmed) : null;
  const applied = step === "offer" && apply === "applied";
  const busy = apply === "applying" || (holding && step === "confirm");
  const progressAt = applied ? 3 : STEP_INDEX[step];
  const badge: { text: string; tone: BadgeTone } = holding
    ? { text: "Ends Oct 14", tone: "warning" }
    : applied && offer
      ? { text: offer.done.badge, tone: offer.done.tone }
      : { text: "Renews Oct 14", tone: "neutral" };
  const activeReason = REASONS.find(entry => entry.id === reason);

  function go(next: Step, stepDirection: number, message: string) {
    setDirection(stepDirection);
    if (next === "reason") setSelectionKey(current => current + 1);
    setStep(next);
    setAnnouncement(message);
    focusTarget.current = `${id}-${next}`;
  }

  function onReasonKeys(event: ReactKeyboardEvent<HTMLDivElement>) {
    const order = REASONS.map(entry => entry.id);
    const index = order.indexOf(event.target instanceof HTMLElement ? (event.target.dataset.reason as ReasonId) : "price");
    const move = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key as "ArrowDown"];
    const target = event.key === "Home"
      ? order[0]
      : event.key === "End"
        ? order[order.length - 1]
        : move
          ? order[(Math.max(index, 0) + move + order.length) % order.length]
          : undefined;
    if (!target) return;
    event.preventDefault();
    setReason(target);
    reasonNodes.current.get(target)?.focus();
  }

  function changePause(delta: number) {
    const next = Math.min(3, Math.max(1, pause + delta));
    if (next === pause || apply !== "idle") return;
    setPause(next);
    setAnnouncement(`Pause for ${next} ${next === 1 ? "month" : "months"}. Billing resumes on ${RESUME_DATES[next - 1]}.`);
  }

  function onPauseKeys(event: ReactKeyboardEvent<HTMLDivElement>) {
    const delta = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, Home: -2, End: 2 }[event.key as "ArrowUp"];
    if (!delta) return;
    event.preventDefault();
    changePause(delta);
  }

  function acceptOffer() {
    if (!offer || apply !== "idle") return;
    const message = offer.done.announce;
    setApply("applying");
    later(() => {
      setApply("applied");
      setAnnouncement(message);
      focusTarget.current = `${id}-undo`;
    }, 900);
  }

  function removeOffer() {
    setApply("idle");
    setAnnouncement("Offer removed. Your plan is back to $96 a month.");
    focusTarget.current = `${id}-accept`;
  }

  function cancelPlan() {
    setHolding(true);
    setAnnouncement("Team plan cancelled.");
    later(() => go("cancelled", 1, "Your plan ends on Oct 14. Here is what happens next."), 900);
  }

  function requestExport() {
    if (exportState !== "idle") return;
    setExportState("working");
    later(() => {
      setExportState("done");
      setAnnouncement(`Export requested. A download link is on its way to ${SUPPORT_EMAIL}.`);
    }, 1100);
  }

  function reactivate() {
    setOutcome("reactivated");
    setHolding(false);
    setExportState("idle");
    go("kept", 1, "Plan reactivated. It renews on Oct 14.");
  }

  function startOver() {
    setReason(null);
    setNote("");
    setPause(2);
    setApply("idle");
    setHolding(false);
    setExportState("idle");
    go("reason", -1, "Step 1 of 3: why are you cancelling?");
  }

  const heading = (text: string) => <h2 id={`${id}-${step}`} tabIndex={-1} className={styles.title}>{text}</h2>;
  const rise = (index: number) => ({
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: reduce ? { duration: 0 } : { duration: motionTokens.duration.standard, ease: ENTER, delay: 0.1 + index * motionTokens.stagger.line },
  });
  const panelIn = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: `blur(${motionTokens.blur.soft}px)` },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: reduce
      ? { opacity: 0, transition: { duration: 0 } }
      : { opacity: 0, y: -4, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.exit, ease: STANDARD } },
    transition: reduce ? { duration: 0 } : { duration: motionTokens.duration.standard, ease: ENTER, delay: 0.06 },
  };
  const fade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0, transition: { duration: reduce ? 0 : motionTokens.duration.instant } },
    transition: { duration: reduce ? 0 : motionTokens.duration.fast },
  };
  const custom = { dir: direction, reduce };

  return <section className={styles.root} aria-label="Cancel subscription">
    <div className={styles.card} style={flat ? FLAT : undefined}>
      <div className={styles.top}>
        <div className={styles.plan}>
          <p className={styles.planName}>Team plan</p>
          <p className={styles.planMeta}>Halcyon Studio · 8 seats · $96 a month</p>
        </div>
        <Badge size="sm" tone={badge.tone}>{badge.text}</Badge>
      </div>
      <Stepper at={progressAt} reduced={reduce} />
      <Region step={step}>
        <AnimatePresence mode="popLayout" initial={false} custom={custom}>
          <motion.div
            key={step}
            className={styles.view}
            custom={custom}
            variants={viewVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {step === "reason" && <>
              <header className={styles.head}>
                {heading("Why are you cancelling?")}
                <p className={styles.lead}>Your answer shapes what we suggest next. Nothing changes until you confirm on the last step.</p>
              </header>
              <div className={styles.reasons} role="radiogroup" aria-labelledby={`${id}-reason`} onKeyDown={onReasonKeys}>
                {REASONS.map((entry, index) => {
                  const checked = reason === entry.id;
                  return <button
                    key={entry.id}
                    ref={node => {
                      if (node) reasonNodes.current.set(entry.id, node);
                      else reasonNodes.current.delete(entry.id);
                    }}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    tabIndex={checked || (!reason && index === 0) ? 0 : -1}
                    data-reason={entry.id}
                    className={styles.reason}
                    onClick={() => setReason(entry.id)}
                  >
                    {checked && <motion.span
                      layoutId={`reason-highlight-${selectionKey}`}
                      className={styles.highlight}
                      style={{ borderRadius: 13 }}
                      transition={reduce ? { duration: 0 } : motionTokens.spring.morph}
                    />}
                    <span className={styles.reasonHead}>
                      <span className={styles.reasonLabel}>{entry.label}</span>
                      <span className={styles.radio} aria-hidden="true" />
                    </span>
                    <span className={styles.reasonDetail}>{entry.detail}</span>
                  </button>;
                })}
              </div>
              <AnimatePresence initial={false}>
                {activeReason && <motion.div
                  key="note"
                  className={styles.noteSlot}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={reduce ? { duration: 0 } : {
                    height: motionTokens.spring.smooth,
                    opacity: { duration: motionTokens.duration.standard, ease: ENTER },
                  }}
                >
                  <div className={styles.note}>
                    <Textarea
                      id={`${id}-note`}
                      label="Add a note (optional)"
                      description={activeReason.prompt}
                      placeholder={activeReason.placeholder}
                      rows={3}
                      maxLength={280}
                      value={note}
                      onChange={event => setNote(event.target.value)}
                    />
                  </div>
                </motion.div>}
              </AnimatePresence>
              <div className={styles.actions}>
                <div className={styles.actionsEnd}>
                  <Button
                    id={`${id}-continue`}
                    disabled={!reason}
                    onClick={() => {
                      if (!reason) return;
                      setApply("idle");
                      go("offer", 1, "Step 2 of 3: an offer based on your reason.");
                    }}
                  >Continue</Button>
                </div>
              </div>
            </>}

            {step === "offer" && offer && reason && (() => {
              const pausing = reason === "usage";
              return <>
                <header className={styles.head}>
                  <Morph>{heading(applied ? offer.done.title : offer.title)}</Morph>
                  <Morph><p className={styles.lead}><Swap>{applied ? offer.done.lead : offer.lead}</Swap></p></Morph>
                </header>
                <Morph className={styles.panel}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {applied
                      ? <motion.div key="done" {...panelIn}><Receipt rows={offer.done.rows} /></motion.div>
                      : <motion.div key="offer" className={styles.offerBody} {...panelIn}>
                        <div className={styles.figureRow}>
                          <div
                            className={styles.figure}
                            role={pausing ? "spinbutton" : undefined}
                            tabIndex={pausing ? 0 : undefined}
                            aria-label={pausing ? "Pause length" : undefined}
                            aria-valuemin={pausing ? 1 : undefined}
                            aria-valuemax={pausing ? 3 : undefined}
                            aria-valuenow={pausing ? pause : undefined}
                            aria-valuetext={pausing ? `${pause} ${offer.figure.unit}, resumes ${RESUME_DATES[pause - 1]}` : undefined}
                            onKeyDown={pausing ? onPauseKeys : undefined}
                          >
                            <span className={styles.figureNum}>
                              <AnimatedCounter value={offer.figure.value} prefix={offer.figure.prefix} decimals={offer.figure.decimals} animateOnView />
                            </span>
                            <Swap className={styles.figureUnit}>{offer.figure.unit}</Swap>
                          </div>
                          {pausing
                            ? <div className={styles.monthControls}>
                              <Button
                                variant="secondary"
                                size="sm"
                                className={styles.iconButton}
                                aria-label="Pause one month less"
                                aria-disabled={pause === 1 || busy || undefined}
                                onClick={() => changePause(-1)}
                              ><Minus {...ICON} /></Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                className={styles.iconButton}
                                aria-label="Pause one month more"
                                aria-disabled={pause === 3 || busy || undefined}
                                onClick={() => changePause(1)}
                              ><Plus {...ICON} /></Button>
                            </div>
                            : offer.figure.was
                              ? <p className={styles.was}><span className={styles.srOnly}>Instead of </span><s>{offer.figure.was}</s></p>
                              : null}
                        </div>
                        {reason === "feature" && <div className={styles.person}>
                          <Avatar name="Emma Collins" src={avatar("emma-collins")} />
                          <div>
                            <p className={styles.personName}>Emma Collins <span>Product lead</span></p>
                            <p className={styles.quote}>{trimmed ? `Your note: “${trimmed}”` : "No note yet. Go back to add one, or Emma will ask when she replies."}</p>
                          </div>
                        </div>}
                        <ul className={styles.facts}>
                          {offer.facts.map((fact, index) => <li key={index}><Check size={16} strokeWidth={2} aria-hidden="true" /><Swap>{fact}</Swap></li>)}
                        </ul>
                      </motion.div>}
                  </AnimatePresence>
                </Morph>
                <div className={styles.actions}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {!applied && <motion.div key="back" {...fade}>
                      <Button
                        variant="ghost"
                        className={styles.inert}
                        aria-disabled={busy || undefined}
                        onClick={() => {
                          if (busy) return;
                          go("reason", -1, "Step 1 of 3: why are you cancelling?");
                        }}
                      ><ArrowLeft {...ICON} />Back</Button>
                    </motion.div>}
                  </AnimatePresence>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {applied
                      ? <motion.div key="undo" className={styles.actionsEnd} {...fade}>
                        <Button id={`${id}-undo`} variant="secondary" onClick={removeOffer}><RotateCcw {...ICON} />Undo</Button>
                      </motion.div>
                      : <motion.div key="choose" className={styles.actionsEnd} {...fade}>
                        <Button
                          variant="ghost"
                          className={styles.inert}
                          aria-disabled={busy || undefined}
                          onClick={() => {
                            if (busy) return;
                            go("confirm", 1, "Step 3 of 3: confirm cancellation.");
                          }}
                        >Continue to cancel</Button>
                        <Button id={`${id}-accept`} loading={apply === "applying"} onClick={acceptOffer}>{offer.accept}</Button>
                      </motion.div>}
                  </AnimatePresence>
                </div>
              </>;
            })()}

            {step === "confirm" && <>
              <header className={styles.head}>
                {heading("Before you cancel")}
                <p className={styles.lead}>Your team keeps full access until the end of this billing period. Here is what changes after that.</p>
              </header>
              <ul className={styles.impacts}>
                {IMPACTS.map(({ Icon, title, detail, danger }, index) => <motion.li
                  key={title}
                  className={styles.impact}
                  data-danger={danger || undefined}
                  {...rise(index)}
                >
                  <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                  <div>
                    <p className={styles.impactTitle}>{title}</p>
                    <p className={styles.impactDetail}>{detail}</p>
                  </div>
                </motion.li>)}
              </ul>
              <div className={styles.actions}>
                <Button
                  variant="ghost"
                  className={styles.inert}
                  aria-disabled={busy || undefined}
                  onClick={() => {
                    if (busy) return;
                    go("offer", -1, "Step 2 of 3: an offer based on your reason.");
                  }}
                ><ArrowLeft {...ICON} />Back</Button>
                <div className={styles.actionsEnd}>
                  <Button
                    variant="secondary"
                    className={styles.inert}
                    aria-disabled={busy || undefined}
                    onClick={() => {
                      if (busy) return;
                      setOutcome("stayed");
                      go("kept", 1, "Nothing changed. Your Team plan stays active.");
                    }}
                  >Keep my plan</Button>
                  <HoldToConfirm
                    label="Hold to cancel plan"
                    confirmedLabel="Plan cancelled"
                    confirmed={holding}
                    onConfirm={cancelPlan}
                    onHoldChange={setHolding}
                  />
                </div>
              </div>
              <p className={styles.hint} aria-hidden="true">
                <Swap>{holding ? "Cancelled. Wrapping up" : busy ? "Keep holding" : "Hold for 1.2 seconds"}</Swap>
              </p>
            </>}

            {step === "cancelled" && <>
              <header className={styles.head}>
                {heading("Your plan ends on Oct 14")}
                <p className={styles.lead}>Thanks for building with us. A confirmation is on its way to {SUPPORT_EMAIL}.</p>
              </header>
              <h3 className={styles.subhead}>What happens next</h3>
              <ol className={styles.timeline}>
                {TIMELINE.map((event, index) => <motion.li
                  key={event.title}
                  className={styles.event}
                  data-done={event.done || undefined}
                  {...rise(index)}
                >
                  <span className={styles.eventDate}>{event.date}</span>
                  <span className={styles.eventDot} aria-hidden="true">{event.done && <Check size={10} strokeWidth={3} />}</span>
                  <div>
                    <p className={styles.eventTitle}>{event.title}{event.done && <span className={styles.srOnly}>, done</span>}</p>
                    <p className={styles.eventDetail}>{event.detail}</p>
                  </div>
                </motion.li>)}
              </ol>
              <div className={styles.actions}>
                <Button variant="secondary" loading={exportState === "working"} onClick={requestExport}>
                  {exportState === "done" ? <><Check {...ICON} />Export requested</> : <><Download {...ICON} />Export data</>}
                </Button>
                <div className={styles.actionsEnd}>
                  <Button variant="secondary" onClick={reactivate}><RotateCcw {...ICON} />Reactivate plan</Button>
                </div>
              </div>
            </>}

            {step === "kept" && <>
              <header className={styles.head}>
                {heading(outcome === "stayed" ? "Your Team plan stays active" : "Your plan is active again")}
                <p className={styles.lead}>{outcome === "stayed"
                  ? "Nothing changed. Your projects, members and integrations carry on as before."
                  : "The cancellation is undone and nothing will be deleted."}</p>
              </header>
              <div className={styles.panel}>
                <Receipt
                  rows={[["Plan", "Team, 8 seats"], ["Next invoice", "Oct 14, 2026"], ["Amount", "$96.00"]]}
                  note={outcome === "stayed" ? "No changes were made." : undefined}
                />
              </div>
              <div className={styles.actions}>
                <div className={styles.actionsEnd}>
                  <Button variant="ghost" onClick={startOver}><RotateCcw {...ICON} />Start over</Button>
                </div>
              </div>
            </>}
          </motion.div>
        </AnimatePresence>
      </Region>
      <p className={styles.srOnly} role="status" aria-live="polite">{announcement}</p>
    </div>
  </section>;
}

export default CancelFlow;
