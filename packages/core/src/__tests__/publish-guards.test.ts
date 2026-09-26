import {
  buildCompileCheckLuau,
  COMPILE_MARKER,
  findSuspiciousShrinks,
  parseCompileCheck,
} from '../publish-guards.js';

const lines = (n: number) => Array.from({ length: n }, (_, i) => `local x${i} = ${i}`).join('\n');

describe('findSuspiciousShrinks', () => {
  it('refuses the real incident: 3,777 lines live, 1,000 read from Studio', () => {
    const found = findSuspiciousShrinks(
      new Map([['ServerScriptService.Services.GeneralService', lines(3777)]]),
      new Map([['ServerScriptService.Services.GeneralService', lines(1000)]]),
    );
    expect(found).toEqual(['ServerScriptService.Services.GeneralService: 3777 lines live -> 1000 in Studio']);
  });

  it('lets normal edits through, including growth and small deletions', () => {
    const live = new Map([['A', lines(1214)], ['B', lines(100)], ['C', lines(40)]]);
    const studio = new Map([['A', lines(1295)], ['B', lines(80)], ['C', lines(40)]]);
    expect(findSuspiciousShrinks(live, studio)).toEqual([]);
  });

  it('ignores scripts that are new to the live place', () => {
    expect(findSuspiciousShrinks(new Map(), new Map([['New', lines(3)]]))).toEqual([]);
  });
});

describe('compile check', () => {
  it('builds Luau with no backslash escapes and one marker print', () => {
    const code = buildCompileCheckLuau(['ServerScriptService.Main', 'game.ReplicatedStorage.Modules.Stage']);
    expect(code).not.toContain('\\');
    expect(code).toContain(COMPILE_MARKER);
    expect(code).toContain('"ServerScriptService.Main"');
  });

  it('reads an empty result as clean and a filled one as failures', () => {
    expect(parseCompileCheck(['noise', `${COMPILE_MARKER}`])).toEqual([]);
    const sep = String.fromCharCode(31);
    expect(parseCompileCheck([`${COMPILE_MARKER}A: Expected 'end'${sep}B: not found in Studio`]))
      .toEqual(["A: Expected 'end'", 'B: not found in Studio']);
  });

  it('refuses to treat a missing report as a pass', () => {
    expect(() => parseCompileCheck(['something else'])).toThrow(/did not report back/);
    expect(() => parseCompileCheck(undefined)).toThrow(/did not report back/);
  });
});
