"use client";

import { useState, useSyncExternalStore, type CSSProperties } from "react";
import { KeycapKeyboard } from "./keycap-keyboard";
import styles from "./demo.module.css";

export const meta = "Live · component";

const OPTIONS = [
  { id: "compact", label: "Compact" },
  { id: "letters", label: "Letters" },
] as const;

type LayoutId = (typeof OPTIONS)[number]["id"];

const QUERY = "(max-width: 560px)";

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const getSnapshot = () => window.matchMedia(QUERY).matches;
const getServerSnapshot = () => false;

export default function KeycapKeyboardDemo() {
  const narrow = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [chosen, setChosen] = useState<LayoutId | null>(null);
  const layout: LayoutId = chosen ?? (narrow ? "letters" : "compact");

  return (
    <div className={styles.demo}>
      <KeycapKeyboard listen="window" layout={layout} placeholder="Type anything" />
      <div
        className={styles.segment}
        role="group"
        aria-label="Layout"
        style={{ "--index": OPTIONS.findIndex(option => option.id === layout) } as CSSProperties}
      >
        {OPTIONS.map(option => (
          <button
            key={option.id}
            type="button"
            className={styles.option}
            aria-pressed={layout === option.id}
            onClick={() => setChosen(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
