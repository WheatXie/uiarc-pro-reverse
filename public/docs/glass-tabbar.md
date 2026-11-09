# Glass tab bar

> A floating Liquid Glass tab bar that refracts what scrolls beneath it, with a glass lens that glides, magnifies and can be dragged between tabs, and an optional search bubble; it compacts on scroll down.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/glass-tabbar
- Markdown: https://uiarc.dev/components/glass-tabbar/markdown
- Source file: `registry/components/glass-tabbar/glass-tabbar.tsx`
- Dependencies: motion
- Keywords: special, glass, navigation, new, liquid glass, glass tab bar, floating tab bar, bottom navigation, mobile tab bar, ios tab bar, refraction, lens indicator, draggable tab indicator, collapsing tab bar, hide on scroll, glassmorphism navigation

## When to use

- Mobile web apps and PWAs with three to five top level sections and one global action such as search.
- Content feeds where the bar should step aside while reading and come back on scroll up.

## When not to use

- Desktop layouts with many sections; use a sidebar or morph-nav.
- Switching views inside a card; use segmented-control or tabs.

## Installation

Glass tab bar is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/glass-tabbar
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { GlassTabBar } from "@/components/arc/glass-tabbar/glass-tabbar";
import { Bookmark, Compass, House, Search, UserRound } from "lucide-react";

export function AppShell() {
  const [tab, setTab] = useState("home");
  return (
    <GlassTabBar
      className="tabbar"
      value={tab}
      onValueChange={setTab}
      items={[
        { value: "home", label: "Home", icon: <House /> },
        { value: "explore", label: "Explore", icon: <Compass /> },
        { value: "saved", label: "Saved", icon: <Bookmark />, badge: 3 },
        { value: "profile", label: "Profile", icon: <UserRound /> },
      ]}
      action={{ value: "search", label: "Search", icon: <Search /> }}
    />
  );
}
```

## API reference

### GlassTabBar

A floating Liquid Glass tab bar. The bar refracts what scrolls under it, and the selected tab sits under a glass lens that glides, lifts, and magnifies as it moves and can be dragged across the tabs. An optional round action bubble sits beside it, and the bar shrinks to a compact pill of icons on scroll down.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` (required) | `GlassTabBarItem[]` | – | Tabs with value, label, icon, and an optional badge. |
| `value` | `string` | – | Controlled active tab. A value that matches no tab, or the action, hides the lens. |
| `defaultValue` | `string` | – | Initial active tab when uncontrolled. Defaults to the first item. |
| `onValueChange` | `(value: string) => void` | – | Called when a tab or the action is chosen by tap, drag, or keyboard. |
| `action` | `GlassTabBarItem` | – | A separate round glass tab beside the bar, such as search. It takes part in selection and keyboard order like any tab. |
| `compact` | `boolean` | – | Controlled compact state. |
| `defaultCompact` | `boolean` | `false` | Initial compact state when uncontrolled. |
| `onCompactChange` | `(compact: boolean) => void` | – | Called when the bar shrinks or grows. |
| `scrollRef` | `RefObject<HTMLElement \| null>` | – | Scroll container to watch. Leave it out to watch the window. |
| `collapseOnScroll` | `boolean` | `true` | Shrink on scroll down and grow on scroll up. |
| `label` | `string` | `"Tabs"` | Accessible name of the navigation and its tab list. |
| `className` | `string` | – | Extra class on the nav. Position the bar here, usually fixed or absolute at the bottom. |
| `style` | `CSSProperties` | – | Inline style on the nav. |

### GlassTabBarItem

One tab, or the action.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` (required) | `string` | – | Unique value. |
| `label` (required) | `string` | – | Visible label and accessible name. The action shows only its icon and uses the label as its name. |
| `icon` (required) | `ReactNode` | – | Icon at 22px; lucide icons are sized automatically. |
| `badge` | `number \| string` | – | Count shown as an accent badge on the icon. 0 or empty hides it. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves focus to the selected tab; the tab list is one stop. |
| Arrow left / Arrow right | Moves to and selects the previous or next tab, including the action, wrapping around. |
| Home / End | Selects the first tab or the last one. |
| Enter / Space | Selects the focused tab and grows the bar if it is compact. |

## Accessibility

- Renders a nav landmark around a tablist; every tab, including the action, has role="tab" and aria-selected, with a roving tabindex.
- Labels stay in the accessibility tree when the bar is compact, so each tab keeps its name.
- Badges carry hidden text such as "3 new" for screen readers.
- Selection is carried by the lens, the accent tint, and aria-selected, never by color alone.
- Reduced transparency swaps the glass for a solid raised surface; increased contrast strengthens the tint, border, and ink.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- The lens glides on the smooth spring, which never overshoots. Its speed lifts it off the bar: it grows, stretches along the direction of travel, and turns into a clear lens that magnifies the icons under it, then settles back into a soft fill.
- Each tab's tint and icon scale follow the lens position, so the accent glides with it instead of switching.
- Press the selected tab and the lens lifts; drag past a few pixels and it follows the pointer across the bar; release snaps it to the nearest tab and selects it.
- One spring drives the compact morph: slot width, bar height, icon lift, and label fade all read from it, so the lens stays on its tab mid morph.
- Reduced motion moves the lens and the size instantly, with no lift, stretch, or magnification.

## Responsive behavior

- Tabs share the available width, from 78px down to 56px each, so five tabs and an action fit a 390px screen. Compact tabs are 50px.
- The bar and lens take touch with pan-y, so vertical scrolling that starts on the bar still works.

## Performance

- Motion values drive every frame; React renders only on tab, compact, or size changes. Nothing animates at rest.
- Chromium gets real refraction: an SVG displacement filter inside backdrop-filter bends the backdrop at the rim, with a slight per channel dispersion. Safari and Firefox are detected and keep a blur and saturation glass.
- The lens refraction is a fixed layer clipped to the lens; while it moves, only the clip and the filter's map rectangle update.

## Notes for AI

- Use it as the primary navigation of a mobile web app. Keep it to three to five tabs with short labels, plus at most one action.
- Pass the page's scroll container as scrollRef when the app scrolls inside an element instead of the window.
- Place it with position fixed or absolute at the bottom; the component centers itself and only the glass takes pointer events.
- Put photos or colorful content behind it; the material is designed to be seen over real content, not a flat page.
- Leave content room at the bottom (about 110px) so the last item is not hidden behind the bar.

## Related

- [Liquid tab bar](https://uiarc.dev/components/liquid-tab-bar/markdown): Tabs with a lens selection that slides between them, swaps labels cleanly, and fills in icons as it passes.
- [Morph nav](https://uiarc.dev/components/morph-nav/markdown): A navigation bar that morphs into rich menus, search, and a compact state as one surface.
- [Dock](https://uiarc.dev/components/dock/markdown): A floating tool dock with a gliding label, a springy selection, and trays that grow out of it.
- [Tabs](https://uiarc.dev/components/tabs/markdown): Switch between related content in the same context.

## Also in glass

- [Glass menu](https://uiarc.dev/components/glass-menu/markdown): A glass action menu whose trigger morphs into the panel, with a highlight pill that glides between rows, one in-place submenu, and full keyboard support.
- [Glass segmented](https://uiarc.dev/components/glass-segmented/markdown): A glass segmented control whose liquid indicator stretches between segments and can be dragged and flung.
- [Glass card](https://uiarc.dev/components/glass-card/markdown): A glass info panel over a photo whose rim catches a pointer-following highlight while the card tilts; tap to morph it into a detail sheet.

## Guidance for AI tools

Glass tab bar: A floating Liquid Glass tab bar that refracts what scrolls beneath it, with a glass lens that glides, magnifies and can be dragged between tabs, and an optional search bubble; it compacts on scroll down. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
