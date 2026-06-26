import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parseAwsConfig } from '@/lib/targets/aws-sst-v4/reverse';
import { parseVercelConfig } from '@/lib/targets/vercel/reverse';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { validateBlueprint } from '@/lib/core/validation/validate';
import { simulateBlueprint } from '@/lib/core/simulation/simulate';
import { estimateCost } from '@/lib/core/cost/estimate';
import { expandInfra } from '@/lib/core/expansion/expand';
import { auditInfra } from '@/lib/core/audit/audit';
// Shared, adversarially-tested redactor (same module the standalone collector ships).
// @ts-expect-error — plain-JS module, no types.
import { sanitize } from '../scripts/sanitize.mjs';
import type { DeployTarget } from '@/lib/targets/types';
import type { CanvasNode, CanvasEdge } from '@/lib/canvas/types';

const SKIP_DIRS = new Set([
  'node_modules',
  '.sst',
  '.git',
  '.next',
  'dist',
  'build',
  'out',
  '.turbo',
  '.vercel',
  'coverage',
  '.cache',
]);
const DEFINES_INFRA = /(\bnew\s+sst\.|sst\.Linkable\b|\$config\s*\()/;

function walk(dir: string): string[] {
  let out: string[] = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) out = out.concat(walk(p));
    } else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts') && !/^\.env/i.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

/** A node the scanner recovered, with how sure it is. */
export interface ScannedNode extends CanvasNode {
  confidence: 'high' | 'low';
}
/** Something in the code the scanner couldn't turn into a node (low confidence). */
export interface Unmodeled {
  snippet: string;
  reason: string;
}

export interface ScanResult {
  appName: string;
  target: DeployTarget;
  scannedFiles: string[];
  redactions: number;
  nodes: ScannedNode[];
  edges: CanvasEdge[];
  unmodeled: Unmodeled[];
  validation: ReturnType<typeof validateBlueprint>;
  simulation: ReturnType<typeof simulateBlueprint>;
  cost: ReturnType<typeof estimateCost>;
  expansion: ReturnType<typeof expandInfra>;
  audit: ReturnType<typeof auditInfra>;
  generatedAt: string;
}

export function appNameFrom(source: string, fallback: string): string {
  // The app name lives in the config's app() block: `return { name: "x", home: "aws" }`.
  // Match a `name:` that shares an object literal with `home:` (only the app block has
  // `home`), in either order — so we don't grab a resource's `name:` prop by mistake
  // (e.g. a Cognito pool or SES identity named "verified_email").
  const m =
    source.match(/\bname\s*:\s*["'`]([A-Za-z0-9._-]+)["'`][^}]{0,300}?\bhome\s*:/i) ??
    source.match(
      /\bhome\s*:\s*["'`][^"'`]+["'`][^}]{0,300}?\bname\s*:\s*["'`]([A-Za-z0-9._-]+)["'`]/i,
    );
  return m ? m[1] : fallback;
}

const CTOR =
  /new\s+sst\.(?:aws\.|cloudflare\.|vercel\.)?([A-Za-z0-9]+)\s*\(\s*["'`]([^"'`]+)["'`]/g;
/**
 * Honesty backstop: every `new sst.X("Name")` that did NOT become a node is reported,
 * never silently dropped. SSTDREAM models some constructs implicitly (Vpc, Cluster are
 * auto-managed), so they legitimately aren't nodes — but the user must still see them.
 */
function droppedConstructors(
  blob: string,
  recovered: Set<string>,
  already: Unmodeled[],
): Unmodeled[] {
  const out: Unmodeled[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  CTOR.lastIndex = 0;
  while ((m = CTOR.exec(blob)) !== null) {
    const [, kind, name] = m;
    if (recovered.has(name) || seen.has(name)) continue;
    if (already.some((u) => u.snippet.includes(name))) continue;
    seen.add(name);
    out.push({
      snippet: `new sst.${kind}("${name}")`,
      reason:
        'recognized SST construct not modeled as a node (e.g. auto-managed Vpc/Cluster) — review by hand',
    });
  }
  return out;
}

/**
 * Scan a local SST/Vercel project into a sanitized, confidence-scored infra map.
 * Runs ENTIRELY locally: no credentials, no network. Secrets are redacted before the
 * code ever reaches the parser, so they can't leak into the output JSON either.
 */
export function scanRepo(root: string, now: string): ScanResult {
  const files = walk(root);
  // Sanitize every file FIRST — secrets never reach the parser or the output.
  const sanitized = new Map<string, string>();
  let redactions = 0;
  for (const f of files) {
    try {
      const { text, redactions: n } = sanitize(readFileSync(f, 'utf8')) as {
        text: string;
        redactions: number;
      };
      sanitized.set(f, text);
      redactions += n;
    } catch {
      /* unreadable — skip */
    }
  }

  // Which files define infrastructure (or are the app config)?
  const infra = [...sanitized.entries()].filter(([, t]) => DEFINES_INFRA.test(t));
  const isAws = infra.some(([f]) => /sst\.config\.tsx?$/.test(f)) || infra.length > 0;

  let nodes: CanvasNode[] = [];
  let edges: CanvasEdge[] = [];
  let unmodeled: Unmodeled[] = [];
  let target: DeployTarget = 'aws-sst-v4';
  let appName = 'scanned-app';

  if (isAws && infra.length) {
    // Concatenate the infra modules + config and reverse-parse the whole blob.
    const blob = infra.map(([, t]) => t).join('\n\n');
    appName = appNameFrom(blob, appName);
    const parsed = parseAwsConfig(blob);
    nodes = parsed.nodes;
    edges = parsed.edges;
    const recovered = new Set(nodes.map((n) => n.name));
    unmodeled = [
      ...parsed.unrecognized,
      ...droppedConstructors(blob, recovered, parsed.unrecognized),
    ];
  } else {
    // Fall back to the Vercel lane: deps in package.json → kinds.
    target = 'vercel';
    const pkg = sanitized.get(join(root, 'package.json')) ?? readPkg(root);
    if (pkg) {
      const parsed = parseVercelConfig(pkg);
      nodes = parsed.nodes;
      edges = parsed.edges;
      unmodeled = parsed.unrecognized;
      try {
        appName = (JSON.parse(pkg) as { name?: string }).name ?? appName;
      } catch {
        /* ignore */
      }
    }
  }

  const app = { name: appName, region: 'us-east-1', packageManager: 'yarn' as const };
  const snapshot = { nodes, edges };
  const bp = draftBlueprint(snapshot, target, app, now);

  // Confidence: a recovered node is a direct constructor (high); everything the parser
  // couldn't model is surfaced as low/unsupported, never silently dropped.
  const scannedNodes: ScannedNode[] = nodes.map((n) => ({ ...n, confidence: 'high' }));

  return {
    appName,
    target,
    scannedFiles: infra.map(([f]) => relative(root, f).split(sep).join('/')),
    redactions,
    nodes: scannedNodes,
    edges,
    unmodeled,
    validation: validateBlueprint(bp),
    simulation: simulateBlueprint(bp),
    cost: estimateCost(bp),
    expansion: expandInfra(bp),
    audit: auditInfra(bp),
    generatedAt: now,
  };
}

function readPkg(root: string): string | undefined {
  try {
    return readFileSync(join(root, 'package.json'), 'utf8');
  } catch {
    return undefined;
  }
}
