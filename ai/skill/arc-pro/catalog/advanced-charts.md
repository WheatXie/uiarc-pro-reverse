# Advanced charts

## `data-grid` · Data grid (Pro, component)

A spreadsheet grid with range selection, inline editing, a fill handle, and animated sorting.

When to use:
- Editing many values in place like a spreadsheet, such as budgets, price lists, or inventory.
- Data people move to and from Excel or Google Sheets with copy and paste.

When not to use:
- Use sortable-data-table for read-only records with sorting and row selection.
- Use a form when people edit one record at a time.

Keywords: data, table, spreadsheet, editing, react data grid, spreadsheet component, editable table, excel like grid, inline cell editing, copy paste from excel, fill handle, virtualized table, pinned columns, column filters

Files: data-grid.module.css, data-grid.tsx, demo.tsx

## `funnel-chart` · Funnel chart (Pro, component)

A tapered conversion funnel with drop-off at every step, a device split that morphs the band, and dots that stream through it.

When to use:
- Conversion through a fixed sequence of steps.
- Comparing how two segments convert through the same steps.

When not to use:
- Use sankey-flow when people can branch, skip, or loop between steps.
- Use bar-chart for unordered categories.

Keywords: data, chart, new, funnel chart, conversion funnel, react funnel chart, drop-off chart, checkout funnel, animated funnel, segment comparison funnel, growth funnel

Files: demo.module.css, demo.tsx, funnel-chart.module.css, funnel-chart.tsx

## `race-bar-chart` · Race bar chart (Pro, component)

A ranking over time: bars overtake each other on springs, values count up, and a timeline you can play or scrub.

When to use:
- Showing how the leaders of a ranking change across many periods.
- A launch or recap moment where the motion itself is the point.

When not to use:
- Use line-chart when exact trends over time matter more than rank.
- Use bar-chart for a single period's comparison.

Keywords: data, chart, new, bar chart race, racing bars, ranking over time, animated bar chart, leaderboard, timeline, data story

Files: demo.module.css, demo.tsx, race-bar-chart.module.css, race-bar-chart.tsx

## `radar-chart` · Radar chart (Pro, component)

Two or three profiles on one web: shapes morph when you swap a profile, and a sweep across the axes compares values in place.

When to use:
- Comparing the profile of a few options across shared measures.
- Showing strengths and gaps at a glance, such as scores or ratings.

When not to use:
- Use bar-chart when the precise difference on one measure matters.
- Use plan-matrix for feature comparisons with yes or no values.

Keywords: data, chart, new, radar chart, spider chart, web chart, react radar chart, comparison chart, animated radar chart, profile comparison, polar chart

Files: demo.module.css, demo.tsx, radar-chart.module.css, radar-chart.tsx

## `realtime-stream` · Realtime stream (Pro, component)

A live line that scrolls at 60fps as readings arrive, holds still on hover to read, and pops a marker on every anomaly.

When to use:
- Live monitoring panels and status pages.
- A hero on an infrastructure or observability page where motion shows the system is alive.

When not to use:
- Use line-chart for static time series.
- Use brush-chart for long histories people zoom into.

Keywords: data, chart, live, new, realtime chart, live chart, streaming chart, react live line chart, monitoring chart, scrolling chart, anomaly chart, 60fps chart

Files: demo.tsx, realtime-stream.module.css, realtime-stream.tsx

## `sankey-flow` · Sankey flow (Pro, component)

Flows between stages as ribbons with drifting particles; hover any node or ribbon to pour its share through the whole journey.

When to use:
- Showing how a total splits and recombines across three to five stages.
- Explaining where a funnel leaks, with the share at each step one hover away.

When not to use:
- Use bar-chart for a simple linear funnel with no branches.
- Use sunburst for a strict hierarchy where each part has one parent.

Keywords: data, chart, new, sankey diagram, sankey chart react, flow diagram, funnel flow, user journey chart, alluvial diagram, particle flow chart, conversion flow

Files: demo.module.css, demo.tsx, sankey-flow.module.css, sankey-flow.tsx

## `sunburst` · Sunburst (Pro, component)

A hierarchy in rings: click a segment and every arc swings around it as the new centre, with a breadcrumb back and a rolling total.

When to use:
- Drilling into where a total comes from, one level at a time.
- Showing the share of each part within its parent and within the whole.

When not to use:
- Use donut-chart for a single level of parts.
- Use tree-table when people need to compare exact values across many rows.

Keywords: data, chart, new, sunburst chart, zoomable sunburst, hierarchical pie chart, radial treemap, drill down chart, multi level donut, cloud cost breakdown, react sunburst

Files: demo.module.css, demo.tsx, sunburst.module.css, sunburst.tsx
