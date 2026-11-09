"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import { PhotoGrid } from "./photo-grid";
import { desertWeekend } from "./photo-grid-data";
import styles from "./photo-grid.module.css";

export const meta = "Live · component";

const OPEN_HINT = "Swipe or scrub the filmstrip between photos. Drag down to put it back.";
const CLOSED_HINT = "Pinch, or hold Control and scroll, to zoom. Tap a photo to open it.";

export default function PhotoGridDemo() {
  const reduced = Boolean(useReducedMotion());
  const [open, setOpen] = useState(false);
  const hint = open ? OPEN_HINT : CLOSED_HINT;
  const hidden = reduced
    ? { opacity: 0 }
    : { opacity: 0, y: "0.3em", filter: `blur(${motionTokens.blur.soft}px)` };

  return (
    <div className={styles.demo}>
      <div className={styles.frame}>
        <PhotoGrid
          photos={desertWeekend}
          title="Desert weekend"
          defaultColumns={3}
          defaultFavorites={["boulders", "sunset"]}
          onViewerChange={id => setOpen(Boolean(id))}
        />
      </div>
      <p className={styles.hint}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={hint}
            className={styles.hintText}
            initial={hidden}
            animate={{ opacity: 1, y: "0em", filter: "blur(0px)" }}
            exit={{ ...hidden, transition: { duration: reduced ? motionTokens.duration.fast : motionTokens.duration.instant } }}
            transition={
              reduced
                ? { duration: motionTokens.duration.fast }
                : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }
            }
          >
            {hint}
          </motion.span>
        </AnimatePresence>
      </p>
    </div>
  );
}
