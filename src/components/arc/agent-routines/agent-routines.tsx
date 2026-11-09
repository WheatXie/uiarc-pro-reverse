"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
  type SVGProps,
} from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import {
  ArrowRight,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleX,
  CircleSlash,
  Play,
  Plus,
  Square,
} from "lucide-react";
import { Button } from "../button/button";
import { Input } from "../input/input";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "../popover/popover";
import SegmentedControl from "../segmented-control/segmented-control";
import { Select } from "../select/select";
import { Switch } from "../switch/switch";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { Tooltip } from "../tooltip/tooltip";
import styles from "./agent-routines.module.css";

/* ------------------------------------------------------------------ types */

/** How often a routine runs. */
export type RoutineFrequency = "hourly" | "daily" | "weekdays" | "weekly";

/** A service a routine can read from. Slack is a destination, not a source. */
export type RoutineSource = "linear" | "github" | "sentry" | "google-calendar" | "notion";

/** A model the agent can run on. */
export type RoutineModel = "claude-opus-5-5" | "claude-sonnet-5-5" | "claude-haiku-5-5" | "gpt-6-luna" | "gemini-3-8-flash";

/** How one run ended. Status is always spelled out, never colour-only. */
export type RoutineRunStatus = "success" | "failed" | "skipped";

/** When a routine runs. `day` is 0 = Sunday, and only `weekly` reads it. */
export interface RoutineSchedule {
  frequency: RoutineFrequency;
  /** `HH:MM`. For an hourly routine only the minutes are used. */
  time: string;
  day?: number;
}

/** One past run. `history` is ordered oldest first. */
export interface RoutineRun {
  id: string;
  status: RoutineRunStatus;
  at: number | Date | string;
  durationMs?: number;
  summary: string;
}

/** A scheduled agent: what it reads, when it runs, and where it posts. */
export interface Routine {
  id: string;
  name: string;
  /** The instruction sent to the model, written as a sentence. */
  instruction: string;
  schedule: RoutineSchedule;
  sources: RoutineSource[];
  /** A channel such as `#triage`, or `Direct message`. */
  destination: string;
  model: RoutineModel;
  enabled: boolean;
  /** Oldest first. The row shows the last 14. */
  history: RoutineRun[];
  /** Latest report, streamed into the open row. */
  report?: string;
  /** Step labels shown while a run is in progress. */
  steps?: string[];
  /** Accent slot, 1–4. Derived from the id when omitted. */
  accent?: number;
}

/** What `onRun` can resolve with. Without it the preview simulates a run. */
export interface RoutineRunResult {
  run: RoutineRun;
  report?: string;
}

export interface AgentRoutinesProps {
  /** Routines to show. Defaults to the four sample routines. */
  routines?: Routine[];
  /** Run a routine now. Resolve with a result, or leave it to the preview to simulate one. */
  onRun?: (routine: Routine) => Promise<RoutineRunResult> | RoutineRunResult | void;
  /** Turn a routine's schedule on or off. */
  onToggle?: (id: string, enabled: boolean) => void;
  /** Called when a routine is edited or added. `created` is true for a new routine. */
  onSave?: (routine: Routine, change: { created: boolean }) => void;
  /** Clock used for "Next run in" and "Last run". Defaults to a demo clock ticking from Tuesday 20 October 2026, 06:45. */
  now?: number | Date;
  /** Id of the routine that starts expanded. */
  defaultOpenId?: string | null;
  /** Card heading. */
  title?: string;
  className?: string;
}

type LiveStatus = "idle" | "running" | "failed";

interface LiveRun {
  status: LiveStatus;
  step: number;
  steps: string[];
  attempts: number;
  streamKey: number;
  error?: string;
}

type MarkProps = SVGProps<SVGSVGElement> & { title?: string };

/* -------------------------------------------------------------- registries */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const MARK_LABEL: Record<RoutineSource | "slack", string> = {
  linear: "Linear",
  slack: "Slack",
  github: "GitHub",
  sentry: "Sentry",
  "google-calendar": "Google Calendar",
  notion: "Notion",
};

type ModelProvider = "anthropic" | "openai" | "google";

const MODELS: Record<RoutineModel, { name: string; short: string; provider: ModelProvider }> = {
  "claude-opus-5-5": { name: "Claude Opus 5.5", short: "Opus 5.5", provider: "anthropic" },
  "claude-sonnet-5-5": { name: "Claude Sonnet 5.5", short: "Sonnet 5.5", provider: "anthropic" },
  "claude-haiku-5-5": { name: "Claude Haiku 5.5", short: "Haiku 5.5", provider: "anthropic" },
  "gpt-6-luna": { name: "GPT-6 Luna", short: "GPT-6 Luna", provider: "openai" },
  "gemini-3-8-flash": { name: "Gemini 3.8 Flash", short: "Gemini 3.8 Flash", provider: "google" },
};

const DESTINATIONS = ["#triage", "#eng", "#incidents", "#product", "#releases", "Direct message"];
const SOURCE_ORDER: RoutineSource[] = ["linear", "github", "sentry", "google-calendar", "notion"];
const WEEKDAY_OPTIONS = WEEKDAYS.map((label, index) => ({ value: String(index), label }));
const STATUS_LABEL: Record<RoutineRunStatus, string> = { success: "Succeeded", failed: "Failed", skipped: "Skipped" };
const STATUS_ICON = { success: CheckCircle2, failed: CircleX, skipped: CircleSlash };

const IDLE_RUN: LiveRun = { status: "idle", step: 0, steps: [], attempts: 0, streamKey: 0 };

/* ----------------------------------------------------------------- helpers */

function parseTime(time: string) {
  const [rawHours = 9, rawMinutes = 0] = time.split(":").map(Number);
  return {
    hours: Math.min(23, Math.max(0, Number.isFinite(rawHours) ? rawHours : 9)),
    minutes: Math.min(59, Math.max(0, Number.isFinite(rawMinutes) ? rawMinutes : 0)),
  };
}

const pad2 = (value: number) => String(value).padStart(2, "0");
/** `9:00`, the way a person writes a time. */
const clockLabel = (hours: number, minutes: number) => `${hours}:${pad2(minutes)}`;
/** `09:00`, the way an input wants it. */
const timeValue = (hours: number, minutes: number) => `${pad2(hours)}:${pad2(minutes)}`;

/** The schedule as a sentence, exactly as the row's second line shows it. */
function describeSchedule(schedule: RoutineSchedule) {
  const { hours, minutes } = parseTime(schedule.time);
  const time = clockLabel(hours, minutes);
  if (schedule.frequency === "hourly") return `Every hour at :${pad2(minutes)}`;
  if (schedule.frequency === "daily") return `Daily at ${time}`;
  if (schedule.frequency === "weekly") return `${WEEKDAYS[schedule.day ?? 1]}s at ${time}`;
  return `Weekdays at ${time}`;
}

function runsOnDay(schedule: RoutineSchedule, date: Date) {
  if (schedule.frequency === "weekdays") return date.getDay() >= 1 && date.getDay() <= 5;
  if (schedule.frequency === "weekly") return date.getDay() === (schedule.day ?? 1);
  return true;
}

/** First run strictly after `from`. */
function nextRun(schedule: RoutineSchedule, from: number) {
  const { hours, minutes } = parseTime(schedule.time);
  const anchor = new Date(from);
  if (schedule.frequency === "hourly") {
    const next = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), anchor.getHours(), minutes, 0, 0);
    if (next.getTime() <= from) next.setHours(next.getHours() + 1);
    return next.getTime();
  }
  for (let index = 0; index < 9; index += 1) {
    const day = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + index, hours, minutes, 0, 0);
    if (day.getTime() > from && runsOnDay(schedule, day)) return day.getTime();
  }
  return from + 86400000;
}

/** Last run at or before `from`. */
function previousRun(schedule: RoutineSchedule, from: number) {
  const { hours, minutes } = parseTime(schedule.time);
  const anchor = new Date(from);
  if (schedule.frequency === "hourly") {
    const slot = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), anchor.getHours(), minutes, 0, 0);
    if (slot.getTime() > from) slot.setHours(slot.getHours() - 1);
    return slot.getTime();
  }
  for (let index = 0; index < 9; index += 1) {
    const day = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - index, hours, minutes, 0, 0);
    if (day.getTime() <= from && runsOnDay(schedule, day)) return day.getTime();
  }
  return from - 86400000;
}

/** `Today 9:00`, `Yesterday 9:00`, or `Wed 30 Sep, 9:00`. */
function runTimeLabel(at: RoutineRun["at"], now: number) {
  const date = new Date(at instanceof Date ? at.getTime() : typeof at === "number" ? at : new Date(at).getTime());
  const clock = new Date(now);
  const midnight = new Date(clock.getFullYear(), clock.getMonth(), clock.getDate()).getTime();
  const time = clockLabel(date.getHours(), date.getMinutes());
  if (date.getTime() >= midnight) return `Today ${time}`;
  if (date.getTime() >= midnight - 86400000) return `Yesterday ${time}`;
  return `${WEEKDAYS_SHORT[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}, ${time}`;
}

/** `38 s`, `2 min 05 s`. */
function durationLabel(ms?: number) {
  if (ms == null) return "";
  const seconds = Math.max(1, Math.round(ms / 1000));
  return seconds >= 60 ? `${Math.floor(seconds / 60)} min ${pad2(seconds % 60)} s` : `${seconds} s`;
}

/* --------------------------------------------------------- sentence parsing */

const SOURCE_PATTERNS: [RoutineSource, RegExp][] = [
  ["github", /\b(github|pull requests?|prs?|commits?|repos?|releases?|merged)\b/i],
  ["linear", /\b(linear|issues?|tickets?|backlog|bugs?|sprint|cycle)\b/i],
  ["sentry", /\b(sentry|errors?|crash(?:es)?|exceptions?|incidents?|spikes?)\b/i],
  ["google-calendar", /\b(calendar|meetings?|events?|agenda|schedule for the day)\b/i],
  ["notion", /\b(notion|docs?|wiki|notes|specs?)\b/i],
];
const WEEKDAY_PATTERN = /\b(?:every|each|on)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\b/i;

interface ParsedSentence {
  name: string;
  schedule: RoutineSchedule;
  sources: RoutineSource[];
  destination: string;
  found: { name: string | null; schedule: string | null; sources: string | null; destination: string | null };
}

/** Reads "Every Friday at 16:00, summarize merged PRs to #eng" into a draft routine. */
function parseSentence(sentence: string): ParsedSentence {
  const text = sentence.trim();

  const time = (() => {
    const match = text.match(/\b(?:at\s+)?(\d{1,2})[:.](\d{2})\s*(am|pm)?\b/i);
    if (match) {
      let hours = Number(match[1]);
      const meridiem = match[3]?.toLowerCase();
      if (meridiem === "pm" && hours < 12) hours += 12;
      if (meridiem === "am" && hours === 12) hours = 0;
      if (hours <= 23) return { hours, minutes: Math.min(59, Number(match[2])), words: match[0].trim() };
    }
    const bare = text.match(/\b(?:at\s+)?(\d{1,2})\s*(am|pm)\b/i);
    if (bare) {
      let hours = Number(bare[1]) % 12;
      if (bare[2].toLowerCase() === "pm") hours += 12;
      return { hours, minutes: 0, words: bare[0].trim() };
    }
    const word = text.match(/\b(noon|midnight|morning|evening|end of (?:the )?day)\b/i);
    if (word) {
      const value = word[1].toLowerCase();
      return {
        hours: value === "noon" ? 12 : value === "midnight" ? 0 : value === "morning" ? 9 : value === "evening" ? 18 : 17,
        minutes: 0,
        words: word[0],
      };
    }
    return null;
  })();

  const weekday = text.match(WEEKDAY_PATTERN);
  let schedule: RoutineSchedule = { frequency: "weekdays", time: "09:00" };
  let scheduleFound: string | null = null;

  if (/\b(hourly|every hour|each hour)\b/i.test(text)) {
    const minute = text.match(/\b(?:at\s+)?:(\d{2})\b|\b(\d{1,2}) (?:minutes )?past\b/i);
    schedule = { frequency: "hourly", time: timeValue(0, minute ? Math.min(59, Number(minute[1] ?? minute[2])) : 0) };
    scheduleFound = text.match(/\b(hourly|every hour|each hour)\b/i)?.[0] ?? null;
  } else if (/\b(weekdays?|every workday|workdays|monday to friday|mon-fri)\b/i.test(text)) {
    schedule = { frequency: "weekdays", time: time ? timeValue(time.hours, time.minutes) : "09:00" };
    scheduleFound = text.match(/\b(every weekday|weekdays?|every workday|workdays|monday to friday|mon-fri)\b/i)?.[0] ?? null;
  } else if (weekday) {
    schedule = {
      frequency: "weekly",
      day: WEEKDAYS.findIndex(day => day.toLowerCase() === weekday[1].toLowerCase()),
      time: time ? timeValue(time.hours, time.minutes) : "09:00",
    };
    scheduleFound = weekday[0].trim();
  } else if (/\b(daily|every day|each day|every morning|every evening|nightly|each morning)\b/i.test(text)) {
    schedule = { frequency: "daily", time: time ? timeValue(time.hours, time.minutes) : "09:00" };
    scheduleFound = text.match(/\b(daily|every day|each day|every morning|every evening|nightly|each morning)\b/i)?.[0] ?? null;
  } else if (/\b(every week|weekly)\b/i.test(text)) {
    schedule = { frequency: "weekly", day: 1, time: time ? timeValue(time.hours, time.minutes) : "09:00" };
    scheduleFound = text.match(/\b(every week|weekly)\b/i)?.[0] ?? null;
  } else if (time) {
    schedule = { frequency: "daily", time: timeValue(time.hours, time.minutes) };
  }
  if (time && schedule.frequency !== "hourly") scheduleFound = [scheduleFound, time.words].filter(Boolean).join(" ");

  const sources: RoutineSource[] = [];
  const sourceWords: string[] = [];
  for (const [id, pattern] of SOURCE_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;
    sources.push(id);
    sourceWords.push(match[0]);
  }

  const channel = text.match(/#[\w-]+/);
  const direct = text.match(/\b(dm me|direct message|message me|send me|to me)\b/i);
  const destination = channel ? channel[0].toLowerCase() : direct ? "Direct message" : "#eng";

  const name = text
    ? (() => {
        const words = text
          .replace(/^[^,]*\b(every|each|daily|hourly|weekdays?|on \w+days?)\b[^,]*,\s*/i, "")
          .replace(/\b(every|each)\s+(hour|day|morning|evening|weekday|workday|week|sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\b/gi, "")
          .replace(/\b(hourly|daily|nightly|on weekdays)\b/gi, "")
          .replace(/\bat\s+(\d{1,2}([:.]\d{2})?\s*(am|pm)?|noon|midnight)\b/gi, "")
          .replace(/\b(to|in|into|on)\s+(#[\w-]+|slack|a dm|my dms?)\b.*$/i, "")
          .replace(/\s*(and )?(post|send|share|drop)\s*(it|them|that)?\s*$/i, "")
          .replace(/[,.]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .split(" ")
          .filter(Boolean)
          .slice(0, 5);
        if (!words.length) return null;
        const label = words.join(" ");
        return label.charAt(0).toUpperCase() + label.slice(1);
      })()
    : null;

  return {
    name: name ?? "New routine",
    schedule,
    sources,
    destination,
    found: { name, schedule: scheduleFound, sources: sourceWords.length ? sourceWords.join(", ") : null, destination: channel?.[0] ?? direct?.[0] ?? null },
  };
}

/* ----------------------------------------------------------------- fixtures */

/** The demo clock: Tuesday 20 October 2026, 06:45:30. */
const demoNow = () => new Date(2026, 9, 20, 6, 45, 30).getTime();

const runOk = (summary: string, seconds: number) => ({ status: "success" as const, summary, durationMs: seconds * 1000 });
const runSkipped = (summary: string) => ({ status: "skipped" as const, summary, durationMs: 4000 });
const runFailed = (summary: string, seconds: number) => ({ status: "failed" as const, summary, durationMs: seconds * 1000 });

type RunSpec = ReturnType<typeof runOk> | ReturnType<typeof runSkipped> | ReturnType<typeof runFailed>;

/** Walks the schedule backwards from `now`, one run per slot, oldest first. */
function buildHistory(prefix: string, schedule: RoutineSchedule, specs: RunSpec[], now: number): RoutineRun[] {
  const runs: RoutineRun[] = [];
  let cursor = previousRun(schedule, now);
  for (let index = specs.length - 1; index >= 0; index -= 1) {
    const spec = specs[index];
    runs.unshift({ id: `${prefix}-${cursor}`, status: spec.status, at: cursor, durationMs: spec.durationMs, summary: spec.summary });
    cursor = previousRun(schedule, cursor - 60000);
  }
  return runs;
}

function sampleRoutines(now = demoNow()): Routine[] {
  const weekdays9 = { frequency: "weekdays" as const, time: "09:00" };
  const friday4 = { frequency: "weekly" as const, day: 5, time: "16:00" };
  const hourly = { frequency: "hourly" as const, time: "00:00" };
  const weekdays830 = { frequency: "weekdays" as const, time: "08:30" };
  return [
    {
      id: "morning-triage",
      accent: 1,
      name: "Morning triage",
      instruction:
        "Read every Linear issue opened since the last run and match it to new Sentry errors. Rank them by customer impact, mark anything that blocks checkout as urgent, and post a short list with owners to #triage.",
      schedule: weekdays9,
      sources: ["linear", "sentry"],
      destination: "#triage",
      model: "claude-sonnet-5-5",
      enabled: true,
      steps: ["Reading new Linear issues", "Matching Sentry errors", "Ranking by customer impact", "Posting to #triage"],
      history: buildHistory(
        "triage",
        weekdays9,
        [
          runOk("Triaged 7 issues, 1 urgent", 38),
          runOk("Triaged 11 issues, 2 urgent", 44),
          runOk("Triaged 5 issues, none urgent", 31),
          runOk("Triaged 8 issues, 1 urgent", 40),
          runSkipped("No new issues since the last run"),
          runOk("Triaged 14 issues, 3 urgent", 52),
          runOk("Triaged 6 issues, none urgent", 35),
          runOk("Triaged 9 issues, 1 urgent", 41),
          runFailed("Linear API returned 429, nothing posted", 12),
          runOk("Triaged 12 issues, 2 urgent", 47),
          runOk("Triaged 4 issues, none urgent", 29),
          runOk("Triaged 10 issues, 1 urgent", 43),
          runOk("Triaged 7 issues, none urgent", 36),
          runOk("Triaged 9 issues, 2 urgent", 41),
        ],
        now,
      ),
      report:
        "Triage for Monday 19 October\n- ENG-2141 Checkout button stays disabled after a coupon is removed. Urgent, 38 users hit it in Sentry, assigned to Priya Nair.\n- ENG-2138 Invoice PDF renders blank for EU locales. 12 users, assigned to Tomás Ortega.\n- ENG-2135 Search is slow on workspaces with more than 5,000 docs. No errors, moved to the backlog.\n9 issues reviewed, 2 urgent, 4 routed to owners, 3 left for Thursday's review.",
    },
    {
      id: "pr-digest",
      accent: 2,
      name: "Merged PR digest",
      instruction:
        "Every Friday, list the pull requests merged into arc-web and arc-api this week. Group them by area, call out anything that touched billing, and note reviews that waited more than two days. Post the digest to #eng.",
      schedule: friday4,
      sources: ["github"],
      destination: "#eng",
      model: "claude-haiku-5-5",
      enabled: true,
      steps: ["Listing merged pull requests", "Grouping by area", "Writing the digest", "Posting to #eng"],
      history: buildHistory(
        "digest",
        friday4,
        [
          runOk("19 pull requests from 8 people", 22),
          runOk("26 pull requests from 10 people", 27),
          runOk("14 pull requests from 6 people", 19),
          runOk("21 pull requests from 9 people", 24),
          runSkipped("No pull requests merged, company offsite"),
          runOk("17 pull requests from 7 people", 21),
          runOk("24 pull requests from 9 people", 25),
          runOk("30 pull requests from 11 people", 31),
          runOk("18 pull requests from 8 people", 22),
          runOk("22 pull requests from 9 people", 24),
          runOk("15 pull requests from 7 people", 20),
          runOk("27 pull requests from 10 people", 28),
          runOk("20 pull requests from 8 people", 23),
          runOk("23 pull requests from 9 people", 26),
        ],
        now,
      ),
      report:
        "Merged this week in arc-web and arc-api\n- 23 pull requests from 9 people, median time to first review 3 h 40 min.\n- Billing: #1842 prorated seat changes and #1851 invoice retries with backoff. Both touch the billing service.\n- Editor: #1838 paste tables from spreadsheets and #1845 a faster undo history.\n- Infra: #1849 preview deploys moved to the new region.\nTwo pull requests waited more than two days for review: #1833 and #1836.",
    },
    {
      id: "incident-watch",
      accent: 3,
      name: "Incident watch",
      instruction:
        "Check Sentry for error spikes above 50 events in 15 minutes. If you find one, link the most recent production deploy from GitHub, suggest a next step, and post it to #incidents. Stay quiet when nothing crosses the threshold.",
      schedule: hourly,
      sources: ["sentry", "github"],
      destination: "#incidents",
      model: "gpt-6-luna",
      enabled: true,
      steps: ["Checking Sentry for new spikes", "Linking recent deploys from GitHub", "Deciding whether to alert", "Posting to #incidents"],
      history: buildHistory(
        "watch",
        hourly,
        [
          runSkipped("Nothing above the threshold"),
          runSkipped("Nothing above the threshold"),
          runOk("Posted 1 spike in billing-worker", 18),
          runSkipped("Nothing above the threshold"),
          runSkipped("Nothing above the threshold"),
          runSkipped("Nothing above the threshold"),
          runFailed("Sentry API timed out after 30 s", 31),
          runSkipped("Nothing above the threshold"),
          runSkipped("Nothing above the threshold"),
          runSkipped("Nothing above the threshold"),
          runSkipped("Nothing above the threshold"),
          runSkipped("Nothing above the threshold"),
          runSkipped("Nothing above the threshold"),
          runOk("Posted 1 spike in api-gateway", 21),
        ],
        now,
      ),
      report:
        "Error spike in api-gateway at 6:00\n- TypeError in billing/usage.ts: cannot read plan of undefined. 214 events in 15 minutes, 61 users.\n- Started 4 minutes after #1849 reached production.\nSuggested next step: roll back #1849 or check the new region's config. Posted to #incidents, nobody paged.",
    },
    {
      id: "meeting-prep",
      accent: 4,
      name: "Meeting prep",
      instruction:
        "Before my first meeting, read today's Google Calendar. For each meeting, pull the related Linear issues and Notion docs and write a two line brief. Send it to me as a direct message.",
      schedule: weekdays830,
      sources: ["google-calendar", "linear", "notion"],
      destination: "Direct message",
      model: "gemini-3-8-flash",
      enabled: false,
      steps: ["Reading today's calendar", "Pulling related issues and docs", "Writing the briefs", "Sending a direct message"],
      history: buildHistory(
        "prep",
        weekdays830,
        [
          runOk("Briefed 4 meetings", 26),
          runOk("Briefed 3 meetings", 22),
          runOk("Briefed 5 meetings", 29),
          runOk("Briefed 2 meetings", 17),
          runSkipped("No meetings on the calendar"),
          runOk("Briefed 4 meetings", 25),
          runOk("Briefed 6 meetings", 33),
          runOk("Briefed 3 meetings", 21),
          runOk("Briefed 4 meetings", 24),
          runOk("Briefed 5 meetings", 28),
          runOk("Briefed 3 meetings", 20),
          runOk("Briefed 4 meetings", 26),
          runOk("Briefed 2 meetings", 16),
          runOk("Briefed 4 meetings", 25),
        ],
        new Date(2026, 9, 15, 23, 0).getTime(),
      ),
      report:
        "Your Thursday, 15 October\n- 10:00 Pricing review with Ana and Jonas. Open question in ENG-2102 on seat limits for trials. Notion: Pricing v4 draft.\n- 13:30 Design critique for editor tables. Three comments are still unresolved.\n- 16:00 One to one with Priya. She closed 7 issues this week; ask how the on-call rotation is going.",
    },
  ];
}

/* ------------------------------------------------------------------- motion */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const WIDTH_SPRING: Transition = { type: "spring", visualDuration: 0.32, bounce: 0 };
const COLLAPSE_SPRING: Transition = { type: "spring", visualDuration: 0.34, bounce: 0 };
const TICK_SLIDE: Transition = { duration: 0.24, ease: EASE };

/** A one-line label that crossfades in place instead of snapping. */
function SwapText({ swapKey, reduced, className, children }: { swapKey: string; reduced: boolean; className?: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={swapKey}
        className={className}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: 0.1 * Number(!reduced), ease: EASE } }}
        transition={{ duration: reduced ? 0.12 : 0.16, ease: EASE }}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
}

/** Slides to the width of whatever it currently holds, so neighbouring text never jumps. */
function AutoWidth({ reduced, className, children }: { reduced: boolean; className?: string; children: ReactNode }) {
  const inner = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const node = inner.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(node.getBoundingClientRect().width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <motion.span
      className={[styles.autoWidth, className].filter(Boolean).join(" ")}
      initial={false}
      animate={width === null ? undefined : { width }}
      transition={reduced ? { duration: 0 } : WIDTH_SPRING}
    >
      <span ref={inner} className={styles.autoWidthInner}>
        {children}
      </span>
    </motion.span>
  );
}

function AutoHeight({ reduced, children }: { reduced: boolean; children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | string>("auto");
  useEffect(() => {
    const node = inner.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <motion.div className={styles.autoHeight} initial={false} animate={{ height }} transition={reduced ? { duration: 0 } : WIDTH_SPRING}>
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

/** Height-and-opacity reveal with a 6px lift; the row editor and the composer both use it. */
function Collapse({ open, reduced, id, className, children }: { open: boolean; reduced: boolean; id?: string; className?: string; children: ReactNode }) {
  const instant: Transition = { duration: 0 };
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="collapse"
          id={id}
          className={[styles.collapse, className].filter(Boolean).join(" ")}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1, transition: reduced ? instant : { height: COLLAPSE_SPRING, opacity: { duration: 0.24, delay: 0.06, ease: EASE } } }}
          exit={{ height: 0, opacity: 0, transition: reduced ? instant : { height: COLLAPSE_SPRING, opacity: { duration: 0.18, ease: EASE } } }}
        >
          <motion.div initial={!reduced && { y: 6 }} animate={{ y: 0, transition: reduced ? instant : COLLAPSE_SPRING }} exit={reduced ? undefined : { y: 6, transition: COLLAPSE_SPRING }}>
            <AutoHeight reduced={reduced}>{children}</AutoHeight>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
/* --------------------------------------------------------------- brand marks */

/* The nine provider glyphs are inlined: Linear, Slack, GitHub, Sentry, Google Calendar and Notion, plus the three model makers. */

function LinearMark({ title = "Linear", ...rest }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...rest}>
      <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
    </svg>
  );
}

function SlackMark({ title = "Slack", ...rest }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} {...rest}>
      <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" />
      <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" />
      <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" />
      <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  );
}

function GitHubMark({ title = "GitHub", ...rest }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...rest}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function SentryMark({ title = "Sentry", ...rest }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...rest}>
      <path d="M13.91 2.505c-.873-1.448-2.972-1.448-3.844 0L6.904 7.92a15.478 15.478 0 0 1 8.53 12.811h-2.221A13.301 13.301 0 0 0 5.784 9.814l-2.926 5.06a7.65 7.65 0 0 1 4.435 5.848H2.194a.365.365 0 0 1-.298-.534l1.413-2.402a5.16 5.16 0 0 0-1.614-.913L.296 19.275a2.182 2.182 0 0 0 .812 2.999 2.24 2.24 0 0 0 1.086.288h6.983a9.322 9.322 0 0 0-3.845-8.318l1.11-1.922a11.47 11.47 0 0 1 4.95 10.24h5.915a17.242 17.242 0 0 0-7.885-15.28l2.244-3.845a.37.37 0 0 1 .504-.13c.255.14 9.75 16.708 9.928 16.9a.365.365 0 0 1-.327.543h-2.287c.029.612.029 1.223 0 1.831h2.297a2.206 2.206 0 0 0 1.922-3.31z" />
    </svg>
  );
}

function GoogleCalendarMark({ title = "Google Calendar", ...rest }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...rest}>
      <path d="M18.316 5.684H24v12.632h-5.684V5.684zM5.684 24h12.632v-5.684H5.684V24zM18.316 5.684V0H1.895A1.894 1.894 0 0 0 0 1.895v16.421h5.684V5.684h12.632zm-7.207 6.25v-.065c.272-.144.5-.349.687-.617s.279-.595.279-.982c0-.379-.099-.72-.3-1.025a2.05 2.05 0 0 0-.832-.714 2.703 2.703 0 0 0-1.197-.257c-.6 0-1.094.156-1.481.467-.386.311-.65.671-.793 1.078l1.085.452c.086-.249.224-.461.413-.633.189-.172.445-.257.767-.257.33 0 .602.088.816.264a.86.86 0 0 1 .322.703c0 .33-.12.589-.36.778-.24.19-.535.284-.886.284h-.567v1.085h.633c.407 0 .748.109 1.02.327.272.218.407.499.407.843 0 .336-.129.614-.387.832s-.565.327-.924.327c-.351 0-.651-.103-.897-.311-.248-.208-.422-.502-.521-.881l-1.096.452c.178.616.505 1.082.977 1.401.472.319.984.478 1.538.477a2.84 2.84 0 0 0 1.293-.291c.382-.193.684-.458.902-.794.218-.336.327-.72.327-1.149 0-.429-.115-.797-.344-1.105a2.067 2.067 0 0 0-.881-.689zm2.093-1.931l.602.913L15 10.045v5.744h1.187V8.446h-.827l-2.158 1.557zM22.105 0h-3.289v5.184H24V1.895A1.894 1.894 0 0 0 22.105 0zm-3.289 23.5l4.684-4.684h-4.684V23.5zM0 22.105C0 23.152.848 24 1.895 24h3.289v-5.184H0v3.289z" />
    </svg>
  );
}

function NotionMark({ title = "Notion", ...rest }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...rest}>
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
    </svg>
  );
}

function ClaudeMark({ title = "Claude", ...rest }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...rest}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

function OpenAIMark({ title = "OpenAI", ...rest }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...rest}>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

function GeminiMark({ title = "Gemini", ...rest }: MarkProps) {
  const gradient = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} {...rest}>
      <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="#3186FF" />
      <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill={`url(#${gradient}-0)`} />
      <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill={`url(#${gradient}-1)`} />
      <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill={`url(#${gradient}-2)`} />
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id={`${gradient}-0`} x1="7" x2="11" y1="15.5" y2="12">
          <stop stopColor="#08B962" />
          <stop offset="1" stopColor="#08B962" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={`${gradient}-1`} x1="8" x2="11.5" y1="5.5" y2="11">
          <stop stopColor="#F94543" />
          <stop offset="1" stopColor="#F94543" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={`${gradient}-2`} x1="3.5" x2="17.5" y1="13.5" y2="12">
          <stop stopColor="#FABC12" />
          <stop offset=".46" stopColor="#FABC12" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const SOURCE_MARKS: Record<RoutineSource | "slack", (props: MarkProps) => ReactElement> = {
  linear: LinearMark,
  slack: SlackMark,
  github: GitHubMark,
  sentry: SentryMark,
  "google-calendar": GoogleCalendarMark,
  notion: NotionMark,
};

const PROVIDER_MARKS: Record<ModelProvider, (props: MarkProps) => ReactElement> = {
  anthropic: ClaudeMark,
  openai: OpenAIMark,
  google: GeminiMark,
};
/* ------------------------------------------------------------- mark helpers */

function SourceMark({ id, size = 14 }: { id: RoutineSource | "slack"; size?: number }) {
  const Mark = SOURCE_MARKS[id];
  return <Mark width={size} height={size} title={MARK_LABEL[id]} aria-hidden="true" className={styles.mark} data-brand={id} />;
}

function ProviderMark({ model, size = 14 }: { model: RoutineModel; size?: number }) {
  const entry = MODELS[model];
  const Mark = PROVIDER_MARKS[entry.provider];
  return <Mark width={size} height={size} aria-hidden="true" className={styles.mark} data-brand={entry.provider} />;
}

/* -------------------------------------------------------------------- ticks */

/** The last fourteen runs, oldest on the left. One tab stop; arrows walk the ticks. */
function RunTicks({ runs, now, reduced, routineName }: { runs: RoutineRun[]; now: number; reduced: boolean; routineName: string }) {
  const recent = runs.slice(-14);
  const empty = 14 - recent.length;
  const [focused, setFocused] = useState<string | null>(null);
  const counts = recent.reduce(
    (total, run) => ({ ...total, [run.status]: total[run.status] + 1 }),
    { success: 0, failed: 0, skipped: 0 } as Record<RoutineRunStatus, number>,
  );
  const label = recent.length
    ? `${routineName}, last ${recent.length} runs: ${counts.success} succeeded, ${counts.failed} failed, ${counts.skipped} skipped`
    : `${routineName} has no runs yet`;
  const activeId = focused ?? recent.at(-1)?.id;

  const walk = (event: ReactKeyboardEvent<HTMLSpanElement>, index: number) => {
    const last = recent.length - 1;
    const target = event.key === "ArrowRight" ? (index === last ? 0 : index + 1) : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1) : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
    if (target < 0) return;
    event.preventDefault();
    const ticks = event.currentTarget.closest(`.${styles.ticks}`);
    ticks?.querySelectorAll<HTMLElement>("[data-run]")[target]?.focus();
  };

  return (
    <div className={styles.ticks} role="group" aria-label={label} style={{ width: 95 }}>
      {Array.from({ length: empty }, (_, index) => (
        <span key={`empty-${index}`} className={styles.tickSlot} style={{ transform: `translateX(${7 * (recent.length + index)}px)` }} aria-hidden="true">
          <span className={styles.tick} data-status="empty" />
        </span>
      ))}
      <AnimatePresence initial={false}>
        {recent.map((run, index) => {
          const Icon = STATUS_ICON[run.status];
          const when = runTimeLabel(run.at, now);
          const duration = durationLabel(run.durationMs);
          return (
            <motion.span
              key={run.id}
              className={styles.tickSlot}
              initial={{ x: (index + 1) * 7, opacity: 0 }}
              animate={{ x: index * 7, opacity: 1 }}
              exit={{ x: (index - 1) * 7, opacity: 0 }}
              transition={reduced ? { duration: 0 } : TICK_SLIDE}
            >
              <Tooltip
                content={
                  <span className={styles.runTip}>
                    <span className={styles.runTipHead} data-status={run.status}>
                      <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
                      {STATUS_LABEL[run.status]}
                      <span className={styles.runTipMeta}>{[when, duration].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className={styles.runTipText}>{run.summary}</span>
                  </span>
                }
              >
                <span
                  role="img"
                  className={styles.tick}
                  data-status={run.status}
                  data-run={run.id}
                  tabIndex={run.id === activeId ? 0 : -1}
                  aria-label={`${STATUS_LABEL[run.status]}, ${when}${duration ? `, ${duration}` : ""}: ${run.summary}`}
                  onKeyDown={event => walk(event, index)}
                  onFocus={() => setFocused(run.id)}
                />
              </Tooltip>
            </motion.span>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------- report */

const REPORT_TOKEN = /(\b[A-Z]{2,5}-\d{2,5}\b|#\d{3,5}\b|#[a-z][\w-]*)/g;

/** Ids and channels inside a report read as tokens, not as prose. */
function reportText(text: string, key: string): ReactNode[] {
  return text.split(REPORT_TOKEN).map((part, index) =>
    index % 2 === 1 ? (
      <span key={`${key}-${index}`} className={styles.reportToken}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}

interface ReportLine {
  kind: "title" | "item" | "text";
  chunks: string[];
}

/** Splits the report into 15–40 character chunks so it can stream in without reflowing. */
function chunkReport(report: string): ReportLine[] {
  let seed = 7;
  const random = () => {
    seed = (9301 * seed + 49297) % 233280;
    return seed / 233280;
  };
  return report
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const kind: ReportLine["kind"] = index === 0 ? "title" : line.startsWith("- ") ? "item" : "text";
      const body = kind === "item" ? line.slice(2) : line;
      const chunks: string[] = [];
      let cursor = 0;
      while (cursor < body.length) {
        let size = 15 + Math.floor(26 * random());
        const space = body.indexOf(" ", cursor + size);
        if (space > -1 && space < cursor + size + 14) size = space - cursor + 1;
        chunks.push(body.slice(cursor, cursor + size));
        cursor += size;
      }
      return { kind, chunks };
    });
}

function ReportStream({ report, streaming, streamKey, onDone }: { report: string; streaming: boolean; streamKey: number; onDone: () => void }) {
  const lines = chunkReport(report);
  const total = lines.reduce((count, line) => count + line.chunks.length, 0);
  const [shown, setShown] = useState(streaming ? 0 : total);

  useEffect(() => {
    setShown(streaming ? 0 : total);
  }, [streaming, total, streamKey]);

  useEffect(() => {
    if (!streaming || shown >= total) return;
    let frame = 0;
    let last = 0;
    const step = (time: number) => {
      if (time - last >= 32) {
        last = time;
        setShown(value => Math.min(total, value + 1));
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [streaming, shown, total]);

  useEffect(() => {
    if (streaming && total > 0 && shown >= total) onDone();
  }, [streaming, shown, total, onDone]);

  let consumed = 0;
  const blocks: ReactNode[] = [];
  let items: ReactNode[] = [];
  const flushItems = () => {
    if (!items.length) return;
    blocks.push(
      <ul key={`list-${blocks.length}`} className={styles.reportList}>
        {items}
      </ul>,
    );
    items = [];
  };

  const chunksOf = (line: ReportLine, lineIndex: number, visible: number) =>
    line.chunks.slice(0, visible).map((chunk, index) => (
      <span key={`${lineIndex}-${index}`} className={styles.chunk}>
        {reportText(chunk, `${lineIndex}-${index}`)}
      </span>
    ));

  lines.forEach((line, lineIndex) => {
    const visible = Math.max(0, Math.min(line.chunks.length, shown - consumed));
    consumed += line.chunks.length;
    if (!visible) return;
    if (line.kind === "item") {
      items.push(<li key={`item-${lineIndex}`}>{chunksOf(line, lineIndex, visible)}</li>);
      return;
    }
    flushItems();
    blocks.push(
      line.kind === "title" ? (
        <p key={`line-${lineIndex}`} className={styles.reportTitle}>
          {chunksOf(line, lineIndex, visible)}
        </p>
      ) : (
        <p key={`line-${lineIndex}`} className={styles.reportText}>
          {chunksOf(line, lineIndex, visible)}
        </p>
      ),
    );
  });
  flushItems();

  return (
    <div className={styles.report} aria-busy={(streaming && shown < total) || undefined}>
      {blocks}
    </div>
  );
}

/* ----------------------------------------------------------------- schedule */

const FREQUENCIES = [
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
];
const MINUTES = ["00", "15", "30", "45"];
const DAY_OPTIONS = [...WEEKDAY_OPTIONS.slice(1), WEEKDAY_OPTIONS[0]];

function cronLine(schedule: RoutineSchedule) {
  const { hours, minutes } = parseTime(schedule.time);
  if (schedule.frequency === "hourly") return `${minutes} * * * *`;
  if (schedule.frequency === "daily") return `${minutes} ${hours} * * *`;
  if (schedule.frequency === "weekly") return `${minutes} ${hours} * * ${schedule.day ?? 1}`;
  return `${minutes} ${hours} * * 1-5`;
}

function ScheduleEditor({ value, onChange, idPrefix, label = "Schedule" }: { value: RoutineSchedule; onChange: (schedule: RoutineSchedule) => void; idPrefix: string; label?: string }) {
  const { hours, minutes } = parseTime(value.time);
  const setTime = (next: string) => onChange({ ...value, time: next });
  return (
    <fieldset className={styles.schedule}>
      <legend className={styles.srOnly}>{label}</legend>
      <div className={styles.scheduleRow}>
        <SegmentedControl
          className={styles.frequency}
          label="Frequency"
          options={FREQUENCIES}
          value={value.frequency}
          onValueChange={next => onChange({ ...value, frequency: next as RoutineFrequency, day: next === "weekly" ? value.day ?? 5 : value.day })}
        />
        <div className={styles.scheduleFields}>
          {value.frequency === "weekly" ? (
            <div className={styles.dayField}>
              <Select label="Day" id={`${idPrefix}-day`} options={DAY_OPTIONS} value={String(value.day ?? 1)} onValueChange={next => onChange({ ...value, day: Number(next) })} />
            </div>
          ) : null}
          {value.frequency === "hourly" ? (
            <div className={styles.timeField}>
              <Select
                label="Minute past the hour"
                id={`${idPrefix}-minute`}
                options={MINUTES.map(minute => ({ value: minute, label: `:${minute}` }))}
                value={pad2(minutes)}
                onValueChange={next => setTime(timeValue(0, Number(next)))}
              />
            </div>
          ) : (
            <div className={styles.timeField}>
              <Input id={`${idPrefix}-time`} label="Time" type="time" required value={timeValue(hours, minutes)} onChange={event => setTime(event.target.value)} />
            </div>
          )}
        </div>
      </div>
      <p className={styles.cronLine}>
        <span>{describeSchedule(value)}</span>
        <span aria-hidden="true">·</span>
        <span>
          Cron <code className={styles.cron}>{cronLine(value)}</code>
        </span>
      </p>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ details */

function RoutineDetails({
  routine,
  live,
  now,
  reduced,
  streaming,
  onStreamDone,
  onScheduleChange,
}: {
  routine: Routine;
  live: LiveRun;
  now: number;
  reduced: boolean;
  streaming: boolean;
  onStreamDone: () => void;
  onScheduleChange: (schedule: RoutineSchedule) => void;
}) {
  const uid = useId();
  const running = live.status === "running";
  const last = routine.history.at(-1);
  const failed = live.status === "failed";
  const view = running ? "running" : failed ? "failed" : routine.report ? "report" : "empty";
  const Icon = last ? STATUS_ICON[last.status] : null;
  const meta = running ? `Step ${live.step + 1} of ${live.steps.length}` : "No runs yet";

  return (
    <div className={styles.details}>
      <section className={styles.section} aria-labelledby={`${uid}-latest`}>
        <div className={styles.sectionHead}>
          <h4 className={styles.sectionTitle} id={`${uid}-latest`}>
            Latest run
          </h4>
          <span className={styles.metaSlot}>
            <SwapText swapKey={running ? "running" : last?.id ?? "none"} reduced={reduced} className={styles.runMeta}>
              {running ? (
                <span className={styles.nums}>{meta}</span>
              ) : last ? (
                <>
                  {Icon ? <Icon className={styles.statusIcon} data-status={last.status} size={14} strokeWidth={1.75} aria-hidden="true" /> : null}
                  <span className={styles.runMetaLabel}>{STATUS_LABEL[last.status]}</span>
                  <span>{runTimeLabel(last.at, now)}</span>
                  {last.durationMs ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className={styles.nums}>{durationLabel(last.durationMs)}</span>
                    </>
                  ) : null}
                  <span aria-hidden="true">·</span>
                  <span>{MODELS[routine.model].name}</span>
                </>
              ) : (
                meta
              )}
            </SwapText>
          </span>
        </div>
        <div className={styles.latestBody}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={view}
              className={styles.latestPhase}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE } }}
              transition={{ duration: reduced ? 0.12 : 0.16, ease: EASE }}
            >
              {view === "running" ? (
                <ol className={styles.steps} aria-label="Run progress">
                  {live.steps.map((step, index) => (
                    <li key={step} className={styles.step} data-state={index < live.step ? "done" : index === live.step ? "active" : "pending"} aria-current={index === live.step ? "step" : undefined}>
                      <span className={styles.stepIcon}>{index < live.step ? <Check size={12} strokeWidth={2} aria-hidden="true" /> : <span className={styles.stepDot} />}</span>
                      <TextShimmer active={index === live.step}>{step}</TextShimmer>
                      <span className={styles.srOnly}>{index < live.step ? ", done" : index === live.step ? ", in progress" : ", waiting"}</span>
                    </li>
                  ))}
                </ol>
              ) : view === "failed" ? (
                <div className={styles.errorNote} role="alert">
                  <CircleAlert className={styles.statusIcon} data-status="failed" size={14} strokeWidth={1.75} aria-hidden="true" />
                  <div>
                    <p className={styles.errorTitle}>
                      {live.steps.length ? `Failed while ${live.steps[0].charAt(0).toLowerCase()}${live.steps[0].slice(1)}` : "The last run failed"}
                    </p>
                    <p className={styles.errorText}>{`${live.error ?? last?.summary ?? "The run failed."} Run it again when the service is back.`}</p>
                  </div>
                </div>
              ) : view === "report" && routine.report ? (
                <>
                  <ReportStream report={routine.report} streaming={streaming} streamKey={live.streamKey} onDone={onStreamDone} />
                  <p className={styles.postedTo}>
                    <SourceMark id="slack" size={12} />
                    {last?.status === "skipped" ? (
                      "Nothing posted"
                    ) : routine.destination === "Direct message" ? (
                      "Sent as a direct message"
                    ) : (
                      <>
                        Posted to <span className={styles.reportToken}>{routine.destination}</span>
                      </>
                    )}
                  </p>
                </>
              ) : (
                <p className={styles.emptyNote}>No runs yet. Run it now to see the output here.</p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
      <section className={styles.section} aria-labelledby={`${uid}-instructions`}>
        <h4 className={styles.sectionTitle} id={`${uid}-instructions`}>
          Instructions
        </h4>
        <p className={styles.instruction}>{routine.instruction}</p>
      </section>
      <section className={styles.section} aria-labelledby={`${uid}-schedule`}>
        <h4 className={styles.sectionTitle} id={`${uid}-schedule`}>
          Schedule
        </h4>
        <ScheduleEditor idPrefix={uid} value={routine.schedule} onChange={onScheduleChange} label={`${routine.name} schedule`} />
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------------- row */

function RunLabel({ running, reduced }: { running: boolean; reduced: boolean }) {
  const transition: Transition = { duration: reduced ? 0 : 0.16, ease: EASE };
  return (
    <span className={styles.runStack}>
      <motion.span className={styles.runLayer} animate={{ opacity: running ? 0 : 1 }} transition={transition} aria-hidden={running || undefined}>
        <Play className={styles.playIcon} size={14} strokeWidth={1.75} aria-hidden="true" />
        <span className={styles.runText}>Run now</span>
      </motion.span>
      <motion.span className={styles.runLayer} animate={{ opacity: running ? 1 : 0 }} transition={transition} aria-hidden={!running || undefined}>
        <Square size={12} strokeWidth={2} aria-hidden="true" />
        <span className={styles.runText}>Stop</span>
      </motion.span>
    </span>
  );
}

function countdownLabel(target: number, now: number) {
  const seconds = Math.floor(Math.max(0, target - now) / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (days) return `${days} d ${hours} h`;
  if (hours) return `${hours} h ${minutes} min`;
  if (minutes) return `${minutes} min ${pad2(rest)} s`;
  return `${rest} s`;
}

interface RoutineRowProps {
  routine: Routine;
  live: LiveRun;
  now: number | null;
  reduced: boolean;
  open: boolean;
  streaming: boolean;
  stepMs: number;
  onOpenChange: (open: boolean) => void;
  onRun: () => void;
  onStop: () => void;
  onToggle: (enabled: boolean) => void;
  onScheduleChange: (schedule: RoutineSchedule) => void;
  onStreamDone: () => void;
  onNavigate: (direction: number | "first" | "last") => void;
}

const RoutineRow = forwardRef<HTMLButtonElement, RoutineRowProps>(function RoutineRow(
  { routine, live, now, reduced, open, streaming, stepMs, onOpenChange, onRun, onStop, onToggle, onScheduleChange, onStreamDone, onNavigate },
  ref,
) {
  const uid = useId();
  const running = live.status === "running";
  const model = MODELS[routine.model];
  const last = routine.history.at(-1);
  const clock = now ?? 0;
  const progress = running && live.steps.length ? (live.step + 1) / live.steps.length : 0;
  const shown = routine.sources.length > 3 ? routine.sources.slice(0, 2) : routine.sources;
  const rest = routine.sources.slice(shown.length);
  const destinationSentence = routine.destination === "Direct message" ? "Slack direct message" : `Slack ${routine.destination}`;
  const sourceNames = routine.sources.map(source => MARK_LABEL[source]);
  const tone = (() => {
    if (routine.accent) return routine.accent;
    let hash = 0;
    for (const char of routine.id) hash = (31 * hash + char.charCodeAt(0)) >>> 0;
    return (hash % 4) + 1;
  })();
  const status = running ? "running" : routine.enabled ? "next" : "paused";
  const Icon = last ? STATUS_ICON[last.status] : null;

  const onHeadClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-row-control]") || (event.target as HTMLElement).closest("button")) return;
    if (window.getSelection()?.toString()) return;
    onOpenChange(!open);
  };

  return (
    <div
      className={styles.itemInner}
      data-open={open || undefined}
      data-enabled={routine.enabled || undefined}
      data-running={running || undefined}
      style={{ "--routine-accent": `var(--series-${tone})` } as CSSProperties}
    >
      <div className={styles.head} onClick={onHeadClick}>
        <div className={styles.line}>
          <h3 className={styles.nameHeading}>
            <button
              ref={ref}
              type="button"
              className={styles.name}
              aria-expanded={open}
              aria-controls={open ? uid : undefined}
              onClick={() => onOpenChange(!open)}
              onKeyDown={event => {
                const direction = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : event.key === "Home" ? "first" : event.key === "End" ? "last" : null;
                if (direction === null) return;
                event.preventDefault();
                onNavigate(direction);
              }}
            >
              <span className={styles.nameText}>{routine.name}</span>
              <ChevronDown className={styles.chevron} size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </h3>
          <div className={styles.controls} data-row-control>
            <span className={styles.runSlot}>
              <Button
                size="sm"
                variant="ghost"
                className={styles.runButton}
                onClick={running ? onStop : onRun}
                aria-label={running ? `Stop ${routine.name}` : `Run ${routine.name} now`}
              >
                <RunLabel running={running} reduced={reduced} />
              </Button>
            </span>
            <Switch className={styles.switch} checked={routine.enabled} onCheckedChange={onToggle} aria-label={`Run ${routine.name} on schedule`} />
          </div>
        </div>
        <div className={styles.line}>
          <p className={styles.when}>
            <AutoWidth reduced={reduced} className={styles.scheduleText}>
              <SwapText swapKey={describeSchedule(routine.schedule)} reduced={reduced}>
                {describeSchedule(routine.schedule)}
              </SwapText>
            </AutoWidth>
            <span className={styles.dot}>·</span>
            <span className={styles.statusSlot}>
              <SwapText swapKey={status} reduced={reduced} className={styles.statusPhase}>
                {running ? (
                  <>
                    <TextShimmer className={styles.runningWord} active>
                      Running
                    </TextShimmer>
                    <span className={styles.dot} aria-hidden="true">
                      ·
                    </span>
                    <span className={styles.stepSlot}>
                      <SwapText swapKey={`step-${live.step}`} reduced={reduced} className={styles.stepText}>
                        {live.steps[live.step] ?? "Starting"}
                      </SwapText>
                    </span>
                  </>
                ) : !routine.enabled ? (
                  "Paused"
                ) : now === null ? (
                  "Next run soon"
                ) : (
                  <span>
                    Next run in <span className={styles.countdown}>{countdownLabel(nextRun(routine.schedule, clock), clock)}</span>
                  </span>
                )}
              </SwapText>
            </span>
          </p>
          <p className={styles.lastRun}>
            <SwapText swapKey={last?.id ?? "none"} reduced={reduced} className={styles.lastRunPhase}>
              {last && Icon ? (
                <>
                  <Icon className={styles.statusIcon} data-status={last.status} size={14} strokeWidth={1.75} aria-hidden="true" />
                  <span className={styles.srOnly}>{STATUS_LABEL[last.status]}, </span>
                  <span>Last run {runTimeLabel(last.at, clock).replace(/^Today/, "today").replace(/^Yesterday/, "yesterday")}</span>
                </>
              ) : (
                "No runs yet"
              )}
            </SwapText>
          </p>
        </div>
        <div className={styles.line}>
          <div className={styles.meta}>
            <span className={styles.srOnly}>
              Reads {sourceNames.join(", ") || "no sources"}, posts to {destinationSentence}, runs on {model.name}.
            </span>
            <span className={styles.sources} aria-hidden="true">
              {shown.map(source => (
                <Tooltip key={source} content={MARK_LABEL[source]}>
                  <span className={styles.markHit} data-state="closed">
                    <SourceMark id={source} />
                  </span>
                </Tooltip>
              ))}
              {rest.length ? (
                <Tooltip content={rest.map(source => MARK_LABEL[source]).join(", ")}>
                  <span className={styles.more} data-state="closed">
                    +{rest.length}
                  </span>
                </Tooltip>
              ) : null}
            </span>
            <ArrowRight className={styles.metaArrow} size={12} strokeWidth={1.75} aria-hidden="true" />
            <Tooltip content={destinationSentence}>
              <span className={styles.destination} data-state="closed" aria-hidden="true">
                <SourceMark id="slack" size={12} />
                <span className={styles.destinationText}>{routine.destination === "Direct message" ? "DM" : routine.destination}</span>
              </span>
            </Tooltip>
            <span className={styles.metaDivider} aria-hidden="true" />
            <Tooltip content={model.name}>
              <span className={styles.markHit} data-state="closed" aria-hidden="true">
                <ProviderMark model={routine.model} />
              </span>
            </Tooltip>
          </div>
          <div className={styles.ticksSlot} data-row-control>
            <RunTicks runs={routine.history} now={clock} reduced={reduced} routineName={routine.name} />
          </div>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {running ? (
          <motion.span
            key="progress"
            className={styles.progress}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.16 } }}
            exit={{ opacity: 0, transition: { duration: 0.24 * Number(!reduced), delay: 0.12 * Number(!reduced) } }}
          >
            <motion.span
              className={styles.progressFill}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: progress }}
              transition={reduced ? { duration: 0 } : { duration: stepMs / 1000, ease: "linear" }}
            />
          </motion.span>
        ) : null}
      </AnimatePresence>
      <Collapse open={open} reduced={reduced} id={uid}>
        <RoutineDetails
          routine={routine}
          live={live}
          now={clock}
          reduced={reduced}
          streaming={streaming}
          onStreamDone={onStreamDone}
          onScheduleChange={onScheduleChange}
        />
      </Collapse>
    </div>
  );
});
/* --------------------------------------------------------------------- chip */

function Chip({
  label,
  value,
  empty,
  popoverLabel,
  reduced,
  children,
}: {
  label: ReactNode;
  value: string;
  empty?: boolean;
  popoverLabel: string;
  reduced: boolean;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={styles.chip} data-empty={empty || undefined} aria-label={`${popoverLabel}: ${value}`}>
          <AutoWidth reduced={reduced} className={styles.chipValue}>
            <SwapText swapKey={value} reduced={reduced}>
              {label}
            </SwapText>
          </AutoWidth>
          <ChevronDown className={styles.chipChevron} size={12} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className={styles.chipPopover} aria-label={popoverLabel}>
        {children}
      </PopoverContent>
    </Popover>
  );
}

/* ---------------------------------------------------------------- composer */

const DEFAULT_SCHEDULE: RoutineSchedule = { frequency: "weekdays", time: "09:00" };
const EXAMPLE = "Every Friday at 16:00, summarize merged PRs to #eng";

function defaultSteps(routine: Pick<Routine, "destination">) {
  return ["Reading sources", "Following the instructions", "Writing the summary", routine.destination === "Direct message" ? "Sending a direct message" : `Posting to ${routine.destination}`];
}

interface ComposerDraft {
  name: string;
  instruction: string;
  schedule: RoutineSchedule;
  sources: RoutineSource[];
  destination: string;
}

function Composer({ reduced, onCreate, onCancel }: { reduced: boolean; onCreate: (draft: ComposerDraft) => void; onCancel: () => void }) {
  const uid = useId();
  const input = useRef<HTMLInputElement>(null);
  const [sentence, setSentence] = useState("");
  const [parsed, setParsed] = useState<{ sentence: string; result: ParsedSentence } | null>(null);
  const [overrides, setOverrides] = useState<{ schedule?: RoutineSchedule; sources?: RoutineSource[]; destination?: string }>({});

  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);

  // Parsing waits for the sentence to settle, so chips do not flicker on every keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setParsed({ sentence, result: parseSentence(sentence) }), 380);
    return () => window.clearTimeout(timer);
  }, [sentence]);

  const filled = sentence.trim().length > 0;
  const parsing = filled && parsed?.sentence !== sentence;
  const result = filled ? parsed?.result ?? null : null;
  const schedule = overrides.schedule ?? result?.schedule ?? DEFAULT_SCHEDULE;
  const sources = overrides.sources ?? result?.sources ?? [];
  const destination = overrides.destination ?? result?.destination ?? "#eng";
  const name = result?.name ?? "New routine";
  const settled = Boolean(overrides.schedule ?? result);
  const destinations = [destination, ...DESTINATIONS.filter(option => option !== destination)];
  const note = parsing ? "parsing" : filled && !sources.length ? "no-sources" : filled ? "parsed" : "idle";

  const toggleSource = (id: RoutineSource) =>
    setOverrides(current => {
      const active = current.sources ?? result?.sources ?? [];
      const next = active.includes(id) ? active.filter(source => source !== id) : [...active, id];
      return { ...current, sources: SOURCE_ORDER.filter(source => next.includes(source)) };
    });

  const submit = () => {
    if (!filled) {
      input.current?.focus();
      return;
    }
    const draft = parsed?.sentence === sentence ? parsed.result : parseSentence(sentence);
    const picked = overrides.sources ?? draft.sources;
    if (!picked.length) return;
    onCreate({
      name,
      instruction: sentence.trim(),
      schedule: overrides.schedule ?? draft.schedule,
      sources: picked,
      destination: overrides.destination ?? draft.destination,
    });
  };

  return (
    <form
      className={styles.composer}
      onSubmit={event => {
        event.preventDefault();
        submit();
      }}
    >
      <Input
        ref={input}
        id={`${uid}-sentence`}
        label="Describe the routine in a sentence"
        value={sentence}
        placeholder={EXAMPLE}
        autoComplete="off"
        onChange={event => setSentence(event.target.value)}
        onKeyDown={event => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          onCancel();
        }}
      />
      <div className={styles.parsed}>
        <p className={styles.parsedName}>
          <SwapText swapKey={name} reduced={reduced} className={styles.parsedNameText}>
            {name}
          </SwapText>
        </p>
      </div>
      <div className={styles.chips}>
        <span className={styles.chipWord}>Runs</span>
        <Chip
          value={settled ? describeSchedule(schedule) : "When"}
          popoverLabel="Schedule"
          reduced={reduced}
          label={
            <>
              <Calendar size={12} strokeWidth={1.75} aria-hidden="true" />
              <span>{settled ? describeSchedule(schedule) : "When"}</span>
            </>
          }
        >
          <ScheduleEditor idPrefix={`${uid}-schedule`} value={schedule} onChange={next => setOverrides(current => ({ ...current, schedule: next }))} />
        </Chip>
        <span className={styles.chipWord}>reads</span>
        <Chip
          value={sources.length > 2 ? `${sources.length} sources` : sources.map(source => MARK_LABEL[source]).join(", ") || "Choose sources"}
          popoverLabel="Sources"
          empty={!sources.length}
          reduced={reduced}
          label={
            sources.length ? (
              <>
                {sources.map(source => (
                  <SourceMark key={source} id={source} size={12} />
                ))}
                <span>{sources.length > 2 ? `${sources.length} sources` : sources.map(source => MARK_LABEL[source]).join(", ")}</span>
              </>
            ) : (
              <span>Choose sources</span>
            )
          }
        >
          <div className={styles.optionList} role="group" aria-label="Sources">
            {SOURCE_ORDER.map(source => {
              const active = sources.includes(source);
              return (
                <button key={source} type="button" className={styles.option} aria-pressed={active} onClick={() => toggleSource(source)}>
                  <SourceMark id={source} />
                  <span className={styles.optionText}>{MARK_LABEL[source]}</span>
                  {active ? <Check className={styles.optionCheck} size={14} strokeWidth={2} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </Chip>
        <span className={styles.chipWord}>posts to</span>
        <Chip
          value={destination}
          popoverLabel="Destination"
          reduced={reduced}
          label={
            <>
              <SourceMark id="slack" size={12} />
              <span>{destination}</span>
            </>
          }
        >
          <div className={styles.optionList} role="group" aria-label="Destination">
            {destinations.map(option => {
              const active = option === destination;
              return (
                <PopoverClose key={option} asChild>
                  <button type="button" className={styles.option} aria-pressed={active} onClick={() => setOverrides(current => ({ ...current, destination: option }))}>
                    <SourceMark id="slack" />
                    <span className={styles.optionText}>{option}</span>
                    {active ? <Check className={styles.optionCheck} size={14} strokeWidth={2} aria-hidden="true" /> : null}
                  </button>
                </PopoverClose>
              );
            })}
          </div>
        </Chip>
      </div>
      <div className={styles.composerFoot}>
        <p className={styles.composerNote} aria-live="polite">
          <SwapText swapKey={note} reduced={reduced} className={styles.composerNoteText}>
            {note === "parsing" ? (
              <TextShimmer active>Reading your sentence</TextShimmer>
            ) : note === "no-sources" ? (
              "Pick at least one source to read from."
            ) : note === "parsed" ? (
              "Read on this device as a simulation. Click a chip to change it."
            ) : (
              <>
                Say when it runs, what it reads and where it posts.{" "}
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => {
                    setSentence(EXAMPLE);
                    input.current?.focus();
                  }}
                >
                  Use the example
                </button>
              </>
            )}
          </SwapText>
        </p>
        <div className={styles.composerActions}>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" className={styles.accentButton} disabled={!filled || (!parsed && !sources.length)}>
            Add routine
          </Button>
        </div>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------- clock */

function useDemoClock(now: number | undefined, live: boolean) {
  const [tick, setTick] = useState<number | null>(() => now ?? (live ? null : demoNow()));
  useEffect(() => {
    if (now !== undefined) return;
    const base = live ? 0 : demoNow();
    const started = Date.now();
    const read = () => (live ? Date.now() : base + (Date.now() - started));
    const immediate = window.setTimeout(() => setTick(read()), 0);
    const interval = window.setInterval(() => setTick(read()), 1000);
    return () => {
      window.clearTimeout(immediate);
      window.clearInterval(interval);
    };
  }, [live, now]);
  return now ?? tick;
}

/* -------------------------------------------------------------------- runs */

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Stopped", "AbortError"));
      },
      { once: true },
    );
  });

type Simulated = { status: RoutineRunStatus; summary: string; report?: string; failAt?: number; error?: string };

/** A run that looks real: same steps, a plausible report, and an occasional failure. */
function simulateRun(routine: Routine, attempts: number, clock: number): Simulated {
  const date = new Date(clock);
  const day = `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()] === "Oct" ? "October" : MONTHS[date.getMonth()]}`;
  switch (routine.id) {
    case "morning-triage":
      return {
        status: "success",
        summary: "Triaged 6 issues, 1 urgent",
        report: `Triage for ${day}\n- ENG-2149 Team invites expire after 1 hour instead of 7 days. Urgent, 21 users in Sentry, assigned to Priya Nair.\n- ENG-2147 Dark mode chart labels are hard to read in exports. 3 users, assigned to Lena Fischer.\n- ENG-2144 Duplicate webhook deliveries for invoice.paid. No new errors since Friday, moved to the backlog.\n6 issues reviewed, 1 urgent, 3 routed to owners, 2 left for Thursday's review.`,
      };
    case "pr-digest":
      return {
        status: "success",
        summary: "11 pull requests from 6 people",
        report:
          "Merged so far this week in arc-web and arc-api\n- 11 pull requests from 6 people, median time to first review 2 h 55 min.\n- Billing: #1858 tax IDs on invoices. Touches the billing service.\n- Editor: #1855 comments on table cells and #1856 keyboard reordering for blocks.\nOne pull request is waiting more than two days for review: #1847.",
      };
    case "incident-watch":
      return attempts === 0
        ? {
            status: "failed",
            summary: "Sentry returned 502, nothing posted",
            failAt: 0,
            error: "Sentry returned 502 Bad Gateway while listing issues. Nothing was posted to #incidents.",
          }
        : {
            status: "skipped",
            summary: "Nothing above the threshold",
            report: "No spikes since the last run\nThe busiest issue had 12 events in 15 minutes, below the threshold of 50. Nothing was posted.",
          };
    case "meeting-prep":
      return {
        status: "success",
        summary: "Briefed 3 meetings",
        report: `Your ${day}\n- 10:30 Roadmap sync with Ana. ENG-2141 is the only open blocker for the checkout release.\n- 14:00 Interview loop for the design engineer role. Notion: interview kit v2.\n- 17:00 Weekly metrics. Trial to paid is up 0.8 points since last week.`,
      };
    default: {
      const labels = routine.sources.map(source => MARK_LABEL[source]);
      const reads = labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}` : labels[0] ?? "your sources";
      return {
        status: "success",
        summary: `Posted a summary to ${routine.destination}`,
        report: `${routine.name}, ${day}\n- Read the latest activity in ${reads}.\n- Followed the instructions and wrote a short summary.\nPosted to ${routine.destination}.`,
      };
    }
  }
}

/* -------------------------------------------------------------------- block */

/**
 * A schedule of agents. Each row is a routine: what it reads, when it runs and where it posts.
 * Opening a row shows the last run, the instruction and an editable schedule; New routine turns
 * one sentence into a draft. Runs are simulated locally unless `onRun` resolves a real result.
 */
export function AgentRoutines({ routines, onRun, onToggle, onSave, now, defaultOpenId = null, title = "Routines", className }: AgentRoutinesProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const [list, setList] = useState<Routine[]>(() => routines ?? sampleRoutines());
  const [mirror, setMirror] = useState(routines);
  if (routines !== mirror) {
    setMirror(routines);
    if (routines) setList(routines);
  }
  const clock = useDemoClock(now === undefined || typeof now === "number" ? now : now.getTime(), routines !== undefined);
  const [live, setLive] = useState<Record<string, LiveRun>>({});
  const [streaming, setStreaming] = useState<Record<string, boolean>>({});
  const [openId, setOpenId] = useState<string | null>(defaultOpenId);
  const [composing, setComposing] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const rows = useRef(new Map<string, HTMLButtonElement>());
  const newButton = useRef<HTMLButtonElement>(null);
  const controllers = useRef(new Map<string, AbortController>());
  const listRef = useRef(list);
  const liveRef = useRef(live);
  const openRef = useRef(openId);
  const clockRef = useRef(clock);

  useEffect(() => {
    listRef.current = list;
    liveRef.current = live;
    openRef.current = openId;
    clockRef.current = clock;
  });

  const enabled = list.filter(routine => routine.enabled).length;

  const patchLive = useCallback((id: string, patch: Partial<LiveRun>) => {
    setLive(current => ({ ...current, [id]: { ...(current[id] ?? IDLE_RUN), ...patch } }));
  }, []);

  const patchRoutine = useCallback((id: string, patch: Partial<Routine> | ((routine: Routine) => Partial<Routine>)) => {
    setList(current => current.map(routine => (routine.id === id ? { ...routine, ...(typeof patch === "function" ? patch(routine) : patch) } : routine)));
  }, []);

  const start = useCallback(
    async (id: string, reason: "manual" | "schedule") => {
      const routine = listRef.current.find(entry => entry.id === id);
      if (!routine || controllers.current.has(id)) return;
      const attempts = liveRef.current[id]?.attempts ?? 0;
      const steps = routine.steps?.length ? routine.steps : defaultSteps(routine);
      const controller = new AbortController();
      controllers.current.set(id, controller);
      const ranAt = clockRef.current ?? Date.now();
      const startedAt = Date.now();
      patchLive(id, { status: "running", step: 0, steps, error: undefined, attempts: attempts + 1 });
      setStreaming(current => ({ ...current, [id]: false }));

      const answer = onRun?.(routine);
      const pending = answer && typeof answer === "object" ? answer : null;
      const simulated = pending ? null : simulateRun(routine, attempts, ranAt);

      setAnnouncement(`${routine.name} ${reason === "schedule" ? "started on schedule" : "started"}.${simulated ? " This run is simulated." : ""}`);

      const finish = (run: RoutineRun, report?: string, error?: string) => {
        controllers.current.delete(id);
        patchRoutine(id, current => ({ history: [...current.history, run], report: report ?? current.report }));
        if (run.status === "failed") {
          patchLive(id, { status: "failed", error });
          setAnnouncement(`${routine.name} failed. ${error ?? run.summary}`);
          return;
        }
        patchLive(id, { status: "idle", error: undefined, streamKey: (liveRef.current[id]?.streamKey ?? 0) + 1 });
        if (report && openRef.current === id) setStreaming(current => ({ ...current, [id]: true }));
        setAnnouncement(`${routine.name} ${run.status === "skipped" ? "skipped" : "succeeded"}: ${run.summary}.${simulated ? " Simulated, nothing was posted to Slack." : ""}`);
      };

      try {
        for (let index = 0; index < steps.length; index += 1) {
          patchLive(id, { step: index });
          if (simulated?.failAt === index) {
            await sleep(680, controller.signal);
            finish({ id: `${id}-${Date.now()}`, status: "failed", at: ranAt, durationMs: Date.now() - startedAt, summary: simulated.summary }, undefined, simulated.error);
            return;
          }
          if (pending && index === steps.length - 1) break;
          await sleep(680, controller.signal);
        }
        if (pending) {
          const resolved = typeof (pending as PromiseLike<RoutineRunResult>).then === "function" ? await (pending as Promise<RoutineRunResult>) : (pending as RoutineRunResult);
          if (controller.signal.aborted) return;
          finish(resolved.run, resolved.report, resolved.run.status === "failed" ? resolved.run.summary : undefined);
          return;
        }
        if (!simulated) return;
        finish({ id: `${id}-${Date.now()}`, status: simulated.status, at: ranAt, durationMs: Date.now() - startedAt, summary: simulated.summary }, simulated.report);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const message = error instanceof Error ? error.message : "The run failed.";
        finish({ id: `${id}-${Date.now()}`, status: "failed", at: ranAt, durationMs: Date.now() - startedAt, summary: message }, undefined, message);
      }
    },
    [onRun, patchLive, patchRoutine],
  );

  const stop = useCallback(
    (id: string) => {
      controllers.current.get(id)?.abort();
      controllers.current.delete(id);
      patchLive(id, { status: "idle" });
      const routine = listRef.current.find(entry => entry.id === id);
      if (routine) setAnnouncement(`${routine.name} stopped. Nothing was posted.`);
    },
    [patchLive],
  );

  useEffect(() => {
    const active = controllers.current;
    return () => {
      active.forEach(controller => controller.abort());
    };
  }, []);

  // A routine that came due while the clock was ticking starts on its own.
  const lastClock = useRef<number | null>(null);
  useEffect(() => {
    if (clock === null) return;
    const previous = lastClock.current;
    lastClock.current = clock;
    if (previous === null || clock - previous > 300000 || clock <= previous) return;
    listRef.current.forEach(routine => {
      if (routine.enabled && nextRun(routine.schedule, previous) <= clock) void start(routine.id, "schedule");
    });
  }, [clock, start]);

  return (
    <section className={[styles.root, className].filter(Boolean).join(" ")} aria-label={title}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.subtitle}>{list.length ? `${enabled} of ${list.length} on schedule` : "Agents that run on a schedule"}</p>
        </div>
        <Button ref={newButton} size="sm" variant="secondary" className={styles.newButton} aria-expanded={composing} aria-controls={composing ? uid : undefined} onClick={() => setComposing(value => !value)}>
          <Plus className={styles.plusIcon} size={14} strokeWidth={1.75} aria-hidden="true" />
          New routine
        </Button>
      </header>
      <Collapse open={composing} reduced={reduced} id={uid}>
        <div className={styles.composerWrap}>
          <Composer
            reduced={reduced}
            onCreate={draft => {
              const slug = draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "routine";
              let id = slug;
              for (let index = 2; list.some(routine => routine.id === id); index += 1) id = `${slug}-${index}`;
              const created: Routine = { ...draft, id, model: "claude-sonnet-5-5", enabled: true, history: [], steps: defaultSteps(draft), accent: (list.length % 4) + 1 };
              setList(current => [created, ...current]);
              setComposing(false);
              onSave?.(created, { created: true });
              setAnnouncement(`Added ${created.name}. ${describeSchedule(created.schedule)}, posts to ${created.destination}.`);
              window.setTimeout(() => rows.current.get(created.id)?.focus({ preventScroll: true }), 80);
            }}
            onCancel={() => {
              setComposing(false);
              newButton.current?.focus({ preventScroll: true });
            }}
          />
        </div>
      </Collapse>
      {list.length ? (
        <ul className={styles.list} aria-label={title}>
          <AnimatePresence initial={false}>
            {list.map(routine => (
              <motion.li
                key={routine.id}
                className={styles.item}
                data-open={openId === routine.id || undefined}
                initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={reduced ? { duration: 0.12 } : { height: WIDTH_SPRING, opacity: { duration: 0.2, ease: EASE } }}
              >
                <RoutineRow
                  ref={node => {
                    if (node) rows.current.set(routine.id, node);
                    else rows.current.delete(routine.id);
                  }}
                  routine={routine}
                  live={live[routine.id] ?? IDLE_RUN}
                  now={clock}
                  reduced={reduced}
                  stepMs={680}
                  open={openId === routine.id}
                  streaming={Boolean(streaming[routine.id])}
                  onOpenChange={next => setOpenId(next ? routine.id : null)}
                  onRun={() => void start(routine.id, "manual")}
                  onStop={() => stop(routine.id)}
                  onToggle={next => {
                    patchRoutine(routine.id, { enabled: next });
                    onToggle?.(routine.id, next);
                    setAnnouncement(next ? `${routine.name} is on. ${describeSchedule(routine.schedule)}.` : `${routine.name} is paused.`);
                  }}
                  onScheduleChange={next => {
                    patchRoutine(routine.id, { schedule: next });
                    onSave?.({ ...routine, schedule: next }, { created: false });
                    setAnnouncement(`Saved. ${routine.name} runs ${describeSchedule(next).replace(/^(Every|Daily|Weekdays)/, value => value.toLowerCase())}.`);
                  }}
                  onStreamDone={() => setStreaming(current => ({ ...current, [routine.id]: false }))}
                  onNavigate={direction => {
                    const index = list.findIndex(entry => entry.id === routine.id);
                    const target = direction === "first" ? 0 : direction === "last" ? list.length - 1 : Math.min(list.length - 1, Math.max(0, index + direction));
                    const next = list[target]?.id;
                    if (next) rows.current.get(next)?.focus();
                  }}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <div className={styles.empty}>
          <CalendarClock className={styles.emptyIcon} size={20} strokeWidth={1.75} aria-hidden="true" />
          <p className={styles.emptyTitle}>No routines yet</p>
          <p className={styles.emptyText}>A routine runs an agent on a schedule and posts what it finds, like a morning triage or a weekly digest.</p>
        </div>
      )}
      <p className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}

export default AgentRoutines;
