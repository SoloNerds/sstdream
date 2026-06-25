import { describe, it, expect } from 'vitest';
import { generateFiles } from '@/lib/core/codegen/generate';
import { estimateAwsCost } from '@/lib/targets/aws-sst-v4/cost';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import type { Blueprint } from '@/lib/core/blueprint/types';

const NOW = '2026-06-08T00:00:00.000Z';

const mk = (nat?: string, withConsumer = true) =>
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
      edges: withConsumer
        ? [{ id: 'e1', source: 'nextjs_1', target: 'postgres_2', intent: 'queriesDb' }]
        : [],
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
  it('standalone DB (no consumers): no NAT, ~$14/mo (the old $32 gateway charge is gone)', () => {
    const bp = mk(undefined, false);
    expect(config(bp)).toContain('const vpc = new sst.aws.Vpc("Vpc");');
    const c = pgCost(bp);
    expect(c.lines.some((l) => /NAT/i.test(l.label))).toBe(false);
    expect(c.monthlyUsd).toBeLessThan(15);
  });

  it('a DB consumer floors NAT at "ec2" — vpc-placed Lambdas have no egress without it', () => {
    const bp = mk();
    expect(config(bp)).toContain('nat: "ec2"');
    expect(pgCost(bp).lines.some((l) => /fck-nat/i.test(l.label))).toBe(true);
  });

  it('explicit fck-nat (ec2) is honored even without consumers', () => {
    const bp = mk('ec2', false);
    expect(config(bp)).toContain('new sst.aws.Vpc("Vpc", {');
    expect(config(bp)).toContain('nat: "ec2"');
    expect(pgCost(bp).lines.some((l) => /fck-nat/i.test(l.label))).toBe(true);
  });

  it('managed gateway: renders nat: "managed" + the $32 line (beats the ec2 floor)', () => {
    const bp = mk('managed');
    expect(config(bp)).toContain('nat: "managed"');
    expect(pgCost(bp).lines.some((l) => l.label === 'NAT Gateway' && l.usd === 32)).toBe(true);
  });

  it('charges the shared-VPC NAT exactly once across postgres + aurora nodes', () => {
    const bp = draftBlueprint(
      {
        nodes: [
          { id: 'nextjs_1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          { id: 'pg_2', kind: 'postgres', name: 'Db', props: {}, position: { x: 200, y: 0 } },
          { id: 'au_3', kind: 'aurora', name: 'Warehouse', props: {}, position: { x: 400, y: 0 } },
        ],
        edges: [
          { id: 'e1', source: 'nextjs_1', target: 'pg_2', intent: 'queriesDb' },
          { id: 'e2', source: 'nextjs_1', target: 'au_3', intent: 'queriesDb' },
        ],
      },
      'aws-sst-v4',
      { name: 'nat-app', region: 'us-east-1', packageManager: 'yarn' },
      NOW,
    );
    const natLines = estimateAwsCost(bp)
      .perResource.flatMap((r) => r.lines)
      .filter((l) => /fck-nat|NAT Gateway/i.test(l.label));
    expect(natLines).toHaveLength(1);
  });

  it('Redis joins the shared VPC, links its consumer, and emits the ioredis Cluster helper', () => {
    const bp = draftBlueprint(
      {
        nodes: [
          { id: 'nextjs_1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          {
            id: 'redis_2',
            kind: 'redis',
            name: 'Cache',
            props: { engine: 'valkey' },
            position: { x: 200, y: 0 },
          },
        ],
        edges: [{ id: 'e1', source: 'nextjs_1', target: 'redis_2', intent: 'usesCache' }],
      },
      'aws-sst-v4',
      { name: 'cache-app', region: 'us-east-1', packageManager: 'yarn' },
      NOW,
    );
    const files = generateFiles(bp);
    const cfg = files.find((f) => f.path === 'sst.config.ts')!.content;
    // Redis forces the shared VPC, and a consumer floors NAT at ec2.
    expect(cfg).toContain('new sst.aws.Vpc("Vpc", {');
    expect(cfg).toContain('nat: "ec2"');
    expect(cfg).toContain('new sst.aws.Redis("Cache", {');
    expect(cfg).toContain('engine: "valkey"');
    // The Next.js app links the cache (so Resource.Cache resolves at runtime).
    expect(cfg).toMatch(/link: \[[^\]]*cache/);
    // ioredis Cluster + TLS helper, with the dep added.
    const helper = files.find((f) => f.path === 'lib/redis.ts')!.content;
    expect(helper).toContain('import { Cluster } from "ioredis"');
    expect(helper).toContain('Resource.Cache.host');
    expect(helper).toContain('checkServerIdentity: () => undefined');
    const pkg = JSON.parse(files.find((f) => f.path === 'package.additions.json')!.content) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['ioredis']).toBe('^5.0.0');
    // Valkey is the cheaper node in the cost panel.
    const redisCost = estimateAwsCost(bp).perResource.find((r) => r.kind === 'redis')!;
    expect(redisCost.lines.some((l) => /Valkey/.test(l.label))).toBe(true);
  });

  it('a Fargate Service generates a Cluster + VPC (NAT floored to pull its image) + container files', () => {
    const bp = draftBlueprint(
      {
        nodes: [
          {
            id: 'service_1',
            kind: 'service',
            name: 'Api',
            props: { cpu: '0.5 vCPU', memory: '1 GB', port: 8080 },
            position: { x: 0, y: 0 },
          },
          { id: 'postgres_2', kind: 'postgres', name: 'Db', props: {}, position: { x: 200, y: 0 } },
        ],
        edges: [{ id: 'e1', source: 'service_1', target: 'postgres_2', intent: 'queriesDb' }],
      },
      'aws-sst-v4',
      { name: 'svc-app', region: 'us-east-1', packageManager: 'yarn' },
      NOW,
    );
    const files = generateFiles(bp);
    const cfg = files.find((f) => f.path === 'sst.config.ts')!.content;
    // A service forces the VPC + ec2 NAT (private-subnet task needs egress to pull its image).
    expect(cfg).toContain('nat: "ec2"');
    expect(cfg).toContain('const cluster = new sst.aws.Cluster("Cluster", { vpc });');
    expect(cfg).toContain('new sst.aws.Service("Api", {');
    expect(cfg).toContain('cluster,');
    expect(cfg).toContain('image: { context: "./services/api" }');
    expect(cfg).toContain('cpu: "0.5 vCPU"');
    // Public by default → ALB rule in the verified "PORT/protocol" string shape.
    expect(cfg).toContain('rules: [{ listen: "80/http", forward: "8080/http" }]');
    expect(cfg).toMatch(/link: \[[^\]]*db/i);
    expect(cfg).toContain('api: api.url,'); // the public URL is exported
    // Container starter files exist.
    expect(files.some((f) => f.path === 'services/api/Dockerfile')).toBe(true);
    expect(files.find((f) => f.path === 'services/api/server.mjs')!.content).toContain(
      'createServer',
    );
    // Cost: Fargate + ALB.
    const svcCost = estimateAwsCost(bp).perResource.find((r) => r.kind === 'service')!;
    expect(svcCost.lines.some((l) => /Fargate/.test(l.label))).toBe(true);
    expect(svcCost.lines.some((l) => /Load Balancer/.test(l.label))).toBe(true);
  });

  it('a private Service (public: no) omits the load balancer and the url output', () => {
    const bp = draftBlueprint(
      {
        nodes: [
          {
            id: 'service_1',
            kind: 'service',
            name: 'Worker',
            props: { public: 'no' },
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
      },
      'aws-sst-v4',
      { name: 'svc-app', region: 'us-east-1', packageManager: 'yarn' },
      NOW,
    );
    const cfg = generateFiles(bp).find((f) => f.path === 'sst.config.ts')!.content;
    expect(cfg).toContain('new sst.aws.Service("Worker", {');
    expect(cfg).not.toContain('loadBalancer');
    expect(cfg).not.toContain('worker: worker.url');
  });

  it('a Fargate Task reuses the Cluster, emits a task.run() action + batch container', () => {
    const bp = draftBlueprint(
      {
        nodes: [
          { id: 'nextjs_1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          {
            id: 'task_2',
            kind: 'task',
            name: 'ProcessJob',
            props: { cpu: '1 vCPU' },
            position: { x: 200, y: 0 },
          },
          {
            id: 'bucket_3',
            kind: 'bucket',
            name: 'Results',
            props: {},
            position: { x: 400, y: 0 },
          },
        ],
        edges: [
          { id: 'e1', source: 'nextjs_1', target: 'task_2', intent: 'runsTask' },
          { id: 'e2', source: 'task_2', target: 'bucket_3', intent: 'readsFrom' },
        ],
      },
      'aws-sst-v4',
      { name: 'job-app', region: 'us-east-1', packageManager: 'yarn' },
      NOW,
    );
    const files = generateFiles(bp);
    const cfg = files.find((f) => f.path === 'sst.config.ts')!.content;
    // A task forces the VPC + ec2 NAT and reuses the shared Cluster (no service needed).
    expect(cfg).toContain('nat: "ec2"');
    expect(cfg).toContain('const cluster = new sst.aws.Cluster("Cluster", { vpc });');
    expect(cfg).toContain('new sst.aws.Task("ProcessJob", {');
    expect(cfg).toContain('image: { context: "./tasks/process-job" }');
    // The task links the bucket; the app links the task (to call task.run()).
    expect(cfg).toMatch(/new sst\.aws\.Task[\s\S]*?link: \[[^\]]*results/i);
    expect(cfg).toMatch(/new sst\.aws\.Nextjs[\s\S]*?link: \[[^\]]*processJob/);
    // The server action uses the verified sst/aws/task SDK shape.
    const action = files.find((f) => f.path === 'app/actions/run-process-job.ts')!.content;
    expect(action).toContain('import { task } from "sst/aws/task"');
    expect(action).toContain('task.run(Resource.ProcessJob)');
    expect(action).toContain('ret.tasks[0].taskArn');
    expect(files.some((f) => f.path === 'tasks/process-job/Dockerfile')).toBe(true);
    // Per-run, no idle cost.
    const taskCost = estimateAwsCost(bp).perResource.find((r) => r.kind === 'task')!;
    expect(taskCost.lines.some((l) => /per-run/.test(l.label))).toBe(true);
  });

  it('Realtime emits the authorizer + subscriber + app/stage-prefixed subscribe + publish helper', () => {
    const bp = draftBlueprint(
      {
        nodes: [
          { id: 'nextjs_1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          {
            id: 'realtime_2',
            kind: 'realtime',
            name: 'Realtime',
            props: {},
            position: { x: 200, y: 0 },
          },
        ],
        edges: [{ id: 'e1', source: 'nextjs_1', target: 'realtime_2', intent: 'usesRealtime' }],
      },
      'aws-sst-v4',
      { name: 'chat-app', region: 'us-east-1', packageManager: 'yarn' },
      NOW,
    );
    const files = generateFiles(bp);
    const cfg = files.find((f) => f.path === 'sst.config.ts')!.content;
    expect(cfg).toContain('new sst.aws.Realtime("Realtime", {');
    expect(cfg).toContain('authorizer: "src/realtime-authorizer.handler"');
    // Account-shared IoT → topics MUST be app/stage prefixed.
    expect(cfg).toContain('filter: `${$app.name}/${$app.stage}/#`');
    expect(cfg).toMatch(/link: \[[^\]]*realtime/);
    // Authorizer uses the verified sst/aws/realtime helper.
    const auth = files.find((f) => f.path === 'src/realtime-authorizer.ts')!.content;
    expect(auth).toContain('import { realtime } from "sst/aws/realtime"');
    expect(auth).toContain('realtime.authorizer(');
    // Publish helper uses the IoT Data Plane SDK against the linked endpoint.
    const pub = files.find((f) => f.path === 'lib/realtime.ts')!.content;
    expect(pub).toContain('IoTDataPlaneClient');
    expect(pub).toContain('Resource.Realtime.endpoint');
    const pkg = JSON.parse(files.find((f) => f.path === 'package.additions.json')!.content) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['@aws-sdk/client-iot-data-plane']).toBe('^3.0.0');
  });

  it('Step Functions emits the static-builder definition + step Lambdas + a start action', () => {
    const bp = draftBlueprint(
      {
        nodes: [
          { id: 'nextjs_1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          {
            id: 'sf_2',
            kind: 'stepFunctions',
            name: 'OrderFlow',
            props: { type: 'standard' },
            position: { x: 200, y: 0 },
          },
        ],
        edges: [{ id: 'e1', source: 'nextjs_1', target: 'sf_2', intent: 'startsWorkflow' }],
      },
      'aws-sst-v4',
      { name: 'wf-app', region: 'us-east-1', packageManager: 'yarn' },
      NOW,
    );
    const files = generateFiles(bp);
    const cfg = files.find((f) => f.path === 'sst.config.ts')!.content;
    // Verified static builders + chained definition.
    expect(cfg).toContain('sst.aws.StepFunctions.lambdaInvoke({');
    expect(cfg).toContain('function: "src/order-flow-validate.handler"');
    expect(cfg).toContain('new sst.aws.StepFunctions("OrderFlow", {');
    expect(cfg).toContain('.next(');
    expect(cfg).toContain('type: "standard"');
    expect(cfg).toMatch(/link: \[[^\]]*orderFlow/);
    // Step Lambdas exist.
    expect(files.some((f) => f.path === 'src/order-flow-validate.ts')).toBe(true);
    expect(files.some((f) => f.path === 'src/order-flow-process.ts')).toBe(true);
    // Start action uses the verified SFN SDK shape + the only linked field (.arn).
    const action = files.find((f) => f.path === 'app/actions/start-order-flow.ts')!.content;
    expect(action).toContain(
      'import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn"',
    );
    expect(action).toContain('stateMachineArn: Resource.OrderFlow.arn');
    expect(action).toContain('startOrderFlow');
    const pkg = JSON.parse(files.find((f) => f.path === 'package.additions.json')!.content) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['@aws-sdk/client-sfn']).toBe('^3.0.0');
  });

  it('an aurora-only consumer design prices the floored NAT on the aurora node', () => {
    const bp = draftBlueprint(
      {
        nodes: [
          { id: 'nextjs_1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          { id: 'au_2', kind: 'aurora', name: 'Db', props: {}, position: { x: 200, y: 0 } },
        ],
        edges: [{ id: 'e1', source: 'nextjs_1', target: 'au_2', intent: 'queriesDb' }],
      },
      'aws-sst-v4',
      { name: 'nat-app', region: 'us-east-1', packageManager: 'yarn' },
      NOW,
    );
    const aurora = estimateAwsCost(bp).perResource.find((r) => r.kind === 'aurora')!;
    expect(aurora.lines.some((l) => /fck-nat/i.test(l.label))).toBe(true);
  });
});
