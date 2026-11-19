/** Phase C of the file work: audio, the Transcribe tool, and transcripts for models that can't take audio. */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { parse } from "../src/parser/index";
import { validate } from "../src/parser/validate";
import { HaloRuntime, type MockRequest } from "../src/runtime/runtime";
import { AnthropicAdapter, GoogleAdapter } from "../src/runtime/adapter";
import { sniff } from "../src/runtime/media";
import { mockEverything } from "../src/runtime/mocks";
import { clock, transcriptText } from "../src/runtime/providers/transcribe";

const quiet = { log() {}, warn() {} };

/** A WAV file: 8 kHz, mono, 16-bit, `seconds` long. */
function wav(seconds: number): Uint8Array {
  const data = 16_000 * seconds;
  const b = new Uint8Array(44 + data);
  const v = new DataView(b.buffer);
  b.set(new TextEncoder().encode("RIFF"), 0);
  v.setUint32(4, 36 + data, true);
  b.set(new TextEncoder().encode("WAVEfmt "), 8);
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, 8000, true); // sample rate
  v.setUint32(28, 16_000, true); // bytes a second
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  b.set(new TextEncoder().encode("data"), 36);
  v.setUint32(40, data, true);
  return b;
}

// OpenAI's transcription endpoint, Gemini, and Anthropic: what each was sent.
let seen: Array<{ path: string; form?: any; json?: any }> = [];
let server: ReturnType<typeof Bun.serve>;
let base: string;
beforeAll(() => {
  server = Bun.serve({
    port: 0,
    async fetch(req) {
      const path = new URL(req.url).pathname;
      if (path.endsWith("/audio/transcriptions")) {
        const form = await req.formData();
        seen.push({ path, form });
        if (form.get("model") === "whisper-1") return Response.json({ text: "Hello. Goodbye.", language: "english", duration: 2, segments: [{ start: 0, end: 1, text: " Hello." }, { start: 61.2, end: 62, text: " Goodbye." }] });
        return Response.json({ text: "Hello, this is Ana about policy 4471." });
      }
      const json = await req.json();
      seen.push({ path, json });
      if (path.includes(":generateContent")) return Response.json({ candidates: [{ content: { parts: [{ text: "What Gemini heard." }] } }] });
      return Response.json({ content: [{ type: "text", text: "noted" }], usage: { input_tokens: 1, output_tokens: 1 } });
    },
  });
  base = `http://localhost:${server.port}`;
});
afterAll(() => server.stop(true));

function runtime(src: string, config: ConstructorParameters<typeof HaloRuntime>[0] = {}) {
  seen = [];
  return new HaloRuntime({ env: { ANTHROPIC_API_KEY: "k", OPENAI_API_KEY: "o", GEMINI_API_KEY: "g" }, logger: quiet, ...config })
    .registerAdapter(new AnthropicAdapter({ baseUrl: base }))
    .registerAdapter(new GoogleAdapter({ baseUrl: `${base}/v1beta` }))
    .load(parse(src));
}

describe("audio values", () => {
  test("a WAV is audio, with its length", () => {
    expect(sniff(wav(3))).toEqual({ kind: "audio", type: "audio/wav", duration: 3 });
  });

  test("Audio is a type, with a duration a gate can read", () => {
    const diags = validate(parse(`agent A [anthropic/claude-haiku-4-5]\npipeline P(call: Audio) -> Result:\n  call |? (call.duration < 600) |> A.summarise()`));
    expect(diags).toEqual([]);
  });

  test("a transcript with timed segments reads as timed lines", () => {
    expect(clock(75.4)).toBe("1:15");
    expect(clock(3725)).toBe("1:02:05");
    expect(transcriptText({ text: "x", segments: [{ start: 0, text: "Hi." }, { start: 61, text: "Bye." }] })).toBe("[0:00] Hi.\n[1:01] Bye.");
  });
});

describe("the Transcribe tool", () => {
  test("OpenAI: the file goes as an upload; the cost is the run's", async () => {
    const src = `tool Ears : Transcribe(openai, baseUrl: "${base}/v1")
pipeline T(call: Audio) -> Result:
  call |> Ears.text(call)`;
    const r = await runtime(src).run("T", { call: wav(120) });
    expect(r.output).toMatchObject({ text: "Hello, this is Ana about policy 4471.", model: "gpt-4o-mini-transcribe", duration: 120 });
    const form = seen[0]!.form;
    expect(form.get("model")).toBe("gpt-4o-mini-transcribe");
    expect(form.get("response_format")).toBe("json");
    expect((form.get("file") as File).name).toMatch(/^audio-[0-9a-f]{6}\.wav$/);
    expect((form.get("file") as File).type).toMatch(/^audio\/(x-)?wav$/);
    // Two minutes at $0.003 a minute.
    expect(r.context.meta.cost).toBeCloseTo(0.006, 6);
  });

  test("whisper-1 gives timed segments; Gemini gets the audio inline", async () => {
    const whisper = await runtime(`tool Ears : Transcribe(openai, model: "whisper-1", baseUrl: "${base}/v1")\npipeline T(call: Audio) -> Result:\n  call |> Ears.text(call)`).run("T", { call: wav(2) });
    expect(seen[0]!.form.get("response_format")).toBe("verbose_json");
    expect((whisper.output as any).segments).toEqual([{ start: 0, end: 1, text: "Hello." }, { start: 61.2, end: 62, text: "Goodbye." }]);
    const gemini = await runtime(`tool Ears : Transcribe(gemini, baseUrl: "${base}/v1beta")\npipeline T(call: Audio) -> Result:\n  call |> Ears.text(call)`).run("T", { call: wav(2) });
    expect((gemini.output as any).text).toBe("What Gemini heard.");
    expect(seen[0]!.json.contents[0].parts[0].inlineData.mimeType).toBe("audio/wav");
  });

  test("a missing key or service says what to set", async () => {
    const r = new HaloRuntime({ env: {}, logger: quiet }).load(parse(`tool Ears : Transcribe(openai)\npipeline T(call: Audio) -> Result:\n  call |> Ears.text(call)`));
    await expect(r.run("T", { call: wav(1) })).rejects.toThrow(/needs OPENAI_API_KEY/);
    await expect(runtime(`tool Ears : Transcribe(whisper)\npipeline T(call: Audio) -> Result:\n  call |> Ears.text(call)`).run("T", { call: wav(1) })).rejects.toThrow(/use Transcribe\(openai\) or Transcribe\(gemini\)/);
  });
});

describe("an agent sent audio", () => {
  const src = (model: string, extra = "") => `${extra}
agent Clerk [${model}]
pipeline Note(call: Audio) -> Result:
  call |> Clerk.summarise("What did the caller want?")`;

  test("a model that can't take audio gets its transcript, from a recorded step", async () => {
    const r = await runtime(src("anthropic/claude-haiku-4-5"), { media: { transcribe: "openai", baseUrl: `${base}/v1` } }).run("Note", { call: wav(30) });
    expect(r.output).toBe("noted");
    const text = seen.find((s) => s.path === "/v1/messages")!.json.messages[0].content;
    expect(text).toContain("The transcript (from [audio: #");
    expect(text).toContain("Hello, this is Ana about policy 4471.");
    expect(r.context.meta.calls.map((c) => c.target)).toEqual(["Media.transcript", "Clerk.summarise"]);
    expect(r.context.meta.cost).toBeGreaterThan(0.001);
  });

  test("Gemini takes the audio as it is", async () => {
    await runtime(src("gemini/gemini-2.5-flash")).run("Note", { call: wav(2) });
    expect(seen.filter((s) => s.path.endsWith("/audio/transcriptions"))).toHaveLength(0);
    const parts = seen[0]!.json.contents[0].parts;
    expect(parts[0].text).toMatch(/^\[audio: #/);
    expect(parts[1].inlineData.mimeType).toBe("audio/wav");
  });

  test("with no transcriber, the error says what would work", async () => {
    const r = new HaloRuntime({ env: { ANTHROPIC_API_KEY: "k" }, logger: quiet }).registerAdapter(new AnthropicAdapter({ baseUrl: base })).load(parse(src("anthropic/claude-haiku-4-5")));
    await expect(r.run("Note", { call: wav(1) })).rejects.toThrow(/needs OPENAI_API_KEY or GEMINI_API_KEY or GOOGLE_API_KEY.*Or give the agent a Gemini model/);
  });

  test("a recording that would cost more than the agent's budget isn't transcribed", async () => {
    const budget = `policy Budget : MaxSpend(0.01)\n`;
    const rt = runtime(src("anthropic/claude-haiku-4-5", budget).replace("agent Clerk [anthropic/claude-haiku-4-5]", "agent Clerk [anthropic/claude-haiku-4-5]\n  requires Budget"), { media: { transcribe: "openai", baseUrl: `${base}/v1` } });
    // An hour at $0.003 a minute is $0.18.
    await expect(rt.run("Note", { call: wav(3600) })).rejects.toThrow(/Budget/);
    expect(seen).toHaveLength(0);
  });

  test("halo test mocks the transcript, so nothing is sent", async () => {
    const program = parse(src("anthropic/claude-haiku-4-5"));
    const rt = new HaloRuntime({ env: {}, logger: quiet }).load(program);
    mockEverything(rt, program);
    const asked: MockRequest[] = [];
    rt.mockAll({ Clerk: (q: MockRequest) => (asked.push(q), "ok") });
    expect((await rt.run("Note", { call: wav(5) })).status).toBe("completed");
    expect(asked[0]!.prompt).toContain("[mock transcript of the recording]");
  });
});
