"use client";

import { UpgradePrompt } from "./upgrade-prompt";
import styles from "./upgrade-prompt.module.css";

export const meta = "Live · component";

export function UpgradePromptDemo() {
  return (
    <div className={styles.demo}>
      <UpgradePrompt />
    </div>
  );
}

export default UpgradePromptDemo;
