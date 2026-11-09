"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ClipboardEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
  useReducedMotion,
  type Transition,
} from "motion/react";
import {
  Check,
  ChevronDown,
  CircleAlert,
  ClipboardPaste,
  LoaderCircle,
  Mail,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { ArcImage } from "../lib/arc-provider";
import { people } from "../lib/media";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./invite-people.module.css";

/** Mail domain used for every seeded address. */
const DOMAIN = "fieldwork.example";

/** Who an invite can become, and what each role is allowed to do. */
type ChipRole = "admin" | "member" | "guest";

const ROLES: { value: ChipRole; label: string; description: string }[] = [
  { value: "admin", label: "Admin", description: "Manages members and billing" },
  { value: "member", label: "Member", description: "Creates and edits projects" },
  { value: "guest", label: "Guest", description: "Views shared projects only" },
];

const ROLE_LABEL: Record<ChipRole, string> = { admin: "Admin", member: "Member", guest: "Guest" };

/** The person directory the picker searches. Name and title come from the shared demo media. */
interface DirectoryEntry {
  email: string;
  name?: string;
  title?: string;
  src?: string;
}

const DIRECTORY: DirectoryEntry[] = people.map((person) => ({
  email: `${person.id.replace("-", ".")}@${DOMAIN}`,
  name: person.name,
  title: person.role ?? "",
  src: person.src,
}));

const entryFor = (id: string): DirectoryEntry => {
  const email = `${id.replace("-", ".")}@${DOMAIN}`;
  const found = DIRECTORY.find((entry) => entry.email === email);
  if (!found) throw new Error(`Unknown person in the demo directory: ${id}`);
  return found;
};

/** Faces already on the plan, in the order the frame shows them. */
const TEAM_IDS = ["diane-foster", "nathan-cole", "jasmine-brooks", "daniel-kim", "chloe-nguyen"];

const SEED_TEAM = TEAM_IDS.map(entryFor);

/** One invite that was already sent before the demo starts. */
const SEED_PENDING = (): PendingInvite[] => [
  { key: entryFor("tyler-hayes").email, entry: entryFor("tyler-hayes"), role: "member", status: "sent", note: "Sent 2 days ago" },
];

const PLANS = {
  starter: { name: "Starter", seats: 10 },
  team: { name: "Team", seats: 25 },
} as const;

type PlanId = keyof typeof PLANS;

/** Strict enough to reject half-typed addresses, loose enough to accept typed ones. */
const EMAIL = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/i;

/** The sample list the hint row pastes: good addresses, bare names, and three broken ones. */
const SAMPLE_LIST = [
  "emma.collins@fieldwork.example",
  "Marcus Johnson",
  "sofia.ramirez@fieldwork.example",
  "olivia@northwind",
  "jordan.reyes@",
  "Nathan Cole",
  "Ava Mitchell <ava.mitchell@fieldwork.example>",
  "hannah.walsh@fieldwork.example",
  "alex turner",
  "emma.collins@fieldwork.example",
].join(", ");

type EntryStatus = "sending" | "sent" | "joined";

interface PendingInvite {
  key: string;
  entry: DirectoryEntry;
  role: ChipRole;
  status: EntryStatus;
  note: string;
}

type Chip =
  | { kind: "ok"; key: string; entry: DirectoryEntry; role: ChipRole; flown: boolean }
  | { kind: "error"; key: string; text: string; message: string };

type OptionKind = "person" | "blocked" | "email";

interface Option {
  id: string;
  kind: OptionKind;
  entry: DirectoryEntry;
  note: string;
}

const { spring: SPRING, duration: DURATION, blur: BLUR } = motionTokens;
const EASE_ENTER = [...motionTokens.ease.enter] as [number, number, number, number];

/** The avatar tween shared by every chip, row and suggestion: a slow spring, no bounce. */
const LAYOUT: Transition = { type: "spring", visualDuration: 0.5, bounce: 0 };

/** Two mirrored wobbles: one for the chips, one for the over-limit banner. */
const SHAKE = [
  [0, -6, 6, -4, 4, -2, 0],
  [0, 6, -6, 4, -4, 2, 0],
] as const;

/** Shared geometry for the 16px inline icons. */
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

const joinClass = (...values: (string | false | undefined)[]) => values.filter(Boolean).join(" ");

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

const roleLabel = (role: ChipRole) => ROLE_LABEL[role];

/**
 * A section-layout frame flattens every card edge in this block — capture `frame.html` marks the
 * root, the footer and the pending list with `data-frame-flat` plus these inline resets. Each one
 * drops a 1px `border-top`, which is measurable: the footer is 52px in the frame and 53px with its
 * border, the pending list 88.3px against 89.3px. The local shell injects nothing, so the block
 * carries the attribute and the resets itself.
 */
const FLATTEN = { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" } as const;

/** Splits a pasted blob: line breaks win, then a run of addresses, else one token. */
const splitInput = (text: string) => {
  if (/[,;\n]/.test(text)) return text.split(/[,;\n]+/);
  return (text.match(/@/g)?.length ?? 0) > 1 ? text.split(/\s+/) : [text];
};

/** Hydration-safe reduced motion: the server always renders the animated branch. */
const subscribeNothing = () => () => {};
function useMotionOff() {
  const reduceMotion = useReducedMotion();
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  return Boolean(reduceMotion) && hydrated;
}

/** A box that springs to its own measured height whenever its content reflows. */
function MeasuredHeight({ className, decor, children }: { className?: string; decor: ReactNode; children: ReactNode }) {
  const motionOff = useMotionOff();
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <motion.div className={className} initial={false} animate={{ height }} transition={motionOff ? { duration: 0 } : SPRING.smooth}>
      {decor}
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

/** An inline box that springs to its own measured width, so a swapping label never jumps. */
function MeasuredWidth({ className, children }: { className?: string; children: ReactNode }) {
  const motionOff = useMotionOff();
  const inner = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(node.offsetWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <motion.span className={joinClass(styles.autoWidth, className)} initial={false} animate={{ width }} transition={motionOff ? { duration: 0 } : SPRING.morph}>
      <span ref={inner} className={styles.autoWidthInner}>
        {children}
      </span>
    </motion.span>
  );
}

/** One line of copy that swaps in place when the message changes. */
function SwapLabel({ id, children }: { id: string | number; children: ReactNode }) {
  const motionOff = useMotionOff();
  return (
    <span className={styles.swap}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={motionOff ? { opacity: 0 } : { opacity: 0, y: "0.4em", filter: `blur(${BLUR.subtle}px)` }}
          animate={{ opacity: 1, y: "0em", filter: "blur(0px)", transitionEnd: { filter: "none" } }}
          exit={motionOff ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: "-0.4em", filter: `blur(${BLUR.subtle}px)`, transition: { duration: DURATION.fast } }}
          transition={motionOff ? { duration: DURATION.instant } : { duration: DURATION.standard, ease: EASE_ENTER }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** A band that opens and closes by its own height: errors, plan warnings, the empty state. */
function Collapse({ children }: { children: ReactNode }) {
  const motionOff = useMotionOff();
  return (
    <motion.div
      className={styles.collapse}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={motionOff ? { duration: 0 } : { height: SPRING.smooth, opacity: { duration: DURATION.standard } }}
    >
      {children}
    </motion.div>
  );
}

/** A face that flies between the picker, the chip, the team strip and the pending list. */
function Face({ entry, size, layoutId, alt = "" }: { entry: DirectoryEntry; size: number; layoutId?: string; alt?: string }) {
  return (
    <motion.span layoutId={layoutId} className={styles.avatar} style={{ width: size, height: size, borderRadius: "50%" }} transition={{ layout: LAYOUT }}>
      {entry.src ? (
        <ArcImage src={entry.src} alt={alt} width={size} height={size} sizes={`${size}px`} draggable={false} />
      ) : (
        <span className={styles.initial} aria-hidden={!alt || undefined} role={alt ? "img" : undefined} aria-label={alt || undefined}>
          {entry.email.charAt(0).toUpperCase()}
        </span>
      )}
    </motion.span>
  );
}

type Inspection =
  | { kind: "ok"; entry: DirectoryEntry }
  | { kind: "error"; text: string; message: string };

/**
 * Reads one pasted or typed token: `<name>` wrappers are unwrapped, known people match by name,
 * addresses match the directory or count as new, and everything else gets the reason it failed.
 */
function inspectToken(token: string, known: { team: Set<string>; pending: Set<string> }): Inspection | null {
  const wrapped = token.match(/<\s*([^<>\s]+)\s*>/);
  const text = (wrapped ? wrapped[1] : token).trim().replace(/^["']+|["']+$/g, "").trim();
  if (!text) return null;
  const needle = text.toLowerCase().replace(/\s+/g, " ");
  const entry =
    DIRECTORY.find((person) => person.name?.toLowerCase() === needle) ??
    (EMAIL.test(text) ? DIRECTORY.find((person) => person.email === needle) ?? { email: needle } : undefined);
  if (entry) {
    const label = entry.name ?? entry.email;
    if (known.team.has(entry.email)) return { kind: "error", text, message: `${label} is already on the team` };
    if (known.pending.has(entry.email)) return { kind: "error", text, message: `${label} already has a pending invite` };
    return { kind: "ok", entry };
  }
  const quoted = `“${text}”`;
  if (!text.includes("@")) return { kind: "error", text, message: `${quoted} isn’t an email address` };
  const at = text.lastIndexOf("@");
  const local = text.slice(0, at);
  const domain = text.slice(at + 1);
  if (!local) return { kind: "error", text, message: `${quoted} is missing a name before the @` };
  if (!domain) return { kind: "error", text, message: `${quoted} is missing a domain` };
  if (!domain.includes(".")) return { kind: "error", text, message: `${quoted} needs a full domain, like ${DOMAIN}` };
  return { kind: "error", text, message: `${quoted} isn’t a valid email address` };
}

export function InvitePeople() {
  const id = useId();
  const motionOff = useMotionOff();

  const rootRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuAnchor = useRef<HTMLButtonElement>(null);
  const pendingHead = useRef<HTMLHeadingElement>(null);
  const errorSeq = useRef(0);
  const acceptPlayed = useRef(false);
  const timeouts = useRef<number[]>([]);

  const [members, setMembers] = useState<DirectoryEntry[]>(SEED_TEAM);
  const [pending, setPending] = useState<PendingInvite[]>(SEED_PENDING);
  const [entries, setEntries] = useState<Chip[]>([]);
  const [plan, setPlan] = useState<PlanId>("starter");
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [armed, setArmed] = useState(false);
  const [menu, setMenu] = useState<{ key: string; x: number; y: number } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [warningShake, setWarningShake] = useState(0);
  const [resent, setResent] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState("");

  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  });
  useEffect(() => {
    const timers = timeouts.current;
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const later = (ms: number, run: () => void) => {
    timeouts.current.push(window.setTimeout(run, ms));
  };

  /** Shows a line in the hint slot for a moment, then hands the slot back. */
  const flash = (message: string) => {
    setHint(message);
    later(3200, () => setHint((current) => (current === message ? null : current)));
  };

  const avatarId = (email: string) => `${id}-avatar-${email}`;

  const okEntries = entries.filter((entry): entry is Extract<Chip, { kind: "ok" }> => entry.kind === "ok");
  const badEntries = entries.filter((entry): entry is Extract<Chip, { kind: "error" }> => entry.kind === "error");
  const teamEmails = useMemo(() => new Set(members.map((member) => member.email)), [members]);
  const pendingKeys = useMemo(() => new Set(pending.map((invite) => invite.key)), [pending]);
  const joinedCount = pending.filter((invite) => invite.status === "joined").length;
  const teamCount = members.length + joinedCount;
  const pendingCount = pending.length - joinedCount;
  const newCount = okEntries.length;
  const seatLimit = PLANS[plan].seats;
  const used = teamCount + pendingCount + newCount;
  const over = Math.max(0, used - seatLimit);
  const sendDisabled = newCount === 0 || badEntries.length > 0 || over > 0;

  /** What the picker offers: unused people, blocked people with the reason, and one new address. */
  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const chipKeys = new Set(entries.map((entry) => entry.key));
    const blocked = (entry: DirectoryEntry) =>
      teamEmails.has(entry.email) ? "On the team" : pendingKeys.has(entry.email) ? "Invited" : chipKeys.has(entry.email) ? "Added" : null;
    if (!needle) {
      return DIRECTORY.filter((entry) => !blocked(entry))
        .slice(0, 4)
        .map<Option>((entry) => ({ id: entry.email, kind: "person", entry, note: entry.title ?? "" }));
    }
    const matches = DIRECTORY.filter((entry) => entry.name?.toLowerCase().includes(needle) || entry.email.includes(needle))
      .map<Option>((entry) => {
        const reason = blocked(entry);
        return { id: entry.email, kind: reason ? "blocked" : "person", entry, note: reason ?? entry.title ?? "" };
      })
      .sort((a, b) => Number(a.kind === "blocked") - Number(b.kind === "blocked"))
      .slice(0, 5);
    if (EMAIL.test(needle) && !DIRECTORY.some((entry) => entry.email === needle) && !chipKeys.has(needle)) {
      matches.unshift({ id: `new:${needle}`, kind: "email", entry: { email: needle }, note: "Invite by email" });
    }
    return matches;
  }, [entries, pendingKeys, query, teamEmails]);

  const firstSelectable = options.findIndex((option) => option.kind !== "blocked");
  const highlighted = options[activeIndex] && options[activeIndex].kind !== "blocked" ? activeIndex : firstSelectable;
  const open = focused && !dismissed && (options.length > 0 || Boolean(query.trim()));

  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const errorsId = `${id}-errors`;
  const seatsId = `${id}-seats`;
  const pendingTitleId = `${id}-pending`;

  /** Adds every token in a pasted blob, then reports what landed, what broke and what repeated. */
  const addFromText = (text: string) => {
    const known = { team: new Set(members.map((member) => member.email)), pending: new Set(pending.map((invite) => invite.key)) };
    const next: Chip[] = [...entries];
    let added = 0;
    let broken = 0;
    let duplicates = 0;
    for (const token of splitInput(text)) {
      const result = inspectToken(token, known);
      if (!result) continue;
      if (result.kind === "ok") {
        if (next.some((entry) => entry.key === result.entry.email)) {
          duplicates += 1;
          continue;
        }
        next.push({ kind: "ok", key: result.entry.email, entry: result.entry, role: "member", flown: false });
        added += 1;
      } else {
        if (next.some((entry) => entry.kind === "error" && entry.text.toLowerCase() === result.text.toLowerCase())) {
          duplicates += 1;
          continue;
        }
        next.push({ kind: "error", key: `error-${errorSeq.current++}`, text: result.text, message: result.message });
        broken += 1;
      }
    }
    setEntries(next);
    setArmed(false);
    const parts = [
      added && `Added ${plural(added, "person", "people")}`,
      broken && `${plural(broken, "entry", "entries")} need a fix`,
      duplicates && `skipped ${plural(duplicates, "duplicate")}`,
    ].filter((part): part is string => Boolean(part));
    if (!parts.length) return;
    const message = parts.join(", ").replace(/^./, (character) => character.toUpperCase());
    setStatus(message);
    if (parts.length > 1 || duplicates) flash(message);
  };

  /** Commits one suggestion as a chip, or does nothing when that person is already taken. */
  const addOption = (option?: Option) => {
    if (!option || option.kind === "blocked") return;
    setEntries((current) =>
      current.some((entry) => entry.key === option.entry.email)
        ? current
        : [...current, { kind: "ok", key: option.entry.email, entry: option.entry, role: "member", flown: option.kind === "person" }],
    );
    setQuery("");
    setActiveIndex(0);
    setDismissed(false);
    setStatus(`Added ${option.entry.name ?? option.entry.email}`);
  };

  const labelOf = (entry: Chip) => (entry.kind === "ok" ? entry.entry.name ?? entry.entry.email : entry.text);

  const removeChip = (key: string, label: string) => {
    setEntries((current) => current.filter((entry) => entry.key !== key));
    setArmed(false);
    setStatus(`Removed ${label}`);
    inputRef.current?.focus({ preventScroll: true });
  };

  /** Opens the role menu above the chip, clamped inside the block's own box. */
  const openMenu = (key: string, anchor: HTMLButtonElement) => {
    const root = rootRef.current;
    if (!root) return;
    if (menu?.key === key) {
      setMenu(null);
      return;
    }
    const rootBox = root.getBoundingClientRect();
    const box = anchor.getBoundingClientRect();
    menuAnchor.current = anchor;
    setMenu({
      key,
      x: Math.max(8, Math.min(box.left - rootBox.left - 8, rootBox.width - 232 - 8)),
      y: box.bottom - rootBox.top + 6,
    });
  };

  const closeMenu = (returnFocus?: boolean) => {
    setMenu(null);
    if (returnFocus) menuAnchor.current?.focus({ preventScroll: true });
  };

  const menuEntry = menu ? okEntries.find((entry) => entry.key === menu.key) : undefined;

  useEffect(() => {
    if (!menuEntry) return;
    menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
    const onPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || menuAnchor.current?.contains(target)) return;
      setMenu(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuEntry]);

  /** Animated transitions collapse to zero when the visitor asked for less motion. */
  const segmentTransition = motionOff ? { duration: 0 } : SPRING.smooth;
  const chipSpring = motionOff ? { duration: 0 } : SPRING.snappy;
  const chipLayout = motionOff ? { duration: 0 } : SPRING.smooth;

  const shownTeam = members.slice(0, 5);
  const overflowTeam = members.length - shownTeam.length;
  const percent = (count: number) => `${Math.min(100, (count / seatLimit) * 100)}%`;

  const inputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setDismissed(false);
        return;
      }
      const selectable = options.map((option, index) => (option.kind === "blocked" ? -1 : index)).filter((index) => index >= 0);
      if (!selectable.length) return;
      const current = selectable.indexOf(highlighted);
      setActiveIndex(selectable[(current + (event.key === "ArrowDown" ? 1 : -1) + selectable.length) % selectable.length]);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option = open && highlighted >= 0 ? options[highlighted] : undefined;
      if (option && (query.trim() || option.kind === "person")) {
        addOption(option);
        return;
      }
      if (query.trim()) {
        addFromText(query);
        setQuery("");
      }
      return;
    }
    if ((event.key === "," || event.key === ";") && query.trim()) {
      event.preventDefault();
      addFromText(query);
      setQuery("");
      return;
    }
    if (event.key === "Backspace" && !query && entries.length) {
      const last = entries[entries.length - 1];
      if (armed) removeChip(last.key, labelOf(last));
      else {
        setArmed(true);
        setStatus(`Press backspace again to remove ${labelOf(last)}`);
      }
      return;
    }
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setDismissed(true);
      } else if (query) {
        event.preventDefault();
        setQuery("");
      }
    }
  };

  const inputPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    if (splitInput(text).length < 2) return;
    event.preventDefault();
    addFromText(text);
  };

  const sendInvites = () => {
    if (!newCount) {
      inputRef.current?.focus();
      return;
    }
    if (badEntries.length) {
      setWarningShake((value) => value + 1);
      setStatus(`Fix or remove ${plural(badEntries.length, "entry", "entries")} before sending`);
      return;
    }
    if (over) {
      setShake((value) => value + 1);
      setStatus(`${plural(over, "seat")} over the ${PLANS[plan].name} plan. Upgrade or remove people to send.`);
      return;
    }
    const batch: PendingInvite[] = okEntries.map((entry) => ({
      key: entry.key,
      entry: entry.entry,
      role: entry.role,
      status: "sending",
      note: "Sending",
    }));
    setMenu(null);
    setEntries([]);
    setQuery("");
    setPending((current) => [...batch, ...current]);
    setStatus(`Sending ${plural(batch.length, "invite")}`);
    const step = 160 * (motionOff ? 0 : 1);
    const delay = motionOff ? 300 : 700;
    batch.forEach((invite, index) =>
      later(delay + index * step, () =>
        setPending((current) =>
          current.map((item) => (item.key === invite.key && item.status === "sending" ? { ...item, status: "sent", note: "Sent just now" } : item)),
        ),
      ),
    );
    const total = delay + batch.length * step;
    later(total, () => setStatus(`${plural(batch.length, "invite")} sent`));
    if (acceptPlayed.current) return;
    acceptPlayed.current = true;
    const first = batch[0];
    const label = first.entry.name ?? first.entry.email;
    later(total + 2400, () => {
      if (!pendingRef.current.some((item) => item.key === first.key && item.status === "sent")) {
        acceptPlayed.current = false;
        return;
      }
      setPending((current) => current.map((item) => (item.key === first.key ? { ...item, status: "joined", note: "Joined" } : item)));
      setStatus(`${label} accepted and joined Fieldwork`);
      later(1200, () => {
        if (!pendingRef.current.some((item) => item.key === first.key && item.status === "joined")) return;
        setPending((current) => current.filter((item) => item.key !== first.key));
        setMembers((current) => [first.entry, ...current]);
      });
    });
  };

  const resetPreview = () => {
    timeouts.current.splice(0).forEach((timer) => window.clearTimeout(timer));
    acceptPlayed.current = false;
    setMembers(SEED_TEAM);
    setPending(SEED_PENDING());
    setEntries([]);
    setPlan("starter");
    setQuery("");
    setMenu(null);
    setHint(null);
    setResent({});
    setArmed(false);
    setStatus("Preview reset");
  };

  const menuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitemradio"]'));
    const current = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (index: number) => {
      event.preventDefault();
      items[(index + items.length) % items.length]?.focus();
    };
    if (event.key === "ArrowDown") focusAt(current + 1);
    else if (event.key === "ArrowUp") focusAt(current - 1);
    else if (event.key === "Home") focusAt(0);
    else if (event.key === "End") focusAt(items.length - 1);
    else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === "Tab") setMenu(null);
  };

  const fieldPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, input")) return;
    inputRef.current?.focus();
  };

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id={id}>
        <section ref={rootRef} className={styles.root} aria-labelledby={`${id}-title`} data-frame-flat="" style={FLATTEN}>
          <header className={styles.header}>
            <div className={styles.heading}>
              <h2 id={`${id}-title`} className={styles.title}>
                Invite teammates
              </h2>
              <p className={styles.subtitle}>Add people to Fieldwork by name or email</p>
            </div>
            <ul className={styles.team} aria-label={`Team, ${plural(members.length, "member")}`}>
              <AnimatePresence initial={false} mode="popLayout">
                {shownTeam.map((member) => (
                  <motion.li
                    key={member.email}
                    layout="position"
                    className={styles.teamItem}
                    initial={false}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ ...chipSpring, layout: chipLayout }}
                  >
                    <Face entry={member} size={28} layoutId={avatarId(member.email)} alt={member.name ?? member.email} />
                  </motion.li>
                ))}
                {overflowTeam > 0 && (
                  <motion.li
                    key="more"
                    layout="position"
                    className={joinClass(styles.teamItem, styles.teamMore)}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ ...chipSpring, layout: chipLayout }}
                  >
                    <span aria-hidden="true">+{overflowTeam}</span>
                    <span className={styles.srOnly}>
                      and {overflowTeam} more
                    </span>
                  </motion.li>
                )}
              </AnimatePresence>
            </ul>
          </header>

          <div className={styles.fieldWrap}>
            <MeasuredHeight
              className={styles.fieldShell}
              decor={<span className={styles.fieldSkin} aria-hidden="true" />}
            >
              <div className={styles.field} data-focused={focused || undefined} onClick={fieldPointerDown}>
                <ul className={styles.chips} aria-label="People to invite">
                  <AnimatePresence initial={false} mode="popLayout">
                    {entries.map((entry) => {
                      if (entry.kind === "error") {
                        return (
                          <motion.li
                            key={entry.key}
                            layout="position"
                            className={styles.chip}
                            data-kind="error"
                            data-armed={(armed && entry === entries[entries.length - 1]) || undefined}
                            initial={{ opacity: 0, x: 0 }}
                            animate={{ opacity: 1, x: motionOff ? 0 : [...SHAKE[shake % 2]] }}
                            exit={{ opacity: 0, scale: 0.92, transition: { duration: DURATION.fast } }}
                            transition={{ opacity: { duration: DURATION.fast }, x: { duration: 0.42, ease: "easeOut" }, layout: chipLayout }}
                          >
                            <span className={styles.chipSkin} aria-hidden="true" />
                            <button
                              type="button"
                              className={styles.errorEdit}
                              onClick={() => {
                                setEntries((current) => current.filter((item) => item.key !== entry.key));
                                setQuery(entry.text);
                                setDismissed(false);
                                setStatus(`Editing ${entry.text}`);
                                const input = inputRef.current;
                                if (!input) return;
                                input.focus({ preventScroll: true });
                                requestAnimationFrame(() => input.setSelectionRange(entry.text.length, entry.text.length));
                              }}
                              aria-label={`Edit ${entry.text}. ${entry.message}`}
                              title="Edit"
                            >
                              <CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
                              <span className={styles.chipLabel}>{entry.text}</span>
                            </button>
                            <button type="button" className={styles.chipRemove} aria-label={`Remove ${entry.text}`} onClick={() => removeChip(entry.key, entry.text)}>
                              <X size={14} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                          </motion.li>
                        );
                      }
                      const label = entry.entry.name ?? entry.entry.email;
                      const isOpen = menu?.key === entry.key;
                      return (
                        <motion.li
                          key={entry.key}
                          layout="position"
                          className={styles.chip}
                          data-armed={(armed && entry === entries[entries.length - 1]) || undefined}
                          initial={entry.flown ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0, transition: { duration: DURATION.fast } }}
                          transition={{ opacity: { duration: DURATION.fast }, layout: chipLayout }}
                        >
                          <motion.span
                            className={styles.chipSkin}
                            aria-hidden="true"
                            initial={motionOff ? false : { opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={chipSpring}
                          />
                          <Face entry={entry.entry} size={22} layoutId={avatarId(entry.entry.email)} />
                          <motion.span
                            className={styles.chipBody}
                            initial={motionOff ? false : { opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={motionOff ? { duration: 0 } : { ...SPRING.smooth, delay: 0.08 * Number(entry.flown) }}
                          >
                            <span className={styles.chipLabel} title={entry.entry.email}>
                              {label}
                            </span>
                            <button
                              type="button"
                              className={styles.role}
                              aria-haspopup="menu"
                              aria-expanded={isOpen}
                              aria-label={`Role for ${label}: ${roleLabel(entry.role)}`}
                              data-open={isOpen || undefined}
                              onClick={(event) => openMenu(entry.key, event.currentTarget)}
                              onKeyDown={(event) => {
                                if (event.key !== "ArrowDown" || isOpen) return;
                                event.preventDefault();
                                openMenu(entry.key, event.currentTarget);
                              }}
                            >
                              <MeasuredWidth>
                                <SwapLabel id={entry.role}>{roleLabel(entry.role)}</SwapLabel>
                              </MeasuredWidth>
                              <ChevronDown size={12} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                            <button type="button" className={styles.chipRemove} aria-label={`Remove ${label}`} onClick={() => removeChip(entry.key, label)}>
                              <X size={14} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                          </motion.span>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                  <motion.li layout="position" transition={{ layout: chipLayout }} className={styles.inputItem}>
                    <input
                      ref={inputRef}
                      className={styles.input}
                      type="text"
                      role="combobox"
                      aria-label="Emails or names"
                      aria-expanded={open}
                      aria-controls={listId}
                      aria-autocomplete="list"
                      aria-activedescendant={open && highlighted >= 0 ? `${listId}-${highlighted}` : undefined}
                      aria-describedby={hintId}
                      placeholder={entries.length ? "Add more" : "Name or email, like emma@fieldwork.example"}
                      value={query}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setActiveIndex(0);
                        setDismissed(false);
                        setArmed(false);
                      }}
                      onKeyDown={inputKeyDown}
                      onPaste={inputPaste}
                      onFocus={() => {
                        setFocused(true);
                        setDismissed(false);
                      }}
                      onBlur={() => {
                        setFocused(false);
                        setArmed(false);
                      }}
                    />
                  </motion.li>
                </ul>
              </div>
            </MeasuredHeight>

            <AnimatePresence>
              {open && (
                <motion.div
                  key="list"
                  className={styles.popover}
                  onPointerDown={(event) => event.preventDefault()}
                  initial={motionOff ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={motionOff ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98, transition: { duration: DURATION.fast } }}
                  transition={motionOff ? { duration: DURATION.instant } : SPRING.snappy}
                >
                  {!query.trim() && <p className={styles.popHeading}>Suggested</p>}
                  <ul id={listId} className={styles.options} role="listbox" aria-label="Suggestions">
                    {options.map((option, index) => (
                      <motion.li
                        key={option.id}
                        id={`${listId}-${index}`}
                        role="option"
                        aria-selected={index === highlighted}
                        aria-disabled={option.kind === "blocked" || undefined}
                        className={styles.option}
                        data-kind={option.kind}
                        layout="position"
                        transition={{ layout: chipLayout }}
                        onPointerMove={() => {
                          if (option.kind !== "blocked" && index !== highlighted) setActiveIndex(index);
                        }}
                        onClick={() => addOption(option)}
                      >
                        {index === highlighted && (
                          <motion.span
                            layoutId={`${id}-highlight`}
                            className={styles.optionHighlight}
                            transition={motionOff ? { duration: 0 } : SPRING.morph}
                            aria-hidden="true"
                          />
                        )}
                        {option.kind === "email" ? (
                          <span className={joinClass(styles.avatar, styles.mailAvatar)} style={{ width: 30, height: 30 }}>
                            <Mail size={15} strokeWidth={1.75} aria-hidden="true" />
                          </span>
                        ) : (
                          <Face entry={option.entry} size={30} layoutId={option.kind === "person" ? avatarId(option.entry.email) : undefined} />
                        )}
                        <span className={styles.optionText}>
                          <span className={styles.optionName}>{option.kind === "email" ? option.entry.email : option.entry.name}</span>
                          <span className={styles.optionEmail}>{option.kind === "email" ? "Invite by email" : option.entry.email}</span>
                        </span>
                        {option.kind !== "email" && <span className={styles.optionNote}>{option.note}</span>}
                      </motion.li>
                    ))}
                  </ul>
                  {!options.length && (
                    <p className={styles.popEmpty}>
                      No one matches “
                      {query.trim()}
                      ”. Type a full email to invite them.
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className={styles.hintRow}>
            <p id={hintId} className={styles.hint}>
              <SwapLabel id={hint ?? "default"}>{hint ?? "Separate with commas, or paste a whole list"}</SwapLabel>
            </p>
            <button type="button" className={styles.textButton} onClick={() => addFromText(SAMPLE_LIST)}>
              <ClipboardPaste {...ICON} size={14} />
              Paste a sample list
            </button>
          </div>

          <AnimatePresence initial={false}>
            {badEntries.length > 0 && (
              <Collapse key="errors">
                <div id={errorsId} className={styles.errors}>
                  <div className={styles.errorsHead}>
                    <span className={styles.errorsTitle}>
                      <CircleAlert {...ICON} />
                      <MeasuredWidth>
                        <SwapLabel id={String(badEntries.length)}>
                          {plural(badEntries.length, "entry", "entries")} can’t be invited
                        </SwapLabel>
                      </MeasuredWidth>
                    </span>
                    <button
                      type="button"
                      className={styles.textButton}
                      onClick={() => {
                        setEntries((current) => current.filter((entry) => entry.kind === "ok"));
                        setStatus(`Removed ${plural(badEntries.length, "entry", "entries")}`);
                      }}
                    >
                      Remove invalid
                    </button>
                  </div>
                  <ul className={styles.errorList}>
                    <AnimatePresence initial={false}>
                      {badEntries.map((entry) => (
                        <motion.li
                          key={entry.key}
                          className={styles.collapse}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={motionOff ? { duration: 0 } : { height: SPRING.smooth, opacity: { duration: DURATION.fast } }}
                        >
                          <span className={styles.errorLine}>{entry.message}</span>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                  <p className={styles.errorsFoot}>Select an entry to fix it</p>
                </div>
              </Collapse>
            )}
          </AnimatePresence>

          <div className={styles.seats} id={seatsId}>
            <div className={styles.seatsHead}>
              <span className={styles.seatsCount} data-over={over > 0 || undefined}>
                <span className={styles.num}>
                  <AnimatedCounter value={used} />
                </span>
                <span className={styles.seatsOf}>of</span>
                <span className={styles.num}>
                  <AnimatedCounter value={seatLimit} />
                </span>
                <span className={styles.seatsOf}>seats</span>
              </span>
              <span className={styles.plan}>
                <SwapLabel id={plan}>
                  {PLANS[plan].name} plan
                </SwapLabel>
              </span>
            </div>
            <div
              className={styles.track}
              role="meter"
              aria-label="Seats"
              aria-valuemin={0}
              aria-valuemax={seatLimit}
              aria-valuenow={Math.min(used, seatLimit)}
              aria-valuetext={`${used} of ${seatLimit} seats${over ? `, ${over} over the limit` : ""}`}
            >
              <motion.span className={styles.segment} data-kind={over ? "over" : "new"} initial={false} animate={{ width: percent(used) }} transition={segmentTransition} />
              <motion.span
                className={styles.segment}
                data-kind="pending"
                data-edge={newCount > 0 || undefined}
                initial={false}
                animate={{ width: percent(teamCount + pendingCount) }}
                transition={segmentTransition}
              />
              <motion.span
                className={styles.segment}
                data-kind="members"
                data-edge={pendingCount + newCount > 0 || undefined}
                initial={false}
                animate={{ width: percent(teamCount) }}
                transition={segmentTransition}
              />
            </div>
            <ul className={styles.legend} aria-hidden="true">
              <li>
                <span className={styles.swatch} data-kind="members" />
                {plural(teamCount, "member")}
              </li>
              <li>
                <span className={styles.swatch} data-kind="pending" />
                {pendingCount} pending
              </li>
              <li>
                <span className={styles.swatch} data-kind={over ? "over" : "new"} />
                {newCount} new
              </li>
            </ul>
            <AnimatePresence initial={false}>
              {over > 0 && (
                <Collapse key="over">
                  <motion.div
                    className={styles.over}
                    animate={{ x: motionOff || !warningShake ? 0 : [...SHAKE[warningShake % 2]] }}
                    transition={{ duration: 0.42, ease: "easeOut" }}
                  >
                    <CircleAlert {...ICON} />
                    <span className={styles.overText}>
                      <MeasuredWidth>
                        <SwapLabel id={String(over)}>{plural(over, "seat")} over</SwapLabel>
                      </MeasuredWidth>
                      {" the "}
                      {PLANS[plan].name} plan
                    </span>
                    {plan === "starter" ? (
                      <button
                        type="button"
                        className={styles.ghost}
                        onClick={() => {
                          setPlan("team");
                          setStatus(`Upgraded to the Team plan with ${PLANS.team.seats} seats.`);
                          flash("Upgraded to Team");
                        }}
                      >
                        Upgrade to Team
                      </button>
                    ) : (
                      <span className={styles.overHelp}>Remove people to send</span>
                    )}
                  </motion.div>
                </Collapse>
              )}
            </AnimatePresence>
          </div>

          <footer className={styles.footer} data-frame-flat="" style={FLATTEN}>
            <div className={styles.footerActions}>
              <button type="button" className={styles.iconButton} onClick={resetPreview} aria-label="Reset preview" title="Reset preview">
                <RotateCcw {...ICON} />
              </button>
              <button
                type="button"
                className={styles.send}
                onClick={sendInvites}
                aria-disabled={sendDisabled || undefined}
                aria-describedby={badEntries.length ? errorsId : over ? seatsId : undefined}
                aria-label={newCount ? `Send ${plural(newCount, "invite")}` : "Send invites"}
              >
                <Send {...ICON} />
                <span className={styles.sendLabel} aria-hidden="true">
                  Send
                  <motion.span className={styles.sendCount} initial={false} animate={{ width: newCount ? "auto" : 0, opacity: Number(Boolean(newCount)) }} transition={motionOff ? { duration: 0 } : SPRING.morph}>
                    <span className={styles.num}>
                      <AnimatedCounter value={Math.max(1, newCount)} />
                    </span>
                  </motion.span>
                  <MeasuredWidth className={styles.sendWord}>
                    <SwapLabel id={newCount === 1 ? "one" : "many"}>{newCount === 1 ? "invite" : "invites"}</SwapLabel>
                  </MeasuredWidth>
                </span>
              </button>
            </div>
          </footer>

          <section className={styles.pending} aria-labelledby={pendingTitleId} data-frame-flat="" style={FLATTEN}>
            <h3 id={pendingTitleId} ref={pendingHead} tabIndex={-1} className={styles.pendingHead}>
              {"Pending "}
              <span className={styles.pendingCount}>
                <span className={styles.num}>
                  <AnimatedCounter value={pendingCount} />
                </span>
              </span>
            </h3>
            <ul className={styles.rows}>
              <AnimatePresence initial={false}>
                {pending.map((invite) => {
                  const label = invite.entry.name ?? invite.entry.email;
                  const sentAgain = Boolean(resent[invite.key]);
                  return (
                    <motion.li
                      key={invite.key}
                      className={styles.row}
                      initial={{ height: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={motionOff ? { duration: 0 } : { height: SPRING.smooth, opacity: { duration: DURATION.fast } }}
                    >
                      <div className={styles.rowInner}>
                        <Face entry={invite.entry} size={36} layoutId={avatarId(invite.entry.email)} />
                        <motion.div
                          className={styles.rowText}
                          initial={motionOff ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: DURATION.standard, delay: 0.12 }}
                        >
                          <span className={styles.rowName}>{label}</span>
                          <span className={styles.rowMeta}>
                            {roleLabel(invite.role)}
                            {invite.entry.name ? ` · ${invite.entry.email}` : ""}
                          </span>
                        </motion.div>
                        <motion.span
                          className={styles.status}
                          data-status={invite.status}
                          initial={motionOff ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: DURATION.standard, delay: 0.12 }}
                        >
                          <MeasuredWidth>
                            <SwapLabel id={invite.status + invite.note}>
                              <span className={styles.statusInner}>
                                {invite.status === "sending" && <LoaderCircle className={styles.spin} size={13} strokeWidth={1.75} aria-hidden="true" />}
                                {invite.status === "joined" && <Check size={13} strokeWidth={2} aria-hidden="true" />}
                                {invite.note}
                              </span>
                            </SwapLabel>
                          </MeasuredWidth>
                        </motion.span>
                        <motion.div
                          className={styles.rowActions}
                          data-hidden={(invite.status === "joined" || undefined) as boolean | undefined}
                          initial={motionOff ? false : { opacity: 0 }}
                          animate={{ opacity: Number(invite.status !== "joined") }}
                          transition={{
                            duration: invite.status === "joined" ? DURATION.fast : DURATION.standard,
                            delay: 0.12 * Number(invite.status !== "joined"),
                          }}
                        >
                          <button
                            type="button"
                            className={styles.textButton}
                            onClick={() => {
                              if (sentAgain) return;
                              setResent((current) => ({ ...current, [invite.key]: true }));
                              setStatus(`Invite sent again to ${invite.entry.name ?? invite.entry.email}`);
                              later(2000, () => setResent((current) => ({ ...current, [invite.key]: false })));
                            }}
                            disabled={invite.status !== "sent"}
                            aria-disabled={sentAgain || undefined}
                            aria-label={sentAgain ? `Invite sent again to ${label}` : `Resend invite to ${label}`}
                          >
                            <span className={styles.stack}>
                              <span data-on={!sentAgain || undefined}>Resend</span>
                              <span data-on={sentAgain || undefined}>
                                <Check size={13} strokeWidth={2} aria-hidden="true" />
                                Sent again
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            className={styles.iconButton}
                            data-size="sm"
                            onClick={() => {
                              setPending((current) => current.filter((item) => item.key !== invite.key));
                              setStatus(`Revoked the invite for ${invite.entry.name ?? invite.entry.email}. One seat freed.`);
                              pendingHead.current?.focus({ preventScroll: true });
                            }}
                            disabled={invite.status !== "sent"}
                            aria-label={`Revoke invite for ${label}`}
                            title="Revoke invite"
                          >
                            <X size={15} strokeWidth={1.75} aria-hidden="true" />
                          </button>
                        </motion.div>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
            <AnimatePresence initial={false}>
              {pending.length === 0 && (
                <Collapse key="empty">
                  <p className={styles.empty}>No pending invites</p>
                </Collapse>
              )}
            </AnimatePresence>
          </section>

          <AnimatePresence>
            {menu && menuEntry && (
              <motion.div
                key="menu"
                ref={menuRef}
                className={styles.menu}
                role="menu"
                aria-label={`Role for ${menuEntry.entry.name ?? menuEntry.entry.email}`}
                style={{ left: menu.x, top: menu.y }}
                onKeyDown={menuKeyDown}
                initial={motionOff ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={motionOff ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -4, scale: 0.97, transition: { duration: DURATION.fast } }}
                transition={motionOff ? { duration: DURATION.instant } : SPRING.snappy}
              >
                {ROLES.map((role) => (
                  <button
                    key={role.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={menuEntry.role === role.value}
                    className={styles.menuItem}
                    onPointerMove={(event) => {
                      if (document.activeElement !== event.currentTarget) event.currentTarget.focus({ preventScroll: true });
                    }}
                    onClick={() => {
                      if (!menuEntry) return;
                      setEntries((current) =>
                        current.map((entry) => (entry.key === menuEntry.key && entry.kind === "ok" ? { ...entry, role: role.value } : entry)),
                      );
                      setStatus(`${menuEntry.entry.name ?? menuEntry.entry.email} will join as ${roleLabel(role.value).toLowerCase()}`);
                      closeMenu(true);
                    }}
                  >
                    <span className={styles.menuLabel}>{role.label}</span>
                    <span className={styles.menuDescription}>{role.description}</span>
                    {menuEntry.role === role.value && <Check className={styles.menuCheck} size={15} strokeWidth={2} aria-hidden="true" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <p className={styles.srOnly} aria-live="polite">
            {status}
          </p>
        </section>
      </LayoutGroup>
    </MotionConfig>
  );
}

export default InvitePeople;
