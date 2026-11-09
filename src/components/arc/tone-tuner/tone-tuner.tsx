"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import type { AnimationPlaybackControls } from "motion/react";
import {
  Check,
  CircleAlert,
  HeartHandshake,
  PenLine,
  RotateCcw,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { FaceSlightlySmiling } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { CopyButton } from "../copy-button/copy-button";
import Slider from "../slider/slider";
import { Switch } from "../switch/switch";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { motionTokens } from "../lib/motion-tokens";
import { avatar as mediaAvatar } from "../lib/media";
import styles from "./tone-tuner.module.css";

export type ToneVoice = "neutral" | "friendly" | "confident" | "empathetic";
export type ToneLevel = 0 | 1 | 2;

/** The three dials a rewrite runs with. */
export interface ToneSettings {
  /** 0 casual, 1 neutral, 2 formal. */
  formality: ToneLevel;
  /** 0 concise, 1 balanced, 2 detailed. */
  detail: ToneLevel;
  /** The voice the copy is written in. */
  voice: ToneVoice;
}

/** One voice chip. A press sets the voice and moves both sliders to its starting point. */
export interface TonePreset {
  voice: Exclude<ToneVoice, "neutral">;
  label: string;
  formality: ToneLevel;
  detail: ToneLevel;
}

/** What a rewrite callback receives: the draft, the dials, and a ready made instruction line. */
export interface ToneRewriteRequest extends ToneSettings {
  text: string;
  instructions: string;
}

/** Who the message is for, shown in the card header. */
export interface ToneRecipient {
  name: string;
  avatar?: string;
  subject?: string;
}

export interface ToneTunerProps {
  /** The original draft, the source of every rewrite. Used with `rewrite`. Blank lines split paragraphs; single line breaks keep lines (a sign off). */
  text?: string;
  /** Calls your model and resolves to the rewritten plain text. Without it the rewrites are simulated. */
  rewrite?: (request: ToneRewriteRequest, signal: AbortSignal) => Promise<string>;
  /** Controlled tone. */
  value?: ToneSettings;
  /** Starting tone when uncontrolled. */
  defaultValue?: ToneSettings;
  /** Runs on every slider step or chip press, before the debounce. */
  onValueChange?: (value: ToneSettings) => void;
  /** Runs when a rewrite lands, with the new plain text. */
  onRewrite?: (text: string, value: ToneSettings) => void;
  /** Runs after Copy succeeds. */
  onCopy?: (text: string) => void;
  /** Who the message is for, shown in the header. */
  recipient?: ToneRecipient;
  /** The model named in the status while a rewrite runs. */
  model?: string;
  /** Voice chips. Pressing the active chip returns to the neutral voice. */
  presets?: TonePreset[];
  /** Quiet time after the last change before a rewrite starts. */
  debounceMs?: number;
  /** Controlled change highlighting. Pair with onShowChangesChange. */
  showChanges?: boolean;
  /** Highlights words that differ from the original draft. */
  defaultShowChanges?: boolean;
  /** Runs when the Changes switch flips. */
  onShowChangesChange?: (show: boolean) => void;
  /** Tours the presets while the card is on screen, until the first pointer press or focus inside it. */
  autoPlay?: boolean;
  className?: string;
}

interface DocParagraph {
  segments: string[];
  lines?: boolean;
}

type Doc = DocParagraph[];
type Flags = boolean[][][];

const FORMALITY_LABELS = ["Casual", "Neutral", "Formal"];
const DETAIL_LABELS = ["Concise", "Balanced", "Detailed"];
const USER_TURN = ["Hi Sofia,", "Hello Sofia,", "Dear Ms. Ramirez,"];
const BODY: Record<ToneVoice, [string, string, string]> = {
  neutral: [
    "Thanks for flagging the double charge on your October invoice.",
    "Thank you for reporting the duplicate charge on your October invoice.",
    "Thank you for bringing the duplicate charge on invoice INV-20481 to our attention.",
  ],
  friendly: [
    "Thanks so much for the heads up about the double charge, and sorry for the hassle!",
    "Thanks for letting us know about the double charge, and sorry for the hassle.",
    "Thank you kindly for letting us know about the duplicate charge on invoice INV-20481.",
  ],
  confident: [
    "Good catch on the double charge. It's already sorted.",
    "You were right about the duplicate charge, and it is already resolved.",
    "We have confirmed the duplicate charge on invoice INV-20481 and resolved it in full.",
  ],
  empathetic: [
    "I'm really sorry you got charged twice. That's stressful, especially at month end.",
    "I'm sorry you were charged twice. I know how disruptive that is at month end.",
    "Please accept our apologies for the duplicate charge. We understand how disruptive this is at month end.",
  ],
};
const RESOLUTION = [
  "We've refunded the extra $1,240",
  "We have refunded the extra $1,240.00",
  "A full refund of $1,240.00 has been issued to your card ending 4417",
];
const LANDING = [
  ", so it should land on your card in 5 to 10 business days",
  ", and it should reach your card within 5 to 10 business days",
  " and should appear on your statement within 5 to 10 business days",
];
const CAUSE = [
  "A payment retry fired twice after a timeout, and we've added a check so it can't happen again.",
  "A payment retry ran twice after a timeout, and we have added a safeguard so it cannot happen again.",
  "The cause was a payment retry that ran twice following a timeout; we have since added a safeguard to prevent any recurrence.",
];
const CLOSING: Record<ToneVoice, [string, string, string]> = {
  neutral: [
    "Let me know if anything else looks off.",
    "Let me know if anything else looks wrong.",
    "Please let us know if you notice any further discrepancies.",
  ],
  friendly: [
    "Shout if anything else looks off, happy to help!",
    "Just reply here if anything else looks off. Happy to help.",
    "Please do reply if anything else looks amiss; we are always happy to help.",
  ],
  confident: [
    "You're all set.",
    "No action is needed on your side.",
    "No further action is required on your part.",
  ],
  empathetic: [
    "If it caused any trouble on your end, tell me and I'll make it right.",
    "If this caused any trouble on your end, reply here and I will make it right.",
    "Should this have caused any difficulty on your side, please reply and we will make it right.",
  ],
};
const SIGN_OFF = ["Cheers,", "Best,", "Kind regards,"];
const SIGNATURE = ["Jordan", "Jordan", "Jordan Reyes, Billing support"];

const DEFAULT_SETTINGS: ToneSettings = { formality: 1, detail: 1, voice: "neutral" };
const DEFAULT_PRESETS: TonePreset[] = [
  { voice: "friendly", label: "Friendly", formality: 0, detail: 1 },
  { voice: "confident", label: "Confident", formality: 1, detail: 0 },
  { voice: "empathetic", label: "Empathetic", formality: 1, detail: 2 },
];
const PRESET_ICONS: Record<Exclude<ToneVoice, "neutral">, LucideIcon> = {
  friendly: FaceSlightlySmiling,
  confident: Zap,
  empathetic: HeartHandshake,
};
const LEVELS: ToneLevel[] = [0, 1, 2];
const VOICES: ToneVoice[] = ["neutral", "friendly", "confident", "empathetic"];
const TOUR: ToneSettings[] = [
  { voice: "friendly", formality: 0, detail: 1 },
  { voice: "confident", formality: 1, detail: 0 },
  { voice: "empathetic", formality: 1, detail: 2 },
  { voice: "empathetic", formality: 2, detail: 2 },
  DEFAULT_SETTINGS,
];
const SAMPLE_RECIPIENT: ToneRecipient = {
  name: "Sofia Ramirez",
  avatar: mediaAvatar("sofia-ramirez"),
  subject: "Re: Duplicate charge on INV-20481",
};
const ENTER_EASE = [...motionTokens.ease.enter] as [number, number, number, number];
const EXIT_EASE = [...motionTokens.ease.standard] as [number, number, number, number];

/** Builds the simulated rewrite for one set of dials. */
function rewrite({ formality, detail, voice }: ToneSettings): Doc {
  return [
    { segments: [USER_TURN[formality]] },
    {
      segments: [
        BODY[voice][formality],
        `${RESOLUTION[formality]}${detail > 0 ? LANDING[formality] : ""}.`,
        detail > 1 ? CAUSE[formality] : "",
      ],
    },
    { segments: [CLOSING[voice][formality]] },
    { segments: [SIGN_OFF[formality], SIGNATURE[formality]], lines: true },
  ];
}

/** The longest variant across the four voices, held as the sizer so the card does not jump between voices. */
const SIZER: Doc[][] = LEVELS.map((formality) =>
  LEVELS.map(
    (detail) =>
      VOICES.map((voice) => rewrite({ formality, detail, voice })).reduce((longest, candidate) =>
        plainText(candidate).length > plainText(longest).length ? candidate : longest,
      ),
  ),
);

function plainText(doc: Doc) {
  return doc
    .map((paragraph) => paragraph.segments.filter(Boolean).join(paragraph.lines ? "\n" : " "))
    .filter(Boolean)
    .join("\n\n");
}

function parseDoc(text: string): Doc {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) =>
      paragraph.includes("\n")
        ? {
            segments: paragraph
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean),
            lines: true,
          }
        : {
            segments: (paragraph.match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g) ?? [paragraph])
              .map((sentence) => sentence.trim())
              .filter(Boolean),
          },
    );
}

const sameSettings = (a: ToneSettings, b: ToneSettings) =>
  a.formality === b.formality && a.detail === b.detail && a.voice === b.voice;

function describe(settings: ToneSettings) {
  const voice = settings.voice === "neutral" ? "neutral voice" : `${settings.voice} voice`;
  return `${voice}, ${FORMALITY_LABELS[settings.formality].toLowerCase()}, ${DETAIL_LABELS[settings.detail].toLowerCase()}`;
}

const words = (text: string) => text.split(/\s+/).filter(Boolean);
const key = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}$]/gu, "");

/** Flags every word of the rewrite that is new against the original, then folds the flags back into segment order. */
function wordFlags(original: Doc, next: Doc): Flags {
  const before = original.flatMap((paragraph) => paragraph.segments.flatMap(words)).map(key);
  const afterSegments = next.map((paragraph) => paragraph.segments.map(words));
  const after = afterSegments.flat(2).map(key);
  const rows = before.length + 1;
  const columns = after.length + 1;
  const table = new Uint16Array(rows * columns);
  for (let row = before.length - 1; row >= 0; row -= 1) {
    for (let column = after.length - 1; column >= 0; column -= 1) {
      table[row * columns + column] =
        before[row] === after[column]
          ? table[(row + 1) * columns + column + 1] + 1
          : Math.max(table[(row + 1) * columns + column], table[row * columns + column + 1]);
    }
  }
  const added = Array<boolean>(after.length).fill(true);
  for (let row = 0, column = 0; row < before.length && column < after.length; ) {
    if (before[row] === after[column]) {
      added[column] = false;
      row += 1;
      column += 1;
    } else if (table[(row + 1) * columns + column] >= table[row * columns + column + 1]) row += 1;
    else column += 1;
  }
  let cursor = 0;
  return afterSegments.map((paragraph) =>
    paragraph.map((segment) => segment.map(() => added[cursor++])),
  );
}

const joinClass = (...values: (string | false | undefined)[]) => values.filter(Boolean).join(" ");

interface WordPiece {
  text: string;
  added: boolean;
}

/** Splits a segment into marked and unmarked runs, keeping the spaces that sit between them. */
function wordPieces(text: string, added: boolean[]): WordPiece[] {
  const pieces: WordPiece[] = [];
  words(text).forEach((word, index) => {
    const isAdded = added[index] ?? false;
    if (index > 0) {
      const previous = pieces[pieces.length - 1]!;
      if (!previous.added || isAdded) previous.text += " ";
      else pieces.push({ text: " ", added: false });
    }
    const last = pieces[pieces.length - 1];
    if (last && last.added === isAdded) last.text += word;
    else pieces.push({ text: word, added: isAdded });
  });
  return pieces;
}

interface SegmentState {
  seg: { text: string; added: boolean[] };
  lead?: boolean;
  block?: boolean;
  reduced: boolean;
}

/** Crossfades one sentence in place: fade the old text out, swap it while invisible, then fade the new text in. */
function CrossfadeSegment({ seg, lead, block, reduced }: SegmentState) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(seg);
  const latest = useRef(seg);
  const play = useRef<AnimationPlaybackControls | undefined>(undefined);
  const direction = useRef<"in" | "out" | null>(null);

  if (seg.text === shown.text && seg !== shown) setShown(seg);

  useEffect(() => {
    latest.current = seg;
  });

  useEffect(() => {
    const node = ref.current;
    if (!node || reduced) return;
    if (seg.text === shown.text) {
      if (direction.current === "out") {
        play.current?.stop();
        direction.current = null;
        play.current = animate(node, { opacity: 1 }, { duration: 0.16, ease: ENTER_EASE });
      }
      return;
    }
    let cancelled = false;
    play.current?.stop();
    direction.current = "out";
    const controls = animate(node, { opacity: 0 }, { duration: 0.1, ease: EXIT_EASE });
    play.current = controls;
    void controls.then(() => {
      if (cancelled || direction.current !== "out") return;
      direction.current = "in";
      setShown(latest.current);
    });
    return () => {
      cancelled = true;
    };
  }, [seg.text, shown.text, reduced]);

  useLayoutEffect(() => {
    const node = ref.current;
    if (direction.current !== "in" || !node) return;
    direction.current = null;
    play.current?.stop();
    play.current = animate(node, { opacity: [0, 1] }, { duration: 0.16, ease: ENTER_EASE });
  }, [shown.text]);

  useEffect(() => () => play.current?.stop(), []);

  const active = reduced ? seg : shown;

  return (
    <span ref={ref} className={joinClass(styles.segment, block && styles.line)}>
      {lead && active.text ? " " : null}
      {wordPieces(active.text, active.added).map((piece, index) =>
        piece.added ? (
          <mark className={styles.ins} key={index}>
            {piece.text}
          </mark>
        ) : (
          <span key={index}>{piece.text}</span>
        ),
      )}
    </span>
  );
}

interface FlaggedSegmentProps {
  text: string;
  added?: boolean[];
  lead?: boolean;
  block?: boolean;
  reduced: boolean;
}

function FlaggedSegment({ text, added = [], lead, block, reduced }: FlaggedSegmentProps) {
  const stable = added.map((value) => +Boolean(value)).join("");
  const seg = useMemo(
    () => ({ text, added: stable.split("").map((value) => value === "1") }),
    [text, stable],
  );
  return <CrossfadeSegment seg={seg} lead={lead} block={block} reduced={reduced} />;
}

function Message({ doc, flags, reduced }: { doc: Doc; flags?: Flags; reduced: boolean }) {
  return (
    <>
      {doc.map((paragraph, index) => (
        <p className={styles.paragraph} key={index}>
          {paragraph.segments.map((segment, segmentIndex) =>
            flags ? (
              <FlaggedSegment
                key={segmentIndex}
                text={segment}
                added={flags[index]?.[segmentIndex]}
                lead={!paragraph.lines && segmentIndex > 0}
                block={paragraph.lines}
                reduced={reduced}
              />
            ) : (
              <span className={paragraph.lines ? styles.line : undefined} key={segmentIndex}>
                {!paragraph.lines && segmentIndex > 0 && segment ? " " : null}
                {segment}
              </span>
            ),
          )}
        </p>
      ))}
    </>
  );
}

function FadeStack({
  id,
  children,
  className,
  reduced,
}: {
  id: string;
  children: ReactNode;
  className?: string;
  reduced: boolean;
}) {
  return (
    <span className={joinClass(styles.fadeStack, className)}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          className={styles.fadeItem}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.16 * Number(!reduced), ease: ENTER_EASE } }}
          exit={{ opacity: 0, transition: { duration: 0.1 * Number(!reduced), ease: EXIT_EASE } }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Claude's starburst, drawn from the mark's own path so it holds at 14px. */
function ClaudeMark({ title = "Claude", ...props }: { title?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

type Phase = "idle" | "rewriting" | "done" | "error";

/**
 * A message card with voice chips and two sliders (formality and detail). Each change triggers a
 * debounced rewrite; changed sentences crossfade in place, added words can be highlighted against
 * the original, and Copy takes the current version. With no props it tunes a sample billing reply
 * with simulated rewrites.
 */
export function ToneTuner({
  value,
  defaultValue = DEFAULT_SETTINGS,
  onValueChange,
  text,
  rewrite: rewriteFn,
  onRewrite,
  onCopy,
  recipient = SAMPLE_RECIPIENT,
  model = "Claude Sonnet 5.5",
  presets = DEFAULT_PRESETS,
  debounceMs = 220,
  showChanges,
  defaultShowChanges = true,
  onShowChangesChange,
  autoPlay,
  className,
}: ToneTunerProps) {
  const prefersReduced = useReducedMotion() ?? false;
  const textId = useId();
  const custom = Boolean(rewriteFn);

  const [inner, setInner] = useState(defaultValue);
  const settings = value ?? inner;
  const { formality, detail, voice } = settings;
  const settingsKey = `${formality}${detail}${voice}`;

  const original = useMemo(() => (custom ? parseDoc(text ?? "") : rewrite(DEFAULT_SETTINGS)), [custom, text]);
  const empty = original.length === 0;

  const [doc, setDoc] = useState<Doc>(() => (custom ? original : rewrite(settings)));
  const [applied, setApplied] = useState<ToneSettings>(settings);
  const [phase, setPhase] = useState<Phase>(() => (custom || sameSettings(settings, DEFAULT_SETTINGS) ? "idle" : "done"));
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [seen, setSeen] = useState(settingsKey);

  if (settingsKey !== seen) {
    setSeen(settingsKey);
    if (!empty) setPhase("rewriting");
  }

  const [innerShowChanges, setInnerShowChanges] = useState(defaultShowChanges);
  const changesVisible = showChanges ?? innerShowChanges;

  const latest = useRef({ rewrite: rewriteFn, onRewrite, original, settings, custom });
  useEffect(() => {
    latest.current = { rewrite: rewriteFn, onRewrite, original, settings, custom };
  });

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (empty) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const { rewrite: rewriteNow, onRewrite: onDone, original: source, settings: next } = latest.current;
      try {
        let nextDoc: Doc;
        if (rewriteNow) {
          const instructions =
            `Rewrite this message. Make it ${["casual and conversational", "neutral and plain", "formal and polished"][next.formality]}, ` +
            `${["as short as possible", "about the same length", "more detailed, adding useful context"][next.detail]}.` +
            `${next.voice === "neutral" ? "" : ` Use a ${next.voice} voice.`}` +
            " Keep every fact, number and name. Return plain text with the same paragraph breaks.";
          nextDoc = parseDoc(await rewriteNow({ ...next, text: plainText(source), instructions }, controller.signal));
        } else {
          await new Promise<void>((resolve, reject) => {
            const handle = window.setTimeout(resolve, 340);
            controller.signal.addEventListener(
              "abort",
              () => {
                window.clearTimeout(handle);
                reject(new DOMException("Aborted", "AbortError"));
              },
              { once: true },
            );
          });
          nextDoc = rewrite(next);
        }
        if (controller.signal.aborted) return;
        setDoc(nextDoc);
        setApplied(next);
        setPhase(
          rewriteNow
            ? plainText(nextDoc) === plainText(source)
              ? "idle"
              : "done"
            : sameSettings(next, DEFAULT_SETTINGS)
              ? "idle"
              : "done",
        );
        onDone?.(plainText(nextDoc), next);
      } catch (error) {
        if (controller.signal.aborted) return;
        setMessage(error instanceof Error && error.message ? error.message : "The model did not respond.");
        setPhase("error");
      }
    }, debounceMs);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [settingsKey, attempt, debounceMs, empty]);

  const commit = (next: ToneSettings) => {
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  };

  const root = useRef<HTMLDivElement>(null);
  const [touring, setTouring] = useState(autoPlay ?? (!custom && value === undefined));
  const [inView, setInView] = useState(false);
  const tour = useRef(0);

  useEffect(() => {
    const node = root.current;
    if (!touring || !node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.4 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [touring]);

  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });

  useEffect(() => {
    if (!touring || !inView || prefersReduced || empty) return;
    let handle = 0;
    const tick = () => {
      commitRef.current(TOUR[tour.current % TOUR.length]!);
      tour.current += 1;
      handle = window.setTimeout(tick, 2600);
    };
    handle = window.setTimeout(tick, tour.current === 0 ? 1400 : 2600);
    return () => window.clearTimeout(handle);
  }, [touring, inView, prefersReduced, empty]);

  const stopTour = () => {
    if (touring) setTouring(false);
  };

  const flags = useMemo(() => wordFlags(original, doc), [original, doc]);
  const changed = flags.flat(2).filter(Boolean).length;
  const current = plainText(doc);
  const total = doc.reduce(
    (count, paragraph) => count + paragraph.segments.reduce((sum, segment) => sum + words(segment).length, 0),
    0,
  );
  const sizerDoc = custom
    ? plainText(doc).length > plainText(original).length
      ? doc
      : original
    : SIZER[applied.formality][applied.detail];

  const outer = useRef<HTMLDivElement>(null);
  const innerBody = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const clip = outer.current;
    const body = innerBody.current;
    if (!clip || !body || typeof ResizeObserver === "undefined") return;
    let height = body.offsetHeight;
    let width = body.offsetWidth;
    let controls: AnimationPlaybackControls | undefined;
    const rest = () => {
      clip.style.height = "";
      clip.style.overflow = "";
      controls = undefined;
    };
    const observer = new ResizeObserver(() => {
      const nextHeight = body.offsetHeight;
      const nextWidth = body.offsetWidth;
      const resized = nextWidth !== width;
      width = nextWidth;
      if (nextHeight === height) return;
      const from = controls ? clip.getBoundingClientRect().height : height;
      height = nextHeight;
      controls?.stop();
      if (prefersReduced || resized) {
        rest();
        return;
      }
      clip.style.overflow = "hidden";
      controls = animate(clip, { height: [from, nextHeight] }, { ...motionTokens.spring.smooth, onComplete: rest });
    });
    observer.observe(body);
    return () => {
      observer.disconnect();
      controls?.stop();
    };
  }, [prefersReduced]);

  const status =
    phase === "rewriting"
      ? { icon: "claude" as const, label: `Rewriting with ${model}` }
      : phase === "error"
        ? { icon: "error" as const, label: "Couldn't rewrite" }
        : phase === "done"
          ? { icon: "done" as const, label: "Rewritten", meta: describe(applied) }
          : { icon: "idle" as const, label: empty ? "No draft yet" : "Original draft" };

  const announcement =
    phase === "done"
      ? `Rewritten: ${describe(applied)}.${custom ? "" : " Simulated, nothing was sent."}`
      : phase === "error"
        ? `Couldn't rewrite. ${message}`
        : phase === "idle" && !empty
          ? "Showing the original draft."
          : "";

  return (
    <div
      ref={root}
      className={joinClass(styles.root, className)}
      data-changes={changesVisible || undefined}
      data-phase={phase}
      onPointerDownCapture={stopTour}
      onFocusCapture={stopTour}
    >
      <div className={styles.head}>
        <Avatar name={recipient.name} src={recipient.avatar} size="md" className={styles.avatar} />
        <div className={styles.who}>
          <span className={styles.name}>{recipient.name}</span>
          {recipient.subject ? <span className={styles.subject}>{recipient.subject}</span> : null}
        </div>
        <div className={styles.counts} aria-hidden="true">
          <span className={styles.changed} data-on={changesVisible && changed > 0 ? "" : undefined}>
            <i className={styles.swatch} />
            <span className={styles.num}>{changed}</span> changed
          </span>
          <span>
            <span className={styles.num}>{total}</span> words
          </span>
        </div>
      </div>
      <div ref={outer} className={styles.bodyClip}>
        <div ref={innerBody} className={styles.body}>
          {empty ? (
            <p className={styles.empty}>Add a draft to tune its tone.</p>
          ) : (
            <div className={styles.stack}>
              <div className={styles.sizer} aria-hidden="true">
                <Message doc={sizerDoc} reduced={prefersReduced} />
              </div>
              <div className={styles.text} id={`${textId}-text`} aria-label="Message">
                <Message doc={doc} flags={flags} reduced={prefersReduced} />
              </div>
            </div>
          )}
        </div>
      </div>
      <div className={styles.controls}>
        <div className={styles.presets} role="group" aria-label="Voice">
          {presets.map((preset) => {
            const Icon = PRESET_ICONS[preset.voice];
            const active = voice === preset.voice;
            return (
              <button
                type="button"
                key={preset.voice}
                className={styles.chip}
                aria-pressed={active}
                disabled={empty}
                onClick={() =>
                  commit(
                    active
                      ? { ...settings, voice: "neutral" }
                      : { voice: preset.voice, formality: preset.formality, detail: preset.detail },
                  )
                }
              >
                <Icon size={14} strokeWidth={1.75} className={styles.chipIcon} aria-hidden="true" />
                <span className={styles.chipLabel}>{preset.label}</span>
              </button>
            );
          })}
        </div>
        <div className={styles.sliders}>
          <Slider
            label="Formality"
            value={formality}
            min={0}
            max={2}
            step={1}
            showValue={false}
            disabled={empty}
            marks={FORMALITY_LABELS.map((label, index) => ({ value: index, label }))}
            format={(step) => FORMALITY_LABELS[step] ?? ""}
            onValueChange={(step) => commit({ ...settings, formality: step as ToneLevel })}
          />
          <Slider
            label="Detail"
            value={detail}
            min={0}
            max={2}
            step={1}
            showValue={false}
            disabled={empty}
            marks={DETAIL_LABELS.map((label, index) => ({ value: index, label }))}
            format={(step) => DETAIL_LABELS[step] ?? ""}
            onValueChange={(step) => commit({ ...settings, detail: step as ToneLevel })}
          />
        </div>
      </div>
      <div className={styles.foot}>
        <div className={styles.status} data-icon={status.icon}>
          <FadeStack id={status.icon} className={styles.statusIcon} reduced={prefersReduced}>
            {status.icon === "claude" ? (
              <ClaudeMark width={14} height={14} className={styles.claude} title="" aria-hidden="true" />
            ) : status.icon === "done" ? (
              <Check size={14} strokeWidth={2} />
            ) : status.icon === "error" ? (
              <CircleAlert size={14} strokeWidth={1.75} />
            ) : (
              <PenLine size={14} strokeWidth={1.75} />
            )}
          </FadeStack>
          <FadeStack
            id={`${status.label}${status.meta ?? ""}`}
            className={styles.statusText}
            reduced={prefersReduced}
          >
            {status.icon === "claude" ? (
              <TextShimmer className={styles.statusLabel}>{status.label}</TextShimmer>
            ) : (
              <span className={styles.statusLabel}>
                {status.label}
                {status.meta ? <span className={styles.statusMeta}>{status.meta}</span> : null}
              </span>
            )}
          </FadeStack>
          {phase === "error" ? (
            <button
              type="button"
              className={styles.retry}
              onClick={() => {
                setPhase("rewriting");
                setAttempt((count) => count + 1);
              }}
            >
              <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
              Retry
            </button>
          ) : null}
        </div>
        <div className={styles.actions}>
          <Switch
            label="Changes"
            aria-label="Highlight changes"
            checked={changesVisible}
            onCheckedChange={(next) => {
              if (showChanges === undefined) setInnerShowChanges(next);
              onShowChangesChange?.(next);
            }}
            disabled={empty}
            className={styles.switch}
          />
          <CopyButton
            value={current}
            label="Copy"
            disabled={empty}
            onCopied={() => onCopy?.(current)}
          />
        </div>
      </div>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

export default ToneTuner;
