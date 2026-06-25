import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TEMPLATES } from '@/lib/templates/registry';
import { getTarget } from '@/lib/targets/registry';

const STATS = [
  { value: '2', label: 'deploy lanes (AWS/SST + Vercel)' },
  { value: String(TEMPLATES.length), label: 'ready-made templates' },
  {
    value: String(
      Object.keys(getTarget('aws-sst-v4').catalog).length +
        Object.keys(getTarget('vercel').catalog).length,
    ),
    label: 'resource kinds',
  },
  { value: '0', label: 'AI calls · 0 credentials stored' },
];

const WHY = [
  {
    title: 'Deterministic, not hallucinated',
    body: 'No AI guessing your infra. Every generated line is verified against the live SST/Vercel docs and recorded with provenance — and the whole export is type-checked in CI.',
  },
  {
    title: 'Simulate before you deploy',
    body: 'A static data-flow trace proves every resource actually talks to every other — does the app reach the bucket, the queue, the table? — in the browser, with no deploy.',
  },
  {
    title: 'A real, runnable project',
    body: 'Export a complete Next.js project: config, server actions, routes, workers, env, README + AGENTS.md. Drop it in, run `sst deploy` / `vercel`. Not a diagram — code.',
  },
  {
    title: 'Runs entirely in your browser',
    body: 'It forges files locally and never touches your cloud credentials. Designs are shareable links; nothing is uploaded.',
  },
];

const STEPS: [string, string][] = [
  ['Draw', 'Drag resources onto a canvas and connect them. Pick AWS/SST or Vercel up front.'],
  [
    'Simulate & check',
    'Watch the wiring light up green, review the cost estimate and best-practice tips.',
  ],
  ['Export & ship', 'Get a verified, type-checked, deployable project. Run it yourself.'],
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-lg font-bold">SSTDREAM</span>
        <nav className="flex items-center gap-5 text-sm">
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
          <Button asChild size="sm">
            <Link href="/builder">Open the builder</Link>
          </Button>
        </nav>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-16 pt-16 text-center sm:pt-24">
        <p className="mb-4 inline-block rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-500 dark:border-neutral-700">
          Visual SST v4 / Vercel architecture builder · no AI, no credentials
        </p>
        <h1 className="text-balance text-4xl font-bold leading-tight sm:text-6xl">
          Draw your app. Simulate it.
          <br />
          Export a deployable project.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-neutral-500">
          Design a full-stack app on a canvas, prove the wiring works, and export clean, current,
          <strong className="text-neutral-700 dark:text-neutral-300"> verified</strong> SST v4 or
          Vercel files you deploy yourself. Every line is type-checked — zero AI, zero hallucinated
          APIs.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="h-11 px-6 text-base">
            <Link href="/builder">Open the builder →</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 px-6 text-base">
            <Link href="/gallery">Browse {TEMPLATES.length} templates</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 sm:grid-cols-4 dark:border-neutral-800 dark:bg-neutral-800">
        {STATS.map((s) => (
          <div key={s.label} className="bg-white px-4 py-6 text-center dark:bg-neutral-950">
            <div className="text-3xl font-bold">{s.value}</div>
            <div className="mt-1 text-xs text-neutral-500">{s.label}</div>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="mb-2 text-center text-2xl font-bold">Why it&apos;s different</h2>
        <p className="mb-10 text-center text-neutral-500">
          A template builder that emits wrong IaC is worthless. Correctness is the product.
        </p>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {WHY.map((w) => (
            <div
              key={w.title}
              className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800"
            >
              <h3 className="font-semibold">{w.title}</h3>
              <p className="mt-2 text-sm text-neutral-500">{w.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {STEPS.map(([title, body], i) => (
            <div key={title}>
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                {i + 1}
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-neutral-500">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24 text-center">
        <h2 className="text-2xl font-bold">Open source. Built to be extended.</h2>
        <p className="mx-auto mt-3 max-w-xl text-neutral-500">
          Two independent lanes, one shell — adding a deploy target or a template is a small,
          well-documented PR. Bring your platform.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="/builder">Start building</Link>
          </Button>
          <Button asChild variant="outline">
            <a href="https://github.com/SoloNerds/sstdream">Star on GitHub</a>
          </Button>
        </div>
      </section>

      <footer className="border-t border-neutral-200 py-8 text-center text-xs text-neutral-400 dark:border-neutral-800">
        SSTDREAM · MIT · the website never deploys anything — it forges files you run yourself.
      </footer>
    </div>
  );
}
