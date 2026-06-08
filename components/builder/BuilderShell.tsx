'use client';

import { useEffect } from 'react';
import { Palette } from './Palette';
import { Canvas } from './Canvas';
import { PropertiesPanel } from './PropertiesPanel';
import { Toolbar } from './Toolbar';
import { StatusBar } from './StatusBar';
import { useValidation } from './useValidation';
import { useCanvasStore } from '@/lib/canvas/store';
import { getTarget, isTargetImplemented } from '@/lib/targets/registry';
import { loadBlueprint, saveBlueprint } from '@/lib/core/blueprint/persistence';
import { blueprintToCanvas, canvasToBlueprint } from '@/lib/core/blueprint/serialize';

export function BuilderShell() {
  const targetId = useCanvasStore((s) => s.targetId);
  const validation = useValidation();

  // Restore the last design from localStorage on mount.
  useEffect(() => {
    const bp = loadBlueprint();
    if (bp && isTargetImplemented(bp.target.deploy)) {
      const s = useCanvasStore.getState();
      useCanvasStore.setState({ targetId: bp.target.deploy });
      s.setApp({ name: bp.app.name, region: bp.app.region, packageManager: bp.app.packageManager });
      s.loadSnapshot(blueprintToCanvas(bp));
    }
  }, []);

  // Debounced autosave on any change.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = useCanvasStore.subscribe((s) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const bp = canvasToBlueprint(
            { nodes: s.nodes, edges: s.edges },
            s.targetId,
            s.app,
            new Date().toISOString(),
          );
          saveBlueprint(bp);
        } catch {
          // invalid intermediate state (e.g. app name mid-edit) — skip this autosave
        }
      }, 400);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">SSTDREAM</span>
          <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {getTarget(targetId).label}
          </span>
        </div>
        <Toolbar validation={validation} />
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-neutral-200 dark:border-neutral-800">
          <Palette />
        </aside>
        <main className="min-w-0 flex-1">
          <Canvas />
        </main>
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-neutral-200 dark:border-neutral-800">
          <PropertiesPanel />
        </aside>
      </div>
      <StatusBar validation={validation} />
    </div>
  );
}
