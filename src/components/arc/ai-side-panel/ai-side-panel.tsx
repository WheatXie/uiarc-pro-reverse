"use client";

import { memo, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode, SVGProps } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { ArrowUp, Check, CircleAlert, FileText, PanelRightClose, PenLine, RotateCcw, Square, SquareDashedText, X } from "lucide-react";
import { Button } from "../button/button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { Tooltip } from "../tooltip/tooltip";
import styles from "./ai-side-panel.module.css";

/* ---------------------------------------------------------------------------
 * Document model
 * ------------------------------------------------------------------------- */

/** A section heading inside the page. It never carries a diff label: its own text is the label. */
export interface HeadingBlock {
  id: string;
  kind: "heading";
  text: string;
}

/** A paragraph of prose, addressed by its short label ("Intro", "Pricing"). */
export interface ParagraphBlock {
  id: string;
  kind: "paragraph";
  label: string;
  text: string;
}

/** A data table. The first column reads as a row header, every column after the second is numeric. */
export interface TableBlock {
  id: string;
  kind: "table";
  label: string;
  columns: string[];
  rows: string[][];
}

export type PageBlock = HeadingBlock | ParagraphBlock | TableBlock;

/** The page the assistant reads, quotes from and edits. */
export interface Page {
  title: string;
  /** Small line under the title, such as "Product spec · Maya Chen · Edited Oct 18". */
  meta?: string;
  blocks: PageBlock[];
}

/** Text the reader selected in the page, attached to the next message as context. */
export interface Selection {
  /** Block the selection started in, or "title". */
  blockId: string;
  /** Readable name of that block, used in the chip and in the composer placeholder. */
  label: string;
  text: string;
}

/** A proposed edit to one block of the page. Nothing is written until the reader applies it. */
export interface ProposedChange {
  blockId: string;
  after: PageBlock;
}

/** A proposal plus the block it replaces, which is what an undo restores. */
export interface AppliedChange extends ProposedChange {
  before: PageBlock;
}

/** What the assistant is told about one message. */
export interface RespondInput {
  prompt: string;
  page: Page;
  selection?: Selection;
  signal: AbortSignal;
}

/**
 * The answer. `text` streams when it is an async iterable, and lands at once when it is a string.
 * `change` turns the turn into an editable diff card under the answer.
 */
export interface RespondResult {
  text: string | AsyncIterable<string>;
  change?: ProposedChange;
}

/** Simulated answer source. Swap it for a real model call; the panel only needs this shape. */
export type Respond = (input: RespondInput) => Promise<RespondResult>;

/** Props for the assistant side panel block. */
export interface AiSidePanelProps {
  /** The document the assistant reads. Defaults to the Team workspaces spec. */
  page?: Page;
  /**
   * Answer source. Omit it to run the built-in simulated script, which also makes the empty state
   * say that answers are simulated.
   */
  respond?: Respond;
  /** Called after a proposal is written to the page, with the applied change and the new page. */
  onApply?: (change: AppliedChange, nextPage: Page) => void;
  /** Called after an apply is reverted, with the reverted change and the restored page. */
  onUndo?: (change: AppliedChange, nextPage: Page) => void;
  /** Panel starts open. Defaults to true. */
  defaultOpen?: boolean;
  /** Chips offered in the empty state and after every answer. Defaults to three page-specific prompts. */
  suggestions?: string[];
  /** Names and glyph of the assistant. Every field falls back to the shipped values. */
  assistant?: { name?: string; model?: string; mark?: ReactNode };
  /** Extra class names for the root, for framing the block in a page. */
  className?: string;
}

/* ---------------------------------------------------------------------------
 * Default page and the simulated answer script
 * ------------------------------------------------------------------------- */

const defaultPage: Page = {
  title: "Team workspaces",
  meta: "Product spec · Maya Chen · Edited Oct 18",
  blocks: [
    {
      id: "intro",
      kind: "paragraph",
      label: "Intro",
      text: "Team workspaces are a new feature that will make it possible for people who work together to share their projects, files and billing in one single place, so that they no longer need to forward invoices around or invite each other to every project one at a time.",
    },
    { id: "goals-heading", kind: "heading", text: "Goals" },
    {
      id: "goals",
      kind: "paragraph",
      label: "Goals",
      text: "Cut the time it takes to invite a team from six minutes to under one. Move 30% of paid solo accounts to a team plan by the end of March 2027.",
    },
    { id: "pricing-heading", kind: "heading", text: "Pricing" },
    {
      id: "pricing",
      kind: "paragraph",
      label: "Pricing",
      text: "Per seat, billed monthly. Admins add or remove seats at any time and changes are prorated on the next invoice.",
    },
    {
      id: "pricing-table",
      kind: "table",
      label: "Pricing table",
      columns: ["Plan", "Seats", "Monthly"],
      rows: [
        ["Starter", "Up to 5", "$12"],
        ["Team", "Up to 50", "$24"],
        ["Business", "Unlimited", "$36"],
      ],
    },
  ],
};

const defaultSuggestions = ["Summarize this page", "Tighten the intro", "Add an annual price column"];

const tightenedIntro =
  "Team workspaces let people share projects, files and billing in one place, without forwarding invoices or inviting each other project by project.";

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const blockLabel = (block: PageBlock) => (block.kind === "heading" ? block.text : block.label);
const findBlock = (page: Page, id: string) => page.blocks.find(block => block.id === id);
const parseMoney = (value: string) => Number(value.replace(/[^0-9.]/g, ""));
const formatMoney = (value: number) => `$${Number.isInteger(value) ? value : value.toFixed(2)}`;

/** Waits, then answers from a small script: summary, tightened intro, annual column, or a note about the selection. */
function createSimulatedRespond(): Respond {
  let failed = false;
  return async ({ prompt, page, selection, signal }) => {
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
      const timer = window.setTimeout(resolve, 650);
      signal.addEventListener("abort", () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    });

    const said = prompt.toLowerCase();
    const table = page.blocks.find((block): block is TableBlock => block.kind === "table");
    const moneyColumn = table ? table.columns.indexOf("Monthly") : -1;
    const prices = table && moneyColumn >= 0 ? table.rows.map(row => parseMoney(row[moneyColumn])) : [];

    if (/summar|tl;?dr|overview/.test(said)) {
      const pricing = prices.length
        ? ` Pricing is per seat, from ${formatMoney(Math.min(...prices))} on ${table?.rows[0][0]} to ${formatMoney(Math.max(...prices))} on ${table?.rows[table.rows.length - 1][0]}${table?.columns.includes("Annual") ? ", with two months free when billed annually" : ", billed monthly"}.`
        : "";
      return {
        text: `Team workspaces let people share projects, files and billing in one place.

The spec sets two goals: invite a team in under a minute, and move 30% of paid solo accounts to a team plan by March 2027.${pricing}`,
      };
    }

    if (/tighten|shorten|shorter|intro/.test(said)) {
      const intro = findBlock(page, "intro");
      if (!intro || intro.kind !== "paragraph") return { text: "This page has no intro to tighten." };
      if (intro.text === tightenedIntro) {
        return { text: "The intro is already tight at 22 words. Each clause carries one idea, so I would leave it as it is." };
      }
      return {
        text: `Here is a tighter intro. It keeps what teams share and the two chores it removes, and goes from ${wordCount(intro.text)} words to ${wordCount(tightenedIntro)}.`,
        change: { blockId: "intro", after: { ...intro, text: tightenedIntro } },
      };
    }

    if (/annual|yearly|year/.test(said)) {
      if (!table || moneyColumn < 0) return { text: "I could not find a pricing table with a monthly column on this page." };
      if (table.columns.includes("Annual")) return { text: "The pricing table already has an annual column." };
      const annual = prices.map(price => formatMoney(Math.round((10 * price) / 12 * 100) / 100));
      const last = annual.length - 1;
      return {
        text: `I added an annual column at two months free, shown per seat per month. ${table.rows[table.rows.length - 1][0]} comes to ${annual[last]}, or ${formatMoney(12 * parseMoney(annual[last]))} a seat each year.`,
        change: {
          blockId: table.id,
          after: {
            ...table,
            columns: [...table.columns, "Annual"],
            rows: table.rows.map((row, index) => [...row, annual[index]]),
          },
        },
      };
    }

    if (selection) {
      const quote = selection.text.length > 60 ? `${selection.text.slice(0, 57).trimEnd()}...` : selection.text;
      if (table && selection.blockId === table.id) {
        return {
          text: `The pricing table lists ${table.rows.length} per seat plans, from ${formatMoney(Math.min(...prices))} to ${formatMoney(Math.max(...prices))} a month. ${table.rows[table.rows.length - 1][0]} is the only plan without a seat cap, so the step up from ${table.rows[1]?.[0] ?? "Team"} is mostly about team size.`,
        };
      }
      if (selection.blockId === "goals") {
        return {
          text: "Both goals are measurable: invite time drops from six minutes to under one, and 30% of paid solo accounts move to a team plan by March 2027. Neither names an owner yet, which is worth adding before review.",
        };
      }
      return {
        text: `"${quote}" is from the ${selection.label.toLowerCase()}. I can tighten it, explain it or turn it into a list. Ask for one of those and I will propose the edit.`,
      };
    }

    if (!failed) {
      failed = true;
      throw new Error("Simulated network error");
    }
    return {
      text: "I can summarize this page, tighten the intro or add an annual price column. Select any text in the page to ask about that part.",
    };
  };
}

/* ---------------------------------------------------------------------------
 * Motion constants
 * ------------------------------------------------------------------------- */

const ease = [0.22, 1, 0.36, 1] as const;
const boxSpring = { type: "spring", visualDuration: 0.3, bounce: 0 } as const;
const sheetSpring = { type: "spring", visualDuration: 0.34, bounce: 0 } as const;
const fadeIn = { duration: 0.16, ease } as const;
const fadeOut = { opacity: 0, transition: { duration: 0.1 } } as const;
const instant = { duration: 0 };

/* ---------------------------------------------------------------------------
 * Claude mark
 * ------------------------------------------------------------------------- */

const markPath = "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z";

/** The Claude asterisk shipped in the header, the empty state's selection bubble and the reopen button. */
function ClaudeMark({ title = "Claude", ...rest }: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...rest}>
      <path d={markPath} />
    </svg>
  );
}

/* ---------------------------------------------------------------------------
 * Block body, height animation, diffing
 * ------------------------------------------------------------------------- */

/** Measure-then-animate wrapper: a replaced block springs from its old height to its new one. */
function BlockBox({ contentKey, reduced, children }: { contentKey: string; reduced: boolean; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const measured = useRef(0);
  const lastKey = useRef(contentKey);
  const running = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    const node = inner.current;
    if (!node) return;
    measured.current = node.offsetHeight;
    const observer = new ResizeObserver(() => { measured.current = node.offsetHeight; });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (lastKey.current === contentKey) return;
    lastKey.current = contentKey;
    const outer = box.current;
    const node = inner.current;
    if (!outer || !node) return;
    const padding = 2 * parseFloat(getComputedStyle(outer).paddingTop);
    const from = running.current ? outer.getBoundingClientRect().height : measured.current + padding;
    running.current?.stop();
    const to = node.offsetHeight + padding;
    if (reduced || !from || Math.abs(from - to) < 1) {
      outer.style.height = "";
      running.current = null;
      return;
    }
    const controls = animate(outer, { height: [`${from}px`, `${to}px`] }, boxSpring);
    running.current = controls;
    void controls.then(() => {
      if (running.current !== controls) return;
      outer.style.height = "";
      running.current = null;
    });
  }, [contentKey, reduced]);

  return (
    <div ref={box} className={styles.blockBox}>
      <div ref={inner} className={styles.blockInner}>{children}</div>
    </div>
  );
}

/** One block as it reads in the doc: heading, paragraph or table. */
function BlockContent({ block }: { block: PageBlock }) {
  if (block.kind === "heading") return <h2 className={styles.docHeading}>{block.text}</h2>;
  if (block.kind === "paragraph") return <p className={styles.docText}>{block.text}</p>;
  return (
    <table className={styles.docTable} aria-label={block.label}>
      <thead>
        <tr>
          {block.columns.map((column, index) => (
            <th key={column} scope="col" data-numeric={(index > 1) || undefined}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {block.rows.map(row => (
          <tr key={row[0]}>
            {row.map((cell, index) => (
              index === 0
                ? <th key={index} scope="row">{cell}</th>
                : <td key={index} data-numeric={(index > 1) || undefined}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** One block slot in the doc: the sweep ring while it was just written, plus a soft swap when it changes. */
function Block({ block, flash, inContext, reduced }: { block: PageBlock; flash: number; inContext: boolean; reduced: boolean }) {
  const key = JSON.stringify(block);
  return (
    <div className={styles.block} data-block={block.id} data-kind={block.kind} data-context={inContext || undefined}>
      <BlockBox contentKey={key} reduced={reduced}>
        {flash ? <span className={styles.sweep} aria-hidden="true">{flash}</span> : null}
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={key}
            className={styles.blockBody}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.18 * Number(!reduced), delay: 0.08 * Number(!reduced), ease } }}
            exit={{ opacity: 0, transition: { duration: 0.1 * Number(!reduced) } }}
          >
            <BlockContent block={block} />
          </motion.div>
        </AnimatePresence>
      </BlockBox>
    </div>
  );
}

type DiffPart = { type: "same" | "ins" | "del"; text: string };

/** Word level LCS. Short words that only moved sit between a delete and an insert, so they re-pair instead of reading as noise. */
function wordDiff(before: string, after: string): DiffPart[] {
  const a = before.split(/\s+/).filter(Boolean);
  const b = after.split(/\s+/).filter(Boolean);
  const rows = a.length;
  const cols = b.length;
  const lcs: number[][] = Array.from({ length: rows + 1 }, () => Array<number>(cols + 1).fill(0));
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = cols - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const steps: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < rows || j < cols) {
    if (i < rows && j < cols && a[i] === b[j]) {
      steps.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (j < cols && (i >= rows || lcs[i][j + 1] >= lcs[i + 1][j])) {
      steps.push({ type: "ins", text: b[j] });
      j++;
    } else {
      steps.push({ type: "del", text: a[i] });
      i++;
    }
  }
  const paired: DiffPart[] = [];
  steps.forEach((step, index) => {
    const previous = steps[index - 1];
    const next = steps[index + 1];
    if (step.type === "same" && step.text.length <= 3 && previous && next && previous.type !== "same" && next.type !== "same") {
      paired.push({ type: "del", text: step.text }, { type: "ins", text: step.text });
    } else {
      paired.push(step);
    }
  });
  const grouped: DiffPart[] = [];
  let removed: string[] = [];
  let added: string[] = [];
  const flush = () => {
    if (removed.length) grouped.push({ type: "del", text: removed.join(" ") });
    if (added.length) grouped.push({ type: "ins", text: added.join(" ") });
    removed = [];
    added = [];
  };
  for (const step of paired) {
    if (step.type === "del") removed.push(step.text);
    else if (step.type === "ins") added.push(step.text);
    else {
      flush();
      const last = grouped[grouped.length - 1];
      if (last?.type === "same") last.text += ` ${step.text}`;
      else grouped.push({ ...step });
    }
  }
  flush();
  return grouped;
}

/** The proposal body: a cell by cell table diff, or a word diff for prose. */
function ChangeDiff({ base, after }: { base: PageBlock; after: PageBlock }) {
  if (base.kind === "table" && after.kind === "table") {
    return (
      <table className={styles.diffTable}>
        <thead>
          <tr>
            {after.columns.map(column => (
              <th key={column} scope="col">{base.columns.includes(column) ? column : <ins>{column}</ins>}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {after.rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => {
                const column = after.columns[cellIndex];
                const previous = base.columns.includes(column) ? base.rows[index]?.[base.columns.indexOf(column)] : undefined;
                return (
                  <td key={cellIndex}>
                    {previous === undefined ? <ins>{cell}</ins> : previous === cell ? cell : <><del>{previous}</del>{" "}<ins>{cell}</ins></>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  const parts = wordDiff(base.kind === "table" ? "" : base.text, after.kind === "table" ? "" : after.text);
  return (
    <p className={styles.diffText}>
      {parts.map((part, index) => (
        <span key={index}>
          {index ? " " : ""}
          {part.type === "del" ? <del>{part.text}</del> : part.type === "ins" ? <ins>{part.text}</ins> : part.text}
        </span>
      ))}
    </p>
  );
}

/** "Adds Annual column", "34 words, was 46" — the size of the change, right of its label. */
function changeMeta(base: PageBlock, after: PageBlock) {
  if (base.kind === "table" && after.kind === "table") {
    const added = after.columns.filter(column => !base.columns.includes(column));
    return added.length ? `Adds ${added.join(", ")} column` : "Edits cells";
  }
  if (base.kind !== "table" && after.kind !== "table") return `${wordCount(after.text)} words, was ${wordCount(base.text)}`;
  return "Replaces block";
}

/* ---------------------------------------------------------------------------
 * Streaming answer text
 * ------------------------------------------------------------------------- */

/** Walks to the next word boundary so a frame never splits a word, unless the stream is final and the tail has no space. */
function advanceToBoundary(text: string, start: number, count: number, final: boolean) {
  let next = Math.min(text.length, start + count);
  while (next < text.length && !/\s/.test(text[next])) next++;
  if (next < text.length || final) return next;
  const back = text.slice(start).search(/\s\S*$/);
  return back > 0 ? start + back : start;
}

/**
 * Streams the answer in word sized spans, so each new slice can fade in without re-rendering the text
 * that already landed. `frozen` stops the walk where it is when the reader stops the answer.
 */
const AnswerText = memo(function AnswerText({ text, final, frozen = false, onDone }: { text: string; final: boolean; frozen?: boolean; onDone?: () => void }) {
  const [offsets, setOffsets] = useState<number[]>([]);
  const consumed = useRef(0);
  const live = useRef({ text, final, onDone });

  useEffect(() => { live.current = { text, final, onDone }; }, [text, final, onDone]);

  useEffect(() => {
    if (frozen) return;
    let frame = 0;
    let last = 0;
    let budget = 0;
    let called = false;
    const step = (now: number) => {
      const state = live.current;
      if (!last) last = now;
      if (now - last >= 34) {
        const delta = Math.min(100, now - last);
        last = now;
        const remaining = state.text.length - consumed.current;
        if (remaining > 0) {
          budget += Math.max(560, remaining / 1.1) * delta / 1000;
          const next = advanceToBoundary(state.text, consumed.current, Math.max(1, Math.round(budget)), state.final);
          if (next > consumed.current) {
            budget = Math.max(0, budget - (next - consumed.current));
            consumed.current = next;
            setOffsets(previous => [...previous, next]);
          }
        }
      }
      if (state.final && consumed.current >= state.text.length) {
        if (!called) {
          called = true;
          state.onDone?.();
        }
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [frozen]);

  return (
    <>
      {offsets.map((offset, index) => (
        <span key={index ? offsets[index - 1] : 0} className={styles.chunk}>{text.slice(index ? offsets[index - 1] : 0, offset)}</span>
      ))}
    </>
  );
});

/* ---------------------------------------------------------------------------
 * Turn types
 * ------------------------------------------------------------------------- */

type TurnStatus = "thinking" | "streaming" | "done" | "stopped" | "error";
type ChangeState = "proposed" | "applied" | "discarded" | "undone";

interface Turn {
  id: string;
  prompt: string;
  selection?: Selection;
  attempt: number;
  status: TurnStatus;
  text: string;
  final: boolean;
  error?: string;
  change?: ProposedChange;
  base?: PageBlock;
  changeState?: ChangeState;
}

interface UndoState {
  turnId: string;
  change: AppliedChange;
  label: string;
}

/** The proposal card under an answer: label, diff, and the apply, discard or applied footer. */
function ChangeCard({ turn, onApply, onDiscard, applyRef }: { turn: Turn; onApply: () => void; onDiscard: () => void; applyRef: (node: HTMLButtonElement | null) => void }) {
  const { base, change, changeState = "proposed" } = turn;
  if (!base || !change) return null;
  return (
    <div className={styles.change} data-state={changeState}>
      <div className={styles.changeHead}>
        <PenLine size={14} aria-hidden="true" />
        <span className={styles.changeLabel}>{blockLabel(base)}</span>
        <span className={styles.changeMeta}>{changeMeta(base, change.after)}</span>
      </div>
      <div className={styles.changeBody}>
        <ChangeDiff base={base} after={change.after} />
      </div>
      <div className={styles.changeFoot}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={changeState}
            className={styles.changeFootInner}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: fadeIn }}
            exit={fadeOut}
          >
            {changeState === "applied" ? (
              <span className={styles.footStatus} data-tone="success"><Check size={14} aria-hidden="true" /> Applied to the page</span>
            ) : null}
            {changeState === "discarded" ? (
              <span className={styles.footStatus}><X size={14} aria-hidden="true" /> Discarded</span>
            ) : null}
            {changeState === "undone" ? (
              <span className={styles.footStatus}><RotateCcw size={13} aria-hidden="true" /> Undone</span>
            ) : null}
            {changeState === "proposed" || changeState === "undone" ? (
              <span className={styles.footActions}>
                {changeState === "proposed" ? (
                  <Button type="button" variant="ghost" size="sm" className={styles.footButton} onClick={onDiscard}>Discard</Button>
                ) : null}
                <Button ref={applyRef} type="button" size="sm" className={`${styles.footButton} ${styles.applyButton}`} onClick={onApply}>Apply</Button>
              </span>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Doc: the page the assistant reads, plus select-to-ask
 * ------------------------------------------------------------------------- */

function Doc({ page, flash, contextBlockId, reduced, onAskSelection }: {
  page: Page;
  flash: { blockId: string; n: number } | null;
  contextBlockId?: string;
  reduced: boolean;
  onAskSelection: (selection: Selection) => void;
}) {
  const article = useRef<HTMLElement>(null);
  const [ask, setAsk] = useState<{ selection: Selection; x: number; y: number; n: number } | null>(null);

  const measure = useCallback(() => {
    const root = article.current;
    const selection = window.getSelection();
    if (!root || !selection || !selection.rangeCount || selection.isCollapsed) {
      setAsk(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) {
      setAsk(null);
      return;
    }
    const text = selection.toString().replace(/\s+/g, " ").trim();
    if (text.length < 2) {
      setAsk(null);
      return;
    }
    const start = range.startContainer.nodeType === 1 ? range.startContainer as Element : range.startContainer.parentElement;
    const id = start?.closest("[data-block]")?.getAttribute("data-block");
    const block = page.blocks.find(item => item.id === id);
    const label = block ? blockLabel(block) : "Title";
    const rects = range.getClientRects();
    const rect = rects[rects.length - 1] ?? range.getBoundingClientRect();
    const bounds = root.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.right - bounds.left - 24, bounds.width - 168));
    setAsk(previous => ({
      selection: { blockId: block?.id ?? "title", label, text: text.slice(0, 400) },
      x,
      y: rect.bottom - bounds.top + 8,
      n: (previous?.n ?? 0) + 1,
    }));
  }, [page]);

  useEffect(() => {
    const clear = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) setAsk(null);
    };
    document.addEventListener("selectionchange", clear);
    return () => document.removeEventListener("selectionchange", clear);
  }, []);

  return (
    <article ref={article} className={styles.doc} onPointerUp={() => requestAnimationFrame(measure)} onKeyUp={event => { if (event.shiftKey) measure(); }}>
      <header className={styles.docHead}>
        <h1 className={styles.docTitle}>{page.title}</h1>
        {page.meta ? <p className={styles.docMeta}>{page.meta}</p> : null}
      </header>
      {page.blocks.map(block => (
        <Block key={block.id} block={block} flash={flash?.blockId === block.id ? flash.n : 0} inContext={contextBlockId === block.id} reduced={reduced} />
      ))}
      <AnimatePresence>
        {ask ? (
          <motion.button
            key={ask.n}
            type="button"
            className={styles.askSelection}
            style={{ left: ask.x, top: ask.y }}
            initial={{ opacity: 0, y: 3 * Number(!reduced) }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.15, ease } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            onPointerDown={event => event.preventDefault()}
            onClick={() => {
              onAskSelection(ask.selection);
              window.getSelection()?.removeAllRanges();
              setAsk(null);
            }}
          >
            <ClaudeMark className={styles.mark} aria-hidden="true" title="" /> Ask about selection
          </motion.button>
        ) : null}
      </AnimatePresence>
    </article>
  );
}

/* ---------------------------------------------------------------------------
 * The panel
 * ------------------------------------------------------------------------- */

const subscribeHydration = () => () => {};

/**
 * A document editor's assistant rail: the page on the left, a chat panel on the right that reads it,
 * quotes selections and proposes edits as diffs. Nothing is written until the reader applies a change,
 * and every apply leaves an undo pill above the composer. Below 640px the rail becomes a sheet.
 */
export function AiSidePanel({
  page = defaultPage,
  respond,
  onApply,
  onUndo,
  defaultOpen = true,
  suggestions = defaultSuggestions,
  assistant,
  className,
}: AiSidePanelProps) {
  const panelId = useId();
  const mounted = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const prefersReduced = useReducedMotion();
  const reduced = !!(mounted && prefersReduced);

  const name = assistant?.name ?? "Assistant";
  const model = assistant?.model ?? "Claude Sonnet 5.5";
  const mark = assistant?.mark ?? <ClaudeMark className={styles.mark} aria-hidden="true" title="" />;

  const [simulated] = useState(createSimulatedRespond);
  const answer = respond ?? simulated;

  const [synced, setSynced] = useState(page);
  const [doc, setDoc] = useState(page);
  if (page !== synced) {
    setSynced(page);
    setDoc(page);
  }

  const root = useRef<HTMLDivElement>(null);
  const pageScroll = useRef<HTMLDivElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const threadInner = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const reopenButton = useRef<HTMLButtonElement>(null);
  const undoButton = useRef<HTMLButtonElement>(null);
  const applyRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const controller = useRef<AbortController | null>(null);
  const turns = useRef(0);
  const stick = useRef(true);

  const [open, setOpen] = useState(defaultOpen);
  const [narrow, setNarrow] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [log, setLog] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [flash, setFlash] = useState<{ blockId: string; n: number } | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [status, setStatus] = useState("");

  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const measure = () => {
      setNarrow(node.clientWidth < 640);
      setHasMounted(true);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 1600);
    return () => window.clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    const scroller = thread.current;
    const inner = threadInner.current;
    if (!scroller || !inner) return;
    const observer = new ResizeObserver(() => {
      if (!stick.current) return;
      const bottom = scroller.scrollHeight - scroller.clientHeight;
      const gap = bottom - scroller.scrollTop;
      if (gap <= 0) return;
      if (gap > 48 && !reduced) scroller.scrollTo({ top: bottom, behavior: "smooth" });
      else scroller.scrollTop = bottom;
    });
    observer.observe(inner);
    return () => observer.disconnect();
  }, [reduced]);

  const patch = useCallback((id: string, next: (turn: Turn) => Turn) => {
    setLog(current => current.map(turn => (turn.id === id ? next(turn) : turn)));
  }, []);

  const busy = log.some(turn => turn.status === "thinking" || turn.status === "streaming");

  const run = useCallback(async (id: string, prompt: string, context: Selection | undefined, target: Page) => {
    controller.current?.abort();
    const own = new AbortController();
    controller.current = own;
    setStatus(`${model} is reading the page`);
    try {
      const result = await answer({ prompt, page: target, selection: context, signal: own.signal });
      if (own.signal.aborted) return;
      const base = result.change ? findBlock(target, result.change.blockId) : undefined;
      const change = base ? result.change : undefined;
      if (typeof result.text === "string") {
        const text = result.text;
        patch(id, turn => ({ ...turn, status: "streaming", text, final: true, change, base, changeState: change ? "proposed" : undefined }));
      } else {
        patch(id, turn => ({ ...turn, status: "streaming", change, base, changeState: change ? "proposed" : undefined }));
        for await (const chunk of result.text) {
          if (own.signal.aborted) return;
          patch(id, turn => ({ ...turn, text: turn.text + chunk }));
        }
        patch(id, turn => ({ ...turn, final: true }));
      }
    } catch (error) {
      if (own.signal.aborted) return;
      const message = error instanceof Error ? error.message : "Something went wrong";
      patch(id, turn => ({ ...turn, status: "error", error: message }));
      setStatus(`${model} did not respond. ${message}. Retry is available.`);
    }
  }, [model, patch, answer]);

  const send = (prompt: string) => {
    const text = prompt.trim();
    if (!text || busy) return;
    const id = `${panelId}-t${++turns.current}`;
    const context = selection ?? undefined;
    setLog(current => [...current, { id, prompt: text, selection: context, attempt: 0, status: "thinking", text: "", final: false }]);
    setDraft("");
    stick.current = true;
    void run(id, text, context, doc);
  };

  const finish = useCallback((turn: Turn) => {
    patch(turn.id, current => (current.status === "streaming" ? { ...current, status: "done" } : current));
    setStatus(turn.change && turn.base ? `Answer ready with a proposed change to ${blockLabel(turn.base)}` : "Answer ready");
  }, [patch]);

  const scrollToBlock = (blockId: string) => {
    requestAnimationFrame(() => {
      const scroller = pageScroll.current;
      const node = scroller?.querySelector(`[data-block="${blockId}"]`);
      if (!scroller || !node) return;
      const block = node.getBoundingClientRect();
      const view = scroller.getBoundingClientRect();
      const edge = narrow ? view.top + 0.3 * view.height : view.bottom;
      if (block.top < view.top + 12 || block.bottom > edge - 12) {
        scroller.scrollBy({ top: block.top - view.top - 24, behavior: reduced ? "auto" : "smooth" });
      }
    });
  };

  const setPanelOpen = (next: boolean) => {
    const wasInside = root.current?.querySelector("aside")?.contains(document.activeElement);
    setOpen(next);
    if (next) requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
    else if (wasInside) requestAnimationFrame(() => reopenButton.current?.focus({ preventScroll: true }));
  };

  const lastTurn = log[log.length - 1];
  const asked = new Set(log.map(turn => turn.prompt));
  const followUps = lastTurn && (lastTurn.status === "done" || lastTurn.status === "stopped") ? suggestions.filter(item => !asked.has(item)) : [];
  const panelTransition = hasMounted && !reduced ? sheetSpring : instant;
  const scopedPanelId = `${panelId}-panel`;

  const apply = (turn: Turn) => {
    if (!turn.change) return;
    const before = findBlock(doc, turn.change.blockId);
    if (!before) {
      setStatus("That part of the page no longer exists");
      return;
    }
    const change: AppliedChange = { ...turn.change, before };
    const nextPage: Page = { ...doc, blocks: doc.blocks.map(block => (block.id === change.blockId ? change.after : block)) };
    setDoc(nextPage);
    patch(turn.id, current => ({ ...current, changeState: "applied" }));
    setFlash(previous => ({ blockId: change.blockId, n: (previous?.n ?? 0) + 1 }));
    const label = `${blockLabel(before)} updated`;
    setUndo({ turnId: turn.id, change, label });
    setStatus(`Applied. ${label}. Undo is available.`);
    scrollToBlock(change.blockId);
    requestAnimationFrame(() => undoButton.current?.focus({ preventScroll: true }));
    onApply?.(change, nextPage);
  };

  const discard = (turn: Turn) => {
    patch(turn.id, current => ({ ...current, changeState: "discarded" }));
    setStatus("Change discarded");
    input.current?.focus({ preventScroll: true });
  };

  const revert = () => {
    if (!undo) return;
    const { change, turnId } = undo;
    const nextPage: Page = { ...doc, blocks: doc.blocks.map(block => (block.id === change.blockId ? change.before : block)) };
    setDoc(nextPage);
    patch(turnId, current => ({ ...current, changeState: "undone" }));
    setFlash(previous => ({ blockId: change.blockId, n: (previous?.n ?? 0) + 1 }));
    setUndo(null);
    setStatus(`Undone. ${blockLabel(change.before)} restored.`);
    scrollToBlock(change.blockId);
    requestAnimationFrame(() => applyRefs.current[turnId]?.focus({ preventScroll: true }));
    onUndo?.(change, nextPage);
  };

  const panel = (
    <aside
      id={scopedPanelId}
      className={styles.panel}
      aria-label={name}
      data-sheet={narrow || undefined}
      onKeyDown={event => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        setPanelOpen(false);
      }}
    >
      <header className={styles.head}>
        <div className={styles.titleRow}>
          <span className={styles.identity}>
            {mark}
            <span className={styles.name}>{name}</span>
            <span className={styles.model}>{model}</span>
          </span>
          <Tooltip content="Close">
            <button
              type="button"
              className={styles.iconButton}
              aria-label={`Close ${name.toLowerCase()}`}
              aria-controls={scopedPanelId}
              aria-expanded={open}
              onClick={() => setPanelOpen(false)}
            >
              {narrow ? <X size={16} aria-hidden="true" /> : <PanelRightClose size={16} aria-hidden="true" />}
            </button>
          </Tooltip>
        </div>
        <ul className={styles.chips} aria-label="Context">
          <li className={styles.chip}>
            <FileText size={13} aria-hidden="true" />
            <span>This page</span>
          </li>
          <AnimatePresence initial={false}>
            {selection ? (
              <motion.li
                key={`${selection.blockId}-${selection.text}`}
                className={styles.chip}
                data-selection=""
                title={selection.text}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: fadeIn }}
                exit={fadeOut}
              >
                <SquareDashedText size={13} aria-hidden="true" />
                <span className={styles.chipText}>Selection: {selection.label}</span>
                <button
                  type="button"
                  className={styles.chipRemove}
                  aria-label={`Remove selection from ${selection.label}`}
                  onClick={() => {
                    setSelection(null);
                    setStatus("Selection removed");
                    input.current?.focus({ preventScroll: true });
                  }}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </motion.li>
            ) : null}
          </AnimatePresence>
        </ul>
      </header>

      <div
        ref={thread}
        className={styles.thread}
        onWheel={event => { if (event.deltaY < 0) stick.current = false; }}
        onTouchMove={() => { stick.current = false; }}
        onScroll={event => {
          const node = event.currentTarget;
          if (node.scrollHeight - node.scrollTop - node.clientHeight < 24) stick.current = true;
        }}
      >
        <div ref={threadInner} className={styles.threadInner}>
          <AnimatePresence initial={false} mode="popLayout">
            {log.length ? (
              <motion.ol key="turns" className={styles.turns} aria-label="Conversation" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: fadeIn }}>
                {log.map(turn => (
                  <li key={turn.id} className={styles.turn}>
                    <motion.div
                      className={styles.ask}
                      initial={{ opacity: 0, y: 3 * Number(!reduced) }}
                      animate={{ opacity: 1, y: 0, transition: fadeIn }}
                    >
                      {turn.selection ? (
                        <span className={styles.askContext}>
                          <SquareDashedText size={12} aria-hidden="true" /> Selection: {turn.selection.label}
                        </span>
                      ) : null}
                      <p className={styles.askBubble}>{turn.prompt}</p>
                    </motion.div>
                    <div className={styles.answer}>
                      {turn.status === "thinking" ? <TextShimmer className={styles.thinking}>Reading the page</TextShimmer> : null}
                      {turn.status === "error" ? (
                        <div className={styles.error}>
                          <CircleAlert size={16} className={styles.errorIcon} aria-hidden="true" />
                          <span className={styles.errorText}>
                            <span>{model} did not respond</span>
                            <span className={styles.errorDetail}>{turn.error}</span>
                          </span>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className={styles.footButton}
                            onClick={() => {
                              patch(turn.id, current => ({ ...current, status: "thinking", attempt: current.attempt + 1, error: undefined, text: "", final: false }));
                              stick.current = true;
                              void run(turn.id, turn.prompt, turn.selection, doc);
                            }}
                          >
                            <RotateCcw size={13} aria-hidden="true" /> Retry
                          </Button>
                        </div>
                      ) : null}
                      {turn.status === "streaming" || turn.status === "done" || (turn.status === "stopped" && turn.text) ? (
                        <div className={styles.answerText}>
                          <AnswerText key={turn.attempt} text={turn.text} final={turn.final} frozen={turn.status === "stopped"} onDone={() => finish(turn)} />
                        </div>
                      ) : null}
                      {turn.status === "stopped" ? (
                        <span className={styles.stopped}><Square size={10} fill="currentColor" aria-hidden="true" /> Stopped</span>
                      ) : null}
                      {turn.status === "done" && turn.change ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: fadeIn }}>
                          <ChangeCard
                            turn={turn}
                            onApply={() => apply(turn)}
                            onDiscard={() => discard(turn)}
                            applyRef={node => { applyRefs.current[turn.id] = node; }}
                          />
                        </motion.div>
                      ) : null}
                    </div>
                  </li>
                ))}
                {followUps.length ? (
                  <motion.li key={`follow-${log.length}`} className={styles.suggestions} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: fadeIn }}>
                    {followUps.map(item => (
                      <button key={item} type="button" className={styles.suggestion} onClick={() => send(item)}>{item}</button>
                    ))}
                  </motion.li>
                ) : null}
              </motion.ol>
            ) : (
              <motion.div key="empty" className={styles.empty} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: fadeIn }} exit={fadeOut}>
                <p className={styles.emptyTitle}>Ask about {doc.title}</p>
                <p className={styles.emptyText}>
                  {name} reads this page and proposes edits. Nothing changes until you apply it.
                  {respond ? "" : " Answers in this preview are simulated."}
                </p>
                <div className={styles.suggestions}>
                  {suggestions.map(item => (
                    <button key={item} type="button" className={styles.suggestion} onClick={() => send(item)}>{item}</button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className={styles.composerArea}>
        <div className={styles.pillSlot}>
          <AnimatePresence>
            {undo ? (
              <motion.button
                key={undo.turnId}
                ref={undoButton}
                type="button"
                className={styles.undoPill}
                aria-label={`Undo: ${undo.label}`}
                initial={{ opacity: 0, y: 4 * Number(!reduced) }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.18, ease } }}
                exit={fadeOut}
                onClick={revert}
              >
                <span className={styles.pillLabel}>{undo.label}</span>
                <span className={styles.pillRule} aria-hidden="true" />
                <RotateCcw size={13} aria-hidden="true" /> Undo
              </motion.button>
            ) : null}
          </AnimatePresence>
        </div>
        <form className={styles.composer} onSubmit={event => { event.preventDefault(); send(draft); }}>
          <input
            ref={input}
            className={styles.input}
            value={draft}
            placeholder={selection ? `Ask about the ${selection.label.toLowerCase()}` : "Ask about this page"}
            aria-label={`Message ${name.toLowerCase()}`}
            onChange={event => setDraft(event.target.value)}
          />
          {busy ? (
            <button
              type="button"
              className={styles.send}
              aria-label="Stop answering"
              onClick={() => {
                controller.current?.abort();
                setLog(current => current.map(turn => (
                  turn.status === "thinking" || turn.status === "streaming"
                    ? { ...turn, status: "stopped", change: undefined, changeState: undefined }
                    : turn
                )));
                setStatus("Stopped");
              }}
            >
              <Square size={11} fill="currentColor" aria-hidden="true" />
            </button>
          ) : (
            <button type="submit" className={styles.send} aria-label="Send" disabled={!draft.trim()}>
              <ArrowUp size={16} aria-hidden="true" />
            </button>
          )}
        </form>
      </div>
    </aside>
  );

  return (
    <div ref={root} className={[styles.root, className].filter(Boolean).join(" ")} data-sheet={narrow || undefined}>
      <div className={styles.pageCol} inert={(!!narrow && !!open) || undefined}>
        <div ref={pageScroll} className={styles.pageScroll}>
          <Doc
            page={doc}
            flash={flash}
            contextBlockId={selection?.blockId}
            reduced={reduced}
            onAskSelection={next => {
              setSelection(next);
              setStatus(`Added selection from ${next.label} as context`);
              setPanelOpen(true);
            }}
          />
        </div>
        <button
          ref={reopenButton}
          type="button"
          className={styles.reopen}
          data-hidden={open || undefined}
          inert={!!open || undefined}
          aria-controls={scopedPanelId}
          aria-expanded={open}
          onClick={() => setPanelOpen(true)}
        >
          <ClaudeMark className={styles.mark} aria-hidden="true" title="" /> {name}
        </button>
      </div>
      {narrow ? (
        <>
          <motion.div
            className={styles.scrim}
            aria-hidden="true"
            initial={false}
            animate={{ opacity: Number(!!open) }}
            transition={{ duration: 0.2 * Number(!reduced) }}
            style={{ pointerEvents: open ? "auto" : "none" }}
            onClick={() => setPanelOpen(false)}
          />
          <motion.div
            key="sheet"
            className={styles.sheet}
            initial={false}
            animate={{ y: open ? 0 : "104%" }}
            transition={panelTransition}
            inert={!open || undefined}
          >
            {panel}
          </motion.div>
        </>
      ) : (
        <motion.div
          key="dock"
          className={styles.dock}
          initial={false}
          animate={{ width: 360 * Number(!!open) }}
          transition={panelTransition}
          inert={!open || undefined}
        >
          <div className={styles.dockInner} style={{ width: 360 }}>{panel}</div>
        </motion.div>
      )}
      <p className={styles.srOnly} role="status" aria-live="polite">{status}</p>
    </div>
  );
}

export default AiSidePanel;
