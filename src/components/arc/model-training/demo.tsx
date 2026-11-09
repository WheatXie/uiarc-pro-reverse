"use client";

import { ModelTraining } from "./model-training";
import styles from "./demo.module.css";

export const meta = "Live · component";

export default function Demo() {
  return (
    <div className={styles.demo} data-canvas="wide">
      <ModelTraining
        classes={["Positive", "Negative"]}
        samples={12_800}
        heldOutSamples={1_600}
        batchSize={32}
        epochs={12}
        lossFrom={0.69}
        lossTo={0.08}
        accuracy={94.2}
        target={90}
      />
    </div>
  );
}
