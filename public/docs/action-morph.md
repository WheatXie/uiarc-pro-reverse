# Action morph

> A floating button that morphs into a quick-action menu, then an inline form, then back with a check.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/action-morph
- Markdown: https://uiarc.dev/components/action-morph/markdown
- Source file: `registry/components/action-morph/action-morph.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, new, react floating action button, fab menu, quick actions, morphing fab, inline composer, speed dial, quick create button

## When to use

- Quick capture of tasks, notes, or comments without leaving the page.
- Apps with a few frequent create actions that deserve a persistent button.
- Mobile layouts where a corner button should expand into a small form.

## When not to use

- Use dialog or drawer for longer forms with several fields.
- Use dropdown-menu when actions run immediately and need no input.
- Use action-button for one async save on a button in place.

## Installation

Action morph is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/action-morph
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { CheckSquare, StickyNote } from "lucide-react";
import { ActionMorph } from "@/components/arc/action-morph/action-morph";

export function QuickCreate() {
  return (
    <div style={{ position: "fixed", right: 24, bottom: 24 }}>
      <ActionMorph
        label="Create"
        actions={[
          {
            id: "task",
            label: "New task",
            description: "Add to your list",
            icon: <CheckSquare strokeWidth={1.75} />,
            shortcut: "t",
            composer: {
              title: "New task",
              placeholder: "What needs doing?",
              choices: { label: "Due", options: ["Today", "Tomorrow", "Next week"] },
              submitLabel: "Add",
              successLabel: "Task added",
            },
          },
          {
            id: "note",
            label: "New note",
            icon: <StickyNote strokeWidth={1.75} />,
            shortcut: "n",
            composer: { title: "New note", placeholder: "Write a note", multiline: true, submitLabel: "Save", successLabel: "Note saved" },
          },
        ]}
        onSubmit={({ action, text, choice }) => save(action, text, choice)}
      />
    </div>
  );
}
```

## API reference

### ActionMorph

A floating action button that springs into a quick action menu, slides into an inline composer, and folds back with a check on success.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `actions` (required) | `ActionMorphAction[]` | – | Actions: { id, label, description?, icon, shortcut?, composer }. composer is { title, placeholder, multiline?, choices?, submitLabel, successLabel, emptyHint? }. |
| `label` | `string` | `"Create"` | Accessible name of the button and the title of the menu. |
| `onSubmit` | `(submission: ActionMorphSubmission) => void \| Promise<unknown>` | – | Receives { action, text, choice? }. Return a promise to hold the sending state; a rejection keeps the composer open with the draft and an error. |
| `corner` | `"end" \| "start"` | `"end"` | Which bottom corner the button sits in. The surface grows away from it. |
| `resetAfter` | `number` | `1600` | Milliseconds the check stays before the button returns to its plus. |
| `className` | `string` | – | Extra class on the root, for example to position it fixed. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter / Space | Opens the menu from the button and focuses the first action. |
| ArrowDown / ArrowUp | Moves between menu actions, wrapping at the ends; Home and End jump to the first or last. |
| Letter shortcut | Opens that action's composer while the menu is open. |
| Enter | Submits a one line composer. |
| Mod + Enter | Submits a multiline composer. |
| Arrow keys | Move between choices in the composer's radio group. |
| Escape | Goes back from a composer to the menu, or closes the menu and returns focus to the button. |

## Accessibility

- The button has aria-haspopup="menu"; after success its label adds the success message.
- The menu is role="menu" labelled by its title, with role="menuitem" buttons and aria-keyshortcuts for letter shortcuts.
- Composer fields set aria-invalid and aria-describedby on an empty or failed submit; the form sets aria-busy while sending.
- A polite status region announces the success label, and focus moves into each new face and back to the button on close.

## Motion

- One surface animates width, height, and corner radius on physical springs: growing carries a little bounce, folding settles without overshoot.
- Going deeper slides the new face in from the right and pushes the old one left; menu rows stagger in; a highlight glides between actions.
- Submitting folds the composer into the button, which tints to success while a check draws itself, then the plus rotates back in.
- Reduced motion jumps the size, swaps faces with fades, drops the press scale and shake, and slows the spinner.

## Responsive behavior

- The menu is min(16rem, 100vw - 2rem) wide and the composer min(20rem, 100vw - 2rem), so both fit narrow phones.
- corner="start" grows the surface to the right for bottom-left placement.
- The button is 56px with touch-action: manipulation; hover styles apply only on hover-capable fine pointers.

## Performance

- Each face reports its size through a ResizeObserver only while it is current; the shape animates from those sizes.
- Only the current face and the one leaving are mounted.

## Notes for AI

- Use for the two or three things people create most often on a page, such as a task, note, or event.
- Return the real promise from onSubmit; on rejection the draft stays and a retry message shows.
- Drafts are kept per action while the component is mounted, so going back and forth does not lose text.
- The component does not position itself; wrap it in a fixed container at the matching corner.
- For a single async commit use action-button; for longer forms use dialog or drawer.

## Related

- [Action button](https://uiarc.dev/components/action-button/markdown): A compact button for frequent toolbar actions.
- [Orbit menu](https://uiarc.dev/components/orbit-menu/markdown): Hold a button and its actions orbit out, ready to pick with a drag.
- [Dropdown menu](https://uiarc.dev/components/dropdown-menu/markdown): A focused list of actions anchored to a trigger.
- [Dialog](https://uiarc.dev/components/dialog/markdown): A focused surface for decisions that need attention.
- [Toast](https://uiarc.dev/components/toast/markdown): Brief confirmation for a completed background action.

## Also in docks and tabs

- [Share sheet](https://uiarc.dev/components/share-sheet/markdown): A Share button that opens into a panel with copy link, access level, channels, and people to send to.
- [Morph nav](https://uiarc.dev/components/morph-nav/markdown): A navigation bar that morphs into rich menus, search, and a compact state as one surface.
- [Dock](https://uiarc.dev/components/dock/markdown): A floating tool dock with a gliding label, a springy selection, and trays that grow out of it.
- [Liquid tab bar](https://uiarc.dev/components/liquid-tab-bar/markdown): Tabs with a lens selection that slides between them, swaps labels cleanly, and fills in icons as it passes.

## Guidance for AI tools

Action morph: A floating button that morphs into a quick-action menu, then an inline form, then back with a check. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
