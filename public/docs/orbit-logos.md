# Orbit logos

> An integrations showcase with brand logos orbiting your product mark on tilted rings. Hover or focus one to rest the orbit, draw a connection, and see what it does.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/orbit-logos
- Markdown: https://uiarc.dev/components/orbit-logos/markdown
- Source file: `registry/components/orbit-logos/orbit-logos.tsx`
- Keywords: special, motion, integrations, logos, new, orbit logos, integration hero, logo orbit, orbiting logos, integrations page, connect apps, ecosystem, partners, tech stack

## When to use

- An integrations or ecosystem hero on a marketing site.
- An integrations settings screen where people browse, read about, and connect tools.
- A launch page showing everything a product plugs into.

## When not to use

- Use a logo marquee for a long list of customer logos.
- Use a searchable grid or table for catalogs larger than about twenty integrations.

## Installation

Orbit logos is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/orbit-logos
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { OrbitLogos } from "@/components/arc/orbit-logos/orbit-logos";

// Path data from Simple Icons (CC0) follows the text color; image URLs keep full brand color.
const integrations = [
  { name: "Stripe", icon: "/logos/stripe-color.svg", category: "Payments", description: "Starts trials and bills usage", href: "https://docs.stripe.com" },
  { name: "Vercel", icon: "m12 1.608 12 20.784H0Z", category: "Dev", description: "Comments preview links on builds", connected: true },
  { name: "Slack", icon: "/logos/slack-color.svg", category: "Comms", description: "Posts deploy alerts to your channels" },
];

export function Integrations() {
  return <OrbitLogos
    logos={integrations}
    center={<ProductMark />}
    onConnect={logo => api.connect(logo.id ?? logo.name)}
  />;
}
```

## API reference

### OrbitLogos

An integrations orbit: your product mark at the center with brand logos on two flat rings that turn slowly and hold still whenever the pointer or keyboard focus is inside. Category chips turn the matching logos toward the detail side and dim the rest. Choosing a logo springs its ring so the logo glides to a fixed focus spot, draws an accent connector from the center, and morphs a detail card out of the chip with a description, status, a Connect action, Docs, and previous and next.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `logos` (required) | `{ id?: string; name: string; icon: string \| ReactNode; color?: string; category?: string; description?: string; connected?: boolean; href?: string }[]` | – | Logos to show. icon is SVG path data on a 24 by 24 viewBox (the Simple Icons format) painted in color, an image URL for a full color mark, or any ReactNode. Leave color out for black and white brands so the mark follows the text color. category builds the filter chips, description is the line in the card, connected sets the starting status, and href adds a Docs link. |
| `center` | `ReactNode` | – | Content of the center disc, such as your product mark. Defaults to a simple mark in the accent color. |
| `onSelect` | `(logo: OrbitLogo \| null, index: number) => void` | – | Called when a logo opens, when previous or next steps to another, and with null and -1 when the card closes. |
| `onConnect` | `(logo, index) => void \| Promise<unknown>` | – | Called by the Connect button. Return a promise to hold the connecting state until it settles; a rejection shows Try again. Without a promise the card simulates a short connection. |
| `defaultSelected` | `string \| null` | `null` | Id (or name) of the logo open on first render. |
| `selected` | `string \| null` | – | Controlled id (or name) of the open logo; null closes the card. Pair it with onSelect. |
| `speed` | `number` | `1` | Multiplies the rotation speed. At 1 the inner ring turns once every 64s and the outer ring every 88s. 0 holds the orbit still. |
| `paused` | `boolean` | `false` | Holds the orbit still, for a page level motion control. |
| `allLabel` | `string` | `"All"` | Label of the first category chip. |
| `label` | `string` | `"Integrations"` | Accessible name of the logo list and the idle panel title. |
| `className` | `string` | – | Extra class on the root. |
| `style` | `CSSProperties` | – | Inline styles on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves into the category chips, then to one logo in the orbit, then into the card. The orbit holds still while focus is inside. |
| Arrow keys | Step to the previous or next logo in the current category. With a card open, the card and the ring follow. |
| Home / End | Jump to the first or last logo in the current category. |
| Enter / Space | Opens the focused logo, or closes it if it is already open. |
| Escape | Closes the card and returns focus to its logo. |

## Accessibility

- Logos are a labelled list of toggle buttons with aria-pressed; each name includes the category and whether it is connected.
- Only one logo is in the tab order (roving tabindex), so the orbit is a single stop between the chips and the card.
- The card is a labelled region with real buttons and a Docs link; opening, stepping, and filtering are announced in a polite live region.
- Connected status is shown as text and an icon in the card, not by the green dot alone.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring. Focus shows as the lifted chip and its name tag.

## Motion

- One rAF loop writes chip translations and the connector; React does not render per frame, and the loop stops when everything is at rest, off screen, or the tab is hidden.
- The turn eases to rest on a critically damped spring whenever the pointer or focus enters, a category is picked, or a card is open, so nothing moves while you aim.
- Opening a logo springs its ring the short way to the focus spot, with a touch of overshoot. When an outer logo parks, the inner ring steps aside so the connector stays clear.
- The card morphs out of the chip: it starts at the chip's box as a circle and springs to its own box, then its content fades in. Previous and next slide the content in the direction of travel.
- The category highlight is a shared layout pill on the morph spring; chips scale and dim on CSS springs.
- Reduced motion stops the rotation, places rings and the connector at once, and skips the morph and slides.

## Responsive behavior

- From 760px wide the orbit sits beside the detail panel and the chosen logo parks on the right; below that the card sits under the orbit and the logo parks at the bottom.
- Chips are 48 to 56px on desktop and 44px on phones, and the orbit fills the width up to 460px.
- Category chips scroll sideways in one row on narrow screens.
- Name tags only appear on hover or keyboard focus, never on touch.

## Performance

- Positions are transform only writes from a single rAF loop that sleeps when nothing moves.
- Visual states (hover, dim, selected) are CSS transitions on each chip's face, not per frame work.
- Image marks are plain img elements, so each SVG file is fetched once and cached.

## Notes for AI

- Use it as the hero of an integrations page or an in-app integrations screen, with your product mark in the center.
- Ten to sixteen logos read best across two rings. Give every logo a category so the filter chips appear, and a one line description.
- Wire onConnect to your real flow and return its promise; the card shows Connecting until it settles and Try again if it rejects.
- Brand marks are sample content. Show only integrations that exist and follow each brand's trademark rules.

## Related

- [Logo marquee](https://uiarc.dev/components/blocks/logo-marquee/markdown): A quiet, continuously moving row of brand marks with a pause control.
- [Hover card](https://uiarc.dev/components/hover-card/markdown): Preview a person or link on hover or focus without leaving the page.
- [Orbit menu](https://uiarc.dev/components/orbit-menu/markdown): Hold a button and its actions orbit out, ready to pick with a drag.
- [Chip group](https://uiarc.dev/components/chip-group/markdown): Filter by a few facets with chips that morph as you pick them.

## Also in playful

- [Sticker peel](https://uiarc.dev/components/sticker-peel/markdown): Peel stickers off a surface with a real curl, move them around, and stick them back down.
- [Page curl](https://uiarc.dev/components/page-curl/markdown): A small magazine you read by dragging page corners, with a real fold, lit curl, and flick to turn.
- [Prize wheel](https://uiarc.dev/components/prize-wheel/markdown): A referral or promo prize wheel you flick to spin, with real angular momentum, a flexible pointer that ticks against each peg, weighted segments set by the host, a slow suspenseful settle, and the won segment lifting into a reward card with a copyable code.

## Guidance for AI tools

Orbit logos: An integrations showcase with brand logos orbiting your product mark on tilted rings. Hover or focus one to rest the orbit, draw a connection, and see what it does. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
