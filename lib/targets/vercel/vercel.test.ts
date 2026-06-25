import { describe, it, expect } from 'vitest';
import { generateFiles } from '@/lib/core/codegen/generate';
import { validateBlueprint } from '@/lib/core/validation/validate';
import { buildExport } from '@/lib/core/export/manifest';
import { draftBlueprint, parseBlueprint } from '@/lib/core/blueprint/serialize';
import { VERCEL_SAAS } from '@/lib/templates/vercel-saas';

const NOW = '2026-06-08T00:00:00.000Z';
const bp = draftBlueprint(VERCEL_SAAS.snapshot, 'vercel', VERCEL_SAAS.app, NOW);
const files = generateFiles(bp);
const byPath = Object.fromEntries(files.map((f) => [f.path, f.content]));

describe('Vercel lane — generator', () => {
  it('emits routes, helpers, vercel.json, and the env manifest', () => {
    const paths = files.map((f) => f.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'lib/blob.ts',
        'app/actions/upload-file.ts',
        'lib/db.ts',
        'lib/queue.ts',
        'app/api/queues/worker/route.ts',
        'app/api/cron/daily/route.ts',
        'app/api/webhooks/stripe-hook/route.ts',
        'lib/email.ts',
        'vercel.json',
        'required-env.json',
        'package.additions.json',
      ]),
    );
  });

  it('uses verified, current Vercel APIs (not retired ones)', () => {
    expect(byPath['lib/blob.ts']).toContain('access: "public"');
    expect(byPath['lib/db.ts']).toContain('@neondatabase/serverless');
    expect(byPath['lib/db.ts']).not.toContain('@vercel/postgres');
    expect(byPath['app/api/queues/worker/route.ts']).toContain('handleCallback');
    const pkg = JSON.parse(byPath['package.additions.json']) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies)).toEqual(
      expect.arrayContaining([
        '@vercel/blob',
        '@neondatabase/serverless',
        '@vercel/queue',
        'resend',
        'stripe',
      ]),
    );
    expect(Object.keys(pkg.dependencies)).not.toContain('@vercel/kv');
  });

  it('wires vercel.json crons + queue triggers', () => {
    const vercelJson = JSON.parse(byPath['vercel.json']) as {
      crons: { path: string; schedule: string }[];
      functions: Record<string, { experimentalTriggers: { type: string; topic: string }[] }>;
    };
    expect(vercelJson.crons).toContainEqual({ path: '/api/cron/daily', schedule: '0 5 * * *' });
    const trigger = vercelJson.functions['app/api/queues/worker/route.ts'].experimentalTriggers[0];
    expect(trigger).toMatchObject({ type: 'queue/v2beta', topic: 'jobs' });
  });

  it('collects the right environment variables', () => {
    const env = JSON.parse(byPath['required-env.json']) as { required: { name: string }[] };
    const names = env.required.map((e) => e.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'NEXT_PUBLIC_APP_NAME',
        'BLOB_READ_WRITE_TOKEN',
        'DATABASE_URL',
        'STRIPE_WEBHOOK_SECRET',
        'CRON_SECRET',
      ]),
    );
  });
});

describe('Vercel lane — runnable project scaffold', () => {
  it('emits a complete Next.js project, not just fragments', () => {
    const paths = files.map((f) => f.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'package.json',
        'tsconfig.json',
        'next.config.ts',
        '.gitignore',
        'app/layout.tsx',
        'app/page.tsx',
        'AGENTS.md',
      ]),
    );
  });

  it('package.json is a real Next.js app (next/react + the service deps, no SST)', () => {
    const pkg = JSON.parse(byPath['package.json']) as {
      name: string;
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    expect(pkg.name).toBe('vercel-saas');
    expect(pkg.dependencies['next']).toBe('^16.0.0');
    expect(pkg.dependencies['react']).toBe('^19.0.0');
    // service deps from the design are merged in
    expect(pkg.dependencies['@neondatabase/serverless']).toBeDefined();
    expect(pkg.dependencies['@vercel/blob']).toBeDefined();
    // never SST on the Vercel lane
    expect(pkg.dependencies['sst']).toBeUndefined();
    expect(pkg.scripts.deploy).toBe('vercel --prod');
  });

  it('AGENTS.md documents the graph, the deploy flow, and the storage hard rule', () => {
    const agents = byPath['AGENTS.md'];
    expect(agents).toContain('deploys **natively on Vercel**');
    expect(agents).toContain('Git integration');
    expect(agents).toContain('stores files in'); // a data-flow edge label
    expect(agents).toContain('never `@vercel/kv` or `@vercel/postgres`');
  });

  it('the landing page lists the wired endpoints', () => {
    const page = byPath['app/page.tsx'];
    expect(page).toContain('GET /api/cron/daily');
    expect(page).toContain('POST /api/queues/worker (consumer)');
  });
});

describe('Vercel lane — editable props are wired into codegen', () => {
  const withProps = draftBlueprint(
    {
      nodes: [
        { id: 'a', kind: 'app', name: 'Web', props: {}, position: { x: 0, y: 0 } },
        {
          id: 'b',
          kind: 'blob',
          name: 'Files',
          props: { access: 'private' },
          position: { x: 1, y: 0 },
        },
        {
          id: 'm',
          kind: 'email',
          name: 'Mailer',
          props: { from: 'hi@acme.dev' },
          position: { x: 2, y: 0 },
        },
        { id: 'q', kind: 'queue', name: 'Jobs', props: {}, position: { x: 3, y: 0 } },
        {
          id: 'c',
          kind: 'consumer',
          name: 'Worker',
          props: { maxDuration: 120 },
          position: { x: 4, y: 0 },
        },
        {
          id: 'cr',
          kind: 'cron',
          name: 'Nightly',
          props: { schedule: '0 0 * * *' },
          position: { x: 5, y: 0 },
        },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b', intent: 'storesFileIn' },
        { id: 'e2', source: 'a', target: 'm', intent: 'sendsEmailThrough' },
        { id: 'e3', source: 'a', target: 'q', intent: 'enqueuesTo' },
        { id: 'e4', source: 'q', target: 'c', intent: 'consumedBy' },
      ],
    },
    'vercel',
    VERCEL_SAAS.app,
    NOW,
  );
  const m = Object.fromEntries(generateFiles(withProps).map((f) => [f.path, f.content]));

  it('blob access flows from the node prop', () => {
    expect(m['lib/blob.ts']).toContain('access: "private"');
  });

  it('email from-address flows from the node prop (escaped)', () => {
    expect(m['lib/email.ts']).toContain('from: "hi@acme.dev"');
  });

  it('cron schedule from the node prop reaches vercel.json', () => {
    const vj = JSON.parse(m['vercel.json']) as { crons: { path: string; schedule: string }[] };
    expect(vj.crons).toContainEqual({ path: '/api/cron/nightly', schedule: '0 0 * * *' });
  });

  it('consumer maxDuration reaches the vercel.json function config', () => {
    const vj = JSON.parse(m['vercel.json']) as {
      functions: Record<string, { maxDuration?: number }>;
    };
    expect(vj.functions['app/api/queues/worker/route.ts'].maxDuration).toBe(120);
  });

  it('a quote in a free-text prop is escaped, not injected', () => {
    const evil = draftBlueprint(
      {
        nodes: [
          { id: 'a', kind: 'app', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          {
            id: 'm',
            kind: 'email',
            name: 'Mailer',
            props: { from: 'a"; evil()//' },
            position: { x: 1, y: 0 },
          },
        ],
        edges: [{ id: 'e', source: 'a', target: 'm', intent: 'sendsEmailThrough' }],
      },
      'vercel',
      VERCEL_SAAS.app,
      NOW,
    );
    const lib = generateFiles(evil).find((f) => f.path === 'lib/email.ts')!.content;
    expect(lib).toContain('from: "a\\"; evil()//"');
  });
});

describe('Vercel lane — codegen robustness', () => {
  it('a generic webhook emits HMAC verification, not Stripe', () => {
    const bp = draftBlueprint(
      {
        nodes: [
          { id: 'a', kind: 'app', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          {
            id: 'w',
            kind: 'webhook',
            name: 'GithubHook',
            props: { provider: 'generic' },
            position: { x: 1, y: 0 },
          },
        ],
        edges: [],
      },
      'vercel',
      VERCEL_SAAS.app,
      NOW,
    );
    const out = Object.fromEntries(generateFiles(bp).map((f) => [f.path, f.content]));
    const route = out['app/api/webhooks/github-hook/route.ts'];
    expect(route).toContain('node:crypto');
    expect(route).toContain('timingSafeEqual');
    expect(route).toContain('GITHUB_HOOK_WEBHOOK_SECRET');
    expect(route).not.toContain('import Stripe');
    // env has the per-hook secret, not Stripe's
    const env = JSON.parse(out['required-env.json']) as { required: { name: string }[] };
    const names = env.required.map((e) => e.name);
    expect(names).toContain('GITHUB_HOOK_WEBHOOK_SECRET');
    expect(names).not.toContain('STRIPE_WEBHOOK_SECRET');
    // and stripe is NOT added as a dependency
    const pkg = JSON.parse(out['package.additions.json']) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['stripe']).toBeUndefined();
  });

  it('a Stripe webhook (default) still emits Stripe verification + deps', () => {
    expect(byPath['app/api/webhooks/stripe-hook/route.ts']).toContain('import Stripe');
    const pkg = JSON.parse(byPath['package.additions.json']) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['stripe']).toBeDefined();
  });

  it('the queue producer handles every queue, not just the first', () => {
    const bp = draftBlueprint(
      {
        nodes: [
          { id: 'a', kind: 'app', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          { id: 'q1', kind: 'queue', name: 'Jobs', props: {}, position: { x: 1, y: 0 } },
          { id: 'q2', kind: 'queue', name: 'Emails', props: {}, position: { x: 2, y: 0 } },
        ],
        edges: [],
      },
      'vercel',
      VERCEL_SAAS.app,
      NOW,
    );
    const queue = generateFiles(bp).find((f) => f.path === 'lib/queue.ts')!.content;
    expect(queue).toContain('"jobs": "jobs"');
    expect(queue).toContain('"emails": "emails"');
    expect(queue).toContain('export async function enqueue(topic: string, body: unknown)');
  });

  it('pins verified dependency versions instead of latest', () => {
    const pkg = JSON.parse(byPath['package.additions.json']) as {
      dependencies: Record<string, string>;
    };
    expect(Object.values(pkg.dependencies).every((v) => v !== 'latest')).toBe(true);
    expect(pkg.dependencies['@neondatabase/serverless']).toMatch(/^\^\d/);
    expect(pkg.dependencies['@vercel/queue']).toBe('^0.3.1');
  });
});

describe('Vercel lane — expanded catalog (Edge Config, External API, Analytics, Speed Insights)', () => {
  const bp = draftBlueprint(
    {
      nodes: [
        { id: 'a', kind: 'app', name: 'Web', props: {}, position: { x: 0, y: 0 } },
        { id: 'ec', kind: 'edgeConfig', name: 'Flags', props: {}, position: { x: 1, y: 0 } },
        {
          id: 'api',
          kind: 'externalApi',
          name: 'Weather',
          props: { baseUrlEnv: 'WEATHER_BASE_URL', keyEnv: 'WEATHER_API_KEY' },
          position: { x: 2, y: 0 },
        },
        { id: 'an', kind: 'analytics', name: 'Analytics', props: {}, position: { x: 3, y: 0 } },
        {
          id: 'si',
          kind: 'speedInsights',
          name: 'SpeedInsights',
          props: {},
          position: { x: 4, y: 0 },
        },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'ec', intent: 'readsConfig' },
        { id: 'e2', source: 'a', target: 'api', intent: 'callsApi' },
      ],
    },
    'vercel',
    VERCEL_SAAS.app,
    NOW,
  );
  const m = Object.fromEntries(generateFiles(bp).map((f) => [f.path, f.content]));

  it('Edge Config emits a helper + env + dep (first-party, not retired)', () => {
    expect(m['lib/edge-config.ts']).toContain('@vercel/edge-config');
    const env = JSON.parse(m['required-env.json']) as { required: { name: string }[] };
    expect(env.required.map((e) => e.name)).toContain('EDGE_CONFIG');
    const pkg = JSON.parse(m['package.additions.json']) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['@vercel/edge-config']).toBeDefined();
  });

  it('External API emits a typed fetch helper keyed on its name + its env vars', () => {
    expect(m['lib/weather.ts']).toContain('export async function weatherFetch');
    const env = JSON.parse(m['required-env.json']) as { required: { name: string }[] };
    const names = env.required.map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining(['WEATHER_BASE_URL', 'WEATHER_API_KEY']));
  });

  it('Analytics + Speed Insights inject into the layout + add deps', () => {
    const layout = m['app/layout.tsx'];
    expect(layout).toContain('import { Analytics } from "@vercel/analytics/next"');
    expect(layout).toContain('<Analytics />');
    expect(layout).toContain('import { SpeedInsights } from "@vercel/speed-insights/next"');
    expect(layout).toContain('<SpeedInsights />');
    const pkg = JSON.parse(m['package.additions.json']) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['@vercel/analytics']).toBeDefined();
    expect(pkg.dependencies['@vercel/speed-insights']).toBeDefined();
  });

  it('the design validates clean', () => {
    expect(validateBlueprint(bp).ok).toBe(true);
  });
});

describe('Vercel lane — AI Gateway + OG Image (verified ai@7 / next/og)', () => {
  const bp = draftBlueprint(
    {
      nodes: [
        { id: 'a', kind: 'app', name: 'Web', props: {}, position: { x: 0, y: 0 } },
        {
          id: 'ai',
          kind: 'aiGateway',
          name: 'Chat',
          props: { model: 'anthropic/claude-sonnet-4' },
          position: { x: 1, y: 0 },
        },
        { id: 'og', kind: 'ogImage', name: 'OgImage', props: {}, position: { x: 2, y: 0 } },
      ],
      edges: [],
    },
    'vercel',
    VERCEL_SAAS.app,
    NOW,
  );
  const m = Object.fromEntries(generateFiles(bp).map((f) => [f.path, f.content]));

  it('AI Gateway emits a v7 streaming chat route + client page, model from the prop', () => {
    const route = m['app/api/chat/route.ts'];
    expect(route).toContain('from "ai"');
    expect(route).toContain('convertToModelMessages');
    expect(route).toContain('toUIMessageStreamResponse');
    expect(route).toContain('model: "anthropic/claude-sonnet-4"'); // user prop, escaped
    expect(m['app/chat/page.tsx']).toContain('useChat'); // @ai-sdk/react v7 shape
    expect(m['app/chat/page.tsx']).toContain('DefaultChatTransport');
  });

  it('AI Gateway adds ai + @ai-sdk/react deps and the AI_GATEWAY_API_KEY env — no AI call in the builder', () => {
    const pkg = JSON.parse(m['package.additions.json']) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['ai']).toBe('^7.0.0');
    expect(pkg.dependencies['@ai-sdk/react']).toBe('^4.0.0');
    const env = JSON.parse(m['required-env.json']) as { required: { name: string }[] };
    expect(env.required.map((e) => e.name)).toContain('AI_GATEWAY_API_KEY');
  });

  it('OG Image emits an app/api/og route using next/og (flex, no edge runtime, 1200x630)', () => {
    const og = m['app/api/og/route.tsx'];
    expect(og).toContain('import { ImageResponse } from "next/og"');
    expect(og).toContain('width: 1200');
    expect(og).toContain('display: "flex"');
    expect(og).not.toContain("runtime = 'edge'");
  });

  it('rejects a second singleton kind (would collide on a fixed path)', () => {
    const two = draftBlueprint(
      {
        nodes: [
          { id: 'a', kind: 'app', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          { id: 'o1', kind: 'ogImage', name: 'OgImage', props: {}, position: { x: 1, y: 0 } },
          { id: 'o2', kind: 'ogImage', name: 'OgImage2', props: {}, position: { x: 2, y: 0 } },
        ],
        edges: [],
      },
      'vercel',
      VERCEL_SAAS.app,
      NOW,
    );
    expect(validateBlueprint(two).errors.some((d) => d.rule === 'singleton-kind')).toBe(true);
  });
});

describe('Vercel lane — Workflows (durable, verified workflow@4)', () => {
  const bp = draftBlueprint(
    {
      nodes: [
        { id: 'a', kind: 'app', name: 'Web', props: {}, position: { x: 0, y: 0 } },
        {
          id: 'wf',
          kind: 'workflow',
          name: 'OrderFulfillment',
          props: {},
          position: { x: 1, y: 0 },
        },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'wf', intent: 'triggersWorkflow' }],
    },
    'vercel',
    VERCEL_SAAS.app,
    NOW,
  );
  const m = Object.fromEntries(generateFiles(bp).map((f) => [f.path, f.content]));

  it('emits a durable workflow file with the directives INSIDE the function body', () => {
    const file = m['workflows/order-fulfillment.ts'];
    expect(file).toContain('import { sleep } from "workflow"');
    expect(file).toContain('"use workflow"');
    expect(file).toContain('"use step"');
    expect(file).toContain('export async function orderFulfillment(');
  });

  it('emits a non-blocking trigger route using start() from workflow/api', () => {
    const route = m['app/api/workflows/order-fulfillment/route.ts'];
    expect(route).toContain('import { start } from "workflow/api"');
    expect(route).toContain('from "@/workflows/order-fulfillment"');
    expect(route).toContain('await start(orderFulfillment, [input])');
  });

  it('wraps next.config with withWorkflow() (required for the directives to compile)', () => {
    expect(m['next.config.ts']).toContain('import { withWorkflow } from "workflow/next"');
    expect(m['next.config.ts']).toContain('export default withWorkflow(nextConfig)');
    const pkg = JSON.parse(m['package.additions.json']) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['workflow']).toBe('^4.5.0');
  });

  it('blocks two workflows that kebab-collide', () => {
    const two = draftBlueprint(
      {
        nodes: [
          { id: 'a', kind: 'app', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          { id: 'w1', kind: 'workflow', name: 'Sync', props: {}, position: { x: 1, y: 0 } },
          { id: 'w2', kind: 'workflow', name: 'SYNC', props: {}, position: { x: 2, y: 0 } },
        ],
        edges: [],
      },
      'vercel',
      VERCEL_SAAS.app,
      NOW,
    );
    expect(validateBlueprint(two).errors.some((d) => d.rule === 'kebab-path-collision')).toBe(true);
  });
});

describe('Vercel lane — Feature Flags + Rate Limit + after()', () => {
  it('Feature Flags emits flags.ts + the Flags Explorer discovery endpoint + FLAGS_SECRET', () => {
    const bp = draftBlueprint(
      {
        nodes: [
          { id: 'a', kind: 'app', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          { id: 'f', kind: 'featureFlags', name: 'Flags', props: {}, position: { x: 1, y: 0 } },
        ],
        edges: [{ id: 'e', source: 'a', target: 'f', intent: 'readsFlags' }],
      },
      'vercel',
      VERCEL_SAAS.app,
      NOW,
    );
    const m = Object.fromEntries(generateFiles(bp).map((f) => [f.path, f.content]));
    expect(m['flags.ts']).toContain('import { flag } from "flags/next"');
    expect(m['flags.ts']).toContain('decide:'); // static (not edge-config backed)
    expect(m['app/.well-known/vercel/flags/route.ts']).toContain('createFlagsDiscoveryEndpoint');
    const env = JSON.parse(m['required-env.json']) as { required: { name: string }[] };
    expect(env.required.map((e) => e.name)).toContain('FLAGS_SECRET');
    const pkg = JSON.parse(m['package.additions.json']) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['flags']).toBe('^4.2.0');
  });

  it('Feature Flags backed by Edge Config switches to the edgeConfigAdapter + its dep', () => {
    const bp = draftBlueprint(
      {
        nodes: [
          { id: 'a', kind: 'app', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          { id: 'f', kind: 'featureFlags', name: 'Flags', props: {}, position: { x: 1, y: 0 } },
          { id: 'ec', kind: 'edgeConfig', name: 'Config', props: {}, position: { x: 2, y: 0 } },
        ],
        edges: [
          { id: 'e1', source: 'a', target: 'f', intent: 'readsFlags' },
          { id: 'e2', source: 'f', target: 'ec', intent: 'flagsBackedBy' },
        ],
      },
      'vercel',
      VERCEL_SAAS.app,
      NOW,
    );
    const m = Object.fromEntries(generateFiles(bp).map((f) => [f.path, f.content]));
    expect(m['flags.ts']).toContain('edgeConfigAdapter()');
    const pkg = JSON.parse(m['package.additions.json']) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['@flags-sdk/edge-config']).toBeDefined();
  });

  it('Rate Limit emits a checkRateLimit guard (with the dashboard-rule prerequisite noted)', () => {
    const bp = draftBlueprint(
      {
        nodes: [
          { id: 'a', kind: 'app', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          { id: 'r', kind: 'rateLimit', name: 'RateLimit', props: {}, position: { x: 1, y: 0 } },
        ],
        edges: [],
      },
      'vercel',
      VERCEL_SAAS.app,
      NOW,
    );
    const m = Object.fromEntries(generateFiles(bp).map((f) => [f.path, f.content]));
    expect(m['lib/rate-limit.ts']).toContain('import { checkRateLimit } from "@vercel/firewall"');
    expect(m['lib/rate-limit.ts']).toContain('dashboard'); // documents the prereq
    const pkg = JSON.parse(m['package.additions.json']) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['@vercel/firewall']).toBe('^1.2.1');
  });

  it('Background Task emits an after() example (no package — built into next/server)', () => {
    const bp = draftBlueprint(
      {
        nodes: [
          { id: 'a', kind: 'app', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          {
            id: 'b',
            kind: 'afterResponse',
            name: 'Background',
            props: {},
            position: { x: 1, y: 0 },
          },
        ],
        edges: [],
      },
      'vercel',
      VERCEL_SAAS.app,
      NOW,
    );
    const m = Object.fromEntries(generateFiles(bp).map((f) => [f.path, f.content]));
    expect(m['app/actions/background-task.ts']).toContain('import { after } from "next/server"');
    expect(m['app/actions/background-task.ts']).toContain('after(async () =>');
  });
});

describe('Vercel lane — honesty validation rules (docs §10)', () => {
  const mk = (
    nodes: { id: string; kind: string; name: string; props?: Record<string, unknown> }[],
    edges: { id: string; source: string; target: string; intent: string }[] = [],
  ) =>
    draftBlueprint(
      {
        nodes: nodes.map((n) => ({ ...n, props: n.props ?? {}, position: { x: 0, y: 0 } })),
        edges,
      },
      'vercel',
      VERCEL_SAAS.app,
      NOW,
    );
  const rules = (bp: ReturnType<typeof mk>, rule: string) =>
    validateBlueprint(bp).diagnostics.filter((d) => d.rule === rule);

  it('rejects a non-numeric / malformed cron schedule', () => {
    expect(
      rules(
        mk([{ id: 'c', kind: 'cron', name: 'Daily', props: { schedule: 'every day' } }]),
        'cron-schedule-format',
      ),
    ).toHaveLength(1);
    expect(
      rules(
        mk([{ id: 'c', kind: 'cron', name: 'Daily', props: { schedule: '0 5 * MON *' } }]),
        'cron-schedule-format',
      ),
    ).toHaveLength(1);
    // both day-of-month and day-of-week set
    expect(
      rules(
        mk([{ id: 'c', kind: 'cron', name: 'Daily', props: { schedule: '0 5 1 * 1' } }]),
        'cron-schedule-format',
      ),
    ).toHaveLength(1);
    // a valid daily schedule passes
    expect(
      rules(
        mk([{ id: 'c', kind: 'cron', name: 'Daily', props: { schedule: '0 5 * * *' } }]),
        'cron-schedule-format',
      ),
    ).toHaveLength(0);
  });

  it('warns about a sub-daily cron (Hobby allows once/day)', () => {
    expect(
      rules(
        mk([{ id: 'c', kind: 'cron', name: 'Often', props: { schedule: '*/5 * * * *' } }]),
        'cron-frequency',
      ),
    ).toHaveLength(1);
    expect(
      rules(
        mk([{ id: 'c', kind: 'cron', name: 'Daily', props: { schedule: '0 5 * * *' } }]),
        'cron-frequency',
      ),
    ).toHaveLength(0);
  });

  it('warns when a consumer maxDuration exceeds the plan max', () => {
    expect(
      rules(
        mk([{ id: 'c', kind: 'consumer', name: 'W', props: { maxDuration: 900 } }]),
        'consumer-max-duration',
      ),
    ).toHaveLength(1);
    expect(
      rules(
        mk([{ id: 'c', kind: 'consumer', name: 'W', props: { maxDuration: 300 } }]),
        'consumer-max-duration',
      ),
    ).toHaveLength(0);
  });

  it('blocks two crons whose names kebab to the same route', () => {
    const bp = mk([
      { id: 'c1', kind: 'cron', name: 'Daily' },
      { id: 'c2', kind: 'cron', name: 'DAIly' },
    ]);
    expect(rules(bp, 'kebab-path-collision')).toHaveLength(1);
    expect(validateBlueprint(bp).ok).toBe(false);
  });

  it('notes a standard app needs no vercel.json (only when nothing requires one)', () => {
    expect(
      rules(
        mk([
          { id: 'a', kind: 'app', name: 'Web' },
          { id: 'b', kind: 'blob', name: 'Files' },
        ]),
        'standard-app-no-vercel-json',
      ),
    ).toHaveLength(1);
    // a design with a cron DOES need vercel.json — no info
    expect(
      rules(mk([{ id: 'c', kind: 'cron', name: 'Daily' }]), 'standard-app-no-vercel-json'),
    ).toHaveLength(0);
  });
});

describe('Vercel lane — validation + export', () => {
  it('validates the SaaS template clean', () => {
    expect(validateBlueprint(bp).ok).toBe(true);
  });

  it('flags a queue with no consumer', () => {
    const broken = draftBlueprint(
      {
        nodes: [
          { id: 'a1', kind: 'app', name: 'Web', props: {}, position: { x: 0, y: 0 } },
          { id: 'q1', kind: 'queue', name: 'Jobs', props: {}, position: { x: 1, y: 0 } },
        ],
        edges: [{ id: 'e1', source: 'a1', target: 'q1', intent: 'enqueuesTo' }],
      },
      'vercel',
      VERCEL_SAAS.app,
      NOW,
    );
    expect(validateBlueprint(broken).warnings.some((d) => d.rule === 'queue-needs-consumer')).toBe(
      true,
    );
  });

  it('exports a README with the Vercel deploy flow and a round-trippable design', () => {
    const out = buildExport(bp);
    const m = Object.fromEntries(out.map((f) => [f.path, f.content]));
    expect(m['README.md']).toContain('vercel --prod');
    expect(m['README.md']).toContain('vercel install neon');
    expect(parseBlueprint(m['sstdream.design.json'])).toEqual(bp);
  });
});
