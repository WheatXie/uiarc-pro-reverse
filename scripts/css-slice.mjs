/**
 * Slice a captured stylesheet down to the rules that belong to one item.
 *
 *   node scripts/css-slice.mjs <slug> [--write]
 *
 * Analytics/Developer/Pricing blocks share one CSS module file, so `captures/<slug>/styles.css`
 * often contains a dozen siblings (mrr-waterfall's file starts with `.cohort-retention_root…`).
 * Porting the whole thing would drag unrelated classes into the clone and hide the item's own
 * cascade order; this keeps only the blocks whose selector (or keyframe name / custom property)
 * mentions the item's marker, and keeps an enclosing `@media`/`@container`/`@supports`/`@layer`
 * wrapper when at least one of its children survives.
 *
 * Prints the kept/total counts. Without --write it only reports.
 */
import { readFile, writeFile, stat } from "node:fs/promises";

const slug = process.argv[2];
if (!slug) {
  console.error("usage: node scripts/css-slice.mjs <slug> [--write]");
  process.exit(1);
}
const write = process.argv.includes("--write");
const dir = new URL(`../captures/${slug}/`, import.meta.url);
const file = new URL("styles.css", dir);

const meta = JSON.parse(await readFile(new URL("meta.json", dir), "utf8"));
const marker = meta.marker ?? `${slug}_`;
const text = await readFile(file, "utf8");

/** Split a stylesheet body into top-level chunks: `{ prelude, body }`, comments kept with the next prelude. */
function chunks(source) {
  const out = [];
  let prelude = "";
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      prelude += source.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === "{") {
      let depth = 1;
      let j = i + 1;
      while (j < source.length && depth > 0) {
        if (source[j] === "{") depth += 1;
        else if (source[j] === "}") depth -= 1;
        j += 1;
      }
      out.push({ prelude, body: source.slice(i + 1, j - 1), raw: `${prelude}{${source.slice(i + 1, j - 1)}}` });
      prelude = "";
      i = j;
      continue;
    }
    if (ch === ";") {
      // @import / @charset — keep verbatim, they are global.
      out.push({ prelude: prelude + ";", body: null, raw: `${prelude};` });
      prelude = "";
      i += 1;
      continue;
    }
    prelude += ch;
    i += 1;
  }
  if (prelude.trim()) out.push({ prelude, body: null, raw: prelude });
  return out;
}

const atRules = /^@(media|container|supports|layer|scope)\b/;

function filter(list) {
  const kept = [];
  for (const chunk of list) {
    if (chunk.body === null) {
      kept.push(chunk); // @import / @charset
      continue;
    }
    const name = chunk.prelude.trim();
    if (atRules.test(name)) {
      const inner = filter(chunks(chunk.body));
      const meaningful = inner.filter((item) => item.body !== null && item.prelude.trim() !== "");
      if (meaningful.length > 0) kept.push({ ...chunk, raw: `${chunk.prelude}{${inner.map((i2) => i2.raw).join("\n")}}` });
      continue;
    }
    // `@keyframes x`, a normal rule, or `@font-face` (kept only when it names the item).
    if (chunk.raw.includes(marker)) kept.push(chunk);
  }
  return kept;
}

const all = chunks(text);
const kept = filter(all);
const summary = `${slug} (${marker}): ${kept.length}/${all.length} top-level chunks kept · ${text.length}B → ${kept.reduce((n, c) => n + c.raw.length, 0)}B`;
console.log(summary);

if (write) {
  const out = kept.map((chunk) => chunk.raw).join("\n");
  try {
    await stat(new URL("styles.full.css", dir));
  } catch {
    await writeFile(new URL("styles.full.css", dir), text);
  }
  await writeFile(file, out);
}
