"use client";

import { useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import { MeetingSummary, type MeetingSummaryMeeting } from "./meeting-summary";
import styles from "./meeting-summary.module.css";

export const meta = "Live · component";

const SCENARIOS = [
  { value: "live", label: "Live" },
  { value: "error", label: "Error" },
  { value: "empty", label: "No transcript" },
];

/** The no-transcript scenario keeps the call's metadata but has nothing to summarize. */
const EMPTY_CALL: MeetingSummaryMeeting = {
  title: "Weekly design critique",
  platform: "zoom",
  startsAt: "2026-10-26T15:30",
  durationMinutes: 28,
  transcriptWords: 0,
  attendees: [
    { id: "diane", name: "Diane Foster", avatar: "/media/people/diane-foster.svg" },
    { id: "nathan", name: "Nathan Cole", avatar: "/media/people/nathan-cole.svg" },
    { id: "jasmine", name: "Jasmine Brooks", avatar: "/media/people/jasmine-brooks.svg" },
    { id: "marcus", name: "Marcus Johnson", avatar: "/media/people/marcus-johnson.svg" },
    { id: "andre", name: "Andre Williams", avatar: "/media/people/andre-williams.svg" },
    { id: "chloe", name: "Chloe Nguyen", avatar: "/media/people/chloe-nguyen.svg" },
    { id: "ava", name: "Ava Mitchell", avatar: "/media/people/ava-mitchell.svg" },
  ],
  summary: [],
  decisions: [],
  actionItems: [],
};

export default function MeetingSummaryDemo() {
  const [scenario, setScenario] = useState("live");
  const [run, setRun] = useState(0);
  const reset = () => {
    setScenario("live");
    setRun((value) => value + 1);
  };
  return (
    <div className={styles.demo}>
      <SegmentedControl
        label="Scenario"
        options={SCENARIOS}
        value={scenario}
        onValueChange={(value) => {
          setScenario(value);
          if (value === "live") setRun((value) => value + 1);
        }}
      />
      <div className={styles.stage}>
        {scenario === "live" ? (
          <MeetingSummary key={run} />
        ) : scenario === "error" ? (
          <MeetingSummary
            status="error"
            error="The recording is still uploading from Google Meet. Try again in a minute."
            onRegenerate={reset}
          />
        ) : (
          <MeetingSummary meeting={EMPTY_CALL} status="ready" onRegenerate={reset} />
        )}
      </div>
    </div>
  );
}
