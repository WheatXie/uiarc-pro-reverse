# Metric ticker

> A strip of live KPIs that roll to new values digit by digit and flash their change; rest on one to pause the strip and open its recent trend as a sparkline.

- Type: Component (data)
- Access: Arc Pro
- Page: https://uiarc.dev/components/metric-ticker
- Markdown: https://uiarc.dev/components/metric-ticker/markdown
- Source file: `registry/components/metric-ticker/metric-ticker.tsx`
- Dependencies: motion, lucide-react
- Keywords: data, metric, realtime, new, ticker, kpi, metrics, live, stock ticker, marquee, strip, odometer, rolling digits, delta, sparkline, dashboard header, status, trend

## When to use

- A compact live readout of several KPIs above a dashboard, a status page or a trading view.
- Wall screens and operations views where values change on their own and people glance at them.
- A header strip that must fit anywhere from a phone to a wide monitor without redesign.

## When not to use

- Use metric-card or stat-card for one or two headline numbers with room for context.
- Use line-chart or sparkline when the trend over time is the main content, not a detail.
- Avoid it for values that change once a day; the live treatment would promise more than it delivers.

## Installation

Metric ticker is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/metric-ticker
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { MetricTicker, type TickerMetric } from "@/components/arc/metric-ticker/metric-ticker";

export function HealthStrip({ stats }: { stats: LiveStats }) {
  const metrics: TickerMetric[] = [
    { id: "mrr", label: "Monthly recurring revenue", value: stats.mrr, format: { style: "currency", currency: "USD", maximumFractionDigits: 0 } },
    { id: "active", label: "Active now", value: stats.activeUsers },
    { id: "conversion", label: "Trial conversion", value: stats.conversion, format: { style: "percent", maximumFractionDigits: 1 }, delta: "absolute", caption: "Rolling 7 days" },
    { id: "latency", label: "API p95", value: stats.p95, format: { style: "unit", unit: "millisecond" }, positive: "down", delta: "absolute", history: stats.p95History },
  ];

  return <MetricTicker metrics={metrics} label="Product health" />;
}
```

## API reference

### MetricTicker

A strip of live KPIs for the top of a dashboard. Each value rolls to its new reading digit by digit, ones first and each higher place a beat later like a mechanical counter, and its change flashes beside it as an arrow and an amount, green or red by whether the move is good news for that metric, before settling into a quieter tone. Rest on a metric, focus it or tap it and a floating panel grows out of it with a sparkline of recent values that draws itself in, the trend and the low and high; moving to the next metric glides the same panel across. When the metrics do not fit, the strip becomes a slow marquee that glides to a stop under the pointer, can be dragged or flicked and eases back into its drift, or a plain horizontal scroll.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `metrics` | `readonly TickerMetric[]` | – | The metrics in order: { id, label, value, format?, delta?, positive?, history?, caption? }. Pass a new array whenever a value changes; changes are matched by id. |
| `metrics[].format` | `Intl.NumberFormatOptions` | – | Number format for the value, such as currency, percent or a unit like { style: "unit", unit: "millisecond" }. Defaults to whole numbers. |
| `metrics[].delta` | `"percent" \| "absolute"` | `"percent"` | How the change reads: relative to the previous value, or as the raw difference in the metric's own format. Absolute changes of a percent metric read in points, such as 0.3 pts. |
| `metrics[].positive` | `"up" \| "down"` | `"up"` | Which direction is good news. Set down for latency, error rate or churn so a rise flashes red. |
| `metrics[].history` | `readonly number[]` | – | Recent values, oldest first, for the sparkline. Leave it out and the ticker keeps its own history from the values it has seen. |
| `metrics[].caption` | `string` | – | Context at the top of the panel, such as Rolling 7 days. Defaults to Last n updates. |
| `overflow` | `"marquee" \| "scroll"` | `"marquee"` | What happens when the metrics do not fit: a slow marquee that pauses on hover, focus and while a panel is open, or plain horizontal scrolling with snap points. Metrics that fit simply share the width. |
| `speed` | `number` | `32` | Marquee drift in pixels per second. |
| `flashDuration` | `number` | `1600` | How long a change stays emphasised before the delta settles to its resting tone, in milliseconds. |
| `historyLength` | `number` | `24` | Points kept for the sparkline when history is not passed. |
| `locale` | `string` | `"en-US"` | Formatting locale. Fixed by default so server and client render the same digits. |
| `label` | `string` | `"Live metrics"` | Accessible name of the strip. |
| `className` | `string` | – | Class on the root element. |
| `style` | `CSSProperties` | – | Inline styles on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves focus into the strip, onto the last focused metric. Focus opens its panel and pauses the marquee, bringing the metric into view. |
| Arrow Left / Arrow Right | Moves focus to the previous or next metric, wrapping at the ends; the panel glides with it. |
| Home / End | Moves focus to the first or last metric. |
| Enter / Space | Pins the panel open, or closes a pinned panel. |
| Escape | Closes the panel. |

## Accessibility

- The strip is a labelled region with a list of metrics. Each metric is a button named with its label, formatted value and change, such as API p95, 214 ms, up 2 ms, with aria-expanded and aria-controls pointing at the panel.
- Only one metric is a tab stop (roving tab index), so the strip costs one Tab however many metrics it holds.
- Changes pair an arrow and a signed amount with color, so good and bad news never rely on color alone.
- Values are not announced on every tick, which would flood a screen reader on a live strip; they are read when a metric is focused.
- The repeated copy that makes the marquee seamless is hidden from assistive technology and out of the tab order.
- The sparkline is decorative; the panel states the trend in words and the low and high as text.

## Motion

- Digits roll like an odometer on the smooth spring, turning the way the value moved and wrapping 9 to 0. The ones settle first and each higher place follows 25ms later, so a change ripples right to left. A new digit column or a wider delta opens on a spring, never in one frame.
- A change flashes for flashDuration: the delta's tint deepens, its arrow slides in from the direction of travel and a thin ring expands and fades once. Then the tint drains and the delta rests in a quieter tone until the next change.
- The marquee eases its speed rather than stopping dead: resting on the strip glides it to a halt in about half a second, leaving lets it pick up again gently. Drag to scrub it; release hands your flick back to the loop, which decays into the steady drift.
- The panel grows out of the metric that opened it on a morph spring, scaling from the metric's center. It follows its metric every frame, and moving to another metric glides it across while its content crossfades.
- The sparkline draws itself in, the area fades up under it and the last point pops in once the line arrives.
- Focusing a metric inside a moving marquee pulls it into view on the shortest path around the loop.
- With reduced motion there is no marquee (overflow falls back to horizontal scroll), digits change in place, the panel fades without scaling and the sparkline appears drawn.

## Responsive behavior

- Metrics that fit share the width equally. When they no longer fit, the strip becomes a marquee (or a snapping horizontal scroll with overflow="scroll"); the switch is measured with a ResizeObserver, not a breakpoint.
- The marquee feathers its ends with a mask while the border stays crisp.
- Below 420px values drop to the base size and metrics tighten their padding.
- The panel is at most 248px wide and is kept inside the component's box; leave room under the strip or let it float over the content below.
- Touch: a tap pins a panel and pauses the strip; a press anywhere outside closes it. Horizontal drags scrub the marquee while vertical page scrolling still works.

## Performance

- The marquee is one requestAnimationFrame loop writing a single transform. It stops entirely when the strip is offscreen, when the tab is hidden and when the marquee is not needed.
- The panel follows its metric with a frame loop that runs only while a panel is open.
- Digit wheels, the flash and the panel are transforms and opacity only. The sparkline is one small SVG path redrawn when its data changes.

## Notes for AI

- Use it as the live headline of a dashboard, status page or trading style view: four to eight metrics people glance at while doing something else.
- Set positive: "down" on any metric where lower is better (latency, errors, churn, cost). Getting this wrong flashes good news red.
- Use delta: "absolute" for rates and durations, where 0.3 points or 8 ms means more than a percent of a percent; keep the default percent for money and counts.
- Pass history when you already have a series from your backend; otherwise the ticker builds one from what it sees since mount.
- Keep labels to two or three words. The strip is for scanning; the panel caption can carry the context.
- Batch updates. One to a few changes a second reads as live; a new array every frame just flickers.

## Related

- [Metric card](https://uiarc.dev/components/metric-card/markdown): A compact summary for a number that needs context.
- [Sparkline](https://uiarc.dev/components/sparkline/markdown): Show a compact trend beside a value.
- [Animated counter](https://uiarc.dev/components/animated-counter/markdown): Give changing totals a clear sense of movement.
- [Line chart](https://uiarc.dev/components/line-chart/markdown): A multi-series line chart with a gliding crosshair, legend toggles, and paths that morph between ranges.

## Also in cards

- [Card](https://uiarc.dev/components/card/markdown): A contained group of related content and actions.
- [Empty state](https://uiarc.dev/components/empty-state/markdown): A useful next step when there is nothing to show yet.

## Guidance for AI tools

Metric ticker: A strip of live KPIs that roll to new values digit by digit and flash their change; rest on one to pause the strip and open its recent trend as a sparkline. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
