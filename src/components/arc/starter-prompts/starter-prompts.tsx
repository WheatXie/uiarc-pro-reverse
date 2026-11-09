"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type SVGProps } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { ArrowUp, ChartNoAxesColumn, Check, CircleAlert, CodeXml, ListTodo, PenLine, RotateCcw, Shuffle } from "lucide-react";
import Button from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import { TextMorph } from "../text-morph/text-morph";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./starter-prompts.module.css";

/** The connected tool a starter can draw on. Cards with an app mark show its logo and name. */
export type StarterApp = "gmail" | "github" | "notion" | "linear" | "calendar";
export type StarterCategory = "write" | "code" | "analyze" | "plan";

export interface StarterPrompt {
  id: string;
  category: StarterCategory;
  /** Connected tool the prompt uses, if any. */
  app?: StarterApp;
  title: string;
  description?: string;
  /** The text that lands in the composer when the card is picked. */
  prompt: string;
}

export interface StarterCategoryOption {
  id: StarterCategory;
  label: string;
  icon?: ReactNode;
}

export interface StarterModel {
  name: string;
  /** Replaces the default model mark. */
  mark?: ReactNode;
}

export type StarterPromptsStatus = "idle" | "sending" | "sent" | "error";

export interface StarterPromptsProps {
  greeting?: string;
  description?: string;
  prompts?: StarterPrompt[];
  categories?: StarterCategoryOption[];
  defaultCategory?: StarterCategory | "all";
  /** Cards shown at once. */
  count?: number;
  loading?: boolean;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onSelect?: (prompt: StarterPrompt) => void;
  /** Called when the composer is submitted. Resolve to follow the sent state, throw to show the error. */
  onSubmit?: (message: string, options: { prompt: StarterPrompt | null; signal: AbortSignal }) => void | Promise<void>;
  model?: StarterModel;
  placeholder?: string;
  className?: string;
}

const PROMPTS: StarterPrompt[] = [
  {
    id: "reply-priya",
    category: "write",
    app: "gmail",
    title: "Reply to Priya about the launch",
    description: "Confirm the new date from her Gmail thread",
    prompt:
      "Draft a reply to Priya Raman's latest Gmail thread confirming we're moving the Halcyon launch to Tuesday, November 10. Keep it warm and under 120 words.",
  },
  {
    id: "release-notes",
    category: "write",
    app: "github",
    title: "Write release notes for v2.14",
    description: "Turn this week's merged PRs into a changelog",
    prompt:
      "Write customer-facing release notes for v2.14 from the pull requests merged into acme/web this week. Group them into New, Improved and Fixed.",
  },
  {
    id: "series-a",
    category: "write",
    title: "Announce our Series A",
    description: "Two short versions for LinkedIn and X",
    prompt:
      "Write a short announcement of our $18M Series A led by Northwind Ventures for LinkedIn and X. Confident, no buzzwords, two versions.",
  },
  {
    id: "tighten",
    category: "write",
    title: "Tighten a paragraph",
    description: "Clearer and shorter, same voice",
    prompt: "Rewrite the paragraph below so it is clearer and about 30% shorter, keeping my voice:\n\n",
  },
  {
    id: "follow-up",
    category: "write",
    app: "gmail",
    title: "Follow up with Lumen Health",
    description: "A nudge on the pilot proposal from October 14",
    prompt:
      "Write a short follow-up to Daniel Okafor at Lumen Health about the pilot proposal I sent on October 14. Offer two call slots next week.",
  },
  {
    id: "job-post",
    category: "write",
    app: "notion",
    title: "Draft a job post",
    description: "Senior product designer, from the hiring brief",
    prompt:
      "Draft a job post for a senior product designer from the hiring brief in Notion. Lead with the work, list the salary range and keep it under 400 words.",
  },
  {
    id: "review-pr",
    category: "code",
    app: "github",
    title: "Review PR #482 in acme/web",
    description: "Flag bugs, risky changes and missing tests",
    prompt:
      "Review pull request #482 in acme/web. Flag bugs, risky changes and missing tests, and suggest fixes as inline comments.",
  },
  {
    id: "churn-sql",
    category: "code",
    title: "Write a churn query",
    description: "Monthly logo churn by plan in Postgres",
    prompt:
      "Write a Postgres query for monthly logo churn by plan from the subscriptions table, January through October 2026.",
  },
  {
    id: "flaky-test",
    category: "code",
    app: "github",
    title: "Fix the flaky checkout test",
    description: "It fails on CI about one run in five",
    prompt: "checkout.spec.ts in acme/web fails on CI about one run in five. Read the last 10 failed runs, find the cause and propose a fix.",
  },
  {
    id: "regex",
    category: "code",
    title: "Explain a regex",
    description: "Piece by piece, with examples that pass and fail",
    prompt: "Explain what this regular expression matches, piece by piece, with two examples that pass and two that fail:\n\n",
  },
  {
    id: "migrate-hooks",
    category: "code",
    title: "Convert a class to hooks",
    description: "Keep behavior identical, add types",
    prompt: "Convert the React class component below to a function component with hooks. Keep the behavior identical and add TypeScript types:\n\n",
  },
  {
    id: "issue-triage",
    category: "code",
    app: "linear",
    title: "Triage new bug reports",
    description: "Label and route the 23 untriaged issues",
    prompt: "Go through the 23 untriaged issues in Linear. Label each one, set a priority, and route it to the right team with a one-line reason.",
  },
  {
    id: "interview-themes",
    category: "analyze",
    app: "notion",
    title: "Find themes in user interviews",
    description: "Summarize the 14 notes in the Research hub",
    prompt: "Read the 14 user interview notes in the Notion Research hub and give me the five most common themes, each with two direct quotes.",
  },
  {
    id: "signup-drop",
    category: "analyze",
    title: "Explain last week's signup drop",
    description: "Compare the funnel with the prior four weeks",
    prompt: "Signups dropped 18% in the week of October 19. Compare each funnel step with the prior four weeks and tell me where the drop starts.",
  },
  {
    id: "inbox-summary",
    category: "analyze",
    app: "gmail",
    title: "Summarize my unread email",
    description: "Group threads by who needs a reply",
    prompt: "Summarize my unread Gmail from the last 48 hours. Group threads by whether they need a reply from me today, this week, or never.",
  },
  {
    id: "vendor-quotes",
    category: "analyze",
    title: "Compare two vendor quotes",
    description: "Cost, terms and the fine print side by side",
    prompt:
      "Compare the two attached vendor quotes side by side: total cost over 24 months, payment terms, cancellation, and anything unusual in the fine print.",
  },
  {
    id: "pr-velocity",
    category: "analyze",
    app: "github",
    title: "Check review turnaround",
    description: "Median time to first review, by team",
    prompt:
      "Using pull requests in acme/web from September and October 2026, show the median time to first review by team and call out the slowest repos.",
  },
  {
    id: "nps-comments",
    category: "analyze",
    title: "Sort NPS comments",
    description: "312 responses from the October survey",
    prompt: "Sort the 312 comments from our October NPS survey into themes, with counts, the average score per theme, and one representative quote each.",
  },
  {
    id: "sprint",
    category: "plan",
    app: "linear",
    title: "Plan the next sprint",
    description: "Fit the backlog into 34 points of capacity",
    prompt:
      "Plan our next two-week sprint from the Linear backlog. We have 34 points of capacity; prioritize P1 bugs and explain what you left out.",
  },
  {
    id: "offsite",
    category: "plan",
    app: "notion",
    title: "Draft the Q1 offsite agenda",
    description: "Two days in Lisbon for 12 people",
    prompt: "Draft a two-day agenda for our Q1 product offsite in Lisbon for 12 people, and put it in a new Notion page under Team.",
  },
  {
    id: "focus-time",
    category: "plan",
    app: "calendar",
    title: "Find focus time this week",
    description: "Two hours a day around existing meetings",
    prompt: "Look at my Google Calendar for the week of November 2 and block two hours of focus time each day around existing meetings.",
  },
  {
    id: "launch-checklist",
    category: "plan",
    title: "Make a launch checklist",
    description: "Everything for the November 10 release",
    prompt:
      "Make a launch checklist for the Halcyon release on November 10, split into engineering, marketing and support, with an owner for each item.",
  },
  {
    id: "onboarding",
    category: "plan",
    app: "notion",
    title: "Plan a new hire's first week",
    description: "Day by day, for Mei joining on November 2",
    prompt:
      "Plan Mei Tanaka's first week as a product engineer starting November 2: day by day, who she meets, and what she ships by Friday.",
  },
  {
    id: "roadmap",
    category: "plan",
    title: "Outline the Q1 roadmap",
    description: "Three bets, with what we will not do",
    prompt: "Outline a Q1 2027 roadmap with three bets, the metric each one moves, rough sizing, and a short list of what we will not do.",
  },
];

const APP_LABELS: Record<StarterApp, string> = {
  gmail: "Gmail",
  github: "GitHub",
  notion: "Notion",
  linear: "Linear",
  calendar: "Google Calendar",
};

type IconProps = SVGProps<SVGSVGElement>;

const APP_ICONS: Record<StarterApp, (props: IconProps) => ReactNode> = {
  gmail: props => (
    <svg viewBox="52 42 88 66" aria-hidden="true" {...props}>
      <path fill="#4285F4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
      <path fill="#34A853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
      <path fill="#FBBC04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
      <path fill="#EA4335" d="M72 74V48l24 18 24-18v26L96 92" />
      <path fill="#C5221F" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
    </svg>
  ),
  github: props => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  ),
  notion: props => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
    </svg>
  ),
  linear: props => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
    </svg>
  ),
  calendar: props => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="#4285F4"
        d="M18.316 5.684H24v12.632h-5.684V5.684zM5.684 24h12.632v-5.684H5.684V24zM18.316 5.684V0H1.895A1.894 1.894 0 0 0 0 1.895v16.421h5.684V5.684h12.632zm-7.207 6.25v-.065c.272-.144.5-.349.687-.617s.279-.595.279-.982c0-.379-.099-.72-.3-1.025a2.05 2.05 0 0 0-.832-.714 2.703 2.703 0 0 0-1.197-.257c-.6 0-1.094.156-1.481.467-.386.311-.65.671-.793 1.078l1.085.452c.086-.249.224-.461.413-.633.189-.172.445-.257.767-.257.33 0 .602.088.816.264a.86.86 0 0 1 .322.703c0 .33-.12.589-.36.778-.24.19-.535.284-.886.284h-.567v1.085h.633c.407 0 .748.109 1.02.327.272.218.407.499.407.843 0 .336-.129.614-.387.832s-.565.327-.924.327c-.351 0-.651-.103-.897-.311-.248-.208-.422-.502-.521-.881l-1.096.452c.178.616.505 1.082.977 1.401.472.319.984.478 1.538.477a2.84 2.84 0 0 0 1.293-.291c.382-.193.684-.458.902-.794.218-.336.327-.72.327-1.149 0-.429-.115-.797-.344-1.105a2.067 2.067 0 0 0-.881-.689zm2.093-1.931l.602.913L15 10.045v5.744h1.187V8.446h-.827l-2.158 1.557zM22.105 0h-3.289v5.184H24V1.895A1.894 1.894 0 0 0 22.105 0zm-3.289 23.5l4.684-4.684h-4.684V23.5zM0 22.105C0 23.152.848 24 1.895 24h3.289v-5.184H0v3.289z"
      />
    </svg>
  ),
};

function AppMark({ app, size = 14, className }: { app: StarterApp; size?: number; className?: string }) {
  const Icon = APP_ICONS[app];
  return <Icon width={size} height={size} className={className} />;
}

function ClaudeMark({ width = 14, height = 14 }: { width?: number; height?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="#D97757" aria-hidden="true" width={width} height={height}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(" ");

const CATEGORY_ICON_PROPS = { size: 14, strokeWidth: 1.75, "aria-hidden": true } as const;

const CATEGORIES: StarterCategoryOption[] = [
  { id: "write", label: "Write", icon: <PenLine {...CATEGORY_ICON_PROPS} /> },
  { id: "code", label: "Code", icon: <CodeXml {...CATEGORY_ICON_PROPS} /> },
  { id: "analyze", label: "Analyze", icon: <ChartNoAxesColumn {...CATEGORY_ICON_PROPS} /> },
  { id: "plan", label: "Plan", icon: <ListTodo {...CATEGORY_ICON_PROPS} /> },
];

const DEFAULT_MODEL: StarterModel = { name: "Claude Sonnet 5.5" };

const ENTER_EASE = [...motionTokens.ease.enter] as [number, number, number, number];
const STANDARD_EASE = [...motionTokens.ease.standard] as [number, number, number, number];

function Spinner() {
  return (
    <svg className={styles.spinner} width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".25" strokeWidth="1.75" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/** Round-robins the categories so the default view shows one card from each. */
function interleavePrompts(prompts: StarterPrompt[], order: string[]) {
  const buckets = order.map(id => prompts.filter(prompt => prompt.category === id));
  const rest = prompts.filter(prompt => !order.includes(prompt.category));
  const mixed: StarterPrompt[] = [];
  for (let index = 0; buckets.some(bucket => bucket[index]); index += 1) {
    for (const bucket of buckets) if (bucket[index]) mixed.push(bucket[index]);
  }
  return [...mixed, ...rest];
}

/** Random order that keeps the cards already on screen at the front, so a shuffle changes as many as possible. */
function shuffleIds(current: string[], pool: StarterPrompt[], count: number) {
  const random = (list: StarterPrompt[]) =>
    list
      .map(prompt => [Math.random(), prompt] as const)
      .sort((a, b) => a[0] - b[0])
      .map(([, prompt]) => prompt);
  const offScreen = pool.filter(prompt => !current.includes(prompt.id));
  const onScreen = pool.filter(prompt => current.includes(prompt.id));
  return [...random(offScreen), ...random(onScreen)].slice(0, count).map(prompt => prompt.id);
}

export function StarterPrompts({
  greeting = "What are we working on, Maya?",
  description = "Pick a starter or write your own. Cards with an app mark use your connected tools.",
  prompts = PROMPTS,
  categories = CATEGORIES,
  defaultCategory = "all",
  count = 4,
  loading = false,
  value,
  defaultValue = "",
  onValueChange,
  onSelect,
  onSubmit,
  model = DEFAULT_MODEL,
  placeholder = "Ask anything, or pick a starter above",
  className,
}: StarterPromptsProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const [category, setCategory] = useState<StarterCategory | "all">(defaultCategory);
  const [order, setOrder] = useState<{ category: StarterCategory | "all"; ids: string[] } | null>(null);
  const [ownMessage, setOwnMessage] = useState(defaultValue);
  const message = value ?? ownMessage;
  const [picked, setPicked] = useState<StarterPrompt | null>(null);
  const [status, setStatus] = useState<StarterPromptsStatus>("idle");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const controller = useRef<AbortController | null>(null);
  const sentTimer = useRef<number | undefined>(undefined);

  // A send in flight is aborted when the component goes away, so no state lands on an unmounted tree.
  useEffect(() => () => {
    controller.current?.abort();
    window.clearTimeout(sentTimer.current);
  }, []);

  const categoryMeta = useMemo(() => new Map(categories.map((item, index) => [item.id, { ...item, series: (index % 4) + 1 }])), [categories]);

  const pool = useMemo(
    () => (category === "all" ? interleavePrompts(prompts, categories.map(item => item.id)) : prompts.filter(prompt => prompt.category === category)),
    [prompts, categories, category],
  );

  // A shuffled order only holds while the tab it was made for is still showing.
  const shown = useMemo(() => {
    const byId = new Map(pool.map(prompt => [prompt.id, prompt]));
    const pinned = order && order.category === category ? order.ids.map(id => byId.get(id)).filter((prompt): prompt is StarterPrompt => !!prompt) : [];
    const rest = pool.filter(prompt => !pinned.includes(prompt));
    return [...pinned, ...rest].slice(0, count);
  }, [pool, order, category, count]);

  const options = useMemo(
    () => [
      { value: "all", label: "All" },
      ...categories.filter(item => prompts.some(prompt => prompt.category === item.id) || item.id === category).map(item => ({ value: item.id, label: item.label })),
    ],
    [categories, prompts, category],
  );

  const categoryLabel = categoryMeta.get(category as StarterCategory)?.label ?? "All";
  const canShuffle = !loading && pool.length > count;
  const sending = status === "sending";

  const setMessage = (next: string) => {
    if (value === undefined) setOwnMessage(next);
    onValueChange?.(next);
  };

  const chooseCategory = (next: string) => {
    setCategory(next as StarterCategory | "all");
    setOrder(null);
  };

  const focusComposer = () => {
    const node = input.current;
    if (!node) return;
    node.focus({ preventScroll: true });
    const end = node.value.length;
    node.setSelectionRange(end, end);
    node.scrollTop = 0;
    if (reduced) return;
    animate(node, { opacity: [0.35, 1] }, { duration: motionTokens.duration.fast, ease: ENTER_EASE });
  };

  const send = async () => {
    const text = message.trim();
    if (!text || sending) return;
    window.clearTimeout(sentTimer.current);
    const next = new AbortController();
    controller.current = next;
    setStatus("sending");
    setError("");
    setAnnouncement(`Sending to ${model.name}.`);
    try {
      if (onSubmit) await onSubmit(text, { prompt: picked, signal: next.signal });
      else {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(resolve, 1100);
          next.signal.addEventListener("abort", () => {
            window.clearTimeout(timer);
            reject(new DOMException("Stopped", "AbortError"));
          }, { once: true });
        });
      }
      if (next.signal.aborted) return;
      setStatus("sent");
      setMessage("");
      setPicked(null);
      setAnnouncement(onSubmit ? "Sent." : "Sent. Simulated, nothing was sent.");
      sentTimer.current = window.setTimeout(() => setStatus(current => (current === "sent" ? "idle" : current)), 2600);
    } catch (caught) {
      if (next.signal.aborted) return;
      const reason = caught instanceof Error && caught.message ? caught.message : "Couldn't send. Check your connection and try again.";
      setStatus("error");
      setError(reason);
      setAnnouncement(`Not sent. ${reason}`);
    } finally {
      if (controller.current === next) controller.current = null;
    }
  };

  const stop = () => {
    controller.current?.abort();
    controller.current = null;
    setStatus("idle");
    setAnnouncement("Stopped. Your message is still in the composer.");
    input.current?.focus();
  };

  const presence = reduced ? { duration: 0 } : { duration: motionTokens.duration.fast, ease: STANDARD_EASE };
  const showEmpty = !loading && pool.length === 0;
  const canSend = message.trim().length > 0;
  const pickedApp = picked?.app;

  return (
    <section className={cx(styles.root, className)} aria-labelledby={`${uid}-title`}>
      <header className={styles.header}>
        <h2 id={`${uid}-title`} className={styles.greeting}>{greeting}</h2>
        {description ? <p className={styles.description}>{description}</p> : null}
      </header>

      <div className={styles.toolbar}>
        <SegmentedControl className={styles.tabs} label="Filter starters" options={options} value={category} onValueChange={chooseCategory} />
        <Button
          variant="ghost"
          size="sm"
          className={styles.shuffle}
          onClick={() => {
            if (!canShuffle) return;
            const ids = shuffleIds(shown.map(prompt => prompt.id), pool, count);
            setOrder({ category, ids });
            setAnnouncement(`Showing ${ids.length} new ${category === "all" ? "" : `${categoryLabel.toLowerCase()} `}starters.`);
          }}
          disabled={!canShuffle}
          aria-label="Shuffle starters"
        >
          <Shuffle size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className={styles.shuffleLabel}>Shuffle</span>
        </Button>
      </div>

      <div className={styles.gridWrap}>
        <ul className={styles.grid} aria-label={`${categoryLabel} starters`} aria-busy={loading || undefined}>
          {Array.from({ length: count }, (_, index) => {
            const prompt = loading ? undefined : shown[index];
            if (loading)
              return (
                <li key={index} className={styles.slot} aria-hidden="true">
                  <span className={cx(styles.card, styles.skeleton)}>
                    <span className={styles.content}>
                      <span className={styles.meta}>
                        <span className={styles.bone} style={{ width: 64 }} />
                      </span>
                      <span className={cx(styles.bone, styles.boneTitle)} style={{ width: `${68 - 7 * index}%` }} />
                      <span className={cx(styles.bone, styles.boneLine)} style={{ width: `${82 - 5 * index}%` }} />
                    </span>
                  </span>
                </li>
              );
            if (!prompt)
              return <li key={index} className={styles.slot} aria-hidden="true" data-empty="" />;
            const meta = categoryMeta.get(prompt.category);
            return (
              <li key={index} className={styles.slot}>
                <button
                  type="button"
                  className={styles.card}
                  onClick={() => {
                    if (sending) return;
                    window.clearTimeout(sentTimer.current);
                    setMessage(prompt.prompt);
                    setPicked(prompt);
                    setStatus("idle");
                    setError("");
                    onSelect?.(prompt);
                    setAnnouncement(`Added "${prompt.title}" to the message. Edit it or press Enter to send.`);
                    requestAnimationFrame(focusComposer);
                  }}
                  disabled={sending}
                  aria-label={`${prompt.title}${prompt.app ? `, uses ${APP_LABELS[prompt.app]}` : ""}. ${meta?.label ?? ""}`}
                  data-picked={picked?.id === prompt.id || undefined}
                >
                  <AnimatePresence initial={false}>
                    <motion.span
                      key={prompt.id}
                      className={styles.content}
                      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        transition: reduced
                          ? { duration: 0 }
                          : { duration: motionTokens.duration.fast, ease: ENTER_EASE, delay: 0.06 + 0.035 * index },
                      }}
                      exit={{
                        opacity: 0,
                        transition: reduced ? { duration: 0 } : { duration: 0.1, ease: STANDARD_EASE, delay: 0.035 * index },
                      }}
                      aria-hidden="true"
                    >
                      <span className={styles.meta}>
                        {meta?.icon ? <span className={styles.categoryIcon} data-series={meta.series}>{meta.icon}</span> : null}
                        <span className={styles.categoryLabel}>{meta?.label ?? prompt.category}</span>
                        {prompt.app ? (
                          <span className={styles.app}>
                            <AppMark app={prompt.app} className={styles.appMark} />
                            <span className={styles.appName}>{APP_LABELS[prompt.app]}</span>
                          </span>
                        ) : null}
                      </span>
                      <span className={styles.title}>{prompt.title}</span>
                      {prompt.description ? <span className={styles.cardDescription}>{prompt.description}</span> : null}
                    </motion.span>
                  </AnimatePresence>
                </button>
              </li>
            );
          })}
        </ul>
        <AnimatePresence initial={false}>
          {showEmpty ? (
            <motion.div
              key="empty"
              className={styles.empty}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={presence}
            >
              <p className={styles.emptyTitle}>
                No {category === "all" ? "" : `${categoryLabel.toLowerCase()} `}starters yet
              </p>
              <p className={styles.emptyCopy}>Write your own below{category === "all" ? "." : ", or look through every category."}</p>
              {category !== "all" ? (
                <Button variant="secondary" size="sm" onClick={() => chooseCategory("all")}>Show all</Button>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <form
        className={styles.composer}
        data-status={status}
        onSubmit={event => {
          event.preventDefault();
          void send();
        }}
      >
        <label htmlFor={`${uid}-input`} className={styles.srOnly}>Message {model.name}</label>
        <textarea
          ref={input}
          id={`${uid}-input`}
          className={styles.input}
          value={message}
          placeholder={placeholder}
          rows={3}
          readOnly={sending}
          onChange={event => {
            setMessage(event.target.value);
            if (!event.target.value) setPicked(null);
            if (status === "error" || status === "sent") setStatus("idle");
          }}
          onKeyDown={event => {
            if (event.key === "Escape" && sending) {
              event.preventDefault();
              stop();
              return;
            }
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            void send();
          }}
          aria-describedby={`${uid}-status`}
        />
        <div className={styles.footer}>
          <div className={styles.footerStatus} id={`${uid}-status`}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={status}
                className={styles.statusInner}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: reduced ? { duration: 0 } : { duration: motionTokens.duration.fast, delay: 0.04 } }}
                exit={{ opacity: 0, transition: reduced ? { duration: 0 } : { duration: 0.1 } }}
              >
                {status === "idle" ? (
                  <>
                    <span className={styles.model}>
                      <span className={styles.modelMark}>{model.mark ?? <ClaudeMark width={14} height={14} />}</span>
                      <span className={styles.ellipsis}>{model.name}</span>
                    </span>
                    <AnimatePresence initial={false} mode="popLayout">
                      {pickedApp ? (
                        <motion.span
                          key={pickedApp}
                          className={styles.chip}
                          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={reduced ? { duration: 0 } : { ...motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.fast } }}
                        >
                          <AppMark app={pickedApp} className={styles.appMark} />
                          <span className={styles.ellipsis}>Uses {APP_LABELS[pickedApp]}</span>
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                  </>
                ) : status === "sending" ? (
                  <TextMorph className={styles.ellipsis}>{`Sending to ${model.name}`}</TextMorph>
                ) : status === "sent" ? (
                  <span className={styles.done}>
                    <Check size={14} strokeWidth={2} aria-hidden="true" className={styles.doneIcon} />
                    <span className={styles.ellipsis}>{onSubmit ? "Sent" : "Sent. Simulated, nothing was sent."}</span>
                  </span>
                ) : (
                  <span className={styles.failed}>
                    <CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" className={styles.failedIcon} />
                    <span className={styles.ellipsis}>{error}</span>
                  </span>
                )}
              </motion.span>
            </AnimatePresence>
          </div>
          <AnimatePresence initial={false}>
            {status === "error" ? (
              <motion.span
                key="retry"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={presence}
              >
                <Button type="submit" variant="ghost" size="sm" className={styles.retry}>
                  <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
                  Retry
                </Button>
              </motion.span>
            ) : null}
          </AnimatePresence>
          <button
            type={sending ? "button" : "submit"}
            className={styles.send}
            onClick={sending ? stop : undefined}
            disabled={!sending && !canSend}
            aria-label={sending ? "Stop sending" : "Send message"}
            data-busy={sending || undefined}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={sending ? "stop" : "send"}
                className={styles.sendIcon}
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
                transition={reduced ? { duration: 0 } : { ...motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.instant } }}
              >
                {sending ? (
                  <span className={styles.stopWrap}>
                    <Spinner />
                    <span className={styles.stopSquare} />
                  </span>
                ) : (
                  <ArrowUp size={16} strokeWidth={2} aria-hidden="true" />
                )}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </form>

      <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
    </section>
  );
}

const PREVIEW_STATES = [
  { value: "live", label: "Live" },
  { value: "loading", label: "Loading" },
  { value: "empty", label: "Empty" },
  { value: "fails", label: "Send fails" },
];

const failSend = (_message: string, { signal }: { prompt: StarterPrompt | null; signal: AbortSignal }) =>
  new Promise<void>((_resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Couldn't reach the model. Simulated, nothing was sent.")), 900);
    signal.addEventListener("abort", () => window.clearTimeout(timer), { once: true });
  });

export function StarterPromptsDemo() {
  const [state, setState] = useState("live");
  return (
    <div className={styles.demo}>
      <StarterPrompts
        key={state}
        loading={state === "loading"}
        prompts={state === "empty" ? [] : undefined}
        onSubmit={state === "fails" ? failSend : undefined}
      />
      <SegmentedControl label="Preview state" options={PREVIEW_STATES} value={state} onValueChange={setState} />
    </div>
  );
}

export default StarterPromptsDemo;
