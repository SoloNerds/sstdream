'use client';

import { useEffect, useState } from 'react';
import { Palette } from './Palette';
import { Canvas } from './Canvas';
import { InfraView } from './InfraView';
import { PropertiesPanel } from './PropertiesPanel';
import { SimulationPanel } from './SimulationPanel';
import { CostPanel } from './CostPanel';
import { RecommendationsPanel } from './RecommendationsPanel';
import { Toolbar } from './Toolbar';
import { StatusBar } from './StatusBar';
import { ThemeToggle } from './ThemeToggle';
import { useValidation } from './useValidation';

const TAB_LABEL = {
  properties: 'Props',
  simulation: 'Sim',
  cost: 'Cost',
  advice: 'Tips',
} as const;
import { useCanvasStore } from '@/lib/canvas/store';
import { isTargetImplemented, listTargets } from '@/lib/targets/registry';
import type { DeployTarget } from '@/lib/targets/types';
import { loadBlueprint, saveBlueprint } from '@/lib/core/blueprint/persistence';
import { blueprintToCanvas, canvasToBlueprint } from '@/lib/core/blueprint/serialize';

export function BuilderShell() {
  const targetId = useCanvasStore((s) => s.targetId);
  const validation = useValidation();
  const [tab, setTab] = useState<'properties' | 'simulation' | 'cost' | 'advice'>('properties');
  const [view, setView] = useState<'design' | 'infra'>('design');
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);

  // Restore the last design from localStorage on mount.
  useEffect(() => {
    const result = loadBlueprint();
    if (result.status === 'loaded' && isTargetImplemented(result.blueprint.target.deploy)) {
      const bp = result.blueprint;
      const s = useCanvasStore.getState();
      useCanvasStore.setState({ targetId: bp.target.deploy });
      s.setApp({ name: bp.app.name, region: bp.app.region, packageManager: bp.app.packageManager });
      s.loadSnapshot(blueprintToCanvas(bp));
    } else if (result.status === 'unreadable') {
      setRecoveryKey(result.recoveryKey);
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
          <select
            aria-label="Deploy lane"
            value={targetId}
            onChange={(e) => {
              const { nodes } = useCanvasStore.getState();
              if (
                nodes.length > 0 &&
                !window.confirm('Switching lanes clears the current canvas. Continue?')
              ) {
                return;
              }
              useCanvasStore.setState({ targetId: e.target.value as DeployTarget });
              useCanvasStore.getState().reset();
            }}
            className="rounded border border-neutral-300 bg-transparent px-2 py-0.5 text-xs dark:border-neutral-700"
          >
            {listTargets().map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <div className="ml-1 flex overflow-hidden rounded-md border border-neutral-300 text-xs dark:border-neutral-700">
            {(['design', 'infra'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={
                  view === v
                    ? 'bg-indigo-600 px-2.5 py-0.5 font-medium text-white'
                    : 'px-2.5 py-0.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }
              >
                {v === 'design' ? 'Design' : 'Infrastructure'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Toolbar validation={validation} />
          <ThemeToggle />
        </div>
      </header>
      {recoveryKey && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        >
          <span>
            Your previous design could not be loaded (it may be corrupt or from a different
            version). The raw data was preserved in this browser under the localStorage key{' '}
            <code className="rounded bg-amber-100 px-1 font-mono dark:bg-amber-900">
              {recoveryKey}
            </code>
            .
          </span>
          <button
            type="button"
            onClick={() => setRecoveryKey(null)}
            className="shrink-0 rounded border border-amber-400 px-2 py-0.5 hover:bg-amber-100 dark:border-amber-600 dark:hover:bg-amber-900"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-neutral-200 dark:border-neutral-800">
          <Palette />
        </aside>
        <main className="min-w-0 flex-1">{view === 'design' ? <Canvas /> : <InfraView />}</main>
        <aside className="flex w-72 shrink-0 flex-col border-l border-neutral-200 dark:border-neutral-800">
          <div className="flex shrink-0 border-b border-neutral-200 text-xs dark:border-neutral-800">
            {(['properties', 'simulation', 'cost', 'advice'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 px-2 py-1.5 ${
                  tab === t
                    ? 'border-b-2 border-indigo-500 font-medium'
                    : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                }`}
              >
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === 'properties' && <PropertiesPanel />}
            {tab === 'simulation' && <SimulationPanel />}
            {tab === 'cost' && <CostPanel />}
            {tab === 'advice' && <RecommendationsPanel />}
          </div>
        </aside>
      </div>
      <StatusBar validation={validation} />
    </div>
  );
}
