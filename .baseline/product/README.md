# ai-image-generator

An AI image generator built on the [AI SDK](https://sdk.vercel.ai): write one
prompt and see what several image models draw from it, side by side, each
with its time — pick a model per provider, switch between faster and higher
quality, download or share what you like. A Next.js app on **Cloudflare
Workers + Static Assets** through
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare), drawing with
**Workers AI** from its first deploy, with no key of anyone else's.

Working on it with a coding agent? [AGENTS.md](AGENTS.md) says what to read
first, how a change lands and what not to touch.

## Live deployment

<!-- 03-docs:begin -->
Not recorded yet. The bootstrap's last phase writes the live URLs, the
workspace and the secrets the site uses into
[ai/context/deployment.md](ai/context/deployment.md); how the site deploys
and how to operate it is in
[ai/context/operations.md](ai/context/operations.md).
<!-- 03-docs:end -->

## The providers

**Workers AI** is always there: the Worker's own `AI` binding
(`apps/web/wrangler.jsonc`), on the Cloudflare account the site deploys
into, with four of its text-to-image models — FLUX.1 [schnell], Stable
Diffusion XL, SDXL Lightning and DreamShaper 8 LCM. It is billed to that
account by the neuron, after Workers Free's daily allowance.

The template's own four providers appear beside it, each once its key is
stored:

| Provider | Its key, per environment |
|---|---|
| OpenAI (DALL·E 2 and 3) | `OPENAI_API_KEY` |
| Replicate (FLUX, Ideogram, Recraft, Stable Diffusion 3.5…) | `REPLICATE_API_TOKEN` |
| Fireworks (FLUX, Stable Diffusion XL, Playground…) | `FIREWORKS_API_KEY` |
| Google Vertex AI (Imagen 3) | `GOOGLE_VERTEX_PROJECT`, `GOOGLE_VERTEX_LOCATION`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY` — a service account's, all four or none |

The page lists only the providers this deployment has; `/api/health` names
them (`"providers":["workersai", …]`), and the image route refuses any other
provider, and any model the page does not offer, without calling anyone.

## Add a provider

1. **Store its key**, once per deployed environment, as this repository's
   Orun secret of the name above (stage and prod can each hold their own):

   ```bash
   orun secrets set OPENAI_API_KEY --env stage   # prompts for the value
   orun secrets set OPENAI_API_KEY --env prod
   ```

   The build never sees a key: it runs without them, and the deploy hands
   the stored ones to the Worker as Worker secrets (`wrangler secret bulk`),
   so a key is in no bundle, no build cache and no log.
2. **Redeploy the site**: the deploy is what hands the key over, and storing
   one deploys nothing. Use **Deploy by hand** below, or change the stamp on
   the last line of `apps/web/component.yaml` (`# orun: redeploy …`) and
   merge. From that deploy on the provider's card is on the page.

To take a provider away, delete its Orun secret and its Worker secret
(`pnpm exec wrangler secret delete OPENAI_API_KEY --name
ai-image-generator-web-<env>` from `apps/web`): a deploy pushes the keys that
exist and deletes none.

The site is open to anyone who can reach it, as the template is: every image
anyone draws is billed to your Cloudflare account (Workers AI) or to the
provider whose key you stored. Put [Cloudflare
Access](https://developers.cloudflare.com/cloudflare-one/applications/) in
front of it, or add sign-in, before you share the URL widely.

## What is here

| Surface | Where |
|---|---|
| The site's name and source link | `apps/web/app/site.ts` |
| The page, the provider cards, the prompt | `apps/web/app/page.tsx`, `apps/web/components` |
| The providers and their models | `apps/web/lib/provider-config.ts` |
| Which providers this deployment has, and each one's image model | `apps/web/lib/providers.ts` |
| Workers AI's image models over the `AI` binding | `apps/web/lib/workers-ai-image.ts` |
| `/api/generate-images` (one provider, one image), `/api/health` (the deploy's smoke) | `apps/web/app/api` |
| The Worker-secret push | `tooling/wire/worker-secrets.mjs` |
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

```bash
pnpm --filter @app/web exec wrangler login   # once: Workers AI has no local mode
pnpm --filter @app/web dev                   # http://localhost:3000
pnpm --filter @app/web preview               # wrangler dev over the built Worker
```

Workers AI has no local simulator, so `dev` and `preview` reach your
Cloudflare account through the `AI` binding (and spend its neurons). To try
another provider locally, copy `apps/web/.env.example` to
`apps/web/.env.local` and fill in its key; `preview` reads keys from
`apps/web/.dev.vars` instead. Neither file is ever committed.

| Variable | What it does |
|---|---|
| `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, `FIREWORKS_API_KEY`, `GOOGLE_*` | A provider's key (above). Read by the Worker at request time, never by the build. |
| `NEXT_PUBLIC_SITE_URL` | The site's public origin, for the Open Graph image's absolute URL. The deploy sets it per environment (see below). Defaults to `http://localhost:3000`. |

## How it deploys

Merges to `main` converge through [Orun](https://github.com/sourceplane/orun):
`.github/workflows/ci.yml` plans the changed components and runs each lane
against the workspace in `intent.yaml`. The site deploys to `stage`, then to
`prod` once stage has converged on the same commit; `dev` only verifies. The
Worker is `ai-image-generator-web-<env>` on your account's workers.dev
subdomain, and every deploy is smoke-tested over HTTP: the page renders to
its end, and `/api/health` answers ok — the Worker has its Workers AI
binding. A pull request runs the same pipeline's verify lanes: the site
built and dry-deployed for each environment, with nothing deployed. They do
not lint or run the tests, so run `pnpm typecheck`, `pnpm lint` and
`pnpm test` before you push. (A push to `main` builds, deploys and
smoke-tests.)

The pipeline holds one credential, GitHub's own `GITHUB_TOKEN`. The
Cloudflare token and account id are brokered per run from the workspace's
Cloudflare connection, and the providers' keys are Orun secrets; nothing
provider-shaped is stored in the repository or in GitHub.

**Deploy by hand.** Orunbase's **Deploy** button on a component, or **Run
workflow** on the CI workflow in GitHub's Actions tab (on `main`), runs
`ci.yml` for the environment and components you pick, and each one deploys
exactly as a merge would deploy it. Leave the component blank to redeploy
every component in that environment, with nothing changed: after storing or
rotating a provider's key, say. A component with nothing to run in that
environment (a test suite in `prod`) is left out with a notice.

## Custom domain

The site answers on workers.dev from its first deploy. To serve it on your
own domain:

1. Add the domain to the Cloudflare account the site deploys into, and attach
   it to the Worker (dashboard → Workers & Pages →
   `ai-image-generator-web-prod` → Settings → Domains & Routes → Add →
   Custom domain). Do the same for stage with a subdomain if you want one.
2. Set the environment's public origin in `intent.yaml`, so the Open Graph
   image's URL uses it (until then it uses the workers.dev URL):

   ```yaml
   environments:
     prod:
       env:
         SITE_URL: https://ai-image-generator.example.com
   ```

   The site was born with the reserved placeholder
   `ai-image-generator.example.com` where its domain goes: that example,
   and `BASE_DOMAIN` under each environment (dev, stage and prod) in
   `intent.yaml`. Replace it with your domain in the same change.

3. Merge. The next deploy of `apps/web` builds with the new origin. (A change
   to `intent.yaml` alone deploys nothing — touch `apps/web` in the same pull
   request, or let the next change to the site carry it.)

## Credits

The site is Vercel's AI SDK Image Generator
([vercel-labs/ai-sdk-image-generator](https://github.com/vercel-labs/ai-sdk-image-generator),
Apache-2.0 — `apps/web/LICENSE.md`), with Workers AI added as the provider
that needs no key.
