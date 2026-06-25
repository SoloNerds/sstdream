import { describe, it, expect } from 'vitest';
import { generateFiles } from '@/lib/core/codegen/generate';
import { validateBlueprint } from '@/lib/core/validation/validate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { TEMPLATES } from '@/lib/templates/registry';

const NOW = '2026-06-08T00:00:00.000Z';
const t = TEMPLATES.find((x) => x.id === 'aws-full-saas')!;
const bp = draftBlueprint(t.snapshot, 'aws-sst-v4', t.app, NOW);
const byPath = Object.fromEntries(generateFiles(bp).map((f) => [f.path, f.content]));

describe('Full SaaS flagship template', () => {
  it('validates clean', () => {
    expect(validateBlueprint(bp).errors).toHaveLength(0);
  });

  it('wires auth + payments + CRUD + email + uploads + cron end-to-end', () => {
    expect(byPath['middleware.ts']).toContain('clerkMiddleware'); // Clerk auth
    expect(byPath['lib/stripe.ts']).toBeDefined(); // Stripe
    expect(byPath['app/api/webhooks/stripe/route.ts']).toBeDefined();
    expect(byPath['app/actions/projects.ts']).toContain('"use server"'); // Dynamo CRUD
    expect(byPath['app/projects/page.tsx']).toContain('await list()'); // example frontend
    expect(byPath['lib/email.ts']).toContain('SESv2'); // SES email
    expect(byPath['app/actions/create-upload-url.ts']).toBeDefined(); // S3 uploads
    expect(byPath['src/workers/send-digest.ts']).toContain('handler'); // cron worker
    expect(byPath['sst.config.ts']).toContain('new sst.aws.CronV2("DailyDigest"');
  });

  it('the scaffold wraps ClerkProvider and lists the projects page', () => {
    expect(byPath['app/layout.tsx']).toContain('ClerkProvider');
    expect(byPath['app/page.tsx']).toContain('/projects');
    expect(byPath['AGENTS.md']).toContain('How to extend');
  });
});
