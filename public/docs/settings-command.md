# Settings command

> Workspace settings where a search field grows into a palette that flies you to any setting.

- Type: Block
- Page: https://uiarc.dev/components/blocks/settings-command
- Markdown: https://uiarc.dev/components/blocks/settings-command/markdown

- Access: Arc Pro
- Registry id: `settings-command`
- Source file: `registry/blocks/settings-command/settings-command.tsx`
- Built from: Switch, Segmented control, Animated counter, Text morph, Button
- Keywords: settings, preferences, search settings, command palette, jump to setting, unsaved changes, save bar, sticky nav, scroll spy, admin settings

Use this for app or workspace settings with many options. Describe your settings in the data file, load saved values from your API, and persist the changed ids through onSave; saving in the preview is simulated.

## When to use

- Workspace or account settings with several sections and many options.
- Admin consoles where support links people to a specific setting.
- Any settings page where people ask where something lives.

## When not to use

- Use settings-page for a short, paged profile form with a few fields per section.
- Use command-palette for app wide navigation and actions, not just settings.
- Avoid it for a single form; a plain form with a submit button is clearer.

## Installation

Settings command is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/settings-command
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { SettingsCommand } from "@/components/arc/blocks/settings-command/settings-command";
import { settingDefinitions, settingsSections } from "@/components/arc/blocks/settings-command/settings-command-data";

export function WorkspaceSettings({ saved }: { saved: Record<string, string | boolean> }) {
  return (
    <SettingsCommand
      sections={settingsSections}
      settings={settingDefinitions}
      defaultValues={saved}
      onSave={async (values, changed) => {
        await fetch("/api/workspace/settings", { method: "PATCH", body: JSON.stringify(Object.fromEntries(changed.map(id => [id, values[id]]))) });
      }}
    />
  );
}
```

## API reference

### SettingsCommand

Workspace settings on one scrolling page with a sticky section nav, a search field that grows into a command palette, and an unsaved changes bar. Picking a result flies the palette into the matching row, scrolls it into view, and the row breathes twice.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `sections` | `SettingsSection[]` | `settingsSections` | Sections in page order: id, label, and a one line description. |
| `settings` | `SettingDefinition[]` | `settingDefinitions` | Every setting: id, section, label, description, kind (switch, segmented, select, text), options, keywords for search, placeholder, and prefix. |
| `defaultValues` | `Record<string, string \| boolean>` | `savedSettings` | Saved values keyed by setting id. Edits are compared against these to count unsaved changes. |
| `suggested` | `string[]` | `suggestedSettingIds` | Setting ids listed in the palette before anything is typed. |
| `onSave` | `(values, changedIds) => Promise<void> \| void` | – | Persists the draft. Resolve to confirm; reject to keep the bar open with Retry. Without it the save is simulated. |
| `onValuesChange` | `(values) => void` | – | Called on every edit with the full draft. |
| `title` | `string` | `"Settings"` | Heading beside the search field. |
| `className` | `string` | – | Class on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Command K / Control K / slash | Opens the settings search while focus is inside the block. |
| Arrow up / Arrow down | Moves through results. The input keeps focus; the active result is announced through aria-activedescendant. |
| Enter | Jumps to the active result and moves focus to its control. |
| Escape | Closes the palette back into the search field and returns focus to it. |
| Tab | Moves through section nav, controls, and the Save and Discard buttons. |

## Accessibility

- The palette is a modal dialog with a combobox input and a listbox of options; the scrim closes it on press.
- Each row labels its control with the setting label and describes it with the hint and any validation error.
- Edited rows and sections carry a dot plus visually hidden Edited text, so the state never relies on color.
- A polite status region announces jumps, saves, discards, and validation problems.
- Invalid fields block saving; Save jumps to the first invalid row the same way search does.

## Motion

- The search field grows into the palette: position, size, and corner radius ride one spring, and results are revealed by the growing edge instead of reflowing.
- Picking a result flies the palette into the target row while the page scrolls, then the row's wash swells and settles twice.
- The section nav highlight glides to whichever section is in view as you scroll.
- The unsaved changes bar grows out of a small puck, rolls its count, and shrinks into Settings saved.
- Reduced motion swaps flights for fades, scrolls instantly, and keeps a single soft pulse.

## Responsive behavior

- Below 720px the section nav becomes a scrolling row above the content.
- Below 480px select and segmented rows stack their control under the label; switches stay inline.
- The palette always fits the frame with a 12px margin and drops its hint row on phones.

## Performance

- Search is a synchronous filter over the settings array; it stays instant for a few hundred settings.
- Scroll spy is throttled to one read per animation frame.
- The palette and save bar animate transform, size, and opacity of a single element each.

## Notes for AI

- Choose it when a product has more than about 15 settings and people search for them by name.
- Add keywords for the words people actually type, such as 2fa, sso, dark mode, or invoice.
- Keep the data file as the single schema: the palette, nav, and rows all read from it.
- Send only the changed ids to your API through onSave and reject on failure so the bar offers Retry.

## Related

- [Settings page](https://uiarc.dev/components/blocks/settings-page/markdown): Account settings with a gliding section nav and a save bar that morphs in as you edit.
- [Command palette](https://uiarc.dev/components/blocks/command-palette/markdown): A complete keyboard driven action surface with search, grouped results, and shortcuts.
- [Security settings](https://uiarc.dev/components/blocks/security-settings/markdown): An account security page with guided two-factor setup, password change and active sessions.
- [Switch](https://uiarc.dev/components/switch/markdown): A tactile toggle for settings that take effect immediately.
- [Segmented control](https://uiarc.dev/components/segmented-control/markdown): Switch between a small set of related views.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
