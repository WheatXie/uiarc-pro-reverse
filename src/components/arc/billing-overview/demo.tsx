"use client";

import BillingOverview from "./billing-overview";

export const meta = "Live · block";

/**
 * No props: the block ships its own sample workspace (Growth plan on monthly billing, a card ending
 * 7719 and four invoices), which is exactly the state the live frame is photographed in.
 */
export default function BillingOverviewDemo() {
  return <BillingOverview />;
}
