import { describe, it, expect } from 'vitest';
import { generateFiles } from '@/lib/core/codegen/generate';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { AI_PROCESSING_APP } from '@/lib/templates/ai-processing-app';

const NOW = '2026-06-08T00:00:00.000Z';

const files = generateFiles(
  draftBlueprint(AI_PROCESSING_APP.snapshot, 'aws-sst-v4', AI_PROCESSING_APP.app, NOW),
);
const byPath = Object.fromEntries(files.map((f) => [f.path, f.content]));

describe('runtime code generator — AI Processing App', () => {
  it('produces the full reference fileset (snapshot)', () => {
    expect(byPath).toMatchSnapshot();
  });

  it('generates every expected file', () => {
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(
      [
        '.gitignore',
        'AGENTS.md',
        'app/actions/create-upload-url.ts',
        'app/actions/enqueue-job.ts',
        'app/layout.tsx',
        'app/page.tsx',
        'lib/dynamo.ts',
        'lib/env.ts',
        'lib/queue.ts',
        'lib/storage.ts',
        'next.config.ts',
        'package.additions.json',
        'package.json',
        'required-env.json',
        'sst.config.ts',
        'src/workers/process-job.ts',
        'tsconfig.json',
      ].sort(),
    );
  });

  it('accesses linked resources via Resource from "sst" with the right names', () => {
    expect(byPath['lib/env.ts']).toContain('import { Resource } from "sst"');
    expect(byPath['lib/storage.ts']).toContain('Resource.Uploads.name');
    expect(byPath['lib/queue.ts']).toContain('Resource.Jobs.url');
    expect(byPath['lib/dynamo.ts']).toContain('Resource.AppTable.name');
  });

  it('wires the worker to its linked Dynamo table', () => {
    const worker = byPath['src/workers/process-job.ts'];
    expect(worker).toContain('import { putItem } from "../../lib/dynamo"');
    expect(worker).toContain('export async function handler(event:');
    expect(worker).toContain('JSON.parse(record.body)');
  });

  it('collects the right SDK deps in package.additions.json', () => {
    const pkg = JSON.parse(byPath['package.additions.json']) as {
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies).sort()).toEqual(
      [
        '@aws-sdk/client-dynamodb',
        '@aws-sdk/client-s3',
        '@aws-sdk/client-sqs',
        '@aws-sdk/lib-dynamodb',
        '@aws-sdk/s3-request-presigner',
        'sst',
      ].sort(),
    );
    expect(pkg.scripts).toMatchObject({ deploy: 'sst deploy', remove: 'sst remove' });
  });

  it('uses relative imports so files drop into any project', () => {
    expect(byPath['app/actions/create-upload-url.ts']).toContain('from "../../lib/storage"');
    expect(byPath['app/actions/enqueue-job.ts']).toContain('from "../../lib/queue"');
  });
});
