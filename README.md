# SSTDREAM

**Draw your app. Prove it works. Ship the code.**

[![CI](https://github.com/SoloNerds/sstdream/actions/workflows/ci.yml/badge.svg)](https://github.com/SoloNerds/sstdream/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

### ▶ [Open the live builder →](https://solonerds.github.io/sstdream/builder/)

No install. No login. No credentials. Design in your browser, export a complete project, and
deploy it yourself.

SSTDREAM is a visual builder for **SST v4 (AWS)** and **Vercel**. You lay out a full-stack app on
a canvas, watch it simulate so you know the wiring works, see cost estimates and an
SST-Console-style infrastructure view, then export clean, verified, type-checked files. You drop
them into your project and run `sst` or `vercel` yourself.

> The site never deploys anything and never touches your cloud credentials. It writes files. You
> run them. The builder makes zero AI calls and zero network calls.

## Three pillars

**1. Design Mode (the builder).** Draw infrastructure on a canvas and export a real project. The
generator is deterministic. Every line maps to a real SST or Vercel API, is recorded with the doc
it came from, and the whole export is type-checked in CI. No model is in the loop. Two complete
lanes: AWS/SST (28 kinds) and Vercel (22 kinds).

**2. Live Mode (`sst-dream scan`).** Read a project you already shipped. Point the local CLI at an
existing repo and it reverse-engineers the code into a confidence-scored infrastructure map. It
handles the hard case where `sst.config.ts` dynamically imports `packages/infra/*.ts`. Secrets are
redacted before parsing. Zero credentials, zero network, nothing uploaded. Paste the result back
into the builder to edit it as a diagram.

**3. AI Ops Agent (`sst-dream agent`), optional.** A local, read-only, bring-your-own-model agent
grounded in your scan graph and the verified SST docs. Today it runs deterministically with no
model: `agent check` flags deprecated SST cited to the docs, `agent explain` describes a resource
straight from the graph. It never deploys and it never writes infra. A CI test forbids it from
importing the generator. Model narration (your own key or a local LLM) is the next phase.

The page you open in a browser is pillar 1, and it stays zero-AI, zero-network, credential-free.
Live Mode and the agent run on your own machine.

## Who it's for

- **New to SST or Vercel?** Start from a template. Watch the simulation turn green. Export a
  complete, runnable project with an `AGENTS.md` that explains every file, then run `sst dev`. The
  builder will not let you wire something that would not deploy, and the cost and tips panels teach
  the patterns as you go.
- **Already deep in SST?** 28 AWS kinds (ECS Fargate containers, Redis, Realtime, Step Functions,
  AppSync, OpenAuth, and more) and 22 Vercel kinds. Every snippet is verified against the live docs
  and type-checked end to end by a meta-test that compiles every generated project. Paste your
  existing `sst.config.ts` or a Vercel `package.json` with **From code** and edit it visually.

## The flow (Design Mode)

```
Open the builder
  pick a lane (AWS/SST or Vercel, both complete)
  build from scratch, start from a template, or paste existing code (From code)
  SIMULATE: confirm every resource reaches every other, with no deploy
  review the COST ESTIMATE, the Infrastructure view, and RECOMMENDATIONS
  EXPORT the type-checked file set
  drop it into your project and run sst dev / vercel yourself
```

## Live Mode in 30 seconds

`scripts/sst-dream.mjs` is a single self-contained file (committed). No clone, no install, no
build. Copy the `scripts/` folder into your project and run it.

```bash
cd your-sst-project
node scripts/sst-dream.mjs scan .          # the infra map
node scripts/sst-dream.mjs agent check     # flag deprecated SST against current docs
#  scan  -> ARCHITECTURE.md + sstdream-scan.json (resources, data flow, cost, wiring,
#           and a plain list of anything it could not model)
```

It runs on your machine. No credentials, no network, nothing uploaded. See
[docs/live-mode.md](docs/live-mode.md) and [docs/ai-ops-agent.md](docs/ai-ops-agent.md).

## What it is NOT

- No hosted deploy. Nothing runs on the website.
- No AWS or Vercel credential storage.
- No SST Console replacement.
- No CloudFormation, no SST v2, no CDK constructs.
- **No AI in the generator, by design.** AI-codegen tools hallucinate infrastructure. SSTDREAM
  emits only verified, type-checked, doc-provenanced code. The AI Gateway and AI Chat kinds only
  _generate_ code that calls AI. The builder itself makes zero AI calls.

## Targets

| Target      | Status   | How it deploys                                                                                                                       |
| ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **AWS/SST** | Complete | Real SST v4 files (`sst.aws.*`, links). 28 kinds. You run `sst dev` / `sst deploy`.                                                  |
| **Vercel**  | Complete | Native exporter (`vercel.json` + the `vercel` CLI). 22 kinds. SST does not deploy Next.js to Vercel, so the export changes per lane. |

## Correctness is the product

A template builder that emits wrong config is worse than nothing. Every SST fact this tool
generates is verified against the live SST docs and recorded in
**[docs/sst-v4-target.md](docs/sst-v4-target.md)**, the single source of truth for the generator
and validator. Renderers carry provenance comments and snapshot tests. A meta-test type-checks
every generated project. There are **682 tests** in CI.

A few verified gotchas baked in: `Queue.subscribe` is subscriber-first while `Dynamo.subscribe` is
name-first and needs `stream` enabled. `sst.aws.Cron` is deprecated, use `CronV2` with `function`
not `job`. `removal` is `remove | retain | retain-all`, never `destroy`. Buckets use
`access: "public"`, not a `public` boolean. SST v4 runs Pulumi AWS provider v7.

## Plugins (foundation)

The credential-touching parts (cloud metric connectors, AI providers, dashboard panels, custom
rules) are becoming opt-in, user-installed, capability-scoped plugins instead of core code. The
contract and the wall that keeps plugin code out of the static page are in place and CI-enforced.
**Nothing loads yet.** A manifest is consent and audit, not a sandbox. See
[docs/plugins.md](docs/plugins.md).

## Roadmap

Design Mode is complete on both lanes (scaffold, validation, simulation, cost, the Infrastructure
view, the security audit, recommendations, and the reverse-engineer). Live Mode Phase 1 (the local
scan) and the AI agent Phase 0 (deterministic, grounded) are shipped.

Next, tracked in **Issues** and the **SSTDREAM Roadmap** project:

- Live Mode cloud-observed view: read-only AWS/Vercel metrics overlaid on the diagram, fenced
  behind a security gate.
- The agent's model layer: bring-your-own-key and local-LLM narration, then watch/report.
- The plugin loader and the first read-only connector.
- A containerized operational dashboard for the live tier ([#85](https://github.com/SoloNerds/sstdream/issues/85)).

## Run it locally

```bash
yarn install
yarn dev          # http://localhost:3000/builder
yarn test         # 682 tests
yarn lint && yarn typecheck && yarn build
yarn build:cli    # the drop-in scripts/sst-dream.mjs
```

## Contributing

Contributions are welcome: new resource kinds, edges, validation rules, lanes, or builder polish.
Because the site writes files you actually deploy, correctness is the product. Every generated
snippet must match a verified target fact. See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow
and the correctness contract, and [CLAUDE.md](CLAUDE.md) for the architecture.
[Code of Conduct](CODE_OF_CONDUCT.md).

## Security

The builder runs entirely in your browser and never touches your cloud credentials. Live Mode and
the agent run on your machine and make no calls to any SSTDREAM backend. Report vulnerabilities
privately. See [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © SSTDREAM contributors.
