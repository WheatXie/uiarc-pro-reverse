"use client";

import { BranchGraph } from "./branch-graph";
import styles from "./demo.module.css";

export const meta = "Live · component";

export default function Demo() {
  return (
    <div className={styles.demo} data-canvas="wide">
      <BranchGraph />
    </div>
  );
}
