import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, sep } from 'path';

const MAX_LEVELS_UP = 6;

/**
 * The compiled plugin modules (studio-plugin/out/modules) exist only in a source checkout, so
 * this walks up from the running entry script and the working directory to find them.
 * MCP_PLUGIN_OUT_DIR overrides the search.
 */
export function findPluginOutDir(): string | undefined {
  const override = process.env.MCP_PLUGIN_OUT_DIR;
  if (override) return existsSync(join(override, 'modules')) ? override : undefined;
  const starts = [process.argv[1] ? dirname(process.argv[1]) : undefined, process.cwd()];
  for (const start of starts) {
    let dir = start;
    for (let i = 0; dir && i <= MAX_LEVELS_UP; i++) {
      const candidate = join(dir, 'studio-plugin', 'out');
      if (existsSync(join(candidate, 'modules'))) return candidate;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return undefined;
}

/** Map of "modules/handlers/X" to compiled source, the shape the plugin's reload expects. */
export function readPluginModules(outDir: string, version: string): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (name.endsWith('.luau') || name.endsWith('.lua')) {
        const key = relative(outDir, full).split(sep).join('/').replace(/\.luau?$/, '');
        // Same substitution scripts/build-plugin.mjs makes, so bridge stamps stay meaningful.
        files[key] = readFileSync(full, 'utf8').replace(/__VERSION__/g, version);
      }
    }
  };
  walk(join(outDir, 'modules'));
  return files;
}
