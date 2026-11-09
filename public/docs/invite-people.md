# Invite people

> Invite teammates with roles, bulk paste validation, a seat meter, and avatars that fly into a pending list.

- Type: Block
- Page: https://uiarc.dev/components/blocks/invite-people
- Markdown: https://uiarc.dev/components/blocks/invite-people/markdown

- Access: Arc Pro
- Registry id: `invite-people`
- Source file: `registry/blocks/invite-people/invite-people.tsx`
- Built from: Motion
- Keywords: react invite people, invite teammates form, email chip input, workspace invite, seat limit meter, invite by email, team invite with roles, paste email list

Use this as a starting point and replace the sample data with your own.

## When to use

- Inviting several people at once by name or email, with a role for each.
- Plans with a seat limit where people should see the effect of an invite before sending.
- Flows where users paste a messy list from a spreadsheet and need clear per-entry errors.

## When not to use

- Use team-members to manage people who already joined.
- Use roles-permissions to edit what each role can do.
- Use tag-input for a plain chip field without a directory, roles, or seats.

## Installation

Invite people is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/invite-people
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { InvitePeople } from "@/components/arc/blocks/invite-people/invite-people";

export function InviteDialogBody() {
  return <InvitePeople />;
}
```

## API reference

### InvitePeople

A workspace invite form. People are picked from a directory or typed and pasted as emails, each gets a role, and a seat meter tracks members, pending invites, and the new selection against the plan limit. Sending, joining, resending, revoking, and upgrading are simulated. Also the default export.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow Down / Arrow Up | Moves through the suggestion list, skipping people already on the team or invited. |
| Enter | Adds the highlighted suggestion, or turns the typed text into a chip. |
| , / ; | Commits the typed text as a chip. |
| Backspace | In an empty field, the first press marks the last chip and the second removes it. |
| Escape | Closes the suggestion list, then clears the typed text. |
| Arrow Down (role button) | Opens the role menu for that chip. |
| Arrow Up / Down, Home / End, Escape | Move through and close the role menu; Escape returns focus to the role button. |

## Accessibility

- The field is a combobox with aria-expanded, aria-controls, and aria-activedescendant pointing into a role="listbox" of options; blocked options are aria-disabled.
- Role menus are role="menu" with menuitemradio items and aria-checked.
- The seat bar is a role="meter" with aria-valuetext such as "12 of 10 seats, 2 over the limit".
- Send stays focusable with aria-disabled while blocked and points aria-describedby at the error list or the seat summary.
- Every add, remove, send, join, and revoke is announced in a polite live region.

## Motion

- Avatars share layoutIds, so a person flies from the suggestion into a chip, from the chip into the pending list, and from the row into the team stack when they join.
- Invalid chips shake when you try to send; the over-limit notice shakes on the same attempt.
- Labels that change length resize on a spring and crossfade their text; the field height springs as chips wrap.
- Reduced motion (MotionConfig reducedMotion="user" plus a hydrated flag) removes shakes, offsets, and layout travel and sets durations to zero.

## Responsive behavior

- The card is at most 600px wide and is a size container. Below 440px pending rows move the status under the name and suggestions hide their title column.
- Below 480px viewport width the padding drops to 16px and the corner radius shrinks.
- The role menu is positioned inside the block and clamped 8px from its edges.

## Performance

- AutoWidth and AutoHeight use one ResizeObserver each to spring sizes; there is no per-frame loop.
- Suggestions filter the in-memory directory on every keystroke and show at most five. For a large directory, search on the server and debounce.
- All simulated timers are tracked and cleared on unmount and on reset.

## Notes for AI

- Use for inviting teammates to a workspace with per-person roles and a seat limit.
- Replace DIRECTORY, TEAM, INVITED, PLANS, and ROLES in invite-people-data.ts with your own data. parseToken and splitList handle names, bare emails, and "Name <email>" from pasted lists.
- There are no props or callbacks. Wire the send, resend, revoke, and upgrade functions in the component to your API; the timers there only simulate delivery and one accepted invite.
- Error chips explain each bad entry in plain words; clicking one moves its text back into the field for editing.

## Related

- [Team members](https://uiarc.dev/components/blocks/team-members/markdown): A members list where typed emails turn into chips and fly into pending invites as seats roll.
- [Roles and permissions](https://uiarc.dev/components/blocks/roles-permissions/markdown): A permissions matrix with group toggles that ripple, role duplication and a review bar.
- [Tag input](https://uiarc.dev/components/tag-input/markdown): Turn short text values into removable tags.
- [Multi-select](https://uiarc.dev/components/multi-select/markdown): Select several values while keeping the field readable.
- [Avatar group](https://uiarc.dev/components/avatar-group/markdown): Show a team or set of contributors in a small space.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
