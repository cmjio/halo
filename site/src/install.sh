#!/bin/sh
# Install Halo: a standalone `halo` binary (Bun is built in; nothing else needed).
#
#   curl -fsSL https://halolang.com/install.sh | sh
#
# Options, as environment variables:
#   HALO_VERSION=0.1.0       a version instead of the latest
#   HALO_INSTALL=~/.halo     where to install (the binary goes in $HALO_INSTALL/bin)
#   HALO_NO_MODIFY_PATH=1    don't add it to your shell's PATH
#
# It downloads the binary for this machine from halolang.com/dl, checks it against the
# release's SHA256SUMS, and puts it in ~/.halo/bin. To uninstall: rm -rf ~/.halo/bin
# (and the PATH line it added to your shell's rc file).

set -eu

BASE="${HALO_DOWNLOAD_BASE:-https://halolang.com/dl}"
INSTALL_DIR="${HALO_INSTALL:-$HOME/.halo}"
BIN_DIR="$INSTALL_DIR/bin"

if [ -t 1 ]; then
  bold=$(printf '\033[1m'); dim=$(printf '\033[2m'); red=$(printf '\033[31m'); green=$(printf '\033[32m'); reset=$(printf '\033[0m')
else
  bold=""; dim=""; red=""; green=""; reset=""
fi
say() { printf '%s\n' "$*"; }
fail() { printf '%serror%s: %s\n' "$red" "$reset" "$*" >&2; exit 1; }

# ── Download tool ──
if command -v curl >/dev/null 2>&1; then
  fetch() { curl -fsSL --retry 2 "$1" -o "$2"; }
  fetch_text() { curl -fsSL --retry 2 "$1"; }
elif command -v wget >/dev/null 2>&1; then
  fetch() { wget -q "$1" -O "$2"; }
  fetch_text() { wget -qO- "$1"; }
else
  fail "Halo's installer needs curl or wget."
fi

# ── Which binary ──
os=$(uname -s)
arch=$(uname -m)
case "$os" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  MINGW* | MSYS* | CYGWIN*) fail "On Windows, run this in PowerShell instead:  irm https://halolang.com/install.ps1 | iex" ;;
  *) fail "There's no Halo build for $os yet." ;;
esac
case "$arch" in
  x86_64 | amd64) arch=x64 ;;
  arm64 | aarch64) arch=arm64 ;;
  *) fail "There's no Halo build for $arch yet." ;;
esac

# An Intel shell on an Apple Silicon Mac (Rosetta) should still get the native build.
if [ "$os" = darwin ] && [ "$arch" = x64 ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" = 1 ]; then
  arch=arm64
fi

asset="halo-$os-$arch"
if [ "$os" = linux ]; then
  if [ -f /etc/alpine-release ] || (ldd --version 2>&1 | grep -qi musl); then
    asset="$asset-musl"
    # The musl build links the C++ runtime, which Alpine doesn't install by default.
    if ! ls /usr/lib/libstdc++.so.6 >/dev/null 2>&1 && ! ls /lib/libstdc++.so.6 >/dev/null 2>&1; then
      fail "Halo needs libstdc++ and libgcc on this system: apk add libstdc++ libgcc"
    fi
  elif [ "$arch" = x64 ] && [ -r /proc/cpuinfo ] && ! grep -q avx2 /proc/cpuinfo; then
    # The default x64 build needs AVX2; older CPUs get the baseline build.
    asset="$asset-baseline"
  fi
fi

# ── Which version ──
version="${HALO_VERSION:-}"
if [ -z "$version" ]; then
  version=$(fetch_text "$BASE/latest.json" | sed -n 's/.*"version" *: *"\([^"]*\)".*/\1/p')
  [ -n "$version" ] || fail "Couldn't read the latest version from $BASE/latest.json"
fi
version="${version#v}"

say "${bold}Installing halo $version${reset} ${dim}($asset)${reset}"

# ── Download and check ──
tmp=$(mktemp -d 2>/dev/null || mktemp -d -t halo)
trap 'rm -rf "$tmp"' EXIT INT TERM

fetch "$BASE/$version/SHA256SUMS" "$tmp/SHA256SUMS" || fail "Halo $version isn't published at $BASE ($BASE/$version/SHA256SUMS)"
expected=$(awk -v f="$asset" '$2 == f { print $1 }' "$tmp/SHA256SUMS")
[ -n "$expected" ] || fail "Halo $version has no $asset build."

fetch "$BASE/$version/$asset" "$tmp/halo" || fail "Couldn't download $BASE/$version/$asset"

if command -v sha256sum >/dev/null 2>&1; then
  actual=$(sha256sum "$tmp/halo" | awk '{ print $1 }')
elif command -v shasum >/dev/null 2>&1; then
  actual=$(shasum -a 256 "$tmp/halo" | awk '{ print $1 }')
else
  fail "Need sha256sum or shasum to check the download."
fi
[ "$actual" = "$expected" ] || fail "Checksum mismatch for $asset (expected $expected, got $actual). Not installing."

chmod 755 "$tmp/halo"
"$tmp/halo" --version >/dev/null 2>&1 || fail "The downloaded binary doesn't run on this machine ($asset)."

mkdir -p "$BIN_DIR"
mv -f "$tmp/halo" "$BIN_DIR/halo"
say "${green}✓${reset} halo $("$BIN_DIR/halo" --version) installed to ${bold}$BIN_DIR/halo${reset}"

# ── PATH ──
case ":$PATH:" in
  *":$BIN_DIR:"*) on_path=1 ;;
  *) on_path=0 ;;
esac

if [ "$on_path" = 0 ] && [ "${HALO_NO_MODIFY_PATH:-}" != 1 ]; then
  # Written as $HOME/... when it's under your home folder.
  case "$BIN_DIR" in
    "$HOME"/*) shown="\$HOME${BIN_DIR#"$HOME"}" ;;
    *) shown="$BIN_DIR" ;;
  esac
  line="export PATH=\"$shown:\$PATH\""
  case "$(basename "${SHELL:-sh}")" in
    zsh) rc="${ZDOTDIR:-$HOME}/.zshrc" ;;
    bash)
      if [ "$os" = darwin ]; then rc="$HOME/.bash_profile"; else rc="$HOME/.bashrc"; fi
      ;;
    fish)
      rc="$HOME/.config/fish/conf.d/halo.fish"
      line="fish_add_path \"$shown\""
      mkdir -p "$(dirname "$rc")"
      ;;
    *) rc="$HOME/.profile" ;;
  esac
  if ! grep -qs "$BIN_DIR" "$rc" && ! grep -qsF "$shown" "$rc"; then
    printf '\n# Halo\n%s\n' "$line" >>"$rc"
    say "${dim}Added $BIN_DIR to PATH in $rc${reset}"
  fi
  say ""
  say "To use halo in this shell now, run:"
  say "  ${bold}$line${reset}"
fi

say ""
say "Next:"
say "  halo init my-flow && cd my-flow"
say "  halo test main.halo --arg topic=tides    ${dim}# offline, everything mocked${reset}"
say "  ${dim}Docs: https://halolang.com/docs/guide/quickstart.html${reset}"
