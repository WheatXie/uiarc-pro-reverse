#!/usr/bin/env node
/**
 * Smoke test for the Arc Pro MCP server: every intent below has to put the right item in its top 3,
 * and the tool surface has to answer for Pro items without an account.
 *
 * Run: node ai/mcp/smoke.mjs
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const client = new Client({ name: "arc-pro-smoke", version: "0" });
await client.connect(new StdioClientTransport({ command: "node", args: [join(HERE, "server.mjs")] }));

const text = (result) => result.content.map((c) => c.text).join("\n");
const ids = (result) => [...text(result).matchAll(/^- ([a-z0-9-]+) /gm)].map((m) => m[1]);

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

const tools = (await client.listTools()).tools.map((t) => t.name).sort();
check("tools", tools.join(",") === "get_component,get_install_command,get_skill,list_components,search_components", tools.join(","));

const EXPECT = [
  ["confirm a destructive action", "confirm-morph"],
  ["account settings with toggles", "settings-page"],
  ["emoji picker", "emoji-picker"],
  ["ai chat with streaming answer", "ai-chat"],
  ["editable spreadsheet grid", "data-grid"],
  ["pricing plans comparison", "plan-comparison"],
  ["pipeline funnel chart", "funnel-chart"],
  ["command palette", "settings-command"],
  ["kanban board", "kanban-board"],
  ["undo a toast", "undo-toast"],
];

for (const [query, expected] of EXPECT) {
  const top = ids(await client.callTool({ name: "search_components", arguments: { query, limit: 5 } }));
  check(`search "${query}"`, top.slice(0, 3).includes(expected), `top: ${top.slice(0, 3).join(", ")}`);
}

const docs = await client.callTool({ name: "get_component", arguments: { id: "emoji-picker" } });
check("get_component docs", text(docs).includes("## API reference") && text(docs).includes("onSelect"));

const source = await client.callTool({ name: "get_component", arguments: { id: "data-grid", include: "source" } });
check("get_component source (pro, no account)", text(source).includes("src/components/arc/data-grid/data-grid.tsx"));

const install = await client.callTool({ name: "get_install_command", arguments: { ids: ["button", "split-bar"] } });
check("get_install_command", text(install).includes("@uiarc/button") && text(install).includes("split-bar"));

const skill = await client.callTool({ name: "get_skill", arguments: { file: "catalog/ai.md" } });
check("get_skill group catalogue", text(skill).startsWith("# AI"));

const listed = await client.callTool({ name: "list_components", arguments: { tier: "pro", kind: "block", limit: 5 } });
check("list_components filter", text(listed).includes("136 item(s)") || /item\(s\)/.test(text(listed)));

await client.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
