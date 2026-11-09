"use client";

import { AgentLoop } from "./agent-loop";
import styles from "./agent-loop.module.css";

export const meta = "Live · component";

/** The frame's own demo: the autoplaying triage run, centred in the item's own 760px shell. */
export default function AgentLoopDemo() {
  return (
    <div className={styles.demo}>
      <AgentLoop />
    </div>
  );
}
