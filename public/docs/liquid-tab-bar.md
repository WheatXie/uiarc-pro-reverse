# Liquid tab bar

> Tabs with a lens selection that slides between them, swaps labels cleanly, and fills in icons as it passes.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/liquid-tab-bar
- Markdown: https://uiarc.dev/components/liquid-tab-bar/markdown
- Source file: `registry/components/liquid-tab-bar/liquid-tab-bar.tsx`
- Dependencies: motion
- Keywords: special, tabs, navigation, react tab bar, liquid glass tabs, animated tab bar, ios tab bar, bottom navigation, tab bar with badges, gooey tabs

## When to use

- Switching between a handful of peer sections with icons, such as an app's main areas.
- Bottom or top bars on mobile-style layouts where the selection should feel physical.
- Tabs that carry badge counts for new items.

## When not to use

- Use tabs for text-only panels inside a page.
- Use segmented-control for compact filters or view toggles.
- Use morph-nav for site navigation with dropdown panels.

## Installation

Liquid tab bar is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/liquid-tab-bar
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { LiquidTabBar, liquidPanelId, liquidTabId } from "@/components/arc/liquid-tab-bar/liquid-tab-bar";
import { Home, Library, Radio } from "lucide-react";

export function Sections() {
  const [tab, setTab] = useState("home");
  return (
    <>
      <LiquidTabBar id="nav" value={tab} onValueChange={setTab} tabs={[
        { value: "home", label: "Home", icon: <Home /> },
        { value: "radio", label: "Radio", icon: <Radio />, badge: 2, badgeLabel: "2 new" },
        { value: "library", label: "Library", icon: <Library /> },
      ]} />
      <section id={liquidPanelId("nav", tab)} role="tabpanel" aria-labelledby={liquidTabId("nav", tab)}>{/* ... */}</section>
    </>
  );
}
```

## API reference

### LiquidTabBar

Horizontal navigation for a handful of peer sections. The selection is a lens that slides to the new tab on the morph spring and redraws what passes under it inverted, so outline icons fill in.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `tabs` (required) | `{ value: string; label: string; icon: ReactNode; activeIcon?: ReactNode; badge?: number; badgeLabel?: string }[]` | – | Tabs in order. activeIcon is drawn inside the lens (defaults to icon filled in); badge is a rolling count and badgeLabel what screen readers hear with it. |
| `value` (required) | `string` | – | Selected tab value. |
| `onValueChange` (required) | `(value: string) => void` | – | Called when a tab is chosen by tap, drag, or keyboard. |
| `labels` | `"active" \| "always" \| "none"` | `"active"` | Which tabs show their label: the selected one, every tab, or none. |
| `label` | `string` | `"Sections"` | Accessible name of the tab list. |
| `id` | `string` | – | Base id for tab and panel ids. Defaults to a generated id. |
| `className` | `string` | – | Extra class on the tab list. |

### liquidTabId / liquidPanelId

Helpers that return a tab's id and the panel id its aria-controls points at, so panels can be wired up.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` (required) | `string` | – | The base id passed to LiquidTabBar. |
| `value` (required) | `string` | – | The tab value. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| ArrowLeft / ArrowRight | Selects the previous or next tab and moves focus to it, wrapping at the ends. |
| Home / End | Selects the first or last tab. |

## Accessibility

- Uses the tablist and tab roles with aria-selected, aria-controls, and a roving tabindex.
- Each tab's accessible name includes its badge, using badgeLabel when given.
- The inverted copy inside the lens is decorative; only one set of tabs is exposed.

## Motion

- The lens slides and resizes to the new tab on the morph spring as one shape, with no stretch or squash; it leans slightly toward a hovered tab.
- The label being left fades out at once and the new label fades in only as the lens arrives, so two labels never show together; icons, labels, and badges keep their places.
- Grab the lens on the selected tab and drag or throw it; it lands where its momentum reaches, a quick flick always moves at least one tab, and it resists past either end. The selected tab's label opens on a spring and badge digits roll.
- Reduced motion jumps the lens and labels to their places without travel or lean.

## Responsive behavior

- Slots are a fixed 44px plus the open label, and the bar caps at max-width 100%; set labels to none when space is tight.
- The bar uses touch-action pan-y, so dragging the lens sideways works on touch without blocking page scroll.
- Hover lean follows the mouse only; touch selects on tap or throw.

## Performance

- The lens animates a clip-path over an inverted copy of the tabs, so every tab is rendered twice.
- Label widths are measured from hidden copies whenever tabs change; keep the tab count to a handful.

## Notes for AI

- Choose it for switching between a handful of peer sections with icons, such as an app's main areas. Use tabs for text-only in-page panels and segmented-control for compact filters.
- It is controlled: keep value in state. Wire panels with liquidPanelId and liquidTabId using the same id prop.

## Related

- [Tabs](https://uiarc.dev/components/tabs/markdown): Switch between related content in the same context.
- [Segmented control](https://uiarc.dev/components/segmented-control/markdown): Switch between a small set of related views.
- [Morph nav](https://uiarc.dev/components/morph-nav/markdown): A navigation bar that morphs into rich menus, search, and a compact state as one surface.
- [Dock](https://uiarc.dev/components/dock/markdown): A floating tool dock with a gliding label, a springy selection, and trays that grow out of it.

## Also in docks and tabs

- [Share sheet](https://uiarc.dev/components/share-sheet/markdown): A Share button that opens into a panel with copy link, access level, channels, and people to send to.
- [Action morph](https://uiarc.dev/components/action-morph/markdown): A floating button that morphs into a quick-action menu, then an inline form, then back with a check.
- [Orbit menu](https://uiarc.dev/components/orbit-menu/markdown): Hold a button and its actions orbit out, ready to pick with a drag.

## Guidance for AI tools

Liquid tab bar: Tabs with a lens selection that slides between them, swaps labels cleanly, and fills in icons as it passes. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
