# Editor Support & LSP

Halo provides a first-class Language Server Protocol (LSP) implementation to give you IDE-level support for agentic workflows.

## VS Code Extension

The official Halo VS Code extension provides:
- Syntax highlighting for `.halo` files.
- Autocomplete for Tools, Policies, and Stores.
- Real-time syntax validation based on the ANTLR grammar.
- Inline hover documentation for built-in Standard Library functions.

### Installation

Search for **"Halo Language"** in the VS Code Extensions marketplace, or install it via the CLI:

```bash
code --install-extension halo-lang.halo-vscode
```

## Schema Autocomplete

Because Halo parses your `.halo` files alongside your custom `schema` definitions, the LSP understands the exact shape of your `context` object. 

If you type `context.data.` in your editor, the LSP will suggest the properties of the schema you defined, preventing typos before you ever execute the code.

## Debugging

The VS Code extension includes a native debugger. You can place breakpoints on the `|>` pipe operators to pause the AST execution and inspect the exact state of the `context` object at that moment in time!
