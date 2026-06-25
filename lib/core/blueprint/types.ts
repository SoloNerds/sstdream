import type { z } from 'zod';
import type {
  AppConfigSchema,
  BlueprintSchema,
  ConnectionSchema,
  OutputSchema,
  ResourceSchema,
  SecretSchema,
  StagePolicySchema,
  TargetConfigSchema,
} from './schema';

export type Blueprint = z.infer<typeof BlueprintSchema>;
export type TargetConfig = z.infer<typeof TargetConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;
export type StagePolicy = z.infer<typeof StagePolicySchema>;
export type Resource = z.infer<typeof ResourceSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;
export type Secret = z.infer<typeof SecretSchema>;
export type Output = z.infer<typeof OutputSchema>;
