import { ChoroplethExplorer } from "./choropleth-explorer";

export const meta = "Live · block";

/**
 * The frame shows the default view: the United States shaded by annual recurring revenue, the
 * country switch, the metric switch and the ranked list of all fifty-one states. Ten states open
 * into their counties, and the rest zoom in to a single figure.
 */
export default function ChoroplethExplorerDemo() {
  return <ChoroplethExplorer flat />;
}
