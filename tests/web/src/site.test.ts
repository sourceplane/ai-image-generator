import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const web = path.resolve(__dirname, "../../../apps/web");
const read = (f: string) => fs.readFileSync(path.join(web, f), "utf8");

describe("site identity (apps/web/app/site.ts)", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    vi.resetModules();
  });

  it("names the site on one literal line and links its source repository", async () => {
    const { SITE_NAME, SOURCE_URL } = await import("app/site");
    const line = /^export const SITE_NAME = (".*");$/m.exec(read("app/site.ts"));
    expect(line, "the SITE_NAME line").not.toBeNull();
    expect(SITE_NAME).toBe(JSON.parse(line![1]));
    expect(SITE_NAME.trim()).not.toBe("");
    expect(SOURCE_URL).toMatch(/^https:\/\/github\.com\/[A-Za-z0-9-]+\/[a-z0-9-]+$/);
  });

  it("takes its origin from NEXT_PUBLIC_SITE_URL, else localhost", async () => {
    expect((await import("app/site")).SITE_URL).toBe("http://localhost:3000");
    vi.resetModules();
    process.env.NEXT_PUBLIC_SITE_URL = "https://images.example.com";
    expect((await import("app/site")).SITE_URL).toBe("https://images.example.com");
  });

  it("titles the page and the header with the site's name, and links its own source", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toContain('import { SITE_NAME, SITE_URL } from "./site";');
    expect(layout).toContain("title: SITE_NAME,");
    expect(layout).toContain("metadataBase: new URL(SITE_URL),");
    expect(layout).not.toContain("@vercel/analytics");
    const header = read("components/Header.tsx");
    expect(header).toContain('import { SITE_NAME, SOURCE_URL } from "@/app/site";');
    expect(header).toContain("{SITE_NAME}");
    expect(header).toContain("href={SOURCE_URL}");
    expect(header).not.toContain("vercel.com/new/clone");
  });

  it("binds Workers AI as AI on the Worker", () => {
    const cfg = JSON.parse(
      read("wrangler.jsonc")
        .split("\n")
        .filter((l) => !l.trim().startsWith("//"))
        .join("\n"),
    );
    expect(cfg.ai).toEqual({ binding: "AI" });
    expect(cfg.compatibility_flags).toContain("nodejs_compat");
  });
});
