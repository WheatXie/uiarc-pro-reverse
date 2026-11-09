"use client";

import DomainVerify from "./domain-verify";

export const meta = "Live · block";

/**
 * With no handlers the card plays the whole flow by itself: it adds app.acme.com, shows the three
 * records, hits a proxied CNAME, retries, verifies and issues the certificate — no DNS is queried.
 * Touching anything inside hands control to the person.
 */
export default function DomainVerifyDemo() {
  return <DomainVerify />;
}
