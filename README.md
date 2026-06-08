# SSTDREAM

**Draw your app. Simulate it. Export SST. Deploy it yourself.**

SSTDREAM is a cutting-edge **SST v4 deployment template builder**. You design your
full-stack app visually, watch the architecture **simulate** to confirm everything wires
up correctly, see **cost estimates** and **best-practice recommendations**, then **export
clean, current SST v4 files** you drop into your own project and deploy yourself.

> The website never deploys anything and never touches your cloud credentials.
> It forges files. You run `sst` (or `vercel`) yourself.

---

## The flow

```
Visit site
  → open the cloud builder
  → pick a deploy target (AWS now · Vercel fast-follow)
  → build from scratch or start from a template
  → SIMULATE — verify every resource talks to every other (no deploy)
  → review COST ESTIMATE + RECOMMENDATIONS
  → EXPORT the complete file set
  → drop into your project, run sst yourself
```

## What it is

- A **visual builder** (canvas of resources + connections) for SST v4 architectures.
- A **simulation layer** that proves the wiring ("does the Next.js app actually reach the
  bucket, queue, and table?") — statically, in the browser, **without deploying**.
- A **cost estimator** and a **rule-based recommendation engine** (best practices: DLQs,
  prod `retain`/`protect`, linking, etc.).
- A **versioned, correctness-first generator** that emits **SST v4** (`$config`,
  `sst.aws.*`, links) — never legacy `sst/constructs`/CDK, never provider imports.
- **Two independent lanes, one UI shell.** AWS/SST and Vercel have *different* catalogs,
  edge meanings, validators, and generators — a `Queue`/`Worker` on AWS does **not** map
  to anything on Vercel (background jobs there use Inngest/QStash/etc.). You pick the lane
  up front. See [docs/architecture-targets.md](docs/architecture-targets.md).

## What it is NOT

- ❌ No hosted deploy — nothing runs on the website.
- ❌ No AWS/Vercel credential storage.
- ❌ No SST Console replacement.
- ❌ No CloudFormation / no SST v2 / no CDK constructs.
- ❌ No AI assistant in the MVP (deferred until export quality is proven; the
  architecture stays AI-ready).

## Targets

| Target | Status | How it deploys |
|---|---|---|
| **AWS** | MVP | Real SST v4 files → `sst.aws.Nextjs` (OpenNext → Lambda/S3/CloudFront). User runs `sst deploy`. |
| **Vercel** | Fast-follow | Native exporter (`vercel.json` + `vercel` CLI). SST does not deploy Next.js to Vercel; only the export changes. |

## Correctness is the product

A template builder that emits *wrong* IaC is worthless. Every SST fact this tool generates
is verified against the live SST docs and recorded in
**[docs/sst-v4-target.md](docs/sst-v4-target.md)** — the single source of truth for the
generator and validator. Component renderers carry provenance comments and snapshot tests.

Notable verified gotchas already baked in: `Queue.subscribe` is subscriber-first (no name
arg) while `Dynamo.subscribe` is name-first and needs `stream` enabled; `sst.aws.Cron` is
deprecated (use `CronV2`, prop `function` not `job`); `removal` is
`remove|retain|retain-all` (no `destroy`); Buckets use `access: "public"` (no `public`
boolean); SST v4 runs Pulumi AWS provider **v7**.

## Roadmap

Tracked entirely in this repo's **Milestones**, **Issues**, and **Project board**.

| Milestone | Focus |
|---|---|
| M0 | SST v4 compatibility lock (this doc) ✅ |
| M1 | Builder shell (Next.js 16, React 19, Tailwind, shadcn, @xyflow/react, Zustand) |
| M2 | Blueprint schema + multi-target model (Zod) |
| M3 | Validation engine (SST v4 rules) |
| M4 | SST v4 generator (AWS) |
| M5 | Runtime code generator |
| M6 | Exporter (ZIP / copy / README / manifest) |
| M7 | Simulation engine ("everything talks") |
| M8 | Cost estimation |
| M9 | Recommendations engine |
| M10 | Vercel export target |

**First proof:** the *AI Processing App* template — Next.js Web · Bucket Uploads · Queue
Jobs · Worker ProcessJob · Dynamo AppTable — designed, simulated, and exported end to end.
