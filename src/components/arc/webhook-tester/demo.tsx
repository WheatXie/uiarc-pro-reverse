"use client";

import { WebhookTester } from "./webhook-tester";

export const meta = "Live · block";

/**
 * No props: the block ships five Stripe events, one sample secret and five deliveries (two failed), and the first
 * delivery is selected. With no `onSend` the endpoint is simulated, so the card sends one sample event about a second
 * after it scrolls half into view.
 */
export default function WebhookTesterDemo() {
  return <WebhookTester />;
}
