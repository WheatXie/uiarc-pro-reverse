# uiarc clone — local component workbench

A self-hosted, source-available component library with the same information architecture as a
docs-style component catalog: sidebar with search + Free/Pro filter + Docs tree, and per-item
pages with a **Preview / Code** switch.

Every component in here is implemented from scratch in this repo and shipped as plain files you
can copy out — no external registry, no runtime fetch.

## Stack

- Vite 8 + React 19 + TypeScript
- Tailwind CSS v4 (`@theme` tokens in `src/index.css`)
- react-router-dom for the docs routes

## Run

```bash
pnpm install
pnpm dev      # http://localhost:5183
pnpm build
```

## Layout

```
src/
  App.tsx                     routes + shell
  registry.ts                 THE catalog: one entry per component
  site/Sidebar.tsx            search, All/Free/Pro filter, Docs tree, section counts
  pages/HomePage.tsx          landing + /docs/:slug
  pages/ComponentPage.tsx     preview / code tabs, file switcher, copy button
  components/
    emoji-picker/
      EmojiPicker.tsx         panel: search, sticky sections, skin tones, keyboard nav
      emoji-data.ts           dataset adapter, tone application, search scoring
      hooks.ts                recent-emoji memory (localStorage), click-outside
      demo.tsx                input + anchored popover demo
  data/emoji-groups.json      unicode-emoji-json (MIT) — 9 groups, ~1900 emoji
```

## Comment thread

`src/components/comment-thread/` — message list + composer at the reference scale (956px card, 20/20.5px type):

- gradient avatars (no initials), name + body rhythm
- composer that auto-grows and seeds the emoji panel (`?picker=1` to preview it open)
- send button morphs grey → ink when the draft is non-empty, arrow lifts on hover, presses to 0.94
- entrance: card 620ms spring-in, rows staggered 55ms, popover 220ms with overshoot, focus ring 200ms
- `Enter` sends, `Shift+Enter` breaks the line, `Esc` closes the panel
- `prefers-reduced-motion` kills every transform

## Adding a component

1. Drop the implementation in `src/components/<slug>/`.
2. Export a `Demo` from `src/components/<slug>/demo.tsx`.
3. Register it in `src/registry.ts` with `?raw` imports so the Code tab shows real source:

```ts
{
  slug: 'chip-group',
  title: 'Chip Group',
  section: 'components',   // components | blocks | special
  tier: 'free',            // free | pro
  summary: '…',
  Demo,
  files: [{ name: 'ChipGroup.tsx', code: src }],
  deps: ['React only'],
}
```

Section counts in the sidebar are derived from the registry — no manual bookkeeping.

## Emoji picker notes

- Search scores prefix matches first, then substring, then slug matches.
- Sections are sticky-scrolled; the active category icon is computed from section offsets.
- Skin tone appends the Fitzpatrick modifier (U+1F3FB–U+1F3FF) for the ~single-codepoint people/
  hand emoji that support it.
- Recents persist under `uiarc:emoji-recent`.
- `?open=1` in the URL opens the demo popover (handy for screenshots).
