import { CheckoutSummary } from "./checkout-summary";

export const meta = "Live · block";

/**
 * The frame shows the sample order: Field notes yearly at $96, the yearly-billing discount and
 * 8.5% tax already applied ($78.12 due), with the promo field waiting for WELCOME10.
 */
export default function CheckoutSummaryDemo() {
  return <CheckoutSummary flat />;
}
