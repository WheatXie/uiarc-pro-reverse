"use client";

import { useCallback, useRef, useState } from "react";
import ReplyDraft, { simulateReplyDraft } from "./reply-draft";
import type { ReplyDraftRequest } from "./reply-draft";
import styles from "./reply-draft.module.css";

export const meta = "Live · component";

/**
 * The shipped demo, minus the forced tour: the card takes the documented `autoPlay = !generate`
 * default (a demo that supplies `generate` rests instead of touring), so it drafts once and holds the
 * ready reply. "Fail the next draft" arms a single request that rejects after 700ms, so the error
 * state is reachable on demand.
 */
export default function ReplyDraftDemo() {
  const [armed, setArmed] = useState(false);
  const failNext = useRef(false);
  const generate = useCallback((request: ReplyDraftRequest) => {
    if (!failNext.current) return simulateReplyDraft(request);
    failNext.current = false;
    setArmed(false);
    return new Promise<string>((_, reject) => {
      const timer = setTimeout(() => reject(Error("The model timed out. Nothing was sent.")), 700);
      request.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
    });
  }, []);
  return (
    <div className={styles.demo}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.toggle}
          aria-pressed={armed}
          onClick={() => {
            failNext.current = !armed;
            setArmed(!armed);
          }}
        >
          {armed ? "Next draft will fail" : "Fail the next draft"}
        </button>
      </div>
      <ReplyDraft generate={generate} />
    </div>
  );
}
