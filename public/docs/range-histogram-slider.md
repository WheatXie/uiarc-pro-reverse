# Range histogram slider

> A price range over a live histogram of the data, lighting the bars inside the range and settling on bar edges.

- Type: Component (inputs)
- Access: Free, open source
- Page: https://uiarc.dev/components/range-histogram-slider
- Markdown: https://uiarc.dev/components/range-histogram-slider/markdown
- Registry item: https://uiarc.dev/r/range-histogram-slider.json
- Source file: `registry/components/range-histogram-slider/range-histogram-slider.tsx`
- Dependencies: motion
- Keywords: inputs, new, range slider with histogram, price range filter, airbnb price slider, dual thumb slider, histogram slider, react range slider, min max slider, distribution filter

## When to use

- Marketplace and search filters for price, size, or distance where the distribution guides the choice.
- Analytics filters that trim outliers from a numeric column.
- Any min and max choice where people benefit from seeing how many results fall inside.

## When not to use

- Use slider for a plain range without data behind it.
- Use elastic-slider or slider for a single value.
- Use number-field pairs when people type exact bounds more often than they drag.

## Installation

### CLI

Run one of these in a project set up with `shadcn init`:

```bash
npx shadcn@latest add @uiarc/range-histogram-slider
pnpm dlx shadcn@latest add @uiarc/range-histogram-slider
yarn dlx shadcn@latest add @uiarc/range-histogram-slider
bunx --bun shadcn@latest add @uiarc/range-histogram-slider
```

The `@uiarc` name needs `"registries": { "@uiarc": "https://uiarc.dev/r/{name}.json" }` in `components.json`. Without it, use the full URL:

```bash
npx shadcn@latest add https://uiarc.dev/r/range-histogram-slider.json
```

### Manual

1. Install the dependencies:

```bash
npm install motion
```

2. Copy the source into your project. Main file: `registry/components/range-histogram-slider/range-histogram-slider.tsx`

   The source is in the registry item: https://uiarc.dev/r/range-histogram-slider.json

3. Arc imports use the `@/` alias for `registry/` and `lib/`. Keep the same folders or update the import paths.

## Usage

```tsx
import { RangeHistogramSlider } from "@/components/arc/range-histogram-slider/range-histogram-slider";

export function PriceFilter({ prices }: { prices: number[] }) {
  const [range, setRange] = useState<[number, number]>([80, 320]);
  return (
    <RangeHistogramSlider
      label="Price per night"
      data={prices}
      min={0}
      max={500}
      step={5}
      bins={25}
      value={range}
      onValueChange={setRange}
      onValueCommit={range => refetchListings(range)}
      format={value => `$${value}`}
    />
  );
}
```

## API reference

### RangeHistogramSlider

A two thumb range over a histogram of the data it filters. Bars inside the range light up, thumbs never cross, rubber-band at the ends, and settle on bar edges when released.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `label` (required) | `string` | – | Visible label. The thumbs are named from it unless thumbLabels is set. |
| `data` (required) | `number[]` | – | Raw values the histogram counts, such as every listing's price. |
| `value` | `[number, number]` | – | Controlled range. Leave it out for uncontrolled use. |
| `defaultValue` | `[number, number]` | `[min, max]` | Initial range when uncontrolled. |
| `onValueChange` | `(value: [number, number]) => void` | – | Called on every change while dragging or pressing keys. |
| `onValueCommit` | `(value: [number, number]) => void` | – | Called once a drag is released or a key changes the range. |
| `min` | `number` | – | Lower bound. Defaults to the smallest data value (or 0). |
| `max` | `number` | – | Upper bound. Defaults to the largest data value. |
| `step` | `number` | `1` | Value increment. |
| `bins` | `number` | `32` | How many bars the histogram draws. |
| `snapToBins` | `boolean` | `true` | A released thumb near a bar edge settles on it, so the range never cuts a bar in half. |
| `minStepsBetweenThumbs` | `number` | `1` | Closest the two thumbs may sit, in steps. |
| `format` | `(value: number) => string` | – | Formats the readout and aria-valuetext. |
| `thumbLabels` | `[string, string]` | – | Accessible names for the two thumbs. Defaults to "<label>, minimum" and "<label>, maximum". |
| `name` | `string` | – | Submits the range with a form, one hidden input per thumb. |
| `disabled` | `boolean` | `false` | Blocks input and removes the thumbs from the tab order. |
| `className` | `string` | – | Extra class on the root. |

### histogram

Helper that counts values into equal bars between min and max. The last bar keeps max itself.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `(data, min, max, bins)` | `(number[], number, number, number) => number[]` | – | Returns one count per bar. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves between the minimum and maximum thumbs. |
| ArrowRight / ArrowUp | Increases the focused thumb by one step. |
| ArrowLeft / ArrowDown | Decreases the focused thumb by one step. |
| Shift + Arrow / PageUp / PageDown | Moves the focused thumb to the next bar edge in that direction. |
| Home / End | Moves the focused thumb to its lowest or highest allowed value. |

## Accessibility

- Each thumb is role="slider" with its own name, aria-valuetext, and aria-valuemin/max that reflect the other thumb, so the pair never reads as crossing.
- The histogram and the readout are aria-hidden; the thumbs carry the values.
- Pass thumbLabels in the product's language when the defaults do not fit.

## Motion

- Lit bars and the track fill are clipped by one path, so both cut exactly at each thumb on the same frame.
- Thumbs follow the pointer 1:1, rubber-band a few pixels past their limit, and settle with the release velocity; momentum can carry them at most one bar.
- Pressing the histogram or track springs the nearest thumb to that spot.
- Reduced motion removes the stretch and springs; thumbs jump to their values.

## Responsive behavior

- Chart and track fill the container width; bars shrink with it, so lower bins on narrow screens.
- Touch drags use pointer capture; thumbs keep a large hit area.
- The readout sits on the label row and uses tabular numbers.

## Performance

- Histogram counts are computed once per data, min, max, and bins change.
- Thumbs and clipping are motion values, so dragging does not re-render the bars.
- Bars render twice (base and lit copy); keep bins under about 60.

## Notes for AI

- Choose it for price, size, or duration filters where showing the data distribution helps people pick a sensible range.
- Pass the unfiltered values as data and filter your list on onValueCommit to avoid refetching on every frame.
- Keep data to the values the filter applies to; histogram counts are memoized on data, min, max, and bins.
- When the two thumbs sit together, the first drag direction decides which one moves.

## Related

- [Slider](https://uiarc.dev/components/slider/markdown): Pick a value or a range on a track that follows your finger.
- [Elastic slider](https://uiarc.dev/components/elastic-slider/markdown): A slider that stretches like rubber past its ends, with a swaying value tag and detents the thumb clicks into.
- [Filter toolbar](https://uiarc.dev/components/filter-toolbar/markdown): Keep collection filters close and easy to reset.
- [Date range picker](https://uiarc.dev/components/date-range-picker/markdown): A range picker that grows from its trigger into two months with presets and a stretching range highlight.
- [Ruler slider](https://uiarc.dev/components/ruler-slider/markdown): A tape of ticks that slides under a fixed needle, with momentum, snapping, and a rolling readout.

## Guidance for AI tools

Range histogram slider: A price range over a live histogram of the data, lighting the bars inside the range and settling on bar edges. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
