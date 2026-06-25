import { describe, it, expect } from 'vitest';
import { expandAws } from '@/lib/targets/aws-sst-v4/expansion';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { TEMPLATES } from '@/lib/templates/registry';

const NOW = '2026-06-08T00:00:00.000Z';
const fromTpl = (id: string) => {
  const t = TEMPLATES.find((x) => x.id === id)!;
  return draftBlueprint(t.snapshot, 'aws-sst-v4', t.app, NOW);
};

describe('AWS infrastructure expansion', () => {
  it('expands one Next.js node into its full hidden resource set (CloudFront, ISR queue + table, Lambdas…)', () => {
    const nx = expandAws(fromTpl('aws-cms')).find((g) => g.kind === 'nextjs')!;
    const names = nx.resources.map((r) => `${r.service} ${r.name}`).join(' | ');
    expect(names).toContain('CloudFront Distribution');
    expect(names).toContain('SQS Revalidation queue (FIFO)');
    expect(names).toContain('DynamoDB ISR tag-cache table');
    expect(nx.resources.length).toBeGreaterThanOrEqual(16);
  });

  it('a Bucket never expands to CloudFront (verified correction)', () => {
    const bucket = expandAws(fromTpl('aws-cms')).find((g) => g.kind === 'bucket')!;
    expect(bucket.resources.some((r) => r.service === 'CloudFront')).toBe(false);
    expect(bucket.resources.some((r) => r.service === 'S3')).toBe(true);
  });

  it('Postgres adds a shared VPC group; a DB consumer floors NAT to fck-nat (matches the export)', () => {
    const vpc = expandAws(fromTpl('aws-relational-saas')).find((g) => g.kind === 'vpc')!;
    expect(vpc).toBeTruthy();
    expect(vpc.resources.some((r) => r.service === 'Cloud Map')).toBe(true);
    // relational-saas has a queriesDb consumer → generated config ships nat: "ec2".
    expect(vpc.resources.some((r) => /fck-nat/i.test(r.name))).toBe(true);
  });

  it('a consumer-less Postgres keeps the no-NAT default in the VPC group', () => {
    const bp = draftBlueprint(
      {
        nodes: [{ id: 'p1', kind: 'postgres', name: 'Db', props: {}, position: { x: 0, y: 0 } }],
        edges: [],
      },
      'aws-sst-v4',
      { name: 'natapp', region: 'us-east-1', packageManager: 'yarn' },
      NOW,
    );
    const vpc = expandAws(bp).find((g) => g.kind === 'vpc')!;
    expect(vpc.resources.some((r) => /NAT/i.test(r.name))).toBe(false);
  });

  it('a queue subscriber expands with an SQS event-source mapping', () => {
    const worker = expandAws(fromTpl('aws-cms')).find((g) => g.kind === 'worker')!;
    expect(worker.resources.some((r) => /event-source mapping/i.test(r.name))).toBe(true);
  });

  it('a bus subscriber gets an EventBridge rule target, NOT an SQS event-source mapping', () => {
    const worker = expandAws(fromTpl('aws-events')).find((g) => g.kind === 'worker')!;
    expect(worker.resources.some((r) => /event-source mapping/i.test(r.name))).toBe(false);
    expect(worker.resources.some((r) => /Rule target/i.test(r.name))).toBe(true);
  });

  it('nat: "managed" surfaces a NAT Gateway in the VPC group', () => {
    const bp = draftBlueprint(
      {
        nodes: [
          { id: 'n1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          {
            id: 'p2',
            kind: 'postgres',
            name: 'Db',
            props: { nat: 'managed' },
            position: { x: 1, y: 0 },
          },
        ],
        edges: [{ id: 'e', source: 'n1', target: 'p2', intent: 'queriesDb' }],
      },
      'aws-sst-v4',
      { name: 'natapp', region: 'us-east-1', packageManager: 'yarn' },
      NOW,
    );
    const vpc = expandAws(bp).find((g) => g.kind === 'vpc')!;
    expect(vpc.resources.some((r) => /NAT Gateway/i.test(r.name))).toBe(true);
  });

  it('external integrations expand to a single "no AWS infra" note', () => {
    const groups = expandAws(fromTpl('aws-clerk-saas'));
    const clerk = groups.find((g) => g.kind === 'clerk')!;
    expect(clerk.resources).toHaveLength(1);
    expect(clerk.resources[0].service).toBe('External');
  });
});
