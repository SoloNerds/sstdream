// Canvas-local UI state for M1. NOT the blueprint envelope — that arrives in M2
// (lib/core/blueprint) and is target-aware. These five kinds are hard-coded for
// the M1 shell and will be replaced by the target-driven catalog in M2.

export const NODE_KINDS = ['nextjs', 'bucket', 'queue', 'worker', 'dynamo'] as const;

export type NodeKind = (typeof NODE_KINDS)[number];

export interface CanvasNode {
  id: string;
  kind: NodeKind;
  label: string;
  position: { x: number; y: number };
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
}
