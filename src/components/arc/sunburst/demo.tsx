/**
 * Sunburst demo — reconstructed from the Pro preview chunk: a cloud-spend card whose month toggle
 * swaps the whole hierarchy between August and September, and the sunburst drills from all teams
 * down to a single resource.
 */
import { useId, useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import Sunburst, { type SunburstNode } from "./sunburst";
import styles from "./demo.module.css";

type Month = "aug" | "sep";

/** [August, September] spend per resource, in dollars. */
const SPEND: Record<string, Record<string, Record<string, [number, number]>>> = {
  Platform: {
    Compute: { "api-cluster": [18240, 18910], "batch-workers": [9420, 8160], "edge-cache": [4080, 4310] },
    Storage: { "object-store": [6210, 6480], backups: [2130, 2190] },
    Network: { "load-balancers": [3320, 3340], egress: [5760, 6420] },
  },
  Data: {
    Warehouse: { "analytics-wh": [22480, 23900], "etl-jobs": [7830, 7120] },
    Streaming: { "event-bus": [6420, 6880], connectors: [2910, 3050] },
    Lake: { "raw-zone": [5120, 5380], "curated-zone": [3690, 3760] },
  },
  ML: {
    Training: { "gpu-train": [24600, 38900], experiments: [5230, 6870] },
    Inference: { "model-serving": [11340, 12050], embeddings: [3420, 3980] },
  },
  Product: {
    Web: { "web-app": [6140, 6260], previews: [2430, 1180] },
    Mobile: { "push-service": [1210, 1260], "api-gateway": [3920, 4010] },
    Search: { "search-index": [4630, 4890] },
  },
  Security: {
    Logging: { "siem-logs": [5440, 5610], audit: [1120, 1140] },
    Scanning: { "code-scan": [1640, 1720], secrets: [420, 430] },
  },
};

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** The same tree shape for both months, so switching the month morphs arcs instead of remounting them. */
function treeFor(index: 0 | 1): SunburstNode {
  return {
    id: "all",
    label: "All teams",
    children: Object.entries(SPEND).map(([team, services]) => ({
      id: slug(team),
      label: team,
      children: Object.entries(services).map(([service, resources]) => ({
        id: `${slug(team)}/${slug(service)}`,
        label: service,
        children: Object.entries(resources).map(([resource, spend]) => ({
          id: `${slug(team)}/${slug(service)}/${resource}`,
          label: resource,
          value: spend[index],
        })),
      })),
    })),
  };
}

const MONTHS: Record<Month, { tree: SunburstNode; period: string }> = {
  aug: { tree: treeFor(0), period: "August 2026" },
  sep: { tree: treeFor(1), period: "September 2026" },
};

const OPTIONS = [
  { value: "aug", label: "Aug" },
  { value: "sep", label: "Sep" },
];

/** Dollars at dashboard scale: two decimals of millions, one of thousands, whole dollars below. */
function money(value: number) {
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${Math.round(value)}`;
}

export const meta = "Live · drill into cloud spend by team, service and resource";

export default function SunburstDemo() {
  const id = useId();
  const [month, setMonth] = useState<Month>("sep");
  const { tree, period } = MONTHS[month];

  return (
    <section className={styles.card} aria-labelledby={id}>
      <div className={styles.top}>
        <div className={styles.heading}>
          <h3 id={id} className={styles.title}>
            Cloud spend
          </h3>
          <p className={styles.meta}>{period}</p>
        </div>
        <SegmentedControl label="Month" options={OPTIONS} value={month} onValueChange={(value) => setMonth(value as Month)} />
      </div>
      <Sunburst data={tree} label={`Cloud spend, ${period}`} formatValue={money} />
    </section>
  );
}
