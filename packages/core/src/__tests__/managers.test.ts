import * as fs from 'fs';
import * as path from 'path';
import { PathFinder } from '../managers/path-finder.js';
import { ProcessRunner } from '../managers/process-runner.js';
import { ToolRegistry } from '../managers/tool-registry.js';

const SRC = path.resolve(__dirname, '..');

// Enforcement. Every rule below was broken once before the door existed.
describe('chokepoints are not bypassed', () => {
  const sourceFiles = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'managers') continue;
        out.push(...sourceFiles(full));
      } else if (entry.name.endsWith('.ts')) {
        out.push(full);
      }
    }
    return out;
  };

  // A baseline, not a clean sheet: these three launch and probe Studio itself, a
  // different contract from "run a checker". Named so a FOURTH spawner fails the test.
  const SPAWN_BASELINE = new Set([
    'studio-exe.ts',            // locates and version-probes the Studio executable
    'studio-instance-manager.ts', // launches and supervises Studio processes
    'studio-platform.ts',       // synchronous OS queries behind platform detection
  ]);

  it('no new file outside ProcessRunner spawns a process', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const rel = path.relative(SRC, file);
      if (SPAWN_BASELINE.has(path.basename(rel))) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (/from ['"]child_process['"]/.test(text)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it('the baseline is real, so the rule is not passing by accident', () => {
    // If these ever get migrated the baseline should shrink, and this says so loudly
    // rather than letting a stale exemption hide a regression.
    const stillSpawning = [...SPAWN_BASELINE].filter(name =>
      fs.existsSync(path.join(SRC, name))
      && /from ['"]child_process['"]/.test(fs.readFileSync(path.join(SRC, name), 'utf8')));
    expect(stillSpawning.sort()).toEqual([...SPAWN_BASELINE].sort());
  });

  it('nothing outside PathFinder hand-rolls a walk-up search', () => {
    // The tell is a bounded climb using path.dirname on a cursor. Two copies of this
    // already disagreed about depth, and one silently returned null at runtime.
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const text = fs.readFileSync(file, 'utf8');
      if (/const parent = path\.dirname\(cursor\)/.test(text)) {
        offenders.push(path.relative(SRC, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('PathFinder', () => {
  it('finds a shape that exists and returns null otherwise', () => {
    const found = PathFinder.find({ shapes: [['package.json']], from: [SRC] });
    expect(found && fs.existsSync(found)).toBe(true);
    expect(PathFinder.find({ shapes: [['definitely-not-here.xyz']], from: [SRC] })).toBeNull();
  });

  it('requireAll rejects a folder that merely has the right name', () => {
    const withoutCheck = PathFinder.find({ shapes: [['src']], from: [SRC] });
    const withCheck = PathFinder.find({
      shapes: [['src']], from: [SRC], requireAll: ['nothing-like-this.ts'],
    });
    expect(withoutCheck).not.toBeNull();
    expect(withCheck).toBeNull();
  });
});

describe('ProcessRunner', () => {
  it('reports a non-zero exit as a result, not a throw', async () => {
    // A linter finding problems exits non-zero. Throwing there turns "3 errors" into
    // "the checker crashed".
    const res = await ProcessRunner.run(process.execPath, ['-e', 'process.exit(3)']);
    expect(res.code).toBe(3);
    expect(res.spawnError).toBeUndefined();
  });

  it('separates "could not start" from "ran and disagreed"', async () => {
    const res = await ProcessRunner.run('definitely-not-a-real-binary-xyz', []);
    expect(res.spawnError).toBeDefined();
  });

  it('returns stdout and stderr together in combined', async () => {
    const res = await ProcessRunner.run(process.execPath, [
      '-e', 'process.stdout.write("out");process.stderr.write("err")',
    ]);
    expect(res.stdout).toBe('out');
    expect(res.stderr).toBe('err');
    expect(res.combined).toContain('out');
    expect(res.combined).toContain('err');
  });
});

describe('ToolRegistry', () => {
  const bridge = {} as any;
  const make = () => new ToolRegistry(bridge, {
    tools: { marker: 'first' },
    handlers: { alpha: () => 'a' } as any,
    definitions: [{ name: 'alpha' }] as any,
  });

  it('serves the generation it was constructed with', () => {
    const r = make();
    expect(r.generation).toBe(0);
    expect(r.has('alpha')).toBe(true);
    expect(r.has('nope')).toBe(false);
    expect(r.tools.marker).toBe('first');
  });

  it('keeps the old generation when a reload fails', async () => {
    const r = make();
    // No dist has been located, so a reload cannot succeed.
    const result = await r.reload();
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    // The critical part: still serving, not empty.
    expect(r.has('alpha')).toBe(true);
    expect(r.generation).toBe(0);
  });

  it('reloads against the CURRENT bridge, not the one it was built with', async () => {
    // The server swaps primary -> proxy after construction. A captured reference meant
    // every reloaded tools instance was wired to the abandoned bridge, and the symptom
    // was a clean reload followed by "Studio plugin connection timeout" on the first call.
    let live: any = { id: 'primary' };
    const r = new ToolRegistry(() => live, {
      tools: {}, handlers: {} as any, definitions: [] as any,
    });
    live = { id: 'proxy' };
    expect((r as any).bridgeOf().id).toBe('proxy');
  });

  it('accepts a plain bridge too, so existing callers keep working', () => {
    const r = new ToolRegistry({ id: 'plain' }, {
      tools: {}, handlers: {} as any, definitions: [] as any,
    });
    expect((r as any).bridgeOf().id).toBe('plain');
  });

  it('coalesces a reload requested while one is running, instead of dropping it', async () => {
    // Returning "already running" would silently discard the newer build: the reload
    // looks clean while the process keeps serving stale code.
    const r = make();
    let passes = 0;
    (r as any).dist = 'anything';
    (r as any).reloadOnce = async () => { passes++; return { ok: true, generation: passes, tools: 0 }; };
    const first = r.reload();
    const second = r.reload();
    await Promise.all([first, second]);
    expect(passes).toBe(2);
    // And the queue drains, so the next reload is not treated as still in flight.
    await r.reload();
    expect(passes).toBe(3);
  });

  it('lets the bridge swap replace the tools instance without touching handlers', () => {
    const r = make();
    r.setTools({ marker: 'second' });
    expect(r.tools.marker).toBe('second');
    expect(r.has('alpha')).toBe(true);
  });
});
