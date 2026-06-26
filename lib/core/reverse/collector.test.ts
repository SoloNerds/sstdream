import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Both sanitizers: the standalone collector's INLINED copy, and the canonical module the
// CLI uses. Importing the collector does NOT run its main() (the run-guard sees that
// process.argv[1] is vitest, not the script).
// @ts-expect-error — plain-JS module, no types.
import { sanitize as collectorSanitize } from '@/scripts/sstdream-collect.mjs';
// @ts-expect-error — plain-JS module, no types.
import { sanitize as canonicalSanitize } from '@/scripts/sanitize.mjs';

const COLLECTOR = join(process.cwd(), 'scripts/sstdream-collect.mjs');

// A regression test for the temporal-dead-zone crash: running the collector DIRECTLY used
// to throw "Cannot access 'CONN_STRING' before initialization" because main() ran before
// the sanitizer's consts were initialized. Import-only tests never caught it — so this one
// actually spawns the script end-to-end, the way a user runs it.
describe('sstdream-collect — runs standalone (no clone, one file)', () => {
  let dir: string;
  const STRIPE = 'sk_' + 'live_' + '51Qk8aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789';

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'sstdream-collect-'));
    mkdirSync(join(dir, 'packages', 'infra'), { recursive: true });
    writeFileSync(
      join(dir, 'sst.config.ts'),
      'export default $config({ app() { return { name: "wp", home: "aws" }; }, async run() {} });',
    );
    writeFileSync(
      join(dir, 'packages', 'infra', 'api.ts'),
      `export const fn = new sst.aws.Function("Api", { environment: { STRIPE: "${STRIPE}" } });`,
    );
    writeFileSync(
      join(dir, 'packages', 'infra', 'db.ts'),
      'export const db = new sst.aws.Postgres("Db");',
    );
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('executes directly without a dead-zone crash, redacts secrets, keeps resources', () => {
    // Throws (non-zero exit) if the script crashes — which is the whole point.
    const out = execFileSync(process.execPath, [COLLECTOR], { cwd: dir, encoding: 'utf8' });
    expect(out).toContain('Collected 3 infra file(s)');

    const written = readFileSync(join(dir, 'sstdream-import.txt'), 'utf8');
    expect(written).not.toContain('51Qk8aBcDeFgHiJkLmNoPqRsTuVwXyZ'); // secret gone
    expect(written).toContain('new sst.aws.Function("Api"'); // structure kept
    expect(written).toContain('new sst.aws.Postgres("Db")');
  });

  it('its inlined sanitizer is byte-for-byte equivalent to the canonical scripts/sanitize.mjs', () => {
    type Case = { snippet: string };
    const corpus = JSON.parse(
      Buffer.from(
        readFileSync(join(process.cwd(), 'scripts/secret-corpus.b64'), 'utf8'),
        'base64',
      ).toString('utf8'),
    ) as Case[];
    for (const c of corpus) {
      const a = collectorSanitize(c.snippet) as { text: string; redactions: number };
      const b = canonicalSanitize(c.snippet) as { text: string; redactions: number };
      expect(a.text, 'collector sanitize drifted from canonical').toBe(b.text);
      expect(a.redactions).toBe(b.redactions);
    }
  });
});
