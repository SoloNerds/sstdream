import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findDeprecations } from './deprecations';
import { runCheck, runExplain } from './run';
import { scanRepo, listInfraSources } from '../scan';

describe('agent check — grounded deprecation detection', () => {
  it('flags the deprecated sst.aws.Cron with a doc citation', () => {
    const hits = findDeprecations([
      {
        path: 'infra/crons.ts',
        text: 'export const c = new sst.aws.Cron("Daily", { job: "x.handler" });',
      },
    ]);
    expect(hits.some((h) => h.id === 'cron')).toBe(true);
    expect(hits.find((h) => h.id === 'cron')!.doc).toContain('sst-v4-target.md');
    // CronV2 is NOT flagged as the deprecated-Cron rule
    const ok = findDeprecations([
      {
        path: 'x.ts',
        text: 'new sst.aws.CronV2("Daily", { function: "x.handler", schedule: "rate(1 day)" });',
      },
    ]);
    expect(ok.some((h) => h.id === 'cron')).toBe(false);
  });

  it('flags sst/constructs, removal:"destroy", and Bucket public:true', () => {
    const hits = findDeprecations([
      { path: 'a.ts', text: 'import { StackContext } from "sst/constructs";' },
      { path: 'b.ts', text: 'new sst.aws.Bucket("B", { public: true });' },
      { path: 'c.ts', text: 'new sst.aws.Dynamo("D", { removal: "destroy" });' },
    ]);
    const ids = new Set(hits.map((h) => h.id));
    expect(ids.has('sst-constructs')).toBe(true);
    expect(ids.has('bucket-public-bool')).toBe(true);
    expect(ids.has('removal-destroy')).toBe(true);
  });

  it('runCheck reports clean when the config is current', () => {
    const a = runCheck([
      {
        path: 'x.ts',
        text: 'new sst.aws.CronV2("D", { function: "h", schedule: "rate(1 day)" });',
      },
    ]);
    expect(a.title).toContain('No deprecated');
    expect(a.knownFacts).toHaveLength(0);
  });
});

describe('agent explain — grounded in the scanned graph', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'sstdream-agent-'));
    mkdirSync(join(dir, 'infra'), { recursive: true });
    writeFileSync(
      join(dir, 'sst.config.ts'),
      'export default $config({ app() { return { name: "x", home: "aws" }; }, async run() {} });',
    );
    writeFileSync(
      join(dir, 'infra', 'main.ts'),
      'const db = new sst.Secret("DatabaseUrl");\nnew sst.aws.Nextjs("Web", { link: [db] });',
    );
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('explains a resource from facts (kind, edges) — every fact cited', () => {
    const scan = scanRepo(dir, '2026-06-26T00:00:00.000Z');
    const a = runExplain(scan, 'Web');
    expect(a.title).toContain('Web');
    expect(a.knownFacts.every((f) => f.source.length > 0)).toBe(true); // citation-only slot
    expect(a.knownFacts.some((f) => /usesSecret|DatabaseUrl/.test(f.text))).toBe(true);
  });

  it('listInfraSources returns the raw infra files for the check', () => {
    const files = listInfraSources(dir);
    expect(files.some((f) => f.path === 'infra/main.ts')).toBe(true);
  });
});
