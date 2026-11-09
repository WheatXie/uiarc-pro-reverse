"use client";

import { useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import { AiWorkflow, workflowSampleSteps } from "./ai-workflow";
import type { WorkflowStep } from "./ai-workflow";
import styles from "./ai-workflow.module.css";

export const meta = "Live · component";

const STATES = [
  { value: "passes", label: "Passes" },
  { value: "fails", label: "Fails" },
  { value: "loading", label: "Loading" },
  { value: "empty", label: "Empty" }
];

/** The sample workflow, with the Linear step set to fail on its first attempt. */
const failingSteps: WorkflowStep[] = workflowSampleSteps.map((step) =>
  step.paths
    ? {
        ...step,
        paths: step.paths.map((path) => ({
          ...path,
          steps: path.steps.map((child) =>
            child.id === "linear"
              ? { ...child, error: "Linear rejected the request: the Support team needs a project for Urgent issues." }
              : child
          )
        }))
      }
    : step
);

export default function AiWorkflowDemo() {
  const [state, setState] = useState("passes");

  return (
    <div className={styles.demo}>
      <SegmentedControl label="Preview state" options={STATES} value={state} onValueChange={setState} />
      <AiWorkflow
        key={state}
        defaultSteps={state === "empty" ? [] : state === "fails" ? failingSteps : workflowSampleSteps}
        loading={state === "loading"}
        autoPlay={state !== "loading"}
      />
    </div>
  );
}
