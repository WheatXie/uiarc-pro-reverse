"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import SegmentedControl from "../segmented-control/segmented-control";
import { PixelMascot, usePixelMascotLoop } from "./pixel-mascot";
import styles from "./demo.module.css";

export const meta = "Live · component";

const STATES = [
  { value: "auto", label: "Auto" },
  { value: "idle", label: "Idle" },
  { value: "thinking", label: "Thinking" },
  { value: "writing", label: "Writing" },
  { value: "done", label: "Done" },
  { value: "error", label: "Error" },
];

const CAPTION: Record<string, string> = {
  idle: "Ready when you are",
  thinking: "Thinking it through",
  writing: "Writing the reply",
  done: "Reply ready",
  error: "Could not finish, try again",
};

const SIZES = [1, 2, 3, 4];

export default function PixelMascotDemo() {
  const [state, setState] = useState("auto");
  const looped = usePixelMascotLoop(state === "auto");
  const status = state === "auto" ? looped : (state as "idle" | "thinking" | "writing" | "done" | "error");
  const reduced = useReducedMotion();

  return (
    <div className={styles.demo}>
      <div className={styles.stage}>
        <PixelMascot status={status} size={6} name="Arc" announce={state !== "auto"} />
        <p className={styles.caption}>
          <AnimatePresence initial={false}>
            <motion.span
              key={status}
              className={styles.captionText}
              initial={{ opacity: 0, y: reduced ? 0 : 2 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] } }}
              exit={{ opacity: 0, transition: { duration: 0.1, ease: "easeOut" } }}
            >
              {CAPTION[status]}
            </motion.span>
          </AnimatePresence>
        </p>
      </div>
      <SegmentedControl label="Mascot state" options={STATES} value={state} onValueChange={setState} />
      <div className={styles.sizes} aria-label="Sizes">
        {SIZES.map((size) => (
          <figure key={size} className={styles.size}>
            <PixelMascot status={status} size={size} name="Arc" announce={false} />
            <figcaption>{size}x</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
