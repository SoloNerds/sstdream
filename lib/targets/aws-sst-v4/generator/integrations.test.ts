import { describe, it, expect } from 'vitest';
import { generateFiles } from '@/lib/core/codegen/generate';
import { buildExport } from '@/lib/core/export/manifest';
import { validateBlueprint } from '@/lib/core/validation/validate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { TEMPLATES } from '@/lib/templates/registry';

const NOW = '2026-06-08T00:00:00.000Z';
const tpl = TEMPLATES.find((t) => t.id === 'aws-stripe-saas')!;
const bp = draftBlueprint(tpl.snapshot, 'aws-sst-v4', tpl.app, NOW);
const files = generateFiles(bp);
const byPath = Object.fromEntries(files.map((f) => [f.path, f.content]));

describe('external integrations (Stripe / MongoDB / External API)', () => {
  it('validates clean', () => {
    expect(validateBlueprint(bp).errors).toHaveLength(0);
  });

  it('generates Stripe (webhook route + lib) and MongoDB helpers', () => {
    expect(byPath['lib/stripe.ts']).toContain('new Stripe(process.env.STRIPE_SECRET_KEY!)');
    expect(byPath['app/api/webhooks/stripe/route.ts']).toContain('constructEvent');
    expect(byPath['app/api/webhooks/stripe/route.ts']).toContain('STRIPE_WEBHOOK_SECRET');
    expect(byPath['lib/mongo.ts']).toContain('new MongoClient(process.env.DATABASE_URL');
  });

  it('does NOT render external integrations as SST resources, and only links real ones', () => {
    const config = byPath['sst.config.ts'];
    expect(config).not.toContain('Stripe');
    expect(config).not.toContain('Mongo');
    expect(config).toContain('link: [uploads]'); // bucket is the only SST resource linked
  });

  it('collects env vars into required-env.json + .env.example with placeholder hints', () => {
    const env = JSON.parse(byPath['required-env.json']) as { required: { name: string }[] };
    const names = env.required.map((e) => e.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'NEXT_PUBLIC_APP_NAME',
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'DATABASE_URL',
      ]),
    );

    const exported = Object.fromEntries(buildExport(bp).map((f) => [f.path, f.content]));
    const example = exported['.env.example'];
    expect(example).toContain('STRIPE_SECRET_KEY=');
    expect(example).toContain('sk_test_'); // placeholder hint
    expect(example).toContain('DATABASE_URL=');
  });

  it('adds stripe + mongodb to package.additions.json', () => {
    const pkg = JSON.parse(byPath['package.additions.json']) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['stripe']).toBeDefined();
    expect(pkg.dependencies['mongodb']).toBeDefined();
  });
});
