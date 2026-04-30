# Zed Extension: Langly DSL

Zed editor support for the **Langly DSL** (`.ly` files).

## Installation

### Option 1: Local Extension (Recommended for Development)

1. Open Zed
2. Go to `Zed → Settings` (or `cmd + ,`)
3. In the **User Settings** JSON, add a `languages` entry:

```json
{
  "languages": {
    "Langly": {
      "language_servers": []
    }
  }
}
```

4. In **Keybindings** or via the command palette, you can manually associate `.ly` files with Langly syntax.

### Option 2: Publish to Zed Extensions

To publish this extension to the Zed extension registry, push to the community extensions repo:

1. Fork [zed-industries/extensions](https://github.com/zed-industries/extensions)
2. Add this extension under `extensions/langly/`
3. Submit a PR

The extension structure:

```
editors/zed/
├── extension.toml             # Extension manifest
├── languages/
│   └── langly/
│       ├── config.toml        # Language configuration
│       ├── highlights.scm     # Tree-sitter highlight queries
│       ├── indents.scm        # Tree-sitter indentation rules
│       └── brackets.scm       # Tree-sitter bracket pairing
├── grammars/
│   └── langly/
│       ├── grammar.js         # Tree-sitter grammar source
│       ├── langly.wasm        # Pre-compiled tree-sitter parser
│       ├── tree-sitter.json   # Tree-sitter metadata
│       ├── stubs.c            # Minimal libc stubs for wasm build
│       └── src/               # Generated parser (from tree-sitter generate)
│           ├── parser.c
│           ├── node-types.json
│           ├── grammar.json
│           └── tree_sitter/
│               ├── parser.h
│               ├── alloc.h
│               └── array.h
└── queries/
    └── langly/
        └── highlights.scm     # Alternative query location
```

## Features

- **Syntax highlighting** for all Langly DSL constructs:
  - `mind` declarations with model references and configuration
  - `stream` declarations with typed signatures and pipelines
  - Pipe operators (`|>`)
  - Function calls with dot notation
  - Strings (single and double-quoted), numbers, booleans
  - Line comments (`// ...`)

## Rebuilding the WASM Parser

If you modify `grammar.js`, regenerate and rebuild:

```sh
# From the grammars/langly directory
tree-sitter generate
# Then rebuild with zig (requires zig installed):
zig cc -target wasm32-freestanding \
  -isystem stub_includes \
  -I src/ -Os \
  -Wl,--export=tree_sitter_langly -Wl,--no-entry \
  stubs.c src/parser.c -o langly.wasm
```

## Grammar

The tree-sitter grammar is ported from the ANTLR grammar at `grammars/Langly.g4`.
