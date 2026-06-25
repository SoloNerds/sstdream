import { describe, it, expect } from 'vitest';
import { generateSstConfig } from './config';
import { draftBlueprint, type CanvasSnapshot } from '@/lib/core/blueprint/serialize';

const NOW = '2026-06-08T00:00:00.000Z';
const app = { name: 'demo-app', packageManager: 'yarn' as const, region: 'us-east-1' };
const gen = (snapshot: CanvasSnapshot) =>
  generateSstConfig(draftBlueprint(snapshot, 'aws-sst-v4', app, NOW));

const node = (id: string, kind: string, name: string, props: Record<string, unknown> = {}) => ({
  id,
  kind,
  name,
  props,
  position: { x: 0, y: 0 },
});

describe('generator honors resource props', () => {
  it('bucket access (public / cloudfront / none)', () => {
    expect(gen({ nodes: [node('b', 'bucket', 'B', { access: 'public' })], edges: [] })).toContain(
      'access: "public"',
    );
    expect(
      gen({ nodes: [node('b', 'bucket', 'B', { access: 'cloudfront' })], edges: [] }),
    ).toContain('access: "cloudfront"');
    expect(gen({ nodes: [node('b', 'bucket', 'B', { access: 'none' })], edges: [] })).toBe(
      gen({ nodes: [node('b', 'bucket', 'B')], edges: [] }),
    );
  });

  it('dynamo custom keys, and single-key when sort key cleared', () => {
    const custom = gen({
      nodes: [node('d', 'dynamo', 'T', { hashKey: 'userId', rangeKey: 'noteId' })],
      edges: [],
    });
    expect(custom).toContain('userId: "string"');
    expect(custom).toContain('primaryIndex: { hashKey: "userId", rangeKey: "noteId" }');

    const single = gen({
      nodes: [node('d', 'dynamo', 'T', { hashKey: 'id', rangeKey: '' })],
      edges: [],
    });
    expect(single).toContain('primaryIndex: { hashKey: "id" }');
    expect(single).not.toContain('rangeKey');
  });

  it('queue fifo', () => {
    expect(gen({ nodes: [node('q', 'queue', 'Q', { fifo: true })], edges: [] })).toContain(
      'fifo: true',
    );
  });

  it('worker timeout + memory in the subscribe call', () => {
    const config = gen({
      nodes: [
        node('q', 'queue', 'Jobs'),
        node('w', 'worker', 'Proc', { timeout: '120 seconds', memory: '512 MB' }),
      ],
      edges: [{ id: 'e', source: 'w', target: 'q', intent: 'subscribesTo' }],
    });
    expect(config).toContain('timeout: "120 seconds"');
    expect(config).toContain('memory: "512 MB"');
  });

  it('nextjs path, domain, and environment', () => {
    const config = gen({
      nodes: [
        node('n', 'nextjs', 'Web', {
          path: 'apps/web',
          domain: 'app.example.com',
          environment: { NEXT_PUBLIC_FOO: 'bar' },
        }),
      ],
      edges: [],
    });
    expect(config).toContain('path: "apps/web"');
    expect(config).toContain('domain: "app.example.com"');
    expect(config).toContain('environment: {');
    expect(config).toContain('NEXT_PUBLIC_FOO: "bar"');
  });
});
