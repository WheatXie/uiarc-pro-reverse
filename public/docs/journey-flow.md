# Journey flow

> A Sankey of user journeys whose flows morph by channel and trace a cohort on hover.

- Type: Block
- Page: https://uiarc.dev/components/blocks/journey-flow
- Markdown: https://uiarc.dev/components/blocks/journey-flow/markdown

- Access: Arc Pro
- Registry id: `journey-flow`
- Source file: `registry/blocks/journey-flow/journey-flow.tsx`
- Keywords: react sankey diagram, user journey flow, funnel flow chart, sankey chart, conversion paths, user flow visualization

Use this to show where users go between funnel steps on an analytics page. Replace the link counts in journey-flow-geometry.ts with your own; layout, tracing and rates are computed from them.

## When to use

- Showing where users go between funnel stages, such as visit to signup to activation.
- Comparing flows across acquisition channels with a segment switch.
- Tracing one step to see which paths lead into and out of it.

## When not to use

- Use cohort-retention to show how groups retain over time.
- Use bar-chart for a simple linear funnel without branching paths.
- Use metrics-dashboard for a general KPI overview.

## Installation

Journey flow is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/journey-flow
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { JourneyFlow } from "@/components/arc/blocks/journey-flow/journey-flow";

export default function FunnelPage() {
  return <JourneyFlow className="funnel" />;
}
```

## API reference

### JourneyFlow

A Sankey of trial journeys across funnel stages. A channel switch morphs every band, hovering a step or band traces that cohort through the whole journey with a tooltip, and selecting a step pins its breakdown in a side panel with rolling counts. A data table toggle shows the same numbers. Nodes, links, and per-segment counts are sample data in journey-flow-geometry.ts.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `className` | `string` | – | Appended to the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys | In the segment switch, move between channels. On steps, Up/Down moves within a stage and Left/Right to the nearest step in the next or previous stage. |
| Home / End | Jump to the first or last step. |
| Enter / Space | Selects a step to trace its flows. |
| Escape | Clears the traced step. |

## Accessibility

- Segments form a role="radiogroup"; steps sit in a role="toolbar" with roving tabIndex and aria-pressed.
- The diagram is role="img" with a text summary; each step button's label includes its users and share of visitors.
- A polite live region announces visits and paid plans when the channel changes.
- The breakdown panel is a labelled aside, and the data table toggle exposes aria-expanded for a non-visual reading of the chart.

## Motion

- Ribbons morph their widths on a spring slightly slower than a control when the segment changes; counts follow a beat later and never overshoot.
- Tracing dims everything outside the cohort; panel text settles with a short rise and digits roll in place.
- Reduced motion swaps the morph for an instant change with an opacity fade.

## Responsive behavior

- From an 860px container the detail panel sits beside the chart at 280px; below that it moves under the chart.
- Below 560px the segment switch fills the width and padding tightens, and below 480px step labels shrink to 10 to 11px.
- A ResizeObserver feeds the chart width, so ribbons re-lay out on resize rather than scaling.

## Performance

- Ribbons are SVG paths computed from 13 sample nodes; very large graphs with many stages will get crowded and slower to morph.
- Segment changes morph ribbon widths on springs, with no loop running at rest.

## Notes for AI

- Use to show where users go between funnel steps on an analytics page.
- Replace NODES, STAGES, LINKS and SEGMENTS in journey-flow-geometry.ts with your counts; layout, tracing and percentages are computed.
- No callbacks; selection is internal.

## Related

- [Metrics dashboard](https://uiarc.dev/components/blocks/metrics-dashboard/markdown): A dense analytics view with KPI tabs, one inspectable chart, and top pages and sources.
- [Cohort retention](https://uiarc.dev/components/blocks/cohort-retention/markdown): A cohort retention triangle that morphs into retention curves and rewashes by segment.
- [Revenue explorer](https://uiarc.dev/components/blocks/revenue-explorer/markdown): A SaaS revenue chart you zoom with a brush while paths, axes and figures glide to the range.
- [Segmented control](https://uiarc.dev/components/segmented-control/markdown): Switch between a small set of related views.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
