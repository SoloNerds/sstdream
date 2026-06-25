import Link from 'next/link';
import { TEMPLATES } from '@/lib/templates/registry';
import { getTarget } from '@/lib/targets/registry';
import { canvasToBlueprint } from '@/lib/core/blueprint/serialize';
import { encodeDesign } from '@/lib/core/blueprint/share';
import type { DeployTarget } from '@/lib/targets/types';

export const metadata = {
  title: 'Template Gallery — SSTDREAM',
  description: 'Ready-made AWS/SST and Vercel architectures. Open any one live in the builder.',
};

// Prerendered at build time: every template becomes a shareable "open in builder"
// link (the gallery is just a curated set of shared designs).
const EPOCH = '1970-01-01T00:00:00.000Z';
const LANES: { id: DeployTarget; label: string }[] = [
  { id: 'aws-sst-v4', label: 'AWS · SST v4' },
  { id: 'vercel', label: 'Vercel' },
];

function cardsFor(target: DeployTarget) {
  return TEMPLATES.filter((t) => t.target === target).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    tags: t.tags,
    count: t.snapshot.nodes.length,
    href: `/builder#d=${encodeDesign(canvasToBlueprint(t.snapshot, t.target, t.app, EPOCH))}`,
  }));
}

export default function GalleryPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <nav className="mb-10 flex items-center justify-between text-sm">
        <Link href="/" className="font-bold">
          SSTDREAM
        </Link>
        <Link href="/builder" className="text-indigo-600 hover:underline dark:text-indigo-400">
          Open the builder →
        </Link>
      </nav>

      <header className="mb-10">
        <h1 className="text-3xl font-bold">Template Gallery</h1>
        <p className="mt-2 max-w-2xl text-neutral-500">
          {TEMPLATES.length} ready-made architectures across both lanes. Open any one live in the
          builder, tweak it, simulate it, and export a verified, deployable project.
        </p>
      </header>

      {LANES.map((lane) => {
        const cards = cardsFor(lane.id);
        if (!cards.length) return null;
        return (
          <section key={lane.id} className="mb-12">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-400">
              {lane.label} · {cards.length}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((c) => (
                <Link
                  key={c.id}
                  href={c.href}
                  className="group flex flex-col gap-2 rounded-xl border border-neutral-200 p-4 transition-colors hover:border-indigo-500 dark:border-neutral-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{c.name}</span>
                    <span className="shrink-0 text-[11px] text-neutral-400">
                      {c.count} resources
                    </span>
                  </div>
                  <p className="flex-1 text-sm text-neutral-500">{c.description}</p>
                  <div className="flex flex-wrap items-center gap-1">
                    {c.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className="mt-1 text-xs font-medium text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-indigo-400">
                    Open in builder →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      <p className="mt-8 text-xs text-neutral-400">
        Want your design here? Templates are ~12 lines — see{' '}
        <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">CONTRIBUTING.md</code>.
        Lanes registered: {LANES.map((l) => getTarget(l.id).label).join(' · ')}.
      </p>
    </main>
  );
}
