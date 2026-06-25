import type { Blueprint, Resource } from '@/lib/core/blueprint/types';
import type { Diagnostic, ValidationRule } from '@/lib/core/validation/types';
import { kebabCase } from '@/lib/core/codegen/strings';

// Vercel lane validation. Honesty rules from docs/vercel-target.md §10: queue needs a
// consumer, consumer needs a queue, app singleton, valid names, cron format/frequency,
// function duration vs plan, route path collisions, zero-config note.
const NAME_RE = /^[A-Z][A-Za-z0-9]*$/;
const APP_NAME_RE = /^[a-z][a-z0-9-]*$/;

function map(bp: Blueprint): Map<string, Resource> {
  return new Map(bp.resources.map((r) => [r.id, r]));
}

const cronSchedule = (r: Resource): string =>
  typeof r.props.schedule === 'string' && r.props.schedule ? r.props.schedule : '0 5 * * *';

// A Vercel cron schedule (docs §5): standard 5 fields, UTC, NUMERIC ONLY (no
// MON/JAN), and you cannot set BOTH day-of-month and day-of-week (one must be *).
function parseCron(schedule: string): { ok: boolean; reason?: string; subDaily?: boolean } {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) return { ok: false, reason: 'must have exactly 5 fields' };
  if (/[a-zA-Z]/.test(schedule)) return { ok: false, reason: 'numeric only (no MON/JAN names)' };
  if (!fields.every((f) => /^[\d*/,-]+$/.test(f)))
    return { ok: false, reason: 'fields may only use digits and * , - /' };
  const [min, hour, dom, , dow] = fields;
  if (dom !== '*' && dow !== '*')
    return { ok: false, reason: 'cannot set both day-of-month and day-of-week (one must be *)' };
  // "Once per day" needs a single specific minute AND hour; anything looser is sub-daily.
  const single = (f: string) => /^\d+$/.test(f);
  return { ok: true, subDaily: !(single(min) && single(hour)) };
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
  {
    // docs §5: 5-field UTC cron, numeric only, not both DOM and DOW. A bad
    // schedule passes the build and fails silently at deploy.
    id: 'cron-schedule-format',
    run: (bp) => {
      const out: Diagnostic[] = [];
      for (const c of bp.resources.filter((r) => r.kind === 'cron')) {
        const schedule = cronSchedule(c);
        const parsed = parseCron(schedule);
        if (!parsed.ok) {
          out.push({
            rule: 'cron-schedule-format',
            severity: 'error',
            resourceId: c.id,
            message: `Cron "${c.name}" schedule "${schedule}" is invalid: ${parsed.reason}.`,
            hint: 'Use a 5-field UTC cron, e.g. "0 5 * * *" (daily at 05:00).',
          });
        }
      }
      return out;
    },
  },
  {
    // docs §5: Hobby plan crons run at most once/day. Sub-daily needs Pro/Ent.
    id: 'cron-frequency',
    run: (bp) => {
      const out: Diagnostic[] = [];
      for (const c of bp.resources.filter((r) => r.kind === 'cron')) {
        const parsed = parseCron(cronSchedule(c));
        if (parsed.ok && parsed.subDaily) {
          out.push({
            rule: 'cron-frequency',
            severity: 'warning',
            resourceId: c.id,
            message: `Cron "${c.name}" runs more than once per day.`,
            hint: 'The Hobby plan allows once/day; sub-daily schedules need Pro/Enterprise.',
          });
        }
      }
      return out;
    },
  },
  {
    // docs §3: with Fluid Compute the function max is ~800s on Pro/Enterprise.
    id: 'consumer-max-duration',
    run: (bp) =>
      bp.resources
        .filter((r) => r.kind === 'consumer')
        .filter((c) => {
          const md = Number(c.props.maxDuration);
          return Number.isFinite(md) && md > 800;
        })
        .map((c) => ({
          rule: 'consumer-max-duration',
          severity: 'warning' as const,
          resourceId: c.id,
          message: `Consumer "${c.name}" maxDuration (${String(c.props.maxDuration)}s) exceeds the plan maximum (~800s).`,
          hint: 'Cap it at 800s, or move long-running work to Vercel Workflows.',
        })),
  },
  {
    // Routes are app/api/<group>/<kebab(name)>/route.ts. kebabCase is many-to-one,
    // so two same-kind nodes with distinct names can collide on one route and the
    // export drops a file. (Cross-kind paths are namespaced — no collision.)
    id: 'kebab-path-collision',
    run: (bp) => {
      const GROUPS: Record<string, string> = {
        cron: 'cron',
        consumer: 'queues',
        webhook: 'webhooks',
        externalApi: 'lib', // lib/<slug>.ts helpers can collide too
      };
      const out: Diagnostic[] = [];
      const seen = new Map<string, Resource>();
      for (const r of bp.resources.filter((r) => GROUPS[r.kind])) {
        const key = `${GROUPS[r.kind]}/${kebabCase(r.name)}`;
        const prev = seen.get(key);
        if (prev && prev.id !== r.id) {
          out.push({
            rule: 'kebab-path-collision',
            severity: 'error',
            resourceId: r.id,
            message: `"${r.name}" and "${prev.name}" both generate the route "/api/${key}" — the export would drop one.`,
            hint: 'Rename one so they differ by more than letter case.',
          });
        } else {
          seen.set(key, r);
        }
      }
      return out;
    },
  },
  {
    // docs §0/§10: a standard app needs no vercel.json — say so when nothing
    // requires one (no crons, no queue-consumer triggers).
    id: 'standard-app-no-vercel-json',
    run: (bp) => {
      if (bp.resources.length === 0) return [];
      const needsConfig = bp.resources.some((r) => r.kind === 'cron' || r.kind === 'consumer');
      return needsConfig
        ? []
        : [
            {
              rule: 'standard-app-no-vercel-json',
              severity: 'info',
              message:
                'No crons or queue consumers — this app needs no vercel.json (zero-config deploy).',
            },
          ];
    },
  },
];
