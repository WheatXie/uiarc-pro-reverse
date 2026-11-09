"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import type { LucideProps } from "lucide-react";
import { AtSign, CircleAlert, CircleCheck, CreditCard, Phone, RotateCcw, ScanText, SendHorizontal, ShieldCheck, Square, UserRound } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { Switch } from "../switch/switch";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { people } from "../lib/media";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./pii-redaction.module.css";

export type PiiType = "name" | "email" | "phone" | "card";

/** A span of personal data in a message, with an exclusive end. */
export interface PiiMatch {
  type: PiiType;
  start: number;
  end: number;
}

/** A detected span with the text it covers and the placeholder that replaces it, such as EMAIL_1. */
export interface PiiEntity extends PiiMatch {
  value: string;
  token: string;
}

export type PiiRedactionPhase = "idle" | "scanning" | "redacted" | "sending" | "thinking" | "streaming" | "restoring" | "done" | "error";

export interface PiiRedactionProps {
  /** The message to check. The sample is a double charge support request from Sofia Ramirez with a name, a Luhn-valid test card, an email and a phone number. */
  defaultMessage?: string;
  /** Lets people edit the message before a scan. Cmd or Ctrl plus Enter scans from the field. */
  editable?: boolean;
  /** Names the built-in detector always flags, on top of introductions like "I'm", "this is" and "my name is". */
  names?: string[];
  /** Replaces the built-in detector, for example with your DLP or NER service. */
  detect?: (text: string, signal: AbortSignal) => PiiMatch[] | Promise<PiiMatch[]>;
  /** Sends the redacted prompt to your model and resolves with its reply, placeholders included. */
  send?: (prompt: string, signal: AbortSignal) => Promise<string>;
  /** The model the safe prompt goes to, on the flow and above the reply. The mark draws at 16px. */
  model?: { name: string; mark?: ReactNode };
  /** Plays scan, send and restore on a loop while at least a quarter of the card is on screen. */
  autoPlay?: boolean;
  /** Shows the original message instead of the safe prompt once it is redacted. */
  showOriginal?: boolean;
  /** Initial Show original state when uncontrolled. */
  defaultShowOriginal?: boolean;
  /** Called when the Show original switch changes. */
  onShowOriginalChange?: (show: boolean) => void;
  /** Called once the message is redacted, with the safe prompt and every entity. */
  onRedact?: (result: { prompt: string; entities: PiiEntity[] }) => void;
  /** Called when the reply is restored, with the model's raw reply and the text the person sees. */
  onReply?: (reply: { raw: string; restored: string }) => void;
  /** Called on every phase change. */
  onPhaseChange?: (phase: PiiRedactionPhase) => void;
  /** Class on the root card. */
  className?: string;
}

const TYPE_ORDER: PiiType[] = ["name", "email", "phone", "card"];
const TYPE_LABEL: Record<PiiType, string> = { name: "Name", email: "Email", phone: "Phone", card: "Card" };
const TYPE_TOKEN: Record<PiiType, string> = { name: "NAME", email: "EMAIL", phone: "PHONE", card: "CARD" };
const TYPE_ICON: Record<PiiType, (props: LucideProps) => ReactNode> = { name: UserRound, email: AtSign, phone: Phone, card: CreditCard };

export const piiSampleMessage =
  "Hi, this is Sofia Ramirez. I was charged twice for my October 24 order on the card 4539 1488 0343 6467. Could you refund the duplicate $48.00? You can reach me at sofia.ramirez@fastmail.com or +1 415 555 0132.";
export const piiSampleNames = ["Sofia Ramirez"];
export const piiSampleReply =
  "Thanks, [NAME_1]. I can see two charges of $48.00 on [CARD_1] from October 24, and the second one is a duplicate. I have started a refund, which usually lands in 3 to 5 business days. A confirmation is on its way to [EMAIL_1], and we will text [PHONE_1] if we need anything else.";
const DEFAULT_MODEL = { name: "Claude Sonnet 5.5" };

const OPEN_PHASES: PiiRedactionPhase[] = ["redacted", "sending", "thinking", "streaming", "restoring", "done"];
const BUSY_PHASES: PiiRedactionPhase[] = ["scanning", "sending", "thinking", "streaming", "restoring"];
const TOKEN_SPAN = /\[((?:NAME|EMAIL|PHONE|CARD)_\d+)\]/g;

const cx = (...list: (string | false | undefined)[]) => list.filter(Boolean).join(" ");

function luhn(value: string) {
  let sum = 0;
  for (let index = 0; index < value.length; index++) {
    let digit = Number(value[value.length - 1 - index]);
    if (index % 2 && (digit *= 2) > 9) digit -= 9;
    sum += digit;
  }
  return sum % 10 === 0;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Finds emails, card numbers that pass Luhn, phone numbers and names, sorted by position. */
export function detectPii(text: string, { names }: { names?: string[] } = {}): PiiMatch[] {
  const out: PiiMatch[] = [];
  const push = (type: PiiType, start: number, end: number) => {
    if (out.some((item) => start < item.end && end > item.start)) return;
    out.push({ type, start, end });
  };
  for (const match of text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g)) push("email", match.index, match.index + match[0].length);
  for (const match of text.matchAll(/(?<![\d-])\d(?:[ -]?\d){12,18}(?![\d-])/g)) {
    if (luhn(match[0].replace(/\D/g, ""))) push("card", match.index, match.index + match[0].length);
  }
  for (const match of text.matchAll(/(?<![\w+])\+?\(?\d[\d\s().-]{5,}\d(?![\w])/g)) {
    const digits = match[0].replace(/\D/g, "").length;
    const numeric = /^\d+[.,]\d{1,2}$/.test(match[0]) || /^\d{4}[-./]\d{1,2}[-./]\d{1,2}$|^\d{1,2}[-./]\d{1,2}[-./]\d{2,4}$/.test(match[0].trim());
    if (digits >= 7 && digits <= 15 && !numeric) push("phone", match.index, match.index + match[0].length);
  }
  for (const name of names ?? []) {
    if (!name.trim()) continue;
    for (const match of text.matchAll(RegExp(`(?<![\\w])${escapeRegExp(name.trim())}(?![\\w])`, "g"))) push("name", match.index, match.index + match[0].length);
  }
  for (const match of text.matchAll(/\b(?:I'm|I’m|I am|this is|This is|my name is|My name is)\s+([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+){0,2})/g)) {
    const start = match.index + match[0].length - match[1].length;
    push("name", start, start + match[1].length);
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Swaps every match for a numbered placeholder, giving a repeated value the same token. */
export function redactPii(text: string, matches: PiiMatch[]): { prompt: string; entities: PiiEntity[] } {
  const counts: Partial<Record<PiiType, number>> = {};
  const seen = new Map<string, string>();
  const entities: PiiEntity[] = [];
  let prompt = "";
  let cursor = 0;
  for (const match of [...matches].sort((a, b) => a.start - b.start)) {
    if (match.start < cursor || match.end > text.length || match.end <= match.start) continue;
    const value = text.slice(match.start, match.end);
    const key = `${match.type}:${value}`;
    let token = seen.get(key);
    if (!token) {
      counts[match.type] = (counts[match.type] ?? 0) + 1;
      token = `${TYPE_TOKEN[match.type]}_${counts[match.type]}`;
      seen.set(key, token);
    }
    entities.push({ ...match, value, token });
    prompt += `${text.slice(cursor, match.start)}[${token}]`;
    cursor = match.end;
  }
  return { prompt: prompt + text.slice(cursor), entities };
}

/** Puts the original values back and leaves unknown tokens as they are. */
export function restorePii(reply: string, entities: PiiEntity[]) {
  const byToken = new Map(entities.map((entity) => [entity.token, entity.value]));
  return reply.replace(TOKEN_SPAN, (whole, token: string) => byToken.get(token) ?? whole);
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    if (ms <= 0) return resolve();
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      window.clearTimeout(timer);
      reject(signal.reason);
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });

/** Three to six words at a time, so the reply streams the way a model writes. */
function chunkReply(text: string) {
  const words = text.match(/\s*\S+\s*/g) ?? [];
  const chunks: string[] = [];
  for (let index = 0, pass = 0; index < words.length; pass++) {
    const take = 3 + (pass % 4);
    chunks.push(words.slice(index, index + take).join(""));
    index += take;
  }
  return chunks;
}

function Spinner() {
  return (
    <svg className={styles.spinner} width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".2" strokeWidth="1.75" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function ClaudeMark({ title = "Claude", ...props }: { title?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

/** Crossfades a child in place, so labels and statuses change without moving. */
function Swap({ id, reduced, className, children }: { id: string; reduced: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={cx(styles.swap, className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={{ opacity: 0, y: 2 * Number(!reduced) }}
          animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0 : motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } }}
          exit={{ opacity: 0, transition: { duration: 0.1 * Number(!reduced), ease: "easeOut" } }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** The safe prompt, with each placeholder tinted by the type of data it stands in for. */
function TokenText({ text, entities }: { text: string; entities: PiiEntity[] }) {
  const byToken = new Map(entities.map((entity) => [entity.token, entity.type]));
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(TOKEN_SPAN)) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const type = byToken.get(match[1]);
    nodes.push(
      <span className={styles.token} data-type={type} key={match.index}>
        {match[0]}
      </span>,
    );
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

/** The original message, each entity marked in its type colour once its turn has been scanned. */
function HighlightedText({ text, entities, hits, label }: { text: string; entities: PiiEntity[]; hits: number; label: (entity: PiiEntity) => string }) {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  entities.forEach((entity, index) => {
    if (entity.start > cursor) nodes.push(text.slice(cursor, entity.start));
    nodes.push(
      <mark className={styles.mark} data-type={entity.type} data-hit={index < hits || undefined} aria-label={label(entity)} key={entity.start}>
        {text.slice(entity.start, entity.end)}
      </mark>,
    );
    cursor = entity.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

/** The model's reply with the original values put back, still marked by type. */
function RestoredText({ raw, entities }: { raw: string; entities: PiiEntity[] }) {
  const byToken = new Map(entities.map((entity) => [entity.token, entity]));
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of raw.matchAll(TOKEN_SPAN)) {
    const entity = byToken.get(match[1]);
    if (match.index > cursor) nodes.push(raw.slice(cursor, match.index));
    nodes.push(
      entity ? (
        <mark className={styles.mark} data-type={entity.type} data-hit="" key={match.index}>
          {entity.value}
        </mark>
      ) : (
        match[0]
      ),
    );
    cursor = match.index + match[0].length;
  }
  if (cursor < raw.length) nodes.push(raw.slice(cursor));
  return <>{nodes}</>;
}

/** One connector of the flow, with a dot that travels it on each hop. */
function Leg({ pulse, active, reduced }: { pulse: { leg: number; dir: number; key: number } | null; active: boolean; reduced: boolean }) {
  return (
    <span className={styles.leg} data-active={active || undefined} aria-hidden="true">
      <span className={styles.legLine} />
      {pulse && !reduced ? (
        <motion.span
          className={styles.legTrack}
          key={pulse.key}
          initial={{ x: pulse.dir > 0 ? "0%" : "100%" }}
          animate={{ x: pulse.dir > 0 ? "100%" : "0%" }}
          transition={{ duration: 0.46, ease: [...motionTokens.ease.inOut] }}
        >
          <motion.span className={styles.dot} initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 0.46, times: [0, 0.12, 0.86, 1], ease: "linear" }} />
        </motion.span>
      ) : null}
    </span>
  );
}

/**
 * A guardrail card that shows personal data being redacted before a prompt reaches the model.
 * Scan marks each name, email, phone number and card in the message with its type, then swaps each one for a numbered
 * placeholder such as [EMAIL_1] in a single crossfade. Send carries the safe prompt along a small flow (you, the PII
 * guard, the model), the reply streams back in quick chunks with its placeholders, and the guard restores the original
 * values for the person. Show original flips the message between the safe prompt and what was typed.
 */
export function PiiRedaction({
  defaultMessage = piiSampleMessage,
  editable = true,
  names = piiSampleNames,
  detect,
  send,
  model = DEFAULT_MODEL,
  autoPlay = true,
  showOriginal,
  defaultShowOriginal = false,
  onShowOriginalChange,
  onRedact,
  onReply,
  onPhaseChange,
  className,
}: PiiRedactionProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const controller = useRef<AbortController>(null);
  const pulseKey = useRef(0);

  const [message, setMessage] = useState(defaultMessage);
  const [phase, setPhaseState] = useState<PiiRedactionPhase>("idle");
  const [redaction, setRedaction] = useState<{ prompt: string; entities: PiiEntity[]; source: string } | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [reply, setReply] = useState<{ raw: string; restored: string } | null>(null);
  const [streamed, setStreamed] = useState(0);
  const [pulse, setPulse] = useState<{ leg: number; dir: number; key: number } | null>(null);
  const [error, setError] = useState<{ at: "scan" | "send"; message: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [auto, setAuto] = useState(autoPlay);
  const [inView, setInView] = useState(false);
  const [showOriginalState, setShowOriginalState] = useState(defaultShowOriginal);

  const original = showOriginal ?? showOriginalState;
  /** A redaction only describes the message it was made from. */
  const current = redaction && redaction.source === message ? redaction : null;
  const hasPrompt = !!current && (OPEN_PHASES.includes(phase) || (phase === "error" && error?.at === "send"));
  const busy = BUSY_PHASES.includes(phase);
  const modelFirst = model.name.split(" ")[0] || "the model";
  const modelMark = model.mark ?? <ClaudeMark width={16} height={16} title="" aria-hidden="true" className={styles.claude} />;
  const hits = current?.entities.length ?? 0;

  const go = (next: PiiRedactionPhase) => {
    setPhaseState(next);
    onPhaseChange?.(next);
  };
  const hop = (leg: number, dir: number) => setPulse({ leg, dir, key: ++pulseKey.current });
  const abortable = () => {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    return next.signal;
  };
  const fail = (at: "scan" | "send", cause: unknown, signal: AbortSignal) => {
    if (signal.aborted) return;
    setError({ at, message: cause instanceof Error && cause.message ? cause.message : at === "scan" ? "The scan failed" : "The model did not answer" });
    go("error");
    setAuto(false);
  };

  /** Before the first send the sample conversation is previewed behind the placeholder layer, so the height never jumps. */
  const preview = useMemo(() => (send || defaultMessage !== piiSampleMessage ? null : { raw: piiSampleReply, entities: redactPii(piiSampleMessage, detectPii(piiSampleMessage, { names: piiSampleNames })).entities }), [send, defaultMessage]);
  const chunks = useMemo(() => chunkReply(reply?.raw ?? ""), [reply]);

  async function scan() {
    const signal = abortable();
    setNotice("");
    setError(null);
    setRevealed(0);
    setStreamed(0);
    setReply(null);
    go("scanning");
    hop(0, 1);
    try {
      const [matches] = await Promise.all([Promise.resolve(detect ? detect(message, signal) : detectPii(message, { names })), wait(380 * Number(!reduced), signal)]);
      const result = { ...redactPii(message, matches), source: message };
      setRedaction(result);
      for (let count = 1; count <= result.entities.length; count++) {
        setRevealed(count);
        await wait(120 * Number(!reduced), signal);
      }
      await wait(200 * Number(!reduced), signal);
      go("redacted");
      onRedact?.({ prompt: result.prompt, entities: result.entities });
    } catch (cause) {
      fail("scan", cause, signal);
    }
  }

  function simulatedReply(prompt: string, entities: PiiEntity[]) {
    if (prompt === redactPii(piiSampleMessage, detectPii(piiSampleMessage, { names: piiSampleNames })).prompt) return piiSampleReply;
    const token = (type: PiiType) => entities.find((entity) => entity.type === type)?.token;
    const name = token("name");
    const card = token("card");
    const email = token("email");
    const phone = token("phone");
    if (!entities.length) return "Thanks for the message. I did not find any personal details in it, so it reached me exactly as you wrote it. How can I help?";
    const lines = [name ? `Thanks, [${name}].` : "Thanks for the details."];
    if (card) lines.push(`I have flagged the latest charge on [${card}] for review.`);
    if (email && phone) lines.push(`I will send a summary to [${email}] and text [${phone}] if anything changes.`);
    else if (email) lines.push(`I will send a summary to [${email}] within the hour.`);
    else if (phone) lines.push(`I will text [${phone}] if anything changes.`);
    if (!card && !email && !phone) lines.push("What can I help you with today?");
    return lines.join(" ");
  }

  async function deliver() {
    if (!current) return;
    const signal = abortable();
    setNotice("");
    setError(null);
    setStreamed(0);
    setReply(null);
    go("sending");
    hop(1, 1);
    try {
      await wait(460 * Number(!reduced), signal);
      go("thinking");
      const raw = send ? await send(current.prompt, signal) : (await wait(700 * Number(!reduced), signal), simulatedReply(current.prompt, current.entities));
      if (signal.aborted) return;
      const restored = restorePii(raw, current.entities);
      const pieces = chunkReply(raw);
      setReply({ raw, restored });
      go("streaming");
      hop(1, -1);
      if (reduced) setStreamed(pieces.length);
      else for (let index = 1; index <= pieces.length; index++) (setStreamed(index), await wait(34, signal));
      await wait(240 * Number(!reduced), signal);
      go("restoring");
      hop(0, -1);
      await wait(460 * Number(!reduced), signal);
      go("done");
      onReply?.({ raw, restored });
    } catch (cause) {
      fail("send", cause, signal);
    }
  }

  function reset(focus: boolean) {
    controller.current?.abort();
    setRevealed(0);
    setError(null);
    setNotice("");
    setPulse(null);
    go("idle");
    if (focus && editable) requestAnimationFrame(() => fieldRef.current?.focus());
  }

  const latest = useRef({ scan, deliver, reset });
  useLayoutEffect(() => {
    latest.current = { scan, deliver, reset };
  });

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return void setInView(true);
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // The loop plays only while the card is on screen, and stops for good on the first interaction.
  useEffect(() => {
    if (!auto || !inView || reduced) return;
    const delay = phase === "idle" ? 900 : phase === "redacted" ? 620 : 2800 * Number(phase === "done");
    if (!delay) return;
    const timer = window.setTimeout(() => {
      if (phase === "idle") latest.current.scan();
      else if (phase === "redacted") latest.current.deliver();
      else latest.current.reset(false);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [auto, inView, reduced, phase]);

  useEffect(() => () => controller.current?.abort(), []);

  const stopAuto = () => setAuto(false);

  const action =
    phase === "idle"
      ? { key: "scan", label: "Scan", icon: <ScanText size={16} strokeWidth={1.75} aria-hidden="true" />, accent: true, disabled: !message.trim() }
      : busy
        ? { key: "stop", label: "Stop", icon: <Square size={12} strokeWidth={2} fill="currentColor" aria-hidden="true" />, accent: false, disabled: false }
        : phase === "redacted"
          ? { key: "send", label: "Send", icon: <SendHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />, accent: true, disabled: false }
          : phase === "error"
            ? { key: "retry", label: "Retry", icon: <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />, accent: true, disabled: false }
            : { key: "again", label: "Run again", icon: <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />, accent: false, disabled: false };
  const canReset = phase === "redacted" || phase === "done" || phase === "error";
  const status =
    phase === "scanning"
      ? { key: "scanning", icon: <Spinner />, label: "Scanning for personal data", shimmer: true }
      : phase === "redacted"
        ? notice
          ? { key: "stopped", icon: <CircleAlert size={16} strokeWidth={1.75} />, label: notice }
          : { key: "redacted", icon: <CircleCheck size={16} strokeWidth={1.75} />, label: hits ? `${hits} item${hits === 1 ? "" : "s"} redacted` : "No personal data found", tone: "success" }
        : phase === "sending"
          ? { key: "sending", icon: <Spinner />, label: "Sending the safe prompt", shimmer: true }
          : phase === "thinking"
            ? { key: "thinking", icon: <Spinner />, label: `Waiting for ${modelFirst}`, shimmer: true }
            : phase === "streaming"
              ? { key: "streaming", icon: <Spinner />, label: "Receiving the reply", shimmer: true }
              : phase === "restoring"
                ? { key: "restoring", icon: <Spinner />, label: "Restoring your details", shimmer: true }
                : phase === "done"
                  ? { key: "done", icon: <CircleCheck size={16} strokeWidth={1.75} />, label: hits ? "Reply restored" : "Reply received", tone: "success" }
                  : phase === "error"
                    ? { key: "error", icon: <CircleAlert size={16} strokeWidth={1.75} />, label: error?.message || "Something went wrong", tone: "danger" }
                    : notice
                      ? { key: "notice", icon: <CircleAlert size={16} strokeWidth={1.75} />, label: notice }
                      : { key: "idle", icon: <ShieldCheck size={16} strokeWidth={1.75} />, label: message.trim() ? "Ready to scan" : "Add a message to scan" };
  const simulated = !send && (phase === "done" || phase === "streaming" || phase === "restoring");
  const announcement = `${status.label}.${simulated ? " Simulated, nothing was sent." : ""}`;
  const sectionLabel = hasPrompt ? (original ? "Original message" : "Safe prompt") : "Message";
  const showMessage = !hasPrompt || original;
  const meta = phase === "streaming" ? "stream" : phase === "restoring" || phase === "done" ? "restored" : "empty";
  const replyDoc = reply ? { raw: reply.raw, entities: current?.entities ?? [] } : preview;

  // The card springs to the height of the visible layer, so stacked layers never make it jump.
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let animation: ReturnType<typeof animate> | undefined;
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner || typeof ResizeObserver === "undefined") return;
    let height = inner.offsetHeight;
    let width = inner.offsetWidth;
    const clear = () => {
      outer.style.height = "";
      outer.style.overflow = "";
      animation = undefined;
    };
    const observer = new ResizeObserver(() => {
      const nextHeight = inner.offsetHeight;
      const nextWidth = inner.offsetWidth;
      const widthChanged = nextWidth !== width;
      width = nextWidth;
      if (nextHeight === height) return;
      const from = animation ? outer.getBoundingClientRect().height : height;
      height = nextHeight;
      if (reduced || widthChanged) clear();
      else {
        outer.style.overflow = "hidden";
        animation = animate(outer, { height: [from, nextHeight] }, { type: "spring", visualDuration: 0.24, bounce: 0, onComplete: clear });
      }
    });
    observer.observe(inner);
    return () => {
      observer.disconnect();
      animation?.stop();
    };
  }, [reduced]);

  const scanningGuard = phase === "scanning" || phase === "restoring";
  const modelBusy = phase === "thinking" || phase === "streaming";

  return (
    <div ref={rootRef} className={cx(styles.root, className)} data-phase={phase}>
      <section className={styles.section} aria-label={sectionLabel}>
        <div className={styles.head}>
          <Swap id={sectionLabel} reduced={reduced} className={styles.label}>
            <span aria-hidden="true">{sectionLabel}</span>
          </Swap>
          <span className={styles.toggle}>
            <label htmlFor={`${uid}-original`} className={styles.toggleLabel} data-disabled={!hasPrompt || undefined}>
              Show original
            </label>
            <Switch
              id={`${uid}-original`}
              className={styles.switch}
              checked={original}
              disabled={!hasPrompt}
              onCheckedChange={(checked) => {
                stopAuto();
                if (showOriginal === undefined) setShowOriginalState(checked);
                onShowOriginalChange?.(checked);
              }}
            />
          </span>
        </div>
        <div className={styles.well}>
          <div className={styles.stack}>
            <p className={styles.layer} data-on={showMessage || undefined} data-editing={(phase === "idle" && editable) || undefined} aria-hidden={!showMessage || (phase === "idle" && editable) || undefined}>
              {current ? <HighlightedText text={message} entities={current.entities} hits={phase === "idle" ? 0 : hasPrompt ? hits : revealed} label={(entity) => `${TYPE_LABEL[entity.type]}, redacted as ${entity.token}`} /> : message}
              {"\u200b"}
            </p>
            {current ? (
              <p className={styles.layer} data-on={!showMessage || undefined} aria-hidden={showMessage || undefined}>
                <TokenText text={current.prompt} entities={current.entities} />
              </p>
            ) : null}
            {phase === "idle" && editable ? (
              <textarea
                ref={fieldRef}
                className={styles.field}
                value={message}
                spellCheck={false}
                rows={1}
                aria-label="Message to check for personal data"
                placeholder="Paste a message with a name, email, phone number or card"
                onChange={(event) => {
                  stopAuto();
                  setMessage(event.target.value);
                  setNotice("");
                }}
                onFocus={stopAuto}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && message.trim()) {
                    event.preventDefault();
                    scan();
                    requestAnimationFrame(() => actionRef.current?.focus());
                  }
                }}
              />
            ) : null}
          </div>
        </div>
        <ul className={styles.types} aria-label="Detected entities">
          {TYPE_ORDER.map((type) => {
            const Icon = TYPE_ICON[type];
            const tokens = [...new Set((current ? current.entities.filter((entity, index) => entity.type === type && (hasPrompt || index < revealed)) : []).map((entity) => entity.token))];
            const complete = hasPrompt || (phase === "scanning" && !!current && revealed >= current.entities.length);
            const state = phase !== "idle" && (current || phase === "scanning") ? (tokens.length ? "found" : complete ? "none" : phase === "scanning" ? "checking" : "idle") : "idle";
            const detail = state === "found" ? `[${tokens[0]}]${tokens.length > 1 ? ` +${tokens.length - 1}` : ""}` : state === "none" ? "None found" : state === "checking" ? "Checking" : "Not scanned";
            return (
              <li className={styles.type} data-type={type} data-state={state} key={type}>
                <Icon size={14} strokeWidth={1.75} className={styles.typeIcon} aria-hidden="true" />
                <span className={styles.typeLabel}>{TYPE_LABEL[type]}</span>
                <Swap id={`${state}:${detail}`} reduced={reduced} className={styles.typeDetail}>
                  {state === "checking" ? <TextShimmer>{detail}</TextShimmer> : <span className={state === "found" ? styles.typeToken : undefined}>{detail}</span>}
                </Swap>
              </li>
            );
          })}
        </ul>
      </section>
      <div className={styles.flow} aria-hidden="true">
        <span className={styles.node} data-active={phase === "done" || undefined}>
          <Avatar name="Sofia Ramirez" src={people.find((person) => person.id === "sofia-ramirez")?.src} size="sm" className={styles.avatar} />
          <span className={styles.nodeLabel}>You</span>
        </span>
        <Leg pulse={pulse?.leg === 0 ? pulse : null} active={scanningGuard} reduced={reduced} />
        <span className={styles.node} data-active={scanningGuard || undefined}>
          <ShieldCheck size={16} strokeWidth={1.75} className={styles.guardIcon} data-on={hasPrompt || undefined} />
          <TextShimmer active={scanningGuard} className={styles.nodeLabel}>
            PII guard
          </TextShimmer>
        </span>
        <Leg pulse={pulse?.leg === 1 ? pulse : null} active={modelBusy} reduced={reduced} />
        <span className={styles.node} data-active={modelBusy || undefined}>
          <span className={styles.nodeMark}>{modelMark}</span>
          <TextShimmer active={modelBusy} className={cx(styles.nodeLabel, styles.modelName)}>
            {model.name}
          </TextShimmer>
        </span>
      </div>
      <section className={styles.section} aria-labelledby={`${uid}-reply`}>
        <div className={styles.head}>
          <span className={styles.label}>
            <span className={styles.replyMark} aria-hidden="true">
              {modelMark}
            </span>
            <span id={`${uid}-reply`}>Reply from {model.name}</span>
          </span>
          <Swap id={meta} reduced={reduced} className={styles.replyMeta}>
            {meta === "restored" ? (
              <span className={styles.replyRestored}>
                <CircleCheck size={14} strokeWidth={1.75} aria-hidden="true" />
                Restored
              </span>
            ) : meta === "stream" ? (
              <span>With placeholders</span>
            ) : (
              <span />
            )}
          </Swap>
        </div>
        <div ref={outerRef} className={styles.wellClip}>
          <div ref={innerRef} className={cx(styles.well, styles.replyWell)}>
            <div className={styles.stack}>
              <p className={cx(styles.layer, styles.placeholder)} data-on={meta === "empty" || undefined} aria-hidden={meta !== "empty" || undefined}>
                <Swap id={phase === "thinking" ? "thinking" : phase === "error" && error?.at === "send" ? "error" : "empty"} reduced={reduced}>
                  {phase === "thinking" ? (
                    <TextShimmer className={styles.thinking}>Thinking</TextShimmer>
                  ) : phase === "error" && error?.at === "send" ? (
                    <span>No reply. Nothing was shown to the person.</span>
                  ) : (
                    <span>The reply shows here, with your details put back.</span>
                  )}
                </Swap>
              </p>
              {reply ? (
                <p className={styles.layer} data-on={meta === "stream" || undefined} aria-hidden={meta !== "stream" || undefined}>
                  {chunks.slice(0, streamed).map((piece, index) => (
                    <motion.span key={index} initial={!reduced && { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.14, ease: "easeOut" }}>
                      <TokenText text={piece} entities={current?.entities ?? []} />
                    </motion.span>
                  ))}
                </p>
              ) : null}
              {replyDoc ? (
                <p className={styles.layer} data-on={(meta === "restored" && !!reply) || undefined} aria-hidden={meta !== "restored" || !reply || undefined}>
                  <RestoredText raw={replyDoc.raw} entities={replyDoc.entities} />
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
      <div className={styles.footer}>
        <span className={styles.status} data-tone={status.tone}>
          <Swap id={status.key + status.label} reduced={reduced} className={styles.statusSwap}>
            <span className={styles.statusIcon} aria-hidden="true">
              {status.icon}
            </span>
            <TextShimmer active={!!status.shimmer} className={styles.statusLabel}>
              {status.label}
            </TextShimmer>
            {simulated && phase === "done" ? <span className={styles.simulated}>Simulated</span> : null}
          </Swap>
        </span>
        <span className={styles.srOnly} role="status" aria-live="polite">
          {announcement}
        </span>
        <span className={styles.actions}>
          <AnimatePresence initial={false} mode="popLayout">
            {canReset ? (
              <motion.span className={styles.resetSlot} key="reset" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : motionTokens.duration.instant }}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.action}
                  onClick={() => {
                    stopAuto();
                    reset(true);
                  }}
                >
                  Reset
                </Button>
              </motion.span>
            ) : null}
          </AnimatePresence>
          <Button
            ref={actionRef}
            variant={action.accent ? "primary" : "secondary"}
            size="sm"
            className={cx(styles.action, action.accent && styles.accent)}
            disabled={action.disabled}
            onClick={() => {
              stopAuto();
              if (phase === "idle" || phase === "done") scan();
              else if (busy) {
                controller.current?.abort();
                setPulse(null);
                if (phase === "scanning") (setRevealed(0), go("idle"), setNotice("Scan stopped"));
                else (go("redacted"), setNotice("Stopped. No reply was shown"));
              } else if (phase === "redacted") deliver();
              else if (phase === "error") (error?.at === "send" && current ? deliver() : scan());
            }}
          >
            {action.icon}
            {action.label}
          </Button>
        </span>
      </div>
    </div>
  );
}

export default PiiRedaction;
