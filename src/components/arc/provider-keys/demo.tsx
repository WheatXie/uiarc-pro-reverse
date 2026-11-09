"use client";

import { ProviderKeys } from "./provider-keys";
import styles from "./provider-keys.module.css";

export const meta = "Live · component";

export default function Demo() {
  return (
    <div className={styles.demo}>
      <ProviderKeys />
    </div>
  );
}
