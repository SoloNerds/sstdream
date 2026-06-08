'use client';

import { useCanvasStore } from '@/lib/canvas/store';
import { NODE_CATALOG } from '@/lib/canvas/catalog';

export function PropertiesPanel() {
  const node = useCanvasStore((s) => s.nodes.find((n) => n.id === s.selectedId) ?? null);
  const renameNode = useCanvasStore((s) => s.renameNode);
  const removeNode = useCanvasStore((s) => s.removeNode);

  if (!node) {
    return (
      <div className="p-3 text-sm text-neutral-500">Select a node to edit its properties.</div>
    );
  }

  const meta = NODE_CATALOG[node.kind];

  return (
    <div className="flex flex-col gap-3 p-3">
      <div>
        <div className="text-xs uppercase tracking-wide text-neutral-500">Kind</div>
        <div className="text-sm font-medium">{meta.label}</div>
        <div className="text-xs text-neutral-400">{meta.description}</div>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-neutral-500">Name</span>
        <input
          className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700"
          value={node.label}
          onChange={(e) => renameNode(node.id, e.target.value)}
        />
      </label>
      <button
        type="button"
        onClick={() => removeNode(node.id)}
        className="self-start rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
      >
        Delete node
      </button>
      <div className="mt-2 text-xs text-neutral-400">id: {node.id}</div>
    </div>
  );
}
