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

## Known follow-ups

- Simulation / cost / recommendations are AWS-only; they degrade gracefully on the Vercel
  lane (selectors return empty). Add Vercel providers to complete parity.
- No AI assistant (deferred by design until export quality is proven).
