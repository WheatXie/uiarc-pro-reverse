"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { Check } from "lucide-react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { Button } from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import { Slider } from "../slider/slider";
import { TextMorph } from "../text-morph/text-morph";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./usage-pricing.module.css";

const { spring, duration, ease } = motionTokens;
const enterEase: [number, number, number, number] = [...ease.enter];
const standardEase: [number, number, number, number] = [...ease.standard];

/** Seat counts the slider can land on. */
const SEATS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 20, 25, 30, 35, 40, 45, 50, 60, 75, 100, 150, 200];

/** Monthly API request totals, in millions. */
const REQUESTS = [
  0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 10, 12.5, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200,
];

interface Plan {
  name: string;
  seat: { monthly: number; yearly: number };
  seatLimit: number;
  included: number;
  requestLimit: number;
  perMillion: number;
}

interface Feature {
  label: string;
  tier: number;
  values: string[];
}

const PLANS: Plan[] = [
  { name: "Starter", seat: { monthly: 12, yearly: 10 }, seatLimit: 5, included: 1, requestLimit: 2, perMillion: 8 },
  { name: "Growth", seat: { monthly: 24, yearly: 20 }, seatLimit: 40, included: 10, requestLimit: 25, perMillion: 4 },
  { name: "Scale", seat: { monthly: 38, yearly: 32 }, seatLimit: Infinity, included: 50, requestLimit: Infinity, perMillion: 2 },
];

const FEATURES: Feature[] = [
  { label: "Request logs", tier: 0, values: ["7 days", "30 days", "13 months"] },
  { label: "Rate limit", tier: 0, values: ["100 req/s", "1,000 req/s", "10,000 req/s"] },
  { label: "Support", tier: 0, values: ["Email", "Priority", "Named engineer"] },
  { label: "Custom domains", tier: 1, values: ["", "Up to 10", "Unlimited"] },
  { label: "Audit log", tier: 1, values: ["", "90 days", "2 years"] },
  { label: "SAML SSO and SCIM", tier: 2, values: ["", "", ""] },
  { label: "Uptime SLA", tier: 2, values: ["", "", "99.99%"] },
];

const SEAT_MARKS = [
  { value: SEATS.indexOf(6), label: "Growth" },
  { value: SEATS.indexOf(45), label: "Scale" },
];

const REQUEST_MARKS = [
  { value: REQUESTS.indexOf(2.5), label: "Growth" },
  { value: REQUESTS.indexOf(30), label: "Scale" },
];

function at(steps: number[], index: number): number {
  return steps[Math.min(steps.length - 1, Math.max(0, Math.round(index)))];
}

function millions(value: number): string {
  return value < 1 ? `${Math.round(1e3 * value)}k` : `${value}M`;
}

function tierFor(value: number, first: number, second: number): number {
  return value > second ? 2 : value > first ? 1 : 0;
}

/** The feature list changes height with the plan, so measure it and morph the frame. */
function useMeasuredHeight() {
  const ref = useRef<HTMLUListElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, height] as const;
}

interface MoneyProps {
  value: number;
  prefix?: string;
  className?: string;
}

function Money({ value, prefix = "$", className }: MoneyProps) {
  return (
    <span className={[styles.money, className].filter(Boolean).join(" ")}>
      <AnimatedCounter value={value} prefix={prefix} />
    </span>
  );
}

interface SwapProps {
  id: string;
  children: ReactNode;
  className?: string;
}

function Swap({ id, children, className }: SwapProps) {
  const reduced = useReducedMotion();
  return (
    <span className={[styles.swap, className].filter(Boolean).join(" ")}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: duration.instant } }
              : { opacity: 0, y: -4, transition: { duration: duration.fast, ease: standardEase } }
          }
          transition={reduced ? { duration: duration.instant } : { duration: duration.standard, ease: enterEase }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

interface CheckMarkProps {
  className?: string;
  delay?: number;
}

function CheckMark({ className, delay = 0.16 }: CheckMarkProps) {
  const reduced = useReducedMotion();
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <motion.path
        d="M20 6 9 17l-5-5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduced ? { duration: 0 } : { duration: 0.34, ease: enterEase, delay }}
      />
    </svg>
  );
}

/**
 * A pricing calculator with seat and traffic sliders and a monthly or yearly toggle that
 * recommends a plan, shows its features, and breaks down the cost. Plan rates, limits, and
 * features are sample data.
 */
export function UsagePricing() {
  const id = useId();
  const reduced = useReducedMotion();
  const [seatIndex, setSeatIndex] = useState(SEATS.indexOf(18));
  const [requestIndex, setRequestIndex] = useState(REQUESTS.indexOf(15));
  const [billing, setBilling] = useState("monthly");
  const [started, setStarted] = useState(false);

  const [featuresRef, featuresHeight] = useMeasuredHeight();

  const seats = at(SEATS, seatIndex);
  const requests = at(REQUESTS, requestIndex);
  const seatTier = tierFor(seats, PLANS[0].seatLimit, PLANS[1].seatLimit);
  const requestTier = tierFor(requests, PLANS[0].requestLimit, PLANS[1].requestLimit);
  const tier = Math.max(seatTier, requestTier);
  const plan = PLANS[tier];
  const yearly = billing === "yearly";

  const [meter, setMeter] = useState<{ tier: number; direction: number }>({ tier, direction: 1 });
  if (meter.tier !== tier) {
    setMeter({ tier, direction: tier > meter.tier ? 1 : -1 });
    setStarted(false);
  }

  const seatCost = seats * plan.seat.monthly;
  const yearlySaving = yearly ? seats * (plan.seat.monthly - plan.seat.yearly) : 0;
  const overage = Math.max(0, requests - plan.included);
  const overageCost = Math.round(overage * plan.perMillion);
  const total = seatCost - yearlySaving + overageCost;
  const annualSaving = seats * (plan.seat.monthly - plan.seat.yearly) * 12;

  const reason = (function reasonFor(nextTier: number, seatsAt: number, requestsAt: number) {
    if (nextTier === 0) return "Covers up to 5 seats and 2M requests a month";
    const previous = PLANS[nextTier - 1];
    const seatText = `${previous.seatLimit} seats`;
    const requestText = `${previous.requestLimit}M requests`;
    if (seatsAt === nextTier && requestsAt === nextTier) return `Recommended above ${seatText} and ${requestText}`;
    if (seatsAt === nextTier) return `Recommended above ${seatText}`;
    return `Recommended above ${requestText} a month`;
  })(tier, seatTier, requestTier);

  const visibleFeatures = FEATURES.filter((feature) => feature.tier <= tier).sort((a, b) => b.tier - a.tier);
  const featureTransition: Transition = reduced
    ? { duration: duration.instant }
    : { layout: spring.smooth, default: { duration: duration.standard, ease: enterEase, delay: 0.08 } };

  return (
    <section className={styles.root} aria-labelledby={`${id}-title`}>
      <div className={styles.layout}>
        <header className={styles.head}>
          <h2 id={`${id}-title`}>Estimate your bill</h2>
          <p>
            You pay per seat. Each plan includes API traffic up to its limit, then a flat rate per extra million.
          </p>
        </header>
        <div className={styles.controls}>
          <Slider
            label="Seats"
            value={seatIndex}
            onValueChange={setSeatIndex}
            min={0}
            max={SEATS.length - 1}
            step={1}
            largeStep={3}
            marks={SEAT_MARKS}
            format={(value) => String(at(SEATS, value))}
          />
          <Slider
            label="API requests per month"
            value={requestIndex}
            onValueChange={setRequestIndex}
            min={0}
            max={REQUESTS.length - 1}
            step={1}
            largeStep={3}
            marks={REQUEST_MARKS}
            format={(value) => millions(at(REQUESTS, value))}
          />
          <div className={styles.billing}>
            <SegmentedControl
              label="Billing period"
              value={billing}
              onValueChange={(value) => setBilling(value)}
              options={[
                { value: "monthly", label: "Monthly" },
                { value: "yearly", label: "Yearly" },
              ]}
            />
            <p className={styles.saving} data-applied={yearly || undefined}>
              <AnimatePresence initial={false}>
                {yearly && (
                  <motion.span
                    key="applied"
                    className={styles.savingMark}
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "auto", opacity: 1 }}
                    exit={{
                      width: 0,
                      opacity: 0,
                      transition: reduced ? { duration: 0 } : { duration: duration.fast, ease: standardEase },
                    }}
                    transition={reduced ? { duration: 0 } : spring.morph}
                  >
                    <CheckMark className={styles.savingCheck} delay={0.06} />
                  </motion.span>
                )}
              </AnimatePresence>
              <span>
                Save <Money value={annualSaving} /> a year
              </span>
            </p>
          </div>
        </div>
        <aside className={styles.card} aria-labelledby={`${id}-plan`}>
          <div className={styles.meter} aria-hidden="true">
            {PLANS.map((item, index) => (
              <span key={item.name} className={styles.step} data-current={index === tier || undefined}>
                <span className={styles.bar}>
                  <motion.span
                    className={styles.fill}
                    initial={false}
                    animate={{ scaleX: Number(index <= tier) }}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : {
                            ...spring.smooth,
                            delay: 0.07 * Math.max(0, meter.direction > 0 ? index - 1 : 2 - index),
                          }
                    }
                  />
                </span>
                <span>{item.name}</span>
              </span>
            ))}
          </div>
          <div className={styles.planHead}>
            <TextMorph as="h3" id={`${id}-plan`} className={styles.planName}>
              {plan.name}
            </TextMorph>
            <p className={styles.reason}>
              <Swap id={reason}>{reason}</Swap>
            </p>
          </div>
          <div className={styles.price}>
            <Money value={total} className={styles.priceValue} />
            <span className={styles.per}>per month</span>
          </div>
          <p className={styles.billed}>
            <Swap id={billing}>
              {yearly ? (
                <>
                  <Money value={seats * plan.seat.yearly * 12} /> a year for seats, usage monthly
                </>
              ) : (
                "Billed monthly, usage included"
              )}
            </Swap>
          </p>
          <motion.div
            className={styles.featuresFrame}
            initial={false}
            animate={{ height: featuresHeight }}
            transition={reduced ? { duration: 0 } : spring.smooth}
          >
            <ul ref={featuresRef} className={styles.features} aria-label={`Included in ${plan.name}`}>
              <AnimatePresence mode="popLayout" initial={false}>
                {visibleFeatures.map((feature) => (
                  <motion.li
                    key={feature.label}
                    layout="position"
                    layoutDependency={tier}
                    className={styles.feature}
                    data-new={feature.tier === tier || undefined}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={
                      reduced
                        ? { opacity: 0, transition: { duration: duration.instant } }
                        : { opacity: 0, transition: { duration: duration.fast, ease: standardEase } }
                    }
                    transition={featureTransition}
                  >
                    <CheckMark className={styles.check} />
                    <span className={styles.featureLabel}>{feature.label}</span>
                    {feature.values[tier] && (
                      <TextMorph className={styles.featureValue}>{feature.values[tier]}</TextMorph>
                    )}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </motion.div>
          <div className={styles.action}>
            <Button
              className={styles.cta}
              variant={started ? "secondary" : "primary"}
              onClick={() => setStarted(true)}
              aria-describedby={`${id}-note`}
            >
              {started ? (
                <>
                  <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                  Trial started
                </>
              ) : (
                `Start with ${plan.name}`
              )}
            </Button>
            <p className={styles.note} id={`${id}-note`}>
              <Swap id={started ? "started" : "idle"}>
                {started ? (
                  <>
                    Trial started.{" "}
                    <button type="button" className={styles.undo} onClick={() => setStarted(false)}>
                      Undo
                    </button>
                  </>
                ) : (
                  "14 days free, then billed as estimated"
                )}
              </Swap>
            </p>
          </div>
          <p className={styles.srOnly} aria-live="polite">
            {`${plan.name}. ${reason}.`}
          </p>
        </aside>
        <section className={styles.breakdown} aria-labelledby={`${id}-breakdown`}>
          <h3 id={`${id}-breakdown`}>Breakdown</h3>
          <dl className={styles.rows}>
            <div className={styles.row}>
              <dt>
                <span className={styles.rowLabel}>
                  <TextMorph>{plan.name}</TextMorph> seats
                </span>
                <small>
                  {seats} × ${plan.seat.monthly}
                </small>
              </dt>
              <dd>
                <Money value={seatCost} />
              </dd>
            </div>
            <div className={styles.row}>
              <dt>
                <span className={styles.rowLabel}>API requests</span>
                <small>
                  {overage > 0
                    ? `${millions(requests)} used, ${millions(overage)} over at $${plan.perMillion} per million`
                    : `${millions(requests)} of ${millions(plan.included)} included`}
                </small>
              </dt>
              <dd>
                <Swap id={overage > 0 ? "over" : "included"} className={styles.alignEnd}>
                  {overage > 0 ? <Money value={overageCost} /> : <span className={styles.included}>Included</span>}
                </Swap>
              </dd>
            </div>
            <AnimatePresence initial={false}>
              {yearly && (
                <motion.div
                  key="yearly"
                  className={styles.row}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{
                    height: 0,
                    opacity: 0,
                    transition: reduced ? { duration: 0 } : { height: spring.smooth, opacity: { duration: duration.instant } },
                  }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { height: spring.smooth, opacity: { duration: duration.standard, ease: enterEase, delay: 0.06 } }
                  }
                >
                  <dt>
                    <span className={styles.rowLabel}>Yearly billing</span>
                    <small>
                      {seats} × ${plan.seat.monthly - plan.seat.yearly} off each seat
                    </small>
                  </dt>
                  <dd className={styles.discount}>
                    <Money value={yearlySaving} prefix="−$" />
                  </dd>
                </motion.div>
              )}
            </AnimatePresence>
            <div className={`${styles.row} ${styles.total}`}>
              <dt>
                <span className={styles.rowLabel}>Estimated total</span>
                <small>Per month, before tax</small>
              </dt>
              <dd>
                <Money value={total} />
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </section>
  );
}

export default UsagePricing;
