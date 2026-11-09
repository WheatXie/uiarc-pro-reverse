"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { HTMLAttributes } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";
import { ChevronUp, MessageSquare, Plus, TriangleAlert } from "lucide-react";
import Button from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import { Avatar } from "../avatar/avatar";
import { motionTokens } from "../lib/motion-tokens";
import { person, type PersonId } from "../lib/media";
import styles from "./feature-voting.module.css";

export type FeatureStatus = "review" | "planned" | "progress" | "shipped";
export type FeatureSort = "top" | "new" | "trending";
export type FeatureDraft = { title: string; details: string };

export interface FeatureVoter {
  name: string;
  src?: string;
}

export interface FeatureRequest {
  id: string;
  title: string;
  status?: FeatureStatus;
  votes: number;
  comments: number;
  createdAt: string;
  trend?: number;
  tag?: { label: string; mark?: string };
  voters?: FeatureVoter[];
  voted?: boolean;
}

export interface FeatureVotingProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSubmit"> {
  /** The board. Leave it out to render the sample board below, which votes on a simulated backend. */
  requests?: FeatureRequest[];
  title?: string;
  description?: string;
  defaultSort?: FeatureSort;
  onSortChange?: (sort: FeatureSort) => void;
  /** Cast or withdraw a vote. Return a rejected promise to roll the optimistic count back. */
  onVote?: (id: string, voted: boolean, signal: AbortSignal) => void | Promise<void>;
  /** Post a new request. Resolve with the stored request to replace the optimistic one. */
  onSubmit?: (draft: FeatureDraft, signal: AbortSignal) => Promise<FeatureRequest | void>;
  /** Duplicate detection while the composer is open. Title plus tag text is compared. */
  findSimilar?: (query: string, requests: FeatureRequest[]) => FeatureRequest[];
  onOpenRequest?: (id: string) => void;
  currentUser?: FeatureVoter;
  /** Keep counts moving while the board is on screen. Implied when no requests prop is given. */
  live?: boolean;
  loading?: boolean;
  disabled?: boolean;
}

const voter = (id: string): FeatureVoter => {
  const found = person(id as PersonId);
  return { name: found.name, src: found.src };
};

const everyone = () => {
  const ids = ["emma-collins", "marcus-johnson", "jasmine-brooks", "olivia-bennett", "sofia-ramirez", "ryan-sullivan", "hannah-walsh", "chloe-nguyen", "ava-mitchell", "daniel-kim", "jordan-reyes", "mateo-alvarez", "tyler-hayes", "andre-williams", "diane-foster"];
  return ids.map(voter);
};

const SAMPLE_USER = voter("nathan-cole");

export const featureVotingSamples: FeatureRequest[] = [
  {
    id: "linear-sync",
    title: "Two-way sync with Linear issues",
    status: "planned",
    votes: 412,
    comments: 38,
    createdAt: "2026-10-03",
    trend: 46,
    tag: { label: "Linear", mark: "linear" },
    voters: [voter("emma-collins"), voter("daniel-kim"), voter("olivia-bennett"), voter("marcus-johnson")],
  },
  {
    id: "okta-sso",
    title: "SAML single sign-on with Okta",
    status: "progress",
    votes: 351,
    comments: 44,
    createdAt: "2026-08-28",
    trend: 31,
    tag: { label: "Okta", mark: "okta" },
    voters: [voter("diane-foster"), voter("andre-williams"), voter("sofia-ramirez"), voter("tyler-hayes")],
  },
  {
    id: "slack-ship-alerts",
    title: "Post to Slack when a request ships",
    status: "shipped",
    votes: 286,
    comments: 21,
    createdAt: "2026-09-12",
    trend: 9,
    tag: { label: "Slack", mark: "slack" },
    voters: [voter("hannah-walsh"), voter("jordan-reyes"), voter("ava-mitchell"), voter("ryan-sullivan")],
  },
  {
    id: "notion-embed",
    title: "Embed the public roadmap in Notion",
    status: "planned",
    votes: 158,
    comments: 17,
    createdAt: "2026-10-15",
    trend: 40,
    tag: { label: "Notion", mark: "notion" },
    voters: [voter("jasmine-brooks"), voter("chloe-nguyen"), voter("emma-collins"), voter("mateo-alvarez")],
  },
  {
    id: "github-discussions",
    title: "Import ideas from GitHub Discussions",
    status: "review",
    votes: 97,
    comments: 12,
    createdAt: "2026-10-22",
    trend: 58,
    tag: { label: "GitHub", mark: "github" },
    voters: [voter("marcus-johnson"), voter("daniel-kim"), voter("mateo-alvarez"), voter("olivia-bennett")],
  },
];

const STOPWORDS = new Set([
  "a", "an", "the", "to", "for", "with", "in", "on", "of", "and", "or", "when", "is", "be", "from", "into", "my", "our", "your", "it", "as", "at", "by",
  "add", "support", "please", "feature", "ability", "allow", "can", "i", "we", "new", "option", "way",
]);

/** Words a person types for a feature they mean by another name. */
const NEARBY: Record<string, string[]> = {
  sso: ["saml", "okta", "single", "sign"],
  login: ["sso", "saml", "sign"],
  saml: ["sso"],
  auth: ["sso", "saml", "okta"],
  alert: ["notif", "notify", "post", "slack"],
  notif: ["alert", "slack"],
  notify: ["alert"],
  message: ["slack"],
  sync: ["import", "integration"],
  import: ["sync"],
  integration: ["sync"],
  jira: ["linear", "issue"],
  ticket: ["issue"],
  embed: ["iframe", "widget"],
  widget: ["embed"],
  idea: ["request"],
};

const stem = (word: string) => word.replace(/(ications|ication|ings|ing|ed|es|s)$/, "");

/** Lowercase words, split on anything that is not a letter or digit, stop words dropped, plurals folded. */
const tokens = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(word => word.length > 1 && !STOPWORDS.has(word))
    .map(word => (word.length > 4 && stem(word)) || word);

/** Requests whose title or tag already cover what is being typed, best match first. */
export function findSimilarRequests(query: string, requests: FeatureRequest[], limit = 3): FeatureRequest[] {
  const wanted = tokens(query);
  if (!wanted.length || query.trim().length < 3) return [];
  return requests
    .map(request => {
      const haystack = tokens(`${request.title} ${request.tag?.label ?? ""}`);
      const hits = wanted.filter(word =>
        haystack.some(other => !!(word === other || (word.length >= 3 && other.startsWith(word)) || (other.length >= 3 && word.startsWith(other))) || (NEARBY[word] ?? []).some(near => other.startsWith(near))),
      ).length;
      return { request, score: hits / wanted.length, hits };
    })
    .filter(entry => entry.hits > 0 && entry.score >= 0.34)
    .sort((a, b) => b.score - a.score || b.request.votes - a.request.votes)
    .slice(0, limit)
    .map(entry => entry.request);
}

/** Ids in display order for a sort. The board keeps its own list so moving rows can animate. */
export function sortRequests(requests: FeatureRequest[], sort: FeatureSort): string[] {
  const next = [...requests];
  if (sort === "top") next.sort((a, b) => b.votes - a.votes);
  else if (sort === "new") next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  else next.sort((a, b) => (b.trend ?? 0) - (a.trend ?? 0) || b.votes - a.votes);
  return next.map(request => request.id);
}

const MARKS: Record<string, { title: string; paths: { fill?: string; d: string }[] }> = {
  linear: {
    title: "Linear",
    paths: [{ fill: "#5E6AD2", d: "M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" }],
  },
  slack: {
    title: "Slack",
    paths: [
      { fill: "#E01E5A", d: "M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" },
      { fill: "#36C5F0", d: "M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" },
      { fill: "#2EB67D", d: "M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" },
      { fill: "#ECB22E", d: "M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" },
    ],
  },
  github: {
    title: "GitHub",
    paths: [{ d: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" }],
  },
  notion: {
    title: "Notion",
    paths: [{ d: "M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" }],
  },
  okta: {
    title: "Okta",
    paths: [{ d: "M12 0C5.389 0 0 5.35 0 12s5.35 12 12 12 12-5.35 12-12S18.611 0 12 0zm0 18c-3.325 0-6-2.675-6-6s2.675-6 6-6 6 2.675 6 6-2.675 6-6 6z" }],
  },
  figma: {
    title: "Figma",
    paths: [{ d: "M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491zM12.735 7.51h3.117c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-3.117V7.51zm0 1.471H8.148c-2.476 0-4.49-2.014-4.49-4.49S5.672 0 8.148 0h4.588v8.981zm-4.587-7.51c-1.665 0-3.019 1.355-3.019 3.019s1.354 3.02 3.019 3.02h3.117V1.471H8.148zm4.587 15.019H8.148c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h4.588v8.98zM8.148 8.981c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h3.117V8.981H8.148zM8.172 24c-2.489 0-4.515-2.014-4.515-4.49s2.014-4.49 4.49-4.49h4.588v4.441c0 2.503-2.047 4.539-4.563 4.539zm-.024-7.51a3.023 3.023 0 0 0-3.019 3.019c0 1.665 1.365 3.019 3.044 3.019 1.705 0 3.093-1.376 3.093-3.068v-2.97H8.148zm7.704 0h-.098c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h.098c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.49-4.49 4.49zm-.097-7.509c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h.098c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-.098z" }],
  },
};

/** A service mark, drawn inline so the row never waits on a network request. */
function Mark({ id, className }: { id: string; className?: string }) {
  const mark = MARKS[id];
  if (!mark) return null;
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" aria-hidden="true" focusable="false" className={className}>
      {mark.paths.map(path => <path key={path.d.slice(0, 24)} d={path.d} fill={path.fill} />)}
    </svg>
  );
}

const cx = (...values: (string | false | undefined)[]) => values.filter(Boolean).join(" ");
const counted = (value: number, noun: string) => `${value.toLocaleString("en-US")} ${noun}${value === 1 ? "" : "s"}`;

const DEFAULT_MESSAGE = "Vote on what your team needs most.";
const SORTS = [
  { value: "top", label: "Top" },
  { value: "new", label: "New" },
  { value: "trending", label: "Trending" },
];
const STATUS_LABEL: Record<FeatureStatus, string> = {
  review: "Under review",
  planned: "Planned",
  progress: "In progress",
  shipped: "Shipped",
};
/** Sorting moves rows without bounce: a spring that reads as a slide, not a throw. */
const MOVE = { type: "spring" as const, visualDuration: 0.24, bounce: 0 };
const FADE = { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] as [number, number, number, number] };
const FOLD = { height: MOVE, opacity: FADE };
const INSTANT = { duration: 0 };
const ROLL: Variants = {
  enter: (direction: number) => ({ y: `${70 * direction}%`, opacity: 0 }),
  center: { y: "0%", opacity: 1 },
  exit: (direction: number) => ({ y: `${-70 * direction}%`, opacity: 0 }),
};

/** Only the digits that changed roll; the rest stay put, like an odometer. */
function RollingDigits({ value, reduced }: { value: number; reduced: boolean }) {
  const [shown, setShown] = useState({ value, direction: 1 });
  if (shown.value !== value) setShown({ value, direction: value > shown.value ? 1 : -1 });
  const direction = shown.value === value ? shown.direction : value > shown.value ? 1 : -1;
  const characters = value.toLocaleString("en-US").split("");
  return (
    <span className={styles.roll} aria-hidden="true">
      {characters.map((character, index) => (
        <span key={characters.length - index} className={styles.rollSlot}>
          <AnimatePresence initial={false} custom={direction}>
            <motion.span key={character} custom={direction} variants={ROLL} initial="enter" animate="center" exit="exit" transition={reduced ? INSTANT : { duration: 0.2, ease: [...motionTokens.ease.standard] }}>{character}</motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

/** Status as an icon plus a word: the shape carries status at a glance, the word carries it for everyone. */
function StatusGlyph({ status }: { status: FeatureStatus }) {
  return (
    <svg className={styles.glyph} viewBox="0 0 14 14" width={14} height={14} aria-hidden="true" focusable="false">
      {status === "review" && <circle cx="7" cy="7" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.2 1.9" />}
      {status === "planned" && <circle cx="7" cy="7" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.5" />}
      {status === "progress" && (
        <>
          <circle cx="7" cy="7" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 3.5a3.5 3.5 0 0 1 0 7Z" fill="currentColor" />
        </>
      )}
      {status === "shipped" && (
        <>
          <circle cx="7" cy="7" r="6" fill="currentColor" />
          <path d="M4.4 7.1 6.2 8.9 9.6 5.4" fill="none" stroke="var(--surface)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

function StatusChip({ status }: { status: FeatureStatus }) {
  return (
    <span className={styles.chip} data-status={status}>
      <StatusGlyph status={status} />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** The board. It keeps its own copy of the requests so an optimistic vote lands before the request returns. */
export default function FeatureVoting({
  requests,
  title = "Feature requests",
  description = "Vote on what we build next. We read every request.",
  defaultSort = "top",
  onSortChange,
  onVote,
  onSubmit,
  findSimilar = findSimilarRequests,
  onOpenRequest,
  currentUser = SAMPLE_USER,
  live,
  loading = false,
  disabled = false,
  className,
  ...props
}: FeatureVotingProps) {
  const reduceMotion = !!useReducedMotion();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const titleField = useRef<HTMLInputElement>(null);
  const suggestButton = useRef<HTMLButtonElement>(null);

  const [tracked, setTracked] = useState(requests);
  const [items, setItems] = useState<FeatureRequest[]>(() => requests ?? featureVotingSamples);
  const [sort, setSort] = useState<FeatureSort>(defaultSort);
  const [order, setOrder] = useState<string[]>(() => sortRequests(requests ?? featureVotingSamples, defaultSort));
  if (requests !== tracked) {
    const next = requests ?? featureVotingSamples;
    setTracked(requests);
    setItems(next);
    setOrder(sortRequests(next, sort));
  }

  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState<FeatureDraft>({ title: "", details: "" });
  const [phase, setPhase] = useState<"idle" | "sending" | "error">("idle");
  const [peeking, setPeeking] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ id: string; n: number } | null>(null);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);

  const voteCalls = useRef(new Map<string, AbortController>());
  const submitCall = useRef<AbortController | null>(null);
  const peekTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const simulated = !onVote;
  const byId = useMemo(() => new Map(items.map(item => [item.id, item])), [items]);
  const rows = useMemo(
    () => [...order.map(entry => byId.get(entry)).filter((item): item is FeatureRequest => !!item), ...items.filter(item => !order.includes(item.id))],
    [order, byId, items],
  );
  const totalVotes = useMemo(() => items.reduce((sum, item) => sum + item.votes, 0), [items]);
  const similar = useMemo(() => (composerOpen ? findSimilar(draft.title, items).slice(0, 3) : []), [composerOpen, draft.title, items, findSimilar]);
  const liveOn = (live ?? (requests === undefined)) && !reduceMotion && !loading;

  // Sample votes keep arriving while the board is on screen: one row every 2.4–4.2 s, never the ones already shipped.
  useEffect(() => {
    if (!liveOn || !root.current) return;
    const node = root.current;
    let visible = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    observer?.observe(node);
    const schedule = () => {
      timer = setTimeout(() => {
        if (visible && !document.hidden) {
          setItems(current => {
            const candidates = current.filter(item => item.status !== "shipped");
            if (!candidates.length) return current;
            const weights = candidates.map(item => (item.trend ?? 1) + 4);
            let remaining = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
            const picked = candidates.find((item, index) => (remaining -= weights[index]) <= 0) ?? candidates[0];
            const taken = new Set((picked.voters ?? []).map(entry => entry.name));
            const pool = everyone().filter(entry => !taken.has(entry.name) && entry.name !== currentUser.name);
            const voter = pool[Math.floor(Math.random() * pool.length)];
            return current.map(item =>
              item.id !== picked.id
                ? item
                : {
                    ...item,
                    votes: item.votes + 1,
                    trend: (item.trend ?? 0) + 1,
                    voters: voter
                      ? (item.voted && item.voters?.[0]?.name === currentUser.name ? [item.voters[0], voter, ...item.voters.slice(1)] : [voter, ...(item.voters ?? [])]).slice(0, 6)
                      : item.voters,
                  },
            );
          });
        }
        schedule();
      }, 2400 + 1800 * Math.random());
    };
    schedule();
    return () => {
      if (timer) clearTimeout(timer);
      observer?.disconnect();
    };
  }, [liveOn, currentUser.name]);

  useEffect(() => {
    const calls = voteCalls.current;
    return () => {
      calls.forEach(call => call.abort());
      submitCall.current?.abort();
      if (peekTimer.current) clearTimeout(peekTimer.current);
    };
  }, []);

  /** Optimistic write: the count, the trend and the voter stack move together, then the request catches up. */
  const applyVote = (target: string, voted: boolean) => {
    setItems(current =>
      current.map(item => {
        if (item.id !== target || !!item.voted === voted) return item;
        const others = (item.voters ?? []).filter(entry => entry.name !== currentUser.name);
        return {
          ...item,
          voted,
          votes: Math.max(0, item.votes + (voted ? 1 : -1)),
          trend: Math.max(0, (item.trend ?? 0) + (voted ? 1 : -1)),
          voters: voted ? [currentUser, ...others] : others,
        };
      }),
    );
  };

  const castVote = (target: string, next?: boolean) => {
    const request = byId.get(target);
    if (!request || disabled) return;
    const voted = next ?? !request.voted;
    if (!!request.voted === voted) return;
    applyVote(target, voted);
    setMessage(voted ? `Voted for ${request.title}.${simulated ? " Simulated, nothing was sent." : ""}` : `Removed your vote from ${request.title}.`);
    voteCalls.current.get(target)?.abort();
    const controller = new AbortController();
    voteCalls.current.set(target, controller);
    Promise.resolve()
      .then(() => onVote?.(target, voted, controller.signal))
      .catch(() => {
        if (controller.signal.aborted) return;
        applyVote(target, !voted);
        setMessage("Your vote was not saved. Try again.");
      });
  };

  const openComposer = () => {
    if (disabled) return;
    setComposerOpen(true);
    requestAnimationFrame(() => titleField.current?.focus());
  };

  const closeComposer = (restoreFocus = false) => {
    submitCall.current?.abort();
    setComposerOpen(false);
    setPhase("idle");
    setDraft({ title: "", details: "" });
    if (restoreFocus) suggestButton.current?.focus();
  };

  const bump = (target: string) => setFlash(current => ({ id: target, n: (current?.n ?? 0) + 1 }));

  const nextDraft = { title: draft.title.trim(), details: draft.details.trim() };
  const canPost = nextDraft.title.length >= 4 && phase !== "sending";

  const post = async (event?: { preventDefault: () => void }) => {
    event?.preventDefault();
    if (!canPost) return;
    submitCall.current?.abort();
    const controller = new AbortController();
    submitCall.current = controller;
    setPhase("sending");
    try {
      const stored = onSubmit
        ? await onSubmit(nextDraft, controller.signal)
        : await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, 700);
            controller.signal.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
          });
      if (controller.signal.aborted) return;
      const request: FeatureRequest = stored ?? {
        id: `request-${Date.now().toString(36)}`,
        title: nextDraft.title,
        status: "review",
        votes: 1,
        comments: 0,
        createdAt: new Date().toISOString().slice(0, 10),
        trend: 1,
        voters: [currentUser],
        voted: true,
      };
      setItems(current => [request, ...current.filter(item => item.id !== request.id)]);
      setOrder(current => [request.id, ...current.filter(entry => entry !== request.id)]);
      setComposerOpen(false);
      setPhase("idle");
      setDraft({ title: "", details: "" });
      bump(request.id);
      setMessage(`Posted ${request.title}.${onSubmit ? "" : " Simulated, nothing was sent."}`);
    } catch {
      if (!controller.signal.aborted) setPhase("error");
    }
  };

  // A 90 ms delay on leave keeps the voters card from flickering when the pointer crosses the gap to it.
  const leavePeek = () => {
    if (peekTimer.current) clearTimeout(peekTimer.current);
    peekTimer.current = setTimeout(() => setPeeking(null), 90);
  };

  const statusId = `${id}-status`;

  return (
    <div {...props} ref={root} className={cx(styles.root, className)}>
      <section className={styles.card} aria-labelledby={`${id}-title`} aria-busy={loading || undefined}>
        <header className={styles.head}>
          <div className={styles.headText}>
            <h2 id={`${id}-title`} className={styles.title}>{title}</h2>
            <p className={styles.description}>{description}</p>
          </div>
          {!disabled && (
            <Button ref={suggestButton} size="sm" onClick={openComposer} aria-expanded={composerOpen} aria-controls={`${id}-composer`} className={styles.suggest}>
              <Plus size={16} aria-hidden="true" />
              <span>Suggest<span className={styles.wide}> a feature</span></span>
            </Button>
          )}
        </header>
        <AnimatePresence initial={false}>
          {composerOpen && (
            <motion.div key="composer" id={`${id}-composer`} className={styles.fold} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduceMotion ? INSTANT : FOLD}>
              <form
                className={styles.composer}
                onSubmit={post}
                onKeyDown={event => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    closeComposer(true);
                  }
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    void post();
                  }
                }}
                aria-label="Suggest a feature"
              >
                <input
                  ref={titleField}
                  className={styles.titleInput}
                  value={draft.title}
                  onChange={event => {
                    setDraft(current => ({ ...current, title: event.target.value }));
                    if (phase === "error") setPhase("idle");
                  }}
                  onKeyDown={event => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void post();
                    }
                  }}
                  placeholder="Short title, like Export votes to CSV"
                  aria-label="Request title"
                  aria-describedby={similar.length ? `${id}-similar` : undefined}
                  maxLength={80}
                  autoComplete="off"
                  disabled={phase === "sending"}
                />
                <AnimatePresence initial={false}>
                  {similar.length > 0 && (
                    <motion.div key="similar" className={styles.fold} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduceMotion ? INSTANT : FOLD}>
                      <div className={styles.similar}>
                        <p id={`${id}-similar`} className={styles.similarHead}>Similar requests already exist. Vote instead?</p>
                        <ul className={styles.similarList}>
                          <AnimatePresence initial={false}>
                            {similar.map(request => (
                              <motion.li key={request.id} className={styles.fold} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduceMotion ? INSTANT : FOLD}>
                                <div className={styles.similarRow}>
                                  <span className={styles.similarGlyph} data-status={request.status ?? "review"}>
                                    <StatusGlyph status={request.status ?? "review"} />
                                  </span>
                                  <span className={styles.similarTitle}>{request.title}</span>
                                  <span className={styles.similarVotes}>{counted(request.votes, "vote")}</span>
                                  <button
                                    type="button"
                                    className={styles.similarVote}
                                    data-voted={request.voted || undefined}
                                    onClick={() => {
                                      if (!request.voted) castVote(request.id, true);
                                      closeComposer();
                                      bump(request.id);
                                      setMessage(request.voted ? `You already voted for ${request.title}.` : `Voted for ${request.title} instead of posting a duplicate.${simulated ? " Simulated, nothing was sent." : ""}`);
                                    }}
                                    aria-label={`${request.voted ? "Go to" : "Vote for"} ${request.title}`}
                                  >
                                    {request.voted ? "Voted" : "Vote"}
                                  </button>
                                </div>
                              </motion.li>
                            ))}
                          </AnimatePresence>
                        </ul>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <textarea
                  className={styles.detailsInput}
                  value={draft.details}
                  onChange={event => setDraft(current => ({ ...current, details: event.target.value }))}
                  placeholder="What would it help your team do? (optional)"
                  aria-label="Details, optional"
                  rows={2}
                  maxLength={600}
                  disabled={phase === "sending"}
                />
                <div className={styles.composerFoot}>
                  <span className={styles.hint} data-error={phase === "error" || undefined} role={phase === "error" ? "alert" : undefined}>
                    {phase === "error" ? (
                      <>
                        <TriangleAlert size={14} aria-hidden="true" />
                        Your request was not posted. Try again.
                      </>
                    ) : "Public, with your name and vote."}
                  </span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => closeComposer(true)}>Cancel</Button>
                  <Button type="submit" size="sm" disabled={!canPost} loading={phase === "sending"}>Post request</Button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
        <div className={styles.toolbar}>
          <SegmentedControl
            options={SORTS}
            value={sort}
            onValueChange={next => {
              const value = next as FeatureSort;
              setSort(value);
              setOrder(sortRequests(items, value));
              setPeeking(null);
              onSortChange?.(value);
            }}
            label="Sort requests"
          />
          <span className={styles.tally}>
            <RollingDigits value={totalVotes} reduced={reduceMotion} />
            {" votes"}
            <span className={styles.srOnly}>{counted(totalVotes, "vote")} on {counted(items.length, "request")}</span>
          </span>
        </div>
        {loading ? (
          <ul className={styles.list} aria-label="Loading requests">
            {[0, 1, 2, 3].map(index => (
              <li key={index} className={styles.row}>
                <div className={styles.rowInner}>
                  <span className={styles.skeletonVote} />
                  <span className={styles.body}>
                    <span className={styles.skeletonLine} style={{ width: `${[62, 48, 56, 40][index]}%` }} />
                    <span className={styles.skeletonLine} data-short="" />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No requests yet</p>
            <p className={styles.emptyText}>Be the first to tell the team what to build.</p>
            {!disabled && !composerOpen && (
              <Button size="sm" variant="secondary" onClick={openComposer}>
                <Plus size={16} aria-hidden="true" />
                Suggest a feature
              </Button>
            )}
          </div>
        ) : (
          <ul className={styles.list} aria-label={`Requests, sorted by ${SORTS.find(option => option.value === sort)?.label.toLowerCase()}`}>
            <AnimatePresence initial={false}>
              {rows.map(request => {
                const faces = (request.voters ?? []).slice(0, 2).map(entry => (request.voted && entry.name === currentUser.name ? "You" : entry.name));
                const rest = Math.max(0, request.votes - faces.length);
                const crowd = faces.length ? { names: faces, rest } : { names: [] as string[], rest: request.votes };
                const showPeek = peeking === request.id && (request.voters?.length ?? 0) > 0;
                return (
                  <motion.li
                    key={request.id}
                    layout="position"
                    className={styles.row}
                    data-peek={showPeek || undefined}
                    initial={{ height: 0, opacity: 0, overflow: "hidden" }}
                    animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
                    transition={reduceMotion ? INSTANT : { layout: MOVE, height: MOVE, opacity: FADE }}
                  >
                    {flash?.id === request.id && (
                      <motion.span key={flash.n} className={styles.flash} aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: reduceMotion ? 0.9 : 1.5, times: [0, 0.12, 0.5, 1], ease: "easeOut" as const }} />
                    )}
                    <div className={styles.rowInner}>
                      <div
                        className={styles.voteCell}
                        onPointerEnter={event => {
                          if (event.pointerType === "touch") return;
                          if (peekTimer.current) clearTimeout(peekTimer.current);
                          if (peeking) setPeeking(request.id);
                          else peekTimer.current = setTimeout(() => setPeeking(request.id), 320);
                        }}
                        onPointerLeave={leavePeek}
                      >
                        <motion.button
                          type="button"
                          className={styles.vote}
                          aria-pressed={!!request.voted}
                          aria-label={`${request.voted ? "Remove vote from" : "Vote for"} ${request.title}, ${counted(request.votes, "vote")}`}
                          onClick={() => castVote(request.id)}
                          onFocus={event => {
                            if (event.currentTarget.matches(":focus-visible")) {
                              if (peekTimer.current) clearTimeout(peekTimer.current);
                              setPeeking(request.id);
                            }
                          }}
                          onBlur={() => setPeeking(current => (current === request.id ? null : current))}
                          disabled={disabled}
                          whileTap={reduceMotion || disabled ? undefined : { scale: 0.94 }}
                          transition={motionTokens.spring.snappy}
                        >
                          <span className={styles.voteIcon}><ChevronUp size={16} strokeWidth={2.25} aria-hidden="true" /></span>
                          <RollingDigits value={request.votes} reduced={reduceMotion} />
                        </motion.button>
                        <AnimatePresence>
                          {showPeek && (
                            <motion.div
                              key="peek"
                              className={styles.peek}
                              aria-hidden="true"
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 2, transition: { duration: 0.1 * (reduceMotion ? 0 : 1) } }}
                              transition={reduceMotion ? INSTANT : FADE}
                            >
                              <span className={styles.stack}>
                                {(request.voters ?? []).slice(0, 4).map(entry => <Avatar key={entry.name} name={entry.name} src={entry.src} size="sm" className={styles.face} />)}
                              </span>
                              <span className={styles.peekText}>
                                {crowd.names.map((name, index) => (
                                  <span key={name}>
                                    {index > 0 && (crowd.rest > 0 ? ", " : " and ")}
                                    <span className={styles.peekName}>{name}</span>
                                  </span>
                                ))}
                                {crowd.rest > 0 && <> and {counted(crowd.rest, "other")}</>}
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className={styles.body}>
                        {onOpenRequest ? (
                          <button type="button" className={cx(styles.rowTitle, styles.titleButton)} onClick={() => onOpenRequest(request.id)}>{request.title}</button>
                        ) : (
                          <p className={styles.rowTitle}>{request.title}</p>
                        )}
                        <div className={styles.meta}>
                          {request.status && <StatusChip status={request.status} />}
                          {request.tag && (
                            <span className={cx(styles.metaItem, styles.tag)}>
                              {request.tag.mark && <Mark id={request.tag.mark} className={styles.mark} />}
                              {request.tag.label}
                            </span>
                          )}
                          <span className={styles.metaItem} aria-label={counted(request.comments, "comment")}>
                            <MessageSquare size={14} aria-hidden="true" />
                            <span className={styles.num}>{request.comments}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
        <footer className={styles.foot}>
          <span className={styles.message} aria-hidden="true">
            <AnimatePresence initial={false}>
              <motion.span
                key={message}
                className={styles.messageText}
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0, transition: reduceMotion ? INSTANT : { ...FADE, delay: 0.06 } }}
                exit={{ opacity: 0, transition: { duration: 0.1 * (reduceMotion ? 0 : 1) } }}
              >
                {message}
              </motion.span>
            </AnimatePresence>
          </span>
          <span id={statusId} className={styles.srOnly} role="status" aria-live="polite">{message === DEFAULT_MESSAGE ? "" : message}</span>
        </footer>
      </section>
    </div>
  );
}

export { FeatureVoting };
