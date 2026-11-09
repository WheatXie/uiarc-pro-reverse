"use client";

import {
  Check,
  Clock,
  CornerDownLeft,
  FileSpreadsheet,
  FileText,
  Film,
  Link2,
  Presentation,
  Search,
  SearchX,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
  type PanInfo,
  type Transition,
} from "motion/react";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { Avatar } from "../avatar/avatar";
import { BottomSheet } from "../bottom-sheet/bottom-sheet";
import { Button } from "../button/button";
import { Checkbox } from "../checkbox/checkbox";
import { EmptyState } from "../empty-state/empty-state";
import { FilterToolbar } from "../filter-toolbar/filter-toolbar";
import { ArcImage } from "../lib/arc-provider";
import { motionTokens } from "../lib/motion-tokens";
import { person, photo, type PersonId, type PhotoId } from "../lib/media";
import { writeClipboard } from "../lib/use-copy-feedback";
import SegmentedControl from "../segmented-control/segmented-control";
import { Slider } from "../slider/slider";
import styles from "./search-results.module.css";

/** The three result shapes the workspace indexes. */
export type ResultKind = "doc" | "person" | "file";
/** File extensions that get their own lead glyph. */
export type FileExt = "pdf" | "fig" | "xlsx" | "jpg" | "mp4" | "key";
/** Sort orders offered by the segmented control. */
export type SortKey = "relevance" | "newest" | "title";

interface BaseResult {
  id: string;
  team: string;
  title: string;
  snippet: string;
  keywords?: string;
}

/** A document: rich body, an author, and a folder path used in the meta line. */
export interface DocResult extends BaseResult {
  kind: "doc";
  path: string;
  body: string[];
  author: PersonId;
  updated: string;
  readMinutes: number;
}

/** A teammate: linkable profile instead of an edited timestamp. */
export interface PersonResult extends BaseResult {
  kind: "person";
  person: PersonId;
  role: string;
  email: string;
  location: string;
  owns: number;
}

/** A file: extension, size, optional page count and photo thumbnail. */
export interface FileResult extends BaseResult {
  kind: "file";
  ext: FileExt;
  size: string;
  pages?: number;
  photo?: PhotoId;
  owner: PersonId;
  updated: string;
}

export type SearchResult = DocResult | PersonResult | FileResult;

/** A facet team the sidebar can filter by. */
export interface SearchTeam {
  id: string;
  label: string;
}

interface Facets {
  types: ResultKind[];
  teams: string[];
  edited: [number, number];
}

export interface SearchResultsProps {
  /** The indexed corpus. Defaults to the Northwind sample workspace. */
  results?: SearchResult[];
  /** Facet teams, in sidebar order. */
  teams?: SearchTeam[];
  /** Recent queries shown first in the suggestions menu. */
  recentSearches?: string[];
  /** Suggested queries shown under the recents. */
  suggestedSearches?: string[];
  /** Query the block mounts with. */
  defaultQuery?: string;
  /** Sort order the block mounts with. */
  defaultSort?: SortKey;
  /** The "today" the relative timestamps are measured against. */
  today?: string;
  /** Workspace name used in the label, placeholder, and copy-link target. */
  workspace?: string;
  /** Simulated search latency in ms; 0 shows results instantly. */
  latency?: number;
  /** Called with the trimmed query whenever a search runs. */
  onSearch?: (query: string) => void;
  /** Called when a result's primary action completes. */
  onOpen?: (result: SearchResult) => void;
  className?: string;
}

const TEAMS: SearchTeam[] = [
    { id: "success", label: "Customer success" },
    { id: "design", label: "Design" },
    { id: "engineering", label: "Engineering" },
    { id: "growth", label: "Growth" },
    { id: "operations", label: "Operations" },
    { id: "finance", label: "Finance" },
  ],
  RECENT: string[] = ["onboarding", "Lisbon offsite", "pricing page", "Marcus"],
  SUGGESTED: string[] = [
    "roadmap",
    "brand guidelines",
    "invoice template",
    "hiring plan",
  ],
  RESULTS: SearchResult[] = [
    {
      id: "doc-onboarding-playbook",
      kind: "doc",
      team: "success",
      title: "Customer onboarding playbook",
      path: "Customer success / Playbooks",
      snippet:
        "Every new enterprise account gets a named lead for the first 30 days. The onboarding call covers workspace setup, SSO, and the first import.",
      body: [
        "Every new enterprise account gets a named lead for the first 30 days. The onboarding call covers workspace setup, SSO, and the first import.",
        "By day 14 the account should have three active teams. If it does not, the lead books a second onboarding session and loops in solutions engineering.",
        "Close the onboarding phase with a short review: what the team shipped, where they got stuck, and who owns the account from here.",
      ],
      author: "hannah-walsh",
      updated: "2026-09-22",
      readMinutes: 6,
    },
    {
      id: "person-hannah",
      kind: "person",
      team: "success",
      person: "hannah-walsh",
      title: person("hannah-walsh").name,
      role: "Customer success lead",
      snippet:
        "Leads onboarding for enterprise accounts in Europe. Ask about SSO rollouts, data imports, and renewal health.",
      email: "hannah@northwind.co",
      location: "Dublin",
      owns: 42,
    },
    {
      id: "file-onboarding-flow",
      kind: "file",
      team: "design",
      title: "Onboarding flow v3.fig",
      ext: "fig",
      size: "18.2 MB",
      snippet:
        "Frames: Welcome, Invite your team, Connect Slack, First project. The onboarding checklist moves into the sidebar.",
      owner: "emma-collins",
      updated: "2026-09-18",
    },
    {
      id: "doc-eng-onboarding",
      kind: "doc",
      team: "engineering",
      title: "Onboarding checklist for new engineers",
      path: "Engineering / Handbook",
      snippet:
        "Your first week: get repo access, run the app locally, ship a small fix, and pair with your onboarding buddy on a production deploy.",
      body: [
        "Your first week: get repo access, run the app locally, ship a small fix, and pair with your onboarding buddy on a production deploy.",
        "Week two is about context. Read the last three incident reviews and sit in on a planning session with your team.",
        "By the end of your first month you should own one small service end to end, including its alerts and runbook.",
      ],
      author: "nathan-cole",
      updated: "2026-08-30",
      readMinutes: 4,
    },
    {
      id: "file-onboarding-metrics",
      kind: "file",
      team: "growth",
      title: "Q3 onboarding metrics.xlsx",
      ext: "xlsx",
      size: "412 KB",
      snippet:
        "Activation rose from 41% to 48% after the new onboarding checklist. Time to first project fell to 2.3 days.",
      owner: "chloe-nguyen",
      updated: "2026-09-12",
    },
    {
      id: "person-chloe",
      kind: "person",
      team: "growth",
      person: "chloe-nguyen",
      title: person("chloe-nguyen").name,
      role: "Data analyst",
      snippet:
        "Owns the activation dashboards and the weekly onboarding funnel report. Happy to pull numbers for any experiment.",
      email: "chloe@northwind.co",
      location: "Toronto",
      owns: 27,
    },
    {
      id: "file-welcome-kit",
      kind: "file",
      team: "operations",
      title: "Welcome kit for new hires.pdf",
      ext: "pdf",
      size: "3.1 MB",
      pages: 14,
      snippet:
        "Page 2: What to expect in your first week, from laptop setup to your onboarding lunch with the team.",
      owner: "sofia-ramirez",
      updated: "2026-06-04",
    },
    {
      id: "doc-onboarding-emails",
      kind: "doc",
      team: "growth",
      title: "Onboarding email sequence",
      path: "Growth / Lifecycle",
      snippet:
        "Five emails over 14 days. Each one points to a single next step, and the sequence stops as soon as the workspace is active.",
      body: [
        "Five emails over 14 days. Each one points to a single next step, and the sequence stops as soon as the workspace is active.",
        "Day 1 welcomes the admin and links to the import guide. Day 3 suggests inviting two teammates.",
        "We measure the onboarding sequence by activation, not by opens. Anything that does not move activation gets cut.",
      ],
      author: "ava-mitchell",
      updated: "2026-07-19",
      readMinutes: 3,
    },
    {
      id: "file-onboarding-walkthrough",
      kind: "file",
      team: "success",
      title: "Admin onboarding walkthrough.mp4",
      ext: "mp4",
      size: "248 MB",
      snippet:
        "A 12 minute recording of the admin console: roles, SSO, audit log, and billing. Used in every onboarding call.",
      owner: "jordan-reyes",
      updated: "2026-03-11",
    },
    {
      id: "doc-lisbon-agenda",
      kind: "doc",
      team: "operations",
      title: "Lisbon offsite agenda",
      path: "Operations / Events",
      snippet:
        "Three days in Lisbon, 14 to 16 October. Day one is planning, day two is team time, day three is a walk to Bel\xe9m and dinner.",
      body: [
        "Three days in Lisbon, 14 to 16 October. Day one is planning, day two is team time, day three is a walk to Bel\xe9m and dinner.",
        "Flights land on the 13th. We are staying in Chiado, ten minutes on foot from the venue.",
        "Please add dietary needs to the offsite sheet by 1 October.",
      ],
      author: "sofia-ramirez",
      updated: "2026-09-20",
      readMinutes: 2,
    },
    {
      id: "file-lisbon-rooftops",
      kind: "file",
      team: "operations",
      title: "Lisbon rooftops.jpg",
      ext: "jpg",
      size: "4.8 MB",
      photo: "lisbon-rooftops",
      snippet:
        "Venue scouting photo from the Lisbon offsite trip, taken from the Gra\xe7a viewpoint.",
      owner: "sofia-ramirez",
      updated: "2026-08-14",
    },
    {
      id: "file-lisbon-tram",
      kind: "file",
      team: "operations",
      title: "Tram 28 route.jpg",
      ext: "jpg",
      size: "3.9 MB",
      photo: "lisbon-tram",
      keywords: "lisbon offsite",
      snippet:
        "Photo for the offsite guide: the tram route from the hotel to the venue.",
      owner: "sofia-ramirez",
      updated: "2026-08-14",
    },
    {
      id: "person-sofia",
      kind: "person",
      team: "operations",
      person: "sofia-ramirez",
      title: person("sofia-ramirez").name,
      role: "Operations lead",
      snippet:
        "Runs travel, offices, and the Lisbon offsite. Send questions about flights and hotels here.",
      email: "sofia@northwind.co",
      location: "Lisbon",
      owns: 35,
    },
    {
      id: "doc-pricing-page",
      kind: "doc",
      team: "growth",
      title: "Pricing page rewrite",
      path: "Growth / Website",
      snippet:
        "Lead with the Team plan, move seat pricing above the fold, and answer the three most common pricing questions right under the table.",
      body: [
        "Lead with the Team plan, move seat pricing above the fold, and answer the three most common pricing questions right under the table.",
        "The current page asks visitors to compare nine rows before they see a price. The rewrite cuts that to four.",
        "We will run the new pricing page as a two week test with 50% of traffic.",
      ],
      author: "tyler-hayes",
      updated: "2026-09-09",
      readMinutes: 5,
    },
    {
      id: "file-pricing-model",
      kind: "file",
      team: "finance",
      title: "Pricing model 2027.xlsx",
      ext: "xlsx",
      size: "1.2 MB",
      snippet:
        "Seat price scenarios for the Team and Business plans, with discount bands and expected pricing impact on net revenue.",
      owner: "andre-williams",
      updated: "2026-09-02",
    },
    {
      id: "person-andre",
      kind: "person",
      team: "finance",
      person: "andre-williams",
      title: person("andre-williams").name,
      role: "Finance partner",
      snippet:
        "Partners with growth on pricing, discounts, and plan packaging. Keeper of the revenue model.",
      email: "andre@northwind.co",
      location: "New York",
      owns: 19,
    },
    {
      id: "doc-roadmap",
      kind: "doc",
      team: "engineering",
      title: "Q4 product roadmap",
      path: "Product / Planning",
      snippet:
        "Three bets for Q4: faster search, a calmer inbox, and offline mode for mobile. Each roadmap item lists an owner and a ship date.",
      body: [
        "Three bets for Q4: faster search, a calmer inbox, and offline mode for mobile. Each roadmap item lists an owner and a ship date.",
        "Search ships first. The goal is results in under 200 milliseconds for workspaces with a million items.",
        "The roadmap is reviewed every two weeks. Changes are posted in the product channel.",
      ],
      author: "diane-foster",
      updated: "2026-09-16",
      readMinutes: 7,
    },
    {
      id: "file-roadmap-deck",
      kind: "file",
      team: "engineering",
      title: "Roadmap review, September.key",
      ext: "key",
      size: "36.5 MB",
      pages: 22,
      snippet:
        "Slide 4: search latency by workspace size. Slide 9: roadmap risks and what we cut.",
      owner: "nathan-cole",
      updated: "2026-09-10",
    },
    {
      id: "person-marcus",
      kind: "person",
      team: "engineering",
      person: "marcus-johnson",
      title: person("marcus-johnson").name,
      role: "Frontend engineer",
      snippet:
        "Building the new search experience and the keyboard shortcuts across the app.",
      email: "marcus@northwind.co",
      location: "Berlin",
      owns: 23,
    },
    {
      id: "doc-brand",
      kind: "doc",
      team: "design",
      title: "Brand guidelines",
      path: "Design / Brand",
      snippet:
        "Our voice is plain and warm. Use sentence case, short words, and one idea per sentence. Logos keep a clear space of one cap height.",
      body: [
        "Our voice is plain and warm. Use sentence case, short words, and one idea per sentence. Logos keep a clear space of one cap height.",
        "Photography shows real places and people at work. No stock handshakes.",
        "When in doubt, ask the brand channel before a launch.",
      ],
      author: "jasmine-brooks",
      updated: "2026-05-27",
      readMinutes: 8,
    },
    {
      id: "person-jasmine",
      kind: "person",
      team: "design",
      person: "jasmine-brooks",
      title: person("jasmine-brooks").name,
      role: "Design lead",
      snippet:
        "Leads product design and keeps the brand guidelines current. Reviews every launch before it ships.",
      email: "jasmine@northwind.co",
      location: "London",
      owns: 51,
    },
    {
      id: "file-invoice-template",
      kind: "file",
      team: "finance",
      title: "Invoice template.pdf",
      ext: "pdf",
      size: "220 KB",
      pages: 1,
      snippet:
        "The standard invoice template with VAT fields for EU customers and a purchase order line.",
      owner: "andre-williams",
      updated: "2025-11-06",
    },
    {
      id: "doc-hiring-plan",
      kind: "doc",
      team: "operations",
      title: "2027 hiring plan",
      path: "People / Planning",
      snippet:
        "Twelve roles next year, most in engineering and customer success. Each hiring manager owns a scorecard and an onboarding plan.",
      body: [
        "Twelve roles next year, most in engineering and customer success. Each hiring manager owns a scorecard and an onboarding plan.",
        "We hire in Europe and North America, with a preference for overlap with the Lisbon and New York hubs.",
        "Offers are approved by the hiring manager and finance within two working days.",
      ],
      author: "diane-foster",
      updated: "2026-09-05",
      readMinutes: 5,
    },
    {
      id: "person-mateo",
      kind: "person",
      team: "engineering",
      person: "mateo-alvarez",
      title: person("mateo-alvarez").name,
      role: "Mobile engineer",
      snippet:
        "Working on offline mode for the mobile apps. Previously built the onboarding screens on iOS.",
      email: "mateo@northwind.co",
      location: "Madrid",
      owns: 16,
    },
    {
      id: "file-office-photo",
      kind: "file",
      team: "operations",
      title: "New Dublin office.jpg",
      ext: "jpg",
      size: "5.2 MB",
      photo: "home-office",
      snippet:
        "The quiet room on the second floor, ready for the new hires starting in October.",
      owner: "sofia-ramirez",
      updated: "2026-01-21",
    },
  ];

const MONTHS: string[] = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  KIND_LABEL: Record<ResultKind, string> = {
    doc: "Docs",
    person: "People",
    file: "Files",
  },
  KINDS: ResultKind[] = ["doc", "person", "file"],
  SORT_OPTIONS = [
    { value: "relevance", label: "Best match" },
    { value: "newest", label: "Newest" },
    { value: "title", label: "A to Z" },
  ],
  EXT_LABEL: Record<FileExt, string> = {
    pdf: "PDF",
    fig: "Figma",
    xlsx: "Spreadsheet",
    jpg: "Image",
    mp4: "Video",
    key: "Keynote",
  };

const cx = (...parts: (string | false | undefined)[]) =>
  parts.filter(Boolean).join(" ");

function parseDay(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return { y, m, d, t: Date.UTC(y, m - 1, d) };
}

/** Whole days between two `YYYY-MM-DD` dates, later minus earlier. */
function daysBetween(from: string, to: string) {
  return Math.round((parseDay(to).t - parseDay(from).t) / 864e5);
}

/** Relative age for a timestamp, or an absolute date once it is older than a month. */
function relativeDay(value: string, today: string, short = false) {
  const then = parseDay(value);
  const now = parseDay(today);
  const days = daysBetween(value, today);
  const label =
    days <= 0
      ? "Today"
      : days === 1
        ? "Yesterday"
        : days < 7
          ? `${days} days ago`
          : days < 14
            ? "Last week"
            : days < 31
              ? `${Math.floor(days / 7)} weeks ago`
              : null;
  if (label) return short ? label.toLowerCase() : label;
  const absolute = `${MONTHS[then.m - 1]} ${then.d}${then.y === now.y ? "" : `, ${then.y}`}`;
  return short ? `on ${absolute}` : absolute;
}

/** Turns a slider index (0 = eleven months ago … 12 = this month) into a month label. */
function monthFromIndex(index: number, today: string) {
  const now = parseDay(today);
  const month = 12 * now.y + (now.m - 1) - (12 - index);
  return `${MONTHS[month % 12]} ${Math.floor(month / 12)}`;
}

/** Splits a query into comparable word tokens. */
function tokenize(query: string) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
}

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** People have no edited timestamp, so the "newest" sort and the date facet skip them. */
const editedDate = (result: SearchResult) =>
  result.kind === "person" ? null : result.updated;

/** Best-match score: a title hit counts three times, a snippet hit once. */
function relevance(result: SearchResult, terms: string[]) {
  const title = result.title.toLowerCase();
  return terms.reduce(
    (total, term) =>
      total +
      (title.includes(term) ? 3 : 0) +
      (result.snippet.toLowerCase().includes(term) ? 1 : 0),
    0,
  );
}

function countMatches(text: string, terms: string[]) {
  if (!terms.length) return 0;
  return (text.match(new RegExp(terms.map(escapeRegExp).join("|"), "gi")) ?? [])
    .length;
}

/** Wraps every query hit in `<mark>` while keeping the surrounding text as plain nodes. */
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  return (
    <>
      {text.split(pattern).map((part, index) =>
        index % 2 ? (
          <mark key={index} className={styles.mark}>
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/** The Figma brand mark stands in for `.fig` files. */
function FigmaGlyph() {
  return (
    <svg className={styles.brand} viewBox="0 0 38 57" aria-hidden="true">
      <path
        fill="#1ABCFE"
        d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0Z"
      />
      <path
        fill="#0ACF83"
        d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0Z"
      />
      <path fill="#FF7262" d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19Z" />
      <path
        fill="#F24E1E"
        d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5Z"
      />
      <path
        fill="#A259FF"
        d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5Z"
      />
    </svg>
  );
}

/** Extension glyph for a file: brand marks for Figma, lucide icons for the rest. */
function FileGlyph({ file, size = 20 }: { file: FileResult; size?: number }) {
  const props = { size, strokeWidth: 1.75, "aria-hidden": true } as const;
  if (file.ext === "fig") return <FigmaGlyph />;
  if (file.ext === "xlsx") return <FileSpreadsheet {...props} />;
  if (file.ext === "mp4") return <Film {...props} />;
  if (file.ext === "key") return <Presentation {...props} />;
  return <FileText {...props} />;
}

/** The 40px lead slot: avatar for people, thumbnail for photos, glyph otherwise. */
function ResultLead({ result }: { result: SearchResult }) {
  if (result.kind === "person") {
    const teammate = person(result.person);
    return (
      <Avatar
        name={teammate.name}
        src={teammate.src}
        size="md"
        className={styles.leadAvatar}
      />
    );
  }
  if (result.kind === "file" && result.photo) {
    const image = photo(result.photo);
    return (
      <span className={styles.thumb}>
        <ArcImage src={image.src} alt="" fill sizes="40px" />
      </span>
    );
  }
  return (
    <span className={styles.glyph}>
      {result.kind === "doc" ? (
        <FileText size={20} strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <FileGlyph file={result} />
      )}
    </span>
  );
}

/** The one-line meta under a title: folder for docs, role and city for people, facts for files. */
function metaLine(result: SearchResult, teamLabel: (id: string) => string) {
  if (result.kind === "doc") return `Doc in ${result.path}`;
  if (result.kind === "person") return `${result.role}, ${result.location}`;
  return [
    EXT_LABEL[result.ext],
    result.pages
      ? `${result.pages} ${result.pages === 1 ? "page" : "pages"}`
      : null,
    result.size,
    teamLabel(result.team),
  ]
    .filter(Boolean)
    .join(", ");
}

interface FacetsProps {
  inSheet?: boolean;
  idPrefix: string;
  facets: Facets;
  teams: SearchTeam[];
  typeCounts: Record<ResultKind, number>;
  teamCounts: Record<string, number>;
  today: string;
  active: boolean;
  onToggleType: (kind: ResultKind, checked: boolean) => void;
  onToggleTeam: (team: string, checked: boolean) => void;
  onRange: (range: [number, number]) => void;
  onClear: () => void;
}

/** Type, team, and date facets — shared by the desktop sidebar and the mobile filters sheet. */
function Facets({
  inSheet = false,
  idPrefix,
  facets,
  teams,
  typeCounts,
  teamCounts,
  today,
  active,
  onToggleType,
  onToggleTeam,
  onRange,
  onClear,
}: FacetsProps) {
  const reduce = useReducedMotion();
  return (
    <div className={styles.facets}>
      {inSheet ? null : (
        <div className={styles.facetsHead}>
          <h3 className={styles.facetsTitle}>Filters</h3>
          <motion.button
            type="button"
            className={styles.clearAll}
            onClick={onClear}
            disabled={!active}
            initial={false}
            animate={{ opacity: active ? 1 : 0 }}
            transition={
              reduce
                ? { duration: 0 }
                : {
                    duration: motionTokens.duration.fast,
                    ease: [...motionTokens.ease.standard],
                  }
            }
            aria-hidden={!active}
            tabIndex={active ? 0 : -1}
          >
            Clear all
          </motion.button>
        </div>
      )}
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Type</legend>
        <div className={styles.options}>
          {KINDS.map((kind) => {
            const checked = facets.types.includes(kind);
            const count = typeCounts[kind];
            return (
              <div
                key={kind}
                className={styles.option}
                data-empty={count === 0 && !checked ? "" : undefined}
              >
                <Checkbox
                  id={`${idPrefix}-type-${kind}`}
                  label={KIND_LABEL[kind]}
                  checked={checked}
                  disabled={count === 0 && !checked}
                  onCheckedChange={(next) => onToggleType(kind, next === true)}
                />
                <span className={styles.optionCount} aria-hidden="true">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </fieldset>
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Team</legend>
        <div className={styles.options}>
          {teams.map((team) => {
            const checked = facets.teams.includes(team.id);
            const count = teamCounts[team.id] ?? 0;
            return (
              <div
                key={team.id}
                className={styles.option}
                data-empty={count === 0 && !checked ? "" : undefined}
              >
                <Checkbox
                  id={`${idPrefix}-team-${team.id}`}
                  label={team.label}
                  checked={checked}
                  disabled={count === 0 && !checked}
                  onCheckedChange={(next) =>
                    onToggleTeam(team.id, next === true)
                  }
                />
                <span className={styles.optionCount} aria-hidden="true">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </fieldset>
      <div className={styles.group}>
        <Slider
          label="Edited"
          value={facets.edited}
          onValueChange={onRange}
          min={0}
          max={12}
          step={1}
          format={(index) => monthFromIndex(index, today)}
          thumbLabels={["Edited after", "Edited before"]}
        />
        <p className={styles.hint}>Applies to docs and files</p>
      </div>
    </div>
  );
}

interface PreviewCardProps {
  result: SearchResult;
  terms: string[];
  today: string;
  teamLabel: (id: string) => string;
  onOpen?: (result: SearchResult) => void;
}

/** The right-hand preview: media, body, facts, and the two actions. */
function PreviewCard({
  result,
  terms,
  today,
  teamLabel,
  onOpen,
}: PreviewCardProps) {
  const [primary, setPrimary] = useState<"idle" | "busy" | "done">("idle");
  const [copy, setCopy] = useState<"idle" | "done" | "error">("idle");
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => timers.current.forEach((handle) => window.clearTimeout(handle)),
    [],
  );

  const later = (callback: () => void, delay: number) => {
    timers.current.push(window.setTimeout(callback, delay));
  };

  const labels =
    result.kind === "doc"
      ? (["Open doc", "Opened"] as const)
      : result.kind === "person"
        ? (["View profile", "Profile opened"] as const)
        : (["Download", "Downloaded"] as const);

  const matches =
    result.kind === "doc"
      ? countMatches(`${result.title} ${result.body.join(" ")}`, terms)
      : countMatches(`${result.title} ${result.snippet}`, terms);

  const owner =
    result.kind === "doc"
      ? person(result.author)
      : result.kind === "file"
        ? person(result.owner)
        : null;
  const edited = result.kind === "person" ? null : parseDay(result.updated);

  return (
    <article
      className={styles.previewCard}
      aria-label={`Preview of ${result.title}`}
    >
      {result.kind === "file" && result.photo ? (
        <div className={styles.previewMedia}>
          <ArcImage
            src={photo(result.photo).src}
            alt={photo(result.photo).alt}
            fill
            sizes="(max-width: 720px) 100vw, 320px"
          />
        </div>
      ) : null}
      <header className={styles.previewHead}>
        {result.kind === "person" ? (
          <Avatar
            name={result.title}
            src={person(result.person).src}
            size="lg"
          />
        ) : result.kind === "file" && !result.photo ? (
          <span className={styles.previewGlyph}>
            <FileGlyph file={result} size={24} />
          </span>
        ) : null}
        <div className={styles.previewTitles}>
          <h3 className={styles.previewTitle}>
            <Highlight text={result.title} terms={terms} />
          </h3>
          <p className={styles.previewMeta}>{metaLine(result, teamLabel)}</p>
        </div>
      </header>
      {result.kind === "doc" ? (
        <div className={styles.previewBody}>
          {result.body.map((paragraph, index) => (
            <p key={index}>
              <Highlight text={paragraph} terms={terms} />
            </p>
          ))}
        </div>
      ) : (
        <div className={styles.previewBody}>
          <p>
            <Highlight text={result.snippet} terms={terms} />
          </p>
        </div>
      )}
      <dl className={styles.facts}>
        {matches > 0 ? (
          <div>
            <dt>Matches</dt>
            <dd className={styles.num}>{matches}</dd>
          </div>
        ) : null}
        <div>
          <dt>Team</dt>
          <dd>{teamLabel(result.team)}</dd>
        </div>
        {owner ? (
          <div>
            <dt>{result.kind === "doc" ? "Author" : "Owner"}</dt>
            <dd className={styles.factPerson}>
              <Avatar name={owner.name} src={owner.src} size="sm" />
              {owner.name}
            </dd>
          </div>
        ) : null}
        {result.kind === "doc" ? (
          <div>
            <dt>Length</dt>
            <dd className={styles.num}>{result.readMinutes} min read</dd>
          </div>
        ) : null}
        {result.kind === "person" ? (
          <>
            <div>
              <dt>Email</dt>
              <dd className={styles.truncate} title={result.email}>
                {result.email}
              </dd>
            </div>
            <div>
              <dt>Owns</dt>
              <dd className={styles.num}>{result.owns} docs and files</dd>
            </div>
          </>
        ) : null}
        {result.kind !== "person" && edited ? (
          <div>
            <dt>Last edited</dt>
            <dd className={styles.num}>
              {`${MONTHS[edited.m - 1]} ${edited.d}, ${edited.y}`}
              {daysBetween(result.updated, today) < 31 ? (
                <span className={styles.factMuted}>
                  , {relativeDay(result.updated, today, true)}
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>
      <div className={styles.previewActions}>
        <Button
          variant="primary"
          loading={primary === "busy"}
          onClick={() => {
            if (primary !== "idle") return;
            setPrimary("busy");
            later(() => {
              setPrimary("done");
              onOpen?.(result);
              later(() => setPrimary("idle"), 1800);
            }, 650);
          }}
        >
          {primary === "done" ? (
            <>
              <Check size={16} strokeWidth={1.75} aria-hidden="true" />
              {labels[1]}
            </>
          ) : (
            labels[0]
          )}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            const target = `https://northwind.co/${result.kind}/${result.id}`;
            const settle = (next: "done" | "error") => {
              setCopy(next);
              later(() => setCopy("idle"), 1600);
            };
            writeClipboard(target).then(
              () => settle("done"),
              () => settle("error"),
            );
          }}
          aria-label={
            copy === "done"
              ? "Link copied"
              : copy === "error"
                ? "Copy failed"
                : "Copy link"
          }
        >
          {copy === "done" ? (
            <>
              <Check size={16} strokeWidth={1.75} aria-hidden="true" />
              Copied
            </>
          ) : copy === "error" ? (
            "Copy failed"
          ) : (
            <>
              <Link2 size={16} strokeWidth={1.75} aria-hidden="true" />
              Copy link
            </>
          )}
        </Button>
      </div>
      <p className={styles.srOnly} role="status">
        {primary === "done"
          ? `${labels[1]}: ${result.title}`
          : copy === "done"
            ? "Link copied"
            : copy === "error"
              ? "Copy failed"
              : ""}
      </p>
    </article>
  );
}

/** The result count that rolls up or down by one line when the set changes size. */
function RollCounter({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState<{ value: number; direction: number }>({
    value,
    direction: 1,
  });
  if (display.value !== value)
    setDisplay({ value, direction: value > display.value ? 1 : -1 });
  const direction = display.direction;
  return (
    <span className={styles.roll}>
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.span
          key={value}
          className={styles.rollValue}
          custom={direction}
          variants={{
            enter: (custom: number) => ({
              y: reduce ? 0 : `${0.7 * custom}em`,
              opacity: 0,
            }),
            center: { y: 0, opacity: 1 },
            exit: (custom: number) => ({
              y: reduce ? 0 : `${-0.7 * custom}em`,
              opacity: 0,
              transition: {
                duration: reduce ? 0 : motionTokens.duration.exit,
                ease: [...motionTokens.ease.exit],
              },
            }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={reduce ? { duration: 0 } : motionTokens.spring.smooth}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const SKELETONS = [
  { lead: "square", title: 62, meta: 38, lines: [96, 71] },
  { lead: "round", title: 34, meta: 44, lines: [88, 52] },
  { lead: "square", title: 48, meta: 30, lines: [92, 64] },
  { lead: "square", title: 56, meta: 40, lines: [84, 58] },
  { lead: "round", title: 30, meta: 36, lines: [90, 44] },
];

/** Loading state that keeps the result grid so the list never jumps. */
function Skeletons() {
  return (
    <ul className={styles.skeletons} aria-hidden="true">
      {SKELETONS.map((row, index) => (
        <li key={index} className={styles.skeletonRow}>
          <span
            className={cx(
              styles.bone,
              row.lead === "round" ? styles.boneRound : styles.boneSquare,
            )}
          />
          <span className={styles.skeletonBody}>
            <span
              className={styles.bone}
              style={{ width: `${row.title}%`, height: 14 }}
            />
            <span
              className={styles.bone}
              style={{ width: `${row.meta}%`, height: 10 }}
            />
            {row.lines.map((width, lineIndex) => (
              <span
                key={lineIndex}
                className={styles.bone}
                style={{ width: `${width}%`, height: 10 }}
              />
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Northwind's search workspace: facet sidebar, keyboard-driven result list, and a live preview.
 *
 * @remarks
 * The block keeps one query, one sort, and one facet set. `/` focuses the query from anywhere in the block;
 * ArrowDown in the query walks the recent and suggested rows and then hands focus to the result list, where
 * ArrowDown/Up or J/K move a cursor, Home/End jump, Enter opens, and Escape or `/` return to the query. The
 * result count rolls, the cursor glides on a shared layout spring, and result sets crossfade with a short
 * rise. Facets count against the current query and disable empty options instead of hiding them. Below a
 * 1120px container the preview becomes a bottom sheet; below 680px the facets move into a filters sheet with
 * a sticky footer, and the query bar grows a Filters button that reports how many facets are applied.
 */
export function SearchResults({
  results = RESULTS,
  teams = TEAMS,
  recentSearches = RECENT,
  suggestedSearches = SUGGESTED,
  defaultQuery = "onboarding",
  defaultSort = "relevance",
  today = "2026-09-24",
  workspace = "Northwind",
  latency = 650,
  onSearch,
  onOpen,
  className,
}: SearchResultsProps) {
  const baseId = useId().replace(/:/g, "");
  const reduce = useReducedMotion() ?? false;

  const rootRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const statusTimer = useRef(0);

  const [query, setQuery] = useState(defaultQuery);
  const [submitted, setSubmitted] = useState(defaultQuery);
  const [recent, setRecent] = useState(recentSearches);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [sort, setSort] = useState<SortKey>(defaultSort);
  const [facets, setFacets] = useState<Facets>({
    types: [],
    teams: [],
    edited: [0, 12],
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [listFocused, setListFocused] = useState(false);
  const [wide, setWide] = useState(true);
  const [previewSheet, setPreviewSheet] = useState(false);
  const [filtersSheet, setFiltersSheet] = useState(false);

  useEffect(() => () => window.clearTimeout(statusTimer.current), []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) =>
      setWide(entry.contentRect.width >= 1120),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey)
        return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          /^(input|textarea|select)$/i.test(target.tagName))
      )
        return;
      const box = rootRef.current?.getBoundingClientRect();
      if (!box || box.bottom < 0 || box.top > window.innerHeight) return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const teamLabel = useCallback(
    (id: string) => teams.find((team) => team.id === id)?.label ?? id,
    [teams],
  );
  const terms = useMemo(() => tokenize(submitted), [submitted]);

  const matching = useMemo(
    () =>
      results.filter((result) => {
        const detail =
          result.kind === "doc"
            ? `${result.path} ${result.body.join(" ")}`
            : result.kind === "person"
              ? `${result.role} ${result.location}`
              : EXT_LABEL[result.ext];
        const haystack =
          `${result.title} ${result.snippet} ${detail} ${result.keywords ?? ""}`.toLowerCase();
        return terms.every((term) => haystack.includes(term));
      }),
    [results, terms],
  );

  const dateOpen = facets.edited[0] === 0 && facets.edited[1] === 12;

  const passesFacets = useCallback(
    (result: SearchResult, skip?: "types" | "teams") => {
      if (
        skip !== "types" &&
        facets.types.length &&
        !facets.types.includes(result.kind)
      )
        return false;
      if (
        skip !== "teams" &&
        facets.teams.length &&
        !facets.teams.includes(result.team)
      )
        return false;
      const updated = editedDate(result);
      if (!dateOpen && updated) {
        const then = parseDay(updated);
        const now = parseDay(today);
        const monthsAgo = 12 - ((now.y - then.y) * 12 + (now.m - then.m));
        if (monthsAgo < facets.edited[0] || monthsAgo > facets.edited[1])
          return false;
      }
      return true;
    },
    [facets, dateOpen, today],
  );

  const visible = useMemo(() => {
    const filtered = matching.filter((result) => passesFacets(result));
    const originalOrder = new Map(
      results.map((result, index) => [result.id, index]),
    );
    const byOriginal = (a: SearchResult, b: SearchResult) =>
      (originalOrder.get(a.id) ?? 0) - (originalOrder.get(b.id) ?? 0);
    if (sort === "title")
      return [...filtered].sort((a, b) => a.title.localeCompare(b.title, "en"));
    if (sort === "newest")
      return [...filtered].sort(
        (a, b) =>
          (editedDate(b) ?? "").localeCompare(editedDate(a) ?? "") ||
          byOriginal(a, b),
      );
    return [...filtered].sort(
      (a, b) => relevance(b, terms) - relevance(a, terms) || byOriginal(a, b),
    );
  }, [matching, passesFacets, results, sort, terms]);

  const typeCounts = useMemo(() => {
    const counts: Record<ResultKind, number> = { doc: 0, person: 0, file: 0 };
    matching.forEach((result) => {
      if (passesFacets(result, "types")) counts[result.kind] += 1;
    });
    return counts;
  }, [matching, passesFacets]);

  const teamCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    matching.forEach((result) => {
      if (passesFacets(result, "teams"))
        counts[result.team] = (counts[result.team] ?? 0) + 1;
    });
    return counts;
  }, [matching, passesFacets]);

  const facetCount =
    facets.types.length + facets.teams.length + (dateOpen ? 0 : 1);

  const chips = useMemo(
    () => [
      ...facets.types.map((kind) => ({
        id: `type:${kind}`,
        label: "Type",
        value: KIND_LABEL[kind],
      })),
      ...facets.teams.map((team) => ({
        id: `team:${team}`,
        label: "Team",
        value: teamLabel(team),
      })),
      ...(dateOpen
        ? []
        : [
            {
              id: "edited",
              label: "Edited",
              value:
                facets.edited[0] === facets.edited[1]
                  ? monthFromIndex(facets.edited[0], today)
                  : `${monthFromIndex(facets.edited[0], today)} to ${monthFromIndex(facets.edited[1], today)}`,
            },
          ]),
    ],
    [facets, dateOpen, teamLabel, today],
  );

  const activeResult =
    visible.find((result) => result.id === activeId) ?? visible[0] ?? null;
  const activePosition = activeResult ? visible.indexOf(activeResult) : -1;

  // A stable signature drives both the layout id and the simulated latency, so reopening the same search
  // lands on the same number of seconds instead of randomising between renders.
  const signature = `${submitted}|${sort}|${chips.map((chip) => chip.id + chip.value).join(",")}`;
  const elapsed = (() => {
    let hash = 0;
    for (let index = 0; index < signature.length; index += 1)
      hash = (31 * hash + signature.charCodeAt(index)) >>> 0;
    return (6 + (hash % 19)) / 100;
  })();

  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtering =
      needle.length > 0 && needle !== submitted.trim().toLowerCase();
    const allowed = (text: string) =>
      !filtering || text.toLowerCase().includes(needle);
    const recents = recent
      .filter(allowed)
      .slice(0, 4)
      .map((text, index) => ({
        id: `r${index}`,
        text,
        group: "recent" as const,
      }));
    const taken = new Set(recents.map((item) => item.text.toLowerCase()));
    return [
      ...recents,
      ...suggestedSearches
        .filter((text) => allowed(text) && !taken.has(text.toLowerCase()))
        .slice(0, 4)
        .map((text, index) => ({
          id: `s${index}`,
          text,
          group: "suggested" as const,
        })),
    ];
  }, [query, submitted, recent, suggestedSearches]);

  const menuVisible = menuOpen && suggestions.length > 0;

  const runSearch = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      setQuery(trimmed);
      setMenuOpen(false);
      setActiveIndex(-1);
      setActiveId(null);
      setSubmitted(trimmed);
      if (trimmed) {
        setRecent((current) =>
          [
            trimmed,
            ...current.filter(
              (item) => item.toLowerCase() !== trimmed.toLowerCase(),
            ),
          ].slice(0, 5),
        );
      }
      onSearch?.(trimmed);
      scrollRef.current?.scrollTo({ top: 0 });
      window.clearTimeout(statusTimer.current);
      if (latency > 0) {
        setSearching(true);
        statusTimer.current = window.setTimeout(
          () => setSearching(false),
          latency,
        );
      }
    },
    [latency, onSearch],
  );

  const clearFacets = useCallback(
    () => setFacets({ types: [], teams: [], edited: [0, 12] }),
    [],
  );

  const openResult = (result: SearchResult) => {
    setActiveId(result.id);
    if (!wide) setPreviewSheet(true);
  };

  const moveCursor = (index: number) => {
    const next = visible[Math.max(0, Math.min(visible.length - 1, index))];
    if (!next) return;
    setActiveId(next.id);
    requestAnimationFrame(() =>
      document
        .getElementById(`${baseId}-r-${next.id}`)
        ?.scrollIntoView({ block: "nearest" }),
    );
  };

  const vocabulary = useMemo(
    () =>
      Array.from(
        new Set(
          results
            .flatMap((result) => tokenize(`${result.title} ${result.snippet}`))
            .filter((token) => token.length > 3),
        ),
      ),
    [results],
  );

  /** When nothing matches, look for the closest word in the corpus and offer it as a corrected query. */
  const correction = visible.length
    ? null
    : (() => {
        if (!terms.length) return null;
        let changed = false;
        const corrected = terms.map((term) => {
          if (vocabulary.includes(term)) return term;
          let best = term;
          let bestDistance = term.length > 5 ? 3 : 2;
          for (const candidate of vocabulary) {
            const distance = editDistance(term, candidate);
            if (distance < bestDistance) {
              best = candidate;
              bestDistance = distance;
            }
          }
          if (best !== term) changed = true;
          return best;
        });
        return changed ? corrected.join(" ") : null;
      })();

  const hidden = facetCount ? matching.length : 0;
  const setTransition: Transition = reduce
    ? { duration: 0 }
    : {
        duration: motionTokens.duration.standard,
        ease: [...motionTokens.ease.enter],
      };
  const cursorSpring: Transition = reduce
    ? { duration: 0 }
    : motionTokens.spring.smooth;
  const suggestionsId = `${baseId}-suggestions`;

  const facetProps = {
    facets,
    teams,
    typeCounts,
    teamCounts,
    today,
    active: facetCount > 0,
    onToggleType: (kind: ResultKind, checked: boolean) =>
      setFacets((current) => ({
        ...current,
        types: checked
          ? KINDS.filter(
              (entry) => entry === kind || current.types.includes(entry),
            )
          : current.types.filter((entry) => entry !== kind),
      })),
    onToggleTeam: (team: string, checked: boolean) =>
      setFacets((current) => ({
        ...current,
        teams: checked
          ? teams
              .map((entry) => entry.id)
              .filter(
                (entry) => entry === team || current.teams.includes(entry),
              )
          : current.teams.filter((entry) => entry !== team),
      })),
    onRange: (range: [number, number]) =>
      setFacets((current) => ({ ...current, edited: range })),
    onClear: clearFacets,
  };

  return (
    <section
      ref={rootRef}
      className={cx(styles.root, className)}
      aria-label={`Search ${workspace}`}
    >
      <div className={styles.frame}>
        <header className={styles.top}>
          <div className={styles.queryWrap}>
            <form
              className={styles.query}
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                runSearch(query);
              }}
              data-open={menuVisible ? "" : undefined}
            >
              <Search
                className={styles.queryIcon}
                size={18}
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <label htmlFor={`${baseId}-q`} className={styles.srOnly}>
                Search {workspace}
              </label>
              <input
                ref={inputRef}
                id={`${baseId}-q`}
                className={styles.queryInput}
                type="text"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                spellCheck={false}
                placeholder={`Search docs, people, and files in ${workspace}`}
                value={query}
                role="combobox"
                aria-expanded={menuVisible}
                aria-controls={suggestionsId}
                aria-autocomplete="list"
                aria-activedescendant={
                  menuVisible && activeIndex >= 0
                    ? `${suggestionsId}-${suggestions[activeIndex]?.id}`
                    : undefined
                }
                onChange={(event) => {
                  setQuery(event.target.value);
                  setMenuOpen(true);
                  setActiveIndex(-1);
                }}
                onFocus={() => setMenuOpen(true)}
                onBlur={() => {
                  setMenuOpen(false);
                  setActiveIndex(-1);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    if (menuVisible) {
                      setActiveIndex(
                        (index) => (index + 1) % suggestions.length,
                      );
                    } else if (
                      !menuOpen &&
                      suggestions.length &&
                      query.trim() !== submitted
                    ) {
                      setMenuOpen(true);
                      setActiveIndex(0);
                    } else if (visible.length && !searching) {
                      setMenuOpen(false);
                      listRef.current?.focus();
                    }
                    return;
                  }
                  if (event.key === "ArrowUp" && menuVisible) {
                    event.preventDefault();
                    setActiveIndex((index) =>
                      index <= 0 ? suggestions.length - 1 : index - 1,
                    );
                    return;
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    const picked =
                      menuVisible && activeIndex >= 0
                        ? suggestions[activeIndex]
                        : null;
                    runSearch(picked ? picked.text : query);
                    return;
                  }
                  if (event.key === "Escape") {
                    if (menuVisible) {
                      event.preventDefault();
                      setMenuOpen(false);
                      setActiveIndex(-1);
                    } else if (query) {
                      event.preventDefault();
                      setQuery("");
                      setMenuOpen(true);
                    }
                  }
                }}
              />
              <AnimatePresence initial={false}>
                {query ? (
                  <motion.button
                    key="clear"
                    type="button"
                    className={styles.queryClear}
                    aria-label="Clear search text"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setQuery("");
                      setMenuOpen(true);
                      inputRef.current?.focus();
                    }}
                    initial={
                      reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }
                    }
                    animate={{ opacity: 1, scale: 1 }}
                    exit={
                      reduce
                        ? { opacity: 0 }
                        : {
                            opacity: 0,
                            scale: 0.6,
                            transition: {
                              duration: motionTokens.duration.exit,
                              ease: [...motionTokens.ease.exit],
                            },
                          }
                    }
                    transition={
                      reduce ? { duration: 0 } : motionTokens.spring.snappy
                    }
                  >
                    <X size={16} strokeWidth={1.75} aria-hidden="true" />
                  </motion.button>
                ) : null}
              </AnimatePresence>
              <kbd className={styles.slash} aria-hidden="true">
                /
              </kbd>
            </form>
            <AnimatePresence>
              {menuVisible ? (
                <motion.div
                  key="menu"
                  className={styles.menu}
                  initial={
                    reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={
                    reduce
                      ? { opacity: 0, transition: { duration: 0 } }
                      : {
                          opacity: 0,
                          y: -4,
                          scale: 0.98,
                          transition: {
                            duration: motionTokens.duration.exit,
                            ease: [...motionTokens.ease.exit],
                          },
                        }
                  }
                  transition={
                    reduce ? { duration: 0 } : motionTokens.spring.smooth
                  }
                >
                  <ul
                    id={suggestionsId}
                    role="listbox"
                    aria-label="Search suggestions"
                    className={styles.menuList}
                  >
                    {(["recent", "suggested"] as const).map((group) => {
                      const rows = suggestions.filter(
                        (item) => item.group === group,
                      );
                      if (!rows.length) return null;
                      return (
                        <li
                          key={group}
                          role="presentation"
                          className={styles.menuGroup}
                        >
                          <span
                            className={styles.menuLabel}
                            id={`${suggestionsId}-${group}`}
                            aria-hidden="true"
                          >
                            {group === "recent" ? "Recent" : "Suggested"}
                          </span>
                          <ul
                            role="group"
                            aria-labelledby={`${suggestionsId}-${group}`}
                            className={styles.menuRows}
                          >
                            {rows.map((row) => {
                              const index = suggestions.indexOf(row);
                              return (
                                <li
                                  key={row.id}
                                  id={`${suggestionsId}-${row.id}`}
                                  role="option"
                                  aria-selected={index === activeIndex}
                                  className={styles.menuRow}
                                  data-active={
                                    index === activeIndex ? "" : undefined
                                  }
                                  onMouseDown={(event) =>
                                    event.preventDefault()
                                  }
                                  onMouseMove={() => setActiveIndex(index)}
                                  onClick={() => runSearch(row.text)}
                                >
                                  {group === "recent" ? (
                                    <Clock
                                      size={16}
                                      strokeWidth={1.75}
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Search
                                      size={16}
                                      strokeWidth={1.75}
                                      aria-hidden="true"
                                    />
                                  )}
                                  <span className={styles.menuText}>
                                    <Highlight
                                      text={row.text}
                                      terms={
                                        query.trim().toLowerCase() ===
                                        submitted.trim().toLowerCase()
                                          ? []
                                          : tokenize(query)
                                      }
                                    />
                                  </span>
                                  <CornerDownLeft
                                    className={styles.menuEnter}
                                    size={14}
                                    strokeWidth={1.75}
                                    aria-hidden="true"
                                  />
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      );
                    })}
                  </ul>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <BottomSheet
            open={filtersSheet}
            onOpenChange={setFiltersSheet}
            title="Filters"
            detents={[0.9]}
            trigger={
              <button
                type="button"
                className={styles.filterButton}
                aria-label={
                  facetCount ? `Filters, ${facetCount} applied` : "Filters"
                }
              >
                <SlidersHorizontal
                  size={16}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                Filters
                {facetCount ? (
                  <span className={styles.filterBadge}>{facetCount}</span>
                ) : null}
              </button>
            }
          >
            <div className={styles.sheetFacets}>
              <Facets idPrefix={`${baseId}-sheet`} inSheet {...facetProps} />
              <div className={styles.sheetFooter}>
                <Button
                  variant="secondary"
                  onClick={clearFacets}
                  disabled={!facetCount}
                >
                  Clear all
                </Button>
                <Button
                  variant="primary"
                  className={styles.sheetDone}
                  onClick={() => setFiltersSheet(false)}
                >
                  {visible.length === 1
                    ? "Show 1 result"
                    : `Show ${visible.length} results`}
                </Button>
              </div>
            </div>
          </BottomSheet>
        </header>
        <div className={styles.body}>
          <aside className={styles.sidebar} aria-label="Filters">
            <Facets idPrefix={`${baseId}-side`} {...facetProps} />
          </aside>
          <div ref={scrollRef} className={styles.main}>
            <div className={styles.mainHead}>
              <p className={styles.count}>
                {searching ? (
                  <span className={styles.countLoading}>Searching</span>
                ) : (
                  <>
                    <span className={styles.countValue}>
                      <RollCounter value={visible.length} />
                    </span>
                    <span>{visible.length === 1 ? " result" : " results"}</span>
                    <span className={styles.countTime}>
                      {" in "}
                      <span className={styles.num}>{elapsed.toFixed(2)}</span>
                      {" seconds"}
                    </span>
                  </>
                )}
              </p>
              <SegmentedControl
                label="Sort results"
                options={SORT_OPTIONS}
                value={sort}
                onValueChange={(next) => setSort(next as SortKey)}
                className={styles.sort}
              />
            </div>
            <p className={styles.srOnly} role="status">
              {searching
                ? `Searching for ${submitted}`
                : `${visible.length} ${visible.length === 1 ? "result" : "results"}${submitted ? ` for ${submitted}` : ""}`}
            </p>
            <AnimatePresence initial={false}>
              {chips.length ? (
                <motion.div
                  key="chips"
                  className={styles.chipsFrame}
                  initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={
                    reduce
                      ? { opacity: 0, transition: { duration: 0 } }
                      : {
                          height: 0,
                          opacity: 0,
                          transition: {
                            ...motionTokens.spring.smooth,
                            opacity: { duration: motionTokens.duration.exit },
                          },
                        }
                  }
                  transition={
                    reduce ? { duration: 0 } : motionTokens.spring.smooth
                  }
                >
                  <div className={styles.chips}>
                    <FilterToolbar
                      filters={chips}
                      onRemove={(id) =>
                        setFacets((current) => {
                          if (id === "edited")
                            return { ...current, edited: [0, 12] };
                          const [group, value] = id.split(":");
                          return group === "type"
                            ? {
                                ...current,
                                types: current.types.filter(
                                  (entry) => entry !== value,
                                ),
                              }
                            : {
                                ...current,
                                teams: current.teams.filter(
                                  (entry) => entry !== value,
                                ),
                              };
                        })
                      }
                      onClearAll={clearFacets}
                    />
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
            <div className={styles.results} aria-busy={searching || undefined}>
              <AnimatePresence mode="popLayout" initial={false}>
                {searching ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{
                      opacity: 0,
                      transition: {
                        duration: reduce ? 0 : motionTokens.duration.exit,
                      },
                    }}
                    transition={setTransition}
                  >
                    <Skeletons />
                  </motion.div>
                ) : visible.length ? (
                  <motion.div
                    key={signature}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{
                      opacity: 0,
                      transition: {
                        duration: reduce ? 0 : motionTokens.duration.exit,
                      },
                    }}
                    transition={setTransition}
                  >
                    <LayoutGroup id={`${baseId}-cursor-${signature}`}>
                      <ul
                        ref={(node) => {
                          if (node) listRef.current = node;
                        }}
                        className={styles.list}
                        role="listbox"
                        tabIndex={0}
                        aria-label={
                          submitted ? `Results for ${submitted}` : "Results"
                        }
                        aria-activedescendant={
                          activeResult
                            ? `${baseId}-r-${activeResult.id}`
                            : undefined
                        }
                        onKeyDown={(event) => {
                          const key = event.key;
                          if (key === "ArrowDown" || key === "j") {
                            event.preventDefault();
                            moveCursor(activePosition + 1);
                          } else if (key === "ArrowUp" || key === "k") {
                            event.preventDefault();
                            if (activePosition <= 0) inputRef.current?.focus();
                            else moveCursor(activePosition - 1);
                          } else if (key === "Home") {
                            event.preventDefault();
                            moveCursor(0);
                          } else if (key === "End") {
                            event.preventDefault();
                            moveCursor(visible.length - 1);
                          } else if (key === "Enter" || key === " ") {
                            event.preventDefault();
                            if (activeResult) openResult(activeResult);
                          } else if (key === "Escape" || key === "/") {
                            event.preventDefault();
                            inputRef.current?.focus();
                            inputRef.current?.select();
                          }
                        }}
                        onFocus={() => setListFocused(true)}
                        onBlur={() => setListFocused(false)}
                        data-focused={listFocused ? "" : undefined}
                      >
                        {visible.map((result) => {
                          const current = result.id === activeResult?.id;
                          const byline =
                            result.kind === "doc"
                              ? {
                                  who: person(result.author),
                                  text: `edited ${relativeDay(result.updated, today, true)}`,
                                }
                              : result.kind === "file"
                                ? {
                                    who: person(result.owner),
                                    text: `uploaded ${relativeDay(result.updated, today, true)}`,
                                  }
                                : null;
                          return (
                            <li
                              key={result.id}
                              id={`${baseId}-r-${result.id}`}
                              role="option"
                              aria-selected={current}
                              className={styles.result}
                              data-active={current ? "" : undefined}
                              data-kind={result.kind}
                              onClick={() => openResult(result)}
                            >
                              {current ? (
                                <motion.span
                                  layoutId="cursor"
                                  className={styles.cursor}
                                  transition={cursorSpring}
                                  aria-hidden="true"
                                />
                              ) : null}
                              <span className={styles.lead}>
                                <ResultLead result={result} />
                              </span>
                              <span className={styles.content}>
                                <span className={styles.titleRow}>
                                  <span className={styles.title}>
                                    <Highlight
                                      text={result.title}
                                      terms={terms}
                                    />
                                  </span>
                                </span>
                                <span className={styles.meta}>
                                  {metaLine(result, teamLabel)}
                                </span>
                                <span className={styles.snippet}>
                                  <Highlight
                                    text={result.snippet}
                                    terms={terms}
                                  />
                                </span>
                                {byline ? (
                                  <span className={styles.foot}>
                                    <Avatar
                                      name={byline.who.name}
                                      src={byline.who.src}
                                      size="sm"
                                      className={styles.footAvatar}
                                      aria-hidden="true"
                                    />
                                    <span>
                                      {byline.who.name} {byline.text}
                                    </span>
                                  </span>
                                ) : result.kind === "person" ? (
                                  <span className={styles.foot}>
                                    <span>{result.email}</span>
                                  </span>
                                ) : null}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </LayoutGroup>
                    <p className={styles.keys} aria-hidden="true">
                      <kbd>↑</kbd>
                      <kbd>↓</kbd>
                      {" to move, "}
                      <kbd>↵</kbd>
                      {" to open, "}
                      <kbd>/</kbd>
                      {" to search"}
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`empty-${signature}`}
                    className={styles.emptyWrap}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{
                      opacity: 0,
                      transition: {
                        duration: reduce ? 0 : motionTokens.duration.exit,
                      },
                    }}
                    transition={setTransition}
                  >
                    <EmptyState
                      icon={
                        <SearchX width={24} height={24} strokeWidth={1.5} />
                      }
                      title={
                        submitted
                          ? `No results for “${submitted}”`
                          : "Nothing matches these filters"
                      }
                      description={
                        hidden
                          ? `Your filters hide ${hidden === 1 ? "1 result" : `${hidden} results`}. Clear them to see everything that matches.`
                          : correction
                            ? "Check the spelling, or try one of these searches."
                            : "Try a broader word, or one of these searches."
                      }
                      action={
                        <div className={styles.emptyActions}>
                          {hidden ? (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={clearFacets}
                            >
                              Clear filters
                            </Button>
                          ) : null}
                          {!hidden && correction ? (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => runSearch(correction)}
                            >
                              Search for “{correction}”
                            </Button>
                          ) : null}
                          {hidden
                            ? null
                            : suggestedSearches.slice(0, 3).map((text) => (
                                <Button
                                  key={text}
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => runSearch(text)}
                                >
                                  {text}
                                </Button>
                              ))}
                        </div>
                      }
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <aside className={styles.preview} aria-label="Preview">
            <AnimatePresence mode="popLayout" initial={false}>
              {searching ? (
                <motion.div
                  key="loading"
                  className={styles.previewSkeleton}
                  aria-hidden="true"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{
                    opacity: 0,
                    transition: {
                      duration: reduce ? 0 : motionTokens.duration.exit,
                    },
                  }}
                >
                  <span
                    className={styles.bone}
                    style={{ width: "70%", height: 18 }}
                  />
                  <span
                    className={styles.bone}
                    style={{ width: "45%", height: 10 }}
                  />
                  <span
                    className={styles.bone}
                    style={{ width: "100%", height: 10, marginTop: 12 }}
                  />
                  <span
                    className={styles.bone}
                    style={{ width: "92%", height: 10 }}
                  />
                  <span
                    className={styles.bone}
                    style={{ width: "64%", height: 10 }}
                  />
                </motion.div>
              ) : activeResult ? (
                <motion.div
                  key={activeResult.id}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    transition: {
                      duration: reduce ? 0 : motionTokens.duration.instant,
                    },
                  }}
                  transition={setTransition}
                >
                  <PreviewCard
                    result={activeResult}
                    terms={terms}
                    today={today}
                    teamLabel={teamLabel}
                    onOpen={onOpen}
                  />
                </motion.div>
              ) : (
                <motion.p
                  key="none"
                  className={styles.previewEmpty}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {visible.length
                    ? "Select a result to preview it here"
                    : "Nothing to preview"}
                </motion.p>
              )}
            </AnimatePresence>
          </aside>
        </div>
      </div>
      <BottomSheet
        open={previewSheet && !wide && Boolean(activeResult)}
        onOpenChange={setPreviewSheet}
        title={
          activeResult
            ? activeResult.kind === "doc"
              ? "Doc"
              : activeResult.kind === "person"
                ? "Person"
                : "File"
            : "Preview"
        }
        detents={[0.62, 0.92]}
      >
        {activeResult ? (
          <div className={styles.sheetPreview} key={activeResult.id}>
            <PreviewCard
              result={activeResult}
              terms={terms}
              today={today}
              teamLabel={teamLabel}
              onOpen={onOpen}
            />
          </div>
        ) : (
          <span />
        )}
      </BottomSheet>
    </section>
  );
}

/** Levenshtein distance, used only to offer a corrected query when nothing matches. */
function editDistance(left: string, right: string) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const carry = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (left[row - 1] !== right[column - 1] ? 1 : 0),
      );
      diagonal = carry;
    }
  }
  return previous[right.length];
}

export default SearchResults;
