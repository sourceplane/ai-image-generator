import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

// tooling/wire/worker-secrets.mjs: what hands the providers' keys to the
// Worker on a deploy, and to wrangler dev locally. Run as the deploy runs it,
// with made-up values, and never with a Cloudflare credential.
const SCRIPT = path.resolve(__dirname, "../../../tooling/wire/worker-secrets.mjs");
const OPENAI = "sk-offline-fixture-not-a-key";
const REPLICATE = "r8_offline_fixture_not_a_token";
const NAMES = ["OPENAI_API_KEY", "REPLICATE_API_TOKEN", "FIREWORKS_API_KEY"];
const ARGS = NAMES.flatMap((n) => ["--secret", n]);

function run(args: string[], env: Record<string, string | undefined>) {
  const clean = { ...process.env };
  delete clean.CLOUDFLARE_API_TOKEN;
  for (const n of NAMES) delete clean[n];
  return spawnSync(process.execPath, [SCRIPT, ...args], { env: { ...clean, ...env }, encoding: "utf8" });
}

describe("worker-secrets.mjs", () => {
  it("skips every unset key and succeeds: a fresh product draws on Workers AI alone", () => {
    const r = run([...ARGS, "--worker", "acme-web-stage"], {});
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("not set, skipped: OPENAI_API_KEY, REPLICATE_API_TOKEN, FIREWORKS_API_KEY");
    expect(r.stdout).toContain("nothing to set");
  });

  it("pushes nothing from a verify lane (no Cloudflare credential), and prints no value", () => {
    const r = run([...ARGS, "--worker", "acme-web-stage"], { OPENAI_API_KEY: OPENAI, REPLICATE_API_TOKEN: REPLICATE });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("a verify lane");
    expect(r.stdout).toContain("not set, skipped: FIREWORKS_API_KEY");
    expect(r.stdout + r.stderr).not.toContain(OPENAI);
    expect(r.stdout + r.stderr).not.toContain(REPLICATE);
  });

  it("writes .dev.vars for wrangler dev with the keys that are set, readable by its owner only", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "worker-secrets-"));
    const file = path.join(dir, ".dev.vars");
    const r = run([...ARGS, "--dev-vars", file], { OPENAI_API_KEY: OPENAI, REPLICATE_API_TOKEN: REPLICATE });
    expect(r.status).toBe(0);
    expect(fs.readFileSync(file, "utf8")).toBe(`OPENAI_API_KEY="${OPENAI}"\nREPLICATE_API_TOKEN="${REPLICATE}"\n`);
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(r.stdout + r.stderr).not.toContain(OPENAI);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("refuses a name that is not an environment variable", () => {
    const r = run(["--secret", "openai-key", "--worker", "acme-web-stage"], {});
    expect(r.status).toBe(2);
  });
});
