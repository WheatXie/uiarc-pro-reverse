# Payment flow

> A card tap goes to a processor, then the network, then the bank and back with authorization, then settlement; each hop lights up with a status label and the amount travels as a chip.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/payment-flow
- Markdown: https://uiarc.dev/components/payment-flow/markdown
- Source file: `registry/components/payment-flow/payment-flow.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, motion, illustration, new, payment, card payment, authorization, settlement, payout, processor, card network, issuer, fees, animated diagram

## When to use

- A payments or checkout landing section that explains authorization and settlement.
- Docs pages introducing processors, card networks, issuers, fees, and payout timing.

## When not to use

- Use checkout-flow or checkout-live for a real checkout form.
- Use webhook-fanout to explain what happens after a payment event is emitted.

## Installation

Payment flow is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/payment-flow
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { PaymentFlow } from "@/components/arc/payment-flow/payment-flow";

export function PaymentsSection() {
  return <PaymentFlow
    amount={42.5}
    fee={1.53}
    balance={1284.1}
    currency="USD"
    caption="Approved in about a second, paid out the next business day."
  />;
}
```

## API reference

### PaymentFlow

An animated card payment illustration. A tap at checkout sends the amount as a small chip through the processor and the card network to the issuing bank, slipping under each node while it is processed as that node's status line changes. The bank approves, and an approval chip travels back and repaints the path in success. Then settlement runs on a second rail: the funds clear through the network, the processor takes its fee (the chip turns into the net amount), and the payout lands in the merchant balance, which counts up. A step row under the diagram counts the authorization time and fills as settlement runs.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `nodes` | `{ terminal?, processor?, network?, issuer?, merchant?: PaymentFlowNode }` | `Checkout, Stripe, Mastercard, Bank, Your balance` | The five stops. Each one you pass replaces the default for that stop. A node is { label, meta?, detail?, icon?, color? }: meta is the resting second line, detail is the hover tag, icon is SVG path data on a 24 by 24 viewBox painted in color, an image URL, or any ReactNode. The merchant's second line always shows the balance. |
| `amount` | `number` | `42.5` | The charge, shown on the chip that travels to the bank. |
| `fee` | `number` | `1.53` | What the processor keeps at settlement. The payout is amount minus fee. |
| `balance` | `number` | `1284.1` | Merchant balance before the first payout. It grows by the payout on every loop. |
| `currency` | `string` | `"USD"` | ISO currency code for every amount. |
| `locale` | `string` | `"en-US"` | Locale for money formatting. Keep it fixed so the server and the browser agree. |
| `authorizationMs` | `number` | `1340` | Authorization time the step row counts to, in milliseconds. |
| `labels` | `{ authorization?: string; settlement?: string; settlementTime?: string; approved?: string }` | `Authorization, Settlement, Next business day, Approved` | Phase names in the step row, when settlement happens, and the text on the approval chip. |
| `hideSteps` | `boolean` | `false` | Hides the step row and shows only the diagram. |
| `speed` | `number` | `1` | Multiplies the pace. At 1 one payment takes about 15 seconds. 0 holds still. |
| `paused` | `boolean` | `false` | Holds the diagram still where it is, easing to rest instead of stopping in one frame. |
| `accent` | `string` | – | Color of the moving amount, the active path, the settlement rail, and hovered wires. Defaults to the accent token. Approval and settled states stay semantic success. |
| `label` | `string` | – | Accessible description of the diagram. Built from the nodes and amounts when left out. |
| `caption` | `ReactNode` | – | Optional visible caption under the diagram, rendered as a figcaption. |
| `className` | `string` | – | Extra class on the root figure. |
| `style` | `CSSProperties` | – | Inline styles on the root figure. |

## Accessibility

- The diagram is one element with role="img" and an aria-label that tells the whole story: the amount, every hop, the approval, the fee, and the payout.
- Nodes are not controls, so nothing enters the tab order; hover tags only repeat optional detail.
- State never relies on color alone: every node's status line reads Checking risk, Routed to bank, Approved, Cleared, Fee $1.53, or Settled, and the approval chip carries a check and a word.
- Pass caption for a visible explanation under the diagram.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- One rAF loop writes transforms, opacity, dash values, a few attributes, and text nodes straight to the DOM, and only when a value changed; React does not render per frame.
- The payment is a pure function of time, so the loop repeats seamlessly: tap, authorize, approve, settle, pay out, rest. The balance keeps growing from loop to loop instead of jumping back.
- The amount eases from node to node and slips under each chip while it is processed, so every hop reads as enter, work, leave. The path lights in the accent behind it and turns to success as the approval travels back.
- At the processor waypoint the settlement chip crossfades from the gross to the net amount, which is the fee shown as cause and effect; the balance then counts up with tabular numerals.
- Speed changes, pausing, and hover (which slows the story a little) ease on a critically damped spring. The loop stops off screen, in hidden tabs, and when paused.
- Reduced motion shows a still frame just after the fee: approved at checkout, the network cleared, the bank settled, and the net amount on its way to the balance.

## Responsive behavior

- The diagram is measured in real pixels and drawn in an SVG viewBox of that size, so text and hairlines stay crisp at any width.
- Below 700px it turns vertical: the four hops stack on the left and the balance sits top right, with the settlement rail running up beside the chain.
- The step row stacks into one column below 420px. Hover tags only appear for a mouse.

## Performance

- About forty small elements driven by a single loop that caches every written value.
- Paths are sampled once per layout into small length tables; nothing is measured per frame.

## Notes for AI

- Use it to explain how a card payment works, why payouts arrive later than approvals, or where fees come from, on a landing page or in docs.
- Match the fee and amount to the product's real pricing so the diagram tells the truth, and swap the processor and network marks for the ones the product uses.
- Keep node labels to one or two words; the status lines carry the story.

## Related

- [Data flow](https://uiarc.dev/components/data-flow/markdown): Data flow illustration. Sources (app, database, events) are on the left, a processing core with a live count sits in the middle, and destinations (warehouse, dashboard, alerts) are on the right. Records leave as hollow dots and travel curved paths. In the core they turn into solid accent squares, then fan out to each destination; alerts receives about every third record.

## Also in illustrations

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

Payment flow: A card tap goes to a processor, then the network, then the bank and back with authorization, then settlement; each hop lights up with a status label and the amount travels as a chip. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
