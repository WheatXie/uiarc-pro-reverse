"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUp,
  Check,
  FileText,
  Paperclip,
  RotateCcw,
  Settings2,
} from "lucide-react";

import { avatar } from "../lib/media";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./support-conversation.module.css";

/** A file the visitor attached to a message. */
interface Attachment {
  /** File name, shown next to the paperclip glyph. */
  name: string;
  /** Pre-formatted size, e.g. `"48 KB"`. */
  size: string;
}

/** One bubble in the thread. */
interface Message {
  id: number;
  sender: "you" | "agent";
  text: string;
  time: string;
  /** Only set on the visitor's own messages. */
  status?: "sent" | "read";
  attachment?: Attachment;
}

export interface SupportConversationProps {
  /** Called with each message the user sends. */
  onSend?: (message: string) => void;
  /** Called when the conversation is marked resolved or reopened. */
  onResolve?: (resolved: boolean) => void;
}

const initialMessages: Message[] = [
  {
    id: 1,
    sender: "you",
    text: "The charts in my PDF export look small. Is there a way to make them larger?",
    time: "10:42",
    status: "read",
  },
  {
    id: 2,
    sender: "agent",
    text: "Yes, the Presentation page size gives charts more room. I can walk you through it.",
    time: "10:43",
  },
  {
    id: 3,
    sender: "you",
    text: "That would be great. I need to send this report to the board today.",
    time: "10:44",
    status: "read",
  },
];

const suggestions = ["Show me the steps", "Do links stay clickable?"];

const avatarSrc = avatar("ava-mitchell");

/** Clock label for a freshly sent message. */
function nowTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Shared entrance/exit preset for the composer's two states. */
function fade(reduce: boolean) {
  return {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        duration: reduce ? 0 : motionTokens.duration.standard,
        ease: motionTokens.ease.enter,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        duration: reduce ? 0 : motionTokens.duration.fast,
        ease: motionTokens.ease.standard,
      },
    },
  };
}

interface AutoHeightProps {
  children: ReactNode;
  className?: string;
  reduce: boolean;
}

/** Animates its own height to whatever the child currently measures. */
function AutoHeight({ children, className, reduce }: AutoHeightProps) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  useEffect(() => {
    const element = inner.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) =>
      setHeight(entry.borderBoxSize?.[0]?.blockSize ?? element.offsetHeight),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      className={styles.autoHeight}
      initial={false}
      animate={{ height }}
      transition={reduce ? { duration: 0 } : motionTokens.spring.smooth}
    >
      <div ref={inner} className={className}>
        {children}
      </div>
    </motion.div>
  );
}

/**
 * Support conversation thread with a simulated agent reply, attachment intake
 * and a resolve/reopen toggle.
 */
export function SupportConversation({
  onSend,
  onResolve,
}: SupportConversationProps) {
  const reduce = useReducedMotion();
  const fieldId = useId();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [status, setStatus] = useState("");
  const thread: RefObject<HTMLDivElement | null> = useRef(null);
  const scrolled = useRef(false);
  const pending = useRef(0);
  const timers = useRef<number[]>([]);
  const nextId = useRef(4);
  const fileInput = useRef<HTMLInputElement>(null);

  function send(text: string, attachment?: Attachment) {
    const trimmed = text.trim();
    if ((!trimmed && !attachment) || resolved) return;

    setMessages(list => [
      ...list,
      {
        id: nextId.current++,
        sender: "you",
        text: trimmed || "I’ve attached the report for context.",
        time: nowTime(),
        status: "sent",
        attachment,
      },
    ]);
    setDraft("");
    setStatus(
      attachment
        ? `${attachment.name} attached. Ava is replying.`
        : "Message sent. Ava is replying.",
    );
    onSend?.(trimmed || attachment?.name || "Attachment sent");

    const prompt = (trimmed || "I attached a file").toLowerCase();
    const reply = prompt.includes("link")
      ? "Yes. Links in text and chart annotations stay clickable. Turn on Include links before downloading."
      : prompt.includes("thank") || prompt.includes("worked")
        ? "Happy to help. I’ll keep this thread open in case the board report needs another pass."
        : prompt.includes("file") || prompt.includes("attach")
          ? "Thanks for sending that over. I can see the report and the export settings look ready for a wider layout."
          : "Open Export, choose PDF, then set Page size to Presentation. Your charts will use the wider layout automatically.";

    pending.current += 1;
    setTyping(true);
    const timer = window.setTimeout(
      () => {
        setMessages(list => [
          ...list,
          {
            id: nextId.current++,
            sender: "agent",
            text: reply,
            time: nowTime(),
          },
        ]);
        pending.current -= 1;
        setTyping(pending.current > 0);
        setStatus("Ava replied.");
        timers.current = timers.current.filter(id => id !== timer);
      },
      reduce ? 240 : 1050,
    );
    timers.current.push(timer);
  }

  useEffect(() => {
    const element = thread.current;
    if (!element) return;
    if (!scrolled.current) {
      scrolled.current = true;
      return;
    }
    element.scrollTo({
      top: element.scrollHeight,
      behavior: reduce ? "instant" : "smooth",
    });
  }, [messages, typing, reduce]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  return (
    <section className={styles.surface} aria-label="Support conversation">
      <header className={styles.header}>
        <Image
          className={styles.headerPortrait}
          src={avatarSrc}
          width={32}
          height={32}
          alt=""
        />
        <div className={styles.headerText}>
          <h2>Exporting charts</h2>
          <span>Ava from support · Usually replies in 5 min</span>
        </div>
        <button
          className={`${styles.resolve} ${resolved ? styles.resolved : ""}`}
          type="button"
          onClick={() => {
            const next = !resolved;
            if (next) {
              timers.current.forEach(window.clearTimeout);
              timers.current = [];
              pending.current = 0;
              setTyping(false);
            }
            setResolved(next);
            setStatus(
              next
                ? "Conversation marked resolved."
                : "Conversation reopened.",
            );
            onResolve?.(next);
          }}
        >
          {resolved ? (
            <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Check size={14} strokeWidth={1.75} aria-hidden="true" />
          )}
          {resolved ? "Reopen" : "Resolve"}
        </button>
      </header>

      <div className={styles.thread} ref={thread}>
        <div className={styles.dateDivider}>
          <span>Today</span>
        </div>
        <AnimatePresence initial={false}>
          {messages.map(message => (
            <motion.div
              key={message.id}
              className={`${styles.messageRow} ${
                message.sender === "you" ? styles.yours : styles.theirs
              }`}
              initial={!reduce && { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={reduce ? { duration: 0 } : motionTokens.spring.gentle}
            >
              {message.sender === "agent" && (
                <Image
                  className={styles.portrait}
                  src={avatarSrc}
                  width={28}
                  height={28}
                  alt="Ava"
                />
              )}
              <div className={styles.messageBody}>
                <div className={styles.messageMeta}>
                  <strong>{message.sender === "agent" ? "Ava" : "You"}</strong>
                  <span>{message.time}</span>
                </div>
                <p>{message.text}</p>
                {message.attachment && (
                  <div className={styles.attachment}>
                    <FileText size={16} strokeWidth={1.75} aria-hidden="true" />
                    <span>
                      <strong>{message.attachment.name}</strong>
                      <small>{message.attachment.size} · PDF</small>
                    </span>
                  </div>
                )}
                {message.sender === "agent" && message.id === 2 && (
                  <button
                    className={styles.contextAction}
                    type="button"
                    onClick={() => setSettingsOpen(open => !open)}
                  >
                    <Settings2 size={14} strokeWidth={1.75} aria-hidden="true" />
                    {settingsOpen ? "Hide export settings" : "View export settings"}
                  </button>
                )}
                {message.sender === "agent" && message.id === 2 && (
                  <AnimatePresence initial={false}>
                    {settingsOpen && (
                      <motion.div
                        key="settings"
                        className={styles.settingsWrap}
                        initial={!reduce && { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={
                          reduce ? { duration: 0 } : motionTokens.spring.smooth
                        }
                      >
                        <div className={styles.settings}>
                          <div>
                            <strong>PDF export settings</strong>
                            <span>Page size · Presentation</span>
                          </div>
                          <div>
                            <strong>Include links</strong>
                            <span>On</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
                {message.sender === "you" && message.status && (
                  <span className={styles.delivery}>
                    {message.status === "read" ? "Read" : "Sent"} · {message.time}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {typing && !resolved && (
          <motion.div
            className={`${styles.messageRow} ${styles.theirs}`}
            initial={!reduce && { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduce ? { duration: 0 } : motionTokens.spring.responsive
            }
          >
            <Image
              className={styles.portrait}
              src={avatarSrc}
              width={28}
              height={28}
              alt=""
            />
            <div className={styles.typing} aria-label="Ava is typing">
              <span />
              <span />
              <span />
              <span className={styles.srOnly}>Ava is typing</span>
            </div>
          </motion.div>
        )}
      </div>

      <AutoHeight className={styles.composeArea} reduce={!!reduce}>
        <AnimatePresence mode="popLayout" initial={false}>
          {resolved ? (
            <motion.div
              key="resolved"
              className={styles.resolvedNotice}
              {...fade(!!reduce)}
            >
              <Check size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>
                Conversation resolved. Reopen it to ask another question.
              </span>
            </motion.div>
          ) : (
            <motion.div key="compose" {...fade(!!reduce)}>
              <div className={styles.suggestions}>
                {suggestions.map(label => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => send(label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <form
                className={styles.composer}
                onSubmit={event => {
                  event.preventDefault();
                  send(draft);
                }}
              >
                <label className={styles.srOnly} htmlFor={fieldId}>
                  Write a message
                </label>
                <input
                  id={fieldId}
                  type="text"
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  placeholder="Write a reply"
                />
                <input
                  ref={fileInput}
                  className={styles.srOnly}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    send("", {
                      name: file.name,
                      size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
                    });
                    event.target.value = "";
                  }}
                  aria-label="Attach a PDF"
                />
                <button
                  className={styles.attach}
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  aria-label="Attach a PDF"
                >
                  <Paperclip size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button
                  className={styles.send}
                  type="submit"
                  disabled={!draft.trim()}
                  aria-label="Send message"
                >
                  <ArrowUp size={16} strokeWidth={2} aria-hidden="true" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </AutoHeight>

      <span className={styles.srOnly} role="status" aria-live="polite">
        {status}
      </span>
    </section>
  );
}

export default SupportConversation;
