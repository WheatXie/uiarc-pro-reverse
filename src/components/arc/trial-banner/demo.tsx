import { useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import { TrialBanner, type TrialBannerVariant } from "./trial-banner";
import styles from "./trial-banner.module.css";

export const meta = "Live · component";

const VARIANTS = [
  { value: "banner", label: "Banner" },
  { value: "card", label: "Sidebar card" },
  { value: "pill", label: "Pill" },
];

const TRIALS = [
  { value: "9", label: "9 days left" },
  { value: "2", label: "2 days left" },
  { value: "0", label: "Expired" },
];

export default function TrialBannerDemo() {
  const [variant, setVariant] = useState<TrialBannerVariant>("banner");
  const [trial, setTrial] = useState("9");

  return (
    <div className={styles.demo}>
      <div className={styles.controls}>
        <SegmentedControl label="Variant" options={VARIANTS} value={variant} onValueChange={value => setVariant(value as TrialBannerVariant)} />
        <SegmentedControl label="Trial" options={TRIALS} value={trial} onValueChange={setTrial} />
      </div>
      <div className={styles.stage} data-variant={variant}>
        <TrialBanner key={variant} variant={variant} daysLeft={Number(trial)} />
      </div>
    </div>
  );
}
