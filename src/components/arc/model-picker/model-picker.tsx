"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  CSSProperties,
  ComponentType,
  FocusEvent,
  KeyboardEvent,
  ReactNode,
  SVGProps,
} from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Gauge, Layers } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./model-picker.module.css";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

type MarkProps = SVGProps<SVGSVGElement> & { title?: string };
export type ModelMark = ComponentType<MarkProps>;

export interface PickerProvider {
  id: string;
  name: string;
  mark: ModelMark;
  color?: string;
}

export interface PickerModel {
  /** The provider's API id; this is what the picker reports. */
  id: string;
  name: string;
  /** Must match a provider id so the picker can borrow its mark and group it under More models. */
  provider: string;
  /** One line under the name, in the featured list. */
  blurb: string;
  /** The two line review under the pill. */
  description: string;
  capabilities?: string[];
  /** Context window in tokens. */
  context: number;
  /** Maximum output in tokens. */
  maxOutput: number;
  /** USD per million tokens. */
  price: { input: number; output: number };
  released: string;
  tag?: string;
  effort?: { levels: Effort[]; default: Effort };
  mark?: ModelMark;
  color?: string;
  latency?: number;
}

const EFFORT_LEVELS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

const EFFORT_LABELS: Record<Effort, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
  max: "Max",
};

const EFFORT_NOTES: Record<Effort, string> = {
  low: "Quickest answers",
  medium: "Balanced speed and depth",
  high: "Thinks longer",
  xhigh: "Thinks much longer",
  max: "Deepest thinking, slowest",
};

/** A reasoning model that accepts every effort level. */
function allLevels(defaultLevel: Effort): { levels: Effort[]; default: Effort } {
  return { levels: EFFORT_LEVELS, default: defaultLevel };
}

/** The three level ladder most third party reasoning models ship with. */
const TRI_LEVELS: { levels: Effort[]; default: Effort } = {
  levels: ["low", "medium", "high"],
  default: "medium",
};

function AnthropicMark({ title = "Anthropic", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
    </svg>
  );
}

function OpenAIMark({ title = "OpenAI", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

function GoogleMark({ title = "Gemini", ...props }: MarkProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} {...props}>
      <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="#3186FF" />
      <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill={`url(#lobe-icons-gemini-0-${uid})`} />
      <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill={`url(#lobe-icons-gemini-1-${uid})`} />
      <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill={`url(#lobe-icons-gemini-2-${uid})`} />
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

function XaiMark({ title = "xAI", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" role="img" aria-label={title} {...props}>
      <path d="M6.469 8.776L16.512 23h-4.464L2.005 8.776H6.47zm-.004 7.9l2.233 3.164L6.467 23H2l4.465-6.324zM22 2.582V23h-3.659V7.764L22 2.582zM22 1l-9.952 14.095-2.233-3.163L17.533 1H22z" />
    </svg>
  );
}

function MistralMark({ title = "Mistral AI", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} {...props}>
      <path d="M3.428 3.4h3.429v3.428H3.428V3.4zm13.714 0h3.43v3.428h-3.43V3.4z" fill="gold" />
      <path d="M3.428 6.828h6.857v3.429H3.429V6.828zm10.286 0h6.857v3.429h-6.857V6.828z" fill="#FFAF00" />
      <path d="M3.428 10.258h17.144v3.428H3.428v-3.428z" fill="#FF8205" />
      <path d="M3.428 13.686h3.429v3.428H3.428v-3.428zm6.858 0h3.429v3.428h-3.429v-3.428zm6.856 0h3.43v3.428h-3.43v-3.428z" fill="#FA500F" />
      <path d="M0 17.114h10.286v3.429H0v-3.429zm13.714 0H24v3.429H13.714v-3.429z" fill="#E10500" />
    </svg>
  );
}

function DeepSeekMark({ title = "DeepSeek", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} {...props}>
      <path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#4D6BFE" />
    </svg>
  );
}

function MetaMark({ title = "Meta", ...props }: MarkProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} {...props}>
      <path d="M6.897 4h-.024l-.031 2.615h.022c1.715 0 3.046 1.357 5.94 6.246l.175.297.012.02 1.62-2.438-.012-.019a48.763 48.763 0 00-1.098-1.716 28.01 28.01 0 00-1.175-1.629C10.413 4.932 8.812 4 6.896 4z" fill={`url(#lobe-icons-meta-0-${uid})`} />
      <path d="M6.873 4C4.95 4.01 3.247 5.258 2.02 7.17a4.352 4.352 0 00-.01.017l2.254 1.231.011-.017c.718-1.083 1.61-1.774 2.568-1.785h.021L6.896 4h-.023z" fill={`url(#lobe-icons-meta-1-${uid})`} />
      <path d="M2.019 7.17l-.011.017C1.2 8.447.598 9.995.274 11.664l-.005.022 2.534.6.004-.022c.27-1.467.786-2.828 1.456-3.845l.011-.017L2.02 7.17z" fill={`url(#lobe-icons-meta-2-${uid})`} />
      <path d="M2.807 12.264l-2.533-.6-.005.022c-.177.918-.267 1.851-.269 2.786v.023l2.598.233v-.023a12.591 12.591 0 01.21-2.44z" fill={`url(#lobe-icons-meta-3-${uid})`} />
      <path d="M2.677 15.537a5.462 5.462 0 01-.079-.813v-.022L0 14.468v.024a8.89 8.89 0 00.146 1.652l2.535-.585a4.106 4.106 0 01-.004-.022z" fill={`url(#lobe-icons-meta-4-${uid})`} />
      <path d="M3.27 16.89c-.284-.31-.484-.756-.589-1.328l-.004-.021-2.535.585.004.021c.192 1.01.568 1.85 1.106 2.487l.014.017 2.018-1.745a2.106 2.106 0 01-.015-.016z" fill={`url(#lobe-icons-meta-5-${uid})`} />
      <path d="M10.78 9.654c-1.528 2.35-2.454 3.825-2.454 3.825-2.035 3.2-2.739 3.917-3.871 3.917a1.545 1.545 0 01-1.186-.508l-2.017 1.744.014.017C2.01 19.518 3.058 20 4.356 20c1.963 0 3.374-.928 5.884-5.33l1.766-3.13a41.283 41.283 0 00-1.227-1.886z" fill="#0082FB" />
      <path d="M13.502 5.946l-.016.016c-.4.43-.786.908-1.16 1.416.378.483.768 1.024 1.175 1.63.48-.743.928-1.345 1.367-1.807l.016-.016-1.382-1.24z" fill={`url(#lobe-icons-meta-6-${uid})`} />
      <path d="M20.918 5.713C19.853 4.633 18.583 4 17.225 4c-1.432 0-2.637.787-3.723 1.944l-.016.016 1.382 1.24.016-.017c.715-.747 1.408-1.12 2.176-1.12.826 0 1.6.39 2.27 1.075l.015.016 1.589-1.425-.016-.016z" fill="#0082FB" />
      <path d="M23.998 14.125c-.06-3.467-1.27-6.566-3.064-8.396l-.016-.016-1.588 1.424.015.016c1.35 1.392 2.277 3.98 2.361 6.971v.023h2.292v-.022z" fill={`url(#lobe-icons-meta-7-${uid})`} />
      <path d="M23.998 14.15v-.023h-2.292v.022c.004.14.006.282.006.424 0 .815-.121 1.474-.368 1.95l-.011.022 1.708 1.782.013-.02c.62-.96.946-2.293.946-3.91 0-.083 0-.165-.002-.247z" fill={`url(#lobe-icons-meta-8-${uid})`} />
      <path d="M21.344 16.52l-.011.02c-.214.402-.519.67-.917.787l.778 2.462a3.493 3.493 0 00.438-.182 3.558 3.558 0 001.366-1.218l.044-.065.012-.02-1.71-1.784z" fill={`url(#lobe-icons-meta-9-${uid})`} />
      <path d="M19.92 17.393c-.262 0-.492-.039-.718-.14l-.798 2.522c.449.153.927.222 1.46.222.492 0 .943-.073 1.352-.215l-.78-2.462c-.167.05-.341.075-.517.073z" fill={`url(#lobe-icons-meta-10-${uid})`} />
      <path d="M18.323 16.534l-.014-.017-1.836 1.914.016.017c.637.682 1.246 1.105 1.937 1.337l.797-2.52c-.291-.125-.573-.353-.9-.731z" fill={`url(#lobe-icons-meta-11-${uid})`} />
      <path d="M18.309 16.515c-.55-.642-1.232-1.712-2.303-3.44l-1.396-2.336-.011-.02-1.62 2.438.012.02.989 1.668c.959 1.61 1.74 2.774 2.493 3.585l.016.016 1.834-1.914a2.353 2.353 0 01-.014-.017z" fill={`url(#lobe-icons-meta-12-${uid})`} />
      <defs>
        <linearGradient id={`lobe-icons-meta-0-${uid}`} x1="75.897%" x2="26.312%" y1="89.199%" y2="12.194%">
          <stop offset=".06%" stopColor="#0867DF" />
          <stop offset="45.39%" stopColor="#0668E1" />
          <stop offset="85.91%" stopColor="#0064E0" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-1-${uid}`} x1="21.67%" x2="97.068%" y1="75.874%" y2="23.985%">
          <stop offset="13.23%" stopColor="#0064DF" />
          <stop offset="99.88%" stopColor="#0064E0" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-2-${uid}`} x1="38.263%" x2="60.895%" y1="89.127%" y2="16.131%">
          <stop offset="1.47%" stopColor="#0072EC" />
          <stop offset="68.81%" stopColor="#0064DF" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-3-${uid}`} x1="47.032%" x2="52.15%" y1="90.19%" y2="15.745%">
          <stop offset="7.31%" stopColor="#007CF6" />
          <stop offset="99.43%" stopColor="#0072EC" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-4-${uid}`} x1="52.155%" x2="47.591%" y1="58.301%" y2="37.004%">
          <stop offset="7.31%" stopColor="#007FF9" />
          <stop offset="100%" stopColor="#007CF6" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-5-${uid}`} x1="37.689%" x2="61.961%" y1="12.502%" y2="63.624%">
          <stop offset="7.31%" stopColor="#007FF9" />
          <stop offset="100%" stopColor="#0082FB" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-6-${uid}`} x1="34.808%" x2="62.313%" y1="68.859%" y2="23.174%">
          <stop offset="27.99%" stopColor="#007FF8" />
          <stop offset="91.41%" stopColor="#0082FB" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-7-${uid}`} x1="43.762%" x2="57.602%" y1="6.235%" y2="98.514%">
          <stop offset="0%" stopColor="#0082FB" />
          <stop offset="99.95%" stopColor="#0081FA" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-8-${uid}`} x1="60.055%" x2="39.88%" y1="4.661%" y2="69.077%">
          <stop offset="6.19%" stopColor="#0081FA" />
          <stop offset="100%" stopColor="#0080F9" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-9-${uid}`} x1="30.282%" x2="61.081%" y1="59.32%" y2="33.244%">
          <stop offset="0%" stopColor="#027AF3" />
          <stop offset="100%" stopColor="#0080F9" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-10-${uid}`} x1="20.433%" x2="82.112%" y1="50.001%" y2="50.001%">
          <stop offset="0%" stopColor="#0377EF" />
          <stop offset="99.94%" stopColor="#0279F1" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-11-${uid}`} x1="40.303%" x2="72.394%" y1="35.298%" y2="57.811%">
          <stop offset=".19%" stopColor="#0471E9" />
          <stop offset="100%" stopColor="#0377EF" />
        </linearGradient>
        <linearGradient id={`lobe-icons-meta-12-${uid}`} x1="32.254%" x2="68.003%" y1="19.719%" y2="84.908%">
          <stop offset="27.65%" stopColor="#0867DF" />
          <stop offset="100%" stopColor="#0471E9" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function QwenMark({ title = "Qwen", ...props }: MarkProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} {...props}>
      <path d="M12.604 1.34c.393.69.784 1.382 1.174 2.075a.18.18 0 00.157.091h5.552c.174 0 .322.11.446.327l1.454 2.57c.19.337.24.478.024.837-.26.43-.513.864-.76 1.3l-.367.658c-.106.196-.223.28-.04.512l2.652 4.637c.172.301.111.494-.043.77-.437.785-.882 1.564-1.335 2.34-.159.272-.352.375-.68.37-.777-.016-1.552-.01-2.327.016a.099.099 0 00-.081.05 575.097 575.097 0 01-2.705 4.74c-.169.293-.38.363-.725.364-.997.003-2.002.004-3.017.002a.537.537 0 01-.465-.271l-1.335-2.323a.09.09 0 00-.083-.049H4.982c-.285.03-.553-.001-.805-.092l-1.603-2.77a.543.543 0 01-.002-.54l1.207-2.12a.198.198 0 000-.197 550.951 550.951 0 01-1.875-3.272l-.79-1.395c-.16-.31-.173-.496.095-.965.465-.813.927-1.625 1.387-2.436.132-.234.304-.334.584-.335a338.3 338.3 0 012.589-.001.124.124 0 00.107-.063l2.806-4.895a.488.488 0 01.422-.246c.524-.001 1.053 0 1.583-.006L11.704 1c.341-.003.724.032.9.34zm-3.432.403a.06.06 0 00-.052.03L6.254 6.788a.157.157 0 01-.135.078H3.253c-.056 0-.07.025-.041.074l5.81 10.156c.025.042.013.062-.034.063l-2.795.015a.218.218 0 00-.2.116l-1.32 2.31c-.044.078-.021.118.068.118l5.716.008c.046 0 .08.02.104.061l1.403 2.454c.046.081.092.082.139 0l5.006-8.76.783-1.382a.055.055 0 01.096 0l1.424 2.53a.122.122 0 00.107.062l2.763-.02a.04.04 0 00.035-.02.041.041 0 000-.04l-2.9-5.086a.108.108 0 010-.113l.293-.507 1.12-1.977c.024-.041.012-.062-.035-.062H9.2c-.059 0-.073-.026-.043-.077l1.434-2.505a.107.107 0 000-.114L9.225 1.774a.06.06 0 00-.053-.031zm6.29 8.02c.046 0 .058.02.034.06l-.832 1.465-2.613 4.585a.056.056 0 01-.05.029.058.058 0 01-.05-.029L8.498 9.841c-.02-.034-.01-.052.028-.054l.216-.012 6.722-.012z" fill={`url(#lobe-icons-qwen-${uid})`} fillRule="nonzero" />
      <defs>
        <linearGradient id={`lobe-icons-qwen-${uid}`} x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor="#6336E7" stopOpacity=".84" />
          <stop offset="100%" stopColor="#6F69F7" stopOpacity=".84" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ClaudeMark({ title = "Claude", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

function GrokMark({ title = "Grok", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" role="img" aria-label={title} {...props}>
      <path d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815" />
    </svg>
  );
}

const CLAUDE = { mark: ClaudeMark, color: "#D97757" };

export const sampleProviders: PickerProvider[] = [
  { id: "anthropic", name: "Anthropic", mark: AnthropicMark },
  { id: "openai", name: "OpenAI", mark: OpenAIMark },
  { id: "google", name: "Google", mark: GoogleMark },
  { id: "xai", name: "xAI", mark: XaiMark },
  { id: "mistral", name: "Mistral", mark: MistralMark },
  { id: "deepseek", name: "DeepSeek", mark: DeepSeekMark },
  { id: "meta", name: "Meta", mark: MetaMark },
  { id: "qwen", name: "Qwen", mark: QwenMark },
];

export const sampleModels: PickerModel[] = [
  {
    id: "claude-fable-5-1",
    name: "Claude Fable 5.1",
    provider: "anthropic",
    tag: "Most capable",
    ...CLAUDE,
    blurb: "Most capable, for the hardest work",
    description:
      "The most capable widely released Claude. Thinking is always on, for the hardest research, coding and agent work.",
    capabilities: ["reasoning", "vision", "tools"],
    context: 1e6,
    maxOutput: 128e3,
    price: { input: 10, output: 50 },
    released: "2026-09-01",
    effort: allLevels("high"),
    latency: 1.3,
  },
  {
    id: "claude-opus-5-5",
    name: "Claude Opus 5.5",
    provider: "anthropic",
    tag: "Recommended",
    ...CLAUDE,
    blurb: "Complex coding, agents and analysis",
    description:
      "The default flagship for complex coding, long agent runs and careful analysis. Effort sets how long it thinks.",
    capabilities: ["reasoning", "vision", "tools"],
    context: 1e6,
    maxOutput: 128e3,
    price: { input: 4, output: 20 },
    released: "2026-09-22",
    effort: allLevels("medium"),
    latency: 0.95,
  },
  {
    id: "claude-sonnet-5-5",
    name: "Claude Sonnet 5.5",
    provider: "anthropic",
    ...CLAUDE,
    blurb: "Smart and efficient for everyday work",
    description:
      "Everyday coding and agents at a lower price, with strong tool use across a full 1M token context.",
    capabilities: ["reasoning", "vision", "tools"],
    context: 1e6,
    maxOutput: 128e3,
    price: { input: 2, output: 10 },
    released: "2026-09-28",
    effort: allLevels("high"),
    latency: 0.6,
  },
  {
    id: "claude-haiku-5-5",
    name: "Claude Haiku 5.5",
    provider: "anthropic",
    tag: "Fast",
    ...CLAUDE,
    blurb: "Fastest, for quick answers",
    description:
      "The fastest and cheapest Claude, for high volume work, sub-agents and quick replies.",
    capabilities: ["reasoning", "vision", "tools"],
    context: 1e6,
    maxOutput: 128e3,
    price: { input: 0.1, output: 0.5 },
    released: "2026-10-07",
    effort: allLevels("medium"),
    latency: 0.28,
  },
  {
    id: "gpt-6.1-sol",
    name: "GPT-6.1 Sol",
    provider: "openai",
    blurb: "General reasoning across text and images",
    description:
      "A general reasoning model for coding, analysis and multimodal work, tuned for long tool loops.",
    capabilities: ["reasoning", "vision", "tools"],
    context: 1e6,
    maxOutput: 128e3,
    price: { input: 5, output: 30 },
    released: "2026-09-29",
    effort: TRI_LEVELS,
    latency: 0.85,
  },
  {
    id: "gpt-6-luna",
    name: "GPT-6 Luna",
    provider: "openai",
    tag: "Fast",
    blurb: "Small and quick for simple tasks",
    description:
      "A small, quick model for classification, extraction and chat that has to feel instant.",
    capabilities: ["vision", "tools"],
    context: 4e5,
    maxOutput: 64e3,
    price: { input: 0.4, output: 2 },
    released: "2026-09-22",
    latency: 0.32,
  },
  {
    id: "gemini-4-argon",
    name: "Gemini 4 Argon",
    provider: "google",
    blurb: "Long context, reads whole repositories",
    description:
      "A long context reasoning model that reads whole repositories, videos and document sets in one pass.",
    capabilities: ["reasoning", "vision", "audio", "tools"],
    context: 2e6,
    maxOutput: 64e3,
    price: { input: 3.5, output: 21 },
    released: "2026-09-30",
    effort: TRI_LEVELS,
    latency: 0.9,
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    provider: "google",
    tag: "Fast",
    blurb: "Fast multimodal for high volume",
    description:
      "A fast multimodal model for high volume pipelines, with light thinking when it helps.",
    capabilities: ["reasoning", "vision", "tools"],
    context: 1e6,
    maxOutput: 64e3,
    price: { input: 0.3, output: 2.5 },
    released: "2026-09-02",
    effort: TRI_LEVELS,
    latency: 0.3,
  },
  {
    id: "grok-4.7",
    name: "Grok 4.7",
    provider: "xai",
    mark: GrokMark,
    blurb: "Reasoning with live search",
    description:
      "A reasoning model with live search tools, for research and fast moving topics.",
    capabilities: ["reasoning", "vision", "tools"],
    context: 512e3,
    maxOutput: 64e3,
    price: { input: 3, output: 15 },
    released: "2026-09-21",
    effort: TRI_LEVELS,
    latency: 0.75,
  },
  {
    id: "mistral-large-4",
    name: "Mistral Large 4",
    provider: "mistral",
    blurb: "Multilingual generalist",
    description:
      "A strong multilingual generalist for European languages, documents and agents.",
    capabilities: ["vision", "tools"],
    context: 256e3,
    maxOutput: 32e3,
    price: { input: 1.5, output: 6 },
    released: "2026-10-06",
    latency: 0.5,
  },
  {
    id: "deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash",
    provider: "deepseek",
    tag: "Open weights",
    blurb: "Low cost, with open weights",
    description:
      "A low cost reasoning model you can also run on your own hardware.",
    capabilities: ["reasoning", "tools"],
    context: 256e3,
    maxOutput: 32e3,
    price: { input: 0.14, output: 0.56 },
    released: "2026-09-10",
    effort: TRI_LEVELS,
    latency: 0.45,
  },
  {
    id: "muse-spark-1.3",
    name: "Muse Spark 1.3",
    provider: "meta",
    blurb: "Everyday chat and images",
    description:
      "A multimodal assistant model for chat, images and everyday writing.",
    capabilities: ["vision"],
    context: 1e6,
    maxOutput: 32e3,
    price: { input: 0.6, output: 2.4 },
    released: "2026-09-02",
    latency: 0.48,
  },
  {
    id: "qwen3.8-max",
    name: "Qwen3.8 Max",
    provider: "qwen",
    blurb: "Strong at code and math",
    description:
      "A large reasoning model with strong code and math, and wide language coverage.",
    capabilities: ["reasoning", "tools"],
    context: 1e6,
    maxOutput: 64e3,
    price: { input: 1.2, output: 6 },
    released: "2026-08-02",
    effort: TRI_LEVELS,
    latency: 0.8,
  },
];

export const sampleFeatured = [
  "claude-opus-5-5",
  "claude-sonnet-5-5",
  "gpt-6.1-sol",
  "gemini-4-argon",
];

const { spring, duration } = motionTokens;

/** The width and page transitions glide only when a pointer moved the highlight. */
const WIDTH_SPRING: Transition = { type: "spring", visualDuration: 0.24, bounce: 0 };
const STANDARD_EASE: [number, number, number, number] = [...motionTokens.ease.standard];

const formatPrice = (value: number) => `$${value.toFixed(2)}`;

const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(" ");

/** Controlled when a value is passed, uncontrolled otherwise; every set reports out. */
function useControlled<T>(controlled: T | undefined, fallback: T, onChange?: (value: T) => void) {
  const [internal, setInternal] = useState(fallback);
  const isControlled = controlled !== undefined;
  const setValue = useCallback(
    (next: T) => {
      if (!isControlled) setInternal(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );
  return [isControlled ? (controlled as T) : internal, setValue] as const;
}

/** Snap an effort to one the model actually accepts: the nearest level on the ladder. */
function resolveEffort(model: PickerModel, effort: Effort | undefined): Effort | undefined {
  if (!model.effort) return undefined;
  const { levels } = model.effort;
  if (!effort) return model.effort.default;
  if (levels.includes(effort)) return effort;
  const index = EFFORT_LEVELS.indexOf(effort);
  return levels.reduce(
    (best, level) =>
      Math.abs(EFFORT_LEVELS.indexOf(level) - index) < Math.abs(EFFORT_LEVELS.indexOf(best) - index)
        ? level
        : best,
    levels[0],
  );
}

type Highlight = { top: number; height: number; glide: boolean };

/**
 * The row highlight: measured off the focused row so it glides between rows on arrow keys and
 * snaps when the pointer moves the focus.
 */
function useHighlight(reduced: boolean, page?: string) {
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const pointer = useRef(false);
  const timer = useRef(0);
  const [lastPage, setLastPage] = useState(page);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // A new page is a new set of rows: drop the old measurement before paint.
  if (lastPage !== page) {
    setLastPage(page);
    setHighlight(null);
  }

  return {
    container,
    highlight: (
      <motion.span
        className={styles.highlight}
        aria-hidden="true"
        initial={false}
        animate={highlight ? { y: highlight.top, height: highlight.height, opacity: 1 } : { opacity: 0 }}
        transition={{
          default: highlight?.glide && !reduced ? WIDTH_SPRING : { duration: 0 },
          opacity: { duration: reduced ? 0 : 0.08 },
        }}
      />
    ),
    handlers: {
      onFocus: (event: FocusEvent<HTMLDivElement>) => {
        // Scroll containers report as the offset parent: a row outside this menu is not ours.
        const item =
          event.target instanceof HTMLElement
            ? event.target.closest<HTMLElement>('[role^="menuitem"]')
            : null;
        if (item && item.offsetParent !== container.current) return;
        window.clearTimeout(timer.current);
        if (!item) {
          timer.current = window.setTimeout(() => setHighlight(null), 70 * Number(pointer.current));
          return;
        }
        const glide = pointer.current;
        setHighlight((previous) => ({
          top: item.offsetTop,
          height: item.offsetHeight,
          glide: glide && previous !== null,
        }));
      },
      onPointerMoveCapture: () => {
        pointer.current = true;
      },
      onKeyDownCapture: () => {
        pointer.current = false;
      },
    },
  };
}

/** Animates the menu's height as pages swap so the popover never jumps. */
function AutoHeight({ children, reduced }: { children: ReactNode; reduced: boolean }) {
  const content = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  useLayoutEffect(() => {
    const node = content.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      className={styles.autoHeight}
      initial={false}
      animate={{ height }}
      transition={reduced ? { duration: 0 } : spring.smooth}
    >
      <div ref={content}>{children}</div>
    </motion.div>
  );
}

interface MenuProps {
  children: ReactNode;
  reduced: boolean;
  page: string;
  listId: string;
  onCloseAutoFocus: (event: Event) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

function Menu({ children, reduced, page, listId, onCloseAutoFocus, onKeyDown }: MenuProps) {
  const { container, highlight, handlers } = useHighlight(reduced, page);
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        className={styles.menu}
        align="center"
        sideOffset={8}
        collisionPadding={12}
        loop
        onCloseAutoFocus={onCloseAutoFocus}
        onKeyDown={onKeyDown}
        {...handlers}
      >
        <AutoHeight reduced={reduced}>
          <div ref={container} id={listId} className={styles.list} data-page={page}>
            {highlight}
            {children}
          </div>
        </AutoHeight>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

interface SubMenuProps {
  children: ReactNode;
  reduced: boolean;
  className?: string;
  label: string;
}

function SubMenu({ children, reduced, className, label }: SubMenuProps) {
  const { container, highlight, handlers } = useHighlight(reduced);
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.SubContent
        className={cx(styles.menu, className)}
        sideOffset={8}
        alignOffset={-7}
        collisionPadding={12}
        loop
        aria-label={label}
        {...handlers}
      >
        <div ref={container} className={styles.list}>
          {highlight}
          {children}
        </div>
      </DropdownMenu.SubContent>
    </DropdownMenu.Portal>
  );
}

function ModelMarkView({
  model,
  provider,
  className,
}: {
  model: PickerModel;
  provider?: PickerProvider;
  className?: string;
}) {
  const Mark = model.mark ?? provider?.mark;
  const color = model.mark ? model.color : provider?.color;
  if (!Mark) {
    return (
      <span className={cx(styles.letter, className)} aria-hidden="true">
        {model.name[0]}
      </span>
    );
  }
  return (
    <Mark
      className={cx(styles.mark, className)}
      style={color ? { color } : undefined}
      aria-hidden="true"
      focusable="false"
    />
  );
}

/** Swaps a fact's text when the model changes, and pops the check in after a change. */
function Swap({
  children,
  value,
  reduced,
}: {
  children: ReactNode;
  value: string;
  reduced: boolean;
}) {
  return (
    <span className={styles.swap}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={!reduced && { opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{
            opacity: 0,
            transition: { duration: reduced ? 0 : 0.1, ease: STANDARD_EASE },
          }}
          transition={{ duration: reduced ? 0 : duration.fast, ease: STANDARD_EASE }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

interface TriggerContentProps {
  model: PickerModel;
  provider?: PickerProvider;
  level?: Effort;
  reduced: boolean;
}

/**
 * The pill's content. A hidden copy of the label is measured so the pill can animate to exactly
 * the width of the new name instead of jumping.
 */
function TriggerContent({ model, provider, level, reduced }: TriggerContentProps) {
  const measure = useRef<HTMLSpanElement>(null);
  const lastKey = useRef<string | null>(null);
  const [width, setWidth] = useState<{ width: number | "auto"; animate: boolean }>({
    width: "auto",
    animate: false,
  });
  const key = `${model.id}|${level ?? ""}`;

  useLayoutEffect(() => {
    const node = measure.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const nextKey = node.dataset.key ?? "";
      const shouldAnimate = lastKey.current !== null && lastKey.current !== nextKey;
      lastKey.current = nextKey;
      setWidth({
        width: Math.ceil(entry.borderBoxSize?.[0]?.inlineSize ?? node.offsetWidth),
        animate: shouldAnimate,
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const inner = (hidden?: boolean) => (
    <>
      <span className={styles.triggerName}>{model.name}</span>
      {level && (
        <span className={styles.triggerEffort} aria-hidden={hidden || undefined}>
          {EFFORT_LABELS[level]}
        </span>
      )}
    </>
  );

  return (
    <>
      <span className={styles.triggerMark} aria-hidden="true">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={model.id}
            className={styles.triggerMarkLayer}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={
              reduced
                ? { opacity: 0, transition: { duration: 0 } }
                : { opacity: 0, transition: { duration: 0.1, ease: STANDARD_EASE } }
            }
            transition={reduced ? { duration: 0 } : { duration: duration.fast, ease: STANDARD_EASE }}
          >
            <ModelMarkView model={model} provider={provider} />
          </motion.span>
        </AnimatePresence>
      </span>
      <motion.span
        className={styles.triggerText}
        initial={false}
        animate={{ width: width.width }}
        transition={width.animate && !reduced ? WIDTH_SPRING : { duration: 0 }}
      >
        <span
          ref={measure}
          data-key={key}
          className={cx(styles.triggerInner, styles.measure)}
          aria-hidden="true"
        >
          {inner(true)}
        </span>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={key}
            className={styles.triggerInner}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={
              reduced
                ? { opacity: 0, transition: { duration: 0 } }
                : { opacity: 0, transition: { duration: 0.1, ease: STANDARD_EASE } }
            }
            transition={reduced ? { duration: 0 } : { duration: duration.fast, ease: STANDARD_EASE }}
          >
            {inner()}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </>
  );
}

type Page = "main" | "effort" | "more";

const PHONE_QUERY = "(max-width: 640px)";

// On phones submenus become pages inside the same popover, with a Back row.
function subscribeToPhone(onChange: () => void) {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const phoneSnapshot = () => window.matchMedia(PHONE_QUERY).matches;

export interface ModelPickerProps {
  /** The catalog. Defaults to a sample lineup of current models. */
  models?: PickerModel[];
  /** Providers in the order More models groups them. */
  providers?: PickerProvider[];
  /** Model ids listed at the top of the menu, in order. */
  featured?: string[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string, model: PickerModel) => void;
  effort?: Effort;
  defaultEffort?: Effort;
  onEffortChange?: (effort: Effort) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Shows the review under the pill: description, context, prices and effort. */
  showSummary?: boolean;
  className?: string;
}

/**
 * A model picker in one quiet pill. Opening it lists the featured models with a one line note
 * each, plus an Effort submenu for reasoning models and every other model under More models,
 * grouped by provider; the pill morphs to the choice and the review underneath updates.
 */
export function ModelPicker({
  models,
  providers,
  featured,
  value,
  defaultValue,
  onValueChange,
  effort,
  defaultEffort,
  onEffortChange,
  open,
  defaultOpen = false,
  onOpenChange,
  showSummary = true,
  className,
}: ModelPickerProps) {
  const reduced = !!useReducedMotion();
  const catalog = models ?? sampleModels;
  const providerList = providers ?? sampleProviders;
  const featuredIds = featured ?? (models ? catalog.slice(0, 4).map((model) => model.id) : sampleFeatured);
  const providersById = useMemo(
    () => new Map(providerList.map((provider) => [provider.id, provider])),
    [providerList],
  );

  const [selectedId, setSelectedId] = useControlled(
    value,
    defaultValue ?? featuredIds[0] ?? catalog[0]?.id ?? "",
  );
  const selected: PickerModel | undefined = catalog.find((model) => model.id === selectedId) ?? catalog[0];
  const [effortValue, setEffortValue] = useControlled<Effort>(
    effort,
    defaultEffort ?? (selected ? resolveEffort(selected, undefined) : undefined) ?? "medium",
    onEffortChange,
  );
  const [isOpen, setIsOpen] = useControlled(open, defaultOpen, onOpenChange);

  const [change, setChange] = useState<{ text: string; key: number } | null>(null);
  const [status, setStatus] = useState("");
  const changeKey = useRef(0);
  const trigger = useRef<HTMLButtonElement>(null);
  // Which input opened the menu last: a pointer close must not steal focus back visibly.
  const modality = useRef<"pointer" | "keyboard">("pointer");
  const isPhone = useSyncExternalStore(subscribeToPhone, phoneSnapshot, () => false);
  const [page, setPage] = useState<Page>("main");
  const [navigating, setNavigating] = useState(false);
  const previousPage = useRef<Page>("main");
  const listId = useId();

  // Land on something actionable after a page change: the row that opened it, or the current value.
  useEffect(() => {
    if (!isOpen || page === previousPage.current) return;
    const from = previousPage.current;
    previousPage.current = page;
    const frame = requestAnimationFrame(() => {
      const list = document.getElementById(listId);
      const next =
        page === "main"
          ? list?.querySelector<HTMLElement>(`[data-row="${from}"]`)
          : (list?.querySelector<HTMLElement>('[role="menuitemradio"][data-state="checked"]') ??
            list?.querySelector<HTMLElement>('[role="menuitemradio"]'));
      next?.focus({ preventScroll: false });
      next?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [page, isOpen, listId]);

  useEffect(() => {
    const pointer = () => {
      modality.current = "pointer";
    };
    const keyboard = () => {
      modality.current = "keyboard";
    };
    window.addEventListener("pointerdown", pointer, true);
    window.addEventListener("keydown", keyboard, true);
    return () => {
      window.removeEventListener("pointerdown", pointer, true);
      window.removeEventListener("keydown", keyboard, true);
    };
  }, []);

  useEffect(() => {
    if (!change) return;
    const timer = window.setTimeout(() => setChange(null), 2600);
    return () => window.clearTimeout(timer);
  }, [change]);

  const featuredModels = featuredIds
    .map((id) => catalog.find((model) => model.id === id))
    .filter((model): model is PickerModel => Boolean(model));
  const featuredSet = new Set(featuredModels.map((model) => model.id));
  const groups = providerList
    .map((provider) => ({
      provider,
      models: catalog.filter((model) => model.provider === provider.id && !featuredSet.has(model.id)),
    }))
    .filter((group) => group.models.length > 0);
  const orphans = catalog.filter(
    (model) => !featuredSet.has(model.id) && !providersById.has(model.provider),
  );

  if (!selected) return null;

  const resolvedEffort = resolveEffort(selected, effortValue);
  const provider = providersById.get(selected.provider);
  const showCurrentInMore = !featuredSet.has(selected.id);

  function handleSelect(id: string) {
    if (!selected) return;
    const next = catalog.find((model) => model.id === id);
    if (!next || id === selected.id) return;
    const nextEffort = resolveEffort(next, effortValue);
    setSelectedId(id);
    onValueChange?.(id, next);
    if (nextEffort && nextEffort !== effortValue) setEffortValue(nextEffort);
    setChange({ text: `Switched from ${selected.name}`, key: ++changeKey.current });
    setStatus(
      `Now using ${next.name}${nextEffort ? `, ${EFFORT_LABELS[nextEffort].toLowerCase()} effort` : ""}`,
    );
  }

  const swapMotion = reduced
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0, transition: { duration: 0 } },
        transition: { duration: 0 },
      }
    : {
        initial: { opacity: 0, y: 4 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, transition: { duration: duration.instant, ease: STANDARD_EASE } },
        transition: { duration: duration.fast, ease: STANDARD_EASE },
      };

  const effortMenu =
    selected.effort && resolvedEffort ? (
      <DropdownMenu.RadioGroup
        value={resolvedEffort}
        onValueChange={(next) => {
          if (next === resolvedEffort) return;
          const level = next as Effort;
          setEffortValue(level);
          setChange({ text: `Effort set to ${EFFORT_LABELS[level].toLowerCase()}`, key: ++changeKey.current });
          setStatus(`${selected.name}, ${EFFORT_LABELS[level].toLowerCase()} effort`);
        }}
      >
        {selected.effort.levels.map((level) => (
          <DropdownMenu.RadioItem
            key={level}
            value={level}
            textValue={EFFORT_LABELS[level]}
            className={cx(styles.item, styles.effortItem)}
          >
            <span className={styles.itemText}>
              <span className={styles.itemName}>
                {EFFORT_LABELS[level]}
                {level === selected.effort?.default && <span className={styles.default}>Default</span>}
              </span>
              <span className={styles.itemBlurb}>{EFFORT_NOTES[level]}</span>
            </span>
            <DropdownMenu.ItemIndicator className={styles.check}>
              <Check aria-hidden="true" />
            </DropdownMenu.ItemIndicator>
          </DropdownMenu.RadioItem>
        ))}
      </DropdownMenu.RadioGroup>
    ) : null;

  const hasMore = groups.length > 0 || orphans.length > 0;

  const moreMenu = (
    <DropdownMenu.RadioGroup value={selected.id} onValueChange={handleSelect}>
      {[...groups, ...(orphans.length ? [{ provider: undefined, models: orphans }] : [])].map((group) => (
        <Fragment key={group.provider?.id ?? "other"}>
          <DropdownMenu.Label className={styles.groupLabel}>
            {group.provider?.name ?? "Other"}
          </DropdownMenu.Label>
          {group.models.map((model) => (
            <DropdownMenu.RadioItem
              key={model.id}
              value={model.id}
              textValue={model.name}
              className={cx(styles.item, styles.compact)}
            >
              <ModelMarkView model={model} provider={group.provider} className={styles.compactMark} />
              <span className={styles.compactName}>{model.name}</span>
              {model.tag && <span className={styles.tag}>{model.tag}</span>}
              <DropdownMenu.ItemIndicator className={styles.check}>
                <Check aria-hidden="true" />
              </DropdownMenu.ItemIndicator>
            </DropdownMenu.RadioItem>
          ))}
        </Fragment>
      ))}
    </DropdownMenu.RadioGroup>
  );

  const effortRow = resolvedEffort ? (
    <>
      <Gauge className={styles.rowIcon} aria-hidden="true" />
      <span className={styles.rowLabel}>Effort</span>
      <span className={styles.rowValue}>{EFFORT_LABELS[resolvedEffort]}</span>
      <ChevronRight className={styles.rowChevron} aria-hidden="true" />
    </>
  ) : null;

  const moreRow = (
    <>
      <Layers className={styles.rowIcon} aria-hidden="true" />
      <span className={styles.rowLabel}>More models</span>
      {showCurrentInMore && <span className={styles.rowValue}>{selected.name}</span>}
      <ChevronRight className={styles.rowChevron} aria-hidden="true" />
    </>
  );

  const goPage = (next: Page) => (event: Event) => {
    event.preventDefault();
    setNavigating(true);
    setPage(next);
  };

  const backRow = (label: string) => (
    <>
      <DropdownMenu.Item
        className={cx(styles.row, styles.back)}
        textValue="Back"
        aria-label={`Back to all models, ${label}`}
        onSelect={goPage("main")}
      >
        <ChevronLeft className={styles.rowIcon} aria-hidden="true" />
        <span className={styles.rowLabel}>{label}</span>
      </DropdownMenu.Item>
      <DropdownMenu.Separator className={styles.separator} />
    </>
  );

  const mainItems = (
    <>
      <DropdownMenu.RadioGroup value={selected.id} onValueChange={handleSelect}>
        {featuredModels.map((model, index) => (
          <DropdownMenu.RadioItem
            key={model.id}
            value={model.id}
            textValue={model.name}
            className={styles.item}
            style={{ "--i": index } as CSSProperties}
          >
            <ModelMarkView
              model={model}
              provider={providersById.get(model.provider)}
              className={styles.itemMark}
            />
            <span className={styles.itemText}>
              <span className={styles.itemName}>{model.name}</span>
              <span className={styles.itemBlurb}>{model.blurb}</span>
            </span>
            <DropdownMenu.ItemIndicator className={styles.check}>
              <Check aria-hidden="true" />
            </DropdownMenu.ItemIndicator>
          </DropdownMenu.RadioItem>
        ))}
      </DropdownMenu.RadioGroup>
      {(effortMenu || hasMore) && <DropdownMenu.Separator className={styles.separator} />}
      {effortMenu &&
        (isPhone ? (
          <DropdownMenu.Item
            className={styles.row}
            data-row="effort"
            textValue="Effort"
            onSelect={goPage("effort")}
          >
            {effortRow}
          </DropdownMenu.Item>
        ) : (
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={styles.row} textValue="Effort">
              {effortRow}
            </DropdownMenu.SubTrigger>
            <SubMenu reduced={reduced} label="Effort" className={styles.effortMenu}>
              {effortMenu}
            </SubMenu>
          </DropdownMenu.Sub>
        ))}
      {hasMore &&
        (isPhone ? (
          <DropdownMenu.Item
            className={styles.row}
            data-row="more"
            textValue="More models"
            onSelect={goPage("more")}
          >
            {moreRow}
          </DropdownMenu.Item>
        ) : (
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={styles.row} textValue="More models">
              {moreRow}
            </DropdownMenu.SubTrigger>
            <SubMenu reduced={reduced} label="More models" className={styles.moreMenu}>
              {moreMenu}
            </SubMenu>
          </DropdownMenu.Sub>
        ))}
    </>
  );

  const activePage: Page = isPhone ? page : "main";
  const content =
    activePage === "effort" && effortMenu ? (
      <>
        {backRow("Effort")}
        {effortMenu}
      </>
    ) : activePage === "more" ? (
      <>
        {backRow("More models")}
        {moreMenu}
      </>
    ) : (
      mainItems
    );

  return (
    <div className={cx(styles.root, className)}>
      <div className={styles.stage}>
        <DropdownMenu.Root
          open={isOpen}
          onOpenChange={(next) => {
            if (next) {
              setPage("main");
              setNavigating(false);
              previousPage.current = "main";
            }
            setIsOpen(next);
          }}
        >
          <DropdownMenu.Trigger
            ref={trigger}
            className={styles.trigger}
            aria-label={`Model: ${selected.name}${
              resolvedEffort ? `, ${EFFORT_LABELS[resolvedEffort].toLowerCase()} effort` : ""
            }. Change model`}
          >
            <TriggerContent model={selected} provider={provider} level={resolvedEffort} reduced={reduced} />
            <ChevronDown className={styles.chevron} aria-hidden="true" />
          </DropdownMenu.Trigger>
          <Menu
            reduced={reduced}
            page={activePage}
            listId={listId}
            onCloseAutoFocus={(event) => {
              if (modality.current !== "pointer") return;
              event.preventDefault();
              // Radix would focus the pill with a visible ring; the pointer close keeps the ring off.
              const options: FocusOptions & { focusVisible: boolean } = {
                preventScroll: true,
                focusVisible: false,
              };
              trigger.current?.focus(options);
            }}
            onKeyDown={(event) => {
              if (!isPhone) return;
              if (activePage !== "main" && event.key === "ArrowLeft") {
                event.preventDefault();
                setNavigating(true);
                setPage("main");
                return;
              }
              const row = (event.target as HTMLElement).dataset.row;
              if (activePage === "main" && event.key === "ArrowRight" && row) {
                event.preventDefault();
                setNavigating(true);
                setPage(row as Page);
              }
            }}
          >
            <motion.div
              key={activePage}
              className={styles.page}
              initial={!reduced && navigating ? { opacity: 0, x: activePage === "main" ? -12 : 12 } : false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: duration.fast, ease: STANDARD_EASE }}
            >
              {content}
            </motion.div>
          </Menu>
        </DropdownMenu.Root>
        {showSummary && (
          <section className={styles.summary} aria-label="Selected model">
            <div className={styles.descriptionSlot}>
              <AnimatePresence initial={false} mode="popLayout">
                <motion.p key={selected.id} className={styles.description} {...swapMotion}>
                  {selected.description}
                </motion.p>
              </AnimatePresence>
            </div>
            <dl className={styles.facts}>
              <div className={styles.fact}>
                <dt>Context</dt>
                <dd>
                  <Swap
                    reduced={reduced}
                    value={
                      selected.context >= 1e6
                        ? `${+(selected.context / 1e6).toFixed(1)}M tokens`
                        : `${Math.round(selected.context / 1e3)}K tokens`
                    }
                  >
                    {selected.context >= 1e6
                      ? `${+(selected.context / 1e6).toFixed(1)}M tokens`
                      : `${Math.round(selected.context / 1e3)}K tokens`}
                  </Swap>
                </dd>
              </div>
              <div className={styles.fact}>
                <dt>Input</dt>
                <dd>
                  <Swap reduced={reduced} value={formatPrice(selected.price.input)}>
                    {formatPrice(selected.price.input)}
                  </Swap>
                </dd>
              </div>
              <div className={styles.fact}>
                <dt>Output</dt>
                <dd>
                  <Swap reduced={reduced} value={formatPrice(selected.price.output)}>
                    {formatPrice(selected.price.output)}
                  </Swap>
                </dd>
              </div>
              <div className={styles.fact}>
                <dt>Effort</dt>
                <dd>
                  <Swap
                    reduced={reduced}
                    value={resolvedEffort ? EFFORT_LABELS[resolvedEffort] : "Fixed"}
                  >
                    {resolvedEffort ? EFFORT_LABELS[resolvedEffort] : "Fixed"}
                  </Swap>
                </dd>
              </div>
            </dl>
            <p className={styles.note}>
              Prices per million tokens
              {catalog === sampleModels ? ". Non-Anthropic prices are sample values" : ""}
            </p>
            <div className={styles.changeSlot}>
              <AnimatePresence initial={false}>
                {change && (
                  <motion.p key={change.key} className={styles.change} {...swapMotion}>
                    <Check aria-hidden="true" />
                    {change.text}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </section>
        )}
      </div>
      <p className={styles.srOnly} role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

export default ModelPicker;
