/**
 * AI setup wizard demo — reconstructed from the Pro preview chunk. The block renders with no props, so
 * it runs the simulated Ask Northwind flow on its own: it connects three sources, switches the tone and
 * a guardrail, types a test question, streams the cited answer, goes live and then resets, looping until
 * the first pointer or key press inside the card.
 */
import { AiSetupWizard } from "./ai-setup-wizard";

export const meta = "Live · block";

export default function AiSetupWizardDemo() {
  return <AiSetupWizard />;
}
