"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { AnimatePresence, animate, motion, useIsPresent, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";
import type { MotionStyle } from "motion/react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  FilePen,
  FileSearch,
  Files,
  FlaskConical,
  Globe,
  ListChecks,
  NotebookPen,
  Pause,
  Play,
  RotateCcw,
  Scale,
  Search,
  ShieldAlert,
  Square,
  SquareTerminal,
  X,
} from "lucide-react";
import { Button } from "../button/button";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./agent-status.module.css";

export type AgentStatusValue = "idle" | "working" | "needs-input" | "paused" | "done" | "failed" | "stopped";
export type AgentStepStatus = "pending" | "active" | "waiting" | "done" | "failed" | "skipped";
export type AgentStatusAlign = "start" | "center" | "end";
export type AgentScenarioId = "coding" | "research";

/** Any icon component that accepts the lucide prop signature the surface renders with. */
export type AgentIcon = ComponentType<{
  size?: number | string;
  strokeWidth?: number;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

export interface AgentProgress {
  value: number;
  total: number;
}

/** The single line the collapsed pill shows while the run is live. */
export interface AgentActivity {
  /** What the agent is doing right now, e.g. `Reading 12 files`. */
  label?: string;
  /** Icon rendered before the label. */
  icon?: AgentIcon;
  /** Turns the label into `3 of 12` while a counted step runs. */
  progress?: AgentProgress;
}

export interface AgentStep {
  /** Stable key for the row. */
  id: string;
  /** Row text: the intent while pending, the result once settled. */
  label: string;
  /** Row icon. */
  icon?: AgentIcon;
  status: AgentStepStatus;
  /** When the step started, used for the live elapsed time. */
  startedAt?: number | Date;
  /** Settled duration in milliseconds; a live step reads its time from the clock instead. */
  durationMs?: number;
}

export interface AgentStatusAgent {
  /** Name announced to screen readers and shown in the expanded meta row. */
  name: string;
  /** Brand mark rendered in the orb; falls back to a neutral dot glyph. */
  mark?: ReactNode;
}

export interface AgentStatusProps {
  /** Run status. Leave undefined to play the built in simulated coding run. */
  status?: AgentStatusValue;
  /** Activity line for `working` and `needs-input`. */
  activity?: AgentActivity;
  /** Completed and in-flight steps, oldest first. Pending rows are hidden. */
  steps?: AgentStep[];
  /** Run start, used for the live timer and per step clock. */
  startedAt?: number | Date;
  /** Run end, used once the run is `done` or `stopped`. */
  endedAt?: number | Date;
  /** Agent identity. Defaults to `{ name: "Agent" }`. */
  agent?: AgentStatusAgent;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onApprove?: () => void;
  onDeny?: () => void;
  onRetry?: () => void;
  onOpenRun?: () => void;
  /** Delay before a finished run settles back to the idle pill, in ms. `null` keeps the result. */
  settleAfter?: number | null;
  /** Side the expanded panel grows from. */
  align?: AgentStatusAlign;
  /** Controlled expansion. */
  expanded?: boolean;
  /** Initial expansion when uncontrolled. */
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** How many step rows stay visible; the oldest rows scroll out of the list. */
  maxSteps?: number;
  /** Extra sentence appended to the live region announcement. */
  notice?: string;
  onWidthChange?: (width: number) => void;
  className?: string;
}

/* ---------------------------------------------------------------------------------------------- */
/* clock                                                                                          */
/* ---------------------------------------------------------------------------------------------- */

interface ClockSync {
  startedAt?: number;
  status: AgentStatusValue;
  endedAt?: number;
}

interface Clock {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => number;
  sync: (run: ClockSync) => void;
  since: (start: number | undefined, now: number) => number;
}

/** A shared second hand: paused spans are subtracted so a paused run freezes instead of drifting. */
function createClock(): Clock {
  let startedAt: number | undefined;
  let endedAt: number | undefined;
  let snapshot = Date.now();
  let running = false;
  let interval = 0;
  const pausedSpans: Array<[number, number | undefined]> = [];
  const listeners = new Set<() => void>();

  const openSpan = () => {
    const last = pausedSpans[pausedSpans.length - 1];
    return last && last[1] === undefined ? last : undefined;
  };

  const tick = () => {
    const next = endedAt ?? openSpan()?.[0] ?? Date.now();
    if (next !== snapshot) {
      snapshot = next;
      listeners.forEach((listener) => listener());
    }
  };

  const restart = () => {
    window.clearInterval(interval);
    if (running && listeners.size) interval = window.setInterval(tick, 250);
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      restart();
      tick();
      return () => {
        listeners.delete(listener);
        restart();
      };
    },
    getSnapshot: () => snapshot,
    sync(run) {
      const now = Date.now();
      if (run.startedAt !== startedAt) {
        startedAt = run.startedAt;
        pausedSpans.length = 0;
        endedAt = undefined;
      }
      const paused = run.status === "paused" || run.status === "failed";
      const open = openSpan();
      if (paused && !open) pausedSpans.push([now, undefined]);
      if (!paused && open) open[1] = now;
      endedAt = run.status === "done" || run.status === "stopped" ? (run.endedAt ?? endedAt ?? now) : undefined;
      running = run.status === "working" || run.status === "needs-input";
      restart();
      tick();
    },
    since(start, now) {
      if (start === undefined) return 0;
      let paused = 0;
      for (const [begin, end] of pausedSpans) {
        paused += Math.max(0, Math.min(end ?? now, now) - Math.max(begin, start));
      }
      return Math.max(0, now - start - paused);
    },
  };
}

const pad2 = (value: number) => String(value).padStart(2, "0");

function formatShort(ms: number) {
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours ? `${hours}h ${minutes}m` : minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function formatWords(ms: number) {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const pair = (value: number, unit: string) => `${value} ${unit}${value === 1 ? "" : "s"}`;
  return minutes ? `${pair(minutes, "minute")} ${pair(seconds, "second")}` : pair(seconds, "second");
}

function formatClock(ms: number) {
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${minutes}:${pad2(seconds)}`;
}

/* ---------------------------------------------------------------------------------------------- */
/* brand marks + simulated scenarios                                                              */
/* ---------------------------------------------------------------------------------------------- */

const CLAUDE_PATH =
  "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z";

function ClaudeMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d={CLAUDE_PATH} />
    </svg>
  );
}

const GEMINI_PATH =
  "M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z";

function GeminiMark(props: SVGProps<SVGSVGElement>) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path d={GEMINI_PATH} fill="#3186FF" />
      <path d={GEMINI_PATH} fill={`url(#${id}-a)`} />
      <path d={GEMINI_PATH} fill={`url(#${id}-b)`} />
      <path d={GEMINI_PATH} fill={`url(#${id}-c)`} />
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id={`${id}-a`} x1="7" x2="11" y1="15.5" y2="12">
          <stop stopColor="#08B962" />
          <stop offset="1" stopColor="#08B962" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={`${id}-b`} x1="8" x2="11.5" y1="5.5" y2="11">
          <stop stopColor="#F94543" />
          <stop offset="1" stopColor="#F94543" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={`${id}-c`} x1="3.5" x2="17.5" y1="13.5" y2="12">
          <stop stopColor="#FABC12" />
          <stop offset=".46" stopColor="#FABC12" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

interface ScenarioStep {
  id: string;
  icon: AgentIcon;
  active: string;
  done: string;
  ms: number;
  count?: number;
  approval?: { request: string; waiting: string; denied: string };
  failOnce?: { at: number; summary: string; step: string };
}

interface Scenario {
  id: string;
  name: string;
  agent: AgentStatusAgent;
  steps: ScenarioStep[];
  detail: string;
  deniedDetail?: string;
}

const scenarios: Record<AgentScenarioId, Scenario> = {
  coding: {
    id: "coding",
    name: "Coding agent",
    agent: {
      name: "Claude Sonnet 5.5",
      mark: <ClaudeMark style={{ color: "#D97757" }} />,
    },
    steps: [
      { id: "read", icon: FileSearch, active: "Reading 12 files", done: "Read 12 files", ms: 1900 },
      { id: "search", icon: Search, active: "Searching for prorateInvoice", done: "Found 4 call sites", ms: 1500 },
      { id: "edit", icon: FilePen, active: "Editing src/billing/invoice.ts", done: "Edited src/billing/invoice.ts", ms: 2500 },
      { id: "tests-edit", icon: Files, active: "Updating 5 test files", done: "Updated 5 test files", ms: 1900 },
      { id: "tests", icon: FlaskConical, active: "Running tests", done: "Passed 12 of 12 tests", ms: 3300, count: 12 },
      {
        id: "push",
        icon: SquareTerminal,
        active: "Pushing fix/proration-rounding",
        done: "Pushed fix/proration-rounding",
        ms: 1400,
        approval: {
          request: "Needs your approval to run git push",
          waiting: "Waiting for approval to run git push",
          denied: "Skipped git push",
        },
      },
    ],
    detail: "6 files changed",
    deniedDetail: "6 files changed, not pushed",
  },
  research: {
    id: "research",
    name: "Research agent",
    agent: {
      name: "Gemini 4 Argon",
      mark: <GeminiMark />,
    },
    steps: [
      { id: "plan", icon: ListChecks, active: "Planning 4 research questions", done: "Planned 4 questions", ms: 1400 },
      { id: "search", icon: Globe, active: "Searching the web", done: "Found 18 results", ms: 1900 },
      {
        id: "read",
        icon: BookOpen,
        active: "Reading sources",
        done: "Read 9 sources",
        ms: 3200,
        count: 9,
        failOnce: { at: 0.56, summary: "Fetch failed · 2 sources timed out", step: "2 sources timed out" },
      },
      { id: "compare", icon: Scale, active: "Comparing pricing across 5 vendors", done: "Compared 5 vendors", ms: 2200 },
      { id: "write", icon: NotebookPen, active: "Writing the brief", done: "Wrote a 640 word brief", ms: 2300 },
    ],
    detail: "9 sources cited",
  },
};

/* ---------------------------------------------------------------------------------------------- */
/* simulation                                                                                     */
/* ---------------------------------------------------------------------------------------------- */

interface RunResult {
  status: AgentStepStatus;
  label: string;
  startedAt?: number;
  durationMs?: number;
}

interface RunState {
  scenario: Scenario;
  status: AgentStatusValue;
  index: number;
  progress: number;
  results: RunResult[];
  startedAt?: number;
  endedAt?: number;
  detail?: string;
  notice?: string;
}

function initialRun(scenario: Scenario): RunState {
  return {
    scenario,
    status: "idle",
    index: 0,
    progress: 0,
    results: scenario.steps.map((step) => ({ status: "pending", label: step.active })),
  };
}

interface Simulator {
  load: (scenario: Scenario, delay: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  approve: () => void;
  deny: () => void;
  retry: () => void;
  note: (message: string) => void;
  dispose: () => void;
}

function createSimulator(onUpdate: (run: RunState) => void): Simulator {
  let run = initialRun(scenarios.coding);
  let spent = 0;
  let startedAt = 0;
  let interval = 0;
  let timeout = 0;
  const seen = new Set<string>();
  const approved = new Set<string>();
  let denied = false;

  const emit = (patch: Partial<RunState>) => {
    run = { ...run, notice: undefined, ...patch };
    window.clearInterval(interval);
    if (run.status === "working") interval = window.setInterval(tick, 60);
    onUpdate(run);
  };

  const withResult = (index: number, result: RunResult) =>
    run.results.map((current, position) => (position === index ? result : current));

  function start(index: number, now: number) {
    const step = run.scenario.steps[index];
    if (!step) {
      emit({
        status: "done",
        index,
        endedAt: now,
        detail: denied ? (run.scenario.deniedDetail ?? run.scenario.detail) : run.scenario.detail,
      });
      return;
    }
    if (step.approval && !approved.has(step.id)) {
      emit({
        status: "needs-input",
        index,
        progress: 0,
        results: withResult(index, {
          status: "waiting",
          label: step.approval.waiting,
          startedAt: now,
        }),
      });
      return;
    }
    spent = 0;
    startedAt = now;
    emit({
      status: "working",
      index,
      progress: step.count ? 1 : 0,
      results: withResult(index, { status: "active", label: step.active, startedAt: now }),
    });
  }

  function tick() {
    if (run.status !== "working") return;
    const step = run.scenario.steps[run.index];
    if (!step) return;
    const now = Date.now();
    const elapsed = spent + now - startedAt;
    if (step.failOnce && !seen.has(step.id) && elapsed >= step.failOnce.at * step.ms) {
      seen.add(step.id);
      spent = elapsed;
      const current = run.results[run.index];
      emit({
        status: "failed",
        results: withResult(run.index, {
          status: "failed",
          label: step.failOnce.step,
          startedAt: current?.startedAt,
        }),
      });
      return;
    }
    if (elapsed >= step.ms) {
      run = {
        ...run,
        results: withResult(run.index, { status: "done", label: step.done, durationMs: Math.round(elapsed) }),
      };
      start(run.index + 1, now);
      return;
    }
    if (step.count) {
      const value = Math.min(step.count, Math.floor((elapsed / step.ms) * step.count) + 1);
      if (value !== run.progress) emit({ progress: value });
    }
  }

  return {
    load(scenario, delay) {
      window.clearTimeout(timeout);
      seen.clear();
      approved.clear();
      denied = false;
      run = initialRun(scenario);
      emit({});
      timeout = window.setTimeout(() => {
        emit({ startedAt: Date.now() });
        start(0, Date.now());
      }, delay);
    },
    pause() {
      if (run.status !== "working") return;
      spent += Date.now() - startedAt;
      emit({ status: "paused", notice: "Paused. The simulated run waits where it stopped." });
    },
    resume() {
      if (run.status !== "paused") return;
      startedAt = Date.now();
      emit({ status: "working", notice: "Resumed." });
    },
    stop() {
      if (!["working", "paused", "needs-input"].includes(run.status)) return;
      const current = run.results[run.index];
      emit({
        status: "stopped",
        endedAt: Date.now(),
        results: withResult(run.index, {
          status: "skipped",
          label: "Stopped by you",
          startedAt: current?.startedAt,
        }),
        notice: "Run stopped. Nothing else runs in this simulation.",
      });
    },
    approve() {
      const step = run.scenario.steps[run.index];
      if (run.status !== "needs-input" || !step) return;
      approved.add(step.id);
      start(run.index, Date.now());
      run = { ...run, notice: "Approved. The push is simulated in this preview." };
      onUpdate(run);
    },
    deny() {
      const step = run.scenario.steps[run.index];
      if (run.status !== "needs-input" || !step?.approval) return;
      denied = true;
      run = {
        ...run,
        results: withResult(run.index, { status: "skipped", label: step.approval.denied, durationMs: 0 }),
      };
      start(run.index + 1, Date.now());
      run = { ...run, notice: "Denied. Nothing was pushed." };
      onUpdate(run);
    },
    retry() {
      const step = run.scenario.steps[run.index];
      if (run.status !== "failed" || !step) return;
      startedAt = Date.now();
      const current = run.results[run.index];
      emit({
        status: "working",
        results: withResult(run.index, {
          status: "active",
          label: step.active,
          startedAt: current?.startedAt,
        }),
        notice: "Retrying the sources that timed out.",
      });
    },
    note(message) {
      run = { ...run, notice: message };
      onUpdate(run);
    },
    dispose() {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    },
  };
}

export interface AgentRunSimulation {
  status: AgentStatusValue;
  activity?: AgentActivity;
  steps: AgentStep[];
  startedAt?: number;
  endedAt?: number;
  agent: AgentStatusAgent;
  notice?: string;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onApprove: () => void;
  onDeny: () => void;
  onRetry: () => void;
  onOpenRun: () => void;
  replay: () => void;
}

/**
 * Scripted run used by the demo: it reads like a real agent session, fails one source fetch on
 * purpose and parks on the push approval, so every surface can be inspected without a backend.
 */
export function useAgentRunSimulation(scenarioId: AgentScenarioId = "coding", startDelay = 900): AgentRunSimulation {
  const [run, setRun] = useState<RunState>(() => initialRun(scenarios[scenarioId]));
  const simulator = useRef<Simulator | null>(null);

  useEffect(() => {
    const instance = createSimulator(setRun);
    simulator.current = instance;
    return () => {
      instance.dispose();
      simulator.current = null;
    };
  }, []);

  useEffect(() => {
    simulator.current?.load(scenarios[scenarioId], startDelay);
  }, [scenarioId, startDelay]);

  const replay = useCallback(() => simulator.current?.load(scenarios[scenarioId], 500), [scenarioId]);
  const onPause = useCallback(() => simulator.current?.pause(), []);
  const onResume = useCallback(() => simulator.current?.resume(), []);
  const onStop = useCallback(() => simulator.current?.stop(), []);
  const onApprove = useCallback(() => simulator.current?.approve(), []);
  const onDeny = useCallback(() => simulator.current?.deny(), []);
  const onRetry = useCallback(() => simulator.current?.retry(), []);
  const onOpenRun = useCallback(
    () => simulator.current?.note("Opening the run log is simulated in this preview."),
    [],
  );

  const { scenario, status, index, progress, results, startedAt, endedAt, detail } = run;
  const step = scenario.steps[index];
  let activity: AgentActivity | undefined;
  if (step && (status === "working" || status === "paused")) {
    activity = {
      label: step.active,
      icon: step.icon,
      progress: step.count ? { value: progress, total: step.count } : undefined,
    };
  } else if (step && status === "needs-input" && step.approval) {
    activity = { label: step.approval.request, icon: step.icon };
  } else if (step && status === "failed" && step.failOnce) {
    activity = { label: step.failOnce.summary, icon: step.icon };
  } else if (status === "done") {
    activity = { label: detail ?? scenario.detail };
  }

  return {
    status,
    activity,
    steps: scenario.steps.map((scenarioStep, position) => ({
      id: scenarioStep.id,
      icon: scenarioStep.icon,
      ...(results[position] ?? { status: "pending" as AgentStepStatus, label: scenarioStep.active }),
    })),
    startedAt,
    endedAt,
    agent: scenario.agent,
    notice: run.notice,
    onPause,
    onResume,
    onStop,
    onApprove,
    onDeny,
    onRetry,
    onOpenRun,
    replay,
  };
}

/* ---------------------------------------------------------------------------------------------- */
/* pieces                                                                                         */
/* ---------------------------------------------------------------------------------------------- */

const SPRING_SMOOTH = motionTokens.spring.smooth;
const SPRING_SNAP = { type: "spring", visualDuration: 0.26, bounce: 0 } as const;
const SPRING_GLYPH = { type: "spring", visualDuration: 0.22, bounce: 0 } as const;
const EASE_STANDARD = [...motionTokens.ease.standard] as [number, number, number, number];
const EASE_ENTER = [...motionTokens.ease.enter] as [number, number, number, number];

function Orb({ state, mark, reduced }: { state: AgentStatusValue; mark?: ReactNode; reduced: boolean }) {
  const glyph = state === "done" ? "check" : state === "failed" ? "cross" : state === "stopped" ? "stop" : "mark";
  const closed = state === "done" || state === "failed";
  const transition = reduced ? { duration: motionTokens.duration.instant } : SPRING_GLYPH;
  return (
    <span className={styles.orb} data-state={state} aria-hidden="true">
      <svg className={styles.ring} viewBox="0 0 24 24" fill="none">
        <circle className={styles.track} cx="12" cy="12" r="10.75" />
        <g className={styles.spinner}>
          <circle className={styles.arc} cx="12" cy="12" r="10.75" pathLength={100} strokeDasharray="24 76" />
        </g>
        <motion.circle
          className={styles.closed}
          cx="12"
          cy="12"
          r="10.75"
          initial={false}
          animate={{ pathLength: closed ? 1 : 0, opacity: closed ? 1 : 0 }}
          transition={
            reduced
              ? { duration: 0 }
              : {
                  pathLength: { duration: 0.42, ease: EASE_ENTER },
                  opacity: { duration: motionTokens.duration.instant },
                }
          }
        />
      </svg>
      <AnimatePresence initial={false}>
        <motion.span
          key={glyph}
          className={styles.glyph}
          data-glyph={glyph}
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: 0 } }
              : { opacity: 0, scale: 0.4, transition: { duration: motionTokens.duration.instant, ease: EASE_STANDARD } }
          }
          transition={transition}
        >
          {glyph === "mark" ? (
            mark
          ) : glyph === "stop" ? (
            <span className={styles.stopGlyph} />
          ) : (
            <svg viewBox="0 0 24 24" fill="none">
              <motion.path
                d={glyph === "check" ? "M5.5 12.5l4.25 4.25L18.5 7.75" : "M7.5 7.5l9 9M16.5 7.5l-9 9"}
                initial={reduced ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.28, delay: 0.12, ease: EASE_ENTER }}
              />
            </svg>
          )}
        </motion.span>
      </AnimatePresence>
      <AnimatePresence>
        {state === "needs-input" ? (
          <motion.span
            key="dot"
            className={styles.dot}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0, transition: { duration: motionTokens.duration.instant } }}
            transition={transition}
          />
        ) : null}
      </AnimatePresence>
    </span>
  );
}

interface LabelView {
  key: string;
  text: string;
  icon?: AgentIcon;
  progress?: AgentProgress;
  tone: "live" | "plain" | "quiet";
}

function LabelUnit({ view, icon }: { view: LabelView; icon?: AgentIcon }) {
  const Icon = icon;
  return (
    <>
      {Icon ? <Icon className={styles.labelIcon} size={16} strokeWidth={1.75} aria-hidden="true" /> : null}
      <span className={styles.labelText}>
        {view.text}
        {view.progress ? (
          <span className={styles.count}>
            {" "}
            {view.progress.value} of {view.progress.total}
          </span>
        ) : null}
      </span>
    </>
  );
}

function AnimatedLabel({ view, reduced }: { view: LabelView; reduced: boolean }) {
  return (
    <span className={styles.labelSlot}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={view.key}
          className={styles.labelUnit}
          data-tone={view.tone}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: 0 } }
              : { opacity: 0, y: -12, transition: { duration: 0.14, ease: EASE_STANDARD } }
          }
          transition={{ duration: reduced ? motionTokens.duration.instant : 0.18, ease: EASE_STANDARD }}
        >
          <LabelUnit view={view} icon={view.icon} />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function StaticLabel({ view }: { view: LabelView }) {
  return (
    <span className={styles.labelSlot}>
      <span className={styles.labelUnit} data-tone={view.tone}>
        <LabelUnit view={view} icon={view.icon} />
      </span>
    </span>
  );
}

function Segments({ steps, progress }: { steps: AgentStep[]; progress?: AgentProgress }) {
  const finished = steps.filter((step) => step.status === "done" || step.status === "skipped").length;
  return (
    <div
      className={styles.segments}
      role="progressbar"
      aria-label="Run progress"
      aria-valuemin={0}
      aria-valuemax={steps.length}
      aria-valuenow={finished}
      aria-valuetext={`${finished} of ${steps.length} steps finished`}
    >
      {steps.map((step) => {
        const fill =
          step.status === "done" || step.status === "skipped" || step.status === "failed"
            ? 1
            : step.status === "active" && progress
              ? progress.value / progress.total
              : 0;
        return (
          <span key={step.id} className={styles.segment} data-status={step.status}>
            <span className={styles.segmentFill} style={{ transform: `scaleX(${fill})` }} />
          </span>
        );
      })}
    </div>
  );
}

interface StepListProps {
  steps: AgentStep[];
  progress?: AgentProgress;
  running: boolean;
  clock: Clock;
  now: number;
  reduced: boolean;
  limit: number;
}

function StepList({ steps, progress, running, clock, now, reduced, limit }: StepListProps) {
  const visible = steps.filter((step) => step.status !== "pending").slice(-limit);
  const layout = reduced ? { duration: 0 } : SPRING_SMOOTH;
  return (
    <ol className={styles.steps}>
      <AnimatePresence mode="popLayout" initial={false}>
        {visible.map((step) => {
          const Icon = step.icon;
          const live = step.status === "active" || step.status === "waiting";
          const ms = live
            ? clock.since(step.startedAt === undefined ? undefined : toMs(step.startedAt), now)
            : step.durationMs;
          return (
            <motion.li
              key={step.id}
              layout="position"
              className={styles.step}
              data-status={step.status}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}
              transition={{ layout, opacity: { duration: reduced ? 0 : 0.18, ease: EASE_STANDARD } }}
            >
              <span className={styles.stepIcon}>
                {Icon ? <Icon size={16} strokeWidth={1.75} aria-hidden="true" /> : null}
              </span>
              <span className={styles.stepText}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={step.label}
                    className={running && step.status === "active" ? `${styles.stepLabel} ${styles.shimmer}` : styles.stepLabel}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    transition={{ duration: reduced ? 0 : 0.16, ease: EASE_STANDARD }}
                  >
                    {step.label}
                    {step.status === "active" && progress ? (
                      <span className={styles.count}>
                        {" "}
                        {progress.value} of {progress.total}
                      </span>
                    ) : null}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className={styles.stepTime}>
                {ms !== undefined && (live || ms > 0)
                  ? live
                    ? `${Math.floor(ms / 1000)}s`
                    : ms < 10000
                      ? `${(Math.floor(ms / 100) / 10).toFixed(1)}s`
                      : formatShort(ms)
                  : ""}
              </span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}

function Slot({
  children,
  className,
  onLeave,
  reduced,
}: {
  children: ReactNode;
  className?: string;
  onLeave: () => void;
  reduced: boolean;
}) {
  const present = useIsPresent();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!present && ref.current?.contains(document.activeElement)) onLeave();
  }, [present, onLeave]);
  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: reduced ? 0 : motionTokens.duration.fast, delay: reduced ? 0 : 0.06, ease: EASE_STANDARD } }}
      exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1, ease: EASE_STANDARD } }}
    >
      {children}
    </motion.span>
  );
}

/* ---------------------------------------------------------------------------------------------- */
/* surface                                                                                        */
/* ---------------------------------------------------------------------------------------------- */

const DEFAULT_AGENT: AgentStatusAgent = { name: "Agent" };

const toMs = (value: number | Date | undefined) => (value instanceof Date ? value.getTime() : value);

const evenCeil = (value: number) => 2 * Math.ceil(value / 2);

const noopSnapshot = () => 0;

function AgentStatusSurface(props: AgentStatusProps & { status: AgentStatusValue }) {
  const {
    status,
    activity,
    steps = [],
    startedAt,
    endedAt,
    agent = DEFAULT_AGENT,
    onPause,
    onResume,
    onStop,
    onApprove,
    onDeny,
    onRetry,
    onOpenRun,
    settleAfter = 4000,
    align = "center",
    expanded: expandedProp,
    defaultExpanded = false,
    onExpandedChange,
    maxSteps = 5,
    notice,
    onWidthChange,
    className,
  } = props;

  const reduced = useReducedMotion() ?? false;
  const bodyId = useId();
  const startMs = toMs(startedAt);
  const endMs = toMs(endedAt);

  const rootRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLButtonElement>(null);
  const ghostCollapsedRef = useRef<HTMLDivElement>(null);
  const ghostExpandedRef = useRef<HTMLDivElement>(null);

  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const expanded = expandedProp ?? internalExpanded;
  const setExpanded = useCallback(
    (next: boolean) => {
      if (expandedProp === undefined) setInternalExpanded(next);
      onExpandedChange?.(next);
    },
    [expandedProp, onExpandedChange],
  );
  const focusHead = useCallback(() => headRef.current?.focus({ preventScroll: true }), []);

  const settleKey = status === "done" || status === "stopped" ? `${status}:${endMs ?? startMs ?? 0}` : null;
  const [settled, setSettled] = useState<string | null>(null);
  useEffect(() => {
    if (!settleKey || settleAfter === null) return;
    const timer = window.setTimeout(() => setSettled(settleKey), settleAfter);
    return () => window.clearTimeout(timer);
  }, [settleKey, settleAfter]);
  const shown: AgentStatusValue = settleKey && settled === settleKey ? "idle" : status;

  const [clock] = useState(createClock);
  useEffect(() => {
    clock.sync({ startedAt: startMs, status, endedAt: endMs });
  }, [clock, startMs, status, endMs]);

  const now = useSyncExternalStore(clock.subscribe, clock.getSnapshot, noopSnapshot);
  const elapsed = clock.since(startMs, now);
  const elapsedLabel = formatClock(elapsed);

  let view: LabelView;
  if (shown === "working") {
    view = {
      key: `working:${activity?.label ?? ""}`,
      text: activity?.label ?? "Working",
      icon: activity?.icon,
      progress: activity?.progress,
      tone: "live",
    };
  } else if (shown === "needs-input") {
    view = {
      key: `input:${activity?.label ?? ""}`,
      text: activity?.label ?? "Needs your input",
      icon: activity?.icon ?? ShieldAlert,
      tone: "plain",
    };
  } else if (shown === "paused") {
    view = { key: "paused", text: "Paused", icon: Pause, tone: "quiet" };
  } else if (shown === "done") {
    view = {
      key: `done:${activity?.label ?? ""}`,
      text: `Done in ${formatShort(elapsed)}${activity?.label ? ` · ${activity.label}` : ""}`,
      tone: "plain",
    };
  } else if (shown === "failed") {
    view = { key: `failed:${activity?.label ?? ""}`, text: activity?.label ?? "Run failed", tone: "plain" };
  } else if (shown === "stopped") {
    view = { key: "stopped", text: `Stopped after ${formatShort(elapsed)}`, tone: "quiet" };
  } else {
    view = { key: "idle", text: "Ready", tone: "quiet" };
  }

  const [ghosts, setGhosts] = useState({ collapsed: 0, expanded: 0 });
  const [container, setContainer] = useState(0);
  const [bodyHeight, setBodyHeight] = useState(0);

  useLayoutEffect(() => {
    const collapsed = ghostCollapsedRef.current;
    const expandedGhost = ghostExpandedRef.current;
    const parent = rootRef.current?.parentElement;
    if (!collapsed || !expandedGhost || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      setGhosts((current) => {
        const nextCollapsed = evenCeil(collapsed.getBoundingClientRect().width);
        const nextExpanded = evenCeil(expandedGhost.getBoundingClientRect().width);
        return current.collapsed === nextCollapsed && current.expanded === nextExpanded
          ? current
          : { collapsed: nextCollapsed, expanded: nextExpanded };
      });
    });
    observer.observe(collapsed);
    observer.observe(expandedGhost);
    const parentObserver = new ResizeObserver(([entry]) => {
      if (entry) setContainer(Math.floor(entry.contentRect.width));
    });
    if (parent) parentObserver.observe(parent);
    return () => {
      observer.disconnect();
      parentObserver.disconnect();
    };
  }, []);

  const measureBody = useCallback((node: HTMLDivElement | null) => {
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setBodyHeight(Math.ceil(node.offsetHeight)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const mobile = container > 0 && container < 400;
  const inlineActions =
    shown === "needs-input" && (onApprove || onDeny)
      ? "approval"
      : shown === "failed" && onRetry
        ? "retry"
        : null;
  const showInline = expanded ? null : inlineActions;
  const timerRunning =
    startMs !== undefined && (shown === "working" || shown === "paused" || shown === "needs-input");
  const showTimer = timerRunning && !(mobile && inlineActions);
  const headTimer = expanded ? timerRunning : showTimer;
  const collapsedWidth = ghosts.collapsed
    ? container
      ? Math.min(ghosts.collapsed, container)
      : ghosts.collapsed
    : 0;

  const [panelWidth, setPanelWidth] = useState(384);
  const expandedPanelWidth = container ? Math.min(container, panelWidth) : panelWidth;
  const targetWidth = expanded ? expandedPanelWidth : collapsedWidth;
  const targetHeight = expanded && bodyHeight ? 40 + bodyHeight : 40;

  const width = useMotionValue<number | string>("max-content");
  const rootWidth = useMotionValue<number | string>("auto");
  const height = useMotionValue(40);
  const measured = useRef(false);
  const wasExpanded = useRef(expanded);
  const previousWidth = useRef(0);

  const syncFade = useCallback((value: number | string) => {
    const node = surfaceRef.current;
    if (!node) return;
    const next = typeof value === "number" ? value : previousWidth.current;
    node.style.setProperty("--fade", `${Math.min(24, Math.max(0, previousWidth.current - next))}px`);
  }, []);
  useMotionValueEvent(width, "change", syncFade);

  useLayoutEffect(() => {
    if (!collapsedWidth) return;
    const changed = wasExpanded.current !== expanded;
    wasExpanded.current = expanded;
    if (!measured.current || reduced) {
      measured.current = true;
      width.jump(targetWidth);
      rootWidth.jump(collapsedWidth);
      return;
    }
    animate(width, targetWidth, changed ? SPRING_SMOOTH : SPRING_SNAP);
    animate(rootWidth, collapsedWidth, SPRING_SNAP);
  }, [targetWidth, collapsedWidth, expanded, reduced, width, rootWidth]);

  useLayoutEffect(() => {
    if (!measured.current || reduced) height.jump(targetHeight);
    else animate(height, targetHeight, SPRING_SMOOTH);
  }, [targetHeight, reduced, height]);

  useLayoutEffect(() => {
    previousWidth.current = expanded ? ghosts.expanded : ghosts.collapsed;
    syncFade(width.get());
  }, [expanded, ghosts, syncFade, width]);

  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!surfaceRef.current?.contains(event.target as Node)) setExpanded(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [expanded, setExpanded]);

  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (!opened) return;
    const timer = window.setTimeout(() => setOpened(false), 1600);
    return () => window.clearTimeout(timer);
  }, [opened]);

  const primaryAction =
    shown === "working" && onPause
      ? { label: "Pause", Icon: Pause, run: onPause, accent: false }
      : shown === "paused" && onResume
        ? { label: "Resume", Icon: Play, run: onResume, accent: true }
        : shown === "needs-input" && onApprove
          ? { label: "Approve", Icon: Check, run: onApprove, accent: true }
          : shown === "failed" && onRetry
            ? { label: "Retry", Icon: RotateCcw, run: onRetry, accent: true }
            : null;
  const secondaryAction =
    (shown === "working" || shown === "paused") && onStop
      ? { label: "Stop", Icon: Square, run: onStop }
      : shown === "needs-input" && onDeny
        ? { label: "Deny", Icon: X, run: onDeny }
        : null;

  const renderInline = (ghost: boolean) => {
    const tabIndex = ghost ? -1 : undefined;
    if (inlineActions === "retry") {
      return (
        <Button
          variant="primary"
          size="sm"
          tabIndex={tabIndex}
          className={`${styles.inlineButton} ${styles.accentButton} ${mobile ? styles.iconButton : ""}`}
          aria-label={mobile ? "Retry" : undefined}
          onClick={onRetry}
        >
          <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
          {mobile ? null : "Retry"}
        </Button>
      );
    }
    return (
      <>
        {onDeny ? (
          <Button
            variant="secondary"
            size="sm"
            tabIndex={tabIndex}
            className={`${styles.inlineButton} ${mobile ? styles.iconButton : ""}`}
            aria-label={mobile ? "Deny" : undefined}
            onClick={onDeny}
          >
            {mobile ? <X size={16} strokeWidth={1.75} aria-hidden="true" /> : "Deny"}
          </Button>
        ) : null}
        {onApprove ? (
          <Button
            variant="primary"
            size="sm"
            tabIndex={tabIndex}
            className={`${styles.inlineButton} ${styles.accentButton} ${mobile ? styles.iconButton : ""}`}
            aria-label={mobile ? "Approve" : undefined}
            onClick={onApprove}
          >
            {mobile ? <Check size={16} strokeWidth={1.75} aria-hidden="true" /> : "Approve"}
          </Button>
        ) : null}
      </>
    );
  };

  const needsFooter = steps.some((step) => step.status !== "pending");
  const currentIndex = steps.findIndex(
    (step) => step.status === "active" || step.status === "waiting" || step.status === "failed",
  );
  const finished = steps.filter((step) => step.status === "done" || step.status === "skipped").length;
  const metaText = steps.length
    ? currentIndex >= 0
      ? `Step ${currentIndex + 1} of ${steps.length}`
      : `${finished} of ${steps.length} steps`
    : "";

  const announcement =
    shown === "done"
      ? `${agent.name}: done in ${formatWords(elapsed)}${activity?.label ? `, ${activity.label}` : ""}`
      : shown === "stopped"
        ? `${agent.name}: stopped after ${formatWords(elapsed)}`
        : `${agent.name}: ${view.text}`;
  const headLabel = `${agent.name}: ${view.text}${
    view.progress ? ` ${view.progress.value} of ${view.progress.total}` : ""
  }${headTimer ? `, ${elapsedLabel} elapsed` : ""}`;
  const surfaceStyle = { width, height, "--panel-w": `${expandedPanelWidth - 2}px` } as unknown as MotionStyle;

  return (
    <motion.div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-align={align}
      style={{ width: rootWidth }}
    >
      <motion.div
        ref={surfaceRef}
        className={styles.surface}
        data-expanded={expanded}
        data-state={shown}
        style={surfaceStyle}
        onKeyDown={(event) => {
          if (event.key === "Escape" && expanded) {
            event.stopPropagation();
            setExpanded(false);
            focusHead();
          }
        }}
        onBlur={(event) => {
          if (event.relatedTarget || !expanded) return;
          const target = event.target as HTMLElement;
          requestAnimationFrame(() => {
            if (!target.isConnected && document.activeElement === document.body) focusHead();
          });
        }}
      >
        <div className={styles.row}>
          <button
            ref={headRef}
            type="button"
            className={styles.head}
            data-actions={showInline ? "" : undefined}
            aria-expanded={expanded}
            aria-controls={expanded ? bodyId : undefined}
            aria-label={headLabel}
            onClick={() => {
              if (!expanded) setPanelWidth(Math.max(384, collapsedWidth));
              setExpanded(!expanded);
            }}
          >
            <Orb state={shown} mark={agent.mark} reduced={reduced} />
            <AnimatedLabel view={view} reduced={reduced} />
            <AnimatePresence mode="popLayout" initial={false}>
              {headTimer ? (
                <motion.span
                  key="timer"
                  className={styles.timer}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
                  transition={{ duration: reduced ? 0 : motionTokens.duration.fast, ease: EASE_STANDARD }}
                >
                  {elapsedLabel}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </button>
          <AnimatePresence mode="popLayout" initial={false}>
            {showInline ? (
              <Slot key={`${showInline}:${mobile}`} className={styles.actions} onLeave={focusHead} reduced={reduced}>
                {renderInline(false)}
              </Slot>
            ) : null}
          </AnimatePresence>
        </div>
        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              key="body"
              ref={measureBody}
              id={bodyId}
              role="region"
              aria-label={`${agent.name} run details`}
              className={styles.body}
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                transition: { duration: reduced ? 0 : 0.2, delay: reduced ? 0 : 0.08, ease: EASE_STANDARD },
              }}
              exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1, ease: EASE_STANDARD } }}
            >
              {needsFooter ? (
                <>
                  <div className={styles.progress}>
                    <div className={styles.meta}>
                      <span className={styles.agentName}>{agent.name}</span>
                      <span>{metaText}</span>
                    </div>
                    <Segments steps={steps} progress={activity?.progress} />
                  </div>
                  <StepList
                    steps={steps}
                    progress={shown === "working" || shown === "paused" ? activity?.progress : undefined}
                    running={shown === "working"}
                    clock={clock}
                    now={now}
                    reduced={reduced}
                    limit={maxSteps}
                  />
                </>
              ) : (
                <p className={styles.empty}>
                  {shown === "idle"
                    ? `No run yet. Steps show here while ${agent.name} works.`
                    : `Steps show here as ${agent.name} works.`}
                </p>
              )}
              {primaryAction || secondaryAction || (onOpenRun && needsFooter) ? (
                <div className={styles.footer}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {primaryAction ? (
                      <Slot key="primary" className={styles.slot} onLeave={focusHead} reduced={reduced}>
                        <Button
                          variant={primaryAction.accent ? "primary" : "secondary"}
                          size="sm"
                          className={primaryAction.accent ? styles.accentButton : undefined}
                          onClick={primaryAction.run}
                        >
                          <primaryAction.Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                          {primaryAction.label}
                        </Button>
                      </Slot>
                    ) : null}
                    {secondaryAction ? (
                      <Slot key="secondary" className={styles.slot} onLeave={focusHead} reduced={reduced}>
                        <Button variant="secondary" size="sm" onClick={secondaryAction.run}>
                          <secondaryAction.Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                          {secondaryAction.label}
                        </Button>
                      </Slot>
                    ) : null}
                  </AnimatePresence>
                  {onOpenRun && needsFooter ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={mobile ? `${styles.open} ${styles.openIcon}` : styles.open}
                      aria-label={mobile ? (opened ? "Opened" : "Open run") : undefined}
                      onClick={() => {
                        onOpenRun();
                        setOpened(true);
                      }}
                    >
                      {mobile ? (
                        opened ? (
                          <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                        ) : (
                          <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true" />
                        )
                      ) : opened ? (
                        <>
                          <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                          Opened
                        </>
                      ) : (
                        <>
                          Open run
                          <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true" />
                        </>
                      )}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
      <div className={styles.ghosts} aria-hidden="true" inert>
        <div ref={ghostCollapsedRef} className={styles.ghost}>
          <span className={styles.head} data-actions={inlineActions ? "" : undefined}>
            <span className={styles.orbSpace} />
            <StaticLabel view={view} />
            {showTimer ? <span className={styles.timer}>{elapsedLabel}</span> : null}
          </span>
          {inlineActions ? <span className={styles.actions}>{renderInline(true)}</span> : null}
        </div>
        <div ref={ghostExpandedRef} className={styles.ghost}>
          <span className={styles.head}>
            <span className={styles.orbSpace} />
            <StaticLabel view={view} />
            {timerRunning ? <span className={styles.timer}>{elapsedLabel}</span> : null}
          </span>
        </div>
      </div>
      <span className={styles.srOnly} role="status">
        {[announcement, notice].filter(Boolean).join(". ")}
      </span>
    </motion.div>
  );
}

function SimulatedAgentStatus(props: AgentStatusProps) {
  const simulation = useAgentRunSimulation("coding");
  return (
    <AgentStatusSurface
      {...props}
      status={simulation.status}
      activity={simulation.activity}
      steps={simulation.steps}
      startedAt={simulation.startedAt}
      endedAt={simulation.endedAt}
      agent={simulation.agent}
      notice={simulation.notice}
      onPause={simulation.onPause}
      onResume={simulation.onResume}
      onStop={simulation.onStop}
      onApprove={simulation.onApprove}
      onDeny={simulation.onDeny}
      onRetry={simulation.onRetry}
      onOpenRun={simulation.onOpenRun}
    />
  );
}

/**
 * One-line agent run pill that opens into the full step log. It shows what the agent is doing,
 * how long it has run, and parks on the approval it needs; finished runs settle back to `Ready`.
 */
export function AgentStatus(props: AgentStatusProps) {
  return props.status === undefined ? <SimulatedAgentStatus {...props} /> : <AgentStatusSurface {...props} status={props.status} />;
}

export default AgentStatus;
