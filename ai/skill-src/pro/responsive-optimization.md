# Responsive audit

Measure five widths, fix overflow, layout and touch, then measure again. Responsive bugs are found by
numbers, not by resizing a window until something looks odd.

## 1. The five widths

| Width | What it represents | What usually breaks |
| --- | --- | --- |
| 390 | phone, one hand | tables, two-column forms, fixed sidebars, long labels |
| 600 | large phone / small tablet | grids that only have one breakpoint |
| 768 | tablet portrait | split views that should stack |
| 1024 | small laptop | sidebars that should collapse, dialogs that should become sheets |
| 1440 | desktop reference | line length, an over-wide table, a stretched hero |

Everything below 900px in Arc drops page chrome to full bleed; items inside switch to their own
container queries at 560/520/420/400px. Test the item, then the page.

## 2. Measurement script

Paste in the console on the page, or run through Playwright. It reports the failures, not an opinion.

```js
const widths = [390, 600, 768, 1024, 1440];
for (const w of widths) {
  await page.setViewportSize({ width: w, height: 900 });
  const r = await page.evaluate(() => {
    const de = document.documentElement;
    const overflow = de.scrollWidth - de.clientWidth;
    const clipped = [...document.querySelectorAll("*")]
      .filter((el) => {
        const s = getComputedStyle(el);
        if (s.overflowX !== "visible" || s.position === "fixed") return false;
        return el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0;
      })
      .slice(0, 8)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 40)} ${el.scrollWidth}>${el.clientWidth}`);
    const small = [...document.querySelectorAll("button, a, [role=button], input, select, textarea")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.width < 44 || r.height < 44);
      })
      .slice(0, 8)
      .map((el) => `${el.tagName.toLowerCase()}[${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24)}] ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`);
    return { overflow, clipped, small };
  });
  console.log(w, JSON.stringify(r));
}
```

Pass conditions: `overflow === 0` at every width; `clipped` empty except elements with an intentional
inner scroller (a table card, a code block); `small` empty for touch-primary controls at 390 (a 32px
icon button in a dense desktop toolbar may stay small at 1440).

## 3. Fix order

1. **Page overflow** — find the widest element (the script's `clipped` list plus
   `document.body.getBoundingClientRect().width`). Usually a fixed width, a `min-width`, a long
   unbreakable string, or a grid with `grid-template-columns: 320px 1fr` that never collapses.
2. **Split layouts** — a list + detail becomes list → detail (route or sheet), not two squeezed panes.
   Arc items that already do this: `search-results` (facet sheet), `settings-page` (nav collapses),
   `ai-side-panel` (dock becomes a sheet at < 640px with a scrim).
3. **Tables** — never shrink columns below readable; the card scrolls horizontally with a sticky first
   column, or the block switches to cards (`data-grid`, `sortable-data-table` both ship this).
4. **Text** — raise the wrap instead of shrinking type: `overflow-wrap: anywhere` for identifiers,
   `text-wrap: balance` for headings, truncation with a title on single-line labels only.
5. **Touch** — 44×44 minimum for primary actions; increase hit area with padding, not with a bigger
   icon; keep 8px between adjacent targets.
6. **Chrome** — below 900px hide the desktop sidebar, keep the top bar, move the primary action into a
   sticky bottom bar if it was in a side rail.

## 4. Re-measure

Run the script again on the same five widths and paste the result. Then check the three interaction
widths that break most often: a dialog at 390 (does it become a sheet?), a menu at 1024 (does it flip
above the trigger?), a hover-only affordance at 390 (is there a tap equivalent?).

## 5. Report

```
Widths: 390 / 600 / 768 / 1024 / 1440
Overflow: 0 at all five (was 137px at 390)
Clipped: 0 unintentional (table card scrolls by design)
Touch: 0 targets under 44px at 390 (was 9)
Changed: sidebar → sheet <900, table → cards <640, hero grid 1 col <768
```

## Failure modes

- **Shrinking text to fit.** 11px body copy on a phone is a bug even if nothing overflows.
- **`overflow-x: hidden` on `body`.** It hides the symptom and breaks `position: sticky` ancestors.
- **Testing only 375 and 1440.** The 600–1024 band is where split layouts and dialogs fail.
- **Hover-only actions.** Anything revealed on hover needs a visible affordance on touch.
- **One breakpoint.** Items in Arc use container queries; a page with a single 768px breakpoint will
  break whenever it is placed in a narrower column.
