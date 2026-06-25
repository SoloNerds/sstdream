import type { Blueprint, Resource } from '@/lib/core/blueprint/types';
import { camelCase, kebabCase, uniq } from '@/lib/core/codegen/strings';

// A resolved generation plan: variable names, link arrays, and worker roles.
// Shared by the sst.config.ts generator (M4) and the runtime code generator (M5)
// so both agree on handler paths, links, and which worker is wired how.

export interface SubscriberPlan {
  worker: Resource;
  /** The queue/bus/topic variable the worker subscribes to. */
  targetVar: string;
  /** Resource id of the subscribed queue/bus/topic. */
  targetId: string;
  /** Kind of the subscribed resource — drives the subscribe() call shape. */
  targetKind: 'queue' | 'bus' | 'snstopic' | 'dynamo';
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
  /** Resource id of the invoked worker, when one is wired. */
  workerId?: string;
  handlerPath?: string;
  handlerFile?: string;
  linkVars: string[];
}

export interface RoutePlan {
  worker: Resource;
  apiVar: string;
  route: string; // e.g. "POST /webhooks/stripe"
  handlerPath: string;
  handlerFile: string;
  linkVars: string[];
}

export interface BucketNotifyPlan {
  bucketVar: string;
  bucketName: string;
  notifiers: {
    worker: Resource;
    name: string;
    handlerPath: string;
    handlerFile: string;
    linkVars: string[];
  }[];
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
  routes: RoutePlan[];
  bucketNotifies: BucketNotifyPlan[];
  routerBuckets: { routerVar: string; bucketVar: string; path: string }[];
  /** Worker resources, by their handler file, that need a generated handler. */
  workerHandlerFiles: string[];
  /** Resources placed in the generated VPC (they query Postgres/Aurora). */
  vpcConsumerIds: Set<string>;
}

/** Resources that query Postgres/Aurora — their functions must join the VPC
 *  (linking grants credentials, not network reachability). */
export function vpcConsumerIds(bp: Blueprint): Set<string> {
  const byId = new Map(bp.resources.map((r) => [r.id, r]));
  return new Set(
    bp.connections
      .filter((c) => {
        const t = byId.get(c.target);
        if (c.intent === 'queriesDb') return t?.kind === 'postgres' || t?.kind === 'aurora';
        if (c.intent === 'usesCache') return t?.kind === 'redis';
        return false;
      })
      .map((c) => c.source),
  );
}

// SST VPCs have NO NAT by default, and private-subnet Lambdas have no internet
// access without one (the Vpc docs list no default gateway endpoints either).
// So once a consumer is placed in the VPC, floor NAT at "ec2" (fck-nat, ~$4/mo)
// or its calls to public endpoints (SES, Dynamo, S3, external APIs) hang.
// Strongest explicit request still wins: managed > ec2.
export function effectiveAwsNat(bp: Blueprint): 'none' | 'ec2' | 'managed' {
  // postgres/aurora/redis all live in the shared VPC. redis has no `nat` prop of its
  // own (you don't reach a cache over the internet), but it still forces the VPC, and
  // any consumer that joins it to reach the cache + the public internet needs egress.
  const vpcResources = bp.resources.filter(
    (r) =>
      r.kind === 'postgres' || r.kind === 'aurora' || r.kind === 'redis' || r.kind === 'service',
  );
  if (!vpcResources.length) return 'none';
  const vals = vpcResources.map((r) => (typeof r.props.nat === 'string' ? r.props.nat : 'none'));
  if (vals.includes('managed')) return 'managed';
  if (vals.includes('ec2')) return 'ec2';
  // A Fargate Service runs in private subnets and needs egress to PULL its image,
  // so it floors NAT on its own (even with no DB/cache consumers).
  const hasService = bp.resources.some((r) => r.kind === 'service');
  return hasService || vpcConsumerIds(bp).size ? 'ec2' : 'none';
}

const DECL_ORDER: Record<string, number> = {
  secret: 0,
  ai: 0,
  email: 0,
  cognito: 0,
  bucket: 1,
  dynamo: 2,
  postgres: 2,
  aurora: 2,
  queue: 3,
  bus: 3,
  snstopic: 3,
  apigatewayv2: 3,
  router: 3,
  worker: 4,
  service: 4,
  nextjs: 5,
  staticsite: 5,
};

export function planAws(bp: Blueprint): AwsPlan {
  const outgoing = (id: string) => bp.connections.filter((c) => c.source === id);
  const incoming = (id: string) => bp.connections.filter((c) => c.target === id);
  const subEdge = (w: Resource) => outgoing(w.id).find((c) => c.intent === 'subscribesTo');
  const isSubscriber = (w: Resource) => Boolean(subEdge(w));
  const isCronInvoked = (w: Resource) => incoming(w.id).some((c) => c.intent === 'invokes');
  const routeEdge = (w: Resource) => outgoing(w.id).find((c) => c.intent === 'handlesRoute');
  const isRouteHandler = (w: Resource) => Boolean(routeEdge(w));
  const notifyEdge = (w: Resource) =>
    outgoing(w.id).find((c) => c.intent === 'handlesBucketEvents');
  const isBucketNotifier = (w: Resource) => Boolean(notifyEdge(w));

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
      r.kind === 'aurora' ||
      r.kind === 'redis' ||
      r.kind === 'service' ||
      r.kind === 'queue' ||
      r.kind === 'bus' ||
      r.kind === 'snstopic' ||
      r.kind === 'apigatewayv2' ||
      r.kind === 'router' ||
      r.kind === 'nextjs' ||
      r.kind === 'staticsite' ||
      (r.kind === 'worker' &&
        !isSubscriber(r) &&
        !isCronInvoked(r) &&
        !isRouteHandler(r) &&
        !isBucketNotifier(r));
    if (standalone) varNameById.set(r.id, camelCase(r.name));
  }

  const linkVarsFor = (id: string): string[] =>
    uniq(
      outgoing(id)
        .filter(
          (c) =>
            c.intent !== 'subscribesTo' && c.intent !== 'invokes' && c.intent !== 'handlesRoute',
        )
        .map((c) => varNameById.get(c.target))
        .filter((v): v is string => Boolean(v)),
    );

  const handlerPathFor = (w: Resource) => `src/workers/${kebabCase(w.name)}.handler`;
  const handlerFileFor = (w: Resource) => `src/workers/${kebabCase(w.name)}.ts`;

  const byId = new Map(bp.resources.map((r) => [r.id, r]));
  const subscribers: SubscriberPlan[] = bp.resources
    .filter((r) => r.kind === 'worker' && isSubscriber(r))
    .map((w) => {
      const target = byId.get(subEdge(w)!.target);
      const targetKind = (target?.kind ?? 'queue') as SubscriberPlan['targetKind'];
      return {
        worker: w,
        targetVar: varNameById.get(subEdge(w)!.target) ?? camelCase(w.name),
        targetId: subEdge(w)!.target,
        targetKind,
        handlerPath: handlerPathFor(w),
        handlerFile: handlerFileFor(w),
        linkVars: linkVarsFor(w.id),
      };
    });

  const functions: FunctionPlan[] = bp.resources
    .filter(
      (r) =>
        r.kind === 'worker' &&
        !isSubscriber(r) &&
        !isCronInvoked(r) &&
        !isRouteHandler(r) &&
        !isBucketNotifier(r),
    )
    .map((w) => ({
      worker: w,
      varName: varNameById.get(w.id)!,
      handlerPath: handlerPathFor(w),
      handlerFile: handlerFileFor(w),
      linkVars: linkVarsFor(w.id),
    }));

  const routes: RoutePlan[] = bp.resources
    .filter((r) => r.kind === 'worker' && isRouteHandler(r))
    .map((w) => ({
      worker: w,
      apiVar: varNameById.get(routeEdge(w)!.target) ?? camelCase(w.name),
      route: typeof w.props.route === 'string' && w.props.route ? w.props.route : 'GET /',
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
        workerId: worker?.id,
        handlerPath: worker ? handlerPathFor(worker) : undefined,
        handlerFile: worker ? handlerFileFor(worker) : undefined,
        // The cron node's own links (cron→secret) merge with the worker's.
        linkVars: uniq([...(worker ? linkVarsFor(worker.id) : []), ...linkVarsFor(c.id)]),
      };
    });

  const bucketNotifyMap = new Map<string, BucketNotifyPlan>();
  for (const w of bp.resources.filter((r) => r.kind === 'worker' && isBucketNotifier(r))) {
    const bucketId = notifyEdge(w)!.target;
    const bucket = byId.get(bucketId);
    const bucketVar = varNameById.get(bucketId);
    if (!bucket || !bucketVar) continue;
    if (!bucketNotifyMap.has(bucketId)) {
      bucketNotifyMap.set(bucketId, { bucketVar, bucketName: bucket.name, notifiers: [] });
    }
    bucketNotifyMap.get(bucketId)!.notifiers.push({
      worker: w,
      name: w.name,
      handlerPath: handlerPathFor(w),
      handlerFile: handlerFileFor(w),
      linkVars: linkVarsFor(w.id),
    });
  }
  const bucketNotifies = [...bucketNotifyMap.values()];

  const routerBuckets = bp.connections
    .filter((c) => c.intent === 'routesBucket')
    .map((c) => {
      const routerVar = varNameById.get(c.source);
      const bucket = byId.get(c.target);
      const bucketVar = varNameById.get(c.target);
      if (!routerVar || !bucket || !bucketVar) return null;
      const path =
        typeof bucket.props.routePath === 'string' && bucket.props.routePath
          ? bucket.props.routePath
          : '/*';
      return { routerVar, bucketVar, path };
    })
    .filter((x): x is { routerVar: string; bucketVar: string; path: string } => Boolean(x));

  const linkVarsById = new Map(bp.resources.map((r) => [r.id, linkVarsFor(r.id)]));

  const declared = bp.resources
    .filter((r) => varNameById.has(r.id))
    .sort((a, b) => (DECL_ORDER[a.kind] ?? 9) - (DECL_ORDER[b.kind] ?? 9));

  const workerHandlerFiles = uniq([
    ...subscribers.map((s) => s.handlerFile),
    ...functions.map((f) => f.handlerFile),
    ...crons.map((c) => c.handlerFile).filter((f): f is string => Boolean(f)),
    ...routes.map((r) => r.handlerFile),
    ...bucketNotifies.flatMap((b) => b.notifiers.map((n) => n.handlerFile)),
  ]);

  return {
    bp,
    varNameById,
    linkVarsById,
    declared,
    subscribers,
    routes,
    functions,
    crons,
    bucketNotifies,
    routerBuckets,
    workerHandlerFiles,
    vpcConsumerIds: vpcConsumerIds(bp),
  };
}
