import { expect, test, describe } from "bun:test";
import { getCompletions } from "../src/lsp/completions.js";

describe("Langly LSP Completions", () => {
  test("returns keywords", () => {
    const src = `
      s
    `;
    const completions = getCompletions(src, { line: 1, character: 7 });
    expect(completions.length).toBeGreaterThan(0);
    const streamCompletion = completions.find(c => c.label === "pipeline");
    expect(streamCompletion).toBeDefined();
    expect(streamCompletion?.kind).toBe(14); // CompletionItemKind.Keyword
  });
});
