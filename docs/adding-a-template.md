# Add a template (≈12 lines)

Templates are the easiest, highest-visibility contribution: a good one lands on the
[gallery](/gallery) homepage. A template is just a named canvas snapshot — nodes + edges —
that the test suite runs through the **real** validation + codegen engines, so if it's
accepted, it provably works.

## 1. Pick a lane and open its template file

- **Vercel** → [`lib/templates/vercel.ts`](../lib/templates/vercel.ts)
- **AWS / SST v4** → [`lib/templates/aws.ts`](../lib/templates/aws.ts)

Each uses a terse builder: `n(id, kind, name, x, y, props?)` for nodes and
`e(id, source, target, intent)` for edges.

## 2. Add your design

```ts
vercel(
  'vercel-link-shortener', // unique id (kebab-case)
  'Link Shortener', // display name
  'Short links in Upstash Redis with click analytics in Postgres.',
  ['Starter', 'API'], // tags
  'vercel-shortener', // app name (lowercase-dashes)
  [
    n('app_1', 'app', 'Web', 60, 160),
    n('redis_2', 'redis', 'Links', 360, 80),
    n('postgres_3', 'postgres', 'Analytics', 360, 240),
  ],
  [
    e('e1', 'app_1', 'redis_2', 'writesToService'),
    e('e2', 'app_1', 'postgres_3', 'writesToService'),
  ],
),
```

Only use **kinds and edge intents your lane supports** — see the catalog
(`lib/targets/<lane>/catalog.ts`) and edges (`lib/targets/<lane>/edges.ts`). The valid
default intent for a `(from, to)` pair is what the canvas would draw automatically.

## 3. Rules of thumb (so it validates clean)

- **Unique, PascalCase** resource names within the design; **lowercase-dashes** app name.
- A **consumer** needs a queue → consumer (`consumedBy`) edge; a **cron** needs a valid
  schedule (Vercel: 5-field UTC, daily on Hobby).
- Don't make two same-kind nodes whose names kebab-case to the same slug (route/file
  collision — the gate will reject it).

## 4. Verify

```bash
yarn test templates   # validates every template (zero errors, generates files)
yarn test             # the full suite, incl. typecheck-the-export
```

That's it — open a PR. The gallery picks it up automatically.
