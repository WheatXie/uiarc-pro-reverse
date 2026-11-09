"use client";

import AgentTasks from "./agent-tasks";

export const meta = "Live · block";

/**
 * The live frame runs the block on its own: five seeded tasks sit in the panel and the running
 * one advances on its own timeline, so progress, filters and the expand/collapse controls are all
 * reachable without interaction.
 */
export default function AgentTasksDemo() {
  return <AgentTasks />;
}
