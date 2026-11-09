# Mixture of experts

> An illustration of mixture of experts routing: each token is scored by a router, travels to its top experts, and their outputs merge into the token's result.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/mixture-of-experts
- Markdown: https://uiarc.dev/components/mixture-of-experts/markdown
- Source file: `registry/components/mixture-of-experts/mixture-of-experts.tsx`
- Dependencies: motion, lucide-react, @radix-ui/react-tooltip
- Keywords: special, motion, illustration, new, mixture of experts, moe, sparse moe, expert routing, gating network, router, top k, top 2 routing, active parameters, load balancing, expert capacity, token dropping, llm architecture, transformer

## When to use

- Explaining why a mixture of experts model is cheap per token: only the chosen experts run, which the active parameter readout makes concrete.
- Showing how a gate scores experts, picks the top k and blends their outputs, with real or sample scores.
- Teaching load balancing and expert capacity, where an uneven router overloads some experts and drops tokens.

## When not to use

- Use model-router to pick which model handles a request in a product; this card explains routing inside one model.
- Use attention-map to show which tokens a token attends to, rather than which experts process it.
- Use token-inspector to show tokenization, token ids and probabilities of generated text.
- Use speculative-decoding to explain draft and verify generation speedups.

## Installation

Mixture of experts is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/mixture-of-experts
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { MixtureOfExperts } from "@/components/arc/mixture-of-experts/mixture-of-experts";

export function RoutingExplainer() {
  return <MixtureOfExperts />;
}

// Your own sequence and experts. Scores are gate weights in expert order.
const experts = [
  { name: "Code", handles: "Identifiers and keywords" },
  { name: "Math", handles: "Numbers and operators" },
  { name: "Prose", handles: "Everyday words" },
  { name: "Names", handles: "People and places" },
];

export function CustomRouting() {
  return (
    <MixtureOfExperts
      experts={experts}
      tokens={[
        { text: "const", scores: [0.7, 0.05, 0.15, 0.1] },
        { text: " total", scores: [0.4, 0.3, 0.25, 0.05] },
        { text: " =", scores: [0.35, 0.55, 0.05, 0.05] },
      ]}
      defaultTopK={1}
      capacityFactor={Infinity}
      parameters={{ total: 141, shared: 5, perExpert: 22 }}
      onRoute={route => console.log(route.token, route.experts)}
    />
  );
}
```

## API reference

### MixtureOfExperts

An illustration of sparse mixture of experts routing in one card. Tokens slide in one at a time, a router scores every expert with a small bar each, and the token travels to its top k experts. The chosen experts light up in a first and second choice color, their load counters roll, and their outputs merge into the token's output chip. A capacity limit can make a full expert skip a token, which the card shows as a warning. Hover or focus a token to freeze on its gate scores and choices, hover an expert to see what it tends to handle and which tokens it took, switch between top 1 and top 2 to roll the active parameter readout, and read the load balance bar underneath. The expert specialties, scores and parameter counts are illustrative, not measurements of a real model.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `tokens` | `MixtureOfExpertsToken[]` | `DEFAULT_TOKENS` | The sequence to route, as { text, scores? }. Scores are gate weights, one per expert in expert order; any non-negative numbers work and are normalized to sum to 1. Tokens without scores get stable sample scores derived from their text. Defaults to a 15 token sample sentence with hand tuned scores. |
| `experts` | `MixtureOfExpertsExpert[]` | `DEFAULT_EXPERTS` | The routed experts, from 2 to 12, as { name, handles?, icon? }. `handles` is the short description shown on hover; `icon` is a 14px glyph that narrow cards show instead of the name (it falls back to the first letter). The defaults are eight illustrative specialties: code, numbers, punctuation, names, grammar, verbs, dates and symbols. |
| `topK` | `1 \| 2` | – | Experts per token, controlled. Pair with onTopKChange. |
| `defaultTopK` | `1 \| 2` | `2` | Experts per token on first render when uncontrolled. |
| `onTopKChange` | `(topK: 1 \| 2) => void` | – | Called when the top 1 or top 2 control changes. |
| `parameters` | `{ total: number; shared: number; perExpert: number }` | `{ total: 671, shared: 5, perExpert: 16 }` | Sizes in billions for the readout. Active parameters are shared plus top k times perExpert, so the defaults read 21B at top 1 and 37B at top 2, of 671B. These numbers are illustrative: they echo the scale of large open weights models, not the exact layout of the eight expert diagram. |
| `capacityFactor` | `number` | `1` | Room per expert as a multiple of an even share of the routes: capacity is ceil(factor × tokens × k / experts). A token whose chosen expert is already full skips that expert, and passes through unchanged when every choice is full. Pass Infinity to never drop. With the defaults, two tokens overflow at top 2 and one at top 1. |
| `speed` | `number` | `1` | Multiplies the pace. At 1 a token takes about 2.2 seconds; 0 holds still. |
| `paused` | `boolean` | – | Holds the animation, controlled. Pair with onPausedChange. |
| `defaultPaused` | `boolean` | `false` | Starts paused when uncontrolled. |
| `onPausedChange` | `(paused: boolean) => void` | – | Called by the play and pause button. |
| `loop` | `boolean` | `true` | Starts over after a short summary once the last token is through. With reduced motion the card never loops; the button turns into a replay. |
| `onRoute` | `(route: MixtureOfExpertsRoute) => void` | – | Called as each token is sent to its experts with { index, token, scores, experts, weights, dropped }. Experts are best first and weights are renormalized over the top k. |
| `label` | `string` | `"Mixture of experts routing"` | Accessible name of the card. |
| `className` | `string` | – | Class on the root element. Set --moe-first and --moe-second on it to recolor the first and second choice. |
| `style` | `CSSProperties` | – | Inline style on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the top k control, the play and pause button, the expert tiles (one stop) and the token sequence (one stop). |
| Arrow keys, Home, End | Move between options in the top k control, between expert tiles, or between tokens. Focusing a tile or a token with the keyboard freezes the card and shows its details. |
| Enter, Space | On a token or an expert, pins it so the card stays frozen on it; press again to unpin. On the play button, pauses, resumes or replays. |
| Escape | Unpins the pinned token or expert and lets routing resume. |

## Accessibility

- The card is a labelled group. The stage lines, router bars and packets are decorative and hidden from assistive technology; every fact they show is also on a focusable element or in text.
- Each token is a button whose name lists its experts and weights, such as "paid: Verbs 68%, Symbols 32%", and says when an expert skipped it at capacity. Pinning sets aria-pressed.
- Each expert tile is a button named with its load, whether it is at capacity, and its role in the route on screen.
- The rolling numbers are hidden from assistive technology and paired with plain text, such as "37B of 671B parameters active per token" and the load balance in percent.
- First and second choices are told apart by order and label as well as color, and a skipped expert shows a warning icon, a dashed border and the word full, never color alone.
- Pausing, resuming, pinning, the top k change and replay are announced through a polite status region. Autoplay itself is not announced.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- One clock drives the story: the input chip slides in, a packet with a short soft trail travels to the router, the score bars grow, packets travel to the chosen experts, the tiles light up and their counters roll, and the packets curve into the merge point and out to the output chip.
- Packets are drawn straight to the DOM on requestAnimationFrame; React only re-renders when a phase changes. Travel uses an in-out curve and an arc length table so dots and trails move evenly on curves.
- Score bars, tile tints and connector colors are CSS transitions on transform and color. Load counters, the active parameter readout and the balance roll on tabular numerals with the smooth, critically damped spring.
- Hover, keyboard focus, a pin, scrolling out of view and the pause button all stop the clock exactly where it is, and it resumes from there.
- Footer text swaps with a short crossfade: the old line fades out in about 100ms while the new one fades in from 2px below.
- Reduced motion drops all travel and the loop: each token's scores, experts and output land in place on a slower cadence, and the card stops on its summary.

## Responsive behavior

- From about 568px wide the card flows left to right: input, router, a column of experts with names and counters, then output.
- Narrower cards flow top to bottom: the router becomes a band of vertical score bars, each above its expert, and the experts become a row of icon tiles with their counters.
- The header wraps so the readout takes its own row, the route readout drops the token chip, and the footer stacks the load balance under it. Everything holds at 320px without horizontal scroll.
- Touch has no hover, so tapping a token or an expert pins it and tapping again resumes.

## Performance

- Routes, loads and drops for the whole sequence are planned once per top k with plain arithmetic and memoized.
- Per frame work is a handful of attribute writes on six packet groups; nothing re-renders between phase changes.
- The clock stops while the card is offscreen, paused, inspected or finished, and the geometry is rebuilt only when the stage width changes.

## Notes for AI

- Choose it to explain how a sparse mixture of experts layer routes tokens: on a model page, in docs about a model's architecture, or in a lesson on LLM internals. It is an illustration, not a profiler.
- Keep expert names to one word. Narrow cards show only each expert's icon, so pass an icon for custom experts or accept the first letter.
- Scores do not need to sum to 1. The top k are taken by score with ties kept in expert order, and their weights are renormalized for the readout.
- capacityFactor is what produces the warning state. Leave it at 1 to show a couple of overflows in the sample, raise it to 1.25 or more for a clean run, or pass Infinity to turn dropping off.
- The default parameter counts are illustrative. If the page names a real model, pass that model's own total, shared and per expert sizes and say where they come from.
- Use onRoute to sync something else on the page, such as highlighting the token in a transcript.

## Related

- [Speculative decoding](https://uiarc.dev/components/speculative-decoding/markdown): An illustration of speculative decoding: a fast draft model guesses a few tokens, the target model checks them in one pass, and accepted guesses join the answer.
- [Agent loop](https://uiarc.dev/components/agent-loop/markdown): An illustration of the agent loop: gather context, take action, verify, repeat, with a bright head circling three stations around the model.
- [Vector search](https://uiarc.dev/components/vector-search/markdown): Documents drop onto a tilted embedding plane and fold into points that cluster by topic; the index links neighbours, a query is typed, embedded and lowered onto the plane, a signal hops along the graph toward it, and a widening ring lights the nearest documents with connecting lines, similarity scores and a ranked list.
- [Context window](https://uiarc.dev/components/context-window/markdown): An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.

## Also in illustrations

- [Data flow](https://uiarc.dev/components/data-flow/markdown): Data flow illustration. Sources (app, database, events) are on the left, a processing core with a live count sits in the middle, and destinations (warehouse, dashboard, alerts) are on the right. Records leave as hollow dots and travel curved paths. In the core they turn into solid accent squares, then fan out to each destination; alerts receives about every third record.
- [Payment flow](https://uiarc.dev/components/payment-flow/markdown): A card tap goes to a processor, then the network, then the bank and back with authorization, then settlement; each hop lights up with a status label and the amount travels as a chip.
- [DNS resolution](https://uiarc.dev/components/dns-resolution/markdown): A browser asks for a domain and the query hops from the resolver to a root server, the TLD server and the authoritative nameserver, each pointing to the next, until an IP address comes back and the page connects. The resolver keeps the answer with a TTL ring that drains, and a second lookup is answered straight from that cache in one short hop.
- [Model training](https://uiarc.dev/components/model-training/markdown): Training data batches feed a small neural net diagram whose connections strengthen, a loss curve descends beside it, and an evaluation check turns green at the end.
- [Multi-region failover](https://uiarc.dev/components/multi-region-failover/markdown): Animated multi-region failover on a 2.5D stage: users stream requests through a global load balancer to two regions; the primary degrades, fails three health checks, traffic shifts smoothly to the healthy region, then it recovers, passes three checks and traffic ramps back to an even split.
- [Branch graph](https://uiarc.dev/components/branch-graph/markdown): A git commit graph where branches draw in as colored lanes, merge commits join lines, a rebase lifts commits and replays them onto main, a squash folds them into one, and hovering a commit shows its message, author and diff stats.
- [Prompt cache](https://uiarc.dev/components/prompt-cache/markdown): An animated explainer for prompt caching: the shared prefix of each request is cached once, later requests read it back, and the cost and time saved add up.
- [Reasoning tree](https://uiarc.dev/components/reasoning-tree/markdown): An illustration of tree search over thoughts: candidates are scored, weak branches fade, the best expand, and the winning path from question to answer draws in.

## Guidance for AI tools

Mixture of experts: An illustration of mixture of experts routing: each token is scored by a router, travels to its top experts, and their outputs merge into the token's result. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
