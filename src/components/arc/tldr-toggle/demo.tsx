"use client";

import { useCallback, useState } from "react";
import Switch from "../switch/switch";
import TldrToggle, { simulateSummary } from "./tldr-toggle";
import type { TldrSummaryRequest } from "./tldr-toggle";
import styles from "./tldr-toggle.module.css";

export const meta = "Live · component";

export default function TldrToggleDemo() {
  const [fail, setFail] = useState(false);
  const summarize = useCallback((request: TldrSummaryRequest) => simulateSummary(request, { fail }), [fail]);
  return (
    <div className={styles.demo}>
      <TldrToggle summarize={summarize} autoPlay simulated />
      <div className={styles.options}>
        <Switch label="Simulate a failure" checked={fail} onCheckedChange={setFail} />
      </div>
    </div>
  );
}
