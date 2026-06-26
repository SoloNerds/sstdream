// Grounded "is my SST current?" check. The whole point of the agent's grounding: a model
// trained a year ago confidently emits DEPRECATED SST (the #1 SST LLM failure). This is
// the deterministic backbone of that grounding — it flags stale patterns against the
// VERIFIED facts in docs/sst-v4-target.md (cited), with NO model and NO network. The
// agent's model layer later narrates over these findings; it never invents them.

const DOC = 'docs/sst-v4-target.md';

interface Rule {
  id: string;
  /** Global regex over the file text. Multi-line allowed via [\s\S]. */
  pattern: RegExp;
  title: string;
  fix: string;
  ref: string; // section / line in the verified doc
}

const RULES: Rule[] = [
  {
    id: 'cron',
    pattern: /\bnew\s+sst\.aws\.Cron\s*\((?![\s\S]*V2)/g,
    title: '`sst.aws.Cron` is deprecated',
    fix: 'Use `sst.aws.CronV2` with a `function:` prop. A future SST major may remove `Cron`.',
    ref: '§4.6',
  },
  {
    id: 'cron-job-prop',
    pattern: /\bnew\s+sst\.aws\.CronV2\b[\s\S]{0,240}?\bjob\s*:/g,
    title: 'CronV2 takes `function:`, not `job:`',
    fix: 'Rename the `job:` prop to `function:`.',
    ref: '§4.6',
  },
  {
    id: 'sst-constructs',
    pattern: /\bfrom\s+["'`]sst\/constructs["'`]|import\s*\{[^}]*\bSSTConfig\b/g,
    title: '`sst/constructs` / `SSTConfig` is SST v2 (CDK)',
    fix: 'SST v4 defines resources as `new sst.aws.*` inside `$config({ async run() {} })`.',
    ref: '§1',
  },
  {
    id: 'provider-import',
    pattern: /\bfrom\s+["'`]@pulumi\/(?:aws|cloudflare|pulumi)["'`]/g,
    title: 'Provider packages are injected as globals',
    fix: 'Remove the `@pulumi/*` import — SST injects `aws`, `cloudflare`, … as globals.',
    ref: '§1',
  },
  {
    id: 'removal-destroy',
    pattern: /\bremoval\s*:\s*["'`]destroy["'`]/g,
    title: '`removal: "destroy"` is not a valid value',
    fix: 'Use `"remove" | "retain" | "retain-all"` (default `"retain"`).',
    ref: '§3',
  },
  {
    id: 'bucket-public-bool',
    pattern: /\bnew\s+sst\.aws\.Bucket\b[\s\S]{0,240}?\bpublic\s*:\s*true\b/g,
    title: 'Bucket `public: true` is not valid',
    fix: 'Use `access: "public"` (`"public" | "cloudfront"`) — there is no `public` boolean.',
    ref: '§4',
  },
];

export interface DeprecationHit {
  id: string;
  title: string;
  fix: string;
  doc: string; // provenance: which verified doc + section
  file: string;
  line: number;
  snippet: string;
}

const lineAt = (text: string, idx: number): number => text.slice(0, idx).split('\n').length;

/** Scan files for deprecated SST patterns. Pure; grounded in docs/sst-v4-target.md. */
export function findDeprecations(files: { path: string; text: string }[]): DeprecationHit[] {
  const hits: DeprecationHit[] = [];
  for (const f of files) {
    const lines = f.text.split('\n');
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      const seen = new Set<number>();
      while ((m = rule.pattern.exec(f.text)) !== null) {
        const line = lineAt(f.text, m.index);
        if (!seen.has(line)) {
          seen.add(line);
          hits.push({
            id: rule.id,
            title: rule.title,
            fix: rule.fix,
            doc: `${DOC} ${rule.ref}`,
            file: f.path,
            line,
            snippet: (lines[line - 1] ?? m[0]).trim().slice(0, 100),
          });
        }
        if (m.index === rule.pattern.lastIndex) rule.pattern.lastIndex++; // never zero-width loop
      }
    }
  }
  return hits;
}
