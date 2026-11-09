# Charge session

> An EV or device charging card. Energy packets flow from a charger along the cable into the battery pack, which fills toward a draggable charge limit. The charge curve tapers near full, and power, energy, time to limit and cost update live. Stop charging drains the flow.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/charge-session
- Markdown: https://uiarc.dev/components/charge-session/markdown
- Source file: `registry/components/charge-session/charge-session.tsx`
- Dependencies: lucide-react
- Keywords: special, motion, progress, energy, new, ev charging, charging, battery, charge session, electric vehicle, charge limit, charge curve, time to full, kwh, cost, fleet, charger, power

## When to use

- An EV or fleet app that shows a live charging session with a charge limit.
- A charge point operator console where staff watch power, energy and cost for one bay.
- A product page that demonstrates how your charging network reports time to full and cost.

## When not to use

- Use usage-meter or progress for a static quota or a simple percentage.
- Use gauge for a single live reading without a session, curve or cost.
- Use a table or a chart block to compare many sessions at once.

## Installation

Charge session is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/charge-session
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ChargeSession } from "@/components/arc/charge-session/charge-session";

export function DepotCharger() {
  return (
    <ChargeSession
      title="Bay 12, depot charger"
      location="North yard, 350 kW"
      capacity={98}
      maxPower={350}
      startCharge={22}
      defaultLimit={85}
      rate={0.38}
      currency="EUR"
      locale="de-DE"
      onLimitChange={limit => api.setChargeLimit("bay-12", limit)}
      onStateChange={(state, detail) => state === "stopped" && api.stopSession("bay-12", detail)}
    />
  );
}
```

## API reference

### ChargeSession

A live charging session card for an EV or any device. Energy packets travel from a brushed metal charger along the cable and through the pack to the fill front, where each one lands. The pack fills toward a draggable charge limit, the charge curve tapers near full with the live point riding on it, and power, energy added, time to limit and cost roll every frame. Stop charging drains the flow: the power falls to zero, the last packets land and the point drops to the baseline.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | `"Fast charger 4"` | Name of the charger or device, shown as the card heading. |
| `location` | `string` | `"Harbor Street hub, 150 kW"` | Secondary line under the title. Pass an empty string to hide it. |
| `capacity` | `number` | `77` | Usable battery capacity in kWh. Sets how fast the pack fills and how much energy each percent is worth. |
| `maxPower` | `number` | `150` | Peak charging power in kW, reached on the flat part of the curve. |
| `startCharge` | `number` | `34` | State of charge in percent when the session starts, and where Start new session returns to. |
| `defaultLimit` | `number` | `80` | Charge limit in percent to start with. The component owns it after mount; read it with onLimitChange. |
| `minLimit` | `number` | `50` | Lowest limit the marker can be set to, in percent. |
| `taperAt` | `number` | `50` | State of charge in percent where the power starts to taper toward full. |
| `rate` | `number` | `0.42` | Price per kWh in the session currency. |
| `currency` | `string` | `"USD"` | ISO 4217 currency code for the cost. |
| `locale` | `string` | `"en-US"` | Locale used to format the cost. |
| `speed` | `number` | `1` | Multiplies simulated time. At 1, one second on screen is forty seconds of charging. 0 holds the session still while the flow keeps moving. |
| `paused` | `boolean` | `false` | Holds the session and the flow on their current frame. The limit and the button still work. |
| `accent` | `string` | – | Any CSS color for the energy, the fill and the traveled curve. Defaults to the accent. |
| `onStateChange` | `(state: "charging" \| "stopped" \| "complete", detail: ChargeSessionDetail) => void` | – | Called when charging stops, resumes, reaches the limit or a new session starts, with the charge, energy, cost and limit at that moment. |
| `onLimitChange` | `(limit: number) => void` | – | Called with the new limit in percent when a drag or key press settles. |
| `label` | `string` | – | Accessible name of the card. Defaults to the title. |
| `className` | `string` | – | Class on the root element. |
| `style` | `CSSProperties` | – | Inline styles on the root element. |

## Accessibility

- The card is a labelled group with a real heading. Power, energy added, time to limit and cost are a description list, so each value is read with its name.
- The limit marker is a focusable role="slider" named Charge limit, with aria-valuetext such as Charge limit 80%, about 23 minutes to go. Arrows move it by 1%, Shift with an arrow or Page Up and Page Down by 10%, Home and End jump to the minimum and to 100%. The drag hint is linked with aria-describedby.
- Stopping, resuming, reaching the limit, starting a new session and a settled limit change are announced in a polite live region with the charge, energy and cost at that moment.
- The action button keeps one accessible label at a time (Stop charging, Resume charging, Start new session) and its width never changes.
- The scene and the curve plot are hidden from assistive technology; every value they show is also in the stats, the header or the slider.
- State never relies on color: the header pairs an icon with Charging, Stopped or Charged to limit, and time to limit reads Paused or Done.

## Motion

- One requestAnimationFrame loop advances the session and writes SVG attributes, CSS variables and text directly; React renders only when the session state changes.
- Packets move along an arc length table of the cable curve, so they travel at an even pace, ease out of the charger, glide through the nub and slow as they meet the fill front, where each landing briefly brightens the front.
- Power follows the charge curve times an availability level that ramps up on start and drains exponentially on stop, so the numbers, the LED, the cable core, the packet pace and the live point on the curve all fall away together.
- Dragging the limit is one to one with the pointer; the pill lifts slightly while held. Raising the limit after the pack is full resumes charging, lowering it below the charge completes the session.
- The loop stops offscreen, in background tabs, when paused, and once the flow has fully drained.
- With reduced motion the session holds still: packets sit at even spacing along the path to show direction, values are current, and stop, resume and the limit all update at once.

## Responsive behavior

- The scene is one SVG with a fixed aspect ratio that scales to any width, so the charger, cable and pack keep their proportions; the limit pill is HTML placed in container units, so its text and 44px touch target keep their real size.
- The curve stretches to its container with non scaling strokes; its labels and live point are HTML so they stay crisp and round.
- Above 640px the curve sits beside a two by two stats grid and the percentage grows to the display size. Below 420px padding tightens, the stats shrink one step and the action button spans the card.
- Dragging uses touch-action pan-y on the scene and the curve, so vertical page scroll still works on phones.

## Performance

- A frame evaluates the power curve, a 48 step time to limit integral and 18 packets, well under a millisecond.
- Every write goes through a cache, so unchanged attributes and text are never touched; pointer math reads the target rectangle once per press.
- No canvas, no layout reads in the loop, and the loop idles completely once the flow has drained.

## Notes for AI

- Use it for EV charging apps, fleet and depot dashboards, charge point operator consoles, or any device charging flow where time to full and cost matter.
- The session is simulated from capacity, maxPower, taperAt and rate. For a real session, map your live state of charge onto startCharge and keep speed low, or say clearly that the view is an estimate.
- Keep the title to the charger or vehicle name and put the site and peak power in location.
- Stopping in the demo is local; wire onStateChange to your backend before calling it a real stop.

## Related

- [Usage meter](https://uiarc.dev/components/usage-meter/markdown): Show what fills an allowance and how close it is to the limit.
- [Progress](https://uiarc.dev/components/progress/markdown): Show how much of a known task is complete.
- [Gauge](https://uiarc.dev/components/gauge/markdown): Show a value against a known range.
- [Slider](https://uiarc.dev/components/slider/markdown): Pick a value or a range on a track that follows your finger.

## Also in loaders

- [Stretch refresh](https://uiarc.dev/components/stretch-refresh/markdown): Pull a feed down and a line stretches to tell you when to let go.
- [Morph loader](https://uiarc.dev/components/morph-loader/markdown): Tiny loaders that morph between shapes and fold into a check or a cross when done.
- [Skeleton morph](https://uiarc.dev/components/skeleton-morph/markdown): Loading skeletons that grow into the real content, block by block, instead of swapping.
- [Black hole](https://uiarc.dev/components/black-hole/markdown): A delete transition that pulls the chosen items into a tiny singularity while the rest of the list bends around it; undo spins them back out.

## Guidance for AI tools

Charge session: An EV or device charging card. Energy packets flow from a charger along the cable into the battery pack, which fills toward a draggable charge limit. The charge curve tapers near full, and power, energy, time to limit and cost update live. Stop charging drains the flow. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
