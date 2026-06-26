import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// THE MOAT AS CODE. The product's soul is "we never let AI WRITE your infrastructure."
// The AI agent must therefore have NO import path to the generator/exporter — if it did,
// an LLM's output could become generated `sst.*` code and the promise would be broken.
// This makes that a build-enforced INVARIANT, not a policy. (Modeled on the
// no-raw-internal-anchors guard.) Checks import specifiers only, so comments are exempt.

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const importSpecifiers = (src: string): string[] =>
  [...src.matchAll(/\bimport\b[^;]*?from\s+['"]([^'"]+)['"]/g)]
    .map((m) => m[1])
    .concat([...src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]));

const FORBIDDEN = [/core\/codegen/, /core\/export/, /\/generator(\/|'|")/, /generate(?:Files)?\b/];

describe('moat invariant: the agent never reaches the generator', () => {
  const agentDir = join(process.cwd(), 'cli/agent');
  const files = walk(agentDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

  it('there are agent source files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const f of files) {
    const rel = f.slice(f.indexOf('/cli/') + 1);
    it(`${rel} imports nothing from the generator/exporter`, () => {
      const specifiers = importSpecifiers(readFileSync(f, 'utf8'));
      for (const spec of specifiers) {
        for (const re of FORBIDDEN) {
          expect(re.test(spec), `${rel} must not import "${spec}"`).toBe(false);
        }
      }
    });
  }
});
