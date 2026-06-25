import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { buildExport } from '@/lib/core/export/manifest';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { TEMPLATES } from '@/lib/templates/registry';
import type { Blueprint } from '@/lib/core/blueprint/types';
import type { GeneratedFile } from '@/lib/core/codegen/types';

// Typecheck-the-export (#): the "compile-the-export" meta-test only PARSES (syntax).
// This goes further — it runs the TypeScript type-checker over every generated .ts/.tsx
// of every template, with the project's OWN files resolving for real (relative + @/),
// and a permissive ambient stub for third-party packages we can't install here.
//
// What this proves: the generated project's own code is internally consistent — no
// undefined variables (a kebab/var collision that drops a const would surface here),
// no broken local imports, no type errors in our generated logic. API-shape correctness
// against the real SDKs stays covered by the snapshot tests + the verified target docs.

const NOW = '2026-06-08T00:00:00.000Z';
const ROOT = '/proj/';
const AMBIENT_PATH = `${ROOT}__ambient__.d.ts`;

// `any` lives only inside this string (never in linted source). Bare imports become
// loose `any`; SST config globals + a permissive JSX namespace keep infra/TSX honest.
const AMBIENT = `
declare const $config: any;
declare const sst: any;
declare const $app: any;
declare const $util: any;
declare const $dev: any;
declare const $resolve: any;
declare const $interpolate: any;
declare const $output: any;
declare const process: any;
declare const Buffer: any;
declare const require: any;
declare namespace JSX {
  type Element = any;
  interface ElementClass { render: any }
  interface IntrinsicElements { [name: string]: any }
}
declare namespace React {
  type FormEvent<T = any> = any;
  type ChangeEvent<T = any> = any;
  type ReactNode = any;
}

// Third-party packages the generated project installs but we can't here.
// Named exports must be declared explicitly (a wildcard can't supply names),
// so this list mirrors exactly what the generators import — a new import that
// isn't covered fails loudly with "has no exported member", which is the cue
// to add it. Local (relative + @/) imports still resolve to the real files.
declare module "sst" { export const Resource: any; }
declare module "sst/aws/task" { export const task: any; }
declare module "sst/aws/realtime" { export const realtime: any; }
declare module "@aws-sdk/client-iot-data-plane" { export const IoTDataPlaneClient: any; export const PublishCommand: any; }
declare module "react" { export type ReactNode = any; export const useState: any; }
declare module "next" { export type NextConfig = any; }
declare module "next/navigation" { export const useRouter: any; }
declare module "@anthropic-ai/sdk" { const Anthropic: any; export default Anthropic; }
declare module "pg" { export const Pool: any; }
declare module "ioredis" { export const Cluster: any; }
declare module "mongodb" { export const MongoClient: any; export const ObjectId: any; }
declare module "@clerk/nextjs" { export const ClerkProvider: any; }
declare module "@clerk/nextjs/server" { export const auth: any; export const clerkMiddleware: any; }
declare module "@vercel/blob" { export const put: any; }
declare module "@neondatabase/serverless" { export const neon: any; }
declare module "@upstash/redis" { export const Redis: any; }
declare module "@vercel/queue" { export const send: any; export const handleCallback: any; }
declare module "@vercel/edge-config" { export function get<T = unknown>(key: string): Promise<T | undefined>; export function getAll(): Promise<Record<string, unknown>>; }
declare module "@vercel/analytics/next" { export const Analytics: any; }
declare module "@vercel/speed-insights/next" { export const SpeedInsights: any; }
declare module "ai" { export const streamText: any; export const convertToModelMessages: any; export type UIMessage = any; export class DefaultChatTransport { constructor(opts: any); } }
declare module "@ai-sdk/react" { export const useChat: any; }
declare module "next/og" { export class ImageResponse { constructor(element: any, options?: any); } }
declare module "workflow" { export const sleep: any; export const defineHook: any; }
declare module "workflow/api" { export const start: any; export const getRun: any; }
declare module "workflow/next" { export const withWorkflow: any; }
declare module "flags/next" { export function flag<T = unknown>(opts: any): () => Promise<T>; export const createFlagsDiscoveryEndpoint: any; export const getProviderData: any; }
declare module "@flags-sdk/edge-config" { export const edgeConfigAdapter: any; }
declare module "@vercel/firewall" { export const checkRateLimit: any; }
declare module "@vercel/functions" { export const geolocation: any; export const ipAddress: any; export const waitUntil: any; }
declare module "@vercel/sandbox" { export const Sandbox: any; }
declare module "botid/client/core" { export const initBotId: any; }
declare module "botid/server" { export const checkBotId: any; }
declare module "botid/next/config" { export const withBotId: any; }
declare module "next/server" { export function after(fn: any): void; export const NextResponse: any; export type NextResponse = any; export type NextRequest = any; }
declare module "resend" { export const Resend: any; }
declare module "stripe" { const Stripe: any; export default Stripe; }
declare module "node:crypto" { const crypto: any; export default crypto; }
declare module "@aws-sdk/client-dynamodb" { export const DynamoDBClient: any; }
declare module "@aws-sdk/lib-dynamodb" { export const DynamoDBDocumentClient: any; export const PutCommand: any; export const GetCommand: any; export const QueryCommand: any; export const ScanCommand: any; export const DeleteCommand: any; export const UpdateCommand: any; }
declare module "@aws-sdk/client-eventbridge" { export const EventBridgeClient: any; export const PutEventsCommand: any; }
declare module "@aws-sdk/s3-request-presigner" { export const getSignedUrl: any; }
declare module "@aws-sdk/client-s3" { export const S3Client: any; export const PutObjectCommand: any; export const GetObjectCommand: any; }
declare module "@aws-sdk/client-sesv2" { export const SESv2Client: any; export const SendEmailCommand: any; }
declare module "@aws-sdk/client-sns" { export const SNSClient: any; export const PublishCommand: any; }
declare module "@aws-sdk/client-sqs" { export const SQSClient: any; export const SendMessageCommand: any; }

// Fallback for any other bare specifier (default import only).
declare module "*" { const _w: any; export default _w; }
`;

function typecheckProject(files: GeneratedFile[]): string[] {
  const sources = new Map<string, string>();
  sources.set(AMBIENT_PATH, AMBIENT);
  // sst.config.ts opens with a triple-slash reference to this file, which `sst
  // install` generates. Seed an empty stub so the reference resolves (the SST
  // globals it would declare are in AMBIENT).
  sources.set(`${ROOT}.sst/platform/config.d.ts`, '');
  for (const f of files) {
    if (/\.(ts|tsx)$/.test(f.path)) sources.set(`${ROOT}${f.path}`, f.content);
  }

  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    jsx: ts.JsxEmit.Preserve,
    strict: true,
    noImplicitAny: false,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    resolveJsonModule: true,
    baseUrl: ROOT,
    paths: { '@/*': ['*'] },
    types: [],
  };

  const readFile = (fileName: string): string | undefined => {
    if (sources.has(fileName)) return sources.get(fileName);
    if (fileName.endsWith('.d.ts')) return ts.sys.readFile(fileName);
    return undefined;
  };
  const fileExists = (fileName: string): boolean =>
    sources.has(fileName) || (fileName.endsWith('.d.ts') && ts.sys.fileExists(fileName));

  const host: ts.CompilerHost = {
    getSourceFile: (fileName, languageVersion) => {
      const text = readFile(fileName);
      if (text === undefined) return undefined;
      const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
      return ts.createSourceFile(fileName, text, languageVersion, true, kind);
    },
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    writeFile: () => undefined,
    getCurrentDirectory: () => ROOT,
    getCanonicalFileName: (f) => f,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists,
    readFile,
    directoryExists: () => true,
    getDirectories: () => [],
  };

  const program = ts.createProgram([...sources.keys()], options, host);
  return ts
    .getPreEmitDiagnostics(program)
    .filter((d) => {
      // Only diagnostics from our generated files (lib/.d.ts files live outside ROOT).
      const fn = d.file?.fileName ?? '';
      return fn.startsWith(ROOT) && fn !== AMBIENT_PATH;
    })
    .map((d) => {
      const at = d.file
        ? `${d.file.fileName.slice(ROOT.length)}:${
            d.file.getLineAndCharacterOfPosition(d.start ?? 0).line + 1
          }`
        : '';
      return `${at} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`;
    });
}

describe('the typecheck harness itself detects a TYPE error (not just syntax)', () => {
  it('catches a string-to-number assignment and an undefined variable', () => {
    expect(
      typecheckProject([{ path: 'bad.ts', content: 'const n: number = "x";\n', language: 'ts' }]),
    ).not.toEqual([]);
    expect(
      typecheckProject([
        { path: 'bad2.ts', content: 'export const y = doesNotExist + 1;\n', language: 'ts' },
      ]),
    ).not.toEqual([]);
    // a clean file produces no diagnostics
    expect(
      typecheckProject([
        { path: 'ok.ts', content: 'export const x: number = 1;\n', language: 'ts' },
      ]),
    ).toEqual([]);
  });

  it('catches a broken LOCAL import (the kebab-collision failure mode)', () => {
    // page imports from a sibling that does not exist in the project
    expect(
      typecheckProject([
        {
          path: 'app/page.tsx',
          content:
            'import { list } from "./actions/missing";\nexport default function P() { return list; }\n',
          language: 'tsx',
        },
      ]),
    ).not.toEqual([]);
  });
});

describe('every template TYPE-CHECKS as a project', () => {
  for (const t of TEMPLATES) {
    it(`${t.id} (${t.target})`, () => {
      const bp: Blueprint = draftBlueprint(t.snapshot, t.target, t.app, NOW);
      const problems = typecheckProject(buildExport(bp));
      expect(problems).toEqual([]);
    });
  }
});

describe('the all-21-kinds kitchen-sink TYPE-CHECKS', () => {
  type N = {
    id: string;
    kind: string;
    name: string;
    props: Record<string, unknown>;
    position: { x: number; y: number };
  };
  const n = (id: string, kind: string, name: string, props: Record<string, unknown> = {}): N => ({
    id,
    kind,
    name,
    props,
    position: { x: 0, y: 0 },
  });
  const e = (id: string, source: string, target: string, intent: string) => ({
    id,
    source,
    target,
    intent,
  });
  const bp = draftBlueprint(
    {
      nodes: [
        n('web', 'nextjs', 'Web', { domain: 'example.com' }),
        n('uploads', 'bucket', 'Uploads'),
        // AppTable + AuditLog stress multi-table CRUD + kebab disambiguation
        n('table', 'dynamo', 'AppTable', { gsiName: 'by-email', gsiHashKey: 'email' }),
        n('audit', 'dynamo', 'AuditLog', { hashKey: 'logId', rangeKey: 'at' }),
        n('pg', 'postgres', 'Relational'),
        n('jobs', 'queue', 'Jobs'),
        n('events', 'bus', 'Events'),
        n('alerts', 'snstopic', 'Alerts'),
        n('api', 'apigatewayv2', 'HttpApi'),
        n('w1', 'worker', 'ProcessJob'),
        n('w2', 'worker', 'OnEvent'),
        n('w3', 'worker', 'OnAlert'),
        n('w4', 'worker', 'GetItems', { route: 'GET /items/{id}' }),
        n('w5', 'worker', 'OnUpload'),
        n('w6', 'worker', 'NightlySweep'),
        n('cron', 'cron', 'Nightly', { schedule: 'rate(1 day)' }),
        n('sec', 'secret', 'ApiToken'),
        n('mail', 'email', 'Mailer', { sender: 'noreply@example.com' }),
        n('pool', 'cognito', 'AuthPool'),
        n('stripe', 'stripe', 'Stripe'),
        n('mongo', 'mongodb', 'Mongo'),
        n('ext', 'externalApi', 'Weather', {
          baseUrlEnv: 'WEATHER_BASE_URL',
          keyEnv: 'WEATHER_KEY',
        }),
        n('ai', 'ai', 'AnthropicKey'),
      ],
      edges: [
        e('e1', 'web', 'uploads', 'uploadsTo'),
        e('e2', 'web', 'table', 'writesTo'),
        e('e3', 'web', 'jobs', 'publishesTo'),
        e('e4', 'web', 'pg', 'queriesDb'),
        e('e5', 'web', 'mail', 'sendsEmail'),
        e('e6', 'web', 'sec', 'usesSecret'),
        e('e7', 'web', 'ai', 'usesAI'),
        e('e8', 'web', 'pool', 'usesCognito'),
        e('e9', 'web', 'stripe', 'usesStripe'),
        e('e10', 'web', 'mongo', 'queriesMongo'),
        e('e11', 'web', 'ext', 'callsApi'),
        e('e12', 'w1', 'jobs', 'subscribesTo'),
        e('e13', 'w1', 'audit', 'writesTo'),
        e('e14', 'w2', 'events', 'subscribesTo'),
        e('e15', 'w3', 'alerts', 'subscribesTo'),
        e('e16', 'w4', 'api', 'handlesRoute'),
        e('e17', 'w5', 'uploads', 'handlesBucketEvents'),
        e('e18', 'cron', 'w6', 'invokes'),
      ],
    },
    'aws-sst-v4',
    { name: 'kitchen-sink', region: 'us-east-1', packageManager: 'yarn' },
    NOW,
  );

  it('produces a project with zero type errors', () => {
    expect(typecheckProject(buildExport(bp))).toEqual([]);
  });
});
