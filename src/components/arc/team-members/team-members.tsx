"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type ClipboardEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import * as Select from "@radix-ui/react-select";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
  useReducedMotion,
  type Transition,
  type Variants,
} from "motion/react";
import { Check, ChevronDown, CircleAlert, UserMinus, X } from "lucide-react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { SearchField } from "../search-field/search-field";
import { TextMorph } from "../text-morph/text-morph";
import { avatar as personAvatar } from "../lib/media";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./team-members.module.css";

/** Workspace name used in the copy and in the status line. */
const WORKSPACE = "Fieldnote";

/** Seats the workspace pays for. */
const SEAT_LIMIT = 10;

/** Loose enough for typed addresses, strict enough for the “not complete” error. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Every role a member can hold, including the untouchable owner. */
export type TeamRole = "owner" | "admin" | "member" | "viewer";

/** Roles that can be handed to somebody new; the owner seat is not assignable. */
export type InviteRole = Exclude<TeamRole, "owner">;

const ROLE_LABEL: Record<TeamRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

/** The role menu, with the one-line hint each option shows under its label. */
const ROLE_OPTIONS: { value: InviteRole; hint: string }[] = [
  { value: "admin", hint: "Manages members, billing, and settings" },
  { value: "member", hint: "Creates and edits projects" },
  { value: "viewer", hint: "Views and comments, no editing" },
];

interface Member {
  id: string;
  name: string;
  email: string;
  /** Portrait path read by Avatar. */
  photo: string;
  role: TeamRole;
  /** Last-seen line shown beside the email. */
  active: string;
  online?: boolean;
  /** Marks the signed-in member: no remove button, a “You” suffix. */
  you?: boolean;
}

interface Invite {
  id: string;
  email: string;
  role: InviteRole;
  /** “Invited Sep 19”, then “Invited just now” / “Resent just now”. */
  sent: string;
}

const SEED_MEMBERS: Member[] = [
  {
    id: "emma",
    name: "Emma Collins",
    email: "emma@fieldnote.example",
    photo: personAvatar("emma-collins"),
    role: "owner",
    active: "Active now",
    online: true,
    you: true,
  },
  {
    id: "ava",
    name: "Ava Mitchell",
    email: "ava@fieldnote.example",
    photo: personAvatar("ava-mitchell"),
    role: "admin",
    active: "Active now",
    online: true,
  },
  {
    id: "marcus",
    name: "Marcus Johnson",
    email: "marcus@fieldnote.example",
    photo: personAvatar("marcus-johnson"),
    role: "member",
    active: "Active 2 hours ago",
  },
  {
    id: "jasmine",
    name: "Jasmine Brooks",
    email: "jasmine@fieldnote.example",
    photo: personAvatar("jasmine-brooks"),
    role: "member",
    active: "Active yesterday",
  },
  {
    id: "sofia",
    name: "Sofia Ramirez",
    email: "sofia@fieldnote.example",
    photo: personAvatar("sofia-ramirez"),
    role: "viewer",
    active: "Active Sep 14",
  },
];

const SEED_INVITES: Invite[] = [
  { id: "jordan", email: "jordan.blake@fieldnote.example", role: "member", sent: "Invited Sep 19" },
  { id: "priya", email: "priya.shah@harborline.studio", role: "viewer", sent: "Invited Sep 20" },
];

const { spring: SPRING, duration: DURATION, blur: BLUR } = motionTokens;
const EASE_ENTER = [...motionTokens.ease.enter] as [number, number, number, number];
const EASE_STANDARD = [...motionTokens.ease.standard] as [number, number, number, number];
const INSTANT: Transition = { duration: 0 };

/** “a member”, “an admin” — the article the status line needs. */
const article = (role: InviteRole) => (role === "admin" ? "an admin" : `a ${role}`);

/** Chip enter/rest/exit. `sent` exits instantly because it is already flying to the invite row. */
const chipVariants: Variants = {
  enter: { opacity: 0, scale: 0.9, filter: `blur(${BLUR.soft}px)` },
  rest: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: (custom: string) =>
    custom === "sent"
      ? { opacity: 0, transition: INSTANT }
      : {
          opacity: 0,
          scale: 0.9,
          filter: `blur(${BLUR.soft}px)`,
          transition: { duration: DURATION.exit, ease: EASE_STANDARD },
        },
};

const chipTransition: Transition = {
  ...SPRING.snappy,
  opacity: { duration: DURATION.fast, ease: EASE_ENTER },
  filter: { duration: DURATION.fast, ease: EASE_ENTER },
  layout: SPRING.morph,
};

/**
 * Measures its child so a row can animate `height: 0 → auto`. Starts at `"auto"` so the first
 * paint is already correct, then follows every reflow (role change, confirm swap, resize).
 */
function useMeasuredHeight() {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, height] as const;
}

interface RowProps {
  children: ReactNode;
  className?: string;
  /** Off for rows that arrive through the invite flight, which fades itself in. */
  fade?: boolean;
  /** Lets the email chip travel past the row edge while it lands. */
  open?: boolean;
  confirming?: boolean;
}

/** One list row: height morphs with its content, exit collapses it. */
function Row({ children, className, fade = true, open = false, confirming = false }: RowProps) {
  const reduced = useReducedMotion();
  const [ref, height] = useMeasuredHeight();

  return (
    <motion.li
      className={className}
      data-confirming={confirming || undefined}
      style={{ overflow: open ? "visible" : "hidden" }}
      initial={{ height: 0, opacity: fade ? 0 : 1 }}
      animate={{ height, opacity: 1 }}
      exit={{
        height: 0,
        opacity: 0,
        transition: reduced
          ? INSTANT
          : { height: SPRING.smooth, opacity: { duration: DURATION.fast, ease: EASE_STANDARD } },
      }}
      transition={
        reduced
          ? INSTANT
          : { height: SPRING.smooth, opacity: { duration: DURATION.standard, ease: EASE_ENTER } }
      }
    >
      <div ref={ref}>{children}</div>
    </motion.li>
  );
}

/** The visible status line, cross-faded per message. Mirrors the polite live region. */
function SwapLabel({ text }: { text: string }) {
  const reduced = useReducedMotion();

  return (
    <span className={styles.swap} aria-hidden="true">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          className={styles.swapText}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.45em", filter: `blur(${BLUR.soft}px)` }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={
            reduced
              ? { opacity: 0, transition: INSTANT }
              : {
                  opacity: 0,
                  y: "-0.35em",
                  filter: `blur(${BLUR.subtle}px)`,
                  transition: { duration: DURATION.fast, ease: EASE_STANDARD },
                }
          }
          transition={reduced ? { duration: DURATION.instant } : { duration: DURATION.standard, ease: EASE_ENTER }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

interface RoleSelectProps {
  label: string;
  value: InviteRole;
  onChange: (role: InviteRole) => void;
  /** The invite row renders the taller, bordered variant. */
  field?: boolean;
  disabled?: boolean;
}

/** Role picker: Radix select with the animated label and a hint per option. */
function RoleSelect({ label, value, onChange, field = false, disabled }: RoleSelectProps) {
  return (
    <Select.Root value={value} onValueChange={(next) => onChange(next as InviteRole)} disabled={disabled}>
      <Select.Trigger
        className={[styles.roleTrigger, field ? styles.roleField : ""].filter(Boolean).join(" ")}
        aria-label={label}
      >
        <span className={styles.srOnly}>
          <Select.Value />
        </span>
        <span aria-hidden="true">
          <TextMorph>{ROLE_LABEL[value]}</TextMorph>
        </span>
        <Select.Icon className={styles.roleChevron}>
          <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className={styles.roleMenu}
          position="popper"
          align="end"
          sideOffset={6}
          collisionPadding={12}
        >
          <Select.Viewport>
            {ROLE_OPTIONS.map((option) => (
              <Select.Item key={option.value} value={option.value} className={styles.roleItem}>
                <span className={styles.roleItemText}>
                  <Select.ItemText>{ROLE_LABEL[option.value]}</Select.ItemText>
                  <span className={styles.roleHint}>{option.hint}</span>
                </span>
                <Select.ItemIndicator className={styles.roleCheck}>
                  <Check size={16} strokeWidth={2} aria-hidden="true" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

/**
 * Members list with multi-address invites. Typed emails become chips, chips fly into the pending
 * invites list on send, roles change in place, and removals ask for confirmation first.
 * Every member, invite, and seat count is simulated.
 */
export function TeamMembers() {
  const id = useId();
  const reduced = useReducedMotion();

  const [members, setMembers] = useState<Member[]>(SEED_MEMBERS);
  const [invites, setInvites] = useState<Invite[]>(SEED_INVITES);
  const [chips, setChips] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("member");
  const [sending, setSending] = useState(false);
  /** Why the chips left: “sent” skips the shrink, “removed” plays it. */
  const [chipExit, setChipExit] = useState<"removed" | "sent">("removed");
  const [justInvited, setJustInvited] = useState<string[]>([]);
  const [resend, setResend] = useState<Record<string, "sending" | "sent">>({});
  const [search, setSearch] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [status, setStatus] = useState("Changes apply right away");

  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const memberButtons = useRef(new Map<string, HTMLButtonElement>());
  const inviteButtons = useRef(new Map<string, HTMLButtonElement>());
  const nextId = useRef(0);
  const timeouts = useRef<number[]>([]);
  const [fieldRef, fieldHeight] = useMeasuredHeight();
  const [messageRef, messageHeight] = useMeasuredHeight();

  useEffect(() => {
    const list = timeouts.current;
    return () => list.forEach(window.clearTimeout);
  }, []);

  useEffect(() => {
    if (!confirming) return;
    requestAnimationFrame(() => cancelRef.current?.focus({ preventScroll: true }));
  }, [confirming]);

  const seatsUsed = members.length + invites.length;
  const seatsLeft = Math.max(0, SEAT_LIMIT - seatsUsed);
  const chipsOverLimit = chips.length - seatsLeft;
  const query = search.trim().toLowerCase();
  const visibleMembers = members.filter(
    (member) => !query || member.name.toLowerCase().includes(query) || member.email.includes(query),
  );
  const visibleInvites = invites.filter((invite) => !query || invite.email.includes(query));
  const pendingCount = chips.length + Number(EMAIL_PATTERN.test(draft.trim().toLowerCase()));

  const message: { tone: "error" | "warning" | "hint"; text: string } = error
    ? { tone: "error", text: error }
    : chipsOverLimit > 0
      ? {
          tone: "warning",
          text:
            seatsLeft === 0
              ? "All 10 seats are taken. Remove someone or revoke an invite first"
              : `${seatsLeft} ${seatsLeft === 1 ? "seat" : "seats"} left. Remove ${chipsOverLimit} ${
                  chipsOverLimit === 1 ? "address" : "addresses"
                } to send`,
        }
      : seatsLeft === 0
        ? { tone: "warning", text: "All 10 seats are taken" }
        : {
            tone: "hint",
            text: "Separate addresses with commas or press Enter. Invites expire in 7 days",
          };

  function after(callback: () => void, ms: number) {
    timeouts.current.push(window.setTimeout(callback, ms));
  }

  /** Focus lands after the swap committed, so a remounted trigger is the one that gets it. */
  function focusSoon(read: () => HTMLElement | null | undefined) {
    requestAnimationFrame(() => {
      const node = read();
      if (node?.isConnected) node.focus({ preventScroll: true });
    });
  }

  /** Splits typed text on commas, semicolons, and spaces; validates, dedupes, and reports. */
  function addAddresses(text: string) {
    const next = [...chips];
    const problems: string[] = [];
    let problem = "";

    for (const token of text.split(/[\s,;]+/)) {
      const email = token.replace(/^<|>$/g, "").toLowerCase();
      if (!email) continue;
      const member = members.find((entry) => entry.email === email);
      if (EMAIL_PATTERN.test(email)) {
        if (member) problem ||= `${member.name} is already a member`;
        else if (invites.some((entry) => entry.email === email)) problem ||= `${email} already has a pending invite`;
        else if (!next.includes(email)) next.push(email);
      } else {
        problems.push(token);
        problem ||= `“${token}” is not a complete email address`;
      }
    }

    setChips(next);
    setDraft(problems.join(", "));
    setError(problem);
    return { next, problem };
  }

  function removeChip(email: string) {
    setChipExit("removed");
    setChips((list) => list.filter((entry) => entry !== email));
    setError("");
    setStatus(`Removed ${email} from the invite`);
  }

  function sendInvites() {
    if (sending) return;
    const { next, problem } = draft.trim() ? addAddresses(draft) : { next: chips, problem: "" };
    if (problem) return;
    if (!next.length) {
      setError("Add at least one email address");
      inputRef.current?.focus();
      return;
    }
    if (next.length > seatsLeft) return;

    setSending(true);
    setError("");
    setSearch("");
    setConfirming(null);
    after(() => {
      const created = next.map((email) => ({
        id: `sent-${++nextId.current}`,
        email,
        role: inviteRole,
        sent: "Invited just now",
      }));
      setChipExit("sent");
      setChips([]);
      setInvites((list) => [...list, ...created]);
      setJustInvited(created.map((invite) => invite.id));
      setSending(false);
      setStatus(
        created.length === 1
          ? `Invited ${created[0].email} as ${article(inviteRole)}`
          : `Invited ${created.length} people as ${inviteRole === "admin" ? "admins" : `${inviteRole}s`}`,
      );
      inputRef.current?.focus({ preventScroll: true });
      after(() => setJustInvited([]), 1400);
    }, 700);
  }

  function cancelConfirm(memberId: string) {
    setConfirming(null);
    focusSoon(() => memberButtons.current.get(memberId));
  }

  const enterFrom = reduced ? { opacity: 0 } : { opacity: 0, y: 6, filter: `blur(${BLUR.soft}px)` };
  const exitTo = reduced
    ? { opacity: 0, transition: INSTANT }
    : {
        opacity: 0,
        y: -4,
        filter: `blur(${BLUR.soft}px)`,
        transition: { duration: DURATION.exit, ease: EASE_STANDARD },
      };
  const contentTransition: Transition = reduced
    ? INSTANT
    : {
        ...SPRING.smooth,
        opacity: { duration: DURATION.standard, ease: EASE_ENTER },
        filter: { duration: DURATION.standard, ease: EASE_ENTER },
      };

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id={id}>
        <section className={styles.block} aria-labelledby={`${id}-title`}>
          <header className={styles.header}>
            <div className={styles.heading}>
              <h2 id={`${id}-title`}>Members</h2>
              <p>Manage who can work in the {WORKSPACE} workspace.</p>
            </div>
            <div className={styles.seats} data-full={seatsLeft === 0 || undefined}>
              <p className={styles.seatText}>
                <span className={styles.number}>
                  <AnimatedCounter value={seatsUsed} />
                </span> of {SEAT_LIMIT} seats
              </p>
              <div
                className={styles.seatTrack}
                role="meter"
                aria-label="Seats used"
                aria-valuemin={0}
                aria-valuemax={SEAT_LIMIT}
                aria-valuenow={seatsUsed}
                aria-valuetext={`${seatsUsed} of ${SEAT_LIMIT} seats used`}
              >
                <motion.span
                  className={styles.seatFill}
                  initial={false}
                  animate={{ width: `${100 * Math.min(seatsUsed / SEAT_LIMIT, 1)}%` }}
                  transition={reduced ? INSTANT : SPRING.morph}
                />
              </div>
            </div>
          </header>

          <form
            className={styles.invite}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              sendInvites();
            }}
          >
            <label className={styles.inviteLabel} htmlFor={`${id}-invite`}>
              Invite people
            </label>
            <div className={styles.inviteRow}>
              <motion.div
                className={styles.field}
                data-invalid={error ? "" : undefined}
                initial={false}
                animate={{ height: fieldHeight === "auto" ? "auto" : fieldHeight + 2 }}
                transition={reduced ? INSTANT : SPRING.smooth}
                onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
                  const target = event.target as HTMLElement;
                  if (target.closest("button, input")) return;
                  event.preventDefault();
                  inputRef.current?.focus();
                }}
              >
                <div ref={fieldRef} className={styles.fieldInner}>
                  <AnimatePresence mode="popLayout" initial={false} custom={chipExit}>
                    {chips.map((email) => (
                      <motion.span
                        key={email}
                        layoutId={`invite-${email}`}
                        className={styles.chip}
                        custom={chipExit}
                        variants={chipVariants}
                        initial="enter"
                        animate="rest"
                        exit="exit"
                        transition={reduced ? INSTANT : chipTransition}
                      >
                        <span className={styles.chipText}>{email}</span>
                        <button
                          type="button"
                          className={styles.chipRemove}
                          aria-label={`Remove ${email}`}
                          disabled={sending}
                          onClick={() => {
                            removeChip(email);
                            inputRef.current?.focus();
                          }}
                        >
                          <X size={12} strokeWidth={2} aria-hidden="true" />
                        </button>
                      </motion.span>
                    ))}
                  </AnimatePresence>
                  <motion.input
                    layout="position"
                    transition={reduced ? INSTANT : { layout: SPRING.morph }}
                    ref={inputRef}
                    id={`${id}-invite`}
                    className={styles.draft}
                    type="text"
                    inputMode="email"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder={chips.length ? "" : "name@example.com"}
                    value={draft}
                    readOnly={sending}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={`${id}-message`}
                    onChange={(event) => {
                      setDraft(event.target.value);
                      if (error) setError("");
                    }}
                    onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        if (draft.trim()) addAddresses(draft);
                        else if (chips.length) sendInvites();
                        return;
                      }
                      if ((event.key === "," || event.key === ";" || event.key === " ") && draft.trim()) {
                        event.preventDefault();
                        addAddresses(draft);
                        return;
                      }
                      if (event.key === "Backspace" && !draft && chips.length && !sending) {
                        event.preventDefault();
                        removeChip(chips[chips.length - 1]);
                      }
                    }}
                    onPaste={(event: ClipboardEvent<HTMLInputElement>) => {
                      const text = event.clipboardData.getData("text");
                      if (/[\s,;]/.test(text.trim())) {
                        event.preventDefault();
                        addAddresses(`${draft} ${text}`);
                      }
                    }}
                    onBlur={() => {
                      if (!sending && EMAIL_PATTERN.test(draft.trim().toLowerCase())) addAddresses(draft);
                    }}
                  />
                </div>
              </motion.div>
              <div className={styles.inviteActions}>
                <RoleSelect
                  field
                  label="Invite as"
                  value={inviteRole}
                  onChange={setInviteRole}
                  disabled={sending}
                />
                <Button
                  type="submit"
                  size="sm"
                  loading={sending}
                  disabled={!sending && ((!chips.length && !draft.trim()) || chipsOverLimit > 0)}
                >
                  {pendingCount > 1 ? `Send ${pendingCount} invites` : "Send invite"}
                </Button>
              </div>
            </div>
            <motion.div
              className={styles.messageSlot}
              initial={false}
              animate={{ height: messageHeight }}
              transition={reduced ? INSTANT : SPRING.smooth}
            >
              <div ref={messageRef} id={`${id}-message`} className={styles.messageInner} aria-live="polite">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.p
                    key={message.text}
                    className={styles.message}
                    data-tone={message.tone}
                    initial={enterFrom}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={exitTo}
                    transition={reduced ? INSTANT : { duration: DURATION.standard, ease: EASE_ENTER }}
                  >
                    {message.tone !== "hint" && <CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" />}
                    <span>{message.text}</span>
                  </motion.p>
                </AnimatePresence>
              </div>
            </motion.div>
          </form>

          <div className={styles.lists}>
            <div className={styles.sectionHead}>
              <h3 id={`${id}-members`} className={styles.sectionTitle}>
                Members <span className={styles.count}>
                  <AnimatedCounter value={visibleMembers.length} />
                </span>
              </h3>
              <div className={styles.search}>
                <SearchField
                  ref={searchRef}
                  label="Search people"
                  placeholder="Search by name or email"
                  value={search}
                  onValueChange={(next) => {
                    setSearch(next);
                    setConfirming(null);
                  }}
                />
              </div>
            </div>
            <ul className={styles.list} aria-labelledby={`${id}-members`}>
              <AnimatePresence initial={false}>
                {visibleMembers.map((member) => {
                  const isConfirming = confirming === member.id;
                  return (
                    <Row key={member.id} className={styles.row} confirming={isConfirming}>
                      <div className={styles.rowInner}>
                        <Avatar
                          name={member.name}
                          src={member.photo}
                          status={member.online ? "online" : undefined}
                        />
                        <div
                          className={styles.rowBody}
                          onKeyDown={(event) => {
                            if (event.key === "Escape" && isConfirming) {
                              event.stopPropagation();
                              cancelConfirm(member.id);
                            }
                          }}
                        >
                          <AnimatePresence mode="popLayout" initial={false}>
                            {isConfirming ? (
                              <motion.div
                                key="confirm"
                                className={styles.confirm}
                                initial={enterFrom}
                                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                exit={exitTo}
                                transition={contentTransition}
                              >
                                <div className={styles.identity}>
                                  <span className={styles.name}>Remove {member.name}?</span>
                                  <span className={styles.detail}>
                                    They lose access to {WORKSPACE} right away
                                  </span>
                                </div>
                                <div className={styles.confirmActions}>
                                  <Button
                                    ref={cancelRef}
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => cancelConfirm(member.id)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="danger"
                                    size="sm"
                                    onClick={() => {
                                      const removable = visibleMembers.filter((entry) => !entry.you);
                                      const index = removable.findIndex((entry) => entry.id === member.id);
                                      const next = removable[index + 1] ?? removable[index - 1];
                                      setMembers((list) => list.filter((entry) => entry.id !== member.id));
                                      setConfirming(null);
                                      setStatus(`${member.name} was removed from ${WORKSPACE}`);
                                      focusSoon(() =>
                                        next ? memberButtons.current.get(next.id) : searchRef.current,
                                      );
                                    }}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="view"
                                className={styles.view}
                                initial={enterFrom}
                                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                exit={exitTo}
                                transition={contentTransition}
                              >
                                <div className={styles.identity}>
                                  <span className={styles.name}>
                                    {member.name}
                                    {member.you && <span className={styles.you}>You</span>}
                                  </span>
                                  <span className={styles.detail}>{member.email}</span>
                                  <span className={`${styles.detail} ${styles.activeInline}`}>
                                    {member.active}
                                  </span>
                                </div>
                                <span className={styles.active}>{member.active}</span>
                                {member.role === "owner" ? (
                                  <span className={styles.owner}>Owner</span>
                                ) : (
                                  <RoleSelect
                                    label={`Role for ${member.name}`}
                                    value={member.role}
                                    onChange={(role) => {
                                      setMembers((list) =>
                                        list.map((entry) => (entry.id === member.id ? { ...entry, role } : entry)),
                                      );
                                      setStatus(`${member.name} is now ${article(role)}`);
                                    }}
                                  />
                                )}
                                {member.you ? (
                                  <span className={styles.spacer} aria-hidden="true" />
                                ) : (
                                  <Button
                                    ref={(node) => {
                                      if (node) memberButtons.current.set(member.id, node);
                                    }}
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className={styles.iconButton}
                                    aria-label={`Remove ${member.name}`}
                                    onClick={() => setConfirming(member.id)}
                                  >
                                    <UserMinus size={16} strokeWidth={1.75} aria-hidden="true" />
                                  </Button>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </Row>
                  );
                })}
                {visibleMembers.length === 0 && (
                  <Row key="members-empty" className={styles.emptyRow}>
                    <div className={styles.empty}>
                      <p>No members match “{search.trim()}”</p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSearch("");
                          searchRef.current?.focus();
                        }}
                      >
                        Clear search
                      </Button>
                    </div>
                  </Row>
                )}
              </AnimatePresence>
            </ul>

            <div className={styles.sectionHead}>
              <h3 id={`${id}-pending`} className={styles.sectionTitle}>
                Pending invites <span className={styles.count}>
                  <AnimatedCounter value={visibleInvites.length} />
                </span>
              </h3>
            </div>
            <ul className={styles.list} aria-labelledby={`${id}-pending`}>
              <AnimatePresence initial={false}>
                {visibleInvites.map((invite) => {
                  const landingIndex = justInvited.indexOf(invite.id);
                  const isLanding = landingIndex >= 0;
                  const resendState = resend[invite.id];
                  const followUp: Transition = reduced
                    ? INSTANT
                    : {
                        duration: DURATION.standard,
                        ease: EASE_ENTER,
                        delay: 0.24 + Math.max(landingIndex, 0) * motionTokens.stagger.line,
                      };
                  return (
                    <Row
                      key={invite.id}
                      className={styles.row}
                      fade={!isLanding}
                      open={isLanding}
                    >
                      <div className={styles.rowInner}>
                        <motion.span
                          className={styles.pendingAvatar}
                          aria-hidden="true"
                          initial={isLanding ? { opacity: 0, scale: 0.6 } : false}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={
                            reduced
                              ? INSTANT
                              : {
                                  ...SPRING.snappy,
                                  delay: 0.2 + Math.max(landingIndex, 0) * motionTokens.stagger.line,
                                }
                          }
                        >
                          {invite.email
                            .split("@")[0]
                            .split(/[._-]+/)
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((part) => part[0].toUpperCase())
                            .join("")}
                        </motion.span>
                        <div className={styles.pendingBody}>
                          <div className={styles.identity}>
                            <motion.span
                              layoutId={`invite-${invite.email}`}
                              layout="position"
                              layoutCrossfade={false}
                              className={[styles.inviteEmail, isLanding ? styles.landing : ""]
                                .filter(Boolean)
                                .join(" ")}
                              transition={
                                reduced
                                  ? INSTANT
                                  : {
                                      layout: {
                                        ...SPRING.morph,
                                        visualDuration: 0.5 + 0.06 * Math.max(landingIndex, 0),
                                      },
                                    }
                              }
                            >
                              {invite.email}
                            </motion.span>
                            <motion.span
                              className={styles.detail}
                              initial={isLanding ? { opacity: 0 } : false}
                              animate={{ opacity: 1 }}
                              transition={followUp}
                            >
                              <span className={styles.srOnly}>
                                {ROLE_LABEL[invite.role]}, {invite.sent}
                              </span>
                              <SwapLabel text={`${ROLE_LABEL[invite.role]} · ${invite.sent}`} />
                            </motion.span>
                          </div>
                          <motion.div
                            className={styles.pendingActions}
                            initial={isLanding ? { opacity: 0, y: 4 } : false}
                            animate={{ opacity: 1, y: 0 }}
                            transition={followUp}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              loading={resendState === "sending"}
                              aria-label={
                                resendState === "sent"
                                  ? `Sent, invite to ${invite.email} resent`
                                  : `Resend invite to ${invite.email}`
                              }
                              onClick={() => {
                                if (resend[invite.id]) return;
                                setResend((map) => ({ ...map, [invite.id]: "sending" }));
                                after(() => {
                                  setResend((map) => ({ ...map, [invite.id]: "sent" }));
                                  setInvites((list) =>
                                    list.map((entry) =>
                                      entry.id === invite.id ? { ...entry, sent: "Resent just now" } : entry,
                                    ),
                                  );
                                  setStatus(`Invite resent to ${invite.email}`);
                                  after(() => {
                                    setResend((map) => {
                                      const next = { ...map };
                                      delete next[invite.id];
                                      return next;
                                    });
                                  }, 1800);
                                }, 600);
                              }}
                            >
                              {resendState === "sent" ? (
                                <>
                                  <Check size={15} strokeWidth={2} aria-hidden="true" /> Sent
                                </>
                              ) : (
                                "Resend"
                              )}
                            </Button>
                            <Button
                              ref={(node) => {
                                if (node) inviteButtons.current.set(invite.id, node);
                              }}
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={`Revoke invite to ${invite.email}`}
                              onClick={() => {
                                const index = visibleInvites.findIndex((entry) => entry.id === invite.id);
                                const next = visibleInvites[index + 1] ?? visibleInvites[index - 1];
                                setInvites((list) => list.filter((entry) => entry.id !== invite.id));
                                setStatus(`Invite to ${invite.email} revoked`);
                                focusSoon(() =>
                                  next ? inviteButtons.current.get(next.id) : inputRef.current,
                                );
                              }}
                            >
                              Revoke
                            </Button>
                          </motion.div>
                        </div>
                      </div>
                    </Row>
                  );
                })}
                {visibleInvites.length === 0 && (
                  <Row key="invites-empty" className={styles.emptyRow}>
                    <p className={styles.emptyLine}>
                      {query && invites.length ? "No invites match your search" : "No pending invites"}
                    </p>
                  </Row>
                )}
              </AnimatePresence>
            </ul>
          </div>

          <footer className={styles.footer}>
            <p className={styles.srOnly} role="status" aria-live="polite">
              {status}
            </p>
            <span className={styles.status}>
              <SwapLabel text={status} />
            </span>
          </footer>
        </section>
      </LayoutGroup>
    </MotionConfig>
  );
}

export default TeamMembers;
