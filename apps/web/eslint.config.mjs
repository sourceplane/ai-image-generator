import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-config-next 16 brings the React Compiler's rules, which postdate
  // the template's hooks (upstream linted with `next lint` on Next 15): off
  // by name, the template's code unchanged.
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The Workers build's output and wrangler's local state.
    ".open-next/**",
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
