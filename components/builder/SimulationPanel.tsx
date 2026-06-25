'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/lib/canvas/store';
import { useSimStore } from '@/lib/canvas/simStore';
import { draftBlueprint } from '@/lib/core/blueprint/serialize';
import { simulateBlueprint } from '@/lib/core/simulation/simulate';
import type { SimStatus } from '@/lib/core/simulation/types';

const DOT: Record<SimStatus, string> = {
  ok: 'text-emerald-600',
  broken: 'text-red-600',
  warning: 'text-amber-600',
};

export function SimulationPanel() {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const select = useCanvasStore((s) => s.select);
  const trace = useSimStore((s) => s.trace);
  const index = useSimStore((s) => s.index);
  const playing = useSimStore((s) => s.playing);
  const setTrace = useSimStore((s) => s.setTrace);
  const setIndex = useSimStore((s) => s.setIndex);
  const setPlaying = useSimStore((s) => s.setPlaying);

  // A sim becomes stale when the design changes.
  useEffect(() => {
    setTrace(null);
  }, [nodes, edges, setTrace]);

  const compute = () => {
    const s = useCanvasStore.getState();
    return simulateBlueprint(
      draftBlueprint(
        { nodes: s.nodes, edges: s.edges },
        s.targetId,
        s.app,
        '1970-01-01T00:00:00.000Z',
      ),
    );
  };

  const run = () => setTrace(compute());
  const play = () => {
    setTrace(compute());
    setIndex(0);
    setPlaying(true);
  };

  useEffect(() => {
    if (!playing || !trace) return;
    if (index >= trace.events.length - 1) {
      setPlaying(false);
      setIndex(-1);
      return;
    }
    const t = setTimeout(() => setIndex(index + 1), 650);
    return () => clearTimeout(t);
  }, [playing, index, trace, setIndex, setPlaying]);

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={run}>
          Simulate
        </Button>
        <Button size="sm" variant="outline" onClick={play}>
          ▶ Play
        </Button>
        {trace && (
          <span className={`text-xs ${trace.ok ? 'text-emerald-600' : 'text-red-600'}`}>
            {trace.ok ? 'everything talks ✓' : `${trace.brokenCount} broken`}
          </span>
        )}
      </div>
      {!trace && (
        <p className="text-xs text-neutral-500">
          Trace the data flow through your design — no deploy. Broken hops (a queue with no
          consumer, an untriggered worker) light up red on the canvas.
        </p>
      )}
      {trace && (
        <ol className="flex flex-col gap-0.5 text-xs">
          {trace.events.map((e, i) => (
            <li
              key={e.id}
              onClick={() => {
                setPlaying(false);
                setIndex(i);
                if (e.sourceId) select(e.sourceId);
              }}
              className={`flex cursor-pointer gap-2 rounded px-2 py-1 ${
                i === index ? 'bg-neutral-200 dark:bg-neutral-800' : ''
              }`}
            >
              <span className={DOT[e.status]}>●</span>
              <span className="flex-1">
                {e.label}
                {e.detail && <span className="block text-neutral-400">{e.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
