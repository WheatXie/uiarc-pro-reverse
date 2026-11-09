"use client";

import { useMemo, useState } from "react";
import DictationButton, { createSimulatedRecognizer } from "./dictation-button";
import SegmentedControl from "../segmented-control/segmented-control";
import styles from "./dictation-button.module.css";

export const meta = "Live · component";

const PERMISSIONS = [
  { value: "allowed", label: "Mic allowed" },
  { value: "blocked", label: "Mic blocked" },
];

/**
 * The live frame drives the field on its own: the simulated microphone dictates a reply, the
 * transcript streams in word by word, insert commits it, and a simulated send clears the field
 * before the loop starts over. Switch the simulated permission to blocked to see the inline
 * retry state; the first pointer, key, or focus stops the loop.
 */
export default function DictationButtonDemo() {
  const [permission, setPermission] = useState("allowed");
  const recognizer = useMemo(() => createSimulatedRecognizer({ deny: permission === "blocked" }), [permission]);

  return (
    <div className={styles.demo}>
      <DictationButton key={permission} recognizer={recognizer} autoPlay />
      <SegmentedControl options={PERMISSIONS} value={permission} onValueChange={setPermission} label="Simulated microphone permission" />
    </div>
  );
}
