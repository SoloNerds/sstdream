import { describe, it, expect } from 'vitest';
import { generateFiles } from '@/lib/core/codegen/generate';
import { estimateAwsCost } from '@/lib/targets/aws-sst-v4/cost';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import type { Blueprint } from '@/lib/core/blueprint/types';

const NOW = '2026-06-08T00:00:00.000Z';

const mk = (nat?: string) =>
  draftBlueprint(
    {
      nodes: [
        { id: 'nextjs_1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
        {
          id: 'postgres_2',
          kind: 'postgres',
          name: 'Database',
          props: nat ? { nat } : {},
          position: { x: 200, y: 0 },
        },
      ],
      edges: [{ id: 'e1', source: 'nextjs_1', target: 'postgres_2', intent: 'queriesDb' }],
    },
    'aws-sst-v4',
    { name: 'nat-app', region: 'us-east-1', packageManager: 'yarn' },
    NOW,
  );

const config = (bp: Blueprint) =>
  generateFiles(bp).find((f) => f.path === 'sst.config.ts')!.content;
const pgCost = (bp: Blueprint) =>
  estimateAwsCost(bp).perResource.find((r) => r.kind === 'postgres')!;

describe('VPC NAT options + corrected Postgres cost', () => {
  it('default: no NAT, ~$14/mo (the old $32 gateway charge is gone)', () => {
    const bp = mk();
    expect(config(bp)).toContain('const vpc = new sst.aws.Vpc("Vpc");');
    const c = pgCost(bp);
    expect(c.lines.some((l) => /NAT/i.test(l.label))).toBe(false);
    expect(c.monthlyUsd).toBeLessThan(15);
  });

  it('fck-nat (ec2): renders nat: "ec2" + a cheap NAT line', () => {
    const bp = mk('ec2');
    expect(config(bp)).toContain('new sst.aws.Vpc("Vpc", {');
    expect(config(bp)).toContain('nat: "ec2"');
    expect(pgCost(bp).lines.some((l) => /fck-nat/i.test(l.label))).toBe(true);
  });

  it('managed gateway: renders nat: "managed" + the $32 line', () => {
    const bp = mk('managed');
    expect(config(bp)).toContain('nat: "managed"');
    expect(pgCost(bp).lines.some((l) => l.label === 'NAT Gateway' && l.usd === 32)).toBe(true);
  });
});
