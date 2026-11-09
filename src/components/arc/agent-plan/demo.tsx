"use client";

import AgentPlan from "./agent-plan";
import styles from "./agent-plan.module.css";

export const meta = "Live · component";

/**
 * The plan opens as a draft: six editable steps, a grip on each row and the two footer actions.
 * Approving it runs the simulation on its own — steps stream their activity, one gets added mid-run,
 * the test step fails once so Retry and Skip are reachable, and the footer settles into the summary.
 */
export default function AgentPlanDemo() {
  return (
    <div className={styles.demo}>
      <AgentPlan />
    </div>
  );
}
