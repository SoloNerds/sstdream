import type { CanvasNode, CanvasEdge } from '@/lib/canvas/types';
import type { CapabilityManifest, Egress } from './manifest';

// If this string ever appears in the static export (out/), a plugin-host module leaked into the
// page everyone loads — the one thing the owner's hard constraint forbids. CI greps out/ for it
// after the build and fails. (See static-bundle.test.ts for the structural check + ci.yml.)
export const PLUGIN_HOST_SENTINEL = '__SSTDREAM_PLUGIN_HOST_NEVER_IN_STATIC_BUNDLE__';

/** A read-only, frozen view of the scanned graph. Plugins read it; they never mutate it. */
export interface GraphView {
  readonly nodes: readonly Readonly<CanvasNode>[];
  readonly edges: readonly Readonly<CanvasEdge>[];
}

export interface EgressInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}
export interface EgressResponse {
  status: number;
  body: string;
}

// ── The five seam contracts. DECLARED only — no implementations ship in this PR. ───────────────
// Each seam gets its own narrow interface (an async/stateful/credential-bearing connector must
// not be forced into the pure deterministic analyzer mold).

/** Read-only cloud/metric source, keyed by graph node. `query` lands with the first connector. */
export interface MetricConnector {
  readonly id: string;
  supports(nodeKind: string): boolean;
}

/** BYO model. Mirrors the agent's ChatProvider; the egress vocabulary is shared. */
export interface AiProvider {
  readonly id: string;
  readonly egress: Egress;
  complete(system: string, user: string): Promise<string>;
}

/** Egress-only (e.g. a Slack/Discord webhook). No reads. */
export interface NotificationChannel {
  readonly id: string;
}

/** A localhost-dashboard render contributor keyed by node kind. egress 'none'. */
export interface NodeDetailPanel {
  readonly id: string;
  readonly forKind: string;
}

/** Pure graph-in / findings-out. Credential-free, and barred from the generator like the agent. */
export interface Analyzer {
  readonly id: string;
}

// The capability-scoped facade. A plugin receives ONLY this. It never gets raw fetch, fs,
// process.env, or cloud SDK clients. Every byte out goes through sanitizedEgressFetch, which
// (a) enforces the manifest host allowlist, (b) runs the redactor before bytes leave the process,
// (c) audit-logs the call. The host owns all I/O; the plugin owns intent.
export interface HostFacade {
  readGraph(): GraphView;
  sanitizedEgressFetch(host: string, init?: EgressInit): Promise<EgressResponse>;
  registerConnector(c: MetricConnector): void;
  registerProvider(p: AiProvider): void;
  registerNotifier(n: NotificationChannel): void;
  registerPanel(p: NodeDetailPanel): void;
  registerAnalyzer(a: Analyzer): void;
}

// The entire stable plugin surface: a manifest + an activate(). Deliberately tiny so it stays
// stable while connectors churn underneath.
export interface Plugin {
  readonly manifest: CapabilityManifest;
  activate(host: HostFacade): void | Promise<void>;
}

// A reference host that GRANTS NOTHING. It proves the contract type-checks; it loads no plugin,
// touches no credential, and makes no network call. The real host (consent + sanitize-at-egress +
// audit) is a later phase. Referencing the sentinel keeps it live if this module were ever
// (wrongly) bundled, so the out/ grep can catch the leak.
export const inertHost: HostFacade = {
  readGraph: () => ({ nodes: [], edges: [] }),
  sanitizedEgressFetch: () => {
    throw new Error(`${PLUGIN_HOST_SENTINEL}: the inert reference host grants no egress`);
  },
  registerConnector: () => {},
  registerProvider: () => {},
  registerNotifier: () => {},
  registerPanel: () => {},
  registerAnalyzer: () => {},
};
