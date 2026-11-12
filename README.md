# uiarc-pro-reverse

English · [简体中文](./README.zh-CN.md)

**Every gated Pro component of [uiarc.dev](https://uiarc.dev) — 233 of them — rebuilt as plain, runnable React source.**

The site ships its components to the browser to render the free preview frame, but keeps the *source*
behind a Pro account. This repo reconstructs that source from the shipped artifacts and re-hosts it as a
local docs site with live previews, copyable code and pixel-parity verification against the original.

![Item page — preview stage, Code tab and docs](docs/screenshot-component.png)

```
233 / 233 items reconstructed · mean pixel score 99.91 · 196 items ≥ 99.95 · 139 byte-identical DOM trees
```

| Field | Value |
| --- | --- |
| Components | 17 Pro components + 103 special components |
| Blocks | 113 Pro blocks |
| Stack | Vite 8 · React 19 · TypeScript (strict) · CSS Modules · `motion` · Radix UI · lucide |
| Verified against | live preview frames at 1280×900 @2x, plus a structural DOM diff |
| Result table | [REPORT.md](REPORT.md) — one row per item, both sampling modes |
| Method | [METHOD.md](METHOD.md) — how the artifacts were read, every known residue |

## Quick start

```bash
pnpm install
pnpm dev        # http://localhost:5183
pnpm build      # tsc --noEmit && vite build
```

Each item lives at `/components/<slug>` (components and special components) or
`/components/blocks/<slug>` (blocks); `/frame/<slug>` renders the bare preview used for comparison.

## What is in here

- **`src/components/arc/<slug>/`** — 233 self-contained ports: `<slug>.tsx`, `<slug>.module.css`
  (de-hashed from the CSS Module the site ships, declarations kept byte-faithful) and a `demo.tsx`
  that auto-registers for the docs page.
- **`src/site/`** — the docs shell: sidebar with search and scope filters, item pages with a Preview /
  Code pair, per-item markdown docs, in-page nav.
- **`src/components/arc/foundation.css`** — the design tokens (colour, radii, elevation, easing) taken
  from the site's public registry item.
- **`public/media`, `public/block-logos`, `public/docs`** — the image fixtures and 267 markdown docs the
  demos and pages need, pulled from the same public routes.

Nothing here fetches a registry at runtime: the code tab reads local files through
`import.meta.glob`, so the whole catalogue works offline.

## Use it from an AI agent

The site offers two AI paths: a remote MCP server that needs an Arc account and only returns Pro
source on a paid plan, and a skill whose catalogue lists free items. Both are replaced here with local
equivalents that know **all 380 ids** — 233 Pro plus 147 free — and can hand back the source.

```bash
cd ai/mcp && pnpm install && cd ../..   # once: @modelcontextprotocol/sdk + zod
node ai/install.mjs --claude            # project .mcp.json + .claude/skills/arc-pro link
node ai/install.mjs --all               # every supported client (see below)
node ai/mcp/smoke.mjs                   # 17 assertions over the tool surface
```

| MCP tool | Answers |
| --- | --- |
| `search_components` | intent → ranked ids with the reason to use each and the reason not to |
| `list_components` | browse 55 groups by kind, tier or group |
| `get_component` | docs (when to use, usage, API reference, keyboard, a11y, motion, responsive) + source files |
| `get_install_command` | shadcn command for free items, copy recipe for Pro items |
| `get_skill` | any skill file, including per-group catalogues and the playbooks |

### Installing into a client

`ai/install.mjs` writes the config each client expects and copies or links the skill. Existing files
are merged, never replaced; run it with no flag to see what it would do, or `--print` for the raw JSON.

| Flag | Writes | Client picks it up from |
| --- | --- | --- |
| `--claude` | `.mcp.json` (project scope, committed) + `.claude/skills/arc-pro` symlink | Claude Code in this repo |
| `--claude-user` | `~/.claude/skills/arc-pro` | Claude Code, every project |
| `--cursor` | `.cursor/mcp.json` + `.cursor/rules/arc.mdc` | Cursor, this repo |
| `--vscode` | `.vscode/mcp.json` | VS Code Copilot Chat agent mode |
| `--codex` | `[mcp_servers.arc-pro]` in `~/.codex/config.toml` | Codex |
| `--agents` | `~/.agents/skills/arc-pro` | agents that read `~/.agents/skills` |
| `--dsh` | `.dsh/skills/arc-pro` copy + `mcp-arc-pro` insert in the DeepSeek Harness profile | DeepSeek Harness |

By hand, the same pair works anywhere:

```json
{ "mcpServers": { "arc-pro": { "command": "node", "args": ["/abs/path/uiarc/ai/mcp/server.mjs"] } } }
```

```bash
claude mcp add arc-pro -- node "$PWD/ai/mcp/server.mjs"   # instead of editing .mcp.json
```

### Skill and playbooks

`ai/skill/arc-pro/` is a normal skill folder (`SKILL.md` front matter `name: arc-pro`): the 10 Arc rule
files verbatim, `INSTRUCTIONS.md` (always-on rules for `AGENTS.md` / `CLAUDE.md`), a generated
`components.md` over all 380 ids, `catalog/<group>.md` for per-item detail, and `pro/` — six playbooks
for whole surfaces:

| Playbook | Use when |
| --- | --- |
| `pro/full-page-generation.md` | build a page region by region, with every state, or just the plan |
| `pro/design-system-generation.md` | brand theme on Arc tokens, contrast checked in both themes |
| `pro/refactor-to-arc.md` | migrate from shadcn/ui, MUI, Chakra or hand-rolled CSS with parity checks |
| `pro/motion-recommendations.md` | inventory animations, assign tokens, delete decoration |
| `pro/responsive-optimization.md` | measure five widths, fix overflow and touch, re-measure |
| `pro/accessibility-audit.md` | ranked findings with patches, not a checklist |

Every item, free or Pro, is a directory under `src/components/arc/`, so the MCP server and the skill read
local files only. `node ai/build.mjs` regenerates `ai/data/index.json` and the skill catalogue from
`src/data/catalog.json`, `public/docs/*.md` and that source; `node scripts/sync-free.mjs` re-checks the
free half against the public registry whenever you want to compare.

### Taking over this repo

[AGENTS.md](AGENTS.md) is the handoff: commands, the two verification gates, the shared files that must
not be edited for one item, and the UI rules the library is held to. [ai/README.md](ai/README.md) has
the official-vs-local comparison, every client config and the tool contract.

## How it was reconstructed

The gate protects `/api/component-source`; it does not protect the component itself, because the
public preview frame has to render it. So the ports come from what the browser is served:

1. **Capture** — `scripts/capture.mjs <slug>` opens `/components/<slug>/frame` in Playwright and keeps
   the SSR DOM, the item's own CSS Module (chosen by selector prefix, not by size) and the webpack
   chunk that contains its implementation.
2. **De-hash** — `.block_someClass__a1b2c` → `.someClass`; keyframes and nested at-rules are preserved.
3. **Port** — rebuild the component: props, state machine, spring parameters, ARIA, keyboard model,
   canvas/WebGL renderers, seeded data generators, responsive breakpoints.
4. **Gate** — `scripts/compare.mjs` (pixel diff of the two frames) and `scripts/dom-diff.mjs`
   (path / tag / box ±1px / text / role / aria), plus interaction A/B probes on every state.
5. **Report** — `scripts/report.mjs` runs both gates over the corpus in parallel shards and writes
   [REPORT.md](REPORT.md).

Long-running demos are compared in their resting window (the report carries a per-item `KNOWN_WAIT`),
so a loop's phase is never reported as a fidelity gap.

## Tooling

| Script | What it does |
| --- | --- |
| `capture.mjs <slug> [--kind=block]` | capture DOM + CSS + implementation chunk into `captures/<slug>/` |
| `capture-parallel.sh <n> <slugs…>` | capture a list with limited concurrency |
| `compare.mjs <slug>` | screenshot both frames, print `diff N% of pixels · score N`; `STABLE=1`, `WAIT=ms`, `--local=` |
| `dom-diff.mjs <slug>` | structural walk of both frames; `--struct`, `--tags`, `WAIT=ms` |
| `report.mjs`, `report-all.sh`, `report-merge.mjs` | corpus-wide parity report (sharded) |
| `smoke.mjs` | every catalogue page returns 200, preview mounts, Code tab has files, no console errors |
| `queue.mjs`, `audit-captures.mjs` | progress and capture-quality audits |
| `prune-free.mjs` | keep only the import closure the Pro items need |

`captures/` is generated and not committed — re-run the capture step if you want to re-verify an item.

## Known residues

Eight items score below 99.5 and none of them is a missing feature: an undamped orbit
(`customer-galaxy`, which also scores ~96 against *itself*), a randomised text-reveal loop
(`source-cards`), live clock digits (`revenue-globe`), a 17-second race (`race-bar-chart`), a spinning
wheel (`prize-wheel`), WebGL fluid noise (`ink-fluid`), per-cell RNG (`sand-text`) and a clock lead
(`orbit-logos`). All are documented with measurements in
[METHOD.md § 7](METHOD.md#7-known-irreducible-residues).

## Credit & disclaimer

All design, layout and component ideas belong to **Arc / [uiarc.dev](https://uiarc.dev)** — this is a
reverse-engineering study, not a redistribution of the original source. The code here was recovered
from publicly served artifacts for research and porting practice; if you want the supported, licensed
version (plus updates and support), buy the original. Trademarks belong to their owners.
