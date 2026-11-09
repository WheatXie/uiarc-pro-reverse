"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { GitBranch, GitCommitHorizontal, GitMerge } from "lucide-react";
import styles from "./branch-graph.module.css";

export type BranchGraphStrategy = "open" | "merge" | "rebase" | "squash";

export interface BranchGraphAuthor { name: string; avatar?: string }

export interface BranchGraphCommit {
  id: string;
  hash: string;
  message: string;
  body?: string;
  branch: string;
  parents?: string[];
  author: BranchGraphAuthor;
  date: string;
  additions?: number;
  deletions?: number;
  files?: number;
}

export interface BranchGraphBranch { name: string; color?: string }

export interface BranchGraphPullRequest { number: number; title: string; branch: string }

export interface BranchGraphProps {
  commits?: BranchGraphCommit[];
  branches?: BranchGraphBranch[];
  pullRequest?: BranchGraphPullRequest;
  strategy?: BranchGraphStrategy;
  defaultStrategy?: BranchGraphStrategy;
  onStrategyChange?: (strategy: BranchGraphStrategy) => void;
  strategies?: BranchGraphStrategy[];
  title?: string;
  autoplay?: boolean;
  speed?: number;
  paused?: boolean;
  accent?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const portrait = (slug: string) => `/media/people/portrait/${slug}.svg`;

const CHLOE: BranchGraphAuthor = { name: "Chloe Nguyen", avatar: portrait("chloe-nguyen") };
const DANIEL: BranchGraphAuthor = { name: "Daniel Kim", avatar: portrait("daniel-kim") };
const SOFIA: BranchGraphAuthor = { name: "Sofia Ramirez", avatar: portrait("sofia-ramirez") };
const MARCUS: BranchGraphAuthor = { name: "Marcus Johnson", avatar: portrait("marcus-johnson") };

const DEFAULT_BRANCHES: BranchGraphBranch[] = [{ name: "main" }, { name: "feat/checkout" }, { name: "fix/rounding" }];

const DEFAULT_COMMITS: BranchGraphCommit[] = [
  {
    id: "f3",
    hash: "9f2c1ab",
    message: "Save cards for returning customers",
    body: "Stores a customer id on the first purchase and offers saved cards on the next visit.",
    branch: "feat/checkout",
    parents: ["f2"],
    author: CHLOE,
    date: "2 hours ago",
    additions: 184,
    deletions: 32,
    files: 6,
  },
  {
    id: "m4",
    hash: "4e81d07",
    message: "Bump stripe-js to 4.2",
    body: "Picks up the new payment element and drops a deprecated option.",
    branch: "main",
    parents: ["m3"],
    author: DANIEL,
    date: "5 hours ago",
    additions: 12,
    deletions: 12,
    files: 2,
  },
  {
    id: "f2",
    hash: "c7a3e52",
    message: "Add Apple Pay button",
    body: "Shows the Apple Pay sheet when the browser supports it and falls back to the card form.",
    branch: "feat/checkout",
    parents: ["f1"],
    author: CHLOE,
    date: "Yesterday",
    additions: 96,
    deletions: 8,
    files: 4,
  },
  {
    id: "m3",
    hash: "2d9b6f4",
    message: "Merge branch fix/rounding",
    branch: "main",
    parents: ["m2", "x1"],
    author: SOFIA,
    date: "Yesterday",
    additions: 18,
    deletions: 6,
    files: 3,
  },
  {
    id: "x1",
    hash: "a15e3c9",
    message: "Round tax per line item",
    body: "Totals now match the invoice when a cart mixes tax rates.",
    branch: "fix/rounding",
    parents: ["m2"],
    author: SOFIA,
    date: "2 days ago",
    additions: 18,
    deletions: 6,
    files: 3,
  },
  {
    id: "f1",
    hash: "6b04d8e",
    message: "Move payment into its own step",
    body: "Splits the single checkout page into address, payment, and review steps.",
    branch: "feat/checkout",
    parents: ["m2"],
    author: CHLOE,
    date: "2 days ago",
    additions: 241,
    deletions: 117,
    files: 9,
  },
  {
    id: "m2",
    hash: "e3c72a0",
    message: "Add order summary",
    branch: "main",
    parents: ["m1"],
    author: MARCUS,
    date: "3 days ago",
    additions: 132,
    deletions: 14,
    files: 5,
  },
  {
    id: "m1",
    hash: "0f5d9b3",
    message: "Ship checkout v1",
    branch: "main",
    parents: [],
    author: MARCUS,
    date: "4 days ago",
    additions: 410,
    deletions: 0,
    files: 12,
  },
];

const DEFAULT_PULL_REQUEST: BranchGraphPullRequest = { number: 482, title: "Checkout redesign", branch: "feat/checkout" };

const ALL_STRATEGIES: BranchGraphStrategy[] = ["open", "merge", "rebase", "squash"];
const STRATEGY_LABELS: Record<BranchGraphStrategy, string> = { open: "Before", merge: "Merge", rebase: "Rebase", squash: "Squash" };
const AUTOPLAY: BranchGraphStrategy[] = ["open", "rebase", "merge", "squash"];
const MERGE_ID = "__merge";
const SQUASH_ID = "__squash";
const SERIES = ["var(--bg-base)", "var(--series-2)", "var(--series-4)", "var(--series-3)"];
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const reducedSnapshot = () => window.matchMedia(REDUCED_QUERY).matches;
const serverSnapshot = () => false;

/* cubic-bezier solver, same six Newton steps as the browser */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let u = t;
    for (let step = 0; step < 6; step += 1) {
      const x = ((ax * u + bx) * u + cx) * u - t;
      const slope = (3 * ax * u + 2 * bx) * u + cx;
      if (Math.abs(x) < 1e-5 || Math.abs(slope) < 1e-6) break;
      u -= x / slope;
    }
    return ((ay * u + by) * u + cy) * u;
  };
}

const easeInOut = bezier(0.45, 0, 0.15, 1);
const easeOut = bezier(0.16, 1, 0.3, 1);
const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const smooth = (start: number, end: number, value: number) => {
  const t = clamp01((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smoother = (t: number) => t * t * t * (t * (6 * t - 15) + 10);
const round2 = (value: number) => Math.round(100 * value) / 100;
const plural = (count: number, word: string, suffix = `${word}s`) => `${count} ${count === 1 ? word : suffix}`;

/* a stable pseudo hash for replay / squash commits */
function deriveHash(hash: string, salt: number) {
  const alphabet = "0123456789abcdef";
  let out = "";
  for (let index = 0; index < hash.length; index += 1) {
    const digit = alphabet.indexOf(hash[hash.length - 1 - index].toLowerCase());
    out += alphabet[((digit < 0 ? index : digit) * 7 + salt + 5 * index) & 15];
  }
  return out;
}

type NodeKind = "shift" | "appear" | "fade" | "flight" | "absorb" | "emit";

interface NodeState {
  fx: number;
  fy: number;
  fa: number;
  fs: number;
  tx: number;
  ty: number;
  ta: number;
  t0: number;
  dur: number;
  kind: NodeKind;
  land: number;
  pulseAt: number;
  hashAt: number;
  hash: string;
  shown: string;
  hv: number;
  x: number;
  y: number;
  a: number;
  s: number;
  lift: number;
  ra: number;
}

interface EdgeState { fp: number; tp: number; t0: number; dur: number; linear: boolean; p: number }

function stepNode(node: NodeState, clock: number) {
  const progress = node.dur <= 0 ? 1 : clamp01((clock - node.t0) / node.dur);
  let x = 0;
  let y = 0;
  let alpha = 0;
  let scale = 1;
  let lift = 0;
  let revealed = -1;
  if (node.kind === "flight" || node.kind === "absorb" || node.kind === "emit") {
    lift = smooth(0, 0.12, progress) * (1 - smooth(0.88, 1, progress));
    const arc = clamp01((progress - 0.1) / 0.8);
    y = lerp(node.fy, node.ty, smoother(arc));
    x = lerp(node.fx, node.tx, smoother(clamp01((arc - 0.12) / 0.76)));
    if (node.kind === "absorb") {
      alpha = node.fa * (1 - smooth(0.7, 0.95, progress));
      scale = 1 - 0.45 * smooth(0.7, 0.95, progress);
      revealed = node.fa * (1 - smooth(0.3, 0.62, progress));
    } else if (node.kind === "emit") {
      alpha = node.ta * smooth(0.02, 0.22, progress);
      scale = 0.55 + 0.45 * smooth(0.02, 0.3, progress);
      revealed = node.ta * smooth(0.35, 0.7, progress);
    } else {
      alpha = lerp(node.fa, node.ta, smooth(0, 0.3, progress));
    }
  } else if (node.kind === "appear") {
    const eased = easeOut(progress);
    x = lerp(node.fx, node.tx, eased);
    y = lerp(node.fy, node.ty, eased);
    alpha = lerp(node.fa, node.ta, clamp01(1.6 * progress));
    scale = lerp(node.fs, 1, eased);
  } else if (node.kind === "fade") {
    const t = clamp01(progress);
    x = node.fx;
    y = node.fy;
    alpha = lerp(node.fa, node.ta, t);
    scale = lerp(node.fs, 0.6, t);
  } else {
    const eased = easeInOut(progress);
    x = lerp(node.fx, node.tx, eased);
    y = lerp(node.fy, node.ty, eased);
    alpha = lerp(node.fa, node.ta, eased);
    scale = lerp(node.fs, 1, eased);
  }
  node.x = x;
  node.y = y;
  node.a = alpha;
  node.s = scale;
  node.lift = lift;
  node.ra = revealed < 0 ? alpha : revealed;
}

const nodeEnd = (node: NodeState) => node.t0 + node.dur;

function stepEdge(edge: EdgeState, clock: number) {
  const progress = edge.dur <= 0 ? 1 : clamp01((clock - edge.t0) / edge.dur);
  edge.p = lerp(edge.fp, edge.tp, edge.linear ? progress : easeInOutCubic(progress));
  return edge.p;
}

const laneX = (lane: number) => 22 + 18 * lane;
const rowY = (row: number) => 6 + (row + 0.5) * 44;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function edgePath(fromX: number, fromY: number, toX: number, toY: number, merge: boolean) {
  const height = fromY - toY;
  const bend = Math.max(0, Math.min(44 * (0.56 + 0.26 * clamp01(Math.abs(toX - fromX) / 18 - 1)), height));
  const reach = 0.56 * bend;
  return merge
    ? `M${round2(fromX)} ${round2(fromY)}L${round2(fromX)} ${round2(toY + bend)}C${round2(fromX)} ${round2(toY + bend - reach)} ${round2(toX)} ${round2(toY + reach)} ${round2(toX)} ${round2(toY)}`
    : `M${round2(fromX)} ${round2(fromY)}C${round2(fromX)} ${round2(fromY - reach)} ${round2(toX)} ${round2(fromY - bend + reach)} ${round2(toX)} ${round2(fromY - bend)}L${round2(toX)} ${round2(toY)}`;
}

interface Place { row: number; lane: number; vis: boolean }
interface Tag { name: string; color: string }

interface Layout {
  order: string[];
  place: Record<string, Place>;
  hash: Record<string, string>;
  tags: Record<string, Tag[]>;
  edges: Set<string>;
  summary: string;
}

interface GraphEdge { key: string; child: string; parent: string; merge: boolean; color: string }

interface GraphModel {
  commits: Record<string, BranchGraphCommit>;
  ids: string[];
  heads: Set<string>;
  lanes: number;
  colorOf: Record<string, string>;
  layouts: Record<BranchGraphStrategy, Layout>;
  edges: GraphEdge[];
  available: BranchGraphStrategy[];
  base: string;
  head: string;
  initial: string[];
}

function buildGraph(commits: BranchGraphCommit[], branches: BranchGraphBranch[], pullRequest: BranchGraphPullRequest): GraphModel {
  const base = branches[0]?.name ?? "main";
  const laneIndex: Record<string, number> = {};
  const branchColor: Record<string, string> = {};
  branches.forEach((branch, index) => {
    laneIndex[branch.name] = index;
    branchColor[branch.name] = branch.color ?? SERIES[index % SERIES.length];
  });
  const colorOfBranch = (name: string) => branchColor[name] ?? SERIES[0];
  const laneOf = (name: string) => laneIndex[name] ?? 0;

  const commitsById: Record<string, BranchGraphCommit> = {};
  for (const commit of commits) commitsById[commit.id] = commit;

  const headCommits = commits.filter((commit) => commit.branch === pullRequest.branch && commit.branch !== base);
  const headIds = new Set(headCommits.map((commit) => commit.id));
  const rest = commits.filter((commit) => !headIds.has(commit.id));
  const baseTip = rest.find((commit) => commit.branch === base) ?? rest[0];
  const newest = headCommits[0];
  const oldest = headCommits[headCommits.length - 1];
  const sum = (key: "additions" | "deletions" | "files") => headCommits.reduce((total, commit) => total + (commit[key] ?? 0), 0);

  if (newest) {
    commitsById[MERGE_ID] = {
      id: MERGE_ID,
      hash: deriveHash(newest.hash, 3),
      message: `Merge pull request #${pullRequest.number} from ${pullRequest.branch}`,
      body: `Brings ${plural(headCommits.length, "commit")} from ${pullRequest.branch} into ${base} and keeps them as they are.`,
      branch: base,
      parents: [baseTip?.id ?? "", newest.id].filter(Boolean),
      author: newest.author,
      date: "Just now",
      additions: sum("additions"),
      deletions: sum("deletions"),
      files: sum("files"),
    };
    commitsById[SQUASH_ID] = {
      id: SQUASH_ID,
      hash: deriveHash(newest.hash, 11),
      message: `${pullRequest.title} (#${pullRequest.number})`,
      body: headCommits
        .slice()
        .reverse()
        .map((commit) => commit.message)
        .join(". ") + ".",
      branch: pullRequest.branch,
      parents: baseTip ? [baseTip.id] : [],
      author: newest.author,
      date: "Just now",
      additions: sum("additions"),
      deletions: sum("deletions"),
      files: sum("files"),
    };
  }

  const ids = [...commits.map((commit) => commit.id), ...(newest ? [MERGE_ID, SQUASH_ID] : [])];
  const colorOf: Record<string, string> = {};
  for (const id of ids) colorOf[id] = colorOfBranch(commitsById[id].branch);

  const edgeCache = new Map<string, GraphEdge>();
  const ancestors = (id?: string) => {
    const seen = new Set<string>();
    const stack = id ? [id] : [];
    while (stack.length) {
      const current = stack.pop() as string;
      if (seen.has(current) || !commitsById[current]) continue;
      seen.add(current);
      for (const parent of commitsById[current].parents ?? []) stack.push(parent);
    }
    return seen;
  };

  const layoutFor = (strategy: BranchGraphStrategy): Layout => {
    let order: string[];
    const parents: Record<string, string[]> = {};
    const hash: Record<string, string> = {};
    const lane: Record<string, number> = {};
    for (const id of ids) {
      parents[id] = commitsById[id].parents ?? [];
      hash[id] = commitsById[id].hash;
      lane[id] = laneOf(commitsById[id].branch);
    }
    lane[MERGE_ID] = 0;
    lane[SQUASH_ID] = 0;

    const tags: Record<string, Tag[]> = {};
    const tag = (id: string | undefined, name: string) => {
      if (!id) return;
      (tags[id] ??= []).push({ name, color: colorOfBranch(name) });
    };

    const headCount = headCommits.length;
    let summary: string;
    if (strategy === "merge" && newest) {
      order = [MERGE_ID, ...commits.map((commit) => commit.id)];
      tag(MERGE_ID, base);
      tag(newest.id, pullRequest.branch);
      summary = `A merge commit brings ${plural(headCount, "commit")} into ${base} and keeps both lines of history.`;
    } else if (strategy === "rebase" && newest) {
      order = [...headCommits.map((commit) => commit.id), ...rest.map((commit) => commit.id)];
      headCommits.forEach((commit, index) => {
        lane[commit.id] = 0;
        hash[commit.id] = deriveHash(commit.hash, 5 + index);
      });
      if (oldest && baseTip) parents[oldest.id] = [baseTip.id];
      tag(newest.id, base);
      tag(newest.id, pullRequest.branch);
      summary = `${plural(headCount, "commit")} replayed on top of ${base} with new hashes. History stays in one line.`;
    } else if (strategy === "squash" && newest) {
      order = [SQUASH_ID, ...rest.map((commit) => commit.id)];
      tag(SQUASH_ID, base);
      summary = `${plural(headCount, "commit")} squashed into one commit on ${base}.`;
    } else {
      order = commits.map((commit) => commit.id);
      tag(baseTip?.id, base);
      if (newest) {
        tag(newest.id, pullRequest.branch);
        const behind = ancestors(baseTip?.id);
        const ahead = ancestors(newest.id);
        let missing = 0;
        behind.forEach((id) => {
          if (!ahead.has(id)) missing += 1;
        });
        summary = `${pullRequest.branch} is ${plural(headCount, "commit")} ahead of ${base} and ${missing} behind.`;
      } else {
        summary = `${plural(commits.length, "commit")} on ${base}.`;
      }
    }

    const place: Record<string, Place> = {};
    const rowOf = new Map(order.map((id, index) => [id, index]));
    for (const id of ids) {
      const row = rowOf.get(id);
      place[id] = row === undefined ? { row: 0, lane: 0, vis: false } : { row, lane: lane[id], vis: true };
    }

    const edges = new Set<string>();
    for (const child of order) {
      parents[child].forEach((parent, index) => {
        if (!rowOf.has(parent)) return;
        const key = `${child}>${parent}`;
        edges.add(key);
        if (!edgeCache.has(key)) {
          edgeCache.set(key, { key, child, parent, merge: index > 0, color: index > 0 ? colorOf[parent] : colorOf[child] });
        }
      });
    }

    return { order, place, hash, tags, edges, summary };
  };

  return {
    commits: commitsById,
    ids,
    heads: headIds,
    lanes: Math.max(1, branches.length),
    colorOf,
    layouts: { open: layoutFor("open"), merge: layoutFor("merge"), rebase: layoutFor("rebase"), squash: layoutFor("squash") },
    edges: [...edgeCache.values()],
    available: newest ? [...ALL_STRATEGIES] : ["open"],
    base,
    head: pullRequest.branch,
    initial: commits.map((commit) => commit.id),
  };
}

/* five little blocks that read as a diff ratio */
function DiffBlocks({ add, del }: { add: number; del: number }) {
  const total = add + del;
  const added = total ? Math.round((add / total) * 5) : 0;
  const removed = total ? Math.min(5 - added, Math.round((del / total) * 5)) : 0;
  return (
    <span className={styles.blocks} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((index) => (
        <span key={index} data-kind={index < added ? "add" : index < added + removed ? "del" : undefined} />
      ))}
    </span>
  );
}

interface Engine {
  clock: number;
  nodes: Map<string, NodeState>;
  edges: Map<string, EdgeState>;
  height: { from: number; to: number; t0: number; dur: number; v: number };
  busyUntil: number;
  introduced: boolean;
  shown: BranchGraphStrategy | null;
  model: GraphModel | null;
  visible: boolean;
  raf: number;
  last: number;
  hovering: boolean;
  touched: boolean;
  card: { y: number; open: boolean; h: number };
  active: string | null;
}

const EMPTY_ENGINE = (): Engine => ({
  clock: 0,
  nodes: new Map(),
  edges: new Map(),
  height: { from: 0, to: 0, t0: 0, dur: 0, v: 0 },
  busyUntil: 0,
  introduced: false,
  shown: null,
  model: null,
  visible: false,
  raf: 0,
  last: 0,
  hovering: false,
  touched: false,
  card: { y: 0, open: false, h: 0 },
  active: null,
});

export function BranchGraph({
  commits = DEFAULT_COMMITS,
  branches = DEFAULT_BRANCHES,
  pullRequest = DEFAULT_PULL_REQUEST,
  strategy,
  defaultStrategy = "open",
  onStrategyChange,
  strategies = ALL_STRATEGIES,
  title,
  autoplay = true,
  speed = 1,
  paused = false,
  accent,
  label,
  className,
  style,
}: BranchGraphProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const reduced = useSyncExternalStore(subscribeReducedMotion, reducedSnapshot, serverSnapshot);
  const graph = useMemo(() => buildGraph(commits, branches, pullRequest), [commits, branches, pullRequest]);
  const offered = useMemo(() => strategies.filter((entry) => graph.available.includes(entry)), [strategies, graph]);

  const [internal, setInternal] = useState<BranchGraphStrategy>(defaultStrategy);
  const controlled = strategy !== undefined;
  const requested = controlled ? (strategy as BranchGraphStrategy) : internal;
  const active = graph.available.includes(requested) ? requested : "open";
  const layout = graph.layouts[active];

  const [inspected, setInspected] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [above, setAbove] = useState(false);
  const openId = inspected && layout.place[inspected]?.vis ? inspected : null;

  const rootRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const segRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const nodeRefs = useRef(new Map<string, SVGGElement>());
  const hashRefs = useRef(new Map<string, HTMLElement>());
  const ringRefs = useRef(new Map<string, SVGCircleElement>());
  const edgeRefs = useRef(new Map<string, SVGPathElement>());
  const written = useRef(new WeakMap<Element, Record<string, string>>());
  const engine = useRef<Engine>(EMPTY_ENGINE());
  const frameFn = useRef<(now: number) => void>(() => {});
  const params = useRef({ speed, reduced, paused, autoplay, controlled, strategy: active, offered });

  useLayoutEffect(() => {
    params.current = { speed, reduced, paused, autoplay, controlled, strategy: active, offered };
  });

  /* every write is cached per element so a settled frame touches nothing */
  const write = useCallback((element: Element, key: string, value: string, attribute = true) => {
    let cache = written.current.get(element);
    if (!cache) {
      cache = {};
      written.current.set(element, cache);
    }
    if (cache[key] === value) return;
    cache[key] = value;
    if (attribute) element.setAttribute(key, value);
    else (element as HTMLElement).style.setProperty(key, value);
  }, []);

  const sync = useCallback((model: GraphModel) => {
    const state = engine.current;
    if (state.model === model) return;
    state.model = model;
    state.nodes.clear();
    state.edges.clear();
    const open = model.layouts.open;
    for (const id of model.ids) {
      const place = open.place[id];
      state.nodes.set(id, {
        fx: place.lane,
        fy: place.row,
        fa: 0,
        fs: 0.35,
        tx: place.lane,
        ty: place.row,
        ta: 0,
        t0: 0,
        dur: 0,
        kind: "shift",
        land: 0,
        pulseAt: -9,
        hashAt: 0,
        hash: open.hash[id],
        shown: "",
        hv: 0,
        x: place.lane,
        y: place.row,
        a: 0,
        s: 0.35,
        lift: 0,
        ra: 0,
      });
    }
    for (const edge of model.edges) state.edges.set(edge.key, { fp: 0, tp: 0, t0: 0, dur: 0, linear: false, p: 0 });
    state.height = { from: open.order.length, to: open.order.length, t0: 0, dur: 0, v: open.order.length };
    state.introduced = false;
    state.shown = null;
  }, []);

  const apply = useCallback((model: GraphModel, strategyKey: BranchGraphStrategy, instant: boolean) => {
    const state = engine.current;
    const clock = state.clock;
    const next = model.layouts[strategyKey];
    const previous = state.shown;
    const fresh = !state.introduced;

    for (const node of state.nodes.values()) stepNode(node, clock);
    for (const edge of state.edges.values()) stepEdge(edge, clock);

    if (instant) {
      for (const id of model.ids) {
        const node = state.nodes.get(id) as NodeState;
        const place = next.place[id];
        Object.assign(node, {
          fx: place.lane,
          fy: place.row,
          fa: +!!place.vis,
          fs: 1,
          tx: place.lane,
          ty: place.row,
          ta: +!!place.vis,
          t0: clock,
          dur: 0,
          kind: "shift" as NodeKind,
          land: clock,
          pulseAt: -9,
          hashAt: clock,
          hash: next.hash[id],
        });
      }
      for (const [key, edge] of state.edges) {
        Object.assign(edge, { fp: +!!next.edges.has(key), tp: +!!next.edges.has(key), t0: clock, dur: 0 });
      }
      state.height = { from: next.order.length, to: next.order.length, t0: clock, dur: 0, v: next.order.length };
      state.busyUntil = clock;
      state.introduced = true;
    } else if (fresh || previous === null) {
      const count = next.order.length;
      const startAt = (row: number) => clock + (count - 1 - row) * 0.085;
      for (const id of model.ids) {
        const node = state.nodes.get(id) as NodeState;
        const place = next.place[id];
        Object.assign(node, {
          fx: place.lane,
          fy: place.row,
          fa: 0,
          fs: 0.35,
          tx: place.lane,
          ty: place.row,
          ta: +!!place.vis,
          t0: startAt(place.row),
          dur: 0.5,
          kind: "appear" as NodeKind,
          land: startAt(place.row),
          pulseAt: -9,
          hashAt: clock,
          hash: next.hash[id],
        });
      }
      for (const edge of model.edges) {
        const state1 = state.edges.get(edge.key) as EdgeState;
        if (!next.edges.has(edge.key)) {
          Object.assign(state1, { fp: 0, tp: 0, t0: clock, dur: 0 });
          continue;
        }
        const parentRow = next.place[edge.parent].row;
        const childRow = next.place[edge.child].row;
        Object.assign(state1, {
          fp: 0,
          tp: 1,
          t0: startAt(parentRow) + 0.04,
          dur: Math.max(0.05, (parentRow - childRow) * 0.085),
          linear: true,
        });
      }
      state.height = { from: count, to: count, t0: clock, dur: 0, v: count };
      state.busyUntil = clock + 0.085 * count + 0.5;
      state.introduced = true;
    } else {
      const prior = model.layouts[previous];
      const flights: { id: string; kind: NodeKind; sortRow: number }[] = [];
      for (const id of model.ids) {
        const from = prior.place[id];
        const to = next.place[id];
        if (from.vis && to.vis && from.lane !== to.lane) flights.push({ id, kind: "flight", sortRow: from.row });
        else if (from.vis && !to.vis && model.heads.has(id) && strategyKey === "squash") flights.push({ id, kind: "absorb", sortRow: from.row });
        else if (!from.vis && to.vis && model.heads.has(id) && previous === "squash") flights.push({ id, kind: "emit", sortRow: to.row + 100 });
      }
      flights.sort((a, b) => b.sortRow - a.sortRow);
      const plan = new Map(flights.map((flight, index) => [flight.id, { kind: flight.kind, index }]));
      const settle = flights.length ? clock + (flights.length - 1) * 0.15 + 1.1 : clock;

      for (const id of model.ids) {
        const node = state.nodes.get(id) as NodeState;
        const from = prior.place[id];
        const to = next.place[id];
        const base = { fx: node.x, fy: node.y, fa: node.a, fs: node.s, tx: to.lane, ty: to.row, ta: +!!to.vis, hash: next.hash[id] };
        const step = plan.get(id);
        if (step) {
          const start = clock + 0.15 * step.index;
          Object.assign(node, base, {
            t0: start,
            dur: 1.1,
            kind: step.kind,
            land: start + 0.946,
            pulseAt: step.kind === "absorb" ? -9 : start + 0.946,
            hashAt: start + 0.88,
          });
          if (step.kind === "emit") node.fa = 0;
        } else if (!from.vis && to.vis) {
          const start = flights.length ? settle - 0.26 : clock + 0.16;
          Object.assign(node, base, {
            fx: to.lane,
            fy: to.row,
            fa: 0,
            fs: 0.35,
            t0: start,
            dur: 0.5,
            kind: "appear" as NodeKind,
            land: start + 0.22,
            pulseAt: start + 0.2,
            hashAt: start,
          });
        } else if (from.vis && !to.vis) {
          Object.assign(node, base, {
            tx: node.x,
            ty: node.y,
            t0: clock,
            dur: 0.24,
            kind: "fade" as NodeKind,
            land: clock,
            pulseAt: -9,
            hashAt: clock,
          });
        } else if (from.vis || to.vis) {
          const start = clock + 0.08 * +(flights.length > 0);
          const duration = 0.6 + 0.1 * Math.min(3, Math.abs(to.row - node.y));
          Object.assign(node, base, {
            t0: start,
            dur: duration,
            kind: "shift" as NodeKind,
            land: start + 0.6 * duration,
            hashAt: start,
          });
        } else {
          Object.assign(node, base, {
            fx: to.lane,
            fy: to.row,
            fa: 0,
            t0: clock,
            dur: 0,
            kind: "shift" as NodeKind,
            land: clock,
            pulseAt: -9,
            hashAt: clock,
          });
        }
      }

      let busy = settle;
      for (const edge of model.edges) {
        const edgeState = state.edges.get(edge.key) as EdgeState;
        const had = prior.edges.has(edge.key);
        if (next.edges.has(edge.key)) {
          if (had && edgeState.p > 0.999) {
            Object.assign(edgeState, { fp: 1, tp: 1, t0: clock, dur: 0, linear: false });
            continue;
          }
          const start = had ? clock : Math.max((state.nodes.get(edge.child) as NodeState).land, (state.nodes.get(edge.parent) as NodeState).land);
          Object.assign(edgeState, { fp: edgeState.p, tp: 1, t0: start, dur: 0.36, linear: false });
          busy = Math.max(busy, start + 0.36);
        } else {
          Object.assign(edgeState, { fp: edgeState.p, tp: 0, t0: clock, dur: 0.22, linear: false });
        }
      }

      for (const node of state.nodes.values()) busy = Math.max(busy, nodeEnd(node), node.pulseAt + 0.6);
      const growing = next.order.length >= state.height.v;
      state.height = { from: state.height.v, to: next.order.length, t0: growing ? clock : Math.max(clock, settle - 0.45), dur: 0.55, v: state.height.v };
      state.busyUntil = Math.max(busy, state.height.t0 + 0.55);
    }
    state.shown = strategyKey;
  }, []);

  const start = useCallback(() => {
    const state = engine.current;
    if (state.raf || !state.visible || document.hidden) return;
    state.last = 0;
    state.raf = requestAnimationFrame(frameFn.current);
  }, []);

  useLayoutEffect(() => {
    frameFn.current = (now: number) => {
      const state = engine.current;
      state.raf = 0;
      const model = state.model;
      if (!model || !state.visible || document.hidden) return;
      const live = params.current;
      const delta = Math.min(0.05, state.last ? (now - state.last) / 1000 : 0);
      state.last = now;
      state.clock += delta * Math.max(0, live.speed);

      const clock = state.clock;
      const height = state.height;
      const heightProgress = height.dur <= 0 ? 1 : clamp01((clock - height.t0) / height.dur);
      height.v = lerp(height.from, height.to, easeInOutCubic(heightProgress));
      const stage = stageRef.current;
      if (stage) write(stage, "height", `${round2(44 * height.v + 12)}px`, false);

      let busy = clock < state.busyUntil;

      for (const [id, node] of state.nodes) {
        stepNode(node, clock);
        const target = +(state.active === id);
        const blend = 1 - Math.exp(-(20 * delta));
        node.hv += (target - node.hv) * blend;
        if (Math.abs(target - node.hv) < 0.002) node.hv = target;
        else busy = true;

        const x = laneX(node.x);
        const y = rowY(node.y);
        const nodeElement = nodeRefs.current.get(id);
        if (nodeElement) {
          const scale = node.s * (1 + 0.38 * node.lift + 0.28 * node.hv);
          write(nodeElement, "transform", `translate(${round2(x)} ${round2(y)}) scale(${round2(scale)})`);
          write(nodeElement, "opacity", `${round2(node.a)}`);
        }

        const ring = ringRefs.current.get(id);
        if (ring) {
          const pulse = (clock - node.pulseAt) / 0.6;
          const pulsing = pulse >= 0 && pulse < 1;
          const eased = pulsing ? easeOut(pulse) : 0;
          write(ring, "cx", `${round2(x)}`);
          write(ring, "cy", `${round2(y)}`);
          write(ring, "r", `${round2(5 + 10 * eased)}`);
          write(ring, "opacity", pulsing ? `${round2(0.5 * (1 - pulse))}` : "0");
        }

        const row = rowRefs.current.get(id);
        if (row) {
          write(row, "transform", `translate3d(0, ${round2(44 * node.y)}px, 0) scale(${(1 + 0.008 * node.lift).toFixed(4)})`, false);
          write(row, "opacity", `${round2(node.ra)}`, false);
          write(row, "--lift", `${round2(node.lift)}`, false);
          write(row, "visibility", node.ra < 0.01 ? "hidden" : "visible", false);
          write(row, "z-index", node.lift > 0.01 ? "3" : "1", false);
        }

        const hash = hashRefs.current.get(id);
        const label = clock >= node.hashAt ? node.hash : node.shown || node.hash;
        if (hash && label !== node.shown) {
          const had = node.shown !== "";
          node.shown = label;
          hash.textContent = label;
          if (had) {
            hash.removeAttribute("data-flash");
            void hash.offsetWidth;
            hash.setAttribute("data-flash", "");
          }
        }
      }

      for (const edge of model.edges) {
        const progress = stepEdge(state.edges.get(edge.key) as EdgeState, clock);
        const element = edgeRefs.current.get(edge.key);
        if (!element) continue;
        if (progress <= 0.001) {
          write(element, "opacity", "0");
          continue;
        }
        const child = state.nodes.get(edge.child) as NodeState;
        const parent = state.nodes.get(edge.parent) as NodeState;
        write(element, "d", edgePath(laneX(parent.x), rowY(parent.y), laneX(child.x), rowY(child.y), edge.merge));
        write(element, "opacity", "1");
        write(element, "stroke-dasharray", progress >= 0.999 ? "none" : `${round2(progress)} 2`);
      }

      const card = cardRef.current;
      if (card && state.active) {
        const node = state.nodes.get(state.active);
        if (node) {
          const stageHeight = 44 * height.v + 12;
          const below = 6 + (node.y + 1) * 44 + 4;
          const folded = 6 + 44 * node.y - state.card.h - 4;
          const target = below + state.card.h > stageHeight + 24 && folded > -24 ? folded : below;
          if (!state.card.open) {
            state.card.y = target;
            state.card.open = true;
          }
          const blend = 1 - Math.exp(-(22 * delta));
          state.card.y += (target - state.card.y) * blend;
          if (Math.abs(target - state.card.y) < 0.3) state.card.y = target;
          else busy = true;
          write(card, "transform", `translate3d(0, ${round2(state.card.y)}px, 0)`, false);
        }
      } else {
        state.card.open = false;
      }

      if (
        live.autoplay &&
        !live.controlled &&
        !live.paused &&
        !live.reduced &&
        live.speed > 0 &&
        !state.touched &&
        !state.hovering &&
        state.introduced &&
        live.offered.length > 1
      ) {
        busy = true;
        if (clock > state.busyUntil + 2.6) {
          const order = AUTOPLAY.filter((entry) => live.offered.includes(entry));
          const next = order[(order.indexOf(live.strategy) + 1) % order.length];
          state.busyUntil = clock + 99;
          setInternal(next);
        }
      }

      if (busy) state.raf = requestAnimationFrame(frameFn.current);
    };
  }, [write]);

  useLayoutEffect(() => {
    const state = engine.current;
    sync(graph);
    if (state.shown === active && state.introduced) return;
    const instant = reduced || speed <= 0;
    if (state.introduced || instant) apply(graph, active, instant);
    else {
      if (!state.visible) return;
      apply(graph, active, false);
    }
    start();
    if (instant) {
      state.last = 0;
      const was = state.visible;
      state.visible = true;
      frameFn.current(performance.now());
      state.visible = was;
      if (state.raf && !was) {
        cancelAnimationFrame(state.raf);
        state.raf = 0;
      }
    }
  }, [graph, active, reduced, speed, apply, sync, start]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const state = engine.current;
    const observer = new IntersectionObserver(
      (entries) => {
        state.visible = entries.some((entry) => entry.isIntersecting);
        if (!state.visible) return;
        if (!state.introduced && state.model) {
          const instant = params.current.reduced || params.current.speed <= 0;
          apply(state.model, params.current.strategy, instant);
        }
        start();
      },
      { threshold: 0.15 },
    );
    observer.observe(root);
    const onVisible = () => {
      if (!document.hidden) start();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      if (state.raf) cancelAnimationFrame(state.raf);
      state.raf = 0;
    };
  }, [start, apply]);

  useEffect(() => {
    start();
  }, [paused, autoplay, speed, start]);

  useLayoutEffect(() => {
    const state = engine.current;
    state.active = openId;
    const card = cardRef.current;
    if (card && openId) {
      state.card.h = card.offsetHeight;
      const node = state.nodes.get(openId);
      const stageHeight = 44 * state.height.v + 12;
      if (node) setAbove(6 + (node.y + 1) * 44 + 4 + state.card.h > stageHeight + 24);
    }
    start();
  }, [openId, start]);

  const choose = useCallback(
    (next: BranchGraphStrategy, fromUser = true) => {
      if (fromUser) engine.current.touched = true;
      if (!controlled) setInternal(next);
      onStrategyChange?.(next);
      if (fromUser) setAnnounce(graph.layouts[next].summary);
    },
    [controlled, onStrategyChange, graph],
  );

  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const seg = segRef.current;
    if (!seg) return;
    const measure = () => {
      const button = seg.querySelector<HTMLElement>(`[data-value="${active}"]`);
      if (!button) return;
      setThumb((previous) => (previous && previous.x === button.offsetLeft && previous.w === button.offsetWidth ? previous : { x: button.offsetLeft, w: button.offsetWidth }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(seg);
    return () => observer.disconnect();
  }, [active, offered]);

  useEffect(() => {
    if (!openId) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && !stageRef.current?.contains(event.target as Node)) setInspected(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openId]);

  const heading = title ?? pullRequest.title;
  const gutter = 44 + (graph.lanes - 1) * 18;
  const openCommit = openId ? graph.commits[openId] : null;
  const [cardState, setCardState] = useState<{ id: string | null; session: number; open: boolean }>({ id: null, session: 0, open: false });
  if (openId && (cardState.id !== openId || !cardState.open)) {
    setCardState({ id: openId, session: cardState.open ? cardState.session : cardState.session + 1, open: true });
  } else if (!openId && cardState.open) {
    setCardState({ ...cardState, open: false });
  }
  const cardCommit = openCommit ?? (cardState.id ? graph.commits[cardState.id] ?? null : null);
  const headBranch = openCommit?.branch;
  const renderIds = [...layout.order, ...graph.ids.filter((id) => !layout.place[id].vis)];
  const optionId = (id: string) => `${uid}-c-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const rootStyle = { ...style, "--bg-gutter": `${gutter}px`, ...(accent ? { "--bg-base": accent } : null) } as CSSProperties;

  return (
    <section
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={rootStyle}
      aria-label={label ?? `${heading}, commit graph of ${graph.head} and ${graph.base}`}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") engine.current.hovering = true;
      }}
      onPointerLeave={() => {
        engine.current.hovering = false;
        start();
      }}
    >
      <div className={styles.header}>
        {heading ? (
          <div className={styles.heading}>
            <GitBranch className={styles.headIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
            <span className={styles.title}>{heading}</span>
            <span className={styles.number}>#{pullRequest.number}</span>
          </div>
        ) : null}
        {offered.length > 1 ? (
          <div
            ref={segRef}
            className={styles.seg}
            role="radiogroup"
            aria-label="Merge strategy preview"
            onKeyDown={(event) => {
              const index = offered.indexOf(active);
              let next = -1;
              if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % offered.length;
              else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + offered.length) % offered.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = offered.length - 1;
              if (next < 0) return;
              event.preventDefault();
              choose(offered[next]);
              segRef.current?.querySelector<HTMLElement>(`[data-value="${offered[next]}"]`)?.focus();
            }}
          >
            <span className={styles.thumb} aria-hidden="true" data-ready={thumb ? "" : undefined} style={thumb ? { transform: `translateX(${thumb.x}px)`, width: thumb.w } : undefined} />
            {offered.map((entry) => (
              <button
                key={entry}
                type="button"
                role="radio"
                data-value={entry}
                aria-checked={active === entry}
                tabIndex={active === entry ? 0 : -1}
                className={styles.segButton}
                onClick={() => {
                  if (entry !== active) choose(entry);
                }}
              >
                {STRATEGY_LABELS[entry]}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div
        ref={stageRef}
        className={styles.stage}
        style={{ height: 44 * graph.initial.length + 12 }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "mouse") return;
          if (document.activeElement !== event.currentTarget.querySelector("[role=listbox]")) setInspected(null);
        }}
      >
        <div
          className={styles.list}
          role="listbox"
          tabIndex={0}
          aria-label={`Commits, newest first. ${layout.summary}`}
          aria-activedescendant={openId ? optionId(openId) : undefined}
          onKeyDown={(event) => {
            const order = layout.order;
            const index = openId ? order.indexOf(openId) : -1;
            let next = -2;
            if (event.key === "ArrowDown") next = Math.min(order.length - 1, index + 1);
            else if (event.key === "ArrowUp") next = index < 0 ? 0 : Math.max(0, index - 1);
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = order.length - 1;
            else if (event.key === "Escape" && openId) {
              event.preventDefault();
              setInspected(null);
              return;
            }
            if (next === -2) return;
            event.preventDefault();
            engine.current.touched = true;
            setInspected(order[next]);
          }}
          onFocus={() => {
            if (!openId && layout.order.length) setInspected(layout.order[0]);
          }}
          onBlur={() => setInspected(null)}
        >
          {renderIds.map((id) => {
            const commit = graph.commits[id];
            const vis = layout.place[id].vis;
            const tags = layout.tags[id] ?? [];
            const merged = id === MERGE_ID || (commit.parents?.length ?? 0) > 1;
            const stats: string[] = [];
            if (commit.additions !== undefined) stats.push(plural(commit.additions, "addition"));
            if (commit.deletions !== undefined) stats.push(plural(commit.deletions, "deletion"));
            if (commit.files !== undefined) stats.push(plural(commit.files, "file"));
            return (
              <div
                key={id}
                ref={(element) => {
                  if (element) rowRefs.current.set(id, element);
                  else rowRefs.current.delete(id);
                }}
                id={vis ? optionId(id) : undefined}
                role={vis ? "option" : undefined}
                aria-selected={vis ? openId === id : undefined}
                aria-hidden={!vis || undefined}
                aria-label={
                  vis
                    ? `${commit.message}. ${layout.hash[id]} by ${commit.author.name}, ${commit.date}. ${stats.join(", ")}${tags.length ? `. ${tags.map((tag) => tag.name).join(" and ")} points here` : ""}.`
                    : undefined
                }
                className={styles.row}
                data-active={openId === id ? "" : undefined}
                data-dim={headBranch && commit.branch !== headBranch ? "" : undefined}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") setInspected(id);
                }}
                onPointerDown={(event) => {
                  engine.current.touched = true;
                  if (event.pointerType !== "mouse") setInspected((current) => (current === id ? null : id));
                }}
                style={{ transform: `translate3d(0, ${44 * graph.layouts.open.place[id].row}px, 0)`, opacity: 0 }}
              >
                <span className={styles.message}>
                  {merged ? <GitMerge className={styles.kindIcon} size={14} strokeWidth={1.75} aria-hidden="true" /> : null}
                  <span className={styles.messageText}>{commit.message}</span>
                  {tags.length ? (
                    <span key={`${active}-${tags.map((tag) => tag.name).join()}`} className={styles.tags}>
                      {tags.map((tag) => (
                        <span key={tag.name} className={styles.tag} style={{ "--tag": tag.color } as CSSProperties}>
                          <span className={styles.tagName}>{tag.name}</span>
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
                <span className={styles.author}>
                  {commit.author.avatar ? (
                    <img src={commit.author.avatar} alt="" width={20} height={20} decoding="async" draggable={false} />
                  ) : (
                    <span className={styles.initials}>{initials(commit.author.name)}</span>
                  )}
                </span>
                <span
                  className={styles.hash}
                  ref={(element) => {
                    if (element) hashRefs.current.set(id, element);
                    else hashRefs.current.delete(id);
                  }}
                />
                <span className={styles.date}>{commit.date}</span>
              </div>
            );
          })}
        </div>
        <svg ref={svgRef} className={styles.svg} width={gutter} aria-hidden="true" focusable="false">
          <g>
            {graph.edges.map((edge) => (
              <path
                key={edge.key}
                ref={(element) => {
                  if (element) edgeRefs.current.set(edge.key, element);
                  else edgeRefs.current.delete(edge.key);
                }}
                className={styles.edge}
                data-dim={headBranch && graph.commits[edge.child].branch !== headBranch && graph.commits[edge.parent].branch !== headBranch ? "" : undefined}
                style={{ stroke: edge.color }}
                pathLength={1}
                opacity={0}
              />
            ))}
          </g>
          <g>
            {graph.ids.map((id) => (
              <circle
                key={id}
                ref={(element) => {
                  if (element) ringRefs.current.set(id, element);
                  else ringRefs.current.delete(id);
                }}
                className={styles.ring}
                style={{ stroke: graph.colorOf[id] }}
                r={5}
                opacity={0}
              />
            ))}
          </g>
          <g>
            {graph.ids.map((id) => {
              const commit = graph.commits[id];
              const merged = id === MERGE_ID || (commit.parents?.length ?? 0) > 1;
              return (
                <g key={id} className={styles.nodeWrap} data-dim={headBranch && commit.branch !== headBranch ? "" : undefined}>
                  <g
                    ref={(element) => {
                      if (element) nodeRefs.current.set(id, element);
                      else nodeRefs.current.delete(id);
                    }}
                    opacity={0}
                  >
                    <circle className={styles.moat} r={8} />
                    <circle r={merged ? 4.25 : 5} strokeWidth={merged ? 2 : 0} style={{ fill: merged ? "var(--surface)" : graph.colorOf[id], stroke: graph.colorOf[id] }} />
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
        <div ref={cardRef} className={styles.cardWrap} data-open={openCommit ? "" : undefined} data-above={above ? "" : undefined} aria-hidden="true">
          {cardCommit ? (
            <div key={cardState.session} className={styles.card}>
              <div className={styles.cardTitle}>{cardCommit.message}</div>
              {cardCommit.body ? <p className={styles.cardBody}>{cardCommit.body}</p> : null}
              <div className={styles.cardMeta}>
                {cardCommit.author.avatar ? (
                  <img className={styles.cardAvatar} src={cardCommit.author.avatar} alt="" width={20} height={20} decoding="async" draggable={false} />
                ) : (
                  <span className={`${styles.initials} ${styles.cardAvatar}`}>{initials(cardCommit.author.name)}</span>
                )}
                <span className={styles.cardAuthor}>{cardCommit.author.name}</span>
                <span className={styles.cardDate}>{cardCommit.date}</span>
              </div>
              <div className={styles.cardFoot}>
                <span className={styles.cardHash}>
                  <GitCommitHorizontal size={14} strokeWidth={1.75} aria-hidden="true" />
                  {layout.hash[cardCommit.id]}
                </span>
                <span className={styles.stats}>
                  {cardCommit.additions !== undefined ? <span className={styles.add}>+{cardCommit.additions}</span> : null}
                  {cardCommit.deletions !== undefined ? <span className={styles.del}>−{cardCommit.deletions}</span> : null}
                  <DiffBlocks add={cardCommit.additions ?? 0} del={cardCommit.deletions ?? 0} />
                </span>
                {cardCommit.files !== undefined ? <span className={styles.files}>{plural(cardCommit.files, "file")}</span> : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className={styles.footer}>
        <span className={styles.summary}>{layout.summary}</span>
      </div>
      <div className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {announce}
      </div>
    </section>
  );
}

export default BranchGraph;
