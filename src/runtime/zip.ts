/**
 * Reading files out of a zip archive (Word and PowerPoint files are zips of XML), through its
 * central directory: the listing at the end of the file. Stored and deflated entries only;
 * ZIP64 and encrypted archives aren't supported.
 */

import { inflateRawSync } from "node:zlib";

/** The most bytes one entry may inflate to. */
export const MAX_INFLATED = 50_000_000;

interface Entry {
  name: string;
  flags: number;
  method: number;
  compressedSize: number;
  size: number;
  local: number;
}

function entries(zip: Uint8Array): Entry[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  // The end-of-central-directory record is in the last 22 bytes, plus up to a 64KB comment.
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip file");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  if (p === 0xffffffff) throw new Error("ZIP64 archives aren't supported");
  const decoder = new TextDecoder();
  const out: Entry[] = [];
  for (let n = 0; n < count; n++) {
    if (p + 46 > zip.length || view.getUint32(p, true) !== 0x02014b50) throw new Error("corrupt zip central directory");
    const nameLen = view.getUint16(p + 28, true);
    out.push({
      flags: view.getUint16(p + 8, true),
      method: view.getUint16(p + 10, true),
      compressedSize: view.getUint32(p + 20, true),
      size: view.getUint32(p + 24, true),
      local: view.getUint32(p + 42, true),
      name: decoder.decode(zip.subarray(p + 46, p + 46 + nameLen)),
    });
    p += 46 + nameLen + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
  }
  return out;
}

/** The names of the files in a zip, or undefined when the bytes aren't one. */
export function zipNames(zip: Uint8Array): string[] | undefined {
  try {
    return entries(zip).map((e) => e.name);
  } catch {
    return undefined;
  }
}

/** One file out of a zip archive, or undefined when it has no file of that name. */
export function readZipEntry(zip: Uint8Array, name: string): Uint8Array | undefined {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const e = entries(zip).find((x) => x.name === name);
  if (!e) return undefined;
  if (e.flags & 1) throw new Error(`${name} is encrypted`);
  if (e.size > MAX_INFLATED) throw new Error(`${name} is too large (${e.size} bytes)`);
  if (e.local + 30 > zip.length || view.getUint32(e.local, true) !== 0x04034b50) throw new Error("corrupt zip local header");
  const start = e.local + 30 + view.getUint16(e.local + 26, true) + view.getUint16(e.local + 28, true);
  const data = zip.subarray(start, start + e.compressedSize);
  if (e.method === 0) return data;
  if (e.method === 8) return new Uint8Array(inflateRawSync(data, { maxOutputLength: MAX_INFLATED }));
  throw new Error(`${name} uses unsupported zip compression method ${e.method}`);
}
