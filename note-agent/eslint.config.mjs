import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

export default defineConfig([
  {
    ignores: ["node_modules/"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      // Preserve existing rules
      "@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-empty-function": "off",
      "import/extensions": ["error", "ignorePackages", { ts: "always" }],
    },
  },
]);
