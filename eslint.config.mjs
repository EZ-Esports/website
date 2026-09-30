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
    // Antigravity/Gemini agent worktrees.
    ".gemini/**",
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
  },
  // Disallow client components from importing server-only database, schema, or service modules.
  {
    plugins: {
      "client-boundary": {
        rules: {
          "no-server-imports-in-client": {
            meta: {
              type: "problem",
              docs: {
                description: "Disallow client components from importing server-only database, schema, or service modules.",
              },
              messages: {
                noServerImport:
                  "Client components ('use client') must not import server/database module '{{source}}'. Move database operations to Server Components, Route Handlers, or Server Actions.",
              },
              schema: [],
            },
            create(context) {
              let isClient = false;
              return {
                Program(node) {
                  if (
                    node.body &&
                    node.body.some(
                      (stmt) =>
                        stmt.type === "ExpressionStatement" &&
                        stmt.expression?.type === "Literal" &&
                        stmt.expression?.value === "use client"
                    )
                  ) {
                    isClient = true;
                    return;
                  }
                  const text = context.sourceCode.getText();
                  const leading = text.slice(0, 1024).replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, "").trim();
                  if (leading.startsWith('"use client"') || leading.startsWith("'use client'")) {
                    isClient = true;
                  }
                },
                ImportDeclaration(node) {
                  if (!isClient) return;
                  const source = node.source.value;
                  if (typeof source !== "string") return;

                  const isRestricted =
                    source === "@/app/lib/db" ||
                    source === "@/app/lib/db/index" ||
                    source === "@/app/lib/db/schema" ||
                    source === "@/app/lib/db/queries" ||
                    source === "@/app/lib/supabase/service" ||
                    source.startsWith("@/app/lib/db/schema") ||
                    source.startsWith("@/app/lib/db/queries") ||
                    source.startsWith("@/app/lib/supabase/service") ||
                    /(?:^|[\\/])(?:app[\\/]lib[\\/])?db(?:[\\/](?:index|schema|queries))?$/.test(source) ||
                    /(?:^|[\\/])(?:app[\\/]lib[\\/])?supabase[\\/]service$/.test(source);

                  if (isRestricted) {
                    context.report({
                      node,
                      messageId: "noServerImport",
                      data: { source },
                    });
                  }
                },
              };
            },
          },
        },
      },
    },
    rules: {
      "client-boundary/no-server-imports-in-client": "error",
    },
  }
]);

export default eslintConfig;
