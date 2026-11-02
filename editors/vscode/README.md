# Halo for VS Code

Language support for Halo (`.halo` files).

## Features

- Syntax highlighting
- A language server: syntax errors and the validator's errors and warnings as you type (undefined agents, tools and policies, unequipped tools, unknown `System` methods, unread `context.data` keys, unenforced policy rules), hover for declarations and operators, and completion for keywords, declared names, `System.` methods, directives, tool providers, and policy categories

## Build

From the repository root: `bun run build:vsx` (bundles the server to `server.js` and compiles the extension), then `bun run package:vsx` for a `.vsix`.
