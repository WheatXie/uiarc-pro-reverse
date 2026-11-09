"use client";

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type SVGProps,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  Copy,
  Equal,
  Flag,
  LoaderCircle,
  Play,
  RotateCcw,
  Square,
  ThumbsDown,
  TriangleAlert,
  Trophy,
} from "lucide-react";
import Button from "../button/button";
import Switch from "../switch/switch";
import { Popover, PopoverContent, PopoverTrigger } from "../popover/popover";
import AnimatedCounter from "../animated-counter/animated-counter";
import TextShimmer from "../text-shimmer/text-shimmer";
import { writeClipboard } from "../lib/use-copy-feedback";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./model-arena.module.css";

const { spring, duration } = motionTokens;
const fastEase = [...motionTokens.ease.standard] as [
  number,
  number,
  number,
  number,
];
const fade = { duration: duration.fast, ease: fastEase };
const popIn = { duration: 0.16, ease: fastEase };
const popOut = { duration: 0.1, ease: fastEase };
const resizeSpring = { ...spring.smooth, visualDuration: 0.34 };

/* -------------------------------------------------------------------------------------------------
 * Public types
 * -----------------------------------------------------------------------------------------------*/

/** A vendor glyph drawn at 24×24 with `currentColor`; `title` becomes its accessible label. */
export interface ArenaMarkProps extends SVGProps<SVGSVGElement> {
  title?: string;
}

/** One competitor in the pool: what the arena shows and what a token costs. */
export interface ArenaModel {
  /** Stable id, the key standings are stored under. */
  id: string;
  /** Full name, revealed after a vote. */
  name: string;
  /** Shorter name for the narrow layout's tabs. */
  shortName?: string;
  /** Vendor label, read out in the vote result. */
  provider: string;
  /** Mono brand mark; omit to fall back to a letter tile. */
  mark?: ComponentType<ArenaMarkProps>;
  /** Colour of the mark, for vendors whose glyph is monochrome. */
  markColor?: string;
  /** US dollars per million tokens, used for the cost readout. */
  price: { input: number; output: number };
  /** Leaderboard bar colour; a series token such as `var(--series-2)`. */
  color?: string;
}

/** A sample prompt: `label` is the chip, `text` is what gets sent. */
export interface ArenaPrompt {
  id: string;
  label: string;
  text: string;
}

/** One delta from a run: plain text, or text plus the provider's usage numbers. */
export type ArenaStreamEvent =
  string | { text?: string; inputTokens?: number; outputTokens?: number };

/** Streams one model's answer for one prompt; stop when the signal aborts. */
export type ArenaRunner = (
  model: ArenaModel,
  prompt: string,
  signal: AbortSignal,
) => AsyncIterable<ArenaStreamEvent>;

/** A model's standing: wins, ties and losses across the session. */
export interface ArenaStanding {
  wins: number;
  ties: number;
  losses: number;
}

/** Measurements taken from the stream when the vote was cast. */
export interface ArenaVoteMetric {
  model: ArenaModel;
  ttftMs?: number;
  tokensPerSecond?: number;
  totalMs?: number;
  outputTokens: number;
  costUsd: number;
}

/** Everything one vote carries; `models` is [A, B]. */
export interface ArenaVote {
  round: number;
  prompt: string;
  models: [ArenaModel, ArenaModel];
  choice: "a" | "b" | "tie" | "bad";
  winner?: ArenaModel;
  metrics: ArenaVoteMetric[];
}

/** Thrown by a runner to control the pane's error copy; non-retryable hides Retry. */
export class ArenaRunError extends Error {
  readonly retryable: boolean;

  constructor(
    message: string,
    { retryable = true }: { retryable?: boolean } = {},
  ) {
    super(message);
    this.name = "ArenaRunError";
    this.retryable = retryable;
  }
}

/* -------------------------------------------------------------------------------------------------
 * Brand marks
 * -----------------------------------------------------------------------------------------------*/

function AnthropicMark({ title = "Claude", ...props }: ArenaMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-label={title}
      {...props}
    >
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

function OpenAIMark({ title = "OpenAI", ...props }: ArenaMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-label={title}
      {...props}
    >
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

function GeminiMark({ title = "Gemini", ...props }: ArenaMarkProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} {...props}>
      <path
        d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
        fill="#3186FF"
      />
      <path
        d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
        fill={`url(#arena-gemini-0-${uid})`}
      />
      <path
        d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
        fill={`url(#arena-gemini-1-${uid})`}
      />
      <path
        d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
        fill={`url(#arena-gemini-2-${uid})`}
      />
      <defs>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={`arena-gemini-0-${uid}`}
          x1="7"
          x2="11"
          y1="15.5"
          y2="12"
        >
          <stop stopColor="#08B962" />
          <stop offset="1" stopColor="#08B962" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={`arena-gemini-1-${uid}`}
          x1="8"
          x2="11.5"
          y1="5.5"
          y2="11"
        >
          <stop stopColor="#F94543" />
          <stop offset="1" stopColor="#F94543" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={`arena-gemini-2-${uid}`}
          x1="3.5"
          x2="17.5"
          y1="13.5"
          y2="12"
        >
          <stop stopColor="#FABC12" />
          <stop offset=".46" stopColor="#FABC12" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function GrokMark({ title = "Grok", ...props }: ArenaMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      fillRule="evenodd"
      role="img"
      aria-label={title}
      {...props}
    >
      <path d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815" />
    </svg>
  );
}

function DeepSeekMark({ title = "DeepSeek", ...props }: ArenaMarkProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} {...props}>
      <path
        d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z"
        fill="#4D6BFE"
      />
    </svg>
  );
}

function MistralMark({ title = "Mistral AI", ...props }: ArenaMarkProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} {...props}>
      <path
        d="M3.428 3.4h3.429v3.428H3.428V3.4zm13.714 0h3.43v3.428h-3.43V3.4z"
        fill="gold"
      />
      <path
        d="M3.428 6.828h6.857v3.429H3.429V6.828zm10.286 0h6.857v3.429h-6.857V6.828z"
        fill="#FFAF00"
      />
      <path d="M3.428 10.258h17.144v3.428H3.428v-3.428z" fill="#FF8205" />
      <path
        d="M3.428 13.686h3.429v3.428H3.428v-3.428zm6.858 0h3.429v3.428h-3.429v-3.428zm6.856 0h3.43v3.428h-3.43v-3.428z"
        fill="#FA500F"
      />
      <path
        d="M0 17.114h10.286v3.429H0v-3.429zm13.714 0H24v3.429H13.714v-3.429z"
        fill="#E10500"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Data
 * -----------------------------------------------------------------------------------------------*/

const OPUS_COLOR = "#D97757";
const SERIES_3 = "var(--series-3)";
const SERIES_1 = "var(--series-1)";

/** The default pool: seven vendors, prices in dollars per million tokens. */
export const arenaModels: ArenaModel[] = [
  {
    id: "claude-opus-5-5",
    name: "Claude Opus 5.5",
    shortName: "Opus 5.5",
    provider: "Anthropic",
    mark: AnthropicMark,
    markColor: OPUS_COLOR,
    price: { input: 4, output: 20 },
    color: SERIES_3,
  },
  {
    id: "gpt-6-1-sol",
    name: "GPT-6.1 Sol",
    provider: "OpenAI",
    mark: OpenAIMark,
    price: { input: 5, output: 30 },
    color: "var(--series-4)",
  },
  {
    id: "gemini-4-argon",
    name: "Gemini 4 Argon",
    provider: "Google",
    mark: GeminiMark,
    price: { input: 3.5, output: 21 },
    color: SERIES_1,
  },
  {
    id: "grok-4-7",
    name: "Grok 4.7",
    provider: "xAI",
    mark: GrokMark,
    price: { input: 3, output: 15 },
    color: "var(--series-2)",
  },
  {
    id: "claude-sonnet-5-5",
    name: "Claude Sonnet 5.5",
    shortName: "Sonnet 5.5",
    provider: "Anthropic",
    mark: AnthropicMark,
    markColor: OPUS_COLOR,
    price: { input: 2, output: 10 },
    color: SERIES_3,
  },
  {
    id: "deepseek-v4-1-flash",
    name: "DeepSeek V4.1 Flash",
    shortName: "V4.1 Flash",
    provider: "DeepSeek",
    mark: DeepSeekMark,
    price: { input: 0.14, output: 0.56 },
    color: SERIES_1,
  },
  {
    id: "mistral-large-4",
    name: "Mistral Large 4",
    provider: "Mistral AI",
    mark: MistralMark,
    price: { input: 1.5, output: 6 },
    color: SERIES_3,
  },
];

/** The three sample prompts the chips send. */
export const arenaPrompts: ArenaPrompt[] = [
  {
    id: "sql",
    label: "Top customers in SQL",
    text: "Write a Postgres query for the top 5 customers by revenue in Q3 2026, with their order count.",
  },
  {
    id: "mutex",
    label: "Mutex or semaphore",
    text: "Explain the difference between a mutex and a semaphore to a junior engineer, with one example each.",
  },
  {
    id: "decline",
    label: "Decline a meeting",
    text: "Write a short, warm reply to Priya declining Thursday's 3pm roadmap sync, and offer async notes instead.",
  },
];

/** Scripted answers: one markdown answer per prompt per model. */
const scriptedAnswers: Record<string, Record<string, string>> = {
  sql: {
    "claude-opus-5-5": `Here's a query that ranks customers by paid revenue for Q3 2026 (July 1 to September 30):

\`\`\`sql
select
  c.id,
  c.name,
  count(o.id)                as orders,
  sum(o.total_cents) / 100.0 as revenue
from orders o
join customers c on c.id = o.customer_id
where o.status = 'paid'
  and o.created_at >= '2026-07-01'
  and o.created_at <  '2026-10-01'
group by c.id, c.name
order by revenue desc
limit 5;
\`\`\`

A few choices worth checking against your schema:

- **Half-open range.** \`< '2026-10-01'\` keeps every order placed on September 30, which \`between\` would cut off at midnight.
- **Paid orders only.** Refunds and drafts are left out. Drop the status filter if you report gross bookings.
- **Ties.** If two customers share fifth place, swap \`limit 5\` for \`fetch first 5 rows with ties\`.`,
    "gpt-6-1-sol": `\`\`\`sql
with q3 as (
  select customer_id, count(*) as order_count, sum(total_cents) as revenue_cents
  from orders
  where status = 'paid'
    and created_at >= date '2026-07-01'
    and created_at <  date '2026-10-01'
  group by customer_id
)
select c.name, q3.order_count, round(q3.revenue_cents / 100.0, 2) as revenue_usd
from q3
join customers c on c.id = q3.customer_id
order by q3.revenue_cents desc
limit 5;
\`\`\`

**Why a CTE:** orders are aggregated first, so the join touches one row per customer instead of one per order.

**Speed tip:** an index on \`orders (status, created_at) include (customer_id, total_cents)\` turns this into an index-only scan.`,
    "gemini-4-argon": `Sure. Below is a query that returns the five highest-revenue customers for Q3 2026, along with how many orders each placed and their share of the quarter's revenue.

\`\`\`sql
select
  c.name,
  count(*)                                    as orders,
  sum(o.total_cents) / 100.0                  as revenue,
  round(100.0 * sum(o.total_cents)
/ sum(sum(o.total_cents)) over (), 1) as share_pct
from orders o
join customers c on c.id = o.customer_id
where o.status = 'paid'
  and o.created_at >= timestamptz '2026-07-01 00:00 UTC'
  and o.created_at <  timestamptz '2026-10-01 00:00 UTC'
group by c.id, c.name
order by revenue desc
limit 5;
\`\`\`

How it works:

1. **Filter** to paid orders inside the quarter, with explicit UTC boundaries so the result does not shift with the session time zone.
2. **Group** by customer to count orders and sum revenue.
3. **Window** over the grouped rows to get each customer's share of the quarter's total.
4. **Sort and limit** to the top five.

Note that the window is evaluated before \`limit\`, so \`share_pct\` is measured against every customer, not only the top five.`,
    "grok-4-7": `Here you go, no fluff:

\`\`\`sql
select c.name, count(*) as orders, sum(o.total_cents) / 100.0 as revenue
from orders o join customers c on c.id = o.customer_id
where o.created_at >= '2026-07-01' and o.created_at < '2026-10-01'
  and o.status = 'paid'
group by c.name
order by revenue desc
limit 5;
\`\`\`

Heads up: grouping by \`name\` merges two customers who share one. Group by \`c.id\` too if your data has duplicates.`,
    "claude-sonnet-5-5": `\`\`\`sql
select c.id, c.name,
       count(o.id) as orders,
       sum(o.total_cents) / 100.0 as revenue
from customers c
join orders o on o.customer_id = c.id
where o.status = 'paid'
  and o.created_at >= '2026-07-01'
  and o.created_at <  '2026-10-01'
group by c.id, c.name
order by revenue desc
limit 5;
\`\`\`

This assumes amounts are stored in cents and only \`paid\` orders count as revenue. To sanity check it, compare the top five's total with a plain \`sum(total_cents)\` over the same date range.`,
    "deepseek-v4-1-flash": `\`\`\`sql
select c.name, count(o.id) orders, sum(o.total_cents) / 100.0 revenue
from orders o
join customers c on c.id = o.customer_id
where o.status = 'paid'
  and o.created_at >= '2026-07-01' and o.created_at < '2026-10-01'
group by c.id, c.name
order by revenue desc
limit 5;
\`\`\`

Assumes \`total_cents\` and a \`paid\` status.`,
    "mistral-large-4": `The following query uses \`date_trunc\` to select the third quarter of 2026:

\`\`\`sql
select
  c.name,
  count(o.id) as order_count,
  sum(o.total_cents) / 100.0 as revenue
from orders o
join customers c on c.id = o.customer_id
where date_trunc('quarter', o.created_at) = date '2026-07-01'
  and o.status = 'paid'
group by c.id, c.name
order by revenue desc
limit 5;
\`\`\`

It reads well, but wrapping \`created_at\` in a function stops a plain index on that column from being used. On large tables, prefer an explicit range: \`created_at >= '2026-07-01' and created_at < '2026-10-01'\`.`,
  },
  mutex: {
    "claude-opus-5-5": `Both control access to something shared, but they answer different questions.

### Mutex: who holds it
A mutex is a lock with an owner. One thread takes it, does its work, and the same thread releases it. Everyone else waits.

**Example:** two requests updating the same cart. Each takes the cart's mutex, reads, writes, then releases, so neither overwrites the other's change.

### Semaphore: how many may enter
A semaphore is a counter of permits. Any thread can take a permit while one is left, and any thread can return one. It has no owner.

**Example:** your database allows 10 connections. A semaphore of 10 lets ten workers query at once; the eleventh waits until a permit comes back.

A useful rule of thumb: reach for a mutex to protect data, and a semaphore to limit capacity.`,
    "gpt-6-1-sol": `**Mutex:** one at a time, and whoever locks it unlocks it.
**Semaphore:** up to N at a time, and anyone can signal.

- **Ownership:** a mutex belongs to the thread that locked it. A semaphore is just a count.
- **Capacity:** a mutex is effectively 1. A semaphore can be any N.
- **Typical bug:** forgetting to unlock a mutex stalls everyone; releasing a semaphore twice quietly raises the limit.

**Mutex example:** guarding a shared \`Map\` in an in-memory cache so two writers never interleave.

**Semaphore example:** a crawler that allows at most 4 concurrent requests to one site, to stay polite.`,
    "gemini-4-argon": `Great question, and a common source of confusion. A helpful analogy is a coffee shop.

1. **A mutex is the single restroom key.** Whoever has the key goes in; everyone else waits. Only the person holding the key can hand it back.
2. **A semaphore is the count of free tables.** The host tracks a number. While tables are free, people sit down. At zero, new arrivals wait until someone leaves.

### Key differences
- **Count:** a mutex allows exactly one holder. A semaphore allows up to N.
- **Ownership:** a mutex must be released by the thread that acquired it. A semaphore can be released by any thread, which also makes it useful for signaling between threads.
- **Use case:** mutexes protect a critical section. Semaphores manage a pool of identical resources.

### Examples
- **Mutex:** incrementing a shared \`requestCount\` from many threads. Without the lock, two threads can both read 41 and both write 42, and one increment disappears.
- **Semaphore:** a print server with 3 printers. A semaphore initialized to 3 lets three jobs print at once and queues the rest.

One last tip: a semaphore with a count of 1 behaves like a mutex, but without ownership, so it will not catch a thread releasing a lock it never took.`,
    "grok-4-7": `Short version: a mutex is a bathroom lock, a semaphore is a bouncer with a clicker.

**Mutex.** One person in, door locked, and only they can unlock it. Use it when two threads must never touch the same thing at once, like appending to one log file.

**Semaphore.** The bouncer lets in up to N people and counts them out. Use it to cap concurrency, like allowing only 5 image resizes at a time so the server doesn't melt.

If you remember one thing: a mutex says **mine**, a semaphore says **how many**.`,
    "claude-sonnet-5-5": `A **mutex** gives one thread exclusive access and must be released by that same thread. A **semaphore** holds a number of permits that any thread can take or return.

Mutex, protecting a shared balance:

\`\`\`python
lock = threading.Lock()

def deposit(amount):
    with lock:
account.balance += amount
\`\`\`

Semaphore, capping parallel downloads at 3:

\`\`\`python
slots = threading.Semaphore(3)

def download(url):
    with slots:
fetch(url)
\`\`\`

Same shape in code, different intent: the lock keeps one writer at a time, the semaphore keeps three workers at a time.`,
    "deepseek-v4-1-flash": `- **Mutex:** a lock with an owner. One thread at a time. Example: protecting a shared counter.
- **Semaphore:** a counter of permits, no owner. Up to N threads at a time. Example: limiting a pool to 10 database connections.

A binary semaphore is close to a mutex, minus the ownership check.`,
    "mistral-large-4": `A mutex provides mutual exclusion: exactly one thread may hold it, and only that thread may release it. A semaphore maintains a count of available permits and has no notion of ownership.

**Example of a mutex.** A logging service writes entries to one file. Each write acquires the mutex, so lines from different threads never interleave.

**Example of a semaphore.** An API client may send at most 8 requests in parallel. A semaphore initialised to 8 is decremented before each request and incremented after it.

In short, use a mutex for the correctness of shared state and a semaphore to control concurrency.`,
  },
  decline: {
    "claude-opus-5-5": `Hi Priya,

Thanks for pulling the roadmap sync together. I'm going to sit out Thursday at 3pm so I can stay heads down on the billing migration, but I don't want to slow anything down.

I'll leave notes on the three open items in the doc by Wednesday evening, and I'm happy to pick up follow-ups async. If something really needs a live conversation, grab 15 minutes on my calendar Friday morning.

Thanks for understanding,

Sam`,
    "gpt-6-1-sol": `**Option 1, warm**

Hi Priya, thanks for the invite! I can't make Thursday's 3pm sync, but I'll leave my comments on the roadmap doc by Wednesday night so you have them going in. Happy to answer anything async.

**Option 2, shorter**

Hi Priya, I'll skip Thursday's sync to protect some focus time. My notes will be in the doc by Wednesday. Ping me if anything needs me live.`,
    "gemini-4-argon": `Here's a reply that declines clearly while keeping things warm:

**Subject:** Re: Roadmap sync, Thursday 3pm

Hi Priya,

Thank you for including me. Unfortunately I won't be able to join on Thursday at 3pm, as I've blocked that afternoon for the billing migration cutover.

So that my input still makes it into the discussion, I'll add written notes to the roadmap doc by end of day Wednesday, covering the pricing page timeline, the onboarding experiment and the API deprecation dates. Feel free to tag me with questions and I'll reply the same day.

Looking forward to seeing where the group lands.

Best,

Sam

Why this works:
- It gives a specific reason without over-explaining.
- It commits to a concrete deliverable and a deadline.
- It keeps the door open for follow-up.`,
    "grok-4-7":
      "Hey Priya! Going to pass on Thursday's 3pm, my calendar is already a crime scene. I'll drop async notes in the doc before then, so you get my hot takes without me eating 30 minutes of everyone's afternoon. Ping me if anything's on fire.",
    "claude-sonnet-5-5": `Hi Priya,

Thanks for the invite. I won't make Thursday's 3pm sync, but I'll add my notes to the roadmap doc by Wednesday evening so they're ready for the discussion. Feel free to tag me on anything you want my take on.

Thanks,

Sam`,
    "deepseek-v4-1-flash":
      "Hi Priya, thanks for the invite. I can't join Thursday at 3pm, but I'll share my notes in the doc beforehand. Happy to follow up async.",
    "mistral-large-4": `Hi Priya,

Thank you for the invitation to Thursday's roadmap sync. Regrettably, I will not be able to attend at 3pm. I will share my written notes in the roadmap document on Wednesday, so that my points can be discussed in my absence.

Kind regards,

Sam`,
  },
};

interface Pacing {
  ttft: number;
  cps: number;
}

const pacingByModel: Record<string, Pacing> = {
  "claude-opus-5-5": { ttft: 760, cps: 600 },
  "gpt-6-1-sol": { ttft: 560, cps: 620 },
  "gemini-4-argon": { ttft: 980, cps: 640 },
  "grok-4-7": { ttft: 480, cps: 610 },
  "claude-sonnet-5-5": { ttft: 520, cps: 650 },
  "deepseek-v4-1-flash": { ttft: 420, cps: 660 },
  "mistral-large-4": { ttft: 640, cps: 580 },
};

/** Which pair answers which prompt, in order, for the scripted demo. */
const scriptedRounds: { prompt: string; models: [string, string] }[] = [
  { prompt: "sql", models: ["claude-opus-5-5", "gpt-6-1-sol"] },
  { prompt: "mutex", models: ["gemini-4-argon", "grok-4-7"] },
  { prompt: "decline", models: ["mistral-large-4", "claude-sonnet-5-5"] },
];

const fallbackPacing: Pacing = { ttft: 600, cps: 520 };

function jitter(spread: number) {
  return 1 + (2 * Math.random() - 1) * spread;
}

function frameSleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const started = performance.now();
    const step = () => {
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      if (performance.now() - started >= ms) {
        resolve();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/**
 * The scripted runner the demo uses when no `run` is passed: markdown answers typed at a readable
 * pace. One instance lives per component, so the Mistral connection drop fires on its first attempt
 * only and the retry succeeds — exactly like the preview.
 */
function createScriptedRun(): ArenaRunner {
  let failed = false;
  return async function* scripted(model, prompt, signal) {
    const pacing = pacingByModel[model.id] ?? fallbackPacing;
    await frameSleep(pacing.ttft * jitter(0.18), signal);
    const entry = arenaPrompts.find(
      (item) => item.text.trim() === prompt.trim(),
    );
    const script = entry ? scriptedAnswers[entry.id]?.[model.id] : undefined;
    if (!script) {
      throw new ArenaRunError(
        "This preview has scripted answers for the sample prompts only. Pass a run function to stream real models.",
        { retryable: false },
      );
    }
    // Only the first scripted Mistral attempt is cut off; retrying the same pane succeeds.
    const cut =
      failed || model.id !== "mistral-large-4"
        ? -1
        : Math.floor(0.46 * script.length);
    const cps = pacing.cps * jitter(0.04);
    const started = performance.now();
    let sent = 0;
    while (sent < script.length) {
      await frameSleep(30 + 10 * Math.random(), signal);
      const target = Math.floor(((performance.now() - started) / 1000) * cps);
      if (target <= sent) continue;
      let end = Math.min(script.length, target);
      while (end < script.length && !/\s/.test(script[end])) end++;
      if (cut > 0 && end >= cut) {
        failed = true;
        throw new ArenaRunError(
          "The connection closed before the answer finished.",
        );
      }
      yield script.slice(sent, end);
      sent = end;
    }
  };
}

/* -------------------------------------------------------------------------------------------------
 * Small shared hooks
 * -----------------------------------------------------------------------------------------------*/

const subscribePlatform = () => () => {};

function useShortcutHint() {
  return useSyncExternalStore(
    subscribePlatform,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘↵" : "Ctrl ↵"),
    () => "⌘↵",
  );
}

function useMeasuredHeight<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) =>
      setHeight(entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, height };
}

/* -------------------------------------------------------------------------------------------------
 * Streamed markdown
 * -----------------------------------------------------------------------------------------------*/

type Unit =
  | {
      kind: "text";
      text: string;
      bold: boolean;
      space: boolean;
      index: number;
      sentence: number;
    }
  | {
      kind: "code";
      text: string;
      space: boolean;
      index: number;
      sentence: number;
    }
  | { kind: "cite"; n: number; space: boolean; index: number; sentence: number }
  | {
      kind: "line";
      text: string;
      space: boolean;
      index: number;
      sentence: number;
    };

type Block =
  | { kind: "p" | "h"; units: Unit[] }
  | { kind: "code"; lang: string; source: string; units: Unit[] }
  | { kind: "ul" | "ol"; items: Unit[][] };

interface Counter {
  n: number;
}

/** Splits one inline run into word / bold / code / citation units. */
function parseUnits(source: string, counter: Counter): Unit[] {
  const units: Unit[] = [];
  let bold = false;
  let buffer = "";
  let pendingSpace = false;
  let sentence = counter.n;
  let endsSentence = false;
  let i = 0;

  const push = (unit: { kind: Unit["kind"] } & Record<string, unknown>) => {
    if (endsSentence && unit.kind !== "cite") {
      sentence = counter.n;
      endsSentence = false;
    }
    units.push({
      ...(unit as object),
      space: pendingSpace && units.length > 0,
      index: counter.n++,
      sentence,
    } as Unit);
    pendingSpace = false;
    if (unit.kind === "text" && /[.!?]["”)]?$/.test(unit.text as string))
      endsSentence = true;
  };

  const flush = () => {
    for (const word of buffer.split(/(\s+)/)) {
      if (!word) continue;
      if (/^\s+$/.test(word)) pendingSpace = true;
      else push({ kind: "text", text: word, bold });
    }
    buffer = "";
  };

  while (i < source.length) {
    if (source.startsWith("**", i)) {
      flush();
      bold = !bold;
      i += 2;
      continue;
    }
    if (source[i] === "`") {
      flush();
      const close = source.indexOf("`", i + 1);
      if (close === -1) break;
      if (close > i + 1)
        push({ kind: "code", text: source.slice(i + 1, close) });
      i = close + 1;
      continue;
    }
    if (source[i] === "[") {
      const cite = /^\[(\d{1,2})\]/.exec(source.slice(i, i + 4));
      if (cite) {
        flush();
        push({ kind: "cite", n: Number(cite[1]) });
        i += cite[0].length;
        continue;
      }
      if (/^\[\d{0,2}$/.test(source.slice(i))) break;
    }
    buffer += source[i++];
  }
  flush();
  return units;
}

const DANGLING_MARKER = /^\s*(#{1,6}|[-*+]|\d+[.)]?|`{1,3}\w*)\s*$/;

/** Parses revealed markdown into blocks while a trailing marker is still arriving. */
function parseBlocks(
  text: string,
  streaming: boolean,
): { blocks: Block[]; count: number } {
  let source = text;
  if (streaming) {
    const lastBreak = source.lastIndexOf("\n");
    if (DANGLING_MARKER.test(source.slice(lastBreak + 1)))
      source = source.slice(0, lastBreak + 1);
  }
  const counter: Counter = { n: 0 };
  const blocks: Block[] = [];
  const lines = source.split("\n");
  let list: { kind: "ul" | "ol"; items: Unit[][] } | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length)
      blocks.push({
        kind: "p",
        units: parseUnits(paragraph.join(" "), counter),
      });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const fence = /^```(\w*)/.exec(line);
    if (fence) {
      flushParagraph();
      list = null;
      const body: string[] = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]);)
        body.push(lines[i++]);
      const revealed =
        i < lines.length || !streaming ? body : body.slice(0, -1);
      blocks.push({
        kind: "code",
        lang: fence[1],
        source: body.join("\n"),
        units: revealed.map((entry) => ({
          kind: "line",
          text: entry,
          index: counter.n++,
          space: false,
          sentence: -1,
        })),
      });
      continue;
    }
    if (!line) {
      flushParagraph();
      list = null;
      continue;
    }
    const bullet = /^[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const kind = bullet ? "ul" : "ol";
      if (!list || list.kind !== kind) {
        list = { kind, items: [] };
        blocks.push(list);
      }
      list.items.push(parseUnits((bullet ?? numbered)![1], counter));
      continue;
    }
    list = null;
    if (heading) {
      flushParagraph();
      blocks.push({ kind: "h", units: parseUnits(heading[1], counter) });
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  return { blocks, count: counter.n };
}

/** Parses plain text (no markdown) into one paragraph per blank-line-separated run. */
function parsePlain(text: string): { blocks: Block[]; count: number } {
  const counter: Counter = { n: 0 };
  const blocks = text
    .split(/\n{2,}/)
    .filter((entry) => entry.trim())
    .map<Block>((entry) => ({
      kind: "p",
      units: entry
        .trim()
        .split(/\s+/)
        .map((word, index) => ({
          kind: "text",
          text: word,
          bold: false,
          index: counter.n++,
          space: index > 0,
          sentence: -1,
        })),
    }));
  return { blocks, count: counter.n };
}

function snapToWord(text: string, position: number, streaming: boolean) {
  if (position >= text.length && !streaming) return text.length;
  let next = Math.min(Math.floor(position), text.length);
  if (next < text.length && /\s/.test(text[next])) return next;
  while (next > 0 && !/\s/.test(text[next - 1])) next--;
  return next;
}

/** Tracks how much of `text` has been typed out, easing toward the measured arrival rate. */
function useReveal(
  text: string,
  {
    streaming,
    pace = 70,
    enabled = true,
  }: { streaming: boolean; pace?: number; enabled?: boolean },
) {
  const [count, setCount] = useState(() => (streaming ? 0 : text.length));
  const [shown, setShown] = useState(text);
  let seed = count;
  if (shown !== text) {
    setShown(text);
    if (!text.startsWith(shown)) {
      seed = 0;
      setCount(0);
    }
  }
  const revealed = useRef(seed);
  const previous = useRef(text);
  const samples = useRef<[number, number][]>([]);
  const speed = useRef(0);

  useEffect(() => {
    const now = performance.now();
    if (!text.startsWith(previous.current)) {
      revealed.current = 0;
      samples.current = [];
    }
    previous.current = text;
    const recent = samples.current;
    recent.push([now, text.length]);
    while (recent.length > 2 && now - recent[1][0] > 1500) recent.shift();
    if (!enabled) {
      revealed.current = text.length;
      return;
    }
    let frame = 0;
    let last = now;
    let emitted = -1;
    let smoothed = speed.current;
    const tick = (time: number) => {
      const dt = Math.min(0.05, Math.max(0, (time - last) / 1000));
      last = time;
      const remaining = text.length - revealed.current;
      if (remaining > 0) {
        const first = recent[0];
        const newest = recent[recent.length - 1];
        const span = (newest[0] - first[0]) / 1000;
        const rate =
          recent.length > 1 && span > 0.2
            ? Math.max(12, (newest[1] - first[1]) / span)
            : pace;
        const target = streaming
          ? rate *
            Math.min(2.5, Math.max(0.45, remaining / Math.max(1, 0.5 * rate)))
          : Math.max(1.5 * pace, remaining / 0.4);
        smoothed = smoothed
          ? smoothed +
            (target - smoothed) * Math.min(1, dt * (streaming ? 5 : 12))
          : target;
        speed.current = smoothed;
        revealed.current = Math.min(
          text.length,
          revealed.current + smoothed * dt,
        );
      }
      const next = snapToWord(text, revealed.current, streaming);
      if (next !== emitted) {
        emitted = next;
        setCount(next);
      }
      if (revealed.current < text.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, streaming, pace, enabled]);

  const visible = streaming
    ? text.slice(0, Math.min(count, text.length))
    : text;
  return { text: visible, revealing: visible.length < text.length };
}

const CopyStates = ["idle", "copied", "failed"] as const;
type CopyState = (typeof CopyStates)[number];

function DrawnCheck({ reduced }: { reduced: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <motion.path
        d="M4 12l5 5L20 6"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.22, ease: fastEase, delay: 0.04 }}
      />
    </svg>
  );
}

const copyLabels: Record<CopyState, string> = {
  idle: "Copy",
  copied: "Copied",
  failed: "Try again",
};

function CopyLabel({ state }: { state: CopyState }) {
  const reduced = useReducedMotion() ?? false;
  const measures = useRef<Record<string, HTMLSpanElement | null>>({});
  const [widths, setWidths] = useState<Record<string, number>>({});
  useLayoutEffect(() => {
    const measure = () =>
      setWidths(
        Object.fromEntries(
          CopyStates.map((key) => [
            key,
            measures.current[key]?.offsetWidth ?? 0,
          ]),
        ),
      );
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    CopyStates.forEach((key) => {
      const node = measures.current[key];
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, []);
  const width = widths[state];
  return (
    <>
      <span className={styles.streamIconSlot} aria-hidden="true">
        <AnimatePresence initial={false}>
          <motion.span
            key={state}
            data-state={state}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{
              opacity: 0,
              transition: reduced ? { duration: 0 } : popOut,
            }}
            transition={reduced ? { duration: 0 } : popIn}
          >
            {state === "copied" ? (
              <DrawnCheck reduced={reduced} />
            ) : state === "failed" ? (
              <TriangleAlert />
            ) : (
              <Copy />
            )}
          </motion.span>
        </AnimatePresence>
      </span>
      <motion.span
        className={styles.streamSwap}
        aria-hidden="true"
        initial={false}
        animate={{ width }}
        transition={reduced ? { duration: 0 } : spring.snappy}
      >
        {CopyStates.map((key) => (
          <span
            key={key}
            ref={(node) => {
              measures.current[key] = node;
            }}
            className={styles.streamSwapMeasure}
          >
            {copyLabels[key]}
          </span>
        ))}
        <AnimatePresence initial={false}>
          <motion.span
            key={state}
            className={styles.streamSwapText}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{
              opacity: 0,
              transition: reduced ? { duration: 0 } : popOut,
            }}
            transition={reduced ? { duration: 0 } : popIn}
          >
            {copyLabels[state]}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </>
  );
}

function useCopyToClipboard() {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = useCallback(async (value: string) => {
    window.clearTimeout(timer.current);
    try {
      await writeClipboard(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    timer.current = window.setTimeout(() => setState("idle"), 1800);
  }, []);
  return { state, copy };
}

function CodeBlock({
  lang,
  source,
  children,
}: {
  lang: string;
  source: string;
  children: ReactNode;
}) {
  const { state, copy } = useCopyToClipboard();
  return (
    <div className={styles.streamCodeBlock}>
      <div className={styles.streamCodeHeader}>
        <span>{lang || "Code"}</span>
        <button
          type="button"
          className={styles.streamCodeCopy}
          onClick={() => copy(source)}
          aria-label={state === "copied" ? "Code copied" : "Copy code"}
        >
          <CopyLabel state={state} />
        </button>
      </div>
      <pre className={styles.streamPre}>
        <code>{children}</code>
      </pre>
    </div>
  );
}

/** One growth burst's worth of units, animated in as it appears. */
const UnitGroup = memo(
  function UnitGroup({ units, enter }: { units: Unit[]; enter: boolean }) {
    const lead = units[0]?.space && units[0].kind === "cite" ? " " : null;
    return (
      <span className={enter ? styles.streamEnter : undefined}>
        {lead}
        {units.map((unit) => {
          if (unit.kind === "cite") {
            return (
              <span key={unit.index} className={styles.streamCite}>
                <sup>{unit.n}</sup>
              </span>
            );
          }
          if (unit.kind === "line") {
            return (
              <span key={unit.index} className={styles.streamCodeLine}>
                {unit.text || " "}
              </span>
            );
          }
          const content =
            unit.kind === "code" ? (
              <code className={styles.streamInlineCode}>{unit.text}</code>
            ) : unit.bold ? (
              <strong className={styles.streamStrong}>{unit.text}</strong>
            ) : (
              unit.text
            );
          return (
            <span key={unit.index} data-s={unit.sentence}>
              {unit.space ? " " : null}
              {content}
            </span>
          );
        })}
      </span>
    );
  },
  (a, b) =>
    a.enter === b.enter &&
    a.units.length === b.units.length &&
    a.units[0]?.index === b.units[0]?.index,
);

function WaitingDots() {
  return (
    <motion.span
      className={styles.streamWaiting}
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: duration.standard }}
    >
      <span />
    </motion.span>
  );
}

function ListItem({
  enter,
  children,
}: {
  enter: boolean;
  children: ReactNode;
}) {
  const [animate] = useState(enter);
  return (
    <li className={animate ? styles.streamItemEnter : undefined}>{children}</li>
  );
}

interface StreamTextProps {
  text: string;
  streaming?: boolean;
  markdown?: boolean;
  smooth?: boolean;
  pace?: number;
  placeholder?: string;
  className?: string;
}

/** Types text out at the rate it arrived and renders it as markdown while it streams. */
function StreamText({
  text,
  streaming = false,
  markdown = true,
  smooth = true,
  pace,
  placeholder,
  className,
}: StreamTextProps) {
  const reduced = useReducedMotion() ?? false;
  const { text: revealed, revealing } = useReveal(text, {
    streaming,
    pace,
    enabled: smooth,
  });
  const growing = streaming || revealing;
  const { blocks, count } = useMemo(
    () => (markdown ? parseBlocks(revealed, growing) : parsePlain(revealed)),
    [revealed, growing, markdown],
  );

  const [progress, setProgress] = useState(() => ({
    count,
    starts: [0],
    enterFrom: streaming ? 0 : count,
  }));
  let next = progress;
  if (count !== progress.count) {
    next =
      count > progress.count
        ? {
            ...progress,
            count,
            starts:
              progress.starts[progress.starts.length - 1] === progress.count
                ? progress.starts
                : [...progress.starts, progress.count],
          }
        : {
            count,
            starts: progress.starts.filter((start) => start < count),
            enterFrom: Math.min(progress.enterFrom, count),
          };
    setProgress(next);
  }

  const startOf = useCallback(
    (index: number) => {
      let low = 0;
      let high = next.starts.length - 1;
      while (low < high) {
        const mid = (low + high + 1) >> 1;
        if (next.starts[mid] <= index) low = mid;
        else high = mid - 1;
      }
      return next.starts[low];
    },
    [next],
  );

  const renderUnits = useCallback(
    (units: Unit[]) => {
      const groups: { start: number; units: Unit[] }[] = [];
      for (const unit of units) {
        const start = startOf(unit.index);
        const last = groups[groups.length - 1];
        if (last && last.start === start) last.units.push(unit);
        else groups.push({ start, units: [unit] });
      }
      return groups.map((group) => (
        <UnitGroup
          key={group.units[0].index}
          units={group.units}
          enter={!reduced && group.start >= next.enterFrom}
        />
      ));
    },
    [startOf, reduced, next.enterFrom],
  );

  const [settled, setSettled] = useState(-1);
  useEffect(() => {
    if (!streaming || revealing) return;
    const timer = window.setTimeout(() => setSettled(count), 450);
    return () => window.clearTimeout(timer);
  }, [streaming, revealing, count]);

  const waiting = streaming && !revealing && settled === count && count > 0;
  const dots = (
    <AnimatePresence initial={false}>
      {waiting ? <WaitingDots key="wait" /> : null}
    </AnimatePresence>
  );

  const [leadingCopy, setLeadingCopy] = useState(placeholder);
  useEffect(() => {
    setLeadingCopy(placeholder);
  }, [placeholder]);

  const lastIndex = blocks.length - 1;
  const placeholderFade = {
    duration: reduced ? 0 : duration.fast,
    ease: fastEase,
  };

  return (
    <div
      className={[styles.streamStage, className].filter(Boolean).join(" ")}
      aria-busy={growing || undefined}
    >
      <AnimatePresence initial={false}>
        {leadingCopy && streaming && !revealed.trim() ? (
          <motion.div
            key="placeholder"
            className={styles.streamPlaceholder}
            role="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: placeholderFade }}
            transition={placeholderFade}
          >
            {leadingCopy}
          </motion.div>
        ) : null}
      </AnimatePresence>
      {blocks.length ? (
        <div className={markdown ? styles.streamMarkdown : styles.streamPlain}>
          {blocks.map((block, index) => {
            const tail = index === lastIndex ? dots : null;
            if (block.kind === "code") {
              return (
                <CodeBlock
                  key={`c${index}`}
                  lang={block.lang}
                  source={block.source}
                >
                  {renderUnits(block.units)}
                  {tail}
                </CodeBlock>
              );
            }
            if ("items" in block) {
              const Tag = block.kind;
              return (
                <Tag
                  key={`${block.kind}${index}`}
                  className={styles.streamList}
                >
                  {block.items.map((item, itemIndex) => (
                    <ListItem
                      key={itemIndex}
                      enter={
                        !reduced && (item[0]?.index ?? 0) >= next.enterFrom
                      }
                    >
                      {renderUnits(item)}
                      {itemIndex === block.items.length - 1 ? tail : null}
                    </ListItem>
                  ))}
                </Tag>
              );
            }
            if (block.kind === "h") {
              return (
                <h4 key={`h${index}`} className={styles.streamHeading}>
                  {renderUnits(block.units)}
                  {tail}
                </h4>
              );
            }
            return (
              <p key={`p${index}`} className={styles.streamParagraph}>
                {renderUnits(block.units)}
                {tail}
              </p>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Identity, status and metrics
 * -----------------------------------------------------------------------------------------------*/

type PaneStatus =
  "idle" | "waiting" | "streaming" | "done" | "stopped" | "error";

interface PaneError {
  message: string;
  retryable: boolean;
}

interface PaneState {
  slot: number;
  model: ArenaModel;
  status: PaneStatus;
  text: string;
  attempt: number;
  inTokens: number;
  outTokens: number;
  usage: boolean;
  startedAt?: number;
  firstAt?: number;
  endedAt?: number;
  finish?: number;
  error?: PaneError;
}

type VoteChoice =
  { type: "winner"; slot: number } | { type: "tie" } | { type: "bad" };

interface StageState {
  id: number;
  prompt: string;
  started: boolean;
  panes: PaneState[];
  vote?: { choice: VoteChoice; models: [ArenaModel, ArenaModel] };
}

interface Row {
  model: ArenaModel;
  record: ArenaStanding;
  battles: number;
  rate: number;
  color: string;
}

const letter = (slot: number) => String.fromCharCode(65 + slot);
const isRunning = (status: PaneStatus) =>
  status === "waiting" || status === "streaming";

function newPane(slot: number, model: ArenaModel): PaneState {
  return {
    slot,
    model,
    status: "idle",
    text: "",
    attempt: 0,
    inTokens: 0,
    outTokens: 0,
    usage: false,
  };
}

/** Width swaps on a spring as the label changes; the hidden twin keeps the resting width measurable. */
function Swap({
  swapKey,
  children,
  measure,
  reduced,
  className,
}: {
  swapKey: string;
  children: ReactNode;
  measure?: ReactNode;
  reduced: boolean;
  className?: string;
}) {
  const inner = useRef<HTMLSpanElement | null>(null);
  const previousKey = useRef<string | null>(null);
  const [box, setBox] = useState<{ width: number | "auto"; animate: boolean }>({
    width: "auto",
    animate: false,
  });
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const key = node.dataset.key ?? "";
      const changed =
        previousKey.current !== null && previousKey.current !== key;
      previousKey.current = key;
      setBox({
        width: Math.ceil(
          entry.borderBoxSize?.[0]?.inlineSize ?? node.offsetWidth,
        ),
        animate: changed,
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <motion.span
      className={[styles.swap, className].filter(Boolean).join(" ")}
      initial={false}
      animate={{ width: box.width }}
      transition={box.animate && !reduced ? resizeSpring : { duration: 0 }}
    >
      <span
        ref={inner}
        data-key={swapKey}
        className={[styles.swapInner, styles.swapMeasure].join(" ")}
        aria-hidden="true"
      >
        {measure ?? children}
      </span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={swapKey}
          className={styles.swapInner}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{
            opacity: 0,
            transition: { duration: 0.1 * (reduced ? 0 : 1), ease: fastEase },
          }}
          transition={{ duration: reduced ? 0 : fade.duration, ease: fastEase }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}

function ModelMark({
  model,
  className,
}: {
  model: ArenaModel;
  className?: string;
}) {
  const Mark = model.mark;
  if (!Mark) {
    return (
      <span
        className={[styles.markLetter, className].filter(Boolean).join(" ")}
        aria-hidden="true"
      >
        {model.name[0]}
      </span>
    );
  }
  return (
    <Mark
      className={[styles.mark, className].filter(Boolean).join(" ")}
      style={model.markColor ? { color: model.markColor } : undefined}
      aria-hidden="true"
      title={model.name}
    />
  );
}

function Identity({
  model,
  slot,
  revealed,
  reduced,
  short = false,
}: {
  model: ArenaModel;
  slot: number;
  revealed: boolean;
  reduced: boolean;
  short?: boolean;
}) {
  const label = revealed
    ? short
      ? (model.shortName ?? model.name)
      : model.name
    : `Model ${letter(slot)}`;
  return (
    <Swap
      swapKey={revealed ? `model-${model.id}` : `blind-${slot}`}
      reduced={reduced}
      className={styles.identity}
    >
      {revealed ? (
        <span className={styles.identityMark}>
          <ModelMark model={model} />
        </span>
      ) : null}
      <span className={styles.identityName}>{label}</span>
    </Swap>
  );
}

function StatusBadge({
  pane,
  reduced,
  compact = false,
}: {
  pane: PaneState;
  reduced: boolean;
  compact?: boolean;
}) {
  const spinner = <LoaderCircle className={styles.spin} />;
  const state = (() => {
    switch (pane.status) {
      case "waiting":
        return {
          key: "thinking",
          label: "Thinking",
          icon: spinner,
          busy: true,
        };
      case "streaming":
        return { key: "writing", label: "Writing", icon: spinner, busy: true };
      case "done":
        return pane.finish === 1
          ? {
              key: "first",
              label: compact ? "First" : "Finished first",
              icon: <Flag />,
              busy: false,
            }
          : { key: "done", label: "Done", icon: <Check />, busy: false };
      case "stopped":
        return {
          key: "stopped",
          label: "Stopped",
          icon: <Square className={styles.stopGlyph} />,
          busy: false,
        };
      case "error":
        return {
          key: "error",
          label: "Failed",
          icon: <TriangleAlert />,
          busy: false,
        };
      default:
        return { key: "idle", label: "Ready", icon: <Circle />, busy: false };
    }
  })();

  const status = (label: ReactNode) => (
    <span className={styles.status} data-status={state.key}>
      <span className={styles.statusIcon} aria-hidden="true">
        {state.icon}
      </span>
      {label}
    </span>
  );

  return (
    <Swap
      swapKey={state.key}
      reduced={reduced}
      className={[styles.statusSlot, compact && styles.statusCompact]
        .filter(Boolean)
        .join(" ")}
      measure={status(<span>{state.label}</span>)}
    >
      {status(
        state.busy ? (
          <TextShimmer className={styles.statusLabel}>
            {state.label}
          </TextShimmer>
        ) : (
          <span className={styles.statusLabel}>{state.label}</span>
        ),
      )}
    </Swap>
  );
}

interface ComputedMetrics {
  ttft?: number;
  total?: number;
  tps?: number;
  cost: number;
  outTokens: number;
}

function computeMetrics(pane: PaneState, now: number): ComputedMetrics {
  const ended = pane.endedAt ?? now;
  const span = pane.firstAt === undefined ? 0 : ended - pane.firstAt;
  const threshold = pane.status === "streaming" ? 400 : 120;
  return {
    ttft:
      pane.startedAt === undefined
        ? undefined
        : pane.firstAt !== undefined
          ? pane.firstAt - pane.startedAt
          : pane.status === "waiting"
            ? now - pane.startedAt
            : undefined,
    total: pane.startedAt === undefined ? undefined : ended - pane.startedAt,
    tps:
      pane.outTokens > 0 && span > threshold
        ? pane.outTokens / (span / 1e3)
        : undefined,
    cost:
      (pane.inTokens * pane.model.price.input +
        pane.outTokens * pane.model.price.output) /
      1e6,
    outTokens: pane.outTokens,
  };
}

function useTicker(active: boolean, interval = 90) {
  const [now, setNow] = useState(() =>
    typeof performance === "undefined" ? 0 : performance.now(),
  );
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let last = 0;
    const tick = (time: number) => {
      if (time - last >= interval) {
        last = time;
        setNow(time);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, interval]);
  return now;
}

function useLiveMetrics(pane: PaneState, active: boolean, interval = 500) {
  const latest = useRef(pane);
  useEffect(() => {
    latest.current = pane;
  });
  const [sample, setSample] = useState<{
    run?: number;
    value: ComputedMetrics;
  } | null>(null);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let last = -Infinity;
    const tick = (time: number) => {
      if (time - last >= interval) {
        last = time;
        setSample({
          run: latest.current.startedAt,
          value: computeMetrics(latest.current, time),
        });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, interval]);
  return active && sample && sample.run === pane.startedAt
    ? sample.value
    : null;
}

function MetricNumber({
  value,
  decimals = 0,
  prefix,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
}) {
  return (
    <span className={[styles.num, styles.appear].join(" ")}>
      <AnimatedCounter value={value} decimals={decimals} prefix={prefix} />
    </span>
  );
}

function Metrics({ pane }: { pane: PaneState }) {
  const idleNow = useTicker(pane.status === "waiting");
  const live = useLiveMetrics(pane, pane.status === "streaming");
  const metrics =
    live ?? computeMetrics(pane, Math.max(idleNow, pane.startedAt ?? 0));
  const started = pane.startedAt !== undefined;
  const cost = Math.round(1e4 * metrics.cost) / 1e4;
  return (
    <dl
      className={styles.metrics}
      aria-label={`Model ${letter(pane.slot)} metrics`}
    >
      <div className={styles.metric}>
        <dt>First token</dt>
        <dd>
          <span
            className={styles.value}
            data-live={pane.status === "waiting" || undefined}
          >
            {metrics.ttft === undefined
              ? "–"
              : `${(metrics.ttft / 1e3).toFixed(2)}s`}
          </span>
        </dd>
      </div>
      <div className={styles.metric}>
        <dt className={styles.srOnly}>Speed</dt>
        <dd>
          <span className={styles.value} style={{ minWidth: "3ch" }}>
            {metrics.tps === undefined ? (
              "–"
            ) : (
              <MetricNumber value={Math.round(metrics.tps)} />
            )}
          </span>{" "}
          <span className={styles.unit}>tok/s</span>
        </dd>
      </div>
      <div className={styles.metric}>
        <dt className={styles.srOnly}>Cost</dt>
        <dd>
          <span className={styles.value}>
            {started ? (
              <MetricNumber
                value={cost}
                decimals={cost >= 1 ? 2 : 4}
                prefix="$"
              />
            ) : (
              "–"
            )}
          </span>
        </dd>
      </div>
    </dl>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Answer pane
 * -----------------------------------------------------------------------------------------------*/

/** Keeps the newest text in view until the reader scrolls, drags or presses up. */
function useScroller(reduced: boolean) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  const following = useRef(true);
  const frame = useRef(0);

  const toBottom = useCallback(
    (instant = false) => {
      const node = scroller.current;
      if (!node) return;
      cancelAnimationFrame(frame.current);
      const step = () => {
        const max = node.scrollHeight - node.clientHeight;
        const left = max - node.scrollTop;
        if (left > 0.5 && following.current) {
          node.scrollTop =
            instant || reduced
              ? max
              : node.scrollTop + Math.max(1, 0.16 * left);
          frame.current = requestAnimationFrame(step);
        }
      };
      step();
    },
    [reduced],
  );

  useEffect(() => {
    const node = scroller.current;
    const inner = content.current;
    if (!node || !inner) return;
    let dragging = false;
    let lastTop = node.scrollTop;
    let touchY = 0;
    const stop = () => {
      if (!following.current) return;
      following.current = false;
      cancelAnimationFrame(frame.current);
    };
    const onScroll = () => {
      const left = node.scrollHeight - node.clientHeight - node.scrollTop;
      if (dragging && node.scrollTop < lastTop - 1) stop();
      if (left < 6) following.current = true;
      lastTop = node.scrollTop;
    };
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) stop();
    };
    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      if ((event.touches[0]?.clientY ?? 0) > touchY + 2) stop();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        ["ArrowUp", "PageUp", "Home"].includes(event.key) ||
        (event.key === " " && event.shiftKey)
      )
        stop();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target === node) dragging = true;
    };
    const onPointerUp = () => {
      dragging = false;
    };
    const observer = new ResizeObserver(() => {
      if (following.current) toBottom();
      else onScroll();
    });
    observer.observe(inner);
    node.addEventListener("scroll", onScroll, { passive: true });
    node.addEventListener("wheel", onWheel, { passive: true });
    node.addEventListener("touchstart", onTouchStart, { passive: true });
    node.addEventListener("touchmove", onTouchMove, { passive: true });
    node.addEventListener("keydown", onKeyDown);
    node.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      observer.disconnect();
      node.removeEventListener("scroll", onScroll);
      node.removeEventListener("wheel", onWheel);
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchmove", onTouchMove);
      node.removeEventListener("keydown", onKeyDown);
      node.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      cancelAnimationFrame(frame.current);
    };
  }, [toBottom]);

  return { scroller, content };
}

function Pane({
  pane,
  revealed,
  reduced,
  smooth,
  panel,
  onRetry,
  onPromptHelp,
}: {
  pane: PaneState;
  revealed: boolean;
  reduced: boolean;
  smooth: boolean;
  panel?: { id: string; labelledBy: string; active: boolean };
  onRetry: (slot: number) => void;
  onPromptHelp?: () => void;
}) {
  const { scroller, content } = useScroller(reduced);
  const running = isRunning(pane.status);
  const label = `Model ${letter(pane.slot)}`;
  return (
    <section
      className={styles.pane}
      data-slot={pane.slot}
      id={panel?.id}
      role={panel ? "tabpanel" : undefined}
      aria-labelledby={panel?.labelledBy}
      aria-label={
        panel ? undefined : revealed ? `${label}, ${pane.model.name}` : label
      }
      hidden={(panel && !panel.active) || undefined}
    >
      {panel ? null : (
        <header className={styles.paneHead}>
          <Identity
            model={pane.model}
            slot={pane.slot}
            revealed={revealed}
            reduced={reduced}
          />
          <StatusBadge pane={pane} reduced={reduced} />
        </header>
      )}
      <div
        ref={scroller}
        className={styles.scroller}
        tabIndex={0}
        aria-label={`${label} answer`}
        aria-busy={running || undefined}
      >
        <div ref={content} className={styles.content}>
          {pane.status === "idle" && !pane.text ? (
            <p className={styles.empty}>The answer streams here</p>
          ) : null}
          {pane.text ? (
            <StreamText
              text={pane.text}
              streaming={running}
              smooth={smooth}
              className={styles.answer}
            />
          ) : null}
          <AnimatePresence initial={false}>
            {pane.status === "error" && pane.error ? (
              <motion.div
                key={`error-${pane.attempt}`}
                className={styles.error}
                role="alert"
                initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : {
                        ...spring.smooth,
                        opacity: { duration: duration.fast, ease: fastEase },
                      }
                }
              >
                <div className={styles.errorInner}>
                  <p className={styles.errorTitle}>
                    <TriangleAlert aria-hidden="true" />
                    {pane.text ? "Stream interrupted" : "No answer"}
                  </p>
                  <p className={styles.errorText}>{pane.error.message}</p>
                  {pane.error.retryable ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onRetry(pane.slot)}
                    >
                      <RotateCcw aria-hidden="true" />
                      Retry model {letter(pane.slot)}
                    </Button>
                  ) : onPromptHelp ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={onPromptHelp}
                    >
                      Use a sample prompt
                    </Button>
                  ) : null}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
      <Metrics pane={pane} />
    </section>
  );
}

function Tabs({
  id,
  panes,
  active,
  revealed,
  reduced,
  onSelect,
}: {
  id: string;
  panes: PaneState[];
  active: number;
  revealed: boolean[];
  reduced: boolean;
  onSelect: (index: number, focus?: boolean) => void;
}) {
  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const last = panes.length - 1;
    const next =
      event.key === "ArrowRight"
        ? active === last
          ? 0
          : active + 1
        : event.key === "ArrowLeft"
          ? active === 0
            ? last
            : active - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    event.preventDefault();
    onSelect(next, true);
  };
  return (
    <div className={styles.tabs} role="tablist" aria-label="Answers">
      <motion.span
        className={styles.tabHighlight}
        aria-hidden="true"
        initial={false}
        animate={{ x: `${100 * active}%` }}
        transition={
          reduced ? { duration: 0 } : { duration: 0.22, ease: fastEase }
        }
      />
      {panes.map((pane, index) => (
        <button
          key={pane.slot}
          type="button"
          role="tab"
          id={`${id}-tab-${pane.slot}`}
          aria-controls={`${id}-panel-${pane.slot}`}
          aria-selected={index === active}
          tabIndex={index === active ? 0 : -1}
          className={styles.tab}
          data-active={index === active || undefined}
          onClick={() => onSelect(index)}
          onKeyDown={onKeyDown}
        >
          <Identity
            model={pane.model}
            slot={pane.slot}
            revealed={revealed[index]}
            reduced={reduced}
            short
          />
          <StatusBadge pane={pane} reduced={reduced} compact />
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Leaderboard
 * -----------------------------------------------------------------------------------------------*/

const standingsSignature = (rows: Row[]) =>
  rows
    .map(
      (row) =>
        `${row.model.id}:${row.record.wins}/${row.record.ties}/${row.record.losses}`,
    )
    .join();

function StandingsRows({
  shown,
  grow,
  reduced,
}: {
  shown: Row[];
  grow: boolean;
  reduced: boolean;
}) {
  const { ref, height } = useMeasuredHeight<HTMLDivElement>();
  const layout = reduced ? { duration: 0 } : resizeSpring;
  return (
    <motion.div
      className={styles.boardClip}
      initial={false}
      animate={{ height }}
      transition={reduced ? { duration: 0 } : spring.smooth}
    >
      <div ref={ref}>
        {shown.length ? (
          <div className={styles.boardBody}>
            <ol className={styles.ranks} aria-hidden="true">
              {shown.map((row, index) => (
                <li key={row.model.id}>{index + 1}</li>
              ))}
            </ol>
            <ol className={styles.rows}>
              <AnimatePresence initial={false} mode="popLayout">
                {shown.map((row, index) => (
                  <motion.li
                    key={row.model.id}
                    layout="position"
                    className={styles.row}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{
                      opacity: 0,
                      transition: { duration: 0.1 * (reduced ? 0 : 1) },
                    }}
                    transition={{
                      layout,
                      opacity: {
                        duration: reduced ? 0 : duration.fast,
                        ease: fastEase,
                      },
                    }}
                  >
                    <span className={styles.srOnly}>Rank {index + 1}, </span>
                    <ModelMark model={row.model} />
                    <span className={styles.rowName}>{row.model.name}</span>
                    <span className={styles.rateTrack} aria-hidden="true">
                      <motion.span
                        className={styles.rateFill}
                        style={{ background: row.color }}
                        initial={grow ? { scaleX: 0 } : false}
                        animate={{ scaleX: row.rate / 100 }}
                        transition={grow ? { ...layout, delay: 0.12 } : layout}
                      />
                    </span>
                    <span className={[styles.rateValue, styles.num].join(" ")}>
                      <span className={styles.srOnly}>, win rate </span>
                      <AnimatedCounter
                        value={Math.round(row.rate)}
                        suffix="%"
                      />
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          </div>
        ) : (
          <p className={styles.boardEmpty}>
            Vote on a round and the models you judged land here, ranked by win
            rate.
          </p>
        )}
      </div>
    </motion.div>
  );
}

function Leaderboard({
  rows,
  votes,
  fresh,
  before,
  reduced,
  onOpen,
  onReset,
}: {
  rows: Row[];
  votes: number;
  fresh: boolean;
  before: Row[] | null;
  reduced: boolean;
  onOpen: () => void;
  onReset: () => void;
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<Row[] | null>(null);
  const [grow, setGrow] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const shown = (snapshot ?? rows).filter((row) => row.battles > 0).slice(0, 5);
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        window.clearTimeout(timer.current);
        setSnapshot(null);
        setGrow(false);
        if (!next) return;
        onOpen();
        if (reduced || !fresh || !before) return;
        if (before.some((row) => row.battles > 0)) {
          if (standingsSignature(before) !== standingsSignature(rows)) {
            setSnapshot(before);
            timer.current = window.setTimeout(() => setSnapshot(null), 320);
          }
        } else {
          setGrow(true);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={styles.boardButton}
          aria-label={fresh ? "Leaderboard, updated" : "Leaderboard"}
        >
          <span className={styles.boardIcon} aria-hidden="true">
            <Trophy />
            <span className={styles.boardDot} data-on={fresh || undefined} />
          </span>
          <span className={styles.boardLabel}>Leaderboard</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className={styles.board}
        aria-labelledby={titleId}
      >
        <div className={styles.boardHead}>
          <h3 id={titleId} className={styles.boardTitle}>
            Leaderboard
          </h3>
          <span className={styles.boardMeta}>
            {votes === 0
              ? "No votes yet"
              : `${votes} ${votes === 1 ? "vote" : "votes"}`}
          </span>
        </div>
        <StandingsRows shown={shown} grow={grow} reduced={reduced} />
        <div className={styles.boardFoot}>
          <span>A tie counts as half a win</span>
          <Button
            variant="ghost"
            size="sm"
            className={styles.resetButton}
            onClick={onReset}
            disabled={votes === 0}
          >
            <RotateCcw aria-hidden="true" />
            Reset
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Model arena
 * -----------------------------------------------------------------------------------------------*/

function RunLabel({ busy, hint }: { busy: boolean; hint: string }) {
  return (
    <span className={styles.runLabel}>
      <span data-on={!busy || undefined} aria-hidden={busy || undefined}>
        <Play aria-hidden="true" />
        Run
        <span className={styles.hint} aria-hidden="true">
          {hint}
        </span>
      </span>
      <span data-on={busy || undefined} aria-hidden={!busy || undefined}>
        <Square className={styles.stopIcon} aria-hidden="true" />
        Stop
      </span>
    </span>
  );
}

const series = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
];
const zeroRecord: ArenaStanding = { wins: 0, ties: 0, losses: 0 };

const pairFromPanes = (panes: PaneState[]): [ArenaModel, ArenaModel] => [
  panes[0].model,
  panes[1].model,
];

const modelById = (id: string) => arenaModels.find((model) => model.id === id);

/** Picks two distinct contestants, avoiding the pair that just answered when it can. */
function pickPair(
  pool: ArenaModel[],
  avoid: ArenaModel[],
): [ArenaModel, ArenaModel] {
  const key = avoid
    .map((model) => model.id)
    .sort()
    .join();
  for (let attempt = 0; attempt < 12; attempt++) {
    const first = Math.floor(Math.random() * pool.length);
    let second = Math.floor(Math.random() * (pool.length - 1));
    if (second >= first) second++;
    const pair: [ArenaModel, ArenaModel] = [pool[first], pool[second]];
    if (
      pool.length <= 2 ||
      pair
        .map((model) => model.id)
        .sort()
        .join() !== key
    ) {
      return pair;
    }
  }
  return [pool[0], pool[1]];
}

function phrase(choice: VoteChoice, models: [ArenaModel, ArenaModel]) {
  return choice.type === "winner"
    ? `You picked ${models[choice.slot].name}`
    : choice.type === "tie"
      ? "You called it a tie"
      : "You marked both as bad";
}

/**
 * A blind side by side comparison: one prompt, two answers streaming at the same pace, a vote that
 * reveals who wrote each, and a leaderboard of the session's win rates.
 */
export function ModelArena({
  contestants = arenaModels,
  prompts = arenaPrompts,
  run,
  onVote,
  defaultBlind = true,
  autoStart,
  initialStandings,
  className,
}: {
  /** The pool each round draws its blind pair from. */
  contestants?: ArenaModel[];
  /** Sample prompts shown as chips under the field. */
  prompts?: ArenaPrompt[];
  /** Streams one model's answer; without it the scripted preview answers play. */
  run?: ArenaRunner;
  /** Called once per vote with the choice and the stream measurements. */
  onVote?: (vote: ArenaVote) => void;
  /** Hides model names and marks until a vote. */
  defaultBlind?: boolean;
  /** Runs the first round once the card scrolls into view. Defaults to true without `run`. */
  autoStart?: boolean;
  /** Starting records per model id, for a leaderboard loaded from your own store. */
  initialStandings?: Record<string, ArenaStanding>;
  /** Class on the root element. */
  className?: string;
}) {
  const reduced = useReducedMotion() ?? false;
  const hint = useShortcutHint();
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const simulated = !run;
  const isDefault = contestants === arenaModels && prompts === arenaPrompts;
  const [defaultRunner] = useState<ArenaRunner>(createScriptedRun);
  const runner: ArenaRunner = run ?? defaultRunner;
  const runnerRef = useRef(runner);
  useEffect(() => {
    runnerRef.current = runner;
  });

  const [prompt, setPrompt] = useState(
    () =>
      (isDefault
        ? arenaPrompts.find((entry) => entry.id === scriptedRounds[0].prompt)
            ?.text
        : prompts[0]?.text) ?? "",
  );
  const [blind, setBlind] = useState(defaultBlind);
  const [stage, setStage] = useState<StageState>(() => {
    const pair = isDefault ? scriptedRounds[0].models.map(modelById) : [];
    const chosen =
      pair[0] && pair[1]
        ? [pair[0], pair[1]]
        : [contestants[0], contestants[1] ?? contestants[0]];
    return {
      id: 0,
      prompt: "",
      started: false,
      panes: chosen.map((model, index) => newPane(index, model)),
    };
  });
  const [standings, setStandings] = useState<Record<string, ArenaStanding>>(
    () => ({ ...initialStandings }),
  );
  const [votes, setVotes] = useState(0);
  const [fresh, setFresh] = useState(false);
  const [before, setBefore] = useState<Row[] | null>(null);
  const [live, setLive] = useState("");
  const [width, setWidth] = useState(0);
  const [activeTab, setActiveTab] = useState(0);

  const roundRef = useRef({ id: 0, sequence: 0 });
  const controllers = useRef(new Map<number, AbortController>());
  const rootRef = useRef<HTMLDivElement | null>(null);
  const promptRef = useRef<HTMLInputElement | null>(null);
  const runRef = useRef<HTMLButtonElement | null>(null);
  const nextRef = useRef<HTMLButtonElement | null>(null);
  const restoredFocus = useRef(false);

  const running = stage.panes.some((pane) => isRunning(pane.status));

  const pool = useMemo(() => {
    const missing = stage.panes
      .map((pane) => pane.model)
      .filter((model) => !contestants.some((entry) => entry.id === model.id));
    return [...contestants, ...missing];
  }, [contestants, stage.panes]);

  const rows = useMemo(() => {
    const entries = pool.map((model, index) => {
      const record = standings[model.id] ?? zeroRecord;
      const battles = record.wins + record.ties + record.losses;
      return {
        index,
        row: {
          model,
          record,
          battles,
          rate: battles ? ((record.wins + record.ties / 2) / battles) * 100 : 0,
          color: model.color ?? series[index % series.length],
        } satisfies Row,
      };
    });
    entries.sort(
      (a, b) =>
        Number(b.row.battles > 0) - Number(a.row.battles > 0) ||
        b.row.rate - a.row.rate ||
        b.row.record.wins - a.row.record.wins ||
        b.row.battles - a.row.battles ||
        a.index - b.index,
    );
    return entries.map((entry) => entry.row);
  }, [pool, standings]);

  const tabs = width > 0 && width < 560;

  const startRound = useCallback(
    (
      roundId: number,
      slot: number,
      attempt: number,
      model: ArenaModel,
      text: string,
    ) => {
      controllers.current.get(slot)?.abort();
      const controller = new AbortController();
      controllers.current.set(slot, controller);
      const patch = (
        updater: (pane: PaneState, panes: PaneState[]) => PaneState,
      ) =>
        setStage((current) =>
          current.id !== roundId
            ? current
            : {
                ...current,
                panes: current.panes.map((pane) =>
                  pane.slot === slot && pane.attempt === attempt
                    ? updater(pane, current.panes)
                    : pane,
                ),
              },
        );
      const startedAt = performance.now();
      const promptTokens = Math.ceil(text.length / 4) + 12;
      patch((pane) => ({
        ...pane,
        status: "waiting",
        startedAt,
        inTokens: promptTokens,
      }));
      void (async () => {
        try {
          for await (const event of runnerRef.current(
            model,
            text,
            controller.signal,
          )) {
            if (controller.signal.aborted) return;
            const delta =
              typeof event === "string" ? event : (event.text ?? "");
            const meta = typeof event === "string" ? undefined : event;
            const now = performance.now();
            patch((pane) => {
              const next = pane.text + delta;
              const hasOutput = meta?.outputTokens !== undefined;
              return {
                ...pane,
                text: next,
                status: next ? "streaming" : pane.status,
                firstAt: pane.firstAt ?? (delta ? now : undefined),
                inTokens: meta?.inputTokens ?? pane.inTokens,
                outTokens: hasOutput
                  ? (meta.outputTokens as number)
                  : pane.usage
                    ? pane.outTokens
                    : Math.ceil(next.trim().length / 4),
                usage: pane.usage || hasOutput,
              };
            });
          }
          if (controller.signal.aborted) return;
          const endedAt = performance.now();
          patch((pane, panes) =>
            pane.text
              ? {
                  ...pane,
                  status: "done",
                  endedAt,
                  finish: 1 + panes.filter((entry) => entry.finish).length,
                }
              : {
                  ...pane,
                  status: "error",
                  endedAt,
                  error: {
                    message: "The stream ended without an answer.",
                    retryable: true,
                  },
                },
          );
        } catch (error) {
          if (controller.signal.aborted) return;
          const endedAt = performance.now();
          const message =
            error instanceof Error && error.message
              ? error.message
              : "The model did not respond.";
          patch((pane) => ({
            ...pane,
            status: "error",
            endedAt,
            error: {
              message,
              retryable: !(error instanceof ArenaRunError) || error.retryable,
            },
          }));
        } finally {
          if (controllers.current.get(slot) === controller)
            controllers.current.delete(slot);
        }
      })();
    },
    [],
  );

  const abortAll = useCallback(() => {
    controllers.current.forEach((controller) => controller.abort());
    controllers.current.clear();
  }, []);
  useEffect(() => abortAll, [abortAll]);

  const runRound = (text: string, models: [ArenaModel, ArenaModel]) => {
    abortAll();
    const roundId = ++roundRef.current.id;
    const panes = models.map((model, index) => newPane(index, model));
    setStage({ id: roundId, prompt: text, started: true, panes });
    setLive("");
    panes.forEach((pane) =>
      startRound(roundId, pane.slot, 0, pane.model, text),
    );
  };

  const stop = () => {
    abortAll();
    const endedAt = performance.now();
    setStage((current) => ({
      ...current,
      panes: current.panes.map((pane) =>
        isRunning(pane.status) ? { ...pane, status: "stopped", endedAt } : pane,
      ),
    }));
  };

  const submit = (text: string) =>
    runRound(
      text,
      stage.vote
        ? pickPair(pool, stage.vote.models)
        : pairFromPanes(stage.panes),
    );

  const onSubmit = (event?: { preventDefault: () => void }) => {
    event?.preventDefault();
    if (running) {
      stop();
      return;
    }
    const trimmed = prompt.trim();
    if (trimmed) submit(trimmed);
    else promptRef.current?.focus();
  };

  const chooseChip = (text: string) => {
    setPrompt(text);
    submit(text);
  };

  const retry = (slot: number) => {
    const pane = stage.panes.find((entry) => entry.slot === slot);
    if (!pane) return;
    const attempt = pane.attempt + 1;
    setStage((current) => ({
      ...current,
      panes: current.panes.map((entry) =>
        entry.slot === slot
          ? { ...newPane(slot, entry.model), attempt }
          : entry,
      ),
    }));
    startRound(stage.id, slot, attempt, pane.model, stage.prompt);
  };

  const nextRound = () => {
    const sequence = ++roundRef.current.sequence;
    const scheduled = isDefault ? scriptedRounds[sequence] : undefined;
    const scheduledModels = scheduled?.models.map(modelById);
    let models: [ArenaModel, ArenaModel];
    let text: string;
    if (scheduled && scheduledModels?.[0] && scheduledModels[1]) {
      models = [scheduledModels[0], scheduledModels[1]];
      text =
        arenaPrompts.find((entry) => entry.id === scheduled.prompt)?.text ??
        prompt;
    } else {
      models = pickPair(pool, pairFromPanes(stage.panes));
      const index = prompts.findIndex((entry) => entry.text === prompt.trim());
      text = prompts.length
        ? prompts[(index + 1) % prompts.length].text
        : prompt;
    }
    setPrompt(text);
    runRound(text, models);
    runRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!stage.vote || !restoredFocus.current) return;
    restoredFocus.current = false;
    nextRef.current?.focus({ preventScroll: true });
  }, [stage.vote]);

  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    setWidth(node.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const auto = autoStart ?? simulated;
  useEffect(() => {
    const node = rootRef.current;
    if (!auto || !node || typeof IntersectionObserver === "undefined") return;
    let timer = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        timer = window.setTimeout(() => {
          if (roundRef.current.id === 0) onSubmit();
        }, 420);
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
    // The auto-start only fires for the initial round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  const useSample = () => {
    const first = prompts[0];
    if (first) chooseChip(first.text);
  };

  const revealed = !blind || !!stage.vote;
  const done = stage.panes.filter((pane) => pane.status === "done").length;
  const kind = !stage.started
    ? "idle"
    : stage.vote
      ? "voted"
      : running
        ? "pending"
        : stage.panes.some((pane) => pane.status === "error")
          ? "failed"
          : stage.panes.some((pane) => pane.status === "stopped")
            ? "stopped"
            : stage.panes.every((pane) => pane.status === "done")
              ? "vote"
              : "pending";
  const voteClip = useMeasuredHeight<HTMLDivElement>();
  const voteFade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: {
      opacity: 0,
      transition: { duration: 0.1 * (reduced ? 0 : 1), ease: fastEase },
    },
    transition: { duration: reduced ? 0 : duration.fast, ease: fastEase },
  };

  const voteOptions = [
    {
      choice: { type: "winner", slot: 0 } as VoteChoice,
      label: "A is better",
      before: <ArrowLeft aria-hidden="true" />,
    },
    {
      choice: { type: "tie" } as VoteChoice,
      label: "Tie",
      before: <Equal aria-hidden="true" />,
    },
    {
      choice: { type: "winner", slot: 1 } as VoteChoice,
      label: "B is better",
      after: <ArrowRight aria-hidden="true" />,
    },
    {
      choice: { type: "bad" } as VoteChoice,
      label: "Both bad",
      before: <ThumbsDown aria-hidden="true" />,
    },
  ];

  const castVote = (choice: VoteChoice) => {
    if (stage.vote || running) return;
    const pair = pairFromPanes(stage.panes);
    const nextStandings = { ...standings };
    pair.forEach((model, index) => {
      const record = { ...(nextStandings[model.id] ?? zeroRecord) };
      if (choice.type === "winner") {
        if (index === choice.slot) record.wins++;
        else record.losses++;
      } else if (choice.type === "tie") record.ties++;
      else record.losses++;
      nextStandings[model.id] = record;
    });
    setBefore(rows);
    setStandings(nextStandings);
    setVotes((count) => count + 1);
    setFresh(true);
    setStage((current) => ({ ...current, vote: { choice, models: pair } }));
    restoredFocus.current = !!rootRef.current
      ?.querySelector("[data-vote-group]")
      ?.contains(document.activeElement);
    const now = performance.now();
    onVote?.({
      round: stage.id,
      prompt: stage.prompt,
      models: pair,
      choice:
        choice.type === "winner"
          ? choice.slot === 0
            ? "a"
            : "b"
          : choice.type,
      winner: choice.type === "winner" ? pair[choice.slot] : undefined,
      metrics: stage.panes.map((pane) => {
        const metrics = computeMetrics(pane, now);
        return {
          model: pane.model,
          ttftMs: metrics.ttft,
          tokensPerSecond: metrics.tps,
          totalMs: metrics.total,
          outputTokens: metrics.outTokens,
          costUsd: metrics.cost,
        };
      }),
    });
  };

  let voteBar: ReactNode;
  if (kind === "vote") {
    voteBar = (
      <motion.div
        key="vote"
        className={styles.voteRow}
        data-kind="vote"
        {...voteFade}
      >
        <p className={styles.voteLabel} id={`${id}-vote`}>
          Which answer is better?
        </p>
        <div
          className={styles.voteGroup}
          role="group"
          aria-labelledby={`${id}-vote`}
          data-vote-group=""
        >
          {voteOptions.map((option) => (
            <Button
              key={option.label}
              variant="secondary"
              size="sm"
              className={styles.voteButton}
              onClick={() => castVote(option.choice)}
            >
              {option.before ?? null}
              {option.label}
              {option.after ?? null}
            </Button>
          ))}
        </div>
      </motion.div>
    );
  } else if (kind === "voted" && stage.vote) {
    const { choice, models } = stage.vote;
    const winner = choice.type === "winner" ? models[choice.slot] : undefined;
    voteBar = (
      <motion.div
        key="voted"
        className={styles.voteRow}
        data-kind="voted"
        {...voteFade}
      >
        <p className={styles.result}>
          <Check className={styles.resultIcon} aria-hidden="true" />
          <span className={styles.resultText}>
            {winner ? (
              <>
                You picked
                <span className={styles.resultName}>
                  <ModelMark model={winner} />
                  {winner.name}
                </span>
              </>
            ) : (
              phrase(choice, models)
            )}
          </span>
        </p>
        <Button
          ref={nextRef}
          size="sm"
          className={[styles.accent, styles.nextButton].join(" ")}
          onClick={nextRound}
        >
          Next round
          <ArrowRight aria-hidden="true" />
        </Button>
      </motion.div>
    );
  } else if (kind === "failed") {
    const failed = stage.panes.filter((pane) => pane.status === "error");
    const retryable = failed.some((pane) => pane.error?.retryable);
    voteBar = (
      <motion.div
        key="failed"
        className={styles.voteRow}
        data-kind="failed"
        {...voteFade}
      >
        <p className={styles.voteLabel}>
          Model {failed.map((pane) => letter(pane.slot)).join(" and ")} failed.
          {retryable ? " Retry to vote, or move on." : ""}
        </p>
        <Button
          variant="secondary"
          size="sm"
          className={styles.nextButton}
          onClick={nextRound}
        >
          Next round
          <ArrowRight aria-hidden="true" />
        </Button>
      </motion.div>
    );
  } else if (kind === "stopped") {
    voteBar = (
      <motion.div
        key="stopped"
        className={styles.voteRow}
        data-kind="stopped"
        {...voteFade}
      >
        <p className={styles.voteLabel}>Stopped before both answers finished</p>
        <Button variant="secondary" size="sm" onClick={() => onSubmit()}>
          <RotateCcw aria-hidden="true" />
          Run again
        </Button>
      </motion.div>
    );
  } else if (kind === "pending") {
    voteBar = (
      <motion.div
        key="pending"
        className={styles.voteRow}
        data-kind="pending"
        {...voteFade}
      >
        <p className={styles.voteLabel}>
          Voting opens when both answers finish
          <span className={styles.voteCount}>{done} of 2 done</span>
        </p>
      </motion.div>
    );
  } else {
    voteBar = (
      <motion.div
        key="idle"
        className={styles.voteRow}
        data-kind="idle"
        {...voteFade}
      >
        <p className={styles.voteLabel}>
          Run a prompt, then vote for the better answer
        </p>
      </motion.div>
    );
  }

  const active = Math.min(activeTab, 1);

  const statusMessage = () => {
    if (!stage.started) return "";
    const { panes } = stage;
    if (stage.vote) {
      return `${phrase(stage.vote.choice, stage.vote.models)}. Model A was ${stage.vote.models[0].name} and model B was ${stage.vote.models[1].name}. Leaderboard updated.`;
    }
    const busy = panes.filter((pane) => isRunning(pane.status));
    const errors = panes.filter((pane) => pane.status === "error");
    if (busy.length === panes.length) {
      return `${simulated ? "Simulated run with scripted sample answers. " : ""}Two anonymous models are answering.`;
    }
    if (errors.length) {
      return `Model ${errors.map((pane) => letter(pane.slot)).join(" and ")} failed.${busy.length ? "" : " Retry to vote, or start the next round."}`;
    }
    const first = panes.find((pane) => pane.finish === 1);
    if (busy.length)
      return first ? `Model ${letter(first.slot)} finished first.` : "";
    if (panes.some((pane) => pane.status === "stopped")) return "Run stopped.";
    return "Both answers are ready. Vote to reveal the models.";
  };

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
    >
      <header className={styles.head}>
        <h2 className={styles.title}>Arena</h2>
        <span className={styles.round}>
          <span>
            {"Round "}
            <span className={styles.num}>
              <AnimatedCounter value={Math.max(1, stage.id)} />
            </span>
          </span>
        </span>
        <div className={styles.tools}>
          <Leaderboard
            rows={rows}
            votes={votes}
            fresh={fresh}
            before={before}
            reduced={reduced}
            onOpen={() => setFresh(false)}
            onReset={() => {
              setStandings({});
              setVotes(0);
              setFresh(false);
              setBefore(null);
              setLive("Leaderboard reset.");
            }}
          />
          <Switch
            className={styles.blind}
            label="Blind"
            checked={blind}
            onCheckedChange={setBlind}
          />
        </div>
      </header>

      <form
        className={styles.prompt}
        onSubmit={onSubmit}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            (event.metaKey || event.ctrlKey) &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            onSubmit();
          } else if (event.key === "Escape" && running) {
            event.preventDefault();
            stop();
          }
        }}
      >
        <div className={styles.field}>
          <label className={styles.srOnly} htmlFor={`${id}-prompt`}>
            Prompt for both models
          </label>
          <input
            ref={promptRef}
            id={`${id}-prompt`}
            className={styles.input}
            type="text"
            value={prompt}
            placeholder="Ask both models the same thing"
            autoComplete="off"
            enterKeyHint="go"
            onChange={(event) => setPrompt(event.target.value)}
          />
          <Button
            ref={runRef}
            type="submit"
            size="sm"
            variant={running ? "secondary" : "primary"}
            className={[!running && styles.accent, styles.runButton]
              .filter(Boolean)
              .join(" ")}
            disabled={!running && !prompt.trim()}
            aria-label={running ? "Stop" : "Run"}
            aria-keyshortcuts={running ? "Escape" : "Meta+Enter Control+Enter"}
          >
            <RunLabel busy={running} hint={hint} />
          </Button>
        </div>
        <div className={styles.chips} role="group" aria-label="Sample prompts">
          {prompts.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={styles.chip}
              aria-pressed={entry.text === prompt.trim()}
              onClick={() => chooseChip(entry.text)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </form>

      <div className={styles.stage} data-tabs={tabs || undefined}>
        {tabs ? (
          <Tabs
            id={id}
            panes={stage.panes}
            active={active}
            revealed={stage.panes.map(() => revealed)}
            reduced={reduced}
            onSelect={(index, focus) => {
              setActiveTab(index);
              if (focus) document.getElementById(`${id}-tab-${index}`)?.focus();
            }}
          />
        ) : null}
        <div className={styles.panes}>
          {stage.panes.map((pane) => (
            <Pane
              key={pane.slot}
              pane={pane}
              revealed={revealed}
              reduced={reduced}
              smooth={!tabs}
              panel={
                tabs
                  ? {
                      id: `${id}-panel-${pane.slot}`,
                      labelledBy: `${id}-tab-${pane.slot}`,
                      active: pane.slot === active,
                    }
                  : undefined
              }
              onRetry={retry}
              onPromptHelp={simulated ? useSample : undefined}
            />
          ))}
        </div>
      </div>

      <motion.div
        className={styles.voteClip}
        initial={false}
        animate={{ height: voteClip.height }}
        transition={reduced ? { duration: 0 } : spring.smooth}
      >
        <div ref={voteClip.ref} className={styles.voteBar}>
          <AnimatePresence initial={false} mode="popLayout">
            {voteBar}
          </AnimatePresence>
        </div>
      </motion.div>

      <p className={styles.srOnly} role="status" aria-live="polite">
        {live || statusMessage()}
      </p>
    </div>
  );
}

export default ModelArena;
