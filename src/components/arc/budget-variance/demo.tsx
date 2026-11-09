import { BudgetVariance } from "./budget-variance";

export const meta = "Live · block";

/**
 * The frame shows the September window with Engineering open: five lines, two of them past
 * the tolerance band, and the total sitting just under plan.
 */
export default function BudgetVarianceDemo() {
  return <BudgetVariance flat />;
}
