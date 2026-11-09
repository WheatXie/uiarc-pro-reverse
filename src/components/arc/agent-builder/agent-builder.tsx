"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, SVGProps } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import type { TargetAndTransition, Transition } from "motion/react";
import { AlertTriangle, ArrowUp, Check, ChevronDown, CircleDot, FileText, Plus, RotateCcw, RotateCw, Square, X } from "lucide-react";
import Button from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import Switch from "../switch/switch";
import TextShimmer from "../text-shimmer/text-shimmer";
import styles from "./agent-builder.module.css";

/** A knowledge file attached to the agent. `uploading` rows show live progress, `error` rows a message and a retry action. */
export interface AgentFile {
  id: string;
  name: string;
  /** Byte size, used for the row's file size label. */
  size: number;
  status: "uploading" | "ready" | "error";
  /** Upload progress from 0 to 1 while `status` is `uploading`. */
  progress?: number;
  /** Failure message shown on an `error` row. */
  error?: string;
}

/** Everything that defines an agent: its name and accent, model, instructions, enabled tools and knowledge files. */
export interface AgentConfig {
  name: string;
  /** Avatar accent, 1 through 4. */
  tint: 1 | 2 | 3 | 4;
  modelId: string;
  instructions: string;
  /** Ids of the enabled tools. Order is preserved as the user toggles them. */
  tools: string[];
  files: AgentFile[];
}

/** One selectable model. Supply `mark` to show a brand icon in the picker and its trigger. */
export interface AgentModel {
  id: string;
  name: string;
  /** Short qualifier shown at the end of the picker row, such as "Balanced". */
  note?: string;
  mark?: ReactNode;
}

/** One tool the agent can call, with the switch row's name and one-line description. */
export interface AgentTool {
  id: string;
  name: string;
  description: string;
  mark?: ReactNode;
}

/** A single tool call reported inside a test reply. */
export interface TestCall {
  /** Id of the tool that ran, or `knowledge` for a file lookup. */
  tool: string;
  /** Present-participle label shown while the call runs, such as "Searched customers". */
  label: string;
  /** Short result revealed once the call completes. */
  result?: string;
}

/** What the agent replies with in the Test view. */
export interface TestReply {
  text: string;
  calls?: TestCall[];
}

/** Everything the builder needs to read and write. */
export interface AgentBuilderProps {
  /** Controlled config. Leave it out to let the card hold its own draft. */
  config?: AgentConfig;
  /** Starting config for an uncontrolled card. Passing it also turns off the sample upload. */
  defaultConfig?: AgentConfig;
  /** Called with the whole config after every edit. */
  onConfigChange?: (config: AgentConfig) => void;
  /** The last published config; unsaved changes are measured against it. Defaults to the starting config. */
  publishedConfig?: AgentConfig;
  /** Models offered by the picker. Defaults to `defaultModels`. */
  models?: AgentModel[];
  /** Tools offered by the switch list. Defaults to `defaultTools`. */
  tools?: AgentTool[];
  /** Publishes the config. Resolving bumps the version and marks the draft saved; rejecting shows "Couldn't publish". */
  onPublish?: (config: AgentConfig, signal: AbortSignal) => Promise<void>;
  /** Uploads one knowledge file. Call `report` with progress from 0 to 1. Rejecting with an Error marks the row failed and offers a retry; the signal aborts when the row is removed. Simulated when absent, and files over 20 MB fail. */
  onUpload?: (file: File, report: (progress: number) => void, signal: AbortSignal) => Promise<void>;
  /** Answers a test message. Defaults to `simulateReply`. */
  onSend?: (message: string, config: AgentConfig, signal: AbortSignal) => Promise<TestReply>;
  /** Current published version, shown beside the workspace. */
  version?: number;
  /** Workspace name shown under the agent name. */
  workspace?: string;
  /** Character limit for the instructions field; the count warns past 90%. */
  maxInstructions?: number;
  /** Accepted file types for the knowledge input. */
  accept?: string;
  /** Controlled view. */
  mode?: "configure" | "test";
  /** View for an uncontrolled card. */
  defaultMode?: "configure" | "test";
  onModeChange?: (mode: "configure" | "test") => void;
  className?: string;
}

const suggestions = [
  "A customer says they were charged twice in October",
  "CSV export is broken for team workspaces",
  "Can we book a call about the Enterprise plan?",
];

/** Crossfade used when rows or status lines appear; short and level, so text never slides far. */
const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];
const fade: Transition = { duration: 0.14, ease };
const rise: TargetAndTransition = { opacity: 0, y: 2 };
const out: TargetAndTransition = { opacity: 0, transition: { duration: 0.1 } };
/** A single text swap: the new line rises 2px as it fades in, the old one just fades out. */
const swap: { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition } = {
  initial: { opacity: 0, y: 2 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.16, ease } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

const claudePath = "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z";

type MarkProps = SVGProps<SVGSVGElement> & { title?: string };

/** Claude's starburst, in its own warm tint so the picker reads at a glance. */
function ClaudeMark({ title = "Claude", ...props }: MarkProps) {
  return <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}><path d={claudePath} /></svg>;
}

/** OpenAI's knot, drawn in the current text color. */
function OpenAIMark({ title = "OpenAI", ...props }: MarkProps) {
  return <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" /></svg>;
}

/** Gemini's four-point star, layered as three gradients over a base fill. */
function GeminiMark({ title = "Gemini", ...props }: MarkProps) {
  const suffix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const star = "M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z";
  return <svg viewBox="0 0 24 24" role="img" aria-label={title} {...props}>
    <path d={star} fill="#3186FF" />
    <path d={star} fill={`url(#lobe-icons-gemini-0-${suffix})`} />
    <path d={star} fill={`url(#lobe-icons-gemini-1-${suffix})`} />
    <path d={star} fill={`url(#lobe-icons-gemini-2-${suffix})`} />
    <defs>
      <linearGradient gradientUnits="userSpaceOnUse" id={`lobe-icons-gemini-0-${suffix}`} x1="7" x2="11" y1="15.5" y2="12"><stop stopColor="#08B962" /><stop offset="1" stopColor="#08B962" stopOpacity="0" /></linearGradient>
      <linearGradient gradientUnits="userSpaceOnUse" id={`lobe-icons-gemini-1-${suffix}`} x1="8" x2="11.5" y1="5.5" y2="11"><stop stopColor="#F94543" /><stop offset="1" stopColor="#F94543" stopOpacity="0" /></linearGradient>
      <linearGradient gradientUnits="userSpaceOnUse" id={`lobe-icons-gemini-2-${suffix}`} x1="3.5" x2="17.5" y1="13.5" y2="12"><stop stopColor="#FABC12" /><stop offset=".46" stopColor="#FABC12" stopOpacity="0" /></linearGradient>
    </defs>
  </svg>;
}

function GmailMark({ title = "Gmail", ...props }: MarkProps) {
  return <svg viewBox="0 0 24 24" role="img" aria-label={title} {...props}><path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" /></svg>;
}

function SlackMark({ title = "Slack", ...props }: MarkProps) {
  return <svg viewBox="0 0 24 24" role="img" aria-label={title} {...props}>
    <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" />
    <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" />
    <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" />
    <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
  </svg>;
}

function LinearMark({ title = "Linear", ...props }: MarkProps) {
  return <svg viewBox="0 0 24 24" role="img" aria-label={title} {...props}><path fill="#5E6AD2" d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" /></svg>;
}

function NotionMark({ title = "Notion", ...props }: MarkProps) {
  return <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}><path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" /></svg>;
}

function CalendarMark({ title = "Google Calendar", ...props }: MarkProps) {
  return <svg viewBox="0 0 24 24" role="img" aria-label={title} {...props}><path fill="#4285F4" d="M18.316 5.684H24v12.632h-5.684V5.684zM5.684 24h12.632v-5.684H5.684V24zM18.316 5.684V0H1.895A1.894 1.894 0 0 0 0 1.895v16.421h5.684V5.684h12.632zm-7.207 6.25v-.065c.272-.144.5-.349.687-.617s.279-.595.279-.982c0-.379-.099-.72-.3-1.025a2.05 2.05 0 0 0-.832-.714 2.703 2.703 0 0 0-1.197-.257c-.6 0-1.094.156-1.481.467-.386.311-.65.671-.793 1.078l1.085.452c.086-.249.224-.461.413-.633.189-.172.445-.257.767-.257.33 0 .602.088.816.264a.86.86 0 0 1 .322.703c0 .33-.12.589-.36.778-.24.19-.535.284-.886.284h-.567v1.085h.633c.407 0 .748.109 1.02.327.272.218.407.499.407.843 0 .336-.129.614-.387.832s-.565.327-.924.327c-.351 0-.651-.103-.897-.311-.248-.208-.422-.502-.521-.881l-1.096.452c.178.616.505 1.082.977 1.401.472.319.984.478 1.538.477a2.84 2.84 0 0 0 1.293-.291c.382-.193.684-.458.902-.794.218-.336.327-.72.327-1.149 0-.429-.115-.797-.344-1.105a2.067 2.067 0 0 0-.881-.689zm2.093-1.931l.602.913L15 10.045v5.744h1.187V8.446h-.827l-2.158 1.557zM22.105 0h-3.289v5.184H24V1.895A1.894 1.894 0 0 0 22.105 0zm-3.289 23.5l4.684-4.684h-4.684V23.5zM0 22.105C0 23.152.848 24 1.895 24h3.289v-5.184H0v3.289z" /></svg>;
}

function StripeMark({ title = "Stripe", ...props }: MarkProps) {
  return <svg viewBox="0 0 24 24" role="img" aria-label={title} {...props}><path fill="#635BFF" d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" /></svg>;
}

/** The models offered by the picker when none are supplied. */
export const defaultModels: AgentModel[] = [
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", note: "Balanced", mark: <ClaudeMark className={styles.claude} /> },
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", note: "Most capable", mark: <ClaudeMark className={styles.claude} /> },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", note: "Fastest", mark: <ClaudeMark className={styles.claude} /> },
  { id: "gpt-6-1-sol", name: "GPT-6.1 Sol", note: "OpenAI", mark: <OpenAIMark /> },
  { id: "gemini-4-argon", name: "Gemini 4 Argon", note: "Google", mark: <GeminiMark /> },
];

/** The tools offered by the switch list when none are supplied. */
export const defaultTools: AgentTool[] = [
  { id: "gmail", name: "Gmail", description: "Read threads and draft replies", mark: <GmailMark /> },
  { id: "slack", name: "Slack", description: "Post in #support-escalations", mark: <SlackMark /> },
  { id: "linear", name: "Linear", description: "Create and update issues", mark: <LinearMark /> },
  { id: "notion", name: "Notion", description: "Search the help center", mark: <NotionMark /> },
  { id: "calendar", name: "Google Calendar", description: "Book calls with the sales team", mark: <CalendarMark /> },
  { id: "stripe", name: "Stripe", description: "Look up customers and charges", mark: <StripeMark /> },
];

/** The sample card's starting config, including the knowledge file whose upload runs on screen. */
export const sampleAgentConfig: AgentConfig = {
  name: "Billing assistant",
  tint: 1,
  modelId: "claude-sonnet-5-5",
  instructions: "You are the billing assistant for Lumen's support team. Answer questions about invoices, refunds and plan changes in a friendly, concise tone. Always look up the customer in Stripe before quoting amounts. Refunds over $200 need a human: draft the reply and flag it in #support-escalations. Never promise dates for product fixes; file a Linear issue instead.",
  tools: ["gmail", "slack", "linear", "notion", "stripe"],
  files: [
    { id: "refund-policy", name: "Refund policy 2026.pdf", size: 253952, status: "ready" },
    { id: "pricing", name: "Plans and pricing, October 2026.md", size: 36864, status: "ready" },
    { id: "macros", name: "Support macros.csv", size: 1468006.4, status: "uploading", progress: 0 },
  ],
};

/** A stable signature of everything worth publishing. Upload progress and error text are ignored. */
function signature(config: AgentConfig) {
  return JSON.stringify([
    config.name.trim(),
    config.tint,
    config.modelId,
    config.instructions.trim(),
    [...config.tools].sort(),
    config.files.filter(file => file.status === "ready").map(file => file.id),
  ]);
}

/** A timeout that also rejects when the caller's signal aborts, so a stopped reply stops immediately. */
function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { window.clearTimeout(timer); reject(signal.reason); }, { once: true });
  });
}

/** Splits a reply into 3–6 word chunks; each chunk is its own span so the text streams in place. */
function chunkText(text: string) {
  const words = text.split(/(?<=\s)/);
  const chunks: string[] = [];
  let index = 0;
  let size = 4;
  while (index < words.length) {
    chunks.push(words.slice(index, index + size).join(""));
    index += size;
    size = 3 + ((7 * size + index) % 4);
  }
  return chunks;
}

/** Stand-in uploader: 14 uneven steps, and anything over 20 MB fails after half a second. */
async function simulateUpload(size: number, report: (progress: number) => void, signal: AbortSignal) {
  if (size > 0x1400000) {
    await sleep(500, signal);
    throw new Error("Over the 20 MB limit");
  }
  for (let step = 1; step <= 14; step += 1) {
    await sleep(70 + ((37 * step) % 90), signal);
    report(Math.min(1, step / 14 + ((13 * step) % 5) / 100));
  }
  report(1);
}

/**
 * Canned replies for the Test view: billing, bug reports and booking requests each answer with the tools that are switched on.
 * When the tool a branch needs is off, the reply says so instead of pretending it ran.
 */
export function simulateReply(message: string, config: AgentConfig): TestReply {
  const text = message.toLowerCase();
  const has = (tool: string) => config.tools.includes(tool);

  if (/charge|refund|invoice|billed|payment/.test(text)) {
    if (!has("stripe")) return { text: "I can't check charges because Stripe is turned off for this agent. Turn it on in Configure and I'll look up the account before answering." };
    const calls: TestCall[] = [{ tool: "stripe", label: "Searched customers", result: "2 charges on Oct 14" }];
    const file = config.files.find(entry => entry.status === "ready" && /refund/i.test(entry.name));
    if (file) calls.push({ tool: "knowledge", label: `Read ${file.name}`, result: "Section 2.1" });
    const gmail = has("gmail");
    if (gmail) calls.push({ tool: "gmail", label: "Drafted reply", result: "maya@northwind.studio" });
    const policy = file ? " The refund policy allows a full refund for duplicates within 30 days." : "";
    return {
      calls,
      text: `Maya Chen at Northwind was charged $49.00 twice on Oct 14. The second charge is a duplicate from a retried payment.${policy}${gmail ? " I drafted a reply to Maya and can refund $49.00 once you approve." : " Want me to refund the duplicate $49.00?"}`,
    };
  }

  if (/bug|broken|error|fail|export|crash/.test(text)) {
    const calls: TestCall[] = [];
    if (has("linear")) calls.push({ tool: "linear", label: "Created issue", result: "ENG-2481" });
    if (has("slack")) calls.push({ tool: "slack", label: "Posted message", result: "#support-escalations" });
    if (!calls.length) return { text: "This looks like a product bug, but Linear and Slack are turned off, so I can't file or escalate it. Turn one on in Configure and I'll take it from there." };
    const filed = has("linear") ? 'I filed ENG-2481, "CSV export fails for team workspaces", with the customer\'s steps' : "Linear is off, so I couldn't file an issue";
    const flagged = has("slack") ? " and flagged it in #support-escalations." : ".";
    return { calls, text: `${filed}${flagged} I told the customer the team is on it, without promising a date. I'll follow up when the issue moves to In progress.` };
  }

  if (/call|meeting|demo|book|schedule|enterprise/.test(text)) {
    if (!has("calendar")) {
      return {
        calls: has("notion") ? [{ tool: "notion", label: "Searched help center", result: "Enterprise plan" }] : [],
        text: "Google Calendar is turned off, so I can't book time directly. Turn it on in Configure, or I can share the sales team's booking link from the Enterprise plan page.",
      };
    }
    const calls: TestCall[] = [{ tool: "calendar", label: "Booked call", result: "Thu, Oct 29, 10:00" }];
    if (has("gmail")) calls.push({ tool: "gmail", label: "Sent invite", result: "ryan@lumen.so" });
    return { text: "I booked a 30 minute call with Ryan Sullivan, our account executive, for Thursday, Oct 29 at 10:00 CET. The invite includes the Enterprise plan overview so they can review it first.", calls };
  }

  const calls: TestCall[] = has("notion") ? [{ tool: "notion", label: "Searched help center", result: "3 articles" }] : [];
  return {
    calls,
    text: calls.length
      ? 'I found three help center articles that cover this. The closest match is "Changing your plan mid cycle", which explains prorated credits. Want me to draft a reply that links it?'
      : "I can help with billing questions, refunds and plan changes. Turn on Notion in Configure so I can search the help center for an exact answer.",
  };
}

type Call = TestCall & { done: boolean };

interface UserTurn { id: number; role: "user"; text: string }
interface AgentTurn { id: number; role: "agent"; phase: "thinking" | "tools" | "streaming" | "done" | "error" | "stopped"; calls: Call[]; chunks: string[]; meta?: string }
type Turn = UserTurn | AgentTurn;

interface TestViewProps {
  config: AgentConfig;
  model?: AgentModel;
  tools: AgentTool[];
  active: boolean;
  reduced: boolean;
  avatar: ReactNode;
  onSend?: (message: string, config: AgentConfig, signal: AbortSignal) => Promise<TestReply>;
  announce: (message: string) => void;
}

/** The Test view: a small thread with tool chips and a streamed reply, over the same config the card edits. */
function TestView({ config, model, tools, active, reduced, avatar, onSend, announce }: TestViewProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nearBottom = useRef(true);
  const latest = useRef(config);
  useLayoutEffect(() => { latest.current = config; }, [config]);

  // Only the agent turn at the tail is edited; a stale timer after Reset can't invent a turn.
  const updateLast = useCallback((update: (turn: AgentTurn) => AgentTurn) => {
    setTurns(previous => {
      const last = previous[previous.length - 1];
      if (!last || last.role !== "agent") return previous;
      return [...previous.slice(0, -1), update(last)];
    });
  }, []);

  const stop = useCallback(() => {
    const controller = abortRef.current;
    if (!controller) return;
    controller.abort();
    abortRef.current = null;
    setRunning(false);
    updateLast(turn => turn.phase === "done" ? turn : { ...turn, phase: "stopped", meta: "Stopped" });
  }, [updateLast]);

  // Switching back to Configure cancels the reply, so hidden work never talks to the live region.
  useEffect(() => { if (!active) stop(); }, [active, stop]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(async (message: string) => {
    const text = message.trim();
    if (!text) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;
    const startedAt = performance.now();
    setInput("");
    setRunning(true);
    setTurns(previous => [...previous,
      { id: nextId.current++, role: "user", text },
      { id: nextId.current++, role: "agent", phase: "thinking", calls: [], chunks: [] },
    ]);
    try {
      const current = latest.current;
      const [reply] = await Promise.all([
        onSend ? onSend(text, current, signal) : Promise.resolve(simulateReply(text, current)),
        sleep(reduced ? 200 : 700, signal),
      ]);
      for (const call of reply.calls ?? []) {
        updateLast(turn => ({ ...turn, phase: "tools", calls: [...turn.calls, { ...call, done: false }] }));
        await sleep(reduced ? 120 : 460, signal);
        updateLast(turn => ({ ...turn, calls: turn.calls.map((entry, index) => index === turn.calls.length - 1 ? { ...entry, done: true } : entry) }));
        await sleep(80, signal);
      }
      if (reduced) {
        updateLast(turn => ({ ...turn, phase: "streaming", chunks: [reply.text] }));
      } else {
        for (const chunk of chunkText(reply.text)) {
          updateLast(turn => ({ ...turn, phase: "streaming", chunks: [...turn.chunks, chunk] }));
          await sleep(34, signal);
        }
      }
      const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
      updateLast(turn => ({ ...turn, phase: "done", meta: `${model?.name ?? "Model"} · ${seconds}s` }));
      const count = reply.calls?.length ?? 0;
      announce(onSend ? `Reply ready, ${count} tool ${count === 1 ? "call" : "calls"}.` : `Simulated reply, ${count} tool ${count === 1 ? "call" : "calls"}. Nothing was sent.`);
    } catch (error) {
      if (signal.aborted) return;
      updateLast(turn => ({ ...turn, phase: "error", meta: "No reply" }));
      announce(error instanceof Error && error.message ? error.message : "The test reply failed.");
    } finally {
      if (abortRef.current === controller) { abortRef.current = null; setRunning(false); }
    }
  }, [announce, model?.name, onSend, reduced, updateLast]);

  // Follow the conversation only while the reader is already at the bottom.
  useLayoutEffect(() => {
    const node = threadRef.current;
    if (node && nearBottom.current) node.scrollTop = node.scrollHeight;
  }, [turns]);

  const toolCount = config.tools.length;
  const fileCount = config.files.filter(file => file.status === "ready").length;

  return <div className={styles.test}>
    <div className={styles.testHead}>
      <span className={styles.testMeta}>
        <span className={styles.testModel}>{model?.mark}{model?.name ?? "No model"}</span>
        <span aria-hidden="true">·</span>
        <span className={styles.nums}>{toolCount} {toolCount === 1 ? "tool" : "tools"}</span>
        <span aria-hidden="true">·</span>
        <span className={styles.nums}>{fileCount} {fileCount === 1 ? "file" : "files"}</span>
      </span>
      <Button type="button" variant="ghost" size="sm" onClick={() => {
        abortRef.current?.abort();
        abortRef.current = null;
        setRunning(false);
        setTurns([]);
        announce("Conversation cleared.");
        inputRef.current?.focus();
      }} disabled={!turns.length} aria-label="Clear conversation"><RotateCcw aria-hidden="true" />Reset</Button>
    </div>
    <div ref={threadRef} className={styles.thread} onScroll={event => {
      const node = event.currentTarget;
      nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 24;
    }}>
      {turns.length === 0
        ? <div className={styles.testEmpty}>
          <p className={styles.testEmptyTitle}>Try {config.name.trim() || "your agent"}</p>
          <p className={styles.testEmptyText}>Replies use the model and tools you configured. Nothing is sent.</p>
          <div className={styles.suggestions}>
            {suggestions.map(suggestion => <button key={suggestion} type="button" className={styles.suggestion} onClick={() => void send(suggestion)} tabIndex={active ? 0 : -1}>{suggestion}</button>)}
          </div>
        </div>
        : <ol className={styles.turns} aria-label="Test conversation">
          {turns.map(turn => turn.role === "user"
            ? <motion.li key={turn.id} className={styles.userTurn} initial={!reduced && { opacity: 0 }} animate={{ opacity: 1 }} transition={fade}><span className={styles.bubble}>{turn.text}</span></motion.li>
            : <motion.li key={turn.id} className={styles.agentTurn} initial={!reduced && { opacity: 0 }} animate={{ opacity: 1 }} transition={fade} aria-busy={turn.phase === "thinking" || turn.phase === "tools" || turn.phase === "streaming"}>
              <div className={styles.agentHead}>
                {avatar}
                <span className={styles.agentName}>{config.name.trim() || "Agent"}</span>
                <span className={styles.agentMeta}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span key={turn.meta ?? turn.phase} initial={!reduced && rise} animate={{ opacity: 1, y: 0 }} exit={out} transition={{ duration: 0.16, ease }} className={turn.phase === "error" ? styles.metaError : undefined}>
                      {turn.meta ?? <TextShimmer>{turn.phase === "thinking" ? "Thinking" : turn.phase === "tools" ? "Using tools" : "Writing"}</TextShimmer>}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </div>
              {turn.calls.length > 0
                ? <ul className={styles.calls} aria-label="Tool calls">
                  {turn.calls.map((call, index) => <motion.li key={index} className={styles.call} data-done={call.done || undefined} initial={!reduced && { opacity: 0 }} animate={{ opacity: 1 }} transition={fade}>
                    <span className={styles.callMark}>{call.tool === "knowledge" ? <FileText aria-hidden="true" /> : tools.find(tool => tool.id === call.tool)?.mark}</span>
                    <span className={styles.callLabel}><TextShimmer active={!call.done} duration={1.2}>{call.label}</TextShimmer></span>
                    {call.result ? <span className={styles.callResult} aria-hidden={!call.done}>{call.result}</span> : null}
                  </motion.li>)}
                </ul>
                : null}
              {turn.chunks.length > 0 ? <p className={styles.reply}>{turn.chunks.map((chunk, index) => <motion.span key={index} initial={!reduced && { opacity: 0 }} animate={{ opacity: 1 }} transition={fade}>{chunk}</motion.span>)}</p> : null}
              {turn.phase === "error" ? <p className={styles.replyError}>Couldn't get a reply. Check the model settings and try again.</p> : null}
            </motion.li>)}
        </ol>}
    </div>
    <form className={styles.composer} onSubmit={event => { event.preventDefault(); if (running) stop(); else void send(input); }}>
      <input ref={inputRef} className={styles.composerInput} value={input} onChange={event => setInput(event.target.value)} placeholder={`Message ${config.name.trim() || "your agent"}`} aria-label="Test message" maxLength={500} />
      <button type="submit" className={styles.send} data-running={running || undefined} disabled={!running && !input.trim()} aria-label={running ? "Stop reply" : "Send message"} tabIndex={active ? 0 : -1}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={running ? "stop" : "send"} className={styles.sendIcon} initial={!reduced && { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.1 } }} transition={{ duration: 0.16, ease }}>
            {running ? <Square aria-hidden="true" /> : <ArrowUp aria-hidden="true" />}
          </motion.span>
        </AnimatePresence>
      </button>
    </form>
  </div>;
}

/** The agent's initial in a tinted circle; falls back to "A" when the name is empty. */
function Avatar({ name, tint }: { name: string; tint: 1 | 2 | 3 | 4 }) {
  return <span className={styles.avatar} data-tint={tint} aria-hidden="true">{(name.trim()[0] ?? "A").toUpperCase()}</span>;
}

/** The meta line of a knowledge row: progress while uploading, size and type once ready, the message on error. */
function FileMeta({ file }: { file: AgentFile }) {
  if (file.status === "error") return <span className={`${styles.meta} ${styles.metaError}`}>{file.error ?? "Upload failed"}</span>;
  if (file.status === "uploading") {
    const percent = Math.round((file.progress ?? 0) * 100);
    return <span className={styles.meta}>
      <span className={styles.progress} role="progressbar" aria-label={`Uploading ${file.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <span className={styles.progressFill} style={{ transform: `scaleX(${(file.progress ?? 0).toFixed(3)})` }} />
      </span>
      <span className={`${styles.nums} ${styles.percent}`}>{percent}%</span>
    </span>;
  }
  const size = file.size < 1048576 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1048576).toFixed(1)} MB`;
  const extension = file.name.split(".").pop()?.toUpperCase() ?? "";
  return <span className={styles.meta}>
    <span className={styles.nums}>{size}</span>
    <span aria-hidden="true">·</span>
    {extension.length > 0 && extension.length <= 4 ? extension : "File"}
  </span>;
}

type Tone = "success" | "warning" | "danger" | "muted";
interface StatusModel { key: string; icon: ReactNode; label: string; tone: Tone }

/**
 * Builds an agent: inline editable name, a model picker, instructions, tool switches and knowledge files with
 * live upload progress. A Configure/Test switch swaps the body in place, and Publish tracks the saved state.
 */
export function AgentBuilder({
  config,
  defaultConfig,
  onConfigChange,
  publishedConfig,
  models = defaultModels,
  tools = defaultTools,
  onPublish,
  onUpload,
  onSend,
  version = 12,
  workspace = "Lumen support",
  maxInstructions = 2000,
  accept = ".pdf,.md,.txt,.csv,.docx,.html",
  mode,
  defaultMode = "configure",
  onModeChange,
  className,
}: AgentBuilderProps) {
  const reduced = !!useReducedMotion();
  const id = useId();
  const cardRef = useRef<HTMLElement>(null);
  const inView = useInView(cardRef, { margin: "0px 0px -10% 0px" });
  // A bare card is the sample: it starts its own simulated upload once it is on screen.
  const sample = !config && !defaultConfig && !onUpload;

  const [draft, setDraft] = useState<AgentConfig>(() => defaultConfig ?? sampleAgentConfig);
  const effective = config ?? draft;
  const latest = useRef(effective);
  useLayoutEffect(() => { latest.current = effective; }, [effective]);

  const update = useCallback((next: AgentConfig | ((current: AgentConfig) => AgentConfig)) => {
    const value = typeof next === "function" ? next(latest.current) : next;
    latest.current = value;
    if (!config) setDraft(value);
    onConfigChange?.(value);
  }, [config, onConfigChange]);

  const [published, setPublished] = useState(() => ({
    source: publishedConfig,
    sig: signature(publishedConfig ?? defaultConfig ?? { ...sampleAgentConfig, files: sampleAgentConfig.files.filter(file => file.status === "ready") }),
  }));
  if (publishedConfig && publishedConfig !== published.source) setPublished({ source: publishedConfig, sig: signature(publishedConfig) });

  const [versionState, setVersionState] = useState({ prop: version, value: version });
  if (version !== versionState.prop) setVersionState({ prop: version, value: version });
  const shownVersion = versionState.value;
  const [publishState, setPublishState] = useState<"idle" | "publishing" | "error">("idle");
  const [publishErrorSig, setPublishErrorSig] = useState<string | null>(null);
  const [internalMode, setInternalMode] = useState<"configure" | "test">(mode ?? defaultMode);
  const currentMode = mode ?? internalMode;
  const nameBeforeEdit = useRef("");
  const [announcement, setAnnouncement] = useState("");
  const announce = useCallback((message: string) => setAnnouncement(message), []);
  const uploads = useRef(new Map<string, AbortController>());
  const picked = useRef(new Map<string, File>());
  const publishAbort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const running = uploads.current;
    return () => running.forEach(controller => controller.abort());
  }, []);
  useEffect(() => () => publishAbort.current?.abort(), []);

  const dirty = signature(effective) !== published.sig;
  const missing = effective.name.trim()
    ? effective.instructions.trim()
      ? effective.modelId ? null : "Choose a model to publish"
      : "Add instructions to publish"
    : "Add a name to publish";
  const currentModel = models.find(model => model.id === effective.modelId);

  const markFile = useCallback((fileId: string, patch: Partial<AgentFile>) => {
    update(current => ({ ...current, files: current.files.map(file => file.id === fileId ? { ...file, ...patch } : file) }));
  }, [update]);

  const upload = useCallback(async (fileId: string, size: number, file?: File) => {
    uploads.current.get(fileId)?.abort();
    const controller = new AbortController();
    uploads.current.set(fileId, controller);
    markFile(fileId, { status: "uploading", progress: 0, error: undefined });
    let shown = 0;
    const report = (value: number) => {
      const next = Math.max(shown, Math.min(1, value));
      if (next - shown < 0.01 && next < 1) return;
      shown = next;
      markFile(fileId, { progress: next });
    };
    try {
      if (onUpload && file) await onUpload(file, report, controller.signal);
      else await simulateUpload(size, report, controller.signal);
      if (controller.signal.aborted) return;
      markFile(fileId, { status: "ready", progress: 1 });
      const name = latest.current.files.find(entry => entry.id === fileId)?.name ?? "File";
      announce(onUpload ? `${name} uploaded.` : `${name} added. Simulated, nothing was uploaded.`);
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error && error.message ? error.message : "Upload failed";
      markFile(fileId, { status: "error", error: message });
      announce(`Upload failed. ${message}.`);
    } finally {
      if (uploads.current.get(fileId) === controller) uploads.current.delete(fileId);
    }
  }, [announce, markFile, onUpload]);

  // The sample file only starts once the card is actually on screen, so nothing runs off screen.
  const started = useRef(false);
  useEffect(() => {
    if (!sample || !inView || started.current) return;
    const file = latest.current.files.find(entry => entry.id === "macros" && entry.status === "uploading");
    if (!file) return;
    started.current = true;
    const timer = window.setTimeout(() => void upload(file.id, file.size), 500);
    return () => window.clearTimeout(timer);
  }, [sample, inView, upload]);

  const publish = async () => {
    if (!dirty || missing || publishState === "publishing") return;
    publishAbort.current?.abort();
    const controller = new AbortController();
    publishAbort.current = controller;
    const snapshot = latest.current;
    setPublishState("publishing");
    try {
      if (onPublish) await onPublish(snapshot, controller.signal);
      else await sleep(900, controller.signal);
      if (controller.signal.aborted) return;
      setPublished(previous => ({ ...previous, sig: signature(snapshot) }));
      setVersionState(previous => ({ ...previous, value: previous.value + 1 }));
      setPublishState("idle");
      announce(onPublish ? `Published version ${shownVersion + 1}.` : `Published version ${shownVersion + 1}. Simulated, nothing was deployed.`);
    } catch (error) {
      if (controller.signal.aborted) return;
      setPublishState("error");
      setPublishErrorSig(signature(snapshot));
      announce(error instanceof Error && error.message ? `Couldn't publish. ${error.message}` : "Couldn't publish. Try again.");
    }
  };

  const staleError = publishState === "error" && publishErrorSig === signature(effective);
  const status: StatusModel = useMemo(() => publishState === "publishing"
    ? { key: "publishing", icon: <CircleDot aria-hidden="true" />, label: "Publishing", tone: "muted" }
    : staleError
      ? { key: "error", icon: <AlertTriangle aria-hidden="true" />, label: "Couldn't publish. Try again", tone: "danger" }
      : dirty && missing
        ? { key: `missing-${missing}`, icon: <AlertTriangle aria-hidden="true" />, label: missing, tone: "warning" }
        : dirty
          ? { key: "dirty", icon: <CircleDot aria-hidden="true" />, label: "Unsaved changes", tone: "warning" }
          : { key: `saved-${shownVersion}`, icon: <Check aria-hidden="true" />, label: "All changes published", tone: "success" },
  [dirty, staleError, missing, publishState, shownVersion]);

  const instructionCount = effective.instructions.length;
  const nearLimit = instructionCount > 0.9 * maxInstructions;
  const toolsOn = effective.tools.filter(tool => tools.some(entry => entry.id === tool)).length;
  const avatar = <Avatar name={effective.name} tint={effective.tint} />;

  return <div className={styles.root}>
    <section ref={cardRef} className={[styles.card, className].filter(Boolean).join(" ")} aria-labelledby={`${id}-name-label`}>
      <header className={styles.head}>
        <div className={styles.identity}>
          <label id={`${id}-name-label`} htmlFor={`${id}-title`} className={styles.srOnly}>Agent name</label>
          <span className={styles.nameField}>
            <span className={styles.nameSizer} aria-hidden="true">{effective.name || "Untitled agent"}</span>
            <input
              id={`${id}-title`}
              className={styles.nameInput}
              value={effective.name}
              onChange={event => update(current => ({ ...current, name: event.target.value }))}
              onFocus={event => { nameBeforeEdit.current = event.currentTarget.value; }}
              onKeyDown={event => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                  update(current => ({ ...current, name: nameBeforeEdit.current }));
                  event.currentTarget.blur();
                }
              }}
              placeholder="Untitled agent"
              maxLength={40}
              spellCheck={false}
              autoComplete="off"
              data-1p-ignore=""
              data-lpignore="true"
              data-bwignore=""
              data-form-type="other"
            />
          </span>
          <span className={styles.identityMeta}>
            <span className={styles.truncate}>{workspace}</span>
            <span aria-hidden="true">·</span>
            <span className={styles.versionSlot}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={shownVersion} className={styles.nums} {...(reduced ? {} : swap)}>v{shownVersion}</motion.span>
              </AnimatePresence>
            </span>
          </span>
        </div>
        <SegmentedControl
          className={styles.modeSwitch}
          label="Agent builder view"
          value={currentMode}
          onValueChange={next => { if (!mode) setInternalMode(next as "configure" | "test"); onModeChange?.(next as "configure" | "test"); }}
          options={[{ value: "configure", label: "Configure" }, { value: "test", label: "Test" }]}
        />
      </header>
      <div className={styles.body}>
        <motion.div
          className={styles.configure}
          initial={false}
          animate={{ opacity: currentMode === "configure" ? 1 : 0 }}
          transition={reduced ? { duration: 0 } : { duration: currentMode === "configure" ? 0.16 : 0.1 }}
          inert={currentMode !== "configure"}
          aria-hidden={currentMode !== "configure"}
        >
          <div className={styles.modelRow}>
            <div className={styles.rowText}>
              <span className={styles.sectionTitle} id={`${id}-model`}>Model</span>
              <span className={styles.metaText}>Answers every conversation</span>
            </div>
            <DropdownMenu.Root modal={false}>
              <DropdownMenu.Trigger className={styles.modelTrigger} aria-labelledby={`${id}-model ${id}-model-value`}>
                <span className={styles.modelMark}>{currentModel?.mark}</span>
                <span className={styles.modelValue} id={`${id}-model-value`}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span key={currentModel?.id ?? "none"} className={styles.truncate} {...(reduced ? {} : swap)}>{currentModel?.name ?? "Choose a model"}</motion.span>
                  </AnimatePresence>
                </span>
                <ChevronDown className={styles.chevron} aria-hidden="true" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className={styles.menu} align="end" sideOffset={6} collisionPadding={16}>
                  <DropdownMenu.RadioGroup value={effective.modelId} onValueChange={next => update(current => ({ ...current, modelId: next }))}>
                    {models.map(model => <DropdownMenu.RadioItem key={model.id} value={model.id} className={styles.menuItem}>
                      <span className={styles.modelMark}>{model.mark}</span>
                      <span className={styles.menuName}>{model.name}</span>
                      {model.note ? <span className={styles.menuNote}>{model.note}</span> : null}
                      <span className={styles.menuCheck}><DropdownMenu.ItemIndicator><Check aria-hidden="true" /></DropdownMenu.ItemIndicator></span>
                    </DropdownMenu.RadioItem>)}
                  </DropdownMenu.RadioGroup>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <label className={styles.sectionTitle} htmlFor={`${id}-instructions`}>Instructions</label>
              <span className={styles.count} data-near={nearLimit || undefined} id={`${id}-count`}>{instructionCount.toLocaleString("en-US")} / {maxInstructions.toLocaleString("en-US")}</span>
            </div>
            <textarea
              id={`${id}-instructions`}
              className={styles.instructions}
              value={effective.instructions}
              onChange={event => update(current => ({ ...current, instructions: event.target.value.slice(0, maxInstructions) }))}
              maxLength={maxInstructions}
              placeholder="Describe the agent's job, tone and the rules it must follow."
              aria-describedby={`${id}-count`}
              rows={5}
            />
          </div>
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionTitle} id={`${id}-tools`}>Tools</span>
              <span className={`${styles.meta} ${styles.nums}`}>{toolsOn} of {tools.length} on</span>
            </div>
            <ul className={`${styles.list} ${styles.toolGrid}`} aria-labelledby={`${id}-tools`}>
              {tools.map(tool => {
                const on = effective.tools.includes(tool.id);
                return <li key={tool.id} className={styles.row} data-off={!on || undefined}>
                  <label className={styles.rowLabel} htmlFor={`${id}-tool-${tool.id}`}>
                    <span className={styles.rowMark}>{tool.mark}</span>
                    <span className={styles.rowText}>
                      <span className={styles.rowName}>{tool.name}</span>
                      <span className={styles.metaText}>{tool.description}</span>
                    </span>
                  </label>
                  <Switch
                    id={`${id}-tool-${tool.id}`}
                    checked={on}
                    onCheckedChange={next => update(current => ({
                      ...current,
                      tools: next ? [...current.tools.filter(entry => entry !== tool.id), tool.id] : current.tools.filter(entry => entry !== tool.id),
                    }))}
                    aria-label={tool.name}
                  />
                </li>;
              })}
            </ul>
          </div>
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionTitle} id={`${id}-files`}>Knowledge</span>
              <Button type="button" variant="ghost" size="sm" className={styles.addFile} onClick={() => fileInput.current?.click()}><Plus aria-hidden="true" />Add file</Button>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept={accept}
                className={styles.srOnly}
                tabIndex={-1}
                aria-hidden="true"
                onChange={event => {
                  const files = event.target.files;
                  if (files?.length) {
                    const entries = Array.from(files).map(file => ({
                      file,
                      entry: { id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`, name: file.name, size: file.size, status: "uploading" as const, progress: 0 },
                    }));
                    update(current => ({ ...current, files: [...current.files, ...entries.map(item => item.entry)] }));
                    entries.forEach(({ file, entry }) => {
                      picked.current.set(entry.id, file);
                      void upload(entry.id, entry.size, file);
                    });
                  }
                  event.target.value = "";
                }}
              />
            </div>
            {effective.files.length === 0
              ? <p className={styles.empty}>No files yet. Add policies, docs or CSVs the agent can cite.</p>
              : <ul className={styles.list} aria-labelledby={`${id}-files`}>
                <AnimatePresence initial={false}>
                  {effective.files.map(file => <motion.li
                    key={file.id}
                    className={styles.fileItem}
                    initial={!reduced && { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
                    transition={{ height: { type: "spring", visualDuration: 0.24, bounce: 0 }, opacity: { duration: 0.16 } }}
                  >
                    <div className={styles.row} data-status={file.status}>
                      <span className={styles.rowMark}>{file.status === "error" ? <AlertTriangle className={styles.fileError} aria-hidden="true" /> : <FileText aria-hidden="true" />}</span>
                      <span className={styles.rowText}>
                        <span className={`${styles.rowName} ${styles.truncate}`}>{file.name}</span>
                        <FileMeta file={file} />
                      </span>
                      {file.status === "error"
                        ? <button type="button" className={styles.iconButton} onClick={() => void upload(file.id, file.size, picked.current.get(file.id))} aria-label={`Retry ${file.name}`}><RotateCw aria-hidden="true" /></button>
                        : null}
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => {
                          uploads.current.get(file.id)?.abort();
                          uploads.current.delete(file.id);
                          picked.current.delete(file.id);
                          update(current => ({ ...current, files: current.files.filter(entry => entry.id !== file.id) }));
                          announce(file.status === "uploading" ? `Upload of ${file.name} canceled.` : `${file.name} removed.`);
                        }}
                        aria-label={file.status === "uploading" ? `Cancel upload of ${file.name}` : `Remove ${file.name}`}
                      ><X aria-hidden="true" /></button>
                    </div>
                  </motion.li>)}
                </AnimatePresence>
              </ul>}
          </div>
        </motion.div>
        <motion.div
          className={styles.testView}
          initial={false}
          animate={{ opacity: currentMode === "test" ? 1 : 0 }}
          transition={reduced ? { duration: 0 } : { duration: currentMode === "test" ? 0.16 : 0.1 }}
          inert={currentMode !== "test"}
          aria-hidden={currentMode !== "test"}
        >
          <TestView config={effective} model={currentModel} tools={tools} active={currentMode === "test"} reduced={reduced} avatar={avatar} onSend={onSend} announce={announce} />
        </motion.div>
      </div>
      <footer className={styles.foot}>
        <span className={styles.status} data-tone={status.tone}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={status.key} className={styles.statusInner} {...(reduced ? {} : swap)}>
              {status.icon}
              <span className={styles.truncate}>{status.label}</span>
            </motion.span>
          </AnimatePresence>
        </span>
        <Button type="button" variant="primary" size="sm" onClick={() => void publish()} disabled={!dirty || !!missing} loading={publishState === "publishing"}>Publish</Button>
      </footer>
      <p className={styles.srOnly} aria-live="polite">{announcement}</p>
    </section>
  </div>;
}

export default AgentBuilder;
