# web

The AI SDK image generator — one prompt, images from Workers AI and any provider whose key is set, side by side (Next.js on Cloudflare Workers + Static Assets via @opennextjs/cloudflare, per environment)

A Cloudflare Worker with Static Assets (server rendering plus static files), deployed per environment by its CI lane.

|              |                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Type         | `cloudflare-workers-assets-turbo`                                                                                  |
| Source       | `apps/web`                                                                                                         |
| Package      | `@app/web`                                                                                                         |
| Environments | `dev`: `verify` · `stage`: `verify`, `deploy` on a push to `main` · `prod`: `verify`, `deploy` on a push to `main` |

## Depends on

- (none)

## Depended on by

- (none)
