# ai-image-generator — Vercel's AI SDK Image Generator on Cloudflare Workers

**Vercel's AI SDK Image Generator built by OpenNext into one Cloudflare
Worker, deployed by Orun to stage and prod on every merge — a site that
draws with Workers AI through its own binding from its first deploy, and
with the template's providers once its owner stores their keys — and the
baseline that makes a copy of it somebody else's in one landing.**

| | |
|---|---|
| Status | In progress — IG1 on main: the site runs on Workers |
| Upstream | [vercel-labs/ai-sdk-image-generator](https://github.com/vercel-labs/ai-sdk-image-generator), at `5130ba8` (2026-04-25), Apache-2.0 |
| Reference | [clerk-auth-starter](https://github.com/sourceplane/clerk-auth-starter) — the same portfolio-starter-kit scaffolding, tests and bootstrap, and SaaS keys handed to the Worker by the deploy; [ai-chatbot](https://github.com/sourceplane/ai-chatbot) — Workers AI as the keyless default; [nl-postgres](https://github.com/sourceplane/nl-postgres) — a Workers AI stand-in for `wrangler dev` |
| Key | `IG` |

## Read in this order

1. [design.md](design.md) — the template, how each Vercel piece maps to
   Cloudflare, Workers AI as the default provider, the repository and the
   build, and the alternatives rejected.
2. [implementation-plan.md](implementation-plan.md) — the milestones and
   what each one lands.
3. [risks-and-open-questions.md](risks-and-open-questions.md) — what is not
   proven, and what was accepted.
4. [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md) — what shipped, and
   every departure from the upstream template.

## Milestones

| Milestone | What it lands | Task |
|---|---|---|
| IG0 — the spec | the repository, its intent, CI, tooling and spec index; this doc set | IG-1 |
| IG1 — the image generator on Workers | the template in `apps/web`, built by OpenNext into one Worker; Workers AI's image models over the binding; the providers a deployment has; the Worker-secret push; `tests/web` | IG-2 |
| IG2 — a baseline | the console card, the build document, the context pack and the baseline's tests | IG-3 |
