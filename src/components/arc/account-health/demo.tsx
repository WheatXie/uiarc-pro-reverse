"use client";

import AccountHealth from "./account-health";

export const meta = "Live · block";

/**
 * Renders with the shipped sample account: Linear on Enterprise, a 62 health score for the last 30 days,
 * 47 days left on the term, and the streamed summary Claude writes from the five synced signals.
 */
export default function AccountHealthDemo() {
  return <AccountHealth />;
}
