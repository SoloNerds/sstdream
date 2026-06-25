import { describe, it, expect } from 'vitest';
import { validateBlueprint } from './validate';
import { draftBlueprint, type CanvasSnapshot } from '@/lib/core/blueprint/serialize';
import { AI_PROCESSING_APP } from '@/lib/templates/ai-processing-app';

const NOW = '2026-06-08T00:00:00.000Z';
const app = { name: 'demo-app', packageManager: 'yarn' as const, region: 'us-east-1' };

const validate = (snapshot: CanvasSnapshot, appOverride = app) =>
  validateBlueprint(draftBlueprint(snapshot, 'aws-sst-v4', appOverride, NOW));

describe('AWS validation engine', () => {
  it('passes the AI Processing App reference template with zero errors and zero warnings', () => {
    const result = validateBlueprint(
      draftBlueprint(AI_PROCESSING_APP.snapshot, 'aws-sst-v4', AI_PROCESSING_APP.app, NOW),
    );
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('blocks export (error) on a duplicate resource name', () => {
    const result = validate({
      nodes: [
        { id: 'b1', kind: 'bucket', name: 'Uploads', props: {}, position: { x: 0, y: 0 } },
        { id: 'b2', kind: 'bucket', name: 'Uploads', props: {}, position: { x: 1, y: 1 } },
      ],
      edges: [],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((d) => d.rule === 'unique-resource-names')).toBe(true);
  });

  it('errors on an invalid SST component name', () => {
    const result = validate({
      nodes: [
        { id: 'b1', kind: 'bucket', name: 'my uploads', props: {}, position: { x: 0, y: 0 } },
      ],
      edges: [],
    });
    expect(result.errors.some((d) => d.rule === 'valid-resource-name')).toBe(true);
  });

  it('errors on an inapplicable edge intent (subscribesTo from a non-worker)', () => {
    const result = validate({
      nodes: [
        { id: 'n1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
        { id: 'q1', kind: 'queue', name: 'Jobs', props: {}, position: { x: 1, y: 1 } },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'q1', intent: 'subscribesTo' }],
    });
    expect(result.errors.some((d) => d.rule === 'edge-intent-applicability')).toBe(true);
  });

  it('errors when a cron has no function to invoke', () => {
    const result = validate({
      nodes: [{ id: 'c1', kind: 'cron', name: 'Daily', props: {}, position: { x: 0, y: 0 } }],
      edges: [],
    });
    expect(result.errors.some((d) => d.rule === 'cron-needs-function')).toBe(true);
  });

  it('warns (does not block) when a queue has no subscriber', () => {
    const result = validate({
      nodes: [{ id: 'q1', kind: 'queue', name: 'Jobs', props: {}, position: { x: 0, y: 0 } }],
      edges: [],
    });
    expect(result.ok).toBe(true);
    expect(result.warnings.some((d) => d.rule === 'queue-needs-subscriber')).toBe(true);
  });

  it('errors on an invalid app name', () => {
    const result = validate(
      {
        nodes: [{ id: 'b1', kind: 'bucket', name: 'Uploads', props: {}, position: { x: 0, y: 0 } }],
        edges: [],
      },
      { ...app, name: 'Bad Name' },
    );
    expect(result.errors.some((d) => d.rule === 'app-name-valid')).toBe(true);
  });
});
