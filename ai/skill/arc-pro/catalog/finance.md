# Finance

## `budget-variance` · Budget variance (Pro, block)

Budget against actual operating spend by department as aligned bullet charts, with favorable and unfavorable variance, a month, quarter and year to date switch that springs every bar, in-place drill-down into budget lines, and a total row.

When to use:
- Monthly close and budget review screens that compare planned and actual operating spend by department or cost center.
- Finance dashboards where a controller needs to see at a glance which teams are over, which are under, and by how much.

When not to use:
- Use mrr-waterfall to explain how a single total moved from one value to another.
- Use usage-forecast to project spend against a cap over time.

Keywords: budget, budget vs actual, variance, bullet chart, finance, fp&a, operating expenses, opex, cost center, department spend, favorable, unfavorable, plan vs actual, month close

Files: budget-variance.module.css, budget-variance.tsx, demo.tsx

## `market-terminal` · Market terminal (Pro, block)

A trading terminal with a canvas candlestick chart, volume, moving averages, crosshair OHLC readout, wheel, drag and pinch zoom, a live watchlist with sparklines and flashing prices, and a market and limit order ticket.

When to use:
- A trading or investing product that needs a full chart, a watchlist and an order ticket on one screen.
- A paper trading or education app where people practice placing market and limit orders against moving prices.

When not to use:
- Use order-book-depth to show bids and asks at each price level.
- Use metric-explorer or a line chart for product or business metrics without open, high, low and close.

Keywords: trading, stocks, market, candlestick, ohlc, volume, moving average, watchlist, order ticket, brokerage, paper trading, limit order, crosshair, zoom, pan, live prices, finance, terminal

Files: demo.tsx, market-terminal.module.css, market-terminal.tsx
