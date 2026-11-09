"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, Check } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode, Ref } from "react";
import kbdStyles from "./kbd.module.css";
import styles from "./ghost-text.module.css";

export type GhostTextStatus = "idle" | "loading" | "ready" | "accepted" | "error";

export interface GhostTextState {
  status: GhostTextStatus;
  suggestion: string;
  streaming: boolean;
}

export interface GhostTextHandle {
  focus: () => void;
  acceptAll: () => boolean;
  acceptWord: () => boolean;
  dismiss: () => void;
  request: () => void;
  getState: () => GhostTextState;
}

export interface GhostTextModel {
  name: string;
  mark?: ReactNode;
}

export type GhostTextSuggest = (
  value: string,
  signal: AbortSignal,
) =>
  | string
  | null
  | undefined
  | Promise<string | null>
  | AsyncIterable<string>;

export interface GhostTextProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  multiline?: boolean;
  variant?: "outline" | "plain";
  minRows?: number;
  maxRows?: number;
  placeholder?: string;
  label?: string;
  notice?: ReactNode;
  model?: GhostTextModel;
  hint?: boolean;
  suggest?: GhostTextSuggest;
  delay?: number;
  minLength?: number;
  onAccept?: (accepted: string, mode: "all" | "word") => void;
  onDismiss?: () => void;
  onStatusChange?: (status: GhostTextStatus) => void;
  onUserIntent?: () => void;
  disabled?: boolean;
  name?: string;
  id?: string;
  autoFocus?: boolean;
  "aria-label"?: string;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<GhostTextHandle>;
}

interface GhostChunk {
  id: number;
  text: string;
}

interface MergeSpan {
  key: number;
  start: number;
  text: string;
}

const KEYMAP: Record<string, { glyph: string; label: string }> = {
  mod: { glyph: "⌘", label: "Command" },
  right: { glyph: "→", label: "Right arrow" },
  esc: { glyph: "Esc", label: "Escape" },
  tab: { glyph: "⇥", label: "Tab" },
};

function KeyCap({ name, pressed }: { name: string; pressed?: boolean }) {
  const entry = KEYMAP[name] ?? { glyph: name, label: name };
  return (
    <kbd className={kbdStyles.key} data-pressed={pressed || undefined}>
      <span className={kbdStyles.glyph} aria-hidden="true">
        {entry.glyph}
      </span>
      <span className={kbdStyles.hidden}>{entry.label}</span>
    </kbd>
  );
}

function Kbd({ keys, pressed }: { keys: string; pressed?: boolean }) {
  const [first, ...rest] = keys.split("+");
  return (
    <kbd className={`${kbdStyles.kbd} ${kbdStyles.sm}`}>
      <span className={kbdStyles.slot}>
        <KeyCap name={first} />
        {rest.map((name) => (
          <span className={kbdStyles.slot} key={name}>
            <span className={kbdStyles.hidden}> </span>
            <KeyCap name={name} pressed={pressed} />
          </span>
        ))}
      </span>
    </kbd>
  );
}

/** Splits a suggestion into streamed pieces the way the reference model does. */
function* streamSuggestion(text: string): Generator<string> {
  const words = text.match(/\s*\S+/g) ?? [text];
  for (let index = 0, size = 3; index < words.length; index += size, size = 3 + ((7 * index) % 4)) {
    yield words.slice(index, index + size).join("");
  }
}

export function createDemoSuggest({ scriptedOnly = false } = {}): GhostTextSuggest {
  const trimEnd = (input: string) => input.replace(/\s+$/, "");

  return (value: string): AsyncIterable<string> | null => {
    const pairs: [string, string][] = [
      [
        "Customers who upgraded mid-cycle were ",
        "charged twice for the days left in their billing period.",
      ],
      ["used the invoice date instead of the ", "date the plan changed."],
      ["## Changes\n- ", "Compute proration from `changed_at` in `invoice.ts`"],
      ["share one helper\n- ", "Add a regression test for upgrades on the 31st"],
      [
        "Tested against ",
        "1,240 October invoices from the staging snapshot. Totals match to the cent outside the affected accounts.",
      ],
    ];
    for (const [prefix, suggestion] of pairs) {
      if (value.endsWith(prefix) || trimEnd(value) === trimEnd(prefix)) return stream(suggestion);
    }
    if (scriptedOnly) return null;
    if (value.endsWith("## Testing\n\n")) return stream("Rollout");
    if (value.endsWith("\n\n")) return stream("Ping me if the numbers look off.");
    return null;
  };
}

async function* stream(text: string): AsyncIterable<string> {
  await new Promise((resolve) => setTimeout(resolve, 480));
  yield* streamSuggestion(text);
}

function ghostOverlap(current: string, ghost: string): number {
  if (!current || !ghost) return 0;
  const limit = Math.min(current.length, ghost.length);
  for (let size = limit; size > 0; size -= 1) {
    if (current.endsWith(ghost.slice(0, size))) return size;
  }
  return 0;
}

export function GhostText({
  value,
  defaultValue = "",
  onValueChange,
  multiline = true,
  variant = "outline",
  minRows = 3,
  maxRows = 14,
  placeholder,
  label,
  notice,
  model,
  hint = true,
  suggest,
  delay = 450,
  minLength = 3,
  onAccept,
  onDismiss,
  onStatusChange,
  onUserIntent,
  disabled = false,
  name,
  id,
  autoFocus = false,
  "aria-label": ariaLabel,
  className,
  style,
  ref,
}: GhostTextProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const labelId = `${uid}-label`;
  const hintId = `${uid}-hint`;
  const [innerValue, setInnerValue] = useState(defaultValue);
  const [chunks, setChunks] = useState<GhostChunk[]>([]);
  const [merges, setMerges] = useState<MergeSpan[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ghostOut, setGhostOut] = useState<GhostChunk | null>(null);
  const [message, setMessage] = useState("");
  const [height, setHeight] = useState<number | null>(null);
  const [scrollable, setScrollable] = useState(false);
  const [chipWidth, setChipWidth] = useState<number | null>(null);
  const [caret, setCaret] = useState<"typing" | "idle">("idle");

  const rootRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chipRef = useRef<HTMLSpanElement>(null);
  const chunksRef = useRef<GhostChunk[]>([]);
  const markerRef = useRef<HTMLSpanElement>(null);
  const controller = useRef<AbortController | null>(null);
  const debounce = useRef<number | undefined>(undefined);
  const mergeTimers = useRef<Set<number>>(new Set());
  const mergeSeq = useRef(0);
  const chunkSeq = useRef(0);
  const acceptedTimer = useRef<number | undefined>(undefined);
  const ghostTimer = useRef<number | undefined>(undefined);
  const mounted = useRef(true);

  useEffect(() => {
    chunksRef.current = chunks;
  }, [chunks]);

  const current = value ?? innerValue;
  const streamed = chunks.map((chunk) => chunk.text).join("");
  const overlap = ghostOverlap(current, streamed);
  const suggestion = streamed.slice(overlap);
  const ghostParts = (() => {
    let hidden = overlap;
    const parts: { id: number; text: string }[] = [];
    for (const chunk of chunks) {
      if (hidden >= chunk.text.length) {
        hidden -= chunk.text.length;
        continue;
      }
      const text = chunk.text.slice(hidden);
      hidden = 0;
      if (text) parts.push({ id: chunk.id, text });
    }
    return parts;
  })();
  const status: GhostTextStatus = error
    ? "error"
    : chunks.length
      ? "ready"
      : streaming
        ? "loading"
        : accepting
          ? "accepted"
          : "idle";

  const statusRef = useRef({ status, suggestion, streaming });
  useLayoutEffect(() => {
    statusRef.current = { status, suggestion, streaming };
  }, [status, suggestion, streaming]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const write = useCallback(
    (next: string) => {
      if (value === undefined) setInnerValue(next);
      onValueChange?.(next);
    },
    [value, onValueChange],
  );

  const focusInput = useCallback(() => inputRef.current?.focus(), []);

  const clearSuggestion = useCallback(() => {
    window.clearTimeout(debounce.current);
    controller.current?.abort();
    controller.current = null;
    setStreaming(false);
  }, []);

  const run = useCallback(async () => {
    window.clearTimeout(debounce.current);
    const text = inputRef.current?.value ?? current;
    if (!suggest || disabled) return;
    if (text.trim().length < minLength) return;
    controller.current?.abort();
    const local = new AbortController();
    controller.current = local;
    setChunks([]);
    setError(null);
    setGhostOut(null);
    let started = "";
    const push = (piece: string) => {
      let text2 = piece;
      if (!started && /\s$/.test(text)) text2 = text2.replace(/^[ \t]+/, "");
      if (!text2) return;
      started += text2;
      chunkSeq.current += 1;
      setChunks((prev) => [...prev, { id: chunkSeq.current, text: text2 }]);
    };
    const finish = () => {
      controller.current = null;
      setStreaming(false);
      const full = chunksRef.current.map((chunk) => chunk.text).join("");
      if (full) {
        setMessage(
          `Suggestion: ${full.length > 160 ? `${full.slice(0, 157)}...` : full}. Press Tab to accept.`,
        );
      }
    };
    try {
      const result = suggest(text, local.signal);
      if (result == null) {
        finish();
        return;
      }
      if (typeof result === "string") {
        push(result);
        finish();
        return;
      }
      setStreaming(true);
      if (Symbol.asyncIterator in result) {
        for await (const piece of result) {
          if (local.signal.aborted) return;
          if (piece) push(piece);
        }
      } else {
        const piece = await result;
        if (local.signal.aborted) return;
        if (piece) push(piece);
      }
      if (local.signal.aborted) return;
      finish();
    } catch (cause) {
      if (local.signal.aborted) return;
      controller.current = null;
      setStreaming(false);
      setChunks([]);
      setError(cause instanceof Error && cause.message ? cause.message : "The model did not respond");
      setMessage("Couldn't get a suggestion.");
    }
  }, [chunksRef, current, disabled, minLength, suggest]);

  const schedule = useCallback(() => {
    window.clearTimeout(debounce.current);
    if (!suggest || disabled) return;
    if ((inputRef.current?.value ?? current).trim().length < minLength) return;
    debounce.current = window.setTimeout(() => {
      void run();
    }, delay);
  }, [current, delay, disabled, minLength, run, suggest]);

  const dismiss = useCallback(() => {
    setGhostOut(chunks.length ? { id: chunkSeq.current, text: suggestion } : null);
    setChunks([]);
    setError(null);
    onDismiss?.();
    setMessage("Suggestion dismissed.");
    window.clearTimeout(ghostTimer.current);
    ghostTimer.current = window.setTimeout(() => setGhostOut(null), 160);
  }, [chunks.length, onDismiss, suggestion]);

  const accept = useCallback(
    (mode: "all" | "word") => {
      const full = suggestion;
      if (!full || disabled) return false;
      const taken = mode === "all" ? full : (full.match(/^\s*\S+/)?.[0] ?? full);
      const rest = full.length > taken.length;
      const next = current + taken;
      if (!rest) {
        setChunks([]);
      } else {
        setChunks((prev) => {
          const joined = prev.map((chunk) => chunk.text).join("");
          const tail = joined.slice(overlap + taken.length);
          return tail ? [{ id: chunkSeq.current, text: tail }] : [];
        });
      }
      setError(null);
      if (!reduced) {
        mergeSeq.current += 1;
        const span: MergeSpan = { key: mergeSeq.current, start: current.length, text: taken };
        setMerges((prev) => [...prev, span]);
        const timer = window.setTimeout(() => {
          mergeTimers.current.delete(timer);
          setMerges((prev) => prev.filter((item) => item.key !== span.key));
        }, 240);
        mergeTimers.current.add(timer);
      }
      setCaret("idle");
      if (!rest) {
        setAccepting(true);
        window.clearTimeout(acceptedTimer.current);
        acceptedTimer.current = window.setTimeout(() => setAccepting(false), 1000);
      }
      setMessage(
        mode !== "all" && rest ? `Accepted ${taken.trim()}.` : "Suggestion accepted.",
      );
      write(next);
      onAccept?.(taken, mode);
      return true;
    },
    [current, disabled, onAccept, overlap, reduced, suggestion, write],
  );

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    return () => undefined;
  }, []);

  useLayoutEffect(() => {
    if (!multiline) return;
    const stack = stackRef.current;
    const viewport = viewportRef.current;
    if (!stack || !viewport) return;
    const measure = () => {
      const limit = Number.parseFloat(getComputedStyle(viewport).maxHeight);
      const natural = stack.offsetHeight;
      const target = Number.isFinite(limit) ? Math.min(natural, limit) : natural;
      setScrollable(Number.isFinite(limit) && natural > limit + 0.5);
      setHeight(target);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stack);
    return () => observer.disconnect();
  }, [multiline, current, chunks.length, ghostOut, minRows, maxRows]);

  useLayoutEffect(() => {
    const layer = chipRef.current;
    if (!layer) return;
    const measure = () => setChipWidth(layer.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(layer);
    return () => observer.disconnect();
  }, [status]);

  useEffect(
    () => () => {
      mounted.current = false;
      window.clearTimeout(debounce.current);
      window.clearTimeout(acceptedTimer.current);
      window.clearTimeout(ghostTimer.current);
      mergeTimers.current.forEach((timer) => window.clearTimeout(timer));
      mergeTimers.current.clear();
      controller.current?.abort();
    },
    [],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    const marker = markerRef.current;
    if (!viewport || !marker) return;
    const caretTop = marker.offsetTop;
    if (caretTop > viewport.scrollTop + viewport.clientHeight) {
      viewport.scrollTop = caretTop - viewport.clientHeight;
    } else if (caretTop - 8 < viewport.scrollTop) {
      viewport.scrollTop = Math.max(0, caretTop - 8);
    }
  }, [current]);

  const merged: ReactNode[] = [];
  if (merges.length) {
    let cursor = 0;
    for (const span of [...merges].sort((a, b) => a.start - b.start)) {
      if (span.start < cursor) continue;
      merged.push(current.slice(cursor, span.start));
      merged.push(
        <span className={styles.merge} key={span.key}>
          {span.text}
        </span>,
      );
      cursor = span.start + span.text.length;
    }
    merged.push(current.slice(cursor));
  }

  const isReady = status === "ready" || status === "error";
  const chipLabel =
    status === "ready"
      ? "Accept suggestion"
      : status === "error"
        ? `Retry suggestion. ${error ?? ""}`.trim()
        : status === "loading"
          ? `${model?.name ?? "Autocomplete"} is thinking`
          : `Autocomplete by ${model?.name ?? "Autocomplete"}`;

  useImperativeHandle(
    ref,
    () => ({
      focus: focusInput,
      acceptAll: () => accept("all"),
      acceptWord: () => accept("word"),
      dismiss,
      request: () => void run(),
      getState: () => ({
        status: statusRef.current.status,
        suggestion: chunksRef.current.map((chunk) => chunk.text).join(""),
        streaming: statusRef.current.streaming,
      }),
    }),
    [accept, dismiss, focusInput, run],
  );

  const rows = Math.max(1, minRows);

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-multiline={multiline ? "true" : "false"}
      data-variant={variant}
      data-merging={merges.length ? "" : undefined}
      data-labelled={label && multiline ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      style={
        {
          "--gt-rows": rows,
          "--gt-max-rows": Math.max(rows, maxRows),
          ...style,
        } as CSSProperties
      }
    >
      {label && multiline ? (
        <div id={labelId} className={styles.label}>
          {label}
        </div>
      ) : null}
      <motion.div
        ref={viewportRef}
        className={styles.viewport}
        data-scroll={scrollable ? "true" : "false"}
        style={multiline && height !== null ? { height } : undefined}
      >
        <div ref={stackRef} className={styles.stack}>
          <div className={styles.mirror} aria-hidden="true">
            {merges.length ? merged : current}
            <span ref={markerRef} className={styles.marker} data-caret={caret}>
              {"\u200B"}
            </span>
            {ghostParts.map((chunk) => (
              <span className={styles.ghost} key={chunk.id}>
                {chunk.text}
              </span>
            ))}
            {ghostOut ? <span className={styles.ghostOut}>{ghostOut.text}</span> : null}
          </div>
          <textarea
            ref={inputRef}
            className={styles.input}
            value={current}
            name={name}
            id={id}
            placeholder={placeholder}
            disabled={disabled}
            autoFocus={autoFocus}
            spellCheck
            autoComplete="off"
            aria-label={ariaLabel}
            aria-describedby={hint ? hintId : undefined}
            rows={1}
            onChange={(event) => {
              clearSuggestion();
              setChunks([]);
              setError(null);
              write(multiline ? event.target.value : event.target.value.replace(/[\r\n]+/g, " "));
              setCaret("typing");
              window.clearTimeout(ghostTimer.current);
              ghostTimer.current = window.setTimeout(() => setCaret("idle"), 160);
              schedule();
            }}
            onKeyDown={(event) => {
              onUserIntent?.();
              if (event.nativeEvent.isComposing || !suggestion || disabled) return;
              const plain = !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey;
              if (event.key === "Tab" && plain) {
                if (accept("all")) event.preventDefault();
              } else if (event.key === "ArrowRight" && !event.shiftKey && (event.metaKey || event.ctrlKey || event.altKey)) {
                if (accept("word")) event.preventDefault();
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                dismiss();
              }
            }}
            onSelect={() => {
              if (chunks.length) {
                clearSuggestion();
                setChunks([]);
              }
            }}
            onBlur={(event) => {
              if (event.relatedTarget instanceof Node && rootRef.current?.contains(event.relatedTarget)) {
                return;
              }
              clearSuggestion();
              if (suggestion) dismiss();
            }}
            onPointerDown={() => onUserIntent?.()}
            onFocus={() => onUserIntent?.()}
          />
        </div>
      </motion.div>
      {hint || model ? (
        <div className={styles.footer}>
          {multiline ? <div className={styles.footerStart}>{notice}</div> : null}
          {model ? (
            <>
              <AnimatePresence initial={false}>
                {status === "ready" && multiline ? (
                  <motion.span
                    key="keys"
                    className={styles.keys}
                    aria-hidden="true"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { duration: reduced ? 0 : 0.16, delay: reduced ? 0 : 0.04 } }}
                    exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
                  >
                    <span>
                      <Kbd keys="mod+right" />
                      word
                    </span>
                    <span>
                      <Kbd keys="esc" />
                      dismiss
                    </span>
                  </motion.span>
                ) : null}
              </AnimatePresence>
              <motion.button
                type="button"
                className={styles.chip}
                data-state={status}
                style={chipWidth ? { width: chipWidth } : undefined}
                tabIndex={status === "error" ? 0 : -1}
                aria-disabled={isReady ? undefined : true}
                aria-label={chipLabel}
                title={status === "error" && error ? error : undefined}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (!isReady) return;
                  if (status === "ready") accept("all");
                  if (status === "error") void run();
                }}
              >
                <span className={styles.chipStack}>
                  <AnimatePresence initial={false}>
                    <motion.span
                      key={status}
                      ref={chipRef}
                      className={styles.chipLayer}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, transition: { duration: reduced ? 0 : 0.16, delay: reduced ? 0 : 0.04 } }}
                      exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
                    >
                      {status === "idle" ? (
                        <>
                          {model.mark ? (
                            <span className={styles.mark} aria-hidden="true">
                              {model.mark}
                            </span>
                          ) : null}
                          <span className={styles.chipName}>{model.name}</span>
                        </>
                      ) : null}
                      {status === "loading" ? (
                        <>
                          {model.mark ? (
                            <span className={styles.mark} aria-hidden="true">
                              {model.mark}
                            </span>
                          ) : null}
                          <span className={styles.chipName}>Thinking</span>
                        </>
                      ) : null}
                      {status === "ready" ? (
                        <>
                          {model.mark ? (
                            <span className={styles.mark} aria-hidden="true">
                              {model.mark}
                            </span>
                          ) : null}
                          <span className={styles.desk}>
                            <Kbd keys="tab" />
                            <span>to accept</span>
                          </span>
                          <span className={styles.touch}>Tap to accept</span>
                        </>
                      ) : null}
                      {status === "accepted" ? (
                        <>
                          <Check className={styles.okIcon} aria-hidden="true" />
                          <span>Accepted</span>
                        </>
                      ) : null}
                      {status === "error" ? (
                        <>
                          <AlertTriangle className={styles.alertIcon} aria-hidden="true" />
                          <span>No suggestion</span>
                          <span className={styles.retry}>Retry</span>
                        </>
                      ) : null}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </motion.button>
            </>
          ) : null}
        </div>
      ) : null}
      {hint ? (
        <span id={hintId} className={styles.srOnly}>
          Suggestions appear when you pause. Tab accepts, Command or Control Right Arrow accepts
          one word, Escape dismisses.
        </span>
      ) : null}
      <span role="status" aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {message}
      </span>
    </div>
  );
}

export default GhostText;
