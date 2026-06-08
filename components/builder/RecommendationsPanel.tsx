'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/lib/canvas/store';
import { draftBlueprint, blueprintToCanvas } from '@/lib/core/blueprint/serialize';
import { recommendBlueprint } from '@/lib/core/recommendations/recommend';
import type { Recommendation, RecKind } from '@/lib/core/recommendations/types';

const FIXED = '1970-01-01T00:00:00.000Z';
const KIND_TONE: Record<RecKind, string> = {
  wiring: 'text-indigo-600',
  reliability: 'text-amber-600',
  'best-practice': 'text-emerald-600',
};

export function RecommendationsPanel() {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const appCfg = useCanvasStore((s) => s.app);
  const targetId = useCanvasStore((s) => s.targetId);
  const loadSnapshot = useCanvasStore((s) => s.loadSnapshot);
  const setApp = useCanvasStore((s) => s.setApp);
  const select = useCanvasStore((s) => s.select);

  const recs = useMemo(
    () => recommendBlueprint(draftBlueprint({ nodes, edges }, targetId, appCfg, FIXED)),
    [nodes, edges, appCfg, targetId],
  );

  const apply = (rec: Recommendation) => {
    if (!rec.apply) return;
    const s = useCanvasStore.getState();
    const bp = draftBlueprint({ nodes: s.nodes, edges: s.edges }, s.targetId, s.app, FIXED);
    const next = rec.apply(bp);
    setApp({
      name: next.app.name,
      region: next.app.region,
      packageManager: next.app.packageManager,
    });
    loadSnapshot(blueprintToCanvas(next));
  };

  return (
    <div className="flex flex-col gap-2 p-3 text-xs">
      {recs.length === 0 && (
        <p className="text-neutral-500">No recommendations — your design looks solid. 🎉</p>
      )}
      {recs.map((rec) => (
        <div
          key={rec.id}
          className="rounded-md border border-neutral-200 p-2 dark:border-neutral-800"
        >
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              className="text-left font-medium"
              onClick={() => rec.resourceId && select(rec.resourceId)}
            >
              <span className={`mr-1 ${KIND_TONE[rec.kind]}`}>●</span>
              {rec.title}
            </button>
            {rec.apply && (
              <Button size="sm" variant="outline" onClick={() => apply(rec)}>
                Apply
              </Button>
            )}
          </div>
          <p className="mt-1 text-neutral-500">{rec.detail}</p>
        </div>
      ))}
    </div>
  );
}
