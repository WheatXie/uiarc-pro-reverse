# Model training

> Training data batches feed a small neural net diagram whose connections strengthen, a loss curve descends beside it, and an evaluation check turns green at the end.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/model-training
- Markdown: https://uiarc.dev/components/model-training/markdown
- Source file: `registry/components/model-training/model-training.tsx`
- Dependencies: lucide-react
- Keywords: special, motion, illustration, new, model training, machine learning, neural network, deep learning, backpropagation, loss curve, epochs, evaluation, fine-tuning, ai, animated diagram

## When to use

- An AI or ML product section that explains training, fine-tuning or evaluation in one glance.
- Docs pages introducing batches, epochs, loss curves or held-out evaluation.

## When not to use

- Use line-chart or metric-card for real, live training metrics.
- Use data-flow to explain how records move through a pipeline, and pipeline-status for real job status.

## Installation

Model training is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/model-training
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ModelTraining } from "@/components/arc/model-training/model-training";

export function TrainingSection() {
  return <ModelTraining
    classes={["Positive", "Negative"]}
    samples={12800}
    heldOutSamples={1600}
    epochs={12}
    lossFrom={0.69}
    lossTo={0.08}
    accuracy={94.2}
    target={90}
  />;
}
```

## API reference

### ModelTraining

An animated model training illustration told in five stages. A batch peels off a layered stack of training data and drops into the input layer of a small neural network drawn on thin plates in 2.5D depth. Signals travel forward along every connection to a prediction, then the error travels back as a short dash and each connection it passes grows a little stronger. Over the epochs batches stream through, the useful connections thicken and take on the accent while the rest stay light, the loss curve descends beside the network and the loss, epoch and prediction readouts count in sync. At the end a held-out set runs through once, the evaluation score counts up, and the check turns green with a Passed tag. A step bar with play and pause replays the story or jumps to any stage, and a caption explains the current stage.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `classes` | `string[]` | `["Positive", "Negative"]` | The two labels the model learns to predict, shown beside the output layer with a probability and a bar. |
| `inputs` | `number` | `3` | Units in the input layer, from 2 to 5. Each data sheet shows one line per input feature. |
| `hidden` | `number[]` | `[4, 4]` | Units in the two hidden layers, each from 2 to 6. |
| `samples` | `number` | `12800` | Samples in the training set, shown under the stack and in its hover detail. |
| `heldOutSamples` | `number` | `1600` | Samples in the held-out set. |
| `batchSize` | `number` | `32` | Samples per batch, used in the caption and hover detail. |
| `epochs` | `number` | `12` | Epochs the story trains for. The epoch readout and the chart axis count to it. |
| `lossFrom` | `number` | `0.69` | Loss after the first batch. The curve starts here. |
| `lossTo` | `number` | `0.08` | Loss after the last epoch. The curve ends here and the validation point sits just above it. |
| `accuracy` | `number` | `94.2` | Accuracy on the held-out set in percent. The evaluation counts up to it. |
| `target` | `number` | `90` | Accuracy the evaluation must reach, shown under the evaluation name. |
| `labels` | `{ training?: string; heldOut?: string; unit?: string; input?: string; hidden?: string; output?: string; loss?: string; epoch?: string; evaluation?: string; waiting?: string; running?: string; passed?: string; noBatch?: string }` | `Training set, Held-out set, reviews, Input, Hidden, Output, Loss, Epoch, Evaluation, Waiting, Running, Passed, Waiting for a batch` | Names on the diagram and readouts. unit is what one sample is and follows every sample count. |
| `steps` | `string[]` | `["Batch", "Forward pass", "Backprop", "Epochs", "Evaluate"]` | Labels for the five stages in the step bar. |
| `defaultStep` | `number` | – | Stage to start on, from 0 to 4. When held or with reduced motion it picks the still frame; otherwise the finished, evaluated model is shown. |
| `caption` | `boolean` | `true` | Shows a sentence under the step bar that explains the current stage. On narrow layouts it also names the stage. |
| `controls` | `boolean` | `true` | Shows the step bar with play and pause. |
| `speed` | `number` | `1` | Multiplies the playback speed. One full run takes about 21 seconds at 1. 0 holds still. |
| `paused` | `boolean` | `false` | Holds the illustration still. Held from the start, it shows the finished, evaluated model. |
| `accent` | `string` | – | Any CSS color for signals, the error dash, learned connections, the loss curve and the active stage. Defaults to the accent token. The passed state keeps the success color. |
| `label` | `string` | – | Accessible description of the diagram. Built from the classes and numbers when left out. |
| `className` | `string` | – | Extra class on the root figure. |
| `style` | `CSSProperties` | – | Inline styles on the root figure. |

## Accessibility

- The diagram is one element with role="img" and an aria-label that walks through the whole run: batches, the forward pass, backprop strengthening the connections, the loss falling over the epochs, and the held-out evaluation passing its target.
- The step bar is an ordered list of real buttons named "Stage 3, Backprop" with aria-current on the playing stage, and a play and pause button with a specific name. The caption repeats the story in words.
- Nothing relies on color alone: every readout is a number, the evaluation shows Waiting, Running or Passed as a named tag next to the score, and the winning prediction is a probability.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- One rAF loop writes SVG transforms, opacity, dash offsets, widths, CSS variables and a few text nodes straight to the DOM, and only when a value changed; React does not render per frame.
- The whole run is a pure function of time, so the loop is seamless: at the start of each run the connections relax back to their random starting weights while the readouts crossfade from the finished run to an untrained model.
- Batches fly from the stack into the input layer on an eased curve while the stack advances one slot, signals ride each connection with a smooth ease and fade at both ends, and the error travels back as a short dash. Nodes fill as a signal lands and ring as the error passes.
- Each backward pass strengthens the connections it crossed, so weights, the loss curve, the epoch count and the output probabilities all step together, with the loss head gliding along the curve during each update.
- Hover slows the story on a critically damped spring. The loop stops off screen, in hidden tabs, and when paused. Reduced motion shows the finished run as a still frame: learned connections, the full loss curve with its validation point, and the passed evaluation. Picking a stage then shows that stage's still frame.

## Responsive behavior

- The network is measured in real pixels and drawn in an SVG viewBox of that size, so text and hairlines stay crisp at any width.
- Above 720px the loss readout sits beside the network; below it moves under. Below 480px the two data stacks move above the network and batches drop into it, the output probabilities stack under their labels, and the step bar shows numbers while the caption names the stage.
- Hover details only appear for a mouse; touch shows the same diagram without them.

## Performance

- About 150 small SVG elements for the default 3, 4, 4, 2 network, driven by a single loop that caches every written value.
- Geometry and weights are computed once per width; nothing is measured per frame.

## Notes for AI

- Use it to explain how a model learns on a landing page or in docs: training data, forward and backward passes, epochs, loss and evaluation.
- Match classes, unit and the numbers to the product's real task, such as spam and not spam for emails. Keep class names to one word so they fit beside the output layer on phones.
- The numbers are illustrative. Say so near the illustration if they could be read as a real benchmark.

## Related

- [Data flow](https://uiarc.dev/components/data-flow/markdown): Data flow illustration. Sources (app, database, events) are on the left, a processing core with a live count sits in the middle, and destinations (warehouse, dashboard, alerts) are on the right. Records leave as hollow dots and travel curved paths. In the core they turn into solid accent squares, then fan out to each destination; alerts receives about every third record.

## Also in illustrations

- [Payment flow](https://uiarc.dev/components/payment-flow/markdown): A card tap goes to a processor, then the network, then the bank and back with authorization, then settlement; each hop lights up with a status label and the amount travels as a chip.
- [DNS resolution](https://uiarc.dev/components/dns-resolution/markdown): A browser asks for a domain and the query hops from the resolver to a root server, the TLD server and the authoritative nameserver, each pointing to the next, until an IP address comes back and the page connects. The resolver keeps the answer with a TTL ring that drains, and a second lookup is answered straight from that cache in one short hop.
- [Multi-region failover](https://uiarc.dev/components/multi-region-failover/markdown): Animated multi-region failover on a 2.5D stage: users stream requests through a global load balancer to two regions; the primary degrades, fails three health checks, traffic shifts smoothly to the healthy region, then it recovers, passes three checks and traffic ramps back to an even split.
- [Vector search](https://uiarc.dev/components/vector-search/markdown): Documents drop onto a tilted embedding plane and fold into points that cluster by topic; the index links neighbours, a query is typed, embedded and lowered onto the plane, a signal hops along the graph toward it, and a widening ring lights the nearest documents with connecting lines, similarity scores and a ranked list.
- [Branch graph](https://uiarc.dev/components/branch-graph/markdown): A git commit graph where branches draw in as colored lanes, merge commits join lines, a rebase lifts commits and replays them onto main, a squash folds them into one, and hovering a commit shows its message, author and diff stats.
- [Agent loop](https://uiarc.dev/components/agent-loop/markdown): An illustration of the agent loop: gather context, take action, verify, repeat, with a bright head circling three stations around the model.
- [Mixture of experts](https://uiarc.dev/components/mixture-of-experts/markdown): An illustration of mixture of experts routing: each token is scored by a router, travels to its top experts, and their outputs merge into the token's result.
- [Speculative decoding](https://uiarc.dev/components/speculative-decoding/markdown): An illustration of speculative decoding: a fast draft model guesses a few tokens, the target model checks them in one pass, and accepted guesses join the answer.
- [Prompt cache](https://uiarc.dev/components/prompt-cache/markdown): An animated explainer for prompt caching: the shared prefix of each request is cached once, later requests read it back, and the cost and time saved add up.
- [Reasoning tree](https://uiarc.dev/components/reasoning-tree/markdown): An illustration of tree search over thoughts: candidates are scored, weak branches fade, the best expand, and the winning path from question to answer draws in.

## Guidance for AI tools

Model training: Training data batches feed a small neural net diagram whose connections strengthen, a loss curve descends beside it, and an evaluation check turns green at the end. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
