/**
 * Documents: pull the text out of a file or URL.
 *
 *   tool Docs : Documents(root: "./inbox")
 *     extract(path | url)  →  { source, type, text, pages?, rows?, data? }
 *
 * Handles plain text and Markdown, HTML (tags, scripts and styles removed),
 * CSV/TSV (parsed into `rows`, one record per line, keyed by the header),
 * JSON (parsed into `data`), Word .docx and PDF. Nothing to install: .docx is
 * read with a small built-in zip reader, and PDF uses `pdftotext` when it's on
 * PATH, else a best-effort built-in extractor (see pdfText).
 *
 * A path is relative to `root:` (default: the current directory) and can't
 * leave it, the same way Workspace paths can't. An http(s) URL is fetched.
 */

import { inflateSync } from "node:zlib";
import { lstatSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { HaloError, HttpError } from "../errors.js";
import type { ToolCall, ToolProvider } from "../tools.js";
import { intArg, need, unknownMethod } from "./common.js";
import { readZipEntry } from "../zip.js";
import { parseMessage } from "../mail/mime.js";
import { isMediaRef, mediaLabel } from "../media.js";
import { confine, workspaceRoot } from "./workspace.js";

/** Largest document read (bytes), and largest file inflated out of a zip or PDF stream. */
const MAX_BYTES = 25_000_000;
const MAX_INFLATED = 50_000_000;
const DEFAULT_MAX_CHARS = 200_000;
const MAX_ROWS = 10_000;

export type DocType = "text" | "markdown" | "html" | "csv" | "tsv" | "json" | "docx" | "pptx" | "eml" | "pdf";

const BY_EXTENSION: Record<string, DocType> = {
  ".txt": "text", ".text": "text", ".log": "text",
  ".md": "markdown", ".markdown": "markdown",
  ".html": "html", ".htm": "html", ".xhtml": "html",
  ".csv": "csv", ".tsv": "tsv",
  ".json": "json",
  ".docx": "docx",
  ".pptx": "pptx",
  ".eml": "eml",
  ".pdf": "pdf",
};

function docError(call: ToolCall, message: string): HaloError {
  return new HaloError(`${call.tool.name}.${call.method}: ${message}`, { code: "TOOL_ARGUMENT" });
}

/** Pick a type: an explicit `type:`, the extension, the content type, then the first bytes. */
function detect(name: string, contentType: string, bytes: Uint8Array): DocType {
  const ext = BY_EXTENSION[extname(name).toLowerCase()];
  if (ext) return ext;
  const ct = contentType.toLowerCase();
  if (ct.includes("pdf")) return "pdf";
  if (ct.includes("wordprocessingml")) return "docx";
  if (ct.includes("presentationml")) return "pptx";
  if (ct.includes("rfc822")) return "eml";
  if (ct.includes("html")) return "html";
  if (ct.includes("csv")) return "csv";
  if (ct.includes("tab-separated")) return "tsv";
  if (ct.includes("json")) return "json";
  const head = Buffer.from(bytes.subarray(0, 8)).toString("latin1");
  if (head.startsWith("%PDF")) return "pdf";
  if (head.startsWith("PK\x03\x04")) return "docx";
  if (/^\s*</.test(head)) return "html";
  return "text";
}

// ── HTML ──

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function htmlText(html: string): string {
  return decodeEntities(
    html
      .replace(/<head[\s\S]*?<\/head>/i, " ")
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article|header|footer|blockquote|pre)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── CSV / TSV ──

/** RFC 4180-style parsing: quoted fields may hold the delimiter, newlines, and "" for a quote. */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  for (; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** Rows as records keyed by the header line. Blank or repeated headers become column_N. */
export function rowsToRecords(rows: string[][]): Record<string, string>[] {
  const [header = [], ...body] = rows;
  const seen = new Set<string>();
  const keys = header.map((h, i) => {
    let k = h.trim() || `column_${i + 1}`;
    if (seen.has(k)) k = `${k}_${i + 1}`;
    seen.add(k);
    return k;
  });
  return body.map((r) => {
    const rec: Record<string, string> = {};
    const width = Math.max(keys.length, r.length);
    for (let i = 0; i < width; i++) rec[keys[i] ?? `column_${i + 1}`] = r[i] ?? "";
    return rec;
  });
}

// ── Word and PowerPoint (zip archives of XML) ──

export { readZipEntry } from "../zip.js";

/** The text of a .docx: word/document.xml with tags removed, one line per paragraph. */
export function docxText(bytes: Uint8Array): string {
  const xml = readZipEntry(bytes, "word/document.xml");
  if (!xml) throw new Error("no word/document.xml (not a Word document?)");
  return decodeEntities(
    new TextDecoder()
      .decode(xml)
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:(br|cr)\b[^>]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The text of a PowerPoint deck: each slide in order, its text and its speaker notes. */
export function pptxText(bytes: Uint8Array): { text: string; slides: number } {
  const read = (name: string) => {
    const b = readZipEntry(bytes, name);
    return b ? new TextDecoder().decode(b) : undefined;
  };
  const runs = (xml: string) =>
    decodeEntities(
      xml
        .replace(/<a:br\b[^>]*\/>/g, "\n")
        .replace(/<\/a:p>/g, "\n")
        .replace(/<(?!\/?a:t\b)[^>]+>/g, "")
        .replace(/<\/?a:t\b[^>]*>/g, ""),
    )
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  // Slides in the order the deck shows them: presentation.xml lists their relationship ids.
  const order = [...(read("ppt/presentation.xml") ?? "").matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)].map((m) => m[1]!);
  const rels = new Map([...(read("ppt/_rels/presentation.xml.rels") ?? "").matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g)].map((m) => [m[1]!, m[2]!.replace(/^\/?(ppt\/)?/, "")]));
  let files = order.map((id) => rels.get(id)).filter((t): t is string => !!t && /^slides\/slide\d+\.xml$/.test(t));
  if (!files.length) {
    // No listing: slide1, slide2, ... while they exist.
    for (let n = 1; n < 2000 && read(`ppt/slides/slide${n}.xml`) !== undefined; n++) files.push(`slides/slide${n}.xml`);
  }
  const out: string[] = [];
  files.forEach((file, i) => {
    const slide = runs(read(`ppt/${file}`) ?? "");
    const rel = read(`ppt/slides/_rels/${file.split("/")[1]}.rels`) ?? "";
    const notesFile = /Target="\.\.\/(notesSlides\/notesSlide\d+\.xml)"/.exec(rel)?.[1];
    // A notes page also holds the slide's image and number; its body text is what the speaker wrote.
    const notes = notesFile ? runs(read(`ppt/${notesFile}`) ?? "").replace(/^\d+$/m, "").trim() : "";
    out.push(`Slide ${i + 1}:\n${slide || "(no text)"}${notes ? `\nNotes: ${notes}` : ""}`);
  });
  return { text: out.join("\n\n"), slides: files.length };
}


// ── PDF ──

/** Decode a PDF literal string's escapes: \n \r \t \b \f \( \) \\ \ddd, and line continuations. */
function pdfLiteral(s: string): string {
  return s.replace(/\\(\r\n|[\r\n]|[0-7]{1,3}|.)/g, (_, e: string) => {
    if (/^[0-7]+$/.test(e)) return String.fromCharCode(parseInt(e, 8) & 0xff);
    return ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" } as Record<string, string>)[e] ?? (/^[\r\n]/.test(e) ? "" : e);
  });
}

/** Decode a hex string: UTF-16BE with a byte-order mark, else one byte per character. */
function pdfHex(hex: string): string {
  const clean = hex.replace(/\s+/g, "");
  const bytes = new Uint8Array(Math.ceil(clean.length / 2));
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2).padEnd(2, "0"), 16);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let s = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) s += String.fromCharCode((bytes[i]! << 8) | bytes[i + 1]!);
    return s;
  }
  return Buffer.from(bytes).toString("latin1");
}

/** Text shown by one content stream's text operators (Tj, TJ, ' and "), with line breaks at moves. */
function contentText(content: string): string {
  let out = "";
  // Strings (literal with balanced parens, or hex), arrays, and operators, in order.
  const token = /\((?:\\[\s\S]|[^\\()]|\((?:\\[\s\S]|[^\\()])*\))*\)|<[0-9a-fA-F\s]*>|\[|\]|-?\d*\.?\d+|\/[^\s\/\[\]()<>]+|[A-Za-z'"*]+/g;
  let pending: string[] = [];
  let inArray = false;
  for (const m of content.matchAll(token)) {
    const t = m[0];
    if (t[0] === "(") pending.push(pdfLiteral(t.slice(1, -1)));
    else if (t[0] === "<") pending.push(pdfHex(t.slice(1, -1)));
    else if (t === "[") inArray = true;
    else if (t === "]") inArray = false;
    else if (/^-?\d*\.?\d+$/.test(t)) {
      // A large negative kerning inside a TJ array is a word gap.
      if (inArray && Number(t) < -200) pending.push(" ");
    } else if (t === "Tj" || t === "TJ") {
      out += pending.join("");
      pending = [];
    } else if (t === "'" || t === '"') {
      out += `\n${pending.join("")}`;
      pending = [];
    } else if (t === "Td" || t === "TD" || t === "T*" || t === "Tm") {
      if (out && !out.endsWith("\n")) out += "\n";
      pending = [];
    } else if (t === "ET") {
      if (out && !out.endsWith("\n")) out += "\n";
      pending = [];
    } else if (!inArray) pending = [];
  }
  return out;
}

/**
 * Best-effort PDF text with no dependencies: inflate each FlateDecode stream,
 * then read the strings shown by its text operators. It works for simple PDFs
 * (most generated reports) but not for text drawn with embedded fonts that use
 * custom encodings (CID fonts usually come out as gibberish), scanned images,
 * encrypted files, or other filters (LZW, ASCII85), and text order follows the
 * file, not the page layout. Install poppler's `pdftotext` for real extraction.
 */
export function pdfText(bytes: Uint8Array): { text: string; pages: number } {
  const raw = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const latin = raw.toString("latin1");
  const pages = (latin.match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
  const parts: string[] = [];
  const stream = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  let inflated = 0;
  while ((m = stream.exec(latin))) {
    const start = m.index + m[0].length;
    const end = latin.indexOf("endstream", start);
    if (end < 0) break;
    const dict = latin.slice(Math.max(0, latin.lastIndexOf("<<", m.index) - 2000), m.index);
    const header = dict.slice(dict.lastIndexOf("obj") + 3);
    stream.lastIndex = end + 9;
    // Images, fonts and other binary streams carry no text operators.
    if (/\/Subtype\s*\/Image|\/Length1|\/FontFile|\/Type\s*\/XRef|\/Type\s*\/ObjStm/.test(header)) continue;
    let data: Uint8Array = raw.subarray(start, end);
    if (/\/FlateDecode/.test(header)) {
      try {
        data = inflateSync(data, { maxOutputLength: MAX_INFLATED - inflated, finishFlush: 2 /* Z_SYNC_FLUSH: tolerate a trailing EOL */ });
      } catch {
        continue;
      }
      inflated += data.length;
    } else if (/\/Filter/.test(header)) continue;
    const content = Buffer.from(data).toString("latin1");
    if (!/\bBT\b/.test(content)) continue;
    const text = contentText(content).trim();
    if (text) parts.push(text);
    if (inflated >= MAX_INFLATED) break;
  }
  return { text: parts.join("\n\n"), pages };
}

/** PDF text via poppler's pdftotext, if installed. Pages are separated by form feeds. */
async function pdftotext(call: ToolCall, bytes: Uint8Array): Promise<{ text: string; pages: number } | undefined> {
  const bin = Bun.which("pdftotext");
  if (!bin) return undefined;
  const dir = mkdtempSync(join(tmpdir(), "halo-pdf-"));
  try {
    const file = join(dir, "in.pdf");
    await Bun.write(file, bytes);
    const proc = Bun.spawn([bin, "-layout", "-enc", "UTF-8", file, "-"], { stdout: "pipe", stderr: "pipe", stdin: "ignore", env: { PATH: process.env.PATH ?? "" } });
    const kill = () => proc.kill();
    const timer = setTimeout(kill, 60_000);
    call.signal.addEventListener("abort", kill, { once: true });
    try {
      const [out, , code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
      if (code !== 0) return undefined;
      const pages = out.split("\f").filter((p, i, all) => i < all.length - 1 || p.trim());
      return { text: pages.map((p) => p.trimEnd()).join("\n\n").trim(), pages: pages.length };
    } finally {
      clearTimeout(timer);
      call.signal.removeEventListener("abort", kill);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Loading ──

async function load(call: ToolCall, source: string, fetch: typeof globalThis.fetch): Promise<{ name: string; contentType: string; bytes: Uint8Array }> {
  if (/^https?:\/\//i.test(source)) {
    let url: URL;
    try {
      url = new URL(source);
    } catch {
      throw docError(call, `"${source}" is not a URL`);
    }
    const res = await fetch(url, { headers: { "User-Agent": "Halo-Documents/1.0" }, signal: call.signal });
    if (!res.ok) throw new HttpError(`${call.tool.name} could not fetch ${url.href} (${res.status})`, res.status, (await res.text()).slice(0, 500));
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) throw docError(call, `${url.href} is over ${MAX_BYTES} bytes`);
    // Read the body in chunks so a server that lies about its length still can't send more than the cap.
    const chunks: Uint8Array[] = [];
    let total = 0;
    if (res.body) {
      for await (const chunk of res.body) {
        total += chunk.length;
        if (total > MAX_BYTES) throw docError(call, `${url.href} is over ${MAX_BYTES} bytes`);
        chunks.push(chunk);
      }
    }
    return { name: url.pathname, contentType: res.headers.get("content-type") ?? "", bytes: Buffer.concat(chunks) };
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(source)) throw docError(call, `only http(s) URLs and file paths are supported, not "${source}"`);
  const root = workspaceRoot(call, call.config("root") ?? call.config(0), false);
  const { abs, rel } = confine(call, root, source);
  if (!lstatSync(abs, { throwIfNoEntry: false })?.isFile()) throw docError(call, `no file "${rel}"`);
  const file = Bun.file(abs);
  if (file.size > MAX_BYTES) throw docError(call, `"${rel}" is over ${MAX_BYTES} bytes`);
  return { name: abs, contentType: "", bytes: new Uint8Array(await file.arrayBuffer()) };
}

export const documents: ToolProvider = async (call, services) => {
  if (!["extract", "read", "text"].includes(call.method)) unknownMethod(call, ["extract"]);
  const given0 = call.named.path ?? call.named.url ?? call.named.source ?? call.named.document ?? call.positional[0];
  // A Document value (or an image) the run holds: its bytes come from the run, not from a path or URL.
  const held = isMediaRef(given0) ? given0 : undefined;
  if (held && !services.media) throw docError(call, "this runtime can't read files a run holds");
  const source = held ? mediaLabel(held) : need(call, "a path or url", given0).trim();
  const maxChars = intArg(call, "maxChars", call.named.maxChars ?? call.config("maxChars"), DEFAULT_MAX_CHARS, 1, 10_000_000);
  const { name, contentType, bytes } = held ? { name: held.name ?? "", contentType: held.type, bytes: await services.media!(held) } : await load(call, source, services.fetch);
  const given = call.named.type;
  const type = typeof given === "string" && given ? (BY_EXTENSION[`.${given.toLowerCase()}`] ?? (given as DocType)) : detect(name, contentType, bytes);

  const cap = (text: string) => (text.length > maxChars ? { text: text.slice(0, maxChars), truncated: true } : { text });
  const utf8 = () => new TextDecoder().decode(bytes).replace(/^﻿/, "");

  try {
    switch (type) {
      case "text":
      case "markdown":
        return { source, type, ...cap(utf8()) };
      case "html": {
        const html = utf8();
        const title = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim());
        return { source, type, ...(title ? { title } : {}), ...cap(htmlText(html)) };
      }
      case "csv":
      case "tsv": {
        const text = utf8();
        const records = rowsToRecords(parseDelimited(text, type === "tsv" ? "\t" : ","));
        return { source, type, ...cap(text), rows: records.slice(0, MAX_ROWS), ...(records.length > MAX_ROWS ? { truncated: true, totalRows: records.length } : {}) };
      }
      case "json": {
        const text = utf8();
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error(`invalid JSON: ${(e as Error).message}`);
        }
        return { source, type, ...cap(text), data };
      }
      case "docx":
        return { source, type, ...cap(docxText(bytes)) };
      case "pptx": {
        const { text, slides } = pptxText(bytes);
        return { source, type, ...cap(text), slides };
      }
      case "eml": {
        const m = parseMessage(bytes);
        const { attachments, headers: _headers, ...message } = m;
        // Attachments are described here; their files are the run's when the message came in as a Document.
        return { source, type, ...message, attachments: attachments.map(({ file: _file, ...a }) => a), ...cap(m.text || (m.html ? htmlText(m.html) : "")) };
      }
      case "pdf": {
        const { text, pages } = (await pdftotext(call, bytes)) ?? pdfText(bytes);
        return { source, type, ...cap(text), pages };
      }
      default:
        throw new Error(`unknown type "${type}" (use text, markdown, html, csv, tsv, json, docx, pptx, eml or pdf)`);
    }
  } catch (e) {
    if (e instanceof HaloError) throw e;
    throw docError(call, `could not read ${type} "${source}": ${(e as Error).message}`);
  }
};
