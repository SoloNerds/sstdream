import type { NextConfig } from 'next';

// SSTDREAM is a fully client-side app — it forges SST/Vercel files in the
// browser and never deploys anything — so it can be served as a static export
// (e.g. GitHub Pages) with no server runtime to host.
//
// basePath/assetPrefix are applied ONLY when building for a project Pages site
// served under https://<user>.github.io/<repo>/. The Pages workflow sets
// PAGES_BASE_PATH=/<repo>; local `yarn dev` and a plain `yarn build` keep the
// app at the root so nothing else has to change.
const basePath = process.env.PAGES_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
