# Zed extension: Halo

Syntax highlighting, bracket matching, and indentation for `.halo` files in
[Zed](https://zed.dev), from a tree-sitter grammar (`grammars/halo/grammar.js`,
ported from `grammars/Halo.g4`). It has no language server.

## Install as a dev extension

1. In Zed, open the command palette and run **zed: install dev extension**.
2. Pick this folder, `editors/zed` (the one with `extension.toml`). Picking the
   repository root fails with "No extension manifest found for extension halo".
3. Open any file in `examples/`; it should be highlighted as Halo.

Zed compiles the grammar itself (it downloads a WASI SDK the first time). If
installing fails, run **zed: open log** for the reason. Dev extensions also need
Rust installed with rustup.

`extension.toml` points `[grammars.halo]` at this checkout with an absolute
`file://` path. If the repository lives somewhere else on your machine, change
`repository` to match.

## Changing the grammar

```sh
cd editors/zed
./build.sh                     # tree-sitter generate (and a local halo.wasm)
tree-sitter parse --quiet --stat ../../examples/*.halo   # every example should parse
```

Then commit (Zed builds the grammar from a commit, including the generated
`grammars/halo/src/`), set `rev` in `extension.toml` to that commit, and run
**zed: rebuild dev extension** (or reinstall).

## Files

- `extension.toml`: the manifest
- `languages/halo/`: language config and the highlight, bracket, and indent queries
- `grammars/halo/`: the tree-sitter grammar and its generated parser (`src/`)
