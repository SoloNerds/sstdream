# Local AI Ops Agent (optional, third pillar)

> **The builder still writes zero AI-generated infrastructure — the codegen is deterministic,
> forever.** The agent is a _separate, optional_ tool. It is **read-only**, runs on **your**
> machine, uses **your** model (or none), and **can never touch the generator.** The first two
> pillars are the product; this is a cutting-edge cherry on top that you can ignore entirely.

The agent is an **SST-aware systems analyst**, not a chatbot. A normal "chat with your cloud"
bot has no system model and guesses. This one reasons from a **verified, confidence-scored map
of your actual system** (the scan graph) plus the **latest verified SST docs** — so it can't
invent infrastructure or hand you deprecated SST.

## The moat, per layer

| Layer             | Promise                                                                               |
| ----------------- | ------------------------------------------------------------------------------------- |
| **Codegen**       | zero-AI, deterministic, doc-verified — **unchanged, forever**                         |
| **Your data**     | local-first, **bring-your-own-key**, no SSTDREAM backend, redact-before-model         |
| **Ops reasoning** | **grounded** in YOUR real graph + the latest SST docs — never the model's stale guess |

The load-bearing word in the agent row is **grounded**, not _AI_. The one thing AI is bad at —
inventing infra from nothing — is the one thing we still refuse to let it do.

## How it works (LLM-as-narrator)

The deterministic engines do the thinking; a model (if you connect one) only **narrates**:

1. **Ground** — the agent builds facts from the **scan graph** (resources, edges, cost,
   expansion, the honest `unmodeled` list) and the **verified SST docs** (`docs/sst-v4-target.md`,
   pinned to your installed SST version, **cited** in every answer).
2. **Narrate** — a model, if configured, explains those facts in plain language. It is given
   the facts; it cannot add a "Known fact" the graph/docs didn't produce.
3. **Answer honestly** — every answer is four sections: **Known facts** (each cited),
   **Likely causes**, **Suggested checks**, **Unknowns** (the scan's gaps, verbatim — never a
   silent drop). On a grounding miss the agent **refuses** rather than guess.

## Available now (no model, zero network)

```bash
sst-dream agent check [dir]               # flag deprecated SST vs current docs (cited)
sst-dream agent explain <resource> [dir]  # describe a resource purely from the graph
```

`agent check` is the grounding thesis made concrete: it catches `sst.aws.Cron` (use `CronV2`),
`sst/constructs` (that's v2/CDK), `removal: "destroy"`, Bucket `public: true`, and `@pulumi/*`
imports — the exact stale-SST patterns a model trained a year ago would emit confidently.
**No model is called and nothing leaves your machine.**

## Bring your own model (coming next)

When the model-narration layer lands, you choose: **OpenAI / Anthropic / Google / Groq /
OpenRouter / Bedrock / Azure** with **your own key**, a **local LLM** (Ollama / LM Studio /
llama.cpp / vLLM), or **no AI** (the default — the deterministic answers above still work).

- **Your key is yours.** Enter it once; choose to **save it locally** or **keep it for the
  session only** (cleared when you close). SSTDREAM never persists it server-side, never logs
  it, and there is no SSTDREAM AI backend — calls go from _your_ machine to _your_ provider.
- **Redact-before-send.** Every byte of context passes through the adversarial sanitizer at a
  single seam before any hosted model sees it. A **local-only mode** makes hosted providers
  un-loadable. An **audit log** records exactly what context was sent where.
- **Read-only, forever.** No tool that deploys/mutates/rotates/commits is ever registered, and
  the agent has **no import path to the generator** — enforced by a CI test, not a policy.

## Roadmap

- **Phase 0 (now):** `agent check` / `explain`, deterministic, grounded, zero network.
- **Phase 1:** model narration (`agent ask`) — local LLM first, then hosted behind a hardened
  second sanitizer corpus + an eval harness (zero uncited facts, zero invented resources); a
  Live-Mode agent panel.
- **Phase 2 (gated on the cloud-observed Live phases):** `agent watch` + grounding in real
  logs/metrics/drift. Watch without live data is theatre, so it waits for those phases.

The codegen stays zero-AI and deterministic regardless. This isn't a walk-back on "no AI" —
it's the "AI hallucinates infrastructure" thesis shipped as the cure.
