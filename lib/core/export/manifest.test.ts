import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { buildExport } from './manifest';
import { zipFiles } from './zip';
import { canvasToBlueprint, draftBlueprint, parseBlueprint } from '@/lib/core/blueprint/serialize';
import { AI_PROCESSING_APP } from '@/lib/templates/ai-processing-app';

const NOW = '2026-06-08T00:00:00.000Z';
const bp = canvasToBlueprint(AI_PROCESSING_APP.snapshot, 'aws-sst-v4', AI_PROCESSING_APP.app, NOW);
const files = buildExport(bp);
const byPath = Object.fromEntries(files.map((f) => [f.path, f.content]));

describe('export manifest — AI Processing App', () => {
  it('includes code, README, env, and the design file', () => {
    const paths = files.map((f) => f.path);
    expect(paths).toContain('sst.config.ts');
    expect(paths).toContain('README.md');
    expect(paths).toContain('.env.example');
    expect(paths).toContain('package.additions.json');
    expect(paths).toContain('sstdream.design.json');
    expect(paths[0]).toBe('README.md'); // friendly ordering
  });

  it('README documents the runnable project: run, deploy, AGENTS.md, and the existing-app path', () => {
    const readme = byPath['README.md'];
    expect(readme).toContain('sst dev');
    expect(readme).toContain('sst deploy --stage production');
    expect(readme).toContain('AGENTS.md');
    expect(readme).toContain('package.additions.json'); // existing-app merge path
  });

  it('README opens with the day-0 AWS credentials prerequisite + stage note (#126)', () => {
    const readme = byPath['README.md'];
    expect(readme).toContain('## 1. AWS credentials (one-time)');
    expect(readme).toContain('aws configure');
    expect(readme).toContain('Each stage is an isolated copy');
    // No email node in this design — no SES sandbox caveat.
    expect(readme).not.toContain('SES sandbox');
  });

  it('ships a CI deploy workflow wired to the app region (#126)', () => {
    const wf = byPath['.github/workflows/deploy.yml'];
    expect(wf).toContain('aws-actions/configure-aws-credentials@v4');
    expect(wf).toContain(`aws-region: ${bp.app.region}`);
    expect(wf).toContain('sst deploy --stage production');
    expect(byPath['README.md']).toContain('.github/workflows/deploy.yml');
  });

  it('pins verified dependency ranges instead of latest (#126)', () => {
    const additions = JSON.parse(byPath['package.additions.json']) as {
      dependencies: Record<string, string>;
    };
    expect(additions.dependencies['sst']).toBe('^4.15.0');
    expect(Object.values(additions.dependencies).every((v) => v !== 'latest')).toBe(true);
    const pkg = JSON.parse(byPath['package.json']) as {
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    expect(pkg.dependencies['next']).toBe('^16.0.0');
    // The lint script shipped without an eslint dependency — it is gone.
    expect(pkg.scripts.lint).toBeUndefined();
  });

  it('the embedded design.json re-imports to the identical blueprint', () => {
    const reparsed = parseBlueprint(byPath['sstdream.design.json']);
    expect(reparsed).toEqual(bp);
  });

  it('zips to a valid archive that round-trips every file', () => {
    const zipped = zipFiles(files);
    expect(zipped.byteLength).toBeGreaterThan(0);
    const unzipped = unzipSync(zipped);
    expect(Object.keys(unzipped).sort()).toEqual(files.map((f) => f.path).sort());
    expect(strFromU8(unzipped['sst.config.ts'])).toBe(byPath['sst.config.ts']);
  });

  it('zips under a root directory when requested', () => {
    const unzipped = unzipSync(zipFiles(files, 'my-app'));
    expect(Object.keys(unzipped).every((p) => p.startsWith('my-app/'))).toBe(true);
  });
});

// The export gate is enforced at the code boundary, not only in the UI: a design
// with validation errors must refuse to emit rather than produce a broken project.
describe('export gate is a buildExport invariant (#143)', () => {
  const APP = { name: 'gate-app', region: 'us-east-1', packageManager: 'yarn' as const };

  it('throws (does not emit) when the design has validation errors', () => {
    // A bucket named "Public" generates `const public` — a reserved-word error.
    const invalid = draftBlueprint(
      {
        nodes: [{ id: 'b', kind: 'bucket', name: 'Public', props: {}, position: { x: 0, y: 0 } }],
        edges: [],
      },
      'aws-sst-v4',
      APP,
      NOW,
    );
    expect(() => buildExport(invalid)).toThrow(/Cannot export/);
    expect(() => buildExport(invalid)).toThrow(/reserved/);
  });

  it('still emits for a warning-only design (warnings do not block)', () => {
    // A single bucket with no consumer is a warning, not an error.
    const warnOnly = draftBlueprint(
      {
        nodes: [{ id: 'b', kind: 'bucket', name: 'Uploads', props: {}, position: { x: 0, y: 0 } }],
        edges: [],
      },
      'aws-sst-v4',
      APP,
      NOW,
    );
    expect(() => buildExport(warnOnly)).not.toThrow();
    expect(buildExport(warnOnly).some((f) => f.path === 'sst.config.ts')).toBe(true);
  });
});
