/**
 * Radar chart demo — the office shortlist from the shipped preview chunk. Lisbon is fixed in the
 * first slot; the switch picks the profile it is compared with, so changing it morphs the second
 * shape instead of redrawing the web. Same axes, same scores, same copy as the live demo.
 */
import { useId, useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import RadarChart, { type RadarAxis, type RadarSeries } from "./radar-chart";
import styles from "./demo.module.css";

export const meta = "Live · hover, keyboard, morphing shapes";

const AXES: RadarAxis[] = [
  { key: "talent", label: "Talent pool" },
  { key: "afford", label: "Affordability" },
  { key: "transit", label: "Transit" },
  { key: "timezone", label: "Time zone fit" },
  { key: "life", label: "Quality of life" },
  { key: "tax", label: "Tax climate" },
];

type OfficeKey = "lisbon" | "berlin" | "toronto" | "austin";

const OFFICES: Record<OfficeKey, RadarSeries> = {
  lisbon: {
    key: "lisbon",
    label: "Lisbon",
    values: { talent: 64, afford: 78, transit: 71, timezone: 88, life: 86, tax: 66 },
  },
  berlin: {
    key: "berlin",
    label: "Berlin",
    values: { talent: 86, afford: 58, transit: 92, timezone: 80, life: 78, tax: 46 },
  },
  toronto: {
    key: "toronto",
    label: "Toronto",
    values: { talent: 81, afford: 42, transit: 64, timezone: 72, life: 82, tax: 55 },
  },
  austin: {
    key: "austin",
    label: "Austin",
    values: { talent: 74, afford: 54, transit: 26, timezone: 60, life: 71, tax: 84 },
  },
};

const CHOICES: { value: OfficeKey; label: string }[] = [
  { value: "berlin", label: "Berlin" },
  { value: "toronto", label: "Toronto" },
  { value: "austin", label: "Austin" },
];

export default function RadarChartDemo() {
  const headingId = useId();
  const [compare, setCompare] = useState<OfficeKey>("berlin");
  const rival = OFFICES[compare];

  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <div className={styles.top}>
        <div className={styles.heading}>
          <h3 id={headingId} className={styles.title}>
            Lisbon compared with
          </h3>
          <p className={styles.meta}>Second office shortlist, scored out of 100</p>
        </div>
        <SegmentedControl
          label="Compare with"
          options={CHOICES}
          value={compare}
          onValueChange={value => setCompare(value as OfficeKey)}
        />
      </div>
      <RadarChart axes={AXES} series={[OFFICES.lisbon, rival]} label={`Office locations, Lisbon and ${rival.label}`} />
    </section>
  );
}
