# Glass card

> A glass info panel over a photo whose rim catches a pointer-following highlight while the card tilts; tap to morph it into a detail sheet.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/glass-card
- Markdown: https://uiarc.dev/components/glass-card/markdown
- Source file: `registry/components/glass-card/glass-card.tsx`
- Dependencies: motion
- Keywords: special, glass, card, new, glass card, glassmorphism card, profile card, tilt card, specular highlight, frosted glass, expandable card, shared layout

## When to use

- Profile, host, or creator cards on a landing page or in a discovery grid.
- A featured product or stay where the photo sells and the details can wait for a tap.

## When not to use

- Dense grids of many cards; tilt and glass on every tile gets busy. Use card.
- Cards that should open a full page; use card-to-article.

## Installation

Glass card is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/glass-card
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { GlassCard } from "@/components/arc/glass-card/glass-card";

export function Host() {
  return (
    <GlassCard image="/people/jasmine.jpg" imageAlt="Portrait of Jasmine Brooks" title="Jasmine Brooks" subtitle="Design lead, Lisbon" aside="4.9">
      <p>Leads design systems at Meridian.</p>
      <button type="button">Follow</button>
    </GlassCard>
  );
}
```

## API reference

### GlassCard

A photo card with a glass info panel. The panel's rim catches a specular highlight under the pointer, the card tilts a few degrees toward it, and a tap morphs the panel up into a detail sheet.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `image` (required) | `string` | – | Photo behind the glass. |
| `imageAlt` (required) | `string` | – | Alt text for the photo. Pass an empty string when it is decorative. |
| `title` (required) | `string` | – | Main line in the glass panel, such as a name or a product. |
| `subtitle` | `ReactNode` | – | Second line under the title. |
| `aside` | `ReactNode` | – | Small element at the end of the header, such as a price, a rating, or a status. |
| `children` | `ReactNode` | – | Detail content revealed when the card expands. Buttons inside stay interactive and do not toggle the card. |
| `open` | `boolean` | – | Controlled expanded state. |
| `defaultOpen` | `boolean` | `false` | Initial expanded state when uncontrolled. |
| `onOpenChange` | `(open: boolean) => void` | – | Called when the card expands or collapses. |
| `tilt` | `number` | `6` | Maximum tilt in degrees. 0 turns tilt off. |
| `className` | `string` | – | Extra class on the card. Set its width here; the card keeps a 4 by 5 ratio. |
| `style` | `CSSProperties` | – | Inline style on the card. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves to the header button, then into the detail content when open. |
| Enter / Space | On the header, expands or collapses the card. |
| Escape | Collapses the card and returns focus to the header. |

## Accessibility

- The glass header is a real button with aria-expanded and aria-controls pointing at the detail region.
- Clicking anywhere on the photo is a pointer shortcut for the same toggle; keyboard users use the header.
- Detail content is removed from the DOM when collapsed, so hidden buttons are never focusable.
- Under prefers-reduced-transparency the glass turns solid.

## Motion

- Tilt and highlight follow the pointer through springs, so the card eases into position and settles back when the pointer leaves. Touch input skips the tilt.
- Expanding is one shared-layout spring on the panel; the header keeps its position and the details fade up with a short blur.
- The photo scales up slightly and the floor shade deepens while open.
- Reduced motion removes tilt and the morph; the panel switches size and the details fade.

## Responsive behavior

- Fills its container width and keeps a 4 by 5 ratio, so it works from 280px up.
- Touch devices get the tap to expand and skip the pointer tilt.

## Performance

- Pointer tracking writes springs and CSS variables only, with no React renders per frame.
- One backdrop filter on the panel. The highlight is a masked gradient, not a filter.

## Notes for AI

- Use it for one featured entity over a strong photo: a person, a stay, a product. Put the essentials in title, subtitle, and aside, and the rest in children.
- Keep detail content short: a line of text, three stats, and one or two actions. Longer content belongs on a page.
- Give the card a width through className; it sets its own height from the 4 by 5 ratio.
- The accent belongs in the detail actions or a rating icon, not on the glass itself.

## Related

- [Holo card](https://uiarc.dev/components/holo-card/markdown): A member card that tilts toward you with a holographic foil and flips to its back.
- [Expandable card](https://uiarc.dev/components/expandable-card/markdown): Give a dense card more room when requested.
- [Card to article](https://uiarc.dev/components/card-to-article/markdown): Story cards that open into full articles with one seamless morph and shrink back into their exact slot when dragged down.

## Also in glass

- [Glass menu](https://uiarc.dev/components/glass-menu/markdown): A glass action menu whose trigger morphs into the panel, with a highlight pill that glides between rows, one in-place submenu, and full keyboard support.
- [Glass segmented](https://uiarc.dev/components/glass-segmented/markdown): A glass segmented control whose liquid indicator stretches between segments and can be dragged and flung.
- [Glass tab bar](https://uiarc.dev/components/glass-tabbar/markdown): A floating Liquid Glass tab bar that refracts what scrolls beneath it, with a glass lens that glides, magnifies and can be dragged between tabs, and an optional search bubble; it compacts on scroll down.

## Guidance for AI tools

Glass card: A glass info panel over a photo whose rim catches a pointer-following highlight while the card tilts; tap to morph it into a detail sheet. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
