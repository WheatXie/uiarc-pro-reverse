# AGENTS.md

Read this before touching the repo. It is written for an agent taking over, not for a human reading a
landing page.

## What this repo is

A reconstruction of [uiarc.dev](https://uiarc.dev)'s gated library: **233 Pro items** (17 components,
113 blocks, 103 special components) rebuilt as plain React source, plus the **147 free registry items**
copied verbatim. 380 ids in total, every one a directory under `src/components/arc/` (`blocks/<id>/` for
the free blocks), with docs in `public/docs/`. 233 of them also have a live preview page.

Nothing here calls the site at runtime. The code tab reads local files through `import.meta.glob`.

## Commands

```bash
pnpm install            # once
pnpm dev                # http://localhost:5183 (the docs shell; keep it running while verifying)
pnpm build              # tsc --noEmit && vite build
npx tsc --noEmit        # type gate
node ai/build.mjs       # rebuild ai/data/index.json + ai/skill/arc-pro from the catalogue
node scripts/sync-free.mjs   # re-check the free half against the public registry (dry run)
node ai/mcp/smoke.mjs   # assert the MCP tool surface + 10 intent rankings
node scripts/smoke.mjs  # every item page: 200, preview mounts, code files present, 0 console errors
```

## Using the library

Find the item first, read its docs, then compose.

```bash
cd ai/mcp && pnpm install && cd ../..       # once, self-contained (ai/mcp is its own package root)
node ai/mcp/server.mjs                      # stdio MCP server (search_components, get_component, …)
node ai/install.mjs --claude                # write .mcp.json + link .claude/skills/arc-pro
node ai/install.mjs --all                   # every supported client, see ai/README.md
node ai/install.mjs --dsh                   # DeepSeek: .dsh/skills/arc-pro copy + cordis `insert` entry
```

Tools: `search_components` (intent → ids with use / not-for), `list_components` (55 groups),
`get_component` (docs, source, or both; `section` to narrow), `get_install_command`,
`get_skill` (including `catalog/<group>.md`).

Skill: `ai/skill/arc-pro/` — `SKILL.md`, `INSTRUCTIONS.md`, `components.md` (all 380 ids), `catalog/`
per group, 10 rule files, 3 worked examples, and `pro/` playbooks for whole-surface work
(full-page generation, design system, refactor, motion, responsive, accessibility).

## Rules for UI work here

- Use an Arc item before writing UI; follow its "When not to use" line.
- Compose, never restyle item internals. Brand changes go in a token layer over `foundation.css`.
- Semantic tokens only: `--background`, `--surface`, `--surface-muted`, `--foreground`,
  `--text-secondary`, `--text-muted`, `--border`, `--accent`, `--radius-*`, `--space-*`.
- One page container; blocks own their padding; no nested cards.
- Type: Geist for h1–h3, Inter elsewhere, weights 400/500 only.
- Motion from `lib/motion-tokens.ts`; animate transform/opacity; honour reduced motion.
- Every data region ships empty, loading, error and long-content states.
- Check 390, 768, 1024, 1440: no horizontal scroll, touch targets ≥ 44px.

## Changing the library itself

An item lives in `src/components/arc/<slug>/` as `<slug>.tsx`, `<slug>.module.css` and a `demo.tsx`
that auto-registers in `src/previews.ts` via `import.meta.glob`.

Porting or repairing an item has two gates, and both must pass:

```bash
node scripts/dom-diff.mjs <slug> [--kind=block]        # same tree, boxes ±1px, text, roles
STABLE=1 PYTHON=/Users/melonte/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3 \
  node scripts/compare.mjs <slug> [--kind=block]       # pixel score, target ≥ 99
```

Animated demos need `STABLE=1` (settled frame); some need `WAIT=<ms>`. `docs/PORTING-BRIEF.md` lists
every measured shell quirk (heading face, preflight gaps, flattening, specificity traps) — read it
before editing a port, and prefer a documented, measured workaround over a global change.

After adding an item: `node ai/build.mjs`, then `pnpm build`, then `node scripts/smoke.mjs`.

## Do not

- Add a dependency the item does not import (`motion`, `lucide-react`, Radix primitives are present).
- Edit `src/frame/*`, `src/data/frames.json` or `src/index.css` to fix one item; those are shared and
  every change there is verified against the whole corpus.
- Commit `captures/` (regenerable) or `node_modules`.
- Leave `.probe-*` scratch files behind; name them `.probe-<slug>-<task>.mjs` while working.
