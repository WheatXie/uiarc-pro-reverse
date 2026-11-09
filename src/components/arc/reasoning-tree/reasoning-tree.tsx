"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CircleCheck, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import Button from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import Tooltip from "../tooltip/tooltip";
import { motionTokens } from "../motion-tokens";
import styles from "./reasoning-tree.module.css";

export interface ReasoningThought {
  id?: string;
  label: string;
  text?: string;
  score?: number;
  children?: ReasoningThought[];
}

export interface ReasoningModel {
  name: string;
  mark?: ReactNode;
}

export interface ReasoningTreeAnswer {
  answer: ReasoningThought;
  path: ReasoningThought[];
  beamWidth: number;
}

export interface ReasoningTreeProps {
  question?: string;
  questionDetail?: string;
  thoughts?: ReasoningThought[];
  beamWidth?: number;
  defaultBeamWidth?: number;
  onBeamWidthChange?: (beamWidth: number) => void;
  seed?: number;
  autoPlay?: boolean;
  loop?: boolean;
  speed?: number;
  controls?: boolean;
  model?: ReasoningModel | null;
  title?: string;
  accent?: string;
  onAnswer?: (result: ReasoningTreeAnswer) => void;
  className?: string;
  style?: CSSProperties;
}

type Phase = "question" | "propose" | "score" | "prune" | "answer";
type NodeStatus = "root" | "hidden" | "candidate" | "kept" | "pruned" | "answer";

interface TreeNode {
  id: string;
  label: string;
  text: string;
  score: number;
  depth: number;
  order: number;
  parent: TreeNode | null;
  children: TreeNode[];
}

interface NodeState {
  status: NodeStatus;
  shown: boolean;
  scored: boolean;
  onPath: boolean;
}

interface SearchLevel {
  depth: number;
  candidates: TreeNode[];
  kept: TreeNode[];
}

interface Search {
  beam: number;
  levels: SearchLevel[];
  answer: TreeNode | null;
  path: TreeNode[];
  finalStep: number;
  candidateIds: Set<string>;
  keptIds: Set<string>;
  pathIds: Set<string>;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Column {
  x: number;
  w: number;
  depth: number;
}

interface Layout {
  mode: "wide" | "narrow";
  width: number;
  height: number;
  boxes: Map<string, Box>;
  columns: Column[];
}

interface Velocity {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface StatusPill {
  key: string;
  text: string;
  icon: "done" | "paused" | null;
  active: boolean;
}

const DEFAULT_QUESTION = "Which release plan ships by Friday?";
const DEFAULT_DETAIL = "Which release plan gets v2.4 out by Friday, October 23, without putting the billing migration at risk?";

const SAMPLE_THOUGHTS: ReasoningThought[] = [
  {
    id: "scope",
    label: "Cut scope to core",
    score: 0.82,
    text: "Ship the billing fixes and the new onboarding, and move CSV export to v2.5.",
    children: [
      {
        id: "freeze",
        label: "Freeze Wednesday",
        score: 0.86,
        text: "Freeze the release branch Wednesday at 18:00 and give QA all of Thursday.",
        children: [
          {
            id: "thursday",
            label: "Ship Thursday",
            score: 0.9,
            text: "Tag v2.4 Thursday at 14:00 and keep Friday free for hotfixes.",
          },
          {
            id: "friday-am",
            label: "Ship Friday 09:00",
            score: 0.71,
            text: "Tag v2.4 Friday at 09:00 after one more QA pass, with no buffer left.",
          },
        ],
      },
      {
        id: "skip-qa",
        label: "Skip manual QA",
        score: 0.31,
        text: "Skip manual QA and rely on the automated suite, which covers about 70% of billing.",
        children: [
          {
            id: "wednesday",
            label: "Ship Wednesday",
            score: 0.27,
            text: "Tag v2.4 Wednesday night and watch error rates through Thursday.",
          },
          {
            id: "patch",
            label: "Patch forward",
            score: 0.22,
            text: "Ship Thursday and patch anything manual QA would have caught next week.",
          },
        ],
      },
    ],
  },
  {
    id: "staff",
    label: "Add two engineers",
    score: 0.38,
    text: "Borrow two engineers from the mobile team to finish every planned feature on time.",
    children: [
      {
        id: "onboard",
        label: "Onboard on Monday",
        score: 0.34,
        text: "Spend Monday walking the two engineers through the billing code before they pick up tickets.",
        children: [
          {
            id: "friday-pm",
            label: "Ship Friday 17:00",
            score: 0.3,
            text: "Ship Friday at 17:00 once the new engineers have closed their tickets.",
          },
          {
            id: "monday",
            label: "Slip to Monday",
            score: 0.41,
            text: "Accept a Monday release so onboarding does not squeeze QA.",
          },
        ],
      },
      {
        id: "pair",
        label: "Pair on CSV export",
        score: 0.49,
        text: "Pair the new engineers on CSV export while the core team finishes the rest.",
        children: [
          {
            id: "export-thu",
            label: "Export by Thursday",
            score: 0.52,
            text: "Merge CSV export Thursday and ship everything Friday at noon.",
          },
          {
            id: "drop-export",
            label: "Drop export if late",
            score: 0.58,
            text: "Ship Friday and drop CSV export if the pair has not merged it by Thursday.",
          },
        ],
      },
    ],
  },
  {
    id: "flags",
    label: "Flag risky features",
    score: 0.74,
    text: "Ship everything, but keep CSV export and the new editor behind feature flags.",
    children: [
      {
        id: "flags-off",
        label: "Flags off in prod",
        score: 0.66,
        text: "Merge both features with their flags off in production and on in staging.",
        children: [
          {
            id: "next-week",
            label: "Flags on next week",
            score: 0.76,
            text: "Ship Thursday with both flags off and turn them on next week.",
          },
          {
            id: "staff-first",
            label: "Staff only first",
            score: 0.81,
            text: "Ship Thursday and turn both flags on for internal workspaces only.",
          },
        ],
      },
      {
        id: "rollout",
        label: "Stage the rollout",
        score: 0.79,
        text: "Turn the flags on for 10% of workspaces Thursday and for everyone Friday morning.",
        children: [
          {
            id: "ramp",
            label: "10% first, all Friday",
            score: 0.94,
            text: "Ship Thursday with the flags on for 10% of workspaces, then turn them on for everyone Friday at 10:00 if error rates hold.",
          },
          {
            id: "rollback",
            label: "Roll back on errors",
            score: 0.87,
            text: "Ship Thursday at 10% and roll the flags back automatically if checkout errors rise above 0.5%.",
          },
        ],
      },
    ],
  },
];

const CLAUDE_MARK = (
  <svg viewBox="0 0 24 24" fill="#D97757" aria-hidden="true" focusable="false">
    <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
  </svg>
);

const DEFAULT_MODEL: ReasoningModel = { name: "Claude Opus 5.5", mark: CLAUDE_MARK };

const PHASE_DURATION: Record<Phase, number> = {
  question: 560,
  propose: 620,
  score: 880,
  prune: 760,
  answer: 4200,
};

const BEAMS = [1, 2, 3];
const MAX_DEPTH = 3;
const SPRING_STIFFNESS = 225;
const SPRING_DAMPING = 30;

const subscribeIdle = () => () => {};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number) {
  return Math.round(10 * value) / 10;
}

function scoreOrder(a: TreeNode, b: TreeNode) {
  return b.score - a.score || a.order - b.order;
}

function byOrder(a: TreeNode, b: TreeNode) {
  return a.order - b.order;
}

function normalizeBeam(value: number) {
  return Math.min(MAX_DEPTH, Math.max(1, Math.round(value) || 1));
}

function countThoughts(count: number) {
  return `${count} thought${count === 1 ? "" : "s"}`;
}

function hashUnit(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x1000193);
  }
  return hash >>> 0;
}

function derivedScore(seed: number, key: string, label: string) {
  let value = (hashUnit(`${seed}:${key}:${label}`) + 0x6d2b79f5) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 1 | value);
  value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
  const unit = ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  return Math.round((0.18 + 0.76 * unit) * 100) / 100;
}

function toThought(node: TreeNode): ReasoningThought {
  return { id: node.id, label: node.label, text: node.text, score: node.score };
}

function describePhase(search: Search, step: number): { phase: Phase; depth: number } {
  if (step <= 0 || !search.levels.length) return { phase: step > 0 ? "answer" : "question", depth: 0 };
  if (step >= search.finalStep) return { phase: "answer", depth: search.levels.length };
  const depth = Math.floor((step - 1) / 3) + 1;
  const offset = (step - 1) % 3;
  return { phase: offset === 0 ? "propose" : offset === 1 ? "score" : "prune", depth };
}

function describeNode(node: TreeNode, state: NodeState) {
  if (node.depth === 0) return "Question";
  if (!state.scored) return "Not scored yet";
  const word =
    state.status === "answer"
      ? "Answer"
      : state.status === "kept"
        ? state.onPath
          ? "On the best path"
          : "Kept"
        : state.status === "pruned"
          ? "Pruned"
          : "Scored";
  return `Score ${node.score.toFixed(2)} · ${word}`;
}

function describeAnnouncement(search: Search, step: number) {
  const { phase, depth } = describePhase(search, step);
  const level = search.levels[depth - 1];
  if (phase === "question") return "Ready. Play or step to start the search.";
  if (phase === "answer")
    return search.answer
      ? `Answer found with a score of ${search.answer.score.toFixed(2)}: ${search.answer.text}`
      : "There are no thoughts to search.";
  if (!level) return "";
  const best = [...level.candidates].sort(scoreOrder)[0];
  if (phase === "propose") return `Depth ${depth}: proposed ${countThoughts(level.candidates.length)}.`;
  if (phase === "score")
    return `Depth ${depth}: scored ${countThoughts(level.candidates.length)}. Best is ${best.label}, ${best.score.toFixed(2)}.`;
  return `Depth ${depth}: kept ${level.kept.length} of ${level.candidates.length}, pruned ${level.candidates.length - level.kept.length}.`;
}

function computeStatus(search: Search, step: number, playing: boolean): StatusPill {
  const { phase, depth } = describePhase(search, step);
  const level = search.levels[depth - 1];
  const candidates = level?.candidates.length ?? 0;
  const kept = level?.kept.length ?? 0;
  const icon: "done" | "paused" | null = playing ? null : "paused";
  if (phase === "answer")
    return { key: "answer", text: search.answer ? "Answer found" : "Nothing to search", icon: "done", active: false };
  if (phase === "question")
    return playing
      ? { key: "q", text: "Reading the question", icon: null, active: true }
      : { key: "ready", text: "Ready", icon: null, active: false };
  if (phase === "propose")
    return { key: `${step}-${playing}`, text: `${playing ? "Proposing" : "Proposed"} ${countThoughts(candidates)}`, icon, active: playing };
  if (phase === "score")
    return { key: `${step}-${playing}`, text: `${playing ? "Scoring" : "Scored"} ${countThoughts(candidates)}`, icon, active: playing };
  return {
    key: `${step}-${playing}`,
    text: `${playing ? "Keeping" : "Kept"} the best ${kept === 1 ? "one" : kept}`,
    icon,
    active: playing,
  };
}

function buildTree(question: string, detail: string, thoughts: ReasoningThought[], seed: number) {
  let order = 0;
  const seen = new Set<string>();
  const all: TreeNode[] = [];
  const root: TreeNode = {
    id: "root",
    label: question,
    text: detail,
    score: 1,
    depth: 0,
    order: order++,
    parent: null,
    children: [],
  };
  seen.add(root.id);
  all.push(root);

  const walk = (items: ReasoningThought[], parent: TreeNode, key: string) => {
    if (parent.depth >= MAX_DEPTH) return;
    items.forEach((item, index) => {
      const pathKey = `${key}${index}`;
      let id = item.id ?? `t${pathKey}`;
      while (seen.has(id)) id = `${id}-${pathKey}`;
      seen.add(id);
      const raw = item.score ?? derivedScore(seed, pathKey, item.label);
      const node: TreeNode = {
        id,
        label: item.label,
        text: item.text ?? item.label,
        score: Math.round(100 * Math.min(0.99, Math.max(0, raw))) / 100,
        depth: parent.depth + 1,
        order: order++,
        parent,
        children: [],
      };
      parent.children.push(node);
      all.push(node);
      if (item.children?.length) walk(item.children, node, `${pathKey}.`);
    });
  };

  walk(thoughts, root, "");
  return { root, all };
}

function buildSearch(root: TreeNode, beam: number): Search {
  const levels: SearchLevel[] = [];
  let frontier = [root];
  for (let depth = 1; depth <= MAX_DEPTH; depth += 1) {
    const candidates = frontier.flatMap(node => node.children).sort(byOrder);
    if (!candidates.length) break;
    const hasDeeper = candidates.some(node => node.children.length > 0);
    const isLast = depth === MAX_DEPTH || !hasDeeper;
    const kept = [...candidates]
      .sort(scoreOrder)
      .slice(0, isLast ? 1 : beam)
      .sort(byOrder);
    levels.push({ depth, candidates, kept });
    frontier = kept;
    if (isLast) break;
  }
  const answer = levels.length ? (levels[levels.length - 1].kept[0] ?? null) : null;
  const path: TreeNode[] = [];
  for (let node: TreeNode | null = answer; node; node = node.parent) path.unshift(node);
  return {
    beam,
    levels,
    answer,
    path,
    finalStep: 3 * levels.length,
    candidateIds: new Set(levels.flatMap(level => level.candidates.map(node => node.id))),
    keptIds: new Set(levels.flatMap(level => level.kept.map(node => node.id))),
    pathIds: new Set(path.map(node => node.id)),
  };
}

function stateFor(search: Search, node: TreeNode, step: number): NodeState {
  const final = step >= search.finalStep && !!search.answer;
  if (node.depth === 0) return { status: "root", shown: true, scored: false, onPath: final };
  if (!search.candidateIds.has(node.id) || step < 3 * (node.depth - 1) + 1)
    return { status: "hidden", shown: false, scored: false, onPath: false };
  const scored = step >= 3 * (node.depth - 1) + 2;
  const settled = step >= 3 * node.depth;
  const kept = search.keptIds.has(node.id);
  const onPath = final && search.pathIds.has(node.id);
  const status: NodeStatus = settled
    ? kept
      ? final && node === search.answer
        ? "answer"
        : "kept"
      : "pruned"
    : "candidate";
  return { status, shown: true, scored, onPath };
}

function squash(values: number[], maxIndex: number) {
  const maxStart = Math.max(maxIndex, values.length - 1);
  const groups: { n: number; sum: number; start: number }[] = [];
  const settle = (group: { n: number; sum: number; start: number }) => {
    group.start = clamp(group.sum / group.n, 0, maxStart - group.n + 1);
    return group;
  };
  for (const value of values) {
    let group = settle({ n: 1, sum: value, start: 0 });
    while (groups.length) {
      const previous = groups[groups.length - 1];
      if (previous.start + previous.n <= group.start + 1e-6) break;
      groups.pop();
      group = settle({
        n: previous.n + group.n,
        sum: previous.sum + group.sum - group.n * previous.n,
        start: 0,
      });
    }
    groups.push(group);
  }
  return groups.flatMap(group => Array.from({ length: group.n }, (_, index) => group.start + index));
}

function wideLayout(root: TreeNode, all: TreeNode[], search: Search, width: number, maxCandidates: number): Layout {
  const levelCount = Math.max(1, search.levels.length);
  const gap = clamp(0.045 * width, 24, 40);
  const rootWidth = clamp(0.19 * width, 112, 148);
  const columnWidth = Math.min(240, (width - rootWidth - levelCount * gap) / levelCount);
  const columns: Column[] = [{ x: 0, w: rootWidth, depth: 0 }];
  for (let depth = 1; depth <= levelCount; depth += 1) {
    columns.push({ x: rootWidth + gap + (depth - 1) * (columnWidth + gap), w: columnWidth, depth });
  }

  const byDepth = search.levels.map(level => level.candidates);
  const childrenOf = (node: TreeNode) =>
    byDepth[node.depth] ? node.children.filter(child => search.candidateIds.has(child.id)) : [];

  const rows = new Map<string, number>();
  rows.set(root.id, (maxCandidates - 1) / 2);

  const ideal = (node: TreeNode) => {
    const parent = node.parent ?? root;
    const siblings = childrenOf(parent);
    return (rows.get(parent.id) ?? 0) + siblings.indexOf(node) - (siblings.length - 1) / 2;
  };

  const place = (nodes: TreeNode[], targets: number[]) => {
    const placed = squash(targets, maxCandidates - 1);
    placed.forEach((row, index) => rows.set(nodes[index].id, row));
  };

  byDepth.forEach(level => place(level, level.map(ideal)));

  for (let pass = 0; pass < 3; pass += 1) {
    for (let depth = byDepth.length - 2; depth >= 0; depth -= 1) {
      const level = byDepth[depth];
      place(
        level,
        level.map(node => {
          const children = childrenOf(node);
          return children.length ? average(children.map(child => rows.get(child.id) ?? 0)) : (rows.get(node.id) ?? 0);
        }),
      );
    }
    if (byDepth[0]?.length) {
      rows.set(root.id, clamp(average(byDepth[0].map(node => rows.get(node.id) ?? 0)), 0, maxCandidates - 1));
    }
    byDepth.forEach(level =>
      place(
        level,
        level.map(node => (childrenOf(node).length ? (rows.get(node.id) ?? 0) : ideal(node))),
      ),
    );
  }

  const rowHeight = 62;
  const span = 62 * maxCandidates - 8;
  const boxes = new Map<string, Box>();
  const rootRow = rows.get(root.id) ?? 0;
  const rootTop = clamp(30 + rootRow * rowHeight + 27 - 42, 30, 30 + span - 84);
  boxes.set(root.id, { x: 0, y: rootTop, w: rootWidth, h: 84 });
  for (const node of all) {
    if (node.depth === 0) continue;
    const column = columns[Math.min(node.depth, columns.length - 1)];
    const row = rows.get(node.id) ?? (node.parent ? rows.get(node.parent.id) : undefined) ?? rootRow;
    boxes.set(node.id, { x: column.x, y: 30 + row * rowHeight, w: column.w, h: 54 });
  }
  return { mode: "wide", width, height: 30 + span, boxes, columns };
}

function narrowLayout(
  root: TreeNode,
  all: TreeNode[],
  visible: (node: TreeNode) => boolean,
  candidates: (node: TreeNode) => boolean,
  width: number,
): Layout {
  const boxes = new Map<string, Box>();
  const walk = (node: TreeNode, filter: (current: TreeNode) => boolean, place: boolean) => {
    let cursor = 0;
    const visit = (current: TreeNode) => {
      if (current.depth > 0 && !filter(current)) return;
      const height = current.depth === 0 ? 62 : 44;
      const indent = 16 * current.depth;
      if (place) boxes.set(current.id, { x: indent, y: cursor, w: Math.max(120, width - indent), h: height });
      cursor += height + 6;
      current.children.forEach(visit);
    };
    visit(node);
    return Math.max(0, cursor - 6);
  };
  const height = walk(root, candidates, false);
  walk(root, visible, true);
  for (const node of all) {
    if (boxes.has(node.id)) continue;
    const parentBox = node.parent ? boxes.get(node.parent.id) : undefined;
    const indent = 16 * node.depth;
    boxes.set(node.id, {
      x: indent,
      y: parentBox ? parentBox.y + parentBox.h + 6 : 0,
      w: Math.max(120, width - indent),
      h: 44,
    });
  }
  return { mode: "narrow", width, height, boxes, columns: [] };
}

function edgePath(mode: Layout["mode"], parent: Box, child: Box) {
  if (mode === "wide") {
    const x1 = parent.x + parent.w;
    const y1 = parent.y + parent.h / 2;
    const x2 = child.x;
    const y2 = child.y + child.h / 2;
    const mid = (x1 + x2) / 2;
    return `M${round(x1)} ${round(y1)}C${round(mid)} ${round(y1)} ${round(mid)} ${round(y2)} ${round(x2)} ${round(y2)}`;
  }
  const x = parent.x + 9;
  const y1 = parent.y + parent.h;
  const y2 = child.y + child.h / 2;
  return `M${round(x)} ${round(y1)}V${round(y2 - 4)}Q${round(x)} ${round(y2)} ${round(x + 4)} ${round(y2)}H${round(child.x)}`;
}

function pathPath(mode: Layout["mode"], boxes: Box[]) {
  if (boxes.length < 2) return "";
  if (mode === "wide") {
    let d = `M${round(boxes[0].x + boxes[0].w)} ${round(boxes[0].y + boxes[0].h / 2)}`;
    for (let index = 1; index < boxes.length; index += 1) {
      const previous = boxes[index - 1];
      const current = boxes[index];
      const x1 = previous.x + previous.w;
      const y1 = previous.y + previous.h / 2;
      const x2 = current.x;
      const y2 = current.y + current.h / 2;
      const mid = (x1 + x2) / 2;
      d += `C${round(mid)} ${round(y1)} ${round(mid)} ${round(y2)} ${round(x2)} ${round(y2)}`;
      if (index < boxes.length - 1) d += `H${round(current.x + current.w)}`;
    }
    return d;
  }
  let d = `M${round(boxes[0].x + 9)} ${round(boxes[0].y + boxes[0].h)}`;
  for (let index = 1; index < boxes.length; index += 1) {
    const previous = boxes[index - 1];
    const current = boxes[index];
    const x = previous.x + 9;
    const y = current.y + current.h / 2;
    if (index > 1) d += `H${round(x)}V${round(previous.y + previous.h)}`;
    d += `V${round(y - 4)}Q${round(x)} ${round(y)} ${round(x + 4)} ${round(y)}H${round(current.x)}`;
  }
  return d;
}

function StatusLine({ status, reduced }: { status: StatusPill; reduced: boolean }) {
  return (
    <span className={styles.status}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={status.key}
          className={styles.statusItem}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.1 * Number(!reduced), ease: [...motionTokens.ease.standard] } }}
          transition={{ duration: reduced ? 0 : motionTokens.duration.fast, ease: [...motionTokens.ease.standard] }}
        >
          {status.icon === "done" && <CircleCheck className={styles.statusDone} size={14} strokeWidth={1.75} aria-hidden="true" />}
          {status.icon === "paused" && <Pause className={styles.statusIcon} size={12} strokeWidth={1.75} aria-hidden="true" />}
          <span className={styles.statusText} data-active={(!!status.active && !reduced) || undefined}>
            {status.text}
          </span>
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function ReasoningTree({
  question = DEFAULT_QUESTION,
  questionDetail,
  thoughts = SAMPLE_THOUGHTS,
  beamWidth,
  defaultBeamWidth = 2,
  onBeamWidthChange,
  seed = 7,
  autoPlay = true,
  loop = false,
  speed = 1,
  controls = true,
  model = DEFAULT_MODEL,
  title = "Tree of thoughts",
  accent,
  onAnswer,
  className,
  style,
}: ReasoningTreeProps) {
  const mounted = useSyncExternalStore(
    subscribeIdle,
    () => true,
    () => false,
  );
  const reduceMotion = useReducedMotion();
  const reduced = mounted && !!reduceMotion;

  const detail =
    questionDetail ??
    (question === DEFAULT_QUESTION
      ? DEFAULT_DETAIL
      : question);

  const tree = useMemo(() => buildTree(question, detail, thoughts, seed), [question, detail, thoughts, seed]);
  const searches = useMemo(() => BEAMS.map(beam => buildSearch(tree.root, beam)), [tree]);
  const maxCandidates = useMemo(
    () => Math.max(MAX_DEPTH, ...searches.flatMap(search => search.levels.map(level => level.candidates.length))),
    [searches],
  );

  const [ownBeam, setOwnBeam] = useState(() => normalizeBeam(defaultBeamWidth));
  const beam = normalizeBeam(beamWidth ?? ownBeam);
  const search = searches[beam - 1];
  const lastDepth = search.levels.length;

  const [playhead, setPlayhead] = useState(() => ({ beam, step: 0, touched: false }));
  const sameBeam = playhead.beam === beam;
  const touched = sameBeam && playhead.touched;
  const step = Math.min(search.finalStep, reduced && !touched ? search.finalStep : sameBeam ? playhead.step : 0);

  const [playing, setPlaying] = useState(false);
  const pace = Math.max(0, speed);
  const arrived = step >= search.finalStep;
  const running = playing && pace > 0 && !(reduced && !touched) && (!arrived || loop);
  const final = arrived && !!search.answer;

  const states = useMemo(() => {
    const map = new Map<string, NodeState>();
    for (const node of tree.all) map.set(node.id, stateFor(search, node, step));
    return map;
  }, [tree, search, step]);

  const stateOf = (node: TreeNode): NodeState =>
    states.get(node.id) ?? { status: "hidden", shown: false, scored: false, onPath: false };

  useEffect(() => {
    if (!playing || pace === 0 || (reduced && !touched)) return;
    if (step >= search.finalStep) {
      if (!loop) return;
      const timer = window.setTimeout(() => setPlayhead({ beam, step: 0, touched: true }), PHASE_DURATION.answer / pace);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(
      () => setPlayhead({ beam, step: step + 1, touched: true }),
      PHASE_DURATION[describePhase(search, step).phase] / pace,
    );
    return () => window.clearTimeout(timer);
  }, [playing, pace, reduced, touched, step, search, beam, loop]);

  const rootRef = useRef<HTMLDivElement>(null);
  const autoRef = useRef({ autoPlay, reduced, started: false });

  useEffect(() => {
    autoRef.current.autoPlay = autoPlay;
    autoRef.current.reduced = reduced;
  }, [autoPlay, reduced]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        const state = autoRef.current;
        if (entry?.isIntersecting && !state.started) {
          state.started = true;
          observer.disconnect();
          if (state.autoPlay && !state.reduced) setPlaying(true);
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const answeredRef = useRef<string | null>(null);
  useEffect(() => {
    if (!final || !search.answer) {
      answeredRef.current = null;
      return;
    }
    const key = `${beam}:${search.answer.id}`;
    if (answeredRef.current === key) return;
    answeredRef.current = key;
    onAnswer?.({ answer: toThought(search.answer), path: search.path.slice(1).map(toThought), beamWidth: beam });
  }, [final, search, beam, onAnswer]);

  const [frozen, setFrozen] = useState({ text: "", beam: 0, step: -1 });
  const announcement = running
    ? ""
    : frozen.beam === beam && frozen.step === step
      ? frozen.text
      : final
        ? describeAnnouncement(search, step)
        : "";

  const stageRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(0);

  useLayoutEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const measure = () => setStageWidth(Math.floor(node.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const mode: Layout["mode"] = stageWidth >= 620 ? "wide" : "narrow";

  const layout = useMemo<Layout | null>(() => {
    if (!stageWidth) return null;
    if (mode === "wide") return wideLayout(tree.root, tree.all, search, stageWidth, maxCandidates);
    return narrowLayout(
      tree.root,
      tree.all,
      node => node.depth === 0 || (states.get(node.id)?.shown ?? false),
      node => search.candidateIds.has(node.id),
      stageWidth,
    );
  }, [stageWidth, mode, tree, search, maxCandidates, states]);

  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const edgeRefs = useRef(new Map<string, SVGPathElement>());
  const pathRef = useRef<SVGPathElement>(null);
  const sheenRef = useRef<SVGPathElement>(null);
  const spring = useRef({ pos: new Map<string, Velocity>(), shown: new Set<string>(), mode: "" as Layout["mode"] | "", width: 0, frame: 0, last: 0 });
  const frameRef = useRef<{ layout: Layout | null; paint: () => void }>({ layout: null, paint: () => {} });
  const tickRef = useRef<(time: number) => void>(() => {});

  const paint = useCallback(() => {
    if (!layout) return;
    const positions = spring.current.pos;
    const boxFor = (id: string): Box | undefined => {
      const target = layout.boxes.get(id);
      const item = positions.get(id);
      return target && item ? { x: item.x, y: item.y, w: target.w, h: target.h } : target;
    };
    for (const node of tree.all) {
      const box = boxFor(node.id);
      const element = nodeRefs.current.get(node.id);
      if (element && box) element.style.transform = `translate3d(${box.x}px, ${box.y}px, 0)`;
      if (!node.parent) continue;
      const from = boxFor(node.parent.id);
      const edge = edgeRefs.current.get(node.id);
      if (edge && box && from) edge.setAttribute("d", edgePath(layout.mode, from, box));
    }
    const d = pathPath(
      layout.mode,
      search.path.map(node => boxFor(node.id)).filter((box): box is Box => !!box),
    );
    pathRef.current?.setAttribute("d", d);
    sheenRef.current?.setAttribute("d", d);
  }, [layout, tree, search]);

  useLayoutEffect(() => {
    frameRef.current = { layout, paint };
    tickRef.current = (time: number) => {
      const state = spring.current;
      const active = frameRef.current.layout;
      const dt = Math.min(0.05, Math.max(0, (time - state.last) / 1000));
      state.last = time;
      let moving = false;
      if (active) {
        for (const [id, item] of state.pos) {
          const target = active.boxes.get(id);
          if (!target || !state.shown.has(id)) continue;
          for (let remaining = dt; remaining > 0; remaining -= 1 / 240) {
            const slice = Math.min(remaining, 1 / 240);
            item.vx += (-SPRING_STIFFNESS * (item.x - target.x) - SPRING_DAMPING * item.vx) * slice;
            item.vy += (-SPRING_STIFFNESS * (item.y - target.y) - SPRING_DAMPING * item.vy) * slice;
            item.x += item.vx * slice;
            item.y += item.vy * slice;
          }
          if (
            Math.abs(item.x - target.x) < 0.05 &&
            Math.abs(item.y - target.y) < 0.05 &&
            Math.abs(item.vx) < 0.5 &&
            Math.abs(item.vy) < 0.5
          ) {
            item.x = target.x;
            item.y = target.y;
            item.vx = 0;
            item.vy = 0;
          } else {
            moving = true;
          }
        }
      }
      frameRef.current.paint();
      state.frame = moving ? requestAnimationFrame(next => tickRef.current(next)) : 0;
    };
  });

  useLayoutEffect(() => {
    if (!layout) return;
    const state = spring.current;
    const snapAll = reduced || state.mode !== layout.mode || state.width !== layout.width;
    let moving = false;
    for (const node of tree.all) {
      const target = layout.boxes.get(node.id);
      if (!target) continue;
      const shown = node.depth === 0 || (states.get(node.id)?.shown ?? false);
      const item = state.pos.get(node.id);
      if (!item) {
        state.pos.set(node.id, { x: target.x, y: target.y, vx: 0, vy: 0 });
        continue;
      }
      if (snapAll || (shown && !state.shown.has(node.id))) {
        item.x = target.x;
        item.y = target.y;
        item.vx = 0;
        item.vy = 0;
        continue;
      }
      if (shown && (Math.abs(item.x - target.x) > 0.01 || Math.abs(item.y - target.y) > 0.01)) moving = true;
    }
    state.mode = layout.mode;
    state.width = layout.width;
    state.shown = new Set(tree.all.filter(node => node.depth === 0 || states.get(node.id)?.shown).map(node => node.id));
    paint();
    if (moving && !state.frame) {
      state.last = performance.now();
      state.frame = requestAnimationFrame(time => tickRef.current(time));
    }
  }, [layout, states, tree, reduced, paint]);

  useEffect(() => {
    const state = spring.current;
    return () => {
      cancelAnimationFrame(state.frame);
      state.frame = 0;
    };
  }, []);

  const [selectedId, setSelectedId] = useState("root");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const focusId = stateOf(tree.all.find(node => node.id === selectedId) ?? tree.root).shown || selectedId === "root" ? selectedId : "root";
  const activeId = hoveredId ?? focusedId;

  const { phase, depth } = describePhase(search, step);
  const pathOrder = new Map(search.path.map((node, index) => [node.id, index]));
  const rootStyle = {
    ...style,
    ...(accent ? { "--rt-accent": accent } : null),
    "--rt-path-steps": Math.max(1, search.path.length - 1),
  } as CSSProperties;

  const indexInSiblings = (node: TreeNode) =>
    node.parent ? node.parent.children.filter(child => search.candidateIds.has(child.id)).indexOf(node) : 0;

  const handleTreeKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!layout) return;
    const current = tree.all.find(node => node.id === focusId) ?? tree.root;
    const visibleNodes = tree.all.filter(node => node.depth === 0 || stateOf(node).shown);
    const yOf = (node: TreeNode) => layout.boxes.get(node.id)?.y ?? 0;
    const ordered = (mode === "wide" ? visibleNodes.filter(node => node.depth === current.depth) : visibleNodes).sort(
      (a, b) => yOf(a) - yOf(b) || a.order - b.order,
    );
    const index = ordered.indexOf(current);
    let next: TreeNode | undefined;
    if (event.key === "ArrowDown") next = ordered[index + 1];
    else if (event.key === "ArrowUp") next = ordered[index - 1];
    else if (event.key === "ArrowRight") {
      const children = current.children.filter(child => stateOf(child).shown);
      next = children.find(child => stateOf(child).onPath) ?? children.find(child => stateOf(child).status !== "pruned") ?? children[0];
    } else if (event.key === "ArrowLeft") next = current.parent ?? undefined;
    else if (event.key === "Home") next = tree.root;
    else if (event.key === "End")
      next =
        (final && search.answer) ||
        [...visibleNodes].sort((a, b) => b.depth - a.depth || yOf(a) - yOf(b))[0];
    if (next && (next !== current || event.key === "Home")) {
      event.preventDefault();
      setSelectedId(next.id);
      nodeRefs.current.get(next.id)?.focus({ preventScroll: false });
    }
  };

  const handleBeamChange = (value: string) => {
    const next = normalizeBeam(Number(value));
    if (next === beam) return;
    onBeamWidthChange?.(next);
    if (beamWidth === undefined) setOwnBeam(next);
    setPlayhead({ beam: next, step: 0, touched: !reduced });
    setPlaying(!reduced && pace > 0);
    const target = searches[next - 1];
    if (reduced) {
      setFrozen({ text: `Beam width ${next}. ${describeAnnouncement(target, target.finalStep)}`, beam: next, step: target.finalStep });
    }
  };

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={rootStyle}
      data-mode={layout?.mode}
      data-ready={!!layout || undefined}
      data-final={!!final || undefined}
    >
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.title}>
            {model ? (
              <>
                {model.mark && (
                  <span className={styles.mark} aria-hidden="true">
                    {model.mark}
                  </span>
                )}
                <span className={styles.modelName}>{model.name}</span>
                <span className={styles.method}>{title}</span>
              </>
            ) : (
              <span className={styles.modelName}>{title}</span>
            )}
          </div>
          <StatusLine status={computeStatus(search, step, running)} reduced={reduced} />
        </div>
        <div ref={stageRef} className={styles.stage} style={layout ? { height: layout.height } : undefined}>
          {layout && (
            <>
              {layout.mode === "wide" &&
                layout.columns.map(column => {
                  const level = search.levels[column.depth - 1];
                  const settled = column.depth > 0 && step >= 3 * column.depth;
                  const label = level
                    ? column.depth === lastDepth
                      ? `Best of ${level.candidates.length}`
                      : `${level.kept.length} of ${level.candidates.length} kept`
                    : "";
                  return (
                    <div
                      key={column.depth}
                      className={styles.column}
                      style={{ left: column.x, width: column.w }}
                      data-active={((phase === "question" ? 0 : depth) === column.depth && !final) || undefined}
                      aria-hidden="true"
                    >
                      <span className={styles.columnName}>{column.depth === 0 ? "Question" : `Depth ${column.depth}`}</span>
                      {column.depth > 0 && (
                        <span className={styles.columnCount} data-on={!!settled || undefined}>
                          {label}
                        </span>
                      )}
                    </div>
                  );
                })}
              <svg className={styles.edges} width={layout.width} height={layout.height} aria-hidden="true">
                {tree.all.map(node => {
                  if (!node.parent) return null;
                  const state = stateOf(node);
                  const from = layout.boxes.get(node.parent.id);
                  const to = layout.boxes.get(node.id);
                  if (!from || !to) return null;
                  return (
                    <path
                      key={node.id}
                      ref={element => {
                        if (element) edgeRefs.current.set(node.id, element);
                        else edgeRefs.current.delete(node.id);
                      }}
                      className={styles.edge}
                      d={edgePath(layout.mode, from, to)}
                      pathLength={1}
                      data-on={(!!state.shown && state.status !== "pruned") || undefined}
                      style={{ "--i": indexInSiblings(node) } as CSSProperties}
                    />
                  );
                })}
                <path
                  ref={pathRef}
                  className={styles.pathLine}
                  pathLength={1}
                  d={pathPath(
                    layout.mode,
                    search.path.map(node => layout.boxes.get(node.id)).filter((box): box is Box => !!box),
                  )}
                />
                <path
                  ref={sheenRef}
                  className={styles.sheen}
                  pathLength={1}
                  d={pathPath(
                    layout.mode,
                    search.path.map(node => layout.boxes.get(node.id)).filter((box): box is Box => !!box),
                  )}
                />
              </svg>
              <div
                className={styles.tree}
                role="tree"
                aria-label={`Thought tree for: ${tree.root.text}`}
                onKeyDown={handleTreeKeyDown}
              >
                {tree.all.map(node => {
                  const state = stateOf(node);
                  const box = layout.boxes.get(node.id);
                  if (!box) return null;
                  const siblings = node.parent ? node.parent.children.filter(child => stateOf(child).shown) : [node];
                  const isActive = activeId === node.id && state.shown;
                  const side = box.y < 96 ? "bottom" : "top";
                  const align = layout.mode === "narrow" || node.depth === 0 ? "start" : node.depth === lastDepth ? "end" : "center";
                  return (
                    <div
                      key={node.id}
                      ref={element => {
                        if (element) nodeRefs.current.set(node.id, element);
                        else nodeRefs.current.delete(node.id);
                      }}
                      role="treeitem"
                      aria-level={node.depth + 1}
                      aria-setsize={siblings.length}
                      aria-posinset={Math.max(1, siblings.indexOf(node) + 1)}
                      aria-selected={state.shown && focusId === node.id}
                      aria-label={node.depth === 0 ? `Question: ${node.text}` : `${node.text} ${describeNode(node, state)}.`}
                      aria-hidden={!state.shown || undefined}
                      tabIndex={state.shown && focusId === node.id ? 0 : -1}
                      className={styles.slot}
                      data-depth={node.depth}
                      data-last={(node.depth > 0 && node.depth === lastDepth) || undefined}
                      data-shown={state.shown}
                      data-status={state.status}
                      data-scored={!!state.scored || undefined}
                      data-path={!!state.onPath || undefined}
                      data-active={!!isActive || undefined}
                      style={
                        {
                          width: box.w,
                          height: box.h,
                          transform: `translate3d(${box.x}px, ${box.y}px, 0)`,
                          "--i": indexInSiblings(node),
                          "--s": node.score,
                          "--n": Math.round(100 * node.score),
                          "--p": pathOrder.get(node.id) ?? 0,
                        } as CSSProperties
                      }
                      onPointerEnter={(event: ReactPointerEvent<HTMLDivElement>) => {
                        if (event.pointerType === "mouse") setHoveredId(node.id);
                      }}
                      onPointerLeave={() => setHoveredId(current => (current === node.id ? null : current))}
                      onFocus={() => {
                        setSelectedId(node.id);
                        setFocusedId(node.id);
                      }}
                      onBlur={() => setFocusedId(current => (current === node.id ? null : current))}
                    >
                      <div className={styles.node}>
                        {node.depth === 0 ? (
                          <span className={styles.question}>{node.label}</span>
                        ) : (
                          <>
                            <span className={styles.labelRow}>
                              <span className={styles.label}>{node.label}</span>
                              {node.depth === lastDepth && <CircleCheck className={styles.check} size={14} strokeWidth={1.75} aria-hidden="true" />}
                            </span>
                            <span className={styles.score} aria-hidden="true">
                              <span className={styles.track}>
                                <span className={styles.fill} />
                              </span>
                              <span className={styles.num} />
                            </span>
                          </>
                        )}
                      </div>
                      {isActive && (
                        <span className={styles.tag} data-side={side} data-align={align} aria-hidden="true">
                          <span className={styles.tagText}>{node.text}</span>
                          <span className={styles.tagMeta}>{describeNode(node, state)}</span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
        {controls && (
          <div className={styles.footer} data-frame-keep="">
            <div className={styles.transport} role="group" aria-label="Playback">
              <Tooltip content={running ? "Pause" : arrived ? "Replay" : "Play"}>
                <Button
                  variant="secondary"
                  size="sm"
                  className={styles.iconButton}
                  aria-label={running ? "Pause" : arrived ? "Replay" : "Play"}
                  onClick={() => {
                    if (running) {
                      setPlaying(false);
                      setFrozen({ text: describeAnnouncement(search, step), beam, step });
                      return;
                    }
                    if (arrived || !touched) setPlayhead({ beam, step: arrived ? 0 : step, touched: true });
                    setPlaying(true);
                  }}
                >
                  <span className={styles.playIcon} data-playing={!!running || undefined}>
                    <Play size={16} strokeWidth={1.75} aria-hidden="true" />
                    <Pause size={16} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                </Button>
              </Tooltip>
              <Tooltip content="Step">
                <Button
                  variant="secondary"
                  size="sm"
                  className={styles.iconButton}
                  aria-label="Step"
                  aria-disabled={arrived || undefined}
                  onClick={() => {
                    if (arrived) return;
                    setPlaying(false);
                    setPlayhead({ beam, step: step + 1, touched: true });
                    setFrozen({ text: describeAnnouncement(search, step + 1), beam, step: step + 1 });
                  }}
                >
                  <SkipForward size={16} strokeWidth={1.75} aria-hidden="true" />
                </Button>
              </Tooltip>
              <Tooltip content="Restart">
                <Button
                  variant="secondary"
                  size="sm"
                  className={styles.iconButton}
                  aria-label="Restart"
                  onClick={() => {
                    setPlayhead({ beam, step: 0, touched: true });
                    setPlaying(!reduced && pace > 0);
                    setFrozen({ text: describeAnnouncement(search, 0), beam, step: 0 });
                  }}
                >
                  <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
                </Button>
              </Tooltip>
            </div>
            <div className={styles.beam}>
              <span className={styles.beamLabel} aria-hidden="true">
                <span className={styles.beamLong}>Beam width</span>
                <span className={styles.beamShort}>Beam</span>
              </span>
              <SegmentedControl
                label="Beam width"
                options={BEAMS.map(value => ({ value: String(value), label: String(value) }))}
                value={String(beam)}
                onValueChange={handleBeamChange}
              />
            </div>
          </div>
        )}
        <span className={styles.srOnly} role="status" aria-live="polite">
          {announcement}
        </span>
      </div>
    </div>
  );
}

export const ReasoningTreeDemo = () => (
  <div className={styles.demo}>
    <ReasoningTree defaultBeamWidth={2} />
  </div>
);

export default ReasoningTree;
