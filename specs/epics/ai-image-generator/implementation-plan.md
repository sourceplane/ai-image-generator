# ai-image-generator — implementation plan

Three milestones, each one reviewed pull request (IG0 is the repository's
first commit), each green before it merges.

## IG0 — the spec (IG-1)

The repository is born: `intent.yaml` with the placeholder workspace
`ws_CHANGE_ME`, `ci.yml` (byte for byte turso-starter's, which plans nothing
until the workspace is set), the shared TypeScript and ESLint configuration,
the spec index, this doc set and the task contracts.

## IG1 — the image generator on Workers (IG-2)

- The template's `app/`, `components/`, `hooks/`, `lib/`, `public/` and
  configuration in `apps/web`; its dependencies at upstream's locked AI SDK
  versions, on Next 16.3.8, with `@opennextjs/cloudflare` and `wrangler`.
- `next.config.ts`: `output: 'standalone'`, the workspace root for the trace
  and Turbopack. `open-next.config.ts` with the static-assets incremental
  cache; `scripts/populate-static-assets-cache.mjs` (no credential at build);
  `wrangler.jsonc` with the `AI` binding.
- `lib/workers-ai-image.ts` (the adapter), `lib/providers.ts` (which
  providers, and each one's model), Workers AI in `lib/provider-config.ts`;
  the page, the playground and the route read them. `/api/health`.
- `SITE_NAME`, `SOURCE_URL` and `SITE_URL` in `app/site.ts`; the layout and
  the header read them. Vercel Analytics removed; the deploy button is the
  source link.
- `tooling/wire/worker-secrets.mjs`; `component.yaml`: the optional secret
  refs, the deploy contract (the origin per environment, the keys withheld
  from the build and pushed to the Worker) and its smoke. `tests/web`: the
  identity, the adapter, which providers, the secret push.
- The README's "How it maps to Vercel".

## IG2 — a baseline (IG-3)

clerk-auth-starter's machinery, renamed: `blueprint.yaml`,
`repo-blueprint.yaml`, `.baseline/` (identity, the product's README with "Add
a provider", its `AGENTS.md`, task contracts), `tooling/rebrand`,
`tooling/bootstrap`, `hooks/render-deployment-docs.sh` (probing `/` and
`/api/health`, naming the providers' keys), `docs/phases/`, the context
pack, `testing/` (the leak and placement gates on this tree's files, the
optional provider refs and the secret push checked in the plan; the e2e tier
building the site and serving it over a Workers AI stand-in, with no key and
with made-up keys) and `baseline.yml` / `tag.yml`.
