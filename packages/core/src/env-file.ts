import * as fs from 'fs';
import * as path from 'path';

// Credentials usually arrive as real environment variables. When a host launches this server
// without them (MCP stdio configs often pass env: {}), fall back to a dotenv-style file so the
// secrets can live in one place on disk instead of being copied into every client config.

let cache: Record<string, string> | null = null;

function candidatePaths(): string[] {
  const explicit = process.env.ROBLOX_MCP_ENV_FILE;
  return explicit ? [explicit] : [path.resolve(process.cwd(), '.env')];
}

function load(): Record<string, string> {
  if (cache) return cache;

  cache = {};
  for (const file of candidatePaths()) {
    if (!fs.existsSync(file)) continue;

    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const separator = trimmed.indexOf('=');
      if (separator === -1) continue;

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
      if (key) cache[key] = value;
    }
    break;
  }

  return cache;
}

/**
 * First non-empty value across the given names, checking real environment variables before the
 * dotenv file. Names are aliases for the same secret, most canonical first.
 */
export function readCredential(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }

  const file = load();
  for (const name of names) {
    if (file[name]) return file[name];
  }

  return '';
}

/** Test seam: forget the parsed file so a changed path or file is picked up. */
export function resetCredentialCache(): void {
  cache = null;
}
