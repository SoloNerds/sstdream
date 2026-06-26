import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The committed, self-contained drop-in bundle users actually run. This test executes
// THAT artifact (scripts/sst-dream.mjs) against a real multi-file project — no clone, no
// build at test time — proving "drop the folder into your project and run it" works and
// stays working. (CI separately rebuilds it and fails on drift, so it can't go stale.)
const BUNDLE = join(process.cwd(), 'scripts/sst-dream.mjs');

describe('sst-dream.mjs — the committed drop-in bundle runs standalone', () => {
  let proj: string;
  let out: string;
  const STRIPE = 'sk_' + 'live_' + '51Qk8aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789';

  beforeAll(() => {
    proj = mkdtempSync(join(tmpdir(), 'sstdream-dropin-'));
    out = mkdtempSync(join(tmpdir(), 'sstdream-dropin-out-'));
    mkdirSync(join(proj, 'packages', 'infra'), { recursive: true });
    writeFileSync(
      join(proj, 'sst.config.ts'),
      'export default $config({ app() { return { name: "dropin-app", home: "aws" }; }, async run() {} });',
    );
    writeFileSync(
      join(proj, 'packages', 'infra', 'api.ts'),
      `export const fn = new sst.aws.Function("Api", { environment: { STRIPE: "${STRIPE}" } });`,
    );
    writeFileSync(
      join(proj, 'packages', 'infra', 'db.ts'),
      'export const db = new sst.aws.Dynamo("Users", { fields: { id: "string" }, primaryIndex: { hashKey: "id" } });',
    );
  });

  afterAll(() => {
    rmSync(proj, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  });

  it('scans a project to ARCHITECTURE.md without a clone/install, redacting secrets', () => {
    // Throws (non-zero exit) if the committed bundle is broken — the regression guard.
    const stdout = execFileSync(process.execPath, [BUNDLE, 'scan', proj, '--out', out], {
      encoding: 'utf8',
    });
    expect(stdout).toContain('resource(s) recovered');

    expect(existsSync(join(out, 'ARCHITECTURE.md'))).toBe(true);
    const md = readFileSync(join(out, 'ARCHITECTURE.md'), 'utf8');
    expect(md).toContain('dropin-app'); // app name recovered
    expect(md).toContain('Api'); // resource recovered

    // The planted secret is gone from BOTH outputs.
    const jsonText = readFileSync(join(out, 'sstdream-scan.json'), 'utf8');
    expect(md + jsonText).not.toContain('51Qk8aBcDeFgHiJkLmNoPqRsTuVwXyZ');
  });
});
