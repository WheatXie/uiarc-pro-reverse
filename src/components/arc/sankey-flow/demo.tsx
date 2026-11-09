/**
 * Sankey flow demo — reconstructed from the Pro preview chunk: a signup journey from acquisition
 * through activation and plan to the 90-day outcome, with a quarter switch that morphs the same
 * nodes into a second dataset.
 */
import { useId, useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import SankeyFlow, { type SankeyLink, type SankeyNode } from "./sankey-flow";
import styles from "./demo.module.css";

const NODES: SankeyNode[] = [
  { id: "organic", label: "Organic" },
  { id: "paid", label: "Paid" },
  { id: "referral", label: "Referral" },
  { id: "activated", label: "Activated" },
  { id: "inactive", label: "Not activated" },
  { id: "free", label: "Free" },
  { id: "pro", label: "Pro" },
  { id: "team", label: "Team" },
  { id: "retained", label: "Retained" },
  { id: "churned", label: "Churned" },
];

const DATA = {
  q2: {
    period: "Apr to Jun 2026",
    flows: {
      "organic>activated": 2860,
      "organic>inactive": 1740,
      "paid>activated": 1420,
      "paid>inactive": 2080,
      "referral>activated": 1120,
      "referral>inactive": 380,
      "activated>free": 3310,
      "activated>pro": 1560,
      "activated>team": 530,
      "free>retained": 1690,
      "free>churned": 1620,
      "pro>retained": 1240,
      "pro>churned": 320,
      "team>retained": 480,
      "team>churned": 50,
    },
  },
  q3: {
    period: "Jul to Sep 2026",
    flows: {
      "organic>activated": 3380,
      "organic>inactive": 1820,
      "paid>activated": 1990,
      "paid>inactive": 1910,
      "referral>activated": 1640,
      "referral>inactive": 460,
      "activated>free": 3860,
      "activated>pro": 2310,
      "activated>team": 840,
      "free>retained": 2120,
      "free>churned": 1740,
      "pro>retained": 1960,
      "pro>churned": 350,
      "team>retained": 790,
      "team>churned": 50,
    },
  },
};

const PERIODS = [
  { value: "q2", label: "Q2" },
  { value: "q3", label: "Q3" },
];

const NUMBER = new Intl.NumberFormat("en-US");

export const meta = "Live · morphs on quarter change · hover and keyboard trace";

export default function SankeyFlowDemo() {
  const id = useId();
  const [quarter, setQuarter] = useState("q3");
  const { period, flows } = DATA[quarter as keyof typeof DATA];
  const links: SankeyLink[] = Object.entries(flows).map(([key, value]) => {
    const [source, target] = key.split(">");
    return { source, target, value };
  });
  const signups = links.filter((link) => ["organic", "paid", "referral"].includes(link.source)).reduce((sum, link) => sum + link.value, 0);

  return (
    <section className={styles.card} aria-labelledby={id}>
      <div className={styles.top}>
        <div className={styles.heading}>
          <h3 id={id} className={styles.title}>
            Signup journey
          </h3>
          <p className={styles.meta}>{`${NUMBER.format(signups)} signups, ${period}`}</p>
        </div>
        <SegmentedControl label="Quarter" options={PERIODS} value={quarter} onValueChange={setQuarter} />
      </div>
      <SankeyFlow
        nodes={NODES}
        links={links}
        label={`Signup journey, ${period}`}
        columns={["Source", "Activation", "Plan", "90 days"]}
        unit="people"
        totalLabel="signups"
        formatValue={(value) => NUMBER.format(value)}
      />
    </section>
  );
}
