# Card to article

> Story cards that open into full articles with one seamless morph and shrink back into their exact slot when dragged down.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/card-to-article
- Markdown: https://uiarc.dev/components/card-to-article/markdown
- Source file: `registry/components/card-to-article/card-to-article.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, layout, gesture, new, app store card, card expand, shared element transition, card to detail, magic motion, expanding card, blog grid, article modal

## When to use

- Blogs, journals, and changelogs where each entry has a strong image.
- Case study and portfolio grids.
- Editorial landing sections that preview stories without leaving the page.

## When not to use

- Use a normal link to a page when articles are long or need their own URL and SEO.
- Use expandable-card for small inline details.
- Text only lists with no imagery.

## Installation

Card to article is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/card-to-article
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { CardToArticle } from "@/components/arc/card-to-article/card-to-article";

const posts = [
  {
    id: "glass-house",
    tag: "Case study",
    title: "A glass house that stays cool in August",
    meta: "5 min read",
    image: "/media/photos/pool-house.jpg",
    imageAlt: "A modern glass house beside a long pool",
    body: <p>The brief was simple and a little unreasonable...</p>,
  },
];

export function Journal() {
  return <CardToArticle items={posts} />;
}
```

## API reference

### CardToArticle

A grid of story cards; a card opens into a full scrolling article with a shared element morph and closes back into its slot.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` (required) | `ArticleItem[]` | – | Each item has id, title, image, imageAlt, body, and optional tag and meta. |
| `value` | `string \| null` | – | Id of the open article. Leave it out for uncontrolled use. |
| `defaultValue` | `string \| null` | `null` | Initially open article when uncontrolled. |
| `onValueChange` | `(id: string \| null) => void` | – | Called when an article opens or closes. |
| `aspectRatio` | `number` | `4 / 3` | Ratio of the card and the article hero. They match, so the morph is a pure scale with no distortion. |
| `closeLabel` | `string` | `"Close article"` | Accessible name of the close button. |
| `className` | `string` | – | Extra class on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter / Space | Opens the focused card. |
| Escape | Closes the article and returns focus to its card. |
| Tab | Stays inside the open article. |

## Accessibility

- Cards are buttons with aria-haspopup="dialog" and aria-expanded.
- The open article is a modal dialog labelled by its title, with focus moved to the close button and trapped inside.
- Closing returns focus to the card it came from.
- Page scroll is locked while the article is open, keeping the scrollbar's space so nothing shifts.

## Motion

- The card itself becomes the article: its box and corners spring to the sheet while the hero scales as one piece, so image and title never distort.
- The body rises in after the morph; the close button pops in last.
- Drag down on touch, drag the hero with a mouse, or pull past the top with a trackpad: the sheet shrinks and drops with the gesture and closes past a threshold or on a flick.
- Closing re-measures the card's slot and lands flush in it, no bounce. A reading progress bar tracks the scroll.
- Reduced motion opens and closes without travel.

## Responsive behavior

- Two columns, then one below 520px of container width.
- The article fills the screen with a 12px margin on phones and caps at 680px wide on desktop.
- Title and tag sizes follow the hero's own width through container units.

## Performance

- The morph is one layout animation plus a scale corrected hero; nothing else re-lays out.
- The pull gesture is transform only and runs from motion values.

## Notes for AI

- Keep every image the same ratio as aspectRatio so the hero scales cleanly.
- Titles are drawn on the photo in white over a legibility scrim; pick photos with calm lower areas.
- Use onValueChange to sync the open article with the URL for deep links.

## Related

- [Expandable card](https://uiarc.dev/components/expandable-card/markdown): Give a dense card more room when requested.
- [Lightbox gallery](https://uiarc.dev/components/lightbox-gallery/markdown): A masonry grid where photos zoom from their slot into a viewer you can swipe, pinch, and drag away.
- [Photo grid](https://uiarc.dev/components/photo-grid/markdown): Pinch through zoom levels and open any photo straight from its cell.
- [Dialog](https://uiarc.dev/components/dialog/markdown): A focused surface for decisions that need attention.

## Also in surfaces

- [Sheet stack](https://uiarc.dev/components/sheet-stack/markdown): Nested sheets that stack with depth, drag to dismiss, and become stacked dialogs on wide screens.
- [Wallet stack](https://uiarc.dev/components/wallet-stack/markdown): Fan a stack of cards and lift one out to see its activity.
- [Control center](https://uiarc.dev/components/control-center/markdown): Workspace quick settings: tiles that morph into detail, a duration dial, and rubber-banded meters.
- [Holo card](https://uiarc.dev/components/holo-card/markdown): A member card that tilts toward you with a holographic foil and flips to its back.
- [Link unfurl](https://uiarc.dev/components/link-unfurl/markdown): A composer where pasting a URL shows a loading shimmer on the link, then unfurls it into a rich preview card with title, image and favicon in one morph, which can be collapsed back to the inline link or removed.

## Guidance for AI tools

Card to article: Story cards that open into full articles with one seamless morph and shrink back into their exact slot when dragged down. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
