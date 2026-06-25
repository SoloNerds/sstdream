'use client';

import { useMemo } from 'react';
import { useCanvasStore } from '@/lib/canvas/store';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { validateBlueprint } from '@/lib/core/validation/validate';
import type { ValidationResult } from '@/lib/core/validation/types';

const FIXED_TS = '1970-01-01T00:00:00.000Z'; // validation ignores timestamps; keep memo stable

export function useValidation(): ValidationResult {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const app = useCanvasStore((s) => s.app);
  const targetId = useCanvasStore((s) => s.targetId);

  return useMemo(
    () => validateBlueprint(draftBlueprint({ nodes, edges }, targetId, app, FIXED_TS)),
    [nodes, edges, app, targetId],
  );
}
