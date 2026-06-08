import { create } from 'zustand';
import type { SimTrace } from '@/lib/core/simulation/types';

// UI state for simulation playback (kept separate from the canvas store so the
// canvas can color edges without re-running the simulation).
export interface SimUiState {
  trace: SimTrace | null;
  /** Playback position; -1 means "show the whole result". */
  index: number;
  playing: boolean;
  setTrace: (trace: SimTrace | null) => void;
  setIndex: (index: number) => void;
  setPlaying: (playing: boolean) => void;
}

export const useSimStore = create<SimUiState>((set) => ({
  trace: null,
  index: -1,
  playing: false,
  setTrace: (trace) => set({ trace, index: -1, playing: false }),
  setIndex: (index) => set({ index }),
  setPlaying: (playing) => set({ playing }),
}));
