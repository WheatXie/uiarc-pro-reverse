# Speculative decoding

> An illustration of speculative decoding: a fast draft model guesses a few tokens, the target model checks them in one pass, and accepted guesses join the answer.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/speculative-decoding
- Markdown: https://uiarc.dev/components/speculative-decoding/markdown
- Source file: `registry/components/speculative-decoding/speculative-decoding.tsx`
- Dependencies: motion, lucide-react, @radix-ui/react-switch, @radix-ui/react-tooltip
- Keywords: special, motion, illustration, new, speculative decoding, draft model, target model, assisted generation, inference speed, llm latency, token acceptance, tokens per pass, verify, ai illustration, explainer, decoding

## When to use

- Explaining why a product answers faster: docs, model pages, inference dashboards and blog posts about latency.
- Showing a recorded speculative run from your own server, with acceptance and tokens per pass for a chosen draft length.
- Teaching the trade off between draft length, acceptance rate and speedup with a slider people can try.

## When not to use

- Use text-stream to show an answer streaming to a user; this card explains the mechanism behind the speed.
- Use token-inspector to look at token probabilities and alternatives for one answer.
- Use model-router to explain how requests are sent to different models; speculative decoding runs two models on every request.
- Use attention-map or mixture-of-experts for what happens inside a single forward pass.

## Installation

Speculative decoding is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/speculative-decoding
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { SpeculativeDecoding } from "@/components/arc/speculative-decoding/speculative-decoding";

// Simulated: pass the answer and let the seeded draft guess.
<SpeculativeDecoding
  tokens={[{ text: "The" }, { text: " build", ease: 0.6, miss: " deploy" }, { text: " passed" }, { text: "." }]}
  defaultDraftLength={5}
  defaultCompare
/>

// Replayed: pass rounds recorded from your own server.
<SpeculativeDecoding
  rounds={[
    { draft: ["The", " build", " failed"], accepted: 2, target: " passed" },
    { draft: [], accepted: 0, target: "." },
  ]}
  onComplete={stats => console.log(stats.speedup)}
/>
```

## API reference

### SpeculativeDecoding

An illustration of speculative decoding in one card. A draft model lane proposes a few ghost tokens quickly; a target model lane checks them in one sweep. Accepted guesses get a check and travel into the answer, the first miss is struck through and replaced by the target's token, and the rest fade away. Rounds repeat until the sentence is done. A compare switch races a second line where the target writes one token per pass, while the speedup, the share of drafts accepted and the tokens per target pass roll up below. Every token in the answer is underlined in the color of the model that wrote it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `tokens` | `DecodeToken[]` | `sampleTokens` | The target model's answer, one entry per token with its leading space ({ text: " deploy" }). Optional ease (0 to 1) is how likely the draft guesses the token, and miss is what it proposes instead. |
| `rounds` | `DecodeRound[]` | – | A recorded run to replay instead of the simulation: per round the draft tokens, how many were accepted from the start, and the target's own token. Hides the draft length slider. |
| `draftLength` | `number` | – | Tokens the draft guesses per round, 2 to 8 (controlled). Changing it replans and replays from the start. |
| `defaultDraftLength` | `number` | `4` | Draft length on first render. |
| `onDraftLengthChange` | `(length: number) => void` | – | Called when the slider moves. |
| `compare` | `boolean` | – | Shows the target only line and races it on the same clock (controlled). |
| `defaultCompare` | `boolean` | `false` | Compare state on first render. |
| `onCompareChange` | `(compare: boolean) => void` | – | Called when the compare switch changes. |
| `autoplay` | `boolean` | `true` | Starts the run once, when the card is mostly in view. Never starts on its own with reduced motion. |
| `seed` | `number` | `12` | Seed for the simulated guesses. The same seed, tokens and draft length always give the same run. |
| `draftCost` | `number` | `0.1` | Cost of one draft token as a share of a target pass. It sets how long drafting takes on screen and counts toward the speedup. |
| `passDuration` | `number` | `640` | Milliseconds one target pass takes on screen. |
| `title` | `string` | `"Speculative decoding"` | Card title and the group's accessible name. |
| `draftLabel / draftDetail` | `string` | `"Draft model" / "Small, fast"` | Name and detail of the draft lane. Keep them generic or clearly illustrative. |
| `targetLabel / targetDetail` | `string` | `"Target model" / "Large"` | Name and detail of the target lane. |
| `status` | `"ready" \| "loading" \| "error"` | `"ready"` | Loading dims the lanes and shimmers the status line; error shows the message with a retry. Controls are disabled in both. |
| `error` | `string` | – | Message shown when status is "error". |
| `onRetry` | `() => void` | – | Called by the retry button in the error state. The button is hidden without it. |
| `onComplete` | `(stats: DecodeStats) => void` | – | Called each time the speculative line finishes, with passes, drafted, accepted, tokens, acceptance, tokensPerPass and speedup. |
| `className` | `string` | – | Class on the root element. |
| `style` | `CSSProperties` | – | Inline style on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through play or pause, restart, the draft length slider and the compare switch. |
| Enter, Space | On play or pause and restart, activates them. On the compare switch, toggles the race. |
| Arrow left / Arrow right, Home, End | On the draft length slider, changes the length by one or jumps to 2 or 8. The run replays with the new length. |

## Accessibility

- The card is a named group. The lanes are hidden from assistive technology and summarized in hidden text once each round has its verdicts: what the draft proposed, how many the target accepted and which token it wrote instead.
- Each output line carries the text written so far as its accessible name, so a screen reader reads words instead of tokens.
- Stats are a description list with spoken values ("2.6 times", "67 percent"); the rolling digits are decorative.
- Verdicts never rely on color: accepted columns show a check, the rejected guess is struck through with an x beside the target's token, and discarded guesses fade.
- A polite live region announces play, pause, restart, the comparison, a new draft length with its expected acceptance and speedup, and the finished result. It never announces every round.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- Draft chips appear one by one, fading in from 4px to the left, with a short shimmer on the text while they wait.
- The target's sweep fills each cell in order from a per frame CSS variable; verdict icons and the replacement token crossfade in as the sweep reaches them, and the strike draws from the left.
- Accepted tokens and the target's token travel from their chips into their slot in the answer on a critically damped spring, about 20ms apart. The answer is laid out in full from the start, so the line never reflows.
- Lane height follows wrapping chips on the smooth spring; the target only line opens and closes on the same spring. Stats roll per digit with tabular numerals.
- Status text swaps with a short crossfade; no character morphs, blur or typewriter effects.
- Reduced motion never autoplays; when played, tokens appear in place without travel, the sweep steps per column, and the shimmer, slide and rolls are off.

## Responsive behavior

- Lane and line labels sit in a 120px column on wide cards. Below 560px the lane labels become a legend above the columns and line labels sit above their text with the pass count on the right.
- Draft columns wrap onto a second line when they run out of room; the lane height follows on a spring.
- The status line reserves two lines on narrow cards so wrapping copy never moves the lanes. Stats stay three across; the slider takes a full row above the compare switch.

## Performance

- The clock runs on requestAnimationFrame in a ref. React state changes only when something on screen changes (a chip, a verdict, a landed token); the sweep is a CSS variable written each frame.
- Plans are memoized on a serialized copy of the inputs, so an inline tokens array does not restart the run each render.
- The loop stops when the run ends or is paused, and frame steps are capped so a background tab never jumps ahead.

## Notes for AI

- This is an explainer, not a live decoder. With tokens it simulates a draft model from ease values and a seed; with rounds it replays a real run. Say "illustrative" when the numbers are simulated.
- Token text keeps its leading space, as tokenizers do. Punctuation without a space stays on the same line as the word before it.
- The speedup counts draft time: tokens divided by the sum of one pass per round plus draftCost per drafted token. Longer drafts accept a smaller share because everything after the first miss is discarded, so the speedup peaks at a middle length.
- Keep model names generic (Draft model, Target model) unless the run really came from named models.
- The simulation always leaves the final token to the target, so every round ends with a token from the target.

## Related

- [Mixture of experts](https://uiarc.dev/components/mixture-of-experts/markdown): An illustration of mixture of experts routing: each token is scored by a router, travels to its top experts, and their outputs merge into the token's result.
- [Context window](https://uiarc.dev/components/context-window/markdown): An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.

## Also in illustrations

- [Data flow](https://uiarc.dev/components/data-flow/markdown): Data flow illustration. Sources (app, database, events) are on the left, a processing core with a live count sits in the middle, and destinations (warehouse, dashboard, alerts) are on the right. Records leave as hollow dots and travel curved paths. In the core they turn into solid accent squares, then fan out to each destination; alerts receives about every third record.
- [Payment flow](https://uiarc.dev/components/payment-flow/markdown): A card tap goes to a processor, then the network, then the bank and back with authorization, then settlement; each hop lights up with a status label and the amount travels as a chip.
- [DNS resolution](https://uiarc.dev/components/dns-resolution/markdown): A browser asks for a domain and the query hops from the resolver to a root server, the TLD server and the authoritative nameserver, each pointing to the next, until an IP address comes back and the page connects. The resolver keeps the answer with a TTL ring that drains, and a second lookup is answered straight from that cache in one short hop.
- [Model training](https://uiarc.dev/components/model-training/markdown): Training data batches feed a small neural net diagram whose connections strengthen, a loss curve descends beside it, and an evaluation check turns green at the end.
- [Multi-region failover](https://uiarc.dev/components/multi-region-failover/markdown): Animated multi-region failover on a 2.5D stage: users stream requests through a global load balancer to two regions; the primary degrades, fails three health checks, traffic shifts smoothly to the healthy region, then it recovers, passes three checks and traffic ramps back to an even split.
- [Vector search](https://uiarc.dev/components/vector-search/markdown): Documents drop onto a tilted embedding plane and fold into points that cluster by topic; the index links neighbours, a query is typed, embedded and lowered onto the plane, a signal hops along the graph toward it, and a widening ring lights the nearest documents with connecting lines, similarity scores and a ranked list.
- [Branch graph](https://uiarc.dev/components/branch-graph/markdown): A git commit graph where branches draw in as colored lanes, merge commits join lines, a rebase lifts commits and replays them onto main, a squash folds them into one, and hovering a commit shows its message, author and diff stats.
- [Agent loop](https://uiarc.dev/components/agent-loop/markdown): An illustration of the agent loop: gather context, take action, verify, repeat, with a bright head circling three stations around the model.
- [Prompt cache](https://uiarc.dev/components/prompt-cache/markdown): An animated explainer for prompt caching: the shared prefix of each request is cached once, later requests read it back, and the cost and time saved add up.
- [Reasoning tree](https://uiarc.dev/components/reasoning-tree/markdown): An illustration of tree search over thoughts: candidates are scored, weak branches fade, the best expand, and the winning path from question to answer draws in.

## Guidance for AI tools

Speculative decoding: An illustration of speculative decoding: a fast draft model guesses a few tokens, the target model checks them in one pass, and accepted guesses join the answer. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
