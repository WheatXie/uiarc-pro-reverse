# Orbit menu

> Hold a button and its actions orbit out, ready to pick with a drag.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/orbit-menu
- Markdown: https://uiarc.dev/components/orbit-menu/markdown
- Source file: `registry/components/orbit-menu/orbit-menu.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, motion, react radial menu, orbit menu, fan menu, arc menu, floating action menu, press and drag menu, circular menu

## When to use

- Three to six quick actions on one object, such as a note or photo.
- Touch-first surfaces where press, drag, and release should fire an action in one gesture.

## When not to use

- Use dropdown-menu or context-menu for longer or text-heavy lists.
- Use dock for tools that stay selected.
- Use action-button for a single action.

## Installation

Orbit menu is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/orbit-menu
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { OrbitMenu } from "@/components/arc/orbit-menu/orbit-menu";
import { Pin, Share2, Trash2 } from "lucide-react";

export function NoteActions({ onAction }: { onAction: (id: string) => void }) {
  return (
    <OrbitMenu
      label="Note actions"
      onAction={onAction}
      actions={[
        { id: "pin", label: "Pin", icon: <Pin size={18} />, done: "Pinned" },
        { id: "share", label: "Share", icon: <Share2 size={18} /> },
        { id: "delete", label: "Delete", icon: <Trash2 size={18} />, tone: "danger" },
      ]}
    />
  );
}
```

## API reference

### OrbitMenu

A round button that bursts into an arc of actions. Press, drag onto an action, and release to fire it, or tap to keep the arc open and tap again to close it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `actions` (required) | `{ id: string; label: string; icon: ReactNode; done?: string; tone?: "neutral" \| "danger" }[]` | – | Three to six actions. done is the short confirmation shown after firing and defaults to the label. |
| `onAction` (required) | `(id: string) => void` | – | Called with the fired action's id. |
| `label` | `string` | `"Actions"` | Accessible name of the button and menu, also shown while the arc is open and nothing is targeted. |
| `radius` | `number` | `104` | Distance from the button center to each action, in px. |
| `spread` | `number` | `150` | Degrees the arc spans. |
| `direction` | `number` | `-90` | Degrees the arc opens toward: -90 up, 0 right, 90 down, 180 left. |
| `disabled` | `boolean` | `false` | Disables the trigger and closes the arc. |
| `announce` | `boolean` | `true` | Announces confirmations in a polite status region. |
| `onOpenChange` | `(open: boolean) => void` | – | Called when the arc opens or closes. |
| `className` | `string` | – | Class on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys | On the trigger, open the arc and focus the first action (Arrow Up focuses the last). On an action, move around the arc. |
| Home / End | Focus the first or last action. |
| Enter / Space | Fire the focused action. On the trigger, open the arc and focus the first action, or close it if open. |
| Escape | Close the arc and return focus to the trigger. |
| Tab | Close the arc and move on. |

## Accessibility

- The trigger has aria-haspopup="menu", aria-expanded, and aria-controls; actions are role="menuitem" buttons named by their label.
- The closed menu is inert, and a roving tabindex keeps one action in the tab order.
- Confirmations such as "Pinned" are read from a role="status" region when announce is on.

## Motion

- Actions swirl out along the arc in reading order and fold back in reverse; a lens glides between targeted actions and nearby actions lean toward the pointer.
- The trigger glyph morphs between ellipsis, close, and check, and a label pill springs to fit its text. It names the targeted action, shows Release to cancel when a drag leaves the arc, and shows the done text for about 1.4 seconds after firing.
- Targeting goes by angle, like a pie menu: the pointer only has to head toward an action, outside a 34px dead zone around the trigger. Releasing off the arc, or a hold without a drag, folds it away without firing.
- Reduced motion drops the swirl, blur, and magnet pull, leaving short fades and instant position changes.

## Responsive behavior

- The arc is 104px from the trigger by default and is not clamped to the viewport; set direction and radius so it opens into free space.
- Trigger and actions use touch-action none so drag-to-select works on touch; pointer magnet effects skip touch.

## Performance

- The open trigger and the label pill use backdrop blur, removed under prefers-reduced-transparency. Actions use a near solid material, so six moving items never stack blurs.
- The closed menu stays mounted but inert; with six actions the cost is small.

## Notes for AI

- Use for three to six quick actions on one object (a note, a photo) where a dropdown is too heavy and a toolbar too loud. Use dropdown-menu or context-menu for longer or text-heavy lists.
- Give each action a done string for the confirmation pill, mark destructive actions tone="danger", and set direction so the arc opens into free space.

## Related

- [Dropdown menu](https://uiarc.dev/components/dropdown-menu/markdown): A focused list of actions anchored to a trigger.
- [Context menu](https://uiarc.dev/components/context-menu/markdown): Secondary actions kept close to the selected object.
- [Action button](https://uiarc.dev/components/action-button/markdown): A compact button for frequent toolbar actions.
- [Dock](https://uiarc.dev/components/dock/markdown): A floating tool dock with a gliding label, a springy selection, and trays that grow out of it.

## Also in docks and tabs

- [Share sheet](https://uiarc.dev/components/share-sheet/markdown): A Share button that opens into a panel with copy link, access level, channels, and people to send to.
- [Action morph](https://uiarc.dev/components/action-morph/markdown): A floating button that morphs into a quick-action menu, then an inline form, then back with a check.
- [Morph nav](https://uiarc.dev/components/morph-nav/markdown): A navigation bar that morphs into rich menus, search, and a compact state as one surface.
- [Liquid tab bar](https://uiarc.dev/components/liquid-tab-bar/markdown): Tabs with a lens selection that slides between them, swaps labels cleanly, and fills in icons as it passes.

## Guidance for AI tools

Orbit menu: Hold a button and its actions orbit out, ready to pick with a drag. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
