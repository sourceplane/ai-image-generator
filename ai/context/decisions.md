# ai-image-generator — decisions

The choices that shape this repository, one line each, with where the full
reasoning lives. Superseded decisions stay listed, marked, so the history
reads in order.

| # | Decision | Why | Source |
|---|---|---|---|
| 1 | Next.js on Workers + Static Assets through `@opennextjs/cloudflare`, with the static-assets incremental cache | Every page and route renders per request; the only pre-rendered output is Next's own, and the cache serves it with no binding | `specs/epics/ai-image-generator/design.md` |
| 2 | Next 16.3.8, not the template's 15.5.15; the AI SDK at upstream's locked 4.x | `@opennextjs/cloudflare` 1.20.11 refuses Next 15.5 at build; AI SDK 4 keeps every provider package at upstream's version | IMPLEMENTATION-STATUS (departures) |
| 3 | Workers AI is the default provider, through the Worker's own `AI` binding | A fresh site must draw with no key of anyone else's; the account it deploys into is the provider | `apps/web/lib/workers-ai-image.ts` |
| 4 | Workers AI's image models through an adapter written here, not `workers-ai-provider` | That package's last AI SDK 4 release reads every image answer as a stream; FLUX.1 [schnell] answers base64 | risk IG-C |
| 5 | The template's providers appear only when their keys are set; the page lists, and the route allows, nothing else | Upstream showed all four and failed a request with no key; a model id from a request runs on the owner's account, so only listed models run | `apps/web/lib/providers.ts` |
| 6 | The keys are Orun secrets per environment, read as `optionalSecretEnv`, withheld from the build (`env -u`) and handed to the Worker as Worker secrets by the deploy lane | SaaS keys are Orun secrets; no bundle or build cache may hold one | `apps/web/component.yaml`, `tooling/wire/worker-secrets.mjs` |
| 7 | Vertex AI kept, optional, with its four settings | It is the template's; a Google Cloud service account is a SaaS key the owner adds, not a cloud the platform provisions | IMPLEMENTATION-STATUS (departures) |
| 8 | Images stay ephemeral, as upstream: no R2 bucket | The template keeps nothing; a bucket would be provisioned, billed and never read | design §4 |
| 9 | `/api/health` (the AI binding is there) and a full-page render are the deploy's smoke | A Worker that lost its binding cannot draw; the smoke catches it at deploy, not at a visitor | `apps/web/component.yaml` |
| 10 | The template's "Deploy with Vercel" button is the site's own source link; Vercel Analytics removed | The site deploys from its own repository | IMPLEMENTATION-STATUS (departures) |
| 11 | The site's name is one seam, `SITE_NAME` in `apps/web/app/site.ts`, for the title, the header and the Open Graph card; `metadataBase` is `NEXT_PUBLIC_SITE_URL` | The rename rewrites one literal | `apps/web/app/site.ts` |
| 12 | No custom-domain phase: a domain is the owner's step, and `SITE_URL` points the build at it | The brokered `workers-deploy` token has no zone scope | README, "Custom domain" |
| 13 | One landing (`01-product`) then the record (`03-docs`), each checked in the build box | A landing has a fixed cost; the convergence on main builds, deploys and smoke-tests the site for real | `docs/phases/README.md` |
| 14 | `ci.yml` plans nothing while `intent.yaml` names `ws_CHANGE_ME`; no Checks workflow | A bootstrap cannot set a repository variable; a push to main must start `ci.yml` alone | `.github/workflows/ci.yml` |
| 15 | stack-tectonic 0.19.0, not 0.20.0 | 0.20.0's lane-shared install links `node_modules` out of the job's tree | portfolio-starter-kit's risk PK-J |
| 16 | Component docs are generated from the manifests and checked in CI; orun is pinned only where it runs | A hand-written copy drifts silently | `tooling/catalog/gen-component-docs.py` |
| 17 | `subdomain` is read from the Cloudflare connection, never asked; the console asks for no domain and no provider key | The first two belong to the account or the owner; no platform connection can mint a provider's key | `blueprint.yaml` |
