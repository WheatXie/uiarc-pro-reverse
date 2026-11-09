"use client";

import CancelFlow from "./cancel-flow";

export const meta = "Live · block";

/**
 * The first step as it ships: no reason picked yet, Continue disabled, the badge reading "Renews Oct 14". Pick a
 * reason to open the note field and step into the offer, then hold the last button for 1.2 seconds to cancel.
 * The card is flat here because the captured block sits directly on the page rather than inside its own card.
 */
export default function CancelFlowDemo() {
  return <CancelFlow flat />;
}
