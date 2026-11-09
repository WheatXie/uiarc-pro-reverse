"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";
import SegmentedControl from "../segmented-control/segmented-control";
import { Button } from "../button/button";
import TextShimmer from "../text-shimmer/text-shimmer";
import { GhostMascot, type GhostMascotStatus } from "./ghost-mascot";
import styles from "./demo.module.css";

export const meta = "Live · component";

const STATES: GhostMascotStatus[] = ["idle", "listening", "thinking", "writing", "done", "error"];

const STATE_LABEL: Record<GhostMascotStatus, string> = {
  idle: "Idle",
  listening: "Listening",
  thinking: "Thinking",
  writing: "Writing",
  done: "Done",
  error: "Error",
};

const CAPTION: Record<GhostMascotStatus, string> = {
  idle: "Ready when you are",
  listening: "Listening",
  thinking: "Thinking",
  writing: "Writing a reply",
  done: "Reply ready, 186 words",
  error: "Could not finish the reply",
};

const OPTIONS = STATES.map((value) => ({ value, label: STATE_LABEL[value] }));

const SIZES: { size: number; tone: "accent" | "sheet" | "ink"; label: string; wideOnly?: boolean }[] = [
  { size: 24, tone: "accent", label: "24" },
  { size: 40, tone: "accent", label: "40" },
  { size: 64, tone: "accent", label: "64" },
  { size: 64, tone: "sheet", label: "Sheet" },
  { size: 64, tone: "ink", label: "Ink", wideOnly: true },
];

export default function GhostMascotDemo() {
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(true);
  const [status, setStatus] = useState<GhostMascotStatus>("idle");
  const busy = status === "thinking" || status === "writing" || status === "listening";

  return (
    <div className={styles.demo}>
      <div className={styles.card}>
        <div className={styles.stage}>
          <GhostMascot status={playing ? undefined : status} onStatusChange={setStatus} size={152} name="Atlas" announce />
        </div>
        <div className={styles.caption}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={status}
              className={styles.captionText}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.16, ease: [0.23, 1, 0.32, 1] } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
            >
              {busy ? <TextShimmer>{CAPTION[status]}</TextShimmer> : CAPTION[status]}
            </motion.span>
          </AnimatePresence>
        </div>
        <ul className={styles.sizes} aria-label="Sizes and tones">
          {SIZES.map((item) => (
            <li key={item.label} className={[styles.size, item.wideOnly ? styles.wideOnly : null].filter(Boolean).join(" ")}>
              <span className={styles.slot}>
                <GhostMascot status={status} size={item.size} tone={item.tone} name="Atlas" />
              </span>
              <span className={styles.sizeLabel}>{item.label}</span>
            </li>
          ))}
        </ul>
        <div className={styles.controls}>
          <SegmentedControl
            options={OPTIONS}
            value={status}
            onValueChange={(value) => {
              setPlaying(false);
              setStatus(value as GhostMascotStatus);
            }}
            label="Ghost state"
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
