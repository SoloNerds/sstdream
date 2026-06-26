import type { CanvasNode, CanvasEdge } from '@/lib/canvas/types';
import { awsDefaultIntent } from './edges';

// Reverse-engineer an existing `sst.config.ts` back into a canvas design (code →
// diagram). Pure + dependency-free (a focused brace/bracket scanner, NOT the TS
// compiler) so it costs nothing in the client bundle. It recovers every `new sst.*`
// resource — known kinds map to catalog kinds, unknown ones become GENERIC nodes so
// nothing is ever missing from the diagram — and the edges implied by `link: [...]`
// arrays (resolving object-maps, spreads, `Object.values()`, member access and
// cross-file helpers) plus name-first `.subscribe("Name", …)` calls. Auto-infra
// (Vpc, Cluster) is skipped.

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
  AppSync: 'appsync',
  Router: 'router',
  Function: 'worker',
  CronV2: 'cron',
  Cron: 'cron', // deprecated alias of CronV2 — same scheduled-function kind
  Email: 'email',
  Service: 'service',
  Task: 'task',
  StepFunctions: 'stepFunctions',
  CognitoUserPool: 'cognito',
  Auth: 'openauth', // sst.aws.Auth (self-hosted OpenAuth issuer)
  Secret: 'secret', // sst.Secret (also how `ai` is rendered)
};

// Unknown components become a node of this kind: the canvas renders it as a generic
// box (label = the SST type), and the engines (switch/per-kind) skip it. So a brand-new
// or niche component (CognitoIdentityPool, the deprecated Cron, …) always shows up
// instead of being dropped — no more whack-a-mole per kind.
const GENERIC_KIND = 'unknown';

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

/** From an open-delimiter index, return the inner substring AND the close index. */
function balancedRange(
  src: string,
  openIdx: number,
  open: string,
  close: string,
): { inner: string; end: number } {
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
      if (depth === 0) return { inner: src.slice(openIdx + 1, i), end: i };
    }
  }
  return { inner: src.slice(openIdx + 1), end: src.length };
}

/** First string-literal argument (the resource name). */
function firstStringArg(args: string): string | null {
  const m = args.match(/^\s*["'`]([^"'`]+)["'`]/);
  return m ? m[1] : null;
}

/** Split a comma list at top level only (so `Object.values(x)` / `[a,b]` stay whole). */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let inStr: string | null = null;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (ch === '\\') i++;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') inStr = ch;
    else if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === ',' && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out.map((t) => t.trim()).filter(Boolean);
}

/** The raw `link: [...]` element tokens (identifiers, `...spread`, `Object.values(x)`, `a.b`). */
function linkTokens(args: string): string[] {
  const idx = args.search(/\blink\s*:\s*\[/);
  if (idx === -1) return [];
  const bracket = args.indexOf('[', idx);
  return splitTopLevel(balancedRange(args, bracket, '[', ']').inner);
}

/** Pull a few simple scalar props out of the props object. */
function extractScalars(kind: string, args: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of SCALAR_PROPS[kind] ?? []) {
    const str = args.match(new RegExp(`\\b${key}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`));
    if (str) out[key] = str[1];
  }
  if (kind === 'service') out.public = /\bloadBalancer\s*:/.test(args) ? 'yes' : 'no';
  return out;
}

/** Something in the config the parser could not fully resolve — surfaced, never
 *  silently dropped (a correctness-branded tool must not lie about what it lost). */
export interface Unrecognized {
  snippet: string;
  reason: string;
}

export interface ReverseResult {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  unrecognized: Unrecognized[];
}

interface Ctor {
  component: string;
  ref: string; // e.g. "sst.aws.Function" — for messages
  kind: string;
  name: string | null;
  args: string;
  binding?: string; // `const X =`, `X =`, or object property `X:`
  start: number;
  end: number; // index of the args' closing paren
  id?: string;
  fnWorkerId?: string; // a cron's inline function, recovered as its own worker node
}

/**
 * Parse an `sst.config.ts` source string into a canvas design.
 * Returns the recovered nodes + edges (grid-laid-out) AND an `unrecognized` list of
 * anything it couldn't fully resolve, so the UI can say "recovered N of M".
 */
export function parseAwsConfig(source: string): ReverseResult {
  const unrecognized: Unrecognized[] = [];

  // 1) Find every constructor, with its binding (const X= / X= / object prop X:) + span.
  const ctors: Ctor[] = [];
  const re = /(?:([A-Za-z_$][\w$]*)\s*[:=]\s*)?new\s+sst\.(?:aws\.)?([A-Za-z0-9]+)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const component = m[2];
    if (SKIP.has(component)) continue; // Vpc/Cluster are auto-infra — intentional, not a miss.
    const ref = m[0].includes('sst.aws.') ? `sst.aws.${component}` : `sst.${component}`;
    const parenIdx = source.indexOf('(', m.index + m[0].length - 1);
    const { inner: args, end } = balancedRange(source, parenIdx, '(', ')');
    ctors.push({
      component,
      ref,
      kind: COMPONENT_KIND[component] ?? GENERIC_KIND,
      name: firstStringArg(args),
      args,
      binding: m[1],
      start: m.index,
      end,
    });
  }

  // 2) Build nodes — known kinds map to the catalog; unknown ones become generic nodes
  //    (still noted in `unrecognized`), so nothing is dropped from the picture.
  const nodes: CanvasNode[] = [];
  const counters: Record<string, number> = {};
  const bindToIds = new Map<string, string[]>(); // a var/helper name → the node id(s) it refers to
  for (const c of ctors) {
    if (!c.name) {
      unrecognized.push({
        snippet: `new ${c.ref}(…)`,
        reason: 'could not read the resource name (expected a string-literal first argument)',
      });
      continue;
    }
    const n = (counters[c.kind] = (counters[c.kind] ?? 0) + 1);
    c.id = `${c.kind}_${n}`;
    nodes.push({
      id: c.id,
      kind: c.kind,
      name: c.name,
      props: c.kind === GENERIC_KIND ? { sstComponent: c.ref } : extractScalars(c.kind, c.args),
      position: { x: 0, y: 0 },
    });
    if (c.binding) bindToIds.set(c.binding, [c.id]);
    if (c.kind === GENERIC_KIND) {
      unrecognized.push({
        snippet: `new ${c.ref}("${c.name}")`,
        reason: `${c.ref} isn't modeled by the builder yet — shown as a generic node`,
      });
    }
  }

  // 3) Object maps + helper arrays, so links through them resolve:
  //    const OBJ = { key: new sst..., … }   → OBJ and OBJ.key resolve to the member(s)
  const objToIds = new Map<string, string[]>(); // OBJ → member ids
  const propToId = new Map<string, string>(); // "OBJ.key" → id
  const objRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g;
  let o: RegExpExecArray | null;
  while ((o = objRe.exec(source)) !== null) {
    const objName = o[1];
    const braceIdx = source.indexOf('{', o.index + o[0].length - 1);
    const { end } = balancedRange(source, braceIdx, '{', '}');
    const members = ctors.filter((c) => c.id && c.binding && c.start > braceIdx && c.end < end);
    if (!members.length) continue;
    objToIds.set(
      objName,
      members.map((c) => c.id!),
    );
    for (const c of members) propToId.set(`${objName}.${c.binding}`, c.id!);
  }

  // Resolve a single link token to node id(s): identifier, `...spread`, `Object.values(OBJ)`,
  // member access `OBJ.key`, or an inline `[a, b]`.
  const resolveRef = (raw: string): string[] => {
    const token = raw.trim().replace(/^\.\.\.\s*/, '');
    let mm: RegExpMatchArray | null;
    if ((mm = token.match(/^Object\.values\(\s*([A-Za-z_$][\w$]*)\s*\)$/))) {
      return objToIds.get(mm[1]) ?? [];
    }
    if ((mm = token.match(/^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/))) {
      const id = propToId.get(`${mm[1]}.${mm[2]}`);
      return id ? [id] : [];
    }
    if (token.startsWith('[')) {
      return splitTopLevel(token.slice(1, -1)).flatMap(resolveRef);
    }
    if (/^[A-Za-z_$][\w$]*$/.test(token)) {
      return bindToIds.get(token) ?? objToIds.get(token) ?? [];
    }
    return [];
  };

  //    const X = Object.values(OBJ);   const X = [a, b];   → X resolves to many ids
  const helperRe =
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(Object\.values\(\s*[A-Za-z_$][\w$]*\s*\)|\[[^\]]*\])/g;
  let h: RegExpExecArray | null;
  while ((h = helperRe.exec(source)) !== null) {
    const ids = resolveRef(h[2]);
    if (ids.length) bindToIds.set(h[1], ids);
  }

  // A cron's function is inline (`new sst.aws.Cron("X", { function|job: {...} })`), but the
  // builder models it as a Cron → Worker (invokes) pair — so recover the inline function as
  // its own worker node (the faithful inverse of the generator), and attribute the function's
  // links to that worker. Keeps the scanned design valid (the cron has a function to invoke).
  for (const c of ctors) {
    if (c.id && c.kind === 'cron' && /\b(?:function|job)\s*:/.test(c.args)) {
      const wn = (counters.worker = (counters.worker ?? 0) + 1);
      c.fnWorkerId = `worker_${wn}`;
      nodes.push({
        id: c.fnWorkerId,
        kind: 'worker',
        name: `${c.name}Handler`,
        props: {},
        position: { x: 0, y: 0 },
      });
    }
  }

  // 4) Edges from EVERY resource's `link: [...]` (including anonymous `new sst.X("N", {link})`).
  const idToKind = new Map(nodes.map((n) => [n.id, n.kind]));
  const edges: CanvasEdge[] = [];
  let edgeN = 0;
  const seen = new Set<string>();
  const addEdge = (src: string, tgt: string, intent: string) => {
    const key = `${src}->${tgt}`;
    if (src !== tgt && !seen.has(key)) {
      seen.add(key);
      edges.push({ id: `edge_${++edgeN}`, source: src, target: tgt, intent });
    }
  };
  const linkFrom = (sourceId: string, sourceKind: string, sourceName: string, args: string) => {
    for (const token of linkTokens(args)) {
      const targets = resolveRef(token);
      if (targets.length === 0) {
        const bare = token.replace(/^\.\.\.\s*/, '');
        if (/^[A-Za-z_$][\w$.]*$/.test(bare)) {
          unrecognized.push({
            snippet: `${sourceName} → link: [${token}]`,
            reason: `links "${bare}", which wasn't recognized as a resource`,
          });
        }
        continue;
      }
      for (const tId of targets) {
        const intent = awsDefaultIntent(sourceKind, idToKind.get(tId)!);
        if (intent) addEdge(sourceId, tId, intent);
      }
    }
  };
  for (const c of ctors) {
    if (!c.id) continue;
    if (c.fnWorkerId) {
      // The cron invokes its function (worker); the function's links belong to the worker.
      addEdge(c.id, c.fnWorkerId, 'invokes');
      linkFrom(c.fnWorkerId, 'worker', c.name!, c.args);
    } else {
      linkFrom(c.id, c.kind, c.name!, c.args);
    }
  }

  // <var>.route("METHOD /path", { link: [...] }) → the routed resource links its targets.
  const routeRe = /([A-Za-z_$][\w$]*)\.route\s*\(/g;
  let rt: RegExpExecArray | null;
  while ((rt = routeRe.exec(source)) !== null) {
    const ids = bindToIds.get(rt[1]);
    if (!ids?.length) continue;
    const parenIdx = source.indexOf('(', rt.index + rt[0].length - 1);
    const { inner } = balancedRange(source, parenIdx, '(', ')');
    const srcId = ids[0];
    linkFrom(srcId, idToKind.get(srcId)!, rt[1], inner);
  }

  // <var>.subscribe("WorkerName", {...}) → a worker node + a subscribesTo edge.
  // (Skip handler-path first args like realtime.subscribe("src/x.handler", …).)
  const subRe = /([A-Za-z_$][\w$]*)\.subscribe\(\s*["'`]([^"'`]+)["'`]/g;
  let s: RegExpExecArray | null;
  while ((s = subRe.exec(source)) !== null) {
    const targetIds = bindToIds.get(s[1]);
    const workerName = s[2];
    if (!targetIds?.length || workerName.includes('/') || workerName.includes('.handler')) continue;
    const wn = (counters.worker = (counters.worker ?? 0) + 1);
    const workerId = `worker_${wn}`;
    nodes.push({
      id: workerId,
      kind: 'worker',
      name: workerName,
      props: {},
      position: { x: 0, y: 0 },
    });
    idToKind.set(workerId, 'worker');
    addEdge(workerId, targetIds[0], 'subscribesTo');
  }

  layout(nodes, edges);
  return { nodes, edges, unrecognized };
}

// Simple layered layout: link/subscribe sources on the left, their targets to the
// right. Roots (no outgoing edges that aren't also targets) anchor the first column.
function layout(nodes: CanvasNode[], edges: CanvasEdge[]): void {
  const COL = 320;
  const ROW = 120;
  const hasOutgoing = new Set(edges.map((e) => e.source));
  const col = new Map<string, number>();
  for (const n of nodes) col.set(n.id, hasOutgoing.has(n.id) ? 0 : 1);
  const connected = new Set([...edges.map((e) => e.source), ...edges.map((e) => e.target)]);
  for (const n of nodes) if (!connected.has(n.id)) col.set(n.id, 0);

  const rowOf: Record<number, number> = {};
  for (const n of nodes) {
    const c = col.get(n.id) ?? 0;
    const row = (rowOf[c] = (rowOf[c] ?? 0) + 1) - 1;
    n.position = { x: 60 + c * COL, y: 60 + row * ROW };
  }
}
