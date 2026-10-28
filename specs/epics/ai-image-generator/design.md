# ai-image-generator — design

## The template

[vercel-labs/ai-sdk-image-generator](https://github.com/vercel-labs/ai-sdk-image-generator)
(Next.js 15.5 App Router, AI SDK 4's `experimental_generateImage`, shadcn/ui
on Tailwind CSS 3, Apache-2.0) is the AI SDK's image playground: one prompt,
sent to four providers at once — Replicate, Google Vertex AI, OpenAI and
Fireworks — each card with a model picker, the image, its time and a
download. A performance/quality switch picks each provider's model.
`/api/generate-images` takes `{ prompt, provider, modelId }`, draws one image
and answers it as base64; nothing is stored. Each provider needs its key in
the project's environment, and all four cards show whatever is set.

## How it maps to Cloudflare

| Vercel | Here | Why |
|---|---|---|
| Next.js hosting; the route a Vercel Function with `maxDuration: 60` | One Worker built by `@opennextjs/cloudflare` (`output: 'standalone'`), the static-assets incremental cache | Every page and route renders per request; a Worker waits on a provider without a wall-clock limit, and the template's own 55 s timeout stays |
| Four providers, each needing a key | Workers AI added first, through the Worker's own `AI` binding, needing none | A fresh site must draw before its owner holds any provider account |
| The providers' keys as project env vars | `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, `FIREWORKS_API_KEY` and Vertex AI's four `GOOGLE_*`, Orun secrets per environment, read by the build as `optionalSecretEnv`, withheld from it (`env -u`) and handed to the Worker as Worker secrets (`tooling/wire/worker-secrets.mjs`) | SaaS keys are Orun secrets; the Worker reads them per request, so no bundle needs one |
| All four cards, whatever is set | Only the providers this deployment has (`lib/providers.ts`, on the server per request) | A card with no key could only fail |
| The model id the client sends, passed through | Only the models the page offers (`lib/provider-config.ts`); any other refused with a 400 | A request's model id would otherwise run any model on the owner's account |
| Vercel Analytics | Removed | No Vercel |
| "Deploy with Vercel" button | The site's own source link | The site deploys from its own repository |

## §1 Workers AI as the default provider

Workers AI is a fifth provider, first on the page. Its models are four of
Workers AI's text-to-image models — FLUX.1 [schnell] (performance), Stable
Diffusion XL (quality), SDXL Lightning and DreamShaper 8 LCM — reached over
the Worker's `AI` binding. The binding is the account's own: no key, no
connection beyond the Cloudflare one the bootstrap already has, billed to the
account by the neuron after Workers Free's daily allowance.

## §2 The adapter

`lib/workers-ai-image.ts` is an AI SDK 4 image model (`ImageModelV1`) over
the binding: FLUX.1 [schnell] is asked `{ prompt, steps: 4 }` and answers
`{ image: base64 }`; the Stable Diffusion family is asked `{ prompt, width,
height, seed }` and answers a PNG stream. What a model cannot take (FLUX's
size and seed, any aspect ratio) is a warning, not an input. Written here
because `workers-ai-provider`'s last release for AI SDK 4 (0.7.5) reads every
image answer as a stream, so it cannot read FLUX's (risk IG-C); moving to
AI SDK 6 for the newer provider would move every one of the template's
provider packages off upstream's versions.

## §3 The providers a deployment has

`providersFor(hasAiBinding, env)` is the one decision: Workers AI when the
binding is there, each other provider when all of its keys are (Vertex AI
needs its four). The page renders only those cards; `/api/health` names them;
`imageModel()` refuses any provider not in the list and any model not in that
provider's `models`, before any call. A deploy pushes the keys that exist and
deletes none (risk IG-E).

## §4 Images stay ephemeral

As upstream: the route answers base64 and the browser holds the image. The
brief allowed an optional R2 bucket; a bucket nothing reads would be
provisioned and billed for nothing, so there is none. A feature that keeps
images (a gallery, sharing by link) is where a bucket comes in.

## §5 Vertex AI

Kept, optional. Vertex AI needs a Google Cloud service account (its email
and private key) and a project and region — four secrets, all or none. It is
a SaaS key the owner adds, not a cloud the platform provisions, and the
template is a four-provider comparison. `@ai-sdk/google-vertex/edge` signs
with WebCrypto, so it runs in the Worker.

## The repository and the build

portfolio-starter-kit's shape by way of clerk-auth-starter: `apps/web` (the
site), `tests/web` (vitest), `tooling/*`, no `infra/` and no `packages/` — a
binding is not a Terraform root. Two phases: `01-product` (the repository,
then the whole site in one landing, deployed to stage and prod and
smoke-tested) and `03-docs` (the record). The smoke is `/` rendered to its
end and `/api/health` ok — the Worker has its binding.

## Rejected

- **`workers-ai-provider` 0.7.5 for the images**: it cannot read FLUX's
  base64 answer; only the Stable Diffusion family would draw.
- **AI SDK 6 with `workers-ai-provider` 3.x**: it moves all four of the
  template's provider packages two majors past upstream for one adapter.
- **An R2 bucket for the images**: provisioned and never read (§4).
- **Dropping Vertex AI**: it is the template's; four optional secrets cost
  nothing until set (§5).
