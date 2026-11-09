# Exploded view

> A scroll driven exploded view where a live phone screen built from five CSS 3D layers lies back, separates in depth with labels that follow each layer, takes each layer into focus, and then reassembles.

- Type: Block
- Page: https://uiarc.dev/components/blocks/exploded-view
- Markdown: https://uiarc.dev/components/blocks/exploded-view/markdown

- Access: Arc Pro
- Registry id: `exploded-view`
- Source file: `registry/blocks/exploded-view/exploded-view.tsx`
- Keywords: exploded view, layers, 3d, css 3d, perspective, isometric, scroll driven, scrollytelling, product screen, phone mockup, design system, showpiece, sticky section, depth

Render <ExplodedView /> for the Tally demo in its own scrolling frame, or pass scroll="page" on a landing page so it pins to the viewport. Copy changes through title, description, layers (five entries, bottom to top) and ends, and onStopChange reports the current stop (0 assembled, 1 to 5 layers, 6 reassembled).

## When to use

- A showpiece section that shows a product is built with care, by literally taking its screen apart.
- Explaining the layers of a design system or UI kit: tokens, grid, content, controls and overlays.
- A launch page moment between the hero and the feature list, where one strong scroll interaction earns its place.

## When not to use

- Use zoom-into-ui to fly into parts of a flat product screen and explain features in place.
- Use scroll-story when the story is a sequence of product states rather than the structure of one screen.
- Use a static screenshot or feature-illustration where scroll driven motion would compete with nearby sections.

## Installation

Exploded view is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/exploded-view
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ExplodedView } from "@/components/arc/blocks/exploded-view/exploded-view";

export function HowItIsBuilt() {
  return (
    <ExplodedView
      scroll="page"
      title="Built in layers"
      description="Take the home screen apart. Each layer has one job, and together they read as one calm surface."
      onStopChange={stop => analytics.track("exploded_view_stop", { stop })}
    />
  );
}
```

## API reference

### ExplodedView

A scroll driven exploded view of a product screen. A live, themed phone screen is built from five layers stacked in CSS 3D: surface, layout grid, content, controls and a floating notification. As you scroll the screen lies back, the layers separate in depth, a label with a leader line follows each layer, the layers take focus one at a time with a caption beside them, and then the stack closes and stands back up as one screen.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | `"Built in layers"` | Heading of the section. |
| `description` | `string` | `sampleIntro.body` | One or two sentences under the heading. |
| `layers` | `ExplodedLayer[]` | `sampleLayers` | Name, short note and caption for each of the five layers, bottom to top ({ id, name, note, body }). The layer art is the built in screen, so pass exactly five entries in the order surface, grid, content, controls, floating. |
| `ends` | `{ start: { title: string; body: string }; end: { title: string; body: string } }` | `sampleEnds` | Captions shown before the stack separates and after it comes back together. |
| `scroll` | `"container" \| "page"` | `"container"` | "container" scrolls inside its own rounded frame, for previews and embeds. "page" lets the track run in the page and pins the stage to the viewport. |
| `length` | `number` | `4` | Scroll distance as a multiple of the frame height. Longer gives each layer more time in focus. |
| `onStopChange` | `(stop: number) => void` | – | Called when the stop under the reading position changes: 0 is assembled, 1 to 5 are the layers bottom to top, 6 is reassembled. |
| `className` | `string` | – | Class on the root section. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves to the scrolling frame (container mode) and then through the seven stop buttons under the caption. |
| Arrow up / Arrow down, Page up / Page down, Space | On the focused frame, scrolls the story, which separates and reassembles the layers. |
| Home / End | On the focused frame, jumps to the assembled screen or to the end. |
| Enter / Space | On a stop button, scrolls to that stop: assembled, one of the five layers, or reassembled. |

## Accessibility

- The section is labelled by its heading, and in container mode the scrolling frame is a focusable region named after it.
- The 3D stage and its floating labels are decorative and hidden from assistive tech; an ordered list outside the stage names every layer with its caption, bottom to top.
- The caption for the current stop sits in a polite live region, so each layer's name and description is announced as it takes focus.
- Each stop is a real button with the stop's name as its label and aria-current="step" on the current one.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring. A focused or hovered stop button fills with the muted surface, and the current stop's tick turns the accent and thickens, so position never depends on color alone.

## Motion

- One scroll timeline drives everything: the screen tilts back and turns, the layers spread apart in depth, the labels draw their leader lines and fade in bottom to top, then the stack closes and stands up again.
- Scroll progress is smoothed by a critically damped spring with no overshoot, so the stack follows the wheel softly, never passes its true position, and reverses mid way without a jump.
- The layer in focus keeps full strength while the others step back in opacity, and its outline and label take the accent; the caption crossfades with a short rise on the enter curve and leaves faster than it arrives.
- Labels live in flat stage space and are positioned each frame by projecting the layer's anchor point through the same rotation and perspective as the CSS, so text never tilts and the leader line always meets its layer.
- Per frame work writes transforms and opacity straight to the DOM from the motion value; React renders only when the stop changes.
- Reduced motion removes all travel: the screen shows flat at the start and end and fully separated for the five layer stops, switching instantly, and caption changes are instant.

## Responsive behavior

- From 880px wide the heading, caption and stops share a column on the left and the 3D stage fills the right.
- Below that the heading sits above the stage and the caption with its stops below it; below 560px the stops span the full width above the caption and the floating labels keep their names only.
- On a tall, narrow stage the stack turns less and spreads further, so it uses the height instead of shrinking; the scale is fitted from the stage size so the separated stack and its labels never overflow.
- Every stop button is 44px tall, and at phone widths the seven buttons share the full row.

## Performance

- Only transform and opacity change per frame, on a small number of elements: one group rotation, five layer depths and five label positions.
- Fit is measured once and again only when the stage resizes, through a ResizeObserver; the projection per frame is a few lines of trigonometry per layer.
- The first render is the flat screen on the server and the client alike, so there is no hydration mismatch; reduced motion is read after hydration.

## Notes for AI

- Choose it for a marketing or launch page that explains how a product is put together: design systems, UI kits, hardware with a screen, or an app whose craft is the selling point.
- The layer art is the built in Tally budgeting screen. Change the copy through layers, title and description; to show your own product, replace LayerArt in the source with your screen split into five layers at 280 by 620 design px.
- Use scroll="page" on a real landing page so the section pins to the viewport; container mode is for previews, docs and embeds where page scroll is not available.
- Tally, the people and the wine bar are sample content. Portraits and photos are local assets from public/media.

## Related

- [Scroll story](https://uiarc.dev/components/blocks/scroll-story/markdown): A feature section where scrolling the copy drives a pinned product view through each step.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
