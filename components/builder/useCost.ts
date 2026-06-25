'use client';

import { useMemo } from 'react';
import { useCanvasStore } from '@/lib/canvas/store';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { estimateCost } from '@/lib/core/cost/estimate';
import type { CostEstimate } from '@/lib/core/cost/types';

export function useCost(): CostEstimate {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const app = useCanvasStore((s) => s.app);
  const targetId = useCanvasStore((s) => s.targetId);

  return useMemo(
    () => estimateCost(draftBlueprint({ nodes, edges }, targetId, app, '1970-01-01T00:00:00.000Z')),
    [nodes, edges, app, targetId],
  );
}
