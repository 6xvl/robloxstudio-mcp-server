// The place's scripts as a folder of files, and back again.
//
// SOURCE TEXT ONLY. It never creates, renames, reparents or deletes an instance. A pull
// writes the scripts that exist; a push updates the Source of scripts that still exist
// and reports what it could not match. Restructuring the tree from disk is Rojo's job.
//
// Layout is Rojo's, so the folder opens in Rojo, VS Code and the Luau toolchain as-is:
//
//     ModuleScript   Name.luau          Script   Name.server.luau
//     LocalScript    Name.client.luau   Folder   Name/
//     ...with children                           Name/init[.server|.client].luau
//
// Round trips through a manifest, not filenames: instance names may contain characters
// no filesystem accepts, and two siblings may differ only by one.

export const MANIFEST_NAME = '.mcp-sync.json';
export const SOURCEMAP_NAME = 'sourcemap.json';

export interface SyncEntry {
  /** Full instance path, e.g. game.ServerScriptService.Main */
  instancePath: string;
  className: string;
  source: string;
}

export interface MappedEntry extends SyncEntry {
  /** Path relative to the sync root, using forward slashes. */
  relPath: string;
}

export interface Manifest {
  version: 1;
  pulledAt: string;
  placeId?: number;
  placeName?: string;
  /** relPath -> the instance it came from. The only thing a push trusts. */
  files: Record<string, { instancePath: string; className: string; sha1: string }>;
}

const SCRIPT_CLASSES = new Set(['ModuleScript', 'Script', 'LocalScript']);

export function isScriptClass(className: string): boolean {
  return SCRIPT_CLASSES.has(className);
}

export function suffixFor(className: string, asInit: boolean): string {
  const stem = asInit ? 'init' : '';
  if (className === 'Script') return `${stem}.server.luau`;
  if (className === 'LocalScript') return `${stem}.client.luau`;
  return `${stem}.luau`;
}

const RESERVED = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`),
]);

// Windows rejects the usual reserved characters plus trailing dots and spaces, and
// reserves device names. Characters are replaced rather than dropped so two siblings
// cannot collapse onto one filename; surviving collisions get a numeric suffix.
export function sanitizeSegment(name: string): string {
  let out = '';
  for (const ch of name) {
    const code = ch.codePointAt(0)!;
    if (code < 0x20 || '\\/:*?"<>|'.includes(ch)) {
      out += '%' + code.toString(16).padStart(2, '0');
    } else {
      out += ch;
    }
  }
  // A trailing dot or space is silently stripped by Windows, which would make two
  // different names the same file.
  out = out.replace(/[. ]+$/, (m) => '%2e'.repeat(m.length));
  if (out === '') out = '%empty';
  if (RESERVED.has(out.toUpperCase())) out = `${out}%res`;
  return out;
}

export function segmentsOf(instancePath: string): string[] {
  const trimmed = instancePath.replace(/^game\./, '');
  return trimmed.length ? trimmed.split('.') : [];
}

// A script becomes a FOLDER with an init file when anything else in the set sits
// underneath it. Rojo's rule, and what keeps a ModuleScript with children representable.
export function mapEntries(entries: SyncEntry[]): MappedEntry[] {
  // Which instance paths are a prefix of another, so need the init form.
  const prefixes = new Set<string>();
  for (const e of entries) {
    const segs = segmentsOf(e.instancePath);
    for (let i = 1; i < segs.length; i++) {
      prefixes.add(segs.slice(0, i).join('.'));
    }
  }

  const used = new Set<string>();
  const out: MappedEntry[] = [];
  for (const e of entries) {
    const segs = segmentsOf(e.instancePath);
    const key = segs.join('.');
    const asInit = prefixes.has(key);
    const dirs = segs.map(sanitizeSegment);
    let rel: string;
    if (asInit) {
      rel = [...dirs, suffixFor(e.className, true)].join('/');
    } else {
      const leaf = dirs.pop()!;
      rel = [...dirs, leaf + suffixFor(e.className, false)].join('/');
    }
    // Two instances can still sanitize onto one path. Deterministic suffix, and the
    // manifest records which is which.
    if (used.has(rel.toLowerCase())) {
      let n = 2;
      const dot = rel.indexOf('.', rel.lastIndexOf('/') + 1);
      const base = dot === -1 ? rel : rel.slice(0, dot);
      const ext = dot === -1 ? '' : rel.slice(dot);
      while (used.has(`${base}%${n}${ext}`.toLowerCase())) n++;
      rel = `${base}%${n}${ext}`;
    }
    used.add(rel.toLowerCase());
    out.push({ ...e, relPath: rel });
  }
  return out;
}

export interface SourcemapNode {
  name: string;
  className: string;
  filePaths?: string[];
  children?: SourcemapNode[];
}

/**
 * A Rojo-shaped sourcemap for the pulled tree.
 *
 * WITHOUT THIS THE TYPE CHECKER CANNOT FOLLOW A REQUIRE. Measured: given a Lib.luau
 * exporting `add(a: number, b: number)` and a User.luau calling `Lib.add("x", 2)`,
 * luau-lsp with Roblox definitions but no sourcemap reports
 *
 *     Unknown require: unsupported path
 *     Key 'Lib' not found in external type 'Instance'
 *     Value of type 'Instance?' could be nil
 *
 * -- three errors, none of them the real one, and the genuine type mismatch is missed
 * entirely. Every module that requires another produces that noise, which in this
 * codebase is every module. The sourcemap is what turns the checker from a thing that
 * reports nonsense into one that finds the bug.
 *
 * Intermediate containers are emitted as Folder. Only scripts are pulled, so their real
 * class is not known, and require resolution walks names rather than classes -- Folder
 * is sufficient and it is honest about what was actually read.
 */
export function buildSourcemap(
  files: Array<{ relPath: string; instancePath: string; className: string }>
): SourcemapNode {
  const root: SourcemapNode = { name: 'Game', className: 'DataModel', children: [] };

  for (const f of files) {
    const segs = segmentsOf(f.instancePath);
    if (segs.length === 0) continue;
    let node = root;
    for (let i = 0; i < segs.length; i++) {
      const name = segs[i];
      const leaf = i === segs.length - 1;
      node.children = node.children ?? [];
      let next = node.children.find(c => c.name === name);
      if (!next) {
        // A service sits directly under the DataModel and its class name matches its
        // name, which is what lets game:GetService resolve in the checker.
        next = { name, className: leaf ? f.className : (i === 0 ? name : 'Folder') };
        node.children.push(next);
      }
      if (leaf) {
        next.className = f.className;
        next.filePaths = [f.relPath];
      }
      node = next;
    }
  }
  return root;
}
