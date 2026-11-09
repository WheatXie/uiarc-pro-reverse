# Motion audit

Inventory every animation, assign it a token, delete the ones that explain nothing. Motion is a
sentence about what changed; if the change is obvious, the sentence is noise.

## 1. Inventory

Search the codebase for every source of motion, then tabulate. One row per animated element, not per
keyframe.

```bash
# CSS
rg -n "transition|animation|@keyframes|animate\(" src --glob '*.css'
# React
rg -n "motion\.|AnimatePresence|useSpring|animate\(|whileHover|whileTap|layoutId" src --glob '*.tsx'
```

| # | Element | Trigger | Property | Duration | Easing | Purpose | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | row delete | user action | height/opacity | 240ms | spring.smooth | shows which row left | keep |
| 2 | hero headline | page load | y + opacity | 600ms | ease-out | none | delete |
| 3 | tab indicator | tab change | x | 280ms | spring.morph | shows where you are | keep |

"Purpose" must name the change being explained. If the cell cannot be filled without the word
"polish", the verdict is delete.

## 2. Assign tokens

Arc ships motion tokens in `src/components/arc/lib/motion-tokens.ts` (`motionTokens`) and CSS
variables in `foundation.css`:

| Token | Use for |
| --- | --- |
| `spring.smooth` | panels, sheets, height changes, anything that reports state |
| `spring.snappy` | presses, toggles, small commits |
| `spring.morph` | a shared highlight travelling between positions (`layoutId`) |
| `--duration-instant` + `--ease-standard` | CSS-only state (hover tint, focus ring) |
| `--ease-enter` / `--ease-exit` | entering and leaving overlays where spring is unavailable |
| `--ease-in-out` | looping ambient motion only (a marquee, a live dot) |

Rules:

- Duration follows distance: under 8px or a colour change, use `--duration-instant`; a surface opening
  uses `spring.smooth` with `visualDuration` 0.22–0.34. Nothing UI-level exceeds 400ms.
- Animate `transform` and `opacity`. Animating `height`, `top`, `left`, `width`, `filter: blur` on a
  large node costs a repaint per frame; use `layout`/`layoutId` or a measured height instead.
- One movement per interaction. Two elements may move if they are one object (a panel and its shadow).
- Stagger by 20–40ms, at most four steps. Beyond that it reads as a slideshow.
- Never animate on scroll into view twice; once per session per element.
- Loop only when the loop carries meaning (a live indicator, an active recording). A floating card that
  bobs forever explains nothing.

## 3. Delete

Cut in this order, hardest first:

1. **Load animations** on text, cards, images — nobody learns anything.
2. **Hover movement** (lift, scale, tilt) where a background or border change already signals hover.
3. **Looping decoration** (pulsing badges, drifting gradients, floating shapes).
4. **Repeated entrance** on every re-render or scroll pass.
5. **Chained sequences** longer than 400ms in total.

Keep: state transitions the user caused (open/close, select, insert, remove, progress), shared-element
morphs that carry identity, and the `shake`/`refuse` feedback on an invalid action.

## 4. Reduced motion

Every animation needs a path when `prefers-reduced-motion: reduce`:

- Springs become instant state changes (`animate()` skipped, or `transition: none`).
- Scroll-driven reveals render final state immediately.
- Canvas/WebGL scenes freeze on a representative frame (the reconstructed items do exactly this).
- Loops stop; live indicators keep a static dot.

In `motion`, use `useReducedMotion()`; in CSS, gate the rule:

```css
@media (prefers-reduced-motion: reduce) {
  .panel { transition: none; }
}
```

Verify with DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`, then click through the
flow: nothing should move, nothing should be left invisible.

## 5. Verify

- **60fps check** — Performance panel while opening the heaviest overlay; no long tasks over 50ms, no
  layout thrash in the waterfall.
- **Interrupt test** — open, close, reopen quickly; no orphaned element stays on screen, no queue of
  pending animations fires late.
- **Keyboard parity** — a keyboard-triggered open animates the same as a pointer one; focus lands
  after the motion, not during.
- **Reduced motion** — as above, every state change still works.
- **Contrast during motion** — a fading element must not pass through low-contrast text at 40% opacity
  and stop there; fade from 0 to 1, not 0.4 to 1.

## 6. Report

```
Animations found: 27 · kept 14 · retimed 6 · deleted 7
Tokens: spring.smooth ×9, spring.morph ×3, instant ×2
Reduced motion: 14/14 covered (5 instant, 4 frozen canvas, 5 CSS none)
Perf: heaviest overlay 0 long tasks, 58–60fps
Deleted: hero fade, card hover lift, badge pulse, 3 looping gradients, scroll reveal on 4 sections
```

## Failure modes

- **Everything springs.** Uniform timing removes hierarchy; the same spring on a tooltip and a page
  transition reads as sluggishness.
- **Motion as a substitute for hierarchy.** If a card needs a lift to be noticed, fix the layout.
- **Layout shift dressed as animation.** Animating `height` on a container that also holds focus
  causes jumps; measure, then animate `transform`.
- **Reduced motion treated as "remove all transitions".** That breaks feedback like a refused action;
  replace movement with a static cue instead.
