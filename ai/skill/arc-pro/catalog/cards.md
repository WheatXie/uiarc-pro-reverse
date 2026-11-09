# Cards

## `card` — Card (Free, component)

A contained group of related content and actions.

When to use:
- Browsable items in a grid, such as projects, listings, or posts.
- Items that should open into a larger quick look dialog without leaving the page, via details.

When not to use:
- Use expandable-card for inline disclosure without a dialog.
- Use stat-card or metric-card for numbers.

Keywords: surface, layout, react card, card component, card with image, expand card to modal, quick look card, shared layout card, project card

Files: registry/components/card/card.tsx, registry/components/card/card.module.css

## `empty-state` — Empty state (Free, component)

A useful next step when there is nothing to show yet.

When to use:
- Empty lists, zero search results, and first-run views.
- A view that should morph between states, such as empty and success, by changing props.

When not to use:
- Use skeleton while data is still loading.
- Use alert for errors inside a page that still has content.

Keywords: data, guidance, react empty state, no results, empty list placeholder, zero state, blank slate, first run empty view

Files: registry/components/empty-state/empty-state.tsx, registry/components/empty-state/empty-state.module.css

## `metric-card` — Metric card (Free, component)

A compact summary for a number that needs context.

When to use:
- A single plain number with odometer style rolling digits, such as uptime or orders.
- Numbers that update live and should roll in the direction they moved.

When not to use:
- Use stat-card for preformatted strings, trend arrows, tones, and icons.
- Use sparkline when the trend over time matters more than the latest value.

Keywords: data, summary, react metric card, kpi card, odometer number, rolling number card, dashboard metric, stat tile

Files: registry/components/metric-card/metric-card.tsx, registry/components/metric-card/metric-card.module.css

## `metric-ticker` — Metric ticker (Pro, component)

A strip of live KPIs that roll to new values digit by digit and flash their change; rest on one to pause the strip and open its recent trend as a sparkline.

When to use:
- A compact live readout of several KPIs above a dashboard, a status page or a trading view.
- Wall screens and operations views where values change on their own and people glance at them.

When not to use:
- Use metric-card or stat-card for one or two headline numbers with room for context.
- Use line-chart or sparkline when the trend over time is the main content, not a detail.

Keywords: data, metric, realtime, new, ticker, kpi, metrics, live, stock ticker, marquee, strip, odometer, rolling digits, delta, sparkline, dashboard header, status, trend

Files: demo.module.css, demo.tsx, metric-ticker.module.css, metric-ticker.tsx
