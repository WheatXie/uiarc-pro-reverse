"use client";

import { useId, useState } from "react";
import { motion } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import { SandText } from "./sand-text";
import styles from "./sand-text.module.css";

export const meta = "Live · component";

const WORDS = ["Dunes", "Hourglass", "Shore"];

export default function SandTextDemo() {
  const [word, setWord] = useState(WORDS[0]);
  const layoutId = useId();

  return (
    <div className={styles.demo}>
      <div className={styles.stage}>
        <SandText className={styles.text} text={word} />
      </div>
      <div className={styles.words} role="radiogroup" aria-label="Word">
        {WORDS.map((item) => (
          <button
            key={item}
            type="button"
            role="radio"
            aria-checked={word === item}
            className={styles.word}
            onClick={() => setWord(item)}
          >
            {word === item && (
              <motion.span
                layoutId={`sand-text-word-${layoutId}`}
                className={styles.thumb}
                transition={motionTokens.spring.snappy}
              />
            )}
            <span className={styles.label}>{item}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
