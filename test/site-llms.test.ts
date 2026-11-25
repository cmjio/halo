import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildLlms, cleanPage, mdPath, summary } from "../site/llms";

function docs(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "halo-llms-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, "docs", path, ".."), { recursive: true });
    writeFileSync(join(root, "docs", path), text);
  }
  return root;
}

describe("cleanPage", () => {
  test("drops front matter, components and HTML, and inlines includes", () => {
    const root = docs({
      "guide/a.md": `---\ntitle: A\n---\n\n# Page A\n\n<span class="e read">read</span> changes nothing. See <a href="/guide/b">B</a>.\n\n<Table />\n\n<!--@include: ./part.md-->\n\n::: tip Careful\nText {{x}} &#123;&#123;y&#125;&#125;\n:::\n`,
      "guide/part.md": "Included text.\n",
    });
    const md = cleanPage(join(root, "docs/guide/a.md"), { Table: "| a | b |" });
    expect(md).not.toContain("---");
    expect(md).toContain("read changes nothing. See [B](https://halolang.com/guide/b).");
    expect(md).toContain("| a | b |");
    expect(md).toContain("Included text.");
    expect(md).toContain("**Careful**\nText {{x}} {{y}}");
    expect(md).not.toContain(":::");
  });

  test("leaves code alone and turns code-group labels into text", () => {
    const root = docs({ "x.md": "# X\n\n```bash [macOS · Linux]\necho <b>&amp;</b>\n```\n" });
    expect(cleanPage(join(root, "docs/x.md"))).toBe("# X\n\nmacOS · Linux:\n\n```bash\necho <b>&amp;</b>\n```\n");
  });

  test("makes relative links absolute", () => {
    const root = docs({ "guide/a.md": "# A\n\nSee [plan](./plan.md#history) and [types](../reference/types.md).\n" });
    expect(cleanPage(join(root, "docs/guide/a.md"))).toContain(
      "[plan](https://halolang.com/guide/plan#history) and [types](https://halolang.com/reference/types)",
    );
  });

  test("keeps a home page's hero, which is in its front matter", () => {
    const root = docs({ "index.md": '---\nlayout: home\ntitle: Halo\nhero:\n  name: "halo"\n  text: "A language"\n  tagline: "It does things."\n---\n\n## Install\n' });
    expect(cleanPage(join(root, "docs/index.md"))).toStartWith("# Halo\n\n**A language.** It does things.\n\n## Install");
  });

  test("reads a page written in HTML: headings, lists, terms, links and values", () => {
    const root = docs({
      "index.md": [
        "<script setup>\nimport data from './data.json'\n</script>",
        '<section class="hero">',
        '<h1 class="t"><svg viewBox="0 0 2 2"><circle r="1"/></svg>halo</h1>',
        "</section>",
        '<nav aria-label="On this page">',
        '  <a href="#plan">Static planning</a>',
        "</nav>",
        '<h2 class="h">Policies</h2>',
        "<ol>",
        "  <li><code>policy</code><span>A list of <b>rules</b>.</span></li>",
        "</ol>",
        "<dl>",
        '  <div><dt><span class="e">read</span></dt><dd>Changes nothing.</dd></div>',
        "</dl>",
        "<p>{{ data.counts.examples }} examples; strings use <code v-pre>{{name}}</code>.</p>",
      ].join("\n"),
    });
    expect(cleanPage(join(root, "docs/index.md"), {}, { "data.counts.examples": "70" })).toBe(
      "# halo\n\n- [Static planning](#plan)\n\n## Policies\n\n- `policy`: A list of **rules**.\n\n- read: Changes nothing.\n\n70 examples; strings use `{{name}}`.\n",
    );
  });
});

test("summary is the first paragraph of prose, without code or links", () => {
  expect(summary("# T\n\n```halo\ncode here\n```\n\nmacOS:\n\nThe [first](https://x) real paragraph.\n\nMore.")).toBe("The first real paragraph.");
  expect(summary(`# T\n\n${"Word ".repeat(30)}ends. ${"More ".repeat(40)}`)).toMatch(/ends\.$/);
});

test("mdPath puts a page's Markdown next to its HTML", () => {
  expect(mdPath("/guide/quickstart")).toBe("/guide/quickstart.md");
  expect(mdPath("/examples/")).toBe("/examples/index.md");
  expect(mdPath("/")).toBe("/index.md");
});

test("buildLlms writes llms.txt in the llmstxt.org shape, llms-full.txt and a .md per page", () => {
  const root = docs({
    "index.md": "# Home\n\nWelcome to Halo.\n",
    "guide/quickstart.md": "# Quickstart\n\nInstall halo.\n",
    "playground.md": "# Playground\n\nInteractive.\n",
    "examples/index.md": "# Examples\n\nMany examples.\n",
    "examples/hello.md": "# Hello\n\nSays hello.\n",
  });
  const files = buildLlms({
    root,
    version: "9.9.9",
    sidebar: [{ text: "Introduction", items: [{ text: "Quickstart", link: "/guide/quickstart" }, { text: "Playground", link: "/playground" }, { text: "Missing", link: "/nope" }] }],
    examples: [{ text: "Learn", items: [{ text: "Hello", link: "/examples/hello", about: "The first one." }] }],
  });
  const txt = files["/llms.txt"]!;
  expect(txt).toStartWith("# Halo\n\n> ");
  expect(txt).toContain("Current version: 9.9.9");
  expect(txt).toContain("## Introduction\n\n- [Quickstart](https://halolang.com/guide/quickstart.md): Install halo.\n");
  expect(txt).toContain("## Optional\n\n- [All examples](https://halolang.com/examples/index.md): Many examples.\n- [Learn: Hello](https://halolang.com/examples/hello.md): The first one.");
  expect(txt).not.toContain("Playground");
  expect(txt).not.toContain("Missing");
  expect(Object.keys(files).sort()).toEqual(["/examples/hello.md", "/examples/index.md", "/guide/quickstart.md", "/index.md", "/llms-full.txt", "/llms.txt"]);
  const full = files["/llms-full.txt"]!;
  expect(full.indexOf("# Home")).toBeLessThan(full.indexOf("# Quickstart"));
  expect(full).not.toContain("# Hello");
});
