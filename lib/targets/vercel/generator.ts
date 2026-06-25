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

// Streaming chat through the Vercel AI Gateway. The bare "provider/model" string
// routes via the gateway (auth: AI_GATEWAY_API_KEY). YOU run this — the builder
// makes ZERO AI calls. verified: ai@7 (ai-sdk.dev/docs/ai-sdk-ui/chatbot, 2026-06-25).
const aiChatRoute = (model: string): string =>
  `import { streamText, convertToModelMessages, type UIMessage } from "ai";

export const maxDuration = 30;

export async function POST(req: Request): Promise<Response> {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const result = streamText({
    // Vercel AI Gateway model string — swappable; the key lives in your .env.local.
    model: ${q(model)},
    system: "You are a helpful assistant.",
    messages: convertToModelMessages(messages),
  });
  return result.toUIMessageStreamResponse();
}
`;

const aiChatPage = (): string =>
  `"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";

export default function Chat() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");

  return (
    <main style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>Chat</h1>
      {messages.map((m) => (
        <div key={m.id} style={{ margin: "0.5rem 0" }}>
          <strong>{m.role}: </strong>
          {m.parts.map((p, i) => (p.type === "text" ? <span key={i}>{p.text}</span> : null))}
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) {
            sendMessage({ text: input });
            setInput("");
          }
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={status !== "ready"}
          placeholder="Say something…"
          style={{ width: "100%", padding: 8 }}
        />
      </form>
    </main>
  );
}
`;

// Durable Workflow (verified: workflow@4 — github.com/vercel/workflow, workflow-sdk.dev).
// Directives go INSIDE the function body; steps are retried + durable; sleep() pauses
// with zero compute billed and resumes after deploys/crashes. Zero-config on Vercel.
const camel = (s: string): string => `${s.charAt(0).toLowerCase()}${s.slice(1)}`;

const workflowFile = (name: string): string =>
  `import { sleep } from "workflow";

export async function ${camel(name)}(input: string) {
  "use workflow";

  const first = await firstStep(input);
  await sleep("1 minute"); // pause — zero compute billed; resumes here
  const second = await secondStep(first);
  return { first, second };
}

async function firstStep(input: string) {
  "use step";
  // TODO: your durable, side-effecting work (auto-retried on failure)
  return { input, done: true };
}

async function secondStep(prev: { input: string; done: boolean }) {
  "use step";
  return { ...prev, finalized: true };
}
`;

// Feature flags (verified: flags@4.2.0 — flags-sdk.dev). decide() is static unless
// a flagsBackedBy→edgeConfig edge switches it to the Edge Config adapter.
const flagsFile = (edgeConfigBacked: boolean): string =>
  edgeConfigBacked
    ? `import { flag } from "flags/next";
import { edgeConfigAdapter } from "@flags-sdk/edge-config";

// Values read from Vercel Edge Config at the edge (no redeploy to flip a flag).
export const showNewDashboard = flag<boolean>({
  key: "show-new-dashboard",
  description: "Show the redesigned dashboard",
  adapter: edgeConfigAdapter(),
});
`
    : `import { flag } from "flags/next";

// Type-safe feature flag. decide() may be sync or async and read request context.
export const showNewDashboard = flag<boolean>({
  key: "show-new-dashboard",
  description: "Show the redesigned dashboard",
  decide: () => false,
});
`;

const flagsDiscoveryRoute = (): string =>
  `import { createFlagsDiscoveryEndpoint, getProviderData } from "flags/next";
import * as flags from "@/flags";

// Exposes your flags to the Vercel Flags Explorer (needs FLAGS_SECRET).
export const GET = createFlagsDiscoveryEndpoint(async () => getProviderData(flags));
`;

// Reusable rate-limit guard (verified: @vercel/firewall@1.2.1). The WAF rule itself
// is a documented dashboard prerequisite — see the comment below.
const rateLimitHelper = (): string =>
  `import { checkRateLimit } from "@vercel/firewall";

// PREREQUISITE: publish a WAF Custom Rule in the Vercel dashboard with condition
// "@vercel/firewall" and a matching Rate limit ID, or checkRateLimit returns
// { error: "not-found" }. Counters are tracked per-region.
export async function isRateLimited(
  ruleId: string,
  request: Request,
  rateLimitKey?: string,
): Promise<boolean> {
  const { rateLimited } = await checkRateLimit(ruleId, { request, rateLimitKey });
  return rateLimited;
}
`;

// Fire-and-forget after the response (verified: after() is built into next/server,
// stable since Next 15.1 — no package). Best-effort; for guaranteed work use Queue/Cron.
const afterExample = (): string =>
  `import { after } from "next/server";

export async function trackEvent(name: string): Promise<{ ok: true }> {
  after(async () => {
    // TODO: background work (log, notify, warm a cache…) — runs after the response.
    console.log("after response:", name);
  });
  return { ok: true };
}
`;

// Routing middleware (verified: Next 16 renamed middleware→proxy; proxy.ts at root,
// exported function `proxy`; runtime option is unavailable here). request.geo/.ip were
// removed — use geolocation()/ipAddress() from @vercel/functions@3.
const edgeProxyFile = (): string =>
  `import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { geolocation, ipAddress } from "@vercel/functions";

export function proxy(request: NextRequest): NextResponse {
  const { country } = geolocation(request);
  const { pathname } = request.nextUrl;

  // Geo redirect: send EU visitors to a localized path.
  const EU = new Set(["FR", "DE", "ES", "IT", "NL", "IE"]);
  if (country && EU.has(country) && !pathname.startsWith("/eu")) {
    return NextResponse.redirect(new URL(\`/eu\${pathname}\`, request.url));
  }

  // Auth gate: require a session cookie on /dashboard.
  if (pathname.startsWith("/dashboard") && !request.cookies.has("session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Forward the client IP downstream.
  const headers = new Headers(request.headers);
  headers.set("x-client-ip", ipAddress(request) ?? "unknown");
  return NextResponse.next({ request: { headers } });
}

// Run on everything except static assets / image optimizer / metadata files.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
`;

// Invisible bot detection (verified: botid@1.5). The protected path MUST appear in
// BOTH the client initBotId list and the server checkBotId() call site.
const botIdInstrumentation = (protectedPath: string): string =>
  `import { initBotId } from "botid/client/core";

// Routes to protect. Each path here must also call checkBotId() server-side.
initBotId({
  protect: [{ path: ${q(protectedPath)}, method: "POST" }],
});
`;

const botIdGuard = (protectedPath: string): string =>
  `import { checkBotId } from "botid/server";

// Call at the TOP of the "${protectedPath}" route handler. That path must also be
// listed in instrumentation-client.ts's initBotId protect[], or verification fails.
export async function assertHuman(): Promise<Response | null> {
  const verification = await checkBotId();
  if (verification.isBot) {
    return new Response(JSON.stringify({ error: "Access denied" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }
  return null;
}
`;

// Ephemeral microVM to run untrusted / AI-generated code (verified: @vercel/sandbox@2,
// GA). MUST be Node runtime (the SDK uses node streams/undici); region-locked to iad1;
// auth is automatic on Vercel via VERCEL_OIDC_TOKEN (locally: vercel link && env pull).
const sandboxRoute = (): string =>
  `import { Sandbox } from "@vercel/sandbox";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  const sandbox = await Sandbox.create({
    runtime: "node24",
    timeout: 5 * 60 * 1000, // 5 min default; max 45m Hobby / 24h Pro
  });
  try {
    const result = await sandbox.runCommand({
      cmd: "node",
      args: ["-e", "console.log('Hello from Vercel Sandbox!')"],
    });
    const stdout = await result.stdout();
    const stderr = await result.stderr();
    return Response.json({ exitCode: result.exitCode, stdout, stderr });
  } finally {
    await sandbox.stop();
  }
}
`;

const workflowTriggerRoute = (name: string, slug: string): string =>
  `import { start } from "workflow/api";
import { ${camel(name)} } from "@/workflows/${slug}";

// Start the durable "${name}" workflow. start() is NON-blocking and returns a Run
// handle — never await the workflow's completion inside the request.
export async function POST(req: Request): Promise<Response> {
  const { input } = (await req.json()) as { input: string };
  const run = await start(${camel(name)}, [input]);
  return new Response(JSON.stringify({ runId: run.runId }), {
    headers: { "content-type": "application/json" },
  });
}
`;

// Dynamic Open Graph image. App Router bundles @vercel/og — no install. Satori
// renders a CSS subset (display:flex, NOT grid); 1200x630 PNG. verified: next/og (Next 16).
const ogImageRoute = (): string =>
  `import { ImageResponse } from "next/og";

export async function GET(request: Request): Promise<ImageResponse> {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "Hello";
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 64,
          color: "white",
          background: "#0a0a0a",
        }}
      >
        {title}
      </div>
    ),
    { width: 1200, height: 630 },
  );
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
  ai: '^7.0.0',
  '@ai-sdk/react': '^4.0.0',
  workflow: '^4.5.0',
  flags: '^4.2.0',
  '@flags-sdk/edge-config': '^0.1.2',
  '@vercel/firewall': '^1.2.1',
  '@vercel/functions': '^3.7.0',
  botid: '^1.5.0',
  '@vercel/sandbox': '^2.2.0',
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
  if (present.has('aiGateway')) {
    add('ai');
    add('@ai-sdk/react');
  }
  if (present.has('workflow')) add('workflow');
  if (present.has('featureFlags')) {
    add('flags');
    if (bp.connections.some((c) => c.intent === 'flagsBackedBy')) add('@flags-sdk/edge-config');
  }
  if (present.has('rateLimit')) add('@vercel/firewall');
  if (present.has('edgeMiddleware')) add('@vercel/functions');
  if (present.has('botId')) add('botid');
  if (present.has('sandbox')) add('@vercel/sandbox');
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
  const aiNode = bp.resources.find((r) => r.kind === 'aiGateway');
  if (aiNode) {
    files.push({
      path: 'app/api/chat/route.ts',
      content: aiChatRoute(strProp(aiNode, 'model', 'openai/gpt-4o')),
      language: 'ts',
    });
    files.push({ path: 'app/chat/page.tsx', content: aiChatPage(), language: 'tsx' });
  }
  if (has('ogImage'))
    files.push({ path: 'app/api/og/route.tsx', content: ogImageRoute(), language: 'tsx' });
  for (const wf of bp.resources.filter((r) => r.kind === 'workflow')) {
    const slug = kebabCase(wf.name);
    files.push({ path: `workflows/${slug}.ts`, content: workflowFile(wf.name), language: 'ts' });
    files.push({
      path: `app/api/workflows/${slug}/route.ts`,
      content: workflowTriggerRoute(wf.name, slug),
      language: 'ts',
    });
  }
  const flagsNode = bp.resources.find((r) => r.kind === 'featureFlags');
  if (flagsNode) {
    const backed = bp.connections.some(
      (c) => c.source === flagsNode.id && c.intent === 'flagsBackedBy',
    );
    files.push({ path: 'flags.ts', content: flagsFile(backed), language: 'ts' });
    files.push({
      path: 'app/.well-known/vercel/flags/route.ts',
      content: flagsDiscoveryRoute(),
      language: 'ts',
    });
  }
  if (has('rateLimit'))
    files.push({ path: 'lib/rate-limit.ts', content: rateLimitHelper(), language: 'ts' });
  if (has('afterResponse'))
    files.push({ path: 'app/actions/background-task.ts', content: afterExample(), language: 'ts' });
  if (has('edgeMiddleware'))
    files.push({ path: 'proxy.ts', content: edgeProxyFile(), language: 'ts' });
  if (has('sandbox'))
    files.push({ path: 'app/api/sandbox/route.ts', content: sandboxRoute(), language: 'ts' });
  if (has('botId')) {
    const protectedPath = has('aiGateway') ? '/api/chat' : '/api/protected';
    files.push({
      path: 'instrumentation-client.ts',
      content: botIdInstrumentation(protectedPath),
      language: 'ts',
    });
    files.push({
      path: 'lib/bot-protection.ts',
      content: botIdGuard(protectedPath),
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
