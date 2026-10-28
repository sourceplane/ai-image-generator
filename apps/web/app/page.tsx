import { ImagePlayground } from "@/components/ImagePlayground";
import { getRandomSuggestions } from "@/lib/suggestions";
import { availableProviders } from "@/lib/providers";

export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <ImagePlayground
      suggestions={getRandomSuggestions()}
      providers={await availableProviders()}
    />
  );
}
