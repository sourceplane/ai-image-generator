import { afterEach, describe, expect, it } from "vitest";
import { ProviderUnavailableError, imageModel, providersFor } from "@/lib/providers";
import { PROVIDER_ORDER, PROVIDERS } from "@/lib/provider-config";

// lib/providers.ts: which providers a deployment can draw with, and the
// refusal of any other. Keys here are made up; nothing calls a provider.

const KEYS = [
  "OPENAI_API_KEY",
  "REPLICATE_API_TOKEN",
  "FIREWORKS_API_KEY",
  "GOOGLE_VERTEX_PROJECT",
  "GOOGLE_VERTEX_LOCATION",
  "GOOGLE_CLIENT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
];

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
});

describe("providersFor", () => {
  it("is Workers AI alone on a fresh deploy: the AI binding and no key", () => {
    expect(providersFor(true, {})).toEqual(["workersai"]);
  });

  it("is nothing off the Worker with no key (no binding to draw with)", () => {
    expect(providersFor(false, {})).toEqual([]);
  });

  it("adds each of the template's providers once its key is set, in the page's order", () => {
    expect(
      providersFor(true, { OPENAI_API_KEY: "sk-made-up", FIREWORKS_API_KEY: "fw-made-up", REPLICATE_API_TOKEN: "r8-made-up" }),
    ).toEqual(["workersai", "replicate", "openai", "fireworks"]);
  });

  it("takes a blank key for no key", () => {
    expect(providersFor(true, { OPENAI_API_KEY: "   ", REPLICATE_API_TOKEN: "" })).toEqual(["workersai"]);
  });

  it("needs all four of Vertex's settings before Vertex appears", () => {
    const vertex = {
      GOOGLE_VERTEX_PROJECT: "made-up-project",
      GOOGLE_VERTEX_LOCATION: "us-central1",
      GOOGLE_CLIENT_EMAIL: "sa@made-up-project.iam.gserviceaccount.com",
      GOOGLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nmade-up\n-----END PRIVATE KEY-----",
    };
    expect(providersFor(true, vertex)).toEqual(["workersai", "vertex"]);
    for (const missing of Object.keys(vertex)) {
      const partial = { ...vertex, [missing]: "" };
      expect(providersFor(true, partial), `without ${missing}`).toEqual(["workersai"]);
    }
  });

  it("knows every provider the page can show", () => {
    expect(PROVIDER_ORDER[0]).toBe("workersai");
    expect([...PROVIDER_ORDER].sort()).toEqual(Object.keys(PROVIDERS).sort());
  });
});

describe("imageModel", () => {
  it("refuses a provider whose key is not set, without calling it", async () => {
    await expect(imageModel("openai", "dall-e-3")).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it("refuses a model the page does not offer, even with the key set", async () => {
    process.env.OPENAI_API_KEY = "sk-made-up";
    await expect(imageModel("openai", "gpt-image-1")).rejects.toBeInstanceOf(ProviderUnavailableError);
    await expect(imageModel("workersai", "@cf/meta/llama-4-scout-17b-16e-instruct")).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  it("refuses Workers AI off the Worker (no binding)", async () => {
    await expect(imageModel("workersai", "@cf/black-forest-labs/flux-1-schnell")).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  it("builds the template's model once its key is set", async () => {
    process.env.OPENAI_API_KEY = "sk-made-up";
    const model = await imageModel("openai", "dall-e-3");
    expect(model.modelId).toBe("dall-e-3");
    expect(model.provider).toContain("openai");
  });
});
