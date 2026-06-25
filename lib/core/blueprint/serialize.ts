import { BLUEPRINT_VERSION, BlueprintSchema } from './schema';
import { migrateBlueprint } from './migrate';
import type { Blueprint, Output, Secret } from './types';
import { getTarget } from '@/lib/targets/registry';
import type { DeployTarget } from '@/lib/targets/types';

export interface CanvasNodeData {
  id: string;
  kind: string;
  name: string;
  props?: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface CanvasEdgeData {
  id: string;
  source: string;
  target: string;
  intent: string;
}

export interface CanvasSnapshot {
  nodes: CanvasNodeData[];
  edges: CanvasEdgeData[];
  // Blueprint-level secrets/outputs have no canvas representation yet, but they
  // are durable schema fields. Carry them through the round-trip so an imported
  // or hand-authored design doesn't lose them on the next autosave/export.
  secrets?: Secret[];
  outputs?: Output[];
}

export interface AppDefaults {
  name: string;
  packageManager: Blueprint['app']['packageManager'];
  region: string;
}

const TARGET_DEFAULTS: Record<DeployTarget, Blueprint['target']> = {
  'aws-sst-v4': {
    deploy: 'aws-sst-v4',
    iac: 'sst',
    sstMajor: 4,
    awsProviderMajor: 7,
    providerModel: 'sst-managed-providers',
  },
  vercel: {
    deploy: 'vercel',
    iac: 'none',
  },
};

export function createEmptyBlueprint(
  deploy: DeployTarget,
  app: AppDefaults,
  now: string,
): Blueprint {
  return BlueprintSchema.parse({
    version: BLUEPRINT_VERSION,
    target: TARGET_DEFAULTS[deploy],
    app: {
      name: app.name,
      framework: 'nextjs',
      packageManager: app.packageManager,
      region: app.region,
      stages: [
        { name: 'production', removal: 'retain', protect: true },
        { name: 'dev', removal: 'remove', protect: false },
      ],
    },
    resources: [],
    connections: [],
    secrets: [],
    outputs: [],
    metadata: { createdAt: now, updatedAt: now, generatedBy: 'sstdream' },
  });
}

/**
 * Build a blueprint-shaped object WITHOUT zod validation, so the validation
 * engine can report problems (e.g. an invalid app name) instead of throwing.
 */
export function draftBlueprint(
  snapshot: CanvasSnapshot,
  deploy: DeployTarget,
  app: AppDefaults,
  now: string,
  previousCreatedAt?: string,
): Blueprint {
  return {
    version: BLUEPRINT_VERSION,
    target: TARGET_DEFAULTS[deploy],
    app: {
      name: app.name,
      framework: 'nextjs',
      packageManager: app.packageManager,
      region: app.region,
      stages: [
        { name: 'production', removal: 'retain', protect: true },
        { name: 'dev', removal: 'remove', protect: false },
      ],
    },
    resources: snapshot.nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      name: n.name,
      props: n.props ?? {},
      position: n.position,
    })),
    connections: snapshot.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      intent: e.intent,
    })),
    secrets: snapshot.secrets ?? [],
    outputs: snapshot.outputs ?? [],
    metadata: {
      createdAt: previousCreatedAt ?? now,
      updatedAt: now,
      generatedBy: 'sstdream',
    },
  } as Blueprint;
}

/** Build a validated blueprint from the current canvas + app/target config. */
export function canvasToBlueprint(
  snapshot: CanvasSnapshot,
  deploy: DeployTarget,
  app: AppDefaults,
  now: string,
  previousCreatedAt?: string,
): Blueprint {
  return BlueprintSchema.parse(draftBlueprint(snapshot, deploy, app, now, previousCreatedAt));
}

export function blueprintToCanvas(bp: Blueprint): CanvasSnapshot {
  // Legacy designs may carry the removed catch-all 'linksTo' intent (it used
  // to be the default for unmapped pairs and silently generated nothing).
  // Heal on load: adopt the pair's real default intent, or drop the edge when
  // the pair is no longer connectable.
  const byId = new Map(bp.resources.map((r) => [r.id, r]));
  const heal = (c: Blueprint['connections'][number]): string | null => {
    if (c.intent !== 'linksTo') return c.intent;
    const src = byId.get(c.source);
    const tgt = byId.get(c.target);
    if (!src || !tgt) return null;
    return getTarget(bp.target.deploy).defaultIntent(src.kind, tgt.kind);
  };
  return {
    nodes: bp.resources.map((r) => ({
      id: r.id,
      kind: r.kind,
      name: r.name,
      props: r.props,
      position: r.position,
    })),
    edges: bp.connections.flatMap((c) => {
      const intent = heal(c);
      return intent ? [{ id: c.id, source: c.source, target: c.target, intent }] : [];
    }),
    secrets: bp.secrets,
    outputs: bp.outputs,
  };
}

export function serializeBlueprint(bp: Blueprint): string {
  return `${JSON.stringify(bp, null, 2)}\n`;
}

export function parseBlueprint(json: string): Blueprint {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON: could not parse the design file.');
  }
  return migrateBlueprint(raw);
}
