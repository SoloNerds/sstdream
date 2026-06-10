import { describe, it, expect } from 'vitest';
import { generateFiles } from '@/lib/core/codegen/generate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import type { Blueprint } from '@/lib/core/blueprint/types';

// Regression tests for the three template-breaking export bugs (#115, #116, #117):
// queue visibilityTimeout vs subscriber timeout, VPC placement for DB consumers,
// and @types/pg in the scaffold devDependencies.

const NOW = '2026-06-08T00:00:00.000Z';
const APP = { name: 'breaker-app', region: 'us-east-1', packageManager: 'yarn' as const };

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

describe('queue visibilityTimeout >= subscriber timeout (#115)', () => {
  it('a subscribed queue gets visibilityTimeout = 6x the default 60s subscriber timeout', () => {
    const bp = mk(
      [n('q', 'queue', 'Jobs'), n('w', 'worker', 'ProcessJob')],
      [e('e1', 'w', 'q', 'subscribesTo')],
    );
    const config = files(bp)['sst.config.ts'];
    expect(config).toContain('new sst.aws.Queue("Jobs", {');
    expect(config).toContain('visibilityTimeout: "360 seconds",');
  });

  it('uses the largest subscriber timeout across subscribers', () => {
    const bp = mk(
      [
        n('q', 'queue', 'Jobs'),
        n('w1', 'worker', 'Fast', { timeout: '30 seconds' }),
        n('w2', 'worker', 'Slow', { timeout: '2 minutes' }),
      ],
      [e('e1', 'w1', 'q', 'subscribesTo'), e('e2', 'w2', 'q', 'subscribesTo')],
    );
    // 2 minutes = 120s -> 6x = 720s
    expect(files(bp)['sst.config.ts']).toContain('visibilityTimeout: "720 seconds",');
  });

  it('caps visibilityTimeout at the SQS max of 12 hours', () => {
    const bp = mk(
      [n('q', 'queue', 'Jobs'), n('w', 'worker', 'Slow', { timeout: '3 hours' })],
      [e('e1', 'w', 'q', 'subscribesTo')],
    );
    expect(files(bp)['sst.config.ts']).toContain('visibilityTimeout: "43200 seconds",');
  });

  it('an unparseable timeout assumes the Lambda max so visibility still covers it', () => {
    const bp = mk(
      [n('q', 'queue', 'Jobs'), n('w', 'worker', 'Odd', { timeout: 'whenever' })],
      [e('e1', 'w', 'q', 'subscribesTo')],
    );
    // 900s (Lambda max) x 6 = 5400s
    expect(files(bp)['sst.config.ts']).toContain('visibilityTimeout: "5400 seconds",');
  });

  it('parses decimal SST durations like "1.5 minutes"', () => {
    const bp = mk(
      [n('q', 'queue', 'Jobs'), n('w', 'worker', 'Halfway', { timeout: '1.5 minutes' })],
      [e('e1', 'w', 'q', 'subscribesTo')],
    );
    expect(files(bp)['sst.config.ts']).toContain('visibilityTimeout: "540 seconds",');
  });

  it('a queue without subscribers keeps the bare declaration', () => {
    const bp = mk(
      [n('q', 'queue', 'Jobs'), n('web', 'nextjs', 'Web')],
      [e('e1', 'web', 'q', 'publishesTo')],
    );
    expect(files(bp)['sst.config.ts']).toContain('new sst.aws.Queue("Jobs");');
  });

  it('fifo + subscriber emits both args', () => {
    const bp = mk(
      [n('q', 'queue', 'Jobs', { fifo: true }), n('w', 'worker', 'ProcessJob')],
      [e('e1', 'w', 'q', 'subscribesTo')],
    );
    const config = files(bp)['sst.config.ts'];
    expect(config).toContain('fifo: true,');
    expect(config).toContain('visibilityTimeout: "360 seconds",');
  });
});

describe('DB consumers join the VPC (#116)', () => {
  it('Next.js querying Postgres gets vpc + the NAT floor', () => {
    const bp = mk(
      [n('web', 'nextjs', 'Web'), n('db', 'postgres', 'Database')],
      [e('e1', 'web', 'db', 'queriesDb')],
    );
    const config = files(bp)['sst.config.ts'];
    expect(config).toContain('nat: "ec2"');
    expect(config).toMatch(/new sst\.aws\.Nextjs\("Web", \{(?:(?!\}\);)[\s\S])*?\n\s+vpc,\n/);
  });

  it('a queue subscriber querying Aurora gets vpc in its FunctionArgs', () => {
    const bp = mk(
      [n('q', 'queue', 'Jobs'), n('w', 'worker', 'ProcessJob'), n('db', 'aurora', 'Database')],
      [e('e1', 'w', 'q', 'subscribesTo'), e('e2', 'w', 'db', 'queriesDb')],
    );
    const config = files(bp)['sst.config.ts'];
    expect(config).toMatch(/jobs\.subscribe\(\{(?:(?!\}\);)[\s\S])*?\n\s+vpc,\n\s+\}\);/);
  });

  it('standalone function, API route, and cron workers querying the DB all get vpc', () => {
    const bp = mk(
      [
        n('fn', 'worker', 'Standalone'),
        n('api', 'apigatewayv2', 'Api'),
        n('rw', 'worker', 'RouteWorker', { route: 'GET /items' }),
        n('cron', 'cron', 'Nightly', { schedule: 'rate(1 day)' }),
        n('cw', 'worker', 'CronWorker'),
        n('db', 'postgres', 'Database'),
      ],
      [
        e('e1', 'fn', 'db', 'queriesDb'),
        e('e2', 'rw', 'api', 'handlesRoute'),
        e('e3', 'rw', 'db', 'queriesDb'),
        e('e4', 'cron', 'cw', 'invokes'),
        e('e5', 'cw', 'db', 'queriesDb'),
      ],
    );
    const config = files(bp)['sst.config.ts'];
    expect(config).toMatch(
      /new sst\.aws\.Function\("Standalone", \{(?:(?!\}\);)[\s\S])*?\n\s+vpc,\n\s+\}\);/,
    );
    expect(config).toMatch(/api\.route\("GET \/items", \{(?:(?!\}\);)[\s\S])*?\n\s+vpc,\n\s+\}\);/);
    expect(config).toMatch(/function: \{(?:(?!\},)[\s\S])*?\n\s+vpc,\n\s+\},/);
  });

  it('a bucket-notify worker querying the DB gets vpc in its function object', () => {
    const bp = mk(
      [n('b', 'bucket', 'Uploads'), n('w', 'worker', 'Scanner'), n('db', 'postgres', 'Database')],
      [e('e1', 'w', 'b', 'handlesBucketEvents'), e('e2', 'w', 'db', 'queriesDb')],
    );
    const config = files(bp)['sst.config.ts'];
    // The notifier links its bucket and database, then joins the VPC.
    expect(config).toContain(
      'function: { handler: "src/workers/scanner.handler", link: [uploads, database], vpc },',
    );
  });

  it('consumers that do not touch the DB stay out of the VPC', () => {
    const bp = mk(
      [n('web', 'nextjs', 'Web'), n('db', 'postgres', 'Database'), n('fn', 'worker', 'Other')],
      [e('e1', 'web', 'db', 'queriesDb')],
    );
    const config = files(bp)['sst.config.ts'];
    expect(config).toMatch(/new sst\.aws\.Function\("Other", \{(?:(?!vpc)[\s\S])*?\}\);/);
  });
});

describe('@types/pg in scaffold devDependencies (#117)', () => {
  it('a Postgres design adds pg + @types/pg to the exported package.json', () => {
    const bp = mk(
      [n('web', 'nextjs', 'Web'), n('db', 'postgres', 'Database')],
      [e('e1', 'web', 'db', 'queriesDb')],
    );
    const pkg = JSON.parse(files(bp)['package.json']) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(pkg.dependencies['pg']).toBeDefined();
    expect(pkg.devDependencies['@types/pg']).toBeDefined();
  });

  it('a design without Postgres does not add @types/pg', () => {
    const bp = mk(
      [n('web', 'nextjs', 'Web'), n('t', 'dynamo', 'Items')],
      [e('e1', 'web', 't', 'writesTo')],
    );
    const pkg = JSON.parse(files(bp)['package.json']) as {
      devDependencies: Record<string, string>;
    };
    expect(pkg.devDependencies['@types/pg']).toBeUndefined();
  });
});
