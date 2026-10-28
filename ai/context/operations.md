# ai-image-generator — operating contract (for humans and agents)

This is the standing guide to how this site is deployed and operated.
Instance facts (live URLs, workspace, the secrets it uses) live in
[deployment.md](deployment.md), rendered from probed reality by the
bootstrap's `03-docs` phase; this file is the contract that stays true
between deployments. It is written to give an agent with repository read
access enough context to reason about and operate the site without any
other source.

## What this system is

The AI SDK image generator on Cloudflare, expressed as an Orun
component-native desired-state repo. One prompt, one image per provider,
side by side. The image models are services the site calls, not components
here: Workers AI on the account the Worker deploys into, and any provider
whose key the owner stored.

- **`apps/web`** — the site: Next.js built by `@opennextjs/cloudflare` into
  one Worker plus Static Assets. `/` renders the playground with the
  providers this deployment has (decided on the server per request);
  `/api/generate-images` draws one image with one provider and model and
  answers it as base64; `/api/health` is what the deploy's smoke reads.
  Nothing is stored: an image lives in the visitor's browser until they
  download it. There is no database and no bucket.
- **The providers** — `apps/web/lib/providers.ts`. Workers AI always, through
  the Worker's `AI` binding (`wrangler.jsonc`); OpenAI, Replicate, Fireworks
  and Vertex AI each once its key is a Worker secret. The page lists only
  those, and the route refuses any other provider and any model the page
  does not offer — so no request runs an arbitrary model on the account.
- **Workers AI's image models** — `apps/web/lib/workers-ai-image.ts`, an AI
  SDK image model over the binding: FLUX.1 [schnell] asked `{ prompt, steps }`
  (it answers base64), the Stable Diffusion family asked `{ prompt, width,
  height, seed }` (it answers a PNG stream).
- **`tests/web`** — the site's identity, the Workers AI adapter, which
  providers a deployment has and the Worker-secret push (vitest), verified
  on the `dev` rung.
- **`tooling/*`** — shared TypeScript and ESLint configuration, the
  deploy-time wrangler renderer, and `wire/worker-secrets.mjs`, which hands
  the providers' keys to the Worker.

Environments: **`stage`** and **`prod`** are deployed; **`dev` is
verify-only by design** — lanes build and test, nothing deploys.

## Identity and tenancy

Every remote operation runs against ONE Orun workspace, declared in
`intent.yaml` under `execution.state.workspace` — committed, enforced, and
what CI uses. Do not remove it; headless credentials depend on it. If it
reads `ws_SET_ME`, the bootstrap had no workspace to write: set the real one
before anything else.

## How deployment works

1. Merge (or push) to `main`.
2. CI (`.github/workflows/ci.yml`) runs `orun plan --changed` — only
   components whose files changed are planned — then runs each planned lane
   with `orun run --remote-state`, authenticated by GitHub OIDC (the
   exchange resolves this repository's linked workspace server-side).
3. `apps/web` builds once per environment, with `NEXT_PUBLIC_SITE_URL` set to
   that environment's `SITE_URL` (intent.yaml) or its workers.dev URL and
   with NO provider key in its environment; the deploy lane then sets the
   keys the environment has stored on `ai-image-generator-web-<env>` as
   Worker secrets (`wrangler secret bulk`), `wrangler deploy` ships it with
   its `AI` binding, and a smoke test fetches `/` (rendered to its end) and
   `/api/health` (ok: the Worker can draw with Workers AI).
4. `prod` deploys after `stage` has converged on the same commit
   (`environments.prod.promotion` in intent.yaml).
5. **The convergence run is the deployment.** A green run means every
   planned lane applied. Failed lanes are retried with
   `gh run rerun --failed`, which resumes the same execution.

Caveats that matter:

- A push that touches no component files plans zero lanes — that run is
  green and deployed nothing. Never treat "latest run green" as "site
  converged"; probe the URLs instead.
- A change to `intent.yaml`'s `environments` (a new `SITE_URL`, say) maps to
  no component and redeploys nothing on its own. Land it with a change under
  `apps/web`.
- Storing or rotating a provider's key deploys nothing either: the deploy is
  what hands keys to the Worker. Redeploy by hand after setting one. A
  deploy pushes the keys that exist and DELETES NONE: to take a provider
  away, `wrangler secret delete` its key on the Worker too.
- The site is open, as the template is: anyone who reaches it draws images
  billed to the account (Workers AI, by the neuron) or to the owner's
  provider accounts. Cloudflare Access in front of it, or sign-in, before
  sharing it widely.

## Secrets model

- **Brokered provider secrets**: `CLOUDFLARE_API_TOKEN` (Workers deploy
  scope) and `CLOUDFLARE_ACCOUNT_ID` — pointers minted per run from the
  workspace's Cloudflare connection. No long-lived values at rest; nothing
  to rotate by hand. Workers AI needs no secret: it is a binding.
- **The owner's provider keys**, per environment, OPTIONAL:
  `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, `FIREWORKS_API_KEY`, and Vertex
  AI's four (`GOOGLE_VERTEX_PROJECT`, `GOOGLE_VERTEX_LOCATION`,
  `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`). The build runs without them
  (`env -u`), so no bundle or build cache holds one; the deploy lane hands
  those that are set to the Worker as Worker secrets, the values over stdin.
  `apps/web/component.yaml` reads them as `optionalSecretEnv`: a key nobody
  stored is skipped, and that provider stays off. Rotate one at its
  provider, store the new value (`orun secrets set … --env <env>`), redeploy.
- Inspect by NAME only: `orun secrets list --org <ws> --project` and
  `--env stage|prod`. No tooling in this repository prints a secret value,
  and no document in `ai/context/` may contain one. `/api/health` names the
  providers the Worker has, never a key.

## Verifying the system

```bash
# the site on each environment (also recorded, probed, in deployment.md)
curl -s -o /dev/null -w '%{http_code}\n' https://ai-image-generator-web-stage.your-workers-subdomain.workers.dev/
curl -s https://ai-image-generator-web-prod.your-workers-subdomain.workers.dev/api/health   # {"ok":true,"providers":["workersai",…]}

# workspace readiness (integrations + repository link)
orun integrations list --org <ws> --json && orun cloud check --org <ws>
```

## Common operations

| task | how |
|---|---|
| add a provider | `orun secrets set OPENAI_API_KEY --env <env>` (or `REPLICATE_API_TOKEN`, `FIREWORKS_API_KEY`, Vertex's four), deploy by hand (README, "Add a provider") |
| take a provider away | `orun secrets delete <KEY> --env <env>` and `pnpm exec wrangler secret delete <KEY> --name ai-image-generator-web-<env>` from `apps/web` |
| offer another model | add its id to the provider's `models` in `apps/web/lib/provider-config.ts` (a Workers AI one also in `WORKERS_AI_IMAGE_MODELS`, `lib/workers-ai-image.ts`, with its input shape); merge |
| change the site's code | `apps/web/app/`, `apps/web/components/`, its name `apps/web/app/site.ts`; merge |
| deploy a change | merge to `main`; watch the run; failed lanes → `gh run rerun --failed` |
| deploy by hand | Orunbase's Deploy button, or `gh workflow run ci.yml --ref main -f environment=<env> [-f component=<a,b>]` — the named components (blank: every one) run in that environment as a merge runs them; started off `main` it is refused |
| redeploy without a change | edit the last line of `apps/web/component.yaml` (`# orun: redeploy <reason> <stamp>`) and merge — it is a deploy trigger, nothing reads it |
| serve a custom domain | attach it to the Worker in Cloudflare, set `SITE_URL` for the environment in `intent.yaml`, and replace the placeholder `ai-image-generator.example.com` in `intent.yaml`'s `BASE_DOMAIN` (dev, stage and prod) with it (README, "Custom domain") |
| add a runtime secret | `orun secrets set <KEY> --org <ws> --env <env>`, then an `optionalSecretEnv` entry in `apps/web/component.yaml`, a `-u <KEY>` and a `--secret <KEY>` on its buildCommand |
| headless credentials | `ORUN_TOKEN` (workspace-scoped) + `GITHUB_TOKEN` |

The deployment record is the bootstrap's `03-docs` phase. Re-running it (the
Orun console's Retry on that phase, or `orun new … --phase 03-docs`)
re-probes the URLs and re-renders [deployment.md](deployment.md); it is
idempotent.

## Evolution

Images are not kept: the route answers each one as base64 and the browser
holds it. A feature that keeps them (a gallery, sharing by link) adds an R2
bucket — a Terraform root under `infra/` that publishes its name as wiring,
as the platform's blob baseline does — and a feature that limits who may
draw adds sign-in or Cloudflare Access. Structural changes follow the same
contract that deployed the site: add a component under `apps/`, `infra/` or
`packages/` with a `component.yaml`, land it as a pull request, and the
convergence run applies it.
