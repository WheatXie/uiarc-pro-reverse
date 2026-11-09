# Multi-region failover

> Animated multi-region failover on a 2.5D stage: users stream requests through a global load balancer to two regions; the primary degrades, fails three health checks, traffic shifts smoothly to the healthy region, then it recovers, passes three checks and traffic ramps back to an even split.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/multi-region-failover
- Markdown: https://uiarc.dev/components/multi-region-failover/markdown
- Source file: `registry/components/multi-region-failover/multi-region-failover.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, motion, illustration, new, failover, multi-region, region, high availability, disaster recovery, load balancer, global load balancing, dns failover, health check, traffic shift, weights, rebalance, outage, isometric, animated diagram, landing page, docs

## When to use

- A reliability, infrastructure or pricing page that needs to show why running in two regions keeps a service up during an outage.
- Docs for health checks, failover policies, traffic weights or slow start, where viewers should step through detection, failover, recovery and rebalance.
- Incident write-ups and postmortems that explain how traffic moved during a regional outage.

## When not to use

- Use database-replication to show a primary database failing over to a replica.
- Use circuit-breaker for one service failing fast against a failing dependency.
- Use autoscale for instances added and removed with load in one place.
- Use a real status or monitoring component to report actual region health.

## Installation

Multi-region failover is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/multi-region-failover
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { MultiRegionFailover } from "@/components/arc/multi-region-failover/multi-region-failover";

export function FailoverSection() {
  return (
    <MultiRegionFailover
      hostname="api.acme.dev"
      requestsPerSecond={12000}
      nodes={{
        primary: { label: "US East", meta: "us-east-1" },
        secondary: { label: "EU West", meta: "eu-west-1" },
      }}
    />
  );
}
```

## API reference

### MultiRegionFailover

An animated multi-region failover on a layered 2.5D stage. Users send a steady stream of requests to a global load balancer that splits them between two regions, each a platform of six instances. The instances in the primary region fail one by one, requests there turn into errors and three health checks fail in a row, so the balancer marks the region unhealthy and shifts its weight smoothly to the healthy region. The primary recovers, has to pass three checks, and traffic ramps back until the split is even again. A step scrubber replays the story or jumps to any stage, and the weight bar, the dial on the balancer, error rate, requests per second, latency and status chips all update in sync.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `hostname` | `string` | `"api.acme.dev"` | The hostname the balancer answers for, shown under it and in the default description. |
| `requestsPerSecond` | `number` | `12000` | Total requests per second from users. Each region's counter shows its share of it. |
| `latencyMs` | `number` | `38` | Median latency of the primary region while the split is even. The secondary runs 4 ms slower and climbs as it takes the whole load. |
| `nodes` | `Partial<Record<"users" \| "balancer" \| "primary" \| "secondary", { label?: string; meta?: string; detail?: string; icon?: string \| ReactNode; color?: string }>>` | `Users, Load balancer, US East (us-east-1), EU West (eu-west-1)` | Overrides per node: the name, a meta line, the hover detail and an optional mark (Simple Icons path data, an image URL or a ReactNode). The region names also label the weight split and the captions. |
| `speed` | `number` | `1` | Multiplies the pace. One outage and recovery cycle takes 21 seconds at 1. 0 holds still. |
| `paused` | `boolean` | `false` | Holds the animation, easing to rest. Paused from the start, it shows the moment traffic shifts away from the unhealthy region. |
| `accent` | `string` | – | Any CSS color for the requests, lit routes, the weight dial, the split bar and the scrubber. Defaults to the theme accent. Errors and health always use the status colors. |
| `controls` | `boolean` | `true` | Shows the step scrubber with a pause button. Each step is a button that jumps to that stage; arrow keys move between them. |
| `caption` | `boolean` | `true` | Shows the current stage title and one line that narrates it under the scrubber. |
| `label` | `string` | – | Accessible description. Defaults to a sentence built from the hostname and the region names. |
| `className` | `string` | – | Class on the root figure. |
| `style` | `CSSProperties` | – | Inline styles on the root figure. |

## Accessibility

- The drawing is role="img" with an aria-label that tells the whole story: the split, the failing region, the failed checks, the shift to the healthy region and the gradual return. Pass label to write your own.
- Labels, counters, the moving health check chip and hover tags inside the drawing are part of that image, and the narrated caption is hidden from assistive technology, so screen readers hear one stable description instead of a changing loop.
- The scrubber is a group of real buttons named Step 1 of 6 and so on; the current step carries aria-current="step", arrow keys, Home and End move between steps, and the pause button reports its state with aria-pressed.
- Status is never color alone: every chip pairs its dot with words such as Failed checks 2/3, Out of rotation, Warming up 62% or Errors 27.3%, and failing instances also change their outline.

## Motion

- One requestAnimationFrame loop writes SVG attributes, transforms, opacity and text directly, and only when a value changed; React never re-renders per frame.
- Requests are a deterministic stream: each one is routed by the balancer weight at the moment it reaches the balancer and lands on a specific instance, which flashes. Requests to a down instance stall, turn to errors and fade.
- Requests travel along real arcs at an even pace with a glide ease, so they gather at the balancer and fan out, with a shadow that slides along the floor and shrinks as they rise, which gives the 2.5D depth.
- Every frame is a pure function of one clock, so the weights, counters, checks, statuses and scrubber stay in sync, jumps land exactly, and the loop is seamless because the last frame is the balanced first frame.
- Pausing, speed changes and the gentle hover slowdown ease on a critically damped spring. The loop stops offscreen and in a hidden tab and resumes where it left off.
- With reduced motion there is no travel or loop: the stage shows a settled frame of the failover, and the scrubber switches between settled frames of each stage.

## Responsive behavior

- The drawing is one SVG with a viewBox and non-scaling one pixel strokes. At 640px and wider it uses a landscape stage with the regions stacked on the right; below that a portrait stage with users on top, the balancer in the middle and the two regions side by side.
- Labels, status chips, counters, the weight split and the moving health check chip are HTML placed by percentage, so text stays at its real size at every width.
- Container queries hide the step names on phones (the caption names the current step) and the meta lines in the narrowest landscape range. Scrubber buttons keep a tall touch target.

## Performance

- About 130 small SVG nodes, with a fixed pool of 15 request dots reused across the stream. Each frame writes only values that changed, and nothing runs offscreen or in a background tab.
- Geometry and arc length tables are built once per layout; resizing only rescales the moving health check chip.
- No canvas, images, filters or blur.

## Notes for AI

- Use it as an explanatory figure on a landing page, a docs page or a blog post about high availability, disaster recovery, global load balancing, DNS failover or health checks.
- Keep region names and codes realistic. The outage, traffic and timings are a simulation and take no live data.
- Only add a brand mark where it is true to the story, such as the load balancer provider. Brands are sample content, never an endorsement.

## Related

- [DNS resolution](https://uiarc.dev/components/dns-resolution/markdown): A browser asks for a domain and the query hops from the resolver to a root server, the TLD server and the authoritative nameserver, each pointing to the next, until an IP address comes back and the page connects. The resolver keeps the answer with a TTL ring that drains, and a second lookup is answered straight from that cache in one short hop.

## Also in illustrations

- [Data flow](https://uiarc.dev/components/data-flow/markdown): Data flow illustration. Sources (app, database, events) are on the left, a processing core with a live count sits in the middle, and destinations (warehouse, dashboard, alerts) are on the right. Records leave as hollow dots and travel curved paths. In the core they turn into solid accent squares, then fan out to each destination; alerts receives about every third record.
- [Payment flow](https://uiarc.dev/components/payment-flow/markdown): A card tap goes to a processor, then the network, then the bank and back with authorization, then settlement; each hop lights up with a status label and the amount travels as a chip.
- [Model training](https://uiarc.dev/components/model-training/markdown): Training data batches feed a small neural net diagram whose connections strengthen, a loss curve descends beside it, and an evaluation check turns green at the end.
- [Vector search](https://uiarc.dev/components/vector-search/markdown): Documents drop onto a tilted embedding plane and fold into points that cluster by topic; the index links neighbours, a query is typed, embedded and lowered onto the plane, a signal hops along the graph toward it, and a widening ring lights the nearest documents with connecting lines, similarity scores and a ranked list.
- [Branch graph](https://uiarc.dev/components/branch-graph/markdown): A git commit graph where branches draw in as colored lanes, merge commits join lines, a rebase lifts commits and replays them onto main, a squash folds them into one, and hovering a commit shows its message, author and diff stats.
- [Agent loop](https://uiarc.dev/components/agent-loop/markdown): An illustration of the agent loop: gather context, take action, verify, repeat, with a bright head circling three stations around the model.
- [Mixture of experts](https://uiarc.dev/components/mixture-of-experts/markdown): An illustration of mixture of experts routing: each token is scored by a router, travels to its top experts, and their outputs merge into the token's result.
- [Speculative decoding](https://uiarc.dev/components/speculative-decoding/markdown): An illustration of speculative decoding: a fast draft model guesses a few tokens, the target model checks them in one pass, and accepted guesses join the answer.
- [Prompt cache](https://uiarc.dev/components/prompt-cache/markdown): An animated explainer for prompt caching: the shared prefix of each request is cached once, later requests read it back, and the cost and time saved add up.
- [Reasoning tree](https://uiarc.dev/components/reasoning-tree/markdown): An illustration of tree search over thoughts: candidates are scored, weak branches fade, the best expand, and the winning path from question to answer draws in.

## Guidance for AI tools

Multi-region failover: Animated multi-region failover on a 2.5D stage: users stream requests through a global load balancer to two regions; the primary degrades, fails three health checks, traffic shifts smoothly to the healthy region, then it recovers, passes three checks and traffic ramps back to an even split. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
