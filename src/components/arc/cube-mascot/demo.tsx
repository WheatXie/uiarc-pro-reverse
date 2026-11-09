"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";
import SegmentedControl from "../segmented-control/segmented-control";
import { Button } from "../button/button";
import TextShimmer from "../text-shimmer/text-shimmer";
import { CubeMascot, type CubeMascotStatus } from "./cube-mascot";
import styles from "./demo.module.css";

export const meta = "Live · component";

const STATES: CubeMascotStatus[] = ["idle", "thinking", "writing", "done", "error"];

const STATE_LABEL: Record<CubeMascotStatus, string> = {
  idle: "Idle",
  thinking: "Thinking",
  writing: "Writing",
  done: "Done",
  error: "Error",
};

const CAPTION: Record<CubeMascotStatus, string> = {
  idle: "Ask Atlas anything",
  thinking: "Thinking",
  writing: "Writing the release notes",
  done: "Release notes ready, 312 words",
  error: "Could not reach the repository",
};

const SIZES = [24, 32, 40, 64];

const OPTIONS = STATES.map((value) => ({ value, label: STATE_LABEL[value] }));

export default function CubeMascotDemo() {
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(true);
  const [status, setStatus] = useState<CubeMascotStatus>("idle");
  const busy = status === "thinking" || status === "writing";

  return (
    <div className={styles.demo}>
      <div className={styles.card}>
        <div className={styles.stage}>
          <CubeMascot status={playing ? undefined : status} onStatusChange={setStatus} size={160} name="Atlas" announce />
        </div>
        <div className={styles.inline}>
          <CubeMascot status={status} size={24} name="Atlas" />
          <span className={styles.line}>
            <AnimatePresence initial={false} mode="wait">
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
        <div className={styles.sizes} aria-label="Sizes">
          {SIZES.map((size) => (
            <div key={size} className={styles.size}>
              <div className={styles.sizeBox}>
                <CubeMascot status={status} size={size} name="Atlas" />
              </div>
              <span className={styles.sizeLabel}>{size}</span>
            </div>
          ))}
        </div>
        <div className={styles.controls}>
          <SegmentedControl
            options={OPTIONS}
            value={status}
            onValueChange={(value) => {
              setPlaying(false);
              setStatus(value as CubeMascotStatus);
            }}
            label="Cube state"
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
