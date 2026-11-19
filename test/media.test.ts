import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index";
import { validate } from "../src/parser/validate";
import { HaloRuntime, type MockRequest } from "../src/runtime/runtime";
import { AnthropicAdapter, GoogleAdapter, OllamaAdapter, OpenAIAdapter, ReplicateAdapter } from "../src/runtime/adapter";
import { collectMedia, fetchMedia, FileBlobStore, MediaBytes, mediaLabel, MemoryBlobStore, mint, sniff, type BlobStore, type MediaRef } from "../src/runtime/media";
import { startServer } from "../src/serve/server";
import { FolderStateStore, MirroredBlobStore, StateMirror } from "../src/serve/state-mirror";
import { existsSync, readdirSync } from "node:fs";
import { formatValue } from "../src/runtime/values";
import { main } from "../src/cli";

const tmp = mkdtempSync(join(tmpdir(), "halo-media-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

// ── Test files ──

const PNG_1x1 = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64"));
/** A PNG header claiming a size (the rest of the file doesn't matter to Halo). */
function png(width: number, height: number, salt = 0): Uint8Array {
  const b = new Uint8Array(64);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  b[40] = salt;
  return b;
}
function jpeg(width: number, height: number): Uint8Array {
  // SOI, an APP0 segment, then a baseline frame header carrying the size.
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
}
const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj << /Type /Pages /Count 2 >> endobj\n2 0 obj << /Type /Page >> endobj\n3 0 obj << /Type /Page >> endobj\n%%EOF\n");
const GIF = new Uint8Array([...new TextEncoder().encode("GIF89a"), 3, 0, 2, 0, 0, 0, 0]);
const WEBP = (() => {
  const b = new Uint8Array(32);
  b.set(new TextEncoder().encode("RIFF"), 0);
  b.set(new TextEncoder().encode("WEBPVP8X"), 8);
  b.set([99, 0, 0], 24); // width - 1
  b.set([49, 0, 0], 27); // height - 1
  return b;
})();
const dataUri = (bytes: Uint8Array, type = "image/png") => `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
const quiet = { log() {}, warn() {} };

// ── A provider server that keeps every request ──

let seen: Array<{ path: string; body: any }> = [];
let server: ReturnType<typeof Bun.serve>;
let base: string;
beforeAll(() => {
  server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      const body: any = await req.json();
      seen.push({ path: url.pathname, body });
      if (url.pathname === "/v1/chat/completions") return Response.json({ choices: [{ message: { content: "a cat" } }], usage: { prompt_tokens: 10, completion_tokens: 2 } });
      if (url.pathname === "/v1/messages") return Response.json({ content: [{ type: "text", text: "a cat" }], usage: { input_tokens: 10, output_tokens: 2 } });
      if (url.pathname.includes(":generateContent")) return Response.json({ candidates: [{ content: { parts: [{ text: "a cat" }] } }] });
      if (url.pathname === "/api/chat") return Response.json({ message: { content: "a cat" } });
      return new Response("unexpected", { status: 404 });
    },
  });
  base = `http://localhost:${server.port}`;
});
afterAll(() => server.stop(true));

function runtime(src: string, config: ConstructorParameters<typeof HaloRuntime>[0] = {}) {
  seen = [];
  return new HaloRuntime({ env: { ANTHROPIC_API_KEY: "k", OPENAI_API_KEY: "k", GEMINI_API_KEY: "k", REPLICATE_API_TOKEN: "k" }, logger: quiet, ...config })
    .registerAdapter(new OpenAIAdapter({ baseUrl: `${base}/v1` }))
    .registerAdapter(new AnthropicAdapter({ baseUrl: base }))
    .registerAdapter(new GoogleAdapter({ baseUrl: `${base}/v1beta` }))
    .registerAdapter(new OllamaAdapter({ baseUrl: base }))
    .load(parse(src));
}

const look = (model: string, extra = "") => `
${extra}
agent Eye [${model}]

pipeline Look(photo: Image) -> Result:
  photo |> Eye.look("What is in this picture?")
`;

describe("media values", () => {
  test("the type is read from the bytes, with the size", () => {
    expect(sniff(PNG_1x1)).toEqual({ kind: "image", type: "image/png", width: 1, height: 1 });
    expect(sniff(png(1200, 800))).toEqual({ kind: "image", type: "image/png", width: 1200, height: 800 });
    expect(sniff(jpeg(640, 480))).toEqual({ kind: "image", type: "image/jpeg", width: 640, height: 480 });
    expect(sniff(GIF)).toEqual({ kind: "image", type: "image/gif", width: 3, height: 2 });
    expect(sniff(WEBP)).toEqual({ kind: "image", type: "image/webp", width: 100, height: 50 });
    expect(sniff(PDF)).toEqual({ kind: "document", type: "application/pdf", format: "pdf", pages: 2 });
    // Binary that isn't one of the formats isn't read.
    expect(sniff(new Uint8Array([0, 1, 2, 3, 0xff, 0xfe]))).toBeUndefined();
  });

  test("minting stores the bytes once and refuses what isn't an image or a PDF", async () => {
    const store = new MemoryBlobStore();
    const ref = await mint(store, PNG_1x1, { name: "../../cat [1].png", want: "image" });
    expect(ref).toEqual({ $media: "image", sha256: expect.stringMatching(/^[0-9a-f]{64}$/), type: "image/png", width: 1, height: 1, size: PNG_1x1.length, name: "cat 1.png" });
    expect(await store.get(ref.sha256)).toEqual(PNG_1x1);
    await expect(mint(store, PDF, { want: "image" })).rejects.toThrow(/is a document \(application\/pdf\), where an image is expected/);
    await expect(mint(store, new Uint8Array([0, 1, 2, 0xff]), { name: "a.png" })).rejects.toThrow(/"a.png" is not a kind of file Halo reads/);
    const big = new Uint8Array(26 * 1024 * 1024);
    big.set(png(10, 10));
    await expect(mint(store, big)).rejects.toThrow(/is 26 MB; the most Halo takes for an image is 25 MB/);
  });

  test("a file blob store keeps each blob under its hash, written whole", async () => {
    const dir = join(tmp, "blobs");
    const store = new FileBlobStore(dir);
    const ref = await mint(store, PNG_1x1);
    expect(await new FileBlobStore(dir).get(ref.sha256)).toEqual(PNG_1x1);
    expect(await store.get("0".repeat(64))).toBeUndefined();
    await expect(store.get("../etc/passwd")).rejects.toThrow(/not a media hash/);
  });

  test("in text, a media value is its label, wherever it is", async () => {
    const ref = await mint(new MemoryBlobStore(), PNG_1x1, { name: "receipt.png" });
    const label = `[image: receipt.png #${ref.sha256.slice(0, 6)}]`;
    expect(mediaLabel(ref)).toBe(label);
    expect(formatValue(ref)).toBe(label);
    expect(formatValue({ claim: 7, photos: [ref] })).toBe(JSON.stringify({ claim: 7, photos: [label] }, null, 2));
    expect(collectMedia({ a: ref, b: [ref, { c: ref }] })).toEqual([ref]);
    expect(JSON.stringify(new MediaBytes(PNG_1x1, { name: "x.png" }))).toBe(`"[${PNG_1x1.length} bytes of x.png]"`);
  });
});

describe("a model is sent the image", () => {
  test("Anthropic: an image block after its label, before the text", async () => {
    const r = await runtime(look("anthropic/claude-haiku-4-5")).run("Look", { photo: PNG_1x1 });
    expect(r.status).toBe("completed");
    const content = seen[0]!.body.messages[0].content;
    expect(content).toEqual([
      { type: "text", text: expect.stringMatching(/^\[image: #[0-9a-f]{6}\]$/) },
      { type: "image", source: { type: "base64", media_type: "image/png", data: Buffer.from(PNG_1x1).toString("base64") } },
      { type: "text", text: expect.stringContaining("What is in this picture?") },
    ]);
    // The prompt names the image by its label, and never carries its bytes.
    expect(content[2].text).toContain(content[0].text);
    expect(content[2].text.length).toBeLessThan(200);
  });

  test("OpenAI: an image_url part with a data URI", async () => {
    await runtime(look("openai/gpt-4o-mini")).run("Look", { photo: dataUri(PNG_1x1) });
    const content = seen[0]!.body.messages[0].content;
    expect(content[0]).toEqual({ type: "text", text: expect.stringMatching(/^\[image: #/) });
    expect(content[1]).toEqual({ type: "image_url", image_url: { url: dataUri(PNG_1x1) } });
    expect(content[2].type).toBe("text");
  });

  test("Gemini: an inline data part", async () => {
    await runtime(look("gemini/gemini-2.5-flash")).run("Look", { photo: PNG_1x1 });
    const parts = seen[0]!.body.contents[0].parts;
    expect(parts[1]).toEqual({ inlineData: { mimeType: "image/png", data: Buffer.from(PNG_1x1).toString("base64") } });
    expect(parts[0].text).toMatch(/^\[image: #/);
  });

  test("Ollama: images beside the text, labels in it", async () => {
    await runtime(look("ollama/llava")).run("Look", { photo: PNG_1x1 });
    const m = seen[0]!.body.messages[0];
    expect(m.images).toEqual([Buffer.from(PNG_1x1).toString("base64")]);
    expect(m.content).toMatch(/^\[image: #[0-9a-f]{6}\]\n\n/);
  });

  test("two images placed in the text both go, in order, and each only once", async () => {
    const src = `agent Eye [anthropic/claude-haiku-4-5]
pipeline Compare(before: Image, after: Image) -> Result:
  "x" |> Eye.compare("What changed between {{before}} and {{after}}? And {{before}} again.")`;
    await runtime(src).run("Compare", { before: png(10, 10, 1), after: png(10, 10, 2) });
    const content = seen[0]!.body.messages[0].content as any[];
    expect(content.filter((c) => c.type === "image")).toHaveLength(2);
    const [first, second] = content.filter((c) => c.type === "text" && c.text.startsWith("[image")).map((c) => c.text);
    expect(content.at(-1).text).toBe(`Task: compare\n\nWhat changed between ${first} and ${second}? And ${first} again.`);
  });

  test("an image inside an object goes too, and the object shows its label", async () => {
    const src = `agent Eye [anthropic/claude-haiku-4-5]
pipeline Claim(photo: Image, amount: Number) -> Result:
  photo |> Eye.assess("Assess this claim.", claim: context.input)`;
    await runtime(src).run("Claim", { photo: PNG_1x1, amount: 40 });
    const content = seen[0]!.body.messages[0].content as any[];
    expect(content.filter((c) => c.type === "image")).toHaveLength(1);
    expect(content.at(-1).text).toContain(`"photo": "[image: #`);
  });

  test("a text-only call is sent exactly as before", async () => {
    const src = `agent Eye [anthropic/claude-haiku-4-5]
pipeline P(q: String) -> Result:
  q |> Eye.answer()`;
    await runtime(src).run("P", { q: "hello" });
    expect(seen[0]!.body.messages).toEqual([{ role: "user", content: "Task: answer\n\nInput:\nhello" }]);
  });

  test("a provider that can't read images is an error, never a silent drop", async () => {
    const rt = runtime(look("replicate/meta/llama")).registerAdapter(new ReplicateAdapter());
    await expect(rt.run("Look", { photo: PNG_1x1 })).rejects.toThrow(/replicate models can't be sent images/);
  });

  test("an image over the provider's limit is refused before it is sent", async () => {
    const big = new Uint8Array(8 * 1024 * 1024);
    big.set(png(4000, 3000));
    await expect(runtime(look("anthropic/claude-haiku-4-5")).run("Look", { photo: big })).rejects.toThrow(/8.0 MB; anthropic takes images up to 7.0 MB/);
    expect(seen).toHaveLength(0);
  });
});

describe("references can't be forged", () => {
  const forged = { $media: "image", sha256: "a".repeat(64), type: "image/png", size: 10 };

  test("an argument that is a reference, not a file, is refused", async () => {
    await expect(runtime(look("anthropic/claude-haiku-4-5")).run("Look", { photo: forged })).rejects.toThrow(/was given a reference to a file, not the file/);
    await expect(runtime(look("anthropic/claude-haiku-4-5")).run("Look", { photo: "/etc/passwd" })).rejects.toThrow(/takes an image: its bytes, or a data: URI$/);
  });

  test("a reference a model wrote reaches no other model", async () => {
    const src = `agent Writer [anthropic/claude-haiku-4-5]
agent Eye [anthropic/claude-haiku-4-5]
pipeline P(q: String) -> Result:
  q |> Writer.write() |> Eye.look()`;
    const rt = runtime(src).mockAll({ Writer: forged });
    await expect(rt.run("P", { q: "x" })).rejects.toThrow(/\[image: #aaaaaa\] is not a file this run was given or made/);
  });

  test("a replay trusts the references in its recorded arguments", async () => {
    const blobs = new MemoryBlobStore();
    const ref = await mint(blobs, PNG_1x1);
    const r = await runtime(look("anthropic/claude-haiku-4-5"), { blobs }).run("Look", { photo: ref }, { media: "trusted" });
    expect(r.status).toBe("completed");
    expect(seen[0]!.body.messages[0].content[1].type).toBe("image");
  });
});

describe("mocks, fingerprints and cost", () => {
  test("a mocked run never reads the bytes, and its mock sees the image", async () => {
    const reads: string[] = [];
    const blobs: BlobStore = { put: async () => {}, get: async (h) => void reads.push(h) as undefined };
    let req: MockRequest | undefined;
    const r = await runtime(look("anthropic/claude-haiku-4-5"), { blobs })
      .mockAll({ Eye: (q: MockRequest) => ((req = q), "a cat") })
      .run("Look", { photo: PNG_1x1 });
    expect(r.output).toBe("a cat");
    expect(reads).toEqual([]);
    expect(req!.media).toHaveLength(1);
    expect(req!.prompt).toMatch(/^Task: look\n\nWhat is in this picture\?\n\nInput:\n\[image: #/);
  });

  test("a text-only fingerprint is what it always was; an image changes it", async () => {
    const prints: string[] = [];
    const take = (q: MockRequest) => (prints.push(q.fingerprint!), "ok");
    const text = `agent Eye [anthropic/claude-haiku-4-5]
pipeline P(q: String) -> Result:
  q |> Eye.answer()`;
    await runtime(text).mockAll({ Eye: take }).run("P", { q: "hello" });
    const expected = new Bun.CryptoHasher("sha256").update(JSON.stringify({ model: "anthropic/claude-haiku-4-5", prompt: "Task: answer\n\nInput:\nhello" })).digest("hex");
    expect(prints[0]).toBe(expected);
    await runtime(look("anthropic/claude-haiku-4-5")).mockAll({ Eye: take }).run("Look", { photo: png(5, 5, 1) });
    await runtime(look("anthropic/claude-haiku-4-5")).mockAll({ Eye: take }).run("Look", { photo: png(5, 5, 2) });
    expect(new Set(prints).size).toBe(3);
  });

  test("an image counts toward MaxSpend before the call is sent", async () => {
    const src = (photo: boolean) => `policy Budget : MaxSpend(0.01)
agent Eye [anthropic/claude-sonnet-4-5]
  requires Budget
pipeline P(${photo ? "photo: Image" : "photo: String"}) -> Result:
  photo |> Eye.look()`;
    expect((await runtime(src(false)).run("P", { photo: "a description" })).status).toBe("completed");
    // 4000 x 3000 pixels is thousands of tokens: more than a cent before any reply.
    await expect(runtime(src(true)).run("P", { photo: png(4000, 3000) })).rejects.toThrow(/Budget/);
    expect(seen).toHaveLength(0);
  });
});

describe("policies and media", () => {
  const guarded = (rules: string) => `policy Safe : ${rules}
agent Eye [anthropic/claude-haiku-4-5]
  requires Safe
pipeline Look(photo: Image) -> Result:
  photo |> Eye.look()`;

  test("an agent with Redact or Block is sent no image unless its policy allows one", async () => {
    await expect(runtime(guarded("Redact(PII)")).run("Look", { photo: PNG_1x1 })).rejects.toThrow(/sent an image, which Redact can't read. Add AllowMedia\(image\)/);
    await expect(runtime(guarded("Block(PromptInjection)")).run("Look", { photo: PNG_1x1 })).rejects.toThrow(/which Block can't read/);
    expect(seen).toHaveLength(0);
    expect((await runtime(guarded("Redact(PII) & AllowMedia(image)")).run("Look", { photo: PNG_1x1 })).status).toBe("completed");
  });

  test("AllowMedia limits an agent to the kinds it names", async () => {
    await expect(runtime(guarded("AllowMedia(pdf)")).run("Look", { photo: PNG_1x1 })).rejects.toThrow(/allows only pdf/);
    expect((await runtime(guarded("AllowMedia(png)")).run("Look", { photo: PNG_1x1 })).status).toBe("completed");
  });

  test("an agent with no Block or Redact takes images", async () => {
    expect((await runtime(guarded("MaxWords(100)")).run("Look", { photo: PNG_1x1 })).status).toBe("completed");
  });

  test("the refusal is a recorded violation", async () => {
    const events: any[] = [];
    const rt = new HaloRuntime({ env: { ANTHROPIC_API_KEY: "k" }, logger: quiet, onEvent: (e) => events.push(e) }).registerAdapter(new AnthropicAdapter({ baseUrl: base })).load(parse(guarded("Redact(Email)")));
    await expect(rt.run("Look", { photo: PNG_1x1 })).rejects.toThrow();
    expect(events.find((e) => e.type === "violation")).toMatchObject({ policy: "Safe", rule: "AllowMedia", phase: "input" });
  });
});

describe("types", () => {
  const diags = (src: string) => validate(parse(src)).map((d) => `${d.severity}: ${d.message}`);

  test("Image and Document are types, with fields a gate can read", () => {
    expect(diags(`agent Eye [anthropic/claude-haiku-4-5]
pipeline P(photo: Image, doc: Document, more: Array<Image>) -> Image:
  photo |? (photo.size < 5000000 && photo.width > 10 && doc.pages <= 20) |> Eye.look()`)).toEqual([]);
    expect(diags(`agent Eye [anthropic/claude-haiku-4-5]
pipeline P(photo: Image) -> Result:
  photo |? (photo.colour == "red") |> Eye.look()`)).toEqual([expect.stringMatching(/error: .*photo.colour: "colour" is not something an Image has \(it has type, size, name/)]);
  });

  test("a program's own schema named Image replaces the built-in, with a warning", async () => {
    const src = `schema Image { url: String }
agent Eye [anthropic/claude-haiku-4-5]
pipeline P(photo: Image) -> Result:
  photo.url |> Eye.look()`;
    expect(diags(src)).toEqual([expect.stringMatching(/^warning: Schema "Image" replaces the built-in Image type/)]);
    // Its values are plain objects, never read as files.
    const r = await runtime(src).mockAll({ Eye: "ok" }).run("P", { photo: { url: "https://x" } });
    expect(r.status).toBe("completed");
  });

  test("AllowMedia names kinds", () => {
    expect(diags(`policy P : AllowMedia(image, pdf)`)).toEqual([]);
    expect(diags(`policy P : AllowMedia(hologram)`)).toEqual([expect.stringMatching(/error: Policy "P": AllowMedia\(hologram\) is not a kind of media/)]);
  });

  test("a pipeline's -> Image output is checked", async () => {
    const src = `agent Eye [anthropic/claude-haiku-4-5]
pipeline Same(photo: Image) -> Image:
  photo |> System.Print()
pipeline Not(q: String) -> Image:
  q |> Eye.look()`;
    const rt = runtime(src).mockAll({ Eye: "a cat" });
    expect(((await rt.run("Same", { photo: PNG_1x1 })).output as MediaRef).$media).toBe("image");
    await expect(rt.run("Not", { q: "x" })).rejects.toThrow(/output should be an Image/);
  });
});

describe("the CLI", () => {
  test("--arg photo=<path> sends the file; the run stores it under .halo/blobs", async () => {
    const dir = join(tmp, "cli");
    rmSync(dir, { recursive: true, force: true });
    await Bun.write(join(dir, "look.halo"), look("anthropic/claude-haiku-4-5"));
    writeFileSync(join(dir, "cat.png"), PNG_1x1);
    const cwd = process.cwd();
    const out: string[] = [];
    const log = console.log;
    console.log = (...a: unknown[]) => void out.push(a.join(" "));
    process.chdir(dir);
    try {
      expect(await main(["test", "look.halo", "--arg", "photo=cat.png", "--no-telemetry"])).toBe(0);
    } finally {
      process.chdir(cwd);
      console.log = log;
    }
    expect(out.join("\n")).toMatch(/\[mock Eye\.look\] Task: look What is in this picture\? Input: \[image: cat\.png #[0-9a-f]{6}\]/);
  });
});

// ── Tool results ──

describe("tool results", () => {
  const shot = async () => ({ image: new MediaBytes(PNG_1x1, { name: "screenshot.png" }), url: "https://example.com" });
  const info = { description: "A camera", methods: [{ name: "shot", description: "Take a picture", effect: "read" as const }] };

  test("bytes a tool returns become an image value, recorded as the reference", async () => {
    const recorded: unknown[] = [];
    const src = `tool Cam : Camera()
agent Eye [anthropic/claude-haiku-4-5]
pipeline P(q: String) -> Result:
  q |> Cam.shot() |> Eye.look("What is on the page?")`;
    const rt = runtime(src, { recorder: (e) => recorded.push(e) }).registerToolProvider("Camera", shot, info);
    expect((await rt.run("P", { q: "x" })).status).toBe("completed");
    const content = seen[0]!.body.messages[0].content as any[];
    expect(content[1]).toMatchObject({ type: "image", source: { media_type: "image/png" } });
    expect(content.at(-1).text).toContain('"image": "[image: screenshot.png #');
    const tool = recorded.find((e: any) => e.kind === "tool") as any;
    expect(tool.value.image).toMatchObject({ $media: "image", name: "screenshot.png" });
    expect(JSON.stringify(recorded)).not.toContain(Buffer.from(PNG_1x1).toString("base64"));
  });

  test("the shapes tools have returned images in are read too", async () => {
    const legacy = async () => ({ mimeType: "image/png", base64: Buffer.from(PNG_1x1).toString("base64") });
    const mcp = async () => [{ type: "image", mimeType: "image/png", data: Buffer.from(PNG_1x1).toString("base64") }, "caption"];
    const notImage = async () => ({ mimeType: "audio/wav", base64: Buffer.from("RIFF....WAVE").toString("base64") });
    const src = `tool A : Old()
tool B : Mcpish()
tool C : Sound()
pipeline P(q: String) -> Result:
  q |> A.get() as a |> B.get() as b |> C.get() as c`;
    const rt = runtime(src).registerToolProvider("Old", legacy, info).registerToolProvider("Mcpish", mcp, info).registerToolProvider("Sound", notImage, info);
    const r = await rt.run("P", { q: "x" });
    const data = r.context.data as any;
    expect(data.a).toMatchObject({ $media: "image", type: "image/png" });
    expect(data.b[0]).toMatchObject({ $media: "image" });
    expect(data.b[1]).toBe("caption");
    expect(data.c.mimeType).toBe("audio/wav");
  });

  // A model that calls every tool it is offered once, then answers.
  let agentSeen: any[] = [];
  let agentServer: ReturnType<typeof Bun.serve>;
  beforeAll(() => {
    agentServer = Bun.serve({
      port: 0,
      async fetch(req) {
        const body: any = await req.json();
        agentSeen.push(body);
        const answered = JSON.stringify(body.messages).includes("tool_result");
        const tools = (body.tools ?? []).map((t: any) => t.name);
        if (!answered) return Response.json({ content: tools.map((name: string, i: number) => ({ type: "tool_use", id: `t${i}`, name, input: {} })), stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } });
        return Response.json({ content: [{ type: "text", text: "a cat" }], usage: { input_tokens: 1, output_tokens: 1 } });
      },
    });
  });
  afterAll(() => agentServer.stop(true));
  const agentRuntime = (src: string) => {
    agentSeen = [];
    return new HaloRuntime({ env: { ANTHROPIC_API_KEY: "k" }, logger: quiet })
      .registerAdapter(new AnthropicAdapter({ baseUrl: `http://localhost:${agentServer.port}` }))
      .registerToolProvider("Camera", shot, info)
      .registerToolProvider("Stamp", async () => "stamped", { description: "Stamps", methods: [{ name: "stamp", description: "Stamp it", effect: "external" }] })
      .load(parse(src));
  };

  test("an agent that calls a tool is shown the image the tool returned", async () => {
    const src = `tool Cam : Camera()
agent Eye [anthropic/claude-haiku-4-5]
  equips Cam
pipeline P(q: String) -> Result:
  q |> Eye.look(tools: [Cam])`;
    const r = await agentRuntime(src).run("P", { q: "What is on the page?" });
    expect(r.output).toBe("a cat");
    const turn = agentSeen[1].messages.at(-1);
    expect(turn.role).toBe("user");
    expect(turn.content[0]).toMatchObject({ type: "tool_result", tool_use_id: "t0", content: expect.stringContaining('"image":"[image: screenshot.png #') });
    expect(turn.content[1]).toEqual({ type: "text", text: expect.stringMatching(/^\[image: screenshot\.png #/) });
    expect(turn.content[2]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/png" } });
    expect(turn.content[3]).toEqual({ type: "text", text: "The tool results above refer to this file." });
  });

  test("an agent whose policy can't read images is told, and isn't sent it", async () => {
    const src = `policy Safe : Redact(PII)
tool Cam : Camera()
agent Eye [anthropic/claude-haiku-4-5]
  equips Cam
  requires Safe
pipeline P(q: String) -> Result:
  q |> Eye.look(tools: [Cam])`;
    await agentRuntime(src).run("P", { q: "look" });
    const turn = agentSeen[1].messages.at(-1);
    expect(JSON.stringify(turn)).not.toContain('"type":"image"');
    expect(turn.content[0].content).toContain("[not shown: Agent \"Eye\" was sent an image, which Redact can't read");
  });

  test("a conversation paused for approval keeps the image it was given", async () => {
    const src = `policy G : ApproveTools("Stamper.stamp")
tool Cam : Camera()
tool Stamper : Stamp()
agent Eye [anthropic/claude-haiku-4-5]
  equips Cam, Stamper
  requires G
pipeline P(q: String) -> Result:
  q |> Eye.look(tools: [Cam, Stamper])`;
    const rt = agentRuntime(src);
    const paused = await rt.run("P", { q: "look, then stamp" });
    expect(paused.context.meta.paused).toMatchObject({ waitingFor: "approval" });
    const done = await rt.signal(paused.runId, "approval", "approve");
    expect(done.output).toBe("a cat");
    const turn = agentSeen.at(-1).messages.at(-1);
    expect(turn.content.filter((c: any) => c.type === "tool_result")).toHaveLength(2);
    expect(turn.content.filter((c: any) => c.type === "image")).toHaveLength(1);
  });
});

describe("email attachments", () => {
  const raw = [
    "From: Ana <ana@example.com>",
    "To: claims@example.com",
    "Subject: My claim",
    'Content-Type: multipart/mixed; boundary="b1"',
    "",
    "--b1",
    "Content-Type: text/plain",
    "",
    "Photo attached.",
    "--b1",
    'Content-Type: image/png; name="dent.png"',
    "Content-Transfer-Encoding: base64",
    'Content-Disposition: attachment; filename="dent.png"',
    "",
    Buffer.from(PNG_1x1).toString("base64"),
    "--b1",
    "Content-Type: application/zip",
    "Content-Transfer-Encoding: base64",
    'Content-Disposition: attachment; filename="logs.zip"',
    "",
    Buffer.from("PK\u0003\u0004").toString("base64"),
    "--b1--",
    "",
  ].join("\r\n");

  test("an image attachment reaches a model; other attachments are described", async () => {
    const { mailFromRaw } = await import("../src/runtime/mail/provider");
    const email = mailFromRaw(new TextEncoder().encode(raw)) as any;
    expect(email.attachments[0].file).toBeInstanceOf(MediaBytes);
    expect(email.attachments[1].file).toBeUndefined();
    const src = `agent Clerk [anthropic/claude-haiku-4-5]
pipeline Claim(email: Object) -> Result:
  email |> Clerk.assess("Assess this claim.")`;
    const r = await runtime(src).run("Claim", { email });
    expect(r.status).toBe("completed");
    const content = seen[0]!.body.messages[0].content as any[];
    expect(content.filter((c) => c.type === "image")).toHaveLength(1);
    expect(content.at(-1).text).toContain('"file": "[image: dent.png #');
    expect((r.context.data as any).email.attachments[1]).toEqual({ filename: "logs.zip", type: "application/zip", size: 4 });
  });
});

// ── Serving ──

describe("halo serve", () => {
  const SRC = `agent Eye [anthropic/claude-haiku-4-5]
pipeline Look(photo: Image) -> Result:
  photo |> Eye.look("What is in this picture?")
pipeline Keep(photo: Image) -> Image:
  photo |> System.Print()
pipeline Check(photo: Image) -> Result:
  photo |! yield("Is this dent real?") |> Eye.look()`;

  async function serve() {
    const dir = mkdtempSync(join(tmp, "serve-"));
    await Bun.write(join(dir, "look.halo"), SRC);
    const asked: MockRequest[] = [];
    const server = await startServer({
      files: [join(dir, "look.halo")],
      root: dir,
      port: 0,
      stateDir: join(dir, ".halo"),
      scheduler: false,
      studio: false,
      logger: { log() {}, warn() {}, error() {} },
      onRuntime: (rt) => rt.mockAll({ Eye: (q: MockRequest) => (asked.push(q), "a cat") }),
    });
    return Object.assign(server, { dir, asked });
  }
  const start = (url: string, name: string, args: unknown) =>
    fetch(`${url}/api/pipelines/${name}/runs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ args, wait: true }) }).then((r) => r.json() as Promise<any>);

  test("an image sent as a data: URI reaches the model, and comes back as a link", async () => {
    const s = await serve();
    try {
      const done = await start(s.url, "Look", { photo: dataUri(PNG_1x1) });
      expect(done.status).toBe("completed");
      expect(s.asked[0]!.media).toHaveLength(1);
      const kept = await start(s.url, "Keep", { photo: dataUri(PNG_1x1) });
      expect(kept.output).toMatchObject({ $media: "image", url: `/api/blobs/${kept.output.sha256}` });
      const file = await fetch(`${s.url}${kept.output.url}`);
      expect(file.headers.get("content-type")).toBe("image/png");
      expect(file.headers.get("x-content-type-options")).toBe("nosniff");
      expect(new Uint8Array(await file.arrayBuffer())).toEqual(PNG_1x1);
      expect(readdirSync(join(s.dir, ".halo", "blobs"))).toEqual([kept.output.sha256]);
      expect((await fetch(`${s.url}/api/blobs/${"0".repeat(64)}`)).status).toBe(404);
    } finally {
      await s.stop();
    }
  });

  test("files can be uploaded as multipart, from a client that says so", async () => {
    const s = await serve();
    try {
      const form = () => {
        const f = new FormData();
        f.set("photo", new Blob([PNG_1x1], { type: "image/png" }), "upload.png");
        f.set("wait", "true");
        return f;
      };
      const ok = await fetch(`${s.url}/api/pipelines/Keep/runs`, { method: "POST", headers: { "Halo-Client": "test" }, body: form() });
      const done = (await ok.json()) as any;
      expect(done.status).toBe("completed");
      expect(done.output).toMatchObject({ $media: "image", name: "upload.png" });
      // A page posting a form to this server can't add the header: refused.
      const plain = await fetch(`${s.url}/api/pipelines/Keep/runs`, { method: "POST", body: form() });
      expect(plain.status).toBe(403);
    } finally {
      await s.stop();
    }
  });

  test("an approval page shows the image being approved, only through its signed link", async () => {
    const s = await serve();
    try {
      const paused = await start(s.url, "Check", { photo: dataUri(PNG_1x1) });
      expect(paused.status).toBe("paused");
      const detail = (await (await fetch(`${s.url}/api/runs/${paused.runId}`)).json()) as any;
      const page = await (await fetch(detail.paused.approveUrl)).text();
      const src = page.match(/<img src="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
      expect(src).toMatch(new RegExp(`^/approve/${paused.runId}/file/[0-9a-f]{64}\\?sig=`));
      expect(page).toContain("[image: #");
      const file = await fetch(`${s.url}${src}`);
      expect(file.headers.get("content-type")).toBe("image/png");
      expect(new Uint8Array(await file.arrayBuffer())).toEqual(PNG_1x1);
      // Another file, a forged signature, or a pause that is over: no file.
      expect((await fetch(`${s.url}${src!.replace(/file\/[0-9a-f]{64}/, `file/${"c".repeat(64)}`)}`)).status).toBe(403);
      expect((await fetch(`${s.url}${src!.replace(/sig=.*/, "sig=forged")}`)).status).toBe(403);
      const form = new FormData();
      form.set("answer", "approve");
      await fetch(detail.paused.approveUrl, { method: "POST", body: form });
      expect((await fetch(`${s.url}${src}`)).status).toBe(403);
    } finally {
      await s.stop();
    }
  });

  test("a path on the server, a reference, or a private address is refused", async () => {
    const s = await serve();
    try {
      expect((await start(s.url, "Look", { photo: "/etc/passwd" })).error).toMatch(/takes an image: its bytes, or a data: URI, or an https URL$/);
      expect((await start(s.url, "Look", { photo: { $media: "image", sha256: "a".repeat(64), type: "image/png", size: 1 } })).error).toMatch(/a reference to a file, not the file/);
      expect((await start(s.url, "Look", { photo: "https://127.0.0.1/cat.png" })).error).toMatch(/127.0.0.1 is a private address/);
      expect((await start(s.url, "Look", { photo: "http://example.com/cat.png" })).error).toMatch(/Only https URLs/);
      expect(s.asked).toHaveLength(0);
    } finally {
      await s.stop();
    }
  });
});

describe("fetching an image from a URL", () => {
  const answer = (res: Response) => (async () => res) as unknown as typeof fetch;
  const publicHost = async () => ["93.184.215.14"];

  test("a public https address is fetched, its name kept", async () => {
    const got = await fetchMedia("https://cdn.example.com/a/cat%20photo.png", { fetch: answer(new Response(PNG_1x1)), lookup: publicHost });
    expect(got.bytes).toEqual(PNG_1x1);
    expect(got.name).toBe("cat photo.png");
  });

  test("a host that resolves anywhere private is refused, before any request", async () => {
    let asked = false;
    const spy = (async () => ((asked = true), new Response(PNG_1x1))) as unknown as typeof fetch;
    for (const ips of [["10.0.0.5"], ["93.184.215.14", "169.254.169.254"], ["::1"]]) {
      await expect(fetchMedia("https://sneaky.example.com/x.png", { fetch: spy, lookup: async () => ips })).rejects.toThrow(/private address/);
    }
    expect(asked).toBe(false);
  });

  test("redirects are not followed, and a body over the limit is cut off", async () => {
    await expect(fetchMedia("https://cdn.example.com/x.png", { fetch: answer(new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } })), lookup: publicHost })).rejects.toThrow(/redirects elsewhere/);
    const huge = new ReadableStream({ pull: (c) => c.enqueue(new Uint8Array(1024 * 1024)) });
    await expect(fetchMedia("https://cdn.example.com/x.png", { fetch: answer(new Response(huge)), lookup: publicHost })).rejects.toThrow(/over 500 MB/);
  });
});

describe("blobs with a state store", () => {
  test("each blob is copied up when made, and brought down only when needed", async () => {
    const store = new FolderStateStore(mkdtempSync(join(tmp, "store-")));
    const first = mkdtempSync(join(tmp, "host1-"));
    const ref = await mint(new MirroredBlobStore(first, store), PNG_1x1);
    expect(await store.get(`blobs/${ref.sha256}`)).toEqual(PNG_1x1);

    // A new host restores its state without the blobs, then fetches one when a run needs it.
    const second = mkdtempSync(join(tmp, "host2-"));
    await new StateMirror(second, store, { logger: quiet }).restore();
    expect(existsSync(join(second, "blobs"))).toBe(false);
    expect(await new MirroredBlobStore(second, store).get(ref.sha256)).toEqual(PNG_1x1);
    expect(existsSync(join(second, "blobs", ref.sha256))).toBe(true);
  });
});

// ── Documents ──

describe("PDF documents", () => {
  const read = (model: string) => `agent Reader [${model}]
pipeline Read(doc: Document) -> Result:
  doc |> Reader.summarise("Summarise this letter.")`;

  test("Anthropic: a document block", async () => {
    await runtime(read("anthropic/claude-haiku-4-5")).run("Read", { doc: PDF });
    const content = seen[0]!.body.messages[0].content as any[];
    expect(content[0].text).toMatch(/^\[document: #[0-9a-f]{6}\]$/);
    expect(content[1]).toEqual({ type: "document", source: { type: "base64", media_type: "application/pdf", data: Buffer.from(PDF).toString("base64") } });
  });

  test("OpenAI: a file part; Gemini: inline data", async () => {
    await runtime(read("openai/gpt-4o")).run("Read", { doc: dataUri(PDF, "application/pdf") });
    expect(seen[0]!.body.messages[0].content[1]).toEqual({ type: "file", file: { filename: "document.pdf", file_data: dataUri(PDF, "application/pdf") } });
    await runtime(read("gemini/gemini-2.5-flash")).run("Read", { doc: PDF });
    expect(seen[0]!.body.contents[0].parts[1]).toEqual({ inlineData: { mimeType: "application/pdf", data: Buffer.from(PDF).toString("base64") } });
  });

  test("Ollama takes images, not PDFs, and says so", async () => {
    await expect(runtime(read("ollama/llava")).run("Read", { doc: PDF })).rejects.toThrow(/ollama models can't be sent application\/pdf documents .*it takes image\/png/);
  });

  test("an image where a document is expected is refused", async () => {
    await expect(runtime(read("anthropic/claude-haiku-4-5")).run("Read", { doc: PNG_1x1 })).rejects.toThrow(/is an image \(image\/png\), where a document is expected/);
  });

  test("each page counts toward the estimate", async () => {
    const pages = (n: number) => new TextEncoder().encode(`%PDF-1.4\n${Array.from({ length: n }, (_, i) => `${i + 1} 0 obj << /Type /Page >> endobj`).join("\n")}\n%%EOF`);
    const src = `policy Budget : MaxSpend(0.02)
agent Reader [anthropic/claude-sonnet-4-5]
  requires Budget
pipeline Read(doc: Document) -> Result:
  doc |> Reader.summarise()`;
    expect((await runtime(src).run("Read", { doc: pages(1) })).status).toBe("completed");
    await expect(runtime(src).run("Read", { doc: pages(40) })).rejects.toThrow(/Budget/);
  });

  test("Documents.extract reads a Document the run holds", async () => {
    const src = `tool Docs : Documents()
pipeline Text(doc: Document) -> Result:
  doc |> Docs.extract(doc)`;
    const r = await runtime(src).run("Text", { doc: PDF });
    expect(r.output).toMatchObject({ type: "pdf", source: expect.stringMatching(/^\[document: #/) });
  });

  test("Documents.extract refuses a reference the run doesn't hold", async () => {
    const src = `tool Docs : Documents()
pipeline Text(q: String) -> Result:
  q |> Docs.extract(context.input.ref)`;
    const forged = { $media: "document", sha256: "b".repeat(64), type: "application/pdf", size: 10 };
    await expect(runtime(src).run("Text", { q: "x", ref: forged })).rejects.toThrow(/is not a file this run was given or made/);
  });
});

describe("halo blobs", () => {
  test("prune removes files nothing mentions, after a grace period", async () => {
    const state = mkdtempSync(join(tmp, "state-"));
    const store = new FileBlobStore(join(state, "blobs"));
    const kept = await mint(store, png(5, 5, 1));
    const inThread = await mint(store, png(5, 5, 2));
    const orphan = await mint(store, png(5, 5, 3));
    const fresh = await mint(store, png(5, 5, 4));
    await Bun.write(join(state, "runs", "r1.json"), JSON.stringify({ current: kept }));
    // A database mentions one too (thread state, telemetry): read as bytes.
    const { Database } = await import("bun:sqlite");
    const db = new Database(join(state, "threads.sqlite"));
    db.run("create table t (state text)");
    db.run("insert into t values (?)", [JSON.stringify({ photo: inThread })]);
    db.close();
    const { blobUsage } = await import("../src/runtime/media");
    const later = Date.now() + 2 * 60 * 60 * 1000;
    // The fresh one was "stored" just now in this later clock's terms.
    const { utimesSync } = await import("node:fs");
    utimesSync(join(state, "blobs", fresh.sha256), new Date(later), new Date(later));

    const dry = await blobUsage(state, { prune: true, dryRun: true, now: later });
    expect(dry.removed).toEqual([orphan.sha256]);
    expect(existsSync(join(state, "blobs", orphan.sha256))).toBe(true);
    expect(dry.blobs.filter((b) => !b.referenced).map((b) => b.sha256).sort()).toEqual([orphan.sha256, fresh.sha256].sort());

    const done = await blobUsage(state, { prune: true, now: later });
    expect(done.removed).toEqual([orphan.sha256]);
    expect(done.freedBytes).toBe(64);
    expect(readdirSync(join(state, "blobs")).sort()).toEqual([kept.sha256, inThread.sha256, fresh.sha256].sort());
  });
});

describe("hosted pipelines", () => {
  test("a file goes to the publisher inline, and one in its answer comes back as this run's own", async () => {
    const dir = mkdtempSync(join(tmp, "eyes-"));
    const files: Record<string, string> = {
      "halo.json": JSON.stringify({ name: "@acme/eyes", version: "1.0.0", description: "Looks at photos", exports: ["lib/main.halo"], hosted: { endpoint: "http://localhost:1", auth: { type: "bearer", env: "EYES_KEY" }, exports: ["Stamp"] } }),
      "README.md": "# eyes\n",
      "lib/main.halo": "schema Note {\n  text: String,\n}\n",
      "hosted/stamp.halo": `agent Eye [anthropic/claude-haiku-4-5]
pipeline Stamp(photo: Image) -> Result:
  photo |> Eye.look() as seen |> System.Value(context.input)`,
    };
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(dir, path, ".."), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    const seenByPublisher: MockRequest[] = [];
    const publisher = await startServer({
      package: dir,
      port: 0,
      packageKeys: { acme: "key-1" },
      stateDir: join(dir, ".state"),
      env: {},
      logger: { log() {}, warn() {}, error() {} },
      scheduler: false,
      onRuntime: (rt) => rt.mockAll({ Eye: (q: MockRequest) => (seenByPublisher.push(q), "a dent") }),
    });
    try {
      const { hostedProvider } = await import("../src/runtime/hosted");
      const src = `tool Remote : Hosted(endpoint: "http://localhost:${publisher.port}", package: "@acme/eyes", version: "1.0.0", pipeline: "Stamp", auth: "bearer", env: "EYES_KEY")
pipeline Send(photo: Image) -> Result:
  photo |> Remote.run(photo: photo)`;
      const rt = new HaloRuntime({ env: { EYES_KEY: "key-1" }, logger: quiet }).registerToolProvider("Hosted", hostedProvider).load(parse(src));
      const r = await rt.run("Send", { photo: PNG_1x1 });
      expect(r.status).toBe("completed");
      // The publisher's model was sent the image.
      expect(seenByPublisher[0]!.media).toHaveLength(1);
      // Its answer held the image; here it is a file of this run again, by the same hash.
      const back = (r.output as any).photo as MediaRef;
      expect(back).toMatchObject({ $media: "image", type: "image/png", sha256: collectMedia(r.context.input)[0]!.sha256 });
      expect(JSON.stringify(r.output)).not.toContain('"data"');
    } finally {
      await publisher.stop();
    }
  });
});
