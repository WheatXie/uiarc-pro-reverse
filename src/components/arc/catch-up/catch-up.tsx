"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Check, CircleAlert, Info, PackageCheck, Scale, type LucideIcon } from "lucide-react";
import SegmentedControl from "../segmented-control/segmented-control";
import { Button } from "../button/button";
import Tooltip from "../tooltip/tooltip";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { motionTokens } from "../motion-tokens";
import styles from "./catch-up.module.css";

/* ------------------------------------------------------------------ data model */

export type CatchUpSource = "slack" | "linear" | "github" | "gmail";
export type CatchUpSection = "needs-you" | "decisions" | "shipped" | "fyi";

export interface CatchUpPerson {
  name: string;
  /** Square avatar image. Without one the row falls back to initials. */
  avatar?: string;
}

export interface CatchUpItem {
  id: string;
  section: CatchUpSection;
  source: CatchUpSource;
  /** One or two calm sentences. Rendered word by word while the digest streams in. */
  text: string;
  /** Where it happened, such as a channel or issue key. */
  context?: string;
  /** Short timestamp already formatted for display. */
  when?: string;
  people?: CatchUpPerson[];
  /** Deep link used by the "Open in" affordance. Without it the action only simulates. */
  href?: string;
}

export interface CatchUpRange {
  value: string;
  label: string;
  /** Grounding date for the summary line, such as "Fri 24 Oct". */
  since?: string;
}

export type CatchUpCounts = Record<string, Partial<Record<CatchUpSource, number>>>;

export interface CatchUpModel {
  name: string;
  /** Mark shown before the model name. */
  mark?: ReactNode;
}

export interface CatchUpProps {
  /** Resolves the digest for a range. Leave it out to run the simulated demo, which shows nothing was read from real accounts. */
  generate?: (range: string, signal: AbortSignal) => Promise<CatchUpItem[]>;
  /** Time windows offered in the segmented control. */
  ranges?: CatchUpRange[];
  /** Controlled range. Pair it with `onRangeChange`. */
  range?: string;
  /** Range used when the component owns the selection. */
  defaultRange?: string;
  onRangeChange?: (range: string) => void;
  /** Per-range totals shown before anything is read. */
  counts?: CatchUpCounts;
  /** Receives the row a person asks to open. Without it the open action is simulated. */
  onOpen?: (item: CatchUpItem) => void;
  /** Receives the ids that were just marked read. */
  onMarkRead?: (ids: string[]) => void;
  model?: CatchUpModel;
  title?: string;
  /** Start the digest when the block scrolls into view. Defaults to true for the simulated demo. */
  autoStart?: boolean;
  /**
   * Digest that is already resolved. Demos and static previews boot straight into the settled state
   * instead of streaming, so the block renders its finished layout on first paint.
   */
  initialItems?: CatchUpItem[];
  className?: string;
}

/* ------------------------------------------------------------------ static copy */

const SOURCES = ["slack", "linear", "github", "gmail"] as const;
const SECTIONS = ["needs-you", "decisions", "shipped", "fyi"] as const;

const SOURCE_NAMES: Record<CatchUpSource, string> = {
  slack: "Slack",
  linear: "Linear",
  github: "GitHub",
  gmail: "Gmail",
};

const SOURCE_NOUNS: Record<CatchUpSource, readonly [string, string]> = {
  slack: ["message", "messages"],
  linear: ["issue", "issues"],
  github: ["PR", "PRs"],
  gmail: ["thread", "threads"],
};

const SECTION_LABELS: Record<CatchUpSection, string> = {
  "needs-you": "Needs you",
  decisions: "Decisions made",
  shipped: "Shipped",
  fyi: "FYI",
};

const SECTION_ICONS: Record<CatchUpSection, LucideIcon> = {
  "needs-you": CircleAlert,
  decisions: Scale,
  shipped: PackageCheck,
  fyi: Info,
};

const plural = (count: number, [one, many]: readonly [string, string]) => `${count} ${count === 1 ? one : many}`;

const countTotal = (counts: Partial<Record<CatchUpSource, number>>) => SOURCES.reduce((sum, source) => sum + (counts[source] ?? 0), 0);

/* ------------------------------------------------------------------ motion */

const EASE: [number, number, number, number] = [...motionTokens.ease.standard];
const BODY_IN = { duration: 0.2, ease: EASE };
const SWAP_IN = { duration: 0.16, ease: EASE };
const SWAP_OUT = { duration: 0.1, ease: EASE };
const SECTION_OUT = { duration: 0.2, ease: EASE };
const BODY_OUT = { duration: 0.1, ease: EASE };
const HEIGHT_SPRING = { type: "spring" as const, visualDuration: 0.24, bounce: 0 };
const INSTANT = { duration: 0 };

/* ------------------------------------------------------------------ source marks */

const MARKS: Record<CatchUpSource, { label: string; fills?: string[]; stroke?: string; d: string[] }> = {
  slack: {
    label: "Slack",
    fills: ["#E01E5A", "#36C5F0", "#2EB67D", "#ECB22E"],
    d: [
      "M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z",
      "M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z",
      "M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z",
      "M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z",
    ],
  },
  linear: {
    label: "Linear",
    fills: ["#5E6AD2"],
    d: [
      "M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z",
    ],
  },
  github: {
    label: "GitHub",
    stroke: "currentColor",
    d: [
      "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
    ],
  },
  gmail: {
    label: "Gmail",
    fills: ["#EA4335"],
    d: [
      "M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z",
    ],
  },
};

const CLAUDE_PATH =
  "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z";

function ClaudeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="#D97757" role="img" aria-label="Claude" aria-hidden="true" className={className}>
      <path d={CLAUDE_PATH} />
    </svg>
  );
}

const DEFAULT_MODEL: CatchUpModel = { name: "Claude Haiku 5.5", mark: <ClaudeMark className={styles.modelMark} /> };

function SourceMark({ source, className }: { source: CatchUpSource; className?: string }) {
  const mark = MARKS[source];
  return (
    <svg viewBox="0 0 24 24" fill={mark.stroke} aria-label={mark.label} className={className} aria-hidden="true">
      {mark.d.map((d, index) => (
        <path key={index} fill={mark.fills?.[index]} d={d} />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ demo data */

const person = (name: string, slug: string): CatchUpPerson => ({ name, avatar: `/media/people/${slug}.svg` });

const nathanCole = person("Nathan Cole", "nathan-cole");
const dianeFoster = person("Diane Foster", "diane-foster");
const avaMitchell = person("Ava Mitchell", "ava-mitchell");
const jasmineBrooks = person("Jasmine Brooks", "jasmine-brooks");
const emmaCollins = person("Emma Collins", "emma-collins");
const marcusJohnson = person("Marcus Johnson", "marcus-johnson");
const oliviaBennett = person("Olivia Bennett", "olivia-bennett");
const danielKim = person("Daniel Kim", "daniel-kim");
const chloeNguyen = person("Chloe Nguyen", "chloe-nguyen");
const andreWilliams = person("Andre Williams", "andre-williams");
const ryanSullivan = person("Ryan Sullivan", "ryan-sullivan");
const tylerHayes = person("Tyler Hayes", "tyler-hayes");
const hannahWalsh = person("Hannah Walsh", "hannah-walsh");
const jordanReyes = person("Jordan Reyes", "jordan-reyes");

interface DemoEntry extends CatchUpItem {
  age: number;
}

const DEMO_ITEMS: DemoEntry[] = [
  {
    id: "eng-2814",
    age: 1.4,
    section: "needs-you",
    source: "linear",
    text: "Nathan wants a fix plan for the checkout timeout before Tuesday's release cut.",
    context: "ENG-2814",
    when: "07:48",
    people: [nathanCole],
  },
  {
    id: "pricing-copy",
    age: 20,
    section: "needs-you",
    source: "slack",
    text: "Diane needs your sign-off on the Q4 pricing page copy by noon today.",
    context: "#launch-q4",
    when: "Sun 13:10",
    people: [dianeFoster, avaMitchell],
  },
  {
    id: "stripe-tax",
    age: 94,
    section: "needs-you",
    source: "gmail",
    text: "Stripe needs an updated tax ID by 31 Oct to keep payouts running.",
    context: "Stripe billing",
    when: "Thu 11:05",
    people: [andreWilliams],
  },
  {
    id: "dark-mode",
    age: 41,
    section: "decisions",
    source: "slack",
    text: "Dark mode ships behind a flag first, and the beta waitlist is dropped.",
    context: "#design-system",
    when: "Sat 16:40",
    people: [jasmineBrooks, emmaCollins, marcusJohnson],
  },
  {
    id: "infra-412",
    age: 60,
    section: "decisions",
    source: "linear",
    text: "The Postgres 17 upgrade moves to November so the release keeps its date.",
    context: "INFRA-412",
    when: "Fri 21:05",
    people: [oliviaBennett, danielKim],
  },
  {
    id: "northwind-dpa",
    age: 90,
    section: "decisions",
    source: "gmail",
    text: "Legal approved the revised Northwind DPA, so the contract goes out this week.",
    context: "Re: Northwind DPA",
    when: "Thu 15:20",
    people: [andreWilliams, ryanSullivan],
  },
  {
    id: "pr-1482",
    age: 3,
    section: "shipped",
    source: "github",
    text: "The new onboarding flow is merged and preview deploys are green.",
    context: "web #1482",
    when: "06:02",
    people: [marcusJohnson],
  },
  {
    id: "api-2-14",
    age: 45,
    section: "shipped",
    source: "github",
    text: "API v2.14 is live with rate limit headers and 38% faster search.",
    context: "api v2.14.0",
    when: "Sat 12:10",
    people: [danielKim, chloeNguyen],
  },
  {
    id: "acme-renewal",
    age: 22,
    section: "fyi",
    source: "gmail",
    text: "Acme renewed for two years at $84k ARR, with Ryan running the kickoff.",
    context: "Acme renewal",
    when: "Sun 11:10",
    people: [ryanSullivan, tylerHayes],
  },
  {
    id: "support-volume",
    age: 66,
    section: "fyi",
    source: "slack",
    text: "Support tickets are up 18% since the pricing email, mostly about seat limits.",
    context: "#support",
    when: "Fri 15:20",
    people: [hannahWalsh, jordanReyes],
  },
];

const DEMO_DAYS: Record<string, number> = { "1d": 24, "3d": 72, "1w": 168 };

/** Time windows offered by the simulated demo. */
export const demoRanges: CatchUpRange[] = [
  { value: "1d", label: "1 day", since: "Sun 26 Oct" },
  { value: "3d", label: "3 days", since: "Fri 24 Oct" },
  { value: "1w", label: "1 week", since: "Mon 20 Oct" },
];

/** Per-range totals the demo shows before anything is read. */
export const demoCounts: CatchUpCounts = {
  "1d": { slack: 31, linear: 9, github: 6, gmail: 4 },
  "3d": { slack: 86, linear: 31, github: 18, gmail: 7 },
  "1w": { slack: 214, linear: 77, github: 46, gmail: 19 },
};

/** The simulated digest for a range: everything inside the window, oldest window first. */
export const demoDigest = (range: string): CatchUpItem[] =>
  DEMO_ITEMS.filter(item => item.age <= (DEMO_DAYS[range] ?? 72)).map(({ age: _age, ...item }) => item);

/* ------------------------------------------------------------------ layout maths */

interface Layout {
  sections: { id: CatchUpSection; items: CatchUpItem[] }[];
  entries: Map<string, { start: number; words: string[] }>;
  starts: Map<CatchUpSection, number>;
  order: CatchUpItem[];
  end: number;
}

function buildLayout(items: CatchUpItem[]): Layout {
  const sections = SECTIONS.map(id => ({ id, items: items.filter(item => item.section === id) })).filter(section => section.items.length);
  const entries = new Map<string, { start: number; words: string[] }>();
  const starts = new Map<CatchUpSection, number>();
  let cursor = 0;
  for (const section of sections) {
    starts.set(section.id, cursor);
    for (const item of section.items) {
      const words = item.text.split(/\s+/).filter(Boolean);
      entries.set(item.id, { start: cursor, words });
      cursor += words.length + 3;
    }
  }
  return { sections, entries, starts, order: sections.flatMap(section => section.items), end: cursor };
}

/* ------------------------------------------------------------------ small parts */

function Swap({ id, reduced, className, children }: { id: string; reduced: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={[styles.swap, className].filter(Boolean).join(" ")}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0, transition: SWAP_IN }}
          exit={{ opacity: 0, transition: SWAP_OUT }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function AutoHeight({ children, reduced, instant }: { children: ReactNode; reduced: boolean; instant: boolean }) {
  const measure = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const node = measure.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setHeight(entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <motion.div className={styles.autoHeight} initial={false} animate={{ height }} transition={reduced || instant ? INSTANT : HEIGHT_SPRING}>
      <div ref={measure}>{children}</div>
    </motion.div>
  );
}

function Face({ person }: { person: CatchUpPerson }) {
  const initials = person.name
    .split(/\s+/)
    .map(part => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return person.avatar ? (
    <img className={styles.face} src={person.avatar} alt="" title={person.name} width={18} height={18} loading="lazy" decoding="async" />
  ) : (
    <span className={styles.face} title={person.name} aria-hidden="true">
      {initials}
    </span>
  );
}

interface RowProps {
  item: CatchUpItem;
  words: string[];
  shown: number;
  started: boolean;
  uid: string;
  hrefMode: boolean;
  onOpen: () => void;
  onRead: () => void;
}

function Row({ item, words, shown, started, uid, hrefMode, onOpen, onRead }: RowProps) {
  const complete = shown >= words.length;
  const people = item.people ?? [];
  const first = people[0]?.name;
  const metaParts = [first ? `${first}${people.length > 1 ? ` +${people.length - 1}` : ""}` : "", item.context ?? "", item.when ?? ""].filter(Boolean);
  const sourceName = SOURCE_NAMES[item.source];
  const openLabel = `Open in ${sourceName}`;
  const gating = { tabIndex: complete ? 0 : -1, "aria-hidden": !complete || undefined };
  const arrow = <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />;
  return (
    <div className={styles.row} data-started={started || undefined} data-complete={complete || undefined}>
      <SourceMark source={item.source} className={`${styles.mark} ${styles.rowMark}`} />
      <div className={styles.rowBody}>
        <p className={styles.text} aria-hidden={!started || undefined}>
          <span className={styles.srOnly}>{`${sourceName}: `}</span>
          {words.map((word, index) => (
            <span key={index} className={styles.word} data-on={index < shown || undefined}>
              {word}
              {index < words.length - 1 ? " " : ""}
            </span>
          ))}
          <span className={styles.skeletonText} aria-hidden="true" />
        </p>
        <p className={styles.meta} aria-hidden={!complete || undefined}>
          {people.length ? (
            <span className={styles.faces}>
              {people.slice(0, 3).map(person => (
                <Face key={person.name} person={person} />
              ))}
            </span>
          ) : null}
          <span className={styles.metaText}>{metaParts.join(" · ")}</span>
          <span className={styles.skeletonMeta} aria-hidden="true" />
        </p>
      </div>
      <div className={styles.actions}>
        <Tooltip content={openLabel}>
          {hrefMode ? (
            <a className={styles.iconButton} href={item.href} target="_blank" rel="noreferrer" aria-label={openLabel} {...gating}>
              {arrow}
            </a>
          ) : (
            <button type="button" className={styles.iconButton} aria-label={openLabel} onClick={onOpen} {...gating}>
              {arrow}
            </button>
          )}
        </Tooltip>
        <Tooltip content="Mark as read">
          <button type="button" id={`${uid}-read-${item.id}`} className={styles.iconButton} aria-label="Mark as read" onClick={onRead} {...gating}>
            <Check size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ the block */

type Phase = "idle" | "reading" | "streaming" | "ready" | "done" | "empty" | "error";

/**
 * One calm digest across every source a person connected: what needs them, what was decided, what shipped, and what is only FYI.
 * The block reads the sources on mount, streams the digest in word by word, then lets the reader clear rows one at a time — focus
 * moves to the next unread row so the keyboard flow survives the exit animation. Everything in the simulated demo is local: no
 * account is read and nothing is marked anywhere.
 */
export function CatchUp({
  generate,
  ranges = demoRanges,
  range,
  defaultRange,
  onRangeChange,
  counts = demoCounts,
  onOpen,
  onMarkRead,
  model = DEFAULT_MODEL,
  title = "Welcome back",
  autoStart,
  initialItems,
  className,
}: CatchUpProps) {
  const uid = useId();
  const reduced = useReducedMotion() ?? false;
  const simulated = !generate;

  const [localRange, setLocalRange] = useState(() => defaultRange ?? ranges[1]?.value ?? ranges[0]?.value ?? "");
  const value = range ?? localRange;
  const activeRange = ranges.find(option => option.value === value) ?? ranges[0];
  const total = countTotal(counts[value] ?? {});

  const seeded = initialItems && initialItems.length ? initialItems : null;
  const seededNeedsYou = seeded ? seeded.filter(item => item.section === "needs-you").length : 0;
  const [phase, setPhase] = useState<Phase>(seeded ? "ready" : "idle");
  const [items, setItems] = useState<CatchUpItem[]>(seeded ?? []);
  const [read, setRead] = useState<Set<string>>(() => new Set());
  const [shown, setShown] = useState(() => (seeded ? buildLayout(seeded).end : 0));
  const [sourcesRead, setSourcesRead] = useState(seeded ? SOURCES.length : 0);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState(() =>
    seeded
      ? `Digest ready: ${plural(seeded.length, ["item", "items"])}, ${seededNeedsYou} ${seededNeedsYou === 1 ? "needs" : "need"} you.${
          simulated ? " Simulated, nothing was read from your accounts." : ""
        }`
      : "",
  );
  const [flash, setFlash] = useState("");
  const [instant, setInstant] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const autoRan = useRef(false);
  const timers = useRef({ instant: 0, flash: 0 });

  const layout = useMemo(() => buildLayout(items), [items]);
  const visible = useMemo(() => layout.order.filter(item => !read.has(item.id)), [layout, read]);
  const needsYou = items.filter(item => item.section === "needs-you").length;

  const run = useCallback(
    async (next: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;
      const label = ranges.find(option => option.value === next)?.label ?? next;
      const nextTotal = countTotal(counts[next] ?? {});
      setPhase("reading");
      setItems([]);
      setRead(new Set());
      setShown(0);
      setError("");
      setFlash("");
      setSourcesRead(reduced ? SOURCES.length : 0);
      setAnnouncement(`Reading ${nextTotal} updates from the last ${label}.`);
      const ticker = reduced ? 0 : window.setInterval(() => setSourcesRead(current => Math.min(SOURCES.length, current + 1)), 170);
      const started = performance.now();
      try {
        const result = generate ? await generate(next, signal) : demoDigest(next);
        const wait = 860 - (performance.now() - started);
        if (wait > 0 && !reduced) {
          await new Promise<void>(resolve => {
            const timer = window.setTimeout(resolve, wait);
            signal.addEventListener(
              "abort",
              () => {
                window.clearTimeout(timer);
                resolve();
              },
              { once: true },
            );
          });
        }
        if (signal.aborted) return;
        setSourcesRead(SOURCES.length);
        setItems(result);
        if (!result.length) {
          setPhase("empty");
          setAnnouncement(`Nothing needs you from the last ${label}.`);
          return;
        }
        setPhase("streaming");
      } catch (cause) {
        if (signal.aborted) return;
        setPhase("error");
        setError(cause instanceof Error && cause.message ? cause.message : "One of your sources did not respond.");
        setAnnouncement("Couldn't build your digest.");
      } finally {
        window.clearInterval(ticker);
      }
    },
    [counts, generate, ranges, reduced],
  );

  // Words arrive a few at a time, so a long digest stays readable instead of appearing all at once.
  useEffect(() => {
    if (phase !== "streaming") return;
    let cursor = 0;
    let timer = 0;
    const step = () => {
      cursor = reduced ? layout.end : Math.min(layout.end, cursor + 4);
      setShown(cursor);
      if (cursor < layout.end) {
        timer = window.setTimeout(step, 34);
        return;
      }
      setPhase("ready");
      setAnnouncement(
        `Digest ready: ${plural(layout.order.length, ["item", "items"])}, ${needsYou} ${needsYou === 1 ? "needs" : "need"} you.${
          simulated ? " Simulated, nothing was read from your accounts." : ""
        }`,
      );
    };
    timer = window.setTimeout(step, 34 * (reduced ? 0 : 1));
    return () => window.clearTimeout(timer);
  }, [phase, reduced, layout, needsYou, simulated]);

  // The digest starts once the block is properly on screen, not while it is only half scrolled into view.
  const auto = (autoStart ?? simulated) && !seeded;
  useEffect(() => {
    const node = rootRef.current;
    if (!auto || !node || typeof IntersectionObserver === "undefined") return;
    let timer = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || autoRan.current) return;
        autoRan.current = true;
        observer.disconnect();
        timer = window.setTimeout(() => void run(value), 700);
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [auto, run, value]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      window.clearTimeout(timers.current.instant);
      window.clearTimeout(timers.current.flash);
    },
    [],
  );

  const markRead = (ids: string[], focusId?: string) => {
    const next = new Set(read);
    ids.forEach(id => next.add(id));
    const remaining = layout.order.filter(item => !next.has(item.id));
    onMarkRead?.(ids);
    if (!remaining.length) {
      setRead(next);
      setPhase("done");
      setAnnouncement(`You're all caught up.${simulated ? " Simulated, nothing was changed in your apps." : ""}`);
      requestAnimationFrame(() => actionRef.current?.focus());
      return;
    }
    setInstant(true);
    window.clearTimeout(timers.current.instant);
    timers.current.instant = window.setTimeout(() => setInstant(false), 320);
    setRead(next);
    setAnnouncement(`Marked as read. ${remaining.length} left.`);
    if (focusId) {
      const index = visible.findIndex(item => item.id === focusId);
      const target = visible.slice(index + 1).find(item => !next.has(item.id)) ?? visible.slice(0, index).reverse().find(item => !next.has(item.id));
      if (target) requestAnimationFrame(() => document.getElementById(`${uid}-read-${target.id}`)?.focus());
    }
  };

  const action =
    phase === "reading" || phase === "streaming"
      ? ({ label: "Stop", variant: "secondary" } as const)
      : phase === "ready"
        ? ({ label: "Mark all as read", variant: "primary" } as const)
        : phase === "error"
          ? ({ label: "Try again", variant: "primary" } as const)
          : phase === "done" || phase === "empty"
            ? ({ label: "Start over", variant: "secondary" } as const)
            : ({ label: `Catch up on ${activeRange?.label ?? ""}`.trim(), variant: "primary" } as const);

  const since = activeRange?.since ?? "";
  const summary =
    phase === "reading"
      ? `Reading ${total} updates`
      : phase === "streaming" || phase === "ready"
        ? `${layout.order.length} worth your time, from ${total} updates`
        : phase === "done"
          ? `All ${layout.order.length} cleared, from ${total} updates`
          : phase === "empty"
            ? `Nothing new since ${since}`
            : `${total} updates since ${since}`;

  const view = phase === "streaming" || phase === "ready" ? "digest" : phase === "done" || phase === "empty" || phase === "error" ? phase : "sources";

  const openItem = (item: CatchUpItem) => {
    if (onOpen) {
      onOpen(item);
      return;
    }
    const label = `${item.context ? `${item.context} in ` : ""}${SOURCE_NAMES[item.source]}`;
    if (!item.href) {
      setFlash(`Would open ${label}`);
      window.clearTimeout(timers.current.flash);
      timers.current.flash = window.setTimeout(() => setFlash(""), 2400);
      setAnnouncement(`Simulated, would open ${label}.`);
    }
  };

  const onAction = () => {
    if (phase === "reading" || phase === "streaming") {
      abortRef.current?.abort();
      setPhase("idle");
      setItems([]);
      setShown(0);
      setSourcesRead(0);
      setAnnouncement("Stopped.");
      return;
    }
    if (phase === "ready") {
      markRead(visible.map(item => item.id));
      return;
    }
    if (phase === "done" || phase === "empty") {
      setPhase("idle");
      setItems([]);
      setRead(new Set());
      setShown(0);
      setSourcesRead(0);
      setAnnouncement("");
      return;
    }
    void run(value);
  };

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} data-phase={phase}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 className={styles.title}>{title}</h2>
          <Swap id={summary} reduced={reduced} className={styles.summary}>
            {phase === "reading" ? <TextShimmer className={styles.shimmer}>{summary}</TextShimmer> : summary}
          </Swap>
        </div>
        <SegmentedControl
          className={styles.ranges}
          label="Time range"
          value={value}
          onValueChange={next => {
            if (next === value) return;
            if (range === undefined) setLocalRange(next);
            onRangeChange?.(next);
            autoRan.current = true;
            if (phase !== "idle") void run(next);
          }}
          options={ranges.map(option => ({ value: option.value, label: option.label }))}
        />
      </header>

      <AutoHeight reduced={reduced} instant={instant}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            className={styles.body}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: BODY_IN }}
            exit={{ opacity: 0, transition: BODY_OUT }}
          >
            {view === "sources" ? (
              <ul className={styles.sources} aria-label="Sources">
                {SOURCES.map((source, index) => {
                  const count = counts[value]?.[source] ?? 0;
                  const state = phase === "reading" ? (index < sourcesRead ? "read" : "reading") : "idle";
                  return (
                    <li key={source} className={styles.source}>
                      <SourceMark source={source} className={styles.mark} />
                      <span className={styles.sourceText}>
                        <span className={styles.sourceName}>{SOURCE_NAMES[source]}</span>
                        <Swap id={`${value}-${count}`} reduced={reduced} className={styles.sourceCount}>
                          {plural(count, SOURCE_NOUNS[source])}
                        </Swap>
                      </span>
                      <span className={styles.sourceState} aria-hidden="true">
                        <AnimatePresence initial={false}>
                          {state === "reading" ? (
                            <motion.span key="reading" className={styles.spinner} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SWAP_IN} />
                          ) : null}
                          {state === "read" ? (
                            <motion.span
                              key="read"
                              className={styles.checkIcon}
                              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0 }}
                              transition={SWAP_IN}
                            >
                              <Check size={14} strokeWidth={2.25} aria-hidden="true" />
                            </motion.span>
                          ) : null}
                        </AnimatePresence>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {view === "digest" ? (
              <div className={styles.digest}>
                <AnimatePresence initial={false}>
                  {layout.sections.map(section => {
                    const remaining = section.items.filter(item => !read.has(item.id));
                    if (!remaining.length) return null;
                    const Icon = SECTION_ICONS[section.id];
                    const headingId = `${uid}-${section.id}`;
                    return (
                      <motion.section
                        key={section.id}
                        className={styles.section}
                        aria-labelledby={headingId}
                        initial={false}
                        exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        transition={SECTION_OUT}
                      >
                        <div className={styles.sectionInner}>
                          <h3 id={headingId} className={styles.sectionHead} data-section={section.id} data-on={shown >= (layout.starts.get(section.id) ?? 0) || undefined}>
                            <Icon size={14} strokeWidth={2} aria-hidden="true" className={styles.sectionIcon} />
                            <span>{SECTION_LABELS[section.id]}</span>
                            <Swap id={String(remaining.length)} reduced={reduced} className={styles.sectionCount}>
                              {remaining.length}
                            </Swap>
                          </h3>
                          <ul className={styles.items}>
                            <AnimatePresence initial={false}>
                              {remaining.map(item => {
                                const entry = layout.entries.get(item.id) ?? { start: 0, words: [] };
                                return (
                                  <motion.li
                                    key={item.id}
                                    className={styles.item}
                                    initial={false}
                                    exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                                    transition={SECTION_OUT}
                                  >
                                    <Row
                                      item={item}
                                      words={entry.words}
                                      shown={Math.max(0, Math.min(entry.words.length, shown - entry.start))}
                                      started={shown > entry.start}
                                      uid={uid}
                                      hrefMode={Boolean(item.href && !onOpen)}
                                      onOpen={() => openItem(item)}
                                      onRead={() => markRead([item.id], item.id)}
                                    />
                                  </motion.li>
                                );
                              })}
                            </AnimatePresence>
                          </ul>
                        </div>
                      </motion.section>
                    );
                  })}
                </AnimatePresence>
              </div>
            ) : null}

            {view === "done" || view === "empty" || view === "error" ? (
              <div className={styles.outcome} data-tone={phase === "error" ? "danger" : "success"}>
                {phase === "error" ? (
                  <CircleAlert size={16} strokeWidth={2} aria-hidden="true" className={styles.outcomeIcon} />
                ) : (
                  <Check size={16} strokeWidth={2.25} aria-hidden="true" className={styles.outcomeIcon} />
                )}
                <p className={styles.outcomeTitle}>{phase === "error" ? "Couldn't build your digest" : phase === "empty" ? "Nothing needs you" : "You're all caught up"}</p>
                <p className={styles.outcomeText}>
                  {phase === "error" ? error : phase === "empty" ? `${total} updates, none worth your time.` : "Your next digest is ready tomorrow at 09:00."}
                </p>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </AutoHeight>

      <footer className={styles.footer}>
        <Swap id={flash || "model"} reduced={reduced} className={styles.status}>
          {flash ? (
            <>
              <ArrowUpRight size={14} strokeWidth={2} aria-hidden="true" className={styles.statusIcon} />
              <span className={styles.statusText}>
                {flash}
                <span className={styles.simTag}> · simulated</span>
              </span>
            </>
          ) : (
            <>
              {model.mark ?? null}
              <span className={styles.statusText}>{model.name}</span>
            </>
          )}
        </Swap>
        <Button ref={actionRef} className={styles.action} variant={action.variant} onClick={onAction}>
          {action.label}
        </Button>
      </footer>

      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}

export default CatchUp;
