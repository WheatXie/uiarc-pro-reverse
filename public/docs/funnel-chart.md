# Funnel chart

> A tapered conversion funnel with drop-off at every step, a device split that morphs the band, and dots that stream through it.

- Type: Component (data)
- Access: Arc Pro
- Page: https://uiarc.dev/components/funnel-chart
- Markdown: https://uiarc.dev/components/funnel-chart/markdown
- Source file: `registry/components/funnel-chart/funnel-chart.tsx`
- Dependencies: motion
- Keywords: data, chart, new, funnel chart, conversion funnel, react funnel chart, drop-off chart, checkout funnel, animated funnel, segment comparison funnel, growth funnel

## When to use

- Conversion through a fixed sequence of steps.
- Comparing how two segments convert through the same steps.
- A hero chart on a growth or analytics page where the drop-off is the story.

## When not to use

- Use sankey-flow when people can branch, skip, or loop between steps.
- Use bar-chart for unordered categories.
- Use line-chart for conversion over time.

## Installation

Funnel chart is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/funnel-chart
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { FunnelChart } from "@/components/arc/funnel-chart/funnel-chart";

const segments = [{ key: "mobile", label: "Mobile" }, { key: "desktop", label: "Desktop" }];
const stages = [
  { key: "visit", label: "Visited store", values: { mobile: 68420, desktop: 31580 } },
  { key: "cart", label: "Added to cart", values: { mobile: 9140, desktop: 7280 } },
  { key: "purchase", label: "Purchased", values: { mobile: 1540, desktop: 2050 } },
];

export function Checkout() {
  const [view, setView] = useState("total");
  return <FunnelChart stages={stages} segments={segments} view={view} label="Checkout funnel" unit="sessions" />;
}
```

## API reference

### FunnelChart

A conversion funnel drawn as one smooth tapered band: flat across each step and eased between them, with drop-off at every boundary. Segments can be isolated or split with a 2px gap, and every change morphs the band. Optional dots stream through it and the share that leaves at each step falls out.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `stages` (required) | `FunnelStage[]` | – | Ordered steps: { key, label, value? , values? }. Use value without segments, values keyed by segment with them. |
| `segments` | `FunnelSegment[]` | – | Parts of every step, such as devices: { key, label }. Leave it out for one total per step. |
| `label` (required) | `string` | – | What is counted. Names the chart, the summary, and the table. |
| `unit` | `string` | `""` | Noun after counts in the tooltip and table, such as "sessions". |
| `view` | `"total" \| "split" \| string` | `"total"` | "total" draws one band, "split" stacks every segment with a gap, and a segment key isolates it and rescales the band to fill the height. |
| `flow` | `boolean` | `true` | Dots that stream through the band. Each decides up front where it leaves, so the falling share matches the real drop-off. |
| `orientation` | `"auto" \| "horizontal" \| "vertical"` | `"auto"` | Auto turns the funnel vertical below 420px of container width, with steps listed down the side. |
| `height` | `number` | `200` | Band area thickness in pixels when horizontal. |
| `formatValue` | `(value: number) => string` | – | Formats counts. Defaults to compact numbers in headings and full numbers in the tooltip. |
| `activeIndex` | `number \| null` | – | Controlled step in focus. |
| `onActiveChange` | `(index: number \| null) => void` | – | Called as the step in focus changes. |
| `emptyLabel` | `string` | `"No data"` | Message when the first step is zero. |
| `ref` | `Ref<HTMLElement>` | – | Forwarded to the figure. |
| `className` | `string` | – | Extra class on the figure. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Focuses the funnel and reads the first step. |
| ArrowRight / ArrowDown | Next step. |
| ArrowLeft / ArrowUp | Previous step. |
| Home / End | First or last step. |
| Escape | Clears the reading. |

## Accessibility

- The chart is a focusable group with a roledescription and instructions; the band, dots, and headings are aria-hidden.
- A polite live region reads the step, its count, the share kept from the previous step, and the share of the first.
- A visually hidden summary and a table list every step per segment with both rates.
- Drop-off uses an arrow glyph and a number, never colour alone.

## Motion

- Switching views morphs the band from the shape on screen with a spring; the split gap opens and closes with the same spring.
- Counts and rates roll to their new values.
- A soft column and an accent clip glide to the step in focus; the tooltip follows on its own spring and stays inside the chart.
- The band grows out of its centre line the first time it is seen.
- Dots run on a canvas at the display rate, pause off screen and in hidden tabs, and are never drawn with reduced motion, where the morphs also land immediately.

## Responsive behavior

- Horizontal from 420px of container width, vertical below with step names down the right side.
- The tooltip flips and clamps so it never leaves the chart.
- Touch reads steps with a press and drag; the page still scrolls vertically.

## Performance

- Band paths are rewritten from a single paint function; React does not re-render during morphs.
- Dots are drawn on one canvas and stop when the chart leaves the viewport.
- Around 40 dots are alive at once.

## Notes for AI

- Choose it for ordered steps where each keeps part of the previous one: signup, checkout, onboarding, sales pipeline.
- Pass segments and drive view from a segmented control to compare devices, plans, or channels.
- Keep stage labels short; they wrap to two lines above the band.
- Turn flow off for dense dashboards where motion would distract.

## Related

- [Sankey flow](https://uiarc.dev/components/sankey-flow/markdown): Flows between stages as ribbons with drifting particles; hover any node or ribbon to pour its share through the whole journey.
- [Bar chart](https://uiarc.dev/components/bar-chart/markdown): Compare one measure across days and scrub any bar for its value.
- [Waffle chart](https://uiarc.dev/components/waffle-chart/markdown): A ten by ten unit chart where every cell is one percent, and cells fly to their new group when the data changes.
- [Stepper](https://uiarc.dev/components/stepper/markdown): Show where a person is in a multi-step flow and what is done.

## Also in advanced charts

- [Sunburst](https://uiarc.dev/components/sunburst/markdown): A hierarchy in rings: click a segment and every arc swings around it as the new centre, with a breadcrumb back and a rolling total.
- [Radar chart](https://uiarc.dev/components/radar-chart/markdown): Two or three profiles on one web: shapes morph when you swap a profile, and a sweep across the axes compares values in place.
- [Realtime stream](https://uiarc.dev/components/realtime-stream/markdown): A live line that scrolls at 60fps as readings arrive, holds still on hover to read, and pops a marker on every anomaly.
- [Race bar chart](https://uiarc.dev/components/race-bar-chart/markdown): A ranking over time: bars overtake each other on springs, values count up, and a timeline you can play or scrub.
- [Data grid](https://uiarc.dev/components/data-grid/markdown): A spreadsheet grid with range selection, inline editing, a fill handle, and animated sorting.

## Guidance for AI tools

Funnel chart: A tapered conversion funnel with drop-off at every step, a device split that morphs the band, and dots that stream through it. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
