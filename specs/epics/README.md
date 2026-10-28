# Epics

Orun-style work programs. Each epic is a folder carrying `epic.yaml` (the
declaration the platform reads: slug, key prefix, milestones with exit
criteria and task keys) beside its doc set. The pull request that adds the
folder is the adoption; the merge creates the epic in the workspace.

| Epic | Cluster | Status | What it is |
|------|---------|--------|------------|
| [`ai-image-generator/`](./ai-image-generator/) | **IG** | In progress (IG0) | Vercel's AI SDK Image Generator on Cloudflare Workers + Static Assets through OpenNext, drawing with Workers AI through the Worker's own binding and with the template's providers once their keys are Orun secrets, and an Orun baseline that instantiates it (IG2) |

As-built ≠ intent: what shipped lives in each epic's `IMPLEMENTATION-STATUS.md`.
