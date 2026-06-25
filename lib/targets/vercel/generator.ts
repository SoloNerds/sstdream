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

// "PaymentHook" -> "PAYMENT_HOOK" — for a per-webhook env var name.
const screamingSnake = (s: string): string => kebabCase(s).replace(/-/g, '_').toUpperCase();

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

const edgeConfigHelper = (): string =>
  `import { get, getAll } from "@vercel/edge-config";

// Vercel Edge Config (first-party, read-optimized). Connection is the EDGE_CONFIG env var.
export async function getConfig<T = unknown>(key: string): Promise<T | undefined> {
  return get<T>(key);
}

export async function getAllConfig(): Promise<Record<string, unknown>> {
  return getAll();
}
`;

const externalApiHelper = (name: string, baseUrlEnv: string, keyEnv: string): string =>
  `// Typed fetch helper for the "${name}" API. Base URL + key come from env (server-only).
const BASE_URL = process.env.${baseUrlEnv} ?? "";

export async function ${name.charAt(0).toLowerCase()}${name.slice(1)}Fetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(\`\${BASE_URL}\${path}\`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: \`Bearer \${process.env.${keyEnv} ?? ""}\`,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) throw new Error(\`${name} API \${res.status}\`);
  return res.json() as Promise<T>;
}
`;

const queueProducer = (topics: string[]): string =>
  `import { send } from "@vercel/queue";

/** Queue topics in this project (each queue's name, kebab-cased). */
export const TOPICS = {
${topics.map((t) => `  ${q(t)}: ${q(t)},`).join('\n')}
} as const;

/** Publish a job to a Vercel Queue topic. */
export async function enqueue(topic: string, body: unknown) {
  return send(topic, body);
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

const stripeWebhookRoute = (name: string): string =>
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

const genericWebhookRoute = (name: string, secretEnv: string): string =>
  `import crypto from "node:crypto";

// Generic webhook for "${name}". Verifies an HMAC-SHA256 signature (header
// "x-signature", hex) against ${secretEnv} before trusting the payload.
export async function POST(request: Request) {
  const body = await request.text();
  const provided = Buffer.from(request.headers.get("x-signature") ?? "", "utf8");
  const expected = Buffer.from(
    crypto.createHmac("sha256", process.env.${secretEnv}!).update(body).digest("hex"),
    "utf8",
  );
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return new Response("Invalid signature", { status: 401 });
  }
  // TODO: handle the verified payload for "${name}"
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

// Verified versions (npm registry, 2026-06-25). @vercel/queue is 0.x beta — its
// trigger format may change before GA (see docs/vercel-target.md §12).
const DEP_VERSIONS: Record<string, string> = {
  '@vercel/blob': '^2.4.0',
  '@neondatabase/serverless': '^1.1.0',
  '@upstash/redis': '^1.38.0',
  '@vercel/queue': '^0.3.1',
  '@vercel/edge-config': '^1.4.0',
  '@vercel/analytics': '^2.0.0',
  '@vercel/speed-insights': '^2.0.0',
  resend: '^6.14.0',
  stripe: '^22.3.0',
};

const webhookProvider = (r: Resource): string =>
  typeof r.props.provider === 'string' && r.props.provider ? r.props.provider : 'stripe';

function packageAdditions(bp: Blueprint): string {
  const present = new Set(bp.resources.map((r) => r.kind));
  const deps: Record<string, string> = {};
  const add = (name: string) => {
    deps[name] = DEP_VERSIONS[name];
  };
  if (present.has('blob')) add('@vercel/blob');
  if (present.has('postgres')) add('@neondatabase/serverless');
  if (present.has('redis')) add('@upstash/redis');
  if (present.has('queue')) add('@vercel/queue');
  if (present.has('edgeConfig')) add('@vercel/edge-config');
  if (present.has('analytics')) add('@vercel/analytics');
  if (present.has('speedInsights')) add('@vercel/speed-insights');
  if (present.has('email')) add('resend');
  // stripe only when a webhook actually uses the Stripe provider.
  if (bp.resources.some((r) => r.kind === 'webhook' && webhookProvider(r) === 'stripe'))
    add('stripe');
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
  if (has('edgeConfig'))
    files.push({ path: 'lib/edge-config.ts', content: edgeConfigHelper(), language: 'ts' });
  for (const api of bp.resources.filter((r) => r.kind === 'externalApi')) {
    files.push({
      path: `lib/${kebabCase(api.name)}.ts`,
      content: externalApiHelper(
        api.name,
        strProp(api, 'baseUrlEnv', `${screamingSnake(api.name)}_BASE_URL`),
        strProp(api, 'keyEnv', `${screamingSnake(api.name)}_API_KEY`),
      ),
      language: 'ts',
    });
  }
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
      content: queueProducer(queues.map((qn) => kebabCase(qn.name))),
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
    const content =
      webhookProvider(wh) === 'stripe'
        ? stripeWebhookRoute(wh.name)
        : genericWebhookRoute(wh.name, `${screamingSnake(wh.name)}_WEBHOOK_SECRET`);
    files.push({ path: webhookPath(wh), content, language: 'ts' });
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
    content: packageAdditions(bp),
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
