"use client";

import { useEffect, useRef, useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import TrainingRun, { useTrainingRunSimulation } from "./training-run";
import styles from "./demo.module.css";

export const meta = "Live · component";

const SCENARIOS = [
  { value: "healthy", label: "Healthy run" },
  { value: "oom", label: "Out of memory" },
];

export default function TrainingRunDemo() {
  const [scenario, setScenario] = useState<"healthy" | "oom">("healthy");
  const [active, setActive] = useState(true);
  const card = useRef<HTMLDivElement>(null);

  // The simulation freezes while the card is off screen.
  useEffect(() => {
    if (!card.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setActive(entry.isIntersecting);
    });
    observer.observe(card.current);
    return () => observer.disconnect();
  }, []);

  const simulation = useTrainingRunSimulation(scenario, active);

  return (
    <div className={styles.demo}>
      <TrainingRun
        key={scenario}
        ref={card}
        {...simulation}
        name="support-triage-v3"
        details={["LoRA r16", "8× H200"]}
      />
      <SegmentedControl
        label="Scenario"
        options={SCENARIOS}
        value={scenario}
        onValueChange={(value) => setScenario(value as "healthy" | "oom")}
      />
    </div>
  );
}
