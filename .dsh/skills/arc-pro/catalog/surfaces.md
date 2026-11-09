# Surfaces

## `card-to-article` · Card to article (Pro, special)

Story cards that open into full articles with one seamless morph and shrink back into their exact slot when dragged down.

When to use:
- Blogs, journals, and changelogs where each entry has a strong image.
- Case study and portfolio grids.

When not to use:
- Use a normal link to a page when articles are long or need their own URL and SEO.
- Use expandable-card for small inline details.

Keywords: special, layout, gesture, new, app store card, card expand, shared element transition, card to detail, magic motion, expanding card, blog grid, article modal

Files: src/components/arc/card-to-article/card-to-article.module.css, src/components/arc/card-to-article/card-to-article.tsx, src/components/arc/card-to-article/demo.tsx

## `control-center` · Control center (Pro, special)

Workspace quick settings: tiles that morph into detail, a duration dial, and rubber-banded meters.

When to use:
- A quick settings panel with a handful of toggles and levels for a web workspace.
- Focus session controls with a duration dial and allowed people.

When not to use:
- Use switch, slider, and radio-group directly in a regular settings form.
- Use time-dial to pick a time across time zones.

Keywords: special, settings, control center, react control center, quick settings panel, ios control center, settings toggles, focus mode ui, volume slider panel

Files: src/components/arc/control-center/control-center.module.css, src/components/arc/control-center/control-center.tsx, src/components/arc/control-center/demo.module.css, src/components/arc/control-center/demo.tsx

## `holo-card` · Holo card (Pro, special)

A member card that tilts toward you with a holographic foil and flips to its back.

When to use:
- A membership or subscription card on an account or welcome page.
- A shareable profile, badge, or achievement that people will screenshot.

When not to use:
- Use card for ordinary content; the effect is too loud for lists.
- Use depth-cards when several items need a subtle parallax.

Keywords: special, motion, new, holographic card, holo card, foil card, pokemon card effect, tilt card, 3d card flip, membership card, gyroscope tilt, shiny card

Files: src/components/arc/holo-card/demo.module.css, src/components/arc/holo-card/demo.tsx, src/components/arc/holo-card/holo-card.module.css, src/components/arc/holo-card/holo-card.tsx

## `link-unfurl` · Link unfurl (Pro, special)

A composer where pasting a URL shows a loading shimmer on the link, then unfurls it into a rich preview card with title, image and favicon in one morph, which can be collapsed back to the inline link or removed.

When to use:
- A message or comment composer where pasted links should show what they point to before sending.
- Product marketing that shows how a chat or notes app handles links.

When not to use:
- Use hover-card to preview a link someone reads, not writes.
- Use mention-input when the tokens are people or records rather than web links, and rich-text-editor for long formatted documents.

Keywords: special, composer, link-preview, morph, motion, new, link preview, unfurl, open graph, og image, rich link, embed, url preview, chat input, slack, paste link

Files: src/components/arc/link-unfurl/demo.tsx, src/components/arc/link-unfurl/link-unfurl.module.css, src/components/arc/link-unfurl/link-unfurl.tsx

## `sheet-stack` · Sheet stack (Pro, special)

Nested sheets that stack with depth, drag to dismiss, and become stacked dialogs on wide screens.

When to use:
- Mobile settings where each row opens a deeper page and back should feel spatial.
- Nested pickers, such as choosing a workspace and then a project inside it.

When not to use:
- Use dialog for a single confirmation or form with no nested steps.
- Use bottom-sheet for one sheet with snap points.

Keywords: special, new, react sheet stack, nested bottom sheets, stacked modals, drill down sheet, ios sheet stack, nested dialogs, draggable sheet, sheet navigation

Files: src/components/arc/sheet-stack/demo.tsx, src/components/arc/sheet-stack/sheet-stack.module.css, src/components/arc/sheet-stack/sheet-stack.tsx

## `wallet-stack` · Wallet stack (Pro, special)

Fan a stack of cards and lift one out to see its activity.

When to use:
- A few payment cards, passes, or memberships where people open one to see its balance and activity.
- Fintech or wallet screens that want a physical card metaphor with realistic materials.

When not to use:
- Use card-stack for generic swipeable content that is not a card wallet.
- Use a plain list or data-grid for many accounts.

Keywords: special, wallet, cards, react wallet, credit card stack, apple wallet ui, payment cards component, card stack animation, fintech card ui

Files: src/components/arc/wallet-stack/demo.module.css, src/components/arc/wallet-stack/demo.tsx, src/components/arc/wallet-stack/wallet-stack.module.css, src/components/arc/wallet-stack/wallet-stack.tsx
