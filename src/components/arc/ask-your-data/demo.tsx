"use client";

import { AskYourData } from "./ask-your-data";
import styles from "./demo.module.css";

export const meta = "Live · component";

export default function AskYourDataDemo() {
  return (
    <div className={styles.demo}>
      <AskYourData className={styles.card} />
    </div>
  );
}
