// The site's identity, written once. The page title, the header and the Open
// Graph card read SITE_NAME; the header's source link is SOURCE_URL. A product
// built from this baseline gets both rewritten to its own name and repository
// at instantiation, so keep them literal and on one line each.
export const SITE_NAME = "AI SDK Image Generator";
export const SOURCE_URL = "https://github.com/sourceplane/ai-image-generator";

// The site's public origin, for metadataBase (the Open Graph image's absolute
// URL). The Orun build sets NEXT_PUBLIC_SITE_URL per environment: its
// SITE_URL from intent.yaml, else its workers.dev URL.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
