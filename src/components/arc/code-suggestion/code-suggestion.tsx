"use client";

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode, SVGProps } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CircleAlert, CircleDot, RotateCcw, Square, X } from "lucide-react";
import { Button } from "../button/button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./code-suggestion.module.css";

/** The sample billing helper the built-in suggestion edits. */
export const SAMPLE_CODE = 'import type { Invoice } from "./types";\n\nexport async function fetchInvoice(id: string): Promise<Invoice> {\n  const res = await fetch(`/api/invoices/${id}`);\n  if (!res.ok) throw new Error(`Invoice ${id} failed: ${res.status}`);\n  return res.json();\n}';

const SAMPLE_HUNKS: CodeSuggestionHunk[] = [
  { id: "limits", start: 1, remove: 0, summary: "Add retry limits", insert: ['import { sleep } from "./sleep";', "", "const MAX_ATTEMPTS = 4;", "const BASE_DELAY_MS = 250;"] },
  {
    id: "loop",
    start: 3,
    remove: 1,
    summary: "Retry 429 and 5xx with backoff",
    insert: [
      "  let res = await fetch(`/api/invoices/${id}`);",
      "  for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {",
      "    if (res.status !== 429 && res.status < 500) break;",
      "    await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));",
      "    res = await fetch(`/api/invoices/${id}`);",
      "  }",
    ],
  },
  {
    id: "error",
    start: 4,
    remove: 1,
    summary: "Mention retries in the error",
    insert: ["  if (!res.ok) {", "    throw new Error(`Invoice ${id} failed after retries: ${res.status}`);", "  }"],
  },
];

const keywords = new Set([
  "as", "async", "await", "break", "case", "catch", "class", "const", "continue", "default", "delete", "do", "else", "enum",
  "export", "extends", "finally", "for", "from", "function", "if", "implements", "import", "in", "instanceof", "interface",
  "let", "new", "of", "private", "public", "readonly", "return", "static", "switch", "throw", "try", "type", "typeof",
  "var", "void", "while", "yield",
]);
const literals = new Set(["true", "false", "null", "undefined", "this"]);
/** One pass over a line: comment, string, number, identifier, then everything else. */
const tokenPattern = /(\/\/.*$)|(`(?:[^`\\]|\\.)*`?|"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)|(\d[\w.]*)|([A-Za-z_$][\w$]*)|([^\w\s`"'/]+|\/|\s+)/g;

/** A whole suggestion chunked into classes, so a line reads like the editor it came from. */
function tokenizeLine(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let match: RegExpExecArray | null;
  tokenPattern.lastIndex = 0;
  while ((match = tokenPattern.exec(line))) {
    const [raw, comment, string, number, word] = match;
    const index = match.index;
    if (comment) out.push(<span key={index} className={styles.tComment}>{comment}</span>);
    else if (string) {
      if (string.startsWith("`")) {
        out.push(...string.split(/(\$\{[^}]*\})/).filter(Boolean).map((piece, i) =>
          piece.startsWith("${")
            ? <span key={`${index}-${i}`} className={styles.tPunct}>{piece}</span>
            : <span key={`${index}-${i}`} className={styles.tString}>{piece}</span>));
      } else out.push(<span key={index} className={styles.tString}>{raw}</span>);
    } else if (number) out.push(<span key={index} className={styles.tNumber}>{raw}</span>);
    else if (word) {
      // A call is a function, a capitalised name is a type; everything else stays plain text.
      const next = line.slice(index + raw.length).match(/^\s*(.)/)?.[1];
      const tone = keywords.has(word) ? styles.tKeyword
        : literals.has(word) ? styles.tNumber
          : next === "(" ? styles.tFunction
            : /^[A-Z]/.test(word) ? styles.tType : undefined;
      out.push(tone ? <span key={index} className={tone}>{raw}</span> : raw);
    } else out.push(raw);
    if (raw.length === 0) tokenPattern.lastIndex += 1;
  }
  return out;
}

const CodeText = memo(function CodeText({ text }: { text: string }) {
  const tokens = useMemo(() => tokenizeLine(text), [text]);
  // An empty line renders a zero width space so the row keeps its height.
  return <span className={styles.text}>{text ? tokens : "\u200b"}</span>;
});

function TypeScriptMark({ title = "TypeScript", ...rest }: { title?: string } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" role="img" aria-label={title} {...rest}>
    <rect x="1" y="1" width="22" height="22" fill="#fff" />
    <path fill="#3178C6" d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z" />
  </svg>;
}

const MODEL_MARK = <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Claude" aria-hidden="true" style={{ color: "#D97757" }}><path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" /></svg>;

const DEFAULT_MODEL: CodeSuggestionModel = { name: "Claude Sonnet 5.5", mark: MODEL_MARK };

export type CodeSuggestionStatus = "thinking" | "streaming" | "ready" | "error";
export type CodeSuggestionDecision = "accepted" | "rejected";
/** A hunk before anyone has reviewed it. */
type Decision = CodeSuggestionDecision | "pending";

/** One proposed edit: replace `remove` lines starting at the zero based line `start` with `insert`. */
export interface CodeSuggestionHunk {
  id: string;
  start: number;
  remove?: number;
  insert?: string[];
  /** Shown on the hunk bar, and in the announcement when the hunk is accepted or rejected. */
  summary?: string;
}

export interface CodeSuggestionModel {
  name: string;
  mark?: ReactNode;
}

export interface CodeSuggestionResolve {
  code: string;
  accepted: string[];
  rejected: string[];
}

export interface CodeSuggestionProps {
  /** The original file contents, lines split on \n. */
  code?: string;
  /** The proposed changes. Overlapping hunks after the first are ignored. Leave it unset to play the built-in simulated suggestion. */
  hunks?: CodeSuggestionHunk[];
  /** Controlled status when you pass hunks. Going back to thinking clears earlier decisions. */
  status?: CodeSuggestionStatus;
  /** What the person asked for, shown as the header title. */
  instruction?: string;
  /** The model that wrote the suggestion. `null` hides the model line. */
  model?: CodeSuggestionModel | null;
  /** File name in the tab. */
  fileName?: string;
  /** Folder shown after the file name from a 520px card. */
  filePath?: string;
  /** Language mark in the tab. `null` hides it. */
  fileMark?: ReactNode | null;
  /** Message for the error status. */
  error?: string;
  /** Called for every hunk accepted or rejected, with the file as it now stands. */
  onDecision?: (hunk: CodeSuggestionHunk, decision: CodeSuggestionDecision, code: string) => void;
  /** Called once every hunk has a decision, with the final code and the hunk ids. */
  onResolve?: (result: CodeSuggestionResolve) => void;
  /** Shows Stop while thinking or streaming. Abort your request here. */
  onStop?: () => void;
  /** Shows Regenerate once the review is done (or there were no changes) and Retry on error. */
  onRegenerate?: () => void;
  /** Simulated suggestion only: accepts and rejects hunks on its own, then replays. Off under reduced motion. */
  autoPlay?: boolean;
  /** Cmd or Ctrl + Enter accepts all and Cmd or Ctrl + Backspace rejects all while focus is inside the card. */
  shortcuts?: boolean;
  /** Caps the code area height in pixels; longer files scroll inside it. */
  maxCodeHeight?: number;
  /** Class on the root element. */
  className?: string;
  /** Inline style on the root element. */
  style?: CSSProperties;
}

interface ResolvedHunk {
  id: string;
  start: number;
  remove: number;
  insert: string[];
  summary?: string;
  source: CodeSuggestionHunk;
}

interface Step {
  hunk: number;
  lines: number;
}

type Row =
  | { key: string; kind: "ctx" | "add" | "del"; text: string; hunk?: ResolvedHunk; decision?: Decision; num?: number }
  | { key: string; kind: "bar"; hunk: ResolvedHunk; index: number };

const join = (...values: (string | undefined | false)[]) => values.filter(Boolean).join(" ");
const changes = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/** Hunks drop out when they would overlap the one before them, so an applied patch is always unambiguous. */
function resolveHunks(hunks: CodeSuggestionHunk[], lineCount: number): ResolvedHunk[] {
  const sorted = [...hunks].sort((a, b) => a.start - b.start);
  const out: ResolvedHunk[] = [];
  let cursor = 0;
  for (const hunk of sorted) {
    const start = Math.min(Math.max(0, Math.floor(hunk.start)), lineCount);
    if (start < cursor) continue;
    const remove = Math.min(Math.max(0, hunk.remove ?? 0), lineCount - start);
    out.push({ id: hunk.id, start, remove, insert: hunk.insert ?? [], summary: hunk.summary, source: hunk });
    cursor = start + remove;
  }
  return out;
}

/** The file with every accepted hunk applied and every undecided or rejected hunk left as it was. */
function withDecisions(lines: string[], hunks: ResolvedHunk[], decisions: Record<string, Decision>) {
  const out: string[] = [];
  let cursor = 0;
  for (const hunk of hunks) {
    out.push(...lines.slice(cursor, hunk.start));
    out.push(...(decisions[hunk.id] === "accepted" ? hunk.insert : lines.slice(hunk.start, hunk.start + hunk.remove)));
    cursor = hunk.start + hunk.remove;
  }
  out.push(...lines.slice(cursor));
  return out.join("\n");
}

/** The preview machine, for the Accept all hint: a Mac shows ⌘, everything else Ctrl. */
function usePlatform(): "mac" | "pc" {
  const read = () => {
    const userAgentData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
    return /mac|iphone|ipad|ipod/i.test(userAgentData?.platform || navigator.platform || navigator.userAgent) ? "mac" as const : "pc" as const;
  };
  return useSyncStore(read, () => "mac" as const);
}

function useSyncStore<T>(read: () => T, server: () => T): T {
  const [value, setValue] = useState<T>(server);
  useEffect(() => { setValue(read()); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return value;
}

function Spinner() {
  return <svg className={styles.spinner} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".2" strokeWidth="1.75" />
    <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>;
}

/**
 * An AI code edit suggestion in a small editor panel: the header shows the model mark, the instruction and the
 * model, the panel shows a file tab, a running +/− count and the code with each proposed change as an inline diff
 * hunk. New lines stream in, then every hunk gets Reject and Accept under it, and the footer offers Reject all and
 * Accept all (Cmd or Ctrl + Enter). Accepting a hunk folds its removed lines away and settles the new lines into the
 * file; rejecting folds the new lines away and restores the original. With no props it plays a simulated suggestion
 * on a sample billing helper that reviews itself and replays until someone touches it; pass code and hunks to show a
 * real one.
 */
export function CodeSuggestion({
  code,
  hunks,
  status,
  instruction = "Add retry with backoff",
  model = DEFAULT_MODEL,
  fileName = "fetch-invoice.ts",
  filePath,
  fileMark,
  error,
  autoPlay = true,
  shortcuts = true,
  maxCodeHeight,
  onDecision,
  onResolve,
  onStop,
  onRegenerate,
  className,
  style,
}: CodeSuggestionProps) {
  const reduced = useReducedMotion() ?? false;
  const platform = usePlatform();
  const simulated = hunks === undefined;
  // The sample names its folder only while the built-in suggestion is playing.
  const folder = filePath ?? (simulated ? "src/billing" : undefined);
  const source = code ?? (simulated ? SAMPLE_CODE : "");
  const lines = useMemo(() => source.split("\n"), [source]);
  const resolved = useMemo(() => resolveHunks(hunks ?? SAMPLE_HUNKS, lines.length), [hunks, lines.length]);
  // Every hunk reveals in two beats: its first line, then each added line, so streaming has a rhythm.
  const steps = useMemo(() => {
    const out: Step[] = [];
    resolved.forEach((hunk, index) => {
      out.push({ hunk: index, lines: 0 });
      hunk.insert.forEach((_, line) => out.push({ hunk: index, lines: line + 1 }));
    });
    return out;
  }, [resolved]);

  const rootRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState({ phase: "idle" as "idle" | "streaming" | "thinking" | "ready", step: 0, stopped: false, run: 0 });
  const [touched, setTouched] = useState(false);
  const [pressing, setPressing] = useState<string | null>(null);
  const inView = useRef(false);
  const replayArmed = useRef(false);

  const replay = useCallback((manual: boolean) => {
    replayArmed.current = false;
    if (manual) setTouched(true);
    setRun(state => ({ phase: reduced ? "ready" : "thinking", step: 0, stopped: false, run: state.run + 1 }));
  }, [reduced]);

  // The simulated suggestion starts when the card is a third on screen, and replays when it comes back.
  useEffect(() => {
    if (!simulated) return;
    const setPhase = (phase: "ready" | "thinking") => setRun(state => (state.phase === "idle" ? { ...state, phase } : state));
    const node = rootRef.current;
    if (reduced || !node || typeof IntersectionObserver === "undefined") {
      inView.current = true;
      const frame = requestAnimationFrame(() => setPhase(reduced ? "ready" : "thinking"));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) => {
      inView.current = entry.isIntersecting;
      if (!entry.isIntersecting) return;
      setPhase("thinking");
      if (replayArmed.current) replay(false);
    }, { threshold: .35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [simulated, reduced, replay]);

  // Thinking, then a line at a time: a hunk's first line waits, a removed line longer, every added line 38ms.
  useEffect(() => {
    if (!simulated) return;
    let timer: number | undefined;
    if (run.phase === "thinking") timer = window.setTimeout(() => setRun(state => ({ ...state, phase: "streaming", step: 0 })), 820);
    else if (run.phase === "streaming") {
      if (run.step >= steps.length) timer = window.setTimeout(() => setRun(state => ({ ...state, phase: "ready" })), 140);
      else {
        const step = steps[run.step];
        const delay = step.lines === 0 ? 150 * (run.step === 0 ? 0 : 1) : step.lines === 1 ? (resolved[step.hunk].remove ? 190 : 75) : 38;
        timer = window.setTimeout(() => setRun(state => ({ ...state, step: state.step + 1 })), delay);
      }
    }
    return () => window.clearTimeout(timer);
  }, [simulated, run.phase, run.step, steps, resolved]);

  const phase = simulated ? (run.phase === "idle" ? "thinking" : run.phase) : status ?? "ready";

  // Only the hunks the stream has reached are visible, and only the lines of the hunk in flight.
  const visible = useMemo(() => {
    if (!simulated) return resolved;
    if (run.phase === "idle" || run.phase === "thinking") return [];
    if (run.phase === "ready" && !run.stopped) return resolved;
    const step = steps[run.step - 1];
    if (!step) return [];
    if (run.phase === "ready") return resolved.slice(0, step.lines === resolved[step.hunk].insert.length ? step.hunk + 1 : step.hunk);
    return resolved.slice(0, step.hunk + 1).map((hunk, index) => (index === step.hunk ? { ...hunk, insert: hunk.insert.slice(0, step.lines) } : hunk));
  }, [simulated, resolved, steps, run]);

  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const decisionsRef = useRef(decisions);
  const [announcement, setAnnouncement] = useState("");
  const [runMirror, setRunMirror] = useState(run.run);

  if (runMirror !== run.run || (!simulated && phase === "thinking" && Object.keys(decisions).length)) {
    setRunMirror(run.run);
    setDecisions({});
    setAnnouncement("");
  }

  useEffect(() => { decisionsRef.current = decisions; }, [decisions]);

  // Handlers stay current without restarting the autoplay script.
  const handlers = useRef({ onDecision, onResolve });
  useEffect(() => { handlers.current = { onDecision, onResolve }; });

  const decisionOf = (id: string): Decision => decisions[id] ?? "pending";
  const pending = phase === "ready" ? visible.filter(hunk => decisionOf(hunk.id) === "pending").map(hunk => hunk.id) : [];
  const accepted = visible.filter(hunk => decisionOf(hunk.id) === "accepted").length;
  const rejected = visible.filter(hunk => decisionOf(hunk.id) === "rejected").length;
  const settled = phase === "ready" && visible.length > 0 && pending.length === 0;

  const decide = useCallback((ids: string[], decision: CodeSuggestionDecision, focus = false) => {
    const next = { ...decisionsRef.current };
    const targets = ids.filter(id => (next[id] ?? "pending") === "pending");
    if (!targets.length) return;
    targets.forEach(id => { next[id] = decision; });
    decisionsRef.current = next;
    setDecisions(next);
    const verb = decision === "accepted" ? "Accepted" : "Rejected";
    const hunk = visible.find(item => item.id === targets[0]);
    setAnnouncement(targets.length > 1 ? `${verb} ${targets.length} changes` : `${verb}: ${hunk?.summary ?? `change ${visible.indexOf(hunk as ResolvedHunk) + 1}`}`);
    const result = withDecisions(lines, visible, next);
    targets.forEach(id => {
      const target = visible.find(item => item.id === id);
      if (target) handlers.current.onDecision?.(target.source, decision, result);
    });
    if (visible.every(item => next[item.id] && next[item.id] !== "pending")) {
      handlers.current.onResolve?.({
        code: result,
        accepted: visible.filter(item => next[item.id] === "accepted").map(item => item.id),
        rejected: visible.filter(item => next[item.id] === "rejected").map(item => item.id),
      });
    }
    // A keyboard decision moves the person to the next Accept, so a review never dead ends on a folded row.
    if (focus) requestAnimationFrame(() => {
      const node = rootRef.current;
      if (!node || (!node.contains(document.activeElement) && document.activeElement !== document.body)) return;
      const nextId = visible.find(item => (next[item.id] ?? "pending") === "pending")?.id;
      const target = nextId ? node.querySelector<HTMLElement>(`[data-accept="${CSS.escape(nextId)}"]`) : null;
      (target ?? codeRef.current)?.focus({ preventScroll: true });
    });
  }, [visible, lines]);

  const acceptAll = useCallback((focus = false) => decide(visible.map(hunk => hunk.id), "accepted", focus), [decide, visible]);
  const rejectAll = useCallback((focus = false) => decide(visible.map(hunk => hunk.id), "rejected", focus), [decide, visible]);

  // The preview reviews itself: one by one on even runs, Accept all on odd ones, then it plays again.
  const autoPlaying = simulated && autoPlay && !reduced && !touched;
  useEffect(() => {
    if (!autoPlaying || run.phase !== "ready" || run.stopped) return;
    const timers: number[] = [];
    const at = (delay: number, action: () => void) => timers.push(window.setTimeout(action, delay));
    const press = (delay: number, key: string, action: () => void) => {
      at(delay, () => setPressing(key));
      at(delay + 170, () => { setPressing(null); action(); });
    };
    if (run.run % 2 === 0) {
      const [first, second, third] = resolved;
      if (first) press(1300, `accept:${first.id}`, () => decide([first.id], "accepted"));
      if (second) press(2150, `accept:${second.id}`, () => decide([second.id], "accepted"));
      if (third) press(3000, `reject:${third.id}`, () => decide([third.id], "rejected"));
      resolved.slice(3).forEach((hunk, index) => press(3850 + 850 * index, `accept:${hunk.id}`, () => decide([hunk.id], "accepted")));
    } else press(1500, "accept-all", () => decide(resolved.map(hunk => hunk.id), "accepted"));
    return () => { timers.forEach(timer => window.clearTimeout(timer)); setPressing(null); };
  }, [autoPlaying, run.phase, run.stopped, run.run, resolved, decide]);

  useEffect(() => {
    if (!autoPlaying || !settled) return;
    const timer = window.setTimeout(() => {
      if (inView.current) replay(false);
      else replayArmed.current = true;
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [autoPlaying, settled, replay]);

  const takeOver = () => { if (autoPlaying) setTouched(true); };

  // Rows: context, removals (until accepted), additions (until rejected), and the hunk bar while it is undecided.
  const rows = useMemo(() => {
    const out: Row[] = [];
    let line = 0;
    const context = (until: number) => { for (; line < until; line += 1) out.push({ key: `c${line}`, kind: "ctx", text: lines[line] }); };
    visible.forEach((hunk, index) => {
      context(hunk.start);
      const decision = decisions[hunk.id] ?? "pending";
      if (decision !== "accepted") {
        for (let offset = 0; offset < hunk.remove; offset += 1) out.push({ key: `c${hunk.start + offset}`, kind: "del", text: lines[hunk.start + offset], hunk, decision });
      }
      if (decision !== "rejected") {
        hunk.insert.forEach((text, offset) => out.push({ key: `${hunk.id}+${offset}`, kind: "add", text, hunk, decision }));
      }
      if (phase === "ready" && decision === "pending") out.push({ key: `${hunk.id}-bar`, kind: "bar", hunk, index });
      line = hunk.start + hunk.remove;
    });
    context(lines.length);
    // The gutter counts the file as it would read: context lines, live additions, and a rejected removal stays.
    let number = 0;
    for (const row of out) {
      if (row.kind === "bar") continue;
      if (row.kind === "ctx" || (row.kind === "add" && row.decision !== "rejected") || (row.kind === "del" && row.decision === "rejected")) row.num = ++number;
    }
    return out;
  }, [visible, lines, decisions, phase]);

  const added = visible.reduce((total, hunk) => total + (decisionOf(hunk.id) === "rejected" ? 0 : hunk.insert.length), 0);
  const removed = visible.reduce((total, hunk) => total + (decisionOf(hunk.id) === "rejected" ? 0 : hunk.remove), 0);
  const stopped = simulated && run.stopped;

  let tone = "busy";
  let label: string;
  if (phase === "thinking") label = `Reading ${fileName}`;
  else if (phase === "streaming") label = "Writing changes";
  else if (phase === "error") { tone = "error"; label = error ?? "The model stopped responding. Nothing was changed."; }
  else if (visible.length) {
    if (pending.length) { tone = "review"; label = `${changes(pending.length, "change")} to review`; }
    else if (accepted === visible.length) { tone = "done"; label = visible.length === 1 ? "Change applied" : "All changes applied"; }
    else if (rejected === visible.length) { tone = "muted"; label = "Suggestion rejected"; }
    else { tone = "done"; label = `${accepted} applied, ${rejected} rejected`; }
  } else { tone = "muted"; label = stopped ? "Stopped before any changes" : "No changes needed"; }
  if (stopped && pending.length) label = `Stopped early, ${changes(pending.length, "change")} to review`;

  const allRejected = phase === "ready" && visible.length > 0 && rejected === visible.length;
  const iconTone = tone === "muted" && allRejected ? "rejected" : tone;
  const icon = iconTone === "busy" ? <Spinner />
    : iconTone === "review" ? <CircleDot size={16} strokeWidth={1.75} />
      : iconTone === "done" ? <Check size={16} strokeWidth={2} />
        : iconTone === "error" ? <CircleAlert size={16} strokeWidth={1.75} />
          : iconTone === "rejected" ? <X size={16} strokeWidth={1.75} />
            : <Check size={16} strokeWidth={1.75} />;
  const message = phase === "streaming" ? "Writing changes" : [announcement, label, settled && simulated ? "Simulated, nothing was written to disk" : ""].filter(Boolean).join(". ");

  const canStop = (phase === "thinking" || phase === "streaming") && (simulated || !!onStop);
  const canRegenerate = simulated || !!onRegenerate;
  const actions = canStop ? "busy"
    : phase === "error" ? (canRegenerate ? "error" : "none")
      : pending.length ? "review"
        : phase === "ready" && canRegenerate ? "done" : "none";
  const focusCode = () => requestAnimationFrame(() => codeRef.current?.focus({ preventScroll: true }));

  // The hunk bars pin to the viewport of the scroller, so the sticky bar spans the visible code width.
  useEffect(() => {
    const node = codeRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => node.style.setProperty("--cs-viewport", `${node.clientWidth}px`));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const rowTransition = reduced ? { duration: 0 } : { height: { duration: .12, ease: [...motionTokens.ease.enter] as [number, number, number, number] }, opacity: { duration: .15, ease: "easeOut" as const } };
  const exitTransition = reduced ? { duration: 0 } : { height: { type: "spring" as const, visualDuration: .26, bounce: 0 }, opacity: { duration: .12, ease: "easeOut" as const } };
  const fadeTransition = reduced ? { duration: 0 } : { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] as [number, number, number, number] };
  const quickExit = reduced ? { duration: 0 } : { duration: .1, ease: "easeOut" as const };
  const mark = fileMark === undefined ? <TypeScriptMark aria-hidden="true" /> : fileMark;

  return <div
    ref={rootRef}
    role="group"
    aria-label={`Code suggestion: ${instruction}`}
    className={join(styles.root, className)}
    style={style}
    data-status={phase}
    onKeyDown={event => {
      takeOver();
      if (shortcuts && (event.metaKey || event.ctrlKey) && phase === "ready" && pending.length) {
        if (event.key === "Enter") { event.preventDefault(); acceptAll(true); }
        else if (event.key === "Backspace") { event.preventDefault(); rejectAll(true); }
      }
    }}
    onPointerMove={takeOver}
    onPointerDown={takeOver}
  >
    <header className={styles.header}>
      {model?.mark ? <span className={styles.modelMark} aria-hidden="true">{model.mark}</span> : <span className={styles.modelMark} aria-hidden="true" />}
      <p className={styles.instruction}>{instruction}</p>
      {model ? <p className={styles.model}>{model.name}</p> : null}
    </header>
    <div className={styles.editor}>
      <div className={styles.tabs}>
        <span className={styles.tab}>
          {mark ? <span className={styles.fileMark} aria-hidden="true">{mark}</span> : null}
          <span className={styles.fileName}>{fileName}</span>
          {folder ? <span className={styles.filePath}>{folder}</span> : null}
        </span>
        <span className={styles.stats}>
          <span className={styles.srOnly}>{`${added} lines added, ${removed} removed`}</span>
          <span className={styles.statAdd} data-zero={added === 0 || undefined} aria-hidden="true">{"+"}{added}</span>
          <span className={styles.statDel} data-zero={removed === 0 || undefined} aria-hidden="true">{"−"}{removed}</span>
        </span>
      </div>
      <div
        ref={codeRef}
        className={styles.code}
        tabIndex={0}
        role="region"
        aria-label={`Suggested changes to ${fileName}`}
        style={maxCodeHeight ? { maxHeight: maxCodeHeight, overflowY: "auto" } : undefined}
      >
        <div className={styles.lines}>
          <AnimatePresence initial={false}>
            {rows.map(row => {
              if (row.kind === "bar") {
                const name = row.hunk.summary ?? `change ${row.index + 1}`;
                return <motion.div
                  key={row.key}
                  className={styles.barRow}
                  data-hunk-bar=""
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 40, opacity: 1 }}
                  exit={{ height: 0, opacity: 0, transition: exitTransition }}
                  transition={reduced ? { duration: 0 } : { height: { type: "spring", visualDuration: .24, bounce: 0 }, opacity: { duration: .16, ease: "easeOut" } }}
                >
                  <div className={styles.bar}>
                    <span className={styles.barSummary}>{row.hunk.summary ?? `Change ${row.index + 1} of ${visible.length}`}</span>
                    <div className={styles.barActions}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={join(styles.hunkButton, styles.reject)}
                        data-pressing={pressing === `reject:${row.hunk.id}` || undefined}
                        aria-label={`Reject ${name}`}
                        onClick={() => decide([row.hunk.id], "rejected", true)}
                      >Reject</Button>
                      <Button
                        size="sm"
                        variant="primary"
                        className={join(styles.hunkButton, styles.accept)}
                        data-pressing={pressing === `accept:${row.hunk.id}` || undefined}
                        data-accept={row.hunk.id}
                        aria-label={`Accept ${name}`}
                        onClick={() => decide([row.hunk.id], "accepted", true)}
                      >Accept</Button>
                    </div>
                  </div>
                </motion.div>;
              }
              return <motion.div
                key={row.key}
                className={styles.row}
                data-kind={row.kind}
                data-decision={row.kind === "ctx" ? undefined : row.decision}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 20, opacity: 1 }}
                exit={{ height: 0, opacity: 0, transition: exitTransition }}
                transition={rowTransition}
              >
                <span className={styles.gutter} aria-hidden="true">
                  <span className={styles.num}>{row.num ?? ""}</span>
                  <span className={styles.sign}>{row.kind === "add" ? "+" : row.kind === "del" ? "−" : ""}</span>
                </span>
                {row.kind !== "ctx" && row.decision === "pending"
                  ? <span className={styles.srOnly}>{row.kind === "add" ? "Added: " : "Removed: "}</span>
                  : null}
                <CodeText text={row.text} />
              </motion.div>;
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
    <div className={styles.footer}>
      <div className={styles.status} aria-hidden="true">
        <span className={styles.statusIcon}>
          <AnimatePresence initial={false}>
            <motion.span
              key={iconTone}
              data-tone={tone}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: quickExit }}
              transition={fadeTransition}
            >{icon}</motion.span>
          </AnimatePresence>
        </span>
        <span className={styles.statusLabel}>
          <AnimatePresence initial={false}>
            <motion.span
              key={label}
              data-tone={tone}
              initial={{ opacity: 0, y: reduced ? 0 : 2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: quickExit }}
              transition={fadeTransition}
            >
              {tone === "busy"
                ? <TextShimmer className={styles.statusText}>{label}</TextShimmer>
                : <span className={styles.statusText}>{label}</span>}
            </motion.span>
          </AnimatePresence>
        </span>
      </div>
      <div className={styles.actionsSlot}>
        <AnimatePresence initial={false}>
          {actions === "none" ? null : <motion.div
            key={actions}
            className={styles.actions}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: quickExit }}
            transition={fadeTransition}
          >
            {actions === "busy" ? <Button
              size="sm"
              variant="secondary"
              className={styles.footButton}
              onClick={() => {
                if (simulated) setRun(state => ({ ...state, phase: "ready", stopped: true }));
                onStop?.();
                focusCode();
              }}
            >
              <Square size={11} strokeWidth={0} fill="currentColor" aria-hidden="true" />
              Stop
            </Button> : null}
            {actions === "review" ? <Fragment>
              <Button
                size="sm"
                variant="secondary"
                className={styles.footButton}
                onClick={() => rejectAll(true)}
                aria-keyshortcuts={shortcuts ? "Meta+Backspace Control+Backspace" : undefined}
              >Reject all</Button>
              <Button
                size="sm"
                variant="primary"
                className={join(styles.footButton, styles.accept)}
                data-pressing={pressing === "accept-all" || undefined}
                onClick={() => acceptAll(true)}
                aria-keyshortcuts={shortcuts ? "Meta+Enter Control+Enter" : undefined}
              >
                Accept all
                {shortcuts ? <span className={styles.shortcut} aria-hidden="true">{platform === "mac" ? "⌘" : "Ctrl"}↵</span> : null}
              </Button>
            </Fragment> : null}
            {actions === "done" || actions === "error" ? <Button
              size="sm"
              variant="secondary"
              className={styles.footButton}
              onClick={() => { if (simulated) replay(true); onRegenerate?.(); focusCode(); }}
            >
              <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
              {actions === "error" ? "Retry" : "Regenerate"}
            </Button> : null}
          </motion.div>}
        </AnimatePresence>
      </div>
    </div>
    <p className={styles.srOnly} aria-live="polite" role="status">{message}</p>
  </div>;
}

export default CodeSuggestion;
