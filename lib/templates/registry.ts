import type { DeployTarget } from '@/lib/targets/types';
import type { TemplateMeta } from './types';
import { AI_PROCESSING_APP } from './ai-processing-app';
import { VERCEL_SAAS } from './vercel-saas';
import { AWS_TEMPLATES } from './aws';

export const TEMPLATES: TemplateMeta[] = [
  {
    id: 'ai-processing',
    name: 'AI Processing App',
    description: 'Upload → queue → worker → DynamoDB. The end-to-end reference.',
    target: 'aws-sst-v4',
    tags: ['Pipeline'],
    ...AI_PROCESSING_APP,
  },
  ...AWS_TEMPLATES,
  {
    id: 'vercel-saas',
    name: 'Vercel SaaS',
    description: 'Blob, Postgres, queue + consumer, cron, Stripe webhook, Resend.',
    target: 'vercel',
    tags: ['SaaS'],
    ...VERCEL_SAAS,
  },
];

export function getTemplates(target: DeployTarget): TemplateMeta[] {
  return TEMPLATES.filter((t) => t.target === target);
}
