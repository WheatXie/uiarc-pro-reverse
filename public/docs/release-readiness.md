# Release readiness

> A launch checklist that keeps prerequisites, progress, and the final action together.

- Type: Block
- Page: https://uiarc.dev/components/blocks/release-readiness
- Markdown: https://uiarc.dev/components/blocks/release-readiness/markdown

- Access: Arc Pro
- Registry id: `release-readiness`
- Source file: `registry/blocks/release-readiness/release-readiness.tsx`
- Built from: Checkbox, Progress, Switch, Button, Avatar
- Keywords: react release checklist, launch readiness, pre release checklist, deploy gate, checklist with progress bar, handoff checklist

Use this before a release or handoff. Replace the sample checklist and completion callback with your product data.

## When to use

- A pre-launch or handoff gate where several checks must be done before one action unlocks.
- Release or launch checklists with a readiness bar and owners.
- Handoffs that should optionally notify people when the action runs.

## When not to use

- Use onboarding-checklist for a user's own getting-started tasks.

## Installation

Release readiness is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/release-readiness
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ReleaseReadiness } from "@/components/arc/blocks/release-readiness/release-readiness";

export function ReleasePanel() {
  return <ReleaseReadiness onRelease={() => startRelease("2.4")} />;
}
```

## API reference

### ReleaseReadiness

A release checklist with a readiness bar, a notify switch, and a release action that unlocks once every check is done. The four checks are sample data defined in the file.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `onRelease` | `() => void \| Promise<void>` | – | Called when the release button is pressed. Awaited; a thrown error shows an inline alert. |

## Accessibility

- The completed count lives in an aria-live="polite" region.
- Success is announced with role="status" and failures with role="alert".
- Checks use the library Checkbox, so each has a real label.

## Motion

- The completed count swaps with a 5px rise and fade.
- Reduced motion sets the transition duration to zero.

## Responsive behavior

- Below 700px the summary narrows to a tighter two-column header.
- Below 520px the summary and the two-column task grid collapse to one column, and actions stack.

## Performance

- Four checkboxes and one progress bar; state updates are local and cheap.
- The task list is a plain array with no virtualization, which is fine for a checklist of this size.

## Notes for AI

- Use for a pre-launch or handoff gate where several conditions must be true before one action.
- Replace the tasks array, initialChecks, and the hard-coded release name and avatars.
- Wire onRelease to your deploy or handoff call.
- Composes Arc Avatar, Button, Checkbox, Progress, and Switch.

## Related

- [Onboarding checklist](https://uiarc.dev/components/onboarding-checklist/markdown): Guide a new workspace through setup, one step at a time.
- [Progress](https://uiarc.dev/components/progress/markdown): Show how much of a known task is complete.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
