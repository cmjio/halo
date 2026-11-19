/** Phase B of the file work: Word, PowerPoint, email and text documents, read as text (a recorded step). */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index";
import { HaloRuntime, type MockRequest, type RecordedCall } from "../src/runtime/runtime";
import { AnthropicAdapter } from "../src/runtime/adapter";
import { MemoryBlobStore, sniff, type MediaRef } from "../src/runtime/media";
import { replayMocks } from "../src/runtime/replay";
import { pptxText } from "../src/runtime/providers/documents";

const tmp = mkdtempSync(join(tmpdir(), "halo-docs-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const quiet = { log() {}, warn() {} };
const enc = (s: string) => new TextEncoder().encode(s);
const PNG = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64"));

/** A zip with stored (uncompressed) entries. */
function zip(files: Record<string, string>): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = enc(text);
    const n = enc(name);
    const crc = Bun.hash.crc32(data);
    const local = new Uint8Array(30 + n.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, n.length, true);
    local.set(n, 30);
    local.set(data, 30 + n.length);
    const central = new Uint8Array(46 + n.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, n.length, true);
    cv.setUint32(42, offset, true);
    central.set(n, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const dir = Buffer.concat(centrals);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, centrals.length, true);
  ev.setUint16(10, centrals.length, true);
  ev.setUint32(12, dir.length, true);
  ev.setUint32(16, offset, true);
  return new Uint8Array(Buffer.concat([...locals, dir, end]));
}

const slide = (text: string) => `<p:sld xmlns:a="a" xmlns:p="p"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p><a:p><a:r><a:t>Q3 &amp; Q4</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
// Two slides, listed second-file-first: the deck shows slide2.xml first.
const DECK = zip({
  "[Content_Types].xml": "<Types/>",
  "ppt/presentation.xml": `<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId id="257" r:id="rId3"/><p:sldId id="256" r:id="rId2"/></p:sldIdLst></p:presentation>`,
  "ppt/_rels/presentation.xml.rels": `<Relationships><Relationship Id="rId2" Type="slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="slide" Target="slides/slide2.xml"/></Relationships>`,
  "ppt/slides/slide1.xml": slide("Revenue grew 12%"),
  "ppt/slides/slide2.xml": slide("Agenda"),
  "ppt/slides/_rels/slide1.xml.rels": `<Relationships><Relationship Id="rId1" Type="notes" Target="../notesSlides/notesSlide1.xml"/></Relationships>`,
  "ppt/notesSlides/notesSlide1.xml": `<p:notes xmlns:a="a" xmlns:p="p"><a:p><a:r><a:t>Mention the churn numbers.</a:t></a:r></a:p><a:p><a:r><a:t>1</a:t></a:r></a:p></p:notes>`,
});
const WORD = zip({ "[Content_Types].xml": "<Types/>", "word/document.xml": `<w:document xmlns:w="w"><w:body><w:p><w:r><w:t>Dear Ana,</w:t></w:r></w:p><w:p><w:r><w:t>Your refund is approved.</w:t></w:r></w:p></w:body></w:document>` });
const SHEET = zip({ "[Content_Types].xml": "<Types/>", "xl/workbook.xml": "<workbook/>" });
const EMAIL = enc(
  [
    "From: Ana Diaz <ana@example.com>",
    "To: claims@example.com",
    "Subject: Dent on my car",
    "Date: Tue, 3 Nov 2026 10:00:00 +0000",
    'Content-Type: multipart/mixed; boundary="b"',
    "",
    "--b",
    "Content-Type: text/plain",
    "",
    "Photo attached. Policy 4471.",
    "--b",
    'Content-Type: image/png; name="dent.png"',
    "Content-Transfer-Encoding: base64",
    'Content-Disposition: attachment; filename="dent.png"',
    "",
    Buffer.from(PNG).toString("base64"),
    "--b--",
    "",
  ].join("\r\n"),
);
const CSV = enc("name,email,amount\nAna,ana@example.com,40\nBo,bo@example.com,12\n");

describe("telling documents apart", () => {
  test("by their bytes; a name only tells text formats apart", () => {
    expect(sniff(WORD)).toMatchObject({ kind: "document", format: "docx" });
    expect(sniff(DECK)).toMatchObject({ kind: "document", format: "pptx", pages: 2, type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
    expect(sniff(SHEET)).toBeUndefined();
    expect(sniff(EMAIL)).toMatchObject({ format: "eml", type: "message/rfc822" });
    expect(sniff(CSV)).toMatchObject({ format: "csv", type: "text/csv" });
    expect(sniff(enc("a\tb\n1\t2\n3\t4\n"))).toMatchObject({ format: "tsv" });
    expect(sniff(enc('{"a": [1, 2]}'))).toMatchObject({ format: "json" });
    expect(sniff(enc("<!doctype html><title>x</title>"))).toMatchObject({ format: "html" });
    expect(sniff(enc("# Notes\n\nSome text."), "notes.md")).toMatchObject({ format: "markdown" });
    expect(sniff(enc("Just a line of text."))).toMatchObject({ format: "text" });
    // A claimed name doesn't make binary into text.
    expect(sniff(new Uint8Array([0, 1, 2, 3]), "data.csv")).toBeUndefined();
  });

  test("a deck's slides in the order it shows them, with speaker notes", () => {
    expect(pptxText(DECK)).toEqual({ slides: 2, text: "Slide 1:\nAgenda\nQ3 & Q4\n\nSlide 2:\nRevenue grew 12%\nQ3 & Q4\nNotes: Mention the churn numbers." });
  });
});

describe("a model reads a document", () => {
  const src = `policy Safe : Redact(Email)
agent Reader [anthropic/claude-haiku-4-5]
agent Careful [anthropic/claude-haiku-4-5]
  requires Safe
pipeline Read(doc: Document) -> Result:
  doc |> Reader.summarise("Summarise this.") as first |> Reader.check(context.input.doc) as second
pipeline Guarded(doc: Document) -> Result:
  doc |> Careful.summarise()`;
  const run = async (pipeline: string, doc: Uint8Array, recorder?: (c: RecordedCall) => void) => {
    const asked: MockRequest[] = [];
    const rt = new HaloRuntime({ env: {}, logger: quiet, recorder }).load(parse(src)).mockAll({ Reader: (q: MockRequest) => (asked.push(q), "ok"), Careful: (q: MockRequest) => (asked.push(q), "ok") });
    const r = await rt.run(pipeline, { doc });
    return { r, asked };
  };

  test("a deck goes as its text, read once per run by a recorded step", async () => {
    const { r, asked } = await run("Read", DECK);
    expect(asked[0]!.prompt).toContain("The text (from [document: #");
    expect(asked[0]!.prompt).toContain("Slide 2:\nRevenue grew 12%\nQ3 & Q4\nNotes: Mention the churn numbers.");
    expect(asked[0]!.media ?? []).toEqual([]);
    expect(asked[1]!.prompt).toContain("Slide 1:\nAgenda");
    expect(r.context.meta.calls.filter((c) => c.target === "Media.text")).toHaveLength(1);
  });

  test("Word, CSV and email too; an email's image goes with it as a file", async () => {
    expect((await run("Read", WORD)).asked[0]!.prompt).toContain("Dear Ana,\nYour refund is approved.");
    expect((await run("Read", CSV)).asked[0]!.prompt).toContain("name,email,amount\nAna,ana@example.com,40");
    const mail = (await run("Read", EMAIL)).asked[0]!;
    expect(mail.prompt).toContain("From: Ana Diaz <ana@example.com>\nTo: claims@example.com\nSubject: Dent on my car");
    expect(mail.prompt).toContain("Photo attached. Policy 4471.");
    expect(mail.prompt).toContain("Attachments:\n- dent.png (image/png, 69 bytes)");
    expect(mail.media).toHaveLength(1);
    expect(mail.media![0]).toMatchObject({ $media: "image", name: "dent.png" });
  });

  test("Redact reads a document's text; an email's image an agent can't be sent is left out, and said", async () => {
    const csv = (await run("Guarded", CSV)).asked[0]!;
    expect(csv.prompt).toContain("Ana,[REDACTED:Email],40");
    expect(csv.prompt).not.toContain("ana@example.com");
    const mail = (await run("Guarded", EMAIL)).asked[0]!;
    expect(mail.media ?? []).toEqual([]);
    expect(mail.prompt).toMatch(/\[image: dent\.png #[0-9a-f]{6}\] was not shown: Agent "Careful" was sent an image, which Redact can't read/);
  });

  test("a replay answers the step from the recording, without the file's bytes", async () => {
    const calls: RecordedCall[] = [];
    const first = await run("Read", DECK, (c) => calls.push(c));
    const rec = { runId: "r", pipeline: "Read", args: first.r.context.input, startedAt: "", calls };
    // A store with nothing in it: reading the deck for real would fail, so the recorded text is what it got.
    const rt = new HaloRuntime({ env: {}, logger: quiet, blobs: new MemoryBlobStore() }).load(parse(src));
    rt.mockAll(replayMocks(rec as any));
    const r = await rt.run("Read", first.r.context.input as Record<string, unknown>, { media: "trusted" });
    expect(r.status).toBe("completed");
    expect(r.context.meta.calls.find((c) => c.target === "Media.text")?.mocked).toBe(true);
  });
});

describe("a deck's PDF", () => {
  let server: ReturnType<typeof Bun.serve>;
  let seen: any[] = [];
  const PATH = process.env.PATH;
  beforeAll(() => {
    server = Bun.serve({ port: 0, fetch: async (req) => (seen.push(await req.json()), Response.json({ content: [{ type: "text", text: "ok" }], usage: { input_tokens: 1, output_tokens: 1 } })) });
    // A stand-in LibreOffice: writes a small PDF where the real one would.
    const bin = mkdtempSync(join(tmp, "bin-"));
    writeFileSync(
      join(bin, "soffice"),
      `#!/bin/sh\nwhile [ $# -gt 0 ]; do case "$1" in --outdir) shift; out="$1";; esac; shift; done\nprintf '%%PDF-1.4\\n1 0 obj << /Type /Page >> endobj\\n%%%%EOF\\n' > "$out/in.pdf"\n`,
    );
    chmodSync(join(bin, "soffice"), 0o755);
    process.env.PATH = `${bin}:${PATH}`;
  });
  afterAll(() => {
    process.env.PATH = PATH;
    server.stop(true);
  });

  test("with LibreOffice, a model that reads PDFs gets the deck as a PDF too", async () => {
    seen = [];
    const rt = new HaloRuntime({ env: { ANTHROPIC_API_KEY: "k" }, logger: quiet })
      .registerAdapter(new AnthropicAdapter({ baseUrl: `http://localhost:${server.port}` }))
      .load(parse(`agent Reader [anthropic/claude-haiku-4-5]\npipeline Read(doc: Document) -> Result:\n  doc |> Reader.summarise()`));
    await rt.run("Read", { doc: new (await import("../src/runtime/media")).MediaBytes(DECK, { name: "q3.pptx" }) });
    const content = seen[0].messages[0].content as any[];
    expect(content[0].text).toMatch(/^\[document: q3\.pdf #/);
    expect(content[1]).toMatchObject({ type: "document", source: { media_type: "application/pdf" } });
    expect(content[2].text).toContain("The text (from [document: q3.pptx #");
  });
});

describe("Docs.extract", () => {
  test("reads a deck, a CSV and an email the run holds", async () => {
    const src = `tool Docs : Documents()
pipeline Text(doc: Document) -> Result:
  doc |> Docs.extract(doc)`;
    const rt = new HaloRuntime({ env: {}, logger: quiet }).load(parse(src));
    expect((await rt.run("Text", { doc: DECK })).output).toMatchObject({ type: "pptx", slides: 2, text: expect.stringContaining("Revenue grew 12%") });
    expect((await rt.run("Text", { doc: CSV })).output).toMatchObject({ type: "csv", rows: [{ name: "Ana", email: "ana@example.com", amount: "40" }, { name: "Bo", email: "bo@example.com", amount: "12" }] });
    const mail = (await rt.run("Text", { doc: EMAIL })).output as any;
    expect(mail).toMatchObject({ type: "eml", subject: "Dent on my car", text: "Photo attached. Policy 4471.", attachments: [{ filename: "dent.png", type: "image/png" }] });
    expect(mail.attachments[0].file).toBeUndefined();
  });

  void ({} as MediaRef);
});
