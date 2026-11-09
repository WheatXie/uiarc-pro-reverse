# Glass menu

> A glass action menu whose trigger morphs into the panel, with a highlight pill that glides between rows, one in-place submenu, and full keyboard support.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/glass-menu
- Markdown: https://uiarc.dev/components/glass-menu/markdown
- Source file: `registry/components/glass-menu/glass-menu.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, glass, menu, new, glass menu, dropdown, context menu, action menu, liquid glass, frosted, shared layout, morph, submenu

## When to use

- Actions for a photo, file, or card shown over an image or a colorful canvas.
- A title menu in an editor or viewer, where the title itself opens the actions.

## When not to use

- Plain settings pages with no imagery behind the menu. Use dropdown-menu on a neutral surface.
- Navigation between pages. Use morph-nav or tabs.
- Deep hierarchies. Use a command palette or a dedicated screen.

## Installation

Glass menu is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/glass-menu
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { Copy, FolderInput, Trash2 } from "lucide-react";
import { GlassMenu } from "@/components/arc/glass-menu/glass-menu";

export function PhotoActions() {
  return (
    <GlassMenu
      label="Photo actions"
      onSelect={id => console.log(id)}
      groups={[
        { id: "edit", items: [
          { id: "duplicate", label: "Duplicate", icon: <Copy size={16} />, shortcut: "⌘D" },
          { id: "move", label: "Move to", icon: <FolderInput size={16} />, items: [
            { id: "lisbon", label: "Lisbon trip" },
            { id: "archive", label: "Archive" },
          ] },
        ] },
        { id: "danger", items: [{ id: "delete", label: "Delete", icon: <Trash2 size={16} />, danger: true }] },
      ]}
    >
      Pool house
    </GlassMenu>
  );
}
```

## API reference

### GlassMenu

A glass action menu. The trigger morphs into the panel on a spring, a glass pill slides between rows, one submenu slides in place, and the panel morphs back into the trigger on close.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `groups` (required) | `GlassMenuGroup[]` | – | Rows in groups: `{ id, label?, items }`. Groups are separated by a hairline; `label` adds a quiet heading. |
| `children` (required) | `ReactNode` | – | Trigger content, usually a short label and a chevron or an icon. |
| `label` | `string` | `"Actions"` | Accessible name of the menu. |
| `triggerLabel` | `string` | – | Accessible name of the trigger when it only shows an icon. |
| `open` | `boolean` | – | Controlled open state. |
| `defaultOpen` | `boolean` | `false` | Initial open state when uncontrolled. |
| `onOpenChange` | `(open: boolean) => void` | – | Called when the menu opens or closes. |
| `onSelect` | `(id: string, item: GlassMenuItem) => void` | – | Called with the chosen row. Rows with `items` open their submenu instead. |
| `align` | `"start" \| "end"` | `"start"` | Which edge of the trigger the panel grows from. |
| `width` | `number` | `256` | Panel width in px, capped to the viewport. |
| `className` | `string` | – | Extra class on the root. |
| `style` | `CSSProperties` | – | Inline styles on the root. |

### GlassMenuItem

One row.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` (required) | `string` | – | Stable id passed to `onSelect`. |
| `label` (required) | `string` | – | Row text. Also used for typeahead. |
| `icon` | `ReactNode` | – | A 16px icon. It takes the accent color while the row is highlighted. |
| `shortcut` | `string` | – | Shortcut hint on the right, such as "⌘D". Display only. |
| `checked` | `boolean` | – | Makes the row a checkbox item with an accent check. Leave undefined for plain actions. |
| `danger` | `boolean` | – | Uses the danger color for destructive actions. |
| `disabled` | `boolean` | – | Skipped by the keyboard and ignores clicks. |
| `items` | `GlassMenuItem[]` | – | Nested rows. The submenu slides in place with a back row, one level deep. |
| `keepOpen` | `boolean` | – | Keeps the menu open after the row is chosen. Handy for checkable rows. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter / Space / ArrowDown | On the trigger, open the menu with the first row highlighted. |
| ArrowUp | On the trigger, open the menu with the last row highlighted. |
| ArrowDown / ArrowUp | Move the highlight, skipping disabled rows and wrapping at the ends. |
| Home / End | Jump to the first or last row. |
| Enter / Space | Choose the highlighted row, or open its submenu. |
| ArrowRight | Open the submenu of the highlighted row. |
| ArrowLeft | In a submenu, go back to the parent row. |
| Escape | Leave the submenu, or close the menu and return focus to the trigger. |
| Tab | Close the menu and return focus to the trigger. |
| Letters | Typeahead: jump to the next row whose label starts with what you type. |

## Accessibility

- The trigger has `aria-haspopup="menu"`, `aria-expanded`, and `aria-controls` pointing at the open menu.
- Rows are `menuitem`, or `menuitemcheckbox` with `aria-checked` when `checked` is set; rows with a submenu carry `aria-haspopup`.
- Focus moves to the highlighted row, so screen readers announce it; with no row highlighted the menu itself holds focus.
- Pressing outside closes the menu without stealing focus from what was pressed.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring. The highlight pill marks the active row for keyboard and pointer alike.

## Motion

- The trigger's glass and the panel's glass share a layout id, so opening is one spring morph from the trigger's box to the panel's, and closing morphs back.
- Rows fade and sharpen in a beat after the glass starts to grow, so text never shows outside the glass.
- The highlight pill glides between rows on the shared morph spring.
- The submenu slides in the direction of travel while the panel height follows on a critically damped spring.
- With reduced motion the panel and submenu appear in place and the pill jumps.

## Responsive behavior

- The panel width is capped to the viewport, and the submenu slides in place instead of flying out to the side.
- Touch opens on tap; rows are 36px tall with a full width hit area.

## Performance

- The open and close morph is a transform on one element; the backdrop blur is the main paint cost, on a single layer.
- The menu mounts only while open.

## Notes for AI

- Use for a compact action menu on media, cards, or toolbars that sit over imagery, where the glass reads against the content behind it.
- Put the most common actions first, keep shortcuts accurate, and put destructive rows in their own last group with `danger`.
- Only one submenu level is supported, by design; it slides in place so it works at 320px.
- For checkable rows, pass `checked` from your state and `keepOpen` so people can toggle without reopening.

## Related

- [Dropdown menu](https://uiarc.dev/components/dropdown-menu/markdown): A focused list of actions anchored to a trigger.
- [Orbit menu](https://uiarc.dev/components/orbit-menu/markdown): Hold a button and its actions orbit out, ready to pick with a drag.
- [Morph nav](https://uiarc.dev/components/morph-nav/markdown): A navigation bar that morphs into rich menus, search, and a compact state as one surface.

## Also in glass

- [Glass segmented](https://uiarc.dev/components/glass-segmented/markdown): A glass segmented control whose liquid indicator stretches between segments and can be dragged and flung.
- [Glass card](https://uiarc.dev/components/glass-card/markdown): A glass info panel over a photo whose rim catches a pointer-following highlight while the card tilts; tap to morph it into a detail sheet.
- [Glass tab bar](https://uiarc.dev/components/glass-tabbar/markdown): A floating Liquid Glass tab bar that refracts what scrolls beneath it, with a glass lens that glides, magnifies and can be dragged between tabs, and an optional search bubble; it compacts on scroll down.

## Guidance for AI tools

Glass menu: A glass action menu whose trigger morphs into the panel, with a highlight pill that glides between rows, one in-place submenu, and full keyboard support. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
