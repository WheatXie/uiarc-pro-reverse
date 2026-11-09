# Team members

> A members list where typed emails turn into chips and fly into pending invites as seats roll.

- Type: Block
- Page: https://uiarc.dev/components/blocks/team-members
- Markdown: https://uiarc.dev/components/blocks/team-members/markdown

- Access: Arc Pro
- Registry id: `team-members`
- Source file: `registry/blocks/team-members/team-members.tsx`
- Built from: Avatar, Button, Search field, Text morph, Animated counter
- Keywords: react team members, invite team members, member management, user roles table, invite by email, seat management, workspace members

Use this on the team or workspace settings page of a SaaS app. Load members, invites, and seat limits from your API and connect role changes, Send invite, Resend, Revoke, and Remove to it; every invite and removal in the preview is simulated.

## When to use

- The team or workspace settings page of a SaaS app.
- Inviting several people at once by typing or pasting emails.
- Member lists with roles, pending invites, and seat counts.

## When not to use

- Use team-directory for a browsable people directory.
- Use roles-permissions to define what each role can do.
- Use tag-input for a general chip input outside invites.

## Installation

Team members is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/team-members
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { TeamMembers } from "@/components/arc/blocks/team-members/team-members";

export default function TeamSettings() {
  return (
    <main>
      <TeamMembers />
    </main>
  );
}
```

## API reference

### TeamMembers

A members list with an invite field that turns typed emails into chips, pending invites, role selects, seat counts, and confirm to remove. Members, invites, and seats are simulated.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter | Turns the typed email into a chip, or sends invites when the field is empty. |
| , / ; / Space | Commits the typed email as a chip. |
| Backspace | Removes the last chip when the field is empty. |
| Escape | Cancels a pending member removal. |

## Accessibility

- Role selects use Radix select with full keyboard support.
- Invite validation messages sit in a polite live region, and actions are announced in a status region.

## Motion

- Email chips fly into the pending invites list and the seat count rolls.
- Rows enter and leave with layout animation.
- Reduced motion makes the flight and reflow instant.

## Responsive behavior

- Below 600px container width the header and invite row stack and the search goes full width.
- Below 420px each member row splits into the identity on top and last active, role, and remove underneath.

## Performance

- Member rows are not virtualized; add paging for large organizations.
- Rows enter and leave with layout animation, and a ResizeObserver drives the height morph.

## Notes for AI

- Use on the team or workspace settings page of a SaaS app.
- Load members, invites, and seat limits from your API and connect role changes, Send invite, Resend, Revoke, and Remove to it.
- Composes Arc avatar, button, search-field, text-morph, and animated-counter.

## Related

- [Team directory](https://uiarc.dev/components/blocks/team-directory/markdown): Searchable people, team filters, and a focused profile panel.
- [Roles and permissions](https://uiarc.dev/components/blocks/roles-permissions/markdown): A permissions matrix with group toggles that ripple, role duplication and a review bar.
- [Tag input](https://uiarc.dev/components/tag-input/markdown): Turn short text values into removable tags.
- [Settings page](https://uiarc.dev/components/blocks/settings-page/markdown): Account settings with a gliding section nav and a save bar that morphs in as you edit.
- [Avatar](https://uiarc.dev/components/avatar/markdown): A compact identity marker for people and accounts.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
