import { describe, it, expect } from 'vitest';
import { generateFiles } from '@/lib/core/codegen/generate';
import { validateBlueprint } from '@/lib/core/validation/validate';
import { blueprintToCanvas, draftBlueprint } from '@/lib/core/blueprint/serialize';
import { awsDefaultIntent } from '@/lib/targets/aws-sst-v4/edges';
import type { Blueprint } from '@/lib/core/blueprint/types';

// Regression tests for the export gate (#120 prop escaping, #121 validation
// batch, #122 silently-dropped edges). Validation-clean canvases must never
// export broken projects.

const NOW = '2026-06-08T00:00:00.000Z';
const APP = { name: 'gate-app', region: 'us-east-1', packageManager: 'yarn' as const };

type Node = {
  id: string;
  kind: string;
  name: string;
  props: Record<string, unknown>;
  position: { x: number; y: number };
};
type Edge = { id: string; source: string; target: string; intent: string };

const n = (id: string, kind: string, name: string, props: Record<string, unknown> = {}): Node => ({
  id,
  kind,
  name,
  props,
  position: { x: 0, y: 0 },
});
const e = (id: string, source: string, target: string, intent: string): Edge => ({
  id,
  source,
  target,
  intent,
});

const mk = (nodes: Node[], edges: Edge[]): Blueprint =>
  draftBlueprint({ nodes, edges }, 'aws-sst-v4', APP, NOW);

const config = (bp: Blueprint) =>
  generateFiles(bp).find((f) => f.path === 'sst.config.ts')!.content;

const rulesOf = (bp: Blueprint, rule: string) =>
  validateBlueprint(bp).errors.filter((d) => d.rule === rule);

describe('prop escaping (#120)', () => {
  it('a quote in a free-text prop emits escaped, parseable TypeScript', () => {
    const bp = mk([n('web', 'nextjs', 'Web', { domain: 'evil".example.com' })], []);
    const c = config(bp);
    expect(c).toContain('domain: "evil\\".example.com",');
    expect(c).not.toContain('domain: "evil".example.com"');
  });

  it('a quoted build command survives JSON-escaped', () => {
    const bp = mk(
      [n('s', 'staticsite', 'Site', { buildCommand: 'echo "hi" && build', buildOutput: 'dist' })],
      [],
    );
    expect(config(bp)).toContain('build: { command: "echo \\"hi\\" && build", output: "dist" },');
  });

  it('non-identifier dynamo keys are emitted quoted (valid TS even pre-validation)', () => {
    const bp = mk([n('t', 'dynamo', 'Items', { hashKey: 'user-id', rangeKey: '' })], []);
    const c = config(bp);
    expect(c).toContain('"user-id": "string",');
    expect(c).toContain('hashKey: "user-id"');
  });

  it('clean inputs produce byte-identical output to the old renderer', () => {
    const bp = mk(
      [n('web', 'nextjs', 'Web', { domain: 'example.com' }), n('q', 'queue', 'Jobs')],
      [e('e1', 'web', 'q', 'publishesTo')],
    );
    const c = config(bp);
    expect(c).toContain('new sst.aws.Nextjs("Web", {');
    expect(c).toContain('domain: "example.com",');
    expect(c).toContain('new sst.aws.Queue("Jobs");');
  });
});

describe('validation batch (#121)', () => {
  it('unknown resource kinds error instead of silently vanishing', () => {
    const bp = mk([n('x', 'magicbox', 'Magic')], []);
    expect(rulesOf(bp, 'known-resource-kind')).toHaveLength(1);
  });

  it('a resource named after a reserved/generator-owned variable errors', () => {
    expect(rulesOf(mk([n('w', 'worker', 'Function')], []), 'var-name-collision')).toHaveLength(1);
    expect(rulesOf(mk([n('p', 'postgres', 'Vpc')], []), 'var-name-collision')).toHaveLength(1);
  });

  it('two names that camelCase to the same variable error', () => {
    // "JobQueue" and "jobQueue" both become the const jobQueue.
    const bp = mk([n('a', 'queue', 'JobQueue'), n('b', 'bucket', 'jobQueue')], []);
    expect(rulesOf(bp, 'var-name-collision')).toHaveLength(1);
  });

  it('non-identifier dynamo keys error (generated runtime uses them as identifiers)', () => {
    const bp = mk([n('t', 'dynamo', 'Items', { hashKey: 'user-id' })], []);
    expect(rulesOf(bp, 'dynamo-keys-identifier-safe')).toHaveLength(1);
    expect(
      rulesOf(
        mk([n('t', 'dynamo', 'Items', { hashKey: 'userId' })], []),
        'dynamo-keys-identifier-safe',
      ),
    ).toHaveLength(0);
  });

  it('a half-configured GSI errors instead of silently degrading', () => {
    const bp = mk([n('t', 'dynamo', 'Items', { gsiName: 'GSI1' })], []);
    expect(rulesOf(bp, 'gsi-complete')).toHaveLength(1);
  });

  it('free-text cron schedules error unless rate()/cron()/at()', () => {
    const bad = mk(
      [n('c', 'cron', 'Nightly', { schedule: 'every day' }), n('w', 'worker', 'Sweep')],
      [e('e1', 'c', 'w', 'invokes')],
    );
    expect(rulesOf(bad, 'cron-schedule-format')).toHaveLength(1);
    const good = mk(
      [n('c', 'cron', 'Nightly', { schedule: 'rate(1 day)' }), n('w', 'worker', 'Sweep')],
      [e('e1', 'c', 'w', 'invokes')],
    );
    expect(rulesOf(good, 'cron-schedule-format')).toHaveLength(0);
  });

  it('malformed routes and per-API duplicates error', () => {
    const malformed = mk(
      [n('api', 'apigatewayv2', 'Api'), n('w', 'worker', 'Handler', { route: 'whenever' })],
      [e('e1', 'w', 'api', 'handlesRoute')],
    );
    expect(rulesOf(malformed, 'route-format-and-unique')).toHaveLength(1);

    // Two workers left on the default "GET /" collide on one API.
    const dupes = mk(
      [
        n('api', 'apigatewayv2', 'Api'),
        n('w1', 'worker', 'HandlerA'),
        n('w2', 'worker', 'HandlerB'),
      ],
      [e('e1', 'w1', 'api', 'handlesRoute'), e('e2', 'w2', 'api', 'handlesRoute')],
    );
    expect(rulesOf(dupes, 'route-format-and-unique')).toHaveLength(1);

    // The same route on DIFFERENT APIs is fine.
    const twoApis = mk(
      [
        n('a1', 'apigatewayv2', 'ApiOne'),
        n('a2', 'apigatewayv2', 'ApiTwo'),
        n('w1', 'worker', 'HandlerA'),
        n('w2', 'worker', 'HandlerB'),
      ],
      [e('e1', 'w1', 'a1', 'handlesRoute'), e('e2', 'w2', 'a2', 'handlesRoute')],
    );
    expect(rulesOf(twoApis, 'route-format-and-unique')).toHaveLength(0);
  });

  it('a half-configured static-site build errors', () => {
    const bp = mk([n('s', 'staticsite', 'Site', { buildCommand: 'npm run build' })], []);
    expect(rulesOf(bp, 'staticsite-build-complete')).toHaveLength(1);
  });
});

describe('silently-dropped edges (#122)', () => {
  it('cron secrets are linked into the generated CronV2 function', () => {
    const bp = mk(
      [
        n('c', 'cron', 'Nightly', { schedule: 'rate(1 day)' }),
        n('w', 'worker', 'Sweep'),
        n('s', 'secret', 'ApiKey'),
      ],
      [e('e1', 'c', 'w', 'invokes'), e('e2', 'c', 's', 'usesSecret')],
    );
    const c = config(bp);
    expect(c).toMatch(/function: \{[\s\S]*?link: \[apiKey\],[\s\S]*?\},/);
  });

  it('legacy linksTo edges now fail validation instead of silently no-opping', () => {
    const bp = mk(
      [n('r', 'router', 'Edge'), n('s', 'staticsite', 'Site')],
      [e('e1', 'r', 's', 'linksTo')],
    );
    const errs = validateBlueprint(bp).errors.filter((d) => d.rule === 'edge-intent-applicability');
    expect(errs).toHaveLength(1);
    expect(errs[0].message).toContain('Unknown connection intent');
  });

  it('loading a legacy design heals linksTo to the real default intent (or drops it)', () => {
    const bp = mk(
      [
        n('web', 'nextjs', 'Web'),
        n('b', 'bucket', 'Uploads'),
        n('r', 'router', 'Edge'),
        n('s', 'staticsite', 'Site'),
      ],
      [e('e1', 'web', 'b', 'linksTo'), e('e2', 'r', 's', 'linksTo')],
    );
    const snapshot = blueprintToCanvas(bp);
    expect(snapshot.edges).toHaveLength(1);
    expect(snapshot.edges[0].intent).toBe('uploadsTo');
  });

  it('workers can use AI again (link only — no chat route without a Next.js app)', () => {
    expect(awsDefaultIntent('worker', 'ai')).toBe('usesAI');
    const workerOnly = mk(
      [n('q', 'queue', 'Jobs'), n('w', 'worker', 'Summarize'), n('ai', 'ai', 'AnthropicKey')],
      [e('e1', 'w', 'q', 'subscribesTo'), e('e2', 'w', 'ai', 'usesAI')],
    );
    const paths = generateFiles(workerOnly).map((f) => f.path);
    expect(paths).toContain('lib/ai.ts');
    expect(paths).not.toContain('app/api/chat/route.ts');
  });
});

describe('second-round review fixes', () => {
  it('route handlers quote the route string; route charset is gated', () => {
    const bp = mk(
      [n('api', 'apigatewayv2', 'Api'), n('w', 'worker', 'GetItem', { route: 'GET /items/{id}' })],
      [e('e1', 'w', 'api', 'handlesRoute')],
    );
    // {id} path params stay legal...
    expect(rulesOf(bp, 'route-format-and-unique')).toHaveLength(0);
    const handler = generateFiles(bp).find((f) => f.path === 'src/workers/get-item.ts')!.content;
    expect(handler).toContain('route: "GET /items/{id}"');
    // ...but quotes/backslashes no longer pass the gate.
    const evil = mk(
      [n('api', 'apigatewayv2', 'Api'), n('w', 'worker', 'Evil', { route: 'GET /a"b' })],
      [e('e1', 'w', 'api', 'handlesRoute')],
    );
    expect(rulesOf(evil, 'route-format-and-unique')).toHaveLength(1);
  });

  it('externalApi env names must be UPPER_SNAKE_CASE (identifier position)', () => {
    const bad = mk([n('x', 'externalApi', 'Weather', { keyEnv: 'api key' })], []);
    expect(rulesOf(bad, 'env-var-name-format')).toHaveLength(1);
    const good = mk([n('x', 'externalApi', 'Weather', { keyEnv: 'WEATHER_KEY' })], []);
    expect(rulesOf(good, 'env-var-name-format')).toHaveLength(0);
  });

  it('reserved words and form locals are rejected as table keys; GSI names are exempt', () => {
    expect(
      rulesOf(
        mk([n('t', 'dynamo', 'Items', { hashKey: 'delete' })], []),
        'dynamo-keys-identifier-safe',
      ),
    ).toHaveLength(1);
    expect(
      rulesOf(
        mk([n('t', 'dynamo', 'Items', { hashKey: 'router' })], []),
        'dynamo-keys-identifier-safe',
      ),
    ).toHaveLength(1);
    // GSI fields are always emitted quoted — hyphenated index names are fine.
    expect(
      rulesOf(
        mk([n('t', 'dynamo', 'Items', { gsiName: 'by-email', gsiHashKey: 'email' })], []),
        'dynamo-keys-identifier-safe',
      ),
    ).toHaveLength(0);
  });

  it('a lone gsiRangeKey is flagged as a half-configured GSI', () => {
    const bp = mk([n('t', 'dynamo', 'Items', { gsiRangeKey: 'createdAt' })], []);
    expect(rulesOf(bp, 'gsi-complete')).toHaveLength(1);
  });

  it('strict-mode reserved names are blocked only for resources that become consts', () => {
    // A bucket always becomes a const — "Public" would emit `const public`.
    expect(rulesOf(mk([n('b', 'bucket', 'Public')], []), 'var-name-collision')).toHaveLength(1);
    // A triggered worker never becomes a const — "Export" is fine there.
    const subscriber = mk(
      [n('q', 'queue', 'Jobs'), n('w', 'worker', 'Export')],
      [e('e1', 'w', 'q', 'subscribesTo')],
    );
    expect(rulesOf(subscriber, 'var-name-collision')).toHaveLength(0);
    // ...but a standalone worker does become `const export`.
    const standalone = mk([n('w', 'worker', 'Export')], []);
    expect(rulesOf(standalone, 'var-name-collision')).toHaveLength(1);
  });

  it('cognito claims its generated <var>Client const', () => {
    const bp = mk([n('c', 'cognito', 'Auth'), n('q', 'queue', 'AuthClient')], []);
    expect(rulesOf(bp, 'var-name-collision')).toHaveLength(1);
  });
});

// #143: kebabCase(name) drives generated file paths and is many-to-one, so two
// individually-valid names can collide on one path. var-name-collision uses
// camelCase and misses these, so the design exported ok=true and a file was
// silently dropped or cross-wired. These must now be export-gate errors.
describe('kebab-path-collision (#143)', () => {
  it('two workers whose names kebab to the same slug are blocked', () => {
    // both -> "process-job"; distinct camelCase (aProcessJob / aPROcessJob) so
    // var-name-collision does NOT catch them.
    const bp = mk(
      [n('q', 'queue', 'Jobs'), n('w1', 'worker', 'ProcessJob'), n('w2', 'worker', 'PROcessJob')],
      [e('e1', 'w1', 'q', 'subscribesTo'), e('e2', 'w2', 'q', 'subscribesTo')],
    );
    expect(rulesOf(bp, 'var-name-collision')).toHaveLength(0);
    expect(rulesOf(bp, 'kebab-path-collision')).toHaveLength(1);
    expect(validateBlueprint(bp).ok).toBe(false);
  });

  it('two Dynamo tables that kebab-collide are blocked', () => {
    // "Items" and "ITems" both -> "items".
    const bp = mk(
      [n('web', 'nextjs', 'Web'), n('t1', 'dynamo', 'Items'), n('t2', 'dynamo', 'ITems')],
      [e('e1', 'web', 't1', 'writesTo'), e('e2', 'web', 't2', 'writesTo')],
    );
    expect(rulesOf(bp, 'kebab-path-collision')).toHaveLength(1);
  });

  it('two external-API helpers that kebab-collide are blocked', () => {
    const bp = mk(
      [
        n('web', 'nextjs', 'Web'),
        n('a1', 'externalApi', 'Weather', { baseUrlEnv: 'W_URL', keyEnv: 'W_KEY' }),
        n('a2', 'externalApi', 'WEAther', { baseUrlEnv: 'W2_URL', keyEnv: 'W2_KEY' }),
      ],
      [e('e1', 'web', 'a1', 'callsApi'), e('e2', 'web', 'a2', 'callsApi')],
    );
    expect(rulesOf(bp, 'kebab-path-collision')).toHaveLength(1);
  });

  it('a Dynamo table that kebabs to "items" collides with the Mongo CRUD paths', () => {
    const bp = mk(
      [n('web', 'nextjs', 'Web'), n('t', 'dynamo', 'Items'), n('m', 'mongodb', 'Mongo')],
      [e('e1', 'web', 't', 'writesTo'), e('e2', 'web', 'm', 'queriesMongo')],
    );
    expect(rulesOf(bp, 'kebab-path-collision')).toHaveLength(1);
  });

  it('distinct slugs (and a Dynamo named anything but "items" without Mongo) pass clean', () => {
    const bp = mk(
      [
        n('q', 'queue', 'Jobs'),
        n('w1', 'worker', 'ProcessJob'),
        n('w2', 'worker', 'ResizeImage'),
        n('t', 'dynamo', 'Items'),
      ],
      [
        e('e1', 'w1', 'q', 'subscribesTo'),
        e('e2', 'w2', 'q', 'subscribesTo'),
        e('e3', 'w1', 't', 'writesTo'),
      ],
    );
    expect(rulesOf(bp, 'kebab-path-collision')).toHaveLength(0);
  });
});
