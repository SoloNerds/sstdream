import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Live Mode · SSTDREAM',
  description:
    'Live Mode reads an SST or Vercel repo you already shipped and rebuilds the diagram on your machine. No credentials. No network. sst-dream scan writes a static map today. A read-only live metrics overlay is on the roadmap.',
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
  'Walks the whole repo, including an sst.config.ts that dynamically imports packages/infra/*.ts',
  'Strips secrets before parsing. Never reads your .env files.',
  'Reverse-parses SST and Vercel infrastructure into a graph',
  "Runs the builder's five engines: validation, simulation, cost, expansion, audit",
  'Tags every recovered resource high or low confidence',
  'Lists everything it did not recognize. No new sst.* is dropped silently.',
  'Writes ARCHITECTURE.md and sstdream-scan.json',
  "Paste sstdream-scan.json into the builder's From code and edit it as a diagram",
  'No credentials. No network. Nothing uploaded.',
];

const ROADMAP_FEATURES = [
  'Connect read-only AWS or Vercel from your machine only',
  'Pull real metrics, traces, logs, cost, alarms, and health',
  'Overlay those signals on the diagram you designed',
  'Detect drift between code and what is deployed',
  'Every cloud phase is read-only and gated behind a security review',
];

export default function LivePage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-neutral-200/60 bg-white/70 backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-950/70">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 text-sm lg:px-10">
          <Link href="/" className="text-lg font-bold tracking-tight">
            SSTDREAM
          </Link>
          <div className="flex items-center gap-6">
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
              Open the builder
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 -z-10 h-72 w-72 rounded-full bg-indigo-600/20 opacity-40 blur-3xl"
        />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-12 lg:px-10 lg:py-28">
          <div className="lg:col-span-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-3 py-1 text-[13px] font-medium text-neutral-500 dark:border-neutral-700">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden />
              Live Mode. The second pillar. Free and local-first.
            </span>
            <h1 className="mt-5 text-5xl font-bold leading-[1.05] tracking-tight lg:text-7xl">
              See your real architecture. It never leaves your machine.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-600 lg:text-xl dark:text-neutral-400">
              Design Mode draws your infrastructure. Live Mode reads what you already shipped. Point
              it at an SST or Vercel repo. It rebuilds the diagram, scores its confidence, and shows
              the data flow. It runs on your laptop. It uses no credentials and makes no network
              calls.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="group h-12 px-7 text-base shadow-lg shadow-indigo-600/20">
                <a href="#get-started">
                  Get the scan CLI
                  <span
                    aria-hidden
                    className="ml-1 inline-block transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </a>
              </Button>
              <Button asChild variant="outline" className="h-12 px-7 text-base">
                <a href="https://github.com/SoloNerds/sstdream">View on GitHub</a>
              </Button>
            </div>
          </div>

          {/* Terminal product visual */}
          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 shadow-xl shadow-indigo-500/5 ring-1 ring-black/5 dark:border-neutral-800 dark:bg-neutral-900/60 dark:ring-white/10">
              <div className="flex items-center gap-1.5 border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
                <span className="ml-2 font-mono text-xs text-neutral-400">your-sst-project</span>
                <span className="ml-auto rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                  Available now
                </span>
              </div>
              <pre className="overflow-x-auto px-5 py-4 font-mono text-[13px] leading-relaxed">
                <code>
                  <span className="text-indigo-600 dark:text-indigo-400">
                    $ node scripts/sst-dream.mjs scan .
                  </span>
                  {'\n'}
                  <span className="text-neutral-500">
                    {' '}
                    reading sst.config.ts + packages/infra/*.ts
                  </span>
                  {'\n'}
                  <span className="text-neutral-500"> redacting secrets before parse</span>
                  {'\n'}
                  <span className="text-neutral-500"> recovered 14 resources · 9 edges</span>
                  {'\n'}
                  <span className="text-emerald-500">
                    ✓ wrote ARCHITECTURE.md + sstdream-scan.json
                  </span>
                  {'\n'}
                  <span className="text-neutral-500">
                    {' '}
                    not recognized: 1 (listed, never dropped)
                  </span>
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* The diagram you designed, reading real code */}
      <section className="border-y border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/40">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
          <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">
            The diagram you designed, reading your real code
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-neutral-600 dark:text-neutral-400">
            Most observability tools hand you a dashboard that looks nothing like how you picture
            your system. SSTDREAM already has your shape. You drew it in Design Mode, imported it
            from code, or loaded it from the gallery. Live Mode runs the same engines over your
            project on disk: validation, data-flow simulation, cost, expansion, and the security
            audit. Same picture, real source. No second mental model to learn.
          </p>
        </div>
      </section>

      {/* Available now */}
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">
                <code className="font-mono">sst-dream scan</code>
              </h2>
              <NowBadge />
            </div>
            <p className="mt-3 text-xl text-neutral-500">
              Point it at a repo. Get a straight answer.
            </p>
            <p className="mt-4 max-w-2xl leading-relaxed text-neutral-600 dark:text-neutral-400">
              This part is real and ships today as a local command. It strips secrets before the
              code reaches the parser. It reverse-parses the project. It runs the builder&apos;s
              engines over the recovered graph. Then it tells you exactly what it could and could
              not model.
            </p>
          </div>
          <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:col-span-7">
            {NOW_FEATURES.map((f) => (
              <li key={f} className="flex gap-3 text-sm text-neutral-600 dark:text-neutral-300">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-600/10 text-indigo-600 dark:text-indigo-400">
                  ✓
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Get started */}
      <section id="get-started" className="mx-auto max-w-7xl scroll-mt-8 px-6 pb-20 lg:px-10">
        <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">Run it in 60 seconds</h2>
        <p className="mt-3 max-w-2xl text-neutral-500">
          No clone. No install. No build. Copy the <code>scripts/</code> folder into your SST or
          Vercel project and run one file.
        </p>
        <div className="mt-6 overflow-hidden rounded-xl ring-1 ring-black/5 dark:ring-white/10">
          <div className="flex items-center gap-1.5 border-b border-neutral-200 bg-white px-4 py-2.5 dark:border-neutral-800 dark:bg-neutral-950">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
            <span className="ml-2 font-mono text-xs text-neutral-400">your-sst-project</span>
          </div>
          <pre className="overflow-x-auto bg-white p-4 font-mono text-[13px] leading-relaxed dark:bg-neutral-950">
            <code>{`# copy the repo's scripts/ folder into your project, then:
cd your-sst-project
node scripts/sst-dream.mjs scan .      # or:  ./scripts/sst-dream.sh scan .
# writes ARCHITECTURE.md + sstdream-scan.json here (or --out <dir>)
# no credentials, no network, nothing uploaded`}</code>
          </pre>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-neutral-500">
          Want the visual version? Open the{' '}
          <Link href="/builder" className="text-indigo-600 hover:underline dark:text-indigo-400">
            builder
          </Link>
          , click From code, and paste the <code>sstdream-scan.json</code>. It loads as an editable
          canvas. Details are in{' '}
          <a
            href="https://github.com/SoloNerds/sstdream/blob/main/docs/live-mode.md"
            className="text-indigo-600 hover:underline dark:text-indigo-400"
          >
            docs/live-mode.md
          </a>
          .
        </p>
      </section>

      {/* Security callout (the visual anchor) */}
      <section className="bg-indigo-600 text-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 py-20 lg:grid-cols-12 lg:px-10">
          <div className="lg:col-span-8">
            <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">
              It runs on your machine, so you hold the keys
            </h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-indigo-100">
              SSTDREAM is a static site on GitHub Pages. The site shows off Live Mode. It does not
              run it. The scan runs from the repo you cloned, on your own machine, never from the
              hosted URL. Your code today, and your read-only cloud credentials when the observed
              view lands, stay on your laptop. There is no SSTDREAM backend to send them to. There
              will never be a connect-your-AWS-to-sstdream.com button. Local-first is the point. You
              can read the source to confirm it.
            </p>
          </div>
        </div>
      </section>

      {/* Roadmap + why local */}
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">Where this is going</h2>
              <RoadmapBadge />
            </div>
            <p className="mt-4 max-w-2xl leading-relaxed text-neutral-600 dark:text-neutral-400">
              Plainly: this part is not built yet. The plan closes the loop. Connect read-only AWS
              or Vercel from your machine. Live Mode pulls your real signals onto the diagram you
              already drew. Which node is hot. Which edge is slow. Where the spend sits. Where the
              deployed reality has drifted from your code. It is the X-Ray view, except it is free,
              local, and pinned to your design instead of a generic service map.
            </p>
            <ul className="mt-5 space-y-2">
              {ROADMAP_FEATURES.map((f) => (
                <li key={f} className="flex gap-2 text-sm text-neutral-500">
                  <span className="mt-0.5 shrink-0 text-neutral-400">○</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">
              Why local and free beats a hosted dashboard
            </h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-neutral-600 dark:text-neutral-400">
              X-Ray, Datadog, and Cloudcraft are strong tools. They also route your telemetry and
              your bill through someone else&apos;s platform. Live Mode makes a different trade on
              purpose. It is free, open source, and runs on your machine. You do not pay per seat or
              per host to look at your own architecture. For understanding the system you designed,
              local and free wins.
            </p>
          </div>
        </div>
      </section>

      {/* Optional agent + Design Mode untouched */}
      <section className="mx-auto max-w-7xl px-6 pb-24 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 p-7 dark:border-neutral-800">
            <span className="inline-block rounded-full border border-indigo-200 px-3 py-1 text-[13px] font-medium text-indigo-600 dark:border-indigo-900/60 dark:text-indigo-400">
              Pillar 3 · optional
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight">
              An optional ops agent, on your terms
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-neutral-600 dark:text-neutral-400">
              Bring your own model. The agent is local, read-only, and grounded in your scan. Today
              it does one concrete thing. It flags deprecated SST deterministically with{' '}
              <code>agent check</code>. It reads. It does not deploy and it does not write infra.
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 p-7 dark:border-neutral-800">
            <h2 className="text-2xl font-bold tracking-tight">Design Mode is unchanged</h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-neutral-600 dark:text-neutral-400">
              Live Mode only adds. It is a second pillar on its own route. The builder, the gallery,
              From code import, and verified export all work exactly as before. The builder is still
              zero-AI, zero-network, deterministic, and credential-free. Live Mode reads your
              project. It never feeds the generator.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button asChild size="sm" className="group">
                <Link href="/builder">
                  Try Design Mode
                  <span
                    aria-hidden
                    className="ml-1 inline-block transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/gallery">Browse templates</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-7xl px-6 py-8 text-xs text-neutral-400 lg:px-10">
          SSTDREAM Live Mode · MIT · Runs on your machine. Your code and credentials never leave it.
        </div>
      </footer>
    </div>
  );
}
