import type { NextConfig } from 'next';

// SSTDREAM is a fully client-side app — it forges SST/Vercel files in the
// browser and never deploys anything — so it can be served as a static export
// (e.g. GitHub Pages) with no server runtime to host.
//
// basePath/assetPrefix are applied ONLY when serving under a sub-path (a public
// project Pages site at https://<user>.github.io/<repo>/). The Pages workflow
// passes the base path GitHub actually reports — which is EMPTY for a private
// repo served at a root *.pages.github.io subdomain. "/" or a trailing slash is
// normalized to root. Local `yarn dev` / plain `yarn build` keep the app at root.
const rawBasePath = process.env.PAGES_BASE_PATH ?? '';
const basePath = rawBasePath === '/' ? '' : rawBasePath.replace(/\/$/, '');

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
