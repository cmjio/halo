import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync, deflateSync } from "node:zlib";
import { LOCAL_PROVIDERS, LOCAL_PROVIDER_INFO, closeKvDatabases } from "../src/runtime/providers/index";
import { pdfText, parseDelimited, rowsToRecords } from "../src/runtime/providers/documents";
import type { ToolCall, ToolServices } from "../src/runtime/tools";

interface CallOptions {
  /** The declaration's args: `Workspace(dir, write: true)` → decl: [dir, { write: true }]. */
  decl?: [unknown?, Record<string, unknown>?];
  named?: Record<string, unknown>;
  positional?: unknown[];
  implicitInput?: boolean;
}

function makeCall(provider: string, method: string, opts: CallOptions = {}): ToolCall {
  const [first, declNamed = {}] = opts.decl ?? [];
  return {
    tool: { name: "T", provider, args: [], namedArgs: {}, argList: [] },
    method,
    positional: opts.positional ?? [],
    implicitInput: opts.implicitInput,
    named: opts.named ?? {},
    config: (n) => (typeof n === "number" ? (n === 0 ? first : undefined) : declNamed[n]),
    viaAgent: false,
    signal: new AbortController().signal,
  };
}

const services = (fetchImpl?: typeof fetch): ToolServices =>
  ({
    fetch: fetchImpl ?? (() => Promise.reject(new Error("no network in tests"))),
    vectors: () => {
      throw new Error("unused");
    },
    sql: () => {
      throw new Error("unused");
    },
  }) as unknown as ToolServices;

function call(provider: string, method: string, opts: CallOptions = {}, svc = services()) {
  return LOCAL_PROVIDERS[provider]!(makeCall(provider, method, opts), svc) as Promise<any>;
}

let tmp: string;
beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "halo-providers-test-"));
});
afterAll(() => {
  closeKvDatabases();
  rmSync(tmp, { recursive: true, force: true });
});

describe("Workspace", () => {
  let root: string;
  let outside: string;
  const ws = (method: string, named: Record<string, unknown>, write = false) => call("Workspace", method, { decl: [root, { write }], named });

  beforeAll(() => {
    root = join(tmp, "ws");
    outside = join(tmp, "outside");
    mkdirSync(join(root, "src", "deep"), { recursive: true });
    mkdirSync(join(root, "node_modules", "pkg"), { recursive: true });
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(root, "src", "a.ts"), "const a = 1;\nconst b = 2;\nconst a2 = 1;\n");
    writeFileSync(join(root, "src", "deep", "c.md"), "# Title\nneedle here\n");
    writeFileSync(join(root, "node_modules", "pkg", "index.js"), "needle in deps\n");
    writeFileSync(join(outside, "secret.txt"), "SECRET needle\n");
    symlinkSync(join(outside, "secret.txt"), join(root, "link.txt"));
    symlinkSync(outside, join(root, "linkdir"));
    symlinkSync(join(outside, "created.txt"), join(root, "dangling.txt"));
    symlinkSync(join(root, "src", "a.ts"), join(root, "inner-link.ts"));
  });

  test("reads, with offset and limit", async () => {
    const r = await ws("read", { path: "src/a.ts" });
    expect(r).toMatchObject({ path: "src/a.ts", content: "const a = 1;\nconst b = 2;\nconst a2 = 1;\n", lines: 4 });
    const part = await ws("read", { path: "src/a.ts", offset: 2, limit: 1 });
    expect(part.content).toBe("const b = 2;");
  });

  test("a symlink that stays inside the root works", async () => {
    expect((await ws("read", { path: "inner-link.ts" })).path).toBe("src/a.ts");
  });

  test("refuses .. escapes and absolute paths", async () => {
    await expect(ws("read", { path: "../outside/secret.txt" })).rejects.toThrow(/outside the workspace/);
    await expect(ws("read", { path: "src/../../outside/secret.txt" })).rejects.toThrow(/outside the workspace/);
    await expect(ws("read", { path: join(outside, "secret.txt") })).rejects.toThrow(/not absolute/);
    await expect(ws("read", { path: "/etc/passwd" })).rejects.toThrow(/not absolute/);
    await expect(ws("write", { path: "../escape.txt", content: "x" }, true)).rejects.toThrow(/outside the workspace/);
    expect(existsSync(join(tmp, "escape.txt"))).toBe(false);
  });

  test("refuses symlinks that point outside, for the file or a parent folder", async () => {
    await expect(ws("read", { path: "link.txt" })).rejects.toThrow(/through a symlink/);
    await expect(ws("read", { path: "linkdir/secret.txt" })).rejects.toThrow(/through a symlink/);
    await expect(ws("write", { path: "linkdir/new.txt", content: "x" }, true)).rejects.toThrow(/through a symlink/);
    await expect(ws("write", { path: "linkdir/sub/new.txt", content: "x" }, true)).rejects.toThrow(/through a symlink/);
    await expect(ws("write", { path: "link.txt", content: "overwritten" }, true)).rejects.toThrow(/through a symlink/);
    await expect(ws("edit", { path: "link.txt", old: "SECRET", new: "x" }, true)).rejects.toThrow(/through a symlink/);
    expect(existsSync(join(outside, "new.txt"))).toBe(false);
    expect(readFileSync(join(outside, "secret.txt"), "utf8")).toBe("SECRET needle\n");
  });

  test("refuses writing through a dangling symlink", async () => {
    await expect(ws("write", { path: "dangling.txt", content: "x" }, true)).rejects.toThrow(/points nowhere/);
    expect(existsSync(join(outside, "created.txt"))).toBe(false);
  });

  test("list, glob and search don't follow symlinks or enter node_modules", async () => {
    const list = await ws("list", { path: ".", depth: 3 });
    const paths = list.entries.map((e: { path: string }) => e.path);
    expect(paths).toContain("src/deep/c.md");
    expect(paths).toContain("linkdir");
    expect(paths.some((p: string) => p.startsWith("linkdir/") || p.startsWith("node_modules"))).toBe(false);

    const glob = await ws("glob", { pattern: "**/*" });
    expect(glob.matches).toContain("src/a.ts");
    expect(glob.matches.some((p: string) => p.includes("secret") || p.includes("node_modules"))).toBe(false);
    expect((await ws("glob", { pattern: "../outside/*" })).matches).toEqual([]);

    const search = await ws("search", { pattern: "needle" });
    expect(search.matches).toEqual([{ path: "src/deep/c.md", line: 2, text: "needle here" }]);
    await expect(ws("search", { pattern: "needle", path: "linkdir" })).rejects.toThrow(/through a symlink/);
    const re = await ws("search", { pattern: "const a\\d?", regex: true, path: "src" });
    expect(re.matches.map((m: { line: number }) => m.line)).toEqual([1, 3]);
  });

  test("writes are refused unless declared write: true", async () => {
    for (const [method, named] of [
      ["write", { path: "x.txt", content: "x" }],
      ["edit", { path: "src/a.ts", old: "b", new: "c" }],
      ["delete", { path: "src/a.ts" }],
      ["mkdir", { path: "newdir" }],
    ] as const) {
      await expect(ws(method, named)).rejects.toThrow(/read-only/);
    }
    expect(existsSync(join(root, "x.txt"))).toBe(false);
  });

  test("write, edit uniqueness, mkdir and delete", async () => {
    expect(await ws("write", { path: "out/new.txt", content: "hello hello" }, true)).toMatchObject({ path: "out/new.txt", created: true });
    await expect(ws("edit", { path: "out/new.txt", old: "hello", new: "bye" }, true)).rejects.toThrow(/appears 2 times/);
    await expect(ws("edit", { path: "out/new.txt", old: "missing", new: "x" }, true)).rejects.toThrow(/not found/);
    expect(await ws("edit", { path: "out/new.txt", old: "hello", new: "bye", all: true }, true)).toEqual({ path: "out/new.txt", replacements: 2 });
    expect(await ws("edit", { path: "out/new.txt", old: "bye bye", new: "$& done" }, true)).toEqual({ path: "out/new.txt", replacements: 1 });
    expect(readFileSync(join(root, "out/new.txt"), "utf8")).toBe("$& done");

    expect(await ws("mkdir", { path: "made/here" }, true)).toEqual({ path: "made/here", created: true });
    await expect(ws("delete", { path: "out" }, true)).rejects.toThrow(/recursive: true/);
    expect(await ws("delete", { path: "out", recursive: true }, true)).toEqual({ path: "out", deleted: true });
    await expect(ws("delete", { path: "." }, true)).rejects.toThrow(/root/);
  });

  test("deleting a symlink removes the link, not its target", async () => {
    symlinkSync(join(outside, "secret.txt"), join(root, "to-delete"));
    expect(await ws("delete", { path: "to-delete" }, true)).toEqual({ path: "to-delete", deleted: true });
    expect(existsSync(join(root, "to-delete"))).toBe(false);
    expect(existsSync(join(outside, "secret.txt"))).toBe(true);
  });
});

describe("KV", () => {
  const db = () => join(tmp, "kv", "kv.sqlite");
  const kv = (method: string, named: Record<string, unknown>, namespace?: string) => call("KV", method, { decl: [db(), namespace ? { namespace } : {}], named });

  test("set, get, list, delete, with JSON values", async () => {
    await kv("set", { key: "user:1", value: { name: "Ada", tags: ["a"] } });
    await kv("set", { key: "user:2", value: "Bob" });
    await kv("set", { key: "other", value: 3 });
    expect(await kv("get", { key: "user:1" })).toEqual({ name: "Ada", tags: ["a"] });
    expect(await kv("get", { key: "missing" })).toBeNull();
    expect(await kv("get", { key: "missing", default: 0 })).toBe(0);
    expect(await kv("list", { prefix: "user:" })).toEqual([
      { key: "user:1", value: { name: "Ada", tags: ["a"] } },
      { key: "user:2", value: "Bob" },
    ]);
    expect(await kv("list", { prefix: "user%" })).toEqual([]);
    expect(await kv("delete", { key: "user:2" })).toEqual({ key: "user:2", deleted: true });
    expect(await kv("get", { key: "user:2" })).toBeNull();
    // Namespaces are separate.
    expect(await kv("get", { key: "other" }, "elsewhere")).toBeNull();
  });

  test("a value can flow in, with the key named", async () => {
    await call("KV", "set", { decl: [db()], named: { key: "piped" }, positional: [[1, 2]], implicitInput: true });
    expect(await kv("get", { key: "piped" })).toEqual([1, 2]);
  });

  test("incr", async () => {
    expect(await kv("incr", { key: "n" })).toBe(1);
    expect(await kv("incr", { key: "n", by: 5 })).toBe(6);
    await kv("set", { key: "s", value: "x" });
    await expect(kv("incr", { key: "s" })).rejects.toThrow(/not a number/);
  });

  test("TTL: expired keys are invisible", async () => {
    const r = await kv("set", { key: "temp", value: 1, ttl: 0.05 });
    expect(r.expires_at).toBeDefined();
    await kv("set", { key: "longer", value: 2, ttl: "1h" });
    expect(await kv("get", { key: "temp" })).toBe(1);
    await Bun.sleep(80);
    expect(await kv("get", { key: "temp" })).toBeNull();
    expect((await kv("list", {})).map((e: { key: string }) => e.key)).not.toContain("temp");
    expect(await kv("get", { key: "longer" })).toBe(2);
    expect(await kv("incr", { key: "temp" })).toBe(1);
    await expect(kv("set", { key: "bad", value: 1, ttl: "soon" })).rejects.toThrow(/ttl must be/);
  });
});

describe("Code", () => {
  const run = (lang: string, named: Record<string, unknown>, timeout_ms?: number) => call("Code", "run", { decl: [lang, timeout_ms ? { timeout_ms } : {}], named });

  test("js: returns a result, keeps stdout", async () => {
    const r = await run("js", { code: 'console.log("hi"); return input.a + 1;', input: { a: 41 } });
    expect(r).toMatchObject({ stdout: "hi", exitCode: 0, result: 42, timedOut: false });
  });

  test("ts with await", async () => {
    const r = await run("ts", { code: "const n: number = await Promise.resolve(2); return n * input;", input: 21 });
    expect(r.result).toBe(42);
  });

  test("the flowing value is the input when code is named", async () => {
    const r = await call("Code", "run", { decl: ["js"], named: { code: "return input.length" }, positional: [[1, 2, 3]], implicitInput: true });
    expect(r.result).toBe(3);
  });

  test("python", async () => {
    const r = await run("python", { code: "import math\nprint('side')\nreturn {'sum': sum(input), 'pi': round(math.pi, 2)}", input: [1, 2, 3] });
    expect(r).toMatchObject({ stdout: "side", exitCode: 0, result: { sum: 6, pi: 3.14 } });
  });

  test("errors are reported, not thrown", async () => {
    const r = await run("js", { code: 'throw new Error("boom")' });
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr).toContain("boom");
    expect(r.result).toBeNull();
  });

  test("the environment is empty: no secrets", async () => {
    process.env.HALO_TEST_SECRET = "s3cret-value";
    try {
      const js = await run("js", { code: "return process.env" });
      expect(Object.keys(js.result)).not.toContain("HALO_TEST_SECRET");
      expect(JSON.stringify(js)).not.toContain("s3cret-value");
      const py = await run("python", { code: "import os\nreturn dict(os.environ)" });
      expect(Object.keys(py.result)).not.toContain("HALO_TEST_SECRET");
      expect(py.result.PATH).toBeDefined();
    } finally {
      delete process.env.HALO_TEST_SECRET;
    }
  });

  test("runs in a temporary folder that is removed afterwards", async () => {
    const r = await run("js", { code: "return process.cwd()" });
    expect(r.result).toContain("halo-code-");
    expect(existsSync(r.result)).toBe(false);
  });

  test("killed on timeout", async () => {
    const started = Date.now();
    const r = await run("js", { code: "while (true) {}" }, 500);
    expect(r.timedOut).toBe(true);
    expect(r.exitCode).toBeNull();
    expect(Date.now() - started).toBeLessThan(5000);
  });

  test("unknown language", async () => {
    await expect(run("ruby", { code: "1" })).rejects.toThrow(/unknown language/);
  });
});

// ── Documents fixtures ──

/** A minimal zip writer (local headers + central directory), for building a .docx. */
function zip(files: Array<{ name: string; data: Uint8Array; deflate?: boolean }>): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name);
    const body = f.deflate ? deflateRawSync(f.data) : Buffer.from(f.data);
    const crc = Bun.hash.crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(f.deflate ? 8 : 0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(f.deflate ? 8 : 0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(f.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, body);
    centrals.push(central, name);
    offset += local.length + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

/** A one-page PDF whose content stream shows `content`, optionally Flate-compressed. */
function pdf(content: string, compress: boolean): Uint8Array {
  const stream = compress ? deflateSync(Buffer.from(content, "latin1")) : Buffer.from(content, "latin1");
  return Buffer.concat([
    Buffer.from(
      "%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n" +
        "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n" +
        "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n" +
        `4 0 obj << /Length ${stream.length}${compress ? " /Filter /FlateDecode" : ""} >>\nstream\n`,
      "latin1",
    ),
    stream,
    Buffer.from("\nendstream\nendobj\n5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n", "latin1"),
  ]);
}

const PDF_CONTENT = "BT /F1 12 Tf 72 712 Td (Hello \\(PDF\\) world) Tj 0 -14 Td [(Second) -300 (line)] TJ T* <FEFF00480069> Tj ET";

describe("Documents", () => {
  let docs: string;
  const extract = (named: Record<string, unknown>, svc = services()) => call("Documents", "extract", { decl: [undefined, { root: docs }], named }, svc);

  beforeAll(() => {
    docs = join(tmp, "docs");
    mkdirSync(docs, { recursive: true });
    writeFileSync(join(docs, "people.csv"), 'name,quote,age\r\nAda,"Hello, ""world""",36\nBob,"multi\nline",\n');
    writeFileSync(join(docs, "t.tsv"), "a\tb\n1\t2\n");
    writeFileSync(join(docs, "page.html"), "<html><head><title>T &amp; C</title><script>evil()</script></head><body><h1>Head</h1><p>Para &lt;one&gt;</p><style>x{}</style></body></html>");
    writeFileSync(join(docs, "data.json"), '{"a": [1, 2]}');
    writeFileSync(join(docs, "notes.md"), "# Notes\n");
    const xml = '<?xml version="1.0"?><w:document xmlns:w="x"><w:body><w:p><w:r><w:t>First &amp; paragraph</w:t></w:r></w:p><w:p><w:r><w:t>Second</w:t><w:tab/><w:t>tabbed</w:t></w:r></w:p></w:body></w:document>';
    writeFileSync(
      join(docs, "letter.docx"),
      zip([
        { name: "[Content_Types].xml", data: Buffer.from("<Types/>") },
        { name: "word/document.xml", data: Buffer.from(xml), deflate: true },
      ]),
    );
    writeFileSync(join(docs, "plain.pdf"), pdf(PDF_CONTENT, false));
    writeFileSync(join(docs, "flate.pdf"), pdf(PDF_CONTENT, true));
  });

  test("csv: quoted fields, escaped quotes, newlines in quotes", async () => {
    const r = await extract({ path: "people.csv" });
    expect(r.type).toBe("csv");
    expect(r.rows).toEqual([
      { name: "Ada", quote: 'Hello, "world"', age: "36" },
      { name: "Bob", quote: "multi\nline", age: "" },
    ]);
    expect((await extract({ path: "t.tsv" })).rows).toEqual([{ a: "1", b: "2" }]);
    expect(rowsToRecords(parseDelimited("x,,x\n1,2,3", ","))).toEqual([{ x: "1", column_2: "2", x_3: "3" }]);
  });

  test("html, json, markdown", async () => {
    const html = await extract({ path: "page.html" });
    expect(html).toMatchObject({ type: "html", title: "T & C", text: "Head\nPara <one>" });
    expect((await extract({ path: "data.json" })).data).toEqual({ a: [1, 2] });
    expect(await extract({ path: "notes.md" })).toMatchObject({ type: "markdown", text: "# Notes\n" });
  });

  test("docx", async () => {
    const r = await extract({ path: "letter.docx" });
    expect(r).toMatchObject({ type: "docx", text: "First & paragraph\nSecond\ttabbed" });
  });

  test("pdf, uncompressed and Flate-compressed (built-in extractor)", () => {
    for (const name of ["plain.pdf", "flate.pdf"]) {
      const r = pdfText(readFileSync(join(docs, name)));
      expect(r.pages).toBe(1);
      expect(r.text).toBe("Hello (PDF) world\nSecond line\nHi");
    }
  });

  test("pdf through extract", async () => {
    const r = await extract({ path: "flate.pdf" });
    expect(r.type).toBe("pdf");
    expect(r.pages).toBe(1);
    expect(r.text).toContain("Hello (PDF) world");
  });

  test("paths stay inside the root", async () => {
    writeFileSync(join(tmp, "private.txt"), "private");
    await expect(extract({ path: "../private.txt" })).rejects.toThrow(/outside the workspace/);
    await expect(extract({ path: join(tmp, "private.txt") })).rejects.toThrow(/not absolute/);
    symlinkSync(join(tmp, "private.txt"), join(docs, "sneaky.txt"));
    await expect(extract({ path: "sneaky.txt" })).rejects.toThrow(/through a symlink/);
    await expect(extract({ path: "file:///etc/passwd" })).rejects.toThrow(/only http/);
  });

  test("urls are fetched with services.fetch", async () => {
    let asked = "";
    const fake = (async (url: URL) => {
      asked = String(url);
      return new Response("a,b\n1,2\n", { headers: { "content-type": "text/csv" } });
    }) as unknown as typeof fetch;
    const r = await extract({ url: "https://example.com/export" }, services(fake));
    expect(asked).toBe("https://example.com/export");
    expect(r).toMatchObject({ type: "csv", rows: [{ a: "1", b: "2" }] });
  });
});

test("every provider has info, with an effect for each method", () => {
  expect(Object.keys(LOCAL_PROVIDER_INFO).sort()).toEqual(Object.keys(LOCAL_PROVIDERS).sort());
  const effects = Object.fromEntries(
    // The newer providers (Clock, Calc, Data, Git, WebSearch, Skills) are covered in builtins-kit.test.ts.
    Object.entries(LOCAL_PROVIDER_INFO).filter(([p]) => ["Workspace", "KV", "Code", "Documents"].includes(p)).flatMap(([p, info]) => (info.methods as Array<{ name: string; effect: string }>).map((m) => [`${p}.${m.name}`, m.effect])),
  );
  expect(effects).toEqual({
    "Workspace.read": "read",
    "Workspace.write": "write",
    "Workspace.edit": "write",
    "Workspace.list": "read",
    "Workspace.glob": "read",
    "Workspace.search": "read",
    "Workspace.delete": "write",
    "Workspace.mkdir": "write",
    "KV.get": "read",
    "KV.set": "write",
    "KV.delete": "write",
    "KV.list": "read",
    "KV.incr": "write",
    "Code.run": "external",
    "Documents.extract": "read",
  });
});
