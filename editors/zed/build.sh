#!/usr/bin/env bash
# Rebuild the tree-sitter grammar from grammar.js
# Requires: tree-sitter CLI, zig
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GRAMMAR_DIR="$SCRIPT_DIR/grammars"
LANG_DIR="$GRAMMAR_DIR/halo"

echo "=== Building tree-sitter grammar for Halo ==="

# Generate parser from grammar.js
echo "Generating parser..."
(cd "$LANG_DIR" && tree-sitter generate --abi 14)

# Create a temporary build area
BUILD_DIR=$(mktemp -d)
trap 'rm -rf "$BUILD_DIR"' EXIT

# Copy grammar sources
cp "$LANG_DIR/grammar.js" "$BUILD_DIR/"

# Build stubs
cat > "$BUILD_DIR/stubs.c" << 'STUBS'
#define TS_HIDDEN
#include <string.h>
#include <stddef.h>

static char heap[1 << 20];
static size_t heap_pos = 0;

void *malloc(size_t size) {
    size_t aligned = (size + 7) & ~(size_t)7;
    if (heap_pos + aligned > sizeof(heap)) return 0;
    void *p = &heap[heap_pos];
    heap_pos += aligned;
    return p;
}

void *realloc(void *ptr, size_t size) { (void)ptr; (void)size; return 0; }
void free(void *p) { (void)p; }

int memcmp(const void *a, const void *b, size_t n) {
    const unsigned char *x = a, *y = b;
    for (size_t i = 0; i < n; i++) if (x[i] != y[i]) return x[i] - y[i];
    return 0;
}

void *memcpy(void *d, const void *s, size_t n) {
    char *dd = d; const char *ss = s;
    for (size_t i = 0; i < n; i++) dd[i] = ss[i];
    return d;
}

void *memmove(void *d, const void *s, size_t n) {
    unsigned char *dd = d; const unsigned char *ss = s;
    if (dd < ss) for (size_t i = 0; i < n; i++) dd[i] = ss[i];
    else for (size_t i = n; i > 0;) { --i; dd[i] = ss[i]; }
    return d;
}

void *memset(void *d, int c, size_t n) {
    char *dd = d;
    for (size_t i = 0; i < n; i++) dd[i] = (char)c;
    return d;
}
STUBS

# Create stub includes
mkdir -p "$BUILD_DIR/stub_includes"

cat > "$BUILD_DIR/stub_includes/stdlib.h" << 'EOF'
#pragma once
#include <stddef.h>
#define NULL ((void*)0)
typedef int (*qsort_cmp)(const void *, const void *);
void *malloc(size_t);
void *realloc(void *, size_t);
void free(void *);
int abs(int);
EOF

cat > "$BUILD_DIR/stub_includes/stddef.h" << 'EOF'
#pragma once
typedef __SIZE_TYPE__ size_t;
typedef __PTRDIFF_TYPE__ ptrdiff_t;
#define NULL ((void*)0)
#define offsetof(type, member) __builtin_offsetof(type, member)
EOF

cat > "$BUILD_DIR/stub_includes/stdint.h" << 'EOF'
#pragma once
typedef __INT8_TYPE__ int8_t;
typedef __INT16_TYPE__ int16_t;
typedef __INT32_TYPE__ int32_t;
typedef __INT64_TYPE__ int64_t;
typedef __UINT8_TYPE__ uint8_t;
typedef __UINT16_TYPE__ uint16_t;
typedef __UINT32_TYPE__ uint32_t;
typedef __UINT64_TYPE__ uint64_t;
typedef __INTPTR_TYPE__ intptr_t;
typedef __UINTPTR_TYPE__ uintptr_t;
#define INT32_MAX __INT32_MAX__
#define UINT32_MAX __UINT32_MAX__
EOF

cat > "$BUILD_DIR/stub_includes/string.h" << 'EOF'
#pragma once
#include <stddef.h>
void *memcpy(void *, const void *, size_t);
void *memmove(void *, const void *, size_t);
void *memset(void *, int, size_t);
int memcmp(const void *, const void *, size_t);
EOF

cat > "$BUILD_DIR/stub_includes/stdio.h" << 'EOF'
#pragma once
EOF

cat > "$BUILD_DIR/stub_includes/errno.h" << 'EOF'
#pragma once
#define EOVERFLOW 75
EOF

# Compile
echo "Compiling..."
zig cc -target wasm32-freestanding \
  -isystem "$BUILD_DIR/stub_includes" \
  -I "$LANG_DIR/src" \
  -fvisibility=hidden \
  -DTREE_SITTER_HIDE_SYMBOLS \
  -Os \
  -Wl,--export=tree_sitter_halo \
  -Wl,--no-entry \
  "$BUILD_DIR/stubs.c" "$LANG_DIR/src/parser.c" \
  -o "$LANG_DIR/halo.wasm"

echo "=== Built halo.wasm ($(stat -f%z "$LANG_DIR/halo.wasm" | numfmt --to=iec 2>/dev/null || stat -f%z "$LANG_DIR/halo.wasm" | awk '{printf "%.1fK", $1/1024}')) ==="
cp "$LANG_DIR/halo.wasm" "$GRAMMAR_DIR/halo.wasm"
echo "Copied to $GRAMMAR_DIR/halo.wasm"
