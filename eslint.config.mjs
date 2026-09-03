import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist", "coverage", "node_modules", "catalog-service.js", "reservations-service.js", "eslint.config.mjs"],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["**/*.unit.spec.ts", "**/*.e2e.spec.ts", "src/test-support/**/*.ts"],
    languageOptions: {
      globals: globals.jest,
    },
  },
  eslintConfigPrettier,
);
