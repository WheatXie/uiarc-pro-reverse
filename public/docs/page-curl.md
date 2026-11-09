# Page curl

> A small magazine you read by dragging page corners, with a real fold, lit curl, and flick to turn.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/page-curl
- Markdown: https://uiarc.dev/components/page-curl/markdown
- Source file: `registry/components/page-curl/page-curl.tsx`
- Dependencies: motion
- Keywords: special, gesture, book, new, page curl, page flip, flipbook, turn page animation, book component, magazine viewer, react page flip, page turn

## When to use

- Editorial and brand showcases where paper is part of the story.
- Menus, catalogs, and yearbooks with a handful of spreads.

## When not to use

- Use carousel or a scrolling page for long content or content people search.
- Use a document viewer for dense text that needs zoom and selection.

## Installation

Page curl is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/page-curl
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { PageCurl } from "@/components/arc/page-curl/page-curl";

export function Lookbook() {
  return (
    <PageCurl
      label="Autumn lookbook"
      style={{ width: 540 }}
      pages={[<Cover key="cover" />, <Intro key="intro" />, <Plate key="plate" />]}
    />
  );
}
```

## API reference

### PageCurl

A small book or magazine that opens on its cover. On first view the cover corner curls up and settles next to a "Drag the corner" hint. Tap the right page to go forward and the left page to go back, or drag a page: it folds along a line that follows the pointer, showing its back, a lit curl, and a shadow on the page below. A page count with previous and next controls sits underneath.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `pages` (required) | `ReactNode[]` | – | Page contents in reading order. Page one is the cover and sits alone on the right. |
| `spread` | `number` | – | Controlled spread. 0 shows the cover; spread n shows pages 2n and 2n + 1 (one-based). |
| `defaultSpread` | `number` | `0` | Initial spread when uncontrolled. |
| `onSpreadChange` | `(spread: number) => void` | – | Called when a page finishes turning. |
| `pageAspect` | `number` | `0.72` | Page width divided by height. |
| `label` | `string` | `"Book"` | Accessible name of the book. |
| `tease` | `boolean` | `true` | Curls the cover corner once when the book first comes into view, and a little on hover until the first turn. |
| `hint` | `ReactNode \| null` | `"Drag the corner"` | Hint under the lower outer corner, shown until the first interaction. Pass null to hide it. |
| `controls` | `boolean` | `true` | Shows the page count with previous and next buttons under the book. |
| `className` | `string` | – | Extra class on the root. Its width holds two pages side by side. |
| `style` | `CSSProperties` | – | Inline styles on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| ArrowRight / PageDown | Turns to the next spread. |
| ArrowLeft / PageUp | Turns to the previous spread. |
| Tab | Moves from the book to the previous and next page buttons. |

## Accessibility

- The book is a focusable group with aria-roledescription="book" and the label as its name.
- A polite status reads the visible pages, such as "Page 2 and 3 of 8".
- Only the resting pages are in the accessibility tree; the turning copies are aria-hidden.
- Previous and next are real buttons with labels and disable at the covers. The visible count and the hint are decorative duplicates of the status.

## Motion

- The fold line is the perpendicular bisector between the corner and the pointer, so the page follows the finger from where it was grabbed.
- The corner is held within a page width of the spine, like paper bound on one side.
- The flap is a mirror of the sheet across the fold with a lit curl at the crease; the page below gets a soft shadow at the fold.
- Release projects the pointer's momentum: past the middle or a flick turns the page on a spring that keeps the release velocity; otherwise it lays back down.
- The first time the book is mostly in view, the cover corner lifts about a quarter of the page on a soft spring, holds, and lays back down. Until the first turn, entering the book with a mouse repeats it at half the size, at most every 2.5 seconds.
- Hovering a corner lifts it. Hovering a page shows a chevron at its outer edge for the direction a tap turns. Taps, arrow keys, and the buttons turn along a lifted arc.
- The hint fades out for good after the first drag, tap, key, or button press.
- The closed book slides to center on its cover and back cover.
- Reduced motion swaps spreads without the curl and skips the tease.

## Responsive behavior

- Page size derives from the root width, so a 288px wide book still shows two readable pages.
- Each page is one tap and drag target with touch-action pan-y, so vertical swipes still scroll the page on touch.

## Performance

- Fold geometry is computed once per frame from two motion values; clip paths and a matrix update without React renders.
- Up to three copies of a page render while it turns; only the resting spread renders otherwise.

## Notes for AI

- Choose it for short, visual sequences: lookbooks, menus, reports, zines, and portfolios.
- Keep pages simple and fixed in size; each page renders into a slot of the same width and aspect ratio.
- An even number of pages ends on a back cover alone on the left.
- Make page one a real cover with a title, so the closed book reads as something to open.

## Related

- [Cover flow](https://uiarc.dev/components/cover-flow/markdown): A depth rail of images you can throw, with soft grounded shadows and a quiet reflection.
- [Carousel](https://uiarc.dev/components/carousel/markdown): Browse a row of slides by dragging, flicking, or arrowing through them.
- [Lightbox gallery](https://uiarc.dev/components/lightbox-gallery/markdown): A masonry grid where photos zoom from their slot into a viewer you can swipe, pinch, and drag away.

## Also in playful

- [Sticker peel](https://uiarc.dev/components/sticker-peel/markdown): Peel stickers off a surface with a real curl, move them around, and stick them back down.
- [Orbit logos](https://uiarc.dev/components/orbit-logos/markdown): An integrations showcase with brand logos orbiting your product mark on tilted rings. Hover or focus one to rest the orbit, draw a connection, and see what it does.
- [Prize wheel](https://uiarc.dev/components/prize-wheel/markdown): A referral or promo prize wheel you flick to spin, with real angular momentum, a flexible pointer that ticks against each peg, weighted segments set by the host, a slow suspenseful settle, and the won segment lifting into a reward card with a copyable code.

## Guidance for AI tools

Page curl: A small magazine you read by dragging page corners, with a real fold, lit curl, and flick to turn. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
