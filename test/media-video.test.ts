/** Phase D of the file work: video. Gemini watches it (inline, uploaded, or a YouTube link); other models get a transcript and frames. */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index";
import { HaloRuntime, type MockRequest } from "../src/runtime/runtime";
import { AnthropicAdapter, GoogleAdapter } from "../src/runtime/adapter";
import { sniff, youtubeRef } from "../src/runtime/media";
import { mockEverything } from "../src/runtime/mocks";
import { frameTimes } from "../src/runtime/providers/video";

const quiet = { log() {}, warn() {} };
const tmp = mkdtempSync(join(tmpdir(), "halo-video-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const hasFfmpeg = !!Bun.which("ffmpeg") && !!Bun.which("ffprobe");

/** A real MP4 made by ffmpeg: a test pattern, with a tone unless `silent`. */
function makeVideo(seconds: number, silent = false): Uint8Array {
  const out = join(tmp, `v-${seconds}-${silent}.mp4`);
  const args = ["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `testsrc=duration=${seconds}:size=320x240:rate=10`];
  if (!silent) args.push("-f", "lavfi", "-i", `sine=frequency=440:duration=${seconds}`, "-shortest");
  args.push("-pix_fmt", "yuv420p", out);
  const r = Bun.spawnSync(args);
  if (r.exitCode !== 0) throw new Error(`ffmpeg failed: ${r.stderr.toString()}`);
  return new Uint8Array(readFileSync(out));
}

// Anthropic, OpenAI's transcription, and Gemini (with its Files API).
let seen: Array<{ path: string; json?: any; headers?: Record<string, string>; size?: number }> = [];
let server: ReturnType<typeof Bun.serve>;
let base: string;
beforeAll(() => {
  server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;
      if (path.endsWith("/audio/transcriptions")) {
        seen.push({ path });
        return Response.json({ text: "Beep." });
      }
      if (path === "/upload/v1beta/files") {
        seen.push({ path, headers: Object.fromEntries(req.headers), json: await req.json() });
        return new Response("{}", { headers: { "x-goog-upload-url": `${base}/upload-session/1` } });
      }
      if (path === "/upload-session/1") {
        seen.push({ path, headers: Object.fromEntries(req.headers), size: (await req.arrayBuffer()).byteLength });
        return Response.json({ file: { name: "files/abc", uri: `${base}/v1beta/files/abc`, state: "PROCESSING" } });
      }
      if (path === "/v1beta/files/abc") {
        seen.push({ path });
        return Response.json({ name: "files/abc", state: "ACTIVE" });
      }
      const json = await req.json();
      seen.push({ path, json });
      if (path.includes(":generateContent")) return Response.json({ candidates: [{ content: { parts: [{ text: "watched" }] } }] });
      return Response.json({ content: [{ type: "text", text: "looked" }], usage: { input_tokens: 1, output_tokens: 1 } });
    },
  });
  base = `http://localhost:${server.port}`;
});
afterAll(() => server.stop(true));

function runtime(model: string, config: ConstructorParameters<typeof HaloRuntime>[0] = {}) {
  seen = [];
  return new HaloRuntime({ env: { ANTHROPIC_API_KEY: "k", OPENAI_API_KEY: "o", GEMINI_API_KEY: "g" }, logger: quiet, media: { transcribe: "openai", baseUrl: `${base}/v1` }, ...config })
    .registerAdapter(new AnthropicAdapter({ baseUrl: base }))
    .registerAdapter(new GoogleAdapter({ baseUrl: `${base}/v1beta` }))
    .load(parse(`agent Eye [${model}]\npipeline Watch(clip: Video) -> Result:\n  clip |> Eye.describe("What happens in this video?")`));
}

describe("video values", () => {
  test("frames are spread over the video, at most ten, at least two seconds apart", () => {
    expect(frameTimes(1)).toEqual([0.5]);
    expect(frameTimes(6)).toEqual([1, 3, 5]);
    expect(frameTimes(600)).toHaveLength(10);
    expect(frameTimes(600)[0]).toBe(30);
  });

  test("a YouTube link is a video held as the link", () => {
    for (const link of ["https://www.youtube.com/watch?v=9hE5-98ZeCg", "https://youtu.be/9hE5-98ZeCg?t=10", "https://m.youtube.com/watch?feature=share&v=9hE5-98ZeCg", "https://www.youtube.com/shorts/9hE5-98ZeCg"]) {
      expect(youtubeRef(link)).toMatchObject({ $media: "video", type: "video/youtube", size: 0, url: "https://www.youtube.com/watch?v=9hE5-98ZeCg" });
    }
    expect(youtubeRef("https://example.com/watch?v=9hE5-98ZeCg")).toBeUndefined();
  });
});

describe("Gemini watches it", () => {
  test("a YouTube link goes as a file reference", async () => {
    await runtime("gemini/gemini-2.5-flash").run("Watch", { clip: "https://youtu.be/9hE5-98ZeCg" });
    const parts = seen[0]!.json.contents[0].parts;
    expect(parts[0].text).toBe("[video: youtube-9hE5-98ZeCg #" + youtubeRef("https://youtu.be/9hE5-98ZeCg")!.sha256.slice(0, 6) + "]");
    expect(parts[1]).toEqual({ fileData: { fileUri: "https://www.youtube.com/watch?v=9hE5-98ZeCg" } });
  });

  test.skipIf(!hasFfmpeg)("a small video goes inline; a large one is uploaded once, then sent by reference", async () => {
    const small = makeVideo(2);
    expect(sniff(small)).toMatchObject({ kind: "video", type: "video/mp4", width: 320, height: 240 });
    await runtime("gemini/gemini-2.5-flash").run("Watch", { clip: small });
    expect(seen[0]!.json.contents[0].parts[1].inlineData.mimeType).toBe("video/mp4");

    // The same video with 15 MB of padding: past the inline limit.
    const big = new Uint8Array(small.length + 15 * 1024 * 1024);
    big.set(small);
    const rt = runtime("gemini/gemini-2.5-flash");
    await rt.run("Watch", { clip: big });
    expect(seen.map((s) => s.path)).toEqual(["/upload/v1beta/files", "/upload-session/1", "/v1beta/files/abc", "/v1beta/models/gemini-2.5-flash:generateContent"]);
    expect(seen[0]!.headers!["x-goog-upload-protocol"]).toBe("resumable");
    expect(seen[0]!.headers!["x-goog-upload-header-content-length"]).toBe(String(big.length));
    expect(seen[1]!.headers!["x-goog-upload-command"]).toBe("upload, finalize");
    expect(seen[1]!.size).toBe(big.length);
    expect(seen[3]!.json.contents[0].parts[1]).toEqual({ fileData: { fileUri: `${base}/v1beta/files/abc`, mimeType: "video/mp4" } });
    // Again in the same runtime: no second upload.
    seen = [];
    await rt.run("Watch", { clip: big });
    expect(seen.map((s) => s.path)).toEqual(["/v1beta/models/gemini-2.5-flash:generateContent"]);
  }, 30_000);
});

describe("other models get a transcript and frames", () => {
  test.skipIf(!hasFfmpeg)("from a recorded step, with each frame labelled with its time", async () => {
    const r = await runtime("anthropic/claude-haiku-4-5").run("Watch", { clip: makeVideo(4) });
    expect(r.output).toBe("looked");
    expect(r.context.meta.calls.map((c) => c.target)).toEqual(["Media.digest", "Eye.describe"]);
    const content = seen.find((s) => s.path === "/v1/messages")!.json.messages[0].content as any[];
    const images = content.filter((c) => c.type === "image");
    expect(images).toHaveLength(2);
    expect(images[0].source.media_type).toBe("image/jpeg");
    const text = content.at(-1).text as string;
    expect(text).toContain("What the video shows (from [video: #");
    expect(text).toContain("It is 0:04 long.");
    expect(text).toContain("What is said:\nBeep.");
    expect(text).toMatch(/Frames:\n\[image: video-at-0m01s\.jpg #[0-9a-f]{6}\] at 0:01\n\[image: video-at-0m03s\.jpg #[0-9a-f]{6}\] at 0:03/);
    expect(seen.some((s) => s.path === "/v1/audio/transcriptions")).toBe(true);
  }, 30_000);

  test.skipIf(!hasFfmpeg)("a video with no sound gets frames and says so", async () => {
    await runtime("anthropic/claude-haiku-4-5").run("Watch", { clip: makeVideo(2, true) });
    const text = seen.find((s) => s.path === "/v1/messages")!.json.messages[0].content.at(-1).text as string;
    expect(text).toContain("No transcript: the video has no sound.");
    expect(seen.some((s) => s.path.endsWith("/audio/transcriptions"))).toBe(false);
  }, 30_000);

  test("a YouTube link on a model that can't watch video is a clear error", async () => {
    await expect(runtime("anthropic/claude-haiku-4-5").run("Watch", { clip: "https://www.youtube.com/watch?v=9hE5-98ZeCg" })).rejects.toThrow(/is a YouTube link, and only Gemini models watch those/);
  });

  test.skipIf(!hasFfmpeg)("without ffmpeg, the error says to install it or use Gemini", async () => {
    const clip = makeVideo(2);
    const PATH = process.env.PATH;
    process.env.PATH = "/nonexistent";
    try {
      await expect(runtime("anthropic/claude-haiku-4-5").run("Watch", { clip })).rejects.toThrow(/Install ffmpeg, or give the agent a Gemini model/);
    } finally {
      process.env.PATH = PATH;
    }
  }, 30_000);

  test("halo test mocks the digest, so nothing runs", async () => {
    const program = parse(`agent Eye [anthropic/claude-haiku-4-5]\npipeline Watch(clip: Video) -> Result:\n  clip |> Eye.describe()`);
    const rt = new HaloRuntime({ env: {}, logger: quiet }).load(program);
    mockEverything(rt, program);
    const asked: MockRequest[] = [];
    rt.mockAll({ Eye: (q: MockRequest) => (asked.push(q), "ok") });
    // Any bytes that read as an MP4 will do: the digest never looks at them.
    const fake = new Uint8Array(64);
    fake.set([0, 0, 0, 24, ...new TextEncoder().encode("ftypisom")]);
    fake.set([0, 0, 0, 40, ...new TextEncoder().encode("moov"), 0, 0, 0, 32, ...new TextEncoder().encode("hdlr"), 0, 0, 0, 0, 0, 0, 0, 0, ...new TextEncoder().encode("vide")], 24);
    expect(sniff(fake)?.kind).toBe("video");
    expect((await rt.run("Watch", { clip: fake })).status).toBe("completed");
    expect(asked[0]!.prompt).toContain("[mock transcript of the video]");
  });
});
