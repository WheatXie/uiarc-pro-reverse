"use client";

import { useState } from "react";
import SegmentedControl from "../segmented-control/segmented-control";
import { AgentHandoff } from "./agent-handoff";
import styles from "./agent-handoff.module.css";

export const meta = "Live · component";

const stories = [
  { value: "handoff", label: "Person joins" },
  { value: "unavailable", label: "No one available" },
];

type Story = "handoff" | "unavailable";

export default function AgentHandoffDemo() {
  const [story, setStory] = useState<Story>("handoff");
  return (
    <div className={styles.demo}>
      <SegmentedControl
        options={stories}
        value={story}
        onValueChange={value => setStory(value === "unavailable" ? "unavailable" : "handoff")}
        label="Demo story"
      />
      {/* The story plays once and comes to rest on its last state; the header replay button restarts it. */}
      <AgentHandoff scenario={story} autoReplay={false} />
    </div>
  );
}
