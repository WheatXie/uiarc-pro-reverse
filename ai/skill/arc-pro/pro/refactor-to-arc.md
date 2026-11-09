# Refactor to Arc

Migrate an existing surface — hand-rolled CSS, shadcn/ui, MUI, Chakra — onto Arc items without
changing what the page means. The rule: one item at a time, each with a parity check, never a
big-bang rewrite.

## 0. Freeze the baseline

Before any edit, capture what the page does today:

- Screenshot at 1440 and 390, light and dark.
- The interaction inventory: every button, field, menu, dialog, toast, table, and what it does.
- The state inventory: empty, loading, error, long content (a 60-character name, 40 rows, a negative
  number, a missing avatar).
- The copy inventory: headings, labels, helper text, empty states, errors. Copy survives the refactor;
  only markup changes.

Without the baseline there is no parity check, only vibes.

## 1. Map, do not translate

Read each region and name its job, then search the library (`search_components`, or
`catalog/<group>.md`) for the item that does that job. A 1:1 rename of the old component is usually
wrong: a Chakra `Table` with selection is `sortable-data-table`; a MUI `Dialog` that confirms a delete
is `confirm-morph`; a custom toast stack is `undo-toast` or `toast-stack`.

| Old | Job | Arc item | Why |
| --- | --- | --- | --- |
| `<MuiDialog>` delete confirm | confirm a destructive action | `confirm-morph` | it morphs the trigger into the surface and needs the name typed |
| hand-rolled `<table>` | read-only records | `sortable-data-table` | sorting, selection, sticky header |
| `<ChakraToast>` stack | undo a completed action | `undo-toast` | timer, merging, focus handoff |

Keep a `MIGRATION.md` table like the above in the repo. It is the artifact reviewers actually read.

## 2. Sequence

1. **Tokens first** — import `foundation.css`, delete the old theme constants, replace colour literals
   with semantic tokens. The page will look wrong here; that is expected and temporary.
2. **Controls, then containers** — `button`, `input`, `select`, `checkbox`, `switch`, `segmented-control`
   before `card`, `table`, `sidebar`. Controls carry most of the visual delta.
3. **One region per commit** — a region is a self-contained block of the page. Each commit ships with
   its parity note.
4. **Delete the old layer** — once a region is migrated, remove the old CSS module and the dependency
   it needed. Leftover scaffolding is how a refactor half-lands.

## 3. Parity checks per region

Run these on the migrated region and the baseline side by side:

- **Copy** — byte-identical strings, unless the migration fixes a style violation (say so explicitly).
- **Behaviour** — every interaction from the inventory still exists, including keyboard paths
  (Tab order, Enter/Space activation, Escape, arrow keys in menus and tables).
- **States** — the four states from the inventory render, with the same trigger conditions.
- **Numbers** — any computed value (totals, counts, percentages) matches to the digit.
- **Widths** — 390 and 1440 for the region, not the page: no new overflow, no clipped labels.
- **A11y** — roles and labels survive; a control that had an `aria-label` still has one.

A region is done when all six pass, not when it "looks like Arc".

## 4. Framework-specific traps

| From | Trap | Correct move |
| --- | --- | --- |
| shadcn/ui | dropping `<Accordion>` while a route still imports its CSS variables | delete the tailwind class strings and the CSS vars with it; Arc items ship CSS Modules |
| MUI | `sx` props carrying spacing that Arc expresses as `--space-*` | map spacing to the token scale, do not inline pixels |
| Chakra | `useColorModeValue` duplicating token logic | one `data-theme` attribute, tokens resolve both modes |
| hand-rolled | global element selectors (`button{...}`, `div.card`) | scope to the region while migrating, delete at the end |
| any | keeping both libraries "for now" | the next agent will build new UI in the old one; remove it in the same PR that finishes the last region |

## 5. Report

```
Regions migrated: 5/5 · items: 12 · old dependencies removed: @mui/material, emotion, styles/legacy.css
Parity: copy 42/42 strings, behaviour 31/31 interactions, states 8/8, widths 390/1440 ok
Deltas accepted: <list, each with a reason>
```

## Failure modes

- **Big-bang rewrite.** No parity check is possible, review becomes taste.
- **Half migration.** Both systems alive; the next feature picks the old one. Finish and delete.
- **Copy drift.** Silently "improving" strings during a migration hides behaviour changes in review.
- **Restyling Arc items to match the old look.** If the old look matters, express it in the token layer
  (see [design-system-generation.md](design-system-generation.md)), not in component overrides.
