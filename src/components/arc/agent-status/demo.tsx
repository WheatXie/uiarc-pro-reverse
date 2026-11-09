"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import AgentStatus, { useAgentRunSimulation } from "./agent-status";
import type { AgentScenarioId } from "./agent-status";
import { Button } from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import styles from "./demo.module.css";

export const meta = "Live · component";

const options = [
  { value: "coding", label: "Coding agent" },
  { value: "research", label: "Research agent" },
];

/**
 * The live frame runs the coding agent on its own: the pill starts reading files, the timer climbs,
 * the run parks on the push approval, and clicking the pill opens the step log. Switching the
 * scenario replays a research run that fails one source fetch so the retry path can be inspected.
 */
export default function AgentStatusDemo() {
  const [scenario, setScenario] = useState<AgentScenarioId>("coding");
  const simulation = useAgentRunSimulation(scenario);

  return (
    <div className={styles.demo} data-canvas="wide">
      <div className={styles.stage}>
        <AgentStatus
          status={simulation.status}
          activity={simulation.activity}
          steps={simulation.steps}
          startedAt={simulation.startedAt}
          endedAt={simulation.endedAt}
          agent={simulation.agent}
          notice={simulation.notice}
          onPause={simulation.onPause}
          onResume={simulation.onResume}
          onStop={simulation.onStop}
          onApprove={simulation.onApprove}
          onDeny={simulation.onDeny}
          onRetry={simulation.onRetry}
          onOpenRun={simulation.onOpenRun}
        />
      </div>
      <div className={styles.controls}>
        <SegmentedControl
          label="Scenario"
          options={options}
          value={scenario}
          onValueChange={(value) => setScenario(value as AgentScenarioId)}
        />
        <Button variant="secondary" size="sm" onClick={simulation.replay}>
          <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
          Replay
        </Button>
      </div>
    </div>
  );
}
