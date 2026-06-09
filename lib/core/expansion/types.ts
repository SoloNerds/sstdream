// The "Infrastructure view" model: a read-only lowering of the logical blueprint
// into the underlying cloud resources each node actually provisions. Derived, never
// edited. Per-lane expanders fill this in from a verified static map.

export interface PhysicalResource {
  /** Cloud service, e.g. "CloudFront", "Lambda", "DynamoDB", "RDS". */
  service: string;
  /** What this specific resource is, e.g. "Server (SSR) function". */
  name: string;
  /** Extra context (defaults, gotchas). */
  note?: string;
  /** If set, the condition under which it's created (otherwise: always). */
  conditional?: string;
  /** Costs money (vs. free/standing). */
  paid?: boolean;
  /** Security-relevant: IAM role, security group, public access, secret. */
  security?: boolean;
}

export interface InfraGroup {
  /** Logical resource id (or a synthetic id like "vpc" for shared infra). */
  id: string;
  /** Logical node name (or "VPC (shared)"). */
  title: string;
  /** Logical kind, or a synthetic kind for shared/external groups. */
  kind: string;
  resources: PhysicalResource[];
}
