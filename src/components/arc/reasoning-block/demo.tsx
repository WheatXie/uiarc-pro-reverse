"use client";

import { useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import ReasoningBlock, { SIM_SCENE_STEPS as STEPS } from "./reasoning-block";
import styles from "./reasoning-block.module.css";

export const meta = "Live · component";

const OPTIONS = [
  { value: "live", label: "Live" },
  { value: "done", label: "Finished" },
  { value: "error", label: "Interrupted" },
];

const INTERRUPTED = [
  STEPS[0],
  {
    title: STEPS[1].title,
    text: STEPS[1].text.split(" ").slice(0, 14).join(" "),
  },
];

/**
 * A reasoning trace that streams in, collapses to a two-line tail, and opens into the full panel.
 * The prototype plays the live session on its own; the Finished and Interrupted states show the
 * settled and failed shapes.
 */
export default function ReasoningBlockDemo() {
  const [state, setState] = useState("live");

  return (
    <div className={styles.demo}>
      <SegmentedControl
        label="Reasoning state"
        options={OPTIONS}
        value={state}
        onValueChange={setState}
      />
      <div className={styles.stage}>
        {state === "live" ? (
          <ReasoningBlock key="live" />
        ) : state === "done" ? (
          <ReasoningBlock key="done" reasoning={STEPS} status="done" seconds={7} defaultOpen />
        ) : (
          <ReasoningBlock
            key="error"
            reasoning={INTERRUPTED}
            status="error"
            seconds={3}
            error="The connection dropped before Claude finished. Retry to think again."
            onRetry={() => setState("live")}
          />
        )}
      </div>
    </div>
  );
}
