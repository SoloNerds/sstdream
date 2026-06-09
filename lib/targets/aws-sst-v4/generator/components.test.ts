import { describe, it, expect } from 'vitest';
import { generateFiles } from '@/lib/core/codegen/generate';
import { validateBlueprint } from '@/lib/core/validation/validate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { TEMPLATES } from '@/lib/templates/registry';

const NOW = '2026-06-08T00:00:00.000Z';
const tpl = TEMPLATES.find((t) => t.id === 'aws-relational-saas')!;
const bp = draftBlueprint(tpl.snapshot, 'aws-sst-v4', tpl.app, NOW);
const files = generateFiles(bp);
const byPath = Object.fromEntries(files.map((f) => [f.path, f.content]));

describe('Email + Postgres components', () => {
  it('validates clean and links all resources to the app', () => {
    expect(validateBlueprint(bp).errors).toHaveLength(0);
    expect(byPath['sst.config.ts']).toContain('link: [database, mailer, stripeKey]');
  });

  it('auto-generates a Vpc for Postgres (RDS, not Aurora)', () => {
    const config = byPath['sst.config.ts'];
    expect(config).toContain('const vpc = new sst.aws.Vpc("Vpc");');
    expect(config).toContain('new sst.aws.Postgres("Database", {');
    expect(config).toContain('vpc,');
    expect(config).not.toContain('sst.aws.Aurora');
  });

  it('renders Email with a sender', () => {
    expect(byPath['sst.config.ts']).toContain('new sst.aws.Email("Mailer", {');
    expect(byPath['sst.config.ts']).toContain('sender: "noreply@example.com"');
  });

  it('generates a pg pool helper from the linked Postgres Resource', () => {
    const db = byPath['lib/db.ts'];
    expect(db).toContain('import { Pool } from "pg"');
    expect(db).toContain('host: Resource.Database.host');
    expect(db).toContain('password: Resource.Database.password');
  });

  it('generates an SES helper from the linked Email Resource', () => {
    const email = byPath['lib/email.ts'];
    expect(email).toContain('@aws-sdk/client-sesv2');
    expect(email).toContain('FromEmailAddress: Resource.Mailer.sender');
  });

  it('adds pg + SES SDK to package.additions.json', () => {
    const pkg = JSON.parse(byPath['package.additions.json']) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['pg']).toBeDefined();
    expect(pkg.dependencies['@aws-sdk/client-sesv2']).toBeDefined();
  });
});
