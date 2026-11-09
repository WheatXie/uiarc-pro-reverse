#!/usr/bin/env bash
# Run the parity report over every ported item, sharded so several Chromium instances share the load,
# then merge the shard tables into REPORT.md. Usage: bash scripts/report-all.sh [shards] [parallel]
set -euo pipefail
cd "$(dirname "$0")/.."
SHARDS=${1:-6}
PAR=${2:-3}
export PYTHON=${PYTHON:-/Users/melonte/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3}
rm -rf captures/shards && mkdir -p captures/shards
node -e '
const fs = require("fs");
const c = require("./src/data/catalog.json");
const items = [...c.components, ...c.special, ...c.blocks].flatMap((g) => g.items).filter((i) => i.pro);
const ported = items.filter((i) => fs.existsSync(`src/components/arc/${i.slug}/demo.tsx`)).map((i) => i.slug);
const shards = Number(process.argv[1]);
const out = Array.from({ length: shards }, () => []);
// Round-robin keeps the heavy items spread out instead of clustered in one shard.
ported.forEach((slug, i) => out[i % shards].push(slug));
out.forEach((list, i) => fs.writeFileSync(`captures/shards/list${i}.txt`, list.join(",")));
console.log(`ported ${ported.length} items across ${shards} shards`);
' "$SHARDS"
ls captures/shards/list*.txt | xargs -P "$PAR" -I{} bash -c 'name=$(basename {} .txt); node scripts/report.mjs --only="$(cat {})" --out="captures/shards/$name.md"'
node scripts/report-merge.mjs
