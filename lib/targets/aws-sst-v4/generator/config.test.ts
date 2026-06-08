import { describe, it, expect } from 'vitest';
import { generateSstConfig } from './config';
import { generateFiles } from '@/lib/core/codegen/generate';
import { draftBlueprint, type CanvasSnapshot } from '@/lib/core/blueprint/serialize';
import { AI_PROCESSING_APP } from '@/lib/templates/ai-processing-app';

const NOW = '2026-06-08T00:00:00.000Z';
const app = { name: 'demo-app', packageManager: 'yarn' as const, region: 'us-east-1' };
const gen = (snapshot: CanvasSnapshot, appOverride = app) =>
  generateSstConfig(draftBlueprint(snapshot, 'aws-sst-v4', appOverride, NOW));

describe('sst.config.ts generator — AI Processing App', () => {
  const config = generateSstConfig(
    draftBlueprint(AI_PROCESSING_APP.snapshot, 'aws-sst-v4', AI_PROCESSING_APP.app, NOW),
  );

  it('matches snapshot', () => {
    expect(config).toMatchSnapshot();
  });

  it('uses the verified SST v4 shape and no legacy patterns', () => {
    expect(config).toContain('/// <reference path="./.sst/platform/config.d.ts" />');
    expect(config).toContain('export default $config({');
    expect(config).toContain('async run() {');
    expect(config).not.toContain('sst/constructs');
    expect(config).not.toContain('SSTConfig');
    expect(config).not.toContain('@pulumi');
    expect(config).not.toMatch(/^import /m);
  });

  it('emits Queue.subscribe SUBSCRIBER-FIRST (handler/link/timeout in the first object)', () => {
    expect(config).toContain('jobs.subscribe({');
    expect(config).toContain('handler: "src/workers/process-job.handler"');
    expect(config).toContain('link: [appTable]');
    // never the name-first form
    expect(config).not.toMatch(/subscribe\(\s*"/);
  });

  it('links the app to its bucket and queue, and returns outputs', () => {
    expect(config).toContain('new sst.aws.Nextjs("Web", {');
    expect(config).toContain('link: [uploads, jobs]');
    expect(config).toContain('web: web.url');
    expect(config).toContain('uploads: uploads.name');
  });

  it('uses the correct removal enum and no "destroy"', () => {
    expect(config).toContain('removal: input.stage === "production" ? "retain" : "remove"');
    expect(config).toContain('protect: input.stage === "production"');
    expect(config).not.toContain('destroy');
  });

  it('renders Dynamo with fields + primaryIndex', () => {
    expect(config).toContain('new sst.aws.Dynamo("AppTable", {');
    expect(config).toContain('primaryIndex: { hashKey: "pk", rangeKey: "sk" }');
  });
});

describe('sst.config.ts generator — component cases', () => {
  it('renders a public bucket with access (not a public boolean)', () => {
    const config = gen({
      nodes: [
        {
          id: 'b1',
          kind: 'bucket',
          name: 'Public',
          props: { access: 'public' },
          position: { x: 0, y: 0 },
        },
      ],
      edges: [],
    });
    expect(config).toContain('new sst.aws.Bucket("Public", {');
    expect(config).toContain('access: "public"');
    expect(config).not.toContain('public: true');
  });

  it('uses CronV2 (never the deprecated Cron) with a function, never a `job` prop', () => {
    const config = gen({
      nodes: [
        {
          id: 'c1',
          kind: 'cron',
          name: 'Daily',
          props: { schedule: 'rate(1 day)' },
          position: { x: 0, y: 0 },
        },
        { id: 'w1', kind: 'worker', name: 'Report', props: {}, position: { x: 1, y: 0 } },
        { id: 'd1', kind: 'dynamo', name: 'Stats', props: {}, position: { x: 2, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'c1', target: 'w1', intent: 'invokes' },
        { id: 'e2', source: 'w1', target: 'd1', intent: 'writesTo' },
      ],
    });
    expect(config).toContain('new sst.aws.CronV2("Daily", {');
    expect(config).not.toContain('sst.aws.Cron(');
    expect(config).not.toContain('job:');
    expect(config).toContain('schedule: "rate(1 day)"');
    expect(config).toContain('function: {');
    expect(config).toContain('handler: "src/workers/report.handler"');
    expect(config).toContain('link: [stats]');
  });

  it('renders an untriggered worker as a standalone Function', () => {
    const config = gen({
      nodes: [
        { id: 'w1', kind: 'worker', name: 'Lonely', props: {}, position: { x: 0, y: 0 } },
        { id: 'd1', kind: 'dynamo', name: 'Data', props: {}, position: { x: 1, y: 0 } },
      ],
      edges: [{ id: 'e1', source: 'w1', target: 'd1', intent: 'writesTo' }],
    });
    expect(config).toContain('new sst.aws.Function("Lonely", {');
    expect(config).toContain('link: [data]');
  });

  it('renders a Secret', () => {
    const config = gen({
      nodes: [
        { id: 's1', kind: 'secret', name: 'StripeKey', props: {}, position: { x: 0, y: 0 } },
        { id: 'n1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 1, y: 0 } },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 's1', intent: 'usesSecret' }],
    });
    expect(config).toContain('new sst.Secret("StripeKey")');
    expect(config).toContain('link: [stripeKey]');
  });
});

describe('generate facade', () => {
  it('returns sst.config.ts as a generated file', () => {
    const files = generateFiles(
      draftBlueprint(AI_PROCESSING_APP.snapshot, 'aws-sst-v4', AI_PROCESSING_APP.app, NOW),
    );
    expect(files.map((f) => f.path)).toContain('sst.config.ts');
  });
});
