# Import an existing project ("From code")

The builder's **From code** button reverse-engineers an existing project into an
editable diagram. The browser builder can't read your filesystem, so you paste the
code in.

## Single-file `sst.config.ts`

If all your resources are declared in `sst.config.ts`, just paste it. Each
`new sst.aws.X("Name", {...})` becomes a node, `link: [...]` arrays become edges, and
anything the builder can't model is **listed, never silently dropped**.

## Multi-file projects (`packages/infra/*.ts`)

Real projects split infrastructure across modules and `import()` them from
`sst.config.ts`, so the config itself has no `new sst.aws.*` calls — pasting it alone
yields "nothing recognized." Use the collector to bundle every resource-defining file
into one pasteable blob:

```bash
# in your SST project root (where sst.config.ts lives)
node path/to/sstdream-collect.mjs        # writes sstdream-import.txt
# or the wrappers:
./sstdream-collect.sh                     # bash / macOS / Linux / WSL
.\sstdream-collect.ps1                    # PowerShell / Windows
```

It finds every file that defines infrastructure (`new sst.*` / `$config`) wherever it
lives, concatenates them, **sanitizes secrets**, and writes `sstdream-import.txt`.
**Review it**, then paste its contents into From code.

> Get the script from
> [`scripts/sstdream-collect.mjs`](../scripts/sstdream-collect.mjs) (single file, no
> install — every SST project already has Node).

## Safety — what the collector does NOT leak

The collector runs **entirely on your machine** and **uploads nothing**. Before
writing, it redacts secret values (over-redacting on purpose — blanking a non-secret
is harmless, leaking a real one isn't). It:

- **never reads `.env*` files**;
- redacts known key/token shapes (AWS, Stripe, OpenAI/Anthropic, GitHub, Slack,
  SendGrid, Google, JWTs, `whsec_`, …);
- redacts connection-string credentials — `user:pass@` **and** query-param tokens like
  Prisma's `?api_key=` and JDBC `;password=`;
- redacts PEM private-key/certificate blocks and base64-encoded credential blobs;
- redacts any string assigned to a secret-named field (`*Secret`, `*Password`,
  `*Token`, `clientSecret`, `DATABASE_URL`, …), including values split across string
  fragments — and the fallback value of `new sst.Secret("Name", "fallback")`.

Resource **names** and the structural `sst.aws.*` calls are preserved (that's all the
diagram needs). The redactor is pinned by an adversarial test corpus — see
`lib/core/reverse/sanitize.test.ts`. Still, **review the output before pasting.**

## Very large / advanced deployments

The diagram recovers what it can model and **lists the rest** as "not recognized"
(custom `$transform`s, `sst.Linkable`, resources created in loops, components the
catalog doesn't cover yet). You get a faithful partial picture plus an honest list of
what to wire by hand — never a silently-incomplete one.
