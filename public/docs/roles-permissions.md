# Roles and permissions

> A permissions matrix with group toggles that ripple, role duplication and a review bar.

- Type: Block
- Page: https://uiarc.dev/components/blocks/roles-permissions
- Markdown: https://uiarc.dev/components/blocks/roles-permissions/markdown

- Access: Arc Pro
- Registry id: `roles-permissions`
- Source file: `registry/blocks/roles-permissions/roles-permissions.tsx`
- Built from: Button, Animated counter, Text morph, Avatar group
- Keywords: react permissions matrix, roles and permissions ui, rbac settings, access control table, role editor, permission toggles

Use this on a workspace settings page to edit what each role can do. Load roles, permission groups and grants from your authorization API and connect Save to it; saving in the preview is simulated.

## When to use

- Workspace settings where admins edit what each role can do.
- Permission matrices with grouped permissions and a review step before saving.

## When not to use

- Use team-members to assign roles to people.
- Use switch rows in settings-page for a few on and off settings.
- Use security-settings for personal account security.

## Installation

Roles and permissions is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/roles-permissions
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { RolesPermissions } from "@/components/arc/blocks/roles-permissions/roles-permissions";

export default function WorkspaceRoles() {
  return (
    <section>
      <RolesPermissions />
    </section>
  );
}
```

## API reference

### RolesPermissions

A permissions matrix with role columns, collapsible permission groups, group toggles, role duplication and a review bar for unsaved changes. Takes no props; roles, groups, grants and members are inline constants (ROLES, GROUPS, GRANTED, MEMBERS) in roles-permissions.tsx, and saving is simulated.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys | Moves focus across the matrix, snapping to the nearest cell in the next row. |
| Home / End | Jumps to the first or last cell in the row. |
| Ctrl + Home / Ctrl + End | Jumps to the first or last cell in the grid. |

## Accessibility

- The matrix uses grid, row, rowheader and columnheader roles with a single tab stop.
- Cells are role="switch" or role="checkbox" buttons, group toggles report aria-checked="mixed", and locked owner cells use aria-disabled.
- A polite status region announces toggles and save progress.

## Motion

- Group toggles ripple across their permissions with a short stagger, and a column band follows the hovered role.
- Unsaved dots pop in and the review bar slides up while changes exist.
- Reduced motion removes the ripple and springs.

## Responsive behavior

- The matrix scrolls sideways with sticky permission labels, so role columns stay aligned on narrow screens.
- Below a 760px container the label column is 208px and role columns 88px; below 540px they shrink to 160px and 84px and group counts hide.
- The review bar stays sticky to the viewport while there are unsaved changes.

## Performance

- Every cell is a real control and rows are not virtualized; very large permission sets should stay collapsed by group.

## Notes for AI

- Use on a workspace settings page for editing what each role can do.
- Replace ROLES, GROUPS, GRANTED and MEMBERS in roles-permissions.tsx with data from your authorization API.
- Connect Save changes to your API; it only shows a simulated saved state.

## Related

- [Team members](https://uiarc.dev/components/blocks/team-members/markdown): A members list where typed emails turn into chips and fly into pending invites as seats roll.
- [Security settings](https://uiarc.dev/components/blocks/security-settings/markdown): An account security page with guided two-factor setup, password change and active sessions.
- [Settings page](https://uiarc.dev/components/blocks/settings-page/markdown): Account settings with a gliding section nav and a save bar that morphs in as you edit.
- [Switch](https://uiarc.dev/components/switch/markdown): A tactile toggle for settings that take effect immediately.
- [Avatar group](https://uiarc.dev/components/avatar-group/markdown): Show a team or set of contributors in a small space.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
