# Context menu

> Secondary actions kept close to the selected object.

- Type: Component (actions)
- Access: Free, open source
- Page: https://uiarc.dev/components/context-menu
- Markdown: https://uiarc.dev/components/context-menu/markdown
- Registry item: https://uiarc.dev/r/context-menu.json
- Source file: `registry/components/context-menu/context-menu.tsx`
- Dependencies: motion, lucide-react
- Keywords: menu, action, react context menu, right click menu, custom context menu, file actions menu, shift f10 menu, animated context menu

## When to use

- Secondary actions on a file, card, or row where a visible menu button would add clutter.
- Desktop-style right-click menus that also open from the keyboard with Shift+F10 or the ContextMenu key.
- Short flat lists of item actions with one destructive option.

## When not to use

- Use dropdown-menu when the actions deserve a visible trigger.
- Use swipe-actions for touch-first lists like an inbox.
- Avoid it on targets that need their own click action, since a plain click on the target also opens the menu.

## Installation

### CLI

Run one of these in a project set up with `shadcn init`:

```bash
npx shadcn@latest add @uiarc/context-menu
pnpm dlx shadcn@latest add @uiarc/context-menu
yarn dlx shadcn@latest add @uiarc/context-menu
bunx --bun shadcn@latest add @uiarc/context-menu
```

The `@uiarc` name needs `"registries": { "@uiarc": "https://uiarc.dev/r/{name}.json" }` in `components.json`. Without it, use the full URL:

```bash
npx shadcn@latest add https://uiarc.dev/r/context-menu.json
```

### Manual

1. Install the dependencies:

```bash
npm install motion lucide-react
```

2. Copy the source into your project. Main file: `registry/components/context-menu/context-menu.tsx`

   The source is in the registry item: https://uiarc.dev/r/context-menu.json

3. Arc imports use the `@/` alias for `registry/` and `lib/`. Keep the same folders or update the import paths.

## Usage

```tsx
import { ContextMenu } from "@/components/arc/context-menu/context-menu";
import { Copy, Trash2 } from "lucide-react";

export function FileTile({ file }: { file: File }) {
  return (
    <ContextMenu
      label={`Actions for ${file.name}`}
      items={[
        { id: "copy", label: "Copy link", icon: <Copy size={15} />, onSelect: () => copyLink(file) },
        { id: "delete", label: "Delete file", icon: <Trash2 size={15} />, destructive: true, onSelect: () => remove(file) },
      ]}
    >
      <FilePreview file={file} />
    </ContextMenu>
  );
}
```

## API reference

### ContextMenu

Wraps content and opens a menu at the pointer on right-click, or under the target on click and keyboard.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` (required) | `ReactNode` | – | The target area. |
| `items` (required) | `ContextMenuItem[]` | – | Items: { id, label, icon?, onSelect?, disabled?, destructive?, checked? }. |
| `label` | `string` | `"Context menu"` | Accessible name for both the target and the menu. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| ContextMenu / Shift+F10 | Opens the menu under the focused target. |
| ArrowDown / ArrowUp | Moves between enabled items, wrapping at the ends. |
| Home / End | Jumps to the first or last enabled item. |
| Enter / Space | Selects the focused item and closes the menu. |
| Escape | Closes the menu and returns focus to the target. |

## Accessibility

- The target is focusable with aria-haspopup="menu" and aria-expanded; the menu has role="menu" and items role="menuitem".
- Opening focuses the first enabled item; closing returns focus to the target.
- Items without an icon show a check when checked, but checked state is not exposed to assistive tech, so say it in the label if it matters.

## Motion

- The menu grows from the pointer on a snappy spring, even when clamped away from a viewport edge; reopening fades the old one out in place.
- A shared highlight glides between rows for the pointer and jumps for the keyboard.
- Reduced motion drops the scale and glide and uses a short opacity fade.

## Responsive behavior

- The menu is clamped 8px inside the viewport and capped at the viewport width minus 16px, with a max height of 300px and scrolling beyond that.
- On touch, a tap on the target opens the menu under it, so it works without a right mouse button.
- The menu closes on any scroll or resize instead of repositioning.

## Performance

- The menu mounts only while open and is positioned once from the pointer, with no scroll tracking loop.
- Items are plain buttons with one shared highlight element; there is no virtualization, so keep the list short.

## Notes for AI

- Use for secondary actions on a content object (file, card, row) where a visible menu button would add clutter. Use dropdown-menu when the commands deserve a visible trigger.
- A plain click on the target also opens the menu, so do not wrap targets that need their own click action.
- The menu closes on scroll, resize, and outside press; keep items to a short flat list.

## Related

- [Dropdown menu](https://uiarc.dev/components/dropdown-menu/markdown): A focused list of actions anchored to a trigger.
- [Swipe actions](https://uiarc.dev/components/swipe-actions/markdown): Reveal row actions with a swipe, or from the same actions in a menu.
- [Popover](https://uiarc.dev/components/popover/markdown): A small anchored surface for contextual information.
- [Command palette](https://uiarc.dev/components/blocks/command-palette/markdown): A complete keyboard driven action surface with search, grouped results, and shortcuts.

## Also in menus

- [User menu](https://uiarc.dev/components/user-menu/markdown): Your account, settings, theme, and sign out behind the avatar. Opens as a bottom sheet on phones.

## Guidance for AI tools

Context menu: Secondary actions kept close to the selected object. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
