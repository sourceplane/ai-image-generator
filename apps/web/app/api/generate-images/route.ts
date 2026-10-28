import { NextRequest, NextResponse } from "next/server";
import { experimental_generateImage as generateImage } from "ai";
import { PROVIDERS, ProviderKey } from "@/lib/provider-config";
import { GenerateImageRequest } from "@/lib/api-types";
import { imageModel, ProviderUnavailableError } from "@/lib/providers";

/**
 * Intended to be slightly less than the maximum execution time allowed by the
 * runtime so that we can gracefully terminate our request.
 */
const TIMEOUT_MILLIS = 55 * 1000;

const DEFAULT_IMAGE_SIZE = "1024x1024";
const DEFAULT_ASPECT_RATIO = "1:1";

// How each provider is told the picture's shape (upstream's table, with
// Workers AI added: its models take a width and a height).
const dimensionFormat: Record<ProviderKey, "size" | "aspectRatio"> = {
  workersai: "size",
  openai: "size",
  fireworks: "aspectRatio",
  replicate: "size",
  vertex: "aspectRatio",
};

const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMillis: number
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), timeoutMillis)
    ),
  ]);
};

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const { prompt, provider, modelId } =
    (await req.json()) as GenerateImageRequest;

  try {
    if (!prompt || !provider || !modelId || !PROVIDERS[provider]) {
      const error = "Invalid request parameters";
      console.error(`${error} [requestId=${requestId}]`);
      return NextResponse.json({ error }, { status: 400 });
    }

    // A provider this deployment has no key for, or a model it does not
    // offer, is the caller's mistake — never a call to the provider.
    let model;
    try {
      model = await imageModel(provider, modelId);
    } catch (error) {
      if (error instanceof ProviderUnavailableError) {
        console.warn(`${error.message} [requestId=${requestId}]`);
        return NextResponse.json(
          { error: "This provider is not available on this deployment." },
          { status: 400 }
        );
      }
      throw error;
    }

    const startstamp = performance.now();
    const generatePromise = generateImage({
      model,
      prompt,
      ...(dimensionFormat[provider] === "size"
        ? { size: DEFAULT_IMAGE_SIZE }
        : { aspectRatio: DEFAULT_ASPECT_RATIO }),
      ...(provider !== "openai" && {
        seed: Math.floor(Math.random() * 1000000),
      }),
      // Vertex AI only accepts a specified seed if watermark is disabled.
      providerOptions: { vertex: { addWatermark: false } },
    }).then(({ image, warnings }) => {
      if (warnings?.length > 0) {
        console.warn(
          `Warnings [requestId=${requestId}, provider=${provider}, model=${modelId}]: `,
          warnings
        );
      }
      console.log(
        `Completed image request [requestId=${requestId}, provider=${provider}, model=${modelId}, elapsed=${(
          (performance.now() - startstamp) /
          1000
        ).toFixed(1)}s].`
      );

      return {
        provider,
        image: image.base64,
      };
    });

    const result = await withTimeout(generatePromise, TIMEOUT_MILLIS);
    return NextResponse.json(result, {
      status: "image" in result ? 200 : 500,
    });
  } catch (error) {
    // Log full error detail on the server, but return a generic error message
    // to avoid leaking any sensitive information to the client.
    console.error(
      `Error generating image [requestId=${requestId}, provider=${provider}, model=${modelId}]: `,
      error
    );
    return NextResponse.json(
      {
        error: "Failed to generate image. Please try again later.",
      },
      { status: 500 }
    );
  }
}
