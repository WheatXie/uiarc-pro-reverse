# API keys

> API key management where Create key unfolds into its form and each secret is shown once.

- Type: Block
- Page: https://uiarc.dev/components/blocks/api-keys
- Markdown: https://uiarc.dev/components/blocks/api-keys/markdown

- Access: Arc Pro
- Registry id: `api-keys`
- Source file: `registry/blocks/api-keys/api-keys.tsx`
- Built from: Hold to confirm, Copy button, Input, Segmented control, Checkbox, Badge, Avatar, Button
- Keywords: react api keys, api key management, developer settings, create api key, revoke api key, secret reveal, token management

Use this on the developer settings page of an API product. Create keys on your server, pass the one-time secret to the reveal step, and connect Hold to revoke to your key revocation endpoint; every key in the preview is simulated.

## When to use

- The developer settings page of an API product.
- Key management with scopes, environments, and a one-time secret reveal.
- Revoking keys where a stray click must not fire.

## When not to use

- Use webhooks for event endpoints and signing secrets.
- Use integrations for OAuth connections to other apps.
- Use roles-permissions for user access.

## Installation

API keys is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/api-keys
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ApiKeys } from "@/components/arc/blocks/api-keys/api-keys";

export default function DeveloperSettings() {
  return (
    <main>
      <ApiKeys />
    </main>
  );
}
```

## API reference

### ApiKeys

API key management where Create key unfolds into a form with scopes and environment, each new secret is shown once, and keys revoke with hold to confirm. Keys and secrets are simulated.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Escape | Closes the create key form and returns focus to its button. |

## Accessibility

- Each key opens a labelled role="region" detail panel.
- Revoke uses hold to confirm, so it cannot fire from a stray click.
- Creation, copy, and revoke results are announced in a polite status region.

## Motion

- The Create key button unfolds into its form, and new keys slide into the list.
- Reduced motion replaces the unfold with an instant swap.

## Responsive behavior

- Below 700px container width key rows stack scopes and dates under the name; below 540px detail facts go single column.
- The create form drops to one column below 560px of its own width.

## Performance

- Key rows are not virtualized, which suits the handful of keys most accounts have.
- A ResizeObserver drives the create button's unfold into the form.

## Notes for AI

- Use on the developer settings page of an API product.
- Create keys on your server and pass the one-time secret to the reveal step; never store it client side.
- Connect hold to revoke to your revocation endpoint. Composes Arc hold-to-confirm, copy-button, input, segmented-control, checkbox, badge, avatar, and button.

## Related

- [Webhooks](https://uiarc.dev/components/blocks/webhooks/markdown): A webhooks console with delivery history, a payload inspector and retries that roll the rate.
- [Integrations](https://uiarc.dev/components/blocks/integrations/markdown): An integrations directory where Connect morphs to Connected and the filters recount as you go.
- [Hold to confirm](https://uiarc.dev/components/hold-to-confirm/markdown): Confirm a destructive action by holding, not tapping.
- [Copy button](https://uiarc.dev/components/copy-button/markdown): Copy a value with immediate confirmation.
- [Roles and permissions](https://uiarc.dev/components/blocks/roles-permissions/markdown): A permissions matrix with group toggles that ripple, role duplication and a review bar.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
