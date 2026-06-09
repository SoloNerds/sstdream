import type { Blueprint, Resource } from '@/lib/core/blueprint/types';
import type { Diagnostic, ValidationRule } from '@/lib/core/validation/types';

// Vercel lane validation. Honesty rules from docs/vercel-target.md §10: queue needs a
// consumer, consumer needs a queue, app singleton, valid names.
const NAME_RE = /^[A-Z][A-Za-z0-9]*$/;
const APP_NAME_RE = /^[a-z][a-z0-9-]*$/;

function map(bp: Blueprint): Map<string, Resource> {
  return new Map(bp.resources.map((r) => [r.id, r]));
}

export const VERCEL_RULES: ValidationRule[] = [
  {
    id: 'app-name-valid',
    run: (bp) =>
      APP_NAME_RE.test(bp.app.name)
        ? []
        : [
            {
              rule: 'app-name-valid',
              severity: 'error',
              message: `App name "${bp.app.name}" is invalid.`,
              hint: 'Lowercase letters, numbers and dashes; start with a letter.',
            },
          ],
  },
  {
    id: 'empty-design',
    run: (bp) =>
      bp.resources.length === 0
        ? [
            {
              rule: 'empty-design',
              severity: 'warning',
              message: 'The design is empty — add resources before exporting.',
            },
          ]
        : [],
  },
  {
    id: 'unique-resource-names',
    run: (bp) => {
      const seen = new Set<string>();
      const out: Diagnostic[] = [];
      for (const r of bp.resources) {
        if (seen.has(r.name)) {
          out.push({
            rule: 'unique-resource-names',
            severity: 'error',
            resourceId: r.id,
            message: `Duplicate resource name "${r.name}".`,
          });
        }
        seen.add(r.name);
      }
      return out;
    },
  },
  {
    id: 'valid-resource-name',
    run: (bp) =>
      bp.resources
        .filter((r) => !NAME_RE.test(r.name))
        .map((r) => ({
          rule: 'valid-resource-name',
          severity: 'error' as const,
          resourceId: r.id,
          message: `Resource name "${r.name}" must be PascalCase (used for routes/identifiers).`,
        })),
  },
  {
    id: 'edge-intent-applicability',
    run: (bp, ctx) => {
      const byId = map(bp);
      const intents = new Map(ctx.target.edgeIntents.map((i) => [i.intent, i]));
      const out: Diagnostic[] = [];
      for (const c of bp.connections) {
        const meta = intents.get(c.intent);
        const src = byId.get(c.source);
        const tgt = byId.get(c.target);
        if (!meta || !src || !tgt) {
          out.push({
            rule: 'edge-intent-applicability',
            severity: 'error',
            connectionId: c.id,
            message: `Invalid connection "${c.intent}".`,
          });
          continue;
        }
        if (meta.from.length && !meta.from.includes(src.kind)) {
          out.push({
            rule: 'edge-intent-applicability',
            severity: 'error',
            connectionId: c.id,
            message: `"${meta.label}" cannot start from ${src.name} (${src.kind}).`,
          });
        }
        if (meta.to.length && !meta.to.includes(tgt.kind)) {
          out.push({
            rule: 'edge-intent-applicability',
            severity: 'error',
            connectionId: c.id,
            message: `"${meta.label}" cannot point to ${tgt.name} (${tgt.kind}).`,
          });
        }
      }
      return out;
    },
  },
  {
    id: 'single-app',
    run: (bp) =>
      bp.resources
        .filter((r) => r.kind === 'app')
        .slice(1)
        .map((a) => ({
          rule: 'single-app',
          severity: 'warning' as const,
          resourceId: a.id,
          message: `More than one Vercel app ("${a.name}").`,
        })),
  },
  {
    id: 'queue-needs-consumer',
    run: (bp) =>
      bp.resources
        .filter((r) => r.kind === 'queue')
        .filter((q) => !bp.connections.some((c) => c.source === q.id && c.intent === 'consumedBy'))
        .map((q) => ({
          rule: 'queue-needs-consumer',
          severity: 'warning' as const,
          resourceId: q.id,
          message: `Queue "${q.name}" has no consumer.`,
          hint: 'Connect Queue → Consumer (consumedBy).',
        })),
  },
  {
    id: 'consumer-needs-queue',
    run: (bp) =>
      bp.resources
        .filter((r) => r.kind === 'consumer')
        .filter((c) => !bp.connections.some((e) => e.target === c.id && e.intent === 'consumedBy'))
        .map((c) => ({
          rule: 'consumer-needs-queue',
          severity: 'error' as const,
          resourceId: c.id,
          message: `Consumer "${c.name}" is not attached to a queue.`,
          hint: 'Connect Queue → Consumer (consumedBy).',
        })),
  },
];
