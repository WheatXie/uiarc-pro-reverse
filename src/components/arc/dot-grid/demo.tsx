"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import { DotGrid } from "./dot-grid";
import styles from "./dot-grid.module.css";

export const meta = "Live · component";

const DENSITIES = [
  { label: "Dense", gap: 14 },
  { label: "Default", gap: 22 },
  { label: "Loose", gap: 32 },
];

export default function DotGridDemo() {
  const reduced = Boolean(useReducedMotion());
  const [density, setDensity] = useState(1);

  return (
    <div className={styles.demo}>
      <DotGrid className={styles.field} gap={DENSITIES[density].gap}>
        <div className={styles.segment} role="group" aria-label="Density">
          <motion.span
            className={styles.thumb}
            aria-hidden="true"
            initial={false}
            animate={{ x: `${100 * density}%` }}
            transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
          />
          {DENSITIES.map((item, index) => (
            <button
              key={item.label}
              type="button"
              aria-pressed={density === index}
              className={styles.option}
              onClick={() => setDensity(index)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </DotGrid>
    </div>
  );
}
