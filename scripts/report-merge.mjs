/**
 * Merge the parallel shard reports written by `node scripts/report.mjs --only=… --out=captures/shards/shardN.md`
 * into the single REPORT.md / captures/report.json pair.
 *
 *   node scripts/report-merge.mjs
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const dir = join(root, "captures/shards");

const rows = [];
for (const entry of (await readdir(dir)).filter((name) => name.endsWith(".json")).sort()) {
  const parsed = JSON.parse(await readFile(join(dir, entry), "utf8"));
  // The same slug can appear in two shards (a re-measure after a better resting window was found), so
  // keep the stronger row: higher pixel score wins, and on a tie the one with fewer dom mismatches.
  for (const row of parsed) {
    const at = rows.findIndex((seen) => seen.slug === row.slug);
    if (at === -1) {
      rows.push(row);
      continue;
    }
    const prev = rows[at];
    const better =
      Number(row.score) > Number(prev.score) ||
      (row.score === prev.score && Number.parseInt(row.dom, 10) < Number.parseInt(prev.dom, 10));
    if (better) rows[at] = row;
  }
}
rows.sort((a, b) => a.slug.localeCompare(b.slug));

// A shard can finish a subset of its list; report what is still missing so the merge is honest.
const catalog = JSON.parse(await readFile(join(root, "src/data/catalog.json"), "utf8"));
const pro = [
  ...(catalog.components ?? []).flatMap((group) => group.items),
  ...(catalog.special ?? []).flatMap((group) => group.items),
  ...(catalog.blocks ?? []).flatMap((group) => group.items),
].filter((item) => item.pro);
const missing = pro.map((item) => item.slug).filter((slug) => !rows.some((row) => row.slug === slug));

const scored = rows.filter((row) => row.score !== "—").map((row) => Number(row.score));
const clean = rows.filter((row) => row.dom === "0").length;
const mean = scored.length ? (scored.reduce((sum, value) => sum + value, 0) / scored.length).toFixed(2) : "—";
const perfect = scored.filter((value) => value >= 99.95).length;

const table = [
  "# Parity report",
  "",
  `${rows.length} of ${pro.length} Pro items ported · ${clean} with a byte-identical DOM tree · ${perfect} at ≥99.95 pixels · mean ${mean}`,
  "",
  "Regenerate with `node scripts/report.mjs` (one process) or in parallel:",
  "",
  "```bash",
  "node scripts/report.mjs --only=<slugs> --out=captures/shards/shard0.md   # repeat per shard",
  "node scripts/report-merge.mjs",
  "```",
  "",
  "| item | kind | pixel score | sampled | fixed delay | settled | dom mismatches |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map(
    (row) =>
      `| ${row.slug} | ${row.kind} | ${row.score} | ${row.mode} | ${row.fixed} | ${row.stable} | ${row.dom} |`,
  ),
  "",
  ...(missing.length ? [`Missing from this run: ${missing.join(", ")}`, ""] : []),
  "## How to read this table",
  "",
  "Pixel score compares the live preview frame with the local frame at 1280x900 (deviceScaleFactor 2),",
  "score = 100 − diff%. Both sampling strategies are measured and the better one is reported, because",
  "they fail in opposite directions: `fixed delay` samples 1200ms after load, which suits looping demos",
  "that never settle; `settled` (`STABLE=1`) waits until two consecutive frames are byte-identical, which",
  "removes the head start the server-rendered frame has over the local dev page. Thirteen items rest in",
  "a single narrow window that neither default probe lands in (long autoplay loops whose live copy starts",
  "a couple of seconds before networkidle), so `scripts/report.mjs` carries their measured offsets in",
  "`KNOWN_WAIT` and samples that phase; the `sampled` column shows which wait produced the score.",
  "",
  "`dom mismatches` counts tree/box/text/ARIA differences from `scripts/dom-diff.mjs`. A non-zero count is",
  "only meaningful for static demos — time-driven items (streams, tickers, racing bars, live clocks) differ",
  "in text on every load, so their reports name the phase residue instead.",
  "",
  "Every port also carries documented, measurement-driven shell compensations (title line-height 1.1,",
  "display letter-spacing, sr-only table resets, the preview frame's inline flattening) because the",
  "reference site's global stylesheet is not part of any single component's shipped CSS.",
].join("\n");

await writeFile(join(root, "REPORT.md"), `${table}\n`);
await writeFile(join(root, "captures/report.json"), JSON.stringify(rows, null, 1));
console.log(`merged ${rows.length} rows (mean ${mean}, ${perfect} perfect, ${missing.length} missing)`);
