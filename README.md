# SSTDREAM

**Draw your app. Simulate it. Export SST. Deploy it yourself.**

[![CI](https://github.com/SoloNerds/sstdream/actions/workflows/ci.yml/badge.svg)](https://github.com/SoloNerds/sstdream/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

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
  → pick a lane (AWS/SST or Vercel — both complete)
  → build from scratch, start from a template, OR paste existing code ("From code")
  → SIMULATE — verify every resource talks to every other (no deploy)
  → review COST ESTIMATE + the SST-Console-style Infrastructure view + RECOMMENDATIONS
  → EXPORT the complete, type-checked file set
  → drop into your project, run `sst dev` / `vercel` yourself
```

## What it is

- A **visual builder** (canvas of resources + connections) for SST v4 architectures.
- A **simulation layer** that proves the wiring ("does the Next.js app actually reach the
  bucket, queue, and table?") — statically, in the browser, **without deploying**.
- A **cost estimator** and a **rule-based recommendation engine** (best practices: DLQs,
  prod `retain`/`protect`, linking, etc.).
- A **versioned, correctness-first generator** that emits **SST v4** (`$config`,
  `sst.aws.*`, links) — never legacy `sst/constructs`/CDK, never provider imports.
- A **reverse-engineer** ("From code"): paste an existing `sst.config.ts` (or a Vercel
  `package.json`) and it draws the architecture **back out** as an editable design —
  and tells you honestly what it couldn't model, never silently dropping anything.
- **Two complete lanes, one UI shell.** AWS/SST (**28 kinds** — serverless + ECS Fargate
  containers, Redis, Realtime, Step Functions, AppSync, OpenAuth, …) and Vercel (**22 kinds**
  — AI Gateway, Workflows, Sandboxes, Edge Middleware, Feature Flags, …) have _different_
  catalogs, edges, validators, and generators. You pick the lane up front. See
  [docs/architecture-targets.md](docs/architecture-targets.md).

## What it is NOT

- ❌ No hosted deploy — nothing runs on the website.
- ❌ No AWS/Vercel credential storage.
- ❌ No SST Console replacement.
- ❌ No CloudFormation / no SST v2 / no CDK constructs.
- ❌ **No AI or network calls in the builder** — by design. AI-codegen tools hallucinate
  infrastructure; SSTDREAM emits only **verified, type-checked, doc-provenanced** code, and
  never touches your credentials. (The AI Gateway / AI Chat kinds only _generate_ code that
  calls AI — the builder itself makes zero AI calls.)

## Targets

| Target      | Status   | How it deploys                                                                                                                |
| ----------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **AWS/SST** | Complete | Real SST v4 files (`sst.aws.*`, links). 28 kinds. User runs `sst dev` / `sst deploy`.                                         |
| **Vercel**  | Complete | Native exporter (`vercel.json` + `vercel` CLI). 22 kinds. SST does not deploy Next.js to Vercel; the export changes per lane. |

## Correctness is the product

A template builder that emits _wrong_ IaC is worthless. Every SST fact this tool generates
is verified against the live SST docs and recorded in
**[docs/sst-v4-target.md](docs/sst-v4-target.md)** — the single source of truth for the
generator and validator. Component renderers carry provenance comments and snapshot tests.

Notable verified gotchas already baked in: `Queue.subscribe` is subscriber-first (no name
arg) while `Dynamo.subscribe` is name-first and needs `stream` enabled; `sst.aws.Cron` is
deprecated (use `CronV2`, prop `function` not `job`); `removal` is
`remove|retain|retain-all` (no `destroy`); Buckets use `access: "public"` (no `public`
boolean); SST v4 runs Pulumi AWS provider **v7**.

## Roadmap

Tracked entirely in this repo's **Milestones**, **Issues**, and **Project board** —
**all 11 milestones (M0–M10) are complete.** Both lanes are at **functional parity**: each
ships a runnable project scaffold, validation, simulation, cost, the Infrastructure view,
the security audit, recommendations, and a **reverse-engineer** (paste code → diagram).
**AWS: 28 kinds** (serverless + **containers**: ECS Fargate Service/Task, Redis, Realtime IoT
pub/sub, Step Functions, AppSync GraphQL, OpenAuth, …). **Vercel: 22 kinds** spanning the whole
Vercel surface — AI Gateway, Workflows, Sandboxes, Edge Middleware, Feature Flags, BotID, Edge
Config, Rate Limit, OG Image, and more — all verified against live docs. See
[docs/architecture-targets.md](docs/architecture-targets.md).

| Milestone | Focus                                                                          | Status |
| --------- | ------------------------------------------------------------------------------ | ------ |
| M0        | SST v4 compatibility lock (verified docs)                                      | ✅     |
| M1        | Builder shell (Next.js 16, React 19, Tailwind, shadcn, @xyflow/react, Zustand) | ✅     |
| M2        | Blueprint schema + multi-target model (Zod)                                    | ✅     |
| M3        | Validation engine (SST v4 rules)                                               | ✅     |
| M4        | SST v4 generator (AWS)                                                         | ✅     |
| M5        | Runtime code generator                                                         | ✅     |
| M6        | Exporter (ZIP / copy / README / manifest)                                      | ✅     |
| M7        | Simulation engine ("everything talks")                                         | ✅     |
| M8        | Cost estimation                                                                | ✅     |
| M9        | Recommendations engine                                                         | ✅     |
| M10       | Vercel lane (scaffold + validation + all five engines — functional parity)     | ✅     |

**First proof:** the _AI Processing App_ template — Next.js Web · Bucket Uploads · Queue
Jobs · Worker ProcessJob · Dynamo AppTable — designed, validated, simulated, costed, and
exported to a deployable SST project end to end. A **Vercel SaaS** template proves the
second lane.

## Run it

```bash
yarn install
yarn dev          # http://localhost:3000/builder
yarn test         # 536 tests
yarn lint && yarn typecheck && yarn build
```

Open `/builder`, pick a lane (AWS / Vercel), **Load template**, then **Simulate**,
check **Cost** / **Tips**, and **Export** the project (copy files or download the ZIP).

## Contributing

Contributions are welcome — new resource kinds, edges, validation rules, lanes, or builder
polish. Because the website forges files you actually deploy, **correctness is the
product**: every generated snippet must match a verified target fact. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and the correctness contract, and
[CLAUDE.md](CLAUDE.md) for the architecture. Be excellent to each other —
[Code of Conduct](CODE_OF_CONDUCT.md).

## Security

The builder runs entirely in your browser and never touches your cloud credentials. Report
vulnerabilities privately — see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © SSTDREAM contributors.
