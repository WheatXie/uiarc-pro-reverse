# Environment variables

> An environment variables and secrets manager with masked values, per-environment scope toggles, .env paste import with duplicate and invalid key warnings, write-only sensitive values, an environment diff by fingerprint, and a redeploy banner.

- Type: Block
- Page: https://uiarc.dev/components/blocks/env-variables
- Markdown: https://uiarc.dev/components/blocks/env-variables/markdown

- Access: Arc Pro
- Registry id: `env-variables`
- Source file: `registry/blocks/env-variables/env-variables.tsx`
- Built from: Button, Checkbox, Copy button, Input, Search field, Segmented control, Select, Switch, Textarea
- Keywords: environment variables, env, dotenv, .env, secrets, config, configuration, vercel, netlify, deploy, redeploy, preview, production, development, sensitive, masked, diff, compare environments, developer settings

Render <EnvVariables /> for the demo, or pass variables, project and sampleDotenv with onChange to persist rows and onRedeploy (which can return a promise) to run a real deploy.

## When to use

- A settings screen where developers manage configuration and secrets across development, preview, and production.
- Onboarding a project by pasting an existing .env file and scoping it to environments in one step.
- Auditing drift between environments before a release, such as a key set in Preview but missing in Production.

## When not to use

- Use api-keys for creating, scoping, and revoking access tokens that your product issues to its users.
- Use a plain form for a handful of fixed settings that are not per environment.

## Installation

Environment variables is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/env-variables
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { EnvVariables } from "@/components/arc/blocks/env-variables/env-variables";

export function ProjectEnvironment({ project, variables }) {
  return (
    <EnvVariables
      project={project.slug}
      variables={variables}
      sampleDotenv=""
      onChange={rows => saveVariables(project.id, rows)}
      onRedeploy={environments => triggerRedeploy(project.id, environments)}
    />
  );
}
```

## API reference

### EnvVariables

An environment variables and secrets manager. Each row is one value and the environments it applies to, drawn as a matrix of Development, Preview, and Production toggles, so a key can hold a different value per environment. Values stay masked and are not in the DOM until revealed; sensitive values are write-only. Add one variable or paste a whole .env file, compare two environments by fingerprint, and redeploy from a banner that appears after changes.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `variables` | `EnvVariable[]` | `VARIABLES` | Rows in any order: { id, key, value, environments, sensitive, updated, updatedBy }. A key can appear on several rows as long as each environment is covered at most once. The block sorts rows by key. |
| `project` | `string` | `"northwind-storefront"` | Project name shown under the heading. |
| `sampleDotenv` | `string` | `SAMPLE_DOTENV` | Text the paste area starts with when Import .env opens. Pass an empty string for a blank paste area. |
| `title` | `string` | `"Environment variables"` | Heading text. |
| `onChange` | `(variables: EnvVariable[]) => void` | – | Called with every row after each add, import, edit, removal, scope toggle, or copy between environments. |
| `onRedeploy` | `(environments: EnvName[]) => void \| Promise<void>` | – | Called when Redeploy is pressed with the environments that changed. Return a promise to keep the banner pending until it settles; a rejection shows the failure state and keeps the changes queued. Without it, the deploy is simulated. |
| `className` | `string` | – | Class on the root section. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the header actions, search, view switch, and each row's reveal, copy, environment toggles, and edit button. |
| Enter / Space | Reveals or hides a value, turns an environment on or off for a row, opens the inline editor, or presses a button. |
| Escape | Closes the inline editor or the add panel and returns focus to the button that opened it. |
| Arrow keys | Move between options in the view switch, the add mode switch, and the compare environment selects. |
| Enter in a form | Saves the edited value, saves a new variable, or imports the parsed .env lines. |

## Accessibility

- Masked values render as bullets hidden from assistive technology plus a visually hidden "Hidden value" or "Sensitive value, write-only" label; the real value is only rendered after Reveal.
- Reveal and environment toggles are buttons with aria-pressed and names that include the key, such as "Production for DATABASE_URL".
- Each row's toggles sit in a labelled group; the wide matrix column heads are decorative and every toggle carries its own name.
- Inline errors (invalid key, key already set in an environment, empty value) are tied to their fields; scope conflicts appear as an alert under the row.
- A polite live region announces every change, import, removal, and redeploy result, and the .env parse summary updates live as you type.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring. Keyboard position shows as a fill on toggles and icon buttons, matching hover.

## Motion

- The redeploy banner, add panel, inline editor, and conflict notes open with height and opacity on the smooth spring and close with a quicker exit ease.
- Environment toggles fill with a snappy scale and draw their check with pathLength, both without overshoot.
- Revealing a value crossfades the mask and the value with a short rise in a fixed height slot, so the row never jumps.
- Added and removed rows grow and collapse their height so the list closes its gap; saved or imported rows glow once in the accent and fade.
- The Variables and Compare views crossfade with a small rise. Reduced motion removes all travel and lands every change at once.

## Responsive behavior

- From a 760px container, rows become a matrix: key, value, one toggle column per environment with a count of values set, and an edit action.
- Below that, each row stacks the key and edit action, then the value, then three labelled environment pills in an even grid.
- Below 560px header actions, search, form actions, and the redeploy button go full width; the .env preview drops the masked value column.
- Toggles, icon buttons, and the swap control grow to 44px targets on touch screens. The block is a container query, so it adapts to the space it is placed in.

## Performance

- The .env text is parsed in a memo keyed on the text, rows, and chosen environments; there is no per-frame work.
- Only revealed rows render their value and copy button, and only the open row renders an editor.
- Timers for notes, the saved glow, and the redeploy confirmation are cleared on change and unmount.

## Notes for AI

- Choose it for a project settings page in a hosting, deployment, or backend platform. Wire onChange to your store and onRedeploy to your deploy API.
- Search matches key names only, never values. Compare shows a six character fingerprint of each value, so two environments can be checked without exposing either.
- Sensitive rows are write-only: the editor starts empty and saving replaces the value; the flag cannot be turned off without removing and re-adding the variable.
- The .env parser handles comments, blank lines, export prefixes, quotes, and inline comments. Later duplicates win the key and earlier ones are skipped; keys that start with a number or contain other characters are rejected.

## Related

- [API keys](https://uiarc.dev/components/blocks/api-keys/markdown): API key management where Create key unfolds into its form and each secret is shown once.
- [Security settings](https://uiarc.dev/components/blocks/security-settings/markdown): An account security page with guided two-factor setup, password change and active sessions.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
