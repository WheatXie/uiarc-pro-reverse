/**
 * The clone only ships the gated (Pro) items. Everything vendored from the free registry is
 * dead weight unless a Pro port imports it, so compute the import closure and drop the rest.
 *
 *   node scripts/prune-free.mjs           # dry run, prints what would go
 *   node scripts/prune-free.mjs --apply   # actually delete
 */
import { readdir, readFile, rm, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const ARC = join(ROOT, "src/components/arc");
const catalog = JSON.parse(await readFile(join(ROOT, "src/data/catalog.json"), "utf8"));
const proSlugs = new Set(
  [...catalog.components, ...(catalog.special ?? []), ...catalog.blocks].flatMap((g) => g.items).filter((i) => i.pro).map((i) => i.slug),
);

const dirs = (await readdir(ARC, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
const roots = dirs.filter((d) => proSlugs.has(d));
const keep = new Set(roots);

/** Follow relative imports inside src/components/arc until nothing new appears. */
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
      continue;
    }
    if (!/\.(tsx?|css)$/.test(entry.name)) continue;
    const source = await readFile(full, "utf8");
    for (const match of source.matchAll(/from\s+"(\.\.?\/[^"]+)"/g)) {
      const target = join(dir, match[1]);
      const rel = relative(ARC, target).split("/");
      keep.add(rel[0] === "lib" ? "lib" : rel[0]);
    }
  }
}

for (const slug of roots) await walk(join(ARC, slug));

const drop = dirs.filter((d) => !keep.has(d) && d !== "blocks");
console.log(`pro roots (${roots.length}): ${roots.join(", ") || "—"}`);
console.log(`keep            (${keep.size}): ${[...keep].sort().join(", ")}`);
console.log(`drop            (${drop.length}): ${drop.join(", ")}`);

if (process.argv.includes("--apply")) {
  for (const dir of drop) await rm(join(ARC, dir), { recursive: true, force: true });
  await stat(ARC);
  console.log(`deleted ${drop.length} free item director${drop.length === 1 ? "y" : "ies"}`);
}
