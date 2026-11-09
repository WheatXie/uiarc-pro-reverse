"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import type { AnimationPlaybackControls, MotionStyle } from "motion/react";
import { Check, CircleAlert, Pencil, RotateCcw, Sparkles, Square, Undo2 } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import Button from "../button/button";
import TextShimmer from "../text-shimmer/text-shimmer";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./agent-cursor.module.css";

export type DocBlockType = "title" | "heading" | "paragraph";

/** One block of the document: a stable id, its kind and its text. */
export interface DocBlock {
  id: string;
  type: DocBlockType;
  text: string;
}

/** A rewrite replaces a block's whole text, flagged as pending until reviewed. */
export interface RewriteEdit {
  type: "rewrite";
  blockId: string;
  text: string;
  label?: string;
}

/** An insert adds one block after another and grows it from zero height. */
export interface InsertEdit {
  type: "insert";
  afterBlockId: string;
  block: DocBlock;
  label?: string;
}

/** A fix replaces one word, flagged with a wavy underline before it lands. */
export interface FixEdit {
  type: "fix";
  blockId: string;
  find: string;
  text: string;
  label?: string;
}

export type AgentEdit = RewriteEdit | InsertEdit | FixEdit;

export type AgentCursorPhase =
  | "idle"
  | "thinking"
  | "editing"
  | "review"
  | "accepted"
  | "reverted"
  | "stopped"
  | "empty"
  | "error";

export interface AgentCursorAgent {
  name: string;
  /** A 24 × 24 mark drawn in currentColor, used in the header, the bar and the cursor tag. */
  mark?: ReactNode;
  /** The color of the cursor, the selection and the change tint. */
  color?: string;
}

export interface AgentCursorCollaborator {
  name: string;
  avatar?: string;
  color?: string;
}

export interface AgentCursorProps {
  /** The document as title, heading and paragraph blocks with stable ids. Compared by content, so an inline array is fine. */
  blocks?: DocBlock[];
  /** A muted line under the title, such as the owner and a target date. */
  meta?: string;
  /** Edits to play in order: rewrite, insert and fix. Ignored when `run` is set. */
  edits?: AgentEdit[];
  /** Fetches edits from your agent. The signal aborts when someone presses Stop. */
  run?: (signal: AbortSignal) => Promise<AgentEdit[]>;
  /** The agent's name, mark and color. */
  agent?: AgentCursorAgent;
  /** A human in the doc, drawn as a second cursor. Null hides it. */
  collaborator?: AgentCursorCollaborator | null;
  /** Starts a run as soon as the card is on screen. Off, the header shows an Ask button instead. */
  autoPlay?: boolean;
  /** Replays the run: the collaborator accepts after a short pause, then the doc resets. */
  loop?: boolean;
  /** Playback speed multiplier for cursor travel, streaming and pauses. */
  speed?: number;
  /** Called with the edited document when someone accepts. */
  onAccept?: (blocks: DocBlock[]) => void;
  /** Called with the restored document when someone undoes the edits. */
  onUndo?: (blocks: DocBlock[]) => void;
  /** Fires on idle, thinking, editing, review, accepted, reverted, stopped, empty and error. */
  onPhaseChange?: (phase: AgentCursorPhase) => void;
  /** Adds "Simulated, nothing was saved" to the screen reader status. */
  simulated?: boolean;
  /** Extra class on the card. */
  className?: string;
}

/** A block while the run plays: it carries the streaming, tinting and typo state. */
interface RunBlock extends DocBlock {
  fresh?: number;
  chunks?: string[];
  shown?: number;
  inserted?: boolean;
  pending?: boolean;
  fading?: boolean;
  fix?: { start: number; from: string; to: string; applied: boolean };
}

/** One measured line box of a block, relative to the card. */
interface LineBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The selection an edit painted, keyed so a new edit restarts the line-by-line fill. */
interface Selection {
  key: number;
  boxes: LineBox[];
  ms: number;
}

type Side = "agent" | "human";

const SAMPLE_BLOCKS: DocBlock[] = [
  { id: "title", type: "title", text: "Usage-based billing launch" },
  {
    id: "summary",
    type: "paragraph",
    text: "On November 18 every Team workspace moves to usage-based billing: seats plus metered agent runs, invoiced monthly through Stripe.",
  },
  { id: "goals-heading", type: "heading", text: "Goals" },
  {
    id: "goals",
    type: "paragraph",
    text: "So basically the main thing we are trying to do here is make it so customers can actually see what they are going to pay before the invoice shows up, because a lot of people were surprised by their bills last quarter and that turned into a lot of support tickets.",
  },
  {
    id: "rollout",
    type: "paragraph",
    text: "Week one goes to 5% of workpsaces behind the usage_billing flag. We widen to 50% once refund requests stay under 0.4% for seven days, then ship to everyone on December 2.",
  },
];

const SAMPLE_EDITS: AgentEdit[] = [
  {
    type: "rewrite",
    blockId: "goals",
    label: "Tightening the goals",
    text: "Customers should see what they will pay before the invoice arrives. Surprise bills drove 31% of billing tickets in Q3, so a live usage meter and spend alerts ship on day one.",
  },
  {
    type: "insert",
    afterBlockId: "goals",
    label: "Adding a heading",
    block: { id: "rollout-heading", type: "heading", text: "Rollout" },
  },
  {
    type: "fix",
    blockId: "rollout",
    find: "workpsaces",
    text: "workspaces",
    label: "Fixing a typo",
  },
];

const DEFAULT_AGENT_COLOR = "#D97757";
const DEFAULT_AGENT: AgentCursorAgent = { name: "Claude", color: DEFAULT_AGENT_COLOR };
const DEFAULT_COLLABORATOR: AgentCursorCollaborator = {
  name: "Emma Collins",
  avatar: "/media/people/emma-collins.svg",
};

/** Quadratic arc in and out for cursor travel. */
const EASE_TRAVEL: [number, number, number, number] = [0.4, 0, 0.2, 1];
/** The faster, flatter curve a selection drag uses. */
const EASE_SELECT: [number, number, number, number] = [0.35, 0, 0.6, 1];
/** Status crossfade curve. */
const EASE_STATUS = [...motionTokens.ease.standard] as [number, number, number, number];
/** Words per streamed chunk, cycled so the stream reads unevenly like real typing. */
const CHUNK_SIZES = [4, 5, 3, 6, 4, 5];
const TAG_FLIP_GUTTER = 112;

const CLAUDE_MARK_PATH =
  "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z";

/** The Claude mark the sample ships with, so `agent.mark` is optional. */
function DefaultAgentMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Claude" aria-hidden="true">
      <path d={CLAUDE_MARK_PATH} />
    </svg>
  );
}

/** Copies the document into run blocks; `fresh` marks a block the reset just swapped in. */
const toRunBlocks = (blocks: DocBlock[], fresh?: number): RunBlock[] =>
  blocks.map((block) => ({ id: block.id, type: block.type, text: block.text, fresh }));

/** The status line an edit shows while it plays, defaulting by kind. */
function editLabel(edit: AgentEdit): string {
  if (edit.label) return edit.label;
  if (edit.type === "rewrite") return "Rewriting a paragraph";
  if (edit.type === "fix") return "Fixing a typo";
  return edit.block.type === "heading" ? "Adding a heading" : "Adding a paragraph";
}

/** Splits a rewrite into the uneven chunks the stream reveals. */
function toChunks(text: string): string[] {
  const parts = text.split(/(?=\s)/);
  const chunks: string[] = [];
  for (let index = 0, chunk = 0; index < parts.length; chunk++) {
    const size = CHUNK_SIZES[chunk % CHUNK_SIZES.length];
    chunks.push(parts.slice(index, index + size).join(""));
    index += size;
  }
  return chunks;
}

const aborted = () => new DOMException("Aborted", "AbortError");

/**
 * A document card where an AI agent edits live with a labeled cursor beside a human collaborator,
 * then hands the changes over for review. With no props it plays a simulated run on a sample
 * launch brief.
 */
export function AgentCursor({
  blocks = SAMPLE_BLOCKS,
  meta,
  edits,
  run,
  agent = DEFAULT_AGENT,
  collaborator = DEFAULT_COLLABORATOR,
  autoPlay = true,
  loop,
  speed = 1,
  onAccept,
  onUndo,
  onPhaseChange,
  simulated,
  className,
}: AgentCursorProps) {
  const reduced = useReducedMotion() ?? false;
  const isSample = blocks === SAMPLE_BLOCKS && !edits && !run;
  const metaLine = meta ?? (blocks === SAMPLE_BLOCKS ? "Emma Collins · Target Nov 18, 2026" : undefined);
  const loopDefault = (loop ?? isSample) && !reduced;
  const agentColor = agent.color ?? DEFAULT_AGENT_COLOR;
  const collaboratorFirstName = collaborator?.name.split(/\s+/)[0] ?? "";

  const root = useRef<HTMLDivElement>(null);
  const acceptButton = useRef<HTMLButtonElement>(null);
  const textNodes = useRef(new Map<string, HTMLElement>());
  const fixNodes = useRef(new Map<string, HTMLElement>());

  const [doc, setDoc] = useState<RunBlock[]>(() => toRunBlocks(blocks));
  const [phase, setPhase] = useState<AgentCursorPhase>(autoPlay ? "thinking" : "idle");
  const [label, setLabel] = useState("");
  const [editCount, setEditCount] = useState(0);
  const [error, setError] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [docFading, setDocFading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [ready, setReady] = useState(false);
  const [agentHidden, setAgentHidden] = useState(true);
  const [flip, setFlip] = useState<{ agent: boolean; human: boolean }>({ agent: false, human: false });
  const [pressedHuman, setPressedHuman] = useState(false);

  const docRef = useRef(doc);
  const phaseRef = useRef(phase);
  const configRef = useRef({
    blocks,
    edits,
    run,
    speed,
    onAccept,
    onUndo,
    reduced,
    loopDefault,
  });

  useLayoutEffect(() => {
    docRef.current = doc;
    phaseRef.current = phase;
    configRef.current = {
      blocks,
      edits,
      run,
      speed,
      onAccept,
      onUndo,
      reduced,
      loopDefault,
    };
  });

  const agentX = useMotionValue(0);
  const agentY = useMotionValue(0);
  const humanX = useMotionValue(0);
  const humanY = useMotionValue(0);
  const agentTravel = useRef<(() => void) | null>(null);
  const humanTravel = useRef<(() => void) | null>(null);

  const following = useRef(true);
  const revealTimer = useRef(0);
  const agentAvatar = useRef<HTMLSpanElement>(null);
  const parkHuman = useRef(false);
  const abortController = useRef<AbortController | null>(null);
  const looping = useRef(loopDefault);
  const appliedCount = useRef(0);
  const baseline = useRef(blocks);
  const finishReview = useRef<(() => void) | null>(null);
  const engagement = useRef({ hover: false, focus: false });
  const onScreen = useRef(true);
  const waiting = useRef(new Set<() => void>());
  const selectionKey = useRef(0);
  const freshSeq = useRef(0);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  /** Holds playback until the card is at least a tenth on screen. */
  const whenVisible = useCallback(
    () =>
      onScreen.current
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            waiting.current.add(resolve);
          }),
    [],
  );

  const delay = useCallback(
    (ms: number, signal: AbortSignal) =>
      new Promise<void>((resolve, reject) => {
        if (signal.aborted) return reject(aborted());
        const onAbort = () => {
          window.clearTimeout(timer);
          reject(aborted());
        };
        const timer = window.setTimeout(() => {
          signal.removeEventListener("abort", onAbort);
          whenVisible().then(() => (signal.aborted ? reject(aborted()) : resolve()));
        }, ms / configRef.current.speed);
        signal.addEventListener("abort", onAbort, { once: true });
      }),
    [whenVisible],
  );

  const cardRect = useCallback(() => root.current?.getBoundingClientRect() ?? new DOMRect(), []);

  /** Every visual line of a block, measured from the live line boxes. */
  const lineBoxes = useCallback(
    (node: HTMLElement | undefined) => {
      if (!node) return [] as LineBox[];
      const range = document.createRange();
      range.selectNodeContents(node);
      const origin = cardRect();
      const lineHeight = parseFloat(getComputedStyle(node).lineHeight) || 24;
      const lines: LineBox[] = [];
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.width < 1) continue;
        const mid = rect.top + rect.height / 2 - origin.top;
        const left = rect.left - origin.left;
        const sameLine = lines.find((line) => Math.abs(line.y + line.h / 2 - mid) < lineHeight / 2);
        if (sameLine) {
          const right = Math.max(sameLine.x + sameLine.w, left + rect.width);
          sameLine.x = Math.min(sameLine.x, left);
          sameLine.w = right - sameLine.x;
        } else {
          lines.push({ x: left, y: mid - lineHeight / 2, w: rect.width, h: lineHeight });
        }
      }
      return lines.sort((a, b) => a.y - b.y);
    },
    [cardRect],
  );

  /** Where the agent parks while it reads: the middle of its own header avatar. */
  const homeAnchor = useCallback(() => {
    const node = agentAvatar.current?.getBoundingClientRect();
    if (!node) return null;
    const origin = cardRect();
    return { x: node.left - origin.left + node.width / 2, y: node.top - origin.top + node.height / 2 };
  }, [cardRect]);

  /** Where the human rests: the end of the first paragraph's last line. */
  const readAnchor = useCallback(() => {
    const first = docRef.current.find((block, index) => index > 0 && block.type === "paragraph");
    const card = root.current;
    const line = lineBoxes(first ? textNodes.current.get(first.id) : undefined).at(-1);
    return line && card
      ? { x: Math.min(line.x + line.w + 10, card.clientWidth - TAG_FLIP_GUTTER - 4), y: line.y + 0.55 * line.h }
      : null;
  }, [lineBoxes]);

  /** Glides one cursor along a quadratic arc, 280–600 ms by distance, and resolves on arrival. */
  const moveTo = useCallback(
    (
      side: Side,
      point: { x: number; y: number },
      options: { ms?: number; straight?: boolean; ease?: [number, number, number, number] } = {},
    ) =>
      new Promise<void>((resolve) => {
        const travel = side === "agent" ? agentTravel : humanTravel;
        const x = side === "agent" ? agentX : humanX;
        const y = side === "agent" ? agentY : humanY;
        travel.current?.();
        const width = root.current?.clientWidth ?? 0;
        const shouldFlip = point.x > width - TAG_FLIP_GUTTER;
        setFlip((current) => (current[side] === shouldFlip ? current : { ...current, [side]: shouldFlip }));
        const fromX = x.get();
        const fromY = y.get();
        const dx = point.x - fromX;
        const dy = point.y - fromY;
        const distance = Math.hypot(dx, dy);
        if (configRef.current.reduced || distance < 1) {
          x.set(point.x);
          y.set(point.y);
          resolve();
          return;
        }
        const duration =
          (options.ms ?? Math.min(600, Math.max(280, 220 + 0.7 * distance))) / configRef.current.speed;
        const bow = options.straight ? 0 : Math.min(0.14 * distance, 32);
        const controlX = fromX + dx / 2 - (dy / distance) * bow;
        const controlY = fromY + dy / 2 + (dx / distance) * bow;
        const controls = animate(0, 1, {
          duration: duration / 1000,
          ease: options.ease ?? EASE_TRAVEL,
          onUpdate: (progress) => {
            const inverse = 1 - progress;
            x.set(inverse * inverse * fromX + 2 * inverse * progress * controlX + progress * progress * point.x);
            y.set(inverse * inverse * fromY + 2 * inverse * progress * controlY + progress * progress * point.y);
          },
          onComplete: () => {
            travel.current = null;
            resolve();
          },
        });
        travel.current = () => {
          controls.stop();
          travel.current = null;
          resolve();
        };
      }),
    [agentX, agentY, humanX, humanY],
  );

  /** Sends the cursor to a point and remembers that it is no longer following the doc. */
  const travelTo = useCallback(
    async (point: { x: number; y: number }, options?: { ms?: number; straight?: boolean; ease?: [number, number, number, number] }) => {
      following.current = false;
      window.clearTimeout(revealTimer.current);
      setAgentHidden(false);
      await moveTo("agent", point, options);
    },
    [moveTo],
  );

  /** Returns the agent to its header anchor and reveals it again. */
  const goHome = useCallback(async () => {
    const anchor = homeAnchor();
    following.current = true;
    window.clearTimeout(revealTimer.current);
    revealTimer.current = window.setTimeout(() => setAgentHidden(true), 180 * Number(!configRef.current.reduced));
    if (anchor) await moveTo("agent", anchor);
  }, [homeAnchor, moveTo]);

  const patchBlock = useCallback((id: string, patch: Partial<RunBlock> | ((block: RunBlock) => Partial<RunBlock>)) => {
    setDoc((current) =>
      current.map((block) =>
        block.id === id ? { ...block, ...(typeof patch === "function" ? patch(block) : patch) } : block,
      ),
    );
  }, []);

  const nextFrame = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  const paintSelection = useCallback((boxes: LineBox[], ms: number) => {
    setSelection({ key: ++selectionKey.current, boxes, ms });
  }, []);

  /** Plays one edit: select and stream a rewrite, grow a heading, or flag a typo then fix it. */
  const playEdit = useCallback(
    async (edit: AgentEdit, signal: AbortSignal) => {
      const instant = configRef.current.reduced;
      if (edit.type === "rewrite") {
        const lines = lineBoxes(textNodes.current.get(edit.blockId));
        if (!lines.length) return;
        const first = lines[0];
        const last = lines[lines.length - 1];
        await travelTo({ x: first.x, y: first.y + 0.6 * first.h });
        await delay(90, signal);
        const selectMs = Math.min(520, Math.max(240, 110 * lines.length));
        paintSelection(lines, selectMs);
        await travelTo(
          { x: last.x + last.w, y: last.y + 0.6 * last.h },
          { ms: selectMs, straight: true, ease: EASE_SELECT },
        );
        await delay(180, signal);
        appliedCount.current++;
        setSelection(null);
        patchBlock(edit.blockId, { fading: true });
        await delay(110, signal);
        const chunks = toChunks(edit.text);
        patchBlock(edit.blockId, {
          text: edit.text,
          chunks,
          shown: instant ? chunks.length : 0,
          fading: false,
          pending: true,
          fix: undefined,
        });
        await nextFrame();
        if (instant) return;
        const tail = lineBoxes(textNodes.current.get(edit.blockId)).at(-1);
        if (tail) {
          void travelTo(
            { x: tail.x + tail.w, y: tail.y + 0.6 * tail.h },
            { ms: Math.max(320, 34 * chunks.length + 140), ease: EASE_TRAVEL },
          );
        }
        for (let shown = 1; shown <= chunks.length; shown++) {
          patchBlock(edit.blockId, { shown });
          await delay(34, signal);
        }
        await delay(200, signal);
      } else if (edit.type === "insert") {
        const index = docRef.current.findIndex((block) => block.id === edit.afterBlockId);
        if (index < 0) return;
        const next = docRef.current[index + 1];
        const nextLine = lineBoxes(next ? textNodes.current.get(next.id) : undefined)[0];
        const anchorLine = lineBoxes(textNodes.current.get(edit.afterBlockId)).at(-1);
        const point = nextLine
          ? { x: nextLine.x, y: nextLine.y + 6 }
          : anchorLine
            ? { x: anchorLine.x, y: anchorLine.y + anchorLine.h + 18 }
            : null;
        if (point) await travelTo(point);
        await delay(120, signal);
        appliedCount.current++;
        setDoc((current) => {
          const at = current.findIndex((block) => block.id === edit.afterBlockId);
          const inserted: RunBlock = {
            id: edit.block.id,
            type: edit.block.type,
            text: edit.block.text,
            inserted: true,
            pending: true,
          };
          return [...current.slice(0, at + 1), inserted, ...current.slice(at + 1)];
        });
        await delay(300, signal);
        const tail = lineBoxes(textNodes.current.get(edit.block.id)).at(-1);
        if (tail) await travelTo({ x: tail.x + tail.w + 2, y: tail.y + 0.6 * tail.h }, { ms: 260 });
        await delay(240, signal);
      } else {
        const line = lineBoxes(fixNodes.current.get(edit.blockId))[0];
        if (!line) return;
        await travelTo({ x: line.x + 0.55 * line.w, y: line.y + 0.62 * line.h });
        await delay(80, signal);
        paintSelection([line], 140);
        await delay(260, signal);
        appliedCount.current++;
        setSelection(null);
        patchBlock(edit.blockId, (block) =>
          block.fix
            ? {
                fix: { ...block.fix, applied: true },
                text:
                  block.text.slice(0, block.fix.start) +
                  block.fix.to +
                  block.text.slice(block.fix.start + block.fix.from.length),
                pending: true,
              }
            : {},
        );
        await delay(320, signal);
      }
    },
    [delay, lineBoxes, patchBlock, paintSelection, travelTo],
  );

  /** Accepts the edits: clears the tint, reports the document and settles the review. */
  const accept = useCallback(() => {
    if (phaseRef.current !== "review") return;
    setDoc((current) => current.map((block) => ({ ...block, pending: false })));
    setPhase("accepted");
    configRef.current.onAccept?.(
      docRef.current.map((block) => ({ id: block.id, type: block.type, text: block.text })),
    );
    finishReview.current?.();
    finishReview.current = null;
  }, []);

  /** Undoes the run: every block returns to the text it had before the agent touched it. */
  const undo = useCallback(() => {
    if (phaseRef.current !== "review") return;
    const original = baseline.current;
    const seq = ++freshSeq.current;
    setDoc((current) =>
      original.map((source) => {
        const live = current.find((block) => block.id === source.id);
        if (live?.fix?.applied && !live.chunks) {
          return {
            id: source.id,
            type: source.type,
            text: source.text,
            fix: { ...live.fix, applied: false },
          };
        }
        const changed = !live || live.text !== source.text || !!live.chunks;
        return {
          id: source.id,
          type: source.type,
          text: source.text,
          fresh: changed ? seq : live?.fresh,
        };
      }),
    );
    setPhase("reverted");
    configRef.current.onUndo?.(original);
    finishReview.current?.();
    finishReview.current = null;
  }, []);

  /** After a pause, the collaborator moves to Accept, presses it and drifts back to reading. */
  const autoAccept = useCallback(
    async (signal: AbortSignal) => {
      await delay(1500, signal);
      while (engagement.current.hover || engagement.current.focus) await delay(250, signal);
      if (phaseRef.current !== "review") return;
      const bounds = acceptButton.current?.getBoundingClientRect();
      const origin = cardRect();
      parkHuman.current = true;
      try {
        if (bounds) {
          await moveTo(
            "human",
            {
              x: bounds.left - origin.left + 0.55 * bounds.width,
              y: bounds.top - origin.top + 0.62 * bounds.height,
            },
            { ms: 520 },
          );
        }
        if (signal.aborted || phaseRef.current !== "review") return;
        setPressedHuman(true);
        await delay(130, signal);
        setPressedHuman(false);
        accept();
        await delay(420, signal);
        const anchor = readAnchor();
        if (anchor) await moveTo("human", anchor, { ms: 560 });
      } finally {
        setPressedHuman(false);
        parkHuman.current = false;
      }
    },
    [accept, cardRect, delay, moveTo, readAnchor],
  );

  /** Puts the document back to the props it was given, folding any edits away first. */
  const resetDocument = useCallback(
    async (signal: AbortSignal) => {
      const source = configRef.current.blocks;
      const live = docRef.current;
      const differs =
        live.length !== source.length ||
        live.some((block, index) => block.text !== source[index]?.text || block.pending || block.fix);
      setSelection(null);
      if (!differs) return;
      setDocFading(true);
      await delay(130, signal);
      setResetting(true);
      setDoc(toRunBlocks(source));
      await nextFrame();
      setResetting(false);
      setDocFading(false);
    },
    [delay],
  );

  /** One full run: read, receive edits, play each one, then wait for accept or undo. */
  const playRun = useCallback(
    async (signal: AbortSignal) => {
      for (;;) {
        let edits: AgentEdit[];
        await resetDocument(signal);
        await whenVisible();
        setPhase("thinking");
        setError("");
        appliedCount.current = 0;
        baseline.current = configRef.current.blocks;
        if (!following.current) await goHome();
        const approach = (async () => {
          await delay(240, signal);
          const first = docRef.current.find((block, index) => index > 0 && block.type === "paragraph");
          const line = lineBoxes(first ? textNodes.current.get(first.id) : undefined)[0];
          if (line) {
            await moveTo(
              "agent",
              { x: line.x + 0.3 * Math.min(line.w, 480), y: line.y + 0.6 * line.h },
              { ms: 520 },
            );
          }
        })();
        try {
          const { run: fetchEdits, edits: scripted } = configRef.current;
          const incoming = fetchEdits
            ? fetchEdits(signal)
            : delay(900, signal).then(() => scripted ?? SAMPLE_EDITS);
          [edits] = await Promise.all([incoming, approach, delay(700, signal)]);
        } catch (cause) {
          if (signal.aborted) throw aborted();
          setError(
            cause instanceof Error && cause.message ? cause.message : "The edit could not finish",
          );
          setPhase("error");
          void goHome();
          if (!looping.current) return;
          await delay(2600, signal);
          continue;
        }
        const currentDoc = docRef.current;
        const valid = edits.filter((edit) =>
          edit.type === "insert"
            ? currentDoc.some((block) => block.id === edit.afterBlockId) &&
              !currentDoc.some((block) => block.id === edit.block.id)
            : edit.type === "rewrite"
              ? currentDoc.some((block) => block.id === edit.blockId)
              : currentDoc.some((block) => block.id === edit.blockId && block.text.includes(edit.find)),
        );
        if (!valid.length) {
          setPhase("empty");
          void goHome();
          if (!looping.current) return;
          await delay(2000, signal);
          continue;
        }
        setDoc((current) =>
          current.map((block) => {
            const fix = valid.find(
              (edit): edit is FixEdit => edit.type === "fix" && edit.blockId === block.id,
            );
            return fix
              ? {
                  ...block,
                  fix: {
                    start: block.text.indexOf(fix.find),
                    from: fix.find,
                    to: fix.text,
                    applied: false,
                  },
                }
              : block;
          }),
        );
        setPhase("editing");
        for (const edit of valid) {
          setLabel(editLabel(edit));
          await playEdit(edit, signal);
          setEditCount(appliedCount.current);
          await delay(200, signal);
        }
        setEditCount(appliedCount.current);
        setPhase("review");
        void goHome();
        const reviewed = new Promise<void>((resolve) => {
          finishReview.current = resolve;
        });
        if (looping.current) autoAccept(signal).catch(() => {});
        await Promise.race([
          reviewed,
          new Promise<void>((_, reject) =>
            signal.addEventListener("abort", () => reject(aborted()), { once: true }),
          ),
        ]);
        if (!looping.current) return;
        await delay(1900, signal);
      }
    },
    [autoAccept, delay, goHome, lineBoxes, moveTo, playEdit, resetDocument, whenVisible],
  );

  const start = useCallback(() => {
    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;
    looping.current = configRef.current.loopDefault;
    finishReview.current = null;
    playRun(controller.signal).catch((cause: unknown) => {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      console.error(cause);
    });
  }, [playRun]);

  const stop = useCallback(() => {
    abortController.current?.abort();
    abortController.current = null;
    looping.current = false;
    agentTravel.current?.();
    setSelection(null);
    setDoc((current) =>
      current.map((block) => ({
        ...block,
        fading: false,
        shown: block.chunks ? block.chunks.length : block.shown,
        fix: block.fix?.applied ? block.fix : undefined,
      })),
    );
    setEditCount(appliedCount.current);
    setPhase(appliedCount.current > 0 ? "review" : "stopped");
    void goHome();
  }, [goHome]);

  useEffect(() => {
    const frame = autoPlay ? requestAnimationFrame(start) : 0;
    return () => {
      cancelAnimationFrame(frame);
      abortController.current?.abort();
    };
  }, [autoPlay, start]);

  const signature = blocks.map((block) => `${block.id}\u0000${block.type}\u0000${block.text}`).join("\u0001");
  const lastSignature = useRef(signature);

  useEffect(() => {
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    if (phaseRef.current === "thinking" || phaseRef.current === "editing" || phaseRef.current === "review") return;
    setDoc(toRunBlocks(configRef.current.blocks));
  }, [signature]);

  // Playback pauses off screen: every pending pause releases as soon as the card is back.
  useEffect(() => {
    const card = root.current;
    if (!card || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          waiting.current.forEach((resolve) => resolve());
          waiting.current.clear();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(card);
    return () => {
      observer.disconnect();
      window.clearTimeout(revealTimer.current);
    };
  }, []);

  // Resting cursors re-anchor from live geometry, and a resize re-measures them.
  useLayoutEffect(() => {
    const card = root.current;
    if (!card) return;
    const measure = () => {
      const home = homeAnchor();
      const read = readAnchor();
      if (home && following.current && !agentTravel.current) {
        agentX.set(home.x);
        agentY.set(home.y);
        setFlip((current) => ({ ...current, agent: home.x > card.clientWidth - TAG_FLIP_GUTTER }));
      }
      if (read && !parkHuman.current) {
        humanTravel.current?.();
        humanX.set(read.x);
        humanY.set(read.y);
        setFlip((current) => ({ ...current, human: read.x > card.clientWidth - TAG_FLIP_GUTTER }));
      }
      setSelection(null);
    };
    measure();
    setReady(true);
    // Web fonts land after the first layout, which changes line breaks: re-place the resting cursors.
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) measure();
    });
    let width = card.clientWidth;
    const observer = new ResizeObserver(() => {
      if (Math.abs(card.clientWidth - width) > 1) {
        width = card.clientWidth;
        measure();
      }
    });
    observer.observe(card);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [agentX, agentY, homeAnchor, humanX, humanY, readAnchor]);

  // An idle collaborator drifts around the paragraph it is reading.
  useEffect(() => {
    if (!collaborator || reduced) return;
    let timer = 0;
    const drift = () => {
      timer = window.setTimeout(() => {
        const anchor = readAnchor();
        if (anchor && onScreen.current && !parkHuman.current) {
          void moveTo(
            "human",
            { x: anchor.x + (Math.random() - 0.5) * 40, y: anchor.y + (Math.random() - 0.5) * 10 },
            { ms: 720 },
          );
        }
        drift();
      }, 1700 + 900 * Math.random());
    };
    drift();
    return () => window.clearTimeout(timer);
  }, [collaborator, reduced, moveTo, readAnchor]);

  const working = phase === "thinking" || phase === "editing";
  const statusText = statusLabel(phase, agent.name, label, editCount, error);
  const countLabel = `${editCount} ${editCount === 1 ? "edit" : "edits"}`;
  const simulatedNote =
    (simulated ?? isSample) && (phase === "review" || phase === "accepted" || phase === "reverted" || phase === "error")
      ? " Simulated, nothing was saved."
      : "";

  const statusIcon =
    phase === "accepted" ? (
      <Check className={styles.success} />
    ) : phase === "reverted" ? (
      <Undo2 />
    ) : phase === "stopped" ? (
      <Square />
    ) : phase === "empty" ? (
      <Check />
    ) : phase === "error" ? (
      <CircleAlert className={styles.danger} />
    ) : phase === "review" ? (
      <Pencil />
    ) : null;

  const action =
    working
      ? { label: "Stop", icon: <Square />, onClick: stop }
      : phase === "error"
        ? { label: "Retry", icon: <RotateCcw />, onClick: start }
        : phase === "idle"
          ? { label: `Ask ${agent.name}`, icon: <Sparkles />, onClick: start }
          : phase === "review"
            ? null
            : { label: "Run again", icon: <RotateCcw />, onClick: start };

  const mark = agent.mark ?? <DefaultAgentMark aria-hidden="true" />;

  return (
    <div
      ref={root}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={{ "--agent": agentColor, "--human": collaborator?.color ?? "var(--series-2)" } as React.CSSProperties}
      onPointerEnter={() => {
        engagement.current.hover = true;
      }}
      onPointerLeave={() => {
        engagement.current.hover = false;
      }}
      onFocus={() => {
        engagement.current.focus = true;
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) engagement.current.focus = false;
      }}
    >
      <div className={styles.header}>
        <div className={styles.stack}>
          <span
            ref={agentAvatar}
            className={styles.agentAvatar}
            data-working={working}
            role="img"
            aria-label={agent.name}
          >
            {mark}
          </span>
          {collaborator ? <Avatar className={styles.stackAvatar} name={collaborator.name} src={collaborator.avatar} size="sm" /> : null}
        </div>
        <div className={styles.status} aria-hidden="true">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={`${phase}:${statusText}`}
              className={styles.statusInner}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.16 * Number(!reduced), ease: EASE_STATUS } }}
              exit={{ opacity: 0, transition: { duration: 0.1 * Number(!reduced) } }}
            >
              {statusIcon ? <span className={styles.statusIcon}>{statusIcon}</span> : null}
              <span className={styles.statusLabel}>
                {working ? <TextShimmer>{statusText}</TextShimmer> : statusText}
              </span>
            </motion.span>
          </AnimatePresence>
        </div>
        <span className={styles.srOnly} role="status" aria-live="polite">
          {`${statusText}.${simulatedNote}`}
        </span>
        <div className={styles.action}>
          <AnimatePresence initial={false}>
            {action ? (
              <motion.span
                key="action"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 * Number(!reduced) }}
              >
                <Button variant="ghost" size="sm" onClick={action.onClick}>
                  <span className={styles.buttonInner}>
                    {action.icon}
                    {action.label}
                  </span>
                </Button>
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <div className={styles.selectionLayer} aria-hidden="true">
        <AnimatePresence>
          {selection ? (
            <motion.div
              key={selection.key}
              exit={{ opacity: 0, transition: { duration: 0.12 * Number(!reduced) } }}
            >
              {selection.boxes.map((box, index) => {
                const step = selection.ms / selection.boxes.length / 1000;
                return (
                  <motion.span
                    key={index}
                    className={styles.selection}
                    style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
                    initial={{ scaleX: Number(!!reduced) }}
                    animate={{ scaleX: 1 }}
                    transition={{
                      duration: reduced ? 0 : step,
                      delay: reduced ? 0 : index * step,
                      ease: "linear",
                    }}
                  />
                );
              })}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <article
        className={styles.doc}
        data-fading={docFading}
        aria-label={doc[0]?.text ?? "Document"}
        aria-busy={working}
      >
        <AnimatePresence initial={false}>
          {doc.map((block, index) => (
            <motion.div
              key={block.id}
              className={styles.block}
              data-type={block.type}
              exit={{
                height: 0,
                opacity: 0,
                transition:
                  resetting || reduced
                    ? { duration: 0 }
                    : { opacity: { duration: 0.1 }, height: motionTokens.spring.snappy },
              }}
            >
              <FitBlock enter={block.inserted} instant={resetting || reduced}>
                <div className={styles.pad}>
                  <BlockText
                    block={block}
                    reduced={reduced}
                    textRef={(node) => {
                      if (node) textNodes.current.set(block.id, node);
                      else textNodes.current.delete(block.id);
                    }}
                    fixRef={(node) => {
                      if (node) fixNodes.current.set(block.id, node);
                      else fixNodes.current.delete(block.id);
                    }}
                  />
                </div>
                {index === 0 && metaLine ? <div className={styles.meta}>{metaLine}</div> : null}
              </FitBlock>
            </motion.div>
          ))}
        </AnimatePresence>
      </article>

      <div className={styles.barWrap}>
        <AnimatePresence>
          {phase === "review" ? (
            <motion.div
              className={styles.bar}
              role="group"
              aria-label="Review edits"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.2 * Number(!reduced), ease: EASE_STATUS }}
            >
              <span className={styles.barLabel}>
                <span className={styles.barMark}>{mark}</span>
                <span className={styles.barCount}>
                  {countLabel}
                  <span className={styles.barBy}> by {agent.name}</span>
                </span>
              </span>
              <Button variant="ghost" size="sm" onClick={undo}>
                <span className={styles.buttonInner}>
                  <Undo2 />
                  Undo
                </span>
              </Button>
              <Button ref={acceptButton} variant="primary" size="sm" onClick={accept}>
                <span className={styles.buttonInner}>
                  <Check />
                  Accept changes
                </span>
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className={styles.cursorLayer} aria-hidden="true">
        {collaborator ? (
          <Pointer
            x={humanX}
            y={humanY}
            color="var(--human)"
            flip={flip.human}
            ready={ready}
            pressed={pressedHuman}
            reduced={reduced}
          >
            {collaborator.avatar ? (
              <img className={styles.tagAvatar} src={collaborator.avatar} alt="" width={16} height={16} />
            ) : null}
            {collaboratorFirstName}
          </Pointer>
        ) : null}
        <Pointer
          x={agentX}
          y={agentY}
          color="var(--agent)"
          flip={flip.agent}
          ready={ready && !agentHidden}
          reduced={reduced}
          agent
        >
          <span className={styles.tagMark}>{mark}</span>
          {agent.name}
        </Pointer>
      </div>
    </div>
  );
}

/** The visible status line: every terminal state is a label, never only a color. */
function statusLabel(phase: AgentCursorPhase, agentName: string, label: string, count: number, error: string) {
  const edits = `${count} ${count === 1 ? "edit" : "edits"}`;
  switch (phase) {
    case "idle":
      return `${agentName} is in this doc`;
    case "thinking":
      return "Reading the doc";
    case "editing":
      return label;
    case "review":
      return `${edits} ready for review`;
    case "accepted":
      return `Accepted ${edits}`;
    case "reverted":
      return `Undid ${edits}`;
    case "stopped":
      return "Stopped before any edits";
    case "empty":
      return "No edits needed";
    case "error":
      return error;
  }
}

interface PointerProps {
  x: ReturnType<typeof useMotionValue<number>>;
  y: ReturnType<typeof useMotionValue<number>>;
  color: string;
  flip: boolean;
  ready: boolean;
  pressed?: boolean;
  reduced: boolean;
  agent?: boolean;
  children: ReactNode;
}

/** One labeled cursor: an arrow that presses and a tag that flips near the right edge. */
function Pointer({ x, y, color, flip, ready, pressed = false, reduced, agent = false, children }: PointerProps) {
  return (
    <motion.div
      className={styles.cursor}
      data-ready={ready}
      data-agent={agent}
      style={{ x, y, "--c": color } as unknown as MotionStyle}
    >
      <motion.svg
        className={styles.arrow}
        viewBox="0 0 20 20"
        animate={{ scale: pressed ? 0.84 : 1 }}
        transition={reduced ? { duration: 0 } : { duration: 0.12, ease: "easeOut" }}
      >
        <path d="M4.4 2.9 16.6 9.1c.8.4.7 1.5-.2 1.7l-5 1.2a1.1 1.1 0 0 0-.8.6l-2.2 4.7c-.4.8-1.6.7-1.8-.2L2.8 4.2c-.2-.9.8-1.7 1.6-1.3Z" />
      </motion.svg>
      <span className={styles.tag} data-flip={flip}>
        {children}
      </span>
    </motion.div>
  );
}

/** Wraps a block so its height follows measured content on a bounce-free spring. */
function FitBlock({ children, enter = false, instant = false }: { children: ReactNode; enter?: boolean; instant?: boolean }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const instantRef = useRef(instant);
  const settleSeq = useRef(0);

  useLayoutEffect(() => {
    instantRef.current = instant;
  });

  useLayoutEffect(() => {
    const shell = outer.current;
    const content = inner.current;
    if (!shell || !content || typeof ResizeObserver === "undefined") return;
    let animation: AnimationPlaybackControls | undefined;
    let measured: number | null = enter ? 0 : null;
    const sync = () => {
      const height = content.getBoundingClientRect().height;
      if (measured === null) {
        measured = height;
        return;
      }
      if (0.5 > Math.abs(height - measured)) return;
      const from = shell.getBoundingClientRect().height;
      measured = height;
      animation?.stop();
      if (instantRef.current) {
        shell.style.height = "auto";
        return;
      }
      const run = ++settleSeq.current;
      animation = animate(
        shell,
        { height: [from, height] },
        {
          ...motionTokens.spring.snappy,
          visualDuration: 0.24,
          onComplete: () => {
            if (run === settleSeq.current) shell.style.height = "auto";
          },
        },
      );
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(content);
    return () => {
      observer.disconnect();
      animation?.stop();
    };
  }, [enter]);

  return (
    <div ref={outer} className={styles.fit} style={enter ? { height: 0 } : undefined}>
      <div ref={inner}>{children}</div>
    </div>
  );
}

interface BlockTextProps {
  block: RunBlock;
  reduced: boolean;
  textRef: (node: HTMLElement | null) => void;
  fixRef: (node: HTMLElement | null) => void;
}

/** One block's text: streamed chunks with a caret, a typo underline that becomes a tint, or plain tinted text. */
function BlockText({ block, reduced, textRef, fixRef }: BlockTextProps) {
  const Tag = block.type === "title" ? "h3" : block.type === "heading" ? "h4" : "p";
  let children: ReactNode;

  if (block.chunks) {
    const shown = block.shown ?? block.chunks.length;
    const streaming = shown < block.chunks.length;
    children = block.chunks.map((chunk, index) => (
      <Fragment key={index}>
        {streaming && index === shown ? (
          <span className={styles.caretSlot}>
            <span className={styles.caret} />
          </span>
        ) : null}
        <span className={styles.chunk} data-shown={index < shown} data-pending={!!block.pending}>
          {chunk}
        </span>
      </Fragment>
    ));
  } else if (block.fix) {
    const { start, from, to, applied } = block.fix;
    const word = applied ? to : from;
    children = (
      <>
        {block.text.slice(0, start)}
        <span ref={fixRef} className={styles.swap}>
          <AnimatePresence initial={false}>
            <motion.span
              key={word}
              className={applied ? styles.tint : styles.typo}
              data-pending={applied && !!block.pending}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.16 * Number(!reduced), delay: 0.05 * Number(!reduced) } }}
              exit={{ opacity: 0, transition: { duration: 0.1 * Number(!reduced) } }}
            >
              {word}
            </motion.span>
          </AnimatePresence>
        </span>
        {block.text.slice(start + word.length)}
      </>
    );
  } else {
    children = (
      <motion.span
        key={block.fresh ?? 0}
        className={styles.tint}
        data-pending={!!block.pending}
        initial={(!!block.inserted || !!block.fresh) && { opacity: 0 }}
        animate={{
          opacity: 1,
          transition: { duration: 0.16 * Number(!reduced), delay: block.inserted && !reduced ? 0.1 : 0 },
        }}
      >
        {block.text}
      </motion.span>
    );
  }

  return (
    <Tag
      ref={textRef as (node: HTMLHeadingElement | HTMLParagraphElement | null) => void}
      className={styles[block.type]}
      data-fading={!!block.fading}
    >
      {children}
    </Tag>
  );
}

export default AgentCursor;
