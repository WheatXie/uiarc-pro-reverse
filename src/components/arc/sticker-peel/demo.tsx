"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { StickerPeel, type StickerPeelItem, type StickerPlacement } from "./sticker-peel";
import styles from "./sticker-peel.module.css";

export const meta = "Live · component";

function ArcMark() {
  return (
    <span className={styles.mark}>
      <svg
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 48V29C9 15 19 7 32 7s23 8 23 22v19" />
        <path d="M20 48V31c0-8 5-13 12-13s12 5 12 13v17" />
        <path d="M32 38v10" />
      </svg>
    </span>
  );
}

function Spark() {
  return (
    <span className={styles.spark}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3.5c.55 4.3 2.7 6.45 7 7-4.3.55-6.45 2.7-7 7-.55-4.3-2.7-6.45-7-7 4.3-.55 6.45-2.7 7-7Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

const stickers: StickerPeelItem[] = [
  {
    id: "arc",
    label: "Arc mark sticker",
    shape: "circle",
    x: 0.3,
    y: 0.36,
    rotate: -6,
    content: <ArcMark />,
  },
  {
    id: "care",
    label: "Made with care sticker",
    shape: "pill",
    x: 0.66,
    y: 0.3,
    rotate: 4,
    content: <span className={styles.care}>Made with care</span>,
  },
  {
    id: "spark",
    label: "Sparkle sticker",
    shape: "rounded",
    x: 0.7,
    y: 0.68,
    rotate: 8,
    content: <Spark />,
  },
  {
    id: "ship",
    label: "Ship it sticker",
    shape: "pill",
    x: 0.34,
    y: 0.7,
    rotate: -3,
    content: <span className={styles.ship}>Ship it</span>,
  },
];

const initialPositions = () =>
  Object.fromEntries(
    stickers.map((sticker) => [sticker.id, { x: sticker.x, y: sticker.y, rotate: sticker.rotate ?? 0 }]),
  );

export default function StickerPeelDemo() {
  const [positions, setPositions] = useState<Record<string, StickerPlacement>>(initialPositions);
  const moved = stickers.some((sticker) => {
    const placement = positions[sticker.id];
    return Math.abs(placement.x - sticker.x) > 0.002 || Math.abs(placement.y - sticker.y) > 0.002;
  });

  return (
    <div className={styles.demo}>
      <StickerPeel
        className={styles.surface}
        stickers={stickers}
        positions={positions}
        onPositionsChange={setPositions}
        label="Stickers"
      />
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.reset}
          onClick={() => setPositions(initialPositions())}
          disabled={!moved}
        >
          <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
          Reset
        </button>
      </div>
    </div>
  );
}
