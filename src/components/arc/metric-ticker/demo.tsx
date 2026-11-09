/**
 * Metric ticker demo — reconstructed from the Pro preview chunk: a product-health strip that seeds
 * seven series, streams a few random metrics while it is in view, and can be paused.
 */
import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { Pause, Play } from "lucide-react";
import { Button } from "../button/button";
import { MetricTicker, type TickerMetric } from "./metric-ticker";
import styles from "./demo.module.css";

interface SeedConfig {
  metric: Omit<TickerMetric, "value">;
  start: number;
  step: number;
  drift: number;
  min: number;
  max: number;
  round: number;
}

const SEEDS: SeedConfig[] = [
  {
    metric: {
      id: "mrr",
      label: "Monthly recurring revenue",
      format: { style: "currency", currency: "USD", maximumFractionDigits: 0 },
      caption: "Last 24 updates, today",
    },
    start: 84210,
    step: 420,
    drift: 0.35,
    min: 8e4,
    max: 96e3,
    round: 10,
  },
  {
    metric: { id: "active", label: "Active now", caption: "Signed in users, last 24 updates" },
    start: 1284,
    step: 38,
    drift: 0.1,
    min: 1050,
    max: 1600,
    round: 1,
  },
  {
    metric: {
      id: "conversion",
      label: "Trial conversion",
      format: { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 },
      delta: "absolute",
      caption: "Rolling 7 days",
    },
    start: 0.184,
    step: 0.004,
    drift: 0.05,
    min: 0.15,
    max: 0.22,
    round: 0.001,
  },
  {
    metric: {
      id: "latency",
      label: "API p95",
      format: { style: "unit", unit: "millisecond", unitDisplay: "short" },
      positive: "down",
      delta: "absolute",
      caption: "p95 across regions",
    },
    start: 212,
    step: 9,
    drift: 0,
    min: 168,
    max: 260,
    round: 1,
  },
  {
    metric: { id: "orders", label: "Orders per minute", caption: "Checkout, all stores" },
    start: 342,
    step: 16,
    drift: 0.15,
    min: 280,
    max: 420,
    round: 1,
  },
  {
    metric: {
      id: "errors",
      label: "Error rate",
      format: { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 },
      positive: "down",
      delta: "absolute",
      caption: "5xx responses",
    },
    start: 0.0031,
    step: 4e-4,
    drift: -0.05,
    min: 0.0012,
    max: 0.0068,
    round: 1e-4,
  },
  {
    metric: {
      id: "churn",
      label: "Logo churn",
      format: { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 },
      positive: "down",
      delta: "absolute",
      caption: "Trailing 30 days",
    },
    start: 0.0184,
    step: 6e-4,
    drift: -0.02,
    min: 0.012,
    max: 0.026,
    round: 1e-4,
  },
];

/** A tiny LCG, so the seeded history is identical on every load. */
function random(seed: number) {
  let state = seed;
  return () => (state = (1664525 * state + 0x3c6ef35f) % 0x100000000) / 0x100000000;
}

function stepFor(config: SeedConfig, current: number, value: () => number) {
  const next = current + (value() - 0.5 + 0.5 * config.drift) * 2 * config.step;
  return Math.round(Math.min(config.max, Math.max(config.min, next)) / config.round) * config.round;
}

function createHistory(): number[][] {
  const value = random(11);
  return SEEDS.map((config) => {
    const history = [config.start];
    for (let index = 0; index < 23; index++) history.unshift(stepFor({ ...config, drift: -config.drift }, history[0] ?? config.start, value));
    return history;
  });
}

export const meta = "Live · keyboard ready";

export default function MetricTickerDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.2 });
  const [history, setHistory] = useState(createHistory);
  const [live, setLive] = useState(true);
  const value = useRef(random(29));

  // While the strip is visible, a few random metrics take a step every second or so.
  useEffect(() => {
    if (!inView || !live) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (!document.hidden) {
        const next = value.current;
        const picks = new Set(Array.from({ length: 1 + Math.floor(3 * next()) }, () => Math.floor(next() * SEEDS.length)));
        setHistory((current) =>
          current.map((values, index) => {
            const config = SEEDS[index];
            if (!picks.has(index) || !config) return values;
            const last = values[values.length - 1] ?? config.start;
            const reading = stepFor(config, last, next);
            return reading === last ? values : [...values.slice(-23), reading];
          }),
        );
      }
      timer = setTimeout(tick, 900 + 700 * value.current());
    };
    timer = setTimeout(tick, 700);
    return () => clearTimeout(timer);
  }, [inView, live]);

  const metrics = SEEDS.map((config, index) => {
    const values = history[index] ?? [config.start];
    return { ...config.metric, value: values[values.length - 1] ?? config.start, history: values };
  });

  return (
    <div ref={rootRef} className={styles.demo}>
      <div className={styles.bar}>
        <p className={styles.heading}>Product health</p>
        <Button size="sm" variant="secondary" onClick={() => setLive((current) => !current)}>
          {live ? <Pause size={16} strokeWidth={1.75} aria-hidden="true" /> : <Play size={16} strokeWidth={1.75} aria-hidden="true" />}
          {live ? "Pause stream" : "Resume stream"}
        </Button>
      </div>
      <MetricTicker metrics={metrics} label="Product health metrics" />
    </div>
  );
}
