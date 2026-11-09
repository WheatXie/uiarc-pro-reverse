"use client";

import CreditTopup from "./credit-topup";

export const meta = "Live · block";

/**
 * The live frame runs the block with no props: a workspace at 840 credits, the Oct sample usage, three packs
 * with the 5,000 one selected, auto top-up off at 1,000 and the Visa on file, so every state is one click away.
 */
export default function CreditTopupDemo() {
  return <CreditTopup />;
}
