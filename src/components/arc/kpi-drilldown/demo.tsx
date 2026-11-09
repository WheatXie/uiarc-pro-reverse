import { KpiDrilldown } from "./kpi-drilldown";

export const meta = "Live · block";

/** The frame shows six overview cards on the 30 day range at rest: no card open, Compare on. */
export default function KpiDrilldownDemo() {
  return <KpiDrilldown flat />;
}
