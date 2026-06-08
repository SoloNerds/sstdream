import type { Blueprint, Resource } from '@/lib/core/blueprint/types';
import type { GeneratedFile } from '@/lib/core/codegen/types';
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

function packageAdditions(flags: { storage: boolean; queue: boolean; dynamo: boolean }): string {
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
    }),
    language: 'json',
  });

  // de-duplicate by path (a worker handler could be referenced twice)
  const seen = new Set<string>();
  return files.filter((f) => (seen.has(f.path) ? false : (seen.add(f.path), true)));
}
