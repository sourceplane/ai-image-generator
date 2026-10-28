import type { NextConfig } from "next";
import path from "node:path";

// Upstream's config was empty. What the Workers build adds:
//
//   output: "standalone" and the trace root at the workspace root — required
//   by @opennextjs/cloudflare, which bundles `.next/standalone/**` into the
//   Worker, with the app's dependencies resolved from the monorepo's
//   node_modules;
//   turbopack.root — the same root for `next dev` and `next build`.
//
// The providers' keys are NOT build inputs: the Worker reads them at request
// time (lib/providers.ts) as Worker secrets the deploy pushes
// (tooling/wire/worker-secrets.mjs), so no bundle — nor the bundler's cache —
// ever holds one.
const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
