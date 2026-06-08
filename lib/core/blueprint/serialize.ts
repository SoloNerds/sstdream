import { BLUEPRINT_VERSION, BlueprintSchema } from './schema';
import { migrateBlueprint } from './migrate';
import type { Blueprint } from './types';
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
    secrets: [],
    outputs: [],
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
  return {
    nodes: bp.resources.map((r) => ({
      id: r.id,
      kind: r.kind,
      name: r.name,
      props: r.props,
      position: r.position,
    })),
    edges: bp.connections.map((c) => ({
      id: c.id,
      source: c.source,
      target: c.target,
      intent: c.intent,
    })),
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
