import Webhooks from "./webhooks";

export const meta = "Live · block";

/**
 * The frame opens on the Ledger sync endpoint: one delivery is still failing after its second attempt,
 * the rate sits under 100% and the inspector shows the failed request body.
 */
export default function WebhooksDemo() {
  return <Webhooks />;
}
