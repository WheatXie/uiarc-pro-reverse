# Share sheet

> A Share button that opens into a panel with copy link, access level, channels, and people to send to.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/share-sheet
- Markdown: https://uiarc.dev/components/share-sheet/markdown
- Source file: `registry/components/share-sheet/share-sheet.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, new, react share sheet, share button, share dialog, copy link, share with people, link access level, morphing share panel, share to slack

## When to use

- A Share button on a document, design, or board header where people share often.
- Sharing flows that combine copy link, access level, and sending to a few recent people.
- Posting to a small set of channels, such as Slack or email, with in-place pending and done feedback.

## When not to use

- Use copy-button when all you need is to copy a URL.
- Use dialog when sharing needs a full form, such as roles per person or an email search.
- Use popover for a small menu of share targets with no people picker.

## Installation

Share sheet is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/share-sheet
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ShareSheet } from "@/components/arc/share-sheet/share-sheet";
import { Globe, Lock, Mail, MessageSquare } from "lucide-react";

export function DocumentShare() {
  return (
    <ShareSheet
      title="Q3 roadmap"
      link="https://example.com/d/q3-roadmap"
      people={[
        { id: "ana", name: "Ana Ruiz", avatar: "/avatars/ana.jpg" },
        { id: "sam", name: "Sam Lee", avatar: "/avatars/sam.jpg" },
      ]}
      access={[
        { value: "team", label: "Team", description: "Anyone on the team can view", icon: <Lock size={16} /> },
        { value: "public", label: "Anyone with the link", description: "Can view and comment", icon: <Globe size={16} /> },
      ]}
      channels={[
        { id: "slack", label: "Slack", doneLabel: "Posted", icon: <MessageSquare size={16} /> },
        { id: "email", label: "Email", doneLabel: "Sent", icon: <Mail size={16} /> },
      ]}
      onSend={({ people, access }) => api.share(people.map(person => person.id), access)}
      onChannel={channel => api.post(channel)}
    />
  );
}
```

## API reference

### ShareSheet

A Share button that springs open into a share panel (copy link, access level, channels, recent people) and folds into a sent confirmation.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` (required) | `string` | – | Name of the thing being shared, shown in the panel title as Share "title". |
| `link` (required) | `string` | – | The URL shown in the link row and written to the clipboard by Copy. |
| `people` (required) | `SharePerson[]` | – | Recent people: { id, name, avatar }. Picking one flies its avatar up into the Send to row. |
| `access` (required) | `ShareSheetAccess[]` | – | Access levels: { value, label, description, icon } (the type was ShareAccess, kept as a deprecated alias). Shown in a listbox under the link. |
| `channels` | `ShareChannel[]` | `[]` | Channel buttons: { id, label, icon, doneLabel }. doneLabel is shown once onChannel resolves; keep it about as long as label. |
| `defaultAccess` | `string` | – | Starting access value. Defaults to the first entry in access. |
| `onSend` | `(submission: ShareSubmission) => void \| Promise<unknown>` | – | Receives { people, access }. A returned promise holds the sending state; a rejection keeps the panel open with an error. |
| `onChannel` | `(channel: string) => void \| Promise<unknown>` | – | Called with the channel id. A promise holds that button's pending state; a rejection shows Failed on it. |
| `onCopy` | `(access: string) => void` | – | Called after the link is copied, with the access level it was copied under. |
| `label` | `string` | `"Share"` | Trigger button text. |
| `align` | `"start" \| "end" \| "center"` | `"end"` | Which edge of the button stays put while the panel grows. center grows it evenly around the button and folds it back the same way. |
| `sheetOnPhones` | `boolean` | `true` | Up to 520px wide the panel opens as a bottom sheet over a dimmed backdrop: it slides up, drags down from its grabber, and closes on Esc, a tap outside or Done. |
| `className` | `string` | – | Class on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter / Space | Opens the panel from the Share button, or presses the focused control. |
| Escape | Closes the access list first, then folds the panel back into the button and returns focus to it. |
| ArrowUp / ArrowDown / ArrowLeft / ArrowRight | Moves between access options in the open list, looping at the ends. |
| Tab | Moves through the copy, access, channel, people, and send controls. |

## Accessibility

- The trigger has aria-haspopup="dialog"; the open panel is role="dialog" labelled by its title.
- Opening moves focus to Copy, sending moves it to Done, and closing returns it to the Share button.
- Access options are a listbox of role="option" buttons with aria-selected and roving tabindex.
- People are toggle buttons with aria-pressed; chips have a Remove <name> button.
- A polite status region announces copies, picks, removals, channel results, and who a share was sent to.
- A press outside the component closes the panel without stealing focus.

## Motion

- One shape springs its width, height, and corner radius between the button, the panel, and the confirmation; faces cross with a short blur and scale.
- A picked avatar flies from the recent row to its chip on a separate layer, so the scrolling chips row never clips it.
- Send with nobody picked shakes the Send to row on a spring; the count in the send button rolls one digit up or down.
- Reduced motion jumps the shape to size, swaps faces with a plain fade, skips the avatar flight and the shake, and slows the spinner.

## Responsive behavior

- The panel is min(24rem, 100vw - 2rem) wide; set --share-sheet-width on an ancestor to fit a narrower container. It is a container, so its rows adapt to that width.
- The panel is min(24rem, 100vw - 2rem) wide and the confirmation min(19rem, 100vw - 2rem), so both fit a 320px phone.
- align="start" grows the panel from the left edge of the button; use it when the button sits near the left of the viewport.
- Hover styles apply only on hover-capable fine pointers; the trigger uses touch-action: manipulation for fast taps.

## Performance

- Each face runs a ResizeObserver while it is current, and the shape animates three motion values; nothing runs while closed.
- Avatars are plain img tags from your URLs; pass small, pre-sized images since each person renders at up to 80px.

## Notes for AI

- Use for sharing a document, board, or file from a toolbar without leaving the page.
- Wire onSend and onChannel to your API and return the promise; the component handles pending, error, and done states itself.
- people is a short list of recent collaborators, not a directory search. For inviting by email use the invite-people block.
- The root reserves only the button's size; the panel floats over the page, so leave room below or pick align to grow away from an edge.

## Related

- [Popover](https://uiarc.dev/components/popover/markdown): A small anchored surface for contextual information.
- [Copy button](https://uiarc.dev/components/copy-button/markdown): Copy a value with immediate confirmation.
- [Avatar group](https://uiarc.dev/components/avatar-group/markdown): Show a team or set of contributors in a small space.
- [Dialog](https://uiarc.dev/components/dialog/markdown): A focused surface for decisions that need attention.
- [Toast](https://uiarc.dev/components/toast/markdown): Brief confirmation for a completed background action.

## Also in docks and tabs

- [Action morph](https://uiarc.dev/components/action-morph/markdown): A floating button that morphs into a quick-action menu, then an inline form, then back with a check.
- [Morph nav](https://uiarc.dev/components/morph-nav/markdown): A navigation bar that morphs into rich menus, search, and a compact state as one surface.
- [Dock](https://uiarc.dev/components/dock/markdown): A floating tool dock with a gliding label, a springy selection, and trays that grow out of it.
- [Liquid tab bar](https://uiarc.dev/components/liquid-tab-bar/markdown): Tabs with a lens selection that slides between them, swaps labels cleanly, and fills in icons as it passes.
- [Orbit menu](https://uiarc.dev/components/orbit-menu/markdown): Hold a button and its actions orbit out, ready to pick with a drag.

## Guidance for AI tools

Share sheet: A Share button that opens into a panel with copy link, access level, channels, and people to send to. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
