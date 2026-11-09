# Studio perspectives

> Portrait led editorial stories with a focused reading state.

- Type: Block
- Page: https://uiarc.dev/components/blocks/testimonial-stage
- Markdown: https://uiarc.dev/components/blocks/testimonial-stage/markdown

- Access: Arc Pro
- Registry id: `testimonial-stage`
- Source file: `registry/blocks/testimonial-stage/testimonial-stage.tsx`
- Built from: Avatar, Button, Motion
- Keywords: react testimonial section, testimonial slider, customer quotes, testimonials with photos, review showcase, quote carousel

Use this to introduce the people behind a product or team. Use verified quotes and portrait permissions for a public site.

## When to use

- Testimonials or editorial stories where the person's portrait matters.
- Landing sections that rotate through a few quotes on demand.

## When not to use

- Use logo-marquee when logos are enough social proof.
- Use carousel for many short testimonials.
- Use team-showcase to introduce your own team.

## Installation

Studio perspectives is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/testimonial-stage
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { TestimonialStage } from "@/components/arc/blocks/testimonial-stage/testimonial-stage";

export function Stories() {
  return (
    <TestimonialStage
      className="my-24"
      onPerspectiveChange={(p) => track("testimonial_view", p)}
    />
  );
}
```

## API reference

### TestimonialStage

Portrait-led stories with a tab list of people and a quote panel. Quotes and portraits are sample data.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `className` | `string` | – | Appended to the root section. |
| `onPerspectiveChange` | `(perspective: { id: string; name: string }) => void` | – | Called when the active person changes. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| ArrowLeft / ArrowRight | Move to the previous or next person in the tab list, wrapping around, and focus it. |

## Accessibility

- People form a role="tablist" with role="tab" and aria-selected.
- The quote panel is a polite live region.

## Motion

- Portrait and quote crossfade with a small directional shift.
- Reduced motion removes the shift and uses instant transitions.

## Responsive behavior

- Below 800px the columns narrow; below 680px the portrait stacks above the quote.
- Below 350px padding and quote size shrink to keep the quote readable.

## Performance

- Only the active portrait is mounted, via next/image, and the first one gets priority loading.
- There is no autoplay timer; changes happen only on tab, arrow, or key input.

## Notes for AI

- Use for testimonials or editorial stories about people.
- Replace the perspectives array with verified quotes and portraits you have permission to use.

## Related

- [Team showcase](https://uiarc.dev/components/blocks/team-showcase/markdown): An image led team introduction with profiles that open in place.
- [Logo marquee](https://uiarc.dev/components/blocks/logo-marquee/markdown): A quiet, continuously moving row of brand marks with a pause control.
- [Carousel](https://uiarc.dev/components/carousel/markdown): Browse a row of slides by dragging, flicking, or arrowing through them.
- [Tabs](https://uiarc.dev/components/tabs/markdown): Switch between related content in the same context.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
