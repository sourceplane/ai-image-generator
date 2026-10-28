# web — architecture

Built by the turbo pipeline from `apps/web` and deployed with wrangler.

|                     |                                                 |
| ------------------- | ----------------------------------------------- |
| Worker config       | `apps/web/wrangler.jsonc`                       |
| Entry               | `.open-next/worker.js`                          |
| Compatibility date  | `2026-10-01`                                    |
| Compatibility flags | `nodejs_compat`, `global_fetch_strictly_public` |

## Bindings

| Binding  | Kind          | Source                                  |
| -------- | ------------- | --------------------------------------- |
| `AI`     | Workers AI    | account-level; no resource to provision |
| `ASSETS` | Static assets | `.open-next/assets`                     |

## Secrets resolved by the lane (names only)

- `FIREWORKS_API_KEY` (optional)
- `GOOGLE_CLIENT_EMAIL` (optional)
- `GOOGLE_PRIVATE_KEY` (optional)
- `GOOGLE_VERTEX_LOCATION` (optional)
- `GOOGLE_VERTEX_PROJECT` (optional)
- `OPENAI_API_KEY` (optional)
- `REPLICATE_API_TOKEN` (optional)
