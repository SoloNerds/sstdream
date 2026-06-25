// Canvas-local UI state. The blueprint envelope (lib/core/blueprint) is the durable
// model; the store converts to/from it. `kind` and `intent` are validated against
// the active Target's catalog (lib/targets) at runtime.

export interface CanvasNode {
  id: string;
  kind: string;
  name: string;
  props: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  intent: string;
}
