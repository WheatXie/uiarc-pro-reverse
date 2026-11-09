"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Archive,
  ArrowUp,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleSlash,
  CircleX,
  Clock3,
  FileDiff,
  FileMinus,
  FilePlus,
  GitBranch,
  GitMerge,
  GitPullRequestArrow,
  LoaderCircle,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  ShieldEllipsis,
  Square,
  Undo2,
} from "lucide-react";
import Button from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import type { Segment } from "../segmented-control/segmented-control";
import Tooltip from "../tooltip/tooltip";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./agent-tasks.module.css";

export type TaskStatus = "queued" | "setting-up" | "running" | "ready" | "failed" | "cancelled" | "merged";
export type TaskStepState = "done" | "active" | "failed" | "stopped";
export type TaskFileChange = "added" | "modified" | "deleted";
export type FilterValue = "all" | "running" | "review" | "merged";
export type PullRequestState = "open" | "merged" | "draft" | "closed";

export interface TaskStep {
  text: string;
  state: TaskStepState;
  seconds?: number;
  detail?: string;
}

export interface TaskFile {
  path: string;
  additions: number;
  deletions: number;
  change?: TaskFileChange;
}

export interface TaskChecks {
  state: "pending" | "passed" | "failed";
  failed?: number;
}

export interface TaskPullRequest {
  number: number;
  state: PullRequestState;
  url?: string;
}

export interface Task {
  id: string;
  title: string;
  repo: string;
  branch: string;
  baseBranch?: string;
  model: string;
  status: TaskStatus;
  startedAt: number;
  finishedAt?: number;
  step?: string;
  steps?: TaskStep[];
  files?: TaskFile[];
  checks?: TaskChecks;
  error?: string;
  pullRequest?: TaskPullRequest;
}

export interface ModelOption {
  id: string;
  name: string;
  short: string;
  provider: "anthropic" | "openai" | "google";
}

export interface RepositoryOption {
  name: string;
  branches: string[];
  defaultBranch: string;
}

export interface StartInput {
  prompt: string;
  repo: string;
  branch: string;
  model: string;
}

export interface AgentTasksProps {
  tasks?: Task[];
  repositories?: RepositoryOption[];
  models?: ModelOption[];
  onStart?: (input: StartInput) => void | Promise<unknown>;
  onCreatePullRequest?: (task: Task) => TaskPullRequest | Promise<TaskPullRequest>;
  onCancel?: (task: Task) => void;
  onRetry?: (task: Task) => void;
  onArchive?: (task: Task) => void;
  defaultFilter?: FilterValue;
  className?: string;
}

/* ------------------------------------------------------------------ tokens */

const { spring: SPRING, duration: DURATION, ease: EASE } = motionTokens;
const EASE_ENTER: [number, number, number, number] = [EASE.enter[0], EASE.enter[1], EASE.enter[2], EASE.enter[3]];
const SWAP_SPRING = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;
const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

/* ------------------------------------------------------------- formatting */

/** Compact elapsed clock: 42s, 2m 12s, 1h 5m. */
function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return total % 60 ? `${minutes}m ${total % 60}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/** Spoken elapsed: "1 minute 55 seconds". */
function spoken(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const parts: string[] = [];
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  if (!hours && (seconds || !parts.length)) parts.push(`${seconds} second${seconds === 1 ? "" : "s"}`);
  return parts.join(" ");
}

const isActive = (status: TaskStatus) => status === "queued" || status === "setting-up" || status === "running";

const STATUS_LABEL: Record<TaskStatus, string> = {
  queued: "Queued",
  "setting-up": "Setting up environment",
  running: "Running",
  ready: "Ready for review",
  failed: "Failed",
  cancelled: "Cancelled",
  merged: "Merged",
};

const STEP_STATE_LABEL: Record<TaskStepState, string> = {
  done: "Done",
  active: "In progress",
  failed: "Failed",
  stopped: "Stopped",
};

const CHANGE_LABEL: Record<TaskFileChange, string> = {
  added: "Added",
  deleted: "Deleted",
  modified: "Modified",
};

/* ------------------------------------------------------------------- data */

export const REPOSITORIES: RepositoryOption[] = [
  { name: "arc-ui/web", branches: ["main", "release/2026-10", "next"], defaultBranch: "main" },
  { name: "arc-ui/api", branches: ["main", "staging"], defaultBranch: "main" },
  { name: "arc-ui/billing", branches: ["main", "stripe-migration"], defaultBranch: "main" },
  { name: "arc-ui/docs", branches: ["main"], defaultBranch: "main" },
];

export const MODELS: ModelOption[] = [
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", short: "Opus 5.5", provider: "anthropic" },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", short: "Sonnet 5.5", provider: "anthropic" },
  { id: "claude-fable-5-1", name: "Claude Fable 5.1", short: "Fable 5.1", provider: "anthropic" },
  { id: "gpt-6-1-sol", name: "GPT-6.1 Sol", short: "GPT-6.1 Sol", provider: "openai" },
  { id: "gemini-4-argon", name: "Gemini 4 Argon", short: "Gemini 4 Argon", provider: "google" },
];

interface Script {
  steps: Array<{ live: string; done?: string }>;
  files: TaskFile[];
}

/** A plausible run, picked from the prompt so a new task reads like the seeded ones. */
function scriptFor(task: Task): Script {
  const prompt = `${task.title} ${task.branch}`;
  if (/rate[- ]?limit|throttl|\blimits?\b/i.test(prompt)) {
    return {
      steps: [
        { live: "Reading src/server.ts" },
        { live: "Reading src/middleware/auth.ts" },
        { live: "Writing src/middleware/rate-limit.ts", done: "Added a sliding window limiter" },
        { live: "Writing tests for limit headers", done: "Wrote 9 tests for limits and headers" },
        { live: "Running tests", done: "Ran pnpm test, all passed" },
      ],
      files: [
        { path: "src/middleware/rate-limit.ts", additions: 61, deletions: 0, change: "added" },
        { path: "src/middleware/rate-limit.test.ts", additions: 44, deletions: 0, change: "added" },
        { path: "src/server.ts", additions: 5, deletions: 1, change: "modified" },
      ],
    };
  }
  if (/webhook|\bretr(y|ies)\b|backoff/i.test(prompt)) {
    return {
      steps: [
        { live: "Reading packages/webhooks/src/sender.ts" },
        { live: "Reading packages/webhooks/src/sender.test.ts", done: "Read the failing test" },
        { live: "Using fake timers in the retry test", done: "Switched the retry test to fake timers" },
        { live: "Running tests", done: "Ran pnpm test, 148 passed" },
      ],
      files: [
        { path: "packages/webhooks/src/sender.ts", additions: 52, deletions: 14, change: "modified" },
        { path: "packages/webhooks/src/backoff.ts", additions: 27, deletions: 0, change: "added" },
        { path: "packages/webhooks/src/sender.test.ts", additions: 9, deletions: 6, change: "modified" },
      ],
    };
  }
  if (/flaky|failing test|\bci\b/i.test(prompt)) {
    return {
      steps: [
        { live: "Searching for waitForPayment" },
        { live: "Reading src/checkout/payment.ts" },
        { live: "Reading src/checkout/payment.test.ts" },
        { live: "Replacing the fixed timeout with a polled assertion" },
        { live: "Running tests 20 times in a row", done: "Ran the checkout tests 20 times, all passed" },
        { live: "Running lint and typecheck", done: "Ran pnpm lint and typecheck" },
      ],
      files: [
        { path: "src/checkout/payment.test.ts", additions: 14, deletions: 9, change: "modified" },
        { path: "src/test/wait-for.ts", additions: 19, deletions: 0, change: "added" },
        { path: "vitest.config.ts", additions: 1, deletions: 1, change: "modified" },
      ],
    };
  }
  if (/upgrade|bump|update|dependenc|version/i.test(prompt)) {
    return {
      steps: [
        { live: "Reading package.json" },
        { live: "Updating pnpm-lock.yaml", done: "Updated the lockfile" },
        { live: "Running typecheck", done: "Ran pnpm typecheck, 7 errors" },
        { live: "Fixing type errors in src/lib", done: "Fixed 7 type errors in src/lib" },
        { live: "Running tests" },
      ],
      files: [
        { path: "package.json", additions: 2, deletions: 2, change: "modified" },
        { path: "pnpm-lock.yaml", additions: 26, deletions: 31, change: "modified" },
        { path: "src/lib/client.ts", additions: 12, deletions: 15, change: "modified" },
        { path: "src/lib/errors.ts", additions: 8, deletions: 4, change: "modified" },
      ],
    };
  }
  return {
    steps: [
      { live: "Reading the repository layout" },
      { live: "Reading src/billing/invoice.ts" },
      { live: "Editing src/billing/invoice.ts" },
      { live: "Running tests", done: "Ran pnpm test, all passed" },
      { live: "Running lint and typecheck", done: "Ran pnpm lint and typecheck" },
    ],
    files: [
      { path: "src/billing/invoice.ts", additions: 34, deletions: 11, change: "modified" },
      { path: "src/billing/invoice.test.ts", additions: 22, deletions: 3, change: "modified" },
    ],
  };
}

interface Phase {
  live: string;
  done: string;
  ms: number;
  status: "setting-up" | "running";
}

function phasesFor(task: Task): Phase[] {
  const script = scriptFor(task);
  return [
    { live: `Cloning ${task.repo}`, done: `Cloned ${task.repo} at ${task.baseBranch ?? "main"}`, ms: 900, status: "setting-up" },
    { live: "Installing dependencies", done: "Installed dependencies with pnpm", ms: 1500, status: "setting-up" },
    ...script.steps.map((step, index) => ({
      live: step.live,
      done: step.done ?? step.live,
      ms: 1150 + ((389 * index) % 700),
      status: "running" as const,
    })),
  ];
}

interface Tick {
  delay: number;
  announce?: string;
  apply: (task: Task, now: number) => Task;
}

/** The scripted timeline behind one simulated run. */
function runFor(task: Task, activeIndex: number): Tick[] {
  const phases = phasesFor(task);
  const files = scriptFor(task).files;
  const ticks: Tick[] = [];
  const advance = (index: number, delay: number) => {
    const next = phases[index];
    const previous = phases[index - 1];
    ticks.push({
      delay,
      apply: (current, now) => {
        const steps = current.steps ?? [];
        let marked = false;
        const done = steps.map((step) => {
          if (step.state !== "active") return step;
          marked = true;
          return {
            ...step,
            text: previous?.done ?? step.text,
            state: "done" as const,
            seconds: Math.max(1, Math.round((previous?.ms ?? 1000) / 1000)),
          };
        });
        const base = marked ? done : previous ? [...done, { text: previous.done, state: "done" as const, seconds: Math.max(1, Math.round(previous.ms / 1000)) }] : done;
        return {
          ...current,
          status: next.status,
          step: next.status === "setting-up" ? "Setting up environment" : next.live,
          steps: [...base, { text: next.live, state: "active" as const }],
        };
      },
    });
  };
  if (activeIndex < 0) advance(0, 1100);
  for (let index = Math.max(1, activeIndex + 1); index < phases.length; index += 1) advance(index, phases[index - 1].ms);
  const last = phases[phases.length - 1];
  ticks.push({
    delay: last.ms,
    announce: `${task.title} is ready for review.`,
    apply: (current, now) => ({
      ...current,
      status: "ready",
      step: undefined,
      finishedAt: now,
      steps: (current.steps ?? []).map((step) =>
        step.state === "active"
          ? { ...step, text: last.done, state: "done" as const, seconds: Math.max(1, Math.round(last.ms / 1000)) }
          : step,
      ),
      files,
      checks: { state: "passed" as const },
    }),
  });
  return ticks;
}

/** First sentence of the prompt, cut to a title. */
function titleFor(prompt: string): string {
  const line = prompt.split("\n").find((entry) => entry.trim().length > 0) ?? prompt;
  const text = line.trim().replace(/\s+/g, " ");
  const trimmed = text.length > 110 ? `${text.slice(0, 107).trimEnd()}…` : text;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

const STOPWORDS = ["the", "a", "an", "to", "and", "in", "of", "for", "on"];

function branchFor(title: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOPWORDS.includes(word));
  return `agent/${words.slice(0, 4).join("-") || "task"}`;
}

const EMPTY_COPY: Record<FilterValue, { title: string; body: string }> = {
  all: {
    title: "No tasks yet",
    body: "Describe a task above. An agent works on it in the background and comes back with a branch to review.",
  },
  running: { title: "Nothing running", body: "Started tasks show here while an agent works on them." },
  review: { title: "Nothing to review", body: "Finished runs wait here until you open a pull request." },
  merged: { title: "Nothing merged yet", body: "Pull requests from agent runs land here once they merge." },
};

function seed(): { base: number; tasks: Task[] } {
  const base = Date.now();
  return {
    base,
    tasks: [
      {
        id: "task-flaky-checkout",
        title: "Fix the flaky checkout test in CI",
        repo: "arc-ui/web",
        branch: "fix/flaky-checkout-test",
        model: "claude-opus-5-5",
        status: "running",
        startedAt: base - 112000,
        step: "Reading src/checkout/payment.test.ts",
        steps: [
          { text: "Cloned arc-ui/web at main", state: "done", seconds: 4 },
          { text: "Installed dependencies with pnpm", state: "done", seconds: 38 },
          { text: "Searched for waitForPayment", state: "done", seconds: 2 },
          { text: "Read src/checkout/payment.ts", state: "done", seconds: 6 },
          { text: "Reading src/checkout/payment.test.ts", state: "active" },
        ],
      },
      {
        id: "task-rate-limit",
        title: "Add rate limiting to the public API",
        repo: "arc-ui/api",
        branch: "feat/api-rate-limit",
        model: "claude-sonnet-5-5",
        status: "ready",
        startedAt: base - 2460000,
        finishedAt: base - 2060000,
        steps: [
          { text: "Cloned arc-ui/api at main", state: "done", seconds: 3 },
          { text: "Installed dependencies with pnpm", state: "done", seconds: 41 },
          { text: "Read src/server.ts and src/middleware", state: "done", seconds: 9 },
          { text: "Added a sliding window limiter keyed by API key", state: "done", seconds: 132 },
          { text: "Wrote 12 tests for limits and headers", state: "done", seconds: 96 },
          { text: "Ran pnpm test, 148 passed", state: "done", seconds: 64 },
          { text: "Ran pnpm lint and typecheck", state: "done", seconds: 55 },
        ],
        files: [
          { path: "src/middleware/rate-limit.ts", additions: 68, deletions: 0, change: "added" },
          { path: "src/middleware/rate-limit.test.ts", additions: 31, deletions: 0, change: "added" },
          { path: "src/server.ts", additions: 6, deletions: 2, change: "modified" },
          { path: "src/config/limits.ts", additions: 11, deletions: 0, change: "added" },
          { path: "src/routes/public/index.ts", additions: 4, deletions: 9, change: "modified" },
          { path: "src/lib/redis.ts", additions: 3, deletions: 7, change: "modified" },
          { path: "docs/api/rate-limits.md", additions: 2, deletions: 0, change: "modified" },
        ],
        checks: { state: "passed" },
      },
      {
        id: "task-zod-upgrade",
        title: "Upgrade zod to v4 and fix the schema types",
        repo: "arc-ui/web",
        branch: "chore/zod-v4",
        model: "gpt-6-1-sol",
        status: "ready",
        startedAt: base - 9100000,
        finishedAt: base - 8240000,
        steps: [
          { text: "Cloned arc-ui/web at main", state: "done", seconds: 4 },
          { text: "Installed dependencies with pnpm", state: "done", seconds: 39 },
          { text: "Bumped zod from 3.25 to 4.1", state: "done", seconds: 12 },
          { text: "Fixed 31 type errors across 19 schemas", state: "done", seconds: 488 },
          { text: "Ran pnpm test, 412 passed", state: "done", seconds: 211 },
          { text: "Ran pnpm typecheck", state: "done", seconds: 106 },
        ],
        files: [
          { path: "package.json", additions: 1, deletions: 1, change: "modified" },
          { path: "pnpm-lock.yaml", additions: 18, deletions: 22, change: "modified" },
          { path: "src/schemas/checkout.ts", additions: 46, deletions: 51, change: "modified" },
          { path: "src/schemas/account.ts", additions: 38, deletions: 40, change: "modified" },
          { path: "src/schemas/invoice.ts", additions: 29, deletions: 33, change: "modified" },
          { path: "src/lib/forms/resolver.ts", additions: 22, deletions: 17, change: "modified" },
          { path: "src/schemas/errors.ts", additions: 64, deletions: 0, change: "added" },
          { path: "src/schemas/legacy-messages.ts", additions: 0, deletions: 58, change: "deleted" },
        ],
        checks: { state: "passed" },
        pullRequest: { number: 479, state: "open" },
      },
      {
        id: "task-webhook-retry",
        title: "Retry failed webhook deliveries with backoff",
        repo: "arc-ui/billing",
        branch: "feat/webhook-backoff",
        model: "gemini-4-argon",
        status: "failed",
        startedAt: base - 14800000,
        finishedAt: base - 14390000,
        error: "2 of 148 tests failed in packages/webhooks",
        steps: [
          { text: "Cloned arc-ui/billing at main", state: "done", seconds: 3 },
          { text: "Installed dependencies with pnpm", state: "done", seconds: 44 },
          { text: "Added exponential backoff to the delivery queue", state: "done", seconds: 174 },
          {
            text: "Ran pnpm test",
            state: "failed",
            seconds: 188,
            detail: "sender.test.ts: retries a 503 within 30 seconds timed out after 5000 ms",
          },
        ],
        files: [
          { path: "packages/webhooks/src/sender.ts", additions: 52, deletions: 14, change: "modified" },
          { path: "packages/webhooks/src/backoff.ts", additions: 27, deletions: 0, change: "added" },
        ],
        checks: { state: "failed", failed: 2 },
      },
      {
        id: "task-invoices-v1",
        title: "Remove the deprecated invoices v1 endpoint",
        repo: "arc-ui/api",
        branch: "chore/remove-invoices-v1",
        model: "claude-opus-5-5",
        status: "merged",
        startedAt: base - 178000000,
        finishedAt: base - 177460000,
        steps: [
          { text: "Cloned arc-ui/api at main", state: "done", seconds: 3 },
          { text: "Installed dependencies with pnpm", state: "done", seconds: 40 },
          { text: "Found 6 callers of /v1/invoices", state: "done", seconds: 18 },
          { text: "Removed the route, handlers and fixtures", state: "done", seconds: 241 },
          { text: "Ran pnpm test, 139 passed", state: "done", seconds: 72 },
        ],
        files: [
          { path: "src/routes/v1/invoices.ts", additions: 0, deletions: 318, change: "deleted" },
          { path: "src/routes/v1/invoices.test.ts", additions: 0, deletions: 204, change: "deleted" },
          { path: "src/routes/index.ts", additions: 2, deletions: 9, change: "modified" },
          { path: "test/fixtures/invoices-v1.json", additions: 0, deletions: 96, change: "deleted" },
          { path: "docs/api/changelog.md", additions: 10, deletions: 0, change: "modified" },
        ],
        checks: { state: "passed" },
        pullRequest: { number: 476, state: "merged" },
      },
    ],
  };
}

/* ------------------------------------------------------------------ marks */

function ClaudeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Claude" className={className} aria-hidden="true">
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

function OpenAIMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="OpenAI" className={className} aria-hidden="true">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="GitHub" className={className} aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function GeminiMark({ className }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const d =
    "M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z";
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Gemini" className={className} aria-hidden="true">
      <path d={d} fill="#3186FF" />
      <path d={d} fill={`url(#lobe-icons-gemini-0-${uid})`} />
      <path d={d} fill={`url(#lobe-icons-gemini-1-${uid})`} />
      <path d={d} fill={`url(#lobe-icons-gemini-2-${uid})`} />
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id={`lobe-icons-gemini-0-${uid}`} x1="7" x2="11" y1="15.5" y2="12">
          <stop stopColor="#08B962" />
          <stop offset="1" stopColor="#08B962" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={`lobe-icons-gemini-1-${uid}`} x1="8" x2="11.5" y1="5.5" y2="11">
          <stop stopColor="#F94543" />
          <stop offset="1" stopColor="#F94543" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={`lobe-icons-gemini-2-${uid}`} x1="3.5" x2="17.5" y1="13.5" y2="12">
          <stop stopColor="#FABC12" />
          <stop offset=".46" stopColor="#FABC12" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ModelMark({ model, className }: { model?: ModelOption; className?: string }) {
  if (model?.provider === "anthropic") return <ClaudeMark className={cx(styles.mark, styles.claude, className)} />;
  if (model?.provider === "openai") return <OpenAIMark className={cx(styles.mark, className)} />;
  if (model?.provider === "google") return <GeminiMark className={cx(styles.mark, className)} />;
  return (
    <span className={cx(styles.mark, styles.markLetter, className)} aria-hidden="true">
      {model?.short[0] ?? "?"}
    </span>
  );
}

/* -------------------------------------------------------------- primitives */

/** Crossfades its child and springs to the new child's width. */
function Swap({
  id,
  children,
  className,
  align = "start",
}: {
  id: string;
  children: ReactNode;
  className?: string;
  align?: "start" | "end";
}) {
  const reduced = useReducedMotion() ?? false;
  const content = useRef<HTMLSpanElement>(null);
  const width = useMotionValue<number | string>("auto");
  const previousId = useRef(id);
  const armedUntil = useRef(0);

  useLayoutEffect(() => {
    if (previousId.current === id) return;
    previousId.current = id;
    armedUntil.current = performance.now() + 600;
  }, [id]);

  useEffect(() => {
    const node = content.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let measured = false;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry?.borderBoxSize?.[0]?.inlineSize ?? node.offsetWidth;
      if (!measured || reduced || performance.now() > armedUntil.current) {
        measured = next > 0;
        width.jump(next || "auto");
        return;
      }
      animate(width, next, SWAP_SPRING);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced, width]);

  return (
    <motion.span className={cx(styles.swap, className)} data-align={align} style={{ width }}>
      <span ref={content} className={styles.swapContent}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={id}
            className={styles.swapItem}
            initial={{ opacity: 0, y: 2 * (reduced ? 0 : 1) }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
            transition={{ duration: reduced ? DURATION.instant : DURATION.fast, ease: EASE_ENTER }}
          >
            {children}
          </motion.span>
        </AnimatePresence>
      </span>
    </motion.span>
  );
}

/** Crossfades between the two states of one line. */
function Fade({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <span className={cx(styles.fade, className)}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          className={styles.fadeItem}
          initial={{ opacity: 0, y: 2 * (reduced ? 0 : 1) }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
          transition={{ duration: reduced ? DURATION.instant : DURATION.fast, ease: EASE_ENTER }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const COUNT_VARIANTS: Variants = {
  enter: (direction: number) => ({ y: `${0.7 * direction}em`, opacity: 0 }),
  center: { y: 0, opacity: 1, transition: { ...SWAP_SPRING, opacity: { duration: DURATION.fast } } },
  exit: (direction: number) => ({ y: `${-0.7 * direction}em`, opacity: 0, transition: { duration: DURATION.instant } }),
};

const COUNT_VARIANTS_REDUCED: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: DURATION.instant } },
  exit: { opacity: 0, transition: { duration: 0 } },
};

/** A number that rolls to its next value. */
function Count({ value }: { value: number }) {
  const reduced = useReducedMotion() ?? false;
  const [previous, setPrevious] = useState(value);
  const [direction, setDirection] = useState(1);
  if (previous !== value) {
    setPrevious(value);
    setDirection(value > previous ? 1 : -1);
  }
  return (
    <span className={styles.count}>
      <span className={styles.srOnly}>{value}</span>
      <span className={styles.countClip} aria-hidden="true">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.span key={value} custom={direction} variants={reduced ? COUNT_VARIANTS_REDUCED : COUNT_VARIANTS} initial="enter" animate="center" exit="exit">
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}

/** The running step, which shimmers as it changes. */
function Live({ text, live }: { text: string; live: boolean }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <span className={styles.live}>
      <AnimatePresence initial={false}>
        <motion.span
          key={text}
          className={cx(styles.liveText, live && styles.shimmer)}
          title={text}
          initial={{ opacity: 0, y: 3 * (reduced ? 0 : 1) }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
          transition={{ duration: reduced ? DURATION.instant : DURATION.fast, ease: EASE_ENTER }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === "queued") return <Clock3 aria-hidden="true" />;
  if (status === "ready") return <CircleCheck aria-hidden="true" />;
  if (status === "failed") return <CircleX aria-hidden="true" />;
  if (status === "cancelled") return <CircleSlash aria-hidden="true" />;
  if (status === "merged") return <GitMerge aria-hidden="true" />;
  return <LoaderCircle className={styles.spin} aria-hidden="true" />;
}

function StepIcon({ state }: { state: TaskStepState }) {
  if (state === "done") return <Check aria-hidden="true" />;
  if (state === "failed") return <CircleX aria-hidden="true" />;
  if (state === "stopped") return <Square aria-hidden="true" />;
  return <LoaderCircle className={styles.spin} aria-hidden="true" />;
}

function FileIcon({ change }: { change: TaskFileChange }) {
  if (change === "added") return <FilePlus aria-hidden="true" />;
  if (change === "deleted") return <FileMinus aria-hidden="true" />;
  return <FileDiff aria-hidden="true" />;
}

function Diff({ files }: { files: TaskFile[] }) {
  const additions = files.reduce((total, file) => total + file.additions, 0);
  const deletions = files.reduce((total, file) => total + file.deletions, 0);
  const total = additions + deletions || 1;
  const percent = Math.round((additions / total) * 100);
  return (
    <span className={styles.diff}>
      <span className={styles.srOnly}>
        {additions} lines added, {deletions} removed, {files.length} {files.length === 1 ? "file" : "files"} changed
      </span>
      <span className={styles.diffNumbers} aria-hidden="true">
        <span className={styles.add}>+{additions}</span>
        <span className={styles.del}>−{deletions}</span>
      </span>
      <span className={styles.diffBar} aria-hidden="true">
        {percent > 0 ? <span className={styles.diffAdd} style={{ flexGrow: percent }} /> : null}
        {percent < 100 ? <span className={styles.diffDel} style={{ flexGrow: 100 - percent }} /> : null}
      </span>
      <span className={styles.diffFiles} aria-hidden="true">
        {files.length} {files.length === 1 ? "file" : "files"}
      </span>
    </span>
  );
}

function Checks({ checks }: { checks: TaskChecks }) {
  if (checks.state === "passed") {
    return (
      <span className={styles.fact} data-tone="success">
        <ShieldCheck aria-hidden="true" />
        <span>Checks passed</span>
      </span>
    );
  }
  if (checks.state === "failed") {
    const failed = checks.failed ?? 1;
    return (
      <span className={styles.fact} data-tone="danger">
        <ShieldAlert aria-hidden="true" />
        <span>
          {failed} {failed === 1 ? "check" : "checks"} failed
        </span>
      </span>
    );
  }
  return (
    <span className={styles.fact}>
      <ShieldEllipsis aria-hidden="true" />
      <span>Checks running</span>
    </span>
  );
}

function Steps({ steps }: { steps: TaskStep[] }) {
  const reduced = useReducedMotion() ?? false;
  if (!steps.length) return <p className={styles.quiet}>Waiting for a runner</p>;
  return (
    <ol className={styles.steps}>
      <AnimatePresence initial={false}>
        {steps.map((step, index) => (
          <motion.li
            key={`${index}-${step.text}`}
            className={styles.step}
            data-state={step.state}
            initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={reduced ? { duration: DURATION.instant } : { ...SPRING.smooth, opacity: { duration: DURATION.standard, ease: EASE_ENTER } }}
          >
            <span className={styles.stepRow}>
              <span className={styles.stepIcon}>
                <StepIcon state={step.state} />
              </span>
              <span className={styles.srOnly}>{STEP_STATE_LABEL[step.state]}: </span>
              <span className={styles.stepText}>{step.text}</span>
              {step.seconds !== undefined && step.state !== "active" ? <span className={styles.stepTime}>{clock(step.seconds * 1000)}</span> : null}
            </span>
            {step.detail ? <span className={styles.stepDetail}>{step.detail}</span> : null}
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}

function Files({ files }: { files: TaskFile[] }) {
  return (
    <ul className={styles.files}>
      {files.map((file) => {
        const change = file.change ?? "modified";
        const split = file.path.lastIndexOf("/");
        return (
          <li className={styles.file} key={file.path} data-change={change}>
            <span className={styles.fileIcon}>
              <FileIcon change={change} />
            </span>
            <span className={styles.srOnly}>{CHANGE_LABEL[change]}: </span>
            <span className={styles.path} title={file.path}>
              {split > 0 ? <span className={styles.dir}>{file.path.slice(0, split + 1)}</span> : null}
              <span className={styles.base}>{file.path.slice(split + 1)}</span>
            </span>
            <span className={styles.fileStat}>
              <span className={styles.add}>+{file.additions}</span>
              <span className={styles.del}>−{file.deletions}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

interface PickerOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

/** A composer chip that opens a radio menu. */
function Picker({
  label,
  value,
  options,
  onChange,
  icon,
}: {
  label: string;
  value: string;
  options: PickerOption[];
  onChange: (value: string) => void;
  icon?: ReactNode;
}) {
  const selected = options.find((option) => option.value === value) ?? options[0];
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger className={styles.chip} aria-label={`${label}: ${selected?.label ?? "none"}`}>
        <Swap id={value}>
          <span className={styles.chipValue}>
            {selected?.icon ?? icon}
            <span className={styles.chipText}>{selected?.label}</span>
          </span>
        </Swap>
        <ChevronDown className={styles.chipChevron} aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.menu} align="start" sideOffset={6} collisionPadding={12} loop>
          <DropdownMenu.Label className={styles.menuLabel}>{label}</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={value} onValueChange={onChange}>
            {options.map((option) => (
              <DropdownMenu.RadioItem className={styles.menuItem} key={option.value} value={option.value}>
                <span className={styles.menuIcon} aria-hidden="true">
                  {option.icon ?? icon}
                </span>
                <span className={styles.menuText}>{option.label}</span>
                <DropdownMenu.ItemIndicator className={styles.menuCheck}>
                  <Check aria-hidden="true" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const KEY_GLYPHS: Record<string, (mac: boolean) => { glyph: string; name: string }> = {
  mod: (mac) => (mac ? { glyph: "⌘", name: "Command" } : { glyph: "Ctrl", name: "Control" }),
  enter: (mac) => (mac ? { glyph: "↵", name: "Return" } : { glyph: "Enter", name: "Enter" }),
};

function readMac(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform || nav.platform || nav.userAgent);
}

/** The composer shortcut, drawn as physical caps. */
function Kbd({ keys, className }: { keys: string; className?: string }) {
  const [mac, setMac] = useState(true);
  useEffect(() => setMac(readMac()), []);
  const parsed = keys.split("+").filter(Boolean).map((key) => KEY_GLYPHS[key.trim().toLowerCase()]?.(mac) ?? { glyph: key, name: key });
  return (
    <kbd className={cx(styles.kbd, styles.kbdSm, className)} aria-hidden="true">
      {parsed.map((key, index) => (
        <span className={styles.slot} key={`${key.name}-${index}`}>
          {index > 0 ? <span className={styles.hidden}> </span> : null}
          <kbd className={styles.key}>
            <span className={styles.glyph} aria-hidden="true">
              {key.glyph}
            </span>
            <span className={styles.hidden}>{key.name}</span>
          </kbd>
        </span>
      ))}
    </kbd>
  );
}

/* --------------------------------------------------------------- composer */

function Composer({
  repositories,
  models,
  onSubmit,
  textareaRef,
}: {
  repositories: RepositoryOption[];
  models: ModelOption[];
  onSubmit: (input: StartInput) => Promise<boolean>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const id = useId();
  const [prompt, setPrompt] = useState("");
  const [repo, setRepo] = useState(repositories[0]?.name ?? "");
  const repository = repositories.find((entry) => entry.name === repo) ?? repositories[0];
  const [branch, setBranch] = useState(repository?.defaultBranch ?? repository?.branches[0] ?? "main");
  const [model, setModel] = useState(models[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const reduced = useReducedMotion() ?? false;
  const canSubmit = prompt.trim().length > 0 && !loading;

  useLayoutEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 168)}px`;
  }, [prompt, textareaRef]);

  const submit = async (event?: { preventDefault: () => void }) => {
    event?.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    const ok = await onSubmit({ prompt: prompt.trim(), repo, branch, model });
    setLoading(false);
    if (ok) setPrompt("");
    else setError("Could not start the task. Check the connection and try again.");
  };

  return (
    <form className={styles.composer} onSubmit={submit} aria-label="New task">
      <div className={styles.field}>
        <label className={styles.srOnly} htmlFor={`${id}-prompt`}>
          Describe a task
        </label>
        <textarea
          ref={textareaRef}
          id={`${id}-prompt`}
          className={styles.textarea}
          rows={2}
          placeholder="Describe a task"
          value={prompt}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            setPrompt(event.target.value);
            if (error) setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <div className={styles.bar}>
          <div className={styles.pickers}>
            <Picker
              label="Repository"
              value={repo}
              onChange={(next) => {
                const target = repositories.find((entry) => entry.name === next);
                setRepo(next);
                setBranch(target?.defaultBranch ?? target?.branches[0] ?? "main");
              }}
              icon={<GitHubMark className={styles.mark} />}
              options={repositories.map((entry) => ({ value: entry.name, label: entry.name }))}
            />
            <Picker
              label="Branch"
              value={branch}
              onChange={setBranch}
              icon={<GitBranch className={styles.lucideMark} aria-hidden="true" />}
              options={(repository?.branches ?? [branch]).map((entry) => ({ value: entry, label: entry }))}
            />
            <Picker
              label="Model"
              value={model}
              onChange={setModel}
              options={models.map((entry) => ({ value: entry.id, label: entry.short, icon: <ModelMark model={entry} /> }))}
            />
          </div>
          <div className={styles.submit}>
            <Kbd keys="mod+enter" className={styles.hint} />
            <Button type="submit" size="sm" className={styles.start} disabled={!prompt.trim()} loading={loading}>
              <span className={styles.startText}>Start</span>
              <ArrowUp className={styles.startIcon} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {error ? (
          <motion.p
            key="error"
            id={`${id}-error`}
            className={styles.composerError}
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={reduced ? { duration: 0 } : SPRING.smooth}
          >
            <CircleAlert aria-hidden="true" />
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </form>
  );
}

/* ------------------------------------------------------------------- card */

function ArchiveButton({ title, onArchive }: { title: string; onArchive: () => void }) {
  return (
    <Tooltip content="Archive">
      <button type="button" className={styles.iconAction} data-focus="archive" onClick={onArchive} aria-label={`Archive ${title}`}>
        <Archive aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

interface CardProps {
  task: Task;
  model?: ModelOption;
  now: number;
  open: boolean;
  fresh: boolean;
  pullRequest?: TaskPullRequest;
  prPhase?: "creating" | "failed";
  reduced: boolean;
  onToggle: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onArchive: () => void;
  onCreatePullRequest: () => void;
}

function TaskCard({
  task,
  model,
  now,
  open,
  fresh,
  pullRequest,
  prPhase,
  reduced,
  onToggle,
  onCancel,
  onRetry,
  onArchive,
  onCreatePullRequest,
}: CardProps) {
  const id = useId();
  const active = isActive(task.status);
  const elapsed = (task.finishedAt ?? Math.max(now, task.startedAt)) - task.startedAt;
  const files = task.files ?? [];
  const steps = task.steps ?? [];
  const creating = prPhase === "creating";

  let status = (
    <span className={styles.status} data-status={task.status}>
      <StatusIcon status={task.status} />
      <span>{STATUS_LABEL[task.status]}</span>
    </span>
  );
  if (task.status === "running" || task.status === "setting-up") {
    status = (
      <span className={styles.status} data-status={task.status}>
        <StatusIcon status={task.status} />
        <span className={styles.srOnly}>{STATUS_LABEL[task.status]}: </span>
        <Live text={task.step ?? STATUS_LABEL[task.status]} live={!reduced} />
      </span>
    );
  }

  let extra: ReactNode = null;
  if (task.status === "queued") {
    extra = <span className={styles.quietFact}>Waiting for a runner</span>;
  } else if (task.status === "failed") {
    extra = <span className={styles.reason}>{task.error ?? "The run stopped with an error"}</span>;
  } else if ((task.status === "ready" || task.status === "merged") && files.length) {
    extra = (
      <>
        <Diff files={files} />
        {task.checks ? <Checks checks={task.checks} /> : null}
      </>
    );
  }

  let mode = "none";
  let actions: ReactNode = null;
  if (active) {
    mode = "cancel";
    actions = (
      <button type="button" className={styles.action} data-focus="cancel" onClick={onCancel} aria-label={`Cancel ${task.title}`}>
        <Square aria-hidden="true" />
        Cancel
      </button>
    );
  } else if (task.status === "failed" || task.status === "cancelled") {
    mode = "retry";
    actions = (
      <>
        <button type="button" className={styles.action} data-focus="retry" onClick={onRetry} aria-label={`Retry ${task.title}`}>
          <RotateCcw aria-hidden="true" />
          Retry
        </button>
        <ArchiveButton title={task.title} onArchive={onArchive} />
      </>
    );
  } else if (task.status === "ready" || task.status === "merged") {
    mode = pullRequest ? `pr-${pullRequest.number}` : "create";
    const chip = (
      <>
        <GitHubMark className={styles.mark} />
        PR #{pullRequest?.number}
        {pullRequest?.state === "merged" ? null : " open"}
      </>
    );
    actions = (
      <>
        {pullRequest ? (
          pullRequest.url ? (
            <a className={styles.prChip} href={pullRequest.url} target="_blank" rel="noreferrer" data-focus="pr">
              {chip}
            </a>
          ) : (
            <span className={styles.prChip}>{chip}</span>
          )
        ) : (
          <button
            type="button"
            className={styles.primary}
            data-focus="create"
            aria-busy={creating || undefined}
            aria-disabled={creating || undefined}
            onClick={() => {
              if (!creating) onCreatePullRequest();
            }}
          >
            <Swap id={creating ? "creating" : prPhase === "failed" ? "again" : "create"}>
              <span className={styles.primaryLabel}>
                {creating ? <LoaderCircle className={styles.spin} aria-hidden="true" /> : <GitPullRequestArrow aria-hidden="true" />}
                {creating ? "Creating pull request" : prPhase === "failed" ? "Try again" : "Create pull request"}
              </span>
            </Swap>
          </button>
        )}
        <ArchiveButton title={task.title} onArchive={onArchive} />
      </>
    );
  }

  return (
    <motion.li
      className={styles.card}
      data-task-id={task.id}
      data-open={open || undefined}
      data-fresh={fresh || undefined}
      data-status={task.status}
      initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={
        reduced
          ? { opacity: 0, transition: { duration: DURATION.instant } }
          : { opacity: 0, height: 0, transition: { ...SPRING.smooth, opacity: { duration: DURATION.fast, ease: EASE_ENTER } } }
      }
      transition={reduced ? { duration: DURATION.fast } : { ...SPRING.smooth, opacity: { duration: DURATION.standard, ease: EASE_ENTER } }}
    >
      <div className={styles.summary}>
        <button type="button" className={styles.toggle} data-focus="toggle" aria-expanded={open} aria-controls={id} onClick={onToggle}>
          <span className={styles.titleRow}>
            <span className={styles.title}>{task.title}</span>
            <span className={styles.time} aria-hidden="true" suppressHydrationWarning>
              {clock(elapsed)}
            </span>
            <span className={styles.srOnly} suppressHydrationWarning>
              {active ? `, running for ${spoken(elapsed)}` : `, took ${spoken(elapsed)}`}
            </span>
            <ChevronDown className={styles.chevron} data-open={open || undefined} aria-hidden="true" />
          </span>
          <span className={styles.meta}>
            <span className={styles.metaItem}>
              <GitHubMark className={styles.mark} />
              <span className={styles.metaText}>{task.repo}</span>
            </span>
            <span className={cx(styles.metaItem, styles.metaBranch)}>
              <GitBranch className={styles.lucideMark} aria-hidden="true" />
              <span className={styles.metaText}>{task.branch}</span>
            </span>
            <span className={styles.metaItem}>
              <ModelMark model={model} />
              <span className={styles.metaText}>{model?.short ?? task.model}</span>
            </span>
          </span>
        </button>
        <div className={styles.stateRow} data-actions={mode === "cancel" ? "compact" : "wide"}>
          <Fade id={task.status} className={styles.stateFade}>
            <span className={styles.stateLine}>
              {status}
              {extra}
            </span>
          </Fade>
          {actions ? (
            <Swap id={mode} align="end" className={styles.actionsSwap}>
              <span className={styles.actions}>{actions}</span>
            </Swap>
          ) : null}
        </div>
      </div>
      <motion.div
        id={id}
        className={styles.clip}
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={reduced ? { duration: 0 } : SPRING.smooth}
        inert={!open || undefined}
      >
        <div className={styles.details} data-files={files.length > 0 || undefined}>
          <section className={styles.section} aria-labelledby={`${id}-steps`}>
            <span id={`${id}-steps`} className={styles.sectionTitle}>
              Steps
            </span>
            <Steps steps={steps} />
          </section>
          {files.length ? (
            <section className={styles.section} aria-labelledby={`${id}-files`}>
              <span id={`${id}-files`} className={styles.sectionTitle}>
                Changed files
                <span className={styles.sectionCount}>{files.length}</span>
              </span>
              <Files files={files} />
            </section>
          ) : null}
        </div>
      </motion.div>
    </motion.li>
  );
}

/* ------------------------------------------------------------------- main */

export function AgentTasks({
  tasks: controlledTasks,
  repositories = REPOSITORIES,
  models = MODELS,
  onStart,
  onCreatePullRequest,
  onCancel,
  onRetry,
  onArchive,
  defaultFilter = "all",
  className,
}: AgentTasksProps) {
  const controlled = controlledTasks !== undefined;
  const reduced = useReducedMotion() ?? false;
  const [initial] = useState(seed);
  const [tasks, setTasks] = useState<Task[]>(initial.tasks);
  const [now, setNow] = useState(initial.base);
  const [filter, setFilter] = useState<FilterValue>(defaultFilter);
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [archived, setArchived] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<{ id: string; title: string } | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [prOverrides, setPrOverrides] = useState<Record<string, TaskPullRequest>>({});
  const [prPhase, setPrPhase] = useState<Record<string, "creating" | "failed">>({});
  const [announcement, setAnnouncement] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timers = useRef(new Map<string, number>());
  const focusIntent = useRef<{ id: string; target: string } | null>(null);
  const prCounter = useRef(482);
  const toastTimer = useRef(0);

  const source = controlled ? controlledTasks : tasks;
  const available = useMemo(() => source.filter((task) => !archived.has(task.id)), [source, archived]);
  const filtered = available.filter((task) => {
    if (filter === "all") return true;
    if (filter === "running") return isActive(task.status);
    if (filter === "review") return task.status === "ready";
    return task.status === "merged";
  });
  const counts = {
    all: available.length,
    running: available.filter((task) => isActive(task.status)).length,
    review: available.filter((task) => task.status === "ready").length,
    merged: available.filter((task) => task.status === "merged").length,
  };
  const anyActive = available.some((task) => isActive(task.status));

  useEffect(() => {
    if (!anyActive) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [anyActive]);

  const announce = useCallback((message: string) => setAnnouncement(message), []);

  const stop = useCallback((id: string) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const start = useCallback(
    (id: string, ticks: Tick[]) => {
      stop(id);
      let index = 0;
      const step = () => {
        const tick = ticks[index];
        index += 1;
        if (!tick) {
          timers.current.delete(id);
          return;
        }
        timers.current.set(
          id,
          window.setTimeout(() => {
            const at = Date.now();
            setTasks((current) => current.map((task) => (task.id === id ? tick.apply(task, at) : task)));
            if (tick.announce) announce(tick.announce);
            step();
          }, tick.delay),
        );
      };
      step();
    },
    [announce, stop],
  );

  useEffect(() => {
    if (controlled) return;
    const pending = timers.current;
    initial.tasks.forEach((task) => {
      if (!isActive(task.status)) return;
      const activeText = task.steps?.find((entry) => entry.state === "active")?.text;
      const index = activeText ? phasesFor(task).findIndex((phase) => phase.live === activeText) : -1;
      if (index >= 0) start(task.id, runFor(task, index));
    });
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer));
      pending.clear();
    };
  }, [controlled, initial, start]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  useEffect(() => {
    if (!fresh) return;
    const timer = window.setTimeout(() => setFresh(null), 2000);
    return () => window.clearTimeout(timer);
  }, [fresh]);

  useEffect(() => {
    const intent = focusIntent.current;
    if (!intent) return;
    focusIntent.current = null;
    if (intent.id === "composer") {
      textareaRef.current?.focus();
      return;
    }
    const card = rootRef.current?.querySelector(`[data-task-id="${CSS.escape(intent.id)}"]`);
    const target = card?.querySelector(`[data-focus="${intent.target}"]`) ?? card?.querySelector('[data-focus="toggle"]');
    (target as HTMLElement | null)?.focus({ preventScroll: true });
  });

  const focusNeighbour = (task: Task) => {
    const index = filtered.findIndex((entry) => entry.id === task.id);
    const next = filtered[index + 1] ?? filtered[index - 1];
    focusIntent.current = next ? { id: next.id, target: "toggle" } : { id: "composer", target: "" };
  };

  const submit = async (input: StartInput): Promise<boolean> => {
    if (controlled) {
      try {
        await onStart?.(input);
      } catch {
        return false;
      }
      announce(`Started ${titleFor(input.prompt)} on ${input.repo}.`);
      return true;
    }
    try {
      await onStart?.(input);
    } catch {
      return false;
    }
    const title = titleFor(input.prompt);
    const task: Task = {
      id: `task-${Date.now().toString(36)}`,
      title,
      repo: input.repo,
      branch: branchFor(title),
      baseBranch: input.branch,
      model: input.model,
      status: "queued",
      startedAt: Date.now(),
      steps: [],
    };
    setTasks((current) => [task, ...current]);
    setNow(Date.now());
    if (filter === "review" || filter === "merged") setFilter("all");
    setFresh(task.id);
    announce(`Started ${task.title} on ${task.repo}. The agent run is simulated in this preview.`);
    start(task.id, runFor(task, -1));
    return true;
  };

  const cancel = (task: Task) => {
    if (filter === "running") focusNeighbour(task);
    else focusIntent.current = { id: task.id, target: "retry" };
    onCancel?.(task);
    if (controlled) return;
    stop(task.id);
    const at = Date.now();
    setTasks((current) =>
      current.map((entry) =>
        entry.id === task.id
          ? {
              ...entry,
              status: "cancelled",
              step: undefined,
              finishedAt: at,
              steps: (entry.steps ?? []).map((step) => (step.state === "active" ? { ...step, state: "stopped" as const } : step)),
            }
          : entry,
      ),
    );
    announce(`Cancelled ${task.title}.`);
  };

  const retry = (task: Task) => {
    focusIntent.current = { id: task.id, target: "cancel" };
    onRetry?.(task);
    if (controlled) return;
    const next: Task = {
      ...task,
      status: "queued",
      startedAt: Date.now(),
      finishedAt: undefined,
      step: undefined,
      steps: [],
      files: undefined,
      checks: undefined,
      error: undefined,
      pullRequest: undefined,
    };
    setTasks((current) => current.map((entry) => (entry.id === task.id ? next : entry)));
    setNow(Date.now());
    announce(`Retrying ${task.title}. The agent run is simulated in this preview.`);
    start(task.id, runFor(next, -1));
  };

  const archive = (task: Task) => {
    focusNeighbour(task);
    onArchive?.(task);
    setArchived((current) => new Set(current).add(task.id));
    setToast({ id: task.id, title: task.title });
    announce(`Archived ${task.title}.`);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 6000);
  };

  const createPullRequest = async (task: Task) => {
    setPrPhase((current) => ({ ...current, [task.id]: "creating" }));
    try {
      const result = onCreatePullRequest
        ? await onCreatePullRequest(task)
        : await new Promise<TaskPullRequest>((resolve) =>
            window.setTimeout(() => resolve({ number: prCounter.current++, state: "open" }), 1100),
          );
      if (rootRef.current?.querySelector(`[data-task-id="${CSS.escape(task.id)}"] [data-focus="create"]`) === document.activeElement) {
        focusIntent.current = { id: task.id, target: "toggle" };
      }
      setPrOverrides((current) => ({ ...current, [task.id]: { ...result, state: result.state ?? "open" } }));
      setPrPhase((current) => {
        const next = { ...current };
        delete next[task.id];
        return next;
      });
      announce(
        onCreatePullRequest
          ? `Opened pull request #${result.number} for ${task.title}.`
          : `Opened pull request #${result.number} for ${task.title}. Simulated in this preview.`,
      );
    } catch {
      setPrPhase((current) => ({ ...current, [task.id]: "failed" }));
      announce(`Could not open a pull request for ${task.title}. Try again.`);
    }
  };

  const options: Segment[] = [
    { value: "all", label: "All", accessory: <Count value={counts.all} /> },
    { value: "running", label: "Running", accessory: <Count value={counts.running} /> },
    { value: "review", label: "Ready for review", accessory: <Count value={counts.review} /> },
    { value: "merged", label: "Merged", accessory: <Count value={counts.merged} /> },
  ];
  const empty = EMPTY_COPY[filter];

  return (
    <div ref={rootRef} className={cx(styles.root, className)}>
      <div className={styles.panel}>
        <Composer repositories={repositories} models={models} onSubmit={submit} textareaRef={textareaRef} />
        <div className={styles.toolbar}>
          <SegmentedControl
            label="Filter tasks"
            options={options}
            value={filter}
            onValueChange={(value) => setFilter(value as FilterValue)}
            className={styles.filters}
          />
        </div>
        <ul className={styles.list} aria-label="Tasks">
          <AnimatePresence initial={false}>
            {filtered.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                model={models.find((entry) => entry.id === task.model) ?? MODELS.find((entry) => entry.id === task.model)}
                now={now}
                reduced={reduced}
                open={openIds.has(task.id)}
                fresh={fresh === task.id}
                pullRequest={task.pullRequest ?? prOverrides[task.id]}
                prPhase={prPhase[task.id]}
                onToggle={() => {
                  setOpenIds((current) => {
                    const next = new Set(current);
                    if (next.has(task.id)) next.delete(task.id);
                    else next.add(task.id);
                    return next;
                  });
                }}
                onCancel={() => cancel(task)}
                onRetry={() => retry(task)}
                onArchive={() => archive(task)}
                onCreatePullRequest={() => void createPullRequest(task)}
              />
            ))}
            {filtered.length === 0 ? (
              <motion.li
                key={`empty-${filter}`}
                className={styles.empty}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: DURATION.fast, delay: reduced ? 0 : 0.12 } }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
              >
                <span className={styles.emptyTitle}>{empty.title}</span>
                <span className={styles.emptyBody}>{empty.body}</span>
              </motion.li>
            ) : null}
          </AnimatePresence>
        </ul>
        <AnimatePresence initial={false}>
          {toast ? (
            <motion.div
              key="undo"
              className={styles.clip}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={reduced ? { duration: 0 } : { ...SPRING.smooth, opacity: { duration: DURATION.fast } }}
            >
              <div className={styles.undo}>
                <span className={styles.undoText}>
                  Archived <span className={styles.undoTitle}>{toast.title}</span>
                </span>
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => {
                    if (!toast) return;
                    setArchived((current) => {
                      const next = new Set(current);
                      next.delete(toast.id);
                      return next;
                    });
                    focusIntent.current = { id: toast.id, target: "toggle" };
                    announce(`Restored ${toast.title}.`);
                    setToast(null);
                    window.clearTimeout(toastTimer.current);
                  }}
                >
                  <Undo2 aria-hidden="true" />
                  Undo
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <p className={styles.srOnly} role="status" aria-live="polite">
          {announcement}
        </p>
      </div>
    </div>
  );
}

export default AgentTasks;
