"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { animate, AnimatePresence, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Bell,
  Check,
  ChevronRight,
  Cloud,
  CreditCard,
  Eye,
  EyeOff,
  Landmark,
  PanelsTopLeft,
  Plus,
  ReceiptText,
  Search,
  Send,
  Type,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "../button/button";
import DropdownMenu from "../dropdown-menu/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../popover/popover";
import SegmentedControl from "../segmented-control/segmented-control";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./wallet-card.module.css";

export interface WalletCardProps {
  /** Balance the main wallet opens with, in cents. The reserve wallet is seeded at $2,850. Defaults to `1_248_032`. */
  initialBalanceCents?: number;
  /** Extra class names on the card root, so a host page can size it or drop its surface. */
  className?: string;
}

/** Which wallet the card is showing. The two wallets hold separate balances and separate activity. */
type WalletKey = "main" | "reserve";
/** Chart resolution behind the balance. Each period rescales the same demo history. */
type Period = "week" | "month" | "year";
/** What the detail panel is doing: browsing activity, or filling in one of the four actions. */
type ActionKey = "deposit" | "send" | "swap" | "buy";
type EntryKind = "payment" | "tools" | "license" | "hosting" | "investment" | "transfer" | "deposit" | "send";

interface Entry {
  id: string;
  wallet: WalletKey;
  title: string;
  detail: string;
  cents: number;
  kind: EntryKind;
}

const WALLET_LABEL: Record<WalletKey, string> = { main: "Main wallet", reserve: "Reserve wallet" };
const SEEDED_ENTRIES: Entry[] = [
  { id: "client", wallet: "main", title: "Client payment", detail: "18 Sep · Studio North", cents: 85_000, kind: "payment" },
  { id: "tools", wallet: "main", title: "Workspace tools", detail: "16 Sep · Subscription", cents: -4_800, kind: "tools" },
  { id: "type", wallet: "main", title: "Type license", detail: "14 Sep · Purchase", cents: -1_200, kind: "license" },
  { id: "hosting", wallet: "main", title: "Website hosting", detail: "10 Sep · Cloud plan", cents: -2_400, kind: "hosting" },
  { id: "invoice", wallet: "main", title: "Design retainer", detail: "8 Sep · Forma Studio", cents: 125_000, kind: "payment" },
  { id: "reserve", wallet: "reserve", title: "Monthly allocation", detail: "12 Sep · From main wallet", cents: 50_000, kind: "transfer" },
];
const ENTRY_ICON: Record<EntryKind, typeof ReceiptText> = {
  payment: ReceiptText,
  tools: PanelsTopLeft,
  license: Type,
  hosting: Cloud,
  investment: Landmark,
  transfer: ArrowLeftRight,
  deposit: Plus,
  send: Send,
};
/** Order of the action strip, left to right. */
const ACTION_ORDER: ActionKey[] = ["send", "deposit", "swap", "buy"];
const ACTION_LABEL: Record<ActionKey, string> = { deposit: "Deposit", send: "Send", swap: "Swap", buy: "Buy" };
const ACTION_ICON: Record<ActionKey, typeof ReceiptText> = { send: ArrowUpRight, deposit: Plus, swap: ArrowLeftRight, buy: CreditCard };
const ACTION_BLURB: Record<ActionKey, string> = {
  send: "Send a payment.",
  deposit: "Add funds to this wallet.",
  swap: "Move funds to the other wallet.",
  buy: "Buy shares in an index fund.",
};
/** Cubic-bezier tuples have to be typed as such for `motion`; spreading the shared token keeps them in one place. */
const standardEase = [...motionTokens.ease.standard] as [number, number, number, number];
/** Row height of one activity entry; the list animates to it so a filtered list never jumps. */
const ENTRY_HEIGHT = 60;
const PERIOD_POINTS: Record<Period, number[]> = {
  week: [0.87, 0.89, 0.88, 0.94, 0.92, 0.96, 1],
  month: [0.84, 0.85, 0.83, 0.88, 0.87, 0.9, 0.88, 0.94, 0.92, 0.96, 0.95, 1],
  year: [0.58, 0.64, 0.61, 0.7, 0.68, 0.76, 0.74, 0.83, 0.8, 0.9, 0.93, 1],
};
const PERIOD_LABEL: Record<Period, string> = { week: "Last 7 days", month: "Last 30 days", year: "Last 12 months" };
/** Scrub labels read in the unit the chart is drawn in. */
const PERIOD_UNIT: Record<Period, string> = { week: "Day", month: "September", year: "Month" };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
/** Cents to a display string. Every amount in the card is stored in cents, so rounding never drifts. */
const formatCents = (cents: number) => money.format(cents / 100);

/** Parses a typed amount into a whole number of cents, refusing anything the wallet cannot hold. */
function parseCents(raw: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw.trim())) return null;
  const cents = Math.round(100 * Number(raw));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 100_000_000 ? cents : null;
}

/** The headline balance counts up to a new value instead of swapping text, so a deposit reads as money arriving. */
function AnimatedCents({ cents }: { cents: number }) {
  const reduced = useReducedMotion();
  const value = useMotionValue(cents);
  const [shown, setShown] = useState(cents);
  useMotionValueEvent(value, "change", (latest) => setShown(Math.round(latest)));
  useEffect(() => {
    if (reduced) {
      value.set(cents);
      return;
    }
    const controls = animate(value, cents, { duration: 0.75, ease: standardEase });
    return () => controls.stop();
  }, [cents, reduced, value]);
  return <>{formatCents(reduced ? cents : shown)}</>;
}

export function WalletCard({ initialBalanceCents = 1_248_032, className }: WalletCardProps) {
  const reduced = useReducedMotion();
  const [wallet, setWallet] = useState<WalletKey>("main");
  const [balances, setBalances] = useState<Record<WalletKey, number>>({ main: initialBalanceCents, reserve: 285_000 });
  const [entries, setEntries] = useState<Entry[]>(SEEDED_ENTRIES);
  const [period, setPeriod] = useState<Period>("month");
  const [scrub, setScrub] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [query, setQuery] = useState("");
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [action, setAction] = useState<ActionKey | null>(null);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const [detailHeight, setDetailHeight] = useState<number | null>(null);

  // The detail panel holds either the activity list or one action form; animating to the measured height keeps the card from resizing on its own.
  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setDetailHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const panelMotion = reduced ? { duration: 0 } : { duration: motionTokens.duration.exit, ease: standardEase };
  const actionRefs = useRef<Partial<Record<ActionKey, HTMLButtonElement | null>>>({});
  const detailId = useId();
  const errorId = useId();
  const walletName = WALLET_LABEL[wallet];
  const otherWallet = wallet === "main" ? "reserve" : "main";
  const otherName = WALLET_LABEL[otherWallet];

  const visibleEntries = entries
    .filter((entry) => entry.wallet === wallet && `${entry.title} ${entry.detail}`.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, showAll ? undefined : 3);
  const chartValues = PERIOD_POINTS[period].map((ratio) => Math.round(balances[wallet] * ratio));
  const chartY = (cents: number) => 104 - ((cents - Math.min(...chartValues)) / Math.max(1, Math.max(...chartValues) - Math.min(...chartValues))) * 88;
  const points = chartValues.map((cents, index) => `${(index / (chartValues.length - 1)) * 560},${chartY(cents)}`).join(" ");
  const change = entries.filter((entry) => entry.wallet === wallet).reduce((sum, entry) => sum + entry.cents, 0);

  /** Appends a row, moves the money, and hands focus back to the action that opened the form. */
  function recordEntry(entry: Entry, delta: Partial<Record<WalletKey, number>>) {
    setEntries((previous) => [entry, ...previous]);
    setBalances((previous) => ({ main: previous.main + (delta.main ?? 0), reserve: previous.reserve + (delta.reserve ?? 0) }));
    if (action) actionRefs.current[action]?.focus();
    setAction(null);
    setAmount("");
    setRecipient("");
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action) return;
    const cents = parseCents(amount);
    if (cents === null) {
      setError("Enter an amount between $0.01 and $1,000,000.00.");
      return;
    }
    if (action !== "deposit" && cents > balances[wallet]) {
      setError("The amount is above the available balance.");
      return;
    }
    if (action === "send" && !recipient.trim()) {
      setError("Enter a recipient name.");
      return;
    }
    const id = `demo-${Date.now()}`;
    if (action === "swap") {
      recordEntry({ id, wallet, title: `Moved to ${otherName}`, detail: "Just now · Transfer", cents: -cents, kind: "transfer" }, { [wallet]: -cents, [otherWallet]: cents });
      setEntries((previous) => [{ id: `${id}-in`, wallet: otherWallet, title: `From ${walletName}`, detail: "Just now · Transfer", cents, kind: "transfer" }, ...previous]);
      setStatus(`${formatCents(cents)} moved to ${otherName}.`);
      return;
    }
    const signed = action === "deposit" ? cents : -cents;
    const title = action === "deposit" ? "Deposit" : action === "send" ? `To ${recipient.trim()}` : "Index fund purchase";
    recordEntry({ id, wallet, title, detail: "Just now · Activity", cents: signed, kind: action === "deposit" ? "deposit" : action === "send" ? "send" : "investment" }, { [wallet]: signed });
    setStatus(`${formatCents(cents)} ${action === "deposit" ? "added" : action === "send" ? "sent" : "used to buy shares"}.`);
  }

  function addSampleDeposit() {
    recordEntry({ id: `sample-${Date.now()}`, wallet, title: "Added funds", detail: "Just now · Activity", cents: 12_450, kind: "deposit" }, { [wallet]: 12_450 });
    setStatus(`${formatCents(12_450)} added to ${walletName}.`);
  }

  return (
    <section className={className ? `${styles.wallet} ${className}` : styles.wallet} aria-label="Wallet preview">
      <div className={styles.topRow}>
        <DropdownMenu
          label={walletName}
          icon={<Wallet size={16} strokeWidth={1.75} />}
          items={(["main", "reserve"] as const).map((key) => ({
            label: `${WALLET_LABEL[key]} · ${hidden ? "••••" : formatCents(balances[key])}`,
            icon: wallet === key ? <Check size={16} strokeWidth={1.75} /> : <Wallet size={16} strokeWidth={1.75} />,
            onSelect: () => {
              setWallet(key);
              setAction(null);
              setStatus("");
              setScrub(null);
            },
          }))}
        />
        <div className={styles.topActions}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={searchOpen ? "Close activity search" : "Search activity"}
            aria-expanded={searchOpen}
            onClick={() => {
              setSearchOpen(!searchOpen);
              setAction(null);
              setQuery("");
              setNoticeOpen(false);
            }}
          >
            {searchOpen ? <X size={20} strokeWidth={1.75} /> : <Search size={20} strokeWidth={1.75} />}
          </button>
          <Popover open={noticeOpen} onOpenChange={setNoticeOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={styles.iconButton} aria-label="Notifications">
                <Bell size={20} strokeWidth={1.75} />
                <span className={styles.noticeDot} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className={styles.notice}>
              <strong>Wallet updates</strong>
              <span>{status || "Your $850.00 payment from Studio North arrived on 18 September."}</span>
              <small>Demo notification · No live account connected</small>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className={styles.balanceArea}>
        <div className={styles.balanceLabel}>
          {scrub === null ? "Available balance" : `${PERIOD_UNIT[period]} ${scrub + 1}`}{" "}
          <button type="button" aria-label={hidden ? "Show balance" : "Hide balance"} onClick={() => setHidden(!hidden)}>
            {hidden ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
          </button>
        </div>
        <div className={styles.balance} aria-live="polite">
          {hidden ? (
            <span className={styles.hiddenBalance} aria-label="Balance hidden">
              <span aria-hidden="true">$ ••••••</span>
            </span>
          ) : (
            <AnimatedCents cents={scrub === null ? balances[wallet] : chartValues[scrub]} />
          )}
        </div>
        <div className={styles.balanceMeta}>
          <span className={styles.changePill} data-negative={change < 0}>
            {change >= 0 ? <ArrowUpRight size={16} strokeWidth={1.75} /> : <ArrowDownLeft size={16} strokeWidth={1.75} />}
            {hidden ? (
              "••••"
            ) : (
              <>
                {change >= 0 ? "+" : "−"}
                <AnimatedCents cents={Math.abs(change)} />
              </>
            )}
            <span> this month</span>
          </span>
          <span className={styles.currency}>USD</span>
        </div>

        <div className={styles.chart} onPointerLeave={() => setScrub(null)}>
          <svg viewBox="0 0 560 120" preserveAspectRatio="none" aria-hidden="true">
            <path className={styles.chartGuide} d="M0 30H560 M0 70H560 M0 110H560" />
            <motion.polyline
              points={points}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={false}
              animate={{ points }}
              transition={reduced ? { duration: 0 } : motionTokens.spring.gentle}
            />
            {scrub !== null && (
              <line x1={(scrub / (chartValues.length - 1)) * 560} x2={(scrub / (chartValues.length - 1)) * 560} y1="0" y2="120" stroke="var(--border-strong)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          {scrub !== null && (
            <span className={styles.chartDot} style={{ left: `${(scrub / (chartValues.length - 1)) * 100}%`, top: `${(chartY(chartValues[scrub]) / 120) * 100}%` }} aria-hidden="true" />
          )}
          <input
            className={styles.chartScrubber}
            type="range"
            min="0"
            max={chartValues.length - 1}
            value={scrub ?? chartValues.length - 1}
            aria-label="Explore sample balance history"
            aria-valuetext={hidden ? "Balance hidden" : formatCents(chartValues[scrub ?? chartValues.length - 1])}
            onChange={(event) => setScrub(Number(event.target.value))}
            onBlur={() => setScrub(null)}
            onPointerMove={(event) => {
              // A real pointer scrubs continuously; touch and pen only move the native range thumb.
              if (event.pointerType !== "mouse") return;
              const box = event.currentTarget.getBoundingClientRect();
              setScrub(Math.max(0, Math.min(chartValues.length - 1, Math.round(((event.clientX - box.left) / box.width) * (chartValues.length - 1)))));
            }}
          />
        </div>
        <div className={styles.chartFoot}>
          <span>{PERIOD_LABEL[period]}</span>
          <SegmentedControl
            label="Balance history period"
            value={period}
            onValueChange={(value) => {
              setPeriod(value as Period);
              setScrub(null);
            }}
            options={[
              { value: "week", label: "1W" },
              { value: "month", label: "1M" },
              { value: "year", label: "1Y" },
            ]}
          />
        </div>
      </div>

      <div className={styles.actions}>
        {ACTION_ORDER.map((key) => {
          const Icon = ACTION_ICON[key];
          return (
            <button
              key={key}
              type="button"
              ref={(node) => {
                actionRefs.current[key] = node;
              }}
              aria-pressed={action === key}
              aria-controls={detailId}
              className={styles.actionButton}
              onClick={() => {
                if (action === key) {
                  setAction(null);
                  return;
                }
                setAction(key);
                setAmount("");
                setRecipient("");
                setError("");
                setStatus("");
                setNoticeOpen(false);
              }}
            >
              <Icon size={20} strokeWidth={1.75} />
              <span>{ACTION_LABEL[key]}</span>
              <ChevronRight className={styles.actionArrow} size={16} strokeWidth={1.75} />
            </button>
          );
        })}
      </div>

      <motion.div
        className={styles.detail}
        id={detailId}
        initial={false}
        animate={{ height: detailHeight ?? "auto" }}
        transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}
      >
        <div ref={contentRef} className={styles.detailContent}>
          <AnimatePresence mode="wait" initial={false}>
            {action ? (
              <motion.div
                key={action}
                className={styles.actionPanel}
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={panelMotion}
              >
                <div className={styles.detailHeading}>
                  <div>
                    <h2>{ACTION_LABEL[action]}</h2>
                    <p>{action === "swap" ? `Move funds to ${otherName}.` : ACTION_BLURB[action]}</p>
                  </div>
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label="Close action"
                    onClick={() => {
                      actionRefs.current[action]?.focus();
                      setAction(null);
                      setError("");
                    }}
                  >
                    <X size={20} strokeWidth={1.75} />
                  </button>
                </div>
                <form className={styles.form} onSubmit={submit} noValidate>
                  {action === "send" && (
                    <label>
                      Recipient
                      <input
                        value={recipient}
                        onChange={(event) => {
                          setRecipient(event.target.value);
                          setError("");
                        }}
                        placeholder="e.g. Studio North"
                        maxLength={48}
                      />
                    </label>
                  )}
                  <label>
                    Amount in USD
                    <input
                      autoFocus
                      value={amount}
                      onChange={(event) => {
                        setAmount(event.target.value);
                        setError("");
                      }}
                      inputMode="decimal"
                      placeholder="0.00"
                      aria-invalid={!!error}
                      aria-describedby={error ? errorId : undefined}
                    />
                  </label>
                  {error && (
                    <p id={errorId} className={styles.error} role="alert">
                      {error}
                    </p>
                  )}
                  <Button type="submit">
                    {action === "swap" ? "Move funds" : action === "send" ? "Record payment" : action === "buy" ? "Buy shares" : "Add funds"}{" "}
                    <ArrowUpRight size={16} strokeWidth={1.75} />
                  </Button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="activity"
                className={styles.activityPanel}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -5 }}
                transition={panelMotion}
              >
                <div className={styles.detailHeading}>
                  <h2>{showAll ? "All activity" : "Recent activity"}</h2>
                  <button type="button" className={styles.textButton} onClick={() => setShowAll(!showAll)}>
                    {showAll ? "Show less" : "View all"}
                    <ChevronRight size={16} strokeWidth={1.75} />
                  </button>
                </div>
                <AnimatePresence initial={false}>
                  {searchOpen && (
                    <motion.div
                      key="search"
                      className={styles.searchReveal}
                      initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}
                    >
                      <label className={styles.searchField}>
                        <Search size={16} strokeWidth={1.75} />
                        <input value={query} onChange={(event) => setQuery(event.target.value)} autoFocus placeholder="Search activity" aria-label="Search activity" />
                      </label>
                    </motion.div>
                  )}
                </AnimatePresence>
                <ul className={styles.entries}>
                  <AnimatePresence initial={false}>
                    {visibleEntries.map((entry) => {
                      const Icon = ENTRY_ICON[entry.kind];
                      return (
                        <motion.li
                          key={entry.id}
                          layout={reduced ? false : "position"}
                          initial={reduced ? false : { opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: ENTRY_HEIGHT }}
                          exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                          transition={reduced ? { duration: 0 } : motionTokens.spring.gentle}
                        >
                          <span className={styles.entryIcon} data-flow={entry.kind === "transfer" ? "transfer" : entry.cents >= 0 ? "incoming" : "outgoing"} aria-hidden="true">
                            <Icon size={20} strokeWidth={1.75} />
                          </span>
                          <span className={styles.entryText}>
                            <strong>{entry.title}</strong>
                            <small>{entry.detail}</small>
                          </span>
                          <span className={styles.entryAmount}>
                            {entry.cents >= 0 ? "+" : "−"}
                            {formatCents(Math.abs(entry.cents))}
                          </span>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
                {visibleEntries.length === 0 && <p className={styles.empty}>No activity matches your search.</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <div className={styles.foot}>
        <span role="status" aria-live="polite">
          {status ? (
            <>
              <Check size={16} strokeWidth={1.75} /> {status}
            </>
          ) : (
            ""
          )}
        </span>
        <button type="button" onClick={addSampleDeposit}>
          <Plus size={16} strokeWidth={1.75} /> Add $124.50
        </button>
      </div>
    </section>
  );
}

export default WalletCard;
