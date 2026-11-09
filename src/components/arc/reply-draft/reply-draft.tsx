"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import type { AnimationPlaybackControls } from "motion/react";
import { Check, CircleAlert, RotateCcw, Sparkles } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { motionTokens } from "../lib/motion-tokens";
import { avatar as avatarSrc } from "../lib/media";
import styles from "./reply-draft.module.css";

export type ReplyDraftTone = "friendly" | "concise" | "formal";
export type ReplyDraftLength = "short" | "medium" | "long";
export type ReplyDraftMode = "draft" | "rewrite";

/** The received email the draft replies to. */
export interface ReplyDraftMessage {
  from: { name: string; email: string; avatar?: string };
  to?: string;
  subject: string;
  /** Blank lines split paragraphs. */
  body: string;
  receivedAt: string;
}

/** A quick reply chip that steers a fresh draft. */
export interface ReplyDraftSuggestion {
  id: string;
  label: string;
}

/** The model shown on the draft: its name and an optional 16px mark. */
export interface ReplyDraftModel {
  name: string;
  mark?: ReactNode;
}

/** What the generator is asked for. */
export interface ReplyDraftRequest {
  message: ReplyDraftMessage;
  tone: ReplyDraftTone;
  length: ReplyDraftLength;
  suggestion?: ReplyDraftSuggestion;
  mode: ReplyDraftMode;
  /** The current draft, including the reader's edits, for a rewrite. */
  previous?: string;
  signal: AbortSignal;
}

/** Return the whole reply (streamed locally in chunks), or yield chunks from your model stream. */
export type ReplyDraftGenerate = (request: ReplyDraftRequest) => Promise<string> | AsyncIterable<string>;

export interface ReplyDraftInsertMeta {
  tone: ReplyDraftTone;
  length: ReplyDraftLength;
  suggestion?: ReplyDraftSuggestion;
}

export interface ReplyDraftProps {
  /** The received email. */
  message?: ReplyDraftMessage;
  /** Quick replies shown as chips above the draft. Pass [] to hide the row. */
  suggestions?: ReplyDraftSuggestion[];
  /** Id of the quick reply that steers the first draft. Defaults to the first suggestion. */
  defaultSuggestion?: string;
  onSuggestionSelect?: (suggestion: ReplyDraftSuggestion) => void;
  model?: ReplyDraftModel;
  tone?: ReplyDraftTone;
  defaultTone?: ReplyDraftTone;
  onToneChange?: (tone: ReplyDraftTone) => void;
  length?: ReplyDraftLength;
  defaultLength?: ReplyDraftLength;
  onLengthChange?: (length: ReplyDraftLength) => void;
  /** Writes the draft. Throw to show the error state. */
  generate?: ReplyDraftGenerate;
  /** Receives the final draft, including the reader's edits. While the returned promise is pending, Insert shows a spinner. */
  onInsert?: (draft: string, meta: ReplyDraftInsertMeta) => void | Promise<void>;
  /** Called each time a draft or rewrite finishes. */
  onDraft?: (draft: string, meta: ReplyDraftInsertMeta) => void;
  /** Start the first draft when the card scrolls into view. */
  autoStart?: boolean;
  /** Tours tones, length, a second quick reply and Insert on a loop. Stops for good on the first pointer or key press. */
  autoPlay?: boolean;
  className?: string;
}

const TONE_OPTIONS: { value: ReplyDraftTone; label: string }[] = [
  { value: "friendly", label: "Friendly" },
  { value: "concise", label: "Concise" },
  { value: "formal", label: "Formal" },
];

const LENGTH_OPTIONS: { value: ReplyDraftLength; label: string }[] = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
];

export const replyDraftSampleMessage: ReplyDraftMessage = {
  from: { name: "Diane Foster", email: "diane.foster@haldenlogistics.com", avatar: avatarSrc("diane-foster") },
  to: "me",
  subject: "Renewal call next week and an SSO question",
  body: "Hi Ryan,\n\nThanks for the updated quote. Before we sign the renewal for 180 seats, could we move Wednesday's call to Thursday afternoon? Our IT lead also wants to confirm that SAML SSO with Okta is included on the Business plan.\n\nBest,\nDiane",
  receivedAt: "9:14 AM",
};

export const replyDraftSampleSuggestions: ReplyDraftSuggestion[] = [
  { id: "thursday", label: "Thursday works" },
  { id: "friday", label: "Suggest Friday" },
  { id: "loop-in", label: "Loop in Daniel" },
];

export const replyDraftSampleModel: ReplyDraftModel = { name: "Claude Sonnet 5.5" };

/** The sentences each quick reply and tone ends up as, so the simulation reads like a real reply. */
const scripts: Record<string, Record<ReplyDraftTone, string[]>> = {
  thursday: {
    friendly: [
      "Thursday afternoon works great, I've moved our call to 2:00 PM and sent you an updated invite.",
      "Good news for your IT lead too: SAML SSO with Okta is included on the Business plan at no extra cost.",
      "Happy to send our Okta setup guide beforehand so they can take a look.",
      "Looking forward to getting all 180 seats renewed with you!",
    ],
    concise: [
      "Thursday at 2:00 PM works, updated invite sent.",
      "SAML SSO with Okta is included on the Business plan.",
      "I can share the Okta setup guide if useful.",
      "The renewal for 180 seats is ready to sign.",
    ],
    formal: [
      "Thank you for your note. I have moved our call to Thursday at 2:00 PM and sent an updated invitation.",
      "I can also confirm that SAML single sign-on with Okta is included in the Business plan.",
      "Should your IT lead wish to review the configuration in advance, I would be glad to share our Okta setup guide.",
      "We look forward to continuing our partnership with the renewal of your 180 seats.",
    ],
  },
  friday: {
    friendly: [
      "Thursday's packed on my end, unfortunately. Would Friday at 10:00 AM work instead?",
      "On SSO: yes, SAML with Okta is included on the Business plan, so your IT lead is all set.",
      "If Friday doesn't suit, send me a couple of times and I'll make one work.",
      "Thanks again for the quick turnaround on the quote!",
    ],
    concise: [
      "Thursday is full for me. Does Friday at 10:00 AM work?",
      "SAML SSO with Okta is included on Business.",
      "Otherwise, send two times that suit you.",
      "The quote stays valid through November 14.",
    ],
    formal: [
      "Unfortunately, I am unavailable on Thursday afternoon. Might Friday at 10:00 AM suit you instead?",
      "Regarding your IT lead's question, SAML single sign-on with Okta is included in the Business plan.",
      "If Friday is not convenient, please let me know a few times that work for your team.",
      "The quote remains valid through November 14.",
    ],
  },
  "loop-in": {
    friendly: [
      "Thursday afternoon works, I'll send an invite for 2:00 PM.",
      "I'm looping in Daniel Kim from our solutions team, who set up Okta SSO for three customers this month.",
      "He can join the call and answer anything your IT lead throws at him.",
      "Thanks for keeping things moving, Diane!",
    ],
    concise: [
      "Thursday at 2:00 PM works, invite to follow.",
      "Adding Daniel Kim from solutions for the SSO questions.",
      "He'll join the call to cover the Okta setup.",
      "Renewal paperwork is ready when you are.",
    ],
    formal: [
      "Thursday at 2:00 PM suits us well, and I will send an invitation shortly.",
      "I have copied my colleague Daniel Kim, a solutions engineer, who can address your IT lead's questions about Okta SSO.",
      "He will join the call to walk through the configuration in detail.",
      "Thank you for your continued partnership.",
    ],
  },
};

const OPENER: Record<ReplyDraftTone, (name: string) => string> = {
  friendly: name => `Hi ${name},`,
  concise: name => `Hi ${name},`,
  formal: name => `Dear ${name},`,
};

const SIGNOFF: Record<ReplyDraftTone, string> = {
  friendly: "Talk soon,\nRyan",
  concise: "Best,\nRyan",
  formal: "Kind regards,\nRyan Sullivan",
};

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** Splits the reply into word groups of 3 to 8, keeping the leading blank line on the first group. */
function chunkText(text: string) {
  const words = text.match(/\S+\s*/g) ?? [];
  const groups: string[] = [];
  let cursor = 0;
  let index = 0;
  while (cursor < words.length) {
    const size = 3 + ((7 * index + 3) % 6);
    groups.push(words.slice(cursor, cursor + size).join(""));
    cursor += size;
    index += 1;
  }
  const lead = text.match(/^\s*/)?.[0] ?? "";
  if (lead && groups.length) groups[0] = lead + groups[0];
  return groups;
}

/** Writes a plausible reply from the bundled script, streamed the way a model stream arrives. */
export function simulateReplyDraft({ message, tone, length, suggestion, mode, signal }: ReplyDraftRequest): Promise<string> | AsyncIterable<string> {
  const lines = (scripts[suggestion?.id ?? "thursday"] ?? scripts.thursday)[tone];
  const firstName = message.from.name.split(" ")[0] ?? message.from.name;
  const middle =
    length === "short"
      ? lines.slice(0, 2).join(" ")
      : length === "medium"
        ? lines.slice(0, 3).join(" ")
        : `${lines.slice(0, 2).join(" ")}

${lines.slice(2).join(" ")}`;
  const text = `${OPENER[tone](firstName)}

${middle}

${SIGNOFF[tone]}`;
  if (mode === "rewrite") return wait(420, signal).then(() => text);
  return (async function* stream() {
    await wait(620, signal);
    for (const group of chunkText(text)) {
      await wait(34, signal);
      yield group;
    }
  })();
}

function toneLabel(value: string) {
  return TONE_OPTIONS.find(option => option.value === value)?.label ?? value;
}

function lengthLabel(value: string) {
  return LENGTH_OPTIONS.find(option => option.value === value)?.label ?? value;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<string> {
  return typeof value === "object" && value !== null && Symbol.asyncIterator in value;
}

/** Reads a whole stream when motion is off or a rewrite lands in one piece. */
async function drain(source: Promise<string> | AsyncIterable<string>, signal: AbortSignal) {
  if (!isAsyncIterable(source)) return source;
  let text = "";
  for await (const piece of source) {
    if (signal.aborted) break;
    text += piece;
  }
  return text;
}

function ClaudeMark({ title = "Claude", ...props }: { title?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

function GmailMark({ title = "Gmail", ...props }: { title?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} {...props}>
      <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
    </svg>
  );
}

const easeStandard: [number, number, number, number] = [...motionTokens.ease.standard];

type Phase = "empty" | "thinking" | "streaming" | "rewriting" | "ready" | "inserting" | "inserted" | "error";

function toneGroup({
  label,
  options,
  value,
  onChange,
  reduced,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  reduced: boolean;
}) {
  return { label, options, value, onChange, reduced };
}

/** One chip row: a roving tabindex radiogroup with a highlight that glides between chips. */
function ChipGroup({ label, options, value, onChange, reduced }: ReturnType<typeof toneGroup>) {
  const layoutId = useId();
  const nodes = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = options.length - 1;
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    event.preventDefault();
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    nodes.current[next]?.focus();
  };
  return (
    <div className={styles.chipGroup} role="radiogroup" aria-label={label}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={node => {
              nodes.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className={styles.option}
            data-selected={selected || undefined}
            onClick={() => {
              if (!selected) onChange(option.value);
            }}
            onKeyDown={event => onKeyDown(event, index)}
          >
            {selected ? (
              <motion.span layoutId={layoutId} className={styles.optionHighlight} aria-hidden="true" transition={reduced ? { duration: 0 } : { type: "spring", visualDuration: 0.24, bounce: 0 }} />
            ) : null}
            <span className={styles.optionLabel}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function DraftStatus({ phase, reduced, hadDraft }: { phase: Phase; reduced: boolean; hadDraft: boolean }) {
  let key: string = phase;
  let content: ReactNode = null;
  if (phase === "thinking") {
    key = hadDraft ? "drafting" : "reading";
    content = <TextShimmer>{hadDraft ? "Drafting" : "Reading email"}</TextShimmer>;
  } else if (phase === "streaming") {
    content = <TextShimmer>Writing</TextShimmer>;
  } else if (phase === "rewriting") {
    content = <TextShimmer>Rewriting</TextShimmer>;
  } else if (phase === "ready" || phase === "inserting") {
    key = "ready";
    content = (
      <>
        <Check size={14} strokeWidth={2} aria-hidden="true" />
        Draft ready
      </>
    );
  } else if (phase === "inserted") {
    content = (
      <>
        <Check size={14} strokeWidth={2} aria-hidden="true" />
        Inserted
      </>
    );
  } else if (phase === "error") {
    content = (
      <>
        <CircleAlert size={14} strokeWidth={2} aria-hidden="true" />
        Failed
      </>
    );
  }
  return (
    <span className={styles.status} aria-hidden="true">
      <AnimatePresence initial={false}>
        {content ? (
          <motion.span
            key={key}
            className={styles.statusItem}
            data-phase={phase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.16 * Number(!reduced), ease: easeStandard } }}
            exit={{ opacity: 0, transition: { duration: 0.1 * Number(!reduced) } }}
          >
            {content}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

/** The draft box springs to its measured content height so streamed lines push the card up without a snap. */
function useHeightSpring(reduced: boolean) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const clip = outer.current;
    const body = inner.current;
    if (!clip || !body || typeof ResizeObserver === "undefined") return;
    let height = body.offsetHeight;
    let width = body.offsetWidth;
    let controls: AnimationPlaybackControls | undefined;
    const settle = () => {
      clip.style.height = "";
      clip.style.overflow = "";
      controls = undefined;
    };
    const observer = new ResizeObserver(() => {
      const nextHeight = body.offsetHeight;
      const nextWidth = body.offsetWidth;
      const wrapped = nextWidth !== width;
      width = nextWidth;
      if (nextHeight === height) return;
      const from = controls ? clip.getBoundingClientRect().height : height;
      height = nextHeight;
      controls?.stop();
      if (reduced || wrapped) {
        settle();
        return;
      }
      clip.style.overflow = "hidden";
      controls = animate(clip, { height: [from, nextHeight] }, { type: "spring", visualDuration: 0.24, bounce: 0, onComplete: settle });
    });
    observer.observe(body);
    return () => {
      observer.disconnect();
      controls?.stop();
    };
  }, [reduced]);
  return { outer, inner };
}

/** Watches the card: the first draft starts when it scrolls into view, and the tour pauses off screen. */
function useOnScreen(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setOnScreen(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry?.isIntersecting ?? false), { threshold });
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, onScreen] as const;
}

export function ReplyDraft({
  message = replyDraftSampleMessage,
  suggestions = replyDraftSampleSuggestions,
  defaultSuggestion,
  onSuggestionSelect,
  model = replyDraftSampleModel,
  tone,
  defaultTone = "friendly",
  onToneChange,
  length,
  defaultLength = "medium",
  onLengthChange,
  generate,
  onInsert,
  onDraft,
  autoStart = true,
  autoPlay,
  className,
}: ReplyDraftProps) {
  const reduced = useReducedMotion() ?? false;
  const [rootRef, onScreen] = useOnScreen();
  const { outer, inner } = useHeightSpring(reduced);
  const [toneState, setToneState] = useState<ReplyDraftTone>(defaultTone);
  const [lengthState, setLengthState] = useState<ReplyDraftLength>(defaultLength);
  const toneValue = tone ?? toneState;
  const lengthValue = length ?? lengthState;
  const [suggestionId, setSuggestionId] = useState(defaultSuggestion ?? suggestions[0]?.id);
  const [phase, setPhase] = useState<Phase>("empty");
  const [version, setVersion] = useState(0);
  const [chunks, setChunks] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [minHeight, setMinHeight] = useState<number>();
  const [announcement, setAnnouncement] = useState("");
  const [stopped, setStopped] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const draft = useRef("");
  const latest = useRef({ message, suggestions, generate, onDraft, model });
  useEffect(() => {
    latest.current = { message, suggestions, generate, onDraft, model };
  });
  useEffect(() => () => controller.current?.abort(), []);

  const hasDraft = text.length > 0 || chunks.length > 0;
  const busy = phase === "thinking" || phase === "streaming" || phase === "rewriting";
  const simulated = !generate;
  const touring = (autoPlay ?? simulated) && !stopped;

  const run = useCallback(
    async (mode: ReplyDraftMode, request: { tone: ReplyDraftTone; length: ReplyDraftLength; suggestionId?: string }) => {
      controller.current?.abort();
      const next = new AbortController();
      controller.current = next;
      const { signal } = next;
      const { message: mail, suggestions: chips, generate: write, onDraft: announceDraft, model: engine } = latest.current;
      const suggestion = chips.find(chip => chip.id === request.suggestionId);
      const previous = draft.current;
      const meta = { tone: request.tone, length: request.length, suggestion };
      const finish = (value: string) => {
        draft.current = value;
        setText(value);
        setChunks([]);
        setPhase("ready");
        setError(undefined);
        setAnnouncement(`Draft ready: ${toneLabel(request.tone).toLowerCase()}, ${lengthLabel(request.length).toLowerCase()}.`);
        announceDraft?.(value, meta);
      };
      if (mode === "draft" && previous) setMinHeight(inner.current?.offsetHeight);
      setError("");
      setPhase(mode === "draft" ? "thinking" : "rewriting");
      setAnnouncement(
        mode === "draft" ? `Drafting a reply with ${engine.name}${simulated ? ", simulated" : ""}.` : `Rewriting as ${toneLabel(request.tone).toLowerCase()}, ${lengthLabel(request.length).toLowerCase()}.`,
      );
      let streamed = "";
      try {
        const source = (write ?? simulateReplyDraft)({
          message: mail,
          tone: request.tone,
          length: request.length,
          suggestion,
          mode,
          previous: previous || undefined,
          signal,
        });
        if (mode === "rewrite" || reduced) {
          const whole = (await drain(source, signal)).trim();
          if (signal.aborted) return;
          if (!whole) throw Error("The model returned an empty draft.");
          setVersion(value => value + 1);
          finish(whole);
          return;
        }
        for await (const piece of isAsyncIterable(source) ? source : simulateStream(await source, signal)) {
          if (signal.aborted) return;
          if (streamed) {
            streamed += piece;
            setChunks(chunksSoFar => [...chunksSoFar, piece]);
          } else {
            const trimmed = piece.trimStart();
            if (!trimmed) continue;
            streamed = trimmed;
            setVersion(value => value + 1);
            setText("");
            setChunks([trimmed]);
            setPhase("streaming");
          }
        }
        if (signal.aborted) return;
        if (!streamed.trim()) throw Error("The model returned an empty draft.");
        await new Promise<void>(resolve => {
          const timer = setTimeout(resolve, 150);
          signal.addEventListener("abort", () => {
            clearTimeout(timer);
            resolve();
          }, { once: true });
        });
        if (signal.aborted) return;
        finish(streamed.trimEnd());
      } catch (thrown) {
        if (signal.aborted) return;
        const reason = thrown instanceof Error && thrown.message ? thrown.message : "Something went wrong.";
        setError(reason);
        if (streamed) {
          draft.current = streamed.trimEnd();
          setText(streamed.trimEnd());
        }
        setChunks([]);
        setPhase("error");
        setMinHeight(undefined);
        setAnnouncement(`Couldn't draft a reply. ${reason}`);
      }
    },
    [inner, reduced, simulated],
  );

  const signature = `${toneValue}|${lengthValue}`;
  const lastSignature = useRef(signature);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    const current = phaseRef.current;
    if (current === "empty") return;
    run(current !== "thinking" && current !== "streaming" && (current !== "error" || draft.current) ? "rewrite" : "draft", { tone: toneValue, length: lengthValue, suggestionId });
  }, [signature, toneValue, lengthValue, suggestionId, run]);

  const changeTone = useCallback(
    (value: string) => {
      if (tone === undefined) setToneState(value as ReplyDraftTone);
      onToneChange?.(value as ReplyDraftTone);
    },
    [tone, onToneChange],
  );
  const changeLength = useCallback(
    (value: string) => {
      if (length === undefined) setLengthState(value as ReplyDraftLength);
      onLengthChange?.(value as ReplyDraftLength);
    },
    [length, onLengthChange],
  );
  const pickSuggestion = useCallback(
    (chip: ReplyDraftSuggestion) => {
      setSuggestionId(chip.id);
      onSuggestionSelect?.(chip);
      run("draft", { tone: toneValue, length: lengthValue, suggestionId: chip.id });
    },
    [onSuggestionSelect, run, toneValue, lengthValue],
  );
  const regenerate = useCallback(() => {
    run("draft", { tone: toneValue, length: lengthValue, suggestionId });
  }, [run, toneValue, lengthValue, suggestionId]);

  const insert = useCallback(async () => {
    if (phase !== "ready") return;
    const final = draft.current.trim();
    if (!final) return;
    const suggestion = suggestions.find(chip => chip.id === suggestionId);
    setPhase("inserting");
    try {
      if (onInsert) await onInsert(final, { tone: toneValue, length: lengthValue, suggestion });
      else await new Promise<void>(resolve => setTimeout(resolve, 420));
      setPhase("inserted");
      setAnnouncement(onInsert ? "Draft inserted into your reply." : "Draft inserted into your reply. Simulated, nothing was sent.");
    } catch (thrown) {
      setPhase("ready");
      setAnnouncement(`Couldn't insert the draft. ${thrown instanceof Error ? thrown.message : ""}`.trim());
    }
  }, [phase, suggestions, suggestionId, onInsert, toneValue, lengthValue]);

  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || !onScreen || started.current) return;
    started.current = true;
    run("draft", { tone: toneValue, length: lengthValue, suggestionId });
  }, [autoStart, onScreen, run, toneValue, lengthValue, suggestionId]);

  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!touring || !onScreen || (phase !== "ready" && phase !== "inserted")) return;
    const timer = setTimeout(
      () => {
        const second = suggestions[1] ?? suggestions[0];
        const first = suggestions[0];
        const tour = [
          () => changeTone("concise"),
          () => changeTone("formal"),
          () => changeLength("long"),
          () => {
            if (second) pickSuggestion(second);
            else regenerate();
          },
          () => {
            changeTone("friendly");
            changeLength("short");
          },
          () => {
            void insert();
          },
          () => changeLength("medium"),
          () => {
            if (first) pickSuggestion(first);
            else regenerate();
          },
        ];
        tour[step % tour.length]?.();
        setStep(value => value + 1);
      },
      phase === "inserted" ? 1300 : 1900,
    );
    return () => clearTimeout(timer);
  }, [touring, onScreen, phase, step, suggestions, changeTone, changeLength, pickSuggestion, regenerate, insert]);

  const stopTour = () => {
    if (!stopped) setStopped(true);
  };
  const editable = phase === "ready" || phase === "inserted" || (phase === "error" && text.length > 0);
  const skeleton = phase === "thinking" && !hasDraft;
  const isEmpty = phase === "empty";
  const errorShown = phase === "error" && !hasDraft;
  const dimmed = (phase === "thinking" || phase === "rewriting") && hasDraft;
  const transitionIn = { duration: 0.16 * Number(!reduced), ease: easeStandard };
  const fadeOut = { opacity: 0, transition: { duration: 0.1 * Number(!reduced) } };
  const paragraphs = message.body.split(/\n{2,}/);
  const firstName = model.name.split(" ")[0];

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      onPointerDownCapture={stopTour}
      onKeyDownCapture={event => {
        stopTour();
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && phase === "ready") {
          event.preventDefault();
          void insert();
        }
      }}
    >
      <article className={styles.card} aria-label={`Reply to ${message.from.name}`}>
        <header className={styles.mailHead}>
          <h3 className={styles.subject}>{message.subject}</h3>
          <GmailMark className={styles.source} width={16} height={16} title="Gmail" />
        </header>
        <div className={styles.sender}>
          <Avatar name={message.from.name} src={message.from.avatar} size="md" className={styles.avatar} />
          <div className={styles.senderText}>
            <div className={styles.senderLine}>
              <span className={styles.senderName}>{message.from.name}</span>
              <span className={styles.senderEmail}>{message.from.email}</span>
            </div>
            {message.to ? <span className={styles.meta}>to {message.to}</span> : null}
          </div>
          <span className={styles.time}>{message.receivedAt}</span>
        </div>
        <div className={styles.mailBody}>
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        <section className={styles.reply} aria-label="AI reply">
          {suggestions.length ? (
            <div className={styles.suggestions} role="group" aria-label="Quick replies">
              {suggestions.map(chip => (
                <button key={chip.id} type="button" className={styles.suggestion} aria-pressed={chip.id === suggestionId} onClick={() => pickSuggestion(chip)}>
                  {chip.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className={styles.draft} data-phase={phase}>
            <div className={styles.draftHead}>
              <span className={styles.model}>
                <span className={styles.modelMark}>{model.mark ?? <ClaudeMark width={16} height={16} title="" aria-hidden="true" />}</span>
                <span className={styles.modelName}>{model.name}</span>
              </span>
              <DraftStatus phase={phase} reduced={reduced} hadDraft={hasDraft} />
            </div>
            <div ref={outer} className={styles.bodyClip}>
              <div ref={inner} className={styles.body} style={minHeight ? { minHeight } : undefined} aria-busy={busy || undefined}>
                <AnimatePresence initial={false}>
                  {isEmpty ? (
                    <motion.p key="empty" className={styles.placeholder} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: transitionIn }} exit={fadeOut}>
                      Pick a quick reply, or let {firstName} draft one from the email.
                    </motion.p>
                  ) : null}
                  {skeleton ? (
                    <motion.div key="skeleton" className={styles.skeleton} aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: transitionIn }} exit={fadeOut}>
                      <span style={{ width: "34%" }} />
                      <span style={{ width: "92%" }} />
                      <span style={{ width: "78%" }} />
                    </motion.div>
                  ) : null}
                  {errorShown ? (
                    <motion.div key="error" className={styles.errorBlock} role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: transitionIn }} exit={fadeOut}>
                      <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
                      <span>
                        <span className={styles.errorTitle}>Couldn&apos;t draft a reply.</span> <span className={styles.errorCopy}>{error}</span>
                      </span>
                    </motion.div>
                  ) : null}
                  {hasDraft ? (
                    <motion.div
                      key={`v${version}`}
                      className={styles.textLayer}
                      initial={{ opacity: 0, y: 2 * Number(!reduced) }}
                      animate={{ opacity: dimmed ? 0.4 : 1, y: 0, transition: { ...transitionIn, delay: reduced || dimmed ? 0 : 0.04 } }}
                      exit={fadeOut}
                    >
                      {chunks.length ? (
                        <div className={styles.text}>
                          {chunks.map((piece, index) => (
                            <span key={index} className={styles.chunk}>
                              {piece}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div
                          className={styles.text}
                          data-editable={editable || undefined}
                          contentEditable={editable ? "plaintext-only" : false}
                          suppressContentEditableWarning
                          role={editable ? "textbox" : undefined}
                          aria-multiline={editable || undefined}
                          aria-label={editable ? "Reply draft, editable" : undefined}
                          onInput={event => {
                            draft.current = event.currentTarget.innerText;
                            if (phase === "inserted") setPhase("ready");
                          }}
                        >
                          {text}
                        </div>
                      )}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
            <div className={styles.controls}>
              <ChipGroup {...toneGroup({ label: "Tone", options: TONE_OPTIONS, value: toneValue, onChange: changeTone, reduced })} />
              <span className={styles.divider} aria-hidden="true" />
              <ChipGroup {...toneGroup({ label: "Length", options: LENGTH_OPTIONS, value: lengthValue, onChange: changeLength, reduced })} />
            </div>
          </div>
          <div className={styles.footer}>
            {isEmpty ? (
              <Button variant="secondary" size="sm" className={styles.draftButton} onClick={regenerate}>
                <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" />
                Draft reply
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className={styles.footerButton} onClick={regenerate}>
                <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
                {phase === "error" ? "Try again" : "Regenerate"}
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              className={styles.insert}
              onClick={() => void insert()}
              loading={phase === "inserting"}
              disabled={phase !== "ready" && phase !== "inserting" && phase !== "inserted"}
              aria-disabled={phase === "inserted" || undefined}
            >
              <span className={styles.swap}>
                <span data-on={phase !== "inserted" || undefined}>Insert</span>
                <span data-on={phase === "inserted" || undefined}>
                  <Check size={16} strokeWidth={2} aria-hidden="true" />
                  Inserted
                </span>
              </span>
            </Button>
          </div>
        </section>
        <p className={styles.srOnly} role="status" aria-live="polite">
          {announcement}
        </p>
      </article>
    </div>
  );
}

/** Streams a whole string the way the bundled simulation does, for a generator that returns all at once. */
async function* simulateStream(text: string, signal: AbortSignal): AsyncIterable<string> {
  for (const group of chunkText(text)) {
    await wait(34, signal);
    yield group;
  }
}

export default ReplyDraft;
