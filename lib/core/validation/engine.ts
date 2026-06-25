import type { Blueprint } from '@/lib/core/blueprint/types';
import type { Diagnostic, ValidationContext, ValidationResult, ValidationRule } from './types';

export function runRules(
  bp: Blueprint,
  rules: ValidationRule[],
  ctx: ValidationContext,
): ValidationResult {
  const diagnostics: Diagnostic[] = [];
  for (const rule of rules) {
    try {
      diagnostics.push(...rule.run(bp, ctx));
    } catch (err) {
      diagnostics.push({
        rule: rule.id,
        severity: 'error',
        message: `Validation rule "${rule.id}" crashed: ${(err as Error).message}`,
      });
    }
  }
  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');
  const infos = diagnostics.filter((d) => d.severity === 'info');
  return { diagnostics, errors, warnings, infos, ok: errors.length === 0 };
}
