"use client";

import { useId } from "react";
import {
  RaceBarChart,
  type RaceBarFrame,
  type RaceBarGroup,
  type RaceBarItem,
} from "./race-bar-chart";
import styles from "./demo.module.css";

export const meta =
  "Live · Bars overtake each other period by period, with play, scrubbing and hover readouts";

/** id → [name, group, monthly increments]. Values are absolute revenue, so frames accumulate. */
const catalogue: [string, string, string, number[]][] = [
  [
    "lounge-chair",
    "Oak lounge chair",
    "furniture",
    [14, 16, 22, 34, 52, 70, 88, 104, 120, 138, 156, 178],
  ],
  [
    "linen-throw",
    "Linen throw",
    "textiles",
    [92, 78, 52, 34, 24, 16, 14, 16, 26, 48, 80, 118],
  ],
  [
    "mushroom-lamp",
    "Mushroom lamp",
    "lighting",
    [66, 62, 58, 54, 51, 48, 46, 50, 57, 68, 78, 90],
  ],
  [
    "glass-carafe",
    "Glass carafe",
    "tableware",
    [10, 12, 18, 30, 52, 84, 98, 90, 54, 26, 18, 30],
  ],
  [
    "stoneware-cups",
    "Stoneware cups",
    "tableware",
    [44, 42, 44, 41, 42, 40, 38, 40, 42, 45, 52, 70],
  ],
  [
    "stacked-bowls",
    "Stacked bowls",
    "tableware",
    [27, 26, 28, 29, 27, 28, 26, 27, 29, 30, 36, 47],
  ],
  [
    "ceramic-lamp",
    "Ceramic lamp",
    "lighting",
    [18, 20, 21, 20, 22, 21, 22, 24, 26, 28, 31, 34],
  ],
  [
    "walnut-sideboard",
    "Walnut sideboard",
    "furniture",
    [75, 63, 57, 51, 45, 39, 36, 33, 39, 45, 51, 54],
  ],
  [
    "striped-pillow",
    "Striped pillow",
    "textiles",
    [10, 11, 13, 16, 17, 18, 19, 17, 16, 16, 18, 23],
  ],
  [
    "wool-rug",
    "Wool rug",
    "textiles",
    [40, 34, 28, 20, 15, 11, 9, 11, 18, 30, 40, 50],
  ],
];

const items: RaceBarItem[] = catalogue.map(([id, label, group]) => ({
  id,
  label,
  group,
}));
const groups: RaceBarGroup[] = [
  { id: "furniture", label: "Furniture" },
  { id: "lighting", label: "Lighting" },
  { id: "textiles", label: "Textiles" },
  { id: "tableware", label: "Tableware" },
];
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const frames: RaceBarFrame[] = months.map((period, month) => {
  const values: Record<string, number> = {};
  for (const [id, , , monthly] of catalogue) {
    values[id] =
      1000 *
      monthly.slice(0, month + 1).reduce((total, value) => total + value, 0);
  }
  return { period, values };
});

/** Money, in thousands below a million: $182K, $1.24M. */
const money = (value: number) =>
  value >= 1e6
    ? `$${(value / 1e6).toFixed(2)}M`
    : `$${Math.round(value / 1e3)}K`;

export default function Demo() {
  const id = useId();
  return (
    <section className={styles.card} aria-labelledby={id}>
      <div className={styles.heading}>
        <h3 id={id} className={styles.title}>
          Revenue by product
        </h3>
        <p className={styles.meta}>Year to date, 2025</p>
      </div>
      <RaceBarChart
        items={items}
        frames={frames}
        groups={groups}
        label="Revenue by product, year to date 2025"
        bars={8}
        highlight="lounge-chair"
        formatValue={money}
        formatTick={money}
      />
    </section>
  );
}
