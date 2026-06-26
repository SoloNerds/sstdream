import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanRepo, appNameFrom } from './scan';

// A realistic MULTI-FILE SST project — the exact shape that breaks single-file paste:
// sst.config.ts dynamically import()s packages/infra/*.ts, so the config alone has no
// `new sst.aws.*`. The scanner must find the resources in the modules, redact a
// hardcoded secret BEFORE parsing, and honestly surface what it can't model.
let dir: string;

// Built by concatenation so no contiguous `sk_live_…` literal lives in this source file
// (it would trip GitHub push protection). At runtime the fixture file gets the full key,
// which is exactly what the sanitizer must catch.
const FAKE_STRIPE = 'sk_' + 'live_' + '51Qk8aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789';

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'sstdream-scan-'));
  mkdirSync(join(dir, 'packages', 'infra'), { recursive: true });
  writeFileSync(
    join(dir, 'sst.config.ts'),
    `export default $config({
       app() { return { name: "acme-prod", home: "aws" }; },
       async run() { for (const m of require("fs").readdirSync("./packages/infra")) await import("./packages/infra/" + m); },
     });`,
  );
  writeFileSync(
    join(dir, 'packages', 'infra', 'network.ts'),
    `export const vpc = new sst.aws.Vpc("Vpc", { nat: "ec2" });`,
  );
  writeFileSync(
    join(dir, 'packages', 'infra', 'api.ts'),
    `export const db = new sst.aws.Dynamo("Users", { fields: { id: "string" }, primaryIndex: { hashKey: "id" } });
     export const api = new sst.aws.Function("Health", {
       handler: "packages/functions/health.handler",
       link: [db],
       environment: { STRIPE_KEY: "${FAKE_STRIPE}" },
     });`,
  );
  writeFileSync(
    join(dir, 'packages', 'infra', 'auth.ts'),
    `export const q = new sst.aws.Queue("Mailer");`,
  );
  writeFileSync(join(dir, 'package.json'), '{"name":"acme","dependencies":{"sst":"3.0.0"}}');
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('sst-dream scan — multi-file local repo', () => {
  const now = '2026-06-26T00:00:00.000Z';

  it('recovers resources spread across packages/infra/*.ts', () => {
    const r = scanRepo(dir, now);
    expect(r.target).toBe('aws-sst-v4');
    expect(r.appName).toBe('acme-prod');
    const names = r.nodes.map((n) => n.name).sort();
    expect(names).toEqual(['Health', 'Mailer', 'Users']);
    expect(r.nodes.every((n) => n.confidence === 'high')).toBe(true);
  });

  it('redacts a hardcoded secret BEFORE parsing — it never reaches the output', () => {
    const r = scanRepo(dir, now);
    expect(r.redactions).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(r)).not.toContain(FAKE_STRIPE);
    expect(JSON.stringify(r)).not.toContain('51Qk8aBcDeFgHiJkLmNoPqRsTuVwXyZ');
  });

  it('honestly surfaces what it could not model (no silent drops)', () => {
    const r = scanRepo(dir, now);
    // Vpc is auto-managed in SSTDREAM's model → not a node, but it MUST be reported.
    expect(r.unmodeled.some((u) => u.snippet.includes('Vpc'))).toBe(true);
  });

  it('runs the engines over the recovered graph (cost / wiring)', () => {
    const r = scanRepo(dir, now);
    expect(r.cost.totalMonthlyUsd).toBeGreaterThan(0);
    // the Function is linked to Dynamo → that edge is recovered
    expect(r.edges.some((e) => e.intent === 'writesTo')).toBe(true);
  });

  it('resolves links across files through an object-map + spread (no orphaned secrets)', () => {
    // The exact real-world shape that produced zero edges: secrets in an object map in
    // one file, spread-linked from the app in another.
    const proj = mkdtempSync(join(tmpdir(), 'sstdream-edges-'));
    mkdirSync(join(proj, 'infra'), { recursive: true });
    writeFileSync(
      join(proj, 'sst.config.ts'),
      'export default $config({ app() { return { name: "x", home: "aws" }; }, async run() {} });',
    );
    writeFileSync(
      join(proj, 'infra', 'secrets.ts'),
      'export const secrets = { db: new sst.Secret("DATABASE_URL"), stripe: new sst.Secret("StripeSecret") };\nexport const allSecrets = Object.values(secrets);',
    );
    writeFileSync(
      join(proj, 'infra', 'web.ts'),
      'export const web = new sst.aws.Nextjs("Web", { link: [...allSecrets] });',
    );
    const r = scanRepo(proj, now);
    const web = r.nodes.find((n) => n.name === 'Web')!;
    const secretEdges = r.edges.filter((e) => e.source === web.id && e.intent === 'usesSecret');
    expect(secretEdges).toHaveLength(2); // both secrets linked — not orphaned
    rmSync(proj, { recursive: true, force: true });
  });

  it('shows an unmodeled construct (e.g. CognitoIdentityPool) as a node, not a dropped line', () => {
    const proj = mkdtempSync(join(tmpdir(), 'sstdream-generic-'));
    writeFileSync(
      join(proj, 'sst.config.ts'),
      'export default $config({ app() { return { name: "x", home: "aws" }; }, run() { new sst.aws.CognitoIdentityPool("IdPool"); } });',
    );
    const r = scanRepo(proj, now);
    const idPool = r.nodes.find((n) => n.name === 'IdPool');
    expect(idPool?.kind).toBe('unknown'); // appears as a generic node
    expect(r.unmodeled.some((u) => u.snippet.includes('CognitoIdentityPool'))).toBe(true); // still honest
    rmSync(proj, { recursive: true, force: true });
  });

  it('appName comes from the app() block, not a resource name prop (regression)', () => {
    // A resource named before the config used to hijack the app name (e.g. a Cognito
    // pool / SES identity called "verified_email"). The app name must come from the
    // app() block, where `name` sits next to `home`.
    const blob = `
      export const pool = new sst.aws.CognitoUserPool("Auth", { name: "verified_email" });
      export default $config({ app() { return { name: "wellness-portal", home: "aws" }; }, async run() {} });
    `;
    expect(appNameFrom(blob, 'fallback')).toBe('wellness-portal');
    // home-before-name order also works
    expect(appNameFrom('return { home: "aws", name: "my-app" }', 'fb')).toBe('my-app');
  });
});
