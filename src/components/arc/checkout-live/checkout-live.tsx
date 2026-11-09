"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { Check, ChevronDown, LoaderCircle, Lock, Minus, Plus, RotateCcw, Download, X } from "lucide-react";
import { Select } from "../select/select";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./checkout-live.module.css";

const { duration, spring, ease } = motionTokens;
const enterEase = [...ease.enter] as [number, number, number, number];
const exitEase = [...ease.exit] as [number, number, number, number];
const standardEase = [...ease.standard] as [number, number, number, number];

export interface CheckoutLivePlan {
  id: string;
  name: string;
  /** Price per seat per month, in minor units. */
  seat: number;
  blurb: string;
}

export interface CheckoutLiveAddon {
  id: string;
  name: string;
  detail: string;
  /** Price per month, in minor units. */
  monthly: number;
}

export interface CheckoutLiveCountry {
  code: string;
  name: string;
  /** Tax rate as a fraction, for example 0.19. Zero hides the tax line's amount. */
  rate: number;
  taxLabel: string;
  postal: RegExp;
  postalHint: string;
}

export interface CheckoutLivePayment {
  plan: string;
  seats: number;
  billing: "monthly" | "yearly";
  addons: string[];
  coupon?: string;
  country: string;
  email: string;
  method: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export type CheckoutLiveCouponResult = { ok: true; code: string; percent: number } | { ok: false; message: string };

export interface CheckoutLiveProps {
  /** Plans on sale, cheapest first. The seat price is per seat per month, in minor units. */
  plans?: CheckoutLivePlan[];
  /** Optional extras, priced per month. */
  addons?: CheckoutLiveAddon[];
  /** Countries the billing address accepts, each with its tax rate and postal pattern. */
  countries?: CheckoutLiveCountry[];
  /** Plan selected on first render. */
  defaultPlan?: string;
  /** Seats on first render, clamped to 1–500. */
  defaultSeats?: number;
  /** Billing period selected on first render. */
  defaultBilling?: "monthly" | "yearly";
  /** Add-ons selected on first render. */
  defaultAddons?: string[];
  /** Fraction taken off the yearly per-seat price, for example 0.2 for 20%. */
  yearlyDiscount?: number;
  /** ISO currency code for every amount. */
  currency?: string;
  /** Checks a coupon code. Return the accepted code and its percent, or a message explaining the refusal. */
  validateCoupon?: (code: string) => CheckoutLiveCouponResult | Promise<CheckoutLiveCouponResult>;
  /** Runs the payment. Throw to show its message in the form; resolve to mark the order paid. */
  onPay?: (payment: CheckoutLivePayment) => void | Promise<void>;
  /** Extra class on the frame. */
  className?: string;
}

const defaultPlans: CheckoutLivePlan[] = [
  { id: "starter", name: "Starter", seat: 1200, blurb: "Core docs and boards" },
  { id: "team", name: "Team", seat: 2400, blurb: "Automations and guests" },
  { id: "business", name: "Business", seat: 4200, blurb: "Audit, SLAs, and admin" },
];

const defaultAddons: CheckoutLiveAddon[] = [
  { id: "support", name: "Priority support", detail: "Four hour response", monthly: 4900 },
  { id: "sso", name: "SSO and SCIM", detail: "Okta, Entra ID, Google", monthly: 9900 },
  { id: "audit", name: "Extended audit log", detail: "Two year retention", monthly: 2900 },
];

const defaultCountries: CheckoutLiveCountry[] = [
  { code: "DE", name: "Germany", rate: .19, taxLabel: "VAT 19%", postal: /^\d{5}$/, postalHint: "Use five digits" },
  { code: "US", name: "United States", rate: 0, taxLabel: "Sales tax", postal: /^\d{5}(-\d{4})?$/, postalHint: "Use a five digit ZIP code" },
  { code: "GB", name: "United Kingdom", rate: .2, taxLabel: "VAT 20%", postal: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i, postalHint: "Use a UK postcode like SW1A 1AA" },
  { code: "CH", name: "Switzerland", rate: .081, taxLabel: "VAT 8.1%", postal: /^\d{4}$/, postalHint: "Use four digits" },
  { code: "CA", name: "Canada", rate: .13, taxLabel: "HST 13%", postal: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i, postalHint: "Use a postal code like M5V 2T6" },
  { code: "AU", name: "Australia", rate: .1, taxLabel: "GST 10%", postal: /^\d{4}$/, postalHint: "Use four digits" },
];

/** The demo's coupon book: two codes that work and one that has expired. */
function sampleCoupon(code: string): CheckoutLiveCouponResult {
  const next = code.trim().toUpperCase();
  if (next === "LAUNCH20") return { ok: true, code: next, percent: 20 };
  if (next === "TEAM10") return { ok: true, code: next, percent: 10 };
  if (next === "SUMMER25") return { ok: false, message: "SUMMER25 ended on August 31" };
  return { ok: false, message: `We could not find ${next || "that code"}` };
}

const sampleBilling = { email: "emma@northwind.studio", name: "Emma Collins", address: "Torstraße 109", city: "Berlin", postal: "10119", country: "DE" };
const fieldOrder = ["email", "name", "address", "city", "postal", "card", "expiry", "cvc"] as const;
const expressMethods = ["Apple Pay", "Google Pay", "PayPal"];
const digitRange = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const collapse: { initial: { height: number; opacity: number }; animate: { height: "auto"; opacity: number }; exit: { height: number; opacity: number } } = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
};
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const classes = (...list: (string | false | undefined)[]) => list.filter(Boolean).join(" ");

type FieldKey = (typeof fieldOrder)[number];
type Billing = "monthly" | "yearly";
type Phase = "edit" | "processing" | "paid";
type Receipt = { number: string; date: string; last4: string; brand: string };

/** Keeps the field's error slot closed without animating the whole form layout. */
function Collapse({ children, className, instant }: { children: React.ReactNode; className?: string; instant?: boolean }) {
  return (
    <motion.div
      className={classes(styles.collapse, className)}
      {...collapse}
      exit={instant ? { opacity: 0, transition: { duration: 0 } } : collapse.exit}
      transition={spring.smooth}>
      {children}
    </motion.div>
  );
}

/** Money in a rolling register: each digit rides its own strip so a total changes value instead of flickering. */
function Amount({ value, className }: { value: string; className?: string }) {
  const reduced = useReducedMotion();
  const characters = Array.from(value);
  const transition = reduced ? { duration: 0 } : spring.snappy;
  return (
    <span className={classes(styles.roll, className)}>
      <span className={styles.srOnly}>{value}</span>
      <span className={styles.rollTrack} aria-hidden="true">
        {characters.map((character, index) => {
          const place = characters.length - index;
          return /\d/.test(character) ? (
            <span key={`d${place}`} className={styles.rollDigit}>
              <motion.span className={styles.rollStrip} initial={false} animate={{ y: `${-10 * Number(character)}%` }} transition={transition}>
                {digitRange.map(digit => <span key={digit}>{digit}</span>)}
              </motion.span>
            </span>
          ) : (
            <span key={`s${place}`} className={styles.rollGlyph}>{character}</span>
          );
        })}
      </span>
    </span>
  );
}

/** Apple, Google, and PayPal marks drawn inline so the buttons need no brand assets. */
function WalletMark({ name }: { name: string }) {
  if (name === "Apple Pay") {
    return (
      <span className={styles.walletMark} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M16.37 1.43c0 1.14-.5 2.27-1.18 3.08-.74.9-1.99 1.57-2.99 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.57-2.27 1.21-2.98.8-.94 2.14-1.64 3.25-1.68.03.13.05.28.05.43zm4.56 15.71c-.03.07-.46 1.58-1.52 3.12-.94 1.34-1.94 2.71-3.43 2.71-1.52 0-1.9-.88-3.63-.88-1.7 0-2.3.91-3.67.91-1.38 0-2.33-1.26-3.43-2.8-1.29-1.82-2.32-4.63-2.32-7.28 0-4.28 2.8-6.55 5.55-6.55 1.45 0 2.68.95 3.6.95.87 0 2.22-1.01 3.9-1.01.61 0 2.89.06 4.37 2.19-.13.09-2.38 1.37-2.38 4.19 0 3.26 2.85 4.42 2.96 4.45z" />
        </svg>
        Pay
      </span>
    );
  }
  if (name === "Google Pay") {
    return (
      <span className={styles.walletMark} aria-hidden="true">
        <svg viewBox="0 0 48 48" width="16" height="16">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        Pay
      </span>
    );
  }
  return (
    <span className={styles.paypalMark} aria-hidden="true">
      <span>Pay</span>
      <span>Pal</span>
    </span>
  );
}

/** A checkout that prices itself: plans, seats, add-ons, coupon, tax, and a simulated payment that ends in a receipt. */
export function CheckoutLive({
  plans = defaultPlans,
  addons = defaultAddons,
  countries = defaultCountries,
  defaultPlan = "team",
  defaultSeats = 8,
  defaultBilling = "yearly",
  defaultAddons: initialAddons = ["support"],
  yearlyDiscount = .2,
  currency = "USD",
  validateCoupon = sampleCoupon,
  onPay,
  className,
}: CheckoutLiveProps) {
  const id = useId();
  const fields = useRef<Partial<Record<FieldKey, HTMLInputElement | null>>>({});
  const couponInput = useRef<HTMLInputElement>(null);
  const summaryTitle = useRef<HTMLHeadingElement>(null);
  const reduced = useReducedMotion();
  const [plan, setPlan] = useState(defaultPlan);
  const [seats, setSeats] = useState(defaultSeats);
  const [billing, setBilling] = useState<Billing>(defaultBilling);
  const [addonsOn, setAddonsOn] = useState(initialAddons);
  const [coupon, setCoupon] = useState<{ code: string; percent: number } | null>(null);
  const [couponFormOpen, setCouponFormOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [values, setValues] = useState({ ...sampleBilling, card: "", expiry: "", cvc: "" });
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [phase, setPhase] = useState<Phase>("edit");
  const [method, setMethod] = useState("card");
  const [payError, setPayError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [saved, setSaved] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const country = countries.find(item => item.code === values.country) ?? countries[0];
  const selectedPlan = plans.find(item => item.id === plan) ?? plans[0];
  const months = billing === "yearly" ? 12 : 1;
  const priceFactor = billing === "yearly" ? months * (1 - yearlyDiscount) : 1;
  const planAmount = Math.round(selectedPlan.seat * seats * priceFactor);
  const addonLines = addons.filter(item => addonsOn.includes(item.id)).map(item => ({ ...item, amount: Math.round(item.monthly * priceFactor) }));
  const subtotal = planAmount + addonLines.reduce((sum, item) => sum + item.amount, 0);
  const discount = coupon ? Math.round((subtotal * coupon.percent) / 100) : 0;
  const tax = Math.round((subtotal - discount) * country.rate);
  const total = subtotal - discount + tax;
  const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

  /** Everything the form would refuse, keyed by field. Empty while the visitor has not typed anything wrong. */
  const errors: Partial<Record<FieldKey, string>> = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) errors.email = values.email.trim() ? "Enter a valid email like name@company.com" : "Enter your email";
  if (values.name.trim().length < 2) errors.name = "Enter the name on the card";
  if (values.address.trim().length < 3) errors.address = "Enter a street address";
  if (!values.city.trim()) errors.city = "Enter a city";
  if (values.postal.trim()) {
    if (country && !country.postal.test(values.postal.trim())) errors.postal = country.postalHint;
  } else errors.postal = "Enter a postal code";
  const cardDigits = values.card.replace(/\D/g, "");
  const amex = /^3[47]/.test(cardDigits);
  if (cardDigits) {
    if (cardDigits.length < (amex ? 15 : 16)) errors.card = "This card number is too short";
    else if (!luhn(cardDigits)) errors.card = "Check the card number for a typo";
  } else errors.card = "Enter a card number";
  const expiryMatch = /^(\d{2})\/(\d{2})$/.exec(values.expiry);
  if (expiryMatch) {
    const month = Number(expiryMatch[1]), year = 2000 + Number(expiryMatch[2]), now = new Date();
    if (month < 1 || month > 12) errors.expiry = "Month runs 01 to 12";
    else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) errors.expiry = "This card has expired";
  } else errors.expiry = "Use MM/YY";
  if (!RegExp(`^\\d{${amex ? 4 : 3}}$`).test(values.cvc)) errors.cvc = amex ? "Four digits on the front" : "Three digits on the back";

  const brand = /^4/.test(cardDigits) ? "Visa" : /^(5[1-5]|2[2-7])/.test(cardDigits) ? "Mastercard" : /^3[47]/.test(cardDigits) ? "Amex" : "";
  const paid = phase === "paid";
  const busy = phase === "processing";
  const asideTransition: Transition = reduced ? { duration: 0 } : spring.smooth;

  const update = (key: FieldKey | "country", next: string) => {
    setValues(current => ({ ...current, [key]: next }));
    setPayError("");
  };

  async function applyCoupon(event?: React.FormEvent) {
    event?.preventDefault();
    if (!couponCode.trim() || couponBusy) return;
    setCouponBusy(true);
    setCouponError("");
    const [result] = await Promise.all([validateCoupon(couponCode), wait(480)]);
    setCouponBusy(false);
    if (result.ok) {
      setCoupon({ code: result.code, percent: result.percent });
      setCouponFormOpen(false);
      setCouponCode("");
    } else {
      setCouponError(result.message);
      couponInput.current?.focus();
    }
  }

  async function pay(next: string) {
    setMethod(next);
    setPhase("processing");
    setPayError("");
    try {
      if (onPay) {
        await onPay({ plan, seats, billing, addons: addonsOn, coupon: coupon?.code, country: country.code, email: values.email.trim(), method: next, subtotal, discount, tax, total });
      } else {
        await wait(next === "card" ? 1500 : 1100);
        if (next === "card" && cardDigits === "4000000000000002") throw new Error("Your card was declined. Try another card.");
      }
      const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date());
      setReceipt({ number: `ARC-${Math.floor(1e5 + 899999 * Math.random())}`, date, last4: cardDigits.slice(-4), brand: brand || "Card" });
      setPhase("paid");
      requestAnimationFrame(() => summaryTitle.current?.focus({ preventScroll: true }));
    } catch (error) {
      setPhase("edit");
      setPayError(error instanceof Error ? error.message : "Payment failed. Try again.");
    }
  }

  /** One labelled field, its validity tick, and its error line. */
  function field(key: FieldKey, label: string, inputProps: React.InputHTMLAttributes<HTMLInputElement> = {}, adornment?: React.ReactNode) {
    const error = touched[key] ? errors[key] : undefined;
    const valid = touched[key] && !errors[key];
    return (
      <div className={styles.field} data-invalid={error ? "" : undefined}>
        <div className={styles.labelRow}>
          <label htmlFor={`${id}-${key}`}>{label}</label>
          {adornment}
        </div>
        <div className={styles.inputWrap}>
          <input
            ref={node => { fields.current[key] = node; }}
            id={`${id}-${key}`}
            className={styles.input}
            value={values[key]}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `${id}-${key}-error` : undefined}
            disabled={busy}
            onChange={event => update(key, event.target.value)}
            onBlur={() => { if (values[key]) setTouched(current => ({ ...current, [key]: true })); }}
            {...inputProps} />
          <AnimatePresence initial={false}>
            {valid && (
              <motion.span
                key="ok"
                className={styles.valid}
                initial={{ opacity: 0, scale: .6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: .6 }}
                transition={spring.snappy}
                aria-hidden="true">
                <Check size={14} strokeWidth={2} />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence initial={false}>
          {error && (
            <Collapse key={error}>
              <p id={`${id}-${key}-error`} className={styles.error}>{error}</p>
            </Collapse>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const summaryBody = (
    <>
      <ul className={styles.lines} aria-label="Order lines">
        <li className={styles.line}>
          <div className={styles.lineText}>
            <span>{selectedPlan.name} plan</span>
            <small>
              {seats} {seats === 1 ? "seat" : "seats"} × {money(selectedPlan.seat * (1 - (billing === "yearly" ? yearlyDiscount : 0))) } × {months} {months === 1 ? "month" : "months"}
            </small>
          </div>
          <Amount value={money(planAmount)} className={styles.amount} />
        </li>
        <AnimatePresence initial={false}>
          {addonLines.map(line => (
            <motion.li key={line.id} className={styles.lineOuter} {...collapse} transition={asideTransition}>
              <div className={styles.line}>
                <div className={styles.lineText}>
                  <span>{line.name}</span>
                  <small>{billing === "yearly" ? "Billed yearly" : "Billed monthly"}</small>
                </div>
                <Amount value={money(line.amount)} className={styles.amount} />
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <AnimatePresence initial={false}>
        {!paid && (
          <Collapse key="coupon" instant>
            <div className={styles.coupon}>
              <div className={styles.couponSlot}>
                <AnimatePresence initial={false} mode="popLayout">
                  {coupon ? (
                    <motion.div
                      key="chip"
                      className={styles.couponChip}
                      initial={{ opacity: 0, scale: .92, filter: "blur(4px)" }}
                      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, scale: .92, filter: "blur(4px)" }}
                      transition={spring.morph}>
                      <span className={styles.couponCode}>{coupon.code}</span>
                      <span className={styles.couponOff}>{coupon.percent}% off</span>
                      <button type="button" className={styles.chipRemove} aria-label={`Remove ${coupon.code}`} onClick={() => setCoupon(null)}>
                        <X size={13} />
                      </button>
                    </motion.div>
                  ) : couponFormOpen ? (
                    <motion.form
                      key="form"
                      className={styles.couponForm}
                      onSubmit={applyCoupon}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={spring.snappy}>
                      <input
                        ref={couponInput}
                        className={classes(styles.input, styles.couponInput)}
                        value={couponCode}
                        placeholder="Code"
                        aria-label="Coupon code"
                        aria-invalid={!!couponError || undefined}
                        aria-describedby={couponError ? `${id}-coupon-error` : undefined}
                        onChange={event => { setCouponCode(event.target.value.toUpperCase()); setCouponError(""); }}
                        onKeyDown={event => { if (event.key === "Escape") { setCouponFormOpen(false); setCouponError(""); } }} />
                      <button type="submit" className={styles.secondary} disabled={!couponCode.trim() || couponBusy}>
                        {couponBusy ? <LoaderCircle size={15} className={styles.spin} aria-label="Checking" /> : "Apply"}
                      </button>
                    </motion.form>
                  ) : (
                    <motion.button
                      key="add"
                      type="button"
                      className={styles.textButton}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: duration.fast, ease: standardEase }}
                      onClick={() => { setCouponFormOpen(true); requestAnimationFrame(() => couponInput.current?.focus()); }}>
                      <Plus size={14} /> Add coupon
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
              <AnimatePresence initial={false}>
                {couponError && (
                  <Collapse key={couponError}>
                    <p id={`${id}-coupon-error`} className={styles.error}>{couponError}</p>
                  </Collapse>
                )}
              </AnimatePresence>
            </div>
          </Collapse>
        )}
      </AnimatePresence>

      <dl className={styles.totals}>
        <div className={styles.totalRow}>
          <dt>Subtotal</dt>
          <dd><Amount value={money(subtotal)} /></dd>
        </div>
        <AnimatePresence initial={false}>
          {coupon && (
            <motion.div key="discount" className={styles.lineOuter} {...collapse} transition={asideTransition}>
              <div className={styles.totalRow}>
                <dt>Discount <span className={styles.muted}>{coupon.code}</span></dt>
                <dd className={styles.discount}>−<Amount value={money(discount)} /></dd>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className={styles.totalRow}>
          <dt>{country.rate ? country.taxLabel : "Tax"}</dt>
          <dd>{country.rate ? <Amount value={money(tax)} /> : <span className={styles.muted}>Not charged</span>}</dd>
        </div>
        <div className={classes(styles.totalRow, styles.grand)}>
          <dt>{paid ? "Paid today" : "Due today"}</dt>
          <dd><Amount value={money(total)} /></dd>
        </div>
      </dl>

      <AnimatePresence initial={false}>
        {paid && receipt && (
          <motion.div
            key="receipt"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0 } }}
            transition={reduced ? { duration: 0 } : { ...spring.smooth, opacity: { duration: duration.standard, ease: standardEase }, delay: .16 }}>
            <dl className={styles.meta}>
              <div><dt>Order</dt><dd>{receipt.number}</dd></div>
              <div><dt>Paid with</dt><dd>{method === "card" ? `${receipt.brand} ending ${receipt.last4}` : method}</dd></div>
              <div><dt>Date</dt><dd>{receipt.date}</dd></div>
              <div><dt>Receipt sent to</dt><dd>{values.email}</dd></div>
            </dl>
            <div className={styles.receiptActions}>
              <button type="button" className={classes(styles.secondary, styles.stack)} onClick={() => setSaved(true)} aria-live="polite">
                <span className={styles.sizer} aria-hidden="true"><Download size={15} /> Receipt PDF</span>
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    key={saved ? "done" : "idle"}
                    className={styles.buttonLabel}
                    initial={{ opacity: 0, y: 6, filter: "blur(3px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -6, filter: "blur(3px)" }}
                    transition={spring.snappy}>
                    {saved ? <><Check size={15} /> Saved</> : <><Download size={15} /> Receipt PDF</>}
                  </motion.span>
                </AnimatePresence>
              </button>
              <button
                type="button"
                className={styles.ghost}
                onClick={() => {
                  setPhase("edit");
                  setReceipt(null);
                  setSaved(false);
                  setTouched({});
                  setCoupon(null);
                  setPayError("");
                  setValues(current => ({ ...current, card: "", expiry: "", cvc: "" }));
                }}>
                <RotateCcw size={15} /> Start over
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className={classes(styles.frame, className)}>
        <div className={styles.shell} data-paid={paid || undefined}>
          <AnimatePresence initial={false} mode="popLayout">
            {!paid && (
              <motion.form
                key="form"
                className={styles.form}
                onSubmit={event => {
                  event.preventDefault();
                  if (busy) return;
                  setTouched(Object.fromEntries(fieldOrder.map(key => [key, true])));
                  const first = fieldOrder.find(key => errors[key]);
                  if (first) fields.current[first]?.focus();
                  else void pay("card");
                }}
                noValidate
                exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: -24, transition: { duration: duration.standard, ease: exitEase } }}
                aria-label="Checkout">
                <section className={styles.section} aria-labelledby={`${id}-express`}>
                  <h2 id={`${id}-express`} className={styles.srOnly}>Express checkout</h2>
                  <div className={styles.express}>
                    {expressMethods.map(name => (
                      <button
                        key={name}
                        type="button"
                        className={styles.expressButton}
                        data-brand={name === "Apple Pay" ? "apple" : name === "Google Pay" ? "google" : "paypal"}
                        aria-label={`Pay with ${name}`}
                        disabled={busy}
                        onClick={() => void pay(name)}>
                        {busy && method === name ? <LoaderCircle size={16} className={styles.spin} aria-label={`Paying with ${name}`} /> : <WalletMark name={name} />}
                      </button>
                    ))}
                  </div>
                  <p className={styles.or}><span>Or pay with card</span></p>
                </section>

                <section className={styles.section} aria-labelledby={`${id}-plan-title`}>
                  <div className={styles.sectionHead}>
                    <h2 id={`${id}-plan-title`}>Plan</h2>
                    <div className={styles.billing} role="radiogroup" aria-label="Billing period">
                      {(["monthly", "yearly"] as Billing[]).map(option => (
                        <button key={option} type="button" role="radio" aria-checked={billing === option} className={styles.billingOption} disabled={busy} onClick={() => setBilling(option)}>
                          {billing === option && <motion.span layoutId={`${id}-billing`} className={styles.billingPill} transition={spring.morph} />}
                          <span className={styles.billingLabel}>
                            {option === "monthly" ? "Monthly" : <>Yearly <span className={styles.save}>−{Math.round(100 * yearlyDiscount)}%</span></>}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={styles.plans} role="radiogroup" aria-label="Plan">
                    {plans.map((item, index) => {
                      const active = item.id === plan;
                      return (
                        <button
                          key={item.id}
                          id={`${id}-plan-${item.id}`}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          tabIndex={active ? 0 : -1}
                          className={styles.plan}
                          disabled={busy}
                          onClick={() => setPlan(item.id)}
                          onKeyDown={event => {
                            const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
                            if (!step) return;
                            event.preventDefault();
                            const next = plans[(index + step + plans.length) % plans.length];
                            setPlan(next.id);
                            document.getElementById(`${id}-plan-${next.id}`)?.focus();
                          }}>
                          {active && <motion.span layoutId={`${id}-plan`} className={styles.planRing} transition={spring.morph} />}
                          <span className={styles.planName}>{item.name}</span>
                          <span className={styles.planPrice}>
                            <Amount value={money(item.seat * (billing === "yearly" ? 1 - yearlyDiscount : 1))} />
                            <small>per seat / mo</small>
                          </span>
                          <span className={styles.planBlurb}>{item.blurb}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className={styles.seats}>
                    <label htmlFor={`${id}-seats`}>Seats</label>
                    <div className={styles.stepper}>
                      <button type="button" aria-label="Remove a seat" disabled={busy || seats <= 1} onClick={() => setSeats(current => Math.max(1, current - 1))}>
                        <Minus size={15} />
                      </button>
                      <input
                        id={`${id}-seats`}
                        inputMode="numeric"
                        value={seats}
                        disabled={busy}
                        onChange={event => setSeats(Math.min(500, Math.max(1, Number(event.target.value.replace(/\D/g, "")) || 1)))} />
                      <button type="button" aria-label="Add a seat" disabled={busy || seats >= 500} onClick={() => setSeats(current => Math.min(500, current + 1))}>
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>
                </section>

                <section className={styles.section} aria-labelledby={`${id}-addons`}>
                  <div className={styles.sectionHead}>
                    <h2 id={`${id}-addons`}>Add-ons</h2>
                  </div>
                  <ul className={styles.addons}>
                    {addons.map(item => {
                      const on = addonsOn.includes(item.id);
                      return (
                        <li key={item.id}>
                          <label className={styles.addon} data-on={on || undefined}>
                            <input
                              type="checkbox"
                              className={styles.srOnly}
                              checked={on}
                              disabled={busy}
                              onChange={() => setAddonsOn(current => (on ? current.filter(entry => entry !== item.id) : [...current, item.id]))} />
                            <span className={styles.check} aria-hidden="true">
                              <motion.svg viewBox="0 0 16 16" width="12" height="12">
                                <motion.path
                                  d="M3.5 8.5l3 3 6-7"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  initial={false}
                                  animate={{ pathLength: +!!on, opacity: +!!on }}
                                  transition={spring.snappy} />
                              </motion.svg>
                            </span>
                            <span className={styles.addonText}>
                              <span>{item.name}</span>
                              <small>{item.detail}</small>
                            </span>
                            <span className={styles.addonPrice}>{money(item.monthly)}<small>/ mo</small></span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                <section className={styles.section} aria-labelledby={`${id}-billing-details`}>
                  <div className={styles.sectionHead}>
                    <h2 id={`${id}-billing-details`}>Billing details</h2>
                  </div>
                  <div className={styles.grid}>
                    <div className={styles.span2}>{field("email", "Email", { type: "email", autoComplete: "email" })}</div>
                    <div className={styles.span2}>{field("name", "Name on card", { autoComplete: "cc-name" })}</div>
                    <div className={classes(styles.country, styles.span2)}>
                      <Select
                        id={`${id}-country`}
                        label="Country"
                        className={styles.countrySelect}
                        value={values.country}
                        disabled={busy}
                        options={countries.map(item => ({ value: item.code, label: item.name }))}
                        onValueChange={next => update("country", next)} />
                    </div>
                    <div className={styles.span2}>{field("address", "Address", { autoComplete: "street-address" })}</div>
                    <div>{field("city", "City", { autoComplete: "address-level2" })}</div>
                    <div>{field("postal", "Postal code", { autoComplete: "postal-code" })}</div>
                  </div>
                </section>

                <section className={styles.section} aria-labelledby={`${id}-card-title`}>
                  <div className={styles.sectionHead}>
                    <h2 id={`${id}-card-title`}>Card</h2>
                    <button
                      type="button"
                      className={styles.textButton}
                      disabled={busy}
                      onClick={() => {
                        setValues(current => ({ ...current, card: "4242 4242 4242 4242", expiry: "08/29", cvc: "314" }));
                        setTouched(current => ({ ...current, card: true, expiry: true, cvc: true }));
                        setPayError("");
                      }}>
                      Use test card
                    </button>
                  </div>
                  <div className={styles.grid3}>
                    <div className={styles.span3}>
                      {field(
                        "card",
                        "Card number",
                        {
                          inputMode: "numeric",
                          autoComplete: "cc-number",
                          placeholder: "1234 1234 1234 1234",
                          onChange: event => {
                            const digits = event.target.value.replace(/\D/g, "").slice(0, 16);
                            update("card", /^3[47]/.test(digits)
                              ? [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean).join(" ")
                              : digits.replace(/(\d{4})(?=\d)/g, "$1 "));
                          },
                        },
                        <AnimatePresence initial={false} mode="popLayout">
                          {brand && (
                            <motion.span
                              key={brand}
                              className={styles.brand}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={spring.snappy}>
                              {brand}
                            </motion.span>
                          )}
                        </AnimatePresence>,
                      )}
                    </div>
                    <div>
                      {field("expiry", "Expiry", {
                        inputMode: "numeric",
                        autoComplete: "cc-exp",
                        placeholder: "MM/YY",
                        onChange: event => {
                          const previous = values.expiry;
                          const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
                          update("expiry", event.target.value.length < previous.length && previous.endsWith("/")
                            ? digits.slice(0, 1)
                            : digits.length === 1 && Number(digits) > 1
                              ? `0${digits}/`
                              : digits.length >= 2
                                ? `${digits.slice(0, 2)}/${digits.slice(2)}`
                                : digits);
                        },
                      })}
                    </div>
                    <div>
                      {field("cvc", "CVC", {
                        inputMode: "numeric",
                        autoComplete: "cc-csc",
                        placeholder: brand === "Amex" ? "1234" : "123",
                        onChange: event => update("cvc", event.target.value.replace(/\D/g, "").slice(0, 4)),
                      })}
                    </div>
                  </div>
                </section>

                <div className={styles.payArea}>
                  <AnimatePresence initial={false}>
                    {payError && (
                      <Collapse key={payError}>
                        <p className={styles.payError} role="alert">{payError}</p>
                      </Collapse>
                    )}
                  </AnimatePresence>
                  <button type="submit" className={styles.pay} disabled={busy} aria-live="polite">
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.span
                        key={busy && method === "card" ? "busy" : "idle"}
                        className={styles.buttonLabel}
                        initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                        transition={spring.snappy}>
                        {busy && method === "card" ? <><LoaderCircle size={16} className={styles.spin} /> Processing</> : <>Pay <Amount value={money(total)} /></>}
                      </motion.span>
                    </AnimatePresence>
                  </button>
                  <p className={styles.secure}>
                    <Lock size={13} aria-hidden="true" /> Simulated payment. No card is charged.
                  </p>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <motion.aside
            layout="position"
            className={styles.summary}
            data-paid={paid || undefined}
            data-frame-keep=""
            transition={asideTransition}
            aria-labelledby={`${id}-summary-title`}>
            <div className={styles.summaryHead}>
              <AnimatePresence initial={false} mode="popLayout">
                {paid ? (
                  <motion.div
                    key="paid"
                    className={styles.paidHead}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={reduced ? { duration: 0 } : { ...spring.smooth, opacity: { duration: duration.standard, ease: standardEase }, delay: .06 }}>
                    <span className={styles.paidMark} aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="22" height="22">
                        <motion.path
                          d="M5 12.5l4.5 4.5L19 7.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={reduced ? { duration: 0 } : { duration: duration.considered, delay: .3, ease: enterEase }} />
                      </svg>
                    </span>
                    <h2 id={`${id}-summary-title`} ref={summaryTitle} tabIndex={-1} className={styles.summaryTitle}>Payment successful</h2>
                    <p className={styles.summaryNote}>{selectedPlan.name} is active for {seats} {seats === 1 ? "seat" : "seats"}.</p>
                  </motion.div>
                ) : (
                  <motion.div key="edit" className={styles.summaryHead} exit={{ opacity: 0, transition: { duration: reduced ? 0 : duration.fast } }}>
                    <h2 id={`${id}-summary-title`} className={classes(styles.summaryTitle, styles.wideOnly)}>Order summary</h2>
                    <button
                      type="button"
                      className={classes(styles.summaryToggle, styles.narrowOnly)}
                      aria-expanded={summaryOpen}
                      aria-controls={`${id}-summary-body`}
                      onClick={() => setSummaryOpen(current => !current)}>
                      <span className={styles.summaryTitleSmall}>
                        {summaryOpen ? "Hide order summary" : "Show order summary"}
                        <motion.span initial={false} animate={{ rotate: 180 * +!!summaryOpen }} transition={spring.snappy} className={styles.chevron}>
                          <ChevronDown size={15} />
                        </motion.span>
                      </span>
                      <Amount value={money(total)} className={styles.toggleTotal} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div id={`${id}-summary-body`} className={styles.summaryBodyWrap} data-open={summaryOpen || undefined}>
              <div className={styles.summaryBodyClip}>
                <div className={styles.summaryBody}>{summaryBody}</div>
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
    </MotionConfig>
  );
}

/** Luhn check: catches a transposed or mistyped digit before the simulated gateway does. */
function luhn(digits: string) {
  let total = 0;
  for (let index = 0; index < digits.length; index++) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    total += digit;
  }
  return total % 10 === 0;
}

export default CheckoutLive;
