# Delivery tracker

> A live order tracker whose marker glides between stops while the arrival time rolls.

- Type: Block
- Page: https://uiarc.dev/components/blocks/delivery-tracker
- Markdown: https://uiarc.dev/components/blocks/delivery-tracker/markdown

- Access: Arc Pro
- Registry id: `delivery-tracker`
- Source file: `registry/blocks/delivery-tracker/delivery-tracker.tsx`
- Built from: Avatar, Button, Text morph
- Keywords: react delivery tracker, order tracking page, shipment status, courier tracking ui, package tracker, eta tracker

Use this on an order status page. Feed it updates from your carrier or dispatch webhooks and connect the courier contact options to your messaging and masked calling service; the preview is simulated.

## When to use

- Order status pages that follow a delivery from dispatch to door.
- Tracking screens with a live arrival time and an event history.
- Deliveries where people can message or call the courier.

## When not to use

- Use timeline for a static list of past events.
- Use progress when a single percentage is enough.
- Use support-conversation for a full chat with support.

## Installation

Delivery tracker is part of Arc Pro. The live preview is public; the source and install command need Pro. It uses local image assets, so it is not in the registry: copy the source from the Manual tab while signed in, or read it with the Arc MCP server and a Pro token.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { DeliveryTracker } from "@/components/arc/blocks/delivery-tracker/delivery-tracker";

export default function OrderPage() {
  return (
    <main>
      <DeliveryTracker className="order-status" />
    </main>
  );
}
```

## API reference

### DeliveryTracker

An order status card with a route progress bar, rolling arrival time, event history, and a courier contact panel for quick replies and calls. The order, courier, and updates are simulated.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `className` | `string` | – | Extra class on the root element. |

## Accessibility

- Stage changes and arrival updates are announced through a polite live region.
- Quick replies are a labelled group, and the courier typing indicator is a role="status" with a label.
- Call status text updates in its own polite live region.

## Motion

- The marker glides between stops while the arrival time rolls.
- The contact button morphs into the contact panel through a shared layoutId.
- Reduced motion makes the marker and panel morph instant.

## Responsive behavior

- Below 760px container width the courier, updates, and order stack in one column.
- Below 560px the hero stacks and only the current stop keeps its label on the route bar.

## Performance

- The call timer interval runs only during a call, and a ResizeObserver positions the route marker.
- Shared layoutIds morph the contact button into its panel; nothing animates while idle.

## Notes for AI

- Use on an order status page.
- Replace the simulated timeline with updates from your carrier or dispatch webhooks, and swap the sample product photos.
- Connect message and call actions to your messaging and masked calling service; composes Arc avatar, button, and text-morph.

## Related

- [Timeline](https://uiarc.dev/components/timeline/markdown): Follow what happened, newest first, grouped by day.
- [Avatar](https://uiarc.dev/components/avatar/markdown): A compact identity marker for people and accounts.
- [Support conversation](https://uiarc.dev/components/blocks/support-conversation/markdown): A responsive message thread with useful quick replies and live feedback.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
