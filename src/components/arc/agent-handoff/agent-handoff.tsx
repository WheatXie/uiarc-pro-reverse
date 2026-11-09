"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import type { AnimationPlaybackControls } from "motion/react";
import { ArrowUp, Bot, ChevronDown, CircleAlert, CircleCheck, Headset, LoaderCircle, RotateCcw } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { motionTokens } from "../lib/motion-tokens";
import { person } from "../lib/media";
import styles from "./agent-handoff.module.css";

const easeStandard: [number, number, number, number] = [...motionTokens.ease.standard];
const heightSpring = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;

/** Where the conversation is. `assistant` is before anyone is asked for. */
export type AgentHandoffStage = "assistant" | "transferring" | "connected" | "resolved" | "unavailable";

/** One message in the conversation. `streaming` fades each appended chunk. */
export interface HandoffMessage {
  id: string;
  from: "customer" | "assistant" | "agent";
  text: string;
  time?: string;
  streaming?: boolean;
}

/** A labelled fact the assistant passes to the person, such as the order number. */
export interface HandoffSummaryField {
  label: string;
  value: string;
}

/** What the assistant hands over: the issue in one line plus the facts that matter. */
export interface HandoffSummary {
  issue: string;
  fields?: HandoffSummaryField[];
}

/** The AI assistant on the first step. The mark defaults to the Claude mark. */
export interface HandoffAssistant {
  name?: string;
  model?: string;
  mark?: ReactNode;
}

/** The person who takes over. */
export interface HandoffAgent {
  name: string;
  role?: string;
  avatar?: string;
  joinedAt?: string;
}

/** The help desk the conversation moves to. */
export type HandoffProvider = "intercom" | "zendesk" | { name: string; mark: ReactNode };

export interface AgentHandoffProps {
  /** Where the conversation is. Leave it out to play the built in simulated chat. */
  stage?: AgentHandoffStage;
  /** The conversation with the assistant, before the handoff. */
  messages?: HandoffMessage[];
  /** Everything after the handoff card: notes while waiting, then the conversation with the person. */
  agentMessages?: HandoffMessage[];
  /** Who is typing. The assistant shows a shimmering Thinking line, a person shows typing dots. */
  typing?: "assistant" | "agent" | null;
  /** What the assistant passes to the person. Shown in the handoff card from transferring on. */
  summary?: HandoffSummary;
  assistant?: HandoffAssistant;
  agent?: HandoffAgent;
  provider?: HandoffProvider;
  /** Typical wait shown while transferring. */
  replyEstimate?: string;
  /** Header title, such as the order or ticket number. */
  title?: string;
  subtitle?: string;
  /** A mark for the header, passed by the built in simulation. */
  logo?: ReactNode;
  onSend?: (text: string) => void;
  onRequestHuman?: () => void;
  onCancelTransfer?: () => void;
  onRetry?: () => void;
  /** Composer placeholder. Defaults to one that follows the stage. */
  placeholder?: string;
  /** Card height. The thread scrolls inside and stays pinned to the newest message. */
  height?: number | string;
  /** A one-off message for screen readers, such as "Refund issued". */
  notice?: string;
  /** Simulation only: unavailable stops when nobody picks the transfer up. */
  scenario?: "handoff" | "unavailable";
  /**
   * Simulation only: start the story again once it has finished. The demo turns it off so the card
   * comes to rest on its last state; the header replay button restarts the story either way.
   */
  autoReplay?: boolean;
  className?: string;
}

/** The person the simulation hands off to. */
export const handoffDemoAgent: HandoffAgent = {
  name: "Jordan Reyes",
  role: "Support specialist",
  avatar: person("jordan-reyes").src,
  joinedAt: "14:05",
};

const defaultAssistant = { name: "Assistant", model: "Claude Sonnet 5.5" };

const refundedSummary: HandoffSummary = {
  issue: "Halden desk in white oak arrived with a cracked leg and a scratched top. Priya wants a full refund, not a replacement.",
  fields: [
    { label: "Order", value: "NW-48213 · delivered Oct 27" },
    { label: "Paid", value: "$649 · $150 gift card, $499 Visa 4417" },
    { label: "Asks for", value: "Full refund" },
  ],
};

const pendingSummary: HandoffSummary = {
  issue: "Halden desk in white oak arrived with a cracked leg. Priya asked to talk to a person before choosing a fix.",
  fields: [
    { label: "Order", value: "NW-48213 · delivered Oct 27" },
    { label: "Paid", value: "$649 · $150 gift card, $499 Visa 4417" },
    { label: "Asks for", value: "Not decided yet" },
  ],
};

interface HandoffState {
  runId: number;
  stage: AgentHandoffStage;
  messages: HandoffMessage[];
  agentMessages: HandoffMessage[];
  typing: "assistant" | "agent" | null;
  summary: HandoffSummary;
  notice: string;
}

const initialState = (runId: number): HandoffState => ({
  runId,
  stage: "assistant",
  messages: [],
  agentMessages: [],
  typing: null,
  summary: refundedSummary,
  notice: "",
});

/** Thrown by the simulation when a run is replaced or the card unmounts. */
class HandoffAbort extends Error {}

/** Splits a reply into the 3 to 8 word chunks the assistant streams in, keeping the spaces. */
const splitForStream = (text: string) => {
  const words = text.split(/(?<=\s)/);
  const chunks: string[] = [];
  for (let index = 0; index < words.length; ) {
    const size = 3 + ((7 * index + words.length) % 6);
    chunks.push(words.slice(index, index + size).join(""));
    index += size;
  }
  return chunks;
};

export interface HandoffSimulationOptions {
  scenario: "handoff" | "unavailable";
  reduced: boolean;
  autoReplay?: boolean;
}

/** The hook behind the demo: the whole story as state plus the handlers the card needs. */
export function useHandoffSimulation({ scenario, reduced, autoReplay = true }: HandoffSimulationOptions) {
  const [state, setState] = useState<HandoffState>(() => initialState(0));
  const visible = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const flags = useRef({ askedRefund: false, interacted: false, retried: false });
  const sequence = useRef(0);
  const reducedRef = useRef(reduced);
  useEffect(() => { reducedRef.current = reduced; }, [reduced]);
  const autoReplayRef = useRef(autoReplay);
  useEffect(() => { autoReplayRef.current = autoReplay; }, [autoReplay]);

  const patch = useCallback((next: Partial<HandoffState> | ((current: HandoffState) => Partial<HandoffState>)) => {
    setState(current => ({ ...current, ...(typeof next === "function" ? next(current) : next) }));
  }, []);

  // Timing runs in 80ms slices so a card that scrolls away pauses its own loop.
  const wait = useCallback(async (ms: number, signal: AbortSignal) => {
    let left = ms;
    while (left > 0) {
      const slice = Math.min(left, 80);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, slice);
        signal.addEventListener("abort", () => { clearTimeout(timer); reject(new HandoffAbort()); }, { once: true });
      });
      if (signal.aborted) throw new HandoffAbort();
      if (visible.current) left -= slice;
    }
  }, []);

  const push = useCallback((field: "messages" | "agentMessages", message: Omit<HandoffMessage, "id">) => {
    const id = `m${++sequence.current}`;
    patch(current => ({ [field]: [...current[field], { ...message, id }] }));
    return id;
  }, [patch]);

  const stream = useCallback(async (field: "messages" | "agentMessages", text: string, signal: AbortSignal, time: string) => {
    if (reducedRef.current) { push(field, { from: "assistant", text, time }); return; }
    const id = push(field, { from: "assistant", text: "", time, streaming: true });
    let written = "";
    try {
      for (const chunk of splitForStream(text)) {
        await wait(34, signal);
        written += chunk;
        const next = written;
        patch(current => ({ [field]: current[field].map(item => item.id === id ? { ...item, text: next } : item) }));
      }
    } finally {
      patch(current => ({ [field]: current[field].map(item => item.id === id ? { ...item, streaming: false } : item).filter(item => item.text) }));
    }
  }, [push, patch, wait]);

  const showTyping = useCallback(async (who: "assistant" | "agent", ms: number, signal: AbortSignal) => {
    patch({ typing: who });
    try { await wait(ms, signal); } finally { patch({ typing: null }); }
  }, [patch, wait]);

  const run = useCallback((story: (signal: AbortSignal) => Promise<void>) => {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    story(next.signal).catch(error => { if (!(error instanceof HandoffAbort)) throw error; });
  }, []);

  const transfer = useCallback(async (signal: AbortSignal) => {
    patch({ stage: "connected", notice: `${handoffDemoAgent.name} joined the conversation.` });
    const askedRefund = flags.current.askedRefund;
    await wait(500, signal);
    await showTyping("agent", 950, signal);
    push("agentMessages", {
      from: "agent",
      text: askedRefund
        ? "Hi Priya, I'm Jordan. I read the summary, so no need to repeat anything. I've refunded $150 to your gift card and $499 to your Visa ending 4417."
        : "Hi Priya, I'm Jordan. I read the summary, so no need to repeat anything. Would you like a replacement leg, or a full refund?",
      time: "14:05",
    });
    if (!askedRefund) return;
    patch({ notice: "Refund issued. Simulated, no money moved." });
    await wait(600, signal);
    await showTyping("agent", 1200, signal);
    push("agentMessages", {
      from: "agent",
      text: "The Visa refund shows up in 3 to 5 business days. A courier picks up the desk on Thursday, Oct 29, between 9:00 and 12:00.",
      time: "14:06",
    });
    await wait(1400, signal);
    push("agentMessages", { from: "customer", text: "That's perfect, thank you!", time: "14:06" });
    await wait(700, signal);
    patch({ stage: "resolved", notice: `Resolved by ${handoffDemoAgent.name}.` });
  }, [patch, push, showTyping, wait]);

  const requestHuman = useCallback(async (signal: AbortSignal, delay = 2600) => {
    patch({
      stage: "transferring",
      summary: flags.current.askedRefund ? refundedSummary : pendingSummary,
      notice: "Transferring to a person through Intercom. Simulated, nothing was sent.",
    });
    await wait(delay, signal);
    if (scenario !== "unavailable" || flags.current.retried) { await transfer(signal); return; }
    patch({ stage: "unavailable", notice: "No one is available right now. Try again, or keep writing and the team replies by email." });
  }, [patch, transfer, wait, scenario]);

  const replay = useRef<() => void>(() => {});

  const story = useCallback((signal: AbortSignal) => (async () => {
    await wait(350, signal);
    push("messages", { from: "customer", text: "Hi, my Halden desk arrived this morning with a cracked leg. Order NW-48213.", time: "14:02" });
    await wait(350, signal);
    await showTyping("assistant", 750, signal);
    await stream("messages", "Sorry about that, Priya. I found order NW-48213, the Halden desk in white oak, delivered today at 11:42. I can ship a replacement leg in 2 business days, or start a return.", signal, "14:02");
    await wait(1500, signal);
    push("messages", { from: "customer", text: "The top is scratched too, so I'd rather have a refund. I paid with a $150 gift card and my Visa.", time: "14:03" });
    flags.current.askedRefund = true;
    await wait(350, signal);
    await showTyping("assistant", 850, signal);
    await stream("messages", "Refunds split across a gift card and a card need someone on our team. I'm passing everything along, so you won't have to repeat yourself.", signal, "14:03");
    await wait(900, signal);
    await requestHuman(signal);
    if (flags.current.interacted || reducedRef.current || !autoReplayRef.current) return;
    await wait(4200, signal);
    if (!flags.current.interacted) replay.current();
  })(), [push, stream, showTyping, requestHuman, wait]);

  const restart = useCallback(() => {
    flags.current = { askedRefund: false, interacted: false, retried: false };
    setState(current => initialState(current.runId + 1));
    run(story);
  }, [run, story]);

  useEffect(() => { replay.current = restart; }, [restart]);
  useEffect(() => {
    run(story);
    return () => controller.current?.abort();
  }, [run, story]);

  const scenarioRef = useRef(scenario);
  useEffect(() => {
    if (scenarioRef.current === scenario) return;
    scenarioRef.current = scenario;
    restart();
  }, [restart, scenario]);

  const interact = () => { flags.current.interacted = true; };

  const onRequestHuman = useCallback(() => {
    interact();
    run(async signal => {
      push("messages", { from: "customer", text: "Can I talk to a person?", time: "14:04" });
      await wait(300, signal);
      await showTyping("assistant", 650, signal);
      await stream("messages", "Of course. I'm passing along everything we covered, so you won't have to repeat yourself.", signal, "14:04");
      await wait(600, signal);
      await requestHuman(signal);
    });
  }, [push, run, requestHuman, stream, showTyping, wait]);

  const onCancelTransfer = useCallback(() => {
    interact();
    run(async signal => {
      patch({ stage: "assistant", agentMessages: [], notice: "Transfer canceled. The assistant is still here." });
      await wait(250, signal);
      await showTyping("assistant", 600, signal);
      await stream("messages", "No problem, I'm still here. Ask for a person whenever you're ready and I'll pass this along.", signal, "14:04");
    });
  }, [patch, run, stream, showTyping, wait]);

  const onRetry = useCallback(() => {
    interact();
    flags.current.retried = true;
    run(signal => requestHuman(signal, 1600));
  }, [requestHuman, run]);

  const onSend = useCallback((text: string) => {
    const stage = state.stage;
    if (stage === "transferring") {
      push("agentMessages", { from: "customer", text, time: "14:04" });
      patch({ notice: "Added for the team. Simulated, nothing was sent." });
      return;
    }
    if (stage === "unavailable") {
      push("agentMessages", { from: "customer", text, time: "14:05" });
      patch({ notice: "Saved. The team replies by email. Simulated, nothing was sent." });
      return;
    }
    interact();
    if (stage === "assistant") {
      run(async signal => {
        push("messages", { from: "customer", text, time: "14:04" });
        patch({ notice: "Message sent to the assistant. Simulated, nothing was sent." });
        await wait(300, signal);
        await showTyping("assistant", 700, signal);
        await stream("messages", "Thanks, I've noted that. I can also bring in a person from our team if you'd like.", signal, "14:04");
      });
      return;
    }
    run(async signal => {
      push("agentMessages", { from: "customer", text, time: "14:07" });
      patch({ stage: "connected", notice: `Message sent to ${handoffDemoAgent.name}. Simulated, nothing was sent.` });
      await wait(400, signal);
      await showTyping("agent", 1100, signal);
      push("agentMessages", { from: "agent", text: "Thanks, Priya. I've added that to your case.", time: "14:07" });
    });
  }, [patch, push, run, showTyping, state.stage, stream, wait]);

  const setVisible = useCallback((next: boolean) => { visible.current = next; }, []);

  return {
    ...state,
    onRequestHuman,
    onCancelTransfer,
    onRetry,
    onSend,
    onReplay: restart,
    setVisible,
  };
}

type SimulatedHandoff = AgentHandoffProps & {
  runKey?: number;
  onReplay?: () => void;
  onVisibleChange?: (visible: boolean) => void;
};

/** A support conversation where an AI assistant hands off to a person, with a summary card and a step timeline. */
export function AgentHandoff(props: AgentHandoffProps) {
  if (props.stage === undefined) return <AgentHandoffSimulation {...props} />;
  return <AgentHandoffView {...props} stage={props.stage} />;
}

function AgentHandoffSimulation(props: AgentHandoffProps) {
  const reduced = !!useReducedMotion();
  const simulation = useHandoffSimulation({ scenario: props.scenario ?? "handoff", reduced, autoReplay: props.autoReplay });
  return (
    <AgentHandoffView
      title="Order NW-48213"
      subtitle="Northwind Home support"
      logo={<NorthwindMark aria-hidden="true" />}
      agent={handoffDemoAgent}
      {...props}
      stage={simulation.stage}
      messages={simulation.messages}
      agentMessages={simulation.agentMessages}
      typing={simulation.typing}
      summary={simulation.summary}
      notice={simulation.notice}
      onSend={simulation.onSend}
      onRequestHuman={simulation.onRequestHuman}
      onCancelTransfer={simulation.onCancelTransfer}
      onRetry={simulation.onRetry}
      runKey={simulation.runId}
      onReplay={simulation.onReplay}
      onVisibleChange={simulation.setVisible}
    />
  );
}

type Row =
  | { kind: "assistant-node"; key: string }
  | { kind: "agent-node"; key: string }
  | { kind: "resolved-node"; key: string }
  | { kind: "handoff"; key: string }
  | { kind: "message"; key: string; message: HandoffMessage }
  | { kind: "typing"; key: string; who: "assistant" | "agent" }
  | { kind: "ask"; key: string };

const senderOf = (row: Row | undefined) =>
  row?.kind === "message" ? row.message.from : row?.kind === "typing" ? row.who : row?.kind === "ask" ? "customer" : undefined;

const isNode = (row: Row | undefined) =>
  row?.kind === "assistant-node" || row?.kind === "agent-node" || row?.kind === "resolved-node";

function AgentHandoffView({
  stage,
  messages = [],
  agentMessages = [],
  typing = null,
  summary,
  assistant,
  agent,
  provider = "intercom",
  replyEstimate = "2 min",
  title = "Support chat",
  subtitle,
  logo,
  onSend,
  onRequestHuman,
  onCancelTransfer,
  onRetry,
  placeholder,
  height = 600,
  notice,
  className,
  runKey = 0,
  onReplay,
  onVisibleChange,
}: SimulatedHandoff & { stage: AgentHandoffStage }) {
  const reduced = !!useReducedMotion();
  const root = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);
  const visibleChange = useRef(onVisibleChange);
  useEffect(() => { visibleChange.current = onVisibleChange; }, [onVisibleChange]);

  useEffect(() => {
    const node = root.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      setPaused(!entry.isIntersecting);
      visibleChange.current?.(entry.isIntersecting);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const assistantConfig = { ...defaultAssistant, ...assistant };
  const desk: { name: string; mark: ReactNode } =
    provider === "intercom" ? { name: "Intercom", mark: <IntercomMark aria-hidden="true" /> }
      : provider === "zendesk" ? { name: "Zendesk", mark: <ZendeskMark aria-hidden="true" /> }
        : provider;
  const person_ = agent ?? { name: "Support" };
  const firstName = person_.name.split(" ")[0];

  const rows: Row[] = [];
  const afterHandoff = stage !== "assistant";
  const joined = stage === "connected" || stage === "resolved";
  if (messages.length || (typing === "assistant" && !afterHandoff)) rows.push({ kind: "assistant-node", key: "assistant-node" });
  for (const message of messages) rows.push({ kind: "message", key: message.id, message });
  if (afterHandoff) {
    rows.push({ kind: "handoff", key: "handoff" });
    let hasJoin = false;
    for (const message of agentMessages) {
      if (joined && !hasJoin && message.from === "agent") {
        rows.push({ kind: "agent-node", key: "agent-node" });
        hasJoin = true;
      }
      rows.push({ kind: "message", key: message.id, message });
    }
    if (joined && !hasJoin) rows.push({ kind: "agent-node", key: "agent-node" });
  }
  if (typing === "assistant" && !afterHandoff) rows.push({ kind: "typing", key: "typing-assistant", who: "assistant" });
  if (typing === "agent" && joined) rows.push({ kind: "typing", key: "typing-agent", who: "agent" });
  if (stage === "resolved") rows.push({ kind: "resolved-node", key: "resolved-node" });
  const streaming = messages.some(message => message.streaming);
  if (stage === "assistant" && onRequestHuman && !typing && !streaming && messages.length) rows.push({ kind: "ask", key: "ask" });

  const empty = rows.length === 0;
  const firstTime = messages[0]?.time;
  const style = { "--handoff-height": typeof height === "number" ? `${height}px` : height } as CSSProperties;

  return (
    <section
      ref={root}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={style}
      data-paused={paused || undefined}
      data-reduced={reduced || undefined}
      aria-label={title}
    >
      <header className={styles.header}>
        {logo && <span className={styles.logo}>{logo}</span>}
        <div className={styles.heading}>
          <h3 className={styles.title}>{title}</h3>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        <div className={styles.headerEnd}>
          <StatusChip stage={stage} name={firstName} />
          {onReplay && (
            <Button variant="ghost" size="sm" aria-label="Replay the demo" title="Replay" onClick={onReplay}>
              <RotateCcw aria-hidden="true" />
            </Button>
          )}
        </div>
      </header>
      <div className={styles.scroll} role="log" aria-live="off" aria-label="Conversation" tabIndex={0}>
        <div className={styles.fill}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={runKey}
              className={styles.run}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: motionTokens.duration.fast, ease: easeStandard } }}
              exit={{ opacity: 0, transition: { duration: 0.12, ease: easeStandard } }}
            >
              {empty ? (
                <div className={styles.empty}>
                  <span className={styles.modelMark}>{assistantConfig.mark ?? <ClaudeMark aria-hidden="true" />}</span>
                  <p className={styles.emptyTitle}>Ask the {assistantConfig.name.toLowerCase()} anything</p>
                  <p className={styles.emptyMeta}>A person from the team can join at any time.</p>
                </div>
              ) : (
                <HeightClip reduced={reduced}>
                  <ol className={styles.thread}>
                    <AnimatePresence initial={false}>
                      {rows.map((row, index) => {
                        const previous = rows[index - 1];
                        const gap = !previous ? 0
                          : isNode(row) || row.kind === "handoff" || previous.kind === "handoff" ? 16
                            : isNode(previous) ? 8
                              : senderOf(row) === senderOf(previous) ? 4
                                : 12;
                        return (
                          <RowItem
                            key={row.key}
                            row={row}
                            gap={gap}
                            travel={row.kind === "handoff" && stage === "transferring" && !reduced}
                            stage={stage}
                            assistant={assistantConfig}
                            person={person_}
                            desk={desk}
                            summary={summary}
                            replyEstimate={replyEstimate}
                            firstTime={firstTime}
                            reduced={reduced}
                            onCancel={onCancelTransfer}
                            onRetry={onRetry}
                            onRequestHuman={onRequestHuman}
                          />
                        );
                      })}
                    </AnimatePresence>
                  </ol>
                </HeightClip>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      {onSend && (
        <Composer stage={stage} name={firstName} assistantName={assistantConfig.name} placeholder={placeholder} onSend={onSend} />
      )}
      <p className={styles.srOnly} role="status" aria-live="polite">{notice}</p>
    </section>
  );
}

function RowItem({
  row,
  gap,
  travel,
  stage,
  assistant,
  person: person_,
  desk,
  summary,
  replyEstimate,
  firstTime,
  reduced,
  onCancel,
  onRetry,
  onRequestHuman,
}: {
  row: Row;
  gap: number;
  travel: boolean;
  stage: AgentHandoffStage;
  assistant: { name: string; model: string; mark?: ReactNode };
  person: HandoffAgent;
  desk: { name: string; mark: ReactNode };
  summary?: HandoffSummary;
  replyEstimate: string;
  firstTime?: string;
  reduced: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
  onRequestHuman?: () => void;
}) {
  const node = isNode(row) || row.kind === "handoff";
  return (
    <motion.li
      className={styles.row}
      data-kind={row.kind}
      data-node={node || undefined}
      style={{ paddingTop: gap, "--gap": `${gap}px` } as CSSProperties}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: motionTokens.duration.fast, ease: easeStandard }}
    >
      <div className={styles.gutter} aria-hidden="true">
        {travel && <span className={styles.travel}><i /></span>}
      </div>
      <div className={styles.body}>
        <RowContent
          row={row}
          stage={stage}
          assistant={assistant}
          person={person_}
          desk={desk}
          summary={summary}
          replyEstimate={replyEstimate}
          firstTime={firstTime}
          reduced={reduced}
          onCancel={onCancel}
          onRetry={onRetry}
          onRequestHuman={onRequestHuman}
        />
      </div>
    </motion.li>
  );
}

function RowContent({
  row,
  stage,
  assistant,
  person: person_,
  desk,
  summary,
  replyEstimate,
  firstTime,
  reduced,
  onCancel,
  onRetry,
  onRequestHuman,
}: {
  row: Row;
  stage: AgentHandoffStage;
  assistant: { name: string; model: string; mark?: ReactNode };
  person: HandoffAgent;
  desk: { name: string; mark: ReactNode };
  summary?: HandoffSummary;
  replyEstimate: string;
  firstTime?: string;
  reduced: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
  onRequestHuman?: () => void;
}) {
  const firstName = person_.name.split(" ")[0];
  switch (row.kind) {
    case "assistant-node":
      return (
        <NodeRow
          mark={<span className={styles.modelMark}>{assistant.mark ?? <ClaudeMark aria-hidden="true" />}</span>}
          title={assistant.name}
          meta={assistant.model}
          time={firstTime}
        />
      );
    case "agent-node":
      return (
        <NodeRow
          mark={<Avatar name={person_.name} src={person_.avatar} size="sm" className={styles.nodeAvatar} />}
          title={`${person_.name} joined`}
          meta={person_.role}
          time={person_.joinedAt}
        />
      );
    case "resolved-node":
      return <NodeRow mark={<CircleCheck className={styles.resolvedIcon} aria-hidden="true" />} title="Resolved" meta={`by ${person_.name}`} />;
    case "message":
      return <Bubble message={row.message} reduced={reduced} />;
    case "typing":
      return row.who === "assistant" ? (
        <div className={styles.thinking}><TextShimmer duration={1.4}>Thinking</TextShimmer></div>
      ) : (
        <div className={styles.bubble} data-from="agent" data-typing="" role="img" aria-label={`${firstName} is typing`}>
          <i /><i /><i />
        </div>
      );
    case "ask":
      return (
        <div className={styles.askRow}>
          <button type="button" className={styles.ask} onClick={onRequestHuman}>
            <Headset aria-hidden="true" />
            Talk to a person
          </button>
        </div>
      );
    case "handoff":
      return (
        <HandoffCard
          stage={stage}
          summary={summary}
          desk={desk}
          personName={person_.name}
          replyEstimate={replyEstimate}
          onCancel={onCancel}
          onRetry={onRetry}
        />
      );
  }
}

function NodeRow({ mark, title, meta, time }: { mark: ReactNode; title: string; meta?: string; time?: string }) {
  return (
    <div className={styles.node}>
      <span className={styles.nodeMark}>{mark}</span>
      <span className={styles.nodeText}>
        <span className={styles.nodeTitle}>{title}</span>
        {meta && <span className={styles.nodeMeta}>{meta}</span>}
      </span>
      {time && <time className={styles.time}>{time}</time>}
    </div>
  );
}

function Bubble({ message, reduced }: { message: HandoffMessage; reduced: boolean }) {
  return (
    <div className={styles.bubble} data-from={message.from} data-streaming={message.streaming || undefined}>
      <StreamingText text={message.text} streaming={!!message.streaming && !reduced} />
    </div>
  );
}

/** Keeps the chunks a streamed reply has grown through, so each new one fades in on its own. */
function StreamingText({ text, streaming }: { text: string; streaming: boolean }) {
  const [seen, setSeen] = useState(() => ({ text, chunks: text ? [text] : [] as string[] }));
  let chunks = seen.chunks;
  if (seen.text !== text) {
    chunks = text.startsWith(seen.text) ? [...seen.chunks, text.slice(seen.text.length)] : [text];
    setSeen({ text, chunks });
  }
  if (!streaming) return <>{text}</>;
  return <>{chunks.map((chunk, index) => <span key={index} className={styles.chunk}>{chunk}</span>)}</>;
}

function HandoffCard({
  stage,
  summary,
  desk,
  personName,
  replyEstimate,
  onCancel,
  onRetry,
}: {
  stage: AgentHandoffStage;
  summary?: HandoffSummary;
  desk: { name: string; mark: ReactNode };
  personName: string;
  replyEstimate: string;
  onCancel?: () => void;
  onRetry?: () => void;
}) {
  const [open, setOpen] = useState(true);
  const summaryId = useId();
  const status = stage === "transferring" ? { key: "transferring", title: <TextShimmer duration={1.6}>Transferring to a person</TextShimmer>, meta: `${desk.name} · typical reply in ${replyEstimate}` }
    : stage === "unavailable" ? { key: "unavailable", title: "No one is available right now", meta: `${desk.name} · the team replies by email` }
      : { key: "done", title: `Transferred to ${personName}`, meta: `${desk.name} · summary read` };
  const action = stage === "transferring" && onCancel
    ? <Button key="cancel" variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
    : stage === "unavailable" && onRetry
      ? <Button key="retry" variant="primary" size="sm" onClick={onRetry}>Try again</Button>
      : null;

  return (
    <div className={styles.handoff}>
      <span className={styles.deskMark} aria-hidden="true">{desk.mark}</span>
      <section className={styles.card} aria-label="Handoff to a person">
        <div className={styles.cardHead}>
          <div className={styles.cardStatus}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={status.key}
                className={styles.cardStatusInner}
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0, transition: { duration: motionTokens.duration.fast, ease: easeStandard } }}
                exit={{ opacity: 0, transition: { duration: 0.1, ease: easeStandard } }}
              >
                <span className={styles.cardTitle}>
                  {stage === "unavailable" && <CircleAlert className={styles.warnIcon} aria-hidden="true" />}
                  {(stage === "connected" || stage === "resolved") && <CircleCheck className={styles.okIcon} aria-hidden="true" />}
                  {status.title}
                </span>
                <span className={styles.cardMeta}>{status.meta}</span>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className={styles.cardAction}>
            <AnimatePresence mode="popLayout" initial={false}>
              {action && (
                <motion.div
                  key={action.key}
                  initial={{ opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: motionTokens.duration.fast, ease: easeStandard } }}
                  exit={{ opacity: 0, transition: { duration: 0.1, ease: easeStandard } }}
                >
                  {action}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        {summary && (
          <>
            <button type="button" className={styles.summaryToggle} aria-expanded={open} aria-controls={summaryId} onClick={() => setOpen(value => !value)}>
              <span>Summary shared with the team</span>
              <ChevronDown className={styles.chevron} data-open={open || undefined} aria-hidden="true" />
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  id={summaryId}
                  className={styles.summary}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: motionTokens.duration.fast, ease: easeStandard } }}
                >
                  <p className={styles.issue}>{summary.issue}</p>
                  {!!summary.fields?.length && (
                    <dl className={styles.fields}>
                      {summary.fields.map(field => (
                        <div key={field.label} className={styles.field}>
                          <dt>{field.label}</dt>
                          <dd>{field.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </section>
    </div>
  );
}

function StatusChip({ stage, name }: { stage: AgentHandoffStage; name: string }) {
  const chip = stage === "assistant" ? { icon: <Bot aria-hidden="true" />, label: "Assistant" }
    : stage === "transferring" ? { icon: <LoaderCircle className={styles.spin} aria-hidden="true" />, label: "Transferring" }
      : stage === "connected" ? { icon: <Headset aria-hidden="true" />, label: `With ${name}` }
        : stage === "resolved" ? { icon: <CircleCheck className={styles.okIcon} aria-hidden="true" />, label: "Resolved" }
          : { icon: <CircleAlert className={styles.warnIcon} aria-hidden="true" />, label: "No one available" };
  return (
    <span className={styles.chip}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={stage}
          className={styles.chipInner}
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0, transition: { duration: motionTokens.duration.fast, ease: easeStandard } }}
          exit={{ opacity: 0, transition: { duration: 0.1, ease: easeStandard } }}
        >
          {chip.icon}
          {chip.label}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Composer({
  stage,
  name,
  assistantName,
  placeholder,
  onSend,
}: {
  stage: AgentHandoffStage;
  name: string;
  assistantName: string;
  placeholder?: string;
  onSend: (text: string) => void;
}) {
  const [value, setValue] = useState("");
  const hint = placeholder ?? {
    assistant: `Message the ${assistantName.toLowerCase()}`,
    transferring: "Add details for the team",
    connected: `Message ${name}`,
    resolved: `Reply to ${name}`,
    unavailable: "Leave a message for the team",
  }[stage];
  return (
    <form
      className={styles.composer}
      onSubmit={event => {
        event.preventDefault();
        const text = value.trim();
        if (!text) return;
        onSend(text);
        setValue("");
      }}
    >
      <input
        className={styles.input}
        value={value}
        onChange={event => setValue(event.target.value)}
        placeholder={hint}
        aria-label="Message"
        enterKeyHint="send"
        autoComplete="off"
      />
      <Button type="submit" variant="primary" size="sm" className={styles.send} aria-label="Send" disabled={!value.trim()}>
        <ArrowUp aria-hidden="true" />
      </Button>
    </form>
  );
}

/** Animates the thread to its measured height, so streamed lines push it up instead of snapping. */
function HeightClip({ reduced, children }: { reduced: boolean; children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const height = useMotionValue<number | string>("auto");
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let first = true;
    let controls: AnimationPlaybackControls | undefined;
    const observer = new ResizeObserver(() => {
      const next = node.offsetHeight;
      if (first || reduced) {
        controls?.stop();
        height.set(next);
        first = false;
        return;
      }
      controls?.stop();
      controls = animate(height, next, heightSpring);
    });
    observer.observe(node);
    return () => { observer.disconnect(); controls?.stop(); };
  }, [height, reduced]);
  return (
    <motion.div className={styles.clip} style={{ height }}>
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

function ClaudeMark({ title = "Claude", ...props }: React.SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

function IntercomMark({ title = "Intercom", ...props }: React.SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M21 0H3C1.343 0 0 1.343 0 3v18c0 1.658 1.343 3 3 3h18c1.658 0 3-1.342 3-3V3c0-1.657-1.342-3-3-3zm-5.801 4.399c0-.44.36-.8.802-.8.44 0 .8.36.8.8v10.688c0 .442-.36.801-.8.801-.443 0-.802-.359-.802-.801V4.399zM11.2 3.994c0-.44.357-.799.8-.799s.8.359.8.799v11.602c0 .44-.357.8-.8.8s-.8-.36-.8-.8V3.994zm-4 .405c0-.44.359-.8.799-.8.443 0 .802.36.802.8v10.688c0 .442-.36.801-.802.801-.44 0-.799-.359-.799-.801V4.399zM3.199 6c0-.442.36-.8.802-.8.44 0 .799.358.799.8v7.195c0 .441-.359.8-.799.8-.443 0-.802-.36-.802-.8V6zM20.52 18.202c-.123.105-3.086 2.593-8.52 2.593-5.433 0-8.397-2.486-8.521-2.593-.335-.288-.375-.792-.086-1.128.285-.334.79-.375 1.125-.09.047.041 2.693 2.211 7.481 2.211 4.848 0 7.456-2.186 7.479-2.207.334-.289.839-.25 1.128.086.289.336.25.84-.086 1.128zm.281-5.007c0 .441-.36.8-.801.8-.441 0-.801-.36-.801-.8V6c0-.442.361-.8.801-.8.441 0 .801.357.801.8v7.195z" />
    </svg>
  );
}

function ZendeskMark({ title = "Zendesk", ...props }: React.SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M12.914 2.904V16.29L24 2.905H12.914zM0 2.906C0 5.966 2.483 8.45 5.543 8.45s5.542-2.484 5.543-5.544H0zm11.086 4.807L0 21.096h11.086V7.713zm7.37 7.84c-3.063 0-5.542 2.48-5.542 5.543H24c0-3.06-2.48-5.543-5.543-5.543z" />
    </svg>
  );
}

function NorthwindMark({ title = "Northwind", ...props }: React.SVGProps<SVGSVGElement> & { title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} role="img" aria-label={title} {...props}>
      <defs>
        <linearGradient id={`${id}-light`} x1="8" y1="3" x2="8" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" stopOpacity=".42" />
          <stop offset="1" stopColor="currentColor" stopOpacity=".72" />
        </linearGradient>
        <linearGradient id={`${id}-dark`} x1="16" y1="3" x2="16" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" stopOpacity=".88" />
          <stop offset="1" stopColor="currentColor" stopOpacity="1" />
        </linearGradient>
      </defs>
      <path d="M12 2.5 4.75 20.75 12 16.9Z" fill={`url(#${id}-light)`} />
      <path d="M12 2.5 19.25 20.75 12 16.9Z" fill={`url(#${id}-dark)`} />
    </svg>
  );
}

export default AgentHandoff;
