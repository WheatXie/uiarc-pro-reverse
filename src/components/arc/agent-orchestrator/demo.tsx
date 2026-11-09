"use client";

import AgentOrchestrator from "./agent-orchestrator";

export const meta = "Live · block";

/**
 * The live frame is the block on its own: the lead plans four competitor checks, then hands one to
 * each subagent. The run starts by itself once the card is in view, the Quillstack lane hits a 503
 * and retries, and the summary streams in before the totals settle.
 */
export default function AgentOrchestratorDemo() {
  return <AgentOrchestrator />;
}
