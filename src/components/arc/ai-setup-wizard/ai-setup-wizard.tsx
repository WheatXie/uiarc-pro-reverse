"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";
import { ArrowUp, Check, CircleDashed, LockKeyhole, Sparkles, Square, TriangleAlert } from "lucide-react";
import { Button } from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import { Switch } from "../switch/switch";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import styles from "./ai-setup-wizard.module.css";

/* ────────────────────────────── types ────────────────────────────── */

/** One knowledge source that can be connected in step 1. */
export interface WizardSource {
  /** Stable id. Citation `sourceId`s must match it so the marks line up. */
  id: string;
  /** Row title, such as "Notion". */
  name: string;
  /** Muted line under the name while idle, such as "Product wiki". */
  description: string;
  /** How many documents the source holds; drives the sync count and the totals. */
  count: number;
  /** Noun for `count`, such as "pages" or "articles". */
  unit: string;
  /** 20px mark shown at the start of the row. */
  mark?: ReactNode;
}

/** One model card in step 2. */
export interface WizardModel {
  id: string;
  /** Full name, used in the summary and as the radio label. */
  name: string;
  /** Short name for the card and the footer meta; falls back to `name`. */
  shortName?: string;
  /** Vendor line under the name, such as "Anthropic". */
  note?: string;
  /** 16px mark drawn above the name. */
  mark?: ReactNode;
}

/** An option for the tone segmented control. */
export interface WizardOption {
  value: string;
  label: string;
}

/** One switch in the guardrails list. */
export interface WizardGuardrail {
  id: string;
  label: string;
  /** Starts switched on. */
  defaultOn?: boolean;
}

/** A citation returned by `onAsk`; `[1]`, `[2]` in the answer text point at them in order. */
export interface WizardCitation {
  /** Must match a `WizardSource.id`. */
  sourceId: string;
  title: string;
}

/** What `onAsk` resolves to. */
export interface WizardAnswer {
  /** The answer body, with `[1]`, `[2]` markers written in citation order. */
  text: string;
  citations: WizardCitation[];
}

/** The setup as it stands, including unsaved settings. */
export interface WizardConfig {
  /** Ids of the sources that finished syncing. */
  sources: string[];
  modelId: string;
  tone: string;
  guardrails: Record<string, boolean>;
}

/** Reports sync progress for one source, `0..1`, as items arrive. */
export type WizardConnectReport = (progress: number) => void;

export interface AiSetupWizardProps {
  /** The AI feature being turned on. Used in the title ("Set up Ask Northwind") and the confirmation. */
  featureName?: string;
  /** One muted line under the title, such as who gets the feature. */
  audience?: string;
  /** The company or product mark left of the title, drawn at 24px. Defaults to the Northwind sample mark; pass null to hide it. */
  logo?: ReactNode;
  /** Sources for step 1: { id, name, description, count, unit, mark? }. Four fit the card. */
  sources?: WizardSource[];
  /** Three model cards: { id, name, shortName?, note?, mark? }. */
  models?: WizardModel[];
  /** Tone options for the segmented control: { value, label }. */
  tones?: WizardOption[];
  /** Up to three switches: { id, label, defaultOn? }. */
  guardrails?: WizardGuardrail[];
  /** Up to three sample questions offered in step 3 before the first test. */
  suggestions?: string[];
  /** The model selected at the start. Defaults to the first model. */
  defaultModelId?: string;
  /** The tone selected at the start. Defaults to the first tone. */
  defaultTone?: string;
  /** Connects and syncs one source. The row shows Connecting until the first report call, then the synced count and a progress line. Resolve when the sync is done; reject with an Error to show its message on the row with a Retry button. Simulated when left out. */
  onConnect?: (source: WizardSource, report: WizardConnectReport, signal: AbortSignal) => Promise<void>;
  /** Answers a test question with the current config. Return { text, citations } and write [1], [2] into text in citation order. The signal aborts when the person presses Stop. Simulated when left out. */
  onAsk?: (question: string, config: WizardConfig, signal: AbortSignal) => Promise<WizardAnswer>;
  /** Turns the feature on. Resolve to show the confirmation; reject to show the error in the footer with Try again. Simulated when left out. */
  onGoLive?: (config: WizardConfig, signal: AbortSignal) => Promise<void>;
  /** Called with 0, 1 or 2 for the steps and 3 for the live confirmation. */
  onStepChange?: (step: number) => void;
  /** Called with { sources, modelId, tone, guardrails } whenever a source finishes syncing or a setting changes. */
  onConfigChange?: (config: WizardConfig) => void;
  /** Plays the whole flow on its own and loops, pausing off screen. The first pointer or key press inside the card stops it. Defaults to true when none of onConnect, onAsk or onGoLive is passed; always off with reduced motion. */
  autoPlay?: boolean;
  /** Extra class on the card. */
  className?: string;
}

/* ────────────────────────────── marks ────────────────────────────── */

interface MarkProps {
  title?: string;
}

function NorthwindMark({ title = "Northwind" }: MarkProps) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} role="img" aria-label={title}>
      <defs>
        <linearGradient id={`${uid}-light`} x1="8" y1="3" x2="8" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" stopOpacity=".42" />
          <stop offset="1" stopColor="currentColor" stopOpacity=".72" />
        </linearGradient>
        <linearGradient id={`${uid}-dark`} x1="16" y1="3" x2="16" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" stopOpacity=".88" />
          <stop offset="1" stopColor="currentColor" stopOpacity="1" />
        </linearGradient>
      </defs>
      <path d="M12 2.5 4.75 20.75 12 16.9Z" fill={`url(#${uid}-light)`} />
      <path d="M12 2.5 19.25 20.75 12 16.9Z" fill={`url(#${uid}-dark)`} />
    </svg>
  );
}

function NotionMark({ title = "Notion" }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title}>
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
    </svg>
  );
}

function DriveMark({ title = "Google Drive" }: MarkProps) {
  return (
    <svg viewBox="0 0 87.3 78" role="img" aria-label={title}>
      <path fill="#0066DA" d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" />
      <path fill="#00AC47" d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" />
      <path fill="#EA4335" d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" />
      <path fill="#00832D" d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" />
      <path fill="#2684FC" d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" />
      <path fill="#FFBA00" d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" />
    </svg>
  );
}

function ConfluenceMark({ title = "Confluence" }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="#1868DB" role="img" aria-label={title}>
      <path d="M.87 18.257c-.248.382-.53.875-.763 1.245a.764.764 0 0 0 .255 1.04l4.965 3.054a.764.764 0 0 0 1.058-.26c.199-.332.454-.763.733-1.221 1.967-3.247 3.945-2.853 7.508-1.146l4.957 2.337a.764.764 0 0 0 1.028-.382l2.364-5.346a.764.764 0 0 0-.382-1 599.851 599.851 0 0 1-4.965-2.361C10.911 10.97 5.224 11.185.87 18.257zM23.131 5.743c.249-.405.531-.875.764-1.25a.764.764 0 0 0-.256-1.034L18.675.404a.764.764 0 0 0-1.058.26c-.195.335-.451.763-.734 1.225-1.966 3.246-3.945 2.85-7.508 1.146L4.437.694a.764.764 0 0 0-1.027.382L1.046 6.422a.764.764 0 0 0 .382 1c1.039.49 3.105 1.467 4.965 2.361 6.698 3.246 12.392 3.029 16.738-4.04z" />
    </svg>
  );
}

function ZendeskMark({ title = "Zendesk" }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title}>
      <path d="M12.914 2.904V16.29L24 2.905H12.914zM0 2.906C0 5.966 2.483 8.45 5.543 8.45s5.542-2.484 5.543-5.544H0zm11.086 4.807L0 21.096h11.086V7.713zm7.37 7.84c-3.063 0-5.542 2.48-5.542 5.543H24c0-3.06-2.48-5.543-5.543-5.543z" />
    </svg>
  );
}

function ClaudeMark({ title = "Claude" }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="#D97757" role="img" aria-label={title}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

function OpenAIMark({ title = "OpenAI" }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title}>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

function GeminiMark({ title = "Gemini" }: MarkProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const shape =
    "M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z";
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title}>
      <path d={shape} fill="#3186FF" />
      <path d={shape} fill={`url(#lobe-icons-gemini-0-${uid})`} />
      <path d={shape} fill={`url(#lobe-icons-gemini-1-${uid})`} />
      <path d={shape} fill={`url(#lobe-icons-gemini-2-${uid})`} />
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

/* ────────────────────────────── sample content ────────────────────────────── */

export const defaultSources: WizardSource[] = [
  { id: "notion", name: "Notion", description: "Product wiki", count: 1284, unit: "pages", mark: <NotionMark /> },
  { id: "drive", name: "Google Drive", description: "Support shared drive", count: 1677, unit: "files", mark: <DriveMark /> },
  { id: "confluence", name: "Confluence", description: "Billing and ops space", count: 642, unit: "pages", mark: <ConfluenceMark /> },
  { id: "zendesk", name: "Zendesk", description: "Help center and macros", count: 309, unit: "articles", mark: <ZendeskMark /> },
];

export const defaultModels: WizardModel[] = [
  { id: "claude-sonnet-5.5", name: "Claude Sonnet 5.5", shortName: "Sonnet 5.5", note: "Anthropic", mark: <ClaudeMark /> },
  { id: "gpt-6.1-sol", name: "GPT-6.1 Sol", note: "OpenAI", mark: <OpenAIMark /> },
  { id: "gemini-4-argon", name: "Gemini 4 Argon", note: "Google", mark: <GeminiMark /> },
];

export const defaultTones: WizardOption[] = [
  { value: "concise", label: "Concise" },
  { value: "friendly", label: "Friendly" },
  { value: "formal", label: "Formal" },
];

export const defaultGuardrails: WizardGuardrail[] = [
  { id: "cite", label: "Cite a source in every answer", defaultOn: true },
  { id: "handoff", label: "Hand off to a person when unsure", defaultOn: true },
  { id: "pii", label: "Redact personal data", defaultOn: false },
];

export const defaultSuggestions: string[] = [
  "How do I issue a partial refund?",
  "What is our SLA for enterprise tickets?",
  "Can customers export their data?",
];

/* ────────────────────────────── simulation ────────────────────────────── */

/** A sample passage: the citation it becomes plus the sentence it contributes to the answer. */
interface CorpusEntry extends WizardCitation {
  text: string;
}

/** The sample knowledge base, one group of passages per suggestion. */
const corpus: CorpusEntry[][] = [
  [
    { sourceId: "notion", title: "Refund policy", text: "Open the order in Stripe, choose Refund and enter the partial amount." },
    { sourceId: "confluence", title: "Billing approvals", text: "Anything over $500 needs a team lead's approval before you send it." },
    { sourceId: "zendesk", title: "Macro: Partial refund", text: "Reply with the Partial refund macro so the ticket is tagged and the customer gets the right email." },
    { sourceId: "drive", title: "Billing FAQ 2026.pdf", text: "The money reaches the original card in 5 to 10 business days." },
  ],
  [
    { sourceId: "notion", title: "Support SLAs", text: "Enterprise tickets get a first response within 1 hour, around the clock." },
    { sourceId: "drive", title: "Enterprise MSA 2026.pdf", text: "Urgent incidents have a 15 minute response target under the 2026 MSA." },
    { sourceId: "zendesk", title: "SLA policy: Enterprise", text: "The clock pauses while a ticket is pending on the customer." },
    { sourceId: "confluence", title: "Escalation runbook", text: "If a ticket is close to breaching, page the on call lead in #support-escalations." },
  ],
  [
    { sourceId: "notion", title: "Data export", text: "Yes. Admins can export all workspace data as CSV or JSON from Settings, then Data." },
    { sourceId: "drive", title: "Data export spec.pdf", text: "Exports include tickets, contacts and attachments in one zip file." },
    { sourceId: "confluence", title: "Export pipeline", text: "Exports over 10 GB run in the background and email a download link when ready." },
    { sourceId: "zendesk", title: "Article: Export your data", text: "Send customers the Export your data article and solve the ticket." },
  ],
];

/** A timeout that rejects with the signal's reason instead of leaking a pending timer. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/** Simulated sync: connect, then feed eased progress until the source is done. */
export async function simulateConnect(source: WizardSource, report: WizardConnectReport, signal: AbortSignal): Promise<void> {
  await sleep(480, signal);
  const ticks = 18 + Math.round(Math.min(source.count, 2000) / 160);
  for (let tick = 1; tick <= ticks; tick += 1) {
    await sleep(70, signal);
    report(1 - Math.pow(1 - tick / ticks, 1.6));
  }
}

/** Word sets, for picking the sample answer whose source text overlaps the question most. */
const words = (text: string) => new Set(text.toLowerCase().match(/[a-z]+/g) ?? []);

/** Simulated answer: pick the closest sample group and cite the connected sources it names. */
export async function simulateAsk(question: string, config: WizardConfig, signal: AbortSignal): Promise<WizardAnswer> {
  await sleep(900, signal);
  const asked = words(question);
  let best = 0;
  let score = -1;
  defaultSuggestions.forEach((suggestion, index) => {
    const overlap = [...words(suggestion)].filter((word) => word.length > 3 && asked.has(word)).length;
    if (overlap > score) {
      score = overlap;
      best = index;
    }
  });
  const connected = corpus[best].filter((entry) => config.sources.includes(entry.sourceId)).slice(0, 3);
  const picked = connected.length ? connected : corpus[best].slice(0, 1);
  return {
    text: picked.map((entry, index) => `${entry.text} [${index + 1}]`).join(" "),
    citations: picked.map(({ sourceId, title }) => ({ sourceId, title })),
  };
}

/** Simulated publish. */
export async function simulateGoLive(_config: WizardConfig, signal: AbortSignal): Promise<void> {
  await sleep(900, signal);
}

/* ────────────────────────────── motion ────────────────────────────── */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const PAGE_SPRING = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;
const STEPS = [
  { label: "Connect data", short: "Connect" },
  { label: "Choose behavior", short: "Behavior" },
  { label: "Test it", short: "Test" },
] as const;
/** Words per streamed chunk, cycling so the rhythm never feels metronomic. */
const CHUNK_WORDS = [4, 3, 5, 6, 3, 4, 5, 3, 6, 4];

type SourcePhase = "idle" | "connecting" | "syncing" | "synced" | "error";

interface SourceState {
  phase: SourcePhase;
  progress: number;
  error?: string;
}

type TestStatus = "idle" | "thinking" | "streaming" | "done" | "stopped" | "error";

interface TestState {
  status: TestStatus;
  question: string;
  answer: WizardAnswer | null;
  shown: number;
  startedAt: number;
  elapsed: number;
  error?: string;
}

const IDLE_SOURCE: SourceState = { phase: "idle", progress: 0 };
const EMPTY_TEST: TestState = { status: "idle", question: "", answer: null, shown: 0, startedAt: 0, elapsed: 0 };

const railsOf = (guardrails: WizardGuardrail[]) => Object.fromEntries(guardrails.map((rail) => [rail.id, rail.defaultOn ?? false]));
const messageOf = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

/** Splits an answer into chunks of a few words each, so streaming appends one span at a time. */
function chunkAnswer(text: string): string[][] {
  const tokens = text.match(/\S+\s*/g) ?? [];
  const chunks: string[][] = [];
  for (let index = 0; index < tokens.length; ) {
    const size = CHUNK_WORDS[chunks.length % CHUNK_WORDS.length];
    chunks.push(tokens.slice(index, index + size));
    index += size;
  }
  return chunks;
}

/* ────────────────────────────── pieces ────────────────────────────── */

/** One crossfade for a swapping label: 100ms out, 160ms in with a 2px rise. */
function Swap({ id, children, className, reduced }: { id: string; children: ReactNode; className?: string; reduced: boolean }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={id}
        className={className}
        initial={{ opacity: 0, y: reduced ? 0 : 2 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.16, ease: EASE } }}
        exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE } }}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
}

interface StepperProps {
  current: number;
  furthest: number;
  done: boolean;
  onSelect: (step: number) => void;
  reduced: boolean;
}

function Stepper({ current, furthest, done, onSelect, reduced }: StepperProps) {
  return (
    <ol className={styles.stepper} aria-label="Setup steps">
      {STEPS.map((label, index) => {
        const isDone = done || index < current;
        const isCurrent = !done && index === current;
        const reachable = index <= furthest && !isCurrent;
        return (
          <li key={label.label} className={styles.stepItem}>
            <button
              type="button"
              className={styles.step}
              data-state={isDone ? "done" : isCurrent ? "current" : "upcoming"}
              disabled={!reachable}
              aria-current={isCurrent ? "step" : undefined}
              onClick={() => onSelect(index)}
            >
              <span className={styles.bar} aria-hidden="true">
                <motion.span
                  className={styles.barFill}
                  initial={false}
                  animate={{ scaleX: isDone || isCurrent ? 1 : 0 }}
                  transition={reduced ? { duration: 0 } : PAGE_SPRING}
                />
              </span>
              <span className={styles.stepLabel}>
                <span className={styles.stepGlyph} aria-hidden="true">
                  <Swap id={isDone ? "done" : "num"} reduced={reduced} className={styles.glyphInner}>
                    {isDone ? (
                      <Check size={18} strokeWidth={1.75} />
                    ) : (
                      <span className={styles.stepNum}>
                        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75}>
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                        <span className={styles.stepDigit}>{index + 1}</span>
                      </span>
                    )}
                  </Swap>
                </span>
                <span className={styles.stepText}>
                  <span className={styles.long}>{label.label}</span>
                  <span className={styles.short}>{label.short}</span>
                </span>
                <span className={styles.srOnly}>{isDone ? ", done" : isCurrent ? ", current" : ""}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function SourceRow({ source, state, onConnect, reduced }: { source: WizardSource; state: SourceState; onConnect: () => void; reduced: boolean }) {
  const { phase, progress } = state;
  const synced = Math.round(progress * source.count);
  const meta =
    phase === "connecting" ? (
      `Connecting to ${source.name}`
    ) : phase === "syncing" ? (
      <>
        <span className={styles.num}>{synced.toLocaleString("en-US")}</span> of {source.count.toLocaleString("en-US")} {source.unit}
      </>
    ) : phase === "synced" ? (
      `${source.count.toLocaleString("en-US")} ${source.unit} synced`
    ) : phase === "error" ? (
      `Couldn't connect. ${state.error ?? "Try again."}`
    ) : (
      `${source.description} \u00b7 ${source.count.toLocaleString("en-US")} ${source.unit}`
    );
  const action = phase === "synced" ? "synced" : phase === "syncing" ? "syncing" : "button";
  return (
    <li className={styles.row}>
      <span className={styles.rowMark} aria-hidden="true">
        {source.mark}
      </span>
      <span className={styles.rowText}>
        <span className={styles.rowName}>{source.name}</span>
        <span className={styles.rowMetaSlot} data-tone={phase === "error" ? "danger" : undefined}>
          <Swap id={phase === "syncing" ? "syncing" : phase} reduced={reduced} className={styles.rowMeta}>
            {phase === "error" ? <TriangleAlert size={12} strokeWidth={2.25} aria-hidden="true" /> : null}
            <span className={styles.truncate}>{meta}</span>
          </Swap>
        </span>
      </span>
      <span className={styles.rowAction}>
        <Swap id={action} reduced={reduced} className={styles.rowActionInner}>
          {action === "button" ? (
            <Button
              variant="secondary"
              size="sm"
              loading={phase === "connecting"}
              onClick={onConnect}
              aria-label={`${phase === "error" ? "Retry" : "Connect"} ${source.name}`}
            >
              {phase === "error" ? "Retry" : "Connect"}
            </Button>
          ) : action === "syncing" ? (
            <span className={styles.percent} aria-hidden="true">
              {Math.round(progress * 100)}%
            </span>
          ) : (
            <span className={styles.syncedTag}>
              <Check size={14} strokeWidth={2.25} aria-hidden="true" />
              Synced
            </span>
          )}
        </Swap>
      </span>
      <motion.span
        className={styles.progress}
        aria-hidden="true"
        initial={false}
        animate={{ scaleX: phase === "syncing" || phase === "synced" ? Math.max(progress, 0.02) : 0, opacity: +(phase === "syncing") }}
        transition={
          reduced
            ? { duration: 0 }
            : {
                scaleX: { duration: 0.12, ease: "linear" },
                opacity: { duration: phase === "synced" ? 0.32 : 0.12, delay: 0.12 * +(phase === "synced") },
              }
        }
      />
    </li>
  );
}

function ModelPicker({ models, value, onChange }: { models: WizardModel[]; value: string; onChange: (id: string) => void }) {
  const items = useRef<Array<HTMLButtonElement | null>>([]);
  return (
    <div className={styles.models} role="radiogroup" aria-label="Model">
      {models.map((model, index) => {
        const selected = model.id === value;
        return (
          <button
            key={model.id}
            ref={(node) => {
              items.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={model.note ? `${model.name}, ${model.note}` : model.name}
            tabIndex={selected ? 0 : -1}
            className={styles.model}
            data-selected={selected || undefined}
            onClick={() => onChange(model.id)}
            onKeyDown={(event) => {
              const delta =
                event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
              if (!delta) return;
              event.preventDefault();
              const next = (index + delta + models.length) % models.length;
              onChange(models[next].id);
              items.current[next]?.focus();
            }}
          >
            <span className={styles.modelMark} aria-hidden="true">
              {model.mark}
            </span>
            <motion.span
              className={styles.modelCheck}
              aria-hidden="true"
              initial={false}
              animate={{ opacity: +selected, scale: selected ? 1 : 0.8 }}
              transition={{ duration: 0.16, ease: EASE }}
            >
              <Check size={16} strokeWidth={2} />
            </motion.span>
            <span className={styles.modelName} title={model.name}>
              {model.shortName ?? model.name}
            </span>
            {model.note ? <span className={styles.modelNote}>{model.note}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** The streamed answer: one span per chunk, with `[1]` markers drawn as citation chips. */
function AnswerText({ chunks, shown }: { chunks: string[][]; shown: number }) {
  return (
    <p className={styles.answerText}>
      {chunks.slice(0, shown).map((chunk, chunkIndex) => (
        <span className={styles.chunk} key={chunkIndex}>
          {chunk.map((word, wordIndex) => {
            const marker = /^\[(\d+)\](\s*)$/.exec(word);
            if (!marker) return word;
            return (
              <span key={wordIndex}>
                <span className={styles.cite} aria-label={`source ${marker[1]}`}>
                  {marker[1]}
                </span>
                {marker[2]}
              </span>
            );
          })}
        </span>
      ))}
    </p>
  );
}

function Citations({
  citations,
  sources,
  visible,
  reduced,
}: {
  citations: WizardCitation[];
  sources: WizardSource[];
  visible: boolean;
  reduced: boolean;
}) {
  return (
    <ol className={styles.citations} aria-label="Sources">
      {visible
        ? citations.slice(0, 3).map((citation, index) => {
            const source = sources.find((item) => item.id === citation.sourceId);
            return (
              <motion.li
                key={`${citation.sourceId}-${index}`}
                className={styles.citation}
                initial={{ opacity: 0, y: reduced ? 0 : 2 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16, ease: EASE, delay: reduced ? 0 : 0.04 * index }}
              >
                <span className={styles.citeNum}>{index + 1}</span>
                <span className={styles.citeMark} aria-hidden="true">
                  {source?.mark}
                </span>
                <span className={styles.citeTitle}>{citation.title}</span>
                <span className={styles.citeSource}>{source?.name}</span>
              </motion.li>
            );
          })
        : null}
    </ol>
  );
}

/* ────────────────────────────── component ────────────────────────────── */

/**
 * A three step card for turning on an AI feature: connect data sources, choose the model and
 * guardrails, then ask a test question whose answer streams with numbered citations before going live.
 * With no props it plays the Ask Northwind sample end to end and loops until someone interacts.
 */
export function AiSetupWizard({
  featureName = "Ask Northwind",
  audience = "Answers for 48 agents in Northwind support",
  logo = <NorthwindMark />,
  sources = defaultSources,
  models = defaultModels,
  tones = defaultTones,
  guardrails = defaultGuardrails,
  suggestions = defaultSuggestions,
  defaultModelId,
  defaultTone,
  onConnect,
  onAsk,
  onGoLive,
  onStepChange,
  onConfigChange,
  autoPlay,
  className,
}: AiSetupWizardProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [furthest, setFurthest] = useState(0);
  const [sourceState, setSourceState] = useState<Record<string, SourceState>>({});
  const [modelId, setModelId] = useState(defaultModelId ?? models[0]?.id ?? "");
  const [tone, setTone] = useState(defaultTone ?? tones[0]?.value ?? "");
  const [rails, setRails] = useState<Record<string, boolean>>(() => railsOf(guardrails));
  const [question, setQuestion] = useState("");
  const [test, setTest] = useState<TestState>(EMPTY_TEST);
  const [goingLive, setGoingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [liveRuns, setLiveRuns] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const connects = useRef(new Map<string, AbortController>());
  const askAbort = useRef<AbortController | null>(null);
  const liveAbort = useRef<AbortController | null>(null);
  const autoAbort = useRef<AbortController | null>(null);
  const onScreen = useRef(true);
  const answerBody = useRef<HTMLDivElement>(null);

  /** No handlers means the sample demo, playing itself. */
  const simulated = !onConnect && !onAsk && !onGoLive;
  const autoPlayOn = (autoPlay ?? simulated) && !reduced;

  const connected = sources.filter((source) => sourceState[source.id]?.phase === "synced").map((source) => source.id);
  const syncing = sources.filter((source) => {
    const phase = sourceState[source.id]?.phase;
    return phase === "syncing" || phase === "connecting";
  }).length;
  const docCount = sources.reduce((total, source) => total + (connected.includes(source.id) ? source.count : 0), 0);
  const model = models.find((item) => item.id === modelId) ?? models[0];
  const toneLabel = tones.find((item) => item.value === tone)?.label ?? tone;
  const railsOn = guardrails.filter((rail) => rails[rail.id]).length;

  const config = useMemo<WizardConfig>(
    () => ({ sources: connected, modelId, tone, guardrails: rails }),
    // `connected` is rebuilt each render; its contents are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connected.join(","), modelId, tone, rails],
  );

  const chunks = useMemo(() => (test.answer ? chunkAnswer(test.answer.text) : []), [test.answer]);

  useEffect(() => {
    onConfigChange?.(config);
  }, [config, onConfigChange]);

  useEffect(() => {
    onStepChange?.(step);
  }, [step, onStepChange]);

  useEffect(
    () => () => {
      connects.current.forEach((controller) => controller.abort());
      askAbort.current?.abort();
      liveAbort.current?.abort();
    },
    [],
  );

  // The stream: one chunk every 34ms; reduced motion drops the whole answer at once.
  useEffect(() => {
    if (test.status !== "streaming") return;
    const finish = reduced || test.shown >= chunks.length;
    const timer = window.setTimeout(
      () => {
        if (finish) {
          setTest((prev) => ({ ...prev, status: "done", shown: chunks.length, elapsed: performance.now() - prev.startedAt }));
          setAnnouncement(`Answer ready with ${test.answer?.citations.length ?? 0} sources.${simulated ? " Simulated, nothing was sent." : ""}`);
        } else {
          setTest((prev) => ({ ...prev, shown: prev.shown + 1 }));
        }
      },
      finish && reduced ? 0 : 34,
    );
    return () => window.clearTimeout(timer);
  }, [test.status, test.shown, chunks.length, reduced, test.answer, simulated]);

  useEffect(() => {
    const node = answerBody.current;
    if (node && test.status === "streaming") node.scrollTop = node.scrollHeight;
  }, [test.shown, test.status]);

  const goTo = useCallback(
    (next: number) => {
      if (next === step) return;
      setDirection(next > step ? 1 : -1);
      setStep(next);
      setFurthest((prev) => Math.max(prev, Math.min(next, 2)));
      if (next < 3) setAnnouncement(`Step ${next + 1} of 3, ${STEPS[next].label}.`);
    },
    [step],
  );

  const connect = useCallback(
    (source: WizardSource) => {
      connects.current.get(source.id)?.abort();
      const controller = new AbortController();
      connects.current.set(source.id, controller);
      const set = (next: SourceState) => setSourceState((prev) => ({ ...prev, [source.id]: next }));
      set({ phase: "connecting", progress: 0 });
      (onConnect ?? simulateConnect)(
        source,
        (progress) => {
          if (controller.signal.aborted) return;
          set({ phase: "syncing", progress: Math.min(1, Math.max(0, progress)) });
        },
        controller.signal,
      ).then(
        () => {
          if (controller.signal.aborted) return;
          set({ phase: "synced", progress: 1 });
          setAnnouncement(`${source.name} synced, ${source.count.toLocaleString("en-US")} ${source.unit}.${onConnect ? "" : " Simulated, nothing was sent."}`);
        },
        (error: unknown) => {
          if (controller.signal.aborted) return;
          set({ phase: "error", progress: 0, error: messageOf(error, "Try again.") });
          setAnnouncement(`Couldn't connect ${source.name}.`);
        },
      );
    },
    [onConnect],
  );

  const ask = useCallback(
    (raw: string) => {
      const value = raw.trim();
      if (!value) return;
      askAbort.current?.abort();
      const controller = new AbortController();
      askAbort.current = controller;
      setQuestion("");
      setTest({ ...EMPTY_TEST, status: "thinking", question: value, startedAt: performance.now() });
      (onAsk ?? simulateAsk)(value, config, controller.signal).then(
        (answer) => {
          if (controller.signal.aborted) return;
          setTest((prev) => ({ ...prev, status: "streaming", answer, shown: 0 }));
        },
        (error: unknown) => {
          if (controller.signal.aborted) return;
          setTest((prev) => ({ ...prev, status: "error", error: messageOf(error, "Something went wrong.") }));
          setAnnouncement("Couldn't get an answer.");
        },
      );
    },
    [config, onAsk],
  );

  const goLive = useCallback(() => {
    liveAbort.current?.abort();
    const controller = new AbortController();
    liveAbort.current = controller;
    setGoingLive(true);
    setLiveError(null);
    (onGoLive ?? simulateGoLive)(config, controller.signal).then(
      () => {
        if (controller.signal.aborted) return;
        setGoingLive(false);
        setLive(true);
        setLiveRuns((count) => count + 1);
        setDirection(1);
        setStep(3);
        setAnnouncement(`${featureName} is live.${onGoLive ? "" : " Simulated, nothing went live."}`);
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setGoingLive(false);
        setLiveError(messageOf(error, "Try again."));
        setAnnouncement("Couldn't go live.");
      },
    );
  }, [config, featureName, onGoLive]);

  const reset = useCallback(() => {
    connects.current.forEach((controller) => controller.abort());
    connects.current.clear();
    askAbort.current?.abort();
    liveAbort.current?.abort();
    setDirection(-1);
    setStep(0);
    setFurthest(0);
    setSourceState({});
    setModelId(defaultModelId ?? models[0]?.id ?? "");
    setTone(defaultTone ?? tones[0]?.value ?? "");
    setRails(railsOf(guardrails));
    setQuestion("");
    setTest(EMPTY_TEST);
    setGoingLive(false);
    setLiveError(null);
    setLive(false);
    setLiveRuns(0);
    // `models`/`tones`/`guardrails` are the defaults a reset returns to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultModelId, defaultTone]);

  // The loop reads the latest state and handlers through refs, so it never restarts mid-flight.
  const latest = useRef({ step, sourceState, test });
  latest.current = { step, sourceState, test };
  const actions = useRef({ connect, goTo, ask, goLive, reset, setTone, setRails, setQuestion });
  actions.current = { connect, goTo, ask, goLive, reset, setTone, setRails, setQuestion };

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      onScreen.current = entry.isIntersecting;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!autoPlayOn) return;
    const controller = new AbortController();
    autoAbort.current = controller;
    const signal = controller.signal;
    /** Counts only while the card is on screen, so moving it off pauses the loop. */
    const hold = async (ms: number) => {
      let left = ms;
      while (left > 0) {
        await sleep(50, signal);
        if (onScreen.current) left -= 50;
      }
    };
    const until = async (done: () => boolean) => {
      while (!done()) await sleep(50, signal);
    };
    const target = sources.slice(0, 3);
    const firstQuestion = suggestions[0] ?? "How do I issue a partial refund?";
    void (async () => {
      for (;;) {
        await hold(800);
        for (const source of target) {
          actions.current.connect(source);
          await hold(360);
        }
        await until(() => target.every((source) => latest.current.sourceState[source.id]?.phase === "synced"));
        await hold(650);
        actions.current.goTo(1);
        await hold(850);
        if (tones[1]) actions.current.setTone(tones[1].value);
        await hold(650);
        const off = guardrails.find((rail) => !rail.defaultOn);
        if (off) actions.current.setRails((prev) => ({ ...prev, [off.id]: true }));
        await hold(800);
        actions.current.goTo(2);
        await hold(600);
        for (let index = 2; index <= firstQuestion.length; index += 2) {
          actions.current.setQuestion(firstQuestion.slice(0, index));
          await sleep(22, signal);
        }
        actions.current.setQuestion(firstQuestion);
        await hold(260);
        actions.current.ask(firstQuestion);
        await until(() => latest.current.test.status === "done");
        await hold(1500);
        actions.current.goLive();
        await until(() => latest.current.step === 3);
        await hold(3200);
        actions.current.reset();
      }
    })().catch(() => {
      /* aborted: the loop is over */
    });
    return () => controller.abort();
    // The loop is pinned to the props it started with; changing them restarts it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlayOn]);

  /** The first press anywhere in the card ends the self playing demo for good. */
  const stopAuto = () => {
    autoAbort.current?.abort();
    autoAbort.current = null;
  };

  const answering = test.status === "thinking" || test.status === "streaming";
  const canContinue = step !== 0 || connected.length > 0;
  const primaryLabel =
    step === 3 ? "Edit setup" : step === 2 ? (liveError ? "Try again" : live ? "Publish changes" : "Go live") : "Continue";

  const progressMeta = (() => {
    if (step === 0) {
      return connected.length
        ? `${connected.length} ${connected.length === 1 ? "source" : "sources"} \u00b7 ${docCount.toLocaleString("en-US")} documents`
        : syncing
          ? `Syncing ${syncing} ${syncing === 1 ? "source" : "sources"}`
          : "Connect at least one source";
    }
    if (step === 1) {
      return `${model?.shortName ?? model?.name} \u00b7 ${toneLabel} \u00b7 ${railsOn} ${railsOn === 1 ? "guardrail" : "guardrails"} on`;
    }
    if (step === 2) {
      return liveError
        ? `Couldn't go live. ${liveError}`
        : test.status === "done"
          ? `Answered in ${(test.elapsed / 1000).toFixed(1)}s by ${model?.shortName ?? model?.name}`
          : answering
            ? `Answering with ${model?.shortName ?? model?.name}`
            : test.status === "error"
              ? "Test failed"
              : simulated
                ? "Simulated, nothing is sent"
                : "Test before you go live";
    }
    return simulated ? "Simulated, nothing went live" : `${featureName} is live`;
  })();

  const pageVariants: Variants = {
    initial: (dir: number) => ({ x: reduced ? 0 : 32 * dir, opacity: 0 }),
    center: { x: 0, opacity: 1, transition: { x: PAGE_SPRING, opacity: { duration: 0.16, ease: EASE } } },
    exit: (dir: number) => ({ x: reduced ? 0 : -32 * dir, opacity: 0, transition: { x: PAGE_SPRING, opacity: { duration: 0.12, ease: EASE } } }),
  };
  const fade = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.16, ease: EASE } },
    exit: { opacity: 0, transition: { duration: 0.1 } },
  };

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      onPointerDownCapture={stopAuto}
      onKeyDownCapture={stopAuto}
    >
      <header className={styles.header}>
        <div className={styles.brand}>
          {logo ? (
            <span className={styles.logo} aria-hidden="true">
              {logo}
            </span>
          ) : null}
          <div className={styles.headText}>
            <h3 className={styles.title}>Set up {featureName}</h3>
            <p className={styles.audience}>{audience}</p>
          </div>
        </div>
        <span className={styles.status} data-live={live || undefined}>
          <span className={styles.statusIcon} aria-hidden="true">
            <Swap id={live ? "live" : "draft"} reduced={reduced} className={styles.glyphInner}>
              {live ? <Check size={14} strokeWidth={2.25} /> : <CircleDashed size={14} strokeWidth={2.25} />}
            </Swap>
          </span>
          <span className={styles.statusText}>
            <Swap id={live ? "live" : "draft"} reduced={reduced}>
              {live ? "Live" : "Draft"}
            </Swap>
          </span>
        </span>
      </header>

      <Stepper current={Math.min(step, 2)} furthest={furthest} done={step === 3} onSelect={goTo} reduced={reduced} />

      <div className={styles.viewport}>
        <AnimatePresence initial={false} custom={direction}>
          <motion.section
            key={step}
            className={styles.page}
            custom={direction}
            variants={pageVariants}
            initial="initial"
            animate="center"
            exit="exit"
            aria-label={step < 3 ? STEPS[step].label : "Live"}
          >
            {step === 0 ? (
              <>
                <div className={styles.labelRow}>
                  <span>Sources</span>
                  <span className={styles.labelMeta}>
                    <span>
                      <span className={styles.num}>{connected.length}</span> of {sources.length} connected
                    </span>
                  </span>
                </div>
                <ul className={styles.list}>
                  {sources.slice(0, 4).map((source) => (
                    <SourceRow
                      key={source.id}
                      source={source}
                      state={sourceState[source.id] ?? IDLE_SOURCE}
                      onConnect={() => connect(source)}
                      reduced={reduced}
                    />
                  ))}
                </ul>
                <p className={styles.hint}>
                  <LockKeyhole size={14} strokeWidth={2} aria-hidden="true" />
                  <span>Read only. Answers respect each source&apos;s permissions.</span>
                </p>
              </>
            ) : step === 1 ? (
              <>
                <div className={styles.labelRow}>
                  <span>Model</span>
                </div>
                <ModelPicker models={models.slice(0, 3)} value={modelId} onChange={setModelId} />
                <div className={[styles.list, styles.settings].join(" ")}>
                  <div className={styles.setRow}>
                    <span className={styles.setLabel}>Tone</span>
                    <SegmentedControl className={styles.tone} options={tones} value={tone} onValueChange={setTone} label="Tone" />
                  </div>
                  {guardrails.slice(0, 3).map((rail) => (
                    <label key={rail.id} className={styles.setRow} htmlFor={`${uid}-${rail.id}`}>
                      <span className={styles.setLabel}>{rail.label}</span>
                      <Switch
                        id={`${uid}-${rail.id}`}
                        checked={rails[rail.id] ?? false}
                        onCheckedChange={(checked) => setRails((prev) => ({ ...prev, [rail.id]: checked }))}
                        aria-label={rail.label}
                      />
                    </label>
                  ))}
                </div>
              </>
            ) : step === 2 ? (
              <>
                <div className={styles.labelRow}>
                  <label htmlFor={uid}>Test question</label>
                  <span className={styles.labelMeta}>
                    <span className={styles.metaMark} aria-hidden="true">
                      {model?.mark}
                    </span>
                    {model?.name}
                  </span>
                </div>
                <form
                  className={styles.composer}
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (answering) {
                      askAbort.current?.abort();
                      setTest((prev) => ({ ...prev, status: prev.status === "streaming" ? "stopped" : "idle" }));
                      setAnnouncement("Stopped.");
                    } else {
                      ask(question);
                    }
                  }}
                >
                  <input
                    id={uid}
                    className={styles.input}
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="Ask what your team asks every week"
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    className={styles.send}
                    disabled={!answering && !question.trim()}
                    aria-label={answering ? "Stop" : "Ask"}
                  >
                    <Swap id={answering ? "stop" : "send"} reduced={reduced} className={styles.glyphInner}>
                      {answering ? <Square size={12} strokeWidth={0} fill="currentColor" /> : <ArrowUp size={16} strokeWidth={2.25} />}
                    </Swap>
                  </button>
                </form>
                <div className={styles.answer}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {test.status === "idle" ? (
                      <motion.div key="empty" className={styles.empty} {...fade}>
                        <p className={styles.emptyText}>
                          Answers only use the {connected.length === 1 ? "source" : `${connected.length} sources`} you connected. Try one of these:
                        </p>
                        <ul className={styles.suggestions}>
                          {suggestions.slice(0, 3).map((suggestion) => (
                            <li key={suggestion}>
                              <button type="button" className={styles.suggestion} onClick={() => ask(suggestion)}>
                                <Sparkles size={14} strokeWidth={2} aria-hidden="true" />
                                <span className={styles.truncate}>{suggestion}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    ) : (
                      <motion.div key={`answer-${test.startedAt}`} className={styles.result} {...fade}>
                        <p className={styles.question}>{test.question}</p>
                        <div ref={answerBody} className={styles.answerBody} aria-live="off">
                          {test.status === "thinking" ? (
                            <TextShimmer className={styles.thinking}>{`Searching ${docCount.toLocaleString("en-US")} documents`}</TextShimmer>
                          ) : test.status === "error" ? (
                            <div className={styles.error}>
                              <span className={styles.errorText}>
                                <TriangleAlert size={14} strokeWidth={2.25} aria-hidden="true" />
                                {`Couldn't get an answer. ${test.error ?? ""}`}
                              </span>
                              <Button variant="secondary" size="sm" onClick={() => ask(test.question)}>
                                Retry
                              </Button>
                            </div>
                          ) : (
                            <AnswerText chunks={chunks} shown={test.shown} />
                          )}
                          {test.status === "stopped" ? <p className={styles.stopped}>Stopped</p> : null}
                        </div>
                        <Citations citations={test.answer?.citations ?? []} sources={sources} visible={test.status === "done"} reduced={reduced} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <div className={styles.live}>
                <svg className={styles.liveCheck} viewBox="0 0 40 40" aria-hidden="true">
                  <motion.circle
                    cx="20"
                    cy="20"
                    r="18.25"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    initial={{ pathLength: reduced ? 1 : 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.36, ease: EASE }}
                  />
                  <motion.path
                    d="M13 20.5l4.75 4.75L27.5 15.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: reduced ? 1 : 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.24, ease: EASE, delay: reduced ? 0 : 0.22 }}
                  />
                </svg>
                <h4 className={styles.liveTitle}>{liveRuns > 1 ? "Your changes are live" : `${featureName} is live`}</h4>
                <p className={styles.liveText}>
                  Agents can ask it from any ticket. It answers from {connected.length} {connected.length === 1 ? "source" : "sources"} and cites each one.
                </p>
                <dl className={styles.summary}>
                  <div className={styles.sumRow}>
                    <dt>Sources</dt>
                    <dd>
                      <span className={styles.marks} aria-hidden="true">
                        {sources
                          .filter((source) => connected.includes(source.id))
                          .map((source) => (
                            <span key={source.id} className={styles.sumMark}>
                              {source.mark}
                            </span>
                          ))}
                      </span>
                      {docCount.toLocaleString("en-US")} documents
                    </dd>
                  </div>
                  <div className={styles.sumRow}>
                    <dt>Model</dt>
                    <dd>
                      <span className={styles.sumMark} aria-hidden="true">
                        {model?.mark}
                      </span>
                      {model?.name}
                    </dd>
                  </div>
                  <div className={styles.sumRow}>
                    <dt>Behavior</dt>
                    <dd>
                      {toneLabel} {"\u00b7"} {railsOn} {railsOn === 1 ? "guardrail" : "guardrails"} on
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      <footer className={styles.footer}>
        <span className={styles.footerMeta} data-tone={step === 2 && liveError ? "danger" : undefined}>
          <Swap
            id={`${step}-${liveError ? "error" : test.status === "done" ? "done" : "base"}`}
            reduced={reduced}
            className={styles.footerMetaInner}
          >
            {step === 2 && liveError ? <TriangleAlert size={14} strokeWidth={2.25} aria-hidden="true" /> : null}
            <span className={styles.truncate}>{progressMeta}</span>
          </Swap>
        </span>
        <div className={styles.actions}>
          <Button
            variant="ghost"
            className={styles.back}
            data-hidden={step === 0 || step === 3 || undefined}
            disabled={step === 0 || step === 3 || goingLive}
            onClick={() => goTo(step - 1)}
          >
            Back
          </Button>
          <Button
            variant={step === 3 ? "secondary" : "primary"}
            disabled={!canContinue}
            loading={goingLive}
            onClick={() => {
              if (step === 3) goTo(1);
              else if (step === 2) goLive();
              else goTo(step + 1);
            }}
          >
            {goingLive ? "Going live" : primaryLabel}
          </Button>
        </div>
      </footer>

      <p className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

export default AiSetupWizard;
