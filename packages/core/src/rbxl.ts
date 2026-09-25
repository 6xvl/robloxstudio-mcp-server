import { gunzipSync } from 'zlib';
import { decompress as decompressZstd } from 'fzstd';

// Binary place/model format. Spec: rojo-rbx/rbx-dom docs/binary.md
// This module is the ONLY place that interprets place-file bytes.

/** Shared by every binary Roblox container: places, models, and skill bundles. */
export const ROBLOX_BINARY_SIGNATURE = Buffer.from('<roblox!\x89\xff\r\n\x1a\n', 'binary');
export const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

const SIGNATURE = ROBLOX_BINARY_SIGNATURE;
const HEADER_SIZE = 32;

const TYPE_STRING = 0x01;
const TYPE_SHARED_STRING = 0x1c;

export interface RbxlScript {
  path: string;
  className: string;
  source: string;
}

interface Chunk {
  name: string;
  /** Original bytes including the 16-byte header, for chunks we do not rewrite. */
  raw: Buffer;
  data: Buffer;
}

interface ClassBlock {
  classId: number;
  className: string;
  referents: number[];
}

export interface RbxlDocument {
  /** The original 32-byte file header, copied through on write. */
  header: Buffer;
  chunks: Chunk[];
  classes: Map<number, ClassBlock>;
  /** referent -> instance */
  instances: Map<number, { className: string; name: string; parent: number }>;
  sharedStrings: string[];
}

function lz4Decompress(src: Buffer, outLength: number): Buffer {
  const dst = Buffer.allocUnsafe(outLength);
  let i = 0;
  let o = 0;

  while (i < src.length && o < outLength) {
    const token = src[i++];

    let literals = token >> 4;
    if (literals === 15) {
      let b: number;
      do {
        b = src[i++];
        literals += b;
      } while (b === 255);
    }
    src.copy(dst, o, i, i + literals);
    i += literals;
    o += literals;

    if (i >= src.length) break;

    const offset = src[i] | (src[i + 1] << 8);
    i += 2;

    let matchLength = token & 15;
    if (matchLength === 15) {
      let b: number;
      do {
        b = src[i++];
        matchLength += b;
      } while (b === 255);
    }
    matchLength += 4;

    // Overlapping copies are legal and common, so this cannot use Buffer.copy.
    let match = o - offset;
    for (let n = 0; n < matchLength; n++) {
      dst[o++] = dst[match++];
    }
  }

  return dst;
}

function decompressChunk(payload: Buffer, uncompressedLength: number): Buffer {
  if (payload.subarray(0, 4).equals(ZSTD_MAGIC)) {
    return Buffer.from(decompressZstd(payload, new Uint8Array(uncompressedLength)));
  }
  return lz4Decompress(payload, uncompressedLength);
}

/** Undo byte interleaving for an array of `count` values, each `width` bytes wide. */
function deinterleave(src: Buffer, offset: number, count: number, width: number): Buffer {
  const out = Buffer.allocUnsafe(count * width);
  for (let byteIndex = 0; byteIndex < width; byteIndex++) {
    for (let value = 0; value < count; value++) {
      out[value * width + byteIndex] = src[offset + byteIndex * count + value];
    }
  }
  return out;
}

function untransformInt32(value: number): number {
  return (value >>> 1) ^ -(value & 1);
}

function readReferents(src: Buffer, offset: number, count: number): number[] {
  const flat = deinterleave(src, offset, count, 4);
  const out: number[] = [];
  let running = 0;
  for (let i = 0; i < count; i++) {
    running += untransformInt32(flat.readInt32BE(i * 4));
    out.push(running);
  }
  return out;
}

class Reader {
  offset = 0;
  constructor(readonly buf: Buffer) {}

  u8(): number {
    return this.buf[this.offset++];
  }

  u32(): number {
    const value = this.buf.readUInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  string(): string {
    const length = this.u32();
    const value = this.buf.toString('utf8', this.offset, this.offset + length);
    this.offset += length;
    return value;
  }
}

function splitChunks(data: Buffer): Chunk[] {
  const chunks: Chunk[] = [];
  let pos = HEADER_SIZE;

  while (pos + 16 <= data.length) {
    const name = data.toString('ascii', pos, pos + 4).replace(/\0+$/, '');
    const compressedLength = data.readUInt32LE(pos + 4);
    const uncompressedLength = data.readUInt32LE(pos + 8);
    const payloadLength = compressedLength || uncompressedLength;
    const payload = data.subarray(pos + 16, pos + 16 + payloadLength);

    chunks.push({
      name,
      raw: data.subarray(pos, pos + 16 + payloadLength),
      data: compressedLength === 0 ? payload : decompressChunk(payload, uncompressedLength),
    });

    pos += 16 + payloadLength;
    if (name === 'END') break;
  }

  return chunks;
}

export function readPlace(bytes: Buffer): RbxlDocument {
  const data = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;

  if (!data.subarray(0, SIGNATURE.length).equals(SIGNATURE)) {
    throw new Error('Not a binary Roblox place file (bad signature). XML .rbxlx is not supported.');
  }

  const doc: RbxlDocument = {
    header: Buffer.from(data.subarray(0, HEADER_SIZE)),
    chunks: splitChunks(data),
    classes: new Map(),
    instances: new Map(),
    sharedStrings: [],
  };

  for (const chunk of doc.chunks) {
    if (chunk.name === 'SSTR') {
      const reader = new Reader(chunk.data);
      reader.u32();
      const count = reader.u32();
      for (let i = 0; i < count; i++) {
        reader.offset += 16;
        doc.sharedStrings.push(reader.string());
      }
    } else if (chunk.name === 'INST') {
      const reader = new Reader(chunk.data);
      const classId = reader.u32();
      const className = reader.string();
      const isService = reader.u8() === 1;
      const count = reader.u32();
      const referents = readReferents(chunk.data, reader.offset, count);
      reader.offset += count * 4;
      if (isService) reader.offset += count;

      doc.classes.set(classId, { classId, className, referents });
      for (const referent of referents) {
        doc.instances.set(referent, { className, name: '', parent: -1 });
      }
    }
  }

  for (const chunk of doc.chunks) {
    if (chunk.name === 'PROP') {
      const reader = new Reader(chunk.data);
      const classId = reader.u32();
      const propertyName = reader.string();
      if (propertyName !== 'Name') continue;
      if (reader.u8() !== TYPE_STRING) continue;

      const block = doc.classes.get(classId);
      if (!block) continue;

      for (const referent of block.referents) {
        const instance = doc.instances.get(referent);
        if (instance) instance.name = reader.string();
      }
    } else if (chunk.name === 'PRNT') {
      const reader = new Reader(chunk.data);
      reader.u8();
      const count = reader.u32();
      const children = readReferents(chunk.data, reader.offset, count);
      const parents = readReferents(chunk.data, reader.offset + count * 4, count);
      for (let i = 0; i < count; i++) {
        const instance = doc.instances.get(children[i]);
        if (instance) instance.parent = parents[i];
      }
    }
  }

  return doc;
}

function fullName(doc: RbxlDocument, referent: number): string {
  const parts: string[] = [];
  let current = referent;
  // A malformed parent cycle would hang the walk; the file's own instance count bounds it.
  for (let guard = 0; guard <= doc.instances.size; guard++) {
    const instance = doc.instances.get(current);
    if (!instance) break;
    parts.unshift(instance.name);
    if (instance.parent === -1) break;
    current = instance.parent;
  }
  return parts.join('.');
}

function readSourceValues(
  doc: RbxlDocument,
  chunk: Chunk
): { classId: number; values: string[] } | null {
  const reader = new Reader(chunk.data);
  const classId = reader.u32();
  if (reader.string() !== 'Source') return null;

  const block = doc.classes.get(classId);
  if (!block) return null;

  const typeId = reader.u8();
  const values: string[] = [];

  if (typeId === TYPE_STRING) {
    for (let i = 0; i < block.referents.length; i++) values.push(reader.string());
  } else if (typeId === TYPE_SHARED_STRING) {
    const indices = deinterleave(chunk.data, reader.offset, block.referents.length, 4);
    for (let i = 0; i < block.referents.length; i++) {
      values.push(doc.sharedStrings[indices.readUInt32BE(i * 4)] ?? '');
    }
  } else {
    return null;
  }

  return { classId, values };
}

export function listScripts(doc: RbxlDocument): RbxlScript[] {
  const scripts: RbxlScript[] = [];

  for (const chunk of doc.chunks) {
    if (chunk.name !== 'PROP') continue;
    const parsed = readSourceValues(doc, chunk);
    if (!parsed) continue;

    const block = doc.classes.get(parsed.classId)!;
    block.referents.forEach((referent, index) => {
      scripts.push({
        path: fullName(doc, referent),
        className: block.className,
        source: parsed.values[index] ?? '',
      });
    });
  }

  return scripts;
}

function encodeStringArray(classId: number, values: string[]): Buffer {
  const parts: Buffer[] = [];

  const head = Buffer.allocUnsafe(4);
  head.writeUInt32LE(classId, 0);
  parts.push(head);

  const name = Buffer.from('Source', 'utf8');
  const nameLength = Buffer.allocUnsafe(4);
  nameLength.writeUInt32LE(name.length, 0);
  parts.push(nameLength, name, Buffer.from([TYPE_STRING]));

  for (const value of values) {
    const encoded = Buffer.from(value, 'utf8');
    const length = Buffer.allocUnsafe(4);
    length.writeUInt32LE(encoded.length, 0);
    parts.push(length, encoded);
  }

  return Buffer.concat(parts);
}

/** Chunk header with Compressed Length 0, which the format defines as stored-uncompressed. */
function storedChunk(name: string, data: Buffer): Buffer {
  const header = Buffer.alloc(16);
  header.write(name.padEnd(4, '\0'), 0, 'ascii');
  header.writeUInt32LE(0, 4);
  header.writeUInt32LE(data.length, 8);
  return Buffer.concat([header, data]);
}

export interface PatchResult {
  bytes: Buffer;
  patched: string[];
  missing: string[];
  /** Paths held by more than one instance. Skipped, because which one was meant is unknowable. */
  ambiguous: string[];
}

/**
 * Replace the Source of the named scripts. Every other chunk is copied byte-for-byte.
 * Rewritten chunks are stored uncompressed, so the file grows but stays valid.
 */
export function patchScriptSources(
  doc: RbxlDocument,
  sources: Map<string, string>
): PatchResult {
  if (doc.chunks.length === 0) throw new Error('Place file has no chunks');

  const occurrences = new Map<string, number>();
  for (const script of listScripts(doc)) {
    occurrences.set(script.path, (occurrences.get(script.path) ?? 0) + 1);
  }
  const ambiguous = [...sources.keys()].filter((path) => (occurrences.get(path) ?? 0) > 1);

  const patched: string[] = [];
  const found = new Set<string>();
  const parts: Buffer[] = [doc.header];

  for (const chunk of doc.chunks) {
    const parsed = chunk.name === 'PROP' ? readSourceValues(doc, chunk) : null;
    if (!parsed) {
      parts.push(chunk.raw);
      continue;
    }

    const block = doc.classes.get(parsed.classId)!;
    const values = [...parsed.values];
    let changed = false;

    block.referents.forEach((referent, index) => {
      const path = fullName(doc, referent);
      const replacement = sources.get(path);
      if (replacement === undefined) return;
      found.add(path);
      if (ambiguous.includes(path)) return;
      if (values[index] === replacement) return;
      values[index] = replacement;
      patched.push(path);
      changed = true;
    });

    parts.push(changed ? storedChunk('PROP', encodeStringArray(parsed.classId, values)) : chunk.raw);
  }

  const missing = [...sources.keys()].filter((path) => !found.has(path));

  return { bytes: Buffer.concat(parts), patched, missing, ambiguous };
}
