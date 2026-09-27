import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { findPluginOutDir, readPluginModules } from '../plugin-reload.js';

describe('plugin reload file map', () => {
  let outDir: string;

  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), 'mcp-out-'));
    mkdirSync(join(outDir, 'modules', 'handlers'), { recursive: true });
    mkdirSync(join(outDir, 'server'), { recursive: true });
    writeFileSync(join(outDir, 'modules', 'Communication.luau'), 'return "v__VERSION__"');
    writeFileSync(join(outDir, 'modules', 'handlers', 'EditorHandlers.luau'), 'return 1');
    writeFileSync(join(outDir, 'modules', 'handlers', 'notes.txt'), 'ignored');
    writeFileSync(join(outDir, 'server', 'init.server.luau'), 'entry, never reloaded');
  });

  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true });
    delete process.env.MCP_PLUGIN_OUT_DIR;
  });

  it('keys modules by their plugin path with forward slashes and no extension', () => {
    const files = readPluginModules(outDir, '9.9.9');
    expect(Object.keys(files).sort()).toEqual(['modules/Communication', 'modules/handlers/EditorHandlers']);
  });

  it('substitutes the version placeholder like the plugin build does', () => {
    expect(readPluginModules(outDir, '9.9.9')['modules/Communication']).toBe('return "v9.9.9"');
  });

  it('honours MCP_PLUGIN_OUT_DIR', () => {
    process.env.MCP_PLUGIN_OUT_DIR = outDir;
    expect(findPluginOutDir()).toBe(outDir);
  });
});
