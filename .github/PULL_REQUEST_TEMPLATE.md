<!-- Keep PRs focused. Link the issue if there is one. -->

## What & why

<!-- The user-visible change in a sentence or two. -->

## Correctness (for generator/validator changes)

<!-- Delete this section if N/A. -->

- [ ] The emitted output matches a verified fact in `docs/sst-v4-target.md` /
      `docs/vercel-target.md` (link the section).
- [ ] Renderer carries a `verified: <doc>@<version>` note.
- [ ] Snapshot test added/updated (not hand-edited).
- [ ] If a bad design could break the export, a validation rule + an `export-gate.test.ts`
      case was added.

## Checklist

- [ ] `yarn lint` · `yarn test` · `yarn typecheck` · `yarn build` all pass
- [ ] `yarn format` applied
- [ ] Branch is `fix/…` `feat/…` or `chore/…` (not a direct push to `main`)
