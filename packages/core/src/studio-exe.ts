/**
 * Where Roblox Studio is installed on this machine.
 *
 * Ported from Chrrxs/robloxstudio-mcp (MIT), which resolves this inside a much larger
 * Studio process manager. Only the path resolution is taken: the callers here read files
 * that ship BESIDE the executable (the Assistant skill bundle), and none of them launch or
 * control Studio, so dragging in process management for a path would be all cost.
 *
 * Windows keeps every installed build under LOCALAPPDATA\Roblox\Versions\version-<hash>\,
 * and old builds are not removed on update -- so the newest by mtime is the live one, and
 * picking any other silently reads a stale bundle. From WSL the same folder is reached by
 * asking cmd.exe for the variable and translating with wslpath, because the Linux side has
 * no LOCALAPPDATA of its own.
 */
import { execFileSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import * as os from 'os';
import * as path from 'path';

let wslCache: boolean | undefined;

function isWsl(): boolean {
  if (wslCache !== undefined) return wslCache;
  if (process.platform !== 'linux') {
    wslCache = false;
    return wslCache;
  }
  try {
    wslCache = /microsoft|wsl/i.test(readFileSync('/proc/version', 'utf8'));
  } catch {
    wslCache = false;
  }
  return wslCache;
}

function run(command: string, args: string[], cwd?: string): string {
  return execFileSync(command, args, { encoding: 'utf8', cwd }).trim();
}

function windowsLocalAppData(): string | undefined {
  if (process.platform === 'win32') return process.env.LOCALAPPDATA;
  if (!isWsl()) return undefined;
  try {
    return run('cmd.exe', ['/c', 'echo %LOCALAPPDATA%'],
      existsSync('/mnt/c/Windows') ? '/mnt/c/Windows' : process.cwd());
  } catch {
    return undefined;
  }
}

function toWslPath(windowsPath: string): string {
  if (!isWsl()) return windowsPath;
  return run('wslpath', ['-u', windowsPath]);
}

function programFilesRoots(): string[] {
  // Only meaningful on Windows and from WSL; both env vars are undefined elsewhere and
  // the WSL branch reads the Windows ones through cmd.exe below.
  const raw = [
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
    process.env.ProgramW6432,
  ].filter((value): value is string => !!value);

  if (raw.length === 0 && isWsl()) {
    // WSL sees /mnt/c but none of the Windows program-files variables.
    return ['/mnt/c/Program Files', '/mnt/c/Program Files (x86)'];
  }
  return raw.map(toWslPath);
}

/**
 * Every folder that can hold `version-<hash>` Studio builds on this machine.
 *
 * THREE roots, not one. The upstream this was ported from checks LOCALAPPDATA alone,
 * which is the per-user install -- and on a machine-wide install there is nothing there
 * at all. Measured on the machine this was written on: the running Studio was
 * `C:\Program Files (x86)\Roblox\Versions\version-6e4a276ec16c45ae\RobloxStudioBeta.exe`
 * and the LOCALAPPDATA path did not exist, so skills lookup failed outright.
 */
function versionRoots(): string[] {
  const roots: string[] = [];

  const localAppData = windowsLocalAppData();
  roots.push(localAppData
    ? path.join(toWslPath(localAppData), 'Roblox', 'Versions')
    : path.join(os.homedir(), 'AppData', 'Local', 'Roblox', 'Versions'));

  for (const base of programFilesRoots()) {
    roots.push(path.join(base, 'Roblox', 'Versions'));
  }

  return roots.filter((root, i) => roots.indexOf(root) === i).filter(existsSync);
}

/**
 * Absolute path to the Studio executable. Throws naming the folders it looked in rather
 * than returning undefined, because every caller needs the path and a silent undefined
 * turns into a confusing failure two frames later.
 *
 * Newest by mtime wins: Roblox leaves old builds in place on update, so any other choice
 * silently reads files from a build that is no longer the one running.
 *
 * ROBLOX_STUDIO_EXE overrides everything, for a portable install or a layout this cannot
 * work out.
 */
export function resolveStudioExe(): string {
  if (process.env.ROBLOX_STUDIO_EXE) return process.env.ROBLOX_STUDIO_EXE;

  if (process.platform === 'darwin') {
    return '/Applications/RobloxStudio.app/Contents/MacOS/RobloxStudio';
  }

  if (process.platform !== 'win32' && !isWsl()) {
    throw new Error('Roblox Studio auto-discovery only works on Windows, WSL, and macOS. Set ROBLOX_STUDIO_EXE.');
  }

  const roots = versionRoots();
  if (roots.length === 0) {
    throw new Error('No Roblox Versions folder found under LOCALAPPDATA or Program Files. Set ROBLOX_STUDIO_EXE.');
  }

  const candidates = roots
    .flatMap((root) => readdirSync(root)
      .filter((name) => name.startsWith('version-'))
      .map((name) => path.join(root, name, 'RobloxStudioBeta.exe')))
    .filter(existsSync)
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

  if (candidates.length === 0) {
    throw new Error(`RobloxStudioBeta.exe not found under ${roots.join(', ')}. Set ROBLOX_STUDIO_EXE.`);
  }

  return candidates[0];
}
