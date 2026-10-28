import "server-only";
import type { ImageModel } from "ai";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { openai } from "@ai-sdk/openai";
import { fireworks } from "@ai-sdk/fireworks";
import { replicate } from "@ai-sdk/replicate";
import { vertex } from "@ai-sdk/google-vertex/edge";
import { PROVIDER_ORDER, PROVIDERS, type ProviderKey } from "@/lib/provider-config";
import { workersAIImage, isWorkersAIImageModel, type AiBinding } from "@/lib/workers-ai-image";

// Which providers this deployment can draw with, decided per request on the
// server. Not upstream's: upstream showed all four of its providers and let a
// request fail when a key was missing. Here:
//
//   workersai   always, through the Worker's own `AI` binding (wrangler.jsonc)
//               — the site draws with no key of anyone else's;
//   openai      once OPENAI_API_KEY is set,
//   replicate   once REPLICATE_API_TOKEN is set,
//   fireworks   once FIREWORKS_API_KEY is set,
//   vertex      once GOOGLE_VERTEX_PROJECT, GOOGLE_VERTEX_LOCATION,
//               GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY are all set
//               (a Google Cloud service account's, as upstream asked).
//
// Each key is a Worker secret: an optional Orun secret per environment that
// the deploy pushes to the Worker (component.yaml), never in a bundle. The
// page lists only these providers and the route refuses any other.

const KEYS: Record<Exclude<ProviderKey, "workersai">, string[]> = {
  openai: ["OPENAI_API_KEY"],
  replicate: ["REPLICATE_API_TOKEN"],
  fireworks: ["FIREWORKS_API_KEY"],
  vertex: ["GOOGLE_VERTEX_PROJECT", "GOOGLE_VERTEX_LOCATION", "GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY"],
};

const isSet = (name: string) => Boolean(process.env[name]?.trim());

/** The Worker's AI binding, or undefined off the Worker (a test, a script). */
export async function aiBinding(): Promise<AiBinding | undefined> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as { AI?: AiBinding }).AI;
  } catch {
    return undefined;
  }
}

/** The providers a Worker with (or without) an AI binding and these keys has. */
export function providersFor(
  hasAiBinding: boolean,
  env: Record<string, string | undefined> = process.env,
): ProviderKey[] {
  const set = (name: string) => Boolean(env[name]?.trim());
  return PROVIDER_ORDER.filter((p) => (p === "workersai" ? hasAiBinding : KEYS[p].every(set)));
}

/** The providers this deployment can draw with, in the page's order. */
export async function availableProviders(): Promise<ProviderKey[]> {
  return providersFor((await aiBinding()) !== undefined);
}

export class ProviderUnavailableError extends Error {
  constructor(provider: string) {
    super(`provider ${provider} is not configured on this deployment`);
    this.name = "ProviderUnavailableError";
  }
}

/**
 * The image model for a provider and one of ITS listed models, or an error:
 * a provider this deployment has no key for, or a model the page does not
 * offer (the route never runs an arbitrary model id on the owner's account).
 */
export async function imageModel(provider: ProviderKey, modelId: string): Promise<ImageModel> {
  if (!PROVIDERS[provider]?.models.includes(modelId)) {
    throw new ProviderUnavailableError(`${provider}/${modelId}`);
  }
  if (provider === "workersai") {
    const binding = await aiBinding();
    if (!binding || !isWorkersAIImageModel(modelId)) throw new ProviderUnavailableError(provider);
    return workersAIImage(binding, modelId);
  }
  if (!KEYS[provider].every(isSet)) throw new ProviderUnavailableError(provider);
  switch (provider) {
    case "openai":
      return openai.image(modelId);
    case "replicate":
      return replicate.image(modelId);
    case "fireworks":
      return fireworks.image(modelId);
    case "vertex":
      return vertex.image(modelId);
  }
}
