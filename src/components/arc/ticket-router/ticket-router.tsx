"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Bug,
  CircleCheck,
  CircleQuestionMark,
  CreditCard,
  FaceSlightlyFrowning,
  Inbox,
  Meh,
  Pause,
  Play,
  RotateCw,
  Smile,
  Sparkles,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { Avatar } from "../avatar/avatar";
import Button from "../button/button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./ticket-router.module.css";

type Channel = "email" | "intercom" | "slack" | "zendesk";
type Intent = "billing" | "bug" | "feature" | "refund";
type Sentiment = "positive" | "neutral" | "negative";
type Phase =
  | "connecting"
  | "arriving"
  | "classifying"
  | "labeled"
  | "routing"
  | "error"
  | "idle";

interface Classification {
  intent: Intent;
  sentiment: Sentiment;
  confidence: number;
}

interface Person {
  name: string;
  avatar?: string;
}

interface Lane {
  id: string;
  label: string;
  count?: number;
  review?: boolean;
  assignees?: Person[];
}

interface Ticket {
  id: string;
  channel: Channel;
  customer: string;
  company?: string;
  receivedAt?: string;
  subject: string;
  preview: string;
  sample?: Classification & { failOnce?: boolean };
  classification?: Classification;
  lane?: string;
  assignee?: Person;
  suggestedLane?: string;
}

interface Decision {
  lane: string;
  assignee?: Person;
  suggestedLane?: string;
}

export interface TicketRouterProps {
  /** A queue of tickets to classify. Omit to run the built-in sample inbox. */
  tickets?: Ticket[];
  /** The routing columns. Defaults to Billing, Engineering, Success and Needs review. */
  lanes?: Lane[];
  /** Tickets already sitting in the lanes on first paint. */
  initialRouted?: Ticket[];
  /** Replace the simulated classifier with a real one. Resolve with the labels for a ticket. */
  classify?: (
    ticket: Ticket,
    options: { signal: AbortSignal },
  ) => Promise<Classification>;
  /** Replace the simulated routing write with a real one. */
  route?: (ticket: Ticket, options: { signal: AbortSignal }) => Promise<void>;
  /** Confidence below which a ticket goes to the review lane. Defaults to 0.7. */
  reviewThreshold?: number;
  /** Keep pulling from the queue forever. Defaults to true for the built-in sample inbox. */
  loop?: boolean;
  /** Control the paused state. */
  paused?: boolean;
  /** Start paused. Defaults to false. */
  defaultPaused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  onRoute?: (ticket: Ticket) => void;
  onReview?: (ticket: Ticket, lane: string) => void;
  onError?: (ticket: Ticket, error: unknown) => void;
  /** Rows visible per lane before the lane clips. Defaults to 3. */
  maxVisible?: number;
  /** Playback speed multiplier. Defaults to 1. */
  speed?: number;
  title?: string;
  model?: string;
  modelMark?: ReactNode;
  className?: string;
}

const INTENT_LABEL: Record<Intent, string> = {
  billing: "Billing",
  bug: "Bug",
  feature: "Feature request",
  refund: "Refund",
};

const SENTIMENT_LABEL: Record<Sentiment, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Frustrated",
};

const CHANNEL_TITLE: Record<Channel, string> = {
  email: "Gmail",
  intercom: "Intercom",
  slack: "Slack",
  zendesk: "Zendesk",
};

const INTENT_ICON: Record<Intent, typeof Bug> = {
  billing: CreditCard,
  bug: Bug,
  feature: Sparkles,
  refund: Undo2,
};

const SENTIMENT_ICON: Record<Sentiment, typeof Bug> = {
  positive: Smile,
  neutral: Meh,
  negative: FaceSlightlyFrowning,
};

const CLAUDE_PATH =
  "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z";

function ClaudeMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-label=""
      width={size}
      height={size}
    >
      <path d={CLAUDE_PATH} />
    </svg>
  );
}

function ChannelSvg({
  channel,
  width,
  height,
  title,
}: {
  channel: Channel;
  width: number;
  height: number;
  title: string;
}) {
  return channel === "email" ? (
    <svg viewBox="0 0 24 24" width={width} height={height} role="img" aria-label={title}>
      <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
    </svg>
  ) : channel === "intercom" ? (
    <svg viewBox="0 0 24 24" width={width} height={height} role="img" aria-label={title}>
      <path d="M21 0H3C1.343 0 0 1.343 0 3v18c0 1.658 1.343 3 3 3h18c1.658 0 3-1.342 3-3V3c0-1.657-1.342-3-3-3zm-5.801 4.399c0-.44.36-.8.802-.8.44 0 .8.36.8.8v10.688c0 .442-.36.801-.8.801-.443 0-.802-.359-.802-.801V4.399zM11.2 3.994c0-.44.357-.799.8-.799s.8.359.8.799v11.602c0 .44-.357.8-.8.8s-.8-.36-.8-.8V3.994zm-4 .405c0-.44.359-.8.799-.8.443 0 .802.36.802.8v10.688c0 .442-.36.801-.802.801-.44 0-.799-.359-.799-.801V4.399zM3.199 6c0-.442.36-.8.802-.8.44 0 .799.358.799.8v7.195c0 .441-.359.8-.799.8-.443 0-.802-.36-.802-.8V6zM20.52 18.202c-.123.105-3.086 2.593-8.52 2.593-5.433 0-8.397-2.486-8.521-2.593-.335-.288-.375-.792-.086-1.128.285-.334.79-.375 1.125-.09.047.041 2.693 2.211 7.481 2.211 4.848 0 7.456-2.186 7.479-2.207.334-.289.839-.25 1.128.086.289.336.25.84-.086 1.128zm.281-5.007c0 .441-.36.8-.801.8-.441 0-.801-.36-.801-.8V6c0-.442.361-.8.801-.8.441 0 .801.357.801.8v7.195z" />
    </svg>
  ) : channel === "slack" ? (
    <svg viewBox="0 0 24 24" width={width} height={height} role="img" aria-label={title}>
      <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" />
      <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" />
      <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" />
      <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width={width} height={height} role="img" aria-label={title}>
      <path d="M12.914 2.904V16.29L24 2.905H12.914zM0 2.906C0 5.966 2.483 8.45 5.543 8.45s5.542-2.484 5.543-5.544H0zm11.086 4.807L0 21.096h11.086V7.713zm7.37 7.84c-3.063 0-5.542 2.48-5.542 5.543H24c0-3.06-2.48-5.543-5.543-5.543z" />
    </svg>
  );
}

const LANES: Lane[] = [
  {
    id: "billing",
    label: "Billing",
    count: 14,
    assignees: [
      { name: "Andre Williams", avatar: "andre-williams" },
      { name: "Sofia Ramirez", avatar: "sofia-ramirez" },
    ],
  },
  {
    id: "engineering",
    label: "Engineering",
    count: 9,
    assignees: [
      { name: "Daniel Kim", avatar: "daniel-kim" },
      { name: "Olivia Bennett", avatar: "olivia-bennett" },
    ],
  },
  {
    id: "success",
    label: "Success",
    count: 6,
    assignees: [
      { name: "Hannah Walsh", avatar: "hannah-walsh" },
      { name: "Jordan Reyes", avatar: "jordan-reyes" },
    ],
  },
  { id: "review", label: "Needs review", count: 1, review: true },
];

const SAMPLE_TICKETS: Ticket[] = [
  {
    id: "t-4821",
    channel: "email",
    customer: "Priya Raman",
    company: "Northwind Logistics",
    receivedAt: "9:41",
    subject: "Charged twice for the October invoice",
    preview:
      "Hi team, our Visa ending 4417 was billed $1,240 twice on Oct 24 for the Growth plan. Could you reverse the duplicate charge?",
    sample: { intent: "billing", sentiment: "negative", confidence: 0.97 },
  },
  {
    id: "t-4822",
    channel: "intercom",
    customer: "Lukas Meyer",
    company: "Fernhill",
    receivedAt: "9:42",
    subject: "CSV export fails above 10,000 rows",
    preview:
      "Exporting the Q3 deals view returns a 504 after about 30 seconds. Smaller views export fine. It started after Tuesday's release.",
    sample: { intent: "bug", sentiment: "negative", confidence: 0.94 },
  },
  {
    id: "t-4823",
    channel: "slack",
    customer: "Aiko Tanaka",
    company: "Brightline",
    receivedAt: "9:42",
    subject: "Group provisioning through Okta",
    preview:
      "We are adding 140 seats in November and would love SCIM group sync with Okta so new hires land in the right workspace.",
    sample: { intent: "feature", sentiment: "positive", confidence: 0.91 },
  },
  {
    id: "t-4824",
    channel: "email",
    customer: "Marco Bellini",
    company: "Atelier Nove",
    receivedAt: "9:43",
    subject: "Refund for unused seats",
    preview:
      "We went from 25 to 12 seats on Oct 3 but were charged for the full month. Requesting a prorated refund of $312.",
    sample: { intent: "refund", sentiment: "neutral", confidence: 0.89 },
  },
  {
    id: "t-4825",
    channel: "intercom",
    customer: "Grace Okafor",
    company: "Lumen Health",
    receivedAt: "9:44",
    subject: "Something feels off with reminders",
    preview:
      "A few patients said reminders arrived late yesterday. Not sure if it is on our side or yours, can someone take a look?",
    sample: { intent: "bug", sentiment: "neutral", confidence: 0.54 },
  },
  {
    id: "t-4826",
    channel: "slack",
    customer: "Tom Becker",
    company: "Parcelwise",
    receivedAt: "9:44",
    subject: "Webhooks arrive twice",
    preview:
      "Since Oct 25 every order.updated webhook arrives twice, about 200ms apart, with the same event id.",
    sample: {
      intent: "bug",
      sentiment: "negative",
      confidence: 0.95,
      failOnce: true,
    },
  },
  {
    id: "t-4827",
    channel: "zendesk",
    customer: "Elena Petrova",
    company: "Quill & Co",
    receivedAt: "9:45",
    subject: "Weekly PDF of the new dashboard",
    preview:
      "The new reporting dashboard is great. Could we schedule it as a weekly PDF for our leadership team on Mondays?",
    sample: { intent: "feature", sentiment: "positive", confidence: 0.88 },
  },
  {
    id: "t-4828",
    channel: "intercom",
    customer: "Sam Whitfield",
    company: "Harbor Labs",
    receivedAt: "9:46",
    subject: "Invoice shows our old VAT number",
    preview:
      "Our October invoice lists the old VAT ID. Please reissue it with GB 293 4471 09 before month end.",
    sample: { intent: "billing", sentiment: "neutral", confidence: 0.93 },
  },
  {
    id: "t-4829",
    channel: "email",
    customer: "Nina Alvarez",
    company: "Orbital",
    receivedAt: "9:46",
    subject: "Wrong plan, can we switch?",
    preview:
      "We picked the annual plan on Oct 20 by mistake and meant monthly. Can you switch us and sort out the difference?",
    sample: { intent: "refund", sentiment: "neutral", confidence: 0.62 },
  },
];

const SEED_ROUTED: Ticket[] = [
  {
    id: "t-4816",
    channel: "email",
    customer: "Helen Price",
    company: "Daybreak",
    receivedAt: "9:34",
    subject: "Receipt is missing our address",
    preview: "",
    classification: { intent: "billing", sentiment: "neutral", confidence: 0.92 },
    lane: "billing",
    assignee: { name: "Andre Williams", avatar: "andre-williams" },
  },
  {
    id: "t-4818",
    channel: "zendesk",
    customer: "Mia Larsen",
    company: "Fjord",
    receivedAt: "9:37",
    subject: "API returns 429 since 14:00 UTC",
    preview: "",
    classification: { intent: "bug", sentiment: "negative", confidence: 0.93 },
    lane: "engineering",
    assignee: { name: "Daniel Kim", avatar: "daniel-kim" },
  },
  {
    id: "t-4815",
    channel: "slack",
    customer: "Owen Hart",
    company: "Relay",
    receivedAt: "9:32",
    subject: "SAML login loops on Safari 19",
    preview: "",
    classification: { intent: "bug", sentiment: "negative", confidence: 0.95 },
    lane: "engineering",
    assignee: { name: "Olivia Bennett", avatar: "olivia-bennett" },
  },
  {
    id: "t-4817",
    channel: "intercom",
    customer: "Leo Grant",
    company: "Plainsight",
    receivedAt: "9:35",
    subject: "Dark mode for the mobile app",
    preview: "",
    classification: { intent: "feature", sentiment: "positive", confidence: 0.9 },
    lane: "success",
    assignee: { name: "Jordan Reyes", avatar: "jordan-reyes" },
  },
  {
    id: "t-4814",
    channel: "intercom",
    customer: "Ravi Shah",
    company: "Kitebird",
    receivedAt: "9:31",
    subject: "Update the card on file",
    preview: "",
    classification: { intent: "billing", sentiment: "neutral", confidence: 0.96 },
    lane: "billing",
    assignee: { name: "Sofia Ramirez", avatar: "sofia-ramirez" },
  },
  {
    id: "t-4819",
    channel: "email",
    customer: "Ines Duarte",
    company: "Mareva",
    receivedAt: "9:38",
    subject: "Question about our account",
    preview: "",
    classification: { intent: "feature", sentiment: "neutral", confidence: 0.48 },
    lane: "review",
    suggestedLane: "success",
  },
];

const EASE = [...motionTokens.ease.standard] as [number, number, number, number];
const SPRING = { type: "spring" as const, visualDuration: 0.24, bounce: 0 };

const pct = (value: number) => `${Math.round(100 * value)}%`;

function heuristic(ticket: Ticket): Classification {
  const text = `${ticket.subject} ${ticket.preview}`.toLowerCase();
  const intent: Intent = /refund|cancel/.test(text)
    ? "refund"
    : /invoice|charge|billing|card|vat|plan/.test(text)
      ? "billing"
      : /error|fail|bug|broken|crash|5\d\d|twice/.test(text)
        ? "bug"
        : "feature";
  const sentiment: Sentiment = /love|great|thanks|would love/.test(text)
    ? "positive"
    : /twice|again|still|urgent|broken/.test(text)
      ? "negative"
      : "neutral";
  return { intent, sentiment, confidence: 0.66 };
}

function Roll({ value, reduced }: { value: number; reduced: boolean }) {
  const text = String(value);
  return (
    <span className={styles.roll} style={{ minWidth: `${Math.max(2, text.length)}ch` }}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={text}
          className={styles.rollValue}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: "70%" }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: "-70%" }}
          transition={{
            duration: reduced ? 0 : motionTokens.duration.fast,
            ease: EASE,
          }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Swap({
  swapKey,
  children,
  className,
  reduced,
  travel = 2,
}: {
  swapKey: string;
  children: ReactNode;
  className?: string;
  reduced: boolean;
  travel?: number;
}) {
  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={swapKey}
        className={[styles.swap, className].filter(Boolean).join(" ")}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: -travel }}
        animate={
          reduced
            ? { opacity: 1 }
            : {
                opacity: 1,
                y: 0,
                transition: {
                  duration: motionTokens.duration.fast,
                  ease: EASE,
                  delay: 0.04,
                },
              }
        }
        exit={
          reduced
            ? { opacity: 0, transition: { duration: 0 } }
            : { opacity: 0, y: 2 * travel, transition: { duration: 0.1, ease: EASE } }
        }
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

function Chips({
  result,
  low,
  reduced,
}: {
  result: Classification;
  low: boolean;
  reduced: boolean;
}) {
  const IntentIcon = INTENT_ICON[result.intent];
  const SentimentIcon = SENTIMENT_ICON[result.sentiment];
  const nodes = [
    <span key="intent" className={styles.chip}>
      <IntentIcon size={14} strokeWidth={1.75} aria-hidden="true" />
      {INTENT_LABEL[result.intent]}
    </span>,
    <span key="sentiment" className={styles.chip} data-sentiment={result.sentiment}>
      <SentimentIcon size={14} strokeWidth={1.75} aria-hidden="true" />
      {SENTIMENT_LABEL[result.sentiment]}
    </span>,
    <span key="confidence" className={styles.chip} data-low={low || undefined}>
      <span className={styles.meter} aria-hidden="true">
        <span
          className={styles.meterFill}
          style={{ transform: `scaleX(${Math.max(0.04, Math.min(1, result.confidence))})` }}
        />
      </span>
      <span className={styles.chipNum}>{pct(result.confidence)}</span>
      <span className={styles.srOnly}>
        {"confidence"}
        {low ? ", low" : ""}
      </span>
    </span>,
  ];
  return (
    <span className={styles.chips}>
      {nodes.map((node, index) => (
        <motion.span
          key={index}
          className={styles.chipSlot}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: motionTokens.duration.fast,
            ease: EASE,
            delay: 0.05 * index,
          }}
        >
          {node}
        </motion.span>
      ))}
    </span>
  );
}

function ChannelMark({ channel, size = 16 }: { channel: Channel; size?: number }) {
  return (
    <span className={styles.mark} style={{ width: size, height: size }}>
      <ChannelSvg
        channel={channel}
        width={size}
        height={size}
        title={CHANNEL_TITLE[channel]}
      />
    </span>
  );
}

function Row({
  ticket,
  lane,
  fresh,
  suggested,
  onConfirm,
}: {
  ticket: Ticket;
  lane: Lane;
  fresh: boolean;
  suggested?: Lane;
  onConfirm: (ticket: Ticket) => void;
}) {
  const share = ticket.classification
    ? `${Math.round(100 * ticket.classification.confidence)}%`
    : undefined;
  const body = (
    <>
      <ChannelMark channel={ticket.channel} size={14} />
      <span className={styles.rowSubject}>{ticket.subject}</span>
      <span className={styles.rowWho}>
        {lane.review ? (
          <CircleQuestionMark
            size={14}
            strokeWidth={1.75}
            className={styles.reviewIcon}
            aria-hidden="true"
          />
        ) : ticket.assignee ? (
          <Avatar
            name={ticket.assignee.name}
            src={
              ticket.assignee.avatar
                ? `/media/people/${ticket.assignee.avatar}.svg`
                : undefined
            }
            size="sm"
            className={styles.avatar16}
          />
        ) : null}
      </span>
      <span className={styles.rowMeta}>
        {lane.review ? (
          suggested ? (
            <>
              <span className={styles.rowMetaStrong}>{suggested.label}</span>
              {"?"}
              <span className={styles.srOnly}>{" suggested"}</span>
            </>
          ) : (
            "Not classified"
          )
        ) : ticket.assignee ? (
          ticket.assignee.name.split(" ")[0]
        ) : (
          "Unassigned"
        )}
      </span>
      <span className={styles.rowPct}>
        {suggested ? (
          <ArrowRight
            size={14}
            strokeWidth={1.75}
            className={styles.rowGo}
            aria-hidden="true"
          />
        ) : null}
        <span>{share}</span>
      </span>
    </>
  );

  if (lane.review && suggested) {
    return (
      <button
        type="button"
        className={styles.row}
        data-fresh={fresh || undefined}
        onClick={() => onConfirm(ticket)}
        aria-label={`${ticket.subject}, from ${ticket.customer}. ${share ?? ""} confidence. Route to ${suggested.label}`}
        title={`Route to ${suggested.label}`}
      >
        {body}
      </button>
    );
  }

  return (
    <div
      className={styles.row}
      data-fresh={fresh || undefined}
      aria-label={`${ticket.subject}, from ${ticket.customer}${
        ticket.assignee ? `, assigned to ${ticket.assignee.name}` : ""
      }`}
      role="group"
    >
      {body}
    </div>
  );
}

export function TicketRouter({
  tickets,
  lanes = LANES,
  initialRouted,
  classify,
  route: routeTicket,
  reviewThreshold = 0.7,
  loop,
  paused,
  defaultPaused = false,
  onPausedChange,
  onRoute,
  onReview,
  onError,
  maxVisible = 3,
  speed = 1,
  title = "Ticket routing",
  model = "Claude Haiku 5.5",
  modelMark,
  className,
}: TicketRouterProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const source = tickets ?? SAMPLE_TICKETS;
  const isLoop = loop ?? !tickets;
  const simulated = !classify;

  const [internalPaused, setInternalPaused] = useState(defaultPaused);
  const isPaused = paused ?? internalPaused;
  const [visible, setVisible] = useState(true);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [result, setResult] = useState<Classification | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [routed, setRouted] = useState<Ticket[]>(
    () =>
      initialRouted ??
      (tickets ? [] : [...SEED_ROUTED].sort((a, b) => b.id.localeCompare(a.id))),
  );
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(lanes.map((lane) => [lane.id, lane.count ?? 0])),
  );
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [total, setTotal] = useState(0);
  const [announce, setAnnounce] = useState("");
  const [narrow, setNarrow] = useState(false);

  const rootRef = useRef<HTMLElement | null>(null);
  const cursor = useRef(0);
  const seen = useRef<Set<string>>(new Set());
  const failedOnce = useRef<Set<string>>(new Set());
  const assigneeCursor = useRef<Record<string, number>>({});
  const routeAbort = useRef<AbortController>(new AbortController());

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const resize = new ResizeObserver((entries) => {
      for (const entry of entries) setNarrow(entry.contentRect.width <= 600);
    });
    resize.observe(node);
    const intersection = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setVisible(entry.isIntersecting);
      },
      { rootMargin: "80px" },
    );
    intersection.observe(node);
    const abort = routeAbort.current;
    return () => {
      resize.disconnect();
      intersection.disconnect();
      abort.abort();
    };
  }, []);

  const laneOfId = useCallback(
    (id?: string) => (id ? lanes.find((lane) => lane.id === id) : undefined),
    [lanes],
  );
  const laneExists = useCallback(
    (id: string) => lanes.some((lane) => lane.id === id),
    [lanes],
  );
  const reviewLane = lanes.find((lane) => lane.review);

  const pickTicket = useCallback(() => {
    if (!source.length) return null;
    if (isLoop) {
      const index = cursor.current % source.length;
      const round = Math.floor(cursor.current / source.length);
      cursor.current += 1;
      const next = source[index];
      return round
        ? { ...next, id: `${next.id}-${round}`, receivedAt: undefined }
        : next;
    }
    return source.find((item) => !seen.current.has(item.id)) ?? null;
  }, [source, isLoop]);

  const pickAssignee = useCallback(
    (laneId: string) => {
      const list = laneOfId(laneId)?.assignees ?? [];
      if (!list.length) return undefined;
      const index = assigneeCursor.current[laneId] ?? 0;
      assigneeCursor.current[laneId] = index + 1;
      return list[index % list.length];
    },
    [laneOfId],
  );

  const resetIncoming = useCallback(() => {
    setResult(null);
    setDecision(null);
    setError("");
    setAttempt(0);
    const next = pickTicket();
    setTicket(next);
    setPhase(next ? "arriving" : "idle");
  }, [pickTicket]);

  const decide = useCallback(
    (item: Ticket, labels: Classification): Decision => {
      const laneId =
        labels.intent === "bug"
          ? "engineering"
          : labels.intent === "feature"
            ? "success"
            : "billing";
      const lane = laneExists(laneId)
        ? laneId
        : (lanes.find((entry) => !entry.review)?.id ?? laneId);
      if (reviewLane && labels.confidence < reviewThreshold) {
        return { lane: reviewLane.id, suggestedLane: lane };
      }
      return { lane, assignee: pickAssignee(lane) };
    },
    [laneExists, lanes, reviewLane, reviewThreshold, pickAssignee],
  );

  const accept = useCallback(
    (item: Ticket, labels: Classification | undefined, next: Decision) => {
      const entry: Ticket = {
        ...item,
        classification: labels,
        lane: next.lane,
        assignee: next.assignee,
        suggestedLane: next.suggestedLane,
      };
      seen.current.add(item.id);
      setRouted((previous) => [entry, ...previous].slice(0, 80));
      setCounts((previous) => ({
        ...previous,
        [next.lane]: (previous[next.lane] ?? 0) + 1,
      }));
      setFresh((previous) => new Set(previous).add(item.id));
      setTotal((previous) => previous + 1);
      setAnnounce(
        `${item.subject}: routed to ${laneOfId(next.lane)?.label ?? next.lane}${
          next.assignee ? `, assigned to ${next.assignee.name}` : ""
        }.${simulated ? " Simulated, nothing was sent." : ""}`,
      );
      onRoute?.(entry);
      if (routeTicket) void routeTicket(entry, { signal: routeAbort.current.signal });
    },
    [laneOfId, onRoute, routeTicket, simulated],
  );

  const confirmReview = useCallback(
    (item: Ticket) => {
      const suggested = item.suggestedLane;
      if (!suggested || !laneExists(suggested)) return;
      const assignee = pickAssignee(suggested);
      const next: Ticket = {
        ...item,
        lane: suggested,
        assignee,
        suggestedLane: undefined,
      };
      setRouted((previous) => [
        next,
        ...previous.filter((entry) => entry.id !== item.id),
      ]);
      setCounts((previous) => ({
        ...previous,
        [item.lane ?? suggested]: Math.max(0, (previous[item.lane ?? suggested] ?? 0) - 1),
        [suggested]: (previous[suggested] ?? 0) + 1,
      }));
      setFresh((previous) => new Set(previous).add(item.id));
      setAnnounce(
        `${item.subject}: moved to ${laneOfId(suggested)?.label ?? suggested}${
          assignee ? `, assigned to ${assignee.name}` : ""
        }.${simulated ? " Simulated, nothing was sent." : ""}`,
      );
      onReview?.(next, suggested);
    },
    [laneExists, laneOfId, onReview, pickAssignee, simulated],
  );

  useEffect(() => {
    if (isPaused || !visible) return;
    const scale = Math.max(0.25, speed);
    let timer: number | undefined;
    let sampleTimer: number | undefined;
    let controller: AbortController | undefined;

    if (phase === "connecting") {
      timer = window.setTimeout(resetIncoming, 560 / scale);
    } else if (phase === "arriving") {
      timer = window.setTimeout(() => setPhase("classifying"), 220 / scale);
    } else if (phase === "labeled") {
      timer = window.setTimeout(() => setPhase("routing"), 420 / scale);
    } else if (phase === "routing" && ticket && decision) {
      timer = window.setTimeout(() => {
        accept(ticket, result ?? undefined, decision);
        resetIncoming();
      }, 560 / scale);
    } else if (phase === "error" && simulated) {
      timer = window.setTimeout(() => {
        setAttempt((value) => value + 1);
        setPhase("classifying");
      }, 1700 / scale);
    } else if (phase === "idle") {
      const waiting =
        source.length > 0 &&
        (isLoop || source.some((item) => !seen.current.has(item.id)));
      if (waiting) timer = window.setTimeout(resetIncoming, 220 / scale);
    }

    if (phase === "classifying" && ticket) {
      const current = ticket;
      controller = new AbortController();
      const signal = controller.signal;
      const pending: Promise<Classification> = classify
        ? classify(current, { signal })
        : new Promise<Classification>((resolve, reject) => {
            sampleTimer = window.setTimeout(() => {
              if (
                current.sample?.failOnce &&
                !failedOnce.current.has(current.id)
              ) {
                failedOnce.current.add(current.id);
                reject(new Error("The classifier timed out after 8s."));
                return;
              }
              resolve(current.sample ?? heuristic(current));
            }, 720 / scale);
          });
      pending.then(
        (labels) => {
          if (signal.aborted) return;
          setResult(labels);
          setDecision(decide(current, labels));
          setPhase("labeled");
        },
        (cause: unknown) => {
          if (signal.aborted) return;
          setError(
            cause instanceof Error && cause.message
              ? cause.message
              : "The classifier could not label this ticket.",
          );
          setPhase("error");
          setAnnounce(`${current.subject}: classification failed.`);
          onError?.(current, cause);
        },
      );
    }

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      if (sampleTimer !== undefined) window.clearTimeout(sampleTimer);
      controller?.abort();
    };
  }, [
    phase,
    ticket,
    decision,
    attempt,
    isPaused,
    visible,
    simulated,
    source,
    speed,
    isLoop,
    result,
    classify,
    decide,
    accept,
    resetIncoming,
    onError,
  ]);

  const totalRouted = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const low =
    !!result && result.confidence < reviewThreshold && !!reviewLane;
  const targetIndex = decision ? lanes.findIndex((lane) => lane.id === decision.lane) : -1;
  const targetLane = laneOfId(decision?.lane);
  const isRouting = phase === "routing" && !!decision;
  const visibleRows = narrow ? Math.min(2, maxVisible) : maxVisible;
  const swapKey =
    phase === "connecting"
      ? "connecting"
      : ticket
        ? `ticket-${ticket.id}`
        : total
          ? "done"
          : "empty";
  const labelState = !ticket
    ? "none"
    : phase === "error"
      ? "error"
      : (phase === "labeled" || phase === "routing") && result
        ? "labels"
        : "classifying";
  const placeholder =
    phase === "connecting" ? (
      <div className={styles.placeholder}>
        <TextShimmer className={styles.placeholderText}>
          Connecting to Gmail, Intercom, Slack and Zendesk
        </TextShimmer>
      </div>
    ) : null;
  const ticketNode = ticket ? (
    <div className={styles.ticket}>
      <div className={styles.from}>
        <ChannelMark channel={ticket.channel} />
        <span className={styles.fromText}>
          <span className={styles.customer}>{ticket.customer}</span>
          {ticket.company ? (
            <span className={styles.company}>{ticket.company}</span>
          ) : null}
        </span>
        <span className={styles.time}>{ticket.receivedAt ?? "now"}</span>
      </div>
      <p className={styles.subject}>{ticket.subject}</p>
      <p className={styles.preview}>{ticket.preview}</p>
    </div>
  ) : (
    <div className={styles.placeholder}>
      {total ? (
        <CircleCheck
          size={16}
          strokeWidth={1.75}
          className={styles.doneIcon}
          aria-hidden="true"
        />
      ) : (
        <Inbox
          size={16}
          strokeWidth={1.75}
          className={styles.mutedIcon}
          aria-hidden="true"
        />
      )}
      <span className={styles.placeholderTitle}>
        {total ? "All caught up" : "Inbox is clear"}
      </span>
      <span className={styles.placeholderText}>
        {total
          ? `Routed ${total} ${total === 1 ? "ticket" : "tickets"} this session.`
          : "New messages are classified and routed as they arrive."}
      </span>
    </div>
  );
  const classifyNode =
    labelState === "none" ? null : labelState === "error" ? (
      <div className={styles.rowInner}>
        <span className={styles.errorText}>
          <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
          <span className={styles.truncate}>
            {`${error}${simulated ? " Retrying." : ""}`}
          </span>
        </span>
        <span className={styles.rowActions}>
          {reviewLane ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (ticket && reviewLane) {
                  accept(ticket, undefined, { lane: reviewLane.id });
                  resetIncoming();
                }
              }}
            >
              Send to review
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setError("");
              setAttempt((value) => value + 1);
              setPhase("classifying");
            }}
          >
            <RotateCw size={14} strokeWidth={1.75} aria-hidden="true" />
            Retry
          </Button>
        </span>
      </div>
    ) : labelState === "labels" && result ? (
      <div className={styles.rowInner}>
        <Chips result={result} low={low} reduced={reduced} />
        <span className={styles.routeSlot}>
          <AnimatePresence initial={false}>
            {isRouting && decision ? (
              <motion.span
                key="route"
                className={styles.route}
                initial={reduced ? { opacity: 0 } : { opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: reduced ? 0 : motionTokens.duration.fast,
                  ease: EASE,
                }}
              >
                <ArrowRight
                  size={14}
                  strokeWidth={1.75}
                  className={styles.mutedIcon}
                  aria-hidden="true"
                />
                {targetLane?.review ? (
                  <>
                    <CircleQuestionMark
                      size={14}
                      strokeWidth={1.75}
                      className={styles.reviewIcon}
                      aria-hidden="true"
                    />
                    <span className={styles.routeLane}>{targetLane.label}</span>
                  </>
                ) : (
                  <>
                    <span className={styles.routeLane}>{targetLane?.label}</span>
                    {decision.assignee ? (
                      <span className={styles.routeWho}>
                        <Avatar
                          name={decision.assignee.name}
                          src={
                            decision.assignee.avatar
                              ? `/media/people/${decision.assignee.avatar}.svg`
                              : undefined
                          }
                          size="sm"
                          className={styles.avatar20}
                        />
                        <span className={styles.truncate}>
                          {decision.assignee.name}
                        </span>
                      </span>
                    ) : null}
                  </>
                )}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </span>
      </div>
    ) : (
      <div className={styles.rowInner}>
        <TextShimmer
          active={!isPaused && phase !== "idle" && phase !== "error"}
          className={styles.classifying}
        >
          {isPaused ? "Paused before classifying" : `Classifying with ${model}`}
        </TextShimmer>
      </div>
    );

  return (
    <section
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-labelledby={`${uid}-title`}
      data-paused={isPaused || undefined}
      style={{ "--rows": maxVisible } as CSSProperties}
    >
      <header className={styles.header}>
        <span className={styles.modelMark} aria-hidden="true">
          {modelMark ?? <ClaudeMark size={16} />}
        </span>
        <span className={styles.heading}>
          <span id={`${uid}-title`} className={styles.title}>
            {title}
          </span>
          <span className={styles.model}>{model}</span>
        </span>
        <span className={styles.total}>
          <Roll value={totalRouted} reduced={reduced} /> routed today
        </span>
        <Button
          variant="secondary"
          size="sm"
          className={styles.pause}
          onClick={() => {
            const next = !isPaused;
            if (paused === undefined) setInternalPaused(next);
            onPausedChange?.(next);
            setAnnounce(
              next
                ? "Paused. New tickets wait in the queue."
                : "Resumed routing.",
            );
          }}
        >
          {isPaused ? <Play size={14} /> : <Pause size={14} />}
          {isPaused ? "Resume" : "Pause"}
        </Button>
      </header>
      <div
        className={styles.incoming}
        data-phase={phase}
        data-low={low || undefined}
      >
        <div className={styles.stage}>
          <Swap swapKey={swapKey} reduced={reduced} travel={3}>
            {ticket && phase !== "connecting" ? (
              <>
                {ticketNode}
                <div className={styles.classifyRow}>
                  <Swap swapKey={labelState} reduced={reduced}>
                    {classifyNode}
                  </Swap>
                </div>
              </>
            ) : (
              (placeholder ?? ticketNode)
            )}
          </Swap>
        </div>
      </div>
      <div
        className={styles.connector}
        style={{ "--n": lanes.length } as CSSProperties}
        aria-hidden="true"
      >
        <span className={styles.stubTop} />
        <span className={styles.rail} />
        {lanes.map((lane, index) => (
          <span
            key={lane.id}
            className={styles.stub}
            style={{ "--i": index } as CSSProperties}
          />
        ))}
        <AnimatePresence>
          {isRouting && targetIndex >= 0 && ticket ? (
            <motion.span
              key={ticket.id}
              className={styles.pulse}
              data-review={targetLane?.review || undefined}
              style={{ "--i": targetIndex } as CSSProperties}
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{
                opacity: 0,
                transition: { duration: motionTokens.duration.fast },
              }}
            >
              <motion.span
                className={styles.pulseTop}
                initial={reduced ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.08, ease: "linear" }}
              />
              <motion.span
                className={styles.pulseRail}
                data-side={(targetIndex + 0.5) / lanes.length < 0.5 ? "left" : "right"}
                initial={reduced ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.16, ease: "linear", delay: 0.08 }}
              />
              <motion.span
                className={styles.pulseStub}
                initial={reduced ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{
                  duration: 0.08,
                  ease: [0.22, 1, 0.36, 1],
                  delay: 0.24,
                }}
              />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
      <div
        className={styles.lanes}
        style={{ "--n": lanes.length } as CSSProperties}
      >
        {lanes.map((lane) => {
          const rows = routed
            .filter((entry) => entry.lane === lane.id)
            .slice(0, visibleRows);
          const count = counts[lane.id] ?? 0;
          return (
            <div
              key={lane.id}
              className={styles.lane}
              data-target={
                (isRouting && decision?.lane === lane.id) || undefined
              }
              data-review={lane.review || undefined}
            >
              <div className={styles.laneHead}>
                <span className={styles.laneName}>{lane.label}</span>
                <span className={styles.laneCount}>
                  <Roll value={count} reduced={reduced} />
                </span>
              </div>
              <ul
                className={styles.laneBody}
                aria-label={`${lane.label}, ${count} ${
                  count === 1 ? "ticket" : "tickets"
                }`}
              >
                <AnimatePresence initial={false}>
                  {rows.map((entry) => (
                    <motion.li
                      key={entry.id}
                      className={styles.rowItem}
                      initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      animate={reduced ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                      exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={
                        reduced
                          ? { duration: 0 }
                          : {
                              height: SPRING,
                              opacity: {
                                duration: motionTokens.duration.fast,
                                ease: EASE,
                              },
                            }
                      }
                    >
                      <Row
                        ticket={entry}
                        lane={lane}
                        fresh={fresh.has(entry.id)}
                        suggested={laneOfId(entry.suggestedLane)}
                        onConfirm={confirmReview}
                      />
                    </motion.li>
                  ))}
                </AnimatePresence>
                {rows.length ? null : (
                  <li className={styles.laneEmpty}>No tickets yet</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {announce}
      </span>
    </section>
  );
}

export default TicketRouter;
