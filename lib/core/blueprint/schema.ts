import { z } from 'zod';

// The blueprint ENVELOPE — the durable, serializable model that survives across
// SST versions and re-exports. Lane-specific meaning of `resources[].kind` and
// `connections[].intent` is validated against the active Target catalog (M3),
// not statically here. See docs/architecture-targets.md.

export const BLUEPRINT_VERSION = '0.1.0' as const;

export const DeployTargetSchema = z.enum(['aws-sst-v4', 'vercel']);

export const PackageManagerSchema = z.enum(['npm', 'yarn', 'pnpm', 'bun']);

export const RemovalSchema = z.enum(['remove', 'retain', 'retain-all']);

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const StagePolicySchema = z.object({
  name: z.string().min(1),
  removal: RemovalSchema.optional(),
  protect: z.boolean().optional(),
});

export const ResourceSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  name: z.string().min(1),
  props: z.record(z.string(), z.unknown()).default({}),
  position: PositionSchema,
});

export const ConnectionSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  intent: z.string().min(1),
});

export const SecretSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export const OutputSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Resource id + property, e.g. "<resourceId>.url". */
  valueRef: z.string().min(1),
});

export const TargetConfigSchema = z.object({
  deploy: DeployTargetSchema,
  iac: z.enum(['sst', 'none']),
  sstMajor: z.number().int().optional(),
  awsProviderMajor: z.number().int().optional(),
  providerModel: z.string().optional(),
});

export const AppConfigSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9-]*$/, 'lowercase letters, numbers and dashes; must start with a letter'),
  framework: z.literal('nextjs'),
  packageManager: PackageManagerSchema,
  region: z.string().min(1),
  stages: z.array(StagePolicySchema).default([]),
});

export const MetadataSchema = z.object({
  createdAt: z.string(),
  updatedAt: z.string(),
  generatedBy: z.literal('sstdream'),
});

export const BlueprintSchema = z.object({
  version: z.literal(BLUEPRINT_VERSION),
  target: TargetConfigSchema,
  app: AppConfigSchema,
  resources: z.array(ResourceSchema),
  connections: z.array(ConnectionSchema),
  secrets: z.array(SecretSchema).default([]),
  outputs: z.array(OutputSchema).default([]),
  metadata: MetadataSchema,
});
