import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Live Mode — SSTDREAM',
  description:
    "Live Mode is SSTDREAM's free, local-first observability pillar. Available today: sst-dream scan reverse-engineers any existing SST or Vercel repo into a confidence-scored architecture map — zero credentials, zero network. The vision: overlay real deployed metrics, traces, cost, and drift onto the very diagram you designed, AWS X-Ray style, running on your own machine.",
};

function NowBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
      Available now
    </span>
  );
}

function RoadmapBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-300 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
      The vision · roadmap
    </span>
  );
}

const NOW_FEATURES = [
  'Walks the whole repo — even a sst.config.ts that dynamically import()s packages/infra/*.ts',
  'Redacts secrets before parsing; never reads your .env* files',
  'Reverse-parses SST / Vercel infrastructure into a graph',
  'Runs the same five engines as the builder: validation · simulation · cost · expansion · audit',
  'A high / low confidence flag on every recovered resource',
  'An honest “Not recognized” list — every new sst.* it could not model, never silently dropped',
  'Outputs ARCHITECTURE.md + sstdream-scan.json',
  'Zero credentials · zero network · nothing uploaded',
];

const ROADMAP_FEATURES = [
  'Connect read-only AWS / Vercel — from your machine only',
  'Pull real metrics, traces, logs, cost, alarms, and health',
  'Overlay those live signals onto the diagram you designed (the X-Ray view)',
  'Code-vs-deployed drift detection',
  'Every cloud phase read-only and fenced behind a security gate (SECURITY.md, signed releases, read-only in CI + IAM)',
];

export default function LivePage() {
  return (
    <div className="min-h-screen">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5 text-sm">
        <Link href="/" className="font-bold">
          SSTDREAM
        </Link>
        <div className="flex items-center gap-5">
          <Link
            href="/gallery"
            className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            Gallery
          </Link>
          <a
            href="https://github.com/SoloNerds/sstdream"
            className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            GitHub
          </a>
          <Link href="/builder" className="text-indigo-600 hover:underline dark:text-indigo-400">
            Open the builder →
          </Link>
        </div>
      </nav>

      {/* Hero — lead with the vision, but the last line pivots to what's real today. */}
      <section className="mx-auto max-w-3xl px-6 pb-12 pt-12 text-center sm:pt-20">
        <p className="mb-4 inline-block rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-500 dark:border-neutral-700">
          Live Infra Intelligence · the second pillar · free &amp; local-first
        </p>
        <h1 className="text-balance text-4xl font-bold leading-tight sm:text-5xl">
          Your architecture diagram, lit up with real metrics.
          <br />
          Free — and it never leaves your machine.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-neutral-500">
          Design Mode draws your infrastructure. Live Mode is the other half: a free, local-first
          observability layer — think AWS X-Ray or Datadog, but open-source and run entirely on your
          own localhost.{' '}
          <strong className="text-neutral-700 dark:text-neutral-300">
            Available today: <code className="font-mono">sst-dream scan</code> turns any existing
            SST or Vercel repo into a confidence-scored infrastructure map
          </strong>{' '}
          — zero credentials, zero network.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="h-11 px-6 text-base">
            <a href="#get-started">Get the scan CLI →</a>
          </Button>
          <Button asChild variant="outline" className="h-11 px-6 text-base">
            <a href="https://github.com/SoloNerds/sstdream">View on GitHub</a>
          </Button>
        </div>
      </section>

      {/* The hook: same canvas, now it observes. */}
      <section className="mx-auto max-w-3xl px-6 py-10">
        <h2 className="text-2xl font-bold">The same canvas you designed on — now it observes</h2>
        <p className="mt-3 text-neutral-500">
          Most observability tools hand you a dashboard that looks nothing like how you think about
          your system. SSTDREAM already knows your shape: you drew it in Design Mode, imported it
          from code, or loaded it from the gallery. Live Mode reuses that exact graph and the exact
          same engines — validation, data-flow simulation, cost estimate, logical-to-physical
          expansion, and security audit — but runs them over your real project on disk instead of a
          canvas. Design the diagram once; observe it on the same picture. No new mental model, no
          re-modeling your infra in someone else&apos;s UI.
        </p>
      </section>

      {/* Available now. */}
      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-2xl font-bold">
            <code className="font-mono">sst-dream scan</code> — point it at a repo, get an honest
            map
          </h2>
          <NowBadge />
        </div>
        <p className="text-neutral-500">
          The first piece of Live Mode is real and ships today as a local command-line tool. It
          redacts secrets <strong>before</strong> the code ever reaches the parser, reverse-parses
          the whole project, and runs the builder&apos;s engines over the recovered graph — then
          tells you, honestly, what it could and couldn&apos;t model.
        </p>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {NOW_FEATURES.map((f) => (
            <li key={f} className="flex gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              <span className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Get started — the command block. */}
      <section id="get-started" className="mx-auto max-w-3xl scroll-mt-8 px-6 py-10">
        <h2 className="text-2xl font-bold">Run it in 60 seconds</h2>
        <p className="mt-2 text-neutral-500">
          It runs on <strong>your</strong> machine — clone the repo and point it at any project.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed dark:border-neutral-800 dark:bg-neutral-900">
          <code>{`git clone https://github.com/SoloNerds/sstdream
cd sstdream
yarn install
yarn build:cli
node dist/sst-dream.mjs scan /path/to/your/project
# writes ARCHITECTURE.md + sstdream-scan.json to the current dir (or --out <dir>)
# zero credentials · zero network · nothing uploaded`}</code>
        </pre>
        <p className="mt-3 text-sm text-neutral-500">
          Full details in{' '}
          <a
            href="https://github.com/SoloNerds/sstdream/blob/main/docs/live-mode.md"
            className="text-indigo-600 hover:underline dark:text-indigo-400"
          >
            docs/live-mode.md
          </a>
          .
        </p>
      </section>

      {/* The security callout — the heart of the page. */}
      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6 dark:border-indigo-900 dark:bg-indigo-950/40">
          <h2 className="text-xl font-bold text-indigo-900 dark:text-indigo-200">
            Run it on your own machine, and you keep security in your control
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-indigo-900/80 dark:text-indigo-200/80">
            SSTDREAM is a static site on GitHub Pages — it <em>showcases</em> Live Mode, but Live
            Mode itself runs from the repo you clone, on your own localhost,{' '}
            <strong>never from the hosted URL</strong>. Your code today, and your read-only cloud
            credentials when the observed view ships, stay on your laptop, because there is no
            SSTDREAM backend to receive them. We will never build a hosted &ldquo;connect your AWS
            to sstdream.com&rdquo; flow. Local-first isn&apos;t a limitation here — it&apos;s the
            whole point, and it&apos;s yours to verify, because it&apos;s open source.
          </p>
        </div>
      </section>

      {/* The vision / roadmap. */}
      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-2xl font-bold">The vision: design → observe, on one diagram</h2>
          <RoadmapBadge />
        </div>
        <p className="text-neutral-500">
          This is where Live Mode is going, and we&apos;ll say it plainly:{' '}
          <strong className="text-neutral-700 dark:text-neutral-300">
            this part is not built yet.
          </strong>{' '}
          The roadmap closes the loop — connect read-only AWS or Vercel locally and Live Mode will
          pull your real signals and overlay them onto the diagram you already drew. See which node
          is hot, which edge is slow, where spend concentrates, and where your deployed reality has
          drifted from your code. It&apos;s the AWS X-Ray view — but free, local-first, and anchored
          to your design instead of a generic service map.
        </p>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {ROADMAP_FEATURES.map((f) => (
            <li key={f} className="flex gap-2 text-sm text-neutral-500">
              <span className="mt-0.5 shrink-0 text-neutral-400">○</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Why free + local. */}
      <section className="mx-auto max-w-3xl px-6 py-10">
        <h2 className="text-2xl font-bold">Why free + local beats a hosted dashboard</h2>
        <p className="mt-3 text-neutral-500">
          AWS X-Ray, Datadog, and Cloudcraft are powerful — and they route your telemetry, and your
          bill, through someone else&apos;s platform. SSTDREAM Live Mode makes a different trade on
          purpose: it is free, open-source, and runs on your machine. You are not buying seats or
          per-host pricing to see your own architecture. For the specific job of understanding the
          system you designed, local-first and free wins.
        </p>
      </section>

      {/* Design Mode untouched. */}
      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">Design Mode is untouched</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Live Mode is purely additive — a second pillar with its own route. The visual builder,
            the template gallery, From-code import, and verified file export all stay public and
            fully working, exactly as before. The builder remains zero-AI, zero-network,
            deterministic, and credential-free — Live Mode observes, it never feeds a generator. Two
            pillars, one shell: design what you should build, then understand what you actually
            built.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild size="sm">
              <Link href="/builder">Try Design Mode →</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/gallery">Browse templates</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200 py-8 text-center text-xs text-neutral-400 dark:border-neutral-800">
        SSTDREAM Live Mode · MIT · runs on your machine — your code and credentials never leave it.
      </footer>
    </div>
  );
}
