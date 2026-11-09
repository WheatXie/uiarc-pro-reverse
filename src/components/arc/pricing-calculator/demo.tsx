import { PricingCalculator } from "./pricing-calculator";

export const meta = "Live · block";

/**
 * The frame shows the calculator at its default: 20 seats on yearly billing, the Team plan
 * recommended and selected, $16 per seat, $3,840 billed once a year.
 */
export default function PricingCalculatorDemo() {
  return <PricingCalculator flat />;
}
