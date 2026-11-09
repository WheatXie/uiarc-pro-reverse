# DNS resolution

> A browser asks for a domain and the query hops from the resolver to a root server, the TLD server and the authoritative nameserver, each pointing to the next, until an IP address comes back and the page connects. The resolver keeps the answer with a TTL ring that drains, and a second lookup is answered straight from that cache in one short hop.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/dns-resolution
- Markdown: https://uiarc.dev/components/dns-resolution/markdown
- Source file: `registry/components/dns-resolution/dns-resolution.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, motion, illustration, new, dns, dns resolution, dns lookup, resolver, root server, tld, nameserver, authoritative, ttl, cache, domain, ip address, isometric, animated diagram, landing page, docs

## When to use

- A docs or marketing section that explains how a domain name turns into an address and why the second visit is faster.
- Custom domain setup, DNS hosting, resolver or CDN pages that need the chain of servers and the role of TTL to click.
- Teaching material where viewers should be able to step back and forth through each hop.

## When not to use

- Use webhook-fanout to show one event delivered to many endpoints with retries.
- Use data-flow for a general pipeline between services.
- Use a real status or table component to report actual DNS records or propagation.

## Installation

DNS resolution is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/dns-resolution
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { DnsResolution } from "@/components/arc/dns-resolution/dns-resolution";

export function DnsSection() {
  return (
    <DnsResolution
      domain="app.acme.dev"
      address="203.0.113.24"
      ttl={300}
      nodes={{ resolver: { label: "Resolver", meta: "1.1.1.1" } }}
    />
  );
}
```

## API reference

### DnsResolution

An animated DNS lookup on a layered 2.5D stage. The browser asks a resolver for a name, and the query arcs through the air to the root server, the TLD server and the authoritative nameserver, each pointing to the next, until the address comes back and the page draws in on the browser. The resolver stores the answer with a TTL ring that drains on its cache tier, and a second lookup is answered from that cache in one short hop. A step scrubber replays the story or jumps to any stage, and statuses, counters and the record each packet carries update in sync.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `domain` | `string` | `"app.acme.dev"` | The name being looked up. The TLD server (.dev) and the default nameserver (ns1.acme.dev) are derived from it. |
| `address` | `string` | `"203.0.113.24"` | The address the nameserver answers with, shown on the answer packets, the nameserver status and the cached record. |
| `ttl` | `number` | `300` | Time to live of the answer in seconds. The cached record counts it down while the ring drains, then shows Expired. |
| `lookupMs` | `number` | `84` | Milliseconds the full lookup takes, counted up in the browser status. |
| `cachedMs` | `number` | `1` | Milliseconds the cached lookup takes. |
| `nodes` | `Partial<Record<"browser" \| "resolver" \| "root" \| "tld" \| "authoritative", { label?: string; meta?: string; detail?: string; icon?: string \| ReactNode; color?: string }>>` | `Browser, Resolver, Root server, TLD server, Nameserver` | Overrides per node: the name, a meta line, the hover detail and an optional mark (Simple Icons path data, an image URL or a ReactNode). The nameserver meta is also the host the TLD refers to. |
| `speed` | `number` | `1` | Multiplies the pace. One lookup and cache cycle takes 16 seconds at 1. 0 holds still. |
| `paused` | `boolean` | `false` | Holds the animation, easing to rest. Paused from the start, it shows the cached state with every hop answered. |
| `accent` | `string` | – | Any CSS color for the moving query, lit routes, the TTL ring and the scrubber. Defaults to the theme accent. |
| `controls` | `boolean` | `true` | Shows the step scrubber with a pause button. Each step is a button that jumps to that stage; arrow keys move between them. |
| `caption` | `boolean` | `true` | Shows the current stage title and one line that narrates it under the scrubber. |
| `label` | `string` | – | Accessible description. Defaults to a sentence built from the domain, the servers, the address and the TTL. |
| `className` | `string` | – | Class on the root figure. |
| `style` | `CSSProperties` | – | Inline styles on the root figure. |

## Accessibility

- The drawing is role="img" with an aria-label that tells the whole story: the chain of servers, the address, the connection time and that the next lookup comes from the cache. Pass label to write your own.
- The labels, moving record chips and hover tags inside the drawing are part of that image, and the narrated caption is hidden from assistive technology, so screen readers hear one stable description instead of a changing loop.
- The scrubber is a group of real buttons named Step 1 of 6 and so on; the current step carries aria-current="step", arrow keys, Home and End move between steps, and the pause button reports its state with aria-pressed.
- Status is never color alone: every status chip pairs its dot with words such as Resolving, Try .dev, Cache hit or Connected in 84 ms.

## Motion

- One requestAnimationFrame loop writes SVG attributes, transforms, opacity and text directly, and only when a value changed; React never re-renders per frame.
- Packets travel along real quadratic arcs at an even pace (arc length lookup) with a sine ease, a short lit trail and a shadow that slides along the floor and shrinks as the packet rises, which gives the 2.5D depth.
- Every frame is a pure function of one clock, so the counters, statuses, TTL ring and scrubber stay in sync, jumps land exactly, and the loop joins seamlessly when the cached record expires and the scene fades back to its start.
- Pausing, speed changes and the gentle hover slowdown ease on a critically damped spring. The loop stops offscreen and in a hidden tab and resumes where it left off.
- With reduced motion there is no travel or loop: the stage shows a settled frame of the cached state, and the scrubber switches between settled frames of each stage.

## Responsive behavior

- The drawing is one SVG with a viewBox and non-scaling one pixel strokes. At 640px and wider it uses a landscape stage; below that a portrait stage with the servers in a column beside the browser and resolver.
- Labels, status chips, the cached record and the moving record chip are HTML placed by percentage, so text stays at its real size at every width.
- Container queries hide the step names on phones (the caption names the current step) and the meta lines in the narrowest landscape range. Scrubber buttons keep a tall touch target.

## Performance

- About a hundred small SVG nodes. Each frame writes only values that changed, and nothing runs offscreen or in a background tab.
- Geometry and arc length tables are built once per layout; resizing only rescales the moving record chip.
- No canvas, images, filters or blur.

## Notes for AI

- Use it as an explanatory figure on a landing page, a docs page or a blog post about DNS, custom domains, resolvers, TTLs or caching.
- Keep the domain and address realistic but fictional; 203.0.113.0/24 is reserved for documentation. The lookup is a simulation and takes no live data.
- Only add a brand mark where it is true to the story, such as a public resolver. Brands are sample content, never an endorsement.

## Related

- [Data flow](https://uiarc.dev/components/data-flow/markdown): Data flow illustration. Sources (app, database, events) are on the left, a processing core with a live count sits in the middle, and destinations (warehouse, dashboard, alerts) are on the right. Records leave as hollow dots and travel curved paths. In the core they turn into solid accent squares, then fan out to each destination; alerts receives about every third record.

## Also in illustrations

- [Payment flow](https://uiarc.dev/components/payment-flow/markdown): A card tap goes to a processor, then the network, then the bank and back with authorization, then settlement; each hop lights up with a status label and the amount travels as a chip.
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

DNS resolution: A browser asks for a domain and the query hops from the resolver to a root server, the TLD server and the authoritative nameserver, each pointing to the next, until an IP address comes back and the page connects. The resolver keeps the answer with a TTL ring that drains, and a second lookup is answered straight from that cache in one short hop. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
