import { describe, it, expect } from 'vitest';
import { generateFiles } from '@/lib/core/codegen/generate';
import { validateBlueprint } from '@/lib/core/validation/validate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { TEMPLATES } from '@/lib/templates/registry';
import type { Blueprint } from '@/lib/core/blueprint/types';

const NOW = '2026-06-08T00:00:00.000Z';
const APP = { name: 'a', region: 'us-east-1', packageManager: 'yarn' as const };
const files = (bp: Blueprint) =>
  Object.fromEntries(generateFiles(bp).map((f) => [f.path, f.content]));

describe('ApiGatewayV2 (HTTP API + worker routes)', () => {
  const t = TEMPLATES.find((x) => x.id === 'aws-webhook-api')!;
  const bp = draftBlueprint(t.snapshot, 'aws-sst-v4', t.app, NOW);
  const byPath = files(bp);
  const config = byPath['sst.config.ts'];

  it('validates clean and renders the API + a linked route', () => {
    expect(validateBlueprint(bp).errors).toHaveLength(0);
    expect(config).toContain('new sst.aws.ApiGatewayV2("Api")');
    expect(config).toContain('api.route("POST /webhooks/stripe", {');
    expect(config).toContain('handler: "src/workers/stripe-webhook.handler"');
    expect(config).toContain('link: [events]');
    expect(config).toContain('api: api.url'); // url output
  });

  it('emits the route handler (API Gateway proxy response)', () => {
    const handler = byPath['src/workers/stripe-webhook.ts'];
    expect(handler).toContain('export async function handler');
    expect(handler).toContain('statusCode: 200');
  });

  it('uses the string form when a route has no links', () => {
    const bp2 = draftBlueprint(
      {
        nodes: [
          { id: 'a1', kind: 'apigatewayv2', name: 'Api', props: {}, position: { x: 0, y: 0 } },
          {
            id: 'w2',
            kind: 'worker',
            name: 'Health',
            props: { route: 'GET /health' },
            position: { x: 1, y: 0 },
          },
        ],
        edges: [{ id: 'e', source: 'w2', target: 'a1', intent: 'handlesRoute' }],
      },
      'aws-sst-v4',
      APP,
      NOW,
    );
    expect(files(bp2)['sst.config.ts']).toContain(
      'api.route("GET /health", "src/workers/health.handler");',
    );
  });
});
