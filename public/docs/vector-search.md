# Vector search

> Documents drop onto a tilted embedding plane and fold into points that cluster by topic; the index links neighbours, a query is typed, embedded and lowered onto the plane, a signal hops along the graph toward it, and a widening ring lights the nearest documents with connecting lines, similarity scores and a ranked list.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/vector-search
- Markdown: https://uiarc.dev/components/vector-search/markdown
- Source file: `registry/components/vector-search/vector-search.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, motion, illustration, new, vector search, embeddings, semantic search, nearest neighbours, similarity, rag, retrieval, vector database, hnsw, animated diagram

## When to use

- A feature section on semantic search, AI answers, or retrieval over a team's docs.
- Docs pages introducing embeddings, nearest neighbour search, or approximate indexes.

## When not to use

- Use search-index to explain keyword search with an inverted index.
- Use a real scatter or cluster chart to show an actual embedding projection.

## Installation

Vector search is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/vector-search
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { VectorSearch } from "@/components/arc/vector-search/vector-search";

export function RetrievalSection() {
  return <VectorSearch
    topics={[{ name: "Billing" }, { name: "Access" }, { name: "Deploys" }]}
    documents={[
      { title: "Refund a charge", topic: 0 },
      { title: "Update a card on file", topic: 0 },
      { title: "Download invoices", topic: 0 },
      { title: "Rotate an API key", topic: 1 },
      { title: "Scope API tokens", topic: 1 },
      { title: "Revoke a session", topic: 1 },
      { title: "Roll back a deploy", topic: 2 },
      { title: "Preview environments", topic: 2 },
      { title: "Add a custom domain", topic: 2 },
    ]}
    query="How do I rotate a leaked API key?"
    k={3}
  />;
}
```

## API reference

### VectorSearch

An animated vector search illustration. Documents drop onto a tilted embedding plane as small pages and fold into points in their topic color, while a readout beside the plane shows each one's title and vector. Similar documents land close together, so dashed clusters fade up around each topic and the index links every point to its nearest neighbours. Then the query is typed, embedded (its vector replaces the document's in the readout), and lowered onto the plane on a thin stem. A search signal enters the graph at the farthest point and hops along real links toward the query, lighting its path, before a ring widens from the query: each match it reaches gets a halo, a line to the query, and a similarity score, and fills a ranked list with the source of each document. Counters for embedded documents, links, and hops update in sync, and a step bar with play and pause replays or jumps between stages.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `documents` | `{ title: string; topic: number; source?: { name: string; icon?: string \| ReactNode; color?: string }; x?: number; y?: number }[]` | `18 help articles across Billing, Access, and Deploys` | Documents in the index, 6 to 24. topic indexes into topics. source is shown beside a match in the results: icon is Simple Icons path data (painted in color, or the text color when color is left out), an image URL for a full color logo, or a ReactNode. x and y place the point on the plane from -1 to 1; left out, points spiral around their topic's center. |
| `topics` | `{ name: string; color?: string }[]` | `Billing, Access, Deploys` | Topics the documents cluster by, two to four. Each gets a region of the plane, a dashed cluster, and a name chip. color overrides the chart series color. |
| `query` | `string` | `"How do I rotate a leaked API key?"` | The search query, typed into the readout before it is embedded. |
| `queryAt` | `{ x: number; y: number }` | – | Where the query lands on the plane, from -1 to 1. Defaults to beside the first document of the second topic. |
| `k` | `number` | `3` | How many nearest documents are returned, from 1 to 5. |
| `dimensions` | `number` | `1536` | Embedding size shown in the readout heading. |
| `labels` | `{ embed?; index?; query?; rank?; embedded?; links?; hops?; embedding?; queryHeading?; results?; queryChip? }` | `Embed, Index, Query, Rank, Embedded, Links, Hops, Embedding, Query, Nearest documents, Query` | Stage names in the step bar, the three counter names, the readout headings, the results heading, and the chip on the falling query. |
| `speed` | `number` | `1` | Multiplies the pace. At 1 the whole story takes about 18 seconds. 0 holds still. |
| `paused` | `boolean` | `false` | Holds the diagram still where it is, easing to rest instead of stopping in one frame. |
| `controls` | `boolean` | `true` | Shows the step bar with play and pause above the diagram. |
| `accent` | `string` | – | Color of the query, the search path and signal, the ring, the match lines, and the score bars. Defaults to the accent token. |
| `label` | `string` | – | Accessible description of the diagram. Built from the topics, the query, the hop count, and the real matches with their scores when left out. |
| `caption` | `ReactNode` | – | Optional visible caption under the diagram, rendered as a figcaption. |
| `className` | `string` | – | Extra class on the root figure. |
| `style` | `CSSProperties` | – | Inline styles on the root figure. |

## Accessibility

- The plane and its legend form one element with role="img" and an aria-label that explains the idea with the real values: how many documents cluster into which topics, the query, how many hops the search takes, and each match with its similarity score.
- The step bar is a group of real buttons named for each stage, with aria-current on the playing stage, plus a named play and pause button.
- Nothing relies on color alone: clusters carry name chips, matches are written out as a ranked list with titles, sources, and scores, and the counters are plain numbers.
- Points are not controls, so nothing else enters the tab order; hover tags only repeat the title, topic, and source that the list and label already give.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- One rAF loop writes SVG transforms, opacity, dash lengths, and a few text nodes straight to the DOM, and only when a value changed; React does not render per frame.
- The whole story is a pure function of time, so the loop repeats seamlessly: pages fall and fold into points, clusters and links draw in, the query is typed and lowered, the signal hops, the ring finds the matches, and the plane clears.
- The signal hops along the real shortest route through the index graph, and each hop's duration scales with the link's length, so the pace stays even. Hops arc slightly above the plane.
- The ring widens on an eased curve, and each match lights at the exact moment the ring reaches it; the time is solved from the curve, so halo, line, score chip, and ranked row stay in sync.
- Speed changes, pausing, and hover (which slows the story a little) ease on a critically damped spring. Readout bars and result bars ease with the standard and considered durations.
- The loop stops off screen, in hidden tabs, and when paused. Reduced motion shows the answer as a still frame: every point placed, the path walked, the matches linked and scored; the step bar still jumps between still frames of each stage.

## Responsive behavior

- The plane is measured in real pixels and drawn in an SVG viewBox of that size, so hairlines and text stay crisp at any width.
- From 720px of container width the legend sits beside the plane; below it the legend drops under the plane. The story is the same.
- Cluster names sit above clusters at the back and below clusters at the sides, and score chips sit on the side of each match facing away from the query, so labels stay apart even at 390px.
- Hover tags only appear for a mouse; touch shows the same diagram without them.

## Performance

- About 150 small SVG and HTML elements, driven by a single loop that caches every written value.
- Positions, the index graph, the search route, and every timing are computed once per layout; nothing is measured per frame.

## Notes for AI

- Use it to explain semantic search, embeddings, RAG retrieval, or a vector database on a landing page or in docs.
- Keep titles short, like help center article names. Three topics with five or six documents each read best.
- Rankings and scores are computed from the positions on the plane, so they always match the picture. To make a specific document the top match, list it first in its topic or pass queryAt near it.
- Sources are sample content: use real brand marks only for the tools the documents actually come from.

## Related

- [Model training](https://uiarc.dev/components/model-training/markdown): Training data batches feed a small neural net diagram whose connections strengthen, a loss curve descends beside it, and an evaluation check turns green at the end.
- [Data flow](https://uiarc.dev/components/data-flow/markdown): Data flow illustration. Sources (app, database, events) are on the left, a processing core with a live count sits in the middle, and destinations (warehouse, dashboard, alerts) are on the right. Records leave as hollow dots and travel curved paths. In the core they turn into solid accent squares, then fan out to each destination; alerts receives about every third record.

## Also in illustrations

- [Payment flow](https://uiarc.dev/components/payment-flow/markdown): A card tap goes to a processor, then the network, then the bank and back with authorization, then settlement; each hop lights up with a status label and the amount travels as a chip.
- [DNS resolution](https://uiarc.dev/components/dns-resolution/markdown): A browser asks for a domain and the query hops from the resolver to a root server, the TLD server and the authoritative nameserver, each pointing to the next, until an IP address comes back and the page connects. The resolver keeps the answer with a TTL ring that drains, and a second lookup is answered straight from that cache in one short hop.
- [Multi-region failover](https://uiarc.dev/components/multi-region-failover/markdown): Animated multi-region failover on a 2.5D stage: users stream requests through a global load balancer to two regions; the primary degrades, fails three health checks, traffic shifts smoothly to the healthy region, then it recovers, passes three checks and traffic ramps back to an even split.
- [Branch graph](https://uiarc.dev/components/branch-graph/markdown): A git commit graph where branches draw in as colored lanes, merge commits join lines, a rebase lifts commits and replays them onto main, a squash folds them into one, and hovering a commit shows its message, author and diff stats.
- [Agent loop](https://uiarc.dev/components/agent-loop/markdown): An illustration of the agent loop: gather context, take action, verify, repeat, with a bright head circling three stations around the model.
- [Mixture of experts](https://uiarc.dev/components/mixture-of-experts/markdown): An illustration of mixture of experts routing: each token is scored by a router, travels to its top experts, and their outputs merge into the token's result.
- [Speculative decoding](https://uiarc.dev/components/speculative-decoding/markdown): An illustration of speculative decoding: a fast draft model guesses a few tokens, the target model checks them in one pass, and accepted guesses join the answer.
- [Prompt cache](https://uiarc.dev/components/prompt-cache/markdown): An animated explainer for prompt caching: the shared prefix of each request is cached once, later requests read it back, and the cost and time saved add up.
- [Reasoning tree](https://uiarc.dev/components/reasoning-tree/markdown): An illustration of tree search over thoughts: candidates are scored, weak branches fade, the best expand, and the winning path from question to answer draws in.

## Guidance for AI tools

Vector search: Documents drop onto a tilted embedding plane and fold into points that cluster by topic; the index links neighbours, a query is typed, embedded and lowered onto the plane, a signal hops along the graph toward it, and a widening ring lights the nearest documents with connecting lines, similarity scores and a ranked list. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
