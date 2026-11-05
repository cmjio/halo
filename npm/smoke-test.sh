#!/usr/bin/env bash
# Install the npm packages scripts/npm.ts built into a scratch Node project, from tarballs,
# and check `npx halo` works there with no Bun on PATH.
#
#   bash npm/smoke-test.sh dist/npm
set -euo pipefail
dist="$(cd "$1" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

tarballs=()
for dir in "$dist"/*/; do
  tarballs+=("$work/$(cd "$dir" && npm pack --silent --pack-destination "$work")")
done

# A PATH with node, npm and npx but nothing else from where they live (bun is often beside them).
tools="$work/tools"
mkdir "$tools"
for t in node npm npx; do ln -s "$(command -v "$t")" "$tools/$t"; done
clean_path="$tools:/usr/bin:/bin"

cd "$work"
mkdir app && cd app
env PATH="$clean_path" npm init -y >/dev/null
env PATH="$clean_path" npm install --no-audit --no-fund "${tarballs[@]}" >/dev/null

if env PATH="$clean_path" sh -c 'command -v bun' >/dev/null; then echo "bun is on PATH; the check would prove nothing" >&2; exit 1; fi

echo "--- npx halo --version"
want="$(node -p 'require("@halolang/halo/package.json").version')"
got="$(env PATH="$clean_path" npx --no-install halo --version)"
echo "$got"
[ "$got" = "$want" ] || { echo "expected $want" >&2; exit 1; }

echo "--- npx halo init, then halo test"
env PATH="$clean_path" npx --no-install halo init demo >/dev/null
(cd demo && env PATH="$clean_path:$work/app/node_modules/.bin" halo test main.halo --arg topic=tides)

echo "--- exit codes pass through"
set +e
env PATH="$clean_path" npx --no-install halo validate does-not-exist.halo >/dev/null 2>&1
code=$?
set -e
[ "$code" = "1" ] || { echo "expected exit code 1, got $code" >&2; exit 1; }

echo "--- halo upgrade defers to npm"
env PATH="$clean_path" npx --no-install halo upgrade | grep -q "installed with npm"

echo "ok"
