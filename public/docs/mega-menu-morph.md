# Mega menu morph

> A site header whose menus share one floating panel. Moving between sections morphs its size, slides the next menu in from that side and glides the caret under the new trigger, with hover intent, a safe triangle and an accordion sheet on narrow screens.

- Type: Component (disclosure)
- Access: Arc Pro
- Page: https://uiarc.dev/components/mega-menu-morph
- Markdown: https://uiarc.dev/components/mega-menu-morph/markdown
- Source file: `registry/components/mega-menu-morph/mega-menu-morph.tsx`
- Dependencies: motion, lucide-react
- Keywords: navigation, menu, motion, new, mega menu, site header, navigation bar, navbar, dropdown, morphing dropdown, shared layout, stripe menu, hover intent, safe triangle, menu aim, caret, accordion menu, mobile menu, marketing header

## When to use

- A marketing site header with product, solution, developer and company sections that each need a rich menu.
- A documentation or platform site whose top sections deserve descriptions, a featured story or a status line.
- Anywhere visitors browse several menus in a row and repeated open and close animations would feel busy.

## When not to use

- Use morph-nav for a compact floating pill navigation with search built in.
- Use dropdown-menu for a single list of actions or links behind one button.
- Use tabs or a docs-sidebar style navigation for moving between views inside a product.

## Installation

Mega menu morph is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/mega-menu-morph
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { MegaMenuMorph } from "@/components/arc/mega-menu-morph/mega-menu-morph";
import type { MegaMenuItem } from "@/components/arc/mega-menu-morph/mega-menu-morph";
import { BookOpen, CreditCard, Repeat, Zap } from "lucide-react";

const items: MegaMenuItem[] = [
  {
    value: "products",
    label: "Products",
    groups: [{ title: "Payments", links: [
      { label: "Checkout", description: "Hosted pages in 46 currencies", icon: <CreditCard />, href: "/checkout" },
      { label: "Billing", description: "Subscriptions, usage and invoices", icon: <Repeat />, href: "/billing" },
    ] }],
    feature: { title: "Instant payouts in the EU", description: "Sellers now get paid in seconds.", cta: "Read the announcement", href: "/blog/instant-payouts" },
  },
  {
    value: "developers",
    label: "Developers",
    groups: [{ title: "Documentation", links: [
      { label: "Quickstart", icon: <Zap />, href: "/docs/quickstart" },
      { label: "API reference", icon: <BookOpen />, href: "/docs/api" },
    ] }],
    footer: <span>All systems normal</span>,
  },
  { value: "pricing", label: "Pricing", href: "/pricing" },
];

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <MegaMenuMorph
      items={items}
      brand={{ name: "Tally", mark: <TallyMark />, href: "/" }}
      actions={[{ label: "Sign in", href: "/login" }, { label: "Start now", href: "/signup", variant: "primary" }]}
      current={pathname.startsWith("/docs") ? "developers" : undefined}
      onNavigate={destination => destination.href && router.push(destination.href)}
    />
  );
}
```

## API reference

### MegaMenuMorph

A site header whose menus share one floating surface. Moving from one section to the next morphs the surface to the new menu's width and height, glides it and its caret under the new trigger and slides the content in from the side you came from, instead of closing one menu and opening another. A highlight follows the pointer across the triggers, a muted footer band grows and shrinks with the panel, hover intent and a safe triangle keep diagonal moves toward the open menu from switching sections, and a header too narrow for its row folds into a full width accordion sheet.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `MegaMenuItem[]` | `megaMenuSampleItems` | Sections of the header, in order. An item with groups or a feature opens a menu; an item without them is a plain link. Each item is { value, label, href?, groups?: { title?, links: { label, description?, icon?, href?, badge? }[] }[], feature?: { title, description?, cta?, href?, media? }, footer? }. |
| `brand` | `{ name: string; mark?: ReactNode; href?: string }` | `Tally sample brand` | Mark and name at the start of the header. Choosing it calls onNavigate. |
| `actions` | `MegaMenuAction[]` | `Sign in and Start now` | Actions at the end of the header, each { label, href?, onClick?, variant?: "primary" \| "quiet" }. When the header folds, primary actions stay in the bar and quiet ones move to the bottom of the sheet. |
| `value` | `string \| null` | – | The open menu, controlled. null keeps every menu closed. Pair with onValueChange. |
| `defaultValue` | `string \| null` | `null` | The menu open on first render when uncontrolled. |
| `onValueChange` | `(value: string \| null) => void` | – | Called with the menu that should open, or null when menus close, from hover, click, keyboard, Escape, focus leaving or an outside press. |
| `current` | `string` | – | Value of the section that holds the current page. Its trigger carries a short accent mark and plain links get aria-current="page". |
| `openDelay` | `number` | `90` | How long in ms the pointer rests on a trigger before the first menu opens. Once a menu is open, moving to another trigger switches at once unless the pointer is heading into the open menu. |
| `closeDelay` | `number` | `240` | Grace period in ms after the pointer leaves the header and the menu before the menu closes. Re-entering cancels it. |
| `collapseBelow` | `number \| "auto"` | `"auto"` | Header width in px below which the sections fold into the accordion sheet. "auto" measures the natural width of the full row and folds exactly when it stops fitting. |
| `showSafeArea` | `boolean` | `false` | Draws the safe triangle from the pointer to the top corners of the open menu, tinted with the accent while it is holding a switch back. A development aid for tuning hover behavior. |
| `onNavigate` | `(destination: MegaMenuDestination) => void` | – | Called with { label, href?, section? } for every destination: links, feature cards, plain sections, actions and the brand. When set, the default link navigation is prevented so you can route yourself; menus and the sheet close either way. |
| `label` | `string` | `"Main"` | Accessible name of the navigation landmark. |
| `className` | `string` | – | Class on the root element. |
| `style` | `CSSProperties` | – | Inline styles on the root element. Set --mm-bar-h to change the bar height and --mm-sheet-max to cap the folded sheet in a small host. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the brand, the sections and the actions. From a trigger whose menu is open, Tab enters that menu; Tab from its last link moves on to the next section and closes it. |
| Arrow Left / Arrow Right | On the triggers, moves between sections. If a menu is open it follows focus, sliding in from that side. Inside a menu, switches to the previous or next menu and focuses its first link. |
| Home / End | On the triggers, moves to the first or last section. |
| Enter / Space | Toggles the menu of the focused trigger; follows a focused link. |
| Arrow Down | On a trigger, opens its menu and focuses the first link. Inside a menu, moves to the next link. |
| Arrow Up | Inside a menu, moves to the previous link; from the first link, returns to the trigger. |
| Escape | Closes the open menu and returns focus to its trigger, or closes the folded sheet and returns focus to the menu button. |

## Accessibility

- The header is a nav landmark named by label. Triggers are buttons with aria-expanded and aria-controls pointing at the open menu; plain sections are links, with aria-current="page" when they hold the current page.
- Menus follow the disclosure navigation pattern rather than role="menu": links stay links, Tab order runs from a trigger into its menu, and focus leaving the header closes it.
- The current section is marked with aria-current or its label, never only by the accent mark.
- The folded header uses a menu button with aria-expanded and aria-controls, named Open menu or Close menu. Sections in the sheet are accordion buttons with aria-expanded controlling labelled regions.
- The measuring copy of the row, the highlight, the caret, the band and the safe area overlay are hidden from assistive technology; the measuring copy is also inert.
- Outside presses and Escape close the menu and the sheet from anywhere on the page. Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring. Focused links show the same quiet fill as hover.

## Motion

- One surface serves every menu. Its position, width and height are springs restated as stiffness and damping, so retargeting mid flight keeps the velocity it has: growing carries a trace of overshoot, shrinking never overshoots, and the caret glides with the position to stay under the trigger.
- Menus hang from the top left of the surface at their natural size. The next menu slides in 36px from the side of the trigger you moved to and the previous one leaves the other way, both with a short opacity and 2px blur crossfade.
- A footer is drawn on a muted band anchored to the bottom edge. The band's height springs with the panel, so a status row grows out of it instead of fading in, and a menu without a footer folds it away.
- Opening from closed lands the surface in place and fades it in with a short drop and a scale from the caret; closing fades it up and away. Reopening while it closes picks up where it is.
- The trigger highlight glides between triggers on a spring with a little life; it appears in place when the pointer enters the row and fades where it is when the pointer leaves. Chevrons turn on the shared spring curve.
- The folded sheet grows its height on the smooth spring and staggers its rows in; accordion sections open with height and opacity together.
- With reduced motion every size and position change lands at once, menus crossfade in 140ms without travel or blur, the highlight jumps and the sheet fades.

## Responsive behavior

- The root is an inline size container. The full row is measured from an invisible copy at its natural width, and the header folds exactly when it stops fitting, into a bar with the brand, the primary action and a menu button.
- The folded sheet spans the header, never runs past the viewport (or --mm-sheet-max), scrolls inside itself and opens one accordion section at a time.
- Menus clamp to the header with an 8px inset; their groups wrap onto new rows when the header is narrower than a menu's natural width, and the caret stays over the trigger.
- Hover behavior only runs for mouse and pen. On touch, triggers toggle on tap and a tap outside closes the menu.

## Performance

- Only the open menu and, during a switch, the leaving menu are mounted. Menus are measured with a ResizeObserver, and the surface animates width, height and a transform on one absolutely positioned element, so no page layout is touched.
- The highlight and caret are transforms driven by motion values; React renders only when the open section, the hovered trigger or the fold changes.
- Pointer positions are kept in a short ring of samples, and the safe triangle is a single point in triangle test on pointer entry to another trigger.

## Notes for AI

- Use it as the top navigation of a marketing or product site with three to six sections, where each section holds several destinations worth describing. For a single dropdown use dropdown-menu; for app navigation use a sidebar.
- Keep menus different in shape on purpose: a wide menu with two groups and a feature next to a narrow single list is what makes the morph read. Keep descriptions to one line of five or six words.
- Put only live, meaningful information in footer, such as system status or an announcement; the band's growth draws attention to it.
- Pass onNavigate in a client router so links do not reload the page, and pass current so the accent mark follows the route.
- Give the header room: it folds automatically when the row stops fitting. Use collapseBelow with a number only when the fold must match other breakpoints on the page.
- Place it at the top of a relatively positioned page area; menus and the sheet float over the content below and never push it down.

## Related

- [Morph nav](https://uiarc.dev/components/morph-nav/markdown): A navigation bar that morphs into rich menus, search, and a compact state as one surface.
- [Dropdown menu](https://uiarc.dev/components/dropdown-menu/markdown): A focused list of actions anchored to a trigger.
- [Site header](https://uiarc.dev/components/blocks/site-header/markdown): A sticky website header that turns solid on scroll, with a gliding active link, mega menu panels, and a mobile sheet.
- [Tabs](https://uiarc.dev/components/tabs/markdown): Switch between related content in the same context.

## Also in navigation

- [Breadcrumb](https://uiarc.dev/components/breadcrumb/markdown): Show where a page sits in a hierarchy.
- [Pagination](https://uiarc.dev/components/pagination/markdown): Move through a long collection with clear bounds.
- [Table of contents progress](https://uiarc.dev/components/toc-progress/markdown): A table of contents that reads along with you: a line bends through the nested headings, fills as you scroll, and carries a marker to the current section, with smooth jumps and a time-left countdown.

## Guidance for AI tools

Mega menu morph: A site header whose menus share one floating panel. Moving between sections morphs its size, slides the next menu in from that side and glides the caret under the new trigger, with hover intent, a safe triangle and an accordion sheet on narrow screens. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
