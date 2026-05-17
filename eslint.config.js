import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", "build", "node_modules", "electron/renderer/**"] },
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    plugins: { "@stylistic": stylistic },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@stylistic/no-trailing-spaces": "error",
      "@stylistic/no-multiple-empty-lines": [
        "error",
        { max: 1, maxEOF: 0, maxBOF: 0 },
      ],
      "@stylistic/eol-last": ["error", "always"],
      "@stylistic/no-mixed-spaces-and-tabs": "error",
      "@stylistic/no-tabs": "error",
      "@stylistic/no-whitespace-before-property": "error",
    },
  },
  prettierConfig,
);
