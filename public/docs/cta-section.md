# CTA section

> A call to action as a centered closing section, a split beside a setup card that completes itself, or a dismissible banner.

- Type: Block
- Page: https://uiarc.dev/components/blocks/cta-section
- Markdown: https://uiarc.dev/components/blocks/cta-section/markdown

- Access: Free, open source
- Registry id: `cta-section`
- Source file: `registry/blocks/cta-section/cta-section.tsx`
- Built from: Button, Segmented control
- Keywords: cta, call to action, cta section, banner, closing section, signup prompt, conversion, landing page

Use this to ask for a trial, demo or signup. Pass href or onClick to each action; edit sample copy in cta-section-data.ts. Buttons in the preview confirm in place.

## When to use

- The last section of a landing page, asking for a trial or demo.
- An in-page prompt beside a product visual that shows the outcome.
- A slim promotional banner above content.

## When not to use

- The first screen of a page. Use Hero section.
- Collecting an email. Use Newsletter signup.
- A persistent site-wide notice. Use Announcement bar.

## Installation

### CLI

Run one of these in a project set up with `shadcn init`:

```bash
npx shadcn@latest add @uiarc/cta-section
pnpm dlx shadcn@latest add @uiarc/cta-section
yarn dlx shadcn@latest add @uiarc/cta-section
bunx --bun shadcn@latest add @uiarc/cta-section
```

The `@uiarc` name needs `"registries": { "@uiarc": "https://uiarc.dev/r/{name}.json" }` in `components.json`. Without it, use the full URL:

```bash
npx shadcn@latest add https://uiarc.dev/r/cta-section.json
```

### Manual

1. Install the dependencies:

```bash
npm install motion lucide-react
```

2. Copy the source into your project. Main file: `registry/blocks/cta-section/cta-section.tsx`

   The source is in the registry item: https://uiarc.dev/r/cta-section.json

3. Arc imports use the `@/` alias for `registry/` and `lib/`. Keep the same folders or update the import paths.

## Usage

```tsx
import { CtaSection } from "@/components/arc/blocks/cta-section/cta-section";

export function Closing() {
  return (
    <CtaSection
      variant="split"
      title="Your team, set up before lunch"
      primaryAction={{ label: "Create a workspace", href: "/signup" }}
      secondaryAction={{ label: "Book a demo", href: "/demo" }}
      points={["Import from any tracker", "SSO included", "Cancel anytime"]}
    />
  );
}
```

## API reference

### CtaSection

A call to action in three shapes chosen by variant: a centered closing section, a split layout beside a product visual, and a compact dismissible banner.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `"centered" \| "split" \| "banner"` | `"centered"` | centered closes a page, split sits beside a setup card that completes itself, banner is one line with an action. |
| `title` | `string` | – | Heading. Each variant has sample copy. |
| `description` | `string` | – | One sentence under the heading. |
| `primaryAction` | `CtaAction` | – | { label, href?, onClick?, confirmedLabel? }. With href it renders a link; with neither href nor onClick it confirms in place. |
| `secondaryAction` | `CtaAction \| null` | – | Second action in centered and split. Pass null to hide it. |
| `note` | `string` | `"No credit card required"` | Small print under the actions in centered. |
| `faces` | `string[]` | – | Up to four avatar URLs beside the note in centered. Pass [] to hide them. |
| `points` | `string[]` | – | Benefit lines with checks in split. |
| `visual` | `ReactNode` | – | Replaces the split variant's setup card, for your own screenshot or component. |
| `onDismiss` | `() => void` | – | Banner only. Shows the dismiss button and is called after the banner has closed. |
| `className` | `string` | – | Extra class on the section. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the actions, then the dismiss button in the banner. |
| Enter or Space | Runs an action or dismisses the banner. |

## Accessibility

- Each variant is a section labelled by its heading.
- Actions with href are real links; others are buttons. Simulated confirmations announce politely.
- The dismiss button has the name "Dismiss"; the banner closes its gap so focus order stays clean.
- The setup card is aria-hidden: the copy beside it carries the message.

## Motion

- Primary actions lean their arrow forward on hover; buttons press to .97 and morph their width when the label changes.
- Split: the stage rises into view once, then the setup card ticks its three steps, fills its progress line, and slides in teammates' faces.
- Banner: dismissing fades it, scales it to .98, and springs its height closed so the page below moves up smoothly.
- Reduced motion shows the finished setup card and removes travel.

## Responsive behavior

- Split stacks copy above the visual below 860px container width.
- Below 560px actions go full width and stack, and the banner puts its text above the action and dismiss button.
- Headings scale with the container between 30px and 52px.

## Performance

- The setup card runs three timers once after it enters view; everything else is CSS transitions.
- No images except up to four small avatars.

## Notes for AI

- Use centered at the end of a landing page, split mid page next to a relevant product state, and banner at the top of an app or docs page.
- Pass href for real navigation. Leave both href and onClick out only for previews.
- One primary and at most one secondary action. Keep labels to two or three words with a verb.
- Edit cta-section-data.ts for the sample copy and the setup card content.

## Related

- [Hero section](https://uiarc.dev/components/blocks/hero-section/markdown): Three full screen SaaS heroes: a live dashboard rising from the bottom edge over a drifting mesh, a workflow graph that routes sample events node by node, and editorial type over a mesh gradient.
- [Newsletter signup](https://uiarc.dev/components/blocks/newsletter-signup/markdown): An email signup framed by a stack of past issues; subscribing drops the next issue, addressed to you, onto the front.
- [Announcement bar](https://uiarc.dev/components/announcement-bar/markdown): A top banner that rotates messages, counts down, and collapses smoothly when dismissed.
- [Pricing calculator](https://uiarc.dev/components/blocks/pricing-calculator/markdown): A seat slider and billing toggle drive plan cards with rolling prices and a moving recommended badge.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
