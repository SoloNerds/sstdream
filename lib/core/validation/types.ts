import type { Blueprint } from '@/lib/core/blueprint/types';
import type { Target } from '@/lib/targets/types';

export type Severity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  /** Rule id that produced this diagnostic. */
  rule: string;
  severity: Severity;
  message: string;
  /** Optional anchor for highlighting in the UI. */
  resourceId?: string;
  connectionId?: string;
  /** Optional human-readable fix hint. */
  hint?: string;
}

export interface ValidationContext {
  target: Target;
}

export interface ValidationRule {
  id: string;
  run: (bp: Blueprint, ctx: ValidationContext) => Diagnostic[];
}

export interface ValidationResult {
  diagnostics: Diagnostic[];
  errors: Diagnostic[];
  warnings: Diagnostic[];
  infos: Diagnostic[];
  /** True when there are no errors (export is allowed). */
  ok: boolean;
}
