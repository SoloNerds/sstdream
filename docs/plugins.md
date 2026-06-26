# Plugins (foundation — prep only)

SSTDREAM is growing a plugin system so the credential-touching parts (cloud metric connectors,
AI providers, notification channels, custom panels and rules) are **opt-in, user-installed, and
scoped** instead of baked into a credential-free core. The community can build the long tail.

This doc describes the foundation that exists today. **No plugin can load yet.** There is no
loader, no connector, and nothing touches credentials. What is built is the contract, the trust
primitives, and the wall that keeps plugins out of the static page.

## The one hard rule

**Plugins never ship in the static web page everyone loads.** The plugin host lives only in the
local CLI runtime. The static export (`output: 'export'`, served on GitHub Pages) must never
contain plugin-host code. This is enforced two ways, not by review:

1. **Structural** — the host (`lib/plugin-host/`) is reached only from `cli/`, never from `app/`
   or `components/`. A module unreachable from `app/` is absent from the tree-shaken bundle.
2. **CI** — `lib/plugin-host/static-bundle.test.ts` scans the import graph from `app/` + `components/`
   and fails on any path into `lib/plugin-host`. A second guard greps the built `out/` for a host
   sentinel string. Both run in the `verify` gate.

The static builder stays zero-AI, zero-network, credential-free. The codegen stays deterministic.

## The trust model: declare → consent → contain

1. **Declare** — a plugin ships a `CapabilityManifest` (`lib/plugin-host/manifest.ts`): what it
   reads, whether it needs network egress and to which **allowlisted bare FQDNs** (no wildcards),
   and which named credentials. v1 is **read-only**: the `writes` axis only accepts `"none"`.
2. **Consent** — plugins are **off by default**. The host shows the manifest in plain English and
   the user grants it, pinned to the manifest content-hash. Change the manifest and the hash flips,
   forcing re-consent.
3. **Contain** — the host owns every network/fs/credential handle. A plugin gets a capability-scoped
   facade, never raw `fetch`/`fs`/`process.env`. The only way out is `sanitizedEgressFetch`, which
   checks the host allowlist, runs the adversarial redactor (`scripts/sanitize.mjs`) over the
   payload before any byte leaves the process, and audit-logs the call.

## What a manifest is, and is not

A manifest is a **declaration you read and consent to** — like reviewing what `npm install` pulls
in. **It is not an enforced sandbox.** In un-sandboxed Node, plugin code you choose to run can do
anything Node can. v1 treats a plugin as _code you chose to run_ (same trust as `npm install`):
off by default, pinned by hash, and contained at the egress seam. **Process/WASM isolation and
signing are v2**, and they gate any "install a community plugin you didn't write" story. We will
not market v1 plugins as a security boundary they are not.

## Status

- **Now (this prep):** the manifest schema, the `Plugin` / `HostFacade` contract, the runtime
  registry shape, the grant/hash types, and the static-exclusion guards. Nothing loads.
- **Next:** the sanitize-at-egress seam, the consent/grant store, then the loader, then the first
  signed first-party connector (a read-only CloudWatch or Vercel metric source). Community/third-party
  loading and a public registry come after a first-party connector has battle-tested the contract,
  and after isolation lands.
