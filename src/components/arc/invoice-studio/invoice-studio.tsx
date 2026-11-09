"use client";

import { useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Plus, Trash2 } from "lucide-react";
import { Button } from "../button/button";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./invoice-studio.module.css";

/** A line item as handed to {@link InvoiceStudioProps.onSave}. */
export interface InvoiceLine {
  /** Line description. */
  description: string;
  /** Quantity, clamped to zero or more. */
  quantity: number;
  /** Unit rate in USD. */
  rate: number;
}

export interface InvoiceStudioProps {
  /** Called with parsed lines when every line has a description. Awaited; a thrown error shows a save error. */
  onSave?: (lines: InvoiceLine[]) => void | Promise<void>;
}

/** Editable draft line: numbers stay strings while the user types, so a cleared field does not snap to zero. */
interface DraftLine {
  id: string;
  description: string;
  quantity: string;
  rate: string;
}

type Phase = "idle" | "saving" | "saved" | "error" | "invalid";

const startingLines: DraftLine[] = [
  {
    id: "discovery",
    description: "Discovery and direction",
    quantity: "1",
    rate: "900.00",
  },
  {
    id: "interface",
    description: "Interface design",
    quantity: "2",
    rate: "650.00",
  },
  {
    id: "handoff",
    description: "Design handoff",
    quantity: "1",
    rate: "250.00",
  },
];

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** Per-line amount; a half-typed value counts as zero so the totals never flicker to NaN. */
function lineAmount(line: DraftLine): number {
  const quantity = Number(line.quantity);
  const rate = Number(line.rate);
  return Number.isFinite(quantity) && Number.isFinite(rate)
    ? Math.max(0, quantity) * Math.max(0, rate)
    : 0;
}

const enterEase: [number, number, number, number] = [
  ...motionTokens.ease.enter,
];

/** A money value that rolls up on change: a short slide with a blur, keyed on the exact amount. */
function RollingMoney({
  amount,
  reduce,
  emphasis = false,
}: {
  amount: number;
  reduce: boolean;
  emphasis?: boolean;
}) {
  return (
    <AnimatePresence initial={false}>
      <motion.span
        key={amount.toFixed(2)}
        initial={
          reduce
            ? false
            : {
                opacity: 0,
                y: emphasis ? 7 : 5,
                filter: `blur(${emphasis ? 5 : 3}px)`,
              }
        }
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={
          reduce
            ? { opacity: 0 }
            : {
                opacity: 0,
                y: emphasis ? -7 : -5,
                filter: `blur(${emphasis ? 4 : 3}px)`,
              }
        }
        transition={{
          duration: reduce
            ? 0
            : emphasis
              ? motionTokens.duration.standard
              : motionTokens.duration.fast,
          ease: enterEase,
        }}
      >
        {money.format(amount)}
      </motion.span>
    </AnimatePresence>
  );
}

/**
 * An editable invoice with line items, live subtotal and total, and a save draft action.
 * Client details and starting lines are sample data.
 */
export function InvoiceStudio({ onSave }: InvoiceStudioProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId();
  const [lines, setLines] = useState<DraftLine[]>(startingLines);
  const [phase, setPhase] = useState<Phase>("idle");
  const sequence = useRef(0);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const subtotal = lines.reduce((sum, line) => sum + lineAmount(line), 0);
  const tax = Math.round(0.08 * subtotal * 100) / 100;
  const total = subtotal + tax;

  function update(
    id: string,
    field: "description" | "quantity" | "rate",
    value: string,
  ) {
    setLines((current) =>
      current.map((line) =>
        line.id === id ? { ...line, [field]: value } : line,
      ),
    );
    setPhase("idle");
  }

  /** On blur a quantity snaps to a whole 1–999 and a rate to two decimals, so the field always reads back cleanly. */
  function commit(id: string, field: "quantity" | "rate") {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) return line;
        const value = Number(line[field]);
        if (field === "quantity") {
          return {
            ...line,
            quantity: String(
              Math.min(999, Math.max(1, Math.floor(value) || 1)),
            ),
          };
        }
        return {
          ...line,
          rate: (Number.isFinite(value)
            ? Math.min(1_000_000, Math.max(0, value))
            : 0
          ).toFixed(2),
        };
      }),
    );
  }

  async function save() {
    const blank = lines.find((line) => !line.description.trim());
    if (blank) {
      setPhase("invalid");
      inputRefs.current.get(blank.id)?.focus();
      return;
    }
    setPhase("saving");
    if (!onSave) {
      await new Promise((resolve) =>
        window.setTimeout(resolve, reduce ? 150 : 700),
      );
      setPhase("saved");
      return;
    }
    try {
      await onSave?.(
        lines.map((line) => ({
          description: line.description.trim(),
          quantity: Math.min(
            999,
            Math.max(1, Math.floor(Number(line.quantity)) || 1),
          ),
          rate: Math.min(1_000_000, Math.max(0, Number(line.rate) || 0)),
        })),
      );
      setPhase("saved");
    } catch {
      setPhase("error");
    }
  }

  function remove(id: string) {
    if (lines.length <= 1) return;
    setLines((current) => current.filter((line) => line.id !== id));
    setPhase("idle");
    addButtonRef.current?.focus();
  }

  function add() {
    const id = `new-${++sequence.current}`;
    setLines((current) => [
      ...current,
      { id, description: "", quantity: "1", rate: "0.00" },
    ]);
    setPhase("idle");
    requestAnimationFrame(() => inputRefs.current.get(id)?.focus());
  }

  const status =
    phase === "saving"
      ? "Saving draft…"
      : phase === "saved"
        ? "Draft saved."
        : phase === "error"
          ? "Could not save the draft. Try again."
          : phase === "invalid"
            ? "Describe each line before saving."
            : "\u00a0";

  return (
    <section className={styles.invoice} aria-labelledby={`${uid}-title`}>
      <header className={styles.documentHeader}>
        <div className={styles.identity}>
          <span className={styles.wordmark}>Northstar Studio</span>
          <span>Invoice 2026-041</span>
        </div>
        <div className={styles.documentMeta}>
          <span>Issued 19 Sep 2026</span>
          <span>Due 19 Oct 2026</span>
        </div>
      </header>

      <div className={styles.heading}>
        <h2 id={`${uid}-title`}>Invoice</h2>
        <div className={styles.parties}>
          <div>
            <span>From</span>
            <strong>Northstar Studio</strong>
            <p>
              44 Hudson Street
              <br />
              New York, NY 10013
            </p>
          </div>
          <div>
            <span>Bill to</span>
            <strong>Acme Product</strong>
            <p>
              125 Spring Street
              <br />
              New York, NY 10012
            </p>
          </div>
        </div>
      </div>

      <div className={styles.linesHeader} aria-hidden="true">
        <span>Work</span>
        <span>Qty</span>
        <span>Rate</span>
        <span>Amount</span>
        <span />
      </div>

      <div aria-label="Invoice line items">
        <AnimatePresence initial={false}>
          {lines.map((line, index) => (
            <motion.div
              key={line.id}
              className={styles.lineSlot}
              initial={reduce ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={
                reduce
                  ? { opacity: 0, transition: { duration: 0 } }
                  : {
                      height: 0,
                      opacity: 0,
                      transition: {
                        height: motionTokens.spring.smooth,
                        opacity: { duration: motionTokens.duration.fast },
                      },
                    }
              }
              transition={
                reduce
                  ? { duration: 0 }
                  : {
                      height: motionTokens.spring.smooth,
                      opacity: {
                        duration: motionTokens.duration.standard,
                        ease: enterEase,
                      },
                    }
              }
            >
              <div className={styles.line}>
                <label className={styles.descriptionCell}>
                  <span className={styles.mobileLabel}>Work</span>
                  <input
                    ref={(node) => {
                      if (node) inputRefs.current.set(line.id, node);
                      else inputRefs.current.delete(line.id);
                    }}
                    value={line.description}
                    onChange={(event) =>
                      update(line.id, "description", event.target.value)
                    }
                    aria-label={`Line ${index + 1} description`}
                    placeholder="Describe the work"
                  />
                </label>
                <label className={styles.numberCell}>
                  <span className={styles.mobileLabel}>Qty</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="999"
                    step="1"
                    value={line.quantity}
                    onChange={(event) =>
                      update(line.id, "quantity", event.target.value)
                    }
                    onBlur={() => commit(line.id, "quantity")}
                    aria-label={`Line ${index + 1} quantity`}
                  />
                </label>
                <label className={styles.numberCell}>
                  <span className={styles.mobileLabel}>Rate</span>
                  <span className={styles.currencyPrefix}>$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="1000000"
                    step="0.01"
                    value={line.rate}
                    onChange={(event) =>
                      update(line.id, "rate", event.target.value)
                    }
                    onBlur={() => commit(line.id, "rate")}
                    aria-label={`Line ${index + 1} rate in dollars`}
                  />
                </label>
                <output
                  className={styles.amountCell}
                  aria-label={`Line ${index + 1} amount`}
                >
                  <RollingMoney amount={lineAmount(line)} reduce={reduce} />
                </output>
                <button
                  className={styles.removeButton}
                  type="button"
                  aria-label={`Remove line ${index + 1}`}
                  disabled={lines.length === 1}
                  onClick={() => remove(line.id)}
                >
                  <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className={styles.addRow}>
        <button type="button" ref={addButtonRef} onClick={add}>
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" /> Add line item
        </button>
      </div>

      <div className={styles.bottom}>
        <p className={styles.note}>
          Thank you for the work together. Payment is due within 30 days.
        </p>
        <div className={styles.totals}>
          <div>
            <span>Subtotal</span>
            <span className={styles.moneySlot}>
              <RollingMoney amount={subtotal} reduce={reduce} />
            </span>
          </div>
          <div>
            <span>Tax · 8%</span>
            <span className={styles.moneySlot}>
              <RollingMoney amount={tax} reduce={reduce} />
            </span>
          </div>
          <div className={styles.totalLine}>
            <strong>Total due</strong>
            <output aria-live="polite" aria-atomic="true">
              <RollingMoney amount={total} reduce={reduce} emphasis />
            </output>
          </div>
        </div>
      </div>

      <footer className={styles.footer}>
        <p className={styles.srOnly} role="status" aria-live="polite">
          {status}
        </p>
        <Button
          type="button"
          variant={phase === "saved" ? "secondary" : undefined}
          className={styles.saveButton}
          loading={phase === "saving"}
          onClick={() => void save()}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={phase === "saved" ? "saved" : "save"}
              className={styles.saveLabel}
              initial={
                reduce ? false : { opacity: 0, y: 6, filter: "blur(2px)" }
              }
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, y: -6, filter: "blur(2px)" }
              }
              transition={{
                duration: reduce ? 0 : motionTokens.duration.fast,
                ease: enterEase,
              }}
            >
              {phase === "saved" ? (
                <>
                  <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                  Saved
                </>
              ) : (
                "Save draft"
              )}
            </motion.span>
          </AnimatePresence>
        </Button>
      </footer>
    </section>
  );
}

export default InvoiceStudio;
