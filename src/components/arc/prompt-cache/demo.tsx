"use client";

import PromptCache from "./prompt-cache";
import styles from "./demo.module.css";

export const meta = "Live · component";

export function PromptCacheDemo() {
  return (
    <div className={styles.demo}>
      <PromptCache />
    </div>
  );
}

export default PromptCacheDemo;
