"use client";

import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { ChevronDown, FilePen, FileText, Globe, Play, RotateCcw, Search, Square, Wrench, Zap } from "lucide-react";
import Button from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import SegmentedControl from "../segmented-control/segmented-control";
import TextShimmer from "../text-shimmer/text-shimmer";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./agent-orchestrator.module.css";

/* ── Public types ───────────────────────────────────────────────────────────── */

/** One unit of work the lead hands to a subagent. */
export interface OrchestratorSubtask {
  id: string;
  /** Short label shown in the plan and on the lane. */
  title: string;
  /** The brief the subagent works from; also the lane's placeholder text. */
  instruction?: string;
  /** Worker id this subtask belongs to. Unset lets the lead pick a free lane. */
  workerId?: string;
}

/** A subagent lane: an id, a display name, and an optional brand mark. */
export interface OrchestratorWorker {
  id: string;
  name: string;
  mark?: ReactNode;
}

/** The lead that plans and merges. */
export interface OrchestratorLead {
  name: string;
  mark?: ReactNode;
}

/** Everything a run hook needs. `concurrency()` reads the live limit, not the one at start. */
export interface OrchestratorRunContext {
  goal: string;
  plan: OrchestratorSubtask[];
  workers: { id: string; name: string }[];
  concurrency: () => number;
  signal: AbortSignal;
}

/** The event stream a run yields. Every field is optional except the discriminator. */
export type OrchestratorEvent =
  | { type: "plan"; subtask: OrchestratorSubtask }
  | { type: "dispatch"; subtaskId: string }
  | { type: "tool"; subtaskId: string; tool: string; target?: string }
  | { type: "toolResult"; subtaskId: string; detail?: string }
  | { type: "output"; subtaskId: string; delta: string; newLine?: boolean }
  | { type: "usage"; subtaskId?: string; tokens: number; cost: number }
  | { type: "error"; subtaskId: string; message: string; retryInMs?: number }
  | { type: "retry"; subtaskId: string; attempt: number }
  | { type: "result"; subtaskId: string; text?: string }
  | { type: "fail"; subtaskId: string; message: string }
  | { type: "summary"; delta: string }
  | { type: "done" };

export type OrchestratorRun = (context: OrchestratorRunContext) => AsyncIterable<OrchestratorEvent>;

/** One lane's worth of the finished run. */
export interface OrchestratorLaneResult {
  subtaskId: string;
  workerId: string;
  status: LanePhase;
  text: string;
  tokens: number;
  cost: number;
  ms: number;
}

export interface OrchestratorResult {
  summary: string;
  tokens: number;
  cost: number;
  wallMs: number;
  sequentialMs: number;
  speedup: number;
  lanes: OrchestratorLaneResult[];
}

export interface AgentOrchestratorProps {
  /** The brief at the top of the card. It is the card's heading. */
  goal?: string;
  /** Subtasks the lead will plan. Defaults to the four-competitor sample. */
  plan?: OrchestratorSubtask[];
  /** Subagent lanes, one per model. Defaults to four. */
  workers?: OrchestratorWorker[];
  /** The lead that plans and merges. */
  lead?: OrchestratorLead;
  /** Event source. Defaults to the built-in simulation. */
  run?: OrchestratorRun;
  /** Controlled concurrency limit, 1–4. Leave unset to keep the limit internal. */
  concurrency?: number;
  /** Starting limit when the limit is uncontrolled. */
  defaultConcurrency?: number;
  onConcurrencyChange?: (concurrency: number) => void;
  /** Start on its own once the card scrolls into view. Never with reduced motion. */
  autoStart?: boolean;
  onComplete?: (result: OrchestratorResult) => void;
  className?: string;
}

/* ── Sample data ────────────────────────────────────────────────────────────── */

interface ScriptStep {
  tool: string;
  target?: string;
  ms: number;
  output: string;
  detail?: string;
  input: number;
  outputTokens: number;
  failsWith?: string;
}

interface Script {
  steps: ScriptStep[];
  result: string;
}

const samplePlan: OrchestratorSubtask[] = [
  { id: "notewise", title: "Notewise seat pricing", instruction: "Compare Notewise seat pricing and limits with our Team plan", workerId: "sonnet" },
  { id: "paperlane", title: "Paperlane free tier", instruction: "Check what the Paperlane free tier includes and caps", workerId: "haiku" },
  { id: "quillstack", title: "Quillstack discounts", instruction: "Find the Quillstack annual discount and trial terms", workerId: "flash" },
  { id: "driftboard", title: "Driftboard add-ons", instruction: "Map the Driftboard business tier and its paid add-ons", workerId: "luna" },
];

const prices: Record<string, { input: number; output: number }> = {
  opus: { input: 4, output: 20 },
  sonnet: { input: 2, output: 10 },
  haiku: { input: 0.1, output: 0.5 },
  flash: { input: 0.3, output: 2.5 },
  luna: { input: 0.4, output: 2 },
};

const scripts: Record<string, Script> = {
  notewise: {
    steps: [
      { tool: "search", target: "notewise pricing per seat 2026", ms: 1500, output: "The pricing page and a September changelog post are the top results", detail: "6 results", input: 3200, outputTokens: 240 },
      { tool: "fetch", target: "notewise.io/pricing", ms: 2300, output: "Team is $10 per seat on yearly billing and includes unlimited guests", detail: "Read 3,140 words", input: 14800, outputTokens: 420 },
      { tool: "read", target: "docs/pricing.md", ms: 1600, output: "Our Team plan is $12 per seat and caps guests at 5 per workspace", detail: "Read 212 lines", input: 8600, outputTokens: 310 },
      { tool: "write", ms: 1900, output: "Notewise undercuts our Team plan by $2 per seat and adds unlimited guests", input: 2400, outputTokens: 1180 },
    ],
    result: "Notewise undercuts our Team plan by $2 per seat and adds unlimited guests.",
  },
  paperlane: {
    steps: [
      { tool: "fetch", target: "paperlane.com/pricing", ms: 1900, output: "The free plan allows 5 members, 2 GB of storage and 30 days of history", detail: "Read 2,260 words", input: 9600, outputTokens: 260 },
      { tool: "search", target: "paperlane free plan limits", ms: 1500, output: "A help article confirms the free plan has no guest seats", detail: "4 results", input: 3100, outputTokens: 180 },
      { tool: "read", target: "docs/pricing.md", ms: 1300, output: "Our free plan stops at 3 members and 1 GB of storage", detail: "Read 212 lines", input: 4300, outputTokens: 150 },
      { tool: "write", ms: 1600, output: "Paperlane fits 5 members on its free plan where ours stops at 3", input: 1200, outputTokens: 690 },
    ],
    result: "Paperlane fits 5 members on its free plan where ours stops at 3.",
  },
  quillstack: {
    steps: [
      { tool: "search", target: "quillstack annual billing discount", ms: 1400, output: "The pricing page and a billing FAQ both cover yearly plans", detail: "5 results", input: 2900, outputTokens: 210 },
      { tool: "fetch", target: "quillstack.dev/pricing", ms: 1700, output: "Annual billing saves 20 percent and the trial runs for 14 days", detail: "Read 1,980 words", input: 12400, outputTokens: 380, failsWith: "The page returned 503 Service Unavailable" },
      { tool: "write", ms: 1500, output: "Quillstack leads with a 20 percent yearly saving, and we never show ours", input: 2100, outputTokens: 820 },
    ],
    result: "Quillstack leads with a 20 percent yearly saving, and we never show ours.",
  },
  driftboard: {
    steps: [
      { tool: "search", target: "driftboard business plan sso", ms: 1400, output: "Found the pricing page and an add-ons comparison table", detail: "7 results", input: 3e3, outputTokens: 220 },
      { tool: "fetch", target: "driftboard.app/pricing", ms: 2100, output: "Business is $18 per seat, and SSO is a $4 add-on per seat", detail: "Read 2,710 words", input: 13100, outputTokens: 390 },
      { tool: "read", target: "docs/pricing.md", ms: 1400, output: "We include SSO only on Enterprise, which has no public price", detail: "Read 212 lines", input: 5200, outputTokens: 170 },
      { tool: "write", ms: 1700, output: "Driftboard sells SSO as a $4 add-on, while ours needs a sales call", input: 1900, outputTokens: 760 },
    ],
    result: "Driftboard sells SSO as a $4 add-on, while ours needs a sales call.",
  },
};

const fallbackScript: Script = {
  steps: [
    { tool: "search", target: "background for this subtask", ms: 1400, output: "Found a handful of relevant pages to read", detail: "5 results", input: 3e3, outputTokens: 200 },
    { tool: "fetch", target: "the most relevant page", ms: 1800, output: "Read the page and pulled out the numbers that matter", detail: "Read 2,000 words", input: 11e3, outputTokens: 340 },
    { tool: "write", ms: 1400, output: "Wrote a short finding for the lead agent", input: 1800, outputTokens: 640 },
  ],
  result: "Wrote a short finding for the lead agent.",
};

/** Thrown by the simulation's timers so an aborted run unwinds quietly. */
class RunAborted extends Error {}

const costOf = (price: { input: number; output: number }, input: number, output: number) => (input * price.input + output * price.output) / 1e6;

/** The simulator's chunker: flush as soon as the buffer reaches `limit` characters. */
function chunkEvery(text: string, limit = 48): string[] {
  const words = text.match(/\S+\s*/g) ?? [];
  const chunks: string[] = [];
  let buffer = "";
  for (const word of words) {
    buffer += word;
    if (buffer.length >= limit) {
      chunks.push(buffer);
      buffer = "";
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

/** The reveal chunker: 4/3/5/4/6 words, or 36 characters, whichever comes first. */
function chunkWords(text: string): string[] {
  const words = text.match(/\S+\s*/g) ?? [];
  const pattern = [4, 3, 5, 4, 6];
  const chunks: string[] = [];
  let buffer = "";
  let count = 0;
  for (const word of words) {
    buffer += word;
    count += 1;
    if (count >= pattern[chunks.length % pattern.length] || buffer.length >= 36) {
      chunks.push(buffer);
      buffer = "";
      count = 0;
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

interface EventQueue extends AsyncIterable<OrchestratorEvent> {
  push(event: OrchestratorEvent): void;
  close(): void;
}

function createEventQueue(): EventQueue {
  const items: OrchestratorEvent[] = [];
  let resume: (() => void) | null = null;
  let closed = false;
  const flush = () => {
    const next = resume;
    resume = null;
    next?.();
  };
  return {
    push(event) {
      if (closed) return;
      items.push(event);
      flush();
    },
    close() {
      closed = true;
      flush();
    },
    async *[Symbol.asyncIterator](): AsyncGenerator<OrchestratorEvent> {
      for (;;) {
        const next = items.shift();
        if (next) {
          yield next;
          continue;
        }
        if (closed) return;
        await new Promise<void>((resolve) => {
          resume = resolve;
        });
      }
    },
  };
}

/**
 * The default event source: four scripted research runs on a slightly staggered clock, one
 * deliberate 503 and its retry, then a streamed summary. Nothing leaves the page.
 */
export function simulateOrchestration(context: OrchestratorRunContext): AsyncIterable<OrchestratorEvent> {
  const { plan, workers, concurrency, signal } = context;
  const queue = createEventQueue();
  const emit = (event: OrchestratorEvent) => {
    if (!signal.aborted) queue.push(event);
  };
  const sleep = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new RunAborted());
        return;
      }
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      function onAbort() {
        clearTimeout(timer);
        reject(new RunAborted());
      }
      signal.addEventListener("abort", onAbort, { once: true });
    });

  /**
   * Paced waits: the scripted beats are measured from a fixed timeline instead of chaining
   * `setTimeout`, so a slow frame during a render cannot stretch the run. Each concurrent task
   * gets its own pacer, so lanes stay independent.
   */
  const pacer = () => {
    let deadline = performance.now();
    return (ms: number) => {
      deadline += ms;
      return sleep(Math.max(0, deadline - performance.now()));
    };
  };

  const leadPrice = prices.opus;
  const workerIdOf = (subtask: OrchestratorSubtask, index: number) => subtask.workerId ?? workers[index]?.id ?? "";

  async function runSubtask(subtask: OrchestratorSubtask, index: number) {
    const script = scripts[subtask.id] ?? fallbackScript;
    const price = prices[workerIdOf(subtask, index)] ?? { input: 1, output: 5 };
    const id = subtask.id;
    await sleep(460);
    let attempt = 1;
    for (const step of script.steps) {
      const failure = step.failsWith;
      let fails = Boolean(failure);
      for (;;) {
        emit({ type: "tool", subtaskId: id, tool: step.tool, target: step.target });
        let failed = false;
        for (let quarter = 0; quarter < 4; quarter += 1) {
          await sleep(step.ms / 4);
          if (fails && failure && quarter === 2) {
            emit({ type: "usage", subtaskId: id, tokens: Math.round(0.3 * step.input), cost: costOf(price, 0.3 * step.input, 0) });
            emit({ type: "error", subtaskId: id, message: failure, retryInMs: 2e3 });
            failed = true;
            break;
          }
          const input = step.input / 4;
          const output = step.outputTokens / 4;
          emit({ type: "usage", subtaskId: id, tokens: Math.round(input + output), cost: costOf(price, input, output) });
          if (quarter === 0) {
            chunkEvery(step.output).forEach((delta, chunk) => {
              emit({ type: "output", subtaskId: id, delta, newLine: chunk === 0 });
            });
          }
        }
        if (!failed) {
          emit({ type: "toolResult", subtaskId: id, detail: step.detail });
          break;
        }
        await sleep(2e3);
        fails = false;
        attempt += 1;
        emit({ type: "retry", subtaskId: id, attempt });
      }
    }
    emit({ type: "result", subtaskId: id, text: script.result });
  }

  (async () => {
    const planWait = pacer();
    await planWait(520);
    for (const [index, subtask] of plan.entries()) {
      emit({ type: "plan", subtask: { ...subtask, workerId: workerIdOf(subtask, index) } });
      const share = 1 / plan.length;
      emit({ type: "usage", tokens: Math.round(4720 * share), cost: costOf(leadPrice, 4100 * share, 620 * share) });
      await planWait(index === plan.length - 1 ? 360 : 230);
    }
    const pending = plan.map((subtask, index) => ({ subtask, index }));
    const running: Promise<void>[] = [];
    let active = 0;
    let wake = () => {};
    while (pending.length || active) {
      const next = pending.shift();
      if (next && active < Math.max(1, concurrency())) {
        const { subtask, index } = next;
        active += 1;
        emit({ type: "dispatch", subtaskId: subtask.id });
        running.push(
          runSubtask(subtask, index)
            .catch(() => {})
            .finally(() => {
              active -= 1;
              wake();
            }),
        );
        await sleep(110);
        continue;
      }
      if (next) pending.unshift(next);
      await Promise.race([
        new Promise<void>((resolve) => {
          wake = resolve;
        }),
        sleep(150),
      ]);
    }
    await Promise.all(running);
    if (signal.aborted) return;
    const tailWait = pacer();
    await tailWait(600);
    const summary = chunkEvery(
      "We charge more than Notewise and Quillstack for a smaller package, and our free plan is the tightest of the five. Three changes would close the gap:\n- Cut Team to $10 per seat on yearly billing to match Notewise.\n- Raise the free plan from 3 to 5 members, as Paperlane does.\n- Show the yearly saving on the page and sell SSO as a paid add-on.",
      36,
    );
    for (const [index, delta] of summary.entries()) {
      emit({ type: "summary", delta });
      const share = 1 / summary.length;
      emit({ type: "usage", tokens: Math.round(10680 * share), cost: costOf(leadPrice, 9800 * share, 880 * share) });
      if (index < summary.length - 1) await tailWait(70);
    }
    emit({ type: "done" });
  })()
    .catch(() => {})
    .finally(() => queue.close());

  return queue;
}

/* ── Motion presets ─────────────────────────────────────────────────────────── */

const { duration: durations, ease: eases } = motionTokens;
const enterEase = [...eases.enter] as [number, number, number, number];
const standardEase = [...eases.standard] as [number, number, number, number];
const springSnap = { type: "spring", visualDuration: 0.26, bounce: 0 } as const;
const fadeIn = { duration: durations.fast, ease: enterEase };
const fadeOut = { duration: 0.1, ease: standardEase };
const instant = { duration: 0 };

/** Bookkeeping fields for the crossfades: a 100ms out, a 160ms in from 2px below. */
function swapMotion(reduced: boolean) {
  return {
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 2 },
    animate: { opacity: 1, y: 0, transition: reduced ? instant : fadeIn },
    exit: { opacity: 0, transition: reduced ? instant : fadeOut },
  };
}

const subscribeHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const cls = (...values: (string | false | undefined)[]) => values.filter(Boolean).join(" ");

/* ── Glyphs ─────────────────────────────────────────────────────────────────── */

type GlyphKind = "idle" | "active" | "queued" | "done" | "error" | "stopped";

function Glyph({ kind, reduced }: { kind: GlyphKind; reduced: boolean }) {
  switch (kind) {
    case "active":
      return (
        <svg viewBox="0 0 16 16" className={reduced ? undefined : styles.spin} aria-hidden="true">
          <circle cx="8" cy="8" r="6.25" className={styles.gTrack} />
          <path d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25" className={styles.gArc} />
        </svg>
      );
    case "queued":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.25" className={styles.gQueued} />
          <path d="M8 5v3.2l2 1.3" className={styles.gHands} />
        </svg>
      );
    case "done":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="7" className={styles.gDone} />
          <motion.path
            d="M5 8.25 7.1 10.3 11 6"
            className={styles.gInk}
            initial={{ pathLength: reduced ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={reduced ? instant : { duration: 0.22, ease: enterEase, delay: 0.04 }}
          />
        </svg>
      );
    case "error":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="7" className={styles.gError} />
          <path d="M8 4.9v3.6" className={styles.gInk} />
          <circle cx="8" cy="11.1" r=".95" className={styles.gInkDot} />
        </svg>
      );
    case "stopped":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.25" className={styles.gIdle} />
          <rect x="5.6" y="5.6" width="4.8" height="4.8" rx="1" className={styles.gStop} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.25" className={styles.gIdle} />
        </svg>
      );
  }
}

const toolLabels: Record<string, string> = {
  search: "Web search",
  fetch: "Fetch page",
  read: "Read file",
  write: "Write findings",
};

const toolLabel = (kind: string) => toolLabels[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);

function ToolIcon({ kind, size = 14 }: { kind: string; size?: number }) {
  const Icon = kind === "search" ? Search : kind === "fetch" ? Globe : kind === "read" ? FileText : kind === "write" ? FilePen : Wrench;
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
}

/* ── Formatters ─────────────────────────────────────────────────────────────── */

const compact = (value: number) => (value < 1e3 ? String(Math.round(value)) : `${(value / 1e3).toFixed(1)}k`);
const money = (value: number) => `$${value.toFixed(value < 0.1 ? 3 : 2)}`;
const seconds = (ms: number) => `${(Math.max(0, ms) / 1e3).toFixed(1)}s`;

/* ── Clocks and counters ────────────────────────────────────────────────────── */

function useClock(enabled: boolean, tick = 100) {
  const [now, setNow] = useState(() => (typeof performance === "undefined" ? 0 : performance.now()));
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setNow(performance.now()), tick);
    return () => window.clearInterval(timer);
  }, [enabled, tick]);
  return now;
}

/** A live tenth-of-a-second timer that freezes on `to`. */
function Elapsed({ from, to, className }: { from?: number; to?: number; className?: string }) {
  const now = useClock(from !== undefined && to === undefined);
  const span = from === undefined ? 0 : (to ?? Math.max(now, from)) - from;
  return <span className={cls(styles.tabular, className)}>{seconds(span)}</span>;
}

function Countdown({ at }: { at: number }) {
  const now = useClock(true, 200);
  return <span className={styles.tabular}>{Math.max(1, Math.ceil((at - now) / 1e3))}s</span>;
}

/** Springs a number to its new value; a smaller value jumps so a reset never counts backwards. */
function Counter({ value, format, reduced, className }: { value: number; format: (value: number) => string; reduced: boolean; className?: string }) {
  const motionValue = useMotionValue(value);
  const text = useTransform(motionValue, format);
  useEffect(() => {
    if (reduced || value < motionValue.get()) {
      motionValue.jump(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: 0.42, ease: enterEase });
    return () => controls.stop();
  }, [value, reduced, motionValue]);
  return <motion.span className={cls(styles.tabular, className)}>{text}</motion.span>;
}

/* ── Streamed text ──────────────────────────────────────────────────────────── */

/**
 * Reveals `target` units of text on a requestAnimationFrame clock: roughly a unit every 36ms,
 * speeding up while a lot is still queued so a long line never lags far behind.
 */
function useTyped(target: number, instantText: boolean) {
  const [typed, setTyped] = useState(instantText ? target : 0);
  const current = useRef(instantText ? target : 0);
  useEffect(() => {
    if (instantText) {
      current.current = target;
      return;
    }
    if (current.current > target) current.current = target;
    if (current.current >= target) return;
    let frame = 0;
    let last = performance.now() - 36;
    const tick = (now: number) => {
      const steps = Math.floor((now - last) / 36);
      if (steps > 0) {
        const remaining = target - current.current;
        current.current = Math.min(target, current.current + steps + Math.floor(remaining / 12));
        last += 36 * steps;
        setTyped(current.current);
      }
      if (current.current < target) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, instantText]);
  return instantText ? target : Math.min(typed, target);
}

/** The single streaming output line, shifting left when it outgrows its lane. */
function Ticker({ text, reduced, settled }: { text: string; reduced: boolean; settled?: boolean }) {
  const chunks = useMemo(() => chunkWords(text), [text]);
  const typed = useTyped(chunks.length, reduced || Boolean(settled));
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const box = outer.current;
    const line = inner.current;
    if (!box || !line || settled) return;
    const overflow = Math.max(0, Math.ceil(line.scrollWidth - box.clientWidth));
    line.style.transform = overflow ? `translateX(${-overflow}px)` : "";
    box.toggleAttribute("data-shifted", overflow > 0);
  });
  return (
    <span ref={outer} className={styles.ticker} data-settled={settled || undefined}>
      <span ref={inner} className={styles.tickerText} data-still={reduced || undefined}>
        {chunks.slice(0, typed).map((chunk, index) => (
          <span key={index} className={settled || reduced ? undefined : styles.chunk}>
            {chunk}
          </span>
        ))}
      </span>
    </span>
  );
}

/** Inline chunk reveal used by the plan rows. */
function StreamChunks({ text, reduced }: { text: string; reduced: boolean }) {
  const chunks = useMemo(() => chunkWords(text), [text]);
  const typed = useTyped(chunks.length, reduced);
  return (
    <>
      {chunks.slice(0, typed).map((chunk, index) => (
        <span key={index} className={reduced ? undefined : styles.chunk}>
          {chunk}
        </span>
      ))}
    </>
  );
}

interface SummaryRow {
  row: number;
  item: boolean;
  chunks: { key: string; chunk: string }[];
}

/**
 * The streamed summary: a paragraph, then a bulleted list as soon as a row starts with "- ".
 * `onSettled` fires once every chunk is on screen, which is what reveals the totals.
 */
function SummaryText({ text, reduced, complete, onSettled }: { text: string; reduced: boolean; complete: boolean; onSettled: () => void }) {
  const rows = useMemo(
    () =>
      text.split("\n").flatMap((line, row) => {
        const item = line.startsWith("- ");
        return chunkWords(item ? line.slice(2) : line).map((chunk, index) => ({ row, item, chunk, key: `${row}-${index}` }));
      }),
    [text],
  );
  const typed = useTyped(rows.length, reduced);
  const settledRef = useRef(onSettled);
  useEffect(() => {
    settledRef.current = onSettled;
  });
  useEffect(() => {
    if (complete && typed >= rows.length) settledRef.current();
  }, [complete, typed, rows.length]);

  const groups: SummaryRow[] = [];
  for (const row of rows.slice(0, typed)) {
    const last = groups[groups.length - 1];
    if (last && last.row === row.row) last.chunks.push(row);
    else groups.push({ row: row.row, item: row.item, chunks: [row] });
  }
  const paragraphs = groups.filter((group) => !group.item);
  const items = groups.filter((group) => group.item);
  const render = (group: SummaryRow) =>
    group.chunks.map((chunk) => (
      <span key={chunk.key} className={reduced ? undefined : styles.chunk}>
        {chunk.chunk}
      </span>
    ));

  return (
    <div className={styles.summaryText}>
      {paragraphs.map((group) => (
        <p key={group.row}>{render(group)}</p>
      ))}
      {items.length > 0 && <ul>{items.map((group) => <li key={group.row}>{render(group)}</li>)}</ul>}
    </div>
  );
}

/* ── Connectors ─────────────────────────────────────────────────────────────── */

interface PulseShape {
  id: number;
  d: string;
  color: string;
}

/** One travelling light along a connector. Runs once, then reports back so the sim can land. */
function Pulse({ pulse, onDone }: { pulse: PulseShape; onDone: (id: number) => void }) {
  const path = useRef<SVGPathElement>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useLayoutEffect(() => {
    const node = path.current;
    if (!node || typeof node.animate !== "function") {
      done.current(pulse.id);
      return;
    }
    const length = node.getTotalLength();
    node.style.strokeDasharray = `18 ${length + 18}`;
    node.style.strokeDashoffset = "18";
    const animation = node.animate([{ strokeDashoffset: 18 }, { strokeDashoffset: -length }], {
      duration: 460,
      easing: "cubic-bezier(.65,0,.35,1)",
      fill: "forwards",
    });
    animation.onfinish = () => done.current(pulse.id);
    return () => animation.cancel();
  }, [pulse.id]);
  return <path ref={path} d={pulse.d} className={styles.pulse} style={{ stroke: pulse.color }} />;
}

interface LaneBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface LaneWire {
  out: string;
  back?: string;
  port: [number, number];
  backPort?: [number, number];
  pulseOut: string;
  pulseBack: string;
}

interface WireLayout {
  width: number;
  height: number;
  trunk: string;
  lanes: LaneWire[];
}

export interface WireLane {
  color: string;
  out: boolean;
  back: boolean;
  dispatchKey?: number;
  returnKey?: number;
}

const half = (value: number) => Math.round(value) + 0.5;

/** Measures the flow and describes the bus: one trunk beside the lead, a branch per lane, a merge bus below. */
function measureWires(parent: HTMLElement, lead: HTMLElement, summary: HTMLElement, laneNodes: HTMLElement[]): WireLayout | null {
  if (!laneNodes.length) return null;
  const box = parent.getBoundingClientRect();
  const leadBox = lead.getBoundingClientRect();
  const summaryBox = summary.getBoundingClientRect();
  const originX = half(leadBox.left + leadBox.width / 2 - box.left);
  const originY = Math.round(leadBox.bottom - box.top) + 6;
  const targetX = half(summaryBox.left + summaryBox.width / 2 - box.left);
  const targetY = Math.round(summaryBox.top - box.top) - 6;
  const lanes: LaneBox[] = laneNodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return {
      left: Math.round(rect.left - box.left),
      right: Math.round(rect.right - box.left),
      top: Math.round(rect.top - box.top),
      bottom: Math.round(rect.bottom - box.top),
    };
  });
  const sideBySide = lanes.length > 1 && Math.abs(lanes[1].top - lanes[0].top) < 2;
  const size = { width: Math.round(box.width), height: Math.round(box.height) };

  if (sideBySide) {
    const top = Math.min(...lanes.map((lane) => lane.top));
    const bottom = Math.max(...lanes.map((lane) => lane.bottom));
    const busTop = half(top - 20);
    const busBottom = half(bottom + 20);
    const centers = lanes.map((lane) => half((lane.left + lane.right) / 2));
    const last = centers[centers.length - 1];
    return {
      ...size,
      trunk: `M${originX} ${originY}V${busTop - 8}Q${originX} ${busTop} ${originX + 8} ${busTop}H${last - 8}M${last - 8} ${busBottom}H${targetX + 8}Q${targetX} ${busBottom} ${targetX} ${busBottom + 8}V${targetY}`,
      lanes: lanes.map((lane, index) => {
        const center = centers[index];
        const isLast = index === lanes.length - 1;
        return {
          out: isLast ? `M${center - 8} ${busTop}Q${center} ${busTop} ${center} ${busTop + 8}V${lane.top}` : `M${center} ${busTop}V${lane.top}`,
          back: isLast ? `M${center} ${lane.bottom}V${busBottom - 8}Q${center} ${busBottom} ${center - 8} ${busBottom}` : `M${center} ${lane.bottom}V${busBottom}`,
          port: [center, lane.top + 0.5],
          backPort: [center, lane.bottom - 0.5],
          pulseOut: `M${originX} ${originY}V${busTop - 8}Q${originX} ${busTop} ${originX + 8} ${busTop}${isLast ? `H${center - 8}Q${center} ${busTop} ${center} ${busTop + 8}` : `H${center}`}V${lane.top}`,
          pulseBack: `M${center} ${lane.bottom}${isLast ? `V${busBottom - 8}Q${center} ${busBottom} ${center - 8} ${busBottom}` : `V${busBottom}`}H${targetX + 8}Q${targetX} ${busBottom} ${targetX} ${busBottom + 8}V${targetY}`,
        };
      }),
    };
  }

  return {
    ...size,
    trunk: `M${originX} ${originY}V${targetY}`,
    lanes: lanes.map((lane) => {
      const row = half(lane.top + 21);
      return {
        out: `M${originX} ${row}H${lane.left}`,
        port: [lane.left + 0.5, row],
        pulseOut: `M${originX} ${originY}V${row}H${lane.left}`,
        pulseBack: `M${lane.left} ${row}H${originX}V${targetY}`,
      };
    }),
  };
}

/**
 * The connector layer: redrawn from measured boxes on every resize, with one travelling pulse
 * per dispatch and per return. Purely decorative, so it is hidden from assistive tech.
 */
function Wires({
  lead,
  summary,
  nodes,
  lanes,
  reduced,
}: {
  lead: RefObject<HTMLSpanElement | null>;
  summary: RefObject<HTMLSpanElement | null>;
  nodes: RefObject<(HTMLDivElement | null)[]>;
  lanes: WireLane[];
  reduced: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [layout, setLayout] = useState<WireLayout | null>(null);
  const layoutRef = useRef<WireLayout | null>(null);
  const [pulses, setPulses] = useState<PulseShape[]>([]);
  const seen = useRef<{ out?: number; back?: number }[]>([]);
  const count = lanes.length;

  useLayoutEffect(() => {
    const parent = svg.current?.parentElement;
    const leadNode = lead.current;
    const summaryNode = summary.current;
    if (!parent || !leadNode || !summaryNode) return;
    const measure = () => {
      const next = measureWires(parent, leadNode, summaryNode, (nodes.current ?? []).slice(0, count).filter((node): node is HTMLDivElement => Boolean(node)));
      layoutRef.current = next;
      setLayout((previous) => (previous && next && JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    for (const node of nodes.current ?? []) if (node) observer.observe(node);
    return () => observer.disconnect();
  }, [lead, summary, nodes, count]);

  const lanesRef = useRef(lanes);
  lanesRef.current = lanes;
  const signature = lanes.map((lane) => `${lane.dispatchKey ?? ""}:${lane.returnKey ?? ""}`).join("|");
  useEffect(() => {
    const fresh: PulseShape[] = [];
    lanesRef.current.forEach((lane, index) => {
      const previous = seen.current[index] ?? {};
      const geometry = layoutRef.current?.lanes[index];
      if (lane.dispatchKey !== undefined && lane.dispatchKey !== previous.out && geometry && !reduced) {
        fresh.push({ id: lane.dispatchKey + 0.001 * index, d: geometry.pulseOut, color: lane.color });
      }
      if (lane.returnKey !== undefined && lane.returnKey !== previous.back && geometry && !reduced) {
        fresh.push({ id: lane.returnKey + 0.001 * index + 5e-4, d: geometry.pulseBack, color: lane.color });
      }
      seen.current[index] = { out: lane.dispatchKey, back: lane.returnKey };
    });
    if (fresh.length) setPulses((current) => [...current, ...fresh]);
  }, [signature, reduced]);

  const drop = (id: number) => setPulses((current) => current.filter((pulse) => pulse.id !== id));

  if (!layout) return <svg ref={svg} className={styles.wires} width={0} height={0} aria-hidden="true" />;

  return (
    <svg ref={svg} className={styles.wires} width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
      <path d={layout.trunk} className={styles.trunk} />
      {layout.lanes.map((geometry, index) => {
        const lane = lanes[index];
        if (!lane) return null;
        return (
          <g key={index} style={{ "--wire": lane.color } as CSSProperties}>
            <path d={geometry.out} className={styles.branch} data-on={(geometry.back ? lane.out : lane.out || lane.back) || undefined} />
            {geometry.back && <path d={geometry.back} className={styles.branch} data-on={lane.back || undefined} />}
          </g>
        );
      })}
      {pulses.map((pulse) => (
        <Pulse key={pulse.id} pulse={pulse} onDone={drop} />
      ))}
      {layout.lanes.map((geometry, index) => {
        const lane = lanes[index];
        if (!lane) return null;
        return (
          <g key={index} style={{ "--wire": lane.color } as CSSProperties}>
            <circle cx={geometry.port[0]} cy={geometry.port[1]} r={3.5} className={styles.port} data-on={(geometry.back ? lane.out : lane.out || lane.back) || undefined} />
            {geometry.backPort && <circle cx={geometry.backPort[0]} cy={geometry.backPort[1]} r={3.5} className={styles.port} data-on={lane.back || undefined} />}
          </g>
        );
      })}
    </svg>
  );
}

/* ── Brand marks ────────────────────────────────────────────────────────────── */

function ClaudeMark({ title = "Claude", className }: { title?: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} className={className}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

const geminiPath =
  "M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z";

function GeminiMark({ title = "Gemini", className }: { title?: string; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} className={className}>
      <path d={geminiPath} fill="#3186FF" />
      <path d={geminiPath} fill={`url(#arena-gemini-0-${uid})`} />
      <path d={geminiPath} fill={`url(#arena-gemini-1-${uid})`} />
      <path d={geminiPath} fill={`url(#arena-gemini-2-${uid})`} />
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id={`arena-gemini-0-${uid}`} x1="7" x2="11" y1="15.5" y2="12">
          <stop stopColor="#08B962" />
          <stop offset="1" stopColor="#08B962" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={`arena-gemini-1-${uid}`} x1="8" x2="11.5" y1="5.5" y2="11">
          <stop stopColor="#F94543" />
          <stop offset="1" stopColor="#F94543" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={`arena-gemini-2-${uid}`} x1="3.5" x2="17.5" y1="13.5" y2="12">
          <stop stopColor="#FABC12" />
          <stop offset=".46" stopColor="#FABC12" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function OpenAIMark({ title = "OpenAI", className }: { title?: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} className={className}>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

const defaultLead: OrchestratorLead = { name: "Claude Opus 5.5", mark: <ClaudeMark className={styles.claude} /> };

const defaultWorkers: OrchestratorWorker[] = [
  { id: "sonnet", name: "Claude Sonnet 5.5", mark: <ClaudeMark className={styles.claude} /> },
  { id: "haiku", name: "Claude Haiku 5.5", mark: <ClaudeMark className={styles.claude} /> },
  { id: "flash", name: "Gemini 3.8 Flash", mark: <GeminiMark /> },
  { id: "luna", name: "GPT-6 Luna", mark: <OpenAIMark /> },
];

/* ── State ──────────────────────────────────────────────────────────────────── */

export type LanePhase = "waiting" | "planned" | "starting" | "working" | "error" | "done" | "failed" | "stopped";
type RunPhase = "idle" | "planning" | "running" | "synthesizing" | "done" | "stopped";

interface LogEntry {
  id: number;
  kind: "tool" | "retry" | "result" | "fail";
  tool?: string;
  target?: string;
  detail?: string;
  at: number;
  end?: number;
  failed?: boolean;
}

interface LaneState {
  phase: LanePhase;
  line: string;
  lineKey: number;
  tokens: number;
  cost: number;
  attempt: number;
  log: LogEntry[];
  tools: number;
  subtask?: OrchestratorSubtask;
  dispatchedAt?: number;
  endedAt?: number;
  error?: string;
  retryAt?: number;
  tool?: { kind: string; target?: string; retry: boolean };
}

interface OrchestratorState {
  run: number;
  phase: RunPhase;
  simulated: boolean;
  order: string[];
  names: Record<string, string>;
  plan: OrchestratorSubtask[];
  lanes: Record<string, LaneState>;
  owner: Record<string, string>;
  summary: string;
  leadTokens: number;
  leadCost: number;
  notice: string;
  startedAt?: number;
  endedAt?: number;
  firstDispatchAt?: number;
  lastReturnAt?: number;
}

type Action =
  | { type: "workers"; workers: OrchestratorWorker[] }
  | { type: "reset"; now: number; simulated: boolean }
  | { type: "stop"; now: number }
  | { type: "event"; event: OrchestratorEvent; now: number };

const emptyLane = (): LaneState => ({ phase: "waiting", line: "", lineKey: 0, tokens: 0, cost: 0, attempt: 1, log: [], tools: 0 });

function initialState(workers: OrchestratorWorker[]): OrchestratorState {
  return {
    run: 0,
    phase: "idle",
    simulated: true,
    order: workers.map((worker) => worker.id),
    names: Object.fromEntries(workers.map((worker) => [worker.id, worker.name])),
    plan: [],
    lanes: Object.fromEntries(workers.map((worker) => [worker.id, emptyLane()])),
    owner: {},
    summary: "",
    leadTokens: 0,
    leadCost: 0,
    notice: "",
  };
}

const isRunPhase = (phase: RunPhase) => phase === "planning" || phase === "running" || phase === "synthesizing";
const isLaneRunning = (phase: LanePhase) => phase === "starting" || phase === "working" || phase === "error";

/** Closes the last open tool entry, optionally with an outcome. */
function closeTool(log: LogEntry[], now: number, extra: Partial<LogEntry> = {}): LogEntry[] {
  const index = log.findLastIndex((entry) => entry.kind === "tool" && entry.end === undefined);
  if (index < 0) return log;
  return log.map((entry, at) => (at === index ? { ...entry, end: now, ...extra } : entry));
}

function orchestratorReducer(state: OrchestratorState, action: Action): OrchestratorState {
  if (action.type === "workers") {
    return isRunPhase(state.phase) ? state : { ...initialState(action.workers), run: state.run };
  }
  if (action.type === "reset") {
    return {
      ...initialState(state.order.map((id) => ({ id, name: state.names[id] ?? id }))),
      run: state.run + 1,
      phase: "planning",
      simulated: action.simulated,
      startedAt: action.now,
      notice: action.simulated ? "Planning. This is a simulated run; nothing is sent." : "Planning",
    };
  }
  if (action.type === "stop") {
    if (!isRunPhase(state.phase)) return state;
    const lanes = Object.fromEntries(
      Object.entries(state.lanes).map(([id, lane]) => [
        id,
        isLaneRunning(lane.phase) || lane.phase === "planned"
          ? { ...lane, phase: "stopped" as LanePhase, endedAt: lane.dispatchedAt ? action.now : undefined, log: closeTool(lane.log, action.now) }
          : lane,
      ]),
    );
    return { ...state, phase: "stopped", lanes, endedAt: action.now, notice: "Stopped" };
  }

  const { event, now } = action;
  const ownerId = "subtaskId" in event && event.subtaskId ? state.owner[event.subtaskId] : undefined;
  const lane = ownerId ? state.lanes[ownerId] : undefined;
  const patchLane = (patch: Partial<LaneState>, extra: Partial<OrchestratorState> = {}): OrchestratorState =>
    ownerId && lane ? { ...state, ...extra, lanes: { ...state.lanes, [ownerId]: { ...lane, ...patch } } } : state;
  const workerName = ownerId ? state.names[ownerId] ?? "A subagent" : "A subagent";

  switch (event.type) {
    case "plan": {
      const target =
        (event.subtask.workerId && state.lanes[event.subtask.workerId] ? event.subtask.workerId : undefined) ??
        state.order.find((id) => !Object.values(state.owner).includes(id));
      if (!target) return state;
      return {
        ...state,
        plan: [...state.plan, event.subtask],
        owner: { ...state.owner, [event.subtask.id]: target },
        lanes: { ...state.lanes, [target]: { ...state.lanes[target], subtask: event.subtask, phase: "planned" } },
      };
    }
    case "dispatch":
      return patchLane(
        { phase: "starting", dispatchedAt: now },
        {
          phase: state.phase === "planning" ? "running" : state.phase,
          firstDispatchAt: state.firstDispatchAt ?? now,
          notice: state.firstDispatchAt ? state.notice : `Plan ready. Dispatching ${state.plan.length} subtasks.`,
        },
      );
    case "tool":
      if (!lane) return state;
      return patchLane({
        phase: "working",
        error: undefined,
        retryAt: undefined,
        tools: lane.tools + 1,
        tool: { kind: event.tool, target: event.target, retry: lane.phase === "working" && lane.log.at(-1)?.kind === "retry" },
        log: [...closeTool(lane.log, now), { id: lane.log.length, kind: "tool", tool: event.tool, target: event.target, at: now }],
      });
    case "toolResult":
      return lane ? patchLane({ log: closeTool(lane.log, now, { detail: event.detail }) }) : state;
    case "output":
      if (!lane) return state;
      return patchLane(event.newLine || !lane.line ? { line: event.delta, lineKey: lane.lineKey + 1 } : { line: lane.line + event.delta });
    case "usage":
      if (!event.subtaskId) return { ...state, leadTokens: state.leadTokens + event.tokens, leadCost: state.leadCost + event.cost };
      return lane ? patchLane({ tokens: lane.tokens + event.tokens, cost: lane.cost + event.cost }) : state;
    case "error":
      if (!lane) return state;
      return patchLane(
        {
          phase: "error",
          error: event.message,
          retryAt: event.retryInMs ? now + event.retryInMs : undefined,
          log: closeTool(lane.log, now, { failed: true, detail: event.message }),
        },
        { notice: `${workerName} hit an error: ${event.message}.${event.retryInMs ? " Retrying." : ""}` },
      );
    case "retry":
      if (!lane) return state;
      return patchLane(
        {
          phase: "working",
          attempt: event.attempt,
          error: undefined,
          retryAt: undefined,
          tool: undefined,
          log: [...lane.log, { id: lane.log.length, kind: "retry", detail: `Attempt ${event.attempt}`, at: now, end: now }],
        },
        { notice: `${workerName} is retrying` },
      );
    case "result": {
      if (!lane) return state;
      const settled = Object.values(state.lanes).filter((entry) => entry.phase === "done" || entry.phase === "failed").length + 1;
      const text = event.text ?? lane.line;
      return patchLane(
        {
          phase: "done",
          endedAt: now,
          error: undefined,
          line: text || lane.line,
          log: [...closeTool(lane.log, now), { id: lane.log.length, kind: "result", detail: text, at: now, end: now }],
        },
        { lastReturnAt: now, notice: `${workerName} returned. ${settled} of ${state.plan.length} done.` },
      );
    }
    case "fail":
      if (!lane) return state;
      return patchLane(
        {
          phase: "failed",
          endedAt: now,
          error: event.message,
          log: [...closeTool(lane.log, now, { failed: true }), { id: lane.log.length, kind: "fail", detail: event.message, at: now, end: now }],
        },
        { lastReturnAt: now, notice: `${workerName} failed: ${event.message}` },
      );
    case "summary":
      return {
        ...state,
        phase: "synthesizing",
        summary: state.summary + event.delta,
        notice: state.phase === "synthesizing" ? state.notice : "Every subagent returned. Writing the summary.",
      };
    case "done":
      return { ...state, phase: "done", endedAt: now };
    default:
      return state;
  }
}

/** `queued` is a display-only phase: the lane is still `planned`, but it is next in line. */
type LaneDisplayPhase = LanePhase | "queued";

const phaseLabel: Record<LaneDisplayPhase, string> = {
  waiting: "Waiting for the plan",
  planned: "Planned",
  queued: "Queued",
  starting: "Starting",
  working: "Working",
  error: "Failed, retrying",
  done: "Returned",
  failed: "Gave up",
  stopped: "Stopped",
};

/* ── Lane pieces ────────────────────────────────────────────────────────────── */

function LaneActivity({ lane, queue, reduced }: { lane: LaneState; queue: number; reduced: boolean }) {
  const transition = swapMotion(reduced);
  let key: string;
  let icon: ReactNode;
  let label: ReactNode;
  let tone: string | undefined;

  if (queue > 0) {
    key = `queued-${queue}`;
    icon = <Glyph kind="queued" reduced={reduced} />;
    label = queue === 1 ? "Queued, next in line" : `Queued, ${queue === 2 ? "2nd" : queue === 3 ? "3rd" : `${queue}th`} in line`;
  } else {
    switch (lane.phase) {
      case "waiting":
        key = "waiting";
        icon = <Glyph kind="idle" reduced={reduced} />;
        label = "Waiting for the plan";
        break;
      case "planned":
        key = "planned";
        icon = <Glyph kind="idle" reduced={reduced} />;
        label = "Planned";
        break;
      case "starting":
        key = "starting";
        icon = <Glyph kind="active" reduced={reduced} />;
        label = <TextShimmer className={styles.shimmer}>Starting</TextShimmer>;
        break;
      case "working": {
        const tool = lane.tool;
        key = `tool-${lane.tools}-${tool?.kind ?? "retry"}`;
        icon = tool ? <ToolIcon kind={tool.kind} /> : <Glyph kind="active" reduced={reduced} />;
        const text = tool ? `${toolLabel(tool.kind)}${tool.retry ? `, attempt ${lane.attempt}` : ""}${tool.target ? ` · ${tool.target}` : ""}` : "Retrying";
        label = <TextShimmer className={styles.shimmer}>{text}</TextShimmer>;
        break;
      }
      case "error":
        key = "error";
        tone = "danger";
        icon = <Glyph kind="error" reduced={reduced} />;
        label =
          lane.retryAt !== undefined ? (
            <>
              Failed, retrying in <Countdown at={lane.retryAt} />
            </>
          ) : (
            "Failed"
          );
        break;
      case "done":
        key = "done";
        tone = "success";
        icon = <Glyph kind="done" reduced={reduced} />;
        label = `Returned after ${lane.tools} tool ${lane.tools === 1 ? "call" : "calls"}`;
        break;
      case "failed":
        key = "failed";
        tone = "danger";
        icon = <Glyph kind="error" reduced={reduced} />;
        label = "Gave up";
        break;
      default:
        key = "stopped";
        icon = <Glyph kind="stopped" reduced={reduced} />;
        label = lane.dispatchedAt ? "Stopped" : "Not started";
    }
  }

  return (
    <span className={styles.swapBox}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span className={styles.activity} data-tone={tone} key={key} {...transition}>
          <span className={styles.activityIcon}>{icon}</span>
          <span className={styles.activityLabel}>{label}</span>
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function LaneOutput({ lane, reduced }: { lane: LaneState; reduced: boolean }) {
  const transition = swapMotion(reduced);
  const hint = lane.subtask?.instruction ?? lane.subtask?.title;
  let key: string;
  let tone: string | undefined;
  let content: ReactNode;

  if ((lane.phase === "error" || lane.phase === "failed") && lane.error) {
    key = "error";
    tone = "danger";
    content = <span className={styles.clip}>{lane.error}</span>;
  } else if (lane.line && (lane.phase === "working" || lane.phase === "starting" || lane.phase === "error")) {
    key = `line-${lane.lineKey}`;
    content = <Ticker text={lane.line} reduced={reduced} />;
  } else if (lane.line) {
    key = `rest-${lane.lineKey}`;
    content = <Ticker text={lane.line} reduced={reduced} settled />;
  } else {
    key = hint ? "hint" : "empty";
    tone = "muted";
    content = <span className={styles.clip}>{hint ?? "\u00a0"}</span>;
  }

  return (
    <span className={styles.swapBox}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span className={styles.output} data-tone={tone} key={key} {...transition}>
          {content}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function LaneLog({ lane, reduced }: { lane: LaneState; reduced: boolean }) {
  if (!lane.log.length) return <p className={styles.logEmpty}>{lane.subtask ? "No tool calls yet." : "This lane has no subtask yet."}</p>;
  return (
    <ol className={styles.log}>
      {lane.log.map((entry) => {
        let icon: ReactNode;
        let title: ReactNode;
        let tone: string | undefined;
        if (entry.kind === "tool") {
          icon = entry.failed ? <Glyph kind="error" reduced={reduced} /> : <ToolIcon kind={entry.tool ?? ""} />;
          title = `${toolLabel(entry.tool ?? "Tool")}${entry.failed ? " failed" : ""}`;
          tone = entry.failed ? "danger" : undefined;
        } else if (entry.kind === "retry") {
          icon = <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />;
          title = "Retried";
        } else if (entry.kind === "result") {
          icon = <Glyph kind="done" reduced />;
          title = "Returned to the lead";
          tone = "success";
        } else {
          icon = <Glyph kind="error" reduced />;
          title = "Gave up";
          tone = "danger";
        }
        return (
          <li key={entry.id} className={styles.logRow} data-tone={tone}>
            <span className={styles.logIcon}>{icon}</span>
            <span className={styles.logMain}>
              <span className={styles.logTitle}>
                {title}
                {entry.target && <span className={styles.logTarget}> {entry.target}</span>}
              </span>
              {entry.detail && <span className={styles.logDetail}>{entry.detail}</span>}
            </span>
            {entry.kind === "tool" && <Elapsed from={entry.at} to={entry.end} className={styles.logTime} />}
          </li>
        );
      })}
    </ol>
  );
}

interface LaneProps {
  worker: OrchestratorWorker;
  lane: LaneState;
  index: number;
  queue: number;
  open: boolean;
  reduced: boolean;
  onToggle: (id: string) => void;
  nodeRef: (node: HTMLDivElement | null) => void;
}

const Lane = memo(function Lane({ worker, lane, index, queue, open, reduced, onToggle, nodeRef }: LaneProps) {
  const id = useId();
  const dispatched = lane.dispatchedAt !== undefined;
  const phase: LaneDisplayPhase = queue > 0 ? "queued" : lane.phase;
  return (
    <div ref={nodeRef} className={styles.lane} data-phase={phase} style={{ "--lane": `var(--series-${(index % 4) + 1})` } as CSSProperties}>
      <button
        type="button"
        className={styles.laneButton}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => onToggle(worker.id)}
        aria-label={`${lane.subtask?.title ?? "Unassigned"}, ${worker.name}. ${phaseLabel[phase]}. ${open ? "Hide" : "Show"} transcript`}
      >
        <span className={styles.laneHead}>
          <span className={styles.laneMark} aria-hidden="true">
            {worker.mark}
          </span>
          <span className={styles.laneModel}>{worker.name}</span>
          <span className={styles.laneTime} data-hidden={!dispatched || undefined}>
            <Elapsed from={lane.dispatchedAt} to={lane.endedAt} />
          </span>
        </span>
        <span className={styles.laneTitle} data-muted={!lane.subtask || undefined}>
          <span className={styles.swapBox}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span className={styles.laneTitleText} key={lane.subtask?.id ?? "none"} {...swapMotion(reduced)}>
                {lane.subtask?.title ?? "Unassigned"}
              </motion.span>
            </AnimatePresence>
          </span>
        </span>
        <LaneActivity lane={lane} queue={queue} reduced={reduced} />
        <LaneOutput lane={lane} reduced={reduced} />
        <span className={styles.laneFoot}>
          <span className={styles.laneMetrics} data-hidden={!dispatched || undefined}>
            <span>
              <Counter value={lane.tokens} format={compact} reduced={reduced} /> tokens
            </span>
            <span className={styles.dot} aria-hidden="true" />
            <Counter value={lane.cost} format={money} reduced={reduced} />
          </span>
          <ChevronDown className={styles.chevron} data-open={open || undefined} size={14} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </button>
      <motion.div
        id={id}
        className={styles.collapse}
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={reduced ? instant : { height: springSnap, opacity: open ? fadeIn : fadeOut }}
        inert={!open || undefined}
      >
        <div className={styles.transcript}>
          <LaneLog lane={lane} reduced={reduced} />
        </div>
      </motion.div>
    </div>
  );
});

/* ── The block ──────────────────────────────────────────────────────────────── */

/**
 * A lead agent plans work at the top, hands it to a row of subagent lanes, and merges what comes
 * back into a summary with a token and time accounting. Connectors pulse as work is dispatched and
 * as it returns, the plan streams in word by word, and each lane opens into its own tool log.
 *
 * The default `run` is a local simulation: no request leaves the page. Pass your own async
 * iterable of events to drive the same choreography from a real run.
 */
export function AgentOrchestrator({
  goal = "Compare our pricing page with four competitors and suggest changes",
  plan: planProp,
  workers = defaultWorkers,
  lead = defaultLead,
  run,
  concurrency,
  defaultConcurrency,
  onConcurrencyChange,
  autoStart = true,
  onComplete,
  className,
}: AgentOrchestratorProps) {
  const prefersReduced = useReducedMotion();
  const hydrated = useSyncExternalStore(subscribeHydration, clientSnapshot, serverSnapshot);
  const reduced = Boolean(hydrated && prefersReduced);

  const maxWorkers = Math.min(Math.max(workers.length, 1), 4);
  const [localLimit, setLocalLimit] = useState(() => Math.min(maxWorkers, defaultConcurrency ?? maxWorkers));
  const limit = Math.min(maxWorkers, Math.max(1, concurrency ?? localLimit));

  const [state, dispatch] = useReducer(orchestratorReducer, workers, initialState);
  const { phase: runPhase, plan, lanes, order, owner, summary, leadTokens, leadCost, notice, startedAt, endedAt, firstDispatchAt, lastReturnAt } = state;

  const limitRef = useRef(limit);
  limitRef.current = limit;
  const abortRef = useRef<AbortController | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const leadRef = useRef<HTMLSpanElement>(null);
  const summaryRef = useRef<HTMLSpanElement>(null);
  const laneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const laneRefSetters = useRef<((node: HTMLDivElement | null) => void)[]>([]);
  const laneRefFor = (index: number) => {
    const existing = laneRefSetters.current[index];
    if (existing) return existing;
    const setter = (node: HTMLDivElement | null) => {
      laneRefs.current[index] = node;
    };
    laneRefSetters.current[index] = setter;
    return setter;
  };
  const completeRef = useRef<number | null>(null);
  const ranRef = useRef(false);
  const inView = useInView(rootRef, { once: true, amount: 0.3 });
  const [openLanes, setOpenLanes] = useState<Record<string, boolean>>({});
  const toggleLane = useCallback((id: string) => {
    setOpenLanes((current) => ({ ...current, [id]: !current[id] }));
  }, []);
  const [settledRun, setSettledRun] = useState(-1);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const workersRef = useRef(workers);
  const workersKey = workers.map((worker) => `${worker.id}:${worker.name}`).join("|");
  useEffect(() => {
    workersRef.current = workers;
    dispatch({ type: "workers", workers: workersRef.current });
    // The key changes only when an id or a name changes; marks and order are read from the ref.
  }, [workersKey]);

  const start = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "reset", now: performance.now(), simulated: !run });
    const source = run ?? simulateOrchestration;
    const context: OrchestratorRunContext = {
      goal,
      plan: planProp ?? samplePlan,
      workers: workersRef.current.map(({ id, name }) => ({ id, name })),
      concurrency: () => limitRef.current,
      signal: controller.signal,
    };
    void (async () => {
      try {
        for await (const event of source(context)) {
          if (controller.signal.aborted) break;
          dispatch({ type: "event", event, now: performance.now() });
        }
      } catch {
        if (!controller.signal.aborted) dispatch({ type: "stop", now: performance.now() });
      }
    })();
  }, [run, goal, planProp]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "stop", now: performance.now() });
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!autoStart || reduced || !inView || ranRef.current) return;
    const timer = setTimeout(() => {
      ranRef.current = true;
      start();
    }, 450);
    return () => clearTimeout(timer);
  }, [autoStart, reduced, inView, start]);

  const tokens = leadTokens + Object.values(lanes).reduce((total, lane) => total + lane.tokens, 0);
  const cost = leadCost + Object.values(lanes).reduce((total, lane) => total + lane.cost, 0);
  const wallMs = endedAt !== undefined && startedAt !== undefined ? endedAt - startedAt : 0;
  const laneSum = Object.values(lanes).reduce((total, lane) => total + ((lane.endedAt ?? 0) - (lane.dispatchedAt ?? 0)), 0);
  const sequentialMs = wallMs > 0 ? Math.max(wallMs, wallMs - ((lastReturnAt ?? 0) - (firstDispatchAt ?? 0)) + laneSum) : 0;
  const speedup = wallMs > 0 ? sequentialMs / wallMs : 1;
  const settled = runPhase === "done" && settledRun === state.run;
  const running = isRunPhase(runPhase);
  const dispatched = firstDispatchAt !== undefined && running;
  const activeCount = Object.values(lanes).filter((lane) => isLaneRunning(lane.phase)).length;
  const queuedIds = dispatched ? order.filter((id) => activeCount >= limit && lanes[id]?.phase === "planned") : [];
  const returnedCount = Object.values(lanes).filter((lane) => lane.phase === "done" || lane.phase === "failed").length;
  const plannedTotal = runPhase === "idle" || runPhase === "planning" ? Math.max(plan.length, (planProp ?? samplePlan).length) : plan.length;
  const speedLine = speedup >= 1.05 ? `${speedup.toFixed(1)}x faster than running in sequence` : "About the same as running in sequence";

  useEffect(() => {
    if (!settled || completeRef.current === state.run) return;
    completeRef.current = state.run;
    onCompleteRef.current?.({
      summary,
      tokens,
      cost,
      wallMs,
      sequentialMs,
      speedup,
      lanes: order.map((id) => {
        const lane = lanes[id];
        return {
          subtaskId: lane?.subtask?.id ?? id,
          workerId: id,
          status: lane?.phase ?? "waiting",
          text: lane?.line ?? "",
          tokens: lane?.tokens ?? 0,
          cost: lane?.cost ?? 0,
          ms: (lane?.endedAt ?? 0) - (lane?.dispatchedAt ?? 0),
        };
      }),
    });
  });

  let leadTone = "idle";
  let leadText = "Ready";
  let leadShimmer = false;
  switch (runPhase) {
    case "planning":
      leadTone = "active";
      leadText = "Planning";
      leadShimmer = true;
      break;
    case "running":
      leadTone = "active";
      leadText = activeCount ? `${activeCount} working${queuedIds.length ? `, ${queuedIds.length} queued` : ""}` : "Merging results";
      break;
    case "synthesizing":
      leadTone = "active";
      leadText = "Writing summary";
      leadShimmer = true;
      break;
    case "done":
      leadTone = "done";
      leadText = "Done";
      break;
    default:
      if (runPhase === "stopped") {
        leadTone = "stopped";
        leadText = "Stopped";
      }
  }

  let summaryTone = "idle";
  let summaryText: string;
  if (runPhase === "idle" || runPhase === "planning") {
    summaryText = `Waits for ${plannedTotal === 1 ? "one result" : `${plannedTotal} results`}`;
  } else if (runPhase === "running") {
    summaryText = `${returnedCount} of ${plan.length} returned`;
  } else if (runPhase === "synthesizing") {
    summaryTone = "active";
    summaryText = `Merging ${returnedCount} results`;
  } else if (runPhase === "done") {
    summaryTone = "done";
    summaryText = `Merged ${returnedCount} results`;
  } else {
    summaryTone = "stopped";
    summaryText = `${returnedCount} of ${plan.length} returned`;
  }

  const transition = swapMotion(reduced);
  const wireLanes: WireLane[] = order.map((id, index) => {
    const lane = lanes[id];
    const lanePhase = lane?.phase ?? "waiting";
    return {
      color: `var(--series-${(index % 4) + 1})`,
      out: lanePhase === "working" || lanePhase === "error" || lanePhase === "done" || lanePhase === "failed" || (lanePhase === "stopped" && lane?.dispatchedAt !== undefined),
      back: lanePhase === "done",
      dispatchKey: lane?.dispatchedAt,
      returnKey: lanePhase === "done" ? lane?.endedAt : undefined,
    };
  });

  return (
    <div ref={rootRef} className={cls(styles.root, className)} data-lanes={workers.length}>
      <header className={styles.header}>
        <h3 className={styles.goal}>{goal}</h3>
        <div className={styles.toolbar}>
          <div className={styles.limit}>
            <span className={styles.limitLabel} aria-hidden="true">
              Concurrency
            </span>
            <SegmentedControl
              label="Concurrency limit"
              value={String(limit)}
              onValueChange={(next) => {
                const value = Number(next);
                if (concurrency === undefined) setLocalLimit(value);
                onConcurrencyChange?.(value);
              }}
              options={Array.from({ length: maxWorkers }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))}
            />
          </div>
          <Button className={styles.run} variant={running ? "secondary" : "primary"} onClick={running ? stop : start}>
            {running ? (
              <>
                <Square size={14} strokeWidth={1.75} aria-hidden="true" />
                Stop
              </>
            ) : runPhase === "idle" ? (
              <>
                <Play size={14} strokeWidth={1.75} aria-hidden="true" />
                Run
              </>
            ) : (
              <>
                <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
                Run again
              </>
            )}
          </Button>
        </div>
      </header>
      <div className={styles.flow}>
        <section className={styles.node} aria-label="Lead agent">
          <div className={styles.nodeRow}>
            <span ref={leadRef} className={styles.nodeMark} aria-hidden="true">
              {lead.mark}
            </span>
            <span className={styles.nodeName}>
              {lead.name}
              <span className={styles.nodeRole}>Lead</span>
            </span>
            <span className={styles.nodeStatus}>
              <span className={styles.swapBox}>
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span className={styles.statusInner} key={`${leadTone}-${leadText}`} {...transition}>
                    <span className={styles.activityIcon}>
                      <Glyph kind={leadTone as GlyphKind} reduced={reduced} />
                    </span>
                    {leadShimmer ? <TextShimmer className={styles.shimmer}>{leadText}</TextShimmer> : <span>{leadText}</span>}
                  </motion.span>
                </AnimatePresence>
              </span>
              {startedAt !== undefined && <Elapsed from={startedAt} to={endedAt} className={styles.nodeTime} />}
            </span>
          </div>
          <div className={styles.nodeBody}>
            <AnimatePresence initial={false}>
              {runPhase === "idle" && (
                <motion.p
                  className={styles.hint}
                  key="hint"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={reduced ? { opacity: 0, transition: instant } : { opacity: 0, height: 0, transition: { height: springSnap, opacity: fadeOut } }}
                  transition={reduced ? instant : { height: springSnap, opacity: fadeIn }}
                >
                  <span className={styles.hintInner}>Writes a plan, then splits it across {workers.length} subagents.</span>
                </motion.p>
              )}
            </AnimatePresence>
            <ol className={styles.plan} aria-label="Plan">
              <AnimatePresence initial={false}>
                {plan.map((subtask) => {
                  const ownerIndex = order.indexOf(owner[subtask.id] ?? "");
                  return (
                    <motion.li
                      className={styles.planItem}
                      key={`${state.run}-${subtask.id}`}
                      initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={reduced ? { opacity: 0, transition: instant } : { opacity: 0, height: 0, transition: { height: springSnap, opacity: fadeOut } }}
                      transition={reduced ? instant : { height: springSnap, opacity: fadeIn }}
                    >
                      <span className={styles.planInner}>
                        <span className={styles.planDot} style={{ "--lane": `var(--series-${(Math.max(0, ownerIndex) % 4) + 1})` } as CSSProperties} aria-hidden="true" />
                        <span className={styles.planText}>
                          <StreamChunks text={subtask.instruction ?? subtask.title} reduced={reduced} />
                        </span>
                      </span>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ol>
          </div>
        </section>
        <div className={styles.lanes} style={{ "--count": workers.length } as CSSProperties}>
          {workers.map((worker, index) => (
            <Lane
              key={worker.id}
              worker={worker}
              index={index}
              lane={lanes[worker.id] ?? emptyLane()}
              queue={queuedIds.indexOf(worker.id) + 1}
              open={Boolean(openLanes[worker.id])}
              reduced={reduced}
              onToggle={toggleLane}
              nodeRef={laneRefFor(index)}
            />
          ))}
        </div>
        <section className={styles.node} aria-label="Summary">
          <div className={styles.nodeRow}>
            <span ref={summaryRef} className={styles.nodeMark} aria-hidden="true">
              {lead.mark}
            </span>
            <span className={styles.nodeName}>Summary</span>
            <span className={styles.nodeStatus}>
              <span className={styles.swapBox}>
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span className={styles.statusInner} key={`${summaryTone}-${summaryText}`} {...transition}>
                    <span className={styles.activityIcon}>
                      <Glyph kind={summaryTone as GlyphKind} reduced={reduced} />
                    </span>
                    <span>{summaryText}</span>
                  </motion.span>
                </AnimatePresence>
              </span>
            </span>
          </div>
          <div className={styles.nodeBody}>
            <AnimatePresence initial={false} mode="popLayout">
              {summary ? (
                <motion.div key={`summary-${state.run}`} initial={{ opacity: 1 }} exit={{ opacity: 0, transition: reduced ? instant : fadeOut }}>
                  <SummaryText text={summary} reduced={reduced} complete={runPhase === "done"} onSettled={() => setSettledRun(state.run)} />
                </motion.div>
              ) : (
                <motion.p className={styles.hint} key="hint" {...transition}>
                  {runPhase === "stopped" ? "Stopped before the lead could merge the results." : "The lead merges what the subagents return here."}
                </motion.p>
              )}
            </AnimatePresence>
            <AnimatePresence initial={false}>
              {settled && (
                <motion.div
                  className={styles.totalsWrap}
                  key={`totals-${state.run}`}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={reduced ? { opacity: 0, transition: instant } : { opacity: 0, height: 0, transition: { height: springSnap, opacity: fadeOut } }}
                  transition={reduced ? instant : { height: springSnap, opacity: { ...fadeIn, delay: 0.04 } }}
                >
                  <div className={styles.totals}>
                    <dl className={styles.stats}>
                      <div>
                        <dt>Tokens</dt>
                        <dd className={styles.tabular}>{compact(tokens)}</dd>
                      </div>
                      <div>
                        <dt>Cost</dt>
                        <dd className={styles.tabular}>{money(cost)}</dd>
                      </div>
                      <div>
                        <dt>Wall time</dt>
                        <dd className={styles.tabular}>{seconds(wallMs)}</dd>
                      </div>
                      <div>
                        <dt>In sequence</dt>
                        <dd className={styles.tabular}>{seconds(sequentialMs)}</dd>
                      </div>
                    </dl>
                    <div className={styles.speedRow}>
                      <span className={styles.speed}>
                        <Zap size={14} strokeWidth={1.75} aria-hidden="true" />
                        {speedLine}
                      </span>
                      <CopyButton value={summary} label="Copy summary" variant="plain" className={styles.copy} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
        <Wires lead={leadRef} summary={summaryRef} nodes={laneRefs} lanes={wireLanes} reduced={reduced} />
      </div>
      <p className={styles.srOnly} role="status" aria-live="polite">
        {settled ? `Done in ${seconds(wallMs)}, ${speedLine}.` : notice}
      </p>
    </div>
  );
}

export default AgentOrchestrator;
