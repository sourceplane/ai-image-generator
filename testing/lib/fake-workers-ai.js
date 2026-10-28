// A stand-in for Workers AI, for `wrangler dev` with no Cloudflare account.
//
// Workers AI has no local mode: the AI binding always calls the account, and
// the e2e has none. So the e2e binds `AI` to THIS Worker instead — a service
// binding to its default entrypoint, whose `run(model, inputs)` is reached
// over RPC exactly as the real binding's is — and the app's own code
// (lib/workers-ai-image.ts, the real AI SDK) cannot tell the difference in
// shape. What it draws is deterministic, not a picture, and that is the
// point: the e2e asserts the app's path end to end.
//
//   @cf/black-forest-labs/flux-1-schnell        → { image: <base64> }, asked
//                                                 { prompt, steps } and
//                                                 nothing else
//   the Stable Diffusion family (sdxl base, sdxl → a PNG as a ReadableStream,
//   lightning, dreamshaper)                        asked { prompt, width,
//                                                 height[, seed] }
//
// Any other model, or an input outside the model's own shape, is refused the
// way Workers AI refuses it: with an error. Every call is logged as one
// `fake-workers-ai {…}` line, which the e2e reads back from wrangler's output.
import { WorkerEntrypoint } from "cloudflare:workers";

// A real 1×1 PNG, then the prompt's bytes as a trailing chunk: a viewer
// shows a pixel, and the e2e can tell which prompt drew which image.
const PIXEL = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);
const drawing = (model, prompt) => {
  const tail = new TextEncoder().encode(`fake-workers-ai:${model}:${prompt}`);
  const out = new Uint8Array(PIXEL.length + tail.length);
  out.set(PIXEL, 0);
  out.set(tail, PIXEL.length);
  return out;
};
const b64 = (bytes) => btoa(String.fromCharCode(...bytes));

const SDXL = new Set([
  "@cf/stabilityai/stable-diffusion-xl-base-1.0",
  "@cf/bytedance/stable-diffusion-xl-lightning",
  "@cf/lykon/dreamshaper-8-lcm",
]);

function refuse(model, inputs, why) {
  console.log(`fake-workers-ai ${JSON.stringify({ model, inputs, refused: why })}`);
  throw new Error(`AiError: ${why}`);
}

export default class FakeWorkersAI extends WorkerEntrypoint {
  async run(model, inputs) {
    const keys = Object.keys(inputs ?? {}).sort();
    if (typeof inputs?.prompt !== "string" || inputs.prompt === "") refuse(model, inputs, "prompt is required");
    if (model === "@cf/black-forest-labs/flux-1-schnell") {
      if (keys.some((k) => !["prompt", "steps"].includes(k))) refuse(model, inputs, `unexpected input ${keys}`);
      if (!(inputs.steps >= 1 && inputs.steps <= 8)) refuse(model, inputs, "steps must be 1..8");
      console.log(`fake-workers-ai ${JSON.stringify({ model, inputs, answered: "base64" })}`);
      return { image: b64(drawing(model, inputs.prompt)) };
    }
    if (SDXL.has(model)) {
      if (keys.some((k) => !["prompt", "width", "height", "seed"].includes(k))) {
        refuse(model, inputs, `unexpected input ${keys}`);
      }
      if (inputs.width !== 1024 || inputs.height !== 1024) refuse(model, inputs, "expected 1024x1024");
      console.log(`fake-workers-ai ${JSON.stringify({ model, inputs, answered: "stream" })}`);
      const bytes = drawing(model, inputs.prompt);
      return new ReadableStream({
        start(c) {
          c.enqueue(bytes.slice(0, 8));
          c.enqueue(bytes.slice(8));
          c.close();
        },
      });
    }
    refuse(model, inputs, `no such image model: ${model}`);
  }

  async fetch() {
    return new Response("fake-workers-ai: reach me through the AI service binding", { status: 404 });
  }
}
