import { describe, it, expect } from 'vitest';
import { generateFiles } from '@/lib/core/codegen/generate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { TEMPLATES } from '@/lib/templates/registry';

const NOW = '2026-06-08T00:00:00.000Z';
const gen = (id: string) => {
  const t = TEMPLATES.find((x) => x.id === id)!;
  return Object.fromEntries(
    generateFiles(draftBlueprint(t.snapshot, 'aws-sst-v4', t.app, NOW)).map((f) => [
      f.path,
      f.content,
    ]),
  );
};

describe('runnable project scaffold + AGENTS.md', () => {
  it('emits a complete, runnable Next.js project', () => {
    const byPath = gen('aws-marketplace');
    const pkg = JSON.parse(byPath['package.json']) as {
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    expect(pkg.dependencies.next).toBeDefined();
    expect(pkg.dependencies.react).toBeDefined();
    expect(pkg.dependencies.sst).toBeDefined();
    expect(pkg.scripts.deploy).toBe('sst deploy');
    expect(byPath['tsconfig.json']).toContain('"@/*"');
    expect(byPath['next.config.ts']).toContain('NextConfig');
    expect(byPath['app/layout.tsx']).toContain('RootLayout');
    expect(byPath['.gitignore']).toContain('.sst/');
  });

  it('home page links to the generated CRUD pages', () => {
    expect(gen('aws-marketplace')['app/page.tsx']).toContain('/listings');
  });

  it('AGENTS.md maps resources, env, and how to extend', () => {
    const agents = gen('aws-marketplace')['AGENTS.md'];
    expect(agents).toContain('marketplace-app — Architecture');
    expect(agents).toContain('Listings');
    expect(agents).toContain('How to extend');
    expect(agents).toContain('import { Resource } from "sst"');
  });

  it('wraps the layout in ClerkProvider when Clerk auth is present', () => {
    expect(gen('aws-clerk-saas')['app/layout.tsx']).toContain('ClerkProvider');
  });

  it('the AI chat app advertises its /api/chat endpoint on the home page', () => {
    expect(gen('aws-ai-chat')['app/page.tsx']).toContain('/api/chat');
  });
});
