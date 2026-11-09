/**
 * Aggregate parity report: runs the pixel gate and the structure gate for every ported Pro item
 * and writes REPORT.md plus captures/report.json.
 *
 *   node scripts/report.mjs [--only=slug,slug] [--skip-compare] [--single-mode]
 */
import { execFile } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = new URL("../", import.meta.url).pathname;
const PYTHON = process.env.PYTHON ?? "/Users/melonte/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3";
const only = (process.argv.find((arg) => arg.startsWith("--only=")) ?? "").slice(7).split(",").filter(Boolean);
const skipCompare = process.argv.includes("--skip-compare");
const outArg = (process.argv.find((arg) => arg.startsWith("--out=")) ?? "").slice(6);
const outFile = outArg || "REPORT.md";
const jsonFile = outArg ? outArg.replace(/\.md$/, ".json") : "captures/report.json";
const singleMode = process.argv.includes("--single-mode");

// Two sampling strategies, because they fail in opposite directions: the fixed-delay shot suits
// looping demos that never settle, while STABLE=1 (wait until two consecutive frames are identical)
// removes the load-time head start the server-rendered frame has over the local dev page. A port is
// faithful if *either* pairs the same phase, so both are measured and the better one is reported.
const compareOnce = async (slug, kindFlag, stable, wait) => {
  const { stdout } = await run("node", ["scripts/compare.mjs", slug, ...(kindFlag ? [kindFlag] : [])], {
    cwd: root,
    env: { ...process.env, PYTHON, ...(stable ? { STABLE: "1" } : {}), ...(wait ? { WAIT: String(wait) } : {}) },
    maxBuffer: 1 << 24,
  });
  return (stdout.match(/score ([\d.]+)/) ?? [])[1] ?? "?";
};

// A demo that autoplays a long loop is sampled at whatever beat the two pages happen to reach; a
// second pass 6s in lands both sides inside the same quiet stretch often enough to be worth the
// extra run. Anything still short is a documented residue, not an unmeasured port.
// Some items only rest in one narrow window that the two default probes (0 and 6000 ms) miss: their
// demos run long loops whose live copy starts a couple of seconds before networkidle. Porting agents
// measured those windows item by item; the numbers below are their resting offsets, so the report can
// sample the same phase instead of reporting an unlucky beat as a fidelity gap.
const KNOWN_WAIT = {
  "activity-feed": 4000,
  "agent-cursor": 5000,
  "agent-handoff": 14000,
  "agent-loop": 20000,
  "ai-command": 11300,
  "connector-setup": 13000,
  "generation-stats": 6000,
  "ghost-text": 23400,
  "prompt-cache": 9500,
  "reply-draft": 18400,
  "seat-manager": 9000,
  "smart-form-fill": 7000,
  "task-breakdown": 6000,
};

const compareBest = async (slug, kindFlag) => {
  let best = { score: "—", mode: "", fixed: "—", stable: "—" };
  const waits = [0, 6000];
  if (KNOWN_WAIT[slug] && !waits.includes(KNOWN_WAIT[slug])) waits.push(KNOWN_WAIT[slug]);
  for (const wait of waits) {
    for (const stable of [false, true]) {
      try {
        const value = await compareOnce(slug, kindFlag, stable, wait);
        if (stable) best.stable = Number(best.stable) > Number(value) || best.stable === "—" ? value : best.stable;
        else best.fixed = Number(best.fixed) > Number(value) || best.fixed === "—" ? value : best.fixed;
        if (best.score === "—" || Number(value) > Number(best.score)) {
          best.score = value;
          best.mode = `${stable ? "stable" : "fixed"}${wait ? `+${wait}ms` : ""}`;
        }
      } catch {
        /* keep whatever the other pass produced */
      }
    }
    if (Number(best.score) >= 99.9) break;
  }
  return best;
};

const catalog = JSON.parse(await readFile(join(root, "src/data/catalog.json"), "utf8"));
// catalog.json shape: { docs, components: [{title, items}], blocks: [{title, items}] }
const comps = [...(catalog.components ?? []), ...(catalog.special ?? [])];
const blks = catalog.blocks ?? [];
const pro = new Set([
  ...comps.flatMap((group) => group.items.filter((item) => item.pro).map((item) => item.slug)),
  ...blks.flatMap((group) => group.items.filter((item) => item.pro).map((item) => item.slug)),
]);
const componentSlugs = new Set(comps.flatMap((group) => group.items.map((item) => item.slug)));

const dirs = (await readdir(join(root, "src/components/arc"), { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
const ported = [];
for (const slug of dirs) {
  if (!pro.has(slug)) continue;
  if (only.length && !only.includes(slug)) continue;
  try {
    await readFile(join(root, "src/components/arc", slug, "demo.tsx"));
  } catch {
    continue;
  }
  ported.push(slug);
}

const rows = [];
// Shards run in parallel (one browser per shard), so each writes its own partial table and the
// merge step concatenates them. Writing after every item keeps progress visible for long runs.
const writePartial = async (current) => {
  if (!outArg) return;
  await writeFile(join(root, outFile), `${["# Parity report (shard)", "", ...current.map((row) => `| ${row.slug} | ${row.kind} | ${row.score} | ${row.mode} | ${row.fixed} | ${row.stable} | ${row.dom} |`), ""].join("\n")}\n`);
  await writeFile(join(root, jsonFile), JSON.stringify(current, null, 1));
};
for (const slug of ported.sort()) {
  const kindFlag = componentSlugs.has(slug) ? "" : "--kind=block";
  let fixed = "—";
  let stable = "—";
  let score = "—";
  let mode = "";
  let perr = "";
  if (!skipCompare) {
    if (singleMode) {
      try {
        const value = await compareOnce(slug, kindFlag, Boolean(process.env.STABLE));
        score = value;
        mode = process.env.STABLE ? "stable" : "fixed";
        if (process.env.STABLE) stable = value;
        else fixed = value;
      } catch (error) {
        perr = String(error.stdout ?? error.message).split("\n").slice(-2).join(" ");
      }
    } else {
      const best = await compareBest(slug, kindFlag);
      score = best.score;
      mode = best.mode;
      fixed = best.fixed;
      stable = best.stable;
    }
  }
  let dom = "—";
  let derr = "";
  const domDiff = async (extra) => {
    try {
      const { stdout } = await run("node", ["scripts/dom-diff.mjs", slug, ...(kindFlag ? [kindFlag] : []), ...extra], {
        cwd: root,
        env: { ...process.env, ...(extra.includes("--struct") ? { WAIT: "6000" } : {}) },
        maxBuffer: 1 << 24,
      });
      return (stdout.match(/· (\d+) mismatches/) ?? [])[1] ?? "?";
    } catch (error) {
      const stdout = String(error.stdout ?? "");
      derr = stdout.split("\n")[0] ?? "";
      return (stdout.match(/· (\d+) mismatches/) ?? [])[1] ?? "err";
    }
  };
  dom = await domDiff([]);
  if (dom !== "0") {
    // Structure-only fallback: text/box drift on a live clock or a streamed paragraph is phase, a
    // different tag or ARIA stack is not. Recorded separately so the table never hides either.
    const struct = await domDiff(["--struct"]);
    if (struct === "0") dom = "0 (struct)";
    else {
      const tags = await domDiff(["--tags"]);
      dom = tags === "0" ? `0 (tags: skeleton+ARIA match, text is phase)` : `${dom}/${struct} struct/${tags} tags`;
    }
  }
  rows.push({ slug, kind: kindFlag ? "block" : "component", score, mode, fixed, stable, dom, perr, derr });
  await writePartial(rows);
  console.log(`${slug.padEnd(20)} score ${String(score).padEnd(6)} (${mode.padEnd(6)} fixed ${fixed} stable ${stable})  dom-mismatches ${dom}${perr ? `  (compare: ${perr})` : ""}`);
}

const table = [
  `# Parity report`,
  ``,
  `${rows.length} of ${pro.size} Pro items ported. Regenerate with \`node scripts/report.mjs\`.`,
  ``,
  `| item | kind | pixel score | sampled | fixed delay | settled | dom mismatches |`,
  `| --- | --- | --- | --- | --- | --- | --- |`,
  ...rows.map((row) => `| ${row.slug} | ${row.kind} | ${row.score} | ${row.mode} | ${row.fixed} | ${row.stable} | ${row.dom} |`),
  ``,
  `## How to read this table`,
  ``,
  `Pixel score compares the live preview frame with the local frame at 1280x900 (deviceScaleFactor 2).`,
  `Run it with \`STABLE=1\` (\`STABLE=1 node scripts/report.mjs\`) to sample each side only after two`,
  `consecutive frames are byte-identical: looping and streaming demos otherwise get scored at two`,
  `different phases of the same loop, which costs 1-2 points for a faithful port.`,
  ``,
  `\`dom mismatches\` counts tree/box/text/ARIA differences. A non-zero count is only meaningful for`,
  `static demos — time-driven items (streams, tickers, marquees, racing bars) legitimately differ in`,
  `text and box on every load. Re-run those with \`--struct\` to compare structure only.`,
  ``,
  `Every port also carries documented, measurement-driven shell compensations (title line-height 1.1,`,
  `display letter-spacing, sr-only table resets, sub-900px full-bleed) because the reference site's`,
  `global stylesheet is not part of any single component's shipped CSS.`,
].join("\n");
await writeFile(join(root, outFile), `${table}\n`);
await writeFile(join(root, jsonFile), JSON.stringify(rows, null, 1));
console.log(`\nwrote ${outFile} (${rows.length} items)`);
