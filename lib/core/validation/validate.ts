import { getTarget, isTargetImplemented } from '@/lib/targets/registry';
import { AWS_RULES } from '@/lib/targets/aws-sst-v4/validation';
import { runRules } from './engine';
import type { Blueprint } from '@/lib/core/blueprint/types';
import type { DeployTarget } from '@/lib/targets/types';
import type { ValidationResult, ValidationRule } from './types';

const RULES: Record<DeployTarget, ValidationRule[]> = {
  'aws-sst-v4': AWS_RULES,
  vercel: [], // filled in M10
};

const EMPTY: ValidationResult = {
  diagnostics: [],
  errors: [],
  warnings: [],
  infos: [],
  ok: true,
};

export function validateBlueprint(bp: Blueprint): ValidationResult {
  if (!isTargetImplemented(bp.target.deploy)) {
    return {
      ...EMPTY,
      diagnostics: [
        {
          rule: 'target-not-implemented',
          severity: 'info',
          message: `The "${bp.target.deploy}" lane is not implemented yet; nothing to validate.`,
        },
      ],
      infos: [
        {
          rule: 'target-not-implemented',
          severity: 'info',
          message: `The "${bp.target.deploy}" lane is not implemented yet; nothing to validate.`,
        },
      ],
    };
  }
  return runRules(bp, RULES[bp.target.deploy] ?? [], { target: getTarget(bp.target.deploy) });
}

export type { ValidationResult, Diagnostic } from './types';
