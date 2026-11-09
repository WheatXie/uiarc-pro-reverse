/**
 * Emoji picker demo — reconstructed from the Pro preview chunk: a launch-channel thread with a
 * composer; the picker sits in a top-anchored popover and inserts at the textarea caret.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, SmilePlus } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "../popover/popover";
import { EmojiPicker, type EmojiSelection } from "./emoji-picker";
import styles from "./demo.module.css";

interface Message {
  id: number;
  author: string;
  photo: string;
  text: string;
}

const SEED: Message[] = [
  {
    id: 1,
    author: "Jordan Reyes",
    photo: "/media/people/jordan-reyes.svg",
    text: "Launch checklist is green. Shipping the pricing page at 3pm unless anyone objects.",
  },
  {
    id: 2,
    author: "Chloe Nguyen",
    photo: "/media/people/chloe-nguyen.svg",
    text: "Copy is final and the screenshots are swapped in.",
  },
];

export const meta = "Live · keyboard ready";

export default function EmojiPickerDemo() {
  const [messages, setMessages] = useState<Message[]>(SEED);
  const [draft, setDraft] = useState("Looks great, ship it ");
  const [open, setOpen] = useState(false);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const caretRef = useRef<number | null>(null);
  const rangeRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const listRef = useRef<HTMLOListElement>(null);

  useLayoutEffect(() => {
    const node = fieldRef.current;
    if (node && caretRef.current !== null) node.setSelectionRange(caretRef.current, caretRef.current);
  }, [draft]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((current) => [...current, { id: Date.now(), author: "You", photo: "/media/people/emma-collins.svg", text }]);
    setDraft("");
    caretRef.current = 0;
    rangeRef.current = { start: 0, end: 0 };
    requestAnimationFrame(() => listRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" }));
  };

  const insert = (emoji: string) => {
    const { start, end } = rangeRef.current ?? { start: draft.length, end: draft.length };
    const caret = start + emoji.length;
    caretRef.current = caret;
    rangeRef.current = { start: caret, end: caret };
    setDraft((current) => current.slice(0, start) + emoji + current.slice(end));
  };

  return (
    <div className={styles.demo}>
      <section className={styles.thread} aria-label="Launch channel">
        <ol ref={listRef} className={styles.messages}>
          {messages.map((message) => (
            <li key={message.id} className={styles.message}>
              <Avatar name={message.author} src={message.photo} size="sm" />
              <div className={styles.body}>
                <span className={styles.author}>{message.author}</span>
                <p className={styles.text}>{message.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <label className={styles.srOnly} htmlFor="emoji-demo-message">
            Message
          </label>
          <textarea
            id="emoji-demo-message"
            ref={fieldRef}
            className={styles.field}
            rows={2}
            value={draft}
            placeholder="Message #launch"
            onChange={(event) => {
              caretRef.current = null;
              setDraft(event.target.value);
            }}
            onSelect={(event) => {
              rangeRef.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd };
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
          />

          <div className={styles.toolbar}>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger className={styles.iconButton} aria-label="Add emoji" data-open={open || undefined}>
                <SmilePlus width={18} height={18} strokeWidth={1.75} aria-hidden="true" />
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                sideOffset={8}
                className={styles.pickerPopover}
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  fieldRef.current?.focus({ preventScroll: true });
                }}
              >
                <EmojiPicker
                  onSelect={(selection: EmojiSelection, event) => {
                    insert(selection.emoji);
                    if (!(event as MouseEvent | undefined)?.shiftKey) setOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>

            <span className={styles.hint}>Shift picks several</span>

            <button type="submit" className={styles.send} disabled={!draft.trim()} aria-label="Send message">
              <ArrowUp width={16} height={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
