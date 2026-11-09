"use client";

import { useEffect, useState } from "react";
import { Button } from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import { AiSpark, type SparkStatus } from "./ai-spark";
import styles from "./ai-spark.module.css";

export const meta = "Live · component";

/** The demo's own walk through the states: [status, hold in ms]. Error is not in the walk; it returns to idle after 600ms. */
const CYCLE: [SparkStatus, number][] = [
  ["idle", 1800],
  ["thinking", 2800],
  ["generating", 3600],
  ["done", 2200],
];

const OPTIONS = [
  { value: "idle", label: "Idle" },
  { value: "thinking", label: "Thinking" },
  { value: "generating", label: "Writing" },
  { value: "done", label: "Done" },
  { value: "error", label: "Error" },
];

const SIZES = [12, 16, 20, 24, 32, 48];

export default function AiSparkDemo() {
  const [status, setStatus] = useState<SparkStatus>("idle");
  const [playing, setPlaying] = useState(true);

  // Each status holds for its own beat, then hands over to the next one down the list.
  useEffect(() => {
    if (!playing) return;
    const index = CYCLE.findIndex(([value]) => value === status);
    const hold = index < 0 ? 600 : CYCLE[index][1];
    const next = CYCLE[(index + 1) % CYCLE.length][0];
    const id = window.setTimeout(() => setStatus(next), hold);
    return () => window.clearTimeout(id);
  }, [playing, status]);

  return (
    <div className={styles.demo}>
      <div className={styles.card}>
        <div className={styles.stage}>
          <AiSpark size={120} status={status} />
        </div>
        <div className={styles.controls}>
          <SegmentedControl
            label="Spark state"
            options={OPTIONS}
            value={status}
            onValueChange={(value) => {
              setPlaying(false);
              setStatus(value as SparkStatus);
            }}
          />
          <Button variant="ghost" size="sm" onClick={() => setPlaying((value) => !value)} aria-pressed={playing}>
            {playing ? "Pause" : "Play through"}
          </Button>
        </div>
        <div className={styles.row}>
          <div className={styles.reply}>
            <AiSpark variant="avatar" size={32} status={status} announce={false} />
            <AiSpark variant="pill" status={status} announce={false} />
          </div>
          <AiSpark variant="pill" tone="foreground" status={status} announce={false} />
        </div>
        <div className={styles.sizes} role="group" aria-label="Sizes from 12 to 48 px">
          {SIZES.map((size) => (
            <div className={styles.size} key={size}>
              <span className={styles.sizeCell}>
                <AiSpark size={size} status={status} announce={false} />
              </span>
              <span className={styles.sizeLabel}>{size}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
