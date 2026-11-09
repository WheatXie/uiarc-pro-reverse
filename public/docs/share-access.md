# Share access

> A share panel: invite people as validated email chips with suggestions, change roles from a compact menu, remove with undo, switch link access and copy the link, with every change landing in place.

- Type: Component (disclosure)
- Access: Arc Pro
- Page: https://uiarc.dev/components/share-access
- Markdown: https://uiarc.dev/components/share-access/markdown
- Source file: `registry/components/share-access/share-access.tsx`
- Dependencies: motion, lucide-react, @radix-ui/react-dropdown-menu
- Keywords: overlay, sharing, permissions, new, share, access, invite, email chips, roles, can edit, can view, link sharing, copy link, collaborators, google docs share, popover

## When to use

- A Share button on a document, board or project that controls who can open it and what they can do.
- Inviting teammates by email with suggestions from a workspace directory.
- Managing link sharing next to per person access in one place.

## When not to use

- Use the invite-people block for inviting people to a whole workspace with seats and plans.
- Use copy-button alone when there is only a public link to share.
- Use a full settings page with a data table for organisations with hundreds of members and groups.

## Installation

Share access is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/share-access
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import * as Popover from "@radix-ui/react-popover";
import { ShareAccess } from "@/components/arc/share-access/share-access";

export function ShareButton({ doc }: { doc: Doc }) {
  const [open, setOpen] = useState(false);
  const { data: members, mutate } = useMembers(doc.id);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger>Share</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8}>
          <ShareAccess
            title={doc.title}
            members={members}
            onMembersChange={next => mutate(api.setMembers(doc.id, next), { optimisticData: next })}
            directory={workspace.people}
            link={doc.url}
            selfId={me.id}
            onInvite={(people, role) => api.invite(doc.id, people, role)}
            onDone={() => setOpen(false)}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

## API reference

### ShareAccess

A share panel for a document, board or project. Type names or emails and they become chips: people from your directory show their photo, and an address that is not valid turns red with a message under the field. Suggestions with avatars appear as you type. Pick the role for the invite and send; the new people slide into the list with a brief highlight. Each person's role changes from a compact menu whose label morphs to its new width, Remove access folds the row away with an undo, general access switches between restricted and anyone with the link, and Copy link confirms in place without changing width.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | `"Q3 launch plan"` | Name of what is being shared, used in the heading Share “title” and the accessible name. |
| `members` | `readonly ShareAccessMember[]` | – | People with access: { id, email, name?, src?, role: "owner" \| "editor" \| "commenter" \| "viewer", pending? }. Pass with onMembersChange to control the list. |
| `defaultMembers` | `readonly ShareAccessMember[]` | `[]` | Initial members when uncontrolled. |
| `onMembersChange` | `(members: ShareAccessMember[]) => void` | – | Called with the new list after an invite, a role change, a removal or an undo. |
| `access` | `"restricted" \| "link"` | – | Who can open it without an invite. Pass with onAccessChange to control it. |
| `defaultAccess` | `"restricted" \| "link"` | `"restricted"` | Initial general access when uncontrolled. |
| `onAccessChange` | `(access: ShareGeneralAccess) => void` | – | Called when general access changes. |
| `linkRole` | `"viewer" \| "commenter" \| "editor"` | – | What anyone with the link can do. Its menu slides in beside general access when the link is open. |
| `defaultLinkRole` | `ShareRole` | `"viewer"` | Initial link role when uncontrolled. |
| `onLinkRoleChange` | `(role: ShareRole) => void` | – | Called when the link role changes. |
| `directory` | `readonly ShareAccessContact[]` | `[]` | People to suggest while typing: { email, name?, src? }. Matches the start of any name part or the email; people who already have access or are already chips are left out. Typing a directory name exactly also resolves to that person. |
| `link` | `string` | – | The link Copy link puts on the clipboard. |
| `selfId` | `string` | – | Id of the member using the app, marked (you). |
| `defaultInviteRole` | `ShareRole` | `"editor"` | Role preselected for new invites. |
| `onInvite` | `(people: ShareAccessContact[], role: ShareRole) => void \| Promise<void>` | – | Called with the valid chips and role when Invite is pressed. Return a promise to show Sending; if it rejects, the chips stay and a message explains it. Once it resolves the people join the list as pending. |
| `onCopyLink` | `(link: string) => void` | – | Called after the link is on the clipboard. |
| `onDone` | `() => void` | – | Shows a Done button that calls this, for example to close the popover. |
| `className` | `string` | – | Class on the panel. |
| `style` | `CSSProperties` | – | Inline styles on the panel. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Type, then Enter | Adds the highlighted suggestion, or turns what you typed into a chip. With chips and nothing typed, Enter sends the invite. |
| Comma / Semicolon / Tab | Turns what you typed into a chip. Space does too once the text contains an @. |
| Arrow Down / Arrow Up | Moves through suggestions. |
| Backspace | In an empty field, the first press marks the last chip and the second removes it. |
| Escape | Clears the text and closes suggestions; in a menu, closes the menu and returns focus to its trigger. |
| Enter / Space on a role | Opens the role menu; arrows move, Enter picks, and typing a letter jumps to an option. |

## Accessibility

- The panel is a section named Share “title”. The field is a combobox with a listbox of suggestions, aria-activedescendant for the highlighted one and aria-expanded.
- An invalid address sets aria-invalid, is marked with an icon as well as color, and its message is linked with aria-describedby.
- Each chip has a Remove button named with the person. Each role trigger is named with the person and the current role, such as Role for Nathan Cole: Can edit.
- Role and access menus are Radix dropdown menus with radio items, so the current choice is announced as checked and focus returns to the trigger.
- Adding and removing chips, invites, role changes, removals, undo, access changes and copying are announced in a polite live region.
- Copy link keeps its width across Copy link, Link copied and Couldn’t copy, and the failure state pairs an icon with text.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring. Hovered and focused triggers and rows take a muted background.

## Motion

- Chips pop in from 80 percent scale on the snappy spring and the field reflows around them with layout transforms, so the caret slides to its new spot.
- Suggestions open under the field with a short scale and fade, and the highlight slides between rows as a shared layout element.
- The error line and the invite row expand and collapse in height on the smooth spring, which never overshoots.
- New people expand into the list with a brief accent tint that fades over a second. A removed row folds its height to zero while the rows below slide up, and the undo bar slides in beneath.
- Role labels crossfade vertically while the trigger's width follows the new label on the morph spring, so the chevron glides instead of jumping. The count of people rolls.
- The lock turns into a globe with a small rotation, the description rolls to its new line and the link role menu slides in from the right without moving anything else.
- Copy link swaps to a check and Link copied in place, then back after 1.8 seconds.
- With reduced motion all of it applies at once: no pops, rolls, slides or height animation.

## Responsive behavior

- The panel is up to 440px wide and fills narrower containers. At 420px and below padding tightens and the link role moves under the general access line.
- Long names and emails truncate with an ellipsis in rows and chips; the full value is in the accessible name.
- Chips wrap onto new lines inside the field as it grows; menus stay inside the viewport with collision padding.

## Performance

- Everything that moves is a transform or opacity except row and message heights, which animate only when they appear or leave.
- Suggestions filter a directory array in memory; for very large directories, pass a pre filtered directory from your search.
- Menus mount only while open.

## Notes for AI

- Use it as the content of a share popover or dialog for any object with per person access: documents, boards, projects, folders.
- Control members and persist every change; the component emits the whole next list. Use optimistic updates so rows land instantly.
- Return a promise from onInvite for the server call. Reject it to keep the chips so the person can retry.
- Pass directory from your workspace so people are suggested with photos. Anyone else can still be invited by email.
- Owner rows cannot be changed or removed. Map any other permission scheme to the three roles or fork ROLES in the source.
- The panel draws its own floating surface; when placing it inside a popover primitive, keep that popover's content unstyled.

## Related

- [Popover](https://uiarc.dev/components/popover/markdown): A small anchored surface for contextual information.
- [Tag input](https://uiarc.dev/components/tag-input/markdown): Turn short text values into removable tags.
- [Dropdown menu](https://uiarc.dev/components/dropdown-menu/markdown): A focused list of actions anchored to a trigger.
- [Copy button](https://uiarc.dev/components/copy-button/markdown): Copy a value with immediate confirmation.
- [Presence stack](https://uiarc.dev/components/presence-stack/markdown): Avatars of the people here now: joins pop in as the stack reflows, a counter rolls past the limit, dots show typing and idle, and hover fans it out with a gliding name label.
- [Combobox](https://uiarc.dev/components/combobox/markdown): Search and select from a list without leaving the field.

## Also in overlays

- [Dialog](https://uiarc.dev/components/dialog/markdown): A focused surface for decisions that need attention.
- [Drawer](https://uiarc.dev/components/drawer/markdown): A temporary side surface for focused work.
- [Bottom sheet](https://uiarc.dev/components/bottom-sheet/markdown): A sheet that rests at a peek or full height and follows your finger.
- [Hover card](https://uiarc.dev/components/hover-card/markdown): Preview a person or link on hover or focus without leaving the page.
- [Tooltip](https://uiarc.dev/components/tooltip/markdown): Short supporting text for unfamiliar controls.
- [Confirm popover](https://uiarc.dev/components/confirm-popover/markdown): A destructive button that grows into a small confirmation card, with the consequence, optional type-to-confirm, progress on the Confirm button, and a check or error before folding back.

## Guidance for AI tools

Share access: A share panel: invite people as validated email chips with suggestions, change roles from a compact menu, remove with undo, switch link access and copy the link, with every change landing in place. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
