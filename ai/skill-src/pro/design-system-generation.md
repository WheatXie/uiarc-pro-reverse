# Design system generation

Put a brand on Arc tokens without forking a single component. The output is a token layer that sits on
top of `foundation.css`, not a restyled component set.

## What Arc already decides

Leave these alone unless the brand genuinely requires otherwise: spacing scale, radii family, control
heights, elevation recipe, the type scale, the 400/500 weight rule, focus ring geometry, and the
motion springs. Restyling them is how a page stops looking like Arc and starts looking inconsistent.

What a brand usually changes: accent, neutrals (warm/cool tint), display typeface, corner character
(slightly rounder or squarer), and data series colours.

## 1. Interview the brand

Fill this in from assets, not adjectives. Missing values become stated assumptions.

```
Accent:      #hex or oklch() · from the logo, not from a mood
Neutrals:    pure / warm / cool · one word
Display:     typeface name + files, or "Inter only"
Radius:      keep | rounder (×1.4) | squarer (×0.6)
Density:     comfortable (default) | compact (−2px control height, −4px row)
Light/dark:  both required
```

## 2. Write the token layer

Create `brand.css` and import it **after** `foundation.css`. Override only what the brand changes.

```css
/* brand.css: after foundation.css */
:root {
  /* accent family: base, pressed/strong, tint, and the text colour that sits on the accent */
  --accent: oklch(58% 0.19 285);
  --accent-strong: oklch(48% 0.19 285);
  --accent-subtle: oklch(58% 0.19 285 / 0.12);
  --accent-foreground: oklch(99% 0 0);

  /* neutrals: one hue, very low chroma, so surfaces stay quiet */
  --neutral-0: oklch(100% 0 0);
  --neutral-1: oklch(98.4% 0.003 285);
  --neutral-2: oklch(96.8% 0.004 285);
  --neutral-11: oklch(38% 0.01 285);

  /* optional: a display face; body stays Inter */
  --font-display: "Söhne", "Geist Variable", Inter, sans-serif;
}

:root[data-theme="dark"] {
  --accent: oklch(76% 0.15 285);
  --accent-strong: oklch(86% 0.1 285);
  --accent-subtle: oklch(76% 0.15 285 / 0.22);
  --accent-foreground: oklch(16% 0.02 285);
  --neutral-0: oklch(15% 0.006 285);
  --neutral-1: oklch(18% 0.006 285);
}
```

Rules:

- Override the semantic slots (`--accent`, `--surface`, `--text-muted`, …) or the neutral ramp, never
  ad-hoc values inside a component. Items read semantic tokens, so one layer repaints all 380.
- Do not add a second accent. Emphasis comes from weight, size and space, not a second hue.
- Series colours (`--series-1..4`, `--tone-*`) are for data, not for UI chrome.
- If the brand needs a gradient, it already exists as `--arc-gradient*`; do not invent another.

## 3. Check contrast in both themes

For each pair below, compute contrast (WCAG 2.1): body text ≥ 4.5:1, large text (≥ 24px or 18.66px
bold) ≥ 3:1, UI borders ≥ 3:1 against the adjacent surface, focus ring ≥ 3:1 against both surfaces it
crosses.

| Pair | Light | Dark |
| --- | --- | --- |
| `--foreground` on `--background` | | |
| `--text-secondary` on `--background` | | |
| `--text-muted` on `--surface-muted` | | |
| `--accent-foreground` on `--accent` | | |
| `--border` on `--surface` | | |
| `--focus-ring` on `--background` and on `--surface` | | |

A failing pair is fixed in the token layer, not by nudging one component's colour. If `--accent` is too
light for white text, flip `--accent-foreground` to the dark neutral and re-check buttons,
`badge`, `chip-group` and `segmented-control` (they all derive from the pair).

## 4. Radius and density

```css
:root { --radius-control: 10px; }        /* default 8; keep the concentric rule: inner = outer − padding */
```

If density changes, change `--control-height-sm` and the row heights together, then verify
`data-grid`, `settings-page`, `sidebar` and `sortable-data-table`: those four are the ones that
hardcode row rhythm.

## 5. Verify

1. **Both themes**: every page screenshot twice; no light-only surface, no hard-coded `#fff`.
2. **Contrast table**: paste the six measured pairs per theme.
3. **Faces**: headings use the display face, body uses Inter, no weights above 500, no synthetic bold.
4. **Component sweep**: load the item list and open five: a control (`button`), a field (`input`), a
   data surface (`data-grid`), a chart (`horizon-chart`), an overlay (`popover`). If one looks off, the
   token layer is missing a slot, not the component.
5. **Logo colours**: third-party marks keep their real colours; never tint a partner logo with the
   accent.

## 6. Report

```
Brand: <name> · accent <value> · neutrals <warm/cool> · display <face> · radius <x>px
Contrast: light 6/6 · dark 6/6 (lowest 4.62 body, 3.11 border)
Touched: brand.css only · 0 component files
Verified: button, input, data-grid, horizon-chart, popover in both themes
```

## Failure modes

- **Themed by search-and-replace.** Replacing `--accent` values inside component modules breaks the
  shared layer and drifts on the next update. One token file only.
- **Accent used for status.** Green means success, red means danger; the brand accent must not be
  reused for "positive" unless it is also the success colour by definition.
- **Dark mode flipped, not designed.** Inverting lightness produces muddy surfaces; pick neutral steps
  per theme and re-check borders, which are the first thing to disappear.
