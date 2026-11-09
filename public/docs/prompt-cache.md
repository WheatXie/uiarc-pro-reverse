# Prompt cache

> An animated explainer for prompt caching: the shared prefix of each request is cached once, later requests read it back, and the cost and time saved add up.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/prompt-cache
- Markdown: https://uiarc.dev/components/prompt-cache/markdown
- Source file: `registry/components/prompt-cache/prompt-cache.tsx`
- Dependencies: motion, lucide-react, @radix-ui/react-tooltip
- Keywords: special, motion, illustration, new, prompt caching, prompt cache, cache hit, cache write, cache read, prefix matching, time to live, ttl, time to first token, token cost, llm cost, claude, api pricing, animated diagram

## When to use

- A docs page or blog post that explains why a stable prefix makes repeat requests cheaper and faster.
- A pricing or usage page that shows how cache reads, writes and the time to live affect cost.
- Developer onboarding for an AI product where prompt order and cache breakpoints matter.

## When not to use

- Use context-window to show how much of a model's window a conversation fills and when it compacts.
- Use token-inspector to show how text splits into tokens and what each costs.
- Use model-picker or model-router when the subject is choosing a model rather than reusing a prompt.
- Use a real chart of cache hit rate over time for production analytics; this is a teaching illustration with a simulated clock.

## Installation

Prompt cache is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/prompt-cache
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { PromptCache } from "@/components/arc/prompt-cache/prompt-cache";

export function CachingSection() {
  return <PromptCache
    segments={[
      { id: "tools", label: "Tools", tokens: 3_800 },
      { id: "system", label: "System prompt", tokens: 2_400 },
      { id: "documents", label: "Documents", tokens: 36_200 },
      { id: "conversation", label: "Conversation", tokens: 6_000 },
    ]}
    requests={[
      { message: "Which refunds are still pending this week?", tokens: 180 },
      { message: "Draft a reply to Northwind about their late refund", tokens: 240, gap: 42 },
      { message: "Summarize ticket 48213 and the attached invoice", tokens: 410, gap: 35 },
      { message: "Which customers asked about SSO in October?", tokens: 150, gap: 51 },
    ]}
    onRequest={result => console.log(result.kind, result.cost)}
  />;
}
```

## API reference

### PromptCache

An animated explainer for prompt caching. Four requests stack over time, each a bar of the same prefix segments (tools, system prompt, documents, conversation) plus its own new message, with token counts in the legend. The first request processes every segment in one steady sweep, then the prefix lifts out of the bar and travels into a cache panel, where a time to live ring fills. Later requests light their matching prefix as a cache hit with one quick sweep, only the new message is processed, and their processed tokens, input cost and time to first token roll down from the row above. A toggle edits one segment: the next request matches the cache only up to it, shows a break marker there, and rewrites the rest. When no requests arrive, the ring drains on an accelerated clock and the cache expires. Totals roll into a summary of input cost saved and first token speedup.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `segments` | `{ id: string; label: string; tokens: number; color?: string }[]` | `Tools 3.8K, System prompt 2.4K, Documents 36.2K, Conversation 6K` | The stable prefix in prompt order. Prefix matching runs left to right, so put what changes least first. Colors default to the chart series tokens. Bar widths use a square root scale so a short message stays visible beside a long document; the legend shows the real counts. |
| `requests` | `{ message?: string; tokens: number; gap?: number }[]` | `Four support questions of 150 to 410 tokens, 35 to 51 seconds apart` | One to four requests per round. tokens is the size of the new message (the uncached suffix); gap is the simulated seconds since the previous request. message is used in the accessible description and the onRequest payload. |
| `model` | `{ name: string; mark?: ReactNode; inputPrice: number; cacheWritePrice: number; cacheReadPrice: number }` | `Claude Sonnet 5.5: $2.00 input, $2.50 cache write, $0.20 cache read per million tokens` | The model line in the header and the prices behind every cost. Prices are dollars per million input tokens. Pass your provider's current prices; the default uses Claude's pattern of reads at 0.1x and five minute writes at 1.25x the input price. |
| `ttl` | `number` | `300` | Seconds the cache lives after its last use. Every hit refreshes it. Shown as the ring and the countdown, and in the copy as a duration. |
| `changeSegment` | `string \| null` | `"system"` | Id of the segment the change toggle edits. The toggle arms one edit for the next request and releases once that request is sent. Pass null to hide it. |
| `autoPlay` | `boolean` | `true` | Plays on its own while in view. With reduced motion it opens on a finished round instead and waits for play or step. |
| `loop` | `boolean` | `true` | After a round the cache idles, expires and the story starts over. When false it stops after the cache expires. |
| `speed` | `number` | `1` | Multiplies the pace of the clock and every animation. 0 holds still. |
| `firstToken` | `(tokens: { processed: number; cached: number }) => number` | `0.42 + processed / 40000 + cached / 500000` | Seconds to the first output token for a prompt. The default is an illustrative model: a fixed overhead, prefill of new tokens, and a much faster load of cached ones. |
| `onRequest` | `(result: PromptCacheResult) => void` | – | Called when a request finishes, with index, simulated time, kind (write, hit or partial), breakAt, cachedTokens, writtenTokens, processedTokens, cost, uncachedCost, firstToken, uncachedFirstToken, changed, cold and message. |
| `onExpire` | `() => void` | – | Called when the cache expires. |
| `messageLabel` | `string` | `"New message"` | Legend label for the suffix at the end of each prompt. |
| `title` | `string` | `"Prompt cache"` | Heading of the card, also used in its accessible name. |
| `className` | `string` | – | Extra class on the root section. |
| `style` | `CSSProperties` | – | Inline styles on the root section. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through play or pause, send the next request, reset, and the change toggle. |
| Enter, Space | Plays or pauses, sends the next request, resets, or arms and disarms the edit. |

## Accessibility

- The card is a section named for the title and marked as a simulation with sample prices.
- Each request is a list item with a sentence that gives its time, message, outcome, tokens read from the cache, tokens processed, input cost and time to first token; the bars and rolling numbers are hidden from assistive technology.
- Requests sent with the step button, the edit toggle, pausing and reset are announced in a polite live region. Autoplay stays silent so it never talks over the page.
- Outcomes are never color alone: every status pairs an icon with a label (Cache write, Cache hit, Partial hit), cached and processed fills differ in fill and outline, and the cache status is written out as Empty, Writing, Reading, Expires in 4:52 or Expired.
- The change toggle is a button with aria-pressed. Icon buttons have names and tooltips.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- One requestAnimationFrame clock drives the story and runs only while playing or stepping, on screen and in a visible tab. The ring and countdown are written straight to the DOM; React renders only on events.
- Processing is one linear sweep at a steady speed across the segments that need it. A cache hit fades the prefix to its cached fill while a single band of each segment's color passes once across the prefix, and the cache panel sweeps in step.
- A write carries the new part of the prompt from the row into the cache on a 460ms ease out, changing from processed to cached on the way; the panel's segments land in place and its token count rolls up. The ring refills on a critically damped follow and drains as simulated time passes.
- A changed segment raises a short warning line in the gap where matching stops; the cache drops everything after it before the rewrite lands.
- Numbers roll from the row above, so cost and first token visibly come down, with tabular numerals in columns sized to their content. Status labels swap with one crossfade. Pausing freezes every CSS animation and the clock together.
- Reduced motion opens on a finished round, drops the sweeps, the flight and the break animation, and changes values at once; play and step still work.

## Responsive behavior

- From 660px of container width the cache panel sits beside the requests; below it the panel moves above them as a strip, so the flight still travels from the row into the cache.
- Below 480px each request takes three lines (label and status, the bar, then its three numbers under shared column headings), the stats stack, and the controls wrap under the title when needed.
- Metric columns share one subgrid, so values align across rows at every width. The card holds at 320px with no horizontal scroll.

## Performance

- About 120 small elements. Fills, sweeps, the break line and the flight are CSS animations on transform and opacity; the flight also animates the size of one absolutely positioned element.
- Outcomes are computed once per request with plain arithmetic. The loop stops off screen, in hidden tabs and while paused.

## Notes for AI

- Use it to explain prompt caching on a pricing page, in API docs, or inside a usage dashboard next to real cache hit numbers.
- Keep segment order realistic: content that rarely changes first (tools, system prompt), then documents, then the conversation. Prefix matching stops at the first difference, which the toggle demonstrates.
- Pass the real prices of the model you show. The defaults are Claude Sonnet 5.5 sample prices; for other providers set inputPrice, cacheWritePrice (equal to inputPrice when writes cost nothing extra) and cacheReadPrice.
- Costs, savings and speedups are computed from the props, never typed in. The first request costs more than an uncached one because of the write, and the summary says so until the hits pay it back.
- Latency numbers are illustrative unless you pass firstToken with your own measurements.

## Related

- [Context window](https://uiarc.dev/components/context-window/markdown): An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.
- [Model picker](https://uiarc.dev/components/blocks/model-picker/markdown): A model picker in one quiet pill: open it to choose from featured models with a one line note each, set the reasoning effort, or browse every other model by provider, and the pill swaps to your choice in place.
- [Speculative decoding](https://uiarc.dev/components/speculative-decoding/markdown): An illustration of speculative decoding: a fast draft model guesses a few tokens, the target model checks them in one pass, and accepted guesses join the answer.
- [Agent loop](https://uiarc.dev/components/agent-loop/markdown): An illustration of the agent loop: gather context, take action, verify, repeat, with a bright head circling three stations around the model.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.

## Also in illustrations

- [Data flow](https://uiarc.dev/components/data-flow/markdown): Data flow illustration. Sources (app, database, events) are on the left, a processing core with a live count sits in the middle, and destinations (warehouse, dashboard, alerts) are on the right. Records leave as hollow dots and travel curved paths. In the core they turn into solid accent squares, then fan out to each destination; alerts receives about every third record.
- [Payment flow](https://uiarc.dev/components/payment-flow/markdown): A card tap goes to a processor, then the network, then the bank and back with authorization, then settlement; each hop lights up with a status label and the amount travels as a chip.
- [DNS resolution](https://uiarc.dev/components/dns-resolution/markdown): A browser asks for a domain and the query hops from the resolver to a root server, the TLD server and the authoritative nameserver, each pointing to the next, until an IP address comes back and the page connects. The resolver keeps the answer with a TTL ring that drains, and a second lookup is answered straight from that cache in one short hop.
- [Model training](https://uiarc.dev/components/model-training/markdown): Training data batches feed a small neural net diagram whose connections strengthen, a loss curve descends beside it, and an evaluation check turns green at the end.
- [Multi-region failover](https://uiarc.dev/components/multi-region-failover/markdown): Animated multi-region failover on a 2.5D stage: users stream requests through a global load balancer to two regions; the primary degrades, fails three health checks, traffic shifts smoothly to the healthy region, then it recovers, passes three checks and traffic ramps back to an even split.
- [Vector search](https://uiarc.dev/components/vector-search/markdown): Documents drop onto a tilted embedding plane and fold into points that cluster by topic; the index links neighbours, a query is typed, embedded and lowered onto the plane, a signal hops along the graph toward it, and a widening ring lights the nearest documents with connecting lines, similarity scores and a ranked list.
- [Branch graph](https://uiarc.dev/components/branch-graph/markdown): A git commit graph where branches draw in as colored lanes, merge commits join lines, a rebase lifts commits and replays them onto main, a squash folds them into one, and hovering a commit shows its message, author and diff stats.
- [Mixture of experts](https://uiarc.dev/components/mixture-of-experts/markdown): An illustration of mixture of experts routing: each token is scored by a router, travels to its top experts, and their outputs merge into the token's result.
- [Reasoning tree](https://uiarc.dev/components/reasoning-tree/markdown): An illustration of tree search over thoughts: candidates are scored, weak branches fade, the best expand, and the winning path from question to answer draws in.

## Guidance for AI tools

Prompt cache: An animated explainer for prompt caching: the shared prefix of each request is cached once, later requests read it back, and the cost and time saved add up. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
