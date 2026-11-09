"use client";

import MagicLink from "./magic-link";

export const meta = "Live · block";

/**
 * The live frame renders the block with no props: Halden defaults, both providers, both inbox
 * shortcuts, and simulated sends (900ms first send, 30s resend countdown).
 */
export default function MagicLinkDemo() {
  return <MagicLink />;
}
