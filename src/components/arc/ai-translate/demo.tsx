"use client";

import { useRef, useState } from "react";
import { AiTranslate, SAMPLE_TRANSLATIONS } from "./ai-translate";
import type { AiTranslateCode, AiTranslateRequest } from "./ai-translate";
import { Switch } from "../switch/switch";
import styles from "./demo.module.css";

export const meta = "Live · component";

export default function Demo() {
  const [failing, setFailing] = useState(false);
  const armed = useRef(false);

  const arm = (next: boolean) => {
    armed.current = next;
    setFailing(next);
  };

  // A stand in translator: it waits like a real request, then hands back the bundled translation as one string.
  async function translate({ to, signal }: AiTranslateRequest): Promise<string> {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, 560);
      signal.addEventListener("abort", () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    });
    if (armed.current) {
      arm(false);
      throw Error("The translation service is rate limited. Try again in a moment.");
    }
    const sample = SAMPLE_TRANSLATIONS[to as Exclude<AiTranslateCode, "fr">];
    if (!sample) throw Error("No translation for this language yet.");
    return sample;
  }

  return (
    <div className={styles.demo}>
      <AiTranslate translate={translate} autoPlay simulated />
      <div className={styles.controls}>
        <Switch label="Fail the next translation" checked={failing} onCheckedChange={arm} />
      </div>
    </div>
  );
}
