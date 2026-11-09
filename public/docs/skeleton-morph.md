# Skeleton morph

> Loading skeletons that grow into the real content, block by block, instead of swapping.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/skeleton-morph
- Markdown: https://uiarc.dev/components/skeleton-morph/markdown
- Source file: `registry/components/skeleton-morph/skeleton-morph.tsx`
- Dependencies: motion
- Keywords: special, loading, motion, new, skeleton loader, loading skeleton, skeleton morph, shared layout loading, content placeholder, shimmer loading, react skeleton animation

## When to use

- Profile cards, feeds, and lists that load in under a few seconds.
- Dashboards where the layout is known before the data arrives.
- Places where a hard swap from gray boxes to content would feel jarring.

## When not to use

- Use skeleton for long lists of hundreds of rows; layout animation there is costly.
- Use a progress indicator when loading takes more than a few seconds.
- Avoid it when the loaded layout is unknown in advance.

## Installation

Skeleton morph is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/skeleton-morph
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { MorphBlock, SkeletonMorph } from "@/components/arc/skeleton-morph/skeleton-morph";

export function ProfileCard({ user }: { user?: User }) {
  return (
    <SkeletonMorph loading={!user} className="card">
      <MorphBlock radius="circle" width={48} height={48}>
        <img src={user?.avatar} alt="" width={48} height={48} />
      </MorphBlock>
      <MorphBlock width={120} lines={1} lineHeight={20}><p style={{ lineHeight: "20px" }}>{user?.name}</p></MorphBlock>
      <MorphBlock lines={3} lineHeight={20}><p style={{ lineHeight: "20px" }}>{user?.bio}</p></MorphBlock>
    </SkeletonMorph>
  );
}
```

## API reference

### SkeletonMorph

A loading region whose skeleton blocks become the real content. It marks itself busy while loading and eases to the new height when blocks change size.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` (required) | `boolean` | – | While true, blocks show their skeletons and the region is aria-busy. |
| `children` (required) | `ReactNode` | – | The loaded layout, with each visible piece wrapped in a MorphBlock. |
| `stagger` | `number` | `0.04` | Seconds between blocks as they resolve in reading order. |
| `loadingLabel` | `string` | `"Loading"` | Status text read by screen readers while loading. |
| `as` | `ElementType` | `"div"` | The root element. Style it as the card so its border follows the eased height. |
| `className` | `string` | – | Extra class on the root. |
| `style` | `CSSProperties` | – | Inline styles on the root. |

### MorphBlock

One piece of the layout. It is a size-matched skeleton while loading; on resolve the placeholder stretches to the content's measured box and fades while the content sharpens in, in place.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | – | The loaded content. It is not rendered while loading. |
| `width` | `number \| string` | `"100%"` | Skeleton width. |
| `height` | `number \| string` | `12px, or the lines height` | Skeleton height. |
| `radius` | `number \| string \| "circle"` | `6` | Skeleton corner radius. circle makes a round avatar placeholder. |
| `lines` | `number` | – | Shows a text skeleton with this many lines, each a bar centred in its line box; the last of several is shorter. Use lines={1} for single line text. |
| `lineHeight` | `number` | `20` | Line height of the text in px, so the skeleton is exactly as tall as the loaded text. |
| `as` | `"div" \| "span" \| "p" \| "li" \| "section" \| "article" \| "header" \| "footer" \| "h2" \| "h3" \| "h4"` | `"div"` | The block element. |
| `className` | `string` | – | Extra class on the block. |
| `style` | `CSSProperties` | – | Inline styles on the block. |

## Accessibility

- The root is aria-busy while loading and carries a visually hidden status with loadingLabel.
- Skeleton shapes are aria-hidden; content is not rendered until it is ready, so nothing half loaded is read.
- Blocks keep reading order, so focus order is the same before and after loading.

## Motion

- Blocks resolve one after another in DOM order, 40ms apart by default.
- Each placeholder stretches from its skeleton box to the content's measured box on a critically damped spring while it fades; the content sharpens out of a 4px blur underneath. Blocks change in place and never travel across the layout.
- The shell eases to its new height and clips while it does, so the card border never jumps.
- A calm opacity pulse runs on the skeletons while loading and stops when they resolve.
- Going back to loading is immediate, so fast reloads never leave a block stuck halfway.
- Reduced motion removes the pulse and the stretch and uses a short crossfade.

## Responsive behavior

- Blocks size to their content once loaded, so layouts reflow naturally at any width.
- Skeleton widths accept percentages for fluid placeholders.

## Performance

- Each block measures itself once when it resolves; there is no shared layout projection, so it stays cheap in long cards.
- The height ease uses one ResizeObserver per region.
- The sweep is a CSS transform animation on a pseudo-element.

## Notes for AI

- Wrap every visible piece of the loaded layout in a MorphBlock; unwrapped elements change without animation.
- Size skeletons to the real content: give text an explicit px line-height and pass the same lineHeight and lines, and set width near the typical text width.
- Put the card styles on SkeletonMorph itself so the border follows the eased height.
- For a simple placeholder without the morph, use skeleton.

## Related

- [Skeleton](https://uiarc.dev/components/skeleton/markdown): Reserve space while content is still loading.
- [Morph loader](https://uiarc.dev/components/morph-loader/markdown): Tiny loaders that morph between shapes and fold into a check or a cross when done.
- [Empty state](https://uiarc.dev/components/empty-state/markdown): A useful next step when there is nothing to show yet.

## Also in loaders

- [Stretch refresh](https://uiarc.dev/components/stretch-refresh/markdown): Pull a feed down and a line stretches to tell you when to let go.
- [Black hole](https://uiarc.dev/components/black-hole/markdown): A delete transition that pulls the chosen items into a tiny singularity while the rest of the list bends around it; undo spins them back out.
- [Charge session](https://uiarc.dev/components/charge-session/markdown): An EV or device charging card. Energy packets flow from a charger along the cable into the battery pack, which fills toward a draggable charge limit. The charge curve tapers near full, and power, energy, time to limit and cost update live. Stop charging drains the flow.

## Guidance for AI tools

Skeleton morph: Loading skeletons that grow into the real content, block by block, instead of swapping. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
