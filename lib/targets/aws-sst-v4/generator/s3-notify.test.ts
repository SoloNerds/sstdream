import { describe, it, expect } from 'vitest';
import { generateFiles } from '@/lib/core/codegen/generate';
import { validateBlueprint } from '@/lib/core/validation/validate';
import { simulateBlueprint } from '@/lib/core/simulation/simulate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { TEMPLATES } from '@/lib/templates/registry';

const NOW = '2026-06-08T00:00:00.000Z';
const t = TEMPLATES.find((x) => x.id === 'aws-image-pipeline')!;
const bp = draftBlueprint(t.snapshot, 'aws-sst-v4', t.app, NOW);
const byPath = Object.fromEntries(generateFiles(bp).map((f) => [f.path, f.content]));

describe('S3 → worker notifications (bucket.notify)', () => {
  it('validates clean and renders bucket.notify with a linked function', () => {
    expect(validateBlueprint(bp).errors).toHaveLength(0);
    const config = byPath['sst.config.ts'];
    expect(config).toContain('uploads.notify({');
    expect(config).toContain('name: "Resize"');
    expect(config).toContain(
      'function: { handler: "src/workers/resize.handler", link: [uploads, images] }',
    );
    expect(config).toContain('events: ["s3:ObjectCreated:*"]');
  });

  it('emits the S3 event handler', () => {
    const handler = byPath['src/workers/resize.ts'];
    expect(handler).toContain('export async function handler');
    expect(handler).toContain('record.s3.object.key');
  });

  it('simulation traces upload → bucket → notifier (no untriggered worker)', () => {
    const trace = simulateBlueprint(bp);
    const broken = trace.events.filter((e) => e.status === 'broken');
    expect(broken).toHaveLength(0);
    expect(trace.events.some((e) => /notifies Resize/.test(e.label))).toBe(true);
  });
});
