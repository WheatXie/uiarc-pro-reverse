"use client";

import { MixtureOfExperts } from "./mixture-of-experts";
import styles from "./mixture-of-experts.module.css";

export const meta = "Live · component";

/**
 * Fifteen tokens from one sentence walk through the gate. Each token is scored against eight experts,
 * the top two carry it through their own lane and the outputs merge at the joint, while the router
 * bars and the load-balance strip show the budget filling up. Switch to Top 1 to halve the active
 * parameters, pause to read the scores, or pin a token to hold its route in the inspector.
 */
export default function MixtureOfExpertsDemo() {
  return (
    <div className={styles.demo}>
      <MixtureOfExperts />
    </div>
  );
}
