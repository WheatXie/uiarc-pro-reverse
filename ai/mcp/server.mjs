#!/usr/bin/env node
/**
 * Arc Pro MCP server — local, read-only, no account.
 *
 * The official Arc MCP (https://uiarc.dev/api/mcp) needs a signed-in Arc account before the first
 * tool call, and returns Pro items only for a Pro plan. This one is built on the reconstruction in
 * this repository, so it answers for all 380 items and can hand back the actual source files.
 *
 * Tools
 *   search_components   intent → ranked ids with the reason to use each one
 *   list_components     browse by kind, group, tier
 *   get_component       docs (when to use / not, usage, props, a11y, motion, responsive) + source
 *   get_install_command install or copy instructions for one or more ids
 *   get_skill           one file of the bundled skill (components, design, copy, motion, …)
 *
 * Transport: stdio (newline-delimited JSON-RPC). Run `node ai/mcp/server.mjs`.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "../..");
const INDEX = JSON.parse(await readFile(join(REPO, "ai/data/index.json"), "utf8"));
const ITEMS = INDEX.items;
const BY_ID = new Map(ITEMS.map((item) => [item.id, item]));
const DOCS = join(REPO, "public/docs");
const ARC = join(REPO, "src/components/arc");
const BLOCKS = join(ARC, "blocks");
const SKILL = join(REPO, "ai/skill/arc-pro");

/** Document frequency over the catalogue, so rare words ("toggles") outrank common ones ("account"). */
const DF = new Map();
for (const item of ITEMS) {
  const words = new Set(
    `${item.id} ${item.title} ${item.group} ${item.summary} ${item.keywords.join(" ")}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter(Boolean),
  );
  for (const word of words) DF.set(word, (DF.get(word) ?? 0) + 1);
}
const idf = (token) => {
  const df = DF.get(token) ?? 0;
  return 1 + Math.log((ITEMS.length + 1) / (df + 1));
};

const SOURCE_LIMIT = 160_000; // characters of source per call; larger items are truncated with a note

const normalise = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Words that carry no intent; dropping them stops "with" from counting as a match. */
const STOP = new Set(["a", "an", "the", "with", "for", "and", "or", "of", "in", "on", "to", "that", "my", "your", "when", "like"]);

function tokenise(query) {
  const all = normalise(query).split(" ").filter(Boolean);
  const meaningful = all.filter((t) => !STOP.has(t));
  return meaningful.length ? meaningful : all;
}

async function doc(id) {
  const file = join(DOCS, `${id}.md`);
  return existsSync(file) ? readFile(file, "utf8") : "";
}

/** Every item, free or Pro, is a directory in this repo: the single source of truth. */
async function sourceFiles(id) {
  if (!BY_ID.has(id)) return [];
  const direct = join(ARC, id);
  const dir = existsSync(direct) ? direct : join(BLOCKS, id);
  if (!existsSync(dir)) return [];
  const names = (await readdir(dir)).filter((n) => /\.(tsx?|css)$/.test(n)).sort();
  const rel = dir === direct ? `src/components/arc/${id}` : `src/components/arc/blocks/${id}`;
  const out = [];
  for (const name of names) out.push({ path: `${rel}/${name}`, body: await readFile(join(dir, name), "utf8") });
  return out;
}

/** Words people use for the same job; expands the query so intent survives vocabulary. */
const SYNONYMS = {
  kpi: ["metric", "stat", "number", "ticker"],
  metric: ["kpi", "stat"],
  dashboard: ["overview", "analytics", "metrics"],
  overview: ["dashboard", "summary"],
  delete: ["destructive", "remove", "trash"],
  destructive: ["delete", "danger"],
  form: ["input", "field", "submit"],
  table: ["grid", "rows", "data"],
  grid: ["table", "cells"],
  chart: ["graph", "plot", "visualization"],
  graph: ["chart", "plot"],
  toast: ["notification", "snackbar"],
  notification: ["toast", "alert"],
  emoji: ["smiley", "emoticon"],
  picker: ["chooser", "select"],
  upload: ["dropzone", "file"],
  auth: ["login", "signin", "sign-in"],
  login: ["signin", "sign-in", "auth"],
  ai: ["agent", "assistant", "llm", "prompt"],
  agent: ["ai", "assistant"],
  loading: ["skeleton", "spinner", "shimmer"],
  sidebar: ["nav", "navigation", "rail"],
  nav: ["navigation", "sidebar", "menu"],
  pricing: ["plans", "billing", "tier"],
  preferences: ["settings"],
};

function expand(tokens) {
  const out = new Set(tokens);
  for (const token of tokens) {
    for (const extra of SYNONYMS[token] ?? []) out.add(extra);
    if (token.length > 3 && token.endsWith("s")) out.add(token.slice(0, -1));
  }
  return [...out];
}

/**
 * Score one item against the query. Returns null when the item is not a plausible answer.
 * A match needs either one strong hit (id, title or keyword) plus a majority of the query words,
 * or two thirds of the words landing somewhere — "dashboard kpi row" should reach metrics-dashboard
 * even though the docs never say "row".
 */
function score(item, tokens, phrase) {
  const title = normalise(item.title);
  const id = normalise(item.id);
  const summary = normalise(item.summary);
  const keywords = item.keywords.map(normalise);
  const uses = item.uses.map(normalise).join(" ");
  const group = normalise(item.group);

  const hit = (token) => {
    if (title === token || id === token) return 12;
    if (title.startsWith(token) || id.startsWith(token)) return 9;
    if (keywords.some((k) => k === token)) return 8;
    if (keywords.some((k) => k.includes(token))) return 6;
    if (id.includes(token)) return 5;
    if (title.includes(token)) return 5;
    if (summary.includes(token)) return 3;
    if (uses.includes(token)) return 2;
    if (group.includes(token)) return 1;
    return 0;
  };

  let total = 0;
  let matched = 0;
  let strong = 0;
  let inName = 0;
  for (const token of tokens) {
    const expanded = expand([token]);
    const literal = hit(token);
    const best = Math.max(literal, ...expanded.filter((word) => word !== token).map((word) => hit(word) * 0.6));
    if (best) matched += 1;
    if (best >= 6) strong += 1;
    if (id.includes(token) || title.includes(token)) inName += 1;
    total += best * idf(token);
  }
  const ratio = matched / tokens.length;
  if (strong === 0 || ratio < 0.6) return null;
  // An item whose own name covers the query beats one that only mentions the words in prose.
  total += 10 * (inName / tokens.length);
  if (phrase && (id.includes(phrase.replace(/ /g, "-")) || title.includes(phrase))) total += 8;
  if (item.kind === "block") total += 0.5;
  return total;
}

function brief(item) {
  return {
    id: item.id,
    title: item.title,
    kind: item.kind,
    group: item.group,
    tier: item.tier,
    summary: item.summary,
    useWhen: item.uses,
    notFor: item.avoids,
    hasSource: item.hasSource,
  };
}

const server = new McpServer(
  { name: "arc-pro", version: "0.1.0" },
  {
    instructions:
      "Arc UI, complete: 380 items (233 Pro + 147 free) with live previews, docs and source in this repository. " +
      "Use search_components to find an item by intent, get_component to read its docs and (optionally) its source, " +
      "then get_install_command for the copy/install path. Pro items need no account here — their source is local.",
  },
);

server.registerTool(
  "search_components",
  {
    title: "Search Arc components and blocks by intent",
    description:
      "Find Arc items by what the interface has to do, for example \"confirm a destructive action\" or " +
      "\"dashboard KPI row\". Every query word must match some field. Returns ids, the reason to use each, and the " +
      "reason not to.",
    inputSchema: {
      query: z.string().min(1).describe("Intent or keywords, e.g. \"pricing compare plans\" or \"emoji picker\""),
      kind: z.enum(["component", "block", "special", "any"]).default("any").describe("Restrict to components, blocks or special components"),
      tier: z.enum(["pro", "free", "any"]).default("any").describe("Restrict by where the item came from"),
      group: z.string().optional().describe("Restrict to a catalogue group, e.g. \"Pickers\", \"AI\", \"Analytics\""),
      limit: z.number().int().min(1).max(25).default(8),
    },
  },
  async ({ query, kind, tier, group, limit }) => {
    const tokens = tokenise(query);
    const phrase = normalise(query);
    const ranked = ITEMS.filter(
      (item) =>
        (kind === "any" || item.kind === kind) &&
        (tier === "any" || item.tier === tier) &&
        (!group || normalise(item.group).includes(normalise(group))),
    )
      .map((item) => ({ item, score: score(item, tokens, phrase) }))
      .filter((entry) => entry.score !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (!ranked.length) {
      return {
        content: [
          {
            type: "text",
            text: `No item matches every word of "${query}". Try fewer words, or call list_components to browse ${ITEMS.length} ids.`,
          },
        ],
      };
    }
    const text = ranked
      .map(({ item, score: s }) => {
        const use = item.uses[0] ? `\n   use when: ${item.uses[0]}` : "";
        const not = item.avoids[0] ? `\n   not for: ${item.avoids[0]}` : "";
        return `- ${item.id} (${item.kind}, ${item.tier}, ${item.group}) — ${item.summary}${use}${not}\n   score ${s.toFixed(1)}`;
      })
      .join("\n");
    return {
      content: [{ type: "text", text: `${ranked.length} match(es) for "${query}":\n${text}` }],
      structuredContent: { items: ranked.map(({ item }) => brief(item)) },
    };
  },
);

server.registerTool(
  "list_components",
  {
    title: "Browse the Arc catalogue",
    description: "List ids by kind, group or tier, or list the groups themselves when no filter is given.",
    inputSchema: {
      kind: z.enum(["component", "block", "special", "any"]).default("any"),
      tier: z.enum(["pro", "free", "any"]).default("any"),
      group: z.string().optional().describe("Group name, e.g. \"Overlays\" or \"AI\""),
      limit: z.number().int().min(1).max(380).default(60),
      offset: z.number().int().min(0).default(0),
    },
  },
  async ({ kind, tier, group, limit, offset }) => {
    if (!group && kind === "any" && tier === "any" && limit === 60 && offset === 0) {
      const lines = Object.entries(INDEX.groups)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, count]) => `- ${name} (${count})`);
      return {
        content: [
          {
            type: "text",
            text: `${INDEX.counts.total} items: ${INDEX.counts.component} components, ${INDEX.counts.block} blocks, ${INDEX.counts.special} special · ${INDEX.counts.pro} Pro, ${INDEX.counts.free} free.\nGroups:\n${lines.join("\n")}\n\nPass a group or kind to list the ids.`,
          },
        ],
        structuredContent: { counts: INDEX.counts, groups: INDEX.groups },
      };
    }
    const filtered = ITEMS.filter(
      (item) =>
        (kind === "any" || item.kind === kind) &&
        (tier === "any" || item.tier === tier) &&
        (!group || normalise(item.group).includes(normalise(group))),
    );
    const page = filtered.slice(offset, offset + limit);
    const text = page.map((i) => `- ${i.id} (${i.kind}, ${i.tier}) — ${i.summary}`).join("\n");
    return {
      content: [
        {
          type: "text",
          text: `${filtered.length} item(s)${group ? ` in ${group}` : ""}; showing ${offset + 1}-${offset + page.length}.\n${text}`,
        },
      ],
      structuredContent: { total: filtered.length, items: page.map(brief) },
    };
  },
);

server.registerTool(
  "get_component",
  {
    title: "Read one Arc item: docs, props and source",
    description:
      "Returns the item's full docs — when to use and when not to, install, usage, API reference, keyboard, " +
      "accessibility, motion, responsive and performance notes — and, on request, its source files. " +
      "Pro items are local here, so source works without an account.",
    inputSchema: {
      id: z.string().min(1).describe("Item id, e.g. \"emoji-picker\", \"data-grid\", \"ai-chat\""),
      include: z
        .enum(["docs", "source", "both"])
        .default("docs")
        .describe("docs (default), source (the files) or both"),
      section: z
        .string()
        .optional()
        .describe("Return only one doc section, e.g. \"API reference\" or \"When not to use\""),
    },
  },
  async ({ id, include, section }) => {
    const item = BY_ID.get(id);
    if (!item) {
      const guess = ITEMS.filter((i) => normalise(i.id).includes(normalise(id)))
        .slice(0, 6)
        .map((i) => i.id);
      return {
        content: [
          {
            type: "text",
            text: `Unknown id "${id}".${guess.length ? ` Closest ids: ${guess.join(", ")}` : " Call list_components to browse."}`,
          },
        ],
        isError: true,
      };
    }

    const markdown = await doc(id);
    let docPart = markdown;
    if (section && markdown) {
      const blocks = markdown.split(/^## /m);
      const hit = blocks.find((b) => normalise(b.split("\n")[0]).includes(normalise(section)));
      docPart = hit ? `## ${hit.trim()}` : `No section "${section}" in ${id}. Sections: ${item.sections.join(", ") || "none"}`;
    }

    const parts = [];
    parts.push(
      `${item.title} — ${item.kind}, ${item.tier}, group ${item.group}${item.variants ? `, ${item.variants} variants` : ""}`,
    );
    parts.push(`id: ${item.id} · files: ${item.files.length ? item.files.map((f) => f.path).join(", ") : "registry item"}`);
    if (include !== "source") parts.push("", docPart || item.summary);

    if (include !== "docs") {
      const files = await sourceFiles(id);
      if (!files.length) {
        parts.push("", "No source in this repository for this id (it is a variants landing page or a registry alias).");
      } else {
        let budget = SOURCE_LIMIT;
        parts.push("", `Source (${files.length} file(s)):`);
        for (const file of files) {
          const body = file.body.length > budget ? `${file.body.slice(0, budget)}\n/* truncated */` : file.body;
          budget -= body.length;
          parts.push("", `### ${file.path}`, "```", body, "```");
          if (budget <= 0) {
            parts.push("", "Remaining files omitted: the item is larger than the per-call budget. Ask again with include=\"source\" and read the paths from the repository.");
            break;
          }
        }
      }
    }

    return { content: [{ type: "text", text: parts.join("\n") }], structuredContent: brief(item) };
  },
);

server.registerTool(
  "get_install_command",
  {
    title: "Install or copy one or more Arc items",
    description:
      "Every item is a local directory in this repository, so this returns the import path for use here or the " +
      "copy recipe for another project. Free items can also come from the public registry, which needs no account.",
    inputSchema: {
      ids: z.array(z.string()).min(1).max(20).describe("Item ids, e.g. [\"button\", \"emoji-picker\"]"),
      target: z.enum(["repo", "external"]).default("repo").describe("repo = use this checkout, external = copy into another project"),
    },
  },
  async ({ ids, target }) => {
    const lines = [];
    for (const id of ids) {
      const item = BY_ID.get(id);
      if (!item) {
        lines.push(`- ${id}: unknown id`);
        continue;
      }
      const isBlock = item.kind === "block" && item.tier === "free";
      const dir = isBlock ? `src/components/arc/blocks/${id}` : `src/components/arc/${id}`;
      const note = item.tier === "free" ? ` · free, also on the public registry: npx shadcn@latest add @uiarc/${id}` : "";
      if (target === "repo") {
        lines.push(`- ${id}: import from "${isBlock ? `@/components/arc/blocks/${id}/${id}` : `@/components/arc/${id}/${id}`}"${note}`);
      } else {
        const deps = item.dependencies.length ? ` · needs ${item.dependencies.join(", ")}` : "";
        lines.push(`- ${id}: copy ${dir}/ into <project>/${dir}/${deps}${note}`);
      }
    }
    lines.push(
      "",
      target === "repo"
        ? "Import foundation.css once: `import \"@/components/arc/foundation.css\";`"
        : "Also copy src/components/arc/lib/ and any shared item a file imports, plus foundation.css.",
    );
    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);

server.registerTool(
  "get_skill",
  {
    title: "Read one file of the Arc Pro skill",
    description:
      "The bundled skill: SKILL.md (entry point), components.md (whole catalogue by group), design, copy, " +
      "motion, accessibility, responsive, composition, checklist and three worked examples.",
    inputSchema: {
      file: z
        .string()
        .default("SKILL.md")
        .describe("File name, e.g. \"SKILL.md\", \"components.md\", \"motion.md\""),
    },
  },
  async ({ file }) => {
    const names = (await readdir(SKILL)).filter((n) => n.endsWith(".md")).sort();
    const groups = (await readdir(join(SKILL, "catalog"))).filter((n) => n.endsWith(".md")).sort();
    const wanted = file.endsWith(".md") ? file : `${file}.md`;
    const nested = wanted.startsWith("catalog/") ? wanted.slice("catalog/".length) : null;
    if (nested ? !groups.includes(nested) : !names.includes(wanted)) {
      return {
        content: [
          {
            type: "text",
            text: `No skill file "${file}". Files: ${names.join(", ")}. Group files: ${groups.map((g) => `catalog/${g}`).join(", ")}`,
          },
        ],
        isError: true,
      };
    }
    const path = nested ? join(SKILL, "catalog", nested) : join(SKILL, wanted);
    return { content: [{ type: "text", text: await readFile(path, "utf8") }] };
  },
);

await server.connect(new StdioServerTransport());
