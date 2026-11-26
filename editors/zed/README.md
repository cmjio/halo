# Zed extension: Halo

Halo in [Zed](https://zed.dev): syntax highlighting, bracket matching and indentation from a
tree-sitter grammar (`../tree-sitter-halo/grammar.js`, ported from `grammars/Halo.g4`), and
Halo's language server: errors as you type, completion (with templates for whole
declarations), hover, go to definition, find references, rename, and the outline.

The language server is `halo lsp`, from the `halo` on your PATH, so install Halo first
(`curl -fsSL https://halolang.com/install.sh | sh`, 1.7.1 or later). To use another one, such
as a checkout of this repository, set it in Zed's settings:

```json
"lsp": {
  "halo": {
    "binary": { "path": "/path/to/bun", "arguments": ["/path/to/halo/index.ts", "lsp", "--stdio"] }
  }
}
```

If nothing happens, run **zed: open log** and look for `halo`; **editor: restart language
server** restarts it after you install or upgrade Halo.

## Install as a dev extension

1. In Zed, open the command palette and run **zed: install dev extension**.
2. Pick this folder, `editors/zed` (the one with `extension.toml`). Picking the
   repository root fails with "No extension manifest found for extension halo".
3. Open any file under `examples/`; it should be highlighted as Halo.

Zed compiles the grammar and the extension (`src/halo.rs`, which starts the language server)
itself; it downloads a WASI SDK the first time. Dev extensions need Rust installed with rustup.
If installing fails, run **zed: open log** for the reason.

Zed clones the grammar's repository into `editors/zed/grammars/` (ignored by
git). That's why the grammar source lives outside this folder: a source folder
at `grammars/halo` would block the clone ("already exists, but is not a git
clone").

`extension.toml` builds the grammar from `https://github.com/cmjio/halo` at the commit in `rev`, so the grammar comes from GitHub even for a dev install. To try a grammar change before pushing, point `repository` at your checkout with a `file://` URL.

## Changing the grammar

```sh
editors/zed/build.sh           # tree-sitter generate (and a local halo.wasm)
cd editors/tree-sitter-halo
tree-sitter parse --quiet --stat ../../examples/*/*.halo   # every example should parse
```

Then commit and push (Zed builds the grammar from a commit on GitHub, including the generated
`editors/tree-sitter-halo/src/`), set `rev` in `extension.toml` to that commit, and run
**zed: rebuild dev extension** (or reinstall).

## Files

- `extension.toml`: the manifest
- `Cargo.toml`, `src/halo.rs`: the extension code that starts `halo lsp`
- `languages/halo/`: language config and the highlight, bracket, and indent queries
- `../tree-sitter-halo/`: the tree-sitter grammar and its generated parser (`src/`)
- `build.sh`: regenerates the parser
