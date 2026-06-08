# Vercel Compatibility Target — `vercel-target.md`

> **Source of truth for SSTDREAM's Vercel lane** (catalog, validation, generator).
> Vercel is a _separate lane_ from AWS/SST — it **hosts the app and integrates services**;
> it does not use SST. See [architecture-targets.md](architecture-targets.md).

- **Doc version:** `0.1.0`
- **Verified against live Vercel docs on:** `2026-06-08` (docs `last_updated` 2026-02 … 2026-06)
- **Closes the M10 compatibility-lock spike** (issue #69).
- **Provenance:** verified via official `vercel.com/docs/*`. Several facts here _corrected_
  earlier design assumptions — see callouts. Re-verify beta APIs (Queues/Workflows) each
  release; they are moving fast.

---

## 0. Hard rules (Vercel generator)

1. **Deploying Next.js to Vercel is zero-config.** Never emit SST. A standard app needs
   **no `vercel.json`** at all.
2. Emit `vercel.json` **only** for overrides: `crons`, per-function `functions` config,
   queue `experimentalTriggers`, `rewrites`/`redirects`/`headers`. Always include
   `"$schema": "https://openapi.vercel.sh/vercel.json"`.
3. Secrets are **Vercel environment variables**, never committed. Emit `.env.example` +
   `required-env.json` + setup notes; never write real values.
4. Storage: **Blob** and **Edge Config** are first-party. **KV and Postgres no longer
   exist as first-party products** — use Marketplace providers (Redis→Upstash,
   Postgres→Neon/Supabase/Aurora/Prisma). Never emit `@vercel/kv` or `@vercel/postgres`.
5. Background work uses Vercel's **native** primitives first (`after`/`waitUntil`, Queues,
   Workflows, Cron); Marketplace providers (Inngest/Trigger.dev/QStash) are _optional_
   alternatives, not requirements.

---

## 1. Deploy model

Source: <https://vercel.com/docs/frameworks/full-stack/nextjs>, <https://vercel.com/docs/cli/deploy>

- **Git integration (recommended):** import repo → push to a non-prod branch = Preview,
  push/merge to prod branch (`main`→`master`→default) = Production. No config file needed;
  Vercel auto-detects the Next.js preset.
- **CLI:** `vercel` (preview) / `vercel --prod` (production). Works with or without Git.
- `vercel.json` overrides are optional: `framework`, `buildCommand`, `outputDirectory`,
  `installCommand`, `devCommand`. Standard Next.js apps should NOT set `outputDirectory`.

---

## 2. `vercel.json` reference

Source: <https://vercel.com/docs/project-configuration/vercel-json>

```jsonc
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [{ "path": "/api/cron/daily", "schedule": "0 5 * * *" }],
  "functions": {
    "app/api/**/*": { "maxDuration": 60 }, // integer SECONDS; glob keys; order matters
  },
  "rewrites": [{ "source": "/about", "destination": "/about-us" }],
  "redirects": [{ "source": "/old", "destination": "/new", "permanent": true }], // 308
  "headers": [{ "source": "/(.*)", "headers": [{ "key": "X-Frame-Options", "value": "DENY" }] }],
}
```

- Prefer `rewrites`/`redirects`/`headers` over the deprecated `routes`/`builds`/`env`.
- Per-function keys: `runtime`, `maxDuration`, `memory`\*, `supportsCancellation`,
  `includeFiles`/`excludeFiles` (**not supported in Next.js** — use `next.config`
  `outputFileTracingIncludes/Excludes`), `regions`, `functionFailoverRegions` (Ent).
- ⚠️ With **Fluid Compute** (default since 2025-04-23), `memory` **cannot** be set in
  `vercel.json` — it's a dashboard setting.

---

## 3. Functions & duration limits

Source: <https://vercel.com/docs/functions/configuring-functions/duration>

> ⚠️ **Corrected:** the old `10s/60s … 900s` numbers are **stale**. Current, with Fluid
> Compute (default on):

| Plan       | Default | Max   |
| ---------- | ------- | ----- |
| Hobby      | 300s    | 300s  |
| Pro        | 300s    | ~800s |
| Enterprise | 300s    | ~800s |

- Set per route: `export const maxDuration = 60;` (Next.js App Router ≥13.5; Pages Router
  uses `export const config = { maxDuration: 60 }`), or via `vercel.json` `functions`.
- Edge runtime: must start responding within 25s, may stream up to 300s.
- For **unlimited** execution → use **Vercel Workflows** (§4).
- Overrun → `504 FUNCTION_INVOCATION_TIMEOUT`.

---

## 4. Background work — layered native model

> ⚠️ **Corrected (biggest change):** "Vercel has no native background jobs / no Worker" is
> **false as of 2026.** Choose by workload — do NOT assume you must go external.

| Need                                     | Use                                     | Package / API                              |
| ---------------------------------------- | --------------------------------------- | ------------------------------------------ |
| Fire-and-forget after response           | `after()` (Next ≥15.1) or `waitUntil()` | `next/server` / `@vercel/functions`        |
| Durable queue + consumer ("worker")      | **Vercel Queues** (Beta)                | `@vercel/queue`                            |
| Long-running / multi-step (pause→months) | **Vercel Workflows** (GA)               | `workflow` (`'use workflow'`/`'use step'`) |
| Scheduled invocation                     | **Cron Jobs** (§5)                      | `vercel.json` `crons`                      |
| External alternative                     | Inngest / Trigger.dev / Upstash QStash  | Marketplace integrations                   |

There is no _always-on_ poll loop (serverless compute), but **push-mode Queue consumers**
are Vercel's native "worker": Vercel invokes your function per message (air-gapped,
retries, visibility timeout). Configure the trigger at deploy time:

```jsonc
// vercel.json — queue consumer trigger (BETA: type/key may change before GA)
{
  "functions": {
    "app/api/queues/process/route.ts": {
      "experimentalTriggers": [
        { "type": "queue/v2beta", "topic": "orders", "retryAfterSeconds": 60 },
      ],
    },
  },
}
```

```ts
// producer
import { send } from '@vercel/queue';
await send('orders', { orderId }); // opts: retentionSeconds (60s–7d, def 24h), delaySeconds, idempotencyKey
// consumer
import { handleCallback } from '@vercel/queue';
export const POST = handleCallback(async (message, metadata) => {
  await process(message);
});
```

Queues: at-least-once (make consumers idempotent), auto-retry, TTL 60s–7d, no built-in
DLQ (handle poison messages in the `retry` callback), approximate ordering.

---

## 5. Cron Jobs

Source: <https://vercel.com/docs/cron-jobs>

```jsonc
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [{ "path": "/api/cron/daily", "schedule": "0 5 * * *" }],
}
```

```ts
// app/api/cron/daily/route.ts — must export GET; Vercel triggers via HTTP GET
export function GET(request: Request) {
  /* verify CRON_SECRET */ return new Response('ok');
}
```

- Runs on **production deployments only**; user-agent `vercel-cron/1.0`; header
  `x-vercel-cron-schedule`. Authenticate with a `CRON_SECRET` env var.
- Schedule: standard 5-field cron, **UTC only**, **numeric only** (no `MON`/`JAN`), and you
  **cannot set both** day-of-month and day-of-week (one must be `*`).
- **Limits (corrected):** **100 cron jobs/project on all plans** (count is no longer
  plan-gated since Jan 2026). **Frequency** is gated: **Hobby = once/day, hourly precision
  (±59 min)**; **Pro/Enterprise = once/minute, per-minute precision**.

---

## 6. Storage

Source: <https://vercel.com/docs/vercel-blob>, <https://vercel.com/docs/redis>, <https://vercel.com/docs/marketplace-storage>

**First-party (keep in catalog):**

- **Vercel Blob** — `@vercel/blob` (server: `put`/`del`/`head`/`list`/`copy`; client:
  `upload`/`handleUpload` from `@vercel/blob/client`). Backed by S3.
  ⚠️ **Stores have an immutable `private | public` mode and nearly every method REQUIRES an
  explicit `access` option** matching the store. Auth: `BLOB_READ_WRITE_TOKEN` (default,
  outside Vercel) or OIDC (`VERCEL_OIDC_TOKEN` + `BLOB_STORE_ID`, on Vercel);
  `handleUpload` **must** use `BLOB_READ_WRITE_TOKEN`. Server `put()` capped at 4.5 MB body
  → use client `upload()` for large files (up to 5 TB multipart). `onBeforeGenerateToken`
  is where you **must authenticate**.
- **Edge Config** — low-latency global config store (first-party).

**Marketplace (corrected — these are NOT first-party anymore):**

- **Redis / KV** → **Upstash Redis** (`@upstash/redis`). `@vercel/kv` is dead (auto-migrated
  Dec 2024).
- **Postgres** → **Neon** (migration default), Supabase, AWS Aurora, or Prisma Postgres
  (`@neondatabase/serverless`). `@vercel/postgres` deprecated.
- Provision: `vercel install neon|upstash|supabase` (CI: `vercel install neon --name db
--plan free -e production -e preview`) → connects to project, pulls creds to `.env.local`.

---

## 7. Environment variables

Source: <https://vercel.com/docs/environment-variables>

- Scoped per environment: **Production / Preview / Development** + **Custom** environments;
  Preview values can be branch-scoped. All values **encrypted at rest**.
- **Sensitive** env vars: become non-readable after creation (Production/Preview only) —
  use for true secrets.
- `NEXT_PUBLIC_`-prefixed vars are inlined at build and **exposed to the browser** — never
  put secrets there.
- Generator emits `.env.example` + `required-env.json` (scope: `server`/`client`,
  environments per var) + `vercel env pull` instructions. Never commit real values.

---

## 8. Catalog (Vercel lane)

Vercel Next.js Project · Function Route · **Cron** · **Vercel Queue + Consumer** (native,
beta) · **Vercel Workflow** (native) · **Vercel Blob** · **Edge Config** ·
**Redis (Upstash)** · **Postgres (Neon/Supabase/Aurora/Prisma)** · **Env Vars** · Domain ·
Analytics · Speed Insights · Stripe Webhook Route · Resend Email · External API ·
_(optional Marketplace job provider: Inngest / Trigger.dev / QStash)_.

> No app-owned infra (no S3/Dynamo/SQS components — that's the AWS lane). DB/Redis are
> external managed services the app _connects to_.

## 9. Edge intents → artifacts

| Intent                               | Generates                                                           |
| ------------------------------------ | ------------------------------------------------------------------- |
| `usesEnv`                            | `.env.example` + `required-env.json` entry                          |
| `callsRoute`                         | API route handler stub                                              |
| `storesFileIn`                       | Blob helper (`lib/blob.ts`) + upload route (`access` set)           |
| `readsFromService`/`writesToService` | DB/Redis client helper (`lib/db.ts`) + env                          |
| `scheduledBy`                        | `/api/cron/<name>/route.ts` (GET + CRON_SECRET) + `crons` entry     |
| `enqueuesTo`                         | `@vercel/queue` `send()` producer                                   |
| `consumedBy`                         | `handleCallback` consumer + `experimentalTriggers` in `vercel.json` |
| `orchestratedBy`                     | Vercel Workflow (`'use workflow'`/`'use step'`)                     |
| `receivesWebhook`                    | webhook route + signing-secret env                                  |
| `sendsEmailThrough`                  | Resend helper + env                                                 |

## 10. Validation rules (Vercel lane)

- **ERROR** emit `@vercel/kv` / `@vercel/postgres` (dead) — use Upstash/Neon.
- **ERROR** Blob method without an `access` value / mismatched store mode.
- **ERROR** cron path has no matching `GET` route file; cron route missing `CRON_SECRET`.
- **ERROR** Hobby cron schedule more frequent than daily.
- **ERROR** queue consumer route without `experimentalTriggers`; producer without `send`.
- **ERROR** DB/Redis node without its `DATABASE_URL`/connection env in `required-env.json`.
- **ERROR** route uses a server secret but is marked client / secret in `NEXT_PUBLIC_`.
- **WARN** `maxDuration` exceeds plan max; long task not on Workflows.
- **WARN** webhook route without signature verification.
- **INFO** standard app needs no `vercel.json`.

## 11. File manifest

```
vercel-export/
├── vercel.json                 # only if crons/functions/queue triggers/overrides exist
├── sstdream.design.json
├── .env.example
├── required-env.json
├── package.additions.json
├── README.md
├── app/api/cron/<name>/route.ts
├── app/api/queues/<name>/route.ts      # consumer (if Queues used)
├── app/api/webhooks/<name>/route.ts
├── app/actions/upload-file.ts
└── lib/{blob.ts,db.ts,redis.ts,queue.ts,billing.ts,env.ts}
```

## 12. Drift watch

- **Vercel Queues** is Beta — `experimentalTriggers` / `queue/v2beta` will change before GA.
- **Vercel Workflows** model (`workflow` pkg, `'use workflow'`/`'use step'`) is new.
- Blob `access` requirement + OIDC default; storage Marketplace providers; function limits
  (Fluid). Re-verify each release; never hardcode plan limits without a doc check.
