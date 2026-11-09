#!/bin/bash
# capture a slug list with limited concurrency: scripts/capture-parallel.sh 3 slug1 slug2 ...
cd "$(dirname "$0")/.." || exit 1
CONC=$1; shift
run_one() {
  local slug=$1
  [ -f "captures/$slug/chunk.js" ] && { echo "skip $slug"; return; }
  node scripts/capture.mjs "$slug" --kind=block >/dev/null 2>&1 && echo "ok $slug ($(wc -c < captures/$slug/chunk.js) js)" || echo "FAIL $slug"
}
export -f run_one
printf '%s\n' "$@" | xargs -P "$CONC" -I{} bash -c 'run_one "$@"' _ {}
