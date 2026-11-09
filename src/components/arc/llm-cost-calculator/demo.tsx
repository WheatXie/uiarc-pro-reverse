"use client";

import { useEffect, useRef, useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import { LlmCostCalculator } from "./llm-cost-calculator";
import styles from "./demo.module.css";

export const meta = "Live · component";

type PreviewState = "ready" | "loading" | "error" | "empty";

export default function Demo() {
  const [state, setState] = useState<PreviewState>("ready");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div className={styles.demo}>
      <LlmCostCalculator
        loading={state === "loading"}
        error={state === "error" ? "The pricing service timed out after 10 seconds. Simulated, nothing was sent." : undefined}
        onRetry={() => {
          setState("loading");
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setState("ready"), 900);
        }}
        models={state === "empty" ? [] : undefined}
      />
      <SegmentedControl
        className={styles.states}
        label="Preview state"
        value={state}
        onValueChange={(next) => {
          window.clearTimeout(timer.current);
          setState(next as PreviewState);
        }}
        options={[
          { value: "ready", label: "Ready" },
          { value: "loading", label: "Loading" },
          { value: "error", label: "Error" },
          { value: "empty", label: "Empty" },
        ]}
      />
    </div>
  );
}
