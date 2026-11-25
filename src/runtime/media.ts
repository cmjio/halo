/**
 * Media values: images and documents a pipeline carries.
 *
 * A media value is a small reference, never the bytes:
 *
 *   { "$media": "image", "sha256": "…", "type": "image/png", "size": 48211, "name": "receipt.png", "width": 800, "height": 600 }
 *
 * The bytes are stored once, by their hash, in a BlobStore. The reference is plain JSON, so
 * it travels through context, snapshots, recordings, telemetry and the trace like any other
 * value and costs a few hundred bytes wherever it goes. In a prompt it reads as a label
 * (`[image: receipt.png #a1b2c3]`), and the model is sent the image itself beside the text.
 *
 * Only the runtime makes references (`mint`), from bytes it has stored. A run remembers the
 * ones it made; a reference that arrives any other way (typed into a request, written by a
 * model) names nothing the run may read, and is refused when it reaches a model.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { zipNames } from "./zip.js";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { HaloError } from "./errors.js";
import { privateAddress } from "./providers/sandbox-kit.js";
import { aKind, HASH, isMediaRef, MEDIA_KINDS, mediaLabel, safeName, type MediaKind, type MediaRef } from "./media-ref.js";

export { aKind, collectMedia, isMediaRef, kinds, MEDIA_KINDS, MEDIA_TYPES, mediaLabel, safeName, type MediaKind, type MediaRef } from "./media-ref.js";

/** The media types Halo accepts, by kind. */
export const ACCEPTED_MEDIA: Record<MediaKind, string[]> = {
  image: ["image/png", "image/jpeg", "image/gif", "image/webp"],
  document: ["application/pdf"],
  audio: ["audio/mpeg", "audio/wav", "audio/flac", "audio/ogg", "audio/mp4", "audio/aac", "audio/webm"],
  video: ["video/mp4", "video/quicktime", "video/webm"],
};

const MB = 1024 * 1024;

/** The most bytes one file of each kind may be. */
export const MAX_BYTES: Record<MediaKind, number> = { image: 25 * MB, document: 50 * MB, audio: 100 * MB, video: 500 * MB };

/** The most bytes Halo reads for one file from anywhere (a URL, an upload): the largest kind's limit. */
export const MAX_MEDIA_BYTES = 500 * MB;

export class MediaError extends HaloError {
  constructor(message: string, code: "MEDIA_TYPE" | "MEDIA_TOO_LARGE" | "MEDIA_UNKNOWN" | "MEDIA_MISSING" | "MEDIA_UNSUPPORTED" | "MEDIA_INPUT") {
    super(message, { code });
    this.name = "MediaError";
  }
}

/**
 * Bytes on their way to becoming a media value. A tool provider returns one (anywhere in its
 * result) and the runtime stores it and puts a reference in its place. JSON can't make one,
 * so a model or a caller can't.
 */
export class MediaBytes {
  readonly bytes: Uint8Array;
  readonly name?: string;
  constructor(bytes: Uint8Array | ArrayBuffer, info: { name?: string } = {}) {
    this.bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (info.name) this.name = info.name;
  }
  toJSON() {
    return `[${this.bytes.length} bytes${this.name ? ` of ${this.name}` : ""}]`;
  }
}

// ── What the bytes are ──

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
const u16 = (b: Uint8Array, at: number) => (b[at]! << 8) | b[at + 1]!;
const u16le = (b: Uint8Array, at: number) => b[at]! | (b[at + 1]! << 8);
const u24le = (b: Uint8Array, at: number) => b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16);
const u32 = (b: Uint8Array, at: number) => b[at]! * 0x1000000 + ((b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!);

function jpegSize(b: Uint8Array): { width: number; height: number } | undefined {
  let at = 2;
  while (at + 9 < b.length) {
    if (b[at] !== 0xff) return undefined;
    const marker = b[at + 1]!;
    if (marker === 0xff) {
      at++;
      continue;
    }
    // Start-of-frame markers carry the size; the others in that range are tables, not frames.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { height: u16(b, at + 5), width: u16(b, at + 7) };
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) at += 2;
    else at += 2 + u16(b, at + 2);
  }
  return undefined;
}

function webpSize(b: Uint8Array): { width: number; height: number } | undefined {
  if (b.length < 30) return undefined;
  const chunk = ascii(b, 12, 16);
  if (chunk === "VP8X") return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  if (chunk === "VP8 ") return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  if (chunk === "VP8L") {
    const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  return undefined;
}

/** A PDF's page count, when its page objects are readable as text (many compressed PDFs hide them). */
function pdfPages(b: Uint8Array): number | undefined {
  const text = new TextDecoder("latin1" as "utf-8").decode(b);
  const n = text.match(/\/Type\s*\/Page(?![s\w])/g)?.length ?? 0;
  return n > 0 ? n : undefined;
}

export interface Sniffed {
  kind: MediaKind;
  type: string;
  /** A document's format: pdf, docx, pptx, eml, csv, tsv, markdown, html, json or text. */
  format?: string;
  width?: number;
  height?: number;
  /** A PDF's pages, or a deck's slides. */
  pages?: number;
  /** Seconds, for audio and video. */
  duration?: number;
}

// ── Audio and video ──

const round = (s: number) => (Number.isFinite(s) && s > 0 ? Math.round(s * 10) / 10 : undefined);

/** An MP4 or QuickTime file's length, picture size, and whether it has a picture at all. */
function mp4Info(b: Uint8Array): { duration?: number; width?: number; height?: number; video: boolean } {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: { duration?: number; width?: number; height?: number; video: boolean } = { video: false };
  const walk = (from: number, to: number, depth: number) => {
    let at = from;
    while (at + 8 <= to && depth < 8) {
      let size = view.getUint32(at);
      const type = ascii(b, at + 4, at + 8);
      let head = 8;
      if (size === 1 && at + 16 <= to) {
        size = Number(view.getBigUint64(at + 8));
        head = 16;
      } else if (size === 0) size = to - at;
      if (size < head || at + size > to) return;
      const body = at + head;
      if (type === "moov" || type === "trak" || type === "mdia") walk(body, at + size, depth + 1);
      else if (type === "mvhd" && body + 32 <= to) {
        const v1 = b[body] === 1;
        const scale = view.getUint32(body + (v1 ? 20 : 12));
        const length = v1 ? Number(view.getBigUint64(body + 24)) : view.getUint32(body + 16);
        out.duration = round(length / scale);
      } else if (type === "tkhd" && body + 92 <= to) {
        const at2 = body + (b[body] === 1 ? 88 : 76);
        const w = view.getUint32(at2) / 65536;
        const h = view.getUint32(at2 + 4) / 65536;
        if (w > 0 && h > 0 && !out.width) [out.width, out.height] = [Math.round(w), Math.round(h)];
      } else if (type === "hdlr" && body + 12 <= to && ascii(b, body + 8, body + 12) === "vide") out.video = true;
      at += size;
    }
  };
  walk(0, b.length, 0);
  return out;
}

const MP3_RATES = [
  [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], // MPEG 1, layer III
  [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], // MPEG 2 and 2.5, layer III
];

/** An MP3's length from its first frame's bit rate (exact for constant bit rates, near for variable ones). */
function mp3Info(b: Uint8Array): { duration?: number } | undefined {
  let at = 0;
  // An ID3v2 tag first: its size is four 7-bit bytes.
  if (ascii(b, 0, 3) === "ID3" && b.length > 10) at = 10 + ((b[6]! << 21) | (b[7]! << 14) | (b[8]! << 7) | b[9]!);
  if (at + 4 > b.length || b[at] !== 0xff || (b[at + 1]! & 0xe0) !== 0xe0) return undefined;
  const version = (b[at + 1]! >> 3) & 3;
  const layer = (b[at + 1]! >> 1) & 3;
  if (layer !== 1 || version === 1) return undefined; // layer III, and not the reserved version
  const kbps = MP3_RATES[version === 3 ? 0 : 1]![b[at + 2]! >> 4];
  return { duration: kbps ? round(((b.length - at) * 8) / (kbps * 1000)) : undefined };
}

function wavDuration(b: Uint8Array): number | undefined {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let at = 12;
  let byteRate = 0;
  while (at + 8 <= b.length) {
    const id = ascii(b, at, at + 4);
    const size = view.getUint32(at + 4, true);
    if (id === "fmt " && at + 20 <= b.length) byteRate = view.getUint32(at + 16, true);
    if (id === "data") return byteRate ? round(Math.min(size, b.length - at - 8) / byteRate) : undefined;
    at += 8 + size + (size & 1);
  }
  return undefined;
}

function flacDuration(b: Uint8Array): number | undefined {
  if (b.length < 26) return undefined;
  const rate = (b[18]! << 12) | (b[19]! << 4) | (b[20]! >> 4);
  const samples = (b[21]! & 0x0f) * 2 ** 32 + new DataView(b.buffer, b.byteOffset).getUint32(22);
  return rate ? round(samples / rate) : undefined;
}

/** An Ogg file's length: the last page's position, in samples (48 kHz for Opus, the stated rate for Vorbis). */
function oggDuration(b: Uint8Array): number | undefined {
  const head = ascii(b, 0, Math.min(b.length, 200));
  const vorbis = head.indexOf("\x01vorbis");
  const rate = head.includes("OpusHead") ? 48000 : vorbis >= 0 ? new DataView(b.buffer, b.byteOffset).getUint32(vorbis + 12, true) : 0;
  const tail = ascii(b, Math.max(0, b.length - 65536), b.length);
  const last = tail.lastIndexOf("OggS");
  if (!rate || last < 0) return undefined;
  const at = Math.max(0, b.length - 65536) + last + 6;
  if (at + 8 > b.length) return undefined;
  return round(Number(new DataView(b.buffer, b.byteOffset).getBigUint64(at, true)) / rate);
}

/** A WebM (Matroska) file: whether it has a picture (a video track), and its length when the header says. */
function webmInfo(b: Uint8Array): { video: boolean; duration?: number } {
  const head = b.subarray(0, Math.min(b.length, 1024 * 1024));
  let video = false;
  let duration: number | undefined;
  for (let i = 0; i + 3 < head.length; i++) {
    // TrackType (0x83), one byte long (0x81), 1 = video.
    if (head[i] === 0x83 && head[i + 1] === 0x81 && head[i + 2] === 0x01) video = true;
    // Duration (0x4489): a float of 4 or 8 bytes, in milliseconds at the default time scale.
    if (duration === undefined && head[i] === 0x44 && head[i + 1] === 0x89 && (head[i + 2] === 0x84 || head[i + 2] === 0x88)) {
      const view = new DataView(head.buffer, head.byteOffset + i + 3);
      duration = round((head[i + 2] === 0x84 ? view.getFloat32(0) : view.getFloat64(0)) / 1000);
    }
  }
  return { video, duration };
}

/** Audio or video, from the bytes. */
function sniffAudioVideo(b: Uint8Array): Sniffed | undefined {
  if (b.length < 12) return undefined;
  if (ascii(b, 4, 8) === "ftyp") {
    const brand = ascii(b, 8, 12);
    const info = mp4Info(b);
    const { video, ...rest } = info;
    if (video) return { kind: "video", type: brand === "qt  " ? "video/quicktime" : "video/mp4", ...rest };
    return { kind: "audio", type: "audio/mp4", ...(rest.duration ? { duration: rest.duration } : {}) };
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    const { video, duration } = webmInfo(b);
    return { kind: video ? "video" : "audio", type: video ? "video/webm" : "audio/webm", ...(duration ? { duration } : {}) };
  }
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WAVE") return { kind: "audio", type: "audio/wav", ...(wavDuration(b) ? { duration: wavDuration(b) } : {}) };
  if (ascii(b, 0, 4) === "fLaC") return { kind: "audio", type: "audio/flac", ...(flacDuration(b) ? { duration: flacDuration(b) } : {}) };
  if (ascii(b, 0, 4) === "OggS") return { kind: "audio", type: "audio/ogg", ...(oggDuration(b) ? { duration: oggDuration(b) } : {}) };
  const mp3 = mp3Info(b);
  if (mp3) return { kind: "audio", type: "audio/mpeg", ...(mp3.duration ? { duration: mp3.duration } : {}) };
  // AAC in ADTS frames: a 12-bit sync word and layer 0.
  if (b[0] === 0xff && (b[1]! & 0xf6) === 0xf0) return { kind: "audio", type: "audio/aac" };
  return undefined;
}

/** Document formats and their media types. */
export const DOCUMENT_FORMATS: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  eml: "message/rfc822",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  markdown: "text/markdown",
  html: "text/html",
  json: "application/json",
  text: "text/plain",
};

/** Text formats by file extension: the bytes say a file is text, the name says which kind. */
const TEXT_EXTENSIONS: Record<string, string> = {
  csv: "csv", tsv: "tsv", tab: "tsv", md: "markdown", markdown: "markdown", html: "html", htm: "html", xhtml: "html",
  json: "json", txt: "text", text: "text", log: "text", eml: "eml",
};

const document = (format: string, extra: Partial<Sniffed> = {}): Sniffed => ({ kind: "document", type: DOCUMENT_FORMATS[format]!, format, ...extra });

/** Whether the start of the bytes reads as an email: header lines, among them ones every email has. */
function looksLikeEmail(head: string): boolean {
  const block = head.split(/\r?\n\r?\n/)[0]!;
  const lines = block.split(/\r?\n/).filter((l) => !/^[ \t]/.test(l));
  if (lines.length < 2 || !lines.every((l) => /^[A-Za-z][\w-]*:/.test(l))) return false;
  const names = new Set(lines.map((l) => l.slice(0, l.indexOf(":")).toLowerCase()));
  return names.has("from") && (names.has("subject") || names.has("date") || names.has("message-id") || names.has("received"));
}

/** A text file's kind, from what is in it, when its name doesn't say. */
function textFormat(text: string): string {
  if (looksLikeEmail(text.slice(0, 16384))) return "eml";
  const t = text.trimStart();
  if (/^(<!doctype html|<html[\s>])/i.test(t)) return "html";
  if (/^[[{]/.test(t)) {
    try {
      JSON.parse(text);
      return "json";
    } catch {}
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 6);
  const same = (sep: string) => lines.length >= 2 && lines.every((l) => l.split(sep).length === lines[0]!.split(sep).length) && lines[0]!.split(sep).length > 1;
  if (same("\t")) return "tsv";
  if (same(",")) return "csv";
  return "text";
}

/** What the bytes are, from the bytes: a claimed type is never believed. A name only tells text formats apart. */
export function sniff(bytes: Uint8Array, name?: string): Sniffed | undefined {
  const b = bytes;
  if (b.length >= 24 && b[0] === 0x89 && ascii(b, 1, 4) === "PNG") return { kind: "image", type: "image/png", width: u32(b, 16), height: u32(b, 20) };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: "image", type: "image/jpeg", ...jpegSize(b) };
  if (b.length >= 10 && (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a")) return { kind: "image", type: "image/gif", width: u16le(b, 6), height: u16le(b, 8) };
  if (b.length >= 16 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return { kind: "image", type: "image/webp", ...webpSize(b) };
  const av = sniffAudioVideo(b);
  if (av) return av;
  // The header may follow a few bytes of junk.
  if (ascii(b, 0, Math.min(b.length, 1024)).includes("%PDF-")) {
    const pages = pdfPages(b);
    return document("pdf", pages ? { pages } : {});
  }
  // Word and PowerPoint files are zips of XML; which one is in the listing. Other zips (Excel, archives) aren't read.
  if (b.length >= 4 && ascii(b, 0, 4) === "PK\x03\x04") {
    const names = zipNames(b);
    if (names?.includes("word/document.xml")) return document("docx");
    if (names?.includes("ppt/presentation.xml")) {
      const slides = names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length;
      return document("pptx", slides ? { pages: slides } : {});
    }
    return undefined;
  }
  // Text: no NUL bytes, and valid UTF-8 (a character cut off at the end of the sample is fine).
  const head = b.subarray(0, 65536);
  if (head.includes(0)) return undefined;
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(head, { stream: b.length > head.length });
  } catch {
    return undefined;
  }
  if (!text.trim()) return undefined;
  const ext = name?.toLowerCase().match(/\.([a-z]+)$/)?.[1];
  return document((ext && TEXT_EXTENSIONS[ext]) || textFormat(b.length > head.length ? text : new TextDecoder().decode(b)));
}

// ── Where the bytes live ──

export interface BlobStore {
  put(sha256: string, bytes: Uint8Array): Promise<void>;
  /** The bytes, or undefined when this store doesn't have them. */
  get(sha256: string): Promise<Uint8Array | undefined>;
}

export class MemoryBlobStore implements BlobStore {
  private blobs = new Map<string, Uint8Array>();
  async put(sha256: string, bytes: Uint8Array) {
    this.blobs.set(sha256, bytes);
  }
  async get(sha256: string) {
    return this.blobs.get(sha256);
  }
}

/** One file per blob, named by its hash: `<dir>/<sha256>`. */
export class FileBlobStore implements BlobStore {
  constructor(readonly dir = ".halo/blobs") {}
  private path(sha256: string) {
    if (!HASH.test(sha256)) throw new MediaError(`"${sha256.slice(0, 80)}" is not a media hash`, "MEDIA_UNKNOWN");
    return join(this.dir, sha256);
  }
  async put(sha256: string, bytes: Uint8Array) {
    const path = this.path(sha256);
    if (existsSync(path)) return;
    mkdirSync(this.dir, { recursive: true });
    // Written beside it and moved into place, so a reader never sees half a file.
    const part = `${path}.${process.pid}.part`;
    writeFileSync(part, bytes);
    renameSync(part, path);
  }
  async get(sha256: string) {
    const path = this.path(sha256);
    return existsSync(path) ? new Uint8Array(readFileSync(path)) : undefined;
  }
}

export function sha256Of(bytes: Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
}

/**
 * Store bytes and return their reference. `want` is the kind the place they are going
 * declares (an `Image` parameter, say); bytes of another kind are refused.
 */
export async function mint(store: BlobStore, bytes: Uint8Array, info: { name?: string; want?: MediaKind } = {}): Promise<MediaRef> {
  const what = info.name ? `"${safeName(info.name) ?? "file"}"` : "The file";
  if (bytes.length > MAX_MEDIA_BYTES) throw new MediaError(`${what} is ${megabytes(bytes.length)}; the most Halo takes is ${megabytes(MAX_MEDIA_BYTES)}`, "MEDIA_TOO_LARGE");
  const found = sniff(bytes, info.name);
  const accepted = "PNG, JPEG, GIF and WebP images; PDF, Word, PowerPoint, email and text documents (CSV, Markdown, HTML, JSON, plain text)";
  if (!found) throw new MediaError(`${what} is not a kind of file Halo reads (it takes ${accepted})`, "MEDIA_TYPE");
  if (info.want && found.kind !== info.want) throw new MediaError(`${what} is ${aKind(found.kind)} (${found.type}), where ${aKind(info.want)} is expected`, "MEDIA_TYPE");
  if (bytes.length > MAX_BYTES[found.kind]) throw new MediaError(`${what} is ${megabytes(bytes.length)}; the most Halo takes for ${aKind(found.kind)} is ${megabytes(MAX_BYTES[found.kind])}`, "MEDIA_TOO_LARGE");
  const sha256 = sha256Of(bytes);
  await store.put(sha256, bytes);
  const name = safeName(info.name);
  const { kind, ...rest } = found;
  return { $media: kind, sha256, ...rest, size: bytes.length, ...(name ? { name } : {}) };
}

export const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;

/**
 * A high estimate of what a media value costs a model to read, in tokens. Providers count
 * differently (by area, by tiles, by page); this is at or above each of them for ordinary sizes.
 */
export function mediaTokens(ref: MediaRef): number {
  if (ref.$media === "document") return (ref.pages ?? Math.max(1, Math.ceil(ref.size / 50_000))) * 4_600;
  // Sent as itself (to a model that takes it): Gemini counts about 32 tokens a second of audio, about 300 of video.
  // Without a length, assume a generous one from the size (128 kbit/s audio, 2 Mbit/s video).
  if (ref.$media === "audio") return Math.ceil((ref.duration ?? ref.size / 16_000) * 40);
  if (ref.$media === "video") return Math.ceil((ref.duration ?? ref.size / 250_000) * 320);
  if (!ref.width || !ref.height) return 3_000;
  return Math.min(6_500, Math.max(300, Math.ceil((ref.width * ref.height) / 750)));
}

/**
 * A value with the files in it stored and replaced by references: `MediaBytes` anywhere, and
 * the shapes tools have long returned images in (`{ mimeType, base64 }`, and MCP's
 * `{ type: "image", mimeType, data }`). Bytes that aren't an image or a PDF are left as they
 * were. Only what changed is copied.
 */
export async function adoptMedia(value: unknown, store: (bytes: Uint8Array, name?: string) => Promise<MediaRef>, options: { shapes?: boolean } = {}): Promise<unknown> {
  const shapes = options.shapes ?? true;
  const seen = new WeakSet<object>();
  const walk = async (v: unknown, depth: number): Promise<unknown> => {
    if (v instanceof MediaBytes) return store(v.bytes, v.name);
    if (v === null || typeof v !== "object" || depth > 100 || seen.has(v) || ArrayBuffer.isView(v)) return v;
    seen.add(v);
    if (Array.isArray(v)) {
      const items = await Promise.all(v.map((x) => walk(x, depth + 1)));
      return items.some((x, i) => x !== v[i]) ? items : v;
    }
    const o = v as Record<string, unknown>;
    const encoded = typeof o.base64 === "string" ? o.base64 : (o.type === "image" || o.type === "document") && typeof o.data === "string" ? o.data : undefined;
    if (shapes && encoded !== undefined && (typeof o.mimeType === "string" || typeof o.mime_type === "string")) {
      const bytes = base64Bytes(encoded);
      // These shapes have only ever held images (and the odd PDF): other bytes in them are left as they are.
      const found = bytes && sniff(bytes);
      if (bytes && found && (found.kind === "image" || found.format === "pdf")) return store(bytes, typeof o.name === "string" ? o.name : typeof o.filename === "string" ? o.filename : undefined);
    }
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(o)) {
      const y = await walk(x, depth + 1);
      if (y !== x) changed = true;
      out[k] = y;
    }
    return changed ? out : v;
  };
  return walk(value, 0);
}

/**
 * The bytes at an https URL a caller gave as an image or document. The host must resolve only
 * to public addresses (not this machine, its network, or a cloud's metadata service), redirects
 * are not followed, and at most MAX_MEDIA_BYTES are read whatever the server says.
 */
export async function fetchMedia(
  text: string,
  options: {
    fetch: typeof globalThis.fetch;
    lookup?: (host: string) => Promise<string[]>;
    signal?: AbortSignal;
    /** How many redirects to follow (each checked like the first). Default none. */
    redirects?: number;
    /** An Authorization header sent only to this host (never to where it redirects). */
    auth?: { host: string; header: string };
  },
): Promise<{ bytes: Uint8Array; name?: string }> {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new MediaError(`"${text.slice(0, 200)}" is not a URL`, "MEDIA_INPUT");
  }
  if (url.protocol !== "https:") throw new MediaError(`Only https URLs are fetched, not ${url.protocol}//${url.host}`, "MEDIA_INPUT");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const lookup = options.lookup ?? (async (h: string) => (await dnsLookup(h, { all: true })).map((a) => a.address));
  let addresses: string[];
  try {
    addresses = isIP(host) ? [host] : await lookup(host);
  } catch {
    throw new MediaError(`Could not find ${url.host}`, "MEDIA_INPUT");
  }
  if (!addresses.length || addresses.some(privateAddress)) throw new MediaError(`${url.host} is a private address; Halo fetches files only from public ones`, "MEDIA_INPUT");
  const auth: Record<string, string> = options.auth && url.hostname === options.auth.host ? { Authorization: options.auth.header } : {};
  const res = await options.fetch(url, { redirect: "manual", headers: { "User-Agent": "Halo-Media/1.0", ...auth }, signal: options.signal ?? AbortSignal.timeout(30_000) });
  if (res.status >= 300 && res.status < 400) {
    const next = res.headers.get("location");
    if (!options.redirects || !next) throw new MediaError(`${url.href} redirects elsewhere; give the final address`, "MEDIA_INPUT");
    return fetchMedia(new URL(next, url).href, { ...options, redirects: options.redirects - 1 });
  }
  if (!res.ok) throw new MediaError(`Could not fetch ${url.href} (${res.status})`, "MEDIA_INPUT");
  if (Number(res.headers.get("content-length") ?? 0) > MAX_MEDIA_BYTES) throw new MediaError(`${url.href} is over ${megabytes(MAX_MEDIA_BYTES)}`, "MEDIA_TOO_LARGE");
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (res.body) {
    for await (const chunk of res.body) {
      total += chunk.length;
      if (total > MAX_MEDIA_BYTES) throw new MediaError(`${url.href} is over ${megabytes(MAX_MEDIA_BYTES)}`, "MEDIA_TOO_LARGE");
      chunks.push(chunk);
    }
  }
  return { bytes: new Uint8Array(Buffer.concat(chunks)), name: decodeURIComponent(url.pathname.split("/").at(-1) ?? "") || undefined };
}

const YOUTUBE = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})(?:[?&#][^\s]*)?$/;

/** A YouTube link as a video value (no bytes: Gemini watches it from YouTube), or undefined when the text isn't one. */
export function youtubeRef(text: string): MediaRef | undefined {
  const id = YOUTUBE.exec(text.trim())?.[1];
  if (!id) return undefined;
  const url = `https://www.youtube.com/watch?v=${id}`;
  return { $media: "video", sha256: sha256Of(new TextEncoder().encode(url)), type: "video/youtube", size: 0, name: `youtube-${id}`, url };
}

/** A `data:` URI's bytes, or undefined when the text isn't one. */
export function dataUriBytes(text: string): Uint8Array | undefined {
  const head = /^data:[\w.+-]+\/[\w.+-]+(?:;[\w-]+=[^;,]*)*;base64,/.exec(text.slice(0, 200));
  if (!head) return undefined;
  return new Uint8Array(Buffer.from(text.slice(head[0].length), "base64"));
}

/** Base64 as providers return it (no data: prefix), or undefined when the text isn't base64. */
export function base64Bytes(text: string): Uint8Array | undefined {
  if (text.length < 8 || !/^[A-Za-z0-9+/]+={0,2}$/.test(text.replace(/\s+/g, ""))) return undefined;
  return new Uint8Array(Buffer.from(text, "base64"));
}

// ── Clearing out stored files ──

export interface BlobUsage {
  /** Every stored file, with its size and when it was stored. */
  blobs: Array<{ sha256: string; size: number; storedAt: Date; referenced: boolean }>;
  /** Removed by a prune (or that would be, on a dry run). */
  removed: string[];
  freedBytes: number;
}

const HASHES = /[0-9a-f]{64}/g;

/**
 * The stored files under `<stateDir>/blobs`, and with `prune`, the removal of those nothing in
 * the state folder mentions any more: no paused or running run, checkpoint, recording, thread,
 * or telemetry row (so Studio can still show an old run's files while its telemetry is kept).
 * A file stored within `graceMs` (default an hour) is kept regardless: a run may have just made
 * it and not yet written anything that mentions it.
 *
 * It reads every file in the folder looking for hashes, so it is slow on a large telemetry
 * database; it is meant to be run now and then, not on every run.
 */
export async function blobUsage(stateDir: string, options: { prune?: boolean; dryRun?: boolean; graceMs?: number; now?: number } = {}): Promise<BlobUsage> {
  const { readdir, stat, unlink } = await import("node:fs/promises");
  const dir = join(stateDir, "blobs");
  const names = existsSync(dir) ? (await readdir(dir)).filter((n) => HASH.test(n)) : [];
  const usage: BlobUsage = { blobs: [], removed: [], freedBytes: 0 };
  if (!names.length) return usage;

  const mentioned = new Set<string>();
  const scan = async (path: string) => {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const full = join(path, entry.name);
      if (entry.isDirectory()) {
        // Installed packages and a pushed project aren't state.
        if (full === dir || entry.name === "packages" || entry.name === "project") continue;
        await scan(full);
      } else if (entry.isFile()) {
        // Read in pieces, overlapping by one hash's length so none is split across two.
        const file = Bun.file(full);
        const step = 8 * 1024 * 1024;
        for (let at = 0; at < file.size; at += step) {
          const text = new TextDecoder("latin1" as "utf-8").decode(await file.slice(at, Math.min(file.size, at + step + 63)).arrayBuffer());
          for (const m of text.matchAll(HASHES)) mentioned.add(m[0]);
        }
      }
    }
  };
  await scan(stateDir);

  const now = options.now ?? Date.now();
  const grace = options.graceMs ?? 60 * 60 * 1000;
  for (const sha256 of names.sort()) {
    const info = await stat(join(dir, sha256));
    const referenced = mentioned.has(sha256);
    usage.blobs.push({ sha256, size: info.size, storedAt: info.mtime, referenced });
    if (options.prune && !referenced && now - info.mtimeMs > grace) {
      usage.removed.push(sha256);
      usage.freedBytes += info.size;
      if (!options.dryRun) await unlink(join(dir, sha256));
    }
  }
  return usage;
}

/** A value with each media reference in it replaced by what `fn` makes of it. Only what changed is copied. */
export async function mapMedia(value: unknown, fn: (ref: MediaRef) => Promise<unknown>): Promise<unknown> {
  const walk = async (v: unknown, depth: number): Promise<unknown> => {
    if (isMediaRef(v)) return fn(v);
    if (v === null || typeof v !== "object" || depth > 100) return v;
    if (Array.isArray(v)) {
      const items = await Promise.all(v.map((x) => walk(x, depth + 1)));
      return items.some((x, i) => x !== v[i]) ? items : v;
    }
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      const y = await walk(x, depth + 1);
      if (y !== x) changed = true;
      out[k] = y;
    }
    return changed ? out : v;
  };
  return walk(value, 0);
}

/**
 * Files carried inline between two Halo servers (a hosted pipeline's answer): each is
 * `{ "$media": …, "data": "<base64>" }`. Only the bytes are believed; the runtime that receives
 * them reads their type from the bytes again and stores them.
 */
export function inlineToBytes(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== "object" || depth > 100) return value;
  if (Array.isArray(value)) return value.map((x) => inlineToBytes(x, depth + 1));
  const o = value as Record<string, unknown>;
  if (MEDIA_KINDS.includes(o.$media as MediaKind) && typeof o.data === "string") {
    const bytes = base64Bytes(o.data);
    if (bytes) return new MediaBytes(bytes, { name: typeof o.name === "string" ? o.name : undefined });
  }
  return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, inlineToBytes(x, depth + 1)]));
}

// ── Files in outgoing requests ──

/** How a request carries a file a tool sends: as a `data:` URI (the default) or bare base64. */
export type InlineAs = "dataUri" | "base64";

/** A value ready for a JSON request: each file in it replaced by its bytes, inline. */
export async function inlineFiles(value: unknown, read: (ref: MediaRef) => Promise<Uint8Array>, as: InlineAs = "dataUri"): Promise<unknown> {
  return mapMedia(value, async (ref) => {
    const b64 = Buffer.from(await read(ref)).toString("base64");
    return as === "base64" ? b64 : `data:${ref.type};base64,${b64}`;
  });
}

const EXTENSIONS: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp",
  "application/pdf": "pdf", "text/csv": "csv", "text/tab-separated-values": "tsv", "text/markdown": "md", "text/html": "html", "application/json": "json", "text/plain": "txt", "message/rfc822": "eml",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx", "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "audio/mpeg": "mp3", "audio/wav": "wav", "audio/flac": "flac", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/aac": "aac", "audio/webm": "webm",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
};

/**
 * A file's name for an upload: its own, or one made from its kind. It always ends in the
 * extension of its real type, since some services (OpenAI's transcription) read the format
 * from the name.
 */
export function uploadName(ref: MediaRef): string {
  const ext = EXTENSIONS[ref.type] ?? "bin";
  const name = safeName(ref.name) ?? `${ref.$media}-${ref.sha256.slice(0, 6)}`;
  return name.toLowerCase().endsWith(`.${ext}`) ? name : `${name.replace(/\.[A-Za-z0-9]{1,5}$/, "")}.${ext}`;
}

/**
 * A multipart/form-data body: each top-level file (or list of files) is a file part, with its
 * bytes, type and name; any other value is a field (objects and lists as JSON, with files inside
 * them inline).
 */
export async function multipartBody(fields: Record<string, unknown>, read: (ref: MediaRef) => Promise<Uint8Array>): Promise<FormData> {
  const form = new FormData();
  const file = async (key: string, ref: MediaRef) => form.append(key, new Blob([(await read(ref)) as Uint8Array<ArrayBuffer>], { type: ref.type }), uploadName(ref));
  for (const [key, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    if (isMediaRef(v)) await file(key, v);
    else if (Array.isArray(v) && v.length && v.every(isMediaRef)) for (const ref of v) await file(key, ref);
    else if (typeof v === "object") form.append(key, JSON.stringify(await inlineFiles(v, read)));
    else form.append(key, String(v));
  }
  return form;
}

/**
 * In the arguments of a tool call a model chose, a string that is exactly a file's label
 * (`[image: dent.jpg #3fa2c1]`) or its short id (`#3fa2c1`) is that file: a model can name a
 * file it was shown, but can't write one. Only files the run holds count; a short id two of
 * them share is refused, so the model is asked to say which.
 */
export function filesFromLabels(value: unknown, held: MediaRef[]): unknown {
  const LABEL = /^\[(?:image|document|audio|video): (?:.* )?#([0-9a-f]{6})\]$|^#([0-9a-f]{6})$/;
  const walk = (v: unknown, depth: number): unknown => {
    if (typeof v === "string") {
      const m = LABEL.exec(v.trim());
      if (!m) return v;
      const id = m[1] ?? m[2]!;
      const found = held.filter((f) => f.sha256.startsWith(id));
      if (found.length > 1) throw new MediaError(`"${v}" could be ${found.map(mediaLabel).join(" or ")}; give the whole label`, "MEDIA_UNKNOWN");
      return found[0] ?? v;
    }
    if (v === null || typeof v !== "object" || depth > 50 || isMediaRef(v)) return v;
    if (Array.isArray(v)) return v.map((x) => walk(x, depth + 1));
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, depth + 1)]));
  };
  return walk(value, 0);
}
