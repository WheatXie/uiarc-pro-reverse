"use client";

import { useState } from "react";
import { BookOpen, PenLine, RotateCcw, Timer } from "lucide-react";
import { Button } from "../button/button";
import { ActivityRings, type ActivityDay, type ActivityMetric } from "./activity-rings";
import styles from "./activity-rings.module.css";

export const meta = "Live · component";

const METRICS: ActivityMetric[] = [
  { id: "focus", label: "Deep work", unit: "min", goal: 180 },
  { id: "words", label: "Writing", unit: "words", goal: 1200 },
  { id: "reading", label: "Reading", unit: "pages", goal: 40 },
];

const WEEK: ActivityDay[] = [
  { id: "mon", label: "Monday, September 14", short: "Mon", values: { focus: 205, words: 1480, reading: 32 } },
  { id: "tue", label: "Tuesday, September 15", short: "Tue", values: { focus: 120, words: 860, reading: 44 } },
  { id: "wed", label: "Wednesday, September 16", short: "Wed", values: { focus: 240, words: 2110, reading: 18 } },
  { id: "thu", label: "Thursday, September 17", short: "Thu", values: { focus: 165, words: 1190, reading: 41 } },
  { id: "fri", label: "Friday, September 18", short: "Fri", values: { focus: 95, words: 540, reading: 26 } },
  { id: "sat", label: "Saturday, September 19", short: "Sat", values: { focus: 60, words: 300, reading: 72 } },
  { id: "sun", label: "Sunday, September 20", short: "Sun", values: { focus: 130, words: 940, reading: 22 } },
];

export default function ActivityRingsDemo() {
  const [days, setDays] = useState(WEEK);
  const [day, setDay] = useState("sun");

  const add = (metric: string, amount: number) => {
    setDays(current =>
      current.map(item =>
        item.id === "sun"
          ? { ...item, values: { ...item.values, [metric]: (item.values[metric] ?? 0) + amount } }
          : item,
      ),
    );
    setDay("sun");
  };

  return (
    <div className={styles.demo}>
      <ActivityRings metrics={METRICS} days={days} day={day} onDayChange={setDay} label="Goals this week" />
      <div className={styles.actions}>
        <Button variant="secondary" size="sm" onClick={() => add("focus", 25)}>
          <Timer size={16} strokeWidth={1.75} aria-hidden="true" />
          25 min
        </Button>
        <Button variant="secondary" size="sm" onClick={() => add("words", 250)}>
          <PenLine size={16} strokeWidth={1.75} aria-hidden="true" />
          250 words
        </Button>
        <Button variant="secondary" size="sm" onClick={() => add("reading", 10)}>
          <BookOpen size={16} strokeWidth={1.75} aria-hidden="true" />
          10 pages
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Reset week"
          disabled={days === WEEK && day === "sun"}
          onClick={() => {
            setDays(WEEK);
            setDay("sun");
          }}
        >
          <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
