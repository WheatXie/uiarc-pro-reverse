# Confirm popover

> A destructive button that grows into a small confirmation card, with the consequence, optional type-to-confirm, progress on the Confirm button, and a check or error before folding back.

- Type: Component (disclosure)
- Access: Arc Pro
- Page: https://uiarc.dev/components/confirm-popover
- Markdown: https://uiarc.dev/components/confirm-popover/markdown
- Source file: `registry/components/confirm-popover/confirm-popover.tsx`
- Dependencies: motion, lucide-react
- Keywords: overlay, confirm, motion, new, confirmation, popover, delete, destructive, danger zone, are you sure, type to confirm, progress, inline confirm, morph, revoke, remove, alertdialog

## When to use

- A danger zone in settings: delete project, transfer ownership, revoke a member.
- A row action in a table where a modal would lose the row's context.
- Any destructive action that needs a sentence of consequence and a visible result without leaving the page.

## When not to use

- Reversible removals such as archiving; use undo-toast so the action is instant and recoverable.
- A one word inline confirmation in a toolbar; use confirm-morph, which morphs horizontally inside the button's row.
- Long forms or several decisions; use dialog.

## Installation

Confirm popover is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/confirm-popover
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { Trash2 } from "lucide-react";
import { ConfirmPopover } from "@/components/arc/confirm-popover/confirm-popover";

export function DeleteProject({ project }: { project: Project }) {
  return (
    <ConfirmPopover
      icon={<Trash2 size={16} />}
      align="end"
      title={`Delete ${project.name}?`}
      description={`This permanently deletes ${project.deployments} deployments and every log. It can't be undone.`}
      confirmText={project.slug}
      confirmLabel="Delete project"
      errorTitle={`Couldn't delete ${project.name}`}
      onConfirm={async ({ setProgress, signal }) => {
        for await (const step of api.deleteProject(project.id, { signal })) setProgress(step.done / step.total);
      }}
      onDone={() => router.push("/projects")}
    >
      Delete
    </ConfirmPopover>
  );
}
```

## API reference

### ConfirmPopover

A destructive button that asks in place. Pressing it grows the button itself, as one surface, into a small floating card that states the consequence, with Cancel and Confirm and an optional phrase to type first. Confirm is also the progress bar: it widens as Cancel folds away and fills with the action's progress, its label inverting exactly at the fill edge. On success the card folds back into the button's shape with a check; on failure it stays open, shakes once and shows the error with Try again. Escape and a press outside cancel; focus moves into the card and back to the button.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` (required) | `ReactNode` | – | The trigger label, such as Delete project. |
| `title` (required) | `ReactNode` | – | The question, such as Delete Atlas?. It names the dialog. |
| `description` | `ReactNode` | – | The consequence in one or two short sentences. It describes the dialog. |
| `icon` | `ReactNode` | – | A plain 16px icon before the trigger label. |
| `confirmText` | `string` | – | A phrase to type before Confirm unlocks, such as the project name. Matching ignores case and outer spaces. Confirm fills in the tone color as the typed prefix matches, and a wrong submit shakes the card. |
| `confirmLabel` | `string` | `"Delete"` | Label of the confirm button. |
| `cancelLabel` | `string` | `"Cancel"` | Label of the cancel button. |
| `pendingLabel` | `string` | `"Deleting"` | Label on the progress bar while onConfirm runs, followed by the percentage when progress is reported. |
| `successLabel` | `string` | `"Deleted"` | Shown with a check in the button's shape once onConfirm resolves. Keep it no longer than the trigger label so the width holds. |
| `errorTitle` | `ReactNode` | `"That didn't work"` | Heading of the failure. The rejection's message is shown under it. |
| `retryLabel` | `string` | `"Try again"` | Label of the confirm button after a failure. |
| `tone` | `"danger" \| "neutral"` | `"danger"` | danger tints the trigger and fills Confirm in the danger color. neutral uses the foreground, for serious but reversible actions. |
| `onConfirm` | `(ctx: ConfirmPopoverContext) => void \| Promise<unknown>` | – | Runs the action. ctx.setProgress(0 to 1) drives the bar; without it the bar sweeps. ctx.signal aborts if the component unmounts. A rejection shows the failure. |
| `onCancel` | `() => void` | – | Called when the question is dismissed by Cancel, Escape or a press outside. |
| `onDone` | `() => void` | – | Called once the success state has been shown and the button is back at rest. |
| `onError` | `(error: unknown) => void` | – | Called with the rejection when onConfirm fails. |
| `open` | `boolean` | – | Controlled open state of the question. Pair with onOpenChange. |
| `defaultOpen` | `boolean` | `false` | Opens on mount when uncontrolled. |
| `onOpenChange` | `(open: boolean) => void` | – | Called when the question opens, is dismissed, or closes after success. |
| `onPhaseChange` | `(phase: ConfirmPopoverPhase) => void` | – | Called with idle, confirming, working, success or error. |
| `align` | `"start" \| "center" \| "end"` | `"start"` | Which edge of the button the card keeps. end grows toward the start, for buttons at the end of a row. The card shifts to stay 16px inside the window either way. |
| `side` | `"bottom" \| "top" \| "auto"` | `"auto"` | Grow downward, upward, or upward only when there is not room below. |
| `width` | `number` | `320` | Width of the open card in px, never wider than the window less 32px. |
| `resultDuration` | `number` | `1600` | Milliseconds the success state holds before the button returns to rest. |
| `disabled` | `boolean` | – | Disables the trigger. |
| `className` | `string` | – | Class on the root element. |
| `style` | `CSSProperties` | – | Inline styles on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter / Space | On the button, opens the question. Focus moves to the phrase field when there is one, otherwise to Cancel. |
| Tab / Shift+Tab | Cycles through the field, Cancel and Confirm while the card is open. |
| Enter | In the phrase field, confirms once the phrase matches; otherwise the card shakes and focus stays in the field. |
| Escape | Cancels the question or dismisses a failure, and returns focus to the button once the card has folded back. |

## Accessibility

- The trigger has aria-haspopup="dialog" and aria-expanded. The open card is a non modal alertdialog named by the title and described by the consequence.
- The phrase field has a visible label that includes the phrase; it is marked aria-invalid while the typed text does not match.
- While the action runs the card is aria-busy and holds focus; a polite live region reads the pending label and the percentage, then the success label or the failure. The failure is also a role="alert" paragraph and focus moves to Try again.
- Confirm stays in the tab order while locked and says so with aria-disabled, so people can reach it and hear why it does nothing yet.
- The trigger is kept in place, invisible, while the card covers it, and takes focus back only after the card has folded into it, so focus is never lost to the page.

## Motion

- One surface: at rest it is drawn exactly over the button, then its width, height and corner radius spring to the card on the morph spring (a hint of bounce) and back on the smooth spring. The edge nearest the button stays still, and the content is pinned to that edge, so the card is revealed in place rather than sliding.
- The button face fades out in 100ms as the card content fades up 6px from a 4px blur, 60ms later. Tint, border and floating shadow crossfade from the button's look to the card's.
- Typing the phrase fills Confirm on the snappy spring to the share of the phrase matched so far; a second copy of the label in the fill's ink is clipped to the fill, so the text inverts exactly at its edge.
- Confirming folds Cancel away on the smooth spring while Confirm widens to the full row; the fill drops to zero and then follows reported progress, or a soft sweep runs when there is none.
- Success fills the bar, then the card folds back to the button's size with the check rotating in. Failure refills the bar as Try again, opens the error on a height spring and shakes the card once with a damped keyframe.
- With reduced motion the size changes are instant and only the faces crossfade; there is no shake and the sweep becomes a static tint.

## Responsive behavior

- The card is 320px wide by default and never wider than the window less 32px; it shifts horizontally to stay 16px from either edge, so it works from a 320px phone upward.
- It grows downward unless there is not enough room below the button, then upward, keeping the button's edge still.
- The phrase field disables autocorrect, autocapitalise and spellcheck, so phones do not change what is typed.

## Performance

- Only one surface is mounted while the question is open, and nothing is mounted at rest besides the button.
- The fill and its inverted label use a clip-path driven by a motion value, so typing and progress updates do not re-render the component.
- Width and height animate on a single absolutely positioned layer, which does not reflow the page around it.

## Notes for AI

- Use it for irreversible or serious actions where the consequence should be read before confirming: deleting a project, revoking access, rotating keys, cancelling a subscription.
- Write the description as the consequence, with numbers when you have them: This deletes 14 deployments and every log. It can't be undone.
- Add confirmText only for the most destructive actions; typing the resource name is friction by design.
- Report progress from onConfirm with ctx.setProgress when the action has steps; otherwise the bar sweeps until the promise settles. Throw an Error with a human message to show it under the error title.
- Keep successLabel short, such as Deleted or Removed, so the button does not change width at rest.
- The card floats over the page with position absolute inside the component. Do not place it in an ancestor with overflow hidden that is smaller than the card.

## Related

- [Confirm morph](https://uiarc.dev/components/confirm-morph/markdown): A destructive button that morphs into an inline confirmation, a spinner, and a result with undo.
- [Hold to confirm](https://uiarc.dev/components/hold-to-confirm/markdown): Confirm a destructive action by holding, not tapping.
- [Dialog](https://uiarc.dev/components/dialog/markdown): A focused surface for decisions that need attention.
- [Undo toast](https://uiarc.dev/components/undo-toast/markdown): Archive or delete rows with a second chance: the gap closes, a countdown toast merges repeat actions, and Undo or ⌘Z puts every row back exactly where it was.

## Also in overlays

- [Drawer](https://uiarc.dev/components/drawer/markdown): A temporary side surface for focused work.
- [Bottom sheet](https://uiarc.dev/components/bottom-sheet/markdown): A sheet that rests at a peek or full height and follows your finger.
- [Popover](https://uiarc.dev/components/popover/markdown): A small anchored surface for contextual information.
- [Hover card](https://uiarc.dev/components/hover-card/markdown): Preview a person or link on hover or focus without leaving the page.
- [Tooltip](https://uiarc.dev/components/tooltip/markdown): Short supporting text for unfamiliar controls.
- [Share access](https://uiarc.dev/components/share-access/markdown): A share panel: invite people as validated email chips with suggestions, change roles from a compact menu, remove with undo, switch link access and copy the link, with every change landing in place.

## Guidance for AI tools

Confirm popover: A destructive button that grows into a small confirmation card, with the consequence, optional type-to-confirm, progress on the Confirm button, and a check or error before folding back. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
