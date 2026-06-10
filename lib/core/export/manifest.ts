import { generateFiles } from '@/lib/core/codegen/generate';
import { serializeBlueprint } from '@/lib/core/blueprint/serialize';
import { buildAwsReadme, buildAwsEnvExample } from '@/lib/targets/aws-sst-v4/docs';
import { buildVercelReadme, buildVercelEnvExample } from '@/lib/targets/vercel/docs';
import type { Blueprint } from '@/lib/core/blueprint/types';
import type { GeneratedFile } from '@/lib/core/codegen/types';
import type { DeployTarget } from '@/lib/targets/types';

interface DocsBuilder {
  readme: (bp: Blueprint, deps: string[], devDeps: string[]) => string;
  envExample: (bp: Blueprint) => string;
}

const DOCS: Partial<Record<DeployTarget, DocsBuilder>> = {
  'aws-sst-v4': { readme: buildAwsReadme, envExample: buildAwsEnvExample },
  vercel: { readme: buildVercelReadme, envExample: buildVercelEnvExample },
};

function depsFrom(files: GeneratedFile[]): { deps: string[]; devDeps: string[] } {
  const pkg = files.find((f) => f.path === 'package.additions.json');
  if (!pkg) return { deps: [], devDeps: [] };
  try {
    const parsed = JSON.parse(pkg.content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return {
      deps: Object.keys(parsed.dependencies ?? {}).filter((d) => d !== 'sst'),
      devDeps: Object.keys(parsed.devDependencies ?? {}),
    };
  } catch {
    return { deps: [], devDeps: [] };
  }
}

/** Assemble the complete export manifest: generated code + README + env + design.json. */
export function buildExport(bp: Blueprint): GeneratedFile[] {
  const code = generateFiles(bp);
  const docs = DOCS[bp.target.deploy];
  const extras: GeneratedFile[] = [];

  if (docs) {
    const { deps, devDeps } = depsFrom(code);
    extras.push({ path: 'README.md', content: docs.readme(bp, deps, devDeps), language: 'md' });
    extras.push({ path: '.env.example', content: docs.envExample(bp), language: 'env' });
  }
  extras.push({
    path: 'sstdream.design.json',
    content: serializeBlueprint(bp),
    language: 'json',
  });

  // README first for a friendly file list, then code, then design.json.
  const readme = extras.filter((f) => f.path === 'README.md');
  const rest = extras.filter((f) => f.path !== 'README.md');
  return [...readme, ...code, ...rest].sort((a, b) =>
    a.path === 'README.md' ? -1 : b.path === 'README.md' ? 1 : 0,
  );
}
