import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default defineConfig([
    {
        ignores: ["coverage/**", "main.js", "node_modules/**", "esbuild.config.mjs", "vitest.config.ts", "vitest.setup.ts", "tests_live/**"],
    },
    {
        files: ["**/*.ts", "**/*.js"],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
    },
    ...obsidianmd.configs.recommended,
    {
        files: ["**/*.ts"],
        languageOptions: {
            parser: tsparser,
            parserOptions: { project: "./tsconfig.json" },
        },
        rules: {
            "obsidianmd/ui/sentence-case": [
                "warn",
                {
                    enforceCamelCaseLower: true,
                },
            ],
        },
    },
]);
