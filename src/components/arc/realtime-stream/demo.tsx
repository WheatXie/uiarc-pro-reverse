/**
 * Realtime stream demo — reconstructed from the Pro preview chunk: a checkout latency card whose
 * feed seeds thirty seconds of readings on mount, then appends one every 500 ms.
 */
import { useEffect, useId, useRef, useState } from "react";
import { RealtimeStream, type StreamPoint } from "./realtime-stream";
import styles from "./realtime-stream.module.css";

export const meta = "Live · canvas feed, hover to hold, anomaly markers";

interface Feed {
  /** The rows already on screen when the card mounts, oldest first, without anomalies. */
  seed: () => StreamPoint[];
  /** The next reading for the interval. */
  next: () => StreamPoint;
}

/**
 * Simulated p95 feed: a slow two-tone wobble around 138 ms with a random walk on top, and every
 * 20-40 readings a short burst of 330-450 ms readings flagged `Spike`. A linear congruential
 * generator keeps the demo's opening shape stable between reloads so screenshots can be compared.
 */
function createFeed(): Feed {
  let state = 215;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };

  let level = 142;
  let hold = 12 + 8 * random();
  let burst = 0;

  const read = (t: number): StreamPoint => {
    const wobble = 18 * Math.sin(t / 9000) + 8 * Math.sin(t / 3100);
    level += (138 + wobble - level) * 0.18 + (random() - 0.5) * 14;
    hold -= 0.5;
    if (hold <= 0 && !burst) {
      burst = 2 + Math.floor(2 * random());
      hold = 15 + 10 * random();
    }
    let value = level;
    if (burst) {
      value = 330 + 120 * random();
      burst -= 1;
    }
    const rounded = Math.round(value);
    return { t, value: rounded, anomaly: rounded > 300 ? "Spike" : undefined };
  };

  return {
    seed: () => {
      const last = 500 * Math.floor(Date.now() / 500);
      return Array.from({ length: 62 }, (_, index) => ({
        ...read(last - (61 - index) * 500),
        anomaly: undefined,
      }));
    },
    next: () => read(500 * Math.floor(Date.now() / 500)),
  };
}

export default function RealtimeStreamDemo() {
  const titleId = useId();
  const feedRef = useRef<Feed | null>(null);
  const [points, setPoints] = useState<StreamPoint[]>(() => {
    const feed = createFeed();
    feedRef.current = feed;
    return feed.seed();
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      const feed = feedRef.current;
      if (!feed) return;
      const point = feed.next();
      setPoints((list) =>
        list.length > 0 && list[list.length - 1].t === point.t
          ? list
          : [...list.slice(-160), point],
      );
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <div className={styles.heading}>
        <h3 id={titleId} className={styles.title}>
          Checkout API
        </h3>
        <p className={styles.meta}>p95 latency, simulated feed</p>
      </div>
      <RealtimeStream
        points={points}
        label="Checkout API p95 latency"
        unit="ms"
        interval={500}
        windowMs={30_000}
      />
    </section>
  );
}
