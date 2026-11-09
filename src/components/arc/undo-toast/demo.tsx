/**
 * Undo toast demo — reconstructed from the Pro preview chunk: an inbox of six conversations where
 * archiving or deleting folds the row away and raises one toast with a six second countdown.
 * Removing another row inside that window merges into the same toast; Undo or ⌘Z puts every row
 * back in place. The inbox refills from the header button once something has been removed.
 */
import { useState } from "react";
import { Archive, Inbox, RotateCcw, Trash2 } from "lucide-react";
import { UndoToast, UndoToastRow, UndoToastRowAction } from "./undo-toast";
import styles from "./undo-toast.module.css";

interface Thread {
  id: string;
  name: string;
  avatar: string;
  subject: string;
  preview: string;
  time: string;
  unread?: boolean;
}

const THREADS: Thread[] = [
  {
    id: "c1",
    name: "Emma Collins",
    avatar: "/media/people/portrait/emma-collins.svg",
    subject: "Brand review moved to Thursday",
    preview: "I pushed it to 2 pm so Daniel can join from Lisbon.",
    time: "9:41",
    unread: true,
  },
  {
    id: "c2",
    name: "Daniel Kim",
    avatar: "/media/people/portrait/daniel-kim.svg",
    subject: "Invoice 2041 for September",
    preview: "Updated with the corrected VAT number, same total.",
    time: "9:12",
    unread: true,
  },
  {
    id: "c3",
    name: "Sofia Ramirez",
    avatar: "/media/people/portrait/sofia-ramirez.svg",
    subject: "Offsite rooms are confirmed",
    preview: "All twelve rooms are held until Friday at noon.",
    time: "8:30",
  },
  {
    id: "c4",
    name: "Marcus Johnson",
    avatar: "/media/people/portrait/marcus-johnson.svg",
    subject: "Notes from the checkout crit",
    preview: "Three small fixes and one bigger question about tax.",
    time: "Mon",
  },
  {
    id: "c5",
    name: "Olivia Bennett",
    avatar: "/media/people/portrait/olivia-bennett.svg",
    subject: "Signed agreement attached",
    preview: "Countersigned and filed. Welcome aboard.",
    time: "Sun",
  },
  {
    id: "c6",
    name: "Nathan Cole",
    avatar: "/media/people/portrait/nathan-cole.svg",
    subject: "Access to the design repo",
    preview: "Approved for read access, ping me for write.",
    time: "Sat",
  },
];

export default function UndoToastDemo() {
  const [threads, setThreads] = useState<Thread[]>(THREADS);
  const refilled = threads.length < THREADS.length;

  return (
    <div className={styles.demo}>
      <section className={styles.card} aria-labelledby="undo-toast-demo-title">
        <header className={styles.header}>
          <h3 id="undo-toast-demo-title" className={styles.heading}>
            Inbox
          </h3>
          <button
            type="button"
            className={styles.reset}
            onClick={() => setThreads(THREADS)}
            disabled={!refilled}
            aria-hidden={!refilled}
            tabIndex={refilled ? 0 : -1}
            data-visible={refilled || undefined}
          >
            <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
            Refill inbox
          </button>
        </header>
        <UndoToast
          className={styles.inbox}
          label="Conversations"
          items={threads}
          onItemsChange={setThreads}
          getKey={(thread) => thread.id}
          noun={["conversation", "conversations"]}
          onCommit={() => new Promise<void>((resolve) => setTimeout(resolve, 420))}
          empty={
            <div className={styles.emptyState}>
              <Inbox size={20} strokeWidth={1.75} aria-hidden="true" />
              <span>All caught up</span>
            </div>
          }
          renderItem={(thread, { remove }) => (
            <UndoToastRow
              label={`${thread.name}, ${thread.subject}`}
              unread={thread.unread}
              leading={
                <img
                  className={styles.avatar}
                  src={thread.avatar}
                  alt=""
                  width={36}
                  height={36}
                  draggable={false}
                />
              }
              title={
                <span className={styles.titleLine}>
                  <span className={styles.name}>{thread.name}</span>
                  <span className={styles.subject}>{thread.subject}</span>
                </span>
              }
              description={thread.preview}
              meta={thread.time}
              shortcuts={{
                e: () => remove("archive"),
                Backspace: () => remove("delete"),
                Delete: () => remove("delete"),
              }}
              actions={
                <>
                  <UndoToastRowAction
                    label="Archive"
                    icon={<Archive size={16} strokeWidth={1.75} aria-hidden="true" />}
                    onClick={() => remove("archive")}
                  />
                  <UndoToastRowAction
                    label="Delete"
                    icon={<Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />}
                    onClick={() => remove("delete")}
                  />
                </>
              }
            />
          )}
        />
      </section>
      <p className={styles.note}>Archive a few in a row, then undo with the button or ⌘Z. Nothing is sent.</p>
    </div>
  );
}

export const meta = "Live · keyboard ready · ⌘Z undo";
