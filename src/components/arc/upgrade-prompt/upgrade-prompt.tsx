"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { Check, CircleAlert, CircleCheck, Clock } from "lucide-react";
import { Button } from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import styles from "./upgrade-prompt.module.css";

export type BillingInterval = "monthly" | "yearly";

export interface UpgradePlanFeature {
  id: string;
  label: ReactNode;
}

export interface UpgradePlanLimit {
  label: string;
  value: ReactNode;
}

export interface UpgradePlan {
  name: string;
  price: { monthly: number; yearly: number };
  currency: string;
  /** Credits included per month once upgraded. */
  limit: number;
  features: UpgradePlanFeature[];
  limits: UpgradePlanLimit[];
}

export type UpgradeSelection = { plan: string; interval: BillingInterval; amount: number; currency: string };

function ClaudeIcon({ title = "Claude", ...props }: React.SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

function OpenAIIcon({ title = "OpenAI", ...props }: React.SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

const defaultPlan: UpgradePlan = {
  name: "Pro",
  price: { monthly: 20, yearly: 16 },
  currency: "USD",
  limit: 2000,
  features: [
    { id: "credits", label: "2,000 AI credits a month" },
    {
      id: "models",
      label: (
        <>
          <span className={styles.nowrap}>
            <ClaudeIcon className={styles.claude} aria-hidden="true" width={14} height={14} /> Claude Opus 5.5
          </span>{" and "}<span className={styles.nowrap}>
            <OpenAIIcon className={styles.openai} aria-hidden="true" width={14} height={14} /> GPT-6.1 Sol
          </span>
        </>
      ),
    },
    { id: "queue", label: "Priority queue with no daily caps" },
  ],
  limits: [
    { label: "AI credits", value: "2,000 a month" },
    {
      label: "Models",
      value: (
        <span className={styles.models}>
          <ClaudeIcon className={styles.claude} aria-hidden="true" width={14} height={14} />
          Opus 5.5
          <OpenAIIcon className={styles.openai} aria-hidden="true" width={14} height={14} />
          GPT-6.1 Sol
        </span>
      ),
    },
    { label: "Queue", value: "Priority" },
  ],
};

const swapIn = { duration: 0.16, ease: [0.16, 1, 0.3, 1] as const, delay: 0.06 };
const swapOut = { duration: 0.1, ease: [0.7, 0, 0.84, 0] as const };
const fillSpring = { type: "spring" as const, visualDuration: 0.5, bounce: 0 };
const digitSpring = { type: "spring" as const, visualDuration: 0.28, bounce: 0 };

/** Formats a price in the plan's currency, showing cents only when the amount has them. */
function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2 * Number(!Number.isInteger(value)),
    maximumFractionDigits: 2,
  }).format(value);
}

/** Stacks one motion span per variant in the same grid cell and fades between them, so a state change
 *  never reflows the line. Inactive spans are hidden from AT and from layout via visibility. */
function Swap({ active, items, reduced, className }: { active: string; items: Record<string, ReactNode>; reduced: boolean; className?: string }) {
  return (
    <span className={`${styles.swap} ${className ?? ""}`}>
      {Object.entries(items).map(([key, content]) => {
        const on = key === active;
        return (
          <motion.span
            key={key}
            className={styles.swapItem}
            aria-hidden={!on || undefined}
            initial={false}
            animate={on ? { opacity: 1, y: 0, visibility: "visible" } : { opacity: 0, y: 2 * Number(!reduced), transitionEnd: { visibility: "hidden" } }}
            transition={on ? (reduced ? { duration: 0.12 } : swapIn) : swapOut}
          >
            {content}
          </motion.span>
        );
      })}
    </span>
  );
}

/** An odometer: each digit is a ten-slot strip that slides to the current value, so a price change counts. */
function Rolling({ value, reduced }: { value: string; reduced: boolean }) {
  const characters = value.split("");
  return (
    <span className={styles.rolling} aria-hidden="true">
      {characters.map((character, index) => {
        const place = characters.length - index;
        return /\d/.test(character) ? (
          <span key={`d${place}`} className={styles.digit}>
            <motion.span
              className={styles.strip}
              initial={false}
              animate={{ y: `${-(10 * Number(character))}%` }}
              transition={reduced ? { duration: 0 } : digitSpring}
            >
              {Array.from({ length: 10 }, (_, digit) => (
                <span key={digit}>{digit}</span>
              ))}
            </motion.span>
          </span>
        ) : (
          <span key={`c${place}`} className={styles.char}>
            {character}
          </span>
        );
      })}
    </span>
  );
}

/** One stage layer. Only the live panel is reachable: the others are inert and aria-hidden, then hidden. */
function Panel({ on, reduced, children }: { on: boolean; reduced: boolean; children: ReactNode }) {
  return (
    <motion.div
      className={styles.panel}
      inert={!on || undefined}
      aria-hidden={!on || undefined}
      initial={false}
      animate={on ? { opacity: 1, y: 0, visibility: "visible" } : { opacity: 0, y: 4 * Number(!reduced), transitionEnd: { visibility: "hidden" } }}
      transition={on ? (reduced ? { duration: 0.12 } : { duration: 0.2, ease: [0.16, 1, 0.3, 1], delay: 0.08 }) : { duration: 0.12, ease: [0.7, 0, 0.84, 0] }}
    >
      {children}
    </motion.div>
  );
}

export interface UpgradePromptProps {
  /** Credits already spent. */
  used?: number;
  /** Credits the free plan allows. */
  limit?: number;
  /** What is being counted, plural, such as "AI credits". */
  unit?: string;
  /** When the free allowance comes back, used in the copy. */
  resetsOn?: string;
  /** The plan being offered. Its features and limits render as rich nodes, so brands can sit inline. */
  plan?: UpgradePlan;
  /** Controlled billing interval. Leave undefined to let the component own it. */
  interval?: BillingInterval;
  /** Interval used until the toggle is touched. */
  defaultInterval?: BillingInterval;
  /** Called with the chosen interval. */
  onIntervalChange?: (interval: BillingInterval) => void;
  /** Runs the upgrade. Omit for the simulated 1.1s flow. Reject to show the error state. */
  onUpgrade?: (selection: UpgradeSelection, signal: AbortSignal) => void | Promise<void>;
  /** Called with the selection once the upgrade succeeds. */
  onUpgraded?: (selection: UpgradeSelection) => void;
  /** Called when the offer is dismissed. */
  onDismiss?: () => void;
  /** Replaces the reset action on the upgraded panel; by default it returns to the offer. */
  onContinue?: () => void;
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
}

/** An upgrade moment for a metered product: the usage meter sits above a stage that swaps between the offer,
 *  the upgraded summary, and a reminder panel, all at the same height. Prices count, the interval toggle
 *  animates the saving, and the upgrade runs through processing and error states with live announcements. */
export function UpgradePrompt({
  used = 50,
  limit = 50,
  unit = "AI credits",
  resetsOn = "Nov 1",
  plan = defaultPlan,
  interval,
  defaultInterval = "yearly",
  onIntervalChange,
  onUpgrade,
  onUpgraded,
  onDismiss,
  onContinue,
  title,
  description,
  className,
}: UpgradePromptProps) {
  const reduced = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<"offer" | "processing" | "upgraded" | "later" | "error">("offer");
  const [message, setMessage] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [ownInterval, setOwnInterval] = useState<BillingInterval>(defaultInterval);
  const selected = interval ?? ownInterval;
  const upgradeRun = useRef<AbortController | null>(null);
  const meter = useRef<HTMLDivElement>(null);
  const inView = useInView(meter, { once: true, amount: 0.6 });

  useEffect(() => () => upgradeRun.current?.abort(), []);

  const currency = plan.currency ?? "USD";
  const unitPrice = plan.price[selected];
  const total = selected === "yearly" ? 12 * plan.price.yearly : plan.price.monthly;
  const saving = Math.round((1 - plan.price.yearly / plan.price.monthly) * 100);
  const selection = useMemo(
    () => ({ plan: plan.name, interval: selected, amount: total, currency }),
    [plan.name, selected, total, currency],
  );

  const upgraded = phase === "upgraded";
  const processing = phase === "processing";
  const shownLimit = upgraded ? plan.limit : limit;
  const ratio = Math.min(1, Math.max(0, used / Math.max(1, shownLimit)));
  const exhausted = used >= limit;
  const stage = upgraded ? "upgraded" : phase === "later" ? "later" : "offer";
  const fill = inView || reduced ? ratio : 0;
  const remaining = Math.max(0, shownLimit - used);

  async function upgrade() {
    if (processing) return;
    upgradeRun.current?.abort();
    const controller = new AbortController();
    upgradeRun.current = controller;
    setPhase("processing");
    setMessage("");
    setAnnouncement(`Upgrading to ${plan.name}${onUpgrade ? "" : ". Simulated, nothing is charged"}.`);
    try {
      if (onUpgrade) await onUpgrade(selection, controller.signal);
      else {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(resolve, 1100);
          controller.signal.addEventListener("abort", () => {
            window.clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          }, { once: true });
        });
      }
      if (controller.signal.aborted) return;
      setPhase("upgraded");
      setAnnouncement(`You're on ${plan.name}. ${plan.limit.toLocaleString("en-US")} ${unit} a month.${onUpgrade ? "" : " Simulated, nothing was charged."}`);
      onUpgraded?.(selection);
    } catch (error) {
      if (controller.signal.aborted) return;
      const reason = error instanceof Error && error.message ? error.message : "The upgrade did not go through. Try again.";
      setMessage(reason);
      setPhase("error");
      setAnnouncement(reason);
    }
  }

  return (
    <section className={`${styles.root} ${className ?? ""}`} aria-label={`Upgrade to ${plan.name}`} data-phase={phase}>
      <header className={styles.header}>
        <h3 className={styles.title}>
          <Swap
            reduced={reduced}
            active={upgraded ? "done" : "limit"}
            items={{
              limit: title ?? (exhausted
                ? `You've used all ${limit.toLocaleString("en-US")} ${unit}`
                : `You've used ${used.toLocaleString("en-US")} of ${limit.toLocaleString("en-US")} ${unit}`),
              done: `You're on ${plan.name}`,
            }}
          />
        </h3>
        <p className={styles.description}>
          <Swap
            reduced={reduced}
            active={upgraded ? "done" : "limit"}
            items={{
              limit: description ?? `Your free ${unit} reset ${resetsOn}. Upgrade to keep going without the wait.`,
              done: "Your new limits are live. Pick up right where you left off.",
            }}
          />
        </p>
      </header>
      <div ref={meter} className={styles.meter}>
        <div className={styles.meterRow}>
          <Swap
            reduced={reduced}
            className={styles.state}
            active={upgraded ? "done" : exhausted ? "limit" : "near"}
            items={{
              limit: (
                <span className={styles.stateLabel} data-tone="warning">
                  <CircleAlert size={14} aria-hidden="true" />
                  Limit reached
                </span>
              ),
              near: (
                <span className={styles.stateLabel} data-tone="warning">
                  <CircleAlert size={14} aria-hidden="true" />
                  {Math.max(0, limit - used).toLocaleString("en-US")} left
                </span>
              ),
              done: (
                <span className={styles.stateLabel} data-tone="success">
                  <CircleCheck size={14} aria-hidden="true" />
                  {remaining.toLocaleString("en-US")} {unit} left
                </span>
              ),
            }}
          />
          <Swap
            reduced={reduced}
            className={styles.count}
            active={upgraded ? "done" : "limit"}
            items={{
              limit: <>{used.toLocaleString("en-US")} of {limit.toLocaleString("en-US")}</>,
              done: <>{used.toLocaleString("en-US")} of {plan.limit.toLocaleString("en-US")}</>,
            }}
          />
        </div>
        <div
          className={styles.track}
          role="meter"
          aria-label={unit}
          aria-valuemin={0}
          aria-valuemax={shownLimit}
          aria-valuenow={used}
          aria-valuetext={`${used.toLocaleString("en-US")} of ${shownLimit.toLocaleString("en-US")} ${unit} used`}
        >
          <motion.span
            className={styles.fill}
            data-tone={upgraded ? "accent" : "warning"}
            initial={false}
            animate={{ x: `${(fill - 1) * 100}%` }}
            transition={reduced ? { duration: 0 } : fillSpring}
          />
        </div>
      </div>
      <div className={styles.stage}>
        <Panel on={stage === "offer"} reduced={reduced}>
          <div className={styles.priceRow}>
            <div className={styles.priceBlock}>
              <div className={styles.price}>
                <span className={styles.amount}>
                  <Rolling value={money(unitPrice, currency)} reduced={reduced} />
                  <span className={styles.srOnly}>{money(unitPrice, currency)}</span>
                </span>
                <span className={styles.per}>/ month</span>
              </div>
              <p className={styles.meta}>
                <Swap
                  reduced={reduced}
                  active={phase === "error" ? "error" : selected}
                  items={{
                    monthly: "Billed monthly. Cancel anytime.",
                    yearly: `${money(total, currency)} billed yearly. Cancel anytime.`,
                    error: (
                      <span className={styles.error}>
                        <CircleAlert size={14} aria-hidden="true" />
                        <span className={styles.ellipsis}>{message}</span>
                      </span>
                    ),
                  }}
                />
              </p>
            </div>
            <div className={styles.toggle} inert={processing || undefined}>
              <SegmentedControl
                label="Billing interval"
                value={selected}
                onValueChange={(value) => {
                  const next: BillingInterval = value === "monthly" ? "monthly" : "yearly";
                  if (interval === undefined) setOwnInterval(next);
                  onIntervalChange?.(next);
                }}
                options={[
                  { value: "monthly", label: "Monthly" },
                  { value: "yearly", label: "Yearly", accessory: saving > 0 ? <span className={styles.save}>{`\u2212${saving}%`}</span> : undefined },
                ]}
              />
            </div>
          </div>
          <ul className={styles.features} aria-label={`${plan.name} includes`}>
            {plan.features.map((feature) => (
              <li key={feature.id} className={styles.feature}>
                <Check className={styles.check} size={14} strokeWidth={2.25} aria-hidden="true" />
                <span className={styles.featureLabel}>{feature.label}</span>
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            <Button
              variant="secondary"
              onClick={() => {
                setPhase("later");
                setAnnouncement(`Dismissed. Your ${unit} reset ${resetsOn}.`);
                onDismiss?.();
              }}
              disabled={processing}
            >
              Maybe later
            </Button>
            <Button className={styles.primary} onClick={upgrade} loading={processing}>
              {processing ? "Upgrading" : phase === "error" ? "Try again" : `Upgrade to ${plan.name}`}
            </Button>
          </div>
        </Panel>
        <Panel on={stage === "upgraded"} reduced={reduced}>
          <dl className={styles.limits}>
            {plan.limits.map((row) => (
              <div key={row.label} className={styles.limitRow}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.meta}>
            {`${money(total, currency)} billed today${onUpgrade ? "." : ". Simulated, nothing was charged."}`}
          </p>
          <div className={styles.actions} data-single>
            <Button
              className={styles.primary}
              onClick={() => {
                if (onContinue) onContinue();
                else {
                  setPhase("offer");
                  setAnnouncement("Demo reset.");
                }
              }}
            >
              Continue
            </Button>
          </div>
        </Panel>
        <Panel on={stage === "later"} reduced={reduced}>
          <div className={styles.later}>
            <Clock className={styles.laterIcon} size={16} aria-hidden="true" />
            <div className={styles.laterText}>
              <p className={styles.laterTitle}>{`We'll remind you ${resetsOn}`}</p>
              <p className={styles.laterBody}>
                {`Your ${unit} come back then, and everything you made stays put. ${plan.name} is here whenever you need more.`}
              </p>
            </div>
          </div>
          <div className={styles.actions} data-single>
            <Button
              variant="secondary"
              onClick={() => {
                setPhase("offer");
                setAnnouncement("");
              }}
            >
              {`See ${plan.name} again`}
            </Button>
          </div>
        </Panel>
      </div>
      <p className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}

export default UpgradePrompt;
