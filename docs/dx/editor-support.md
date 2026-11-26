# Editor Support

Halo has a language server, `halo lsp`, and editor packages in `editors/`.

## Language server

`halo lsp` speaks the Language Server Protocol over stdio, so any editor with an LSP client can use it. It provides:

- **Errors as you type**: syntax errors at the offending token, plus every `halo validate` error and warning under the name it's about. Files are checked with everything they `use`, including unsaved changes in other open files.
- **Completion**: keywords, the names declared or imported in the file, and templates for whole `agent`, `pipeline`, `tool`, `policy`, `schema` and `use` declarations at the start of a line. It also offers `context.` fields, `.prompt` after an agent's name, `System` methods after `System.`, directives after `@`, providers after `tool X :`, rule names on `policy` lines, types in schemas and signatures, files and installed packages inside `use "..."`, and categories inside `Block(` / `Redact(`.
- **Tool and agent calls**: after `Code.`, the methods of Code's provider, each with its arguments (`?` marks an optional one), its effect (read, writes, sends) and its description, read methods first; picking one inserts its required arguments as tab stops. Inside the parentheses, completion offers the arguments not given yet and a signature shows the one being typed. A writing method on a `Workspace` declared without `write: true` is marked "needs write: true". This covers every built-in provider and installed packages' providers; an `MCP` or `Skills` tool's methods are only known when a run starts. After an agent's name, `prompt` and the method names already used on it.
- - **Hover**: details for declarations (model, system prompt, provider, policy rules), for a tool's methods (on the tool's name, and on `Code.edit` itself), for imported names (from the file or package they come from), for keywords, operators and built-in types.
- **Tool call errors**: a method the provider doesn't have (with the closest one, "did you mean search?"), and a writing call on a read-only `Workspace`.
- **Go to definition**, in the file, in a file it `use`s, or in an installed package.
- **Find references** and **rename**: across the project, following `use` lines (an `as` alias keeps its own name).
- **Highlighting** of every use of the name under the cursor, and the **outline** (agents, pipelines, tools, stores, policies and schemas with their fields).

It has no debugger. For step-by-step output, use `halo debug`.

## VS Code

`editors/vscode` contains a syntax grammar and the language-server client. It isn't on the Marketplace. Build and install it from the repository:

```bash
bun run package:vsx                                 # bundles the server and builds a .vsix
code --install-extension editors/vscode/halo-dsl-0.1.0.vsix
```

## Zed

`editors/zed` is a Zed extension: a tree-sitter grammar for highlighting, brackets and indentation, and the language server, which it starts as `halo lsp` from the `halo` on your PATH (install Halo first). See `editors/zed/README.md` to install it as a dev extension.

## Other editors

Point the editor's LSP client at `halo lsp --stdio` for `.halo` files. In Neovim:

```lua
vim.filetype.add({ extension = { halo = "halo" } })
vim.lsp.config("halo", { cmd = { "halo", "lsp", "--stdio" }, filetypes = { "halo" } })
vim.lsp.enable("halo")
```

## Sublime Text

`editors/sublime/Halo.sublime-syntax` provides syntax highlighting. Copy it into your Sublime `Packages/User` directory.

## Docs

This site highlights ```` ```halo ```` blocks with the VS Code TextMate grammar.
