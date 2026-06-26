import { createHash } from 'node:crypto';
import type { CapabilityManifest } from './manifest';

// A user's consent record for ONE plugin, pinned to the manifest content-hash. Consent is
// deny-by-default and the user's, never the plugin's. A manifest change flips the hash and forces
// re-consent (trust-on-first-use + pinning). This file is types + a pure hash only — no I/O, no
// credential handling, no loader. The grant store + the consent prompt are a later phase.

export interface PluginGrant {
  id: string;
  manifestHash: string;
  grantedScopes: {
    reads: string[];
    egress: string;
    egressHosts: string[];
  };
  grantedAt: string; // ISO timestamp, stamped by the caller
}

/** A stable content-hash of a manifest (top-level key order independent). Pure; no I/O. */
export function manifestHash(manifest: CapabilityManifest): string {
  const canonical = JSON.stringify(manifest, Object.keys(manifest).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

/** A grant is valid only while it pins the CURRENT manifest hash. */
export function isGrantCurrent(grant: PluginGrant, manifest: CapabilityManifest): boolean {
  return grant.manifestHash === manifestHash(manifest);
}
