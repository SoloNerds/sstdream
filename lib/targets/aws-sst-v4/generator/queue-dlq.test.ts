import { describe, it, expect } from 'vitest';
import { generateFiles } from '@/lib/core/codegen/generate';
import { validateBlueprint } from '@/lib/core/validation/validate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { awsDefaultIntent } from '@/lib/targets/aws-sst-v4/edges';
import { awsRecommendations } from '@/lib/targets/aws-sst-v4/recommendations';
import type { Blueprint } from '@/lib/core/blueprint/types';

// #127 — queue DLQ (queue → queue edge) + explicit visibilityTimeout prop,
// with the formerly un-actionable Tips-panel DLQ recommendation now applying.

const NOW = '2026-06-08T00:00:00.000Z';
const APP = { name: 'dlq-app', region: 'us-east-1', packageManager: 'yarn' as const };

type Node = {
  id: string;
  kind: string;
  name: string;
  props: Record<string, unknown>;
  position: { x: number; y: number };
};
type Edge = { id: string; source: string; target: string; intent: string };

const n = (id: string, kind: string, name: string, props: Record<string, unknown> = {}): Node => ({
  id,
  kind,
  name,
  props,
  position: { x: 0, y: 0 },
});
const e = (id: string, source: string, target: string, intent: string): Edge => ({
  id,
  source,
  target,
  intent,
});

const mk = (nodes: Node[], edges: Edge[]): Blueprint =>
  draftBlueprint({ nodes, edges }, 'aws-sst-v4', APP, NOW);

const config = (bp: Blueprint) =>
  generateFiles(bp).find((f) => f.path === 'sst.config.ts')!.content;

describe('queue → queue renders a dead-letter queue', () => {
  it('queue>queue defaults to deadLettersTo (same-kind pairs are otherwise refused)', () => {
    expect(awsDefaultIntent('queue', 'queue')).toBe('deadLettersTo');
    expect(awsDefaultIntent('bucket', 'bucket')).toBeNull();
  });

  it('emits dlq: <target>.arn and declares the DLQ first', () => {
    const bp = mk(
      [n('q', 'queue', 'Jobs'), n('d', 'queue', 'JobsDlq'), n('w', 'worker', 'ProcessJob')],
      [e('e1', 'q', 'd', 'deadLettersTo'), e('e2', 'w', 'q', 'subscribesTo')],
    );
    const c = config(bp);
    expect(c).toContain('dlq: jobsDlq.arn,');
    expect(c.indexOf('new sst.aws.Queue("JobsDlq")')).toBeLessThan(
      c.indexOf('new sst.aws.Queue("Jobs", {'),
    );
    expect(validateBlueprint(bp).errors).toEqual([]);
  });

  it('the DLQ itself is exempt from the no-subscriber warning', () => {
    const bp = mk(
      [n('q', 'queue', 'Jobs'), n('d', 'queue', 'JobsDlq'), n('w', 'worker', 'ProcessJob')],
      [e('e1', 'q', 'd', 'deadLettersTo'), e('e2', 'w', 'q', 'subscribesTo')],
    );
    const warned = validateBlueprint(bp)
      .warnings.filter((d) => d.rule === 'queue-needs-subscriber')
      .map((d) => d.resourceId);
    expect(warned).not.toContain('d');
  });

  it('dead-letter cycles are a validation error', () => {
    const bp = mk(
      [n('a', 'queue', 'QueueA'), n('b', 'queue', 'QueueB')],
      [e('e1', 'a', 'b', 'deadLettersTo'), e('e2', 'b', 'a', 'deadLettersTo')],
    );
    expect(
      validateBlueprint(bp).errors.filter((d) => d.rule === 'queue-dlq-no-cycle').length,
    ).toBeGreaterThan(0);
  });
});

describe('explicit visibilityTimeout prop', () => {
  it('an explicit value wins over the auto 6× computation', () => {
    const bp = mk(
      [n('q', 'queue', 'Jobs', { visibilityTimeout: '900 seconds' }), n('w', 'worker', 'Slow')],
      [e('e1', 'w', 'q', 'subscribesTo')],
    );
    expect(config(bp)).toContain('visibilityTimeout: "900 seconds",');
    expect(validateBlueprint(bp).errors).toEqual([]);
  });

  it('an explicit value below the subscriber timeout errors (AWS hard constraint)', () => {
    const bp = mk(
      [
        n('q', 'queue', 'Jobs', { visibilityTimeout: '30 seconds' }),
        n('w', 'worker', 'Slow', { timeout: '2 minutes' }),
      ],
      [e('e1', 'w', 'q', 'subscribesTo')],
    );
    expect(
      validateBlueprint(bp).errors.filter((d) => d.rule === 'queue-visibility-covers-subscribers'),
    ).toHaveLength(1);
  });

  it('an unparseable explicit value errors', () => {
    const bp = mk([n('q', 'queue', 'Jobs', { visibilityTimeout: 'whenever' })], []);
    expect(
      validateBlueprint(bp).errors.filter((d) => d.rule === 'queue-visibility-covers-subscribers'),
    ).toHaveLength(1);
  });
});

describe('the DLQ tip is actionable and idempotent', () => {
  const base = mk(
    [n('q', 'queue', 'Jobs'), n('w', 'worker', 'ProcessJob')],
    [e('e1', 'w', 'q', 'subscribesTo')],
  );

  it('recommends a DLQ with an apply() that mints the queue + edge', () => {
    const rec = awsRecommendations(base).find((r) => r.id === 'dlq-q');
    expect(rec).toBeTruthy();
    expect(rec!.apply).toBeTypeOf('function');
    const applied = rec!.apply!(base);
    const dlq = applied.resources.find((r) => r.name === 'JobsDlq');
    expect(dlq).toBeTruthy();
    expect(
      applied.connections.some(
        (c) => c.source === 'q' && c.target === dlq!.id && c.intent === 'deadLettersTo',
      ),
    ).toBe(true);
    // The applied design exports cleanly with the DLQ wired.
    expect(validateBlueprint(applied).errors).toEqual([]);
    expect(config(applied)).toContain('dlq: jobsDlq.arn,');
    // Applying twice equals applying once.
    expect(rec!.apply!(applied)).toEqual(applied);
  });

  it('stops recommending once a DLQ is wired (and never targets the DLQ itself)', () => {
    const rec = awsRecommendations(base).find((r) => r.id === 'dlq-q')!;
    const applied = rec.apply!(base);
    const again = awsRecommendations(applied).filter((r) => r.id.startsWith('dlq-'));
    expect(again).toEqual([]);
  });
});
