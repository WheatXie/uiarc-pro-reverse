"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BellRing, Check, ListTodo, StickyNote } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import SegmentedControl from "../segmented-control/segmented-control";
import ActionMorph, { type ActionMorphAction } from "./action-morph";
import styles from "./action-morph.module.css";

export const meta = "Live · component";

const ICON = { strokeWidth: 1.75 };

type Kind = "task" | "note" | "reminder";

interface Entry {
  id: number;
  kind: Kind;
  text: string;
  meta?: string;
  done?: boolean;
}

const ACTIONS: ActionMorphAction[] = [
  {
    id: "task",
    label: "Task",
    description: "Add to your list",
    icon: <ListTodo {...ICON} />,
    shortcut: "t",
    composer: {
      title: "New task",
      placeholder: "What needs doing?",
      choices: { label: "Due", options: ["Today", "Tomorrow", "Next week"] },
      submitLabel: "Add task",
      successLabel: "Task added",
      emptyHint: "Give the task a title",
    },
  },
  {
    id: "note",
    label: "Note",
    description: "Private to you",
    icon: <StickyNote {...ICON} />,
    shortcut: "n",
    composer: {
      title: "New note",
      placeholder: "Write it down",
      multiline: true,
      submitLabel: "Save note",
      successLabel: "Note saved",
      emptyHint: "The note is empty",
    },
  },
  {
    id: "reminder",
    label: "Reminder",
    description: "Nudge me at a set time",
    icon: <BellRing {...ICON} />,
    shortcut: "r",
    composer: {
      title: "New reminder",
      placeholder: "Remind me to…",
      choices: { label: "When", options: ["In 1 hour", "5:00 PM", "Tomorrow"], defaultIndex: 1 },
      submitLabel: "Set reminder",
      successLabel: "Reminder set",
      emptyHint: "Say what to remind you about",
    },
  },
];

const INITIAL: Entry[] = [
  { id: 4, kind: "task", text: "Review Emma’s onboarding flow", meta: "Today" },
  { id: 3, kind: "reminder", text: "Call Andre about the Q3 budget", meta: "4:30 PM" },
  { id: 2, kind: "task", text: "Send launch notes to Diane", meta: "Tomorrow", done: true },
  { id: 1, kind: "note", text: "Pricing page: lead with the free tier" },
];

const SAVE_OPTIONS = [
  { value: "succeed", label: "Saving works" },
  { value: "fail", label: "Saving fails" },
];

function kindIcon(kind: Kind): ReactNode {
  if (kind === "note") return <StickyNote size={16} {...ICON} />;
  return <BellRing size={16} {...ICON} />;
}

export default function ActionMorphDemo() {
  const reduced = Boolean(useReducedMotion());
  const [entries, setEntries] = useState<Entry[]>(INITIAL);
  const [save, setSave] = useState("succeed");
  const open = entries.filter((entry) => entry.kind === "task" && !entry.done).length;

  return (
    <div className={styles.demo}>
      <div className={styles.stage}>
        <header className={styles.stageHeader}>
          <h3 className={styles.stageTitle}>Today</h3>
          <p className={styles.count} aria-live="polite">
            <span className={styles.number}>{open}</span> open {open === 1 ? "task" : "tasks"}
          </p>
        </header>
        <ul className={styles.list}>
          <AnimatePresence initial={false}>
            {entries.map((entry) => (
              <motion.li
                key={entry.id}
                layout={reduced ? false : "position"}
                className={styles.listItem}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0 }}
                transition={reduced ? { duration: 0.15 } : motionTokens.spring.smooth}
              >
                {entry.kind === "task" ? (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={Boolean(entry.done)}
                    aria-label={`Mark “${entry.text}” done`}
                    className={styles.check}
                    data-on={entry.done || undefined}
                    onClick={() =>
                      setEntries((current) =>
                        current.map((candidate) =>
                          candidate.id === entry.id ? { ...candidate, done: !candidate.done } : candidate,
                        ),
                      )
                    }
                  >
                    <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                ) : (
                  <span className={styles.kind} aria-hidden="true">
                    {kindIcon(entry.kind)}
                  </span>
                )}
                <span className={styles.text} data-done={entry.done || undefined}>
                  {entry.text}
                </span>
                {entry.meta && <span className={styles.meta}>{entry.meta}</span>}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <div className={styles.corner}>
          <ActionMorph
            actions={ACTIONS}
            label="Create"
            onSubmit={({ action, text, choice }) =>
              new Promise<void>((resolve, reject) => {
                window.setTimeout(() => {
                  if (save === "fail") {
                    reject(new Error("Simulated failure"));
                    return;
                  }
                  setEntries((current) => [
                    { id: Math.max(0, ...current.map((entry) => entry.id)) + 1, kind: action as Kind, text, meta: choice },
                    ...current,
                  ]);
                  resolve();
                }, 650);
              })
            }
          />
        </div>
      </div>
      <div className={styles.controls}>
        <SegmentedControl label="Save result" options={SAVE_OPTIONS} value={save} onValueChange={setSave} />
      </div>
    </div>
  );
}
