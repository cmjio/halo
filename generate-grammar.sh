#!/bin/bash
cd "$(dirname "$0")"
bunx antlr4ng -Dlanguage=TypeScript -o src/parser -listener -visitor grammars/Halo.g4
