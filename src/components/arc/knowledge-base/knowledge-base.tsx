"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  CircleAlert,
  Clock,
  FileText,
  Globe,
  Plus,
  Search,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import Button from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import DropdownMenu from "../dropdown-menu/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../popover/popover";
import SegmentedControl from "../segmented-control/segmented-control";
import { Select } from "../select/select";
import Slider from "../slider/slider";
import Switch from "../switch/switch";
import TextShimmer from "../text-shimmer/text-shimmer";
import {
  addedSources,
  defaultSettings,
  embeddingModels as defaultEmbeddingModels,
  sampleChunks,
  sampleSources,
  sampleSuggestions,
  scoreTable,
  type AddedKind,
} from "./knowledge-base-data";
import styles from "./knowledge-base.module.css";

/** Where a source came from. `file` is anything uploaded that is not a PDF. */
export type SourceKind = "pdf" | "notion" | "drive" | "web" | "file";
/** Ingest phases in order, plus the two terminal states. */
export type IngestStatus = "queued" | "parse" | "chunk" | "embed" | "index" | "indexed" | "failed";
export type IngestStep = "parse" | "chunk" | "embed" | "index";

export interface KnowledgeSource {
  id: string;
  name: string;
  kind: SourceKind;
  pages: number;
  chunks: number;
  tokens: number;
  status: IngestStatus;
  /** 0–1 within the current step. */
  progress?: number;
  failedStep?: IngestStep;
  error?: string;
  /** When the source was added, such as "Uploaded Oct 14". */
  note?: string;
  /** Failed sources offer Retry unless this is false, which offers Remove instead. */
  retryable?: boolean;
  /** Simulated failure point, used by uploaded files that the demo cannot parse. */
  failAt?: { step: IngestStep; at: number; error: string };
}

export interface KnowledgeChunk {
  id: string;
  sourceId: string;
  index: number;
  location?: string;
  /** Marks the opening chunk of a source, which the demo retriever favours. */
  overview?: boolean;
  text: string;
}

export interface RetrievalSettings {
  chunkSize: number;
  overlap: number;
  topK: number;
  hybrid: boolean;
  rerank: boolean;
  embeddingModel: string;
}

export interface ChunkNeighbour {
  text: string;
  location?: string;
  index: number;
}

export interface RetrievedChunk {
  id: string;
  sourceId: string;
  text: string;
  location?: string;
  index: number;
  similarity: number;
  relevance?: number;
  before?: ChunkNeighbour;
  after?: ChunkNeighbour;
}

export interface KnowledgeBaseProps {
  /** Card title, also the section's accessible name. */
  title?: string;
  /** Controlled sources. Omit to run the demo's own ingest simulation. */
  sources?: KnowledgeSource[];
  /** Controlled chunks. Defaults to the demo corpus while `sources` is omitted. */
  chunks?: KnowledgeChunk[];
  settings?: RetrievalSettings;
  defaultSettings?: Partial<RetrievalSettings>;
  onSettingsChange?: (settings: RetrievalSettings) => void;
  /** Options for the embedding model select. */
  embeddingModels?: { value: string; label: string }[];
  /** Questions offered before the first search. */
  suggestions?: string[];
  onQuery?: (query: string, settings: RetrievalSettings) => Promise<RetrievedChunk[]>;
  onAddSource?: (input: { kind: "pdf" | "notion" | "drive" | "web" } | { kind: "file"; file: File }) => void;
  onRetrySource?: (id: string) => void;
  onRemoveSource?: (id: string) => void;
  onReindex?: (settings: RetrievalSettings) => void;
  defaultView?: "sources" | "retrieval";
  className?: string;
}

const INGEST_STEPS = ["parse", "chunk", "embed", "index"] as const;
const STEP_LABELS: Record<IngestStep, string> = { parse: "Parse", chunk: "Chunk", embed: "Embed", index: "Index" };
const KIND_LABELS: Record<SourceKind, string> = {
  pdf: "PDF",
  notion: "Notion page",
  drive: "Google Drive doc",
  web: "Website crawl",
  file: "File",
};
const UPLOADABLE = /\.(pdf|docx?|md|markdown|txt|html?)$/i;

const { spring, duration, ease } = motionTokens;
const standardEase = [...ease.standard] as [number, number, number, number];
const layoutSpring = { type: "spring", visualDuration: 0.32, bounce: 0 } as const;
const enterFast = { duration: duration.fast, ease: standardEase };
const exitFast = { duration: 0.1, ease: standardEase };

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");
const stepOf = (status: IngestStatus): status is IngestStep => (INGEST_STEPS as readonly string[]).includes(status);
const round2 = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const plural = (count: number, noun: string) => `${count.toLocaleString("en-US")} ${noun}${count === 1 ? "" : "s"}`;

/** How long one ingest step takes, in milliseconds: later steps grow with the amount of text they touch. */
function stepDuration(source: KnowledgeSource, step: IngestStep) {
  switch (step) {
    case "parse":
      return 520 + 18 * source.pages;
    case "chunk":
      return 420 + 2.5 * source.chunks;
    case "embed":
      return 900 + 12 * source.chunks;
    case "index":
      return 420;
  }
}

/** Chunks a source produces at the current chunk size, which is what re-indexing changes. */
export function chunksFor(tokens: number, settings: RetrievalSettings) {
  return Math.max(1, Math.ceil(tokens / Math.max(32, settings.chunkSize - settings.overlap)));
}

const STOPWORDS = new Set(
  "a an the is are was were be been am i me my we our you your it its of to in on at by for from with and or but if then so do does did can could would should will shall may might must what which who whom whose when where why how this that these those there here any some all about into over under after before than too very just not no yes get got has have had".split(
    " ",
  ),
);

/** Crude suffix stripping, so "refunds" and "refund" meet on the same term. */
function stem(word: string) {
  let value = word.toLowerCase();
  for (const suffix of ["ations", "ation", "ions", "ion", "ings", "ing", "able", "edly", "ed", "ies", "es", "s", "e", "y"]) {
    if (value.length - suffix.length >= 3 && value.endsWith(suffix)) {
      value = value.slice(0, -suffix.length);
      break;
    }
  }
  return value;
}

/** Content words of a query, stemmed and de-duplicated. */
function queryTerms(text: string) {
  return [
    ...new Set(
      (text.toLowerCase().match(/[a-z0-9$]+/g) ?? [])
        .filter(term => !STOPWORDS.has(term) && (term.length > 1 || /\d/.test(term)))
        .map(stem),
    ),
  ];
}

/** Stable per-string jitter in 0–1, so a query scores the same on every run without a table entry. */
function hashUnit(text: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x1000193);
  return ((hash >>> 0) % 1000) / 1000;
}

const normalizeQuery = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^what s /, "what is ");

type Scored = { text: string; hit: boolean };

/** Splits the excerpt into plain runs and matched words, merging a hit back into its run when only spaces separate them. */
function highlight(text: string, terms: string[]): Scored[] {
  if (!terms.length) return [{ text, hit: false }];
  const wanted = new Set(terms);
  const parts: Scored[] = [];
  let cursor = 0;
  for (const match of text.matchAll(/[A-Za-z0-9$]+/g)) {
    const word = match[0];
    if (STOPWORDS.has(word.toLowerCase()) || !wanted.has(stem(word))) continue;
    const start = match.index ?? 0;
    const tail = parts[parts.length - 1];
    const between = text.slice(cursor, start);
    if (tail?.hit && /^\s+$/.test(between)) {
      tail.text += between + word;
    } else {
      if (between) parts.push({ text: between, hit: false });
      parts.push({ text: word, hit: true });
    }
    cursor = start + word.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });
  return parts;
}

/** The demo retriever: a score table for the sample questions, a keyword-and-jitter score for anything else. */
function retrieve(query: string, chunks: KnowledgeChunk[], settings: RetrievalSettings, table: typeof scoreTable): RetrievedChunk[] {
  const terms = queryTerms(query);
  const known = table[normalizeQuery(query)];
  const scored: RetrievedChunk[] = [];
  for (const chunk of chunks) {
    const words = new Set((chunk.text.toLowerCase().match(/[a-z0-9$]+/g) ?? []).map(stem));
    const matched = terms.filter(term => words.has(term)).length;
    const coverage = terms.length ? matched / terms.length : 0;
    let similarity: number;
    let relevance: number;
    if (known) {
      const entry = known[chunk.id];
      if (!entry) continue;
      [similarity, relevance] = entry;
    } else {
      if (!matched) continue;
      const jitter = 0.05 * hashUnit(chunk.id + query);
      similarity = clamp(0.46 + 0.34 * coverage + 0.07 * Number(Boolean(chunk.overview)) + jitter, 0, 0.93);
      relevance = 1 / (1 + Math.exp(-((coverage - 0.5) * 7 + (chunk.overview ? -2.2 : 0.6) + (hashUnit(query + chunk.id) - 0.5))));
    }
    if (settings.hybrid) similarity = clamp(0.85 * similarity + 0.15 * coverage + 0.02, 0, 0.99);
    const siblings = chunks.filter(other => other.sourceId === chunk.sourceId);
    const before = siblings.find(other => other.index === chunk.index - 1);
    const after = siblings.find(other => other.index === chunk.index + 1);
    const neighbour = (item?: KnowledgeChunk): ChunkNeighbour | undefined =>
      item ? { text: item.text, location: item.location, index: item.index } : undefined;
    scored.push({
      id: chunk.id,
      sourceId: chunk.sourceId,
      text: chunk.text,
      location: chunk.location,
      index: chunk.index,
      similarity: round2(similarity),
      relevance: round2(clamp(relevance, 0.01, 0.99)),
      before: neighbour(before),
      after: neighbour(after),
    });
  }
  return scored.sort((a, b) => b.similarity - a.similarity);
}

/** Counts between values instead of snapping, so a change reads as movement. */
function AnimatedNumber({ value, format = String, reduced }: { value: number; format?: (value: number) => string; reduced: boolean }) {
  const count = useMotionValue(value);
  const text = useTransform(count, current => format(current));
  useEffect(() => {
    if (reduced) {
      count.jump(value);
      return;
    }
    const controls = animate(count, value, { duration: 0.5, ease: standardEase });
    return () => controls.stop();
  }, [value, reduced, count]);
  return <motion.span className={styles.tabular}>{text}</motion.span>;
}

function Dot() {
  return <span className={styles.dot} aria-hidden="true"/>;
}

function NotionMark({ className, width, height }: { className?: string; width?: number; height?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} width={width} height={height}>
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
    </svg>
  );
}

function DriveMark({ className, width, height }: { className?: string; width?: number; height?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} width={width} height={height}>
      <path d="M12.01 1.485c-2.082 0-3.754.02-3.743.047.01.02 1.708 3.001 3.774 6.62l3.76 6.574h3.76c2.081 0 3.753-.02 3.742-.047-.005-.02-1.708-3.001-3.775-6.62l-3.76-6.574zm-4.76 1.73a789.828 789.861 0 0 0-3.63 6.319L0 15.868l1.89 3.298 1.885 3.297 3.62-6.335 3.618-6.33-1.88-3.287C8.1 4.704 7.255 3.22 7.25 3.214zm2.259 12.653-.203.348c-.114.198-.96 1.672-1.88 3.287a423.93 423.948 0 0 1-1.698 2.97c-.01.026 3.24.042 7.222.042h7.244l1.796-3.157c.992-1.734 1.85-3.23 1.906-3.323l.104-.167h-7.249z"/>
    </svg>
  );
}

/** One glyph per source kind; the two brand marks carry their own paths. */
function KindMark({ kind, className, size }: { kind: SourceKind; className?: string; size?: number }) {
  if (kind === "notion") return <NotionMark className={className} width={size} height={size}/>;
  if (kind === "drive") return <DriveMark className={className} width={size} height={size}/>;
  if (kind === "web") return <Globe className={className} size={size} strokeWidth={1.75} aria-hidden="true"/>;
  return <FileText className={className} size={size} strokeWidth={1.75} aria-hidden="true"/>;
}

/** A line that is replaced rather than mutated: the new value rises a couple of pixels in as the old one fades out. */
function Swap({ id, children, className, reduced }: { id: string; children: ReactNode; className?: string; reduced: boolean }) {
  return <span className={cx(styles.swap, className)}>
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span key={id} className={styles.swapItem} initial={{ opacity: 0, y: reduced ? 0 : 2 }} animate={{ opacity: 1, y: 0, transition: reduced ? { duration: 0 } : enterFast }} exit={{ opacity: 0, transition: reduced ? { duration: 0 } : exitFast }}>{children}</motion.span>
    </AnimatePresence>
  </span>;
}

/** Height and opacity reveal for a region that is added and removed, such as the re-index notice. */
function Collapse({ open, reduced, children, className }: { open: boolean; reduced: boolean; children: ReactNode; className?: string }) {
  return <AnimatePresence initial={false}>
    {open && <motion.div className={cx(styles.collapse, className)} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduced ? { duration: 0 } : { height: spring.smooth, opacity: { duration: duration.fast, ease: standardEase } }}>{children}</motion.div>}
  </AnimatePresence>;
}

/** Four segments that fill as the source moves through parse, chunk, embed and index. */
function Pipeline({ source }: { source: KnowledgeSource }) {
  const failedAt = source.status === "failed" ? INGEST_STEPS.indexOf(source.failedStep ?? "parse") : -1;
  const reached =
    source.status === "indexed" ? 4
      : source.status === "queued" ? 0
        : source.status === "failed" ? failedAt
          : INGEST_STEPS.indexOf(source.status);
  const progress = Math.min(1, Math.max(0, source.progress ?? 0));
  const value =
    source.status === "indexed" ? 100
      : Math.round(((reached + (stepOf(source.status) || source.status === "failed" ? progress : 0)) / 4) * 100);
  const text =
    source.status === "indexed" ? "Indexed"
      : source.status === "queued" ? "Queued"
        : source.status === "failed" ? `Failed at ${STEP_LABELS[source.failedStep ?? "parse"].toLowerCase()}`
          : `${STEP_LABELS[source.status]}, step ${reached + 1} of 4`;
  return <span className={styles.pipeline} role="progressbar" aria-label={`${source.name} ingestion`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-valuetext={text}>
    {INGEST_STEPS.map((step, index) => {
      const state = index < reached ? "done" : index === reached ? (source.status === "failed" ? "failed" : source.status === "queued" ? "pending" : "active") : "pending";
      const fill = state === "done" ? 1 : state === "active" || state === "failed" ? Math.max(progress, 0.12 * Number(state === "failed")) : 0;
      return <span key={step} className={styles.segment} data-state={state} data-complete={source.status === "indexed" || undefined}>
        <span className={styles.segmentFill} style={{ transform: `scaleX(${fill})` }}/>
      </span>;
    })}
  </span>;
}

/** The meta line says what the current step is doing, with the count it has reached. */
function SourceMeta({ source }: { source: KnowledgeSource }) {
  const progress = Math.min(1, source.progress ?? 0);
  switch (source.status) {
    case "queued":
      return <>Queued<Dot/>{plural(source.pages, "page")}</>;
    case "parse":
      return <><TextShimmer>Parsing</TextShimmer><Dot/><span className={styles.count}>{Math.floor(source.pages * progress)}</span>{"\xa0of "}{plural(source.pages, "page")}</>;
    case "chunk":
      return <><TextShimmer>Chunking</TextShimmer><Dot/><span className={styles.count}>{Math.floor(source.chunks * progress)}</span>{"\xa0chunks"}</>;
    case "embed":
      return <><TextShimmer>Embedding</TextShimmer><Dot/><span className={styles.count}>{Math.floor(source.chunks * progress)}</span>{"\xa0of "}{plural(source.chunks, "chunk")}</>;
    case "index":
      return <><TextShimmer>Writing to the index</TextShimmer><Dot/>{plural(source.chunks, "chunk")}</>;
    case "failed":
      return <span className={styles.failText}><CircleAlert aria-hidden="true"/>{source.error ?? "Ingestion failed"}</span>;
    default: {
      const tokens = source.tokens;
      return <>
        {plural(source.pages, "page")}<Dot/>{plural(source.chunks, "chunk")}<Dot/>
        {tokens >= 1000 ? `${(tokens / 1000).toFixed(tokens >= 100000 ? 0 : 1)}K` : String(Math.round(tokens))} tokens
        {source.note && <span className={styles.note}><Dot/>{source.note}</span>}
      </>;
    }
  }
}

/**
 * A two-line excerpt that grows to the full chunk when opened. The clipped state fades the second line out rather
 * than cutting it, and matched query words are marked so the reason a chunk matched is visible.
 */
function Excerpt({ text, terms, open, reduced }: { text: string; terms: string[]; open: boolean; reduced: boolean }) {
  const paragraph = useRef<HTMLParagraphElement>(null);
  const [box, setBox] = useState<{ full: number; clamp: number } | null>(null);
  useLayoutEffect(() => {
    const node = paragraph.current;
    if (!node) return;
    const measure = () => {
      const lineHeight = parseFloat(getComputedStyle(node).lineHeight) || 21;
      const full = Math.ceil(node.getBoundingClientRect().height);
      setBox(previous => (previous && previous.full === full ? previous : { full, clamp: Math.min(full, Math.round(2 * lineHeight)) }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const clipped = !box || box.full > box.clamp + 1;
  const parts = useMemo(() => highlight(text, terms), [text, terms]);
  const height = useMotionValue<string | number>("auto");
  const wasOpen = useRef<boolean | null>(null);
  useLayoutEffect(() => {
    if (!box) return;
    const target = open ? box.full : box.clamp;
    const changed = wasOpen.current !== null && wasOpen.current !== open;
    wasOpen.current = open;
    if (!changed || reduced) {
      height.jump(target);
      return;
    }
    const controls = animate(height, target, spring.smooth);
    return () => controls.stop();
  }, [open, box, reduced, height]);
  return <motion.div className={styles.excerptClip} data-clipped={(!open && clipped) || undefined} style={{ height }}>
    <p ref={paragraph} className={styles.excerpt}>
      {parts.map((part, index) => part.hit ? <mark key={index} className={styles.hit}>{part.text}</mark> : <span key={index}>{part.text}</span>)}
    </p>
  </motion.div>;
}

/** A small bar plus the number, so the ordering reason is readable at a glance. */
function Score({ value, kind, reduced }: { value: number; kind: "similarity" | "relevance"; reduced: boolean }) {
  return <span className={styles.score} data-kind={kind}>
    <span className={styles.scoreTrack} aria-hidden="true">
      <motion.span className={styles.scoreFill} initial={false} animate={{ scaleX: Math.max(0.02, Math.min(1, value)) }} transition={reduced ? { duration: 0 } : spring.smooth}/>
    </span>
    <span className={styles.scoreValue}><AnimatedNumber value={value} format={current => current.toFixed(2)} reduced={reduced}/></span>
  </span>;
}

function ResultRow({ result, source, open, onToggle, terms, reranked, kind, settings, reduced, enterDelay }: {
  result: { item: RetrievedChunk; rank: number; vectorRank: number; score: number };
  source?: KnowledgeSource;
  open: boolean;
  onToggle: () => void;
  terms: string[];
  reranked: boolean;
  kind: "similarity" | "relevance";
  settings: RetrievalSettings;
  reduced: boolean;
  enterDelay: number;
}) {
  const bodyId = useId();
  const { item, rank, vectorRank } = result;
  const delta = reranked ? vectorRank - rank : 0;
  const name = source?.name ?? "Removed source";
  return <motion.li layout="position" className={styles.result} data-open={open || undefined} style={{ zIndex: delta > 0 ? 2 : 1 }} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: reduced ? { duration: 0 } : { ...enterFast, delay: enterDelay } }} exit={{ opacity: 0, transition: reduced ? { duration: 0 } : exitFast }} transition={{ layout: reduced ? { duration: 0 } : layoutSpring }}>
    <button type="button" className={styles.resultHead} aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
      <Swap id={String(rank)} className={styles.rank} reduced={reduced}>{rank}</Swap>
      <span className={styles.where}>
        <KindMark kind={source?.kind ?? "file"} className={styles.resultMark}/>
        <span className={styles.whereName}>{name}</span>
        {item.location && <span className={styles.whereLoc}>{item.location}</span>}
      </span>
      <span className={styles.deltaSlot}>
        <AnimatePresence initial={false}>
          {delta !== 0 && <motion.span key={delta > 0 ? "up" : "down"} className={styles.delta} data-dir={delta > 0 ? "up" : "down"} initial={{ opacity: 0, y: reduced ? 0 : delta > 0 ? 3 : -3 }} animate={{ opacity: 1, y: 0, transition: reduced ? { duration: 0 } : { ...enterFast, delay: 0.12 } }} exit={{ opacity: 0, transition: exitFast }}>
            {delta > 0 ? <ArrowUp aria-hidden="true"/> : <ArrowDown aria-hidden="true"/>}
            <span className={styles.tabular}>{Math.abs(delta)}</span>
            <span className={styles.srOnly}>{delta > 0 ? `Up ${delta}` : `Down ${-delta}`} after reranking, was {vectorRank}</span>
          </motion.span>}
        </AnimatePresence>
      </span>
      <Score value={result.score} kind={kind} reduced={reduced}/>
      <span className={styles.srOnly}>{kind === "relevance" ? "Reranker score" : "Similarity"} {result.score.toFixed(2)}</span>
    </button>
    <div id={bodyId} className={styles.resultBody} onClick={event => {
      if (!(event.target as HTMLElement).closest("button, a") && !window.getSelection()?.toString()) onToggle();
    }}>
      <Collapse open={open && Boolean(item.before)} reduced={reduced}>
        {item.before && <div className={styles.neighbour} data-pos="before">
          <span className={styles.ctxLabel}>Previous chunk{item.before.location ? `, ${item.before.location}` : ""}</span>
          <p className={styles.neighbourText}>{item.before.text}</p>
        </div>}
      </Collapse>
      <div className={styles.focus}><Excerpt text={item.text} terms={terms} open={open} reduced={reduced}/></div>
      <Collapse open={open} reduced={reduced}>
        {item.after && <div className={styles.neighbour} data-pos="after">
          <span className={styles.ctxLabel}>Next chunk{item.after.location ? `, ${item.after.location}` : ""}</span>
          <p className={styles.neighbourText}>{item.after.text}</p>
        </div>}
        <div className={styles.ctxFoot}>
          <span className={styles.ctxMeta}>
            <span>Similarity <span className={styles.tabular}>{item.similarity.toFixed(2)}</span></span>
            {item.relevance !== undefined && <><Dot/><span>Reranker <span className={styles.tabular}>{item.relevance.toFixed(2)}</span></span></>}
            <Dot/><span>{settings.overlap} token overlap</span>
          </span>
          <CopyButton value={item.text} label="Copy chunk" variant="plain"/>
        </div>
      </Collapse>
    </div>
  </motion.li>;
}

type SearchState =
  | { query: string; status: "searching"; candidates: RetrievedChunk[]; version: number }
  | { query: string; status: "done"; candidates: RetrievedChunk[]; ms: number; version: number }
  | { query: string; status: "error"; candidates: RetrievedChunk[]; error: string; version: number };

/**
 * A knowledge base you can inspect: every source shows its ingest pipeline, and the retrieval tab returns the
 * chunks a question pulls back, with the highlighted excerpt and, when reranking is on, how the order changed.
 */
export default function KnowledgeBase({
  title = "Support knowledge base",
  sources,
  chunks,
  settings,
  defaultSettings: initialSettings,
  onSettingsChange,
  embeddingModels: models = defaultEmbeddingModels,
  suggestions,
  onQuery,
  onAddSource,
  onRetrySource,
  onRemoveSource,
  onReindex,
  defaultView = "sources",
  className,
}: KnowledgeBaseProps) {
  const reduced = useReducedMotion() ?? false;
  const simulated = sources === undefined;

  const fileInput = useRef<HTMLInputElement>(null);
  const queryInput = useRef<HTMLInputElement>(null);
  const searchId = useRef(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(timer => window.clearTimeout(timer)), []);

  const [localSettings, setLocalSettings] = useState<RetrievalSettings>(() => ({ ...defaultSettings, ...initialSettings }));
  const current = settings ?? localSettings;
  const settingsRef = useRef(current);
  settingsRef.current = current;

  const [baseline, setBaseline] = useState(() => ({
    chunkSize: current.chunkSize,
    overlap: current.overlap,
    embeddingModel: current.embeddingModel,
  }));
  const needsReindex = baseline.chunkSize !== current.chunkSize || baseline.overlap !== current.overlap || baseline.embeddingModel !== current.embeddingModel;

  /** Every settings change funnels through here so the overlap can never exceed half the chunk size. */
  const patchSettings = (patch: Partial<RetrievalSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    if (next.overlap > next.chunkSize / 2) next.overlap = 16 * Math.floor(next.chunkSize / 2 / 16);
    settingsRef.current = next;
    if (!settings) setLocalSettings(next);
    onSettingsChange?.(next);
    return next;
  };

  const [localSources, setLocalSources] = useState<KnowledgeSource[]>(() => sampleSources);
  const [localChunks, setLocalChunks] = useState<KnowledgeChunk[]>(() => sampleChunks);
  const [added, setAdded] = useState<Partial<Record<AddedKind, boolean>>>({});

  const list = sources ?? localSources;
  const corpus = useMemo(() => chunks ?? (simulated ? localChunks : []), [chunks, simulated, localChunks]);
  const ingesting = simulated && localSources.some(source => source.status === "queued" || stepOf(source.status));

  // The ingest simulation: one animation frame per tick, each active source advancing inside its current step.
  // A token guards the loop, so a second mount (React's development re-mount) cannot run a parallel clock at double speed.
  const clock = useRef(0);
  useEffect(() => {
    if (!ingesting) return;
    const token = ++clock.current;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      if (token !== clock.current) return;
      const elapsed = Math.min(64, now - previous);
      previous = now;
      setLocalSources(current => {
        let active = current.filter(source => stepOf(source.status)).length;
        return current.map(source => {
          if (source.status === "queued") {
            if (active >= 2) return source;
            active += 1;
            return { ...source, status: "parse", progress: 0 };
          }
          if (!stepOf(source.status)) return source;
          const step = source.status;
          const progress = (source.progress ?? 0) + elapsed / stepDuration(source, step);
          if (source.failAt?.step === step && progress >= source.failAt.at) {
            return { ...source, status: "failed", failedStep: step, progress: source.failAt.at, error: source.failAt.error, failAt: undefined };
          }
          if (progress < 1) return { ...source, progress };
          const next = INGEST_STEPS[INGEST_STEPS.indexOf(step) + 1];
          return next ? { ...source, status: next, progress: 0 } : { ...source, status: "indexed", progress: 1 };
        });
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ingesting]);

  const [indexed, setIndexed] = useState<Set<string>>(() => new Set(list.filter(source => source.status === "indexed").map(source => source.id)));
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    const finished = list.filter(source => source.status === "indexed" && !indexed.has(source.id));
    const removed = [...indexed].filter(id => !list.some(source => source.id === id));
    if (!finished.length && !removed.length) return;
    setIndexed(previous => {
      const next = new Set(previous);
      finished.forEach(source => next.add(source.id));
      removed.forEach(id => next.delete(id));
      return next;
    });
    if (finished.length) setAnnouncement(`${finished.map(source => source.name).join(", ")} indexed and searchable.`);
  }, [list, indexed]);

  // A source that starts failing announces once rather than on every frame.
  const statuses = useRef(new Map<string, IngestStatus>());
  useEffect(() => {
    for (const source of list) {
      const before = statuses.current.get(source.id);
      if (before && before !== "failed" && source.status === "failed") {
        setAnnouncement(`${source.name} failed: ${source.error ?? "ingestion failed"}.`);
      }
      statuses.current.set(source.id, source.status);
    }
  }, [list]);

  const ready = list.filter(source => indexed.has(source.id));
  const totalChunks = ready.reduce((total, source) => total + source.chunks, 0);
  const activeCount = list.filter(source => source.status === "queued" || stepOf(source.status)).length;
  const failedCount = list.filter(source => source.status === "failed").length;
  const searchable = useMemo(() => corpus.filter(chunk => indexed.has(chunk.sourceId)), [corpus, indexed]);
  const version = 1000 * indexed.size + searchable.length;
  const byId = useMemo(() => new Map(list.map(source => [source.id, source])), [list]);
  const modelLabel = (models.find(model => model.value === current.embeddingModel)?.label ?? current.embeddingModel).split(",")[0];

  const [view, setView] = useState<"sources" | "retrieval">(defaultView);
  const [dragging, setDragging] = useState(false);

  function addKind(kind: AddedKind) {
    onAddSource?.({ kind });
    setView("sources");
    if (!simulated) return;
    const payload = addedSources[kind];
    const active = settingsRef.current;
    setLocalSources(current => [{ ...payload.source, chunks: chunksFor(payload.source.tokens, active), status: "queued", progress: 0 }, ...current]);
    setLocalChunks(current => [...current, ...payload.chunks]);
    setAdded(previous => ({ ...previous, [kind]: true }));
    setAnnouncement(`Simulated: ${payload.source.name} added. Ingestion started.`);
  }

  function addFiles(files: File[]) {
    if (!files.length) return;
    setView("sources");
    files.forEach(file => onAddSource?.({ kind: "file", file }));
    if (!simulated) return;
    const active = settingsRef.current;
    const created = files.map((file, index) => {
      const pages = Math.max(1, Math.round(file.size / 48000));
      const tokens = 1650 * pages;
      const supported = UPLOADABLE.test(file.name);
      return {
        id: `file-${Date.now()}-${index}`,
        name: file.name,
        kind: /\.pdf$/i.test(file.name) ? "pdf" as const : "file" as const,
        pages,
        tokens,
        chunks: chunksFor(tokens, active),
        status: "queued" as const,
        progress: 0,
        note: "Uploaded just now",
        retryable: supported,
        failAt: supported ? undefined : { step: "parse" as const, at: 0.35, error: "Unsupported file type. Use PDF, DOCX, Markdown or TXT" },
      };
    });
    setLocalSources(current => [...created, ...current]);
    setAnnouncement(`Simulated: ${plural(files.length, "file")} added. Files stay in this browser.`);
  }

  function reindex() {
    const active = settingsRef.current;
    setBaseline({ chunkSize: active.chunkSize, overlap: active.overlap, embeddingModel: active.embeddingModel });
    onReindex?.(active);
    if (simulated) {
      setLocalSources(current => current.map(source => source.status === "indexed" ? {
        ...source,
        status: "queued",
        progress: 0,
        chunks: chunksFor(source.tokens, active),
      } : source));
      setView("sources");
      setAnnouncement("Simulated: re-indexing with the new settings. Search keeps using the current index until each source finishes.");
    }
  }

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState | null>(null);
  const [openResult, setOpenResult] = useState<string | null>(null);
  const [reranking, setReranking] = useState(false);

  async function runSearch(raw: string, next: RetrievalSettings = settingsRef.current) {
    const text = raw.trim();
    if (!text) return;
    const id = ++searchId.current;
    setQuery(text);
    if (search?.query !== text) setOpenResult(null);
    setSearch(previous => ({ query: text, status: "searching", candidates: previous?.query === text ? previous.candidates : [], version }));
    const started = performance.now();
    try {
      if (!onQuery) await new Promise(resolve => window.setTimeout(resolve, 360 + 280 * Math.random()));
      const candidates = onQuery ? await onQuery(text, next) : retrieve(text, searchable, next, scoreTable);
      if (id !== searchId.current) return;
      const ms = Math.round(performance.now() - started);
      setSearch({ query: text, status: "done", candidates, ms, version });
      const count = Math.min(next.topK, candidates.length);
      setAnnouncement(count ? `${plural(count, "chunk")} retrieved in ${ms} milliseconds.` : "No chunks matched.");
    } catch (error) {
      if (id !== searchId.current) return;
      setSearch(previous => ({ query: text, status: "error", candidates: previous?.candidates ?? [], error: error instanceof Error ? error.message : "The retriever did not respond", version }));
      setAnnouncement("Search failed.");
    }
  }

  function clearQuery() {
    searchId.current += 1;
    setQuery("");
    setSearch(null);
    setOpenResult(null);
    queryInput.current?.focus();
  }

  function toggleRerank(next: boolean) {
    patchSettings({ rerank: next });
    if (next && search && search.status === "done" && search.candidates.length) {
      setReranking(true);
      const wait = reduced ? 120 : 420;
      timers.current.push(window.setTimeout(() => {
        setReranking(false);
        if (settingsRef.current.rerank) setAnnouncement("Results reordered by the reranker.");
      }, wait));
      return;
    }
    setReranking(false);
  }

  const candidates = useMemo(() => search?.candidates ?? [], [search]);
  const bySimilarity = useMemo(() => [...candidates].sort((a, b) => b.similarity - a.similarity), [candidates]);
  const reranked = current.rerank && !reranking && candidates.some(candidate => candidate.relevance !== undefined);
  const ordered = reranked ? [...bySimilarity].sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0)) : bySimilarity;
  const vectorRank = new Map(bySimilarity.map((candidate, index) => [candidate.id, index + 1]));
  const rows = ordered.slice(0, current.topK).map((item, index) => ({
    item,
    rank: index + 1,
    vectorRank: vectorRank.get(item.id) ?? index + 1,
    score: reranked ? (item.relevance ?? item.similarity) : item.similarity,
  }));
  const terms = useMemo(() => queryTerms(search?.query ?? ""), [search?.query]);
  const stale = search?.status === "done" && search.version !== version;

  const suggestionItems = suggestions
    ? suggestions.map(question => ({ query: question, kind: "file" as SourceKind }))
    : [...sampleSuggestions, ...Object.values(addedSources).map(payload => ({ query: payload.suggestion, sourceId: payload.source.id }))]
        .filter(suggestion => indexed.has(suggestion.sourceId))
        .map(suggestion => ({ query: suggestion.query, kind: byId.get(suggestion.sourceId)?.kind ?? "file" }));

  const dragDepth = useRef(0);
  const hasFiles = (event: DragEvent<HTMLElement>) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
  const settingsId = useId();
  const indexedCount = list.filter(source => source.status === "indexed").length;

  const menuItems = [
    { label: added.pdf ? "PDF added" : "PDF document", icon: <FileText size={16} strokeWidth={1.75}/>, onSelect: () => addKind("pdf"), disabled: simulated && Boolean(added.pdf) },
    { label: added.notion ? "Notion page added" : "Notion page", icon: <NotionMark width={16} height={16}/>, onSelect: () => addKind("notion"), disabled: simulated && Boolean(added.notion) },
    { label: added.drive ? "Drive doc added" : "Google Drive doc", icon: <DriveMark width={16} height={16}/>, onSelect: () => addKind("drive"), disabled: simulated && Boolean(added.drive) },
    { label: added.web ? "Website added" : "Website crawl", icon: <Globe size={16} strokeWidth={1.75}/>, onSelect: () => addKind("web"), disabled: simulated && Boolean(added.web) },
    { label: "Upload from computer", icon: <Upload size={16} strokeWidth={1.75}/>, onSelect: () => fileInput.current?.click(), separatorBefore: true },
  ];

  const searchStatus = search
    ? search.status === "searching" ? "searching"
      : search.status === "error" ? "error"
        : reranking ? "reranking"
          : stale ? "stale"
            : "done"
    : "idle";

  return <section
    className={cx(styles.root, className)}
    aria-label={title}
    data-drag={dragging || undefined}
    onDragEnter={event => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
      setView("sources");
    }}
    onDragLeave={event => {
      if (!hasFiles(event)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (!dragDepth.current) setDragging(false);
    }}
    onDragOver={event => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }}
    onDrop={event => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      addFiles(Array.from(event.dataTransfer.files));
    }}
  >
    <header className={styles.header}>
      <div className={styles.titleBlock}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.summary}>
          <span>{plural(list.length, "source")}</span>
          <Dot/>
          <span><AnimatedNumber value={totalChunks} format={value => Math.round(value).toLocaleString("en-US")} reduced={reduced}/> chunks</span>
          <Dot/>
          <span className={styles.summaryModel}>{modelLabel}</span>
        </p>
      </div>
      <div className={styles.actions}>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={styles.iconButton} aria-label={needsReindex ? "Retrieval settings, re-index needed" : "Retrieval settings"}>
              <SlidersHorizontal aria-hidden="true"/>
              {needsReindex && <span className={styles.badgeDot} aria-hidden="true"/>}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className={styles.settings} aria-labelledby={settingsId}>
            <p id={settingsId} className={styles.settingsTitle}>Retrieval settings</p>
            <div className={styles.settingsGroup}>
              <Slider label="Chunk size" value={current.chunkSize} min={128} max={2048} step={64} format={value => `${value} tokens`} onValueChange={value => patchSettings({ chunkSize: value })}/>
              <Slider label="Overlap" value={current.overlap} min={0} max={Math.max(16, 16 * Math.floor(current.chunkSize / 2 / 16))} step={16} format={value => `${value} tokens`} onValueChange={value => patchSettings({ overlap: value })}/>
              <Slider label="Top k" value={current.topK} min={1} max={10} step={1} onValueChange={value => patchSettings({ topK: value })}/>
            </div>
            <div className={styles.toggles}>
              <label className={styles.toggleRow}>
                <span className={styles.toggleText}><span>Hybrid search</span><span className={styles.toggleHint}>Blend keyword matches with vectors</span></span>
                <Switch checked={current.hybrid} onCheckedChange={value => {
                  const next = patchSettings({ hybrid: value });
                  if (search && search.status !== "searching") void runSearch(search.query, next);
                }} aria-label="Hybrid search"/>
              </label>
              <label className={styles.toggleRow}>
                <span className={styles.toggleText}><span>Reranking</span><span className={styles.toggleHint}>Re-score the top 20 with a cross-encoder</span></span>
                <Switch checked={current.rerank} onCheckedChange={toggleRerank} aria-label="Reranking"/>
              </label>
            </div>
            <Select label="Embedding model" options={models} value={current.embeddingModel} onValueChange={value => patchSettings({ embeddingModel: value })}/>
            <Collapse open={needsReindex} reduced={reduced}>
              <div className={styles.reindex}>
                <p>Chunking or the model changed. Re-index {plural(indexedCount, "source")} to apply it.</p>
                <button type="button" className={styles.accentButton} onClick={reindex}>Re-index</button>
              </div>
            </Collapse>
          </PopoverContent>
        </Popover>
        <DropdownMenu label="Add source" icon={<Plus size={16} strokeWidth={1.75}/>} items={menuItems}/>
        <input ref={fileInput} type="file" multiple hidden accept=".pdf,.doc,.docx,.md,.markdown,.txt,.html" onChange={event => {
          addFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}/>
      </div>
    </header>

    <div className={styles.tabs}>
      <SegmentedControl
        label="View"
        value={view}
        onValueChange={next => setView(next as "sources" | "retrieval")}
        options={[
          { value: "sources", label: "Sources", accessory: <span className={styles.tabCount}>{list.length}</span> },
          { value: "retrieval", label: "Test retrieval" },
        ]}
      />
      <span className={styles.tabStatus}>
        <Swap id={activeCount ? `w${activeCount}` : failedCount ? `f${failedCount}` : "ok"} reduced={reduced}>
          {activeCount
            ? <><span className={styles.spinner} aria-hidden="true"/>{activeCount} indexing</>
            : failedCount
              ? <><CircleAlert className={styles.failIcon} aria-hidden="true"/>{failedCount} failed</>
              : <><Check className={styles.okIcon} aria-hidden="true"/>All indexed</>}
        </Swap>
      </span>
    </div>

    <div className={styles.body}>
      <AnimatePresence initial={false} mode="popLayout">
        {view === "sources" ? <motion.div key="sources" className={styles.panel} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: reduced ? { duration: 0 } : enterFast }} exit={{ opacity: 0, transition: reduced ? { duration: 0 } : exitFast }}>
          {list.length > 0 && <div className={styles.columns} aria-hidden="true">
            <span>Source</span>
            <span className={styles.stepLabels}>{INGEST_STEPS.map(step => <span key={step}>{STEP_LABELS[step]}</span>)}</span>
            <span/>
          </div>}
          <Collapse open={needsReindex && indexedCount > 0} reduced={reduced}>
            <div className={styles.notice}>
              <span>Settings changed since the last index. Search uses the old chunks until you re-index.</span>
              <button type="button" className={styles.accentButton} onClick={reindex}>Re-index {indexedCount}</button>
            </div>
          </Collapse>
          <ul className={styles.sourceList}>
            <AnimatePresence initial={false}>
              {list.map(source => <motion.li key={source.id} className={styles.sourceItem} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduced ? { duration: 0 } : { height: spring.smooth, opacity: { duration: duration.fast, ease: standardEase } }}>
                <div className={styles.sourceRow} data-status={source.status}>
                  <KindMark kind={source.kind} className={styles.sourceMark}/>
                  <div className={styles.sourceMain}>
                    <span className={styles.sourceName} title={source.name}>{source.name}<span className={styles.srOnly}>, {KIND_LABELS[source.kind]}</span></span>
                    <Swap id={source.status} className={styles.sourceMeta} reduced={reduced}><SourceMeta source={source}/></Swap>
                  </div>
                  <Pipeline source={source}/>
                  <span className={styles.sourceEnd}>
                    <Swap id={source.status === "failed" ? (source.retryable === false ? "remove" : "retry") : source.status === "indexed" ? "done" : source.status === "queued" ? "queued" : "work"} reduced={reduced}>
                      {source.status === "indexed"
                        ? <Check className={styles.okIcon} aria-label="Indexed"/>
                        : source.status === "queued"
                          ? <Clock className={styles.mutedIcon} aria-label="Queued"/>
                          : source.status === "failed"
                            ? source.retryable === false
                              ? <button type="button" className={styles.rowAction} onClick={() => {
                                onRemoveSource?.(source.id);
                                if (!simulated) return;
                                setLocalSources(current => current.filter(item => item.id !== source.id));
                                setAnnouncement(`${byId.get(source.id)?.name ?? "Source"} removed.`);
                              }} aria-label={`Remove ${source.name}`}>Remove</button>
                              : <button type="button" className={styles.rowAction} onClick={() => {
                                onRetrySource?.(source.id);
                                if (!simulated) return;
                                setLocalSources(current => current.map(item => item.id === source.id ? {
                                  ...item,
                                  status: item.failedStep ?? "parse",
                                  progress: item.failedStep === "embed" ? Math.min(0.95, item.progress ?? 0) : 0,
                                  error: undefined,
                                  failedStep: undefined,
                                } : item));
                                setAnnouncement(`Retrying ${byId.get(source.id)?.name ?? "source"}.`);
                              }} aria-label={`Retry ${source.name}`}>Retry</button>
                            : <span className={styles.percent}>{Math.round(((INGEST_STEPS.indexOf(source.status) + Math.min(1, source.progress ?? 0)) / 4) * 100)}%</span>}
                    </Swap>
                  </span>
                </div>
              </motion.li>)}
            </AnimatePresence>
          </ul>
          <div className={styles.drop} data-over={dragging || undefined} data-empty={list.length === 0 || undefined}>
            <Upload className={styles.dropIcon} aria-hidden="true"/>
            <span className={styles.dropText}>
              {list.length === 0 ? <span className={styles.dropTitle}>No sources yet</span> : null}
              <span>{dragging ? "Drop to add to this knowledge base" : <>Drop files here, or <button type="button" className={styles.link} onClick={() => fileInput.current?.click()}>browse</button></>}</span>
              <span className={styles.dropHint}>PDF, DOCX, Markdown or TXT{simulated ? ". Demo files stay in your browser" : ""}</span>
            </span>
          </div>
        </motion.div> : <motion.div key="retrieval" className={styles.panel} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: reduced ? { duration: 0 } : enterFast }} exit={{ opacity: 0, transition: reduced ? { duration: 0 } : exitFast }}>
          <form className={styles.query} role="search" onSubmit={event => {
            event.preventDefault();
            void runSearch(query);
          }}>
            <Search className={styles.queryIcon} aria-hidden="true"/>
            <input
              ref={queryInput}
              className={styles.queryInput}
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Escape" && query) {
                  event.preventDefault();
                  clearQuery();
                }
              }}
              placeholder="Ask what a customer would ask"
              aria-label="Test query"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
            />
            <span className={styles.clearSlot}>
              <AnimatePresence initial={false}>
                {query && <motion.button key="clear" type="button" className={styles.clear} aria-label="Clear query" onClick={clearQuery} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: enterFast }} exit={{ opacity: 0, transition: exitFast }}><X aria-hidden="true"/></motion.button>}
              </AnimatePresence>
            </span>
            <button type="submit" className={styles.accentButton} disabled={!query.trim() || ready.length === 0}>Search</button>
          </form>
          <div className={styles.resultsBar}>
            <span className={styles.resultsStatus} aria-hidden="true">
              <Swap id={searchStatus} reduced={reduced}>
                {searchStatus === "idle"
                  ? <>{totalChunks.toLocaleString("en-US")} chunks from {plural(ready.length, "source")}</>
                  : searchStatus === "searching"
                    ? <TextShimmer>{`Searching ${totalChunks.toLocaleString("en-US")} chunks`}</TextShimmer>
                    : searchStatus === "reranking"
                      ? <TextShimmer>{`Reranking ${plural(Math.min(20, candidates.length), "candidate")}`}</TextShimmer>
                      : searchStatus === "error"
                        ? <span className={styles.failText}><CircleAlert aria-hidden="true"/>Search failed</span>
                        : searchStatus === "stale"
                          ? <>Index updated<Dot/><button type="button" className={styles.link} onClick={() => void runSearch(search?.query ?? query)}>Run again</button></>
                          : <>{rows.length ? `Top ${rows.length} of ${candidates.length}` : "No matches"}<Dot/><span className={styles.tabular}>{search?.status === "done" ? search.ms : 0} ms</span><Dot/>{reranked ? "by reranker" : "by similarity"}</>}
              </Swap>
            </span>
            <label className={styles.rerank}>
              <span>Rerank</span>
              <Switch checked={current.rerank} onCheckedChange={toggleRerank} aria-label="Rerank results"/>
            </label>
          </div>
          {ready.length === 0
            ? <div className={styles.empty}>
              <p className={styles.emptyTitle}>Nothing is indexed yet</p>
              <p className={styles.emptyText}>Sources become searchable as soon as they finish indexing.</p>
              <Button variant="secondary" size="sm" onClick={() => setView("sources")}>View sources</Button>
            </div>
            : search
              ? search.status === "error"
                ? <div className={styles.empty}>
                  <p className={styles.emptyTitle}>The retriever did not answer</p>
                  <p className={styles.emptyText}>{search.error}. Nothing was changed.</p>
                  <Button variant="secondary" size="sm" onClick={() => void runSearch(search.query)}>Try again</Button>
                </div>
                : search.status !== "searching" || candidates.length
                  ? search.status !== "done" || rows.length
                    ? <AnimatePresence mode="wait" initial={false}>
                      <motion.ul key={search.query} className={styles.results} data-busy={(search.status === "searching" || reranking) || undefined} exit={{ opacity: 0, transition: reduced ? { duration: 0 } : exitFast }}>
                        <AnimatePresence mode="popLayout">
                          {rows.map((row, index) => <ResultRow
                            key={row.item.id}
                            result={row}
                            source={byId.get(row.item.sourceId)}
                            open={openResult === row.item.id}
                            onToggle={() => setOpenResult(currentOpen => currentOpen === row.item.id ? null : row.item.id)}
                            terms={terms}
                            reranked={Boolean(reranked)}
                            kind={reranked ? "relevance" : "similarity"}
                            settings={current}
                            reduced={reduced}
                            enterDelay={reranked ? 0.16 : Math.min(0.02 * index, 0.2)}
                          />)}
                        </AnimatePresence>
                      </motion.ul>
                    </AnimatePresence>
                    : <div className={styles.empty}>
                      <p className={styles.emptyTitle}>No chunks matched</p>
                      <p className={styles.emptyText}>{current.hybrid ? "Try other words, or add a source that covers this." : "Try other words, or turn on hybrid search to match exact terms."}</p>
                    </div>
                  : <ul className={styles.skeletons} aria-hidden="true">
                    {[0, 1, 2].map(index => <li key={index} className={styles.skeleton} style={{ animationDelay: `${90 * index}ms` }}><span/><span/><span/></li>)}
                  </ul>
              : <div className={styles.idle}>
                <p className={styles.idleText}>See which chunks a question pulls back, and how reranking changes the order.</p>
                <ul className={styles.suggestions}>
                  <AnimatePresence initial={false}>
                    {suggestionItems.map(item => <motion.li key={item.query} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduced ? { duration: 0 } : { height: spring.smooth, opacity: { duration: duration.fast } }}>
                      <button type="button" className={styles.suggestion} onClick={() => void runSearch(item.query)}>
                        <KindMark kind={item.kind} className={styles.suggestionMark}/>
                        <span className={styles.suggestionText}>{item.query}</span>
                        <ArrowRight className={styles.suggestionGo} aria-hidden="true"/>
                      </button>
                    </motion.li>)}
                  </AnimatePresence>
                </ul>
              </div>}
        </motion.div>}
      </AnimatePresence>
    </div>

    <p className={styles.srOnly} role="status" aria-live="polite">{announcement}</p>
  </section>;
}

export { KnowledgeBase };
