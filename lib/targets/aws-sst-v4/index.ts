import type { Target } from '../types';
import { AWS_CATALOG, AWS_CATALOG_ORDER } from './catalog';
import { AWS_EDGE_INTENTS, awsDefaultIntent } from './edges';

export const awsSstV4Target: Target = {
  id: 'aws-sst-v4',
  label: 'AWS / SST v4',
  catalog: AWS_CATALOG,
  catalogOrder: AWS_CATALOG_ORDER,
  edgeIntents: AWS_EDGE_INTENTS,
  defaultIntent: awsDefaultIntent,
};
