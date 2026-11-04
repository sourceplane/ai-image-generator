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
  // Dev server only (`next build` ignores it): orun.work's live Preview tab
  // loads `next dev` from the preview's own host, and Next.js refuses the
  // hot reload and other /_next/* dev requests from an origin it is not told
  // about. These are the preview's hosts, prod's and stage's.
  allowedDevOrigins: ["*.orun-preview.app", "preview-gateway-stage.oruncloud.workers.dev"],
  experimental: {
    // Dev server only: behind orun.work's live Preview the browser's Origin
    // is the preview's host while `next dev` sees a local Host, and Next.js
    // refuses a Server Action from an origin it is not told about. `next
    // build` runs with NODE_ENV=production, so production keeps its
    // same-origin check.
    ...(process.env.NODE_ENV === "development"
      ? { serverActions: { allowedOrigins: ["*.orun-preview.app", "preview-gateway-stage.oruncloud.workers.dev"] } }
      : {}),
  },
};

export default nextConfig;
