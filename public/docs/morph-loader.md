# Morph loader

> Tiny loaders that morph between shapes and fold into a check or a cross when done.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/morph-loader
- Markdown: https://uiarc.dev/components/morph-loader/markdown
- Source file: `registry/components/morph-loader/morph-loader.tsx`
- Dependencies: motion
- Keywords: special, loading, new, loader, spinner, loading indicator, morphing loader, success check, error cross, loading to check, svg spinner

## When to use

- Inline progress inside a button, row, or field where the result should appear in the same spot.
- Short operations that end in a clear success or failure, such as save, publish, or upload.
- Any spinner where a tiny, crisp, brand-consistent mark matters.

## When not to use

- Use progress when the percentage is known.
- Use skeleton when content is loading into a layout.
- Use action-button when the whole button should morph its label too.

## Installation

Morph loader is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/morph-loader
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { MorphLoader } from "@/components/arc/morph-loader/morph-loader";

export function PublishStatus({ state }: { state: "loading" | "success" | "error" }) {
  return <MorphLoader variant="ring" status={state} size={20} successLabel="Published" errorLabel="Publish failed" />;
}
```

## API reference

### MorphLoader

A tiny loader drawn from four strokes that morph between dots, bars, ring, and square shapes, then into a check or a cross when status changes.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `"dots" \| "bars" \| "ring" \| "square"` | `"dots"` | Loading shape. Changing it while loading morphs the strokes into the new shape. |
| `status` | `"loading" \| "success" \| "error"` | `"loading"` | success folds the strokes into a check, error into a cross, loading gathers them back. |
| `size` | `number` | `24` | Rendered size in px. The drawing uses a 24 unit grid. |
| `strokeWidth` | `number` | `2.5` | Stroke thickness in grid units for ring, square, check, and cross. |
| `tone` | `boolean` | `true` | Colors the check with --success and the cross with --danger. Off keeps currentColor. |
| `label` | `string` | `"Loading"` | Announced while loading. |
| `successLabel` | `string` | `"Done"` | Announced on success. |
| `errorLabel` | `string` | `"Failed"` | Announced on error. |
| `decorative` | `boolean` | `false` | Drops the status role and text, for loaders inside a control that announces its own state. |
| `className` | `string` | – | Extra class on the root. |
| `style` | `CSSProperties` | – | Inline styles on the root. |

## Accessibility

- The root is role="status" with visually hidden text that changes to label, successLabel, or errorLabel.
- The drawing is aria-hidden; completion is never shown by color alone because the shape becomes a check or a cross.
- Set decorative inside buttons that already announce progress, so the state is not read twice.

## Motion

- Each stroke is a center, length, direction, bend, and width, each on its own spring, so any shape can morph into any other and interruptions keep velocity.
- Dots bounce in a wave, bars grow in sequence, the ring turns while its arcs breathe, and the square tumbles a quarter turn at a time while its corners open.
- On success or error the loop fades, the drawing turns forward to upright, the strokes draw the mark in order, and the mark pops once.
- Reduced motion shows a static shape per state and swaps instantly.

## Responsive behavior

- Vector drawing at any size; 16 to 32px suit inline use and 48px or more suit empty states.
- The footprint is fixed to size, so state changes never shift layout.

## Performance

- Four SVG paths; one animation frame loop runs only while loading or settling.
- Path data is built from motion values without React renders.

## Notes for AI

- Drive it with one prop: set status from your request state. Keep variant fixed per product for consistency.
- It inherits currentColor, so place it inside buttons and text without extra styling.
- At 16px use strokeWidth 3 for weight that matches 1.75px icon strokes.
- Return status to loading to reuse the same loader for the next request; the strokes gather back into the variant.

## Related

- [Progress](https://uiarc.dev/components/progress/markdown): Show how much of a known task is complete.
- [Skeleton](https://uiarc.dev/components/skeleton/markdown): Reserve space while content is still loading.
- [Action button](https://uiarc.dev/components/action-button/markdown): A compact button for frequent toolbar actions.
- [Icon morph](https://uiarc.dev/components/icon-morph/markdown): Icons that morph between states: menu to close, play to pause, copy to check, and more.

## Also in loaders

- [Stretch refresh](https://uiarc.dev/components/stretch-refresh/markdown): Pull a feed down and a line stretches to tell you when to let go.
- [Skeleton morph](https://uiarc.dev/components/skeleton-morph/markdown): Loading skeletons that grow into the real content, block by block, instead of swapping.
- [Black hole](https://uiarc.dev/components/black-hole/markdown): A delete transition that pulls the chosen items into a tiny singularity while the rest of the list bends around it; undo spins them back out.
- [Charge session](https://uiarc.dev/components/charge-session/markdown): An EV or device charging card. Energy packets flow from a charger along the cable into the battery pack, which fills toward a draggable charge limit. The charge curve tapers near full, and power, energy, time to limit and cost update live. Stop charging drains the flow.

## Guidance for AI tools

Morph loader: Tiny loaders that morph between shapes and fold into a check or a cross when done. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
