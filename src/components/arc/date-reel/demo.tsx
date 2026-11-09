"use client";

import { DateReel } from "./date-reel";
import styles from "./date-reel.module.css";

export const meta = "Live · component";

const TODAY = new Date(2026, 8, 24);
const DEFAULT_VALUE = new Date(2026, 8, 25, 9, 0);

export default function DateReelDemo() {
  return (
    <div className={styles.demo}>
      <DateReel
        title="Send later"
        today={TODAY}
        defaultValue={DEFAULT_VALUE}
        onConfirm={() => new Promise<void>((resolve) => setTimeout(resolve, 900))}
      />
    </div>
  );
}
