import type { CanvasNode, CanvasEdge } from '@/lib/canvas/types';
import { vercelDefaultIntent } from './edges';

// Reverse-engineer a Vercel project back into a canvas design (code → diagram), the
// counterpart to the AWS sst.config.ts parser. Vercel infra is implicit (file
// conventions + package deps), so the richest single signal is **package.json** —
// each integration dependency maps to a catalog kind. A pasted **vercel.json** is
// also recognized (its `crons` → Cron nodes). Like the AWS parser it never silently
// drops: an `unrecognized` channel reports anything it couldn't model.

export interface Unrecognized {
  snippet: string;
  reason: string;
}
export interface ReverseResult {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  unrecognized: Unrecognized[];
}

// npm dependency → Vercel catalog kind. The inverse of the generator's packageAdditions.
const DEP_KIND: Record<string, string> = {
  '@vercel/blob': 'blob',
  '@neondatabase/serverless': 'postgres',
  '@upstash/redis': 'redis',
  '@vercel/queue': 'queue',
  '@vercel/edge-config': 'edgeConfig',
  '@vercel/analytics': 'analytics',
  '@vercel/speed-insights': 'speedInsights',
  ai: 'aiGateway',
  workflow: 'workflow',
  flags: 'featureFlags',
  '@vercel/firewall': 'rateLimit',
  '@vercel/functions': 'edgeMiddleware',
  botid: 'botId',
  '@vercel/sandbox': 'sandbox',
  resend: 'email',
  stripe: 'webhook',
};

// Deps that are normal app dependencies, not infra — never reported as "unrecognized".
const IGNORED_DEPS = new Set([
  'next',
  'react',
  'react-dom',
  '@ai-sdk/react',
  '@flags-sdk/edge-config',
  'zod',
  'typescript',
]);

const DEFAULT_NAME: Record<string, string> = {
  app: 'Web',
  blob: 'Files',
  postgres: 'Db',
  redis: 'Cache',
  queue: 'Jobs',
  edgeConfig: 'Config',
  analytics: 'Analytics',
  speedInsights: 'SpeedInsights',
  aiGateway: 'Chat',
  workflow: 'Workflow',
  featureFlags: 'Flags',
  rateLimit: 'RateLimit',
  edgeMiddleware: 'Proxy',
  botId: 'BotId',
  sandbox: 'Sandbox',
  email: 'Mailer',
  webhook: 'Webhook',
  cron: 'Daily',
};

/**
 * Parse a Vercel project's `package.json` (deps → kinds) or `vercel.json` (crons)
 * into a canvas design. Returns the recovered nodes + edges and an `unrecognized`
 * list of anything it couldn't model.
 */
export function parseVercelConfig(source: string): ReverseResult {
  const unrecognized: Unrecognized[] = [];
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(source) as Record<string, unknown>;
  } catch {
    return {
      nodes: [],
      edges: [],
      unrecognized: [{ snippet: '(not JSON)', reason: 'paste a package.json or vercel.json' }],
    };
  }

  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];
  const counters: Record<string, number> = {};
  const add = (kind: string, name?: string): string => {
    const n = (counters[kind] = (counters[kind] ?? 0) + 1);
    const id = `${kind}_${n}`;
    nodes.push({
      id,
      kind,
      name: name ?? `${DEFAULT_NAME[kind] ?? kind}${n > 1 ? n : ''}`,
      props: {},
      position: { x: 0, y: 0 },
    });
    return id;
  };

  const deps = parsed.dependencies as Record<string, string> | undefined;
  const crons = parsed.crons as { path?: string }[] | undefined;

  if (deps && typeof deps === 'object') {
    // package.json → the app + one node per recognized integration dependency.
    const appId = add('app');
    const seen = new Set<string>();
    for (const dep of Object.keys(deps)) {
      const kind = DEP_KIND[dep];
      if (!kind) {
        if (dep.startsWith('@vercel/') && !IGNORED_DEPS.has(dep)) {
          unrecognized.push({ snippet: dep, reason: `the "${dep}" dependency isn't modeled yet` });
        }
        continue;
      }
      if (seen.has(kind)) continue; // e.g. ai + @ai-sdk/react → one aiGateway
      seen.add(kind);
      const id = add(kind);
      const intent = vercelDefaultIntent('app', kind);
      if (intent) edges.push({ id: `edge_${edges.length + 1}`, source: appId, target: id, intent });
    }
  } else if (Array.isArray(crons)) {
    // vercel.json → Cron nodes (one per schedule).
    for (const c of crons) {
      const path = typeof c?.path === 'string' ? c.path : undefined;
      add('cron', path ? path.split('/').filter(Boolean).pop() : undefined);
    }
  } else {
    unrecognized.push({
      snippet: '(no dependencies or crons)',
      reason: 'expected a package.json (with "dependencies") or a vercel.json (with "crons")',
    });
  }

  layout(nodes, edges);
  return { nodes, edges, unrecognized };
}

// app on the left, its integrations laid out in a column to the right.
function layout(nodes: CanvasNode[], edges: CanvasEdge[]): void {
  const COL = 320;
  const ROW = 110;
  const sources = new Set(edges.map((e) => e.source));
  let appRow = 0;
  let intRow = 0;
  for (const n of nodes) {
    const isApp = sources.has(n.id) || n.kind === 'app';
    if (isApp) n.position = { x: 60, y: 60 + appRow++ * ROW };
    else n.position = { x: 60 + COL, y: 60 + intRow++ * ROW };
  }
}
