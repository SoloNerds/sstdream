import type { CanvasSnapshot } from '@/lib/core/blueprint/serialize';
import type { AppConfigState } from '@/lib/canvas/store';

// The reference proof template (AWS lane): the north star that must round-trip
// and export to a deployable SST project end to end.
export const AI_PROCESSING_APP: {
  app: AppConfigState;
  snapshot: CanvasSnapshot;
} = {
  app: { name: 'ai-processing-app', region: 'us-east-1', packageManager: 'yarn' },
  snapshot: {
    nodes: [
      { id: 'nextjs_1', kind: 'nextjs', name: 'Web', props: {}, position: { x: 40, y: 180 } },
      { id: 'bucket_2', kind: 'bucket', name: 'Uploads', props: {}, position: { x: 340, y: 40 } },
      { id: 'queue_3', kind: 'queue', name: 'Jobs', props: {}, position: { x: 340, y: 200 } },
      {
        id: 'worker_4',
        kind: 'worker',
        name: 'ProcessJob',
        props: {},
        position: { x: 620, y: 200 },
      },
      { id: 'dynamo_5', kind: 'dynamo', name: 'AppTable', props: {}, position: { x: 900, y: 200 } },
    ],
    edges: [
      { id: 'edge_6', source: 'nextjs_1', target: 'bucket_2', intent: 'uploadsTo' },
      { id: 'edge_7', source: 'nextjs_1', target: 'queue_3', intent: 'publishesTo' },
      { id: 'edge_8', source: 'worker_4', target: 'queue_3', intent: 'subscribesTo' },
      { id: 'edge_9', source: 'worker_4', target: 'dynamo_5', intent: 'writesTo' },
    ],
  },
};
