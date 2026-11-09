# Ink fluid

> A real time fluid simulation behind your hero: the cursor stirs soft ink that swirls, settles and fades; calm when left alone.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/ink-fluid
- Markdown: https://uiarc.dev/components/ink-fluid/markdown
- Source file: `registry/components/ink-fluid/ink-fluid.tsx`
- Dependencies: motion
- Keywords: special, background, webgl, new, fluid simulation, ink, smoke, hero background, stable fluids, interactive background, cursor effect, navier stokes

## When to use

- A landing hero or sign in screen that should feel alive without a video.
- Empty states and waiting screens where a gentle, interactive background rewards curiosity.

## When not to use

- Dense product surfaces such as tables and forms. Movement behind data distracts.
- More than one per page; each instance runs its own simulation.

## Installation

Ink fluid is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/ink-fluid
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { InkFluid } from "@/components/arc/ink-fluid/ink-fluid";

export function Hero() {
  return (
    <InkFluid className="hero">
      <h1>Ship interfaces that feel alive</h1>
      <p>Components with motion that explains every change.</p>
    </InkFluid>
  );
}
```

## API reference

### InkFluid

A real time stable fluids simulation behind your content. The pointer stirs soft ink tinted with the accent colour, which settles to neutral as it spreads; left alone a slow, calm stir keeps it alive.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | – | Content drawn above the ink, such as a hero heading and actions. |
| `intensity` | `number` | `0.5` | How dark the ink gets, from 0 to 1. |
| `tint` | `number` | `0.8` | How much fresh ink takes `--accent`, from 0 to 1. The tinted share hands itself to the neutral share as it spreads. |
| `force` | `number` | `0.5` | How hard the pointer stirs, from 0 to 1. |
| `ambient` | `boolean` | `true` | A slow stir while nobody interacts, starting 1.2s after the last pointer move. |
| `interactive` | `boolean` | `true` | Lets the pointer stir the ink. |
| `quality` | `"low" \| "medium" \| "high"` | `"medium"` | Simulation grid (96, 128 or 192 cells on the short side) and ink texture resolution. |
| `className` | `string` | – | Extra class on the root. Give it a size, a background and a radius. |
| `style` | `CSSProperties` | – | Inline styles on the root. |

## Accessibility

- The canvas is aria-hidden and ignores pointer hits; content inside stays fully interactive and readable.
- Ink is capped at a low opacity so text over it keeps its contrast in both themes.
- With reduced motion it renders one composed still frame and stops.

## Motion

- Semi Lagrangian advection, vorticity confinement and a 20 step pressure solve on a small grid, drawn with linear upscaling and a soft light term from the ink gradient so wisps read silky.
- Pointer velocity drives the force; the amount of ink scales with speed so slow moves leave faint trails and quick flicks bloom.
- Ink fades over a couple of seconds; accent tinted ink turns neutral as it spreads, so fresh strokes carry colour and old ones go grey.
- It pauses when scrolled out of view or when the tab is hidden, and resumes where it left off.

## Responsive behavior

- Resizes its simulation with the element, debounced by 120ms.
- Touch devices stir while a finger is down; `touch-action: pan-y` keeps vertical scrolling working.

## Performance

- About 30 small GPU passes per frame on a 128 cell grid; well under 2ms on integrated graphics.
- Device pixel ratio is capped at 1.5 for the output canvas; the ink texture is 512 cells on the short side at medium quality.
- Stops its animation frame loop off screen and in background tabs.

## Notes for AI

- Use as a hero or empty state background. Give the root a min height, a background colour and a border radius; the ink draws on transparent pixels over it.
- Colours come from `--foreground` (ink) and `--accent` (tint) on the root, so it follows the theme and accent switcher automatically. Override `--ink-color` or `--ink-accent` on the root to change them.
- Put buttons inside with `pointer-events: auto`; the root listens to pointer moves so stirring works over text too.
- Falls back to a plain background when WebGL2 or float render targets are unavailable.

## Related

- [Dot grid](https://uiarc.dev/components/dot-grid/markdown): A dot field that bulges around the cursor like a lens and ripples from every click.
- [Image trail](https://uiarc.dev/components/image-trail/markdown): Moving the pointer leaves a curated trail of photos that pop in, lean, and fade away.

## Also in cursor

- [Gravity well](https://uiarc.dev/components/gravity-well/markdown): A grid of tiles that bends toward the cursor like spacetime, with a click that sends a shockwave through it.

## Guidance for AI tools

Ink fluid: A real time fluid simulation behind your hero: the cursor stirs soft ink that swirls, settles and fades; calm when left alone. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
