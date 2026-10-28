import { defineConfig } from "vitest/config";
import * as path from "node:path";

const web = path.resolve(__dirname, "../../apps/web");

export default defineConfig({
  resolve: {
    alias: [
      { find: /^app\//, replacement: web + "/app/" },
      { find: /^@\//, replacement: web + "/" },
      // `server-only` refuses to load outside a server build.
      { find: /^server-only$/, replacement: path.resolve(__dirname, "src/stubs/server-only.ts") },
    ],
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
});
