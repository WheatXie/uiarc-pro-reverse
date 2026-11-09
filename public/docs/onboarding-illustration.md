# Onboarding illustration

> A compact onboarding card whose line illustration morphs from folder to files, team, and badge.

- Type: Block
- Page: https://uiarc.dev/components/blocks/onboarding-illustration
- Markdown: https://uiarc.dev/components/blocks/onboarding-illustration/markdown

- Access: Arc Pro
- Registry id: `onboarding-illustration`
- Source file: `registry/blocks/onboarding-illustration/onboarding-illustration.tsx`
- Keywords: react onboarding, onboarding modal, welcome dialog, first run experience, onboarding steps illustration, animated svg onboarding

Use this as a first-run dialog in a document product. Swap the copy for your own steps and send Get started to your workspace creation flow; the preview creates nothing.

## When to use

- A short first-run dialog in a document or workspace product.
- Onboarding with three or four steps that each need a simple picture.

## When not to use

- Use onboarding-checklist for tasks people complete over time.
- Use feature-illustration for a feature section on a marketing page.

## Installation

Onboarding illustration is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/onboarding-illustration
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { OnboardingIllustration } from "@/components/arc/blocks/onboarding-illustration/onboarding-illustration";

export function FirstRun() {
  return (
    <div role="dialog" aria-label="Welcome">
      <OnboardingIllustration />
    </div>
  );
}
```

## API reference

### OnboardingIllustration

A compact onboarding card whose line illustration morphs through four steps, with back and next buttons, step dots, and a Get started action. The copy is sample content and Get started creates nothing.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow Left / Right | Go to the previous or next step. |

## Accessibility

- The illustration is role="img" with a label describing the current scene.
- Step copy sits in a polite live region, so step changes are read out.
- Step dots are labelled buttons with aria-current on the active step.

## Motion

- The same line shapes morph between folder, files, team, and badge scenes on springs.
- Reduced motion jumps to each scene without the morph.

## Responsive behavior

- Below 440px padding tightens, the Back label becomes an icon, and the copy keeps a fixed minimum height so buttons do not jump.
- The illustration's pointer parallax runs only for a mouse on hover-capable devices.

## Performance

- The scenes are one inline SVG whose shapes morph on springs, with no images to load.

## Notes for AI

- Use as a first-run dialog in a document or workspace product.
- Swap the step copy and scene labels for your own, and route Get started to your workspace creation flow.
- Has no Arc component dependencies.

## Related

- [Onboarding checklist](https://uiarc.dev/components/onboarding-checklist/markdown): Guide a new workspace through setup, one step at a time.
- [Stepper](https://uiarc.dev/components/stepper/markdown): Show where a person is in a multi-step flow and what is done.
- [Empty states](https://uiarc.dev/components/blocks/empty-states/markdown): Four empty states in one illustration whose shapes morph between scenes as you switch tabs.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
