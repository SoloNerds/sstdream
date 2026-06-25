# Architecture — Multi-Target Lanes

> **Principle:** AWS/SST and Vercel are **two separate product lanes**, not one canvas
> with a different export button. They must never pretend `Bucket`, `Queue`, or `Worker`
> mean the same thing. AWS/SST **owns infrastructure**; Vercel **hosts the app and
> integrates external services**.

- **Doc version:** `0.1.0` · **Date:** `2026-06-08`
- AWS lane status: spec **verified** (see [sst-v4-target.md](sst-v4-target.md)).
- Vercel lane status: spec **verified** (see [vercel-target.md](vercel-target.md)) —
  the M10 compat-lock spike is done. Section 5 below is a summary; vercel-target.md is
  authoritative.

---

## 1. The shared / per-target boundary

| Layer                                                           | Shared across lanes | Per-lane                           |
| --------------------------------------------------------------- | ------------------- | ---------------------------------- |
| UI shell (canvas, palette, properties panel, nav)               | ✅                  |                                    |
| Blueprint **envelope** (`version`, `target`, `app`, `metadata`) | ✅                  |                                    |
| Simulation / Cost / Recommendation **engines** (frameworks)     | ✅                  | run over the active lane's catalog |
| **Catalog** (node types + meanings)                             |                     | ✅                                 |
| **Edge intents** (what a connection generates)                  |                     | ✅                                 |
| **Validation rules**                                            |                     | ✅                                 |
| **Generators** (code/config emit)                               |                     | ✅                                 |
| **File manifest** (what the export contains)                    |                     | ✅                                 |
| **Install/deploy docs**                                         |                     | ✅                                 |

The engines (M7–M9) are **target-aware frameworks**: they accept a lane's catalog +
edge semantics and produce simulation traces, cost numbers, and recommendations specific
to that lane. They are not target-agnostic logic.

`target` on the blueprint selects the lane:

```ts
type DeployTarget = 'aws-sst-v4' | 'vercel';
```

---

## 2. Internal structure

```
lib/
├── core/                      # shared shell + engine frameworks
│   ├── blueprint/             # envelope schema, persistence, import/export
│   ├── simulation/            # engine (consumes a lane's catalog+edges)
│   ├── cost/                  # engine
│   └── recommendations/       # engine
└── targets/
    ├── aws-sst-v4/
    │   ├── catalog.ts         # node types + meanings
    │   ├── edges.ts           # edge intents -> generation semantics
    │   ├── validation.ts      # lane rules
    │   ├── generator.ts       # sst.config.ts + runtime code
    │   ├── templates.ts       # starter templates
    │   └── docs.ts            # install/deploy instructions
    └── vercel/
        ├── catalog.ts
        ├── edges.ts
        ├── validation.ts
        ├── generator.ts
        ├── templates.ts
        └── docs.ts
```

Each lane implements a common `Target` interface so the shell + engines stay decoupled
from any one lane.

---

## 3. UX: force the lane choice early

First screen of the builder:

```
What are you exporting for?

[ AWS / SST v4 ]  Own the infrastructure. Export sst.config.ts + AWS resource code.
[ Vercel ]        Host the app on Vercel. Export vercel config, routes, env checklist,
                  and service-integration helpers.
```

**No hybrid templates in v1.** A blueprint belongs to exactly one lane. (Hybrid is a
future epic, not MVP.)

---

## 4. AWS / SST v4 lane — "owns infrastructure" (VERIFIED)

Source of truth: [sst-v4-target.md](sst-v4-target.md).

**Catalog nodes:** SST Nextjs · SST Bucket · SST Dynamo · SST Queue · SST Function (Worker)
· SST CronV2 · SST Secret · AWS Domain · (later: Email, Stripe Webhook).

**Edge intents → SST relationships:**

| Edge intent                            | Generates                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `linksTo`                              | adds resource to `link: [...]`                                                                                |
| `uploadsTo` / `readsFrom` / `writesTo` | link + AWS SDK helper (S3/Dynamo)                                                                             |
| `publishesTo`                          | link queue + SQS send helper                                                                                  |
| `subscribesTo`                         | `queue.subscribe({...})` **(subscriber-first!)** / `table.subscribe("Name", ...)` **(name-first + `stream`)** |
| `invokes`                              | function link/permission                                                                                      |
| `usesSecret`                           | `new sst.Secret` + link                                                                                       |

**Lane validations:** prod `removal: retain` / `protect: true`; queue has a subscriber;
worker has linked table; bucket upload uses signed URL; Dynamo has a primary key; function
timeout sane; declared secrets present; **no legacy imports / no provider imports / all
resources in `run()`**.

**Manifest:**

```
aws-sst-export/
├── sst.config.ts
├── sstdream.design.json
├── .env.example
├── package.additions.json
├── README.md
├── app/actions/{create-upload-url.ts,enqueue-job.ts}
├── src/workers/process-job.ts
└── lib/{storage.ts,queue.ts,dynamo.ts,env.ts}
```

**Starter templates:** SST Next.js Starter · File Upload + S3 · Queue Worker App ·
AI Processing Pipeline · SaaS Billing + Webhook + Dynamo.

---

## 5. Vercel lane — "integrates services" (VERIFIED)

Source of truth: [vercel-target.md](vercel-target.md). Vercel hosts the app and connects
to managed/external services. It is **not** AWS — no app-owned S3/Dynamo/SQS infra, no
SST. But it **does** (as of 2026) have native async primitives.

**Catalog nodes:** Vercel Next.js Project · Function Route · Cron · **Vercel Queue +
Consumer** (native, beta) · **Vercel Workflow** (native, GA) · **Vercel Blob** (first-party)
· **Edge Config** (first-party) · **Redis (Upstash)** · **Postgres (Neon/Supabase/Aurora/
Prisma)** · Env Vars · Domain · Analytics · Speed Insights · Stripe Webhook Route ·
Resend Email · External API · _(optional Marketplace job provider)_.

> ✅ **Verified corrections:** `Vercel KV`/`Vercel Postgres` are **dead** as first-party
> products (→ Upstash Redis / Neon via Marketplace; never emit `@vercel/kv`/`@vercel/postgres`).
> `Vercel Blob` and `Edge Config` **remain** first-party. Cron _count_ is 100/project on
> all plans; only _frequency_ is plan-gated (Hobby once/day).

**Edge intents → app/integration artifacts:**

| Edge intent                            | Generates                                              |
| -------------------------------------- | ------------------------------------------------------ |
| `usesEnv`                              | entry in `.env.example` + `required-env.json`          |
| `callsRoute`                           | API route handler stub                                 |
| `storesFileIn`                         | Blob helper + upload route                             |
| `readsFromService` / `writesToService` | DB/KV client helper + env                              |
| `scheduledBy`                          | `/api/cron/...` route + `crons` entry in `vercel.json` |
| `receivesWebhook`                      | webhook route + signing-secret env                     |
| `sendsEmailThrough`                    | Resend/email helper + env                              |

**Lane validations:** cron path has a route file; webhook route has a signing secret;
Blob helper has its token/env; DB selected ⇒ `DATABASE_URL` present; route using a secret
not marked client-side; function within platform limits; **background job ⇒ requires an
external job/queue provider** (no fake Worker node).

**Manifest:**

```
vercel-export/
├── vercel.json            # incl. crons
├── sstdream.design.json
├── .env.example
├── required-env.json
├── package.additions.json
├── README.md
├── app/api/cron/<name>/route.ts
├── app/api/webhooks/<name>/route.ts
├── app/actions/upload-file.ts
└── lib/{blob.ts,db.ts,billing.ts,env.ts}
```

**Starter templates:** Vercel Next.js Starter · Vercel Blob Upload App · Stripe SaaS
Starter · Dashboard + External DB · Cron Job + Email Report.

---

## 6. The three "be honest" differences

1. **Background jobs.** AWS: native `Queue → Function(Worker)`. Vercel (**corrected** — it
   now has native async): pick by workload — `after()`/`waitUntil()` (fire-and-forget),
   **Vercel Queues** push-consumer (the native "worker", beta), **Vercel Workflows**
   (long-running/durable, GA), or Cron for scheduled work. Marketplace providers (Inngest,
   Trigger.dev, QStash) are _optional_ alternatives, not requirements. Still no app-owned
   SQS/Lambda — that's the AWS lane.
2. **Database ownership.** AWS: app can **own** the DB (Dynamo; later Postgres). Vercel:
   app **connects** to a managed/external DB (Neon, Supabase, PlanetScale, …) → export a
   `DATABASE_URL` checklist + `lib/db.ts` (+ Prisma config/migration notes if selected),
   **not** an `sst.config.ts`.
3. **Secrets.** AWS: `sst.Secret` linked into resources. Vercel: **project env vars** per
   environment (encrypted at rest) → export `.env.example` + `required-env.json` +
   `vercel-env.md`.

`required-env.json` shape:

```json
{
  "required": [
    {
      "name": "DATABASE_URL",
      "scope": "server",
      "environment": ["development", "preview", "production"]
    },
    { "name": "STRIPE_SECRET_KEY", "scope": "server", "environment": ["preview", "production"] },
    {
      "name": "NEXT_PUBLIC_APP_URL",
      "scope": "client",
      "environment": ["development", "preview", "production"]
    }
  ]
}
```

---

## 7. Same idea, different export (worked example)

> "SaaS app with uploads, billing, email, and background processing."

- **AWS lane** → Nextjs · Bucket · Queue · Worker · Dynamo · Stripe Webhook · Email Secret
  ⇒ `sst.config.ts`, S3 upload action, SQS enqueue, Lambda worker, Dynamo helpers, webhook route.
- **Vercel lane** → Vercel Project · Blob · External DB · Stripe Webhook Route · Resend ·
  External Job Provider ⇒ `vercel.json`, Blob upload action, DB helper, webhook route,
  Resend helper, external-job-provider notes.

AWS creates infrastructure; Vercel wires platform features + external services.
