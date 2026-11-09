# Sliders

## `elastic-slider` — Elastic slider (Free, component)

A slider that stretches like rubber past its ends, with a swaying value tag and detents the thumb clicks into.

When to use:
- A single setting people drag to taste, such as volume, brightness, or opacity.
- Media and creative tools where a physical, tactile control fits the product.

When not to use:
- Use slider for dense forms and settings pages where a quiet control fits better.
- Use range-histogram-slider to pick a min and max over data.

Keywords: inputs, new, elastic slider, rubber band slider, react slider, volume slider, slider with detents, stretchy slider, ios slider, animated range input

Files: registry/components/elastic-slider/elastic-slider.tsx, registry/components/elastic-slider/elastic-slider.module.css

## `range-histogram-slider` — Range histogram slider (Free, component)

A price range over a live histogram of the data, lighting the bars inside the range and settling on bar edges.

When to use:
- Marketplace and search filters for price, size, or distance where the distribution guides the choice.
- Analytics filters that trim outliers from a numeric column.

When not to use:
- Use slider for a plain range without data behind it.
- Use elastic-slider or slider for a single value.

Keywords: inputs, new, range slider with histogram, price range filter, airbnb price slider, dual thumb slider, histogram slider, react range slider, min max slider, distribution filter

Files: registry/components/range-histogram-slider/range-histogram-slider.tsx, registry/components/range-histogram-slider/range-histogram-slider.module.css

## `ruler-slider` — Ruler slider (Free, component)

A tape of ticks that slides under a fixed needle, with momentum, snapping, and a rolling readout.

When to use:
- Onboarding and profile flows that ask for body measurements or goals.
- Mobile-first inputs where dragging a scale is easier than typing.

When not to use:
- Use number-field when people know the exact number and prefer to type it.
- Use slider or elastic-slider when the value is relative, like volume.

Keywords: inputs, new, ruler slider, tape measure input, height picker, weight picker, scrollable ruler, momentum slider, measurement input, react ruler picker

Files: registry/components/ruler-slider/ruler-slider.tsx, registry/components/ruler-slider/ruler-slider.module.css

## `slider` — Slider (Free, component)

Pick a value or a range on a track that follows your finger.

When to use:
- Approximate values like volume, opacity, or a price range.
- Ranges with two thumbs, labelled marks, and a formatted readout.

When not to use:
- Use number-field when the exact number matters.
- Use progress to show a value people cannot change.

Keywords: slider, range, input, react slider, range slider, dual thumb slider, price range slider, slider with marks, animated slider

Files: registry/components/slider/slider.tsx, registry/components/slider/slider.module.css
