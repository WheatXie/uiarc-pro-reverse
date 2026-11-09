/**
 * AI search bar — an Arc Pro block, reconstructed from the shipped preview runtime
 * (`_next/static/chunks/` module 71169 for the component, 76266 for the keycap module) and its
 * style sheet (`ai-search-bar_*`, `kbd_*`).
 *
 * Behaviour kept from the original:
 * - the field is a combobox that owns a listbox of results, and when nothing is typed, a list of
 *   recent searches and suggested questions; a new query aborts the one in flight;
 * - Up/Down wrap the list and move `aria-activedescendant`, scrolling the active row into view;
 *   Enter opens, Tab asks the AI, Escape closes the answer and then clears the field;
 * - asking streams sources then text, and the text is revealed in small token bursts on an
 *   animation frame budget so `[n]` citations and inline code keep their shape while streaming;
 * - citations light up their result row, and following one moves the active row to that source;
 * - the answer region, the field icon and the footer swap with layout-safe exits, and the body
 *   morphs its height on a critically damped spring that is skipped under reduced motion;
 * - the whole loop (type, ask, stream, clear, tour) plays itself until the first interaction.
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, animate, motion, useReducedMotion, type Transition } from "motion/react";
import {
  Check,
  Clock,
  Copy,
  CornerDownLeft,
  FileText,
  RotateCcw,
  Search,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import styles from "./ai-search-bar.module.css";
import kbdStyles from "./kbd.module.css";

/* ── Types ─────────────────────────────────────────────────────────────────────── */

/** Workflow state of an issue result; drives the status glyph and its label. */
export type IssueStatus = "backlog" | "todo" | "progress" | "review" | "done";

/** One row of the result list. */
export interface SearchResult {
  /** Stable id, also used to resolve answer citations. */
  id: string;
  /** Id of the group this row belongs to. */
  group: string;
  /** The row title, highlighted against the query tokens. */
  title: string;
  /** Muted text after the title — a collection name, an issue key or an account owner. */
  description?: string;
  /** Right-aligned trailing label, such as `Guide` or `$412k ARR`. */
  meta?: string;
  /** Extra words the demo search matches against; a real `search` may ignore them. */
  keywords?: readonly string[];
  /** Issue state; renders the status glyph and replaces `meta` with its label. */
  status?: IssueStatus;
  /** Custom leading mark. Falls back to the group mark. */
  icon?: ReactNode;
}

/** A headed section of the result list. */
export interface SearchGroup {
  id: string;
  label: string;
  /** Leading mark for rows that do not bring their own. */
  icon?: ReactNode;
  /** Optional provenance shown at the right of the group heading. */
  source?: { name: string; mark: ReactNode };
}

/** The footer model chip. */
export interface SearchModel {
  name: string;
  mark?: ReactNode;
}

/** One chunk of a streamed answer: cited result ids first, then text. */
export type AnswerChunk = { type: "sources"; ids: readonly string[] } | { type: "text"; text: string };

/** Everything an answer function needs. */
export interface AnswerRequest {
  query: string;
  /** Results the user is looking at when the answer starts. */
  results: readonly SearchResult[];
  /** Aborted when the answer is closed, retried or the query changes. */
  signal: AbortSignal;
}

/** Writes an answer as an async iterable of chunks. */
export type AnswerFn = (request: AnswerRequest) => AsyncIterable<AnswerChunk>;

/** Runs a search. Return an array for instant results, or a promise to show the field spinner. */
export type SearchFn = (query: string, signal: AbortSignal) => readonly SearchResult[] | Promise<readonly SearchResult[]>;

/** Async generator the demo answer uses. */
export type DemoAnswerFn = (request: AnswerRequest) => AsyncGenerator<AnswerChunk>;

export interface AiSearchBarProps {
  /** Placeholder for the empty field. */
  placeholder?: string;
  /** Groups shown as headings, in this order. Rows in other groups collect under “Other”. */
  groups?: readonly SearchGroup[];
  /** Runs the search. Defaults to `demoSearch` over `sampleResults`. */
  search?: SearchFn;
  /** Writes the answer. Defaults to the scripted `demoAnswer`. */
  answer?: AnswerFn;
  /** Recent searches offered before anything is typed; kept to three, newest first. */
  recent?: readonly string[];
  /** Questions offered under “Ask AI” while the field is empty. */
  suggestions?: readonly string[];
  /** Name and mark in the footer. Defaults to Claude Sonnet 5.5. */
  model?: SearchModel;
  /** Plays the demo by itself — typing, asking, clearing, touring — until the first interaction. Defaults to true only when neither `search` nor `answer` is given. */
  autoPlay?: boolean;
  /** Called when a result row is opened. Also suppresses the “nothing was opened” notice. */
  onSelect?: (result: SearchResult) => void;
  /** Called with the question the moment an answer starts. */
  onAsk?: (query: string) => void;
  /** Extra class on the card, after the block's own. */
  className?: string;
}

/* ── Icons and sample data ─────────────────────────────────────────────────────── */

const BRAND = { width: 16, height: 16, viewBox: "0 0 24 24", "aria-hidden": true, focusable: false } as const;

const STATUS_LABEL: Record<IssueStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  progress: "In progress",
  review: "In review",
  done: "Done",
};

const ClaudeMark = () => (
  <svg {...BRAND}>
    <path
      fill="#D97757"
      d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"
    />
  </svg>
);

const LinearMark = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      fill="#5E6AD2"
      d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z"
    />
  </svg>
);

const VercelMark = () => (
  <svg {...BRAND}>
    <path fill="currentColor" d="m12 1.608 12 20.784H0Z" />
  </svg>
);

const NotionMark = () => (
  <svg {...BRAND}>
    <path
      fill="currentColor"
      d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"
    />
  </svg>
);

const ShopifyMark = () => (
  <svg {...BRAND}>
    <path
      fill="#7AB55C"
      d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zM11.71 11.305s-.81-.424-1.774-.424c-1.447 0-1.504.906-1.504 1.141 0 1.232 3.24 1.715 3.24 4.629 0 2.295-1.44 3.76-3.406 3.76-2.354 0-3.54-1.465-3.54-1.465l.646-2.086s1.245 1.066 2.28 1.066c.675 0 .975-.545.975-.932 0-1.619-2.654-1.694-2.654-4.359-.034-2.237 1.571-4.416 4.827-4.416 1.257 0 1.875.361 1.875.361l-.945 2.715-.02.01zM11.17.83c.136 0 .271.038.405.135-.984.465-2.064 1.639-2.508 3.992-.656.213-1.293.405-1.889.578C7.697 3.75 8.951.84 11.17.84V.83zm1.235 2.949v.135c-.754.232-1.583.484-2.394.736.466-1.777 1.333-2.645 2.085-2.971.193.501.309 1.176.309 2.1zm.539-2.234c.694.074 1.141.867 1.429 1.755-.349.114-.735.231-1.158.366v-.252c0-.752-.096-1.371-.271-1.871v.002zm2.992 1.289c-.02 0-.06.021-.078.021s-.289.075-.714.21c-.423-1.233-1.176-2.37-2.508-2.37h-.115C12.135.209 11.669 0 11.265 0 8.159 0 6.675 3.877 6.21 5.846c-1.194.365-2.063.636-2.16.674-.675.213-.694.232-.772.87-.075.462-1.83 14.063-1.83 14.063L15.009 24l.927-21.166z"
    />
  </svg>
);

const FigmaMark = () => (
  <svg {...BRAND} viewBox="0 0 38 57">
    <path fill="#1ABCFE" d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" />
    <path fill="#0ACF83" d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" />
    <path fill="#FF7262" d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" />
    <path fill="#F24E1E" d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" />
    <path fill="#A259FF" d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" />
  </svg>
);

const SupabaseMark = () => (
  <svg {...BRAND}>
    <path
      fill="#3FCF8E"
      d="M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C-.33 13.427.65 15.455 2.409 15.455h9.579l.113 7.51c.014.985 1.259 1.408 1.873.636l9.262-11.653c1.093-1.375.113-3.403-1.645-3.403h-9.642z"
    />
  </svg>
);

const RaycastMark = () => (
  <svg {...BRAND}>
    <path
      fill="#FF6363"
      d="M6.004 15.492v2.504L0 11.992l1.258-1.249Zm2.504 2.504H6.004L12.008 24l1.253-1.253zm14.24-4.747L24 11.997 12.003 0 10.75 1.251 15.491 6h-2.865L9.317 2.692 8.065 3.944l2.06 2.06H8.691v9.31H18v-1.432l2.06 2.06 1.252-1.252-3.312-3.32V8.506ZM6.63 5.372 5.38 6.625l1.342 1.343 1.251-1.253Zm10.655 10.655-1.247 1.251 1.342 1.343 1.253-1.251zM3.944 8.059 2.692 9.31l3.312 3.314v-2.506zm9.936 9.937h-2.504l3.314 3.312 1.25-1.252z"
    />
  </svg>
);

/** Groups shipped with the block: docs, customers and Linear issues. */
export const sampleGroups: readonly SearchGroup[] = [
  { id: "docs", label: "Docs", icon: <FileText size={16} strokeWidth={1.75} aria-hidden="true" /> },
  { id: "customers", label: "Customers" },
  {
    id: "issues",
    label: "Issues",
    source: { name: "Linear", mark: <LinearMark /> },
  },
];

/** A nine-doc, six-customer, eight-issue corpus that the demo search and answer read from. */
export const sampleResults: readonly SearchResult[] = [
  { id: "doc-retries", group: "docs", title: "Webhook retries and backoff", description: "Webhooks", meta: "Guide", keywords: ["webhook", "retry", "retries", "backoff", "failed", "delivery"] },
  { id: "doc-replay", group: "docs", title: "Replaying failed events", description: "Webhooks", meta: "Guide", keywords: ["webhook", "replay", "resend", "retry", "event"] },
  { id: "doc-signatures", group: "docs", title: "Verifying webhook signatures", description: "Security", meta: "Guide", keywords: ["webhook", "signature", "hmac", "secret"] },
  { id: "doc-saml", group: "docs", title: "SAML single sign-on", description: "Security", meta: "Guide", keywords: ["sso", "saml", "okta", "entra", "login"] },
  { id: "doc-enforce", group: "docs", title: "Enforcing SSO for a workspace", description: "Admin", meta: "Guide", keywords: ["sso", "saml", "enforce", "owner", "login"] },
  { id: "doc-scim", group: "docs", title: "SCIM provisioning with Okta", description: "Security", meta: "Guide", keywords: ["scim", "okta", "provisioning", "sso"] },
  { id: "doc-keys", group: "docs", title: "Rotating API keys", description: "Security", meta: "Guide", keywords: ["api", "key", "keys", "rotate", "rotation", "revoke", "secret"] },
  { id: "doc-rate", group: "docs", title: "Rate limits", description: "API reference", meta: "API", keywords: ["rate", "limit", "429", "retry"] },
  { id: "doc-plans", group: "docs", title: "Plans and seat limits", description: "Billing", meta: "Guide", keywords: ["plan", "enterprise", "seats", "billing", "pricing"] },
  { id: "cus-vercel", group: "customers", title: "Vercel", description: "Enterprise · Maya Chen", meta: "$412k ARR", icon: <VercelMark />, keywords: ["webhook", "retries", "410", "enterprise"] },
  { id: "cus-notion", group: "customers", title: "Notion", description: "Enterprise · Daniel Okafor", meta: "$386k ARR", icon: <NotionMark />, keywords: ["sso", "saml", "okta", "enterprise"] },
  { id: "cus-shopify", group: "customers", title: "Shopify", description: "Enterprise · Sam Rivera", meta: "$520k ARR", icon: <ShopifyMark />, keywords: ["webhooks", "rate", "enterprise"] },
  { id: "cus-figma", group: "customers", title: "Figma", description: "Enterprise · Priya Raman", meta: "$298k ARR", icon: <FigmaMark />, keywords: ["scim", "sso", "enterprise"] },
  { id: "cus-supabase", group: "customers", title: "Supabase", description: "Scale · Jonas Weber", meta: "$96k ARR", icon: <SupabaseMark />, keywords: ["webhook", "replay", "rate"] },
  { id: "cus-raycast", group: "customers", title: "Raycast", description: "Scale · Lea Martin", meta: "$54k ARR", icon: <RaycastMark />, keywords: ["api", "key", "rotate", "rotation"] },
  { id: "API-2481", group: "issues", title: "Retries stop after a 410 response", description: "API-2481", status: "progress", keywords: ["webhook", "retries", "retry", "410", "vercel"] },
  { id: "API-2463", group: "issues", title: "Backoff ignores the Retry-After header", description: "API-2463", status: "done", keywords: ["webhook", "retries", "backoff"] },
  { id: "API-2390", group: "issues", title: "Show next retry time in delivery logs", description: "API-2390", status: "todo", keywords: ["webhook", "retries", "logs", "delivery"] },
  { id: "AUTH-912", group: "issues", title: "Okta login loops back to sign-in", description: "AUTH-912", status: "review", keywords: ["sso", "saml", "okta", "login"] },
  { id: "AUTH-874", group: "issues", title: "SCIM deprovisioning leaves sessions active", description: "AUTH-874", status: "progress", keywords: ["scim", "okta", "sessions", "sso"] },
  { id: "API-2502", group: "issues", title: "Revoked keys keep working for 24 hours", description: "API-2502", status: "backlog", keywords: ["api", "key", "keys", "rotate", "revoke"] },
  { id: "API-2477", group: "issues", title: "429s on the replay endpoint during bursts", description: "API-2477", status: "todo", keywords: ["replay", "rate", "429", "webhook"] },
  { id: "BILL-311", group: "issues", title: "Seat count off by one after a downgrade", description: "BILL-311", status: "todo", keywords: ["enterprise", "seats", "plan", "billing"] },
];

const DEFAULT_RECENT = ["webhook retries", "Figma", "AUTH-912"] as const;
const DEFAULT_SUGGESTIONS = [
  "How do I set up SAML SSO?",
  "How do I rotate an API key safely?",
  "Why do webhook retries stop early?",
] as const;
const DEFAULT_MODEL: SearchModel = { name: "Claude Sonnet 5.5", mark: <ClaudeMark /> };

/* ── Search and answer demo engine ─────────────────────────────────────────────── */

const STOPWORDS = new Set([
  "a", "an", "and", "are", "can", "do", "does", "for", "how", "i", "in", "is", "it", "my", "of",
  "on", "or", "our", "set", "the", "to", "up", "we", "what", "when", "where", "which", "who", "why",
  "with", "you",
]);

/** Splits a question into matching words, dropping the filler a search box should ignore. */
export function tokenizeQuery(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));
}

/** Substring match with a little plural tolerance, so `retries` also finds `retry`. */
const matches = (haystack: string, token: string) =>
  haystack.includes(token) ||
  haystack.includes(token.endsWith("ies") ? `${token.slice(0, -3)}y` : token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token);

/** Scores the corpus by keyword overlap and keeps at most `perGroup` rows per group. */
export function demoSearch(query: string, corpus: readonly SearchResult[] = sampleResults, perGroup = 3): SearchResult[] {
  const tokens = tokenizeQuery(query);
  if (!tokens.length) return [];
  const need = Math.max(1, Math.ceil(tokens.length / 2));
  const scored = corpus
    .map((item, order) => {
      const haystack = [item.title, item.description, ...(item.keywords ?? [])].join(" ").toLowerCase();
      const title = item.title.toLowerCase();
      return {
        item,
        order,
        score: tokens.filter((token) => matches(haystack, token)).length,
        titleScore: tokens.filter((token) => matches(title, token)).length,
      };
    })
    .filter((entry) => entry.score >= need);
  scored.sort((a, b) => b.score - a.score || b.titleScore - a.titleScore || a.order - b.order);
  const taken = new Map<string, number>();
  return scored
    .filter(({ item }) => {
      const count = taken.get(item.group) ?? 0;
      taken.set(item.group, count + 1);
      return count < perGroup;
    })
    .map((entry) => entry.item);
}

const SCRIPTS = [
  {
    match: (tokens: string[]) => tokens.some((token) => token.startsWith("retr")) || (tokens.includes("webhook") && tokens.length === 1),
    ids: ["doc-retries", "API-2481", "cus-vercel", "doc-replay"],
    text: "Failed deliveries are retried 8 times over about 3 days, with exponential backoff starting at 30 seconds [1]. Right now a 410 response stops retries early. The fix is in progress in API-2481 [2], first reported by Vercel on October 24 [3]. To resend sooner, replay the event from the delivery log or call `POST /v1/events/:id/replay` [4].",
  },
  {
    match: (tokens: string[]) => tokens.includes("sso") || tokens.includes("saml"),
    ids: ["doc-saml", "doc-enforce", "AUTH-912", "cus-notion"],
    text: "Workspace admins turn on SAML in Settings, Security, then paste the metadata URL from Okta, Entra ID or Google Workspace [1]. Run one test login before you enforce SSO, and keep one owner on email login as a break glass account [2]. If Okta logins loop back to the sign-in page, that is AUTH-912, now in review [3]. Notion finished the same rollout on October 14 [4].",
  },
  {
    match: (tokens: string[]) => tokens.some((token) => token.startsWith("key") || token.startsWith("rotat")),
    ids: ["doc-keys", "API-2502", "cus-raycast"],
    text: "Create a second key in Settings, API keys, deploy it everywhere, then revoke the old one; both keys work in the meantime [1]. Revoked keys currently keep working for up to 24 hours, tracked in API-2502, so revoke early if a key leaked [2]. Raycast rotates every 90 days with `POST /v1/keys/:id/roll` [3].",
  },
] as const;

/** Sleeps, and rejects with the signal reason as soon as the answer is abandoned. */
export const delay = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });

/**
 * Scripted stand-in for a retrieval-augmented answer: it cites the ids of the three matching
 * scripts, or falls back to naming the closest results, and streams the prose in 14-word beats.
 */
export const demoAnswer: DemoAnswerFn = async function* demoAnswer({ query, results, signal }) {
  const tokens = tokenizeQuery(query);
  const available = new Set(results.map((result) => result.id));
  const script = SCRIPTS.find((entry) => entry.match(tokens) && entry.ids.every((id) => available.has(id)));
  await delay(260, signal);

  if (script) {
    yield { type: "sources", ids: script.ids };
    await delay(520, signal);
    const words = script.text.split(" ");
    for (let start = 0; start < words.length; start += 14) {
      yield { type: "text", text: words.slice(start, start + 14).join(" ") + (start + 14 < words.length ? " " : "") };
      await delay(90, signal);
    }
    return;
  }

  await delay(520, signal);
  const closest = results.slice(0, 3);
  if (!closest.length) {
    yield {
      type: "text",
      text: `Nothing in your docs, customers or issues mentions “${query.trim()}”. Try a broader term, or ask in #support where the team can pick it up.`,
    };
    return;
  }
  yield { type: "sources", ids: closest.map((result) => result.id) };
  const named = closest.map((result, index) => `${result.title} [${index + 1}]`);
  const list = named.length > 1 ? `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}` : named[0];
  yield { type: "text", text: `There is no single answer to that yet. The closest matches are ${list}. Open one below, or ask a more specific question.` };
};

/* ── Answer rendering helpers ──────────────────────────────────────────────────── */

type Token = { kind: "text"; value: string } | { kind: "code"; value: string; space: string } | { kind: "cite"; n: number };

/** Splits answer prose into text runs, inline code and citation numbers, hiding a half-written token. */
export function tokenizeAnswer(text: string, streamDone: boolean): Token[] {
  let source = text;
  if (!streamDone) {
    if ((source.match(/`/g)?.length ?? 0) % 2 === 1) source = source.slice(0, source.lastIndexOf("`"));
    const open = source.lastIndexOf("[");
    if (open > source.lastIndexOf("]")) source = source.slice(0, open);
  }
  const tokens: Token[] = [];
  for (const match of source.matchAll(/`([^`]+)`(\s*)|\[(\d+)\]|[^\s[`]+\s*|\s+|[[`]/g)) {
    if (match[1] !== undefined) tokens.push({ kind: "code", value: match[1], space: match[2] ?? "" });
    else if (match[3] !== undefined) tokens.push({ kind: "cite", n: Number(match[3]) });
    else tokens.push({ kind: "text", value: match[0] });
  }
  if (!streamDone && tokens.length > 0 && !/\s$/.test(source)) tokens.pop();
  return tokens;
}

/** Wraps every query token (and its singular) in a `<mark>`, longest token first. */
function highlight(title: string, tokens: readonly string[]): ReactNode {
  const patterns = [
    ...new Set(
      tokens.flatMap((token) => [
        token,
        token.endsWith("ies") ? `${token.slice(0, -3)}y` : token.endsWith("s") && token.length > 3 ? token.slice(0, -1) : token,
      ]),
    ),
  ]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!patterns.length) return title;
  const split = new RegExp(`(${patterns.join("|")})`, "gi");
  return title.split(split).map((part, index) =>
    index % 2 === 1 ? (
      <mark className={styles.hl} key={index}>
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

const STATUS_GEOMETRY: Record<IssueStatus, ReactNode> = {
  backlog: <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.2 2.2" />,
  todo: <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />,
  progress: (
    <>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5v7a3.5 3.5 0 0 0 0-7Z" fill="currentColor" />
    </>
  ),
  review: (
    <>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5A3.5 3.5 0 1 1 4.5 8H8Z" fill="currentColor" />
    </>
  ),
  done: (
    <>
      <circle cx="8" cy="8" r="6.75" fill="currentColor" />
      <path d="m5.25 8.15 1.9 1.85 3.6-3.75" fill="none" stroke="var(--surface)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

/** The 16px issue glyph for a workflow state. */
function StatusIcon({ status }: { status: IssueStatus }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className={styles.status} data-status={status} focusable="false">
      {STATUS_GEOMETRY[status]}
    </svg>
  );
}

/* ── Keycap ────────────────────────────────────────────────────────────────────── */

type Platform = "mac" | "pc";

interface KeyGlyph {
  id: string;
  glyph: string;
  name: string;
}

const KEY_GLYPHS: Record<string, (mac: boolean) => KeyGlyph> = {
  up: () => ({ id: "up", glyph: "↑", name: "Up arrow" }),
  down: () => ({ id: "down", glyph: "↓", name: "Down arrow" }),
  enter: (mac) => ({ id: "enter", glyph: mac ? "↵" : "Enter", name: mac ? "Return" : "Enter" }),
  tab: (mac) => ({ id: "tab", glyph: mac ? "⇥" : "Tab", name: "Tab" }),
  esc: () => ({ id: "esc", glyph: "Esc", name: "Escape" }),
};

const readPlatform = (): Platform => {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform || nav.platform || nav.userAgent) ? "mac" : "pc";
};

const usePlatform = (): Platform => {
  const [platform, setPlatform] = useState<Platform>("mac");
  useEffect(() => setPlatform(readPlatform()), []);
  return platform;
};

const glyphFor = (key: string, mac: boolean): KeyGlyph =>
  KEY_GLYPHS[key]?.(mac) ?? {
    id: key,
    glyph: key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1),
    name: key,
  };

/** One or more keys, drawn as physical caps; `pressed` sinks them into their ledge. */
function Kbd({ keys, size = "md", pressed = false }: { keys: string; size?: "sm" | "md" | "lg"; pressed?: boolean }) {
  const mac = usePlatform() === "mac";
  const parsed = keys.replace(/\+\+$/, "+plus").split("+").filter(Boolean).map((key) => glyphFor(key.trim().toLowerCase(), mac));
  return (
    <kbd className={[kbdStyles.kbd, kbdStyles[size]].join(" ")}>
      {parsed.map((key, index) => (
        <span className={kbdStyles.slot} key={`${key.id}-${index}`}>
          {index > 0 && <span className={kbdStyles.hidden}> </span>}
          <kbd className={kbdStyles.key} data-pressed={pressed ? "" : undefined}>
            {key.glyph === key.name ? (
              key.glyph
            ) : (
              <>
                <span className={kbdStyles.glyph} aria-hidden="true">
                  {key.glyph}
                </span>
                <span className={kbdStyles.hidden}>{key.name}</span>
              </>
            )}
          </kbd>
        </span>
      ))}
    </kbd>
  );
}

/* ── Answer state and items ────────────────────────────────────────────────────── */

type AnswerStatus = "idle" | "thinking" | "streaming" | "done" | "error";

interface AnswerState {
  run: number;
  status: AnswerStatus;
  query: string;
  sources: readonly string[];
  text: string;
  streamDone: boolean;
  startedAt: number;
  error?: string;
}

const IDLE_ANSWER: AnswerState = { run: 0, status: "idle", query: "", sources: [], text: "", streamDone: false, startedAt: 0 };

type Item =
  | { kind: "recent"; text: string }
  | { kind: "suggestion"; text: string }
  | { kind: "ask" }
  | { kind: "result"; result: SearchResult };

const ENTER: Transition = { duration: 0.16, ease: [0.22, 1, 0.36, 1] };
const EXIT: Transition = { duration: 0.1, ease: [0.4, 0, 1, 1] };
const MORPH: Transition = { type: "spring", visualDuration: 0.24, bounce: 0 };

/* ── Component ─────────────────────────────────────────────────────────────────── */

/**
 * A search field that answers questions about what it finds: results stay on top, the AI answer
 * streams into a card above them, and the whole thing is driveable from the keyboard alone.
 */
export function AiSearchBar({
  placeholder = "Search docs, customers and issues",
  groups = sampleGroups,
  search,
  answer,
  recent = DEFAULT_RECENT,
  suggestions = DEFAULT_SUGGESTIONS,
  model = DEFAULT_MODEL,
  autoPlay,
  onSelect,
  onAsk,
  className,
}: AiSearchBarProps) {
  const id = useId();
  const reduced = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const [recentItems, setRecentItems] = useState<readonly string[]>(recent);
  const [answerState, setAnswerState] = useState<AnswerState>(IDLE_ANSWER);
  const [revealStops, setRevealStops] = useState<readonly number[]>([]);
  const [hotCite, setHotCite] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const [live, setLive] = useState("");
  const [tabPressed, setTabPressed] = useState(false);
  const [copied, setCopied] = useState(false);

  const answerRef = useRef(answerState);
  const revealedCount = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<readonly SearchResult[]>(results);
  const settledQuery = useRef("");

  useEffect(() => {
    answerRef.current = answerState;
    resultsRef.current = results;
  });

  const queryTokens = useMemo(() => tokenizeQuery(query), [query]);
  const hasQuery = query.trim().length > 0;
  const busy = answerState.status !== "idle";

  // Search on every keystroke; a promise result keeps the previous rows until it settles.
  useEffect(() => {
    if (!hasQuery) {
      resultsRef.current = [];
      settledQuery.current = "";
      setResults([]);
      setSearching(false);
      return;
    }
    const run = search ?? ((value: string) => demoSearch(value));
    const controller = new AbortController();
    const outcome = run(query, controller.signal);
    const settle = (rows: readonly SearchResult[]) => {
      resultsRef.current = rows;
      settledQuery.current = query;
      setResults(rows);
      setSearching(false);
    };
    const isRows = (value: readonly SearchResult[] | Promise<readonly SearchResult[]>): value is readonly SearchResult[] =>
      Array.isArray(value);
    if (isRows(outcome)) {
      settle(outcome);
      return;
    }
    setSearching(true);
    void outcome.then(
      (rows: readonly SearchResult[]) => {
        if (!controller.signal.aborted) settle(rows);
      },
      () => {
        if (!controller.signal.aborted) {
          settledQuery.current = query;
          setSearching(false);
        }
      },
    );
    return () => controller.abort();
  }, [query, hasQuery, search]);

  const grouped = useMemo(() => {
    const known = new Set(groups.map((group) => group.id));
    const sections = groups.map((group) => ({ group, items: results.filter((result) => result.group === group.id) }));
    const rest = results.filter((result) => !known.has(result.group));
    if (rest.length) sections.push({ group: { id: "other", label: "Other" }, items: rest });
    return sections.filter((section) => section.items.length > 0);
  }, [groups, results]);

  const items = useMemo<Item[]>(() => {
    if (!hasQuery) {
      return [
        ...recentItems.map((text) => ({ kind: "recent" as const, text })),
        ...suggestions.map((text) => ({ kind: "suggestion" as const, text })),
      ];
    }
    const list: Item[] = busy ? [] : [{ kind: "ask" }];
    grouped.forEach((section) => section.items.forEach((result) => list.push({ kind: "result", result })));
    return list;
  }, [hasQuery, recentItems, suggestions, busy, grouped]);

  const firstResult = items.findIndex((item) => item.kind === "result");
  const resultsKey = results.map((result) => result.id).join();

  // Keep the keyboard cursor on the first result whenever the list itself changes.
  useEffect(() => {
    setActive(hasQuery ? Math.max(0, firstResult) : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, resultsKey, busy]);

  const optionId = (index: number) => `${id}-option-${index}`;

  const scrollToOption = useCallback(
    (index: number) => {
      const option = document.getElementById(optionId(index));
      const scroller = bodyRef.current?.querySelector<HTMLElement>("[data-scroll]");
      if (!option || !scroller) return;
      const top = option.offsetTop - 8;
      const bottom = option.offsetTop + option.offsetHeight + 8;
      if (top < scroller.scrollTop) {
        scroller.scrollTo({ top: Math.max(0, top - 28), behavior: reduced ? "auto" : "smooth" });
      } else if (bottom > scroller.scrollTop + scroller.clientHeight) {
        scroller.scrollTo({ top: bottom - scroller.clientHeight, behavior: reduced ? "auto" : "smooth" });
      }
    },
    // optionId only depends on the stable id.
    [id, reduced],
  );

  const notify = useCallback((text: string, spoken: string = text) => {
    setNotice({ id: Date.now(), text });
    setLive(spoken);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2400);
    return () => clearTimeout(timer);
  }, [notice]);

  const remember = useCallback((value: string) => {
    const text = value.trim();
    if (!text) return;
    setRecentItems((current) => [text, ...current.filter((entry) => entry.toLowerCase() !== text.toLowerCase())].slice(0, 3));
  }, []);

  const resetAnswer = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    revealedCount.current = 0;
    setRevealStops([]);
    setHotCite(null);
    setAnswerState((current) => (current.status === "idle" ? current : { ...IDLE_ANSWER, run: current.run }));
  }, []);

  const ask = useCallback(
    (value: string) => {
      const text = value.trim();
      if (!text) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      revealedCount.current = 0;
      setRevealStops([]);
      setHotCite(null);
      setCopied(false);
      const run = answerRef.current.run + 1;
      setAnswerState({ run, status: "thinking", query: text, sources: [], text: "", streamDone: false, startedAt: performance.now() });
      remember(text);
      onAsk?.(text);
      notify(answer ? "Asking AI." : "Asking AI. Simulated, nothing was sent.");
      bodyRef.current?.querySelector<HTMLElement>("[data-scroll]")?.scrollTo({ top: 0 });

      const stream = answer ?? demoAnswer;
      void (async () => {
        try {
          // Wait for the result set for this query to land, so citations resolve against it.
          for (let step = 0; step < 40 && settledQuery.current !== text; step++) await delay(16, controller.signal);
          for await (const chunk of stream({ query: text, results: resultsRef.current, signal: controller.signal })) {
            if (controller.signal.aborted) return;
            if (chunk.type === "sources") {
              setAnswerState((current) => (current.run === run ? { ...current, sources: chunk.ids } : current));
            } else {
              setAnswerState((current) => (current.run === run ? { ...current, text: current.text + chunk.text } : current));
            }
          }
          if (!controller.signal.aborted) {
            setAnswerState((current) => (current.run === run ? { ...current, streamDone: true } : current));
          }
        } catch (error) {
          if (controller.signal.aborted) return;
          setAnswerState((current) =>
            current.run === run
              ? { ...current, status: "error", error: error instanceof Error ? error.message : "The answer could not be written." }
              : current,
          );
          setLive("The answer could not be written. Try again.");
        }
      })();
    },
    [answer, onAsk, remember, notify],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  const streamingNow = answerState.status === "thinking" || answerState.status === "streaming";

  // Reveal the answer a few tokens at a time, after a beat, so the card breathes like a stream.
  useEffect(() => {
    if (!streamingNow) return;
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - last < 34) return;
      last = now;
      const current = answerRef.current;
      if (now - current.startedAt < 560) return;
      const tokens = tokenizeAnswer(current.text, current.streamDone);
      const shown = revealedCount.current;
      if (shown < tokens.length) {
        const remaining = tokens.length - shown;
        const step = Math.min(remaining, Math.max(3, Math.min(8, Math.ceil(remaining / 6))));
        revealedCount.current = shown + step;
        setRevealStops((stops) => [...stops, shown + step]);
        if (current.status === "thinking") {
          setAnswerState((state) => (state.run === current.run ? { ...state, status: "streaming" } : state));
        }
      } else if (current.streamDone) {
        setAnswerState((state) => (state.run === current.run ? { ...state, status: "done" } : state));
        const count = current.sources.length;
        setLive(`Answer ready${count ? `, ${count} source${count === 1 ? "" : "s"}` : ""}.${answer ? "" : " Simulated answer."}`);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [streamingNow, answerState.run, answer]);

  const tokens = useMemo(() => tokenizeAnswer(answerState.text, answerState.streamDone), [answerState.text, answerState.streamDone]);
  const cited = useMemo(() => {
    const set = new Set<number>();
    tokens.slice(0, revealStops[revealStops.length - 1] ?? 0).forEach((token) => {
      if (token.kind === "cite") set.add(token.n);
    });
    return set;
  }, [tokens, revealStops]);

  const flashTab = useCallback(() => {
    setTabPressed(true);
    setTimeout(() => setTabPressed(false), 160);
  }, []);

  const changeQuery = (value: string) => {
    if (answerRef.current.status !== "idle") resetAnswer();
    setQuery(value);
  };

  const choose = (item: Item | undefined) => {
    if (!item) return;
    if (item.kind === "ask") {
      flashTab();
      ask(query);
      return;
    }
    if (item.kind === "recent") {
      changeQuery(item.text);
      inputRef.current?.focus();
      return;
    }
    if (item.kind === "suggestion") {
      changeQuery(item.text);
      ask(item.text);
      return;
    }
    const { result } = item;
    remember(query);
    onSelect?.(result);
    notify(`Opened ${result.title}`, onSelect ? `Opened ${result.title}.` : `Opened ${result.title}. Simulated, nothing was opened.`);
  };

  const copyAnswer = async () => {
    const text = answerState.text.replace(/`/g, "");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard can be blocked; the label still confirms the attempt */
    }
    setCopied(true);
    notify("Copied the answer");
    setTimeout(() => setCopied(false), 1600);
  };

  const interacted = useRef(false);
  const visible = useRef(true);
  const shouldPlay = autoPlay ?? (!search && !answer);

  // The demo loop: type, ask, stream, hold, then tour the lists, until someone touches the block.
  useEffect(() => {
    const root = rootRef.current;
    if (!shouldPlay || !root) return;
    const controller = new AbortController();
    const { signal } = controller;
    const observer =
      typeof IntersectionObserver === "undefined"
        ? undefined
        : new IntersectionObserver(([entry]) => {
            visible.current = !!entry?.isIntersecting;
          });
    observer?.observe(root);
    const stop = () => {
      interacted.current = true;
      controller.abort();
    };
    root.addEventListener("pointerdown", stop);
    root.addEventListener("keydown", stop);
    root.addEventListener("focusin", stop);

    const hold = async (ms: number) => {
      await delay(ms, signal);
      while (!visible.current || document.hidden) await delay(400, signal);
    };
    const type = async (text: string) => {
      if (reduced) {
        changeQuery(text);
        return;
      }
      for (let end = 1; end <= text.length; end += 2) {
        changeQuery(text.slice(0, end));
        await delay(42, signal);
      }
      changeQuery(text);
    };
    const settle = async () => {
      while (answerRef.current.status !== "done" && answerRef.current.status !== "error") await delay(120, signal);
    };

    void (async () => {
      try {
        do {
          await hold(1100);
          await type("webhook retries");
          await hold(1000);
          flashTab();
          ask("webhook retries");
          await settle();
          if (reduced) break;
          await hold(5200);
          changeQuery("");
          await hold(700);
          const count = recentItems.length;
          for (let index = 1; index <= count; index++) {
            setActive(index);
            await delay(110, signal);
          }
          await hold(420);
          const suggestion = suggestions[0];
          if (!suggestion) break;
          changeQuery(suggestion);
          ask(suggestion);
          await settle();
          await hold(5200);
          changeQuery("");
        } while (!interacted.current);
      } catch {
        /* the loop ends when the user takes over */
      }
    })();

    return () => {
      controller.abort();
      observer?.disconnect();
      root.removeEventListener("pointerdown", stop);
      root.removeEventListener("keydown", stop);
      root.removeEventListener("focusin", stop);
    };
  }, [shouldPlay]);

  // Height morph: measure the inner content and spring the slot to it, never on reduced motion.
  const slotOuter = useRef<HTMLDivElement>(null);
  const slotInner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let animation: ReturnType<typeof animate> | undefined;
    const outer = slotOuter.current;
    const inner = slotInner.current;
    if (!outer || !inner || typeof ResizeObserver === "undefined") return;
    let height = inner.offsetHeight;
    let width = inner.offsetWidth;
    const clear = () => {
      outer.style.height = "";
      outer.style.overflow = "";
      animation = undefined;
    };
    const observer = new ResizeObserver(() => {
      const nextHeight = inner.offsetHeight;
      const nextWidth = inner.offsetWidth;
      const widthChanged = nextWidth !== width;
      width = nextWidth;
      if (nextHeight === height) return;
      const from = animation ? outer.getBoundingClientRect().height : height;
      height = nextHeight;
      animation?.stop();
      if (reduced || widthChanged) {
        clear();
      } else {
        outer.style.overflow = "hidden";
        animation = animate(outer, { height: [from, nextHeight] }, { ...MORPH, onComplete: clear });
      }
    });
    observer.observe(inner);
    return () => {
      observer.disconnect();
      animation?.stop();
    };
  }, [reduced]);

  const view = hasQuery ? "results" : "empty";
  const listboxId = `${id}-listbox`;
  const askId = `${id}-ask`;
  const statusText =
    answerState.status === "thinking"
      ? "Thinking"
      : answerState.status === "streaming"
        ? "Writing"
        : answerState.status === "error"
          ? ""
          : `${answerState.sources.length || "No"} source${answerState.sources.length === 1 ? "" : "s"}`;

  const citedFor = (resultId: string) => {
    const index = answerState.sources.indexOf(resultId) + 1;
    return index > 0 && cited.has(index) ? index : 0;
  };

  // Option ids follow the render order of the list, which is the order of `items`.
  let cursor = -1;
  const nextOption = () => ++cursor;
  const renderRow = (item: Item, children: ReactNode, extra?: { hot?: boolean; label?: string }) => {
    const index = nextOption();
    return (
      <div
        key={item.kind === "result" ? item.result.id : `${item.kind}-${index}`}
        id={optionId(index)}
        role="option"
        aria-selected={active === index}
        aria-label={extra?.label}
        className={styles.row}
        data-active={active === index ? "" : undefined}
        data-hot={extra?.hot ? "" : undefined}
        onMouseMove={() => {
          if (active !== index) setActive(index);
        }}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          setActive(index);
          choose(item);
          inputRef.current?.focus();
        }}
      >
        {children}
      </div>
    );
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!items.length) return;
      event.preventDefault();
      const next = (active + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      setActive(next);
      scrollToOption(next);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      choose(items[active]);
      return;
    }
    if (event.key === "Tab" && !event.shiftKey && hasQuery && !(busy && answerState.status !== "error")) {
      event.preventDefault();
      flashTab();
      ask(query);
      return;
    }
    if (event.key === "Escape") {
      if (busy) {
        event.preventDefault();
        resetAnswer();
        notify("Answer closed.");
      } else if (hasQuery) {
        event.preventDefault();
        setQuery("");
      }
    }
  };

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")}>
      <div className={styles.field}>
        <span className={styles.fieldIcon} aria-hidden="true">
          <AnimatePresence initial={false} mode="popLayout">
            {searching ? (
              <motion.span
                key="spin"
                className={styles.spinner}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: EXIT }}
                transition={ENTER}
              />
            ) : (
              <motion.span
                key="search"
                className={styles.iconSwap}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: EXIT }}
                transition={ENTER}
              >
                <Search size={16} strokeWidth={1.75} />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <input
          ref={inputRef}
          className={styles.input}
          value={query}
          onChange={(event) => changeQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded="true"
          aria-controls={view === "results" || busy ? listboxId : `${askId} ${listboxId}`}
          aria-autocomplete="list"
          aria-activedescendant={items.length ? optionId(active) : undefined}
          aria-label="Search"
          autoComplete="off"
          spellCheck={false}
        />
        <AnimatePresence initial={false}>
          {hasQuery && (
            <motion.button
              key="clear"
              type="button"
              className={styles.iconButton}
              aria-label="Clear search"
              onClick={() => {
                changeQuery("");
                inputRef.current?.focus();
              }}
              initial={!reduced && { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduced ? undefined : { opacity: 0, transition: EXIT }}
              transition={ENTER}
            >
              <X size={14} strokeWidth={1.75} aria-hidden="true" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div ref={bodyRef} className={styles.body}>
        <AnimatePresence initial={false}>
          <motion.div
            key={view}
            className={styles.view}
            data-scroll=""
            initial={!reduced && { opacity: 0 }}
            animate={{ opacity: 1, transition: ENTER }}
            exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: EXIT }}
          >
            {view === "empty" ? (
              <div id={listboxId} role="listbox" aria-label="Recent searches and suggestions" className={styles.list}>
                {recentItems.length > 0 && (
                  <div role="group" aria-labelledby={`${id}-recent`} className={styles.group}>
                    <div id={`${id}-recent`} className={styles.groupHead}>
                      Recent
                    </div>
                    {recentItems.map((text) =>
                      renderRow(
                        { kind: "recent", text },
                        <>
                          <Clock className={styles.muted} size={16} strokeWidth={1.75} aria-hidden="true" />
                          <span className={styles.text}>
                            <span className={styles.title}>{text}</span>
                          </span>
                          <span className={styles.right}>
                            <CornerDownLeft className={styles.enter} size={14} strokeWidth={1.75} aria-hidden="true" />
                          </span>
                        </>,
                      ),
                    )}
                  </div>
                )}
                {suggestions.length > 0 && (
                  <div role="group" aria-labelledby={`${id}-suggested`} className={styles.group}>
                    <div id={`${id}-suggested`} className={styles.groupHead}>
                      Ask AI
                    </div>
                    {suggestions.map((text) =>
                      renderRow(
                        { kind: "suggestion", text },
                        <>
                          <Sparkles className={styles.sparkle} size={16} strokeWidth={1.75} aria-hidden="true" />
                          <span className={styles.text}>
                            <span className={styles.title}>{text}</span>
                          </span>
                          <span className={styles.right}>
                            <CornerDownLeft className={styles.enter} size={14} strokeWidth={1.75} aria-hidden="true" />
                          </span>
                        </>,
                      ),
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.list}>
                <div ref={slotOuter} className={styles.answerSlot}>
                  <div ref={slotInner}>
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.div
                        key={busy ? `answer-${answerState.run}` : "ask"}
                        initial={!reduced && { opacity: 0 }}
                        animate={{ opacity: 1, transition: ENTER }}
                        exit={reduced ? undefined : { opacity: 0, transition: EXIT }}
                      >
                        {busy ? (
                          <div className={styles.answer} role="region" aria-label={`AI answer to ${answerState.query}`} aria-busy={streamingNow}>
                            <div className={styles.answerHead}>
                              <span className={styles.mark}>{model.mark ?? <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" />}</span>
                              <span className={styles.answerTitle}>AI answer</span>
                              <span className={styles.answerStatus}>
                                {answerState.status === "error" ? (
                                  <span className={styles.errorLabel}>
                                    <TriangleAlert size={14} aria-hidden="true" />
                                    Failed
                                  </span>
                                ) : (
                                  <TextShimmer active={streamingNow}>{statusText}</TextShimmer>
                                )}
                              </span>
                              <span className={styles.answerActions}>
                                <button
                                  type="button"
                                  className={styles.iconButton}
                                  onClick={() => void copyAnswer()}
                                  disabled={answerState.status !== "done"}
                                  aria-label={copied ? "Copied" : "Copy answer"}
                                >
                                  <AnimatePresence initial={false} mode="popLayout">
                                    <motion.span
                                      key={copied ? "check" : "copy"}
                                      className={styles.iconSwap}
                                      initial={!reduced && { opacity: 0, scale: 0.8 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={reduced ? undefined : { opacity: 0, scale: 0.8, transition: EXIT }}
                                      transition={ENTER}
                                    >
                                      {copied ? (
                                        <Check size={14} strokeWidth={2} aria-hidden="true" />
                                      ) : (
                                        <Copy size={14} strokeWidth={1.75} aria-hidden="true" />
                                      )}
                                    </motion.span>
                                  </AnimatePresence>
                                </button>
                                <button
                                  type="button"
                                  className={styles.iconButton}
                                  onClick={() => {
                                    resetAnswer();
                                    notify("Answer closed.");
                                    inputRef.current?.focus();
                                  }}
                                  aria-label="Close answer"
                                >
                                  <X size={14} strokeWidth={1.75} aria-hidden="true" />
                                </button>
                              </span>
                            </div>
                            {answerState.status === "error" ? (
                              <div className={styles.error} role="alert">
                                <span>{answerState.error}</span>
                                <button type="button" className={styles.retry} onClick={() => ask(answerState.query)}>
                                  <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
                                  Try again
                                </button>
                              </div>
                            ) : (
                              <p className={styles.answerText}>
                                {revealStops.length === 0 && (
                                  <span className={styles.placeholder} aria-hidden="true">
                                    <span />
                                    <span />
                                  </span>
                                )}
                                {revealStops.map((stop, index) => (
                                  <span className={styles.chunk} key={index}>
                                    {tokens.slice(index ? revealStops[index - 1] : 0, stop).map((token, tokenIndex) => {
                                      if (token.kind === "text") return <span key={tokenIndex}>{token.value}</span>;
                                      if (token.kind === "code") {
                                        return (
                                          <span key={tokenIndex}>
                                            <code className={styles.code}>{token.value}</code>
                                            {token.space}
                                          </span>
                                        );
                                      }
                                      const sourceId = answerState.sources[token.n - 1];
                                      const title = results.find((result) => result.id === sourceId)?.title ?? `Source ${token.n}`;
                                      return (
                                        <button
                                          key={tokenIndex}
                                          type="button"
                                          className={styles.cite}
                                          data-hot={hotCite === token.n ? "" : undefined}
                                          aria-label={`Source ${token.n}: ${title}`}
                                          onMouseEnter={() => setHotCite(token.n)}
                                          onMouseLeave={() => setHotCite(null)}
                                          onFocus={() => setHotCite(token.n)}
                                          onBlur={() => setHotCite(null)}
                                          onClick={() => {
                                            const target = items.findIndex(
                                              (item) => item.kind === "result" && item.result.id === answerState.sources[token.n - 1],
                                            );
                                            if (target < 0) return;
                                            setActive(target);
                                            scrollToOption(target);
                                          }}
                                        >
                                          {token.n}
                                        </button>
                                      );
                                    })}
                                  </span>
                                ))}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div id={askId} role="listbox" aria-label="Ask AI" className={styles.group}>
                            {renderRow(
                              { kind: "ask" },
                              <>
                                <Sparkles className={styles.sparkle} size={16} strokeWidth={1.75} aria-hidden="true" />
                                <span className={styles.text}>
                                  <span className={styles.title}>
                                    Ask AI about <span className={styles.quoted}>“{query.trim()}”</span>
                                  </span>
                                </span>
                                <span className={styles.right}>
                                  <Kbd keys="tab" size="sm" pressed={tabPressed} />
                                </span>
                              </>,
                              { label: `Ask AI about ${query.trim()}` },
                            )}
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
                <div id={listboxId} role="listbox" aria-label="Search results">
                  {grouped.map(({ group, items: rows }) => (
                    <div role="group" aria-labelledby={`${id}-group-${group.id}`} className={styles.group} key={group.id}>
                      <div id={`${id}-group-${group.id}`} className={styles.groupHead}>
                        <span>{group.label}</span>
                        {group.source && (
                          <span className={styles.source}>
                            {group.source.mark}
                            {group.source.name}
                          </span>
                        )}
                      </div>
                      {rows.map((result) => {
                        const cite = citedFor(result.id);
                        return renderRow(
                          { kind: "result", result },
                          <>
                            <span className={styles.icon}>
                              {result.status ? <StatusIcon status={result.status} /> : (result.icon ?? group.icon)}
                            </span>
                            <span className={styles.text}>
                              <span className={styles.title}>{highlight(result.title, queryTokens)}</span>
                              {result.description && <span className={styles.description}>{result.description}</span>}
                            </span>
                            <span className={styles.right}>
                              <AnimatePresence initial={false}>
                                {cite > 0 && (
                                  <motion.span
                                    key="badge"
                                    className={styles.badge}
                                    data-hot={hotCite === cite ? "" : undefined}
                                    aria-hidden="true"
                                    initial={!reduced && { opacity: 0, scale: 0.85 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={reduced ? undefined : { opacity: 0, transition: EXIT }}
                                    transition={ENTER}
                                  >
                                    {cite}
                                  </motion.span>
                                )}
                              </AnimatePresence>
                              <span className={styles.meta}>{result.status ? STATUS_LABEL[result.status] : result.meta}</span>
                            </span>
                          </>,
                          {
                            hot: hotCite !== null && hotCite === cite,
                            label: [result.title, result.description, result.status ? STATUS_LABEL[result.status] : result.meta, cite ? `cited as source ${cite}` : ""]
                              .filter(Boolean)
                              .join(", "),
                          },
                        );
                      })}
                    </div>
                  ))}
                </div>
                {grouped.length === 0 && !searching && (
                  <div className={styles.empty}>
                    <span className={styles.emptyTitle}>No matches for “{query.trim()}”</span>
                    <span className={styles.emptyHint}>
                      Try another word, or press <Kbd keys="tab" size="sm" /> to ask AI.
                    </span>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className={styles.footer} data-frame-keep="">
        <div className={styles.footerLeft}>
          <AnimatePresence initial={false} mode="popLayout">
            {notice ? (
              <motion.span
                key={`notice-${notice.id}`}
                className={styles.notice}
                initial={!reduced && { opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0, transition: ENTER }}
                exit={reduced ? undefined : { opacity: 0, transition: EXIT }}
              >
                <Check size={14} strokeWidth={2} aria-hidden="true" />
                {notice.text}
              </motion.span>
            ) : (
              <motion.span
                key="hints"
                className={styles.hints}
                initial={!reduced && { opacity: 0 }}
                animate={{ opacity: 1, transition: ENTER }}
                exit={reduced ? undefined : { opacity: 0, transition: EXIT }}
              >
                <span className={styles.hint} data-optional="">
                  <Kbd keys="up+down" size="sm" />
                  Navigate
                </span>
                <span className={styles.hint} data-optional="">
                  <Kbd keys="enter" size="sm" />
                  Open
                </span>
                <span className={styles.hint}>
                  <Kbd keys="tab" size="sm" />
                  Ask AI
                </span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <span className={styles.model}>
          {model.mark}
          <span className={styles.modelName}>{model.name}</span>
        </span>
      </div>

      <div className={styles.srOnly} role="status" aria-live="polite">
        {live}
      </div>
    </div>
  );
}

export default AiSearchBar;
