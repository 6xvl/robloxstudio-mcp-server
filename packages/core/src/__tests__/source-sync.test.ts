import { mapEntries, sanitizeSegment, segmentsOf, suffixFor, isScriptClass, buildSourcemap } from '../source-sync.js';

const entry = (instancePath: string, className: string) => ({ instancePath, className, source: '' });

describe('source-sync layout', () => {
  it('maps the three script classes to Rojo suffixes', () => {
    const out = mapEntries([
      entry('game.ReplicatedStorage.Mod', 'ModuleScript'),
      entry('game.ServerScriptService.Main', 'Script'),
      entry('game.StarterPlayer.StarterPlayerScripts.Client', 'LocalScript'),
    ]);
    expect(out[0].relPath).toBe('ReplicatedStorage/Mod.luau');
    expect(out[1].relPath).toBe('ServerScriptService/Main.server.luau');
    expect(out[2].relPath).toBe('StarterPlayer/StarterPlayerScripts/Client.client.luau');
  });

  it('uses the init form for a script that owns other scripts', () => {
    const out = mapEntries([
      entry('game.ReplicatedStorage.Parent', 'ModuleScript'),
      entry('game.ReplicatedStorage.Parent.Child', 'ModuleScript'),
    ]);
    expect(out[0].relPath).toBe('ReplicatedStorage/Parent/init.luau');
    expect(out[1].relPath).toBe('ReplicatedStorage/Parent/Child.luau');
  });

  it('uses the right init suffix per class', () => {
    const out = mapEntries([
      entry('game.ServerScriptService.Boot', 'Script'),
      entry('game.ServerScriptService.Boot.Helper', 'ModuleScript'),
    ]);
    expect(out[0].relPath).toBe('ServerScriptService/Boot/init.server.luau');
  });

  it('escapes characters Windows will not accept', () => {
    expect(sanitizeSegment('a:b')).toBe('a%3ab');
    expect(sanitizeSegment('why?')).toBe('why%3f');
    expect(sanitizeSegment('a/b')).toBe('a%2fb');
  });

  it('keeps two names apart that differ only by an illegal character', () => {
    // Both would become "ab" under naive stripping and one would overwrite the other.
    expect(sanitizeSegment('a:b')).not.toBe(sanitizeSegment('a*b'));
  });

  it('escapes a trailing dot or space, which Windows silently drops', () => {
    expect(sanitizeSegment('Name.')).toBe('Name%2e');
    expect(sanitizeSegment('Name ')).toBe('Name%2e');
    expect(sanitizeSegment('Name')).toBe('Name');
  });

  it('sidesteps reserved device names', () => {
    expect(sanitizeSegment('CON')).toBe('CON%res');
    expect(sanitizeSegment('nul')).toBe('nul%res');
    expect(sanitizeSegment('CONSOLE')).toBe('CONSOLE');
  });

  it('never emits the same path twice', () => {
    const out = mapEntries([
      entry('game.RS.a:b', 'ModuleScript'),
      entry('game.RS.a:b', 'ModuleScript'),
      entry('game.RS.a:b', 'ModuleScript'),
    ]);
    const seen = new Set(out.map(o => o.relPath.toLowerCase()));
    expect(seen.size).toBe(3);
  });

  it('strips the game prefix', () => {
    expect(segmentsOf('game.A.B')).toEqual(['A', 'B']);
    expect(segmentsOf('game.A')).toEqual(['A']);
  });

  it('knows what a script is', () => {
    expect(isScriptClass('ModuleScript')).toBe(true);
    expect(isScriptClass('Folder')).toBe(false);
    expect(suffixFor('LocalScript', true)).toBe('init.client.luau');
    expect(suffixFor('ModuleScript', false)).toBe('.luau');
  });
});

import { RobloxStudioTools } from '../tools/index.js';

describe('sync walker Luau', () => {
  const walker = (roots: string[], exclude: string[], from: number, to: number, withSource: boolean) =>
    (RobloxStudioTools as any).syncWalker(roots, exclude, from, to, withSource) as string;

  /**
   * Instance:GetFullName() answers "ServerStorage.Backup", with no "game." on the
   * front. An exclude written the way a caller naturally writes it --
   * "game.ServerStorage.Backup" -- therefore matched nothing, and a pull that was meant
   * to skip 246 backup scripts silently returned all 341. Measured against the live
   * place before and after.
   */
  it('prefixes the walked path with game. so excludes can match', () => {
    const code = walker(['ServerStorage'], [], 1, 10, false);
    expect(code).toContain('local full = "game." .. d:GetFullName()');
  });

  it('normalises an exclude that already carries the prefix', () => {
    const code = walker(['ServerStorage'], ['game.ServerStorage.Backup'], 1, 10, false);
    expect(code).toContain('"game.ServerStorage.Backup"');
    expect(code).not.toContain('"game.game.ServerStorage.Backup"');
  });

  it('adds the prefix to an exclude written without it', () => {
    const code = walker(['ServerStorage'], ['ServerStorage.Backup'], 1, 10, false);
    expect(code).toContain('"game.ServerStorage.Backup"');
  });

  it('only reads Source when asked, so the count pass stays small', () => {
    expect(walker(['X'], [], 1, 0, false)).not.toContain('d.Source');
    expect(walker(['X'], [], 1, 5, true)).toContain('d.Source');
  });

  it('escapes root names rather than interpolating them raw', () => {
    const code = walker(['A"B'], [], 1, 1, false);
    expect(code).toContain(JSON.stringify('A"B'));
  });
});

describe('sourcemap', () => {
  const f = (relPath: string, instancePath: string, className = 'ModuleScript') =>
    ({ relPath, instancePath, className });

  it('nests by instance path and points leaves at their file', () => {
    const m = buildSourcemap([f('ReplicatedStorage/Modules/Lib.luau', 'game.ReplicatedStorage.Modules.Lib')]);
    expect(m.className).toBe('DataModel');
    const rs = m.children!.find(c => c.name === 'ReplicatedStorage')!;
    // A service's className must equal its name or game:GetService cannot resolve it.
    expect(rs.className).toBe('ReplicatedStorage');
    const mods = rs.children!.find(c => c.name === 'Modules')!;
    expect(mods.className).toBe('Folder');
    const lib = mods.children!.find(c => c.name === 'Lib')!;
    expect(lib.className).toBe('ModuleScript');
    expect(lib.filePaths).toEqual(['ReplicatedStorage/Modules/Lib.luau']);
  });

  it('merges siblings under one parent rather than duplicating it', () => {
    const m = buildSourcemap([
      f('ReplicatedStorage/Modules/A.luau', 'game.ReplicatedStorage.Modules.A'),
      f('ReplicatedStorage/Modules/B.luau', 'game.ReplicatedStorage.Modules.B'),
    ]);
    const rs = m.children!.filter(c => c.name === 'ReplicatedStorage');
    expect(rs).toHaveLength(1);
    expect(rs[0].children!.find(c => c.name === 'Modules')!.children).toHaveLength(2);
  });

  it('keeps a script that is also a parent as a script, not a Folder', () => {
    const m = buildSourcemap([
      f('SSS/Svc/init.luau', 'game.ServerScriptService.Svc'),
      f('SSS/Svc/Helper.luau', 'game.ServerScriptService.Svc.Helper'),
    ]);
    const svc = m.children!.find(c => c.name === 'ServerScriptService')!
      .children!.find(c => c.name === 'Svc')!;
    expect(svc.className).toBe('ModuleScript');
    expect(svc.filePaths).toEqual(['SSS/Svc/init.luau']);
    expect(svc.children!.map(c => c.name)).toEqual(['Helper']);
  });
});
