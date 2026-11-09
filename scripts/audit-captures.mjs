// Audits captures/<slug>/: does chunk.js actually carry the item's own module classes?
// Usage: node scripts/audit-captures.mjs [--json]
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";

const SHARED = new Set([
  "animated-counter", "avatar", "badge", "button", "button-group", "card", "checkbox", "chip-group",
  "dropdown-menu", "frame-page", "icon-morph", "input", "kbd", "popover", "previews-demos", "radio-group",
  "segmented-control", "select", "site-footer", "slider", "spinner", "status", "switch", "tabs", "text-morph",
  "text-shimmer", "toast", "tooltip", "srOnly", "menu",
]);

const slugs = readdirSync("captures").filter((name) => statSync(`captures/${name}`).isDirectory());

const rows = [];
for (const slug of slugs) {
  const framePath = `captures/${slug}/frame.html`;
  const chunkPath = `captures/${slug}/chunk.js`;
  const cssPath = `captures/${slug}/styles.css`;
  if (!existsSync(chunkPath)) { rows.push({ slug, status: "no-chunk" }); continue; }

  const frame = readFileSync(framePath, "utf8");
  const chunk = readFileSync(chunkPath, "utf8");
  const css = existsSync(cssPath) ? readFileSync(cssPath, "utf8") : "";

  const prefixes = new Map();
  for (const token of frame.matchAll(/([a-z0-9-]+)_[A-Za-z0-9-]+__[A-Za-z0-9_]+/g)) {
    prefixes.set(token[1], (prefixes.get(token[1]) ?? 0) + 1);
  }
  const own = [...prefixes.entries()]
    .filter(([name]) => !SHARED.has(name))
    .sort((a, b) => b[1] - a[1]);

  const chunkClasses = new Set((chunk.match(/[a-z0-9-]+_[A-Za-z0-9-]+__[A-Za-z0-9_]+/g) ?? []).map((token) => token.split("_")[0]));
  const cssClasses = new Set((css.match(/[a-z0-9-]+_[A-Za-z0-9-]+__[A-Za-z0-9_]+/g) ?? []).map((token) => token.split("_")[0]));

  const hit = own.filter(([name]) => chunkClasses.has(name));
  const cssHit = own.filter(([name]) => cssClasses.has(name));
  const status = own.length === 0 ? "no-own-prefix" : hit.length ? (cssHit.length ? "ok" : "css-thin") : "bad-chunk";
  rows.push({ slug, status, own: own.slice(0, 3), chunkClasses: [...chunkClasses].slice(0, 4), cssClasses: [...cssClasses].slice(0, 4), chunkSize: chunk.length, cssSize: css.length });
}

const bad = rows.filter((row) => row.status !== "ok");
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(bad, null, 2));
} else {
  const counts = rows.reduce((acc, row) => ({ ...acc, [row.status]: (acc[row.status] ?? 0) + 1 }), {});
  console.log("status:", counts);
  for (const row of bad) console.log(`${row.status.padEnd(14)} ${row.slug.padEnd(24)} own=${JSON.stringify(row.own)} chunk=${JSON.stringify(row.chunkClasses)} css=${JSON.stringify(row.cssClasses)}`);
}
