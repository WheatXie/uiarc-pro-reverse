# Uptime status

> A status page with 90 day uptime bars, a morphing latency chart and an incident timeline.

- Type: Block
- Page: https://uiarc.dev/components/blocks/uptime-status
- Markdown: https://uiarc.dev/components/blocks/uptime-status/markdown

- Access: Arc Pro
- Registry id: `uptime-status`
- Source file: `registry/blocks/uptime-status/uptime-status.tsx`
- Built from: Badge, Button, Avatar, Animated counter
- Keywords: react status page, uptime monitor, service status page, uptime bars, incident timeline, 90 day uptime

Use this as a public or internal status page. Feed your incident history and monitor latency into uptime-data.ts; day bars, uptime percentages and chart scales are derived from them, and the incident button is a simulation.

## When to use

- A public or internal status page with per-service uptime history.
- Pages that combine 90 day uptime strips, response time, and an incident timeline.

## When not to use

- Use activity-heatmap for activity counts rather than availability.
- Use timeline for an incident history on its own.
- Use sparkline for a small latency trend inside a card.

## Installation

Uptime status is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/uptime-status
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { UptimeStatus } from "@/components/arc/blocks/uptime-status/uptime-status";

export default function StatusPage() {
  return (
    <main>
      <UptimeStatus />
    </main>
  );
}
```

## API reference

### UptimeStatus

A status page with 90 day uptime strips per service, a response time chart and an incident timeline. Takes no props; services, days, latency and incidents are sample data in uptime-data.ts, and the incident button is a simulation.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow left / Arrow right | Inspects the previous or next day on a service strip, or the previous or next half hour on the latency chart. |
| Page up / Page down | Jumps a week on a service strip. |
| Home / End | Jumps to the first or latest point. |
| Enter / Space | Selects the focused service so the latency chart follows it. |
| Escape | Clears the inspected day or point. |

## Accessibility

- Each strip is a focusable role="group" labelled with the service and described by its uptime summary.
- The latency chart has a text summary as its label, and polite live regions read out the inspected day or point.
- Incident headers are disclosure buttons with aria-expanded and aria-controls, and service rows use aria-pressed.

## Motion

- The selected service highlight moves between rows with a shared layout spring, and the tooltip follows the pointer on a spring.
- The latency line morphs between services, and status text swaps with a short rise.
- Reduced motion removes the springs and moves the tooltip directly.

## Responsive behavior

- Below an 860px container the response time chart and incidents stack into one column.
- Below 560px row details and uptime labels hide and the status button moves under the summary.
- Strips and the latency chart use touch-action pan-y, so touch scrubbing keeps vertical scroll.

## Performance

- Each service draws 90 SVG bars; many services on one page means hundreds of rects, which is fine but not free.
- Chart widths follow ResizeObservers; there is no animation loop.

## Notes for AI

- Use for a public or internal status page.
- Replace services, daily history, latency samples and incidents in uptime-data.ts; bars, percentages and scales derive from them.
- Remove or rewire the simulated incident trigger to your monitoring feed.

## Related

- [Activity heatmap](https://uiarc.dev/components/activity-heatmap/markdown): See a year of activity at a glance, one square per day.
- [Badge](https://uiarc.dev/components/badge/markdown): A small label for status, category, or metadata.
- [Timeline](https://uiarc.dev/components/timeline/markdown): Follow what happened, newest first, grouped by day.
- [Sparkline](https://uiarc.dev/components/sparkline/markdown): Show a compact trend beside a value.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
