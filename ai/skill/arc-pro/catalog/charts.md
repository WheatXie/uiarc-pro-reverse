# Charts

## `activity-heatmap` — Activity heatmap (Free, component)

See a year of activity at a glance, one square per day.

When to use:
- Daily rhythm over a long range, like contributions or workouts.
- Views where streaks and quiet weeks matter more than exact comparison.

When not to use:
- Use bar-chart when the exact comparison is the point.
- Use calendar to pick dates.

Keywords: data, chart, calendar, react activity heatmap, contribution graph, github calendar heatmap, calendar heatmap, streak chart, activity calendar

Files: registry/components/activity-heatmap/activity-heatmap.tsx, registry/components/activity-heatmap/activity-heatmap.module.css

## `animated-counter` — Animated counter (Free, component)

Give changing totals a clear sense of movement.

When to use:
- Standalone numbers that change, such as totals, prices, or live counts.
- Hero stats that roll up from zero when they scroll into view, via animateOnView.

When not to use:
- Use metric-card or stat-card when the number needs a card around it.
- Use text-morph for words rather than numbers.

Keywords: data, motion, react animated counter, number ticker, odometer counter, rolling digits, count up animation, animated number

Files: registry/components/animated-counter/animated-counter.tsx, registry/components/animated-counter/animated-counter.module.css

## `bar-chart` — Bar chart (Free, component)

Compare one measure across days and scrub any bar for its value.

When to use:
- One measure across days, weeks, or months, with an average line.
- Charts with a range switch, where stable keys let bars morph between ranges.

When not to use:
- Use sparkline for a compact trend.
- Use activity-heatmap for daily rhythm over a year.

Keywords: chart, bar, data, react bar chart, column chart, animated bar chart, svg bar chart, scrubbable chart, daily activity chart

Files: registry/components/bar-chart/bar-chart.tsx, registry/components/bar-chart/bar-chart.module.css

## `brush-chart` — Brush chart (Free, component)

A dense time series with an overview strip: drag a window to zoom, resize it by its handles, and read events in place.

When to use:
- Product analytics with a year or more of daily data.
- Incident reviews where events need to be read against a metric.

When not to use:
- Use line-chart for a few weeks of data or several series.
- Use sparkline for a small inline trend without interaction.

Keywords: data, chart, new, brush chart, zoomable time series, chart with overview, range selector chart, focus and context chart, stock chart brush, d3 brush react, annotated line chart

Files: registry/components/brush-chart/brush-chart.tsx, registry/components/brush-chart/brush-chart.module.css

## `donut-chart` — Donut chart (Free, component)

A donut whose arcs morph between datasets, with the active value rolling into the center.

When to use:
- Traffic by source, spend by category, or storage by file type.
- A dashboard card where the total and one highlighted share matter most.

When not to use:
- Use bar-chart when precise comparison between parts matters or there are many parts.
- Use gauge or usage-meter for a single value against a limit.

Keywords: data, new, react donut chart, pie chart, ring chart, share of total chart, animated donut, chart with legend, category breakdown, accessible pie chart

Files: registry/components/donut-chart/donut-chart.tsx, registry/components/donut-chart/donut-chart.module.css

## `gauge` — Gauge (Free, component)

Show a value against a known range.

When to use:
- One value against a known range, such as disk quota or health score.
- Values with labelled bands, like Healthy, Filling up, and Critical.

When not to use:
- Use progress for task completion.
- Use usage-meter for plan limits and activity-rings for several goals at once.

Keywords: data, chart, react gauge, gauge chart, radial meter, progress ring, threshold gauge, dashboard gauge

Files: registry/components/gauge/gauge.tsx, registry/components/gauge/gauge.module.css

## `line-chart` — Line chart (Free, component)

A multi-series line chart with a gliding crosshair, legend toggles, and paths that morph between ranges.

When to use:
- Traffic, revenue, or latency over days or weeks in a dashboard card.
- Comparing this period against a previous period or target with a dashed series.

When not to use:
- Use sparkline for a tiny inline trend with no axes or tooltip.
- Use bar-chart for discrete categories or counts per bucket.

Keywords: data, new, react line chart, time series chart, animated line chart, chart with crosshair, trend chart, multi series line chart, dashboard chart, accessible chart

Files: registry/components/line-chart/line-chart.tsx, registry/components/line-chart/line-chart.module.css

## `ridgeline` — Ridgeline (Free, component)

Overlapping distributions, one ridge per group: hover to lift a ridge and read its quartiles, switch datasets and every curve morphs.

When to use:
- Seasonal or categorical distributions such as temperatures by month or response times by region.
- Showing where two groups differ in shape, such as bimodal winters.

When not to use:
- Use beeswarm when each individual observation matters.
- Use bar-chart when only one summary number per group matters.

Keywords: data, chart, new, ridgeline, joy plot, joyplot, density plot, distribution, kde, quartiles

Files: registry/components/ridgeline/ridgeline.tsx, registry/components/ridgeline/ridgeline.module.css

## `slope-chart` — Slope chart (Free, component)

Before and after on two axes: lines draw in, rank moves sit beside each value, and switching datasets slides every line to its new slope.

When to use:
- Showing which items rose, which fell, and how the order changed between two periods.
- Replacing a grouped bar chart when the change is the story.

When not to use:
- Use line-chart for three or more moments.
- Use bar-chart when only the latest values matter.

Keywords: data, chart, new, slope chart, slopegraph, before after chart, react slope chart, rank change chart, two period comparison, bump chart, animated slope chart

Files: registry/components/slope-chart/slope-chart.tsx, registry/components/slope-chart/slope-chart.module.css

## `sparkline` — Sparkline (Free, component)

Show a compact trend beside a value.

When to use:
- A compact trend inside a card, table row, or KPI tile.
- Small charts people can scrub by pointer or keyboard to read past values.

When not to use:
- Use bar-chart for comparing discrete periods with axes.
- Use stat-card or metric-card when only the latest value matters.

Keywords: data, chart, react sparkline, mini line chart, trend line, inline chart, scrubbable chart, svg sparkline

Files: registry/components/sparkline/sparkline.tsx, registry/components/sparkline/sparkline.module.css

## `split-bar` — Split bar (Pro, component)

A single 100% bar split into shares: rest on a segment to widen it and read its exact figures, toggle segments from the legend and the rest reflow, with labels inside when they fit and on leader lines when they don't.

When to use:
- A compact part to whole view that fits in a card row or a dashboard header.
- Comparing shares where people also want exact figures on demand and the option to leave a category out.

When not to use:
- Use bar-chart to compare absolute values across many categories.
- Use donut-chart when the total in the middle is the headline, or waffle-chart for a count of units.

Keywords: data, chart, motion, new, split bar, stacked bar, 100% bar, part to whole, share, proportion, percent, traffic sources, budget, storage bar, legend toggle, leader lines, segment, breakdown

Files: demo.module.css, demo.tsx, split-bar.module.css, split-bar.tsx

## `streamgraph` — Streamgraph (Free, component)

Layered streams on a wiggle baseline that morph between ranges, with a layer you can isolate and read week by week.

When to use:
- Showing the changing share of topics, channels, or genres week by week.
- Storytelling dashboards where the shape of seasonality and spikes is the point.

When not to use:
- Use line-chart when exact values or comparisons between series matter.
- Use bar-chart for a few periods or categories.

Keywords: data, chart, new, streamgraph, stream graph react, stacked area chart, wiggle chart, theme river, stacked stream chart, layered area chart, animated streamgraph

Files: registry/components/streamgraph/streamgraph.tsx, registry/components/streamgraph/streamgraph.module.css

## `treemap` — Treemap (Free, component)

A squarified treemap: click to drill and the tiles grow to fill the view, with a breadcrumb back and metrics that morph every tile.

When to use:
- Many parts where the biggest ones matter and people drill for detail.
- Showing size and a second measure at once.

When not to use:
- Use bar-chart when exact comparisons between similar values matter.
- Use sunburst when the depth of the hierarchy is the story.

Keywords: data, chart, new, treemap, tree map, squarified, hierarchy, part to whole, drill down, zoomable treemap

Files: registry/components/treemap/treemap.tsx, registry/components/treemap/treemap.module.css

## `waffle-chart` — Waffle chart (Free, component)

A ten by ten unit chart where every cell is one percent, and cells fly to their new group when the data changes.

When to use:
- Showing shares of one whole where people should be able to count units.
- Comparing the same categories across a few datasets, such as countries or years.

When not to use:
- Use line-chart or streamgraph for how shares change over time.
- Use bar-chart when exact comparison of many categories matters more than the whole.

Keywords: data, chart, new, waffle chart, unit chart, square pie chart, percentage grid, part to whole chart, react waffle chart, animated waffle, isotype chart

Files: registry/components/waffle-chart/waffle-chart.tsx, registry/components/waffle-chart/waffle-chart.module.css
