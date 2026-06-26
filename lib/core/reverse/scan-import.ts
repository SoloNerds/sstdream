import type { CanvasNode, CanvasEdge } from '@/lib/canvas/types';
import type { DeployTarget } from '@/lib/targets/types';

/** A design recovered from a `sstdream-scan.json` (the output of `sst-dream scan`). */
export interface ScanImport {
  target: DeployTarget;
  appName: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  unrecognized: { snippet: string; reason: string }[];
}

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/**
 * Recognize a `sstdream-scan.json` and pull the recovered design out of it, so a user
 * can paste the scan straight into the builder's "From code" import instead of source.
 * Returns null if the text isn't a scan file (e.g. it's an sst.config.ts, or a blueprint).
 *
 * A scan file is distinguished by: a `nodes` array, an `edges` array, a STRING `target`
 * (a blueprint's target is an object), and the scan-only `generatedAt`/`scannedFiles`
 * stamp — so this never misfires on a blueprint or other JSON.
 */
export function parseScanImport(text: string): ScanImport | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null; // not JSON → not a scan file (probably source code)
  }
  const o = asRecord(parsed);
  if (!o) return null;
  if (!Array.isArray(o.nodes) || !Array.isArray(o.edges) || typeof o.target !== 'string')
    return null;
  if (!('generatedAt' in o) && !('scannedFiles' in o)) return null;

  const nodes: CanvasNode[] = (o.nodes as unknown[])
    .map(asRecord)
    .filter((n): n is Record<string, unknown> => n !== null && typeof n.id === 'string')
    .map((n, i) => {
      const pos = asRecord(n.position);
      return {
        id: String(n.id),
        kind: String(n.kind ?? ''),
        name: String(n.name ?? n.id),
        props: asRecord(n.props) ?? {},
        position: {
          x: typeof pos?.x === 'number' ? pos.x : 60 + (i % 4) * 220,
          y: typeof pos?.y === 'number' ? pos.y : 60 + Math.floor(i / 4) * 120,
        },
      };
    });

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: CanvasEdge[] = (o.edges as unknown[])
    .map(asRecord)
    .filter((e): e is Record<string, unknown> => e !== null)
    .filter((e) => nodeIds.has(String(e.source)) && nodeIds.has(String(e.target)))
    .map((e, i) => ({
      id: typeof e.id === 'string' ? e.id : `edge_${i + 1}`,
      source: String(e.source),
      target: String(e.target),
      intent: String(e.intent ?? 'dependsOn'),
    }));

  const unrecognized = Array.isArray(o.unmodeled)
    ? (o.unmodeled as unknown[])
        .map(asRecord)
        .filter(Boolean)
        .map((u) => ({
          snippet: String(u!.snippet ?? ''),
          reason: String(u!.reason ?? ''),
        }))
    : [];

  return {
    target: o.target as DeployTarget,
    appName: typeof o.appName === 'string' ? o.appName : 'scanned-app',
    nodes,
    edges,
    unrecognized,
  };
}
