import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Guard: the deployed site is served under a basePath (a GitHub Pages project site at
// /<repo>/). Next.js `<Link>` injects the basePath automatically; a RAW `<a href="/...">`
// does NOT — so it 404s in production. (This shipped once: a raw <a href="/gallery"> in
// the mobile advisory broke the gallery on the public deploy.) Internal navigation must
// use next/link. External (http(s)://, mailto:, //) and same-page (#) anchors are fine.

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('no basePath-breaking raw internal anchors', () => {
  it('every internal navigation uses next/link, never a raw <a href="/...">', () => {
    const root = process.cwd();
    const files = ['app', 'components']
      .flatMap((d) => walk(join(root, d)))
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));

    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      // <a ...> (possibly multi-line) whose href is an internal path ("/x", not "//").
      const matches = src.match(/<a\b[^>]*href=["']\/[^/][^"']*["']/g);
      if (matches) offenders.push(`${f.slice(root.length)} → ${matches.join(' ; ')}`);
    }
    expect(
      offenders,
      'use <Link> for internal nav (raw <a href="/..."> drops the basePath)',
    ).toEqual([]);
  });
});
