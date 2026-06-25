# Add a catalog kind

A "kind" is a resource you can drop on the canvas (a Bucket, a Service, an AppSync
API). Adding one is the most common contribution and a well-bounded PR. This is the
checklist used to add the modern SST kinds (Redis, Containers, Realtime, Step
Functions, AppSync, OpenAuth) — follow it and your kind is fully wired.

> **Correctness is the product.** Before writing a renderer, write down the _verified_
> facts (the exact constructor, prop names, runtime shape) with a doc link, and pin
> them in the lane's target doc (`docs/sst-v4-target.md` / `docs/vercel-target.md`).
> The generator must match a source of truth, not memory.

Everything lives in `lib/targets/<lane>/`. Examples below are the AWS lane.

## Required touch-points

| #   | File                                                | What to add                                                                                                                                                        |
| --- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `catalog.ts`                                        | The `ResourceKindMeta` (kind, label, defaultName, component, description, accent, category, optional `props[]`) **and** the kind id in `*_CATALOG_ORDER`.          |
| 2   | `edges.ts`                                          | The edge intent(s) in `*_EDGE_INTENTS` (`from`/`to`/`label`/`description`) and the pair(s) in `INTENT_BY_PAIR` so the canvas allows the connection.                |
| 3   | `generator/config.ts` **or** `generator/runtime.ts` | A `render<Kind>()` that emits the **verified** `new sst.aws.X(...)` (config) and/or the runtime helper/handler files, then call it from the assembly.              |
| 4   | `generator/plan.ts`                                 | If the kind is linkable, add it to the `standalone` var-name list (so it gets a variable other resources can `link:`) and give it a `DECL_ORDER`.                  |
| 5   | A **template**                                      | Add the kind to a `lib/templates/<lane>.ts` design. The kind-coverage test enforces this — it's what makes `parse-export` + `typecheck-export` exercise your code. |
| 6   | A **test**                                          | Assert the generated output (a focused test in the lane's test suite). Run `yarn test -u` to refresh snapshots and **review the diff**.                            |

## Optional / graceful touch-points

| File                                       | When                                                                                                                                                                                           |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cost.ts`                                  | Add a `case` for a real monthly estimate. Without one it costs $0 — fine for free/usage-priced kinds.                                                                                          |
| `expansion.ts`                             | Add a `case` returning the physical resources + the kind in `ORDER`, so the Infrastructure view shows what really gets deployed.                                                               |
| `lib/core/export/typecheck-export.test.ts` | If your generated code imports a new npm package, add a `declare module` stub (named imports need explicit exports; generics need generic stubs — `any` lives only inside the ambient string). |
| `reverse.ts`                               | Map the component → kind in `COMPONENT_KIND` so a pasted config round-trips back to your kind. (The round-trip test enforces zero `unrecognized` for our own output.)                          |
| `generator/runtime.ts` deps                | Pin any new runtime dependency to a **verified** npm version (never `latest`).                                                                                                                 |

## The loop

```bash
yarn test -u          # refresh + review snapshots
yarn typecheck        # the export type-checks too (typecheck-export)
yarn lint && yarn format
```

Open a PR from a feature branch. CI runs lint → format:check → test → build →
typecheck. A renderer carries a `// verified: <doc>@<date>` provenance comment.

## Worked example — Redis (one commit)

1. `catalog.ts` — `redis` kind (`component: 'sst.aws.Redis'`, an `engine` select prop) + order.
2. `edges.ts` — `usesCache` intent (`nextjs`/`worker` → `redis`) + `INTENT_BY_PAIR` pairs.
3. `generator/config.ts` — `renderRedis()` → `new sst.aws.Redis(name, { vpc, engine? })`,
   inside the shared-VPC block; `generator/runtime.ts` — `lib/redis.ts` (ioredis Cluster + TLS).
4. `generator/plan.ts` — `redis` joins the standalone list and the VPC-consumer logic.
5. `cost.ts` / `expansion.ts` — ElastiCache node + the in-VPC resources.
6. A template (`Cached API + Redis`) and a test. Done.

See also: [adding-a-template.md](adding-a-template.md), [adding-a-lane.md](adding-a-lane.md).
