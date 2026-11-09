"use client";

import { ProviderStatus } from "./provider-status";
import styles from "./provider-status.module.css";

export const meta = "Live · component";

export default function Demo() {
  return (
    <div className={styles.demo}>
      <ProviderStatus />
    </div>
  );
}
