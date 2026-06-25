// Lambda handler generators (queue/bus/topic + Dynamo-stream subscribers, cron,
// HTTP routes, S3 notifications) — extracted from runtime.ts. Pure string builders.

/** The table a subscriber writes its example item to (keys + helper import path). */
export interface SubscriberTable {
  importPath: string; // e.g. "../../lib/dynamo"
  hashKey: string;
  rangeKey?: string;
}

// Per-source event shapes (verified, docs/sst-v4-target.md §5): SQS delivers
// Records[].body; SNS delivers Records[].Sns.Message; EventBridge delivers ONE
// event object with the payload under `detail` — no Records array.
export const subscriberHandlerFile = (
  name: string,
  targetKind: 'queue' | 'bus' | 'snstopic' | 'dynamo',
  table?: SubscriberTable,
): string => {
  const importLine = table ? `import { putItem } from "${table.importPath}";\n\n` : '';
  const writeBlock = (indent: string) =>
    table
      ? `
${indent}// TODO: replace with your processing logic
${indent}await putItem({
${indent}  ${table.hashKey}: \`job#\${message.id ?? "unknown"}\`,${
          table.rangeKey ? `\n${indent}  ${table.rangeKey}: new Date().toISOString(),` : ''
        }
${indent}  ...message,
${indent}});`
      : `
${indent}// TODO: replace with your processing logic`;

  if (targetKind === 'bus') {
    return `${importLine}/** EventBridge subscriber for the "${name}" worker. */
export async function handler(event: {
  source?: string;
  "detail-type"?: string;
  detail?: Record<string, unknown>;
}) {
  const message = event.detail ?? {};
  console.log("Processing event", event["detail-type"], message);
${writeBlock('  ')}
}
`;
  }
  if (targetKind === 'snstopic') {
    return `${importLine}/** SNS subscriber for the "${name}" worker. */
export async function handler(event: { Records: { Sns: { Message: string } }[] }) {
  for (const record of event.Records) {
    const message = JSON.parse(record.Sns.Message) as Record<string, unknown>;
    console.log("Processing message", message);
${writeBlock('    ')}
  }
}
`;
  }
  if (targetKind === 'dynamo') {
    return `${importLine}/** DynamoDB stream subscriber for the "${name}" worker. */
export async function handler(event: {
  Records: {
    eventName: string;
    dynamodb: { NewImage?: Record<string, unknown>; OldImage?: Record<string, unknown> };
  }[];
}) {
  for (const record of event.Records) {
    const message = (record.dynamodb.NewImage ?? {}) as Record<string, unknown>;
    console.log("Processing", record.eventName, message);
${writeBlock('    ')}
  }
}
`;
  }
  return `${importLine}/** SQS subscriber for the "${name}" worker. */
export async function handler(event: { Records: { body: string }[] }) {
  for (const record of event.Records) {
    const message = JSON.parse(record.body) as Record<string, unknown>;
    console.log("Processing message", message);
${writeBlock('    ')}
  }
}
`;
};

export const cronHandlerFile = (name: string): string =>
  `/** Scheduled handler for the "${name}" cron. */
export async function handler() {
  console.log("Running scheduled job: ${name}");
  // TODO: your scheduled logic here
}
`;

export const functionHandlerFile = (name: string): string =>
  `/** Handler for the "${name}" function. */
export async function handler(event: unknown) {
  console.log("Invoked", event);
  // TODO: your logic here
}
`;

// HTTP API route handler (API Gateway v2 / Lambda proxy). The route is free
// text: JSON.stringify it in code position and keep `*\/` out of the comment.
export const apiRouteHandlerFile = (route: string): string => {
  const quoted = JSON.stringify(route);
  const comment = route.split('*/').join('* /');
  return `/** Route handler for ${comment}. */
export async function handler(event: {
  requestContext: { http: { method: string; path: string } };
  body?: string;
}) {
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ok: true, route: ${quoted} }),
  };
}
`;
};

// S3 event handler (bucket.notify → Lambda on object events).
export const s3NotifyHandlerFile = (name: string): string =>
  `/** S3 event handler for "${name}". Runs on object events (e.g. uploads). */
export async function handler(event: {
  Records: { s3: { bucket: { name: string }; object: { key: string } } }[];
}) {
  for (const record of event.Records) {
    const key = record.s3.object.key;
    console.log("S3 event for object:", key);
    // TODO: process the object (read it, resize, index it, …)
  }
}
`;
