/**
 * Structural twin check: the pixel score can hide a wrong DOM that happens to look the same.
 * This walks both trees (live frame vs local frame) and compares element paths, tags, boxes,
 * text and ARIA in order.
 *
 *   node scripts/dom-diff.mjs <slug> [--kind=block]
 *
 * Exit code is 1 when the structures diverge, so it can gate a port.
 */
import { chromium } from "playwright-core";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const slug = process.argv[2];
const kind = process.argv.includes("--kind=block") ? "block" : "component";
// --struct compares structure/text/ARIA only: for marquees and streamers every frame is a new
// layout, so an exact box match is the wrong gate there.
const structOnly = process.argv.includes("--struct");
// --tags compares the skeleton only (tag, role, ARIA label, node count). Marquees, tickers and
// streamers rewrite their text every frame, so text parity is a phase question, not a port question.
const tagsOnly = process.argv.includes("--tags");
if (!slug) throw new Error("usage: node scripts/dom-diff.mjs <slug> [--kind=block]");

const seen = new URL("../", import.meta.url).pathname;
const remote = `https://uiarc.dev/components/${kind === "block" ? "blocks/" : ""}${slug}/frame`;
const local = process.env.LOCAL ?? `http://localhost:5183/frame/${slug}`;

const collect = async (url) => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  // WAIT=<ms> lets an animated demo be compared in its settled phase; without it a
  // streaming/auto-starting item yields hundreds of phase mismatches that are not structural.
  await page.waitForTimeout(Number(process.env.WAIT ?? 1200));
  const tree = await page.evaluate(() => {
    const root = document.querySelector("main") ?? document.body;
    const out = [];
    const walk = (node, path) => {
      if (!(node instanceof HTMLElement || node instanceof SVGElement)) return;
      const box = node.getBoundingClientRect();
      const text = Array.from(node.childNodes)
        .filter((child) => child.nodeType === Node.TEXT_NODE)
        .map((child) => child.textContent.trim())
        .join(" ")
        .replace(/\s+/g, " ");
      out.push({
        path,
        tag: node.tagName.toLowerCase(),
        box: [box.x, box.y, box.width, box.height].map((value) => Math.round(value * 10) / 10),
        text,
        role: node.getAttribute("role"),
        label: node.getAttribute("aria-label"),
      });
      Array.from(node.children).forEach((child, index) => walk(child, `${path}/${index}`));
    };
    walk(root, "0");
    return out;
  });
  await browser.close();
  return tree;
};

const [real, mine] = [await collect(remote), await collect(local)];
const problems = [];
const length = Math.max(real.length, mine.length);
for (let index = 0; index < length; index += 1) {
  const a = real[index];
  const b = mine[index];
  if (!a || !b) {
    problems.push({ index, path: (a ?? b).path, reason: a ? "missing locally" : "extra locally", a, b });
    continue;
  }
  if (a.tag !== b.tag) problems.push({ index, path: a.path, reason: `tag ${a.tag} vs ${b.tag}` });
  else if (!structOnly && !tagsOnly && a.box.some((value, i) => Math.abs(value - b.box[i]) > 1))
    problems.push({ index, path: a.path, reason: `box ${a.box.join(",")} vs ${b.box.join(",")}` });
  else if (!tagsOnly && a.text !== b.text)
    problems.push({ index, path: a.path, reason: `text "${a.text}" vs "${b.text}"` });
  else if (a.role !== b.role) problems.push({ index, path: a.path, reason: `role ${a.role} vs ${b.role}` });
  else if (a.label !== b.label) problems.push({ index, path: a.path, reason: `label ${a.label} vs ${b.label}` });
}

const report = {
  slug,
  kind,
  realNodes: real.length,
  localNodes: mine.length,
  mismatches: problems.length,
  first: problems.slice(0, 20),
};
await writeFile(join(seen, "captures", slug, "dom-diff.json"), JSON.stringify(report, null, 1));
console.log(
  `${slug}: ${real.length} vs ${mine.length} nodes · ${problems.length} mismatches` +
    (problems.length ? `\n  first: ${problems.slice(0, 6).map((p) => `${p.path} ${p.reason}`).join("\n         ")}` : ""),
);
process.exit(problems.length ? 1 : 0);
