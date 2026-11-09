"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from "motion/react";
import type { AnimationPlaybackControls } from "motion/react";
import { ArrowUp, Check, CircleAlert, Mic, MicOff, RotateCcw, X } from "lucide-react";
import Tooltip from "../tooltip/tooltip";
import TextShimmer from "../text-shimmer/text-shimmer";
import kbdStyles from "../ai-search-bar/kbd.module.css";
import styles from "./dictation-button.module.css";

/* ── Types ─────────────────────────────────────────────────────────────────────── */

export type DictationErrorCode = "not-allowed" | "no-speech" | "audio-capture" | "network" | "unsupported" | "aborted";

export interface DictationTranscript {
  final: string;
  interim: string;
}

export type DictationStatus = "idle" | "starting" | "listening" | "processing" | "denied" | "error";

export interface DictationHandlers {
  onTranscript: (transcript: DictationTranscript) => void;
  onLevel: (level: number) => void;
  onSpeechEnd: () => void;
  onError: (code: DictationErrorCode) => void;
}

/** A live recogniser session: `stop()` finalises the utterance and resolves the trimmed text. */
export interface DictationSession {
  stop: () => Promise<string>;
}

/** Opens a session. Reject with a `DictationError` code to surface a failure in the control. */
export type DictationRecognizer = (handlers: DictationHandlers, signal: AbortSignal) => Promise<DictationSession>;

export interface DictationModel {
  name: string;
  mark: ReactNode;
}

export interface UseDictationOptions {
  recognizer?: DictationRecognizer;
  maxDuration?: number;
  onTranscript?: (transcript: DictationTranscript) => void;
  onCommit?: (text: string) => void;
  onCancel?: () => void;
  onSpeechEnd?: () => void;
  onStatusChange?: (status: DictationStatus, code?: DictationErrorCode) => void;
}

export interface DictationState {
  status: DictationStatus;
  transcript: DictationTranscript;
  error: DictationErrorCode | null;
  startedAt: number | null;
  levelRef: RefObject<number>;
  start: () => void;
  confirm: () => void;
  cancel: () => void;
  dismiss: () => void;
}

export class DictationError extends Error {
  code: DictationErrorCode;

  constructor(code: DictationErrorCode, message?: string) {
    super(message ?? code);
    this.name = "DictationError";
    this.code = code;
  }
}

/* ── Simulated recogniser ──────────────────────────────────────────────────────── */

interface Phrase {
  text: string;
  heard?: string;
}

const SCRIPTS: Phrase[][] = [
  [
    { text: "Draft a reply to Priya", heard: "Draft a reply to Pria" },
    { text: "saying the Q4 pricing review moves to Thursday at 2 PM,", heard: "saying the cue for pricing review moves to Thursday at 2 PM" },
    { text: "and ask her to bring the churn numbers from Stripe." },
  ],
  [
    { text: "Summarize the open Linear issues tagged billing,", heard: "Summarize the open linear issues tagged billing" },
    { text: "group them by customer," },
    { text: "and flag anything that blocks the October 31 release.", heard: "and flag anything that blocks the October 30 first release" },
  ],
  [
    { text: "Rewrite this onboarding email so it's shorter and warmer.", heard: "Rewrite this on boarding email so it's shorter and warmer" },
    { text: "Keep the 14-day trial", heard: "Keep the 14 day trial" },
    { text: "and the link to the setup guide." },
  ],
];

export interface SimulatedRecognizerOptions {
  scripts?: Phrase[][];
  deny?: boolean;
  startDelay?: number;
  finalizeDelay?: number;
  wordInterval?: number;
}

/** The simulated recognisers are recognised as such: the field may auto-play them without a user gesture. */
const simulated = new WeakSet<DictationRecognizer>();
const empty: DictationTranscript = { final: "", interim: "" };
const BUSY: DictationStatus[] = ["starting", "listening", "processing"];

const codeFor = (error: unknown): DictationErrorCode =>
  error instanceof DictationError ? error.code : error instanceof Error && error.name === "NotAllowedError" ? "not-allowed" : "network";

/**
 * A recogniser that types out canned utterances so the control can be exercised without a microphone.
 * Idempotent per session; `deny` simulates a blocked permission prompt.
 */
export function createSimulatedRecognizer({
  scripts = SCRIPTS,
  deny = false,
  startDelay = 160,
  finalizeDelay = 620,
  wordInterval = 150,
}: SimulatedRecognizerOptions = {}): DictationRecognizer {
  let runs = 0;
  const recognizer: DictationRecognizer = (handlers, signal) =>
    new Promise<DictationSession>((resolve, reject) => {
      const timers = new Set<ReturnType<typeof setTimeout>>();
      let levels: ReturnType<typeof setInterval> | undefined;

      const later = (run: () => void, delay: number) => {
        const id = setTimeout(() => {
          timers.delete(id);
          run();
        }, delay);
        timers.add(id);
      };
      const clear = () => {
        timers.forEach(clearTimeout);
        timers.clear();
        if (levels) clearInterval(levels);
        levels = undefined;
      };

      signal.addEventListener("abort", () => {
        clear();
        reject(new DictationError("aborted"));
      }, { once: true });

      later(() => {
        if (deny) {
          reject(new DictationError("not-allowed", "Microphone access was denied"));
          return;
        }

        const script = scripts[runs++ % Math.max(1, scripts.length)] ?? [];
        const finals: string[] = [];
        let phrase = 0;
        let heard = 0;
        let speaking = false;
        let phase = 0;

        levels = setInterval(() => {
          phase += 0.9;
          const level = speaking
            ? 0.32 + 0.5 * Math.abs(Math.sin(phase)) * (0.55 + 0.45 * Math.random()) + 0.12 * Math.random()
            : 0.03 + 0.05 * Math.random();
          handlers.onLevel(Math.min(1, level));
        }, 50);

        const emit = (interim: string) => handlers.onTranscript({ final: finals.join(" "), interim });

        const step = () => {
          const current = script[phrase];
          if (!current) {
            speaking = false;
            handlers.onSpeechEnd();
            return;
          }
          const words = (current.heard ?? current.text).split(/\s+/).filter(Boolean);
          if (heard < words.length) {
            speaking = true;
            heard = Math.min(words.length, heard + (0.4 > Math.random() ? 2 : 1));
            emit(words.slice(0, heard).join(" "));
            later(step, wordInterval * (0.75 + 0.5 * Math.random()));
            return;
          }
          finals.push(current.text);
          phrase += 1;
          heard = 0;
          speaking = false;
          emit("");
          later(step, 300);
        };

        later(step, 220);

        resolve({
          stop: () =>
            new Promise<string>((settle, fail) => {
              clear();
              const current = script[phrase];
              if (current && heard > 0) finals.push(current.text);
              speaking = false;
              handlers.onLevel(0);
              emit("");
              if (signal.aborted) {
                fail(new DictationError("aborted"));
                return;
              }
              later(() => settle(finals.join(" ")), finalizeDelay);
            }),
        });
      }, startDelay);
    });

  simulated.add(recognizer);
  return recognizer;
}

export interface WebSpeechRecognizerOptions {
  lang?: string;
  interimResults?: boolean;
}

type SpeechRecognitionAlternative = { transcript: string };
type SpeechRecognitionResult = { isFinal: boolean; length: number; 0: SpeechRecognitionAlternative };
type SpeechRecognitionEventLike = { resultIndex: number; results: { length: number; [index: number]: SpeechRecognitionResult } };
type SpeechRecognitionErrorEventLike = { error: string };
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const errorFor = (code: string): DictationErrorCode =>
  code === "not-allowed" || code === "service-not-allowed"
    ? "not-allowed"
    : code === "no-speech"
      ? "no-speech"
      : code === "audio-capture"
        ? "audio-capture"
        : "network";

/** The platform's own speech recogniser, when it has one. Levels are approximated from interim activity. */
export function createWebSpeechRecognizer({ lang = "en-US", interimResults = true }: WebSpeechRecognizerOptions = {}): DictationRecognizer {
  const recognizer: DictationRecognizer = (handlers, signal) => {
    const scope = window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
    const Recognition = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
    if (!Recognition) return Promise.reject(new DictationError("unsupported"));

    return new Promise<DictationSession>((resolve, reject) => {
      const recognition = new Recognition();
      let final = "";
      let interim = "";
      let ended = false;
      let levels: ReturnType<typeof setInterval> | undefined;
      const finish = () => {
        if (levels) clearInterval(levels);
        levels = undefined;
      };

      recognition.continuous = true;
      recognition.interimResults = interimResults;
      recognition.lang = lang;

      recognition.onresult = (event) => {
        interim = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (!result) continue;
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) final = `${final} ${text}`.trim();
          else interim += text;
        }
        handlers.onTranscript({ final, interim });
      };
      recognition.onerror = (event) => {
        finish();
        handlers.onError(errorFor(event.error));
      };
      recognition.onend = () => {
        ended = true;
        finish();
        handlers.onSpeechEnd();
      };

      signal.addEventListener("abort", () => {
        finish();
        recognition.abort();
        reject(new DictationError("aborted"));
      }, { once: true });

      try {
        recognition.start();
      } catch (error) {
        finish();
        reject(new DictationError("network", error instanceof Error ? error.message : undefined));
        return;
      }

      let phase = 0;
      levels = setInterval(() => {
        phase += 0.9;
        handlers.onLevel(interim ? Math.min(1, 0.32 + 0.5 * Math.abs(Math.sin(phase))) : 0.03);
      }, 50);

      resolve({
        stop: () =>
          new Promise<string>((settle) => {
            const settleNow = () => settle(final.trim());
            if (ended) {
              finish();
              handlers.onLevel(0);
              settleNow();
              return;
            }
            recognition.onend = () => {
              ended = true;
              finish();
              handlers.onLevel(0);
              settleNow();
            };
            recognition.stop();
          }),
      });
    });
  };

  return recognizer;
}

/* ── Motion tokens and copy ────────────────────────────────────────────────────── */

const spring = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;
const enter: [number, number, number, number] = [0.16, 1, 0.3, 1];
const pulse = (index: number) => 0.35 + 0.65 * Math.abs(Math.sin(1.7 * index + 0.6));
const words = (text: string) => text.split(/\s+/).filter(Boolean);

const COPY: Record<DictationErrorCode, { wide: string; narrow: string; live: string }> = {
  "not-allowed": {
    wide: "Microphone blocked in site settings",
    narrow: "Blocked",
    live: "Microphone access is blocked. Allow it in your browser's site settings, then try again.",
  },
  "no-speech": { wide: "Didn't catch that", narrow: "No speech", live: "No speech was detected. Try again." },
  "audio-capture": { wide: "No microphone found", narrow: "No mic", live: "No microphone was found." },
  network: { wide: "Recognition is offline", narrow: "Offline", live: "Speech recognition could not reach its service." },
  unsupported: { wide: "Dictation isn't supported here", narrow: "Unsupported", live: "This browser does not support dictation." },
  aborted: { wide: "Dictation stopped", narrow: "Stopped", live: "Dictation stopped." },
};

/* ── Keycap ────────────────────────────────────────────────────────────────────── */

const keyGlyph = (key: string, mac: boolean): { glyph: string; name: string } => {
  if (key === "enter") return { glyph: mac ? "↵" : "Enter", name: mac ? "Return" : "Enter" };
  if (key === "esc") return { glyph: "Esc", name: "Escape" };
  return { glyph: key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1), name: key };
};

const readPlatform = () => {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform || nav.platform || nav.userAgent);
};

/** A single keycap from the shared keycap module, drawn as a physical cap. */
function Kbd({ keys, size = "md", className }: { keys: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const [mac, setMac] = useState(true);
  useEffect(() => setMac(readPlatform()), []);
  const parsed = keys.split("+").filter(Boolean).map((key) => keyGlyph(key.trim().toLowerCase(), mac));
  return (
    <kbd className={[kbdStyles.kbd, kbdStyles[size], className].filter(Boolean).join(" ")}>
      {parsed.map((key, index) => (
        <span className={kbdStyles.slot} key={`${key.name}-${index}`}>
          <kbd className={kbdStyles.key}>
            <span className={kbdStyles.glyph} aria-hidden="true">{key.glyph}</span>
            <span className={kbdStyles.hidden}>{key.name}</span>
          </kbd>
        </span>
      ))}
    </kbd>
  );
}

/* ── Waveform ──────────────────────────────────────────────────────────────────── */

/** Bars sample the live level on a 60ms grid, ease toward it, and settle to dots when the mic closes. */
function Waveform({ levelRef, active, reduced }: { levelRef: RefObject<number>; active: boolean; reduced: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [count, setCount] = useState(16);
  const targets = useRef<number[]>([]);
  const shown = useRef<number[]>([]);
  const level = useRef(0);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (width > 0) setCount(Math.max(4, Math.floor((width + 2) / 5)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const bars = Array.from(node.children) as HTMLElement[];
    const size = bars.length;
    for (const buffer of [targets.current, shown.current]) {
      while (buffer.length < size) buffer.unshift(0);
      if (buffer.length > size) buffer.splice(0, buffer.length - size);
    }
    const target = targets.current;
    const current = shown.current;
    const paint = (index: number) => {
      bars[index].style.height = `${(3 + 17 * Math.pow(current[index], 1.35)).toFixed(2)}px`;
    };
    for (let index = 0; index < size; index += 1) paint(index);

    let visible = true;
    let frame = 0;
    let previous = 0;
    let elapsed = 0;
    const observer =
      typeof IntersectionObserver === "undefined"
        ? undefined
        : new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible && !frame) {
              previous = 0;
              frame = requestAnimationFrame(tick);
            }
          });

    const tick = (time: number) => {
      frame = 0;
      if (!visible) {
        previous = 0;
        return;
      }
      if (document.hidden) {
        previous = 0;
        frame = requestAnimationFrame(tick);
        return;
      }
      const delta = previous ? Math.min(64, time - previous) : 16;
      previous = time;
      elapsed += delta;
      while (elapsed >= 60) {
        elapsed -= 60;
        const next = active ? levelRef.current ?? 0 : 0;
        level.current += (next - level.current) * (next > level.current ? 0.55 : 0.3);
        if (active) {
          if (reduced) for (let index = 0; index < size; index += 1) target[index] = level.current * pulse(index);
          else {
            target.shift();
            target.push(level.current);
          }
        } else for (let index = 0; index < size; index += 1) target[index] *= 0.6;
      }
      const easing = 1 - Math.exp(-delta / 55);
      let moving = false;
      for (let index = 0; index < size; index += 1) {
        const value = current[index] + (target[index] - current[index]) * easing;
        if (Math.abs(value - current[index]) > 5e-4) {
          current[index] = value;
          paint(index);
        }
        if (target[index] > 0.002 || current[index] > 0.002) moving = true;
      }
      if (active || moving) frame = requestAnimationFrame(tick);
    };

    observer?.observe(node);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [active, reduced, levelRef, count]);

  return (
    <span ref={ref} className={styles.wave} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <span key={index} />)}
    </span>
  );
}

/* ── Elapsed timer ─────────────────────────────────────────────────────────────── */

function Elapsed({ startedAt, running }: { startedAt: number | null; running: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || startedAt === null) return;
    const paint = () => {
      const seconds = Math.max(0, Math.floor((performance.now() - startedAt) / 1000));
      node.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    };
    paint();
    if (!running) return;
    const id = setInterval(paint, 250);
    return () => clearInterval(id);
  }, [startedAt, running]);
  return <span ref={ref} className={styles.time} role="timer" aria-label="Elapsed">0:00</span>;
}

function Spinner() {
  return (
    <svg className={styles.spin} width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".3" strokeWidth="1.75" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/* ── Control pill ──────────────────────────────────────────────────────────────── */

interface ControlProps {
  dictation: DictationState;
  onStart: () => void;
  disabled?: boolean;
  reduced: boolean;
  label: string;
  refocusOnCommit?: boolean;
  activeWidth?: number;
  compact?: boolean;
}

/** The pill replaces the mic with cancel, waveform, timer and insert while a session runs. */
function DictationControl({
  dictation,
  onStart,
  disabled = false,
  reduced,
  label,
  refocusOnCommit,
  activeWidth = 216,
  compact = false,
}: ControlProps) {
  const { status, startedAt, levelRef, confirm, cancel, dismiss } = dictation;
  const view = status === "idle" ? "idle" : status === "denied" || status === "error" ? "retry" : "active";
  const transcribing = status === "processing";
  const [shownError, setShownError] = useState<DictationStatus>("error");
  if ((status === "denied" || status === "error") && status !== shownError) setShownError(status);

  const mic = useRef<HTMLButtonElement>(null);
  const commit = useRef<HTMLButtonElement>(null);
  const retry = useRef<HTMLButtonElement>(null);
  const focus = useRef<"follow" | "skip-idle" | null>(null);
  const [retryWidth, setRetryWidth] = useState(116);

  useEffect(() => {
    const node = retry.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (node.offsetWidth) setRetryWidth(Math.ceil(node.offsetWidth));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const intent = focus.current;
    if (!intent) return;
    if (view === "active" && intent === "skip-idle") return;
    focus.current = null;
    if (view === "idle" && intent === "skip-idle") return;
    const node = view === "idle" ? mic : view === "active" ? commit : retry;
    node.current?.focus({ preventScroll: true });
  }, [view]);

  return (
    <motion.div
      className={styles.pill}
      data-view={view}
      data-status={status}
      initial={false}
      animate={{ width: view === "active" ? activeWidth : view === "retry" ? retryWidth : 36 }}
      transition={reduced ? { duration: 0 } : spring}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        if (view === "active") {
          event.preventDefault();
          focus.current = "follow";
          cancel();
        } else if (view === "retry") {
          event.preventDefault();
          focus.current = "follow";
          dismiss();
        }
      }}
    >
      <div className={styles.layer} data-on={view === "idle" || undefined} inert={view !== "idle"} style={{ width: 36 }}>
        <Tooltip content={label}>
          <button
            ref={mic}
            type="button"
            className={styles.mic}
            aria-label={label}
            disabled={disabled}
            onClick={() => {
              focus.current = "follow";
              onStart();
            }}
          >
            <Mic size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
      <div className={styles.layer} data-on={view === "active" || undefined} inert={view !== "active"} style={{ width: activeWidth }}>
        <div className={styles.active}>
          <Tooltip content="Cancel">
            <button
              type="button"
              className={styles.cancel}
              aria-label="Cancel dictation"
              aria-disabled={transcribing || undefined}
              onClick={() => {
                if (transcribing) return;
                focus.current = "follow";
                cancel();
              }}
            >
              <X size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </Tooltip>
          <Waveform levelRef={levelRef} active={status === "listening"} reduced={reduced} />
          <Elapsed startedAt={startedAt} running={status === "starting" || status === "listening"} />
          <Tooltip content={transcribing ? "Transcribing" : "Insert"}>
            <button
              ref={commit}
              type="button"
              className={styles.confirm}
              aria-label={transcribing ? "Transcribing" : "Insert transcript"}
              aria-disabled={transcribing || undefined}
              onClick={() => {
                if (transcribing) return;
                focus.current = refocusOnCommit ? "follow" : "skip-idle";
                confirm();
              }}
            >
              <span className={styles.swap} data-on={!transcribing || undefined}>
                <Check size={16} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className={styles.swap} data-on={transcribing || undefined}>
                <Spinner />
              </span>
            </button>
          </Tooltip>
        </div>
      </div>
      <div className={styles.layer} data-on={view === "retry" || undefined} inert={view !== "retry"}>
        <button
          ref={retry}
          type="button"
          className={styles.retry}
          disabled={disabled}
          onClick={() => {
            focus.current = "follow";
            onStart();
          }}
        >
          {shownError === "denied" ? <MicOff size={16} strokeWidth={1.75} aria-hidden="true" /> : <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />}
          <span>{compact ? "Retry" : "Try again"}</span>
        </button>
      </div>
    </motion.div>
  );
}

/* ── State machine ─────────────────────────────────────────────────────────────── */

/** Owns one dictation session: start, live transcript, confirm, cancel and failure states. */
export function useDictation(options: UseDictationOptions = {}): DictationState {
  const { recognizer, maxDuration = 120 } = options;
  const latest = useRef(options);
  const [fallback] = useState(createSimulatedRecognizer);
  const open = useRef<DictationRecognizer>(recognizer ?? fallback);

  useEffect(() => {
    latest.current = options;
    open.current = recognizer ?? fallback;
  });

  const [status, setStatus] = useState<DictationStatus>("idle");
  const statusRef = useRef<DictationStatus>("idle");
  const [transcript, setTranscript] = useState<DictationTranscript>(empty);
  const [error, setError] = useState<DictationErrorCode | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const levelRef = useRef(0);
  const session = useRef<{ controller: AbortController; session?: DictationSession } | null>(null);

  const transition = useCallback((next: DictationStatus, code?: DictationErrorCode) => {
    statusRef.current = next;
    setStatus(next);
    latest.current.onStatusChange?.(next, code);
  }, []);

  const fail = useCallback((code: DictationErrorCode) => {
    session.current?.controller.abort();
    session.current = null;
    levelRef.current = 0;
    if (code === "aborted") {
      setTranscript(empty);
      transition("idle");
      return;
    }
    setError(code);
    transition(code === "not-allowed" ? "denied" : "error", code);
  }, [transition]);

  const cancel = useCallback(() => {
    const current = session.current;
    if (!current) return;
    current.controller.abort();
    session.current = null;
    levelRef.current = 0;
    setTranscript(empty);
    transition("idle");
    latest.current.onCancel?.();
  }, [transition]);

  const confirm = useCallback(async () => {
    const current = session.current;
    if (!current) return;
    if (statusRef.current === "starting" || !current.session) {
      cancel();
      return;
    }
    if (statusRef.current !== "listening") return;
    transition("processing");
    levelRef.current = 0;
    try {
      const final = (await current.session.stop()).trim();
      if (session.current !== current) return;
      if (!final) {
        fail("no-speech");
        return;
      }
      session.current = null;
      setTranscript({ final, interim: "" });
      transition("idle");
      latest.current.onCommit?.(final);
    } catch (reason) {
      if (session.current === current) fail(codeFor(reason));
    }
  }, [cancel, fail, transition]);

  const start = useCallback(async () => {
    if (BUSY.includes(statusRef.current)) return;
    const controller = new AbortController();
    const entry: { controller: AbortController; session?: DictationSession } = { controller };
    session.current = entry;
    const live = () => session.current === entry && !controller.signal.aborted;
    levelRef.current = 0;
    setTranscript(empty);
    setError(null);
    setStartedAt(performance.now());
    transition("starting");
    try {
      const opened = await open.current(
        {
          onTranscript: (next) => {
            if (!live()) return;
            if (statusRef.current === "processing" && next.interim) return;
            setTranscript(next);
            latest.current.onTranscript?.(next);
          },
          onLevel: (level) => {
            if (live()) levelRef.current = Math.max(0, Math.min(1, level));
          },
          onSpeechEnd: () => {
            if (live()) latest.current.onSpeechEnd?.();
          },
          onError: (code) => {
            if (live()) fail(code);
          },
        },
        controller.signal,
      );
      if (!live()) return;
      entry.session = opened;
      if (statusRef.current === "starting") transition("listening");
    } catch (reason) {
      if (live()) fail(codeFor(reason));
    }
  }, [fail, transition]);

  const dismiss = useCallback(() => {
    if (statusRef.current !== "denied" && statusRef.current !== "error") return;
    setError(null);
    transition("idle");
  }, [transition]);

  useEffect(() => {
    if (status !== "listening" || startedAt === null || !maxDuration) return;
    const id = setTimeout(() => void confirm(), Math.max(0, startedAt + maxDuration * 1000 - performance.now()));
    return () => clearTimeout(id);
  }, [status, startedAt, maxDuration, confirm]);

  useEffect(() => () => {
    session.current?.controller.abort();
    session.current = null;
  }, []);

  return {
    status,
    transcript,
    error,
    startedAt,
    levelRef,
    start: () => void start(),
    confirm: () => void confirm(),
    cancel,
    dismiss,
  };
}

/* ── Field autosize ────────────────────────────────────────────────────────────── */

/** Springs the field between text heights; widths changes and reduced motion snap instead. */
function useFieldHeight(reduced: boolean) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animation: AnimationPlaybackControls | undefined;
    const shell = outer.current;
    const body = inner.current;
    if (!shell || !body || typeof ResizeObserver === "undefined") return;
    let height = body.offsetHeight;
    let width = body.offsetWidth;
    const snap = () => {
      shell.style.height = "";
      shell.style.overflow = "";
      animation = undefined;
    };
    const observer = new ResizeObserver(() => {
      const nextHeight = body.offsetHeight;
      const nextWidth = body.offsetWidth;
      const reflowed = nextWidth !== width;
      width = nextWidth;
      if (nextHeight === height) return;
      const from = animation ? shell.getBoundingClientRect().height : height;
      height = nextHeight;
      animation?.stop();
      if (reduced || reflowed) {
        snap();
        return;
      }
      shell.style.overflow = "hidden";
      animation = animate(shell, { height: [from, nextHeight] }, { ...spring, onComplete: snap });
    });
    observer.observe(body);
    return () => {
      observer.disconnect();
      animation?.stop();
    };
  }, [reduced]);

  return { outer, inner };
}

/* ── Model ─────────────────────────────────────────────────────────────────────── */

const CLAUDE: DictationModel = {
  name: "Claude Sonnet 5.5",
  mark: (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Claude" className={styles.claude} aria-hidden="true">
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  ),
};

/* ── Component ─────────────────────────────────────────────────────────────────── */

export interface DictationButtonProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  /** Defaults to a simulated recogniser so the control works without a microphone. */
  recognizer?: DictationRecognizer;
  onTranscript?: (transcript: DictationTranscript) => void;
  onCommit?: (text: string) => void;
  /** Supply to send for real; without it the send button simulates delivery. */
  onSend?: (text: string) => void | Promise<void>;
  onStatusChange?: (status: DictationStatus, code?: DictationErrorCode) => void;
  /** Runs the demo loop: dictate, insert, send, repeat, until the first pointer or key. */
  autoPlay?: boolean;
  maxDuration?: number;
  model?: DictationModel | null;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * A message field with dictation: the mic pill becomes a live waveform, timer and insert control,
 * the transcript streams into the field word by word, and failures collapse to an inline retry.
 */
export function DictationButton({
  value,
  defaultValue = "",
  onValueChange,
  placeholder = "Message Claude",
  recognizer,
  onTranscript,
  onCommit,
  onSend,
  onStatusChange,
  autoPlay,
  maxDuration = 120,
  model = CLAUDE,
  disabled = false,
  className,
  "aria-label": ariaLabel = "Message",
}: DictationButtonProps) {
  const reduced = useReducedMotion() ?? false;
  const simulatedOnly = recognizer === undefined || simulated.has(recognizer);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const [inner, setInner] = useState(defaultValue);
  const text = value ?? inner;
  const [loop, setLoop] = useState(autoPlay ?? simulatedOnly);
  const [before, setBefore] = useState("");
  const [spoke, setSpoke] = useState(false);
  const [inserted, setInserted] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const manual = useRef(false);
  const refocus = useRef(false);
  const visible = useInView(root, { margin: "48px" });
  const { outer, inner: field } = useFieldHeight(reduced);
  const bar = useRef<HTMLDivElement>(null);
  const [barWidth, setBarWidth] = useState<number | null>(null);

  useEffect(() => {
    const node = bar.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setBarWidth(Math.round(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const activeWidth = barWidth === null ? 216 : Math.max(150, Math.min(216, barWidth - 52));

  const write = (next: string) => {
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  };

  const dictation = useDictation({
    recognizer,
    maxDuration,
    onTranscript,
    onStatusChange,
    onSpeechEnd: () => setSpoke(true),
    onCommit: (final) => {
      write(before ? (/\s$/.test(before) ? before + final : `${before} ${final}`) : final);
      onCommit?.(final);
      const count = words(final).length;
      setAnnouncement(`Inserted ${count} ${count === 1 ? "word" : "words"}`);
      if (manual.current) refocus.current = true;
      else setInserted(true);
    },
    onCancel: () => setAnnouncement("Dictation cancelled, nothing was inserted"),
  });
  const { status, transcript, error } = dictation;
  const dictating = status === "starting" || status === "listening" || status === "processing";
  const canSend = !!text.trim() && !dictating && !sending && !disabled;

  const begin = (byUser: boolean) => {
    if (disabled) return;
    manual.current = byUser;
    if (byUser) setLoop(false);
    setBefore(text);
    setSpoke(false);
    setSent(false);
    setAnnouncement("");
    dictation.start();
  };

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || dictating || sending || disabled) return;
    setInserted(false);
    if (onSend) {
      setSending(true);
      try {
        await onSend(trimmed);
        write("");
        setAnnouncement("Sent");
      } finally {
        setSending(false);
      }
      return;
    }
    write("");
    setSent(true);
    setAnnouncement("Sent. Simulated, nothing was sent.");
  };

  useEffect(() => {
    if (status !== "idle" || !refocus.current) return;
    refocus.current = false;
    const node = input.current;
    if (!node) return;
    node.focus({ preventScroll: true });
    node.setSelectionRange(node.value.length, node.value.length);
  }, [status, text]);

  useEffect(() => {
    const node = field.current;
    if (dictating && node) node.scrollTop = node.scrollHeight;
  }, [dictating, transcript, field]);

  useEffect(() => {
    if (!sent) return;
    const id = setTimeout(() => setSent(false), 1400);
    return () => clearTimeout(id);
  }, [sent]);

  const loopActions = useRef({ begin, send, confirm: dictation.confirm });
  useEffect(() => {
    loopActions.current = { begin, send, confirm: dictation.confirm };
  });

  useEffect(() => {
    if (!loop || !visible || disabled) return;
    let id: ReturnType<typeof setTimeout> | undefined;
    if (status === "idle" && inserted) id = setTimeout(() => void loopActions.current.send(), 1500);
    else if (status !== "idle" || text || sent) {
      if (status === "listening" && spoke) id = setTimeout(() => loopActions.current.confirm(), 450);
    } else id = setTimeout(() => loopActions.current.begin(false), 900);
    return () => clearTimeout(id);
  }, [loop, visible, disabled, status, text, sent, spoke, inserted]);

  const halt = () => {
    if (loop) setLoop(false);
  };

  const view = sent
    ? "sent"
    : status === "processing"
      ? "processing"
      : dictating
        ? "listening"
        : status === "denied"
          ? "denied"
          : status === "error"
            ? "error"
            : "model";

  const copy = COPY[error ?? "aborted"];
  const spoken = dictating
    ? (() => {
        const seen = new Map<string, number>();
        return [...words(transcript.final).map((word) => ({ word, final: true })), ...words(transcript.interim).map((word) => ({ word, final: false }))].map((item) => {
          const count = seen.get(item.word) ?? 0;
          seen.set(item.word, count + 1);
          return { ...item, key: `${item.word}#${count}` };
        });
      })()
    : [];

  const live =
    status === "idle" && announcement
      ? announcement
      : (status === "starting" || status === "listening"
          ? simulatedOnly
            ? "Listening. Simulated microphone, nothing is recorded."
            : "Listening"
          : status === "processing"
            ? "Transcribing"
            : status === "denied" || status === "error"
              ? COPY[error ?? "aborted"].live
              : "") || announcement;

  return (
    <div
      ref={root}
      className={[styles.root, className].filter(Boolean).join(" ")}
      onPointerDown={halt}
      onKeyDown={(event) => {
        halt();
        if (event.defaultPrevented) return;
        if (status !== "listening" && status !== "starting") return;
        if (event.key === "Escape") {
          event.preventDefault();
          dictation.cancel();
        } else if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) {
          event.preventDefault();
          manual.current = true;
          dictation.confirm();
        }
      }}
      onFocus={halt}
    >
      <div className={styles.card} data-dictating={dictating || undefined} data-disabled={disabled || undefined}>
        <div ref={outer} className={styles.field}>
          <div ref={field} className={styles.scroll}>
            <div className={styles.stack} data-dictating={dictating || undefined}>
              <div className={styles.mirror} aria-hidden="true">
                {dictating ? (
                  <>
                    {before}
                    {before && spoken.length && !/\s$/.test(before) ? " " : null}
                    {spoken.map((item, index) => (
                      <Fragment key={item.key}>
                        {index ? " " : null}
                        <span className={styles.word} data-interim={item.final ? undefined : ""}>{item.word}</span>
                      </Fragment>
                    ))}
                    {spoken.length || before ? null : <span className={styles.hint}>Speak now</span>}
                  </>
                ) : text}
                {"\u200b"}
              </div>
              <textarea
                ref={input}
                className={styles.input}
                value={text}
                placeholder={placeholder}
                aria-label={ariaLabel}
                rows={2}
                disabled={disabled}
                readOnly={dictating}
                tabIndex={dictating ? -1 : undefined}
                onChange={(event) => {
                  write(event.target.value);
                  setInserted(false);
                  if (status === "denied" || status === "error") dictation.dismiss();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
            </div>
          </div>
        </div>
        <div ref={bar} className={styles.bar}>
          <div className={styles.slot}>
            <AnimatePresence initial={false}>
              <motion.div
                className={styles.slotItem}
                initial={{ opacity: 0, y: 2 * Number(!reduced) }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.16, ease: enter, delay: 0.04 } }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                key={view}
              >
                {view === "model" ? (
                  model ? (
                    <>
                      {model.mark}
                      <span className={styles.slotText}>{model.name}</span>
                    </>
                  ) : null
                ) : view === "listening" ? (
                  <span className={styles.hints}>
                    <Kbd keys="enter" size="sm" />
                    <span>Insert</span>
                    <Kbd keys="esc" size="sm" className={styles.gap} />
                    <span>Cancel</span>
                  </span>
                ) : view === "processing" ? (
                  <TextShimmer className={styles.slotText}>Transcribing</TextShimmer>
                ) : view === "sent" ? (
                  <>
                    <Check size={16} strokeWidth={2} className={styles.ok} aria-hidden="true" />
                    <span className={styles.slotText}>{onSend ? "Sent" : "Sent, simulated"}</span>
                  </>
                ) : (
                  <>
                    {view === "denied" ? (
                      <MicOff size={16} strokeWidth={1.75} className={styles.warn} aria-hidden="true" />
                    ) : (
                      <CircleAlert size={16} strokeWidth={1.75} className={styles.warn} aria-hidden="true" />
                    )}
                    <span className={styles.slotText}>
                      <span className={styles.wide}>{copy.wide}</span>
                      <span className={styles.narrow}>{copy.narrow}</span>
                    </span>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <DictationControl
            dictation={dictation}
            onStart={() => begin(true)}
            disabled={disabled}
            reduced={reduced}
            label="Dictate"
            refocusOnCommit={false}
            activeWidth={activeWidth}
            compact={barWidth !== null && barWidth < 300}
          />
          <button type="button" className={styles.send} aria-label="Send message" disabled={!canSend} onClick={() => void send()}>
            {sending ? <Spinner /> : <ArrowUp size={18} strokeWidth={2} aria-hidden="true" />}
          </button>
        </div>
      </div>
      <span className={styles.srOnly} role="status" aria-live="polite">{live}</span>
    </div>
  );
}

export default DictationButton;
