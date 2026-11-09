"use client";

/**
 * Research Run
 *
 * A deep-research surface: ask a question and watch the agent plan queries, search,
 * read sources, then stream a cited answer. Turns stack in a scroll column; sources
 * live in a rail on wide containers and in a collapsible strip on narrow ones.
 */

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode, RefObject } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  CornerDownRight,
  LoaderCircle,
  Plus,
  RotateCcw,
  Square,
  TriangleAlert,
} from "lucide-react";

import { writeClipboard } from "../lib/use-copy-feedback";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./research-run.module.css";

const { spring, duration, ease, stagger } = motionTokens;
const standardEase = [...ease.standard] as [number, number, number, number];

/** Join truthy class names without pulling in a dependency. */
const cx = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

const noopSubscribe = () => () => {};

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

/** Lifecycle of one research turn. */
export type ResearchTurnStatus =
  | "planning"
  | "searching"
  | "reading"
  | "composing"
  | "writing"
  | "done"
  | "stopped"
  | "error";

/** A document the agent read. */
export interface ResearchSource {
  id: string;
  title: string;
  domain: string;
  url: string;
  /** Monochrome brand mark. Falls back to the domain's first letter. */
  logo?: string;
  snippet?: string;
  date?: string;
}

/** One search query the agent ran. */
export interface ResearchQuery {
  text: string;
  state: "queued" | "searching" | "done";
  results?: number;
}

/** A source as it appears inside a turn, with its read progress. */
export interface ResearchSourceState {
  source: ResearchSource;
  /** Index of the query that surfaced it. */
  query: number;
  /** 0 → 1. */
  progress: number;
  /** 1-based position in the turn, used for citations. */
  n: number;
}

/** A completed or in-flight research turn. */
export interface ResearchTurn {
  id: number;
  question: string;
  status: ResearchTurnStatus;
  queries: ResearchQuery[];
  sources: ResearchSourceState[];
  answer: string;
  followUps: string[];
  started: number;
  researched?: number;
  ended?: number;
  tokens?: number;
  error?: string;
  /** Manual override for the query list disclosure. */
  stepsOpen?: boolean;
}

/** Events produced by an {@link ResearchAsk} implementation. */
export type ResearchEvent =
  | { type: "plan"; queries: string[] }
  | { type: "search"; query: number }
  | { type: "searched"; query: number; results: number }
  | { type: "source"; source: ResearchSource; query: number }
  | { type: "read"; id: string; progress: number }
  | { type: "text"; delta: string }
  | { type: "followUps"; items: string[] }
  | { type: "done"; tokens: number };

/** Resolver that streams events for a question. Abort through `signal`. */
export type ResearchAsk = (
  question: string,
  history: ResearchTurn[],
  signal: AbortSignal,
) => AsyncIterable<ResearchEvent>;

/** Props for {@link ResearchRun}. */
export interface ResearchRunProps {
  /** The opening question. Runs on mount when `autoStart` is on. */
  question?: string;
  /** Run the opening question automatically. */
  autoStart?: boolean;
  /** Event source for every question, including follow ups. */
  onAsk?: ResearchAsk;
  /** Empty-state suggestions. */
  suggestions?: string[];
  /** Reveal speed in characters per second before the arrival rate is known. */
  pace?: number;
  /** Called once a turn settles. */
  onComplete?: (turn: ResearchTurn) => void;
  /** Overrides the first question as the header title. */
  title?: string;
  /** Extra class for the outer section. */
  className?: string;
}

/* -------------------------------------------------------------------------- */
/*                              Small primitives                              */
/* -------------------------------------------------------------------------- */

/** `true` only after hydration, so entry animations never replay. */
function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** Reduced motion, but only once the client owns the tree. */
function useReducedUi(): boolean {
  const mounted = useMounted();
  const reduced = useReducedMotion();
  return mounted && (reduced ?? false);
}

/* -------------------------------------------------------------------------- */
/*                                Stream text                                 */
/* -------------------------------------------------------------------------- */

type UnitKind = "text" | "code" | "line" | "cite";

interface Unit {
  kind: UnitKind;
  text?: string;
  bold?: boolean;
  n?: number;
  index: number;
  space: boolean;
  sentence: number;
}

interface BlockParagraph {
  kind: "p" | "h";
  units: Unit[];
}

interface BlockList {
  kind: "ul" | "ol";
  items: Unit[][];
}

interface BlockCode {
  kind: "code";
  lang: string;
  source: string;
  units: Unit[];
}

type Block = BlockParagraph | BlockList | BlockCode;

interface Counter {
  n: number;
}

/** A line that would render as a marker once the line is complete. */
const PARTIAL_MARKER = /^\s*(#{1,6}|[-*+]|\d+[.)]?|`{1,3}\w*)\s*$/;

/** Inline tokenizer: bold, inline code, and `[n]` citations. */
function tokenize(source: string, counter: Counter): Unit[] {
  const units: Unit[] = [];
  let bold = false;
  let pending = "";
  let spaced = false;
  let sentence = counter.n;
  let nextSentence = false;

  const commit = (seed: {
    kind: UnitKind;
    text?: string;
    bold?: boolean;
    n?: number;
  }) => {
    if (nextSentence && seed.kind !== "cite") {
      sentence = counter.n;
      nextSentence = false;
    }
    units.push({
      ...seed,
      space: spaced && units.length > 0,
      index: counter.n++,
      sentence,
    });
    spaced = false;
    if (
      seed.kind === "text" &&
      typeof seed.text === "string" &&
      /[.!?]["”)]?$/.test(seed.text)
    ) {
      nextSentence = true;
    }
  };

  const flush = () => {
    for (const chunk of pending.split(/(\s+)/)) {
      if (!chunk) continue;
      if (/^\s+$/.test(chunk)) spaced = true;
      else commit({ kind: "text", text: chunk, bold });
    }
    pending = "";
  };

  let cursor = 0;
  while (cursor < source.length) {
    if (source.startsWith("**", cursor)) {
      flush();
      bold = !bold;
      cursor += 2;
      continue;
    }
    if (source[cursor] === "`") {
      flush();
      const end = source.indexOf("`", cursor + 1);
      if (end === -1) break;
      if (end > cursor + 1) {
        commit({ kind: "code", text: source.slice(cursor + 1, end) });
      }
      cursor = end + 1;
      continue;
    }
    if (source[cursor] === "[") {
      const cite = /^\[(\d{1,2})\]/.exec(source.slice(cursor, cursor + 4));
      if (cite) {
        flush();
        commit({ kind: "cite", n: Number(cite[1]) });
        cursor += cite[0].length;
        continue;
      }
      if (/^\[\d{0,2}$/.test(source.slice(cursor))) break;
    }
    pending += source[cursor++];
  }

  flush();
  return units;
}

/** Block parser for the markdown subset the agent emits. */
function parseMarkdown(
  text: string,
  open: boolean,
): { blocks: Block[]; count: number } {
  let source = text;
  if (open) {
    const cut = source.lastIndexOf("\n");
    if (PARTIAL_MARKER.test(source.slice(cut + 1))) {
      source = source.slice(0, cut + 1);
    }
  }

  const counter: Counter = { n: 0 };
  const blocks: Block[] = [];
  const lines = source.split("\n");
  let list: BlockList | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: "p", units: tokenize(paragraph.join(" "), counter) });
    }
    paragraph = [];
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    const fence = /^```(\w*)/.exec(line);

    if (fence) {
      flushParagraph();
      list = null;
      const body: string[] = [];
      for (index++; index < lines.length && !/^\s*```/.test(lines[index]);) {
        body.push(lines[index++]);
      }
      const kept = index < lines.length || !open ? body : body.slice(0, -1);
      blocks.push({
        kind: "code",
        lang: fence[1],
        source: body.join("\n"),
        units: kept.map((lineText) => ({
          kind: "line",
          text: lineText,
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
      const item = (bullet ?? numbered) as RegExpExecArray;
      list.items.push(tokenize(item[1], counter));
      continue;
    }

    list = null;

    if (heading) {
      flushParagraph();
      blocks.push({ kind: "h", units: tokenize(heading[1], counter) });
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return { blocks, count: counter.n };
}

/** Plain-text fallback: paragraphs of space-separated words. */
function parsePlain(text: string): { blocks: Block[]; count: number } {
  const counter: Counter = { n: 0 };
  const blocks: Block[] = text
    .split(/\n{2,}/)
    .filter((part) => part.trim())
    .map((part) => ({
      kind: "p",
      units: part
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

/** Snap a reveal position back to a word boundary so words never split. */
function snapToWord(
  text: string,
  position: number,
  streaming: boolean,
): number {
  if (position >= text.length && !streaming) return text.length;
  let at = Math.min(Math.floor(position), text.length);
  if (at < text.length && /\s/.test(text[at])) return at;
  while (at > 0 && !/\s/.test(text[at - 1])) at--;
  return at;
}

interface RevealOptions {
  streaming: boolean;
  pace?: number;
  enabled?: boolean;
}

/** Drains `text` at a rate that follows how fast it arrived. */
function useReveal(
  text: string,
  { streaming, pace = 70, enabled = true }: RevealOptions,
): { text: string; revealing: boolean } {
  const [revealed, setRevealed] = useState(() => (streaming ? 0 : text.length));
  const [mirror, setMirror] = useState(text);

  let count = revealed;
  if (mirror !== text) {
    setMirror(text);
    if (!text.startsWith(mirror)) {
      count = 0;
      setRevealed(0);
    }
  }

  const revealedRef = useRef(count);
  const textRef = useRef(text);
  const historyRef = useRef<Array<[number, number]>>([]);
  const rateRef = useRef(0);

  useEffect(() => {
    const now = performance.now();
    if (!text.startsWith(textRef.current)) {
      revealedRef.current = 0;
      historyRef.current = [];
    }
    textRef.current = text;

    const history = historyRef.current;
    history.push([now, text.length]);
    while (history.length > 2 && now - history[1][0] > 1500) history.shift();

    if (!enabled) {
      revealedRef.current = text.length;
      return;
    }

    let frame = 0;
    let last = now;
    let committed = -1;
    let rate = rateRef.current;

    const tick = (time: number) => {
      const delta = Math.min(0.05, Math.max(0, (time - last) / 1000));
      last = time;

      const remaining = text.length - revealedRef.current;
      if (remaining > 0) {
        const first = history[0];
        const latest = history[history.length - 1];
        const elapsed = (latest[0] - first[0]) / 1000;
        const arrival =
          history.length > 1 && elapsed > 0.2
            ? Math.max(12, (latest[1] - first[1]) / elapsed)
            : pace;
        const target = streaming
          ? arrival *
            Math.min(
              2.5,
              Math.max(0.45, remaining / Math.max(1, 0.5 * arrival)),
            )
          : Math.max(1.5 * pace, remaining / 0.4);
        rateRef.current = rate = rate
          ? rate + (target - rate) * Math.min(1, delta * (streaming ? 5 : 12))
          : target;
        revealedRef.current = Math.min(
          text.length,
          revealedRef.current + rate * delta,
        );
      }

      const snap = snapToWord(text, revealedRef.current, streaming);
      if (snap !== committed) {
        committed = snap;
        setRevealed(snap);
      }

      if (revealedRef.current < text.length)
        frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, streaming, enabled, pace]);

  const value = enabled ? text.slice(0, Math.min(count, text.length)) : text;
  return { text: value, revealing: value.length < text.length };
}

interface ChunkProps {
  units: Unit[];
  enter: boolean;
  renderCite?: (n: number, sentence: number) => ReactNode;
}

/** One reveal commit. Memoized so earlier spans are never re-rendered. */
const Chunk = memo(
  function Chunk({ units, enter, renderCite }: ChunkProps) {
    const lead = units[0]?.space && units[0].kind === "cite" ? " " : null;
    return (
      <span className={enter ? styles.textEnter : undefined}>
        {lead}
        {units.map((unit) => {
          if (unit.kind === "cite") {
            return (
              <span className={styles.textCite} key={unit.index}>
                {renderCite ? (
                  renderCite(unit.n ?? 0, unit.sentence)
                ) : (
                  <sup>{unit.n}</sup>
                )}
              </span>
            );
          }
          if (unit.kind === "line") {
            return (
              <span className={styles.textCodeLine} key={unit.index}>
                {unit.text || " "}
              </span>
            );
          }
          const inner =
            unit.kind === "code" ? (
              <code className={styles.textInlineCode}>{unit.text}</code>
            ) : unit.bold ? (
              <strong className={styles.textStrong}>{unit.text}</strong>
            ) : (
              unit.text
            );
          return (
            <span data-s={unit.sentence} key={unit.index}>
              {unit.space ? " " : null}
              {inner}
            </span>
          );
        })}
      </span>
    );
  },
  (prev, next) =>
    prev.enter === next.enter &&
    prev.units.length === next.units.length &&
    prev.units[0]?.index === next.units[0]?.index,
);

/** The stall indicator that follows the last block while the answer waits. */
function WaitingDot() {
  return (
    <motion.span
      className={styles.textWaiting}
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

type CopyState = "idle" | "copied" | "failed";

/** Clipboard state with a 1800ms reset. */
function useCopyState(): { state: CopyState; copy: (text: string) => void } {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = useCallback((text: string) => {
    window.clearTimeout(timer.current);
    void (async () => {
      try {
        await writeClipboard(text);
        setState("copied");
      } catch {
        setState("failed");
      }
      timer.current = window.setTimeout(() => setState("idle"), 1800);
    })();
  }, []);

  return { state, copy };
}

const COPY_STATES: CopyState[] = ["idle", "copied", "failed"];
const copyFadeIn = { duration: 0.16, ease: standardEase };
const copyFadeOut = { duration: 0.1, ease: standardEase };

/** The check mark that draws itself once a copy lands. */
function CopyCheck({ reduced }: { reduced: boolean }) {
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
        transition={{ duration: 0.22, ease: standardEase, delay: 0.04 }}
      />
    </svg>
  );
}

interface CopyLabelProps {
  state: CopyState;
  idle?: string;
  done?: string;
}

/** Icon plus crossfading label, sized to the widest of the three labels. */
function CopyLabel({ state, idle = "Copy", done = "Copied" }: CopyLabelProps) {
  const reduced = useReducedMotion() ?? false;
  const labels: Record<CopyState, string> = {
    idle,
    copied: done,
    failed: "Try again",
  };
  const refs = useRef<Record<string, HTMLSpanElement | null>>({});
  const [widths, setWidths] = useState<Record<string, number>>({});

  useLayoutEffect(() => {
    const measure = () => {
      setWidths(
        Object.fromEntries(
          COPY_STATES.map((key) => [key, refs.current[key]?.offsetWidth ?? 0]),
        ),
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    for (const key of COPY_STATES) {
      const node = refs.current[key];
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [idle, done]);

  const target = widths[state];
  const width = useMotionValue<string | number>("auto");
  const initialized = useRef(false);

  useLayoutEffect(() => {
    if (!target) return;
    if (!initialized.current || reduced) {
      initialized.current = true;
      width.jump(target);
      return;
    }
    const controls = animate(width, target, {
      type: "spring",
      visualDuration: 0.22,
      bounce: 0,
    });
    return () => controls.stop();
  }, [target, reduced, width]);

  return (
    <>
      <span className={styles.textIconSlot} aria-hidden="true">
        <AnimatePresence initial={false}>
          <motion.span
            key={state}
            data-state={state}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{
              opacity: 0,
              transition: reduced ? { duration: 0 } : copyFadeOut,
            }}
            transition={reduced ? { duration: 0 } : copyFadeIn}
          >
            {state === "copied" ? (
              <CopyCheck reduced={reduced} />
            ) : state === "failed" ? (
              <TriangleAlert />
            ) : (
              <Copy />
            )}
          </motion.span>
        </AnimatePresence>
      </span>
      <motion.span
        className={styles.textSwap}
        aria-hidden="true"
        style={{ width }}
      >
        {COPY_STATES.map((key) => (
          <span
            key={key}
            ref={(node) => {
              refs.current[key] = node;
            }}
            className={styles.textSwapMeasure}
          >
            {labels[key]}
          </span>
        ))}
        <AnimatePresence initial={false}>
          <motion.span
            key={state}
            className={styles.textSwapText}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{
              opacity: 0,
              transition: reduced ? { duration: 0 } : copyFadeOut,
            }}
            transition={reduced ? { duration: 0 } : copyFadeIn}
          >
            {labels[state]}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </>
  );
}

interface CodeBlockProps {
  lang: string;
  source: string;
  children: ReactNode;
}

/** Fenced code with a language header and a copy action. */
function CodeBlock({ lang, source, children }: CodeBlockProps) {
  const { state, copy } = useCopyState();
  return (
    <div className={styles.textCodeBlock}>
      <div className={styles.textCodeHeader}>
        <span>{lang || "Code"}</span>
        <button
          type="button"
          className={styles.textCodeCopy}
          onClick={() => copy(source)}
          aria-label={state === "copied" ? "Code copied" : "Copy code"}
        >
          <CopyLabel state={state} />
        </button>
      </div>
      <pre className={styles.textPre}>
        <code>{children}</code>
      </pre>
    </div>
  );
}

/** Shimmering status text that goes flat under reduced motion. */
function ShimmerText({
  children,
  reduced,
  className = styles.textShimmer,
}: {
  children: ReactNode;
  reduced: boolean;
  className?: string;
}) {
  return (
    <span className={reduced ? styles.textStatusStatic : className}>
      {children}
    </span>
  );
}

interface StreamTextProps {
  text: string;
  streaming: boolean;
  markdown?: boolean;
  smooth?: boolean;
  pace?: number;
  placeholder?: ReactNode;
  renderCite?: (n: number, sentence: number) => ReactNode;
  onShown?: (text: string) => void;
  onRevealed?: () => void;
  className?: string;
}

/** Reveals text at the pace it arrived, one word-aligned chunk at a time. */
function StreamText({
  text,
  streaming,
  markdown = true,
  smooth = true,
  pace,
  placeholder,
  renderCite,
  onShown,
  onRevealed,
  className,
}: StreamTextProps) {
  const reduced = useReducedUi();
  const { text: shown, revealing } = useReveal(text, {
    streaming,
    pace,
    enabled: smooth,
  });
  const busy = streaming || revealing;
  const { blocks, count } = markdown
    ? parseMarkdown(shown, busy)
    : parsePlain(shown);

  const citeRef = useRef(renderCite);
  useEffect(() => {
    citeRef.current = renderCite;
  });

  const [commits, setCommits] = useState(() => ({
    count,
    starts: [0],
    enterFrom: streaming ? 0 : count,
  }));
  let state = commits;
  if (count !== commits.count) {
    state =
      count > commits.count
        ? {
            ...commits,
            count,
            starts:
              commits.starts[commits.starts.length - 1] === commits.count
                ? commits.starts
                : [...commits.starts, commits.count],
          }
        : {
            count,
            starts: commits.starts.filter((start) => start < count),
            enterFrom: Math.min(commits.enterFrom, count),
          };
    setCommits(state);
  }

  const chunkStart = (index: number) => {
    let low = 0;
    let high = state.starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (state.starts[mid] <= index) low = mid;
      else high = mid - 1;
    }
    return state.starts[low];
  };

  const renderUnits = (units: Unit[]) => {
    const groups: Array<{ start: number; units: Unit[] }> = [];
    for (const unit of units) {
      const start = chunkStart(unit.index);
      const last = groups[groups.length - 1];
      if (last && last.start === start) last.units.push(unit);
      else groups.push({ start, units: [unit] });
    }
    return groups.map((group) => (
      <Chunk
        key={group.units[0].index}
        units={group.units}
        enter={!reduced && group.start >= state.enterFrom}
        renderCite={citeRef.current}
      />
    ));
  };

  const [stalledAt, setStalledAt] = useState(-1);
  useEffect(() => {
    if (!streaming || revealing) return;
    const timer = window.setTimeout(() => setStalledAt(count), 450);
    return () => window.clearTimeout(timer);
  }, [streaming, revealing, count]);

  const stalled = streaming && !revealing && stalledAt === count && count > 0;
  const waiting = (
    <AnimatePresence initial={false}>
      {stalled ? <WaitingDot key="wait" /> : null}
    </AnimatePresence>
  );

  const onShownRef = useRef(onShown);
  const onRevealedRef = useRef(onRevealed);
  useEffect(() => {
    onShownRef.current = onShown;
    onRevealedRef.current = onRevealed;
  });
  useEffect(() => {
    onShownRef.current?.(shown);
  }, [shown]);

  const finished = !busy && shown.length > 0;
  useEffect(() => {
    if (finished) onRevealedRef.current?.();
  }, [finished]);

  const lastBlock = blocks.length - 1;
  const fade = {
    duration: reduced ? 0 : duration.fast,
    ease: standardEase,
  };

  return (
    <div
      className={cx(styles.textStage, className)}
      aria-busy={busy || undefined}
    >
      <AnimatePresence initial={false}>
        {placeholder && streaming && !shown.trim() ? (
          <motion.div
            key="placeholder"
            className={styles.textPlaceholder}
            role="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: fade }}
            transition={fade}
          >
            {placeholder}
          </motion.div>
        ) : null}
      </AnimatePresence>
      {blocks.length ? (
        <div className={markdown ? styles.textMarkdown : styles.textPlain}>
          {blocks.map((block, index) => {
            const dot = index === lastBlock ? waiting : null;
            if (block.kind === "code") {
              return (
                <CodeBlock
                  key={`c${index}`}
                  lang={block.lang}
                  source={block.source}
                >
                  {renderUnits(block.units)}
                  {dot}
                </CodeBlock>
              );
            }
            if ("items" in block) {
              const Tag = block.kind;
              return (
                <Tag key={`${block.kind}${index}`} className={styles.textList}>
                  {block.items.map((units, itemIndex) => (
                    <ListItem
                      key={itemIndex}
                      enter={
                        !reduced && (units[0]?.index ?? 0) >= state.enterFrom
                      }
                    >
                      {renderUnits(units)}
                      {itemIndex === block.items.length - 1 ? dot : null}
                    </ListItem>
                  ))}
                </Tag>
              );
            }
            if (block.kind === "h") {
              return (
                <h4 key={`h${index}`} className={styles.textHeading}>
                  {renderUnits(block.units)}
                  {dot}
                </h4>
              );
            }
            return (
              <p key={`p${index}`} className={styles.textParagraph}>
                {renderUnits(block.units)}
                {dot}
              </p>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** List item that only animates its marker on the commit it first appeared in. */
function ListItem({
  enter,
  children,
}: {
  enter: boolean;
  children: ReactNode;
}) {
  const [initial] = useState(enter);
  return (
    <li className={initial ? styles.textItemEnter : undefined}>{children}</li>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Turn chrome                                 */
/* -------------------------------------------------------------------------- */

const isBusyStatus = (status: ResearchTurnStatus) =>
  status === "planning" || status === "searching" || status === "reading";

const isActiveStatus = (status: ResearchTurnStatus) =>
  status !== "done" && status !== "stopped" && status !== "error";

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

interface SourceMarkProps {
  source: ResearchSource;
  className?: string;
}

/** Brand mark, masked out of the logo asset, with a letter fallback. */
function SourceMark({ source, className }: SourceMarkProps) {
  if (!source.logo) {
    return (
      <span
        className={cx(styles.mark, styles.letter, className)}
        aria-hidden="true"
      >
        {source.domain.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  const mask = `url("${source.logo}")`;
  return (
    <span
      className={cx(styles.mark, className)}
      aria-hidden="true"
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    />
  );
}

/** Live elapsed seconds while a turn is open. */
function Elapsed({ from, to }: { from: number; to?: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (to !== undefined) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [to]);

  return (
    <span className={styles.tabular}>
      {Math.max(0, Math.floor(((to ?? now) - from) / 1000))}s
    </span>
  );
}

interface StepRowProps {
  turn: ResearchTurn;
  reduced: boolean;
  open: boolean;
  onToggle: (open: boolean) => void;
}

/** The disclosure row above a turn: status line plus the query list. */
function StepRow({ turn, reduced, open, onToggle }: StepRowProps) {
  const panelId = useId();
  const read = turn.sources.filter((entry) => entry.progress >= 1).length;
  const total = turn.sources.length;
  const busy = isBusyStatus(turn.status);
  const stoppedEarly = turn.status === "stopped" && !turn.answer;
  const transition = reduced ? { duration: 0 } : spring.smooth;

  return (
    <div className={styles.steps}>
      <button
        type="button"
        className={styles.stepsToggle}
        onClick={() => onToggle(!open)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className={styles.stepsLabel}>
          {turn.status === "planning" ? (
            <ShimmerText reduced={reduced} className={styles.shimmer}>
              Planning the research
            </ShimmerText>
          ) : stoppedEarly ? (
            <>
              Stopped after{" "}
              <Elapsed from={turn.started} to={turn.researched ?? turn.ended} />
              <span className={styles.dotSep} aria-hidden="true" />
              <span className={styles.tabular}>{read} sources read</span>
            </>
          ) : busy ? (
            <>
              <ShimmerText reduced={reduced} className={styles.shimmer}>
                Researching
              </ShimmerText>
              <span className={styles.dotSep} aria-hidden="true" />
              <Elapsed from={turn.started} />
              <span className={styles.dotSep} aria-hidden="true" />
              <span className={styles.tabular}>
                {read} of {total} read
              </span>
            </>
          ) : (
            <>
              {"Researched for "}
              <Elapsed from={turn.started} to={turn.researched ?? turn.ended} />
              <span className={styles.dotSep} aria-hidden="true" />
              <span className={styles.tabular}>{total} sources</span>
            </>
          )}
        </span>
        <ChevronDown
          className={styles.chevron}
          data-open={open || undefined}
          aria-hidden="true"
        />
      </button>
      <motion.div
        id={panelId}
        className={styles.clip}
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={transition}
        inert={!open || undefined}
      >
        <ol className={styles.queries}>
          <AnimatePresence initial={false}>
            {turn.queries.map((query, index) => {
              const marks = turn.sources
                .filter((entry) => entry.query === index)
                .slice(0, 4);
              return (
                <motion.li
                  key={query.text}
                  className={styles.queryItem}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={
                    reduced
                      ? { duration: duration.fast }
                      : { ...spring.smooth, delay: index * stagger.item * 2 }
                  }
                >
                  <div className={styles.query} data-state={query.state}>
                    <span className={styles.queryIcon} aria-hidden="true">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={query.state}
                          initial={reduced ? false : { opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.7 }}
                          transition={reduced ? { duration: 0 } : spring.snappy}
                        >
                          {query.state === "done" ? (
                            <Check aria-hidden="true" />
                          ) : turn.status === "stopped" ? (
                            <Square
                              className={styles.stopGlyph}
                              aria-hidden="true"
                            />
                          ) : (
                            <LoaderCircle
                              className={
                                query.state === "searching"
                                  ? styles.spin
                                  : styles.idleSpin
                              }
                              aria-hidden="true"
                            />
                          )}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                    <span className={styles.queryText}>{query.text}</span>
                    <span className={styles.queryMeta}>
                      <span className={styles.faviconStack} aria-hidden="true">
                        <AnimatePresence initial={false}>
                          {marks.map((entry) => (
                            <motion.span
                              key={entry.source.id}
                              initial={
                                reduced
                                  ? { opacity: 0 }
                                  : { opacity: 0, scale: 0.5, x: -4 }
                              }
                              animate={{ opacity: 1, scale: 1, x: 0 }}
                              exit={{ opacity: 0, scale: 0.5, x: -4 }}
                              transition={
                                reduced ? { duration: 0 } : spring.snappy
                              }
                            >
                              <SourceMark
                                source={entry.source}
                                className={styles.markSmall}
                              />
                            </motion.span>
                          ))}
                        </AnimatePresence>
                      </span>
                      <span
                        className={styles.results}
                        data-shown={query.results !== undefined || undefined}
                      >
                        {query.results ?? 0} results
                      </span>
                    </span>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      </motion.div>
    </div>
  );
}

interface SourceRowProps {
  turn: number;
  entry: ResearchSourceState;
  lit: boolean;
  flash: boolean;
  reduced: boolean;
  open: boolean;
  onToggle: () => void;
  onHover: (target: { n: number; sentence?: number } | null) => void;
}

/** One source: mark, title, read ring, and an expandable summary. */
function SourceRow({
  turn,
  entry,
  lit,
  flash,
  reduced,
  open,
  onToggle,
  onHover,
}: SourceRowProps) {
  const { source, progress, n } = entry;
  return (
    <motion.li
      className={styles.source}
      data-source={`${turn}-${n}`}
      data-lit={lit || undefined}
      data-flash={flash || undefined}
      data-reading={progress < 1 || undefined}
      initial={reduced ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      transition={reduced ? { duration: 0 } : spring.smooth}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") onHover({ n });
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") onHover(null);
      }}
    >
      <button
        type="button"
        className={styles.sourceButton}
        aria-expanded={open}
        onClick={onToggle}
        onFocus={() => onHover({ n })}
        onBlur={() => onHover(null)}
      >
        <SourceMark source={source} className={styles.markRow} />
        <span className={styles.sourceMain}>
          <span className={styles.sourceTitle}>{source.title}</span>
          <span className={styles.sourceMeta}>
            {source.domain}
            {source.date ? (
              <>
                <span className={styles.dotSep} aria-hidden="true" />
                {source.date}
              </>
            ) : null}
          </span>
        </span>
        <span
          className={styles.sourceN}
          aria-label={
            progress < 1
              ? `Reading, ${Math.round(progress * 100)} percent`
              : `Source ${n}`
          }
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle
              className={styles.ringTrack}
              cx="10"
              cy="10"
              r="7.5"
              fill="none"
            />
            <circle
              className={styles.ring}
              cx="10"
              cy="10"
              r="7.5"
              fill="none"
              pathLength={1}
              style={{ strokeDashoffset: 1 - progress }}
            />
          </svg>
          <span>{n}</span>
        </span>
      </button>
      <motion.div
        className={styles.clip}
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={reduced ? { duration: 0 } : spring.smooth}
        inert={!open || undefined}
      >
        {source.snippet ? (
          <p className={styles.snippet}>{source.snippet}</p>
        ) : null}
        <a
          className={styles.sourceLink}
          href={source.url}
          target="_blank"
          rel="noreferrer"
        >
          {source.url.replace(/^https:\/\//, "")}
        </a>
      </motion.div>
    </motion.li>
  );
}

interface SourceListProps {
  turn: ResearchTurn;
  hover: { n: number; sentence?: number } | null;
  flash: number | null;
  reduced: boolean;
  onHover: (target: { n: number; sentence?: number } | null) => void;
}

/** The list shared by the rail and the narrow-container strip. */
function SourceList({ turn, hover, flash, reduced, onHover }: SourceListProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <ol className={styles.sourceList}>
      <AnimatePresence initial={false}>
        {turn.sources.map((entry) => (
          <SourceRow
            key={entry.source.id}
            turn={turn.id}
            entry={entry}
            reduced={reduced}
            lit={hover?.n === entry.n}
            flash={flash === entry.n}
            open={openId === entry.source.id}
            onToggle={() =>
              setOpenId((current) =>
                current === entry.source.id ? null : entry.source.id,
              )
            }
            onHover={onHover}
          />
        ))}
      </AnimatePresence>
    </ol>
  );
}

interface SourceStripProps {
  turn: ResearchTurn;
  reduced: boolean;
  open: boolean;
  onOpen: (open: boolean) => void;
}

/** Narrow-container replacement for the rail. */
function SourceStrip({ turn, reduced, open, onOpen }: SourceStripProps) {
  const panelId = useId();
  if (!turn.sources.length) return null;
  const read = turn.sources.filter((entry) => entry.progress >= 1).length;
  const busy = isBusyStatus(turn.status);
  return (
    <div className={styles.strip}>
      <button
        type="button"
        className={styles.stripToggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpen(!open)}
      >
        <span className={styles.stripIcons} aria-hidden="true">
          {turn.sources.slice(0, 5).map((entry) => (
            <SourceMark
              key={entry.source.id}
              source={entry.source}
              className={styles.markStrip}
            />
          ))}
        </span>
        <span>
          {busy
            ? `${read} of ${turn.sources.length} sources read`
            : `${turn.sources.length} sources`}
        </span>
        <ChevronDown
          className={styles.chevron}
          data-open={open || undefined}
          aria-hidden="true"
        />
      </button>
      <motion.div
        id={panelId}
        className={styles.clip}
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={reduced ? { duration: 0 } : spring.smooth}
        inert={!open || undefined}
      >
        <SourceList
          turn={turn}
          hover={null}
          flash={null}
          reduced={reduced}
          onHover={() => {}}
        />
      </motion.div>
    </div>
  );
}

/** Markdown answer flattened to copyable plain text. */
function answerToText(answer: string, sources: ResearchSourceState[]): string {
  let out = answer
    .replace(/```[^\n]*\n([\s\S]*?)```/g, (_match, code: string) => code)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\n{3,}/g, "\n\n");
  const cited = sources.filter((entry) => out.includes(`[${entry.n}]`));
  if (cited.length) {
    out += `\n\nSources\n${cited
      .map((entry) => `[${entry.n}] ${entry.source.title}, ${entry.source.url}`)
      .join("\n")}`;
  }
  return out;
}

/** Copy-answer action with its own clipboard state. */
function CopyAnswerButton({
  text,
  sources,
}: {
  text: string;
  sources: ResearchSourceState[];
}) {
  const { state, copy } = useCopyState();
  return (
    <button
      type="button"
      className={styles.action}
      onClick={() => copy(answerToText(text, sources))}
      aria-label={
        state === "copied"
          ? "Answer copied"
          : state === "failed"
            ? "Copy failed, try again"
            : "Copy answer"
      }
    >
      <CopyLabel state={state} idle="Copy" done="Copied" />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Scripted run                                */
/* -------------------------------------------------------------------------- */

interface ScriptedSource {
  query: number;
  /** Seconds the reader spends on the source. */
  read: number;
  source: ResearchSource;
}

interface ScriptedRun {
  queries: Array<{ text: string; results: number }>;
  sources: ScriptedSource[];
  answer: string;
  followUps: string[];
}

const source = (
  id: string,
  logo: string,
  domain: string,
  title: string,
  snippet: string,
  date: string,
  path = "",
): ResearchSource => ({
  id,
  domain,
  title,
  snippet,
  date,
  logo: `/block-logos/${logo}.svg`,
  url: `https://${domain}/${path}`,
});

/** Question the block opens with. */
export const SAMPLE_QUESTION =
  "How do teams like Stripe and Slack ship risky changes without outages?";

/** Empty-state suggestions. */
export const SAMPLE_SUGGESTIONS: string[] = [
  SAMPLE_QUESTION,
  "What is the safest way to migrate a live database table?",
  "How do feature flags reduce deploy risk?",
];

const FIRST_RUN: ScriptedRun = {
  queries: [
    { text: "staged deploy rollout percentage engineering blog", results: 16 },
    { text: "feature flags separate deploy from release", results: 12 },
    { text: "online data migration dual writes", results: 9 },
    { text: "automatic rollback guardrail metrics canary", results: 11 },
  ],
  sources: [
    {
      query: 0,
      read: 1.1,
      source: source(
        "slack",
        "slack",
        "slack.engineering",
        "Deploys at Slack",
        "Every deploy moves through dogfood and canary stages, then widens in percentage steps while engineers watch error and latency dashboards.",
        "2020",
        "deploys-at-slack",
      ),
    },
    {
      query: 1,
      read: 1.3,
      source: source(
        "github",
        "github",
        "github.blog",
        "How we ship code faster and safer with feature flags",
        "Most changes ship dark behind a flag, so deploying code and turning a feature on become separate, reversible decisions.",
        "2021",
        "feature-flags",
      ),
    },
    {
      query: 2,
      read: 1.4,
      source: source(
        "stripe",
        "stripe",
        "stripe.com",
        "Online migrations at scale",
        "Live data moves in four steps: dual write to both stores, switch reads, switch writes, then remove the old path.",
        "2017",
        "blog/online-migrations",
      ),
    },
    {
      query: 3,
      read: 1,
      source: source(
        "cloudflare",
        "cloudflare",
        "blog.cloudflare.com",
        "Gradual deployments for Workers",
        "A new version can take a small share of traffic first, and the split can be raised or rolled back without a redeploy.",
        "2023",
        "gradual-deployments",
      ),
    },
    {
      query: 0,
      read: 0.9,
      source: source(
        "vercel",
        "vercel",
        "vercel.com",
        "Rolling releases",
        "Traffic shifts to a new deployment in stages, with its metrics compared against the current version before each step.",
        "2025",
        "docs/rolling-releases",
      ),
    },
    {
      query: 3,
      read: 1.2,
      source: source(
        "spotify",
        "spotify",
        "engineering.atspotify.com",
        "Risk aware product decisions in A/B tests",
        "Teams define guardrail metrics up front, and a test that moves them the wrong way is stopped early.",
        "2024",
        "risk-aware-decisions",
      ),
    },
    {
      query: 3,
      read: 0.8,
      source: source(
        "shopify",
        "shopify",
        "shopify.engineering",
        "Resiliency planning for high traffic events",
        "Load tests and game days rehearse failure well before the traffic peak, not during it.",
        "2021",
        "resiliency-planning",
      ),
    },
    {
      query: 3,
      read: 1,
      source: source(
        "airbnb",
        "airbnb",
        "airbnb.tech",
        "Designing experimentation guardrails",
        "Guardrails flag launches that hurt key metrics, even when the target metric improves.",
        "2022",
        "guardrails",
      ),
    },
    {
      query: 0,
      read: 0.7,
      source: source(
        "atlassian",
        "atlassian",
        "atlassian.com",
        "Progressive delivery",
        "Release to a subset of users first and widen exposure as confidence grows.",
        "2024",
        "continuous-delivery/progressive-delivery",
      ),
    },
    {
      query: 2,
      read: 1.1,
      source: source(
        "figma",
        "figma",
        "figma.com",
        "How our databases team lived to tell the scale",
        "Tables moved to new databases step by step, and every change stayed reversible until the final cutover.",
        "2024",
        "blog/how-figmas-databases-team-lived-to-tell-the-scale",
      ),
    },
    {
      query: 2,
      read: 0.9,
      source: source(
        "notion",
        "notion",
        "notion.com",
        "Lessons learned from sharding Postgres",
        "The team double wrote to the old and new databases and compared results before switching reads over.",
        "2021",
        "blog/sharding-postgres-at-notion",
      ),
    },
    {
      query: 1,
      read: 0.7,
      source: source(
        "supabase",
        "supabase",
        "supabase.com",
        "Branching",
        "Each pull request gets its own preview database, so a schema change runs against real migrations before merge.",
        "2025",
        "docs/guides/branching",
      ),
    },
  ],
  answer: `**Separate deploying code from releasing it, and widen exposure in small, reversible steps.** Teams that ship risky changes safely treat every change as something they can turn off.[2][9]

### How they roll out

- **Ship dark behind a flag.** Code reaches production turned off, so turning it on is a separate decision you can undo in seconds.[2]
- **Widen in stages.** A deploy goes to internal users first, then a small share of production, then larger steps while error rates and latency are watched.[1][5]
- **Split traffic at the edge.** A slice of requests can go to the new version and roll back without a redeploy.[4]

### Data changes need their own plan

Schema and data moves are the riskiest part, because a flag cannot undo them. The common pattern is to dual write to the old and new store, switch reads, switch writes, and only then delete the old path.[3][11] Every step stays reversible until the last one.[10] Preview databases per pull request let you run the migration before it merges.[12]

Decide the guardrail metrics before launch and stop automatically when they move the wrong way.[6][8] Rehearse the rollback in a quiet week, so the first time you use it is not during an incident.[7]`,
  followUps: [
    "What should we measure before widening a rollout?",
    "How do we clean up old feature flags?",
    "How does dual writing work in Postgres?",
  ],
};

const FOLLOW_UP_RUN: ScriptedRun = {
  queries: [
    { text: "rollout guardrail metrics error rate latency", results: 10 },
    { text: "canary analysis compare against baseline", results: 8 },
  ],
  sources: [
    {
      query: 0,
      read: 1,
      source: source(
        "spotify-metrics",
        "spotify",
        "engineering.atspotify.com",
        "Choosing sequential testing frameworks",
        "Stop rules written before a test starts keep teams from peeking and widening too early.",
        "2023",
        "sequential-testing",
      ),
    },
    {
      query: 0,
      read: 0.8,
      source: source(
        "airbnb-guardrails",
        "airbnb",
        "airbnb.tech",
        "Designing experimentation guardrails",
        "A launch that improves its goal but hurts bookings or support contacts is paused for review.",
        "2022",
        "guardrails",
      ),
    },
    {
      query: 1,
      read: 0.9,
      source: source(
        "cloudflare-docs",
        "cloudflare",
        "developers.cloudflare.com",
        "Gradual deployments",
        "Compare the new version's errors against the current one on the same share of traffic.",
        "2025",
        "workers/configuration/versions-and-deployments/gradual-deployments",
      ),
    },
    {
      query: 1,
      read: 0.7,
      source: source(
        "vercel-metrics",
        "vercel",
        "vercel.com",
        "Rolling releases metrics",
        "Each stage shows the new deployment's error rate and response times beside the current one.",
        "2025",
        "docs/rolling-releases",
      ),
    },
  ],
  answer: `Pick a small set of metrics before the first step, and write the stop rule down.[1]

- **Error rate** of the new version against the current one, on the same slice of traffic.[3]
- **Latency** at p95 and p99, since averages hide the slow tail.[4]
- **One business guardrail**, such as checkout success or sign ups, so a change that is technically healthy but hurts people still stops.[2]

Compare against a live baseline rather than last week, and widen only after each step holds for a full traffic cycle.[1][3]`,
  followUps: [
    "How long should each rollout stage last?",
    "Can the rollback be automatic?",
  ],
};

/** Abortable delay; rejects with the signal's reason. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Scripted event source used when no `onAsk` is supplied: plans queries,
 * searches them, reads sources in parallel, then streams the answer.
 */
async function* scriptedResearch(
  _question: string,
  history: ResearchTurn[],
  signal: AbortSignal,
): AsyncGenerator<ResearchEvent> {
  const run = history.length ? FOLLOW_UP_RUN : FIRST_RUN;

  await sleep(500, signal);
  yield { type: "plan", queries: run.queries.map((query) => query.text) };
  await sleep(450, signal);

  for (let index = 0; index < run.queries.length; index++) {
    yield { type: "search", query: index };
    await sleep(160, signal);
  }

  const readers: Array<{ id: string; left: number; total: number }> = [];
  const queue = [...run.sources];
  const searched = new Set<number>();
  let clock = 0;
  let nextSourceAt = 0;
  const searchedAt = run.queries.map((_query, index) => 700 + 520 * index);

  while (queue.length || readers.length || searched.size < run.queries.length) {
    await sleep(90, signal);
    clock += 90;

    for (let index = 0; index < run.queries.length; index++) {
      if (!searched.has(index) && clock >= searchedAt[index]) {
        searched.add(index);
        yield {
          type: "searched",
          query: index,
          results: run.queries[index].results ?? 0,
        };
      }
    }

    if (readers.length < 3 && clock >= nextSourceAt && queue.length) {
      const head = queue[0];
      if (head && searched.has(head.query)) {
        queue.shift();
        yield { type: "source", source: head.source, query: head.query };
        readers.push({
          id: head.source.id,
          left: 1000 * head.read,
          total: 1000 * head.read,
        });
        nextSourceAt = clock + 260;
      }
    }

    for (const reader of [...readers]) {
      reader.left -= 90;
      const progress = Math.min(1, 1 - reader.left / reader.total);
      yield { type: "read", id: reader.id, progress };
      if (progress >= 1) readers.splice(readers.indexOf(reader), 1);
    }
  }

  await sleep(500, signal);

  let cursor = 0;
  let chunk = 0;
  while (cursor < run.answer.length) {
    const size = 3 + Math.floor(16 * Math.random());
    const delta = run.answer.slice(cursor, cursor + size);
    const wait = chunk++ % 17 === 9 ? 420 : 24 + 90 * Math.random();
    cursor += size;
    yield { type: "text", delta };
    await sleep(wait, signal);
  }

  yield { type: "followUps", items: run.followUps };
  yield {
    type: "done",
    tokens: Math.round(run.answer.length / 3.6) + 1850 * run.sources.length,
  };
}

/* -------------------------------------------------------------------------- */
/*                                Scroll pin                                  */
/* -------------------------------------------------------------------------- */

interface ScrollState {
  scroller: RefObject<HTMLDivElement | null>;
  content: RefObject<HTMLDivElement | null>;
  away: boolean;
  scrolled: boolean;
  jump: () => void;
}

/** Keeps the thread pinned to the newest content until the reader scrolls away. */
function useThreadScroll(reduced: boolean): ScrollState {
  const scroller = useRef<HTMLDivElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  const pinned = useRef(true);
  const frame = useRef(0);
  const [away, setAway] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const glide = useCallback(
    (snap = false) => {
      const node = scroller.current;
      if (!node) return;
      cancelAnimationFrame(frame.current);
      const step = () => {
        const max = node.scrollHeight - node.clientHeight;
        const remaining = max - node.scrollTop;
        if (remaining <= 0.5 || !pinned.current) return;
        node.scrollTop =
          snap || reduced
            ? max
            : node.scrollTop + Math.max(1, 0.16 * remaining);
        frame.current = requestAnimationFrame(step);
      };
      step();
    },
    [reduced],
  );

  const release = useCallback(() => {
    pinned.current = false;
    cancelAnimationFrame(frame.current);
  }, []);

  const jump = useCallback(() => {
    pinned.current = true;
    setAway(false);
    glide(true);
  }, [glide]);

  useEffect(() => {
    const node = scroller.current;
    const thread = content.current;
    if (!node || !thread) return;

    let engaged = false;
    let lastTop = node.scrollTop;

    const sync = () => {
      const remaining = node.scrollHeight - node.clientHeight - node.scrollTop;
      if (engaged && node.scrollTop < lastTop - 1) release();
      if (remaining < 6) pinned.current = true;
      lastTop = node.scrollTop;
      setAway(!pinned.current && remaining > 60);
      setScrolled(node.scrollTop > 56);
    };
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) release();
    };
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === "ArrowUp" ||
        event.key === "PageUp" ||
        event.key === "Home" ||
        (event.key === " " && event.shiftKey)
      ) {
        release();
      }
    };
    let touchY = 0;
    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? touchY;
      if (y - touchY > 2) release();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target === node) engaged = true;
    };
    const onPointerUp = () => {
      engaged = false;
    };

    node.addEventListener("scroll", sync, { passive: true });
    node.addEventListener("wheel", onWheel, { passive: true });
    node.addEventListener("keydown", onKey);
    node.addEventListener("touchstart", onTouchStart, { passive: true });
    node.addEventListener("touchmove", onTouchMove, { passive: true });
    node.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            if (pinned.current) glide();
            else sync();
          });
    observer?.observe(thread);

    return () => {
      node.removeEventListener("scroll", sync);
      node.removeEventListener("wheel", onWheel);
      node.removeEventListener("keydown", onKey);
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchmove", onTouchMove);
      node.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      observer?.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, [glide, release]);

  return { scroller, content, away, scrolled, jump };
}

/* -------------------------------------------------------------------------- */
/*                                  Research                                  */
/* -------------------------------------------------------------------------- */

interface HoverTarget {
  n: number;
  sentence?: number;
  turn: number;
  sentences: number[];
}

/**
 * Deep research block: plans queries, reads sources, and streams a cited answer.
 *
 * @example
 * <ResearchRun question="How do teams ship risky changes?" />
 */
export function ResearchRun({
  question = SAMPLE_QUESTION,
  autoStart = true,
  onAsk = scriptedResearch,
  suggestions = SAMPLE_SUGGESTIONS,
  pace = 70,
  onComplete,
  title,
  className,
}: ResearchRunProps) {
  const reduced = useReducedUi();
  const [turns, setTurns] = useState<ResearchTurn[]>([]);
  const [input, setInput] = useState("");
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const [flashTurn, setFlashTurn] = useState<number | null>(null);
  const [flashN, setFlashN] = useState<number | null>(null);

  const scroll = useThreadScroll(reduced);

  const turnsRef = useRef<ResearchTurn[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const shownRef = useRef(new Map<number, string>());
  const idRef = useRef(1);
  const flashTimer = useRef(0);
  const startedRef = useRef(false);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const askRef = useRef(onAsk);
  const completeRef = useRef(onComplete);
  const jumpRef = useRef(scroll.jump);

  useLayoutEffect(() => {
    turnsRef.current = turns;
    askRef.current = onAsk;
    completeRef.current = onComplete;
    jumpRef.current = scroll.jump;
  });

  useEffect(() => {
    const timer = flashTimer;
    return () => window.clearTimeout(timer.current);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const flash = useCallback((turn: number, n: number | null) => {
    window.clearTimeout(flashTimer.current);
    setFlashTurn(turn);
    setFlashN(n);
    flashTimer.current = window.setTimeout(() => setFlashTurn(null), 1400);
  }, []);

  const run = useCallback(
    (raw: string, replaceId?: number) => {
      const text = raw.trim();
      if (!text) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const id = idRef.current++;
      const history = turnsRef.current.filter(
        (turn) => turn.id !== replaceId && turn.answer,
      );

      let current: ResearchTurn = {
        id,
        question: text,
        status: "planning",
        queries: [],
        sources: [],
        answer: "",
        followUps: [],
        started: Date.now(),
      };

      const commit = (next: ResearchTurn) => {
        current = next;
        setTurns((prev) =>
          prev.some((turn) => turn.id === id)
            ? prev.map((turn) => (turn.id === id ? next : turn))
            : [...prev, next],
        );
      };

      shownRef.current.delete(id);
      commit(current);
      flash(id, null);
      jumpRef.current();

      void (async () => {
        try {
          for await (const event of askRef.current(
            text,
            history,
            controller.signal,
          )) {
            switch (event.type) {
              case "plan":
                commit({
                  ...current,
                  status: "searching",
                  queries: event.queries.map((queryText) => ({
                    text: queryText,
                    state: "queued" as const,
                  })),
                });
                break;
              case "search":
                commit({
                  ...current,
                  queries: current.queries.map((query, index) =>
                    index === event.query
                      ? { ...query, state: "searching" as const }
                      : query,
                  ),
                });
                break;
              case "searched":
                commit({
                  ...current,
                  queries: current.queries.map((query, index) =>
                    index === event.query
                      ? {
                          ...query,
                          state: "done" as const,
                          results: event.results,
                        }
                      : query,
                  ),
                });
                break;
              case "source":
                commit({
                  ...current,
                  status:
                    current.status === "searching" ? "reading" : current.status,
                  sources: [
                    ...current.sources,
                    {
                      source: event.source,
                      query: event.query,
                      progress: 0,
                      n: current.sources.length + 1,
                    },
                  ],
                });
                break;
              case "read": {
                const sources = current.sources.map((entry) =>
                  entry.source.id === event.id
                    ? {
                        ...entry,
                        progress: Math.max(entry.progress, event.progress),
                      }
                    : entry,
                );
                const settled =
                  isBusyStatus(current.status) &&
                  current.queries.length > 0 &&
                  current.queries.every((query) => query.state === "done") &&
                  sources.every((entry) => entry.progress >= 1);
                commit({
                  ...current,
                  sources,
                  status: settled ? "composing" : current.status,
                  researched:
                    settled && current.researched === undefined
                      ? Date.now()
                      : current.researched,
                });
                break;
              }
              case "text":
                commit({
                  ...current,
                  answer: current.answer + event.delta,
                  status: "writing",
                  researched: current.researched ?? Date.now(),
                });
                break;
              case "followUps":
                commit({ ...current, followUps: event.items });
                break;
              case "done":
                commit({
                  ...current,
                  status: "done",
                  tokens: event.tokens,
                  researched: current.researched ?? Date.now(),
                  ended: Date.now(),
                });
                break;
            }
          }

          if (!controller.signal.aborted) {
            if (isActiveStatus(current.status)) {
              commit({
                ...current,
                status: "done",
                researched: current.researched ?? Date.now(),
                ended: Date.now(),
              });
            }
            completeRef.current?.(current);
          }
        } catch (error) {
          if (controller.signal.aborted) return;
          commit({
            ...current,
            status: "error",
            error: error instanceof Error ? error.message : undefined,
            ended: Date.now(),
          });
        }
      })();
    },
    [flash],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    const active = turnsRef.current.find((turn) => isActiveStatus(turn.status));
    if (!active) return;
    const shown = (shownRef.current.get(active.id) ?? "").trimEnd();
    const now = Date.now();
    setTurns((prev) =>
      prev.map((turn) =>
        turn.id === active.id
          ? {
              ...turn,
              answer: shown,
              status: "stopped",
              researched: turn.researched ?? now,
              ended: now,
            }
          : turn,
      ),
    );
  }, []);

  const submit = useCallback(() => {
    if (turnsRef.current.some((turn) => isActiveStatus(turn.status))) {
      stop();
      return;
    }
    const value = input.trim();
    if (!value) return;
    setInput("");
    run(value);
  }, [input, run, stop]);

  useEffect(() => {
    if (!autoStart || startedRef.current) return;
    startedRef.current = true;
    const timer = window.setTimeout(() => run(question), 450);
    return () => {
      window.clearTimeout(timer);
      startedRef.current = false;
    };
  }, [autoStart, question, run]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setTurns([]);
    setInput("");
    setHover(null);
    composerRef.current?.focus();
  }, []);

  const busy = turns.some((turn) => isActiveStatus(turn.status));
  const last = turns[turns.length - 1];
  const titleText = title ?? turns[0]?.question ?? "Research";
  const showTitle = Boolean(title) || scroll.scrolled || turns.length === 0;

  const targetTurn =
    turns.find((turn) => turn.id === (hover?.turn ?? flashTurn)) ?? last;

  const railTarget =
    targetTurn && targetTurn.sources.length ? targetTurn : undefined;
  const railEmpty = !turns.length
    ? "Sources appear here as the research reads them."
    : targetTurn?.status === "planning"
      ? "Planning searches"
      : targetTurn && isActiveStatus(targetTurn.status)
        ? "Searching"
        : "No sources";

  const hoverCss = hover
    ? [
        ...hover.sentences.map(
          (sentence) =>
            `[data-turn="${hover.turn}"] span[data-s="${sentence}"]{background:var(--accent-subtle)}`,
        ),
        hover.sentence !== undefined
          ? `[data-turn="${hover.turn}"] [data-cite="${hover.n}"][data-s="${hover.sentence}"]{border-color:var(--foreground);background:var(--foreground);color:var(--background)}`
          : "",
      ].join("")
    : "";

  return (
    <section className={cx(styles.root, className)} aria-label="Research">
      {hoverCss ? <style>{hoverCss}</style> : null}
      <header className={styles.header}>
        <div className={styles.titleWrap}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.h2
              key={showTitle ? titleText : "research"}
              className={styles.title}
              initial={{ opacity: 0, y: reduced ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -6 }}
              transition={reduced ? { duration: 0 } : spring.snappy}
            >
              {showTitle ? titleText : "Research"}
            </motion.h2>
          </AnimatePresence>
        </div>
        <button
          type="button"
          className={styles.headerButton}
          onClick={reset}
          disabled={!turns.length}
        >
          <Plus aria-hidden="true" />
          <span>New research</span>
        </button>
      </header>
      <div className={styles.body}>
        <div className={styles.column}>
          <div className={styles.scroller} ref={scroll.scroller} tabIndex={-1}>
            <div className={styles.thread} ref={scroll.content}>
              {turns.length ? (
                turns.map((turn, index) => (
                  <Turn
                    key={turn.id}
                    turn={turn}
                    last={index === turns.length - 1}
                    reduced={reduced}
                    pace={pace}
                    shown={shownRef}
                    hover={hover && hover.turn === turn.id ? hover : null}
                    flash={flashTurn === turn.id ? flashN : null}
                    onHover={(target) => {
                      if (!target) {
                        setHover(null);
                        return;
                      }
                      const sentences =
                        target.sentence !== undefined
                          ? [target.sentence]
                          : Array.from(
                              scroll.scroller.current?.querySelectorAll<HTMLElement>(
                                `[data-turn="${turn.id}"] [data-cite="${target.n}"]`,
                              ) ?? [],
                            ).map((node) => Number(node.dataset.s));
                      setHover({
                        n: target.n,
                        sentence: target.sentence,
                        turn: turn.id,
                        sentences,
                      });
                    }}
                    onCite={(n) => {
                      flash(turn.id, n);
                      window.setTimeout(() => {
                        scroll.scroller.current
                          ?.querySelector(`[data-source="${turn.id}-${n}"]`)
                          ?.scrollIntoView({
                            block: "nearest",
                            behavior: reduced ? "auto" : "smooth",
                          });
                      }, 60);
                    }}
                    onToggleSteps={(open) =>
                      setTurns((prev) =>
                        prev.map((entry) =>
                          entry.id === turn.id
                            ? { ...entry, stepsOpen: open }
                            : entry,
                        ),
                      )
                    }
                    onStop={stop}
                    onRerun={() => run(turn.question, turn.id)}
                    onAsk={(next) => run(next)}
                  />
                ))
              ) : (
                <div className={styles.empty}>
                  <p className={styles.emptyTitle}>What should we research?</p>
                  <ul className={styles.followList}>
                    {suggestions.map((suggestion) => (
                      <li key={suggestion}>
                        <button
                          type="button"
                          className={styles.followButton}
                          onClick={() => run(suggestion)}
                        >
                          <CornerDownRight
                            className={styles.followIcon}
                            aria-hidden="true"
                          />
                          <span>{suggestion}</span>
                          <ArrowRight
                            className={styles.followGo}
                            aria-hidden="true"
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
          <div className={styles.dock}>
            <AnimatePresence initial={false}>
              {scroll.away ? (
                <motion.button
                  key="jump"
                  type="button"
                  className={styles.jump}
                  onClick={scroll.jump}
                  initial={{ opacity: 0, y: reduced ? 0 : 6, x: "-50%" }}
                  animate={{ opacity: 1, y: 0, x: "-50%" }}
                  exit={{ opacity: 0, y: reduced ? 0 : 6, x: "-50%" }}
                  transition={reduced ? { duration: 0 } : spring.snappy}
                >
                  <ArrowDown aria-hidden="true" />
                  <span>Jump to latest</span>
                </motion.button>
              ) : null}
            </AnimatePresence>
            <form
              className={styles.composer}
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <textarea
                className={styles.input}
                ref={composerRef}
                rows={1}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    submit();
                  } else if (event.key === "Escape" && busy) {
                    event.preventDefault();
                    stop();
                  }
                }}
                placeholder={
                  turns.length ? "Ask a follow up" : "Ask a research question"
                }
                aria-label={
                  turns.length ? "Ask a follow up" : "Ask a research question"
                }
              />
              <button
                type="submit"
                className={styles.send}
                data-mode={busy ? "stop" : "send"}
                disabled={!busy && !input.trim()}
                aria-label={busy ? "Stop research" : "Send question"}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={busy ? "stop" : "send"}
                    className={styles.sendIcon}
                    initial={
                      reduced
                        ? { opacity: 0 }
                        : { opacity: 0, rotate: -45, scale: 0.9 }
                    }
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0 } }}
                    transition={reduced ? { duration: 0 } : spring.snappy}
                  >
                    {busy ? (
                      <Square className={styles.stopGlyph} aria-hidden="true" />
                    ) : (
                      <ArrowRight aria-hidden="true" />
                    )}
                  </motion.span>
                </AnimatePresence>
              </button>
            </form>
          </div>
        </div>
        <aside className={styles.rail} aria-label="Sources">
          <div className={styles.railHead}>
            <span>Sources</span>
            <span className={styles.tabular}>
              {railTarget ? railTarget.sources.length : ""}
            </span>
          </div>
          {turns.length > 1 && targetTurn ? (
            <div className={styles.railFor}>{targetTurn.question}</div>
          ) : null}
          <div className={styles.railScroll}>
            {railTarget ? (
              <SourceList
                turn={railTarget}
                hover={hover}
                flash={flashTurn === railTarget.id ? flashN : null}
                reduced={reduced}
                onHover={(next) => {
                  if (!next) {
                    setHover(null);
                    return;
                  }
                  const sentences = Array.from(
                    scroll.scroller.current?.querySelectorAll<HTMLElement>(
                      `[data-turn="${railTarget.id}"] [data-cite="${next.n}"]`,
                    ) ?? [],
                  ).map((node) => Number(node.dataset.s));
                  setHover({
                    n: next.n,
                    sentence: next.sentence,
                    turn: railTarget.id,
                    sentences,
                  });
                }}
              />
            ) : (
              <p className={styles.railEmpty}>{railEmpty}</p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

export default ResearchRun;

/* -------------------------------------------------------------------------- */
/*                                    Turn                                    */
/* -------------------------------------------------------------------------- */

interface TurnProps {
  turn: ResearchTurn;
  last: boolean;
  reduced: boolean;
  pace: number;
  shown: RefObject<Map<number, string>>;
  hover: HoverTarget | null;
  flash: number | null;
  onHover: (target: { n: number; sentence?: number } | null) => void;
  onCite: (n: number) => void;
  onToggleSteps: (open: boolean) => void;
  onStop: () => void;
  onRerun: () => void;
  onAsk: (question: string) => void;
}

/** One question, its research trail, answer, and actions. */
function Turn({
  turn,
  last,
  reduced,
  pace,
  shown,
  hover,
  flash,
  onHover,
  onCite,
  onToggleSteps,
  onStop,
  onRerun,
  onAsk,
}: TurnProps) {
  const [stripOpen, setStripOpen] = useState(false);
  const [copiedText, setCopiedText] = useState(turn.answer);
  const [revealed, setRevealed] = useState(() => !isActiveStatus(turn.status));

  const handlers = useRef({ onHover, onCite, onStop, onRerun, onAsk });
  useLayoutEffect(() => {
    handlers.current = { onHover, onCite, onStop, onRerun, onAsk };
  });

  const active = isActiveStatus(turn.status);
  const writing = turn.status === "composing" || turn.status === "writing";
  const settled = !revealed && turn.status === "done";
  const readable = writing || settled;
  const quiet = !active && !settled;
  const busyActions = active || settled;
  const stepsOpen = turn.stepsOpen ?? isBusyStatus(turn.status);
  const words = turn.answer.trim() ? turn.answer.trim().split(/\s+/).length : 0;

  const renderCite = useCallback(
    (n: number, sentence: number) => {
      const entry = turn.sources.find((item) => item.n === n);
      return (
        <button
          type="button"
          className={styles.chip}
          data-cite={n}
          data-s={sentence}
          aria-label={`Source ${n}: ${entry?.source.title ?? ""}`}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") setStripOpen(true);
            handlers.current.onHover({ n, sentence });
          }}
          onPointerLeave={() => handlers.current.onHover(null)}
          onFocus={() => {
            setStripOpen(true);
            handlers.current.onHover({ n, sentence });
          }}
          onBlur={() => handlers.current.onHover(null)}
          onClick={() => {
            setStripOpen(true);
            handlers.current.onCite(n);
          }}
        >
          {n}
        </button>
      );
    },
    [turn.sources],
  );

  return (
    <article
      className={styles.turn}
      aria-label={turn.question}
      data-turn={turn.id}
    >
      <div className={styles.main}>
        <h3 className={styles.question}>{turn.question}</h3>
        <StepRow
          turn={turn}
          reduced={reduced}
          open={stepsOpen}
          onToggle={onToggleSteps}
        />
        <SourceStrip
          turn={turn}
          reduced={reduced}
          open={stripOpen}
          onOpen={setStripOpen}
        />
        <div className={styles.stage}>
          {turn.answer || writing ? (
            <StreamText
              className={styles.answerText}
              text={turn.answer}
              streaming={writing}
              smooth={turn.status !== "stopped"}
              pace={pace}
              placeholder={
                <ShimmerText reduced={reduced}>Writing the answer</ShimmerText>
              }
              renderCite={renderCite}
              onShown={(text) => {
                setCopiedText(text);
                shown.current?.set(turn.id, text);
              }}
              onRevealed={() => setRevealed(true)}
            />
          ) : null}
          {quiet && !turn.answer && turn.status !== "error" ? (
            <p className={styles.note}>
              Stopped before the answer. Rerun to research again.
            </p>
          ) : null}
          {turn.status === "error" ? (
            <p className={styles.note} role="alert">
              <TriangleAlert className={styles.inlineIcon} aria-hidden="true" />
              {turn.error || "The research failed."} Rerun to try again.
            </p>
          ) : null}
        </div>
        <div className={styles.actions}>
          <AnimatePresence initial={false} mode="popLayout">
            {busyActions ? (
              <motion.div
                key="busy"
                className={styles.actionGroup}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -2 }}
                transition={reduced ? { duration: 0 } : spring.snappy}
              >
                {active ? (
                  <button
                    type="button"
                    className={styles.action}
                    onClick={() => handlers.current.onStop()}
                  >
                    <span className={styles.iconSlot} aria-hidden="true">
                      <Square className={styles.stopGlyph} />
                    </span>
                    Stop
                  </button>
                ) : null}
                {readable ? (
                  <span className={styles.readout}>{words} words</span>
                ) : null}
              </motion.div>
            ) : null}
            {quiet && (last || turn.answer) ? (
              <motion.div
                key="done"
                className={styles.actionGroup}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -2 }}
                transition={reduced ? { duration: 0 } : spring.snappy}
              >
                <CopyAnswerButton text={copiedText} sources={turn.sources} />
                {last ? (
                  <button
                    type="button"
                    className={cx(styles.action, styles.rerun)}
                    onClick={() => handlers.current.onRerun()}
                  >
                    <span className={styles.iconSlot} aria-hidden="true">
                      <RotateCcw />
                    </span>
                    Rerun
                  </button>
                ) : null}
                <span className={styles.readout}>
                  {turn.status === "error" ? (
                    "Failed"
                  ) : turn.status === "stopped" ? (
                    "Stopped"
                  ) : (
                    <>
                      <Elapsed from={turn.started} to={turn.ended} />
                      <span className={styles.dotSep} aria-hidden="true" />
                      <span className={styles.tabular}>
                        {turn.tokens !== undefined
                          ? turn.tokens >= 1000
                            ? `${(turn.tokens / 1000).toFixed(1)}k`
                            : turn.tokens
                          : ""}
                      </span>
                    </>
                  )}
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        {last && quiet && turn.status === "done" && turn.followUps.length ? (
          <div className={styles.followUps}>
            <p className={styles.followLabel}>Follow up</p>
            <ul className={styles.followList}>
              {turn.followUps.map((followUp, index) => (
                <motion.li
                  key={followUp}
                  initial={reduced ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : {
                          ...spring.snappy,
                          delay: 0.12 + index * stagger.item * 2,
                        }
                  }
                >
                  <button
                    type="button"
                    className={styles.followButton}
                    onClick={() => handlers.current.onAsk(followUp)}
                  >
                    <CornerDownRight
                      className={styles.followIcon}
                      aria-hidden="true"
                    />
                    <span>{followUp}</span>
                    <ArrowRight
                      className={styles.followGo}
                      aria-hidden="true"
                    />
                  </button>
                </motion.li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className={styles.srOnly} aria-live="polite">
        {quiet && turn.answer && turn.status !== "error"
          ? `Answer ${turn.status === "stopped" ? "stopped" : "ready"}, ${turn.sources.length} sources.`
          : ""}
      </div>
    </article>
  );
}
