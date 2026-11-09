"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, CircleAlert, RotateCcw, ThumbsDown, ThumbsUp, Volume2, X } from "lucide-react";
import { motionTokens } from "../motion-tokens";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { Tooltip } from "../tooltip/tooltip";
import { CopyButton } from "../copy-button/copy-button";
import { Popover, PopoverContent, PopoverTrigger } from "../popover/popover";
import styles from "./speech-player.module.css";

export const DEFAULT_SPEECH = `Your flight to Lisbon leaves Thursday, October 29 at 7:40 from Zurich, gate A54. Check-in closes 40 minutes before departure, so plan to reach the airport by 6:15.

Lisbon looks warm, 21 degrees with a light breeze off the river. Your hotel in Príncipe Real holds the room until midnight, and I added both confirmations to your calendar.`;

export interface SpeechVoice {
  id: string;
  name: string;
  description?: string;
}

export const SPEECH_VOICES: SpeechVoice[] = [
  { id: "ava", name: "Ava", description: "Warm and conversational" },
  { id: "leo", name: "Leo", description: "Calm, lower register" },
  { id: "maya", name: "Maya", description: "Bright and quick" },
  { id: "noah", name: "Noah", description: "Steady narrator" },
];

const SPEED_SCALE: Record<string, number> = { ava: 1, leo: .93, maya: 1.08, noah: .97 };

export interface SpeechTiming {
  start: number;
  end: number;
}

export interface SpeechWord {
  text: string;
  index: number;
  paragraph: number;
}

export interface SpeechAuthor {
  name: string;
  mark?: ReactNode;
}

export interface SpeechSynthesis {
  timings?: SpeechTiming[];
  duration?: number;
  src?: string;
}

export interface SpeechRequest {
  text: string;
  voice: SpeechVoice;
  signal: AbortSignal;
}

export type Synthesize = (request: SpeechRequest) => Promise<SpeechSynthesis>;

export interface SpeechPosition {
  time: number;
  duration: number;
  wordIndex: number;
  voice: SpeechVoice;
  speed: number;
}

export interface SpeechPlayerProps {
  text?: string;
  author?: SpeechAuthor | null;
  voices?: SpeechVoice[];
  voice?: string;
  defaultVoice?: string;
  onVoiceChange?: (voice: SpeechVoice) => void;
  speed?: number;
  defaultSpeed?: number;
  onSpeedChange?: (speed: number) => void;
  synthesize?: Synthesize;
  simulated?: boolean;
  autoPlay?: boolean;
  actions?: ReactNode;
  variant?: "card" | "plain";
  className?: string;
  onPlay?: (position: SpeechPosition) => void;
  onPause?: (position: SpeechPosition) => void;
  onSeek?: (position: SpeechPosition) => void;
  onWordChange?: (position: SpeechPosition & { word: string }) => void;
  onEnd?: (position: SpeechPosition) => void;
  onClose?: () => void;
}

/** Words are timed from their shape: longer words hold longer, numbers hold longest, and punctuation sets the gap after them. */
export function layoutSpeech(text: string): { paragraphs: SpeechWord[][]; words: SpeechWord[] } {
  const paragraphs: SpeechWord[][] = [];
  let index = 0;
  for (const block of text.trim().split(/\n\s*\n/)) {
    const line = block.split(/\s+/).filter(Boolean).map((word) => ({ text: word, index: index++, paragraph: paragraphs.length }));
    if (line.length) paragraphs.push(line);
  }
  return { paragraphs, words: paragraphs.flat() };
}

/** Estimated timings, used when a provider returns audio without an alignment track. */
export function estimateTimings(text: string, rate = 1): { timings: SpeechTiming[]; duration: number } {
  const { paragraphs } = layoutSpeech(text);
  const timings: SpeechTiming[] = [];
  let cursor = 140;
  paragraphs.forEach((line, lineIndex) => {
    line.forEach((word, wordIndex) => {
      const length = 150 + 36 * word.text.replace(/[^\p{L}]/gu, "").length + 82 * word.text.replace(/[^\p{N}]/gu, "").length;
      timings.push({ start: Math.round(cursor), end: Math.round(cursor + length / rate) });
      cursor += length / rate;
      const gap = wordIndex === line.length - 1 && lineIndex < paragraphs.length - 1
        ? 560
        : /[.!?]["')”]?$/.test(word.text)
          ? 360
          : /[,;:]$/.test(word.text)
            ? 190
            : 22;
      cursor += gap / rate;
    });
  });
  return { timings, duration: Math.round(cursor + 160) };
}

/** The demo provider: resolves estimated timings after a short delay, and can fail on demand. */
export function createSimulatedProvider({ delay = 640, fail = false, text }: { delay?: number; fail?: boolean; text: string }): Synthesize {
  return ({ voice, signal }) =>
    new Promise((resolve, reject) => {
      if (signal.aborted) { reject(new DOMException("The request was aborted.", "AbortError")); return; }
      const timer = window.setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        if (fail) reject(Error(`${voice.name} timed out. Simulated, nothing was sent.`));
        else resolve(estimateTimings(text, SPEED_SCALE[voice.id] ?? 1));
      }, delay);
      function onAbort() {
        window.clearTimeout(timer);
        reject(new DOMException("The request was aborted.", "AbortError"));
      }
      signal.addEventListener("abort", onAbort, { once: true });
    });
}

export function speechDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1e3));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";
const joinClasses = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");
const speedLabel = (speed: number) => `${speed}×`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const SPEEDS = [1, 1.5, 2];
const FALLBACK_VOICE: SpeechVoice = { id: "default", name: "Default" };
const PRESETS = [
  { voice: "ava", speed: 1 },
  { voice: "leo", speed: 1.5 },
];
const CLAUDE: SpeechAuthor = {
  name: "Claude Sonnet 5.5",
  mark: <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Claude" style={{ color: "#D97757" }}>
    <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
  </svg>,
};

const PLAY_LABEL: Record<PlayMode, string> = {
  play: "Play",
  pause: "Pause",
  replay: "Play again",
  retry: "Retry",
  loading: "Preparing audio",
};

type Status = "idle" | "loading" | "playing" | "paused" | "ended" | "error";
type PlayMode = "play" | "pause" | "loading" | "replay" | "retry";
type SlotView = "timeline" | "loading" | "error";

const enter = (reduced: boolean) => reduced ? { duration: 0 } : {
  duration: motionTokens.duration.fast,
  ease: [...motionTokens.ease.enter] as [number, number, number, number],
  delay: .04,
};
const leave = (reduced: boolean) => reduced ? { duration: 0 } : {
  duration: .1,
  ease: [...motionTokens.ease.standard] as [number, number, number, number],
};
/** Cross-faded layers keep their box while they wait, so only opacity and a 2px lift move. */
const slotMotion = (present: boolean, reduced: boolean) => ({
  animate: { opacity: present ? 1 : 0, y: present || reduced ? 0 : 2 },
  transition: present ? enter(reduced) : leave(reduced),
});

function Spinner() {
  return <svg className={styles.spinner} width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx={8} cy={8} r={6} stroke="currentColor" strokeOpacity=".3" strokeWidth="1.75" />
    <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>;
}

function PlayGlyph() {
  return <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M5.25 3.6v8.8a.75.75 0 0 0 1.14.64l7.1-4.4a.75.75 0 0 0 0-1.28l-7.1-4.4a.75.75 0 0 0-1.14.64Z" />
  </svg>;
}

function PauseGlyph() {
  return <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <rect x={4.25} y={3.25} width={2.75} height={9.5} rx=".9" />
    <rect x={9} y={3.25} width={2.75} height={9.5} rx=".9" />
  </svg>;
}

/** Only the glyph swaps on the play button; it pops on a snappy spring and fades fast, so the hand-off never flashes. */
function PlayIcon({ mode, reduced }: { mode: PlayMode; reduced: boolean }) {
  const glyph = mode === "pause"
    ? <PauseGlyph />
    : mode === "loading"
      ? <Spinner />
      : mode === "replay"
        ? <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
        : mode === "retry"
          ? <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
          : <PlayGlyph />;
  return <AnimatePresence initial={false}>
    <motion.span
      key={mode}
      className={styles.playIcon}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: .6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: .6, transition: { duration: .1 } }}
      transition={reduced ? { duration: 0 } : { ...motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.instant } }}
    >
      {glyph}
    </motion.span>
  </AnimatePresence>;
}

/** Copy and the two verdict buttons travel with the response; the pressed one keeps a soft fill. */
function ResponseActions({ text, announce }: { text: string; announce: (message: string) => void }) {
  const [verdict, setVerdict] = useState<"good" | "bad" | null>(null);
  const mark = (next: "good" | "bad") => {
    const value = verdict === next ? null : next;
    setVerdict(value);
    announce(value ? `Marked as a ${value} response. Simulated, nothing was sent.` : "Feedback removed.");
  };
  return <>
    <CopyButton value={text} label="Copy reply" iconOnly variant="plain" className={styles.copy} />
    <Tooltip content="Good response">
      <button type="button" className={styles.iconButton} aria-label="Good response" aria-pressed={verdict === "good"} onClick={() => mark("good")}>
        <ThumbsUp size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </Tooltip>
    <Tooltip content="Bad response">
      <button type="button" className={styles.iconButton} aria-label="Bad response" aria-pressed={verdict === "bad"} onClick={() => mark("bad")}>
        <ThumbsDown size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </Tooltip>
  </>;
}

interface Latest {
  text: string;
  words: SpeechWord[];
  voice: SpeechVoice;
  voices: SpeechVoice[];
  synthesize?: Synthesize;
  simulated: boolean;
  props: {
    onPlay?: SpeechPlayerProps["onPlay"];
    onPause?: SpeechPlayerProps["onPause"];
    onSeek?: SpeechPlayerProps["onSeek"];
    onWordChange?: SpeechPlayerProps["onWordChange"];
    onEnd?: SpeechPlayerProps["onEnd"];
    onClose?: SpeechPlayerProps["onClose"];
  };
}

interface Runtime {
  status: Status;
  open: boolean;
  time: number;
  duration: number;
  timings: SpeechTiming[];
  audio: HTMLAudioElement | null;
  raf: number;
  last: number;
  word: number;
  second: number;
  speed: number;
  loadedVoice: string | null;
  requestedVoice: string | null;
  resumeAfterLoad: boolean;
  controller: AbortController | null;
  dragging: boolean;
  reduced: boolean;
  highlightTop: number | null;
  focus: "play" | "read" | null;
  interacted: boolean;
  autoPaused: boolean;
  timers: number[];
  onAutoEnd: (() => void) | null;
}

/** A reading surface: verifiable word timings drive both the highlight and the slider, and the transport only appears once
 *  the reader asks for audio. Voices swap in place, so the text never reflows while a new one loads. */
export function SpeechPlayer({
  text,
  author,
  voices,
  voice,
  defaultVoice,
  onVoiceChange,
  speed,
  defaultSpeed = 1,
  onSpeedChange,
  synthesize,
  simulated,
  autoPlay,
  actions,
  variant = "card",
  className,
  onPlay,
  onPause,
  onSeek,
  onWordChange,
  onEnd,
  onClose,
}: SpeechPlayerProps) {
  const isDefaultText = text === undefined;
  const body = text ?? DEFAULT_SPEECH;
  const list = voices?.length ? voices : SPEECH_VOICES;
  const byline = author === undefined ? (isDefaultText ? CLAUDE : null) : author;
  const simulatedOnly = simulated ?? !synthesize;
  const startsAlone = autoPlay ?? isDefaultText;
  const reduced = useReducedMotion() ?? false;
  const textId = useId();
  const [ownVoice, setOwnVoice] = useState(defaultVoice ?? list[0]?.id ?? FALLBACK_VOICE.id);
  const activeVoiceId = voice ?? ownVoice;
  const selected = list.find((item) => item.id === activeVoiceId) ?? list[0] ?? FALLBACK_VOICE;
  const [ownSpeed, setOwnSpeed] = useState(defaultSpeed);
  const rate = speed ?? ownSpeed;
  const { paragraphs, words } = useMemo(() => layoutSpeech(body), [body]);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [wordIndex, setWordIndex] = useState(-1);
  const [second, setSecond] = useState(0);
  const [duration, setDuration] = useState(0);
  const [detail, setDetail] = useState("");
  const [message, setMessage] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [voiceWidth, setVoiceWidth] = useState<number>();
  const rootRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const scrubRef = useRef<HTMLDivElement>(null);
  const readRef = useRef<HTMLButtonElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);

  const runtime = useRef<Runtime>({
    status: "idle", open: false, time: 0, duration: 0, timings: [], audio: null, raf: 0, last: 0, word: -1, second: -1,
    speed: defaultSpeed, loadedVoice: null, requestedVoice: null, resumeAfterLoad: false, controller: null, dragging: false,
    reduced: false, highlightTop: null, focus: null, interacted: false, autoPaused: false, timers: [], onAutoEnd: null,
  });

  const latest = useRef<Latest>({
    text: body,
    words,
    voice: selected,
    voices: list,
    synthesize,
    simulated: simulatedOnly,
    props: {},
  });
  useLayoutEffect(() => {
    latest.current = {
      text: body,
      words,
      voice: selected,
      voices: list,
      synthesize,
      simulated: simulatedOnly,
      props: { onPlay, onPause, onSeek, onWordChange, onEnd, onClose },
    };
    runtime.current.reduced = reduced;
  });

  const announce = useCallback((value: string) => setAnnouncement(value), []);

  const transport = useMemo(() => {
    const set = (next: Status) => { runtime.current.status = next; setStatus(next); };
    const position = (): SpeechPosition => ({
      time: Math.round(runtime.current.time),
      duration: runtime.current.duration,
      wordIndex: runtime.current.word,
      voice: latest.current.voice,
      speed: runtime.current.speed,
    });
    const markWord = (index: number) => {
      const state = runtime.current;
      if (index === state.word) return;
      state.word = index;
      setWordIndex(index);
      const spoken = latest.current.words[index];
      if (spoken) latest.current.props.onWordChange?.({ ...position(), word: spoken.text });
    };
    const paint = (time: number) => {
      const state = runtime.current;
      const progress = state.duration ? clamp(time / state.duration, 0, 1) : 0;
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${progress})`;
      if (thumbRef.current) thumbRef.current.style.transform = `translateX(${100 * progress}%)`;
    };
    /** The timeline reads from the timings table: the last word whose start has passed is the spoken one. */
    const track = (time: number) => {
      const state = runtime.current;
      paint(time);
      const whole = Math.floor(time / 1e3);
      if (whole !== state.second) { state.second = whole; setSecond(whole); }
      let low = 0;
      let high = state.timings.length - 1;
      let found = -1;
      while (low <= high) {
        const middle = (low + high) >> 1;
        if (state.timings[middle].start <= time) { found = middle; low = middle + 1; } else high = middle - 1;
      }
      markWord(found);
    };
    const stopLoop = () => { cancelAnimationFrame(runtime.current.raf); runtime.current.raf = 0; };
    const finish = () => {
      const state = runtime.current;
      stopLoop();
      state.audio?.pause();
      state.time = state.duration;
      track(state.duration);
      markWord(-1);
      set("ended");
      latest.current.props.onEnd?.(position());
      announce("Finished reading.");
      if (!state.interacted) state.onAutoEnd?.();
    };
    const step = (now: number) => {
      const state = runtime.current;
      if (state.status === "playing") {
        if (!state.dragging) {
          const next = state.audio ? 1e3 * state.audio.currentTime : state.time + (now - state.last) * state.speed;
          if (next >= state.duration) { finish(); return; }
          state.time = next;
          track(next);
        }
        state.last = now;
        state.raf = requestAnimationFrame(step);
      }
    };
    const fail = (reason: string) => {
      stopLoop();
      runtime.current.audio?.pause();
      set("error");
      setDetail(reason);
      announce(`Couldn't generate audio. ${reason}`);
    };
    const play = () => {
      const state = runtime.current;
      if (!state.timings.length) return;
      if (state.time >= state.duration) { state.time = 0; track(0); }
      set("playing");
      state.last = performance.now();
      if (state.audio) {
        state.audio.playbackRate = state.speed;
        if (Math.abs(1e3 * state.audio.currentTime - state.time) > 40) state.audio.currentTime = state.time / 1e3;
        state.audio.play().catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "NotAllowedError") {
            stopLoop();
            set("paused");
            announce("Press play to start the audio.");
            return;
          }
          if (!isAbort(error)) fail("The audio could not be played.");
        });
      }
      stopLoop();
      state.raf = requestAnimationFrame(step);
      latest.current.props.onPlay?.(position());
      announce(`Reading aloud with ${latest.current.voice.name} at ${speedLabel(state.speed)}.${latest.current.simulated ? " Simulated, no audio plays." : ""}`);
    };
    const pause = () => {
      const state = runtime.current;
      if (state.status !== "playing") return;
      stopLoop();
      state.audio?.pause();
      set("paused");
      latest.current.props.onPause?.(position());
      announce(`Paused at ${speechDuration(state.time)}.`);
    };
    const onAudioEnded = () => { if (runtime.current.status === "playing") finish(); };
    const onAudioError = () => fail("The audio could not be loaded.");
    const unload = () => {
      const audio = runtime.current.audio;
      if (!audio) return;
      audio.pause();
      audio.removeEventListener("ended", onAudioEnded);
      audio.removeEventListener("error", onAudioError);
      audio.removeAttribute("src");
      audio.load();
      runtime.current.audio = null;
    };
    const load = async (start: boolean, fromWord: number, requested?: SpeechVoice) => {
      const state = runtime.current;
      const live = latest.current;
      const target = requested ?? live.voice;
      state.controller?.abort();
      const controller = new AbortController();
      state.controller = controller;
      stopLoop();
      state.audio?.pause();
      const switching = state.loadedVoice !== null && state.loadedVoice !== target.id && state.open && state.word >= 0;
      state.requestedVoice = target.id;
      state.resumeAfterLoad = start;
      setDetail("");
      setMessage(switching ? `Switching to ${target.name}` : `Preparing ${target.name}'s voice`);
      set("loading");
      announce(switching ? `Switching to ${target.name}.` : `Preparing ${target.name}'s voice.`);
      const provider = live.synthesize ?? ((request: SpeechRequest) => createSimulatedProvider({ delay: switching ? 460 : 640, text: live.text })(request));
      try {
        const result = await provider({ text: live.text, voice: target, signal: controller.signal });
        if (controller.signal.aborted) return;
        let timings: SpeechTiming[] | undefined = result.timings;
        let total = result.duration;
        let audio: HTMLAudioElement | null = null;
        if (result.src) {
          const element = new Audio();
          element.preload = "auto";
          element.src = result.src;
          audio = element;
          if (!timings || total === undefined) {
            await new Promise<void>((resolve, reject) => {
              if (element.readyState >= 1) resolve();
              else {
                element.addEventListener("loadedmetadata", () => resolve(), { once: true });
                element.addEventListener("error", () => reject(Error("The audio could not be loaded.")), { once: true });
              }
            });
            if (controller.signal.aborted) return;
            if (total === undefined && Number.isFinite(element.duration)) total = 1e3 * element.duration;
          }
        }
        if (!timings) {
          const estimated = estimateTimings(live.text);
          const last = estimated.timings.at(-1)?.end ?? 0;
          timings = total && last
            ? estimated.timings.map(({ start, end }) => {
              const scale = Math.max(.1, (total! - 120) / last);
              return { start: Math.round(start * scale), end: Math.round(end * scale) };
            })
            : estimated.timings;
          total ??= estimated.duration;
        }
        const table = timings;
        total ??= (table.at(-1)?.end ?? 0) + 240;
        const length = total;
        unload();
        if (audio) {
          audio.playbackRate = state.speed;
          audio.addEventListener("ended", onAudioEnded);
          audio.addEventListener("error", onAudioError);
        }
        state.audio = audio;
        state.timings = table;
        state.duration = length;
        state.loadedVoice = target.id;
        state.controller = null;
        state.second = -1;
        setDuration(length);
        state.time = fromWord >= 0 && table[fromWord] ? table[fromWord].start : 0;
        track(state.time);
        if (start) play(); else set("paused");
      } catch (error) {
        if (controller.signal.aborted || isAbort(error)) return;
        state.controller = null;
        fail(error instanceof Error && error.message ? error.message : "Something went wrong.");
      }
    };
    const close = (refocus?: boolean) => {
      const state = runtime.current;
      state.controller?.abort();
      state.controller = null;
      stopLoop();
      state.audio?.pause();
      state.requestedVoice = state.loadedVoice;
      state.time = 0;
      state.second = -1;
      markWord(-1);
      setSecond(0);
      setDetail("");
      paint(0);
      set("idle");
      state.open = false;
      setOpen(false);
      if (refocus && rootRef.current?.contains(document.activeElement)) state.focus = "read";
      latest.current.props.onClose?.();
      announce("Stopped reading.");
    };
    return {
      play,
      pause,
      seek: (time: number, notify: boolean) => {
        const state = runtime.current;
        if (!state.duration) return;
        const next = clamp(time, 0, state.duration);
        state.time = next;
        state.last = performance.now();
        if (state.audio) state.audio.currentTime = next / 1e3;
        if (state.status === "ended" && next < state.duration) set("paused");
        track(next);
        if (notify) latest.current.props.onSeek?.(position());
      },
      load,
      start: (focus?: boolean, requested?: SpeechVoice) => {
        const state = runtime.current;
        state.open = true;
        setOpen(true);
        if (focus) state.focus = "play";
        const target = requested ?? latest.current.voice;
        if (state.loadedVoice === target.id && state.timings.length) {
          state.time = 0;
          state.second = -1;
          track(0);
          play();
        } else void load(true, -1, requested);
      },
      toggle: () => {
        const state = runtime.current;
        if (state.status === "playing") { pause(); return; }
        if (state.status === "loading") return;
        if (state.status === "error" || state.loadedVoice !== latest.current.voice.id) void load(true, state.word);
        else play();
      },
      close,
      reset: () => {
        const state = runtime.current;
        if (state.open) close(false);
        unload();
        state.timings = [];
        state.duration = 0;
        state.loadedVoice = null;
        state.requestedVoice = null;
        setDuration(0);
      },
      dispose: () => {
        runtime.current.controller?.abort();
        stopLoop();
        unload();
      },
    };
  }, [announce]);

  useEffect(() => {
    const state = runtime.current;
    state.speed = rate;
    state.last = performance.now();
    if (state.audio) state.audio.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    const state = runtime.current;
    if (!state.open || state.status === "idle" || state.requestedVoice === activeVoiceId) return;
    const resume = state.status === "playing" || (state.status === "loading" && state.resumeAfterLoad);
    void transport.load(resume, state.word);
  }, [activeVoiceId, transport]);

  useEffect(() => { transport.reset(); }, [body, transport]);
  useEffect(() => () => transport.dispose(), [transport]);

  useEffect(() => {
    const state = runtime.current;
    if (state.focus === "play" && open) playRef.current?.focus();
    if (state.focus === "read" && !open) readRef.current?.focus();
    state.focus = null;
  }, [open]);

  /** The highlight is a single transparent box that slides under the spoken word: it snaps when the word wraps to a new
   *  line, and eases along the line, so the eye is led rather than chased. */
  const placeHighlight = useCallback((snap: boolean) => {
    const state = runtime.current;
    const box = highlightRef.current;
    const node = textRef.current;
    if (!box || !node) return;
    const target = state.word >= 0 ? wordRefs.current[state.word] : null;
    if (!(state.open && target && (state.status === "playing" || state.status === "paused" || state.status === "loading"))) {
      box.dataset.visible = "false";
      state.highlightTop = null;
      return;
    }
    const left = target.offsetLeft - 3;
    const top = target.offsetTop - 1;
    const width = target.offsetWidth + 6;
    const height = target.offsetHeight + 2;
    const jump = snap || state.reduced || box.dataset.visible !== "true" || state.highlightTop === null || Math.abs(top - state.highlightTop) > 2;
    if (jump) box.dataset.snap = "true";
    box.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
    box.dataset.visible = "true";
    state.highlightTop = top;
    if (jump) { void box.offsetWidth; delete box.dataset.snap; }
  }, []);

  useLayoutEffect(() => { placeHighlight(false); }, [wordIndex, open, status, placeHighlight]);

  useEffect(() => {
    const node = textRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let width = node.offsetWidth;
    const observer = new ResizeObserver(() => {
      if (node.offsetWidth !== width) { width = node.offsetWidth; placeHighlight(true); }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [placeHighlight]);

  const measureVoice = useCallback(() => {
    const probe = probeRef.current;
    if (probe) setVoiceWidth(Math.ceil(probe.getBoundingClientRect().width));
  }, []);
  useLayoutEffect(measureVoice, [selected.name, measureVoice]);
  useEffect(() => {
    const probe = probeRef.current;
    if (!probe || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measureVoice);
    observer.observe(probe);
    return () => observer.disconnect();
  }, [measureVoice]);

  /** The demo reads itself once it is on screen and stops the moment anyone touches it; off screen it holds its place. */
  useEffect(() => {
    const node = rootRef.current;
    if (!startsAlone || !node || typeof IntersectionObserver === "undefined") return;
    const state = runtime.current;
    let visible = false;
    let waiting: (() => void) | null = null;
    let preset = 0;
    const later = (run: () => void, delay: number) => {
      state.timers.push(window.setTimeout(() => { if (!state.interacted) { if (visible) run(); else waiting = run; } }, delay));
    };
    const startPreset = (index: number) => {
      const current = latest.current;
      const choice = isDefaultText ? PRESETS[index % PRESETS.length] : null;
      const found = choice ? current.voices.find((item) => item.id === choice.voice) : undefined;
      if (choice && found) { state.speed = choice.speed; setOwnSpeed(choice.speed); setOwnVoice(found.id); }
      transport.start(false, found);
    };
    state.onAutoEnd = isDefaultText && !state.reduced
      ? () => {
        later(() => transport.close(false), 1800);
        later(() => { preset += 1; startPreset(preset); }, 3000);
      }
      : null;
    const observer = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible) {
        if (state.autoPaused && !state.interacted) { state.autoPaused = false; transport.play(); }
        if (waiting && !state.interacted) { const run = waiting; waiting = null; run(); }
      } else if (state.status === "playing" && !state.interacted) {
        state.autoPaused = true;
        transport.pause();
      }
    }, { threshold: .4 });
    observer.observe(node);
    later(() => startPreset(0), 900);
    return () => {
      observer.disconnect();
      state.timers.forEach((timer) => window.clearTimeout(timer));
      state.timers = [];
      state.onAutoEnd = null;
    };
  }, [startsAlone, isDefaultText, transport]);

  const claimInteraction = () => {
    const state = runtime.current;
    if (state.interacted) return;
    state.interacted = true;
    state.autoPaused = false;
    state.timers.forEach((timer) => window.clearTimeout(timer));
    state.timers = [];
  };

  const timeAt = (clientX: number) => {
    const node = scrubRef.current;
    if (!node) return 0;
    const rect = node.getBoundingClientRect();
    return clamp((clientX - rect.left) / rect.width, 0, 1) * runtime.current.duration;
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!runtime.current.dragging) return;
    runtime.current.dragging = false;
    delete event.currentTarget.dataset.dragging;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    transport.seek(timeAt(event.clientX), true);
  };

  const mode: PlayMode = status === "playing"
    ? "pause"
    : status === "loading"
      ? "loading"
      : status === "ended"
        ? "replay"
        : status === "error"
          ? "retry"
          : "play";
  const view: SlotView = status === "loading" ? "loading" : status === "error" ? "error" : "timeline";
  const reading = open && (status === "playing" || status === "paused" || status === "loading" || (status === "error" && wordIndex >= 0));
  const seekable = open && (status === "playing" || status === "paused" || status === "ended");
  const totalLabel = speechDuration(duration);
  const elapsedLabel = speechDuration(Math.min(1e3 * second, duration));

  return <div
    ref={rootRef}
    className={joinClasses(styles.root, variant === "plain" && styles.plain, className)}
    style={{ "--sp-move": `${Math.round(150 / rate)}ms` } as CSSProperties}
    data-reading={reading || undefined}
    data-seekable={seekable || undefined}
    data-status={status}
    onPointerDownCapture={claimInteraction}
    onKeyDownCapture={claimInteraction}
  >
    {byline ? <div className={styles.author}>
      {byline.mark ? <span className={styles.mark} aria-hidden="true">{byline.mark}</span> : null}
      <span className={styles.authorName}>{byline.name}</span>
    </div> : null}

    <div
      ref={textRef}
      id={`${textId}-text`}
      className={styles.text}
      onClick={(event) => {
        const state = runtime.current;
        if (!state.open || (state.status !== "playing" && state.status !== "paused" && state.status !== "ended")) return;
        if (window.getSelection()?.toString()) return;
        const hit = (event.target as HTMLElement).closest<HTMLElement>("[data-word]");
        const index = hit ? Number(hit.dataset.word) : Number.NaN;
        const timing = state.timings[index];
        if (!timing) return;
        const wasEnded = state.status === "ended";
        transport.seek(timing.start, true);
        if (wasEnded) transport.play();
      }}
    >
      <span ref={highlightRef} className={styles.highlight} data-visible="false" aria-hidden="true" />
      {paragraphs.length
        ? paragraphs.map((line, lineIndex) => <p key={lineIndex} className={styles.paragraph}>
          {line.map((word, index) => <Fragment key={word.index}>
            {index ? " " : null}
            <span
              ref={(node) => { wordRefs.current[word.index] = node; }}
              className={styles.word}
              data-word={word.index}
              data-state={reading ? (word.index < wordIndex ? "spoken" : word.index === wordIndex ? "current" : "upcoming") : undefined}
            >
              {word.text}
            </span>
          </Fragment>)}
        </p>)
        : <p className={joinClasses(styles.paragraph, styles.empty)}>Nothing to read yet.</p>}
    </div>

    <div className={styles.dock}>
      <motion.div className={styles.actions} inert={open} aria-hidden={open || undefined} initial={false} {...slotMotion(!open, reduced)}>
        <button
          ref={readRef}
          type="button"
          className={styles.readAloud}
          onClick={() => transport.start(true)}
          disabled={!words.length}
          aria-describedby={`${textId}-text`}
        >
          <Volume2 size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>Read aloud</span>
        </button>
        {actions === undefined ? <ResponseActions text={body} announce={announce} /> : actions}
      </motion.div>

      <motion.div
        className={styles.player}
        role="group"
        aria-label="Read aloud player"
        inert={!open}
        aria-hidden={!open || undefined}
        initial={false}
        {...slotMotion(open, reduced)}
      >
        <button
          ref={playRef}
          type="button"
          className={styles.play}
          data-mode={mode}
          aria-label={PLAY_LABEL[mode]}
          aria-disabled={mode === "loading" || undefined}
          onClick={transport.toggle}
        >
          <PlayIcon mode={mode} reduced={reduced} />
        </button>

        <div className={styles.middle}>
          <motion.div className={styles.slot} inert={view !== "timeline"} aria-hidden={view !== "timeline" || undefined} initial={false} {...slotMotion(view === "timeline", reduced)}>
            <span className={joinClasses(styles.time, styles.elapsed)} aria-hidden="true">{elapsedLabel}</span>
            <div
              ref={scrubRef}
              className={styles.scrub}
              role="slider"
              tabIndex={0}
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.floor(duration / 1e3)}
              aria-valuenow={Math.min(second, Math.floor(duration / 1e3))}
              aria-valuetext={`${elapsedLabel} of ${totalLabel}`}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                runtime.current.dragging = true;
                event.currentTarget.dataset.dragging = "true";
                transport.seek(timeAt(event.clientX), false);
              }}
              onPointerMove={(event) => { if (runtime.current.dragging) transport.seek(timeAt(event.clientX), false); }}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={(event) => {
                const state = runtime.current;
                const jump = ({
                  ArrowRight: 2e3,
                  ArrowUp: 2e3,
                  ArrowLeft: -2e3,
                  ArrowDown: -2e3,
                  PageUp: 1e4,
                  PageDown: -1e4,
                } as Record<string, number>)[event.key];
                if (jump !== undefined) { event.preventDefault(); transport.seek(state.time + jump, true); return; }
                if (event.key === "Home") { event.preventDefault(); transport.seek(0, true); return; }
                if (event.key === "End") { event.preventDefault(); transport.seek(state.duration, true); return; }
                if (event.key === " " || event.key === "k") { event.preventDefault(); transport.toggle(); }
              }}
            >
              <span className={styles.track}><span ref={fillRef} className={styles.fill} /></span>
              <span ref={thumbRef} className={styles.thumbRail}><span className={styles.thumb} /></span>
            </div>
            <span className={joinClasses(styles.time, styles.total)} aria-hidden="true">{totalLabel}</span>
          </motion.div>

          <motion.div className={joinClasses(styles.slot, styles.message)} aria-hidden="true" initial={false} {...slotMotion(view === "loading", reduced)}>
            <TextShimmer active={view === "loading" && !reduced} className={joinClasses(styles.messageText, styles.shimmer)}>
              {message || `Preparing ${selected.name}'s voice`}
            </TextShimmer>
          </motion.div>

          <motion.div className={joinClasses(styles.slot, styles.message, styles.error)} aria-hidden="true" initial={false} {...slotMotion(view === "error", reduced)}>
            <CircleAlert size={14} strokeWidth={2} aria-hidden="true" />
            <span className={styles.messageText}>
              <span className={styles.errorLong}>Couldn&apos;t generate audio</span>
              <span className={styles.errorShort}>Audio failed</span>
            </span>
            {detail ? <span className={styles.errorDetail} title={detail}>{detail}</span> : null}
          </motion.div>
        </div>

        <Tooltip content="Playback speed">
          <button
            type="button"
            className={styles.speed}
            onClick={() => {
              const next = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length];
              runtime.current.speed = next;
              if (speed === undefined) setOwnSpeed(next);
              onSpeedChange?.(next);
              announce(`Speed ${speedLabel(next)}.`);
            }}
            aria-label={`Playback speed ${speedLabel(rate)}`}
          >
            {SPEEDS.map((value) => <span key={value} className={styles.measure} aria-hidden="true">{speedLabel(value)}</span>)}
            <AnimatePresence initial={false}>
              <motion.span
                key={rate}
                className={styles.swap}
                aria-hidden="true"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : -2, transition: leave(reduced) }}
                transition={enter(reduced)}
              >
                {speedLabel(rate)}
              </motion.span>
            </AnimatePresence>
          </button>
        </Tooltip>

        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger className={styles.voice} aria-label={`Voice: ${selected.name}`}>
            <span className={styles.voiceName} style={voiceWidth ? { width: voiceWidth } : undefined}>
              <span ref={probeRef} className={styles.voiceProbe} aria-hidden="true">{selected.name}</span>
              <AnimatePresence initial={false}>
                <motion.span
                  key={selected.id}
                  className={styles.swap}
                  aria-hidden="true"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduced ? 0 : -2, transition: leave(reduced) }}
                  transition={enter(reduced)}
                >
                  {selected.name}
                </motion.span>
              </AnimatePresence>
            </span>
            <ChevronDown className={styles.chevron} size={14} strokeWidth={2} aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            sideOffset={8}
            className={styles.menu}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
            }}
          >
            <div
              ref={menuRef}
              role="menu"
              aria-label="Voice"
              onKeyDown={(event) => {
                const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitemradio]") ?? []);
                const index = items.indexOf(document.activeElement as HTMLElement);
                const step = ({ ArrowDown: 1, ArrowUp: -1 } as Record<string, number>)[event.key];
                if (step !== undefined) {
                  event.preventDefault();
                  items[(index + step + items.length) % items.length]?.focus();
                } else if (event.key === "Home") {
                  event.preventDefault();
                  items[0]?.focus();
                } else if (event.key === "End") {
                  event.preventDefault();
                  items.at(-1)?.focus();
                }
              }}
            >
              {list.map((item) => <button
                key={item.id}
                type="button"
                role="menuitemradio"
                aria-checked={item.id === selected.id}
                className={styles.menuItem}
                onClick={() => {
                  setMenuOpen(false);
                  if (item.id === selected.id) return;
                  if (voice === undefined) setOwnVoice(item.id);
                  onVoiceChange?.(item);
                  if (!runtime.current.open) announce(`Voice set to ${item.name}.`);
                }}
              >
                <span className={styles.menuText}>
                  <span className={styles.menuName}>{item.name}</span>
                  {item.description ? <span className={styles.menuDescription}>{item.description}</span> : null}
                </span>
                <Check className={styles.menuCheck} size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>)}
            </div>
            {simulatedOnly ? <p className={styles.menuNote}>Simulated voices, no audio plays.</p> : null}
          </PopoverContent>
        </Popover>

        <Tooltip content="Stop reading">
          <button type="button" className={styles.iconButton} aria-label="Stop reading" onClick={() => transport.close(true)}>
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </Tooltip>
      </motion.div>
    </div>

    <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
  </div>;
}

export default SpeechPlayer;
