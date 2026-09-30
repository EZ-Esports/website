import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';

const linter = new Linter({ configType: 'flat' });

const noServerImportsRule = {
  meta: {
    type: 'problem' as const,
    messages: {
      noServerImport: "Client components ('use client') must not import server/database module '{{source}}'.",
    },
  },
  create(context: any) {
    let isClient = false;
    return {
      Program(node: any) {
        if (
          node.body &&
          node.body.some(
            (stmt: any) =>
              stmt.type === 'ExpressionStatement' &&
              stmt.expression?.type === 'Literal' &&
              stmt.expression?.value === 'use client'
          )
        ) {
          isClient = true;
          return;
        }
        const text = context.sourceCode.getText();
        const leading = text.slice(0, 1024).replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, '').trim();
        if (leading.startsWith('"use client"') || leading.startsWith("'use client'")) {
          isClient = true;
        }
      },
      ImportDeclaration(node: any) {
        if (!isClient) return;
        const source = node.source.value;
        if (typeof source !== 'string') return;

        const isRestricted =
          source === '@/app/lib/db' ||
          source === '@/app/lib/db/index' ||
          source === '@/app/lib/db/schema' ||
          source === '@/app/lib/db/queries' ||
          source === '@/app/lib/supabase/service' ||
          source.startsWith('@/app/lib/db/schema') ||
          source.startsWith('@/app/lib/db/queries') ||
          source.startsWith('@/app/lib/supabase/service') ||
          /(?:^|[\\/])(?:app[\\/]lib[\\/])?db(?:[\\/](?:index|schema|queries))?$/.test(source) ||
          /(?:^|[\\/])(?:app[\\/]lib[\\/])?supabase[\\/]service$/.test(source);

        if (isRestricted) {
          context.report({
            node,
            messageId: 'noServerImport',
            data: { source },
          });
        }
      },
    };
  },
};

describe('ESLint client-boundary/no-server-imports-in-client rule', () => {
  it('flags client components importing database, schema, queries, or service modules', () => {
    const invalidClientCode = `'use client';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { getMatches } from '@/app/lib/db/queries';
import { createServiceClient } from '@/app/lib/supabase/service';
`;

    const messages = linter.verify(invalidClientCode, [
      {
        languageOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
        },
        plugins: {
          'client-boundary': {
            rules: {
              'no-server-imports-in-client': noServerImportsRule,
            },
          },
        },
        rules: {
          'client-boundary/no-server-imports-in-client': 'error',
        },
      },
    ]);

    expect(messages).toHaveLength(4);
    expect(messages[0].ruleId).toBe('client-boundary/no-server-imports-in-client');
    expect(messages[0].message).toContain('@/app/lib/db');
    expect(messages[1].message).toContain('@/app/lib/db/schema');
    expect(messages[2].message).toContain('@/app/lib/db/queries');
    expect(messages[3].message).toContain('@/app/lib/supabase/service');
  });

  it('allows server components to import database and service modules', () => {
    const validServerCode = `import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { createServiceClient } from '@/app/lib/supabase/service';
`;

    const messages = linter.verify(validServerCode, [
      {
        languageOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
        },
        plugins: {
          'client-boundary': {
            rules: {
              'no-server-imports-in-client': noServerImportsRule,
            },
          },
        },
        rules: {
          'client-boundary/no-server-imports-in-client': 'error',
        },
      },
    ]);

    expect(messages).toHaveLength(0);
  });

  it('allows client components to import pure match-page DTO helpers', () => {
    const validClientDtoImport = `'use client';
import { DIVISIONS } from '@/app/lib/db/match-page';
`;

    const messages = linter.verify(validClientDtoImport, [
      {
        languageOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
        },
        plugins: {
          'client-boundary': {
            rules: {
              'no-server-imports-in-client': noServerImportsRule,
            },
          },
        },
        rules: {
          'client-boundary/no-server-imports-in-client': 'error',
        },
      },
    ]);

    expect(messages).toHaveLength(0);
  });
});
