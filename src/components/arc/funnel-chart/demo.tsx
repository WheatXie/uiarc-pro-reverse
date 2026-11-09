/**
 * Funnel chart demo — the checkout funnel from the shipped preview chunk: five steps, a device
 * split that morphs the band, and a flow switch. The conversion line above the chart always
 * follows whichever view is on screen, so the headline and the band never disagree.
 */
import { useId, useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import Switch from "../switch/switch";
import FunnelChart, { type FunnelSegment, type FunnelStage } from "./funnel-chart";
import styles from "./demo.module.css";

export const meta = "Live · hover, split, flow";

const SEGMENTS: FunnelSegment[] = [
  { key: "mobile", label: "Mobile" },
  { key: "desktop", label: "Desktop" },
];

const STAGES: FunnelStage[] = [
  { key: "visit", label: "Visited store", values: { mobile: 68420, desktop: 31580 } },
  { key: "product", label: "Viewed product", values: { mobile: 39710, desktop: 21460 } },
  { key: "cart", label: "Added to cart", values: { mobile: 9140, desktop: 7280 } },
  { key: "checkout", label: "Started checkout", values: { mobile: 4310, desktop: 4090 } },
  { key: "purchase", label: "Purchased", values: { mobile: 1540, desktop: 2050 } },
];

const DEVICES = [
  { value: "total", label: "All" },
  { value: "mobile", label: "Mobile" },
  { value: "desktop", label: "Desktop" },
];

export default function FunnelChartDemo() {
  const id = useId();
  const [view, setView] = useState("total");
  const [split, setSplit] = useState(false);
  const [flow, setFlow] = useState(true);

  // "Split" only means something over the whole funnel, so the two controls hand each other the view.
  const resolved = view === "total" && split ? "split" : view;
  const segment = resolved === "mobile" || resolved === "desktop" ? resolved : null;
  const sum = (key: string | null) => (stage: FunnelStage) =>
    Object.entries(stage.values ?? {}).reduce((total, [name, value]) => total + (key && name !== key ? 0 : (value ?? 0)), 0);
  const conversion = ((sum(segment)(STAGES[STAGES.length - 1]) ?? 0) / (sum(segment)(STAGES[0]) || 1)) * 100;

  return (
    <section className={styles.card} aria-labelledby={id}>
      <div className={styles.top}>
        <div className={styles.heading}>
          <h3 className={styles.title} id={id}>
            Checkout funnel
          </h3>
          {/* Three text nodes, the way the shipped demo splits the count: the hidden summary reads
              the same characters either way, and the DOM walk compares node text verbatim. */}
          <p className={styles.meta}>
            {"Last 30 days, "}
            {conversion.toFixed(1)}
            {"% convert"}
          </p>
        </div>
        <div className={styles.controls}>
          <SegmentedControl
            label="Device"
            options={DEVICES}
            value={view}
            onValueChange={(next) => {
              setView(next);
              if (next !== "total") setSplit(false);
            }}
          />
          <div className={styles.switches}>
            <Switch
              label="Split"
              checked={resolved === "split"}
              onCheckedChange={(next) => {
                setSplit(next);
                if (next) setView("total");
              }}
            />
            <Switch label="Flow" checked={flow} onCheckedChange={setFlow} />
          </div>
        </div>
      </div>
      <FunnelChart
        stages={STAGES}
        segments={SEGMENTS}
        view={resolved}
        flow={flow}
        label="Checkout funnel, last 30 days"
        unit="sessions"
      />
    </section>
  );
}
