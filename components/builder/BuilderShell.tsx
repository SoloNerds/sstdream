'use client';

import { Palette } from './Palette';
import { Canvas } from './Canvas';
import { PropertiesPanel } from './PropertiesPanel';

export function BuilderShell() {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">SSTDREAM</span>
          <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            AWS / SST v4
          </span>
        </div>
        <span className="text-xs text-neutral-400">M1 builder shell</span>
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
    </div>
  );
}
