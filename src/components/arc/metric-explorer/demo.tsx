import { MetricExplorer } from "./metric-explorer";

export const meta = "Live · block";

/**
 * The frame shows the closed state: four KPI cards for Parcelwise, each with its change and a
 * thirty day sparkline. Opening a card morphs it into the chart for that metric.
 */
export default function MetricExplorerDemo() {
  return <MetricExplorer />;
}
