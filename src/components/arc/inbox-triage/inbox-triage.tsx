"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Archive, Clock3, RotateCcw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { person } from "../lib/media";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./inbox-triage.module.css";

/** The three folders a message can sit in. */
export type InboxFolder = "inbox" | "snoozed" | "archive";

interface TriageMessage {
  id: string;
  name: string;
  photo: string;
  subject: string;
  preview: string;
  body: string;
  time: string;
  folder: InboxFolder;
  unread: boolean;
}

/** The last move, kept so the footer can announce it and undo it. */
interface MoveRecord {
  id: string;
  subject: string;
  from: InboxFolder;
  to: InboxFolder;
  unread: boolean;
}

interface RowAction {
  key: string;
  label: string;
  shortcut: string;
  icon: LucideIcon;
  to: InboxFolder;
}

const folders: readonly { value: InboxFolder; label: string }[] = [
  { value: "inbox", label: "Inbox" },
  { value: "snoozed", label: "Snoozed" },
  { value: "archive", label: "Archive" },
];

/** Confirmation copy per destination folder. */
const movedTo: Readonly<Record<InboxFolder, string>> = {
  inbox: "Moved to Inbox",
  snoozed: "Snoozed",
  archive: "Archived",
};

const sampleMessages: readonly TriageMessage[] = [
  {
    id: "emma",
    name: "Emma Collins",
    photo: person("emma-collins").src,
    subject: "The latest prototype is ready",
    preview: "I tightened the handoff flow and left a few notes for review.",
    body: "I tightened the handoff flow and added notes around the empty states. The prototype is ready for a second look when you have a moment.",
    time: "9:42 AM",
    folder: "inbox",
    unread: true,
  },
  {
    id: "marcus",
    name: "Marcus Johnson",
    photo: person("marcus-johnson").src,
    subject: "Component review for Thursday",
    preview: "Could we look at the table and menu states together?",
    body: "Could we look at the table and menu states together on Thursday? I have two small interaction questions and a short list of things that are already in good shape.",
    time: "8:18 AM",
    folder: "inbox",
    unread: true,
  },
  {
    id: "ava",
    name: "Ava Mitchell",
    photo: person("ava-mitchell").src,
    subject: "Notes from the design review",
    preview: "The team aligned on the next pass for onboarding.",
    body: "The team aligned on the next pass for onboarding. I pulled the decisions into one note so the next iteration has a clear starting point.",
    time: "Yesterday",
    folder: "inbox",
    unread: false,
  },
  {
    id: "jasmine",
    name: "Jasmine Brooks",
    photo: person("jasmine-brooks").src,
    subject: "Preview environment is ready",
    preview: "The new preview is up with the interaction fixes.",
    body: "The new preview is up with the interaction fixes. You can check the keyboard path and responsive states whenever you are ready.",
    time: "Yesterday",
    folder: "inbox",
    unread: false,
  },
  {
    id: "daniel",
    name: "Daniel Kim",
    photo: person("daniel-kim").src,
    subject: "Webhook retries are live",
    preview: "Failed deliveries now retry five times over an hour.",
    body: "Failed deliveries now retry five times over an hour, with the attempt log on each event. Nothing to do on your side unless you want a longer window.",
    time: "Tue",
    folder: "inbox",
    unread: false,
  },
  {
    id: "sofia",
    name: "Sofia Ramirez",
    photo: person("sofia-ramirez").src,
    subject: "A time for our next check-in",
    preview: "Moving this to next week so we can review the final pass.",
    body: "Moving this to next week so we can review the final pass together. I will share a short agenda before we meet.",
    time: "Mon",
    folder: "snoozed",
    unread: false,
  },
];

/**
 * An inbox with Inbox, Snoozed, and Archive tabs, rows that expand in place, an Unread filter,
 * archive/snooze/restore actions with single-key shortcuts, and an undo for the last move.
 */
export function InboxTriage() {
  const uid = useId();
  const reduced = !!useReducedMotion();
  const [messages, setMessages] = useState<TriageMessage[]>(() => sampleMessages.map(message => ({ ...message })));
  const [folder, setFolder] = useState<InboxFolder>("inbox");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<MoveRecord | null>(null);
  const rows = useRef(new Map<string, HTMLButtonElement>());
  const title = useRef<HTMLHeadingElement>(null);
  /** The row to focus once the list has re-rendered, or "title" when the list emptied. */
  const focusTarget = useRef<string | null>(null);

  const visible = messages.filter(
    message => message.folder === folder && (folder !== "inbox" || !unreadOnly || message.unread),
  );
  const unread = messages.filter(message => message.folder === "inbox" && message.unread).length;
  const rowTransition = reduced ? { duration: 0 } : motionTokens.spring.smooth;

  /** Moves a message to another folder and remembers where focus should land next. */
  function move(message: TriageMessage, to: InboxFolder) {
    const index = visible.findIndex(item => item.id === message.id);
    const next = visible[index + 1] ?? visible[index - 1];
    setMessages(current =>
      current.map(item =>
        item.id === message.id ? { ...item, folder: to, unread: to === "inbox" && item.unread } : item,
      ),
    );
    setLastMove({ id: message.id, subject: message.subject, from: message.folder, to, unread: message.unread });
    setOpenId(null);
    focusTarget.current = next ? next.id : "title";
  }

  function selectFolder(next: InboxFolder) {
    setFolder(next);
    setOpenId(null);
  }

  // Runs after every render so an action can hand focus to the next row without extra timers.
  useEffect(() => {
    const target = focusTarget.current;
    if (!target) return;
    focusTarget.current = null;
    if (target === "title") title.current?.focus();
    else rows.current.get(target)?.focus();
  });

  const archiveAction: RowAction = { key: "archive", label: "Archive", shortcut: "E", icon: Archive, to: "archive" };
  const actions: RowAction[] =
    folder === "inbox"
      ? [{ key: "snooze", label: "Snooze", shortcut: "S", icon: Clock3, to: "snoozed" }, archiveAction]
      : [
          { key: "restore", label: "Move to Inbox", shortcut: "U", icon: RotateCcw, to: "inbox" },
          ...(folder === "snoozed" ? [archiveAction] : []),
        ];

  const empty =
    folder === "inbox" && unreadOnly
      ? { title: "Nothing unread", body: "You are caught up.", action: "Show all" }
      : folder === "inbox"
        ? { title: "Inbox zero", body: "Archived messages stay searchable.", action: "View archive" }
        : folder === "snoozed"
          ? {
              title: "Nothing snoozed",
              body: "Snoozed messages wait here until you bring them back.",
              action: "Back to inbox",
            }
          : { title: "Archive is empty", body: "Messages you archive land here.", action: "Back to inbox" };

  function onTabsKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = folders.findIndex(item => item.value === folder);
    const next = folders[(index + (event.key === "ArrowRight" ? 1 : folders.length - 1)) % folders.length];
    selectFolder(next.value);
    event.currentTarget.querySelector<HTMLElement>(`[data-folder="${next.value}"]`)?.focus();
  }

  function onRowKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, message: TriageMessage) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "arrowdown" || key === "arrowup") {
      event.preventDefault();
      const index = visible.findIndex(item => item.id === message.id);
      const next = visible[index + (key === "arrowdown" ? 1 : -1)];
      if (next) rows.current.get(next.id)?.focus();
    } else if (key === "e" && folder !== "archive") {
      event.preventDefault();
      move(message, "archive");
    } else if (key === "s" && folder === "inbox") {
      event.preventDefault();
      move(message, "snoozed");
    } else if (key === "u" && folder !== "inbox") {
      event.preventDefault();
      move(message, "inbox");
    }
  }

  return (
    <section className={styles.triage} aria-labelledby={`${uid}-title`}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 id={`${uid}-title`} ref={title} tabIndex={-1}>
            Messages
          </h2>
          <span className={styles.unreadCount}>{unread} unread</span>
          <button
            type="button"
            className={styles.filter}
            aria-pressed={unreadOnly}
            disabled={folder !== "inbox"}
            onClick={() => {
              setUnreadOnly(value => !value);
              setOpenId(null);
            }}
          >
            <span className={styles.filterDot} aria-hidden="true" />
            Unread only
          </button>
        </div>
        <div className={styles.tabs} role="tablist" aria-label="Folders" onKeyDown={onTabsKeyDown}>
          {folders.map(item => {
            const selected = item.value === folder;
            const count = messages.filter(message => message.folder === item.value).length;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                data-folder={item.value}
                aria-selected={selected}
                aria-controls={`${uid}-list`}
                tabIndex={selected ? 0 : -1}
                className={styles.tab}
                onClick={() => selectFolder(item.value)}
              >
                {item.label}
                <span className={styles.tabCount}>{count}</span>
                {selected && (
                  <motion.span
                    layoutId={`${uid}-tab`}
                    className={styles.tabIndicator}
                    transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
                  />
                )}
              </button>
            );
          })}
        </div>
      </header>
      <div
        id={`${uid}-list`}
        className={styles.list}
        role="tabpanel"
        aria-label={`${folders.find(item => item.value === folder)?.label} messages`}
      >
        <motion.div
          key={folder}
          className={styles.panel}
          initial={!reduced && { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduced ? 0 : motionTokens.duration.fast }}
        >
          <AnimatePresence initial={false}>
            {visible.map(message => {
              const open = openId === message.id;
              return (
                <motion.article
                  key={message.id}
                  className={`${styles.message} ${message.unread ? styles.unread : ""} ${open ? styles.open : ""}`}
                  initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
                  transition={rowTransition}
                >
                  <div className={styles.row}>
                    <button
                      ref={node => {
                        if (node) rows.current.set(message.id, node);
                        else rows.current.delete(message.id);
                      }}
                      className={styles.trigger}
                      type="button"
                      aria-expanded={open}
                      aria-controls={open ? `${uid}-${message.id}-detail` : undefined}
                      aria-keyshortcuts={folder === "inbox" ? "E S" : folder === "snoozed" ? "U E" : "U"}
                      onClick={() => {
                        if (openId === message.id) setOpenId(null);
                        else {
                          setOpenId(message.id);
                          if (message.unread) {
                            setMessages(current =>
                              current.map(item => (item.id === message.id ? { ...item, unread: false } : item)),
                            );
                          }
                        }
                      }}
                      onKeyDown={event => onRowKeyDown(event, message)}
                    >
                      <span className={styles.dot} aria-hidden="true" />
                      <Avatar name={message.name} src={message.photo} size="sm" className={styles.avatar} />
                      <span className={styles.sender}>
                        {message.name}
                        {message.unread && <span className={styles.srOnly}>, unread</span>}
                      </span>
                      <span className={styles.summary}>
                        <span className={styles.subject}>{message.subject}</span>
                        <span className={styles.preview}>{message.preview}</span>
                      </span>
                      <time className={styles.time}>{message.time}</time>
                    </button>
                    <span className={styles.quick}>
                      {actions.map(action => (
                        <button
                          key={action.key}
                          type="button"
                          className={styles.quickButton}
                          aria-label={`${action.label}: ${message.subject}`}
                          title={`${action.label} (${action.shortcut})`}
                          tabIndex={-1}
                          onClick={() => move(message, action.to)}
                        >
                          <action.icon size={16} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      ))}
                    </span>
                  </div>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        id={`${uid}-${message.id}-detail`}
                        className={styles.detail}
                        initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
                        transition={rowTransition}
                      >
                        <div className={styles.detailInner}>
                          <p>{message.body}</p>
                          <div className={styles.detailActions}>
                            {actions.map((action, index) => (
                              <Button
                                key={action.key}
                                type="button"
                                variant={index === 0 ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => move(message, action.to)}
                              >
                                <action.icon size={15} strokeWidth={1.75} aria-hidden="true" />
                                {action.label}
                                <kbd className={styles.kbd}>{action.shortcut}</kbd>
                              </Button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.article>
              );
            })}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {visible.length === 0 && (
              <motion.div
                key="empty"
                className={styles.empty}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: reduced ? 0 : motionTokens.duration.exit } }}
                transition={{
                  duration: reduced ? 0 : motionTokens.duration.standard,
                  ease: [...motionTokens.ease.standard],
                }}
              >
                <p>{empty.title}</p>
                <span>{empty.body}</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (folder === "inbox" && unreadOnly) setUnreadOnly(false);
                    else selectFolder(folder === "inbox" ? "archive" : "inbox");
                  }}
                >
                  {empty.action}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      <footer className={styles.footer}>
        <p role="status" aria-live="polite" className={styles.status}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={lastMove ? `${lastMove.id}-${lastMove.to}` : "idle"}
              className={styles.statusText}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -6, transition: { duration: motionTokens.duration.fast } }}
              transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
            >
              {lastMove ? (
                <>
                  {movedTo[lastMove.to]} <span className={styles.statusSubject}>{lastMove.subject}</span>
                </>
              ) : (
                <>
                  <span className={styles.hint}>
                    {actions.map(action => (
                      <span key={action.key}>
                        <kbd className={styles.kbd}>{action.shortcut}</kbd>
                        {action.label.toLowerCase()}
                      </span>
                    ))}
                  </span>
                  <span className={styles.hintNarrow}>
                    Open a message to {folder === "inbox" ? "snooze or archive it" : "move it"}
                  </span>
                </>
              )}
            </motion.span>
          </AnimatePresence>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={styles.undo}
          onClick={() => {
            if (!lastMove) return;
            setMessages(current =>
              current.map(item =>
                item.id === lastMove.id ? { ...item, folder: lastMove.from, unread: lastMove.unread } : item,
              ),
            );
            if (lastMove.from !== folder) setFolder(lastMove.from);
            setLastMove(null);
            focusTarget.current = lastMove.id;
          }}
          disabled={!lastMove}
          aria-hidden={!lastMove}
          tabIndex={lastMove ? 0 : -1}
        >
          <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
          Undo
        </Button>
      </footer>
    </section>
  );
}

export default InboxTriage;
