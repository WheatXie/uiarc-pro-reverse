"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ElementType, SVGProps } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Check,
  ChevronDown,
  CircleCheck,
  FilePlusCorner,
  Info,
  Send,
  Shrink,
  TriangleAlert,
} from "lucide-react";
import { Button } from "../button/button";
import TextShimmer from "../text-shimmer/text-shimmer";
import { motionTokens } from "../motion-tokens";
import styles from "./context-window.module.css";

export type ContextCategory = "system" | "tools" | "files" | "summary" | "messages";

export type ContextKind = ContextCategory | "free" | "reserve";

export interface ContextItem {
  id: string;
  category: ContextCategory;
  label: string;
  tokens: number;
}

export interface ContextTurn {
  label: string;
  tokens: number;
}

export type ModelMarkProps = SVGProps<SVGSVGElement> & { title?: string };

export interface ContextModel {
  id: string;
  name: string;
  window: number;
  reserve: number;
  mark: ElementType<ModelMarkProps>;
  color?: string;
}

export interface ContextCompactEvent {
  folded: number;
  summary: number;
  before: number;
  after: number;
  automatic: boolean;
}

export interface ContextWindowProps {
  models?: ContextModel[];
  defaultModelId?: string;
  onModelChange?: (model: ContextModel) => void;
  items?: ContextItem[];
  threshold?: number;
  turns?: ContextTurn[];
  files?: ContextTurn[];
  summarize?: (folded: ContextItem[]) => number;
  onCompact?: (event: ContextCompactEvent) => void;
  onItemsChange?: (items: ContextItem[]) => void;
  className?: string;
}

type StatusTone = "info" | "warning" | "success" | "working";

interface ContextStatus {
  tone: StatusTone;
  text: string;
}

interface Sweep {
  from: number;
  step: number;
}

const CATEGORIES: ContextCategory[] = ["system", "tools", "files", "summary", "messages"];

const LEGEND: ContextKind[] = [
  "system",
  "tools",
  "files",
  "summary",
  "messages",
  "free",
  "reserve",
];

const LABELS: Record<ContextKind, string> = {
  system: "System prompt",
  tools: "Tools",
  files: "Files and memory",
  summary: "Summary",
  messages: "Messages",
  free: "Free",
  reserve: "Reserved for output",
};

function ClaudeMark({ title = "Claude", ...props }: ModelMarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

function KimiMark({ title = "Moonshot AI", ...props }: ModelMarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" role="img" aria-label={title} {...props}>
      <path d="M1.052 16.916l9.539 2.552a21.007 21.007 0 00.06 2.033l5.956 1.593a11.997 11.997 0 01-5.586.865l-.18-.016-.044-.004-.084-.009-.094-.01a11.605 11.605 0 01-.157-.02l-.107-.014-.11-.016a11.962 11.962 0 01-.32-.051l-.042-.008-.075-.013-.107-.02-.07-.015-.093-.019-.075-.016-.095-.02-.097-.023-.094-.022-.068-.017-.088-.022-.09-.024-.095-.025-.082-.023-.109-.03-.062-.02-.084-.025-.093-.028-.105-.034-.058-.019-.08-.026-.09-.031-.066-.024a6.293 6.293 0 01-.044-.015l-.068-.025-.101-.037-.057-.022-.08-.03-.087-.035-.088-.035-.079-.032-.095-.04-.063-.028-.063-.027a5.655 5.655 0 01-.041-.018l-.066-.03-.103-.047-.052-.024-.096-.046-.062-.03-.084-.04-.086-.044-.093-.047-.052-.027-.103-.055-.057-.03-.058-.032a6.49 6.49 0 01-.046-.026l-.094-.053-.06-.034-.051-.03-.072-.041-.082-.05-.093-.056-.052-.032-.084-.053-.061-.039-.079-.05-.07-.047-.053-.035a7.785 7.785 0 01-.054-.036l-.044-.03-.044-.03a6.066 6.066 0 01-.04-.028l-.057-.04-.076-.054-.069-.05-.074-.054-.056-.042-.076-.057-.076-.059-.086-.067-.045-.035-.064-.052-.074-.06-.089-.073-.046-.039-.046-.039a7.516 7.516 0 01-.043-.037l-.045-.04-.061-.053-.07-.062-.068-.06-.062-.058-.067-.062-.053-.05-.088-.084a13.28 13.28 0 01-.099-.097l-.029-.028-.041-.042-.069-.07-.05-.051-.05-.053a6.457 6.457 0 01-.168-.179l-.08-.088-.062-.07-.071-.08-.042-.049-.053-.062-.058-.068-.046-.056a7.175 7.175 0 01-.027-.033l-.045-.055-.066-.082-.041-.052-.05-.064-.02-.025a11.99 11.99 0 01-1.44-2.402zm-1.02-5.794l11.353 3.037a20.468 20.468 0 00-.469 2.011l10.817 2.894a12.076 12.076 0 01-1.845 2.005L.657 15.923l-.016-.046-.035-.104a11.965 11.965 0 01-.05-.153l-.007-.023a11.896 11.896 0 01-.207-.741l-.03-.126-.018-.08-.021-.097-.018-.081-.018-.09-.017-.084-.018-.094c-.026-.141-.05-.283-.071-.426l-.017-.118-.011-.083-.013-.102a12.01 12.01 0 01-.019-.161l-.005-.047a12.12 12.12 0 01-.034-2.145zm1.593-5.15l11.948 3.196c-.368.605-.705 1.231-1.01 1.875l11.295 3.022c-.142.82-.368 1.612-.668 2.365l-11.55-3.09L.124 10.26l.015-.1.008-.049.01-.067.015-.087.018-.098c.026-.148.056-.295.088-.442l.028-.124.02-.085.024-.097c.022-.09.045-.18.07-.268l.028-.102.023-.083.03-.1.025-.082.03-.096.026-.082.031-.095a11.896 11.896 0 011.01-2.232zm4.442-4.4L17.352 4.59a20.77 20.77 0 00-1.688 1.721l7.823 2.093c.267.852.442 1.744.513 2.665L2.106 5.213l.045-.065.027-.04.04-.055.046-.065.055-.076.054-.072.064-.086.05-.065.057-.073.055-.07.06-.074.055-.069.065-.077.054-.066.066-.077.053-.06.072-.082.053-.06.067-.074.054-.058.073-.078.058-.06.063-.067.168-.17.1-.098.059-.056.076-.071a12.084 12.084 0 012.272-1.677zM12.017 0h.097l.082.001.069.001.054.002.068.002.046.001.076.003.047.002.06.003.054.002.087.005.105.007.144.011.088.007.044.004.077.008.082.008.047.005.102.012.05.006.108.014.081.01.042.006.065.01.207.032.07.012.065.011.14.026.092.018.11.022.046.01.075.016.041.01L14.7.3l.042.01.065.015.049.012.071.017.096.024.112.03.113.03.113.032.05.015.07.02.078.024.073.023.05.016.05.016.076.025.099.033.102.036.048.017.064.023.093.034.11.041.116.045.1.04.047.02.06.024.041.018.063.026.04.018.057.025.11.048.1.046.074.035.075.036.06.028.092.046.091.045.102.052.053.028.049.026.046.024.06.033.041.022.052.029.088.05.106.06.087.051.057.034.053.032.096.059.088.055.098.062.036.024.064.041.084.056.04.027.062.042.062.043.023.017c.054.037.108.075.161.114l.083.06.065.048.056.043.086.065.082.064.04.03.05.041.086.069.079.065.085.071c.712.6 1.353 1.283 1.909 2.031L7.222.994l.062-.027.065-.028.081-.034.086-.035c.113-.045.227-.09.341-.131l.096-.035.093-.033.084-.03.096-.031c.087-.03.176-.058.264-.085l.091-.027.086-.025.102-.03.085-.023.1-.026L9.04.37l.09-.023.091-.022.095-.022.09-.02.098-.021.091-.02.095-.018.092-.018.1-.018.091-.016.098-.017.092-.014.097-.015.092-.013.102-.013.091-.012.105-.012.09-.01.105-.01c.093-.01.186-.018.28-.024l.106-.008.09-.005.11-.006.093-.004.1-.004.097-.002.099-.002.197-.002z" />
    </svg>
  );
}

function OpenAIMark({ title = "OpenAI", ...props }: ModelMarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

export const sampleModels: ContextModel[] = [
  {
    id: "claude-opus-5-5",
    name: "Claude Opus 5.5",
    window: 1_000_000,
    reserve: 64_000,
    mark: ClaudeMark,
    color: "#D97757",
  },
  {
    id: "kimi-k3",
    name: "Kimi K3",
    window: 512_000,
    reserve: 32_000,
    mark: KimiMark,
  },
  {
    id: "gpt-6-luna",
    name: "GPT-6 Luna",
    window: 400_000,
    reserve: 32_000,
    mark: OpenAIMark,
  },
];

export const sampleItems: ContextItem[] = [
  { id: "system", category: "system", label: "System prompt", tokens: 4_100 },
  { id: "github", category: "tools", label: "GitHub tools", tokens: 14_200 },
  { id: "linear", category: "tools", label: "Linear tools", tokens: 9_600 },
  { id: "sentry", category: "tools", label: "Sentry tools", tokens: 8_200 },
  { id: "claude-md", category: "files", label: "CLAUDE.md", tokens: 6_400 },
  { id: "invoice", category: "files", label: "src/billing/invoice.ts", tokens: 38_000 },
  { id: "schema", category: "files", label: "db/schema.sql", tokens: 55_600 },
  ...Array.from({ length: 24 }, (_, index) => ({
    id: `turn-${index + 1}`,
    category: "messages" as const,
    label: `Turn ${index + 1}`,
    tokens: [9_800, 14_200, 11_600, 12_900][index % 4],
  })),
];

export const sampleTurns: ContextTurn[] = [
  { label: "Retry failed invoices with backoff", tokens: 31_400 },
  { label: "Add tests for the retry schedule", tokens: 27_800 },
  { label: "Explain the failing Sentry event", tokens: 36_200 },
  { label: "Update the migration for retry_count", tokens: 24_600 },
  { label: "Summarize the changes for the PR", tokens: 19_300 },
];

export const sampleFiles: ContextTurn[] = [
  { label: "api/openapi.yaml", tokens: 64_000 },
  { label: "docs/billing-runbook.md", tokens: 22_000 },
  { label: "src/billing/retry.ts", tokens: 18_500 },
];

const { duration } = motionTokens;
const standardEase: [number, number, number, number] = [...motionTokens.ease.standard];

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${Number((tokens / 1_000_000).toFixed(tokens % 1_000_000 ? 2 : 0))}M`;
  if (tokens >= 10_000) return `${Math.round(tokens / 1_000)}K`;
  if (tokens >= 1_000) return `${Number((tokens / 1_000).toFixed(1))}K`;
  return `${Math.round(tokens)}`;
}

function formatPercent(ratio: number): string {
  return ratio > 0 && ratio < 0.095 ? `${(ratio * 100).toFixed(1)}%` : `${Math.round(ratio * 100)}%`;
}

function tokenSum(items: ContextItem[]): number {
  return items.reduce((total, item) => total + item.tokens, 0);
}

function defaultSummarize(folded: ContextItem[]): number {
  return Math.min(24_000, Math.max(4_000, 100 * Math.round((0.06 * tokenSum(folded)) / 100)));
}

function useAnimatedNumber(value: number, reduced: boolean): number {
  const [animated, setAnimated] = useState(value);
  const current = useRef(value);

  useEffect(() => {
    if (reduced) {
      current.current = value;
      return;
    }
    const from = current.current;
    if (from === value) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 420);
      const next = from + (value - from) * (1 - Math.pow(1 - progress, 3));
      current.current = next;
      setAnimated(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);

  return reduced ? value : animated;
}

function perCategory(items: ContextItem[]): Record<ContextCategory, number> {
  const totals: Record<ContextCategory, number> = {
    system: 0,
    tools: 0,
    files: 0,
    summary: 0,
    messages: 0,
  };
  for (const item of items) totals[item.category] += item.tokens;
  return totals;
}

function buildCells(totals: Record<ContextCategory, number>, model: ContextModel): ContextKind[] {
  const cellTokens = model.window / 200;
  const usable = 200 - Math.max(1, Math.round(model.reserve / cellTokens));
  const cells: ContextKind[] = [];
  let cumulative = 0;
  for (const category of CATEGORIES) {
    const tokens = totals[category];
    if (!tokens) continue;
    cumulative += tokens;
    const index = Math.min(usable, Math.max(cells.length + 1, Math.round(cumulative / cellTokens)));
    while (cells.length < index) cells.push(category);
  }
  while (cells.length < usable) cells.push("free");
  while (cells.length < 200) cells.push("reserve");
  return cells;
}

const STATUS_ICON = {
  info: Info,
  warning: TriangleAlert,
  success: CircleCheck,
  working: Shrink,
} as const;

interface LegendRowProps {
  kind: ContextKind;
  tokens: number;
  window: number;
  reduced: boolean;
  empty?: string;
  onHover: (kind: ContextKind | null) => void;
}

function LegendRow({ kind, tokens, window: totalWindow, reduced, empty, onHover }: LegendRowProps) {
  const animated = useAnimatedNumber(tokens, reduced);
  return (
    <li
      className={styles.legendRow}
      data-kind={kind}
      data-empty={!tokens || undefined}
      onPointerEnter={() => onHover(kind)}
      onPointerLeave={() => onHover(null)}
    >
      <span className={styles.swatch} data-kind={kind} aria-hidden="true" />
      <span className={styles.legendName}>{LABELS[kind]}</span>
      <span className={styles.legendTokens}>{tokens ? formatTokens(animated) : empty ?? "0"}</span>
      <span className={styles.legendPercent}>{tokens ? formatPercent(animated / totalWindow) : ""}</span>
    </li>
  );
}

interface ModelMenuProps {
  models: ContextModel[];
  model: ContextModel;
  onChange: (id: string) => void;
  disabled: boolean;
}

function ModelMenu({ models, model, onChange, disabled }: ModelMenuProps) {
  const Mark = model.mark;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={styles.modelTrigger}
        disabled={disabled}
        aria-label={`Model: ${model.name}, ${formatTokens(model.window)} context. Change model`}
      >
        <Mark
          className={styles.modelMark}
          style={model.color ? { color: model.color } : undefined}
          aria-hidden={true}
          focusable="false"
        />
        <span className={styles.modelName}>{model.name}</span>
        <span className={styles.modelWindow}>{formatTokens(model.window)}</span>
        <ChevronDown className={styles.modelChevron} aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.menu} align="end" sideOffset={6} collisionPadding={12} loop>
          <DropdownMenu.RadioGroup value={model.id} onValueChange={onChange}>
            {models.map((entry) => {
              const EntryMark = entry.mark;
              return (
                <DropdownMenu.RadioItem key={entry.id} value={entry.id} textValue={entry.name} className={styles.menuItem}>
                  <EntryMark
                    className={styles.modelMark}
                    style={entry.color ? { color: entry.color } : undefined}
                    aria-hidden={true}
                    focusable="false"
                  />
                  <span className={styles.menuName}>{entry.name}</span>
                  <span className={styles.menuWindow}>{formatTokens(entry.window)}</span>
                  <span className={styles.menuCheck}>
                    <DropdownMenu.ItemIndicator>
                      <Check aria-hidden="true" />
                    </DropdownMenu.ItemIndicator>
                  </span>
                </DropdownMenu.RadioItem>
              );
            })}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function ContextWindow({
  models = sampleModels,
  defaultModelId,
  onModelChange,
  items,
  threshold = 0.8,
  turns = sampleTurns,
  files = sampleFiles,
  summarize = defaultSummarize,
  onCompact,
  onItemsChange,
  className,
}: ContextWindowProps) {
  const reduced = !!useReducedMotion();
  const [modelId, setModelId] = useState(defaultModelId ?? models[0]?.id ?? "");
  const model = models.find((entry) => entry.id === modelId) ?? models[0];
  const [entries, setEntries] = useState<ContextItem[]>(() => items ?? sampleItems);
  const [phase, setPhase] = useState<"idle" | "summarizing">("idle");
  const [sweep, setSweep] = useState<Sweep>({ from: 0, step: 4 });
  const [hover, setHover] = useState<ContextKind | null>(null);
  const [status, setStatus] = useState<ContextStatus>({
    tone: "info",
    text: `Compacts on its own at ${Math.round(100 * threshold)}%`,
  });

  const turnCursor = useRef(0);
  const fileCursor = useRef(0);
  const idCounter = useRef(0);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const commit = useCallback(
    (next: ContextItem[]) => {
      setEntries(next);
      onItemsChange?.(next);
    },
    [onItemsChange],
  );

  const totals = useMemo(() => perCategory(entries), [entries]);
  const used = tokenSum(entries);
  const cells = useMemo(() => buildCells(totals, model), [totals, model]);

  const thresholdIndex = Math.round(200 * threshold);
  const free = Math.max(0, model.window - model.reserve - used);
  const animatedUsed = useAnimatedNumber(used, reduced);
  const cellTokens = model.window / 200;
  const cellIndexFor = (tokens: number) => Math.min(199, Math.floor(tokens / cellTokens));
  const compacting = phase === "summarizing";
  const messageCount = entries.filter((entry) => entry.category === "messages").length;

  const compact = useCallback(
    (current: ContextItem[], target: ContextModel, automatic: boolean, note?: string) => {
      const messages = current.filter((entry) => entry.category === "messages");
      const older = messages.slice(0, Math.max(0, messages.length - 2));
      if (!older.length) {
        setStatus({ tone: "info", text: "Nothing to compact yet" });
        return;
      }
      setPhase("summarizing");
      setStatus({
        tone: "working",
        text: `${note ? `${note}. ` : ""}Summarizing ${older.length} older messages`,
      });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const existing = current.find((entry) => entry.category === "summary");
        const summaryTokens = (existing?.tokens ?? 0) + summarize(older);
        const foldedIds = new Set(older.map((entry) => entry.id));
        const rest = current.filter((entry) => !foldedIds.has(entry.id) && entry.category !== "summary");
        const next: ContextItem[] = [
          ...rest.filter((entry) => entry.category !== "messages"),
          {
            id: "summary",
            category: "summary",
            label: "Summary of earlier turns",
            tokens: summaryTokens,
          },
          ...rest.filter((entry) => entry.category === "messages"),
        ];
        const before = tokenSum(current);
        const after = tokenSum(next);
        setSweep({
          from: Math.floor(
            tokenSum(next.filter((entry) => entry.category !== "summary" && entry.category !== "messages")) /
              (target.window / 200),
          ),
          step: 3,
        });
        commit(next);
        setPhase("idle");
        const folded = tokenSum(older);
        setStatus(
          after >= threshold * target.window
            ? {
                tone: "warning",
                text: `Compacted ${formatTokens(folded)}, still above ${Math.round(100 * threshold)}%. Remove files to make room`,
              }
            : {
                tone: "success",
                text: `Compacted ${formatTokens(folded)} of messages into a ${formatTokens(
                  summaryTokens - (existing?.tokens ?? 0),
                )} summary`,
              },
        );
        onCompact?.({ folded, summary: summaryTokens, before, after, automatic });
      }, 720 * Number(!reduced));
    },
    [commit, onCompact, reduced, summarize, threshold],
  );

  const report = (current: ContextItem[], target: ContextModel, message: string) => {
    const limit = threshold * target.window;
    const total = tokenSum(current);
    if (total < limit) {
      setStatus(
        total > 0.85 * limit
          ? { tone: "warning", text: `${message}. Compaction runs at ${Math.round(100 * threshold)}%` }
          : { tone: "info", text: message },
      );
      return;
    }
    setStatus({ tone: "warning", text: `${message}. Crossed ${Math.round(100 * threshold)}%` });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => compact(current, target, true, `Crossed ${Math.round(100 * threshold)}%`),
      520 * Number(!reduced),
    );
  };

  const messagesFirst = cells.indexOf("messages");
  const messagesLast = cells.lastIndexOf("messages");
  const StatusIcon = STATUS_ICON[status.tone];
  const tokensFor = (kind: ContextKind) => (kind === "free" ? free : kind === "reserve" ? model.reserve : totals[kind]);
  const gridLabel =
    `${model.name} context window, ${formatTokens(used)} of ${formatTokens(model.window)} tokens used. ` +
    LEGEND.map((kind) => `${LABELS[kind]} ${formatTokens(tokensFor(kind))}`).join(", ") +
    `. Compaction runs at ${Math.round(100 * threshold)}%.`;

  return (
    <section
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-phase={phase}
      data-hover={hover ?? undefined}
      aria-label="Context window"
    >
      <header className={styles.header}>
        <div className={styles.readout}>
          <p className={styles.used}>
            <span className={styles.usedValue}>{formatTokens(animatedUsed)}</span>
            <span className={styles.usedOf}>of {formatTokens(model.window)} tokens</span>
          </p>
          <p className={styles.usedMeta}>
            <span className={styles.tabular}>{formatPercent(animatedUsed / model.window)}</span> used
            <span className={styles.dot} aria-hidden="true" />
            {formatTokens(free)} free
          </p>
        </div>
        <ModelMenu
          models={models}
          model={model}
          disabled={compacting}
          onChange={(id) => {
            const next = models.find((entry) => entry.id === id);
            if (!next || next.id === model.id || compacting) return;
            setModelId(id);
            onModelChange?.(next);
            setSweep({ from: 0, step: 1.4 });
            if (used < threshold * next.window) {
              setStatus({ tone: "info", text: `Switched to ${next.name} · ${formatTokens(next.window)} window` });
            } else {
              setStatus({
                tone: "warning",
                text: `${formatTokens(used)} is over ${Math.round(100 * threshold)}% of ${next.name}'s window`,
              });
              window.clearTimeout(timer.current);
              timer.current = window.setTimeout(
                () => compact(entries, next, true, `Too full for ${next.name}`),
                640 * Number(!reduced),
              );
            }
          }}
        />
      </header>
      <div className={styles.body}>
        <div className={styles.gridWrap}>
          <div
            className={styles.grid}
            role="img"
            aria-label={gridLabel}
            style={{ "--columns": 20 } as CSSProperties}
          >
            {cells.map((kind, index) => {
              const delay = index >= sweep.from ? Math.min((index - sweep.from) * sweep.step, 360) : 0;
              const sweepDelay =
                compacting && kind === "messages"
                  ? (index - messagesFirst) * Math.min(6, 420 / Math.max(1, messagesLast - messagesFirst))
                  : undefined;
              return (
                <Fragment key={index}>
                  {index === thresholdIndex ? (
                    <div className={styles.threshold} aria-hidden="true" />
                  ) : null}
                  <span
                    className={styles.cell}
                    data-kind={kind}
                    data-after={index >= thresholdIndex && kind === "free" ? "" : undefined}
                    style={
                      {
                        "--delay": `${reduced ? 0 : delay}ms`,
                        "--sweep": sweepDelay === undefined ? undefined : `${sweepDelay}ms`,
                      } as CSSProperties
                    }
                  />
                </Fragment>
              );
            })}
          </div>
          <p className={styles.gridNote}>
            <span>Each cell is {formatTokens(model.window / 200)} tokens</span>
            <span className={styles.thresholdKey}>
              <span className={styles.thresholdSwatch} aria-hidden="true" />
              Compacts at {Math.round(100 * threshold)}%
            </span>
          </p>
        </div>
        <ul className={styles.legend} aria-label="What fills the window">
          {LEGEND.map((kind) => (
            <LegendRow
              key={kind}
              kind={kind}
              tokens={tokensFor(kind)}
              window={model.window}
              reduced={reduced}
              empty={kind === "summary" ? "None yet" : undefined}
              onHover={setHover}
            />
          ))}
        </ul>
      </div>
      <footer className={styles.footer}>
        <div className={styles.actions}>
          <Button
            variant="primary"
            size="sm"
            disabled={compacting}
            onClick={() => {
              if (compacting || !turns.length) return;
              const turn = turns[turnCursor.current++ % turns.length];
              const next = [
                ...entries,
                {
                  id: `sent-${++idCounter.current}`,
                  category: "messages" as const,
                  label: turn.label,
                  tokens: turn.tokens,
                },
              ];
              setSweep({ from: cellIndexFor(used), step: 9 });
              commit(next);
              report(next, model, `Sent "${turn.label}" · +${formatTokens(turn.tokens)}`);
            }}
          >
            <Send aria-hidden="true" />
            Send message
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={compacting}
            onClick={() => {
              if (compacting || !files.length) return;
              const file = files[fileCursor.current++ % files.length];
              const lastFile = entries.reduce(
                (found, entry, index) => (entry.category === "files" ? index : found),
                -1,
              );
              const prefix = totals.system + totals.tools + totals.files;
              const next = [
                ...entries.slice(0, lastFile + 1),
                {
                  id: `file-${fileCursor.current}-${file.label}`,
                  category: "files" as const,
                  label: file.label,
                  tokens: file.tokens,
                },
                ...entries.slice(lastFile + 1),
              ];
              setSweep({ from: cellIndexFor(prefix), step: 3 });
              commit(next);
              report(next, model, `Attached ${file.label} · +${formatTokens(file.tokens)}`);
            }}
          >
            <FilePlusCorner aria-hidden="true" />
            Attach file
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={styles.compact}
            onClick={() => compact(entries, model, false)}
            disabled={compacting || messageCount <= 2}
          >
            <Shrink aria-hidden="true" />
            Compact now
          </Button>
        </div>
        <div className={styles.statusSlot} role="status" aria-live="polite">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.p
              key={`${status.tone}-${status.text}`}
              className={styles.status}
              data-tone={status.tone}
              initial={!reduced && { opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 * Number(!reduced), ease: standardEase } }}
              transition={{ duration: reduced ? 0 : duration.fast, ease: standardEase }}
            >
              <StatusIcon className={styles.statusIcon} aria-hidden="true" />
              {status.tone === "working" ? <TextShimmer>{status.text}</TextShimmer> : <span>{status.text}</span>}
            </motion.p>
          </AnimatePresence>
        </div>
      </footer>
    </section>
  );
}

export default ContextWindow;
