"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { CircleAlert, RotateCcw } from "lucide-react";
import { Button } from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import Slider from "../slider/slider";
import { Switch } from "../switch/switch";
import styles from "./llm-cost-calculator.module.css";

/** List price of one model, in dollars per million tokens. */
export interface LlmModelPrice {
  id: string;
  name: string;
  provider: string;
  /** Input price per million tokens. */
  input: number;
  /** Cache read price per million tokens. Falls back to `input`. */
  cachedInput?: number;
  /** Output price per million tokens. */
  output: number;
  /** Brand mark shown beside the name. */
  mark?: ReactNode;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  requestsPerDay: number;
  /** Bill part of the input at the cache read rate. */
  cached: boolean;
}

export interface LlmCostPreset {
  id: string;
  label: string;
  usage: LlmUsage;
}

export interface LlmCostBreakdown {
  input: number;
  cachedInput: number;
  output: number;
  total: number;
  perRequest: number;
}

export interface LlmCostCalculatorProps {
  models?: LlmModelPrice[];
  usage?: LlmUsage;
  defaultUsage?: LlmUsage;
  onUsageChange?: (usage: LlmUsage) => void;
  selected?: string;
  defaultSelected?: string;
  onSelectedChange?: (id: string, model: LlmModelPrice) => void;
  /** Pass `false` to hide the workload presets. */
  presets?: LlmCostPreset[] | false;
  cacheHitRate?: number;
  daysPerMonth?: number;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  title?: string;
  description?: string;
  note?: string;
  className?: string;
}

const ClaudeMark = (
  <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Claude" style={{ color: "#D97757" }}>
    <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
  </svg>
);

function OpenAiMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="OpenAI">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

function GeminiMark() {
  const raw = useId();
  const suffix = raw.replace(/[^a-zA-Z0-9_-]/g, "");
  const path =
    "M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z";
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Gemini">
      <path d={path} fill="#3186FF" />
      <path d={path} fill={`url(#lobe-icons-gemini-0-${suffix})`} />
      <path d={path} fill={`url(#lobe-icons-gemini-1-${suffix})`} />
      <path d={path} fill={`url(#lobe-icons-gemini-2-${suffix})`} />
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

function DeepSeekMark() {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="DeepSeek">
      <path
        d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z"
        fill="#4D6BFE"
      />
    </svg>
  );
}

/** Eight models with sample list prices, newest flagships first. */
export const llmCostSampleModels: LlmModelPrice[] = [
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", provider: "Anthropic", mark: ClaudeMark, input: 5, cachedInput: 0.5, output: 25 },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", provider: "Anthropic", mark: ClaudeMark, input: 3, cachedInput: 0.3, output: 15 },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", provider: "Anthropic", mark: ClaudeMark, input: 1, cachedInput: 0.1, output: 5 },
  { id: "gpt-6-1-sol", name: "GPT-6.1 Sol", provider: "OpenAI", mark: <OpenAiMark />, input: 2.5, cachedInput: 0.25, output: 20 },
  { id: "gpt-6-luna", name: "GPT-6 Luna", provider: "OpenAI", mark: <OpenAiMark />, input: 0.25, cachedInput: 0.025, output: 3 },
  { id: "gemini-4-argon", name: "Gemini 4 Argon", provider: "Google", mark: <GeminiMark />, input: 2, cachedInput: 0.5, output: 12 },
  { id: "gemini-3-8-flash", name: "Gemini 3.8 Flash", provider: "Google", mark: <GeminiMark />, input: 0.3, cachedInput: 0.075, output: 2.5 },
  { id: "deepseek-v4-1-flash", name: "DeepSeek V4.1 Flash", provider: "DeepSeek", mark: <DeepSeekMark />, input: 0.2, cachedInput: 0.02, output: 0.8 },
];

export const llmCostPresets: LlmCostPreset[] = [
  { id: "chat", label: "Chat", usage: { inputTokens: 2000, outputTokens: 500, requestsPerDay: 10000, cached: false } },
  { id: "rag", label: "RAG", usage: { inputTokens: 16000, outputTokens: 500, requestsPerDay: 5000, cached: true } },
  { id: "agent", label: "Agent", usage: { inputTokens: 64000, outputTokens: 2000, requestsPerDay: 2500, cached: true } },
  { id: "batch", label: "Batch", usage: { inputTokens: 8000, outputTokens: 250, requestsPerDay: 50000, cached: false } },
];

/** Slider stops. Costs move in these steps rather than continuously. */
const STOPS = {
  inputTokens: [250, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000, 200000],
  outputTokens: [100, 250, 500, 1000, 2000, 4000, 8000, 16000],
  requestsPerDay: [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000],
} as const;

const DEFAULT_USAGE = llmCostPresets[1]!.usage;

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");
const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];
const SPRING = { type: "spring" as const, visualDuration: 0.24, bounce: 0 };

const whole = new Intl.NumberFormat("en-US");
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

/** Row cost: cents below $100, whole dollars below $100 000, compact above it. */
function rowCost(value: number) {
  return value < 100 ? cents.format(value) : value < 100000 ? currency.format(value) : compact.format(value);
}

/** Headline cost: cents below $100, whole dollars above it. */
const headline = (value: number) => (value < 100 ? cents.format(value) : currency.format(value));

function perRequestCost(value: number) {
  const digits = value < 0.001 ? 5 : value < 0.01 ? 4 : value < 1 ? 3 : 2;
  return `$${value.toFixed(digits)}`;
}

/** Price per million tokens in the note under the breakdown. */
const unitPrice = (value: number) => `$${value < 0.1 ? value.toFixed(3) : value.toFixed(2)}`;

/** Index of the stop closest to `value`. */
function nearestIndex(list: readonly number[], value: number) {
  return list.reduce((best, stop, index) => (Math.abs(stop - value) < Math.abs(list[best]! - value) ? index : best), 0);
}

/** Monthly spend for one model at one workload. */
export function computeLlmCost(
  model: LlmModelPrice,
  usage: LlmUsage,
  options: { cacheHitRate?: number; daysPerMonth?: number } = {},
): LlmCostBreakdown {
  const hit = usage.cached ? Math.min(1, Math.max(0, options.cacheHitRate ?? 0.6)) : 0;
  const requests = usage.requestsPerDay * (options.daysPerMonth ?? 30);
  const input = (usage.inputTokens * (1 - hit) * model.input) / 1e6;
  const cachedInput = (usage.inputTokens * hit * (model.cachedInput ?? model.input)) / 1e6;
  const output = (usage.outputTokens * model.output) / 1e6;
  const perRequest = input + cachedInput + output;
  return {
    input: input * requests,
    cachedInput: cachedInput * requests,
    output: output * requests,
    total: perRequest * requests,
    perRequest,
  };
}

interface RollingNumberProps {
  value: number;
  format: (value: number) => string;
  className?: string;
}

/** A number that counts to its new value, written straight to the DOM so React does not re-render on every frame. */
function RollingNumber({ value, format, className }: RollingNumberProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(value);
  const [text] = useState(() => format(value));

  useMotionValueEvent(motionValue, "change", (latest) => {
    if (ref.current) ref.current.textContent = format(latest);
  });

  useEffect(() => {
    if (reduced) {
      motionValue.jump(value);
      if (ref.current) ref.current.textContent = format(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: 0.24, ease: EASE });
    return () => controls.stop();
  }, [value, reduced, motionValue, format]);

  return (
    <span ref={ref} className={cx(styles.num, className)}>
      {text}
    </span>
  );
}

/** Text that crossfades when it changes. */
function Swap({ text, className }: { text: string; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <span className={cx(styles.swap, className)}>
      <AnimatePresence initial={false}>
        <motion.span
          key={text}
          className={styles.swapItem}
          initial={{ opacity: 0, y: 2 * Number(!reduced) }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.16 * Number(!reduced), ease: EASE } }}
          exit={{ opacity: 0, transition: { duration: 0.1 * Number(!reduced) } }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const panelVariants = (reduced: boolean | null): Variants => ({
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.16 * Number(!reduced), ease: EASE } },
  exit: { opacity: 0, transition: { duration: 0.1 * Number(!reduced) } },
});

export function LlmCostCalculator({
  models = llmCostSampleModels,
  usage,
  defaultUsage = DEFAULT_USAGE,
  onUsageChange,
  selected,
  defaultSelected,
  onSelectedChange,
  presets = llmCostPresets,
  cacheHitRate = 0.6,
  daysPerMonth = 30,
  loading = false,
  error,
  onRetry,
  title = "Estimated monthly cost",
  description = "Sample list prices per 1M tokens, October 2026",
  note = "Sample prices for illustration, not a quote. Calculated in your browser, nothing was sent.",
  className,
}: LlmCostCalculatorProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const [ownUsage, setOwnUsage] = useState(defaultUsage);
  const current = usage ?? ownUsage;
  const [ownSelected, setOwnSelected] = useState(defaultSelected ?? models[1]?.id ?? models[0]?.id ?? "");
  const listRef = useRef<HTMLDivElement>(null);

  const update = (next: LlmUsage) => {
    if (!usage) setOwnUsage(next);
    onUsageChange?.(next);
  };

  const rows = useMemo(
    () =>
      models
        .map((model, index) => ({ model, index, cost: computeLlmCost(model, current, { cacheHitRate, daysPerMonth }) }))
        .sort((a, b) => a.cost.total - b.cost.total || a.index - b.index),
    [models, current, cacheHitRate, daysPerMonth],
  );

  const maxTotal = rows.reduce((max, row) => Math.max(max, row.cost.total), 0);
  const activeId = rows.some((row) => row.model.id === (selected ?? ownSelected)) ? (selected ?? ownSelected) : rows[0]?.model.id;
  const activeIndex = rows.findIndex((row) => row.model.id === activeId);
  const activeRow = rows[activeIndex];

  const choose = (row: { model: LlmModelPrice }) => {
    if (selected === undefined) setOwnSelected(row.model.id);
    onSelectedChange?.(row.model.id, row.model);
  };

  const ready = !loading && !error && rows.length > 0;
  const mode = loading ? "loading" : error ? "error" : rows.length === 0 ? "empty" : "list";
  const slots = Math.max(models.length, 4);

  const [announced, setAnnounced] = useState("");
  const message = loading
    ? "Loading prices."
    : error
      ? `Prices did not load. ${error}`
      : activeRow
        ? `${activeRow.model.name}, ${headline(activeRow.cost.total)} per month, ${activeIndex === 0 ? "the lowest cost" : `rank ${activeIndex + 1} of ${rows.length}`}. Sample prices, calculated in your browser, nothing was sent.`
        : "No models to compare.";

  /* The very first message stays quiet, every change after it is announced once. Comparing the committed value inside the
     effect keeps a second render in the same commit from swallowing the change. */
  const spoken = useRef<string | null>(null);

  useEffect(() => {
    if (spoken.current === message) return;
    const first = spoken.current === null;
    spoken.current = message;
    if (first) return;
    const timer = window.setTimeout(() => setAnnounced(message), 450);
    return () => window.clearTimeout(timer);
  }, [message]);

  const presetId = presets
    ? (presets.find(
        (preset) =>
          preset.usage.inputTokens === current.inputTokens &&
          preset.usage.outputTokens === current.outputTokens &&
          preset.usage.requestsPerDay === current.requestsPerDay &&
          preset.usage.cached === current.cached,
      )?.id ?? "custom")
    : "custom";

  const indexes = {
    inputTokens: nearestIndex(STOPS.inputTokens, current.inputTokens),
    outputTokens: nearestIndex(STOPS.outputTokens, current.outputTokens),
    requestsPerDay: nearestIndex(STOPS.requestsPerDay, current.requestsPerDay),
  };

  const slider = (field: keyof typeof STOPS, label: string) => (
    <Slider
      label={label}
      min={0}
      max={STOPS[field].length - 1}
      step={1}
      largeStep={2}
      value={indexes[field]}
      format={(index) => whole.format(STOPS[field][Math.round(index)] ?? 0)}
      onValueChange={(index) => update({ ...current, [field]: STOPS[field][index] ?? current[field] })}
      disabled={!ready}
    />
  );

  const variants = panelVariants(reduced);
  const cacheShare = Math.round(100 * Math.min(1, Math.max(0, cacheHitRate)));

  return (
    <section className={cx(styles.root, className)} aria-labelledby={`${id}-title`} aria-busy={loading || undefined}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h3 id={`${id}-title`} className={styles.title}>
            {title}
          </h3>
          {description && <p className={styles.meta}>{description}</p>}
        </div>
        <div className={styles.hero} aria-hidden="true">
          {ready && activeRow ? (
            <>
              <RollingNumber value={activeRow.cost.total} format={headline} className={styles.total} />
              <span className={styles.heroMeta}>
                <Swap text={`${activeRow.model.name} per month`} />
              </span>
            </>
          ) : (
            <>
              <span className={cx(styles.total, styles.totalIdle)}>
                {loading ? <span className={cx(styles.skeleton, styles.skeletonTotal)} /> : "$0.00"}
              </span>
              <span className={styles.heroMeta}>
                {loading ? "Loading prices" : error ? "Prices unavailable" : "No model selected"}
              </span>
            </>
          )}
        </div>
      </header>

      {presets && presets.length > 0 && (
        <SegmentedControl
          className={styles.presets}
          label="Workload"
          value={presetId}
          onValueChange={(next) => {
            const preset = presets.find((entry) => entry.id === next);
            if (preset) update(preset.usage);
          }}
          options={[...presets.map((preset) => ({ value: preset.id, label: preset.label })), { value: "custom", label: "Custom" }]}
        />
      )}

      <div className={styles.controls}>
        <div className={styles.sliders}>
          {slider("inputTokens", "Input tokens")}
          {slider("outputTokens", "Output tokens")}
          {slider("requestsPerDay", "Requests per day")}
        </div>
        <div className={styles.cache}>
          <Switch label="Cached input" checked={current.cached} onCheckedChange={(checked) => update({ ...current, cached: checked })} disabled={!ready} />
          <span className={styles.meta}>
            <Swap text={current.cached ? `${cacheShare}% of input billed at the cache read rate` : "All input billed at the full rate"} />
          </span>
        </div>
      </div>

      <div className={styles.ranking}>
        <div className={styles.listHead} aria-hidden="true">
          <span>Model</span>
          <span>Per month</span>
        </div>
        <div className={styles.stage} style={{ "--slots": slots } as CSSProperties}>
          <AnimatePresence initial={false} mode="wait">
            {mode === "list" && (
              <motion.div
                key="list"
                ref={listRef}
                className={styles.list}
                role="radiogroup"
                aria-label="Models ranked by monthly cost, lowest first"
                style={{ "--rows": rows.length } as CSSProperties}
                {...variants}
              >
                {rows.map((row, index) => (
                  <span
                    key={`slot-${row.model.id}`}
                    className={styles.rankSlot}
                    style={{ transform: `translateY(calc(var(--row) * ${index}))` }}
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                ))}
                {rows.map((row, index) => {
                  const active = row.model.id === activeId;
                  const share = maxTotal > 0 ? row.cost.total / maxTotal : 0;
                  return (
                    <motion.button
                      key={row.model.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={`${row.model.name} by ${row.model.provider}, rank ${index + 1}, ${rowCost(row.cost.total)} per month`}
                      tabIndex={active ? 0 : -1}
                      data-model={row.model.id}
                      data-on={active || undefined}
                      className={styles.row}
                      initial={false}
                      animate={{ y: `${100 * index}%` }}
                      transition={reduced ? { duration: 0 } : SPRING}
                      onClick={() => choose(row)}
                      onKeyDown={(event) => {
                        const last = rows.length - 1;
                        const next =
                          event.key === "ArrowDown" || event.key === "ArrowRight"
                            ? Math.min(last, index + 1)
                            : event.key === "ArrowUp" || event.key === "ArrowLeft"
                              ? Math.max(0, index - 1)
                              : event.key === "Home"
                                ? 0
                                : event.key === "End"
                                  ? last
                                  : -1;
                        if (next < 0) return;
                        event.preventDefault();
                        const target = rows[next];
                        if (!target) return;
                        choose(target);
                        listRef.current?.querySelector<HTMLElement>(`[data-model="${CSS.escape(target.model.id)}"]`)?.focus();
                      }}
                    >
                      <span className={styles.rank} />
                      <span className={styles.mark} aria-hidden="true">
                        {row.model.mark}
                      </span>
                      <span className={styles.name}>{row.model.name}</span>
                      <span className={styles.track} aria-hidden="true">
                        <motion.span
                          className={styles.bar}
                          initial={false}
                          animate={{ width: `${Math.max(1.5, 100 * share)}%` }}
                          transition={reduced ? { duration: 0 } : SPRING}
                        />
                      </span>
                      <RollingNumber value={row.cost.total} format={rowCost} className={styles.cost} />
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
            {mode === "loading" && (
              <motion.div
                key="loading"
                className={styles.list}
                aria-hidden="true"
                style={{ "--rows": slots } as CSSProperties}
                {...variants}
              >
                {Array.from({ length: slots }, (_, index) => (
                  <div
                    key={index}
                    className={cx(styles.row, styles.ghost)}
                    style={{ transform: `translateY(${100 * index}%)` }}
                  >
                    <span className={styles.rank}>{index + 1}</span>
                    <span className={cx(styles.skeleton, styles.skeletonMark)} />
                    <span
                      className={cx(styles.skeleton, styles.skeletonName)}
                      style={{ width: `${62 + ((23 * index) % 30)}%` }}
                    />
                    <span className={styles.track} />
                    <span className={cx(styles.skeleton, styles.skeletonCost)} />
                  </div>
                ))}
              </motion.div>
            )}
            {(mode === "error" || mode === "empty") && (
              <motion.div key={mode} className={styles.message} {...variants}>
                {mode === "error" ? (
                  <>
                    <span className={styles.messageTitle}>
                      <CircleAlert size={16} aria-hidden="true" className={styles.messageIcon} />
                      Prices did not load
                    </span>
                    <span className={styles.meta}>{error}</span>
                    {onRetry && (
                      <Button size="sm" variant="secondary" onClick={onRetry} className={styles.retry}>
                        <RotateCcw size={14} aria-hidden="true" />
                        Try again
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <span className={styles.messageTitle}>No models to compare</span>
                    <span className={styles.meta}>Add models with input and output prices to rank them.</span>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <footer className={styles.footer}>
        <dl className={styles.breakdown} aria-label={activeRow ? `${activeRow.model.name} breakdown` : "Breakdown"}>
          <div className={styles.stat}>
            <dt className={styles.meta}>Input</dt>
            <dd>
              {ready && activeRow ? (
                <RollingNumber value={activeRow.cost.input} format={rowCost} />
              ) : (
                <span className={styles.num}>$0.00</span>
              )}
            </dd>
          </div>
          <div className={styles.stat}>
            <dt className={styles.meta}>Cached</dt>
            <dd>
              {ready && activeRow ? (
                <RollingNumber value={activeRow.cost.cachedInput} format={rowCost} />
              ) : (
                <span className={styles.num}>$0.00</span>
              )}
            </dd>
          </div>
          <div className={styles.stat}>
            <dt className={styles.meta}>Output</dt>
            <dd>
              {ready && activeRow ? (
                <RollingNumber value={activeRow.cost.output} format={rowCost} />
              ) : (
                <span className={styles.num}>$0.00</span>
              )}
            </dd>
          </div>
          <div className={cx(styles.stat, styles.statEnd)}>
            <dt className={styles.meta}>Per request</dt>
            <dd>
              {ready && activeRow ? (
                <RollingNumber value={activeRow.cost.perRequest} format={perRequestCost} />
              ) : (
                <span className={styles.num}>$0.0000</span>
              )}
            </dd>
          </div>
        </dl>
        <p className={styles.note}>
          {activeRow && ready ? (
            <Swap
              text={`${activeRow.model.name}: ${unitPrice(activeRow.model.input)} in, ${unitPrice(activeRow.model.cachedInput ?? activeRow.model.input)} cached, ${unitPrice(activeRow.model.output)} out per 1M tokens.`}
            />
          ) : (
            <span>{"\u00a0"}</span>
          )}
          <span className={styles.fine}>{note}</span>
        </p>
      </footer>

      <span className={styles.srOnly} role="status" aria-live="polite">
        {announced}
      </span>
    </section>
  );
}

export default LlmCostCalculator;
