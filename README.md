# ai-image-generator

Vercel's [AI SDK Image Generator](https://github.com/vercel-labs/ai-sdk-image-generator)
— one prompt, and the image each provider's model draws from it, side by
side, with a model picker per provider, a performance/quality switch and
each image's time — running on **Cloudflare Workers + Static Assets**
through [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare), and
packaged as an **Orun baseline**: one command takes a new site from nothing
to live on stage and prod, in its own repository, under its own name.

The template's code is the code. What the port adds is the Workers build,
the monorepo wrapper, a test package and the deploy contract; what it
changes is what Workers and a fresh, unattended deployment force: **Workers
AI** is a fifth provider, through the Worker's own `AI` binding, so a site
draws from its first deploy with no key of anyone else's; the template's
four providers (OpenAI, Replicate, Fireworks, Vertex AI) appear once their
keys are stored — Orun secrets the owner adds after the build, handed to the
Worker as Worker secrets and never seen by the build; the page lists, and
the image route allows, only those providers and only the models the page
offers; Vercel Analytics is gone and the "Deploy with Vercel" button is the
site's own source link. What the baseline adds is everything needed to make
a copy of it somebody else's — built the way
[cirrus-baseline](https://github.com/sourceplane/cirrus-baseline) is. See
[`specs/epics/ai-image-generator`](specs/epics/ai-image-generator/README.md)
for the design, the milestones and the as-built status, including every
departure.

## Instantiating a site

```bash
git clone --depth 1 --branch <baseline-tag> https://github.com/sourceplane/ai-image-generator
cd ai-image-generator
orun new --blueprint repo-blueprint.yaml --out ~/sites/acme-images --run-hooks --resume \
  --set reponame=acme-images --set productname="Acme Images" \
  --set githuborg=acme-inc --set subdomain=<workers-dev-subdomain>
```

Or, once the platform's registry lists it, from the Orun console (Baselines →
`ai-image-generator` → Build). Two phases — `01-product` (the repository
created, then the whole site in one pull request, deployed to stage and prod
and smoke-tested) and `03-docs` (the live deployment recorded) — each landing
one pull request in the new repository.
**[BOOTSTRAP.md](BOOTSTRAP.md)** is the operator guide;
[docs/phases/](docs/phases/README.md) has a page per phase.

The new repository receives the **site only** — the app, its tests, its CI,
its tooling, a README and an `AGENTS.md` of its own and its operating
contract — renamed throughout to the site's name, repository and Cloudflare
Worker. None of this repository's machinery ships. **The other providers are
the owner's to add afterwards** (the site's README, "Add a provider"): no
platform brokers them, so the card asks for no provider key, and the site
goes live drawing with Workers AI alone.

| What makes it a baseline | Where |
|---|---|
| The console card (inputs, secrets, programme) | `blueprint.yaml` |
| The build document (modules, phases, hooks) | `repo-blueprint.yaml` |
| This tree's identity, and the bootstrap's task contracts | `.baseline/` |
| The rename engine (product-name seam: `apps/web/app/site.ts`) | `tooling/rebrand/rebrand.mjs` |
| The bootstrap's helpers (deferrals, redeploy marker, work-tree strip) | `tooling/bootstrap/` |
| The deployment-record renderer | `hooks/render-deployment-docs.sh` |
| The site's README, agent page and context pack | `.baseline/product/README.md`, `.baseline/product/AGENTS.md`, `ai/context/` |
| The baseline's tests: contract, leak, offline bootstrap, end to end | `testing/`, `.github/workflows/baseline.yml` |
| Cutting a `baseline-vN` tag | `.github/workflows/tag.yml` |

## What is here (the site)

| Surface | Where |
|---|---|
| The site's name, source link and origin | `apps/web/app/site.ts` |
| The page, the provider cards, the prompt | `apps/web/app/page.tsx`, `apps/web/components` |
| The providers and their models | `apps/web/lib/provider-config.ts` |
| Which providers a deployment has, and each one's image model | `apps/web/lib/providers.ts` |
| Workers AI's image models over the `AI` binding | `apps/web/lib/workers-ai-image.ts` |
| `/api/generate-images`, `/api/health` (the deploy's smoke) | `apps/web/app/api` |
| The Worker-secret push (the providers' keys) | `tooling/wire/worker-secrets.mjs` |
| Workers build and deploy contract | `apps/web/next.config.ts`, `open-next.config.ts`, `wrangler.jsonc`, `component.yaml` |
| Tests | `tests/web` (vitest) |

## Getting started

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build            # next build + opennextjs-cloudflare build → apps/web/.open-next
```

The build needs no key and no Cloudflare credential. Workers AI has no local
simulator, so `pnpm --filter @app/web dev` and `preview` reach your
Cloudflare account through the `AI` binding: `pnpm --filter @app/web exec
wrangler login` once. Another provider's key goes in `apps/web/.env.local`
(`apps/web/.env.example`).

## How it maps to Vercel

| Vercel | Here |
|---|---|
| Next.js hosting, the image route a Vercel Function (`maxDuration: 60`, `vercel.json`) | One Cloudflare Worker (`.open-next/worker.js`) + Static Assets; the route runs in the Worker, which waits on a provider without a wall-clock limit (the template's own 55 s timeout kept) |
| Four providers, each needing its key in the project's env vars, all four shown whatever is set | Workers AI added as a fifth, through the Worker's own `AI` binding, needing no key; the other four Orun secrets per environment (`OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, `FIREWORKS_API_KEY`, Vertex AI's four), handed to the Worker as Worker secrets by every deploy, and shown only when set |
| Any model id the client sends, passed to the provider | Only the models the page offers; any other is refused before a call |
| Vercel Analytics | Removed |
| "Deploy with Vercel" button (clone the template) | The site's own source link; `orun new --blueprint repo-blueprint.yaml` is the clone — a new repository, branded, deployed |
| Deploy on push | Orun deploys `<repo>-web-{stage,prod}` on merge to `main` (`apps/web/component.yaml`), smoke-tested |

## CI

| Workflow | What it runs | Ships to a site |
|---|---|---|
| `ci.yml` | the Orun pipeline, and the only workflow a site carries: `orun plan --changed`, then one job per lane. A pull request runs the verify lanes (the site built and dry-deployed per environment; the tests' `quick-check` lane installs and checks the package, it does not run them), except the bootstrap's own landings (`orun/BASE-*`), where `plan` alone is the check; a merge deploys stage → prod. It plans nothing while `intent.yaml` names the placeholder workspace `ws_CHANGE_ME`, as this repository does. A manual run (Orunbase's Deploy button, or Run workflow on `main`) plans the environment and components it names under the push-to-main trigger, so they deploy as a merge deploys them | yes |
| `baseline.yml` | the baseline's own tiers: contract tests, the blueprint read by the pinned orun, the leak gate, the offline bootstrap, the site built, dry-deployed and served over a Workers AI stand-in — with no key (every Workers AI model drawing, every keyed provider refused) and with made-up keys (no key in any file of the build, the keyed providers listed) | no |
| `tag.yml` | cuts a `baseline-vN` tag (manual) | no |
