"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode, SVGProps } from "react";
import {
  AnimatePresence,
  Reorder,
  motion,
  useDragControls,
  useReducedMotion,
  type Transition,
  type Variants,
} from "motion/react";
import {
  FilePlus,
  FileText,
  GripVertical,
  Pause,
  PencilLine,
  Play,
  Plus,
  RotateCw,
  Ruler,
  Search,
  SkipForward,
  Terminal,
  Wrench,
  X,
} from "lucide-react";
import Button from "../button/button";
import TextShimmer from "../text-shimmer/text-shimmer";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./agent-plan.module.css";

export type AgentPlanStepState = "pending" | "active" | "done" | "failed" | "skipped";

/** One step of the plan. Titles are editable while the plan is a draft. */
export interface AgentPlanStep {
  id: string;
  title: string;
  /** Omit while the step has not started; the row then shows a neutral ring. */
  state?: AgentPlanStepState;
  /** Activity lines under an active or failed step. The first word picks the icon. */
  substeps?: string[];
  /** Small caption under the title, e.g. "Suggested" or "Added by agent". */
  note?: string;
  /** Failure line shown with Retry and Skip. */
  error?: string;
  /** Finished time in seconds, printed at the end of the row. */
  duration?: number;
}

export type AgentPlanStatus = "draft" | "running" | "paused" | "done";

export interface AgentPlanModel {
  name: string;
  /** Brand mark shown beside the heading and in suggestion notes. */
  mark?: ReactNode;
}

export interface AgentPlanAction {
  type: "retry" | "skip";
  step: AgentPlanStep;
}

export interface AgentPlanProps {
  /** The plan. Omit to start from the built-in rate-limiting plan. */
  steps?: AgentPlanStep[];
  /** Omit to drive the plan with the built-in simulation. */
  status?: AgentPlanStatus;
  goal?: string;
  model?: AgentPlanModel;
  /** Closing line shown under the finished plan. */
  summary?: string;
  onApprove?: (steps: AgentPlanStep[]) => void;
  onChange?: (steps: AgentPlanStep[]) => void;
  onStepAction?: (action: AgentPlanAction) => void;
  onKeepPlanning?: () => void;
  onPauseChange?: (paused: boolean) => void;
  className?: string;
}

const { duration, ease } = motionTokens;

const enterEase: [number, number, number, number] = [...ease.enter];
const exitEase: [number, number, number, number] = [...ease.standard];

const heightSpring: Transition = { type: "spring", visualDuration: 0.26, bounce: 0 };
const noteTransition: Transition = { duration: duration.fast, ease: enterEase };
const shortExit: Transition = { duration: 0.1, ease: exitEase };
const instant: Transition = { duration: 0 };

const STATE_LABEL: Record<AgentPlanStepState, string> = {
  pending: "Pending",
  active: "In progress",
  done: "Done",
  failed: "Failed",
  skipped: "Skipped",
};

/** Claude's brand mark, drawn at 24px and colored by the caller. */
export function ClaudeBrandMark({ title = "Claude", ...props }: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

/** Fade and lift shared by every line that swaps in place. */
function swap(reduced: boolean) {
  return {
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 3 },
    animate: { opacity: 1, y: 0, transition: reduced ? instant : noteTransition },
    exit: { opacity: 0, transition: reduced ? instant : shortExit },
  };
}

const rollVariants: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: `${0.4 * direction}em` }),
  center: { opacity: 1, y: "0em", transition: { duration: 0.2, ease: enterEase } },
  exit: (direction: number) => ({ opacity: 0, y: `${-0.4 * direction}em`, transition: shortExit }),
};

/** A digit roll: the new count slides in from the direction it moved. */
function Roll({ value, reduced }: { value: number; reduced: boolean }) {
  const [shown, setShown] = useState(value);
  const [direction, setDirection] = useState(1);
  if (shown !== value) {
    setDirection(value > shown ? 1 : -1);
    setShown(value);
  }
  const text = String(value);
  return (
    <span className={styles.roll} style={{ width: `${text.length}ch` }}>
      <AnimatePresence initial={false} custom={direction}>
        <motion.span
          key={reduced ? "static" : text}
          className={styles.rollValue}
          custom={direction}
          variants={rollVariants}
          initial={!reduced && "enter"}
          animate="center"
          exit={reduced ? undefined : "exit"}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * Streams a line of text in word groups so a suggestion lands like an agent wrote it rather than
 * appearing whole. Advances on a fixed 34ms clock so slow frames don't stall the cadence.
 */
function StreamText({ text, onDone }: { text: string; onDone?: () => void }) {
  const chunks = useMemo(() => {
    const words = text.match(/\S+\s*/g) ?? [];
    const sizes = [4, 3, 5, 4, 6];
    const out: string[] = [];
    let chunk = "";
    let count = 0;
    for (const word of words) {
      chunk += word;
      count += 1;
      if (count >= sizes[out.length % sizes.length] || chunk.length >= 36) {
        out.push(chunk);
        chunk = "";
        count = 0;
      }
    }
    if (chunk) out.push(chunk);
    return out;
  }, [text]);
  const [shown, setShown] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    let frame = 0;
    let tick = 0;
    let clock = performance.now() - 34;
    const step = (now: number) => {
      const elapsed = Math.floor((now - clock) / 34);
      if (elapsed > 0) {
        tick = Math.min(chunks.length, tick + elapsed);
        clock += 34 * elapsed;
        setShown(tick);
      }
      if (tick < chunks.length) frame = requestAnimationFrame(step);
      else done.current?.();
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [chunks]);
  return (
    <>
      {chunks.slice(0, shown).map((chunk, at) => (
        <span className={styles.chunk} key={at}>
          {chunk}
        </span>
      ))}
    </>
  );
}

/** Animates its own height so the footer can swap rows without the panel jumping. */
function HeightSpring({
  children,
  className,
  reduced,
}: {
  children: ReactNode;
  className?: string;
  reduced: boolean;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <motion.div className={className} initial={false} animate={{ height }} transition={reduced ? instant : heightSpring}>
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

/** The icon for one activity line, chosen from its first word. */
function ActivityIcon({ label }: { label: string }) {
  const verb = label.split(" ", 1)[0]?.toLowerCase() ?? "";
  const Icon =
    verb === "read"
      ? FileText
      : verb === "edited" || verb === "updated"
        ? PencilLine
        : verb === "created" || verb === "wrote" || verb === "added"
          ? FilePlus
          : verb === "searched" || verb === "found"
            ? Search
            : verb === "ran"
              ? Terminal
              : verb === "measured"
                ? Ruler
                : Wrench;
  return <Icon size={12} strokeWidth={1.75} aria-hidden="true" />;
}

function ActivityList({ lines, reduced }: { lines: string[]; reduced: boolean }) {
  return (
    <ul className={styles.subs} aria-label="Activity">
      <AnimatePresence initial={false}>
        {lines.map((line, at) => (
          <motion.li
            key={at}
            className={styles.sub}
            initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={reduced ? instant : { height: heightSpring, opacity: noteTransition }}
          >
            <span className={styles.subInner}>
              <ActivityIcon label={line} />
              <span className={styles.subText}>{line}</span>
            </span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

const DEFAULT_STEPS: AgentPlanStep[] = [
  { id: "map", title: "Map the public routes under api/v1" },
  { id: "limiter", title: "Add a sliding window limiter to the API middleware" },
  { id: "store", title: "Keep request counters in Redis with a 60 second TTL" },
  { id: "headers", title: "Return 429 with Retry-After and RateLimit headers" },
  { id: "tests", title: "Write tests for limits, bursts and window resets" },
  { id: "docs", title: "Document the limits in the API reference" },
];

interface Script {
  substeps: string[];
  duration: number;
  insert?: { after: number; step: AgentPlanStep };
  fail?: { error: string; retry: string[] };
}

const SCRIPT: Record<string, Script> = {
  map: {
    substeps: ["Read 4 files", "Searched for router.get and router.post", "Found 23 public routes"],
    duration: 21,
  },
  limiter: {
    substeps: ["Read middleware/index.ts", "Created middleware/rate-limit.ts", "Edited 2 files"],
    duration: 48,
  },
  store: {
    substeps: ["Read lib/redis.ts", "Edited middleware/rate-limit.ts", "Ran 6 tests"],
    duration: 37,
    insert: {
      after: 2,
      step: {
        id: "fallback",
        title: "Fall back to in-memory counters when Redis is down",
        note: "Added by agent",
      },
    },
  },
  fallback: { substeps: ["Edited lib/redis.ts", "Ran 8 tests"], duration: 29 },
  headers: { substeps: ["Edited middleware/rate-limit.ts", "Ran 4 tests"], duration: 24 },
  tests: {
    substeps: ["Created rate-limit.test.ts", "Ran 12 tests"],
    duration: 63,
    fail: {
      error: "2 of 12 tests failed: the window resets one second late",
      retry: ["Edited middleware/rate-limit.ts", "Ran 12 tests, all passed"],
    },
  },
  docs: {
    substeps: ["Read docs/api/overview.md", "Edited docs/api/rate-limits.md"],
    duration: 19,
  },
  overrides: {
    substeps: ["Read lib/plans.ts", "Edited middleware/rate-limit.ts", "Ran 5 tests"],
    duration: 34,
  },
  metrics: { substeps: ["Read lib/metrics.ts", "Edited middleware/rate-limit.ts"], duration: 22 },
  load: {
    substeps: ["Ran k6 against staging for 60 seconds", "Measured 41 ms p99 at 2,000 requests per second"],
    duration: 71,
  },
};

const FALLBACK_SCRIPT: Script = {
  substeps: ["Read 3 files", "Edited 2 files", "Ran 6 tests"],
  duration: 32,
};

const SUGGESTIONS: AgentPlanStep[] = [
  { id: "overrides", title: "Allow higher limits for enterprise API keys" },
  { id: "metrics", title: "Emit a metric for every blocked request" },
  { id: "load", title: "Load test the limiter at 2,000 requests per second" },
];

const DEFAULT_SUMMARY =
  "Rate limiting is on for all 23 public routes, with an in-memory fallback and 12 passing tests.";

const DEFAULT_MODEL: AgentPlanModel = {
  name: "Claude Opus 5.5",
  mark: <ClaudeBrandMark style={{ color: "#D97757" }} />,
};

type GlyphKind = AgentPlanStepState | "paused";

const isFinished = (step: AgentPlanStep) => step.state === "done" || step.state === "skipped";

const patchStep = (rows: AgentPlanStep[], id: string, patch: Partial<AgentPlanStep>) =>
  rows.map((row) => (row.id === id ? { ...row, ...patch } : row));

/** Seconds as a compact "42s" or "3m 07s". */
function formatDuration(seconds: number) {
  const total = Math.round(seconds);
  return total < 60 ? `${total}s` : `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, "0")}s`;
}

/** SVG ring for one step state: spinner, pause, check, cross or skip. */
function StateGlyph({ kind, reduced }: { kind: GlyphKind; reduced: boolean }) {
  switch (kind) {
    case "active":
      return (
        <svg viewBox="0 0 16 16" className={styles.spin} aria-hidden="true">
          <circle cx="8" cy="8" r="6.25" className={styles.track} />
          <path d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25" className={styles.arc} />
        </svg>
      );
    case "paused":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.25" className={styles.pausedRing} />
          <path d="M6.6 5.9v4.2M9.4 5.9v4.2" className={styles.pausedBars} />
        </svg>
      );
    case "done":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="7" className={styles.doneDisc} />
          <motion.path
            d="M5 8.25 7.1 10.3 11 6"
            className={styles.ink}
            initial={{ pathLength: reduced ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={reduced ? instant : { duration: 0.22, ease: enterEase, delay: 0.04 }}
          />
        </svg>
      );
    case "failed":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="7" className={styles.failDisc} />
          <path d="M8 4.9v3.6" className={styles.ink} />
          <circle cx="8" cy="11.1" r=".95" className={styles.inkDot} />
        </svg>
      );
    case "skipped":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.25" className={styles.skipRing} />
          <path d="M5.6 8h4.8" className={styles.skipDash} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.25" className={styles.ring} />
        </svg>
      );
  }
}

type Register = (key: string) => (node: HTMLElement | null) => void;

interface StepRowProps {
  step: AgentPlanStep;
  index: number;
  draft: boolean;
  paused: boolean;
  reduced: boolean;
  streaming: boolean;
  note?: string;
  fresh: boolean;
  mark?: ReactNode;
  hintId: string;
  register: Register;
  onRename: (id: string, title: string) => void;
  onCommit: (id: string, changed: boolean) => void;
  onRemove: (id: string, side: "previous" | "next") => void;
  onMove: (id: string, delta: number, mode: "field" | "grip") => void;
  onAction: (type: "retry" | "skip", step: AgentPlanStep) => void;
  onDragEnd: () => void;
  onStreamDone: () => void;
}

function StepRow({
  step,
  index,
  draft,
  paused,
  reduced,
  streaming,
  note,
  fresh,
  mark,
  hintId,
  register,
  onRename,
  onCommit,
  onRemove,
  onMove,
  onAction,
  onDragEnd,
  onStreamDone,
}: StepRowProps) {
  const controls = useDragControls();
  const [dragging, setDragging] = useState(false);
  const snapshot = useRef(step.title);
  const state = step.state ?? "pending";
  const glyph = state === "active" && paused ? "paused" : state;
  const label = step.title || "Empty step";
  const swapProps = swap(reduced);
  const open = state === "active" || state === "failed";

  return (
    <Reorder.Item
      as="li"
      value={step.id}
      dragListener={false}
      dragControls={controls}
      layout="position"
      dragMomentum={false}
      dragTransition={{ bounceStiffness: 700, bounceDamping: 60 }}
      className={styles.row}
      data-state={state}
      data-dragging={dragging || undefined}
      data-fresh={fresh || undefined}
      initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={
        reduced
          ? { opacity: 0, transition: instant }
          : { height: 0, opacity: 0, transition: { ...heightSpring, opacity: shortExit } }
      }
      transition={reduced ? instant : { ...heightSpring, opacity: noteTransition }}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => {
        setDragging(false);
        onDragEnd();
      }}
    >
      <div className={styles.rowInner}>
        <span className={styles.lead}>
          <AnimatePresence initial={false}>
            {draft ? (
              <motion.button
                key="grip"
                ref={register(`grip:${step.id}`)}
                type="button"
                className={styles.grip}
                {...swapProps}
                aria-label={`Move step ${index + 1}: ${label}`}
                aria-describedby={hintId}
                onPointerDown={(event) => {
                  if (event.button === 0) controls.start(event);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                    event.preventDefault();
                    onMove(step.id, event.key === "ArrowUp" ? -1 : 1, "grip");
                  }
                }}
              >
                <GripVertical size={16} strokeWidth={1.75} aria-hidden="true" />
              </motion.button>
            ) : (
              <motion.span
                key={glyph}
                className={styles.glyph}
                {...swapProps}
                initial={{ opacity: 0 }}
              >
                <StateGlyph kind={glyph} reduced={reduced} />
              </motion.span>
            )}
          </AnimatePresence>
        </span>

        <div className={styles.body}>
          {!draft && (
            <span className={styles.srOnly}>{STATE_LABEL[state]}: </span>
          )}
          <div className={styles.title} data-value={draft && !streaming ? step.title : undefined}>
            {streaming ? (
              <span className={styles.titleText}>
                <StreamText text={step.title} onDone={onStreamDone} />
              </span>
            ) : draft ? (
              <textarea
                ref={register(`field:${step.id}`)}
                className={styles.field}
                rows={1}
                value={step.title}
                placeholder="Describe the step"
                aria-label={`Step ${index + 1}`}
                aria-describedby={hintId}
                spellCheck={false}
                onFocus={() => {
                  snapshot.current = step.title;
                }}
                onChange={(event) => onRename(step.id, event.target.value.replace(/\s*\n\s*/g, " "))}
                onBlur={() => onCommit(step.id, step.title !== snapshot.current)}
                onKeyDown={(event) => {
                  if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
                    event.preventDefault();
                    onMove(step.id, event.key === "ArrowUp" ? -1 : 1, "field");
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    onCommit(step.id, step.title !== snapshot.current);
                    snapshot.current = step.title;
                  } else if (event.key === "Escape" && step.title !== snapshot.current) {
                    event.preventDefault();
                    onRename(step.id, snapshot.current);
                  } else if (event.key === "Backspace" && !step.title) {
                    event.preventDefault();
                    onRemove(step.id, "previous");
                  }
                }}
              />
            ) : (
              <TextShimmer className={styles.titleText} active={state === "active" && !paused}>
                {step.title}
              </TextShimmer>
            )}
          </div>

          {note && (
            <p className={styles.note}>
              <span className={styles.noteMark} aria-hidden="true">
                {mark}
              </span>
              {note}
            </p>
          )}

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                key="activity"
                className={styles.collapse}
                initial={false}
                exit={
                  reduced
                    ? { opacity: 0, transition: instant }
                    : { height: 0, opacity: 0, transition: { ...heightSpring, opacity: shortExit } }
                }
              >
                <ActivityList lines={step.substeps ?? []} reduced={reduced} />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {state === "failed" && (
              <motion.div
                key="failure"
                className={styles.collapse}
                initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={
                  reduced
                    ? { opacity: 0, transition: instant }
                    : { height: 0, opacity: 0, transition: { ...heightSpring, opacity: shortExit } }
                }
                transition={reduced ? instant : { height: heightSpring, opacity: noteTransition }}
              >
                <div className={styles.fail}>
                  <p className={styles.failText}>
                    <span className={styles.failLabel}>Failed</span>{" "}
                    {step.error ?? "The step did not finish."}
                  </p>
                  <div className={styles.failActions}>
                    <button type="button" className={styles.mini} data-tone="accent" onClick={() => onAction("retry", step)}>
                      <RotateCw size={14} strokeWidth={1.75} aria-hidden="true" />
                      Retry
                    </button>
                    <button type="button" className={styles.mini} onClick={() => onAction("skip", step)}>
                      <SkipForward size={14} strokeWidth={1.75} aria-hidden="true" />
                      Skip
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <span className={styles.trail}>
          <AnimatePresence initial={false}>
            {draft ? (
              <motion.span key="remove" className={styles.trailItem} {...swapProps}>
                <button
                  ref={register(`remove:${step.id}`)}
                  type="button"
                  className={styles.remove}
                  aria-label={`Remove step ${index + 1}: ${label}`}
                  onClick={() => onRemove(step.id, "next")}
                >
                  <X size={14} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </motion.span>
            ) : state === "done" && step.duration != null ? (
              <motion.span key="time" className={styles.trailItem} {...swapProps}>
                {formatDuration(step.duration)}
              </motion.span>
            ) : state === "skipped" ? (
              <motion.span key="skipped" className={styles.trailItem} {...swapProps} aria-hidden="true">
                Skipped
              </motion.span>
            ) : null}
          </AnimatePresence>
        </span>
      </div>
    </Reorder.Item>
  );
}

/**
 * A plan the agent proposes before it acts. While it is a draft every step is a text field that can
 * be renamed, reordered (drag the grip, or Up/Down on it; Alt+Up/Down from the title) or removed;
 * approving it runs the steps, streams their activity, pauses on request and can fail a step so it
 * can be retried or skipped. Omit `status` to drive the whole thing with the built-in simulation.
 */
export default function AgentPlan({
  steps,
  status,
  goal = "Add rate limiting to the public API",
  model = DEFAULT_MODEL,
  summary,
  onApprove,
  onChange,
  onStepAction,
  onKeepPlanning,
  onPauseChange,
  className,
}: AgentPlanProps) {
  const reduced = useReducedMotion() ?? false;
  const simulate = status === undefined;
  const hintId = useId();

  const [rows, setRows] = useState<AgentPlanStep[]>(() => steps ?? DEFAULT_STEPS);
  const [stepsProp, setStepsProp] = useState(steps);
  if (steps !== stepsProp) {
    setStepsProp(steps);
    if (steps) setRows(steps);
  }

  const [localStatus, setLocalStatus] = useState<AgentPlanStatus>("draft");
  const phase = status ?? localStatus;
  const draft = phase === "draft";
  const paused = phase === "paused";

  const [announcement, setAnnouncement] = useState("");
  const [planning, setPlanning] = useState(false);
  const [suggestedCount, setSuggestedCount] = useState(0);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [suggestedIds, setSuggestedIds] = useState<Set<string>>(() => new Set());
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());

  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  });

  const runRef = useRef<{ attempts: Map<string, number>; inserted: Set<string> }>({
    attempts: new Map(),
    inserted: new Set(),
  });
  const suggestionTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(suggestionTimer.current), []);

  const counter = useRef(0);
  const focusables = useRef(new Map<string, HTMLElement>());
  const pendingFocus = useRef<{ key: string; at: number } | null>(null);

  const register: Register = useCallback(
    (key) => (node) => {
      if (node) focusables.current.set(key, node);
      else focusables.current.delete(key);
    },
    [],
  );

  const focusAfter = (key: string) => {
    pendingFocus.current = { key, at: Date.now() };
  };

  useLayoutEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    if (Date.now() - pending.at > 1500) {
      pendingFocus.current = null;
      return;
    }
    const target = focusables.current.get(pending.key);
    if (!target) return;
    pendingFocus.current = null;
    if (document.activeElement !== target) target.focus({ preventScroll: true });
  });

  const total = rows.length;
  const finished = rows.filter(isFinished).length;
  const current = phase === "done" ? total : Math.min(total, finished + 1);
  const failedAt = rows.findIndex((row) => row.state === "failed");
  const elapsed = rows.reduce((sum, row) => sum + (row.state === "done" ? (row.duration ?? 0) : 0), 0);
  const closing = summary ?? (simulate ? DEFAULT_SUMMARY : undefined);
  const canSuggest = !simulate || suggestedCount < SUGGESTIONS.length;

  function commitRows(next: AgentPlanStep[], message?: string) {
    setRows(next);
    onChange?.(next);
    if (message) setAnnouncement(message);
  }

  const rename = (id: string, title: string) => setRows((rows) => patchStep(rows, id, { title }));

  function commit(id: string, changed: boolean) {
    const row = rowsRef.current.find((entry) => entry.id === id);
    if (!row) return;
    if (!row.title.trim()) {
      commitRows(
        rowsRef.current.filter((entry) => entry.id !== id),
        "Removed the empty step",
      );
      return;
    }
    if (changed) {
      onChange?.(rowsRef.current);
      setAnnouncement(`Renamed step to ${row.title}`);
    }
  }

  function remove(id: string, side: "previous" | "next") {
    const at = rows.findIndex((row) => row.id === id);
    const gone = rows[at];
    if (!gone) return;
    const rest = rows.filter((row) => row.id !== id);
    const next = side === "previous" ? (rest[at - 1] ?? rest[at]) : (rest[at] ?? rest[at - 1]);
    focusAfter(next ? `${side === "previous" ? "field" : "remove"}:${next.id}` : "add");
    commitRows(rest, `Removed ${gone.title || "the empty step"}`);
  }

  function move(id: string, delta: number, mode: "field" | "grip") {
    const at = rows.findIndex((row) => row.id === id);
    const to = at + delta;
    if (at < 0 || to < 0 || to >= rows.length) return;
    const next = [...rows];
    [next[at], next[to]] = [next[to], next[at]];
    focusAfter(`${mode}:${id}`);
    commitRows(next, `Moved to position ${to + 1} of ${next.length}`);
  }

  const streamDone = useCallback(() => {
    setStreamingId(null);
    onChange?.(rowsRef.current);
    setAnnouncement("Suggested one more step. Edit, move or remove it before approving.");
  }, [onChange]);

  function act(type: "retry" | "skip", step: AgentPlanStep) {
    onStepAction?.({ type, step });
    focusAfter("pause");
    if (!simulate) return;
    if (type === "retry") {
      runRef.current.attempts.set(step.id, (runRef.current.attempts.get(step.id) ?? 0) + 1);
      setRows((rows) => patchStep(rows, step.id, { state: "active", error: undefined }));
      setAnnouncement(`Retrying ${step.title}`);
    } else {
      setRows((rows) => patchStep(rows, step.id, { state: "skipped", error: undefined }));
      setAnnouncement(`Skipped ${step.title}`);
    }
  }

  useEffect(() => {
    let delay: number;
    let run: () => void;
    if (!simulate || phase !== "running" || rows.some((row) => row.state === "failed")) return;
    const activeAt = rows.findIndex((row) => row.state === "active");
    if (activeAt < 0) {
      const next = rows.find((row) => (row.state ?? "pending") === "pending");
      if (next) {
        delay = 260;
        run = () => setRows((rows) => patchStep(rows, next.id, { state: "active", substeps: [] }));
      } else {
        delay = 420;
        run = () => {
          setLocalStatus("done");
          const spent = rowsRef.current.reduce(
            (sum, row) => sum + (row.state === "done" ? (row.duration ?? 0) : 0),
            0,
          );
          setAnnouncement(`Plan done in ${formatDuration(spent)}. ${DEFAULT_SUMMARY}`);
        };
      }
    } else {
      const row = rows[activeAt];
      const script = SCRIPT[row.id] ?? FALLBACK_SCRIPT;
      const attempts = runRef.current.attempts.get(row.id) ?? 0;
      const lines = attempts > 0 && script.fail ? [...script.substeps, ...script.fail.retry] : script.substeps;
      const have = row.substeps?.length ?? 0;
      const insert = script.insert;
      if (
        insert &&
        have >= insert.after &&
        !runRef.current.inserted.has(insert.step.id) &&
        !rows.some((entry) => entry.id === insert.step.id)
      ) {
        delay = 420;
        run = () => {
          runRef.current.inserted.add(insert.step.id);
          setFreshIds((ids) => new Set(ids).add(insert.step.id));
          setRows((rows) => {
            const at = rows.findIndex((entry) => entry.id === row.id);
            const next = [...rows];
            next.splice(at + 1, 0, { ...insert.step, state: "pending" });
            return next;
          });
          setAnnouncement(`The agent added a step: ${insert.step.title}`);
        };
      } else if (have < lines.length) {
        delay = have === 0 ? 360 : 540;
        run = () =>
          setRows((rows) =>
            patchStep(rows, row.id, {
              substeps: [...(rows.find((entry) => entry.id === row.id)?.substeps ?? []), lines[have]],
            }),
          );
      } else if (script.fail && attempts === 0) {
        delay = 520;
        run = () => {
          setRows((rows) => patchStep(rows, row.id, { state: "failed", error: script.fail?.error }));
          setAnnouncement(`Step ${activeAt + 1} failed: ${script.fail?.error}. Retry or skip it.`);
        };
      } else {
        delay = 480;
        run = () => {
          setRows((rows) => patchStep(rows, row.id, { state: "done", duration: script.duration }));
          setAnnouncement(`Done: ${row.title}`);
        };
      }
    }
    const timer = window.setTimeout(run, delay);
    return () => window.clearTimeout(timer);
  }, [simulate, phase, rows]);

  const swapProps = swap(reduced);
  const statusText =
    failedAt >= 0
      ? `Step ${failedAt + 1} failed`
      : paused
        ? `Paused on step ${current}`
        : `Working on step ${current}`;

  return (
    <section className={[styles.root, className].filter(Boolean).join(" ")} aria-label={`${model.name} plan: ${goal}`} data-status={phase}>
      <header className={styles.header}>
        <div className={styles.headRow}>
          {model.mark && (
            <span className={styles.mark} aria-hidden="true">
              {model.mark}
            </span>
          )}
          <h3 className={styles.heading}>
            Plan
            <span className={styles.count}>
              <span aria-hidden="true"> · </span>
              <Roll value={total} reduced={reduced} /> {total === 1 ? "step" : "steps"}
            </span>
          </h3>
          <span className={styles.headMeta}>
            <AnimatePresence initial={false}>
              {draft ? (
                <motion.span key="model" {...swapProps}>
                  {model.name}
                </motion.span>
              ) : (
                <motion.span key="count" {...swapProps}>
                  <Roll value={current} reduced={reduced} /> of <Roll value={total} reduced={reduced} />
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </div>
        {goal && (
          <p className={[styles.goal, !model.mark ? styles.goalFlush : ""].filter(Boolean).join(" ")}>{goal}</p>
        )}
        <div
          className={styles.progress}
          role="progressbar"
          aria-label="Plan progress"
          aria-hidden={draft || undefined}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={finished}
          aria-valuetext={`${finished} of ${total} steps finished`}
        >
          <motion.span
            className={styles.fill}
            initial={false}
            animate={{ scaleX: draft || !total ? 0 : finished / total, opacity: draft ? 0 : 1 }}
            transition={reduced ? instant : { scaleX: heightSpring, opacity: noteTransition }}
          />
        </div>
      </header>

      <div className={styles.listWrap}>
        <span id={hintId} className={styles.srOnly}>
          Alt plus Arrow up or down moves a step. Escape undoes a rename.
        </span>
        <Reorder.Group
          as="ol"
          axis="y"
          values={rows.map((row) => row.id)}
          onReorder={(order) =>
            setRows((rows) =>
              order
                .map((id) => rows.find((row) => row.id === id))
                .filter((row): row is AgentPlanStep => !!row),
            )
          }
          className={styles.list}
          aria-label="Plan steps"
        >
          <AnimatePresence initial={false}>
            {rows.map((row, at) => (
              <StepRow
                key={row.id}
                step={row}
                index={at}
                draft={draft}
                paused={paused}
                reduced={reduced}
                streaming={streamingId === row.id}
                note={row.note ?? (draft && suggestedIds.has(row.id) ? "Suggested" : undefined)}
                fresh={freshIds.has(row.id)}
                mark={model.mark}
                hintId={hintId}
                register={register}
                onRename={rename}
                onCommit={commit}
                onRemove={remove}
                onMove={move}
                onAction={act}
                onDragEnd={() => onChange?.(rowsRef.current)}
                onStreamDone={streamDone}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>
        {!rows.length && <p className={styles.empty}>No steps yet. Add one or keep planning.</p>}
        <AnimatePresence initial={false}>
          {draft && (
            <motion.div
              key="add"
              className={styles.collapse}
              initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={
                reduced
                  ? { opacity: 0, transition: instant }
                  : { height: 0, opacity: 0, transition: { ...heightSpring, opacity: shortExit } }
              }
              transition={reduced ? instant : { height: heightSpring, opacity: noteTransition }}
            >
              <button
                ref={register("add")}
                type="button"
                className={styles.add}
                onClick={() => {
                  counter.current += 1;
                  const id = `step-${counter.current}-${Date.now().toString(36)}`;
                  focusAfter(`field:${id}`);
                  commitRows([...rows, { id, title: "" }], "Added an empty step");
                }}
              >
                <span className={styles.lead}>
                  <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
                </span>
                Add step
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <HeightSpring className={styles.footWrap} reduced={reduced}>
        <div className={styles.foot}>
          <AnimatePresence mode="popLayout" initial={false}>
            {draft ? (
              <motion.div key="draft" className={styles.footRow} data-phase="draft" {...swapProps}>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={planning}
                  disabled={!canSuggest && !planning}
                  onClick={() => {
                    onKeepPlanning?.();
                    if (!simulate || planning || streamingId) return;
                    const suggestion = SUGGESTIONS[suggestedCount];
                    if (!suggestion) return;
                    setPlanning(true);
                    setAnnouncement("Planning one more step");
                    suggestionTimer.current = window.setTimeout(() => {
                      setPlanning(false);
                      setSuggestedCount((count) => count + 1);
                      setSuggestedIds((ids) => new Set(ids).add(suggestion.id));
                      setStreamingId(suggestion.id);
                      setRows((rows) => {
                        if (rows.some((row) => row.id === suggestion.id)) return rows;
                        const next = [...rows];
                        next.splice(Math.max(0, rows.length - 1), 0, { ...suggestion });
                        return next;
                      });
                    }, 720);
                  }}
                >
                  Keep planning
                </Button>
                <Button
                  ref={register("approve")}
                  size="sm"
                  className={styles.approve}
                  disabled={!rows.some((row) => row.title.trim())}
                  onClick={() => {
                    const approved = rows
                      .filter((row) => row.title.trim())
                      .map((row) => ({ ...row, title: row.title.trim() }));
                    if (!approved.length) return;
                    onApprove?.(approved);
                    window.clearTimeout(suggestionTimer.current);
                    setPlanning(false);
                    setStreamingId(null);
                    focusAfter("pause");
                    if (!simulate) return;
                    runRef.current = { attempts: new Map(), inserted: new Set() };
                    setRows(
                      approved.map((row) => ({
                        ...row,
                        state: "pending" as const,
                        substeps: [],
                        error: undefined,
                        duration: undefined,
                      })),
                    );
                    setLocalStatus("running");
                    setAnnouncement(`Plan approved. Running ${approved.length} steps as a simulation.`);
                  }}
                >
                  Approve plan
                </Button>
              </motion.div>
            ) : phase === "done" ? (
              <motion.div key="done" className={styles.footRow} data-phase="done" {...swapProps}>
                <p className={styles.summary}>
                  <strong>{elapsed ? `Done in ${formatDuration(elapsed)}.` : "Done."}</strong>
                  {closing && (
                    <>
                      {" "}
                      <StreamText text={closing} />
                    </>
                  )}
                </p>
                {simulate && (
                  <Button
                    ref={register("startOver")}
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      runRef.current = { attempts: new Map(), inserted: new Set() };
                      setRows(steps ?? DEFAULT_STEPS);
                      setLocalStatus("draft");
                      setSuggestedCount(0);
                      setSuggestedIds(new Set());
                      setFreshIds(new Set());
                      focusAfter("approve");
                      setAnnouncement("Back to the draft plan");
                    }}
                  >
                    <RotateCw size={16} strokeWidth={1.75} aria-hidden="true" />
                    Start over
                  </Button>
                )}
              </motion.div>
            ) : (
              <motion.div key="run" className={styles.footRow} data-phase="run" {...swapProps}>
                <span className={styles.footStatus}>
                  <AnimatePresence initial={false}>
                    <motion.span key={statusText} {...swapProps}>
                      {statusText}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <AnimatePresence initial={false}>
                  {failedAt < 0 && (
                    <motion.span key="pause" className={styles.pauseSlot} {...swapProps}>
                      <Button
                        ref={register("pause")}
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const next = phase === "running";
                          onPauseChange?.(next);
                          if (simulate) setLocalStatus(next ? "paused" : "running");
                          setAnnouncement(next ? "Paused" : "Resumed");
                        }}
                      >
                        {paused ? (
                          <>
                            <Play size={16} strokeWidth={1.75} aria-hidden="true" />
                            Resume
                          </>
                        ) : (
                          <>
                            <Pause size={16} strokeWidth={1.75} aria-hidden="true" />
                            Pause
                          </>
                        )}
                      </Button>
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </HeightSpring>

      <p className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}

export { AgentPlan };
