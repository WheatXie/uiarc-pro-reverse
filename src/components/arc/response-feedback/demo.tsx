"use client";

import { useCallback, useRef, useState } from "react";
import { Switch } from "../switch/switch";
import { ResponseFeedback } from "./response-feedback";
import type { FeedbackEvent, FeedbackHandlerOptions } from "./response-feedback";
import styles from "./response-feedback.module.css";

export const meta = "Live · component";

const wait = (signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, 700);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });

export default function ResponseFeedbackDemo() {
  const [fail, setFail] = useState(false);
  const failing = useRef(false);

  const toggle = (next: boolean) => {
    failing.current = next;
    setFail(next);
  };

  const handleFeedback = useCallback(async (event: FeedbackEvent, { signal }: FeedbackHandlerOptions) => {
    if (event.stage === "rating") return;
    await wait(signal);
    if (failing.current) {
      toggle(false);
      throw new Error("Simulated failure");
    }
  }, []);

  return (
    <div className={styles.demo}>
      <ResponseFeedback onFeedback={handleFeedback} thanksMessage="Simulated, nothing was sent." />
      <div className={styles.controls}>
        <Switch label="Fail the next send" checked={fail} onCheckedChange={toggle} />
      </div>
    </div>
  );
}
