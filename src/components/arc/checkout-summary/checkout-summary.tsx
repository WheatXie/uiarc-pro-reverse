"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "motion/react";
import { Check, CreditCard, LoaderCircle, LockKeyhole, TicketPercent, X } from "lucide-react";
import AnimatedCounter from "../animated-counter/animated-counter";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./checkout-summary.module.css";

const { spring, duration, ease } = motionTokens;
const enterEase: [number, number, number, number] = [...ease.enter];

/** The product the sample order sells when no `item` is passed. */
const sampleItem: CheckoutSummaryItem = {
  name: "Field notes, yearly",
  description: "Unlimited notebooks and sync for one person",
  price: 96,
  period: "per year",
};

/** Yearly-billing discount the sample order already has applied. */
const sampleAdjustments: CheckoutSummaryLine[] = [{ id: "annual", label: "Yearly billing", amount: -24, note: "Two months free" }];

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** The sample promo code: WELCOME10 covers 10% of the order, anything else is rejected. */
const sampleCoupon: CheckoutSummaryProps["coupon"] = {
  placeholder: "Try WELCOME10",
  onApply: async code => {
    await wait(700);
    return code === "WELCOME10"
      ? { ok: true, code, label: "Welcome, 10% off", amount: 7.2 }
      : { ok: false, message: "That code is not valid. Try WELCOME10." };
  },
};

/** Simulated payment so the sample order can walk through processing → paid. */
const samplePay = () => wait(1400);

export interface CheckoutSummaryLine {
  /** Stable key. `coupon` is used by the line of an applied code. */
  id: string;
  /** Line label. */
  label: string;
  /** Amount added to the subtotal. Negative for a discount, which is tinted. */
  amount: number;
  /** Short note under the label, such as `38 of 50 left`. */
  note?: string;
}

export interface CheckoutSummaryItem {
  /** Product name, truncated on one line. */
  name: string;
  /** Short line under the name. */
  description?: string;
  /** Price before adjustments. Shown as the subtotal. */
  price: number;
  /** Note under the price, such as `one payment` or `per year`. */
  period?: string;
  /** Thumbnail or mark in a 44px tile. */
  media?: ReactNode;
}

/** What `coupon.onApply` resolves: a discount amount (positive) or the message to show. */
export type CheckoutCouponResult =
  | { ok: true; code: string; amount: number; label?: string }
  | { ok: false; message: string };

export interface CheckoutSummaryProps {
  /** The product: name, price, and optional description, period, and media. Omit it to render the built-in sample order. */
  item?: CheckoutSummaryItem;
  /** Automatic lines, each with id, label, amount (negative for a discount), and optional note. */
  adjustments?: CheckoutSummaryLine[];
  /** Enables the promo code field. Validate the code on your server. */
  coupon?: { onApply: (code: string) => Promise<CheckoutCouponResult>; placeholder?: string };
  /** Tax line. With `rate` the amount is computed from the discounted subtotal; without it `note` is shown. */
  tax?: { label: string; rate?: number; note?: string };
  /** Symbol before amounts. */
  currency?: string;
  /** Heading, also the section's accessible name. */
  title?: string;
  /** Pay button label. Receives the formatted total. */
  payLabel?: (total: string) => string;
  /** Client-side payment. Resolve to show success, reject to show an error and Try again. */
  onPay?: () => Promise<void>;
  /** Posts a native form instead, such as to a route that creates a hosted checkout session. */
  form?: { action: string; fields?: Record<string, string> };
  /** Line beside the lock under the button. */
  secureNote?: ReactNode;
  /** Button label once `onPay` resolves. */
  successLabel?: string;
  /** Shows the button but blocks payment, such as before checkout opens. */
  disabled?: boolean;
  /** Small print under the button. */
  footnote?: ReactNode;
  /** Renders without the block's own surface. The preview frame flattens the card. */
  flat?: boolean;
  /** Extra class on the root section. */
  className?: string;
}

type CouponState =
  | { status: "idle" }
  | { status: "applying" }
  | { status: "applied"; code: string; label: string; amount: number }
  | { status: "error"; message: string };

type PayState = "idle" | "processing" | "done" | "error";

/** `−$96.00`: a true minus sign, the currency, and grouped digits. */
function formatMoney(value: number, currency: string, decimals: number) {
  return `${value < 0 ? "−" : ""}${currency}${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function CheckoutSummaryPanel({
  item,
  adjustments = [],
  coupon,
  tax,
  currency = "$",
  title = "Order summary",
  payLabel = total => `Pay ${total}`,
  onPay,
  form,
  secureNote = "Encrypted payment",
  successLabel = "Paid",
  disabled = false,
  footnote,
  flat = false,
  className,
}: CheckoutSummaryProps & { item: CheckoutSummaryItem }) {
  const reduced = !!useReducedMotion();
  const inputId = useId();
  const errorId = useId();
  const shake = useAnimationControls();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [couponState, setCouponState] = useState<CouponState>({ status: "idle" });
  const [payState, setPayState] = useState<PayState>("idle");

  // Coming back through the back-forward cache must not leave the button stuck on Paid.
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) setPayState("idle");
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  const applied = couponState.status === "applied" ? couponState : null;
  const lines = [...adjustments, ...(applied ? [{ id: "coupon", label: applied.label, amount: -applied.amount }] : [])];
  const discounted = Math.max(0, item.price + lines.reduce((sum, line) => sum + line.amount, 0));
  const taxAmount = tax?.rate ? Math.round(discounted * tax.rate * 100) / 100 : 0;
  const total = discounted + taxAmount;
  // Group every amount the same way: two decimals as soon as any of them is fractional.
  const decimals = 2 * Number([item.price, ...lines.map(line => line.amount), total].some(amount => !Number.isInteger(amount)));
  const totalText = formatMoney(total, currency, decimals);

  const fail = (message: string) => {
    setCouponState({ status: "error", message });
    if (!reduced) shake.start({ x: [0, -6, 6, -4, 3, 0], transition: { duration: 0.36, ease: [...ease.standard] } });
  };

  const applyCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!coupon || couponState.status === "applying") return;
    const entered = code.trim();
    if (!entered) {
      inputRef.current?.focus();
      return;
    }
    setCouponState({ status: "applying" });
    try {
      const result = await coupon.onApply(entered);
      if (result.ok) {
        setCouponState({ status: "applied", code: result.code, label: result.label ?? `Code ${result.code}`, amount: result.amount });
      } else {
        fail(result.message);
      }
    } catch {
      fail("Could not check the code. Try again.");
    }
  };

  const pay = async () => {
    if (!onPay || payState === "processing" || payState === "done") return;
    setPayState("processing");
    try {
      await onPay();
      setPayState("done");
    } catch {
      setPayState("error");
    }
  };

  const label = payState === "processing" ? "Processing" : payState === "done" ? successLabel : payState === "error" ? "Try again" : payLabel(totalText);
  const icon =
    payState === "processing" ? (
      <LoaderCircle className={styles.spin} size={18} strokeWidth={1.75} aria-hidden="true" />
    ) : payState === "done" ? (
      <Check size={18} strokeWidth={2} aria-hidden="true" />
    ) : form ? (
      <CreditCard size={18} strokeWidth={1.75} aria-hidden="true" />
    ) : (
      <LockKeyhole size={16} strokeWidth={1.75} aria-hidden="true" />
    );

  const payInner = (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={payState === "idle" ? `idle-${totalText}` : payState}
        className={styles.payInner}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8, transition: { duration: duration.fast } }}
        transition={{ duration: duration.standard, ease: enterEase }}
      >
        {icon}
        <span>{label}</span>
      </motion.span>
    </AnimatePresence>
  );

  const payProps = {
    className: styles.pay,
    "data-state": payState,
    disabled: disabled || payState === "processing" || payState === "done",
    "aria-live": "polite" as const,
  };

  return (
    <section
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-label={title}
      data-frame-flat={flat ? "" : undefined}
      style={flat ? { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" } : undefined}
    >
      <h3 className={styles.title}>{title}</h3>
      <div className={styles.item}>
        {item.media ? <div className={styles.media}>{item.media}</div> : null}
        <div className={styles.itemText}>
          <span className={styles.itemName}>{item.name}</span>
          {item.description ? <span className={styles.itemDescription}>{item.description}</span> : null}
        </div>
        <span className={styles.itemPrice}>
          {formatMoney(item.price, currency, decimals)}
          {item.period ? <span className={styles.itemPeriod}>{item.period}</span> : null}
        </span>
      </div>
      {coupon ? (
        <motion.div className={styles.coupon} animate={shake}>
          <AnimatePresence mode="popLayout" initial={false}>
            {applied ? (
              <motion.div
                key="chip"
                className={styles.chip}
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: duration.fast } }}
                transition={reduced ? { duration: 0 } : spring.smooth}
              >
                <TicketPercent size={16} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.chipCode}>{applied.code}</span>
                <span className={styles.chipNote}>applied</span>
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={() => {
                    setCouponState({ status: "idle" });
                    setCode("");
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                  aria-label={`Remove code ${applied.code}`}
                >
                  <X size={14} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                className={styles.couponForm}
                onSubmit={applyCode}
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: duration.fast } }}
                transition={{ duration: duration.standard, ease: enterEase }}
                data-error={couponState.status === "error" || undefined}
              >
                <label htmlFor={inputId} className={styles.srOnly}>
                  Promo code
                </label>
                <input
                  ref={inputRef}
                  id={inputId}
                  className={styles.couponInput}
                  value={code}
                  onChange={event => {
                    setCode(event.target.value.toUpperCase());
                    if (couponState.status === "error") setCouponState({ status: "idle" });
                  }}
                  placeholder={coupon.placeholder ?? "Promo code"}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={couponState.status === "error" || undefined}
                  aria-describedby={couponState.status === "error" ? errorId : undefined}
                />
                <button type="submit" className={styles.couponApply} disabled={couponState.status === "applying"}>
                  {couponState.status === "applying" ? (
                    <LoaderCircle className={styles.spin} size={16} strokeWidth={1.75} aria-label="Checking code" />
                  ) : (
                    "Apply"
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {couponState.status === "error" ? (
              <motion.p
                key="error"
                id={errorId}
                className={styles.couponError}
                role="alert"
                initial={{ opacity: 0, height: 0, paddingTop: 0 }}
                animate={{ opacity: 1, height: "auto", paddingTop: 8 }}
                exit={{ opacity: 0, height: 0, paddingTop: 0 }}
                transition={reduced ? { duration: 0 } : spring.smooth}
              >
                {couponState.message}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : null}
      <dl className={styles.lines} data-frame-flat={flat ? "" : undefined}>
        <div className={styles.line}>
          <dt>Subtotal</dt>
          <dd>{formatMoney(item.price, currency, decimals)}</dd>
        </div>
        <AnimatePresence initial={false}>
          {lines.map(line => (
            <motion.div
              key={line.id}
              className={`${styles.line} ${styles.lineAnimated}`}
              data-discount={line.amount < 0 || undefined}
              initial={{ height: 0, opacity: 0, paddingTop: 0, paddingBottom: 0 }}
              animate={{ height: "auto", opacity: 1, paddingTop: 5, paddingBottom: 5 }}
              exit={{ height: 0, opacity: 0, paddingTop: 0, paddingBottom: 0 }}
              transition={reduced ? { duration: 0 } : { default: spring.smooth, opacity: { duration: duration.standard } }}
            >
              <dt>
                {line.label}
                {line.note ? <span className={styles.lineNote}>{line.note}</span> : null}
              </dt>
              <dd>{formatMoney(line.amount, currency, decimals)}</dd>
            </motion.div>
          ))}
        </AnimatePresence>
        {tax ? (
          <div className={styles.line}>
            <dt>{tax.label}</dt>
            <dd className={tax.rate ? undefined : styles.muted}>{tax.rate ? formatMoney(taxAmount, currency, decimals) : (tax.note ?? "Calculated at checkout")}</dd>
          </div>
        ) : null}
        <div className={`${styles.line} ${styles.total}`}>
          <dt>Total</dt>
          <dd>
            <span className={styles.srOnly}>{totalText}</span>
            <span className={styles.totalValue} aria-hidden="true">
              {currency}
              <span className={styles.inline}>
                <AnimatedCounter value={total} decimals={decimals} />
              </span>
            </span>
          </dd>
        </div>
      </dl>
      {form ? (
        <form action={form.action} method="post" onSubmit={() => setPayState("processing")}>
          {Object.entries(form.fields ?? {}).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <button type="submit" {...payProps}>
            {payInner}
          </button>
        </form>
      ) : (
        <button type="button" onClick={pay} {...payProps}>
          {payInner}
        </button>
      )}
      {secureNote ? (
        <p className={styles.secure}>
          <LockKeyhole size={14} strokeWidth={1.75} aria-hidden="true" />
          {secureNote}
        </p>
      ) : null}
      {payState === "error" ? (
        <p className={styles.payError} role="alert">
          The payment did not go through. Try again, or use another method.
        </p>
      ) : null}
      {footnote ? <p className={styles.footnote}>{footnote}</p> : null}
    </section>
  );
}

/**
 * An order summary for the last step before payment, with discount lines, a promo code field, a
 * counting total, and a pay button that moves from idle to processing to paid. Without `item` it
 * renders a sample order with a simulated code and payment.
 */
export function CheckoutSummary(props: CheckoutSummaryProps) {
  if (props.item) return <CheckoutSummaryPanel {...props} item={props.item} />;
  return (
    <CheckoutSummaryPanel
      adjustments={sampleAdjustments}
      coupon={sampleCoupon}
      tax={{ label: "Sales tax (8.5%)", rate: 0.085 }}
      onPay={samplePay}
      {...props}
      item={sampleItem}
    />
  );
}

export default CheckoutSummary;
