import type { Blueprint } from '@/lib/core/blueprint/types';

export type SimStatus = 'ok' | 'broken' | 'warning';

export interface SimEvent {
  id: string;
  /** Connection id this event traces, for canvas highlighting. */
  edgeId?: string;
  sourceId?: string;
  targetId?: string;
  status: SimStatus;
  label: string;
  detail?: string;
}

export interface SimTrace {
  events: SimEvent[];
  ok: boolean;
  brokenCount: number;
}

export type SimulationProvider = (bp: Blueprint) => SimTrace;
