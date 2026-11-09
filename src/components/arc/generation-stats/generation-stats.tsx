"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactNode, SVGProps } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, CircleAlert, CircleDashed, RotateCcw, Square } from "lucide-react";
import { Button } from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import styles from "./generation-stats.module.css";

/** Provider whose mark sits in front of the model name. */
export type GenerationProvider =
  | "anthropic"
  | "openai"
  | "google"
  | "xai"
  | "mistral"
  | "deepseek"
  | "meta"
  | "qwen";

/** Lifecycle of the request the strip reports on. */
export type GenerationStatus = "idle" | "waiting" | "streaming" | "done" | "stopped" | "error";

export interface GenerationModel {
  /** Display name, truncated with an ellipsis when the strip is narrow. */
  name: string;
  /** Picks the mark in front of the name. */
  provider: GenerationProvider;
  /** Optional id that lands in the copied JSON. */
  id?: string;
}

export interface GenerationUsage {
  /** Total prompt tokens, cached tokens included. */
  inputTokens?: number;
  cachedTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  /** Time to first token in ms. */
  ttftMs?: number;
  /** Total latency in ms; while streaming the live clock stands in for it. */
  durationMs?: number;
  tokensPerSecond?: number;
  costUsd?: number;
}

export interface GenerationPricing {
  /** USD per million input tokens. */
  input: number;
  /** USD per million cached input tokens; defaults to `input`. */
  cachedInput?: number;
  /** USD per million output tokens; reasoning bills at the same rate. */
  output: number;
}

/** One scripted run of the built-in simulation. */
export interface GenerationSampleRun {
  model: GenerationModel;
  pricing: GenerationPricing;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  ttftMs: number;
  tokensPerSecond: number;
  /** When set, the run fails once this many tokens have streamed. */
  failAtTokens?: number;
  error?: string;
}

/** A frame of the simulation, shaped like the props it feeds. */
export interface GenerationFrame {
  /** Bumped on every run so dependants can reset. */
  runKey: number;
  model: GenerationModel;
  pricing: GenerationPricing;
  status: GenerationStatus;
  startedAt?: number;
  usage: GenerationUsage;
  error?: string;
  speedSamples?: number[];
}

export interface GenerationSimulationOptions {
  /** Runs to cycle through. Defaults to a measured sample set. */
  runs?: GenerationSampleRun[];
  /** Ticks only while true. */
  active?: boolean;
  /** Keeps the settled run instead of moving on. */
  hold?: boolean;
  /** Cycles runs forever. */
  loop?: boolean;
}

export interface GenerationSimulation {
  frame: GenerationFrame;
  /** True while the "open the breakdown" cue is live. */
  cueOpen: boolean;
  retry: () => void;
  next: () => void;
}

export interface GenerationStatsProps {
  /** Omit to play the built-in sample runs. */
  status?: GenerationStatus;
  model?: GenerationModel;
  /** Epoch ms. Waiting counts TTFT live, streaming counts total latency live. */
  startedAt?: number;
  usage?: GenerationUsage;
  /** USD per million tokens. Enables the Rate and Cost columns. */
  pricing?: GenerationPricing;
  /** Oldest-first speed readings for the sparkline. */
  speedSamples?: number[];
  error?: string;
  onRetry?: () => void;
  variant?: "card" | "inline";
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Footnote under the breakdown. */
  note?: ReactNode;
  className?: string;
}

const SIMULATED_NOTE = "Simulated run with sample rates. Nothing was sent.";

export const generationSampleRuns: GenerationSampleRun[] = [
  {
    model: { name: "Claude Sonnet 5.5", provider: "anthropic", id: "claude-sonnet-5-5" },
    pricing: { input: 3, cachedInput: 0.3, output: 15 },
    inputTokens: 6214,
    cachedTokens: 5632,
    outputTokens: 284,
    ttftMs: 420,
    tokensPerSecond: 98,
  },
  {
    model: { name: "GPT-6.1 Sol", provider: "openai", id: "gpt-6.1-sol" },
    pricing: { input: 2.5, cachedInput: 0.25, output: 12 },
    inputTokens: 3948,
    cachedTokens: 2560,
    outputTokens: 318,
    reasoningTokens: 224,
    ttftMs: 690,
    tokensPerSecond: 112,
  },
  {
    model: { name: "Gemini 3.8 Flash", provider: "google", id: "gemini-3.8-flash" },
    pricing: { input: 0.3, cachedInput: 0.03, output: 2.5 },
    inputTokens: 8416,
    cachedTokens: 6144,
    outputTokens: 642,
    ttftMs: 260,
    tokensPerSecond: 246,
  },
  {
    model: { name: "Mistral Large 4", provider: "mistral", id: "mistral-large-4" },
    pricing: { input: 2, cachedInput: 0.2, output: 6 },
    inputTokens: 4120,
    cachedTokens: 0,
    outputTokens: 356,
    ttftMs: 380,
    tokensPerSecond: 124,
    failAtTokens: 131,
    error: "Mistral returned 529 overloaded after 131 tokens.",
  },
];

const tokenCount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Latency: ms under a second, then seconds, then minutes. */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;
  if (ms < 10_000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/** Dollars: four decimals below ten dollars, two above. */
function formatCost(usd: number): string {
  return `$${usd < 10 ? usd.toFixed(4) : usd.toFixed(2)}`;
}

function formatTokens(value: number): string {
  return tokenCount.format(Math.round(value));
}

/** Speed keeps a decimal below ten so slow runs do not read as flat. */
function formatSpeed(value: number): string {
  return value < 10 ? value.toFixed(1) : tokenCount.format(Math.round(value));
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function collapseTransition(reduced: boolean) {
  return reduced
    ? { duration: 0 }
    : { height: { type: "spring" as const, visualDuration: 0.26, bounce: 0 }, opacity: { duration: 0.16, ease: EASE } };
}

function statusFade(reduced: boolean) {
  return { duration: 0.14 * Number(!reduced), ease: EASE };
}

function ClaudeMark(props: MarkSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-label="Claude"
      {...props}
    >
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

function OpenAIMark(props: MarkSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-label="OpenAI"
      {...props}
    >
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

function GeminiMark(props: MarkSvgProps) {
  const suffix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="Gemini"
      {...props}
    >
      <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="#3186FF" />
      <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill={`url(#lobe-icons-gemini-0-${suffix})`} />
      <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill={`url(#lobe-icons-gemini-1-${suffix})`} />
      <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill={`url(#lobe-icons-gemini-2-${suffix})`} />
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id={`lobe-icons-gemini-0-${suffix}`} x1="7" x2="11" y1="15.5" y2="12">
          <stop stopColor="#08B962" />
          <stop offset="1" stopColor="#08B962" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={`lobe-icons-gemini-1-${suffix}`} x1="8" x2="11.5" y1="5.5" y2="11">
          <stop stopColor="#F94543" />
          <stop offset="1" stopColor="#F94543" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={`lobe-icons-gemini-2-${suffix}`} x1="3.5" x2="17.5" y1="13.5" y2="12">
          <stop stopColor="#FABC12" />
          <stop offset=".46" stopColor="#FABC12" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function GrokMark(props: MarkSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      fillRule="evenodd"
      role="img"
      aria-label="Grok"
      {...props}
    >
      <path d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815" />
    </svg>
  );
}

function MistralMark(props: MarkSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="Mistral AI"
      {...props}
    >
      <path d="M3.428 3.4h3.429v3.428H3.428V3.4zm13.714 0h3.43v3.428h-3.43V3.4z" fill="gold" />
      <path d="M3.428 6.828h6.857v3.429H3.429V6.828zm10.286 0h6.857v3.429h-6.857V6.828z" fill="#FFAF00" />
      <path d="M3.428 10.258h17.144v3.428H3.428v-3.428z" fill="#FF8205" />
      <path d="M3.428 13.686h3.429v3.428H3.428v-3.428zm6.858 0h3.429v3.428h-3.429v-3.428zm6.856 0h3.43v3.428h-3.43v-3.428z" fill="#FA500F" />
      <path d="M0 17.114h10.286v3.429H0v-3.429zm13.714 0H24v3.429H13.714v-3.429z" fill="#E10500" />
    </svg>
  );
}

function DeepSeekMark(props: MarkSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="DeepSeek"
      {...props}
    >
      <path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#4D6BFE" />
    </svg>
  );
}

function MetaMark(props: MarkSvgProps) {
  const suffix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="Meta"
      {...props}
    >
      <path d="M6.897 4h-.024l-.031 2.615h.022c1.715 0 3.046 1.357 5.94 6.246l.175.297.012.02 1.62-2.438-.012-.019a48.763 48.763 0 00-1.098-1.716 28.01 28.01 0 00-1.175-1.629C10.413 4.932 8.812 4 6.896 4z" fill={`url(#lobe-icons-meta-0-${suffix})`} />
      <path d="M6.873 4C4.95 4.01 3.247 5.258 2.02 7.17a4.352 4.352 0 00-.01.017l2.254 1.231.011-.017c.718-1.083 1.61-1.774 2.568-1.785h.021L6.896 4h-.023z" fill={`url(#lobe-icons-meta-1-${suffix})`} />
      <path d="M2.019 7.17l-.011.017C1.2 8.447.598 9.995.274 11.664l-.005.022 2.534.6.004-.022c.27-1.467.786-2.828 1.456-3.845l.011-.017L2.02 7.17z" fill={`url(#lobe-icons-meta-2-${suffix})`} />
      <path d="M2.807 12.264l-2.533-.6-.005.022c-.177.918-.267 1.851-.269 2.786v.023l2.598.233v-.023a12.591 12.591 0 01.21-2.44z" fill={`url(#lobe-icons-meta-3-${suffix})`} />
      <path d="M2.677 15.537a5.462 5.462 0 01-.079-.813v-.022L0 14.468v.024a8.89 8.89 0 00.146 1.652l2.535-.585a4.106 4.106 0 01-.004-.022z" fill={`url(#lobe-icons-meta-4-${suffix})`} />
      <path d="M3.27 16.89c-.284-.31-.484-.756-.589-1.328l-.004-.021-2.535.585.004.021c.192 1.01.568 1.85 1.106 2.487l.014.017 2.018-1.745a2.106 2.106 0 01-.015-.016z" fill={`url(#lobe-icons-meta-5-${suffix})`} />
      <path d="M10.78 9.654c-1.528 2.35-2.454 3.825-2.454 3.825-2.035 3.2-2.739 3.917-3.871 3.917a1.545 1.545 0 01-1.186-.508l-2.017 1.744.014.017C2.01 19.518 3.058 20 4.356 20c1.963 0 3.374-.928 5.884-5.33l1.766-3.13a41.283 41.283 0 00-1.227-1.886z" fill="#0082FB" />
      <path d="M13.502 5.946l-.016.016c-.4.43-.786.908-1.16 1.416.378.483.768 1.024 1.175 1.63.48-.743.928-1.345 1.367-1.807l.016-.016-1.382-1.24z" fill={`url(#lobe-icons-meta-6-${suffix})`} />
      <path d="M20.918 5.713C19.853 4.633 18.583 4 17.225 4c-1.432 0-2.637.787-3.723 1.944l-.016.016 1.382 1.24.016-.017c.715-.747 1.408-1.12 2.176-1.12.826 0 1.6.39 2.27 1.075l.015.016 1.589-1.425-.016-.016z" fill="#0082FB" />
      <path d="M23.998 14.125c-.06-3.467-1.27-6.566-3.064-8.396l-.016-.016-1.588 1.424.015.016c1.35 1.392 2.277 3.98 2.361 6.971v.023h2.292v-.022z" fill={`url(#lobe-icons-meta-7-${suffix})`} />
      <path d="M23.998 14.15v-.023h-2.292v.022c.004.14.006.282.006.424 0 .815-.121 1.474-.368 1.95l-.011.022 1.708 1.782.013-.02c.62-.96.946-2.293.946-3.91 0-.083 0-.165-.002-.247z" fill={`url(#lobe-icons-meta-8-${suffix})`} />
      <path d="M21.344 16.52l-.011.02c-.214.402-.519.67-.917.787l.778 2.462a3.493 3.493 0 00.438-.182 3.558 3.558 0 001.366-1.218l.044-.065.012-.02-1.71-1.784z" fill={`url(#lobe-icons-meta-9-${suffix})`} />
      <path d="M19.92 17.393c-.262 0-.492-.039-.718-.14l-.798 2.522c.449.153.927.222 1.46.222.492 0 .943-.073 1.352-.215l-.78-2.462c-.167.05-.341.075-.517.073z" fill={`url(#lobe-icons-meta-10-${suffix})`} />
      <path d="M18.323 16.534l-.014-.017-1.836 1.914.016.017c.637.682 1.246 1.105 1.937 1.337l.797-2.52c-.291-.125-.573-.353-.9-.731z" fill={`url(#lobe-icons-meta-11-${suffix})`} />
      <path d="M18.309 16.515c-.55-.642-1.232-1.712-2.303-3.44l-1.396-2.336-.011-.02-1.62 2.438.012.02.989 1.668c.959 1.61 1.74 2.774 2.493 3.585l.016.016 1.834-1.914a2.353 2.353 0 01-.014-.017z" fill={`url(#lobe-icons-meta-12-${suffix})`} />
      <defs>
        <linearGradient id={`lobe-icons-meta-0-${suffix}`} x1="75.897%" x2="26.312%" y1="89.199%" y2="12.194%">
          <stop offset=".06%" stopColor="#0867DF" />
          <stop offset="45.39%" stopColor="#0668E1" />
          <stop offset="85.91%" stopColor="#0064E0" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-1-${suffix}`} x1="21.67%" x2="97.068%" y1="75.874%" y2="23.985%">
          <stop offset="13.23%" stopColor="#0064DF" />
          <stop offset="99.88%" stopColor="#0064E0" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-2-${suffix}`} x1="38.263%" x2="60.895%" y1="89.127%" y2="16.131%">
          <stop offset="1.47%" stopColor="#0072EC" />
          <stop offset="68.81%" stopColor="#0064DF" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-3-${suffix}`} x1="47.032%" x2="52.15%" y1="90.19%" y2="15.745%">
          <stop offset="7.31%" stopColor="#007CF6" />
          <stop offset="99.43%" stopColor="#0072EC" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-4-${suffix}`} x1="52.155%" x2="47.591%" y1="58.301%" y2="37.004%">
          <stop offset="7.31%" stopColor="#007FF9" />
          <stop offset="100%" stopColor="#007CF6" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-5-${suffix}`} x1="37.689%" x2="61.961%" y1="12.502%" y2="63.624%">
          <stop offset="7.31%" stopColor="#007FF9" />
          <stop offset="100%" stopColor="#0082FB" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-6-${suffix}`} x1="34.808%" x2="62.313%" y1="68.859%" y2="23.174%">
          <stop offset="27.99%" stopColor="#007FF8" />
          <stop offset="91.41%" stopColor="#0082FB" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-7-${suffix}`} x1="43.762%" x2="57.602%" y1="6.235%" y2="98.514%">
          <stop offset="0%" stopColor="#0082FB" />
          <stop offset="99.95%" stopColor="#0081FA" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-8-${suffix}`} x1="60.055%" x2="39.88%" y1="4.661%" y2="69.077%">
          <stop offset="6.19%" stopColor="#0081FA" />
          <stop offset="100%" stopColor="#0080F9" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-9-${suffix}`} x1="30.282%" x2="61.081%" y1="59.32%" y2="33.244%">
          <stop offset="0%" stopColor="#027AF3" />
          <stop offset="100%" stopColor="#0080F9" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-10-${suffix}`} x1="20.433%" x2="82.112%" y1="50.001%" y2="50.001%">
          <stop offset="0%" stopColor="#0377EF" />
          <stop offset="99.94%" stopColor="#0279F1" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-11-${suffix}`} x1="40.303%" x2="72.394%" y1="35.298%" y2="57.811%">
          <stop offset=".19%" stopColor="#0471E9" />
          <stop offset="100%" stopColor="#0377EF" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-12-${suffix}`} x1="32.254%" x2="68.003%" y1="19.719%" y2="84.908%">
          <stop offset="27.65%" stopColor="#0867DF" />
          <stop offset="100%" stopColor="#0471E9" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function QwenMark(props: MarkSvgProps) {
  const suffix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="Qwen"
      {...props}
    >
      <path d="M12.604 1.34c.393.69.784 1.382 1.174 2.075a.18.18 0 00.157.091h5.552c.174 0 .322.11.446.327l1.454 2.57c.19.337.24.478.024.837-.26.43-.513.864-.76 1.3l-.367.658c-.106.196-.223.28-.04.512l2.652 4.637c.172.301.111.494-.043.77-.437.785-.882 1.564-1.335 2.34-.159.272-.352.375-.68.37-.777-.016-1.552-.01-2.327.016a.099.099 0 00-.081.05 575.097 575.097 0 01-2.705 4.74c-.169.293-.38.363-.725.364-.997.003-2.002.004-3.017.002a.537.537 0 01-.465-.271l-1.335-2.323a.09.09 0 00-.083-.049H4.982c-.285.03-.553-.001-.805-.092l-1.603-2.77a.543.543 0 01-.002-.54l1.207-2.12a.198.198 0 000-.197 550.951 550.951 0 01-1.875-3.272l-.79-1.395c-.16-.31-.173-.496.095-.965.465-.813.927-1.625 1.387-2.436.132-.234.304-.334.584-.335a338.3 338.3 0 012.589-.001.124.124 0 00.107-.063l2.806-4.895a.488.488 0 01.422-.246c.524-.001 1.053 0 1.583-.006L11.704 1c.341-.003.724.032.9.34zm-3.432.403a.06.06 0 00-.052.03L6.254 6.788a.157.157 0 01-.135.078H3.253c-.056 0-.07.025-.041.074l5.81 10.156c.025.042.013.062-.034.063l-2.795.015a.218.218 0 00-.2.116l-1.32 2.31c-.044.078-.021.118.068.118l5.716.008c.046 0 .08.02.104.061l1.403 2.454c.046.081.092.082.139 0l5.006-8.76.783-1.382a.055.055 0 01.096 0l1.424 2.53a.122.122 0 00.107.062l2.763-.02a.04.04 0 00.035-.02.041.041 0 000-.04l-2.9-5.086a.108.108 0 010-.113l.293-.507 1.12-1.977c.024-.041.012-.062-.035-.062H9.2c-.059 0-.073-.026-.043-.077l1.434-2.505a.107.107 0 000-.114L9.225 1.774a.06.06 0 00-.053-.031zm6.29 8.02c.046 0 .058.02.034.06l-.832 1.465-2.613 4.585a.056.056 0 01-.05.029.058.058 0 01-.05-.029L8.498 9.841c-.02-.034-.01-.052.028-.054l.216-.012 6.722-.012z" fill={`url(#lobe-icons-qwen-${suffix})`} fillRule="nonzero" />
      <defs>
        <linearGradient id={`lobe-icons-qwen-${suffix}`} x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor="#6336E7" stopOpacity=".84" />
          <stop offset="100%" stopColor="#6F69F7" stopOpacity=".84" />
        </linearGradient>
      </defs>
    </svg>
  );
}

type MarkSvgProps = SVGProps<SVGSVGElement>;

interface ProviderMarkProps {
  provider: GenerationProvider;
  size?: number;
  className?: string;
}

function ProviderMark({ provider, size = 16, className }: ProviderMarkProps) {
  const props: MarkSvgProps = { width: size, height: size, className, "aria-hidden": true, focusable: false };

  switch (provider) {
    case "anthropic":
      return <ClaudeMark {...props} style={{ color: "#D97757" }} />;
    case "openai":
      return <OpenAIMark {...props} />;
    case "google":
      return <GeminiMark {...props} />;
    case "xai":
      return <GrokMark {...props} />;
    case "mistral":
      return <MistralMark {...props} />;
    case "deepseek":
      return <DeepSeekMark {...props} />;
    case "meta":
      return <MetaMark {...props} />;
    case "qwen":
      return <QwenMark {...props} />;
  }
}

interface CountingNumberProps {
  value: number | undefined;
  format: (value: number) => string;
  reduced: boolean;
}

/** Eases a number toward its value; a drop cuts straight to it. */
function CountingNumber({ value, format, reduced }: CountingNumberProps) {
  const [current, setCurrent] = useState(value);
  const lastRef = useRef(value);
  const formatRef = useRef(format);

  useEffect(() => {
    formatRef.current = format;
  });

  useEffect(() => {
    if (value === undefined || lastRef.current === undefined || reduced || value < lastRef.current) {
      lastRef.current = value;
      setCurrent(value);
      return;
    }

    let frame = 0;
    let time = performance.now();
    const step = (now: number) => {
      const from = lastRef.current ?? value;
      let next = from + (value - from) * (1 - Math.exp(-(now - time) / 90));
      time = now;
      if (formatRef.current(next) === formatRef.current(value)) next = value;
      lastRef.current = next;
      setCurrent(next);
      if (next !== value) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);

  return <span className={styles.num}>{current === undefined ? "–" : format(current)}</span>;
}

interface SparklineProps {
  points: number[];
  live: boolean;
}

function Sparkline({ points, live }: SparklineProps) {
  const max = 1.1 * Math.max(1, ...points);
  const denominator = Math.max(points.length - 1, 23);
  const coords = points.map((point, index) => [2.5 + (index / denominator) * 51, 17.5 - (point / max) * 15] as const);
  const path = coords.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join("");
  const last = coords[coords.length - 1];

  return (
    <svg className={styles.spark} width={56} height={20} viewBox="0 0 56 20" fill="none" aria-hidden="true">
      <line x1={2.5} x2={53.5} y1={17.5} y2={17.5} className={styles.sparkBase} />
      {coords.length > 1 ? <path d={path} className={styles.sparkLine} /> : null}
      {last ? (
        <circle cx={last[0]} cy={last[1]} r={2} className={styles.sparkDot} data-live={live || undefined} />
      ) : null}
    </svg>
  );
}

function Spinner() {
  return (
    <svg className={styles.spinner} width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".22" strokeWidth="2" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DrawnCheck({ reduced }: { reduced: boolean }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <motion.path
        d="M3.25 8.5 6.5 11.75 12.75 4.75"
        initial={!reduced && { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.28, ease: EASE, delay: 0.04 }}
      />
    </svg>
  );
}

function statusText(status: GenerationStatus, duration: number | undefined): string {
  if (status === "idle") return "Not started";
  if (status === "waiting") return "Waiting";
  if (status === "streaming") return "Streaming";
  if (status === "done") return duration !== undefined ? `Done in ${formatDuration(duration)}` : "Done";
  if (status === "stopped") return duration !== undefined ? `Stopped at ${formatDuration(duration)}` : "Stopped";
  return "Failed";
}

function StatusIcon({ status, reduced }: { status: GenerationStatus; reduced: boolean }) {
  if (status === "waiting" || status === "streaming") return <Spinner />;
  if (status === "done") return <DrawnCheck reduced={reduced} />;
  if (status === "error") return <CircleAlert size={14} strokeWidth={2} aria-hidden="true" />;
  if (status === "stopped") return <Square size={12} strokeWidth={2.25} aria-hidden="true" />;
  return <CircleDashed size={14} strokeWidth={2} aria-hidden="true" />;
}

/** The whole-run speed shape the preview shows before a live series exists. */
function speedSeriesFor(run: GenerationSampleRun): number[] {
  const end = run.outputTokens / (0.9 * run.tokensPerSecond);
  const samples: number[] = [];
  let smoothed: number | undefined;

  for (let time = 0.16; time <= end; time += 0.16) {
    const raw =
      run.tokensPerSecond *
      (0.58 + 0.42 * Math.min(1, time / 0.4)) *
      (1 + 0.07 * Math.sin(6.3 * time + 1.3) + 0.045 * Math.sin(15.7 * time + 2.6));
    smoothed = smoothed === undefined ? raw : smoothed + 0.45 * (raw - smoothed);
    samples.push(Math.round(smoothed * 10) / 10);
  }

  return samples;
}

interface SimulationState {
  index: number;
  retrying: boolean;
  key: number;
  vt: number;
  runStart: number;
  phase: GenerationStatus;
  settledAt: number;
  initial: boolean;
  acc: number;
  delivered: number;
  seed: number;
}

function initialFrame(run: GenerationSampleRun): GenerationFrame {
  return {
    runKey: 0,
    model: run.model,
    pricing: run.pricing,
    status: "done",
    usage: {
      inputTokens: run.inputTokens,
      cachedTokens: run.cachedTokens,
      outputTokens: run.outputTokens,
      reasoningTokens: run.reasoningTokens,
      ttftMs: run.ttftMs,
      durationMs: Math.round(run.ttftMs + (run.outputTokens / (0.9 * run.tokensPerSecond)) * 1000),
    },
    speedSamples: speedSeriesFor(run),
  };
}

/**
 * Virtual-time ticker for the self-playing preview: 40ms steps, a chunk gate of
 * four tokens and a per-run seed that shifts the speed wobble.
 */
export function useGenerationSimulation({
  runs = generationSampleRuns,
  active = true,
  hold = false,
  loop = true,
}: GenerationSimulationOptions = {}): GenerationSimulation {
  const [frame, setFrame] = useState<GenerationFrame>(() => initialFrame(runs[0]));
  const [cueOpen, setCueOpen] = useState(false);
  const state = useRef<SimulationState>({
    index: 0,
    retrying: false,
    key: 0,
    vt: 0,
    runStart: 0,
    phase: "done",
    settledAt: 0,
    initial: true,
    acc: 0,
    delivered: 0,
    seed: 1.3,
  });
  const holdRef = useRef(hold);
  const loopRef = useRef(loop);

  useEffect(() => {
    holdRef.current = hold;
    loopRef.current = loop;
  }, [hold, loop]);

  const start = useCallback(
    (index: number, retrying: boolean) => {
      const next = state.current;
      const run = runs[index % runs.length];
      Object.assign(next, {
        index: index % runs.length,
        retrying,
        key: next.key + 1,
        runStart: next.vt,
        phase: "waiting",
        initial: false,
        acc: 0,
        delivered: 0,
        seed: (7.13 * next.seed) % 6.28,
      });
      setCueOpen(false);
      setFrame({
        runKey: next.key,
        model: run.model,
        pricing: run.pricing,
        status: "waiting",
        startedAt: Date.now(),
        usage: {
          inputTokens: run.inputTokens,
          cachedTokens: run.cachedTokens,
          outputTokens: 0,
        },
      });
    },
    [runs],
  );

  const retry = useCallback(() => start(state.current.index, true), [start]);
  const next = useCallback(() => start(state.current.index + 1, false), [start]);

  useEffect(() => {
    if (!active) return;

    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const step = Math.min(now - last, 100);
      last = now;

      const current = state.current;
      current.vt += step;

      const run = runs[current.index];
      const elapsedInRun = current.vt - current.runStart;
      const startedAt = Date.now() - elapsedInRun;

      if (current.phase === "done" || current.phase === "error") {
        if (holdRef.current) {
          current.settledAt += step;
          return;
        }

        const settled = current.vt - current.settledAt;

        if (current.phase === "error") {
          if (settled >= 2400) start(current.index, true);
          return;
        }

        if (current.initial) {
          if (settled >= 1200 && loopRef.current) start(current.index + 1, false);
          return;
        }

        if (settled >= 1000 && settled < 3900) setCueOpen(true);
        if (settled >= 3900) setCueOpen(false);
        if (settled >= 4400 && loopRef.current) start(current.index + 1, false);
        return;
      }

      if (elapsedInRun < run.ttftMs) {
        setFrame((previous) =>
          Math.abs((previous.startedAt ?? 0) - startedAt) > 30 ? { ...previous, startedAt } : previous,
        );
        return;
      }

      const seconds = (elapsedInRun - run.ttftMs) / 1000;
      const ramp = 0.58 + 0.42 * Math.min(1, seconds / 0.4);
      const wobble =
        1 + 0.07 * Math.sin(6.3 * seconds + current.seed) + 0.045 * Math.sin(15.7 * seconds + 2 * current.seed);

      current.acc += run.tokensPerSecond * ramp * wobble * (step / 1000);

      const limit = current.retrying ? undefined : run.failAtTokens;
      const ceiling = limit ?? run.outputTokens;
      const finished = current.acc >= ceiling;
      const delivered = Math.min(ceiling, Math.max(1, Math.floor(current.acc)));

      if (!finished && delivered - current.delivered < 4 && current.phase === "streaming") return;

      current.delivered = delivered;

      const usage: GenerationUsage = {
        inputTokens: run.inputTokens,
        cachedTokens: run.cachedTokens,
        outputTokens: delivered,
        reasoningTokens: run.reasoningTokens,
        ttftMs: run.ttftMs,
      };

      if (finished) {
        current.phase = limit !== undefined ? "error" : "done";
        current.settledAt = current.vt;
        setFrame({
          runKey: current.key,
          model: run.model,
          pricing: run.pricing,
          status: current.phase,
          startedAt,
          usage: { ...usage, durationMs: Math.round(elapsedInRun) },
          error: limit !== undefined ? run.error : undefined,
        });
        return;
      }

      current.phase = "streaming";
      setFrame({
        runKey: current.key,
        model: run.model,
        pricing: run.pricing,
        status: "streaming",
        startedAt,
        usage,
      });
    }, 40);

    return () => window.clearInterval(timer);
  }, [active, runs, start]);

  return { frame, cueOpen, retry, next };
}

/** Wall clock that only ticks while a run is live. */
function useLiveClock(active: boolean): number | undefined {
  const [now, setNow] = useState<number>();

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const tick = () => {
      setNow(Date.now());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return active ? now : undefined;
}

const SERIES_LIMIT = 48;

/**
 * Samples output tokens every 160ms while streaming, smoothed, then compresses
 * the series by averaging neighbours so a long run keeps its shape.
 */
function useSpeedSeries(status: GenerationStatus, outputTokens: number | undefined, reset: number | undefined) {
  const [series, setSeries] = useState<number[]>([]);
  const [tracked, setTracked] = useState<{ status: GenerationStatus; reset: number | undefined }>({ status, reset });
  const latest = useRef(outputTokens ?? 0);

  useEffect(() => {
    latest.current = outputTokens ?? 0;
  }, [outputTokens]);

  if (tracked.status !== status || tracked.reset !== reset) {
    setTracked({ status, reset });
    if (status === "waiting" || status === "idle" || tracked.reset !== reset) setSeries([]);
  }

  useEffect(() => {
    if (status !== "streaming") return;

    let smoothed: number | undefined;
    let lastTime = performance.now();
    let lastValue = latest.current;

    const timer = window.setInterval(() => {
      const now = performance.now();
      const value = latest.current;
      const instant = (value - lastValue) / ((now - lastTime) / 1000);
      lastTime = now;
      lastValue = value;
      smoothed = Math.max(0, smoothed === undefined ? instant : smoothed + 0.45 * (instant - smoothed));
      const reading = smoothed;

      setSeries((previous) => {
        const next = [...previous, reading];
        if (next.length <= SERIES_LIMIT) return next;
        return next.reduce<number[]>((acc, value, index) => {
          if (index % 2) {
            acc[acc.length - 1] = (acc[acc.length - 1] + value) / 2;
            return acc;
          }
          return [...acc, value];
        }, []);
      });
    }, 160);

    return () => window.clearInterval(timer);
  }, [status]);

  return series;
}

interface StatRow {
  key: string;
  label: string;
  tokens: number | undefined;
  rate: number | undefined;
}

/**
 * Live stats strip for a streaming language-model response. Without props it
 * plays four sample runs; with props it reports whatever the caller passes in.
 */
export function GenerationStats({
  model: modelProp,
  status,
  startedAt: startedAtProp,
  usage: usageProp,
  pricing: pricingProp,
  speedSamples,
  error: errorProp,
  variant = "card",
  expanded,
  defaultExpanded = false,
  onExpandedChange,
  onRetry,
  note,
  className,
}: GenerationStatsProps) {
  const reduced = useReducedMotion() ?? false;
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const simulated = status === undefined;
  const [inView, setInView] = useState(false);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultExpanded);
  const [interacted, setInteracted] = useState(false);

  useEffect(() => {
    const node = rootRef.current;
    if (!simulated || !node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.1 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [simulated]);

  const open = expanded ?? uncontrolledOpen;
  const simulation = useGenerationSimulation({ active: simulated && inView && !reduced, hold: interacted && open });

  const frame = simulated ? simulation.frame : undefined;
  const model = frame?.model ?? modelProp;
  const statusResolved = frame?.status ?? status ?? "idle";
  const startedAt = frame?.startedAt ?? startedAtProp;
  const usage = frame?.usage ?? usageProp ?? {};
  const pricing = frame?.pricing ?? pricingProp;
  const error = frame?.error ?? errorProp;
  const resolvedNote = note ?? (simulated ? SIMULATED_NOTE : undefined);
  const retryHandler = simulated ? simulation.retry : onRetry;
  const openResolved =
    !simulated || interacted || expanded !== undefined || defaultExpanded ? open : simulation.cueOpen;
  const live = statusResolved === "waiting" || statusResolved === "streaming";
  const now = useLiveClock(live && startedAt !== undefined);
  const elapsed = live && startedAt !== undefined ? Math.max(0, (now ?? startedAt) - startedAt) : undefined;

  const ttft = usage.ttftMs ?? (statusResolved === "waiting" ? elapsed : undefined);
  const duration = usage.durationMs ?? (live ? elapsed : undefined);
  const generation =
    statusResolved !== "waiting" && duration !== undefined && ttft !== undefined
      ? Math.max(0, duration - ttft)
      : undefined;
  const outputTokens = usage.outputTokens;

  const [chunk, setChunk] = useState<{ output?: number; elapsed?: number }>({});
  if (chunk.output !== outputTokens) setChunk({ output: outputTokens, elapsed });

  const sampled =
    statusResolved === "streaming" &&
    usage.durationMs === undefined &&
    chunk.elapsed !== undefined &&
    ttft !== undefined
      ? chunk.elapsed - ttft
      : generation;
  const speed =
    usage.tokensPerSecond ?? (outputTokens && sampled && sampled >= 240 ? outputTokens / (sampled / 1000) : undefined);

  const cost =
    usage.costUsd ??
    (pricing && usage.inputTokens !== undefined
      ? (() => {
          const cached = Math.min(usage.cachedTokens ?? 0, usage.inputTokens ?? 0);
          const fresh = usage.inputTokens - cached;
          const billed = (usage.outputTokens ?? 0) + (usage.reasoningTokens ?? 0);
          return (fresh * pricing.input + cached * (pricing.cachedInput ?? pricing.input) + billed * pricing.output) / 1e6;
        })()
      : undefined);

  const series = useSpeedSeries(statusResolved, outputTokens, frame?.runKey);
  const points = speedSamples ?? frame?.speedSamples ?? series;

  const [announcement, setAnnouncement] = useState("");
  const [lastStatus, setLastStatus] = useState<GenerationStatus>(statusResolved);

  if (lastStatus !== statusResolved) {
    setLastStatus(statusResolved);
    const name = model?.name ?? "The model";
    const message =
      statusResolved === "done"
        ? `${name} done in ${duration !== undefined ? formatDuration(duration) : "time unknown"}${
            outputTokens !== undefined ? `, ${formatTokens(outputTokens)} output tokens` : ""
          }${speed ? ` at ${formatSpeed(speed)} tokens per second` : ""}${cost !== undefined ? `, ${formatCost(cost)}` : ""}.`
        : statusResolved === "error"
          ? `${name} failed. ${error ?? ""}`.trim()
          : statusResolved === "stopped"
            ? `${name} stopped.`
            : statusResolved === "waiting" && interacted
              ? `Request sent to ${name}.`
              : "";
    if (!simulated || interacted) setAnnouncement(message);
  }

  const cachedTokens = Math.min(usage.cachedTokens ?? 0, usage.inputTokens ?? 0);
  const rows: StatRow[] = [
    {
      key: "input",
      label: "Input",
      tokens: usage.inputTokens !== undefined ? usage.inputTokens - cachedTokens : undefined,
      rate: pricing?.input,
    },
    {
      key: "cached",
      label: "Cached input",
      tokens: usage.inputTokens !== undefined ? cachedTokens : undefined,
      rate: pricing ? (pricing.cachedInput ?? pricing.input) : undefined,
    },
    { key: "output", label: "Output", tokens: outputTokens, rate: pricing?.output },
    ...(usage.reasoningTokens
      ? [{ key: "reasoning", label: "Reasoning", tokens: usage.reasoningTokens, rate: pricing?.output }]
      : []),
  ];
  const totalTokens = rows.reduce((total, row) => total + (row.tokens ?? 0), 0);
  const hasCost = cost !== undefined;
  const showRates = !!pricing && usage.costUsd === undefined;

  const statsJson = JSON.stringify(
    {
      model: model?.id ?? model?.name,
      status: statusResolved,
      ttftMs: ttft !== undefined ? Math.round(ttft) : undefined,
      durationMs: duration !== undefined ? Math.round(duration) : undefined,
      tokensPerSecond: speed !== undefined ? Math.round(speed * 10) / 10 : undefined,
      inputTokens: usage.inputTokens,
      cachedTokens: usage.cachedTokens,
      outputTokens,
      reasoningTokens: usage.reasoningTokens,
      costUsd: cost !== undefined ? Math.round(cost * 1e6) / 1e6 : undefined,
    },
    null,
    2,
  );

  const ids = { panel: `${baseId}-panel`, label: `${baseId}-label` };
  const isInline = variant === "inline";
  const ttftShare = ttft !== undefined && duration ? Math.min(1, ttft / duration) : Number(statusResolved === "waiting");

  return (
    <div
      ref={rootRef}
      className={[styles.root, isInline ? styles.inline : styles.card, className].filter(Boolean).join(" ")}
      data-status={statusResolved}
      data-open={openResolved || undefined}
      role="group"
      aria-labelledby={ids.label}
    >
      <div className={styles.head}>
        {model ? <ProviderMark provider={model.provider} size={isInline ? 14 : 16} className={styles.mark} /> : null}
        <span id={ids.label} className={styles.model}>
          {model ? model.name : "Generation"}
          <span className={styles.srOnly}> stats</span>
        </span>
        <span className={styles.status}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={statusText(statusResolved, statusResolved === "done" || statusResolved === "stopped" ? duration : undefined)}
              className={styles.statusInner}
              initial={{ opacity: 0, y: 2 * Number(!reduced) }}
              animate={{ opacity: 1, y: 0, transition: { ...statusFade(reduced), duration: 0.16 * Number(!reduced) } }}
              exit={{ opacity: 0, transition: { ...statusFade(reduced), duration: 0.1 * Number(!reduced) } }}
            >
              <span className={styles.statusIcon} data-status={statusResolved}>
                <StatusIcon status={statusResolved} reduced={reduced} />
              </span>
              {statusResolved === "waiting" ? (
                <TextShimmer className={styles.statusLabel}>Waiting</TextShimmer>
              ) : (
                <span className={styles.statusLabel}>{statusText(statusResolved, duration)}</span>
              )}
            </motion.span>
          </AnimatePresence>
        </span>
      </div>

      <dl className={styles.stats}>
        <div className={styles.cell}>
          <dt className={styles.label}>First token</dt>
          <dd className={styles.value}>
            <CountingNumber value={ttft} format={formatDuration} reduced={reduced} />
            <span className={styles.unitInline}>to first token</span>
          </dd>
        </div>
        <div className={styles.cell}>
          <dt className={styles.label}>Speed</dt>
          <dd className={styles.value}>
            <CountingNumber value={speed} format={formatSpeed} reduced={reduced} />
            <span className={styles.unit}>tok/s</span>
            <Sparkline points={points} live={statusResolved === "streaming"} />
          </dd>
        </div>
        <div className={styles.cell}>
          <dt className={styles.label}>Output tokens</dt>
          <dd className={styles.value}>
            <CountingNumber value={outputTokens} format={formatTokens} reduced={reduced} />
            <span className={styles.unitInline}>tokens</span>
          </dd>
        </div>
        <div className={styles.cell}>
          <dt className={styles.label}>Cost</dt>
          <dd className={styles.value}>
            <CountingNumber value={cost} format={formatCost} reduced={reduced} />
          </dd>
        </div>
      </dl>

      <Button
        variant="ghost"
        size="sm"
        className={styles.toggle}
        onClick={() => {
          const next = !openResolved;
          setInteracted(true);
          if (expanded === undefined) setUncontrolledOpen(next);
          onExpandedChange?.(next);
        }}
        disabled={statusResolved === "idle"}
        aria-expanded={openResolved}
        aria-controls={ids.panel}
        aria-label={openResolved ? "Hide details" : "Show details"}
      >
        <span className={styles.toggleLabel}>Details</span>
        <ChevronDown size={16} strokeWidth={1.75} className={styles.chevron} aria-hidden="true" />
      </Button>

      <AnimatePresence initial={false}>
        {statusResolved === "error" ? (
          <motion.div
            key="error"
            className={styles.errorClip}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={collapseTransition(reduced)}
          >
            <div className={styles.error}>
              <CircleAlert size={16} strokeWidth={1.75} className={styles.errorIcon} aria-hidden="true" />
              <p className={styles.errorText}>{error ?? "The request failed before it finished."}</p>
              {retryHandler ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className={styles.retry}
                  onClick={() => {
                    setInteracted(true);
                    retryHandler();
                  }}
                >
                  <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
                  Retry
                </Button>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {openResolved ? (
          <motion.div
            key="panel"
            id={ids.panel}
            className={styles.panelClip}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={collapseTransition(reduced)}
          >
            <div className={styles.panel}>
              <section className={styles.latency} aria-label="Latency">
                <div className={styles.bar} aria-hidden="true">
                  <span className={styles.segTtft} style={{ flexGrow: Math.max(ttftShare, 0.015) }} />
                  {generation !== undefined ? (
                    <span className={styles.segGen} style={{ flexGrow: Math.max(1 - ttftShare, 0) }} />
                  ) : null}
                </div>
                <dl className={styles.legend}>
                  <div className={styles.legendItem}>
                    <dt>
                      <span className={styles.swatchTtft} aria-hidden="true" />
                      First token
                    </dt>
                    <dd>
                      <CountingNumber value={ttft} format={formatDuration} reduced={reduced} />
                    </dd>
                  </div>
                  <div className={styles.legendItem}>
                    <dt>
                      <span className={styles.swatchGen} aria-hidden="true" />
                      Generation
                    </dt>
                    <dd>
                      <CountingNumber value={generation} format={formatDuration} reduced={reduced} />
                    </dd>
                  </div>
                  <div className={styles.legendItem}>
                    <dt>Total</dt>
                    <dd>
                      <CountingNumber value={duration} format={formatDuration} reduced={reduced} />
                    </dd>
                  </div>
                </dl>
              </section>

              <table className={styles.table} data-rates={showRates || undefined} data-cost={hasCost || undefined}>
                <caption className={styles.srOnly}>Token usage{hasCost ? " and cost" : ""}</caption>
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col">Tokens</th>
                    {showRates ? (
                      <th scope="col" className={styles.rateCol}>
                        Rate
                      </th>
                    ) : null}
                    {hasCost ? <th scope="col">Cost</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row">{row.label}</th>
                      <td>
                        <CountingNumber value={row.tokens} format={formatTokens} reduced={reduced} />
                      </td>
                      {showRates ? (
                        <td className={styles.rateCol}>
                          {row.rate !== undefined
                            ? `$${row.rate < 1 ? row.rate.toFixed(3).replace(/0$/, "") : row.rate.toFixed(2)}/M`
                            : "–"}
                        </td>
                      ) : null}
                      {hasCost ? (
                        <td>
                          {showRates && row.tokens !== undefined && row.rate !== undefined ? (
                            <CountingNumber value={(row.tokens * row.rate) / 1e6} format={formatCost} reduced={reduced} />
                          ) : (
                            "–"
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Total</th>
                    <td>
                      <CountingNumber value={totalTokens} format={formatTokens} reduced={reduced} />
                    </td>
                    {showRates ? <td className={styles.rateCol} /> : null}
                    {hasCost ? (
                      <td>
                        <CountingNumber value={cost} format={formatCost} reduced={reduced} />
                      </td>
                    ) : null}
                  </tr>
                </tfoot>
              </table>

              <div className={styles.foot}>
                <p className={styles.note}>{resolvedNote}</p>
                <CopyButton
                  value={statsJson}
                  label="Copy stats as JSON"
                  iconOnly
                  variant="plain"
                  className={styles.copy}
                />
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <span className={styles.srOnly} role="status" aria-live="polite">
        {simulated && !interacted ? SIMULATED_NOTE : `${announcement}${simulated && announcement ? " Simulated, nothing was sent." : ""}`}
      </span>
    </div>
  );
}

export default GenerationStats;
