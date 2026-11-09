import { useEffect, useRef } from "react";

import AiSearchBar, { delay, demoAnswer } from "./ai-search-bar";
import type { AnswerFn } from "./ai-search-bar";
import styles from "./demo.module.css";

export const meta = "Live · block";

/**
 * The shipped autoplay asks ~3.4s after mount, so the live frame is photographed mid-answer,
 * one line into the first paragraph. The demo asks ~0.5s after mount, then holds after the
 * opening sentence so the frame lands in that same beat instead of racing the reveal.
 */
const MID_SENTENCE_HOLD = 3200;

const frameAnswer: AnswerFn = async function* ({ query, results, signal }) {
  await delay(60, signal);
  let held = false;
  for await (const chunk of demoAnswer({ query, results, signal })) {
    yield chunk;
    if (!held && chunk.type === "text") {
      held = true;
      await delay(MID_SENTENCE_HOLD, signal);
    }
  }
};

const QUERY = "webhook retries";
const TYPE_EVERY = 42;
const TYPE_STEP = 2;
const ASK_DELAY = 140;
/** Hold the finished answer, then run the whole loop again like the shipped block does. */
const HOLD_AFTER_ANSWER = 9000;
const CLEAR_DELAY = 420;

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

export default function AiSearchBarDemo() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const timers: number[] = [];
    let cancelled = false;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, ms));
      });

    const run = async () => {
      await wait(80);
      const input = host.querySelector<HTMLInputElement>("input");
      if (!input) return;

      while (!cancelled) {
        for (let end = TYPE_STEP; end < QUERY.length; end += TYPE_STEP) {
          setInputValue(input, QUERY.slice(0, end));
          await wait(TYPE_EVERY);
          if (cancelled) return;
        }
        setInputValue(input, QUERY);
        await wait(ASK_DELAY);
        if (cancelled) return;
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
        await wait(HOLD_AFTER_ANSWER);
        if (cancelled) return;
        setInputValue(input, "");
        await wait(CLEAR_DELAY);
        if (cancelled) return;
      }
    };

    void run();

    return () => {
      cancelled = true;
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={hostRef} className={styles.stage}>
      <AiSearchBar answer={frameAnswer} autoPlay={false} />
    </div>
  );
}
