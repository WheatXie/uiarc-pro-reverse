"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CSSProperties, ReactNode, SVGProps, SyntheticEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Check,
  CircleAlert,
  CornerDownLeft,
  Download,
  KeyRound,
  Landmark,
  LayoutGrid,
  Link2,
  MessageSquare,
  Plus,
  Receipt,
  RotateCcw,
  ScrollText,
  Search,
  Send,
  Settings,
  SunMoon,
  Undo2,
  UserPlus,
  Users,
  Webhook,
} from "lucide-react";
import { Button } from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./ai-command.module.css";

export type AiCommandMode = "search" | "ask";

export interface AiCommandItem {
  /** Stable id, also used for the row's DOM id. */
  id: string;
  /** Row label, such as “Invoices”. */
  label: string;
  /** Group heading the row sits under. Items without a group land in “Results”. */
  group?: string;
  /** Leading glyph, usually a 16px lucide icon. */
  icon?: ReactNode;
  /** Muted hint after the label, such as “Developers”. */
  meta?: string;
  /** Shortcut rendered as keycaps at the end of the row. */
  shortcut?: string | string[];
  /** Extra words the search matches against. */
  keywords?: string[];
  /** Shows while the query is empty. */
  suggested?: boolean;
  /** Runs when the row is chosen and no `onSelect` is set on the palette. */
  onSelect?: () => void;
}

export interface AiCommandSource {
  /** Stable id, used as the chip's React key. */
  id: string;
  /** Chip label, such as “billing-api #1893”. */
  title: string;
  /** Long form shown in the chip's title and read by screen readers. */
  description?: string;
  /** Small brand mark in front of the title. */
  mark?: ReactNode;
  /** Opens in a new tab instead of calling `onSourceSelect`. */
  href?: string;
}

export interface AiCommandAction {
  /** Stable id. */
  id: string;
  /** Row label, such as “Create issue in Linear”. */
  label: string;
  /** Muted hint after the label. */
  meta?: string;
  /** Leading glyph, usually a brand mark. */
  mark?: ReactNode;
  /** Does the work. Resolve with a done label or nothing; throw to show the error state (Enter retries). */
  run?: (signal: AbortSignal) => Promise<string | void>;
  /** Label while the action is working. */
  runningLabel?: string;
  /** Label once the action resolves without a value. */
  doneLabel?: string;
  /** Label when the action throws. */
  errorLabel?: string;
  /** Muted hint swapped in once the action is done. */
  doneMeta?: string;
}

export interface AiCommandAnswer {
  /** Full answer text. Citations are written as `[1]`, `[2]` and link to `sources`. */
  text?: string;
  /** Sources listed under the answer; citations index into this array. */
  sources?: AiCommandSource[];
  /** Suggested actions listed under the answer. */
  actions?: AiCommandAction[];
}

export interface AiCommandAskContext {
  /** Aborts when the person asks again or goes back. */
  signal: AbortSignal;
  /** Streams a fragment of the answer. */
  append: (text: string) => void;
  /** Shows sources before the answer is finished. */
  setSources: (sources: AiCommandSource[]) => void;
}

export interface AiCommandProps {
  /**
   * Pages and actions to search: `{ id, label, group?, icon?, meta?, shortcut?, keywords?, suggested?, onSelect? }`.
   * Rows marked `suggested` show while the query is empty.
   * @default sample workspace
   */
  items?: AiCommandItem[];
  /** Runs when a page or action is chosen with Enter or a click. Close your dialog or navigate here. */
  onSelect?: (item: AiCommandItem) => void;
  /**
   * Answers a question. Stream text with `append`, show sources early with `setSources`, and resolve with
   * `{ text?, sources?, actions? }`. Throw to show the error state with Retry. The signal aborts when the
   * person asks again or goes back.
   * @default simulated engine
   */
  onAsk?: (question: string, context: AiCommandAskContext) => Promise<AiCommandAnswer | void>;
  /** Runs after a suggested action finishes, with the label it ended on (for example “Created ENG-2481”). */
  onAction?: (action: AiCommandAction, result: string) => void;
  /** Runs when a source chip or citation is chosen. Sources with an `href` open in a new tab instead. */
  onSourceSelect?: (source: AiCommandSource) => void;
  /**
   * Questions offered while Ask AI is open and empty.
   * @default 3 sample questions
   */
  suggestedQuestions?: string[];
  /**
   * The model that answers, shown in the footer, the input and beside each answer.
   * @default { name: "Claude Sonnet 5.5" }
   */
  model?: { name: string; mark?: ReactNode };
  /** @default "search" */
  defaultMode?: AiCommandMode;
  /** @default "" */
  defaultQuery?: string;
  /** Runs when the search / Ask AI toggle changes. */
  onModeChange?: (mode: AiCommandMode) => void;
  /** Escape on an empty search. Use it to close the surrounding dialog. */
  onClose?: () => void;
  /** Copy for the input, per mode. */
  placeholder?: { search?: string; ask?: string };
  /** @default "Searching your workspace" */
  thinkingLabel?: string;
  /**
   * Runs the walkthrough once the palette is on screen.
   * @default true without items and onAsk
   */
  autoPlay?: boolean;
  /**
   * Listens for Cmd+K or Ctrl+K on the page and focuses the input.
   * @default false
   */
  hotkey?: boolean;
  /** @default 392 */
  height?: number;
  /** @default false */
  elevated?: boolean;
  className?: string;
  style?: CSSProperties;
  /** @default "Command palette" */
  "aria-label"?: string;
}

type AnswerStatus = "idle" | "thinking" | "streaming" | "done" | "error";

interface AnswerState {
  status: AnswerStatus;
  question: string;
  sources: AiCommandSource[];
  actions: AiCommandAction[];
  error?: string;
  elapsed?: number;
  text?: string;
}

interface ActionState {
  status: "running" | "done" | "error";
  label: string;
}

type Entry =
  | { kind: "item"; key: string; item: AiCommandItem }
  | { kind: "ask"; key: string; question: string }
  | { kind: "question"; key: string; question: string }
  | { kind: "action"; key: string; action: AiCommandAction };

interface EntryGroup {
  heading?: string;
  entries: Entry[];
}

const ease: [number, number, number, number] = [...motionTokens.ease.standard];

const IDLE_ANSWER: AnswerState = { status: "idle", question: "", sources: [], actions: [] };

const QUESTION_START =
  /^(why|how|what|whats|what's|who|when|where|which|can|could|does|do|did|is|are|was|were|should|will|summari[sz]e|explain|compare|draft|write|list|show me|find)\b/i;

/** Words per streaming tick; the odd cadence is what makes the answer read as it is being written. */
const CHUNK_WORDS = [4, 6, 3, 5, 7, 4, 5, 3, 6];

const SIMULATED_NOTE = "Simulated, nothing was sent";

/* ── brand marks ─────────────────────────────────────────────────────────── */

type MarkProps = Omit<SVGProps<SVGSVGElement>, "title"> & { title?: string };

function markA11y(title?: string) {
  return title ? { role: "img", "aria-label": title } : { "aria-hidden": true as const };
}

function ClaudeMark({ title, ...rest }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="#D97757" {...markA11y(title)} {...rest}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

function LinearMark({ title, ...rest }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="#5E6AD2" {...markA11y(title)} {...rest}>
      <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
    </svg>
  );
}

function NotionMark({ title, ...rest }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...markA11y(title)} {...rest}>
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
    </svg>
  );
}

function GitHubMark({ title, ...rest }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...markA11y(title)} {...rest}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function SlackMark({ title, ...rest }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" {...markA11y(title)} {...rest}>
      <path
        fill="#E01E5A"
        d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"
      />
      <path
        fill="#36C5F0"
        d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"
      />
      <path
        fill="#2EB67D"
        d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"
      />
      <path
        fill="#ECB22E"
        d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"
      />
    </svg>
  );
}

function StripeMark({ title, ...rest }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="#635BFF" {...markA11y(title)} {...rest}>
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
    </svg>
  );
}

function NorthwindMark({ title = "Northwind", ...rest }: MarkProps) {
  const hex = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      role="img"
      aria-label={title}
      {...rest}
    >
      <defs>
        <linearGradient
          id={`${hex}-light`}
          x1="8"
          y1="3"
          x2="8"
          y2="21"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="currentColor" stopOpacity=".42" />
          <stop offset="1" stopColor="currentColor" stopOpacity=".72" />
        </linearGradient>
        <linearGradient
          id={`${hex}-dark`}
          x1="16"
          y1="3"
          x2="16"
          y2="21"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="currentColor" stopOpacity=".88" />
          <stop offset="1" stopColor="currentColor" stopOpacity="1" />
        </linearGradient>
      </defs>
      <path d="M12 2.5 4.75 20.75 12 16.9Z" fill={`url(#${hex}-light)`} />
      <path d="M12 2.5 19.25 20.75 12 16.9Z" fill={`url(#${hex}-dark)`} />
    </svg>
  );
}

const iconProps = { size: 16, strokeWidth: 1.75, "aria-hidden": true as const };
const markSize = { width: 16, height: 16 };
const chipSize = { width: 14, height: 14 };

/* ── sample workspace ────────────────────────────────────────────────────── */

const SAMPLE_ITEMS: AiCommandItem[] = [
  {
    id: "dashboard",
    group: "Pages",
    label: "Dashboard",
    icon: <LayoutGrid {...iconProps} />,
    shortcut: ["G", "D"],
    keywords: ["home", "overview"],
    suggested: true,
  },
  {
    id: "invoices",
    group: "Pages",
    label: "Invoices",
    icon: <Receipt {...iconProps} />,
    shortcut: ["G", "I"],
    keywords: ["billing", "unpaid", "overdue"],
    suggested: true,
  },
  {
    id: "customers",
    group: "Pages",
    label: "Customers",
    icon: <Users {...iconProps} />,
    shortcut: ["G", "C"],
    keywords: ["accounts", "companies"],
    suggested: true,
  },
  {
    id: "payouts",
    group: "Pages",
    label: "Payouts",
    icon: <Landmark {...iconProps} />,
    shortcut: ["G", "P"],
    keywords: ["bank", "transfers"],
  },
  {
    id: "webhooks",
    group: "Pages",
    label: "Webhooks",
    meta: "Developers",
    icon: <Webhook {...iconProps} />,
    keywords: ["events", "endpoints"],
  },
  {
    id: "api-keys",
    group: "Pages",
    label: "API keys",
    meta: "Developers",
    icon: <KeyRound {...iconProps} />,
    keywords: ["tokens", "secret"],
  },
  {
    id: "audit-log",
    group: "Pages",
    label: "Audit log",
    meta: "Settings",
    icon: <ScrollText {...iconProps} />,
    keywords: ["history", "security"],
  },
  {
    id: "billing-settings",
    group: "Pages",
    label: "Billing settings",
    meta: "Settings",
    icon: <Settings {...iconProps} />,
    keywords: ["tax", "currency", "plans"],
  },
  {
    id: "create-invoice",
    group: "Actions",
    label: "Create invoice",
    icon: <Plus {...iconProps} />,
    shortcut: "C",
    keywords: ["new", "bill"],
    suggested: true,
  },
  {
    id: "invite",
    group: "Actions",
    label: "Invite teammate",
    icon: <UserPlus {...iconProps} />,
    shortcut: "mod+shift+I",
    keywords: ["member", "add", "user"],
    suggested: true,
  },
  {
    id: "refund",
    group: "Actions",
    label: "Refund a payment",
    icon: <Undo2 {...iconProps} />,
    keywords: ["return", "chargeback"],
  },
  {
    id: "export",
    group: "Actions",
    label: "Export invoices as CSV",
    icon: <Download {...iconProps} />,
    keywords: ["download", "spreadsheet"],
  },
  {
    id: "theme",
    group: "Actions",
    label: "Switch theme",
    icon: <SunMoon {...iconProps} />,
    shortcut: "mod+shift+L",
    keywords: ["dark", "light", "appearance"],
    suggested: true,
  },
  {
    id: "copy-link",
    group: "Actions",
    label: "Copy page link",
    icon: <Link2 {...iconProps} />,
    shortcut: "mod+shift+C",
    keywords: ["url", "share"],
  },
  {
    id: "linear",
    group: "Connected apps",
    label: "Search Linear issues",
    meta: "Billing team",
    icon: <LinearMark {...markSize} />,
    keywords: ["bugs", "tickets", "eng"],
    suggested: true,
  },
  {
    id: "notion",
    group: "Connected apps",
    label: "Open Notion",
    meta: "Acme wiki",
    icon: <NotionMark {...markSize} />,
    keywords: ["docs", "runbook", "wiki"],
    suggested: true,
  },
  {
    id: "github",
    group: "Connected apps",
    label: "acme/billing-api",
    meta: "GitHub",
    icon: <GitHubMark {...markSize} />,
    keywords: ["repo", "code", "pull requests"],
    suggested: true,
  },
  {
    id: "slack",
    group: "Connected apps",
    label: "#eng-billing",
    meta: "Slack",
    icon: <SlackMark {...markSize} />,
    keywords: ["channel", "chat", "message"],
    suggested: true,
  },
  {
    id: "stripe",
    group: "Connected apps",
    label: "Stripe dashboard",
    meta: "Live mode",
    icon: <StripeMark {...markSize} />,
    keywords: ["payments", "charges"],
  },
];

const SAMPLE_QUESTIONS = [
  "Why did EU invoices fail last night?",
  "Which invoices are overdue?",
  "Who owns the webhooks service?",
];

const DEFAULT_MODEL = { name: "Claude Sonnet 5.5", mark: <ClaudeMark {...markSize} /> };

interface ScriptedAnswer {
  match: (question: string) => boolean;
  sources: AiCommandSource[];
  text: string;
  actions: AiCommandAction[];
}

const SCRIPTED_ANSWERS: ScriptedAnswer[] = [
  {
    match: (question) =>
      /invoice|renewal|charge/.test(question) && /fail|declin|error|why/.test(question),
    sources: [
      {
        id: "stripe-events",
        title: "212 declines",
        description: "Stripe events, 27 Oct 02:00 to 02:40 CET, authentication_required",
        mark: <StripeMark {...chipSize} />,
      },
      {
        id: "pr-1893",
        title: "billing-api #1893",
        description: "GitHub pull request: Skip 3-D Secure for saved cards, merged 26 Oct",
        mark: <GitHubMark {...chipSize} />,
      },
      {
        id: "slack-maya",
        title: "#eng-billing",
        description: "Slack, Maya Chen at 08:15: flag off, retry queued for 14:00",
        mark: <SlackMark {...chipSize} />,
      },
      {
        id: "runbook",
        title: "Failed renewals",
        description: "Notion runbook: Failed renewals and dunning",
        mark: <NotionMark {...chipSize} />,
      },
    ],
    text: "Stripe declined 212 of 1,348 EU renewals between 02:00 and 02:40 CET, all with authentication_required [1]. billing-api v4.12 started skipping 3-D Secure for saved cards, which EU issuers still require under SCA, so the nightly retry charged those cards without a challenge [2]. Maya Chen turned the flag off at 08:15 and queued the 212 invoices for another attempt at 14:00 today [3]. Dunning emails are paused, so no customer has been told yet [4].",
    actions: [
      {
        id: "linear-issue",
        label: "Create issue in Linear",
        meta: "Billing team, links 4 sources",
        mark: <LinearMark {...markSize} />,
        runningLabel: "Creating issue",
        errorLabel: "Couldn't create the issue",
        doneMeta: SIMULATED_NOTE,
        run: (signal) => sleep(950, signal).then(() => "Created ENG-2481"),
      },
      {
        id: "notion-doc",
        label: "Open doc in Notion",
        meta: "Failed renewals runbook",
        mark: <NotionMark {...markSize} />,
        runningLabel: "Opening runbook",
        errorLabel: "Couldn't open the runbook",
        doneLabel: "Opened the runbook",
        doneMeta: "Simulated, no page was opened",
        run: (signal) => sleep(650, signal),
      },
      {
        id: "slack-post",
        label: "Post summary to #eng-billing",
        meta: "As you, with sources",
        mark: <SlackMark {...markSize} />,
        runningLabel: "Posting summary",
        errorLabel: "Couldn't post to Slack",
        doneLabel: "Posted to #eng-billing",
        doneMeta: SIMULATED_NOTE,
        run: (signal) => sleep(800, signal),
      },
    ],
  },
  {
    match: (question) => /overdue|unpaid|outstanding|owe/.test(question),
    sources: [
      {
        id: "aging",
        title: "Aging report",
        description: "Invoices, open and past due, as of 09:30 today",
        mark: <Receipt {...chipSize} />,
      },
      {
        id: "northwind",
        title: "Northwind Logistics",
        description: "Customer: 3 open invoices, last payment 6 October",
        mark: <NorthwindMark {...chipSize} />,
      },
    ],
    text: "41 invoices worth $63,920 are past due as of 09:30 today [1]. The 212 EU renewals queued for 14:00 are not due yet, so they are not in that count. Northwind Logistics owes the most: $8,400 across 3 invoices, the oldest 21 days late [2].",
    actions: [
      {
        id: "remind",
        label: "Send reminders to 41 customers",
        meta: "Uses the friendly reminder template",
        mark: <Send {...iconProps} />,
        runningLabel: "Sending reminders",
        errorLabel: "Couldn't send reminders",
        doneLabel: "Queued 41 reminders",
        doneMeta: SIMULATED_NOTE,
        run: (signal) => sleep(900, signal),
      },
      {
        id: "export-overdue",
        label: "Export overdue invoices as CSV",
        meta: "41 rows",
        mark: <Download {...iconProps} />,
        runningLabel: "Preparing export",
        errorLabel: "Couldn't export",
        doneLabel: "Export ready",
        doneMeta: "Simulated, no file was created",
        run: (signal) => sleep(600, signal),
      },
    ],
  },
  {
    match: (question) => /webhook|owner|owns|codeowners|on call/.test(question),
    sources: [
      {
        id: "codeowners",
        title: "CODEOWNERS",
        description: "acme/billing-api: services/webhooks/ @priya-r @tomas-k",
        mark: <GitHubMark {...chipSize} />,
      },
      {
        id: "rota",
        title: "On-call rota",
        description: "Notion: Payments platform on call, week 44",
        mark: <NotionMark {...chipSize} />,
      },
    ],
    text: "The Payments platform team owns the webhooks service. CODEOWNERS lists Priya Raman and Tomáš Kovač for everything under services/webhooks [1]. Priya is on call this week, through Sunday 1 November [2].",
    actions: [
      {
        id: "slack-dm",
        label: "Message Priya Raman in Slack",
        meta: "Direct message",
        mark: <SlackMark {...markSize} />,
        runningLabel: "Opening conversation",
        errorLabel: "Couldn't reach Slack",
        doneLabel: "Draft opened for Priya",
        doneMeta: SIMULATED_NOTE,
        run: (signal) => sleep(600, signal),
      },
      {
        id: "codeowners-open",
        label: "Open CODEOWNERS on GitHub",
        meta: "acme/billing-api",
        mark: <GitHubMark {...markSize} />,
        runningLabel: "Opening file",
        errorLabel: "Couldn't open GitHub",
        doneLabel: "Opened CODEOWNERS",
        doneMeta: "Simulated, no page was opened",
        run: (signal) => sleep(500, signal),
      },
    ],
  },
];

/* ── simulated engine ────────────────────────────────────────────────────── */

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function createSimulatedEngine({ failures = false }: { failures?: boolean } = {}) {
  let failing = failures;
  const failedActions = new Set<string>();

  return async function answer(
    question: string,
    { signal, setSources }: AiCommandAskContext,
  ): Promise<AiCommandAnswer | void> {
    const scripted = SCRIPTED_ANSWERS.find((candidate) => candidate.match(question.toLowerCase()));
    await sleep(scripted ? 820 : 640, signal);
    if (failing) {
      failing = false;
      throw new Error("The model didn't respond within 30s. Simulated failure, try again.");
    }
    if (!scripted) {
      const quoted =
        question.length > 48 ? `${question.slice(0, 47).trimEnd()}…` : question;
      return {
        text: `Nothing in Stripe, GitHub, Slack or Notion mentions “${quoted}” yet. Try naming a customer, an invoice number or a date, or ask the billing team.`,
        actions: [
          {
            id: "ask-team",
            label: "Ask in #eng-billing",
            meta: "Posts your question as you",
            mark: <SlackMark {...markSize} />,
            runningLabel: "Posting question",
            errorLabel: "Couldn't post to Slack",
            doneLabel: "Asked in #eng-billing",
            doneMeta: SIMULATED_NOTE,
            run: (actionSignal) => sleep(700, actionSignal),
          },
        ],
      };
    }

    setSources(scripted.sources);
    await sleep(260, signal);

    const actions = failing
      ? scripted.actions.map((action) => ({
          ...action,
          run: async (actionSignal: AbortSignal) => {
            if (!failedActions.has(action.id)) {
              failedActions.add(action.id);
              await sleep(700, actionSignal);
              throw new Error("Simulated failure");
            }
            return action.run?.(actionSignal);
          },
        }))
      : scripted.actions;

    return { text: scripted.text, actions };
  };
}

const simulateAnswer = createSimulatedEngine();

/* ── small helpers ───────────────────────────────────────────────────────── */

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function groupEntries(entries: Entry[]): EntryGroup[] {
  const groups: EntryGroup[] = [];
  for (const entry of entries) {
    if (entry.kind !== "item") continue;
    pushEntry(groups, entry.item);
  }
  return groups;
}

function pushEntry(groups: EntryGroup[], item: AiCommandItem) {
  const heading = item.group ?? "Results";
  let group = groups.find((candidate) => candidate.heading === heading);
  if (!group) {
    group = { heading, entries: [] };
    groups.push(group);
  }
  group.entries.push({ kind: "item", key: `item:${item.id}`, item });
}

function scoreItem(item: AiCommandItem, terms: string[]) {
  const label = item.label.toLowerCase();
  const haystack =
    `${item.meta ?? ""} ${item.group ?? ""} ${(item.keywords ?? []).join(" ")}`.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (label.startsWith(term)) score += 4;
    else if (label.split(/[\s/#-]+/).some((word) => word.startsWith(term))) score += 3;
    else if (label.includes(term)) score += 2;
    else {
      if (!haystack.includes(term)) return 0;
      score += 1;
    }
  }
  return score;
}

/** Cuts the next 3–7 words off a stream, keeping a trailing citation with its word. */
function takeChunk(text: string, count: number, producerDone: boolean) {
  const word = /\s*\S+/g;
  let end = 0;
  for (let index = 0; index < count; index++) {
    const match = word.exec(text);
    if (!match) break;
    const next = match.index + match[0].length;
    if (!producerDone && next === text.length) break;
    end = next;
  }
  let marker = /^\s*\[\d+\]\S*/.exec(text.slice(end));
  while (marker && (producerDone || end + marker[0].length !== text.length)) {
    end += marker[0].length;
    marker = /^\s*\[\d+\]\S*/.exec(text.slice(end));
  }
  return producerDone && end === 0 ? text : text.slice(0, end);
}

/* ── keycaps ─────────────────────────────────────────────────────────────── */

type KbdToken = { glyph: string; name: string };

const MAC_QUERY = "(prefers-color-scheme: dark)";

function detectMac() {
  if (typeof navigator === "undefined") return true;
  return /mac|iphone|ipad|ipod/i.test(navigator.userAgent);
}

function subscribeToPlatform() {
  return () => {};
}

function isMacPlatform() {
  return detectMac();
}

function useMacPlatform() {
  return useSyncExternalStore(subscribeToPlatform, isMacPlatform, () => true);
}

const MODIFIER_KEYS: Record<string, { mac: KbdToken; win: KbdToken }> = {
  mod: { mac: { glyph: "⌘", name: "Command" }, win: { glyph: "Ctrl", name: "Control" } },
  cmd: { mac: { glyph: "⌘", name: "Command" }, win: { glyph: "Ctrl", name: "Control" } },
  command: { mac: { glyph: "⌘", name: "Command" }, win: { glyph: "Ctrl", name: "Control" } },
  meta: { mac: { glyph: "⌘", name: "Command" }, win: { glyph: "Win", name: "Windows" } },
  super: { mac: { glyph: "⌘", name: "Command" }, win: { glyph: "Win", name: "Windows" } },
  ctrl: { mac: { glyph: "⌃", name: "Control" }, win: { glyph: "Ctrl", name: "Control" } },
  control: { mac: { glyph: "⌃", name: "Control" }, win: { glyph: "Ctrl", name: "Control" } },
  alt: { mac: { glyph: "⌥", name: "Option" }, win: { glyph: "Alt", name: "Alt" } },
  option: { mac: { glyph: "⌥", name: "Option" }, win: { glyph: "Alt", name: "Alt" } },
  opt: { mac: { glyph: "⌥", name: "Option" }, win: { glyph: "Alt", name: "Alt" } },
  shift: { mac: { glyph: "⇧", name: "Shift" }, win: { glyph: "Shift", name: "Shift" } },
};

const NAMED_KEYS: Record<string, KbdToken> = {
  enter: { glyph: "↵", name: "Return" },
  return: { glyph: "↵", name: "Return" },
  esc: { glyph: "Esc", name: "Escape" },
  escape: { glyph: "Esc", name: "Escape" },
  tab: { glyph: "⇥", name: "Tab" },
  space: { glyph: "␣", name: "Space" },
  backspace: { glyph: "⌫", name: "Backspace" },
  delete: { glyph: "⌦", name: "Delete" },
  del: { glyph: "⌦", name: "Delete" },
  up: { glyph: "↑", name: "Up arrow" },
  arrowup: { glyph: "↑", name: "Up arrow" },
  down: { glyph: "↓", name: "Down arrow" },
  arrowdown: { glyph: "↓", name: "Down arrow" },
  left: { glyph: "←", name: "Left arrow" },
  arrowleft: { glyph: "←", name: "Left arrow" },
  right: { glyph: "→", name: "Right arrow" },
  arrowright: { glyph: "→", name: "Right arrow" },
  pageup: { glyph: "PgUp", name: "Page up" },
  pagedown: { glyph: "PgDn", name: "Page down" },
  home: { glyph: "Home", name: "Home" },
  end: { glyph: "End", name: "End" },
  capslock: { glyph: "⇪", name: "Caps Lock" },
};

function parseKeys(keys: string | string[], mac: boolean): KbdToken[] {
  const list = Array.isArray(keys) ? keys : keys.split("+");
  return list
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const key = raw.toLowerCase();
      const modifier = MODIFIER_KEYS[key];
      if (modifier) return mac ? modifier.mac : modifier.win;
      const named = NAMED_KEYS[key];
      if (named) return named;
      const fn = /^f(\d{1,2})$/.exec(key);
      if (fn) return { glyph: `F${fn[1]}`, name: `F${fn[1]}` };
      if (/^\d$/.test(key)) return { glyph: key, name: key };
      if (key.length === 1) return { glyph: key.toUpperCase(), name: key.toUpperCase() };
      return { glyph: raw, name: raw };
    });
}

interface KbdProps {
  keys: string | string[];
  size?: "sm" | "md";
  pressed?: boolean;
  className?: string;
}

function Kbd({ keys, size = "md", pressed = false, className }: KbdProps) {
  const mac = useMacPlatform();
  const tokens = parseKeys(keys, mac);
  return (
    <kbd className={cx(styles.kbdBase, size === "sm" && styles.kbdSm, className)}>
      {tokens.map((token, index) => (
        <span className={styles.kbdSlot} key={`${token.glyph}-${index}`}>
          {index > 0 && <span className={styles.kbdHidden}> </span>}
          <kbd className={styles.kbdKey} data-pressed={pressed ? "" : undefined}>
            {token.glyph === token.name ? (
              token.glyph
            ) : (
              <>
                <span className={styles.kbdGlyph} aria-hidden="true">
                  {token.glyph}
                </span>
                <span className={styles.kbdHidden}>{token.name}</span>
              </>
            )}
          </kbd>
        </span>
      ))}
    </kbd>
  );
}

/* ── motion bits ─────────────────────────────────────────────────────────── */

function Swap({
  id,
  reduced,
  className,
  children,
}: {
  id: string;
  reduced: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cx(styles.swap, className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={{ opacity: 0, y: reduced ? 0 : 2 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.16, ease } }}
          exit={{ opacity: 0, y: reduced ? 0 : -2, transition: { duration: 0.1, ease } }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function DrawCheck({ reduced, size = 16 }: { reduced: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <motion.path
        d="M3.25 8.5 6.5 11.75 12.75 4.75"
        initial={reduced ? undefined : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.26, ease, delay: 0.03 }}
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className={styles.spinner}
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".22" strokeWidth="1.75" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

interface RowProps {
  id: string;
  entryKey: string;
  active: boolean;
  icon: ReactNode;
  label: ReactNode;
  meta?: ReactNode;
  end?: ReactNode;
  status?: string;
  onHover: () => void;
  onChoose: () => void;
}

function Row({ id, entryKey, active, icon, label, meta, end, status, onHover, onChoose }: RowProps) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      data-key={entryKey}
      data-active={active ? "" : undefined}
      data-status={status}
      className={styles.row}
      onPointerMove={active ? undefined : onHover}
      onPointerDown={(event) => event.preventDefault()}
      onClick={onChoose}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.label}>{label}</span>
      {meta ? <span className={styles.meta}>{meta}</span> : null}
      {end ? <span className={styles.end}>{end}</span> : null}
    </div>
  );
}

/* ── component ───────────────────────────────────────────────────────────── */

export function AiCommand({
  items,
  onSelect,
  onAsk,
  onAction,
  onSourceSelect,
  suggestedQuestions = SAMPLE_QUESTIONS,
  model = DEFAULT_MODEL,
  defaultMode = "search",
  defaultQuery = "",
  onModeChange,
  onClose,
  placeholder,
  thinkingLabel = "Searching your workspace",
  autoPlay,
  hotkey = false,
  height = 392,
  elevated = false,
  className,
  style,
  "aria-label": ariaLabel = "Command palette",
}: AiCommandProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const allItems = items ?? SAMPLE_ITEMS;
  const answerer = onAsk ?? simulateAnswer;

  const [mode, setModeState] = useState<AiCommandMode>(defaultMode);
  const [query, setQuery] = useState(defaultQuery);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<AnswerState>(IDLE_ANSWER);
  const [chunks, setChunks] = useState<string[]>([]);
  const [actionState, setActionState] = useState<Record<string, ActionState>>({});
  const [flash, setFlash] = useState<{ id: number; text: string } | null>(null);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [focusedSource, setFocusedSource] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [interacted, setInteracted] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const answerControllerRef = useRef<AbortController | null>(null);
  const actionControllersRef = useRef(new Map<string, AbortController>());
  const streamedRef = useRef("");
  const cursorRef = useRef(0);
  const producerDoneRef = useRef(false);
  const pendingActionsRef = useRef<AiCommandAction[]>([]);
  const startedAtRef = useRef(0);
  const chunkCountRef = useRef(0);
  const followRef = useRef(true);
  const keyboardScrollRef = useRef(false);
  const highlightSignatureRef = useRef("");
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const answerRef = useRef(answer);
  const actionStateRef = useRef(actionState);
  useLayoutEffect(() => {
    answerRef.current = answer;
    actionStateRef.current = actionState;
  });

  const changeMode = useCallback(
    (next: AiCommandMode) => {
      if (modeRef.current !== next) onModeChange?.(next);
      setModeState(next);
    },
    [onModeChange],
  );

  const announce = useCallback((text: string) => {
    setAnnouncement((current) => (current === text ? `${text}\u00a0` : text));
  }, []);

  const flashMessage = useCallback((text: string) => {
    clearTimeout(flashTimerRef.current ?? undefined);
    setFlash({ id: Date.now(), text });
    flashTimerRef.current = setTimeout(() => setFlash(null), 2200);
  }, []);

  const pressKey = useCallback((key: string) => {
    clearTimeout(pressTimerRef.current ?? undefined);
    setPressedKey(key);
    pressTimerRef.current = setTimeout(() => setPressedKey(null), 160);
  }, []);

  const abortActions = useCallback(() => {
    actionControllersRef.current.forEach((controller) => controller.abort());
    actionControllersRef.current.clear();
  }, []);

  const view: "search" | "prompt" | "answer" =
    mode === "search"
      ? "search"
      : answer.status !== "idle" && query.trim() === answer.question
        ? "answer"
        : "prompt";

  const trimmed = query.trim();
  const isQuestion =
    trimmed.endsWith("?") ||
    (QUESTION_START.test(trimmed) && trimmed.split(/\s+/).length >= 3) ||
    QUESTION_START.test(trimmed);

  const groups = useMemo<EntryGroup[]>(() => {
    if (view === "search") {
      if (!trimmed) {
        const hasSuggested = allItems.some((item) => item.suggested !== undefined);
        return groupEntries(
          allItems
            .filter((item) => !hasSuggested || item.suggested)
            .map((item) => ({ kind: "item", key: `item:${item.id}`, item }) as const),
        );
      }
      const terms = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
      const scored = allItems
        .map((item, itemIndex) => ({ item, index: itemIndex, score: scoreItem(item, terms) }))
        .filter((candidate) => candidate.score > 0);
      const groupScores = new Map<string, number>();
      scored.forEach((candidate) => {
        const heading = candidate.item.group ?? "Results";
        groupScores.set(heading, Math.max(groupScores.get(heading) ?? 0, candidate.score));
      });
      scored.sort(
        (a, b) =>
          (groupScores.get(b.item.group ?? "Results") ?? 0) -
            (groupScores.get(a.item.group ?? "Results") ?? 0) ||
          b.score - a.score ||
          a.index - b.index,
      );
      const results = groupEntries(
        scored.map((candidate) => ({
          kind: "item",
          key: `item:${candidate.item.id}`,
          item: candidate.item,
        })),
      );
      const askGroup: EntryGroup = {
        heading: "Ask AI",
        entries: [{ kind: "ask", key: "ask", question: trimmed }],
      };
      return isQuestion || !results.length ? [askGroup, ...results] : [...results, askGroup];
    }
    if (view === "prompt") {
      const questions = suggestedQuestions.filter(
        (question) => question.toLowerCase() !== trimmed.toLowerCase(),
      );
      return [
        ...(trimmed
          ? [{ entries: [{ kind: "ask", key: "ask", question: trimmed } as Entry] }]
          : []),
        {
          heading: "Try asking",
          entries: questions.map((question) => ({
            kind: "question",
            key: `q:${question}`,
            question,
          })),
        },
      ];
    }
    return answer.status === "done" && answer.actions.length
      ? [
          {
            heading: "Suggested actions",
            entries: answer.actions.map((action) => ({
              kind: "action",
              key: `action:${action.id}`,
              action,
            })),
          },
        ]
      : [];
  }, [view, trimmed, isQuestion, allItems, suggestedQuestions, answer.status, answer.actions]);

  const entries = useMemo(() => groups.flatMap((group) => group.entries), [groups]);
  const activeIndex = entries.length ? Math.min(index, entries.length - 1) : -1;
  const activeEntry = activeIndex >= 0 ? entries[activeIndex] : undefined;
  const entryId = (key: string) => `${uid}-${key.replace(/[^a-z0-9-]/gi, "_")}`;
  const listId = `${uid}-list`;
  const showEmpty = view === "search" && !!trimmed && !isQuestion && entries.length === 1;

  const ask = useCallback(
    (question: string) => {
      const text = question.trim();
      if (!text) return;
      answerControllerRef.current?.abort();
      abortActions();
      const controller = new AbortController();
      answerControllerRef.current = controller;
      streamedRef.current = "";
      cursorRef.current = 0;
      producerDoneRef.current = false;
      pendingActionsRef.current = [];
      startedAtRef.current = performance.now();
      chunkCountRef.current = 0;
      setChunks([]);
      setActionState({});
      setFocusedSource(null);
      setAnswer({ status: "thinking", question: text, sources: [], actions: [] });
      setQuery(text);
      changeMode("ask");
      setIndex(0);
      announce(`Asking: ${text}`);

      const context: AiCommandAskContext = {
        signal: controller.signal,
        append: (fragment) => {
          if (!controller.signal.aborted) streamedRef.current += fragment;
        },
        setSources: (sources) => {
          if (!controller.signal.aborted) setAnswer((current) => ({ ...current, sources }));
        },
      };

      Promise.resolve()
        .then(() => answerer(text, context))
        .then(
          (result) => {
            if (controller.signal.aborted) return;
            if (result?.text && result.text.length > streamedRef.current.length) {
              streamedRef.current = result.text;
            }
            const sources = result?.sources;
            if (sources) setAnswer((current) => ({ ...current, sources }));
            pendingActionsRef.current = result?.actions ?? [];
            producerDoneRef.current = true;
          },
          (error: unknown) => {
            if (controller.signal.aborted) return;
            const message =
              error instanceof Error && error.message
                ? error.message
                : "Something went wrong. Try again.";
            setAnswer((current) => ({ ...current, status: "error", error: message }));
            announce(`Couldn't get an answer. ${message}`);
          },
        );
    },
    [answerer, abortActions, announce, changeMode],
  );

  const streamingPhase = answer.status === "thinking" || answer.status === "streaming";

  useEffect(() => {
    if (!streamingPhase) return;
    const timer = setInterval(() => {
      const pending = streamedRef.current.slice(cursorRef.current);
      if (pending) {
        const piece = takeChunk(
          pending,
          reduced ? 40 : CHUNK_WORDS[chunkCountRef.current++ % CHUNK_WORDS.length],
          producerDoneRef.current,
        );
        if (piece) {
          cursorRef.current += piece.length;
          setChunks((current) => [...current, piece]);
          setAnswer((current) =>
            current.status === "thinking" ? { ...current, status: "streaming" } : current,
          );
          return;
        }
      }
      if (producerDoneRef.current && cursorRef.current >= streamedRef.current.length) {
        const elapsed = performance.now() - startedAtRef.current;
        const actions = pendingActionsRef.current;
        const text = streamedRef.current;
        setAnswer((current) => ({ ...current, status: "done", actions, elapsed, text }));
        setIndex(0);
        announce(
          `Answer ready${actions.length ? `, ${actions.length} suggested action${actions.length === 1 ? "" : "s"}` : ""}. ${text}`,
        );
      }
    }, 34);
    return () => clearInterval(timer);
  }, [streamingPhase, reduced, announce]);

  useEffect(() => {
    if (answer.status === "thinking") followRef.current = true;
  }, [answer.status]);

  useEffect(() => {
    const viewNode = viewRef.current;
    if (!viewNode || !followRef.current || answer.status !== "streaming") return;
    if (viewNode.scrollHeight - viewNode.clientHeight - viewNode.scrollTop > 1) {
      viewNode.scrollTo({ top: viewNode.scrollHeight, behavior: reduced ? "auto" : "smooth" });
    }
  }, [chunks, answer.status, reduced]);

  const runAction = useCallback(
    (action: AiCommandAction) => {
      const current = actionStateRef.current[action.id];
      if (current && current.status !== "error") return;
      const controller = new AbortController();
      actionControllersRef.current.set(action.id, controller);
      setActionState((state) => ({
        ...state,
        [action.id]: { status: "running", label: action.runningLabel ?? action.label },
      }));
      Promise.resolve()
        .then(() => action.run?.(controller.signal))
        .then(
          (result) => {
            if (controller.signal.aborted) return;
            const label = (typeof result === "string" && result) || action.doneLabel || "Done";
            setActionState((state) => ({ ...state, [action.id]: { status: "done", label } }));
            announce(`${label}.${action.doneMeta ? ` ${action.doneMeta}.` : ""}`);
            onAction?.(action, label);
          },
          () => {
            if (controller.signal.aborted) return;
            const label = action.errorLabel ?? `Couldn't finish: ${action.label}`;
            setActionState((state) => ({ ...state, [action.id]: { status: "error", label } }));
            announce(`${label}. Press Enter to try again.`);
          },
        )
        .finally(() => {
          if (actionControllersRef.current.get(action.id) === controller) {
            actionControllersRef.current.delete(action.id);
          }
        });
    },
    [announce, onAction],
  );

  const toAsk = useCallback(() => {
    changeMode("ask");
    setIndex(0);
  }, [changeMode]);

  const backToSearch = useCallback(() => {
    answerControllerRef.current?.abort();
    abortActions();
    setAnswer((current) =>
      current.status === "thinking" || current.status === "streaming" ? IDLE_ANSWER : current,
    );
    changeMode("search");
    setIndex(0);
  }, [abortActions, changeMode]);

  const choose = useCallback(
    (entry?: Entry) => {
      if (!entry) return;
      if (entry.kind === "item") {
        onSelect?.(entry.item);
        entry.item.onSelect?.();
        if (!onSelect && !entry.item.onSelect) {
          flashMessage(`${entry.item.label}, simulated`);
          announce(`${entry.item.label}. Simulated, nothing was opened.`);
        }
        return;
      }
      if (entry.kind === "ask" || entry.kind === "question") {
        ask(entry.question);
        return;
      }
      runAction(entry.action);
    },
    [onSelect, flashMessage, announce, ask, runAction],
  );

  const move = useCallback(
    (delta: number) => {
      if (!entries.length) return;
      keyboardScrollRef.current = true;
      setIndex((current) => (activeIndex + delta + entries.length) % entries.length) ;
    },
    [entries.length, activeIndex],
  );

  useLayoutEffect(() => {
    if (!keyboardScrollRef.current) return;
    keyboardScrollRef.current = false;
    const list = listRef.current;
    const key = activeEntry?.key;
    if (!list || !key) return;
    const row = list.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
    const scroller = row?.closest<HTMLElement>("[data-view]");
    if (!row || !scroller) return;
    const rowBox = row.getBoundingClientRect();
    const scrollerBox = scroller.getBoundingClientRect();
    if (rowBox.top < scrollerBox.top + 8 + 32) {
      scroller.scrollTop -= scrollerBox.top + 8 + 32 - rowBox.top;
    } else if (rowBox.bottom > scrollerBox.bottom - 8) {
      scroller.scrollTop += rowBox.bottom - scrollerBox.bottom + 8;
    }
  });

  const enter = useCallback(() => {
    if (view === "answer" && answer.status === "error") {
      ask(answer.question);
      return;
    }
    if (view === "answer" && answer.status !== "done") return;
    choose(activeEntry);
  }, [view, answer.status, answer.question, ask, choose, activeEntry]);

  const tabBack = useCallback(() => {
    if (mode === "search") {
      if (trimmed) ask(trimmed);
      else toAsk();
      return true;
    }
    if (view === "prompt") {
      backToSearch();
      return true;
    }
    return false;
  }, [mode, trimmed, view, ask, toAsk, backToSearch]);

  const escape = useCallback(() => {
    if (mode === "ask") {
      backToSearch();
      return;
    }
    if (query) {
      setQuery("");
      setIndex(0);
      return;
    }
    onClose?.();
  }, [mode, query, backToSearch, onClose]);

  useEffect(() => {
    if (!hotkey) return;
    const listener = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [hotkey]);

  useEffect(
    () => () => {
      answerControllerRef.current?.abort();
      actionControllersRef.current.forEach((controller) => controller.abort());
      clearTimeout(flashTimerRef.current ?? undefined);
      clearTimeout(pressTimerRef.current ?? undefined);
    },
    [],
  );

  const handlersRef = useRef({ ask, move, enter, escape, press: pressKey, toSearch: backToSearch });
  useLayoutEffect(() => {
    handlersRef.current = { ask, move, enter, escape, press: pressKey, toSearch: backToSearch };
  });

  const autoplay = (autoPlay ?? (!items && !onAsk)) && !interacted && !reduced;

  useEffect(() => {
    if (!autoplay) return;
    const node = rootRef.current;
    if (!node) return;
    let controller: AbortController | null = null;

    const reset = () => {
      answerControllerRef.current?.abort();
      abortActions();
      setAnswer(IDLE_ANSWER);
      setChunks([]);
      setActionState({});
      setQuery("");
      setIndex(0);
      setModeState("search");
    };

    const until = async (condition: () => boolean, signal: AbortSignal, timeout = 8000) => {
      const deadline = performance.now() + timeout;
      while (!condition() && performance.now() < deadline) await sleep(60, signal);
    };

    const type = async (text: string, signal: AbortSignal) => {
      for (let length = 1; length <= text.length; length++) {
        setQuery(text.slice(0, length));
        setIndex(0);
        await sleep(34 + ((17 * length) % 29), signal);
      }
    };

    const step = async (key: string, run: () => void, wait: number, signal: AbortSignal) => {
      handlersRef.current.press(key);
      run();
      await sleep(wait, signal);
    };

    const walkthrough = async (signal: AbortSignal) => {
      while (!signal.aborted) {
        reset();
        await sleep(1100, signal);
        await type("inv", signal);
        await sleep(520, signal);
        await step("down", () => handlersRef.current.move(1), 300, signal);
        await step("down", () => handlersRef.current.move(1), 640, signal);
        setQuery("");
        setIndex(0);
        await sleep(420, signal);
        await type("Why did EU invoices fail last night?", signal);
        await sleep(560, signal);
        await step(
          "tab",
          () => handlersRef.current.ask("Why did EU invoices fail last night?"),
          200,
          signal,
        );
        await until(
          () => answerRef.current.status === "done" || answerRef.current.status === "error",
          signal,
        );
        await sleep(1100, signal);
        const first = answerRef.current.actions[0];
        const second = answerRef.current.actions[1];
        if (first) {
          await step("enter", () => handlersRef.current.enter(), 120, signal);
          await until(() => actionStateRef.current[first.id]?.status !== "running", signal);
          await sleep(900, signal);
        }
        if (second) {
          await step("down", () => handlersRef.current.move(1), 420, signal);
          await step("enter", () => handlersRef.current.enter(), 120, signal);
          await until(() => actionStateRef.current[second.id]?.status !== "running", signal);
        }
        await sleep(2000, signal);
        await step("esc", () => handlersRef.current.toSearch(), 360, signal);
      }
    };

    const start = () => {
      if (controller) return;
      const next = new AbortController();
      controller = next;
      walkthrough(next.signal).catch(() => {});
    };

    const stop = () => {
      controller?.abort();
      controller = null;
    };

    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              if (entry?.isIntersecting) start();
              else {
                stop();
                reset();
              }
            },
            { threshold: 0.35 },
          );

    if (observer) observer.observe(node);
    else start();

    return () => {
      observer?.disconnect();
      stop();
    };
  }, [autoplay, abortActions]);

  const noteInteraction = (event: SyntheticEvent<HTMLDivElement>) => {
    if (autoplay && event.nativeEvent.isTrusted) {
      setInteracted(true);
      setPressedKey(null);
    }
  };

  const signature = `${view}|${entries.map((entry) => entry.key).join(",")}`;

  useLayoutEffect(() => {
    const list = listRef.current;
    const box = highlightRef.current;
    if (!list || !box) return;
    const key = activeEntry?.key;
    const row = key ? list.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`) : null;
    if (!row) {
      box.style.opacity = "0";
      highlightSignatureRef.current = "";
      return;
    }
    const instant = highlightSignatureRef.current !== signature || box.style.opacity !== "1";
    highlightSignatureRef.current = signature;
    if (instant) box.style.transition = "none";
    box.style.transform = `translateY(${row.offsetTop}px)`;
    box.style.height = `${row.offsetHeight}px`;
    box.style.opacity = "1";
    if (instant) {
      void box.offsetHeight;
      box.style.transition = "";
    }
  });

  const inputPlaceholder =
    mode === "search"
      ? (placeholder?.search ?? "Search or ask a question")
      : (placeholder?.ask ?? "Ask anything about your workspace");

  const modelMark = model.mark ?? <ClaudeMark {...markSize} />;

  const openSource = (source: AiCommandSource) => {
    if (source.href) {
      window.open(source.href, "_blank", "noopener,noreferrer");
      return;
    }
    if (onSourceSelect) {
      onSourceSelect(source);
      return;
    }
    flashMessage(`${source.title}, preview simulated`);
    announce(`${source.description ?? source.title}. Simulated, nothing was opened.`);
  };

  const citation = (position: number, key: string | number) => {
    const source = answer.sources[position - 1];
    return (
      <button
        type="button"
        className={styles.cite}
        key={`cite-${key}`}
        data-focused={focusedSource === position ? "" : undefined}
        aria-label={`Source ${position}: ${source.description ?? source.title}`}
        onPointerEnter={() => setFocusedSource(position)}
        onPointerLeave={() => setFocusedSource(null)}
        onFocus={() => setFocusedSource(position)}
        onBlur={() => setFocusedSource(null)}
        onClick={() => openSource(source)}
      >
        {position}
      </button>
    );
  };

  const renderRow = (entry: Entry) => {
    const active = entry.key === activeEntry?.key;
    const shared = {
      id: entryId(entry.key),
      entryKey: entry.key,
      active,
      onHover: () => setIndex(entries.indexOf(entry)),
      onChoose: () => {
        setIndex(entries.indexOf(entry));
        choose(entry);
        inputRef.current?.focus({ preventScroll: true });
      },
    };

    if (entry.kind === "item") {
      return (
        <Row
          {...shared}
          key={entry.key}
          icon={entry.item.icon ?? <CornerDownLeft size={16} strokeWidth={1.75} />}
          label={entry.item.label}
          meta={entry.item.meta}
          end={
            entry.item.shortcut ? (
              <Kbd keys={entry.item.shortcut} size="sm" className={styles.kbd} />
            ) : undefined
          }
        />
      );
    }

    if (entry.kind === "ask") {
      return (
        <Row
          {...shared}
          key={entry.key}
          icon={modelMark}
          label={
            <>
              Ask <span className={styles.quoted}>“{entry.question}”</span>
            </>
          }
          end={
            <Kbd keys={mode === "search" ? "tab" : "enter"} size="sm" className={styles.kbd} />
          }
        />
      );
    }

    if (entry.kind === "question") {
      return (
        <Row
          {...shared}
          key={entry.key}
          icon={<MessageSquare size={16} strokeWidth={1.75} />}
          label={entry.question}
        />
      );
    }

    const state = actionState[entry.action.id];
    const status = state?.status ?? "idle";
    const label = state ? state.label : entry.action.label;
    const meta =
      status === "done"
        ? (entry.action.doneMeta ?? entry.action.meta)
        : status === "error"
          ? "Press Enter to try again"
          : entry.action.meta;
    const statusIcon =
      status === "running" ? (
        <Spinner />
      ) : status === "done" ? (
        <span className={styles.done}>
          <DrawCheck reduced={reduced} />
        </span>
      ) : status === "error" ? (
        <span className={styles.failed}>
          <CircleAlert size={16} strokeWidth={1.75} />
        </span>
      ) : null;

    return (
      <Row
        {...shared}
        key={entry.key}
        status={status}
        icon={entry.action.mark}
        label={<Swap id={`${status}:${label}`} reduced={reduced}>{label}</Swap>}
        meta={meta ? <Swap id={`${status}:${meta}`} reduced={reduced}>{meta}</Swap> : undefined}
        end={
          <span className={styles.statusSlot}>
            <AnimatePresence initial={false} mode="popLayout">
              {statusIcon ? (
                <motion.span
                  key={status}
                  className={styles.statusIcon}
                  initial={{ opacity: 0, scale: reduced ? 1 : 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: reduced ? 1 : 0.7 }}
                  transition={{ duration: 0.14, ease }}
                >
                  {statusIcon}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </span>
        }
      />
    );
  };

  const list = (
    <div
      ref={listRef}
      className={styles.list}
      role="listbox"
      id={listId}
      aria-label={view === "answer" ? "Suggested actions" : view === "prompt" ? "Questions" : "Results"}
    >
      <div ref={highlightRef} className={styles.highlight} aria-hidden="true" />
      {showEmpty ? (
        <div className={styles.empty}>No pages or actions match “{trimmed}”</div>
      ) : null}
      {groups.map((group, groupIndex) => (
        <div
          key={group.heading ?? groupIndex}
          role="group"
          aria-label={group.heading}
          className={styles.group}
        >
          {group.heading ? (
            <div className={styles.groupHead} aria-hidden="true">
              {group.heading}
            </div>
          ) : null}
          {group.entries.map(renderRow)}
        </div>
      ))}
    </div>
  );

  const sourceCount = answer.sources.length;
  const phase: "error" | "done" | "streaming" | "thinking" =
    answer.status === "error"
      ? "error"
      : answer.status === "done"
        ? "done"
        : answer.status === "streaming"
          ? "streaming"
          : "thinking";

  const statusText =
    phase === "error"
      ? "Couldn't get an answer"
      : phase === "done"
        ? sourceCount
          ? `Answered from ${sourceCount} source${sourceCount === 1 ? "" : "s"}`
          : "Answered"
        : phase === "streaming"
          ? sourceCount
            ? `Reading ${sourceCount} source${sourceCount === 1 ? "" : "s"}`
            : "Writing"
          : thinkingLabel;

  const answerText = answer.text ?? "";
  const copyValue = answer.sources.length
    ? `${answerText}

Sources
${answer.sources
  .map(
    (source, index) =>
      `[${index + 1}] ${source.description ?? source.title}${source.href ? ` ${source.href}` : ""}`,
  )
  .join("\n")}`
    : answerText;

  const answerBody = (
    <div className={styles.answer}>
      <div className={styles.status}>
        <span className={cx(styles.icon, phase === "error" && styles.failed)} aria-hidden="true">
          <Swap id={phase === "error" ? "error" : "model"} reduced={reduced}>
            {phase === "error" ? <CircleAlert size={16} strokeWidth={1.75} /> : modelMark}
          </Swap>
        </span>
        <Swap id={statusText} reduced={reduced} className={styles.statusLabel}>
          {phase === "thinking" || phase === "streaming" ? (
            <TextShimmer duration={1.4}>{statusText}</TextShimmer>
          ) : (
            statusText
          )}
        </Swap>
        <span className={styles.statusEnd}>
          {phase === "done" && answer.elapsed !== undefined ? (
            <motion.span
              className={styles.elapsed}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.16 }}
            >
              {`${(answer.elapsed / 1000).toFixed(1)}s`}
            </motion.span>
          ) : null}
          {phase === "done" ? (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.16 }}
              className={styles.copyWrap}
            >
              <CopyButton
                value={copyValue}
                label="Copy answer"
                iconOnly
                variant="plain"
                onCopied={() => announce("Answer copied")}
              />
            </motion.span>
          ) : null}
          {phase === "error" ? (
            <Button
              size="sm"
              variant="secondary"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => {
                ask(answer.question);
                inputRef.current?.focus({ preventScroll: true });
              }}
            >
              <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
              Retry
            </Button>
          ) : null}
        </span>
      </div>
      {sourceCount ? (
        <div className={styles.sources} role="list" aria-label="Sources">
          {answer.sources.map((source, sourceIndex) => (
            <motion.button
              key={source.id}
              type="button"
              role="listitem"
              className={styles.source}
              data-focused={focusedSource === sourceIndex + 1 ? "" : undefined}
              title={source.description ?? source.title}
              aria-label={`Source ${sourceIndex + 1}: ${source.description ?? source.title}`}
              initial={{ opacity: 0, y: reduced ? 0 : 2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.16,
                ease,
                delay: reduced ? 0 : 0.03 * sourceIndex,
              }}
              onPointerEnter={() => setFocusedSource(sourceIndex + 1)}
              onPointerLeave={() => setFocusedSource(null)}
              onFocus={() => setFocusedSource(sourceIndex + 1)}
              onBlur={() => setFocusedSource(null)}
              onClick={() => openSource(source)}
            >
              <span className={styles.sourceNum}>{sourceIndex + 1}</span>
              {source.mark ? (
                <span className={styles.sourceMark} aria-hidden="true">
                  {source.mark}
                </span>
              ) : null}
              <span className={styles.sourceTitle}>{source.title}</span>
            </motion.button>
          ))}
        </div>
      ) : null}
      {phase === "error" ? (
        <p className={styles.errorText}>{answer.error}</p>
      ) : chunks.length ? (
        <p className={styles.text}>
          {chunks.map((chunk, chunkIndex) => {
            const parts: ReactNode[] = [];
            const tokens = chunk.split(/(\[\d+\])/);
            for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
              const token = tokens[tokenIndex];
              const standalone = /^\[(\d+)\]$/.exec(token);
              if (standalone) {
                const position = Number(standalone[1]);
                parts.push(
                  answer.sources[position - 1] ? citation(position, tokenIndex) : token,
                );
                continue;
              }
              const nextCitation = /^\[(\d+)\]$/.exec(tokens[tokenIndex + 1] ?? "");
              if (!nextCitation || !answer.sources[Number(nextCitation[1]) - 1]) {
                if (token) parts.push(token);
                continue;
              }
              const split = /^([\s\S]*?)(\S*)\s*$/.exec(token);
              if (!split) {
                if (token) parts.push(token);
                continue;
              }
              if (split[1]) parts.push(split[1]);
              const trailing = /^[.,;:!?)]+/.exec(tokens[tokenIndex + 2] ?? "")?.[0] ?? "";
              if (trailing) tokens[tokenIndex + 2] = tokens[tokenIndex + 2].slice(trailing.length);
              parts.push(
                <span className={styles.nowrap} key={`w${tokenIndex}`}>
                  {split[2]}
                  {citation(Number(nextCitation[1]), tokenIndex + 1)}
                  {trailing}
                </span>,
              );
              tokenIndex++;
            }
            return (
              <span className={styles.chunk} key={chunkIndex}>
                {parts}
              </span>
            );
          })}
        </p>
      ) : null}
    </div>
  );

  const hints =
    view === "search"
      ? [
          { key: "nav", label: "Navigate" },
          { key: "enter", label: "Open" },
          { key: "tab", label: "Ask AI" },
        ]
      : view === "prompt"
        ? [
            { key: "nav", label: "Navigate" },
            { key: "enter", label: "Ask" },
            { key: "esc", label: "Back" },
          ]
        : [
            { key: "nav", label: "Navigate" },
            { key: "enter", label: answer.status === "error" ? "Retry" : "Run" },
            { key: "esc", label: "Back" },
          ];

  const viewMotion = {
    initial: { opacity: 0, y: reduced ? 0 : 2 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.16, ease } },
    exit: { opacity: 0, transition: { duration: 0.1, ease } },
  };

  return (
    <div
      ref={rootRef}
      className={cx(styles.root, elevated && styles.elevated, className)}
      style={{ ...style, "--aic-height": `${height}px` } as CSSProperties}
      data-mode={mode}
      role="search"
      aria-label={ariaLabel}
      onPointerDownCapture={noteInteraction}
      onKeyDownCapture={noteInteraction}
    >
      <div className={styles.bar}>
        <span className={styles.barIcon} aria-hidden="true">
          <Swap id={mode} reduced={reduced}>
            {mode === "search" ? (
              <Search size={16} strokeWidth={1.75} />
            ) : (
              modelMark
            )}
          </Swap>
        </span>
        <input
          ref={inputRef}
          className={styles.input}
          value={query}
          placeholder={inputPlaceholder}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={mode === "search" ? "Search or ask" : "Ask AI"}
          aria-activedescendant={activeEntry ? entryId(activeEntry.key) : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              move(event.key === "ArrowDown" ? 1 : -1);
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              enter();
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              escape();
              return;
            }
            if (
              event.key === "Tab" &&
              !event.shiftKey &&
              !event.metaKey &&
              !event.ctrlKey &&
              !event.altKey &&
              tabBack()
            ) {
              event.preventDefault();
            }
          }}
        />
        <div className={styles.modes} role="group" aria-label="Mode" data-mode={mode}>
          <span className={styles.modePill} aria-hidden="true" />
          <button
            type="button"
            className={styles.modeButton}
            aria-pressed={mode === "search"}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => {
              if (mode !== "search") backToSearch();
              inputRef.current?.focus({ preventScroll: true });
            }}
          >
            Search
          </button>
          <button
            type="button"
            className={styles.modeButton}
            aria-pressed={mode === "ask"}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => {
              if (mode !== "ask") toAsk();
              inputRef.current?.focus({ preventScroll: true });
            }}
          >
            Ask AI
          </button>
        </div>
      </div>

      <div className={styles.body}>
        <AnimatePresence initial={false}>
          {view === "answer" ? (
            <motion.div
              key="answer"
              ref={viewRef}
              data-view="answer"
              className={styles.view}
              {...viewMotion}
              onWheel={(event) => {
                if (event.deltaY < 0) followRef.current = false;
              }}
              onTouchMove={() => {
                followRef.current = false;
              }}
            >
              {answerBody}
              {groups.length ? (
                <motion.div
                  initial={{ opacity: 0, y: reduced ? 0 : 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease }}
                  className={styles.actions}
                >
                  {list}
                </motion.div>
              ) : null}
            </motion.div>
          ) : (
            <motion.div
              key={view}
              data-view={view}
              className={styles.view}
              {...viewMotion}
            >
              {list}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={styles.footer}>
        <Swap
          id={flash ? `flash:${flash.id}` : "model"}
          reduced={reduced}
          className={styles.footerStart}
        >
          {flash ? (
            <span className={styles.footerItem}>
              <span className={cx(styles.footerIcon, styles.done)}>
                <Check size={14} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className={styles.footerText}>{flash.text}</span>
            </span>
          ) : (
            <span className={styles.footerItem}>
              <span className={styles.footerIcon} aria-hidden="true">
                {modelMark}
              </span>
              <span className={styles.footerText}>{model.name}</span>
            </span>
          )}
        </Swap>
        <Swap
          id={hints.map((hint) => hint.label).join("|")}
          reduced={reduced}
          className={styles.hints}
        >
          <span className={styles.hintRow} aria-hidden="true">
            {hints.map((hint) =>
              hint.key === "nav" ? (
                <span key="nav" className={cx(styles.hint, styles.hintNav)}>
                  <Kbd keys="up" size="sm" pressed={pressedKey === "up"} />
                  <Kbd keys="down" size="sm" pressed={pressedKey === "down"} />
                  {hint.label}
                </span>
              ) : (
                <span key={hint.key} className={styles.hint}>
                  <Kbd keys={hint.key} size="sm" pressed={pressedKey === hint.key} />
                  {hint.label}
                </span>
              ),
            )}
          </span>
        </Swap>
      </div>

      <div className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}

export default AiCommand;

export { createSimulatedEngine };
