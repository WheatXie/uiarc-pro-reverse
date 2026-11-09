"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import { VoiceControls, VoiceOrb, VoiceTranscript, useMicLevel } from "./voice-orb";
import type { VoiceOrbState } from "./voice-orb";
import styles from "./voice-orb.module.css";

export const meta = "Live · component";

const script = [
  {
    you: "Can you move my three o'clock with Marcus to tomorrow morning?",
    reply: "Done. You're meeting Marcus at 9:30 tomorrow, and I let him know.",
  },
  {
    you: "What does the rest of my afternoon look like?",
    reply: "Just the design review with Jasmine at 4. After that you're clear.",
  },
  {
    you: "Remind me to send the Q3 notes after the review.",
    reply: "Okay. I'll remind you at 5 to send the Q3 notes.",
  },
];

/** Each word holds the floor a little longer the longer it is, which is what makes the pacing feel spoken. */
const wordDelay = (word: string) => 150 + 22 * word.length;

const statusLabels: Record<VoiceOrbState, string> = {
  idle: "Ready",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

const orbLabels: Record<VoiceOrbState, string> = {
  idle: "Start voice chat",
  listening: "Send now",
  thinking: "Cancel and keep talking",
  speaking: "Interrupt",
};

export function VoiceOrbDemo() {
  const still = useReducedMotion() ?? false;
  const [state, setState] = useState<VoiceOrbState>("idle");
  const [turn, setTurn] = useState(0);
  const [word, setWord] = useState(0);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [ended, setEnded] = useState<number | null>(null);
  const orbButton = useRef<HTMLButtonElement>(null);
  const active = state !== "idle";
  const mic = useMicLevel(active);
  const outputLevel = useMotionValue(0);
  const line = script[turn % script.length];
  const { duration, ease, blur } = motionTokens;

  function start() {
    setEnded(null);
    setElapsed(0);
    setTurn(0);
    setWord(0);
    setMuted(false);
    setState("listening");
  }

  function end() {
    setEnded(elapsed);
    setState("idle");
    setWord(0);
    setMuted(false);
  }

  // One timer drives the whole script: listening reveals the question word by word, thinking holds,
  // then speaking reveals the reply and hands the floor back.
  useEffect(() => {
    if (state === "idle") return;
    let timer = 0;
    if (state === "listening") {
      if (muted) return;
      const words = line.you.split(" ");
      timer = window.setTimeout(
        () => (word < words.length ? setWord(word + 1) : setState("thinking")),
        word === 0 ? 900 : word < words.length ? wordDelay(words[word - 1]) : 700,
      );
    } else if (state === "thinking") {
      timer = window.setTimeout(() => {
        setWord(0);
        setState("speaking");
      }, 1500);
    } else {
      const words = line.reply.split(" ");
      timer = window.setTimeout(
        () => {
          if (word < words.length) setWord(word + 1);
          else {
            setTurn((current) => current + 1);
            setWord(0);
            setState("listening");
          }
        },
        word === 0 ? 260 : word < words.length ? wordDelay(words[word - 1]) : 1300,
      );
    }
    return () => window.clearTimeout(timer);
  }, [state, word, muted, line]);

  // A pulse per spoken word, so the orb's light rides the delivery instead of a single ramp.
  useEffect(() => {
    if (state !== "speaking" || word === 0) return;
    const pulse = animate(outputLevel, [0.95, 0.12], { duration: 0.32, ease: [...ease.enter] });
    return () => pulse.stop();
  }, [state, word, outputLevel, ease.enter]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  const transcript = state === "idle"
    ? {
      key: `idle-${ended ?? "new"}`,
      text: ended === null
        ? "Tap the orb and ask about your calendar."
        : `Call ended after ${Math.floor(ended / 60)}:${String(ended % 60).padStart(2, "0")}.`,
      speaker: "system" as const,
      complete: true,
    }
    : state === "speaking"
      ? {
        key: `reply-${turn}`,
        text: line.reply.split(" ").slice(0, word).join(" "),
        speaker: "assistant" as const,
        complete: word >= line.reply.split(" ").length,
      }
      : {
        key: `you-${turn}`,
        text: line.you.split(" ").slice(0, word).join(" "),
        speaker: "user" as const,
        complete: state === "thinking",
      };

  const status = state === "listening" && muted ? "Muted" : statusLabels[state];
  const note = mic.source === "requesting"
    ? "Waiting for microphone permission"
    : mic.source === "off"
      ? "Uses your microphone level only, if you allow it."
      : "";

  const hidden = still ? { opacity: 0 } : { opacity: 0, y: 4, filter: `blur(${blur.soft}px)` };

  return (
    <div
      className={styles.demo}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !active) return;
        event.preventDefault();
        end();
        orbButton.current?.focus();
      }}
    >
      <p className={styles.status} aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={status}
            className={styles.statusText}
            initial={hidden}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ ...hidden, transition: { duration: duration.instant } }}
            transition={still ? { duration: duration.instant } : { duration: duration.standard, ease: [...ease.enter] }}
          >
            {status}
          </motion.span>
        </AnimatePresence>
      </p>
      <button
        ref={orbButton}
        type="button"
        className={styles.orbButton}
        onClick={() => {
          if (state === "idle") start();
          else if (state === "listening") {
            if (word > 0) {
              setWord(line.you.split(" ").length);
              setState("thinking");
            }
          } else {
            if (state === "thinking") setWord(line.you.split(" ").length);
            else {
              setTurn((current) => current + 1);
              setWord(0);
            }
            setState("listening");
          }
        }}
        aria-label={orbLabels[state]}
        disabled={state === "listening" && word === 0}
      >
        <VoiceOrb
          state={state}
          inputLevel={mic.source === "microphone" || mic.source === "simulated" ? mic.level : undefined}
          outputLevel={outputLevel}
          muted={muted}
          size={200}
        />
      </button>
      <VoiceTranscript text={transcript.text} turn={transcript.key} speaker={transcript.speaker} complete={transcript.complete} />
      <VoiceControls
        active={active}
        muted={muted}
        elapsed={elapsed}
        onStart={start}
        onMuteChange={setMuted}
        onEnd={end}
      />
      <p className={styles.note} aria-live="polite">
        {note}
      </p>
    </div>
  );
}

export default VoiceOrbDemo;
