# Reasoning tree

> An illustration of tree search over thoughts: candidates are scored, weak branches fade, the best expand, and the winning path from question to answer draws in.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/reasoning-tree
- Markdown: https://uiarc.dev/components/reasoning-tree/markdown
- Source file: `registry/components/reasoning-tree/reasoning-tree.tsx`
- Dependencies: motion, lucide-react, @radix-ui/react-tooltip
- Keywords: special, motion, illustration, new, tree of thoughts, beam search, reasoning, search tree, pruning, chain of thought, test time compute, thought tree, best path, llm reasoning, explainer, ai diagram

## When to use

- Explainers, docs and landing pages that teach tree of thoughts, beam search or test time search over reasoning steps.
- Showing why a wider search can beat a greedy one, with a control the reader can change and replay.
- A visual summary of how an agent weighed options before it chose a plan.

## When not to use

- Use agent-run or research-run to show a real agent's steps and output as they stream.
- Use agent-loop to explain the plan, act and observe cycle of a tool using agent.
- Use speculative-decoding or attention-map for token level mechanics rather than whole thoughts.
- Use model-router when the decision is which model handles a request.

## Installation

Reasoning tree is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/reasoning-tree
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ReasoningTree } from "@/components/arc/reasoning-tree/reasoning-tree";

export function SearchExplainer() {
  return (
    <ReasoningTree
      question="Which caching plan cuts p95 latency?"
      defaultBeamWidth={2}
      onAnswer={({ answer }) => console.log(answer.label, answer.score)}
      thoughts={[
        { label: "Cache at the edge", score: 0.81, text: "Serve product pages from the CDN with a 60 second TTL.", children: [
          { label: "Purge on publish", score: 0.77, children: [
            { label: "Tag based purge", score: 0.9 },
            { label: "Purge everything", score: 0.42 },
          ] },
          { label: "Stale while revalidate", score: 0.84 },
        ] },
        { label: "Add a Redis layer", score: 0.66 },
        { label: "Bigger database", score: 0.35 },
      ]}
    />
  );
}
```

## API reference

### ReasoningTree

An illustration of tree search over thoughts. A question proposes candidate thoughts; each gets a score bar that fills, the weakest fade while their edges retract into the parent, and the best few expand another depth, up to three. At the end the best path from the question to the answer draws in the accent with a shimmer travelling along it, and the answer settles in with a check. Play, pause, step and restart drive the search, and a beam width control from 1 to 3 changes how many thoughts survive each depth. The scores are illustrative sample values, not the output of a real model.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `question` | `string` | `"Which release plan ships by Friday?"` | Short question on the root node. Keep it to about three short lines. |
| `questionDetail` | `string` | – | The full question, shown on hover and focus and read to screen readers. Defaults to the question. |
| `thoughts` | `ReasoningThought[]` | `sample release plan` | Thoughts at the first depth, each { id?, label, text?, score?, children? }. label is the short node text (about 2 to 4 words), text the full thought, score an illustrative value from 0 to 0.99. The tree is read to a depth of 3. |
| `beamWidth` | `number` | – | How many thoughts survive each depth, from 1 to 3. Controlled; pair it with onBeamWidthChange. |
| `defaultBeamWidth` | `number` | `2` | Starting beam width when uncontrolled. |
| `onBeamWidthChange` | `(beamWidth: number) => void` | – | Called when the beam width control changes. A new width starts the search over. |
| `seed` | `number` | `7` | Seeds the scores of thoughts that have none, so the same tree and seed always search the same way. |
| `autoPlay` | `boolean` | `true` | Starts the search the first time the tree scrolls into view. Ignored under reduced motion, which shows the answer. |
| `loop` | `boolean` | `false` | Starts over about four seconds after the answer is found. |
| `speed` | `number` | `1` | Multiplies the pace. At 1 a three depth search takes about 7 seconds; 0 holds still. |
| `controls` | `boolean` | `true` | Shows play and pause, step, restart and the beam width control. |
| `model` | `{ name: string; mark?: ReactNode } \| null` | `Claude Opus 5.5 with the Claude mark` | The model named in the header. Pass null to show only the title. |
| `title` | `string` | `"Tree of thoughts"` | Header title, shown after the model name. |
| `accent` | `string` | `"var(--series-1)"` | Color of kept thoughts and the best path. The answer always uses the success color with a check. |
| `onAnswer` | `(result: { answer, path, beamWidth }) => void` | – | Called once each time the search reaches its answer, with the answer thought and the path from the first depth to it. |
| `className` | `string` | – | Class on the root element. |
| `style` | `CSSProperties` | – | Inline style on the root element. Set --rt-accent here to recolor the path. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves to the tree (one stop on the current thought), then play or pause, step, restart and the beam width control. |
| Arrow up / Arrow down | In the tree, moves to the previous or next thought at the same depth on wide layouts, or the previous or next line of the outline on phones. |
| Arrow right / Arrow left | Moves to a thought's best shown child, or back to its parent. |
| Home / End | Moves to the question, or to the answer once it is found. |
| Arrow left / Arrow right on the beam width | Changes the beam width, which starts the search over. |

## Accessibility

- The thoughts form a tree with treeitems that carry their level and position, and a roving tab stop, so the whole tree is a single Tab stop.
- Every thought's accessible name is its full text with its score and its fate: not scored yet, scored, kept, pruned, on the best path, or answer. A pruned thought fades and loses its edge, and the answer has a check icon, so state never relies on color alone.
- Focus and hover show the full thought in a tag next to the node; the same text is in the accessible name.
- A polite status region speaks each step when you step or pause, and the answer when the search ends, but stays quiet while the search plays on its own.
- The header status pairs a pause or check icon with a short label, and the working label carries a calm shimmer.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring around the node.

## Motion

- A proposed thought fades in as its edge draws out of the parent, 20ms apart per sibling.
- Scores fill as a bar with digits that roll on the same 640ms curve, using tabular numerals in a fixed width.
- Pruning fades the thought to 40% and retracts its edge back into the parent. Kept thoughts turn their bar to the accent.
- At the end the best path draws from the question to the answer in about 760ms with a lighter sheen at its head, each node on it lights up as the line reaches it, and the answer settles with one short press and a check.
- On phones a new child glides the lines below it down on a critically damped spring before it fades in, so nothing jumps and nothing bounces.
- Header labels swap with a single 160ms crossfade; the play and pause icons crossfade in place.
- Reduced motion shows the finished search with the path highlighted. Stepping and playing still work, with every change applied at once and no shimmer.

## Responsive behavior

- From about 670px wide the tree reads left to right in four columns: the question, then depths 1 to 3, each with a header that counts how many thoughts were kept.
- Narrower, it becomes a vertical outline with one line per thought, indented by depth and joined by elbow edges, which holds down to 320px.
- The stage reserves the full tree before the search starts, so the card never changes size while it plays; a new beam width animates the height on phones.
- The controls wrap under each other on the narrowest widths.

## Performance

- The search and the layout are pure functions memoized on the data and beam width.
- Positions and edges are written straight to the DOM from one requestAnimationFrame loop that runs only while something glides, so React renders once per step, not per frame.
- Fades, edge draws, bars and the rolling score are CSS transitions on transform, opacity, stroke-dashoffset and a registered integer property.
- Autoplay waits until the tree is in view.

## Notes for AI

- Use it to explain how a reasoning search works, not to show a live model's real scores. Say in the surrounding copy that the scores are illustrative.
- Keep labels to about 2 to 4 words (under about 20 characters) and put the full sentence in text. Give the first depth about 3 thoughts and each later thought about 2 children; deeper levels are ignored.
- The search is plain beam search: every depth proposes the children of the survivors, keeps the best beamWidth, and the last depth keeps only the best one as the answer. Write scores so that a wider beam can find a better answer than the greedy path, which is what makes the control worth trying.
- Thoughts without a score get a seeded one, so a given tree and seed always produce the same outcome.
- Pass model={null} when no specific model is involved. Brand marks are sample content, never an implied endorsement.

## Related

- [Agent loop](https://uiarc.dev/components/agent-loop/markdown): An illustration of the agent loop: gather context, take action, verify, repeat, with a bright head circling three stations around the model.
- [Mixture of experts](https://uiarc.dev/components/mixture-of-experts/markdown): An illustration of mixture of experts routing: each token is scored by a router, travels to its top experts, and their outputs merge into the token's result.
- [Speculative decoding](https://uiarc.dev/components/speculative-decoding/markdown): An illustration of speculative decoding: a fast draft model guesses a few tokens, the target model checks them in one pass, and accepted guesses join the answer.
- [Vector search](https://uiarc.dev/components/vector-search/markdown): Documents drop onto a tilted embedding plane and fold into points that cluster by topic; the index links neighbours, a query is typed, embedded and lowered onto the plane, a signal hops along the graph toward it, and a widening ring lights the nearest documents with connecting lines, similarity scores and a ranked list.
- [Research run](https://uiarc.dev/components/blocks/research-run/markdown): Deep research that plans searches, reads sources with their marks, and streams a cited answer where every chip lights up the sentence it supports.

## Also in illustrations

- [Data flow](https://uiarc.dev/components/data-flow/markdown): Data flow illustration. Sources (app, database, events) are on the left, a processing core with a live count sits in the middle, and destinations (warehouse, dashboard, alerts) are on the right. Records leave as hollow dots and travel curved paths. In the core they turn into solid accent squares, then fan out to each destination; alerts receives about every third record.
- [Payment flow](https://uiarc.dev/components/payment-flow/markdown): A card tap goes to a processor, then the network, then the bank and back with authorization, then settlement; each hop lights up with a status label and the amount travels as a chip.
- [DNS resolution](https://uiarc.dev/components/dns-resolution/markdown): A browser asks for a domain and the query hops from the resolver to a root server, the TLD server and the authoritative nameserver, each pointing to the next, until an IP address comes back and the page connects. The resolver keeps the answer with a TTL ring that drains, and a second lookup is answered straight from that cache in one short hop.
- [Model training](https://uiarc.dev/components/model-training/markdown): Training data batches feed a small neural net diagram whose connections strengthen, a loss curve descends beside it, and an evaluation check turns green at the end.
- [Multi-region failover](https://uiarc.dev/components/multi-region-failover/markdown): Animated multi-region failover on a 2.5D stage: users stream requests through a global load balancer to two regions; the primary degrades, fails three health checks, traffic shifts smoothly to the healthy region, then it recovers, passes three checks and traffic ramps back to an even split.
- [Branch graph](https://uiarc.dev/components/branch-graph/markdown): A git commit graph where branches draw in as colored lanes, merge commits join lines, a rebase lifts commits and replays them onto main, a squash folds them into one, and hovering a commit shows its message, author and diff stats.
- [Prompt cache](https://uiarc.dev/components/prompt-cache/markdown): An animated explainer for prompt caching: the shared prefix of each request is cached once, later requests read it back, and the cost and time saved add up.

## Guidance for AI tools

Reasoning tree: An illustration of tree search over thoughts: candidates are scored, weak branches fade, the best expand, and the winning path from question to answer draws in. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
