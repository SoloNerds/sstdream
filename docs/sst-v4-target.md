# SST v4 Compatibility Target — `sst-v4-target.md`

> **This is the source of truth for SSTDREAM's code generator and validator.**
> Every component renderer and validation rule is built against the facts in this
> document. Do not change a renderer without updating the matching section here.

- **Doc version:** `0.1.0`
- **Verified against live SST docs on:** `2026-06-08` (re-verified; `sst` latest is **v4.15.2**, no v5)
- **SST major:** `4` (Pulumi AWS **v7** era; the `$config` model continued from v3/"Ion")
- **Underlying Pulumi AWS provider:** `v7` (SST v3 was v6)
- **TypeScript:** `5+` required for config types
- **Provenance:** every fact below was confirmed against `sst.dev/docs/*` on the date
  above. Each component section lists the exact doc URL it was verified from. Re-verify
  on each SST minor bump — provider/component APIs drift (see **Drift Watch**).

---

## 0. Hard rules (non-negotiable for the generator)

These map 1:1 to the "do not screw ourselves" list. Treat as compile-time invariants.

1. **Never** generate `import { SSTConfig } from "sst"` or anything from `sst/constructs` (that is v2/CDK).
2. **Never** `import` a provider package (`@pulumi/aws`, `@pulumi/cloudflare`, `@pulumi/pulumi`) in `sst.config.ts`. SST injects them as globals.
3. All resources are defined **inside `async run()`** — never inside `app()`.
4. Config is `export default $config({ app(input){...}, async run(){...} })`.
5. First line of `sst.config.ts` is the triple-slash platform reference.
6. Use `sst.aws.*` built-in components; use links, not manual IAM.
7. Runtime/app code accesses linked resources via `import { Resource } from "sst"`.
8. Every component renderer carries a `// verified: sst-v4-target.md@0.1.0 (2026-06-08)`
   provenance comment and has a snapshot test.

---

## 1. Canonical `sst.config.ts` shape

Source: <https://sst.dev/docs/reference/config/>

```ts
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'my-app', // required; prefixes resource names
      home: 'aws', // required: "aws" | "cloudflare" | "local"
      removal: input.stage === 'production' ? 'retain' : 'remove',
      protect: input.stage === 'production',
      providers: {
        aws: { region: 'us-east-1' }, // optional; object OR version string
      },
    };
  },
  async run() {
    const bucket = new sst.aws.Bucket('MyBucket');
    return { bucket: bucket.name }; // outputs -> CLI + .sst/outputs.json
  },
});
```

### `app(input)` reference

| Field       | Required | Type / values                          | Notes                                                                                                                    |
| ----------- | -------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `name`      | ✅       | `string`                               | Prefixes all resource names.                                                                                             |
| `home`      | ✅       | `"aws" \| "cloudflare" \| "local"`     | Where SST stores **state + secrets**. `aws` = S3 + SSM.                                                                  |
| `removal`   | ❌       | `"remove" \| "retain" \| "retain-all"` | Default `"retain"`. **No `"destroy"`.** `retain` keeps S3+Dynamo, removes the rest; `retain-all` keeps everything.       |
| `protect`   | ❌       | `boolean`                              | If `true`, `sst remove` errors out.                                                                                      |
| `providers` | ❌       | `Record<string, string \| object>`     | Value is a version string (`aws: "7.x"`) **or** a config object (`aws: { region }`). Omit → home provider with defaults. |

- `input.stage` is the CLI stage (required, non-optional string). Docs use `input.stage`, not `input?.stage`.
- `run()` returns `void | Record<string, any>`; a returned object becomes the app outputs.

---

## 2. Providers

Sources: <https://sst.dev/docs/providers/>, <https://sst.dev/docs/all-providers/>

- **Preloaded (no `sst add` needed): AWS and Cloudflare.** Their namespaces (`sst.aws.*`, `sst.cloudflare.*`, and raw `aws.*` / `cloudflare.*`) are available out of the box.
- **Every other provider** (Stripe, **Vercel**, PlanetScale, GitHub, Auth0, GCP, Azure, …) requires `sst add <provider>`, which (1) installs the package, (2) adds it to `providers`, (3) registers its global namespace.
- Provider versions are **pinned** to `sst.config.ts` and **do not auto-update**. After any manual change to `providers`, run `sst install`.
- Low-level Pulumi resources are reachable without imports via the global namespace (`new aws.s3.BucketV2(...)`, `await aws.getCallerIdentity({})`). Pulumi SDK helpers come via `$util` etc. — **only inside `run()`**.

**Generator consequence:** if a blueprint uses any non-preloaded provider, the exporter
**must** generate the `sst add <provider>` / `sst install` instructions and a warning.

---

## 3. v3 → v4 migration (context for generated notes)

Source: <https://sst.dev/docs/migrate-from-v3/>

> "SST v4 upgrades the underlying Pulumi AWS provider from v6 to v7."

Flow: upgrade SST → `sst diff` → `sst refresh` (per stage; **no `--target`**) → `sst deploy`.
No code changes unless you use `transform`s or `@pulumi/aws` directly (then apply Pulumi
AWS v7 breaking changes: `tagsAll` not `tags`; S3 `BucketV2`→`Bucket`; `assumeRole`→`assumeRoles`).
Known unofficial friction during refresh (dual-provider-state hangs, Dynamo `rangeKey`
coercion) tracked in SST GitHub issues — surface as a README caveat, not a blocker.

---

## 4. Component reference (MVP catalog)

> Exact verified signatures. **`subscribe()` is NOT uniform across components** — see callout.

### 4.1 `sst.aws.Nextjs`

Source: <https://sst.dev/docs/component/aws/nextjs/>

```ts
new sst.aws.Nextjs('Web', {
  path: '.', // dir relative to sst.config.ts (default ".")
  link: [uploads, jobs, table], // grants perms + SDK access
  environment: { NEXT_PUBLIC_APP_NAME: '...' },
  // server?: { memory, architecture, runtime, timeout }  domain?: string | {...}
});
// outputs: .url ; .nodes.{server,assets,cdn}
```

Builds via OpenNext internally (don't import it). Deploys to **AWS** (Lambda+S3+CloudFront).

### 4.2 `sst.aws.Bucket`

Source: <https://sst.dev/docs/component/aws/bucket>

```ts
new sst.aws.Bucket('Uploads', {
  access: 'public', // "public" | "cloudfront"  — NO `public` boolean
  cors: {
    // defaults to true; set false to disable
    allowHeaders: ['*'],
    allowMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
    allowOrigins: ['*'],
    exposeHeaders: ['ETag'],
    maxAge: '0 seconds',
  },
});
// props: .name .arn .domain ; method: .notify(...)
```

### 4.3 `sst.aws.Dynamo`

Source: <https://sst.dev/docs/component/aws/dynamo/>

```ts
const table = new sst.aws.Dynamo('AppTable', {
  fields: { pk: 'string', sk: 'string' }, // type: "string"|"number"|"binary"
  primaryIndex: { hashKey: 'pk', rangeKey: 'sk' }, // rangeKey optional
  // globalIndexes: { GSI1: { hashKey, rangeKey? } }
  // localIndexes:  { LSI1: { rangeKey } }
  // stream: "keys-only"|"new-image"|"old-image"|"new-and-old-images"
  // ttl: "expireAt"  deletionProtection: true
});

// ⚠️ Dynamo.subscribe IS name-first AND requires stream enabled:
table.subscribe('ProcessRows', 'src/sub.handler', {
  /* filters? */
});
```

### 4.4 `sst.aws.Queue`

Source: <https://sst.dev/docs/component/aws/queue/>

```ts
const jobs = new sst.aws.Queue('Jobs', {
  // fifo?: true | { contentBasedDeduplication }
  // dlq?: arn | { queue, retry }   visibilityTimeout?: "30 seconds"
});

// ⚠️⚠️ Queue.subscribe is SUBSCRIBER-FIRST (NO name arg).
// Put handler/link/timeout in the FIRST FunctionArgs object:
jobs.subscribe({
  handler: 'src/workers/process-job.handler',
  link: [uploads, table],
  timeout: '60 seconds',
});
// 2nd arg = QueueSubscriberArgs (filters/batch/transform ONLY):
//   jobs.subscribe("src/x.handler", { filters: [...] })
```

### 4.5 `sst.aws.Function`

Source: <https://sst.dev/docs/component/aws/function/>

```ts
new sst.aws.Function('MyFn', {
  handler: 'src/lambda.handler', // {path}/{file}.{method} for node/python
  runtime: 'nodejs24.x', // default; node18/20/22/24, go, rust, python3.9–3.14
  link: [bucket],
  environment: { DEBUG: 'true' }, // total <= 4 KB
  timeout: '20 seconds', // default; 1s–900s
});
```

Officially supported runtimes: **Node.js, Go**. Python/Rust are community-supported.

### 4.6 Cron — **use `sst.aws.CronV2`** (`sst.aws.Cron` is deprecated in 2026)

Source: <https://sst.dev/docs/component/aws/cron-v2/>

```ts
new sst.aws.CronV2('DailyJob', {
  function: 'src/cron.handler', // prop is `function` (or `task`), NOT `job`
  schedule: 'rate(1 day)', // "rate(...)" | "cron(...)" | "at(...)"
  // timezone: "America/New_York"  retries: 3  dlq: <arn>
});
```

### 4.7 `sst.Secret`

Source: <https://sst.dev/docs/component/secret/>

```ts
const secret = new sst.Secret('MySecret'); // capital first letter
new sst.aws.Nextjs('Web', { link: [secret] });
// set out-of-band: `sst secret set MySecret <value> [--stage prod] [--fallback]`
// runtime: Resource.MySecret.value
```

### 4.8 Additional components (verified 2026-06-08)

- **`sst.aws.Email`** (SES) — `new sst.aws.Email("Mailer", { sender })`; `sender` is an
  email or a domain (domain verifies via `dns`). Link → `Resource.Mailer.sender`; send with
  `@aws-sdk/client-sesv2` `SendEmailCommand` (`FromEmailAddress: Resource.Mailer.sender`).
  New SES accounts start in sandbox.
- **`sst.aws.Postgres`** (RDS) — **requires a `vpc`**: `const vpc = new sst.aws.Vpc("Vpc");
new sst.aws.Postgres("Db", { vpc })`. Link exposes
  `Resource.Db.{host,port,username,password,database}` → use the `pg` driver. **Not Aurora.**
- **`sst.aws.Aurora`** — distinct (Aurora Serverless v2): `new sst.aws.Aurora("Db",
{ engine: "postgres", vpc })`.
- **`sst.aws.ApiGatewayV2`** — `const api = new sst.aws.ApiGatewayV2("Api");
api.route("GET /", "src/get.handler")` (route key = `"METHOD /path"`; optional 3rd-arg
  config for `link`/`auth`/`memory`).
- **`sst.aws.Bus`** / **`sst.aws.SnsTopic`** — `new sst.aws.Bus("Bus")` /
  `new sst.aws.SnsTopic("Topic")`, each with `.subscribe(...)`; link exposes `.arn`/`.name`.
- **`sst.aws.Router`** / **`sst.aws.StaticSite`** / **`sst.aws.Vpc`** — routing, static
  hosting, and the network the databases need.

> **Implemented in the generator:** Email, Postgres (with auto-VPC), **Cognito**
> (`CognitoUserPool` + `addClient`, `Resource.<Pool>.id`, NEXT*PUBLIC_COGNITO*\* injected via
> Next.js `environment`), the **AI Chat** integration (`@anthropic-ai/sdk`, `claude-opus-4-8`),
> and the **env-driven** integrations **Stripe** / **MongoDB** / **External API** / **Clerk**
> (`@clerk/nextjs` + `clerkMiddleware`) — these emit `lib/*` helpers + `.env.example` keys, not
> SST resources. Bus/SnsTopic/Router/StaticSite/ApiGatewayV2 are documented + verified here and
> queued for the next generator pass.

> **Next.js 16 note:** generated Route Handlers (`app/api/.../route.ts`) export async HTTP
> methods; dynamic `params`/`searchParams` and `cookies()`/`headers()` are **async** (await
> them). Our generated routes don't read dynamic params, so they're 16-clean as-is.

---

## 5. Runtime resource access (generated app code)

Source: <https://sst.dev/docs/linking/>, <https://sst.dev/docs/reference/sdk/>

```ts
import { Resource } from 'sst'; // bare `sst` package
const name = Resource.Uploads.name; // <Name> = component name in sst.config.ts
```

- A resource appears on `Resource` **only if linked** to the consuming component.
- SST generates `sst-env.d.ts` for typed autocomplete.
- AWS SDK clients needed per resource: S3 → `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`; SQS → `@aws-sdk/client-sqs`; Dynamo → `@aws-sdk/client-dynamodb` (or `lib-dynamodb`).

---

## 6. Validator rules (corrected)

- **ERROR** config not `export default $config(...)`; missing triple-slash ref.
- **ERROR** any `sst/constructs` or `SSTConfig` import.
- **ERROR** any provider package import.
- **ERROR** resources outside `run()`; Pulumi/provider calls inside `app()`.
- **ERROR** `removal` value not in `{remove, retain, retain-all}` (reject `destroy`).
- **ERROR** linked-resource usage in app code without `import { Resource } from "sst"`.
- **ERROR** Queue subscriber generated name-first / link in 2nd arg (must be subscriber-first FunctionArgs).
- **ERROR** Dynamo `subscribe` without `stream` enabled.
- **ERROR** Cron emitted as `sst.aws.Cron` or using `job` prop (must be `CronV2` + `function`).
- **ERROR** Bucket `public: true` (must be `access: "public"`).
- **WARN** production `removal` not `retain` / `protect` not `true`.
- **WARN** non-preloaded provider used without generated `sst add` / `sst install` notes.
- **INFO** AWS & Cloudflare preloaded.

---

## 7. Drift Watch (re-verify each SST minor)

- `openNextVersion` default tracks installed SST/Next.js version (pinned in SST source).
- Pulumi AWS provider version (`v7.x` now; v8 will remove deprecated `*V2` S3 resources).
- `Cron` → `CronV2` (already deprecated; a future major may remove `Cron`).
- Exact pinned provider versions in docs examples are illustrative — never hardcode.

---

## 8. Explicit non-goals (MVP)

- No hosted deploy, no AWS credential storage, no SST Console replacement.
- No CloudFormation export.
- No v2/CDK constructs.
- **No AI assistant in MVP** (deferred until export quality is proven).
- Raw Pulumi / low-level provider resources, VPC builder, ECS/Fargate, RDS/Postgres,
  Stripe codegen, Cloudflare DNS automation: post-MVP.

## 9. Deploy targets — multi-target export model

SSTDREAM treats the **deploy target as a per-blueprint selector** (`target.deploy`).
The visual builder, simulation, cost, and recommendation layers are target-aware; only
the **exporter** changes per target. Nothing is ever deployed from the website — every
target produces files the user runs themselves.

- **`aws` (MVP, this doc):** export real SST v4 files (`sst.config.ts` + runtime code).
  App deploys to AWS via `sst.aws.Nextjs` (OpenNext → Lambda+S3+CloudFront). User runs
  `sst deploy` themselves.
- **`vercel` (fast-follow, separate exporter track):** "SST deploy to Vercel" is **not**
  a built-in SST concept — `sst.aws.Nextjs` is AWS-only, and Vercel-in-SST is just a
  non-preloaded **provider** (`sst add vercel`) for managing Vercel projects/DNS. So the
  Vercel target is a **native, non-SST exporter** producing `vercel.json` + `vercel` CLI
  deploy steps (and optionally SST-managed Vercel DNS for users who want it). It reuses
  the same blueprint, simulation, cost, and recommendation layers; only generation differs.

**Two lanes, one shell (corrected model).** AWS/SST and Vercel are **separate product
lanes**, not one canvas with a different export button — see
[architecture-targets.md](architecture-targets.md) for the full spec. Per-lane: the
**catalog** (node types), **edge intents** (what a connection _means_), **validation
rules**, **generators**, **file manifest**, and **docs**. Shared: the **UI shell**, the
blueprint **envelope** (version/target/app/metadata), and the **simulation / cost /
recommendation engines** (frameworks that run over whichever lane's catalog is active).
`target` selects the lane: `"aws-sst-v4" | "vercel"`. This document is the AWS-SST-v4
lane's source of truth; Vercel has its own (pending M10 verification).
