"use client";

import { useState } from "react";
import { Building2, Globe, Lock, Mail } from "lucide-react";
import SegmentedControl from "../segmented-control/segmented-control";
import { person } from "../lib/media";
import ShareSheet, { type ShareSheetAccess, type ShareSheetChannel, type ShareSheetPerson } from "./share-sheet";
import styles from "./demo.module.css";

export const meta = "Live · component";

const ICON = { size: 16, strokeWidth: 1.75 } as const;

const PEOPLE: ShareSheetPerson[] = ["emma-collins", "marcus-johnson", "jasmine-brooks", "daniel-kim", "chloe-nguyen"].map((id) => {
  const entry = person(id as Parameters<typeof person>[0]);
  return { id, name: entry.name, avatar: entry.src };
});

function SlackGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#E01E5A"
        d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"
      />
      <path
        fill="#36C5F0"
        d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"
      />
      <path
        fill="#2EB67D"
        d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"
      />
      <path
        fill="#ECB22E"
        d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"
      />
    </svg>
  );
}

function XGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.2 3h3.1l-6.8 7.7 8 10.3h-6.2l-4.9-6.3L4.8 21H1.7l7.3-8.3L1.4 3h6.4l4.4 5.8L17.2 3Zm-1.1 16.2h1.7L6.9 4.7H5.1l11 14.5Z" />
    </svg>
  );
}

const CHANNELS: ShareSheetChannel[] = [
  { id: "email", label: "Email", icon: <Mail {...ICON} className={styles.mailMark} />, doneLabel: "Opened" },
  { id: "slack", label: "Slack", icon: <SlackGlyph />, doneLabel: "Posted" },
  { id: "x", label: "X", icon: <XGlyph />, doneLabel: "Drafted" },
];

const ACCESS: ShareSheetAccess[] = [
  { value: "invited", label: "Only people invited", description: "Nobody else can open it", icon: <Lock {...ICON} /> },
  { value: "team", label: "Anyone at Northwind", description: "Can view and comment", icon: <Building2 {...ICON} /> },
  { value: "public", label: "Anyone with the link", description: "Can view", icon: <Globe {...ICON} /> },
];

const RESULTS = [
  { value: "succeed", label: "Send works" },
  { value: "fail", label: "Send fails" },
];

export default function ShareSheetDemo() {
  const [result, setResult] = useState("succeed");

  return (
    <div className={styles.scene}>
      <div className={styles.demo}>
        <div className={styles.stage}>
          <ShareSheet
            title="Q3 launch plan"
            link="northwind.example/d/q3-launch-plan"
            people={PEOPLE}
            channels={CHANNELS}
            access={ACCESS}
            defaultAccess="team"
            align="center"
            onSend={() =>
              new Promise<void>((resolve, reject) => {
                window.setTimeout(() => (result === "fail" ? reject(new Error("Simulated failure")) : resolve()), 900);
              })
            }
            onChannel={() => new Promise<void>((resolve) => window.setTimeout(resolve, 550))}
          />
        </div>
        <div className={styles.controls}>
          <SegmentedControl label="Send result" options={RESULTS} value={result} onValueChange={setResult} />
        </div>
      </div>
    </div>
  );
}
