# Site footer

> A website footer with link columns and newsletter, a minimal layout, and a large fading Arc mark.

- Type: Block
- Page: https://uiarc.dev/components/blocks/site-footer
- Markdown: https://uiarc.dev/components/blocks/site-footer/markdown

- Access: Free, open source
- Registry id: `site-footer`
- Source file: `registry/blocks/site-footer/site-footer.tsx`
- Built from: Motion
- Keywords: react footer, site footer, footer with newsletter, footer link columns, minimal footer, marketing footer

Use this as a starting point and replace the sample data with your own.

## When to use

- The closing section of a marketing, docs, or product site.
- Footers that need a newsletter signup and a status link.
- Minimal one-row footers for app shells and docs.

## When not to use

- Use a plain row with breadcrumb or links inside signed-in app screens.
- Use contact-section when the main goal is to start a conversation.

## Installation

### CLI

Run one of these in a project set up with `shadcn init`:

```bash
npx shadcn@latest add @uiarc/site-footer
pnpm dlx shadcn@latest add @uiarc/site-footer
yarn dlx shadcn@latest add @uiarc/site-footer
bunx --bun shadcn@latest add @uiarc/site-footer
```

The `@uiarc` name needs `"registries": { "@uiarc": "https://uiarc.dev/r/{name}.json" }` in `components.json`. Without it, use the full URL:

```bash
npx shadcn@latest add https://uiarc.dev/r/site-footer.json
```

### Manual

1. Install the dependencies:

```bash
npm install motion lucide-react
```

2. Copy the source into your project. Main file: `registry/blocks/site-footer/site-footer.tsx`

   The source is in the registry item: https://uiarc.dev/r/site-footer.json

3. Arc imports use the `@/` alias for `registry/` and `lib/`. Keep the same folders or update the import paths.

## Usage

```tsx
import { SiteFooter } from "@/components/arc/blocks/site-footer/site-footer";

export function Footer() {
  return (
    <SiteFooter
      brand={{ name: "Acme", href: "/" }}
      tagline="Scheduling for small clinics."
      columns={[
        { title: "Product", links: [{ label: "Pricing", href: "/pricing" }, { label: "Changelog", href: "/changelog" }] },
        { title: "Company", links: [{ label: "About", href: "/about" }, { label: "Careers", href: "/careers" }] },
      ]}
      legal={[{ label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }]}
      newsletter={{ onSubscribe: email => subscribe(email) }}
      status={{ label: "All systems normal", tone: "success", href: "https://status.example.com" }}
    />
  );
}
```

## API reference

### SiteFooter

A site footer in three variants: link columns with a newsletter, one minimal row, or a closing large brand mark.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `"columns" \| "minimal" \| "logo"` | `"columns"` | `columns` pairs a newsletter with link columns, `minimal` is one quiet row, `logo` ends in a large fading mark. |
| `brand` | `{ name: string; href?: string; mark?: ReactNode }` | `{ name: "Arc" }` | Brand shown with the tagline. |
| `tagline` | `string` | – | One short line under the brand. |
| `columns` | `{ title: string; links: SiteFooterLink[] }[]` | `siteFooterExampleColumns` | Link columns. |
| `links` | `SiteFooterLink[]` | – | Links for the minimal variant. Defaults to the first link of each column. |
| `legal` | `SiteFooterLink[]` | – | Small links beside the copyright, such as Privacy and Terms. |
| `socials` | `SiteFooterLink[]` | – | Social links. |
| `newsletter` | `{ title?; description?; placeholder?; onSubscribe?: (email: string) => void \| Promise<void> } \| null` | – | Newsletter signup. Throw or reject in onSubscribe to show an error. Pass null to hide it. |
| `status` | `{ label: string; tone?: "success" \| "warning" \| "danger"; href?: string } \| null` | – | A system status link. Pass null to hide it. |
| `year` | `number` | – | Year in the copyright line. |
| `onNavigate` | `(link: SiteFooterLink) => void` | – | Called for every pressed link. Links without an href render as buttons and only call this. |
| `className` | `string` | – | Extra class on the footer. |

### SiteFooterLink

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `label` (required) | `string` | – | Link text. |
| `href` | `string` | – | Destination. |
| `external` | `boolean` | – | Opens in a new tab and shows an outward arrow. |

### SiteFooterBlock

Default export: a preview with a layout switcher.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `SiteFooterVariant` | `"columns"` | Initial variant. |

## Accessibility

- Renders a footer landmark with labelled link groups.
- The newsletter validates in place with a message tied to the field, and confirms without a toast.
- External links show an outward arrow and open in a new tab.
- Status tone is paired with its label, not shown by color alone.

## Motion

- The subscribe button morphs to its confirmed state while the form keeps its width.
- The logo variant's large mark fades toward the bottom edge.
- Reduced motion swaps states without travel.

## Responsive behavior

- Container queries: below 760px the newsletter stacks above the columns; below 520px columns become two per row and the bottom row stacks.
- Link rows wrap rather than truncate.

## Performance

- Static markup apart from the newsletter form; no observers or timers.

## Notes for AI

- Defaults are Arc sample content; pass brand, columns, legal, socials, and newsletter for real sites.
- Pass newsletter={null} and status={null} when you have no backend for them.
- Composes Arc Button and SegmentedControl.

## Related

- [Site header](https://uiarc.dev/components/blocks/site-header/markdown): A sticky website header that turns solid on scroll, with a gliding active link, mega menu panels, and a mobile sheet.
- [Hero section](https://uiarc.dev/components/blocks/hero-section/markdown): Three full screen SaaS heroes: a live dashboard rising from the bottom edge over a drifting mesh, a workflow graph that routes sample events node by node, and editorial type over a mesh gradient.
- [FAQ section](https://uiarc.dev/components/blocks/faq-section/markdown): FAQs as an accordion, a topic rail, or a searchable list that highlights matches.
- [Contact section](https://uiarc.dev/components/blocks/contact-section/markdown): A validated contact form that morphs into a confirmation, support channels, and office cards with local times.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
