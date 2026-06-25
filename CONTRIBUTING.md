# Contributing to SSTDREAM

Thanks for your interest in improving SSTDREAM — a visual **SST v4 / Vercel deployment
template builder**. The website never deploys anything; it generates files you run
yourself. Because of that, **correctness is the product**: every generated snippet must
match a verified target fact, or it's a bug.

## Ground rules

- **Be kind.** This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
- **Correctness over cleverness.** A generator that emits _wrong_ IaC is worse than one
  that emits less. Match the verified docs.
- **No `any`.** TypeScript is strict; prefer explicit types and Zod-validated boundaries.

## Project layout

See [CLAUDE.md](CLAUDE.md) for the architecture in depth. The short version:

- `lib/core/` — lane-agnostic engines (blueprint, validation, simulation, cost, expansion,
  audit, recommendations, codegen, export).
- `lib/targets/<lane>/` — per-lane catalog, edges, validation, generator, docs.
- `components/builder/` — the canvas UI shell.
- `docs/` — **source-of-truth** verified facts. Read these before changing a generator or
  validator.

## Dev setup

```bash
yarn install
yarn dev          # builder at http://localhost:3000/builder
```

Before opening a PR, all of these must pass (CI runs them too):

```bash
yarn lint
yarn test         # vitest
yarn typecheck    # tsc --noEmit
yarn build        # next build (static export)
yarn format       # prettier --write (formatter of record)
```

## Workflow

1. **Branch** off `main` (`fix/...`, `feat/...`, `chore/...`). Direct pushes to `main` are
   blocked.
2. **Open a PR.** Keep it focused; describe the user-visible change and the verified fact
   it relies on.
3. **Squash-merge** once green and reviewed (`gh pr merge --squash`).

## Adding to a generator (the correctness contract)

Every generated snippet must be traceable to a verified fact:

1. **Verify it.** Find the fact in `docs/sst-v4-target.md` or `docs/vercel-target.md`. If
   it isn't recorded there, add it (with a source) first.
2. **Carry provenance.** Renderers note `verified: <doc>@<version>`.
3. **Snapshot it.** Add or update a snapshot test. Don't hand-edit `*.snap` — run
   `yarn test` and review the diff.
4. **Gate it.** If a bad design could produce broken output, add a validation rule (with a
   comment naming the exact generator failure it guards) and a regression test in the
   lane's `export-gate.test.ts`.

## Adding a new lane

A lane is registered in `lib/targets/registry.ts` plus the `generate.ts`, `validate.ts`,
and `export/manifest.ts` maps, with its own catalog/edges/validation/generator/docs under
`lib/targets/<lane>/`. The blueprint's `target.deploy` selects it. Engines degrade
gracefully (return empty) for lanes that don't implement them yet.

## Reporting bugs & requesting features

Use the issue templates. For a generator bug, please include the **design** (the exported
`sstdream.design.json` round-trips) and the **expected vs actual generated output**.

## Security

Please do not file public issues for security problems — see
[SECURITY.md](SECURITY.md) (or use GitHub's private vulnerability reporting).
