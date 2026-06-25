import { simulateAws } from '@/lib/targets/aws-sst-v4/simulation';
import { simulateVercel } from '@/lib/targets/vercel/simulation';
import type { Blueprint } from '@/lib/core/blueprint/types';
import type { DeployTarget } from '@/lib/targets/types';
import type { SimTrace, SimulationProvider } from './types';

const SIMS: Partial<Record<DeployTarget, SimulationProvider>> = {
  'aws-sst-v4': simulateAws,
  vercel: simulateVercel,
};

export function simulateBlueprint(bp: Blueprint): SimTrace {
  const sim = SIMS[bp.target.deploy];
  if (!sim) {
    return {
      events: [
        {
          id: 'ev_0',
          status: 'warning',
          label: `Simulation is not available for the "${bp.target.deploy}" lane yet.`,
        },
      ],
      ok: true,
      brokenCount: 0,
    };
  }
  return sim(bp);
}

export type { SimTrace, SimEvent, SimStatus } from './types';
