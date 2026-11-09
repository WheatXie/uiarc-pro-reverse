# Settings page

> Account settings with a gliding section nav and a save bar that morphs in as you edit.

- Type: Block
- Page: https://uiarc.dev/components/blocks/settings-page
- Markdown: https://uiarc.dev/components/blocks/settings-page/markdown

- Access: Arc Pro
- Registry id: `settings-page`
- Source file: `registry/blocks/settings-page/settings-page.tsx`
- Built from: Input, Select, Switch, Segmented control, Avatar, Animated counter, Text morph, Button
- Keywords: react settings page, account settings, settings form, unsaved changes bar, profile settings ui, save bar

Use this for account or workspace settings. Load values from your user API, send the changed fields on save, and upload the photo file to your storage; saving in the preview is simulated.

## When to use

- Account or workspace settings with several sections.
- Forms that should show a save bar only when something changed.
- Settings where Cmd or Ctrl+S should save.

## When not to use

- Use security-settings for sessions, two factor, and passwords.
- Use billing-overview for plan and invoice management.
- Use team-members for inviting and managing people.

## Installation

Settings page is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/settings-page
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { SettingsPage } from "@/components/arc/blocks/settings-page/settings-page";

export default function AccountSettings() {
  return (
    <main>
      <SettingsPage />
    </main>
  );
}
```

## API reference

### SettingsPage

Account settings with profile, notifications, security, and billing sections, a gliding section nav, and a save bar that appears when fields change. Values and saving are simulated.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys | Move between sections in the section nav. |
| Home / End | Jump to the first or last section. |
| Cmd/Ctrl+S | Saves pending changes. |

## Accessibility

- The root is a labelled section, and the section nav supports roving arrow key focus.
- Form fields use Arc input, select, and switch with visible labels.
- The save bar counts changed fields and announces saves and reverts.

## Motion

- The active section indicator glides between nav items.
- The save bar morphs in as you edit and its changed count rolls.
- Reduced motion removes the glide and morph.

## Responsive behavior

- Below 720px container width the section nav becomes a horizontal scrolling row above the form and fields drop to one column.
- Below 460px and 360px the save bar hides secondary text and the profile header stacks.

## Performance

- The form scrolls inside a fixed-height pane; a ResizeObserver keeps the nav indicator aligned.
- Only the save bar count and indicator animate; fields are plain controlled inputs.

## Notes for AI

- Use for account or workspace settings.
- Replace the initial values with data from your user API, send only changed fields on save, and upload the photo file to your storage.
- Composes Arc input, select, switch, segmented-control, avatar, animated-counter, text-morph, and button.

## Related

- [Security settings](https://uiarc.dev/components/blocks/security-settings/markdown): An account security page with guided two-factor setup, password change and active sessions.
- [Billing overview](https://uiarc.dev/components/blocks/billing-overview/markdown): A billing page where the plan card morphs into a picker and usage, invoices, and card follow.
- [Team members](https://uiarc.dev/components/blocks/team-members/markdown): A members list where typed emails turn into chips and fly into pending invites as seats roll.
- [API keys](https://uiarc.dev/components/blocks/api-keys/markdown): API key management where Create key unfolds into its form and each secret is shown once.
- [Switch](https://uiarc.dev/components/switch/markdown): A tactile toggle for settings that take effect immediately.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
