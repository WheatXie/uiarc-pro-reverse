"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Trash2 } from "lucide-react";
import Button from "../button/button";
import { motionTokens } from "../motion-tokens";
import { person } from "../lib/media";
import BlackHole from "./black-hole";
import type { BlackHoleHandle } from "./black-hole";
import styles from "./demo.module.css";

export const meta = "Live · component";

interface Message {
  id: string;
  from: { name: string; src: string };
  subject: string;
  time: string;
}

const INBOX: Message[] = [
  { id: "a", from: person("emma-collins"), subject: "Onboarding copy, second pass", time: "9:41" },
  { id: "b", from: person("marcus-johnson"), subject: "Your weekly usage report", time: "9:12" },
  { id: "c", from: person("jasmine-brooks"), subject: "Design review moved to Thursday", time: "8:30" },
  { id: "d", from: person("olivia-bennett"), subject: "Invoice 2381 is ready", time: "Yesterday" },
  { id: "e", from: person("sofia-ramirez"), subject: "Quarterly planning notes", time: "Yesterday" },
];

/** An inbox where the selected rows are pulled into a singularity; undo spins them back out. */
export function BlackHoleDemo() {
  const reduced = useReducedMotion();
  const hole = useRef<BlackHoleHandle>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const [messages, setMessages] = useState(INBOX);
  const [selected, setSelected] = useState(["b", "d"]);
  const [deleted, setDeleted] = useState<Message[]>([]);
  const [restore, setRestore] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!selected.length || busy) return;
    setBusy(true);
    const nodes = selected.map((id) => rows.current.get(id)).filter((node): node is HTMLLIElement => !!node);
    await hole.current?.swallow(nodes);
    setDeleted(INBOX.filter((message) => selected.includes(message.id)));
    setMessages((current) => current.filter((message) => !selected.includes(message.id)));
    setSelected([]);
    setBusy(false);
  };

  useLayoutEffect(() => {
    if (!restore.length) return;
    const nodes = restore
      .map((id) => rows.current.get(id))
      .filter((node): node is HTMLLIElement => !!node);
    void hole.current?.release(nodes).then(() => {
      setRestore([]);
      setBusy(false);
    });
  }, [restore]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if ((event.key === "Backspace" || event.key === "Delete") && selected.length && target?.closest?.("[data-inbox]")) {
        event.preventDefault();
        void remove();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const collapse = reduced ? { duration: 0 } : motionTokens.spring.smooth;

  return (
    <div className={styles.demo} data-inbox>
      <div className={styles.panel}>
        <div className={styles.head}>
          <span className={styles.title}>Inbox</span>
          <AnimatePresence initial={false} mode="popLayout">
            {selected.length > 0 && (
              <motion.div
                key="delete"
                initial={{ opacity: 0, scale: 0.96, filter: "blur(4px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.96, filter: "blur(4px)" }}
                transition={{ duration: motionTokens.duration.fast }}
              >
                <Button variant="secondary" size="sm" onClick={remove} disabled={busy}>
                  <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                  Delete {selected.length}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <BlackHole ref={hole}>
          <ul className={styles.list}>
            <AnimatePresence initial={false}>
              {messages.map((message) => {
                const on = selected.includes(message.id);
                return (
                  <motion.li
                    key={message.id}
                    ref={(node) => {
                      if (node) rows.current.set(message.id, node);
                      else rows.current.delete(message.id);
                    }}
                    className={styles.item}
                    layout="position"
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    transition={{ height: collapse, layout: collapse }}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      className={styles.row}
                      data-on={on || undefined}
                      onClick={() =>
                        setSelected((current) =>
                          current.includes(message.id)
                            ? current.filter((id) => id !== message.id)
                            : [...current, message.id],
                        )
                      }
                      disabled={busy}
                    >
                      <span className={styles.check} aria-hidden>
                        {on && <Check size={12} strokeWidth={2.5} />}
                      </span>
                      <img
                        className={styles.avatar}
                        src={message.from.src}
                        alt=""
                        width={32}
                        height={32}
                        draggable={false}
                      />
                      <span className={styles.text}>
                        <span className={styles.name}>{message.from.name}</span>
                        <span className={styles.subject}>{message.subject}</span>
                      </span>
                      <span className={styles.time}>{message.time}</span>
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </BlackHole>
      </div>

      <div className={styles.status}>
        <AnimatePresence initial={false}>
          {deleted.length > 0 && (
            <motion.div
              key="toast"
              className={styles.toast}
              initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 4, filter: "blur(4px)" }}
              transition={motionTokens.spring.smooth}
            >
              <span role="status">
                {deleted.length === 1
                  ? "1 conversation deleted"
                  : `${deleted.length} conversations deleted`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!deleted.length || busy) return;
                  const ids = deleted.map((message) => message.id);
                  setBusy(true);
                  setMessages((current) =>
                    INBOX.filter(
                      (message) => ids.includes(message.id) || current.some((row) => row.id === message.id),
                    ),
                  );
                  setRestore(ids);
                  setDeleted([]);
                }}
              >
                Undo
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default BlackHoleDemo;
