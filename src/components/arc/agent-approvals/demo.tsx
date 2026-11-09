"use client";

import AgentApprovals from "./agent-approvals";

export const meta = "Live · block";

/**
 * The live frame runs the block on its own: the sample queue arrives with five pending requests, the
 * first card holds the focus, and the remaining rows wait below. Approving, denying, or saving an
 * always allow rule settles the card, slides the next request up, and files the decision in the log.
 * The first approval of the PostgreSQL request fails on purpose, so the error row and its retry
 * button can be inspected without wiring a backend.
 */
export default function AgentApprovalsDemo() {
  return <AgentApprovals />;
}
