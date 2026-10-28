# ai-image-generator — where this repository stands

The entry page for anyone (or any agent) picking this repository up. It is
this repository's own state and does not ship to a site built from it; the
pages that do are [operations.md](operations.md) and
[deployment.md](deployment.md), with the site's `AGENTS.md`.

## What it is

Vercel's AI SDK Image Generator (vercel-labs/ai-sdk-image-generator) — one
prompt, one image per provider, side by side, with a model picker per
provider and a performance/quality switch — built by OpenNext into one
Cloudflare Worker with Static Assets, packaged as an Orun baseline: `orun
new --blueprint repo-blueprint.yaml` builds a new site in its own repository
and takes it to live on stage and prod in one landing (`01-product`), then
records what went live (`03-docs`). A site is born drawing with Workers AI
through its own `AI` binding, with no key; the template's four providers
appear as their owner stores their keys.

## Release

| | |
|---|---|
| Latest tag | `baseline-v1` — IG0 to IG2: the repository, the image generator on Workers, and the baseline (blueprint, phases, tests) |
| Proven live | Not yet: proven offline in Baseline CI only (risk IG-A) |

## Where to read

| Question | Page |
|---|---|
| What shipped, and every departure from upstream | `specs/epics/ai-image-generator/IMPLEMENTATION-STATUS.md` |
| Why it is built this way | [decisions.md](decisions.md), then `specs/epics/ai-image-generator/design.md` |
| What could still go wrong | [open-risks.md](open-risks.md), then `specs/epics/ai-image-generator/risks-and-open-questions.md` |
| How to instantiate it | `BOOTSTRAP.md`, `docs/phases/` |
| What the components are | `apps/web/docs/`, `tests/web/docs/` (generated; `python3 tooling/catalog/gen-component-docs.py`) |

## Next

1. Bootstrap one site from `baseline-v1` from the console and record its
   timings against the 5-minute estimate (closes IG-A); then the registry
   row goes public with the measured minutes.
2. On that site, draw once with each Workers AI model through the real
   binding (closes IG-B).
