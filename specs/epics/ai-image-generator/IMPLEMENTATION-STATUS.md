# ai-image-generator — implementation status

| Milestone | State | Landed |
|---|---|---|
| IG0 — the spec | ✅ | the repository's first commit |
| IG1 — the image generator on Workers | ✅ | IG-2 |
| IG2 — a baseline | planned | IG-3 |

## Departures from the upstream template

Everything not listed here is the template as it is upstream at `5130ba8`.

| # | What | Why |
|---|---|---|
| 1 | The app lives in `apps/web` of a pnpm workspace (the root lockfile, pnpm 10.12.1); npm's and Bun's lockfiles are not carried; the AI SDK at upstream's locked versions (`ai` 4.3.19, `@ai-sdk/openai` 1.3.24, `@ai-sdk/fireworks` 0.1.18, `@ai-sdk/replicate` 0.1.16, `@ai-sdk/google-vertex` 2.2.27) | One lockfile for the workspace |
| 2 | Next 16.3.8 and `eslint-config-next` 16.3.8, not 15.5.15; React 19.3.1 within upstream's `^19.2.2` | `@opennextjs/cloudflare` 1.20.11 refuses Next 15.5 at build (risk IG-F) |
| 3 | `eslint.config.mjs` in eslint-config-next 16's flat form (upstream's `.eslintrc.json` and `next lint`), `react-hooks/set-state-in-effect` and `react-hooks/refs` off by name; `typecheck` is `next typegen && tsc --noEmit`, `lint` is `eslint .` | Next 16 removed `next lint`; the React Compiler's rules postdate the template's hooks |
| 4 | Workers AI added as the first provider: `lib/workers-ai-image.ts` (an AI SDK image model over the binding), four models in `lib/provider-config.ts` (FLUX.1 [schnell] for performance, SDXL for quality, SDXL Lightning, DreamShaper 8 LCM), its mark in `lib/logos.tsx`, its docs link in `ModelSelect` | A fresh site draws with no key (design §1–§2) |
| 5 | `lib/providers.ts`: the page shows, and the route allows, only the providers whose keys are set (Workers AI when the binding is), and only the models the page offers; a refused request is a 400 before any call | Upstream showed all four and failed a request with no key, and passed any model id to the provider (design §3) |
| 6 | The route's provider table moved to `lib/providers.ts`; its `dimensionFormat` per provider stays in the route, with Workers AI's (`size`) | One place makes a provider's model |
| 7 | `ImagePlayground` takes the server's provider list; `page.tsx` is async and passes it | The list is decided per request on the server |
| 8 | `app/site.ts` (`SITE_NAME`, `SOURCE_URL`, `SITE_URL`); the layout's title, `metadataBase` and `og:site_name`, and the header read them (the header's "AI SDK" link and title became the site's name) | One rename seam; the origin per environment |
| 9 | Vercel Analytics removed; the "Deploy with Vercel" button is the site's source link | No Vercel; the site deploys from its own repository |
| 10 | `app/api/health/route.ts` | The deploy's smoke: the Worker has its AI binding |
| 11 | `.env.example` lists the keys as Orun secrets in a deployed environment, and says Workers AI needs `wrangler login` locally | Where each value comes from on Workers |
| 12 | `next.config.ts` (`output: 'standalone'`, the trace and Turbopack roots); `open-next.config.ts`, `wrangler.jsonc` (the `AI` binding), `cloudflare-env.d.ts`, `component.yaml`, `scripts/populate-static-assets-cache.mjs` (OpenNext's `populateCache local` would open a session to the account over the binding), `tooling/wire/worker-secrets.mjs` | The Workers build and its deploy contract |
| 13 | `vercel.json` (`maxDuration: 60`) not carried | A Worker waits on a provider without a wall-clock limit; the route's 55 s timeout stays |
| 14 | `tests/web` (vitest) | The template ships none |
| 15 | `LICENSE` ships as `apps/web/LICENSE.md` | Apache-2.0 travels with the code it covers |

## Verified

- `pnpm typecheck`, `lint`, `test` (tests/web 23) and `build` green; the
  Worker is 1.49 MiB gzipped (7.0 MiB raw) — Workers Free.
- Every Baseline CI tier passes locally on orun v2.89.0: manifest, phases,
  coverage, rebrand, retouch, bootstrap-defer, component docs, the blueprint
  read, the leak gate, placement and the end-to-end tier — the site served
  by `wrangler dev` over a Workers AI stand-in, every Workers AI model
  drawing in its own input shape, every keyed provider and unoffered model
  refused, then rebuilt with made-up keys (no key in any file of the build),
  and the smoke refusing a Worker without its binding.
- The platform's own reader accepts `blueprint.yaml`.
