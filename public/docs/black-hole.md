# Black hole

> A delete transition that pulls the chosen items into a tiny singularity while the rest of the list bends around it; undo spins them back out.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/black-hole
- Markdown: https://uiarc.dev/components/black-hole/markdown
- Source file: `registry/components/black-hole/black-hole.tsx`
- Dependencies: motion
- Keywords: special, motion, webgl, new, delete animation, archive transition, black hole, singularity, gravitational lensing, spiral, undo, remove items, list delete

## When to use

- Deleting or archiving a handful of selected rows, cards, or files, with an Undo right after.
- Emptying a trash, clearing notifications, or dismissing a batch where the removal should feel final.

## When not to use

- High frequency deletes such as clearing a single chip or tag. Use a quick height collapse instead.
- Irreversible actions without undo. The spectacle should not stand in for a confirmation.
- Very long lists that scroll; the effect paints the visible wrapper, so wrap only the scrolling viewport.

## Installation

Black hole is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/black-hole
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { useLayoutEffect, useRef, useState } from "react";
import { BlackHole } from "@/components/arc/black-hole/black-hole";
import type { BlackHoleHandle } from "@/components/arc/black-hole/black-hole";

export function Inbox({ initial }: { initial: Mail[] }) {
  const hole = useRef<BlackHoleHandle>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const [items, setItems] = useState(initial);
  const [selected, setSelected] = useState<string[]>([]);

  async function remove() {
    await hole.current?.swallow(selected.map(id => rows.current.get(id)!));
    setItems(current => current.filter(item => !selected.includes(item.id)));
    setSelected([]);
  }

  return (
    <BlackHole ref={hole}>
      <ul>
        {items.map(item => (
          <li key={item.id} ref={el => { if (el) rows.current.set(item.id, el); }}>{item.subject}</li>
        ))}
      </ul>
    </BlackHole>
  );
}
```

## API reference

### BlackHole

Wraps a list or grid. Its ref exposes `swallow` and `release`, which run a GPU transition: the chosen items spiral into a tiny singularity while the rest of the content is gravitationally lensed around it, then the hole collapses with a soft shockwave.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` (required) | `ReactNode` | – | The content that holds the items you remove. It is painted to a texture for the length of the effect. |
| `ref` | `Ref<BlackHoleHandle>` | – | Gives access to `swallow` and `release`. |
| `className` | `string` | – | Extra class on the root. |
| `style` | `CSSProperties` | – | Inline styles on the root. |

### BlackHoleHandle

Imperative methods on the ref. Calls queue, so a release requested during a swallow waits its turn.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `swallow` | `(targets: Element[], options?: BlackHoleOptions) => Promise<void>` | – | Pulls the elements in. They stay hidden afterwards; remove them from your data when the promise resolves so the list closes the gap. |
| `release` | `(targets: Element[], options?: BlackHoleOptions) => Promise<void>` | – | The reverse. Call it in a layout effect right after the items are back in the DOM: they are hidden at once, the list makes room, then they spiral out into place. |

### BlackHoleOptions

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `origin` | `{ x: number; y: number }` | – | Where the hole opens, in viewport coordinates. Defaults to the centre of the targets. Pass the delete button's centre to pull items toward it. |
| `duration` | `number` | `1.3` | Length of the effect in seconds. The reverse runs a little faster. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| None of its own | The component has no controls. Wire Delete or Backspace to your own selection, as the demo does. |

## Accessibility

- The canvas is aria-hidden and only covers the content while the effect runs; the real DOM is back in place the moment it ends.
- Announce the result yourself (for example "2 conversations deleted" with an Undo button in a live region). The effect is visual only.
- Pointer events are not blocked on the rest of the page; disable the trigger while a transition runs to avoid double deletes.

## Motion

- Items fall along a logarithmic spiral. Points nearer the hole start earlier, so the inner edge falls faster than the outer one and rows stretch into arms.
- The rest of the content is lensed with the Einstein ring relation, so text near the hole bends and briefly mirrors around it.
- The hole opens with a slight overshoot, grows a little as it eats, then collapses and sends out one soft shockwave ring. Undo plays the same path backwards.
- With reduced motion, or without WebGL2, the items fade out in 200ms and fade back in on release.

## Responsive behavior

- Measures the wrapper at the start of every run, so it works at any width including 320px.
- The hole and lensing scale with device pixel ratio, capped at 2x.

## Performance

- Painting the wrapper to two textures takes a few milliseconds for a typical list; the shaders and context are prepared while the page is idle.
- Drawing is three passes on the GPU per frame (lensed content, a 5px mesh for the falling items, and the hole), well within a frame at 120Hz.
- Textures and buffers are released after each run; one WebGL2 context is kept per instance.

## Notes for AI

- Use for destructive or archive actions on a list, grid, or board where a moment of drama is welcome and undo is offered.
- Keep refs to the item elements (a Map keyed by id works well) and pass the selected ones to `swallow`. Remove the data only after the promise resolves.
- For undo, restore the data, then call `release` with the re-inserted elements in `useLayoutEffect` so they never flash. Pair the list with height exit and enter animations so gaps close and reopen smoothly.
- The painter handles backgrounds, borders, radii, text, images and inline SVG icons. Box shadows, gradients, pseudo elements and cross origin images are not painted.

## Related

- [Swipe actions](https://uiarc.dev/components/swipe-actions/markdown): Reveal row actions with a swipe, or from the same actions in a menu.
- [Toast stack](https://uiarc.dev/components/toast-stack/markdown): Stack short results at the edge until you reach for them.

## Also in loaders

- [Stretch refresh](https://uiarc.dev/components/stretch-refresh/markdown): Pull a feed down and a line stretches to tell you when to let go.
- [Morph loader](https://uiarc.dev/components/morph-loader/markdown): Tiny loaders that morph between shapes and fold into a check or a cross when done.
- [Skeleton morph](https://uiarc.dev/components/skeleton-morph/markdown): Loading skeletons that grow into the real content, block by block, instead of swapping.
- [Charge session](https://uiarc.dev/components/charge-session/markdown): An EV or device charging card. Energy packets flow from a charger along the cable into the battery pack, which fills toward a draggable charge limit. The charge curve tapers near full, and power, energy, time to limit and cost update live. Stop charging drains the flow.

## Guidance for AI tools

Black hole: A delete transition that pulls the chosen items into a tiny singularity while the rest of the list bends around it; undo spins them back out. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
