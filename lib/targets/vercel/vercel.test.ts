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
