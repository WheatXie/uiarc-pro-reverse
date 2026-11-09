# Arc Pro playbooks

Six long-form workflows for whole surfaces, not single components. Each one assumes the library is
available: either this repository (`src/components/arc/`, 380 items) or the local MCP server
(`search_components`, `get_component`, `get_install_command`).

Pick one, read it end to end, then run it. They are written as procedures with checkpoints, because
the failure mode for large UI work is not a wrong component, it is skipping a state or a width.

| Playbook | Use when | Stops with |
| --- | --- | --- |
| [full-page-generation.md](full-page-generation.md) | "build me a page / dashboard / settings screen / pricing page" from a brief | a region-by-region plan, then a built page, then a verification pass: or just the plan if the brief is thin |
| [design-system-generation.md](design-system-generation.md) | "make it look like our brand", a new theme, dark mode, an accent change | a token layer on `foundation.css` with contrast checked in both themes |
| [refactor-to-arc.md](refactor-to-arc.md) | "migrate this page from shadcn/ui, MUI, Chakra, or hand-rolled CSS" | item-by-item mapping with parity checks, no visual regressions |
| [motion-audit.md](motion-audit.md) | "the animations feel off", "make it feel finished", a performance complaint | an inventory table, token assignments, deleted motion, reduced-motion coverage |
| [responsive-audit.md](responsive-audit.md) | "check it on mobile", overflow, tables on phones, touch targets | measurements at five widths, fixes, re-measure |
| [accessibility-audit.md](accessibility-audit.md) | "audit a11y", keyboard traps, contrast, screen reader behaviour | a ranked list of findings with patches, not a checklist recital |

## Before any playbook

1. **Locate the library.** In this repo: `src/components/arc/<id>/`. In another project: run
   `get_install_command` for the ids you need, or `npx shadcn@latest add @uiarc/<free-id>`.
2. **Confirm the shell.** `foundation.css` imported once, Geist and Inter loaded, `--font-body` and
   `--font-display` set. A missing `foundation.css` makes every item look wrong and sends you chasing
   the wrong bug.
3. **Read the item, not the screenshot.** `get_component {id}`: the "When not to use" line and the
   API reference. Most defects in generated UI come from inventing props.
4. **Write down the widths and states you will verify** before you start. Every playbook ends by
   checking the same four widths (390, 768, 1024, 1440) and the same state set (empty, loading,
   error, long content, dark).

## Ground rules across all six

- Compose, do not restyle. If a look cannot be reached with tokens and documented props, the answer is
  a different item, not a CSS override into an item's internals.
- One page container. Blocks own their own padding; never wrap a block in another card.
- Semantic tokens only. If a value is not a token, it does not belong on an Arc surface.
- Every change ends with the review loop in [checklist.md](../checklist.md), not with "looks good".
- Report measurements, not impressions: "table scrolls at 390, card height 612 → 640" beats "mobile
  looks fine".
