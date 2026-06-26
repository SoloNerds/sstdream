import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

// THE WALL (moat-as-code). The owner's hard constraint: plugin code is NEVER bundled with the
// static page everyone loads. The plugin host lives only in the local CLI runtime. This test is
// guard #1 — a structural import-graph reachability scan: nothing reachable from app/ + components/
// (the Next static-export roots) may reach lib/plugin-host, and lib/plugin-host may not reach the
// app. Guard #2 is the post-build grep of out/ for the host sentinel (in ci.yml), which also
// catches dynamic import() and re-exports a static scan can miss. Two guards because this IS the
// brand. Modeled on cli/agent/no-codegen.test.ts.

const ROOT = process.cwd();

function resolveSpec(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null; // node_modules / node: builtins — not our source graph
  for (const ext of ['.ts', '.tsx', '.mjs', '.js']) {
    if (existsSync(base + ext)) return base + ext;
    const idx = join(base, `index${ext}`);
    if (existsSync(idx)) return idx;
  }
  return existsSync(base) && statSync(base).isFile() ? base : null;
}

function importSpecs(src: string): string[] {
  return [
    ...[...src.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((m) => m[1]),
    ...[...src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
  ];
}

function walkTs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) return walkTs(p);
    return /\.(ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p) ? [p] : [];
  });
}

/** Every repo file reachable by following imports from the given entry files. */
function reachableFrom(entries: string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length) {
    const f = queue.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    let src: string;
    try {
      src = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    for (const spec of importSpecs(src)) {
      const r = resolveSpec(f, spec);
      if (r && !seen.has(r)) queue.push(r);
    }
  }
  return seen;
}

describe('the static web export can never contain plugin-host code', () => {
  it('nothing reachable from app/ + components/ imports lib/plugin-host', () => {
    const entries = [...walkTs(join(ROOT, 'app')), ...walkTs(join(ROOT, 'components'))];
    const reachable = reachableFrom(entries);
    const leaked = [...reachable].filter((f) => f.includes(`${join('lib', 'plugin-host')}`));
    expect(leaked, `plugin-host leaked into the static import graph: ${leaked.join(', ')}`).toEqual(
      [],
    );
  });

  it('lib/plugin-host imports nothing from app/ or components/ (no back-edge)', () => {
    for (const f of walkTs(join(ROOT, 'lib', 'plugin-host'))) {
      for (const spec of importSpecs(readFileSync(f, 'utf8'))) {
        const bad = /(^|\/)@?\/?(app|components)\//.test(spec);
        expect(bad, `${f} must not import "${spec}"`).toBe(false);
      }
    }
  });
});
