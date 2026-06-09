import { describe, it, expect } from 'vitest';
import { generateFiles } from '@/lib/core/codegen/generate';
import { estimateAwsCost } from '@/lib/targets/aws-sst-v4/cost';
import { validateBlueprint } from '@/lib/core/validation/validate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import type { Blueprint } from '@/lib/core/blueprint/types';

const NOW = '2026-06-08T00:00:00.000Z';
const APP = { name: 'a', region: 'us-east-1', packageManager: 'yarn' as const };
const config = (bp: Blueprint) =>
  generateFiles(bp).find((f) => f.path === 'sst.config.ts')!.content;
const byPath = (bp: Blueprint) =>
  Object.fromEntries(generateFiles(bp).map((f) => [f.path, f.content]));

describe('Dynamo global secondary index', () => {
  const bp = draftBlueprint(
    {
      nodes: [
        { id: 'n1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
        {
          id: 'd2',
          kind: 'dynamo',
          name: 'Data',
          props: { gsiName: 'byStatus', gsiHashKey: 'status', gsiRangeKey: 'createdAt' },
          position: { x: 1, y: 0 },
        },
      ],
      edges: [{ id: 'e', source: 'n1', target: 'd2', intent: 'writesTo' }],
    },
    'aws-sst-v4',
    APP,
    NOW,
  );

  it('renders a globalIndexes block + the index fields', () => {
    const c = config(bp);
    expect(c).toContain('status: "string"');
    expect(c).toContain('createdAt: "string"');
    expect(c).toContain('globalIndexes: {');
    expect(c).toContain('byStatus: { hashKey: "status", rangeKey: "createdAt" }');
  });

  it('omits globalIndexes when no GSI is configured', () => {
    const plain = draftBlueprint(
      {
        nodes: [
          { id: 'n1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          { id: 'd2', kind: 'dynamo', name: 'Data', props: {}, position: { x: 1, y: 0 } },
        ],
        edges: [{ id: 'e', source: 'n1', target: 'd2', intent: 'writesTo' }],
      },
      'aws-sst-v4',
      APP,
      NOW,
    );
    expect(config(plain)).not.toContain('globalIndexes');
  });
});

describe('Aurora Serverless v2 (Postgres)', () => {
  const bp = draftBlueprint(
    {
      nodes: [
        { id: 'n1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
        { id: 'a2', kind: 'aurora', name: 'Db', props: {}, position: { x: 1, y: 0 } },
      ],
      edges: [{ id: 'e', source: 'n1', target: 'a2', intent: 'queriesDb' }],
    },
    'aws-sst-v4',
    APP,
    NOW,
  );

  it('validates and renders Aurora with the shared VPC', () => {
    expect(validateBlueprint(bp).errors).toHaveLength(0);
    const c = config(bp);
    expect(c).toContain('const vpc = new sst.aws.Vpc("Vpc");');
    expect(c).toContain('new sst.aws.Aurora("Db", {');
    expect(c).toContain('engine: "postgres"');
    expect(c).toContain('vpc,');
  });

  it('reuses the pg pool helper + dep, and costs ~$45/mo', () => {
    const files = byPath(bp);
    expect(files['lib/db.ts']).toContain('Resource.Db.host');
    expect(files['lib/db.ts']).toContain('Pool');
    const pkg = JSON.parse(files['package.additions.json']) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['pg']).toBeDefined();
    const c = estimateAwsCost(bp).perResource.find((r) => r.kind === 'aurora')!;
    expect(c.monthlyUsd).toBeGreaterThan(40);
  });
});
