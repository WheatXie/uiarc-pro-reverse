"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, LayoutGroup, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { Check, Minus, Plus } from "lucide-react";
import { Button } from "../button/button";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./pricing-calculator.module.css";

type Period = "monthly" | "yearly";
type PlanId = "starter" | "team" | "business";

interface PlanFeature {
  id: string;
  text: string;
}

interface Plan {
  id: PlanId;
  name: string;
  pitch: string;
  monthly: number;
  yearly: number;
  /** Seats a plan stops selling at. Plans without a cap scale to the last stop. */
  maxSeats?: number;
  /** Seat prices drop in steps at 25 and 100 seats. */
  volume: boolean;
  features: (seats: number, period: Period) => PlanFeature[];
}

/** Seat stops. The slider walks these, so a step is never "1 seat" at the top of the range. */
const SEATS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200, 250];

const volumeFeature = (seats: number): PlanFeature[] =>
  seats >= 25 ? [{ id: "volume", text: seats >= 100 ? "Volume pricing, $4 off each seat" : "Volume pricing, $2 off each seat" }] : [];

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    pitch: "For small crews getting organized",
    monthly: 10,
    yearly: 8,
    maxSeats: 10,
    volume: false,
    features: seats => [
      { id: "projects", text: "Unlimited projects and docs" },
      { id: "storage", text: `${5 * seats} GB shared storage` },
      { id: "history", text: "30 days of version history" },
      { id: "support", text: "Email support" },
    ],
  },
  {
    id: "team",
    name: "Team",
    pitch: "For teams shipping together every week",
    monthly: 20,
    yearly: 16,
    volume: true,
    features: (seats, period) => [
      { id: "everything", text: "Everything in Starter" },
      { id: "storage", text: `${20 * seats} GB shared storage` },
      { id: "sso", text: "Google and Microsoft sign-in" },
      ...volumeFeature(seats),
      ...(period === "yearly" ? [{ id: "onboarding", text: "Guided onboarding session" }] : []),
    ],
  },
  {
    id: "business",
    name: "Business",
    pitch: "For companies with security reviews",
    monthly: 35,
    yearly: 28,
    volume: true,
    features: (seats, period) => [
      { id: "everything", text: "Everything in Team" },
      { id: "saml", text: "SAML SSO and SCIM provisioning" },
      { id: "audit", text: "Audit log with 1 year retention" },
      ...volumeFeature(seats),
      ...(seats >= 50 ? [{ id: "manager", text: "Named success manager" }] : []),
      ...(period === "yearly" ? [{ id: "uptime", text: "99.95% uptime commitment" }] : []),
    ],
  },
];

/** A plan sells up to its seat cap; the two larger plans have none. */
const available = (plan: Plan, seats: number) => !plan.maxSeats || seats <= plan.maxSeats;

/** Per-seat price per month: the list price minus the volume step for that seat count. */
function seatPrice(plan: Plan, seats: number, period: Period) {
  return (period === "yearly" ? plan.yearly : plan.monthly) - (plan.volume ? (seats >= 100 ? 4 : 2 * Number(seats >= 25)) : 0);
}

const seatText = (seats: number) => `${seats} ${seats === 1 ? "seat" : "seats"}`;

const { spring, duration, ease } = motionTokens;
const enterEase: [number, number, number, number] = [...ease.enter];
const exitEase: [number, number, number, number] = [...ease.standard];

/** A spring stated as "settle in this many seconds", so durations stay readable in the source. */
function springIn(seconds: number, damping: number) {
  const frequency = (2 * Math.PI) / (1.2 * seconds);
  return { type: "spring" as const, stiffness: frequency * frequency, damping: 2 * (1 - damping) * frequency, mass: 1 };
}

/** The outline travelling between plans. */
const frameSpring = springIn(0.5, 0);
/** The billing thumb sliding between Monthly and Yearly. */
const billingSpring = springIn(0.32, 0);

const noop = () => () => {};

/** A rolling amount inside the block's tabular-numeral wrapper. */
function Num({ value, prefix = "" }: { value: number; prefix?: string }) {
  return (
    <span className={styles.num}>
      <AnimatedCounter value={value} prefix={prefix} />
    </span>
  );
}

/** A label that rises and falls when its text changes, keyed by the text itself. */
function Swap({ text, reduced, className }: { text: string; reduced: boolean; className?: string }) {
  return (
    <span className={[styles.swap, className].filter(Boolean).join(" ")}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.35em" }}
          animate={{ opacity: 1, y: "0em" }}
          exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: "-0.3em", transition: { duration: duration.fast, ease: exitEase } }}
          transition={reduced ? { duration: duration.instant } : { duration: duration.standard, ease: enterEase }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export interface PricingCalculatorProps {
  /** Renders without the block's own surface. The preview frame flattens the controls and totals panels. */
  flat?: boolean;
}

/**
 * A seat-based pricing calculator: a slider over real seat counts, monthly and yearly billing, three
 * plans with live per-seat and billed-total prices, a recommended badge that follows the team size,
 * and a trial button that confirms with a short loading state.
 */
export function PricingCalculator({ flat = false }: PricingCalculatorProps) {
  // useReducedMotion reads a media query, so it is only trusted after hydration.
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const reduced = !!useReducedMotion() && hydrated;
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, "");

  const [index, setIndex] = useState(SEATS.indexOf(20));
  const [period, setPeriod] = useState<Period>("yearly");
  const [picked, setPicked] = useState<PlanId | null>(null);
  const [trial, setTrial] = useState<"idle" | "starting" | "ready">("idle");
  const [announcement, setAnnouncement] = useState("");
  const timers = useRef<number[]>([]);
  const periodButtons = useRef(new Map<Period, HTMLButtonElement>());

  // The trial timers belong to the block: drop them when it unmounts mid-flight.
  useEffect(() => () => { timers.current.forEach(window.clearTimeout); }, []);

  const seats = SEATS[index];
  const recommendedId: PlanId = seats <= 5 ? "starter" : seats < 50 ? "team" : "business";
  const pickedPlan = PLANS.find(plan => plan.id === picked);
  // A picked plan is honoured until the seat count outgrows it, then the recommendation takes over.
  const plan = pickedPlan && available(pickedPlan, seats) ? pickedPlan : PLANS.find(item => item.id === recommendedId)!;

  const perSeat = seatPrice(plan, seats, period);
  const monthlyTotal = seatPrice(plan, seats, "monthly") * seats;
  const yearlyTotal = seatPrice(plan, seats, "yearly") * seats * 12;
  const saving = 12 * monthlyTotal - yearlyTotal;
  const due = period === "yearly" ? yearlyTotal : monthlyTotal;
  const layoutTransition = reduced ? { duration: 0 } : frameSpring;

  const wrapRef = useRef<HTMLDivElement>(null);
  const frameX = useMotionValue(0);
  const frameY = useMotionValue(0);
  const frameWidth = useMotionValue(0);
  const frameHeight = useMotionValue(0);
  const frameProgress = useMotionValue(1);
  /** Where the outline is and where it is going, in the plans wrapper's own coordinates. */
  const frameState = useRef({ id: "", from: [0, 0, 0, 0], live: [0, 0, 0, 0] });
  const [measured, setMeasured] = useState(false);

  // The outline follows the selected card: it interpolates between the old and the new rect whenever
  // the recommendation moves, and tracks resizes without animating.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const state = frameState.current;
    const values = [frameX, frameY, frameWidth, frameHeight];
    const paint = () => {
      const progress = frameProgress.get();
      values.forEach((value, axis) => value.set(state.from[axis] + (state.live[axis] - state.from[axis]) * progress));
    };
    const measure = () => {
      const card = wrap.querySelector<HTMLElement>(`[data-plan="${plan.id}"]`);
      if (!card) return;
      // The CSS outline is inset by -1px, so the box it tracks is 2px larger than the card.
      state.live = [card.offsetLeft - 1, card.offsetTop - 1, card.offsetWidth + 2, card.offsetHeight + 2];
      paint();
    };

    const moved = state.id !== "" && state.id !== plan.id;
    state.id = plan.id;
    let running: ReturnType<typeof animate> | undefined;
    if (moved && !reduced) {
      state.from = values.map(value => value.get());
      frameProgress.jump(0);
      running = animate(frameProgress, 1, frameSpring);
    } else {
      frameProgress.jump(1);
    }
    measure();
    setMeasured(true);

    const stop = frameProgress.on("change", paint);
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    wrap.querySelectorAll("li[data-plan]").forEach(card => observer.observe(card));
    return () => {
      stop();
      observer.disconnect();
      running?.stop();
    };
  }, [plan.id, reduced, frameX, frameY, frameWidth, frameHeight, frameProgress]);

  const setSeatIndex = (next: number) => {
    setIndex(Math.max(0, Math.min(SEATS.length - 1, next)));
    if (trial === "ready") setTrial("idle");
  };

  const changePeriod = (next: Period) => {
    if (next === period) return;
    setPeriod(next);
    if (trial === "ready") setTrial("idle");
    setAnnouncement(next === "yearly" ? "Yearly billing. Prices shown per seat per month, billed once a year." : "Monthly billing");
  };

  // The billing switch is a radio group: an arrow flips the period and takes focus with it.
  const periodKeys = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const next: Period = period === "monthly" ? "yearly" : "monthly";
    changePeriod(next);
    periodButtons.current.get(next)?.focus();
  };

  const choosePlan = (next: Plan) => {
    setPicked(next.id);
    setTrial("idle");
    setAnnouncement(`${next.name} selected`);
  };

  const fill = index / (SEATS.length - 1);
  const marks = [
    { plan: "starter" as const, at: 0 },
    { plan: "team" as const, at: SEATS.indexOf(6) / (SEATS.length - 1) },
    { plan: "business" as const, at: SEATS.indexOf(50) / (SEATS.length - 1) },
  ];

  return (
    <section
      className={styles.root}
      aria-labelledby={`${uid}-title`}
      data-frame-flat={flat ? "" : undefined}
      style={flat ? { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" } : undefined}
    >
      <header className={styles.header}>
        <h2 id={`${uid}-title`} className={styles.title}>
          Pay for the seats you use
        </h2>
        <p className={styles.lede}>Move the slider to your team size. Every plan includes a 14 day trial.</p>
      </header>
      <div className={styles.controls} data-frame-flat={flat ? "" : undefined}>
        <div className={styles.seatsBlock}>
          <div className={styles.seatsHead}>
            <label htmlFor={`${uid}-seats`} className={styles.seatsLabel}>
              Team size
            </label>
            <div className={styles.seatCount}>
              <button type="button" className={styles.stepButton} aria-label="One fewer seat step" onClick={() => setSeatIndex(index - 1)} disabled={index === 0}>
                <Minus size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <span className={styles.seatValue} aria-hidden="true">
                <Num value={seats} />
                <Swap reduced={reduced} text={seats === 1 ? "seat" : "seats"} className={styles.seatUnit} />
              </span>
              <button type="button" className={styles.stepButton} aria-label="One more seat step" onClick={() => setSeatIndex(index + 1)} disabled={index === SEATS.length - 1}>
                <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className={styles.sliderWrap} style={{ "--fill": fill } as React.CSSProperties}>
            <input
              id={`${uid}-seats`}
              className={styles.slider}
              type="range"
              min={0}
              max={SEATS.length - 1}
              step={1}
              value={index}
              aria-valuetext={seatText(seats)}
              onChange={event => setSeatIndex(Number(event.target.value))}
            />
            <div className={styles.marks} aria-hidden="true">
              {marks.map(mark => (
                <span key={mark.plan} className={styles.mark} data-on={recommendedId === mark.plan || undefined} style={{ left: `${100 * mark.at}%` }}>
                  {PLANS.find(item => item.id === mark.plan)!.name}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.billing} role="radiogroup" aria-label="Billing period">
          {(["monthly", "yearly"] as const).map(option => (
            <button
              key={option}
              ref={node => {
                if (node) periodButtons.current.set(option, node);
                else periodButtons.current.delete(option);
              }}
              type="button"
              role="radio"
              aria-checked={period === option}
              tabIndex={period === option ? 0 : -1}
              className={styles.billingOption}
              onClick={() => changePeriod(option)}
              onKeyDown={periodKeys}
            >
              {period === option && (
                <motion.span layoutId={`${uid}-billing`} className={styles.billingThumb} transition={layoutTransition} aria-hidden="true" />
              )}
              <span className={styles.billingText}>{option === "monthly" ? "Monthly" : "Yearly"}</span>
              {option === "yearly" && <span className={styles.saveTag}>Save 20%</span>}
            </button>
          ))}
        </div>
      </div>
      <LayoutGroup id={uid}>
        <div ref={wrapRef} className={styles.plansWrap}>
          <ul className={styles.plans}>
            {PLANS.map(item => {
              const canBuy = available(item, seats);
              const price = seatPrice(item, seats, period);
              const selected = plan.id === item.id;
              const isRecommended = recommendedId === item.id;
              const features = item.features(seats, period);
              const charged = period === "yearly" ? price * seats * 12 : price * seats;
              return (
                <li
                  key={item.id}
                  className={styles.plan}
                  data-plan={item.id}
                  data-selected={selected || undefined}
                  data-available={canBuy || undefined}
                  aria-labelledby={`${uid}-${item.id}`}
                >
                  {/* Before the outline is measured the selected card draws it itself, so the frame never flashes in the wrong place. */}
                  {selected && !measured && <span className={styles.frame} aria-hidden="true" />}
                  <div className={styles.planHead}>
                    <h3 id={`${uid}-${item.id}`} className={styles.planName}>
                      {item.name}
                    </h3>
                    {isRecommended && (
                      <motion.span layoutId="badge" className={styles.badge} transition={layoutTransition}>
                        <motion.span layout="position" transition={layoutTransition}>
                          Recommended
                        </motion.span>
                      </motion.span>
                    )}
                  </div>
                  <div className={styles.collapse}>
                    <div>
                      <p className={styles.pitch}>{item.pitch}</p>
                    </div>
                  </div>
                  <div className={styles.priceArea}>
                    <AnimatePresence mode="popLayout" initial={false}>
                      {canBuy ? (
                        <motion.div
                          key="price"
                          className={styles.priceBlock}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: duration.fast }}
                        >
                          <p className={styles.price}>
                            <span className={styles.priceValue}>
                              <AnimatedCounter value={price} prefix="$" />
                            </span>
                            <span className={styles.priceUnit}>
                              per seat
                              <br />
                              per month
                            </span>
                          </p>
                          <p className={styles.planTotal}>
                            <Num value={charged} prefix="$" />
                            <Swap reduced={reduced} text={period === "yearly" ? `billed yearly for ${seatText(seats)}` : `a month for ${seatText(seats)}`} />
                          </p>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="limit"
                          className={styles.limit}
                          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: duration.standard, ease: enterEase }}
                        >
                          <p className={styles.limitTitle}>Starter fits up to {item.maxSeats} seats</p>
                          <p className={styles.limitBody}>You picked {seatText(seats)}.</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {canBuy ? (
                    <Button
                      variant={selected ? "primary" : "secondary"}
                      size="md"
                      className={styles.planButton}
                      onClick={() => choosePlan(item)}
                      aria-pressed={selected}
                    >
                      {selected ? (
                        <>
                          <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                          Selected
                        </>
                      ) : (
                        `Choose ${item.name}`
                      )}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="md"
                      className={styles.planButton}
                      onClick={() => {
                        setSeatIndex(SEATS.indexOf(item.maxSeats ?? 10));
                        choosePlan(item);
                      }}
                    >
                      Use {item.maxSeats} seats
                    </Button>
                  )}
                  <div className={styles.collapse}>
                    <div>
                      <ul className={styles.features} aria-label={`${item.name} features`}>
                        <AnimatePresence initial={false}>
                          {features.map(feature => (
                            <motion.li
                              key={feature.id}
                              className={styles.feature}
                              initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={reduced ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, height: 0, transition: { height: spring.smooth, opacity: { duration: duration.fast } } }}
                              transition={reduced ? { duration: 0.12 } : { height: spring.smooth, opacity: { duration: duration.standard, ease: enterEase, delay: 0.05 } }}
                            >
                              <span className={styles.featureInner}>
                                <Check className={styles.featureIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
                                <Swap reduced={reduced} text={feature.text} className={styles.featureText} />
                              </span>
                            </motion.li>
                          ))}
                        </AnimatePresence>
                      </ul>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {measured && (
            <motion.span
              className={`${styles.frame} ${styles.frameFloat}`}
              style={{ x: frameX, y: frameY, width: frameWidth, height: frameHeight }}
              aria-hidden="true"
            />
          )}
        </div>
      </LayoutGroup>
      <div className={styles.totals} data-frame-flat={flat ? "" : undefined}>
        <div className={styles.totalsMain}>
          <p className={styles.totalsPlan}>
            <Swap reduced={reduced} text={`${plan.name}, ${seatText(seats)}`} />
          </p>
          <p className={styles.totalsDue}>
            <Num value={due} prefix="$" />
            <Swap reduced={reduced} text={period === "yearly" ? "per year" : "per month"} className={styles.totalsUnit} />
          </p>
          <p className={styles.totalsNote}>
            <Swap reduced={reduced} text={`$${perSeat.toLocaleString("en-US")} per seat per month${period === "yearly" ? ", billed once a year" : ""}`} />
          </p>
        </div>
        <div className={styles.savings}>
          <AnimatePresence mode="popLayout" initial={false}>
            {period === "yearly" ? (
              <motion.p
                key="saving"
                className={styles.saving}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : -6, transition: { duration: duration.fast } }}
                transition={{ duration: duration.standard, ease: enterEase }}
              >
                <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                <span>
                  You save <Num value={saving} prefix="$" /> a year
                </span>
              </motion.p>
            ) : (
              <motion.button
                key="switch"
                type="button"
                className={styles.switch}
                onClick={() => changePeriod("yearly")}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : -6, transition: { duration: duration.fast } }}
                transition={{ duration: duration.standard, ease: enterEase }}
              >
                Save <Num value={saving} prefix="$" /> with yearly billing
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <Button
          variant="primary"
          size="lg"
          className={styles.cta}
          onClick={() => {
            if (trial !== "idle") return;
            setTrial("starting");
            timers.current.push(
              window.setTimeout(() => {
                setTrial("ready");
                setAnnouncement(`Trial of ${plan.name} started for ${seatText(seats)}.`);
                timers.current.push(window.setTimeout(() => setTrial(state => (state === "ready" ? "idle" : state)), 2800));
              }, 1100),
            );
          }}
          loading={trial === "starting"}
        >
          {trial === "ready" ? (
            <>
              <Check size={16} strokeWidth={1.75} aria-hidden="true" />
              Trial started
            </>
          ) : (
            `Start ${plan.name} trial`
          )}
        </Button>
      </div>
      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}

export default PricingCalculator;
