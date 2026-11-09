"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Mic, Pause, Play, Send, Square, X } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./voice-recorder.module.css";

export interface VoiceMessage {
  id: string;
  /** Length in seconds. */
  duration: number;
  /** Normalized 0–1 bar heights, one per drawn bar. */
  peaks: number[];
  /** Sender name. Omit for a note you recorded yourself. */
  from?: string;
  /** Avatar image for the sender. */
  avatar?: string;
  /** Timestamp under the bubble, e.g. "9:38 AM". */
  meta?: string;
}

export interface VoiceRecorderProps {
  defaultMessages?: VoiceMessage[];
  onSend?: (message: VoiceMessage) => void;
  onCancel?: () => void;
  /** Hard stop in seconds; recording rolls into review when it is reached. */
  maxDuration?: number;
  sentMeta?: string;
  label?: string;
  className?: string;
}

type Phase = "idle" | "recording" | "review";

const BAR_STEP = 90;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

const easeStandard = [...motionTokens.ease.standard] as [number, number, number, number];
const easeExit = [...motionTokens.ease.exit] as [number, number, number, number];

/** Deterministic pseudo-audio: same seed and index always give the same bar height. */
function level(index: number, seed = 0) {
  const step = index + 97 * seed;
  const swell = 0.55 + 0.45 * Math.sin(0.05 * step + seed);
  const noise = 43758.5453 * Math.sin(127.1 * step + 311.7);
  return clamp(
    (0.22 + 0.78 * Math.abs(Math.sin(0.55 * step + 1.7 * Math.sin(0.13 * step)))) *
      swell *
      (Math.sin(0.085 * step + 1.3 * seed) > 0.8 ? 0.14 : 1) *
      (0.62 + 0.38 * (noise - Math.floor(noise))),
    0.07,
    1,
  );
}

export function peaksFor(
  seed: number,
  duration: number,
  count = Math.round(clamp(14 + 1.3 * duration, 18, 36)),
) {
  const samples = Math.max(count, Math.round((1000 * duration) / BAR_STEP));
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index * samples) / count);
    const end = Math.max(start + 1, Math.floor(((index + 1) * samples) / count));
    let peak = 0;
    for (let sample = start; sample < end; sample += 1) peak = Math.max(peak, level(sample, seed));
    return Math.round(100 * peak) / 100;
  });
}

/** Live waveform: newest bar at the trailing edge, older bars scrolling left. */
function drawWave(canvas: HTMLCanvasElement | null, elapsed: number, seed: number, reduced: boolean) {
  if (!canvas) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  const ratio = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(width * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = getComputedStyle(canvas).color;

  const head = reduced ? BAR_STEP * Math.floor(elapsed / BAR_STEP) : elapsed;
  const newest = Math.floor(head / BAR_STEP);
  const count = Math.ceil(width / 5) + 2;
  for (let index = newest; index > newest - count && index >= 0; index -= 1) {
    const local = head - BAR_STEP * index;
    const x = width - 2 - (local / BAR_STEP) * 5;
    if (x < -3) break;
    const fade = reduced ? 1 : clamp(local / 140, 0, 1);
    const barHeight = Math.max(3, level(index, seed) * (height - 4) * fade);
    context.globalAlpha = clamp(x / (0.25 * width), 0.25, 1);
    context.beginPath();
    context.roundRect(x, (height - barHeight) / 2, 3, barHeight, 1.5);
    context.fill();
  }
  context.globalAlpha = 1;
}

function Bars({
  peaks,
  progress,
  className,
}: {
  peaks: number[];
  progress: MotionValue<number>;
  className?: string;
}) {
  const clip = useTransform(progress, (value) => `inset(0 ${(1 - clamp(value, 0, 1)) * 100}% 0 0)`);
  const bars = peaks.map((peak, index) => (
    <span key={index} style={{ height: `${Math.max(12, 100 * peak)}%` }} />
  ));
  return (
    <span className={[styles.bars, className].filter(Boolean).join(" ")} aria-hidden="true">
      <span className={styles.barsLayer}>{bars}</span>
      <motion.span className={styles.barsLayer} data-played="true" style={{ clipPath: clip }}>
        {bars}
      </motion.span>
    </span>
  );
}

function usePlayer(duration: number) {
  const progress = useMotionValue(0);
  const [playing, setPlaying] = useState(false);
  const state = useRef({ playing, duration });

  useEffect(() => {
    state.current = { playing, duration };
  });

  useAnimationFrame((_time, delta) => {
    if (!state.current.playing) return;
    const next = progress.get() + delta / 1000 / state.current.duration;
    if (next >= 1) {
      progress.set(1);
      setPlaying(false);
      return;
    }
    progress.set(next);
  });

  return {
    progress,
    playing,
    toggle: () => {
      if (!playing && progress.get() >= 1) progress.set(0);
      setPlaying(!playing);
    },
    setPlaying,
  };
}

function MessageRow({ message, layoutId }: { message: VoiceMessage; layoutId: string }) {
  const { progress, playing, toggle } = usePlayer(message.duration);
  const [elapsed, setElapsed] = useState(0);
  const mine = !message.from;

  useEffect(() => progress.on("change", (value) => setElapsed(Math.floor(value * message.duration))), [
    progress,
    message.duration,
  ]);

  const label = `${playing ? "Pause" : "Play"} voice message${
    message.from ? ` from ${message.from}` : ""
  }, ${formatTime(message.duration)}`;

  return (
    <li className={styles.message} data-mine={mine || undefined}>
      {mine ? null : message.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.avatar} src={message.avatar} alt="" width={28} height={28} draggable={false} />
      ) : (
        <span className={styles.avatar} aria-hidden="true" />
      )}
      <div className={styles.messageBody}>
        <motion.div
          layoutId={layoutId}
          className={styles.bubble}
          style={{ borderRadius: 22 }}
          transition={motionTokens.spring.morph}
        >
          <motion.button
            layout="position"
            type="button"
            className={styles.bubblePlay}
            aria-label={label}
            onClick={toggle}
            transition={motionTokens.spring.morph}
          >
            {playing ? (
              <Pause size={14} strokeWidth={2} fill="currentColor" aria-hidden="true" />
            ) : (
              <Play size={14} strokeWidth={2} fill="currentColor" aria-hidden="true" />
            )}
          </motion.button>
          <motion.span
            layout="position"
            className={styles.bubbleWave}
            transition={motionTokens.spring.morph}
            onPointerDown={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              progress.set(clamp((event.clientX - rect.left) / rect.width, 0, 1));
            }}
          >
            <Bars peaks={message.peaks} progress={progress} />
          </motion.span>
          <motion.span layout="position" className={styles.bubbleTime} transition={motionTokens.spring.morph}>
            {formatTime(playing || elapsed > 0 ? elapsed : message.duration)}
          </motion.span>
        </motion.div>
        {message.meta ? <span className={styles.meta}>{message.meta}</span> : null}
      </div>
    </li>
  );
}

/**
 * A voice-note composer that records, reviews and sends in place. The mic button, the recording
 * capsule and the sent bubble share one layout id, so the control physically becomes the message.
 * Recording draws a live waveform on a canvas; review replays it with a scrubbable progress fill.
 */
export function VoiceRecorder({
  defaultMessages = [],
  onSend,
  onCancel,
  maxDuration = 60,
  sentMeta = "Just now",
  label = "Voice messages",
  className,
}: VoiceRecorderProps) {
  const reduced = useReducedMotion() ?? false;
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const statusId = `${reactId}-status`;
  const takeId = (value: number) => `${reactId}-take-${value}`;

  const [messages, setMessages] = useState<VoiceMessage[]>(defaultMessages);
  const [phase, setPhase] = useState<Phase>("idle");
  const [take, setTake] = useState(0);
  const [takeInfo, setTakeInfo] = useState({ seed: 1, duration: 0 });
  const [status, setStatus] = useState("");
  const [enterMode, setEnterMode] = useState<"fold" | "pop">("fold");
  const [seconds, setSeconds] = useState(0);

  const elapsed = useMotionValue(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const threadRef = useRef<HTMLOListElement | null>(null);
  const actionRef = useRef<HTMLButtonElement | null>(null);
  const phaseRef = useRef<Phase>(phase);
  const mounted = useRef(false);

  const review = usePlayer(Math.max(1, takeInfo.duration));
  const timer = useTransform(elapsed, (value) => `${formatTime(value / 1000)}.${Math.floor((value % 1000) / 100)}`);
  const playhead = useTransform(review.progress, (value) => formatTime(value * takeInfo.duration));

  function stopTake() {
    const duration = Math.max(1, Math.round(elapsed.get() / 100) / 10);
    phaseRef.current = "review";
    setTakeInfo((current) => ({ ...current, duration }));
    review.progress.set(0);
    review.setPlaying(false);
    setStatus(`Recorded ${formatTime(duration)}. Play it back or send it.`);
    setPhase("review");
  }

  function discard() {
    phaseRef.current = "idle";
    review.setPlaying(false);
    setTake((current) => current - 1);
    setEnterMode("fold");
    setStatus("Voice note discarded");
    setPhase("idle");
    onCancel?.();
  }

  useEffect(() => {
    phaseRef.current = phase;
  });

  useAnimationFrame((_time, delta) => {
    if (phaseRef.current !== "recording") return;
    const next = Math.min(elapsed.get() + delta, 1000 * maxDuration);
    elapsed.set(next);
    drawWave(canvasRef.current, next, takeInfo.seed, reduced);
    const whole = Math.floor(next / 1000);
    if (whole !== seconds) setSeconds(whole);
    if (next >= 1000 * maxDuration) stopTake();
  });

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    actionRef.current?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => {
    const thread = threadRef.current;
    thread?.scrollTo({ top: thread.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [messages.length, reduced]);

  const fade = {
    initial: { opacity: 0, filter: `blur(${motionTokens.blur.subtle}px)` },
    animate: {
      opacity: 1,
      filter: "blur(0px)",
      transition: {
        duration: motionTokens.duration.standard,
        ease: easeStandard,
        delay: reduced ? 0 : 0.05,
      },
    },
    exit: {
      opacity: 0,
      filter: `blur(${motionTokens.blur.subtle}px)`,
      transition: { duration: motionTokens.duration.instant, ease: easeExit },
    },
  };

  const pop = {
    initial: { opacity: 0, scale: 0.7 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.7, transition: { duration: motionTokens.duration.instant } },
    transition: motionTokens.spring.snappy,
  };

  return (
    <MotionConfig reducedMotion="user">
      <section className={[styles.root, className].filter(Boolean).join(" ")} aria-label={label}>
        <LayoutGroup>
          <ol ref={threadRef} className={styles.thread} aria-label="Messages">
            {messages.map((message) => (
              <MessageRow key={message.id} message={message} layoutId={`vr-${message.id}`} />
            ))}
          </ol>
          <div
            className={styles.composer}
            data-phase={phase}
            onKeyDown={(event) => {
              if (event.key === "Escape" && phase !== "idle") {
                event.preventDefault();
                discard();
              }
            }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {phase === "idle" ? (
                <motion.span key="hint" className={styles.hint} {...fade}>
                  Tap the mic to record a voice note
                </motion.span>
              ) : null}
            </AnimatePresence>
            <AnimatePresence initial={false} mode="popLayout">
              {phase !== "idle" ? (
                <motion.button
                  key="discard"
                  type="button"
                  className={styles.discard}
                  aria-label="Discard voice note"
                  onClick={discard}
                  {...pop}
                >
                  <X size={18} strokeWidth={1.75} aria-hidden="true" />
                </motion.button>
              ) : null}
            </AnimatePresence>
            {phase === "idle" ? (
              <motion.button
                key="mic"
                ref={actionRef}
                layoutId={`vr-${takeId(take + 1)}`}
                type="button"
                className={styles.mic}
                aria-label="Record voice note"
                aria-describedby={statusId}
                initial={enterMode === "pop" ? { opacity: 0, scale: 0.8 } : false}
                animate={{ opacity: 1, scale: 1 }}
                style={{ borderRadius: 999 }}
                transition={motionTokens.spring.morph}
                onClick={() => {
                  const next = take + 1;
                  elapsed.set(0);
                  setSeconds(0);
                  setTake(next);
                  setTakeInfo({ seed: 7 * next + 3, duration: 0 });
                  setStatus("Recording");
                  phaseRef.current = "recording";
                  setPhase("recording");
                }}
              >
                <motion.span layout="position" className={styles.micIcon} transition={motionTokens.spring.morph}>
                  <Mic size={20} strokeWidth={1.75} aria-hidden="true" />
                </motion.span>
              </motion.button>
            ) : (
              <motion.div
                key="capsule"
                layoutId={`vr-${takeId(take)}`}
                className={styles.capsule}
                data-phase={phase}
                style={{ borderRadius: 999 }}
                transition={motionTokens.spring.morph}
              >
                <AnimatePresence initial={false} mode="popLayout">
                  {phase === "recording" ? (
                    <motion.div key="recording" layout="position" className={styles.capsuleRow} {...fade}>
                      <span className={styles.recDot} aria-hidden="true" />
                      <motion.span className={styles.timer} aria-hidden="true">
                        {timer}
                      </motion.span>
                      <canvas ref={canvasRef} className={styles.live} aria-hidden="true" />
                    </motion.div>
                  ) : (
                    <motion.div key="review" layout="position" className={styles.capsuleRow} {...fade}>
                      <button
                        type="button"
                        className={styles.reviewPlay}
                        aria-label={review.playing ? "Pause preview" : "Play preview"}
                        onClick={review.toggle}
                      >
                        {review.playing ? (
                          <Pause size={14} strokeWidth={2} fill="currentColor" aria-hidden="true" />
                        ) : (
                          <Play size={14} strokeWidth={2} fill="currentColor" aria-hidden="true" />
                        )}
                      </button>
                      <span
                        className={styles.reviewWave}
                        onPointerDown={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          review.progress.set(clamp((event.clientX - rect.left) / rect.width, 0, 1));
                        }}
                      >
                        <Bars peaks={peaksFor(takeInfo.seed, takeInfo.duration, 40)} progress={review.progress} />
                      </span>
                      <motion.span className={styles.timer} aria-hidden="true">
                        {review.playing ? playhead : formatTime(takeInfo.duration)}
                      </motion.span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
            <AnimatePresence initial={false} mode="popLayout">
              {phase === "recording" ? (
                <motion.button
                  key="stop"
                  ref={actionRef}
                  type="button"
                  className={styles.stop}
                  aria-label={`Stop recording at ${formatTime(seconds)}`}
                  onClick={stopTake}
                  {...pop}
                >
                  <Square size={14} strokeWidth={2} fill="currentColor" aria-hidden="true" />
                </motion.button>
              ) : null}
              {phase === "review" ? (
                <motion.button
                  key="send"
                  ref={actionRef}
                  type="button"
                  className={styles.send}
                  aria-label="Send voice note"
                  onClick={() => {
                    const message: VoiceMessage = {
                      id: takeId(take),
                      duration: takeInfo.duration,
                      peaks: peaksFor(takeInfo.seed, takeInfo.duration),
                      meta: sentMeta,
                    };
                    review.setPlaying(false);
                    setMessages((current) => [...current, message]);
                    setEnterMode("pop");
                    setStatus("Voice note sent");
                    phaseRef.current = "idle";
                    setPhase("idle");
                    onSend?.(message);
                  }}
                  {...pop}
                >
                  <Send size={18} strokeWidth={2} aria-hidden="true" />
                </motion.button>
              ) : null}
            </AnimatePresence>
          </div>
        </LayoutGroup>
        <p id={statusId} className={styles.srOnly} aria-live="polite">
          {status}
        </p>
      </section>
    </MotionConfig>
  );
}

export default VoiceRecorder;
