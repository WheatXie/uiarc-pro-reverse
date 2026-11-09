#!/usr/bin/env node
/**
 * Build the AI layer for the Arc Pro reconstruction.
 *
 * Inputs (all already in the repo):
 *   src/data/catalog.json      — the catalogue: 267 items in 57 groups, each with a pro flag
 *   public/docs/<slug>.md      — the item docs the site serves publicly (props, usage, a11y, motion)
 *   src/components/arc/<slug>/ — the reconstructed source of the 233 Pro items
 *   ai/vendor/free/<name>.json — registry items for the 146 free items, file contents included
 *   ai/skill-src/*.md          — the free Arc skill prose (design, copy, motion, …), verbatim
 *
 * Outputs:
 *   ai/data/index.json         — search index consumed by the MCP server
 *   ai/skill/arc-pro/*.md      — an installable skill whose catalog covers free + Pro
 *
 * Run: node ai/build.mjs
 */
import { readFile, writeFile, readdir, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, basename, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const AI = join(ROOT, "ai");
const DOCS = join(ROOT, "public/docs");
const SOURCE = join(ROOT, "src/components/arc");
const VENDOR = join(AI, "vendor/free");

const catalog = JSON.parse(await readFile(join(ROOT, "src/data/catalog.json"), "utf8"));

/** Split `## Section` blocks out of an item's markdown. */
function sections(markdown) {
  const out = {};
  const parts = markdown.split(/^## /m);
  for (const part of parts.slice(1)) {
    const [heading, ...rest] = part.split("\n");
    out[heading.trim()] = rest.join("\n").trim();
  }
  return out;
}

/** The `> summary` line and the front-matter bullets the docs start with. */
function frontMatter(markdown) {
  const summary = markdown.match(/^> (.+)$/m)?.[1]?.trim() ?? "";
  const keywords = markdown.match(/^- Keywords:\s*(.+)$/m)?.[1] ?? "";
  const deps = markdown.match(/^- Dependencies:\s*(.+)$/m)?.[1] ?? "";
  const access = markdown.match(/^- Access:\s*(.+)$/m)?.[1] ?? "";
  return {
    summary,
    keywords: keywords.split(/,\s*/).map((k) => k.trim()).filter(Boolean),
    dependencies: deps.split(/,\s*/).map((k) => k.trim()).filter(Boolean),
    access,
  };
}

/** Bullets of one `## Section`, flattened to a single line for the catalog. */
function firstBullets(markdown, heading, count = 2) {
  const map = sections(markdown);
  const body = map[heading] ?? "";
  return body
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .slice(0, count)
    .map((line) => line.slice(2).trim());
}

async function sizeOf(path) {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

async function listFiles(dir) {
  if (!existsSync(dir)) return [];
  const names = (await readdir(dir)).filter((n) => /\.(tsx?|css|md)$/.test(n)).sort();
  const files = [];
  for (const name of names) files.push({ path: `${name}`, bytes: await sizeOf(join(dir, name)) });
  return files;
}

const vendorCache = new Map();
async function freeFiles(id) {
  if (!vendorCache.has(id)) {
    const file = join(VENDOR, `${id}.json`);
    vendorCache.set(id, existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : null);
  }
  return vendorCache.get(id)?.files ?? [];
}

const items = [];
const docs = await readdir(DOCS);

for (const [kind, groups] of [
  ["component", catalog.components],
  ["block", catalog.blocks],
  ["special", catalog.special ?? []],
]) {
  for (const group of groups) {
    for (const item of group.items) {
      const markdown = docs.includes(`${item.slug}.md`)
        ? await readFile(join(DOCS, `${item.slug}.md`), "utf8")
        : "";
      const meta = frontMatter(markdown);
      const pro = Boolean(item.pro);
      const files = pro ? await listFiles(join(SOURCE, item.slug)) : [];
      const free = pro ? [] : await freeFiles(item.slug);
      const variants = Number(markdown.match(/^- Type: Block with (\d+) variants/m)?.[1] ?? 0);
      items.push({
        id: item.slug,
        variants,
        title: item.title,
        kind,
        group: group.title,
        categories: item.categories ?? [],
        tier: pro ? "pro" : "free",
        summary: meta.summary || item.description || "",
        keywords: meta.keywords.length ? meta.keywords : (item.categories ?? []),
        dependencies: meta.dependencies.length ? meta.dependencies : (item.dependencies ?? []),
        uses: firstBullets(markdown, "When to use"),
        avoids: firstBullets(markdown, "When not to use"),
        sections: Object.keys(sections(markdown)),
        files: pro ? files : free.map((f) => ({ path: f.path, bytes: (f.content ?? "").length })),
        hasSource: pro ? files.length > 0 : free.length > 0,
        docBytes: markdown.length,
      });
    }
  }
}

/* Registry items that are not in the site catalogue (theme-switch variants, sign-in, signup-form,
   slot-text, the foundations and the skill itself). They are free and installable, so the AI layer
   must know them too — otherwise it invents names that do not exist. */
const registryPath = join(VENDOR, "registry.json");
const registry = existsSync(registryPath)
  ? JSON.parse(await readFile(registryPath, "utf8")).items ?? []
  : [];
const known = new Set(items.map((i) => i.id));
for (const entry of registry) {
  if (known.has(entry.name)) continue;
  const vendored = existsSync(join(VENDOR, `${entry.name}.json`))
    ? JSON.parse(await readFile(join(VENDOR, `${entry.name}.json`), "utf8"))
    : null;
  const files = vendored?.files ?? entry.files ?? [];
  items.push({
    id: entry.name,
    variants: 0,
    title: entry.title ?? entry.name,
    kind: entry.type === "registry:block" ? "block" : "component",
    group: (entry.categories ?? [])[0] ? `Free registry · ${entry.categories[0]}` : "Free registry",
    categories: entry.categories ?? [],
    tier: "free",
    summary: entry.description ?? "",
    keywords: [...(entry.categories ?? []), ...entry.name.split("-")],
    dependencies: entry.dependencies ?? [],
    uses: [],
    avoids: [],
    sections: [],
    files: files.map((f) => ({ path: f.path, bytes: (f.content ?? "").length })),
    hasSource: files.some((f) => f.content),
    docBytes: 0,
    registryOnly: true,
  });
}

items.sort((a, b) => a.id.localeCompare(b.id));

const index = {
  generated: new Date().toISOString(),
  source: "uiarc-pro-reverse",
  counts: {
    total: items.length,
    pro: items.filter((i) => i.tier === "pro").length,
    free: items.filter((i) => i.tier === "free").length,
    component: items.filter((i) => i.kind === "component").length,
    block: items.filter((i) => i.kind === "block").length,
    special: items.filter((i) => i.kind === "special").length,
    withSource: items.filter((i) => i.hasSource).length,
  },
  groups: Object.fromEntries(
    [...new Set(items.map((i) => i.group))].map((g) => [g, items.filter((i) => i.group === g).length]),
  ),
  items,
};

await mkdir(join(AI, "data"), { recursive: true });
await writeFile(join(AI, "data/index.json"), JSON.stringify(index, null, 2) + "\n");

/* ---------------------------------------------------------------- skill --- */

const SKILL_DIR = join(AI, "skill/arc-pro");
await mkdir(SKILL_DIR, { recursive: true });

// 1. The prose files ship verbatim next to the generated catalog.
for (const name of await readdir(join(AI, "skill-src"))) {
  if (!name.endsWith(".md")) continue;
  await writeFile(join(SKILL_DIR, name), await readFile(join(AI, "skill-src", name)));
}

// 1b. Pro playbooks: authored here, because the site gates the originals behind an account.
const PRO_DIR = join(SKILL_DIR, "pro");
await mkdir(PRO_DIR, { recursive: true });
for (const name of await readdir(join(AI, "skill-src/pro"))) {
  if (!name.endsWith(".md")) continue;
  await writeFile(join(PRO_DIR, name), await readFile(join(AI, "skill-src/pro", name)));
}

// 2. components.md — the whole catalogue, grouped, with the reason to reach for each item.
const byGroup = new Map();
for (const item of items) {
  if (!byGroup.has(item.group)) byGroup.set(item.group, []);
  byGroup.get(item.group).push(item);
}
const groupOrder = [...byGroup.keys()].sort((a, b) => a.localeCompare(b));

const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const lines = [];
lines.push("# Choosing an Arc component or block");
lines.push("");
lines.push(
  "Pick the item whose job matches, not the one that looks closest. Every id below is a real item in",
  "this repository: live preview at `/components/<id>` (`/components/blocks/<id>` for blocks), docs at",
  "`public/docs/<id>.md`, and — for Pro items — the reconstructed source at `src/components/arc/<id>/`.",
);
lines.push("");
lines.push(
  "`tier` only says where an item came from. Here **every** item is usable: Pro source is already",
  "vendored, so there is no account, token or install step. Ask for the item you want, read its",
  '"When not to use", then copy the files.',
);
lines.push("");
lines.push("## Groups");
lines.push("");
for (const group of groupOrder) {
  const items = byGroup.get(group);
  lines.push(
    `### ${group} (${items.length}) — [details](catalog/${slugify(group)}.md)`,
  );
  lines.push("");
  lines.push(items.map((item) => `\`${item.id}\`${item.tier === "pro" ? " (Pro)" : ""}`).join(", "));
  lines.push("");
}
lines.push("## How to decide");
lines.push("");
lines.push("1. Name the job in one line (\"pick one of three plans\", \"confirm deleting a project\").");
lines.push("2. Look it up with `search_components`, or scan the groups above.");
lines.push("3. Open the group file in `catalog/` for the reason to use and not to use each item, or call `get_component`.");
lines.push("4. Follow the \"not for\" line: it names the better alternative.");
lines.push("5. Prefer a block for a whole region, a component for a single control. Replace sample data.");
lines.push("");
lines.push("## Wiring rules");
lines.push("");
lines.push("- Inside this repo: `@/components/arc/<id>/<id>` and `@/components/arc/<id>/<id>.module.css`.");
lines.push("- Elsewhere: copy the item folder, keep relative imports, import `foundation.css` once.");
lines.push("- Shared parts (`button`, `input`, `select`, `popover`, `segmented-control`, `text-morph`, `tooltip`, `lib/`) live in `src/components/arc/` as well.");
lines.push("");

await writeFile(join(SKILL_DIR, "components.md"), lines.join("\n"));

// Per-group detail files, so the agent reads one group instead of a 130 KB catalogue.
const catalogDir = join(SKILL_DIR, "catalog");
await mkdir(catalogDir, { recursive: true });
for (const group of groupOrder) {
  const out = [`# ${group}`, ""];
  for (const item of byGroup.get(group)) {
    const badge = item.tier === "pro" ? "Pro" : "Free";
    out.push(`## \`${item.id}\` — ${item.title} (${badge}, ${item.kind})`);
    out.push("");
    out.push(item.summary);
    out.push("");
    if (item.uses.length) {
      out.push("When to use:");
      for (const line of item.uses) out.push(`- ${line}`);
      out.push("");
    }
    if (item.avoids.length) {
      out.push("When not to use:");
      for (const line of item.avoids) out.push(`- ${line}`);
      out.push("");
    }
    if (item.keywords.length) out.push(`Keywords: ${item.keywords.join(", ")}`, "");
    if (item.files.length) out.push(`Files: ${item.files.map((f) => f.path).join(", ")}`, "");
  }
  await writeFile(join(catalogDir, `${slugify(group)}.md`), out.join("\n"));
}

console.log(
  `index: ${index.counts.total} items (${index.counts.pro} pro, ${index.counts.free} free), ` +
    `${index.counts.withSource} with source · skill written to ai/skill/arc-pro/`,
);
