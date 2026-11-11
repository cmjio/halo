// The code-block themes, built from palette.ts so every fenced block on the site uses Halo's colours.
// Scopes cover the Halo grammar (editors/vscode/syntaxes/halo.tmLanguage.json) and the other
// languages the docs use: bash, PowerShell, TypeScript, JSON, YAML.

import { dark, light, type Palette } from "./palette";

function theme(name: string, type: "dark" | "light", p: Palette) {
  return {
    name,
    type,
    colors: { "editor.background": p.code, "editor.foreground": p.text1 },
    tokenColors: [
      { settings: { foreground: p.text1 } },
      { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: p.comment, fontStyle: "italic" } },
      {
        scope: ["keyword", "storage.type", "storage.modifier", "keyword.operator.pipe", "keyword.operator.arrow", "keyword.control", "keyword.other"],
        settings: { foreground: p.keyword },
      },
      // Directives (@correct) and declared names: agents, pipelines, functions, JSON keys.
      {
        scope: [
          "storage.modifier.annotation",
          "punctuation.definition.annotation",
          "entity.name.type.agent",
          "entity.name.function",
          "support.function",
          "meta.function-call entity.name.function",
          "support.type.property-name",
          "entity.name.tag",
        ],
        settings: { foreground: p.name },
      },
      {
        scope: ["constant", "constant.numeric", "constant.language", "constant.character.escape", "entity.name.type", "support.type", "support.class", "entity.other.attribute-name"],
        settings: { foreground: p.constant },
      },
      { scope: ["string", "punctuation.definition.string", "string.unquoted"], settings: { foreground: p.string } },
      { scope: ["entity.name.model", "variable.other.interpolation", "string.interpolated", "variable.other.readwrite.shell", "variable.other.normal.shell", "punctuation.definition.variable"], settings: { foreground: p.model } },
      { scope: ["punctuation", "meta.brace", "keyword.operator.assignment", "keyword.operator.logical", "punctuation.separator"], settings: { foreground: p.punct } },
      { scope: ["variable", "variable.parameter", "variable.other.object", "variable.language"], settings: { foreground: p.text1 } },
      { scope: ["markup.deleted"], settings: { foreground: p.danger } },
      { scope: ["markup.inserted"], settings: { foreground: p.string } },
    ],
  };
}

export const haloDark = theme("halo-dark", "dark", dark);
export const haloLight = theme("halo-light", "light", light);
