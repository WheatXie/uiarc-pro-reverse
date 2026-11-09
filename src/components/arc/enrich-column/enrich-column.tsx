"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  CircleAlert,
  CircleDashed,
  Pencil,
  Play,
  RotateCcw,
  Sparkles,
  Square,
} from "lucide-react";
import { Button } from "../button/button";
import { Input } from "../input/input";
import { Textarea } from "../textarea/textarea";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { Tooltip } from "../tooltip/tooltip";
import styles from "./enrich-column.module.css";

/** The AI column's name and prompt. */
export interface EnrichColumnDefinition {
  /** Shown in the column header and in the run button's label. */
  name: string;
  /** Sent with every cell as `context.prompt`. */
  prompt: string;
}

/** Where a value came from, shown as a link beside the cell. */
export interface EnrichColumnSource {
  label: string;
  href: string;
}

export type EnrichColumnStatus = "idle" | "queued" | "running" | "done" | "failed";

/** One cell under the AI column. */
export interface EnrichColumnCell {
  status: EnrichColumnStatus;
  /** The enriched value, when the cell is done. */
  value?: string;
  source?: EnrichColumnSource;
  /** Shown under the fail label, when the cell is failed. */
  error?: string;
  /** The shimmering label while the cell runs, such as "Reading linear.app/now". */
  activity?: string;
}

/** One row of the table: a company and the cell under the AI column. */
export interface EnrichColumnRow {
  id: string;
  /** The company name in the row header. */
  name: string;
  /** Shown after the name and used as the sample value's source. */
  domain?: string;
  /** A 16px brand mark; a letter fallback is drawn without one. */
  logo?: ReactNode;
}

/** The model named in the footer. */
export interface EnrichColumnModel {
  name: string;
  /** A short qualifier after the name, such as "Web search". */
  detail?: string;
  /** A 14px brand mark before the name. Pass null to hide it. */
  mark?: ReactNode;
}

/** Everything one cell's fill receives besides the row. */
export interface EnrichColumnContext {
  prompt: string;
  column: EnrichColumnDefinition;
  signal: AbortSignal;
  /** 1 on the first try, 2 after one retry, and so on. */
  attempt: number;
  /** Update the shimmering label while the cell works. */
  setActivity: (activity: string) => void;
}

export type EnrichColumnEnrich = (
  row: EnrichColumnRow,
  context: EnrichColumnContext,
) => Promise<{ value: string; source?: EnrichColumnSource }>;

export interface EnrichColumnProps {
  /** The table's name in the top bar. */
  title?: string;
  /** The rows to enrich. Defaults to seven sample companies. */
  rows?: EnrichColumnRow[];
  /** The AI column's name and prompt on first render. */
  defaultColumn?: EnrichColumnDefinition;
  /** Called when the person saves an edited column. Saving re-runs every row. */
  onColumnChange?: (column: EnrichColumnDefinition) => void;
  /** Fills one cell. The context carries the prompt, an AbortSignal and setActivity. */
  enrich?: EnrichColumnEnrich;
  /** Values you already have, keyed by row id. */
  initialCells?: Record<string, EnrichColumnCell>;
  /** How many cells run at once. Defaults to 2. */
  concurrency?: number;
  /** Runs the column once when it first scrolls into view. Defaults to true with the simulation. */
  autoRun?: boolean;
  /** The model shown in the footer. Pass null to hide it. */
  model?: EnrichColumnModel | null;
  /** Shows the edit control on the AI column header. Defaults to true. */
  editable?: boolean;
  /** A short note after the row count. Defaults to "sample data" with the simulation. */
  note?: string;
  /** Called whenever a cell changes state. */
  onCellChange?: (row: EnrichColumnRow, cell: EnrichColumnCell) => void;
  /** Called when a run settles, with every cell. */
  onRunComplete?: (cells: Record<string, EnrichColumnCell>) => void;
  className?: string;
}

const decorative = { "aria-hidden": true, focusable: false } as const;

const claudeMark = (
  <svg viewBox="0 0 24 24" fill="#D97757" {...decorative}>
    <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
  </svg>
);

const defaultColumn: EnrichColumnDefinition = {
  name: "Headcount and funding",
  prompt: "Find the headcount and latest funding round",
};

const defaultModel: EnrichColumnModel = { name: "Claude Haiku 5.5", detail: "Web search", mark: claudeMark };

const sampleRows: EnrichColumnRow[] = [
  {
    id: "linear",
    name: "Linear",
    domain: "linear.app",
    logo: (
      <svg viewBox="0 0 24 24" fill="#5E6AD2" {...decorative}>
        <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
      </svg>
    ),
  },
  {
    id: "vercel",
    name: "Vercel",
    domain: "vercel.com",
    logo: (
      <svg viewBox="0 .6 24 24" fill="currentColor" {...decorative}>
        <path d="m12 1.608 12 20.784H0Z" />
      </svg>
    ),
  },
  {
    id: "notion",
    name: "Notion",
    domain: "notion.com",
    logo: (
      <svg viewBox="0 0 24 24" fill="currentColor" {...decorative}>
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
      </svg>
    ),
  },
  {
    id: "figma",
    name: "Figma",
    domain: "figma.com",
    logo: (
      <svg viewBox="-9.5 0 57 57" {...decorative}>
        <path fill="#1ABCFE" d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" />
        <path fill="#0ACF83" d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" />
        <path fill="#FF7262" d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" />
        <path fill="#F24E1E" d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" />
        <path fill="#A259FF" d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" />
      </svg>
    ),
  },
  {
    id: "stripe",
    name: "Stripe",
    domain: "stripe.com",
    logo: (
      <svg viewBox="0 0 24 24" fill="#635BFF" {...decorative}>
        <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
      </svg>
    ),
  },
  {
    id: "ramp",
    name: "Ramp",
    domain: "ramp.com",
    logo: (
      <svg viewBox="51.4 -1.6 19 19" fill="currentColor" {...decorative}>
        <path d="M70.028 15.612v.07h-9.983v-.07c1.439-.82 2.432-1.654 3.327-2.526h4.1zm-2.473-13.11L65.027 0h-.074s.042 4.664-4.205 8.906c-4.156 4.15-9.046 4.16-9.046 4.16v.074l2.578 2.546s4.819.05 9.074-4.16c4.24-4.195 4.205-9.022 4.205-9.022z" />
      </svg>
    ),
  },
  {
    id: "retool",
    name: "Retool",
    domain: "retool.com",
    logo: (
      <svg viewBox="0 0 24 24" fill="currentColor" {...decorative}>
        <path d="M0 2.2A2.2 2.2 0 0 1 2.2 0h8.6A2.2 2.2 0 0 1 13 2.2v1.7A1.1 1.1 0 0 1 11.9 5H1.1A1.1 1.1 0 0 1 0 3.9V2.2zm0 6.9A1.1 1.1 0 0 1 1.1 8h20.7a2.2 2.2 0 0 1 2.2 2.2v5.7a1.1 1.1 0 0 1-1.1 1.1H2.2A2.2 2.2 0 0 1 0 14.8V9.1zm11 12a1.1 1.1 0 0 1 1.1-1.1h10.8a1.1 1.1 0 0 1 1.1 1.1v.7a2.2 2.2 0 0 1-2.2 2.2h-8.6a2.2 2.2 0 0 1-2.2-2.2v-.7z" />
      </svg>
    ),
  },
];

interface SampleAnswer {
  value: string;
  source?: EnrichColumnSource;
  search: number;
  read: number;
  failFirst?: string;
}

const sampleAnswers: Record<string, SampleAnswer> = {
  linear: {
    value: "180 people · Series C, $82M (Jun 2025)",
    source: { label: "linear.app/now", href: "https://linear.app/now" },
    search: 300,
    read: 420,
  },
  vercel: {
    value: "820 people · Series F, $300M (Sep 2025)",
    source: { label: "vercel.com/blog", href: "https://vercel.com/blog" },
    search: 340,
    read: 380,
  },
  notion: {
    value: "1,100 people · Series C, $275M (Oct 2021)",
    source: { label: "crunchbase.com", href: "https://www.crunchbase.com" },
    search: 280,
    read: 460,
  },
  figma: {
    value: "1,700 people · IPO on the NYSE (Jul 2025)",
    source: { label: "sec.gov", href: "https://www.sec.gov" },
    search: 360,
    read: 400,
  },
  stripe: {
    value: "8,500 people · Series I, $6.5B (Mar 2023)",
    source: { label: "stripe.com/newsroom", href: "https://stripe.com/newsroom" },
    search: 320,
    read: 440,
  },
  ramp: {
    value: "1,200 people · Series E, $500M (Jul 2025)",
    source: { label: "ramp.com/blog", href: "https://ramp.com/blog" },
    search: 300,
    read: 400,
  },
  retool: {
    value: "460 people · Series C, $45M (Jul 2022)",
    source: { label: "techcrunch.com", href: "https://techcrunch.com" },
    search: 340,
    read: 480,
    failFirst: "No dated source found",
  },
};

/** A timer that rejects with an AbortError as soon as the signal aborts. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** The local simulation: it waits like a search would, names the source it reads, then answers. */
const simulateEnrich: EnrichColumnEnrich = async (row, { signal, attempt, setActivity }) => {
  const answer =
    sampleAnswers[row.id] ??
    ({
      value: `Sample value for ${row.name}`,
      source: row.domain ? { label: row.domain, href: `https://${row.domain}` } : undefined,
      search: 320,
      read: 420,
    } satisfies SampleAnswer);
  await wait(answer.search, signal);
  if (answer.source) setActivity(`Reading ${answer.source.label}`);
  await wait(answer.read, signal);
  if (answer.failFirst && attempt === 1) throw new Error(answer.failFirst);
  return { value: answer.value, source: answer.source };
};

const merge = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(" ");

const IDLE_CELL: EnrichColumnCell = { status: "idle" };

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const isLive = (status: EnrichColumnStatus) => status === "queued" || status === "running";

const copyVariants = (reduced: boolean) => ({
  initial: reduced ? { opacity: 0 } : { opacity: 0, y: 2 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.16 * (reduced ? 0 : 1), ease: EASE } },
  exit: { opacity: 0, transition: { duration: 0.1 * (reduced ? 0 : 1), ease: EASE } },
});

/** Fires once the element has been at least `amount` visible. */
function useInView<T extends HTMLElement>(ref: RefObject<T | null>, { once = false, amount = 0 }: { once?: boolean; amount?: number } = {}) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold: amount },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, once, amount]);
  return inView;
}

function Spinner() {
  return (
    <svg className={styles.spinner} width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx={8} cy={8} r={6} stroke="currentColor" strokeOpacity=".22" strokeWidth="1.75" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function CheckMark({ reduced }: { reduced: boolean }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <motion.path
        d="M3.25 8.5 6.5 11.75 12.75 4.75"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.24, ease: EASE, delay: 0.04 }}
      />
    </svg>
  );
}

function StatusIcon({ status, reduced }: { status: EnrichColumnStatus; reduced: boolean }) {
  const glyph =
    status === "queued" ? (
      <CircleDashed size={16} strokeWidth={1.75} aria-hidden="true" />
    ) : status === "running" ? (
      <Spinner />
    ) : status === "done" ? (
      <CheckMark reduced={reduced} />
    ) : status === "failed" ? (
      <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
    ) : null;
  return (
    <span className={styles.statusIcon} aria-hidden="true">
      <AnimatePresence initial={false}>
        {glyph ? (
          <motion.span
            key={status}
            className={styles.stack}
            data-status={status}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
            animate={{
              opacity: 1,
              scale: 1,
              transition: reduced
                ? { duration: 0 }
                : { scale: { type: "spring", visualDuration: 0.24, bounce: 0 }, opacity: { duration: 0.12 } },
            }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0.7, transition: { duration: 0.1 * (reduced ? 0 : 1) } }}
          >
            {glyph}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

interface CellProps {
  row: EnrichColumnRow;
  cell: EnrichColumnCell;
  reduced: boolean;
  onRun: () => void;
  onRetry: () => void;
}

function Cell({ row, cell, reduced, onRun, onRetry }: CellProps) {
  const { status } = cell;
  const variants = copyVariants(reduced);
  const key = status === "running" ? `running:${cell.activity ?? ""}` : `${status}:${cell.value ?? cell.error ?? ""}`;
  const copy =
    status === "idle" ? (
      <span className={styles.muted}>Not run</span>
    ) : status === "queued" ? (
      <span className={styles.muted}>Queued</span>
    ) : status === "running" ? (
      <TextShimmer className={styles.shimmer}>{cell.activity ?? "Working"}</TextShimmer>
    ) : status === "done" ? (
      <span title={cell.value}>{cell.value}</span>
    ) : (
      <span className={styles.failText}>
        <span className={styles.failLabel}>Failed</span>
        <span className={styles.failReason}>{cell.error ?? "No result"}</span>
      </span>
    );
  const asideKey = status === "done" && cell.source ? `source:${cell.source.href}` : status === "failed" ? "retry" : "none";
  const aside =
    asideKey === "retry" ? (
      <Button variant="ghost" size="sm" className={styles.retry} onClick={onRetry} aria-label={`Retry ${row.name}`}>
        <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
        <span className={styles.retryLabel}>Retry</span>
      </Button>
    ) : status === "done" && cell.source ? (
      <a
        className={styles.source}
        href={cell.source.href}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={`Source for ${row.name}: ${cell.source.label} (opens in a new tab)`}
      >
        <span className={styles.sourceLabel}>{cell.source.label}</span>
        <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" className={styles.sourceIcon} />
      </a>
    ) : null;
  const canRun = status === "idle" || status === "done";
  const rerun = status === "done";
  return (
    <div className={styles.cell}>
      <StatusIcon status={status} reduced={reduced} />
      <span className={styles.content}>
        <AnimatePresence initial={false}>
          <motion.span key={key} className={styles.stack} {...variants}>
            {copy}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className={styles.aside}>
        <AnimatePresence initial={false}>
          {aside ? (
            <motion.span key={asideKey} className={styles.stack} {...variants}>
              {aside}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </span>
      <span className={styles.actionSlot}>
        {canRun ? (
          <Tooltip content={rerun ? "Re-run row" : "Run row"}>
            <button
              type="button"
              className={merge(styles.iconButton, styles.rowAction)}
              onClick={onRun}
              aria-label={`${rerun ? "Re-run" : "Run"} ${row.name}`}
            >
              {rerun ? <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" /> : <Play size={14} strokeWidth={1.75} aria-hidden="true" />}
            </button>
          </Tooltip>
        ) : null}
      </span>
    </div>
  );
}

/**
 * An AI enrichment column for a data table: one prompt runs down every row, each cell shimmers while
 * it works, then settles into a value with its source or a failure you can retry.
 */
export function EnrichColumn({
  title = "Target accounts",
  rows = sampleRows,
  defaultColumn: initialColumn = defaultColumn,
  onColumnChange,
  enrich,
  initialCells,
  concurrency = 2,
  autoRun,
  model = defaultModel,
  editable = true,
  note,
  onCellChange,
  onRunComplete,
  className,
}: EnrichColumnProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const simulated = !enrich;
  const [column, setColumn] = useState(initialColumn);
  const [cells, setCells] = useState<Record<string, EnrichColumnCell>>(() => ({ ...initialCells }));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialColumn);
  const [status, setStatus] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const inView = useInView(rootRef, { once: true, amount: 0.35 });
  const cellsRef = useRef(cells);
  const latest = useRef({
    rows,
    column,
    enrich: enrich ?? simulateEnrich,
    concurrency,
    onCellChange,
    onRunComplete,
    simulated,
  });

  useEffect(() => {
    latest.current = { rows, column, enrich: enrich ?? simulateEnrich, concurrency, onCellChange, onRunComplete, simulated };
  });

  const queue = useRef<string[]>([]);
  const running = useRef(0);
  const controllers = useRef(new Map<string, AbortController>());
  const attempts = useRef(new Map<string, number>());
  const settled = useRef(new Map<string, EnrichColumnCell>());
  const pending = useRef(false);
  const autoRan = useRef(false);

  const commit = (next: Record<string, EnrichColumnCell>, touched: string[]) => {
    cellsRef.current = next;
    setCells(next);
    const { rows: list, onCellChange: notify } = latest.current;
    if (!notify) return;
    for (const id of touched) {
      const row = list.find((candidate) => candidate.id === id);
      if (row) notify(row, next[id]);
    }
  };

  const patch = (id: string, cell: EnrichColumnCell) => commit({ ...cellsRef.current, [id]: cell }, [id]);

  const summarize = (map: Record<string, EnrichColumnCell>) => {
    const all = latest.current.rows.map((row) => map[row.id] ?? IDLE_CELL);
    const done = all.filter((cell) => cell.status === "done").length;
    const failed = all.filter((cell) => cell.status === "failed").length;
    return `${done} of ${all.length} rows enriched${failed ? `, ${failed} failed` : ""}.`;
  };

  const fill = async (id: string) => {
    const row = latest.current.rows.find((candidate) => candidate.id === id);
    if (!row) return;
    const controller = new AbortController();
    const { signal } = controller;
    controllers.current.set(id, controller);
    const attempt = (attempts.current.get(id) ?? 0) + 1;
    attempts.current.set(id, attempt);
    const { column: currentColumn, enrich: fillCell } = latest.current;
    patch(id, { status: "running", activity: "Searching the web" });
    try {
      const answer = await Promise.race([
        fillCell(row, {
          prompt: currentColumn.prompt,
          column: currentColumn,
          signal,
          attempt,
          setActivity: (activity) => {
            if (signal.aborted || cellsRef.current[id]?.status !== "running") return;
            patch(id, { status: "running", activity });
          },
        }),
        new Promise<never>((_, reject) => {
          if (signal.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
          }
          const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
          signal.addEventListener("abort", onAbort, { once: true });
        }),
      ]);
      if (signal.aborted) return;
      const cell: EnrichColumnCell = { status: "done", value: answer.value, source: answer.source };
      settled.current.set(id, cell);
      patch(id, cell);
    } catch (error) {
      if (signal.aborted) return;
      const cell: EnrichColumnCell = {
        status: "failed",
        error: error instanceof Error && error.message ? error.message : "No result",
      };
      settled.current.set(id, cell);
      patch(id, cell);
    } finally {
      if (controllers.current.get(id) === controller) controllers.current.delete(id);
    }
  };

  const drain = async (delay?: number) => {
    if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
    while (queue.current.length) {
      const id = queue.current.shift();
      if (id) await fill(id);
    }
    running.current -= 1;
    if (running.current === 0 && pending.current) {
      pending.current = false;
      setStatus(summarize(cellsRef.current));
      latest.current.onRunComplete?.(cellsRef.current);
    }
  };

  const enqueue = (ids: string[], clearAttempts: boolean) => {
    if (!ids.length) return;
    const next = { ...cellsRef.current };
    for (const id of ids) {
      controllers.current.get(id)?.abort();
      if (clearAttempts) attempts.current.delete(id);
      const current = next[id] ?? IDLE_CELL;
      if (isLive(current.status)) settled.current.set(id, current);
      next[id] = { status: "queued" };
    }
    queue.current = [...queue.current.filter((id) => !ids.includes(id)), ...ids];
    commit(next, ids);
    pending.current = true;
    const { column: currentColumn, simulated: isSimulated, rows: list } = latest.current;
    const target =
      ids.length === list.length
        ? `all ${list.length} rows`
        : ids.length === 1
          ? (list.find((row) => row.id === ids[0])?.name ?? "1 row")
          : `${ids.length} rows`;
    setStatus(`Running ${currentColumn.name} on ${target}.${isSimulated ? " Simulated with sample values, nothing was sent." : ""}`);
    const start = Math.min(Math.max(1, latest.current.concurrency) - running.current, queue.current.length);
    for (let index = 0; index < start; index += 1) {
      running.current += 1;
      void drain(140 * index);
    }
  };

  const runAll = () => enqueue(latest.current.rows.map((row) => row.id), true);

  const stop = (announce = true) => {
    queue.current = [];
    const next = { ...cellsRef.current };
    const touched: string[] = [];
    for (const row of latest.current.rows) {
      const current = next[row.id];
      if (!current || !isLive(current.status)) continue;
      controllers.current.get(row.id)?.abort();
      next[row.id] = settled.current.get(row.id) ?? IDLE_CELL;
      touched.push(row.id);
    }
    pending.current = false;
    if (touched.length) commit(next, touched);
    if (announce) setStatus(`Stopped. ${summarize(next)}`);
  };

  useEffect(() => {
    const live = controllers.current;
    return () => {
      queue.current = [];
      live.forEach((controller) => controller.abort());
    };
  }, []);

  const shouldAutoRun = autoRun ?? simulated;

  useEffect(() => {
    if (!shouldAutoRun || !inView || autoRan.current) return;
    const timer = window.setTimeout(() => {
      if (autoRan.current) return;
      autoRan.current = true;
      if (latest.current.rows.every((row) => (cellsRef.current[row.id] ?? IDLE_CELL).status === "idle")) runAll();
    }, 450);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoRun, inView]);

  useEffect(() => {
    if (!editing) return;
    const node = promptRef.current;
    if (node) {
      node.focus();
      node.setSelectionRange(node.value.length, node.value.length);
    }
  }, [editing]);

  const closeEditor = () => {
    setEditing(false);
    window.requestAnimationFrame(() => editRef.current?.focus());
  };

  const valid = draft.name.trim().length > 0 && draft.prompt.trim().length > 0;

  const save = (event?: { preventDefault: () => void }) => {
    event?.preventDefault();
    if (!valid) return;
    const nextColumn = { name: draft.name.trim(), prompt: draft.prompt.trim() };
    autoRan.current = true;
    stop(false);
    setColumn(nextColumn);
    latest.current.column = nextColumn;
    onColumnChange?.(nextColumn);
    closeEditor();
    runAll();
  };

  const cellList = rows.map((row) => cells[row.id] ?? IDLE_CELL);
  const active = cellList.some((cell) => isLive(cell.status));
  const done = cellList.filter((cell) => cell.status === "done").length;
  const failed = cellList.filter((cell) => cell.status === "failed").length;
  const hasResults = done + failed > 0;
  const noteText = note ?? (simulated ? "sample data" : undefined);
  const progress =
    active || hasResults ? (
      <>
        <span className={styles.num}>
          <span className={styles.numGhost} aria-hidden="true">
            {rows.length}
          </span>
          <span>{done}</span>
        </span>
        {" of "}
        {rows.length} done
      </>
    ) : (
      "Not run yet"
    );
  const editorId = `${uid}-editor`;

  return (
    <div ref={rootRef} className={merge(styles.root, className)}>
      <div className={styles.card}>
        <div className={styles.top}>
          <div className={styles.heading}>
            <span className={styles.title}>{title}</span>
            <span className={styles.count}>
              {rows.length} {rows.length === 1 ? "row" : "rows"}
              {noteText ? ` · ${noteText}` : ""}
            </span>
          </div>
          <Button
            variant={active ? "secondary" : "primary"}
            size="sm"
            className={styles.run}
            disabled={!rows.length}
            onClick={() => (active ? stop() : runAll())}
            aria-label={active ? "Stop the run" : `${hasResults ? "Re-run" : "Run"} ${column.name} on every row`}
          >
            {active ? (
              <Square size={14} strokeWidth={1.75} fill="currentColor" aria-hidden="true" />
            ) : hasResults ? (
              <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Play size={14} strokeWidth={1.75} fill="currentColor" aria-hidden="true" />
            )}
            {active ? "Stop" : hasResults ? "Re-run column" : "Run column"}
          </Button>
        </div>
        <AnimatePresence initial={false}>
          {editing ? (
            <motion.div
              key="editor"
              id={editorId}
              className={styles.editorClip}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { height: { type: "spring", visualDuration: 0.24, bounce: 0 }, opacity: { duration: 0.16, ease: EASE } }
              }
            >
              <form
                className={styles.editor}
                onSubmit={save}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    closeEditor();
                  }
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) save(event);
                }}
                aria-label="Edit AI column"
              >
                <Input
                  label="Column name"
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  maxLength={48}
                  autoComplete="off"
                />
                <Textarea
                  ref={promptRef}
                  label="Prompt"
                  value={draft.prompt}
                  rows={2}
                  onChange={(event) => setDraft((current) => ({ ...current, prompt: event.target.value }))}
                  maxLength={280}
                />
                <div className={styles.editorActions}>
                  <span className={styles.hint}>Saving re-runs every row</span>
                  <Button type="button" variant="secondary" size="sm" onClick={closeEditor}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" disabled={!valid}>
                    Save and run
                  </Button>
                </div>
              </form>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <colgroup>
              <col className={styles.colCompany} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className={styles.headCompany}>
                  Company
                </th>
                <th scope="col" className={styles.headAi}>
                  <div className={styles.aiHead}>
                    <Sparkles size={16} strokeWidth={1.75} className={styles.aiIcon} aria-hidden="true" />
                    <span className={styles.aiText}>
                      <AnimatePresence initial={false}>
                        <motion.span
                          key={`${column.name}\n${column.prompt}`}
                          className={merge(styles.stack, styles.aiTextInner)}
                          {...copyVariants(reduced)}
                        >
                          <span className={styles.aiName}>{column.name}</span>
                          <span className={styles.aiPrompt} title={column.prompt}>
                            {column.prompt}
                          </span>
                        </motion.span>
                      </AnimatePresence>
                    </span>
                    {editable ? (
                      <Tooltip content="Edit column">
                        <button
                          ref={editRef}
                          type="button"
                          className={styles.iconButton}
                          onClick={() => {
                            if (editing) {
                              closeEditor();
                              return;
                            }
                            setDraft(column);
                            setEditing(true);
                          }}
                          aria-label={`Edit column: ${column.name}`}
                          aria-expanded={editing}
                          aria-controls={editing ? editorId : undefined}
                          data-active={editing || undefined}
                        >
                          <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      </Tooltip>
                    ) : null}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row) => {
                  const cell = cells[row.id] ?? IDLE_CELL;
                  return (
                    <tr key={row.id}>
                      <th scope="row" className={styles.companyCell}>
                        <span className={styles.company}>
                          {row.logo ? (
                            <span className={styles.logo} aria-hidden="true">
                              {row.logo}
                            </span>
                          ) : (
                            <span className={styles.logoFallback} aria-hidden="true">
                              {row.name.slice(0, 1)}
                            </span>
                          )}
                          <span className={styles.companyText}>
                            <span className={styles.name}>{row.name}</span>
                            {row.domain ? <span className={styles.domain}>{row.domain}</span> : null}
                          </span>
                        </span>
                      </th>
                      <td className={styles.aiCell} data-status={cell.status}>
                        <Cell row={row} cell={cell} reduced={reduced} onRun={() => enqueue([row.id], true)} onRetry={() => enqueue([row.id], false)} />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={2} className={styles.empty}>
                    No rows yet. Add rows to run this column.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className={styles.foot}>
          {model ? (
            <span className={styles.model}>
              {model.mark ? (
                <span className={styles.modelMark} aria-hidden="true">
                  {model.mark}
                </span>
              ) : null}
              <span className={styles.modelName}>
                {model.name}
                {model.detail ? <span className={styles.modelDetail}> · {model.detail}</span> : null}
              </span>
            </span>
          ) : (
            <span />
          )}
          <span className={styles.progress}>
            <span>{progress}</span>
            {failed ? (
              <span className={styles.progressFailed}>
                <CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
                {failed} failed
              </span>
            ) : null}
          </span>
        </div>
      </div>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {status}
      </span>
    </div>
  );
}

export default EnrichColumn;
