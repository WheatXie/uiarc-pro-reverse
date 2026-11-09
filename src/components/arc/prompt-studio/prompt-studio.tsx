"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ClipboardEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUpFromLine,
  Check,
  ChevronDown,
  Columns2,
  Play,
  Plus,
  Square,
  TriangleAlert,
} from "lucide-react";
import { createPortal } from "react-dom";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import { PopoverContent, PopoverTrigger } from "../popover/popover";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./prompt-studio.module.css";

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

export type PromptEffort = "low" | "medium" | "high" | "xhigh" | "max";

export interface PromptTemplate {
  system: string;
  user: string;
}

export interface PromptVersion {
  id: string;
  label: string;
  /** One line describing what changed, shown in the version list. */
  message: string;
  author: { name: string; avatar?: string };
  /** ISO timestamp the version was saved. */
  createdAt: string;
  system: string;
  user: string;
}

export interface PromptTestCase {
  id: string;
  label: string;
  /** One value per variable; the first case is loaded on mount. */
  values: Record<string, string>;
}

export interface PromptModel {
  id: string;
  name: string;
  /** The name the chip shows, e.g. "Sonnet 5.5". */
  short: string;
  mark: "claude" | "openai" | "gemini";
  /** Dollars per 1M input tokens. */
  input: number;
  /** Dollars per 1M output tokens. */
  output: number;
  /** Marks a placeholder price with "sample price". */
  sample?: boolean;
  defaultEffort: PromptEffort;
}

export interface PromptRunRequest {
  /** The draft template, variables still wrapped in {{...}}. */
  template: PromptTemplate;
  /** The same template with the active test case values filled in. */
  rendered: PromptTemplate;
  values: Record<string, string>;
  model: PromptModel;
  effort: PromptEffort;
  testCaseId: string;
  versionId: string;
}

export type PromptRunHandler = (
  request: PromptRunRequest,
  signal: AbortSignal,
) => Promise<string | AsyncIterable<string>> | AsyncIterable<string>;

export interface PromptStudioProps {
  /** The card's heading and the prefix of its accessible name. */
  name?: string;
  /** Versions newest first. */
  versions?: PromptVersion[];
  /** The version open in the editor, defaults to the newest. */
  versionId?: string;
  /** The version production serves; defaults to the open version, `null` for none. */
  productionId?: string | null;
  /** Starting text, defaults to the open version's prompts. */
  template?: PromptTemplate;
  /** Variable order and colours. Unlisted variables found in the text are appended. */
  variables?: string[];
  /** Sample values to test with; the first case loads on mount. */
  testCases?: PromptTestCase[];
  /** Models offered by the chip. */
  models?: PromptModel[];
  defaultModel?: string;
  /** Defaults to the model's own default. */
  defaultEffort?: PromptEffort;
  /** Reference time for "3 days ago"; defaults to now, or Oct 20 2026 for the sample versions. */
  now?: string | number | Date;
  /** Runs the prompt for real. Without it the block simulates a reply and says so. */
  onRun?: PromptRunHandler;
  onPromote?: (versionId: string, previousId: string | null) => void;
  onTemplateChange?: (template: PromptTemplate) => void;
  className?: string;
}

/* -------------------------------------------------------------------------------------------------
 * Sample data
 * -----------------------------------------------------------------------------------------------*/

const people = [
  {
    id: "hannah-walsh",
    name: "Hannah Walsh",
    src: "/media/people/hannah-walsh.svg",
  },
  {
    id: "jordan-reyes",
    name: "Jordan Reyes",
    src: "/media/people/jordan-reyes.svg",
  },
  { id: "daniel-kim", name: "Daniel Kim", src: "/media/people/daniel-kim.svg" },
];

function person(id: string): { name: string; avatar?: string } {
  const found = people.find((candidate) => candidate.id === id);
  return { name: found?.name ?? id, avatar: found?.src };
}

const studioModels: PromptModel[] = [
  {
    id: "claude-sonnet-5-5",
    name: "Claude Sonnet 5.5",
    short: "Sonnet 5.5",
    mark: "claude",
    input: 2,
    output: 10,
    defaultEffort: "high",
  },
  {
    id: "claude-opus-5-5",
    name: "Claude Opus 5.5",
    short: "Opus 5.5",
    mark: "claude",
    input: 4,
    output: 20,
    defaultEffort: "medium",
  },
  {
    id: "claude-haiku-5-5",
    name: "Claude Haiku 5.5",
    short: "Haiku 5.5",
    mark: "claude",
    input: 0.1,
    output: 0.5,
    defaultEffort: "medium",
  },
  {
    id: "gpt-6-1-sol",
    name: "GPT-6.1 Sol",
    short: "GPT-6.1 Sol",
    mark: "openai",
    input: 5,
    output: 30,
    sample: true,
    defaultEffort: "medium",
  },
  {
    id: "gemini-4-argon",
    name: "Gemini 4 Argon",
    short: "Gemini 4 Argon",
    mark: "gemini",
    input: 3.5,
    output: 21,
    sample: true,
    defaultEffort: "medium",
  },
];

const efforts: PromptEffort[] = ["low", "medium", "high", "xhigh", "max"];

const effortLabel: Record<PromptEffort, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
  max: "Max",
};

const effortShort: Record<PromptEffort, string> = {
  low: "Low",
  medium: "Med",
  high: "High",
  xhigh: "XHigh",
  max: "Max",
};

/** How long the simulated model "thinks" before the first word, by effort. */
const thinkMs: Record<PromptEffort, number> = {
  low: 480,
  medium: 620,
  high: 780,
  xhigh: 960,
  max: 1150,
};

const baseSystem =
  "You are a support agent for Fernwood, an online home goods store.";
const greetLine = "- Greet {{customer_name}} by first name, once.";
const quoteLine = "- Quote order {{order_id}} so they can find it.";
const promiseLine = "- Never promise a date the carrier has not confirmed.";
const userLine =
  "Reply to the latest message from {{customer_name}} about order {{order_id}}.";

const sampleVersions: PromptVersion[] = [
  {
    id: "v4",
    label: "v4",
    createdAt: "2026-10-16T15:20:00Z",
    author: person("hannah-walsh"),
    message: "Escalate when the policy falls short",
    system: `${baseSystem} Write a warm, specific reply in under 120 words.

Follow this policy exactly: {{policy}}

${greetLine}
${quoteLine}
${promiseLine}
- If the policy does not cover the request, offer to escalate to a team lead.`,
    user: `${userLine} Sign off as Fernwood Support.`,
  },
  {
    id: "v3",
    label: "v3",
    createdAt: "2026-10-09T10:05:00Z",
    author: person("jordan-reyes"),
    message: "Shorter replies that quote the order",
    system: `${baseSystem} Write a warm, specific reply in under 150 words.

Follow this policy exactly: {{policy}}

${greetLine}
${quoteLine}
${promiseLine}`,
    user: userLine,
  },
  {
    id: "v2",
    label: "v2",
    createdAt: "2026-10-02T16:40:00Z",
    author: person("daniel-kim"),
    message: "Greet by name, no promised dates",
    system: `${baseSystem} Reply politely and help with the order.

Follow this policy exactly: {{policy}}

${greetLine}
${promiseLine}`,
    user: userLine,
  },
  {
    id: "v1",
    label: "v1",
    createdAt: "2026-09-24T09:15:00Z",
    author: person("hannah-walsh"),
    message: "First draft from the support macros",
    system: `${baseSystem} Answer the customer politely.

Refund policy: {{policy}}`,
    user: "Reply to {{customer_name}}.",
  },
];

const defaultVariables = ["customer_name", "order_id", "policy"];

const sampleCases: PromptTestCase[] = [
  {
    id: "late",
    label: "Late order",
    values: {
      customer_name: "Priya Raman",
      order_id: "FW-48213",
      policy:
        "Orders more than 5 business days late get their shipping fee refunded.",
    },
  },
  {
    id: "damaged",
    label: "Damaged",
    values: {
      customer_name: "Lukas Brandt",
      order_id: "FW-48377",
      policy:
        "Damaged items are replaced or refunded, whichever the customer prefers.",
    },
  },
  {
    id: "window",
    label: "Past window",
    values: {
      customer_name: "Ana Souza",
      order_id: "FW-46902",
      policy: "Returns are accepted within 30 days of delivery.",
    },
  },
];

/* -------------------------------------------------------------------------------------------------
 * Text helpers
 * -----------------------------------------------------------------------------------------------*/

const variablePattern = /\{\{\s*([A-Za-z_]\w*)\s*\}\}/g;

type PromptToken =
  | { type: "text"; text: string; start: number }
  | { type: "var"; name: string; start: number; end: number };

function tokenize(text: string): PromptToken[] {
  const tokens: PromptToken[] = [];
  let cursor = 0;
  for (const match of text.matchAll(variablePattern)) {
    const index = match.index ?? 0;
    if (index > cursor)
      tokens.push({
        type: "text",
        text: text.slice(cursor, index),
        start: cursor,
      });
    tokens.push({
      type: "var",
      name: match[1],
      start: index,
      end: index + match[0].length,
    });
    cursor = index + match[0].length;
  }
  if (cursor < text.length)
    tokens.push({ type: "text", text: text.slice(cursor), start: cursor });
  return tokens;
}

/** Unique variable names in the order they first appear. */
function collectVariables(...texts: string[]): string[] {
  const names: string[] = [];
  for (const text of texts) {
    for (const match of text.matchAll(variablePattern)) {
      if (!names.includes(match[1])) names.push(match[1]);
    }
  }
  return names;
}

/** Fills variables that have a value, leaves the rest as {{name}} so they stay visible. */
function applyValues(template: string, values: Record<string, string>): string {
  return template.replace(variablePattern, (token, name: string) =>
    values[name]?.trim() ? values[name] : token,
  );
}

function estimateTokens(text: string): number {
  if (!text.trim()) return 0;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(text.length / 4.2 + 0.12 * words));
}

function formatPrice(value: number): string {
  return `$${value < 1 ? value.toFixed(2) : Number.isInteger(value) ? value : value.toFixed(2)}`;
}

const relative = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

const wordPattern = /\{\{\s*[A-Za-z_]\w*\s*\}\}|\s+|[^\s{]+|\{/g;

function splitWords(text: string): string[] {
  return text.match(wordPattern) ?? [];
}

type DiffOp = { type: "same" | "add" | "remove"; text: string };

/** Word-level LCS diff. Removed and added runs are kept adjacent so a changed sentence reads as one swap. */
function diffWords(before: string, after: string): DiffOp[] {
  const left = splitWords(before);
  const right = splitWords(after);
  let prefix = 0;
  while (
    prefix < left.length &&
    prefix < right.length &&
    left[prefix] === right[prefix]
  )
    prefix += 1;
  let suffix = 0;
  while (
    suffix < left.length - prefix &&
    suffix < right.length - prefix &&
    left[left.length - 1 - suffix] === right[right.length - 1 - suffix]
  )
    suffix += 1;

  const start = left.slice(prefix, left.length - suffix);
  const end = right.slice(prefix, right.length - suffix);
  const rows = start.length;
  const columns = end.length;
  const table = Array.from(
    { length: rows + 1 },
    () => new Uint16Array(columns + 1),
  );
  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      table[row][column] =
        start[row] === end[column]
          ? table[row + 1][column + 1] + 1
          : Math.max(table[row + 1][column], table[row][column + 1]);
    }
  }

  const raw: DiffOp[] = [];
  const push = (type: DiffOp["type"], text: string) => {
    const last = raw[raw.length - 1];
    if (last && last.type === type) last.text += text;
    else raw.push({ type, text });
  };

  if (prefix) push("same", left.slice(0, prefix).join(""));
  let row = 0;
  let column = 0;
  while (row < rows && column < columns) {
    if (start[row] === end[column]) {
      push("same", start[row]);
      row += 1;
      column += 1;
    } else if (table[row + 1][column] >= table[row][column + 1]) {
      push("remove", start[row]);
      row += 1;
    } else {
      push("add", end[column]);
      column += 1;
    }
  }
  while (row < rows) push("remove", start[row++]);
  while (column < columns) push("add", end[column++]);
  if (suffix) push("same", left.slice(left.length - suffix).join(""));

  const merged: DiffOp[] = [];
  let removed = "";
  let added = "";
  const flush = () => {
    if (removed && (removed.trim() || !added))
      merged.push({ type: "remove", text: removed });
    if (added && (added.trim() || !removed))
      merged.push({ type: "add", text: added });
    removed = "";
    added = "";
  };

  raw.forEach((op, index) => {
    if (op.type === "remove") removed += op.text;
    else if (op.type === "add") added += op.text;
    else if (
      (removed || added) &&
      /^[ \t]+$/.test(op.text) &&
      raw[index + 1] &&
      raw[index + 1].type !== "same"
    ) {
      // Whitespace between a removal and an addition belongs to both, so the two runs stay on the same spot.
      removed += op.text;
      added += op.text;
    } else {
      flush();
      const last = merged[merged.length - 1];
      if (last?.type === "same") last.text += op.text;
      else merged.push({ ...op });
    }
  });
  flush();
  return merged;
}

function relativeDay(days: number): string {
  if (days < 1) return "today";
  if (days < 7) return relative.format(-days, "day");
  if (days < 30) return relative.format(-Math.floor(days / 7), "week");
  if (days < 365) return relative.format(-Math.floor(days / 30), "month");
  return relative.format(-Math.floor(days / 365), "year");
}

/* -------------------------------------------------------------------------------------------------
 * Contenteditable plumbing: the string model is the source of truth, the DOM is rebuilt from it.
 * -----------------------------------------------------------------------------------------------*/

const zeroWidth = "\u200B";

function buildEditor(
  root: HTMLElement,
  text: string,
  toneOf: (name: string) => number,
) {
  const tokens = tokenize(text);
  const nodes: Node[] = [];
  tokens.forEach((token, index) => {
    if (token.type === "text") {
      nodes.push(document.createTextNode(token.text));
      return;
    }
    const previous = tokens[index - 1];
    const next = tokens[index + 1];
    // A chip at the very start, or right after a line break, needs a caret home in front of it.
    if (
      !previous ||
      (previous.type === "text" && previous.text.endsWith("\n"))
    ) {
      nodes.push(document.createTextNode(zeroWidth));
    }
    const chip = document.createElement("span");
    chip.contentEditable = "false";
    chip.dataset.var = token.name;
    chip.dataset.tone = String(toneOf(token.name));
    chip.className = styles.varChip;
    chip.textContent = token.name;
    nodes.push(chip);
    // Same after: at the end, before a line break, or directly before another chip.
    if (!next || next.type === "var" || next.text.startsWith("\n")) {
      nodes.push(document.createTextNode(zeroWidth));
    }
  });
  if (text.endsWith("\n")) {
    const br = document.createElement("br");
    br.dataset.end = "";
    nodes.push(br);
  }
  root.replaceChildren(...nodes);
}

function readEditor(root: Node): string {
  let text = "";
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += (node.textContent ?? "").replaceAll(zeroWidth, "");
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.dataset.var !== undefined) {
      text += `{{${node.dataset.var}}}`;
      return;
    }
    if (node.tagName === "BR") {
      text += node.dataset.end !== undefined ? "" : "\n";
      return;
    }
    if (
      (node.tagName === "DIV" || node.tagName === "P") &&
      text &&
      !text.endsWith("\n")
    )
      text += "\n";
    text += readEditor(node);
  });
  return text;
}

function caretOffset(root: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(node, offset);
  const scratch = document.createElement("div");
  scratch.appendChild(range.cloneContents());
  return readEditor(scratch).length;
}

function readCaret(element: HTMLElement): [number, number] | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (
    !element.contains(range.startContainer) ||
    !element.contains(range.endContainer)
  )
    return null;
  const start = caretOffset(element, range.startContainer, range.startOffset);
  return [
    start,
    range.collapsed
      ? start
      : caretOffset(element, range.endContainer, range.endOffset),
  ];
}

function setCaret(element: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  let remaining = offset;
  let placed = false;
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      const length = text.replaceAll(zeroWidth, "").length;
      if (remaining <= length) {
        let index = 0;
        let counted = 0;
        while (counted < remaining && index < text.length) {
          if (text[index] !== zeroWidth) counted += 1;
          index += 1;
        }
        if (length === 0) index = text.length;
        range.setStart(node, index);
        placed = true;
        break;
      }
      remaining -= length;
      continue;
    }
    if (!(node instanceof HTMLElement)) continue;
    const width =
      node.dataset.var !== undefined
        ? node.dataset.var.length + 4
        : Number(node.tagName === "BR" && node.dataset.end === undefined);
    if (remaining < width) {
      range.setStartAfter(node);
      placed = true;
      break;
    }
    remaining -= width;
  }
  if (!placed) {
    const last = element.lastChild;
    if (last instanceof HTMLElement && last.dataset.end !== undefined)
      range.setStartBefore(last);
    else range.setStart(element, element.childNodes.length);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** The variable token whose closing braces sit at `position`. */
function variableEndingAt(text: string, position: number) {
  return tokenize(text).find(
    (token) => token.type === "var" && token.end === position,
  );
}

/** The variable token whose opening braces sit at `position`. */
function variableStartingAt(text: string, position: number) {
  return tokenize(text).find(
    (token) => token.type === "var" && token.start === position,
  );
}

/** Backspace over a chip removes the whole token; otherwise one character, keeping surrogate pairs whole. */
function deleteBackwardFrom(text: string, caret: number): number {
  if (variableEndingAt(text, caret))
    return variableEndingAt(text, caret)!.start;
  const code = text.charCodeAt(caret - 1);
  return Math.max(0, caret - (code >= 0xdc00 && code <= 0xdfff ? 2 : 1));
}

function deleteForwardFrom(text: string, caret: number): number {
  const token = variableStartingAt(text, caret);
  if (token && token.type === "var") return token.end;
  const code = text.charCodeAt(caret);
  return Math.min(
    text.length,
    caret + (code >= 0xd800 && code <= 0xdbff ? 2 : 1),
  );
}

function deleteWordBack(text: string, caret: number): number {
  const token = variableEndingAt(text, caret);
  if (token) return token.start;
  let index = caret;
  while (index > 0 && /\s/.test(text[index - 1]) && text[index - 1] !== "\n")
    index -= 1;
  if (index === caret && text[index - 1] === "\n") return index - 1;
  while (
    index > 0 &&
    !/\s/.test(text[index - 1]) &&
    !variableEndingAt(text, index)
  )
    index -= 1;
  return index;
}

function deleteWordForward(text: string, caret: number): number {
  const token = variableStartingAt(text, caret);
  if (token && token.type === "var") return token.end;
  let index = caret;
  while (index < text.length && /\s/.test(text[index]) && text[index] !== "\n")
    index += 1;
  if (index === caret && text[index] === "\n") return index + 1;
  while (
    index < text.length &&
    !/\s/.test(text[index]) &&
    !variableStartingAt(text, index)
  )
    index += 1;
  return index;
}

interface Suggestion {
  name: string;
  create: boolean;
}

function buildSuggestions(query: string, variables: string[]): Suggestion[] {
  const needle = query.toLowerCase();
  const matches: Suggestion[] = variables
    .filter((name) => name.toLowerCase().includes(needle))
    .slice(0, 6)
    .map((name) => ({ name, create: false }));
  if (query && /^[A-Za-z_]\w*$/.test(query) && !variables.includes(query))
    matches.push({ name: query, create: true });
  return matches;
}

interface SuggestionState {
  start: number;
  query: string;
  active: number;
  top: number;
  left: number;
}

const subscribeToNothing = () => () => {};

type NavigatorWithHints = Navigator & { userAgentData?: { platform?: string } };

function detectPlatform(): "mac" | "pc" {
  const agent = navigator as NavigatorWithHints;
  return /mac|iphone|ipad|ipod/i.test(
    agent.userAgentData?.platform || agent.platform || agent.userAgent,
  )
    ? "mac"
    : "pc";
}

/** Read in an effect-safe subscription so the server render and the first client render agree. */
function usePlatform(): "mac" | "pc" {
  return useSyncExternalStore(subscribeToNothing, detectPlatform, () => "mac");
}

/* -------------------------------------------------------------------------------------------------
 * Marks
 * -----------------------------------------------------------------------------------------------*/

interface MarkProps {
  className?: string;
  "aria-hidden"?: boolean;
  "data-brand"?: string;
}

function ClaudeMark(props: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-label=""
      {...props}
    >
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

function OpenAIMark(props: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-label=""
      {...props}
    >
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

function GeminiMark(props: MarkProps) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="" {...props}>
      <path
        d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
        fill="#3186FF"
      />
      <path
        d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
        fill={`url(#g0-${uid})`}
      />
      <path
        d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
        fill={`url(#g1-${uid})`}
      />
      <path
        d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
        fill={`url(#g2-${uid})`}
      />
      <defs>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={`g0-${uid}`}
          x1="7"
          x2="11"
          y1="15.5"
          y2="12"
        >
          <stop stopColor="#08B962" />
          <stop offset="1" stopColor="#08B962" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={`g1-${uid}`}
          x1="8"
          x2="11.5"
          y1="5.5"
          y2="11"
        >
          <stop stopColor="#F94543" />
          <stop offset="1" stopColor="#F94543" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={`g2-${uid}`}
          x1="3.5"
          x2="17.5"
          y1="13.5"
          y2="12"
        >
          <stop stopColor="#FABC12" />
          <stop offset=".46" stopColor="#FABC12" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** The provider mark, sized by the slot that holds it. */
function ModelMark({
  mark,
  className,
}: {
  mark: PromptModel["mark"];
  className?: string;
}) {
  const shared: MarkProps = {
    className: [styles.mark, className].filter(Boolean).join(" "),
    "aria-hidden": true,
  };
  if (mark === "openai") return <OpenAIMark {...shared} />;
  if (mark === "gemini") return <GeminiMark {...shared} />;
  return <ClaudeMark {...shared} data-brand="claude" />;
}

/* -------------------------------------------------------------------------------------------------
 * Swap: a label that crossfades and eases the slot to the new width
 * -----------------------------------------------------------------------------------------------*/

const swapSpring = { type: "spring", visualDuration: 0.22, bounce: 0 } as const;
const enterEase = [...motionTokens.ease.enter] as [
  number,
  number,
  number,
  number,
];
const standardEase = [...motionTokens.ease.standard] as [
  number,
  number,
  number,
  number,
];
const swapIn = { duration: motionTokens.duration.fast, ease: enterEase };
const swapOut = { duration: 0.1, ease: standardEase };
const instant = { duration: 0 };

function Swap({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const reduced = !!useReducedMotion();
  const measure = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | "auto">("auto");
  const [key, setKey] = useState(id);
  const [armed, setArmed] = useState(false);

  if (id !== key) {
    setKey(id);
    setArmed(true);
  }

  useLayoutEffect(() => {
    const node = measure.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setWidth(
          Math.ceil(entry.borderBoxSize?.[0]?.inlineSize ?? node.offsetWidth),
        );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.span
      className={[styles.swap, className].filter(Boolean).join(" ")}
      initial={false}
      animate={{ width }}
      transition={armed && !reduced ? swapSpring : instant}
    >
      <span ref={measure} className={styles.swapMeasure} aria-hidden="true">
        {children}
      </span>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0, transition: reduced ? instant : swapIn }}
          exit={{ opacity: 0, transition: reduced ? instant : swapOut }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Segmented control / tabs
 * -----------------------------------------------------------------------------------------------*/

interface SegmentOption {
  value: string;
  label: ReactNode;
  id?: string;
  panel?: string;
}

function Segmented({
  options,
  value,
  onChange,
  label,
  kind,
  className,
}: {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  kind: "tabs" | "segmented";
  className?: string;
}) {
  const id = useId();
  const reduced = !!useReducedMotion();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const active = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const isTabs = kind === "tabs";

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1;
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? active === last
          ? 0
          : active + 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? active === 0
            ? last
            : active - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    event.preventDefault();
    onChange(options[next].value);
    buttons.current[next]?.focus();
  };

  return (
    <div
      className={[isTabs ? styles.tabs : styles.seg, className]
        .filter(Boolean)
        .join(" ")}
      role={isTabs ? "tablist" : "radiogroup"}
      aria-label={label}
    >
      {options.map((option, index) => {
        const selected = index === active;
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            id={option.id}
            type="button"
            className={isTabs ? styles.tab : styles.segOption}
            role={isTabs ? "tab" : "radio"}
            aria-selected={isTabs ? selected : undefined}
            aria-checked={isTabs ? undefined : selected}
            aria-controls={option.panel}
            tabIndex={selected ? 0 : -1}
            data-on={selected || undefined}
            onClick={() => onChange(option.value)}
            onKeyDown={onKeyDown}
          >
            {selected && (
              <motion.span
                layoutId={`${isTabs ? "tab" : "segment"}-${id}`}
                className={isTabs ? styles.tabHighlight : styles.segHighlight}
                style={{ borderRadius: 999 }}
                transition={reduced ? instant : swapSpring}
                aria-hidden="true"
              />
            )}
            <span className={styles.segLabel}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Rolling token count
 * -----------------------------------------------------------------------------------------------*/

const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function Roll({ value }: { value: number }) {
  const formatted = value.toLocaleString("en-US");
  const characters = [...formatted];
  return (
    <span className={styles.roll}>
      <span className={styles.srOnly}>{formatted}</span>
      <span className={styles.rollDigits} aria-hidden="true">
        {characters.map((character, index) => {
          const place = characters.length - 1 - index;
          return /\d/.test(character) ? (
            <span key={`d${place}`} className={styles.rollCol}>
              <span
                className={styles.rollStrip}
                style={{ "--d": character } as CSSProperties}
              >
                {digits.map((digit) => (
                  <span key={digit}>{digit}</span>
                ))}
              </span>
            </span>
          ) : (
            <span key={`s${place}`} className={styles.rollSep}>
              {character}
            </span>
          );
        })}
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Auto height panel
 * -----------------------------------------------------------------------------------------------*/

function AutoHeight({
  children,
  armKey,
  sticky = true,
  className,
}: {
  children: ReactNode;
  armKey: string;
  sticky?: boolean;
  className?: string;
}) {
  const reduced = !!useReducedMotion();
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  const [armedKey, setArmedKey] = useState(armKey);
  const [armed, setArmed] = useState(false);

  if (armKey !== armedKey) {
    setArmedKey(armKey);
    setArmed(true);
  }

  useLayoutEffect(() => {
    const node = inner.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setHeight(
          Math.ceil(entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight),
        );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!armed || sticky) return;
    const timer = window.setTimeout(() => setArmed(false), 700);
    return () => window.clearTimeout(timer);
  }, [armed, sticky, armedKey]);

  return (
    <motion.div
      className={[styles.autoHeight, className].filter(Boolean).join(" ")}
      initial={false}
      animate={{ height }}
      transition={armed && !reduced ? motionTokens.spring.smooth : instant}
    >
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Prompt editor (contenteditable with variable chips and a {{ list)
 * -----------------------------------------------------------------------------------------------*/

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables: string[];
  toneOf: (name: string) => number;
  missing: string[];
  activeVariable: string | null;
  flash: { name: string; at: number } | null;
  onChipClick?: (name: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  label: string;
  describedBy: string;
  inert: boolean;
}

function PromptEditor({
  value,
  onChange,
  variables,
  toneOf,
  missing,
  activeVariable,
  flash,
  onChipClick,
  onSubmit,
  placeholder,
  label,
  describedBy,
  inert,
}: PromptEditorProps) {
  const listId = useId();
  const element = useRef<HTMLDivElement>(null);
  const committed = useRef<string | null>(null);
  const composing = useRef(false);
  const history = useRef<{
    past: { value: string; caret: number }[];
    future: { value: string; caret: number }[];
    lastAt: number;
    lastKind: string;
  }>({
    past: [],
    future: [],
    lastAt: 0,
    lastKind: "",
  });
  const blocked = useRef<number | null>(null);
  const [suggest, setSuggest] = useState<SuggestionState | null>(null);
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  const latest = useRef({ suggest, variables, onChange, toneOf });
  useLayoutEffect(() => {
    latest.current = { suggest, variables, onChange, toneOf };
  });

  const toneFor = useCallback(
    (name: string) => latest.current.toneOf(name),
    [],
  );

  useLayoutEffect(() => {
    const node = element.current;
    if (!node || committed.current === value) return;
    const focused = document.activeElement === node;
    const caret = focused ? (readCaret(node)?.[0] ?? value.length) : 0;
    committed.current = value;
    buildEditor(node, value, toneFor);
    history.current = { past: [], future: [], lastAt: 0, lastKind: "" };
    if (focused) setCaret(node, Math.min(caret, value.length));
  }, [value, toneFor]);

  // Tone, missing and active state ride on the existing chips instead of a rebuild, so the caret never jumps.
  useLayoutEffect(() => {
    element.current
      ?.querySelectorAll<HTMLElement>("[data-var]")
      .forEach((chip) => {
        const name = chip.dataset.var ?? "";
        chip.dataset.tone = String(toneOf(name));
        chip.toggleAttribute("data-missing", !!missing?.includes(name));
        chip.toggleAttribute("data-active", activeVariable === name);
      });
  });

  useLayoutEffect(() => {
    if (!flash) return;
    const chips = element.current?.querySelectorAll<HTMLElement>(
      `[data-var="${CSS.escape(flash.name)}"]`,
    );
    chips?.forEach((chip) => {
      chip.removeAttribute("data-flash");
      void chip.offsetWidth;
      chip.setAttribute("data-flash", "");
    });
  }, [flash]);

  const suggestionsFor = useCallback(
    (query: string) => buildSuggestions(query, latest.current.variables),
    [],
  );

  const updateSuggest = useCallback(
    (text: string, caret: number) => {
      const node = element.current;
      const match = /\{\{\s*([A-Za-z_]\w*)?$/.exec(text.slice(0, caret));
      if (!node || !match || blocked.current === match.index) {
        setSuggest(null);
        return;
      }
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const rects = range?.getClientRects();
      const rect = rects?.length
        ? rects[rects.length - 1]
        : (range?.startContainer instanceof Element
            ? range.startContainer
            : range?.startContainer.parentElement
          )?.getBoundingClientRect();
      if (!rect) {
        setSuggest(null);
        return;
      }
      const query = match[1] ?? "";
      const rows = Math.max(1, suggestionsFor(query).length);
      const height = 34 * rows + 10;
      const flip =
        rect.bottom + 6 + height > window.innerHeight - 8 &&
        rect.top - 6 - height > 8;
      const maxWidth = Math.min(240, window.innerWidth - 16);
      setSuggest((previous) => ({
        start: match.index,
        query,
        active:
          previous && previous.start === match.index
            ? Math.min(previous.active, rows - 1)
            : 0,
        top: flip ? rect.top - 6 - height : rect.bottom + 6,
        left: Math.max(
          8,
          Math.min(rect.left - 10, window.innerWidth - maxWidth - 8),
        ),
      }));
    },
    [suggestionsFor],
  );

  const commit = useCallback(
    (next: string, caret: number, kind: string) => {
      const node = element.current;
      if (!node) return;
      const previous = committed.current ?? "";
      const normalised = next.replace(variablePattern, "{{$1}}");
      const target = next
        .slice(0, caret)
        .replace(variablePattern, "{{$1}}").length;
      const record = history.current;
      const now = performance.now();
      const coalesce =
        kind === "type" &&
        record.lastKind === "type" &&
        now - record.lastAt < 900;
      if (!coalesce)
        record.past.push({
          value: previous,
          caret: readCaret(node)?.[0] ?? target,
        });
      if (record.past.length > 200) record.past.shift();
      record.future = [];
      record.lastAt = now;
      record.lastKind = kind;
      committed.current = normalised;
      buildEditor(node, normalised, toneFor);
      setCaret(node, target);
      latest.current.onChange(normalised);
      updateSuggest(normalised, target);
    },
    [toneFor, updateSuggest],
  );

  const travel = useCallback(
    (direction: "undo" | "redo") => {
      const node = element.current;
      const record = history.current;
      const from = direction === "undo" ? record.past : record.future;
      const to = direction === "undo" ? record.future : record.past;
      const step = from.pop();
      if (!node || !step) return;
      to.push({
        value: committed.current ?? "",
        caret: readCaret(node)?.[0] ?? 0,
      });
      record.lastKind = "";
      committed.current = step.value;
      buildEditor(node, step.value, toneFor);
      setCaret(node, step.caret);
      latest.current.onChange(step.value);
      setSuggest(null);
    },
    [toneFor],
  );

  const replaceSelection = useCallback(
    (text: string, kind: string) => {
      const node = element.current;
      const caret = node && readCaret(node);
      if (!node || !caret) return;
      const current = committed.current ?? "";
      commit(
        current.slice(0, caret[0]) + text + current.slice(caret[1]),
        caret[0] + text.length,
        kind,
      );
    },
    [commit],
  );

  useEffect(() => {
    const node = element.current;
    if (!node) return;

    const onBeforeInput = (event: InputEvent) => {
      if (event.isComposing || event.inputType === "insertCompositionText")
        return;
      const caret = readCaret(node);
      if (!caret) return;
      const current = committed.current ?? "";
      let [start, end] = caret;
      let insert = "";
      let kind = "edit";
      switch (event.inputType) {
        case "insertText":
        case "insertReplacementText":
          insert =
            event.data ?? event.dataTransfer?.getData("text/plain") ?? "";
          kind = /\s/.test(insert) ? "space" : "type";
          blocked.current = null;
          break;
        case "insertLineBreak":
        case "insertParagraph":
          insert = "\n";
          break;
        case "insertFromPaste":
        case "insertFromDrop":
        case "insertFromYank":
          insert = event.dataTransfer?.getData("text/plain") ?? "";
          break;
        case "deleteContentBackward":
          if (start === end) start = deleteBackwardFrom(current, start);
          kind = "delete";
          break;
        case "deleteContentForward":
          if (start === end) end = deleteForwardFrom(current, end);
          kind = "delete";
          break;
        case "deleteWordBackward":
          if (start === end) start = deleteWordBack(current, start);
          break;
        case "deleteWordForward":
          if (start === end) end = deleteWordForward(current, end);
          break;
        case "deleteSoftLineBackward":
        case "deleteHardLineBackward":
          if (start === end)
            start =
              start > 0 && current[start - 1] === "\n"
                ? start - 1
                : current.lastIndexOf("\n", start - 1) + 1;
          break;
        case "deleteSoftLineForward":
        case "deleteHardLineForward": {
          if (start !== end) break;
          const next = current.indexOf("\n", end);
          end = next === -1 ? current.length : next === end ? end + 1 : next;
          break;
        }
        case "deleteByCut":
        case "deleteByDrag":
        case "deleteContent":
          break;
        case "historyUndo":
          event.preventDefault();
          travel("undo");
          return;
        case "historyRedo":
          event.preventDefault();
          travel("redo");
          return;
        default:
          event.preventDefault();
          return;
      }
      event.preventDefault();
      if (start !== end || insert) {
        commit(
          current.slice(0, start) + insert + current.slice(end),
          start + insert.length,
          kind,
        );
      }
    };

    const onInput = () => {
      if (composing.current) return;
      const next = readEditor(node);
      if (next === committed.current) return;
      commit(next, readCaret(node)?.[0] ?? next.length, "edit");
    };

    const onCompositionStart = () => {
      composing.current = true;
    };

    const onCompositionEnd = () => {
      composing.current = false;
      onInput();
    };

    node.addEventListener("beforeinput", onBeforeInput);
    node.addEventListener("input", onInput);
    node.addEventListener("compositionstart", onCompositionStart);
    node.addEventListener("compositionend", onCompositionEnd);
    return () => {
      node.removeEventListener("beforeinput", onBeforeInput);
      node.removeEventListener("input", onInput);
      node.removeEventListener("compositionstart", onCompositionStart);
      node.removeEventListener("compositionend", onCompositionEnd);
    };
  }, [commit, travel]);

  // The suggestion list follows the caret while it is open: selection changes, scrolling and resizes.
  useEffect(() => {
    if (!suggest) return;
    const node = element.current;
    const follow = () => {
      if (!node || document.activeElement !== node) {
        setSuggest(null);
        return;
      }
      const caret = readCaret(node)?.[0];
      if (caret === undefined) setSuggest(null);
      else updateSuggest(committed.current ?? "", caret);
    };
    document.addEventListener("selectionchange", follow);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      document.removeEventListener("selectionchange", follow);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [suggest, updateSuggest]);

  const insertVariable = useCallback(
    (name: string) => {
      const node = element.current;
      const state = latest.current.suggest;
      const caret = node && readCaret(node)?.[0];
      if (!node || !state || caret === null || caret === undefined) return;
      const current = committed.current ?? "";
      // Closing braces the user already typed after the list opened are part of the insert.
      const typedClose = /^\s*\}\}/.exec(current.slice(caret))?.[0].length ?? 0;
      const token = `{{${name}}}`;
      commit(
        current.slice(0, state.start) +
          token +
          current.slice(caret + typedClose),
        state.start + token.length,
        "edit",
      );
      setSuggest(null);
    },
    [commit],
  );

  const writeSelection = (
    event: ClipboardEvent<HTMLDivElement>,
    remove: boolean,
  ) => {
    const node = element.current;
    const caret = node && readCaret(node);
    if (!node || !caret || caret[0] === caret[1]) return;
    event.preventDefault();
    event.clipboardData.setData(
      "text/plain",
      (committed.current ?? "").slice(caret[0], caret[1]),
    );
    if (remove) replaceSelection("", "edit");
  };

  const matches = suggest ? buildSuggestions(suggest.query, variables) : [];
  const activeDescendant =
    suggest && matches.length ? `${listId}-${suggest.active}` : undefined;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key === "Enter") {
      event.preventDefault();
      setSuggest(null);
      onSubmit?.();
      return;
    }
    if (mod && !event.altKey && event.key.toLowerCase() === "z") {
      event.preventDefault();
      travel(event.shiftKey ? "redo" : "undo");
      return;
    }
    if (mod && !event.altKey && event.key.toLowerCase() === "y") {
      event.preventDefault();
      travel("redo");
      return;
    }
    if (mod && ["b", "i", "u"].includes(event.key.toLowerCase())) {
      event.preventDefault();
      return;
    }
    const state = latest.current.suggest;
    if (!state) return;
    const rows = suggestionsFor(state.query);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!rows.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setSuggest({
        ...state,
        active: (state.active + step + rows.length) % rows.length,
      });
      return;
    }
    if ((event.key === "Enter" || event.key === "Tab") && rows.length) {
      event.preventDefault();
      insertVariable(rows[state.active]?.name ?? rows[0].name);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      blocked.current = state.start;
      setSuggest(null);
    }
  };

  return (
    <Fragment>
      <div
        ref={element}
        className={styles.editable}
        contentEditable={!inert}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        aria-describedby={describedBy}
        aria-autocomplete="list"
        aria-controls={suggest ? listId : undefined}
        aria-activedescendant={activeDescendant}
        tabIndex={inert ? -1 : 0}
        spellCheck={false}
        data-empty={value === "" ? true : undefined}
        data-placeholder={placeholder}
        onKeyDown={onKeyDown}
        onCopy={(event) => writeSelection(event, false)}
        onCut={(event) => writeSelection(event, true)}
        onPaste={(event) => {
          event.preventDefault();
          replaceSelection(
            event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n"),
            "edit",
          );
        }}
        onDrop={(event) => {
          event.preventDefault();
          const text = event.dataTransfer.getData("text/plain");
          if (text) replaceSelection(text, "edit");
        }}
        onClick={(event: MouseEvent<HTMLDivElement>) => {
          const chip = (event.target as HTMLElement).closest<HTMLElement>(
            "[data-var]",
          );
          if (chip?.dataset.var) onChipClick?.(chip.dataset.var);
        }}
        onBlur={() => setSuggest(null)}
      />
      {mounted &&
        suggest &&
        createPortal(
          <div
            className={styles.suggest}
            style={{ top: suggest.top, left: suggest.left }}
          >
            <ul
              id={listId}
              role="listbox"
              aria-label="Variables"
              className={styles.suggestList}
            >
              {matches.length ? (
                matches.map((option, index) => (
                  <li
                    key={`${option.name}-${option.create}`}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === suggest.active}
                    className={styles.suggestOption}
                    data-tone={option.create ? undefined : toneOf(option.name)}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      insertVariable(option.name);
                    }}
                    onPointerMove={() => {
                      if (index !== suggest.active)
                        setSuggest({ ...suggest, active: index });
                    }}
                  >
                    {option.create ? (
                      <Plus className={styles.suggestIcon} aria-hidden="true" />
                    ) : (
                      <span className={styles.suggestDot} aria-hidden="true" />
                    )}
                    <span className={styles.suggestName}>
                      {option.create ? (
                        <Fragment>
                          Add{" "}
                          <span className={styles.suggestNew}>
                            {option.name}
                          </span>
                        </Fragment>
                      ) : (
                        option.name
                      )}
                    </span>
                  </li>
                ))
              ) : (
                <li className={styles.suggestEmpty} role="presentation">
                  Type a name, then close with {"}}"}
                </li>
              )}
            </ul>
          </div>,
          document.body,
        )}
    </Fragment>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Version chip + menu
 * -----------------------------------------------------------------------------------------------*/

interface Promotion {
  from: string | null;
  to: string;
}

function VersionMenu({
  versions,
  openId,
  productionId,
  now,
  promotion,
  onCompare,
  onPromote,
  onUndo,
}: {
  versions: PromptVersion[];
  openId: string;
  productionId: string | null;
  now: number;
  promotion: Promotion | null;
  onCompare: (id: string) => void;
  onPromote: (id: string) => void;
  onUndo: () => void;
}) {
  const reduced = !!useReducedMotion();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const openIndex = Math.max(
    0,
    versions.findIndex((version) => version.id === openId),
  );
  const [target, setTarget] = useState(
    () => versions[openIndex + 1]?.id ?? versions[0]?.id ?? "",
  );
  const openVersion = versions[openIndex];
  const picked =
    versions.find((version) => version.id === target) ?? openVersion;
  const inProduction = productionId === openVersion?.id;
  const serving = versions.find((version) => version.id === productionId);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={styles.chip}
        aria-label={`Version ${openVersion?.label}${inProduction ? ", in production" : ""}. Open versions`}
      >
        <span className={styles.chipVersion}>{openVersion?.label}</span>
        <Swap
          id={inProduction ? "live" : "latest"}
          className={styles.chipState}
        >
          {inProduction ? (
            <Fragment>
              <span className={styles.liveDot} aria-hidden="true" />
              Production
            </Fragment>
          ) : (
            <Fragment>Latest</Fragment>
          )}
        </Swap>
        <ChevronDown className={styles.chevron} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        className={`${styles.menu} ${styles.versionMenu}`}
        align="start"
        aria-label="Versions"
      >
        <div
          className={styles.versionList}
          role="radiogroup"
          aria-label="Pick a version to compare or promote"
        >
          {versions.map((version, index) => {
            const selected = version.id === picked?.id;
            return (
              <button
                key={version.id}
                ref={(node) => {
                  rows.current[index] = node;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                className={styles.versionRow}
                data-on={selected || undefined}
                onClick={() => setTarget(version.id)}
                onKeyDown={(event) => {
                  const last = versions.length - 1;
                  const next =
                    event.key === "ArrowDown"
                      ? index === last
                        ? 0
                        : index + 1
                      : event.key === "ArrowUp"
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
                  setTarget(versions[next].id);
                  rows.current[next]?.focus();
                }}
              >
                <Avatar
                  name={version.author.name}
                  src={version.author.avatar}
                  size="sm"
                  className={styles.versionAvatar}
                />
                <span className={styles.versionText}>
                  <span className={styles.versionMessage}>
                    {version.message}
                  </span>
                  <span className={styles.versionMeta}>
                    <span className={styles.versionMetaText}>
                      <span className={styles.versionLabel}>
                        {version.label}
                      </span>
                      {" · "}
                      {version.author.name}
                      {" · "}
                      {relativeDay(
                        Math.floor(
                          (now - Date.parse(version.createdAt)) / 864e5,
                        ),
                      )}
                    </span>
                    <span className={styles.versionSlot}>
                      {version.id === productionId && (
                        <motion.span
                          layoutId="production"
                          className={styles.prodMarker}
                          transition={
                            reduced ? instant : motionTokens.spring.smooth
                          }
                        >
                          <span className={styles.liveDot} aria-hidden="true" />
                          Production
                        </motion.span>
                      )}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className={styles.menuActions}>
          <button
            type="button"
            className={styles.menuAction}
            disabled={!picked || picked.id === openId}
            onClick={() => {
              setOpen(false);
              onCompare(picked.id);
            }}
          >
            <Columns2 aria-hidden="true" />
            Compare with {picked?.label}
          </button>
          <button
            type="button"
            className={styles.menuAction}
            disabled={!picked || picked.id === productionId}
            onClick={() => onPromote(picked.id)}
          >
            <ArrowUpFromLine aria-hidden="true" />
            Promote to production
          </button>
        </div>
        <div className={styles.menuStatus} role="status">
          <Swap
            id={promotion ? `p-${promotion.to}` : `s-${productionId}`}
            className={styles.menuStatusText}
          >
            {promotion ? (
              <Fragment>
                {versions.find((version) => version.id === promotion.to)?.label}{" "}
                is in production
              </Fragment>
            ) : (
              <Fragment>
                Production serves {serving?.label ?? "no version"}
              </Fragment>
            )}
          </Swap>
          <AnimatePresence initial={false}>
            {promotion && (
              <motion.span
                key="undo"
                className={styles.menuUndo}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: reduced ? instant : swapIn }}
                exit={{ opacity: 0, transition: reduced ? instant : swapOut }}
              >
                <Button variant="ghost" size="sm" onClick={onUndo}>
                  Undo
                </Button>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </PopoverContent>
    </PopoverPrimitive.Root>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Model chip + menu
 * -----------------------------------------------------------------------------------------------*/

function ModelMenu({
  models,
  modelId,
  effort,
  onModel,
  onEffort,
}: {
  models: PromptModel[];
  modelId: string;
  effort: PromptEffort;
  onModel: (id: string) => void;
  onEffort: (effort: PromptEffort) => void;
}) {
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const labelId = useId();
  const model =
    models.find((candidate) => candidate.id === modelId) ?? models[0];
  const activeIndex = Math.max(
    0,
    models.findIndex((candidate) => candidate.id === model.id),
  );
  const hasSample = models.some((candidate) => candidate.sample);

  return (
    <PopoverPrimitive.Root>
      <PopoverTrigger
        className={`${styles.chip} ${styles.modelChip}`}
        aria-label={`Model ${model.name}, ${effortLabel[effort]} effort. Change model`}
      >
        <Swap id={model.id} className={styles.modelSwap}>
          <ModelMark mark={model.mark} />
          <span className={styles.modelName}>{model.short}</span>
        </Swap>
        <Swap id={effort} className={styles.chipState}>
          {effortShort[effort]}
        </Swap>
        <ChevronDown className={styles.chevron} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        className={`${styles.menu} ${styles.modelMenu}`}
        align="end"
        aria-label="Model and effort"
      >
        <div className={styles.modelList} role="radiogroup" aria-label="Model">
          {models.map((candidate, index) => {
            const selected = index === activeIndex;
            return (
              <button
                key={candidate.id}
                ref={(node) => {
                  rows.current[index] = node;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                className={styles.modelRow}
                data-on={selected || undefined}
                onClick={() => onModel(candidate.id)}
                onKeyDown={(event) => {
                  const last = models.length - 1;
                  const next =
                    event.key === "ArrowDown"
                      ? index === last
                        ? 0
                        : index + 1
                      : event.key === "ArrowUp"
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
                  onModel(models[next].id);
                  rows.current[next]?.focus();
                }}
              >
                <ModelMark mark={candidate.mark} />
                <span className={styles.modelRowName}>{candidate.name}</span>
                <span
                  className={styles.modelPrice}
                  aria-label={`${formatPrice(candidate.input)} input, ${formatPrice(candidate.output)} output per million tokens${
                    candidate.sample ? ", sample price" : ""
                  }`}
                >
                  {formatPrice(candidate.input)}
                  {" · "}
                  {formatPrice(candidate.output)}
                </span>
                <Check
                  className={styles.modelCheck}
                  data-on={selected || undefined}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
        <div className={styles.effortRow}>
          <span id={labelId} className={styles.effortLabel}>
            Effort
          </span>
          <Segmented
            kind="segmented"
            label="Effort"
            value={effort}
            onChange={(next) => onEffort(next as PromptEffort)}
            className={styles.effortSeg}
            options={efforts.map((value) => ({
              value,
              label: effortShort[value],
            }))}
          />
        </div>
        <p className={styles.menuNote}>
          Input · output per 1M tokens.
          {hasSample ? " GPT and Gemini prices are samples." : ""}
        </p>
      </PopoverContent>
    </PopoverPrimitive.Root>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Diff
 * -----------------------------------------------------------------------------------------------*/

function inlineTokens(
  text: string,
  toneOf: (name: string) => number,
  keyPrefix: string,
) {
  return tokenize(text).map((token, index) =>
    token.type === "text" ? (
      <Fragment key={`${keyPrefix}-${index}`}>{token.text}</Fragment>
    ) : (
      <span
        key={`${keyPrefix}-${index}`}
        className={styles.varChip}
        data-tone={toneOf(token.name)}
        data-static=""
      >
        {token.name}
      </span>
    ),
  );
}

function Diff({
  ops,
  toneOf,
}: {
  ops: DiffOp[];
  toneOf: (name: string) => number;
}) {
  return (
    <div className={styles.diffText}>
      {ops.map((op, index) => {
        if (op.type === "same")
          return (
            <Fragment key={index}>
              {inlineTokens(op.text, toneOf, `s${index}`)}
            </Fragment>
          );
        const [, leading, core, trailing] = /^(\s*)([\s\S]*?)(\s*)$/.exec(
          op.text,
        ) ?? ["", "", op.text, ""];
        if (!core)
          return op.type === "add" ? (
            <Fragment key={index}>{op.text}</Fragment>
          ) : null;
        const tag = op.type === "add" ? "ins" : "del";
        const [, first, rest] = /^(\S+)([\s\S]*)$/.exec(core) ?? ["", core, ""];
        const Tag = tag;
        return (
          <Fragment key={index}>
            {leading}
            <Tag className={op.type === "add" ? styles.added : styles.removed}>
              <span className={styles.srOnly}>
                {op.type === "add" ? "Added: " : "Removed: "}
              </span>
              <span className={styles.diffLead}>
                <span className={styles.diffSign} aria-hidden="true">
                  {op.type === "add" ? "+" : "−"}
                </span>
                {inlineTokens(first, toneOf, `f${index}`)}
              </span>
              {inlineTokens(rest, toneOf, `r${index}`)}
            </Tag>
            {op.type === "add" ? trailing : null}
          </Fragment>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Run engine
 * -----------------------------------------------------------------------------------------------*/

type RunStatus = "thinking" | "streaming" | "done" | "error" | "stopped";

interface RunStats {
  ms: number;
  input: number;
  output: number;
  cost: string;
  seconds: string;
}

interface RunState {
  id: number;
  status: RunStatus;
  chunks: string[];
  caseLabel: string;
  model: PromptModel;
  effort: PromptEffort;
  simulated: boolean;
  stats?: RunStats;
  error?: string;
}

interface Simulation {
  reply: string;
  fail?: string;
  think: number;
  caseLabel: string;
}

/** Streaming cadence: a few words per frame, varied so it reads like a real model. */
const chunkPattern = [4, 5, 3, 6, 4, 3, 5];
const runFadeIn = { duration: motionTokens.duration.fast, ease: enterEase };
const runFadeOut = { duration: 0.1 };

function usePromptRun(handler: PromptRunHandler | undefined) {
  const [run, setRun] = useState<RunState | null>(null);
  const job = useRef<{
    abort: AbortController;
    frame: number;
    timer: number;
  } | null>(null);
  const sequence = useRef(0);
  const handlerRef = useRef(handler);
  useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  const cancel = useCallback(() => {
    const current = job.current;
    if (!current) return;
    current.abort.abort();
    cancelAnimationFrame(current.frame);
    window.clearTimeout(current.timer);
    job.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const start = useCallback(
    (request: PromptRunRequest, simulation: Simulation) => {
      cancel();
      const id = ++sequence.current;
      const current = { abort: new AbortController(), frame: 0, timer: 0 };
      job.current = current;
      const startedAt = performance.now();
      const onRun = handlerRef.current;
      const stream = { text: "", done: false, error: null as string | null };
      const patch = (update: (previous: RunState) => RunState) =>
        setRun((previous) =>
          previous && previous.id === id ? update(previous) : previous,
        );

      setRun({
        id,
        status: "thinking",
        chunks: [],
        caseLabel: simulation.caseLabel,
        model: request.model,
        effort: request.effort,
        simulated: !onRun,
      });

      if (onRun) {
        void (async () => {
          try {
            const result = await onRun(request, current.abort.signal);
            if (typeof result === "string") stream.text = result;
            else {
              for await (const piece of result) {
                if (current.abort.signal.aborted) return;
                stream.text += piece;
              }
            }
            stream.done = true;
          } catch (error) {
            if (!current.abort.signal.aborted) {
              stream.error =
                error instanceof Error && error.message
                  ? error.message
                  : "The run failed.";
            }
          }
        })();
      } else {
        current.timer = window.setTimeout(() => {
          if (simulation.fail) stream.error = simulation.fail;
          else stream.text = simulation.reply;
          stream.done = true;
        }, simulation.think);
      }

      let consumed = 0;
      let flushIndex = 0;
      let lastFlush = 0;

      const tick = (time: number) => {
        if (stream.error) {
          job.current = null;
          patch((previous) => ({
            ...previous,
            status: "error",
            error: stream.error ?? undefined,
          }));
          return;
        }
        if (time - lastFlush >= 40) {
          const words = stream.text
            .slice(consumed)
            .match(stream.done ? /\s*\S+(?:\s+|$)/g : /\s*\S+\s+/g);
          if (words?.length) {
            const count = Math.min(
              8,
              chunkPattern[flushIndex % chunkPattern.length] +
                Math.floor(words.length / 30),
            );
            const piece = words.slice(0, count).join("");
            consumed += piece.length;
            flushIndex += 1;
            lastFlush = time;
            patch((previous) => ({
              ...previous,
              status: "streaming",
              chunks: [...previous.chunks, piece],
            }));
          }
        }
        if (stream.done && consumed >= stream.text.trimEnd().length) {
          job.current = null;
          const ms = time - startedAt;
          const input = estimateTokens(
            `${request.rendered.system}\n${request.rendered.user}`,
          );
          const output = estimateTokens(stream.text);
          const price =
            (input * request.model.input + output * request.model.output) / 1e6;
          const cost =
            price <= 0
              ? "$0.00"
              : price < 1e-4
                ? "<$0.0001"
                : `$${price < 0.1 ? price.toFixed(4) : price.toFixed(3)}`;
          patch((previous) => ({
            ...previous,
            status: "done",
            stats: {
              ms,
              input,
              output,
              cost,
              seconds: `${(ms / 1e3).toFixed(2)} s`,
            },
          }));
          return;
        }
        current.frame = requestAnimationFrame(tick);
      };
      current.frame = requestAnimationFrame(tick);
    },
    [cancel],
  );

  const stop = useCallback(() => {
    if (!job.current) return;
    cancel();
    setRun((previous) =>
      previous &&
      (previous.status === "thinking" || previous.status === "streaming")
        ? { ...previous, status: "stopped" }
        : previous,
    );
  }, [cancel]);

  const running = run?.status === "thinking" || run?.status === "streaming";
  return { run, start, stop, running };
}

/* -------------------------------------------------------------------------------------------------
 * Output panel
 * -----------------------------------------------------------------------------------------------*/

function RunStatusLabel({ run }: { run: RunState }) {
  const text =
    run.status === "thinking"
      ? "Thinking"
      : run.status === "streaming"
        ? "Writing"
        : run.status === "done"
          ? "Reply"
          : run.status === "stopped"
            ? "Stopped"
            : "Run failed";
  const icon =
    run.status === "done" ? (
      <Check aria-hidden="true" />
    ) : run.status === "stopped" ? (
      <Square aria-hidden="true" />
    ) : run.status === "error" ? (
      <TriangleAlert aria-hidden="true" />
    ) : null;
  const working = run.status === "thinking" || run.status === "streaming";
  return (
    <Swap id={run.status} className={styles.outputStatus}>
      <span className={styles.outputStatusInner} data-status={run.status}>
        {icon}
        <span className={working ? styles.shimmer : undefined}>{text}</span>
        <span className={styles.outputCase}>{run.caseLabel}</span>
      </span>
    </Swap>
  );
}

function OutputPanel({
  run,
  idleHint,
  onRetry,
  lockHeight,
  bodyRef,
}: {
  run: RunState | null;
  idleHint: ReactNode;
  onRetry: () => void;
  lockHeight: number | null;
  bodyRef: React.RefObject<HTMLDivElement | null>;
}) {
  const reduced = !!useReducedMotion();
  const body = run ? run.chunks.join("") : "";
  const foot = run
    ? run.status === "error"
      ? `${run.simulated ? "Simulated error" : "Error"} · ${run.model.name}`
      : run.stats
        ? [
            run.simulated ? "Simulated" : null,
            run.stats.seconds,
            `${run.stats.input + run.stats.output} tokens`,
            run.stats.cost,
          ]
            .filter(Boolean)
            .join(" · ")
        : `${run.simulated ? "Simulated · " : ""}${run.model.name} · ${effortLabel[run.effort]} effort`
    : null;

  const paragraphs: { key: number; items: { key: string; text: string }[] }[] =
    [];
  if (run) {
    const groups: { key: string; text: string }[][] = [[]];
    run.chunks.forEach((chunk, chunkIndex) => {
      chunk.split(/\n{2,}/).forEach((piece, pieceIndex) => {
        if (pieceIndex > 0) groups.push([]);
        if (piece)
          groups[groups.length - 1].push({
            key: `${chunkIndex}-${pieceIndex}`,
            text: piece,
          });
      });
    });
    groups
      .map((items, index) => ({ key: index, items }))
      .filter((group) => group.items.length)
      .forEach((group) => paragraphs.push(group));
  }

  return (
    <AutoHeight armKey={run ? "run" : "idle"} className={styles.outputFrame}>
      <div className={styles.output} data-state={run?.status ?? "idle"}>
        {run ? (
          <Fragment>
            <div className={styles.outputHead}>
              <RunStatusLabel run={run} />
              <span
                className={styles.outputCopy}
                data-on={
                  (run.status === "done" || run.status === "stopped") && body
                    ? ""
                    : undefined
                }
              >
                <CopyButton
                  value={body.trim()}
                  label="Copy reply"
                  iconOnly
                  variant="plain"
                  disabled={
                    (run.status !== "done" && run.status !== "stopped") || !body
                  }
                />
              </span>
            </div>
            <div
              ref={bodyRef}
              className={styles.outputBody}
              style={lockHeight ? { minHeight: lockHeight } : undefined}
            >
              <AnimatePresence initial={false}>
                <motion.div
                  key={run.id}
                  className={styles.outputRun}
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 1,
                    transition: reduced ? instant : runFadeIn,
                  }}
                  exit={{
                    opacity: 0,
                    transition: reduced ? instant : runFadeOut,
                  }}
                >
                  {run.status === "error" ? (
                    <div className={styles.errorBox} role="alert">
                      <p className={styles.errorText}>{run.error}</p>
                      <Button variant="secondary" size="sm" onClick={onRetry}>
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <div
                      className={styles.reply}
                      aria-busy={
                        run.status === "thinking" ||
                        run.status === "streaming" ||
                        undefined
                      }
                    >
                      {paragraphs.map((paragraph) => (
                        <p
                          key={paragraph.key}
                          className={styles.replyParagraph}
                        >
                          {paragraph.items.map((item) => (
                            <span
                              key={item.key}
                              className={reduced ? undefined : styles.chunk}
                            >
                              {item.text}
                            </span>
                          ))}
                        </p>
                      ))}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className={styles.outputFoot}>
              <Swap id={foot ?? ""} className={styles.outputFootText}>
                {foot}
              </Swap>
            </div>
          </Fragment>
        ) : (
          <div className={styles.outputIdle}>{idleHint}</div>
        )}
      </div>
    </AutoHeight>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Simulated replies
 * -----------------------------------------------------------------------------------------------*/

function simulatedReply(
  testCaseId: string,
  values: Record<string, string>,
): string {
  const firstName =
    (values.customer_name ?? "").trim().split(/\s+/)[0] || "there";
  const order = values.order_id?.trim() || "your order";
  switch (testCaseId) {
    case "damaged":
      return `Hi ${firstName},

I'm sorry your order arrived damaged. That's not how anything from Fernwood should reach you. I've set up a free replacement for order ${order}, and it ships as soon as the carrier collects it.

There's no need to send the damaged item back. If you'd rather have a refund instead, reply to this email and I'll switch it over today.

Fernwood Support`;
    case "window":
      return `Hi ${firstName},

Thanks for getting in touch about order ${order}. Our policy accepts returns within 30 days of delivery, and this order arrived in August, so it falls outside the standard window.

I don't want to leave you without options, so I've asked a team lead to review your request. You'll hear back from them within one business day.

Fernwood Support`;
    default:
      return `Hi ${firstName},

Thanks for flagging this, and I'm sorry the wait has dragged on. I checked order ${order}: it left our warehouse on time, but the carrier hasn't posted a scan since Tuesday. I've opened a trace and will email you as soon as they confirm where it is.

Because the order is now more than 5 business days late, I've refunded your shipping fee. It should reach your card within 3 to 5 days.

Fernwood Support`;
  }
}

/* -------------------------------------------------------------------------------------------------
 * Prompt studio
 * -----------------------------------------------------------------------------------------------*/

export function PromptStudio({
  name = "Support reply",
  versions,
  versionId,
  productionId,
  template,
  variables,
  testCases = sampleCases,
  models = studioModels,
  defaultModel = "claude-sonnet-5-5",
  defaultEffort,
  now,
  onRun,
  onPromote,
  onTemplateChange,
  className,
}: PromptStudioProps) {
  const baseId = useId();
  const reduced = !!useReducedMotion();
  const platform = usePlatform();

  const allVersions = versions ?? sampleVersions;
  const openId = versionId ?? allVersions[0]?.id ?? "";
  const openVersion =
    allVersions.find((version) => version.id === openId) ?? allVersions[0];

  const [mountedAt] = useState(() => Date.now());
  const referenceTime =
    now !== undefined
      ? new Date(now).getTime()
      : versions
        ? mountedAt
        : Date.parse("2026-10-20T12:00:00Z");

  const [draft, setDraft] = useState<PromptTemplate>(
    () =>
      template ?? {
        system: openVersion?.system ?? "",
        user: openVersion?.user ?? "",
      },
  );
  const [part, setPart] = useState<"system" | "user">("system");

  const usedVariables = useMemo(
    () => collectVariables(draft.system, draft.user),
    [draft],
  );
  const orderedVariables = useMemo(
    () =>
      variables ??
      (versions
        ? collectVariables(openVersion?.system ?? "", openVersion?.user ?? "")
        : defaultVariables),
    [variables, versions, openVersion],
  );
  const allVariables = useMemo(
    () => [...new Set([...orderedVariables, ...usedVariables])],
    [orderedVariables, usedVariables],
  );
  const toneOf = useCallback(
    (variable: string) => {
      const index = allVariables.indexOf(variable);
      return ((index < 0 ? allVariables.length : index) % 4) + 1;
    },
    [allVariables],
  );

  const [caseId, setCaseId] = useState(testCases[0]?.id ?? "");
  const activeCase =
    testCases.find((testCase) => testCase.id === caseId) ?? testCases[0];
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...testCases[0]?.values,
  }));
  const [activeVariable, setActiveVariable] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ name: string; at: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const flashSequence = useRef(0);

  const missing = allVariables.filter((variable) => !values[variable]?.trim());
  const wideVariables = useMemo(
    () =>
      new Set(
        allVariables.filter((variable) =>
          testCases.some(
            (testCase) => (testCase.values[variable] ?? "").length > 30,
          ),
        ),
      ),
    [allVariables, testCases],
  );

  const [modelId, setModelId] = useState(
    () =>
      models.find((model) => model.id === defaultModel)?.id ??
      models[0]?.id ??
      "",
  );
  const model =
    models.find((candidate) => candidate.id === modelId) ?? models[0];
  const [effort, setEffort] = useState<PromptEffort>(
    () => defaultEffort ?? model?.defaultEffort ?? "medium",
  );
  const [production, setProduction] = useState<string | null>(() =>
    productionId !== undefined ? productionId : openId,
  );
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const compareVersion =
    allVersions.find((version) => version.id === compareId) ?? null;

  const exitCompare = useCallback(() => {
    setCompareId(null);
    setAnnouncement("Back to editing");
  }, []);

  const diff = useMemo(
    () =>
      compareVersion
        ? {
            system: diffWords(compareVersion.system, draft.system),
            user: diffWords(compareVersion.user, draft.user),
          }
        : null,
    [compareVersion, draft],
  );

  const diffCounts = useMemo(() => {
    if (!diff) return null;
    const count = (type: DiffOp["type"]) =>
      diff[part]
        .filter((op) => op.type === type)
        .reduce(
          (total, op) =>
            total + (op.text.trim() ? op.text.trim().split(/\s+/).length : 0),
          0,
        );
    return { added: count("add"), removed: count("remove") };
  }, [diff, part]);

  const changed = diff
    ? {
        system: diff.system.some((op) => op.type !== "same"),
        user: diff.user.some((op) => op.type !== "same"),
      }
    : null;

  const { run, start, stop, running } = usePromptRun(onRun);

  const bodyRef = useRef<HTMLDivElement>(null);
  const [lockHeight, setLockHeight] = useState<number | null>(null);
  const firedOverload = useRef(false);

  const handleRun = useCallback(() => {
    if (running || !model || !activeCase) return;
    const rendered = {
      system: applyValues(draft.system, values),
      user: applyValues(draft.user, values),
    };
    setLockHeight(bodyRef.current?.offsetHeight ?? null);
    // The first simulated run of the "Past window" case fails, so the retry path is reachable without a provider.
    const failure =
      onRun || activeCase.id !== "window" || firedOverload.current
        ? undefined
        : `${model.name} is overloaded right now (529). Nothing was billed, so it is safe to retry.`;
    if (failure) firedOverload.current = true;
    start(
      {
        template: draft,
        rendered,
        values,
        model,
        effort,
        testCaseId: activeCase.id,
        versionId: openId,
      },
      {
        reply: simulatedReply(activeCase.id, values),
        fail: failure,
        think: thinkMs[effort],
        caseLabel: activeCase.label,
      },
    );
    setAnnouncement(
      `Running ${activeCase.label} on ${model.name}${onRun ? "" : ", simulated"}`,
    );
  }, [running, model, activeCase, draft, values, onRun, start, effort, openId]);

  const [lastStatus, setLastStatus] = useState<RunStatus | undefined>(
    run?.status,
  );
  if (run?.status !== lastStatus) {
    setLastStatus(run?.status);
    if (run && run.status !== "thinking" && run.status !== "streaming") {
      setLockHeight(null);
      setAnnouncement(
        run.status === "done"
          ? `Reply ready${run.simulated ? ", simulated" : ""}, ${run.stats?.seconds}, ${
              run.stats ? run.stats.input + run.stats.output : 0
            } tokens, ${run.stats?.cost}`
          : run.status === "error"
            ? `Run failed. ${run.error}`
            : "Run stopped",
      );
    }
  }

  const tokenEstimate = estimateTokens(applyValues(draft[part], values));
  const idOf = (suffix: string) => `${baseId}-${suffix}`;

  const onCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented) return;
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleRun();
      return;
    }
    if (
      event.key === "Escape" &&
      compareId &&
      event.currentTarget.contains(event.target as Node)
    ) {
      event.preventDefault();
      exitCompare();
    }
  };

  const tabOptions: SegmentOption[] = [
    {
      value: "system",
      id: idOf("tab-system"),
      panel: idOf("system"),
      label: (
        <Fragment>
          System
          {changed?.system ? (
            <Fragment>
              <span className={styles.tabDot} aria-hidden="true" />
              <span className={styles.srOnly}>, changed</span>
            </Fragment>
          ) : null}
        </Fragment>
      ),
    },
    {
      value: "user",
      id: idOf("tab-user"),
      panel: idOf("user"),
      label: (
        <Fragment>
          User
          {changed?.user ? (
            <Fragment>
              <span className={styles.tabDot} aria-hidden="true" />
              <span className={styles.srOnly}>, changed</span>
            </Fragment>
          ) : null}
        </Fragment>
      ),
    },
  ];

  const cornerMotion = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: reduced ? instant : runFadeIn },
    exit: { opacity: 0, transition: reduced ? instant : runFadeOut },
  };

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")}>
      <section
        className={styles.card}
        aria-label={`${name} prompt`}
        onKeyDown={onCardKeyDown}
      >
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <h2 className={styles.title}>{name}</h2>
            <VersionMenu
              versions={allVersions}
              openId={openId}
              productionId={production}
              now={referenceTime}
              promotion={promotion}
              onCompare={(id) => {
                setCompareId(id);
                setAnnouncement(
                  `Comparing ${allVersions.find((version) => version.id === id)?.label} with ${openVersion?.label}`,
                );
              }}
              onPromote={(id) => {
                setProduction(id);
                setPromotion({ from: production, to: id });
                onPromote?.(id, production);
                setAnnouncement(
                  `${allVersions.find((version) => version.id === id)?.label} promoted to production. Undo is available.`,
                );
              }}
              onUndo={() => {
                if (!promotion) return;
                setProduction(promotion.from);
                onPromote?.(promotion.from ?? "", promotion.to);
                setAnnouncement(
                  `Promotion undone. Production serves ${
                    allVersions.find((version) => version.id === promotion.from)
                      ?.label ?? "no version"
                  }.`,
                );
                setPromotion(null);
              }}
            />
          </div>
          <ModelMenu
            models={models}
            modelId={modelId}
            effort={effort}
            onModel={(id) => {
              const next = models.find((candidate) => candidate.id === id);
              if (!next || id === modelId) return;
              setModelId(id);
              setEffort(next.defaultEffort);
              setAnnouncement(
                `${next.name} selected, ${next.defaultEffort} effort`,
              );
            }}
            onEffort={(next) => {
              setEffort(next);
              setAnnouncement(`${next} effort`);
            }}
          />
        </header>

        <div className={styles.editor}>
          <div className={styles.editorBar}>
            <Segmented
              kind="tabs"
              label="Prompt part"
              value={part}
              onChange={(next) => setPart(next as "system" | "user")}
              options={tabOptions}
            />
            <div className={styles.corner}>
              <AnimatePresence initial={false}>
                {compareVersion && diffCounts ? (
                  <motion.div
                    key="compare"
                    {...cornerMotion}
                    className={styles.cornerItem}
                  >
                    <span className={styles.diffStats}>
                      <span className={styles.statAdd}>
                        <span aria-hidden="true">+</span>
                        {diffCounts.added}
                        <span className={styles.srOnly}> words added</span>
                      </span>
                      <span className={styles.statRemove}>
                        <span aria-hidden="true">−</span>
                        {diffCounts.removed}
                        <span className={styles.srOnly}> words removed</span>
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={styles.backButton}
                      onClick={exitCompare}
                    >
                      Back to editing
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="tokens"
                    {...cornerMotion}
                    className={styles.cornerItem}
                  >
                    <span className={styles.tokens}>
                      <Roll value={tokenEstimate} />
                      <span>tokens</span>
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <AutoHeight armKey={compareId ?? "edit"} sticky={false}>
            <div className={styles.editorStack}>
              {(["system", "user"] as const).map((which) => {
                const hidden = part !== which || !!compareVersion;
                return (
                  <div
                    key={which}
                    id={idOf(which)}
                    role="tabpanel"
                    aria-labelledby={idOf(`tab-${which}`)}
                    className={styles.pane}
                    data-hidden={hidden || undefined}
                    inert={hidden}
                  >
                    <PromptEditor
                      value={draft[which]}
                      onChange={(next) => {
                        const updated = { ...draft, [which]: next };
                        setDraft(updated);
                        onTemplateChange?.(updated);
                      }}
                      variables={allVariables}
                      toneOf={toneOf}
                      missing={missing}
                      activeVariable={activeVariable}
                      flash={flash}
                      inert={hidden}
                      onChipClick={(variable) =>
                        document
                          .getElementById(idOf(`field-${variable}`))
                          ?.focus()
                      }
                      onSubmit={handleRun}
                      label={`${which === "system" ? "System" : "User"} prompt`}
                      describedBy={idOf("hint")}
                      placeholder={
                        which === "system"
                          ? "Describe how the model should behave"
                          : "Write the message, with {{variables}}"
                      }
                    />
                  </div>
                );
              })}
              <AnimatePresence initial={false}>
                {compareVersion && diff && (
                  <motion.div
                    key={`diff-${compareVersion.id}`}
                    {...cornerMotion}
                    className={styles.diffPane}
                    role="region"
                    aria-label={`Changes from ${compareVersion.label} to ${openVersion?.label}, ${part} prompt`}
                  >
                    <Diff ops={diff[part]} toneOf={toneOf} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </AutoHeight>

          <div className={styles.hint} id={idOf("hint")}>
            <Swap
              id={compareVersion ? `c-${compareVersion.id}` : "edit"}
              className={styles.hintSwap}
            >
              {compareVersion ? (
                <Fragment>
                  <span className={styles.hintVersions}>
                    {compareVersion.label} to {openVersion?.label}
                  </span>
                  <span className={styles.legendAdd}>+ added</span>
                  <span className={styles.legendRemove}>− removed</span>
                </Fragment>
              ) : (
                <Fragment>
                  Type <span className={styles.hintKey}>{"{{"}</span> to add a
                  variable
                </Fragment>
              )}
            </Swap>
          </div>
        </div>

        <div className={styles.vars}>
          <AutoHeight armKey={allVariables.join(",")} sticky={false}>
            <div className={styles.fields}>
              {allVariables.map((variable) => {
                const inPrompt = usedVariables.includes(variable);
                return (
                  <label
                    key={variable}
                    className={styles.field}
                    data-tone={toneOf(variable)}
                    data-wide={wideVariables.has(variable) || undefined}
                    data-unused={!inPrompt || undefined}
                  >
                    <span className={styles.fieldLabel}>
                      <span className={styles.fieldDot} aria-hidden="true" />
                      {variable}
                    </span>
                    <input
                      id={idOf(`field-${variable}`)}
                      className={styles.input}
                      value={values[variable] ?? ""}
                      spellCheck={false}
                      autoComplete="off"
                      placeholder={inPrompt ? "Empty" : "Not in the prompt"}
                      aria-describedby={inPrompt ? undefined : idOf("hint")}
                      onChange={(event) => {
                        const next = event.target.value;
                        setValues((previous) => ({
                          ...previous,
                          [variable]: next,
                        }));
                        flashSequence.current += 1;
                        setFlash({ name: variable, at: flashSequence.current });
                      }}
                      onFocus={() => setActiveVariable(variable)}
                      onBlur={() =>
                        setActiveVariable((previous) =>
                          previous === variable ? null : previous,
                        )
                      }
                    />
                  </label>
                );
              })}
            </div>
          </AutoHeight>
          <div className={styles.runRow}>
            <Segmented
              kind="segmented"
              label="Test case"
              value={caseId}
              onChange={(id) => {
                const next = testCases.find((testCase) => testCase.id === id);
                if (!next) return;
                setCaseId(id);
                setValues({ ...next.values });
                setAnnouncement(`${next.label} test case loaded`);
              }}
              className={styles.cases}
              options={testCases.map((testCase) => ({
                value: testCase.id,
                label: testCase.label,
              }))}
            />
            <button
              type="button"
              className={styles.run}
              onClick={running ? stop : handleRun}
              aria-label={running ? "Stop run" : "Run prompt"}
              aria-keyshortcuts="Meta+Enter Control+Enter"
            >
              <span className={styles.runIcon} aria-hidden="true">
                <Play data-on={!running || undefined} />
                <Square data-on={running || undefined} />
              </span>
              <span className={styles.runLabel} aria-hidden="true">
                <span data-on={!running || undefined}>Run</span>
                <span data-on={running || undefined}>Stop</span>
              </span>
              <span className={styles.runKeys} aria-hidden="true">
                {platform === "pc" ? "Ctrl ↵" : "⌘↵"}
              </span>
            </button>
          </div>
        </div>

        <OutputPanel
          run={run}
          bodyRef={bodyRef}
          lockHeight={lockHeight}
          onRetry={handleRun}
          idleHint={
            <span>
              Run <span className={styles.idleCase}>{activeCase?.label}</span>{" "}
              to see the reply here
              {onRun ? "" : ". Runs are simulated"}.
            </span>
          }
        />
      </section>
      <div className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}

export default PromptStudio;
