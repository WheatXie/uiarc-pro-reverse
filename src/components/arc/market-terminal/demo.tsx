import { MarketTerminal } from "./market-terminal";

export const meta = "Live · block";

/** NVDA on six months of daily candles, trading live against the sample order book. */
export default function MarketTerminalDemo() {
  return <MarketTerminal />;
}
