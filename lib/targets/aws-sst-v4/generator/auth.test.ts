import { describe, it, expect } from 'vitest';
import { generateFiles } from '@/lib/core/codegen/generate';
import { validateBlueprint } from '@/lib/core/validation/validate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { TEMPLATES } from '@/lib/templates/registry';

const NOW = '2026-06-08T00:00:00.000Z';
const gen = (id: string) => {
  const tpl = TEMPLATES.find((t) => t.id === id)!;
  const bp = draftBlueprint(tpl.snapshot, 'aws-sst-v4', tpl.app, NOW);
  return { bp, byPath: Object.fromEntries(generateFiles(bp).map((f) => [f.path, f.content])) };
};

describe('Clerk auth (drop-in, env-driven)', () => {
  const { bp, byPath } = gen('aws-clerk-saas');

  it('validates clean and generates middleware (not an SST resource)', () => {
    expect(validateBlueprint(bp).errors).toHaveLength(0);
    expect(byPath['middleware.ts']).toContain('clerkMiddleware');
    expect(byPath['middleware.ts']).toContain('@clerk/nextjs/server');
    expect(byPath['sst.config.ts']).not.toContain('Clerk');
    expect(byPath['sst.config.ts']).not.toContain('clerkMiddleware');
  });

  it('adds Clerk env keys + @clerk/nextjs dep', () => {
    const names = (
      JSON.parse(byPath['required-env.json']) as { required: { name: string }[] }
    ).required.map((e) => e.name);
    expect(names).toEqual(
      expect.arrayContaining(['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY']),
    );
    const pkg = JSON.parse(byPath['package.additions.json']) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['@clerk/nextjs']).toBeDefined();
  });
});

describe('Cognito auth (AWS-native SST resource)', () => {
  const { bp, byPath } = gen('aws-cognito-app');
  const config = byPath['sst.config.ts'];

  it('validates clean and renders the user pool + web client', () => {
    expect(validateBlueprint(bp).errors).toHaveLength(0);
    expect(config).toContain('new sst.aws.CognitoUserPool("AuthPool")');
    expect(config).toContain('authPool.addClient("Web")');
  });

  it('links the pool and injects NEXT_PUBLIC_COGNITO_* env from outputs', () => {
    expect(config).toContain('link: [authPool, appData]');
    expect(config).toContain('NEXT_PUBLIC_COGNITO_USER_POOL_ID: authPool.id');
    expect(config).toContain('NEXT_PUBLIC_COGNITO_CLIENT_ID: authPoolClient.id');
    expect(config).toContain('NEXT_PUBLIC_AWS_REGION: "us-east-1"');
  });

  it('exposes the pool id at runtime via Resource (lib/auth.ts)', () => {
    expect(byPath['lib/auth.ts']).toContain('Resource.AuthPool.id');
  });

  it('does NOT put the SST-injected Cognito ids in .env (they come from outputs)', () => {
    const names = (
      JSON.parse(byPath['required-env.json']) as { required: { name: string }[] }
    ).required.map((e) => e.name);
    expect(names).not.toContain('NEXT_PUBLIC_COGNITO_USER_POOL_ID');
  });
});
