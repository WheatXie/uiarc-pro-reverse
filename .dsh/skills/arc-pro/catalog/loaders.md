# Loaders

## `black-hole` · Black hole (Pro, special)

A delete transition that pulls the chosen items into a tiny singularity while the rest of the list bends around it; undo spins them back out.

When to use:
- Deleting or archiving a handful of selected rows, cards, or files, with an Undo right after.
- Emptying a trash, clearing notifications, or dismissing a batch where the removal should feel final.

When not to use:
- High frequency deletes such as clearing a single chip or tag. Use a quick height collapse instead.
- Irreversible actions without undo. The spectacle should not stand in for a confirmation.

Keywords: special, motion, webgl, new, delete animation, archive transition, black hole, singularity, gravitational lensing, spiral, undo, remove items, list delete

Files: src/components/arc/black-hole/black-hole.module.css, src/components/arc/black-hole/black-hole.tsx, src/components/arc/black-hole/demo.module.css, src/components/arc/black-hole/demo.tsx

## `charge-session` · Charge session (Pro, special)

An EV or device charging card. Energy packets flow from a charger along the cable into the battery pack, which fills toward a draggable charge limit. The charge curve tapers near full, and power, energy, time to limit and cost update live. Stop charging drains the flow.

When to use:
- An EV or fleet app that shows a live charging session with a charge limit.
- A charge point operator console where staff watch power, energy and cost for one bay.

When not to use:
- Use usage-meter or progress for a static quota or a simple percentage.
- Use gauge for a single live reading without a session, curve or cost.

Keywords: special, motion, progress, energy, new, ev charging, charging, battery, charge session, electric vehicle, charge limit, charge curve, time to full, kwh, cost, fleet, charger, power

Files: src/components/arc/charge-session/charge-session.module.css, src/components/arc/charge-session/charge-session.tsx, src/components/arc/charge-session/demo.module.css, src/components/arc/charge-session/demo.tsx

## `morph-loader` · Morph loader (Pro, special)

Tiny loaders that morph between shapes and fold into a check or a cross when done.

When to use:
- Inline progress inside a button, row, or field where the result should appear in the same spot.
- Short operations that end in a clear success or failure, such as save, publish, or upload.

When not to use:
- Use progress when the percentage is known.
- Use skeleton when content is loading into a layout.

Keywords: special, loading, new, loader, spinner, loading indicator, morphing loader, success check, error cross, loading to check, svg spinner

Files: src/components/arc/morph-loader/demo.module.css, src/components/arc/morph-loader/demo.tsx, src/components/arc/morph-loader/morph-loader.module.css, src/components/arc/morph-loader/morph-loader.tsx

## `skeleton-morph` · Skeleton morph (Pro, special)

Loading skeletons that grow into the real content, block by block, instead of swapping.

When to use:
- Profile cards, feeds, and lists that load in under a few seconds.
- Dashboards where the layout is known before the data arrives.

When not to use:
- Use skeleton for long lists of hundreds of rows; layout animation there is costly.
- Use a progress indicator when loading takes more than a few seconds.

Keywords: special, loading, motion, new, skeleton loader, loading skeleton, skeleton morph, shared layout loading, content placeholder, shimmer loading, react skeleton animation

Files: src/components/arc/skeleton-morph/demo.tsx, src/components/arc/skeleton-morph/skeleton-morph.module.css, src/components/arc/skeleton-morph/skeleton-morph.tsx

## `stretch-refresh` · Stretch refresh (Pro, special)

Pull a feed down and a line stretches to tell you when to let go.

When to use:
- Timelines, inboxes, and activity feeds where new entries arrive at the top.
- Panels that should support pull to refresh by touch, mouse drag, and trackpad scroll.

When not to use:
- Use a plain list for static content that never refreshes.
- Use pagination for paging through older items.

Keywords: special, motion, react pull to refresh, pull to refresh, refresh feed, rubber band refresh, mobile pull down refresh, feed refresh animation

Files: src/components/arc/stretch-refresh/demo.tsx, src/components/arc/stretch-refresh/stretch-refresh.module.css, src/components/arc/stretch-refresh/stretch-refresh.tsx
