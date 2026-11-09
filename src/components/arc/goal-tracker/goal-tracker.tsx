"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { ArrowRight, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import { motionTokens } from "../lib/motion-tokens";
import { person } from "../lib/media";
import styles from "./goal-tracker.module.css";

export type GoalConfidence = "on-track" | "at-risk" | "off-track";

/** A number that moved: current against the start and target of a key result. */
export interface GoalKeyResult {
  id: string;
  title: string;
  start: number;
  target: number;
  current: number;
  unit?: string;
  prefix?: string;
  decimals?: number;
  confidence: GoalConfidence;
  source?: GoalSource;
}

export interface GoalSource {
  name: string;
  icon: ReactNode;
}

export interface GoalOwner {
  name: string;
  avatar?: string;
}

export interface GoalObjective {
  id: string;
  title: string;
  owner: GoalOwner;
  keyResults: GoalKeyResult[];
}

export interface GoalQuarter {
  id: string;
  label: string;
  status: "active" | "closed" | "planning";
  meta?: string;
  footnote?: string;
  objectives: GoalObjective[];
}

/** Where a check-in is aimed. */
export interface GoalTarget {
  quarterId: string;
  objectiveId: string;
  keyResultId: string;
}

/** The form state of an open check-in. */
export interface GoalDraft {
  value: string;
  confidence: GoalConfidence;
  note: string;
}

/** What a check-in reports back to the host. */
export interface GoalCheckInPayload extends GoalTarget {
  value: number;
  previousValue: number;
  confidence: GoalConfidence;
  note: string;
}

export interface GoalTrackerProps {
  /** Quarters to show. Omit to use the built-in sample data. */
  quarters?: GoalQuarter[];
  /** Section heading. */
  title?: string;
  /** Controlled quarter id. */
  quarterId?: string;
  defaultQuarterId?: string;
  onQuarterChange?: (quarterId: string) => void;
  /** Persists a check-in. The promise keeps the form in its saving phase until it settles. */
  onCheckIn?: (payload: GoalCheckInPayload, options: { signal: AbortSignal }) => Promise<void> | void;
  /** Runs the sample check-in once the block is in view. Defaults to on for the sample data. */
  autoPlay?: boolean;
  className?: string;
}

/** Progress of one key result, clamped to 0–100. */
export function keyResultProgress(kr: GoalKeyResult): number {
  const span = kr.target - kr.start;
  if (span === 0) return kr.current === kr.target ? 100 : 0;
  return Math.min(100, Math.max(0, ((kr.current - kr.start) / span) * 100));
}

/** Average progress of an objective's key results. */
export function objectiveProgress(objective: GoalObjective): number {
  if (!objective.keyResults.length) return 0;
  return objective.keyResults.reduce((total, kr) => total + keyResultProgress(kr), 0) / objective.keyResults.length;
}

const CONFIDENCE_RANK: Record<GoalConfidence, number> = { "on-track": 0, "at-risk": 1, "off-track": 2 };
const CONFIDENCE_ORDER: GoalConfidence[] = ["on-track", "at-risk", "off-track"];

/** The confidence of an objective is the rounded mean of its key results. */
export function objectiveConfidence(objective: GoalObjective): GoalConfidence {
  if (!objective.keyResults.length) return "on-track";
  const mean = objective.keyResults.reduce((total, kr) => total + CONFIDENCE_RANK[kr.confidence], 0) / objective.keyResults.length;
  return CONFIDENCE_ORDER[Math.round(mean)] ?? "on-track";
}

/** Average progress of a quarter's objectives. */
export function quarterProgress(quarter: GoalQuarter): number {
  if (!quarter.objectives.length) return 0;
  return quarter.objectives.reduce((total, objective) => total + objectiveProgress(objective), 0) / quarter.objectives.length;
}

/** Formats a key result value with its prefix, grouping, decimals and unit. */
export function formatGoalValue(kr: Pick<GoalKeyResult, "prefix" | "unit" | "decimals">, value: number): string {
  const decimals = kr.decimals ?? 0;
  const number = value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${kr.prefix ?? ""}${number}${kr.unit ?? ""}`;
}

const brandIconProps = { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true, focusable: false } as const;

const StripeSource: GoalSource = {
  name: "Stripe",
  icon: (
    <svg {...brandIconProps}>
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
    </svg>
  ),
};

const LinearSource: GoalSource = {
  name: "Linear",
  icon: (
    <svg {...brandIconProps}>
      <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.020 12.020 0 0 1-9.824-9.824Z" />
    </svg>
  ),
};

const VercelSource: GoalSource = {
  name: "Vercel",
  icon: (
    <svg {...brandIconProps}>
      <path d="m12 1.608 12 20.784H0Z" />
    </svg>
  ),
};

const IntercomSource: GoalSource = {
  name: "Intercom",
  icon: (
    <svg {...brandIconProps}>
      <path d="M21 0H3C1.343 0 0 1.343 0 3v18c0 1.658 1.343 3 3 3h18c1.658 0 3-1.342 3-3V3c0-1.657-1.342-3-3-3zm-5.801 4.399c0-.44.36-.8.802-.8.44 0 .8.36.8.8v10.688c0 .442-.36.801-.8.801-.443 0-.802-.359-.802-.801V4.399zM11.2 3.994c0-.44.357-.799.8-.799s.8.359.8.799v11.602c0 .44-.357.8-.8.8s-.8-.36-.8-.8V3.994zm-4 .405c0-.44.359-.8.799-.8.443 0 .802.36.802.8v10.688c0 .442-.36.801-.802.801-.44 0-.799-.359-.799-.801V4.399zM3.199 6c0-.442.36-.8.802-.8.44 0 .799.358.799.8v7.195c0 .441-.359.8-.799.8-.443 0-.802-.36-.802-.8V6zM20.52 18.202c-.123.105-3.086 2.593-8.520 2.593-5.433 0-8.397-2.486-8.521-2.593-.335-.288-.375-.792-.086-1.128.285-.334.79-.375 1.125-.09.047.041 2.693 2.211 7.481 2.211 4.848 0 7.456-2.186 7.479-2.207.334-.289.839-.25 1.128.086.289.336.25.84-.086 1.128zm.281-5.007c0 .441-.36.8-.801.8-.441 0-.801-.36-.801-.8V6c0-.442.361-.8.801-.8.441 0 .801.357.801.8v7.195z" />
    </svg>
  ),
};

const HubSpotSource: GoalSource = {
  name: "HubSpot",
  icon: (
    <svg {...brandIconProps}>
      <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z" />
    </svg>
  ),
};

const olivia: GoalOwner = { name: "Olivia Bennett", avatar: person("olivia-bennett").src };
const ava: GoalOwner = { name: "Ava Mitchell", avatar: person("ava-mitchell").src };
const hannah: GoalOwner = { name: "Hannah Walsh", avatar: person("hannah-walsh").src };

/** Sample quarters used by the live block. */
export const sampleGoalQuarters: GoalQuarter[] = [
  {
    id: "2026-q3",
    label: "Q3 2026",
    status: "closed",
    meta: "Closed Sep 30",
    footnote: "Final scores, read only",
    objectives: [
      {
        id: "usage-billing",
        title: "Launch usage based billing",
        owner: { name: "Daniel Kim", avatar: person("daniel-kim").src },
        keyResults: [
          { id: "metered", title: "Metered billing live on every plan", start: 0, target: 100, current: 100, unit: "%", confidence: "on-track", source: LinearSource },
          { id: "billing-tickets", title: "Billing tickets under 40 a week", start: 95, target: 40, current: 52, confidence: "at-risk", source: IntercomSource },
          { id: "invoice-accuracy", title: "Invoice accuracy at 99.9%", start: 99.2, target: 99.9, current: 99.8, unit: "%", decimals: 1, confidence: "on-track", source: StripeSource },
        ],
      },
      {
        id: "infra-cost",
        title: "Cut infrastructure cost per workspace",
        owner: olivia,
        keyResults: [
          { id: "compute-cost", title: "Compute cost per workspace at $3.10", start: 4.2, target: 3.1, current: 3.35, prefix: "$", decimals: 2, confidence: "on-track", source: VercelSource },
          { id: "idle-previews", title: "Idle preview environments under 5%", start: 22, target: 5, current: 9, unit: "%", confidence: "on-track", source: VercelSource },
          { id: "cold-logs", title: "Logs move to cold storage after 14 days", start: 0, target: 100, current: 100, unit: "%", confidence: "on-track", source: LinearSource },
        ],
      },
      {
        id: "self-serve-onboarding",
        title: "Make onboarding fully self serve",
        owner: { name: "Emma Collins", avatar: person("emma-collins").src },
        keyResults: [
          { id: "activation", title: "Activation within 24 hours at 45%", start: 31, target: 45, current: 38, unit: "%", confidence: "at-risk", source: HubSpotSource },
          { id: "setup-guide", title: "Setup guide completion at 70%", start: 42, target: 70, current: 51, unit: "%", confidence: "off-track", source: HubSpotSource },
          { id: "onboarding-calls", title: "Onboarding calls down 50%", start: 0, target: 50, current: 41, unit: "%", confidence: "on-track", source: IntercomSource },
        ],
      },
    ],
  },
  {
    id: "2026-q4",
    label: "Q4 2026",
    status: "active",
    meta: "Week 4 of 13",
    footnote: "Next check-in due Fri, Oct 30",
    objectives: [
      {
        id: "fast-checkout",
        title: "Make checkout the fastest in the category",
        owner: olivia,
        keyResults: [
          { id: "checkout-p95", title: "Checkout p95 latency under 400 ms", start: 780, target: 400, current: 520, unit: " ms", confidence: "on-track", source: VercelSource },
          { id: "payment-success", title: "Payment success rate at 98.5%", start: 96.2, target: 98.5, current: 97.4, unit: "%", decimals: 1, confidence: "at-risk", source: StripeSource },
          { id: "one-click-upgrade", title: "One click upgrade live for all workspaces", start: 0, target: 100, current: 40, unit: "%", confidence: "on-track", source: LinearSource },
        ],
      },
      {
        id: "self-serve-revenue",
        title: "Grow self serve revenue",
        owner: ava,
        keyResults: [
          { id: "new-mrr", title: "New self serve MRR to $180k", start: 0, target: 180, current: 112, prefix: "$", unit: "k", confidence: "on-track", source: StripeSource },
          { id: "trial-conversion", title: "Trial to paid conversion at 14%", start: 9.8, target: 14, current: 10.6, unit: "%", decimals: 1, confidence: "off-track", source: HubSpotSource },
          { id: "annual-mix", title: "Annual plan mix at 40%", start: 28, target: 40, current: 33, unit: "%", confidence: "at-risk", source: StripeSource },
        ],
      },
      {
        id: "two-hour-answers",
        title: "Answer every customer within two hours",
        owner: hannah,
        keyResults: [
          { id: "first-response", title: "Median first response under 2 h", start: 5.4, target: 2, current: 2.6, unit: " h", decimals: 1, confidence: "on-track", source: IntercomSource },
          { id: "csat", title: "Support CSAT at 95%", start: 89, target: 95, current: 92, unit: "%", confidence: "at-risk", source: IntercomSource },
          { id: "aged-tickets", title: "Close the 160 aged tickets", start: 0, target: 160, current: 96, confidence: "on-track", source: LinearSource },
        ],
      },
    ],
  },
  {
    id: "2027-q1",
    label: "Q1 2027",
    status: "planning",
    meta: "Planning",
    footnote: "Drafting opens Tue, Dec 1",
    objectives: [],
  },
];

const easeStandard = [...motionTokens.ease.standard] as [number, number, number, number];
const panelSpring = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;
const valueTween = { duration: 0.56, ease: easeStandard };

const CONFIDENCE: Record<GoalConfidence, { label: string; Icon: typeof CircleCheck }> = {
  "on-track": { label: "On track", Icon: CircleCheck },
  "at-risk": { label: "At risk", Icon: CircleAlert },
  "off-track": { label: "Off track", Icon: CircleX },
};

const confidenceOptions = (Object.keys(CONFIDENCE) as GoalConfidence[]).map(value => ({ value, label: CONFIDENCE[value].label }));

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}

/** Parses a typed check-in value, tolerating grouping separators and unit marks. */
function parseGoalInput(input: string): number | null {
  const cleaned = input.replace(/[,\s$%]/g, "");
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function resolveTarget(quarters: GoalQuarter[], target: GoalTarget | null): { objective: GoalObjective; kr: GoalKeyResult } | null {
  if (!target) return null;
  const objective = quarters.find(quarter => quarter.id === target.quarterId)?.objectives.find(entry => entry.id === target.objectiveId);
  const kr = objective?.keyResults.find(entry => entry.id === target.keyResultId);
  return objective && kr ? { objective, kr } : null;
}

/** A motion value that eases toward the number it is given, so bars and percentages grow rather than jump. */
function useEasedValue(value: number, active: boolean, reduced: boolean, delaySeconds = 0) {
  const initial = active ? value : 0;
  const motionValue = useMotionValue(initial);
  useEffect(() => {
    if (!active) return;
    if (reduced) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { ...valueTween, delay: delaySeconds });
    return () => controls.stop();
  }, [value, active, reduced, delaySeconds, motionValue]);
  return motionValue;
}

function Percent({ mv }: { mv: ReturnType<typeof useEasedValue> }) {
  const label = useTransform(mv, latest => `${Math.round(latest)}%`);
  return <motion.span className={styles.percent}>{label}</motion.span>;
}

function Meter({ mv, confidence }: { mv: ReturnType<typeof useEasedValue>; confidence: GoalConfidence }) {
  const clipPath = useTransform(mv, latest => `inset(0 ${100 - Math.min(100, Math.max(0, latest))}% 0 0 round 999px)`);
  return (
    <span className={styles.meter} data-confidence={confidence} aria-hidden>
      <motion.span className={styles.meterFill} style={{ clipPath }} />
    </span>
  );
}

function Dot() {
  return <span className={styles.dot} aria-hidden>·</span>;
}

/** Crossfades the text it is given whenever the id changes. */
function Swap({ id, reduced, children }: { id: string; reduced: boolean; children: ReactNode }) {
  return (
    <span className={styles.swap}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={{ opacity: 0, y: reduced ? 0 : 2 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.16, ease: easeStandard } }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Quarter-wide percentage in the header. */
function OverallPercent({ value, active, reduced }: { value: number; active: boolean; reduced: boolean }) {
  const mv = useEasedValue(value, active, reduced, 0.12);
  const label = useTransform(mv, latest => `${Math.round(latest)}%`);
  return <motion.span className={styles.number}>{label}</motion.span>;
}

/** The percentage a draft would land on, eased as the input changes. */
function ProjectedPercent({ value, reduced }: { value: number; reduced: boolean }) {
  const mv = useMotionValue(value);
  useEffect(() => {
    if (reduced) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.18, ease: easeStandard });
    return () => controls.stop();
  }, [value, reduced, mv]);
  const label = useTransform(mv, latest => `${Math.round(latest)}%`);
  return <motion.span className={styles.number}>{label}</motion.span>;
}

function ConfidenceChip({ value, reduced }: { value: GoalConfidence; reduced: boolean }) {
  const { label, Icon } = CONFIDENCE[value];
  return (
    <span className={styles.confidence} data-confidence={value}>
      {(Object.keys(CONFIDENCE) as GoalConfidence[]).map(key => (
        <span key={key} className={styles.sizer} aria-hidden>
          <CircleCheck size={14} />
          {CONFIDENCE[key].label}
        </span>
      ))}
      <AnimatePresence initial={false}>
        <motion.span
          key={value}
          className={styles.confidenceShown}
          initial={{ opacity: 0, y: reduced ? 0 : 2 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.16, ease: easeStandard } }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
        >
          <Icon size={14} className={styles.confidenceIcon} aria-hidden />
          {label}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

interface KeyResultRowProps {
  id: string;
  kr: GoalKeyResult;
  editable: boolean;
  recent: { keyResultId: string; delta: number; key: number } | null;
  active: boolean;
  reduced: boolean;
  onOpen: () => void;
}

function KeyResultRow({ id, kr, editable, recent, active, reduced, onOpen }: KeyResultRowProps) {
  const progress = keyResultProgress(kr);
  const mv = useEasedValue(progress, active, reduced);
  const valueLabel = `${formatGoalValue(kr, kr.current)} / ${formatGoalValue(kr, kr.target)}`;
  const lines = (
    <span className={styles.lines}>
      <span className={styles.krTitle}>{kr.title}</span>
      <span className={styles.percentCell}>
        <AnimatePresence>
          {recent && recent.delta !== 0 && (
            <motion.span
              key={recent.key}
              className={styles.delta}
              data-negative={recent.delta < 0 || undefined}
              initial={{ opacity: 0, y: reduced ? 0 : 2 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.16, ease: easeStandard, delay: reduced ? 0 : 0.2 } }}
              exit={{ opacity: 0, transition: { duration: 0.18 } }}
            >
              {recent.delta > 0 ? "+" : "−"}
              {Math.abs(recent.delta)}
            </motion.span>
          )}
        </AnimatePresence>
        <Percent mv={mv} />
      </span>
      <span className={styles.rowMeta}>
        <ConfidenceChip value={kr.confidence} reduced={reduced} />
        <Dot />
        <span className={styles.value}>
          <Swap id={valueLabel} reduced={reduced}>{valueLabel}</Swap>
        </span>
        {kr.source && (
          <span className={styles.source} title={`Synced from ${kr.source.name}`}>
            {kr.source.icon}
            <span className={styles.srOnly}>Synced from {kr.source.name}</span>
          </span>
        )}
      </span>
      <Meter mv={mv} confidence={kr.confidence} />
    </span>
  );
  return (
    <li>
      {editable ? (
        <button
          type="button"
          id={id}
          className={styles.krRow}
          onClick={onOpen}
          aria-label={`Check in on ${kr.title}. ${formatGoalValue(kr, kr.current)} of ${formatGoalValue(kr, kr.target)}, ${Math.round(progress)}%, ${CONFIDENCE[kr.confidence].label}.`}
        >
          {lines}
        </button>
      ) : (
        <div id={id} className={styles.krRow} data-static="">
          {lines}
        </div>
      )}
    </li>
  );
}

interface CheckInFormProps {
  kr: GoalKeyResult;
  visible: boolean;
  draft: GoalDraft;
  phase: "editing" | "saving" | "error";
  reduced: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  onDraft: (patch: Partial<GoalDraft>) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

function CheckInForm({ kr, visible, draft, phase, reduced, inputRef, onDraft, onCancel, onSubmit }: CheckInFormProps) {
  const fieldId = useId();
  const parsed = parseGoalInput(draft.value);
  const from = keyResultProgress(kr);
  const to = parsed === null ? from : keyResultProgress({ ...kr, current: parsed });
  const saving = phase === "saving";
  return (
    <motion.form
      className={styles.checkIn}
      onSubmit={event => {
        event.preventDefault();
        if (parsed === null || saving) return;
        onSubmit();
      }}
      onKeyDown={event => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        onCancel();
      }}
      aria-label={`Check in on ${kr.title}`}
      initial={false}
      animate={{ opacity: visible ? 1 : 0, y: visible || reduced ? 0 : 2 }}
      transition={{ duration: visible ? 0.16 : 0.1, ease: easeStandard, delay: visible ? 0.04 : 0 }}
      inert={!visible || undefined}
      aria-hidden={!visible || undefined}
      data-visible={visible || undefined}
    >
      <div className={styles.checkInHead}>
        <span className={styles.krTitle}>{kr.title}</span>
        <span className={styles.checkInMeta}>Target {formatGoalValue(kr, kr.target)}</span>
      </div>
      <div className={styles.controls}>
        <label className={styles.valueField} data-invalid={(draft.value !== "" && parsed === null) || undefined}>
          <span className={styles.srOnly}>New value</span>
          {kr.prefix && (
            <span className={styles.affix} aria-hidden>{kr.prefix}</span>
          )}
          <input
            ref={inputRef}
            id={`${fieldId}-value`}
            className={styles.valueInput}
            inputMode="decimal"
            autoComplete="off"
            value={draft.value}
            disabled={saving}
            onChange={event => onDraft({ value: event.target.value })}
            onFocus={event => event.currentTarget.select()}
          />
          {kr.unit && (
            <span className={styles.affix} aria-hidden>{kr.unit.trim()}</span>
          )}
        </label>
        <SegmentedControl
          label="Confidence"
          options={confidenceOptions}
          value={draft.confidence}
          onValueChange={value => onDraft({ confidence: value as GoalConfidence })}
          className={styles.confidencePicker}
        />
      </div>
      <label className={styles.noteField}>
        <span className={styles.srOnly}>Note</span>
        <input
          className={styles.noteInput}
          placeholder="What changed this week?"
          autoComplete="off"
          value={draft.note}
          disabled={saving}
          maxLength={240}
          onChange={event => onDraft({ note: event.target.value })}
        />
      </label>
      <div className={styles.actions}>
        <span className={styles.projection} data-error={phase === "error" || undefined}>
          <Swap id={phase === "error" ? "error" : parsed === null ? "invalid" : "ok"} reduced={reduced}>
            {phase === "error" ? (
              <Fragment>
                <CircleAlert size={14} aria-hidden />
                Not saved. Try again.
              </Fragment>
            ) : parsed === null ? (
              "Enter a number"
            ) : (
              <Fragment>
                <span className={styles.number}>{Math.round(from)}%</span>
                <ArrowRight size={14} className={styles.arrow} aria-hidden />
                <ProjectedPercent value={Math.round(to)} reduced={reduced} />
              </Fragment>
            )}
          </Swap>
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" variant="primary" loading={saving} disabled={parsed === null}>
          {phase === "error" ? "Retry" : "Save check-in"}
        </Button>
      </div>
    </motion.form>
  );
}

interface ObjectiveRowProps {
  uid: string;
  quarter: GoalQuarter;
  objective: GoalObjective;
  open: boolean;
  target: GoalTarget | null;
  draft: GoalDraft;
  phase: "editing" | "saving" | "error";
  recent: { keyResultId: string; delta: number; key: number } | null;
  active: boolean;
  reduced: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onToggle: () => void;
  onOpenKr: (kr: GoalKeyResult) => void;
  onDraft: (patch: Partial<GoalDraft>) => void;
  onCancel: () => void;
  onSubmit: () => void;
  rowId: (target: GoalTarget) => string;
}

function ObjectiveRow({
  uid,
  quarter,
  objective,
  open,
  target,
  draft,
  phase,
  recent,
  active,
  reduced,
  inputRef,
  onToggle,
  onOpenKr,
  onDraft,
  onCancel,
  onSubmit,
  rowId,
}: ObjectiveRowProps) {
  const progress = objectiveProgress(objective);
  const confidence = objectiveConfidence(objective);
  const mv = useEasedValue(progress, active, reduced, 0.12);
  const bodyId = `${uid}-body-${quarter.id}-${objective.id}`;
  const editing = Boolean(target);
  const formKr = objective.keyResults.find(kr => kr.id === target?.keyResultId) ?? objective.keyResults[0];
  const editable = quarter.status === "active";
  return (
    <li className={styles.objective}>
      <button type="button" className={styles.objectiveRow} aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <ChevronRight size={16} className={styles.chevron} data-open={open || undefined} aria-hidden />
        <span className={styles.lines}>
          <span className={styles.objectiveTitle}>{objective.title}</span>
          <Percent mv={mv} />
          <span className={styles.rowMeta}>
            <span className={styles.owner}>
              <Avatar name={objective.owner.name} src={objective.owner.avatar} size="sm" className={styles.ownerAvatar} />
              <span className={styles.ownerName}>{objective.owner.name}</span>
            </span>
            <Dot />
            <ConfidenceChip value={confidence} reduced={reduced} />
          </span>
          <Meter mv={mv} confidence={confidence} />
        </span>
      </button>
      <motion.div
        id={bodyId}
        className={styles.body}
        initial={false}
        animate={{ height: open ? "auto" : 0 }}
        transition={reduced ? { duration: 0 } : panelSpring}
        inert={!open || undefined}
      >
        <div className={styles.bodyInner}>
          <motion.ul
            className={styles.keyResults}
            initial={false}
            animate={{ opacity: editing ? 0 : 1 }}
            transition={{ duration: editing ? 0.1 : 0.16, ease: easeStandard }}
            inert={editing || undefined}
            aria-hidden={editing || undefined}
          >
            {objective.keyResults.map(kr => {
              const krTarget: GoalTarget = { quarterId: quarter.id, objectiveId: objective.id, keyResultId: kr.id };
              return (
                <KeyResultRow
                  key={kr.id}
                  id={rowId(krTarget)}
                  kr={kr}
                  editable={editable}
                  recent={recent?.keyResultId === kr.id ? recent : null}
                  active={active}
                  reduced={reduced}
                  onOpen={() => onOpenKr(kr)}
                />
              );
            })}
          </motion.ul>
          {formKr && (
            <CheckInForm
              kr={formKr}
              visible={editing}
              draft={draft}
              phase={phase}
              reduced={reduced}
              inputRef={editing ? inputRef : undefined}
              onDraft={onDraft}
              onCancel={onCancel}
              onSubmit={onSubmit}
            />
          )}
        </div>
      </motion.div>
    </li>
  );
}

export function GoalTracker({
  quarters: quartersProp,
  title = "Company goals",
  quarterId,
  defaultQuarterId,
  onQuarterChange,
  onCheckIn,
  autoPlay,
  className,
}: GoalTrackerProps) {
  const uid = useId();
  const reduced = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [quarters, setQuarters] = useState<GoalQuarter[]>(() => quartersProp ?? sampleGoalQuarters);
  const initialId = defaultQuarterId ?? (quarters.find(entry => entry.status === "active") ?? quarters[quarters.length - 1])?.id ?? "";
  const [currentId, setCurrentId] = useState(initialId);
  const resolvedId = quarterId ?? currentId;
  const index = Math.max(0, quarters.findIndex(entry => entry.id === resolvedId));
  const quarter = quarters[index];
  const [direction, setDirection] = useState(1);
  const [openObjectives, setOpenObjectives] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(quarters.map(entry => [entry.id, entry.objectives[0]?.id ?? null])),
  );
  const [target, setTarget] = useState<GoalTarget | null>(null);
  const [draft, setDraft] = useState<GoalDraft>({ value: "", confidence: "on-track", note: "" });
  const [phase, setPhase] = useState<"editing" | "saving" | "error">("editing");
  const [recent, setRecent] = useState<{ keyResultId: string; delta: number; key: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [inView, setInView] = useState(false);
  const [panelHeight, setPanelHeight] = useState<number>();
  const pendingFocus = useRef<string | null>(null);
  const checkInAbort = useRef<AbortController | null>(null);
  const autoAbort = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setInView(true);
        observer.disconnect();
      }
    }, { threshold: 0.25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const node = panelRef.current;
    if (!node || typeof ResizeObserver === "undefined" || !quarter?.objectives.length) return;
    const observer = new ResizeObserver(() => setPanelHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, [quarter?.id, quarter?.objectives.length]);

  // Focus returns to the row that opened the form, or to the value input when a row was opened by hand.
  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    if (pending === "input") inputRef.current?.focus({ preventScroll: true });
    else document.getElementById(pending)?.focus({ preventScroll: true });
  }, [target]);

  useEffect(() => {
    if (!recent) return;
    const timer = window.setTimeout(() => setRecent(null), 2600);
    return () => window.clearTimeout(timer);
  }, [recent]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(
    () => () => {
      checkInAbort.current?.abort();
      autoAbort.current?.abort();
    },
    [],
  );

  const rowId = (next: GoalTarget) => `${uid}-kr-${next.quarterId}-${next.objectiveId}-${next.keyResultId}`;

  const closeTarget = useCallback((restoreFocus: boolean) => {
    checkInAbort.current?.abort();
    checkInAbort.current = null;
    setTarget(previous => {
      if (previous && restoreFocus) pendingFocus.current = rowId(previous);
      return null;
    });
    setPhase("editing");
  }, [uid]);

  const openTarget = useCallback(
    (next: GoalTarget, focusInput: boolean) => {
      const resolved = resolveTarget(quarters, next);
      if (!resolved) return;
      checkInAbort.current?.abort();
      setOpenObjectives(previous => ({ ...previous, [next.quarterId]: next.objectiveId }));
      setDraft({
        value: formatGoalValue({ decimals: resolved.kr.decimals }, resolved.kr.current).replace(/,/g, ""),
        confidence: resolved.kr.confidence,
        note: "",
      });
      setPhase("editing");
      if (focusInput) pendingFocus.current = "input";
      setTarget(next);
    },
    [quarters],
  );

  const submitTarget = useCallback(
    async (next: GoalTarget, nextDraft: GoalDraft) => {
      const resolved = resolveTarget(quarters, next);
      const value = parseGoalInput(nextDraft.value);
      if (!resolved || value === null) return;
      checkInAbort.current?.abort();
      const controller = new AbortController();
      checkInAbort.current = controller;
      setPhase("saving");
      const payload: GoalCheckInPayload = {
        ...next,
        value,
        previousValue: resolved.kr.current,
        confidence: nextDraft.confidence,
        note: nextDraft.note.trim(),
      };
      try {
        if (onCheckIn) await onCheckIn(payload, { signal: controller.signal });
        else await delay(620, controller.signal);
      } catch {
        if (controller.signal.aborted) return;
        setPhase("error");
        setAnnouncement("Check-in was not saved. Try again.");
        return;
      }
      if (controller.signal.aborted) return;
      checkInAbort.current = null;
      const before = keyResultProgress(resolved.kr);
      const updatedKr: GoalKeyResult = { ...resolved.kr, current: value, confidence: nextDraft.confidence };
      const after = keyResultProgress(updatedKr);
      const updatedObjective: GoalObjective = {
        ...resolved.objective,
        keyResults: resolved.objective.keyResults.map(kr => (kr.id === next.keyResultId ? updatedKr : kr)),
      };
      setQuarters(previous =>
        previous.map(entry =>
          entry.id !== next.quarterId
            ? entry
            : { ...entry, objectives: entry.objectives.map(objective => (objective.id === next.objectiveId ? updatedObjective : objective)) },
        ),
      );
      setRecent({ keyResultId: next.keyResultId, delta: Math.round(after) - Math.round(before), key: Date.now() });
      setToast(onCheckIn ? "Check-in saved" : "Check-in saved · simulated");
      setAnnouncement(
        `Check-in saved. ${resolved.kr.title}: ${formatGoalValue(resolved.kr, value)}, ${CONFIDENCE[nextDraft.confidence].label.toLowerCase()}. Objective at ${Math.round(objectiveProgress(updatedObjective))}%.${onCheckIn ? "" : " Simulated, nothing was sent."}`,
      );
      setPhase("editing");
      setTarget(previous => {
        if (previous && document.activeElement && rootRef.current?.contains(document.activeElement)) pendingFocus.current = rowId(previous);
        return null;
      });
    },
    [quarters, onCheckIn, rowId],
  );

  const goToQuarter = (step: number) => {
    const next = quarters[index + step];
    if (!next) return;
    cancelAuto();
    closeTarget(false);
    setDirection(step);
    setCurrentId(next.id);
    onQuarterChange?.(next.id);
  };

  function cancelAuto() {
    autoAbort.current?.abort();
    autoAbort.current = null;
  }

  const autoPlayEnabled = (autoPlay ?? !quartersProp) && !reduced;
  const playedOnce = useRef(false);

  useEffect(() => {
    if (!inView || !autoPlayEnabled || playedOnce.current) return;
    const activeQuarter = quarters.find(entry => entry.status === "active");
    const objective = activeQuarter?.objectives[0];
    const kr = objective?.keyResults.find(entry => entry.confidence === "at-risk") ?? objective?.keyResults[0];
    if (!activeQuarter || !objective || !kr || resolvedId !== activeQuarter.id) return;
    playedOnce.current = true;
    const controller = new AbortController();
    autoAbort.current = controller;
    const next: GoalTarget = { quarterId: activeQuarter.id, objectiveId: objective.id, keyResultId: kr.id };
    const typed = kr.decimals
      ? (kr.current + (kr.target - kr.current) * 0.64).toFixed(kr.decimals)
      : String(Math.round(kr.current + (kr.target - kr.current) * 0.64));
    const note = "3DS retry shipped Oct 24. Soft declines are down 31% week over week, so we are back on pace.";
    (async () => {
      const { signal } = controller;
      await delay(1100, signal);
      openTarget(next, false);
      await delay(520, signal);
      setDraft(current => ({ ...current, value: "" }));
      for (let size = 1; size <= typed.length; size += 1) {
        await delay(80, signal);
        setDraft(current => ({ ...current, value: typed.slice(0, size) }));
      }
      await delay(320, signal);
      setDraft(current => ({ ...current, confidence: "on-track" }));
      await delay(360, signal);
      const words = note.split(" ");
      for (let end = 0; end < words.length; end += 4) {
        await delay(36, signal);
        setDraft(current => ({ ...current, note: words.slice(0, end + 4).join(" ") }));
      }
      await delay(560, signal);
      autoAbort.current = null;
      await submitTarget(next, { value: typed, confidence: "on-track", note });
    })().catch(() => undefined);
  }, [inView, autoPlayEnabled, quarters, resolvedId, openTarget, submitTarget]);

  // A pointer or a key anywhere in the block stops the sample check-in so a person can take over.
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const stop = () => cancelAuto();
    node.addEventListener("pointerdown", stop);
    node.addEventListener("keydown", stop);
    return () => {
      node.removeEventListener("pointerdown", stop);
      node.removeEventListener("keydown", stop);
    };
  }, []);

  if (!quarter) return null;

  const overall = Math.round(quarterProgress(quarter));
  const animated = inView || reduced;
  const footText = toast ?? quarter.footnote ?? "";

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.meta}>
            <Swap id={quarter.id} reduced={reduced}>
              {quarter.meta ?? quarter.label}
              {quarter.objectives.length > 0 && (
                <Fragment>
                  <Dot />
                  <OverallPercent value={overall} active={animated} reduced={reduced} />
                  {" overall"}
                </Fragment>
              )}
            </Swap>
          </p>
        </div>
        <div className={styles.stepper} role="group" aria-label="Quarter">
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => goToQuarter(-1)}
            disabled={index === 0}
            aria-label={quarters[index - 1] ? `Previous quarter, ${quarters[index - 1].label}` : "Previous quarter"}
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          <span className={styles.quarterLabel} aria-live="polite">
            <Swap id={quarter.id} reduced={reduced}>{quarter.label}</Swap>
          </span>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => goToQuarter(1)}
            disabled={index === quarters.length - 1}
            aria-label={quarters[index + 1] ? `Next quarter, ${quarters[index + 1].label}` : "Next quarter"}
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      </header>
      <div className={styles.panels}>
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={quarter.id}
            ref={panelRef}
            className={styles.panel}
            custom={direction}
            variants={{
              enter: (custom: number) => ({ opacity: 0, x: reduced ? 0 : 8 * custom }),
              center: { opacity: 1, x: 0 },
              exit: (custom: number) => ({ opacity: 0, x: reduced ? 0 : -8 * custom }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ opacity: { duration: 0.16, ease: easeStandard }, x: panelSpring }}
          >
            {quarter.objectives.length === 0 ? (
              <div className={styles.empty} style={{ minHeight: panelHeight }}>
                <p className={styles.emptyTitle}>No goals for {quarter.label} yet</p>
                <p className={styles.emptyText}>
                  {quarter.footnote ? `${quarter.footnote}.` : "Drafting has not opened."} Unfinished key results can carry over.
                </p>
              </div>
            ) : (
              <ul className={styles.objectives}>
                {quarter.objectives.map(objective => (
                  <ObjectiveRow
                    key={objective.id}
                    uid={uid}
                    quarter={quarter}
                    objective={objective}
                    open={openObjectives[quarter.id] === objective.id}
                    target={target?.quarterId === quarter.id && target.objectiveId === objective.id ? target : null}
                    draft={draft}
                    phase={phase}
                    recent={recent}
                    active={animated}
                    reduced={reduced}
                    inputRef={inputRef}
                    onToggle={() => {
                      cancelAuto();
                      const isOpen = openObjectives[quarter.id] === objective.id;
                      if (target && target.objectiveId === objective.id) closeTarget(false);
                      setOpenObjectives(previous => ({ ...previous, [quarter.id]: isOpen ? null : objective.id }));
                    }}
                    onOpenKr={kr => {
                      cancelAuto();
                      openTarget({ quarterId: quarter.id, objectiveId: objective.id, keyResultId: kr.id }, true);
                    }}
                    onDraft={patch => {
                      cancelAuto();
                      setDraft(current => ({ ...current, ...patch }));
                      if (phase === "error") setPhase("editing");
                    }}
                    onCancel={() => {
                      cancelAuto();
                      closeTarget(true);
                    }}
                    onSubmit={() => {
                      cancelAuto();
                      if (target) void submitTarget(target, draft);
                    }}
                    rowId={rowId}
                  />
                ))}
              </ul>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <footer className={styles.foot}>
        <span className={styles.footText}>
          <Swap id={footText} reduced={reduced}>
            {toast && <CircleCheck size={14} className={styles.footIcon} aria-hidden />}
            {footText}
          </Swap>
        </span>
        {quarter.status === "active" && quarter.objectives.length > 0 && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              cancelAuto();
              const objective = quarter.objectives.find(entry => entry.id === openObjectives[quarter.id]) ?? quarter.objectives[0];
              const kr = objective?.keyResults[0];
              if (objective && kr) openTarget({ quarterId: quarter.id, objectiveId: objective.id, keyResultId: kr.id }, true);
            }}
            disabled={!!target}
          >
            Check in
          </Button>
        )}
      </footer>
      <p className={styles.srOnly} aria-live="polite">{announcement}</p>
    </div>
  );
}

export default GoalTracker;
