# Selection toolbar

> A contextual batch action surface that appears when items are selected.

- Type: Block
- Page: https://uiarc.dev/components/blocks/selection-toolbar
- Markdown: https://uiarc.dev/components/blocks/selection-toolbar/markdown

- Access: Arc Pro
- Registry id: `selection-toolbar`
- Source file: `registry/components/selection-toolbar/selection-toolbar.tsx`
- Built from: Button, Selection state, Action list
- Keywords: react selection toolbar, bulk actions bar, floating action bar, selected items toolbar, table bulk actions, multi select actions

Use it next to selectable collections. Keep the count accurate and confirm destructive actions before applying them.

## When to use

- Bulk actions for checkbox-selectable tables or grids.
- Floating bars that appear only while items are selected.

## When not to use

- Use dropdown-menu for per-row actions.

## Installation

Selection toolbar is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/selection-toolbar
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { SelectionToolbar } from "@/components/arc/selection-toolbar/selection-toolbar";

export function ProjectsBar({ selected, clear }: { selected: string[]; clear: () => void }) {
  return (
    <SelectionToolbar
      count={selected.length}
      noun="project"
      onClear={clear}
      actions={[
        { label: "Archive", onClick: () => archive(selected) },
        { label: "Delete", onClick: () => remove(selected), destructive: true },
      ]}
    />
  );
}
```

## API reference

### SelectionToolbar

A floating bar that appears while items are selected, showing a rolling count, bulk actions, and a clear button.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `count` (required) | `number` | – | Number of selected items. The bar mounts above 0 and leaves at 0. |
| `actions` (required) | `SelectionAction[]` | – | Bulk actions rendered as buttons after the count. |
| `onClear` (required) | `() => void` | – | Called by the clear button. Reset your selection here. |
| `noun` | `string` | `"item"` | Singular noun; an s is added when count is not 1. |

### SelectionAction

Action type: { label: string; icon?: ReactNode; onClick: () => void; destructive?: boolean }. label is also the React key, so keep labels unique.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the actions and the clear button. |
| Enter / Space | Activates the focused button. |

## Accessibility

- The bar is role=toolbar labelled Selection actions.
- A visually hidden aria-live polite line announces the count, such as 3 projects selected; the animated count is aria-hidden.
- The clear button has aria-label Clear selection.
- The bar unmounts at count 0, so move focus back to the list yourself if it was inside the bar.

## Motion

- The bar rises and scales in on a spring and sinks back faster when the selection clears.
- Digits roll in the direction of the change, the plural s fades in place, and the count's width springs so actions do not jump.
- Reduced motion uses plain fades and no width spring.

## Responsive behavior

- Below 520px the bar goes full width and actions wrap onto a second row under the count.
- You position it yourself, for example fixed at the bottom center.

## Performance

- The bar unmounts at count 0; a ResizeObserver springs the count width so actions do not jump.

## Notes for AI

- Use with checkbox-selectable tables and grids for bulk actions.
- Position it yourself (for example fixed at the bottom center); it has no default export, so import it by name.

## Related

- [Sortable data table](https://uiarc.dev/components/sortable-data-table/markdown): Compare structured records with sortable columns.
- [Checkbox](https://uiarc.dev/components/checkbox/markdown): A binary choice with a precise, legible state.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
