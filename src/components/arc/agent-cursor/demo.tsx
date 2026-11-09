"use client";

import { useState } from "react";
import AgentCursor from "./agent-cursor";
import type { AgentEdit } from "./agent-cursor";
import SegmentedControl from "../segmented-control/segmented-control";
import styles from "./demo.module.css";

export const meta = "Live · component";

const options = [
  { value: "edits", label: "Edits land" },
  { value: "error", label: "Connection drops" },
];

/** The agent's request that fails: the run rejects after a pause, then the loop retries. */
function losingConnection(signal: AbortSignal): Promise<AgentEdit[]> {
  return new Promise((_, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Connection lost")), 1100);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/**
 * The live frame plays the sample run on its own and loops it: Claude selects the long goals
 * paragraph, streams a tighter rewrite, adds the Rollout heading and fixes a typo, Emma accepts,
 * and the doc resets. Switching the outcome makes the agent's request fail instead, which shows
 * the error status and Retry.
 */
export default function AgentCursorDemo() {
  const [outcome, setOutcome] = useState("edits");

  return (
    <div className={styles.demo}>
      {outcome === "error" ? (
        <AgentCursor key="error" run={losingConnection} loop simulated />
      ) : (
        <AgentCursor key="edits" />
      )}
      <SegmentedControl
        label="Run outcome"
        options={options}
        value={outcome}
        onValueChange={setOutcome}
      />
    </div>
  );
}
