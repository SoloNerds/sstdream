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

describe('Event Bus (sst.aws.Bus)', () => {
  const t = TEMPLATES.find((x) => x.id === 'aws-events')!;
  const bp = draftBlueprint(t.snapshot, 'aws-sst-v4', t.app, NOW);
  const byPath = files(bp);
  const config = byPath['sst.config.ts'];

  it('validates clean and declares the bus + a name-first subscribe', () => {
    expect(validateBlueprint(bp).errors).toHaveLength(0);
    expect(config).toContain('new sst.aws.Bus("Events")');
    // Bus.subscribe is NAME-FIRST (unlike Queue.subscribe)
    expect(config).toContain('events.subscribe("Handler", {');
    expect(config).toContain('handler: "src/workers/handler.handler"');
    expect(config).toContain('link: [log]');
  });

  it('emits an EventBridge publish helper + the subscriber handler + dep', () => {
    expect(byPath['lib/bus.ts']).toContain('@aws-sdk/client-eventbridge');
    expect(byPath['lib/bus.ts']).toContain('Resource.Events.name');
    expect(byPath['lib/bus.ts']).toContain('PutEventsCommand');
    expect(byPath['src/workers/handler.ts']).toContain('export async function handler');
    const pkg = JSON.parse(byPath['package.additions.json']) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['@aws-sdk/client-eventbridge']).toBeDefined();
  });
});

describe('SNS Topic (sst.aws.SnsTopic)', () => {
  const bp = draftBlueprint(
    {
      nodes: [
        { id: 'n1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
        {
          id: 't2',
          kind: 'snstopic',
          name: 'Topic',
          props: { fifo: true },
          position: { x: 1, y: 0 },
        },
        { id: 'w3', kind: 'worker', name: 'Sub', props: {}, position: { x: 2, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 't2', intent: 'publishesTo' },
        { id: 'e2', source: 'w3', target: 't2', intent: 'subscribesTo' },
      ],
    },
    'aws-sst-v4',
    APP,
    NOW,
  );
  const byPath = files(bp);

  it('declares a FIFO topic + name-first subscribe, and an SNS publish helper', () => {
    expect(validateBlueprint(bp).errors).toHaveLength(0);
    const config = byPath['sst.config.ts'];
    expect(config).toContain('new sst.aws.SnsTopic("Topic", {');
    expect(config).toContain('fifo: true');
    expect(config).toContain('topic.subscribe("Sub", {');
    expect(byPath['lib/topic.ts']).toContain('PublishCommand');
    expect(byPath['lib/topic.ts']).toContain('Resource.Topic.arn');
    expect(byPath['lib/topic.ts']).toContain('@aws-sdk/client-sns');
  });
});
