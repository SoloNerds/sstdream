import { describe, it, expect } from 'vitest';
import { generateFiles } from '@/lib/core/codegen/generate';
import { validateBlueprint } from '@/lib/core/validation/validate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { TEMPLATES } from '@/lib/templates/registry';

const NOW = '2026-06-08T00:00:00.000Z';
const aiTemplate = TEMPLATES.find((t) => t.id === 'aws-ai-chat')!;
const bp = draftBlueprint(aiTemplate.snapshot, 'aws-sst-v4', aiTemplate.app, NOW);
const files = generateFiles(bp);
const byPath = Object.fromEntries(files.map((f) => [f.path, f.content]));

describe('AI Chat template', () => {
  it('validates clean and emits the AI runtime files', () => {
    expect(validateBlueprint(bp).errors).toHaveLength(0);
    expect(Object.keys(byPath)).toEqual(
      expect.arrayContaining(['sst.config.ts', 'lib/ai.ts', 'app/api/chat/route.ts']),
    );
  });

  it('declares the API key as an SST secret and links it to the app', () => {
    expect(byPath['sst.config.ts']).toContain('new sst.Secret("AnthropicKey")');
    expect(byPath['sst.config.ts']).toContain('link: [anthropicKey, chatHistory]');
  });

  it('reads the key server-side via Resource (never exposed to the browser)', () => {
    const ai = byPath['lib/ai.ts'];
    expect(ai).toContain('import { Resource } from "sst"');
    expect(ai).toContain('Resource.AnthropicKey.value');
    expect(ai).toContain('import Anthropic from "@anthropic-ai/sdk"');
  });

  it('uses the verified current model id and official streaming SDK', () => {
    expect(byPath['lib/ai.ts']).toContain('claude-opus-4-8');
    expect(byPath['lib/ai.ts']).not.toMatch(/claude-opus-4-8-\d/); // no date suffix
    expect(byPath['app/api/chat/route.ts']).toContain('anthropic.messages.stream');
  });

  it('the route is server-only (Node runtime) and validates input', () => {
    const route = byPath['app/api/chat/route.ts'];
    expect(route).toContain('export const runtime = "nodejs"');
    expect(route).toContain('MAX_MESSAGES');
    expect(route).toContain('return new Response("Invalid messages", { status: 400 })');
    // no API key handling on this layer — it comes from lib/ai.ts (Resource)
    expect(route).not.toContain('process.env');
  });

  it('adds the Anthropic SDK to package.additions.json', () => {
    const pkg = JSON.parse(byPath['package.additions.json']) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['@anthropic-ai/sdk']).toBeDefined();
  });
});
