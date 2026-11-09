# Data flow

> Data flow illustration. Sources (app, database, events) are on the left, a processing core with a live count sits in the middle, and destinations (warehouse, dashboard, alerts) are on the right. Records leave as hollow dots and travel curved paths. In the core they turn into solid accent squares, then fan out to each destination; alerts receives about every third record.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/data-flow
- Markdown: https://uiarc.dev/components/data-flow/markdown
- Source file: `registry/components/data-flow/data-flow.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, motion, illustration, new, data flow, pipeline illustration, etl, data pipeline, event routing, animated diagram, fan out, ingestion, transform

## When to use

- A hero or feature section explaining how data moves through a product.
- Docs pages introducing an ingestion, transform, or routing concept.
- Integration pages that show which sources feed which destinations.

## When not to use

- Use sankey-flow to show real volumes between stages.
- Use pipeline-status for the live state of a CI or data job.
- Use a table or list when people need to act on individual records.

## Installation

Data flow is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/data-flow
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { DataFlow } from "@/components/arc/data-flow/data-flow";
import { AppWindow, LayoutDashboard, Warehouse } from "lucide-react";

// Image URLs keep full brand color; lucide icons follow the muted text color.
const sources = [
  { label: "App", meta: "Web and iOS", icon: <AppWindow /> },
  { label: "Database", meta: "Supabase", icon: "/logos/supabase-color.svg" },
  { label: "Events", meta: "Stripe webhooks", icon: "/logos/stripe-color.svg" },
];
const destinations = [
  { label: "Warehouse", meta: "Every record", icon: <Warehouse /> },
  { label: "Dashboard", meta: "Live metrics", icon: <LayoutDashboard /> },
  { label: "Alerts", meta: "Slack", icon: "/logos/slack-color.svg", share: 0.34 },
];

export function PipelineHero() {
  return <DataFlow sources={sources} destinations={destinations} core={{ label: "Transform" }} />;
}
```

## API reference

### DataFlow

An animated data flow illustration. Sources sit on one side, a processing core in the middle, and destinations on the other. Raw records leave the sources as hollow dots, travel curved paths into the core, turn into solid accent squares as they are processed, and fan out to every destination that takes them. A live count under the core ticks up as records are processed, and hovering a node highlights its path and records with a one line tag.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `sources` | `{ id?: string; label: string; meta?: string; detail?: string; icon?: string \| ReactNode; color?: string }[]` | `App, Database, Events` | Where records come from. Three read best. meta is the second line (hidden on narrow layouts), detail is the hover tag. icon is SVG path data on a 24 by 24 viewBox painted in color, an image URL for a full color logo, or any ReactNode. |
| `destinations` | `{ id?: string; label: string; meta?: string; detail?: string; icon?: string \| ReactNode; color?: string; share?: number }[]` | `Warehouse, Dashboard, Alerts` | Where processed records go. share (0 to 1) thins out a destination evenly, so 0.34 sends about every third record, as alerts do in the default. |
| `core` | `{ label?: string; detail?: string; countLabel?: string; countStart?: number }` | `{ label: "Transform", countLabel: "processed", countStart: 12480 }` | The processing step: its name, hover tag, the word after the live count, and the number the count starts from. |
| `speed` | `number` | `1` | Multiplies the flow speed. At 1 a record takes about four seconds end to end. 0 holds still. |
| `paused` | `boolean` | `false` | Holds the flow still where it is, easing to rest instead of stopping in one frame. |
| `accent` | `string` | – | Color of processed records, trails, and active paths. Defaults to the accent token. |
| `label` | `string` | – | Accessible description of the diagram. Built from the source, core, and destination labels when left out. |
| `caption` | `ReactNode` | – | Optional visible caption under the diagram, rendered as a figcaption. |
| `className` | `string` | – | Extra class on the root figure. |
| `style` | `CSSProperties` | – | Inline styles on the root figure. |

## Accessibility

- The diagram is one element with role="img" and an aria-label that describes the whole flow, built from the labels unless label is passed.
- Nodes are not controls, so nothing enters the tab order; hover tags repeat detail that is optional.
- Raw and processed records differ in shape (hollow dot, solid square), not only color.
- Pass caption for a visible explanation under the diagram.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- One rAF loop writes SVG transforms, opacity, and dash offsets straight to the DOM, and only when a value changed; React does not render per frame.
- Records travel along real cubic paths at an even pace from an arc length table, eased in and out on each leg, with a short trail that stops at the core outline.
- In the core each record swells slightly as it morphs from a hollow dot into an accent square, the core outline widens and fades, and the dashed ring quickens for a moment. On the way out one copy carries the record while the others fade in as they split off, so the fan out never clumps.
- Six records per 6.6 second cycle are a pure function of time, so the loop repeats seamlessly; ports and node borders light up as records leave and land.
- Speed changes, pausing, and hover (which slows the flow a little) ease on a critically damped spring.
- The loop stops off screen, in hidden tabs, and when paused. Reduced motion shows a still frame: a raw record on each in path and a processed record on each out path.

## Responsive behavior

- From 600px wide the flow runs left to right with two line nodes; below that it stacks top to bottom with sources in a row above the core and destinations below.
- The diagram is measured in real pixels and drawn in an SVG viewBox of that size, so text and hairlines stay crisp at any width.
- Hover tags only appear for a mouse; touch shows the same diagram without them.

## Performance

- About forty SVG elements move, from a single loop that caches every written value.
- Paths are sampled once per layout into a small length table; nothing is measured per frame.

## Notes for AI

- Use it to explain a pipeline on a landing page or in docs: ingestion, ETL, event routing, sync.
- Keep labels to one or two words and put the product in meta, such as Database with Supabase.
- Use real brand logos only where the product matters to the story; keep generic roles on lucide icons.
- Use share on destinations that receive a subset, such as alerts, so the fan out tells the truth.

## Related

- [Sankey flow](https://uiarc.dev/components/sankey-flow/markdown): Flows between stages as ribbons with drifting particles; hover any node or ribbon to pour its share through the whole journey.
- [Orbit logos](https://uiarc.dev/components/orbit-logos/markdown): An integrations showcase with brand logos orbiting your product mark on tilted rings. Hover or focus one to rest the orbit, draw a connection, and see what it does.
- [Realtime stream](https://uiarc.dev/components/realtime-stream/markdown): A live line that scrolls at 60fps as readings arrive, holds still on hover to read, and pops a marker on every anomaly.

## Also in illustrations

- [Payment flow](https://uiarc.dev/components/payment-flow/markdown): A card tap goes to a processor, then the network, then the bank and back with authorization, then settlement; each hop lights up with a status label and the amount travels as a chip.
- [DNS resolution](https://uiarc.dev/components/dns-resolution/markdown): A browser asks for a domain and the query hops from the resolver to a root server, the TLD server and the authoritative nameserver, each pointing to the next, until an IP address comes back and the page connects. The resolver keeps the answer with a TTL ring that drains, and a second lookup is answered straight from that cache in one short hop.
- [Model training](https://uiarc.dev/components/model-training/markdown): Training data batches feed a small neural net diagram whose connections strengthen, a loss curve descends beside it, and an evaluation check turns green at the end.
- [Multi-region failover](https://uiarc.dev/components/multi-region-failover/markdown): Animated multi-region failover on a 2.5D stage: users stream requests through a global load balancer to two regions; the primary degrades, fails three health checks, traffic shifts smoothly to the healthy region, then it recovers, passes three checks and traffic ramps back to an even split.
- [Vector search](https://uiarc.dev/components/vector-search/markdown): Documents drop onto a tilted embedding plane and fold into points that cluster by topic; the index links neighbours, a query is typed, embedded and lowered onto the plane, a signal hops along the graph toward it, and a widening ring lights the nearest documents with connecting lines, similarity scores and a ranked list.
- [Branch graph](https://uiarc.dev/components/branch-graph/markdown): A git commit graph where branches draw in as colored lanes, merge commits join lines, a rebase lifts commits and replays them onto main, a squash folds them into one, and hovering a commit shows its message, author and diff stats.
- [Agent loop](https://uiarc.dev/components/agent-loop/markdown): An illustration of the agent loop: gather context, take action, verify, repeat, with a bright head circling three stations around the model.
- [Mixture of experts](https://uiarc.dev/components/mixture-of-experts/markdown): An illustration of mixture of experts routing: each token is scored by a router, travels to its top experts, and their outputs merge into the token's result.
- [Speculative decoding](https://uiarc.dev/components/speculative-decoding/markdown): An illustration of speculative decoding: a fast draft model guesses a few tokens, the target model checks them in one pass, and accepted guesses join the answer.
- [Prompt cache](https://uiarc.dev/components/prompt-cache/markdown): An animated explainer for prompt caching: the shared prefix of each request is cached once, later requests read it back, and the cost and time saved add up.
- [Reasoning tree](https://uiarc.dev/components/reasoning-tree/markdown): An illustration of tree search over thoughts: candidates are scored, weak branches fade, the best expand, and the winning path from question to answer draws in.

## Guidance for AI tools

Data flow: Data flow illustration. Sources (app, database, events) are on the left, a processing core with a live count sits in the middle, and destinations (warehouse, dashboard, alerts) are on the right. Records leave as hollow dots and travel curved paths. In the core they turn into solid accent squares, then fan out to each destination; alerts receives about every third record. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
