"use client";

import { useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { RotateCcw, Sparkles } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import TimeDial, { type TimeDialCity } from "./time-dial";
import styles from "./time-dial.module.css";

export const meta = "Live · component";

const { spring, duration, ease, blur } = motionTokens;
const enterEase = [...ease.enter] as [number, number, number, number];

const CITIES: TimeDialCity[] = [
  { id: "nyc", name: "New York", code: "NYC", offset: -240 },
  { id: "sfo", name: "San Francisco", code: "SF", offset: -420 },
  { id: "lon", name: "London", code: "LON", offset: 60 },
  { id: "tyo", name: "Tokyo", code: "TYO", offset: 540 },
];

const atWork = (minutes: number) =>
  CITIES.filter((city) => {
    const local = (((minutes + city.offset) % 1440) + 1440) % 1440;
    return local >= 540 && local < 1080;
  }).length;

/** Picks the quarter hour in the home city's day where the most offices overlap. */
const findOverlap = (value: number, home: TimeDialCity) => {
  const dayStart = 1440 * Math.floor((value + home.offset) / 1440) - home.offset;
  let best = value;
  for (let index = 0; index < 96; index += 1) {
    const candidate = dayStart + 15 * index;
    // Prefer the quarter hour with more offices at work, then the one nearest the current time.
    if ((atWork(candidate) - atWork(best) || Math.abs(best - value) - Math.abs(candidate - value)) > 0) best = candidate;
  }
  return best;
};

const subscribe = () => () => {};

export default function TimeDialDemo() {
  const [time, setTime] = useState(1260);
  const [homeId, setHomeId] = useState("nyc");
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const reduced = !!useReducedMotion() && mounted;
  const overlap = findOverlap(time, CITIES.find((city) => city.id === homeId) ?? CITIES[0]);
  const status = `${atWork(time)} of ${CITIES.length} offices at work`;

  return (
    <div className={styles.demo}>
      <TimeDial
        cities={CITIES}
        value={time}
        onValueChange={setTime}
        homeId={homeId}
        onHomeChange={setHomeId}
        weekday={1}
        hourCycle={12}
        label="Call time"
      />
      <div className={styles.bar}>
        <p className={styles.status}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={status}
              className={styles.statusText}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.4em", filter: `blur(${blur.soft}px)` }}
              animate={{ opacity: 1, y: "0em", filter: "blur(0px)" }}
              exit={
                reduced
                  ? { opacity: 0, transition: { duration: duration.instant } }
                  : { opacity: 0, y: "-0.4em", filter: `blur(${blur.subtle}px)`, transition: { duration: duration.instant } }
              }
              transition={
                reduced
                  ? { duration: duration.fast }
                  : {
                      y: spring.snappy,
                      opacity: { duration: duration.standard, ease: enterEase },
                      filter: { duration: duration.standard, ease: enterEase },
                    }
              }
            >
              {status}
            </motion.span>
          </AnimatePresence>
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.action} disabled={overlap === time} onClick={() => setTime(overlap)}>
            <Sparkles aria-hidden="true" />
            Find overlap
          </button>
          <button
            type="button"
            className={styles.action}
            disabled={time === 1260 && homeId === "nyc"}
            onClick={() => {
              setTime(1260);
              setHomeId("nyc");
            }}
          >
            <RotateCcw aria-hidden="true" />
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
