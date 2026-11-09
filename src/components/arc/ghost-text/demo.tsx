"use client";

import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import GhostText, { createDemoSuggest } from "./ghost-text";
import type { GhostTextHandle } from "./ghost-text";
import styles from "./ghost-text.module.css";

export const meta = "Live · component";

const CLAUDE_PATH =
  "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.33" +
  "75-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032" +
  " 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.83" +
  "56l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2" +
  "246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733" +
  "-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6." +
  "287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985." +
  "2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107" +
  ".7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l." +
  "2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-." +
  "34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-." +
  "607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.436" +
  "4.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-." +
  "079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2." +
  "0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-" +
  "1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1." +
  "3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.607" +
  "1-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-." +
  "1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.400" +
  "8-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.14" +
  "57-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z";

const GITHUB_PATH =
  "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-." +
  "285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7" +
  "c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 " +
  "3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1." +
  "235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 " +
  "1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.76" +
  "5.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.0" +
  "15 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-" +
  "12-12-12";

function ClaudeMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Claude" style={{ color: "#D97757" }}>
      <path d={CLAUDE_PATH} />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="GitHub" className={styles.prMark} aria-hidden="true">
      <path d={GITHUB_PATH} />
    </svg>
  );
}

type Step =
  | { kind: "pause"; ms: number }
  | { kind: "type"; text: string }
  | { kind: "ready"; hold: number }
  | { kind: "tab" }
  | { kind: "word" }
  | { kind: "esc" };

const SCRIPT: Step[] = [
  { kind: "pause", ms: 500 },
  { kind: "type", text: "Customers who upgraded mid-cycle were " },
  { kind: "ready", hold: 700 },
  { kind: "tab" },
  { kind: "pause", ms: 220 },
  { kind: "type", text: " The credit for the old plan used the invoice date instead of the " },
  { kind: "ready", hold: 420 },
  { kind: "type", text: "date the" },
  { kind: "pause", ms: 320 },
  { kind: "tab" },
  { kind: "pause", ms: 220 },
  { kind: "type", text: "\n\n## Changes\n- " },
  { kind: "ready", hold: 520 },
  { kind: "word" },
  { kind: "pause", ms: 260 },
  { kind: "word" },
  { kind: "pause", ms: 210 },
  { kind: "word" },
  { kind: "pause", ms: 280 },
  { kind: "word" },
  { kind: "pause", ms: 460 },
  { kind: "esc" },
  { kind: "pause", ms: 260 },
  { kind: "type", text: " so upgrades and downgrades share one helper\n- " },
  { kind: "ready", hold: 620 },
  { kind: "tab" },
  { kind: "pause", ms: 220 },
  { kind: "type", text: "\n\nTested against " },
  { kind: "ready", hold: 760 },
  { kind: "tab" },
];

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    const next = (state = (state + 0x6d2b79f5) >>> 0);
    let value = Math.imul(next ^ (next >>> 15), 1 | next);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function typing(seed: number) {
  const roll = random(seed);
  return (char: string, previous: string) => {
    if (char === "\n") return 170 + 110 * roll();
    if (previous === "\n") return 120 + 80 * roll();
    if (/[.,;:!?]/.test(char)) return 150 + 120 * roll();
    if (char === " ") return 46 + 50 * roll() + 150 * (roll() < 0.14 ? 1 : 0);
    return 26 + 46 * roll();
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const suggest = createDemoSuggest({ scriptedOnly: true });

export default function GhostTextDemo() {
  const [value, setValue] = useState("");
  const textRef = useRef("");
  const [manual, setManual] = useState(false);
  const [flash, setFlash] = useState(false);
  const field = useRef<GhostTextHandle>(null);
  const tokenRef = useRef<{ cancelled: boolean } | null>(null);
  const manualRef = useRef(false);

  const stop = useCallback(() => {
    manualRef.current = true;
    setManual(true);
  }, []);

  useEffect(() => {
    const token = { cancelled: false };
    tokenRef.current = token;
    const guard = () => {
      if (token.cancelled || manualRef.current) throw new Error("stop");
    };
    const tick = async (ms: number) => {
      const chunk = 40;
      let left = ms;
      while (left > 0) {
        guard();
        const slice = Math.min(left, chunk);
        await wait(slice);
        left -= slice;
      }
    };
    const waitForReady = async () => {
      let spent = 0;
      while (spent < 5000) {
        guard();
        const state = field.current?.getState();
        if (state?.status === "ready" && !state.streaming) return;
        await tick(40);
        spent += 40;
      }
    };
    const pause = () => wait(300);

    void (async () => {
      textRef.current = "";
      setValue("");
      await pause();
      for (let cycle = 0; ; cycle += 1) {
        const delayFor = typing(4127 + cycle);
        for (const step of SCRIPT) {
          guard();
          if (step.kind === "pause") await tick(step.ms);
          else if (step.kind === "type") {
            for (const char of step.text) {
              await tick(delayFor(char, textRef.current.slice(-1)));
              textRef.current += char;
              guard();
              setValue(textRef.current);
            }
          } else if (step.kind === "ready") {
            await tick(80);
            field.current?.request();
            await waitForReady();
            await tick(step.hold);
          } else if (step.kind === "tab") {
            field.current?.acceptAll();
          } else if (step.kind === "word") {
            field.current?.acceptWord();
          } else {
            field.current?.dismiss();
          }
        }
        guard();
        await tick(2400);
        guard();
        setFlash(true);
        await tick(180);
        guard();
        textRef.current = "";
        setValue("");
        setFlash(false);
        await tick(520);
      }
    })().catch(() => undefined);

    return () => {
      token.cancelled = true;
    };
  }, []);

  const note: ReactNode = manual ? (
    <button type="button" className={styles.replay} onClick={() => undefined}>
      <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
      <span>Replay</span>
    </button>
  ) : (
    <span className={styles.simNote} style={{ opacity: 1 }}>
      <span className={styles.simText}>Autoplay. Click to type.</span>
    </span>
  );

  return (
    <div className={styles.demo}>
      <div className={styles.host}>
        <article className={styles.card} aria-label="Pull request #4127">
          <header className={styles.cardHead}>
            <GitHubMark />
            <div className={styles.prText}>
              <div className={styles.prTitleRow}>
                <span className={styles.prTitle}>Fix double charge on mid-cycle upgrades</span>
                <span className={styles.prNumber}>#4127</span>
              </div>
              <div className={styles.prMeta}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={styles.prAvatar}
                  src="/media/people/daniel-kim.svg"
                  alt=""
                  width={16}
                  height={16}
                />
                <span className={styles.prMetaText}>
                  Daniel Kim wants to merge <span className={styles.prBranch}>fix/proration</span> into <span className={styles.prBranch}>main</span>
                </span>
              </div>
            </div>
          </header>
          <GhostText
            ref={field}
            value={value}
            onValueChange={(next) => {
              textRef.current = next;
              setValue(next);
            }}
            multiline
            variant="plain"
            minRows={9}
            maxRows={14}
            placeholder="Describe what changed and why"
            model={{ name: "Claude Haiku 5.5", mark: <ClaudeMark /> }}
            suggest={suggest}
            notice={note}
            aria-label="Pull request description"
            onUserIntent={stop}
          />
        </article>
      </div>
    </div>
  );
}
