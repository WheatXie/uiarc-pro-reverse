"use client";

/**
 * Agent memory — Arc Pro block, reconstructed from the shipped preview runtime
 * (`_next/static/chunks/29316.502e91df456a28a1.js`) and its CSS module
 * (`_next/static/css/7361cfd2728b823f.css`).
 *
 * Behaviour kept from the original:
 * - memories are grouped by kind and the toolbar filters by group; the pill highlight is one shared
 *   layout element, so it slides between filters instead of crossfading;
 * - search collapses the filters, matches text and person names, highlights hits, and the list
 *   fades at both scroll edges through mask stops driven by data attributes;
 * - a row can be edited inline (textarea grows with its content, Enter saves, Esc cancels, over the
 *   200 character budget the hint turns into a counter and Save is refused) or forgotten, which
 *   swaps the row for an undo bar with a draining countdown ring;
 * - undo state lives outside the list: the row unmounts at once, the countdown runs in `now`, and
 *   when it reaches zero the memory is dropped from state and reported through `onChange`;
 * - adding a memory guesses the group from keywords (or asks `classify`), refuses duplicates and a
 *   full budget, then flies the new row in from the add field and flashes it;
 * - a captured memory arrives as a pill above the list; pressing it files that memory into its group
 *   with the same flight, and the pill switches to a saved state before it leaves;
 * - the meter counts characters used against the budget, warns above 90% and reads full at 100%;
 * - every motion path jumps instead of animating under reduced motion.
 */
import {
  forwardRef,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type Variants } from "motion/react";
import {
  ArrowDown,
  BookmarkPlus,
  Check,
  CircleAlert,
  Info,
  PenLine,
  Plus,
  Search,
  SearchX,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { Switch } from "../switch/switch";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { Tooltip } from "../tooltip/tooltip";
import { people } from "../lib/media";
import { motionTokens } from "../motion-tokens";
import styles from "./agent-memory.module.css";

export interface MemorySource {
  /** Where the memory came from: typed in by hand, or noted from a chat. */
  kind: "chat" | "manual";
  /** ISO date (`YYYY-MM-DD`) the memory was noted on. */
  date: string;
  /** Optional link back to the chat that produced it, rendered on “From a chat”. */
  href?: string;
}

export interface MemoryPerson {
  /** Full name, also matched by search. */
  name: string;
  /** Avatar image url. */
  src: string;
}

export interface Memory {
  /** Stable id; also the row's `data-memory-id` and the key for every animation. */
  id: string;
  /** Id of the group this memory belongs to. */
  group: string;
  /** The sentence shown in the row. */
  text: string;
  /** Provenance shown under the text on hover or focus. */
  source: MemorySource;
  /** Person the memory is about, when it belongs to the people group. */
  person?: MemoryPerson;
}

export interface MemoryGroup {
  /** Id used by `Memory.group` and by the filter buttons. */
  id: string;
  /** Label on the filter button and above the group's rows. */
  label: string;
  /** Shown inside the group when it has no rows and no search is running. */
  empty?: string;
}

export interface MemoryCapture {
  /** One-line note quoted on the pill, e.g. "Noted: you prefer pnpm over npm". */
  note: string;
  /** The memory the pill would file; `source` is filled in with `chat` and today. */
  memory: {
    id: string;
    group: string;
    text: string;
    source?: Partial<MemorySource>;
  };
}

export interface MemorySettings {
  /** Whether saved memories are referenced at all. Defaults to on. */
  savedMemories?: boolean;
  /** Whether past chats are searched. Defaults to on. */
  chatHistory?: boolean;
}

/** Reported after every change the block commits, for the host to persist. */
export type MemoryChange =
  | { type: "add"; memory: Memory }
  | { type: "edit"; memory: Memory; previous: string }
  | { type: "forget"; memory: Memory }
  | { type: "capture"; memory: Memory };

export interface AgentMemoryProps {
  /** Controlled memories. Omit to start from the sample set and let the block own the list. */
  memories?: Memory[];
  /** Memories waiting to be filed, shown one at a time as a pill above the list. Defaults to the sample capture. */
  captured?: MemoryCapture[];
  /** Groups, in display order. Defaults to About you / Preferences / Projects / People. */
  groups?: MemoryGroup[];
  /** Initial switch positions. The block owns them after mount. */
  settings?: MemorySettings;
  /** Character budget the meter counts against. Defaults to the sample list at 62% full. */
  capacity?: number;
  /** Name used in the subtitle and the empty and notice copy. Defaults to “Claude”. */
  assistantName?: string;
  /** Replaces the keyword guess when adding a memory. Receives the normalized text, returns a group id. */
  classify?: (text: string) => string | Promise<string>;
  /** Called with the next list after an add, edit, forget, undo expiry or captured save. */
  onChange?: (memories: Memory[], change: MemoryChange) => void | Promise<void>;
  /** Called when a settings switch is toggled. */
  onToggle?: (key: "savedMemories" | "chatHistory", on: boolean) => void;
  /** Seconds the undo bar stays up after forgetting a memory. Defaults to 5. */
  undoSeconds?: number;
  /** Extra class on the outer wrapper. */
  className?: string;
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const { spring, duration } = motionTokens;

/** Spring used for every row, group and slot height change. */
const ITEM_SPRING = { type: "spring", visualDuration: 0.32, bounce: 0 } as const;

/** Shared-layout spring for the filter pill. */
const FILTER_SPRING = { type: "spring", visualDuration: 0.26, bounce: 0 } as const;

/** How long the capture flyer takes, plus a frame of slack. */
const FLYER_MS = Math.round(1000 * spring.smooth.visualDuration) + 40;

export const memoryGroups: MemoryGroup[] = [
  {
    id: "about",
    label: "About you",
    empty: "Nothing about you yet. Details like your role or where you live land here.",
  },
  {
    id: "preferences",
    label: "Preferences",
    empty: "No preferences yet. Say how you like answers and they land here.",
  },
  {
    id: "projects",
    label: "Projects",
    empty: "No projects yet. Work you mention more than once lands here.",
  },
  {
    id: "people",
    label: "People",
    empty: "No people yet. Colleagues you mention by name land here.",
  },
];

function personOf(id: string): MemoryPerson {
  const match = people.find((person) => person.id === id);
  return { name: match?.name ?? id, src: `/media/people/${id}.svg` };
}

export const sampleMemories: Memory[] = [
  {
    id: "m-role",
    group: "about",
    text: "Works as a staff product engineer on the billing team at Northwind",
    source: { kind: "chat", date: "2026-09-08" },
  },
  {
    id: "m-zurich",
    group: "about",
    text: "Lives in Zurich and works on Central European Time",
    source: { kind: "chat", date: "2026-09-08" },
  },
  {
    id: "m-portuguese",
    group: "about",
    text: "Is learning Portuguese, about 20 minutes a day",
    source: { kind: "chat", date: "2026-10-02" },
  },
  {
    id: "m-short",
    group: "preferences",
    text: "Wants the short answer first, with details after",
    source: { kind: "manual", date: "2026-09-12" },
  },
  {
    id: "m-diffs",
    group: "preferences",
    text: "Likes diffs instead of whole files when reviewing code",
    source: { kind: "chat", date: "2026-10-14" },
  },
  {
    id: "m-units",
    group: "preferences",
    text: "Prefers metric units and 24 hour times",
    source: { kind: "chat", date: "2026-09-21" },
  },
  {
    id: "m-next",
    group: "projects",
    text: "Is moving the billing dashboard to Next.js 16 before the Q4 freeze",
    source: { kind: "chat", date: "2026-10-14" },
  },
  {
    id: "m-pricing",
    group: "projects",
    text: "Is writing a design doc on usage based pricing, due Oct 31",
    source: { kind: "chat", date: "2026-10-17" },
  },
  {
    id: "m-daniel",
    group: "people",
    person: personOf("daniel-kim"),
    text: "Daniel Kim owns the billing API and reviews every schema change",
    source: { kind: "chat", date: "2026-10-09" },
  },
  {
    id: "m-sofia",
    group: "people",
    person: personOf("sofia-ramirez"),
    text: "Reports to Sofia Ramirez, with 1:1s on Thursday mornings",
    source: { kind: "chat", date: "2026-10-01" },
  },
  {
    id: "m-chloe",
    group: "people",
    person: personOf("chloe-nguyen"),
    text: "Chloe Nguyen runs the pricing analysis for the design doc",
    source: { kind: "manual", date: "2026-10-17" },
  },
];

export const sampleCaptured: MemoryCapture[] = [
  {
    note: "Noted: you prefer pnpm over npm",
    memory: {
      id: "m-pnpm",
      group: "preferences",
      text: "Prefers pnpm over npm in install commands",
    },
  },
];

/** Day new memories are dated with, matching the reference preview's clock. */
const TODAY = "2026-10-20";

/** `Sep 8` — parsed at noon UTC so no timezone can shift the day. */
const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** The sample set sits at 62% of the budget. */
const DEFAULT_CAPACITY = Math.round(totalChars(sampleMemories) / 0.62);

const PEOPLE_WORDS =
  /\b(manager|boss|colleague|coworker|teammate|partner|wife|husband|friend|sister|brother|mom|dad|mother|father|reports to|my (?:lead|team lead|designer|pm))\b/i;
const PREFERENCE_WORDS =
  /\b(prefer|prefers|like|likes|love|loves|hate|hates|always|never|don't|do not|please|style|tone|format|units|shorter|longer|examples?|answers?|replies|reply|use|uses)\b/i;
const PROJECT_WORDS =
  /\b(project|building|build|migrat\w*|working on|launch\w*|deadline|due|doc|repo|app|dashboard|release|roadmap|shipping|ship|side project|prototype)\b/i;
const NAMED_PERSON = /\b[A-Z][a-z]+ [A-Z][a-z]+ (?:is|owns|leads|runs|reviews|works|manages|handles|knows|helps|joined|approves)\b/;

/** Characters the list occupies, which is what the meter counts. */
function totalChars(memories: Memory[]): number {
  return memories.reduce((total, memory) => total + memory.text.length, 0);
}

/** Finds a known person's name inside a sentence, case-insensitively. */
function findPerson(text: string): MemoryPerson | undefined {
  const match = people.find((person) => text.toLowerCase().includes(person.name.toLowerCase()));
  return match ? { name: match.name, src: `/media/people/${match.id}.svg` } : undefined;
}

/** Trims, collapses whitespace, drops trailing punctuation and capitalizes. */
function normalizeText(text: string): string {
  const next = text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.\s]+$/, "");
  return next ? next[0].toUpperCase() + next.slice(1) : "";
}

/**
 * Guesses the group a new memory belongs to from the words in it — the same ladder the reference
 * preview uses when no `classify` prop is supplied.
 */
export function guessGroup(text: string): string {
  if (findPerson(text) || NAMED_PERSON.test(text) || PEOPLE_WORDS.test(text)) return "people";
  if (PREFERENCE_WORDS.test(text)) return "preferences";
  if (PROJECT_WORDS.test(text)) return "projects";
  return "about";
}

function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function omitKey<T>(map: Record<string, T>, key: string): Record<string, T> {
  const next = { ...map };
  delete next[key];
  return next;
}

const itemVariants: Variants = {
  hidden: { height: 0, opacity: 0 },
  shown: (reduced: boolean) => ({
    height: "auto",
    opacity: 1,
    transition: reduced
      ? { duration: 0 }
      : { height: ITEM_SPRING, opacity: { duration: 0.16, ease: EASE, delay: 0.04 } },
  }),
  gone: (reduced: boolean) => ({
    height: 0,
    opacity: 0,
    transition: reduced ? { duration: 0 } : { height: ITEM_SPRING, opacity: { duration: 0.1, ease: EASE } },
  }),
};

const faceVariants: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.16, ease: EASE } },
  gone: { opacity: 0, transition: { duration: 0.1, ease: EASE } },
};

/** Height that animates to whatever its content measures, and jumps on first paint. */
function AutoHeight({
  children,
  reduced,
  className,
  id,
}: {
  children: ReactNode;
  reduced: boolean;
  className?: string;
  id?: string;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const outer = useRef<HTMLDivElement>(null);
  const height = useMotionValue<number | "auto">("auto");
  const measured = useRef(false);

  useLayoutEffect(() => {
    const node = inner.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let controls: ReturnType<typeof animate> | undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const next = Math.round(entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight);
      const current = height.get();
      if (!measured.current || reduced || current === "auto") {
        controls?.stop();
        measured.current = true;
        height.jump(next);
        return;
      }
      if (current === next) return;
      controls?.stop();
      outer.current?.setAttribute("data-moving", "");
      controls = animate(height, next, {
        ...spring.smooth,
        onComplete: () => outer.current?.removeAttribute("data-moving"),
      });
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      controls?.stop();
    };
  }, [height, reduced]);

  return (
    <motion.div ref={outer} id={id} className={cx(styles.autoHeight, className)} style={{ height }}>
      <div ref={inner} className={styles.autoHeightInner}>
        {children}
      </div>
    </motion.div>
  );
}

/** One slot that swaps content with a short lift, keyed by an id the caller derives from its state. */
function Fade({
  id,
  children,
  reduced,
  className,
  align = "start",
}: {
  id: string;
  children: ReactNode;
  reduced: boolean;
  className?: string;
  align?: "start" | "end";
}) {
  return (
    <span className={cx(styles.fade, className)} data-align={align}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          className={styles.fadeItem}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { duration: reduced ? duration.instant : duration.fast, ease: EASE },
          }}
          exit={{ opacity: 0, y: 0, transition: { duration: 0.1 * Number(!reduced), ease: EASE } }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Countdown ring on the undo button; the drain is a CSS animation so it stays off the main thread. */
function Ring({ total, deadline, reduced }: { total: number; deadline: number; reduced: boolean }) {
  const fill = useRef<SVGCircleElement>(null);

  useLayoutEffect(() => {
    const node = fill.current;
    if (!node) return;
    node.style.animationDelay = `${Math.min(0, deadline - total - Date.now())}ms`;
  }, [deadline, total]);

  return (
    <svg className={styles.ring} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6" className={styles.ringTrack} />
      <circle
        ref={fill}
        cx="8"
        cy="8"
        r="6"
        pathLength={1}
        className={styles.ringFill}
        data-static={reduced || undefined}
        style={{ animationDuration: `${total}ms` }}
      />
    </svg>
  );
}

/** Wraps every case-insensitive hit of the trimmed query in a `mark`. */
function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim().toLowerCase();
  if (!needle) return <>{text}</>;

  const parts: ReactNode[] = [];
  const haystack = text.toLowerCase();
  let cursor = 0;
  let hit = haystack.indexOf(needle);
  while (hit !== -1) {
    if (hit > cursor) parts.push(text.slice(cursor, hit));
    parts.push(
      <mark className={styles.match} key={hit}>
        {text.slice(hit, hit + needle.length)}
      </mark>,
    );
    cursor = hit + needle.length;
    hit = haystack.indexOf(needle, cursor);
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/** Characters used against the budget, warning at 90% and reading full at 100%. */
function Meter({ share, reduced }: { share: number; reduced: boolean }) {
  const percent = Math.min(100, Math.round(100 * share));
  const level = percent >= 100 ? "full" : percent >= 90 ? "high" : "ok";
  const number = useMotionValue(percent);
  const rounded = useTransform(number, (value) => Math.round(value));
  const fill = useMotionValue(Math.min(1, share));

  useEffect(() => {
    if (reduced) {
      number.jump(percent);
      return;
    }
    const controls = animate(number, percent, { duration: 1.5 * duration.standard, ease: EASE });
    return () => controls.stop();
  }, [percent, reduced, number]);

  useEffect(() => {
    if (reduced) {
      fill.jump(Math.min(1, share));
      return;
    }
    const controls = animate(fill, Math.min(1, share), spring.smooth);
    return () => controls.stop();
  }, [share, reduced, fill]);

  return (
    <div
      className={styles.meter}
      data-level={level}
      role="meter"
      aria-label="Memory used"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent}% full`}
    >
      <span className={styles.meterLabel} aria-hidden="true">
        {level === "ok" ? null : <TriangleAlert className={styles.meterIcon} />}
        <span className={styles.meterNumber}>
          <motion.span>{rounded}</motion.span>%
        </span>{" "}
        full
      </span>
      <span className={styles.meterTrack} aria-hidden="true">
        <motion.span className={styles.meterFill} style={{ scaleX: fill }} />
      </span>
    </div>
  );
}

interface AddStatus {
  kind: "idle" | "sorting" | "added" | "error";
  label?: string;
  message?: string;
}

/** The add field: the trailing slot carries Add, the sorting shimmer, the landed group, or the error. */
function AddForm({ reduced, onAdd }: { reduced: boolean; onAdd: (text: string, anchor: HTMLInputElement) => Promise<string> }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<AddStatus>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef(0);
  const inputId = useId();
  const slotId = useId();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const busy = status.kind === "sorting";

  function push(next: AddStatus, ms: number) {
    window.clearTimeout(timer.current);
    setStatus(next);
    timer.current = window.setTimeout(() => setStatus({ kind: "idle" }), ms);
  }

  async function submit(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy || !text.trim() || !inputRef.current) return;
    window.clearTimeout(timer.current);
    setStatus({ kind: "sorting" });
    try {
      const label = await onAdd(text, inputRef.current);
      setText("");
      push({ kind: "added", label }, 2200);
    } catch (error) {
      push(
        {
          kind: "error",
          message: error instanceof Error && error.message ? error.message : "Couldn't add it. Try again.",
        },
        3200,
      );
    }
  }

  const face = status.kind === "idle" ? (text.trim() ? "add" : "empty") : status.kind;

  return (
    <form
      className={styles.add}
      onSubmit={submit}
      data-frame-keep=""
      data-busy={busy || undefined}
    >
      <Plus className={styles.addIcon} aria-hidden="true" />
      <label className={styles.srOnly} htmlFor={inputId}>
        Add memory
      </label>
      <input
        id={inputId}
        ref={inputRef}
        className={styles.addField}
        placeholder="Add memory"
        value={text}
        readOnly={busy}
        autoComplete="off"
        aria-describedby={slotId}
        maxLength={240}
        onChange={(event) => {
          setText(event.target.value);
          if (status.kind === "error") setStatus({ kind: "idle" });
        }}
      />
      <span id={slotId} className={styles.addSlot} data-error={status.kind === "error" || undefined}>
        <Fade id={face} reduced={reduced} align="end">
          {face === "add" ? (
            <Button type="submit" variant="primary" size="sm">
              Add
            </Button>
          ) : face === "sorting" ? (
            <TextShimmer className={styles.addNote}>Sorting into a group</TextShimmer>
          ) : status.kind === "added" ? (
            <span className={styles.addNote}>
              <Check aria-hidden="true" />
              Added to {status.label}
            </span>
          ) : status.kind === "error" ? (
            <span className={styles.addNote}>
              <CircleAlert aria-hidden="true" />
              {status.message}
            </span>
          ) : null}
        </Fade>
      </span>
    </form>
  );
}

interface RowItemProps {
  memory: Memory;
  query: string;
  reduced: boolean;
  editing: boolean;
  undo?: { deadline: number; total: number };
  now: number;
  landing: boolean;
  flash?: number;
  onEdit: () => void;
  onCloseEdit: () => void;
  onSave: (text: string) => Promise<void>;
  onForget: () => void;
  onUndo: () => void;
}

/**
 * One memory: undo bar, editor or text row, whichever the props ask for. Focus is handed between
 * the faces so keyboard users are never dropped on the body.
 */
function RowItem(props: RowItemProps) {
  const { memory, reduced, editing, undo } = props;
  const face = undo ? "undo" : editing ? "edit" : "view";
  const focusTarget = useRef<string | null>(null);
  const rowRef = useRef<HTMLLIElement>(null);
  const previousFace = useRef(face);

  useLayoutEffect(() => {
    if (previousFace.current === face) return;
    const inside = rowRef.current?.contains(document.activeElement) || document.activeElement === document.body;
    if (inside) {
      focusTarget.current =
        face === "edit"
          ? "field"
          : face === "undo"
            ? "undo"
            : previousFace.current === "undo"
              ? "forget"
              : "edit";
    }
    previousFace.current = face;
  }, [face]);

  useEffect(() => {
    const target = focusTarget.current;
    if (!target) return;
    focusTarget.current = null;
    const node = rowRef.current?.querySelector<HTMLElement>(`[data-focus="${target}"]`);
    node?.focus({ preventScroll: true });
    if (target === "field" && node instanceof HTMLTextAreaElement) {
      node.setSelectionRange(node.value.length, node.value.length);
    }
  });

  return (
    <motion.li
      ref={rowRef}
      className={styles.rowItem}
      data-memory-id={memory.id}
      custom={reduced}
      variants={itemVariants}
      initial="hidden"
      animate="shown"
      exit="gone"
    >
      <AutoHeight reduced={reduced}>
        <div className={styles.stack}>
          <AnimatePresence initial={false}>
            {face === "undo" && undo ? (
              <motion.div key="undo" variants={faceVariants} initial="hidden" animate="shown" exit="gone">
                <UndoBar text={memory.text} undo={undo} now={props.now} reduced={reduced} onUndo={props.onUndo} />
              </motion.div>
            ) : face === "edit" ? (
              <motion.div key="edit" variants={faceVariants} initial="hidden" animate="shown" exit="gone">
                <Editor memory={memory} onSave={props.onSave} onClose={props.onCloseEdit} />
              </motion.div>
            ) : (
              <motion.div key={`view:${memory.text}`} variants={faceVariants} initial="hidden" animate="shown" exit="gone">
                <RowView {...props} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </AutoHeight>
    </motion.li>
  );
}

function RowView({ memory, query, landing, flash, onEdit, onForget }: RowItemProps) {
  return (
    <div className={styles.row} data-landing={landing || undefined}>
      {flash ? (
        // The shipped build keys this node off the flash counter but renders it empty, so the
        // key remounts the span and restarts the CSS drain without painting any text.
        <span key={flash} className={styles.flash} aria-hidden="true" />
      ) : null}
      <RowFace memory={memory} query={query} />
      <div className={styles.rowActions}>
        <Tooltip content="Edit">
          <button
            type="button"
            className={styles.iconButton}
            data-focus="edit"
            aria-label={`Edit memory: ${memory.text}`}
            onClick={onEdit}
          >
            <PenLine aria-hidden="true" />
          </button>
        </Tooltip>
        <Tooltip content="Forget">
          <button
            type="button"
            className={styles.iconButton}
            data-focus="forget"
            aria-label={`Forget memory: ${memory.text}`}
            onClick={onForget}
          >
            <Trash2 aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

/** Text plus provenance; the provenance only shows while the row is hovered or focused. */
function RowFace({ memory, query }: { memory: Memory; query: string }) {
  const { source } = memory;
  return (
    <>
      {memory.person ? (
        <Avatar className={styles.portrait} name={memory.person.name} src={memory.person.src} size="sm" />
      ) : null}
      <div className={styles.rowBody}>
        <p className={styles.rowText} data-row-text="">
          <Highlight text={memory.text} query={query} />
        </p>
        <p className={styles.rowMeta}>
          {source.kind === "manual" ? (
            <span>Added by you</span>
          ) : source.href ? (
            <a className={styles.sourceLink} href={source.href}>
              From a chat
            </a>
          ) : (
            <span>From a chat</span>
          )}
          <span aria-hidden="true">·</span>
          <time dateTime={source.date}>{DATE_FORMAT.format(new Date(`${source.date}T12:00:00Z`))}</time>
        </p>
      </div>
    </>
  );
}

/** Inline editor. Enter saves, Esc cancels, and the hint turns into a character counter past 200. */
function Editor({ memory, onSave, onClose }: { memory: Memory; onSave: (text: string) => Promise<void>; onClose: () => void }) {
  const [text, setText] = useState(memory.text);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();
  const hintId = useId();

  useLayoutEffect(() => {
    const node = field.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [text]);

  const length = text.trim().length;

  async function submit(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (saving) return;
    const next = text.trim();
    if (!next) {
      setError("Write something, or use Forget to remove it.");
      field.current?.focus();
      return;
    }
    if (length > 200) {
      setError("Keep it under 200 characters.");
      field.current?.focus();
      return;
    }
    if (next === memory.text) {
      onClose();
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(next);
    } catch (caught) {
      setSaving(false);
      setError(caught instanceof Error && caught.message ? caught.message : "Couldn't save. Try again.");
    }
  }

  return (
    <form className={styles.editor} onSubmit={submit}>
      <label className={styles.srOnly} htmlFor={fieldId}>
        Edit memory
      </label>
      <textarea
        id={fieldId}
        ref={field}
        data-focus="field"
        className={styles.editorField}
        rows={1}
        value={text}
        readOnly={saving}
        aria-invalid={!!error || undefined}
        aria-describedby={hintId}
        onChange={(event) => {
          setText(event.target.value);
          if (error) setError("");
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            if (!saving) onClose();
            return;
          }
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
          event.preventDefault();
          void submit();
        }}
      />
      <div className={styles.editorFooter}>
        <p
          id={hintId}
          className={styles.editorHint}
          data-error={error || length > 200 ? "" : undefined}
          aria-live="polite"
        >
          {error ? (
            <>
              <CircleAlert aria-hidden="true" />
              {error}
            </>
          ) : length > 200 ? (
            <>
              <CircleAlert aria-hidden="true" />
              {length} of 200 characters
            </>
          ) : (
            "Enter to save, Esc to cancel"
          )}
        </p>
        <div className={styles.editorActions}>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={saving}>
            Save
          </Button>
        </div>
      </div>
    </form>
  );
}

/** Replaces a forgotten row until the countdown runs out. */
function UndoBar({
  text,
  undo,
  now,
  reduced,
  onUndo,
}: {
  text: string;
  undo: { deadline: number; total: number };
  now: number;
  reduced: boolean;
  onUndo: () => void;
}) {
  const seconds = Math.max(0, Math.ceil((undo.deadline - now) / 1000));
  return (
    <div className={styles.undoBar} role="group" aria-label="Forgotten memory">
      <p className={styles.undoText}>
        Forgot <q className={styles.undoQuote}>{text}</q>
      </p>
      <button type="button" className={cx(styles.undoButton)} data-focus="undo" onClick={onUndo}>
        <Ring total={undo.total} deadline={undo.deadline} reduced={reduced} />
        Undo
        <span className={styles.undoSeconds} aria-label={`${seconds} seconds left`}>
          {seconds}s
        </span>
      </button>
    </div>
  );
}

interface ToolbarProps {
  groups: MemoryGroup[];
  view: string;
  onViewChange: (view: string) => void;
  searchOpen: boolean;
  query: string;
  reduced: boolean;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  onQueryChange: (query: string) => void;
}

/** Filter pills with a roving tab stop, plus the search field that replaces them when open. */
const Toolbar = forwardRef<HTMLInputElement, ToolbarProps>(function Toolbar(
  { groups, view, onViewChange, searchOpen, query, reduced, onOpenSearch, onCloseSearch, onQueryChange },
  inputRef,
) {
  const options = [{ value: "all", label: "All" }, ...groups.map((group) => ({ value: group.id, label: group.label }))];
  const active = Math.max(
    0,
    options.findIndex((option) => option.value === view),
  );
  const filtersRef = useRef<HTMLDivElement>(null);

  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    const last = options.length - 1;
    const next =
      event.key === "ArrowRight"
        ? active === last
          ? 0
          : active + 1
        : event.key === "ArrowLeft"
          ? active === 0
            ? last
            : active - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    event.preventDefault();
    onViewChange(options[next].value);
    event.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-value="${options[next].value}"]`)?.focus({
      preventScroll: true,
    });
  }

  useLayoutEffect(() => {
    const node = filtersRef.current;
    if (!node) return;
    const update = () => {
      node.toggleAttribute("data-fade-start", node.scrollLeft > 1);
      node.toggleAttribute("data-fade-end", node.scrollWidth - node.clientWidth - node.scrollLeft > 1);
    };
    update();
    node.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(node);
    return () => {
      node.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    const node = filtersRef.current;
    const pressed = node?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!node || !pressed || node.scrollWidth <= node.clientWidth) return;
    const start = pressed.offsetLeft - 20;
    const end = pressed.offsetLeft + pressed.offsetWidth + 20 - node.clientWidth;
    const target = node.scrollLeft > start ? start : node.scrollLeft < end ? end : node.scrollLeft;
    if (target !== node.scrollLeft) {
      node.scrollTo({ left: Math.max(0, target), behavior: reduced ? "auto" : "smooth" });
    }
  }, [view, reduced]);

  return (
    <div className={styles.toolbar} data-search={searchOpen || undefined}>
      <motion.div
        ref={filtersRef}
        layoutScroll
        className={styles.filters}
        role="group"
        aria-label="Filter memories"
        inert={searchOpen || undefined}
      >
        {options.map((option, index) => (
          <button
            key={option.value}
            type="button"
            className={styles.filter}
            data-value={option.value}
            aria-pressed={view === option.value}
            tabIndex={index === active ? 0 : -1}
            onClick={() => onViewChange(option.value)}
            onKeyDown={onKeyDown}
          >
            {view === option.value ? (
              <motion.span
                layoutId="filter"
                className={styles.filterBg}
                style={{ borderRadius: 999 }}
                transition={reduced ? { duration: 0 } : FILTER_SPRING}
                aria-hidden="true"
              />
            ) : null}
            <span className={styles.filterLabel}>{option.label}</span>
          </button>
        ))}
      </motion.div>
      <div className={styles.search} data-open={searchOpen || undefined}>
        <button
          type="button"
          className={styles.searchToggle}
          aria-label="Search memories"
          aria-expanded={searchOpen}
          tabIndex={searchOpen ? -1 : 0}
          onClick={
            searchOpen
              ? () => {
                  if (inputRef && "current" in inputRef) inputRef.current?.focus();
                }
              : onOpenSearch
          }
        >
          <Search aria-hidden="true" />
        </button>
        <input
          ref={inputRef}
          type="search"
          className={styles.searchInput}
          placeholder="Search memories"
          aria-label="Search memories"
          value={query}
          tabIndex={searchOpen ? 0 : -1}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            onCloseSearch();
          }}
          onBlur={(event) => {
            if (event.currentTarget.value.trim()) return;
            const next = event.relatedTarget;
            const scope = event.currentTarget.closest(`.${styles.search}`);
            if (next instanceof Node && scope?.contains(next)) return;
            onCloseSearch();
          }}
        />
        <button
          type="button"
          className={styles.searchClose}
          aria-label="Close search"
          tabIndex={searchOpen ? 0 : -1}
          onClick={onCloseSearch}
        >
          <X aria-hidden="true" />
        </button>
      </div>
    </div>
  );
});

/** One settings row: label, fading description, switch. */
function SettingRow({
  id,
  title,
  description,
  on,
  reduced,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  on: boolean;
  reduced: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className={styles.setting}>
      <div className={styles.settingText}>
        <label className={styles.settingLabel} htmlFor={id} id={`${id}-label`}>
          {title}
        </label>
        <p className={styles.settingDescription} id={`${id}-description`}>
          <Fade id={description} reduced={reduced}>
            {description}
          </Fade>
        </p>
      </div>
      <Switch id={id} checked={on} onCheckedChange={onChange} aria-labelledby={`${id}-label`} aria-describedby={`${id}-description`} />
    </div>
  );
}

/** The pill label: the captured memory waits behind a “Memory updated” line. */
function PillLabel({ note }: { note: string }) {
  return (
    <span className={styles.pillLabel}>
      <BookmarkPlus aria-hidden="true" />
      <span className={styles.pillTitle}>Memory updated</span>
      <span className={styles.pillNote}>{note}</span>
      <ArrowDown className={styles.pillArrow} aria-hidden="true" />
    </span>
  );
}

interface Flyer {
  memory: Memory;
  n: number;
  from: { x: number; y: number } | null;
  to: { x: number; y: number; w: number } | null;
}

/**
 * Memory list with grouped rows, filtering, search, inline edit, forget with undo, and the add
 * field. Uncontrolled unless `memories` is supplied.
 */
export function AgentMemory({
  memories: memoriesProp,
  captured = sampleCaptured,
  groups = memoryGroups,
  settings,
  capacity = DEFAULT_CAPACITY,
  assistantName = "Claude",
  classify,
  onChange,
  onToggle,
  undoSeconds = 5,
  className,
}: AgentMemoryProps) {
  const prefersReduced = useReducedMotion();
  // The frame is server rendered without a motion preference; flip after mount so the first paint matches.
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const reduced = !!prefersReduced && hydrated;
  const uid = useId();
  const undoMs = 1000 * undoSeconds;

  const [memories, setMemories] = useState<Memory[]>(() => memoriesProp ?? sampleMemories);
  const [previousProp, setPreviousProp] = useState(memoriesProp);
  if (memoriesProp !== previousProp) {
    setPreviousProp(memoriesProp);
    setMemories(memoriesProp ?? sampleMemories);
  }

  const [flags, setFlags] = useState<MemorySettings>(() => ({ savedMemories: true, chatHistory: true, ...settings }));
  const [view, setView] = useState("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [undo, setUndo] = useState<Record<string, { deadline: number; total: number }>>({});
  const [now, setNow] = useState(0);
  const [flyer, setFlyer] = useState<Flyer | null>(null);
  const [flash, setFlashMap] = useState<Record<string, number>>({});
  const [captureState, setCaptureState] = useState<Record<string, "saved" | "gone">>({});
  const [status, setStatus] = useState("");

  const counter = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listInnerRef = useRef<HTMLDivElement>(null);
  const scrollAnim = useRef<{ stop: () => void } | null>(null);
  const viewState = useRef({ view, query });

  useLayoutEffect(() => {
    viewState.current = { view, query };
  });

  const visible = memories.filter((memory) => !undo[memory.id]);
  const share = totalChars(visible) / capacity;
  const labelOf = (id: string) => groups.find((group) => group.id === id)?.label ?? id;
  const flashRow = (id: string) => setFlashMap((map) => ({ ...map, [id]: ++counter.current }));
  const hasUndo = Object.keys(undo).length > 0;

  /** Drops memories whose countdown ran out, and moves focus off a disappearing undo button. */
  const expire = useEffectEvent(() => {
    const stamp = Date.now();
    setNow(stamp);
    const expired = new Set(
      Object.entries(undo)
        .filter(([, entry]) => entry.deadline <= stamp)
        .map(([id]) => id),
    );
    if (!expired.size) return;
    const gone = memories.filter((memory) => expired.has(memory.id));
    const rest = memories.filter((memory) => !expired.has(memory.id));
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.dataset.focus === "undo" && cardRef.current?.contains(active)) {
      cardRef.current
        .querySelector<HTMLElement>(searchOpen ? "input[type='search']" : "[aria-pressed='true']")
        ?.focus({ preventScroll: true });
    }
    setMemories(rest);
    setUndo((map) => Object.fromEntries(Object.entries(map).filter(([id]) => !expired.has(id))));
    for (const memory of gone) {
      void onChange?.(rest, { type: "forget", memory });
    }
    if (gone.length) setStatus(gone.length === 1 ? "Memory forgotten" : `${gone.length} memories forgotten`);
  });

  /** Scrolls the list, on a spring unless the caller wants a jump. */
  function scrollListTo(top: number, smooth: boolean) {
    const node = listRef.current;
    if (!node) return;
    scrollAnim.current?.stop();
    if (!smooth) {
      node.scrollTop = top;
      return;
    }
    scrollAnim.current = animate(node.scrollTop, top, {
      ...spring.smooth,
      onUpdate: (value) => {
        node.scrollTop = value;
      },
    });
  }

  /** Swaps the row in from an anchor and resolves once the flyer is airborne. */
  function capture(memory: Memory, anchor: HTMLElement | null) {
    const state = viewState.current;
    const needsSwitch = state.view !== "all" && state.view !== memory.group;
    if (needsSwitch) setView(memory.group);
    if (state.query || searchOpen) closeSearch(false);
    return new Promise<void>((resolve) => {
      const launch = () => {
        let from: { x: number; y: number } | null = null;
        const card = cardRef.current;
        if (anchor && card && !reduced) {
          const cardBox = card.getBoundingClientRect();
          const anchorBox = anchor.getBoundingClientRect();
          from = {
            x: anchorBox.left - cardBox.left - 10,
            y: anchorBox.top - cardBox.top + anchorBox.height / 2 - 27,
          };
        }
        setUndo((map) => omitKey(map, memory.id));
        setMemories((current) =>
          current.some((item) => item.id === memory.id)
            ? current.map((item) => (item.id === memory.id ? memory : item))
            : [memory, ...current],
        );
        setFlyer({ memory, n: ++counter.current, from, to: null });
        resolve();
      };
      if ((needsSwitch || state.query.trim()) && !reduced) {
        window.setTimeout(launch, 340);
      } else {
        launch();
      }
    });
  }

  useEffect(() => {
    if (!hasUndo) return;
    const timer = window.setInterval(expire, 200);
    return () => window.clearInterval(timer);
  }, [hasUndo]);

  useEffect(() => {
    const node = listRef.current;
    const inner = listInnerRef.current;
    if (!node || !inner || typeof ResizeObserver === "undefined") return;
    const update = () => {
      node.toggleAttribute("data-fade-top", node.scrollTop > 1);
      node.toggleAttribute("data-fade-bottom", node.scrollTop + node.clientHeight < node.scrollHeight - 1);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    observer.observe(inner);
    node.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      node.removeEventListener("scroll", update);
    };
  }, []);

  /** Flashes the row the flyer landed on and clears it. */
  const landFlyer = useEffectEvent((flight: Flyer) => {
    setFlyer((current) => (current?.n === flight.n ? null : current));
    flashRow(flight.memory.id);
  });

  useEffect(() => {
    if (!flyer?.to) return;
    const timer = window.setTimeout(() => landFlyer(flyer), FLYER_MS);
    return () => window.clearTimeout(timer);
  }, [flyer]);

  useLayoutEffect(() => {
    if (!flyer || flyer.to) return;
    const card = cardRef.current;
    const list = listRef.current;
    const row = card?.querySelector<HTMLElement>(`[data-memory-id="${CSS.escape(flyer.memory.id)}"]`);
    if (!card || !list || !row) {
      const frame = requestAnimationFrame(() => landFlyer(flyer));
      return () => cancelAnimationFrame(frame);
    }
    const rowHeight = row.querySelector<HTMLElement>(`.${styles.autoHeightInner}`)?.offsetHeight ?? row.offsetHeight;
    const rowBox = row.getBoundingClientRect();
    const listBox = list.getBoundingClientRect();
    const top = rowBox.top - listBox.top + list.scrollTop;
    let target = list.scrollTop;
    if (top - 8 < list.scrollTop) {
      target = top - 8;
    } else if (top + rowHeight + 8 > list.scrollTop + list.clientHeight) {
      target = top + rowHeight + 8 - list.clientHeight;
    }
    target = Math.max(0, target);
    const delta = target - list.scrollTop;
    if (delta) scrollListTo(target, !!flyer.from);
    if (!flyer.from) {
      const frame = requestAnimationFrame(() => landFlyer(flyer));
      return () => cancelAnimationFrame(frame);
    }
    const cardBox = card.getBoundingClientRect();
    setFlyer({
      ...flyer,
      to: { x: rowBox.left - cardBox.left, y: rowBox.top - cardBox.top - delta, w: rowBox.width },
    });
  }, [flyer, landFlyer]);

  const capturedItem = captured?.find((item) => captureState[item.memory.id] !== "gone");
  const pillSaved = !!capturedItem && captureState[capturedItem.memory.id] === "saved";

  async function add(text: string, anchor: HTMLInputElement) {
    const normalized = normalizeText(text);
    const duplicate = visible.find((memory) => memory.text.toLowerCase() === normalized.toLowerCase());
    if (duplicate) throw Error(`Already in ${labelOf(duplicate.group)}`);
    if (totalChars(visible) + normalized.length > capacity) throw Error("Memory is full");
    const [group] = await Promise.all([
      classify ? classify(normalized) : guessGroup(normalized),
      classify ? null : sleep(reduced ? 200 : 650),
    ]);
    const person = group === "people" ? findPerson(normalized) : undefined;
    const memory: Memory = {
      id: `m-${Date.now().toString(36)}`,
      text: normalized,
      group,
      source: { kind: "manual", date: TODAY },
      ...(person ? { person } : {}),
    };
    await onChange?.([memory, ...memories], { type: "add", memory });
    await capture(memory, anchor);
    setStatus(`Added to ${labelOf(group)}. ${classify ? "" : "In this preview, a keyword guess picked the group."}`);
    return labelOf(group);
  }

  async function edit(id: string, text: string) {
    const memory = memories.find((item) => item.id === id);
    if (!memory) return;
    const next: Memory = { ...memory, text: normalizeText(text) };
    if (onChange) {
      await onChange(
        memories.map((item) => (item.id === id ? next : item)),
        { type: "edit", memory: next, previous: memory.text },
      );
    } else {
      await sleep(380 * Number(!reduced));
    }
    setMemories((current) => current.map((item) => (item.id === id ? next : item)));
    setEditingId(null);
    flashRow(id);
    setStatus("Memory updated");
  }

  function toggleSetting(key: "savedMemories" | "chatHistory", on: boolean) {
    setFlags((current) => ({ ...current, [key]: on }));
    onToggle?.(key, on);
    setStatus(
      key === "savedMemories"
        ? on
          ? "Saved memories on"
          : "Saved memories paused"
        : on
          ? "Chat history on"
          : "Chat history off",
    );
  }

  /** Closes the search field, and puts focus back on the magnifier when it was inside. */
  function closeSearch(refocus = true) {
    const hadFocus = searchRef.current?.closest(`.${styles.search}`)?.contains(document.activeElement);
    setSearchOpen(false);
    setQuery("");
    if (refocus && hadFocus) {
      cardRef.current?.querySelector<HTMLElement>(`.${styles.searchToggle}`)?.focus({ preventScroll: true });
    }
  }

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus({ preventScroll: true });
  }, [searchOpen]);

  const normalizedQuery = query.trim().toLowerCase();
  const searching = normalizedQuery.length > 0;
  const sections = groups
    .map((group) => ({
      group,
      rows: memories.filter(
        (memory) =>
          memory.group === group.id &&
          (!normalizedQuery ||
            memory.text.toLowerCase().includes(normalizedQuery) ||
            !!memory.person?.name.toLowerCase().includes(normalizedQuery)),
      ),
    }))
    .filter(({ group, rows }) => (searching || view === "all" ? rows.length > 0 : view === group.id));
  const showHeadings = searching || view === "all";
  const paused = !flags.savedMemories;

  return (
    <div className={cx(styles.root, className)}>
      <div ref={cardRef} className={styles.card}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h2 className={styles.title}>Memory</h2>
            <p className={styles.subtitle}>What {assistantName} remembers across chats</p>
          </div>
          <Meter share={share} reduced={reduced} />
        </header>
        <div className={styles.settings}>
          <SettingRow
            id={`${uid}-saved`}
            title="Reference saved memories"
            on={!!flags.savedMemories}
            reduced={reduced}
            description={flags.savedMemories ? "Uses and adds to the memories below" : "Paused. Nothing new is saved or used"}
            onChange={(on) => toggleSetting("savedMemories", on)}
          />
          <SettingRow
            id={`${uid}-history`}
            title="Reference chat history"
            on={!!flags.chatHistory}
            reduced={reduced}
            description={flags.chatHistory ? "Searches past chats when they help" : "Each chat starts from a blank slate"}
            onChange={(on) => toggleSetting("chatHistory", on)}
          />
        </div>
        <section className={styles.memories} aria-label="Saved memories" data-frame-keep="">
          <Toolbar
            ref={searchRef}
            groups={groups}
            view={view}
            onViewChange={(next) => {
              if (next === view) return;
              setView(next);
              setEditingId(null);
              if (listRef.current?.scrollTop) scrollListTo(0, !reduced);
            }}
            searchOpen={searchOpen}
            query={query}
            reduced={reduced}
            onOpenSearch={() => setSearchOpen(true)}
            onCloseSearch={() => closeSearch()}
            onQueryChange={(next) => {
              setQuery(next);
              const needle = next.trim().toLowerCase();
              if (!needle) {
                setStatus("");
                return;
              }
              const count = memories.filter(
                (memory) =>
                  groups.some((group) => group.id === memory.group) &&
                  (!needle ||
                    memory.text.toLowerCase().includes(needle) ||
                    !!memory.person?.name.toLowerCase().includes(needle)),
              ).length;
              setStatus(count ? `${count} ${count === 1 ? "memory matches" : "memories match"}` : "No memories match");
            }}
          />
          <AutoHeight reduced={reduced}>
            {paused ? (
              <p className={styles.notice}>
                <Info aria-hidden="true" />
                {assistantName} won't use or add to these while saved memories are off.
              </p>
            ) : capturedItem ? (
              <div className={styles.pillRow}>
                <button
                  ref={pillRef}
                  type="button"
                  className={styles.pill}
                  data-saved={pillSaved || undefined}
                  aria-disabled={pillSaved || undefined}
                  aria-label={
                    pillSaved
                      ? `Saved to ${labelOf(capturedItem.memory.group)}`
                      : `Memory updated. ${capturedItem.note}. File it in ${labelOf(capturedItem.memory.group)}`
                  }
                  onClick={() => {
                    if (captureState[capturedItem.memory.id]) return;
                    const memory: Memory = {
                      ...capturedItem.memory,
                      source: { kind: "chat", date: TODAY, ...capturedItem.memory.source },
                    };
                    const next = [memory, ...memories.filter((item) => item.id !== memory.id)];
                    setCaptureState((map) => ({ ...map, [memory.id]: "saved" }));
                    setStatus(`Saved to ${labelOf(memory.group)}: ${memory.text}`);
                    const delay =
                      viewState.current.query.trim() || (viewState.current.view !== "all" && viewState.current.view !== memory.group)
                        ? 340
                        : 0;
                    void capture(memory, pillRef.current).then(() =>
                      onChange?.(next, { type: "capture", memory }),
                    );
                    window.setTimeout(
                      () => {
                        const pill = pillRef.current;
                        if (document.activeElement === pill && pill?.matches(":focus-visible")) {
                          cardRef.current
                            ?.querySelector<HTMLElement>(`[data-memory-id="${CSS.escape(memory.id)}"] [data-focus="edit"]`)
                            ?.focus({ preventScroll: true });
                        }
                        setCaptureState((map) => ({ ...map, [memory.id]: "gone" }));
                      },
                      (reduced ? 0 : delay + FLYER_MS) + 1400,
                    );
                  }}
                >
                  <span className={styles.pillStack}>
                    <span className={styles.pillSizer} aria-hidden="true">
                      <PillLabel note={capturedItem.note} />
                    </span>
                    <Fade id={pillSaved ? "saved" : "new"} reduced={reduced}>
                      {pillSaved ? (
                        <span className={styles.pillLabel}>
                          <Check aria-hidden="true" />
                          <span className={styles.pillTitle}>Saved to {labelOf(capturedItem.memory.group)}</span>
                        </span>
                      ) : (
                        <PillLabel note={capturedItem.note} />
                      )}
                    </Fade>
                  </span>
                </button>
              </div>
            ) : null}
          </AutoHeight>
          <div
            ref={listRef}
            className={styles.list}
            data-paused={paused || undefined}
            onPointerDown={() => scrollAnim.current?.stop()}
            onWheel={() => scrollAnim.current?.stop()}
          >
            <div ref={listInnerRef}>
              <AnimatePresence initial={false}>
                {sections.map(({ group, rows }) => {
                  const count = rows.filter((memory) => !undo[memory.id]).length;
                  return (
                    <motion.div
                      key={group.id}
                      role="group"
                      aria-label={group.label}
                      className={styles.group}
                      custom={reduced}
                      variants={itemVariants}
                      initial="hidden"
                      animate="shown"
                      exit="gone"
                    >
                      <AnimatePresence initial={false}>
                        {showHeadings ? (
                          <motion.div
                            key="heading"
                            className={styles.groupHeadingSlot}
                            custom={reduced}
                            variants={itemVariants}
                            initial="hidden"
                            animate="shown"
                            exit="gone"
                          >
                            <h3 className={styles.groupHeading}>
                              {group.label}
                              <span className={styles.groupCount}>{count}</span>
                            </h3>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                      <ul className={styles.rows}>
                        <AnimatePresence initial={false}>
                          {rows.map((memory) => (
                            <RowItem
                              key={memory.id}
                              memory={memory}
                              query={query}
                              reduced={reduced}
                              editing={editingId === memory.id}
                              undo={undo[memory.id]}
                              now={now}
                              landing={flyer?.memory.id === memory.id}
                              flash={flash[memory.id]}
                              onEdit={() => setEditingId(memory.id)}
                              onCloseEdit={() => setEditingId((id) => (id === memory.id ? null : id))}
                              onSave={(text) => edit(memory.id, text)}
                              onForget={() => {
                                setEditingId((id) => (id === memory.id ? null : id));
                                const stamp = Date.now();
                                setNow(stamp);
                                setUndo((map) => ({
                                  ...map,
                                  [memory.id]: { deadline: stamp + undoMs, total: undoMs },
                                }));
                                setStatus(`Forgot "${memory.text}". Undo within ${undoSeconds} seconds.`);
                              }}
                              onUndo={() => {
                                setUndo((map) => omitKey(map, memory.id));
                                setStatus("Memory restored");
                              }}
                            />
                          ))}
                        </AnimatePresence>
                      </ul>
                      <AnimatePresence initial={false}>
                        {rows.length || searching ? null : (
                          <motion.div
                            key="empty"
                            className={styles.slot}
                            custom={reduced}
                            variants={itemVariants}
                            initial="hidden"
                            animate="shown"
                            exit="gone"
                          >
                            <p className={styles.empty}>{group.empty}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
                {searching && !sections.length ? (
                  <motion.div
                    key="no-results"
                    className={styles.slot}
                    custom={reduced}
                    variants={itemVariants}
                    initial="hidden"
                    animate="shown"
                    exit="gone"
                  >
                    <div className={styles.noResults}>
                      <SearchX aria-hidden="true" />
                      <p className={styles.noResultsTitle}>No memories match “{query.trim()}”</p>
                      <button
                        type="button"
                        className={styles.textButton}
                        onClick={() => {
                          setQuery("");
                          searchRef.current?.focus({ preventScroll: true });
                        }}
                      >
                        Clear search
                      </button>
                    </div>
                  </motion.div>
                ) : null}
                {searching || view !== "all" || sections.length ? null : (
                  <motion.div
                    key="nothing"
                    className={styles.slot}
                    custom={reduced}
                    variants={itemVariants}
                    initial="hidden"
                    animate="shown"
                    exit="gone"
                  >
                    <p className={styles.empty}>
                      Nothing saved yet. Add a memory below, or {assistantName} will note things as you chat.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>
        <AddForm reduced={reduced} onAdd={add} />
        {flyer?.from && flyer.to ? (
          <motion.div
            key={flyer.n}
            className={cx(styles.row, styles.flyer)}
            aria-hidden="true"
            data-frame-keep=""
            style={{ width: flyer.to.w }}
            initial={{ x: flyer.from.x, y: flyer.from.y, opacity: 0 }}
            animate={{ x: flyer.to.x, y: flyer.to.y, opacity: 1 }}
            transition={{ x: spring.smooth, y: spring.smooth, opacity: { duration: 0.12, ease: EASE } }}
          >
            <RowFace memory={flyer.memory} query="" />
            <span className={styles.rowActions} />
          </motion.div>
        ) : null}
        <p className={styles.srOnly} role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </div>
  );
}

export default AgentMemory;
