"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { Check, Pause, Plus, RotateCcw, TriangleAlert, X } from "lucide-react";
import { Button } from "../button/button";
import { Slider } from "../slider/slider";
import { Switch } from "../switch/switch";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { Tooltip } from "../tooltip/tooltip";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./speculative-decoding.module.css";

/* -------------------------------------------------------------------------------------------- */
/* Model: a token stream, the draft guesses per round, and the timeline that plays them out.     */
/* -------------------------------------------------------------------------------------------- */

export interface SpeculativeToken {
  text: string;
  /** Probability the draft model nails this token; drives how often a round accepts it. */
  ease?: number;
  /** Stand-in token the draft proposes when it misses. */
  miss?: string;
}

/** A recorded run: each round lists what the draft proposed and how many the target kept. */
export interface SpeculativeRound {
  draft: string[];
  accepted: number;
  target: string;
}

interface PlannedRound {
  draft: string[];
  accepted: number;
  target: string;
  index: number;
  start: number;
  verify: number;
  settle: number;
  end: number;
  outStart: number;
}

interface OutputToken {
  text: string;
  origin: "draft" | "target";
  round: number;
}

interface DecodingStats {
  passes: number;
  drafted: number;
  accepted: number;
  tokens: number;
  acceptance: number;
  tokensPerPass: number;
  speedup: number;
}

interface DecodingPlan {
  rounds: PlannedRound[];
  output: OutputToken[];
  end: number;
  stats: DecodingStats;
}

type DecodingPhase = "idle" | "draft" | "verify" | "settle" | "done";

interface DecodingView {
  phase: DecodingPhase;
  round: number;
  shown: number;
  sweep: number;
  verdicts: number;
  targetShown: boolean;
  emitted: number;
  settled: number;
  baseline: number;
  specDone: boolean;
  baseDone: boolean;
  basePass: number;
}

type ColumnState = "accepted" | "rejected" | "discarded" | "ghost";

export type SpeculativeDecodingStatus = "ready" | "loading" | "error";

export interface SpeculativeDecodingProps {
  tokens?: SpeculativeToken[];
  rounds?: SpeculativeRound[];
  draftLength?: number;
  defaultDraftLength?: number;
  onDraftLengthChange?: (length: number) => void;
  compare?: boolean;
  defaultCompare?: boolean;
  onCompareChange?: (compare: boolean) => void;
  autoplay?: boolean;
  seed?: number;
  draftCost?: number;
  passDuration?: number;
  title?: string;
  draftLabel?: string;
  draftDetail?: string;
  targetLabel?: string;
  targetDetail?: string;
  status?: SpeculativeDecodingStatus;
  error?: string;
  onRetry?: () => void;
  onComplete?: (stats: DecodingStats) => void;
  className?: string;
  style?: CSSProperties;
}

/** The sentence both models are writing, with the per-token odds the draft model accepts them. */
const TOKENS: SpeculativeToken[] = [
  { text: "Your", ease: 0.92, miss: "The" },
  { text: " preview", ease: 0.55, miss: " latest" },
  { text: " deploy", ease: 0.9, miss: " build" },
  { text: " finished", ease: 0.8, miss: " completed" },
  { text: " in", ease: 0.97, miss: " after" },
  { text: " 42", ease: 0.3, miss: " 38" },
  { text: " seconds", ease: 0.95, miss: " minutes" },
  { text: ",", ease: 0.85, miss: " and" },
  { text: " and", ease: 0.9, miss: " so" },
  { text: " all", ease: 0.7, miss: " the" },
  { text: " 318", ease: 0.25, miss: " 300" },
  { text: " checks", ease: 0.85, miss: " tests" },
  { text: " passed", ease: 0.9, miss: " ran" },
  { text: ",", ease: 0.8, miss: "." },
  { text: " so", ease: 0.65, miss: " and" },
  { text: " the", ease: 0.92, miss: " your" },
  { text: " branch", ease: 0.6, miss: " pull" },
  { text: " is", ease: 0.95, miss: " can" },
  { text: " ready", ease: 0.9, miss: " safe" },
  { text: " to", ease: 0.97, miss: " for" },
  { text: " merge", ease: 0.85, miss: " ship" },
  { text: ".", ease: 0.95, miss: " now" },
];

const FILLERS = [" the", " a", " and", ",", " to", " of"];

const tokenAt = (token: SpeculativeToken | undefined, index: number): SpeculativeToken =>
  token ?? { text: FILLERS[index % FILLERS.length] };

/** Deterministic 0–1 hash: the same rounds every render, so the timeline stays addressable by time. */
function hash(seed: number, a: number, b: number): number {
  let value =
    (Math.imul(seed + 1, 0x9e3779b1) ^ Math.imul(a + 1, 0x165667b1) ^ Math.imul(b + 7, 0x27d4eb2f)) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x85ebca77);
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae3d);
  value ^= value >>> 16;
  return (value >>> 0) / 0x100000000;
}

/** Draft lengths ahead, accept each guess while the odds hold, then let the target check the batch. */
function buildRounds(tokens: SpeculativeToken[], length: number, seed = 12): SpeculativeRound[] {
  const rounds: SpeculativeRound[] = [];
  const size = Math.max(0, Math.round(length));
  let index = 0;
  while (index < tokens.length) {
    const run = Math.min(size, tokens.length - index - 1);
    let accepted = 0;
    while (accepted < run && hash(seed, index + accepted, accepted) < (tokens[index + accepted].ease ?? 0.8) * Math.pow(0.95, accepted)) {
      accepted += 1;
    }
    const draft = Array.from({ length: run }, (_, offset) => {
      const at = index + offset;
      return offset === accepted ? tokenAt(tokens[at], at).miss ?? FILLERS[at % FILLERS.length] : tokens[at].text;
    });
    rounds.push({ draft, accepted, target: tokens[index + accepted].text });
    index += accepted + 1;
  }
  return rounds;
}

/** Lay rounds on a time axis: draft, verify, settle, then the next round starts. */
function buildPlan(rounds: SpeculativeRound[], draftCost = 0.1): DecodingPlan {
  const planned: PlannedRound[] = [];
  const output: OutputToken[] = [];
  let cursor = 0;
  let drafted = 0;
  let acceptedTotal = 0;
  rounds.forEach((round, index) => {
    const draft = round.draft.slice();
    const accepted = Math.max(0, Math.min(draft.length, Math.round(round.accepted)));
    const verify = cursor + draft.length * draftCost;
    planned.push({
      draft,
      accepted,
      target: round.target,
      index,
      start: cursor,
      verify,
      settle: verify + 0.72,
      end: verify + 1,
      outStart: output.length,
    });
    draft.slice(0, accepted).forEach(token => output.push({ text: token, origin: "draft", round: index }));
    output.push({ text: round.target, origin: "target", round: index });
    drafted += draft.length;
    acceptedTotal += accepted;
    cursor = verify + 1;
  });
  const tokens = output.length;
  return {
    rounds: planned,
    output,
    end: cursor,
    stats: {
      passes: planned.length,
      drafted,
      accepted: acceptedTotal,
      tokens,
      acceptance: drafted ? acceptedTotal / drafted : 0,
      tokensPerPass: planned.length ? tokens / planned.length : 0,
      speedup: cursor ? tokens / cursor : 1,
    },
  };
}

/** Everything the view needs at time t, so the animation loop only has to follow one function. */
function viewAt(plan: DecodingPlan, t: number): DecodingView {
  const total = plan.output.length;
  let round = -1;
  for (let i = 0; i < plan.rounds.length; i += 1) {
    if (plan.rounds[i].start <= t) round = i;
  }
  let emitted = 0;
  let settled = 0;
  for (const item of plan.rounds) {
    if (item.settle <= t) {
      emitted += item.accepted + 1;
      settled += 1;
    }
  }
  const counters = {
    emitted,
    settled,
    baseline: Math.max(0, Math.min(total, Math.floor(t - 0.72) + 1)),
    specDone: t >= plan.end,
    baseDone: t >= total,
    basePass: t > 0 ? Math.min(total, Math.floor(t) + 1) : 0,
  };
  if (round < 0 || t <= 0) {
    return { phase: "idle", round: -1, shown: 0, sweep: 0, verdicts: 0, targetShown: false, ...counters };
  }
  const current = plan.rounds[round];
  const len = current.draft.length;
  if (t >= plan.end) {
    return { phase: "done", round, shown: len, sweep: len, verdicts: len, targetShown: true, ...counters };
  }
  const perToken = len ? (current.verify - current.start) / len : 0;
  const shown = perToken ? Math.min(len, Math.floor((t - current.start) / perToken) + 1) : 0;
  const progress = Math.max(0, Math.min(1, (t - current.verify) / 0.4));
  const sweep = t < current.verify ? 0 : progress * len;
  const verdicts = Math.min(len, Math.floor(sweep + 0.45));
  const targetShown = current.accepted < len ? verdicts > current.accepted : progress >= 1;
  return {
    phase: t < current.verify ? "draft" : t < current.settle ? "verify" : "settle",
    round,
    shown,
    sweep,
    verdicts,
    targetShown,
    ...counters,
  };
}

function partialStats(plan: DecodingPlan, settled: number): DecodingStats | null {
  if (settled <= 0) return null;
  const done = plan.rounds.slice(0, settled);
  const drafted = done.reduce((sum, item) => sum + item.draft.length, 0);
  const accepted = done.reduce((sum, item) => sum + item.accepted, 0);
  const tokens = accepted + done.length;
  const end = done[done.length - 1].end;
  return {
    passes: done.length,
    drafted,
    accepted,
    tokens,
    acceptance: drafted ? accepted / drafted : 0,
    tokensPerPass: tokens / done.length,
    speedup: tokens / end,
  };
}

/* -------------------------------------------------------------------------------------------- */
/* Small shared pieces                                                                           */
/* -------------------------------------------------------------------------------------------- */

const ENTER_EASE = [...motionTokens.ease.enter] as [number, number, number, number];
const STANDARD_EASE = [...motionTokens.ease.standard] as [number, number, number, number];
const FLIP_SPRING = { type: "spring", visualDuration: 0.32, bounce: 0 } as const;
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const plural = (count: number, word: string, words = `${word}s`) => `${count} ${count === 1 ? word : words}`;
const glyph = (text: string) => text.trim() || "␣";

function useControllableState<T>(controlled: T | undefined, fallback: T, onChange?: (value: T) => void) {
  const [own, setOwn] = useState(fallback);
  const isControlled = controlled !== undefined;
  return [
    isControlled ? (controlled as T) : own,
    useCallback(
      (value: T) => {
        if (!isControlled) setOwn(value);
        onChange?.(value);
      },
      [isControlled, onChange],
    ),
  ] as const;
}

/** Height animation for the lane track: the column row changes height as rounds collapse into the summary. */
function AnimatedHeight({ children, reduced, className }: { children: ReactNode; reduced: boolean; className?: string }) {
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
    <motion.div className={className} initial={false} animate={{ height }} transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}>
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

/** The line above the panel cross-fades between states instead of swapping text in place. */
function Swap({ id, children, reduced, className }: { id: string; children: ReactNode; reduced: boolean; className?: string }) {
  return (
    <span className={[styles.swap, className].filter(Boolean).join(" ")}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0 : motionTokens.duration.fast, ease: ENTER_EASE } }}
          exit={{ opacity: 0, transition: { duration: 0.1 * Number(!reduced) } }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Odds, ratios and counts: each digit is a strip that rolls to its value instead of redrawing. */
function NumberWheel({ value, decimals = 0, suffix, places = 1 }: { value: number | null; decimals?: number; suffix?: string; places?: number }) {
  const [integer = "", fraction = ""] = (value === null ? "" : value.toFixed(decimals)).split(".");
  const width = Math.max(places, integer.length);
  const digits = Array.from({ length: width }, (_, offset) => {
    const place = width - 1 - offset;
    const char = integer[integer.length - 1 - place];
    return { key: `i${place}`, digit: char === undefined ? null : Number(char), place };
  });
  return (
    <span className={styles.number} data-empty={value === null || undefined} aria-hidden="true">
      <span className={styles.numberDash}>–</span>
      <span className={styles.numberValue}>
        {digits.map(item => (
          <span key={item.key} className={styles.wheelSlot} data-off={(item.digit === null && item.place > 0) || undefined}>
            <span className={styles.wheel}>
              <span className={styles.strip} style={{ transform: `translateY(${-(10 * (item.digit ?? 0))}%)` }}>
                {DIGITS.map(digit => (
                  <span key={digit}>{digit}</span>
                ))}
              </span>
            </span>
          </span>
        ))}
        {decimals > 0 && <span>.</span>}
        {[...fraction.padEnd(decimals, "0")].map((char, index) => (
          <span key={`f${index}`} className={styles.wheelSlot}>
            <span className={styles.wheel}>
              <span className={styles.strip} style={{ transform: `translateY(${-(10 * Number(char))}%)` }}>
                {DIGITS.map(digit => (
                  <span key={digit}>{digit}</span>
                ))}
              </span>
            </span>
          </span>
        ))}
        {suffix && <span className={styles.numberSuffix}>{suffix}</span>}
      </span>
    </span>
  );
}

/** The reference play glyph has rounded corners; lucide's play is a sharp triangle. */
function PlayIcon({ on }: { on?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-play" aria-hidden="true" data-on={on || undefined}>
      <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
    </svg>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Component                                                                                     */
/* -------------------------------------------------------------------------------------------- */

export function SpeculativeDecoding({
  tokens = TOKENS,
  rounds,
  draftLength,
  defaultDraftLength = 4,
  onDraftLengthChange,
  compare,
  defaultCompare = false,
  onCompareChange,
  autoplay = true,
  seed = 12,
  draftCost = 0.1,
  passDuration = 640,
  title = "Speculative decoding",
  draftLabel = "Draft model",
  draftDetail = "Small, fast",
  targetLabel = "Target model",
  targetDetail = "Large",
  status = "ready",
  error,
  onRetry,
  onComplete,
  className,
  style,
}: SpeculativeDecodingProps) {
  const reduced = useReducedMotion() ?? false;
  const [length, setLength] = useControllableState(draftLength, defaultDraftLength, onDraftLengthChange);
  const [comparing, setComparing] = useControllableState(compare, defaultCompare, onCompareChange);
  const ahead = clamp(Math.round(length), 2, 8);
  const signature = JSON.stringify([rounds ?? tokens, rounds ? 0 : ahead, seed, draftCost]);
  const plan = useMemo(() => {
    const source = rounds ?? buildRounds(tokens, ahead, seed);
    return buildPlan(source, draftCost);
  }, [rounds, tokens, ahead, seed, draftCost]);
  const outputLength = plan.output.length;
  const end = comparing ? Math.max(plan.end, outputLength) : plan.end;
  const ready = status === "ready" && outputLength > 0;

  const words = useMemo(() => {
    const groups: { space: boolean; items: { index: number; text: string }[] }[] = [];
    plan.output.forEach((token, index) => {
      const space = /^\s/.test(token.text);
      if (!groups.length || space) groups.push({ space, items: [] });
      groups[groups.length - 1].items.push({ index, text: token.text.replace(/^\s+/, "") });
    });
    return groups;
  }, [plan]);

  const time = useRef({ signature: "", time: 0 });
  const latest = useRef({ plan, signature, end, reduced, passDuration, onComplete });
  useLayoutEffect(() => {
    latest.current = { plan, signature, end, reduced, passDuration, onComplete };
  });

  const [stored, setStored] = useState(() => ({ signature, view: viewAt(plan, 0) }));
  const view = stored.signature === signature ? stored.view : viewAt(plan, 0);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("");
  const columnsRef = useRef<HTMLDivElement>(null);

  /** Read the clock, publish a new view only when a compared field actually changed, and paint the sweep. */
  const tick = useCallback(() => {
    const { plan: currentPlan, signature: currentSignature, reduced: still } = latest.current;
    if (time.current.signature !== currentSignature) time.current = { signature: currentSignature, time: 0 };
    const next = viewAt(currentPlan, time.current.time);
    columnsRef.current?.style.setProperty("--sweep", String(still ? next.verdicts : Math.round(1000 * next.sweep) / 1000));
    setStored(previous => {
      if (previous.signature === currentSignature) {
        const before = previous.view;
        if (
          before.phase === next.phase &&
          before.round === next.round &&
          before.shown === next.shown &&
          before.verdicts === next.verdicts &&
          before.targetShown === next.targetShown &&
          before.emitted === next.emitted &&
          before.baseline === next.baseline &&
          before.settled === next.settled &&
          before.specDone === next.specDone &&
          before.baseDone === next.baseDone &&
          before.basePass === next.basePass
        ) {
          return previous;
        }
      }
      return { signature: currentSignature, view: next };
    });
    return next;
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous = performance.now();
    const step = (now: number) => {
      const { end: stopAt, passDuration: duration, plan: currentPlan } = latest.current;
      const delta = Math.min(64, now - previous) / Math.max(120, duration);
      previous = now;
      const before = time.current.time;
      if (time.current.signature === latest.current.signature) time.current.time = Math.min(stopAt, before + delta);
      const next = tick();
      if (before < currentPlan.end && time.current.time >= currentPlan.end && time.current.signature === latest.current.signature) {
        latest.current.onComplete?.(currentPlan.stats);
        const { passes, tokens: written, speedup } = currentPlan.stats;
        setMessage(
          `Done. ${plural(written, "token")} in ${plural(passes, "target pass", "target passes")}, ${speedup.toFixed(1)} times faster than the target alone.`,
        );
      }
      if (time.current.time >= stopAt && time.current.signature === latest.current.signature) {
        if (next.baseDone && stopAt > currentPlan.end) setMessage(`Target alone finished after ${plural(currentPlan.output.length, "pass", "passes")}.`);
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, tick]);

  const cardRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const node = cardRef.current;
    if (!node || !autoplay || reduced || !ready || started.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && !started.current) {
          started.current = true;
          setPlaying(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [autoplay, reduced, ready]);

  const tokenRefs = useRef<(HTMLElement | null)[]>([]);
  const cells = useRef<Map<string, HTMLElement>>(new Map());
  const flights = useRef<ReturnType<typeof animate>[]>([]);
  const emitted = useRef(0);

  const stopFlights = useCallback(() => {
    flights.current.forEach(control => control.stop());
    flights.current = [];
    tokenRefs.current.forEach(node => {
      if (node) node.style.transform = "";
    });
  }, []);

  // A settled token appears in the lane first, then flies to its place in the output line.
  useLayoutEffect(() => {
    const before = emitted.current;
    const now = view.emitted;
    emitted.current = now;
    if (now <= before) {
      if (now < before) stopFlights();
      return;
    }
    if (reduced) return;
    for (let index = before; index < now; index += 1) {
      const token = plan.output[index];
      const round = plan.rounds[token?.round ?? -1];
      const node = tokenRefs.current[index];
      if (!token || !round || !node) continue;
      const offset = index - round.outStart;
      const source = cells.current.get(offset < round.accepted ? `${round.index}:${offset}` : `${round.index}:t`);
      if (!source) continue;
      const from = source.getBoundingClientRect();
      const to = node.getBoundingClientRect();
      const dx = Math.round(from.left - to.left);
      const dy = Math.round(from.top + from.height / 2 - (to.top + to.height / 2));
      if (Math.abs(dx) + Math.abs(dy) < 1) continue;
      node.style.transform = `translate(${dx}px, ${dy}px)`;
      flights.current.push(animate(node, { x: [dx, 0], y: [dy, 0] }, { ...FLIP_SPRING, delay: Math.min(0.12, (index - before) * 0.02) }));
    }
  }, [view.emitted, plan, reduced, stopFlights]);

  useEffect(() => () => flights.current.forEach(control => control.stop()), []);

  const play = useCallback(
    (run: boolean) => {
      stopFlights();
      time.current = { signature: latest.current.signature, time: 0 };
      tick();
      setPlaying(run);
    },
    [tick, stopFlights],
  );

  const stats = view.specDone ? plan.stats : partialStats(plan, view.settled);
  const round = view.round >= 0 && !view.specDone ? plan.rounds[view.round] : null;
  const proposal = round?.draft.length ?? 0;
  const allAccepted = round ? round.accepted === proposal : false;
  const settling = view.phase === "settle";
  const ordinals = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"];

  let headline: string;
  let statusKey: string;
  let badge: ReactNode = null;
  if (status === "loading") {
    headline = "Loading the decoding run";
    statusKey = "loading";
  } else if (status === "error") {
    headline = "The run could not load";
    statusKey = "error";
  } else if (outputLength) {
    if (view.specDone) {
      badge = <Check className={styles.statusCheck} size={15} strokeWidth={2} aria-hidden="true" />;
      if (comparing && !view.baseDone) {
        headline = `Speculation done in ${plural(plan.stats.passes, "pass", "passes")}, target alone still writing`;
        statusKey = "done-racing";
      } else if (comparing) {
        headline = `${plural(plan.stats.passes, "pass", "passes")} with speculation, ${outputLength} without`;
        statusKey = "done-both";
      } else {
        headline = `Done in ${plural(plan.stats.passes, "target pass", "target passes")}`;
        statusKey = "done";
      }
    } else if (round) {
      const what = proposal ? `all ${proposal}` : "the last token";
      if (view.phase === "draft") {
        headline = proposal ? `Draft model proposes ${plural(proposal, "token")}` : "Target writes the last token";
        statusKey = `${view.round}-draft`;
      } else if (view.phase === "verify") {
        headline = proposal ? `Target checks ${proposal === 1 ? "it" : what} in one pass` : "Target writes the last token";
        statusKey = `${view.round}-verify`;
      } else if (proposal) {
        if (allAccepted) {
          headline = `All ${proposal} accepted, plus a bonus token`;
        } else if (round.accepted === 0) {
          headline = "First guess rejected, target writes its own";
        } else {
          headline = `${round.accepted} of ${proposal} accepted, target fixes the ${ordinals[round.accepted] ?? `${round.accepted + 1}th`}`;
        }
        statusKey = `${view.round}-settle`;
      } else {
        headline = "Target wrote the last token";
        statusKey = `${view.round}-settle`;
      }
    } else {
      headline = `Draft guesses ${ahead} tokens ahead, target checks them in one pass`;
      statusKey = `idle-${ahead}`;
    }
  } else {
    headline = "Nothing to decode yet";
    statusKey = "empty";
  }

  const spokenRound =
    round && view.verdicts >= proposal && view.phase !== "draft"
      ? `Round ${round.index + 1}. Draft proposed ${round.draft.map(glyph).join(", ") || "nothing"}. Target accepted ${round.accepted}${
          allAccepted
            ? ` and added ${glyph(round.target)}`
            : ` and wrote ${glyph(round.target)} instead of ${glyph(round.draft[round.accepted])}`
        }.`
      : "";

  const columns: ReactNode[] = round
    ? Array.from({ length: Math.min(view.shown, proposal) }, (_, index) => {
        const state: ColumnState =
          index < view.verdicts
            ? index < round.accepted
              ? "accepted"
              : index === round.accepted
                ? "rejected"
                : "discarded"
            : "ghost";
        const missing = index === round.accepted;
        return (
          <div key={`${round.index}:${index}`} className={styles.column} data-state={state} data-leaving={settling || undefined} style={{ "--j": index } as CSSProperties}>
            <span className={styles.chip}>
              <span
                ref={node => {
                  const key = `${round.index}:${index}`;
                  if (node) cells.current.set(key, node);
                  else cells.current.delete(key);
                }}
                className={styles.chipText}
              >
                <TextShimmer active={state === "ghost" && !reduced} duration={0.9}>
                  {glyph(round.draft[index])}
                </TextShimmer>
                <span className={styles.strike} aria-hidden="true" />
              </span>
            </span>
            <span className={styles.cell}>
              <span className={styles.fill} />
              {missing ? (
                <span className={styles.cellContent} data-on={(state === "rejected" && view.targetShown) || undefined}>
                  <X className={styles.missIcon} size={13} strokeWidth={2} aria-hidden="true" />
                  <span
                    ref={node => {
                      const key = `${round.index}:t`;
                      if (node) cells.current.set(key, node);
                      else cells.current.delete(key);
                    }}
                    className={styles.targetText}
                  >
                    {glyph(round.target)}
                  </span>
                </span>
              ) : (
                <span className={styles.cellContent} data-on={state === "accepted" || undefined}>
                  <Check className={styles.hitIcon} size={14} strokeWidth={2} aria-hidden="true" />
                </span>
              )}
            </span>
          </div>
        );
      })
    : [];

  if (round && allAccepted && view.targetShown) {
    columns.push(
      <div key={`${round.index}:bonus`} className={styles.column} data-state="bonus" data-leaving={settling || undefined}>
        <span className={styles.chip} data-empty="" />
        <span className={styles.cell}>
          <span className={styles.cellContent} data-on="">
            {proposal > 0 && <Plus className={styles.bonusIcon} size={13} strokeWidth={2} aria-hidden="true" />}
            <span
              ref={node => {
                const key = `${round.index}:t`;
                if (node) cells.current.set(key, node);
                else cells.current.delete(key);
              }}
              className={styles.targetText}
            >
              {glyph(round.target)}
            </span>
          </span>
        </span>
      </div>,
    );
  }

  const passes = view.specDone ? plural(plan.stats.passes, "pass", "passes") : plural(view.settled, "pass", "passes");
  const baselinePasses = plural(view.baseline, "pass", "passes");
  const disabled = !ready;
  const playingLabel = playing ? "Pause" : view.specDone && (!comparing || view.baseDone) ? "Play again" : "Play";

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")} style={style}>
      <div ref={cardRef} className={styles.card} role="group" aria-label={title} data-status={ready ? "ready" : outputLength ? status : "empty"} data-reduced={reduced || undefined}>
        <div className={styles.header}>
          <div className={styles.heading}>
            <p className={styles.title}>{title}</p>
            <p className={styles.status}>
              {status === "loading" ? (
                <TextShimmer>{headline}</TextShimmer>
              ) : (
                <Swap id={statusKey} reduced={reduced} className={styles.statusLine}>
                  {badge}
                  {headline}
                </Swap>
              )}
            </p>
          </div>
          <div className={styles.actions}>
            <Tooltip content={playingLabel}>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => {
                  if (!ready) return;
                  if (playing) {
                    setPlaying(false);
                    setMessage("Paused");
                    return;
                  }
                  if (time.current.signature === signature && time.current.time >= end) {
                    play(true);
                    setMessage("Playing from the start");
                    return;
                  }
                  setPlaying(true);
                  setMessage("Playing");
                }}
                disabled={disabled}
                aria-label={playing ? "Pause" : "Play"}
              >
                <span className={styles.iconStack} aria-hidden="true">
                  <Pause data-on={playing || undefined} size={15} strokeWidth={1.75} />
                  <PlayIcon on={!playing} />
                </span>
              </button>
            </Tooltip>
            <Tooltip content="Restart">
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => {
                  play(true);
                  setMessage("Restarted");
                }}
                disabled={disabled}
                aria-label="Restart"
              >
                <RotateCcw size={15} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </Tooltip>
          </div>
        </div>

        {outputLength === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No tokens to decode</p>
            <p className={styles.emptyText}>Pass the target model&rsquo;s answer as tokens, or a recorded run as rounds.</p>
          </div>
        ) : (
          <>
            <div className={styles.lanes}>
              <div className={styles.laneLabels} aria-hidden="true">
                <div className={styles.laneLabel} data-lane="draft">
                  <span className={styles.laneDot} />
                  <span className={styles.laneText}>
                    <span className={styles.laneName}>{draftLabel}</span>
                    <span className={styles.laneDetail}>{draftDetail}</span>
                  </span>
                </div>
                <div className={styles.laneLabel} data-lane="target">
                  <span className={styles.laneDot} />
                  <span className={styles.laneText}>
                    <span className={styles.laneName}>{targetLabel}</span>
                    <span className={styles.laneDetail}>{targetDetail}</span>
                  </span>
                </div>
              </div>
              <AnimatedHeight reduced={reduced} className={styles.track}>
                <div ref={columnsRef} className={styles.columns} data-phase={view.phase} aria-hidden="true">
                  {view.specDone ? (
                    <div className={styles.summary}>
                      <span className={styles.summaryRow}>{`${plural(plan.stats.drafted, "token")} drafted, ${plan.stats.accepted} accepted`}</span>
                      <span className={styles.summaryRow}>{`${plural(plan.stats.passes, "pass", "passes")} for ${plural(outputLength, "token")}`}</span>
                    </div>
                  ) : round ? (
                    columns
                  ) : (
                    Array.from({ length: rounds ? 0 : ahead }, (_, index) => (
                      <div key={`slot${index}`} className={styles.column} data-state="slot">
                        <span className={styles.chip} />
                        <span className={styles.cell} />
                      </div>
                    ))
                  )}
                </div>
              </AnimatedHeight>
              <p className={styles.srOnly}>{spokenRound}</p>
            </div>

            {status === "error" && (
              <div className={styles.alert} role="alert">
                <TriangleAlert className={styles.alertIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.alertText}>{error ?? "Could not load the decoding run."}</span>
                {onRetry && (
                  <Button variant="secondary" size="sm" onClick={onRetry}>
                    Retry
                  </Button>
                )}
              </div>
            )}

            <div className={styles.outputs}>
              <div className={styles.line} data-line="spec">
                <div className={styles.lineLabel}>
                  <Swap id={comparing ? "spec" : "out"} reduced={reduced} className={styles.lineName}>
                    {comparing ? "Speculative" : "Output"}
                  </Swap>
                  <span className={styles.lineMeta}>
                    {view.specDone && <Check className={styles.metaCheck} size={13} strokeWidth={2} aria-hidden="true" />}
                    {passes}
                  </span>
                </div>
                <p
                  className={styles.lineText}
                  aria-label={`Output: ${plan.output
                    .slice(0, view.emitted)
                    .map(token => token.text)
                    .join("")
                    .trim() || "empty"}`}
                >
                  {words.map((word, index) => (
                    <Fragment key={index}>
                      {index > 0 && word.space ? " " : null}
                      <span className={styles.word}>
                        {word.items.map(item => (
                          <span
                            key={item.index}
                            ref={node => {
                              tokenRefs.current[item.index] = node;
                            }}
                            className={styles.tok}
                            data-on={item.index < view.emitted || undefined}
                            data-origin={plan.output[item.index].origin}
                            aria-hidden="true"
                          >
                            {item.text}
                          </span>
                        ))}
                      </span>
                    </Fragment>
                  ))}
                </p>
              </div>
              <AnimatePresence initial={false}>
                {comparing && (
                  <motion.div
                    key="baseline"
                    className={styles.baselineWrap}
                    initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    animate={reduced ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                    exit={
                      reduced
                        ? { opacity: 0, transition: { duration: 0.1 } }
                        : { height: 0, opacity: 0, transition: { height: motionTokens.spring.smooth, opacity: { duration: 0.12 } } }
                    }
                    transition={{ height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast, ease: ENTER_EASE } }}
                  >
                    <div className={styles.line} data-line="base">
                      <div className={styles.lineLabel}>
                        <span className={styles.lineName}>Target only</span>
                        <span className={styles.lineMeta}>
                          {view.baseDone && <Check className={styles.metaCheck} size={13} strokeWidth={2} aria-hidden="true" />}
                          {baselinePasses}
                        </span>
                      </div>
                      <p
                        className={styles.lineText}
                        aria-label={`Target only: ${plan.output
                          .slice(0, view.baseline)
                          .map(token => token.text)
                          .join("")
                          .trim() || "empty"}`}
                      >
                        {words.map((word, index) => (
                          <span key={index}>
                            {index > 0 && word.space ? " " : null}
                            <span className={styles.word}>
                              {word.items.map(item => (
                                <span
                                  key={item.index}
                                  className={styles.tok}
                                  data-on={item.index < view.baseline || undefined}
                                  data-origin="target"
                                  aria-hidden="true"
                                >
                                  {item.text}
                                </span>
                              ))}
                            </span>
                          </span>
                        ))}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className={styles.footer}>
              <dl className={styles.stats}>
                <div className={styles.stat}>
                  <dt className={styles.statLabel}>Faster</dt>
                  <dd className={styles.statValue}>
                    <NumberWheel value={stats ? stats.speedup : null} decimals={1} suffix="×" />
                    <span className={styles.srOnly}>{stats ? `${stats.speedup.toFixed(1)} times` : "not yet"}</span>
                  </dd>
                </div>
                <div className={styles.stat}>
                  <dt className={styles.statLabel}>Drafts accepted</dt>
                  <dd className={styles.statValue}>
                    <NumberWheel value={stats ? Math.round(100 * stats.acceptance) : null} places={3} suffix="%" />
                    <span className={styles.srOnly}>{stats ? `${Math.round(100 * stats.acceptance)} percent` : "not yet"}</span>
                  </dd>
                </div>
                <div className={styles.stat}>
                  <dt className={styles.statLabel}>Tokens per pass</dt>
                  <dd className={styles.statValue}>
                    <NumberWheel value={stats ? stats.tokensPerPass : null} decimals={1} />
                    <span className={styles.srOnly}>{stats ? stats.tokensPerPass.toFixed(1) : "not yet"}</span>
                  </dd>
                </div>
              </dl>
              <div className={styles.controls}>
                {!rounds && (
                  <div className={styles.sliderSlot}>
                    <Slider
                      label="Draft length"
                      min={2}
                      max={8}
                      step={1}
                      value={ahead}
                      onValueChange={value => {
                        const next = clamp(Math.round(value), 2, 8);
                        if (next === ahead) return;
                        setLength(next);
                        stopFlights();
                        time.current = { signature: "", time: 0 };
                        setPlaying(ready);
                      }}
                      onValueCommit={value => {
                        const next = buildPlan(buildRounds(tokens, clamp(Math.round(value), 2, 8), seed), draftCost).stats;
                        setMessage(
                          `Draft length ${value}. ${Math.round(100 * next.acceptance)} percent of drafts accepted, ${next.speedup.toFixed(1)} times faster.`,
                        );
                      }}
                      format={value => plural(value, "token")}
                      disabled={disabled}
                    />
                  </div>
                )}
                <Switch
                  label="Compare without speculation"
                  checked={comparing}
                  onCheckedChange={next => {
                    setComparing(next);
                    const at = time.current.signature === signature ? time.current.time : 0;
                    const limit = next ? Math.max(plan.end, outputLength) : plan.end;
                    if (next && at >= plan.end && at < limit) setPlaying(true);
                    if (!next && at >= plan.end) setPlaying(false);
                    setMessage(next ? "Comparing against the target alone, one token per pass." : "Comparison hidden.");
                  }}
                  disabled={disabled}
                  className={styles.switch}
                />
              </div>
            </div>
          </>
        )}

        <p className={styles.srOnly} aria-live="polite">
          {message}
        </p>
      </div>
    </div>
  );
}

export function SpeculativeDecodingDemo() {
  return (
    <div className={styles.demo}>
      <SpeculativeDecoding />
    </div>
  );
}

export default SpeculativeDecodingDemo;
