/** Capture every Pro item that has no capture yet: node scripts/capture-all.mjs [--blocks] */
import { execFile } from "node:child_process";
import { readFile, access } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const only = process.argv.includes("--blocks") ? "blocks" : "components";
const catalog = JSON.parse(await readFile(new URL("../src/data/catalog.json", import.meta.url), "utf8"));
const items = catalog[only].flatMap((group) => group.items).filter((item) => item.pro);

for (const item of items) {
  const dir = new URL(`../captures/${item.slug}/meta.json`, import.meta.url);
  try {
    await access(dir);
    console.log(`skip ${item.slug}`);
    continue;
  } catch {
    /* not captured yet */
  }
  try {
    const args = ["scripts/capture.mjs", item.slug, ...(only === "blocks" ? ["--kind=block"] : [])];
    const { stdout } = await run("node", args, { cwd: new URL("..", import.meta.url).pathname });
    console.log(stdout.trim());
  } catch (error) {
    console.log(`FAIL ${item.slug}: ${error.message.split("\n")[0]}`);
  }
}
