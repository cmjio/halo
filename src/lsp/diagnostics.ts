import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver";
import { parse } from "../parser/index.js";

export function getDiagnostics(sourceText: string): Diagnostic[] {
  const ast = parse(sourceText);
  const diagnostics: Diagnostic[] = [];

  for (const errStr of ast.errors) {
    // Expected format: [line:charPositionInLine] msg near "tokenText"
    const match = errStr.match(/^\[(\d+):(\d+)\] (.+) near "(.+)"$/);
    
    let range: Range;
    let message = errStr;

    if (match) {
      const line = parseInt(match[1] ?? "1", 10) - 1; // LSP lines are 0-indexed
      const charPos = parseInt(match[2] ?? "0", 10);
      const msg = match[3] ?? "Syntax Error";
      const token = match[4] ?? "";
      
      message = msg;
      range = {
        start: { line, character: charPos },
        end: { line, character: charPos + token.length }
      };
    } else {
      range = {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 }
      };
    }

    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range,
      message,
      source: "halo"
    });
  }

  return diagnostics;
}
