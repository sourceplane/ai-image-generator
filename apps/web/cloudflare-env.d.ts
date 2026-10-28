// The Worker's bindings, declared by hand (wrangler.jsonc): the global
// @cloudflare/workers-types would retype the DOM's Request and Response for
// the whole app.
interface CloudflareEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  AI?: import("./lib/workers-ai-image").AiBinding;
}
