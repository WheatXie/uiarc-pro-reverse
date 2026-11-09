# Site header

> A sticky website header that turns solid on scroll, with a gliding active link, mega menu panels, and a mobile sheet.

- Type: Block
- Page: https://uiarc.dev/components/blocks/site-header
- Markdown: https://uiarc.dev/components/blocks/site-header/markdown

- Access: Free, open source
- Registry id: `site-header`
- Source file: `registry/blocks/site-header/site-header.tsx`
- Built from: Motion
- Keywords: react site header, marketing navbar, mega menu, responsive navbar, sticky header, mobile menu sheet, landing page header

Use this as a starting point and replace the sample data with your own.

## When to use

- The top bar of a marketing site, landing page, or docs site.
- Product sites with grouped destinations that deserve a mega menu with a feature card.
- Pages that need one clear sign-up action in the header.

## When not to use

- Use workspace-sidebar or sidebar-rail inside a signed-in app.
- Use morph-nav for a single-surface animated navigation with built-in search.
- Use menubar for application commands.

## Installation

### CLI

Run one of these in a project set up with `shadcn init`:

```bash
npx shadcn@latest add @uiarc/site-header
pnpm dlx shadcn@latest add @uiarc/site-header
yarn dlx shadcn@latest add @uiarc/site-header
bunx --bun shadcn@latest add @uiarc/site-header
```

The `@uiarc` name needs `"registries": { "@uiarc": "https://uiarc.dev/r/{name}.json" }` in `components.json`. Without it, use the full URL:

```bash
npx shadcn@latest add https://uiarc.dev/r/site-header.json
```

### Manual

1. Install the dependencies:

```bash
npm install motion lucide-react
```

2. Copy the source into your project. Main file: `registry/blocks/site-header/site-header.tsx`

   The source is in the registry item: https://uiarc.dev/r/site-header.json

3. Arc imports use the `@/` alias for `registry/` and `lib/`. Keep the same folders or update the import paths.

## Usage

```tsx
import { SiteHeader } from "@/components/arc/blocks/site-header/site-header";

export function MarketingHeader() {
  return (
    <SiteHeader
      variant="simple"
      brand={{ name: "Acme", href: "/", mark: <Logo /> }}
      items={[
        { value: "product", label: "Product", href: "/product" },
        { value: "pricing", label: "Pricing", href: "/pricing" },
        { value: "docs", label: "Docs", href: "/docs" },
      ]}
      current="pricing"
      secondaryAction={{ label: "Sign in", href: "/sign-in" }}
      primaryAction={{ label: "Start free", href: "/sign-up" }}
    />
  );
}
```

## API reference

### SiteHeader

A marketing site header in three variants. It turns solid once the page scrolls, and on narrow containers the links move into a sheet.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `"simple" \| "centered" \| "mega"` | `"mega"` | `simple` puts links beside the brand, `centered` centers them in a quiet capsule, `mega` opens panels for items with links. |
| `brand` | `{ name: string; href?: string; mark?: ReactNode }` | `{ name: "Arc" }` | Brand at the start of the bar. |
| `items` | `SiteHeaderItem[]` | `siteHeaderExampleItems` | Top level destinations: { value, label, href?, links?, feature? }. Items with links open a panel in the mega variant. |
| `current` | `string` | – | Value of the item that holds the current page (controlled). |
| `defaultCurrent` | `string` | – | Initial current item when uncontrolled. |
| `onCurrentChange` | `(value: string) => void` | – | Called when a destination inside an item is chosen, with that item's value. |
| `onNavigate` | `(destination: { label: string; href?: string; section?: string }) => void` | – | Called for every destination: items, panel links, the brand, and actions with an href. |
| `secondaryAction` | `{ label: string; href?: string; onClick?: () => void } \| null` | `{ label: "Sign in" }` | A quiet action before the primary one. Pass null to hide it. |
| `primaryAction` | `{ label: string; href?: string; onClick?: () => void } \| null` | `{ label: "Get Arc" }` | The one primary action. Pass null to hide it. |
| `sticky` | `boolean` | `true` | Sticks to the top of its scroll container. |
| `scrollContainer` | `RefObject<HTMLElement \| null>` | – | The element that scrolls, when it is not the window. |
| `scrollThreshold` | `number` | `8` | Pixels of scroll before the background turns solid. |
| `label` | `string` | – | Accessible name of the navigation landmark. |
| `className` | `string` | – | Extra class on the header. |

### SiteHeaderBlock

Default export: a preview with a variant switcher over a small scrolling page.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `SiteHeaderVariant` | `"mega"` | Initial variant. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| ArrowLeft / ArrowRight | Move between top level items in the mega variant. |
| ArrowDown | On an item with links, opens its panel and focuses the first link. |
| ArrowUp / ArrowDown / Home / End | Move between links inside an open panel. |
| Escape | Closes the open panel or the mobile sheet and returns focus to its trigger. |

## Accessibility

- A labelled nav landmark; the current item is marked with aria-current.
- Panel triggers expose aria-expanded; outside presses and Escape close whichever layer is open.
- The mobile sheet locks page scroll while open and returns focus to the menu button when closed.

## Motion

- Mega panels open on hover after a short intent delay and close after a leave grace; switching items morphs the panel to the new content.
- The header background turns solid past scrollThreshold.
- Reduced motion removes panel travel and uses fades.

## Responsive behavior

- It is a container-query component: below 760px of its own width the links, panels, and wide actions hide and a menu button opens a sheet.
- From 760px the sheet and scrim are removed; widening the container closes an open sheet.
- Hover-to-open panels only apply to fine pointers.

## Performance

- Panels mount only while open; the scroll listener updates a single solid-state attribute.
- Feature images use next/image with sizes set, so they load only when a panel opens.

## Notes for AI

- Choose it for marketing and docs sites. For in-app navigation use workspace-sidebar or sidebar-rail.
- The defaults are Arc sample content; always pass brand, items, and actions for real sites.
- Links render as anchors when an href is set; wire onNavigate for client-side routing or analytics.
- The mega variant uses next/image for feature images; allow their host in your image config.

## Related

- [Morph nav](https://uiarc.dev/components/morph-nav/markdown): A navigation bar that morphs into rich menus, search, and a compact state as one surface.
- [Site footer](https://uiarc.dev/components/blocks/site-footer/markdown): A website footer with link columns and newsletter, a minimal layout, and a large fading Arc mark.
- [Hero section](https://uiarc.dev/components/blocks/hero-section/markdown): Three full screen SaaS heroes: a live dashboard rising from the bottom edge over a drifting mesh, a workflow graph that routes sample events node by node, and editorial type over a mesh gradient.
- [Breadcrumb](https://uiarc.dev/components/breadcrumb/markdown): Show where a page sits in a hierarchy.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
