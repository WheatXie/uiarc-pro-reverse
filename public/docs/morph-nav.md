# Morph nav

> A navigation bar that morphs into rich menus, search, and a compact state as one surface.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/morph-nav
- Markdown: https://uiarc.dev/components/morph-nav/markdown
- Source file: `registry/components/morph-nav/morph-nav.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, navigation, morph, tabs, react navigation bar, react morph nav, mega menu, animated navbar, site header with dropdown, navbar with search, stripe style navigation

## When to use

- The top navigation of a marketing or product site with a few sections that each hold several destinations.
- Headers where search should grow out of the bar instead of opening a separate modal.
- Sites that want one primary action, such as Sign up, pinned to the end of the bar.

## When not to use

- Use liquid-tab-bar for an app-style switcher between a handful of peer sections.
- Use tabs for switching views inside a page.
- Use dropdown-menu when you only need one menu of commands, not site navigation.

## Installation

Morph nav is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/morph-nav
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { MorphNav } from "@/components/arc/morph-nav/morph-nav";

export function SiteHeader({ scrolled }: { scrolled: boolean }) {
  return (
    <MorphNav
      brand={{ name: "Arc", mark: <Logo />, href: "/" }}
      items={[
        { value: "product", label: "Product", links: [
          { label: "Components", description: "Motion-first building blocks", href: "/components" },
          { label: "Blocks", description: "Full sections", href: "/blocks" },
        ] },
        { value: "pricing", label: "Pricing", href: "/pricing" },
      ]}
      search={{ items: [{ label: "Dialog", group: "Components", href: "/components/dialog" }] }}
      action={{ label: "Sign up", href: "/sign-up" }}
      current="product"
      compact={scrolled}
    />
  );
}
```

## Examples

### Tighten on scroll

```tsx
const [scrolled, setScrolled] = useState(false);
useEffect(() => {
  const onScroll = () => setScrolled(window.scrollY > 24);
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}, []);

<MorphNav items={items} current={section} compact={scrolled} onNavigate={d => d.href && router.push(d.href)} />
```

## API reference

### MorphNav

A site navigation bar made of one continuous surface: a highlight glides between items, items with links grow the bar into a dropdown panel, and search morphs out of the bar itself.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` (required) | `{ value: string; label: string; href?: string; links?: { label: string; description?: string; icon?: ReactNode; href?: string }[]; columns?: 1 \| 2; feature?: ReactNode; footer?: ReactNode }[]` | – | Top level destinations. Items with links or a feature open a panel; other items act as plain links. columns defaults to 2 when there are more than three links. Clicking a link or button inside feature closes the panel. |
| `brand` | `{ name: string; mark: ReactNode; href?: string }` | – | Brand button at the start of the bar. |
| `action` | `{ label: string; icon?: ReactNode; href?: string; onClick?: () => void }` | – | The one primary action at the end of the bar. |
| `search` | `{ placeholder?: string; items: { label: string; description?: string; group?: string; icon?: ReactNode; href?: string; keywords?: string }[] }` | – | Search entries. Leave it out to hide search. |
| `current` | `string` | – | Value of the item that holds the current page. |
| `compact` | `boolean` | `false` | Tightens the bar, for example once the page scrolls. |
| `collapseBelow` | `number` | `720` | Below this container width in px the items fold into one menu. |
| `onNavigate` | `(destination: { label: string; href?: string; section?: string }) => void` | – | Called for every destination: links, search results, plain items, and the brand. |
| `label` | `string` | `"Main"` | Accessible name of the nav landmark. |
| `className` | `string` | – | Extra class on the nav element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| ArrowLeft / ArrowRight | Moves between top level items, wrapping; an open panel follows to the new item. |
| Home / End | Focuses the first or last item. |
| ArrowDown / Enter / Space | On an item with a panel, opens it and moves focus to its first link. If the panel is already open, moves focus into it. |
| ArrowUp / ArrowDown | Inside a panel, moves between links; ArrowUp on the first link returns to the trigger. In search, moves the active result. |
| Enter | In search, opens the active result. |
| Escape | Closes search or the open panel and returns focus to where it came from. |

## Accessibility

- Renders a nav landmark; the current item carries aria-current="page" and panel triggers use aria-expanded and aria-controls.
- Open panels are regions labelled by their trigger; the panel closes when focus leaves the nav.
- Search is a combobox driving a listbox with aria-activedescendant, and the result count is announced politely. With an empty query it lists the first five entries as Suggested.
- A pointer down outside the nav closes the panel or search.

## Motion

- The surface springs to each panel's size, with a little bounce when it grows and none when it shrinks. Moving to a neighbour slides the new panel in from that side while a highlight glides between items.
- Hover opens a panel after a 60ms intent delay and leaving the nav closes it after 180ms, so crossing a gap does not flicker it shut.
- Search grows out of the same surface as the bar fades and blurs away; compact and narrow states retune the bar.
- Reduced motion drops travel, scale, and blur and keeps short fades.

## Responsive behavior

- The root is a container; below collapseBelow (720px of its own width by default) the items fold into one menu.
- Panels and search cap at the container width minus a gutter, and below 420px viewport width link panels drop to one column.
- Hover-to-open only reacts to mouse pointers, so touch opens panels on tap without a hover flash.

## Performance

- The bar uses a 22px backdrop blur, which falls back to a solid surface under prefers-reduced-transparency and prefers-contrast.
- Two ResizeObservers track the container and the open panel size; only the open panel is mounted.
- Search ranks entries in memory on each keystroke and shows at most six results, so large indexes should be pre-filtered.

## Notes for AI

- Choose it for the top navigation of a marketing or product site with a handful of sections that each hold several destinations. Use tabs for in-page view switching and liquid-tab-bar for an app-style section switcher.
- Pass current from the router and compact from a scroll listener. Route in onNavigate for client-side navigation; plain items and links with href also work as anchors.

## Related

- [Tabs](https://uiarc.dev/components/tabs/markdown): Switch between related content in the same context.
- [Liquid tab bar](https://uiarc.dev/components/liquid-tab-bar/markdown): Tabs with a lens selection that slides between them, swaps labels cleanly, and fills in icons as it passes.
- [Dropdown menu](https://uiarc.dev/components/dropdown-menu/markdown): A focused list of actions anchored to a trigger.
- [Search field](https://uiarc.dev/components/search-field/markdown): A recognizable search entry point with clear affordances.
- [Popover](https://uiarc.dev/components/popover/markdown): A small anchored surface for contextual information.

## Also in docks and tabs

- [Share sheet](https://uiarc.dev/components/share-sheet/markdown): A Share button that opens into a panel with copy link, access level, channels, and people to send to.
- [Action morph](https://uiarc.dev/components/action-morph/markdown): A floating button that morphs into a quick-action menu, then an inline form, then back with a check.
- [Dock](https://uiarc.dev/components/dock/markdown): A floating tool dock with a gliding label, a springy selection, and trays that grow out of it.
- [Orbit menu](https://uiarc.dev/components/orbit-menu/markdown): Hold a button and its actions orbit out, ready to pick with a drag.

## Guidance for AI tools

Morph nav: A navigation bar that morphs into rich menus, search, and a compact state as one surface. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
