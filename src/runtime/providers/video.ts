/**
 * A video for a model that can't watch one: its sound as a transcript, and a picture every
 * few seconds. Uses ffmpeg (and ffprobe) from this machine; the transcript uses the runtime's
 * transcriber. The runtime calls it as `Media.digest`, a recorded step.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HaloError } from "../errors.js";
import { MediaBytes, safeName, uploadName, type MediaRef } from "../media.js";
import { clock, transcribe, type Transcript, type TranscribeService } from "./transcribe.js";

/** The most frames a digest takes, and the least time between two. */
export const MAX_FRAMES = 10;
const MIN_GAP_SECONDS = 2;
/** How wide a frame is, in pixels (taller frames keep their shape). */
const FRAME_WIDTH = 768;

export interface Digest {
  duration?: number;
  /** The transcript, or why there is none (no sound, no transcriber). */
  transcript?: Transcript;
  noTranscript?: string;
  frames: Array<{ at: number; image: MediaBytes }>;
}

const tool = (name: string) => Bun.which(name, { PATH: process.env.PATH ?? "" });

async function run(args: string[], signal?: AbortSignal): Promise<{ code: number; out: string }> {
  const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe", signal, env: { ...process.env } });
  const timer = setTimeout(() => proc.kill(), 300_000);
  const [out, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  clearTimeout(timer);
  return { code, out };
}

/** The times to take frames at: evenly spread, the middle of each stretch, at most MAX_FRAMES, at least MIN_GAP_SECONDS apart. */
export function frameTimes(duration: number): number[] {
  const n = Math.max(1, Math.min(MAX_FRAMES, Math.floor(duration / MIN_GAP_SECONDS)));
  return Array.from({ length: n }, (_, i) => Math.round(((duration * (i + 0.5)) / n) * 10) / 10);
}

export async function digestVideo(
  ref: MediaRef,
  bytes: Uint8Array,
  o: { transcriber: { service: TranscribeService; apiKey: string; model?: string; baseUrl?: string } | { missing: string }; fetch: typeof fetch; signal?: AbortSignal; spend?: (usd: number) => void },
): Promise<Digest> {
  const ffmpeg = tool("ffmpeg");
  const ffprobe = tool("ffprobe");
  if (!ffmpeg || !ffprobe) throw new HaloError(`${uploadName(ref)} is a video, and this model can't watch one. Halo can send it a transcript and frames instead, using ffmpeg and ffprobe, which aren't installed here. Install ffmpeg, or give the agent a Gemini model`, { code: "MEDIA_UNSUPPORTED" });
  const dir = mkdtempSync(join(tmpdir(), "halo-video-"));
  try {
    const input = join(dir, uploadName(ref));
    writeFileSync(input, bytes);
    let duration = ref.duration;
    if (!duration) {
      const probe = await run([ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", input], o.signal);
      duration = Number(probe.out.trim()) || undefined;
    }
    const base = (safeName(ref.name) ?? "video").replace(/\.[A-Za-z0-9]{1,5}$/, "");
    const frames: Digest["frames"] = [];
    for (const [i, at] of frameTimes(duration ?? MIN_GAP_SECONDS).entries()) {
      const out = join(dir, `frame-${i}.jpg`);
      await run([ffmpeg, "-v", "error", "-ss", String(at), "-i", input, "-frames:v", "1", "-vf", `scale='min(${FRAME_WIDTH},iw)':-2`, "-q:v", "4", "-y", out], o.signal);
      if (existsSync(out)) frames.push({ at, image: new MediaBytes(new Uint8Array(readFileSync(out)), { name: `${base}-at-${clock(at).replace(":", "m")}s.jpg` }) });
    }
    if (!frames.length) throw new HaloError(`ffmpeg couldn't take any pictures from ${uploadName(ref)}: it may not be a video it can read`, { code: "MEDIA_TYPE" });

    const digest: Digest = { ...(duration ? { duration } : {}), frames };
    const sound = await run([ffprobe, "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", input], o.signal);
    if (!sound.out.trim()) {
      digest.noTranscript = "the video has no sound";
    } else if ("missing" in o.transcriber) {
      digest.noTranscript = o.transcriber.missing;
    } else {
      // Mono speech at 16 kHz is all a transcriber needs, and keeps the upload small.
      const audio = join(dir, "sound.mp3");
      const done = await run([ffmpeg, "-v", "error", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", "-y", audio], o.signal);
      if (done.code !== 0 || !existsSync(audio)) {
        digest.noTranscript = "ffmpeg couldn't take the sound out of the video";
      } else {
        const sound = new Uint8Array(readFileSync(audio));
        const t = o.transcriber;
        const soundRef: MediaRef = { $media: "audio", sha256: ref.sha256, type: "audio/mpeg", size: sound.length, name: `${base}.mp3`, ...(duration ? { duration } : {}) };
        digest.transcript = await transcribe(t.service, soundRef, sound, { fetch: o.fetch, apiKey: t.apiKey, model: t.model, baseUrl: t.baseUrl, signal: o.signal });
        o.spend?.(digest.transcript.cost);
      }
    }
    return digest;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
