import { TwoFactorSetup } from "./two-factor-setup";

export const meta = "Live · block";

/**
 * The shipped block starts on the scan step with the sample Northwind account: the QR encodes the
 * demo secret, the setup key reads QK7M R2XD 5LVN A3WE, and the authenticator row stays disabled
 * until the verify step has read the clock once. Continue walks the four steps end to end.
 */
export default function TwoFactorSetupDemo() {
  return <TwoFactorSetup />;
}
