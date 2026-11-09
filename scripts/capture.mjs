/**
 * Capture everything the public preview frame ships for one item.
 *
 *   node scripts/capture.mjs emoji-picker [--kind=component|block]
 *
 * Writes captures/<slug>/ with:
 *   frame.html     server-rendered markup of the live demo
 *   css.json       every CSSOM rule, grouped by stylesheet href
 *   styles.js      the component's own CSS module (the flat `slug_*__hash` file)
 *   chunk.js       the webpack chunk that carries the demo + component implementation
 *   shot.png       full-frame screenshot
 *   root.png       screenshot of the demo root element
 *   meta.json      viewport, timestamp, asset URLs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "https://uiarc.dev";
const VIEWPORT = { width: 1280, height: 900 };

const slug = process.argv[2];
if (!slug) {
  console.error("usage: node scripts/capture.mjs <slug> [--kind=block]");
  process.exit(1);
}
const kind = process.argv.includes("--kind=block") ? "block" : "component";
const slugPrefix = slug.replace(/[^a-z0-9]+/gi, "-") + "_";
const url = kind === "block" ? `${BASE}/components/blocks/${slug}/frame` : `${BASE}/components/${slug}/frame`;
const outDir = new URL(`../captures/${slug}/`, import.meta.url);
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 });

// Keep every css/js body, then decide which ones matter once the DOM shows its class names:
// a block's module prefix is not always the slug (ai-chat renders `chat_*`, for example).
const bodies = [];
page.on("response", async (response) => {
  const href = response.url();
  if (!/\.(css|js)(\?|$)/.test(href)) return;
  try {
    const text = (await response.body()).toString("utf8");
    if (text.length > 4_000_000) return;
    bodies.push({ href, text });
  } catch {
    /* streaming or aborted response — skip */
  }
});

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(900);

const html = await page.content();
const css = await page.evaluate(() =>
  Array.from(document.styleSheets).map((sheet) => {
    let rules = [];
    try {
      rules = Array.from(sheet.cssRules).map((rule) => rule.cssText);
    } catch {
      rules = [];
    }
    return { href: sheet.href, rules };
  }),
);

// Module prefixes actually rendered: `chat_body__a36VX` -> "chat".
const prefixes = await page.evaluate(() =>
  Array.from(document.querySelectorAll("[class]")).flatMap((node) =>
    Array.from(node.classList)
      .map((token) => token.match(/^([a-z0-9-]+)_[A-Za-z0-9-]+__[A-Za-z0-9_]+$/)?.[1] ?? null)
      .filter(Boolean),
  ),
);
const counts = new Map();
for (const prefix of prefixes) counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
// Shared library modules appear on almost every frame (animated-counter alone can outnumber the
// item's own classes), so they never win the marker vote. Prefer the slug's own prefix when the
// DOM actually renders it, then the most frequent non-shared prefix.
const ignore = new Set([
  "animated-counter", "avatar", "badge", "button", "button-group", "card", "checkbox", "chip-group",
  "dropdown-menu", "frame-page", "icon-morph", "input", "kbd", "popover", "previews-actions-inputs",
  "previews-demos", "radio-group", "segmented-control", "select", "site-footer", "site-header", "slider",
  "spinner", "srOnly", "status", "switch", "tabs", "text-morph", "text-shimmer", "toast", "tooltip",
]);
const ranked = [...counts.entries()].filter(([name]) => !ignore.has(name)).sort((a, b) => b[1] - a[1]);
const slugBare = slugPrefix.slice(0, -1);
const slugHit = [...counts.entries()].find(([name]) => name === slugBare || name.startsWith(slugBare));
const marker = ((slugHit?.[0] ?? ranked[0]?.[0]) ?? slugBare) + "_";

const cssHits = bodies.filter((body) => body.href.endsWith(".css") && body.text.includes(marker)).map((body) => ({ ...body, size: body.text.length }));
const jsHits = bodies.filter((body) => !body.href.endsWith(".css") && body.text.includes(marker)).map((body) => ({ ...body, size: body.text.length }));

const root = page.locator("main, body > div").first();
await page.screenshot({ path: new URL("shot.png", outDir).pathname, fullPage: true });
try {
  await root.screenshot({ path: new URL("root.png", outDir).pathname });
} catch {
  /* element may not be screenshottable */
}

// The component module is the *smallest* CSS body that still carries several of the item's own
// selectors (a route-wide bundle also contains them, but it is an order of magnitude larger).
// The implementation chunk is the body with the most distinct item classes, not the biggest one.
const countClasses = (text) => new Set((text.match(/[a-z0-9-]+_[A-Za-z0-9-]+__[A-Za-z0-9_]+/g) ?? [])).size;
const ownOccurrences = (text) => (text.match(new RegExp(marker.replace(/[-]/g, "\\-"), "g")) ?? []).length;
cssHits.sort((a, b) => (ownOccurrences(b.text) >= 5) - (ownOccurrences(a.text) >= 5) || a.size - b.size);
jsHits.sort((a, b) => countClasses(b.text) - countClasses(a.text) || b.size - a.size);

await writeFile(new URL("frame.html", outDir), html);
await writeFile(new URL("css.json", outDir), JSON.stringify(css, null, 1));
if (cssHits[0]) await writeFile(new URL("styles.css", outDir), cssHits[0].text);
if (jsHits[0]) await writeFile(new URL("chunk.js", outDir), jsHits[0].text);
await writeFile(
  new URL("meta.json", outDir),
  JSON.stringify(
    {
      slug,
      kind,
      url,
      capturedAt: new Date().toISOString(),
      viewport: VIEWPORT,
      marker,
      modulePrefixes: ranked.slice(0, 6),
      css: cssHits.map((hit) => ({ href: hit.href, size: hit.size })),
      js: jsHits.map((hit) => ({ href: hit.href, size: hit.size })),
    },
    null,
    1,
  ),
);

await browser.close();

// Shared stylesheets: analytics/developer blocks ship one CSS module per group, so `styles.css`
// can carry a dozen siblings. Keep only this item's rules (originals stay in styles.full.css).
if (cssHits[0]) {
  const { execFileSync } = await import("node:child_process");
  try {
    execFileSync(process.execPath, [new URL("./css-slice.mjs", import.meta.url).pathname, slug, "--write"], { stdio: "ignore" });
  } catch {
    /* slicing is best-effort — the raw bundle is still usable */
  }
}

console.log(
  `${slug}: html ${html.length}B · css hits ${cssHits.length} (${cssHits[0]?.size ?? 0}) · js hits ${jsHits.length} (${jsHits[0]?.size ?? 0})`,
);
