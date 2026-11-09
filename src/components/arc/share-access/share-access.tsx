"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { Check, ChevronDown, CircleAlert, Globe, Link2, Lock, X } from "lucide-react";
import { ArcImage } from "../lib/arc-provider";
import { motionTokens } from "../lib/motion-tokens";
import { writeClipboard } from "../lib/use-copy-feedback";
import styles from "./share-access.module.css";

/** The three roles a person can hold on something shared. `owner` exists only for members. */
export type ShareRole = "owner" | "editor" | "commenter" | "viewer";
/** A role that can be granted from a menu, chip or invite. */
export type ShareInviteRole = "editor" | "commenter" | "viewer";
/** Who can open the link without an invite. */
export type ShareGeneralAccess = "restricted" | "link";

/** Someone who can be suggested while typing: an address, with an optional name and photo. */
export interface ShareAccessContact {
  email: string;
  name?: string;
  src?: string;
}

/** A person with access. `id` is stable, `pending` marks an invite that has gone out but not been accepted. */
export interface ShareAccessMember extends ShareAccessContact {
  id: string;
  role: ShareRole;
  pending?: boolean;
}

export interface ShareAccessProps {
  /** Name of what is being shared, used in the heading Share “title” and the accessible name. */
  title?: string;
  /** People with access: { id, email, name?, src?, role, pending? }. Pass with onMembersChange to control the list. */
  members?: readonly ShareAccessMember[];
  /** Initial members when uncontrolled. */
  defaultMembers?: readonly ShareAccessMember[];
  /** Called with the new list after an invite, a role change, a removal or an undo. */
  onMembersChange?: (members: ShareAccessMember[]) => void;
  /** Who can open it without an invite. Pass with onAccessChange to control it. */
  access?: ShareGeneralAccess;
  /** Initial general access when uncontrolled. */
  defaultAccess?: ShareGeneralAccess;
  /** Called when general access changes. */
  onAccessChange?: (access: ShareGeneralAccess) => void;
  /** What anyone with the link can do. Its menu slides in beside general access when the link is open. */
  linkRole?: ShareInviteRole;
  /** Initial link role when uncontrolled. */
  defaultLinkRole?: ShareInviteRole;
  /** Called when the link role changes. */
  onLinkRoleChange?: (role: ShareInviteRole) => void;
  /** People to suggest while typing. Matches the start of any name part or the email; people who already have access are left out. */
  directory?: readonly ShareAccessContact[];
  /** The link Copy link puts on the clipboard. */
  link?: string;
  /** Id of the member using the app, marked (you). */
  selfId?: string;
  /** Role preselected for new invites. */
  defaultInviteRole?: ShareInviteRole;
  /** Called with the valid chips and role when Invite is pressed. Return a promise to show Sending; reject it to keep the chips. */
  onInvite?: (people: ShareAccessContact[], role: ShareInviteRole) => void | Promise<void>;
  /** Called after the link is on the clipboard. */
  onCopyLink?: (link: string) => void;
  /** Shows a Done button that calls this, for example to close the popover. */
  onDone?: () => void;
  /** Class on the panel. */
  className?: string;
  /** Inline styles on the panel. */
  style?: CSSProperties;
}

interface MenuOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

const ROLES: readonly MenuOption<ShareInviteRole>[] = [
  { value: "viewer", label: "Can view", hint: "Read only" },
  { value: "commenter", label: "Can comment", hint: "Suggest and discuss" },
  { value: "editor", label: "Can edit", hint: "Make any change" },
];

const ACCESS: readonly MenuOption<ShareGeneralAccess>[] = [
  { value: "restricted", label: "Restricted", hint: "Only people with access can open" },
  { value: "link", label: "Anyone with the link", hint: "No sign in needed" },
];

const roleLabel = (role: ShareInviteRole) => ROLES.find(option => option.value === role)?.label ?? "";
const inviteRoleLabel = (role: ShareInviteRole) => roleLabel(role).toLowerCase();

/** A deliberately forgiving address check: enough to catch a typo, not a full RFC 5322 parse. */
const EMAIL = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/i;

const ease = [...motionTokens.ease.standard] as [number, number, number, number];

type SpringName = "snappy" | "smooth" | "morph";

/** Every spring collapses to an instant jump when the person asked for less motion. */
const spring = (reduced: boolean, name: SpringName): Transition => (reduced ? { duration: 0 } : motionTokens.spring[name]);

/** Up to two letters from the name, or from the address when there is no name. */
function initials(contact: { name?: string; email: string }): string {
  const source = (contact.name ?? contact.email).replace(/@.*/, "");
  return source.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() ?? "").join("") || "?";
}

/** A round avatar that falls back to initials while the photo loads, or for good when it fails. */
function Face({ contact, size }: { contact: { email: string; name?: string; src?: string }; size: number }) {
  const [failedSrc, setFailedSrc] = useState<string | undefined>(undefined);
  return (
    <span className={styles.face} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">
      <span>{initials(contact)}</span>
      {contact.src && failedSrc !== contact.src ? (
        <ArcImage src={contact.src} alt="" fill sizes={`${size}px`} className={styles.photo} draggable={false} onError={() => setFailedSrc(contact.src)} />
      ) : null}
    </span>
  );
}

/** A label that measures itself, then lets the trigger's width follow the new word on the morph spring. */
function MorphLabel({ text, reduced }: { text: string; reduced: boolean }) {
  const measure = useRef<HTMLSpanElement>(null);
  const width = useMotionValue(0);
  const measured = useRef(false);
  useLayoutEffect(() => {
    const node = measure.current;
    if (!node) return;
    let alive = true;
    const read = () => {
      if (!alive) return;
      const next = node.offsetWidth + 1;
      // The first measure, a font swap and reduced motion jump; only a real text change springs.
      if (!measured.current || reduced) width.jump(next);
      else animate(width, next, motionTokens.spring.morph);
      measured.current = true;
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    document.fonts?.ready.then(read);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [text, reduced, width]);
  return (
    <>
      <span ref={measure} className={styles.morphMeasure} aria-hidden="true">
        {text}
      </span>
      <motion.span className={styles.morph} style={{ width }}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={text}
            className={styles.morphText}
            initial={{ opacity: 0, y: reduced ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : -6 }}
            transition={spring(reduced, "snappy")}
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </>
  );
}

/** The head count rolls in the direction of the change. */
function Count({ value, reduced }: { value: number; reduced: boolean }) {
  const [display, setDisplay] = useState({ value, direction: 1 });
  if (display.value !== value) setDisplay({ value, direction: value < display.value ? -1 : 1 });
  return (
    <span className={styles.count}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ opacity: 0, y: reduced ? 0 : `${0.6 * display.direction}em` }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : `${-0.6 * display.direction}em` }}
          transition={spring(reduced, "snappy")}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

interface RoleMenuProps<T extends string> {
  value: T;
  options: readonly MenuOption<T>[];
  onChange: (value: T) => void;
  label: string;
  reduced: boolean;
  align?: "start" | "center" | "end";
  className?: string;
  children?: ReactNode;
  onRemove?: () => void;
}

/** A compact role trigger: the current word morphs to its new width while the chevron turns. */
function RoleMenu<T extends string>({ value, options, onChange, label, reduced, align = "end", className, children, onRemove }: RoleMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const current = options.find(option => option.value === value)?.label ?? "";
  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenu.Trigger type="button" className={[styles.menuTrigger, className].filter(Boolean).join(" ")} aria-label={`${label}: ${current}`}>
        {children}
        <MorphLabel text={current} reduced={reduced} />
        <ChevronDown className={styles.chevron} size={16} strokeWidth={1.75} aria-hidden="true" />
      </DropdownMenu.Trigger>
      <AnimatePresence>
        {open ? (
          <DropdownMenu.Portal forceMount>
            <DropdownMenu.Content forceMount asChild align={align} sideOffset={6} collisionPadding={12} loop>
              <motion.div
                className={styles.menu}
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.98, y: -2, transition: { duration: motionTokens.duration.fast, ease } }}
                transition={spring(reduced, "snappy")}
              >
                <DropdownMenu.RadioGroup value={value} onValueChange={next => onChange(next as T)}>
                  {options.map(option => (
                    <DropdownMenu.RadioItem key={option.value} value={option.value} className={styles.menuItem}>
                      <span className={styles.menuText}>
                        <span>{option.label}</span>
                        {option.hint ? <span className={styles.menuHint}>{option.hint}</span> : null}
                      </span>
                      <DropdownMenu.ItemIndicator className={styles.menuCheck}>
                        <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                      </DropdownMenu.ItemIndicator>
                    </DropdownMenu.RadioItem>
                  ))}
                </DropdownMenu.RadioGroup>
                {onRemove ? (
                  <>
                    <DropdownMenu.Separator className={styles.menuSeparator} />
                    <DropdownMenu.Item className={[styles.menuItem, styles.menuDanger].join(" ")} onSelect={onRemove}>
                      Remove access
                    </DropdownMenu.Item>
                  </>
                ) : null}
              </motion.div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        ) : null}
      </AnimatePresence>
    </DropdownMenu.Root>
  );
}

interface Chip extends ShareAccessContact {
  key: string;
  valid: boolean;
}

interface Undo {
  member: ShareAccessMember;
  index: number;
}

/**
 * A share panel for a document, board or project. Type names or emails and they become chips: people from your
 * directory show their photo, and an address that is not valid turns red with a message under the field. Suggestions
 * with avatars appear as you type. Pick the role for the invite and send; the new people slide into the list with a
 * brief highlight. Each person's role changes from a compact menu whose label morphs to its new width, Remove access
 * folds the row away with an undo, general access switches between restricted and anyone with the link, and Copy link
 * confirms in place without changing width.
 */
export function ShareAccess({
  title = "Q3 launch plan",
  members,
  defaultMembers = [],
  onMembersChange,
  access,
  defaultAccess = "restricted",
  onAccessChange,
  linkRole,
  defaultLinkRole = "viewer",
  onLinkRoleChange,
  directory = [],
  link = "https://fieldwork.example/d/q3-launch-plan",
  selfId,
  defaultInviteRole = "editor",
  onInvite,
  onCopyLink,
  onDone,
  className,
  style,
}: ShareAccessProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const suggestionsId = `${uid}-suggestions`;
  const errorId = `${uid}-error`;

  const [ownMembers, setOwnMembers] = useState<ShareAccessMember[]>(() => [...defaultMembers]);
  const [ownAccess, setOwnAccess] = useState<ShareGeneralAccess>(defaultAccess);
  const [ownLinkRole, setOwnLinkRole] = useState<ShareInviteRole>(defaultLinkRole);
  const [announcement, setAnnouncement] = useState("");
  const [text, setText] = useState("");
  const [chips, setChips] = useState<Chip[]>([]);
  const [armed, setArmed] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [inviteRole, setInviteRole] = useState<ShareInviteRole>(defaultInviteRole);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [flash, setFlash] = useState<string[]>([]);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const list = members ?? ownMembers;
  const accessValue = access ?? ownAccess;
  const linkRoleValue = linkRole ?? ownLinkRole;
  const heading = `Share “${title}”`;

  const hasAccess = (email: string) => list.some(member => member.email.toLowerCase() === email.toLowerCase());
  const query = text.trim().toLowerCase();
  const suggestions = query
    ? directory
        .filter(contact => !hasAccess(contact.email) && ((contact.name ?? "").toLowerCase().split(/\s+/).some(part => part.startsWith(query)) || (contact.name ?? "").toLowerCase().startsWith(query) || contact.email.toLowerCase().startsWith(query)))
        .slice(0, 5)
    : [];
  const showSuggestions = focused && suggestions.length > 0;
  const active = Math.min(activeIndex, Math.max(0, suggestions.length - 1));
  const invalidChip = chips.find(chip => !chip.valid);
  const message = invalidChip ? `“${invalidChip.email}” isn’t a valid email address` : notice;

  const updateMembers = (next: ShareAccessMember[]) => {
    if (members === undefined) setOwnMembers(next);
    onMembersChange?.(next);
  };

  useEffect(() => {
    if (!flash.length) return;
    const timer = window.setTimeout(() => setFlash([]), 1600);
    return () => window.clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 6000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  useEffect(() => {
    if (copyState === "idle") return;
    const timer = window.setTimeout(() => setCopyState("idle"), 1800);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const addChips = (entries: { email: string }[]) => {
    const added: Chip[] = [];
    let conflict: string | null = null;
    for (const entry of entries) {
      const email = entry.email.trim();
      if (!email) continue;
      const lower = email.toLowerCase();
      const match = directory.find(contact => contact.email.toLowerCase() === lower || contact.name?.toLowerCase() === lower);
      const contact: ShareAccessContact = match ?? { email };
      if (hasAccess(contact.email) || added.some(chip => chip.email.toLowerCase() === contact.email.toLowerCase())) {
        const existing = list.find(member => member.email.toLowerCase() === contact.email.toLowerCase());
        conflict = existing ? `${existing.name ?? existing.email} already has access` : `${contact.name ?? contact.email} is already added`;
        continue;
      }
      added.push({ ...contact, key: `${contact.email}-${Date.now()}-${added.length}`, valid: !!match || EMAIL.test(contact.email) });
    }
    if (added.length) {
      setChips(previous => [...previous, ...added]);
      setAnnouncement(added.map(chip => `${chip.name ?? chip.email} added${chip.valid ? "" : ", not a valid email"}`).join(". "));
    }
    setNotice(conflict);
    if (conflict) setAnnouncement(conflict);
  };

  const commit = () => {
    if (!text.trim()) return false;
    addChips(text.split(/[,;\s]+/).map(email => ({ email })));
    setText("");
    setActiveIndex(0);
    return true;
  };

  const select = (contact: ShareAccessContact) => {
    addChips([contact]);
    setText("");
    setActiveIndex(0);
    inputRef.current?.focus();
  };

  const sendInvites = async () => {
    const valid = chips.filter(chip => chip.valid).map(chip => ({ email: chip.email, name: chip.name, src: chip.src }));
    if (!valid.length || invalidChip || sending) return;
    try {
      const pending = onInvite?.(valid, inviteRole);
      if (pending && typeof pending.then === "function") {
        setSending(true);
        await pending;
      }
    } catch {
      setSending(false);
      setNotice("Couldn’t send the invites. Try again.");
      return;
    }
    setSending(false);
    const added: ShareAccessMember[] = valid.map(person => ({ ...person, id: `invite-${person.email}`, role: inviteRole, pending: true }));
    updateMembers([...list, ...added]);
    setFlash(added.map(member => member.id));
    setChips([]);
    setNotice(null);
    setAnnouncement(`Invited ${valid.length === 1 ? valid[0].name ?? valid[0].email : `${valid.length} people`} as ${inviteRoleLabel(inviteRole)}`);
  };

  const removeChip = (key: string) => {
    const chip = chips.find(entry => entry.key === key);
    setChips(previous => previous.filter(entry => entry.key !== key));
    if (chip) setAnnouncement(`${chip.name ?? chip.email} removed`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!showSuggestions) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((active + step + suggestions.length) % suggestions.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (showSuggestions) {
        select(suggestions[active]);
        return;
      }
      if (commit()) return;
      if (!chips.length || chips.some(chip => !chip.valid)) return;
      void sendInvites();
      return;
    }
    if (event.key === "," || event.key === ";" || (event.key === " " && text.includes("@")) || (event.key === "Tab" && !!text.trim() && !event.shiftKey)) {
      if (!text.trim()) return;
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === "Escape" && (text || showSuggestions)) {
      event.preventDefault();
      event.stopPropagation();
      setText("");
      return;
    }
    if (event.key === "Backspace" && !text && chips.length) {
      event.preventDefault();
      if (armed) removeChip(chips[chips.length - 1].key);
      else setArmed(true);
      return;
    }
    setArmed(false);
  };

  const copyLink = async () => {
    try {
      await writeClipboard(link);
      setCopyState("copied");
      setAnnouncement("Link copied");
      onCopyLink?.(link);
    } catch {
      setCopyState("failed");
      setAnnouncement("Couldn’t copy the link");
    }
  };

  return (
    <section className={[styles.root, className].filter(Boolean).join(" ")} style={style} aria-label={heading}>
      <h2 className={styles.title}>{heading}</h2>
      <div className={styles.inviteArea}>
        <div className={styles.fieldWrap}>
          <div className={[styles.field, focused ? styles.fieldFocused : "", invalidChip ? styles.fieldInvalid : ""].join(" ")} onPointerDown={event => { if (event.target === event.currentTarget) { event.preventDefault(); inputRef.current?.focus(); } }}>
            <AnimatePresence initial={false} mode="popLayout">
              {chips.map((chip, index) => (
                <motion.span
                  key={chip.key}
                  layout={!reduced}
                  className={[styles.chip, chip.valid ? "" : styles.chipInvalid, armed && index === chips.length - 1 ? styles.chipArmed : ""].join(" ")}
                  initial={{ opacity: 0, scale: reduced ? 1 : 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: reduced ? 1 : 0.8, transition: { duration: reduced ? 0 : motionTokens.duration.fast, ease } }}
                  transition={spring(reduced, "snappy")}
                >
                  {chip.valid ? <Face contact={chip} size={20} /> : <CircleAlert className={styles.chipAlert} size={16} strokeWidth={1.75} aria-hidden="true" />}
                  <span className={styles.chipText}>{chip.name ?? chip.email}</span>
                  <button type="button" className={styles.chipRemove} aria-label={`Remove ${chip.name ?? chip.email}`} onClick={() => { removeChip(chip.key); setArmed(false); inputRef.current?.focus(); }}>
                    <X size={14} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>
            <motion.input
              ref={inputRef}
              layout={!reduced}
              transition={spring(reduced, "snappy")}
              className={styles.input}
              value={text}
              placeholder={chips.length ? "" : "Add people by name or email"}
              aria-label="Add people by name or email"
              role="combobox"
              aria-expanded={showSuggestions}
              aria-controls={showSuggestions ? suggestionsId : undefined}
              aria-autocomplete="list"
              aria-activedescendant={showSuggestions ? `${suggestionsId}-${active}` : undefined}
              aria-invalid={!!invalidChip}
              aria-describedby={message ? errorId : undefined}
              autoComplete="off"
              spellCheck={false}
              onChange={event => {
                setText(event.target.value);
                setActiveIndex(0);
                setArmed(false);
                if (notice && !invalidChip) setNotice(null);
              }}
              onKeyDown={onKeyDown}
              onPaste={event => {
                const pasted = event.clipboardData.getData("text");
                if (!/[,;\n\s]/.test(pasted.trim())) return;
                event.preventDefault();
                addChips(pasted.split(/[,;\n\s]+/).map(email => ({ email })));
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false);
                setArmed(false);
                if (text.includes("@")) commit();
              }}
            />
          </div>
          <AnimatePresence>
            {showSuggestions ? (
              <motion.ul
                id={suggestionsId}
                role="listbox"
                aria-label="Suggestions"
                className={styles.suggestions}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -2, scale: 0.99, transition: { duration: motionTokens.duration.fast, ease } }}
                transition={spring(reduced, "snappy")}
              >
                {suggestions.map((contact, index) => (
                  <li
                    key={contact.email}
                    id={`${suggestionsId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    className={styles.option}
                    onPointerDown={event => event.preventDefault()}
                    onPointerMove={() => setActiveIndex(index)}
                    onClick={() => select(contact)}
                  >
                    {index === active ? <motion.span layoutId={`${uid}-highlight`} className={styles.optionHighlight} transition={spring(reduced, "morph")} /> : null}
                    <Face contact={contact} size={28} />
                    <span className={styles.personText}>
                      <span className={styles.personName}>{contact.name ?? contact.email}</span>
                      <span className={styles.personMeta}>{contact.email}</span>
                    </span>
                  </li>
                ))}
              </motion.ul>
            ) : null}
          </AnimatePresence>
        </div>
        <AnimatePresence initial={false}>
          {message ? (
            <motion.p id={errorId} className={[styles.message, invalidChip ? styles.messageError : ""].join(" ")} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring(reduced, "smooth")}>
              <span className={styles.messageInner}>{message}</span>
            </motion.p>
          ) : null}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {chips.length ? (
            <motion.div className={styles.inviteRowWrap} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring(reduced, "smooth")}>
              <div className={styles.inviteRow}>
                <RoleMenu label="Invite as" value={inviteRole} options={ROLES} onChange={setInviteRole} reduced={reduced} align="start" className={styles.inviteRole}>
                  <span className={styles.inviteAs}>Invite as</span>
                </RoleMenu>
                <button type="button" className={styles.primary} onClick={() => void sendInvites()} disabled={!!invalidChip || sending} aria-busy={sending}>
                  <span className={styles.stack}>
                    <span className={sending ? styles.hidden : ""}>
                      {"Invite "}
                      {chips.length > 1 ? chips.length : null}
                    </span>
                    <span className={sending ? "" : styles.hidden} aria-hidden={!sending}>
                      Sending
                    </span>
                  </span>
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          People with access <Count value={list.length} reduced={reduced} />
        </h3>
        <ul className={styles.people}>
          <AnimatePresence initial={false}>
            {list.map(member => {
              const name = member.name ?? member.email;
              const you = member.id === selfId;
              return (
                <motion.li key={member.id} className={styles.personWrap} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring(reduced, "smooth")}>
                  <div className={[styles.person, flash.includes(member.id) ? styles.fresh : ""].join(" ")}>
                    <Face contact={member} size={32} />
                    <span className={styles.personText}>
                      <span className={styles.personName}>
                        {name}
                        {you ? <span className={styles.you}> (you)</span> : null}
                      </span>
                      <span className={styles.personMeta}>{member.pending ? `Invited · ${member.email}` : member.name ? member.email : "Guest"}</span>
                    </span>
                    {member.role === "owner" ? (
                      <span className={styles.owner}>Owner</span>
                    ) : (
                      <RoleMenu
                        label={`Role for ${name}`}
                        value={member.role}
                        options={ROLES}
                        reduced={reduced}
                        onChange={role => {
                          updateMembers(list.map(entry => (entry.id === member.id ? { ...entry, role } : entry)));
                          setAnnouncement(`${name} ${inviteRoleLabel(role)}`);
                        }}
                        onRemove={() => {
                          const index = list.findIndex(entry => entry.id === member.id);
                          updateMembers(list.filter(entry => entry.id !== member.id));
                          setUndo({ member, index });
                          setAnnouncement(`Removed ${name}`);
                        }}
                      />
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
        <AnimatePresence initial={false}>
          {undo ? (
            <motion.div key={undo.member.id} className={styles.undoWrap} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring(reduced, "smooth")}>
              <div className={styles.undo}>
                <span className={styles.undoText}>
                  {"Removed "}
                  {undo.member.name ?? undo.member.email}
                </span>
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => {
                    const next = [...list];
                    next.splice(Math.min(undo.index, next.length), 0, undo.member);
                    updateMembers(next);
                    setFlash([undo.member.id]);
                    setAnnouncement(`${undo.member.name ?? undo.member.email} has access again`);
                    setUndo(null);
                  }}
                >
                  Undo
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>General access</h3>
        <div className={styles.general}>
          <span className={styles.generalIcon} aria-hidden="true">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={accessValue}
                className={styles.iconSwap}
                initial={{ opacity: 0, scale: 0.6, rotate: reduced ? 0 : -30 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.6, rotate: reduced ? 0 : 30 }}
                transition={spring(reduced, "snappy")}
              >
                {accessValue === "link" ? <Globe size={20} strokeWidth={1.75} /> : <Lock size={20} strokeWidth={1.75} />}
              </motion.span>
            </AnimatePresence>
          </span>
          <span className={styles.generalText}>
            <RoleMenu
              label="General access"
              value={accessValue}
              options={ACCESS}
              reduced={reduced}
              align="start"
              className={styles.accessTrigger}
              onChange={next => {
                if (access === undefined) setOwnAccess(next);
                onAccessChange?.(next);
                setAnnouncement(next === "link" ? "Anyone with the link can open" : "Restricted to people with access");
              }}
            />
            <span className={styles.generalHint}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={`${accessValue}-${linkRoleValue}`} className={styles.generalHintText} initial={{ opacity: 0, y: reduced ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -4 }} transition={spring(reduced, "snappy")}>
                  {accessValue === "link" ? `Anyone who has the link ${inviteRoleLabel(linkRoleValue)}` : "Only people with access can open"}
                </motion.span>
              </AnimatePresence>
            </span>
          </span>
          <AnimatePresence initial={false}>
            {accessValue === "link" ? (
              <motion.span key="link-role" className={styles.linkRole} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring(reduced, "smooth")}>
                <motion.span className={styles.linkRoleInner} initial={{ x: reduced ? 0 : 10 }} animate={{ x: 0 }} exit={{ x: reduced ? 0 : 10 }} transition={spring(reduced, "snappy")}>
                  <RoleMenu
                    label="Link permission"
                    value={linkRoleValue}
                    options={ROLES}
                    reduced={reduced}
                    onChange={next => {
                      if (linkRole === undefined) setOwnLinkRole(next);
                      onLinkRoleChange?.(next);
                      setAnnouncement(`Anyone with the link ${inviteRoleLabel(next)}`);
                    }}
                  />
                </motion.span>
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
      <div className={styles.footer}>
        <button type="button" className={[styles.secondary, copyState === "failed" ? styles.secondaryFailed : ""].join(" ")} onClick={() => void copyLink()}>
          <span className={styles.stack}>
            {(["idle", "copied", "failed"] as const).map(key => (
              <motion.span
                key={key}
                className={styles.copyLabel}
                aria-hidden={copyState !== key}
                initial={false}
                animate={{ opacity: copyState === key ? 1 : 0, y: copyState === key ? 0 : key === "idle" ? -6 : 6, scale: copyState === key ? 1 : 0.96 }}
                transition={spring(reduced, "snappy")}
              >
                {key === "idle" ? <Link2 size={16} strokeWidth={1.75} aria-hidden="true" /> : key === "copied" ? <Check size={16} strokeWidth={1.75} aria-hidden="true" /> : <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />}
                {key === "idle" ? "Copy link" : key === "copied" ? "Link copied" : "Couldn’t copy"}
              </motion.span>
            ))}
          </span>
        </button>
        {onDone ? (
          <button type="button" className={styles.primary} onClick={onDone}>
            Done
          </button>
        ) : null}
      </div>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </span>
    </section>
  );
}

export default ShareAccess;
