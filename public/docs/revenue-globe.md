# Revenue globe

> A dotted globe where live payments arc home to headquarters, with a replayable day.

- Type: Block
- Page: https://uiarc.dev/components/blocks/revenue-globe
- Markdown: https://uiarc.dev/components/blocks/revenue-globe/markdown

- Access: Arc Pro
- Registry id: `revenue-globe`
- Source file: `registry/blocks/revenue-globe/revenue-globe.tsx`
- Built from: Animated counter
- Keywords: react globe, revenue globe, payments map animation, 3d globe canvas, live transactions map, dotted globe

Use this on a revenue or operations overview to show where money comes from right now. Swap minuteTx in globe-data.ts for a query on your payments table; totals, arcs and replay all derive from it.

## When to use

- Revenue or operations overviews showing where payments come from right now.
- Showcase pages where a live globe with arcs and a day timeline adds impact.

## When not to use

- Use a table or bar-chart when exact regional numbers matter more than the view.
- Use customer-galaxy to explore accounts rather than transactions.
- Use revenue-explorer for revenue over time.

## Installation

Revenue globe is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/revenue-globe
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { RevenueGlobe } from "@/components/arc/blocks/revenue-globe/revenue-globe";

export default function RevenueOverview() {
  return (
    <section>
      <RevenueGlobe />
    </section>
  );
}
```

## API reference

### RevenueGlobe

A dotted canvas globe where payments arc into headquarters, with a scrubbable day timeline, replay and region and city breakdowns. Takes no props; cities, regions and the transaction stream are sample data in globe-data.ts.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys | Spins the globe when it has focus. |
| Escape | Clears the selected city or region. |
| Arrow keys (timeline) | Moves the time by five minutes, or an hour with Shift. |
| Page up / Page down | Moves the time by an hour. |
| Home / End | Jumps to midnight or back to live. |

## Accessibility

- The globe is a focusable region with a roledescription, instructions in its label and a text summary of revenue.
- The timeline is a role="slider" whose value text reads the UTC time.
- Region and city rows are aria-pressed buttons, and a polite live region announces changes.

## Motion

- Payments draw as arcs to headquarters while the globe drifts; drags rubber-band past the latitude limit.
- The tooltip follows the pointer on a spring, and totals roll with the animated counter.
- Reduced motion stops the auto rotation, hides replay and play controls, and shows the current state as Now.

## Responsive behavior

- Below an 880px container the panel moves under the globe and the globe height follows width with clamp.
- Below 600px the panel drops to one column; below 400px the clock takes its own row.
- The timeline slider uses touch-action none and pointer capture, so scrubbing works on touch.

## Performance

- Draws on a 2D canvas with devicePixelRatio capped at 2.
- The animation loop pauses offscreen via IntersectionObserver and in hidden tabs.

## Notes for AI

- Use on a revenue or operations overview to show where money comes from right now.
- Swap minuteTx in globe-data.ts for a query on your payments table, and set HQ, CITIES and REGIONS to your own.

## Related

- [Customer galaxy](https://uiarc.dev/components/blocks/customer-galaxy/markdown): 2,400 accounts as a drifting galaxy that spirals into clusters by plan, region or health.
- [Activity terrain](https://uiarc.dev/components/blocks/activity-terrain/markdown): A 3D terrain of hourly activity you can orbit, zoom, fly into and flatten into a heatmap.
- [Animated counter](https://uiarc.dev/components/animated-counter/markdown): Give changing totals a clear sense of movement.
- [Revenue explorer](https://uiarc.dev/components/blocks/revenue-explorer/markdown): A SaaS revenue chart you zoom with a brush while paths, axes and figures glide to the range.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
