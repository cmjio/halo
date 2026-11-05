#!/usr/bin/env bash
# Check a built Halo image works the way the docs say to use it.
#
#   bash docker/smoke-test.sh <image> [expected version]
#
# Used by CI (any image built from this commit) and the release workflow (before pushing).
set -euo pipefail
image="$1"
want="${2:-}"
work="$(mktemp -d)"
chmod 777 "$work"
cleanup() {
  docker rm -f halo-smoke >/dev/null 2>&1 || true
  # The container wrote these as uid 1000, which may not be this user (CI runners are 1001).
  docker run --rm --user 0 --entrypoint rm -v "$work:/w" "$image" -rf /w/demo >/dev/null 2>&1 || true
  rm -rf "$work" || true
}
trap cleanup EXIT

echo "--- version"
got="$(docker run --rm "$image" --version)"
echo "$got"
if [ -n "$want" ] && [ "$got" != "$want" ]; then echo "expected $want" >&2; exit 1; fi

echo "--- halo init and halo test in a mounted folder"
docker run --rm -v "$work:/app" "$image" init demo
docker run --rm -v "$work/demo:/app" "$image" test main.halo --arg topic=tides

echo "--- halo serve refuses without a token"
if docker run --rm -v "$work/demo:/app" "$image" 2>"$work/err"; then echo "served without a token" >&2; exit 1; fi
grep -q "HALO_SERVE_TOKEN" "$work/err"

echo "--- halo serve with a token answers on the published port"
docker run -d --name halo-smoke -p 18080:8080 -e HALO_SERVE_TOKEN=smoke -v "$work/demo:/app" "$image" >/dev/null
for _ in $(seq 1 30); do
  if curl -fsS -H "Authorization: Bearer smoke" http://127.0.0.1:18080/api/pipelines >"$work/out" 2>/dev/null; then break; fi
  sleep 1
done
cat "$work/out"; echo
grep -q '"name"' "$work/out"
code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:18080/api/pipelines)"
[ "$code" = "401" ] || { echo "expected 401 without the token, got $code" >&2; exit 1; }

echo "--- halo upgrade points at the image instead of replacing the binary"
docker run --rm "$image" upgrade | grep -q "docker pull"

echo "ok"
