# CLAUDE.md

Guidance for working in this repo. SSTDREAM is a **visual SST v4 / Vercel deployment
template builder** (Next.js 16). The website never deploys — it generates files the user
runs themselves. See [README.md](README.md) and the docs below.

## Commands

```bash
yarn dev          # builder at /builder
yarn test         # vitest (run); yarn test <name> to filter
yarn lint         # eslint
yarn typecheck    # tsc --noEmit
yarn build        # next build (also type-checks)
yarn format       # prettier --write
```

CI (`.github/workflows/ci.yml`) runs lint → test → build → typecheck on push/PR.

## Source-of-truth docs (read before changing generators/validators)

- [docs/sst-v4-target.md](docs/sst-v4-target.md) — verified AWS/SST v4 facts.
- [docs/vercel-target.md](docs/vercel-target.md) — verified Vercel facts.
- [docs/architecture-targets.md](docs/architecture-targets.md) — the two-lane model.

## Architecture: two lanes, one shell

**Shared** (lane-agnostic): the UI shell, the blueprint **envelope**, and the
**engines** — they run over whichever lane's catalog is active.

```
lib/core/
  blueprint/     # Zod envelope, serialize (canvas↔blueprint), migrate, persistence
  validation/    # Diagnostic/engine + per-target rule selection (export gate)
  simulation/    # data-flow trace ("does everything talk?")
  cost/          # per-resource monthly estimate
  expansion/     # logical→physical resource map ("Infrastructure view", read-only)
  audit/         # advisory security/ops findings (surfaced on the Infrastructure view)
  recommendations/  # rule-based fixes (pure, idempotent apply)
  codegen/       # GeneratedFile types, strings, generate() facade
  export/        # buildExport() manifest + zip()
lib/targets/<aws-sst-v4|vercel>/   # PER-LANE: catalog, edges, validation,
                                   # generator, docs, (cost/sim where present)
components/builder/   # canvas, palette, panels (Props/Sim/Cost/Tips), Export dialog
app/                  # Next.js app (/builder)
lib/templates/        # reference designs (AI Processing App, Vercel SaaS)
```

A new lane is registered in `lib/targets/registry.ts` plus the `generate.ts`,
`validate.ts`, and `export/manifest.ts` maps. The blueprint `target.deploy` selects it.

## Conventions

- **Correctness is the product.** Every generated snippet must match the verified target
  doc. Generator renderers carry a `verified: <doc>@<version>` note and a **snapshot test**.
- Don't hand-edit `*.snap`; update via `yarn test` and review the diff.
- Package manager is **yarn**. TypeScript strict. Prettier is the formatter of record.
- Work is tracked as GitHub issues on **project board #3**; commit via **feature branch +
  PR** (direct push to `main` is blocked). Use `gh pr merge --squash`.
- The canvas store (`lib/canvas/store.ts`) is UI state; the durable model is the blueprint.

## State of the lanes

- **AWS lane is complete.** 21 catalog kinds (Next.js, Static Site, Bucket, Dynamo +GSI,
  Postgres/Aurora +fck-nat, Queue/Bus/SnsTopic, HTTP API, **Router**, Worker, Cron, Secret,
  Email, Cognito/Clerk, Stripe, MongoDB, External API, AI Chat). The export is a **complete
  runnable project** (scaffold: package.json/tsconfig/next.config/layout/page + **AGENTS.md**),
  with **full CRUD server actions + example pages** per Dynamo/Mongo table the app touches,
  worker roles for queue/bus/topic subscribers, API routes, cron, and S3 notifications.
- **Worker roles** (in `generator/plan.ts`): subscriber (queue/bus/topic **or Dynamo stream**,
  name-first vs object-first subscribe), route handler (handlesRoute → ApiGatewayV2),
  cron-invoked, bucket notifier (handlesBucketEvents → bucket.notify), or standalone function.
- **Dynamo streams**: `worker subscribesTo dynamo` enables the table stream (auto when wired)
  and emits a name-first `table.subscribe("Name", {...})` + a DynamoDB-stream handler shape.
- **Router** routes a bucket (`routeBucket`, router→bucket) and serves a StaticSite (router
  option, staticsite→router); paths live on the routed node's `routePath` prop.

- **Vercel lane is at functional parity.** Runnable project scaffold (package.json/tsconfig/
  next.config/layout/page + AGENTS.md), editable props, the doc §10 validation rules, and all
  five engines (simulation / cost / expansion / audit / recommendations in `lib/targets/vercel/`).
  9 catalog kinds; webhook supports Stripe + generic HMAC; deps pinned to verified versions.

## Correctness backstops

- **Snapshot tests** pin every generator's output; don't hand-edit `*.snap`.
- **`parse-export.test.ts`** syntactically parses every generated file of every template.
- **`typecheck-export.test.ts`** runs the TS type-checker over every generated project (both
  lanes + a 21-kind kitchen-sink): catches undefined vars, broken local imports, type errors.
- CI runs lint → **format:check** → test → build → typecheck.

## Known follow-ups

- Vercel frontier: more catalog kinds (Workflow, Edge Config, External API), an AI SDK v5
  template. (Email is SES on AWS, Resend on Vercel.)
- `generator/runtime.ts` (~1100 lines) is a candidate for splitting (well-tested, so low-risk).
- No in-app AI assistant (deferred by design until export quality is proven).
