import { CompletionItem, CompletionItemKind, Position } from "vscode-languageserver";

export function getCompletions(sourceText: string, position: Position): CompletionItem[] {
  // Simple keyword completions
  return [
    {
      label: "pipeline",
      kind: CompletionItemKind.Keyword,
      detail: "Define a new workflow pipeline"
    },
    {
      label: "agent",
      kind: CompletionItemKind.Keyword,
      detail: "Declare an LLM agent agent"
    },
    {
      label: "tool",
      kind: CompletionItemKind.Keyword,
      detail: "Declare a tool connector"
    },
    {
      label: "schema",
      kind: CompletionItemKind.Keyword,
      detail: "Define a data schema"
    },
    {
      label: "policy",
      kind: CompletionItemKind.Keyword,
      detail: "Define a safety rule"
    },
    {
      label: "store",
      kind: CompletionItemKind.Keyword,
      detail: "Declare persistent store"
    },
    {
      label: "yield",
      kind: CompletionItemKind.Keyword,
      detail: "Suspend execution"
    },
    {
      label: "listen",
      kind: CompletionItemKind.Keyword,
      detail: "Wait for external signal"
    },
    {
      label: "loop",
      kind: CompletionItemKind.Keyword,
      detail: "Cyclic control flow"
    }
  ];
}
