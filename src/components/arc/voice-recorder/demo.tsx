"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { VoiceRecorder, peaksFor, type VoiceMessage } from "./voice-recorder";
import styles from "./voice-recorder.module.css";

export const meta = "Live · component";

const MEGAN = "/media/specials/voice-recorder-megan.svg";

const messages: VoiceMessage[] = [
  {
    id: "megan-cedar",
    from: "Megan Brooks",
    avatar: MEGAN,
    duration: 14,
    peaks: peaksFor(3, 14),
    meta: "9:38 AM",
  },
  { id: "me-stain", duration: 6, peaks: peaksFor(8, 6), meta: "9:40 AM" },
  {
    id: "megan-crew",
    from: "Megan Brooks",
    avatar: MEGAN,
    duration: 9,
    peaks: peaksFor(12, 9),
    meta: "9:41 AM",
  },
];

export default function VoiceRecorderDemo() {
  const [generation, setGeneration] = useState(0);

  return (
    <div className={styles.frame}>
      <header className={styles.header}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.headerAvatar} src={MEGAN} alt="" width={36} height={36} />
        <div className={styles.names}>
          <p className={styles.name}>Megan Brooks</p>
          <p className={styles.topic}>Porch renovation</p>
        </div>
        <button
          type="button"
          className={styles.reset}
          aria-label="Reset thread"
          onClick={() => setGeneration((current) => current + 1)}
        >
          <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </header>
      <VoiceRecorder
        key={generation}
        className={styles.recorder}
        defaultMessages={messages}
        label="Voice messages with Megan Brooks"
      />
    </div>
  );
}
