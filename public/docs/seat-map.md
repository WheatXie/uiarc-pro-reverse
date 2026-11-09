# Seat map

> An event seat picker with a curved concert hall map, price tiers, zoom and pan, sold, held and wheelchair seats, and a live summary with fees and a hold countdown.

- Type: Block
- Page: https://uiarc.dev/components/blocks/seat-map
- Markdown: https://uiarc.dev/components/blocks/seat-map/markdown

- Access: Arc Pro
- Registry id: `seat-map`
- Source file: `registry/blocks/seat-map/seat-map.tsx`
- Built from: Button, Animated counter
- Keywords: seat map, seat picker, seat selection, venue map, event tickets, ticketing, theatre seating, concert tickets, price tiers, zoom and pan, pinch zoom, wheelchair seats, accessible seating, hold timer, checkout

Render <SeatMap /> for the demo, or pass event, venue (seats with x, y, rotate, tier, status), tiers, maxSeats and an onHold promise that reserves the chosen seats. onSelectionChange reports the picked seats in order.

## When to use

- Reserved seating for concerts, theatre, sports and conferences where the buyer picks exact seats.
- Any spatial picker with priced places: tables in a restaurant plan, desks in an office, cabins on a deck.
- Checkout flows that need a live total and a short hold before payment.

## When not to use

- Use a quantity stepper with best available when seats are general admission or assigned by the box office.
- Use availability-picker for choosing times rather than places.
- Use choropleth-explorer to compare values across regions without selecting them.

## Installation

Seat map is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/seat-map
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { SeatMap } from "@/components/arc/blocks/seat-map/seat-map";

export function ChooseSeats({ performance, hall, prices }) {
  return (
    <SeatMap
      event={performance}
      venue={hall}
      tiers={prices}
      maxSeats={8}
      onHold={seats => fetch("/api/holds", { method: "POST", body: JSON.stringify(seats.map(seat => seat.id)) }).then(response => {
        if (!response.ok) throw new Error("Hold failed");
      })}
    />
  );
}
```

## API reference

### SeatMap

An event seat picker. The hall is drawn as curved rows that face the stage, colored by price tier, with sold, held and wheelchair seats marked. Buyers zoom and pan the map, pick up to a set number of seats, and see a running summary with fees and a hold countdown.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `event` | `SeatEvent` | `seatEvent` | The performance: name, venue, a preformatted date string and an optional thumbnail image. |
| `venue` | `SeatVenue` | `seatVenue` | The hall in its own map units: width, height, the stage path and label position, sections with label positions, seats (id, section, row, number, x, y, rotate, tier, status, access, note) and row labels. |
| `tiers` | `SeatTier[]` | `seatTiers` | Price tiers in filter order. Each has an id, name, price and a CSS color; the demo uses --series-1 to --series-4 so tiers follow the accent and theme. |
| `maxSeats` | `number` | `6` | Most seats one buyer can pick. Picking past it shows an inline notice on the map instead of adding the seat. |
| `serviceFee` | `number` | `4.5` | Fee added per ticket, shown as its own line in the summary. |
| `currency` | `string` | `"USD"` | ISO currency code. Prices are formatted with the en-US locale so server and client render the same text. |
| `holdMinutes` | `number` | `10` | Length of the hold that starts after the hold button succeeds. The countdown releases the seats when it reaches zero. |
| `defaultSelected` | `string[]` | `seatDefaultSelection` | Seat ids selected on first render. Ids that are not available, or past maxSeats, are ignored. |
| `title` | `string` | `"Your seats"` | Heading of the summary panel. |
| `onSelectionChange` | `(seats: Seat[]) => void` | – | Called after every change to the selection, with the seats in the order they were picked. |
| `onHold` | `(seats: Seat[]) => void \| Promise<void>` | – | Called by the hold button. Return a promise to show the pending state; a rejection keeps the selection and shows an inline error with a retry. Without it the demo simulates a short request. |
| `className` | `string` | – | Class on the root section. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves into the map on one seat at a time (a roving tab stop), then on to the zoom controls and the summary. |
| Arrow keys | Left and right move along the row and cross the aisle to the next section; up and down move toward or away from the stage. The map pans to keep the seat in view. |
| Home / End | Jumps to the first or last seat in the row. |
| Enter / Space | Chooses or removes the seat. Sold and held seats explain why they cannot be chosen. |
| + / - | Zooms in or out around the middle of the map. |
| 0 | Shows the whole hall again. |

## Accessibility

- Every seat is a checkbox with a full name, such as "Row G, seat 7, Stalls centre. Stalls, $112. Aisle seat", and sold or held seats are marked disabled.
- Seats are grouped by section, and the map carries instructions for its keys through aria-describedby.
- Keyboard position shows as a soft fill behind the seat and a tooltip with the seat details, never a focus ring.
- Selections, removals, the seat limit, holds and expiry are announced in a polite live region.
- Tier, status and access never rely on color alone: sold seats shrink, held seats are outlined with a dot, selected seats carry a check, and wheelchair spaces are square with a glyph. The key under the map names each mark.
- Zoom buttons, the tier filter and each summary row are real buttons with specific names; remove buttons name the seat they remove.

## Motion

- The camera moves on one critically damped spring, so zooming, choosing a tier and following the keyboard glide without overshoot and can be interrupted by a drag at any point.
- Choosing a price tier dims the other tiers and flies the camera to where those seats sit; choosing it again returns to the whole hall.
- A picked seat fills and its check scales in; summary rows open and close their height on the smooth spring, and totals roll to their new values with tabular digits.
- Pan, pinch and ctrl or cmd scroll write straight to motion values and a single transform per frame, with no React state per frame.
- Reduced motion jumps the camera and swaps every transition for an instant change while keeping focus and announcements.

## Responsive behavior

- From 860px the map and the summary sit side by side with a 320px summary; below that the summary stacks under the map.
- Below 560px the map is 340px tall, the price filter scrolls sideways, and section labels hide until there is room for them.
- On touch, a tap on the whole hall zooms to that spot first, so seats are 44px apart before one can be chosen; one finger pans and two fingers pinch once zoomed, while the page still scrolls at the full view.
- Zoom buttons, price chips and remove buttons grow to 44px on coarse pointers.

## Performance

- Seats are plain SVG groups in a memoized component, so a selection repaints the changed seats rather than the hall. The demo draws about 500 seats.
- Camera motion is one transform on a single group, batched to one write per frame with Motion's frame loop.
- Tooltip position is written directly to its style when the camera or seat changes, without re-rendering.
- For halls of many thousands of seats, split sections into separate layers or render seats to canvas and keep the same props.

## Notes for AI

- Generate seat positions from your venue plan in any unit system; the camera fits whatever bounds the seats cover. Rotation turns each seat toward the stage.
- Map your inventory to status: available, held (in another buyer's cart) or sold. Only available seats can be chosen.
- Tier colors are plain CSS values. Keep them to the chart series or other semantic tokens so both themes stay legible.
- Wire onHold to your reservation API and return its promise. The countdown only reflects the local hold length; take the real expiry from your server if it differs.
- The first render uses the venue view box and no camera transform, then measures the viewport after mount, so the markup matches on server and client.

## Related

- [Availability picker](https://uiarc.dev/components/blocks/availability-picker/markdown): Find a meeting time across people and see the choice come together.
- [Choropleth explorer](https://uiarc.dev/components/blocks/choropleth-explorer/markdown): A filled-region map that shades every state or region by revenue, growth or penetration on a stepped scale, with a country switch (United States, Canada, Brazil, United Kingdom, France, Germany, Italy, Australia), a hoverable legend, a synced ranked list and a camera zoom into local detail.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
