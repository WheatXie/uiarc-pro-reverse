"use client";

import RevenueExplorer from "./revenue-explorer";

export const meta = "Live · block";

/**
 * The block ships its own sample workspace — a year of seeded MRR movements — so the demo only asks
 * the preview frame to flatten the card it would otherwise draw.
 */
export default function RevenueExplorerDemo() {
  return <RevenueExplorer flat />;
}
