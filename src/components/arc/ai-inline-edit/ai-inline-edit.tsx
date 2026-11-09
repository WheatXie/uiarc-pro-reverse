"use client";

/**
 * AI inline edit — Arc Pro block, reconstructed from the shipped preview runtime
 * (`_next/static/chunks/99440.7b3f071af1a1d798.js`) and its CSS module
 * (`_next/static/css/e19086ab763bb0fe.css`).
 *
 * Behaviour kept from the original:
 * - the document is a stack of `contentEditable` paragraphs; selection is read back into character
 *   offsets against the paragraph's own text (ghost spans excluded), and expanded to word edges so
 *   a rewrite never starts or ends mid-word;
 * - ⌘K / Ctrl K anywhere in the host opens the prompt layer at the selection; a floating "Edit"
 *   bubble follows any non-collapsed selection instead;
 * - picking an action (or typing an instruction) streams a rewrite through `onRequestEdit`; the
 *   characters are revealed on a rAF clock that eases toward the measured arrival rate, so a fast
 *   generator still reads like typing and a slow one never stalls the caret;
 * - the rewrite is diffed word-by-word against the original (LCS matrix plus a hunk-merging pass
 *   while streaming, so re-worded sentences read as one change instead of confetti), and rendered as
 *   accept/reject hunks that are tabbable, Enter-accepted and Backspace-rejected;
 * - accepting applies only the accepted hunks, restores the caret after the new text, pushes an
 *   undo entry, flips Saving → Saved, and reports the document through `onChange`;
 * - typing at the end of a paragraph asks `onSuggest` for a continuation, painted word-by-word as a
 *   ghost run that Tab accepts, Escape dismisses and typing consumes;
 * - Enter splits a paragraph, Backspace at offset 0 merges it into the previous one, paste inserts
 *   plain text only.
 *
 * Everything is disabled under `prefers-reduced-motion`: no stream easing, no enter/exit motion, no
 * per-word paint delays, and accepting all changes applies immediately.
 */
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import {
  Briefcase,
  Check,
  CornerDownLeft,
  Loader2,
  Minimize2,
  Redo2,
  Smile,
  Sparkles,
  SpellCheck,
  Square,
  Undo2,
  WandSparkles,
  X,
} from "lucide-react";
import { motionTokens } from "../motion-tokens";
import styles from "./ai-inline-edit.module.css";

/* ---------------------------------------------------------------------------------------------- */
/* Public types                                                                                    */
/* ---------------------------------------------------------------------------------------------- */

/** One quick-edit entry offered in the prompt layer. */
export interface EditAction {
  /** Stable id, also matched against the typed query. */
  id: string;
  /** Row label. */
  label: string;
  /** Instruction sent to `onRequestEdit` when the row is chosen. */
  instruction: string;
}

/** The document the block edits. */
export interface EditDocument {
  title: string;
  paragraphs: string[];
}

/** Who the document belongs to; the header shows the photo and name. */
export interface EditAuthor {
  name: string;
  photo: string;
}

/** What the host is asked to rewrite. */
export interface EditRequest {
  /** Selected text only — the span the rewrite replaces. */
  text: string;
  instruction: string;
  action?: string;
  /** Paragraph text before the selection. */
  before: string;
  /** Paragraph text after the selection. */
  after: string;
  /** Zero-based index of the paragraph in the document. */
  paragraph: number;
}

/** What the host is asked to continue. */
export interface SuggestRequest {
  /** Paragraph text up to the caret. */
  before: string;
  /** Zero-based index of the paragraph in the document. */
  paragraph: number;
  document: EditDocument;
}

/** A rewrite can arrive as a stream of chunks or as one settled string. */
export type EditStream = AsyncIterable<string> | Promise<string>;

/** Rewrite provider. Aborting `signal` stops the block from consuming the stream. */
export type RequestEdit = (payload: EditRequest, signal: AbortSignal) => EditStream;

/** Continuation provider. Resolve `null` to offer nothing. */
export type SuggestText = (
  payload: SuggestRequest,
  signal: AbortSignal,
) => Promise<string | null>;

export interface AiInlineEditProps {
  /** Document opened on mount. Later changes are ignored — the block owns the copy. */
  defaultDocument?: EditDocument;
  /** Rewrite provider; defaults to the local rule table used by the preview. */
  onRequestEdit?: RequestEdit;
  /** Ghost-text provider; defaults to the local snippet match. */
  onSuggest?: SuggestText;
  /** Rows in the prompt layer; defaults to Shorten / Make clearer / Friendlier tone / More formal / Fix grammar. */
  actions?: EditAction[];
  /** Called with the committed document once an edit settles. */
  onChange?: (document: EditDocument) => void;
  /** Header identity. */
  author?: EditAuthor;
  className?: string;
}

/* ---------------------------------------------------------------------------------------------- */
/* Sample document + local providers                                                               */
/* ---------------------------------------------------------------------------------------------- */

const SAMPLE_AUTHOR: EditAuthor = {
  name: "Chloe Nguyen",
  photo: "/media/people/chloe-nguyen.svg",
};

const SAMPLE_DOCUMENT: EditDocument = {
  title: "Offline mode launch plan",
  paragraphs: [
    "We are going to be launching offline mode for the Field app on October 14. This is a really big release for us, and it basically touches every single part of the sync engine, so we want to be very careful about how we actually roll it out to customers.",
    "Crews in rural areas has been asking for this for over a year. Right now, if a technician loses signal in the middle of an inspection, the form just stops saving and they have to start over when they get back into coverage, which is honestly a really frustrating experience.",
    "The rollout happens in three stages. Internal teams and 20 pilot customers get access on October 14. We expand to every Business plan on October 28 if the sync error rate stays under 0.5 percent, and offline mode becomes the default for everyone in November.",
    "Support should expect questions about conflicts, where two people edits the same record while offline. The app keeps both versions and asks the last person to sync which one to keep, so nothing is lost silently.",
    "Next week we will",
  ],
};

const DEFAULT_ACTIONS: EditAction[] = [
  { id: "shorten", label: "Shorten", instruction: "Make this shorter without losing facts" },
  { id: "clearer", label: "Make clearer", instruction: "Rewrite this so it is easier to follow" },
  { id: "friendly", label: "Friendlier tone", instruction: "Make the tone warmer and more casual" },
  { id: "formal", label: "More formal", instruction: "Make the tone more formal" },
  { id: "grammar", label: "Fix grammar", instruction: "Fix spelling and grammar only" },
];

/** Hand-written rewrites, keyed by the exact sentence they replace. */
const EXACT_REWRITES: Record<string, Record<string, string>> = {
  "We are going to be launching offline mode for the Field app on October 14.": {
    shorten: "Offline mode for the Field app launches October 14.",
    clearer: "We launch offline mode for the Field app on October 14.",
    friendly: "Offline mode lands in the Field app on October 14!",
    formal: "Offline mode for the Field app will launch on October 14.",
  },
  "This is a really big release for us, and it basically touches every single part of the sync engine, so we want to be very careful about how we actually roll it out to customers.":
    {
      shorten: "It changes every part of the sync engine, so we will roll it out carefully.",
      clearer:
        "The release changes every part of the sync engine, so we will roll it out to customers in careful stages.",
      friendly:
        "It's a big one: it touches every part of the sync engine, so we're rolling it out carefully.",
      formal:
        "This is a significant release that affects every part of the sync engine, so we will roll it out to customers with care.",
    },
  "Right now, if a technician loses signal in the middle of an inspection, the form just stops saving and they have to start over when they get back into coverage, which is honestly a really frustrating experience.":
    {
      shorten:
        "Today, a technician who loses signal mid inspection loses the form and has to start over.",
      clearer:
        "Today, when a technician loses signal during an inspection, the form stops saving. They have to start again once they are back in coverage.",
      friendly:
        "Right now, if a technician loses signal mid inspection, the form stops saving and they have to start over. That's no fun.",
      formal:
        "At present, if a technician loses signal during an inspection, the form stops saving and must be restarted once coverage returns.",
    },
};

type Rule = readonly [RegExp, string];

/** Fallback rewrite rules, applied sentence by sentence. */
const REWRITE_RULES: Record<string, readonly Rule[]> = {
  shorten: [
    [/\bgoing to be (\w+ing)\b/gi, "$1"],
    [/\bin the middle of\b/gi, "during"],
    [/\bevery single\b/gi, "every"],
    [/\bfor over a year\b/gi, "for a year"],
    [/,? which is honestly a really frustrating experience/gi, ""],
    [/\b(really|basically|actually|honestly|just|very) /gi, ""],
    [/\bin order to\b/gi, "to"],
    [/\bat this point in time\b/gi, "now"],
    [/\bif the sync error rate stays under\b/gi, "if sync errors stay under"],
    [/\bshould expect questions about\b/gi, "will get questions about"],
    [/, so nothing is lost silently/gi, ""],
  ],
  clearer: [
    [/\bget back into coverage\b/gi, "regain signal"],
    [/\btouches every single part of\b/gi, "changes all of"],
    [/\bbasically /gi, ""],
    [/\bconflicts, where\b/gi, "sync conflicts, which happen when"],
    [/\bthe last person to sync\b/gi, "whoever syncs last"],
    [/\bthe default\b/gi, "on by default"],
    [/\bThe rollout happens\b/g, "We will roll it out"],
  ],
  friendly: [
    [/\bWe are\b/g, "We're"],
    [/\bwe are\b/g, "we're"],
    [/\bwe will\b/gi, "we'll"],
    [/\bIt is\b/g, "It's"],
    [/\bit is\b/g, "it's"],
    [/\bdo not\b/gi, "don't"],
    [/\bSupport should expect\b/g, "Support will probably hear"],
    [/\bso nothing is lost silently\b/gi, "so nobody loses their work"],
    [/\bThe app keeps\b/g, "The app hangs on to"],
  ],
  formal: [
    [/\bWe're\b/g, "We are"],
    [/\bwe'll\b/gi, "we will"],
    [/\bit's\b/gi, "it is"],
    [/\bdon't\b/gi, "do not"],
    [/\b(really|basically|honestly|just) /gi, ""],
    [/\bhas been asking for\b/gi, "have requested"],
    [/\bhave been asking for\b/gi, "have requested"],
    [/\bget access\b/gi, "receive access"],
    [/\bexpect questions about\b/gi, "anticipate questions regarding"],
  ],
  grammar: [
    [/\bCrews in rural areas has\b/g, "Crews in rural areas have"],
    [/\btwo people edits\b/g, "two people edit"],
    [/\s{2,}/g, " "],
  ],
};

/** Ghost-text continuations, matched against the paragraph text before the caret. */
const CONTINUATIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /next week we will\s*$/i,
    "share the support macros and a short walkthrough video, so the team can answer conflict questions before the pilot starts.",
  ],
  [/\bwe will\s*$/i, "check in with every pilot customer during the first week."],
  [/\bsupport\s*$/i, "will get a preview build on October 7."],
  [/\bpilot\s*$/i, "customers will get a direct line to the Field team."],
  [/\bthe\s*$/i, "pilot group gets a feedback form inside the app."],
];

const SENTENCE_POOL = [
  "Everything a technician captures offline syncs automatically once the device is back online.",
  "Pilot customers were picked from the crews who reported the most dropped forms.",
  "We will review the error rate every Monday and can pause the rollout at any stage.",
  "The help center article goes live on launch day.",
];

const ACTION_LABELS: Record<string, string> = {
  shorten: "Shortening",
  clearer: "Clarifying",
  friendly: "Warming up the tone",
  formal: "Making it formal",
  grammar: "Fixing grammar",
};

type IconComponent = typeof Sparkles;

const ACTION_ICONS: Record<string, IconComponent> = {
  shorten: Minimize2,
  clearer: WandSparkles,
  friendly: Smile,
  formal: Briefcase,
  grammar: SpellCheck,
};

/** Abortable delay; rejects with the signal reason exactly like the original. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
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

/** Resolve an action from an explicit id or from the wording of the instruction. */
function resolveAction(action: string | undefined, instruction: string): string {
  if (action && REWRITE_RULES[action]) return action;
  const query = instruction.toLowerCase();
  if (/short|concise|trim|tight/.test(query)) return "shorten";
  if (/formal|professional/.test(query)) return "formal";
  if (/friend|casual|warm/.test(query)) return "friendly";
  if (/grammar|spell|typo|fix/.test(query)) return "grammar";
  return "clearer";
}

function applyRules(text: string, rules: readonly Rule[]): string {
  return rules.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), text);
}

/** The default rewrite provider: exact sentence swaps, then the rule table, streamed in chunks. */
async function* defaultRequestEdit(
  payload: EditRequest,
  signal: AbortSignal,
): AsyncIterable<string> {
  const action = resolveAction(payload.action, payload.instruction);
  const sentences = payload.text.match(/[^.!?]+[.!?]+["”)]?\s*|[^.!?]+$/g) ?? [payload.text];

  let result = sentences
    .map((sentence) => {
      const trimmed = sentence.trim();
      const tail = sentence.slice(sentence.trimEnd().length);
      const exact = EXACT_REWRITES[trimmed]?.[action];
      return exact ? exact + tail : applyRules(sentence, REWRITE_RULES[action]);
    })
    .join("");

  if (action !== "grammar") result = applyRules(result, REWRITE_RULES.grammar);

  result = result
    .replace(/\s+([,.])/g, "$1")
    .replace(/^\s*(\w)/, (match, first: string) =>
      /^[a-z]/.test(payload.text.trim()) ? first : first.toUpperCase(),
    );

  await wait(420 + 200 * Math.random(), signal);

  let cursor = 0;
  let tick = 0;
  while (cursor < result.length) {
    const size = 2 + Math.floor(9 * Math.random());
    yield result.slice(cursor, cursor + size);
    cursor += size;
    await wait(tick++ % 13 === 7 ? 260 : 30 + 70 * Math.random(), signal);
  }
}

/** The default continuation provider: a matched snippet, else the next unused sentence. */
async function defaultSuggest(
  payload: SuggestRequest,
  signal: AbortSignal,
): Promise<string | null> {
  await wait(260, signal);
  const before = payload.before;
  const match = CONTINUATIONS.find(([pattern]) => pattern.test(before));
  if (match) return (/\s$/.test(before) ? "" : " ") + match[1];
  if (/[.!?]\s*$/.test(before) && before.length > 40) {
    const whole = payload.document.paragraphs.join(" ");
    const next = SENTENCE_POOL.find((sentence) => !whole.includes(sentence));
    return next ? (/\s$/.test(before) ? "" : " ") + next : null;
  }
  return null;
}

/* ---------------------------------------------------------------------------------------------- */
/* Text + selection helpers                                                                        */
/* ---------------------------------------------------------------------------------------------- */

const cx = (...values: Array<string | false | undefined>) => values.filter(Boolean).join(" ");

const splitWords = (text: string): string[] => text.match(/\S+\s*/g) ?? [];

const trimWord = (word: string): string => word.trim();

/** Paragraph text with the ghost run excluded. */
function readEditableText(element: HTMLElement): string {
  let text = "";
  element.childNodes.forEach((node) => {
    const isGhost = node instanceof HTMLElement && node.dataset.ghost !== undefined;
    if (!isGhost) text += node.textContent ?? "";
  });
  return text;
}

/** Character offset of a DOM point inside the editable paragraph. */
function offsetIn(root: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(node, offset);
  return range.toString().length;
}

function restoreSelection(element: HTMLElement, start: number, end: number = start): void {
  const selection = window.getSelection();
  if (!selection) return;
  const first = element.firstChild;
  const textNode = first && first.nodeType === Node.TEXT_NODE ? (first as Text) : null;
  const range = document.createRange();
  if (textNode) {
    const length = textNode.textContent?.length ?? 0;
    range.setStart(textNode, Math.min(start, length));
    range.setEnd(textNode, Math.min(end, length));
  } else {
    range.selectNodeContents(element);
    range.collapse(start === 0);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Grow a selection outward to word edges, then trim whitespace off both ends. */
function expandToWords(text: string, start: number, end: number): [number, number] {
  let from = start;
  let to = end;
  while (from > 0 && /\S/.test(text[from - 1]) && /\S/.test(text[from] ?? " ")) from--;
  while (to < text.length && /\S/.test(text[to]) && to > 0 && /\S/.test(text[to - 1])) to++;
  while (from < to && /\s/.test(text[from])) from++;
  while (to > from && /\s/.test(text[to - 1])) to--;
  return [from, to];
}

/** The sentence around a collapsed caret. */
function sentenceAt(text: string, caret: number): [number, number] {
  const pattern = /[^.!?]+[.!?]*["”)]?\s*/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (caret <= match.index + match[0].length) {
      return expandToWords(text, match.index, match.index + match[0].length);
    }
  }
  return expandToWords(text, 0, text.length);
}

/* ---------------------------------------------------------------------------------------------- */
/* Word diff                                                                                       */
/* ---------------------------------------------------------------------------------------------- */

type DiffType = "equal" | "insert" | "delete" | "pending";

interface DiffOp {
  type: DiffType;
  text: string;
  a?: number;
  b?: number;
  hunk?: number;
}

/**
 * Word-level diff. While streaming, equal runs that sit between changes are re-tagged as changes so
 * a re-worded sentence reads as one hunk instead of alternating insert/delete confetti; whatever is
 * left of the tail becomes `pending` (removed, not yet decided).
 */
function diffWords(before: string, after: string, streaming: boolean): DiffOp[] {
  const left = splitWords(before);
  const right = splitWords(after);
  const n = left.length;
  const m = right.length;

  const table = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] =
        trimWord(left[i]) === trimWord(right[j])
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  let ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && trimWord(left[i]) === trimWord(right[j])) {
      ops.push({ type: "equal", text: left[i], a: i++, b: j++ });
      continue;
    }
    if (i < n && (j >= m || table[i + 1][j] >= table[i][j + 1])) {
      ops.push({ type: "delete", text: left[i], a: i++ });
    } else {
      ops.push({ type: "insert", text: right[j], b: j++ });
    }
  }

  if (streaming) {
    for (let pass = 0; pass < 4; pass++) {
      const lastEqual = ops.findLastIndex((op) => op.type === "equal");
      if (lastEqual < 0) break;
      let start = lastEqual;
      while (start > 0 && ops[start - 1].type === "equal") start--;
      let deletes = 0;
      for (let k = start - 1; k >= 0 && ops[k].type !== "equal"; k--) {
        if (ops[k].type === "delete") deletes++;
      }
      const run = ops.slice(start, lastEqual + 1);
      const tiny = run.length === 1 && trimWord(run[0].text).length <= 4;
      const thin = run.length <= 2 && deletes >= 6;
      if (!(tiny || thin) || deletes < 3) break;
      const words = splitWords(after);
      ops = [
        ...ops.slice(0, start),
        ...run.flatMap((op): DiffOp[] => [
          { type: "delete", text: op.text, a: op.a },
          { type: "insert", text: words[op.b ?? -1] ?? op.text, b: op.b },
        ]),
        ...ops.slice(lastEqual + 1),
      ];
    }
    const lastEqual = ops.findLastIndex((op) => op.type === "equal");
    const head = ops.slice(0, lastEqual + 1);
    const tail = ops.slice(lastEqual + 1);
    ops = [
      ...head,
      ...tail.filter((op) => op.type === "insert"),
      ...tail.filter((op) => op.type === "delete").map((op): DiffOp => ({ ...op, type: "pending" })),
    ];
  }

  let hunk = -1;
  let open = false;
  for (const op of ops) {
    if (op.type === "delete" || op.type === "insert") {
      if (!open) {
        hunk++;
        open = true;
      }
      op.hunk = hunk;
    } else {
      open = false;
    }
  }

  return ops;
}

/* ---------------------------------------------------------------------------------------------- */
/* Streaming reveal                                                                                */
/* ---------------------------------------------------------------------------------------------- */

function visibleLength(text: string, position: number, streaming: boolean): number {
  if (position >= text.length && !streaming) return text.length;
  let index = Math.min(Math.floor(position), text.length);
  if (index < text.length && /\s/.test(text[index])) return index;
  while (index > 0 && !/\s/.test(text[index - 1])) index--;
  return index;
}

interface RevealOptions {
  streaming: boolean;
  pace?: number;
  enabled?: boolean;
}

/**
 * Reveals `text` on a rAF clock. The rate follows the measured arrival rate of new characters (with
 * a floor so a burst still reads as typing) and is clamped while streaming so the tail never races
 * ahead of the chunks that are still arriving.
 */
function useRevealedText(
  text: string,
  { streaming, pace = 70, enabled = true }: RevealOptions,
): { text: string; revealing: boolean } {
  const [count, setCount] = useState(() => (streaming ? 0 : text.length));
  const [lastText, setLastText] = useState(text);

  let current = count;
  if (lastText !== text) {
    setLastText(text);
    if (!text.startsWith(lastText)) {
      current = 0;
      setCount(0);
    }
  }

  const countRef = useRef(current);
  const textRef = useRef(text);
  const arrivals = useRef<Array<[number, number]>>([]);
  const rateRef = useRef(0);

  useEffect(() => {
    const now = performance.now();
    if (!text.startsWith(textRef.current)) {
      countRef.current = 0;
      arrivals.current = [];
    }
    textRef.current = text;

    const log = arrivals.current;
    log.push([now, text.length]);
    while (log.length > 2 && now - log[1][0] > 1500) log.shift();

    if (!enabled) {
      countRef.current = text.length;
      return;
    }

    let frame = 0;
    let last = now;
    let shown = -1;

    const step = (time: number) => {
      const delta = Math.min(0.05, Math.max(0, (time - last) / 1000));
      last = time;

      const remaining = text.length - countRef.current;
      if (remaining > 0) {
        const first = log[0];
        const newest = log[log.length - 1];
        const span = (newest[0] - first[0]) / 1000;
        const measured = log.length > 1 && span > 0.2 ? Math.max(12, (newest[1] - first[1]) / span) : pace;
        const target = streaming
          ? measured * Math.min(2.5, Math.max(0.45, remaining / Math.max(1, 0.5 * measured)))
          : Math.max(1.5 * pace, remaining / 0.4);
        rateRef.current = rateRef.current
          ? rateRef.current + (target - rateRef.current) * Math.min(1, delta * (streaming ? 5 : 12))
          : target;
        countRef.current = Math.min(text.length, countRef.current + rateRef.current * delta);
      }

      const next = visibleLength(text, countRef.current, streaming);
      if (next !== shown) {
        shown = next;
        setCount(next);
      }
      if (countRef.current < text.length) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [text, streaming, enabled, pace]);

  const shownText = enabled ? text.slice(0, Math.min(current, text.length)) : text;
  return { text: shownText, revealing: shownText.length < text.length };
}

/* ---------------------------------------------------------------------------------------------- */
/* Small pieces                                                                                    */
/* ---------------------------------------------------------------------------------------------- */

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={styles.kbd}>{children}</kbd>;
}

type Choice = "accepted" | "rejected";

interface DiffBodyProps {
  ops: DiffOp[];
  phase: "streaming" | "review";
  decisions: Record<number, Choice>;
  reduced: boolean;
  onDecide: (hunk: number, choice: Choice) => void;
}

/** The rewrite inside the paragraph: live diff while streaming, tabbable hunks while reviewing. */
function DiffBody({ ops, phase, decisions, reduced, onDecide }: DiffBodyProps) {
  if (phase !== "review") {
    return (
      <>
        {ops.map((op) => {
          const key = op.type === "insert" ? `b${op.b}` : `a${op.a}`;
          if (op.type === "insert") {
            return (
              <ins key={key} className={cx(styles.ins, !reduced && styles.insEnter)}>
                {op.text}
              </ins>
            );
          }
          if (op.type === "delete") {
            return (
              <del key={key} className={cx(styles.del, !reduced && styles.delEnter)}>
                {op.text}
              </del>
            );
          }
          return (
            <span key={key} className={op.type === "pending" ? styles.pending : undefined}>
              {op.text}
            </span>
          );
        })}
      </>
    );
  }

  const nodes: ReactNode[] = [];
  let index = 0;
  while (index < ops.length) {
    const op = ops[index];
    if (op.hunk === undefined) {
      nodes.push(<span key={`a${op.a}`}>{op.text}</span>);
      index++;
      continue;
    }

    const hunk = op.hunk;
    const run: DiffOp[] = [];
    while (index < ops.length && ops[index].hunk === hunk) run.push(ops[index++]);

    const choice = decisions[hunk];
    const removed = run
      .filter((entry) => entry.type === "delete")
      .map((entry) => entry.text)
      .join("");
    const added = run
      .filter((entry) => entry.type === "insert")
      .map((entry) => entry.text)
      .join("");

    if (choice) {
      nodes.push(
        <span key={`h${hunk}`} className={styles.resolved} data-choice={choice}>
          {choice === "accepted" ? added : removed}
        </span>,
      );
      continue;
    }

    const description =
      removed && added
        ? `Change "${removed.trim()}" to "${added.trim()}"`
        : removed
          ? `Remove "${removed.trim()}"`
          : `Add "${added.trim()}"`;

    nodes.push(
      <span
        key={`h${hunk}`}
        className={styles.hunk}
        tabIndex={0}
        role="group"
        aria-label={`${description}. Enter accepts, Backspace rejects.`}
        data-hunk={hunk}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
            event.preventDefault();
            onDecide(hunk, "accepted");
          }
          if (event.key === "Backspace" || event.key === "Delete") {
            event.preventDefault();
            onDecide(hunk, "rejected");
          }
        }}
      >
        {removed ? <del className={styles.del}>{removed}</del> : null}
        {added ? <ins className={styles.ins}>{added}</ins> : null}
        <span className={styles.hunkBar} contentEditable={false}>
          <button
            type="button"
            tabIndex={-1}
            className={styles.hunkButton}
            aria-label="Accept change"
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => onDecide(hunk, "accepted")}
          >
            <Check />
          </button>
          <button
            type="button"
            tabIndex={-1}
            className={styles.hunkButton}
            aria-label="Reject change"
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => onDecide(hunk, "rejected")}
          >
            <X />
          </button>
        </span>
      </span>,
    );
  }

  return <>{nodes}</>;
}

interface MenuEntry {
  key: string;
  label: ReactNode;
  icon: IconComponent;
  run: () => void;
}

interface PromptLayerProps {
  actions: EditAction[];
  mac: boolean;
  onRun: (instruction: string, action?: EditAction) => void;
  onClose: () => void;
}

/** ⌘K prompt: free-text instruction plus the action list, driven from the one input. */
function PromptLayer({ actions, mac, onRun, onClose }: PromptLayerProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? actions.filter(
        (action) =>
          action.label.toLowerCase().includes(needle) || action.id.includes(needle),
      )
    : actions;

  const entries: MenuEntry[] = [
    ...(needle
      ? [
          {
            key: "custom",
            label: (
              <>
                <span className={styles.muted}>Ask </span>
                {query.trim()}
              </>
            ),
            icon: CornerDownLeft,
            run: () => onRun(query.trim()),
          },
        ]
      : []),
    ...matches.map((action) => ({
      key: action.id,
      label: action.label,
      icon: ACTION_ICONS[action.id] ?? Sparkles,
      run: () => onRun(action.instruction, action),
    })),
  ];

  const index = Math.min(active, entries.length - 1);

  return (
    <div className={styles.prompt}>
      <div className={styles.promptRow}>
        <Sparkles className={styles.promptIcon} aria-hidden="true" />
        <input
          ref={inputRef}
          className={styles.promptInput}
          value={query}
          placeholder="Ask AI to edit the selection"
          aria-label="Edit instruction"
          role="combobox"
          aria-expanded="true"
          aria-controls="ai-edit-actions"
          aria-activedescendant={entries[index] ? `ai-edit-${entries[index].key}` : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index + 1) % entries.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index - 1 + entries.length) % entries.length);
            } else if (event.key === "Enter") {
              event.preventDefault();
              entries[index]?.run();
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            } else if (event.key === "Tab") {
              event.preventDefault();
            }
          }}
        />
        <Kbd>esc</Kbd>
      </div>
      <ul className={styles.menu} role="listbox" id="ai-edit-actions" aria-label="Quick edits">
        {entries.map((entry, position) => {
          const Icon = entry.icon;
          return (
            <li
              key={entry.key}
              id={`ai-edit-${entry.key}`}
              role="option"
              aria-selected={position === index}
              className={styles.menuItem}
              data-active={position === index || undefined}
              onPointerMove={() => setActive(position)}
              onPointerDown={(event) => event.preventDefault()}
              onClick={entry.run}
            >
              {position === index ? (
                <motion.span
                  layoutId="ai-edit-highlight"
                  className={styles.menuHighlight}
                  transition={motionTokens.spring.snappy}
                />
              ) : null}
              <Icon className={styles.menuIcon} aria-hidden="true" />
              <span className={styles.menuLabel}>{entry.label}</span>
              {position === index ? (
                <CornerDownLeft className={styles.menuEnter} aria-hidden="true" />
              ) : null}
            </li>
          );
        })}
        {entries.length === 0 ? <li className={styles.menuEmpty}>Type an instruction</li> : null}
      </ul>
      <p className={styles.promptHint}>
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd> to choose, <Kbd>↵</Kbd> to run. {mac ? "⌘K" : "Ctrl K"} opens this on any
        selection.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------- */
/* Editable paragraph                                                                              */
/* ---------------------------------------------------------------------------------------------- */

interface ParagraphModel {
  id: number;
  text: string;
  /** Bumped whenever the text is replaced from outside, so the DOM node remounts. */
  v: number;
}

interface ParagraphHandlers {
  input: (id: number, element: HTMLElement) => void;
  beforeInput: (id: number, event: InputEvent) => void;
  keyDown: (id: number, event: ReactKeyboardEvent<HTMLParagraphElement>) => void;
  caret: (id: number) => void;
  blur: (id: number) => void;
}

const Paragraph = memo(
  function Paragraph({
    para,
    handlers,
  }: {
    para: ParagraphModel;
    handlers: RefObject<ParagraphHandlers | null>;
  }) {
    const [text] = useState(para.text);
    return (
      <p
        data-para={para.id}
        className={styles.para}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        data-placeholder={text ? undefined : "Write, or press ⌘K to ask AI"}
        onInput={(event) => handlers.current?.input(para.id, event.currentTarget)}
        onKeyDown={(event) => handlers.current?.keyDown(para.id, event)}
        onBeforeInput={(event) =>
          handlers.current?.beforeInput(para.id, event.nativeEvent as InputEvent)
        }
        onPaste={(event) => {
          event.preventDefault();
          document.execCommand(
            "insertText",
            false,
            event.clipboardData.getData("text/plain").replace(/\s*\n\s*/g, " "),
          );
        }}
        onKeyUp={() => handlers.current?.caret(para.id)}
        onPointerUp={() => handlers.current?.caret(para.id)}
        onBlur={() => handlers.current?.blur(para.id)}
      >
        {text}
      </p>
    );
  },
  (previous, next) => previous.para.id === next.para.id && previous.para.v === next.para.v,
);

/* ---------------------------------------------------------------------------------------------- */
/* The block                                                                                       */
/* ---------------------------------------------------------------------------------------------- */

const subscribeNoop = () => () => {};

type OverlayMode = "prompt" | "streaming" | "review" | "empty" | "error" | "applied";

interface Session {
  para: number;
  start: number;
  end: number;
  original: string;
  phase: "prompt" | "streaming" | "review" | "error";
  instruction: string;
  action?: string;
  label: string;
  suggestion: string;
  received: boolean;
  stopped: boolean;
  decisions: Record<number, Choice>;
  error?: string;
}

interface LayerBox {
  top: number;
  left: number;
  room: number;
}

interface GhostRun {
  para: number;
  el: HTMLSpanElement;
  text: string;
}

interface AppliedToast {
  applied: number;
  total: number;
}

export function AiInlineEdit({
  defaultDocument = SAMPLE_DOCUMENT,
  onRequestEdit = defaultRequestEdit,
  onSuggest = defaultSuggest,
  actions = DEFAULT_ACTIONS,
  onChange,
  author = SAMPLE_AUTHOR,
  className,
}: AiInlineEditProps) {
  const reduced = !!useReducedMotion();
  const mac = useSyncExternalStore(
    subscribeNoop,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => true,
  );

  const [title] = useState(defaultDocument.title);
  const [paragraphs, setParagraphs] = useState<ParagraphModel[]>(() =>
    defaultDocument.paragraphs.map((text, index) => ({ id: index + 1, text, v: 0 })),
  );
  const nextId = useRef(defaultDocument.paragraphs.length + 1);
  const paragraphsRef = useRef(paragraphs);
  useLayoutEffect(() => {
    paragraphsRef.current = paragraphs;
  });

  const [history, setHistory] = useState<string[][]>([]);
  const [redo, setRedo] = useState<string[][]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef(session);
  useLayoutEffect(() => {
    sessionRef.current = session;
  });

  const [applied, setApplied] = useState<AppliedToast | null>(null);
  const [bubble, setBubble] = useState<{ top: number; left: number } | null>(null);
  const [ghostOpen, setGhostOpen] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [caretTarget, setCaretTarget] = useState<{ id: number; start: number; end: number } | null>(
    null,
  );
  const [layerBox, setLayerBox] = useState<LayerBox | null>(null);

  const hostRef = useRef<HTMLElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [layerElement, setLayerElement] = useState<HTMLDivElement | null>(null);
  const selectGuard = useRef(false);
  const saveTimer = useRef(0);
  const toastTimer = useRef(0);
  const suggestTimer = useRef(0);
  const editController = useRef<AbortController | null>(null);
  const suggestController = useRef<AbortController | null>(null);
  const ghost = useRef<GhostRun | null>(null);

  const callbacks = useRef({ onRequestEdit, onSuggest, onChange });
  useEffect(() => {
    callbacks.current = { onRequestEdit, onSuggest, onChange };
  });

  useEffect(
    () => () => {
      window.clearTimeout(saveTimer.current);
      window.clearTimeout(toastTimer.current);
      window.clearTimeout(suggestTimer.current);
      editController.current?.abort();
      suggestController.current?.abort();
    },
    [],
  );

  const snapshot = (list: ParagraphModel[]): EditDocument => ({
    title,
    paragraphs: list.map((entry) => entry.text),
  });

  const queueSave = useCallback((list: ParagraphModel[]) => {
    setSaveState("saving");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      setSaveState("saved");
      callbacks.current.onChange?.(snapshot(list));
    }, 700);
  }, [title]);

  const streaming = session?.phase === "streaming";

  const reveal = useRevealedText(session?.suggestion ?? "", {
    streaming: !!(streaming && !session?.received),
    enabled: !!(session && !session.stopped),
  });

  const revealed = reveal.text;
  const revealedRef = useRef("");
  useEffect(() => {
    revealedRef.current = revealed;
  }, [revealed]);

  const ops = useMemo(
    () =>
      session && session.phase !== "prompt" && !session.error
        ? diffWords(session.original, revealed, session.phase === "streaming")
        : null,
    [session, revealed],
  );

  const hunkCount = useMemo(
    () => (ops ? new Set(ops.filter((op) => op.hunk !== undefined).map((op) => op.hunk)).size : 0),
    [ops],
  );

  const readyForReview = session?.phase === "streaming" && session.received && !reveal.revealing;

  /* Ghost run -------------------------------------------------------------------------------- */

  const clearGhost = useCallback(() => {
    window.clearTimeout(suggestTimer.current);
    suggestController.current?.abort();
    if (ghost.current) {
      ghost.current.el.remove();
      ghost.current = null;
    }
    setGhostOpen(false);
  }, []);

  const paintGhost = useCallback(
    (element: HTMLElement, text: string, animateWords: boolean) => {
      element.textContent = "";
      text.split(/(\s+)/).forEach((token, index) => {
        if (!token) return;
        const span = document.createElement("span");
        span.textContent = token;
        if (animateWords && !reduced) {
          span.className = styles.ghostWord;
          span.style.animationDelay = `${Math.min(18 * index, 360)}ms`;
        }
        element.appendChild(span);
      });
    },
    [reduced],
  );

  const showGhost = useCallback(
    (paraId: number, text: string) => {
      const target = pageRef.current?.querySelector<HTMLElement>(
        `[data-para="${paraId}"][contenteditable]`,
      );
      if (!target) return;
      ghost.current?.el.remove();
      const span = document.createElement("span");
      span.dataset.ghost = "";
      span.contentEditable = "false";
      span.className = styles.ghost;
      span.setAttribute("aria-hidden", "true");
      paintGhost(span, text, true);
      target.appendChild(span);
      ghost.current = { para: paraId, el: span, text };
      setGhostOpen(true);
    },
    [paintGhost],
  );

  /** The paragraph element and its text when the caret sits at the end of a long paragraph. */
  const caretAtEnd = useCallback((paraId: number): { el: HTMLElement; text: string } | null => {
    const target = pageRef.current?.querySelector<HTMLElement>(
      `[data-para="${paraId}"][contenteditable]`,
    );
    const selection = window.getSelection();
    if (!target || !selection || !selection.isCollapsed || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    if (!target.contains(range.startContainer)) return null;
    const text = readEditableText(target);
    const caret = offsetIn(target, range.startContainer, range.startOffset);
    return caret >= text.trimEnd().length && text.trim().length > 8 ? { el: target, text } : null;
  }, []);

  const requestSuggestion = useCallback(
    (paraId: number, delay: number) => {
      window.clearTimeout(suggestTimer.current);
      suggestController.current?.abort();
      if (sessionRef.current) return;
      suggestTimer.current = window.setTimeout(async () => {
        const caret = caretAtEnd(paraId);
        if (!caret || ghost.current) return;
        const controller = new AbortController();
        suggestController.current = controller;
        const index = paragraphsRef.current.findIndex((entry) => entry.id === paraId);
        try {
          const suggestion = await callbacks.current.onSuggest(
            { before: caret.text, paragraph: index, document: snapshot(paragraphsRef.current) },
            controller.signal,
          );
          if (controller.signal.aborted || !suggestion || !caretAtEnd(paraId)) return;
          showGhost(paraId, suggestion);
        } catch {
          /* an aborted or failed suggestion simply offers nothing */
        }
      }, delay);
    },
    [caretAtEnd, showGhost],
  );

  /* Selection -------------------------------------------------------------------------------- */

  const readSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    const startNode =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as Element)
        : range.startContainer.parentElement;
    const paragraph = startNode?.closest("[data-para][contenteditable]");
    const page = pageRef.current;
    if (!paragraph || !page?.contains(paragraph)) return null;

    const id = Number((paragraph as HTMLElement).dataset.para);
    const text = readEditableText(paragraph as HTMLElement);
    let start = offsetIn(paragraph as HTMLElement, range.startContainer, range.startOffset);
    let end = paragraph.contains(range.endContainer)
      ? offsetIn(paragraph as HTMLElement, range.endContainer, range.endOffset)
      : text.length;
    end = Math.min(end, text.length);

    if (range.collapsed) {
      [start, end] = sentenceAt(text, start);
    } else {
      [start, end] = expandToWords(text, start, end);
    }

    if (end <= start) return null;
    return { id, el: paragraph as HTMLElement, start, end, text, collapsed: range.collapsed };
  }, []);

  const measureBubble = useCallback(() => {
    const selection = window.getSelection();
    if (sessionRef.current || !selection || selection.isCollapsed || !selection.rangeCount) {
      setBubble(null);
      return;
    }
    const picked = readSelection();
    const page = pageRef.current;
    if (!picked || picked.collapsed || !page) {
      setBubble(null);
      return;
    }
    const rect = selection.getRangeAt(0).getClientRects()[0];
    if (!rect) {
      setBubble(null);
      return;
    }
    const host = page.getBoundingClientRect();
    setBubble({
      top: rect.top - host.top - 40,
      left: Math.max(0, Math.min(rect.left - host.left, host.width - 132)),
    });
  }, [readSelection]);

  useEffect(() => {
    const onSelectionChange = () => {
      if (!selectGuard.current) measureBubble();
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [measureBubble]);

  /* Session lifecycle ------------------------------------------------------------------------- */

  const openPrompt = useCallback((): boolean => {
    const picked = readSelection();
    if (!picked || sessionRef.current) return false;
    clearGhost();
    const text = picked.text;
    setParagraphs((list) =>
      list.map((entry) => (entry.id === picked.id ? { ...entry, text } : entry)),
    );
    setSession({
      para: picked.id,
      start: picked.start,
      end: picked.end,
      original: text.slice(picked.start, picked.end),
      phase: "prompt",
      instruction: "",
      label: "",
      suggestion: "",
      received: false,
      stopped: false,
      decisions: {},
    });
    setBubble(null);
    setApplied(null);
    window.getSelection()?.removeAllRanges();
    return true;
  }, [clearGhost, readSelection]);

  const closeSession = useCallback(
    (restoreCaret = true) => {
      editController.current?.abort();
      const current = sessionRef.current;
      setSession(null);
      if (current && restoreCaret) {
        setCaretTarget({ id: current.para, start: current.start, end: current.end });
      }
    },
    [],
  );

  const runEdit = useCallback(
    async (instruction: string, action?: EditAction) => {
      const current = sessionRef.current;
      if (!current) return;
      const paragraph = paragraphsRef.current.find((entry) => entry.id === current.para);
      if (!paragraph) return;

      editController.current?.abort();
      const controller = new AbortController();
      editController.current = controller;

      const label = action ? (ACTION_LABELS[action.id] ?? action.label) : "Editing";
      setSession((previous) =>
        previous && {
          ...previous,
          phase: "streaming",
          instruction,
          action: action?.id,
          label,
          suggestion: "",
          received: false,
          stopped: false,
          decisions: {},
          error: undefined,
        },
      );

      const payload: EditRequest = {
        text: current.original,
        instruction,
        action: action?.id,
        before: paragraph.text.slice(0, current.start),
        after: paragraph.text.slice(current.start + current.original.length),
        paragraph: paragraphsRef.current.indexOf(paragraph),
      };

      try {
        const stream = callbacks.current.onRequestEdit(payload, controller.signal);
        if (typeof (stream as Promise<string>).then === "function") {
          const whole = await (stream as Promise<string>);
          if (controller.signal.aborted) return;
          setSession((previous) => previous && { ...previous, suggestion: whole, received: true });
          return;
        }
        for await (const chunk of stream as AsyncIterable<string>) {
          if (controller.signal.aborted) return;
          setSession((previous) => previous && { ...previous, suggestion: previous.suggestion + chunk });
        }
        if (controller.signal.aborted) return;
        setSession((previous) => previous && { ...previous, received: true });
      } catch (error) {
        if (controller.signal.aborted) return;
        setSession(
          (previous) =>
            previous && {
              ...previous,
              phase: "error",
              error: error instanceof Error ? error.message : "The edit failed",
            },
        );
      }
    },
    [],
  );

  const stopStream = useCallback(() => {
    editController.current?.abort();
    setSession(
      (previous) =>
        previous && {
          ...previous,
          suggestion: revealedRef.current,
          received: true,
          stopped: true,
        },
    );
  }, []);

  useEffect(() => {
    if (!readyForReview) return;
    const timer = window.setTimeout(() => {
      setSession((previous) =>
        previous && previous.phase === "streaming" ? { ...previous, phase: "review" } : previous,
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [readyForReview]);

  /* Applying --------------------------------------------------------------------------------- */

  const commit = useCallback(
    (decisions: Record<number, Choice>) => {
      const current = sessionRef.current;
      if (!current || !ops) return;

      const text = ops
        .map((op) => {
          if (op.type === "equal" || op.type === "pending") return op.text;
          const choice = decisions[op.hunk ?? -1] ?? "rejected";
          if (op.type === "delete") return choice === "rejected" ? op.text : "";
          return choice === "accepted" ? op.text : "";
        })
        .join("");

      const total = Object.keys(decisions).length;
      const accepted = Object.values(decisions).filter((value) => value === "accepted").length;
      const before = paragraphsRef.current;
      const after = before.map((entry) =>
        entry.id === current.para
          ? {
              ...entry,
              text: entry.text.slice(0, current.start) + text + entry.text.slice(current.end),
              v: entry.v + 1,
            }
          : entry,
      );

      if (accepted) {
        setHistory((entries) => [...entries, before.map((entry) => entry.text)]);
        setRedo([]);
        setParagraphs(after);
        queueSave(after);
      }

      setSession(null);
      setApplied({ applied: accepted, total });
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setApplied(null), 4200);
      setCaretTarget({ id: current.para, start: current.start + text.length, end: current.start + text.length });
    },
    [ops, queueSave],
  );

  const decide = useCallback(
    (hunk: number, choice: Choice) => {
      const current = sessionRef.current;
      if (!current) return;
      const decisions = { ...current.decisions, [hunk]: choice };
      setSession({ ...current, decisions });
      if (Object.keys(decisions).length >= hunkCount) {
        window.setTimeout(() => commit(decisions), 320 * (reduced ? 0 : 1));
        return;
      }
      requestAnimationFrame(() => {
        const next = pageRef.current?.querySelector<HTMLElement>(
          `[data-hunk]:not([data-hunk="${hunk}"])`,
        );
        if (document.activeElement?.closest("[data-hunk]")) next?.focus({ preventScroll: false });
      });
    },
    [commit, hunkCount, reduced],
  );

  const resolveAll = useCallback(
    (choice: Choice) => {
      if (!ops) return;
      const decisions: Record<number, Choice> = {};
      for (let index = 0; index < hunkCount; index++) {
        decisions[index] = sessionRef.current?.decisions[index] ?? choice;
      }
      commit(decisions);
    },
    [commit, hunkCount, ops],
  );

  /* History ---------------------------------------------------------------------------------- */

  const replaceAll = useCallback(
    (texts: string[]) => {
      setParagraphs((list) => {
        const next = texts.map((text, index) =>
          list[index]
            ? {
                ...list[index],
                text,
                v: list[index].text === text ? list[index].v : list[index].v + 1,
              }
            : { id: nextId.current++, text, v: 0 },
        );
        queueSave(next);
        return next;
      });
    },
    [queueSave],
  );

  const undo = useCallback(() => {
    if (!history.length || sessionRef.current) return;
    clearGhost();
    setRedo((entries) => [...entries, paragraphsRef.current.map((entry) => entry.text)]);
    replaceAll(history[history.length - 1]);
    setHistory((entries) => entries.slice(0, -1));
    setApplied(null);
  }, [clearGhost, history, replaceAll]);

  const redoEdit = useCallback(() => {
    if (!redo.length || sessionRef.current) return;
    setHistory((entries) => [...entries, paragraphsRef.current.map((entry) => entry.text)]);
    replaceAll(redo[redo.length - 1]);
    setRedo((entries) => entries.slice(0, -1));
  }, [redo, replaceAll]);

  /* Caret restore ---------------------------------------------------------------------------- */

  useLayoutEffect(() => {
    if (!caretTarget) return;
    const target = pageRef.current?.querySelector<HTMLElement>(
      `[data-para="${caretTarget.id}"][contenteditable]`,
    );
    if (!target) return;
    target.focus({ preventScroll: true });
    restoreSelection(target, caretTarget.start, caretTarget.end);
    const timer = window.setTimeout(() => setCaretTarget(null), 0);
    return () => window.clearTimeout(timer);
  }, [caretTarget, paragraphs, session]);

  /* Layer placement -------------------------------------------------------------------------- */

  useLayoutEffect(() => {
    const host = pageRef.current;
    if (!host) return;

    const measure = () => {
      const region = host.querySelector<HTMLElement>("[data-region]");
      if (!region) {
        if (!sessionRef.current && !applied) setLayerBox(null);
        return;
      }
      const rects = Array.from(region.getClientRects()).filter((rect) => rect.width > 0);
      if (!rects.length) return;
      const hostRect = host.getBoundingClientRect();
      const last = rects[rects.length - 1];
      const first = rects[0];
      const width = layerElement ? layerElement.offsetWidth + 2 : 320;
      const left = Math.max(
        0,
        Math.min(
          (rects.length > 1 ? Math.min(...rects.map((rect) => rect.left)) : first.left) -
            hostRect.left,
          hostRect.width - width,
        ),
      );
      const top = last.bottom - hostRect.top + 10;
      const room = hostRect.width;
      setLayerBox((previous) =>
        previous && previous.top === top && previous.left === left && previous.room === room
          ? previous
          : { top, left, room },
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [session, ops, applied, caretTarget, layerElement]);

  const overlayMode: OverlayMode | null = session
    ? session.phase === "review" && hunkCount === 0
      ? "empty"
      : session.phase
    : applied
      ? "applied"
      : null;

  useEffect(() => {
    if (!overlayMode || !layerRef.current || !scrollerRef.current) return;
    const timer = window.setTimeout(() => {
      const layer = layerRef.current?.getBoundingClientRect();
      const scroller = scrollerRef.current?.getBoundingClientRect();
      if (!layer || !scroller || !layerRef.current) return;
      if (layer.bottom > scroller.bottom - 12) {
        scrollerRef.current?.scrollBy({
          top: layer.bottom - scroller.bottom + 24,
          behavior: reduced ? "auto" : "smooth",
        });
      }
    }, 60);
    return () => window.clearTimeout(timer);
  }, [overlayMode, layerBox?.top, reduced]);

  const layerWidth = useMotionValue(0);
  const layerHeight = useMotionValue(0);

  useLayoutEffect(() => {
    const element = layerElement;
    if (!overlayMode || !element) return;
    let first = true;
    let controls: Array<{ stop: () => void }> = [];
    const measure = () => {
      const width = element.offsetWidth + 2;
      const height = element.offsetHeight + 2;
      // The layer is clipped to its own animated box, so a measurement taken before the inner body
      // has laid out would lock it at nothing. Skip until the inner box actually has a size.
      if (width <= 2 || height <= 2) return;
      controls.forEach((control) => control.stop());
      if (first || reduced) {
        layerWidth.set(width);
        layerHeight.set(height);
        controls = [];
      } else {
        controls = [
          animate(layerWidth, width, motionTokens.spring.smooth),
          animate(layerHeight, height, motionTokens.spring.smooth),
        ];
      }
      first = false;
    };
    measure();
    // One paint later the inner body has its real box; ResizeObserver alone can miss the first one.
    const frame = requestAnimationFrame(() => requestAnimationFrame(measure));
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.forEach((control) => control.stop());
    };
  }, [overlayMode, layerElement, reduced, layerWidth, layerHeight]);

  /* Paragraph handlers ----------------------------------------------------------------------- */

  const handlers = useRef<ParagraphHandlers | null>(null);
  handlers.current = {
    input: (id, element) => {
      const text = readEditableText(element);
      setParagraphs((list) => {
        const next = list.map((entry) => (entry.id === id ? { ...entry, text } : entry));
        queueSave(next);
        return next;
      });
      if (!ghost.current || ghost.current.para !== id) requestSuggestion(id, 650);
      setBubble(null);
    },

    beforeInput: (id, event) => {
      const run = ghost.current;
      if (!run || run.para !== id) return;
      if (event.inputType === "insertText" && event.data && run.text.startsWith(event.data)) {
        run.text = run.text.slice(event.data.length);
        if (run.text.trim()) paintGhost(run.el, run.text, false);
        else clearGhost();
      } else {
        clearGhost();
      }
    },

    keyDown: (id, event) => {
      const element = event.currentTarget;

      if (event.key === "Tab" && ghost.current?.para === id) {
        event.preventDefault();
        const run = ghost.current;
        if (!run) return;
        run.el.remove();
        ghost.current = null;
        setGhostOpen(false);
        const end = readEditableText(element).length;
        restoreSelection(element, end);
        document.execCommand("insertText", false, run.text);

        const textNode = element.firstChild;
        if (!reduced && textNode && "highlights" in CSS) {
          const registry = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
          const HighlightCtor = (globalThis as unknown as { Highlight?: new (range: Range) => unknown })
            .Highlight;
          if (registry && HighlightCtor) {
            const range = document.createRange();
            range.setStart(textNode, Math.min(end, textNode.textContent?.length ?? 0));
            range.setEnd(textNode, textNode.textContent?.length ?? 0);
            registry.set("ai-accepted", new HighlightCtor(range));
            window.setTimeout(() => registry.delete("ai-accepted"), 900);
          }
        }
        return;
      }

      if (event.key === "Escape" && ghost.current) {
        event.preventDefault();
        clearGhost();
        return;
      }

      if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        clearGhost();
        const selection = window.getSelection();
        if (!selection?.rangeCount) return;
        const text = readEditableText(element);
        const range = selection.getRangeAt(0);
        const start = offsetIn(element, range.startContainer, range.startOffset);
        const end = offsetIn(element, range.endContainer, range.endOffset);
        const added: ParagraphModel = { id: nextId.current++, text: text.slice(end).trimStart(), v: 0 };
        setParagraphs((list) => {
          const index = list.findIndex((entry) => entry.id === id);
          const next = [...list];
          next.splice(
            index,
            1,
            { ...list[index], text: text.slice(0, start).trimEnd(), v: list[index].v + 1 },
            added,
          );
          queueSave(next);
          return next;
        });
        setCaretTarget({ id: added.id, start: 0, end: 0 });
        return;
      }

      if (event.key === "Backspace") {
        const selection = window.getSelection();
        if (!selection?.isCollapsed || !selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        if (offsetIn(element, range.startContainer, range.startOffset) !== 0) return;
        const previous = paragraphsRef.current;
        const index = previous.findIndex((entry) => entry.id === id);
        if (index <= 0) return;
        event.preventDefault();
        clearGhost();
        const before = previous[index - 1];
        const text = readEditableText(element);
        const join = before.text && text && !/\s$/.test(before.text) ? " " : "";
        const next = previous
          .filter((entry) => entry.id !== id)
          .map((entry) =>
            entry.id === before.id
              ? { ...entry, text: before.text + join + text, v: entry.v + 1 }
              : entry,
          );
        setParagraphs(next);
        queueSave(next);
        setCaretTarget({ id: before.id, start: before.text.length + join.length, end: before.text.length + join.length });
      }
    },

    caret: (id) => {
      selectGuard.current = false;
      measureBubble();
      if (!ghost.current) requestSuggestion(id, 380);
    },

    blur: () => {
      clearGhost();
    },
  };

  /* Render ----------------------------------------------------------------------------------- */

  const wordCount = paragraphs.reduce(
    (total, entry) => total + (entry.text.trim() ? entry.text.trim().split(/\s+/).length : 0),
    0,
  );

  const hint =
    session?.phase === "review" ? (
      <>
        Tab through changes, <Kbd>↵</Kbd> accept, <Kbd>⌫</Kbd> reject
      </>
    ) : ghostOpen ? (
      <>
        <Kbd>Tab</Kbd> to accept, <Kbd>esc</Kbd> to dismiss
      </>
    ) : (
      <>
        Select text and press <Kbd>{mac ? "⌘K" : "Ctrl K"}</Kbd> to edit with AI
      </>
    );

  const layerTransition = reduced ? { duration: 0 } : motionTokens.spring.smooth;

  /**
   * Shortcuts live on the document: focus leaves the editor the moment the prompt layer owns it, so
   * the section alone would stop hearing ⌘↵ / Escape once the instruction input unmounts.
   */
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const command = event.metaKey || event.ctrlKey;
      const active = sessionRef.current;

      if (command && event.key.toLowerCase() === "k") {
        event.preventDefault();
        event.stopPropagation();
        if (active?.phase === "prompt") closeSession();
        else if (!active) openPrompt();
        return;
      }

      if (active?.phase === "review") {
        if (command && event.key === "Enter") {
          event.preventDefault();
          resolveAll("accepted");
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          resolveAll("rejected");
          return;
        }
        return;
      }

      if (active?.phase === "streaming" && event.key === "Escape") {
        event.preventDefault();
        stopStream();
        return;
      }

      if (active?.phase === "error" && event.key === "Escape") {
        event.preventDefault();
        closeSession();
        return;
      }

      const editable = event.target instanceof HTMLElement && event.target.isContentEditable;
      if (command && event.key.toLowerCase() === "z" && !editable) {
        event.preventDefault();
        if (event.shiftKey) redoEdit();
        else undo();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  const onSectionPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    selectGuard.current = true;
    if (session?.phase === "prompt" && !layerRef.current?.contains(event.target as Node)) {
      closeSession(false);
    }
  };

  const onSectionPointerUp = () => {
    selectGuard.current = false;
    window.setTimeout(measureBubble, 0);
  };

  const selectParagraph = (event: ReactMouseEvent<HTMLParagraphElement>) => {
    event.currentTarget.focus();
  };

  return (
    <section
      ref={hostRef}
      className={cx(styles.root, className)}
      aria-label={`${title}, editor`}
      onPointerDown={onSectionPointerDown}
      onPointerUp={onSectionPointerUp}
    >
      <header className={styles.header}>
        <div className={styles.docMeta}>
          <img className={styles.avatar} src={author.photo} alt="" width={28} height={28} />
          <div className={styles.docText}>
            <span className={styles.docTitle}>{title}</span>
            <span className={styles.docSub}>
              {author.name}
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.swap} aria-live="polite">
                <span
                  data-on={saveState === "saving" || undefined}
                  aria-hidden={saveState !== "saving" || undefined}
                >
                  Saving
                </span>
                <span
                  data-on={saveState === "saved" || undefined}
                  aria-hidden={saveState !== "saved" || undefined}
                >
                  Saved
                </span>
              </span>
            </span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={undo}
            disabled={!history.length || !!session}
            aria-label="Undo AI edit"
            title={`Undo AI edit (${mac ? "⌘Z" : "Ctrl Z"})`}
          >
            <Undo2 />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={redoEdit}
            disabled={!redo.length || !!session}
            aria-label="Redo AI edit"
            title="Redo AI edit"
          >
            <Redo2 />
          </button>
        </div>
      </header>

      <div ref={scrollerRef} className={styles.scroller}>
        <div ref={pageRef} className={styles.page}>
          <h1 className={styles.title}>{title}</h1>

          {paragraphs.map((entry) => {
            if (session?.para !== entry.id) {
              return <Paragraph key={`${entry.id}-${entry.v}`} para={entry} handlers={handlers} />;
            }
            const diffPhase =
              session.phase === "streaming" || session.phase === "review"
                ? session.phase
                : null;
            const head = entry.text.slice(0, session.start);
            const tail = entry.text.slice(session.end);
            return (
              <p
                key={`${entry.id}-session`}
                data-para={entry.id}
                className={cx(styles.para, styles.sessionPara)}
              >
                {head}
                <span
                  data-region
                  className={styles.region}
                  data-phase={session.phase}
                >
                  {diffPhase && ops ? (
                    <DiffBody
                      ops={ops}
                      phase={diffPhase}
                      decisions={session.decisions}
                      reduced={reduced}
                      onDecide={decide}
                    />
                  ) : (
                    <mark className={styles.selected}>{session.original}</mark>
                  )}
                </span>
                {tail}
              </p>
            );
          })}

          <AnimatePresence>
            {bubble && !session ? (
              <motion.button
                key="bubble"
                type="button"
                className={styles.bubble}
                style={{ top: bubble.top, left: bubble.left }}
                initial={{ opacity: 0, y: 4 * (reduced ? 0 : 1) }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}
                transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => openPrompt()}
              >
                <Sparkles aria-hidden="true" />
                <span>Edit</span>
                <Kbd>{mac ? "⌘K" : "Ctrl K"}</Kbd>
              </motion.button>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {overlayMode && layerBox ? (
              <motion.div
                key="layer"
                ref={layerRef}
                className={styles.layer}
                data-mode={overlayMode}
                role="dialog"
                aria-label="Edit with AI"
                initial={{
                  opacity: 0,
                  y: reduced ? 0 : -4,
                  top: layerBox.top,
                  left: layerBox.left,
                  borderRadius: overlayMode === "prompt" ? 18 : 14,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  top: layerBox.top,
                  left: layerBox.left,
                  borderRadius: overlayMode === "prompt" ? 18 : 14,
                }}
                exit={{
                  opacity: 0,
                  y: reduced ? 0 : -4,
                  transition: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.exit] },
                }}
                transition={layerTransition}
                style={{ width: layerWidth, height: layerHeight }}
              >
                <div
                  ref={setLayerElement}
                  className={styles.layerSize}
                  data-mode={overlayMode}
                  style={{ "--layer-room": `${layerBox.room}px` } as React.CSSProperties}
                >
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.div
                      key={overlayMode}
                      className={styles.layerBody}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: motionTokens.duration.fast,
                        ease: [...motionTokens.ease.standard],
                      }}
                    >
                      {overlayMode === "prompt" ? (
                        <PromptLayer
                          actions={actions}
                          mac={mac}
                          onRun={runEdit}
                          onClose={() => closeSession()}
                        />
                      ) : null}

                      {overlayMode === "streaming" ? (
                        <div className={styles.bar} role="status">
                          <Loader2 className={cx(styles.barIcon, styles.spin)} aria-hidden="true" />
                          <span className={styles.shimmer}>{session?.label}</span>
                          <button type="button" className={styles.barButton} onClick={stopStream}>
                            <Square className={styles.stopGlyph} aria-hidden="true" />
                            Stop
                            <Kbd>esc</Kbd>
                          </button>
                        </div>
                      ) : null}

                      {overlayMode === "review" ? (
                        <div className={styles.bar}>
                          <span className={styles.barLabel}>
                            <span className={styles.tabular}>
                              {hunkCount - Object.keys(session?.decisions ?? {}).length}
                            </span>{" "}
                            of {hunkCount} {hunkCount === 1 ? "change" : "changes"}
                            {session?.stopped ? ", stopped" : ""}
                          </span>
                          <button
                            type="button"
                            className={styles.barButton}
                            onClick={() => resolveAll("rejected")}
                          >
                            Reject all
                          </button>
                          <button
                            type="button"
                            className={cx(styles.barButton, styles.primary)}
                            onClick={() => resolveAll("accepted")}
                          >
                            Accept all
                            <Kbd>{mac ? "⌘↵" : "Ctrl ↵"}</Kbd>
                          </button>
                        </div>
                      ) : null}

                      {overlayMode === "empty" ? (
                        <div className={styles.bar} role="status">
                          <span className={styles.barLabel}>No changes suggested</span>
                          <button
                            type="button"
                            className={styles.barButton}
                            onClick={() => closeSession()}
                          >
                            Close
                          </button>
                        </div>
                      ) : null}

                      {overlayMode === "error" ? (
                        <div className={styles.bar} role="alert">
                          <span className={styles.barLabel}>
                            {session?.error ?? "The edit failed"}
                          </span>
                          <button
                            type="button"
                            className={styles.barButton}
                            onClick={() => session && runEdit(session.instruction)}
                          >
                            Try again
                          </button>
                          <button
                            type="button"
                            className={styles.barButton}
                            onClick={() => closeSession()}
                          >
                            Close
                          </button>
                        </div>
                      ) : null}

                      {overlayMode === "applied" && applied ? (
                        <div className={styles.bar} role="status">
                          <Check className={cx(styles.barIcon, styles.ok)} aria-hidden="true" />
                          <span className={styles.barLabel}>
                            {applied.applied
                              ? `Applied ${applied.applied} of ${applied.total}`
                              : "Kept the original"}
                          </span>
                          {applied.applied ? (
                            <button
                              type="button"
                              className={styles.barButton}
                              onClick={undo}
                            >
                              <Undo2 aria-hidden="true" />
                              Undo
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <footer className={styles.footer}>
        <span className={styles.hint}>{hint}</span>
        <span className={styles.count}>
          <span className={styles.tabular}>{wordCount}</span> words
        </span>
      </footer>
    </section>
  );
}

export default AiInlineEdit;
