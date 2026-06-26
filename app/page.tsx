import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/CopyButton';
import { TEMPLATES } from '@/lib/templates/registry';
import { getTarget } from '@/lib/targets/registry';

const KINDS = String(
  Object.keys(getTarget('aws-sst-v4').catalog).length +
    Object.keys(getTarget('vercel').catalog).length,
);

const STATS: [string, string][] = [
  ['2', 'deploy lanes. AWS/SST and Vercel.'],
  [String(TEMPLATES.length), 'templates ready to fork'],
  [KINDS, 'resource kinds across both lanes'],
  ['60s', 'to map a repo you already shipped. local, no upload.'],
];

const SCAN_COMMANDS = `curl -sO https://raw.githubusercontent.com/SoloNerds/sstdream/main/scripts/sst-dream.mjs
node sst-dream.mjs scan .`;

const WHY: [string, string][] = [
  [
    'No AI in the generator',
    'No model guesses your infra. Every line maps to a real SST or Vercel API, recorded with the doc it came from. The whole export is type-checked in CI before you see it. If the docs change, the snapshots break, and we find out before you do.',
  ],
  [
    'Simulate before you deploy',
    'A static data-flow trace runs in your browser. It answers one question. Does the app reach the bucket, the queue, the table? You see the gaps before you spend a cent. Nothing is deployed.',
  ],
  [
    'A project, not a picture',
    'Export a full Next.js app. Config, server actions, routes, workers, env, README, AGENTS.md. Drop it in and run sst deploy or vercel. There is no diagram-to-code gap, because there is no diagram. It is code.',
  ],
  [
    'Stays on your machine',
    'Files are built locally. Your cloud credentials are never read, because there is nothing to send them to. Share a design as a link if you want. Nothing is uploaded.',
  ],
];

const STEPS: [string, string][] = [
  ['Draw', 'Drag resources onto the canvas and connect them. Pick AWS/SST or Vercel first.'],
  ['Check', 'The wiring turns green when it lines up. Read the cost estimate and the warnings.'],
  ['Ship', 'Export a type-checked project and run it yourself. You deploy. We never do.'],
];

// A mini node that reads like a real builder resource (a colored kind bar + name + component).
function Node({ label, sub, accent }: { label: string; sub: string; accent: string }) {
  return (
    <div className="w-36 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <div className={`h-1 ${accent}`} />
      <div className="px-3 py-1.5">
        <div className="text-xs font-semibold leading-tight">{label}</div>
        <div className="font-mono text-[10px] text-neutral-400">{sub}</div>
      </div>
    </div>
  );
}

const Wire = () => <span className="my-1 block h-4 w-px bg-indigo-500/40" aria-hidden />;

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-neutral-200/60 bg-white/70 backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-950/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <span className="text-lg font-bold tracking-tight">SSTDREAM</span>
          <nav className="flex items-center gap-6 text-sm">
            <Link
              href="/gallery"
              className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              Gallery
            </Link>
            <Link
              href="/live"
              className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              Live Mode
              <span
                className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-indigo-600 align-top"
                aria-hidden
              />
            </Link>
            <a
              href="https://github.com/SoloNerds/sstdream"
              className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              GitHub
            </a>
            <Button asChild size="sm">
              <Link href="/builder">Open the builder</Link>
            </Button>
          </nav>
        </div>
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
              Design new infra or scan what you shipped. No AI. No credentials.
            </span>
            <h1 className="mt-5 text-5xl font-bold leading-[1.05] tracking-tight lg:text-7xl">
              Draw your app. Prove it works. Ship the code.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-600 lg:text-xl dark:text-neutral-400">
              Build a full-stack app on a canvas. Wire the pieces together. Export a real SST v4 or
              Vercel project and deploy it yourself. Every file is type-checked against the live
              docs. The generator makes zero AI calls. Nothing is hallucinated and nothing phones
              home.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild className="group h-12 px-7 text-base shadow-lg shadow-indigo-600/20">
                <Link href="/builder">
                  Open the builder
                  <span
                    aria-hidden
                    className="ml-1 inline-block transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 px-7 text-base">
                <Link href="/gallery">Browse {TEMPLATES.length} templates</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-neutral-500">
              Runs in your browser. Your cloud credentials never enter the picture.
            </p>
          </div>

          {/* Product visual: a mini builder canvas */}
          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 shadow-xl shadow-indigo-500/5 ring-1 ring-black/5 dark:border-neutral-800 dark:bg-neutral-900/60 dark:ring-white/10">
              <div className="flex items-center gap-1.5 border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
                <span className="ml-2 font-mono text-xs text-neutral-400">
                  builder · aws-sst-v4
                </span>
              </div>
              <div className="relative flex flex-col items-center px-6 py-7">
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-50 dark:opacity-100"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle, rgb(115 115 115 / 0.22) 1px, transparent 1px)',
                    backgroundSize: '16px 16px',
                  }}
                />
                <div className="relative flex flex-col items-center">
                  <Node label="Web" sub="sst.aws.Nextjs" accent="bg-indigo-500" />
                  <Wire />
                  <div className="flex items-start gap-3">
                    <Node label="Uploads" sub="sst.aws.Bucket" accent="bg-emerald-500" />
                    <Node label="Jobs" sub="sst.aws.Queue" accent="bg-amber-500" />
                    <Node label="Table" sub="sst.aws.Dynamo" accent="bg-sky-500" />
                  </div>
                  <Wire />
                  <Node label="Worker" sub="sst.aws.Function" accent="bg-violet-500" />
                  <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    wiring 5/5 connected · type-check passed
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats band (full bleed) */}
      <section className="border-y border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-neutral-200 px-6 lg:grid-cols-4 lg:divide-x lg:px-10 dark:divide-neutral-800">
          {STATS.map(([value, label]) => (
            <div key={label} className="px-2 py-8 lg:px-6">
              <div className="text-3xl font-bold tracking-tight tabular-nums lg:text-4xl">
                {value}
              </div>
              <div className="mt-1 text-sm text-neutral-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Live Mode band (full bleed, tinted) */}
      <section className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/40">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-24 lg:grid-cols-12 lg:px-10">
          <div className="lg:col-span-5">
            <span className="inline-block rounded-full border border-indigo-200 px-3 py-1 text-[13px] font-medium text-indigo-600 dark:border-indigo-900/60 dark:text-indigo-400">
              New. Live Mode.
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight lg:text-4xl">
              Already shipped it? Get the whole map in 60 seconds.
            </h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-neutral-600 dark:text-neutral-400">
              Point Live Mode at an SST or Vercel repo. It reverse-engineers the code into the same
              map the builder draws. You get every resource, the data flow, a cost estimate, and a
              plain list of what it could not read. Secrets are redacted before parsing. It never
              reads your .env files. Nothing leaves your machine.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="group h-11 px-5 text-base">
                <Link href="/live">
                  See it on a real repo
                  <span
                    aria-hidden
                    className="ml-1 inline-block transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </Link>
              </Button>
              <CopyButton
                text={SCAN_COMMANDS}
                label="Copy scan command"
                className="h-11 px-5 text-base"
              />
            </div>
            <p className="mt-4 text-sm text-neutral-500">
              Already have a <code>sstdream-scan.json</code>?{' '}
              <Link
                href="/builder"
                className="text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Open it in the builder
              </Link>
              .
            </p>
          </div>
          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-xl ring-1 ring-black/5 dark:ring-white/10">
              <div className="flex items-center gap-1.5 border-b border-neutral-200 bg-white px-4 py-2.5 dark:border-neutral-800 dark:bg-neutral-950">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
                <span className="ml-2 font-mono text-xs text-neutral-400">your-sst-project</span>
              </div>
              <pre className="overflow-x-auto bg-white p-4 font-mono text-[13px] leading-relaxed dark:bg-neutral-950">
                <code>
                  <span className="text-neutral-400">
                    # in any existing SST or Vercel repo. zero install, zero network
                  </span>
                  {'\n'}
                  <span className="text-indigo-600 dark:text-indigo-400">curl</span> -sO
                  https://raw.githubusercontent.com/SoloNerds/sstdream/main/scripts/sst-dream.mjs
                  {'\n'}
                  <span className="text-indigo-600 dark:text-indigo-400">node</span> sst-dream.mjs
                  scan .{'\n'}
                  <span className="text-neutral-400">
                    # writes ARCHITECTURE.md + sstdream-scan.json. reads your code, sends nothing
                  </span>
                </code>
              </pre>
            </div>
            <p className="mt-2 text-xs text-neutral-400">
              The static map ships today. The read-only live metrics overlay is on the roadmap.
            </p>
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
        <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">
          Built so the output is actually correct
        </h2>
        <p className="mt-3 max-w-2xl text-neutral-500">
          An infra generator that emits wrong config is worse than nothing. So correctness is the
          whole product.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map(([title, body], i) => (
            <div
              key={title}
              className="h-full rounded-xl border border-neutral-200 p-7 transition-colors hover:border-indigo-500/50 dark:border-neutral-800"
            >
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600/10 text-sm font-bold text-indigo-600 dark:text-indigo-400">
                {i + 1}
              </div>
              <h3 className="mt-4 font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-7xl px-6 pb-20 lg:px-10 lg:pb-28">
        <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">
          Three steps, then it is yours
        </h2>
        <div className="relative mt-10 grid gap-10 lg:grid-cols-3 lg:gap-12">
          <div
            aria-hidden
            className="absolute inset-x-0 top-5 hidden h-px bg-neutral-200 lg:block dark:bg-neutral-800"
          />
          {STEPS.map(([title, body], i) => (
            <div key={title} className="relative">
              <div className="relative z-10 grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 font-bold text-white shadow-lg shadow-indigo-600/20">
                {i + 1}
              </div>
              <h3 className="mt-4 font-semibold tracking-tight">{title}</h3>
              <p className="mt-1 max-w-sm text-sm leading-relaxed text-neutral-500">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA band */}
      <section className="border-y border-indigo-200 bg-indigo-50 dark:border-indigo-900/60 dark:bg-indigo-950/40">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-6 py-20 lg:grid-cols-2 lg:px-10">
          <div>
            <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">
              Open source. Easy to extend.
            </h2>
            <p className="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-300">
              Two lanes, one shell. Adding a deploy target or a template is a small PR with docs to
              follow. Bring your own platform.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-self-end">
            <Button asChild className="h-11 px-6 text-base">
              <Link href="/builder">Start building</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 px-6 text-base">
              <a href="https://github.com/SoloNerds/sstdream">Star on GitHub</a>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-7xl px-6 py-8 text-xs text-neutral-400 lg:px-10">
          SSTDREAM · MIT · The site never deploys anything. It writes files you run yourself.
        </div>
      </footer>
    </div>
  );
}
