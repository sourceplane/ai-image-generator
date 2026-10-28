import { NextResponse } from "next/server";
import { availableProviders } from "@/lib/providers";

// What every deploy's smoke test reads: the site can draw. Workers AI, through
// the Worker's own AI binding, must be there on every deploy; the template's
// other providers are listed by NAME once their keys are on the Worker —
// never a key's value.
export const dynamic = "force-dynamic";

export async function GET() {
  const providers = await availableProviders();
  const ok = providers.includes("workersai");
  return NextResponse.json({ ok, providers }, { status: ok ? 200 : 503 });
}
