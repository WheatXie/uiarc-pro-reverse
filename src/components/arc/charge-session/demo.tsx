"use client";

import { ChargeSession } from "./charge-session";
import styles from "./demo.module.css";

export const meta = "Live · component";

export function ChargeSessionDemo() {
  return (
    <div className={styles.demo} data-canvas="wide">
      <ChargeSession />
    </div>
  );
}

export default ChargeSessionDemo;
