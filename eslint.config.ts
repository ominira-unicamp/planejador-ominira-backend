import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
        plugins: { js },
        extends: ["js/recommended"],
        ignores: [
            "**/dist/**",
            "**/node_modules/**",
            "**/prisma/generated/**",
            "package.json",
            "tsconfig.json"
        ],
        languageOptions: {
            globals: globals.node,
            parserOptions: {
                project: ["./packages/*/tsconfig.json"],
                tsconfigRootDir: import.meta.dirname
            }
        }
    },
    tseslint.configs.recommended,
    {
        files: ["eslint.config.ts", "packages/db/prisma.config.ts"],
        languageOptions: {
            parserOptions: {
                project: false
            }
        }
    },
    {
        rules: {
            "no-unassigned-vars": "warn",
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_"
                }
            ]
        }
    },
    eslintConfigPrettier
]);
