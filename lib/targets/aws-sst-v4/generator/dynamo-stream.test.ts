import { describe, it, expect } from 'vitest';
import { generateFiles } from '@/lib/core/codegen/generate';
import { validateBlueprint } from '@/lib/core/validation/validate';
import { simulateBlueprint } from '@/lib/core/simulation/simulate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';

// Dynamo streams (docs/sst-v4-target.md §4.3/§6): a Worker can subscribe to a
// table's change stream. Dynamo.subscribe is NAME-first (unlike Queue), the table
// needs `stream` enabled, and the generator auto-enables it when a subscriber is
// wired — erroring only on an explicit contradiction.

const NOW = '2026-06-08T00:00:00.000Z';
const APP = { name: 'stream-app', region: 'us-east-1', packageManager: 'yarn' as const };

const design = (tableProps: Record<string, unknown> = {}) =>
  draftBlueprint(
    {
      nodes: [
        { id: 'web', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
        { id: 't', kind: 'dynamo', name: 'AppTable', props: tableProps, position: { x: 1, y: 0 } },
        { id: 'w', kind: 'worker', name: 'OnChange', props: {}, position: { x: 2, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'web', target: 't', intent: 'writesTo' },
        { id: 'e2', source: 'w', target: 't', intent: 'subscribesTo' },
      ],
    },
    'aws-sst-v4',
    APP,
    NOW,
  );

const filesOf = (bp: ReturnType<typeof design>) =>
  Object.fromEntries(generateFiles(bp).map((f) => [f.path, f.content]));

describe('Dynamo streams (docs §4.3)', () => {
  it('auto-enables the stream and emits a NAME-first subscribe', () => {
    const config = filesOf(design())['sst.config.ts'];
    expect(config).toContain('stream: "new-and-old-images",');
    // name-first (like Bus/SnsTopic), NOT subscriber-first (like Queue)
    expect(config).toMatch(/appTable\.subscribe\("OnChange", \{/);
  });

  it('honors an explicit stream prop', () => {
    expect(filesOf(design({ stream: 'keys-only' }))['sst.config.ts']).toContain(
      'stream: "keys-only",',
    );
  });

  it('generates a DynamoDB-stream handler shape (not an SQS one)', () => {
    const handler = filesOf(design())['src/workers/on-change.ts'];
    expect(handler).toContain('record.dynamodb.NewImage');
    expect(handler).toContain('record.eventName');
    expect(handler).not.toContain('record.body');
  });

  it('errors when a subscriber is wired but the stream is explicitly off', () => {
    const errs = validateBlueprint(design({ stream: 'none' })).errors.filter(
      (d) => d.rule === 'dynamo-subscriber-needs-stream',
    );
    expect(errs).toHaveLength(1);
  });

  it('does NOT error when the stream is unset (generator auto-enables it)', () => {
    expect(validateBlueprint(design()).errors).toEqual([]);
  });

  it('traces the stream subscriber instead of flagging it untriggered', () => {
    const trace = simulateBlueprint(design());
    expect(trace.ok).toBe(true);
    expect(trace.events.some((e) => e.label === 'AppTable streams to OnChange')).toBe(true);
    expect(trace.events.some((e) => e.label.includes('never triggered'))).toBe(false);
  });
});
