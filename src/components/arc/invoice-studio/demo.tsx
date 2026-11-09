import { InvoiceStudio } from "./invoice-studio";

export const meta = "Live · block";

/** Starts at rest with three sample lines and a $2,646.00 total due. */
export default function InvoiceStudioDemo() {
  return <InvoiceStudio />;
}
