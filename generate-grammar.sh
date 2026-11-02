#!/bin/bash
# Regenerates the ANTLR parser from grammars/Halo.g4 (requires Java 11+).
set -euo pipefail
cd "$(dirname "$0")"
rm -rf src/parser/generated
bunx antlr4ng -Dlanguage=TypeScript -visitor -no-listener -Xexact-output-dir -o src/parser/generated grammars/Halo.g4
