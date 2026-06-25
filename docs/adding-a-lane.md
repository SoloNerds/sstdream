# Add a deploy target (a "lane")

SSTDREAM is two independent lanes over one shell. Adding your platform — Cloudflare
Workers, Fly.io, Render, raw SST, Amplify — is a self-contained, well-bounded PR. The shared
UI, blueprint envelope, and engines all run over whichever lane is active.

> Start by writing a `docs/<your-lane>-target.md` of **verified facts** (the exact APIs,
> limits, and gotchas, with doc links). Correctness is the product; the generator must match
> a source of truth, not memory.

## The contract

A lane lives in `lib/targets/<your-lane>/` and provides a `Target`
([`lib/targets/types.ts`](../lib/targets/types.ts)):

```ts
export const myLaneTarget: Target = {
  id: 'my-lane',
  label: 'My Lane',
  catalog: MY_CATALOG, // resource kinds + their editable props
  catalogOrder: MY_CATALOG_ORDER,
  edgeIntents: MY_EDGE_INTENTS, // allowed connections + meaning
  defaultIntent: myDefaultIntent, // (fromKind, toKind) -> intent | null
};
```

## Registration touch-points

Add `'my-lane'` to the `DeployTarget` union ([`lib/targets/types.ts`](../lib/targets/types.ts))
and the Zod enum ([`lib/core/blueprint/schema.ts`](../lib/core/blueprint/schema.ts)), then wire:

| File | What you add |
| ---- | ------------ |
| `lib/targets/registry.ts` | your `Target` in the `REGISTRY` map |
| `lib/core/validation/validate.ts` | your rules in `RULES` (a total map — required) |
| `lib/core/codegen/generate.ts` | your `generate(bp)` in `GENERATORS` |
| `lib/core/export/manifest.ts` | your README/.env builders in `DOCS` |
| `lib/core/blueprint/serialize.ts` | your lane's `target` defaults in `TARGET_DEFAULTS` |

That's enough to **build, validate, and export**. The advisory engines are optional and
degrade gracefully when absent (the panel shows "not available for this lane yet"):

| File | Engine |
| ---- | ------ |
| `lib/core/simulation/simulate.ts` | data-flow trace |
| `lib/core/cost/estimate.ts` | cost estimate |
| `lib/core/expansion/expand.ts` | Infrastructure view |
| `lib/core/audit/audit.ts` | security/ops findings |
| `lib/core/recommendations/recommend.ts` | one-click fixes |

See `lib/targets/vercel/` as the smaller reference implementation (and `aws-sst-v4/` for the
deep one).

## Quality bar

- A **snapshot test** for the generator and a few **export-gate** tests for the rules.
- Add at least one **template** (see [adding-a-template.md](adding-a-template.md)) — that's
  what exercises your generator through `typecheck-export.test.ts`, which type-checks every
  generated project. If your output type-checks there, it's real.
- `yarn lint && yarn test && yarn typecheck && yarn build` all green.
