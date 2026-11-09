"use client";

import AgentTimeline from "./agent-timeline";
import styles from "./agent-timeline.module.css";

export const meta = "Live · component";

/**
 * The sample incident investigation replays itself: five agents share one axis, the orchestrator's waiting
 * spans fill the gaps while handoffs draw in, a failed PostgreSQL call turns into a cross, and the header
 * counts time, tokens and cost until it settles into the run summary.
 */
export default function AgentTimelineDemo() {
  return (
    <div className={styles.demo}>
      <AgentTimeline />
    </div>
  );
}
