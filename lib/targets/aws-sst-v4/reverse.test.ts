import { describe, it, expect } from 'vitest';
import { parseAwsConfig } from './reverse';
import { generateFiles } from '@/lib/core/codegen/generate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { AWS_TEMPLATES } from '@/lib/templates/aws';
import { REVERSE_CORPUS } from './reverse-corpus';

// Multiset difference: which expected items aren't covered by `got`.
function missing(expected: string[], got: string[]): string[] {
  const pool = [...got];
  const out: string[] = [];
  for (const e of expected) {
    const i = pool.indexOf(e);
    if (i === -1) out.push(e);
    else pool.splice(i, 1);
  }
  return out;
}

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

  it('shows unmodeled components as generic nodes AND notes them (never silently dropped)', () => {
    const cfg = `
      const web = new sst.aws.Nextjs("Web", { link: [stream] });
      const stream = new sst.aws.Kinesis("Stream", {});
      const fs = new sst.aws.Efs("Files", { vpc });
    `;
    const { nodes, unrecognized } = parseAwsConfig(cfg);
    // The modeled node keeps its real kind…
    expect(nodes.find((n) => n.name === 'Web')!.kind).toBe('nextjs');
    // …and the unmodeled ones appear as GENERIC nodes, so the diagram is complete…
    expect(nodes.find((n) => n.name === 'Stream')!.kind).toBe('unknown');
    expect(nodes.find((n) => n.name === 'Files')!.kind).toBe('unknown');
    // …while STILL being reported honestly.
    const snippets = unrecognized.map((u) => u.snippet).join(' ');
    expect(snippets).toContain('sst.aws.Kinesis');
    expect(snippets).toContain('sst.aws.Efs');
    expect(unrecognized.some((u) => /isn't modeled/.test(u.reason))).toBe(true);
  });

  it('resolves links through object maps + spreads + Object.values (real multi-secret setup)', () => {
    const cfg = `
      const secrets = {
        databaseUrl: new sst.Secret("DATABASE_URL"),
        stripeSecret: new sst.Secret("StripeSecret"),
      };
      const allSecrets = Object.values(secrets);
      new sst.aws.Nextjs("Web", { link: [...allSecrets, secrets.databaseUrl] });
      new sst.aws.Function("Worker", { handler: "x.handler", link: [Object.values(secrets)] });
    `;
    const { nodes, edges } = parseAwsConfig(cfg);
    const id = (name: string) => nodes.find((n) => n.name === name)!.id;
    const both = [id('DATABASE_URL'), id('StripeSecret')].sort();
    // The anonymous Next.js (no const binding) links BOTH secrets via the spread + member access…
    const webLinks = edges
      .filter((e) => e.source === id('Web'))
      .map((e) => e.target)
      .sort();
    expect(webLinks).toEqual(both);
    // …and the anonymous Function links them via Object.values(secrets).
    const workerLinks = edges
      .filter((e) => e.source === id('Worker'))
      .map((e) => e.target)
      .sort();
    expect(workerLinks).toEqual(both);
  });

  it('recovers a deprecated Cron with an inline function as cron → worker (invokes)', () => {
    const cfg = `
      const dbUrl = new sst.Secret("DatabaseUrl");
      new sst.aws.Cron("DbPing", { schedule: "rate(5 minutes)", function: { handler: "x.handler", link: [dbUrl] } });
    `;
    const { nodes, edges } = parseAwsConfig(cfg);
    const cron = nodes.find((n) => n.name === 'DbPing')!;
    expect(cron.kind).toBe('cron'); // deprecated Cron → the real cron kind, NOT "unknown"
    const worker = nodes.find((n) => n.kind === 'worker')!;
    const secret = nodes.find((n) => n.kind === 'secret')!;
    // The inline function is recovered as a worker the cron invokes, and the function's
    // link lands on the worker — so the cron has a function (no "cron-needs-function" error).
    expect(edges).toContainEqual(
      expect.objectContaining({ source: cron.id, target: worker.id, intent: 'invokes' }),
    );
    expect(edges).toContainEqual(
      expect.objectContaining({ source: worker.id, target: secret.id, intent: 'usesSecret' }),
    );
  });

  it('reports a link to an unresolved resource', () => {
    const { unrecognized } = parseAwsConfig(
      'const web = new sst.aws.Nextjs("Web", { link: [somethingElse] });',
    );
    expect(unrecognized.some((u) => /somethingElse/.test(u.reason))).toBe(true);
  });

  it('a clean config recovers everything with an empty `unrecognized`', () => {
    const { nodes, unrecognized } = parseAwsConfig(
      'const b = new sst.aws.Bucket("Files");\nconst w = new sst.aws.Nextjs("Web", { link: [b] });',
    );
    expect(nodes).toHaveLength(2);
    expect(unrecognized).toEqual([]);
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
        const { nodes, unrecognized } = parseAwsConfig(cfg);
        // Our own generated config must parse back with nothing unmodeled.
        expect(unrecognized).toEqual([]);
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

  // Adversarial corpus — diverse real-world configs (authored by a stress workflow):
  // weird formatting, comments inside link arrays, mixed quotes, inline resources,
  // multi-line links, the modern kinds, tricky names, forward refs. Each must recover
  // its expected kinds + names and at least its expected edge count.
  describe('handles a real-world adversarial corpus', () => {
    for (const c of REVERSE_CORPUS) {
      it(c.label, () => {
        const { nodes, edges } = parseAwsConfig(c.config);
        expect(
          missing(
            c.expectKinds,
            nodes.map((n) => n.kind),
          ),
        ).toEqual([]);
        expect(
          missing(
            c.expectNames,
            nodes.map((n) => n.name),
          ),
        ).toEqual([]);
        expect(edges.length).toBeGreaterThanOrEqual(c.expectEdgesAtLeast);
      });
    }
  });
});
