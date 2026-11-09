"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import GlassSegmented from "./glass-segmented";
import { segmentedOptions, slideMedia } from "./glass-segmented-data";
import styles from "./glass-segmented.module.css";

export const meta = "Live · component";

const transition = {
  opacity: {
    duration: motionTokens.duration.standard,
    ease: [...motionTokens.ease.standard] as [number, number, number, number],
  },
  scale: {
    duration: motionTokens.duration.considered,
    ease: [...motionTokens.ease.enter] as [number, number, number, number],
  },
};

/** A photo frame that crossfades between four Lisbon shots, switched by the glass segmented control. */
export function GlassSegmentedDemo() {
  const reduced = useReducedMotion() ?? false;
  const [value, setValue] = useState("rooftops");
  const { slide, media } = slideMedia(value);

  return (
    <div className={styles.demo}>
      <div className={styles.frame}>
        <AnimatePresence initial={false}>
          <motion.div
            key={slide.value}
            className={styles.layer}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={reduced ? { duration: 0 } : transition}
          >
            <img
              src={media.src}
              alt={media.alt}
              sizes="(max-width: 640px) 100vw, 760px"
              className={styles.image}
              draggable={false}
              style={{ position: "absolute", height: "100%", width: "100%", left: 0, top: 0, right: 0, bottom: 0, color: "transparent" }}
            />
          </motion.div>
        </AnimatePresence>
        <div className={styles.shade} aria-hidden />
        <div className={styles.caption} aria-live="polite">
          <span className={styles.title}>{slide.title}</span>
          <span className={styles.detail}>{slide.detail}</span>
        </div>
        <div className={styles.control}>
          <GlassSegmented label="Lisbon photos" fullWidth value={value} onValueChange={setValue} options={segmentedOptions} />
        </div>
      </div>
    </div>
  );
}

export default GlassSegmentedDemo;
