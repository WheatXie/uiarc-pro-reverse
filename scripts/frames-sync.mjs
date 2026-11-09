/**
 * Keeps src/data/frames.json in sync with captures/: parses each captured frame.html for the
 * outer shell (`<main data-layout data-width>` and whether the page ships a `previews-demos_canvas`
 * wrapper) so a port never has to touch the shared file.
 *
 *   node scripts/frames-sync.mjs [--write]
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const file = join(root, "src/data/frames.json");
const frames = JSON.parse(await readFile(file, "utf8"));
const dirs = (await readdir(join(root, "captures"))).filter((d) => existsSync(join(root, "captures", d, "frame.html")));
let added = 0;
for (const slug of dirs) {
  if (frames[slug]) continue;
  const html = await readFile(join(root, "captures", slug, "frame.html"), "utf8");
  const main = html.match(/<main[^>]*class="frame-page_root[^"]*"[^>]*>/)?.[0] ?? html.match(/<main[^>]*>/)?.[0] ?? "";
  const layout = main.match(/data-layout="([^"]+)"/)?.[1] ?? "center";
  const width = main.match(/data-width="([^"]+)"/)?.[1] ?? "medium";
  const hasCanvas = /previews-demos_canvas/.test(html);
  const canvas = hasCanvas ? (html.match(/previews-demos_canvas"[^>]*data-canvas="([^"]+)"/)?.[1] ?? html.match(/data-canvas="([^"]+)"/)?.[1] ?? "default") : "none";
  frames[slug] = { canvas, layout, width };
  added += 1;
}
const sorted = Object.fromEntries(Object.entries(frames).sort(([a], [b]) => a.localeCompare(b)));
if (process.argv.includes("--write")) {
  await writeFile(file, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`added ${added}, wrote ${Object.keys(sorted).length} entries`);
} else {
  console.log(`would add ${added} (of ${dirs.length} captures; ${Object.keys(frames).length} known)`);
}
