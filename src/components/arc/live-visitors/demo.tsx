"use client";

import LiveVisitors from "./live-visitors";
import styles from "./live-visitors.module.css";

export const meta = "Live · component";

export default function LiveVisitorsDemo() {
  return (
    <div className={styles.demo}>
      <LiveVisitors />
    </div>
  );
}
