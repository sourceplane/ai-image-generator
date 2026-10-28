# ai-image-generator — for coding agents

Start here before you change this site. This page is short on purpose: the
pages it points at hold the detail, and they are kept true.

## What this is

The AI SDK image generator: one prompt, one image per provider, side by
side, built by `@opennextjs/cloudflare` into one Cloudflare Worker with
Static Assets. Orun deploys it to `stage` and `prod` on every merge to
`main`; `dev` only verifies. One deployable component (`apps/web`) and its
tests (`tests/web`); no database and no bucket — images are not kept.
Workers AI, through the Worker's own `AI` binding, is always a provider; the
template's other four (OpenAI, Replicate, Fireworks, Vertex AI) appear once
their keys are Worker secrets (`apps/web/lib/providers.ts`).

## Read first, in this order

1. [README.md](README.md) — what is where, how to run it, the live URLs.
2. [ai/context/operations.md](ai/context/operations.md) — the operating
   contract: how a merge deploys, the secrets model, common operations.
3. [ai/context/deployment.md](ai/context/deployment.md) — what is live, as
   last probed.
4. [apps/web/docs/overview.md](apps/web/docs/overview.md) — the component,
   with `architecture.md` and `runbook.md` beside it.
5. [apps/web/app/site.ts](apps/web/app/site.ts) — the site's name and the
   repository its header links to.
6. [apps/web/lib/providers.ts](apps/web/lib/providers.ts) — which providers a
   deployment has, and the one place a provider's image model is made.

## Working on it

```bash
pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm --filter @app/web dev        # http://localhost:3000
```

Workers AI has no local mode: `dev` and `preview` reach your Cloudflare
account through the `AI` binding, so `pnpm --filter @app/web exec wrangler
login` once. Another provider's key goes in `apps/web/.env.local` (from
`.env.example`). The page is `apps/web/app/page.tsx`. Every model the page
offers is listed in `apps/web/lib/provider-config.ts`, and the image route
refuses any other: keep a new model there (a Workers AI one also in
`lib/workers-ai-image.ts`, with its input shape), never pass a request's
model id through unchecked — it would run on the owner's account.

## How a change lands

- The repository is desired state. `intent.yaml` declares the environments
  and the workspace; `apps/web/component.yaml` declares how the site is
  built, deployed and smoke-tested.
- `orun plan --changed` shows which components and environments a change
  touches. CI runs the same plan on every pull request.
- One task, one pull request to `main`. On the pull request `ci.yml`'s
  verify lanes run (the site built and dry-deployed per environment); they
  do not lint or run the tests, so run `pnpm typecheck && pnpm lint && pnpm
  test` before you push. The merge's `ci.yml` run deploys stage and prod and
  smoke-tests each. That run is the deployment: retry a red lane with
  `gh run rerun --failed`.
- With Orun's work plane: `orun task create --brief "…"` issues a task key,
  `orun pr open --task <KEY>` opens its pull request on `orun/<KEY>-<slug>`,
  and `orun pr land` merges it once its checks pass. Leave the `BASE` prefix
  to the bootstrap: CI checks `orun/BASE-…` branches with `plan` alone.
- A change to `intent.yaml` alone (a `SITE_URL`, say) deploys nothing;
  carry it with a change under `apps/web`.

## Do not touch

- `execution.state.workspace` in `intent.yaml`: every remote operation, and
  CI's OIDC exchange, claims that workspace.
- `ai/context/deployment.md`, and the README between `<!-- 03-docs:begin -->`
  and `<!-- 03-docs:end -->`: rendered from probed URLs, never by hand.
- `.rebrand/values.json`: the identity the site was created with, which the
  deployment record is rendered from.
- Secrets. `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are brokered
  per run from the workspace's Cloudflare connection; the providers' keys
  (`OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, `FIREWORKS_API_KEY`, Vertex AI's
  four `GOOGLE_*`) are the owner's Orun secrets per environment. Never put a
  value in the repository or in GitHub, and never inline a key into a bundle
  (no `NEXT_PUBLIC_` name, no `next.config.ts` `env` entry): the deploy
  hands them to the Worker as Worker secrets. List them by name
  (operations.md).
- `ci.yml` stays the only workflow that runs on a push to `main`.
- `pnpm-lock.yaml` changes through `pnpm install`, never by hand: CI
  installs with `--frozen-lockfile`.
