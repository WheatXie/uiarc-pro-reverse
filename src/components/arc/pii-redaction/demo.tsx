"use client";

import { PiiRedaction } from "./pii-redaction";
import styles from "./demo.module.css";

export const meta = "Live · component";

export default function PiiRedactionDemo() {
  return (
    <div className={styles.demo}>
      <PiiRedaction />
    </div>
  );
}
