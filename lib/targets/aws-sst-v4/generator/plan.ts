import type { Blueprint, Resource } from '@/lib/core/blueprint/types';
import { camelCase, kebabCase, uniq } from '@/lib/core/codegen/strings';

// A resolved generation plan: variable names, link arrays, and worker roles.
// Shared by the sst.config.ts generator (M4) and the runtime code generator (M5)
// so both agree on handler paths, links, and which worker is wired how.

export interface SubscriberPlan {
  worker: Resource;
  queueVar: string;
  handlerPath: string; // e.g. "src/workers/process-job.handler"
  handlerFile: string; // e.g. "src/workers/process-job.ts"
  linkVars: string[];
}

export interface FunctionPlan {
  worker: Resource;
  varName: string;
  handlerPath: string;
  handlerFile: string;
  linkVars: string[];
}

export interface CronPlan {
  cron: Resource;
  schedule: string;
  handlerPath?: string;
  handlerFile?: string;
  linkVars: string[];
}

export interface AwsPlan {
  bp: Blueprint;
  varNameById: Map<string, string>;
  /** Link variable names per resource id (target vars of its outgoing helper edges). */
  linkVarsById: Map<string, string[]>;
  /** Resources that get a `const x = new ...` declaration, in declaration order. */
  declared: Resource[];
  subscribers: SubscriberPlan[];
  functions: FunctionPlan[];
  crons: CronPlan[];
  /** Worker resources, by their handler file, that need a generated handler. */
  workerHandlerFiles: string[];
}

const DECL_ORDER: Record<string, number> = {
  secret: 0,
  ai: 0,
  email: 0,
  cognito: 0,
  bucket: 1,
  dynamo: 2,
  postgres: 2,
  queue: 3,
  worker: 4,
  nextjs: 5,
  staticsite: 5,
};

export function planAws(bp: Blueprint): AwsPlan {
  const outgoing = (id: string) => bp.connections.filter((c) => c.source === id);
  const incoming = (id: string) => bp.connections.filter((c) => c.target === id);
  const subEdge = (w: Resource) => outgoing(w.id).find((c) => c.intent === 'subscribesTo');
  const isSubscriber = (w: Resource) => Boolean(subEdge(w));
  const isCronInvoked = (w: Resource) => incoming(w.id).some((c) => c.intent === 'invokes');

  const varNameById = new Map<string, string>();
  for (const r of bp.resources) {
    const standalone =
      r.kind === 'secret' ||
      r.kind === 'ai' ||
      r.kind === 'email' ||
      r.kind === 'cognito' ||
      r.kind === 'bucket' ||
      r.kind === 'dynamo' ||
      r.kind === 'postgres' ||
      r.kind === 'queue' ||
      r.kind === 'nextjs' ||
      r.kind === 'staticsite' ||
      (r.kind === 'worker' && !isSubscriber(r) && !isCronInvoked(r));
    if (standalone) varNameById.set(r.id, camelCase(r.name));
  }

  const linkVarsFor = (id: string): string[] =>
    uniq(
      outgoing(id)
        .filter((c) => c.intent !== 'subscribesTo' && c.intent !== 'invokes')
        .map((c) => varNameById.get(c.target))
        .filter((v): v is string => Boolean(v)),
    );

  const handlerPathFor = (w: Resource) => `src/workers/${kebabCase(w.name)}.handler`;
  const handlerFileFor = (w: Resource) => `src/workers/${kebabCase(w.name)}.ts`;

  const subscribers: SubscriberPlan[] = bp.resources
    .filter((r) => r.kind === 'worker' && isSubscriber(r))
    .map((w) => ({
      worker: w,
      queueVar: varNameById.get(subEdge(w)!.target) ?? camelCase(w.name),
      handlerPath: handlerPathFor(w),
      handlerFile: handlerFileFor(w),
      linkVars: linkVarsFor(w.id),
    }));

  const functions: FunctionPlan[] = bp.resources
    .filter((r) => r.kind === 'worker' && !isSubscriber(r) && !isCronInvoked(r))
    .map((w) => ({
      worker: w,
      varName: varNameById.get(w.id)!,
      handlerPath: handlerPathFor(w),
      handlerFile: handlerFileFor(w),
      linkVars: linkVarsFor(w.id),
    }));

  const crons: CronPlan[] = bp.resources
    .filter((r) => r.kind === 'cron')
    .map((c) => {
      const inv = outgoing(c.id).find((e) => e.intent === 'invokes');
      const worker = inv ? bp.resources.find((r) => r.id === inv.target) : undefined;
      const schedule = typeof c.props.schedule === 'string' ? c.props.schedule : 'rate(1 day)';
      return {
        cron: c,
        schedule,
        handlerPath: worker ? handlerPathFor(worker) : undefined,
        handlerFile: worker ? handlerFileFor(worker) : undefined,
        linkVars: worker ? linkVarsFor(worker.id) : [],
      };
    });

  const linkVarsById = new Map(bp.resources.map((r) => [r.id, linkVarsFor(r.id)]));

  const declared = bp.resources
    .filter((r) => varNameById.has(r.id))
    .sort((a, b) => (DECL_ORDER[a.kind] ?? 9) - (DECL_ORDER[b.kind] ?? 9));

  const workerHandlerFiles = uniq([
    ...subscribers.map((s) => s.handlerFile),
    ...functions.map((f) => f.handlerFile),
    ...crons.map((c) => c.handlerFile).filter((f): f is string => Boolean(f)),
  ]);

  return {
    bp,
    varNameById,
    linkVarsById,
    declared,
    subscribers,
    functions,
    crons,
    workerHandlerFiles,
  };
}
