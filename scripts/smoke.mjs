/**
 * Route-level smoke test: every ported Pro item must render its page without console errors,
 * mount a real preview inside the stage, and expose a Code tab with source files.
 *
 *   node scripts/smoke.mjs [slug…]        (default: every ported item)
 */
import { chromium } from "playwright-core";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const local = process.env.LOCAL ?? "http://localhost:5183";
const catalog = JSON.parse(await readFile(join(root, "src/data/catalog.json"), "utf8"));
const kindOf = new Map([...catalog.components.flatMap((g) => g.items), ...(catalog.special ?? []).flatMap((g) => g.items), ...catalog.blocks.flatMap((g) => g.items)].map((i) => [i.slug, i.pro ? "pro" : "free"]));
const componentSlugs = new Set([...catalog.components.flatMap((g) => g.items.map((i) => i.slug)), ...(catalog.special ?? []).flatMap((g) => g.items.map((i) => i.slug))]);
const dirs = (await readdir(join(root, "src/components/arc"), { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
const ported = dirs.filter((slug) => kindOf.get(slug) === "pro" && existsSync(join(root, "src/components/arc", slug, "demo.tsx"))).sort();
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ported;

const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const failures = [];
for (const slug of targets) {
  const route = componentSlugs.has(slug) ? `/components/${slug}` : `/components/blocks/${slug}`;
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on("console", (m) => m.type() === "error" && !/favicon/.test(m.text()) && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  let status = 0;
  try {
    const response = await page.goto(`${local}${route}`, { waitUntil: "networkidle" });
    status = response?.status() ?? 0;
    await page.waitForTimeout(600);
    const stage = await page.locator("[data-stage]").first().innerText().catch(() => "");
    const pending = /not reconstructed/i.test(stage);
    const codeTab = await page.locator("[data-code-files], button:has-text('Code')").first().count();
    await page.locator("button", { hasText: "Code" }).first().click().catch(() => {});
    await page.waitForTimeout(400);
    const files = await page.locator("[data-code-files] > *").count().catch(() => 0);
    const ok = status === 200 && !pending && codeTab > 0 && files > 0 && errors.length === 0;
    if (!ok) failures.push(slug);
    console.log(`${ok ? "ok  " : "FAIL"} ${slug.padEnd(20)} status ${status} preview ${pending ? "pending" : "live"} code-files ${files} errors ${errors.length}`);
    if (errors.length) errors.slice(0, 3).forEach((e) => console.log(`     ! ${e.slice(0, 160)}`));
  } catch (error) {
    failures.push(slug);
    console.log(`FAIL ${slug.padEnd(20)} ${error.message.split("\n")[0]}`);
  } finally {
    await page.close();
  }
}
await browser.close();
console.log(failures.length ? `\n${failures.length} failing: ${failures.join(" ")}` : `\nall ${targets.length} routes ok`);
process.exit(failures.length ? 1 : 0);
