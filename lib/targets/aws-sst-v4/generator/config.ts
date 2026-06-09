import type { Blueprint, Resource } from '@/lib/core/blueprint/types';
import { indent } from '@/lib/core/codegen/strings';
import { planAws, type AwsPlan } from './plan';

// sst.config.ts renderer. Verified against docs/sst-v4-target.md@0.1.0 (2026-06-08):
// $config + triple-slash ref, no provider imports, resources in run(), links,
// Queue.subscribe SUBSCRIBER-FIRST, sst.aws.CronV2 (not Cron), removal enum.

const HEADER = '/// <reference path="./.sst/platform/config.d.ts" />';

function linkArray(vars: string[]): string {
  return `[${vars.join(', ')}]`;
}

function renderSecret(r: Resource, plan: AwsPlan): string {
  return `const ${plan.varNameById.get(r.id)} = new sst.Secret("${r.name}");`;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function renderBucket(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  const access = r.props.access;
  if (access === 'public' || access === 'cloudfront') {
    return `const ${v} = new sst.aws.Bucket("${r.name}", {\n  access: "${access}",\n});`;
  }
  return `const ${v} = new sst.aws.Bucket("${r.name}");`;
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
    .map(([k, t]) => `    ${k}: "${t}",`)
    .join('\n');
  const primaryStr = rangeKey
    ? `{ hashKey: "${hashKey}", rangeKey: "${rangeKey}" }`
    : `{ hashKey: "${hashKey}" }`;

  const lines = [
    `const ${v} = new sst.aws.Dynamo("${r.name}", {`,
    `  fields: {`,
    fieldLines,
    `  },`,
    `  primaryIndex: ${primaryStr},`,
  ];
  if (hasGsi) {
    const gsiStr = gsiRange
      ? `{ hashKey: "${gsiHash}", rangeKey: "${gsiRange}" }`
      : `{ hashKey: "${gsiHash}" }`;
    lines.push(`  globalIndexes: {`, `    ${gsiName}: ${gsiStr},`, `  },`);
  }
  lines.push(`});`);
  return lines.join('\n');
}

function renderQueue(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  if (r.props.fifo === true) {
    return `const ${v} = new sst.aws.Queue("${r.name}", {\n  fifo: true,\n});`;
  }
  return `const ${v} = new sst.aws.Queue("${r.name}");`;
}

function renderBus(r: Resource, plan: AwsPlan): string {
  return `const ${plan.varNameById.get(r.id)} = new sst.aws.Bus("${r.name}");`;
}

function renderSnsTopic(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  if (r.props.fifo === true) {
    return `const ${v} = new sst.aws.SnsTopic("${r.name}", {\n  fifo: true,\n});`;
  }
  return `const ${v} = new sst.aws.SnsTopic("${r.name}");`;
}

function renderApi(r: Resource, plan: AwsPlan): string {
  return `const ${plan.varNameById.get(r.id)} = new sst.aws.ApiGatewayV2("${r.name}");`;
}

// api.route("METHOD /path", handler) — handler is a string, or an object when it links.
function renderRoute(route: AwsPlan['routes'][number]): string {
  if (route.linkVars.length) {
    return [
      `${route.apiVar}.route("${route.route}", {`,
      `  handler: "${route.handlerPath}",`,
      `  link: ${linkArray(route.linkVars)},`,
      `});`,
    ].join('\n');
  }
  return `${route.apiVar}.route("${route.route}", "${route.handlerPath}");`;
}

// bucket.notify({ notifications: [{ name, function, events }] }) — S3 object events → Lambda.
function renderBucketNotify(bn: AwsPlan['bucketNotifies'][number]): string {
  const entries = bn.notifiers.map((n) => {
    const fn = n.linkVars.length
      ? `{ handler: "${n.handlerPath}", link: ${linkArray(n.linkVars)} }`
      : `"${n.handlerPath}"`;
    return [
      `    {`,
      `      name: "${n.name}",`,
      `      function: ${fn},`,
      `      events: ["s3:ObjectCreated:*"],`,
      `    },`,
    ].join('\n');
  });
  return [`${bn.bucketVar}.notify({`, `  notifications: [`, ...entries, `  ],`, `});`].join('\n');
}

function renderEmail(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  const sender = str(r.props.sender) ?? 'noreply@example.com';
  return `const ${v} = new sst.aws.Email("${r.name}", {\n  sender: "${sender}",\n});`;
}

// RDS Postgres requires a Vpc (distinct from sst.aws.Aurora). One shared Vpc is
// generated automatically when any Postgres is present.
function renderPostgres(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  return `const ${v} = new sst.aws.Postgres("${r.name}", {\n  vpc,\n});`;
}

// Aurora Serverless v2 (Postgres) — a separate component from sst.aws.Postgres; also needs a Vpc.
function renderAurora(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  return `const ${v} = new sst.aws.Aurora("${r.name}", {\n  engine: "postgres",\n  vpc,\n});`;
}

// SST VPCs have NO NAT by default. Pick the strongest NAT requested across the
// Postgres nodes that share the generated VPC: managed > ec2 (fck-nat) > none.
function pickNat(resources: Resource[]): 'none' | 'ec2' | 'managed' {
  const vals = resources.map((r) => str(r.props.nat) ?? 'none');
  if (vals.includes('managed')) return 'managed';
  if (vals.includes('ec2')) return 'ec2';
  return 'none';
}

// Cognito user pool + a web client. Linked → Resource.<Pool>.id; the pool/client
// ids are injected into the Next.js app as NEXT_PUBLIC_COGNITO_* env (see renderNextjs).
function renderCognito(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  return `const ${v} = new sst.aws.CognitoUserPool("${r.name}");\nconst ${v}Client = ${v}.addClient("Web");`;
}

function renderSubscriber(sub: AwsPlan['subscribers'][number]): string {
  const p = sub.worker.props;
  const cfg = [`  handler: "${sub.handlerPath}",`];
  if (sub.linkVars.length) cfg.push(`  link: ${linkArray(sub.linkVars)},`);
  if (str(p.memory)) cfg.push(`  memory: "${str(p.memory)}",`);
  cfg.push(`  timeout: "${str(p.timeout) ?? '60 seconds'}",`);
  // Queue.subscribe is SUBSCRIBER-FIRST; Bus / SnsTopic.subscribe are NAME-FIRST.
  if (sub.targetKind === 'queue') {
    return [`${sub.targetVar}.subscribe({`, ...cfg, `});`].join('\n');
  }
  return [`${sub.targetVar}.subscribe("${sub.worker.name}", {`, ...cfg, `});`].join('\n');
}

function renderFunction(fn: AwsPlan['functions'][number]): string {
  const p = fn.worker.props;
  const lines = [
    `const ${fn.varName} = new sst.aws.Function("${fn.worker.name}", {`,
    `  handler: "${fn.handlerPath}",`,
  ];
  if (fn.linkVars.length) lines.push(`  link: ${linkArray(fn.linkVars)},`);
  if (str(p.timeout)) lines.push(`  timeout: "${str(p.timeout)}",`);
  if (str(p.memory)) lines.push(`  memory: "${str(p.memory)}",`);
  lines.push(`});`);
  return lines.join('\n');
}

function renderCron(cron: AwsPlan['crons'][number]): string {
  const lines = [`new sst.aws.CronV2("${cron.cron.name}", {`, `  schedule: "${cron.schedule}",`];
  if (cron.handlerPath && cron.linkVars.length) {
    lines.push(`  function: {`);
    lines.push(`    handler: "${cron.handlerPath}",`);
    lines.push(`    link: ${linkArray(cron.linkVars)},`);
    lines.push(`  },`);
  } else if (cron.handlerPath) {
    lines.push(`  function: "${cron.handlerPath}",`);
  }
  lines.push(`});`);
  return lines.join('\n');
}

function renderNextjs(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  const links = plan.linkVarsById.get(r.id) ?? [];
  const path = str(r.props.path) ?? '.';
  const lines = [`const ${v} = new sst.aws.Nextjs("${r.name}", {`, `  path: "${path}",`];
  if (str(r.props.domain)) lines.push(`  domain: "${str(r.props.domain)}",`);
  if (links.length) lines.push(`  link: ${linkArray(links)},`);

  const envEntries: string[] = [];
  const env = r.props.environment;
  if (env && typeof env === 'object' && !Array.isArray(env)) {
    for (const [k, val] of Object.entries(env as Record<string, unknown>)) {
      envEntries.push(`    ${k}: "${String(val)}",`);
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
    envEntries.push(`    NEXT_PUBLIC_AWS_REGION: "${plan.bp.app.region}",`);
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
  const lines = [`const ${v} = new sst.aws.StaticSite("${r.name}", {`, `  path: "${path}",`];
  const cmd = str(r.props.buildCommand);
  const out = str(r.props.buildOutput);
  if (cmd && out) lines.push(`  build: { command: "${cmd}", output: "${out}" },`);
  lines.push(`});`);
  return lines.join('\n');
}

const OUTPUT_ORDER: Record<string, number> = {
  nextjs: 0,
  staticsite: 0,
  apigatewayv2: 0,
  bucket: 1,
  dynamo: 2,
  queue: 3,
};

function renderOutputs(bp: Blueprint, plan: AwsPlan): string | null {
  const entries = plan.declared
    .filter((r) => r.kind in OUTPUT_ORDER)
    .sort((a, b) => OUTPUT_ORDER[a.kind] - OUTPUT_ORDER[b.kind])
    .map((r) => {
      const v = plan.varNameById.get(r.id)!;
      const prop =
        r.kind === 'nextjs' ||
        r.kind === 'queue' ||
        r.kind === 'staticsite' ||
        r.kind === 'apigatewayv2'
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
  const vpcResources = [...byKind('postgres'), ...byKind('aurora')];
  if (vpcResources.length) {
    const nat = pickNat(vpcResources);
    statements.push(
      nat === 'none'
        ? 'const vpc = new sst.aws.Vpc("Vpc");'
        : `const vpc = new sst.aws.Vpc("Vpc", {\n  nat: "${nat}",\n});`,
    );
    for (const r of byKind('postgres')) statements.push(renderPostgres(r, plan));
    for (const r of byKind('aurora')) statements.push(renderAurora(r, plan));
  }
  for (const r of byKind('queue')) statements.push(renderQueue(r, plan));
  for (const r of byKind('bus')) statements.push(renderBus(r, plan));
  for (const r of byKind('snstopic')) statements.push(renderSnsTopic(r, plan));
  for (const r of byKind('apigatewayv2')) statements.push(renderApi(r, plan));
  for (const sub of plan.subscribers) statements.push(renderSubscriber(sub));
  for (const fn of plan.functions) statements.push(renderFunction(fn));
  for (const cron of plan.crons) statements.push(renderCron(cron));
  for (const route of plan.routes) statements.push(renderRoute(route));
  for (const bn of plan.bucketNotifies) statements.push(renderBucketNotify(bn));
  for (const r of byKind('nextjs')) statements.push(renderNextjs(r, plan));
  for (const r of byKind('staticsite')) statements.push(renderStaticSite(r, plan));

  const outputs = renderOutputs(bp, plan);
  if (outputs) statements.push(outputs);

  const runBody = statements.length ? indent(statements.join('\n\n'), 4) : '';

  const app = [
    '  app(input) {',
    '    return {',
    `      name: "${bp.app.name}",`,
    '      home: "aws",',
    '      removal: input.stage === "production" ? "retain" : "remove",',
    '      protect: input.stage === "production",',
    '      providers: {',
    '        aws: {',
    `          region: "${bp.app.region}",`,
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
