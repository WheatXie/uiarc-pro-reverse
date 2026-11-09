"use client";

import { GenerationStats } from "./generation-stats";
import styles from "./generation-stats.module.css";

export const meta = "Live · component";

/**
 * The shipped demo rule set (`.demo` / `.frame`) lives at the end of
 * generation-stats.module.css because this item ports without a demo module.
 */
export default function GenerationStatsDemo() {
  return (
    <div className={styles.demo}>
      <div className={styles.frame}>
        <GenerationStats />
      </div>
    </div>
  );
}
