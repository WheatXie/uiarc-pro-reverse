"use client";

import { useMemo, useState } from "react";
import { Switch } from "../switch/switch";
import { AiCommand, createSimulatedEngine } from "./ai-command";
import styles from "./demo.module.css";

export const meta = "Live · component";

export default function AiCommandDemo() {
  const [failures, setFailures] = useState(false);
  const onAsk = useMemo(
    () => (failures ? createSimulatedEngine({ failures: true }) : undefined),
    [failures],
  );

  return (
    <div className={styles.demo}>
      <AiCommand
        key={failures ? "failures" : "sample"}
        onAsk={onAsk}
        autoPlay={!failures}
      />
      <div className={styles.controls}>
        <Switch label="Simulate failures" checked={failures} onCheckedChange={setFailures} />
      </div>
    </div>
  );
}
