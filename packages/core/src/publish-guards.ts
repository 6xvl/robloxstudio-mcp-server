/**
 * Checks place_publish runs before anything reaches a live place.
 *
 * Written after a truncated read shipped a 3,777-line script as 1,000 lines to four live
 * places: the tool reported success at every step, so these checks judge the result itself
 * rather than trusting the steps that produced it.
 */

/** A script losing more than this share of its lines is refused unless allowShrink is set. */
export const MAX_LINE_LOSS = 0.25;

export function lineCount(source: string): number {
  return source.split('\n').length;
}

/**
 * Scripts whose Studio copy is much shorter than the live one. A real edit rarely deletes a
 * quarter of a file; a partial read always does.
 */
export function findSuspiciousShrinks(
  liveSources: Map<string, string>,
  studioSources: Map<string, string>,
  maxLineLoss = MAX_LINE_LOSS,
): string[] {
  const suspicious: string[] = [];
  for (const [path, studioSource] of studioSources) {
    const liveSource = liveSources.get(path);
    if (liveSource === undefined) continue;
    const liveLines = lineCount(liveSource);
    const studioLines = lineCount(studioSource);
    if (studioLines < liveLines * (1 - maxLineLoss)) {
      suspicious.push(`${path}: ${liveLines} lines live -> ${studioLines} in Studio`);
    }
  }
  return suspicious;
}

export const COMPILE_MARKER = 'PUBLISH_COMPILE_RESULT:';

/**
 * Luau that compiles each script's Studio source with loadstring and prints one marker line
 * listing the failures. Paths are dot notation; the separator is built with string.char so no
 * escape sequence has to survive the trip into Studio.
 */
export function buildCompileCheckLuau(scriptPaths: string[]): string {
  const list = scriptPaths.map((path) => JSON.stringify(path)).join(', ');
  return [
    'local failures = {}',
    `for _, path in { ${list} } do`,
    '\tlocal instance = game',
    '\tfor part in string.gmatch(path, "[^%.]+") do',
    '\t\tif part ~= "game" then instance = instance and instance:FindFirstChild(part) end',
    '\tend',
    '\tif not instance then',
    '\t\ttable.insert(failures, path .. ": not found in Studio")',
    '\telse',
    '\t\tlocal compiled, err = loadstring(instance.Source)',
    '\t\tif not compiled then table.insert(failures, path .. ": " .. tostring(err)) end',
    '\tend',
    'end',
    `print("${COMPILE_MARKER}" .. table.concat(failures, string.char(31)))`,
  ].join('\n');
}

/** Failures from the compile check's output lines; throws if the marker never came back. */
export function parseCompileCheck(outputLines: unknown): string[] {
  const lines = Array.isArray(outputLines) ? outputLines.map(String) : [];
  const marker = lines.find((line) => line.includes(COMPILE_MARKER));
  if (marker === undefined) {
    throw new Error('Compile check did not report back from Studio; refusing to publish unchecked code');
  }
  const body = marker.slice(marker.indexOf(COMPILE_MARKER) + COMPILE_MARKER.length);
  return body === '' ? [] : body.split(String.fromCharCode(31));
}
