import { describe, it, expect } from 'vitest';
import { BlueprintSchema } from './schema';
import {
  canvasToBlueprint,
  blueprintToCanvas,
  createEmptyBlueprint,
  serializeBlueprint,
  parseBlueprint,
  type CanvasSnapshot,
} from './serialize';
import { migrateBlueprint, BlueprintMigrationError } from './migrate';

const NOW = '2026-06-08T00:00:00.000Z';

const snapshot: CanvasSnapshot = {
  nodes: [
    { id: 'nextjs_1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 0, y: 0 } },
    {
      id: 'bucket_2',
      kind: 'bucket',
      name: 'Uploads',
      props: { access: 'public' },
      position: { x: 100, y: 0 },
    },
    { id: 'queue_3', kind: 'queue', name: 'Jobs', props: {}, position: { x: 200, y: 0 } },
    { id: 'worker_4', kind: 'worker', name: 'ProcessJob', props: {}, position: { x: 300, y: 0 } },
    { id: 'dynamo_5', kind: 'dynamo', name: 'AppTable', props: {}, position: { x: 400, y: 0 } },
  ],
  edges: [
    { id: 'edge_6', source: 'nextjs_1', target: 'bucket_2', intent: 'uploadsTo' },
    { id: 'edge_7', source: 'nextjs_1', target: 'queue_3', intent: 'publishesTo' },
    { id: 'edge_8', source: 'worker_4', target: 'queue_3', intent: 'subscribesTo' },
    { id: 'edge_9', source: 'worker_4', target: 'dynamo_5', intent: 'writesTo' },
  ],
};

const app = { name: 'ai-processing-app', packageManager: 'yarn' as const, region: 'us-east-1' };

describe('blueprint envelope', () => {
  it('creates a valid empty blueprint for the AWS lane', () => {
    const bp = createEmptyBlueprint('aws-sst-v4', app, NOW);
    expect(bp.target.deploy).toBe('aws-sst-v4');
    expect(bp.target.sstMajor).toBe(4);
    expect(bp.target.awsProviderMajor).toBe(7);
    expect(() => BlueprintSchema.parse(bp)).not.toThrow();
  });

  it('round-trips canvas → blueprint → canvas without loss', () => {
    const bp = canvasToBlueprint(snapshot, 'aws-sst-v4', app, NOW);
    const back = blueprintToCanvas(bp);
    expect(back.nodes).toEqual(snapshot.nodes);
    expect(back.edges).toEqual(snapshot.edges);
  });

  it('serializes and parses back to an identical blueprint', () => {
    const bp = canvasToBlueprint(snapshot, 'aws-sst-v4', app, NOW);
    const json = serializeBlueprint(bp);
    const parsed = parseBlueprint(json);
    expect(parsed).toEqual(bp);
  });

  it('declares the SST v4 target explicitly in the serialized JSON', () => {
    const bp = createEmptyBlueprint('aws-sst-v4', app, NOW);
    expect(serializeBlueprint(bp)).toContain('"deploy": "aws-sst-v4"');
  });

  it('preserves createdAt across re-serialization', () => {
    const bp = canvasToBlueprint(snapshot, 'aws-sst-v4', app, '2026-01-01T00:00:00.000Z');
    const later = canvasToBlueprint(snapshot, 'aws-sst-v4', app, NOW, bp.metadata.createdAt);
    expect(later.metadata.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(later.metadata.updatedAt).toBe(NOW);
  });

  it('round-trips secrets and outputs through the canvas snapshot without dropping them', () => {
    const withExtras: CanvasSnapshot = {
      ...snapshot,
      secrets: [{ id: 'sec_1', name: 'StripeSecretKey' }],
      outputs: [{ id: 'out_1', name: 'BucketUrl', valueRef: 'bucket_2.url' }],
    };
    const bp = canvasToBlueprint(withExtras, 'aws-sst-v4', app, NOW);
    expect(bp.secrets).toEqual(withExtras.secrets);
    expect(bp.outputs).toEqual(withExtras.outputs);
    // and back to the canvas, so an imported design's secrets/outputs survive a re-save
    const back = blueprintToCanvas(bp);
    expect(back.secrets).toEqual(withExtras.secrets);
    expect(back.outputs).toEqual(withExtras.outputs);
  });

  it('rejects a blueprint with no version', () => {
    expect(() => migrateBlueprint({ app: {} })).toThrow(BlueprintMigrationError);
  });

  it('rejects an unknown future version', () => {
    expect(() => migrateBlueprint({ version: '9.9.9' })).toThrow(BlueprintMigrationError);
  });

  it('rejects an invalid app name', () => {
    expect(() => createEmptyBlueprint('aws-sst-v4', { ...app, name: 'Bad Name' }, NOW)).toThrow();
  });
});
