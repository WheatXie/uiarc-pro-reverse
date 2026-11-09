# Scroll story

> A feature section where scrolling the copy drives a pinned product view through each step.

- Type: Block
- Page: https://uiarc.dev/components/blocks/scroll-story
- Markdown: https://uiarc.dev/components/blocks/scroll-story/markdown

- Access: Arc Pro
- Registry id: `scroll-story`
- Source file: `registry/blocks/scroll-story/scroll-story.tsx`
- Built from: Motion
- Keywords: react scroll story, scrollytelling, sticky scroll section, scroll driven animation, product walkthrough on scroll, apple style scroll section

Use this on a marketing page to walk through a product in a few steps. Replace the step copy and the product states with your own.

## When to use

- Marketing pages that walk through a product in a few steps as people scroll.
- Feature sections where a pinned product view should change with the copy.

## When not to use

- Use scroll-highlight for a single paragraph that reveals with scroll.
- Use chaos-to-order for one before and after switch.
- Use feature-illustration for a static feature visual.

## Installation

Scroll story is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/scroll-story
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ScrollStory } from "@/components/arc/blocks/scroll-story/scroll-story";

export default function FeaturesSection() {
  return (
    <section>
      <ScrollStory />
    </section>
  );
}
```

## API reference

### ScrollStory

A feature section where scrolling the copy drives a pinned product view through four steps: messages arrive, sort by theme, fold into a trend and end in a share sheet. Takes no props; STEPS, MESSAGES, THEMES, TREND, TEAM and LINK are inline sample data in scroll-story.tsx, and sending to a channel is simulated.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow left / Arrow right | On the step tabs, scrolls to the previous or next step. |

## Accessibility

- The scrolling viewport is a focusable, labelled region, so it scrolls with the keyboard.
- Step tabs use a tablist with roving tabindex, and the active step in the copy carries aria-current="step".
- The product status and copy link and send results are announced through polite live regions.

## Motion

- Scroll position drives a progress value that fills the step tabs, sorts messages on springs and draws the trend line.
- Springs are restated as stiffness and damping, so retargeting mid-scroll keeps velocity.
- Reduced motion jumps to steps instead of smooth scrolling and replaces the springs with short fades.

## Responsive behavior

- The story scrolls inside its own viewport of clamp(480px, 74vh, 600px), not the page.
- Below a 700px container the product view stacks above the copy and stays pinned while the steps scroll under it.

## Performance

- Scroll is read in a passive listener and measured once per animation frame.
- Product states are memoized per step, so they do not re-render on every scroll frame.

## Notes for AI

- Use on a marketing page to walk through a product in a few steps.
- Replace STEPS copy and the product states (MESSAGES, THEMES, TREND, TEAM, LINK) in scroll-story.tsx with your own.
- Below 700px the product view stacks above the copy and stays pinned; no extra layout work is needed.

## Related

- [Text reveal](https://uiarc.dev/components/text-reveal/markdown): Reveal a short piece of content with restrained motion.
- [In-view title](https://uiarc.dev/components/in-view-title/markdown): Bring a section title in as it scrolls into view.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
