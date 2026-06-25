import type { Blueprint, Resource } from '@/lib/core/blueprint/types';
import type { GeneratedFile } from '@/lib/core/codegen/types';
import { camelCase, kebabCase, pascalCase } from '@/lib/core/codegen/strings';
import {
  crudDynamoActionFile,
  crudMongoActionFile,
  authGuardFile,
  crudDynamoPageFile,
  crudDynamoFormFile,
  crudMongoPageFile,
  crudMongoFormFile,
} from './crud';
import {
  type SubscriberTable,
  subscriberHandlerFile,
  cronHandlerFile,
  functionHandlerFile,
  apiRouteHandlerFile,
  s3NotifyHandlerFile,
} from './handlers';
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

const busFile = (busName: string): string =>
  `import { Resource } from "sst";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

const client = new EventBridgeClient({});

/** Publish an event to the EventBridge bus. */
export async function publishEvent(
  detailType: string,
  detail: Record<string, unknown>,
  source = "app",
) {
  await client.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: Resource.${busName}.name,
          Source: source,
          DetailType: detailType,
          Detail: JSON.stringify(detail),
        },
      ],
    }),
  );
}
`;

const topicFile = (topicName: string): string =>
  `import { Resource } from "sst";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const client = new SNSClient({});

/** Publish a message to the SNS topic. */
export async function publishMessage(message: Record<string, unknown>) {
  await client.send(
    new PublishCommand({
      TopicArn: Resource.${topicName}.arn,
      Message: JSON.stringify(message),
    }),
  );
}
`;

const dynamoFile = (tableName: string, hashKey: string, rangeKey?: string): string => {
  const keyType = rangeKey
    ? `{ ${hashKey}: string; ${rangeKey}: string }`
    : `{ ${hashKey}: string }`;
  return `import { Resource } from "sst";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TableName = Resource.${tableName}.name;

export async function putItem(item: Record<string, unknown>) {
  await client.send(new PutCommand({ TableName, Item: item }));
}

export async function getItem(key: ${keyType}) {
  const result = await client.send(new GetCommand({ TableName, Key: key }));
  return result.Item;
}
`;
};

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

export const CHAT_MODEL = ${JSON.stringify(model)};
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

// ElastiCache Redis — connection comes from the linked Redis resource. Cluster mode
// is ON by default, so use ioredis's Cluster (not `new Redis`). TLS is mandatory and
// checkServerIdentity is overridden because the cert CN won't match the config endpoint.
const redisHelperFile = (cacheName: string): string =>
  `import { Resource } from "sst";
import { Cluster } from "ioredis";

export const redis = new Cluster(
  [{ host: Resource.${cacheName}.host, port: Resource.${cacheName}.port }],
  {
    redisOptions: {
      tls: { checkServerIdentity: () => undefined },
      username: Resource.${cacheName}.username,
      password: Resource.${cacheName}.password,
    },
  },
);
`;

// IoT Realtime. authorizer (required) validates the connect token + returns topic
// ACLs; the subscriber receives matched messages; the publish helper sends over the
// IoT Data Plane SDK (there is no sst publish helper). Topics are app/stage-prefixed.
const realtimeAuthorizerFile = (): string =>
  `import { Resource } from "sst";
import { realtime } from "sst/aws/realtime";

export const handler = realtime.authorizer(async (token) => {
  const prefix = \`\${Resource.App.name}/\${Resource.App.stage}\`;
  // TODO: validate \`token\` (throw/return empty to deny). Return this client's ACLs.
  return { subscribe: [\`\${prefix}/#\`], publish: [\`\${prefix}/#\`] };
});
`;

const realtimeSubscriberFile = (): string =>
  `/** IoT Realtime subscriber — IoT delivers each matched message here. */
export const handler = async (event: unknown) => {
  console.log("realtime message", event);
};
`;

const realtimePublishFile = (realtimeName: string): string =>
  `import { Resource } from "sst";
import { IoTDataPlaneClient, PublishCommand } from "@aws-sdk/client-iot-data-plane";

const iot = new IoTDataPlaneClient({ endpoint: \`https://\${Resource.${realtimeName}.endpoint}\` });

/** Publish to a Realtime topic. Prefix with \`\${app}/\${stage}/\` to scope it. */
export async function publish(topic: string, payload: unknown) {
  await iot.send(
    new PublishCommand({ topic, payload: Buffer.from(JSON.stringify(payload)) }),
  );
}
`;

// Step Functions: each step is a plain Lambda; the app starts an execution via the
// SFN SDK using the linked Resource.<Name>.arn (the only linked field).
const sfnStepFile = (machineName: string, step: string): string =>
  `/** "${step}" step of the ${machineName} workflow. Receives + returns the state. */
export async function handler(input: Record<string, unknown>) {
  console.log("${step}", input);
  // TODO: your step logic. The return value becomes the next step's input.
  return { ...input, ${camelCase(step)}: true };
}
`;

const startWorkflowAction = (machineName: string): string =>
  `"use server";

import { Resource } from "sst";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";

const sfn = new SFNClient({});

/** Start a ${machineName} execution. Returns the execution ARN. */
export async function start${pascalCase(machineName)}(input: Record<string, unknown>) {
  const res = await sfn.send(
    new StartExecutionCommand({
      stateMachineArn: Resource.${machineName}.arn,
      input: JSON.stringify(input),
    }),
  );
  return { executionArn: res.executionArn };
}
`;

// OpenAuth (sst.aws.Auth) — a complete, verified auth flow. The issuer runs as a
// Hono→Lambda; sst.aws.Auth provisions + injects the DynamoDB storage automatically
// (so `storage` is omitted). Verified import paths: subject from /subject, providers
// from /provider/*, client from /client. (sst.dev/docs/component/aws/auth + openauth)
const openAuthSubjectsFile = (): string =>
  `import { object, string } from "valibot";
import { createSubjects } from "@openauthjs/openauth/subject";

// Shared between the issuer and the verifying client.
export const subjects = createSubjects({
  user: object({ id: string() }),
});
`;

const openAuthIssuerFile = (): string =>
  `import { handle } from "hono/aws-lambda";
import { issuer } from "@openauthjs/openauth";
import { CodeUI } from "@openauthjs/openauth/ui/code";
import { CodeProvider } from "@openauthjs/openauth/provider/code";
import { subjects } from "./subjects";

async function getUser(email: string): Promise<string> {
  // TODO: look up or create the user, return its id.
  console.log("login", email);
  return "user-123";
}

const app = issuer({
  subjects,
  // sst.aws.Auth provisions + injects DynamoDB storage automatically — do not set \`storage\`.
  allow: async () => true,
  providers: {
    code: CodeProvider(
      CodeUI({
        sendCode: async (email, code) => {
          // TODO: email the code (wire an Email kind). Logged for local dev.
          console.log("send code", email, code);
        },
      }),
    ),
  },
  success: async (ctx, value) => {
    if (value.provider === "code") {
      return ctx.subject("user", { id: await getUser(value.claims.email) });
    }
    throw new Error("Invalid provider");
  },
});

export const handler = handle(app);
`;

const openAuthClientFile = (authName: string): string =>
  `import { Resource } from "sst";
import { createClient } from "@openauthjs/openauth/client";
import { cookies as getCookies } from "next/headers";

export const client = createClient({
  clientID: "nextjs",
  issuer: Resource.${authName}.url,
});

export async function setTokens(access: string, refresh: string): Promise<void> {
  const cookies = await getCookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 34560000 };
  cookies.set({ name: "access_token", value: access, ...opts });
  cookies.set({ name: "refresh_token", value: refresh, ...opts });
}
`;

const openAuthActionsFile = (): string =>
  `"use server";

import { redirect } from "next/navigation";
import { headers as getHeaders, cookies as getCookies } from "next/headers";
import { subjects } from "../auth/subjects";
import { client, setTokens } from "./auth";

/** Verify the session; rotates + re-persists tokens when needed. */
export async function auth() {
  const cookies = await getCookies();
  const accessToken = cookies.get("access_token");
  const refreshToken = cookies.get("refresh_token");
  if (!accessToken) return false;
  const verified = await client.verify(subjects, accessToken.value, {
    refresh: refreshToken?.value,
  });
  if (verified.err) return false;
  if (verified.tokens) await setTokens(verified.tokens.access, verified.tokens.refresh);
  return verified.subject;
}

export async function login() {
  const headers = await getHeaders();
  const host = headers.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const { url } = await client.authorize(\`\${protocol}://\${host}/api/auth/callback\`, "code");
  redirect(url);
}

export async function logout() {
  const cookies = await getCookies();
  cookies.delete("access_token");
  cookies.delete("refresh_token");
  redirect("/");
}
`;

const openAuthCallbackFile = (): string =>
  `import { type NextRequest, NextResponse } from "next/server";
import { client, setTokens } from "../../../auth";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const exchanged = await client.exchange(code ?? "", \`\${url.origin}/api/auth/callback\`);
  if (exchanged.err) return NextResponse.json(exchanged.err, { status: 400 });
  await setTokens(exchanged.tokens.access, exchanged.tokens.refresh);
  return NextResponse.redirect(url.origin);
}
`;

// AppSync (GraphQL). A starter schema + a direct-Lambda resolver (AppSync passes the
// field args on event.arguments and the field name on event.info.fieldName) + a typed
// gql() fetch helper for the app. (verified: sst.dev/docs/component/aws/app-sync)
const appsyncSchemaFile = (): string =>
  `type User {
  id: ID!
  name: String!
  email: String!
}

type Query {
  user(id: ID!): User
}

type Mutation {
  createUser(name: String!, email: String!): User!
}

schema {
  query: Query
  mutation: Mutation
}
`;

const appsyncResolverFile = (apiName: string): string =>
  `// Direct-Lambda resolver for the "${apiName}" GraphQL API.
interface AppSyncEvent<TArgs> {
  arguments: TArgs;
  info: { fieldName: string; parentTypeName: string };
}

export async function handler(
  event: AppSyncEvent<{ id?: string; name?: string; email?: string }>,
): Promise<{ id: string; name: string; email: string }> {
  const { id, name, email } = event.arguments;
  if (event.info.fieldName === "createUser") {
    return { id: crypto.randomUUID(), name: name ?? "", email: email ?? "" };
  }
  // TODO: read from your data source (link a Dynamo table via the resolvesFrom edge).
  return { id: id ?? "", name: "Ada", email: "ada@example.com" };
}
`;

const appsyncGqlFile = (apiName: string): string =>
  `import { Resource } from "sst";

/** Typed GraphQL request against the AppSync endpoint. */
export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(Resource.${apiName}.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const { data } = (await res.json()) as { data: T };
  return data;
}
`;

// ECS Fargate container starter. node:22-slim, installs deps (sst for Resource
// access), runs the server. SST builds this Dockerfile from services/<name>/.
const serviceDockerfile = (port: number): string =>
  `FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE ${port}
CMD ["node", "server.mjs"]
`;

// A minimal HTTP server so the container is runnable out of the box. Linked
// resources (DB, cache, bucket, queue…) resolve at runtime via Resource from "sst".
const serviceServer = (name: string, port: number): string =>
  `import { createServer } from "node:http";
// import { Resource } from "sst"; // linked resources resolve here, e.g. Resource.<Name>.host

const port = Number(process.env.PORT) || ${port};

createServer((req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ service: ${JSON.stringify(name)}, ok: true }));
}).listen(port, () => console.log(\`${name} listening on :\${port}\`));
`;

const serviceContainerPackageJson = (slug: string): string =>
  `${JSON.stringify(
    {
      name: slug,
      private: true,
      type: 'module',
      scripts: { dev: 'node server.mjs', start: 'node server.mjs' },
      dependencies: { sst: '^4.15.0' },
    },
    null,
    2,
  )}\n`;

// Fargate Task container: a one-off batch job that runs to completion and exits.
const taskDockerfile = (): string =>
  `FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
CMD ["node", "task.mjs"]
`;

const taskRunner = (name: string): string =>
  `// import { Resource } from "sst"; // linked resources resolve here, e.g. Resource.<Name>.name

async function main() {
  console.log(${JSON.stringify(`Running task: ${name}`)});
  // TODO: your batch work here. The task exits when this returns.
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
`;

const taskContainerPackageJson = (slug: string): string =>
  `${JSON.stringify(
    {
      name: slug,
      private: true,
      type: 'module',
      scripts: { task: 'node task.mjs' },
      dependencies: { sst: '^4.15.0' },
    },
    null,
    2,
  )}\n`;

// Server action that kicks off a one-off Fargate task. Verified SDK shape:
// task.run(Resource.<Name>) → { tasks: [{ taskArn }] } (sst/aws/task).
const runTaskAction = (taskName: string): string =>
  `"use server";

import { Resource } from "sst";
import { task } from "sst/aws/task";

/** Start the "${taskName}" Fargate task. Returns the task ARN (poll with task.describe). */
export async function run${pascalCase(taskName)}() {
  const ret = await task.run(Resource.${taskName});
  return { taskArn: ret.tasks[0].taskArn };
}
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

// Auth helpers. Clerk (drop-in, env-driven) — middleware + ClerkProvider note.
// Verified: @clerk/nextjs, clerkMiddleware from @clerk/nextjs/server.
const clerkMiddlewareFile = (): string =>
  `import { clerkMiddleware } from "@clerk/nextjs/server";

// Clerk auth middleware. Also wrap app/layout.tsx with <ClerkProvider> from "@clerk/nextjs".
export default clerkMiddleware();

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)", "/(api|trpc)(.*)"],
};
`;

// Cognito (AWS-native) — pool id via Resource; client id/region injected as env.
const cognitoAuthLibFile = (poolName: string): string =>
  `import { Resource } from "sst";

// Browser auth config. NEXT_PUBLIC_COGNITO_CLIENT_ID and NEXT_PUBLIC_AWS_REGION are
// injected by SST from the user-pool outputs (see sst.config.ts).
export const cognito = {
  userPoolId: Resource.${poolName}.id,
  clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
  region: process.env.NEXT_PUBLIC_AWS_REGION,
};
`;

function packageAdditions(flags: {
  storage: boolean;
  queue: boolean;
  dynamo: boolean;
  ai: boolean;
  email: boolean;
  postgres: boolean;
  redis: boolean;
  realtime: boolean;
  stepFunctions: boolean;
  stripe: boolean;
  mongodb: boolean;
  clerk: boolean;
  openauth: boolean;
  bus: boolean;
  topic: boolean;
}): string {
  // Verified major ranges (npm registry, 2026-06-10) — 'latest' undermined the
  // verified-at-version pitch and made exports time bombs.
  const deps: Record<string, string> = { sst: '^4.15.0' };
  if (flags.storage) {
    deps['@aws-sdk/client-s3'] = '^3.0.0';
    deps['@aws-sdk/s3-request-presigner'] = '^3.0.0';
  }
  if (flags.queue) deps['@aws-sdk/client-sqs'] = '^3.0.0';
  if (flags.dynamo) {
    deps['@aws-sdk/client-dynamodb'] = '^3.0.0';
    deps['@aws-sdk/lib-dynamodb'] = '^3.0.0';
  }
  if (flags.ai) deps['@anthropic-ai/sdk'] = '^0.104.0';
  if (flags.email) deps['@aws-sdk/client-sesv2'] = '^3.0.0';
  if (flags.postgres) deps['pg'] = '^8.0.0';
  if (flags.redis) deps['ioredis'] = '^5.0.0';
  if (flags.realtime) deps['@aws-sdk/client-iot-data-plane'] = '^3.0.0';
  if (flags.stepFunctions) deps['@aws-sdk/client-sfn'] = '^3.0.0';
  if (flags.stripe) deps['stripe'] = '^22.0.0';
  if (flags.mongodb) deps['mongodb'] = '^7.0.0';
  if (flags.clerk) deps['@clerk/nextjs'] = '^7.0.0';
  if (flags.openauth) {
    deps['@openauthjs/openauth'] = '^0.4.0';
    deps['valibot'] = '^1.0.0';
    deps['hono'] = '^4.0.0';
  }
  if (flags.bus) deps['@aws-sdk/client-eventbridge'] = '^3.0.0';
  if (flags.topic) deps['@aws-sdk/client-sns'] = '^3.0.0';
  const devDeps: Record<string, string> = {};
  // pg ships no types — without @types/pg the exported project fails `next build` (TS7016).
  if (flags.postgres) devDeps['@types/pg'] = '^8.0.0';
  const json = {
    dependencies: deps,
    ...(Object.keys(devDeps).length ? { devDependencies: devDeps } : {}),
    scripts: { 'dev:sst': 'sst dev', deploy: 'sst deploy', remove: 'sst remove' },
  };
  return `${JSON.stringify(json, null, 2)}\n`;
}

export function generateRuntimeFiles(bp: Blueprint): GeneratedFile[] {
  const plan = planAws(bp);
  const byId = new Map(bp.resources.map((r) => [r.id, r]));
  const resourceOf = (id: string): Resource | undefined => byId.get(id);

  const files: GeneratedFile[] = [];
  files.push({ path: 'lib/env.ts', content: envFile(), language: 'ts' });

  const uploadEdge = bp.connections.find((c) => c.intent === 'uploadsTo');
  const uploadBucket = uploadEdge ? resourceOf(uploadEdge.target) : undefined;
  const uploadFromApp = uploadEdge ? resourceOf(uploadEdge.source)?.kind === 'nextjs' : false;

  // publishesTo can target a queue, bus, or topic — resolve each separately.
  const pubEdges = bp.connections.filter((c) => c.intent === 'publishesTo');
  const queueEdge = pubEdges.find((c) => resourceOf(c.target)?.kind === 'queue');
  const publishQueue = queueEdge ? resourceOf(queueEdge.target) : undefined;
  const publishFromApp = queueEdge ? resourceOf(queueEdge.source)?.kind === 'nextjs' : false;
  const busEdge = pubEdges.find((c) => resourceOf(c.target)?.kind === 'bus');
  const publishBus = busEdge ? resourceOf(busEdge.target) : undefined;
  const topicEdge = pubEdges.find((c) => resourceOf(c.target)?.kind === 'snstopic');
  const publishTopic = topicEdge ? resourceOf(topicEdge.target) : undefined;

  const dynamoRes = bp.resources.find(
    (r) =>
      r.kind === 'dynamo' &&
      bp.connections.some(
        (c) => c.target === r.id && (c.intent === 'writesTo' || c.intent === 'readsFrom'),
      ),
  );

  // unset → default "sk"; explicitly cleared ("") → no sort key (mirrors renderDynamo).
  const tableKeys = (t: Resource): { hashKey: string; rangeKey?: string } => ({
    hashKey: typeof t.props.hashKey === 'string' && t.props.hashKey ? t.props.hashKey : 'pk',
    rangeKey:
      t.props.rangeKey === undefined
        ? 'sk'
        : typeof t.props.rangeKey === 'string' && t.props.rangeKey
          ? t.props.rangeKey
          : undefined,
  });

  // The dynamo table a worker WRITES — only writesTo qualifies for the example
  // putItem (a readsFrom-only link must not generate writes into a read-only
  // table), and NOT the first table in the design: multi-table designs must
  // not cross-wire a subscriber's example item.
  const workerWriteTableOf = (w: Resource): Resource | undefined => {
    const edge = bp.connections.find(
      (c) =>
        c.source === w.id && c.intent === 'writesTo' && resourceOf(c.target)?.kind === 'dynamo',
    );
    return edge ? resourceOf(edge.target) : undefined;
  };

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

  if (publishBus) {
    files.push({ path: 'lib/bus.ts', content: busFile(publishBus.name), language: 'ts' });
  }
  if (publishTopic) {
    files.push({ path: 'lib/topic.ts', content: topicFile(publishTopic.name), language: 'ts' });
  }

  if (dynamoRes) {
    const k = tableKeys(dynamoRes);
    files.push({
      path: 'lib/dynamo.ts',
      content: dynamoFile(dynamoRes.name, k.hashKey, k.rangeKey),
      language: 'ts',
    });
  }

  const aiEdges = bp.connections.filter((c) => c.intent === 'usesAI');
  const aiRes = aiEdges.length ? resourceOf(aiEdges[0].target) : undefined;
  // Workers link the key + helper; the chat route only makes sense in an app.
  const aiFromApp = aiEdges.some((c) => resourceOf(c.source)?.kind === 'nextjs');
  if (aiRes) {
    const model =
      typeof aiRes.props.model === 'string' && aiRes.props.model
        ? aiRes.props.model
        : 'claude-opus-4-8';
    files.push({ path: 'lib/ai.ts', content: aiHelperFile(aiRes.name, model), language: 'ts' });
    if (aiFromApp) {
      files.push({ path: 'app/api/chat/route.ts', content: aiChatRouteFile(), language: 'ts' });
    }
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

  const redisEdge = bp.connections.find((c) => c.intent === 'usesCache');
  const redisRes = redisEdge ? resourceOf(redisEdge.target) : undefined;
  if (redisRes) {
    files.push({ path: 'lib/redis.ts', content: redisHelperFile(redisRes.name), language: 'ts' });
  }

  // Step Functions: emit the Validate/Process step Lambdas for each state machine,
  // and a start action for every app/worker that wires `startsWorkflow`.
  for (const sm of bp.resources.filter((r) => r.kind === 'stepFunctions')) {
    const slug = kebabCase(sm.name);
    files.push(
      {
        path: `src/${slug}-validate.ts`,
        content: sfnStepFile(sm.name, 'Validate'),
        language: 'ts',
      },
      { path: `src/${slug}-process.ts`, content: sfnStepFile(sm.name, 'Process'), language: 'ts' },
    );
  }
  for (const conn of bp.connections.filter((c) => c.intent === 'startsWorkflow')) {
    const sm = resourceOf(conn.target);
    if (sm) {
      files.push({
        path: `app/actions/start-${kebabCase(sm.name)}.ts`,
        content: startWorkflowAction(sm.name),
        language: 'ts',
      });
    }
  }

  // IoT Realtime: the authorizer + a starter subscriber whenever a Realtime node
  // exists; the publish helper only when something is wired to publish to it.
  const realtimeRes = bp.resources.find((r) => r.kind === 'realtime');
  if (realtimeRes) {
    files.push(
      { path: 'src/realtime-authorizer.ts', content: realtimeAuthorizerFile(), language: 'ts' },
      { path: 'src/realtime-subscriber.ts', content: realtimeSubscriberFile(), language: 'ts' },
    );
    const usesRealtime = bp.connections.some(
      (c) => c.intent === 'usesRealtime' && c.target === realtimeRes.id,
    );
    if (usesRealtime) {
      files.push({
        path: 'lib/realtime.ts',
        content: realtimePublishFile(realtimeRes.name),
        language: 'ts',
      });
    }
  }

  // OpenAuth: the full issuer + client + callback flow, when an app authenticates with it.
  const openAuthEdge = bp.connections.find((c) => c.intent === 'usesOpenAuth');
  const openAuthRes = openAuthEdge ? resourceOf(openAuthEdge.target) : undefined;
  if (openAuthRes) {
    files.push(
      { path: 'auth/subjects.ts', content: openAuthSubjectsFile(), language: 'ts' },
      { path: 'auth/index.ts', content: openAuthIssuerFile(), language: 'ts' },
      { path: 'app/auth.ts', content: openAuthClientFile(openAuthRes.name), language: 'ts' },
      { path: 'app/auth-actions.ts', content: openAuthActionsFile(), language: 'ts' },
      { path: 'app/api/auth/callback/route.ts', content: openAuthCallbackFile(), language: 'ts' },
    );
  }

  // AppSync: a schema + a resolver Lambda per GraphQL API; a gql() helper when the
  // app consumes one.
  const appsyncResources = bp.resources.filter((r) => r.kind === 'appsync');
  if (appsyncResources.length) {
    files.push({ path: 'schema.graphql', content: appsyncSchemaFile(), language: 'text' });
    for (const api of appsyncResources) {
      files.push({
        path: `src/${kebabCase(api.name)}-resolver.ts`,
        content: appsyncResolverFile(api.name),
        language: 'ts',
      });
    }
    const gqlEdge = bp.connections.find((c) => c.intent === 'consumesGraphQL');
    const gqlApi = gqlEdge ? resourceOf(gqlEdge.target) : undefined;
    if (gqlApi) {
      files.push({ path: 'lib/graphql.ts', content: appsyncGqlFile(gqlApi.name), language: 'ts' });
    }
  }

  // ECS Fargate services: each gets its own container folder (Dockerfile + a tiny
  // starter HTTP server that reads its linked resources via the SST `Resource` SDK).
  for (const svc of bp.resources.filter((r) => r.kind === 'service')) {
    const slug = kebabCase(svc.name);
    const port = typeof svc.props.port === 'number' ? svc.props.port : 3000;
    files.push(
      { path: `services/${slug}/Dockerfile`, content: serviceDockerfile(port), language: 'text' },
      {
        path: `services/${slug}/server.mjs`,
        content: serviceServer(svc.name, port),
        language: 'text',
      },
      {
        path: `services/${slug}/package.json`,
        content: serviceContainerPackageJson(slug),
        language: 'json',
      },
    );
  }

  // Fargate Tasks: each gets a tasks/<name>/ batch container (runs and exits), and
  // every app that wires `runsTask` gets a server action calling task.run().
  for (const tk of bp.resources.filter((r) => r.kind === 'task')) {
    const slug = kebabCase(tk.name);
    files.push(
      { path: `tasks/${slug}/Dockerfile`, content: taskDockerfile(), language: 'text' },
      { path: `tasks/${slug}/task.mjs`, content: taskRunner(tk.name), language: 'text' },
      {
        path: `tasks/${slug}/package.json`,
        content: taskContainerPackageJson(slug),
        language: 'json',
      },
    );
  }
  for (const conn of bp.connections.filter((c) => c.intent === 'runsTask')) {
    const tk = resourceOf(conn.target);
    if (tk) {
      const slug = kebabCase(tk.name);
      files.push({
        path: `app/actions/run-${slug}.ts`,
        content: runTaskAction(tk.name),
        language: 'ts',
      });
    }
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

  const clerkRes = bp.resources.find(
    (r) =>
      r.kind === 'clerk' &&
      bp.connections.some((c) => c.intent === 'usesAuth' && c.target === r.id),
  );
  if (clerkRes) {
    files.push({ path: 'middleware.ts', content: clerkMiddlewareFile(), language: 'ts' });
  }

  const cognitoRes = bp.resources.find(
    (r) =>
      r.kind === 'cognito' &&
      bp.connections.some((c) => c.intent === 'usesCognito' && c.target === r.id),
  );
  if (cognitoRes) {
    files.push({
      path: 'lib/auth.ts',
      content: cognitoAuthLibFile(cognitoRes.name),
      language: 'ts',
    });
  }

  // CRUD server actions: full CRUD for every Dynamo table a Next.js app connects to.
  const appIds = new Set(bp.resources.filter((r) => r.kind === 'nextjs').map((r) => r.id));
  const crudDynamos = bp.resources.filter(
    (r) =>
      r.kind === 'dynamo' &&
      bp.connections.some(
        (c) =>
          appIds.has(c.source) &&
          c.target === r.id &&
          (c.intent === 'writesTo' || c.intent === 'readsFrom'),
      ),
  );
  for (const t of crudDynamos) {
    const hashKey = typeof t.props.hashKey === 'string' && t.props.hashKey ? t.props.hashKey : 'pk';
    const rangeKey =
      t.props.rangeKey === undefined
        ? 'sk'
        : typeof t.props.rangeKey === 'string' && t.props.rangeKey
          ? t.props.rangeKey
          : undefined;
    const slug = kebabCase(t.name);
    files.push({
      path: `app/actions/${slug}.ts`,
      content: crudDynamoActionFile(t.name, hashKey, rangeKey),
      language: 'ts',
    });
    files.push({
      path: `app/${slug}/page.tsx`,
      content: crudDynamoPageFile(t.name),
      language: 'tsx',
    });
    files.push({
      path: `app/${slug}/create-form.tsx`,
      content: crudDynamoFormFile(t.name, hashKey, rangeKey),
      language: 'tsx',
    });
  }

  // Mongo example CRUD actions + page when the app queries Mongo.
  if (mongoRes && bp.connections.some((c) => appIds.has(c.source) && c.intent === 'queriesMongo')) {
    files.push({ path: 'app/actions/items.ts', content: crudMongoActionFile(), language: 'ts' });
    files.push({ path: 'app/items/page.tsx', content: crudMongoPageFile(), language: 'tsx' });
    files.push({
      path: 'app/items/create-form.tsx',
      content: crudMongoFormFile(),
      language: 'tsx',
    });
  }

  // Clerk auth guard helper.
  if (clerkRes) {
    files.push({ path: 'lib/auth-guard.ts', content: authGuardFile(), language: 'ts' });
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

  // Each subscriber writes to ITS linked table; tables other than the primary
  // (lib/dynamo.ts) get their own key-typed helper file. Distinct tables can
  // share a kebab slug ("AuditLog"/"AuditLOG") — disambiguate deterministically.
  const helperSlugById = new Map<string, string>();
  const usedHelperSlugs = new Set<string>();
  const helperSlugFor = (table: Resource): string => {
    const existing = helperSlugById.get(table.id);
    if (existing) return existing;
    let slug = kebabCase(table.name);
    if (usedHelperSlugs.has(slug)) {
      let i = 2;
      while (usedHelperSlugs.has(`${slug}-${i}`)) i += 1;
      slug = `${slug}-${i}`;
    }
    usedHelperSlugs.add(slug);
    helperSlugById.set(table.id, slug);
    return slug;
  };
  const emittedHelperFor = new Set<string>();
  for (const sub of plan.subscribers) {
    const table = workerWriteTableOf(sub.worker);
    let subTable: SubscriberTable | undefined;
    if (table) {
      const k = tableKeys(table);
      if (dynamoRes && table.id === dynamoRes.id) {
        subTable = { importPath: '../../lib/dynamo', ...k };
      } else {
        const slug = helperSlugFor(table);
        if (!emittedHelperFor.has(table.id)) {
          emittedHelperFor.add(table.id);
          files.push({
            path: `lib/dynamo-${slug}.ts`,
            content: dynamoFile(table.name, k.hashKey, k.rangeKey),
            language: 'ts',
          });
        }
        subTable = { importPath: `../../lib/dynamo-${slug}`, ...k };
      }
    }
    files.push({
      path: sub.handlerFile,
      content: subscriberHandlerFile(sub.worker.name, sub.targetKind, subTable),
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
  for (const route of plan.routes) {
    files.push({
      path: route.handlerFile,
      content: apiRouteHandlerFile(route.route),
      language: 'ts',
    });
  }
  for (const bn of plan.bucketNotifies) {
    for (const n of bn.notifiers) {
      files.push({ path: n.handlerFile, content: s3NotifyHandlerFile(n.name), language: 'ts' });
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
      redis: Boolean(redisRes),
      realtime: bp.connections.some((c) => c.intent === 'usesRealtime'),
      stepFunctions: bp.connections.some((c) => c.intent === 'startsWorkflow'),
      stripe: Boolean(stripeRes),
      mongodb: Boolean(mongoRes),
      clerk: Boolean(clerkRes),
      openauth: Boolean(openAuthRes),
      bus: Boolean(publishBus),
      topic: Boolean(publishTopic),
    }),
    language: 'json',
  });

  // de-duplicate by path (a worker handler could be referenced twice)
  const seen = new Set<string>();
  return files.filter((f) => (seen.has(f.path) ? false : (seen.add(f.path), true)));
}
