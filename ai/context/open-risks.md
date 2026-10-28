# ai-image-generator — open risks

What is not yet proven or not yet decided. The full write-up of every risk,
including the accepted and resolved ones, is
`specs/epics/ai-image-generator/risks-and-open-questions.md`; this page lists
only what is still live, so it should be short.

| ID | Risk | State | What closes it |
|---|---|---|---|
| IG-A | `baseline-v1` is not yet proven live; it is proven offline in Baseline CI (the offline bootstrap, the stage lane's own steps, the site served and smoke-tested over a Workers AI stand-in, with no key and with made-up keys) | OPEN | One console bootstrap from `baseline-v1` |
| IG-B | No real Workers AI model has drawn on the Worker: the binding has no local mode, so offline the stand-in answers in each model family's shape (base64 for FLUX, a PNG stream for SDXL) | OPEN | One image from each of the four models on a live site's stage |
| IG-D | The site is open, as the template is: anyone who reaches it draws on the account's Workers AI and the owner's provider keys | ACCEPTED, documented | Cloudflare Access or sign-in, the owner's choice (README) |

Accepted, and worth knowing before you change them: IG-C (Workers AI's image
models through an adapter written here), IG-E (a deploy pushes keys and
deletes none), IG-F (Next 16.3.8, not 15.5.15).
