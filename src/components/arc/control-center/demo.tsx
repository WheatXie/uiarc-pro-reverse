"use client";

import { Headphones, Sunset, UsersRound } from "lucide-react";
import { ControlCenter, type ControlCenterChannel, type ControlCenterPerson, type FocusMode } from "./control-center";
import styles from "./demo.module.css";

const FOCUS_MODES: FocusMode[] = [
  {
    id: "deep-work",
    label: "Deep work",
    icon: Headphones,
    description: "Only mentions from your team get through",
    defaultMinutes: 50,
  },
  {
    id: "meetings",
    label: "Meetings",
    icon: UsersRound,
    description: "Chat is held, calendar alerts stay on",
    defaultMinutes: 30,
  },
  {
    id: "wind-down",
    label: "Wind down",
    icon: Sunset,
    description: "Everything waits until tomorrow morning",
    defaultMinutes: 90,
  },
];

const CHANNELS: ControlCenterChannel[] = [
  { id: "mentions", label: "Mentions", description: "When someone tags you", defaultOn: true },
  { id: "direct", label: "Direct messages", description: "One to one and small groups", defaultOn: true },
  { id: "deploys", label: "Deploy alerts", description: "Failed builds on main", defaultOn: false },
];

const PEOPLE: ControlCenterPerson[] = [
  { id: "emily", name: "Emily Parker", avatar: "/media/people/emma-collins.svg" },
  { id: "tyler", name: "Tyler Brooks", avatar: "/media/people/tyler-hayes.svg" },
  { id: "ryan", name: "Ryan Mitchell", avatar: "/media/people/ryan-sullivan.svg" },
];

export const meta = "Live · component";

export default function ControlCenterDemo() {
  return (
    <div className={styles.demo}>
      <ControlCenter
        focusModes={FOCUS_MODES}
        channels={CHANNELS}
        people={PEOPLE}
        defaultVolume={64}
        defaultTextSize={100}
        label="Workspace quick settings"
      />
    </div>
  );
}
