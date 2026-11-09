# Integrations

> An integrations directory where Connect morphs to Connected and the filters recount as you go.

- Type: Block
- Page: https://uiarc.dev/components/blocks/integrations
- Markdown: https://uiarc.dev/components/blocks/integrations/markdown

- Access: Arc Pro
- Registry id: `integrations`
- Source file: `registry/blocks/integrations/integrations.tsx`
- Built from: Search field, Drawer, Select, Hold to confirm, Avatar, Button
- Keywords: react integrations page, app marketplace, connect apps ui, integrations directory, oauth connect button, third party integrations

Use this on a settings or marketplace page. Load integrations and connection state from your API, start each provider's OAuth flow from Connect, and save sync frequency and Disconnect through it; every connection in the preview is simulated.

## When to use

- Settings or marketplace pages for third party connections.
- Directories with search, category filters, and Connect buttons.
- Connections that need sync settings and a safe disconnect.

## When not to use

- Use webhooks for outgoing event endpoints.
- Use api-keys for developer credentials.

## Installation

Integrations is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/integrations
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { Integrations } from "@/components/arc/blocks/integrations/integrations";

export default function IntegrationsPage() {
  return (
    <main>
      <Integrations />
    </main>
  );
}
```

## API reference

### Integrations

An integrations directory with search, category filters, Connect buttons that morph to Connected, and a drawer for sync settings and hold to disconnect. Providers and connections are simulated.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys, Home / End | Move between filter options. |

## Accessibility

- Filters are a role="radiogroup" of role="radio" buttons with aria-checked and roving arrow keys.
- Filter results and connection changes are announced in a polite status region.
- Disconnect uses hold to confirm, so it cannot fire from a stray click.

## Motion

- Connect morphs into a Connected state and filter counts recount as you go.
- Cards reflow with layout animation when filtering.
- Reduced motion swaps morphs and reflow for instant changes.

## Responsive behavior

- Below 720px container width the search goes full width under the title.
- Below 480px the filters become one horizontally scrolling row instead of wrapping.
- Settings open in a drawer, which goes nearly full width on phones.

## Performance

- Cards reflow with layout animation when filtering; the grid is not virtualized.
- ResizeObservers drive the filter indicator and height morphs.

## Notes for AI

- Use on a settings or marketplace page for third party connections.
- Load integrations and connection state from your API, start each provider's OAuth flow from Connect, and save sync frequency and Disconnect through it.
- Composes Arc search-field, drawer, select, hold-to-confirm, avatar, and button.

## Related

- [Webhooks](https://uiarc.dev/components/blocks/webhooks/markdown): A webhooks console with delivery history, a payload inspector and retries that roll the rate.
- [API keys](https://uiarc.dev/components/blocks/api-keys/markdown): API key management where Create key unfolds into its form and each secret is shown once.
- [Drawer](https://uiarc.dev/components/drawer/markdown): A temporary side surface for focused work.
- [Hold to confirm](https://uiarc.dev/components/hold-to-confirm/markdown): Confirm a destructive action by holding, not tapping.
- [Search field](https://uiarc.dev/components/search-field/markdown): A recognizable search entry point with clear affordances.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
