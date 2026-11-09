# Holo card

> A member card that tilts toward you with a holographic foil and flips to its back.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/holo-card
- Markdown: https://uiarc.dev/components/holo-card/markdown
- Source file: `registry/components/holo-card/holo-card.tsx`
- Dependencies: motion
- Keywords: special, motion, new, holographic card, holo card, foil card, pokemon card effect, tilt card, 3d card flip, membership card, gyroscope tilt, shiny card

## When to use

- A membership or subscription card on an account or welcome page.
- A shareable profile, badge, or achievement that people will screenshot.
- A collectible or reward reveal.

## When not to use

- Use card for ordinary content; the effect is too loud for lists.
- Use depth-cards when several items need a subtle parallax.
- Avoid it for text people need to read carefully; the sheen moves over the content.

## Installation

Holo card is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/holo-card
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { HoloCard } from "@/components/arc/holo-card/holo-card";

export function MemberCard() {
  return (
    <HoloCard
      label="Jasmine Brooks, member card"
      front={<div className="front">...</div>}
      back={<div className="back">...</div>}
    />
  );
}
```

## API reference

### HoloCard

A collectible style card that leans toward the pointer with a holographic foil, a glitter layer, and a glare that follow the angle. Click or press Enter to spin it to its back; on phones it can follow device tilt.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `front` (required) | `ReactNode` | – | The face. Fill the whole card; it is clipped to the rounded shape. |
| `back` | `ReactNode` | – | The back. Leave it out for a tilt only card that is not a button. |
| `flipped` | `boolean` | – | Controlled flipped state. |
| `defaultFlipped` | `boolean` | `false` | Initial flipped state when uncontrolled. |
| `onFlippedChange` | `(flipped: boolean) => void` | – | Called when the card is flipped. |
| `maxTilt` | `number` | `14` | Largest lean in degrees. |
| `intensity` | `number` | `1` | Strength of foil, glitter, and glare from 0 to 1. |
| `gyroscope` | `boolean` | `true` | Follows device tilt on touch screens. On iOS permission is asked on the first tap. |
| `label` | `string` | – | Accessible name. Defaults to the text on the card. |
| `className` | `string` | – | Class on the root. Set width here; the card keeps a 5:7 ratio. |
| `style` | `CSSProperties` | – | Inline style on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Focuses the card when it has a back. |
| Enter / Space | Flips the card. |

## Accessibility

- With a back, the card is role="button" with aria-roledescription="flip card" and aria-pressed for the flipped state.
- The hidden face is aria-hidden, so assistive tech reads only the side that is showing.
- Foil, glitter, and glare layers are decorative and aria-hidden.
- prefers-reduced-transparency removes the foil and glitter.

## Motion

- Tilt follows the pointer on a lightly underdamped spring, and the light position trails on a softer one, so the sheen lags the lean just enough to feel physical.
- The foil slides and shifts hue with the angle; glitter drifts against the tilt and only sparkles near the glare.
- Each flip adds half a turn toward the side that was pressed on a spring with a little bounce, and the foil sweeps across the card mid spin.
- A floating shadow moves opposite the lean.
- Reduced motion removes tilt, spin, and glitter; the faces cross fade.

## Responsive behavior

- The root is width limited to 300px by default and keeps a 5:7 ratio, so it fits a 320px screen.
- On touch screens tilt comes from the device when available; otherwise dragging a finger over the card tilts it.
- Hover lift and tilt only react to real pointer movement; taps flip.

## Performance

- All tilt and light values are motion values written to transform and CSS variables, with no React render per frame.
- Foil, glitter, and glare are three blended layers per face; keep one or two cards on screen, not a grid.
- Glitter is a small tiled SVG data URI.

## Notes for AI

- Choose it for one hero object: a membership card, a conference badge, an achievement, or a gift card reveal.
- Design the front edge to edge; the card clips it to its radius and adds the foil on top.
- Dark or saturated card stock shows the foil best; on very light stock lower intensity.
- Leave out back for a tilt only card, for example inside a link.
- Gyroscope needs HTTPS and, on iOS, a tap to grant permission; the first tap that flips also asks.

## Related

- [Sticker peel](https://uiarc.dev/components/sticker-peel/markdown): Peel stickers off a surface with a real curl, move them around, and stick them back down.
- [Wallet stack](https://uiarc.dev/components/wallet-stack/markdown): Fan a stack of cards and lift one out to see its activity.
- [Cover flow](https://uiarc.dev/components/cover-flow/markdown): A depth rail of images you can throw, with soft grounded shadows and a quiet reflection.

## Also in surfaces

- [Sheet stack](https://uiarc.dev/components/sheet-stack/markdown): Nested sheets that stack with depth, drag to dismiss, and become stacked dialogs on wide screens.
- [Control center](https://uiarc.dev/components/control-center/markdown): Workspace quick settings: tiles that morph into detail, a duration dial, and rubber-banded meters.
- [Card to article](https://uiarc.dev/components/card-to-article/markdown): Story cards that open into full articles with one seamless morph and shrink back into their exact slot when dragged down.
- [Link unfurl](https://uiarc.dev/components/link-unfurl/markdown): A composer where pasting a URL shows a loading shimmer on the link, then unfurls it into a rich preview card with title, image and favicon in one morph, which can be collapsed back to the inline link or removed.

## Guidance for AI tools

Holo card: A member card that tilts toward you with a holographic foil and flips to its back. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
