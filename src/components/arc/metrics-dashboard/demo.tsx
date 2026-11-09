"use client";

import MetricsDashboard from "./metrics-dashboard";

export const meta = "Live · block";

/**
 * The block ships with its own sample figures and opens on the 30-day visitors view, so rendering
 * it with no props reproduces the live frame exactly: 36,686 visitors, the 30-day line, and the
 * Top pages and Sources lists.
 */
export default function MetricsDashboardDemo() {
  return <MetricsDashboard />;
}
