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
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code agent worktrees (gitignored scratch copies of the repo).
    ".claude/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }]
    }
  },
  // --- Module boundary rules ------------------------------------------------
  // The (admin) and (marketing) route groups are the two halves of the system.
  // Importing across this boundary couples layout, auth concerns, and server
  // actions that should stay isolated. Flag any cross-boundary imports.
  {
    files: ["app/(marketing)/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/\\(admin\\)/**"],
          message: "Marketing pages must not import from admin modules. Move shared code to app/lib/ or app/components/."
        }]
      }]
    }
  },
  {
    files: ["app/(admin)/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/\\(marketing\\)/**"],
          message: "Admin pages must not import from marketing modules. Move shared code to app/lib/ or app/components/."
        }]
      }]
    }
  }
]);

export default eslintConfig;
