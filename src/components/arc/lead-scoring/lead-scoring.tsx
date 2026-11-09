"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  BriefcaseBusiness,
  CalendarCheck,
  Check,
  ChevronDown,
  CircleX,
  CodeXml,
  Eye,
  FileText,
  KeyRound,
  Mail,
  RotateCcw,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { Tooltip } from "../tooltip/tooltip";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./lead-scoring.module.css";

/* -------------------------------------------------------------------------------------------------
 * Types
 * ---------------------------------------------------------------------------------------------- */

/** Sort order of the list. `newest` keeps the order you pass in. */
export type LeadSort = "score" | "newest";

/** CRM a lead can be pushed to. */
export type LeadCrmId = "hubspot" | "salesforce";

/** Built-in company marks. Any other mark is your own 20px node. */
export type LeadCompanyMarkId =
  "vercel" | "ramp" | "linear" | "notion" | "retool" | "figma";

/** Signal kinds, each with its own icon in the open row. */
export type LeadSignalKind =
  | "pricing"
  | "team"
  | "hiring"
  | "email"
  | "demo"
  | "stack"
  | "docs"
  | "repo"
  | "security";

/** Push state of one lead to one CRM. */
export type LeadPushState = "idle" | "pushing" | "done" | "error";

/** Fit band of a score: 80 and up is a strong fit, 60 and up a possible fit, below that a weak fit. */
export type LeadBand = "strong" | "good" | "low";

/** One intent signal shown as a chip in the open row. */
export interface LeadSignal {
  kind: LeadSignalKind;
  label: string;
}

/** One weighted score factor, 0 to 100. */
export interface LeadFactor {
  id: string;
  label: string;
  /** Factor score, 0 to 100. */
  value: number;
  /** Share of the total score. Weights should add up to 1. */
  weight: number;
}

/** One inbound lead. */
export interface Lead {
  /** Stable id, used as the React key and for push state. */
  id: string;
  /** Person's name. */
  name: string;
  /** Job title. Hidden in the row on narrow cards. */
  title: string;
  /** Company name. */
  company: string;
  /** `"vercel"`, `"ramp"`, `"linear"`, `"notion"`, `"retool"`, `"figma"`, or your own 20px logo node. Falls back to a monogram. */
  mark?: LeadCompanyMarkId | ReactNode;
  /** Arrival time, already formatted ("6m ago"). */
  received: string;
  /** The model's one-line reason for the score. */
  reason: string;
  /** Chips in the open row. */
  signals?: LeadSignal[];
  /** Score factors, 0 to 100, with weights that add up to 1. The score is their weighted sum unless `score` is set. */
  breakdown?: LeadFactor[];
  /** 0 to 100. Overrides the breakdown sum. */
  score?: number;
  /** Still being scored: the ring spins and the reason shimmers. */
  scoring?: boolean;
  /** CRMs the lead already lives in. Shows Synced in the row. */
  pushedTo?: LeadCrmId[];
}

export interface LeadScoringProps {
  /** Leads to show, newest first. Defaults to the sample queue. */
  leads?: Lead[];
  /** Card title. Defaults to "Inbound leads". */
  title?: string;
  /** Line under the title. Defaults to the scoring model and the lead count. */
  description?: ReactNode;
  /** Controlled sort. Newest keeps the array order. */
  sort?: LeadSort;
  /** Starting sort when uncontrolled. Defaults to "newest" while auto playing, else "score". */
  defaultSort?: LeadSort;
  /** Called when the sort control changes. */
  onSortChange?: (sort: LeadSort) => void;
  /** CRMs a lead can be pushed to. The first is the default destination; one entry hides the picker. Defaults to both. */
  crms?: LeadCrmId[];
  /** Creates the contact and deal. Resolve for the done state, reject for the error state with a retry. The signal aborts on unmount. Without it pushes are simulated and announced as such. */
  onPush?: (lead: Lead, crm: LeadCrmId, signal: AbortSignal) => Promise<void>;
  /** Shows a rescore button. Mark leads scoring while you rescore them. The sample demo rescores on its own. */
  onRescore?: () => void;
  /** Plays the intro once when the card scrolls into view: scores land, the list sorts by score, the top lead opens and is pushed to the first CRM. Defaults to true for sample data. */
  autoPlay?: boolean;
  /** Lead open on first render. Defaults to none. */
  defaultExpandedId?: string | null;
  /** Class on the card. */
  className?: string;
}

/* -------------------------------------------------------------------------------------------------
 * Marks
 * ---------------------------------------------------------------------------------------------- */

type MarkProps = SVGProps<SVGSVGElement>;

const COMPANY_MARKS: Record<LeadCompanyMarkId, ComponentType<MarkProps>> = {
  vercel: (props) => (
    <svg
      viewBox="0 .6 24 24"
      fill="currentColor"
      aria-hidden
      focusable={false}
      {...props}
    >
      <path d="m12 1.608 12 20.784H0Z" />
    </svg>
  ),
  ramp: (props) => (
    <svg
      viewBox="51.4 -1.6 19 19"
      fill="currentColor"
      aria-hidden
      focusable={false}
      {...props}
    >
      <path d="M70.028 15.612v.07h-9.983v-.07c1.439-.82 2.432-1.654 3.327-2.526h4.1zm-2.473-13.11L65.027 0h-.074s.042 4.664-4.205 8.906c-4.156 4.15-9.046 4.16-9.046 4.16v.074l2.578 2.546s4.819.05 9.074-4.16c4.24-4.195 4.205-9.022 4.205-9.022z" />
    </svg>
  ),
  linear: (props) => (
    <svg
      viewBox="0 0 24 24"
      fill="#5E6AD2"
      aria-hidden
      focusable={false}
      {...props}
    >
      <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
    </svg>
  ),
  notion: (props) => (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      focusable={false}
      {...props}
    >
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
    </svg>
  ),
  retool: (props) => (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      focusable={false}
      {...props}
    >
      <path d="M0 2.2A2.2 2.2 0 0 1 2.2 0h8.6A2.2 2.2 0 0 1 13 2.2v1.7A1.1 1.1 0 0 1 11.9 5H1.1A1.1 1.1 0 0 1 0 3.9V2.2zm0 6.9A1.1 1.1 0 0 1 1.1 8h20.7a2.2 2.2 0 0 1 2.2 2.2v5.7a1.1 1.1 0 0 1-1.1 1.1H2.2A2.2 2.2 0 0 1 0 14.8V9.1zm11 12a1.1 1.1 0 0 1 1.1-1.1h10.8a1.1 1.1 0 0 1 1.1 1.1v.7a2.2 2.2 0 0 1-2.2 2.2h-8.6a2.2 2.2 0 0 1-2.2-2.2v-.7z" />
    </svg>
  ),
  figma: (props) => (
    <svg viewBox="-9.5 0 57 57" aria-hidden focusable={false} {...props}>
      <path
        fill="#1ABCFE"
        d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z"
      />
      <path
        fill="#0ACF83"
        d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z"
      />
      <path fill="#FF7262" d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" />
      <path
        fill="#F24E1E"
        d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z"
      />
      <path
        fill="#A259FF"
        d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z"
      />
    </svg>
  ),
};

const CRM_MARKS: Record<LeadCrmId, ComponentType<MarkProps>> = {
  hubspot: (props) => (
    <svg
      viewBox="0 0 24 24"
      fill="#FF7A59"
      aria-hidden
      focusable={false}
      {...props}
    >
      <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z" />
    </svg>
  ),
  salesforce: (props) => (
    <svg
      viewBox="0 2.2 24 20"
      fill="#00A1E0"
      aria-hidden
      focusable={false}
      {...props}
    >
      <path d="M10.006 5.415a4.195 4.195 0 013.045-1.306c1.56 0 2.954.9 3.69 2.205.63-.3 1.35-.45 2.1-.45 2.85 0 5.159 2.34 5.159 5.22s-2.31 5.22-5.176 5.22c-.345 0-.69-.044-1.02-.104a3.75 3.75 0 01-3.3 1.95c-.6 0-1.155-.15-1.65-.375A4.314 4.314 0 018.88 20.4a4.302 4.302 0 01-4.05-2.82c-.27.062-.54.076-.825.076-2.204 0-4.005-1.8-4.005-4.05 0-1.5.811-2.805 2.01-3.51-.255-.57-.39-1.2-.39-1.846 0-2.58 2.1-4.65 4.65-4.65 1.53 0 2.85.705 3.72 1.8" />
    </svg>
  ),
};

const CRM_NAMES: Record<LeadCrmId, string> = {
  hubspot: "HubSpot",
  salesforce: "Salesforce",
};

/** The mark of the model that scores the leads, drawn beside the header meta line. */
function ModelMark(props: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="#D97757"
      aria-hidden
      focusable={false}
      {...props}
    >
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Data
 * ---------------------------------------------------------------------------------------------- */

const SIGNAL_ICONS: Record<LeadSignalKind, LucideIcon> = {
  pricing: Eye,
  team: Users,
  hiring: BriefcaseBusiness,
  email: Mail,
  demo: CalendarCheck,
  stack: CodeXml,
  docs: FileText,
  repo: Star,
  security: KeyRound,
};

/** Four weighted factors that add up to one score, in the order the demo's bars expect. */
const factorSet = (
  fit: number,
  intent: number,
  engagement: number,
  timing: number,
): LeadFactor[] => [
  { id: "fit", label: "Company fit", value: fit, weight: 0.35 },
  { id: "intent", label: "Buying intent", value: intent, weight: 0.3 },
  { id: "engagement", label: "Engagement", value: engagement, weight: 0.2 },
  { id: "timing", label: "Timing", value: timing, weight: 0.15 },
];

/** The weighted sum of a lead's factors, or its explicit score. Rounded, clamped to 0 to 100. */
export function leadScore(lead: Lead): number {
  if (typeof lead.score === "number") return Math.round(lead.score);
  if (!lead.breakdown?.length) return 0;
  const total =
    lead.breakdown.reduce((sum, factor) => sum + factor.weight, 0) || 1;
  return Math.round(
    lead.breakdown.reduce(
      (sum, factor) => sum + factor.value * factor.weight,
      0,
    ) / total,
  );
}

/** Six sample leads, newest first, with the scores the demo lands on. */
export const leadScoringSamples: Lead[] = [
  {
    id: "figma-alex",
    name: "Alex Kim",
    title: "Product designer",
    company: "Figma",
    mark: "figma",
    received: "2m ago",
    reason: "Single seat, downloaded the free kit only",
    signals: [
      { kind: "docs", label: "Read 2 docs pages" },
      { kind: "team", label: "1 seat" },
    ],
    breakdown: factorSet(54, 40, 52, 38),
  },
  {
    id: "retool-sofia",
    name: "Sofia Lindqvist",
    title: "Engineering manager",
    company: "Retool",
    mark: "retool",
    received: "6m ago",
    reason: "Series C, 40 engineers, visited pricing 3x",
    signals: [
      { kind: "pricing", label: "Pricing page 3x" },
      { kind: "hiring", label: "Hiring 4 frontend roles" },
      { kind: "stack", label: "React, TypeScript" },
    ],
    breakdown: factorSet(92, 90, 84, 80),
  },
  {
    id: "linear-tomas",
    name: "Tomás Herrera",
    title: "Design engineer",
    company: "Linear",
    mark: "linear",
    received: "14m ago",
    reason: "Starred the repo, opened 2 of 3 emails",
    signals: [
      { kind: "repo", label: "Starred on GitHub" },
      { kind: "email", label: "Opened 2 emails" },
    ],
    breakdown: factorSet(72, 60, 64, 48),
  },
  {
    id: "ramp-maya",
    name: "Maya Chen",
    title: "VP of Engineering",
    company: "Ramp",
    mark: "ramp",
    received: "21m ago",
    reason: "Booked a demo, 120 engineers, contract ends Dec",
    signals: [
      { kind: "demo", label: "Demo booked Oct 29" },
      { kind: "pricing", label: "Compared plans" },
      { kind: "team", label: "12 trial seats" },
      { kind: "security", label: "Asked about SSO" },
    ],
    breakdown: factorSet(96, 95, 92, 90),
  },
  {
    id: "notion-daniel",
    name: "Daniel Okafor",
    title: "Staff engineer",
    company: "Notion",
    mark: "notion",
    received: "38m ago",
    reason: "Read 6 docs pages, asked about SAML",
    signals: [
      { kind: "docs", label: "Read 6 docs pages" },
      { kind: "security", label: "Asked about SAML" },
    ],
    breakdown: factorSet(84, 70, 62, 60),
  },
  {
    id: "vercel-priya",
    name: "Priya Nair",
    title: "Director of platform",
    company: "Vercel",
    mark: "vercel",
    received: "1h ago",
    reason: "Enterprise page twice, 3 teammates signed up",
    signals: [
      { kind: "pricing", label: "Enterprise page 2x" },
      { kind: "team", label: "3 teammates joined" },
      { kind: "email", label: "Replied to intro" },
    ],
    breakdown: factorSet(90, 80, 78, 74),
  },
];

/* -------------------------------------------------------------------------------------------------
 * Motion
 * ---------------------------------------------------------------------------------------------- */

/** Rows glide to their new place and the panel springs its height: no bounce, no text scaling. */
const LAYOUT_SPRING = {
  type: "spring",
  visualDuration: 0.3,
  bounce: 0,
} as const;
const SWAP_IN = {
  duration: motionTokens.duration.fast,
  ease: [...motionTokens.ease.standard],
} as const;
const SWAP_OUT = {
  duration: 0.1,
  ease: [...motionTokens.ease.standard],
} as const;

const bandOf = (score: number): LeadBand =>
  score >= 80 ? "strong" : score >= 60 ? "good" : "low";

const BAND_LABELS: Record<LeadBand, string> = {
  strong: "Strong fit",
  good: "Possible fit",
  low: "Weak fit",
};

const join = (...parts: (string | undefined | false)[]) =>
  parts.filter(Boolean).join(" ");

/** One line of a fixed slot: the outgoing line fades in place while the new one rises two pixels. */
function Swap({
  id,
  children,
  className,
  reduced,
}: {
  id: string;
  children: ReactNode;
  className?: string;
  reduced: boolean;
}) {
  return (
    <motion.span
      key={id}
      className={join(styles.swap, className)}
      initial={{ opacity: 0, y: reduced ? 0 : 2 }}
      animate={{ opacity: 1, y: 0, transition: SWAP_IN }}
      exit={{ opacity: 0, transition: SWAP_OUT }}
    >
      {children}
    </motion.span>
  );
}

/** The arc and the number share one motion value, so they count up together; the number never re-renders React. */
function ScoreRing({
  score,
  scoring,
  reduced,
}: {
  score: number;
  scoring: boolean;
  reduced: boolean;
}) {
  const value = useMotionValue(scoring ? 0 : score);
  const pathLength = useTransform(value, (current) =>
    Math.max(0, Math.min(1, current / 100)),
  );
  const arcOpacity = useTransform(value, (current) => +(current > 0.5));
  const display = useTransform(value, (current) => Math.round(current));

  useEffect(() => {
    if (scoring) {
      value.jump(0);
      return;
    }
    if (reduced) {
      value.jump(score);
      return;
    }
    const controls = animate(value, score, {
      duration: 0.64,
      ease: [...motionTokens.ease.enter],
    });
    return () => controls.stop();
  }, [scoring, score, reduced, value]);

  return (
    <span
      className={styles.ring}
      data-band={bandOf(score)}
      data-scoring={scoring || undefined}
      aria-hidden="true"
    >
      <svg viewBox="0 0 36 36" className={styles.ringSvg}>
        <circle cx="18" cy="18" r="15" className={styles.ringTrack} />
        <motion.circle
          cx="18"
          cy="18"
          r="15"
          className={styles.ringArc}
          style={{ pathLength, opacity: arcOpacity }}
        />
        <g className={styles.ringSpin}>
          <circle cx="18" cy="18" r="15" className={styles.ringSpinner} />
        </g>
      </svg>
      <motion.span className={styles.ringValue}>{display}</motion.span>
    </span>
  );
}

/** The company mark: a built-in logo, your own node, or the company initial. */
function LeadMark({ lead }: { lead: Lead }) {
  const mark = lead.mark;
  if (typeof mark === "string" && mark in COMPANY_MARKS) {
    const Mark = COMPANY_MARKS[mark as LeadCompanyMarkId];
    return <Mark width={20} height={20} />;
  }
  if (mark != null && typeof mark !== "string") return <>{mark}</>;
  return <span className={styles.monogram}>{lead.company.slice(0, 1)}</span>;
}

/** Destination radio group with roving focus: arrows wrap, the checked option is the only tab stop. */
function CrmPicker({
  crms,
  value,
  onChange,
}: {
  crms: LeadCrmId[];
  value: LeadCrmId;
  onChange: (crm: LeadCrmId) => void;
}) {
  return (
    <div
      className={styles.picker}
      role="radiogroup"
      aria-label="Destination"
      onKeyDown={(event) => {
        if (
          !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
            event.key,
          )
        )
          return;
        event.preventDefault();
        const delta =
          event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
        const next =
          crms[(crms.indexOf(value) + delta + crms.length) % crms.length];
        onChange(next);
        event.currentTarget
          .querySelector<HTMLElement>(`[data-crm="${next}"]`)
          ?.focus();
      }}
    >
      {crms.map((crm) => {
        const Mark = CRM_MARKS[crm];
        const selected = crm === value;
        return (
          <Tooltip key={crm} content={CRM_NAMES[crm]}>
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={CRM_NAMES[crm]}
              tabIndex={selected ? 0 : -1}
              data-crm={crm}
              className={styles.pickerOption}
              onClick={() => onChange(crm)}
            >
              <Mark width={16} height={16} />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Row
 * ---------------------------------------------------------------------------------------------- */

interface LeadRowProps {
  lead: Lead;
  scoring: boolean;
  expanded: boolean;
  onToggle: () => void;
  crms: LeadCrmId[];
  crm: LeadCrmId;
  onCrmChange: (crm: LeadCrmId) => void;
  pushState: (crm: LeadCrmId) => LeadPushState;
  onPush: () => void;
  reduced: boolean;
}

function LeadRow({
  lead,
  scoring,
  expanded,
  onToggle,
  crms,
  crm,
  onCrmChange,
  pushState,
  onPush,
  reduced,
}: LeadRowProps) {
  const panelId = useId();
  const score = leadScore(lead);
  const state = pushState(crm);
  const synced =
    crms.find((id) => pushState(id) === "done") ?? lead.pushedTo?.[0];
  const SyncedMark = synced ? CRM_MARKS[synced] : null;
  const crmName = CRM_NAMES[crm];
  const label = scoring
    ? `${lead.name}, ${lead.title} at ${lead.company}, scoring`
    : `${lead.name}, ${lead.title} at ${lead.company}, score ${score}, ${BAND_LABELS[bandOf(score)].toLowerCase()}. ${lead.reason}`;

  return (
    <motion.li
      layout="position"
      transition={{ layout: reduced ? { duration: 0 } : LAYOUT_SPRING }}
      className={styles.item}
      data-expanded={expanded || undefined}
    >
      <button
        type="button"
        className={styles.row}
        data-row=""
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={label}
        onClick={onToggle}
      >
        <span className={styles.mark}>
          <LeadMark lead={lead} />
        </span>
        <span className={styles.text}>
          <span className={styles.line}>
            <span className={styles.name}>{lead.name}</span>
            <span className={styles.role}>
              <span className={styles.jobTitle}>{lead.title}, </span>
              {lead.company}
            </span>
            <span className={styles.when}>
              <AnimatePresence initial={false}>
                {SyncedMark && synced ? (
                  <Swap
                    id={`synced-${synced}`}
                    reduced={reduced}
                    className={styles.synced}
                  >
                    <SyncedMark width={14} height={14} />
                    Synced
                  </Swap>
                ) : (
                  <Swap id="time" reduced={reduced}>
                    {lead.received}
                  </Swap>
                )}
              </AnimatePresence>
            </span>
          </span>
          <span className={styles.reason}>
            <AnimatePresence initial={false}>
              {scoring ? (
                <Swap id="scoring" reduced={reduced}>
                  <TextShimmer>Scoring fit and intent</TextShimmer>
                </Swap>
              ) : (
                <Swap id="reason" reduced={reduced}>
                  {lead.reason}
                </Swap>
              )}
            </AnimatePresence>
          </span>
        </span>
        <ScoreRing score={score} scoring={scoring} reduced={reduced} />
        <ChevronDown className={styles.chevron} size={16} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="panel"
            id={panelId}
            role="region"
            aria-label={`${lead.name} score details`}
            className={styles.panel}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : { height: LAYOUT_SPRING, opacity: SWAP_IN }
            }
          >
            <div className={styles.panelInner}>
              {lead.signals?.length ? (
                <ul className={styles.signals} aria-label="Signals">
                  {lead.signals.map((signal) => {
                    const Icon = SIGNAL_ICONS[signal.kind] ?? Eye;
                    return (
                      <li key={signal.label} className={styles.chip}>
                        <Icon size={14} aria-hidden="true" />
                        {signal.label}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {lead.breakdown?.length ? (
                <ul
                  className={styles.factors}
                  aria-label={`Score breakdown, ${score} of 100`}
                >
                  {lead.breakdown.map((factor, index) => (
                    <li key={factor.id} className={styles.factor}>
                      <span className={styles.factorLabel}>{factor.label}</span>
                      <span className={styles.bar} aria-hidden="true">
                        <motion.span
                          className={styles.barFill}
                          data-band={bandOf(factor.value)}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: scoring ? 0 : factor.value / 100 }}
                          transition={
                            reduced
                              ? { duration: 0 }
                              : {
                                  duration: 0.48,
                                  delay: 0.06 + 0.03 * index,
                                  ease: [...motionTokens.ease.enter],
                                }
                          }
                        />
                      </span>
                      <span className={styles.factorValue}>
                        {scoring ? "" : factor.value}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className={styles.footer}>
                <p className={styles.status}>
                  <AnimatePresence initial={false}>
                    {state === "pushing" ? (
                      <Swap id="pushing" reduced={reduced}>
                        <TextShimmer>{`Creating contact and deal in ${crmName}`}</TextShimmer>
                      </Swap>
                    ) : state === "done" ? (
                      <Swap
                        id={`done-${crm}`}
                        reduced={reduced}
                        className={styles.statusDone}
                      >
                        <Check size={14} aria-hidden="true" />
                        Contact and deal created in {crmName}
                      </Swap>
                    ) : state === "error" ? (
                      <Swap
                        id={`error-${crm}`}
                        reduced={reduced}
                        className={styles.statusError}
                      >
                        <CircleX size={14} aria-hidden="true" />
                        {crmName} did not respond
                      </Swap>
                    ) : (
                      <Swap id={`idle-${crm}`} reduced={reduced}>
                        Creates a contact and an open deal
                      </Swap>
                    )}
                  </AnimatePresence>
                </p>
                <div className={styles.actions}>
                  {crms.length > 1 && (
                    <CrmPicker crms={crms} value={crm} onChange={onCrmChange} />
                  )}
                  <Button
                    size="sm"
                    variant={state === "done" ? "secondary" : "primary"}
                    loading={state === "pushing"}
                    disabled={scoring}
                    aria-disabled={state === "done" || undefined}
                    onClick={() => {
                      if (state !== "done" && state !== "pushing") onPush();
                    }}
                  >
                    {state === "done" ? (
                      <>
                        <Check size={14} aria-hidden="true" />
                        In {crmName}
                      </>
                    ) : state === "error" ? (
                      <>
                        <RotateCcw size={14} aria-hidden="true" />
                        Try again
                      </>
                    ) : state === "pushing" ? (
                      "Pushing"
                    ) : (
                      `Push to ${crmName}`
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Lead scoring
 * ---------------------------------------------------------------------------------------------- */

/**
 * A card of inbound leads ranked by an AI fit score. Each row shows the company mark, the person, a score ring and
 * the model's one-line reason; opening a row shows signal chips, the weighted score breakdown and a push to HubSpot
 * or Salesforce. With no props it plays a short intro on first view with sample leads and simulated pushes.
 */
export function LeadScoring({
  leads,
  title = "Inbound leads",
  description,
  sort,
  defaultSort,
  onSortChange,
  crms = ["hubspot", "salesforce"],
  onPush,
  onRescore,
  autoPlay,
  defaultExpandedId = null,
  className,
}: LeadScoringProps) {
  const reduced = useReducedMotion() ?? false;
  const sample = leads === undefined;
  const autoplay = autoPlay ?? sample;
  const data = leads ?? leadScoringSamples;
  const [sortState, setSortState] = useState<LeadSort>(
    defaultSort ?? (autoplay ? "newest" : "score"),
  );
  const activeSort = sort ?? sortState;
  const [expandedId, setExpandedId] = useState<string | null>(
    defaultExpandedId,
  );
  const [crm, setCrm] = useState<LeadCrmId>(crms[0] ?? "hubspot");
  const [pushMap, setPushMap] = useState<Record<string, LeadPushState>>({});
  const [scoringIds, setScoringIds] = useState<Set<string>>(() =>
    sample && autoplay ? new Set(data.map((lead) => lead.id)) : new Set(),
  );
  const [offscreen, setOffscreen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const sectionRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const introTimers = useRef<number[]>([]);
  const scoreTimers = useRef<number[]>([]);
  const pushes = useRef(new Map<string, AbortController>());
  const played = useRef(false);

  const isScoring = useCallback(
    (lead: Lead) => (sample ? scoringIds.has(lead.id) : Boolean(lead.scoring)),
    [sample, scoringIds],
  );

  const ordered = useMemo(
    () =>
      activeSort === "newest"
        ? data
        : [...data].sort((a, b) => leadScore(b) - leadScore(a)),
    [data, activeSort],
  );

  const changeSort = useCallback(
    (next: LeadSort) => {
      if (sort === undefined) setSortState(next);
      onSortChange?.(next);
    },
    [sort, onSortChange],
  );

  const pushStateOf = useCallback(
    (lead: Lead, target: LeadCrmId) =>
      pushMap[`${lead.id}:${target}`] ??
      (lead.pushedTo?.includes(target) ? "done" : "idle"),
    [pushMap],
  );

  const push = useCallback(
    async (lead: Lead, target: LeadCrmId) => {
      const key = `${lead.id}:${target}`;
      pushes.current.get(key)?.abort();
      const controller = new AbortController();
      pushes.current.set(key, controller);
      const crmName = CRM_NAMES[target];
      setPushMap((current) => ({ ...current, [key]: "pushing" }));
      setAnnounce(`Pushing ${lead.name} to ${crmName}`);
      try {
        if (onPush) {
          await onPush(lead, target, controller.signal);
        } else {
          await new Promise<void>((resolve, reject) => {
            const timer = window.setTimeout(resolve, 900);
            controller.signal.addEventListener(
              "abort",
              () => {
                window.clearTimeout(timer);
                reject(new DOMException("Aborted", "AbortError"));
              },
              { once: true },
            );
          });
        }
        if (controller.signal.aborted) return;
        setPushMap((current) => ({ ...current, [key]: "done" }));
        setAnnounce(
          `${lead.name} added to ${crmName} with an open deal.${onPush ? "" : " Simulated, nothing was sent."}`,
        );
      } catch {
        if (controller.signal.aborted) return;
        setPushMap((current) => ({ ...current, [key]: "error" }));
        setAnnounce(`${crmName} did not respond. ${lead.name} was not pushed.`);
      } finally {
        if (pushes.current.get(key) === controller) pushes.current.delete(key);
      }
    },
    [onPush],
  );

  // Pushes in flight and pending timers never outlive the card.
  useEffect(() => {
    const controllers = pushes.current;
    return () => {
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
      introTimers.current.forEach(window.clearTimeout);
      scoreTimers.current.forEach(window.clearTimeout);
    };
  }, []);

  const landScores = useCallback((list: Lead[], delay: number) => {
    scoreTimers.current.forEach(window.clearTimeout);
    scoreTimers.current = list.map((lead, index) =>
      window.setTimeout(
        () => {
          setScoringIds((current) => {
            const next = new Set(current);
            next.delete(lead.id);
            return next;
          });
        },
        delay + 35 * index,
      ),
    );
  }, []);

  const stopIntro = useCallback(() => {
    introTimers.current.forEach(window.clearTimeout);
    introTimers.current = [];
  }, []);

  const rescore = useCallback(() => {
    onRescore?.();
    if (!sample) return;
    setScoringIds(new Set(data.map((lead) => lead.id)));
    setAnnounce("Rescoring leads");
    landScores(ordered, 700);
    scoreTimers.current.push(
      window.setTimeout(
        () => setAnnounce("Leads rescored. Simulated with sample data."),
        700 + 35 * ordered.length + 640,
      ),
    );
  }, [sample, ordered, onRescore, landScores, data]);

  // The intro runs once, the first time the card is a third of the way into the view.
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setOffscreen(!entry.isIntersecting);
        if (!entry.isIntersecting || played.current || !autoplay) return;
        played.current = true;
        if (sample) landScores(data, 650);
        const top = [...data].sort((a, b) => leadScore(b) - leadScore(a))[0];
        const at = (ms: number, fn: () => void) =>
          introTimers.current.push(window.setTimeout(fn, ms));
        at(1750, () => changeSort("score"));
        if (!top) return;
        at(2550, () => setExpandedId(top.id));
        const first = crms[0];
        if (first) at(3650, () => void push(top, first));
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scoringCount = data.filter(isScoring).length;
  const meta = description ?? (
    <>
      <ModelMark width={14} height={14} className={styles.metaMark} />
      <span className={styles.metaText}>
        <AnimatePresence initial={false}>
          {scoringCount ? (
            <Swap
              id="scoring"
              reduced={reduced}
            >{`Scoring ${data.length} leads with Claude Sonnet 5.5`}</Swap>
          ) : (
            <Swap
              id="scored"
              reduced={reduced}
            >{`${data.length} new today, scored by Claude Sonnet 5.5`}</Swap>
          )}
        </AnimatePresence>
      </span>
    </>
  );

  return (
    <section
      ref={sectionRef}
      className={join(styles.root, className)}
      aria-label={title}
      data-offscreen={offscreen || undefined}
      onPointerDownCapture={stopIntro}
      onKeyDownCapture={stopIntro}
    >
      <header className={styles.head}>
        <div className={styles.headText}>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.meta}>{meta}</p>
        </div>
        <div className={styles.headActions}>
          <SegmentedControl
            label="Sort leads"
            value={activeSort}
            onValueChange={(next) => changeSort(next as LeadSort)}
            options={[
              { value: "score", label: "Score" },
              { value: "newest", label: "Newest" },
            ]}
          />
          {(sample || onRescore) && (
            <Tooltip content="Rescore">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Rescore leads"
                className={styles.iconButton}
                onClick={rescore}
                disabled={scoringCount > 0}
              >
                <RotateCcw size={16} aria-hidden="true" />
              </Button>
            </Tooltip>
          )}
        </div>
      </header>
      {ordered.length ? (
        <ul
          ref={listRef}
          className={styles.list}
          onKeyDown={(event) => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
              return;
            const rows = Array.from(
              listRef.current?.querySelectorAll<HTMLElement>("[data-row]") ??
                [],
            );
            const index = rows.indexOf(document.activeElement as HTMLElement);
            if (index < 0) return;
            event.preventDefault();
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? rows.length - 1
                  : Math.max(
                      0,
                      Math.min(
                        rows.length - 1,
                        index + (event.key === "ArrowDown" ? 1 : -1),
                      ),
                    );
            rows[next]?.focus();
          }}
        >
          {ordered.map((lead) => (
            <LeadRow
              key={lead.id}
              lead={lead}
              scoring={isScoring(lead)}
              expanded={expandedId === lead.id}
              onToggle={() =>
                setExpandedId((current) =>
                  current === lead.id ? null : lead.id,
                )
              }
              crms={crms}
              crm={crm}
              onCrmChange={setCrm}
              pushState={(target) => pushStateOf(lead, target)}
              onPush={() => {
                void push(lead, crm);
              }}
              reduced={reduced}
            />
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No new leads</p>
          <p className={styles.emptyText}>
            Inbound leads are scored here as they arrive.
          </p>
        </div>
      )}
      <p className={styles.srOnly} aria-live="polite">
        {announce}
      </p>
    </section>
  );
}

export default LeadScoring;
