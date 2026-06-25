import { describe, it, expect } from 'vitest';
import { parseAwsConfig } from './reverse';
import { generateFiles } from '@/lib/core/codegen/generate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { AWS_TEMPLATES } from '@/lib/templates/aws';

const NOW = '2026-06-08T00:00:00.000Z';

// Kinds excluded from the strict round-trip comparison:
// - env-only integrations (stripe/mongodb/clerk/externalApi) leave no infra at all;
// - `worker` is recovered best-effort — a *name-first* subscriber round-trips (see
//   the dedicated test), but cron-invoked / route-handler / bucket-notifier / and
//   object-first subscriber workers carry no recoverable name in the config.
// `ai` is rendered as an sst.Secret, so it round-trips back as a `secret`.
const NON_INFRA = new Set(['stripe', 'mongodb', 'clerk', 'externalApi', 'worker']);

function configOf(snapshot: { nodes: unknown[]; edges: unknown[] }) {
  const bp = draftBlueprint(
    snapshot as never,
    'aws-sst-v4',
    { name: 'rt', region: 'us-east-1', packageManager: 'yarn' },
    NOW,
  );
  return generateFiles(bp).find((f) => f.path === 'sst.config.ts')!.content;
}

describe('reverse: sst.config.ts → diagram', () => {
  it('recovers a Nextjs + Bucket + Dynamo design with its link edges', () => {
    const cfg = `
export default $config({
  async run() {
    const uploads = new sst.aws.Bucket("Uploads");
    const posts = new sst.aws.Dynamo("Posts", { fields: {}, primaryIndex: {} });
    const web = new sst.aws.Nextjs("Web", { link: [uploads, posts] });
    return { web: web.url };
  },
});`;
    const { nodes, edges } = parseAwsConfig(cfg);
    expect(nodes.map((n) => n.kind).sort()).toEqual(['bucket', 'dynamo', 'nextjs']);
    expect(nodes.find((n) => n.kind === 'nextjs')!.name).toBe('Web');
    // Two link edges from the app.
    expect(edges).toHaveLength(2);
    const web = nodes.find((n) => n.kind === 'nextjs')!;
    expect(edges.every((e) => e.source === web.id)).toBe(true);
  });

  it('skips auto-infra (Vpc/Cluster) but recovers Service + its scalar props', () => {
    const cfg = `
const vpc = new sst.aws.Vpc("Vpc", { nat: "ec2" });
const cluster = new sst.aws.Cluster("Cluster", { vpc });
const api = new sst.aws.Service("Api", {
  cluster,
  cpu: "1 vCPU",
  memory: "2 GB",
  loadBalancer: { rules: [{ listen: "80/http", forward: "3000/http" }] },
});`;
    const { nodes } = parseAwsConfig(cfg);
    expect(nodes.map((n) => n.kind)).toEqual(['service']);
    const svc = nodes[0];
    expect(svc.name).toBe('Api');
    expect(svc.props.cpu).toBe('1 vCPU');
    expect(svc.props.memory).toBe('2 GB');
    expect(svc.props.public).toBe('yes'); // has a loadBalancer
  });

  it('a private service (no loadBalancer) recovers public: "no"', () => {
    const { nodes } = parseAwsConfig('const w = new sst.aws.Service("Worker", { cluster });');
    expect(nodes[0].props.public).toBe('no');
  });

  it('recovers a name-first subscriber as a worker + subscribesTo edge', () => {
    const cfg = `
const jobs = new sst.aws.Queue("Jobs");
jobs.subscribe("Processor", { handler: "src/processor.handler" });`;
    const { nodes, edges } = parseAwsConfig(cfg);
    expect(nodes.map((n) => n.kind).sort()).toEqual(['queue', 'worker']);
    const worker = nodes.find((n) => n.kind === 'worker')!;
    expect(worker.name).toBe('Processor');
    expect(edges).toEqual([expect.objectContaining({ source: worker.id, intent: 'subscribesTo' })]);
  });

  it('ignores realtime.subscribe handler-path calls (not a worker)', () => {
    const cfg = `
const realtime = new sst.aws.Realtime("Realtime", { authorizer: "src/auth.handler" });
realtime.subscribe("src/sub.handler", { filter: "x" });`;
    const { nodes } = parseAwsConfig(cfg);
    expect(nodes.map((n) => n.kind)).toEqual(['realtime']);
  });

  // The strongest backstop: every AWS template, generated → parsed, recovers the
  // same set of infra (kind, name) pairs.
  describe('round-trips every AWS template (infra resources)', () => {
    for (const t of AWS_TEMPLATES) {
      it(t.id, () => {
        const cfg = configOf(t.snapshot);
        const { nodes } = parseAwsConfig(cfg);
        const recovered = nodes.map((n) => `${n.kind}:${n.name}`).sort();
        const expected = t.snapshot.nodes
          .filter((n) => !NON_INFRA.has(n.kind))
          // `ai` round-trips as a `secret` (rendered as sst.Secret).
          .map((n) => `${n.kind === 'ai' ? 'secret' : n.kind}:${n.name}`)
          .sort();
        // Every expected infra node is recovered (the parser may also recover
        // subscriber workers that the template modeled as separate nodes — fine).
        for (const e of expected) expect(recovered).toContain(e);
      });
    }
  });
});
