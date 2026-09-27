// The one owner of the tool layer: holds it, and swaps it on rebuild.
//
// Tools instance, handlers and definitions move as ONE generation. A new handler against
// an old tools instance is a TypeError at call time, so all three are imported and
// validated before anything is swapped, and a failed reload keeps the previous
// generation serving.
//
// It does not own the bridge. That holds the connected Studios and the pending queue;
// reloading it would drop live requests.

import * as fs from 'fs';
import * as path from 'path';
import { PathFinder } from './path-finder.js';
import type { ToolDefinition } from '../tools/definitions.js';

export interface ToolModules {
  RobloxStudioTools: new (bridge: any) => any;
  TOOL_HANDLERS: Record<string, (tools: any, body: any) => any>;
  TOOL_DEFINITIONS: ToolDefinition[];
}

export interface RegistryState {
  tools: any;
  handlers: Record<string, (tools: any, body: any) => any>;
  definitions: ToolDefinition[];
  generation: number;
}

export interface ReloadResult {
  ok: boolean;
  generation: number;
  tools: number;
  error?: string;
}

/** Quiet period after the last write before a rebuild counts as finished. */
const QUIET_MS = 400;

export class ToolRegistry {
  private state: RegistryState;
  // A supplier, not a captured reference: the server swaps primary -> proxy after
  // construction, and a captured bridge left every reloaded tools instance wired to the
  // abandoned one -- clean reload, then "Studio plugin connection timeout" on first call.
  private readonly bridgeOf: () => any;
  private dist: string | null = null;
  private stopWatching: (() => void) | null = null;
  private inFlight: Promise<ReloadResult> | null = null;
  private restartRequested = false;

  constructor(bridgeOf: (() => any) | any, initial: Omit<RegistryState, 'generation'>) {
    this.bridgeOf = typeof bridgeOf === 'function' ? bridgeOf : () => bridgeOf;
    this.state = { ...initial, generation: 0 };
  }

  get tools() { return this.state.tools; }
  get definitions() { return this.state.definitions; }
  get generation() { return this.state.generation; }

  handler(name: string) { return this.state.handlers[name]; }
  has(name: string) { return Object.prototype.hasOwnProperty.call(this.state.handlers, name); }

  /** Replace the tools instance alone, for the primary -> proxy swap at startup. */
  setTools(tools: any) { this.state.tools = tools; }

  // Not the tsup bundle: it inlines core into one file, so a relative import from inside
  // it resolves to a path that does not exist. This is what a rebuild rewrites.
  static findDist(): string | null {
    return PathFinder.find({
      shapes: [
        ['packages', 'core', 'dist'],
        ['core', 'dist'],
        ['node_modules', '@6xvl', 'robloxstudio-mcp-core', 'dist'],
        ['dist'],
      ],
      requireAll: [path.join('tools', 'index.js'), 'http-server.js', path.join('tools', 'definitions.js')],
    });
  }

  // The ?v= is what makes this a reload. An ES module is cached by resolved URL for the
  // life of the process, so importing the same path twice returns the first copy.
  private static async importFrom(dist: string, version: number): Promise<ToolModules> {
    const url = (rel: string) => {
      // Built by hand rather than pathToFileURL so the Windows drive letter lands after
      // file:/// -- a raw path is read as a bare specifier and fails to resolve.
      const abs = path.resolve(dist, rel);
      return `file:///${abs.replace(/\\/g, '/')}?v=${version}`;
    };
    const [toolsMod, httpMod, defsMod] = await Promise.all([
      import(url('tools/index.js')),
      import(url('http-server.js')),
      import(url('tools/definitions.js')),
    ]);
    const mods = {
      RobloxStudioTools: toolsMod.RobloxStudioTools,
      TOOL_HANDLERS: httpMod.TOOL_HANDLERS,
      TOOL_DEFINITIONS: defsMod.TOOL_DEFINITIONS,
    } as ToolModules;
    const missing = (['RobloxStudioTools', 'TOOL_HANDLERS', 'TOOL_DEFINITIONS'] as const)
      .filter(k => !mods[k]);
    if (missing.length) throw new Error(`the rebuilt core is missing ${missing.join(', ')}`);
    return mods;
  }

  /**
   * Swap in a rebuilt tool layer. Never throws.
   *
   * Concurrent callers share the in-flight reload, and a request that arrives during one
   * schedules exactly one more pass afterwards. Returning "already running" instead would
   * silently drop the newer build -- the reload would look clean while serving stale code.
   */
  reload(): Promise<ReloadResult> {
    if (this.inFlight) {
      this.restartRequested = true;
      return this.inFlight;
    }
    this.inFlight = this.runReload();
    return this.inFlight;
  }

  private async runReload(): Promise<ReloadResult> {
    try {
      let result = await this.reloadOnce();
      while (this.restartRequested) {
        this.restartRequested = false;
        result = await this.reloadOnce();
      }
      return result;
    } finally {
      // Without the finally an unexpected throw would leave inFlight set and wedge every
      // later reload behind a promise that already settled.
      this.inFlight = null;
      this.restartRequested = false;
    }
  }

  private async reloadOnce(): Promise<ReloadResult> {
    if (!this.dist) {
      return this.failed('no core dist found to reload from');
    }
    try {
      const next = this.state.generation + 1;
      const mods = await ToolRegistry.importFrom(this.dist, Date.now());
      this.state = {
        tools: new mods.RobloxStudioTools(this.bridgeOf()),
        handlers: mods.TOOL_HANDLERS,
        definitions: [...mods.TOOL_DEFINITIONS],
        generation: next,
      };
      return { ok: true, generation: next, tools: this.state.definitions.length };
    } catch (err) {
      // The previous generation is still serving. Said out loud, because a quietly failed
      // reload is indistinguishable from one that worked and changed nothing.
      return this.failed(err instanceof Error ? err.message : String(err));
    }
  }

  private failed(error: string): ReloadResult {
    return {
      ok: false,
      generation: this.state.generation,
      tools: this.state.definitions.length,
      error,
    };
  }

  /**
   * Watch the dist and reload once the writes stop. Debounced because a build is not one
   * event: tsc rewrites a hundred files, and reloading per event imports a half-written
   * tree and throws on a truncated file.
   */
  watch(onReloaded: (result: ReloadResult) => void): boolean {
    this.dist = ToolRegistry.findDist();
    if (!this.dist) return false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const watcher = fs.watch(this.dist, { recursive: true }, (_e, filename) => {
        if (filename && !String(filename).endsWith('.js')) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { void this.reload().then(onReloaded); }, QUIET_MS);
      });
      this.stopWatching = () => { if (timer) clearTimeout(timer); watcher.close(); };
      return true;
    } catch {
      // Recursive watch is unavailable on some platforms. Hot reload is simply off.
      this.dist = null;
      return false;
    }
  }

  stop() {
    this.stopWatching?.();
    this.stopWatching = null;
  }
}
