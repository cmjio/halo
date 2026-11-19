/**
 * The runtime's own steps on the files a run holds, as a tool (`Media`) so each is recorded
 * like any tool call: mocked in `halo test`, answered from the recording in `halo replay`,
 * shown in Studio. Pipelines don't declare it; the runtime calls it when a model can't take a
 * file as it is.
 *
 *   Media.text(doc): a document's text (Word, PowerPoint, email, CSV, HTML, Markdown, JSON,
 *   plain text). A deck also gets a PDF made by LibreOffice when it is installed; an email
 *   gets its attachments as files.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ToolDeclaration } from "../../parser/types.js";
import { HaloError } from "../errors.js";
import { isMediaRef, MediaBytes, safeName, type MediaRef } from "../media.js";
import { parseMessage } from "../mail/mime.js";
import type { ProviderInfo, ToolProvider } from "../tools.js";
import { docxText, htmlText, pptxText } from "./documents.js";
import { transcribe, type TranscribeService } from "./transcribe.js";
import { digestVideo } from "./video.js";

export const MEDIA_PROVIDER = "Media";

/** The declaration the runtime calls `Media` through. */
export const MEDIA_TOOL: ToolDeclaration = { name: "Media", provider: MEDIA_PROVIDER, args: [], namedArgs: {}, argList: [] };

/** The most text of one document a prompt gets. */
export const MAX_DOCUMENT_CHARS = 200_000;

export const MEDIA_INFO: ProviderInfo = {
  description: "The runtime's own steps on files a run holds (not declared in pipelines).",
  methods: [
    { name: "text", description: "A document's text.", effect: "read" },
    { name: "transcript", description: "A recording's transcript.", effect: "external" },
    { name: "digest", description: "A video's transcript and frames.", effect: "external" },
  ],
};

/** The transcription service the runtime uses, and its key, or why there is none. */
export type Transcriber = { service: TranscribeService; apiKey: string; model?: string; baseUrl?: string } | { missing: string };

/** A PDF of a deck or a Word file made by LibreOffice, or undefined when it isn't installed or fails. */
export async function officeToPdf(bytes: Uint8Array, ext: "pptx" | "docx", signal?: AbortSignal): Promise<Uint8Array | undefined> {
  // PATH as it is now (Bun.which alone reads it as it was when the process started).
  const PATH = process.env.PATH ?? "";
  const soffice = Bun.which("soffice", { PATH }) ?? Bun.which("libreoffice", { PATH });
  if (!soffice) return undefined;
  const dir = mkdtempSync(join(tmpdir(), "halo-office-"));
  try {
    writeFileSync(join(dir, `in.${ext}`), bytes);
    // Its own profile, so a LibreOffice the person has open doesn't block it.
    const proc = Bun.spawn([soffice, `-env:UserInstallation=file://${join(dir, "profile")}`, "--headless", "--convert-to", "pdf", "--outdir", dir, join(dir, `in.${ext}`)], { stdout: "ignore", stderr: "ignore", signal });
    const timer = setTimeout(() => proc.kill(), 120_000);
    const code = await proc.exited;
    clearTimeout(timer);
    if (code !== 0) return undefined;
    return new Uint8Array(readFileSync(join(dir, "in.pdf")));
  } catch {
    return undefined;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export interface DocumentText {
  format: string;
  text: string;
  truncated?: true;
  /** A deck's slide count. */
  slides?: number;
  /** A PDF of a deck, made by LibreOffice when installed: becomes a file of the run. */
  rendition?: MediaBytes;
  /** An email's attachments Halo can read: become files of the run. */
  attachments?: MediaBytes[];
}

/** A document's text, by its format. */
export async function documentText(ref: MediaRef, bytes: Uint8Array, signal?: AbortSignal): Promise<DocumentText> {
  const format = ref.format ?? "pdf";
  const utf8 = () => new TextDecoder().decode(bytes).replace(/^﻿/, "");
  let out: DocumentText;
  switch (format) {
    case "docx":
      out = { format, text: docxText(bytes) };
      break;
    case "pptx": {
      const { text, slides } = pptxText(bytes);
      const pdf = await officeToPdf(bytes, "pptx", signal);
      const base = safeName(ref.name)?.replace(/\.pptx?$/i, "") ?? "slides";
      out = { format, text, slides, ...(pdf ? { rendition: new MediaBytes(pdf, { name: `${base}.pdf` }) } : {}) };
      break;
    }
    case "eml": {
      const m = parseMessage(bytes);
      const who = (list: Array<{ address: string; name?: string }>) => list.map((a) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(", ");
      const head = [`From: ${who(m.from ? [m.from] : [])}`, `To: ${who(m.to)}`, ...(m.cc.length ? [`Cc: ${who(m.cc)}`] : []), `Subject: ${m.subject}`, ...(m.date ? [`Date: ${m.date}`] : [])];
      const attached = m.attachments.map((a) => `- ${a.filename ?? "(no name)"} (${a.type}, ${a.size} bytes)`);
      const body = m.text || (m.html ? htmlText(m.html) : "");
      out = {
        format,
        text: `${head.join("\n")}\n\n${body}${attached.length ? `\n\nAttachments:\n${attached.join("\n")}` : ""}`,
        attachments: m.attachments.flatMap((a) => (a.file ? [a.file] : [])),
      };
      break;
    }
    case "html":
      out = { format, text: htmlText(utf8()) };
      break;
    case "csv":
    case "tsv":
    case "markdown":
    case "json":
    case "text":
      out = { format, text: utf8() };
      break;
    default:
      throw new HaloError(`Media.text: ${format} documents are read by the model as they are, not as text`, { code: "TOOL_ARGUMENT" });
  }
  if (out.text.length > MAX_DOCUMENT_CHARS) {
    out.text = `${out.text.slice(0, MAX_DOCUMENT_CHARS)}\n[... cut: ${out.text.length - MAX_DOCUMENT_CHARS} more characters]`;
    out.truncated = true;
  }
  return out;
}

export const mediaProvider =
  (transcriber: () => Transcriber): ToolProvider =>
  async (call, services) => {
    const ref = call.positional[0];
    if (!isMediaRef(ref)) throw new HaloError(`Media.${call.method} takes a file the run holds`, { code: "TOOL_ARGUMENT" });
    if (!services.media) throw new HaloError("This runtime can't read the files its runs hold", { code: "TOOL_CONFIG" });
    switch (call.method) {
      case "text":
        return documentText(ref, await services.media(ref), call.signal);
      case "transcript": {
        const t = transcriber();
        if ("missing" in t) throw new HaloError(t.missing, { code: "NO_API_KEY" });
        const out = await transcribe(t.service, ref, await services.media(ref), { fetch: services.fetch, apiKey: t.apiKey, model: t.model, baseUrl: t.baseUrl, signal: call.signal });
        services.spend?.(out.cost);
        return out;
      }
      case "digest":
        return digestVideo(ref, await services.media(ref), { transcriber: transcriber(), fetch: services.fetch, signal: call.signal, spend: services.spend });
      default:
        throw new HaloError(`Media has no method "${call.method}"`, { code: "TOOL_METHOD" });
    }
  };
