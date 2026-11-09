# Logo marquee

> A quiet, continuously moving row of brand marks with a pause control.

- Type: Block
- Page: https://uiarc.dev/components/blocks/logo-marquee
- Markdown: https://uiarc.dev/components/blocks/logo-marquee/markdown

- Access: Free, open source
- Registry id: `logo-marquee`
- Source file: `registry/blocks/logo-marquee/logo-marquee.tsx`
- Built from: Motion, Button, Brand marks
- Keywords: react logo marquee, logo cloud, infinite logo scroll, trusted by logos, customer logos strip, css marquee

Use this to show a collection of organizations or tools. Replace the sample marks with brands you have permission to represent.

## When to use

- A customer or integration logo strip on a landing page.
- Social proof sections with a heading and a short supporting line.

## When not to use

- Use integrations when each logo needs a description or a connect action.
- Use testimonial-stage when quotes matter more than logos.
- Use carousel when people should browse items by hand.

## Installation

### CLI

Run one of these in a project set up with `shadcn init`:

```bash
npx shadcn@latest add @uiarc/logo-marquee
pnpm dlx shadcn@latest add @uiarc/logo-marquee
yarn dlx shadcn@latest add @uiarc/logo-marquee
bunx --bun shadcn@latest add @uiarc/logo-marquee
```

The `@uiarc` name needs `"registries": { "@uiarc": "https://uiarc.dev/r/{name}.json" }` in `components.json`. Without it, use the full URL:

```bash
npx shadcn@latest add https://uiarc.dev/r/logo-marquee.json
```

### Manual

1. Install the dependencies:

```bash
npm install lucide-react
```

2. Copy the source into your project. Main file: `registry/blocks/logo-marquee/logo-marquee.tsx`

   The source is in the registry item: https://uiarc.dev/r/logo-marquee.json

3. Arc imports use the `@/` alias for `registry/` and `lib/`. Keep the same folders or update the import paths.

## Usage

```tsx
import { LogoMarquee } from "@/components/arc/blocks/logo-marquee/logo-marquee";

export function Customers() {
  return (
    <LogoMarquee
      title="Trusted by product teams"
      description="Teams of every size ship with us."
      brands={[{ name: "Acme", icon: "/logos/acme.svg" }, { name: "Globex", icon: "/logos/globex.svg" }]}
    />
  );
}
```

## Examples

### Integration logos

```tsx
<LogoMarquee
  title="Works with your stack"
  description="Connect the tools your team already uses."
  brands={[
    { name: "Linear", icon: "/logos/linear.svg" },
    { name: "Figma", icon: "/logos/figma.svg" },
    { name: "Notion", icon: "/logos/notion.svg" },
  ]}
/>
```

## API reference

### LogoMarquee

A heading, a looping row of brand marks, and a pause control.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | `"Good work moves between tools"` | Section heading. |
| `description` | `string` | `"From the first idea to the final handoff, a familiar set of tools stays close to the work."` | Supporting line under the heading. |
| `brands` | `LogoMarqueeBrand[]` | `exampleBrands` | Marks to show. Defaults to seven sample tool logos. |
| `tone` | `"color" \| "mono"` | `"color"` | Color shows each mark in its official brand colors; mono draws every mark in the text color for a quieter row. |

### LogoMarqueeBrand

One brand entry.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `name` (required) | `string` | – | Visible brand name. |
| `icon` (required) | `string` | – | URL of a single-color SVG, applied as a CSS mask so it inherits the text color. |
| `color` | `string` | – | Official brand color for a single-color mark in color tone. Leave out for black or white marks such as GitHub, Notion, and Vercel so they follow the text. |
| `colorIcon` | `string` | – | URL of a full color SVG for multicolor marks such as Slack or Figma, used in color tone. |

## Accessibility

- The duplicated loop copy is aria-hidden, so each brand is read once.
- The pause button uses aria-pressed and a live region announces the motion state.

## Motion

- A CSS keyframe loop scrolls two copies of the list for a seamless track.
- Under prefers-reduced-motion the animation stops and the duplicate list is hidden.

## Responsive behavior

- Below 700px the heading and description stack and the marks shrink.
- The track fades at both edges with a mask, so logos never hard-cut at narrow widths.

## Performance

- The loop is a single CSS transform keyframe on one track, with no JavaScript animation.
- Two copies of the list are rendered for a seamless loop; under reduced motion the animation stops and the copy is hidden.
- Logos are CSS masks from SVG URLs, so use small single-color SVGs.

## Notes for AI

- Use for a customer or integration logo strip on a landing page.
- Only pass brands you have permission to show; the defaults are illustrative.
- Composes Arc Button for the pause control.

## Related

- [Studio perspectives](https://uiarc.dev/components/blocks/testimonial-stage/markdown): Portrait led editorial stories with a focused reading state.
- [Integrations](https://uiarc.dev/components/blocks/integrations/markdown): An integrations directory where Connect morphs to Connected and the filters recount as you go.
- [Carousel](https://uiarc.dev/components/carousel/markdown): Browse a row of slides by dragging, flicking, or arrowing through them.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
