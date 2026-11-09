#!/usr/bin/env node
/**
 * Refresh the free registry items from the public Arc registry into src/components/arc/.
 *
 *   node scripts/sync-free.mjs                     # dry run: report drifted / missing files
 *   node scripts/sync-free.mjs --apply             # write missing files, emit src/data/free-items.json
 *   node scripts/sync-free.mjs --only=button,input # limit to a few ids
 *
 * The repository is the source of truth at runtime: the MCP server and the skill read local files only.
 * This script exists so the free half can be re-verified against upstream, not so it is fetched at build
 * time. Existing files are never overwritten; drift is reported and left for a human.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const ARC = join(ROOT, "src/components/arc");
const REGISTRY = "https://uiarc.dev/r/registry.json";
const ITEM = (id) => `https://uiarc.dev/r/${id}.json`;
const APPLY = process.argv.includes("--apply");
const ONLY = process.argv
  .find((a) => a.startsWith("--only="))
  ?.slice("--only=".length)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const sha = (text) => createHash("sha256").update(text).digest("hex").slice(0, 16);

/** registry path → path under src/components/arc, keeping the blocks level the files expect. */
function localPath(registryPath) {
  const p = registryPath.replace(/^registry\//, "");
  const isBlock = p.startsWith("blocks/");
  return join(ARC, isBlock ? "blocks" : "", p.replace(/^(components|blocks)\//, ""));
}

async function getJson(url) {
  const res = await fetch(url, { headers: { "user-agent": "arc-pro-reverse/sync-free" } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

const registry = await getJson(REGISTRY);
const names = (registry.items ?? []).map((i) => i.name).filter((n) => !ONLY || ONLY.includes(n));
console.log(`registry: ${registry.items?.length ?? 0} items · syncing ${names.length}`);

const items = [];
const wrote = [];
const identical = [];
const drifted = [];

for (const id of names) {
  let entry;
  try {
    entry = await getJson(ITEM(id));
  } catch (error) {
    console.log(`! ${id}: ${error.message}`);
    continue;
  }
  const files = [];
  for (const file of entry.files ?? []) {
    if (!file.content) continue;
    const target = localPath(file.path);
    files.push({ path: target.slice(ARC.length + 1), sha: sha(file.content), bytes: Buffer.byteLength(file.content) });
    if (!APPLY) {
      if (existsSync(target)) {
        const current = await readFile(target, "utf8");
        (current === file.content ? identical : drifted).push(target.slice(ARC.length + 1));
      } else wrote.push(target.slice(ARC.length + 1));
      continue;
    }
    if (existsSync(target)) {
      (await readFile(target, "utf8")) === file.content
        ? identical.push(target.slice(ARC.length + 1))
        : drifted.push(target.slice(ARC.length + 1));
      continue;
    }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content);
    wrote.push(target.slice(ARC.length + 1));
  }
  items.push({
    id: entry.name ?? id,
    title: entry.title ?? id,
    type: entry.type ?? "registry:ui",
    description: entry.description ?? "",
    categories: entry.categories ?? [],
    dependencies: entry.dependencies ?? [],
    registryDependencies: entry.registryDependencies ?? [],
    files: files.map((f) => f.path),
    shas: files.map((f) => f.sha),
  });
}

if (APPLY && !ONLY) {
  await writeFile(
    join(ROOT, "src/data/free-items.json"),
    `${JSON.stringify(
      {
        note: "Free registry items copied verbatim from the public Arc registry; paths are relative to src/components/arc/. Regenerate with scripts/sync-free.mjs --apply.",
        items,
      },
      null,
      2,
    )}\n`,
  );
}

console.log(`files: wrote ${wrote.length} · identical ${identical.length} · drifted ${drifted.length}`);
if (drifted.length) console.log(`drifted (left alone): ${drifted.slice(0, 10).join(", ")}${drifted.length > 10 ? " …" : ""}`);
if (!APPLY) console.log("dry run — pass --apply to write");
