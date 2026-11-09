"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { Button } from "../button/button";
import { motionTokens } from "../lib/motion-tokens";
import { ToolCallGroup } from "./tool-call";
import type { ToolCallData, ToolCallStatus } from "./tool-call";
import styles from "./tool-call.module.css";

export const meta = "Live · component";

const answers = {
  allow:
    "Two things block 2.8: the coupon checkout bug #1284 and migration 0047, which is still pending on production. I posted a summary in #release.",
  deny: "Two things block 2.8: the coupon checkout bug #1284 and migration 0047, which is still pending on production. I did not post to #release.",
};

/** The sample run, shared with the component's own defaults. */
const issues: ToolCallData = {
  id: "github-issues",
  tool: "github",
  title: "Searched issues in arc-ui/web",
  titles: { running: "Searching issues in arc-ui/web", error: "Could not search issues in arc-ui/web" },
  status: "success",
  input: { repo: "arc-ui/web", query: "is:open label:release-blocker milestone:2.8", sort: "updated" },
  output: {
    type: "list",
    items: [
      { lead: "#1284", title: "Checkout button stays disabled after a coupon is removed", tag: "checkout" },
      { lead: "#1291", title: "Webhook retry posts a second charge after a 504", tag: "billing" },
      { lead: "#1302", title: "Session is lost after SSO sign in on iPad", tag: "auth" },
      { lead: "#1306", title: "Release notes page returns 404 on docs preview", tag: "docs" },
    ],
  },
  durationMs: 1180,
};

const project: ToolCallData = {
  id: "linear-project",
  tool: "linear",
  title: "Read the Web 2.8 release project",
  titles: { running: "Reading the Web 2.8 release project", error: "Could not read the Web 2.8 release project" },
  status: "success",
  input: { project: "Web 2.8 release", team: "WEB", include: ["issues", "milestones"] },
  output: {
    type: "json",
    value: {
      project: "Web 2.8 release",
      lead: "Maya Chen",
      target: "2026-10-23",
      progress: 0.86,
      health: "at risk",
      milestones: [
        { name: "Code freeze", date: "2026-10-20", done: true },
        { name: "Release candidate", date: "2026-10-22", done: false },
      ],
      blocked: [
        { id: "WEB-412", title: "Ship the coupon fix to checkout", assignee: "Daniel Okafor", blockedBy: "arc-ui/web#1284" },
        { id: "WEB-418", title: "Run migration 0047 on production", assignee: "Priya Raman", blockedBy: null },
      ],
      openIssues: 7,
      doneIssues: 43,
    },
  },
  summary: "2 blocked",
  durationMs: 760,
};

const migrations: ToolCallData = {
  id: "postgres-migrations",
  tool: "postgres",
  title: "Queried pending migrations",
  titles: { running: "Querying pending migrations", error: "Could not query pending migrations" },
  status: "success",
  input: {
    database: "app_production",
    sql: "select version, name, applied_at from schema_migrations where applied_at is null order by version",
  },
  output: {
    type: "table",
    columns: ["version", "name", "applied_at"],
    rows: [
      ["0047", "add_coupon_redemptions_index", null],
      ["0048", "backfill_invoice_currency", null],
    ],
  },
  message: "Connection to app_production timed out after 5s",
  durationMs: 420,
};

const post: ToolCallData = {
  id: "slack-post",
  tool: "slack",
  title: "Posted to #release",
  titles: {
    approval: "Post a summary to #release",
    denied: "Post a summary to #release",
    running: "Posting to #release",
    error: "Could not post to #release",
  },
  status: "success",
  input: {
    channel: "#release",
    text: "2.8 is blocked by #1284 (coupon checkout) and migration 0047, still pending on production. The Oct 23 target holds if both land by Wednesday.",
  },
  output: { type: "text", text: "Sent to #release at 10:42 as Arc agent." },
  summary: "1 message",
  message: "Sends as Arc agent to 48 people in #release",
  durationMs: 610,
};

const chunkSizes = [4, 6, 3, 7, 5];

/** Streams prose the way a model answers: word groups of 4 to 7, one every 34ms. */
function ProseStream({ text }: { text: string }) {
  const chunks = useMemo(() => {
    const words = text.match(/\S+\s*/g) ?? [];
    const out: string[] = [];
    for (let cursor = 0, step = 0; cursor < words.length; step += 1) {
      const size = chunkSizes[step % chunkSizes.length];
      out.push(words.slice(cursor, cursor + size).join(""));
      cursor += size;
    }
    return out;
  }, [text]);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const next = Math.min(chunks.length, Math.floor((now - start) / 34) + 1);
      setShown(next);
      if (next < chunks.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [chunks]);

  return (
    <>
      {chunks.slice(0, shown).map((chunk, index) => (
        <span key={index} className={styles.chunk}>
          {chunk}
        </span>
      ))}
    </>
  );
}

/**
 * The preview runs the whole transcript on its own: it streams a line of prose, searches issues,
 * reads the release project, then parks on a timed out migrations query with a Retry the visitor can
 * press. Retrying finishes the query and opens a Slack post that waits for Allow or Deny, and the
 * answer it writes is the one the run actually took.
 */
export default function ToolCallDemo() {
  const reduced = useReducedMotion() ?? false;
  const [run, setRun] = useState(0);
  const [started, setStarted] = useState(false);
  const [calls, setCalls] = useState<ToolCallData[]>([]);
  const [active, setActive] = useState(true);
  const [answer, setAnswer] = useState<"allow" | "deny" | null>(null);
  const [showAgain, setShowAgain] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const pending = useRef<{ retry?: () => void; decide?: (choice: "allow" | "deny") => void }>({});
  const reducedRef = useRef(reduced);

  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, ms));
      });
    const push = (call: ToolCallData) => setCalls((list) => [...list, call]);
    const patch = (id: string, next: Partial<ToolCallData>) =>
      setCalls((list) => list.map((call) => (call.id === id ? { ...call, ...next } : call)));
    const status = (id: string, next: ToolCallStatus) => patch(id, { status: next });

    void (async () => {
      await wait(120);
      if (cancelled) return;
      setStarted(true);
      await wait(480);
      if (cancelled) return;
      push({ ...issues, status: "running" });
      await wait(1180);
      if (cancelled) return;
      status(issues.id, "success");
      await wait(220);
      if (cancelled) return;
      push({ ...project, status: "running" });
      await wait(760);
      if (cancelled) return;
      status(project.id, "success");
      await wait(220);
      if (cancelled) return;
      push({ ...migrations, status: "running", durationMs: 5000 });
      await wait(1400);
      if (cancelled) return;
      status(migrations.id, "error");
      setAnnouncement("PostgreSQL timed out. Retry it to continue.");
      await new Promise<void>((resolve) => {
        pending.current.retry = resolve;
      });
      if (cancelled) return;
      patch(migrations.id, { status: "running", durationMs: migrations.durationMs });
      await wait(700);
      if (cancelled) return;
      status(migrations.id, "success");
      await wait(260);
      if (cancelled) return;
      push({ ...post, status: "approval" });
      const choice = await new Promise<"allow" | "deny">((resolve) => {
        pending.current.decide = resolve;
      });
      if (cancelled) return;
      if (choice === "allow") {
        status(post.id, "running");
        await wait(620);
        if (cancelled) return;
        status(post.id, "success");
        setAnnouncement("Allowed. This preview simulates the post, so nothing was sent to Slack.");
      } else {
        status(post.id, "denied");
        setAnnouncement("Denied. Nothing was posted.");
      }
      setActive(false);
      await wait(reducedRef.current ? 150 : 950);
      if (cancelled) return;
      setAnswer(choice);
      await wait(700);
      if (cancelled) return;
      setShowAgain(true);
    })();

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      pending.current = {};
    };
  }, [run]);

  const decide = (choice: "allow" | "deny") => {
    const resolve = pending.current.decide;
    pending.current.decide = undefined;
    resolve?.(choice);
  };

  const slotTransition = reduced
    ? { duration: 0 }
    : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast } };

  return (
    <div className={styles.demo}>
      <p className={styles.user}>Is anything blocking the 2.8 release?</p>
      <div className={styles.turn}>
        <p className={styles.prose}>{started ? <ProseStream key={`intro-${run}`} text="Let me check what is blocking the release." /> : null}</p>
        <AnimatePresence initial={false}>
          {calls.length ? (
            <motion.div
              key={`group-${run}`}
              className={styles.slot}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0 } }}
              transition={slotTransition}
            >
              <ToolCallGroup
                calls={calls}
                active={active}
                onRetry={() => {
                  const resolve = pending.current.retry;
                  pending.current.retry = undefined;
                  resolve?.();
                }}
                onApprove={() => decide("allow")}
                onDeny={() => decide("deny")}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
        {answer ? (
          <p className={styles.prose}>
            <ProseStream key={`answer-${run}`} text={answers[answer]} />
          </p>
        ) : null}
        <AnimatePresence initial={false}>
          {showAgain ? (
            <motion.div
              key="again"
              className={styles.again}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0 } }}
              transition={{ duration: reduced ? 0 : motionTokens.duration.standard }}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRun((value) => value + 1);
                  setStarted(false);
                  setCalls([]);
                  setActive(true);
                  setAnswer(null);
                  setShowAgain(false);
                  setAnnouncement("");
                }}
              >
                <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
                Run again
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {showAgain && answer ? answers[answer] : announcement}
      </span>
    </div>
  );
}
