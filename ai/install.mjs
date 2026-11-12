#!/usr/bin/env node
/**
 * Install the Arc Pro skill and MCP server into an agent client.
 *
 *   node ai/install.mjs                    # show what would be written
 *   node ai/install.mjs --claude           # project .mcp.json + .claude/skills/arc-pro
 *   node ai/install.mjs --claude-user      # ~/.claude/skills/arc-pro (all projects)
 *   node ai/install.mjs --cursor           # .cursor/mcp.json + .cursor/rules/arc.mdc
 *   node ai/install.mjs --vscode           # .vscode/mcp.json
 *   node ai/install.mjs --codex            # ~/.codex/config.toml snippet appended once
 *   node ai/install.mjs --agents           # ~/.agents/skills/arc-pro
 *   node ai/install.mjs --dsh              # .dsh/skills/arc-pro copy + cordis `insert` entry (DeepSeek Harness)
 *   node ai/install.mjs --all              # every client above
 *   node ai/install.mjs --print            # print the JSON blocks and exit
 *
 * Existing config files are merged, never replaced; every write is printed with the path it touched.
 */
import { readFile, writeFile, mkdir, cp, symlink, access, rm, appendFile } from "node:fs/promises";
import { constants, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AI = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(AI, "..");
const SKILL = join(AI, "skill/arc-pro");
const SERVER = join(AI, "mcp/server.mjs");

const args = new Set(process.argv.slice(2));
const has = (...names) => names.some((name) => args.has(name));
const say = (line) => console.log(line);

const touch = async (path) => {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

/**
 * A skill folder only registers if SKILL.md's YAML frontmatter parses. An
 * unquoted `description` containing ": " is a nested mapping, so the client
 * drops the whole skill with a log line nobody reads. Fail the install here
 * instead of copying a folder that will never show up.
 */
async function assertSkillFrontmatter(dir) {
  const raw = await readFile(join(dir, "SKILL.md"), "utf8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (match === null) throw new Error(`${dir}/SKILL.md has no YAML frontmatter block`);
  const field = (key) =>
    match[1]
      .split(/\r?\n/)
      .find((line) => line.startsWith(`${key}:`))
      ?.slice(key.length + 1)
      .trim() ?? "";
  const name = field("name");
  const description = field("description");
  if (name === "") throw new Error(`${dir}/SKILL.md frontmatter needs a name`);
  if (description === "") throw new Error(`${dir}/SKILL.md frontmatter needs a description`);
  const quoted = (description.startsWith('"') && description.endsWith('"')) || (description.startsWith("'") && description.endsWith("'"));
  if (!quoted && description.includes(": ")) {
    throw new Error(
      `${dir}/SKILL.md description contains ": " — quote the whole value or the frontmatter is invalid YAML and the skill is ignored`,
    );
  }
  return { name, description };
}

/** Deep-merge b into a without dropping keys already in a. */
function merge(base, extra) {
  if (Array.isArray(base) || Array.isArray(extra)) return extra ?? base;
  if (typeof base !== "object" || base === null || typeof extra !== "object" || extra === null) return extra;
  const out = { ...base };
  for (const [key, value] of Object.entries(extra)) out[key] = key in base ? merge(base[key], value) : value;
  return out;
}

async function writeJson(path, patch) {
  let current = {};
  if (await touch(path)) {
    try {
      current = JSON.parse(await readFile(path, "utf8"));
    } catch {
      say(`! ${path} is not valid JSON — left untouched`);
      return;
    }
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(merge(current, patch), null, 2)}\n`);
  say(`  wrote ${path}`);
}

async function copySkill(dest) {
  await rm(dest, { recursive: true, force: true });
  await mkdir(dirname(dest), { recursive: true });
  await cp(SKILL, dest, { recursive: true });
  say(`  copied skill → ${dest}`);
}

async function linkSkill(dest) {
  await rm(dest, { recursive: true, force: true });
  await mkdir(dirname(dest), { recursive: true });
  // Relative so the link survives a clone to another path.
  await symlink(relative(dirname(dest), SKILL), dest, "dir");
  say(`  linked skill → ${dest} → ${relative(dirname(dest), SKILL)}`);
}

const mcpJson = (argsList) => ({ mcpServers: { "arc-pro": { command: "node", args: argsList } } });
const JSON_LOCAL = mcpJson(["ai/mcp/server.mjs"]);
const JSON_ABS = mcpJson([SERVER]);

if (has("--print")) {
  say(JSON.stringify(JSON_ABS, null, 2));
  say("\n# ~/.codex/config.toml");
  say(`[mcp_servers.arc-pro]\ncommand = "node"\nargs = ["${SERVER}"]`);
  process.exit(0);
}

const wantsAll = has("--all");
const anything =
  wantsAll ||
  has("--claude", "--claude-user", "--cursor", "--vscode", "--codex", "--agents", "--dsh");

say(`Arc Pro · skill ${SKILL}`);
say(`          MCP   ${SERVER}\n`);

if (!anything) {
  say("Nothing selected — showing what each flag writes:\n");
  say("  --claude         .mcp.json (project scope, shared in git) + .claude/skills/arc-pro symlink");
  say("  --claude-user    ~/.claude/skills/arc-pro copy (available in every project)");
  say("  --cursor         .cursor/mcp.json + .cursor/rules/arc.mdc");
  say("  --vscode         .vscode/mcp.json");
  say("  --codex          appends [mcp_servers.arc-pro] to ~/.codex/config.toml");
  say("  --agents         ~/.agents/skills/arc-pro copy");
  say("  --dsh            .dsh/skills/arc-pro + an mcp-arc-pro entry in the DeepSeek Harness profile patch");
  say("  --all            all of the above");
  say("\nRun with --print to see the JSON, or read ai/README.md for the manual snippets.");
  process.exit(0);
}

const skillMeta = await assertSkillFrontmatter(SKILL);
say(`frontmatter ok — name: ${skillMeta.name}, description ${skillMeta.description.length} chars\n`);

if (wantsAll || has("--claude")) {
  say("Claude Code (project)");
  await writeJson(join(ROOT, ".mcp.json"), JSON_LOCAL);
  await linkSkill(join(ROOT, ".claude/skills/arc-pro"));
}

if (wantsAll || has("--claude-user")) {
  say("Claude Code (user)");
  await copySkill(join(homedir(), ".claude/skills/arc-pro"));
}

if (wantsAll || has("--cursor")) {
  say("Cursor");
  await writeJson(join(ROOT, ".cursor/mcp.json"), JSON_LOCAL);
  const rule = join(ROOT, ".cursor/rules/arc.mdc");
  await mkdir(dirname(rule), { recursive: true });
  const body = await readFile(join(SKILL, "INSTRUCTIONS.md"), "utf8");
  await writeFile(
    rule,
    `---\ndescription: Arc UI rules for React components, pages, and CSS modules\nglobs: ["**/*.tsx", "**/*.module.css"]\nalwaysApply: false\n---\n\n${body}`,
  );
  say(`  wrote ${rule}`);
}

if (wantsAll || has("--vscode")) {
  say("VS Code");
  await writeJson(join(ROOT, ".vscode/mcp.json"), {
    servers: { "arc-pro": { type: "stdio", command: "node", args: ["${workspaceFolder}/ai/mcp/server.mjs"] } },
  });
}

if (wantsAll || has("--codex")) {
  say("Codex");
  const config = join(homedir(), ".codex/config.toml");
  await mkdir(dirname(config), { recursive: true });
  const existing = existsSync(config) ? await readFile(config, "utf8") : "";
  if (existing.includes("[mcp_servers.arc-pro]")) {
    say(`  ${config} already has arc-pro — left as is`);
  } else {
    await writeFile(
      config,
      `${existing}${existing && !existing.endsWith("\n") ? "\n" : ""}\n[mcp_servers.arc-pro]\ncommand = "node"\nargs = ["${SERVER}"]\n`,
    );
    say(`  appended [mcp_servers.arc-pro] → ${config}`);
  }
}

if (wantsAll || has("--dsh")) {
  say("DeepSeek Harness");
  // A real copy, not a symlink: dsh lists skill roots through its own fs service,
  // which reports a symlinked directory as an unsupported entry type.
  await copySkill(join(ROOT, ".dsh/skills/arc-pro"));
  const profileDir = process.env.DSH_PROFILE_DIR ?? join(homedir(), ".dsh/profiles/desktop");
  const patch = join(profileDir, "cordis.patch.yml");
  const entry = [
    "- insert:",
    "    - id: mcp-arc-pro",
    "      name: '@deepseek-ai/dsh-mcp-client'",
    "      config:",
    "        serverName: arc-pro",
    "        transport: stdio",
    `        command: ${process.execPath}`,
    "        args:",
    `          - ${SERVER}`,
    "        failOnStartupError: true",
    "",
  ].join("\n");
  const existing = existsSync(patch) ? await readFile(patch, "utf8") : "";
  if (existing.includes("mcp-arc-pro")) {
    say(`  ${patch} already has mcp-arc-pro — left as is`);
  } else if (existing.trim() === "" || existing.trim() === "[]") {
    await mkdir(dirname(patch), { recursive: true });
    await writeFile(patch, `${entry}`);
    say(`  wrote mcp-arc-pro → ${patch}`);
  } else {
    await appendFile(patch, `${existing.endsWith("\n") ? "" : "\n"}${entry}`);
    say(`  appended mcp-arc-pro → ${patch}`);
  }
}

if (wantsAll || has("--agents")) {
  say("Generic agents directory");
  await copySkill(join(homedir(), ".agents/skills/arc-pro"));
}

say("\nDone. Restart the client so it re-reads its MCP config, then ask it to list the arc-pro tools.");
