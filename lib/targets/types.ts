// The Target abstraction: each deploy lane (aws-sst-v4, vercel) provides its own
// catalog of resource kinds and edge intents. The shared UI shell + blueprint
// envelope + engines (validation/simulation/cost/recommendations/generation) run
// over whichever Target is active. See docs/architecture-targets.md.

export type DeployTarget = 'aws-sst-v4' | 'vercel';

export interface ResourceKindMeta {
  /** Stable kind id, unique within the target catalog. */
  kind: string;
  label: string;
  /** PascalCase base for a new resource's name, e.g. "Bucket" (must be a valid identifier). */
  defaultName: string;
  /** Underlying IaC component, e.g. "sst.aws.Bucket". */
  component: string;
  description: string;
  /** Tailwind background class used as the node accent. */
  accent: string;
  category: 'compute' | 'storage' | 'messaging' | 'database' | 'schedule' | 'config' | 'network';
  /** If true, only one instance of this kind is meaningful (e.g. the Next.js app). */
  singleton?: boolean;
}

export type ResourceCatalog = Record<string, ResourceKindMeta>;

export interface EdgeIntentMeta {
  /** Stable intent id, e.g. "uploadsTo". */
  intent: string;
  label: string;
  description: string;
  /** Source kinds this intent may originate from (empty = any). */
  from: string[];
  /** Target kinds this intent may point to (empty = any). */
  to: string[];
}

export interface Target {
  id: DeployTarget;
  label: string;
  catalog: ResourceCatalog;
  /** Display/palette order of catalog kinds. */
  catalogOrder: string[];
  edgeIntents: EdgeIntentMeta[];
  /**
   * Best-guess intent for a new edge between two kinds, or null if the
   * connection is not meaningful in this lane.
   */
  defaultIntent: (fromKind: string, toKind: string) => string | null;
}
