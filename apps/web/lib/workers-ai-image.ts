import type { ImageModel } from "ai";

// Workers AI's text-to-image models as an AI SDK image model, over the
// Worker's own `AI` binding (wrangler.jsonc). Not upstream's: upstream had no
// keyless provider, so a fresh deploy could draw nothing until its owner
// added a vendor key. Here the Cloudflare account the site deploys into is
// the default provider, and the template's own four appear beside it once
// their keys are set (lib/providers.ts).
//
// Written here rather than taken from `workers-ai-provider`: that package's
// last release for AI SDK 4 (0.7.x) reads every image model's answer as a
// binary stream, which is how the Stable Diffusion family answers, while
// FLUX.1 [schnell] answers `{ image: <base64> }`. This adapter asks each
// model in its own input shape and reads either answer.

/** The binding's one method this adapter uses. */
export interface AiBinding {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

/** Each Workers AI image model this site offers, and how it is asked. */
export const WORKERS_AI_IMAGE_MODELS = {
  // { prompt, steps } → { image: base64 }; always 1024×1024.
  "@cf/black-forest-labs/flux-1-schnell": "flux",
  // { prompt, width, height, seed } → a PNG stream.
  "@cf/stabilityai/stable-diffusion-xl-base-1.0": "sdxl",
  "@cf/bytedance/stable-diffusion-xl-lightning": "sdxl",
  "@cf/lykon/dreamshaper-8-lcm": "sdxl",
} as const;

export type WorkersAIImageModelId = keyof typeof WORKERS_AI_IMAGE_MODELS;

export function isWorkersAIImageModel(id: string): id is WorkersAIImageModelId {
  return Object.prototype.hasOwnProperty.call(WORKERS_AI_IMAGE_MODELS, id);
}

type GenerateOptions = Parameters<ImageModel["doGenerate"]>[0];
type GenerateResult = Awaited<ReturnType<ImageModel["doGenerate"]>>;
type Warning = GenerateResult["warnings"][number];

function dimensions(size: string | undefined): { width?: number; height?: number } {
  const m = /^(\d+)x(\d+)$/.exec(size ?? "");
  return m ? { width: Number(m[1]), height: Number(m[2]) } : {};
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let length = 0;
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    length += value.length;
  }
  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** The image a model answered, as base64 or bytes; an error for anything else. */
export async function imageFromAnswer(answer: unknown): Promise<string | Uint8Array> {
  if (answer instanceof ReadableStream) return readStream(answer as ReadableStream<Uint8Array>);
  if (answer instanceof Uint8Array) return answer;
  if (answer instanceof ArrayBuffer) return new Uint8Array(answer);
  if (answer && typeof answer === "object" && typeof (answer as { image?: unknown }).image === "string") {
    const image = (answer as { image: string }).image;
    if (image.length > 0) return image;
  }
  throw new Error("Workers AI answered without an image");
}

export function workersAIImage(binding: AiBinding, modelId: WorkersAIImageModelId): ImageModel {
  const shape = WORKERS_AI_IMAGE_MODELS[modelId];
  return {
    specificationVersion: "v1",
    provider: "workers-ai.image",
    modelId,
    maxImagesPerCall: 1,
    async doGenerate({ prompt, n, size, aspectRatio, seed }: GenerateOptions): Promise<GenerateResult> {
      const warnings: Warning[] = [];
      if (aspectRatio != null) warnings.push({ type: "unsupported-setting", setting: "aspectRatio" });
      const inputs: Record<string, unknown> =
        shape === "flux"
          ? { prompt, steps: 4 }
          : { prompt, ...dimensions(size), ...(seed != null ? { seed } : {}) };
      if (shape === "flux" && size != null && size !== "1024x1024") {
        warnings.push({ type: "unsupported-setting", setting: "size", details: "FLUX.1 [schnell] draws 1024×1024" });
      }
      if (shape === "flux" && seed != null) warnings.push({ type: "unsupported-setting", setting: "seed" });
      const images = await Promise.all(
        Array.from({ length: n }, async () => imageFromAnswer(await binding.run(modelId, inputs))),
      );
      return {
        // The AI SDK takes base64 strings or bytes, but one kind per call.
        images: images.every((i) => typeof i === "string")
          ? (images as string[])
          : images.map((i) => (typeof i === "string" ? Uint8Array.from(atob(i), (c) => c.charCodeAt(0)) : i)),
        warnings,
        response: { timestamp: new Date(), modelId, headers: undefined },
      };
    },
  };
}
