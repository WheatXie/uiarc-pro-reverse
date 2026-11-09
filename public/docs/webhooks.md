# Webhooks

> A webhooks console with delivery history, a payload inspector and retries that roll the rate.

- Type: Block
- Page: https://uiarc.dev/components/blocks/webhooks
- Markdown: https://uiarc.dev/components/blocks/webhooks/markdown

- Access: Arc Pro
- Registry id: `webhooks`
- Source file: `registry/blocks/webhooks/webhooks.tsx`
- Built from: Badge, Button, Checkbox, Copy button, Input, Avatar
- Keywords: react webhooks dashboard, webhook endpoints ui, webhook delivery logs, retry webhook, payload inspector, developer settings webhooks

Use this on a developer settings page. Load endpoints, event volume and delivery attempts from your webhook service into webhooks-data.ts and connect retry, test event and endpoint creation to your API; the preview is simulated.

## When to use

- A developer settings page for webhook endpoints, delivery history, and retries.
- Consoles that need a payload and headers inspector next to the delivery list.

## When not to use

- Use api-keys for managing tokens.
- Use audit-log for account activity rather than outgoing events.
- Use integrations for a catalogue of third-party connections.

## Installation

Webhooks is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/webhooks
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { Webhooks } from "@/components/arc/blocks/webhooks/webhooks";

export default function DeveloperSettings() {
  return (
    <main>
      <Webhooks />
    </main>
  );
}
```

## API reference

### Webhooks

A webhooks console with an endpoint list, delivery volume chart, delivery history, a payload and headers inspector, retries and an add endpoint form. Takes no props; endpoints, deliveries and payloads are sample data in webhooks-data.ts, and retries, test events and creation are simulated.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow up / Arrow down | Moves focus and selection through endpoints or deliveries. |
| Home / End | Jumps to the first or last endpoint or delivery, or the first or last inspector tab. |
| Arrow left / Arrow right | Switches between the Payload and Headers tabs. |
| Escape | Closes the add endpoint panel. |

## Accessibility

- Payload and headers use a tablist with roving tabindex, and the code panel is a focusable tabpanel.
- Endpoint and delivery rows mark the current item with aria-current and point at the detail region with aria-controls.
- Form errors render with role="alert", and the add toggle exposes aria-expanded.

## Motion

- Selection highlights and the active tab slide with shared layout springs; new rows grow in and flash once.
- A successful retry swaps to Resolved and the delivery rate rolls to its new value.
- Reduced motion replaces growth and rolls with instant or opacity-only changes.

## Responsive behavior

- Below an 880px container the delivery list and inspector stack, and below 760px endpoint rows wrap onto two lines.
- Below 540px padding tightens and the footer stacks; inner container queries also reflow the add form, delivery rows, and headers on their own widths.

## Performance

- Delivery rows are not virtualized; paginate from your webhook service for busy endpoints.
- ResizeObservers size the volume chart; there is no animation loop.

## Notes for AI

- Use on a developer settings page for managing webhook endpoints.
- Load endpoints, event volume and delivery attempts from your webhook service into webhooks-data.ts.
- Connect retry, send test event and endpoint creation to your API, and return the real signing secret once.

## Related

- [API keys](https://uiarc.dev/components/blocks/api-keys/markdown): API key management where Create key unfolds into its form and each secret is shown once.
- [Code block](https://uiarc.dev/components/code-block/markdown): Present code with legible hierarchy and copy access.
- [Copy button](https://uiarc.dev/components/copy-button/markdown): Copy a value with immediate confirmation.
- [Integrations](https://uiarc.dev/components/blocks/integrations/markdown): An integrations directory where Connect morphs to Connected and the filters recount as you go.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
