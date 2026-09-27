// The one place an external program is started. A non-zero exit is a result, not a
// crash: a linter finding problems exits 1, and throwing there reports "the checker
// crashed" instead of "3 errors".
//
// Do not add a version probe here. luau-analyze has no --version and answers
// "Unrecognized option" non-zero, so probing a binary already on disk calls a working
// tool missing. Locating is PathFinder's job.

import { execFile } from 'child_process';

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
  combined: string;
  /** Set when the process never started, as opposed to running and exiting non-zero. */
  spawnError?: string;
}

// luau-lsp over a 979 file tree emits megabytes; Node's 1 MB default truncates to ENOBUFS.
const MAX_BUFFER = 64 * 1024 * 1024;

export const ProcessRunner = {
  run(cmd: string, args: string[], cwd?: string, timeoutMs?: number): Promise<RunResult> {
    return new Promise((resolve) => {
      execFile(
        cmd,
        args,
        { cwd, maxBuffer: MAX_BUFFER, windowsHide: true, timeout: timeoutMs },
        (error: any, stdout: string, stderr: string) => {
          const out = stdout ?? '';
          const err = stderr ?? '';
          const combined = (out + (err ? (out ? '\n' : '') + err : '')).trim();
          // ENOENT carries no numeric code -- the program never ran.
          const spawnError = error && typeof error.code !== 'number'
            ? String(error.message ?? error.code)
            : undefined;
          resolve({
            code: error && typeof error.code === 'number' ? error.code : (error ? 1 : 0),
            stdout: out,
            stderr: err,
            combined,
            spawnError,
          });
        }
      );
    });
  },

  async exists(cmd: string): Promise<boolean> {
    const res = await ProcessRunner.run(cmd, ['--version'], undefined, 5000);
    return res.spawnError === undefined;
  },
};
