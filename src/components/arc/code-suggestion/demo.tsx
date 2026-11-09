/**
 * Code suggestion demo — the card plus the three state switch the preview frame shows: the live
 * simulated suggestion, a review with no changes, and an error. Regenerate returns to the live run.
 */
import { useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import type { Segment } from "../segmented-control/segmented-control";
import { CodeSuggestion, SAMPLE_CODE } from "./code-suggestion";
import styles from "./demo.module.css";

const STATES: Segment[] = [
  { value: "live", label: "Suggestion" },
  { value: "empty", label: "No changes" },
  { value: "error", label: "Error" },
];

export const meta = "Live · component";

export default function CodeSuggestionDemo() {
  const [state, setState] = useState("live");
  const [run, setRun] = useState(0);
  const regenerate = () => {
    setState("live");
    setRun(value => value + 1);
  };

  return <div className={styles.demo}>
    <SegmentedControl options={STATES} value={state} onValueChange={setState} label="Suggestion state" className={styles.control} />
    {state === "live"
      ? <CodeSuggestion key={run} />
      : state === "empty"
        ? <CodeSuggestion code={SAMPLE_CODE} hunks={[]} filePath="src/billing" instruction="Use the shared fetch client" onRegenerate={regenerate} />
        : <CodeSuggestion code={SAMPLE_CODE} hunks={[]} status="error" filePath="src/billing" error="The model stopped responding. Nothing was changed." onRegenerate={regenerate} />}
  </div>;
}
