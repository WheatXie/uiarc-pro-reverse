"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode, SVGProps } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useIsPresent,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "motion/react";
import type {
  AnimationPlaybackControls,
  MotionValue,
  TargetAndTransition,
} from "motion/react";
import {
  AlignLeft,
  CalendarCheck,
  Check,
  CircleAlert,
  CircleHelp,
  FileSearch,
  FileText,
  Hash,
  Info,
  Link2,
  LockKeyhole,
  MessagesSquare,
  ShieldCheck,
  TextQuote,
  Undo2,
  UserRound,
  UserRoundCheck,
  Wand2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "../button/button";
import { Switch } from "../switch/switch";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./ai-feature-launch.module.css";

/** One benefit row under the step copy: a 16px icon and a short claim. */
export interface LaunchStepBenefit {
  /** Any Lucide icon component; rendered at 16px. */
  icon: LucideIcon;
  /** One line, sentence case. */
  label: string;
}

/** A step of the tour: the copy, its benefit rows and the looping mini demo above it. */
export interface LaunchStep {
  /** Stable id, also the key of the stage crossfade. */
  id: string;
  /** Heading. Names the card through `aria-label` while this step is current. */
  title: string;
  /** One or two sentences of body copy. */
  description: string;
  /** Up to three rows; anything past the third is dropped. */
  benefits: LaunchStepBenefit[];
  /** A still node, or a pure function of the loop clock in milliseconds. */
  demo?: ReactNode | ((time: number) => ReactNode);
  /** Still frame drawn when motion is reduced. Defaults to 60% of `stepDuration`. */
  posterTime?: number;
}

export interface AiFeatureLaunchProps {
  /** The tour. Defaults to the rewrite / summarize / ask demo. */
  steps?: LaunchStep[];
  /** Controlled current step index. */
  step?: number;
  /** Uncontrolled starting index. Defaults to 0. */
  defaultStep?: number;
  /** Fires with the new index after a dot, arrow key or autoplay advance. */
  onStepChange?: (index: number) => void;
  /** Advance to the next step after each mini demo loop. Any interaction stops it for good. Defaults to true. */
  autoPlay?: boolean;
  /** Length of one mini demo loop in milliseconds. Defaults to 6400. */
  stepDuration?: number;
  /** Workspace name used in the saved-saving status line. Defaults to "Halcyon". */
  workspaceName?: string;
  /** Member count used in the setting label. Defaults to 48. */
  memberCount?: number;
  /** When false the switch is disabled and the note explains who can change it. Defaults to true. */
  canManage?: boolean;
  /** Controlled switch state. */
  enabled?: boolean;
  /** Uncontrolled starting switch state. Defaults to false. */
  defaultEnabled?: boolean;
  /** Persist the setting. The switch shows the new value while this runs; toggling again aborts it. */
  onEnabledChange?: (
    enabled: boolean,
    signal: AbortSignal,
  ) => Promise<void> | void;
  /** Start a guided trial. The trigger shows a spinner while this runs. */
  onTry?: (signal: AbortSignal) => Promise<void> | void;
  /** Secondary action, usually a docs link. */
  onLearnMore?: () => void;
  /** Model credit at the foot of the card. Defaults to "Claude Sonnet 5.5". */
  modelName?: string;
  /** A 14px mark in front of the model credit. Defaults to the Claude mark. */
  modelMark?: ReactNode;
  /** Visible label of the setting row. Defaults to "Enable for my workspace". */
  enableLabel?: string;
  /** Primary action label. Defaults to "Try it now". */
  tryLabel?: string;
  /** Secondary action label. Defaults to "Learn more". */
  learnMoreLabel?: string;
  /** Extra class on the section. */
  className?: string;
}

/** The Claude mark used by the model credit and the thinking rows. */
function ClaudeMark({
  title = "Claude",
  ...props
}: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-label={title}
      {...props}
    >
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

/** A single grid cell that crossfades its child when the key changes, so the row never reflows. */
function Swap({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={[styles.swap, className].filter(Boolean).join(" ")}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={{ opacity: 0, y: 2 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: {
              duration: motionTokens.duration.fast,
              ease: [...motionTokens.ease.enter],
            },
          }}
          exit={{
            opacity: 0,
            y: 0,
            transition: {
              duration: 0.1,
              ease: [...motionTokens.ease.standard],
            },
          }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Split text into chunks of `size` words; a demo reveals them one every 40ms. */
function chunkify(text: string, size = 3): string[] {
  const words = text.split(" ");
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += size)
    chunks.push(words.slice(i, i + size).join(" "));
  return chunks;
}

/** How many chunks are visible `time` ms into a loop that starts streaming at `start`. */
function shownCount(start: number, time: number, max: number): number {
  return time < start ? 0 : Math.min(max, Math.floor((time - start) / 40) + 1);
}

/** Streams revealed chunks as inline spans; the separator lives in the chunk, so wrapping keeps its space. */
function Chunks({
  chunks,
  shown,
  offset = 0,
}: {
  chunks: string[];
  shown: number;
  offset?: number;
}) {
  return (
    <>
      {chunks.slice(0, Math.max(0, shown - offset)).map((chunk, index) => (
        <span className={styles.chunk} key={index}>
          {index ? " " : ""}
          {chunk}
        </span>
      ))}
    </>
  );
}

const inlineMark = (
  <ClaudeMark
    className={styles.claudeMark}
    width={14}
    height={14}
    aria-hidden="true"
  />
);

const rewriteChunks = chunkify(
  "The pricing page is nearly done. Could someone double-check the numbers before Friday's launch?",
);

/** Step 1: a draft gets selected, rewritten and accepted. */
function RewriteDemo({ time }: { time: number }) {
  const rewritten = time >= 2120 && time < 6000;
  const phase =
    time >= 800 && time < 4400
      ? time < 1320
        ? "prompt"
        : time < 2120
          ? "working"
          : "review"
      : null;
  return (
    <div className={styles.panel}>
      <div className={styles.miniHead}>
        <FileText size={14} aria-hidden="true" />
        <span className={styles.miniTitle}>Q4 launch notes</span>
        <span className={styles.miniMeta}>Edited just now</span>
      </div>
      <Swap id={rewritten ? "rewrite" : "draft"} className={styles.docText}>
        <span
          className={styles.selection}
          data-selected={(time >= 480 && time < 4400) || undefined}
        >
          {rewritten ? (
            <Chunks
              chunks={rewriteChunks}
              shown={shownCount(2120, time, rewriteChunks.length)}
            />
          ) : (
            "hey all, pricing page is basically done i think but we still need someone to double check the numbers before friday"
          )}
        </span>
      </Swap>
      <AnimatePresence initial={false}>
        {phase ? (
          <motion.div
            key="bar"
            className={styles.toolbar}
            initial={{ opacity: 0, y: 4 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: {
                duration: motionTokens.duration.fast,
                ease: [...motionTokens.ease.enter],
              },
            }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
          >
            <Swap id={phase} className={styles.toolbarSwap}>
              {phase === "prompt" ? (
                <span className={styles.toolbarRow}>
                  <Wand2 size={14} aria-hidden="true" />
                  Improve writing
                </span>
              ) : phase === "working" ? (
                <span className={styles.toolbarRow}>
                  {inlineMark}
                  <TextShimmer>Rewriting</TextShimmer>
                </span>
              ) : (
                <span className={styles.toolbarRow}>
                  <span
                    className={styles.toolbarAction}
                    data-tone="accent"
                    data-pressed={time >= 3960 || undefined}
                  >
                    <Check size={14} aria-hidden="true" />
                    Accept
                  </span>
                  <span className={styles.toolbarAction}>Discard</span>
                </span>
              )}
            </Swap>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

const threadRows = [
  {
    id: "sofia-ramirez",
    name: "Sofia",
    text: "Can we move launch to Tuesday? Pricing still needs a pass.",
  },
  {
    id: "daniel-kim",
    name: "Daniel",
    text: "Tuesday works. I'll update the changelog tonight.",
  },
  {
    id: "chloe-nguyen",
    name: "Chloe",
    text: "Are we doing 15% or 20% off annual plans?",
  },
];

const summaryRows = [
  { icon: CalendarCheck, chunks: chunkify("Launch moves to Tuesday, Nov 3") },
  { icon: UserRound, chunks: chunkify("Sofia owns the final pricing check") },
  { icon: CircleHelp, chunks: chunkify("Open: 15% or 20% off annual plans") },
];

/** Chunks of the rows above this one, so the summary streams row by row instead of all at once. */
const summaryOffsets = summaryRows.reduce<number[]>(
  (offsets, row, index) => [
    ...offsets,
    index ? offsets[index - 1] + summaryRows[index - 1].chunks.length : 0,
  ],
  [],
);
const summaryChunkCount = summaryRows.reduce(
  (total, row) => total + row.chunks.length,
  0,
);

/** Step 2: a 42-reply thread collapses into decisions, owners and open questions. */
function SummarizeDemo({ time }: { time: number }) {
  const summarized = time >= 1520 && time < 6000;
  const state =
    time < 700 || time >= 6000 ? "idle" : time < 1520 ? "working" : "done";
  const shown = shownCount(1520, time, summaryChunkCount);
  return (
    <div className={styles.panel}>
      <div className={styles.miniHead}>
        <Hash size={14} aria-hidden="true" />
        <span className={styles.miniTitle}>launch-q4</span>
        <span className={styles.miniMetaInline}>42 replies</span>
        <span className={styles.miniPill} data-state={state}>
          <Swap id={state} className={styles.miniPillSwap}>
            {state === "idle" ? (
              <span className={styles.toolbarRow}>
                <AlignLeft size={14} aria-hidden="true" />
                Summarize
              </span>
            ) : state === "working" ? (
              <span className={styles.toolbarRow}>
                {inlineMark}
                <TextShimmer>Summarizing</TextShimmer>
              </span>
            ) : (
              <span className={styles.toolbarRow}>
                <Check size={14} aria-hidden="true" />
                Summarized
              </span>
            )}
          </Swap>
        </span>
      </div>
      <Swap id={summarized ? "summary" : "thread"} className={styles.rows}>
        {summarized ? (
          <span className={styles.rowList}>
            {summaryRows.map((row, index) => {
              const Icon = row.icon;
              const reached = shown > summaryOffsets[index];
              return (
                <span className={styles.sumRow} key={index}>
                  {reached ? (
                    <Icon
                      size={14}
                      className={`${styles.sumIcon} ${styles.chunk}`}
                      aria-hidden="true"
                    />
                  ) : (
                    <span className={styles.sumIconSpace} />
                  )}
                  <span className={styles.truncate}>
                    <Chunks
                      chunks={row.chunks}
                      shown={shown}
                      offset={summaryOffsets[index]}
                    />
                  </span>
                </span>
              );
            })}
          </span>
        ) : (
          <span className={styles.rowList}>
            {threadRows.map((person) => (
              <span className={styles.threadRow} key={person.id}>
                <img
                  className={styles.avatar}
                  src={`/media/people/${person.id}.svg`}
                  alt=""
                  width={20}
                  height={20}
                />
                <span className={styles.threadName}>{person.name}</span>
                <span className={styles.threadText}>{person.text}</span>
              </span>
            ))}
          </span>
        )}
      </Swap>
    </div>
  );
}

const answerChunks = chunkify(
  "Annual plans get 20% off, agreed in Monday's pricing review. It ships with the new pricing page on Tuesday, Nov 3.",
);
const sourcesAt = 1520 + 40 * answerChunks.length + 200;

function NotionMark({
  title = "Notion",
  ...props
}: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-label={title}
      {...props}
    >
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
    </svg>
  );
}

function LinearMark({
  title = "Linear",
  ...props
}: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-label={title}
      {...props}
    >
      <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
    </svg>
  );
}

function SlackMark({
  title = "Slack",
  ...props
}: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} {...props}>
      <path
        fill="#E01E5A"
        d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"
      />
      <path
        fill="#36C5F0"
        d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"
      />
      <path
        fill="#2EB67D"
        d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"
      />
      <path
        fill="#ECB22E"
        d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"
      />
    </svg>
  );
}

const sources = [
  {
    mark: <NotionMark width={14} height={14} aria-hidden="true" />,
    label: "Pricing review",
  },
  {
    mark: <LinearMark width={14} height={14} aria-hidden="true" />,
    label: "GRO-412",
  },
  {
    mark: <SlackMark width={14} height={14} aria-hidden="true" />,
    label: "#launch-q4",
  },
];

/** Step 3: a question answered from three sources, each one linked. */
function AskDemo({ time }: { time: number }) {
  const started = time >= 160 && time < 6000;
  const state = time < 640 ? "idle" : time < 1520 ? "working" : "answer";
  return (
    <div className={styles.panel}>
      <AnimatePresence initial={false}>
        {started ? (
          <motion.div
            key="conversation"
            className={styles.conversation}
            initial={{ opacity: 0, y: 2 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: {
                duration: motionTokens.duration.fast,
                ease: [...motionTokens.ease.enter],
              },
            }}
            exit={{ opacity: 0, transition: { duration: 0.16 } }}
          >
            <span className={styles.bubble}>
              What did we decide on annual pricing?
            </span>
            <span
              className={styles.answerRow}
              data-visible={state !== "idle" || undefined}
            >
              {inlineMark}
              <Swap
                id={state === "answer" ? "answer" : "working"}
                className={styles.answerSwap}
              >
                {state === "answer" ? (
                  <span>
                    <Chunks
                      chunks={answerChunks}
                      shown={shownCount(1520, time, answerChunks.length)}
                    />
                  </span>
                ) : (
                  <TextShimmer>Searching 3 sources</TextShimmer>
                )}
              </Swap>
            </span>
            {time >= sourcesAt ? (
              <span className={styles.sources}>
                {sources.map((source, index) => (
                  <span
                    className={`${styles.source} ${styles.chunk}`}
                    style={{ animationDelay: `${40 * index}ms` }}
                    key={source.label}
                  >
                    {source.mark}
                    <span className={styles.truncate}>{source.label}</span>
                  </span>
                ))}
              </span>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** The shipped tour: inline rewrite, thread summary, workspace answers. */
export const defaultLaunchSteps: LaunchStep[] = [
  {
    id: "rewrite",
    title: "Rewrite anything in place",
    description:
      "Select any text and AI rewrites it in your team's voice, right where you write.",
    benefits: [
      { icon: Wand2, label: "Fixes tone, clarity and grammar" },
      { icon: Link2, label: "Keeps your links and formatting" },
      { icon: Undo2, label: "Undo any change in one keystroke" },
    ],
    demo: (time) => <RewriteDemo time={time} />,
    posterTime: 3400,
  },
  {
    id: "summarize",
    title: "Catch up on any thread",
    description:
      "Turn a long discussion into its decisions, owners and open questions.",
    benefits: [
      { icon: MessagesSquare, label: "Turns 42 replies into three lines" },
      { icon: UserRoundCheck, label: "Finds decisions, owners and dates" },
      { icon: TextQuote, label: "Every point links to its message" },
    ],
    demo: (time) => <SummarizeDemo time={time} />,
    posterTime: 3600,
  },
  {
    id: "ask",
    title: "Ask your whole workspace",
    description:
      "Get answers from your docs, issues and chats, with every source linked.",
    benefits: [
      { icon: FileSearch, label: "Answers cite the pages they used" },
      { icon: LockKeyhole, label: "Respects every page permission" },
      { icon: ShieldCheck, label: "Never used to train models" },
    ],
    demo: (time) => <AskDemo time={time} />,
    posterTime: 3600,
  },
];

/** Timed stand-in for a caller-supplied promise, so the demo still shows its pending state. */
function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const id = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(id);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

const layerIn: TargetAndTransition = {
  opacity: 1,
  y: 0,
  transition: {
    duration: motionTokens.duration.fast,
    delay: 0.06,
    ease: [...motionTokens.ease.enter],
  },
};
const layerOut: TargetAndTransition = {
  opacity: 0,
  y: 2,
  transition: {
    opacity: { duration: 0.1, ease: [...motionTokens.ease.standard] },
    y: { duration: 0, delay: 0.1 },
  },
};
const stillTransition = { duration: 0 };

/** Renders a pure demo function against the shared loop clock, quantised to the 40ms chunk beat. */
function DemoRunner({
  demo,
  clock,
  poster,
  still,
}: {
  demo: LaunchStep["demo"];
  clock: MotionValue<number>;
  poster: number;
  still: boolean;
}) {
  const present = useIsPresent();
  const visible = useRef(present);
  const [time, setTime] = useState(0);
  useLayoutEffect(() => {
    visible.current = present;
  }, [present]);
  useMotionValueEvent(clock, "change", (value) => {
    if (visible.current && !still) setTime(40 * Math.floor(value / 40));
  });
  if (typeof demo !== "function") return <>{demo}</>;
  return <>{demo(still ? poster : time)}</>;
}

type NoteState = "off" | "turningOn" | "turningOff" | "on" | "error" | "locked";

/**
 * An in-product launch card for an AI feature: a looping mini demo above a three-step tour, benefit rows,
 * an admin-gated enable switch and Try it now / Learn more actions. One shared loop clock drives the demo,
 * the dot fill and autoplay, so the three never drift apart.
 */
export function AiFeatureLaunch({
  steps = defaultLaunchSteps,
  step,
  defaultStep = 0,
  onStepChange,
  autoPlay = true,
  stepDuration = 6400,
  workspaceName = "Halcyon",
  memberCount = 48,
  canManage = true,
  enabled,
  defaultEnabled = false,
  onEnabledChange,
  onTry,
  onLearnMore,
  modelName = "Claude Sonnet 5.5",
  modelMark,
  enableLabel = "Enable for my workspace",
  tryLabel = "Try it now",
  learnMoreLabel = "Learn more",
  className,
}: AiFeatureLaunchProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const switchId = `${uid}-switch`;
  const noteId = `${uid}-note`;

  const sectionRef = useRef<HTMLElement>(null);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const total = Math.max(1, steps.length);
  const [internalStep, setInternalStep] = useState(defaultStep);
  const index = Math.min(total - 1, Math.max(0, step ?? internalStep));
  const current = steps[index];

  // Autoplay is the loop clock reaching its end; any pointer or key interaction turns it off for good.
  const [playing, setPlaying] = useState(autoPlay);
  const autoplay = playing && autoPlay && !reduced && total > 1;
  const [cycle, setCycle] = useState(0);
  const clock = useMotionValue(0);
  const fill = useTransform(clock, (value) =>
    Math.min(1, value / stepDuration),
  );
  const controls = useRef<AnimationPlaybackControls | null>(null);
  const onScreen = useRef(true);
  const hovered = useRef(false);

  const go = useCallback(
    (next: number, stop: boolean) => {
      const target = (next + total) % total;
      if (stop) setPlaying(false);
      if (target !== index) {
        if (step === undefined) setInternalStep(target);
        onStepChange?.(target);
      }
    },
    [total, onStepChange, index, step],
  );

  const advance = useRef<() => void>(() => {});
  useEffect(() => {
    advance.current = () => {
      if (autoplay && !hovered.current) go(index + 1, false);
      else setCycle((value) => value + 1);
    };
  }, [go, autoplay, index]);

  useLayoutEffect(() => {
    clock.jump(0);
  }, [clock, index, cycle]);

  useEffect(() => {
    if (reduced) return;
    const animation = animate(clock, stepDuration, {
      duration: stepDuration / 1000,
      ease: "linear",
      onComplete: () => advance.current(),
    });
    controls.current = animation;
    if (!onScreen.current) animation.pause();
    return () => animation.stop();
  }, [clock, cycle, reduced, index, stepDuration]);

  // The loop pauses while the card is off screen, so a scrolled-away demo never ticks in the background.
  useEffect(() => {
    const element = sectionRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      onScreen.current = entry.isIntersecting;
      if (entry.isIntersecting) controls.current?.play();
      else controls.current?.pause();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const [flashText, setFlashText] = useState("");
  const [flash, setFlash] = useState<{ id: number; text: string } | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  const announce = useCallback((message: string) => {
    window.clearTimeout(flashTimer.current);
    setFlash({ id: Date.now(), text: message });
    setFlashText(message);
    flashTimer.current = window.setTimeout(() => setFlash(null), 2800);
  }, []);

  const [internalEnabled, setInternalEnabled] = useState(defaultEnabled);
  const isOn = enabled ?? internalEnabled;
  const [switchState, setSwitchState] = useState<"idle" | "pending" | "error">(
    "idle",
  );
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);
  const switchController = useRef<AbortController | null>(null);
  const members = `${memberCount} member${memberCount === 1 ? "" : "s"}`;
  const [tryLoading, setTryLoading] = useState(false);
  const tryController = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      switchController.current?.abort();
      window.clearTimeout(flashTimer.current);
      tryController.current?.abort();
    },
    [],
  );

  const metaState: NoteState = !canManage
    ? "locked"
    : switchState === "pending"
      ? pendingValue
        ? "turningOn"
        : "turningOff"
      : switchState === "error"
        ? "error"
        : isOn
          ? "on"
          : "off";

  const notes: Record<NoteState, ReactNode> = {
    off: (
      <span className={styles.noteText}>
        Admins only. Turns on AI for all {members}.
      </span>
    ),
    turningOn: (
      <TextShimmer
        active={metaState === "turningOn"}
      >{`Turning on for ${members}`}</TextShimmer>
    ),
    turningOff: (
      <TextShimmer
        active={metaState === "turningOff"}
      >{`Turning off for ${members}`}</TextShimmer>
    ),
    on: (
      <>
        <Check
          size={14}
          className={styles.noteIconSuccess}
          aria-hidden="true"
        />
        <span className={styles.noteText}>
          On for all {members}.
          {onEnabledChange ? "" : " Simulated, nothing was saved."}
        </span>
      </>
    ),
    error: (
      <>
        <CircleAlert
          size={14}
          className={styles.noteIconDanger}
          aria-hidden="true"
        />
        <span className={styles.noteText}>
          Could not save. Nothing changed, try again.
        </span>
      </>
    ),
    locked: (
      <>
        <LockKeyhole size={14} className={styles.noteIcon} aria-hidden="true" />
        <span className={styles.noteText}>
          Only admins can change this. You can still try it yourself.
        </span>
      </>
    ),
  };

  const mark = modelMark ?? (
    <ClaudeMark
      className={styles.claudeMark}
      width={14}
      height={14}
      aria-hidden="true"
    />
  );

  return (
    <section
      ref={sectionRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-roledescription="feature announcement"
      aria-label={current?.title ?? "New AI features"}
      onPointerEnter={() => {
        hovered.current = true;
      }}
      onPointerLeave={() => {
        hovered.current = false;
      }}
    >
      <div className={styles.stage} data-frame-keep="">
        <AnimatePresence initial={false}>
          <motion.div
            key={current?.id ?? "empty"}
            className={styles.demoLayer}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: reduced
                ? stillTransition
                : {
                    duration: motionTokens.duration.fast,
                    delay: 0.06,
                    ease: [...motionTokens.ease.enter],
                  },
            }}
            exit={{
              opacity: 0,
              transition: reduced
                ? stillTransition
                : { duration: 0.1, ease: [...motionTokens.ease.standard] },
            }}
          >
            {current ? (
              <DemoRunner
                demo={current.demo}
                clock={clock}
                poster={current.posterTime ?? 0.6 * stepDuration}
                still={reduced}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
        {total > 1 ? (
          <div
            className={styles.dots}
            role="group"
            aria-label="Tour steps"
            onKeyDown={(event) => {
              const direction =
                event.key === "ArrowRight"
                  ? 1
                  : event.key === "ArrowLeft"
                    ? -1
                    : 0;
              const target =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? total - 1
                    : direction
                      ? (index + direction + total) % total
                      : -1;
              if (target < 0) return;
              event.preventDefault();
              go(target, true);
              dotRefs.current[target]?.focus();
            }}
          >
            {steps.map((tourStep, dotIndex) => {
              const active = dotIndex === index;
              return (
                <button
                  key={tourStep.id}
                  ref={(element) => {
                    dotRefs.current[dotIndex] = element;
                  }}
                  type="button"
                  className={styles.dot}
                  aria-label={`Step ${dotIndex + 1} of ${total}: ${tourStep.title}`}
                  aria-current={active ? "step" : undefined}
                  tabIndex={active ? 0 : -1}
                  onClick={() => go(dotIndex, true)}
                >
                  <motion.span
                    className={styles.dotMark}
                    data-active={active || undefined}
                    initial={false}
                    animate={{ width: active ? 20 : 6 }}
                    transition={
                      reduced
                        ? stillTransition
                        : { type: "spring", visualDuration: 0.24, bounce: 0 }
                    }
                  >
                    {active ? (
                      <motion.span
                        className={styles.dotFill}
                        style={{ scaleX: autoplay ? fill : 1 }}
                      />
                    ) : null}
                  </motion.span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className={styles.body}>
        <div className={styles.copyStack}>
          {steps.map((tourStep, layerIndex) => {
            const active = layerIndex === index;
            return (
              <motion.div
                key={tourStep.id}
                className={styles.copyLayer}
                data-active={active || undefined}
                aria-hidden={!active || undefined}
                inert={!active}
                initial={false}
                animate={active ? layerIn : layerOut}
              >
                <h2 className={styles.title}>{tourStep.title}</h2>
                <p className={styles.description}>{tourStep.description}</p>
                {tourStep.benefits.length ? (
                  <ul className={styles.benefits}>
                    {tourStep.benefits.slice(0, 3).map((benefit) => {
                      const Icon = benefit.icon;
                      return (
                        <li key={benefit.label} className={styles.benefit}>
                          <Icon
                            size={16}
                            className={styles.benefitIcon}
                            aria-hidden="true"
                          />
                          <span>{benefit.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </motion.div>
            );
          })}
        </div>
        <div className={styles.setting}>
          <label
            htmlFor={switchId}
            className={styles.settingLabel}
            data-disabled={!canManage || undefined}
          >
            {enableLabel}
          </label>
          <Switch
            id={switchId}
            checked={pendingValue ?? isOn}
            onCheckedChange={(next) => {
              setPlaying(false);
              // A second toggle while the save is in flight cancels it and reverts the shown value.
              if (switchController.current) {
                switchController.current.abort();
                switchController.current = null;
                setPendingValue(null);
                setSwitchState("idle");
                setFlashText("Cancelled. Nothing changed.");
                return;
              }
              const controller = new AbortController();
              switchController.current = controller;
              setPendingValue(next);
              setSwitchState("pending");
              setFlashText(
                next
                  ? `Turning on for ${members}`
                  : `Turning off for ${members}`,
              );
              (onEnabledChange
                ? Promise.resolve().then(() =>
                    onEnabledChange(next, controller.signal),
                  )
                : delay(900, controller.signal)
              )
                .then(
                  () => {
                    if (controller.signal.aborted) return;
                    if (enabled === undefined) setInternalEnabled(next);
                    setSwitchState("idle");
                    setFlashText(
                      `${next ? "On" : "Off"} for ${workspaceName}.${onEnabledChange ? "" : " Simulated, nothing was saved."}`,
                    );
                  },
                  () => {
                    if (controller.signal.aborted) return;
                    setSwitchState("error");
                    setFlashText(
                      "Could not save the setting. Nothing changed.",
                    );
                  },
                )
                .finally(() => {
                  if (switchController.current === controller)
                    switchController.current = null;
                  if (!controller.signal.aborted) setPendingValue(null);
                });
            }}
            disabled={!canManage}
            aria-describedby={noteId}
            className={styles.switch}
          />
          <div id={noteId} className={styles.noteStack}>
            {(Object.keys(notes) as NoteState[]).map((key) => (
              <span
                key={key}
                className={styles.note}
                data-active={key === metaState || undefined}
                aria-hidden={key !== metaState || undefined}
              >
                {notes[key]}
              </span>
            ))}
          </div>
        </div>
        <div className={styles.footer}>
          <div className={styles.meta}>
            <Swap
              id={flash ? `flash-${flash.id}` : "model"}
              className={styles.metaSwap}
            >
              {flash ? (
                <span className={styles.metaItem}>
                  <Info size={14} aria-hidden="true" />
                  <span className={styles.truncate}>{flash.text}</span>
                </span>
              ) : (
                <span className={styles.metaItem}>
                  {mark}
                  <span className={styles.truncate}>Runs on {modelName}</span>
                </span>
              )}
            </Swap>
          </div>
          <div className={styles.actions}>
            <Button
              variant="secondary"
              onClick={() => {
                setPlaying(false);
                if (onLearnMore) onLearnMore();
                else announce("Simulated, docs were not opened");
              }}
            >
              {learnMoreLabel}
            </Button>
            <Button
              variant="primary"
              loading={tryLoading}
              onClick={() => {
                setPlaying(false);
                if (tryLoading) return;
                const controller = new AbortController();
                tryController.current = controller;
                setTryLoading(true);
                (onTry
                  ? Promise.resolve().then(() => onTry(controller.signal))
                  : delay(600, controller.signal)
                )
                  .then(
                    () => {
                      if (!onTry && !controller.signal.aborted)
                        announce("Simulated, nothing was opened");
                    },
                    () => {
                      if (!controller.signal.aborted)
                        announce("Could not open it. Try again.");
                    },
                  )
                  .finally(() => {
                    if (!controller.signal.aborted) setTryLoading(false);
                  });
              }}
            >
              {tryLabel}
            </Button>
          </div>
        </div>
      </div>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {flashText}
      </span>
    </section>
  );
}

export default AiFeatureLaunch;
