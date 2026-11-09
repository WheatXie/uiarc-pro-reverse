"use client";

import AgentRun from "./agent-run";

export const meta = "Live · block";

/**
 * The live frame runs the block on its own: the card sits alone in the frame, starts when it
 * scrolls into view and parks on the approval gate, so no interaction is needed to reach any state.
 */
export default function AgentRunDemo() {
  return <AgentRun />;
}
