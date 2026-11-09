# Sand text

> A headline made of sand that pours into the letters, crumbles where the cursor digs, and heals itself.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/sand-text
- Markdown: https://uiarc.dev/components/sand-text/markdown
- Source file: `registry/components/sand-text/sand-text.tsx`
- Dependencies: motion
- Keywords: text, canvas, physics, new, sand, falling sand, cellular automaton, particles, text effect, headline, crumble, hourglass

## When to use

- A hero headline or section title that should be fun to touch.
- Short words that change on a selection, like a product name or theme.

## When not to use

- Body copy or long headings; use in-view-title or text-reveal.
- Text that must stay readable while people interact near it, like form labels.

## Installation

Sand text is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/sand-text
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { SandText } from "@/components/arc/sand-text/sand-text";

export function Hero() {
  return <SandText as="h1" text="Dunes" />;
}
```

## API reference

### SandText

A headline made of sand. Grains pour in and pack into the letters, the pointer digs through them and throws grains that tumble and pile, and at rest the letters heal while the extra sand drifts away. Changing the text collapses the old word into sand.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `text` (required) | `string` | – | The text to form. Keep it to one short line. Changing it collapses the old word and pours the new one. |
| `grain` | `number` | `2` | Grain size in CSS px. |
| `radius` | `number` | `14` | Radius the pointer digs through, in CSS px. |
| `palette` | `string[]` | – | Grain colors. Each grain picks one and varies it slightly. Defaults to the text color. |
| `as` | `"h1" \| "h2" \| "h3" \| "p"` | `"h2"` | Element for the visually hidden text. |
| `className` | `string` | – | Extra class on the root. Set font-size here to size the letters. |
| `style` | `CSSProperties` | – | Inline styles on the root. |

## Accessibility

- The real text is rendered in a visually hidden heading, so screen readers and search read it as text.
- The canvas is aria-hidden. Digging is decorative and never removes the text from the accessibility tree.

## Motion

- Letters fill bottom first like jars. Dug grains fly with the pointer's velocity and settle with a falling sand automaton.
- Grains that come to rest inside a letter stick again, missing grains pour back in once the pointer rests, and loose sand outside the letters drifts away.
- A new word turns the old letters loose, so the old text collapses while the new one pours in.
- Reduced motion shows the letters formed, turns digging off, and swaps words instantly.

## Responsive behavior

- The grid is derived from the box size and the text is fitted to 94 percent of the width, so it works at 320px.
- Touch: dragging a finger digs; vertical scroll still works.

## Performance

- One grid cell per grain, drawn as a small ImageData scaled up without smoothing. A 700px wide headline is about 50,000 cells.
- The loop sleeps once every grain has settled and the pointer is gone.

## Notes for AI

- Use for one short headline. Size it with font-size on className; the box is 1.55em tall to leave room for piles.
- Pass palette for tinted sand, but the default text color matches Arc surfaces in both themes.

## Also in type

- [Keycap keyboard](https://uiarc.dev/components/keycap-keyboard/markdown): Mechanical keycaps that sink and light up as you type, with the text above the board.
- [Slot text](https://uiarc.dev/components/slot-text/markdown): Text and numbers that spin into their new value on staggered slot machine reels.
- [Typewriter terminal](https://uiarc.dev/components/typewriter-terminal/markdown): A terminal that types a scripted CLI session with a seeded human cadence, colors the shell syntax, and streams output lines, progress bars and spinners, with a scrubber, play/pause and replay controls.

## Guidance for AI tools

Sand text: A headline made of sand that pours into the letters, crumbles where the cursor digs, and heals itself. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
