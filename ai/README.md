# AI layer: MCP server + skill

Two ways to make a coding agent know the whole Arc library — all 233 Pro items *and* the 147 free
ones — instead of guessing component names.

| | Official (uiarc.dev) | This repo |
| --- | --- | --- |
| Skill | `npx shadcn@latest add @uiarc/arc-skill.json` → 13 files, **free items only** in `components.md` | `ai/skill/arc-pro/` → same 13 files, catalogue regenerated over **380 ids** |
| MCP | remote `https://uiarc.dev/api/mcp`, **sign-in required**, Pro source only on a paid plan | `ai/mcp/server.mjs`, stdio, **no account**, source for every item |
| Pro source | gated (`403 Sign in with Pro access to view this source`) | local: `src/components/arc/<id>/` |

Both are built from the same data the site itself serves: `public/docs/<id>.md` (docs, props,
keyboard, a11y, motion, responsive), `src/data/catalog.json` (groups, tiers) and the reconstructed
source.

## MCP server

```bash
node ai/mcp/server.mjs          # stdio, newline-delimited JSON-RPC
```

Dependencies live in `ai/mcp/package.json` (`@modelcontextprotocol/sdk`, `zod`):

```bash
cd ai/mcp && pnpm install
```

### Tools

| Tool | Input | Returns |
| --- | --- | --- |
| `search_components` | `query`, `kind?`, `tier?`, `group?`, `limit?` | ranked ids with the reason to use each and the reason not to |
| `list_components` | `kind?`, `tier?`, `group?`, `limit?`, `offset?` | ids, or the 55 groups with counts when unfiltered |
| `get_component` | `id`, `include: docs\|source\|both`, `section?` | the item docs (when to use, usage, API reference, keyboard, a11y, motion, responsive) and its files |
| `get_install_command` | `ids[]`, `target: repo\|external` | the shadcn command for free items, the copy recipe for Pro |
| `get_skill` | `file` | any file of `ai/skill/arc-pro/` |

Search expands intent (`kpi`→metric, `delete`→destructive, `dashboard`→overview, …), requires one
strong hit plus most query words, and returns the "not for" line so the agent can follow the docs
instead of fighting them.

### Wiring

Claude Code:

```bash
claude mcp add arc-pro -- node "$PWD/ai/mcp/server.mjs"     # add --scope project to share via .mcp.json
```

Cursor (`~/.cursor/mcp.json`), Codex (`~/.codex/config.toml` under `[mcp_servers.arc-pro]`) and
VS Code (`.vscode/mcp.json`) take the same pair:

```json
{ "mcpServers": { "arc-pro": { "command": "node", "args": ["/absolute/path/to/uiarc/ai/mcp/server.mjs"] } } }
```

## Skill

`ai/skill/arc-pro/` is a normal agent skill folder (front matter `name: arc-pro` in `SKILL.md`):

```bash
cp -R ai/skill/arc-pro ~/.claude/skills/arc-pro      # Claude Code
cp -R ai/skill/arc-pro ~/.agents/skills/arc-pro      # generic agents directory
```

- `SKILL.md` — workflow, principles, never-do list, quick decisions, file index
- `components.md` — **generated**: all 380 ids by group, each with its one-line job, the first
  "when to use" bullet and the first "when not to use" bullet
- `design.md`, `copy.md`, `motion.md`, `accessibility.md`, `responsive.md`, `composition.md`,
  `checklist.md`, `example-settings.md`, `example-pricing.md`, `example-dashboard.md` — the free skill
  prose, verbatim
- `INSTRUCTIONS.md` — the always-on rules block for `AGENTS.md`, `CLAUDE.md` or Cursor rules

## Data

| Path | What |
| --- | --- |
| `ai/data/index.json` | 380 items: id, title, kind, group, tier, summary, keywords, deps, use/avoid bullets, sections, files, sizes |
| `ai/vendor/free/*.json` | the 146 free registry items as served by `https://uiarc.dev/r/<name>.json`, file contents included |
| `ai/build.mjs` | regenerates `ai/data/index.json` and `ai/skill/arc-pro/components.md` |

Rebuild after adding an item:

```bash
node ai/build.mjs
```

## Limits

- `get_component` truncates source at 160k characters per call; larger items are cut with a note and
  the file paths are listed so the agent can read them from the repo.
- Search is lexical plus a synonym table, not an embedding index: it ranks by id, title, keywords,
  summary, "when to use" and group. `list_components` is the fallback when intent wording is unusual.
- `login` is a variants landing page on the site (5 blocks), so it has docs but no source of its own;
  the individual variants (`sign-in`, `login-centered`, `signup-form`) are separate items.
