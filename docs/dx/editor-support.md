# Editor Support

Halo has a small language server (`src/lsp/`) and editor packages in `editors/`.

## Language server

The server provides:

- **Diagnostics**: syntax errors at the offending token, plus every `halo validate` error and warning at its line.
- **Hover**: details for declarations (model, system prompt, provider, policy rules) and for operators.
- **Completion**: keywords and the names declared in the file. It also offers `System` methods after `System.`, directives after `@`, providers after `tool X :`, rule names on `policy` lines, and categories inside `Block(` / `Redact(`.

It does not provide go-to-definition, rename, completion of `context.data` fields, or a debugger. For step-by-step output, use `halo debug`.

## VS Code

`editors/vscode` contains a syntax grammar and the language-server client. It isn't on the Marketplace. Build and install it from the repository:

```bash
bun run package:vsx                                 # bundles the server and builds a .vsix
code --install-extension editors/vscode/halo-dsl-0.1.0.vsix
```

## Zed

`editors/zed` is a Zed extension with a tree-sitter grammar for highlighting, brackets, and indentation. It has no language server. See `editors/zed/README.md` to install it as a dev extension.

## Sublime Text

`editors/sublime/Halo.sublime-syntax` provides syntax highlighting. Copy it into your Sublime `Packages/User` directory.

## Docs

This site highlights ```` ```halo ```` blocks with the VS Code TextMate grammar.
