"use client";

import { ConnectorSetup } from "./connector-setup";
import styles from "./connector-setup.module.css";

export const meta = "Live · component";

export default function ConnectorSetupDemo() {
  return (
    <div className={styles.demo}>
      <ConnectorSetup />
    </div>
  );
}
