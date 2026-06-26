import { describe, it, expect } from 'vitest';
import { parseScanImport } from './scan-import';

// A minimal but realistic sstdream-scan.json (the shape `sst-dream scan` writes).
const SCAN = JSON.stringify({
  appName: 'wellness-portal',
  target: 'aws-sst-v4',
  scannedFiles: ['sst.config.ts'],
  redactions: 3,
  nodes: [
    {
      id: 'nextjs_1',
      kind: 'nextjs',
      name: 'Web',
      props: {},
      position: { x: 60, y: 60 },
      confidence: 'high',
    },
    {
      id: 'secret_1',
      kind: 'secret',
      name: 'DatabaseUrl',
      props: {},
      position: { x: 380, y: 60 },
      confidence: 'high',
    },
  ],
  edges: [
    { id: 'edge_1', source: 'nextjs_1', target: 'secret_1', intent: 'usesSecret' },
    { id: 'edge_bad', source: 'nextjs_1', target: 'ghost_9', intent: 'usesSecret' }, // dangling
  ],
  unmodeled: [{ snippet: 'new sst.aws.Cron("X")', reason: "isn't modeled yet" }],
  generatedAt: '2026-06-26T00:00:00.000Z',
});

describe('parseScanImport', () => {
  it('recovers the design from a sstdream-scan.json', () => {
    const r = parseScanImport(SCAN);
    expect(r).not.toBeNull();
    expect(r!.target).toBe('aws-sst-v4');
    expect(r!.appName).toBe('wellness-portal');
    expect(r!.nodes.map((n) => n.name)).toEqual(['Web', 'DatabaseUrl']);
    expect(r!.unrecognized[0].snippet).toContain('Cron');
  });

  it('strips non-canvas fields (e.g. confidence) off the nodes', () => {
    const r = parseScanImport(SCAN);
    expect(r!.nodes[0]).toEqual({
      id: 'nextjs_1',
      kind: 'nextjs',
      name: 'Web',
      props: {},
      position: { x: 60, y: 60 },
    });
    expect('confidence' in r!.nodes[0]).toBe(false);
  });

  it('drops edges that reference a missing node (no dangling edges)', () => {
    const r = parseScanImport(SCAN);
    expect(r!.edges).toHaveLength(1);
    expect(r!.edges[0].id).toBe('edge_1');
  });

  it('returns null for source code (not JSON)', () => {
    expect(parseScanImport('export default $config({ app() {} })')).toBeNull();
  });

  it('returns null for a blueprint JSON (target is an object, not a string)', () => {
    const blueprint = JSON.stringify({
      schemaVersion: 3,
      target: { deploy: 'aws-sst-v4' },
      app: { name: 'x' },
      resources: [],
      connections: [],
    });
    expect(parseScanImport(blueprint)).toBeNull();
  });

  it('returns null for unrelated JSON', () => {
    expect(parseScanImport('{"hello":"world"}')).toBeNull();
    expect(parseScanImport('[]')).toBeNull();
  });
});
