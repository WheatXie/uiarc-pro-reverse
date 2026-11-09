"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";
import SegmentedControl from "../segmented-control/segmented-control";
import { Button } from "../button/button";
import TextShimmer from "../text-shimmer/text-shimmer";
import { AiMascot, type AiMascotStatus } from "./ai-mascot";
import styles from "./demo.module.css";

export const meta = "Live · component";

const STATES: AiMascotStatus[] = ["idle", "listening", "thinking", "writing", "done", "error"];

const STATE_LABEL: Record<AiMascotStatus, string> = {
  idle: "Idle",
  listening: "Listening",
  thinking: "Thinking",
  writing: "Writing",
  done: "Done",
  error: "Error",
};

const CAPTION: Record<AiMascotStatus, string> = {
  idle: "Atlas is ready when you are",
  listening: "Listening",
  thinking: "Thinking",
  writing: "Writing a reply",
  done: "Reply ready, 214 words",
  error: "Could not finish the reply",
};

const OPTIONS = STATES.map((value) => ({ value, label: STATE_LABEL[value] }));

export default function AiMascotDemo() {
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(true);
  const [status, setStatus] = useState<AiMascotStatus>("idle");
  const busy = status === "thinking" || status === "writing" || status === "listening";

  return (
    <div className={styles.demo}>
      <div className={styles.card}>
        <div className={styles.stage}>
          <AiMascot
            status={playing ? undefined : status}
            onStatusChange={setStatus}
            size={148}
            name="Atlas"
            announce
          />
        </div>
        <div className={styles.inline}>
          <AiMascot status={status} size={24} name="Atlas" followPointer={false} />
          <span className={styles.line}>
            {STATES.map((state) => (
              <span key={state} className={styles.lineSizer} aria-hidden>
                {CAPTION[state]}
              </span>
            ))}
            <AnimatePresence initial={false}>
              <motion.span
                key={status}
                className={styles.lineText}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.16, ease: [0.23, 1, 0.32, 1] } }}
                exit={{ opacity: 0, y: 0, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }}
              >
                {busy ? <TextShimmer>{CAPTION[status]}</TextShimmer> : CAPTION[status]}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>
        <div className={styles.controls}>
          <SegmentedControl
            options={OPTIONS}
            value={status}
            onValueChange={(value) => {
              setPlaying(false);
              setStatus(value as AiMascotStatus);
            }}
            label="Mascot state"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPlaying((value) => !value)}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
            <span className={styles.playText}>{playing ? "Pause" : "Play"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
