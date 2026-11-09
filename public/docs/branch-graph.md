# Branch graph

> A git commit graph where branches draw in as colored lanes, merge commits join lines, a rebase lifts commits and replays them onto main, a squash folds them into one, and hovering a commit shows its message, author and diff stats.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/branch-graph
- Markdown: https://uiarc.dev/components/branch-graph/markdown
- Source file: `registry/components/branch-graph/branch-graph.tsx`
- Dependencies: lucide-react
- Keywords: special, git, graph, developer, motion, new, commit graph, branch, merge, rebase, squash, pull request, history, version control, developer tools, diff stats

## When to use

- A merge strategy picker in a code review or pull request screen, showing exactly what main will look like afterwards.
- A commit history panel in a developer tool, with hover details and keyboard browsing.
- Docs and landing pages for version control or CI products that explain merge, rebase, and squash.

## When not to use

- Use git-branches for a looping, non-interactive illustration of a branch, pull request, and release.
- Use a timeline or changelog for releases people need to read rather than a commit graph.
- Use a virtualized table for long real histories; this graph is built for a focused slice of about five to fifteen commits.

## Installation

Branch graph is part of Arc Pro. The live preview is public; the source and install command need Pro.

### CLI with a Pro token

1. Create a token in your account and set it in the environment (or `.env.local`). Never commit it.

```bash
export ARC_PRO_TOKEN=arc_pro_...
```

2. Add the Pro registry to `components.json`:

```json
{
  "registries": {
    "@uiarc": "https://uiarc.dev/r/{name}.json",
    "@uiarc-pro": {
      "url": "https://uiarc.dev/r/pro/{name}.json",
      "headers": {
        "Authorization": "Bearer ${ARC_PRO_TOKEN}"
      }
    }
  }
}
```

3. Install:

```bash
npx shadcn@latest add @uiarc-pro/branch-graph
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { BranchGraph } from "@/components/arc/branch-graph/branch-graph";

const ada = { name: "Ada Park", avatar: "/people/ada.jpg" };

const commits = [
  { id: "c3", hash: "b81f2e0", message: "Rank results by recency", branch: "feat/search", parents: ["c2"], author: ada, date: "1 hour ago", additions: 64, deletions: 9, files: 3 },
  { id: "m2", hash: "4a0c9d1", message: "Upgrade to Node 22", branch: "main", parents: ["m1"], author: ada, date: "3 hours ago", additions: 8, deletions: 8, files: 2 },
  { id: "c2", hash: "e27d4b3", message: "Index docs on publish", branch: "feat/search", parents: ["m1"], author: ada, date: "Yesterday", additions: 210, deletions: 12, files: 7 },
  { id: "m1", hash: "93c5a07", message: "Launch docs site", branch: "main", parents: [], author: ada, date: "2 days ago", additions: 540, deletions: 0, files: 31 },
];

export function MergePreview() {
  return (
    <BranchGraph
      commits={commits}
      branches={[{ name: "main" }, { name: "feat/search" }]}
      pullRequest={{ number: 1207, title: "Instant search", branch: "feat/search" }}
      autoplay={false}
    />
  );
}
```

## API reference

### BranchGraph

An interactive commit graph with a merge preview. Branches draw in as colored lanes from the oldest commit up, and merge commits join their lines with clean curves. A strategy control replays the pull request as a merge commit that joins both lines, a rebase that lifts the branch's commits like cards and replays them on top of the base branch with new hashes, or a squash that folds them into one commit. Hovering or arrowing to a commit shows its message, author, and diff stats, and dims every other branch.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `commits` | `{ id: string; hash: string; message: string; body?: string; branch: string; parents?: string[]; author: { name: string; avatar?: string }; date: string; additions?: number; deletions?: number; files?: number }[]` | `a checkout pull request with a merged fix` | Commits, newest first. parents lists parent ids; a second parent makes a merge commit. date is display text such as "2 hours ago", so server and client agree. |
| `branches` | `{ name: string; color?: string }[]` | `main, feat/checkout, fix/rounding` | Branches in lane order. The first is the base branch the pull request merges into. Colors default to the chart series palette; the first lane follows the accent. |
| `pullRequest` | `{ number: number; title: string; branch: string }` | `{ number: 482, title: "Checkout redesign", branch: "feat/checkout" }` | The pull request being previewed. Its branch's commits are the ones that merge, rebase, or squash; the title names the squashed commit. |
| `strategy` | `"open" \| "merge" \| "rebase" \| "squash"` | – | Controlled strategy. open is the history before merging. Pair with onStrategyChange. |
| `defaultStrategy` | `"open" \| "merge" \| "rebase" \| "squash"` | `"open"` | Starting strategy when uncontrolled. |
| `onStrategyChange` | `(strategy) => void` | – | Called when a strategy is picked. |
| `strategies` | `("open" \| "merge" \| "rebase" \| "squash")[]` | `all four` | Strategies offered in the control, in order. Pass one to hide the control. |
| `title` | `string` | `the pull request title` | Visible title with the pull request number. Pass an empty string to hide it. |
| `autoplay` | `boolean` | `true` | Cycles before, rebase, merge, and squash while nobody interacts. Hover holds it; the first pick, tap, or key press stops it for good. Only when uncontrolled. |
| `speed` | `number` | `1` | Multiplies the pace of every animation. 0 jumps straight to each state. |
| `paused` | `boolean` | `false` | Holds the autoplay where it is. Picks by the user still animate. |
| `accent` | `string` | – | Any CSS color for the base lane and hash rewrites. Defaults to the first chart series, which follows the accent. |
| `label` | `string` | – | Accessible name of the component. Built from the title and branch names when left out. |
| `className` | `string` | – | Class on the root element. |
| `style` | `CSSProperties` | – | Inline styles on the root element. |

## Accessibility

- The root is a labelled section. The strategy control is a radiogroup of real radio buttons with a roving tab stop; arrow keys, Home, and End pick a strategy.
- Commits form a listbox in visual order, newest first. Up and Down, Home, and End move through commits with aria-activedescendant; Escape closes the commit card. Each option is named with its message, hash, author, date, diff stats, and the branches that point to it.
- A polite live region announces the result of every strategy picked by the user, such as how many commits were replayed and that they got new hashes. Autoplay changes are not announced.
- The graph and the commit card are aria-hidden because the listbox carries the same information. Branch color is always paired with a named tag, merge commits carry an icon and a hollow dot, and additions and deletions carry + and − signs, so nothing relies on color alone.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring. The keyboard commit takes the hover fill and shows its card.

## Motion

- One rAF loop writes SVG path data, transforms, and opacity straight to the DOM and skips every value that did not change. React renders only when the strategy or the inspected commit changes.
- Edges are computed each frame from the live positions of their two commits, so lines stretch and bend with them. A branch bends near its parent and a merge bends near its child, like a real git client.
- The entrance draws each line up from the oldest commit at a constant pace, and every commit lands as its line reaches it.
- A rebase lifts the branch's rows into floating cards, carries them one after another along an eased arc into the base lane, and sets them down with a soft ring while their hashes rewrite in place. The old branch point retracts first and the new link to the base tip draws in after the commits land.
- A merge makes room at the top, then the merge commit lands and both lines draw into it. A squash flies the commits into one point where the squashed commit appears; undoing it replays them back out. Every transition starts from wherever things are, so picking a new strategy mid-flight never jumps.
- The loop runs only while something moves or autoplay is waiting, and stops off screen and in hidden tabs. With reduced motion the graph shows each state immediately with no entrance, flights, or autoplay.

## Responsive behavior

- The graph is drawn in real pixels in an SVG beside the rows, so hairlines and dots stay crisp at any width.
- Container queries drop the date below 720px, the author below 560px, and the hash below 400px; the full details stay in the hover card and each option's accessible name. The strategy control takes a full row on phones.
- On touch, a tap on a commit pins its card and a tap elsewhere closes it.

## Performance

- About sixty SVG and HTML elements are updated from one loop with a write cache, so a quiet frame touches nothing.
- Every layout is computed once per data set. Nothing is measured inside the loop.

## Notes for AI

- Use it where people choose how a pull request lands: a merge button, a code review tool, or docs that teach merge, rebase, and squash.
- Pass commits newest first with real parent ids. Keep the pull request branch to two to five commits and use two or three lanes; more lanes read as noise.
- Keep branch names short, like feat/search. The hover card holds the longer story in body.
- The merge, rebase, and squash states are previews computed from the data. Say so if the page could be read as the live state of a repository.

## Related

- [Timeline](https://uiarc.dev/components/timeline/markdown): Follow what happened, newest first, grouped by day.

## Also in illustrations

- [Data flow](https://uiarc.dev/components/data-flow/markdown): Data flow illustration. Sources (app, database, events) are on the left, a processing core with a live count sits in the middle, and destinations (warehouse, dashboard, alerts) are on the right. Records leave as hollow dots and travel curved paths. In the core they turn into solid accent squares, then fan out to each destination; alerts receives about every third record.
- [Payment flow](https://uiarc.dev/components/payment-flow/markdown): A card tap goes to a processor, then the network, then the bank and back with authorization, then settlement; each hop lights up with a status label and the amount travels as a chip.
- [DNS resolution](https://uiarc.dev/components/dns-resolution/markdown): A browser asks for a domain and the query hops from the resolver to a root server, the TLD server and the authoritative nameserver, each pointing to the next, until an IP address comes back and the page connects. The resolver keeps the answer with a TTL ring that drains, and a second lookup is answered straight from that cache in one short hop.
- [Model training](https://uiarc.dev/components/model-training/markdown): Training data batches feed a small neural net diagram whose connections strengthen, a loss curve descends beside it, and an evaluation check turns green at the end.
- [Multi-region failover](https://uiarc.dev/components/multi-region-failover/markdown): Animated multi-region failover on a 2.5D stage: users stream requests through a global load balancer to two regions; the primary degrades, fails three health checks, traffic shifts smoothly to the healthy region, then it recovers, passes three checks and traffic ramps back to an even split.
- [Vector search](https://uiarc.dev/components/vector-search/markdown): Documents drop onto a tilted embedding plane and fold into points that cluster by topic; the index links neighbours, a query is typed, embedded and lowered onto the plane, a signal hops along the graph toward it, and a widening ring lights the nearest documents with connecting lines, similarity scores and a ranked list.
- [Agent loop](https://uiarc.dev/components/agent-loop/markdown): An illustration of the agent loop: gather context, take action, verify, repeat, with a bright head circling three stations around the model.
- [Mixture of experts](https://uiarc.dev/components/mixture-of-experts/markdown): An illustration of mixture of experts routing: each token is scored by a router, travels to its top experts, and their outputs merge into the token's result.
- [Speculative decoding](https://uiarc.dev/components/speculative-decoding/markdown): An illustration of speculative decoding: a fast draft model guesses a few tokens, the target model checks them in one pass, and accepted guesses join the answer.
- [Prompt cache](https://uiarc.dev/components/prompt-cache/markdown): An animated explainer for prompt caching: the shared prefix of each request is cached once, later requests read it back, and the cost and time saved add up.
- [Reasoning tree](https://uiarc.dev/components/reasoning-tree/markdown): An illustration of tree search over thoughts: candidates are scored, weak branches fade, the best expand, and the winning path from question to answer draws in.

## Guidance for AI tools

Branch graph: A git commit graph where branches draw in as colored lanes, merge commits join lines, a rebase lifts commits and replays them onto main, a squash folds them into one, and hovering a commit shows its message, author and diff stats. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
