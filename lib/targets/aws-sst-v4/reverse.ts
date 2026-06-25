import type { CanvasNode, CanvasEdge } from '@/lib/canvas/types';
import { awsDefaultIntent } from './edges';

// Reverse-engineer an existing `sst.config.ts` back into a canvas design (code →
// diagram). Pure + dependency-free (a focused brace/bracket scanner, NOT the TS
// compiler) so it costs nothing in the client bundle. It recovers the resources
// that appear as `new sst.aws.X(...)` / `new sst.Secret(...)` declarations and the
// edges implied by their `link: [...]` arrays + name-first `.subscribe("Name", …)`
// calls — the inverse of generator/config.ts. Auto-infra (Vpc, Cluster) is skipped;
// env-only integrations (Stripe/Mongo/Clerk/external API) leave no infra to recover.

// sst component → catalog kind. Mirrors the `new sst.aws.X` strings config.ts emits.
const COMPONENT_KIND: Record<string, string> = {
  Nextjs: 'nextjs',
  StaticSite: 'staticsite',
  Bucket: 'bucket',
  Dynamo: 'dynamo',
  Postgres: 'postgres',
  Aurora: 'aurora',
  Redis: 'redis',
  Queue: 'queue',
  Bus: 'bus',
  SnsTopic: 'snstopic',
  Realtime: 'realtime',
  ApiGatewayV2: 'apigatewayv2',
  Router: 'router',
  Function: 'worker',
  CronV2: 'cron',
  Email: 'email',
  Service: 'service',
  Task: 'task',
  StepFunctions: 'stepFunctions',
  CognitoUserPool: 'cognito',
  Secret: 'secret', // sst.Secret (also how `ai` is rendered)
};

// Auto-generated shared infra — implied by the kinds that need it, never its own node.
const SKIP = new Set(['Vpc', 'Cluster']);

// Scalar props worth recovering per kind (so the re-imported design re-generates the
// same config). Only simple string/number literals; everything else uses defaults.
const SCALAR_PROPS: Record<string, ('nat' | 'engine' | 'type' | 'public' | 'cpu' | 'memory')[]> = {
  postgres: ['nat'],
  aurora: ['nat'],
  redis: ['engine'],
  stepFunctions: ['type'],
  service: ['cpu', 'memory', 'public'],
  task: ['cpu', 'memory'],
};

interface ParsedResource {
  varName?: string;
  component: string;
  kind: string;
  name: string;
  args: string; // the full argument-list source (after the first paren, balanced)
}

/** From an open-delimiter index, return the substring up to its balanced close. */
function balanced(src: string, openIdx: number, open: string, close: string): string {
  let depth = 0;
  let inStr: string | null = null;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (ch === '\\') i++;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') inStr = ch;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return src.slice(openIdx + 1, i);
    }
  }
  return src.slice(openIdx + 1);
}

/** First string-literal argument (the resource name). */
function firstStringArg(args: string): string | null {
  const m = args.match(/^\s*["'`]([^"'`]+)["'`]/);
  return m ? m[1] : null;
}

/** Extract the `link: [a, b]` variable names from a props object source. */
function extractLinks(args: string): string[] {
  const idx = args.search(/\blink\s*:\s*\[/);
  if (idx === -1) return [];
  const bracket = args.indexOf('[', idx);
  const inner = balanced(args, bracket, '[', ']');
  return inner
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[A-Za-z_$][\w$]*$/.test(s)); // bare identifiers only
}

/** Pull a few simple scalar props out of the props object. */
function extractScalars(kind: string, args: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of SCALAR_PROPS[kind] ?? []) {
    const str = args.match(new RegExp(`\\b${key}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`));
    if (str) out[key] = str[1];
  }
  // public is a select on the catalog (yes/no), but a Service renders it as the
  // presence/absence of a loadBalancer — so derive it from the source, not a prop.
  if (kind === 'service') out.public = /\bloadBalancer\s*:/.test(args) ? 'yes' : 'no';
  return out;
}

/**
 * Parse an `sst.config.ts` source string into a canvas design.
 * Returns the recovered nodes + edges (positions auto-laid-out in a grid).
 */
export function parseAwsConfig(source: string): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const resources: ParsedResource[] = [];
  // `[const <var> =] new sst[.aws].<Component>(` — captures the optional binding + component.
  const re = /(?:const\s+([A-Za-z_$][\w$]*)\s*=\s*)?new\s+sst\.(?:aws\.)?([A-Za-z0-9]+)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const component = m[2];
    if (SKIP.has(component)) continue;
    const kind = COMPONENT_KIND[component];
    if (!kind) continue;
    const parenIdx = source.indexOf('(', m.index + m[0].length - 1);
    const args = balanced(source, parenIdx, '(', ')');
    const name = firstStringArg(args);
    if (!name) continue;
    resources.push({ varName: m[1], component, kind, name, args });
  }

  // Build nodes + a var→nodeId map (for resolving link edges).
  const nodes: CanvasNode[] = [];
  const varToId = new Map<string, string>();
  const counters: Record<string, number> = {};
  for (const r of resources) {
    const n = (counters[r.kind] = (counters[r.kind] ?? 0) + 1);
    const id = `${r.kind}_${n}`;
    nodes.push({
      id,
      kind: r.kind,
      name: r.name,
      props: extractScalars(r.kind, r.args),
      position: { x: 0, y: 0 },
    });
    if (r.varName) varToId.set(r.varName, id);
  }
  const idToKind = new Map(nodes.map((n) => [n.id, n.kind]));

  const edges: CanvasEdge[] = [];
  let edgeN = 0;
  const addEdge = (source: string, target: string, intent: string) => {
    edges.push({ id: `edge_${++edgeN}`, source, target, intent });
  };

  // link: [...] → the declaring resource links each target.
  for (const r of resources) {
    if (!r.varName) continue;
    const sourceId = varToId.get(r.varName);
    if (!sourceId) continue;
    const sourceKind = idToKind.get(sourceId)!;
    for (const linkVar of extractLinks(r.args)) {
      const targetId = varToId.get(linkVar);
      if (!targetId) continue;
      const targetKind = idToKind.get(targetId)!;
      const intent = awsDefaultIntent(sourceKind, targetKind);
      if (intent) addEdge(sourceId, targetId, intent);
    }
  }

  // <var>.subscribe("WorkerName", {...}) → a worker node + a subscribesTo edge.
  // (Skip handler-path first args like realtime.subscribe("src/x.handler", …).)
  const subRe = /([A-Za-z_$][\w$]*)\.subscribe\(\s*["'`]([^"'`]+)["'`]/g;
  let s: RegExpExecArray | null;
  while ((s = subRe.exec(source)) !== null) {
    const targetId = varToId.get(s[1]);
    const workerName = s[2];
    if (!targetId || workerName.includes('/') || workerName.includes('.handler')) continue;
    const wn = (counters.worker = (counters.worker ?? 0) + 1);
    const workerId = `worker_${wn}`;
    nodes.push({
      id: workerId,
      kind: 'worker',
      name: workerName,
      props: {},
      position: { x: 0, y: 0 },
    });
    addEdge(workerId, targetId, 'subscribesTo');
  }

  layout(nodes, edges);
  return { nodes, edges };
}

// Simple layered layout: link/subscribe sources on the left, their targets to the
// right. Roots (no outgoing edges that aren't also targets) anchor the first column.
function layout(nodes: CanvasNode[], edges: CanvasEdge[]): void {
  const COL = 320;
  const ROW = 120;
  const hasOutgoing = new Set(edges.map((e) => e.source));
  const col = new Map<string, number>();
  for (const n of nodes) col.set(n.id, hasOutgoing.has(n.id) ? 0 : 1);
  // Anything with no edges at all sits in column 0 too.
  const connected = new Set([...edges.map((e) => e.source), ...edges.map((e) => e.target)]);
  for (const n of nodes) if (!connected.has(n.id)) col.set(n.id, 0);

  const rowOf: Record<number, number> = {};
  for (const n of nodes) {
    const c = col.get(n.id) ?? 0;
    const row = (rowOf[c] = (rowOf[c] ?? 0) + 1) - 1;
    n.position = { x: 60 + c * COL, y: 60 + row * ROW };
  }
}
