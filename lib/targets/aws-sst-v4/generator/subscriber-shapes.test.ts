import { describe, it, expect } from 'vitest';
import { generateFiles } from '@/lib/core/codegen/generate';
import { validateBlueprint } from '@/lib/core/validation/validate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import type { Blueprint } from '@/lib/core/blueprint/types';

// Regression tests for #118 (per-source subscriber event shapes) and #119
// (multi-trigger workers + lib/dynamo bound to the worker's own table/keys).

const NOW = '2026-06-08T00:00:00.000Z';
const APP = { name: 'shapes-app', region: 'us-east-1', packageManager: 'yarn' as const };

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

const files = (bp: Blueprint) =>
  Object.fromEntries(generateFiles(bp).map((f) => [f.path, f.content]));

describe('subscriber handler event shapes (#118)', () => {
  it('queue subscribers keep the SQS Records/body shape', () => {
    const bp = mk(
      [n('q', 'queue', 'Jobs'), n('w', 'worker', 'ProcessJob')],
      [e('e1', 'w', 'q', 'subscribesTo')],
    );
    const handler = files(bp)['src/workers/process-job.ts'];
    expect(handler).toContain('JSON.parse(record.body)');
    expect(handler).toContain('SQS subscriber');
  });

  it('bus subscribers receive ONE EventBridge event with the payload under detail', () => {
    const bp = mk(
      [n('b', 'bus', 'Events'), n('w', 'worker', 'OnEvent')],
      [e('e1', 'w', 'b', 'subscribesTo')],
    );
    const handler = files(bp)['src/workers/on-event.ts'];
    expect(handler).toContain('EventBridge subscriber');
    expect(handler).toContain('event.detail');
    expect(handler).toContain('"detail-type"');
    expect(handler).not.toContain('event.Records');
    expect(handler).not.toContain('JSON.parse(record.body)');
  });

  it('SNS subscribers parse Records[].Sns.Message', () => {
    const bp = mk(
      [n('t', 'snstopic', 'Alerts'), n('w', 'worker', 'OnAlert')],
      [e('e1', 'w', 't', 'subscribesTo')],
    );
    const handler = files(bp)['src/workers/on-alert.ts'];
    expect(handler).toContain('SNS subscriber');
    expect(handler).toContain('JSON.parse(record.Sns.Message)');
    expect(handler).not.toContain('JSON.parse(record.body)');
  });
});

describe('lib/dynamo binds the worker’s own table + keys (#119)', () => {
  it('custom-key tables flow into lib/dynamo.ts and the subscriber write block', () => {
    const bp = mk(
      [
        n('q', 'queue', 'Jobs'),
        n('w', 'worker', 'ProcessJob'),
        n('t', 'dynamo', 'Users', { hashKey: 'userId', rangeKey: 'createdAt' }),
      ],
      [e('e1', 'w', 'q', 'subscribesTo'), e('e2', 'w', 't', 'writesTo')],
    );
    const byPath = files(bp);
    expect(byPath['lib/dynamo.ts']).toContain(
      'getItem(key: { userId: string; createdAt: string })',
    );
    const handler = byPath['src/workers/process-job.ts'];
    expect(handler).toContain('userId: `job#${message.id ?? "unknown"}`');
    expect(handler).toContain('createdAt: new Date().toISOString(),');
    expect(handler).not.toContain('pk:');
  });

  it('a hash-only table (rangeKey cleared) omits the sort key everywhere', () => {
    const bp = mk(
      [
        n('q', 'queue', 'Jobs'),
        n('w', 'worker', 'ProcessJob'),
        n('t', 'dynamo', 'Events', { hashKey: 'eventId', rangeKey: '' }),
      ],
      [e('e1', 'w', 'q', 'subscribesTo'), e('e2', 'w', 't', 'writesTo')],
    );
    const byPath = files(bp);
    expect(byPath['lib/dynamo.ts']).toContain('getItem(key: { eventId: string })');
    expect(byPath['src/workers/process-job.ts']).not.toContain('new Date().toISOString()');
  });

  it('multi-table designs wire each subscriber to ITS table via a per-table helper', () => {
    // First table (app-facing) claims lib/dynamo.ts; the worker writes a SECOND table.
    const bp = mk(
      [
        n('web', 'nextjs', 'Web'),
        n('t1', 'dynamo', 'AppTable'),
        n('q', 'queue', 'Jobs'),
        n('w', 'worker', 'ProcessJob'),
        n('t2', 'dynamo', 'AuditLog', { hashKey: 'logId' }),
      ],
      [
        e('e1', 'web', 't1', 'writesTo'),
        e('e2', 'w', 'q', 'subscribesTo'),
        e('e3', 'w', 't2', 'writesTo'),
      ],
    );
    const byPath = files(bp);
    expect(byPath['lib/dynamo.ts']).toContain('Resource.AppTable.name');
    expect(byPath['lib/dynamo-audit-log.ts']).toContain('Resource.AuditLog.name');
    const handler = byPath['src/workers/process-job.ts'];
    expect(handler).toContain('from "../../lib/dynamo-audit-log"');
    expect(handler).toContain('logId: `job#${message.id ?? "unknown"}`');
  });
});

describe('write blocks inside non-SQS shapes + read-only links', () => {
  it('a bus subscriber writing a table embeds putItem in the single-event shape', () => {
    const bp = mk(
      [n('b', 'bus', 'Events'), n('w', 'worker', 'OnEvent'), n('t', 'dynamo', 'Log')],
      [e('e1', 'w', 'b', 'subscribesTo'), e('e2', 'w', 't', 'writesTo')],
    );
    const handler = files(bp)['src/workers/on-event.ts'];
    expect(handler).toContain('const message = event.detail ?? {};');
    expect(handler).toContain('await putItem({');
    expect(handler).not.toContain('for (const record');
  });

  it('an SNS subscriber writing a table embeds putItem in the Sns.Message loop', () => {
    const bp = mk(
      [n('s', 'snstopic', 'Alerts'), n('w', 'worker', 'OnAlert'), n('t', 'dynamo', 'Log')],
      [e('e1', 'w', 's', 'subscribesTo'), e('e2', 'w', 't', 'writesTo')],
    );
    const handler = files(bp)['src/workers/on-alert.ts'];
    expect(handler).toContain('JSON.parse(record.Sns.Message)');
    expect(handler).toContain('await putItem({');
  });

  it('a readsFrom-only subscriber gets NO example write into its read-only table', () => {
    const bp = mk(
      [n('q', 'queue', 'Jobs'), n('w', 'worker', 'Reader'), n('t', 'dynamo', 'Catalog')],
      [e('e1', 'w', 'q', 'subscribesTo'), e('e2', 'w', 't', 'readsFrom')],
    );
    const handler = files(bp)['src/workers/reader.ts'];
    expect(handler).not.toContain('putItem');
    expect(handler).toContain('// TODO: replace with your processing logic');
  });

  it('writesTo wins over an earlier readsFrom edge when picking the write table', () => {
    const bp = mk(
      [
        n('q', 'queue', 'Jobs'),
        n('w', 'worker', 'ProcessJob'),
        n('cfg', 'dynamo', 'ConfigTable'),
        n('res', 'dynamo', 'Results', { hashKey: 'resultId' }),
      ],
      [
        e('e1', 'w', 'q', 'subscribesTo'),
        e('e2', 'w', 'cfg', 'readsFrom'), // earlier edge must NOT shadow the write target
        e('e3', 'w', 'res', 'writesTo'),
      ],
    );
    const byPath = files(bp);
    const handler = byPath['src/workers/process-job.ts'];
    expect(handler).toContain('resultId: `job#${message.id ?? "unknown"}`');
    expect(handler).not.toContain('configTable');
  });

  it('two tables sharing a kebab slug get distinct helper files', () => {
    const bp = mk(
      [
        n('web', 'nextjs', 'Web'),
        n('t0', 'dynamo', 'AppTable'),
        n('q1', 'queue', 'JobsA'),
        n('w1', 'worker', 'WorkerA'),
        n('t1', 'dynamo', 'AuditLog', { hashKey: 'aId' }),
        n('q2', 'queue', 'JobsB'),
        n('w2', 'worker', 'WorkerB'),
        n('t2', 'dynamo', 'AuditLOG', { hashKey: 'bId' }),
      ],
      [
        e('e0', 'web', 't0', 'writesTo'),
        e('e1', 'w1', 'q1', 'subscribesTo'),
        e('e2', 'w1', 't1', 'writesTo'),
        e('e3', 'w2', 'q2', 'subscribesTo'),
        e('e4', 'w2', 't2', 'writesTo'),
      ],
    );
    const byPath = files(bp);
    expect(byPath['lib/dynamo-audit-log.ts']).toContain('Resource.AuditLog.name');
    expect(byPath['lib/dynamo-audit-log-2.ts']).toContain('Resource.AuditLOG.name');
    expect(byPath['src/workers/worker-b.ts']).toContain('from "../../lib/dynamo-audit-log-2"');
  });
});

describe('cron-single-function + snstopic-fifo-no-lambda rules', () => {
  it('errors when one cron invokes two workers (the export would drop one)', () => {
    const bp = mk(
      [
        n('c', 'cron', 'Nightly', { schedule: 'rate(1 day)' }),
        n('w1', 'worker', 'SweepA'),
        n('w2', 'worker', 'SweepB'),
      ],
      [e('e1', 'c', 'w1', 'invokes'), e('e2', 'c', 'w2', 'invokes')],
    );
    const errs = validateBlueprint(bp).errors.filter((d) => d.rule === 'cron-single-function');
    expect(errs).toHaveLength(1);
  });

  it('errors when a worker subscribes to a FIFO topic (no Lambda triggers on FIFO)', () => {
    const bp = mk(
      [n('t', 'snstopic', 'Alerts', { fifo: true }), n('w', 'worker', 'OnAlert')],
      [e('e1', 'w', 't', 'subscribesTo')],
    );
    const errs = validateBlueprint(bp).errors.filter((d) => d.rule === 'snstopic-fifo-no-lambda');
    expect(errs).toHaveLength(1);
  });

  it('a FIFO topic without Lambda subscribers stays clean', () => {
    const bp = mk(
      [n('web', 'nextjs', 'Web'), n('t', 'snstopic', 'Alerts', { fifo: true })],
      [e('e1', 'web', 't', 'publishesTo')],
    );
    const errs = validateBlueprint(bp).errors.filter((d) => d.rule === 'snstopic-fifo-no-lambda');
    expect(errs).toHaveLength(0);
  });
});

describe('worker-single-trigger rule (#119)', () => {
  const errsOf = (bp: Blueprint) =>
    validateBlueprint(bp).errors.filter((d) => d.rule === 'worker-single-trigger');

  it('errors when a worker both subscribes and handles a route', () => {
    const bp = mk(
      [
        n('q', 'queue', 'Jobs'),
        n('api', 'apigatewayv2', 'Api'),
        n('w', 'worker', 'DoubleDuty', { route: 'GET /x' }),
      ],
      [e('e1', 'w', 'q', 'subscribesTo'), e('e2', 'w', 'api', 'handlesRoute')],
    );
    expect(errsOf(bp)).toHaveLength(1);
  });

  it('errors when a worker subscribes to two sources', () => {
    const bp = mk(
      [n('q1', 'queue', 'JobsA'), n('q2', 'queue', 'JobsB'), n('w', 'worker', 'Greedy')],
      [e('e1', 'w', 'q1', 'subscribesTo'), e('e2', 'w', 'q2', 'subscribesTo')],
    );
    expect(errsOf(bp)).toHaveLength(1);
  });

  it('allows two crons invoking the same worker (one role, shared handler)', () => {
    const bp = mk(
      [
        n('c1', 'cron', 'Hourly', { schedule: 'rate(1 hour)' }),
        n('c2', 'cron', 'Nightly', { schedule: 'rate(1 day)' }),
        n('w', 'worker', 'Sweep'),
      ],
      [e('e1', 'c1', 'w', 'invokes'), e('e2', 'c2', 'w', 'invokes')],
    );
    expect(errsOf(bp)).toHaveLength(0);
  });

  it('a single-trigger worker stays clean', () => {
    const bp = mk(
      [n('q', 'queue', 'Jobs'), n('w', 'worker', 'ProcessJob')],
      [e('e1', 'w', 'q', 'subscribesTo')],
    );
    expect(errsOf(bp)).toHaveLength(0);
  });
});
