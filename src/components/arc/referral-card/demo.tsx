"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "../button/button";
import ReferralCard from "./referral-card";
import styles from "./referral-card.module.css";

export const meta = "Live · component";

/**
 * The shipped sample program: Emma has invited six people, three of them paid, and the card is one paid referral
 * short of the milestone. Replay remounts it so the arrival animation and the count-up run again.
 */
export default function ReferralCardDemo() {
  const [run, setRun] = useState(0);
  return <div className={styles.demo}>
    <ReferralCard key={run} />
    <Button variant="ghost" size="sm" className={styles.replay} onClick={() => setRun(value => value + 1)}>
      <RotateCcw size={14} strokeWidth={1.75} />
      Replay
    </Button>
  </div>;
}
