# Market terminal

> A trading terminal with a canvas candlestick chart, volume, moving averages, crosshair OHLC readout, wheel, drag and pinch zoom, a live watchlist with sparklines and flashing prices, and a market and limit order ticket.

- Type: Block
- Page: https://uiarc.dev/components/blocks/market-terminal
- Markdown: https://uiarc.dev/components/blocks/market-terminal/markdown

- Access: Arc Pro
- Registry id: `market-terminal`
- Source file: `registry/blocks/market-terminal/market-terminal.tsx`
- Built from: Animated counter, Button, Number field, Segmented control
- Keywords: trading, stocks, market, candlestick, ohlc, volume, moving average, watchlist, order ticket, brokerage, paper trading, limit order, crosshair, zoom, pan, live prices, finance, terminal

Render <MarketTerminal /> for the demo, or pass symbols, holdings, buyingPower, orders, defaultTicker and defaultRange with your own data. Pass onPlaceOrder and onCancelOrder (they can return promises) to connect it to a real order API.

## When to use

- A trading or investing product that needs a full chart, a watchlist and an order ticket on one screen.
- A paper trading or education app where people practice placing market and limit orders against moving prices.
- A markets dashboard where candles, volume and moving averages must be inspected bar by bar.

## When not to use

- Use order-book-depth to show bids and asks at each price level.
- Use metric-explorer or a line chart for product or business metrics without open, high, low and close.
- Use options-payoff to model an options position's profit at expiry.
- Use wallet-card for a simple balance and recent transactions without a chart.

## Installation

Market terminal is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/market-terminal
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { MarketTerminal } from "@/components/arc/blocks/market-terminal/market-terminal";

export function Trade() {
  return (
    <MarketTerminal
      defaultTicker="AAPL"
      defaultRange="1D"
      onPlaceOrder={order => api.orders.create(order)}
      onCancelOrder={order => api.orders.cancel(order.id)}
    />
  );
}
```

## API reference

### MarketTerminal

A trading terminal screen. A candlestick chart with volume, two moving averages, a crosshair with an OHLC readout, and wheel, drag and pinch zoom sits beside a watchlist with intraday sparklines and flashing live prices, and an order ticket for market and limit orders with an order list.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `symbols` | `MarketSymbol[]` | `SYMBOLS` | Watchlist symbols in order: ticker, name, exchange, price, previous close, daily volatility (a fraction such as .02) and average daily volume. Candles are generated from these, deterministically per ticker and range. |
| `holdings` | `Holding[]` | `HOLDINGS` | Shares held per ticker. The ticket shows the position and blocks selling more than is held. |
| `buyingPower` | `number` | `24860.35` | Cash available for buys. The ticket blocks a buy that costs more, and fills update it. |
| `orders` | `OrderRecord[]` | `ORDERS` | Orders in the ticket's list, newest first: side, type, ticker, shares, price, status (filled, working or canceled) and time. |
| `defaultTicker` | `string` | – | Ticker charted on first render. Defaults to the first symbol. |
| `defaultRange` | `"1D" \| "5D" \| "1M" \| "6M" \| "1Y"` | `"6M"` | Time range on first render. 1D and 5D use 5 and 30 minute candles; the rest are daily. |
| `defaultAverages` | `AverageId[]` | `["ma20", "ma50"]` | Moving averages drawn on first render. Viewers toggle them in the toolbar. |
| `live` | `boolean` | `true` | Streams simulated ticks. Viewers can still pause and resume them with the Live button. |
| `tickInterval` | `number` | `1200` | Milliseconds between simulated ticks. |
| `onPlaceOrder` | `(order: OrderRequest) => void \| Promise<void>` | – | Called when an order is submitted with its side, type, ticker, shares and price. Return a promise to keep the button pending; a rejection leaves the order unplaced and says so under the button. |
| `onCancelOrder` | `(order: OrderRecord) => void \| Promise<void>` | – | Called when a working order is canceled from the list. |
| `className` | `string` | – | Class on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the Live button, the range control, the average toggles, the zoom buttons, the chart, the watchlist rows and the order ticket. |
| Arrow left / Arrow right | On the chart, moves the crosshair one candle and reads it out. The view follows the crosshair past either edge. |
| Shift + Arrow left / right | On the chart, moves the crosshair ten candles. |
| Home / End | On the chart, jumps to the first or the live candle. |
| + / - | On the chart, zooms in or out around the crosshair. |
| 0 | On the chart, resets the view to the range's default window. |
| Escape | On the chart, clears the crosshair. |
| Arrow up / Arrow down, Home / End | In the watchlist, moves between symbols. Enter or Space charts the focused symbol. |

## Accessibility

- The chart is a focusable image with a role description, a label naming the symbol, range and candle interval, and a description of its keys.
- Moving the crosshair with the keyboard announces the candle's time, open, high, low, close, change and volume through a polite live region.
- Watchlist rows are buttons with a full label (ticker, name, price and change today); the charted symbol carries aria-current.
- Direction is never color alone: changes carry a sign and an arrow, and order status is written as text.
- Order problems (too few shares, not enough buying power, not enough shares to sell) and failures are written in a status line under the button.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring. Keyboard position shows as a fill on rows, toggles and icon buttons, and as the crosshair on the chart.

## Motion

- The chart is one canvas drawn in a requestAnimationFrame loop that runs only while something moves; React never re-renders per frame.
- Zoom, pan and range changes ease the view and the price scale with an exponential approach timed from the smooth spring, so nothing overshoots and every gesture can be reversed mid-way.
- A drag flick carries momentum that decays like a thrown card. Pinch zooms around the midpoint of two fingers.
- Live ticks glide the last candle, its price tag, the price line and the moving averages to the new price; the header price rolls with the animated counter.
- Each watchlist price flashes a green or red tint in the direction it moved, as a single opacity fade. The selected row's fill glides between rows.
- The limit field opens with height and opacity together; new orders grow into the list. The live dot's pulse is the only loop, because it reports live status.
- Reduced motion makes the view, prices and panels change at once, drops momentum and the pulse, and holds the flash as a brief static tint.

## Responsive behavior

- From 1080px the watchlist and ticket stack in a 340px column beside the chart; from 720px they sit side by side under it; below that everything stacks.
- On narrow charts the OHLC readout moves above the canvas, the chart shortens to 340px, and the default window thins so candles stay at least five pixels apart.
- Below 640px the stats row spans four equal columns, the range control takes its own row, and every button in the toolbar grows to 44px.
- Touch drags pan the chart horizontally while vertical swipes still scroll the page; a tap pins the crosshair and a second tap clears it.

## Performance

- Candles, volume, averages and the crosshair draw on one canvas at up to 2x device pixel ratio, only for the visible candles.
- The readout, axis tags and crosshair labels are written straight into their text nodes by the engine, and only when their text changes.
- Series are generated once per symbol and range and then updated in place by ticks; moving averages are one running sum.
- Ticks pause while the tab is hidden, and theme or accent changes recolor the canvas without rebuilding it.

## Notes for AI

- Choose it for the main screen of a brokerage, a paper trading app or an internal markets dashboard where one symbol is charted and traded at a time.
- Everything is simulated: candles are generated from each symbol's price, previous close and volatility, ticks are a random walk, and orders fill against the live price locally. Pass the callbacks and your own data for real use.
- Today's session is identical on every range: coarser candles are folded from the five minute bars, and ticks update the live candle of every range together.
- Working limit orders fill on their own when the live price crosses them, and a marketable limit fills at the better of the limit and the market.
- Keep sample prices believable: the header, watchlist and ticket all read the same live price, so a mismatch shows immediately.

## Related

- [Metric explorer](https://uiarc.dev/components/blocks/metric-explorer/markdown): KPI cards that open into a scrubbable chart and morph between metrics and ranges.
- [Wallet card](https://uiarc.dev/components/blocks/wallet-card/markdown): A compact account view with balance, recent activity, and focused money actions.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
