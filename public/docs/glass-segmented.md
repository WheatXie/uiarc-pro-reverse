# Glass segmented

> A glass segmented control whose liquid indicator stretches between segments and can be dragged and flung.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/glass-segmented
- Markdown: https://uiarc.dev/components/glass-segmented/markdown
- Source file: `registry/components/glass-segmented/glass-segmented.tsx`
- Dependencies: motion
- Keywords: special, glass, input, new, segmented control, liquid glass, toggle group, tabs, gooey indicator, stretch, frosted, drag

## When to use

- Switching the view of a photo, map, or media surface.
- A compact filter over imagery, such as day, week, month on a hero chart.

## When not to use

- Plain forms on neutral surfaces. Use segmented-control.
- More than five options or long labels. Use tabs or a select.

## Installation

Glass segmented is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/glass-segmented
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { useState } from "react";
import { GlassSegmented } from "@/components/arc/glass-segmented/glass-segmented";

export function MapMode() {
  const [mode, setMode] = useState("explore");
  return (
    <GlassSegmented
      label="Map mode"
      value={mode}
      onValueChange={setMode}
      options={[
        { value: "explore", label: "Explore" },
        { value: "drive", label: "Drive" },
        { value: "transit", label: "Transit" },
      ]}
    />
  );
}
```

## API reference

### GlassSegmented

A glass segmented control with a liquid indicator: the leading edge races ahead and the trailing edge catches up, so the drop stretches and thins between segments. Drag the selected segment to slide it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `options` (required) | `GlassSegmentedOption[]` | – | Segments: `{ value, label, icon?, badge?, disabled? }`. `badge` shows a small count in the accent color. |
| `label` (required) | `string` | – | Accessible name of the group. |
| `value` | `string` | – | Controlled value. |
| `defaultValue` | `string` | – | Initial value when uncontrolled. Defaults to the first enabled option. |
| `onValueChange` | `(value: string) => void` | – | Called when a segment is chosen by click, keys, or a drag. |
| `size` | `"sm" \| "md"` | `"md"` | 36px or 44px tall. |
| `fullWidth` | `boolean` | `false` | Stretches to the container width with equal segments. |
| `className` | `string` | – | Extra class on the root. |
| `style` | `CSSProperties` | – | Inline styles on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Focus the selected segment. |
| Arrow keys | Select the previous or next segment, wrapping at the ends. |
| Home / End | Select the first or last segment. |

## Accessibility

- The control is a `radiogroup` with a roving tab stop; each segment is a `radio` with `aria-checked`.
- The indicator is decorative SVG and hidden from assistive tech.
- Selection is also shown by label color, not only by the indicator.

## Motion

- Each edge of the indicator has its own spring: the edge facing the travel is quick, the other lags, so the drop stretches and then settles.
- The drop thins as it stretches, like liquid keeping its volume.
- Drag the selected segment and the drop follows with the same liquid lag; on release, velocity is projected to pick where it lands.
- With reduced motion the indicator jumps and dragging tracks directly.

## Responsive behavior

- `fullWidth` gives equal segments that fill the container at 320px.
- Touch drag uses `touch-action: pan-y`, so vertical scroll still works over the control.

## Performance

- The indicator is an SVG rect whose attributes update from motion values, so the stretch is paint only with no layout.
- Segment positions are measured once and on resize.

## Notes for AI

- Use for two to five short, mutually exclusive views on top of imagery or maps, where the glass reads against the content.
- Use `fullWidth` on mobile or inside a card; keep labels to one or two words.
- Drag only starts on the selected segment, so taps elsewhere stay plain clicks.

## Related

- [Segmented control](https://uiarc.dev/components/segmented-control/markdown): Switch between a small set of related views.
- [Liquid tab bar](https://uiarc.dev/components/liquid-tab-bar/markdown): Tabs with a lens selection that slides between them, swaps labels cleanly, and fills in icons as it passes.
- [Billing toggle](https://uiarc.dev/components/billing-toggle/markdown): A monthly and yearly switch with a savings badge and prices that roll to the new amount.

## Also in glass

- [Glass menu](https://uiarc.dev/components/glass-menu/markdown): A glass action menu whose trigger morphs into the panel, with a highlight pill that glides between rows, one in-place submenu, and full keyboard support.
- [Glass card](https://uiarc.dev/components/glass-card/markdown): A glass info panel over a photo whose rim catches a pointer-following highlight while the card tilts; tap to morph it into a detail sheet.
- [Glass tab bar](https://uiarc.dev/components/glass-tabbar/markdown): A floating Liquid Glass tab bar that refracts what scrolls beneath it, with a glass lens that glides, magnifies and can be dragged between tabs, and an optional search bubble; it compacts on scroll down.

## Guidance for AI tools

Glass segmented: A glass segmented control whose liquid indicator stretches between segments and can be dragged and flung. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
