# Analytics

## `account-health` · Account health (Pro, block)

A customer success card where a health score gauge, a renewal countdown and five sourced signals with sparklines lead into an AI risk summary and one recommended next step, like scheduling a QBR before usage slips further.

When to use:
- A customer success or account page that needs a score, the signals behind it and a next step.
- Renewal prep views where the countdown and risk drivers matter more than raw metrics.

When not to use:
- Portfolio views across many accounts; use a table with a score column instead.
- Deep metric exploration with axes and ranges; use a full chart.

Keywords: account health, customer health score, customer success, churn risk, renewal, qbr, nps, seat utilization, health gauge, ai summary, csm, sparkline

Files: account-health-data.tsx, account-health.module.css, account-health.tsx, demo.tsx

## `choropleth-explorer` · Choropleth explorer (Pro, block)

A filled-region map that shades every state or region by revenue, growth or penetration on a stepped scale, with a country switch (United States, Canada, Brazil, United Kingdom, France, Germany, Italy, Australia), a hoverable legend, a synced ranked list and a camera zoom into local detail.

When to use:
- Sales, revenue or usage dashboards that break a metric down by state, country or territory.
- Market coverage and penetration reviews where a region's own subareas explain its number.

When not to use:
- Use offices-map to place pins at specific locations such as offices or stores.
- Use revenue-globe for flows and totals on a spinning globe when geography is ambience rather than the comparison.

Keywords: choropleth, map, filled map, heat map, geography, states, counties, regions, drilldown, zoom, sales territories, penetration, legend, analytics

Files: choropleth-explorer-data.ts, choropleth-explorer.module.css, choropleth-explorer.tsx, demo.tsx

## `cohort-retention` · Cohort retention (Pro, block)

A cohort retention triangle that morphs into retention curves and rewashes by segment.

When to use:
- Growth or customer success dashboards comparing how signup cohorts retain month over month.
- Views that need both the cohort triangle and retention curves from the same data.

When not to use:
- Use journey-flow for paths between funnel steps.
- Use activity-heatmap for activity by day rather than by cohort.

Keywords: react cohort retention chart, retention triangle, cohort analysis table, retention curves, churn cohort heatmap, saas retention chart

Files: cohort-retention.module.css, cohort-retention.tsx, demo.tsx

## `connected-scatter` · Connected scatter (Pro, block)

A connected scatterplot of monthly CAC against LTV where the path draws itself in, a scrubber moves a head along the curve, and a channel switch morphs the path against a shaded 3x target line.

When to use:
- A growth or finance screen that shows whether unit economics are moving toward or away from a target ratio.
- Comparing how a few segments or channels travelled through the same two metrics over the same months.

When not to use:
- Use line-chart or metric-explorer when time itself is the axis and one metric is enough.
- Use efficient-frontier for risk against return of a portfolio you can change.

Keywords: connected scatter, connected scatterplot, scatter plot, cac, ltv, ltv to cac, unit economics, time series, trajectory, path chart, scrubber, morph, growth, acquisition channels, price volume

Files: connected-scatter.module.css, connected-scatter.tsx, demo.tsx

## `horizon-chart` · Horizon chart (Pro, block)

A horizon chart that stacks fourteen daily series as compact folded rows, with a synced crosshair, a sort by name, peak or latest, a band count setting that folds every row on one spring, and a legend that explains how to read the bands.

When to use:
- Operations or growth dashboards comparing many markets, services or products against their own baseline over weeks or months.
- Monitoring views where the reader scans for which rows broke from normal and when, then reads exact values on one day.

When not to use:
- Use small-multiples when there are only a few series and the reader needs axes and exact levels in each panel.
- Use ridgeline to compare distributions rather than values over time.

Keywords: horizon chart, horizon graph, time series, many series, deviation, baseline, anomaly, monitoring, compact chart, bands, crosshair, analytics

Files: demo.tsx, horizon-chart.module.css, horizon-chart.tsx

## `journey-flow` · Journey flow (Pro, block)

A Sankey of user journeys whose flows morph by channel and trace a cohort on hover.

When to use:
- Showing where users go between funnel stages, such as visit to signup to activation.
- Comparing flows across acquisition channels with a segment switch.

When not to use:
- Use cohort-retention to show how groups retain over time.
- Use bar-chart for a simple linear funnel without branching paths.

Keywords: react sankey diagram, user journey flow, funnel flow chart, sankey chart, conversion paths, user flow visualization

Files: demo.tsx, journey-flow.module.css, journey-flow.tsx

## `kpi-drilldown` · KPI drilldown (Pro, block)

KPI cards that expand into a full detail chart with period comparison and a breakdown table, then fold back.

When to use:
- An analytics or finance overview where each number deserves a closer look.
- Executive dashboards that compare the current period with the previous one.

When not to use:
- Use metric-explorer to compare many metrics on one chart.
- Use metrics-dashboard for a static summary without drill down.

Keywords: kpi, dashboard, drilldown, metric card, shared layout, expand card, period comparison, breakdown table, sparkline, analytics

Files: demo.tsx, kpi-drilldown.module.css, kpi-drilldown.tsx

## `metric-explorer` · Metric explorer (Pro, block)

KPI cards that open into a scrubbable chart and morph between metrics and ranges.

When to use:
- The top of a SaaS analytics or finance page with KPI cards that open into a chart.
- Dashboards where people move between a few metrics and date ranges.

When not to use:
- Use stat-card or metric-card for static KPI tiles.
- Use revenue-explorer for a revenue breakdown with a range brush.

Keywords: react kpi cards, metric explorer, analytics dashboard chart, expandable stat card, kpi to chart, saas metrics

Files: demo.tsx, metric-data.ts, metric-explorer.module.css, metric-explorer.tsx

## `metrics-dashboard` · Metrics dashboard (Pro, block)

A dense analytics view with KPI tabs, one inspectable chart, and top pages and sources.

When to use:
- A small, explorable KPI overview with a range toggle and one chart.
- Product or marketing dashboards with four headline metrics, a 7, 30, or 90 day range, and top pages and sources.

When not to use:
- Use metric-explorer or revenue-explorer for larger or drill-down data.
- Use stat-card for a single number.

Keywords: react metrics dashboard, analytics dashboard, kpi dashboard, dashboard with chart, saas analytics ui, traffic dashboard

Files: demo.tsx, metrics-dashboard.module.css, metrics-dashboard.tsx

## `mrr-waterfall` · MRR waterfall (Pro, block)

An MRR bridge whose floating bars morph by period and open the accounts behind each move.

When to use:
- Revenue or board reporting that explains how MRR moved from start to end of a period.
- Finance views where each movement should list the accounts behind it.

When not to use:
- Use revenue-explorer for MRR over many months.
- Use bar-chart for plain comparisons that do not build from a start value.

Keywords: react waterfall chart, mrr bridge, revenue waterfall, mrr movements chart, saas revenue bridge, floating bar chart

Files: demo.tsx, mrr-data.ts, mrr-waterfall.module.css, mrr-waterfall.tsx

## `revenue-explorer` · Revenue explorer (Pro, block)

A SaaS revenue chart you zoom with a brush while paths, axes and figures glide to the range.

When to use:
- Monthly MRR or revenue broken into new, expansion, and churn on an analytics page.
- Charts where people need to zoom a date range with an overview brush and compare against a prior period.

When not to use:
- Use mrr-waterfall to explain how MRR moved between two points in time.
- Use metric-explorer for a row of KPI cards that open into a chart.

Keywords: react revenue chart, mrr chart, chart with brush zoom, range selector chart, saas analytics chart, comparison line chart, interactive area chart

Files: demo.tsx, revenue-explorer.module.css, revenue-explorer.tsx

## `uptime-status` · Uptime status (Pro, block)

A status page with 90 day uptime bars, a morphing latency chart and an incident timeline.

When to use:
- A public or internal status page with per-service uptime history.
- Pages that combine 90 day uptime strips, response time, and an incident timeline.

When not to use:
- Use activity-heatmap for activity counts rather than availability.
- Use timeline for an incident history on its own.

Keywords: react status page, uptime monitor, service status page, uptime bars, incident timeline, 90 day uptime

Files: demo.tsx, uptime-status.module.css, uptime-status.tsx

## `usage-forecast` · Usage forecast (Pro, block)

A billing period usage chart with a forecast cone and a draggable budget that dates the crossing.

When to use:
- Billing or usage pages that warn customers before they hit a budget.
- Metered products that show month to date usage with a forecast range.

When not to use:
- Use usage-meter for a simple progress bar against a limit.
- Use usage-pricing to estimate price from usage before buying.

Keywords: react usage chart, usage forecast, budget alert chart, billing usage graph, metered billing dashboard, spend forecast

Files: demo.tsx, usage-forecast.module.css, usage-forecast.tsx
