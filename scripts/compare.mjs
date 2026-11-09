/**
 * Visual + geometry parity check for one item.
 *
 *   node scripts/compare.mjs emoji-picker [--local=http://localhost:5183] [--kind=block]
 *
 * Screenshots the live preview frame and the local /frame/<slug> route at the same viewport,
 * then diffs them with scripts/pixel_diff.py. Artifacts land in captures/<slug>/.
 */
import { chromium } from "playwright-core";
import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const slug = process.argv[2];
if (!slug) {
  console.error("usage: node scripts/compare.mjs <slug> [--local=URL] [--kind=block]");
  process.exit(1);
}
const kind = process.argv.includes("--kind=block") ? "block" : "component";
const localArg = process.argv.find((arg) => arg.startsWith("--local="));
const local = localArg ? localArg.slice("--local=".length) : "http://localhost:5183";
const remote = kind === "block" ? `https://uiarc.dev/components/blocks/${slug}/frame` : `https://uiarc.dev/components/${slug}/frame`;
const localUrl = `${local}/frame/${slug}`;
const dir = new URL(`../captures/${slug}/`, import.meta.url).pathname;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

/**
 * Navigate and wait for the page to go quiet. `networkidle` is the phase contract the scores were
 * calibrated on, but a few demos keep a socket or a media element busy forever (ai-chat never goes
 * idle), so fall back to `load` + a short settle instead of failing the shot outright.
 */
async function goto(page, url) {
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 25_000 });
  } catch (error) {
    if (!/networkidle|Timeout/i.test(String(error))) throw error;
    await page.goto(url, { waitUntil: "load", timeout: 25_000 });
    await page.waitForTimeout(600);
  }
}

async function shoot(url, out, selector) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await goto(page, url);
  // Web fonts land after networkidle; scoring before they settle makes results flaky.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  const root = page.locator(selector).first();
  const box = await root.boundingBox();
  await root.screenshot({ path: out });
  const html = await page.evaluate(() => document.body.innerText.slice(0, 400));
  await page.close();
  return { box, html };
}

/**
 * STABLE=1: wait for the demo to stop changing before shooting. The live frame is server-rendered
 * (its clock starts ~1s before networkidle) while the local dev page mounts at networkidle, so a
 * fixed delay catches two different phases of the same loop and penalises a faithful port. Sampling
 * until two consecutive frames match compares the resting state instead.
 * SCREENSHOT_AT=<ms> pins an explicit delay after networkidle for phase experiments.
 */
async function shootStable(url, out, selector) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await goto(page, url);
  await page.evaluate(() => document.fonts.ready);
  // Let both sides run past their intro (the live frame starts its clock ~1s before networkidle).
  await page.waitForTimeout(Number(process.env.WAIT ?? 4000));
  const root = page.locator(selector).first();
  const buffer = () => root.screenshot();
  let previous = await buffer();
  for (let attempt = 0; attempt < 14; attempt += 1) {
    await page.waitForTimeout(350);
    const next = await buffer();
    if (next.equals(previous)) {
      await writeFile(out, next);
      const box = await root.boundingBox();
      const html = await page.evaluate(() => document.body.innerText.slice(0, 400));
      await page.close();
      return { box, html, settledAfter: attempt };
    }
    previous = next;
  }
  await writeFile(out, previous);
  const box = await root.boundingBox();
  const html = await page.evaluate(() => document.body.innerText.slice(0, 400));
  await page.close();
  return { box, html, settledAfter: -1 };
}

const stable = process.env.STABLE === "1";
const pick = stable ? shootStable : shoot;
const realInfo = await pick(remote, `${dir}real.png`, "main[data-layout]");
const localInfo = await pick(localUrl, `${dir}local.png`, "[data-frame-root]");
await browser.close();

console.log(`real box ${JSON.stringify(realInfo.box)}`);
console.log(`local box ${JSON.stringify(localInfo.box)}`);
if (localInfo.html.includes("::not reconstructed::")) {
  console.log("local route has no demo mounted — port the component first");
  process.exit(0);
}

try {
  const { stdout } = await run(process.env.PYTHON ?? "python3", ["scripts/pixel_diff.py", `${dir}real.png`, `${dir}local.png`, `${dir}diff.png`], {
    cwd: new URL("..", import.meta.url).pathname,
  });
  console.log(stdout.trim());
} catch (error) {
  console.log(`pixel diff failed: ${error.message}`);
}
