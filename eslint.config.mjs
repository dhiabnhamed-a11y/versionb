import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".open-next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          "selector": "CallExpression[callee.property.name='$queryRaw'], CallExpression[callee.property.name='$executeRaw']",
          "message": "Raw queries bypass tenant isolation. Use tenantQueryRaw or tenantExecuteRaw from @/lib/tenant/tenant-raw-query instead."
        }
      ]
    }
  },
  {
    files: ["src/lib/tenant/tenant-raw-query.ts"],
    rules: {
      "no-restricted-syntax": "off"
    }
  }
]);

export default eslintConfig;
