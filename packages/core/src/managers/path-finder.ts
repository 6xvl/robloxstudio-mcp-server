// The one walk-up search. Two hand-rolled copies already disagreed about depth, and the
// import.meta one typechecked, built, and returned null at runtime.

import * as fs from 'fs';
import * as path from 'path';

const MAX_LEVELS_UP = 8;

export interface FindOptions {
  shapes: string[][];
  /** A shape counts as found only when every one of these exists inside it. */
  requireAll?: string[];
  from?: Array<string | null | undefined>;
}

function startingPoints(extra?: Array<string | null | undefined>): string[] {
  const roots = [
    ...(extra ?? []),
    process.argv[1] ? path.dirname(process.argv[1]) : null,
    process.cwd(),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const root of roots) {
    if (!root) continue;
    const resolved = path.resolve(root);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    out.push(resolved);
  }
  return out;
}

export const PathFinder = {
  find(options: FindOptions): string | null {
    for (const root of startingPoints(options.from)) {
      let cursor = root;
      for (let up = 0; up < MAX_LEVELS_UP; up++) {
        for (const shape of options.shapes) {
          const candidate = path.join(cursor, ...shape);
          if (!fs.existsSync(candidate)) continue;
          if (options.requireAll?.some(r => !fs.existsSync(path.join(candidate, r)))) continue;
          return candidate;
        }
        const parent = path.dirname(cursor);
        if (parent === cursor) break;
        cursor = parent;
      }
    }
    return null;
  },

  /** Where it looked, so "not found" can be told apart from "never looked there". */
  describeSearch(options: FindOptions): string[] {
    return startingPoints(options.from)
      .filter(() => options.shapes.length > 0)
      .map(root => `${path.join(root, '..', ...options.shapes[0])}  (and up to ${MAX_LEVELS_UP} levels above)`);
  },
};
