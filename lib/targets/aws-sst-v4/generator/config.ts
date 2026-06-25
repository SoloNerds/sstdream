import type { Blueprint, Resource } from '@/lib/core/blueprint/types';
import { indent, kebabCase } from '@/lib/core/codegen/strings';
import { effectiveAwsNat, planAws, type AwsPlan } from './plan';

// sst.config.ts renderer. Verified against docs/sst-v4-target.md@0.1.0 (2026-06-08):
// $config + triple-slash ref, no provider imports, resources in run(), links,
// Queue.subscribe SUBSCRIBER-FIRST, sst.aws.CronV2 (not Cron), removal enum.

const HEADER = '/// <reference path="./.sst/platform/config.d.ts" />';

function linkArray(vars: string[]): string {
  return `[${vars.join(', ')}]`;
}

function renderSecret(r: Resource, plan: AwsPlan): string {
  return `const ${plan.varNameById.get(r.id)} = new sst.Secret(${q(r.name)});`;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

// Free-text props are emitted via JSON.stringify so a stray quote/backslash can
// never break the generated TypeScript (#120). Identical output for clean input.
function q(value: string): string {
  return JSON.stringify(value);
}

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

// Object-key position: quote only when the key isn't a valid identifier.
function objKey(k: string): string {
  return IDENT_RE.test(k) ? k : JSON.stringify(k);
}

function renderBucket(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  const access = r.props.access;
  if (access === 'public' || access === 'cloudfront') {
    return `const ${v} = new sst.aws.Bucket(${q(r.name)}, {\n  access: "${access}",\n});`;
  }
  return `const ${v} = new sst.aws.Bucket(${q(r.name)});`;
}

function renderDynamo(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  const hashKey = str(r.props.hashKey) ?? 'pk';
  // unset → default "sk"; explicitly cleared ("") → no sort key
  const rangeKey = r.props.rangeKey === undefined ? 'sk' : str(r.props.rangeKey);

  const fields: Record<string, string> = { [hashKey]: 'string' };
  if (rangeKey) fields[rangeKey] = 'string';

  // Optional global secondary index — for querying by a non-key attribute.
  const gsiName = str(r.props.gsiName);
  const gsiHash = str(r.props.gsiHashKey);
  const gsiRange = str(r.props.gsiRangeKey);
  const hasGsi = Boolean(gsiName && gsiHash);
  if (hasGsi) {
    fields[gsiHash!] = 'string';
    if (gsiRange) fields[gsiRange] = 'string';
  }

  const fieldLines = Object.entries(fields)
    .map(([k, t]) => `    ${objKey(k)}: "${t}",`)
    .join('\n');
  const primaryStr = rangeKey
    ? `{ hashKey: ${q(hashKey)}, rangeKey: ${q(rangeKey)} }`
    : `{ hashKey: ${q(hashKey)} }`;

  const lines = [
    `const ${v} = new sst.aws.Dynamo(${q(r.name)}, {`,
    `  fields: {`,
    fieldLines,
    `  },`,
    `  primaryIndex: ${primaryStr},`,
  ];
  if (hasGsi) {
    const gsiStr = gsiRange
      ? `{ hashKey: ${q(gsiHash!)}, rangeKey: ${q(gsiRange)} }`
      : `{ hashKey: ${q(gsiHash!)} }`;
    lines.push(`  globalIndexes: {`, `    ${objKey(gsiName!)}: ${gsiStr},`, `  },`);
  }
  // A change stream is required for a Worker to subscribe to the table. Honor an
  // explicit prop; auto-enable when a subscriber is wired (the subscribe() call
  // would otherwise fail at deploy). docs/sst-v4-target.md §4.3.
  const explicitStream = str(r.props.stream);
  const hasStreamSub = plan.subscribers.some((s) => s.targetId === r.id);
  const stream =
    explicitStream && explicitStream !== 'none'
      ? explicitStream
      : hasStreamSub
        ? 'new-and-old-images'
        : undefined;
  if (stream) lines.push(`  stream: ${q(stream)},`);
  lines.push(`});`);
  return lines.join('\n');
}

// SST duration strings: "30 seconds" | "1.5 minutes" | "1 hour" → seconds.
export function parseSeconds(value: string | undefined): number | undefined {
  const m = /^(\d+(?:\.\d+)?)\s+(second|minute|hour)s?$/.exec(value ?? '');
  if (!m) return undefined;
  const n = Number(m[1]);
  return m[2] === 'hour' ? n * 3600 : m[2] === 'minute' ? n * 60 : n;
}

function renderQueue(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  const args: string[] = [];
  if (r.props.fifo === true) args.push(`  fifo: true,`);
  // AWS rejects the event-source mapping if a subscriber's timeout exceeds the
  // queue's visibilityTimeout (default 30s); AWS recommends ~6× the function
  // timeout. SQS caps visibility at 12 hours. An explicit prop wins (the
  // queue-visibility-covers-subscribers rule guards adequacy).
  const explicit = str(r.props.visibilityTimeout);
  if (explicit) {
    args.push(`  visibilityTimeout: ${q(explicit)},`);
  } else {
    const subTimeouts = plan.subscribers
      .filter((s) => s.targetId === r.id)
      .map((s) => {
        const raw = str(s.worker.props.timeout);
        // Unparseable free text still renders verbatim as the subscriber timeout,
        // so assume the Lambda max (900s) to keep visibility >= timeout.
        return raw ? (parseSeconds(raw) ?? 900) : 60;
      });
    if (subTimeouts.length) {
      const visibility = Math.min(Math.ceil(Math.max(...subTimeouts)) * 6, 43_200);
      args.push(`  visibilityTimeout: "${visibility} seconds",`);
    }
  }
  // queue → queue edge = dead-letter queue (verified: dlq accepts an ARN).
  const dlqEdge = plan.bp.connections.find(
    (c) => c.source === r.id && c.intent === 'deadLettersTo',
  );
  const dlqVar = dlqEdge ? plan.varNameById.get(dlqEdge.target) : undefined;
  if (dlqVar) args.push(`  dlq: ${dlqVar}.arn,`);
  if (!args.length) return `const ${v} = new sst.aws.Queue(${q(r.name)});`;
  return [`const ${v} = new sst.aws.Queue(${q(r.name)}, {`, ...args, `});`].join('\n');
}

function renderBus(r: Resource, plan: AwsPlan): string {
  return `const ${plan.varNameById.get(r.id)} = new sst.aws.Bus(${q(r.name)});`;
}

function renderSnsTopic(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  if (r.props.fifo === true) {
    return `const ${v} = new sst.aws.SnsTopic(${q(r.name)}, {\n  fifo: true,\n});`;
  }
  return `const ${v} = new sst.aws.SnsTopic(${q(r.name)});`;
}

function renderApi(r: Resource, plan: AwsPlan): string {
  return `const ${plan.varNameById.get(r.id)} = new sst.aws.ApiGatewayV2(${q(r.name)});`;
}

// api.route("METHOD /path", handler) — handler is a string, or an object when
// it links or joins the VPC.
function renderRoute(route: AwsPlan['routes'][number], plan: AwsPlan): string {
  const vpc = plan.vpcConsumerIds.has(route.worker.id);
  if (route.linkVars.length || vpc) {
    const lines = [
      `${route.apiVar}.route(${q(route.route)}, {`,
      `  handler: ${q(route.handlerPath)},`,
    ];
    if (route.linkVars.length) lines.push(`  link: ${linkArray(route.linkVars)},`);
    if (vpc) lines.push(`  vpc,`);
    lines.push(`});`);
    return lines.join('\n');
  }
  return `${route.apiVar}.route(${q(route.route)}, ${q(route.handlerPath)});`;
}

// bucket.notify({ notifications: [{ name, function, events }] }) — S3 object events → Lambda.
function renderBucketNotify(bn: AwsPlan['bucketNotifies'][number], plan: AwsPlan): string {
  const entries = bn.notifiers.map((n) => {
    const parts = [`handler: ${q(n.handlerPath)}`];
    if (n.linkVars.length) parts.push(`link: ${linkArray(n.linkVars)}`);
    if (plan.vpcConsumerIds.has(n.worker.id)) parts.push(`vpc`);
    const fn = parts.length > 1 ? `{ ${parts.join(', ')} }` : q(n.handlerPath);
    return [
      `    {`,
      `      name: ${q(n.name)},`,
      `      function: ${fn},`,
      `      events: ["s3:ObjectCreated:*"],`,
      `    },`,
    ].join('\n');
  });
  return [`${bn.bucketVar}.notify({`, `  notifications: [`, ...entries, `  ],`, `});`].join('\n');
}

function renderRouter(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  const domain = str(r.props.domain);
  return domain
    ? `const ${v} = new sst.aws.Router(${q(r.name)}, {\n  domain: ${q(domain)},\n});`
    : `const ${v} = new sst.aws.Router(${q(r.name)});`;
}

function renderRouteBucket(rb: AwsPlan['routerBuckets'][number]): string {
  return `${rb.routerVar}.routeBucket(${q(rb.path)}, ${rb.bucketVar});`;
}

function renderEmail(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  const sender = str(r.props.sender) ?? 'noreply@example.com';
  return `const ${v} = new sst.aws.Email(${q(r.name)}, {\n  sender: ${q(sender)},\n});`;
}

// RDS Postgres requires a Vpc (distinct from sst.aws.Aurora). One shared Vpc is
// generated automatically when any Postgres is present.
function renderPostgres(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  return `const ${v} = new sst.aws.Postgres(${q(r.name)}, {\n  vpc,\n});`;
}

// Aurora Serverless v2 (Postgres) — a separate component from sst.aws.Postgres; also needs a Vpc.
function renderAurora(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  return `const ${v} = new sst.aws.Aurora(${q(r.name)}, {\n  engine: "postgres",\n  vpc,\n});`;
}

// ElastiCache Redis/Valkey — also requires the shared Vpc. Cluster mode is on by
// default (the runtime helper uses ioredis Cluster + TLS). engine: "valkey" opts
// into the cheaper, wire-compatible fork; "redis" (default) is omitted.
function renderRedis(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  const engine = r.props.engine === 'valkey' ? '\n  engine: "valkey",' : '';
  return `const ${v} = new sst.aws.Redis(${q(r.name)}, {\n  vpc,${engine}\n});`;
}

// ECS Fargate Service on the shared Cluster. The container source lives in its own
// services/<name>/ folder (own Dockerfile). A public service gets an ALB (rules use
// the verified "PORT/protocol" string shape); private services are in-VPC only. The
// task runs in private subnets, so it needs the VPC's NAT to pull its image.
function renderService(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  const slug = kebabCase(r.name);
  const port = typeof r.props.port === 'number' ? r.props.port : 3000;
  const links = plan.linkVarsById.get(r.id) ?? [];
  const lines = [`const ${v} = new sst.aws.Service(${q(r.name)}, {`, `  cluster,`];
  lines.push(`  image: { context: ${q(`./services/${slug}`)} },`);
  if (typeof r.props.cpu === 'string' && r.props.cpu !== '0.25 vCPU')
    lines.push(`  cpu: ${q(r.props.cpu)},`);
  if (typeof r.props.memory === 'string' && r.props.memory && r.props.memory !== '0.5 GB')
    lines.push(`  memory: ${q(r.props.memory)},`);
  if (r.props.public !== 'no') {
    lines.push(
      `  loadBalancer: {`,
      `    rules: [{ listen: "80/http", forward: ${q(`${port}/http`)} }],`,
      `  },`,
    );
  }
  if (links.length) lines.push(`  link: ${linkArray(links)},`);
  // In `sst dev` the service is NOT deployed — SST runs this command locally.
  lines.push(`  dev: { command: "npm run dev" },`);
  lines.push(`});`);
  return lines.join('\n');
}

// ECS Fargate Task (one-off / batch) on the shared Cluster. No load balancer — it's
// invoked on demand via task.run(Resource.<Name>). The container lives in tasks/<name>/.
function renderTask(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  const slug = kebabCase(r.name);
  const links = plan.linkVarsById.get(r.id) ?? [];
  const lines = [`const ${v} = new sst.aws.Task(${q(r.name)}, {`, `  cluster,`];
  lines.push(`  image: { context: ${q(`./tasks/${slug}`)} },`);
  if (typeof r.props.cpu === 'string' && r.props.cpu !== '0.25 vCPU')
    lines.push(`  cpu: ${q(r.props.cpu)},`);
  if (typeof r.props.memory === 'string' && r.props.memory && r.props.memory !== '0.5 GB')
    lines.push(`  memory: ${q(r.props.memory)},`);
  if (links.length) lines.push(`  link: ${linkArray(links)},`);
  lines.push(`  dev: { command: "npm run task" },`);
  lines.push(`});`);
  return lines.join('\n');
}

// Cognito user pool + a web client. Linked → Resource.<Pool>.id; the pool/client
// ids are injected into the Next.js app as NEXT_PUBLIC_COGNITO_* env (see renderNextjs).
function renderCognito(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  return `const ${v} = new sst.aws.CognitoUserPool(${q(r.name)});\nconst ${v}Client = ${v}.addClient("Web");`;
}

function renderSubscriber(sub: AwsPlan['subscribers'][number], plan: AwsPlan): string {
  const p = sub.worker.props;
  const cfg = [`  handler: ${q(sub.handlerPath)},`];
  if (sub.linkVars.length) cfg.push(`  link: ${linkArray(sub.linkVars)},`);
  if (str(p.memory)) cfg.push(`  memory: ${q(str(p.memory)!)},`);
  cfg.push(`  timeout: ${q(str(p.timeout) ?? '60 seconds')},`);
  if (plan.vpcConsumerIds.has(sub.worker.id)) cfg.push(`  vpc,`);
  // Queue.subscribe is SUBSCRIBER-FIRST; Bus / SnsTopic.subscribe are NAME-FIRST.
  if (sub.targetKind === 'queue') {
    return [`${sub.targetVar}.subscribe({`, ...cfg, `});`].join('\n');
  }
  return [`${sub.targetVar}.subscribe(${q(sub.worker.name)}, {`, ...cfg, `});`].join('\n');
}

function renderFunction(fn: AwsPlan['functions'][number], plan: AwsPlan): string {
  const p = fn.worker.props;
  const lines = [
    `const ${fn.varName} = new sst.aws.Function(${q(fn.worker.name)}, {`,
    `  handler: ${q(fn.handlerPath)},`,
  ];
  if (fn.linkVars.length) lines.push(`  link: ${linkArray(fn.linkVars)},`);
  if (str(p.timeout)) lines.push(`  timeout: ${q(str(p.timeout)!)},`);
  if (str(p.memory)) lines.push(`  memory: ${q(str(p.memory)!)},`);
  if (plan.vpcConsumerIds.has(fn.worker.id)) lines.push(`  vpc,`);
  lines.push(`});`);
  return lines.join('\n');
}

function renderCron(cron: AwsPlan['crons'][number], plan: AwsPlan): string {
  const vpc = cron.workerId ? plan.vpcConsumerIds.has(cron.workerId) : false;
  const lines = [`new sst.aws.CronV2(${q(cron.cron.name)}, {`, `  schedule: ${q(cron.schedule)},`];
  if (cron.handlerPath && (cron.linkVars.length || vpc)) {
    lines.push(`  function: {`);
    lines.push(`    handler: ${q(cron.handlerPath)},`);
    if (cron.linkVars.length) lines.push(`    link: ${linkArray(cron.linkVars)},`);
    if (vpc) lines.push(`    vpc,`);
    lines.push(`  },`);
  } else if (cron.handlerPath) {
    lines.push(`  function: ${q(cron.handlerPath)},`);
  }
  lines.push(`});`);
  return lines.join('\n');
}

// IoT-backed WebSocket pub/sub. authorizer is REQUIRED (no anonymous connect). We
// also wire a starter subscriber. IoT is account-shared, so every topic/filter is
// prefixed with `${$app.name}/${$app.stage}/` (verified caveat).
function renderRealtime(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  return [
    `const ${v} = new sst.aws.Realtime(${q(r.name)}, {`,
    `  authorizer: "src/realtime-authorizer.handler",`,
    `});`,
    `${v}.subscribe("src/realtime-subscriber.handler", {`,
    '  filter: `${$app.name}/${$app.stage}/#`,',
    `});`,
  ].join('\n');
}

// A durable state machine. Builders are STATIC (sst.aws.StepFunctions.lambdaInvoke).
// We emit a sensible Validate → Process → Done sequence (verified shape); extend the
// definition with .choice()/.parallel()/.map() and more steps. Each step is a Lambda.
function renderStepFunctions(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id)!;
  const slug = kebabCase(r.name);
  const type = r.props.type === 'express' ? 'express' : 'standard';
  const validate = `${v}Validate`;
  const process = `${v}Process`;
  const done = `${v}Done`;
  return [
    `const ${validate} = sst.aws.StepFunctions.lambdaInvoke({`,
    `  name: "Validate",`,
    `  function: ${q(`src/${slug}-validate.handler`)},`,
    `});`,
    `const ${process} = sst.aws.StepFunctions.lambdaInvoke({`,
    `  name: "Process",`,
    `  function: ${q(`src/${slug}-process.handler`)},`,
    `});`,
    `const ${done} = sst.aws.StepFunctions.succeed({ name: "Done" });`,
    `const ${v} = new sst.aws.StepFunctions(${q(r.name)}, {`,
    `  definition: ${validate}.next(${process}.next(${done})),`,
    `  type: ${q(type)},`,
    `});`,
  ].join('\n');
}

function renderNextjs(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  const links = plan.linkVarsById.get(r.id) ?? [];
  const path = str(r.props.path) ?? '.';
  const lines = [`const ${v} = new sst.aws.Nextjs(${q(r.name)}, {`, `  path: ${q(path)},`];
  if (str(r.props.domain)) lines.push(`  domain: ${q(str(r.props.domain)!)},`);
  if (links.length) lines.push(`  link: ${linkArray(links)},`);
  // Canonical SST Postgres pattern: vpc goes to BOTH the database and its consumers.
  if (plan.vpcConsumerIds.has(r.id)) lines.push(`  vpc,`);

  const envEntries: string[] = [];
  const env = r.props.environment;
  if (env && typeof env === 'object' && !Array.isArray(env)) {
    for (const [k, val] of Object.entries(env as Record<string, unknown>)) {
      envEntries.push(`    ${objKey(k)}: ${q(String(val))},`);
    }
  }
  // Cognito: inject pool/client ids from outputs (expressions, not strings).
  const cognitoEdge = plan.bp.connections.find(
    (c) => c.source === r.id && c.intent === 'usesCognito',
  );
  const cognitoVar = cognitoEdge ? plan.varNameById.get(cognitoEdge.target) : undefined;
  if (cognitoVar) {
    envEntries.push(`    NEXT_PUBLIC_COGNITO_USER_POOL_ID: ${cognitoVar}.id,`);
    envEntries.push(`    NEXT_PUBLIC_COGNITO_CLIENT_ID: ${cognitoVar}Client.id,`);
    envEntries.push(`    NEXT_PUBLIC_AWS_REGION: ${q(plan.bp.app.region)},`);
  }
  if (envEntries.length) {
    lines.push(`  environment: {`, ...envEntries, `  },`);
  }
  lines.push(`});`);
  return lines.join('\n');
}

function renderStaticSite(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  const path = str(r.props.path) ?? '.';
  const lines = [`const ${v} = new sst.aws.StaticSite(${q(r.name)}, {`, `  path: ${q(path)},`];
  const cmd = str(r.props.buildCommand);
  const out = str(r.props.buildOutput);
  if (cmd && out) lines.push(`  build: { command: ${q(cmd)}, output: ${q(out)} },`);
  // Served under a Router at a path (router option).
  const routedBy = plan.bp.connections.find((c) => c.source === r.id && c.intent === 'routedBy');
  const routerVar = routedBy ? plan.varNameById.get(routedBy.target) : undefined;
  if (routerVar) {
    lines.push(`  router: { instance: ${routerVar}, path: ${q(str(r.props.routePath) ?? '/')} },`);
  }
  lines.push(`});`);
  return lines.join('\n');
}

const OUTPUT_ORDER: Record<string, number> = {
  nextjs: 0,
  staticsite: 0,
  apigatewayv2: 0,
  router: 0,
  service: 0,
  bucket: 1,
  dynamo: 2,
  queue: 3,
};

function renderOutputs(bp: Blueprint, plan: AwsPlan): string | null {
  const entries = plan.declared
    .filter((r) => r.kind in OUTPUT_ORDER)
    // A private Service (no load balancer) has no .url to export.
    .filter((r) => !(r.kind === 'service' && r.props.public === 'no'))
    .sort((a, b) => OUTPUT_ORDER[a.kind] - OUTPUT_ORDER[b.kind])
    .map((r) => {
      const v = plan.varNameById.get(r.id)!;
      const prop =
        r.kind === 'nextjs' ||
        r.kind === 'queue' ||
        r.kind === 'staticsite' ||
        r.kind === 'apigatewayv2' ||
        r.kind === 'router' ||
        r.kind === 'service'
          ? 'url'
          : 'name';
      return `  ${v}: ${v}.${prop},`;
    });
  if (!entries.length) return null;
  return ['return {', ...entries, '};'].join('\n');
}

export function generateSstConfig(bp: Blueprint): string {
  const plan = planAws(bp);
  const byKind = (kind: string) => plan.declared.filter((r) => r.kind === kind);

  const statements: string[] = [];
  for (const r of byKind('secret')) statements.push(renderSecret(r, plan));
  for (const r of byKind('ai')) statements.push(renderSecret(r, plan));
  for (const r of byKind('email')) statements.push(renderEmail(r, plan));
  for (const r of byKind('cognito')) statements.push(renderCognito(r, plan));
  for (const r of byKind('bucket')) statements.push(renderBucket(r, plan));
  for (const r of byKind('dynamo')) statements.push(renderDynamo(r, plan));
  const services = byKind('service');
  const tasks = byKind('task');
  const vpcResources = [
    ...byKind('postgres'),
    ...byKind('aurora'),
    ...byKind('redis'),
    ...services,
    ...tasks,
  ];
  if (vpcResources.length) {
    const nat = effectiveAwsNat(bp);
    statements.push(
      nat === 'none'
        ? 'const vpc = new sst.aws.Vpc("Vpc");'
        : `const vpc = new sst.aws.Vpc("Vpc", {\n  nat: "${nat}",\n});`,
    );
    for (const r of byKind('postgres')) statements.push(renderPostgres(r, plan));
    for (const r of byKind('aurora')) statements.push(renderAurora(r, plan));
    for (const r of byKind('redis')) statements.push(renderRedis(r, plan));
    // One shared Cluster (just a namespace on the Vpc) backs every Service AND Task.
    if (services.length || tasks.length) {
      statements.push('const cluster = new sst.aws.Cluster("Cluster", { vpc });');
      for (const r of services) statements.push(renderService(r, plan));
      for (const r of tasks) statements.push(renderTask(r, plan));
    }
  }
  // DLQ targets must be declared before the queues that reference their .arn.
  {
    const queues = byKind('queue');
    const queueIds = new Set(queues.map((r) => r.id));
    const dlqTargetOf = new Map(
      bp.connections
        .filter((c) => c.intent === 'deadLettersTo' && queueIds.has(c.source))
        .map((c) => [c.source, c.target]),
    );
    const placed = new Set<string>();
    let remaining = queues;
    while (remaining.length) {
      const ready = remaining.filter((r) => {
        const t = dlqTargetOf.get(r.id);
        return !t || placed.has(t) || !queueIds.has(t);
      });
      // Cycles are a validation error; emit in input order so generation still
      // terminates for previews of invalid designs.
      const batch = ready.length ? ready : [remaining[0]];
      for (const r of batch) {
        statements.push(renderQueue(r, plan));
        placed.add(r.id);
      }
      remaining = remaining.filter((r) => !placed.has(r.id));
    }
  }
  for (const r of byKind('bus')) statements.push(renderBus(r, plan));
  for (const r of byKind('snstopic')) statements.push(renderSnsTopic(r, plan));
  for (const r of byKind('realtime')) statements.push(renderRealtime(r, plan));
  for (const r of byKind('stepFunctions')) statements.push(renderStepFunctions(r, plan));
  for (const r of byKind('apigatewayv2')) statements.push(renderApi(r, plan));
  for (const r of byKind('router')) statements.push(renderRouter(r, plan));
  for (const sub of plan.subscribers) statements.push(renderSubscriber(sub, plan));
  for (const fn of plan.functions) statements.push(renderFunction(fn, plan));
  for (const cron of plan.crons) statements.push(renderCron(cron, plan));
  for (const route of plan.routes) statements.push(renderRoute(route, plan));
  for (const bn of plan.bucketNotifies) statements.push(renderBucketNotify(bn, plan));
  for (const rb of plan.routerBuckets) statements.push(renderRouteBucket(rb));
  for (const r of byKind('nextjs')) statements.push(renderNextjs(r, plan));
  for (const r of byKind('staticsite')) statements.push(renderStaticSite(r, plan));

  const outputs = renderOutputs(bp, plan);
  if (outputs) statements.push(outputs);

  const runBody = statements.length ? indent(statements.join('\n\n'), 4) : '';

  const app = [
    '  app(input) {',
    '    return {',
    `      name: ${q(bp.app.name)},`,
    '      home: "aws",',
    '      removal: input.stage === "production" ? "retain" : "remove",',
    '      protect: input.stage === "production",',
    '      providers: {',
    '        aws: {',
    `          region: ${q(bp.app.region)},`,
    '        },',
    '      },',
    '    };',
    '  },',
  ].join('\n');

  return [
    HEADER,
    '',
    'export default $config({',
    app,
    '  async run() {',
    runBody,
    '  },',
    '});',
    '',
  ].join('\n');
}
