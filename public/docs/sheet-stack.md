# Sheet stack

> Nested sheets that stack with depth, drag to dismiss, and become stacked dialogs on wide screens.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/sheet-stack
- Markdown: https://uiarc.dev/components/sheet-stack/markdown
- Source file: `registry/components/sheet-stack/sheet-stack.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, new, react sheet stack, nested bottom sheets, stacked modals, drill down sheet, ios sheet stack, nested dialogs, draggable sheet, sheet navigation

## When to use

- Mobile settings where each row opens a deeper page and back should feel spatial.
- Nested pickers, such as choosing a workspace and then a project inside it.
- Flows that should be a bottom sheet on phones and a centered dialog on desktop from one declaration.

## When not to use

- Use dialog for a single confirmation or form with no nested steps.
- Use bottom-sheet for one sheet with snap points.
- Use multi-step-form when steps are sequential rather than drill-down.

## Installation

Sheet stack is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/sheet-stack
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { Sheet, SheetStack, SheetTrigger, useSheetStack } from "@/components/arc/sheet-stack/sheet-stack";

function SaveButton() {
  const { close } = useSheetStack();
  return <button type="button" onClick={close}>Save</button>;
}

export function Settings() {
  return (
    <SheetStack>
      <SheetTrigger sheet="settings">Settings</SheetTrigger>

      <Sheet id="settings" title="Settings">
        <SheetTrigger sheet="notifications">Notifications</SheetTrigger>
      </Sheet>

      <Sheet id="notifications" title="Notifications" footer={<SaveButton />}>
        <label><input type="checkbox" defaultChecked /> Email me about mentions</label>
      </Sheet>
    </SheetStack>
  );
}
```

## API reference

### SheetStack

Holds the stack of open sheets and renders the layer they appear in. Declare every Sheet inside one SheetStack.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` (required) | `ReactNode` | – | Page content, triggers, and Sheet declarations. |
| `stack` | `string[]` | – | Controlled ids of open sheets, bottom first. Leave undefined for uncontrolled use. |
| `defaultStack` | `string[]` | `[]` | Sheets open at first when uncontrolled. |
| `onStackChange` | `(stack: string[]) => void` | – | Called when sheets are pushed or popped. |
| `mode` | `"auto" \| "sheet" \| "dialog"` | `"auto"` | auto picks bottom sheets below breakpoint and centered dialogs above it. |
| `breakpoint` | `number` | `640` | Width in px of the viewport, or the container when contained, where auto switches to dialogs. |
| `contained` | `boolean` | `false` | Fill the nearest positioned ancestor instead of the viewport. |

### Sheet

One level of the stack. Renders nothing until its id is pushed.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` (required) | `string` | – | Id used by push, popTo, SheetTrigger, and the stack array. |
| `title` (required) | `string` | – | Heading and accessible name. |
| `description` | `string` | – | A line under the title, wired as the dialog description. |
| `children` (required) | `ReactNode` | – | Scrolling body content. |
| `footer` | `ReactNode` | – | A row pinned under the scrolling body, such as the primary action. |
| `backLabel` | `string` | – | Label for the back button of a sheet opened from this one. Defaults to title. |
| `dismissible` | `boolean` | `true` | Allow drag and fling to dismiss. |
| `className` | `string` | – | Class on the panel. |
| `ref` | `Ref<HTMLDivElement>` | – | The panel element. |

### SheetTrigger

A button that opens a sheet on top of the stack. Takes every button attribute.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `sheet` (required) | `string` | – | Id of the sheet to push. |
| `ref` | `Ref<HTMLButtonElement>` | – | The button element. |
| `...props` | `ButtonHTMLAttributes<HTMLButtonElement>` | – | Forwarded to the button. Call preventDefault in onClick to skip the push. |

### useSheetStack

Returns { stack, push, pop, popTo, close } for buttons inside or beside the sheets. Throws outside SheetStack.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Escape | Closes the top sheet only. |
| Tab / Shift+Tab | Cycles focus inside the top sheet. |
| Enter / Space | Runs back, close, and trigger buttons. |

## Accessibility

- Each panel is a dialog labelled by its title and described by description; only the top one is aria-modal, lower ones are inert.
- Opening moves focus into the new sheet; popping returns focus to the element that opened it.
- The back button names the sheet it returns to; the close button reads "Close all" when more than one sheet is open.
- Page scroll is locked while any sheet is open, unless contained.

## Motion

- A new sheet rises from the bottom edge (or eases in as a dialog) while the one below scales back 5%, dims, and peeks above it.
- The top sheet follows a vertical drag with rubber banding upward; the sheets below ease back up as it goes and a fling past 35% or 450px/s pops it.
- Height changes spring as content changes, and all springs keep velocity when interrupted.
- Reduced motion removes the depth scale, lift, and drag physics; sheets fade in and out.

## Responsive behavior

- mode="auto" measures the layer with a ResizeObserver: under breakpoint (640px) sheets rise from the bottom; at or above it they are centered dialogs.
- Each level loses room for the peek (10px per level for sheets, 14px for dialogs), and bodies scroll inside past that height.
- Drag to dismiss works with any pointer; a drag starting in a scrolled body scrolls instead of dragging.

## Performance

- Transforms and dims come from motion values, so drags and depth changes do not rerender React per frame.
- Each open sheet has a ResizeObserver on its content; the stack is meant for a handful of levels, not dozens.

## Notes for AI

- Use for short drill-down flows (settings, filters, account steps) where each level should keep its parent in view.
- Declare every Sheet once inside the SheetStack; open with SheetTrigger or useSheetStack().push. Pushing an open id pops back to it.
- Add data-sheet-no-drag to content that handles its own vertical drags, such as sliders or maps.
- For a single sheet with no nesting use bottom-sheet or drawer.

## Related

- [Bottom sheet](https://uiarc.dev/components/bottom-sheet/markdown): A sheet that rests at a peek or full height and follows your finger.
- [Drawer](https://uiarc.dev/components/drawer/markdown): A temporary side surface for focused work.
- [Dialog](https://uiarc.dev/components/dialog/markdown): A focused surface for decisions that need attention.
- [Settings page](https://uiarc.dev/components/blocks/settings-page/markdown): Account settings with a gliding section nav and a save bar that morphs in as you edit.
- [Multi-step form](https://uiarc.dev/components/blocks/multi-step-form/markdown): A guided form that presents one decision at a time and preserves progress.

## Also in surfaces

- [Wallet stack](https://uiarc.dev/components/wallet-stack/markdown): Fan a stack of cards and lift one out to see its activity.
- [Control center](https://uiarc.dev/components/control-center/markdown): Workspace quick settings: tiles that morph into detail, a duration dial, and rubber-banded meters.
- [Holo card](https://uiarc.dev/components/holo-card/markdown): A member card that tilts toward you with a holographic foil and flips to its back.
- [Card to article](https://uiarc.dev/components/card-to-article/markdown): Story cards that open into full articles with one seamless morph and shrink back into their exact slot when dragged down.
- [Link unfurl](https://uiarc.dev/components/link-unfurl/markdown): A composer where pasting a URL shows a loading shimmer on the link, then unfurls it into a rich preview card with title, image and favicon in one morph, which can be collapsed back to the inline link or removed.

## Guidance for AI tools

Sheet stack: Nested sheets that stack with depth, drag to dismiss, and become stacked dialogs on wide screens. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
