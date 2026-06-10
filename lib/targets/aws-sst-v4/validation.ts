import type { Blueprint, Resource } from '@/lib/core/blueprint/types';
import type { Diagnostic, ValidationRule } from '@/lib/core/validation/types';
import { camelCase } from '@/lib/core/codegen/strings';

// AWS / SST v4 design-level validation rules. Code-shape guarantees (no legacy
// imports, resources-in-run, Queue.subscribe subscriber-first, CronV2 not Cron)
// are enforced by the generator + its snapshot tests (M4); these rules check the
// design graph that the generator consumes. See docs/sst-v4-target.md §6.

const NAME_RE = /^[A-Z][A-Za-z0-9]*$/;
const APP_NAME_RE = /^[a-z][a-z0-9-]*$/;
// Generated runtime code uses table keys as TS identifiers (types, variables).
const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const SCHEDULE_RE = /^(rate|cron|at)\(.+\)$/;
const ROUTE_RE = /^(GET|POST|PUT|PATCH|DELETE|ANY|OPTIONS|HEAD) \/[\w\-./{}+]*$|^\$default$/;
// Env-var names land in identifier position (process.env.<name>) and .env files.
const ENV_NAME_RE = /^[A-Z_][A-Z0-9_]*$/;
// camelCase(resource name) becomes a `const` in sst.config.ts — JS reserved
// words and generator-owned names would emit broken or shadowed declarations.
const RESERVED_VARS = new Set([
  'vpc',
  'implements',
  'interface',
  'package',
  'private',
  'protected',
  'public',
  'eval',
  'arguments',
  'function',
  'class',
  'const',
  'let',
  'var',
  'return',
  'delete',
  'new',
  'void',
  'this',
  'super',
  'switch',
  'case',
  'catch',
  'finally',
  'for',
  'while',
  'do',
  'if',
  'else',
  'in',
  'instanceof',
  'typeof',
  'export',
  'import',
  'default',
  'extends',
  'static',
  'yield',
  'await',
  'enum',
  'null',
  'true',
  'false',
  'with',
  'debugger',
  'break',
  'continue',
  'throw',
  'try',
]);

// Locals/imports the generated create-form.tsx declares — a table key with one
// of these names would redeclare them in the same scope.
const FORM_LOCALS = new Set(['router', 'pending', 'create', 'get', 'list', 'update', 'remove']);

function resourceMap(bp: Blueprint): Map<string, Resource> {
  return new Map(bp.resources.map((r) => [r.id, r]));
}

export const AWS_RULES: ValidationRule[] = [
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
              hint: 'Lowercase letters, numbers and dashes; start with a letter (e.g. ai-processing-app).',
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
            message: `Duplicate resource name "${r.name}". SST component names must be unique.`,
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
          message: `Resource name "${r.name}" is not a valid SST component name.`,
          hint: 'Use PascalCase letters/numbers, e.g. "Uploads".',
        })),
  },
  {
    id: 'edge-intent-applicability',
    run: (bp, ctx) => {
      const map = resourceMap(bp);
      const intents = new Map(ctx.target.edgeIntents.map((i) => [i.intent, i]));
      const out: Diagnostic[] = [];
      for (const c of bp.connections) {
        const meta = intents.get(c.intent);
        if (!meta) {
          out.push({
            rule: 'edge-intent-applicability',
            severity: 'error',
            connectionId: c.id,
            message: `Unknown connection intent "${c.intent}".`,
          });
          continue;
        }
        const src = map.get(c.source);
        const tgt = map.get(c.target);
        if (!src || !tgt) {
          out.push({
            rule: 'edge-intent-applicability',
            severity: 'error',
            connectionId: c.id,
            message: 'Connection references a missing resource.',
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
    id: 'cron-needs-function',
    run: (bp) =>
      bp.resources
        .filter((r) => r.kind === 'cron')
        .filter((c) => !bp.connections.some((e) => e.source === c.id && e.intent === 'invokes'))
        .map((c) => ({
          rule: 'cron-needs-function',
          severity: 'error' as const,
          resourceId: c.id,
          message: `Cron "${c.name}" has no function to invoke.`,
          hint: 'Connect Cron → Worker (invokes).',
        })),
  },
  {
    id: 'queue-needs-subscriber',
    run: (bp) =>
      bp.resources
        .filter((r) => r.kind === 'queue' || r.kind === 'bus' || r.kind === 'snstopic')
        .filter(
          (q) => !bp.connections.some((c) => c.target === q.id && c.intent === 'subscribesTo'),
        )
        .map((q) => {
          const word = q.kind === 'queue' ? 'Queue' : q.kind === 'bus' ? 'Event bus' : 'SNS topic';
          return {
            rule: 'queue-needs-subscriber',
            severity: 'warning' as const,
            resourceId: q.id,
            message: `${word} "${q.name}" has no worker subscribing to it.`,
            hint: 'Connect a Worker (subscribesTo), or messages will have no consumer.',
          };
        }),
  },
  {
    id: 'worker-needs-trigger',
    run: (bp) =>
      bp.resources
        .filter((r) => r.kind === 'worker')
        .filter(
          (w) =>
            !bp.connections.some((c) => c.source === w.id && c.intent === 'subscribesTo') &&
            !bp.connections.some((c) => c.target === w.id && c.intent === 'invokes') &&
            !bp.connections.some((c) => c.source === w.id && c.intent === 'handlesRoute') &&
            !bp.connections.some((c) => c.source === w.id && c.intent === 'handlesBucketEvents'),
        )
        .map((w) => ({
          rule: 'worker-needs-trigger',
          severity: 'warning' as const,
          resourceId: w.id,
          message: `Worker "${w.name}" is not triggered by a queue, cron, API route, or bucket event.`,
          hint: 'Wire it to a Queue/Bus/Topic (subscribesTo), a Cron (invokes), an HTTP API (handlesRoute), or a Bucket (handlesBucketEvents).',
        })),
  },
  {
    // The generator wires exactly ONE trigger per worker (plan.ts resolves the
    // first match); extra triggers would be silently dropped or cross-wired.
    id: 'worker-single-trigger',
    run: (bp) => {
      const out: Diagnostic[] = [];
      for (const w of bp.resources.filter((r) => r.kind === 'worker')) {
        const outgoing = bp.connections.filter((c) => c.source === w.id);
        const subs = outgoing.filter((c) => c.intent === 'subscribesTo').length;
        const routes = outgoing.filter((c) => c.intent === 'handlesRoute').length;
        const buckets = outgoing.filter((c) => c.intent === 'handlesBucketEvents').length;
        const cron = bp.connections.some((c) => c.target === w.id && c.intent === 'invokes');
        const roles = [subs > 0, routes > 0, buckets > 0, cron].filter(Boolean).length;
        if (roles > 1 || subs > 1 || routes > 1 || buckets > 1) {
          out.push({
            rule: 'worker-single-trigger',
            severity: 'error',
            resourceId: w.id,
            message: `Worker "${w.name}" has multiple triggers — the export wires exactly one (subscriber, API route, bucket events, or cron) and would drop the rest.`,
            hint: 'Give each trigger its own worker node.',
          });
        }
      }
      return out;
    },
  },
  {
    // Resources whose kind isn't in the catalog (hand-edited imports, lane
    // mixups) used to vanish silently from the export.
    id: 'known-resource-kind',
    run: (bp, ctx) =>
      bp.resources
        .filter((r) => !(r.kind in ctx.target.catalog))
        .map((r) => ({
          rule: 'known-resource-kind',
          severity: 'error' as const,
          resourceId: r.id,
          message: `"${r.name}" has unknown resource kind "${r.kind}" — the export would silently drop it.`,
          hint: 'Re-create the node from the palette, or fix the kind in the imported design.',
        })),
  },
  {
    // camelCase(name) becomes a `const` in sst.config.ts: reserved words emit
    // unparseable code; two names that camelCase identically collide.
    id: 'var-name-collision',
    run: (bp) => {
      // Mirror plan.ts: only these kinds (plus untriggered workers) become
      // `const` declarations in sst.config.ts.
      const DECLARED = new Set([
        'secret',
        'ai',
        'email',
        'cognito',
        'bucket',
        'dynamo',
        'postgres',
        'aurora',
        'queue',
        'bus',
        'snstopic',
        'apigatewayv2',
        'router',
        'nextjs',
        'staticsite',
      ]);
      const isTriggered = (w: Resource) =>
        bp.connections.some(
          (c) =>
            (c.source === w.id &&
              (c.intent === 'subscribesTo' ||
                c.intent === 'handlesRoute' ||
                c.intent === 'handlesBucketEvents')) ||
            (c.target === w.id && c.intent === 'invokes'),
        );
      const declares = (r: Resource) =>
        DECLARED.has(r.kind) || (r.kind === 'worker' && !isTriggered(r));

      const out: Diagnostic[] = [];
      const seen = new Map<string, Resource>();
      const claim = (v: string, r: Resource) => {
        if (RESERVED_VARS.has(v)) {
          out.push({
            rule: 'var-name-collision',
            severity: 'error',
            resourceId: r.id,
            message: `"${r.name}" would generate the variable "${v}", which is reserved.`,
            hint: 'Rename the resource (e.g. "ApiFunction" instead of "Function").',
          });
          return;
        }
        const prev = seen.get(v);
        if (prev && prev.id !== r.id) {
          out.push({
            rule: 'var-name-collision',
            severity: 'error',
            resourceId: r.id,
            message: `"${r.name}" and "${prev.name}" both generate the variable "${v}" — the export would not compile.`,
            hint: 'Rename one of them.',
          });
        } else {
          seen.set(v, r);
        }
      };
      for (const r of bp.resources.filter(declares)) {
        claim(camelCase(r.name), r);
        // renderCognito also declares `<var>Client = <var>.addClient("Web")`.
        if (r.kind === 'cognito') claim(`${camelCase(r.name)}Client`, r);
      }
      return out;
    },
  },
  {
    // hashKey/rangeKey become TS identifiers AND local variables in the
    // generated CRUD form (GSI names/keys are always emitted quoted — exempt).
    id: 'dynamo-keys-identifier-safe',
    run: (bp) => {
      const out: Diagnostic[] = [];
      const KEYS = ['hashKey', 'rangeKey'] as const;
      for (const r of bp.resources.filter((x) => x.kind === 'dynamo')) {
        for (const k of KEYS) {
          const v = r.props[k];
          if (typeof v !== 'string' || !v) continue;
          const bad =
            !IDENT_RE.test(v) || RESERVED_VARS.has(v) || FORM_LOCALS.has(v) || v === 'setPending';
          if (bad) {
            out.push({
              rule: 'dynamo-keys-identifier-safe',
              severity: 'error',
              resourceId: r.id,
              message: `Table "${r.name}" ${k} "${v}" cannot be used as a variable in the generated code.`,
              hint: 'Use letters/digits/underscore, starting with a letter, avoiding reserved words (e.g. userId).',
            });
          }
        }
      }
      return out;
    },
  },
  {
    // Half-configured GSIs silently degraded to "no GSI" in the export.
    id: 'gsi-complete',
    run: (bp) => {
      const out: Diagnostic[] = [];
      for (const r of bp.resources.filter((x) => x.kind === 'dynamo')) {
        const name = typeof r.props.gsiName === 'string' && r.props.gsiName;
        const hash = typeof r.props.gsiHashKey === 'string' && r.props.gsiHashKey;
        const range = typeof r.props.gsiRangeKey === 'string' && r.props.gsiRangeKey;
        if ((name || hash || range) && !(name && hash)) {
          out.push({
            rule: 'gsi-complete',
            severity: 'error',
            resourceId: r.id,
            message: `Table "${r.name}" has a half-configured GSI — set both the index name and its hash key (or clear all GSI fields).`,
          });
        }
      }
      return out;
    },
  },
  {
    // baseUrlEnv/keyEnv are emitted as process.env.<name> and .env lines.
    id: 'env-var-name-format',
    run: (bp) => {
      const out: Diagnostic[] = [];
      for (const r of bp.resources.filter((x) => x.kind === 'externalApi')) {
        for (const k of ['baseUrlEnv', 'keyEnv'] as const) {
          const v = r.props[k];
          if (typeof v === 'string' && v && !ENV_NAME_RE.test(v)) {
            out.push({
              rule: 'env-var-name-format',
              severity: 'error',
              resourceId: r.id,
              message: `"${r.name}" ${k} "${v}" is not a valid env var name — generated code would not compile.`,
              hint: 'Use UPPER_SNAKE_CASE (e.g. API_BASE_URL).',
            });
          }
        }
      }
      return out;
    },
  },
  {
    // Free-text schedules that aren't rate()/cron()/at() fail `sst deploy`.
    id: 'cron-schedule-format',
    run: (bp) => {
      const out: Diagnostic[] = [];
      for (const c of bp.resources.filter((r) => r.kind === 'cron')) {
        const schedule = typeof c.props.schedule === 'string' ? c.props.schedule : '';
        if (schedule && !SCHEDULE_RE.test(schedule)) {
          out.push({
            rule: 'cron-schedule-format',
            severity: 'error',
            resourceId: c.id,
            message: `Cron "${c.name}" schedule "${schedule}" is invalid — AWS accepts rate(...), cron(...), or at(...).`,
            hint: 'e.g. rate(1 day), cron(0 12 * * ? *), at(2026-01-01T00:00:00)',
          });
        }
      }
      return out;
    },
  },
  {
    // Route keys must be "METHOD /path" (or $default); duplicates on one API
    // overwrite each other at deploy.
    id: 'route-format-and-unique',
    run: (bp) => {
      const out: Diagnostic[] = [];
      const seen = new Map<string, Resource>();
      for (const w of bp.resources.filter((r) => r.kind === 'worker')) {
        const edge = bp.connections.find((c) => c.source === w.id && c.intent === 'handlesRoute');
        if (!edge) continue;
        const route = typeof w.props.route === 'string' && w.props.route ? w.props.route : 'GET /';
        if (!ROUTE_RE.test(route)) {
          out.push({
            rule: 'route-format-and-unique',
            severity: 'error',
            resourceId: w.id,
            message: `Worker "${w.name}" route "${route}" is invalid — use "METHOD /path" (e.g. "POST /webhooks") or "$default".`,
          });
          continue;
        }
        const key = `${edge.target}::${route}`;
        const prev = seen.get(key);
        if (prev) {
          out.push({
            rule: 'route-format-and-unique',
            severity: 'error',
            resourceId: w.id,
            message: `Workers "${prev.name}" and "${w.name}" both handle "${route}" on the same API — routes must be unique.`,
            hint: 'Change one route (workers default to "GET /").',
          });
        } else {
          seen.set(key, w);
        }
      }
      return out;
    },
  },
  {
    // StaticSite build needs BOTH command and output; one without the other
    // silently degraded to "no build" in the export.
    id: 'staticsite-build-complete',
    run: (bp) => {
      const out: Diagnostic[] = [];
      for (const r of bp.resources.filter((x) => x.kind === 'staticsite')) {
        const cmd = typeof r.props.buildCommand === 'string' && r.props.buildCommand;
        const dir = typeof r.props.buildOutput === 'string' && r.props.buildOutput;
        if ((cmd && !dir) || (!cmd && dir)) {
          out.push({
            rule: 'staticsite-build-complete',
            severity: 'error',
            resourceId: r.id,
            message: `Static site "${r.name}" has a half-configured build — set both the command and the output dir (or clear both).`,
          });
        }
      }
      return out;
    },
  },
  {
    // CronV2 has a single `function:` — plan.ts wires the FIRST invokes edge
    // and any extra target would vanish from the export.
    id: 'cron-single-function',
    run: (bp) => {
      const out: Diagnostic[] = [];
      for (const c of bp.resources.filter((r) => r.kind === 'cron')) {
        const invokes = bp.connections.filter((e) => e.source === c.id && e.intent === 'invokes');
        if (invokes.length > 1) {
          out.push({
            rule: 'cron-single-function',
            severity: 'error',
            resourceId: c.id,
            message: `Cron "${c.name}" invokes ${invokes.length} workers — the export wires exactly one and would drop the rest.`,
            hint: 'Add one cron node per worker (CronV2 has a single function).',
          });
        }
      }
      return out;
    },
  },
  {
    // Verified (docs/sst-v4-target.md §5): SNS Lambda triggers support STANDARD
    // topics only — subscribing a worker to a FIFO topic fails at deploy.
    id: 'snstopic-fifo-no-lambda',
    run: (bp) => {
      const byId = resourceMap(bp);
      const out: Diagnostic[] = [];
      for (const c of bp.connections.filter((e) => e.intent === 'subscribesTo')) {
        const topic = byId.get(c.target);
        if (topic?.kind === 'snstopic' && topic.props.fifo === true) {
          const worker = byId.get(c.source);
          out.push({
            rule: 'snstopic-fifo-no-lambda',
            severity: 'error',
            resourceId: topic.id,
            message: `FIFO topic "${topic.name}" has a Lambda subscriber${worker ? ` ("${worker.name}")` : ''} — AWS only supports standard topics as Lambda triggers.`,
            hint: 'Turn off fifo, or have the worker consume via a Queue subscribed to the topic.',
          });
        }
      }
      return out;
    },
  },
  {
    id: 'routed-bucket-cloudfront',
    run: (bp) =>
      bp.connections
        .filter((c) => c.intent === 'routesBucket')
        .map((c) => bp.resources.find((r) => r.id === c.target))
        .filter((b) => b && b.props.access !== 'cloudfront')
        .map((b) => ({
          rule: 'routed-bucket-cloudfront',
          // error: a Router serving a private bucket ships a 403ing site.
          severity: 'error' as const,
          resourceId: b!.id,
          message: `Bucket "${b!.name}" is routed by a Router but its access isn't "cloudfront".`,
          hint: 'Set the bucket access to CloudFront so the Router can serve it.',
        })),
  },
  {
    id: 'orphan-secret',
    run: (bp) =>
      bp.resources
        .filter((r) => r.kind === 'secret')
        .filter((s) => !bp.connections.some((c) => c.target === s.id && c.intent === 'usesSecret'))
        .map((s) => ({
          rule: 'orphan-secret',
          severity: 'warning' as const,
          resourceId: s.id,
          message: `Secret "${s.name}" is not linked to anything.`,
          hint: 'Connect a resource → Secret (usesSecret).',
        })),
  },
  {
    id: 'unused-storage',
    run: (bp) => {
      const connected = new Set<string>();
      for (const c of bp.connections) {
        connected.add(c.source);
        connected.add(c.target);
      }
      return bp.resources
        .filter((r) => (r.kind === 'bucket' || r.kind === 'dynamo') && !connected.has(r.id))
        .map((r) => ({
          rule: 'unused-storage',
          severity: 'warning' as const,
          resourceId: r.id,
          message: `${r.kind === 'bucket' ? 'Bucket' : 'Table'} "${r.name}" is not linked to anything and will be unused.`,
        }));
    },
  },
  {
    id: 'single-nextjs',
    run: (bp) => {
      const apps = bp.resources.filter((r) => r.kind === 'nextjs');
      return apps.slice(1).map((a) => ({
        rule: 'single-nextjs',
        severity: 'warning' as const,
        resourceId: a.id,
        message: `More than one Next.js app ("${a.name}"). The MVP exports a single web app.`,
      }));
    },
  },
  {
    id: 'production-removal-retain',
    run: (bp) => {
      const prod = bp.app.stages.find((s) => s.name === 'production');
      return prod && prod.removal && prod.removal !== 'retain'
        ? [
            {
              rule: 'production-removal-retain',
              severity: 'warning',
              message: `Production removal is "${prod.removal}". Production should usually be "retain" to avoid data loss.`,
            },
          ]
        : [];
    },
  },
  {
    id: 'production-protect',
    run: (bp) => {
      const prod = bp.app.stages.find((s) => s.name === 'production');
      return prod && prod.protect !== true
        ? [
            {
              rule: 'production-protect',
              severity: 'warning',
              message: 'Production "protect" is off. Enable it to block accidental `sst remove`.',
            },
          ]
        : [];
    },
  },
];
