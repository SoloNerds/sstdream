import type { Blueprint, Resource } from '@/lib/core/blueprint/types';
import type { GeneratedFile } from '@/lib/core/codegen/types';
import { kebabCase } from '@/lib/core/codegen/strings';
import { collectEnv } from './env';
import { generateVercelScaffold } from './scaffold';

// Vercel generator. Verified against docs/vercel-target.md: vercel.json crons + queue
// experimentalTriggers, @vercel/blob with `access`, @neondatabase/serverless,
// @upstash/redis (NOT @vercel/kv/postgres), @vercel/queue, Resend, Stripe webhook.

// Quote a user-controlled value for code position (escapes quotes/backslashes),
// so a free-text prop (Blob access, email sender) can never break the emitted TS.
const q = (s: string): string => JSON.stringify(s);

const blobHelper = (access: string): string =>
  `import { put } from "@vercel/blob";

/** Upload a file to Vercel Blob (store must be created; pulls BLOB_READ_WRITE_TOKEN). */
export async function uploadFile(key: string, body: Blob | ArrayBuffer | string) {
  return put(key, body, { access: ${q(access)}, addRandomSuffix: true });
}
`;

const uploadAction = (): string =>
  `"use server";

import { uploadFile } from "../../lib/blob";

export async function saveUpload(filename: string, data: Blob) {
  const blob = await uploadFile(filename, data);
  return { url: blob.url };
}
`;

const dbHelper = (): string =>
  `import { neon } from "@neondatabase/serverless";

// External Postgres (Neon). Provision with: vercel install neon
export const sql = neon(process.env.DATABASE_URL!);
`;

const redisHelper = (): string =>
  `import { Redis } from "@upstash/redis";

// External Redis (Upstash). Provision with: vercel install upstash
export const redis = Redis.fromEnv();
`;

const queueProducer = (topic: string): string =>
  `import { send } from "@vercel/queue";

export const TOPIC = "${topic}";

/** Publish a job to the Vercel Queue. */
export async function enqueue(body: unknown) {
  return send(TOPIC, body);
}
`;

const consumerRoute = (name: string): string =>
  `import { handleCallback } from "@vercel/queue";

// Push-mode consumer for "${name}". Trigger is wired in vercel.json.
export const POST = handleCallback(async (message) => {
  console.log("processing", message);
  // TODO: your processing logic
});
`;

const cronRoute = (name: string): string =>
  `export function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== \`Bearer \${process.env.CRON_SECRET}\`) {
    return new Response("Unauthorized", { status: 401 });
  }
  // TODO: scheduled logic for "${name}"
  return new Response("ok");
}
`;

const webhookRoute = (name: string): string =>
  `import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  // TODO: handle event.type for "${name}"
  console.log("stripe event", event.type);
  return new Response("ok");
}
`;

const emailHelper = (from: string): string =>
  `import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(to: string, subject: string, html: string) {
  return resend.emails.send({ from: ${q(from)}, to, subject, html });
}
`;

function packageAdditions(present: Set<string>): string {
  const deps: Record<string, string> = {};
  if (present.has('blob')) deps['@vercel/blob'] = 'latest';
  if (present.has('postgres')) deps['@neondatabase/serverless'] = 'latest';
  if (present.has('redis')) deps['@upstash/redis'] = 'latest';
  if (present.has('queue')) deps['@vercel/queue'] = 'latest';
  if (present.has('email')) deps['resend'] = 'latest';
  if (present.has('webhook')) deps['stripe'] = 'latest';
  return `${JSON.stringify({ dependencies: deps, scripts: { deploy: 'vercel --prod' } }, null, 2)}\n`;
}

export function generateVercel(bp: Blueprint): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const present = new Set(bp.resources.map((r) => r.kind));
  const byId = new Map(bp.resources.map((r) => [r.id, r]));
  const has = (kind: string) => present.has(kind);
  const cronPath = (r: Resource) => `/api/cron/${kebabCase(r.name)}`;
  const consumerPath = (r: Resource) => `app/api/queues/${kebabCase(r.name)}/route.ts`;
  const webhookPath = (r: Resource) => `app/api/webhooks/${kebabCase(r.name)}/route.ts`;

  // Storage / services
  const strProp = (r: Resource, key: string, fallback: string): string =>
    typeof r.props[key] === 'string' && r.props[key] ? (r.props[key] as string) : fallback;

  const blobNode = bp.resources.find((r) => r.kind === 'blob');
  if (blobNode) {
    files.push({
      path: 'lib/blob.ts',
      content: blobHelper(strProp(blobNode, 'access', 'public')),
      language: 'ts',
    });
    if (bp.connections.some((c) => c.intent === 'storesFileIn')) {
      files.push({ path: 'app/actions/upload-file.ts', content: uploadAction(), language: 'ts' });
    }
  }
  if (has('postgres')) files.push({ path: 'lib/db.ts', content: dbHelper(), language: 'ts' });
  if (has('redis')) files.push({ path: 'lib/redis.ts', content: redisHelper(), language: 'ts' });
  const emailNode = bp.resources.find((r) => r.kind === 'email');
  if (emailNode) {
    files.push({
      path: 'lib/email.ts',
      content: emailHelper(strProp(emailNode, 'from', 'noreply@example.com')),
      language: 'ts',
    });
  }

  // Queue producer + consumers
  const queues = bp.resources.filter((r) => r.kind === 'queue');
  if (queues.length) {
    files.push({
      path: 'lib/queue.ts',
      content: queueProducer(kebabCase(queues[0].name)),
      language: 'ts',
    });
  }
  const consumers = bp.resources.filter((r) => r.kind === 'consumer');
  for (const c of consumers) {
    files.push({ path: consumerPath(c), content: consumerRoute(c.name), language: 'ts' });
  }

  // Cron + webhook routes
  const crons = bp.resources.filter((r) => r.kind === 'cron');
  for (const cron of crons) {
    files.push({
      path: `app/api/cron/${kebabCase(cron.name)}/route.ts`,
      content: cronRoute(cron.name),
      language: 'ts',
    });
  }
  for (const wh of bp.resources.filter((r) => r.kind === 'webhook')) {
    files.push({ path: webhookPath(wh), content: webhookRoute(wh.name), language: 'ts' });
  }

  // vercel.json (only if there's something to configure)
  const cronsJson = crons.map((cron) => ({
    path: cronPath(cron),
    schedule: typeof cron.props.schedule === 'string' ? cron.props.schedule : '0 5 * * *',
  }));
  const functionsJson: Record<string, unknown> = {};
  for (const c of consumers) {
    const edge = bp.connections.find((e) => e.target === c.id && e.intent === 'consumedBy');
    const queue = edge ? byId.get(edge.source) : undefined;
    const topic = queue ? kebabCase(queue.name) : kebabCase(c.name);
    const fn: Record<string, unknown> = {
      experimentalTriggers: [{ type: 'queue/v2beta', topic }],
    };
    const md = c.props.maxDuration;
    const maxDuration =
      typeof md === 'number' ? md : typeof md === 'string' && md.trim() ? Number(md) : NaN;
    if (Number.isFinite(maxDuration) && maxDuration > 0) fn.maxDuration = maxDuration;
    functionsJson[consumerPath(c)] = fn;
  }
  if (cronsJson.length || Object.keys(functionsJson).length) {
    const vercelJson: Record<string, unknown> = {
      $schema: 'https://openapi.vercel.sh/vercel.json',
    };
    if (cronsJson.length) vercelJson.crons = cronsJson;
    if (Object.keys(functionsJson).length) vercelJson.functions = functionsJson;
    files.push({
      path: 'vercel.json',
      content: `${JSON.stringify(vercelJson, null, 2)}\n`,
      language: 'json',
    });
  }

  // Env manifest
  const env = collectEnv(bp);
  files.push({
    path: 'required-env.json',
    content: `${JSON.stringify(
      { required: env.map((e) => ({ name: e.name, scope: e.scope, environment: e.environments })) },
      null,
      2,
    )}\n`,
    language: 'json',
  });

  files.push({
    path: 'package.additions.json',
    content: packageAdditions(present),
    language: 'json',
  });

  const seen = new Set<string>();
  const integration = files.filter((f) => (seen.has(f.path) ? false : (seen.add(f.path), true)));

  // Wrap the integration files in a complete, runnable Next.js project so the
  // export is `vercel`-ready, not loose fragments (mirrors the AWS lane).
  const additions = integration.find((f) => f.path === 'package.additions.json');
  const parsed = additions
    ? (JSON.parse(additions.content) as { dependencies?: Record<string, string> })
    : {};
  const scaffold = generateVercelScaffold(bp, integration, parsed.dependencies ?? {});

  const out = [...integration, ...scaffold];
  const seenOut = new Set<string>();
  return out.filter((f) => (seenOut.has(f.path) ? false : (seenOut.add(f.path), true)));
}
