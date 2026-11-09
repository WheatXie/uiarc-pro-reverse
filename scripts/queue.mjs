// Prints the remaining Pro items that still need a port, with their capture size.
// Usage: node scripts/queue.mjs [--all] [--json]
import { readdirSync, existsSync, statSync, readFileSync } from "node:fs";

const all = process.argv.includes("--all");
const asJson = process.argv.includes("--json");

const catalog = JSON.parse(readFileSync("src/data/catalog.json", "utf8"));
const items = [];
for (const group of [...(catalog.components ?? []), ...(catalog.special ?? [])]) {
  for (const item of group.items ?? []) {
    if (item.pro) items.push({ kind: "component", slug: item.slug, group: group.title });
  }
}
for (const group of catalog.blocks ?? []) {
  for (const item of group.items ?? []) {
    if (item.pro) items.push({ kind: "block", slug: item.slug, group: group.title });
  }
}

const size = (path) => (existsSync(path) ? statSync(path).size : 0);

const rows = items.map((item) => {
  const dir = `captures/${item.slug}`;
  const rowsPorted = existsSync(`src/components/arc/${item.slug}/demo.tsx`);
  const frames = JSON.parse(readFileSync("src/data/frames.json", "utf8"));
  return {
    ...item,
    ported: rowsPorted,
    captured: size(`${dir}/chunk.js`) > 0,
    js: size(`${dir}/chunk.js`),
    css: size(`${dir}/styles.css`),
    frame: Boolean(frames[item.slug]),
  };
});

const scope = all ? rows : rows.filter((row) => !row.ported);
const missingCapture = scope.filter((row) => !row.captured);
const missingFrame = scope.filter((row) => row.captured && !row.frame);

if (asJson) {
  console.log(JSON.stringify({ remaining: scope, missingCapture, missingFrame }, null, 2));
} else {
  console.log(`pro items ${rows.length} · ported ${rows.length - rows.filter((r) => !r.ported).length} · remaining ${rows.filter((r) => !r.ported).length}\n`);
  for (const row of scope.sort((a, b) => a.js - b.js)) {
    const flags = [row.captured ? "" : "NO CAPTURE", row.frame ? "" : "NO FRAME"].filter(Boolean).join(" ");
    console.log(`${String(row.js).padStart(7)} js ${String(row.css).padStart(6)} css  ${row.kind === "block" ? "block " : "comp  "} ${row.slug.padEnd(24)} ${row.group.padEnd(18)} ${flags}`);
  }
  if (missingCapture.length) console.log(`\n${missingCapture.length} need capture: ${missingCapture.map((r) => r.slug).join(" ")}`);
  if (missingFrame.length) console.log(`${missingFrame.length} need frame entry: ${missingFrame.map((r) => r.slug).join(" ")}`);
}
