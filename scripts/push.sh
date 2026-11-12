#!/usr/bin/env bash
# Push with the personal SSH key over port 443.
#
# Why this exists: outbound port 22 to github.com is blocked on this network, and
# DNS for github.com resolves to a proxy fake-ip (198.18.0.x) that closes the
# connection. Port 443 on a real GitHub IP does accept SSH, so resolve the real
# address over DoH and push through it.
#
#   scripts/push.sh            # push the current branch to origin's path
#   scripts/push.sh main       # explicit branch
set -euo pipefail

BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"
KEY="${GITHUB_KEY:-$HOME/.ssh/ed25519_personal}"

# owner/repo from the configured remote (works for git@ and https:// forms)
REMOTE_URL="$(git remote get-url origin)"
SLUG="$(printf '%s' "$REMOTE_URL" | sed -E 's#^(git@[^:]+:|https://[^/]+/)##; s#\.git$##')"

resolve() {
  curl -fsS --max-time 10 "https://dns.google/resolve?name=$1&type=A" |
    grep -o '"data":"[0-9.]*"' | sed -E 's/.*:"([0-9.]+)"/\1/' | head -3
}

IPS="$( { resolve github.com; resolve ssh.github.com; } | sort -u )"
[ -n "$IPS" ] || { echo "could not resolve github.com over DoH" >&2; exit 1; }

for ip in $IPS; do
  # capture first: pipefail + `grep -q` would SIGPIPE ssh and read as failure
  out="$(ssh -p 443 -i "$KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new \
       -o ConnectTimeout=12 -o BatchMode=yes -T "git@$ip" 2>&1 || true)"
  if printf '%s' "$out" | grep -q "successfully authenticated"; then
    echo "pushing via $ip:443"
    exec git -c core.sshCommand="ssh -i $KEY -o IdentitiesOnly=yes -p 443 -o StrictHostKeyChecking=accept-new" \
      push "ssh://git@$ip:443/$SLUG.git" "$BRANCH"
  fi
done

echo "no reachable GitHub SSH endpoint; port 22 is blocked and 443 refused on: $IPS" >&2
exit 1
