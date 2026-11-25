/**
 * Speech to text.
 *
 *   tool Ears : Transcribe(openai)                     OPENAI_API_KEY; model: gpt-4o-mini-transcribe
 *   tool Ears : Transcribe(gemini, model: "gemini-2.5-flash")   GEMINI_API_KEY (or GOOGLE_API_KEY)
 *
 *   recording |> Ears.text(recording)  ->  { text, language?, duration?, segments?: [{ start, end, text }], model }
 *
 * The runtime also uses it on its own (as `Media.transcript`) when an agent is sent audio its
 * model can't take. What it costs is added to the run's cost.
 */

import { HaloError, HttpError } from "../errors.js";
import { isMediaRef, megabytes, uploadName, type MediaRef } from "../media.js";
import type { ProviderInfo, ToolProvider } from "../tools.js";

export type TranscribeService = "openai" | "gemini";
export const TRANSCRIBE_SERVICES: TranscribeService[] = ["openai", "gemini"];

export interface Transcript {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{ start: number; end: number; text: string }>;
  model: string;
  /** USD, estimated from the length. */
  cost: number;
}

const DEFAULT_MODEL: Record<TranscribeService, string> = { openai: "gpt-4o-mini-transcribe", gemini: "gemini-2.5-flash" };

/** USD per minute of audio, by model (a model not listed is priced like the dearest). */
const PER_MINUTE: Record<string, number> = { "whisper-1": 0.006, "gpt-4o-transcribe": 0.006, "gpt-4o-mini-transcribe": 0.003, "gemini-2.5-flash": 0.002, "gemini-2.5-pro": 0.008 };

/** The most bytes each service takes in one request. */
const MAX_UPLOAD: Record<TranscribeService, number> = { openai: 25 * 1024 * 1024, gemini: 14 * 1024 * 1024 };

/** The environment variables each service's key is read from. */
export const TRANSCRIBE_KEYS: Record<TranscribeService, string[]> = { openai: ["OPENAI_API_KEY"], gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"] };

/** A file's length in seconds: what it says, else a high guess from its size (128 kbit/s). */
export const secondsOf = (ref: MediaRef) => ref.duration ?? ref.size / 16_000;

/** The most a transcription of this file costs, in USD. */
export function transcriptionCost(ref: MediaRef, model: string): number {
  return (Math.max(secondsOf(ref), 1) / 60) * (PER_MINUTE[model] ?? 0.008);
}

export function isService(s: unknown): s is TranscribeService {
  return typeof s === "string" && (TRANSCRIBE_SERVICES as string[]).includes(s);
}

export interface TranscribeOptions {
  fetch: typeof fetch;
  apiKey: string;
  model?: string;
  language?: string;
  /** Another API address (a proxy, or a test server). */
  baseUrl?: string;
  signal?: AbortSignal;
}

/** Transcribe one audio (or video) file. */
export async function transcribe(service: TranscribeService, ref: MediaRef, bytes: Uint8Array, o: TranscribeOptions): Promise<Transcript> {
  const model = o.model ?? DEFAULT_MODEL[service];
  if (bytes.length > MAX_UPLOAD[service]) {
    throw new HaloError(`${uploadName(ref)} is ${megabytes(bytes.length)}; ${service} transcribes files up to ${megabytes(MAX_UPLOAD[service])} in one request`, { code: "MEDIA_TOO_LARGE" });
  }
  const cost = transcriptionCost(ref, model);
  if (service === "openai") {
    const form = new FormData();
    form.append("file", new Blob([bytes as Uint8Array<ArrayBuffer>], { type: ref.type }), uploadName(ref));
    form.append("model", model);
    // whisper-1 gives timed segments; the newer models give the text.
    form.append("response_format", model.startsWith("whisper") ? "verbose_json" : "json");
    if (o.language) form.append("language", o.language);
    const url = `${(o.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "")}/audio/transcriptions`;
    const res = await o.fetch(url, { method: "POST", headers: { Authorization: `Bearer ${o.apiKey}` }, body: form, signal: o.signal });
    const raw = await res.text();
    if (!res.ok) throw new HttpError(`Transcribing with ${model} failed (${res.status}): ${raw.slice(0, 500)}`, res.status, raw);
    const r = JSON.parse(raw) as { text?: string; language?: string; duration?: number; segments?: Array<{ start: number; end: number; text: string }> };
    return {
      text: (r.text ?? "").trim(),
      ...(r.language ? { language: r.language } : {}),
      ...(r.duration ?? ref.duration ? { duration: r.duration ?? ref.duration } : {}),
      ...(r.segments?.length ? { segments: r.segments.map((s) => ({ start: s.start, end: s.end, text: s.text.trim() })) } : {}),
      model,
      cost,
    };
  }
  const url = `${(o.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "")}/models/${model}:generateContent`;
  const instruction = `Transcribe this recording. Write only what is said, as plain text, with no commentary or headings.${o.language ? ` It is in ${o.language}.` : ""}`;
  const body = { contents: [{ role: "user", parts: [{ inlineData: { mimeType: geminiType(ref.type), data: Buffer.from(bytes).toString("base64") } }, { text: instruction }] }], generationConfig: { temperature: 0 } };
  const res = await o.fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": o.apiKey }, body: JSON.stringify(body), signal: o.signal });
  const raw = await res.text();
  if (!res.ok) throw new HttpError(`Transcribing with ${model} failed (${res.status}): ${raw.slice(0, 500)}`, res.status, raw);
  const r = JSON.parse(raw) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = (r.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  return { text, ...(ref.duration ? { duration: ref.duration } : {}), model, cost };
}

/** Gemini names a few types its own way. */
export const geminiType = (type: string) => ({ "audio/mpeg": "audio/mp3", "video/quicktime": "video/mov" })[type] ?? type;

/** A transcript as prompt text: timed lines when it has segments. */
export function transcriptText(t: { text?: unknown; segments?: unknown }): string {
  const segments = Array.isArray(t.segments) ? (t.segments as Array<{ start: number; text: string }>) : [];
  if (segments.length) return segments.map((s) => `[${clock(s.start)}] ${s.text}`).join("\n");
  return typeof t.text === "string" ? t.text : "";
}

/** 75.4 -> "1:15" */
export const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

export const TRANSCRIBE_INFO: ProviderInfo = {
  description: "Speech to text (OpenAI or Gemini). Transcribe(openai) or Transcribe(gemini); model:, apiKey:, language:.",
  methods: [
    {
      name: "text",
      description: "Transcribe an audio or video file the run holds: { text, language, duration, segments }.",
      params: { type: "object", properties: { audio: { type: "string", description: "The recording: its label, e.g. \"[audio: call.mp3 #3fa2c1]\"" }, language: { type: "string", description: "The language spoken, e.g. \"en\" (optional)" } }, required: ["audio"] },
      effect: "external",
    },
  ],
};

export const transcribeProvider: ToolProvider = async (call, services) => {
  if (call.method !== "text" && call.method !== "transcribe") throw new HaloError(`${call.tool.name} has no method "${call.method}" (use text)`, { code: "TOOL_METHOD" });
  const service = call.config(0) ?? call.config("service");
  if (!isService(service)) throw new HaloError(`Tool "${call.tool.name}": Transcribe(${String(service ?? "")}) names no service; use Transcribe(openai) or Transcribe(gemini)`, { code: "TOOL_CONFIG" });
  const ref = call.named.audio ?? call.named.file ?? call.positional[0];
  if (!isMediaRef(ref) || (ref.$media !== "audio" && ref.$media !== "video")) throw new HaloError(`${call.tool.name}.${call.method} takes an audio or video file the run holds`, { code: "TOOL_ARGUMENT" });
  if (!services.media) throw new HaloError("This runtime can't read the files its runs hold", { code: "TOOL_CONFIG" });
  const declared = call.config("apiKey");
  const env = services.env ?? Bun.env;
  const apiKey = typeof declared === "string" && declared ? declared : TRANSCRIBE_KEYS[service].map((k) => env[k]).find(Boolean);
  if (!apiKey) throw new HaloError(`Tool "${call.tool.name}" needs ${TRANSCRIBE_KEYS[service].join(" or ")} (or apiKey: in its declaration)`, { code: "NO_API_KEY" });
  const model = typeof call.config("model") === "string" ? (call.config("model") as string) : undefined;
  const t = await transcribe(service, ref, await services.media(ref), {
    fetch: services.fetch,
    apiKey,
    model,
    language: typeof call.named.language === "string" ? call.named.language : undefined,
    baseUrl: typeof call.config("baseUrl") === "string" ? (call.config("baseUrl") as string) : undefined,
    signal: call.signal,
  });
  services.spend?.(t.cost);
  return t;
};
