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
cli/                  # the `sst-dream` CLI (Live Mode) — bundled via `yarn build:cli`
```

A new lane is registered in `lib/targets/registry.ts` plus the `generate.ts`,
`validate.ts`, and `export/manifest.ts` maps. The blueprint `target.deploy` selects it.

## Two pillars: Design Mode + Live Mode

**Design Mode** is the builder (everything above). **Live Mode** is a second, local-first
pillar that _understands_ an existing project rather than generating a new one. It reuses
the SAME engines (reverse parser + validation/simulation/cost/expansion/audit) over a repo
on disk instead of a canvas. Phase 1 = `cli/` → `sst-dream scan <dir>`: walk the repo,
**sanitize before parsing** (shared `scripts/sanitize.mjs`), reverse-parse, run the engines,
attach `high`/`low` confidence, and emit `ARCHITECTURE.md` + `sstdream-scan.json`. Zero
credentials, zero network — ships under the existing moat. The honesty backstop in
`cli/scan.ts` reports every `new sst.*` that did NOT become a node (never a silent drop).
`yarn build:cli` (esbuild) bundles `cli/` + the engines into a single self-contained
**committed** `scripts/sst-dream.mjs` — users drop the `scripts/` folder into their own
project and run it with no clone/install/build; CI rebuilds it and **fails on drift**.
Cloud-observed phases (read-only AWS/Vercel) are deliberately fenced behind a security gate.
See [docs/live-mode.md](docs/live-mode.md). The builder's codegen stays zero-AI regardless.

## Conventions

- **Correctness is the product.** Every generated snippet must match the verified target
  doc. Generator renderers carry a `verified: <doc>@<version>` note and a **snapshot test**.
- Don't hand-edit `*.snap`; update via `yarn test` and review the diff.
- Package manager is **yarn**. TypeScript strict. Prettier is the formatter of record.
- Work is tracked as GitHub issues on **project board #3**; commit via **feature branch +
  PR** (direct push to `main` is blocked). Use `gh pr merge --squash`.
- The canvas store (`lib/canvas/store.ts`) is UI state; the durable model is the blueprint.

## State of the lanes

- **AWS lane is complete + deep — 26 catalog kinds.** Serverless: Next.js, Static Site, Bucket,
  Dynamo +GSI, Postgres/Aurora +fck-nat, **Redis (ElastiCache)**, Queue/Bus/SnsTopic, **Realtime
  (IoT WebSocket pub/sub)**, HTTP API, **Router**, Worker, Cron, **Step Functions** (durable
  state machine), Secret, Email, Cognito/Clerk, Stripe, MongoDB, External API, AI Chat. Plus
  **containers**: **Service** (long-running ECS Fargate behind an ALB) + **Task** (one-off batch
  via `task.run()`), both on an auto-generated **Cluster**. The container/Redis kinds join the
  shared VPC and floor NAT at fck-nat (a Fargate task needs egress to pull its image). The
  export is a **complete runnable project** (scaffold + **AGENTS.md**), with **full CRUD server
  actions + example pages** per Dynamo/Mongo table, container Dockerfiles, step Lambdas, the
  Realtime authorizer/publish/subscribe, worker roles for subscribers, API routes, cron, and
  S3 notifications. The 5 modern SST kinds (2026-06-25) were researched + verified vs live docs.
- **Worker roles** (in `generator/plan.ts`): subscriber (queue/bus/topic **or Dynamo stream**,
  name-first vs object-first subscribe), route handler (handlesRoute → ApiGatewayV2),
  cron-invoked, bucket notifier (handlesBucketEvents → bucket.notify), or standalone function.
- **Dynamo streams**: `worker subscribesTo dynamo` enables the table stream (auto when wired)
  and emits a name-first `table.subscribe("Name", {...})` + a DynamoDB-stream handler shape.
- **Router** routes a bucket (`routeBucket`, router→bucket) and serves a StaticSite (router
  option, staticsite→router); paths live on the routed node's `routePath` prop.

- **Vercel lane is deep + at functional parity.** Runnable project scaffold, editable props,
  the doc §10 validation rules, and all five engines (sim / cost / expansion / audit /
  recommendations in `lib/targets/vercel/`). **22 catalog kinds** spanning the whole Vercel
  surface (researched + verified against live docs, 2026-06-25): app, Blob, Edge Config,
  Postgres/Redis (Neon/Upstash), Queue+Consumer, **Workflow** (durable, withWorkflow wrap),
  Cron, Webhook (Stripe/HMAC), External API, **Edge Middleware** (Next 16 `proxy.ts`),
  **BotID** (withBotId wrap), **Sandbox** (`@vercel/sandbox`), **Feature Flags** (flags SDK +
  optional Edge Config adapter), Rate Limit (`@vercel/firewall`), Background Task (`after()`),
  Email (Resend), **AI Gateway** (AI SDK v7 — _the builder makes zero AI calls_, only emits
  code), OG Image (`next/og`), Analytics, Speed Insights. All deps pinned to verified npm
  versions; new kinds carry a `verified: <doc>@<date>` note + a snapshot/typecheck-export test.

## Correctness backstops

- **Snapshot tests** pin every generator's output; don't hand-edit `*.snap`.
- **`parse-export.test.ts`** syntactically parses every generated file of every template.
- **`typecheck-export.test.ts`** runs the TS type-checker over every generated project (both
  lanes + a 21-kind kitchen-sink): catches undefined vars, broken local imports, type errors.
- CI runs lint → **format:check** → test → build → typecheck.

## Known follow-ups

- Vercel catalog now spans the full surface (22 kinds). Remaining is niche/dashboard-only
  (Domains, Log Drains, Connect) — not code-gen-able. (Email is SES on AWS, Resend on Vercel.)
- `generator/runtime.ts` (~1100 lines) is a candidate for splitting (well-tested, so low-risk).
- The public demo + repo go public via roadmap issue #26 (the deliberate final switch).
- No in-app AI assistant in the builder (deferred by design; the AI Gateway kind only
  _generates_ code that calls AI — the builder itself makes zero AI calls).
