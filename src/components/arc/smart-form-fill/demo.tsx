"use client";

import { useEffect, useRef } from "react";
import { SmartFormFill } from "./smart-form-fill";
import styles from "./demo.module.css";

export const meta = "Live · component";

/**
 * The autoplay never rests, so the DOM gate pins it: `?rest=<state>` watches the status line
 * and stops the loop (a synthetic pointerdown is the loop's own stop signal) the moment it
 * reaches that state — `filled` for "Filled 6 fields. Check the phone and address.",
 * `phone-checked` for "Phone checked. 1 left to review.". Playback is unchanged without
 * the query string.
 */
const REST_STATES: Record<string, string> = {
  filled: "Filled ",
  "phone-checked": "Phone checked.",
};

export default function SmartFormFillDemo() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get("rest");
    const prefix = want ? REST_STATES[want] : undefined;
    if (!prefix) return;
    const timer = window.setInterval(() => {
      const card = host.current?.querySelector<HTMLElement>("[data-phase]");
      const status = host.current?.querySelector("p[data-tone]")?.textContent ?? "";
      if (!card || !status.startsWith(prefix)) return;
      window.clearInterval(timer);
      card.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    }, 40);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div ref={host} className={styles.demo}>
      <SmartFormFill />
    </div>
  );
}
