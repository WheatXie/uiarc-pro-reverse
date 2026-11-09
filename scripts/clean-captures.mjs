/**
 * Drop the regenerable bulk of `captures/`: reference screenshots, per-page CSSOM dumps and diff
 * images. What stays is what a re-port actually needs — frame.html, chunk.js, styles.css, meta.json.
 *
 *   node scripts/clean-captures.mjs            # dry run: prints what would be freed
 *   node scripts/clean-captures.mjs --apply
 */
import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const apply = process.argv.includes("--apply");
const drop = /(\.png$|^css\.json$|^diff.*\.png$|^styles\.full\.css$)/;

let files = 0;
let bytes = 0;
for (const slug of await readdir(join(root, "captures"), { withFileTypes: true })) {
  if (!slug.isDirectory()) continue;
  const dir = join(root, "captures", slug.name);
  for (const name of await readdir(dir)) {
    if (!drop.test(name)) continue;
    const path = join(dir, name);
    const info = await stat(path);
    files += 1;
    bytes += info.size;
    if (apply) await rm(path, { force: true });
  }
}
console.log(
  `${apply ? "removed" : "would remove"} ${files} files · ${(bytes / 1048576).toFixed(1)} MB ` +
    `(screenshots, css.json, diffs; frame.html + chunk.js + styles.css stay)`,
);
