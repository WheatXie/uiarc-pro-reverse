# Prize wheel

> A referral or promo prize wheel you flick to spin, with real angular momentum, a flexible pointer that ticks against each peg, weighted segments set by the host, a slow suspenseful settle, and the won segment lifting into a reward card with a copyable code.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/prize-wheel
- Markdown: https://uiarc.dev/components/prize-wheel/markdown
- Source file: `registry/components/prize-wheel/prize-wheel.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, gesture, physics, new, prize wheel, spin the wheel, wheel of fortune, referral, promo code, coupon, reward, giveaway, gamification, spinner, momentum

## When to use

- A referral or launch page that rewards a signup with a discount code.
- An in-product moment that grants one of several perks, such as a milestone reward.

## When not to use

- Use a plain coupon card or copy button when everyone gets the same reward.
- Avoid it in serious flows such as billing or checkout, where chance feels out of place.

## Installation

Prize wheel is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/prize-wheel
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { PrizeWheel } from "@/components/arc/prize-wheel/prize-wheel";

export function ReferralReward({ drawnIndex }: { drawnIndex: number }) {
  return <PrizeWheel
    once
    pickWinner={() => drawnIndex}
    segments={[
      { label: "10% off", detail: "Off your first year", code: "REF-10OFF", weight: 40 },
      { label: "Free month", detail: "One month on us", code: "REF-MONTH", weight: 25 },
      { label: "20% off", detail: "Off your first year", code: "REF-20OFF", weight: 20 },
      { label: "Extra seat", detail: "One more teammate for a year", code: "REF-SEAT", weight: 14 },
      { label: "Lifetime", detail: "Pro for life", code: "REF-LIFE", weight: 1, featured: true },
    ]}
    onResult={segment => console.log("won", segment.label)}
  />;
}
```

## API reference

### PrizeWheel

A promo or referral prize wheel with real momentum. Flick the wheel and it keeps the angular velocity you gave it, or hold the metal Spin hub to wind the wheel back while an accent ring fills, then let go to throw it. A flexible pointer bends against every peg and snaps back with a small wobble, the wheel slows into a long, suspenseful settle, and it lands on a segment drawn by weight. The won segment fills with the accent and lifts into a reward card with a copyable code, while the odds list beside the wheel shows every prize with its chance.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `segments` | `{ id?: string; label: string; detail?: string; code?: string; weight?: number; featured?: boolean }[]` | `Eight launch rewards` | Prizes clockwise from the top, two to twelve. label is drawn on the wheel (keep it to about 14 characters), detail and code appear in the reward card, weight is the relative chance (defaults to 1), and featured marks the rare top prize with the accent. |
| `title` | `string` | `"Spin for a reward"` | Heading beside the wheel before the first spin. |
| `description` | `string` | `"Every spin wins something. Your code works at checkout."` | One line under the heading. |
| `labels` | `{ spin?; again?; done?; copy?; copied?; copyFailed?; odds?; hint?; weak? }` | – | Visible words for localization: the hub label, Spin again, the locked hub label, the copy button states, the odds heading, the gesture hint, and the hint after a flick that was too slow. |
| `pickWinner` | `(segments) => number` | – | Returns the winning index when a spin starts, such as a result your server already drew. Without it the wheel draws by weight in the browser, which suits a demo but not a real prize. |
| `onResult` | `(segment, index) => void` | – | Called once when the wheel comes to rest on a prize. |
| `once` | `boolean` | `false` | Allows a single spin. The wheel locks on the prize, the hub reads Claimed, and Spin again is hidden. |
| `sizing` | `"equal" \| "weight"` | `"equal"` | Equal slices, or slice angles proportional to weight so the wheel itself shows the odds. Slices too thin for a label drop it; the odds list still names them. |
| `showOdds` | `boolean` | `true` | Shows the list of prizes with their chance beside the wheel. |
| `speed` | `number` | `1` | Multiplies the slow idle drift before a spin. 0 holds the wheel still. |
| `paused` | `boolean` | `false` | Holds the idle drift. A spin the visitor starts still runs to the end. |
| `accent` | `string` | – | Color of the pointer, the featured prize, the charge ring, and the won segment. Defaults to the accent token. |
| `label` | `string` | `"Prize wheel"` | Accessible name of the component. The wheel image adds every prize and its chance. |
| `className` | `string` | – | Extra class on the root. |
| `style` | `CSSProperties` | – | Inline styles on the root. |

## Accessibility

- The Spin hub is a real button with a specific name. Enter or Space pressed and held winds the wheel up; releasing spins it. A screen reader activation without a press spins at a medium strength.
- The wheel is one element with role="img" whose label lists every prize with its chance, so the odds are never visual only.
- A polite live region announces Spinning, the prize won with its code spelled out, and copy success or failure.
- While a spin runs the hub is aria-disabled instead of disabled, so focus stays on it. The hidden reward card is inert until a prize lands.
- The winner is never shown by color alone: the card names it, the odds row lights up, and the announcement repeats it.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- One rAF loop writes the wheel rotation, the pointer rotation, and the charge ring straight to the DOM, only when a value changed; React renders only when a spin starts and when it lands.
- The wheel rotates as a composited HTML layer, so the SVG face never repaints per frame. A static metal sheen sits above it so the light stays still while the wheel turns under it.
- A drag follows the pointer angle around the hub; the release velocity from the last 100ms becomes the spin. The winner is drawn by weight, then the travel is chosen as the landing spot nearest the distance that velocity would naturally carry, so the wheel leaves your hand at the speed you threw it.
- The spin follows 1 - (1 - t)^3: velocity decays smoothly with no seam and the last turn crawls past the final pegs.
- The pointer is a stiff, lightly damped spring that collides with the pegs as a tapered capsule: it only moves when a peg actually touches it, bends about 30 degrees until the peg clears its tip, then snaps back with a short wobble. The collision runs in substeps that follow the wheel, so no peg skips through it at full speed; fast spins rattle it and the settle ticks peg by peg.
- A spin thrown from the hub or Spin again builds its speed over a few frames instead of jumping to full speed, and winding up eases in and out. A flick keeps the exact speed of your hand.
- The reward card flies from the segment under the pointer to its place on a spring with a little life, one continuous movement.
- The loop stops when idle, off screen, and in hidden tabs. Reduced motion removes the drift, the pointer wobble, and the flight: a spin lands at once on the prize and the card appears in place.

## Responsive behavior

- The wheel is an SVG viewBox inside a square stage, so the face, pegs, and pointer scale to any width with crisp hairlines.
- Container queries place the reward panel beside the wheel from 736px and below it on narrower layouts, where the odds list folds into two columns.
- The wheel captures touch for dragging while the rest of the component scrolls normally.

## Performance

- About sixty static SVG elements rotate as one composited layer; nothing is measured per frame.
- The pointer spring runs four small substeps per frame and stops as soon as it rests.

## Notes for AI

- Use it for a referral reward, a launch promo, or a signup incentive where the moment itself is the point.
- For real prizes, draw the result on the server and pass pickWinner so the browser cannot choose its own reward. Pair it with once.
- Keep labels short and the segment count between six and ten. Mark only the rarest prize as featured.
- Keep showOdds on for promotions that must disclose chances.

## Related

- [Slot text](https://uiarc.dev/components/slot-text/markdown): Text and numbers that spin into their new value on staggered slot machine reels.
- [Wallet stack](https://uiarc.dev/components/wallet-stack/markdown): Fan a stack of cards and lift one out to see its activity.
- [Copy button](https://uiarc.dev/components/copy-button/markdown): Copy a value with immediate confirmation.

## Also in playful

- [Sticker peel](https://uiarc.dev/components/sticker-peel/markdown): Peel stickers off a surface with a real curl, move them around, and stick them back down.
- [Page curl](https://uiarc.dev/components/page-curl/markdown): A small magazine you read by dragging page corners, with a real fold, lit curl, and flick to turn.
- [Orbit logos](https://uiarc.dev/components/orbit-logos/markdown): An integrations showcase with brand logos orbiting your product mark on tilted rings. Hover or focus one to rest the orbit, draw a connection, and see what it does.

## Guidance for AI tools

Prize wheel: A referral or promo prize wheel you flick to spin, with real angular momentum, a flexible pointer that ticks against each peg, weighted segments set by the host, a slow suspenseful settle, and the won segment lifting into a reward card with a copyable code. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
