import { describe, expect, it } from "vitest";
import { experimental_generateImage as generateImage } from "ai";
import {
  WORKERS_AI_IMAGE_MODELS,
  imageFromAnswer,
  isWorkersAIImageModel,
  workersAIImage,
  type AiBinding,
} from "@/lib/workers-ai-image";
import { MODEL_CONFIGS, PROVIDERS } from "@/lib/provider-config";

// lib/workers-ai-image.ts: Workers AI's image models over the Worker's AI
// binding, against a binding that answers the way each model family does —
// FLUX.1 [schnell] with { image: base64 }, the Stable Diffusion family with a
// PNG stream. Never a real model.

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

function binding(answer: (model: string) => unknown) {
  const calls: { model: string; inputs: Record<string, unknown> }[] = [];
  const ai: AiBinding = {
    async run(model, inputs) {
      calls.push({ model, inputs });
      return answer(model);
    },
  };
  return { ai, calls };
}

const stream = (bytes: Uint8Array) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(bytes.slice(0, 4));
      c.enqueue(bytes.slice(4));
      c.close();
    },
  });

describe("workers-ai-image", () => {
  it("offers exactly the models it knows how to ask, as the page lists them", () => {
    expect(PROVIDERS.workersai.models).toEqual(Object.keys(WORKERS_AI_IMAGE_MODELS));
    expect(isWorkersAIImageModel(MODEL_CONFIGS.performance.workersai)).toBe(true);
    expect(isWorkersAIImageModel(MODEL_CONFIGS.quality.workersai)).toBe(true);
    expect(isWorkersAIImageModel("@cf/meta/llama-4-scout-17b-16e-instruct")).toBe(false);
  });

  it("asks FLUX.1 [schnell] for { prompt, steps } and returns its base64 image", async () => {
    const { ai, calls } = binding(() => ({ image: b64(PNG) }));
    const { image, warnings } = await generateImage({
      model: workersAIImage(ai, "@cf/black-forest-labs/flux-1-schnell"),
      prompt: "a lighthouse at dusk",
      size: "1024x1024",
    });
    expect(calls).toEqual([
      { model: "@cf/black-forest-labs/flux-1-schnell", inputs: { prompt: "a lighthouse at dusk", steps: 4 } },
    ]);
    expect(image.base64).toBe(b64(PNG));
    expect(warnings).toEqual([]);
  });

  it("asks the Stable Diffusion family for { prompt, width, height, seed } and reads its PNG stream", async () => {
    const { ai, calls } = binding(() => stream(PNG));
    const { image } = await generateImage({
      model: workersAIImage(ai, "@cf/stabilityai/stable-diffusion-xl-base-1.0"),
      prompt: "a fox in snow",
      size: "1024x1024",
      seed: 42,
    });
    expect(calls[0].inputs).toEqual({ prompt: "a fox in snow", width: 1024, height: 1024, seed: 42 });
    expect(Array.from(image.uint8Array)).toEqual(Array.from(PNG));
    expect(image.base64).toBe(b64(PNG));
  });

  it("warns, rather than sending, what a model cannot take", async () => {
    const { ai, calls } = binding(() => ({ image: b64(PNG) }));
    const { warnings } = await generateImage({
      model: workersAIImage(ai, "@cf/black-forest-labs/flux-1-schnell"),
      prompt: "x",
      aspectRatio: "16:9",
      seed: 7,
    });
    expect(calls[0].inputs).toEqual({ prompt: "x", steps: 4 });
    expect(warnings.map((w) => (w.type === "unsupported-setting" ? w.setting : w.type)).sort()).toEqual(
      ["aspectRatio", "seed"],
    );
  });

  it("refuses an answer with no image in it", async () => {
    await expect(imageFromAnswer({ image: "" })).rejects.toThrow("without an image");
    await expect(imageFromAnswer({ response: "a poem" })).rejects.toThrow("without an image");
    await expect(imageFromAnswer(null)).rejects.toThrow("without an image");
  });
});
