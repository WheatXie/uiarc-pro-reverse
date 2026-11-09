# Line charts

## `line-replay` · Line replay (Pro, block)

A time replay line chart that draws a day of traffic with a moving playhead, a value label on the tip, a scrubber, speed control and key moments annotated as the playhead passes them.

When to use:
- Post-launch or campaign reviews where the team wants to watch traffic respond to each announcement.
- Incident retrospectives that step through a metric with the alert, the deploy and the recovery marked.

When not to use:
- Use annotated-trend when people need to add and edit their own notes on a static trend.
- Use connected-scatter to replay how two measures moved together over time.

Keywords: replay, time replay, playback chart, animated line chart, playhead, scrubber, timeline, annotations, key moments, launch day, incident timeline, story chart, speed control

Files: src/components/arc/line-replay/demo.tsx, src/components/arc/line-replay/line-replay.module.css, src/components/arc/line-replay/line-replay.tsx

## `small-multiples` · Small multiples (Pro, block)

A trellis of small line charts that reads as one chart, with a synced crosshair, a shared or independent y scale that springs the axes, sorting with a FLIP reorder, a ghost of the overall total behind every panel and dimming for flat trends.

When to use:
- Comparing revenue, signups or usage across regions, products, plans or channels over the same months.
- Showing which segments grow, shrink or stall at a glance, with one shared crosshair to read every value for the same period.

When not to use:
- Use line-chart when two or three series need to be read against each other on one plot.
- Use metric-explorer or kpi-drilldown when a person picks one metric and drills into its detail.

Keywords: small multiples, trellis, facet, sparklines, line chart grid, synced crosshair, shared scale, independent scale, compare regions, compare products, trend, analytics, dashboard

Files: src/components/arc/small-multiples/demo.tsx, src/components/arc/small-multiples/small-multiples.module.css, src/components/arc/small-multiples/small-multiples.tsx
