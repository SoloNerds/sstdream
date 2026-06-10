import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { buildExport } from '@/lib/core/export/manifest';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { validateBlueprint } from '@/lib/core/validation/validate';
import { TEMPLATES } from '@/lib/templates/registry';
import type { Blueprint } from '@/lib/core/blueprint/types';

// The compile-the-export meta-test (#124): every generated file of every
// template — plus a kitchen-sink design touching all 21 AWS kinds — must be
// syntactically valid. "Correctness is the product": string assertions and
// snapshots can't catch a broken paren; this parses everything the user gets.

const NOW = '2026-06-08T00:00:00.000Z';

function parseDiagnostics(path: string, content: string): string[] {
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, kind);
  const diags = (sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics ?? [];
  return diags.map(
    (d) => `${path}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')} (pos ${d.start})`,
  );
}

function assertExportParses(bp: Blueprint, label: string) {
  const files = buildExport(bp);
  expect(files.length).toBeGreaterThan(0);
  const problems: string[] = [];
  for (const f of files) {
    if (/\.(ts|tsx)$/.test(f.path)) {
      problems.push(...parseDiagnostics(`${label}/${f.path}`, f.content));
    } else if (f.path.endsWith('.json')) {
      try {
        JSON.parse(f.content);
      } catch (err) {
        problems.push(`${label}/${f.path}: invalid JSON — ${String(err)}`);
      }
    }
  }
  expect(problems).toEqual([]);
}

describe('the harness itself detects breakage', () => {
  it('flags a syntax error (parseDiagnostics is not silently empty)', () => {
    expect(parseDiagnostics('broken.ts', 'const x = "unterminated;\n}')).not.toEqual([]);
    expect(parseDiagnostics('ok.ts', 'export const x = 1;\n')).toEqual([]);
  });
});

describe('every template exports a parseable project', () => {
  for (const t of TEMPLATES) {
    it(`${t.id} (${t.target}) validates clean and parses`, () => {
      const bp = draftBlueprint(t.snapshot, t.target, t.app, NOW);
      expect(validateBlueprint(bp).errors).toEqual([]);
      assertExportParses(bp, t.id);
    });
  }
});

describe('kitchen-sink design (all 21 AWS kinds) exports a parseable project', () => {
  type N = {
    id: string;
    kind: string;
    name: string;
    props: Record<string, unknown>;
    position: { x: number; y: number };
  };
  const n = (id: string, kind: string, name: string, props: Record<string, unknown> = {}): N => ({
    id,
    kind,
    name,
    props,
    position: { x: 0, y: 0 },
  });
  const e = (id: string, source: string, target: string, intent: string) => ({
    id,
    source,
    target,
    intent,
  });

  const bp = draftBlueprint(
    {
      nodes: [
        n('web', 'nextjs', 'Web', { domain: 'example.com' }),
        n('site', 'staticsite', 'Docs', {
          // quotes prove the #120 escaping end-to-end
          buildCommand: 'echo "building" && vite build',
          buildOutput: 'dist',
          routePath: '/docs',
        }),
        n('edge', 'router', 'Edge'),
        n('assets', 'bucket', 'Assets', { access: 'cloudfront', routePath: '/files' }),
        n('uploads', 'bucket', 'Uploads'),
        n('table', 'dynamo', 'AppTable', { gsiName: 'by-email', gsiHashKey: 'email' }),
        n('audit', 'dynamo', 'AuditLog', { hashKey: 'logId', rangeKey: 'at' }),
        n('pg', 'postgres', 'Relational'),
        n('au', 'aurora', 'Warehouse'),
        n('jobs', 'queue', 'Jobs'),
        n('events', 'bus', 'Events'),
        n('alerts', 'snstopic', 'Alerts'),
        n('api', 'apigatewayv2', 'HttpApi'),
        n('w1', 'worker', 'ProcessJob'),
        n('w2', 'worker', 'OnEvent'),
        n('w3', 'worker', 'OnAlert'),
        n('w4', 'worker', 'GetItems', { route: 'GET /items/{id}' }),
        n('w5', 'worker', 'OnUpload'),
        n('w6', 'worker', 'NightlySweep'),
        n('w7', 'worker', 'Standalone', { timeout: '2 minutes', memory: '512 MB' }),
        n('cron', 'cron', 'Nightly', { schedule: 'rate(1 day)' }),
        n('sec', 'secret', 'ApiToken'),
        n('mail', 'email', 'Mailer', { sender: 'noreply@example.com' }),
        n('pool', 'cognito', 'AuthPool'),
        n('clerk', 'clerk', 'Clerk'),
        n('stripe', 'stripe', 'Stripe'),
        n('mongo', 'mongodb', 'Mongo'),
        n('ext', 'externalApi', 'Weather', {
          baseUrlEnv: 'WEATHER_BASE_URL',
          keyEnv: 'WEATHER_KEY',
        }),
        n('ai', 'ai', 'AnthropicKey'),
      ],
      edges: [
        e('e1', 'web', 'uploads', 'uploadsTo'),
        e('e2', 'web', 'table', 'writesTo'),
        e('e3', 'web', 'jobs', 'publishesTo'),
        e('e4', 'web', 'pg', 'queriesDb'),
        e('e5', 'web', 'mail', 'sendsEmail'),
        e('e6', 'web', 'sec', 'usesSecret'),
        e('e7', 'web', 'ai', 'usesAI'),
        e('e8', 'web', 'pool', 'usesCognito'),
        e('e9', 'web', 'clerk', 'usesAuth'),
        e('e10', 'web', 'stripe', 'usesStripe'),
        e('e11', 'web', 'mongo', 'queriesMongo'),
        e('e12', 'web', 'ext', 'callsApi'),
        e('e13', 'w1', 'jobs', 'subscribesTo'),
        e('e14', 'w1', 'audit', 'writesTo'),
        e('e15', 'w2', 'events', 'subscribesTo'),
        e('e16', 'w2', 'ai', 'usesAI'),
        e('e17', 'w3', 'alerts', 'subscribesTo'),
        e('e18', 'w4', 'api', 'handlesRoute'),
        e('e19', 'w5', 'uploads', 'handlesBucketEvents'),
        e('e20', 'cron', 'w6', 'invokes'),
        e('e21', 'cron', 'sec', 'usesSecret'),
        e('e22', 'w7', 'au', 'queriesDb'),
        e('e23', 'edge', 'assets', 'routesBucket'),
        e('e24', 'site', 'edge', 'routedBy'),
        e('e25', 'web', 'events', 'publishesTo'),
        e('e26', 'web', 'alerts', 'publishesTo'),
      ],
    },
    'aws-sst-v4',
    { name: 'kitchen-sink', region: 'us-east-1', packageManager: 'yarn' },
    NOW,
  );

  it('covers all 21 catalog kinds', () => {
    expect(new Set(bp.resources.map((r) => r.kind)).size).toBe(21);
  });

  it('validates clean', () => {
    expect(validateBlueprint(bp).errors).toEqual([]);
  });

  it('every generated file parses', () => {
    assertExportParses(bp, 'kitchen-sink');
  });
});
