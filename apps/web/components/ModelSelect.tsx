import { Card, CardContent } from "@/components/ui/card";
import { imageHelpers } from "@/lib/image-helpers";
import {
  FireworksIcon,
  OpenAIIcon,
  ReplicateIcon,
  VertexIcon,
  WorkersAIIcon,
} from "@/lib/logos";
import { ProviderKey } from "@/lib/provider-config";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { ProviderTiming } from "@/lib/image-types";

import { ImageDisplay } from "./ImageDisplay";
import Link from "next/link";

interface ModelSelectProps {
  label: string;
  models: string[];
  value: string;
  providerKey: ProviderKey;
  onChange: (value: string, providerKey: ProviderKey) => void;
  iconPath: string;
  color: string;
  enabled?: boolean;
  onToggle?: (enabled: boolean) => void;
  image: string | null | undefined;
  timing?: ProviderTiming;
  failed?: boolean;
  modelId: string;
}

const PROVIDER_ICONS = {
  workersai: WorkersAIIcon,
  openai: OpenAIIcon,
  replicate: ReplicateIcon,
  vertex: VertexIcon,
  fireworks: FireworksIcon,
} as const;

// Each provider's docs (upstream linked the AI SDK's provider pages; Workers
// AI's models are Cloudflare's).
const AI_SDK_PROVIDERS = "https://sdk.vercel.ai/providers/ai-sdk-providers/";
const PROVIDER_LINKS = {
  workersai: "https://developers.cloudflare.com/workers-ai/models/",
  openai: AI_SDK_PROVIDERS + "openai",
  replicate: AI_SDK_PROVIDERS + "replicate",
  vertex: AI_SDK_PROVIDERS + "google-vertex",
  fireworks: AI_SDK_PROVIDERS + "fireworks",
} as const;

export function ModelSelect({
  label,
  models,
  value,
  providerKey,
  onChange,
  enabled = true,
  image,
  timing,
  failed,
  modelId,
}: ModelSelectProps) {
  const Icon = PROVIDER_ICONS[providerKey];

  return (
    <Card
      className={cn(`w-full transition-opacity`, enabled ? "" : "opacity-50")}
    >
      <CardContent className="pt-6 h-full">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 w-full transition-opacity duration-200">
            <div className="bg-primary p-2 rounded-full">
              <Link
                className="hover:opacity-80"
                href={
                  PROVIDER_LINKS[providerKey]
                }
                target="_blank"
              >
                <div className="text-primary-foreground">
                  <Icon size={28} />
                </div>
              </Link>
            </div>
            <div className="flex flex-col w-full">
              <Link
                className="hover:opacity-80"
                href={
                  PROVIDER_LINKS[providerKey]
                }
                target="_blank"
              >
                <h3 className="font-semibold text-lg">{label}</h3>
              </Link>
              <div className="flex justify-between items-center w-full">
                <Select
                  defaultValue={value}
                  value={value}
                  onValueChange={(selectedValue) =>
                    onChange(selectedValue, providerKey)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={value || "Select a model"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {models.map((model) => (
                        <SelectItem key={model} value={model} className="">
                          <span className="hidden xl:inline">
                            {imageHelpers.formatModelId(model).length > 30
                              ? imageHelpers.formatModelId(model).slice(0, 30) +
                                "..."
                              : imageHelpers.formatModelId(model)}
                          </span>
                          <span className="hidden lg:inline xl:hidden">
                            {imageHelpers.formatModelId(model).length > 20
                              ? imageHelpers.formatModelId(model).slice(0, 20) +
                                "..."
                              : imageHelpers.formatModelId(model)}
                          </span>

                          <span className="lg:hidden">
                            {imageHelpers.formatModelId(model)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <ImageDisplay
          modelId={modelId}
          provider={providerKey}
          image={image}
          timing={timing}
          failed={failed}
        />
      </CardContent>
    </Card>
  );
}
