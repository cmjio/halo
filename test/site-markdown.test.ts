import { describe, expect, test } from "bun:test";
import worker, { markdownPath, wantsMarkdown, type Env } from "../site/worker";

describe("wantsMarkdown", () => {
  test("agents asking for Markdown get it", () => {
    expect(wantsMarkdown("text/markdown")).toBe(true);
    expect(wantsMarkdown("text/markdown, text/html;q=0.9")).toBe(true);
    expect(wantsMarkdown("text/html;q=0.5, text/markdown")).toBe(true);
  });
  test("browsers and everyone else get HTML", () => {
    expect(wantsMarkdown(null)).toBe(false);
    expect(wantsMarkdown("*/*")).toBe(false);
    expect(wantsMarkdown("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")).toBe(false);
    expect(wantsMarkdown("text/html, text/markdown;q=0.5")).toBe(false);
    expect(wantsMarkdown("text/markdown;q=0")).toBe(false);
  });
});

test("markdownPath maps a page URL to its .md", () => {
  expect(markdownPath("/")).toBe("/index.md");
  expect(markdownPath("/guide/quickstart")).toBe("/guide/quickstart.md");
  expect(markdownPath("/guide/quickstart.html")).toBe("/guide/quickstart.md");
  expect(markdownPath("/examples/")).toBe("/examples/index.md");
  expect(markdownPath("/guide/quickstart.md")).toBe("/guide/quickstart.md");
  expect(markdownPath("/robots.txt")).toBeUndefined();
});

describe("fetch", () => {
  const files: Record<string, [string, string]> = {
    "/guide/quickstart": ["<h1>Quickstart</h1>", "text/html; charset=utf-8"],
    "/guide/quickstart.md": ["# Quickstart\n", "text/markdown; charset=utf-8"],
    "/playground": ["<h1>Playground</h1>", "text/html; charset=utf-8"],
  };
  const env = {
    ASSETS: {
      fetch: async (req: Request) => {
        const f = files[new URL(req.url).pathname];
        return f ? new Response(f[0], { headers: { "content-type": f[1] } }) : new Response("nope", { status: 404 });
      },
    },
  } as unknown as Env;
  const get = (path: string, accept?: string) =>
    worker.fetch(new Request(`http://localhost${path}`, { headers: accept ? { accept } : {} }), env);

  test("Accept: text/markdown returns the page's Markdown", async () => {
    const res = await get("/guide/quickstart", "text/markdown");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("vary")).toBe("Accept");
    expect(Number(res.headers.get("x-markdown-tokens"))).toBeGreaterThan(0);
    expect(await res.text()).toBe("# Quickstart\n");
  });

  test("browsers get HTML, marked as varying by Accept", async () => {
    const res = await get("/guide/quickstart", "text/html,*/*;q=0.8");
    expect(res.headers.get("content-type")).toStartWith("text/html");
    expect(res.headers.get("vary")).toContain("Accept");
    expect(await res.text()).toBe("<h1>Quickstart</h1>");
  });

  test("a page with no Markdown falls back to HTML", async () => {
    const res = await get("/playground", "text/markdown");
    expect(res.headers.get("content-type")).toStartWith("text/html");
  });
});
