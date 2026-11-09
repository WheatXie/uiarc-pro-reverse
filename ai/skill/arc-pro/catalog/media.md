# Media

## `card-stack` — Card stack (Free, component)

Review a deck one card at a time, with a throw and an undo.

When to use:
- One-by-one triage such as shortlisting, review queues, or onboarding picks.
- Decks where swiping left or right should be undoable.

When not to use:
- Use a list or sortable-data-table when people compare items side by side.
- Use carousel to browse items without deciding.

Keywords: gesture, motion, triage, react card stack, swipe cards, tinder swipe, swipeable card deck, card triage, swipe left right

Files: registry/components/card-stack/card-stack.tsx, registry/components/card-stack/card-stack.module.css

## `carousel` — Carousel (Free, component)

Browse a row of slides by dragging, flicking, or arrowing through them.

When to use:
- A short set of peer items where neighbouring slides hint at more.
- Galleries browsed by drag, flick, trackpad swipe, or keys.

When not to use:
- Use cover-flow for a showpiece gallery and photo-grid to show everything at once.
- Use card-stack for deciding on items one at a time.

Keywords: carousel, slider, gallery, react carousel, image slider, swipe carousel, autoplay carousel, accessible carousel, slideshow component

Files: registry/components/carousel/carousel.tsx, registry/components/carousel/carousel.module.css

## `gantt-timeline` — Gantt timelineNew (Pro, block)

A project timeline with draggable, resizable bars, dependency arrows that follow them, and animated zoom.

When to use:
- Planning work across weeks or months where tasks depend on each other.
- Roadmaps that people reschedule by dragging, with undo and conflict warnings.

When not to use:
- Use project-board for status columns without dates.
- Use week-calendar for time slots within days.

Keywords: react gantt chart, gantt timeline, project timeline, drag to reschedule, task dependencies, roadmap timeline, project planning chart, resizable task bars

Files: demo.tsx, gantt-timeline.module.css, gantt-timeline.tsx

## `image-compare` — Image compare (Free, component)

Drag a divider across two images to see what changed.

When to use:
- Before and after visuals such as photo edits, redesigns, or cleanup results.
- Top and bottom comparisons, via orientation vertical.

When not to use:
- Use carousel to browse many images.
- Use resizable-panels to split live content rather than images.

Keywords: before after, comparison, image, react image compare, before after slider, image comparison slider, compare images, photo diff slider

Files: registry/components/image-compare/image-compare.tsx, registry/components/image-compare/image-compare.module.css

## `release-readiness` — Release readiness (Pro, block)

A launch checklist that keeps prerequisites, progress, and the final action together.

When to use:
- A pre-launch or handoff gate where several checks must be done before one action unlocks.
- Release or launch checklists with a readiness bar and owners.

When not to use:
- Use onboarding-checklist for a user's own getting-started tasks.

Keywords: react release checklist, launch readiness, pre release checklist, deploy gate, checklist with progress bar, handoff checklist

Files: demo.tsx, release-readiness.module.css, release-readiness.tsx
