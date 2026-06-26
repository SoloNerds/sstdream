import { z } from 'zod';

// SSTDREAM plugin capability manifest. A plugin DECLARES what it needs here; the host grants
// nothing it did not declare. This is the foundation of the plugin trust model:
//   declare (this manifest) → consent (a hash-pinned user grant) → contain (sanitize-at-egress).
//
// IMPORTANT: a manifest is a DECLARATION the user reads and consents to, NOT an enforced sandbox.
// In un-sandboxed Node, plugin code you choose to run can still do anything Node can. v1 treats a
// plugin as "code you chose to run" (same trust as `npm install`), OFF by default, pinned by hash.
// Process/WASM isolation and signing are v2 and gate any community-install story. See docs/plugins.md.
//
// This module lives ONLY in the local CLI runtime. It must never enter the static web export —
// guarded structurally + by CI (static-bundle.test.ts + the out/ sentinel grep in CI).

/** The egress vocabulary, shared by plugins AND the AI provider seam (one source of truth). */
export type Egress = 'none' | 'local' | 'hosted';

/** What a plugin may READ. The host owns the handles; the plugin only declares intent. */
export const READ_CAPABILITIES = [
  'graph', // the scanned infra graph (sanitized already)
  'scan-json', // a sstdream-scan.json on disk
  'repo-files', // sanitized repo source snippets
  'cloud:aws:cloudwatch:ro', // read-only CloudWatch (a future connector)
  'cloud:vercel:ro', // read-only Vercel API
] as const;
export type ReadCapability = (typeof READ_CAPABILITIES)[number];

export const PLUGIN_KINDS = ['connector', 'provider', 'notifier', 'panel', 'analyzer'] as const;
export type PluginKind = (typeof PLUGIN_KINDS)[number];

// Allowlisted hosts are bare FQDNs. No wildcards, no scheme, no path, no port. An empty allowlist
// with egress !== 'none' is rejected, so "phone home anywhere" is unrepresentable.
const FQDN = /^(?!.*\*)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

export const CapabilityManifestSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'id must be kebab-case'),
    kind: z.enum(PLUGIN_KINDS),
    version: z.string().default('0.0.0'),
    egress: z.enum(['none', 'local', 'hosted']).default('none'),
    egressHosts: z
      .array(z.string().regex(FQDN, 'egress host must be a bare FQDN, no wildcards'))
      .default([]),
    reads: z.array(z.enum(READ_CAPABILITIES)).default([]),
    // v1 is READ-ONLY. The `writes` axis exists so the format never has to migrate, but only
    // "none" parses — the host never hands a write / deploy / codegen handle to a plugin.
    writes: z.literal('none').default('none'),
    credentials: z.array(z.string()).default([]), // named references only, never values
    integrity: z.string().optional(), // present-but-unverified in v1 (signing is v2)
  })
  .strict()
  .superRefine((m, ctx) => {
    if (m.egress !== 'none' && m.egressHosts.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['egressHosts'],
        message: `egress "${m.egress}" requires a non-empty egressHosts allowlist`,
      });
    }
  });

export type CapabilityManifest = z.infer<typeof CapabilityManifestSchema>;
