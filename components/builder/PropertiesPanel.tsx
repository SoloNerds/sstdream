'use client';

import { useCanvasStore } from '@/lib/canvas/store';
import { getTarget } from '@/lib/targets/registry';

export function PropertiesPanel() {
  const targetId = useCanvasStore((s) => s.targetId);
  const node = useCanvasStore((s) => s.nodes.find((n) => n.id === s.selectedId) ?? null);
  const edges = useCanvasStore((s) => s.edges);
  const nodes = useCanvasStore((s) => s.nodes);
  const renameNode = useCanvasStore((s) => s.renameNode);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const setEdgeIntent = useCanvasStore((s) => s.setEdgeIntent);

  const target = getTarget(targetId);

  if (!node) {
    return (
      <div className="p-3 text-sm text-neutral-500">Select a node to edit its properties.</div>
    );
  }

  const meta = target.catalog[node.kind];
  const nameOf = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;
  const outgoing = edges.filter((e) => e.source === node.id);

  return (
    <div className="flex flex-col gap-3 p-3">
      <div>
        <div className="text-xs uppercase tracking-wide text-neutral-500">Kind</div>
        <div className="text-sm font-medium">{meta.label}</div>
        <div className="font-mono text-[11px] text-neutral-400">{meta.component}</div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-neutral-500">Name</span>
        <input
          className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700"
          value={node.name}
          onChange={(e) => renameNode(node.id, e.target.value)}
        />
      </label>

      {outgoing.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-neutral-500">Connections</span>
          {outgoing.map((e) => (
            <div
              key={e.id}
              className="rounded-md border border-neutral-200 p-2 dark:border-neutral-800"
            >
              <div className="mb-1 text-xs text-neutral-500">→ {nameOf(e.target)}</div>
              <select
                className="w-full rounded border border-neutral-300 bg-transparent px-1 py-0.5 text-xs dark:border-neutral-700"
                value={e.intent}
                onChange={(ev) => setEdgeIntent(e.id, ev.target.value)}
              >
                {target.edgeIntents.map((i) => (
                  <option key={i.intent} value={i.intent}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => removeNode(node.id)}
        className="self-start rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
      >
        Delete node
      </button>
      <div className="mt-1 text-xs text-neutral-400">id: {node.id}</div>
    </div>
  );
}
