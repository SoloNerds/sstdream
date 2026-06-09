import type { CanvasSnapshot } from '@/lib/core/blueprint/serialize';
import type { AppConfigState } from '@/lib/canvas/store';

// Reference template for the Vercel lane: a SaaS app integrating services.
export const VERCEL_SAAS: { app: AppConfigState; snapshot: CanvasSnapshot } = {
  app: { name: 'vercel-saas', region: 'iad1', packageManager: 'yarn' },
  snapshot: {
    nodes: [
      { id: 'app_1', kind: 'app', name: 'Web', props: {}, position: { x: 60, y: 200 } },
      { id: 'blob_2', kind: 'blob', name: 'Files', props: {}, position: { x: 360, y: 40 } },
      { id: 'postgres_3', kind: 'postgres', name: 'Db', props: {}, position: { x: 360, y: 140 } },
      { id: 'queue_4', kind: 'queue', name: 'Jobs', props: {}, position: { x: 360, y: 260 } },
      {
        id: 'consumer_5',
        kind: 'consumer',
        name: 'Worker',
        props: {},
        position: { x: 640, y: 260 },
      },
      { id: 'email_6', kind: 'email', name: 'Mailer', props: {}, position: { x: 360, y: 360 } },
      {
        id: 'cron_7',
        kind: 'cron',
        name: 'Daily',
        props: { schedule: '0 5 * * *' },
        position: { x: 60, y: 380 },
      },
      {
        id: 'webhook_8',
        kind: 'webhook',
        name: 'StripeHook',
        props: {},
        position: { x: 60, y: 40 },
      },
    ],
    edges: [
      { id: 'edge_9', source: 'app_1', target: 'blob_2', intent: 'storesFileIn' },
      { id: 'edge_10', source: 'app_1', target: 'postgres_3', intent: 'writesToService' },
      { id: 'edge_11', source: 'app_1', target: 'queue_4', intent: 'enqueuesTo' },
      { id: 'edge_12', source: 'queue_4', target: 'consumer_5', intent: 'consumedBy' },
      { id: 'edge_13', source: 'app_1', target: 'email_6', intent: 'sendsEmailThrough' },
    ],
  },
};
