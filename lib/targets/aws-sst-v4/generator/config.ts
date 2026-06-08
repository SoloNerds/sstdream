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

function renderBucket(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  if (r.props.access === 'public') {
    return `const ${v} = new sst.aws.Bucket("${r.name}", {\n  access: "public",\n});`;
  }
  return `const ${v} = new sst.aws.Bucket("${r.name}");`;
}

function renderDynamo(r: Resource, plan: AwsPlan): string {
  const v = plan.varNameById.get(r.id);
  const fields =
    r.props.fields && typeof r.props.fields === 'object'
      ? (r.props.fields as Record<string, string>)
      : { pk: 'string', sk: 'string' };
  const primary =
    r.props.primaryIndex && typeof r.props.primaryIndex === 'object'
      ? (r.props.primaryIndex as { hashKey: string; rangeKey?: string })
      : { hashKey: 'pk', rangeKey: 'sk' };

  const fieldLines = Object.entries(fields)
    .map(([k, t]) => `    ${k}: "${t}",`)
    .join('\n');
  const primaryStr = primary.rangeKey
    ? `{ hashKey: "${primary.hashKey}", rangeKey: "${primary.rangeKey}" }`
    : `{ hashKey: "${primary.hashKey}" }`;

  return [
    `const ${v} = new sst.aws.Dynamo("${r.name}", {`,
    `  fields: {`,
    fieldLines,
    `  },`,
    `  primaryIndex: ${primaryStr},`,
    `});`,
  ].join('\n');
}

function renderQueue(r: Resource, plan: AwsPlan): string {
  return `const ${plan.varNameById.get(r.id)} = new sst.aws.Queue("${r.name}");`;
}

function renderSubscriber(sub: AwsPlan['subscribers'][number]): string {
  // Queue.subscribe is SUBSCRIBER-FIRST: handler/link/timeout go in the first object.
  const lines = [`${sub.queueVar}.subscribe({`, `  handler: "${sub.handlerPath}",`];
  if (sub.linkVars.length) lines.push(`  link: ${linkArray(sub.linkVars)},`);
  lines.push(`  timeout: "60 seconds",`);
  lines.push(`});`);
  return lines.join('\n');
}

function renderFunction(fn: AwsPlan['functions'][number]): string {
  const lines = [
    `const ${fn.varName} = new sst.aws.Function("${fn.worker.name}", {`,
    `  handler: "${fn.handlerPath}",`,
  ];
  if (fn.linkVars.length) lines.push(`  link: ${linkArray(fn.linkVars)},`);
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
  const lines = [`const ${v} = new sst.aws.Nextjs("${r.name}", {`, `  path: ".",`];
  if (links.length) lines.push(`  link: ${linkArray(links)},`);
  lines.push(`});`);
  return lines.join('\n');
}

const OUTPUT_ORDER: Record<string, number> = { nextjs: 0, bucket: 1, dynamo: 2, queue: 3 };

function renderOutputs(bp: Blueprint, plan: AwsPlan): string | null {
  const entries = plan.declared
    .filter((r) => r.kind in OUTPUT_ORDER)
    .sort((a, b) => OUTPUT_ORDER[a.kind] - OUTPUT_ORDER[b.kind])
    .map((r) => {
      const v = plan.varNameById.get(r.id)!;
      const prop = r.kind === 'nextjs' || r.kind === 'queue' ? 'url' : 'name';
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
  for (const r of byKind('bucket')) statements.push(renderBucket(r, plan));
  for (const r of byKind('dynamo')) statements.push(renderDynamo(r, plan));
  for (const r of byKind('queue')) statements.push(renderQueue(r, plan));
  for (const sub of plan.subscribers) statements.push(renderSubscriber(sub));
  for (const fn of plan.functions) statements.push(renderFunction(fn));
  for (const cron of plan.crons) statements.push(renderCron(cron));
  for (const r of byKind('nextjs')) statements.push(renderNextjs(r, plan));

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
