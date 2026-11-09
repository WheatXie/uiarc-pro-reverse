"use client";

import { useId, useState } from "react";
import { RotateCcw } from "lucide-react";
import Button from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import { ModelCard } from "./model-card";
import type { ModelCardBenchmark, ModelCardModel } from "./model-card";
import styles from "./model-card.module.css";

/** Claude's burst, drawn at 16px everywhere the card shows a model. */
const CLAUDE_PATH =
  "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z";

const OPENAI_PATH =
  "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z";

const GEMINI_PATH =
  "M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z";

function ClaudeMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Claude" aria-hidden="true" style={{ color: "#D97757" }}>
      <path d={CLAUDE_PATH} />
    </svg>
  );
}

function OpenAIMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="OpenAI" aria-hidden="true">
      <path d={OPENAI_PATH} />
    </svg>
  );
}

/** Three tinted copies of the same shape, each fading out along its own axis. */
function GeminiMark() {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Gemini" aria-hidden="true">
      <path d={GEMINI_PATH} fill="#3186FF" />
      <path d={GEMINI_PATH} fill={`url(#${id}-0)`} />
      <path d={GEMINI_PATH} fill={`url(#${id}-1)`} />
      <path d={GEMINI_PATH} fill={`url(#${id}-2)`} />
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id={`${id}-0`} x1="7" x2="11" y1="15.5" y2="12">
          <stop stopColor="#08B962" />
          <stop offset="1" stopColor="#08B962" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={`${id}-1`} x1="8" x2="11.5" y1="5.5" y2="11">
          <stop stopColor="#F94543" />
          <stop offset="1" stopColor="#F94543" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={`${id}-2`} x1="3.5" x2="17.5" y1="13.5" y2="12">
          <stop stopColor="#FABC12" />
          <stop offset=".46" stopColor="#FABC12" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const BENCHMARKS: ModelCardBenchmark[] = [
  { id: "swe-bench", name: "SWE-bench Verified", shortName: "SWE-bench", description: "real GitHub issues resolved" },
  { id: "gpqa", name: "GPQA Diamond", shortName: "GPQA", description: "graduate level science questions" },
  { id: "terminal-bench", name: "Terminal-Bench 2.0", shortName: "Terminal-Bench", description: "end to end terminal tasks" },
];

const MODELS: ModelCardModel[] = [
  {
    id: "claude-opus-5-5",
    name: "Claude Opus 5.5",
    provider: "Anthropic",
    mark: <ClaudeMark />,
    summary: "Anthropic's most capable model for long running agents, complex coding and deep research.",
    modalities: ["text", "image", "pdf", "tools", "reasoning"],
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    knowledgeCutoff: "Mar 2026",
    pricing: { input: 5, output: 25, cachedInput: 0.5 },
    scores: { "swe-bench": 86.4, gpqa: 89.2, "terminal-bench": 68.3 },
  },
  {
    id: "claude-sonnet-5-5",
    name: "Claude Sonnet 5.5",
    provider: "Anthropic",
    mark: <ClaudeMark />,
    summary: "The everyday model: fast enough for every request, strong enough for most of them.",
    modalities: ["text", "image", "pdf", "tools", "reasoning"],
    contextWindow: 1_000_000,
    maxOutput: 64_000,
    knowledgeCutoff: "Jun 2025",
    pricing: { input: 3, output: 15, cachedInput: 0.3 },
    scores: { "swe-bench": 78.2, gpqa: 82.4, "terminal-bench": 55.6 },
  },
  {
    id: "gpt-6-1-sol",
    name: "GPT-6.1 Sol",
    provider: "OpenAI",
    mark: <OpenAIMark />,
    summary: "OpenAI's flagship, tuned for tool use and long transcripts.",
    modalities: ["text", "image", "audio", "tools", "reasoning"],
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    knowledgeCutoff: "Jan 2026",
    pricing: { input: 4, output: 24, cachedInput: 0.4 },
    scores: { "swe-bench": 84.1, gpqa: 90.1, "terminal-bench": 63.9 },
  },
  {
    id: "gemini-4-argon",
    name: "Gemini 4 Argon",
    provider: "Google",
    mark: <GeminiMark />,
    summary: "Reads video and audio natively, with the longest context of the group.",
    modalities: ["text", "image", "pdf", "audio", "video", "tools", "reasoning"],
    contextWindow: 2_000_000,
    maxOutput: 128_000,
    knowledgeCutoff: "Feb 2026",
    pricing: { input: 3.5, output: 21, cachedInput: 0.35 },
    scores: { "swe-bench": 82.7, gpqa: 88.6, "terminal-bench": 61.2 },
  },
  {
    id: "grok-4-7",
    name: "Grok 4.7",
    provider: "xAI",
    summary: "Cheap, blunt, and quick to reason out loud.",
    modalities: ["text", "image", "tools", "reasoning"],
    contextWindow: 512_000,
    maxOutput: 96_000,
    knowledgeCutoff: "Nov 2025",
    pricing: { input: 3, output: 18, cachedInput: 0.3 },
    scores: { "swe-bench": 79.4, gpqa: 85.2, "terminal-bench": 58.7 },
  },
];

const SWITCHES = [
  { value: "claude-opus-5-5", label: "Opus 5.5" },
  { value: "claude-sonnet-5-5", label: "Sonnet 5.5" },
  { value: "gpt-6-1-sol", label: "GPT-6.1" },
  { value: "gemini-4-argon", label: "Gemini 4" },
];

/** Who sits in which compare column: the flagship first, so the default reading is the interesting one. */
const ORDER = ["gpt-6-1-sol", "gemini-4-argon", "claude-opus-5-5", "grok-4-7", "claude-sonnet-5-5"];

export const meta = "Live · component";

export default function ModelCardDemo() {
  const [current, setCurrent] = useState("claude-opus-5-5");
  const [generation, setGeneration] = useState(0);
  const model = MODELS.find(item => item.id === current) ?? MODELS[0];
  const rivals = ORDER.filter(id => id !== model.id).flatMap(id => MODELS.filter(item => item.id === id));

  return (
    <div className={styles.demo}>
      <div className={styles.controls}>
        <SegmentedControl label="Model" options={SWITCHES} value={model.id} onValueChange={setCurrent} />
        <Button variant="ghost" size="sm" onClick={() => setGeneration(value => value + 1)}>
          <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
          Reload
        </Button>
      </div>
      <ModelCard key={generation} model={model} rivals={rivals} benchmarks={BENCHMARKS} />
    </div>
  );
}
