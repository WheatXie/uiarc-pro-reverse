# Control center

> Workspace quick settings: tiles that morph into detail, a duration dial, and rubber-banded meters.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/control-center
- Markdown: https://uiarc.dev/components/control-center/markdown
- Source file: `registry/components/control-center/control-center.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, settings, control center, react control center, quick settings panel, ios control center, settings toggles, focus mode ui, volume slider panel

## When to use

- A quick settings panel with a handful of toggles and levels for a web workspace.
- Focus session controls with a duration dial and allowed people.
- Notification channel toggles grouped behind one tile.

## When not to use

- Use switch, slider, and radio-group directly in a regular settings form.
- Use time-dial to pick a time across time zones.
- Use dropdown-menu for a short list of commands.

## Installation

Control center is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/control-center
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ControlCenter } from "@/components/arc/control-center/control-center";
import { Moon, Briefcase } from "lucide-react";

export function QuickSettings() {
  return (
    <ControlCenter
      focusModes={[
        { id: "deep", label: "Deep work", icon: Briefcase, description: "Silences everything but mentions", defaultMinutes: 50 },
        { id: "rest", label: "Rest", icon: Moon, description: "Silences all alerts", defaultMinutes: 30 },
      ]}
      channels={[{ id: "mentions", label: "Mentions", defaultOn: true }, { id: "deploys", label: "Deploys" }]}
      onStateChange={state => saveSettings(state)}
    />
  );
}
```

## API reference

### ControlCenter

Quick settings for a web workspace: focus sessions, notification channels, presenting mode, alert volume, and text size.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `focusModes` (required) | `{ id: string; label: string; icon: LucideIcon; description: string; defaultMinutes: number }[]` | – | Focus modes offered in the focus detail. defaultMinutes seeds the session dial. |
| `channels` (required) | `{ id: string; label: string; description?: string; defaultOn?: boolean }[]` | – | Notification channels toggled in the notifications detail. |
| `people` | `{ id: string; name: string; avatar: string }[]` | `[]` | People who can still reach you during a focus session. |
| `defaultVolume` | `number` | `60` | Initial alert volume, 0 to 100. |
| `defaultTextSize` | `number` | `100` | Initial text size as a percent of the base, 85 to 130. |
| `formatTime` | `(date: Date) => string` | – | Formats the end of a session. Defaults to a short en-US clock time. |
| `onStateChange` | `(state: { focus: { mode: string; minutes: number; until: string } \| null; notifications: boolean; channels: Record<string, boolean>; presenting: boolean; volume: number; textSize: number }) => void` | – | Called with the full settings state after any change, including each step while a meter is dragged. Focus detail edits apply only on Start or Update session. |
| `label` | `string` | `"Quick settings"` | Accessible name of the panel. |
| `className` | `string` | – | Extra class on the panel. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter / Space | Toggles a tile or opens its detail from the chevron. On the Focus tile with no session, starts the first mode at its default length. |
| Arrow keys | Adjust the meters by one step (1% volume, 5% text size) and the session dial by 5 minutes. |
| PageUp / PageDown | Adjust meters by four steps and the dial by 15 minutes. |
| Home / End | Set a meter to its limit, or the dial to 5 or 120 minutes. |
| Escape | Closes the open detail and returns focus to its chevron. |
| Tab | Cycles focus inside the open detail. |

## Accessibility

- Tiles are toggle buttons with aria-pressed; chevrons open a modal dialog with a focus trap and aria-haspopup.
- Meters and the session dial are sliders with formatted aria-valuetext; channel toggles use role="switch".
- Focus modes are a radiogroup, and the grid behind an open detail is inert. Clicking the scrim closes the detail.

## Motion

- A tile grows into its detail with a shared element morph, and meters follow the pointer 1:1 from where they were grabbed, with rubber-banded edges. A tap without a drag jumps the meter to that spot, and the track swells slightly while held.
- The session dial counts minutes as the knob travels, keeps counting across twelve o'clock, resists past 5 and 120 minutes, and snaps to 5 minute steps on release.
- Icons and status text swap with a short blur; the dial knob springs to snapped values.
- Reduced motion is applied through MotionConfig, removing travel and keeping fades.

## Responsive behavior

- The panel is min(100%, 22.5rem) wide with a fixed height, sized for a popover or side column.
- Below 360px viewport width padding tightens and the session dial shrinks from 164px to 150px.
- Meters keep touch-action pan-y so the page still scrolls, while the dial uses none so it can be turned by touch.

## Performance

- Tiles morph into details through shared layoutIds; only one detail is mounted at a time.
- Meters follow the pointer through motion values, so drags do not re-render the panel per frame.

## Notes for AI

- Choose it for a quick settings panel with a handful of toggles and levels. For ordinary forms use switch, slider, and radio-group directly.
- It is uncontrolled: seed it with defaults and persist through onStateChange. Pass lucide icon components (not elements) for focus modes.

## Related

- [Switch](https://uiarc.dev/components/switch/markdown): A tactile toggle for settings that take effect immediately.
- [Slider](https://uiarc.dev/components/slider/markdown): Pick a value or a range on a track that follows your finger.
- [Radio group](https://uiarc.dev/components/radio-group/markdown): Choose one option from a visible set.
- [Time dial](https://uiarc.dev/components/time-dial/markdown): Spin a dial to pick an hour and see which team cities are at work.
- [Dialog](https://uiarc.dev/components/dialog/markdown): A focused surface for decisions that need attention.

## Also in surfaces

- [Sheet stack](https://uiarc.dev/components/sheet-stack/markdown): Nested sheets that stack with depth, drag to dismiss, and become stacked dialogs on wide screens.
- [Wallet stack](https://uiarc.dev/components/wallet-stack/markdown): Fan a stack of cards and lift one out to see its activity.
- [Holo card](https://uiarc.dev/components/holo-card/markdown): A member card that tilts toward you with a holographic foil and flips to its back.
- [Card to article](https://uiarc.dev/components/card-to-article/markdown): Story cards that open into full articles with one seamless morph and shrink back into their exact slot when dragged down.
- [Link unfurl](https://uiarc.dev/components/link-unfurl/markdown): A composer where pasting a URL shows a loading shimmer on the link, then unfurls it into a rich preview card with title, image and favicon in one morph, which can be collapsed back to the inline link or removed.

## Guidance for AI tools

Control center: Workspace quick settings: tiles that morph into detail, a duration dial, and rubber-banded meters. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
