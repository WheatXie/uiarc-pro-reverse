"use client";

import UsagePricing from "./usage-pricing";

export const meta = "Live · block";

/**
 * The live frame runs the block on its own. It opens on 18 seats and 15M requests a month, which
 * lands on Growth; dragging either slider, switching to yearly, and starting the trial all work
 * without any surrounding page.
 */
export default function UsagePricingDemo() {
  return <UsagePricing />;
}
