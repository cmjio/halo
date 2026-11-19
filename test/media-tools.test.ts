/** Phase A of the file work: tools that send a file's bytes (JSON inline, multipart), and agents naming files. */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { parse } from "../src/parser/index";
import { HaloRuntime, useTool, type MockRequest } from "../src/runtime/runtime";
import { filesFromLabels, mediaLabel, MemoryBlobStore, mint } from "../src/runtime/media";

const PNG = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64"));
const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n%%EOF\n");
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");
const quiet = { log() {}, warn() {} };

// An upload endpoint that keeps what it was sent.
let got: Array<{ type: string; json?: any; form?: any; text?: string }> = [];
let server: ReturnType<typeof Bun.serve>;
let host: string;
beforeAll(() => {
  server = Bun.serve({
    port: 0,
    async fetch(req) {
      const type = req.headers.get("content-type") ?? "";
      if (type.startsWith("multipart/form-data")) got.push({ type, form: await req.formData() });
      else if (type.startsWith("application/json")) got.push({ type, json: await req.json() });
      else got.push({ type, text: await req.text() });
      return Response.json({ ok: true });
    },
  });
  host = `http://localhost:${server.port}`;
});
afterAll(() => server.stop(true));

function runtime(src: string, mocks: Record<string, unknown> = {}) {
  got = [];
  return new HaloRuntime({ env: {}, logger: quiet }).load(parse(src)).mockAll(mocks);
}

describe("a POST tool sends a file", () => {
  test("in JSON, inline as a data: URI, or bare base64", async () => {
    const src = (extra: string) => `tool Api : POST("${host}/check"${extra})
pipeline P(photo: Image) -> Result:
  photo |> Api.post(image: photo, note: "front door")`;
    await runtime(src("")).run("P", { photo: PNG });
    expect(got[0]!.json).toEqual({ image: `data:image/png;base64,${b64(PNG)}`, note: "front door" });
    await runtime(src(`, files: "base64"`)).run("P", { photo: PNG });
    expect(got[0]!.json.image).toBe(b64(PNG));
  });

  test("as multipart: each file a file part with its type and name, the rest fields", async () => {
    const src = `tool Upload : POST("${host}/upload", body: "multipart")
pipeline P(photo: Image, doc: Document) -> Result:
  photo |> Upload.post(file: photo, pages: [doc, doc], model: "x", meta: context.input.meta)`;
    await runtime(src).run("P", { photo: PNG, doc: PDF, meta: { tag: "a" } });
    const form = got[0]!.form!;
    const file = form.get("file") as File;
    expect(file.type).toBe("image/png");
    expect(file.name).toMatch(/^image-[0-9a-f]{6}\.png$/);
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(PNG);
    expect((form.getAll("pages") as File[]).map((f) => f.type)).toEqual(["application/pdf", "application/pdf"]);
    expect(form.get("model")).toBe("x");
    expect(form.get("meta")).toBe('{"tag":"a"}');
  });

  test("a form body, a GET request, or a file the run doesn't hold is refused", async () => {
    await expect(runtime(`tool F : POST("${host}/f", body: "form")\npipeline P(photo: Image) -> Result:\n  photo |> F.post(image: photo)`).run("P", { photo: PNG })).rejects.toThrow(/a form body can't carry a file; declare the tool with body: "multipart"/);
    await expect(runtime(`tool G : GET("${host}/g")\npipeline P(photo: Image) -> Result:\n  photo |> G.get(image: photo)`).run("P", { photo: PNG })).rejects.toThrow(/a GET request can't carry a file/);
    const forged = { $media: "image", sha256: "d".repeat(64), type: "image/png", size: 1 };
    await expect(runtime(`tool Api : POST("${host}/check")\npipeline P(q: String) -> Result:\n  q |> Api.post(image: context.input.ref)`).run("P", { q: "x", ref: forged })).rejects.toThrow(/is not a file this run was given or made/);
    expect(got).toHaveLength(0);
  });

  test("a form body without files still works", async () => {
    await runtime(`tool F : POST("${host}/f", body: "form")\npipeline P(q: String) -> Result:\n  q |> F.post(To: "+15550100", Body: q)`).run("P", { q: "hi" });
    expect(got[0]!.type.toLowerCase()).toBe("application/x-www-form-urlencoded;charset=utf-8");
    expect(got[0]!.text).toBe("To=%2B15550100&Body=hi");
  });
});

describe("an agent sends a file it was shown", () => {
  test("by its label or its id: the tool gets the bytes", async () => {
    const src = `tool Upload : POST("${host}/upload", body: "multipart")
agent Clerk [anthropic/claude-haiku-4-5]
  equips Upload
pipeline P(photo: Image) -> Result:
  photo |> Clerk.file("Upload this photo.", tools: [Upload])`;
    for (const name of ["label", "id"]) {
      let step = 0;
      const clerk = (q: MockRequest) => {
        if (step++) return "uploaded";
        const label = /\[image: #[0-9a-f]{6}\]/.exec(q.prompt!)![0];
        return useTool("Upload.post", { file: name === "label" ? label : label.slice(8, 15) });
      };
      const r = await runtime(src, { Clerk: clerk }).run("P", { photo: PNG });
      expect(r.output).toBe("uploaded");
      const file = got[0]!.form!.get("file") as File;
      expect(new Uint8Array(await file.arrayBuffer())).toEqual(PNG);
    }
  });

  test("a label for a file the run doesn't hold stays text; an id two files share is refused", async () => {
    const store = new MemoryBlobStore();
    const a = await mint(store, PNG);
    expect(filesFromLabels({ x: "#ffffff", y: "[image: cat.png #ffffff]" }, [a])).toEqual({ x: "#ffffff", y: "[image: cat.png #ffffff]" });
    expect(filesFromLabels({ x: mediaLabel(a), y: ["#" + a.sha256.slice(0, 6)] }, [a])).toEqual({ x: a, y: [a] });
    const twin = { ...a, sha256: a.sha256.slice(0, 6) + "0".repeat(58) };
    expect(() => filesFromLabels("#" + a.sha256.slice(0, 6), [a, twin])).toThrow(/give the whole label/);
  });
});

describe("a tool package sends a file", () => {
  test("body: multipart sends file parts; json inlines; form refuses", async () => {
    const { httpProvider } = await import("../src/registry/providers");
    const spec = (body: "json" | "form" | "multipart") => ({
      kind: "http" as const,
      description: "Scans",
      baseUrl: host,
      auth: { type: "none" as const },
      body,
      methods: [{ name: "scan", description: "Scan a file", effect: "read" as const, http: { method: "POST" as const, path: "/scan" } }],
    });
    const src = `tool S : Scanner()
pipeline P(photo: Image) -> Result:
  photo |> S.scan(file: photo)`;
    const run = (body: "json" | "form" | "multipart") => {
      const built = httpProvider("Scanner", spec(body));
      return runtime(src).registerToolProvider("Scanner", built.provider, built.info).run("P", { photo: PNG });
    };
    await run("multipart");
    expect(((got[0]!.form!.get("file")) as File).type).toBe("image/png");
    await run("json");
    expect(got[0]!.json.file).toBe(`data:image/png;base64,${b64(PNG)}`);
    await expect(run("form")).rejects.toThrow(/takes a form body, which can't carry a file/);
  });
});
