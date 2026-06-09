import type { Blueprint, Resource } from '@/lib/core/blueprint/types';
import type { GeneratedFile } from '@/lib/core/codegen/types';
import { kebabCase } from '@/lib/core/codegen/strings';
import { collectAwsEnv } from '../env';
import { planAws } from './plan';

// Runtime / app code generator. Verified against docs/sst-v4-target.md §5:
// linked resources are read via `import { Resource } from "sst"`; AWS SDK clients
// per resource (S3 presigner / SQS / Dynamo lib). Generated files are relative-import
// so they drop into any Next.js project root.

const envFile = (): string =>
  `import { Resource } from "sst";

// Access linked SST resources anywhere in your app or functions.
// e.g. Resource.Uploads.name, Resource.Jobs.url, Resource.MySecret.value
export { Resource };
`;

const storageFile = (bucketName: string): string =>
  `import { Resource } from "sst";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({});

/** Create a presigned PUT URL for uploading directly to the bucket. */
export async function createUploadUrl(key: string, contentType?: string) {
  const command = new PutObjectCommand({
    Bucket: Resource.${bucketName}.name,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}
`;

const uploadActionFile = (): string =>
  `"use server";

import { createUploadUrl } from "../../lib/storage";

export async function getUploadUrl(filename: string, contentType?: string) {
  const key = \`uploads/\${Date.now()}-\${filename}\`;
  const url = await createUploadUrl(key, contentType);
  return { url, key };
}
`;

const queueFile = (queueName: string): string =>
  `import { Resource } from "sst";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({});

/** Send a JSON message to the queue. */
export async function enqueue(body: unknown) {
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: Resource.${queueName}.url,
      MessageBody: JSON.stringify(body),
    }),
  );
}
`;

const enqueueActionFile = (): string =>
  `"use server";

import { enqueue } from "../../lib/queue";

export async function enqueueJob(payload: Record<string, unknown>) {
  await enqueue(payload);
  return { queued: true };
}
`;

const dynamoFile = (tableName: string): string =>
  `import { Resource } from "sst";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TableName = Resource.${tableName}.name;

export async function putItem(item: Record<string, unknown>) {
  await client.send(new PutCommand({ TableName, Item: item }));
}

export async function getItem(key: { pk: string; sk: string }) {
  const result = await client.send(new GetCommand({ TableName, Key: key }));
  return result.Item;
}
`;

const subscriberHandlerFile = (name: string, writesToDynamo: boolean): string => {
  const importLine = writesToDynamo ? `import { putItem } from "../../lib/dynamo";\n\n` : '';
  const writeBlock = writesToDynamo
    ? `
    // TODO: replace with your processing logic
    await putItem({
      pk: \`job#\${message.id ?? "unknown"}\`,
      sk: new Date().toISOString(),
      ...message,
    });`
    : `
    // TODO: replace with your processing logic`;
  return `${importLine}/** SQS subscriber for the "${name}" worker. */
export async function handler(event: { Records: { body: string }[] }) {
  for (const record of event.Records) {
    const message = JSON.parse(record.body) as Record<string, unknown>;
    console.log("Processing message", message);
${writeBlock}
  }
}
`;
};

const cronHandlerFile = (name: string): string =>
  `/** Scheduled handler for the "${name}" cron. */
export async function handler() {
  console.log("Running scheduled job: ${name}");
  // TODO: your scheduled logic here
}
`;

const functionHandlerFile = (name: string): string =>
  `/** Handler for the "${name}" function. */
export async function handler(event: unknown) {
  console.log("Invoked", event);
  // TODO: your logic here
}
`;

// Verified Anthropic usage (claude-api skill): model id `claude-opus-4-8` (no date
// suffix), official @anthropic-ai/sdk messages.stream(). Key is server-only via an SST
// secret; the streaming Route Handler validates input before calling Claude.
const aiHelperFile = (secretName: string, model: string): string =>
  `import { Resource } from "sst";
import Anthropic from "@anthropic-ai/sdk";

// Server-only Claude client. The API key is an SST secret — set it with:
//   sst secret set ${secretName} <your-anthropic-api-key>
// It is never sent to the browser.
export const anthropic = new Anthropic({ apiKey: Resource.${secretName}.value });

export const CHAT_MODEL = "${model}";
`;

const aiChatRouteFile = (): string =>
  `import { anthropic, CHAT_MODEL } from "../../../lib/ai";

// The Anthropic SDK requires the Node.js runtime (not edge).
export const runtime = "nodejs";
export const maxDuration = 30;

type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_MESSAGES = 50;
const MAX_CHARS = 8000;

export async function POST(request: Request) {
  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return new Response("Invalid messages", { status: 400 });
  }
  for (const m of messages) {
    if (
      (m.role !== "user" && m.role !== "assistant") ||
      typeof m.content !== "string" ||
      m.content.length === 0 ||
      m.content.length > MAX_CHARS
    ) {
      return new Response("Invalid message", { status: 400 });
    }
  }

  const claude = anthropic.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 4096,
    messages,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of claude) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
`;

// SES email helper — sender comes from the linked Email resource.
const emailHelperFile = (emailName: string): string =>
  `import { Resource } from "sst";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const ses = new SESv2Client();

/** Send a transactional email via Amazon SES. */
export async function sendEmail(to: string, subject: string, body: string) {
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: Resource.${emailName}.sender,
      Destination: { ToAddresses: [to] },
      Content: { Simple: { Subject: { Data: subject }, Body: { Text: { Data: body } } } },
    }),
  );
}
`;

// RDS Postgres pool — connection comes from the linked Postgres resource.
const postgresHelperFile = (dbName: string): string =>
  `import { Resource } from "sst";
import { Pool } from "pg";

// Connects to the linked RDS Postgres via the SST Resource (host/port/credentials).
export const pool = new Pool({
  host: Resource.${dbName}.host,
  port: Resource.${dbName}.port,
  user: Resource.${dbName}.username,
  password: Resource.${dbName}.password,
  database: Resource.${dbName}.database,
});
`;

// External integrations (env-driven — no SST infra). Verified env-var names from
// real projects: STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET, DATABASE_URL (Mongo), etc.
const stripeLibFile = (): string =>
  `import Stripe from "stripe";

// Server-only Stripe client. Set STRIPE_SECRET_KEY in your .env.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
`;

const stripeWebhookRouteFile = (): string =>
  `import { stripe } from "../../../../lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  // TODO: handle event.type (checkout.session.completed, customer.subscription.updated, …)
  console.log("stripe event", event.type);
  return new Response("ok");
}
`;

const mongoLibFile = (): string =>
  `import { MongoClient } from "mongodb";

// External MongoDB (Atlas). Set DATABASE_URL in your .env.
const client = new MongoClient(process.env.DATABASE_URL ?? "");

export async function getDb(name?: string) {
  await client.connect();
  return client.db(name);
}

export { client };
`;

const externalApiLibFile = (baseUrlEnv: string, keyEnv: string): string =>
  `// Generic external-API client. Set ${baseUrlEnv} and ${keyEnv} in your .env.
const BASE_URL = process.env.${baseUrlEnv} ?? "";
const API_KEY = process.env.${keyEnv} ?? "";

export async function callApi(path: string, init?: RequestInit) {
  const res = await fetch(\`\${BASE_URL}\${path}\`, {
    ...init,
    headers: { Authorization: \`Bearer \${API_KEY}\`, ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(\`API request failed: \${res.status}\`);
  return res.json();
}
`;

function packageAdditions(flags: {
  storage: boolean;
  queue: boolean;
  dynamo: boolean;
  ai: boolean;
  email: boolean;
  postgres: boolean;
  stripe: boolean;
  mongodb: boolean;
}): string {
  const deps: Record<string, string> = { sst: 'latest' };
  if (flags.storage) {
    deps['@aws-sdk/client-s3'] = 'latest';
    deps['@aws-sdk/s3-request-presigner'] = 'latest';
  }
  if (flags.queue) deps['@aws-sdk/client-sqs'] = 'latest';
  if (flags.dynamo) {
    deps['@aws-sdk/client-dynamodb'] = 'latest';
    deps['@aws-sdk/lib-dynamodb'] = 'latest';
  }
  if (flags.ai) deps['@anthropic-ai/sdk'] = 'latest';
  if (flags.email) deps['@aws-sdk/client-sesv2'] = 'latest';
  if (flags.postgres) deps['pg'] = 'latest';
  if (flags.stripe) deps['stripe'] = 'latest';
  if (flags.mongodb) deps['mongodb'] = 'latest';
  const json = {
    dependencies: deps,
    scripts: { 'dev:sst': 'sst dev', deploy: 'sst deploy', remove: 'sst remove' },
  };
  return `${JSON.stringify(json, null, 2)}\n`;
}

export function generateRuntimeFiles(bp: Blueprint): GeneratedFile[] {
  const plan = planAws(bp);
  const byId = new Map(bp.resources.map((r) => [r.id, r]));
  const varToKind = new Map<string, string>();
  for (const r of bp.resources) {
    const v = plan.varNameById.get(r.id);
    if (v) varToKind.set(v, r.kind);
  }
  const resourceOf = (id: string): Resource | undefined => byId.get(id);

  const files: GeneratedFile[] = [];
  files.push({ path: 'lib/env.ts', content: envFile(), language: 'ts' });

  const uploadEdge = bp.connections.find((c) => c.intent === 'uploadsTo');
  const uploadBucket = uploadEdge ? resourceOf(uploadEdge.target) : undefined;
  const uploadFromApp = uploadEdge ? resourceOf(uploadEdge.source)?.kind === 'nextjs' : false;

  const publishEdge = bp.connections.find((c) => c.intent === 'publishesTo');
  const publishQueue = publishEdge ? resourceOf(publishEdge.target) : undefined;
  const publishFromApp = publishEdge ? resourceOf(publishEdge.source)?.kind === 'nextjs' : false;

  const dynamoRes = bp.resources.find(
    (r) =>
      r.kind === 'dynamo' &&
      bp.connections.some(
        (c) => c.target === r.id && (c.intent === 'writesTo' || c.intent === 'readsFrom'),
      ),
  );

  if (uploadBucket) {
    files.push({ path: 'lib/storage.ts', content: storageFile(uploadBucket.name), language: 'ts' });
    if (uploadFromApp) {
      files.push({
        path: 'app/actions/create-upload-url.ts',
        content: uploadActionFile(),
        language: 'ts',
      });
    }
  }

  if (publishQueue) {
    files.push({ path: 'lib/queue.ts', content: queueFile(publishQueue.name), language: 'ts' });
    if (publishFromApp) {
      files.push({
        path: 'app/actions/enqueue-job.ts',
        content: enqueueActionFile(),
        language: 'ts',
      });
    }
  }

  if (dynamoRes) {
    files.push({ path: 'lib/dynamo.ts', content: dynamoFile(dynamoRes.name), language: 'ts' });
  }

  const aiEdge = bp.connections.find((c) => c.intent === 'usesAI');
  const aiRes = aiEdge ? resourceOf(aiEdge.target) : undefined;
  if (aiRes) {
    const model =
      typeof aiRes.props.model === 'string' && aiRes.props.model
        ? aiRes.props.model
        : 'claude-opus-4-8';
    files.push({ path: 'lib/ai.ts', content: aiHelperFile(aiRes.name, model), language: 'ts' });
    files.push({ path: 'app/api/chat/route.ts', content: aiChatRouteFile(), language: 'ts' });
  }

  const emailEdge = bp.connections.find((c) => c.intent === 'sendsEmail');
  const emailRes = emailEdge ? resourceOf(emailEdge.target) : undefined;
  if (emailRes) {
    files.push({ path: 'lib/email.ts', content: emailHelperFile(emailRes.name), language: 'ts' });
  }

  const pgEdge = bp.connections.find((c) => c.intent === 'queriesDb');
  const pgRes = pgEdge ? resourceOf(pgEdge.target) : undefined;
  if (pgRes) {
    files.push({ path: 'lib/db.ts', content: postgresHelperFile(pgRes.name), language: 'ts' });
  }

  const stripeRes = bp.resources.find(
    (r) =>
      r.kind === 'stripe' &&
      bp.connections.some((c) => c.intent === 'usesStripe' && c.target === r.id),
  );
  if (stripeRes) {
    files.push({ path: 'lib/stripe.ts', content: stripeLibFile(), language: 'ts' });
    files.push({
      path: 'app/api/webhooks/stripe/route.ts',
      content: stripeWebhookRouteFile(),
      language: 'ts',
    });
  }

  const mongoRes = bp.resources.find(
    (r) =>
      r.kind === 'mongodb' &&
      bp.connections.some((c) => c.intent === 'queriesMongo' && c.target === r.id),
  );
  if (mongoRes) {
    files.push({ path: 'lib/mongo.ts', content: mongoLibFile(), language: 'ts' });
  }

  for (const api of bp.resources.filter(
    (r) =>
      r.kind === 'externalApi' &&
      bp.connections.some((c) => c.intent === 'callsApi' && c.target === r.id),
  )) {
    const baseUrlEnv =
      typeof api.props.baseUrlEnv === 'string' && api.props.baseUrlEnv
        ? api.props.baseUrlEnv
        : 'API_BASE_URL';
    const keyEnv =
      typeof api.props.keyEnv === 'string' && api.props.keyEnv ? api.props.keyEnv : 'API_KEY';
    files.push({
      path: `lib/${kebabCase(api.name)}.ts`,
      content: externalApiLibFile(baseUrlEnv, keyEnv),
      language: 'ts',
    });
  }

  files.push({
    path: 'required-env.json',
    content: `${JSON.stringify(
      {
        required: collectAwsEnv(bp).map((e) => ({
          name: e.name,
          scope: e.scope,
          ...(e.hint ? { hint: e.hint } : {}),
        })),
      },
      null,
      2,
    )}\n`,
    language: 'json',
  });

  const linksDynamo = (linkVars: string[]) => linkVars.some((v) => varToKind.get(v) === 'dynamo');

  for (const sub of plan.subscribers) {
    files.push({
      path: sub.handlerFile,
      content: subscriberHandlerFile(
        sub.worker.name,
        linksDynamo(sub.linkVars) && Boolean(dynamoRes),
      ),
      language: 'ts',
    });
  }
  for (const fn of plan.functions) {
    files.push({
      path: fn.handlerFile,
      content: functionHandlerFile(fn.worker.name),
      language: 'ts',
    });
  }
  for (const cron of plan.crons) {
    if (cron.handlerFile) {
      files.push({
        path: cron.handlerFile,
        content: cronHandlerFile(cron.cron.name),
        language: 'ts',
      });
    }
  }

  files.push({
    path: 'package.additions.json',
    content: packageAdditions({
      storage: Boolean(uploadBucket),
      queue: Boolean(publishQueue),
      dynamo: Boolean(dynamoRes),
      ai: Boolean(aiRes),
      email: Boolean(emailRes),
      postgres: Boolean(pgRes),
      stripe: Boolean(stripeRes),
      mongodb: Boolean(mongoRes),
    }),
    language: 'json',
  });

  // de-duplicate by path (a worker handler could be referenced twice)
  const seen = new Set<string>();
  return files.filter((f) => (seen.has(f.path) ? false : (seen.add(f.path), true)));
}
