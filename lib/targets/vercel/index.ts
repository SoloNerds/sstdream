import type { Target } from '../types';
import { VERCEL_CATALOG, VERCEL_CATALOG_ORDER } from './catalog';
import { VERCEL_EDGE_INTENTS, vercelDefaultIntent } from './edges';

export const vercelTarget: Target = {
  id: 'vercel',
  label: 'Vercel',
  catalog: VERCEL_CATALOG,
  catalogOrder: VERCEL_CATALOG_ORDER,
  edgeIntents: VERCEL_EDGE_INTENTS,
  defaultIntent: vercelDefaultIntent,
};
