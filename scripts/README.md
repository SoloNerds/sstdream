# SSTDREAM — drop-in local tools

**Copy this folder into your existing SST/Vercel project and run it.** No clone of the
SSTDREAM repo, no `yarn install`, no build step. Everything runs on **your** machine —
zero credentials, zero network, nothing uploaded. Secrets are redacted before anything is
written.

```bash
# from anywhere — grab the folder:
#   - download the repo's scripts/ folder, or
#   - copy these files into a scripts/ folder in your project
cd your-sst-project
node scripts/sst-dream.mjs scan .     # or:  ./scripts/sst-dream.sh scan .
```

## What's here

| File                                           | What it does                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`sst-dream.mjs`**                            | **The scan tool.** A single self-contained bundle (the whole SSTDREAM engine set, inlined). `scan <dir>` walks your project — even a `sst.config.ts` that dynamically `import()`s `packages/infra/*.ts` — sanitizes secrets, reverse-parses it, runs validation / simulation / cost / expansion / audit, and writes **`ARCHITECTURE.md`** (a readable infra map) + **`sstdream-scan.json`**. |
| `sst-dream.sh` · `sst-dream.ps1`               | Thin wrappers (bash / PowerShell) that run `sst-dream.mjs`.                                                                                                                                                                                                                                                                                                                                  |
| `sstdream-collect.mjs`                         | **The paste collector** (lighter alternative). Bundles + sanitizes your infra files into `sstdream-import.txt` to paste into the hosted builder's **"From code"** import.                                                                                                                                                                                                                    |
| `sstdream-collect.sh` · `sstdream-collect.ps1` | Wrappers for the collector.                                                                                                                                                                                                                                                                                                                                                                  |
| `sanitize.mjs`                                 | The shared secret redactor (source). The scan bundle already inlines it; you don't run this directly.                                                                                                                                                                                                                                                                                        |

## The two ways to use it

1. **Full local scan (recommended)** — `node scripts/sst-dream.mjs scan .`
   You get `ARCHITECTURE.md` + `sstdream-scan.json` right in your project. Nothing leaves
   your machine.

2. **Paste into the visual builder** — `node scripts/sstdream-collect.mjs`
   Produces `sstdream-import.txt`; paste it into the builder's **From code** to see your
   architecture as an editable diagram. (Review the file first — secrets are redacted, but
   it's your call what to paste.)

## Safety

- Runs entirely locally. There is no SSTDREAM backend.
- Secrets (API keys, connection strings, PEM blocks, …) are redacted **before** parsing, so
  they never reach the output. `.env*` files are never read.
- `sst-dream.mjs` is a **generated** bundle (built from the repo by `yarn build:cli`); CI
  rebuilds it and fails on drift, so the committed copy is always current. Review it like
  any third-party script before running.

See [`docs/live-mode.md`](https://github.com/SoloNerds/sstdream/blob/main/docs/live-mode.md)
for the full story and the roadmap.
