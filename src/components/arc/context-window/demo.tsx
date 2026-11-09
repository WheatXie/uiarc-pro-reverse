"use client";

import ContextWindow from "./context-window";
import styles from "./context-window.module.css";

export const meta = "Live · component";

/**
 * Claude Opus 5.5 sits at 11% of a 1M window. Send a turn or attach a file to watch the grid fill,
 * switch models to see the cells re-flow against a different window, and let the 80% threshold trip
 * the automatic compaction — older messages fold into a summary.
 */
export default function ContextWindowDemo() {
  return (
    <div className={styles.demo}>
      <ContextWindow />
    </div>
  );
}
