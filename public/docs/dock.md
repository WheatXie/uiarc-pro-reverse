# Dock

> A floating tool dock with a gliding label, a springy selection, and trays that grow out of it.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/dock
- Markdown: https://uiarc.dev/components/dock/markdown
- Source file: `registry/components/dock/dock.tsx`
- Dependencies: motion
- Keywords: special, dock, toolbar, react dock, floating toolbar, tool switcher, canvas toolbar, macos dock, toolbar with tray, reorderable toolbar

## When to use

- A floating tool or mode switcher, such as the tools of a canvas or whiteboard editor.
- Toolbars where related tools share one slot and open a tray, like shape variants.
- Tool sets people may reorder by drag or Alt with the arrow keys.

## When not to use

- Use segmented-control for two to four inline options.
- Use action-button for one-off actions that do not stay selected.
- Use liquid-tab-bar for switching between app sections rather than tools.

## Installation

Dock is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/dock
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { Dock } from "@/components/arc/dock/dock";
import { Hand, MousePointer2, Pencil, Square, Circle } from "lucide-react";

export function CanvasTools() {
  const [tool, setTool] = useState("select");
  const [items, setItems] = useState([
    { id: "select", label: "Select", icon: <MousePointer2 />, shortcut: "V" },
    { id: "hand", label: "Hand", icon: <Hand />, shortcut: "H" },
    { id: "shapes", label: "Shapes", icon: <Square />, items: [
      { id: "rect", label: "Rectangle", icon: <Square />, shortcut: "R" },
      { id: "ellipse", label: "Ellipse", icon: <Circle />, shortcut: "O" },
    ] },
    { id: "pen", label: "Pen", icon: <Pencil />, shortcut: "P" },
  ]);
  return <Dock items={items} value={tool} onValueChange={setTool} onItemsChange={next => setItems(next)} />;
}
```

## API reference

### Dock

A floating command dock for the tools or modes someone switches between all day. A label glides between items, a calm accent tint springs to the chosen one, and groups grow a tray out of the dock surface, all inside one hairline outline.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` (required) | `{ id: string; label: string; icon: ReactNode; shortcut?: string; badge?: number; items?: DockItem[] }[]` | – | Items in order. shortcut is a display-only key hint, badge a rolling count that leaves at 0, and items turns the entry into a group with a tray. |
| `value` | `string \| null` | `null` | Id of the selected item or group member. |
| `onValueChange` | `(id: string) => void` | – | Called when an item or group member is chosen. |
| `onItemsChange` | `(items: DockItem[], change: { type: "move"; id: string; index: number }) => void` | – | Enables drag to reorder and Alt with the arrow keys. Receives the next list and what moved. |
| `label` | `string` | `"Tools"` | Accessible name of the toolbar. |
| `className` | `string` | – | Extra class on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| ArrowLeft / ArrowRight | Moves focus along the dock, wrapping; in an open tray, moves between members. |
| Home / End | Focuses the first or last item. |
| Enter / Space | Chooses an item. On a group, selects the member it shows and opens or closes its tray. In a tray, chooses the member, closes the tray, and returns focus to the group. |
| ArrowUp | On a group, opens its tray and focuses the chosen member. |
| ArrowDown | In a tray, closes it and returns focus to the group. |
| Tab | In a tray, closes it and moves on. |
| Alt + ArrowLeft / ArrowRight | Moves the focused item when onItemsChange is set. |
| Escape | Closes the open tray and returns focus to its group. |

## Accessibility

- Items sit in a horizontal toolbar with a roving tabindex; plain items use aria-pressed for selection.
- Groups use aria-haspopup, aria-expanded, and aria-controls pointing at the tray, which is a labelled group that stays inert while closed.
- Accessible names include the shortcut hint and badge count, such as "Pen, P". A group reads as its label and shown member, such as "Shapes: Ellipse, O", plus "selected" when it holds the value.
- The floating label is aria-hidden. It shows on mouse hover and on keyboard focus, not on touch.
- A pointer down outside the dock closes an open tray.

## Motion

- The label glides between items after a short first hover delay and stays warm so the next one follows at once; the accent tint springs between items with a shared layoutId whose corner radius is corrected, so it never distorts.
- A group's glyph crossfades with a short blur when its member changes; a press dips the item on a quick spring and releases with a little overshoot.
- Opening a group grows a tab of the same material out of the dock with members staggering in; dragged items lift and neighbours reflow on a layout spring.
- Reduced motion makes the label, tray, and selection jump and keeps short fades.

## Responsive behavior

- The dock sizes to its items at a fixed 40px slot and caps at max-width 100%; it does not shrink items, so keep the count small on phones.
- The tray and label rise above the dock on purpose, so leave room over it in the layout.
- Labels only appear for mouse hover and keyboard focus; touch shows no label, so pick icons that read on their own.
- Item slots use touch-action pan-y, so a vertical swipe over the dock still scrolls the page while sideways drags reorder when onItemsChange is set.

## Performance

- Selection is one shared layoutId element and drag uses Reorder, so only the moved items reflow.
- A single ResizeObserver measures the bar. The tray mounts when a group first opens and then stays mounted, inert, for the last opened group.

## Notes for AI

- Choose it for a floating tool or mode switcher, such as the tools of a canvas editor. Use segmented-control for two to four inline options and action-button for one-off toolbar actions.
- Control value and handle shortcut keys on the page; the dock only displays them. Use items on an entry to group related tools under one slot.
- Pass onItemsChange only if people may reorder the dock.

## Related

- [Segmented control](https://uiarc.dev/components/segmented-control/markdown): Switch between a small set of related views.
- [Action button](https://uiarc.dev/components/action-button/markdown): A compact button for frequent toolbar actions.
- [Liquid tab bar](https://uiarc.dev/components/liquid-tab-bar/markdown): Tabs with a lens selection that slides between them, swaps labels cleanly, and fills in icons as it passes.
- [Reorderable list](https://uiarc.dev/components/reorderable-list/markdown): Organize items with direct drag and drop.
- [Orbit menu](https://uiarc.dev/components/orbit-menu/markdown): Hold a button and its actions orbit out, ready to pick with a drag.

## Also in docks and tabs

- [Share sheet](https://uiarc.dev/components/share-sheet/markdown): A Share button that opens into a panel with copy link, access level, channels, and people to send to.
- [Action morph](https://uiarc.dev/components/action-morph/markdown): A floating button that morphs into a quick-action menu, then an inline form, then back with a check.
- [Morph nav](https://uiarc.dev/components/morph-nav/markdown): A navigation bar that morphs into rich menus, search, and a compact state as one surface.

## Guidance for AI tools

Dock: A floating tool dock with a gliding label, a springy selection, and trays that grow out of it. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
