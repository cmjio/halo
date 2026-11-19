/**
 * Media references and how they read in text: no Node APIs here, so the parser, the plan and
 * the browser playground can use them. Storage and fetching are in media.ts.
 */

export type MediaKind = "image" | "document" | "audio" | "video";

export const MEDIA_KINDS: readonly MediaKind[] = ["image", "document", "audio", "video"];

/** A kind in a sentence: "an image", "a document", "an audio file", "a video". */
export const aKind = (k: MediaKind) => ({ image: "an image", document: "a document", audio: "an audio file", video: "a video" })[k];

/** The plural: "images", "documents", "audio files", "videos". */
export const kinds = (k: MediaKind) => ({ image: "images", document: "documents", audio: "audio files", video: "videos" })[k];

export interface MediaRef {
  $media: MediaKind;
  sha256: string;
  /** The media type, read from the bytes themselves. */
  type: string;
  /** Bytes. */
  size: number;
  name?: string;
  /** A document's format: pdf, docx, pptx, eml, csv, tsv, markdown, html, json or text. */
  format?: string;
  /** Pixels, for an image. */
  width?: number;
  height?: number;
  /** For a PDF, when its page count could be read; for a deck, its slides. */
  pages?: number;
  /** Seconds, for audio and video, when the file says. */
  duration?: number;
  /** A video held as a link (YouTube), not as bytes: `sha256` is the link's hash. */
  url?: string;
}

/** The type names a pipeline declares media with, and the kind each holds. */
export const MEDIA_TYPES: Record<string, MediaKind> = { Image: "image", Document: "document", Audio: "audio", Video: "video" };

export const HASH = /^[0-9a-f]{64}$/;

export function isMediaRef(v: unknown): v is MediaRef {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const r = v as Record<string, unknown>;
  return MEDIA_KINDS.includes(r.$media as MediaKind) && typeof r.sha256 === "string" && HASH.test(r.sha256) && typeof r.type === "string" && typeof r.size === "number";
}

/** A file name as it may appear in a prompt: one line, no brackets or quotes, not long. */
export function safeName(name: string | undefined): string | undefined {
  const clean = (name ?? "")
    .split(/[\\/]/)
    .at(-1)!
    .replace(/[\u0000-\u001f\u007f[\]"`<>{}]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return clean || undefined;
}

/** How a media value reads in text: a prompt, a log line, a mock. The same image reads the same everywhere. */
export function mediaLabel(ref: MediaRef): string {
  const name = safeName(ref.name);
  return `[${ref.$media}: ${name ? `${name} ` : ""}#${ref.sha256.slice(0, 6)}]`;
}

/** Every media reference inside a value, each once, in the order met. */
export function collectMedia(...values: unknown[]): MediaRef[] {
  const found = new Map<string, MediaRef>();
  const seen = new WeakSet<object>();
  const walk = (v: unknown, depth: number) => {
    if (v === null || typeof v !== "object" || depth > 200 || seen.has(v)) return;
    seen.add(v);
    if (isMediaRef(v)) {
      if (!found.has(v.sha256)) found.set(v.sha256, v);
      return;
    }
    for (const item of Array.isArray(v) ? v : Object.values(v)) walk(item, depth + 1);
  };
  for (const v of values) walk(v, 0);
  return [...found.values()];
}

