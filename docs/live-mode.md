# Live Infra Intelligence Mode

SSTDREAM has two pillars:

- **Design Mode** (the visual builder) — _"what should I build, and generate the SST project."_
- **Live Mode** (this) — _"what did I actually build / inherit, how is it wired, what will it cost, and what couldn't we model?"_

Live Mode is **local-first**. It reuses the same engines as the builder (the reverse
parser, validation, simulation, cost, expansion, audit) but runs them over a project on
your disk instead of a canvas in the browser.

## Phase 1 — `sst-dream scan` (shipping now)

A local CLI that turns an existing SST/Vercel repo into a sanitized, confidence-scored
infrastructure map. **No credentials. No network. Nothing uploaded.**

```bash
# in your SST project (from the SSTDREAM repo, until it's on npm):
yarn build:cli
node dist/sst-dream.mjs scan /path/to/your/project

# outputs (written to the current dir, or --out <dir>):
#   ARCHITECTURE.md       a human-readable map (resources, data flow, cost, wiring, gaps)
#   sstdream-scan.json    the same, machine-readable (for CI / future builder import)
```

It works on the hard case the single-file paste can't: a `sst.config.ts` that
dynamically `import()`s `packages/infra/*.ts`. The scanner walks the repo, finds **every**
file that defines infrastructure (wherever it lives), **redacts secrets before parsing**,
reverse-parses the lot, and runs the engines over the recovered graph.

### What you get

- **Resources** with a **confidence** flag (`high` = a direct `new sst.aws.X(...)` the
  parser nailed).
- **Data flow** — the `link[]` / subscribe edges between resources.
- **Estimated cost** — the per-resource monthly ballpark.
- **Wiring check** — the simulation engine's "does everything talk?" pass.
- **Security & ops** — advisory audit findings.
- **Not recognized** — an **honest** list of every `new sst.*` we could **not** turn into
  a node (dynamic/loop/helper patterns, or auto-managed constructs like `Vpc`/`Cluster`).
  Nothing is ever silently dropped — a confident-but-wrong map is worse than an honest one.

### Safety

Same model as the import collector, hardened by the same adversarial corpus:

- Secrets (AWS/Stripe/LLM keys, connection strings incl. Prisma `?api_key=`, PEM blocks,
  etc.) are **redacted before the code reaches the parser**, so they can't reach the
  output JSON either. Over-redacts on purpose.
- `.env*` files are never read.
- Everything runs on your machine. There is no SSTDREAM backend.

## The moat, stated per mode

The old one-liner ("zero network, static page") was an implementation detail, not the
value. The durable promise is two **orthogonal** claims, and they survive Live Mode:

|               | Design Mode                          | Live Mode                                                         |
| ------------- | ------------------------------------ | ----------------------------------------------------------------- |
| **Codegen**   | zero-AI, deterministic, doc-verified | n/a (observation, never generation)                               |
| **Your data** | static page, zero network            | local-first; your code/creds never leave your machine; no backend |

The thing we will **never** build: a hosted "connect your AWS to sstdream.com" flow.

## Roadmap (fenced)

Phase 1 ships entirely under the existing moat. The cloud-observed phases below touch
read-only credentials and are deliberately gated behind a security constitution
(`SECURITY.md`, signed releases, a second adversarial corpus for cloud API responses,
read-only enforced in CI/IAM) — and only after Phase 1 has traction.

- **Phase 2** — AWS read-only "observed view", scoped to **drift + inherited/cross-account**
  (the SST Console's structural blind spot), never a live-ops dashboard.
- **Phase 3** — Vercel read-only observed view.
- **Phase 4** — drift/health: merge local-inferred vs cloud-observed.
- **Phase 5** — `sst-dream live --serve`: a localhost-only dashboard reusing the InfraView.

> The codegen builder stays zero-AI and deterministic throughout. Live Mode is
> observation — it never feeds a generator.
