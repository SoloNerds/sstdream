import type { CanvasSnapshot } from '@/lib/core/blueprint/serialize';
import type { AppConfigState } from '@/lib/canvas/store';
import type { DeployTarget } from '@/lib/targets/types';

export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  target: DeployTarget;
  /** Short tags for the picker (e.g. "AI", "SaaS"). */
  tags: string[];
  app: AppConfigState;
  snapshot: CanvasSnapshot;
}
